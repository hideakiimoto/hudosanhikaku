export default function Disclaimer() {
  return (
    <div className="bg-gray-50 rounded-2xl p-4 md:p-6 text-sm text-gray-500 space-y-3">
      <h3 className="font-bold text-gray-600">&#x26a0;&#xfe0f; ご注意・免責事項</h3>

      <ul className="space-y-1 list-disc list-inside">
        <li>このレポートは不動産情報ライブラリのAPIデータに基づく参考情報です</li>
        <li>実際の物件選びは不動産会社にもご相談ください</li>
      </ul>

      <div className="border-t border-gray-200 pt-3">
        <h4 className="font-semibold text-gray-600 mb-1">&#x1f6a7; 現在評価できない項目</h4>
        <ul className="space-y-1 list-disc list-inside text-gray-400">
          <li><strong>治安</strong> -- 犯罪データは現在のAPIでは取得できません</li>
          <li><strong>街の雰囲気</strong> -- 主観的データのため自動評価の対象外です</li>
        </ul>
        <p className="text-xs text-gray-400 mt-2">
          ※ 将来的にデータソースが拡充されれば対応予定です
        </p>
      </div>

      <div className="border-t border-gray-200 pt-3 text-xs text-gray-400">
        <p>
          このサービスは、国土交通省不動産情報ライブラリのAPI機能を使用していますが、
          サービスの内容は国土交通省によって保証されたものではありません。
        </p>
      </div>
    </div>
  );
}
