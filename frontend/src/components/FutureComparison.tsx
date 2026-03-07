import { useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import type { AreaResult, CategoryWinner } from '../types';
import { AREA_A, AREA_B } from '../utils/colors';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

interface Props {
  areaA: AreaResult;
  areaB: AreaResult;
  categoryWinner?: CategoryWinner;
}

/* ---------- helpers ---------- */

/** 人口を読みやすい文字列に: 10000人以上→「約X.X万人」, 未満→「X,XXX人」 */
const formatPop = (pop: number) => {
  if (pop >= 10000) return `約${(pop / 10000).toFixed(1)}万人`;
  return `${pop.toLocaleString()}人`;
};

/** 2020年を100%として各年の変化率(%)を返す */
const toChangeRate = (trend: { year: number; population: number }[]) => {
  const base = trend[0]?.population || 1;
  return trend.map((t) => Math.round(((t.population / base) * 100 - 100) * 10) / 10);
};

/* ---------- component ---------- */

export default function FutureComparison({ areaA, areaB, categoryWinner }: Props) {
  const [showDetail, setShowDetail] = useState(false);

  const aP = areaA.profile;
  const bP = areaB.profile;

  // ひとことコメント
  const aBetter = aP.pop_change_rate > bP.pop_change_rate;
  const betterName = aBetter ? areaA.name : areaB.name;
  const betterColor = aBetter ? 'text-blue-600' : 'text-orange-600';
  const diff = Math.abs(aP.pop_change_rate - bP.pop_change_rate);
  const isTie = diff < 3;

  const winnerBadge = categoryWinner && categoryWinner.winner !== 'tie'
    ? (categoryWinner.winner === 'area_a' ? areaA.name : areaB.name)
    : null;

  // ---------- 折れ線グラフ: 2020年 = 0% 基準の増減率 ----------
  const aRates = toChangeRate(aP.pop_trend);
  const bRates = toChangeRate(bP.pop_trend);
  const years = aP.pop_trend.map((t) => `${t.year}年`);

  const lineData = {
    labels: years,
    datasets: [
      {
        label: areaA.name,
        data: aRates,
        borderColor: AREA_A.primary,
        backgroundColor: AREA_A.primary + '33',
        fill: false,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
      {
        label: areaB.name,
        data: bRates,
        borderColor: AREA_B.primary,
        backgroundColor: AREA_B.primary + '33',
        fill: false,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  };

  // 全レートの範囲を元に y 軸をいい感じに設定
  const allRates = [...aRates, ...bRates];
  const minRate = Math.min(...allRates);
  const maxRate = Math.max(...allRates);
  const yPad = Math.max(2, (maxRate - minRate) * 0.3);

  const lineOptions = {
    responsive: true,
    animation: { duration: 1200, easing: 'easeOutQuart' as const },
    plugins: {
      legend: { position: 'top' as const },
      tooltip: {
        callbacks: {
          label: (ctx: { dataset: { label?: string }; raw: unknown; dataIndex: number }) => {
            const lbl = ctx.dataset.label || '';
            const rate = Number(ctx.raw);
            // ツールチップには増減率＋実数を表示
            const idx = ctx.dataIndex;
            const isA = ctx.dataset.label === areaA.name;
            const pop = isA
              ? aP.pop_trend[idx]?.population ?? 0
              : bP.pop_trend[idx]?.population ?? 0;
            return `${lbl}: ${rate >= 0 ? '+' : ''}${rate}%（${formatPop(pop)}）`;
          },
        },
      },
    },
    scales: {
      y: {
        min: Math.floor(minRate - yPad),
        max: Math.ceil(maxRate + yPad),
        ticks: {
          callback: (value: number | string) => `${Number(value) >= 0 ? '+' : ''}${Number(value)}%`,
        },
        title: {
          display: true,
          text: '2020年比 増減率（%）',
          font: { size: 12 },
        },
      },
    },
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-4 md:p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg md:text-xl font-bold text-gray-800 flex items-center gap-2">
          &#x1f4c8; 街の将来性は？
          {winnerBadge && (
            <span className="text-sm bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
              &#x1f3c6; {winnerBadge}
            </span>
          )}
        </h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        人口の増減傾向から街の将来を予測（半径内メッシュ合計）
      </p>

      {/* ひとことコメント */}
      <div className="bg-gradient-to-r from-blue-50 to-orange-50 rounded-xl p-3 mb-5">
        <p className="font-semibold text-gray-800 text-center">
          {isTie ? (
            '人口トレンドはほぼ同等'
          ) : (
            <><span className={betterColor}>{betterName}</span>の方が人口維持率が高く、将来性あり</>
          )}
        </p>
      </div>

      {/* メイン: 2020年→2050年 カード */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-blue-50 rounded-xl p-4">
          <p className="text-xs text-blue-500 font-semibold mb-1">{areaA.name}</p>
          <p className="text-sm text-gray-600">現在の推計人口（2020年）</p>
          <p className="text-2xl font-bold text-blue-600">{formatPop(aP.pop_2020)}</p>
          <p className="text-sm text-gray-600 mt-2">将来の推計人口（2050年）</p>
          <p className="text-lg font-bold text-blue-600">{formatPop(aP.pop_2050)}</p>
          <p className="text-sm text-gray-600 mt-2">増減率</p>
          <p className={`text-lg font-bold ${aP.pop_change_rate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {aP.pop_change_rate >= 0 ? '📈' : '📉'} {aP.pop_change_rate >= 0 ? '+' : ''}{aP.pop_change_rate}%
          </p>
        </div>
        <div className="bg-orange-50 rounded-xl p-4">
          <p className="text-xs text-orange-500 font-semibold mb-1">{areaB.name}</p>
          <p className="text-sm text-gray-600">現在の推計人口（2020年）</p>
          <p className="text-2xl font-bold text-orange-600">{formatPop(bP.pop_2020)}</p>
          <p className="text-sm text-gray-600 mt-2">将来の推計人口（2050年）</p>
          <p className="text-lg font-bold text-orange-600">{formatPop(bP.pop_2050)}</p>
          <p className="text-sm text-gray-600 mt-2">増減率</p>
          <p className={`text-lg font-bold ${bP.pop_change_rate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {bP.pop_change_rate >= 0 ? '📈' : '📉'} {bP.pop_change_rate >= 0 ? '+' : ''}{bP.pop_change_rate}%
          </p>
        </div>
      </div>

      {/* 折れ線グラフ: 増減率（%）2020年=0%基準 */}
      <div className="mb-4">
        <Line data={lineData} options={lineOptions} />
      </div>

      {/* 詳しく見る（5年ごとの推計人口推移 — 実数） */}
      <div className="border-t border-gray-100 pt-3">
        <button
          onClick={() => setShowDetail(!showDetail)}
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 cursor-pointer"
        >
          <span className={`transition-transform ${showDetail ? 'rotate-90' : ''}`}>&#x25b6;</span>
          詳しく見る（専門データ）
        </button>
        {showDetail && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-2 px-2">年</th>
                  <th className="py-2 px-2 text-blue-600">{areaA.name}（人）</th>
                  <th className="py-2 px-2 text-orange-600">{areaB.name}（人）</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {aP.pop_trend.map((t, i) => (
                  <tr key={t.year}>
                    <td className="py-2 px-2 text-gray-600">{t.year}年</td>
                    <td className="py-2 px-2 text-center font-mono">{t.population.toLocaleString()}</td>
                    <td className="py-2 px-2 text-center font-mono">{(bP.pop_trend[i]?.population ?? 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
