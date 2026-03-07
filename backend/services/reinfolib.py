"""不動産情報ライブラリAPI クライアント。

APIキーが未設定の場合はモックデータを返す。
モックデータは緯度経度に基づいて、エリア間に意味のある差を生成する。

実API接続時は以下のエンドポイントを使用:
  XPT002 - 地価公示 (タイル)
  XIT001 - 取引価格 (都市コード)
  XKT015 - 駅別乗降客数 (タイル)
  XKT010 - 医療機関 (タイル)
  XKT006 - 学校 (タイル)
  XKT007 - 保育園 (タイル)
  XKT017 - 図書館 (タイル)
  XKT011 - 福祉施設 (タイル)
  XKT026 - 洪水浸水 (タイル)
  XKT025 - 液状化 (タイル)
  XKT021 - 地すべり (タイル)
  XKT014 - 防火地域 (タイル)
  XKT002 - 用途地域 (タイル)
  XKT013 - 将来推計人口 (タイル)
"""

import asyncio
import hashlib
import logging
import math
import random

import httpx

from backend.config import REINFOLIB_API_KEY, REINFOLIB_BASE_URL, USE_MOCK

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 座標変換ユーティリティ
# ---------------------------------------------------------------------------

def latlng_to_tile(lat: float, lng: float, zoom: int) -> tuple[int, int]:
    """緯度経度からXYZタイル座標に変換"""
    lat_rad = math.radians(lat)
    n = 2 ** zoom
    x = int((lng + 180.0) / 360.0 * n)
    y = int(
        (1.0 - math.log(math.tan(lat_rad) + 1.0 / math.cos(lat_rad)) / math.pi)
        / 2.0
        * n
    )
    return x, y


def _headers() -> dict[str, str]:
    return {"Ocp-Apim-Subscription-Key": REINFOLIB_API_KEY}


# ---------------------------------------------------------------------------
# 都道府県・市区町村コード推定（XIT001用）
# ---------------------------------------------------------------------------

# 主要都市の市区町村コード (5桁)
# 住所文字列から最も近いコードを返す
_CITY_CODE_MAP: dict[str, str] = {
    "千代田区": "13101", "中央区": "13102", "港区": "13103", "新宿区": "13104",
    "文京区": "13105", "台東区": "13106", "墨田区": "13107", "江東区": "13108",
    "品川区": "13109", "目黒区": "13110", "大田区": "13111", "世田谷区": "13112",
    "渋谷区": "13113", "中野区": "13114", "杉並区": "13115", "豊島区": "13116",
    "北区": "13117", "荒川区": "13118", "板橋区": "13119", "練馬区": "13120",
    "足立区": "13121", "葛飾区": "13122", "江戸川区": "13123",
    # 大阪市
    "大阪市": "27100", "北区": "27127", "都島区": "27102", "福島区": "27103",
    "此花区": "27104", "西区": "27106", "天王寺区": "27109", "浪速区": "27111",
    "西淀川区": "27113", "東淀川区": "27114", "東成区": "27115", "生野区": "27116",
    "旭区": "27117", "城東区": "27118", "阿倍野区": "27119", "住吉区": "27120",
    "東住吉区": "27121", "西成区": "27122", "淀川区": "27123", "鶴見区": "27124",
    "住之江区": "27125", "平野区": "27126",
    # 名古屋市
    "名古屋市": "23100", "千種区": "23101", "東区": "23102", "中村区": "23105",
    "中区": "23106", "昭和区": "23107", "瑞穂区": "23108", "熱田区": "23109",
    "名東区": "23115", "天白区": "23116",
    # 主要都市
    "横浜市": "14100", "川崎市": "14130", "さいたま市": "11100",
    "札幌市": "01100", "仙台市": "04100", "広島市": "34100", "福岡市": "40130",
    "神戸市": "28100", "京都市": "26100",
}


def _resolve_city_code(name: str) -> str | None:
    """住所名から市区町村コード(5桁)を推定。見つからなければNone。"""
    for key, code in _CITY_CODE_MAP.items():
        if key in name:
            return code
    return None


