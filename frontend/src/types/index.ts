export interface Scores {
  price: number;
  disaster: number;
  education: number;
  infrastructure: number;
  urban_plan: number;
  population: number;
}

export interface LandPricePoint {
  price: string;
  use: string;
  location: string;
}

export interface LandPriceData {
  avg_price_per_sqm: number;
  point_count: number;
  points: LandPricePoint[];
}

export interface Transaction {
  TradePrice: string;
  PricePerUnit: string;
  Area: string;
  FloorPlan: string;
  BuildingYear: string;
  Type: string;
  Municipality: string;
  District: string;
  Period: string;
}

export interface TransactionData {
  count: number;
  avg_price_per_sqm: number;
  min_price_per_sqm: number;
  max_price_per_sqm: number;
  transactions: Transaction[];
  _note?: string;  // リトライ注記 / 「取引データなし」
}

export interface AreaData {
  land_price: LandPriceData;
  transaction: TransactionData;
}

export interface AreaProfile {
  // スコアリング基礎
  station_passengers: number;
  future_pop_ratio: number;
  school_count: number;
  medical_count: number;
  park_count: number;
  disaster_risk_count: number;
  residential_area: boolean;
  // アクセス詳細
  nearest_station_min: number;
  bus_routes: number;
  rail_lines: number;
  // 便利さ詳細
  supermarket_count: number;
  convenience_count: number;
  pharmacy_count: number;
  // 子育て詳細
  nursery_count: number;
  elementary_count: number;
  library_count: number;
  pediatric_count: number;
  // 安全性詳細
  flood_risk: string;
  liquefaction_risk: string;
  landslide_risk: string;
  fire_risk_rank: number;
  // 環境詳細
  green_ratio: number;
  noise_level: string;
  youto_chiiki: string;
  // 将来性詳細
  pop_2020: number;
  pop_2050: number;
  pop_change_rate: number;
  pop_trend: { year: number; population: number }[];
}

export interface AreaResult {
  name: string;
  lat: number;
  lng: number;
  scores: Scores;
  total_score: number;
  data: AreaData;
  profile: AreaProfile;
}

export interface CategoryWinner {
  category: string;
  winner: string;  // "area_a" | "area_b" | "tie"
  comment: string;
}

export interface RentData {
  rent_per_month: number;
  rent_type: string;
  available: boolean;
  // 推計レンジ（同一市内比較時）
  estimated?: boolean;
  rent_min?: number;
  rent_max?: number;
  base_city_rent?: number;
  base_city_name?: string;
}

export interface CompareResponse {
  area_a: AreaResult;
  area_b: AreaResult;
  winner: string;
  generated_at: string;
  category_winners: CategoryWinner[];
  conclusion: string;
  // Phase 2: 賃貸相場
  rent_a?: RentData | null;
  rent_b?: RentData | null;
  // Phase 2: AI考察
  ai_insight?: string | null;
}

export interface CompareRequest {
  area_a: string;
  area_b: string;
  radius: number;
}
