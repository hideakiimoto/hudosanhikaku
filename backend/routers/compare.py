import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from backend.config import ANTHROPIC_API_KEY, ESTAT_API_KEY, USE_MOCK
from backend.models.request import CompareRequest
from backend.models.response import AreaResult, CategoryWinner, CompareResponse, RentData, Scores
from backend.services.ai_insight import build_comparison_data, generate_ai_insight
from backend.services.estat import fetch_rent_data
from backend.services.geocoding import geocode
from backend.services.reinfolib import (
    fetch_area_profile,
    fetch_land_price,
    fetch_transaction_price,
    get_mock_profile,
)
from backend.services.scoring import (
    score_disaster,
    score_education,
    score_infrastructure,
    score_population,
    score_price,
    score_urban_plan,
    total_score,
    total_score_excluding_price,
)

router = APIRouter(prefix="/api")


def _extract_avg_price(land_price_data: dict) -> float:
    """地価公示GeoJSONから平均m2単価を計算。

    実APIフィールド: u_current_years_price_ja = "36,800,000(円/㎡)"
    モックフィールド: L01_006 = "409430"
    """
    features = land_price_data.get("features", [])
    if not features:
        return 0
    prices = []
    for f in features:
        props = f.get("properties", {})
        # 実API: u_current_years_price_ja から数値抽出
        raw_real = props.get("u_current_years_price_ja", "")
        if raw_real:
            # "36,800,000(円/㎡)" → 36800000
            num_str = raw_real.split("(")[0].replace(",", "").strip()
            try:
                prices.append(int(num_str))
                continue
            except (ValueError, TypeError):
                pass
        # モック: L01_006
        raw_mock = props.get("L01_006", "0")
        try:
            v = int(raw_mock)
            if v > 0:
                prices.append(v)
        except (ValueError, TypeError):
            continue
    return sum(prices) / len(prices) if prices else 0


