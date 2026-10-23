'use client';
import { FileCheck2 } from 'lucide-react';
import { t, type Lang, type StringKey } from '@/lib/i18n';

/** Section copy lives in lib/i18n.ts (compliance.* keys). Basis: demand pool P20/P21/P22. */
const SECTIONS: { heading: StringKey; body: StringKey }[] = [
  { heading: 'compliance.s1h', body: 'compliance.s1b' },
  { heading: 'compliance.s2h', body: 'compliance.s2b' },
  { heading: 'compliance.s3h', body: 'compliance.s3b' },
];

interface Props {
  lang: Lang;
  overThreshold: boolean;
}

export default function ComplianceCard({ lang, overThreshold }: Props) {
  const activeIndex = overThreshold ? 1 : 0;
  return (
    <article
      className="insight-card compliance-card"
      aria-label={t(lang, 'compliance.title')}
    >
      <div className="insight-card-head">
        <h3>
          <FileCheck2 size={14} />
          {t(lang, 'compliance.title')}
        </h3>
      </div>
      <div className="compliance-sections">
        {SECTIONS.map((section, index) => (
          <section
            key={section.heading}
            className={index === activeIndex ? 'is-active' : ''}
          >
            <h4>{t(lang, section.heading)}</h4>
            <p>{t(lang, section.body)}</p>
          </section>
        ))}
      </div>
      <p className="insight-footnote">{t(lang, 'compliance.footnote')}</p>
    </article>
  );
}
