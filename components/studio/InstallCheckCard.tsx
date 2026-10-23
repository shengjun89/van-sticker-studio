'use client';
import { ClipboardCheck } from 'lucide-react';
import { t, type Lang, type StringKey } from '@/lib/i18n';

/**
 * Copy lives in lib/i18n.ts (install.* keys).
 * Basis: demand pool P25/P29/P35/P37/P19; tone helps the user avoid
 * pitfalls rather than deflecting responsibility.
 */
const GROUPS: { heading: StringKey; items: StringKey[] }[] = [
  { heading: 'install.g1h', items: ['install.g1i1', 'install.g1i2'] },
  { heading: 'install.g2h', items: ['install.g2i1', 'install.g2i2'] },
  { heading: 'install.g3h', items: ['install.g3i1', 'install.g3i2'] },
];

export default function InstallCheckCard({ lang }: { lang: Lang }) {
  return (
    <article
      className="insight-card install-check-card"
      aria-label={t(lang, 'install.title')}
    >
      <div className="insight-card-head">
        <h3>
          <ClipboardCheck size={14} />
          {t(lang, 'install.title')}
        </h3>
      </div>
      <p className="install-intro">{t(lang, 'install.intro')}</p>
      <div className="install-groups">
        {GROUPS.map((group) => (
          <section key={group.heading}>
            <h4>{t(lang, group.heading)}</h4>
            <ul>
              {group.items.map((item) => (
                <li key={item}>{t(lang, item)}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </article>
  );
}
