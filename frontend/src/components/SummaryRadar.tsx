import { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Radar } from 'react-chartjs-2';
import type { AreaResult } from '../types';
import { AREA_A, AREA_B } from '../utils/colors';
import { useCountUp } from '../hooks/useCountUp';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

interface Props {
  areaA: AreaResult;
  areaB: AreaResult;
  winner: string;
}

// LIVABILITY_GUIDE準拠: 一般向けラベル
const LABELS = [
  '\u{1f4b0} お財布',
  '\u{1f683} アクセス',
  '\u{1f3e5} 便利さ',
  '\u{1f4da} 子育て',
  '\u{1f6e1}\ufe0f 安全性',
  '\u{1f333} 環境',
];

// ツールチップ用の説明文
const TOOLTIPS: Record<string, string> = {
  '\u{1f4b0} お財布': '国が調べた土地の値段と売買実績から評価',
  '\u{1f683} アクセス': '最寄り駅の利用者数と将来の人口予測から評価',
  '\u{1f3e5} 便利さ': '病院・クリニックなど医療施設の数から評価',
  '\u{1f4da} 子育て': '保育園・学校の数から評価',
  '\u{1f6e1}\ufe0f 安全性': '洪水・液状化など災害リスクの少なさから評価',
  '\u{1f333} 環境': '自然公園の多さと住宅地かどうかから評価',
};

export default function SummaryRadar({ areaA, areaB, winner }: Props) {
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);

  const scoreA = useCountUp(areaA.total_score, 1500, ready);
  const scoreB = useCountUp(areaB.total_score, 1500, ready);

  const data = {
    labels: LABELS,
    datasets: [
      {
        label: areaA.name,
        data: [
          areaA.scores.price,
          areaA.scores.population,
          areaA.scores.infrastructure,
          areaA.scores.education,
          areaA.scores.disaster,
          areaA.scores.urban_plan,
        ],
        backgroundColor: AREA_A.rgba,
        borderColor: AREA_A.primary,
        borderWidth: 2,
        pointRadius: 4,
        pointBackgroundColor: AREA_A.primary,
      },
      {
        label: areaB.name,
        data: [
          areaB.scores.price,
          areaB.scores.population,
          areaB.scores.infrastructure,
          areaB.scores.education,
          areaB.scores.disaster,
          areaB.scores.urban_plan,
        ],
        backgroundColor: AREA_B.rgba,
        borderColor: AREA_B.primary,
        borderWidth: 2,
        pointRadius: 4,
        pointBackgroundColor: AREA_B.primary,
      },
    ],
  };

  const options = {
    scales: {
      r: {
        min: 0,
        max: 100,
        ticks: { stepSize: 20, font: { size: 10 } },
        pointLabels: {
          font: { size: 13 },
          callback: (label: string) => label,
        },
      },
    },
    animation: {
      duration: 1200,
      easing: 'easeOutQuart' as const,
    },
    plugins: {
      legend: { position: 'top' as const },
      tooltip: {
        callbacks: {
          afterLabel: (ctx: { label?: string }) => {
            const label = ctx.label || '';
            return TOOLTIPS[label] || '';
          },
        },
      },
    },
  };

  const winnerArea = winner === 'area_a' ? areaA : areaB;
  const winnerColor = winner === 'area_a' ? 'text-blue-600' : 'text-orange-600';
  const isAWinner = winner === 'area_a';

  return (
    <div className="bg-white rounded-2xl shadow-lg p-4 md:p-6">
      <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-4">
        &#x1f3e0; どっちが住みやすい？
      </h2>

      {/* スコアカード */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className={`text-center p-4 rounded-xl ${
          isAWinner ? 'bg-blue-50 ring-2 ring-amber-400' : 'bg-blue-50'
        }`}>
          {isAWinner && <span className="text-amber-500 text-sm font-bold">&#x1f3c6; WINNER</span>}
          <p className="text-sm text-blue-600 font-semibold mt-1">{areaA.name}</p>
          <p className="text-4xl font-bold text-blue-600 tabular-nums">{scoreA}</p>
          <p className="text-xs text-gray-500">/ 100点</p>
        </div>
        <div className={`text-center p-4 rounded-xl ${
          !isAWinner ? 'bg-orange-50 ring-2 ring-amber-400' : 'bg-orange-50'
        }`}>
          {!isAWinner && <span className="text-amber-500 text-sm font-bold">&#x1f3c6; WINNER</span>}
          <p className="text-sm text-orange-600 font-semibold mt-1">{areaB.name}</p>
          <p className="text-4xl font-bold text-orange-600 tabular-nums">{scoreB}</p>
          <p className="text-xs text-gray-500">/ 100点</p>
        </div>
      </div>

      <div className="text-center mb-4">
        <span className={`text-lg font-bold ${winnerColor}`}>
          {winnerArea.name} が総合的に住みやすい！
        </span>
      </div>

      {/* レーダーチャート */}
      <div className="max-w-md mx-auto">
        <Radar data={data} options={options} />
      </div>

      <p className="text-xs text-gray-400 text-center mt-3">
        ※ 各軸にカーソルを合わせると評価基準を表示します
      </p>
    </div>
  );
}
