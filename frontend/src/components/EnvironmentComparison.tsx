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

function noiseBadge(level: string) {
  const map: Record<string, string> = {
    '静か': 'bg-green-100 text-green-700',
    'やや静か': 'bg-green-50 text-green-600',
    '普通': 'bg-yellow-50 text-yellow-700',
    'やや騒がしい': 'bg-orange-100 text-orange-700',
    '騒がしい': 'bg-red-100 text-red-700',
  };
  return map[level] || 'bg-gray-100 text-gray-600';
}

export default function EnvironmentComparison({ areaA, areaB, categoryWinner }: Props) {
  const [showDetail, setShowDetail] = useState(false);

  const aP = areaA.profile;
  const bP = areaB.profile;

  const aBetter = areaA.scores.urban_plan > areaB.scores.urban_plan;
  const betterName = aBetter ? areaA.name : areaB.name;
  const betterColor = aBetter ? 'text-blue-600' : 'text-orange-600';
  const diff = Math.abs(areaA.scores.urban_plan - areaB.scores.urban_plan);
  const isTie = diff < 3;

  const winnerBadge = categoryWinner && categoryWinner.winner !== 'tie'
    ? (categoryWinner.winner === 'area_a' ? areaA.name : areaB.name)
    : null;

  const barData = {
    labels: ['公園数', '緑被率（%）'],
    datasets: [
      {
        label: areaA.name,
        data: [aP.park_count, aP.green_ratio],
        backgroundColor: AREA_A.primary,
        borderRadius: 4,
      },
      {
        label: areaB.name,
        data: [bP.park_count, bP.green_ratio],
        backgroundColor: AREA_B.primary,
        borderRadius: 4,
      },
    ],
  };

  const barOptions = {
    responsive: true,
    animation: { duration: 1000, easing: 'easeOutQuart' as const },
    plugins: { legend: { position: 'top' as const } },
    scales: { y: { beginAtZero: true } },
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-4 md:p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg md:text-xl font-bold text-gray-800 flex items-center gap-2">
          &#x1f333; 緑は多い？静かに暮らせる？
          {winnerBadge && (
            <span className="text-sm bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
              &#x1f3c6; {winnerBadge}
            </span>
          )}
        </h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        公園の多さ・緑被率・騒音・用途地域から住環境を比較
      </p>

      <div className="bg-gradient-to-r from-blue-50 to-orange-50 rounded-xl p-3 mb-5">
        <p className="font-semibold text-gray-800 text-center">
          {isTie ? (
            '住環境はほぼ同等'
          ) : (
            <><span className={betterColor}>{betterName}</span>の方が緑豊かで住みやすい</>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-blue-50 rounded-xl p-4">
          <p className="text-xs text-blue-500 font-semibold mb-1">{areaA.name}</p>
          <p className="text-sm text-gray-600">公園</p>
          <p className="text-2xl font-bold text-blue-600">{aP.park_count}ヶ所</p>
          <p className="text-sm text-gray-600 mt-2">緑被率</p>
          <p className="text-lg font-bold text-blue-600">{aP.green_ratio}%</p>
          <p className="text-sm text-gray-600 mt-2">騒音レベル</p>
          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${noiseBadge(aP.noise_level)}`}>
            {aP.noise_level}
          </span>
        </div>
        <div className="bg-orange-50 rounded-xl p-4">
          <p className="text-xs text-orange-500 font-semibold mb-1">{areaB.name}</p>
          <p className="text-sm text-gray-600">公園</p>
          <p className="text-2xl font-bold text-orange-600">{bP.park_count}ヶ所</p>
          <p className="text-sm text-gray-600 mt-2">緑被率</p>
          <p className="text-lg font-bold text-orange-600">{bP.green_ratio}%</p>
          <p className="text-sm text-gray-600 mt-2">騒音レベル</p>
          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${noiseBadge(bP.noise_level)}`}>
            {bP.noise_level}
          </span>
        </div>
      </div>

      <div className="mb-4">
        <Bar data={barData} options={barOptions} />
      </div>

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
                  <td className="py-2 px-2 text-gray-600">用途地域</td>
                  <td className="py-2 px-2 text-center text-xs">{aP.youto_chiiki}</td>
                  <td className="py-2 px-2 text-center text-xs">{bP.youto_chiiki}</td>
                </tr>
                <tr>
                  <td className="py-2 px-2 text-gray-600">住居系地域</td>
                  <td className="py-2 px-2 text-center">{aP.residential_area ? 'はい' : 'いいえ'}</td>
                  <td className="py-2 px-2 text-center">{bP.residential_area ? 'はい' : 'いいえ'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
