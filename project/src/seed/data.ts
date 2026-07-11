// Rumbo · Seed dataset (NET prices only — no markup applied here)
// Anchored to real El Salvador geography. Transfer matrix flagged for human review.

export interface ZoneSeed {
  id: string;
  name: string;
  region: "west" | "central" | "east";
}

export interface TransferSeed {
  from_zone: string;
  to_zone: string;
  minutes: number;
}

export interface ProviderSeed {
  id: string;
  name: string;
  zone_id: string;
  provider_type: "formal" | "informal";
  confirmation_mode: "instant" | "on_request";
  reliability_score: number;
  base_popularity: number;
}

export interface ExperienceSeed {
  id: string;
  provider_id: string;
  name: string;
  category: "nature" | "food" | "culture" | "beach" | "adventure" | "coffee";
  zone_id: string;
  duration_min: number;
  open_days: string;
  open_from: string;
  open_to: string;
  net_price: number;
  capacity_per_slot: number;
  dependency: "sunrise_only" | "tide_dependent" | "weather_sensitive" | null;
}

export interface LodgingSeed {
  id: string;
  name: string;
  zone_id: string;
  tier: "budget" | "comfort" | "premium";
  net_price_per_night: number;
  capacity: number;
}

export interface PersonalizationSeed {
  provider_id: string;
  special_occasions: string;
  dietary_options: string;
  privacy_options: string;
  extras_on_request: string;
}

const ALL_DAYS = "mon,tue,wed,thu,fri,sat,sun";
const NO_MON = "tue,wed,thu,fri,sat,sun";

// ─── Zones (10) ─────────────────────────────────────────────────────
export const zones: ZoneSeed[] = [
  { id: "san_salvador", name: "San Salvador", region: "central" },
  { id: "santa_ana", name: "Santa Ana", region: "west" },
  { id: "ataco", name: "Concepción de Ataco / Ruta de las Flores", region: "west" },
  { id: "la_libertad", name: "La Libertad (El Tunco / El Zonte)", region: "central" },
  { id: "suchitoto", name: "Suchitoto", region: "central" },
  { id: "coatepeque", name: "Lago de Coatepeque", region: "west" },
  { id: "joya_de_ceren", name: "Joya de Cerén / San Juan Opico", region: "central" },
  { id: "tazumal", name: "Chalchuapa (Tazumal)", region: "west" },
  { id: "alegria", name: "Alegría / Tecapa", region: "east" },
  { id: "jiquilisco", name: "Bahía de Jiquilisco", region: "east" },
];

