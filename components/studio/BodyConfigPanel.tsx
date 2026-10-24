'use client';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { t, type Lang, type StringKey } from '@/lib/i18n';
import type {
  BodyConfig,
  ConstraintLevel,
  ConstraintResult,
  RoofType,
  WheelbaseClass,
} from '@/lib/parametric-body';
import {
  ROOF_CLOSED_HEIGHT_MM,
  WHEELBASE_PRESETS_MM,
  isPopUpRoof,
  openHeightMm,
} from '@/lib/parametric-body';

const CONSTRAINT_KEY: Record<string, StringKey> = {
  'blue-length-ok': 'bodylab.cBlueOk',
  'blue-length-over': 'bodylab.cBlueOver',
  'mass-ok': 'bodylab.cMassOk',
  'mass-over': 'bodylab.cMassOver',
  'mass-unknown': 'bodylab.cMassUnknown',
  'height-ok': 'bodylab.cHeightOk',
  'height-over': 'bodylab.cHeightOver',
  'wheelbase-ok': 'bodylab.cWheelbaseOk',
  'wheelbase-over': 'bodylab.cWheelbaseOver',
  'travel-ok': 'bodylab.cTravelOk',
  'travel-range': 'bodylab.cTravelRange',
  'angle-ok': 'bodylab.cAngleOk',
  'angle-range': 'bodylab.cAngleRange',
  'width-ok': 'bodylab.cWidthOk',
  'width-over': 'bodylab.cWidthOver',
};

const ROOF_KEY: Record<RoofType, StringKey> = {
  flat: 'bodylab.roofFlat',
  low: 'bodylab.roofLow',
  high: 'bodylab.roofHigh',
  'semi-high': 'bodylab.roofSemiHigh',
  'pop-up': 'bodylab.roofPopUp',
  'sloped-pop-up': 'bodylab.roofSlopedPopUp',
  'split-pop-up': 'bodylab.roofSplitPopUp',
};

const WHEELBASE_KEY: Record<WheelbaseClass, StringKey> = {
  short: 'bodylab.wheelbaseShort',
  medium: 'bodylab.wheelbaseMedium',
  long: 'bodylab.wheelbaseLong',
};

const LEVEL_ICON: Record<ConstraintLevel, typeof CheckCircle2> = {
  pass: CheckCircle2,
  warn: AlertTriangle,
  fail: XCircle,
};

interface Props {
  lang: Lang;
  config: BodyConfig;
  results: ConstraintResult[];
  onChange: (next: BodyConfig) => void;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label
      style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}
    >
      <span>{label}</span>
      {children}
    </label>
  );
}

