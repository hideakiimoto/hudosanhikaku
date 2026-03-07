import type { CompareResponse } from '../types';
import ScrollSection from './ScrollSection';
import QuickSummary from './QuickSummary';
import SummaryRadar from './SummaryRadar';
import PriceComparison from './PriceComparison';
import AccessComparison from './AccessComparison';
import ConvenienceComparison from './ConvenienceComparison';
import ChildcareComparison from './ChildcareComparison';
import SafetyComparison from './SafetyComparison';
import FutureComparison from './FutureComparison';
import EnvironmentComparison from './EnvironmentComparison';
import AiInsight from './AiInsight';
import Disclaimer from './Disclaimer';

interface Props {
  data: CompareResponse;
}

export default function ReportView({ data }: Props) {
  // カテゴリ勝者マップを作成
  const winnerMap = new Map(
    data.category_winners.map((cw) => [cw.category, cw]),
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 animate-[slideUp_0.6s_ease-out]">
      {/* ヘッダー */}
      <div className="text-center">
        <p className="text-sm text-gray-500 mb-1">&#x1f3e0; どっちが住みやすい？</p>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
          <span className="text-blue-600">{data.area_a.name}</span>
          {' vs '}
          <span className="text-orange-600">{data.area_b.name}</span>
        </h1>
        <p className="text-xs text-gray-400 mt-1">
          生成日時: {new Date(data.generated_at).toLocaleString('ja-JP')}
        </p>
      </div>

      {/* 1. 3行でわかる比較結果 */}
      <ScrollSection delay={0}>
        <QuickSummary
          categoryWinners={data.category_winners}
          conclusion={data.conclusion}
        />
      </ScrollSection>

      {/* 2. 総合レーダーチャート */}
      <ScrollSection delay={100}>
        <SummaryRadar
          areaA={data.area_a}
          areaB={data.area_b}
          winner={data.winner}
        />
      </ScrollSection>

      {/* 3. お財布（不動産価格比較）-- 優先度1位 */}
      <ScrollSection delay={200}>
        <PriceComparison
          areaA={data.area_a}
          areaB={data.area_b}
          categoryWinner={winnerMap.get('price')}
          rentA={data.rent_a}
          rentB={data.rent_b}
        />
      </ScrollSection>

      {/* 4. アクセス（交通）-- 優先度2位 */}
      <ScrollSection delay={300}>
        <AccessComparison
          areaA={data.area_a}
          areaB={data.area_b}
          categoryWinner={winnerMap.get('population')}
        />
      </ScrollSection>

      {/* 5. 便利さ（生活インフラ）-- 優先度3位 */}
      <ScrollSection delay={400}>
        <ConvenienceComparison
          areaA={data.area_a}
          areaB={data.area_b}
          categoryWinner={winnerMap.get('infrastructure')}
        />
      </ScrollSection>

      {/* 6. 子育て（教育環境）-- 優先度4位 */}
      <ScrollSection delay={500}>
        <ChildcareComparison
          areaA={data.area_a}
          areaB={data.area_b}
          categoryWinner={winnerMap.get('education')}
        />
      </ScrollSection>

      {/* 7. 安全性（災害リスク）-- 優先度5位 */}
      <ScrollSection delay={600}>
        <SafetyComparison
          areaA={data.area_a}
          areaB={data.area_b}
          categoryWinner={winnerMap.get('disaster')}
        />
      </ScrollSection>

      {/* 8. 将来性（人口トレンド）-- 優先度6位 */}
      <ScrollSection delay={700}>
        <FutureComparison
          areaA={data.area_a}
          areaB={data.area_b}
          categoryWinner={winnerMap.get('population')}
        />
      </ScrollSection>

      {/* 9. 環境（自然・緑）-- 優先度7位 */}
      <ScrollSection delay={800}>
        <EnvironmentComparison
          areaA={data.area_a}
          areaB={data.area_b}
          categoryWinner={winnerMap.get('urban_plan')}
        />
      </ScrollSection>

      {/* 10. AIによる考察（APIキー設定時かつデータありのみ表示） */}
      {data.ai_insight && (
        <ScrollSection delay={900}>
          <AiInsight insight={data.ai_insight} />
        </ScrollSection>
      )}

      {/* 免責・注意事項 */}
      <ScrollSection delay={data.ai_insight ? 1000 : 900}>
        <Disclaimer />
      </ScrollSection>
    </div>
  );
}
