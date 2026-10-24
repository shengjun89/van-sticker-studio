import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_BODY_CONFIG,
  ROOF_CLOSED_HEIGHT_MM,
  checkBodyConstraints,
  constraintsAllowBuild,
  openHeightMm,
  type BodyConfig,
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

void test('width limit is 2550 mm and build is blocked by any fail', () => {
  assert.equal(code({ ...base, widthMm: 2550 }, 'width-ok')?.level, 'pass');
  assert.equal(code({ ...base, widthMm: 2551 }, 'width-over')?.level, 'fail');
  assert.equal(constraintsAllowBuild(checkBodyConstraints(base)), true);
  assert.equal(
    constraintsAllowBuild(checkBodyConstraints({ ...base, lengthMm: 6100 })),
    false,
  );
});
