/**
 * 価格のユーザーフレンドリー変換ユーティリティ
 */

/** m2単価を坪単価に変換 (1坪 = 3.306m2) */
export function sqmToTsubo(pricePerSqm: number): number {
  return Math.round(pricePerSqm * 3.306);
}

/** m2単価から70m2換算のマンション価格を算出 */
export function estimateAptPrice(pricePerSqm: number, sqm = 70): number {
  return Math.round(pricePerSqm * sqm);
}

/** 価格を「約○○万円」形式にフォーマット */
export function formatManyen(yen: number): string {
  const man = yen / 10000;
  if (man >= 10000) return `${(man / 10000).toFixed(1)}億`;
  if (man >= 1000) return `${Math.round(man).toLocaleString()}万`;
  if (man >= 100) return `${Math.round(man)}万`;
  if (man >= 10) return `${Math.round(man)}万`;
  return `${man.toFixed(1)}万`;
}

/** 短い価格表示 (グラフ軸用) */
export function formatPriceShort(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  return n.toLocaleString();
}

/** パーセント差分を計算して文字列化 */
export function pctDiff(a: number, b: number): string {
  if (b === 0) return '-';
  const pct = Math.abs((a - b) / b * 100);
  return `約${Math.round(pct)}%`;
}
