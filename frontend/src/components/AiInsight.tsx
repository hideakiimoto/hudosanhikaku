interface Props {
  insight: string;
}

export default function AiInsight({ insight }: Props) {
  return (
    <div className="bg-white rounded-2xl shadow-lg p-4 md:p-6">
      <div className="flex items-center gap-2 mb-1">
        <h2 className="text-lg md:text-xl font-bold text-gray-800">
          &#x1f916; AIによる考察
        </h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        比較データをもとにAIが分析しました
      </p>

      <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-5">
        <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
          &#x1f4a1; {insight}
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-3 text-center">
        ※ AIの考察は統計データに基づく推測です。実際の状況とは異なる場合があります。
      </p>
    </div>
  );
}
