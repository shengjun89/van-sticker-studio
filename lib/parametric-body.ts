/**
 * Parametric body configuration for the body-config panel (see
 * ~/workspace/goals/mxgarage/files/参数化车体配置面板方案.md).
 *
 * Slice 1 scope: SAIC Maxus V80, body type B only. Other chassis and body
 * types (C / T / towables / A) arrive as later slices.
 *
 * PROTOTYPE PLACEHOLDER DIMENSIONS: the reference size (5840 x 2220 x 3050)
 * is measured from the shipped V80 asset (motion_metadata.json). Wheelbase
 * presets, roof height deltas and the travel/angle ranges are prototype
 * parameters, NOT announcement figures. They must be replaced by the
 * announcement database before this panel is used for real quotes.
 * The panel UI carries the same warning.
 */

export type WheelbaseClass = 'short' | 'medium' | 'long';

export type RoofType =
  | 'flat'
  | 'low'
  | 'high'
  | 'semi-high'
  | 'pop-up'
  | 'sloped-pop-up'
  | 'split-pop-up';

export interface BodyConfig {
  chassis: 'v80';
  bodyType: 'B';
  wheelbaseClass: WheelbaseClass;
  wheelbaseMm: number;
  lengthMm: number;
  widthMm: number;
  /** Closed body height (roof down). */
  heightMm: number;
  roofType: RoofType;
  popUpTravelMm: number;
  slopedAngleDeg: number;
  popUpOpen: boolean;
  /** Null when the user has not entered a mass estimate. */
  estimatedMassKg: number | null;
}

/** Prototype wheelbase presets (mm). See placeholder note above. */
export const WHEELBASE_PRESETS_MM: Record<WheelbaseClass, number> = {
  short: 3000,
  medium: 3400,
  long: 3750,
};

/** Closed-height preset (mm) each roof type snaps to when selected. */
export const ROOF_CLOSED_HEIGHT_MM: Record<RoofType, number> = {
  flat: 2500,
  low: 2600,
  'semi-high': 2850,
  high: 3050,
  'pop-up': 2600,
  'sloped-pop-up': 2600,
  'split-pop-up': 2600,
};

export const DEFAULT_BODY_CONFIG: BodyConfig = {
  chassis: 'v80',
  bodyType: 'B',
  wheelbaseClass: 'long',
  wheelbaseMm: WHEELBASE_PRESETS_MM.long,
  lengthMm: 5840,
  widthMm: 2220,
  heightMm: ROOF_CLOSED_HEIGHT_MM.high,
  roofType: 'high',
  popUpTravelMm: 450,
  slopedAngleDeg: 12,
  popUpOpen: false,
  estimatedMassKg: null,
};

const POP_UP_TYPES: readonly RoofType[] = [
  'pop-up',
  'sloped-pop-up',
  'split-pop-up',
];

export function isPopUpRoof(roofType: RoofType): boolean {
  return (POP_UP_TYPES as readonly RoofType[]).includes(roofType);
}

/** Open height (mm): closed height plus pop-up travel when open. */
export function openHeightMm(config: BodyConfig): number {
  if (isPopUpRoof(config.roofType) && config.popUpOpen)
    return config.heightMm + config.popUpTravelMm;
  return config.heightMm;
}

export type ConstraintLevel = 'pass' | 'warn' | 'fail';

export interface ConstraintResult {
  level: ConstraintLevel;
  /** Stable code; the panel maps it to an i18n string. */
  code: string;
}

export const BLUE_PLATE_MAX_LENGTH_MM = 6000;
export const BLUE_PLATE_MAX_MASS_KG = 4500;
export const ROAD_REFERENCE_MAX_HEIGHT_MM = 4000;
export const MAX_BODY_WIDTH_MM = 2550;
export const POP_UP_TRAVEL_MAX_MM = 600;
export const SLOPED_ANGLE_MIN_DEG = 5;
export const SLOPED_ANGLE_MAX_DEG = 25;
export const MIN_TOTAL_OVERHANG_MM = 800;

/**
 * Constraint engine (doc section 3). Pure function, fully unit-tested.
 * Rules: blue-plate length line, blue-plate mass line (when a mass estimate
 * is given), road reference height line, wheelbase-vs-length, pop-up travel
 * range, sloped angle range, body width line.
 */
