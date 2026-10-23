'use client';
import { useMemo } from 'react';
import type { DecalPlacement, WrapBody } from '@/lib/wrap-layout';
import { estimateCoverage, estimatePrice } from '@/lib/plan-insights';
import { t, type Lang } from '@/lib/i18n';
import CoverageMeter from './CoverageMeter';
import ComplianceCard from './ComplianceCard';
import PriceEstimateCard from './PriceEstimateCard';
import InstallCheckCard from './InstallCheckCard';
import ReversibilityNote from './ReversibilityNote';

interface Props {
  lang: Lang;
  /** 当前已应用方案名，跟随选中方案展示。 */
  appliedName: string;
  /** 编辑器实时回流的两侧贴图 placement。 */
  placements: readonly DecalPlacement[];
  /** 贴图图片宽高比（编辑器实时值）。 */
  aspect: number;
  /** 周长图车身（编辑器实时值）。 */
  body: WrapBody;
}

export default function PlanInsights({
  lang,
  appliedName,
  placements,
  aspect,
  body,
}: Props) {
  const coverage = useMemo(
    () => estimateCoverage({ placements, aspect, body }),
    [placements, aspect, body],
  );
  const price = useMemo(
    () => estimatePrice({ decalAreaM2: coverage.decalAreaM2, body }),
    [coverage.decalAreaM2, body],
  );
  return (
    <section className="insights-section" aria-label={t(lang, 'insights.aria')}>
      <div className="section-line">
        <h2>{t(lang, 'insights.title')}</h2>
        <span>
          {appliedName} · {t(lang, 'insights.meta')}
        </span>
      </div>
      <CoverageMeter
        lang={lang}
        ratio={coverage.ratio}
        decalAreaM2={coverage.decalAreaM2}
        totalSideAreaM2={coverage.totalSideAreaM2}
        overThreshold={coverage.overThreshold}
      />
      <ComplianceCard lang={lang} overThreshold={coverage.overThreshold} />
      <PriceEstimateCard lang={lang} price={price} />
      <InstallCheckCard lang={lang} />
      <ReversibilityNote lang={lang} />
    </section>
  );
}
