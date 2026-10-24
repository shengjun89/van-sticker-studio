/**
 * Parametric body configuration for the body-config panel (see
 * ~/workspace/goals/mxgarage/files/参数化车体配置面板方案.md).
 *
 * Slice 3 scope: every vehicle kind in the scheme doc's taxonomy —
 * motorhome A / B / C / T, towable A / B / C / D, camper / bed car,
 * micro-truck C, off-road. The panel's sliders follow a per-kind
 * envelope, and the constraint engine treats blue-plate lines as
 * applying only to blue-plate kinds.
 *
 * PROTOTYPE ENVELOPES, NOT ANNOUNCEMENT FIGURES: the per-kind ranges
 * below are plausible market/regulation envelopes (road limits
 * width 2550 mm and height 4000 mm; blue-plate lines 6000 mm /
 * 4500 kg), chosen so every slider stays in a reasonable range for its
 * kind. They must be replaced by the announcement database before this
 * panel is used for real quotes. The panel UI carries the same warning.
 * The V80 B reference size (5840 x 2220 x 3050) is measured from the
 * shipped V80 asset (motion_metadata.json).
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

/**
 * Vehicle kinds from the scheme doc section 1. Towable kinds have no
 * wheelbase: their wheelbaseMm field stores the hitch-to-axle distance
 * instead, which is what the trailer schematic places its wheels by.
 */
export type VehicleKind =
  | 'motorhome-a'
  | 'motorhome-b'
  | 'motorhome-c'
  | 'motorhome-t'
  | 'towable-a'
  | 'towable-b'
  | 'towable-c'
  | 'towable-d'
  | 'camper'
  | 'micro-c'
  | 'offroad';

export const MOTORHOME_KINDS: readonly VehicleKind[] = [
  'motorhome-a',
  'motorhome-b',
  'motorhome-c',
  'motorhome-t',
];

export const TOWABLE_KINDS: readonly VehicleKind[] = [
  'towable-a',
  'towable-b',
  'towable-c',
  'towable-d',
];

export const OTHER_KINDS: readonly VehicleKind[] = [
  'camper',
  'micro-c',
  'offroad',
];

export function isTowableKind(kind: VehicleKind): boolean {
  return (TOWABLE_KINDS as readonly VehicleKind[]).includes(kind);
}

/** Kinds the blue-plate lines (6000 mm / 4500 kg) apply to. */
export function isBluePlateKind(kind: VehicleKind): boolean {
  return (
    kind === 'motorhome-b' ||
    kind === 'motorhome-c' ||
    kind === 'motorhome-t' ||
    kind === 'camper' ||
    kind === 'micro-c' ||
    kind === 'offroad'
  );
}

