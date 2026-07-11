# SBI-02 · Data model & schema (DDL)

> **Model:** Sonnet 4.6, low effort.
> **Depends on:** SBI-01.
> **Objective:** Define and create the Postgres schema in Neon. This is the foundation; SBI-03 (seed), SBI-05 (engine), and SBI-07 (booking) all read/write these tables.

---

## Design principle (from Architecture)
Data lives in layers, separated by nature. **Do not mix written-truth with derived or transactional state.**
- **Static catalog** (written by hand / seed): zones, transfer matrix, providers, experiences, lodging, provider personalization answers.
- **Derived** (NOT stored — computed by functions in SBI-04): background occupancy. **No `availability` table.**
- **Transactional** (runtime): client requests, orders, order items.
- **Ephemeral** (NOT a permanent table — see SBI-07): per-request provider confirmations live in a cache with a 15-min hold; they only materialize into orders on payment.

---

## Tables to create

### `zones`
| column | type | notes |
|---|---|---|
| id | text PK | slug, e.g. `santa_ana`, `la_libertad` |
| name | text | display name |
| region | text | `west` \| `central` \| `east` (label only) |

Seed target zones (SBI-03 fills them): Santa Ana (volcano + Coatepeque), Ruta de las Flores / Ataco / Juayúa, Tazumal / Chalchuapa, San Salvador, La Libertad / El Tunco / El Zonte, Suchitoto, Joya de Cerén / San Andrés, Bahía de Jiquilisco / Usulután, Alegría, (optional Perquín/Morazán or El Cuco). ~9–10 zones.

### `transfer_matrix`
| column | type | notes |
|---|---|---|
| from_zone | text FK→zones.id | |
| to_zone | text FK→zones.id | |
| minutes | integer | average point-to-point transfer time |
| PRIMARY KEY (from_zone, to_zone) | | |

May be treated as symmetric in v1 (store both directions or read symmetrically). Same-zone = 0 (or a small intra-zone default).

### `providers`
| column | type | notes |
|---|---|---|
| id | text PK | slug |
| name | text | |
| zone_id | text FK→zones.id | where they operate |
| provider_type | text | `formal` \| `informal` — first-class modeling variable |
| confirmation_mode | text | `instant` (formal) \| `on_request` (informal) |
| reliability_score | numeric | 0–1; higher = more likely to respond / less likely to fail. Feeds availability + disruption generation |
| base_popularity | numeric | 0–1; higher = busier → higher background occupancy |

### `experiences`
| column | type | notes |
|---|---|---|
| id | text PK | slug |
| provider_id | text FK→providers.id | |
| name | text | |
| category | text | `nature` \| `food` \| `culture` \| `beach` \| `adventure` \| `coffee` (extend as needed by seed) |
| zone_id | text FK→zones.id | usually inherits provider zone; explicit |
| duration_min | integer | time consumed from the day |
| open_days | text | which days it operates (e.g. CSV `mon,tue,...` or a bitmask — pick one, document it) |
| open_from | time | daily window start |
| open_to | time | daily window end |
| net_price | numeric | provider net rate per the group/booking as modeled (document per-person vs per-group; recommend per-person, note it) |
| capacity_per_slot | integer | max travelers per slot |
| dependency | text NULL | `sunrise_only` \| `tide_dependent` \| `weather_sensitive` \| NULL — special hard constraints |

### `lodging`
| column | type | notes |
|---|---|---|
| id | text PK | |
| name | text | |
| zone_id | text FK→zones.id | nightly geographic anchor |
| tier | text | `budget` \| `comfort` \| `premium` |
| net_price_per_night | numeric | |
| capacity | integer | |

### `provider_personalization`
Standardized personalization capability answers per provider — the small controlled corpus the LLM personalization layer (SBI-06) reads. Fixed dimensions so answers are comparable.
| column | type | notes |
|---|---|---|
| provider_id | text FK→providers.id PK | |
| special_occasions | text | what they can accommodate (anniversary, birthday…) |
| dietary_options | text | vegetarian, vegan, allergies… |
| privacy_options | text | private table, exclusive access… |
| extras_on_request | text | premium tasting, transport upgrade… |

### `client_requests`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| token | text UNIQUE | non-guessable; used in `/proposals/{token}` |
| email | text | for the 3 emails (no login) |
| arrival_date | date | |
| departure_date | date | |
| arrival_time | time | flight land time (day-1 hard constraint) |
| departure_time | time | final-day flight (hard constraint) |
| travelers | integer | |
| budget_total | numeric | total trip budget (USD). Validated against MARKED-UP price |
| prefs_json | jsonb | dropdown selections (interests, pace, mornings, group composition, lodging tier) |
| free_text | text | the one free-text field (LLM input) |
| status | text | `building` \| `proposals_ready` \| `paid` \| `expired` |
| created_at | timestamptz default now() | |

### `orders`
Materialized ONLY when the client pays.
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| request_id | uuid FK→client_requests.id | |
| chosen_itinerary_json | jsonb | the full selected itinerary (days, pieces, lodging) |
| client_price | numeric | marked-up total the client paid |
| status | text | `paid` \| `settled` |
| created_at | timestamptz default now() | |

### `order_items`
The individual booked pieces of a paid order (activities + lodging nights). Used by repair (SBI-13) to know what's booked.
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| order_id | uuid FK→orders.id | |
| item_type | text | `experience` \| `lodging` |
| ref_id | text | experience_id or lodging_id |
| day_index | integer | which day of the trip |
| net_price | numeric | provider net for this piece (for settlement; never shown to client) |
| status | text | `booked` \| `disrupted` \| `replaced` |

---

## Deliverables
1. SQL DDL file(s) in `project/src/lib/db/` (e.g. `schema.sql` or numbered migration files).
2. A small runnable script (`migrate.ts` or similar) that applies the DDL to the Neon DB via `DATABASE_URL`.
3. Shared TypeScript types in `project/src/lib/types/` mirroring these tables (the engine and services import these).

## Verification criteria
- Running the migration against Neon creates all tables with the FKs above, no errors.
- TypeScript types compile and match the columns.
- `client_requests.token` and the uniqueness constraint exist.
- No `availability` table exists (occupancy is computed, not stored).

## Do NOT
- Do NOT create an availability/occupancy table.
- Do NOT create a permanent table for ephemeral per-request confirmations (that's cache — SBI-07).
- Do NOT store client price on providers or expose markup anywhere near provider tables.

## Handoff notes to write in task_list.md
- Final table + column names as built (exact), for downstream SBIs to reference.
- The encoding chosen for `open_days` (CSV vs bitmask).
- Whether `net_price` is per-person or per-group (recommend per-person; state the decision).
- The migration command to run.