// ─── Transfer matrix ────────────────────────────────────────────────
// FLAG FOR HUMAN GEOGRAPHIC REVIEW: point-to-point average transfer minutes.
// El Salvador is small; San Salvador is central hub. West cluster (santa_ana,
// ataco, coatepeque, tazumal) is mutually close (20-45min) but far from east
// (alegria, jiquilisco: 2.5-4h). La Libertad is close to San Salvador (35-50min)
// but far from the east. Suchitoto and joya_de_ceren sit north/northwest of
// San Salvador, moderate distance from everything.
const rawTransfers: [string, string, number][] = [
  ["san_salvador", "santa_ana", 60],
  ["san_salvador", "ataco", 90],
  ["san_salvador", "la_libertad", 40],
  ["san_salvador", "suchitoto", 55],
  ["san_salvador", "coatepeque", 75],
  ["san_salvador", "joya_de_ceren", 45],
  ["san_salvador", "tazumal", 75],
  ["san_salvador", "alegria", 105],
  ["san_salvador", "jiquilisco", 120],
  ["santa_ana", "ataco", 35],
  ["santa_ana", "la_libertad", 100],
  ["santa_ana", "suchitoto", 110],
  ["santa_ana", "coatepeque", 25],
  ["santa_ana", "joya_de_ceren", 55],
  ["santa_ana", "tazumal", 20],
  ["santa_ana", "alegria", 165],
  ["santa_ana", "jiquilisco", 180],
  ["ataco", "la_libertad", 130],
  ["ataco", "suchitoto", 140],
  ["ataco", "coatepeque", 45],
  ["ataco", "joya_de_ceren", 85],
  ["ataco", "tazumal", 30],
  ["ataco", "alegria", 195],
  ["ataco", "jiquilisco", 210],
  ["la_libertad", "suchitoto", 90],
  ["la_libertad", "coatepeque", 110],
  ["la_libertad", "joya_de_ceren", 75],
  ["la_libertad", "tazumal", 115],
  ["la_libertad", "alegria", 140],
  ["la_libertad", "jiquilisco", 150],
  ["suchitoto", "coatepeque", 120],
  ["suchitoto", "joya_de_ceren", 60],
  ["suchitoto", "tazumal", 130],
  ["suchitoto", "alegria", 130],
  ["suchitoto", "jiquilisco", 150],
  ["coatepeque", "joya_de_ceren", 65],
  ["coatepeque", "tazumal", 30],
  ["coatepeque", "alegria", 180],
  ["coatepeque", "jiquilisco", 195],
  ["joya_de_ceren", "tazumal", 60],
  ["joya_de_ceren", "alegria", 140],
  ["joya_de_ceren", "jiquilisco", 155],
  ["tazumal", "alegria", 190],
  ["tazumal", "jiquilisco", 205],
  ["alegria", "jiquilisco", 60],
];

export const transferMatrix: TransferSeed[] = [];
for (const [a, b, m] of rawTransfers) {
  transferMatrix.push({ from_zone: a, to_zone: b, minutes: m });
  transferMatrix.push({ from_zone: b, to_zone: a, minutes: m });
}
for (const z of zones) {
  transferMatrix.push({ from_zone: z.id, to_zone: z.id, minutes: 0 });
}

