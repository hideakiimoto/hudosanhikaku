import { useState } from 'react';
import type { AreaResult, CategoryWinner } from '../types';

interface Props {
  areaA: AreaResult;
  areaB: AreaResult;
  categoryWinner?: CategoryWinner;
}

function riskBadge(risk: string) {
  const map: Record<string, string> = {
    '低い': 'bg-green-100 text-green-700',
    'やや低い': 'bg-green-50 text-green-600',
    '普通': 'bg-yellow-50 text-yellow-700',
    'やや高い': 'bg-orange-100 text-orange-700',
    '高い': 'bg-red-100 text-red-700',
  };
  return map[risk] || 'bg-gray-100 text-gray-600';
}

function fireRiskLabel(rank: number): { text: string; cls: string } {
  if (rank <= 1) return { text: '低い', cls: 'bg-green-100 text-green-700' };
  if (rank <= 2) return { text: 'やや低い', cls: 'bg-green-50 text-green-600' };
  if (rank <= 3) return { text: '普通', cls: 'bg-yellow-50 text-yellow-700' };
  if (rank <= 4) return { text: 'やや高い', cls: 'bg-orange-100 text-orange-700' };
  return { text: '高い', cls: 'bg-red-100 text-red-700' };
}

export default function SafetyComparison({ areaA, areaB, categoryWinner }: Props) {
  const [showDetail, setShowDetail] = useState(false);

  const aP = areaA.profile;
  const bP = areaB.profile;

  const aBetter = areaA.scores.disaster > areaB.scores.disaster;
  const betterName = aBetter ? areaA.name : areaB.name;
  const betterColor = aBetter ? 'text-blue-600' : 'text-orange-600';
  const diff = Math.abs(areaA.scores.disaster - areaB.scores.disaster);
  const isTie = diff < 3;

  const winnerBadge = categoryWinner && categoryWinner.winner !== 'tie'
    ? (categoryWinner.winner === 'area_a' ? areaA.name : areaB.name)
    : null;

  const aFire = fireRiskLabel(aP.fire_risk_rank);
  const bFire = fireRiskLabel(bP.fire_risk_rank);

  const risks = [
    { label: '洪水リスク', icon: '\u{1f30a}', aVal: aP.flood_risk, bVal: bP.flood_risk },
    { label: '液状化リスク', icon: '\u{1f4a7}', aVal: aP.liquefaction_risk, bVal: bP.liquefaction_risk },
    { label: '土砂災害リスク', icon: '\u{26f0}\ufe0f', aVal: aP.landslide_risk, bVal: bP.landslide_risk },
    { label: '火災危険度', icon: '\u{1f525}', aVal: aFire.text, bVal: bFire.text },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-lg p-4 md:p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg md:text-xl font-bold text-gray-800 flex items-center gap-2">
          &#x1f6e1;&#xfe0f; 災害に強い？
          {winnerBadge && (
            <span className="text-sm bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
              &#x1f3c6; {winnerBadge}
            </span>
          )}
        </h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        洪水・液状化・土砂災害・火災の危険度を比較
      </p>

      <div className="bg-gradient-to-r from-blue-50 to-orange-50 rounded-xl p-3 mb-5">
        <p className="font-semibold text-gray-800 text-center">
          {isTie ? (
            '安全性はほぼ同等'
          ) : (
            <><span className={betterColor}>{betterName}</span>の方が災害リスクが低い</>
          )}
        </p>
      </div>

      {/* リスクカード */}
      <div className="space-y-3 mb-6">
        {risks.map((r) => (
          <div key={r.label} className="flex flex-wrap md:flex-nowrap items-center gap-2 md:gap-3 bg-gray-50 rounded-xl p-3">
            <span className="text-xl shrink-0">{r.icon}</span>
            <span className="text-sm text-gray-700 font-medium w-full md:w-28 shrink-0">{r.label}</span>
            <div className="flex-1 grid grid-cols-2 gap-2 w-full">
              <div className="text-center">
                <span className="text-xs text-blue-500">{areaA.name}</span>
                <div className={`mt-0.5 inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${riskBadge(r.aVal)}`}>
                  {r.aVal}
                </div>
              </div>
              <div className="text-center">
                <span className="text-xs text-orange-500">{areaB.name}</span>
                <div className={`mt-0.5 inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${riskBadge(r.bVal)}`}>
                  {r.bVal}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* スコア比較 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="bg-blue-50 rounded-xl p-4 text-center">
          <p className="text-xs text-blue-500 font-semibold">{areaA.name}</p>
          <p className="text-sm text-gray-600">安全スコア</p>
          <p className="text-3xl font-bold text-blue-600">{areaA.scores.disaster}</p>
          <p className="text-xs text-gray-400">/ 100点</p>
        </div>
        <div className="bg-orange-50 rounded-xl p-4 text-center">
          <p className="text-xs text-orange-500 font-semibold">{areaB.name}</p>
          <p className="text-sm text-gray-600">安全スコア</p>
          <p className="text-3xl font-bold text-orange-600">{areaB.scores.disaster}</p>
          <p className="text-xs text-gray-400">/ 100点</p>
        </div>
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
                  <td className="py-2 px-2 text-gray-600">ハザードマップ該当区域数</td>
                  <td className="py-2 px-2 text-center">{aP.disaster_risk_count}区域</td>
                  <td className="py-2 px-2 text-center">{bP.disaster_risk_count}区域</td>
                </tr>
                <tr>
                  <td className="py-2 px-2 text-gray-600">防火地域指定</td>
                  <td className="py-2 px-2 text-center">{aP.fire_risk_rank >= 4 ? '準防火地域' : aP.fire_risk_rank >= 3 ? '指定なし' : '防火地域'}</td>
                  <td className="py-2 px-2 text-center">{bP.fire_risk_rank >= 4 ? '準防火地域' : bP.fire_risk_rank >= 3 ? '指定なし' : '防火地域'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
