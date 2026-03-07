# エリア徹底比較レポーター

2つの住所を入力するだけで、**物件価格・交通・生活利便・子育て・安全性・環境**の6カテゴリを自動比較する Web アプリです。

**[>>> デモを試す <<<](https://hideakiimoto.github.io/hudosanhikaku/)**

> 初回アクセス時、バックエンド(Render Free)のコールドスタートで 30〜60 秒ほどかかる場合があります。

---

## 画面イメージ

| 入力画面 | レポート画面 |
|---------|-----------|
| 2つのエリアを入力して比較開始 | 6カテゴリで多角的に比較 |

**主な機能:**
- 総合スコア（100点満点）+ レーダーチャート
- カテゴリ別の勝者バッジと「3行でわかる比較結果」
- マンション相場・坪単価・賃貸相場のグラフ比較
- 同一市内比較時の地価比率による賃貸推計レンジ表示
- 人口推移の折れ線グラフ（2020〜2050年）
- 災害リスク（洪水・液状化・土砂・火災）の一覧比較
- モバイルレスポンシブ対応

---

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| **フロントエンド** | React 19 + TypeScript + Vite 7 + Tailwind CSS 4 + Chart.js |
| **バックエンド** | Python 3.12 + FastAPI + httpx |
| **ホスティング** | GitHub Pages (フロント) + Render Free (API) |

## データソース

| API | 用途 |
|-----|------|
| [不動産情報ライブラリ API](https://www.reinfolib.mlit.go.jp/) (国土交通省) | 地価公示・取引価格・駅乗降客数・施設数・災害リスク・都市計画・人口推計 (14エンドポイント) |
| [e-Stat API](https://www.e-stat.go.jp/) (総務省統計局) | 住宅・土地統計調査の賃貸相場データ |
| [地理院API](https://msearch.gsi.go.jp/) (国土地理院) | ジオコーディング（住所→緯度経度） |
| Anthropic Claude API *(任意)* | AI による比較考察の自動生成 |

## スコアリング

6カテゴリの加重平均でエリアを評価します：

| カテゴリ | 重み | 評価基準 |
|---------|------|---------|
| お財布 | 25% | 地価公示の平均㎡単価（安いほど高スコア、対数スケール） |
| アクセス | 20% | 駅の乗降客数 + 将来人口維持率 |
| 便利さ | 18% | 病院・スーパー・コンビニ・薬局の件数 |
| 子育て | 15% | 保育園・小学校・図書館・小児科の件数 |
| 安全性 | 12% | 洪水・液状化・土砂災害リスクの低さ |
| 環境 | 10% | 公園数 + 住居系用途地域かどうか |

---

## プロジェクト構成

```
hudosanhikaku/
├── backend/
│   ├── main.py              # FastAPI エントリーポイント
│   ├── config.py            # 環境変数・APIキー管理
│   ├── requirements.txt
│   ├── models/
│   │   ├── request.py       # CompareRequest
│   │   └── response.py      # CompareResponse, AreaResult, RentData 等
│   ├── routers/
│   │   └── compare.py       # POST /api/compare エンドポイント
│   └── services/
│       ├── geocoding.py     # 地理院API（住所→座標）
│       ├── reinfolib.py     # 不動産情報ライブラリAPI（14エンドポイント）
│       ├── scoring.py       # 6カテゴリ加重スコアリング
│       ├── estat.py         # e-Stat API（賃貸相場）
│       └── ai_insight.py    # Claude API（AI考察）
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/      # 12コンポーネント
│   │   ├── hooks/           # useCompare, useCountUp, useScrollReveal
│   │   ├── types/           # TypeScript 型定義
│   │   └── utils/           # フォーマット・色定義
│   ├── vite.config.ts
│   ├── .env.production      # 本番API URL
│   └── package.json
├── render.yaml              # Render Blueprint
├── runtime.txt              # Python バージョン指定
└── .gitignore
```

---

## ローカル開発

### 前提条件

- Python 3.12+
- Node.js 20+
- 不動産情報ライブラリ API キー（[こちら](https://www.reinfolib.mlit.go.jp/ex-api/)で取得）

### セットアップ

```bash
# 1. リポジトリをクローン
git clone https://github.com/hideakiimoto/hudosanhikaku.git
cd hudosanhikaku

# 2. .env ファイルを作成
cat > .env << 'EOF'
REINFOLIB_API_KEY=your_key_here
ESTAT_API_KEY=your_key_here        # 任意（賃貸相場用）
# ANTHROPIC_API_KEY=your_key_here  # 任意（AI考察用）
EOF

# 3. バックエンド起動
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ..
python -m uvicorn backend.main:app --port 8000

# 4. フロントエンド起動（別ターミナル）
cd frontend
npm install
npm run dev
```

http://localhost:5173 でアプリにアクセスできます。

### API エンドポイント

| メソッド | パス | 説明 |
|---------|------|------|
| `POST` | `/api/compare` | エリア比較を実行 |
| `GET` | `/health` | ヘルスチェック |

**リクエスト例:**
```json
{
  "area_a": "東京都渋谷区",
  "area_b": "東京都世田谷区",
  "radius": 500
}
```

---

## デプロイ

### バックエンド → Render

1. [Render](https://render.com) にログイン → 「New +」→「Blueprint」
2. このリポジトリを選択（`render.yaml` を自動検出）
3. 環境変数を設定:
   - `REINFOLIB_API_KEY`
   - `ESTAT_API_KEY`
   - `ANTHROPIC_API_KEY` (任意)
   - `ALLOWED_ORIGINS` = `https://<username>.github.io`

### フロントエンド → GitHub Pages

```bash
# frontend/.env.production にRender URLを設定してから:
cd frontend
npm run deploy
```

---

## 環境変数一覧

| 変数名 | 場所 | 必須 | 説明 |
|--------|------|------|------|
| `REINFOLIB_API_KEY` | バックエンド | Yes | 不動産情報ライブラリ APIキー |
| `ESTAT_API_KEY` | バックエンド | No | e-Stat APIキー（賃貸相場機能） |
| `ANTHROPIC_API_KEY` | バックエンド | No | Claude APIキー（AI考察機能） |
| `ALLOWED_ORIGINS` | バックエンド | No | CORS許可オリジン（カンマ区切り） |
| `VITE_API_URL` | フロントエンド | No | バックエンドURL（本番用） |

---

## ライセンス

MIT

## 免責事項

- このアプリは国土交通省不動産情報ライブラリの API を使用していますが、内容は国土交通省によって保証されたものではありません
- 表示されるデータは参考情報です。実際の物件選びは不動産会社にもご相談ください