// ─── Providers ──────────────────────────────────────────────────────
export const providers: ProviderSeed[] = [
  // Santa Ana / volcano
  { id: "prov_ilamatepec_guides", name: "Ilamatepec Volcano Guides", zone_id: "santa_ana", provider_type: "formal", confirmation_mode: "instant", reliability_score: 0.92, base_popularity: 0.85 },
  { id: "prov_cesar_hiking", name: "César's Highland Hikes", zone_id: "santa_ana", provider_type: "informal", confirmation_mode: "on_request", reliability_score: 0.55, base_popularity: 0.25 },
  { id: "prov_santa_ana_walks", name: "Santa Ana Heritage Walks", zone_id: "santa_ana", provider_type: "formal", confirmation_mode: "instant", reliability_score: 0.8, base_popularity: 0.4 },
  // Coatepeque
  { id: "prov_coatepeque_boats", name: "Coatepeque Lake Boat Tours", zone_id: "coatepeque", provider_type: "formal", confirmation_mode: "instant", reliability_score: 0.88, base_popularity: 0.6 },
  { id: "prov_don_beto_kayak", name: "Don Beto Kayak Rentals", zone_id: "coatepeque", provider_type: "informal", confirmation_mode: "on_request", reliability_score: 0.5, base_popularity: 0.2 },
  // Ataco / Ruta de las Flores
  { id: "prov_ataco_coffee_co", name: "Ataco Coffee Cooperative", zone_id: "ataco", provider_type: "formal", confirmation_mode: "instant", reliability_score: 0.9, base_popularity: 0.75 },
  { id: "prov_flor_finca_tours", name: "Finca La Flor Tours", zone_id: "ataco", provider_type: "informal", confirmation_mode: "on_request", reliability_score: 0.6, base_popularity: 0.3 },
  { id: "prov_ruta_flores_art", name: "Ruta de las Flores Art Walk", zone_id: "ataco", provider_type: "formal", confirmation_mode: "instant", reliability_score: 0.82, base_popularity: 0.45 },
  { id: "prov_juayua_market", name: "Juayúa Market Food Crawl", zone_id: "ataco", provider_type: "informal", confirmation_mode: "on_request", reliability_score: 0.58, base_popularity: 0.28 },
  // La Libertad / surf coast
  { id: "prov_tunco_surf_school", name: "El Tunco Surf School", zone_id: "la_libertad", provider_type: "formal", confirmation_mode: "instant", reliability_score: 0.9, base_popularity: 0.8 },
  { id: "prov_zonte_surf_camp", name: "El Zonte Surf Camp", zone_id: "la_libertad", provider_type: "formal", confirmation_mode: "instant", reliability_score: 0.85, base_popularity: 0.65 },
  { id: "prov_beto_fishing", name: "Beto's Sunset Fishing", zone_id: "la_libertad", provider_type: "informal", confirmation_mode: "on_request", reliability_score: 0.45, base_popularity: 0.15 },
  { id: "prov_costa_seafood", name: "Costa del Bálsamo Seafood Walk", zone_id: "la_libertad", provider_type: "formal", confirmation_mode: "instant", reliability_score: 0.78, base_popularity: 0.5 },
  // Suchitoto
  { id: "prov_suchitoto_heritage", name: "Suchitoto Heritage Tours", zone_id: "suchitoto", provider_type: "formal", confirmation_mode: "instant", reliability_score: 0.88, base_popularity: 0.7 },
  { id: "prov_suchitlan_boats", name: "Lago Suchitlán Boat Co-op", zone_id: "suchitoto", provider_type: "informal", confirmation_mode: "on_request", reliability_score: 0.52, base_popularity: 0.22 },
  { id: "prov_suchitoto_indigo", name: "Suchitoto Indigo Workshop", zone_id: "suchitoto", provider_type: "formal", confirmation_mode: "instant", reliability_score: 0.83, base_popularity: 0.4 },
  // Joya de Ceren
  { id: "prov_joya_ceren_museum", name: "Joya de Cerén Site Guides", zone_id: "joya_de_ceren", provider_type: "formal", confirmation_mode: "instant", reliability_score: 0.9, base_popularity: 0.55 },
  // Tazumal / Chalchuapa
  { id: "prov_tazumal_archaeology", name: "Tazumal Archaeology Tours", zone_id: "tazumal", provider_type: "formal", confirmation_mode: "instant", reliability_score: 0.87, base_popularity: 0.5 },
  { id: "prov_chalchuapa_local", name: "Chalchuapa Local Guides", zone_id: "tazumal", provider_type: "informal", confirmation_mode: "on_request", reliability_score: 0.48, base_popularity: 0.18 },
  // Alegria
  { id: "prov_tecapa_crater", name: "Tecapa Crater Lake Hikes", zone_id: "alegria", provider_type: "formal", confirmation_mode: "instant", reliability_score: 0.84, base_popularity: 0.45 },
  { id: "prov_alegria_flowers", name: "Alegría Flower Farm Visits", zone_id: "alegria", provider_type: "informal", confirmation_mode: "on_request", reliability_score: 0.5, base_popularity: 0.2 },
  // Jiquilisco
  { id: "prov_jiquilisco_mangrove", name: "Bahía Jiquilisco Mangrove Tours", zone_id: "jiquilisco", provider_type: "formal", confirmation_mode: "instant", reliability_score: 0.8, base_popularity: 0.4 },
  { id: "prov_isla_montecristo", name: "Isla Montecristo Boat Guides", zone_id: "jiquilisco", provider_type: "informal", confirmation_mode: "on_request", reliability_score: 0.46, base_popularity: 0.15 },
];

