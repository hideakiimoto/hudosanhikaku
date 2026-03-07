// エリアA = ブルー系, エリアB = オレンジ系
export const AREA_A = {
  primary: '#3b82f6',    // blue-500
  light: '#93c5fd',      // blue-300
  bg: '#eff6ff',         // blue-50
  border: '#3b82f6',
  rgba: 'rgba(59, 130, 246, 0.4)',
} as const;

export const AREA_B = {
  primary: '#f97316',    // orange-500
  light: '#fdba74',      // orange-300
  bg: '#fff7ed',         // orange-50
  border: '#f97316',
  rgba: 'rgba(249, 115, 22, 0.4)',
} as const;

// 勝者ハイライト
export const WINNER_GOLD = '#f59e0b';  // amber-500
