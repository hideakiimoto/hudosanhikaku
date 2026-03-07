import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routers.compare import router as compare_router

app = FastAPI(title="エリア徹底比較レポーター API")

# CORS: 環境変数 ALLOWED_ORIGINS にカンマ区切りで指定 (未設定時はローカルdev)
_default_origins = "http://localhost:5173"
_origins = os.environ.get("ALLOWED_ORIGINS", _default_origins)
allow_origins = [o.strip() for o in _origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(compare_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
