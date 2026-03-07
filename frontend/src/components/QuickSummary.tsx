import type { CategoryWinner } from '../types';

interface Props {
  categoryWinners: CategoryWinner[];
  conclusion: string;
}

export default function QuickSummary({ categoryWinners, conclusion }: Props) {
  // 上位3つのカテゴリコメントを表示
  const topComments = categoryWinners.slice(0, 3);

  return (
    <div className="bg-white rounded-2xl shadow-lg p-4 md:p-6">
      <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
        <span className="text-xl">&#x1f4cb;</span>
        3行でわかる比較結果
      </h2>

      <div className="space-y-3 mb-5">
        {topComments.map((cw, i) => (
          <div
            key={cw.category}
            className="flex items-start gap-2 text-gray-700"
            style={{ animationDelay: `${i * 200}ms` }}
          >
            <span className="text-base leading-7 shrink-0">{cw.comment}</span>
          </div>
        ))}
      </div>

      {conclusion && (
        <div className="bg-gradient-to-r from-blue-50 to-orange-50 rounded-xl p-4 text-center">
          <p className="font-bold text-gray-800">{conclusion}</p>
        </div>
      )}
    </div>
  );
}
