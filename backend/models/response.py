from __future__ import annotations

from pydantic import BaseModel
from typing import Any


class Scores(BaseModel):
    price: float = 0
    disaster: float = 0
    education: float = 0
    infrastructure: float = 0
    urban_plan: float = 0
    population: float = 0


class CategoryWinner(BaseModel):
    category: str
    winner: str          # "area_a" | "area_b" | "tie"
    comment: str         # ひとことコメント


class AreaResult(BaseModel):
    name: str
    lat: float
    lng: float
    scores: Scores
    total_score: float
    data: dict[str, Any] = {}
    profile: dict[str, Any] = {}  # エリアプロファイル（モック用追加データ）


class RentData(BaseModel):
    rent_per_month: int = 0       # 月額家賃（円）
    rent_type: str = ""           # 間取り種別（例: "1K〜1LDK"）
    available: bool = False       # データ取得できたか
    # 推計レンジ（同一市内比較時）
    estimated: bool = False       # 地価比率で推計したか
    rent_min: int = 0             # レンジ下限（円）
    rent_max: int = 0             # レンジ上限（円）
    base_city_rent: int = 0       # 元の市平均家賃（円）
    base_city_name: str = ""      # 市名（注釈用）


class CompareResponse(BaseModel):
    area_a: AreaResult
    area_b: AreaResult
    winner: str
    generated_at: str
    category_winners: list[CategoryWinner] = []
    conclusion: str = ""
    # Phase 2: 賃貸相場
    rent_a: RentData | None = None
    rent_b: RentData | None = None
    # Phase 2: AI考察
    ai_insight: str | None = None
