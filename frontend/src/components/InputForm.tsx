import { useState, useMemo } from 'react';
import type { CompareRequest } from '../types';

interface Props {
  onSubmit: (req: CompareRequest) => void;
  loading: boolean;
}

/* ---------- 政令指定都市バリデーション ---------- */

/** 政令指定都市名 → 代表的な区名 */
const ORDINANCE_CITIES: Record<string, string> = {
  '大阪市': '北区',
  '横浜市': '西区',
  '名古屋市': '中区',
  '札幌市': '中央区',
  '福岡市': '博多区',
  '神戸市': '中央区',
  '川崎市': '中原区',
  '京都市': '中京区',
  'さいたま市': '大宮区',
  '広島市': '中区',
  '仙台市': '青葉区',
  '千葉市': '中央区',
  '北九州市': '小倉北区',
  '堺市': '堺区',
  '新潟市': '中央区',
  '浜松市': '中央区',
  '熊本市': '中央区',
  '相模原市': '中央区',
  '岡山市': '北区',
  '静岡市': '葵区',
};

/** 入力テキストが政令指定都市名（区なし）ならば警告メッセージを返す */
function checkOrdinanceCity(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  for (const [city, ward] of Object.entries(ORDINANCE_CITIES)) {
    if (trimmed.includes(city) && !trimmed.includes('区')) {
      return `${city}は政令指定都市です。区まで入力するとより正確なデータが取得できます（例：${city}${ward}）`;
    }
  }
  return null;
}

/* ---------- component ---------- */

export default function InputForm({ onSubmit, loading }: Props) {
  const [areaA, setAreaA] = useState('');
  const [areaB, setAreaB] = useState('');
  const [radius, setRadius] = useState(500);

  const warnA = useMemo(() => checkOrdinanceCity(areaA), [areaA]);
  const warnB = useMemo(() => checkOrdinanceCity(areaB), [areaB]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!areaA.trim() || !areaB.trim()) return;
    onSubmit({ area_a: areaA.trim(), area_b: areaB.trim(), radius });
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl shadow-lg p-5 md:p-8">
        <h1 className="text-2xl md:text-3xl font-bold text-center text-gray-800 mb-2">
          エリア徹底比較レポーター
        </h1>
        <p className="text-center text-gray-500 mb-8">
          2つのエリアを入力して、多角的に比較しましょう
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-blue-600 mb-1">
              エリアA
            </label>
            <input
              type="text"
              value={areaA}
              onChange={(e) => setAreaA(e.target.value)}
              placeholder="例: 東京都渋谷区神宮前1丁目"
              className="w-full px-4 py-3 border-2 border-blue-200 rounded-lg focus:border-blue-500 focus:outline-none transition"
              disabled={loading}
            />
            {warnA && (
              <div className="mt-1.5 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 text-sm text-amber-700">
                &#x26a0;&#xfe0f; {warnA}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-orange-600 mb-1">
              エリアB
            </label>
            <input
              type="text"
              value={areaB}
              onChange={(e) => setAreaB(e.target.value)}
              placeholder="例: 東京都目黒区自由が丘1丁目"
              className="w-full px-4 py-3 border-2 border-orange-200 rounded-lg focus:border-orange-500 focus:outline-none transition"
              disabled={loading}
            />
            {warnB && (
              <div className="mt-1.5 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 text-sm text-amber-700">
                &#x26a0;&#xfe0f; {warnB}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-2">
              比較範囲
            </label>
            <div className="flex flex-wrap gap-4">
              {[500, 1000, 2000].map((r) => (
                <label key={r} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="radius"
                    value={r}
                    checked={radius === r}
                    onChange={() => setRadius(r)}
                    className="accent-gray-600"
                    disabled={loading}
                  />
                  <span className="text-sm text-gray-700">
                    半径{r >= 1000 ? `${r / 1000}km` : `${r}m`}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !areaA.trim() || !areaB.trim()}
            className="w-full py-3 min-h-[44px] bg-gradient-to-r from-blue-500 to-orange-500 text-white font-bold rounded-lg hover:opacity-90 disabled:opacity-50 transition cursor-pointer disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                データ取得中...
              </span>
            ) : (
              '比較レポートを生成'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
