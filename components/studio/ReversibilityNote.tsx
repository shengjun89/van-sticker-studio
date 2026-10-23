'use client';
import { Undo2 } from 'lucide-react';
import { t, type Lang } from '@/lib/i18n';

/**
 * Copy lives in lib/i18n.ts (reversibility.* keys).
 * Basis: demand pool P23/P27/P28/P32; resale figures are media-reported
 * and stay labeled as such in both languages.
 */
export default function ReversibilityNote({ lang }: { lang: Lang }) {
  return (
    <article
      className="insight-card reversibility-note"
      aria-label={t(lang, 'reversibility.title')}
    >
      <p className="reversibility-main">
        <Undo2 size={15} />
        <span>{t(lang, 'reversibility.main')}</span>
      </p>
      <p className="insight-footnote">{t(lang, 'reversibility.sub')}</p>
    </article>
  );
}
