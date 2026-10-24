import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_BODY_CONFIG,
  KIND_DEFAULTS,
  ROOF_CLOSED_HEIGHT_MM,
  TRAILER_HITCH_MM,
  VEHICLE_ENVELOPES,
  checkBodyConstraints,
  clampToLegal,
  constraintsAllowBuild,
  isTowableKind,
  openHeightMm,
  type BodyConfig,
  type VehicleKind,
} from '../lib/parametric-body.ts';

const base: BodyConfig = { ...DEFAULT_BODY_CONFIG };
const code = (config: BodyConfig, wanted: string) =>
  checkBodyConstraints(config).find((result) => result.code === wanted);

void test('defaults are the V80 B high-roof reference', () => {
  assert.equal(base.chassis, 'v80');
  assert.equal(base.bodyType, 'B');
  assert.equal(base.heightMm, 3050);
  assert.equal(base.roofType, 'high');
  assert.equal(ROOF_CLOSED_HEIGHT_MM['pop-up'], 2600);
});

void test('open height adds travel only for open pop-up roofs', () => {
  assert.equal(openHeightMm(base), 3050);
  const closed = { ...base, roofType: 'pop-up' as const, heightMm: 2600 };
  assert.equal(openHeightMm(closed), 2600);
  assert.equal(
    openHeightMm({ ...closed, popUpOpen: true, popUpTravelMm: 450 }),
    3050,
  );
});

void test('blue-plate length line is 6000 mm', () => {
  assert.equal(code({ ...base, lengthMm: 6000 }, 'blue-length-ok')?.level, 'pass');
  assert.equal(code({ ...base, lengthMm: 6001 }, 'blue-length-over')?.level, 'fail');
});

void test('mass rule warns when unknown and fails over 4500 kg', () => {
  assert.equal(code(base, 'mass-unknown')?.level, 'warn');
  assert.equal(code({ ...base, estimatedMassKg: 4500 }, 'mass-ok')?.level, 'pass');
  assert.equal(code({ ...base, estimatedMassKg: 4501 }, 'mass-over')?.level, 'fail');
});

void test('wheelbase must leave 800 mm of total overhang', () => {
  assert.equal(code({ ...base, lengthMm: 5840, wheelbaseMm: 3750 }, 'wheelbase-ok')?.level, 'pass');
  assert.equal(code({ ...base, lengthMm: 5840, wheelbaseMm: 5040 }, 'wheelbase-ok')?.level, 'pass');
  assert.equal(code({ ...base, lengthMm: 5840, wheelbaseMm: 5041 }, 'wheelbase-over')?.level, 'fail');
});

void test('pop-up travel range is 0-600 mm and only applies to pop-up roofs', () => {
  const pop = { ...base, roofType: 'pop-up' as const, heightMm: 2600 };
  assert.equal(code({ ...pop, popUpTravelMm: 600 }, 'travel-ok')?.level, 'pass');
  assert.equal(code({ ...pop, popUpTravelMm: 601 }, 'travel-range')?.level, 'fail');
  assert.equal(code(base, 'travel-ok'), undefined);
});

void test('sloped angle range is 5-25 degrees and only applies to sloped roofs', () => {
  const sloped = { ...base, roofType: 'sloped-pop-up' as const, heightMm: 2600 };
  assert.equal(code({ ...sloped, slopedAngleDeg: 5 }, 'angle-ok')?.level, 'pass');
  assert.equal(code({ ...sloped, slopedAngleDeg: 25 }, 'angle-ok')?.level, 'pass');
  assert.equal(code({ ...sloped, slopedAngleDeg: 4 }, 'angle-range')?.level, 'fail');
  assert.equal(code({ ...sloped, slopedAngleDeg: 26 }, 'angle-range')?.level, 'fail');
});

void test('clampToLegal pulls every field back into range at once', () => {
  const illegal: BodyConfig = {
    ...base,
    lengthMm: 6500,
    widthMm: 2600,
    wheelbaseMm: 5500,
    popUpTravelMm: 900,
    slopedAngleDeg: 40,
    estimatedMassKg: 6000,
  };
  const fixed = clampToLegal(illegal);
  assert.equal(fixed.lengthMm, 6000);
  assert.equal(fixed.widthMm, 2550);
  assert.equal(fixed.wheelbaseMm, 5200);
  assert.equal(fixed.popUpTravelMm, 600);
  assert.equal(fixed.slopedAngleDeg, 25);
  assert.equal(fixed.estimatedMassKg, 4500);
  assert.equal(constraintsAllowBuild(checkBodyConstraints(fixed)), true);
});

