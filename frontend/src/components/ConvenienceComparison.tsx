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

export default function ConvenienceComparison({ areaA, areaB, categoryWinner }: Props) {
  const [showDetail, setShowDetail] = useState(false);

  const aP = areaA.profile;
  const bP = areaB.profile;

  const aBetter = areaA.scores.infrastructure > areaB.scores.infrastructure;
  const betterName = aBetter ? areaA.name : areaB.name;
  const betterColor = aBetter ? 'text-blue-600' : 'text-orange-600';
  const diff = Math.abs(areaA.scores.infrastructure - areaB.scores.infrastructure);
  const isTie = diff < 3;

  const winnerBadge = categoryWinner && categoryWinner.winner !== 'tie'
    ? (categoryWinner.winner === 'area_a' ? areaA.name : areaB.name)
    : null;

  const barData = {
    labels: ['病院・クリニック', 'スーパー', 'コンビニ', '薬局'],
    datasets: [
      {
        label: areaA.name,
        data: [aP.medical_count, aP.supermarket_count, aP.convenience_count, aP.pharmacy_count],
        backgroundColor: AREA_A.primary,
        borderRadius: 4,
      },
      {
        label: areaB.name,
        data: [bP.medical_count, bP.supermarket_count, bP.convenience_count, bP.pharmacy_count],
        backgroundColor: AREA_B.primary,
        borderRadius: 4,
      },
    ],
  };

  const barOptions = {
    responsive: true,
    animation: { duration: 1000, easing: 'easeOutQuart' as const },
    plugins: { legend: { position: 'top' as const } },
    scales: { y: { beginAtZero: true, ticks: { stepSize: 5 } } },
  };

  // 施設合計
  const aTotal = aP.medical_count + aP.supermarket_count + aP.convenience_count + aP.pharmacy_count;
  const bTotal = bP.medical_count + bP.supermarket_count + bP.convenience_count + bP.pharmacy_count;

  return (
    <div className="bg-white rounded-2xl shadow-lg p-4 md:p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg md:text-xl font-bold text-gray-800 flex items-center gap-2">
          &#x1f3e5; 日常生活は便利？
          {winnerBadge && (
            <span className="text-sm bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
              &#x1f3c6; {winnerBadge}
            </span>
          )}
        </h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        病院・スーパー・コンビニなど生活施設の充実度を比較
      </p>

      <div className="bg-gradient-to-r from-blue-50 to-orange-50 rounded-xl p-3 mb-5">
        <p className="font-semibold text-gray-800 text-center">
          {isTie ? (
            '生活施設の充実度はほぼ同等'
          ) : (
            <><span className={betterColor}>{betterName}</span>の方が生活施設が充実</>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-blue-50 rounded-xl p-4">
          <p className="text-xs text-blue-500 font-semibold mb-1">{areaA.name}</p>
          <p className="text-sm text-gray-600">病院・クリニック</p>
          <p className="text-2xl font-bold text-blue-600">{aP.medical_count}件</p>
          <div className="mt-2 grid grid-cols-2 gap-x-2">
            <div>
              <p className="text-xs text-gray-500">スーパー</p>
              <p className="text-base font-bold text-blue-600">{aP.supermarket_count}件</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">コンビニ</p>
              <p className="text-base font-bold text-blue-600">{aP.convenience_count}件</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">生活施設 計{aTotal}件</p>
        </div>
        <div className="bg-orange-50 rounded-xl p-4">
          <p className="text-xs text-orange-500 font-semibold mb-1">{areaB.name}</p>
          <p className="text-sm text-gray-600">病院・クリニック</p>
          <p className="text-2xl font-bold text-orange-600">{bP.medical_count}件</p>
          <div className="mt-2 grid grid-cols-2 gap-x-2">
            <div>
              <p className="text-xs text-gray-500">スーパー</p>
              <p className="text-base font-bold text-orange-600">{bP.supermarket_count}件</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">コンビニ</p>
              <p className="text-base font-bold text-orange-600">{bP.convenience_count}件</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">生活施設 計{bTotal}件</p>
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
                  <td className="py-2 px-2 text-gray-600">薬局</td>
                  <td className="py-2 px-2 text-center">{aP.pharmacy_count}件</td>
                  <td className="py-2 px-2 text-center">{bP.pharmacy_count}件</td>
                </tr>
                <tr>
                  <td className="py-2 px-2 text-gray-600">図書館</td>
                  <td className="py-2 px-2 text-center">{aP.library_count}館</td>
                  <td className="py-2 px-2 text-center">{bP.library_count}館</td>
                </tr>
                <tr>
                  <td className="py-2 px-2 text-gray-600">生活施設 合計</td>
                  <td className="py-2 px-2 text-center font-mono">{aTotal}件</td>
                  <td className="py-2 px-2 text-center font-mono">{bTotal}件</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
