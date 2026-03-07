import os
from pathlib import Path

from dotenv import load_dotenv

# プロジェクトルートの .env を読み込む
_project_root = Path(__file__).resolve().parent.parent
load_dotenv(_project_root / ".env")

REINFOLIB_API_KEY = os.environ.get("REINFOLIB_API_KEY", "")
REINFOLIB_BASE_URL = "https://www.reinfolib.mlit.go.jp/ex-api/external"
GSI_GEOCODING_URL = "https://msearch.gsi.go.jp/address-search/AddressSearch"

# e-Stat API（賃貸相場用）
ESTAT_API_KEY = os.environ.get("ESTAT_API_KEY", "")

# Anthropic Claude API（AI考察用）
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

# モックモード: APIキーが未設定の場合は自動的にモックデータを返す
USE_MOCK = not REINFOLIB_API_KEY