void test('clampToLegal trims travel for open height and keeps unknown mass', () => {
  const open = {
    ...base,
    roofType: 'pop-up' as const,
    heightMm: 3600,
    popUpOpen: true,
    popUpTravelMm: 600,
    estimatedMassKg: null,
  };
  const fixed = clampToLegal(open);
  assert.equal(fixed.popUpTravelMm, 400);
  assert.equal(fixed.estimatedMassKg, null);
});

void test('width limit is 2550 mm and build is blocked by any fail', () => {
  assert.equal(code({ ...base, widthMm: 2550 }, 'width-ok')?.level, 'pass');
  assert.equal(code({ ...base, widthMm: 2551 }, 'width-over')?.level, 'fail');
  assert.equal(constraintsAllowBuild(checkBodyConstraints(base)), true);
  assert.equal(
    constraintsAllowBuild(checkBodyConstraints({ ...base, lengthMm: 6100 })),
    false,
  );
});

void test('every kind default sits inside its envelope', () => {
  for (const kind of Object.keys(KIND_DEFAULTS) as VehicleKind[]) {
    const def = KIND_DEFAULTS[kind];
    const env = VEHICLE_ENVELOPES[kind];
    assert.ok(
      def.lengthMm >= env.lengthMinMm && def.lengthMm <= env.lengthMaxMm,
      `${kind} length`,
    );
    assert.ok(
      def.widthMm >= env.widthMinMm && def.widthMm <= env.widthMaxMm,
      `${kind} width`,
    );
    assert.ok(
      def.heightMm >= env.heightMinMm && def.heightMm <= env.heightMaxMm,
      `${kind} height`,
    );
    if (isTowableKind(kind)) {
      assert.ok(
        def.wheelbaseMm >= 800 &&
          def.wheelbaseMm <= TRAILER_HITCH_MM + def.lengthMm,
        `${kind} hitch-to-axle`,
      );
    } else {
      assert.ok(
        def.wheelbaseMm >= env.wheelbaseMinMm &&
          def.wheelbaseMm <= env.wheelbaseMaxMm &&
          def.wheelbaseMm <= def.lengthMm - 800,
        `${kind} wheelbase`,
      );
    }
  }
});

void test('every envelope respects the road limits', () => {
  for (const kind of Object.keys(VEHICLE_ENVELOPES) as VehicleKind[]) {
    const env = VEHICLE_ENVELOPES[kind];
    assert.ok(env.widthMaxMm <= 2550, `${kind} width cap`);
    assert.ok(env.heightMaxMm <= 4000, `${kind} height cap`);
    assert.ok(env.lengthMinMm < env.lengthMaxMm, `${kind} length range`);
  }
});

void test('blue-plate lines skip A-type buses and towables', () => {
  const bus = KIND_DEFAULTS['motorhome-a'];
  assert.equal(code(bus, 'yellow-note')?.level, 'warn');
  assert.equal(code(bus, 'blue-length-over'), undefined);
  assert.equal(constraintsAllowBuild(checkBodyConstraints(bus)), true);
  const trailer = KIND_DEFAULTS['towable-b'];
  assert.equal(code(trailer, 'towable-note')?.level, 'warn');
  assert.equal(code(trailer, 'blue-length-over'), undefined);
  assert.equal(code(trailer, 'wheelbase-ok'), undefined);
  assert.equal(constraintsAllowBuild(checkBodyConstraints(trailer)), true);
});

void test('clampToLegal keeps yellow-plate and towable lengths', () => {
  const bus = { ...KIND_DEFAULTS['motorhome-a'], widthMm: 2600 };
  const fixedBus = clampToLegal(bus);
  assert.equal(fixedBus.lengthMm, 9000);
  assert.equal(fixedBus.widthMm, 2550);
  const trailer = { ...KIND_DEFAULTS['towable-a'], lengthMm: 8000 };
  assert.equal(clampToLegal(trailer).lengthMm, 8000);
});