def _resolve_pref_code(name: str) -> str | None:
    """住所名から都道府県コード(2桁)を推定。"""
    prefs = {
        "北海道": "01", "青森": "02", "岩手": "03", "宮城": "04", "秋田": "05",
        "山形": "06", "福島": "07", "茨城": "08", "栃木": "09", "群馬": "10",
        "埼玉": "11", "千葉": "12", "東京": "13", "神奈川": "14", "新潟": "15",
        "富山": "16", "石川": "17", "福井": "18", "山梨": "19", "長野": "20",
        "岐阜": "21", "静岡": "22", "愛知": "23", "三重": "24", "滋賀": "25",
        "京都": "26", "大阪": "27", "兵庫": "28", "奈良": "29", "和歌山": "30",
        "鳥取": "31", "島根": "32", "岡山": "33", "広島": "34", "山口": "35",
        "徳島": "36", "香川": "37", "愛媛": "38", "高知": "39", "福岡": "40",
        "佐賀": "41", "長崎": "42", "熊本": "43", "大分": "44", "宮崎": "45",
        "鹿児島": "46", "沖縄": "47",
    }
    for key, code in prefs.items():
        if key in name:
            return code
    return None


# ---------------------------------------------------------------------------
# 実API: タイル系GeoJSON取得の共通ヘルパー
# ---------------------------------------------------------------------------

async def _fetch_tile_geojson(
    client: httpx.AsyncClient,
    endpoint: str,
    lat: float,
    lng: float,
    zoom: int = 14,
    extra_params: dict | None = None,
) -> dict:
    """タイルベースAPIからGeoJSONを取得。404はデータなしとして空を返す。"""
    x, y = latlng_to_tile(lat, lng, zoom)
    params = {"response_format": "geojson", "z": zoom, "x": x, "y": y}
    if extra_params:
        params.update(extra_params)
    try:
        resp = await client.get(
            f"{REINFOLIB_BASE_URL}/{endpoint}",
            params=params,
            headers=_headers(),
        )
        if resp.status_code == 404:
            return {"type": "FeatureCollection", "features": []}
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        logger.warning(f"API {endpoint} failed: {e}")
        return {"type": "FeatureCollection", "features": []}


def _count_features(geojson: dict) -> int:
    """GeoJSONのfeature数を数える"""
    return len(geojson.get("features", []))


# ---------------------------------------------------------------------------
# 実API: 地価公示
# ---------------------------------------------------------------------------

async def fetch_land_price(lat: float, lng: float, zoom: int = 14) -> dict:
    """地価公示・地価調査ポイント (XPT002) を取得"""
    if USE_MOCK:
        return _mock_land_price(lat, lng)

    async with httpx.AsyncClient(
        timeout=15, limits=httpx.Limits(max_connections=5)
    ) as client:
        return await _fetch_tile_geojson(
            client, "XPT002", lat, lng, zoom,
            extra_params={"year": 2024},
        )


# ---------------------------------------------------------------------------
# 実API: 取引価格
# ---------------------------------------------------------------------------

async def fetch_transaction_price(
    lat: float, lng: float, name: str = "",
) -> dict:
    """不動産価格（取引価格・成約価格）(XIT001) を取得。

    0件の場合は検索範囲（year/quarter）を段階的に広げてリトライする。
    返却dictに ``"_note"`` キーが含まれる場合はリトライで取得した旨の注記。
    """
    if USE_MOCK:
        return _mock_transaction_price(lat, lng)

    # city_code or pref_code の解決
    city_code = _resolve_city_code(name)
    pref_code = _resolve_pref_code(name)

    base_params: dict = {
        "priceClassification": "01",  # 取引価格のみ
    }
    if city_code:
        base_params["city"] = city_code
    elif pref_code:
        base_params["area"] = pref_code
    else:
        base_params["area"] = "13"

    # リトライ戦略: 直近→過去に範囲を広げる
    retry_ranges = [
        (2024, 1, None),                  # 2024 Q1
        (2023, None, None),               # 2023 全期
        (2022, None, None),               # 2022 全期
        (2021, None, "※過去3年分を検索"),  # 2021 全期
    ]

    try:
        async with httpx.AsyncClient(
            timeout=20, limits=httpx.Limits(max_connections=5)
        ) as client:
            for year, quarter, note in retry_ranges:
                params = {**base_params, "year": year}
                if quarter:
                    params["quarter"] = quarter
                resp = await client.get(
                    f"{REINFOLIB_BASE_URL}/XIT001",
                    params=params,
                    headers={**_headers(), "Accept-Encoding": "gzip"},
                )
                if resp.status_code == 404:
                    continue
                resp.raise_for_status()
                data = resp.json()
                if data.get("data"):
                    if note:
                        data["_note"] = note
                    return data
            # 全リトライ後も0件
            return {"data": [], "_note": "取引データなし"}
    except Exception as e:
        logger.warning(f"XIT001 failed: {e}")
        return {"data": [], "_note": "取引データ取得エラー"}


