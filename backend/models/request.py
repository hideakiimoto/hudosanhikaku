from pydantic import BaseModel, Field


class CompareRequest(BaseModel):
    area_a: str = Field(..., description="エリアAの住所または地名")
    area_b: str = Field(..., description="エリアBの住所または地名")
    radius: int = Field(default=500, description="比較範囲の半径(m)")