export interface BodyConfig {
  /** Logic driver for envelopes, constraints and the schematic. */
  vehicleKind: VehicleKind;
  /** Free chassis label; the panel shows per-kind examples, not this. */
  chassis: string;
  /** Display label (A / B / C / T / towable / camper / ...). */
  bodyType: string;
  wheelbaseClass: WheelbaseClass;
  /** Wheelbase, or hitch-to-axle distance for towable kinds. */
  wheelbaseMm: number;
  /** Overall length, or trailer body length for towable kinds. */
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

/** Prototype wheelbase presets (mm) for motorhome B. */
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

export interface VehicleEnvelope {
  lengthMinMm: number;
  lengthMaxMm: number;
  widthMinMm: number;
  widthMaxMm: number;
  heightMinMm: number;
  heightMaxMm: number;
  wheelbaseMinMm: number;
  wheelbaseMaxMm: number;
  massMinKg: number;
  massMaxKg: number;
}

/**
 * Per-kind slider envelopes (prototype, see header). Blue-plate kinds
 * deliberately extend past the 6000 mm / 4500 kg lines so the
 * yellow-plate warning stays visible; road-limit kinds cap at the
 * road limits. Towable wheelbase bounds are hitch-to-axle ranges; the
 * panel additionally caps them at hitch + body length.
 */
export const VEHICLE_ENVELOPES: Record<VehicleKind, VehicleEnvelope> = {
  'motorhome-a': {
    lengthMinMm: 7000,
    lengthMaxMm: 12000,
    widthMinMm: 2200,
    widthMaxMm: 2550,
    heightMinMm: 2800,
    heightMaxMm: 4000,
    wheelbaseMinMm: 3800,
    wheelbaseMaxMm: 6500,
    massMinKg: 5000,
    massMaxKg: 12000,
  },
  'motorhome-b': {
    lengthMinMm: 4000,
    lengthMaxMm: 6500,
    widthMinMm: 1800,
    widthMaxMm: 2550,
    heightMinMm: 2000,
    heightMaxMm: 3500,
    wheelbaseMinMm: 2500,
    wheelbaseMaxMm: 4200,
    massMinKg: 2500,
    massMaxKg: 6000,
  },
  'motorhome-c': {
    lengthMinMm: 5000,
    lengthMaxMm: 7000,
    widthMinMm: 2000,
    widthMaxMm: 2550,
    heightMinMm: 2800,
    heightMaxMm: 3500,
    wheelbaseMinMm: 2800,
    wheelbaseMaxMm: 4200,
    massMinKg: 3500,
    massMaxKg: 7500,
  },
  'motorhome-t': {
    lengthMinMm: 4800,
    lengthMaxMm: 6000,
    widthMinMm: 1800,
    widthMaxMm: 2200,
    heightMinMm: 2400,
    heightMaxMm: 3200,
    wheelbaseMinMm: 2800,
    wheelbaseMaxMm: 3600,
    massMinKg: 2500,
    massMaxKg: 4500,
  },
  'towable-a': {
    lengthMinMm: 6000,
    lengthMaxMm: 10000,
    widthMinMm: 2000,
    widthMaxMm: 2550,
    heightMinMm: 2400,
    heightMaxMm: 3200,
    wheelbaseMinMm: 800,
    wheelbaseMaxMm: 9000,
    massMinKg: 1500,
    massMaxKg: 4500,
  },
  'towable-b': {
    lengthMinMm: 3500,
    lengthMaxMm: 6500,
    widthMinMm: 1800,
    widthMaxMm: 2500,
    heightMinMm: 2000,
    heightMaxMm: 3000,
    wheelbaseMinMm: 800,
    wheelbaseMaxMm: 8000,
    massMinKg: 700,
    massMaxKg: 2500,
  },
  'towable-c': {
    lengthMinMm: 3500,
    lengthMaxMm: 6000,
    widthMinMm: 1800,
    widthMaxMm: 2400,
    heightMinMm: 1600,
    heightMaxMm: 2600,
    wheelbaseMinMm: 800,
    wheelbaseMaxMm: 7500,
    massMinKg: 700,
    massMaxKg: 2000,
  },
  'towable-d': {
    lengthMinMm: 2500,
    lengthMaxMm: 4500,
    widthMinMm: 1500,
    widthMaxMm: 2100,
    heightMinMm: 1600,
    heightMaxMm: 2400,
    wheelbaseMinMm: 800,
    wheelbaseMaxMm: 6000,
    massMinKg: 400,
    massMaxKg: 1200,
  },
  camper: {
    lengthMinMm: 3500,
    lengthMaxMm: 5000,
    widthMinMm: 1600,
    widthMaxMm: 2000,
    heightMinMm: 1700,
    heightMaxMm: 2200,
    wheelbaseMinMm: 2200,
    wheelbaseMaxMm: 3200,
    massMinKg: 1500,
    massMaxKg: 3000,
  },
  'micro-c': {
    lengthMinMm: 3500,
    lengthMaxMm: 4500,
    widthMinMm: 1500,
    widthMaxMm: 1900,
    heightMinMm: 2400,
    heightMaxMm: 2900,
    wheelbaseMinMm: 2000,
    wheelbaseMaxMm: 2800,
    massMinKg: 1500,
    massMaxKg: 3000,
  },
  offroad: {
    lengthMinMm: 4200,
    lengthMaxMm: 5600,
    widthMinMm: 1800,
    widthMaxMm: 2100,
    heightMinMm: 1900,
    heightMaxMm: 2400,
    wheelbaseMinMm: 2400,
    wheelbaseMaxMm: 3200,
    massMinKg: 2000,
    massMaxKg: 3500,
  },
};

/** Trailer hitch bar length (mm), front of the body to the hitch head. */
export const TRAILER_HITCH_MM = 1200;

function kindConfig(
  vehicleKind: VehicleKind,
  chassis: string,
  bodyType: string,
  wheelbaseMm: number,
  lengthMm: number,
  widthMm: number,
  heightMm: number,
  roofType: RoofType,
): BodyConfig {
  return {
    vehicleKind,
    chassis,
    bodyType,
    wheelbaseClass: 'long',
    wheelbaseMm,
    lengthMm,
    widthMm,
    heightMm,
    roofType,
    popUpTravelMm: 450,
    slopedAngleDeg: 12,
    popUpOpen: false,
    estimatedMassKg: null,
  };
}

/** One default config per kind; switching kind restores its default. */
export const KIND_DEFAULTS: Record<VehicleKind, BodyConfig> = {
  'motorhome-a': kindConfig(
    'motorhome-a',
    'bus',
    'A',
    5000,
    9000,
    2500,
    3400,
    'high',
  ),
  'motorhome-b': {
    chassis: 'v80',
    bodyType: 'B',
    vehicleKind: 'motorhome-b',
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
  },
  'motorhome-c': kindConfig(
    'motorhome-c',
    'light-truck',
    'C',
    3300,
    5990,
    2300,
    3100,
    'high',
  ),
  'motorhome-t': kindConfig(
    'motorhome-t',
    'pickup',
    'T',
    3200,
    5300,
    2000,
    2800,
    'flat',
  ),
  'towable-a': kindConfig(
    'towable-a',
    'trailer',
    'towable',
    5300,
    7500,
    2400,
    2800,
    'high',
  ),
  'towable-b': kindConfig(
    'towable-b',
    'trailer',
    'towable',
    3700,
    5000,
    2200,
    2600,
    'high',
  ),
  'towable-c': kindConfig(
    'towable-c',
    'trailer',
    'towable',
    3450,
    4500,
    2100,
    2200,
    'pop-up',
  ),
  'towable-d': kindConfig(
    'towable-d',
    'trailer',
    'towable',
    3000,
    3600,
    1900,
    2100,
    'flat',
  ),
  camper: kindConfig(
    'camper',
    'car',
    'camper',
    2700,
    4400,
    1750,
    1950,
    'low',
  ),
  'micro-c': kindConfig(
    'micro-c',
    'micro-truck',
    'micro-c',
    2400,
    4000,
    1700,
    2700,
    'high',
  ),
  offroad: kindConfig(
    'offroad',
    'offroad-4x4',
    'offroad',
    2800,
    4800,
    1900,
    2100,
    'flat',
  ),
};

export const DEFAULT_BODY_CONFIG: BodyConfig =
  KIND_DEFAULTS['motorhome-b'];

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
 * Blue-plate length/mass lines apply only to blue-plate kinds: A-type
 * buses and towables get an informational note instead, since their
 * management lines differ. The wheelbase rule is skipped for towables
 * (hitch-to-axle, not a wheelbase).
 */
export function checkBodyConstraints(config: BodyConfig): ConstraintResult[] {
  const results: ConstraintResult[] = [];
  if (isTowableKind(config.vehicleKind)) {
    results.push({ level: 'warn', code: 'towable-note' });
  } else if (config.vehicleKind === 'motorhome-a') {
    results.push({ level: 'warn', code: 'yellow-note' });
  } else {
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
          config.estimatedMassKg <= BLUE_PLATE_MAX_MASS_KG
            ? 'pass'
            : 'fail',
        code:
          config.estimatedMassKg <= BLUE_PLATE_MAX_MASS_KG
            ? 'mass-ok'
            : 'mass-over',
      });
    }
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
  if (!isTowableKind(config.vehicleKind)) {
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
  }
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
 * One-tap recovery for the panel's "restore legal values" button.
 * Blue-plate kinds get pulled back to the blue lines; A-type and
 * towable kinds keep their length (their lines differ) and only get
 * road-envelope fixes. Mass stays unknown when it was unknown; open
 * height is fixed by trimming travel.
 */
export function clampToLegal(config: BodyConfig): BodyConfig {
  const towable = isTowableKind(config.vehicleKind);
  const next: BodyConfig = {
    ...config,
    lengthMm: isBluePlateKind(config.vehicleKind)
      ? Math.min(config.lengthMm, BLUE_PLATE_MAX_LENGTH_MM)
      : config.lengthMm,
    widthMm: Math.min(config.widthMm, MAX_BODY_WIDTH_MM),
    wheelbaseMm: towable
      ? Math.max(
          800,
          Math.min(
            config.wheelbaseMm,
            TRAILER_HITCH_MM + config.lengthMm,
          ),
        )
      : Math.min(
          config.wheelbaseMm,
          config.lengthMm - MIN_TOTAL_OVERHANG_MM,
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
      config.estimatedMassKg === null ||
      !isBluePlateKind(config.vehicleKind)
        ? config.estimatedMassKg
        : Math.min(config.estimatedMassKg, BLUE_PLATE_MAX_MASS_KG),
  };
  if (isBluePlateKind(config.vehicleKind)) {
    next.wheelbaseMm = Math.min(
      next.wheelbaseMm,
      next.lengthMm - MIN_TOTAL_OVERHANG_MM,
    );
  }
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