// ─── Experiences ────────────────────────────────────────────────────
export const experiences: ExperienceSeed[] = [
  // Santa Ana
  { id: "exp_ilamatepec_sunrise", provider_id: "prov_ilamatepec_guides", name: "Santa Ana (Ilamatepec) Volcano Sunrise Hike", category: "adventure", zone_id: "santa_ana", duration_min: 300, open_days: ALL_DAYS, open_from: "04:00", open_to: "11:00", net_price: 45, capacity_per_slot: 12, dependency: "sunrise_only" },
  { id: "exp_ilamatepec_day", provider_id: "prov_ilamatepec_guides", name: "Santa Ana Volcano Day Hike", category: "adventure", zone_id: "santa_ana", duration_min: 240, open_days: ALL_DAYS, open_from: "08:00", open_to: "16:00", net_price: 38, capacity_per_slot: 15, dependency: null },
  { id: "exp_cesar_backcountry", provider_id: "prov_cesar_hiking", name: "Off-Trail Highland Trek", category: "adventure", zone_id: "santa_ana", duration_min: 210, open_days: NO_MON, open_from: "07:00", open_to: "14:00", net_price: 28, capacity_per_slot: 6, dependency: "weather_sensitive" },
  { id: "exp_santa_ana_cathedral", provider_id: "prov_santa_ana_walks", name: "Santa Ana Cathedral & Theatre Walk", category: "culture", zone_id: "santa_ana", duration_min: 120, open_days: ALL_DAYS, open_from: "09:00", open_to: "17:00", net_price: 15, capacity_per_slot: 20, dependency: null },
  // Coatepeque
  { id: "exp_coatepeque_boat", provider_id: "prov_coatepeque_boats", name: "Lago de Coatepeque Boat Cruise", category: "nature", zone_id: "coatepeque", duration_min: 90, open_days: ALL_DAYS, open_from: "08:00", open_to: "17:00", net_price: 22, capacity_per_slot: 10, dependency: null },
  { id: "exp_coatepeque_kayak", provider_id: "prov_don_beto_kayak", name: "Sunset Kayak on Coatepeque", category: "nature", zone_id: "coatepeque", duration_min: 90, open_days: ALL_DAYS, open_from: "15:00", open_to: "18:30", net_price: 18, capacity_per_slot: 4, dependency: null },
  // Ataco / Ruta de las Flores
  { id: "exp_ataco_coffee_tour", provider_id: "prov_ataco_coffee_co", name: "Ataco Coffee Farm & Roastery Tour", category: "coffee", zone_id: "ataco", duration_min: 150, open_days: ALL_DAYS, open_from: "08:00", open_to: "16:00", net_price: 25, capacity_per_slot: 14, dependency: null },
  { id: "exp_finca_flor_picking", provider_id: "prov_flor_finca_tours", name: "Finca La Flor Coffee Picking Experience", category: "coffee", zone_id: "ataco", duration_min: 180, open_days: NO_MON, open_from: "07:00", open_to: "12:00", net_price: 20, capacity_per_slot: 8, dependency: null },
  { id: "exp_ataco_art_walk", provider_id: "prov_ruta_flores_art", name: "Ataco Murals & Artisan Walk", category: "culture", zone_id: "ataco", duration_min: 100, open_days: ALL_DAYS, open_from: "09:00", open_to: "18:00", net_price: 12, capacity_per_slot: 18, dependency: null },
  { id: "exp_juayua_food_crawl", provider_id: "prov_juayua_market", name: "Juayúa Weekend Food Market Crawl", category: "food", zone_id: "ataco", duration_min: 150, open_days: "fri,sat,sun", open_from: "11:00", open_to: "20:00", net_price: 24, capacity_per_slot: 10, dependency: null },
  // La Libertad
  { id: "exp_tunco_surf_lesson", provider_id: "prov_tunco_surf_school", name: "El Tunco Beginner Surf Lesson", category: "beach", zone_id: "la_libertad", duration_min: 120, open_days: ALL_DAYS, open_from: "07:00", open_to: "16:00", net_price: 30, capacity_per_slot: 8, dependency: "tide_dependent" },
  { id: "exp_zonte_surf_sunset", provider_id: "prov_zonte_surf_camp", name: "El Zonte Sunset Surf Session", category: "beach", zone_id: "la_libertad", duration_min: 120, open_days: ALL_DAYS, open_from: "14:30", open_to: "18:00", net_price: 32, capacity_per_slot: 6, dependency: "tide_dependent" },
  { id: "exp_beto_fishing_trip", provider_id: "prov_beto_fishing", name: "Traditional Sunset Fishing Trip", category: "beach", zone_id: "la_libertad", duration_min: 180, open_days: ALL_DAYS, open_from: "15:00", open_to: "19:00", net_price: 26, capacity_per_slot: 4, dependency: "tide_dependent" },
  { id: "exp_costa_seafood_walk", provider_id: "prov_costa_seafood", name: "Costa del Bálsamo Seafood Tasting Walk", category: "food", zone_id: "la_libertad", duration_min: 120, open_days: ALL_DAYS, open_from: "12:00", open_to: "20:00", net_price: 28, capacity_per_slot: 12, dependency: null },
  // Suchitoto
  { id: "exp_suchitoto_colonial", provider_id: "prov_suchitoto_heritage", name: "Suchitoto Colonial Town Walking Tour", category: "culture", zone_id: "suchitoto", duration_min: 150, open_days: ALL_DAYS, open_from: "09:00", open_to: "17:00", net_price: 18, capacity_per_slot: 16, dependency: null },
  { id: "exp_suchitlan_lake_boat", provider_id: "prov_suchitlan_boats", name: "Lago Suchitlán Birdwatching Boat Ride", category: "nature", zone_id: "suchitoto", duration_min: 100, open_days: ALL_DAYS, open_from: "06:30", open_to: "10:30", net_price: 20, capacity_per_slot: 8, dependency: "sunrise_only" },
  { id: "exp_suchitoto_indigo_workshop", provider_id: "prov_suchitoto_indigo", name: "Suchitoto Natural Indigo Dyeing Workshop", category: "culture", zone_id: "suchitoto", duration_min: 150, open_days: NO_MON, open_from: "09:00", open_to: "15:00", net_price: 32, capacity_per_slot: 10, dependency: null },
  // Joya de Ceren
  { id: "exp_joya_ceren_unesco", provider_id: "prov_joya_ceren_museum", name: "Joya de Cerén UNESCO Site Tour", category: "culture", zone_id: "joya_de_ceren", duration_min: 120, open_days: "tue,wed,thu,fri,sat,sun", open_from: "09:00", open_to: "16:00", net_price: 16, capacity_per_slot: 20, dependency: null },
  // Tazumal
  { id: "exp_tazumal_ruins", provider_id: "prov_tazumal_archaeology", name: "Tazumal Archaeological Site Tour", category: "culture", zone_id: "tazumal", duration_min: 100, open_days: ALL_DAYS, open_from: "09:00", open_to: "16:00", net_price: 15, capacity_per_slot: 20, dependency: null },
  { id: "exp_chalchuapa_casa_blanca", provider_id: "prov_chalchuapa_local", name: "Casa Blanca & Local Cacao Workshop", category: "culture", zone_id: "tazumal", duration_min: 120, open_days: NO_MON, open_from: "09:00", open_to: "14:00", net_price: 18, capacity_per_slot: 8, dependency: null },
  // Alegria
  { id: "exp_tecapa_crater_hike", provider_id: "prov_tecapa_crater", name: "Laguna de Alegría Crater Lake Hike", category: "nature", zone_id: "alegria", duration_min: 180, open_days: ALL_DAYS, open_from: "07:00", open_to: "14:00", net_price: 22, capacity_per_slot: 12, dependency: null },
  { id: "exp_alegria_flower_farms", provider_id: "prov_alegria_flowers", name: "Alegría Hillside Flower Farm Visit", category: "nature", zone_id: "alegria", duration_min: 90, open_days: ALL_DAYS, open_from: "09:00", open_to: "16:00", net_price: 14, capacity_per_slot: 10, dependency: null },
  // Jiquilisco
  { id: "exp_jiquilisco_mangrove_tour", provider_id: "prov_jiquilisco_mangrove", name: "Jiquilisco Bay Mangrove Kayak Tour", category: "nature", zone_id: "jiquilisco", duration_min: 150, open_days: ALL_DAYS, open_from: "06:00", open_to: "11:00", net_price: 26, capacity_per_slot: 10, dependency: "tide_dependent" },
  { id: "exp_montecristo_turtles", provider_id: "prov_isla_montecristo", name: "Isla Montecristo Turtle Release (Seasonal)", category: "nature", zone_id: "jiquilisco", duration_min: 120, open_days: ALL_DAYS, open_from: "17:30", open_to: "20:00", net_price: 20, capacity_per_slot: 8, dependency: "tide_dependent" },
];

