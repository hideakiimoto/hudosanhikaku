import httpx

from backend.config import GSI_GEOCODING_URL


async def geocode(address: str) -> dict:
    """国土地理院APIで住所を緯度経度に変換する。

    Returns:
        {"lat": float, "lng": float, "name": str}
    """
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(GSI_GEOCODING_URL, params={"q": address})
        resp.raise_for_status()
        results = resp.json()

    if not results:
        raise ValueError(f"住所が見つかりません: {address}")

    # 最初の候補を使用。coordinates は [lng, lat] の順
    top = results[0]
    coords = top["geometry"]["coordinates"]
    name = top["properties"].get("title", address)

    return {
        "lat": coords[1],
        "lng": coords[0],
        "name": name,
    }