export function checkBodyConstraints(config: BodyConfig): ConstraintResult[] {
  const results: ConstraintResult[] = [];
  results.push({
    level:
      config.lengthMm <= BLUE_PLATE_MAX_LENGTH_MM ? 'pass' : 'fail',
    code:
      config.lengthMm <= BLUE_PLATE_MAX_LENGTH_MM
        ? 'blue-length-ok'
        : 'blue-length-over',
  });
  if (config.estimatedMassKg === null) {
    results.push({ level: 'warn', code: 'mass-unknown' });
  } else {
    results.push({
      level:
        config.estimatedMassKg <= BLUE_PLATE_MAX_MASS_KG ? 'pass' : 'fail',
      code:
        config.estimatedMassKg <= BLUE_PLATE_MAX_MASS_KG
          ? 'mass-ok'
          : 'mass-over',
    });
  }
  results.push({
    level:
      openHeightMm(config) <= ROAD_REFERENCE_MAX_HEIGHT_MM
        ? 'pass'
        : 'fail',
    code:
      openHeightMm(config) <= ROAD_REFERENCE_MAX_HEIGHT_MM
        ? 'height-ok'
        : 'height-over',
  });
  results.push({
    level:
      config.wheelbaseMm <= config.lengthMm - MIN_TOTAL_OVERHANG_MM
        ? 'pass'
        : 'fail',
    code:
      config.wheelbaseMm <= config.lengthMm - MIN_TOTAL_OVERHANG_MM
        ? 'wheelbase-ok'
        : 'wheelbase-over',
  });
  if (isPopUpRoof(config.roofType)) {
    results.push({
      level:
        config.popUpTravelMm >= 0 &&
        config.popUpTravelMm <= POP_UP_TRAVEL_MAX_MM
          ? 'pass'
          : 'fail',
      code:
        config.popUpTravelMm >= 0 &&
        config.popUpTravelMm <= POP_UP_TRAVEL_MAX_MM
          ? 'travel-ok'
          : 'travel-range',
    });
  }
  if (config.roofType === 'sloped-pop-up') {
    results.push({
      level:
        config.slopedAngleDeg >= SLOPED_ANGLE_MIN_DEG &&
        config.slopedAngleDeg <= SLOPED_ANGLE_MAX_DEG
          ? 'pass'
          : 'fail',
      code:
        config.slopedAngleDeg >= SLOPED_ANGLE_MIN_DEG &&
        config.slopedAngleDeg <= SLOPED_ANGLE_MAX_DEG
          ? 'angle-ok'
          : 'angle-range',
    });
  }
  results.push({
    level: config.widthMm <= MAX_BODY_WIDTH_MM ? 'pass' : 'fail',
    code:
      config.widthMm <= MAX_BODY_WIDTH_MM ? 'width-ok' : 'width-over',
  });
  return results;
}

/** True when every constraint passes (warnings allowed). */
export function constraintsAllowBuild(results: ConstraintResult[]): boolean {
  return results.every((result) => result.level !== 'fail');
}

/**
 * One-tap recovery for the panel's "restore legal values" button: clamp
 * every field into its legal range. Mass stays unknown when it was
 * unknown; open height is fixed by trimming travel (closed height itself
 * never exceeds the road reference through the panel's sliders).
 */
export function clampToLegal(config: BodyConfig): BodyConfig {
  const lengthMm = Math.min(config.lengthMm, BLUE_PLATE_MAX_LENGTH_MM);
  const next: BodyConfig = {
    ...config,
    lengthMm,
    widthMm: Math.min(config.widthMm, MAX_BODY_WIDTH_MM),
    wheelbaseMm: Math.min(
      config.wheelbaseMm,
      lengthMm - MIN_TOTAL_OVERHANG_MM,
    ),
    popUpTravelMm: Math.max(
      0,
      Math.min(config.popUpTravelMm, POP_UP_TRAVEL_MAX_MM),
    ),
    slopedAngleDeg: Math.max(
      SLOPED_ANGLE_MIN_DEG,
      Math.min(config.slopedAngleDeg, SLOPED_ANGLE_MAX_DEG),
    ),
    estimatedMassKg:
      config.estimatedMassKg === null
        ? null
        : Math.min(config.estimatedMassKg, BLUE_PLATE_MAX_MASS_KG),
  };
  if (
    isPopUpRoof(next.roofType) &&
    next.popUpOpen &&
    next.heightMm + next.popUpTravelMm > ROAD_REFERENCE_MAX_HEIGHT_MM
  ) {
    next.popUpTravelMm = Math.max(
      0,
      ROAD_REFERENCE_MAX_HEIGHT_MM - next.heightMm,
    );
  }
  return next;
}
