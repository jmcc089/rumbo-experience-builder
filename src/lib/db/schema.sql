-- Rumbo · Schema DDL
-- Run via: npx tsx src/lib/db/migrate.ts
-- net_price on experiences is PER PERSON.
-- open_days is a CSV of 3-letter day abbreviations: e.g. 'mon,tue,wed,thu,fri,sat,sun'

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Static catalog ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS zones (
  id     text PRIMARY KEY,
  name   text NOT NULL,
  region text NOT NULL  -- 'west' | 'central' | 'east'
);

CREATE TABLE IF NOT EXISTS transfer_matrix (
  from_zone text NOT NULL REFERENCES zones(id),
  to_zone   text NOT NULL REFERENCES zones(id),
  minutes   integer NOT NULL,
  PRIMARY KEY (from_zone, to_zone)
);

CREATE TABLE IF NOT EXISTS providers (
  id                text PRIMARY KEY,
  name              text    NOT NULL,
  zone_id           text    NOT NULL REFERENCES zones(id),
  provider_type     text    NOT NULL,  -- 'formal' | 'informal'
  confirmation_mode text    NOT NULL,  -- 'instant' | 'on_request'
  reliability_score numeric NOT NULL,  -- 0–1
  base_popularity   numeric NOT NULL,  -- 0–1
  lat               double precision,  -- coherent-but-fictional coords; drives the itinerary map pin
  lng               double precision
);

CREATE TABLE IF NOT EXISTS experiences (
  id                text PRIMARY KEY,
  provider_id       text    NOT NULL REFERENCES providers(id),
  name              text    NOT NULL,
  category          text    NOT NULL,  -- 'nature'|'food'|'culture'|'beach'|'adventure'|'coffee'
  zone_id           text    NOT NULL REFERENCES zones(id),
  duration_min      integer NOT NULL,
  open_days         text    NOT NULL,  -- CSV: 'mon,tue,wed,thu,fri,sat,sun'
  open_from         time    NOT NULL,
  open_to           time    NOT NULL,
  net_price         numeric NOT NULL,  -- per person
  capacity_per_slot integer NOT NULL,
  dependency        text               -- 'sunrise_only'|'tide_dependent'|'weather_sensitive'|NULL
);

CREATE TABLE IF NOT EXISTS lodging (
  id                  text    PRIMARY KEY,
  name                text    NOT NULL,
  zone_id             text    NOT NULL REFERENCES zones(id),
  tier                text    NOT NULL,  -- 'budget'|'comfort'|'premium'
  net_price_per_night numeric NOT NULL,
  capacity            integer NOT NULL,
  lat                 double precision,  -- coherent-but-fictional coords; drives the itinerary map pin
  lng                 double precision
);

CREATE TABLE IF NOT EXISTS provider_personalization (
  provider_id        text PRIMARY KEY REFERENCES providers(id),
  special_occasions  text,
  dietary_options    text,
  privacy_options    text,
  extras_on_request  text
);

-- ─── Transactional ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS client_requests (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  token            text        NOT NULL UNIQUE,
  name             text,                    -- contact name; also mirrored in prefs_json.contact_name
  email            text        NOT NULL,
  arrival_date     date        NOT NULL,
  departure_date   date        NOT NULL,
  arrival_time     time        NOT NULL,
  departure_time   time        NOT NULL,
  travelers        integer     NOT NULL,
  budget_total     numeric     NOT NULL,
  prefs_json       jsonb       NOT NULL DEFAULT '{}',
  free_text        text        NOT NULL DEFAULT '',
  status           text        NOT NULL DEFAULT 'building',  -- 'building'|'proposals_ready'|'paid'|'expired'
  extraction_json  jsonb       NOT NULL DEFAULT '{}',  -- SBI-06 ExtractionOutput, persisted for reuse at pay time
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- These two tables predate SBI-07; ALTER is needed since CREATE TABLE IF NOT
-- EXISTS above is a no-op on an already-existing table.
ALTER TABLE client_requests ADD COLUMN IF NOT EXISTS extraction_json jsonb NOT NULL DEFAULT '{}';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS provider_instructions_json jsonb NOT NULL DEFAULT '[]';

-- Ephemeral proposal + hold cache (SBI-07). NOT a permanent booking: the 15-min
-- hold only starts on first `getProposals` read (first_viewed_at); rows past
-- expires_at are treated as expired by the app (no cron cleanup needed at this scale).
CREATE TABLE IF NOT EXISTS proposal_cache (
  request_id       uuid        PRIMARY KEY REFERENCES client_requests(id),
  token            text        NOT NULL UNIQUE,
  proposals_json   jsonb       NOT NULL,  -- ItinerarySnapshot[3]
  first_viewed_at  timestamptz,           -- set on first getProposals() call
  expires_at       timestamptz,           -- first_viewed_at + HOLD_WINDOW_MINUTES
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id                  uuid        NOT NULL REFERENCES client_requests(id),
  chosen_itinerary_json       jsonb       NOT NULL,
  client_price                numeric     NOT NULL,
  status                      text        NOT NULL DEFAULT 'paid',  -- 'paid'|'settled'
  provider_instructions_json  jsonb       NOT NULL DEFAULT '[]',  -- OrderProviderInstructions[] (SBI-06)
  created_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
  id         uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   uuid    NOT NULL REFERENCES orders(id),
  item_type  text    NOT NULL,  -- 'experience'|'lodging'
  ref_id     text    NOT NULL,
  day_index  integer NOT NULL,
  net_price  numeric NOT NULL,
  status     text    NOT NULL DEFAULT 'booked'  -- 'booked'|'disrupted'|'replaced'
);

-- Provider portal responses (SBI-11). The provider-facing surface of the
-- simulated availability step: when a provider confirms/declines an incoming
-- availability request, the response is captured here as system data. The
-- deterministic pipeline (SBI-04/07) remains the authority for actual
-- assembly; this table records the human-visible confirm/decline for the demo
-- and gives the portal persistent state + history across reloads.
-- `net_rate` stores the provider NET amount only — never the client price.
CREATE TABLE IF NOT EXISTS provider_responses (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id   uuid        NOT NULL REFERENCES client_requests(id),
  experience_id text       NOT NULL REFERENCES experiences(id),
  provider_id  text        NOT NULL REFERENCES providers(id),
  decision     text        NOT NULL,  -- 'confirmed'|'declined'
  net_rate     numeric     NOT NULL,  -- provider net total for the group; never the client price
  decided_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, experience_id)
);
