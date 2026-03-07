import { useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import type { AreaResult, CategoryWinner } from '../types';
import { AREA_A, AREA_B } from '../utils/colors';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

interface Props {
  areaA: AreaResult;
  areaB: AreaResult;
  categoryWinner?: CategoryWinner;
}

export default function AccessComparison({ areaA, areaB, categoryWinner }: Props) {
  const [showDetail, setShowDetail] = useState(false);

  const aP = areaA.profile;
  const bP = areaB.profile;

  // ひとことコメント生成
  const aBetter = areaA.scores.population > areaB.scores.population;
  const betterName = aBetter ? areaA.name : areaB.name;
  const betterColor = aBetter ? 'text-blue-600' : 'text-orange-600';
  const diff = Math.abs(areaA.scores.population - areaB.scores.population);
  const isTie = diff < 3;

  const winnerBadge = categoryWinner && categoryWinner.winner !== 'tie'
    ? (categoryWinner.winner === 'area_a' ? areaA.name : areaB.name)
    : null;

  // グラフには「駅の利用者数」のみ（路線数・バス路線数はスケールが違いすぎるため除外）
  const barData = {
    labels: ['駅の利用者数（人/日）'],
    datasets: [
      {
        label: areaA.name,
        data: [aP.station_passengers],
        backgroundColor: AREA_A.primary,
        borderRadius: 4,
      },
      {
        label: areaB.name,
        data: [bP.station_passengers],
        backgroundColor: AREA_B.primary,
        borderRadius: 4,
      },
    ],
  };

  const barOptions = {
    responsive: true,
    indexAxis: 'y' as const,
    animation: { duration: 1000, easing: 'easeOutQuart' as const },
    plugins: {
      legend: { position: 'top' as const },
      tooltip: {
        callbacks: {
          label: (ctx: { dataset: { label?: string }; raw: unknown }) => {
            const label = ctx.dataset.label || '';
            const val = Number(ctx.raw);
            return `${label}: 約${(val / 10000).toFixed(1)}万人/日`;
          },
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: {
          callback: (value: number | string) => `${(Number(value) / 10000).toFixed(0)}万`,
        },
      },
    },
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-4 md:p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg md:text-xl font-bold text-gray-800 flex items-center gap-2">
          &#x1f683; 駅は近い？通勤は便利？
          {winnerBadge && (
            <span className="text-sm bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
              &#x1f3c6; {winnerBadge}
            </span>
          )}
        </h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        最寄り駅・路線数・バス路線から交通利便性を比較
      </p>

      {/* ひとことコメント */}
      <div className="bg-gradient-to-r from-blue-50 to-orange-50 rounded-xl p-3 mb-5">
        <p className="font-semibold text-gray-800 text-center">
          {isTie ? (
            '交通アクセスはほぼ同等'
          ) : (
            <><span className={betterColor}>{betterName}</span>の方が交通の便が良い</>
          )}
        </p>
      </div>

      {/* メイン表示 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-blue-50 rounded-xl p-4">
          <p className="text-xs text-blue-500 font-semibold mb-1">{areaA.name}</p>
          <p className="text-sm text-gray-600">最寄り駅まで</p>
          <p className="text-2xl font-bold text-blue-600">徒歩{aP.nearest_station_min}分</p>
          <p className="text-sm text-gray-600 mt-2">利用可能な路線</p>
          <p className="text-lg font-bold text-blue-600">{aP.rail_lines}路線</p>
          <p className="text-sm text-gray-600 mt-2">駅の利用者数</p>
          <p className="text-base font-bold text-blue-600">約{(aP.station_passengers / 10000).toFixed(1)}万人/日</p>
        </div>
        <div className="bg-orange-50 rounded-xl p-4">
          <p className="text-xs text-orange-500 font-semibold mb-1">{areaB.name}</p>
          <p className="text-sm text-gray-600">最寄り駅まで</p>
          <p className="text-2xl font-bold text-orange-600">徒歩{bP.nearest_station_min}分</p>
          <p className="text-sm text-gray-600 mt-2">利用可能な路線</p>
          <p className="text-lg font-bold text-orange-600">{bP.rail_lines}路線</p>
          <p className="text-sm text-gray-600 mt-2">駅の利用者数</p>
          <p className="text-base font-bold text-orange-600">約{(bP.station_passengers / 10000).toFixed(1)}万人/日</p>
        </div>
      </div>

      {/* 棒グラフ */}
      <div className="mb-4">
        <Bar data={barData} options={barOptions} />
      </div>

      {/* 詳しく見る（メインに出していない追加情報のみ） */}
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
                  <th className="text-left py-2 px-2">項目</th>
                  <th className="py-2 px-2 text-blue-600">{areaA.name}</th>
                  <th className="py-2 px-2 text-orange-600">{areaB.name}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="py-2 px-2 text-gray-600">バス路線数</td>
                  <td className="py-2 px-2 text-center">{aP.bus_routes}路線</td>
                  <td className="py-2 px-2 text-center">{bP.bus_routes}路線</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