def _extract_transaction_summary(tx_data: dict) -> dict:
    """取引価格データからサマリーを抽出。

    実APIではPricePerUnitが空の場合があるため、
    TradePrice / Area からm2単価を算出する。
    """
    transactions = tx_data.get("data", [])
    if not transactions:
        return {"count": 0, "avg_price_per_sqm": 0, "min_price_per_sqm": 0, "max_price_per_sqm": 0, "transactions": []}

    prices = []
    for t in transactions:
        # PricePerUnit があればそれを使う
        ppu = t.get("PricePerUnit", "")
        if ppu and ppu != "0":
            try:
                prices.append(int(ppu))
                continue
            except (ValueError, TypeError):
                pass
        # なければ TradePrice / Area で算出
        try:
            trade = int(t.get("TradePrice", "0"))
            area = int(t.get("Area", "0"))
            if trade > 0 and area > 0:
                prices.append(trade // area)
        except (ValueError, TypeError):
            continue

    avg = sum(prices) / len(prices) if prices else 0
    return {
        "count": len(transactions),
        "avg_price_per_sqm": round(avg),
        "min_price_per_sqm": min(prices) if prices else 0,
        "max_price_per_sqm": max(prices) if prices else 0,
        "transactions": transactions[:10],
    }


async def _build_area_result(address: str) -> AreaResult:
    """1エリア分のデータ取得・スコアリングを行う"""
    geo = await geocode(address)
    lat, lng, name = geo["lat"], geo["lng"], geo["name"]

    # 並列でAPIデータ取得（地価 + 取引価格 + エリアプロファイル）
    land_price_data, tx_data, profile = await asyncio.gather(
        fetch_land_price(lat, lng),
        fetch_transaction_price(lat, lng, name=name),
        fetch_area_profile(lat, lng, name=name),
        return_exceptions=True,
    )

    if isinstance(land_price_data, Exception):
        land_price_data = {"features": []}
    if isinstance(tx_data, Exception):
        tx_data = {"data": []}
    if isinstance(profile, Exception):
        profile = get_mock_profile(lat, lng)  # フォールバック

    avg_land = _extract_avg_price(land_price_data)
    tx_summary = _extract_transaction_summary(tx_data)
    tx_note = tx_data.get("_note", "")  # リトライ注記

    # スコアリング（プロファイルがある場合はそれを使用）
    # 取引データ0件かつ地価公示も0 → お財布スコアは None（除外対象）
    has_price_data = avg_land > 0 or tx_summary["count"] > 0
    price_s = score_price(avg_land) if avg_land > 0 else (50.0 if has_price_data else None)
    disaster_s = score_disaster(profile.get("disaster_risk_count", 2))
    education_s = score_education(profile.get("school_count", 5))
    infra_s = score_infrastructure(profile.get("medical_count", 10))
    urban_s = score_urban_plan(
        profile.get("park_count", 2),
        profile.get("residential_area", True),
    )
    pop_s = score_population(
        profile.get("station_passengers", 20000),
        profile.get("future_pop_ratio", 0.95),
    )

    scores = Scores(
        price=price_s if price_s is not None else 0.0,
        disaster=disaster_s,
        education=education_s,
        infrastructure=infra_s,
        urban_plan=urban_s,
        population=pop_s,
    )
    # お財布データなしの場合は除外して総合スコアを再計算
    if price_s is not None:
        ts = total_score(
            scores.price, scores.disaster, scores.education,
            scores.infrastructure, scores.urban_plan, scores.population,
        )
    else:
        ts = total_score_excluding_price(
            scores.disaster, scores.education,
            scores.infrastructure, scores.urban_plan, scores.population,
        )

    return AreaResult(
        name=name,
        lat=lat,
        lng=lng,
        scores=scores,
        total_score=ts,
        data={
            "land_price": {
                "avg_price_per_sqm": round(avg_land),
                "point_count": len(land_price_data.get("features", [])),
                "points": [
                    {
                        "price": (
                            p.get("u_current_years_price_ja", "").split("(")[0].replace(",", "").strip()
                            or p.get("L01_006", "0")
                        ),
                        "use": p.get("use_category_name_ja", "") or p.get("L01_025", ""),
                        "location": p.get("location", "") or p.get("L01_023", ""),
                    }
                    for f in land_price_data.get("features", [])[:10]
                    for p in [f.get("properties", {})]
                ],
            },
            "transaction": {**tx_summary, "_note": tx_note},
        },
        profile={
            # スコアリング基礎
            "station_passengers": profile.get("station_passengers", 0),
            "future_pop_ratio": profile.get("future_pop_ratio", 0),
            "school_count": profile.get("school_count", 0),
            "medical_count": profile.get("medical_count", 0),
            "park_count": profile.get("park_count", 0),
            "disaster_risk_count": profile.get("disaster_risk_count", 0),
            "residential_area": profile.get("residential_area", True),
            # アクセス詳細
            "nearest_station_min": profile.get("nearest_station_min", 5),
            "bus_routes": profile.get("bus_routes", 3),
            "rail_lines": profile.get("rail_lines", 1),
            # 便利さ詳細
            "supermarket_count": profile.get("supermarket_count", 2),
            "convenience_count": profile.get("convenience_count", 3),
            "pharmacy_count": profile.get("pharmacy_count", 2),
            # 子育て詳細
            "nursery_count": profile.get("nursery_count", 3),
            "elementary_count": profile.get("elementary_count", 2),
            "library_count": profile.get("library_count", 1),
            "pediatric_count": profile.get("pediatric_count", 1),
            # 安全性詳細
            "flood_risk": profile.get("flood_risk", "やや低い"),
            "liquefaction_risk": profile.get("liquefaction_risk", "やや低い"),
            "landslide_risk": profile.get("landslide_risk", "低い"),
            "fire_risk_rank": profile.get("fire_risk_rank", 2),
            # 環境詳細
            "green_ratio": profile.get("green_ratio", 15.0),
            "noise_level": profile.get("noise_level", "普通"),
            "youto_chiiki": profile.get("youto_chiiki", "第一種住居地域"),
            # 将来性詳細
            "pop_2020": profile.get("pop_2020", 100000),
            "pop_2050": profile.get("pop_2050", 90000),
            "pop_change_rate": profile.get("pop_change_rate", -10.0),
            "pop_trend": profile.get("pop_trend", []),
        },
    )


# ---------------------------------------------------------------------------
# カテゴリ別勝敗 & 3行結論の生成
# ---------------------------------------------------------------------------

_CATEGORY_LABELS = {
    "price": "お財布",
    "population": "アクセス",
    "infrastructure": "便利さ",
    "education": "子育て",
    "disaster": "安全性",
    "urban_plan": "環境",
}

_CATEGORY_EMOJI = {
    "price": "\U0001f4b0",
    "population": "\U0001f683",
    "infrastructure": "\U0001f3e5",
    "education": "\U0001f4da",
    "disaster": "\U0001f6e1\ufe0f",
    "urban_plan": "\U0001f333",
}


def _build_category_winners(
    area_a: AreaResult, area_b: AreaResult,
) -> list[CategoryWinner]:
    """各カテゴリの勝者とコメントを生成"""
    winners: list[CategoryWinner] = []
    score_pairs = [
        ("price", area_a.scores.price, area_b.scores.price),
        ("population", area_a.scores.population, area_b.scores.population),
        ("infrastructure", area_a.scores.infrastructure, area_b.scores.infrastructure),
        ("education", area_a.scores.education, area_b.scores.education),
        ("disaster", area_a.scores.disaster, area_b.scores.disaster),
        ("urban_plan", area_a.scores.urban_plan, area_b.scores.urban_plan),
    ]

    comment_templates = {
        "price": "{winner}の方が物件価格がお手頃",
        "population": "{winner}の方が駅アクセスが便利",
        "infrastructure": "{winner}の方が医療・生活施設が充実",
        "education": "{winner}の方が学校・保育園が多い",
        "disaster": "{winner}の方が災害リスクが少なく安心",
        "urban_plan": "{winner}の方が緑が多く住環境が良い",
    }

    # 片方の取引データが0件か判定（お財布カテゴリの比較不能検出用）
    a_tx_count = area_a.data.get("transaction", {}).get("count", 0)
    b_tx_count = area_b.data.get("transaction", {}).get("count", 0)
    a_land_avg = area_a.data.get("land_price", {}).get("avg_price_per_sqm", 0)
    b_land_avg = area_b.data.get("land_price", {}).get("avg_price_per_sqm", 0)
    a_has_price = a_tx_count > 0 or a_land_avg > 0
    b_has_price = b_tx_count > 0 or b_land_avg > 0

    for cat, a_score, b_score in score_pairs:
        emoji = _CATEGORY_EMOJI[cat]
        label = _CATEGORY_LABELS[cat]
        diff = abs(a_score - b_score)

        # お財布カテゴリ: 片方のデータが不足している場合は比較不能
        if cat == "price" and (not a_has_price or not b_has_price):
            w = "tie"
            comment = f"{emoji} 物件価格の比較データが不足しています"
            winners.append(CategoryWinner(category=cat, winner=w, comment=comment))
            continue

        if diff < 3:
            w = "tie"
            comment = f"{emoji} {label}はほぼ同等"
        elif a_score > b_score:
            w = "area_a"
            template = comment_templates[cat]
            comment = f"{emoji} {template.format(winner=area_a.name)}"
            if diff >= 15:
                comment += "（大きな差）"
        else:
            w = "area_b"
            template = comment_templates[cat]
            comment = f"{emoji} {template.format(winner=area_b.name)}"
            if diff >= 15:
                comment += "（大きな差）"

        winners.append(CategoryWinner(category=cat, winner=w, comment=comment))

    return winners


def _build_conclusion(
    area_a: AreaResult,
    area_b: AreaResult,
    winners: list[CategoryWinner],
) -> str:
    """「コスパ重視なら〇〇、利便性なら△△」のような結論文を生成"""
    a_name = area_a.name
    b_name = area_b.name

    # 各エリアの強みカテゴリを集める
    a_strengths: list[str] = []
    b_strengths: list[str] = []
    for w in winners:
        label = _CATEGORY_LABELS[w.category]
        if w.winner == "area_a":
            a_strengths.append(label)
        elif w.winner == "area_b":
            b_strengths.append(label)

    if not a_strengths and not b_strengths:
        return "両エリアは総合的にほぼ同等の住みやすさです"

    parts: list[str] = []
    if a_strengths:
        parts.append(f"{'・'.join(a_strengths[:2])}重視なら{a_name}")
    if b_strengths:
        parts.append(f"{'・'.join(b_strengths[:2])}重視なら{b_name}")

    return "\U0001f449 " + "、".join(parts)


@router.post("/compare", response_model=CompareResponse)
async def compare(req: CompareRequest):
    try:
        area_a, area_b = await asyncio.gather(
            _build_area_result(req.area_a),
            _build_area_result(req.area_b),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"データ取得エラー: {e}")

    winner = "area_a" if area_a.total_score >= area_b.total_score else "area_b"

    category_winners = _build_category_winners(area_a, area_b)
    conclusion = _build_conclusion(area_a, area_b, category_winners)

    # Phase 2: 賃貸相場データ取得（e-Stat APIキーがある場合のみ）
    rent_a = None
    rent_b = None
    if ESTAT_API_KEY:
        try:
            rent_a_raw, rent_b_raw = await asyncio.gather(
                fetch_rent_data(area_a.name),
                fetch_rent_data(area_b.name),
                return_exceptions=True,
            )
            if isinstance(rent_a_raw, dict) and rent_a_raw:
                rent_a = RentData(
                    rent_per_month=rent_a_raw["rent_per_month"],
                    rent_type=rent_a_raw["rent_type"],
                    available=True,
                )
            if isinstance(rent_b_raw, dict) and rent_b_raw:
                rent_b = RentData(
                    rent_per_month=rent_b_raw["rent_per_month"],
                    rent_type=rent_b_raw["rent_type"],
                    available=True,
                )

            # 同一市内比較で賃貸相場が同額の場合、地価比率で推計
            if (
                rent_a and rent_b
                and rent_a.available and rent_b.available
                and rent_a.rent_per_month == rent_b.rent_per_month
                and isinstance(rent_a_raw, dict) and isinstance(rent_b_raw, dict)
                and rent_a_raw.get("area_code") == rent_b_raw.get("area_code")
            ):
                a_tsubo = area_a.data.get("land_price", {}).get("avg_price_per_sqm", 0) * 3.306
                b_tsubo = area_b.data.get("land_price", {}).get("avg_price_per_sqm", 0) * 3.306
                if a_tsubo > 0 and b_tsubo > 0:
                    base_rent = rent_a.rent_per_month
                    mid_tsubo = (a_tsubo + b_tsubo) / 2
                    city_name = rent_a_raw.get("area_label", "")

                    for tsubo, rd in [(a_tsubo, rent_a), (b_tsubo, rent_b)]:
                        ratio = tsubo / mid_tsubo
                        ratio = max(0.5, min(1.5, ratio))  # 上限1.5倍, 下限0.5倍
                        est = round(base_rent * ratio / 1000) * 1000
                        rd.estimated = True
                        rd.rent_per_month = est
                        rd.rent_min = round(est * 0.85 / 1000) * 1000
                        rd.rent_max = round(est * 1.15 / 1000) * 1000
                        rd.base_city_rent = base_rent
                        rd.base_city_name = city_name
                        rd.rent_type = "1K〜1LDK（推計）"

        except Exception:
            pass  # 賃貸相場取得失敗 → None のまま

    # Phase 2: AI考察生成（Anthropic APIキーがある場合のみ）
    ai_insight = None
    if ANTHROPIC_API_KEY:
        try:
            comparison_data = build_comparison_data(
                area_a.model_dump(), area_b.model_dump(),
            )
            ai_insight = await generate_ai_insight(
                area_a.name, area_b.name, comparison_data,
            )
        except Exception:
            pass  # AI考察生成失敗 → None のまま

    return CompareResponse(
        area_a=area_a,
        area_b=area_b,
        winner=winner,
        generated_at=datetime.now(timezone.utc).isoformat(),
        category_winners=category_winners,
        conclusion=conclusion,
        rent_a=rent_a,
        rent_b=rent_b,
        ai_insight=ai_insight,
    )