// ─── Lodging ────────────────────────────────────────────────────────
export const lodging: LodgingSeed[] = [
  // San Salvador (arrival/departure hub)
  { id: "lodge_ss_budget", name: "Hostal Centro Histórico", zone_id: "san_salvador", tier: "budget", net_price_per_night: 22, capacity: 4 },
  { id: "lodge_ss_comfort", name: "Hotel Boulevard San Salvador", zone_id: "san_salvador", tier: "comfort", net_price_per_night: 55, capacity: 3 },
  { id: "lodge_ss_premium", name: "Real Escalón Suites", zone_id: "san_salvador", tier: "premium", net_price_per_night: 120, capacity: 2 },
  // Santa Ana
  { id: "lodge_sa_budget", name: "Casa Verde Hostel Santa Ana", zone_id: "santa_ana", tier: "budget", net_price_per_night: 18, capacity: 4 },
  { id: "lodge_sa_comfort", name: "Hotel Casa Blanca Santa Ana", zone_id: "santa_ana", tier: "comfort", net_price_per_night: 48, capacity: 3 },
  { id: "lodge_sa_premium", name: "Sheraton Presidente Santa Ana", zone_id: "santa_ana", tier: "premium", net_price_per_night: 105, capacity: 2 },
  // Ataco
  { id: "lodge_ataco_budget", name: "Hostal Flor de Ataco", zone_id: "ataco", tier: "budget", net_price_per_night: 20, capacity: 3 },
  { id: "lodge_ataco_comfort", name: "El Carmen Estate Ataco", zone_id: "ataco", tier: "comfort", net_price_per_night: 60, capacity: 2 },
  { id: "lodge_ataco_premium", name: "Los Andes Boutique Lodge", zone_id: "ataco", tier: "premium", net_price_per_night: 140, capacity: 2 },
  // La Libertad
  { id: "lodge_ll_budget", name: "Tunco Surf Hostel", zone_id: "la_libertad", tier: "budget", net_price_per_night: 16, capacity: 4 },
  { id: "lodge_ll_comfort", name: "Casa de Mar El Zonte", zone_id: "la_libertad", tier: "comfort", net_price_per_night: 65, capacity: 2 },
  { id: "lodge_ll_premium", name: "Bolet Beach Resort", zone_id: "la_libertad", tier: "premium", net_price_per_night: 160, capacity: 2 },
  // Suchitoto
  { id: "lodge_such_budget", name: "Posada Suchitlán", zone_id: "suchitoto", tier: "budget", net_price_per_night: 20, capacity: 3 },
  { id: "lodge_such_comfort", name: "Los Almendros de San Lorenzo", zone_id: "suchitoto", tier: "comfort", net_price_per_night: 70, capacity: 2 },
  { id: "lodge_such_premium", name: "Vista Lago Suchitoto Villa", zone_id: "suchitoto", tier: "premium", net_price_per_night: 150, capacity: 4 },
  // Coatepeque
  { id: "lodge_coat_comfort", name: "Torres del Lago Coatepeque", zone_id: "coatepeque", tier: "comfort", net_price_per_night: 58, capacity: 3 },
  { id: "lodge_coat_premium", name: "Amacuilco Lakeside Suites", zone_id: "coatepeque", tier: "premium", net_price_per_night: 130, capacity: 2 },
  // Alegria
  { id: "lodge_aleg_budget", name: "Casa de Huéspedes Alegría", zone_id: "alegria", tier: "budget", net_price_per_night: 15, capacity: 3 },
  { id: "lodge_aleg_comfort", name: "Villa Tecapa Alegría", zone_id: "alegria", tier: "comfort", net_price_per_night: 45, capacity: 2 },
  // Jiquilisco
  { id: "lodge_jiq_budget", name: "Ecoposada Manglar Jiquilisco", zone_id: "jiquilisco", tier: "budget", net_price_per_night: 18, capacity: 3 },
  { id: "lodge_jiq_comfort", name: "Bahía Azul Lodge Jiquilisco", zone_id: "jiquilisco", tier: "comfort", net_price_per_night: 50, capacity: 2 },
];

