"""Claude API連携: AI考察生成。

比較データをClaude API（Sonnet）に投げて、
数字の背景・理由を自然言語で生成する。
APIキーがない場合は None を返し、フロントエンドでセクション非表示とする。
"""

import json

import httpx

from backend.config import ANTHROPIC_API_KEY

ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"


async def generate_ai_insight(
    area_a_name: str,
    area_b_name: str,
    comparison_data: dict,
) -> str | None:
    """比較データからAI考察を生成。

    Args:
        area_a_name: エリアA名
        area_b_name: エリアB名
        comparison_data: 比較データ（価格・アクセス・便利さ等）

    Returns:
        AI考察テキスト or None（APIキー未設定 or エラー時）
    """
    if not ANTHROPIC_API_KEY:
        return None

    prompt = f"""以下の2エリアの比較データに基づいて、一般の人にもわかりやすい考察を日本語で3〜5文で書いてください。
数字の差がなぜ生まれているか、その地域の特性から推測して説明してください。
専門用語は使わず、友達に説明するような口調で書いてください。

エリアA: {area_a_name}
エリアB: {area_b_name}
データ: {json.dumps(comparison_data, ensure_ascii=False)}"""

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                ANTHROPIC_API_URL,
                headers={
                    "Content-Type": "application/json",
                    "x-api-key": ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                },
                json={
                    "model": "claude-sonnet-4-20250514",
                    "max_tokens": 1024,
                    "messages": [
                        {
                            "role": "user",
                            "content": prompt,
                        }
                    ],
                },
            )
            resp.raise_for_status()
            data = resp.json()

            # レスポンスからテキストを抽出
            content = data.get("content", [])
            if content and isinstance(content, list):
                return content[0].get("text", "")
            return None

    except Exception:
        return None


def build_comparison_data(area_a: dict, area_b: dict) -> dict:
    """CompareResponseの area_a, area_b からAIプロンプト用のデータを構築。"""
    def _extract(area: dict) -> dict:
        profile = area.get("profile", {})
        data = area.get("data", {})
        land = data.get("land_price", {})
        tx = data.get("transaction", {})

        return {
            "mansion": round(tx.get("avg_price_per_sqm", 0) * 70),  # 70m2換算
            "land_tsubo": round(land.get("avg_price_per_sqm", 0) * 3.306),
            "walk_min": profile.get("nearest_station_min", 0),
            "rail_lines": profile.get("rail_lines", 0),
            "station_passengers": profile.get("station_passengers", 0),
            "hospital": profile.get("medical_count", 0),
            "supermarket": profile.get("supermarket_count", 0),
            "convenience": profile.get("convenience_count", 0),
            "nursery": profile.get("nursery_count", 0),
            "school": profile.get("elementary_count", 0),
            "pediatric": profile.get("pediatric_count", 0),
            "parks": profile.get("park_count", 0),
            "green_rate": profile.get("green_ratio", 0),
            "pop_change_rate": profile.get("pop_change_rate", 0),
        }

    a_data = _extract(area_a)
    b_data = _extract(area_b)

    return {
        "areas": [area_a.get("name", ""), area_b.get("name", "")],
        "price": {"a": {"mansion": a_data["mansion"], "land": a_data["land_tsubo"]},
                  "b": {"mansion": b_data["mansion"], "land": b_data["land_tsubo"]}},
        "access": {"a": {"walk_min": a_data["walk_min"], "lines": a_data["rail_lines"],
                         "passengers": a_data["station_passengers"]},
                   "b": {"walk_min": b_data["walk_min"], "lines": b_data["rail_lines"],
                         "passengers": b_data["station_passengers"]}},
        "convenience": {"a": {"hospital": a_data["hospital"], "super": a_data["supermarket"],
                              "convenience": a_data["convenience"]},
                        "b": {"hospital": b_data["hospital"], "super": b_data["supermarket"],
                              "convenience": b_data["convenience"]}},
        "childcare": {"a": {"nursery": a_data["nursery"], "school": a_data["school"],
                            "pediatric": a_data["pediatric"]},
                      "b": {"nursery": b_data["nursery"], "school": b_data["school"],
                            "pediatric": b_data["pediatric"]}},
        "environment": {"a": {"parks": a_data["parks"], "green_rate": a_data["green_rate"]},
                        "b": {"parks": b_data["parks"], "green_rate": b_data["green_rate"]}},
        "future": {"a": {"growth": f"{a_data['pop_change_rate']:+.1f}%"},
                   "b": {"growth": f"{b_data['pop_change_rate']:+.1f}%"}},
    }