export default function BodyConfigPanel({
  lang,
  config,
  results,
  onChange,
}: Props) {
  const set = (patch: Partial<BodyConfig>) =>
    onChange({ ...config, ...patch });
  const setRoof = (roofType: RoofType) =>
    set({ roofType, heightMm: ROOF_CLOSED_HEIGHT_MM[roofType] });
  const setWheelbase = (wheelbaseClass: WheelbaseClass) =>
    set({
      wheelbaseClass,
      wheelbaseMm: WHEELBASE_PRESETS_MM[wheelbaseClass],
    });
  const number = (value: number | null) =>
    value === null ? '' : String(value);
  const parse = (raw: string): number | null => {
    if (raw.trim() === '') return null;
    const value = Number(raw);
    return Number.isFinite(value) ? Math.round(value) : null;
  };
  const popUp = isPopUpRoof(config.roofType);
  return (
    <article className="insight-card" aria-label={t(lang, 'bodylab.title')}>
      <div className="insight-card-head">
        <h3>{t(lang, 'bodylab.title')}</h3>
      </div>
      <p style={{ fontSize: 13, margin: '0 0 12px' }}>
        {t(lang, 'bodylab.subtitle')}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Field label={t(lang, 'bodylab.chassis')}>
          <span style={{ fontSize: 13 }}>
            {t(lang, 'bodylab.chassisV80')} · {t(lang, 'bodylab.bodyTypeB')}
          </span>
        </Field>
        <Field label={t(lang, 'bodylab.wheelbase')}>
          <select
            value={config.wheelbaseClass}
            onChange={(event) =>
              setWheelbase(event.target.value as WheelbaseClass)
            }
          >
            {(Object.keys(WHEELBASE_KEY) as WheelbaseClass[]).map((key) => (
              <option key={key} value={key}>
                {t(lang, WHEELBASE_KEY[key])}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t(lang, 'bodylab.wheelbaseMm')}>
          <input
            type="number"
            value={config.wheelbaseMm}
            onChange={(event) => {
              const value = parse(event.target.value);
              if (value !== null) set({ wheelbaseMm: value });
            }}
          />
        </Field>
        <Field label={t(lang, 'bodylab.length')}>
          <input
            type="number"
            value={config.lengthMm}
            onChange={(event) => {
              const value = parse(event.target.value);
              if (value !== null) set({ lengthMm: value });
            }}
          />
        </Field>
        <Field label={t(lang, 'bodylab.width')}>
          <input
            type="number"
            value={config.widthMm}
            onChange={(event) => {
              const value = parse(event.target.value);
              if (value !== null) set({ widthMm: value });
            }}
          />
        </Field>
        <Field label={t(lang, 'bodylab.height')}>
          <input
            type="number"
            value={config.heightMm}
            onChange={(event) => {
              const value = parse(event.target.value);
              if (value !== null) set({ heightMm: value });
            }}
          />
        </Field>
        <Field label={t(lang, 'bodylab.roof')}>
          <select
            value={config.roofType}
            onChange={(event) => setRoof(event.target.value as RoofType)}
          >
            {(Object.keys(ROOF_KEY) as RoofType[]).map((key) => (
              <option key={key} value={key}>
                {t(lang, ROOF_KEY[key])}
              </option>
            ))}
          </select>
        </Field>
        {popUp && (
          <>
            <Field label={t(lang, 'bodylab.travel')}>
              <input
                type="number"
                value={config.popUpTravelMm}
                onChange={(event) => {
                  const value = parse(event.target.value);
                  if (value !== null) set({ popUpTravelMm: value });
                }}
              />
            </Field>
            <label
              style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}
            >
              <input
                type="checkbox"
                checked={config.popUpOpen}
                onChange={(event) => set({ popUpOpen: event.target.checked })}
              />
              {t(lang, 'bodylab.popUpOpen')}
            </label>
          </>
        )}
        {config.roofType === 'sloped-pop-up' && (
          <Field label={t(lang, 'bodylab.angle')}>
            <input
              type="number"
              value={config.slopedAngleDeg}
              onChange={(event) => {
                const value = parse(event.target.value);
                if (value !== null) set({ slopedAngleDeg: value });
              }}
            />
          </Field>
        )}
        <Field label={t(lang, 'bodylab.mass')}>
          <input
            type="number"
            placeholder={t(lang, 'bodylab.massEmpty')}
            value={number(config.estimatedMassKg)}
            onChange={(event) =>
              set({ estimatedMassKg: parse(event.target.value) })
            }
          />
        </Field>
        <p style={{ fontSize: 13, margin: 0 }}>
          {t(lang, 'bodylab.openHeight', {
            value: openHeightMm(config),
          })}
        </p>
        <section aria-label={t(lang, 'bodylab.constraints')}>
          <h4 style={{ margin: '4px 0 8px', fontSize: 14 }}>
            {t(lang, 'bodylab.constraints')}
          </h4>
          <ul style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: 0, padding: 0, listStyle: 'none' }}>
            {results.map((result) => {
              const Icon = LEVEL_ICON[result.level];
              return (
                <li
                  key={result.code}
                  style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 13 }}
                >
                  <Icon size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>{t(lang, CONSTRAINT_KEY[result.code])}</span>
                </li>
              );
            })}
          </ul>
        </section>
        <p style={{ fontSize: 12, margin: 0, opacity: 0.75 }}>
          {t(lang, 'bodylab.note')}
        </p>
      </div>
    </article>
  );
}
