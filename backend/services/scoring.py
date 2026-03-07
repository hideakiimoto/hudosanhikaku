"""スコアリングロジック。

各カテゴリ100点満点で算出。
総合スコアは重み付き加重平均（LIVABILITY_GUIDE.md 準拠）:
  お財布 25% / アクセス 20% / 便利さ 18% / 子育て 15% / 安全性 12% / 環境 10%

実APIデータの典型範囲:
  地価: 都心3000万円/m2〜郊外5万円/m2
  医療機関: 都心200〜郊外5
  学校数: 都心15〜郊外5
  駅乗降客数: 都心60万〜郊外5千
  公園数: 0〜50
"""

# 重み定義
WEIGHTS = {
    "price": 0.25,
    "population": 0.20,      # アクセス（駅乗降客数ベース）
    "infrastructure": 0.18,  # 便利さ（医療機関等）
    "education": 0.15,       # 子育て（学校・保育園）
    "disaster": 0.12,        # 安全性
    "urban_plan": 0.10,      # 環境（自然公園+住環境）
}


def score_price(avg_price_per_sqm: float) -> float:
    """不動産価格スコア: 安い方が高スコア（手頃さ）。

    0〜5万円/m2 → 100点, 50万円/m2 → 50点, 500万円/m2以上 → 0点
    対数スケールで広い価格帯に対応。
    """
    if avg_price_per_sqm <= 0:
        return 50.0
    import math
    # 対数スケール: log(price) を 10(5万) 〜 15.4(500万) の範囲で正規化
    log_price = math.log(avg_price_per_sqm)
    log_min = math.log(50000)    # 5万円 → 100点
    log_max = math.log(5000000)  # 500万円 → 0点
    ratio = (log_price - log_min) / (log_max - log_min)
    score = max(0.0, min(100.0, (1 - ratio) * 100))
    return round(score, 1)


def score_disaster(risk_count: int) -> float:
    """災害リスクスコア: 危険区域該当数が少ないほど高スコア。

    0区域 → 100点, 4区域以上 → 0点
    """
    score = max(0.0, 100.0 - risk_count * 25.0)
    return round(score, 1)


def score_education(school_count: int) -> float:
    """教育環境スコア: 保育園・学校の数。

    実データ範囲: 0〜30施設程度
    0施設 → 0点, 20施設以上 → 100点
    """
    score = min(100.0, school_count * 5.0)
    return round(score, 1)


def score_infrastructure(medical_count: int) -> float:
    """生活インフラスコア: 医療機関・福祉施設等の数。

    実データ範囲: 0〜200+
    0施設 → 0点, 100施設 → 100点
    """
    score = min(100.0, medical_count * 1.0)
    return round(score, 1)


def score_urban_plan(park_count: int, is_residential: bool) -> float:
    """環境スコア: 公園数 + 住居系かどうか。

    住居系 → +30点ベース, 公園1つにつき+2点（実データでは0〜50）
    """
    base = 40.0
    if is_residential:
        base += 30.0
    else:
        base -= 10.0
    score = min(100.0, max(0.0, base + park_count * 2.0))
    return round(score, 1)


def score_population(passengers: int, future_pop_ratio: float) -> float:
    """アクセス(人口・交通)スコア: 駅乗降客数 + 将来人口維持率。

    実データ範囲: 乗降客数 0〜60万人
    乗降客数: 20万人 → 50点分（対数で）
    将来人口: 維持率1.0 → 50点分
    """
    import math
    if passengers > 0:
        # 対数スケール: log(1000)=6.9 〜 log(600000)=13.3
        log_pass = math.log(max(1000, passengers))
        log_min = math.log(1000)
        log_max = math.log(600000)
        station_score = min(50.0, ((log_pass - log_min) / (log_max - log_min)) * 50.0)
    else:
        station_score = 0.0
    pop_score = min(50.0, future_pop_ratio * 50.0)
    score = min(100.0, station_score + pop_score)
    return round(score, 1)


def total_score(
    price: float,
    disaster: float,
    education: float,
    infrastructure: float,
    urban_plan: float,
    population: float,
) -> float:
    """重み付き総合スコア (100点満点)"""
    weighted = (
        price * WEIGHTS["price"]
        + population * WEIGHTS["population"]
        + infrastructure * WEIGHTS["infrastructure"]
        + education * WEIGHTS["education"]
        + disaster * WEIGHTS["disaster"]
        + urban_plan * WEIGHTS["urban_plan"]
    )
    # 重みの合計で割って100点満点にスケーリング
    return round(weighted / sum(WEIGHTS.values()), 1)


def total_score_excluding_price(
    disaster: float,
    education: float,
    infrastructure: float,
    urban_plan: float,
    population: float,
) -> float:
    """お財布(price)を除外した総合スコア。

    取引データも地価データも取得できなかった場合に使用。
    残り5カテゴリの重みを再正規化して100点満点にする。
    """
    w = {k: v for k, v in WEIGHTS.items() if k != "price"}
    weighted = (
        population * w["population"]
        + infrastructure * w["infrastructure"]
        + education * w["education"]
        + disaster * w["disaster"]
        + urban_plan * w["urban_plan"]
    )
    return round(weighted / sum(w.values()), 1)