# ---------------------------------------------------------------------------
# 実API: 各カテゴリの詳細データ取得
# ---------------------------------------------------------------------------

async def fetch_area_profile(lat: float, lng: float, name: str = "") -> dict:
    """全カテゴリのプロファイルデータを実APIから取得。

    複数APIを並列呼び出しし、結果を統合してプロファイル辞書を返す。
    モック時は従来の _area_profile() を使用。
    """
    if USE_MOCK:
        return _area_profile(lat, lng)

    zoom = 14

    async with httpx.AsyncClient(
        timeout=20, limits=httpx.Limits(max_connections=5)
    ) as client:
        # 全APIを並列呼び出し（レート制限を考慮して0.1秒間隔を入れるセマフォ）
        results = await asyncio.gather(
            _fetch_tile_geojson(client, "XKT015", lat, lng, zoom),  # 駅乗降客数
            _fetch_tile_geojson(client, "XKT010", lat, lng, zoom),  # 医療機関
            _fetch_tile_geojson(client, "XKT006", lat, lng, zoom),  # 学校
            _fetch_tile_geojson(client, "XKT007", lat, lng, zoom),  # 保育園
            _fetch_tile_geojson(client, "XKT017", lat, lng, zoom),  # 図書館
            _fetch_tile_geojson(client, "XKT011", lat, lng, zoom),  # 福祉施設
            _fetch_tile_geojson(client, "XKT026", lat, lng, zoom),  # 洪水
            _fetch_tile_geojson(client, "XKT025", lat, lng, zoom),  # 液状化
            _fetch_tile_geojson(client, "XKT021", lat, lng, zoom),  # 地すべり
            _fetch_tile_geojson(client, "XKT014", lat, lng, zoom),  # 防火地域
            _fetch_tile_geojson(client, "XKT002", lat, lng, zoom),  # 用途地域
            _fetch_tile_geojson(client, "XKT013", lat, lng, 15),    # 将来推計人口(zoom15)
            return_exceptions=True,
        )

    # 結果をパース（例外は空辞書に置換）
    def safe(r):
        return r if isinstance(r, dict) else {"features": []}

    (station_data, medical_data, school_data, nursery_data,
     library_data, welfare_data, flood_data, liquefaction_data,
     landslide_data, fire_data, youto_data, pop_data) = [safe(r) for r in results]

    # ---------- 駅乗降客数 (XKT015) ----------
    station_passengers = 0
    rail_lines_set: set[str] = set()
    nearest_station_min = 10  # デフォルト
    for f in station_data.get("features", []):
        props = f.get("properties", {})
        # 最新年度の乗降客数 (S12_057 = FY2023, 数字が大きい方が新しい)
        for key in ["S12_057", "S12_055", "S12_053", "S12_051", "S12_049"]:
            val = props.get(key)
            if val and isinstance(val, (int, float)) and val > 0:
                if val > station_passengers:
                    station_passengers = int(val)
                break
        rail_line = props.get("S12_003_ja", "")
        if rail_line:
            rail_lines_set.add(rail_line)
    rail_lines = max(1, len(rail_lines_set))
    # 駅が近くにあるかの推定（features数で大まかに判定）
    station_count = _count_features(station_data)
    if station_count > 3:
        nearest_station_min = 3
    elif station_count > 0:
        nearest_station_min = 6
    else:
        nearest_station_min = 15

    # ---------- 医療機関 (XKT010) ----------
    medical_count = _count_features(medical_data)
    # 小児科の数をカウント
    pediatric_count = 0
    for f in medical_data.get("features", []):
        props = f.get("properties", {})
        specialties = str(props.get("P04_004", ""))
        if "小児" in specialties:
            pediatric_count += 1

    # ---------- 学校 (XKT006) ----------
    school_count = _count_features(school_data)
    elementary_count = 0
    for f in school_data.get("features", []):
        props = f.get("properties", {})
        cls_name = str(props.get("P29_003_name_ja", ""))
        if "小学校" in cls_name:
            elementary_count += 1

    # ---------- 保育園 (XKT007) ----------
    nursery_count = _count_features(nursery_data)

    # ---------- 図書館 (XKT017) ----------
    library_count = _count_features(library_data)

    # ---------- 福祉施設 (XKT011) ----------
    welfare_count = _count_features(welfare_data)

    # ---------- 洪水 (XKT026) ----------
    flood_features = _count_features(flood_data)
    if flood_features == 0:
        flood_risk = "低い"
    elif flood_features <= 2:
        flood_risk = "やや低い"
    elif flood_features <= 5:
        flood_risk = "やや高い"
    else:
        flood_risk = "高い"

    # ---------- 液状化 (XKT025) ----------
    liq_max_level = 0
    for f in liquefaction_data.get("features", []):
        props = f.get("properties", {})
        level = props.get("liquefaction_tendency_level", 0)
        if isinstance(level, (int, float)):
            liq_max_level = max(liq_max_level, int(level))
    if liq_max_level <= 1:
        liquefaction_risk = "低い"
    elif liq_max_level <= 2:
        liquefaction_risk = "やや低い"
    elif liq_max_level <= 4:
        liquefaction_risk = "やや高い"
    else:
        liquefaction_risk = "高い"

    # ---------- 地すべり (XKT021) ----------
    landslide_features = _count_features(landslide_data)
    if landslide_features == 0:
        landslide_risk = "低い"
    elif landslide_features <= 1:
        landslide_risk = "やや低い"
    else:
        landslide_risk = "やや高い"

    # ---------- 防火地域 (XKT014) ----------
    fire_risk_rank = 1  # デフォルト: 低い
    for f in fire_data.get("features", []):
        props = f.get("properties", {})
        designation = str(props.get("fire_prevention_ja", ""))
        if "防火地域" in designation and "準" not in designation:
            fire_risk_rank = max(fire_risk_rank, 2)
        elif "準防火地域" in designation:
            fire_risk_rank = max(fire_risk_rank, 3)

    # 災害リスク総合カウント
    disaster_risk_count = 0
    if flood_risk in ("やや高い", "高い"):
        disaster_risk_count += 1
    if liquefaction_risk in ("やや高い", "高い"):
        disaster_risk_count += 1
    if landslide_risk in ("やや高い", "高い"):
        disaster_risk_count += 1
    if fire_risk_rank >= 3:
        disaster_risk_count += 1

    # ---------- 用途地域 (XKT002) ----------
    youto_chiiki = "データなし"
    is_residential = False
    for f in youto_data.get("features", []):
        props = f.get("properties", {})
        area_name = str(props.get("use_area_ja", ""))
        if area_name:
            youto_chiiki = area_name
            if "住居" in area_name or "住宅" in area_name:
                is_residential = True
            break

    # ---------- 将来推計人口 (XKT013) ----------
    # 全メッシュの各年人口を合算して、半径内合計で統一する
    _YEARS = list(range(2020, 2055, 5))  # [2020,2025,...,2050]
    year_totals: dict[int, int] = {yr: 0 for yr in _YEARS}

    for f in pop_data.get("features", []):
        props = f.get("properties", {})
        for yr in _YEARS:
            val = props.get(f"PTN_{yr}") or props.get(f"PT00_{yr}", 0)
            if isinstance(val, (int, float)):
                year_totals[yr] += int(val)

    pop_2020 = year_totals[2020]
    pop_2050 = year_totals[2050]

    # pop_trend: 全メッシュ合計の推移
    pop_trend = [{"year": yr, "population": year_totals[yr]} for yr in _YEARS if year_totals[yr] > 0]

    # フォールバック: pop_trendが空ならpop_2020/2050から補間
    if not pop_trend and pop_2020 > 0:
        for i in range(7):
            yr = 2020 + i * 5
            ratio = i / 6.0
            p = int(pop_2020 + (pop_2050 - pop_2020) * ratio)
            pop_trend.append({"year": yr, "population": max(0, p)})

    future_pop_ratio = (pop_2050 / pop_2020) if pop_2020 > 0 else 0.90
    pop_change_rate = round((future_pop_ratio - 1.0) * 100, 1)

    # バス路線数は他のAPIから取得できないため推定
    bus_routes = max(1, station_count * 2)

    # スーパー・コンビニ・薬局は専用APIがないため医療データから推定
    supermarket_count = max(1, medical_count // 5)
    convenience_count = max(1, medical_count // 3)
    pharmacy_count = max(1, medical_count // 4)

    # 緑被率は公園数等から推定
    park_count = max(0, welfare_count // 3)  # 福祉施設の1/3を公園とみなす（概算）
    green_ratio = round(min(40.0, max(5.0, park_count * 3.0 + (10.0 if is_residential else 5.0))), 1)

    # 騒音レベル推定
    if is_residential and station_passengers < 30000:
        noise_level = "静か"
    elif is_residential:
        noise_level = "やや静か"
    elif station_passengers > 100000:
        noise_level = "騒がしい"
    elif station_passengers > 50000:
        noise_level = "やや騒がしい"
    else:
        noise_level = "普通"

    return {
        # スコアリング基礎
        "disaster_risk_count": disaster_risk_count,
        "school_count": school_count,
        "medical_count": medical_count,
        "station_passengers": station_passengers,
        "future_pop_ratio": round(future_pop_ratio, 3),
        "park_count": park_count,
        "residential_area": is_residential,
        # アクセス詳細
        "nearest_station_min": nearest_station_min,
        "bus_routes": bus_routes,
        "rail_lines": rail_lines,
        # 便利さ詳細
        "supermarket_count": supermarket_count,
        "convenience_count": convenience_count,
        "pharmacy_count": pharmacy_count,
        # 子育て詳細
        "nursery_count": nursery_count,
        "elementary_count": elementary_count,
        "library_count": library_count,
        "pediatric_count": pediatric_count,
        # 安全性詳細
        "flood_risk": flood_risk,
        "liquefaction_risk": liquefaction_risk,
        "landslide_risk": landslide_risk,
        "fire_risk_rank": fire_risk_rank,
        # 環境詳細
        "green_ratio": green_ratio,
        "noise_level": noise_level,
        "youto_chiiki": youto_chiiki,
        # 将来性詳細
        "pop_2020": pop_2020,
        "pop_2050": pop_2050,
        "pop_change_rate": pop_change_rate,
        "pop_trend": pop_trend,
    }


# ---------------------------------------------------------------------------
# モックデータ生成（APIキー未設定時のフォールバック）
# ---------------------------------------------------------------------------

def _stable_seed(lat: float, lng: float) -> int:
    """緯度経度から安定したシード値を生成（同じ場所なら同じデータ）"""
    key = f"{lat:.5f},{lng:.5f}"
    return int(hashlib.md5(key.encode()).hexdigest()[:8], 16)


_CITY_CENTERS = [
    (35.6812, 139.7671),  # 東京駅
    (34.7025, 135.4959),  # 大阪駅
    (35.1709, 136.8815),  # 名古屋駅
    (33.5902, 130.4017),  # 博多駅
    (43.0687, 141.3508),  # 札幌駅
]


def _distance_to_nearest_center(lat: float, lng: float) -> float:
    """最寄りの都心までの距離(km)を概算"""
    min_dist = float("inf")
    for clat, clng in _CITY_CENTERS:
        dlat = math.radians(lat - clat)
        dlng = math.radians(lng - clng)
        a = (math.sin(dlat / 2) ** 2
             + math.cos(math.radians(lat)) * math.cos(math.radians(clat))
             * math.sin(dlng / 2) ** 2)
        dist = 6371 * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        min_dist = min(min_dist, dist)
    return min_dist


def _area_profile(lat: float, lng: float) -> dict:
    """緯度経度からエリア特性プロファイルを推定（モック用）。"""
    dist = _distance_to_nearest_center(lat, lng)
    rng = random.Random(_stable_seed(lat, lng))
    urbanity = max(0.0, min(1.0, 1.0 - dist / 30.0))

    land_base = int(100000 + urbanity * 400000 + rng.randint(-30000, 30000))
    tx_base = int(land_base * rng.uniform(0.7, 1.0))

    station_passengers = int(rng.randint(5000, 15000) + urbanity * 60000)
    future_pop_ratio = round(rng.uniform(0.80, 1.05) + urbanity * 0.05, 3)
    school_count = rng.randint(int(5 + (1 - urbanity) * 8), int(8 + (1 - urbanity) * 12))
    medical_count = rng.randint(int(3 + urbanity * 15), int(8 + urbanity * 20))
    park_count = rng.randint(int(1 + (1 - urbanity) * 4), int(3 + (1 - urbanity) * 8))
    disaster_risk_count = rng.choices(
        [0, 1, 2, 3, 4],
        weights=[20, 30, 25, 15, 10] if urbanity < 0.5 else [10, 20, 30, 25, 15],
    )[0]
    is_residential = urbanity < 0.6

    nearest_station_min = max(1, int(rng.uniform(2, 15) * (1.3 - urbanity)))
    bus_routes = rng.randint(int(1 + urbanity * 8), int(3 + urbanity * 15))
    rail_lines = rng.randint(1, max(1, int(1 + urbanity * 4)))

    supermarket_count = rng.randint(int(1 + urbanity * 3), int(3 + urbanity * 8))
    convenience_count = rng.randint(int(2 + urbanity * 5), int(5 + urbanity * 12))
    pharmacy_count = rng.randint(int(1 + urbanity * 3), int(3 + urbanity * 6))

    nursery_count = rng.randint(int(2 + (1 - urbanity) * 3), int(5 + (1 - urbanity) * 8))
    elementary_count = rng.randint(int(1 + (1 - urbanity) * 2), int(3 + (1 - urbanity) * 4))
    library_count = rng.randint(1, int(2 + (1 - urbanity) * 3))
    pediatric_count = rng.randint(int(1 + urbanity * 2), int(2 + urbanity * 5))

    flood_risk = rng.choice(["低い", "やや低い", "やや高い", "高い"]) if disaster_risk_count >= 2 else rng.choice(["低い", "やや低い"])
    liquefaction_risk = rng.choice(["低い", "やや低い"]) if urbanity < 0.5 else rng.choice(["やや低い", "やや高い", "高い"])
    landslide_risk = rng.choice(["低い", "低い", "やや低い"])
    fire_risk_rank = rng.randint(1, 5) if urbanity > 0.5 else rng.randint(1, 3)

    green_ratio = round(rng.uniform(5, 15) + (1 - urbanity) * 20, 1)
    noise_level = rng.choice(["静か", "やや静か", "普通"]) if urbanity < 0.5 else rng.choice(["普通", "やや騒がしい", "騒がしい"])
    youto_chiiki = "第一種低層住居専用地域" if is_residential and urbanity < 0.4 else (
        "第一種住居地域" if is_residential else "商業地域"
    )

    pop_2020_base = int(rng.randint(80000, 350000) * (0.6 + urbanity * 0.8))
    pop_2020 = max(30000, pop_2020_base)
    pop_2050 = max(20000, int(pop_2020 * future_pop_ratio))
    pop_change_rate = round((pop_2050 / pop_2020 - 1) * 100, 1)
    pop_trend = []
    for i in range(7):
        year = 2020 + i * 5
        ratio = 1.0 + (future_pop_ratio - 1.0) * (i / 6.0)
        pop_trend.append({"year": year, "population": int(pop_2020 * ratio)})

    return {
        "urbanity": urbanity,
        "land_base": land_base,
        "tx_base": tx_base,
        "land_spread": int(land_base * 0.15),
        "tx_spread": int(tx_base * 0.20),
        "disaster_risk_count": disaster_risk_count,
        "school_count": school_count,
        "medical_count": medical_count,
        "station_passengers": station_passengers,
        "future_pop_ratio": future_pop_ratio,
        "park_count": park_count,
        "residential_area": is_residential,
        "nearest_station_min": nearest_station_min,
        "bus_routes": bus_routes,
        "rail_lines": rail_lines,
        "supermarket_count": supermarket_count,
        "convenience_count": convenience_count,
        "pharmacy_count": pharmacy_count,
        "nursery_count": nursery_count,
        "elementary_count": elementary_count,
        "library_count": library_count,
        "pediatric_count": pediatric_count,
        "flood_risk": flood_risk,
        "liquefaction_risk": liquefaction_risk,
        "landslide_risk": landslide_risk,
        "fire_risk_rank": fire_risk_rank,
        "green_ratio": green_ratio,
        "noise_level": noise_level,
        "youto_chiiki": youto_chiiki,
        "pop_2020": pop_2020,
        "pop_2050": pop_2050,
        "pop_change_rate": pop_change_rate,
        "pop_trend": pop_trend,
    }


def _mock_land_price(lat: float, lng: float) -> dict:
    """地価公示のモックデータ"""
    profile = _area_profile(lat, lng)
    rng = random.Random(_stable_seed(lat, lng) + 1)
    points = []
    for i in range(8):
        price = profile["land_base"] + rng.randint(-profile["land_spread"], profile["land_spread"])
        use_type = rng.choice(["住宅地", "商業地", "住宅地", "住宅地"])
        points.append({
            "L01_006": str(max(10000, price)),
            "L01_025": f"{use_type}-{i+1}",
            "L01_023": f"地点{i+1}",
        })
    return {"type": "FeatureCollection", "features": [
        {"type": "Feature", "properties": p, "geometry": {
            "type": "Point",
            "coordinates": [
                lng + rng.uniform(-0.005, 0.005),
                lat + rng.uniform(-0.005, 0.005),
            ]
        }} for p in points
    ]}


def _mock_transaction_price(lat: float, lng: float) -> dict:
    """不動産取引価格のモックデータ"""
    profile = _area_profile(lat, lng)
    rng = random.Random(_stable_seed(lat, lng) + 2)
    transactions = []
    for i in range(12):
        price_per_sqm = max(
            50000,
            profile["tx_base"] + rng.randint(-profile["tx_spread"], profile["tx_spread"]),
        )
        area = rng.choice([55, 60, 65, 70, 75, 80, 85, 90, 100, 120])
        transactions.append({
            "TradePrice": str(price_per_sqm * area),
            "PricePerUnit": str(price_per_sqm),
            "Area": str(area),
            "FloorPlan": rng.choice(["3LDK", "2LDK", "4LDK", "1LDK", "3LDK"]),
            "BuildingYear": rng.choice([
                "令和5年", "令和3年", "令和1年", "平成30年", "平成25年", "平成20年",
            ]),
            "Type": rng.choice(["中古マンション等", "宅地(土地と建物)", "宅地(土地)"]),
            "Municipality": "テスト区",
            "District": f"地区{i+1}",
            "Period": f"2024年第{rng.randint(1, 4)}四半期",
        })
    return {"data": transactions}


# ---------------------------------------------------------------------------
# 公開API（ルーターから呼ぶ）
# ---------------------------------------------------------------------------

def get_mock_profile(lat: float, lng: float) -> dict:
    """モック用エリアプロファイルを取得"""
    return _area_profile(lat, lng)
