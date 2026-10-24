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
  DEFAULT_BODY_CONFIG,
  MIN_TOTAL_OVERHANG_MM,
  ROOF_CLOSED_HEIGHT_MM,
  WHEELBASE_PRESETS_MM,
  clampToLegal,
  constraintsAllowBuild,
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
  /** Increments every time a slider drag ends; drives the value pop. */
  popKey: number;
  /** Fired when any slider drag ends (pointer or keyboard release). */
  onRelease: () => void;
}

/**
 * Interaction rules (mistake-proofing first, no typed input anywhere):
 * - Every number is a slider, so out-of-range values cannot be typed in.
 * - Travel (0-600) and angle (5-25) sliders end exactly at their legal
 *   limits, so those two rules can never fail from this panel.
 * - The wheelbase slider's max follows the length slider, and shrinking
 *   the length auto-clamps the wheelbase, so the wheelbase rule can
 *   never fail from this panel either.
 * - Length / width / mass sliders deliberately extend past the blue-plate
 *   lines so the warnings stay visible; any fail gets a one-tap
 *   "restore legal values" button.
 */
export default function BodyConfigPanel({
  lang,
  config,
  results,
  onChange,
  popKey,
  onRelease,
}: Props) {
  const set = (patch: Partial<BodyConfig>) =>
    onChange({ ...config, ...patch });
  const setRoof = (roofType: RoofType) =>
    set({ roofType, heightMm: ROOF_CLOSED_HEIGHT_MM[roofType] });
  const setWheelbase = (wheelbaseClass: WheelbaseClass) =>
    set({
      wheelbaseClass,
      wheelbaseMm: Math.min(
        WHEELBASE_PRESETS_MM[wheelbaseClass],
        config.lengthMm - MIN_TOTAL_OVERHANG_MM,
      ),
    });
  const setLength = (lengthMm: number) =>
    set({
      lengthMm,
      wheelbaseMm: Math.min(
        config.wheelbaseMm,
        lengthMm - MIN_TOTAL_OVERHANG_MM,
      ),
    });
  const popUp = isPopUpRoof(config.roofType);
  const wheelbaseMax = config.lengthMm - MIN_TOTAL_OVERHANG_MM;
  const hasFail = !constraintsAllowBuild(results);

  return (
    <article className="insight-card" aria-label={t(lang, 'bodylab.title')}>
      <div className="insight-card-head">
        <h3>{t(lang, 'bodylab.title')}</h3>
      </div>
      <p style={{ fontSize: 13, margin: '0 0 12px' }}>
        {t(lang, 'bodylab.subtitle')}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <section>
          <p style={{ fontSize: 13, margin: '0 0 6px' }}>
            {t(lang, 'bodylab.chassis')}: {t(lang, 'bodylab.chassisV80')} ·{' '}
            {t(lang, 'bodylab.bodyTypeB')}
          </p>
        </section>
        <section>
          <p style={{ fontSize: 13, margin: '0 0 6px' }}>
            {t(lang, 'bodylab.wheelbase')}
          </p>
          <Segmented<WheelbaseClass>
            options={(Object.keys(WHEELBASE_KEY) as WheelbaseClass[]).map(
              (key) => ({ value: key, label: t(lang, WHEELBASE_KEY[key]) }),
            )}
            active={config.wheelbaseClass}
            onPick={setWheelbase}
          />
        </section>
        <Slider
          label={t(lang, 'bodylab.wheelbaseMm')}
          value={config.wheelbaseMm}
          min={2500}
          max={wheelbaseMax}
          step={10}
          unit="mm"
          popKey={popKey}
          onRelease={onRelease}
          onPick={(wheelbaseMm) => set({ wheelbaseMm })}
        />
        <Slider
          label={t(lang, 'bodylab.length')}
          value={config.lengthMm}
          min={4000}
          max={6500}
          step={10}
          unit="mm"
          popKey={popKey}
          onRelease={onRelease}
          onPick={setLength}
        />
        <Slider
          label={t(lang, 'bodylab.width')}
          value={config.widthMm}
          min={1800}
          max={2600}
          step={10}
          unit="mm"
          popKey={popKey}
          onRelease={onRelease}
          onPick={(widthMm) => set({ widthMm })}
        />
        <Slider
          label={t(lang, 'bodylab.height')}
          value={config.heightMm}
          min={2000}
          max={3500}
          step={10}
          unit="mm"
          popKey={popKey}
          onRelease={onRelease}
          onPick={(heightMm) => set({ heightMm })}
        />
        <section>
          <p style={{ fontSize: 13, margin: '0 0 6px' }}>
            {t(lang, 'bodylab.roof')}
          </p>
          <Segmented<RoofType>
            options={(Object.keys(ROOF_KEY) as RoofType[]).map((key) => ({
              value: key,
              label: t(lang, ROOF_KEY[key]),
            }))}
            active={config.roofType}
            onPick={setRoof}
          />
        </section>
        {popUp && (
          <>
            <Slider
              label={t(lang, 'bodylab.travel')}
              value={config.popUpTravelMm}
              min={0}
              max={600}
              step={10}
              unit="mm"
              popKey={popKey}
              onRelease={onRelease}
              onPick={(popUpTravelMm) => set({ popUpTravelMm })}
            />
            <button
              type="button"
              aria-pressed={config.popUpOpen}
              onClick={() => set({ popUpOpen: !config.popUpOpen })}
              style={toggleStyle(config.popUpOpen)}
            >
              {config.popUpOpen
                ? t(lang, 'bodylab.popUpOpen')
                : t(lang, 'bodylab.popUpClosed')}
            </button>
          </>
        )}
        {config.roofType === 'sloped-pop-up' && (
          <Slider
            label={t(lang, 'bodylab.angle')}
            value={config.slopedAngleDeg}
            min={5}
            max={25}
            step={1}
            unit="°"
            popKey={popKey}
            onRelease={onRelease}
            onPick={(slopedAngleDeg) => set({ slopedAngleDeg })}
          />
        )}
        <section>
          <p style={{ fontSize: 13, margin: '0 0 6px' }}>
            {t(lang, 'bodylab.mass')}
          </p>
          <button
            type="button"
            aria-pressed={config.estimatedMassKg === null}
            onClick={() =>
              set({
                estimatedMassKg:
                  config.estimatedMassKg === null ? 3500 : null,
              })
            }
            style={toggleStyle(config.estimatedMassKg === null)}
          >
            {t(lang, 'bodylab.massUnknown')}
          </button>
          {config.estimatedMassKg !== null && (
            <div style={{ marginTop: 8 }}>
              <Slider
                label=""
                value={config.estimatedMassKg}
                min={2500}
                max={6000}
                step={50}
                unit="kg"
                popKey={popKey}
                onRelease={onRelease}
                onPick={(estimatedMassKg) => set({ estimatedMassKg })}
              />
            </div>
          )}
        </section>
        <p style={{ fontSize: 13, margin: 0 }}>
          {t(lang, 'bodylab.openHeight', {
            value: openHeightMm(config),
          })}
        </p>
        <section aria-label={t(lang, 'bodylab.constraints')}>
          <h4 style={{ margin: '4px 0 8px', fontSize: 14 }}>
            {t(lang, 'bodylab.constraints')}
          </h4>
          <ul
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              margin: 0,
              padding: 0,
              listStyle: 'none',
            }}
          >
            {results.map((result) => {
              const Icon = LEVEL_ICON[result.level];
              return (
                <li
                  key={result.code}
                  style={{
                    display: 'flex',
                    gap: 6,
                    alignItems: 'flex-start',
                    fontSize: 13,
                  }}
                >
                  <Icon size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>{t(lang, CONSTRAINT_KEY[result.code])}</span>
                </li>
              );
            })}
          </ul>
        </section>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {hasFail && (
            <button
              type="button"
              onClick={() => onChange(clampToLegal(config))}
              style={{
                padding: '8px 14px',
                borderRadius: 999,
                border: 'none',
                background: '#9e4b4b',
                color: '#fff',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {t(lang, 'bodylab.fixLegal')}
            </button>
          )}
          <button
            type="button"
            onClick={() => onChange({ ...DEFAULT_BODY_CONFIG })}
            style={{
              padding: '8px 14px',
              borderRadius: 999,
              border: '1px solid #c9bba6',
              background: 'transparent',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {t(lang, 'bodylab.resetDefaults')}
          </button>
        </div>
        <p style={{ fontSize: 12, margin: 0, opacity: 0.75 }}>
          {t(lang, 'bodylab.note')}
        </p>
      </div>
    </article>
  );
}

function toggleStyle(active: boolean): React.CSSProperties {
  return {
    padding: '8px 14px',
    borderRadius: 999,
    border: active ? 'none' : '1px solid #c9bba6',
    background: active ? '#9e4b4b' : 'transparent',
    color: active ? '#fff' : 'inherit',
    fontSize: 13,
    cursor: 'pointer',
  };
}

function Segmented<T extends string>({
  options,
  active,
  onPick,
}: {
  options: { value: T; label: string }[];
  active: T;
  onPick: (value: T) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === active}
          onClick={() => onPick(option.value)}
          style={toggleStyle(option.value === active)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  popKey,
  onRelease,
  onPick,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  popKey: number;
  onRelease: () => void;
  onPick: (value: number) => void;
}) {
  const safeMax = Math.max(max, min + step);
  const safeValue = Math.min(Math.max(value, min), safeMax);
  return (
    <section>
      <p
        style={{
          fontSize: 13,
          margin: '0 0 4px',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>{label}</span>
        <strong key={popKey} className="bodylab-pop">
          {safeValue} {unit}
        </strong>
      </p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 12, opacity: 0.6 }}>{min}</span>
        <input
          type="range"
          aria-label={label}
          min={min}
          max={safeMax}
          step={step}
          value={safeValue}
          onChange={(event) => onPick(Number(event.target.value))}
          onPointerUp={onRelease}
          onKeyUp={onRelease}
          style={{ flex: 1, accentColor: '#9e4b4b' }}
        />
        <span style={{ fontSize: 12, opacity: 0.6 }}>{safeMax}</span>
      </div>
    </section>
  );
}