// ─── Provider personalization answers ───────────────────────────────
export const personalization: PersonalizationSeed[] = [
  { provider_id: "prov_ilamatepec_guides", special_occasions: "Can arrange a summit photo moment for anniversaries with advance notice.", dietary_options: "Provides trail snacks; can flag nut-free options if requested.", privacy_options: "Private group hikes available for 4+ people at a premium.", extras_on_request: "Professional summit photos available for an extra fee." },
  { provider_id: "prov_cesar_hiking", special_occasions: "No formal package, but César is happy to plan a quieter route for special days.", dietary_options: "Brings water only; travelers should bring their own snacks.", privacy_options: "All tours are already small (max 6), effectively private.", extras_on_request: "Can extend the hike to nearby viewpoints if energy allows." },
  { provider_id: "prov_santa_ana_walks", special_occasions: "Can time the walk to end at the cathedral during golden hour for photos.", dietary_options: "No food included; several cafes along the route accommodate most diets.", privacy_options: "Private walks available on request.", extras_on_request: "Local historian add-on available for deeper context." },
  { provider_id: "prov_coatepeque_boats", special_occasions: "Decorates the boat for anniversaries or proposals with 48h notice.", dietary_options: "Can pack a light snack box; vegetarian option available.", privacy_options: "Private boat charters available at a supplement.", extras_on_request: "Sunset departure slots can be requested." },
  { provider_id: "prov_don_beto_kayak", special_occasions: "Keeps it simple — no special packages, but flexible on timing.", dietary_options: "No food provided.", privacy_options: "Small groups only, naturally private.", extras_on_request: "Can guide to a quieter cove on request." },
  { provider_id: "prov_ataco_coffee_co", special_occasions: "Offers a private tasting room setup for celebrations.", dietary_options: "Vegan and gluten-free snacks available on request.", privacy_options: "Private tours available for an extra fee.", extras_on_request: "Take-home coffee bag included on request." },
  { provider_id: "prov_flor_finca_tours", special_occasions: "Family-run; happy to make small gestures for birthdays if mentioned ahead.", dietary_options: "Farm breakfast can be adjusted for vegetarian diets.", privacy_options: "Tours are small-group by nature.", extras_on_request: "Can add a picking basket to take home." },
  { provider_id: "prov_ruta_flores_art", special_occasions: "Can include a stop at a mural commissioned for couples.", dietary_options: "No food included; recommends nearby accommodating restaurants.", privacy_options: "Private walk available on request.", extras_on_request: "Artist meet-and-greet possible if in town." },
  { provider_id: "prov_juayua_market", special_occasions: "No formal package, but happy to guide toward romantic food stalls.", dietary_options: "Vegetarian stalls available; can point out gluten-free stands.", privacy_options: "Groups stay small and informal.", extras_on_request: "Can recommend off-menu local specialties." },
  { provider_id: "prov_tunco_surf_school", special_occasions: "Offers a 'first wave' certificate for milestone lessons.", dietary_options: "No food included; water and snacks available for purchase.", privacy_options: "Private 1-on-1 lessons available at a supplement.", extras_on_request: "Video recording of the lesson available on request." },
  { provider_id: "prov_zonte_surf_camp", special_occasions: "Can arrange a sunset toast on the beach after the session.", dietary_options: "Post-surf snacks include vegetarian options.", privacy_options: "Small group sessions capped at 6.", extras_on_request: "GoPro footage package available." },
  { provider_id: "prov_beto_fishing", special_occasions: "Informal but can prepare the catch as a beachside meal for celebrations.", dietary_options: "Fresh catch only; not suited to vegetarian diets.", privacy_options: "Always a private, small-boat experience.", extras_on_request: "Can cook the catch on the beach for an extra fee." },
  { provider_id: "prov_costa_seafood", special_occasions: "Can arrange a reserved table with ocean view for celebrations.", dietary_options: "Vegetarian and shellfish-free tasting options available.", privacy_options: "Private tasting groups available on request.", extras_on_request: "Local rum pairing add-on available." },
  { provider_id: "prov_suchitoto_heritage", special_occasions: "Can end the tour at a scenic overlook for proposals or anniversaries.", dietary_options: "No food included; can recommend accommodating local restaurants.", privacy_options: "Private guided tours available.", extras_on_request: "Add-on visit to a local artisan workshop." },
  { provider_id: "prov_suchitlan_boats", special_occasions: "Simple co-op operation; can time trips for sunrise proposals.", dietary_options: "No food provided.", privacy_options: "Small boats, naturally private.", extras_on_request: "Extended birdwatching route available." },
  { provider_id: "prov_suchitoto_indigo", special_occasions: "Couples can dye a matching set of textiles as keepsakes.", dietary_options: "Coffee and snacks provided; vegetarian by default.", privacy_options: "Private workshop sessions available.", extras_on_request: "Take-home dyed textile included." },
  { provider_id: "prov_joya_ceren_museum", special_occasions: "No special packages; strictly a heritage-site tour.", dietary_options: "No food on-site.", privacy_options: "Private guided tours available on request.", extras_on_request: "Extended museum-hall tour available." },
  { provider_id: "prov_tazumal_archaeology", special_occasions: "Can arrange a quiet early slot for a more intimate visit.", dietary_options: "No food on-site.", privacy_options: "Private guided tours available.", extras_on_request: "Combined visit with nearby Casa Blanca site possible." },
  { provider_id: "prov_chalchuapa_local", special_occasions: "Informal guide, happy to personalize the walk for special days.", dietary_options: "Cacao tasting can be adjusted for allergies.", privacy_options: "Always small-group.", extras_on_request: "Can add a stop at a local artisan's home." },
  { provider_id: "prov_tecapa_crater", special_occasions: "Can plan the hike to summit at a quiet hour for celebrations.", dietary_options: "Brings water; snacks are traveler-provided.", privacy_options: "Private hikes available for small groups.", extras_on_request: "Extended loop trail available for stronger hikers." },
  { provider_id: "prov_alegria_flowers", special_occasions: "Farm can prepare a small flower bouquet for special occasions.", dietary_options: "No food provided.", privacy_options: "Naturally small and private.", extras_on_request: "Flower-picking add-on available." },
  { provider_id: "prov_jiquilisco_mangrove", special_occasions: "Can arrange a quiet early paddle for a peaceful celebration.", dietary_options: "No food included; can recommend nearby accommodating spots.", privacy_options: "Private kayak groups available.", extras_on_request: "Extended route into deeper mangrove channels available." },
  { provider_id: "prov_isla_montecristo", special_occasions: "Seasonal turtle release can be timed for a memorable evening.", dietary_options: "No food provided.", privacy_options: "Small boat groups, naturally private.", extras_on_request: "Extended night tour available in high season." },
];
