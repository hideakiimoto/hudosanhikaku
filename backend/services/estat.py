"""e-Stat API連携: 賃貸相場データ取得。

住宅・土地統計調査（2018年）の「借家の１畳当たり家賃」テーブルから
都道府県・21大都市レベルの家賃データを取得する。
APIキーがない場合は None を返し、フロントエンドで「準備中」表示とする。

データソース: statsDataId = 0003356439
  - 民営借家（非木造） cat02=132
  - 建築時期=総数 cat01=00
  - 単位: 1畳あたり家賃（円）
"""

import httpx

from backend.config import ESTAT_API_KEY

ESTAT_API_URL = "https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData"
_STATS_DATA_ID = "0003356439"

# エリア名 → e-Stat 地域コードのマッピング
# level=2: 21大都市、level=1: 都道府県
_AREA_CODE_MAP: dict[str, tuple[str, str]] = {
    # 21大都市（"市" を含めて曖昧マッチを防止）
    "札幌市": ("01100", "札幌市"),
    "仙台市": ("04100", "仙台市"),
    "さいたま市": ("11100", "さいたま市"),
    "千葉市": ("12100", "千葉市"),
    "特別区": ("13100", "特別区部"),
    "横浜市": ("14100", "横浜市"),
    "川崎市": ("14130", "川崎市"),
    "相模原市": ("14150", "相模原市"),
    "新潟市": ("15100", "新潟市"),
    "静岡市": ("22100", "静岡市"),
    "浜松市": ("22130", "浜松市"),
    "名古屋市": ("23100", "名古屋市"),
    "京都市": ("26100", "京都市"),
    "大阪市": ("27100", "大阪市"),
    "堺市": ("27140", "堺市"),
    "神戸市": ("28100", "神戸市"),
    "岡山市": ("33100", "岡山市"),
    "広島市": ("34100", "広島市"),
    "北九州市": ("40100", "北九州市"),
    "福岡市": ("40130", "福岡市"),
    "熊本市": ("43100", "熊本市"),
    # 都道府県
    "北海道": ("01000", "北海道"),
    "青森": ("02000", "青森県"),
    "岩手": ("03000", "岩手県"),
    "宮城": ("04000", "宮城県"),
    "秋田": ("05000", "秋田県"),
    "山形": ("06000", "山形県"),
    "福島": ("07000", "福島県"),
    "茨城": ("08000", "茨城県"),
    "栃木": ("09000", "栃木県"),
    "群馬": ("10000", "群馬県"),
    "埼玉": ("11000", "埼玉県"),
    "千葉県": ("12000", "千葉県"),
    "東京": ("13000", "東京都"),
    "神奈川": ("14000", "神奈川県"),
    "新潟県": ("15000", "新潟県"),
    "富山": ("16000", "富山県"),
    "石川": ("17000", "石川県"),
    "福井": ("18000", "福井県"),
    "山梨": ("19000", "山梨県"),
    "長野": ("20000", "長野県"),
    "岐阜": ("21000", "岐阜県"),
    "静岡県": ("22000", "静岡県"),
    "愛知": ("23000", "愛知県"),
    "三重": ("24000", "三重県"),
    "滋賀": ("25000", "滋賀県"),
    "京都府": ("26000", "京都府"),
    "大阪府": ("27000", "大阪府"),
    "兵庫": ("28000", "兵庫県"),
    "奈良": ("29000", "奈良県"),
    "和歌山": ("30000", "和歌山県"),
    "鳥取": ("31000", "鳥取県"),
    "島根": ("32000", "島根県"),
    "岡山県": ("33000", "岡山県"),
    "広島県": ("34000", "広島県"),
    "山口": ("35000", "山口県"),
    "徳島": ("36000", "徳島県"),
    "香川": ("37000", "香川県"),
    "愛媛": ("38000", "愛媛県"),
    "高知": ("39000", "高知県"),
    "福岡県": ("40000", "福岡県"),
    "佐賀": ("41000", "佐賀県"),
    "長崎": ("42000", "長崎県"),
    "熊本県": ("43000", "熊本県"),
    "大分": ("44000", "大分県"),
    "宮崎": ("45000", "宮崎県"),
    "鹿児島": ("46000", "鹿児島県"),
    "沖縄": ("47000", "沖縄県"),
}

# 東京23区の区名リスト
_TOKYO_23_WARDS = (
    "千代田区", "中央区", "港区", "新宿区", "文京区", "台東区",
    "墨田区", "江東区", "品川区", "目黒区", "大田区", "世田谷区",
    "渋谷区", "中野区", "杉並区", "豊島区", "北区", "荒川区",
    "板橋区", "練馬区", "足立区", "葛飾区", "江戸川区",
)


def _resolve_area_code(area_name: str) -> tuple[str, str] | None:
    """エリア名から e-Stat 地域コードを解決する。

    優先順位:
    1. 東京23区 → 特別区部 (13100)
    2. 21大都市名を含む → 大都市コード
    3. 都道府県名を含む → 都道府県コード

    Returns:
        (code, label) or None
    """
    # 東京23区チェック（東京都に属する区名のみ）
    is_tokyo = "東京" in area_name
    if is_tokyo:
        for ward in _TOKYO_23_WARDS:
            if ward in area_name:
                return ("13100", "東京都特別区部")

    # 大都市チェック（優先: 大都市は都道府県より細かいデータ）
    # 都道府県コードは XX000（末尾3桁が000）、大都市はそれ以外
    for key, (code, label) in _AREA_CODE_MAP.items():
        if code.endswith("000"):
            continue  # 都道府県はスキップ（後で）
        if key in area_name:
            return (code, label)

    # 都道府県チェック
    for key, (code, label) in _AREA_CODE_MAP.items():
        if not code.endswith("000"):
            continue  # 大都市はスキップ
        if key in area_name:
            return (code, label)

    return None


async def fetch_rent_data(area_name: str) -> dict | None:
    """エリア名から賃貸相場データを取得。

    Args:
        area_name: エリア名（例: "東京都渋谷区"）

    Returns:
        {"rent_per_month": int, "rent_type": str} or None
    """
    if not ESTAT_API_KEY:
        return None

    resolved = _resolve_area_code(area_name)
    if not resolved:
        return None
    area_code, area_label = resolved

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            params = {
                "appId": ESTAT_API_KEY,
                "statsDataId": _STATS_DATA_ID,
                "metaGetFlg": "N",
                "cntGetFlg": "N",
                "cdCat01": "00",       # 建築時期: 総数
                "cdCat02": "132",      # 民営借家（非木造）
                "cdArea": area_code,
            }
            resp = await client.get(ESTAT_API_URL, params=params)
            resp.raise_for_status()
            data = resp.json()

            values = (
                data.get("GET_STATS_DATA", {})
                .get("STATISTICAL_DATA", {})
                .get("DATA_INF", {})
                .get("VALUE", [])
            )
            if not values:
                return None

            # e-Stat APIは結果が1件の場合dictを返す
            if isinstance(values, dict):
                values = [values]

            # 最初の値が1畳あたり家賃（円）
            raw = values[0].get("$", "0")
            per_tatami = float(raw)
            if per_tatami <= 0:
                return None

            # 1K〜1LDK（約25㎡ ≒ 15畳）の月額に換算し千円単位に丸め
            estimated_monthly = round(per_tatami * 15 / 1000) * 1000

            return {
                "rent_per_month": estimated_monthly,
                "rent_type": f"1K〜1LDK（{area_label}平均）",
                "area_code": area_code,
                "area_label": area_label,
            }

    except Exception:
        return None
