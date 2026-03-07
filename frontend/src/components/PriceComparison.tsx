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
import type { AreaResult, CategoryWinner, RentData } from '../types';
import { AREA_A, AREA_B } from '../utils/colors';
import { sqmToTsubo, estimateAptPrice, formatManyen, formatPriceShort, pctDiff } from '../utils/format';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

interface Props {
  areaA: AreaResult;
  areaB: AreaResult;
  categoryWinner?: CategoryWinner;
  rentA?: RentData | null;
  rentB?: RentData | null;
}

export default function PriceComparison({ areaA, areaB, categoryWinner, rentA, rentB }: Props) {
  const [showDetail, setShowDetail] = useState(false);

  const aLand = areaA.data.land_price;
  const bLand = areaB.data.land_price;
  const aTx = areaA.data.transaction;
  const bTx = areaB.data.transaction;

  // 取引データの有無を判定
  const aHasTx = aTx.count > 0;
  const bHasTx = bTx.count > 0;

  // マンション相場 (70m2換算)
  const aAptPrice = aHasTx ? estimateAptPrice(aTx.avg_price_per_sqm) : 0;
  const bAptPrice = bHasTx ? estimateAptPrice(bTx.avg_price_per_sqm) : 0;

  // 坪単価
  const aTsubo = sqmToTsubo(aLand.avg_price_per_sqm);
  const bTsubo = sqmToTsubo(bLand.avg_price_per_sqm);

  // 両方に取引データがある場合のみ比較可能
  const canCompareApt = aHasTx && bHasTx;

  // 賃貸データの有無
  const hasRentA = rentA?.available ?? false;
  const hasRentB = rentB?.available ?? false;
  const hasAnyRent = hasRentA || hasRentB;
  // e-Stat APIキーが設定されているか（rentA/rentB が null ではなく undefined でもない場合）
  const estatConfigured = rentA !== undefined && rentB !== undefined;
  // 推計モード（同一市内で地価補正済み）
  const isEstimated = hasRentA && hasRentB && (rentA?.estimated || rentB?.estimated);

  // ---------- グラフ1: マンション相場（70㎡換算） ----------
  const aptBarData = {
    labels: ['マンション相場（70㎡換算）'],
    datasets: [
      {
        label: areaA.name,
        data: [aAptPrice],
        backgroundColor: AREA_A.primary,
        borderRadius: 4,
      },
      {
        label: areaB.name,
        data: [bAptPrice],
        backgroundColor: AREA_B.primary,
        borderRadius: 4,
      },
    ],
  };

  // ---------- グラフ2: 土地の坪単価 ----------
  const landBarData = {
    labels: ['土地の坪単価'],
    datasets: [
      {
        label: areaA.name,
        data: [aTsubo],
        backgroundColor: AREA_A.primary,
        borderRadius: 4,
      },
      {
        label: areaB.name,
        data: [bTsubo],
        backgroundColor: AREA_B.primary,
        borderRadius: 4,
      },
    ],
  };

  // ---------- グラフ3: 賃貸相場 ----------
  // 推計時はレンジバー（min〜max）、通常時は単一バー
  const rentBarData = isEstimated
    ? {
        labels: [areaA.name, areaB.name],
        datasets: [
          {
            label: '推計レンジ下限',
            data: [rentA?.rent_min ?? 0, rentB?.rent_min ?? 0],
            backgroundColor: [AREA_A.rgba, AREA_B.rgba],
            borderRadius: 4,
          },
          {
            label: '推計レンジ上限',
            data: [
              (rentA?.rent_max ?? 0) - (rentA?.rent_min ?? 0),
              (rentB?.rent_max ?? 0) - (rentB?.rent_min ?? 0),
            ],
            backgroundColor: [AREA_A.primary, AREA_B.primary],
            borderRadius: 4,
          },
        ],
      }
    : {
        labels: ['賃貸相場（月額）'],
        datasets: [
          {
            label: areaA.name,
            data: [hasRentA ? rentA!.rent_per_month : 0],
            backgroundColor: AREA_A.primary,
            borderRadius: 4,
          },
          {
            label: areaB.name,
            data: [hasRentB ? rentB!.rent_per_month : 0],
            backgroundColor: AREA_B.primary,
            borderRadius: 4,
          },
        ],
      };

  const makeBarOptions = (unit: string) => ({
    responsive: true,
    animation: { duration: 1000, easing: 'easeOutQuart' as const },
    plugins: {
      legend: { position: 'top' as const },
      tooltip: {
        callbacks: {
          label: (ctx: { dataset: { label?: string }; raw: unknown }) => {
            const label = ctx.dataset.label || '';
            const val = Number(ctx.raw);
            return `${label}: 約${formatManyen(val)}${unit}`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: number | string) =>
            `${formatPriceShort(Number(value))}${unit}`,
        },
      },
    },
  });

  // 推計グラフのX軸上限を適切に設定
  const rentMaxVal = isEstimated
    ? Math.max(rentA?.rent_max ?? 0, rentB?.rent_max ?? 0)
    : 0;
  const rentAxisMax = isEstimated ? Math.ceil(rentMaxVal / 50000) * 50000 + 20000 : 0;

  const rentBarOptions = isEstimated
    ? {
        responsive: true,
        animation: { duration: 1000, easing: 'easeOutQuart' as const },
        indexAxis: 'y' as const,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx: { datasetIndex: number; dataIndex: number }) => {
                const r = ctx.dataIndex === 0 ? rentA : rentB;
                if (!r) return '';
                const mn = ((r.rent_min ?? 0) / 10000).toFixed(1);
                const mx = ((r.rent_max ?? 0) / 10000).toFixed(1);
                return `推計: 約${mn}〜${mx}万円/月`;
              },
            },
          },
        },
        scales: {
          x: {
            stacked: true,
            beginAtZero: true,
            max: rentAxisMax,
            ticks: {
              callback: (value: number | string) => {
                const v = Number(value) / 10000;
                return v === 0 ? '0万円' : `${v.toFixed(1)}万円`;
              },
            },
          },
          y: { stacked: true },
        },
      }
    : makeBarOptions('円');

  // ひとことコメント
  const buildComment = () => {
    if (!canCompareApt) {
      // マンション相場比較不可 → 坪単価で比較
      if (aTsubo > 0 && bTsubo > 0) {
        const cheaper = aTsubo <= bTsubo ? areaA.name : areaB.name;
        const cheaperColor = aTsubo <= bTsubo ? 'text-blue-600' : 'text-orange-600';
        const diff = pctDiff(Math.min(aTsubo, bTsubo), Math.max(aTsubo, bTsubo));
        return (
          <p className="font-semibold text-gray-800 text-center">
            <span className={cheaperColor}>{cheaper}</span>
            の方が地価{diff}お手頃
          </p>
        );
      }
      return (
        <p className="font-semibold text-gray-800 text-center text-amber-700">
          物件価格の比較データが不足しています
        </p>
      );
    }
    const cheaper = aAptPrice <= bAptPrice ? 'A' : 'B';
    const cheaperName = cheaper === 'A' ? areaA.name : areaB.name;
    const cheaperColor = cheaper === 'A' ? 'text-blue-600' : 'text-orange-600';
    const diff = pctDiff(
      Math.min(aAptPrice, bAptPrice),
      Math.max(aAptPrice, bAptPrice),
    );
    return (
      <p className="font-semibold text-gray-800 text-center">
        <span className={cheaperColor}>{cheaperName}</span>
        の方が約{diff}お手頃
      </p>
    );
  };

  // 勝者バッジ
  const winnerBadge = categoryWinner && categoryWinner.winner !== 'tie'
    ? (categoryWinner.winner === 'area_a' ? areaA.name : areaB.name)
    : null;

  // カード内のマンション相場表示
  const renderAptPrice = (hasTx: boolean, aptPrice: number, note?: string) => {
    if (!hasTx) {
      return (
        <>
          <p className="text-lg font-bold text-gray-400">取引データなし</p>
          {note && (
            <p className="text-xs text-amber-600 mt-0.5">{note}</p>
          )}
        </>
      );
    }
    return (
      <>
        <p className="text-2xl font-bold">約{formatManyen(aptPrice)}円</p>
        <p className="text-xs text-gray-400">70㎡換算</p>
        {note && (
          <p className="text-xs text-amber-600 mt-0.5">{note}</p>
        )}
      </>
    );
  };

  // 賃貸相場の表示
  const renderRent = (rent: RentData | null | undefined, color: string) => {
    if (!estatConfigured) {
      return null; // APIキー未設定 → 表示なし
    }
    if (!rent?.available) {
      return (
        <>
          <p className="text-sm text-gray-600 mt-2">賃貸相場</p>
          <p className="text-lg font-bold text-gray-400">準備中</p>
          <p className="text-xs text-gray-400">データ取得準備中</p>
        </>
      );
    }
    // 推計モード: レンジ表示
    if (rent.estimated && rent.rent_min && rent.rent_max) {
      const mn = (rent.rent_min / 10000).toFixed(1);
      const mx = (rent.rent_max / 10000).toFixed(1);
      return (
        <>
          <p className="text-sm text-gray-600 mt-2">賃貸相場（推計）</p>
          <p className={`text-xl font-bold ${color}`}>
            約{mn}〜{mx}万円/月
          </p>
          <p className="text-xs text-gray-400">{rent.rent_type}</p>
        </>
      );
    }
    // 通常モード
    return (
      <>
        <p className="text-sm text-gray-600 mt-2">賃貸相場</p>
        <p className={`text-2xl font-bold ${color}`}>
          約{(rent.rent_per_month / 10000).toFixed(1)}万円/月
        </p>
        <p className="text-xs text-gray-400">{rent.rent_type}</p>
      </>
    );
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-4 md:p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg md:text-xl font-bold text-gray-800 flex items-center gap-2">
          &#x1f4b0; お財布にやさしい？
          {winnerBadge && (
            <span className="text-sm bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
              &#x1f3c6; {winnerBadge}
            </span>
          )}
        </h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        物件価格・土地の値段{estatConfigured ? '・賃貸相場' : ''}を比較
      </p>

      {/* ひとことコメント */}
      <div className="bg-gradient-to-r from-blue-50 to-orange-50 rounded-xl p-3 mb-5">
        {buildComment()}
      </div>

      {/* メイン: 一般向け価格表示 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-blue-50 rounded-xl p-4">
          <p className="text-xs text-blue-500 font-semibold mb-1">{areaA.name}</p>
          <p className="text-sm text-gray-600">マンション相場</p>
          <div className="text-blue-600">
            {renderAptPrice(aHasTx, aAptPrice, aTx._note)}
          </div>
          <p className="text-sm text-gray-600 mt-2">土地の坪単価</p>
          <p className="text-lg font-bold text-blue-600">約{formatManyen(aTsubo)}円</p>
          {renderRent(rentA, 'text-blue-600')}
        </div>
        <div className="bg-orange-50 rounded-xl p-4">
          <p className="text-xs text-orange-500 font-semibold mb-1">{areaB.name}</p>
          <p className="text-sm text-gray-600">マンション相場</p>
          <div className="text-orange-600">
            {renderAptPrice(bHasTx, bAptPrice, bTx._note)}
          </div>
          <p className="text-sm text-gray-600 mt-2">土地の坪単価</p>
          <p className="text-lg font-bold text-orange-600">約{formatManyen(bTsubo)}円</p>
          {renderRent(rentB, 'text-orange-600')}
        </div>
      </div>

      {/* 取引データなし注記 */}
      {(!aHasTx || !bHasTx) && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-700">
          ⚠️ {!aHasTx && !bHasTx
            ? '両エリアで直近のマンション取引データが見つかりませんでした。土地の坪単価で比較しています。'
            : `${!aHasTx ? areaA.name : areaB.name}では直近のマンション取引データが見つかりませんでした。`}
        </div>
      )}

      {/* 棒グラフ1: マンション相場 */}
      {canCompareApt && (
        <div className="mb-4">
          <p className="text-sm font-semibold text-gray-600 mb-2">マンション相場（70㎡換算）</p>
          <Bar data={aptBarData} options={makeBarOptions('円')} />
        </div>
      )}

      {/* 棒グラフ2: 土地の坪単価 */}
      <div className="mb-4">
        <p className="text-sm font-semibold text-gray-600 mb-2">土地の坪単価</p>
        <Bar data={landBarData} options={makeBarOptions('円')} />
      </div>

      {/* 棒グラフ3: 賃貸相場（データがある場合のみ） */}
      {hasAnyRent && (
        <div className="mb-4">
          <p className="text-sm font-semibold text-gray-600 mb-2">
            賃貸相場（月額）{isEstimated && <span className="text-xs text-amber-600 ml-1">※推計</span>}
          </p>
          <Bar data={rentBarData} options={rentBarOptions} />
        </div>
      )}

      {/* 推計注釈 */}
      {isEstimated && rentA?.base_city_name && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-xs text-amber-700">
          ※ 同一市内の比較のため、市平均家賃（{rentA.base_city_name}: 約{((rentA.base_city_rent ?? 0) / 10000).toFixed(1)}万円）を地価比率で推計しています。実際の家賃は物件により異なります。
        </div>
      )}

      {/* 詳しく見る（アコーディオン） */}
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
                  <td className="py-2 px-2 text-gray-600">最近の売買実績</td>
                  <td className="py-2 px-2 text-center">{aHasTx ? `${aTx.count}件` : '—'}</td>
                  <td className="py-2 px-2 text-center">{bHasTx ? `${bTx.count}件` : '—'}</td>
                </tr>
                <tr>
                  <td className="py-2 px-2 text-gray-600">取引 最安値（㎡単価）</td>
                  <td className="py-2 px-2 text-center font-mono">
                    {aHasTx ? `${formatPriceShort(aTx.min_price_per_sqm)}円` : '—'}
                  </td>
                  <td className="py-2 px-2 text-center font-mono">
                    {bHasTx ? `${formatPriceShort(bTx.min_price_per_sqm)}円` : '—'}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-2 text-gray-600">取引 最高値（㎡単価）</td>
                  <td className="py-2 px-2 text-center font-mono">
                    {aHasTx ? `${formatPriceShort(aTx.max_price_per_sqm)}円` : '—'}
                  </td>
                  <td className="py-2 px-2 text-center font-mono">
                    {bHasTx ? `${formatPriceShort(bTx.max_price_per_sqm)}円` : '—'}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-2 text-gray-600">地価公示 調査地点数</td>
                  <td className="py-2 px-2 text-center">{aLand.point_count}地点</td>
                  <td className="py-2 px-2 text-center">{bLand.point_count}地点</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
