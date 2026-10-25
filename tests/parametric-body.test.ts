import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_BODY_CONFIG,
  KIND_DEFAULTS,
  ROOF_CLOSED_HEIGHT_MM,
  SLIDE_OUT_MAX_COUNT,
  TRAILER_HITCH_MM,
  VEHICLE_ENVELOPES,
  accessoryPositionRange,
  checkBodyConstraints,
  clampToLegal,
  constraintsAllowBuild,
  defaultAccessoryPosition,
  intervalsOverlap,
  isTowableKind,
  openHeightMm,
  repairSlideOuts,
  resolveSlideOutCenter,
  sideOpenings,
  type BodyConfig,
  type SlideOut,
  type VehicleKind,
} from '../lib/parametric-body.ts';

const base: BodyConfig = { ...DEFAULT_BODY_CONFIG };
const code = (config: BodyConfig, wanted: string) =>
  checkBodyConstraints(config).find((result) => result.code === wanted);

void test('defaults are the B-type high-roof reference', () => {
  assert.equal(base.chassis, 'van-b');
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
  assert.equal(
    code({ ...base, lengthMm: 6000 }, 'blue-length-ok')?.level,
    'pass',
  );
  assert.equal(
    code({ ...base, lengthMm: 6001 }, 'blue-length-over')?.level,
    'fail',
  );
});

void test('mass rule warns when unknown and fails over 4500 kg', () => {
  assert.equal(code(base, 'mass-unknown')?.level, 'warn');
  assert.equal(
    code({ ...base, estimatedMassKg: 4500 }, 'mass-ok')?.level,
    'pass',
  );
  assert.equal(
    code({ ...base, estimatedMassKg: 4501 }, 'mass-over')?.level,
    'fail',
  );
});

void test('wheelbase must leave 800 mm of total overhang', () => {
  assert.equal(
    code({ ...base, lengthMm: 5840, wheelbaseMm: 3750 }, 'wheelbase-ok')?.level,
    'pass',
  );
  assert.equal(
    code({ ...base, lengthMm: 5840, wheelbaseMm: 5040 }, 'wheelbase-ok')?.level,
    'pass',
  );
  assert.equal(
    code({ ...base, lengthMm: 5840, wheelbaseMm: 5041 }, 'wheelbase-over')
      ?.level,
    'fail',
  );
});

void test('pop-up travel range is 0-600 mm and only applies to pop-up roofs', () => {
  const pop = { ...base, roofType: 'pop-up' as const, heightMm: 2600 };
  assert.equal(
    code({ ...pop, popUpTravelMm: 600 }, 'travel-ok')?.level,
    'pass',
  );
  assert.equal(
    code({ ...pop, popUpTravelMm: 601 }, 'travel-range')?.level,
    'fail',
  );
  assert.equal(code(base, 'travel-ok'), undefined);
});

void test('sloped angle range is 5-25 degrees and only applies to sloped roofs', () => {
  const sloped = {
    ...base,
    roofType: 'sloped-pop-up' as const,
    heightMm: 2600,
  };
  assert.equal(
    code({ ...sloped, slopedAngleDeg: 5 }, 'angle-ok')?.level,
    'pass',
  );
  assert.equal(
    code({ ...sloped, slopedAngleDeg: 25 }, 'angle-ok')?.level,
    'pass',
  );
  assert.equal(
    code({ ...sloped, slopedAngleDeg: 4 }, 'angle-range')?.level,
    'fail',
  );
  assert.equal(
    code({ ...sloped, slopedAngleDeg: 26 }, 'angle-range')?.level,
    'fail',
  );
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

void test('prototype side openings never overlap each other', () => {
  for (const lengthMm of [2500, 4400, 5840, 12000]) {
    const openings = sideOpenings({ ...base, lengthMm });
    assert.equal(openings.length, 3);
    for (let i = 0; i < openings.length; i++) {
      for (let j = i + 1; j < openings.length; j++) {
        assert.equal(
          intervalsOverlap(openings[i], openings[j]),
          false,
          `length ${lengthMm} openings ${i} and ${j}`,
        );
      }
    }
  }
});

void test('slide-out overlap fails on the door zone and passes clear of it', () => {
  const door = {
    ...base,
    slideOuts: [
      {
        side: 'left',
        centerMm: -1168,
        lengthMm: 1200,
        depthMm: 500,
      } as SlideOut,
    ],
  };
  assert.equal(code(door, 'slideout-overlap')?.level, 'fail');
  const clear = {
    ...base,
    slideOuts: [
      { side: 'left', centerMm: 0, lengthMm: 1200, depthMm: 500 } as SlideOut,
    ],
  };
  assert.equal(code(clear, 'slideout-ok')?.level, 'pass');
});

void test('slide-out overlap also catches same-side siblings and second rear', () => {
  const siblings = {
    ...base,
    slideOuts: [
      { side: 'left', centerMm: 0, lengthMm: 1200, depthMm: 500 },
      { side: 'left', centerMm: 500, lengthMm: 1200, depthMm: 500 },
    ] as SlideOut[],
  };
  assert.equal(code(siblings, 'slideout-overlap')?.level, 'fail');
  const twoRear = {
    ...base,
    slideOuts: [
      { side: 'rear', centerMm: 0, lengthMm: 1200, depthMm: 500 },
      { side: 'rear', centerMm: 0, lengthMm: 1200, depthMm: 500 },
    ] as SlideOut[],
  };
  assert.equal(code(twoRear, 'slideout-overlap')?.level, 'fail');
  const oneRear = {
    ...base,
    slideOuts: [
      { side: 'rear', centerMm: 0, lengthMm: 1200, depthMm: 500 } as SlideOut,
    ],
  };
  assert.equal(code(oneRear, 'slideout-ok')?.level, 'pass');
});

void test('slide-out count, depth and bounds rules', () => {
  const four = {
    ...base,
    slideOuts: [0, 1, 2, 3].map(
      () =>
        ({
          side: 'left',
          centerMm: 0,
          lengthMm: 600,
          depthMm: 500,
        }) as SlideOut,
    ),
  };
  assert.equal(code(four, 'slideout-count-over')?.level, 'fail');
  assert.equal(SLIDE_OUT_MAX_COUNT, 3);
  const shallow = {
    ...base,
    slideOuts: [
      { side: 'left', centerMm: 0, lengthMm: 1200, depthMm: 100 } as SlideOut,
    ],
  };
  assert.equal(code(shallow, 'slideout-depth-range')?.level, 'fail');
  const pastEnd = {
    ...base,
    slideOuts: [
      {
        side: 'left',
        centerMm: 2800,
        lengthMm: 1200,
        depthMm: 500,
      } as SlideOut,
    ],
  };
  assert.equal(code(pastEnd, 'slideout-bounds-range')?.level, 'fail');
});

void test('resolveSlideOutCenter snaps to the nearest legal edge', () => {
  const snapped = resolveSlideOutCenter(-1168, 1200, 'left', base, []);
  assert.ok(
    snapped !== null && Math.abs(snapped - -217.6) < 0.01,
    `snapped ${snapped}`,
  );
  assert.equal(resolveSlideOutCenter(0, 1200, 'left', base, []), 0);
  const sibling = {
    side: 'left',
    centerMm: 0,
    lengthMm: 1200,
    depthMm: 500,
  } as SlideOut;
  const dodged = resolveSlideOutCenter(500, 600, 'left', base, [sibling]);
  assert.ok(
    dodged !== null && Math.abs(dodged - 1906) < 0.01,
    `dodged ${dodged}`,
  );
  assert.equal(
    resolveSlideOutCenter(0, 2400, 'left', { ...base, lengthMm: 2500 }, []),
    null,
  );
  assert.equal(resolveSlideOutCenter(0, 1200, 'rear', base, []), null);
});

void test('repairSlideOuts snaps, dedups rear and drops the unplaceable', () => {
  const repaired = repairSlideOuts({
    ...base,
    slideOuts: [
      { side: 'left', centerMm: -1168, lengthMm: 1200, depthMm: 100 },
      { side: 'rear', centerMm: 0, lengthMm: 1200, depthMm: 500 },
      { side: 'left', centerMm: 0, lengthMm: 1200, depthMm: 900 },
      { side: 'rear', centerMm: 0, lengthMm: 1200, depthMm: 500 },
    ] as SlideOut[],
  });
  // Slice keeps the first three; the third (left, center 0) cannot dodge
  // both the snapped sibling and the rear window, so it is dropped.
  assert.equal(repaired.length, 2);
  assert.equal(repaired[0].depthMm, 200);
  assert.ok(
    Math.abs(repaired[0].centerMm - -217.6) < 0.01,
    `repaired center ${repaired[0].centerMm}`,
  );
  assert.equal(repaired.filter((s) => s.side === 'rear').length, 1);
  assert.equal(
    constraintsAllowBuild(
      checkBodyConstraints({ ...base, slideOuts: repaired }),
    ),
    true,
  );
});

void test('repairSlideOuts trims to three and clamps depth', () => {
  const trimmed = repairSlideOuts({
    ...base,
    slideOuts: [
      { side: 'left', centerMm: 0, lengthMm: 600, depthMm: 500 },
      { side: 'right', centerMm: 0, lengthMm: 600, depthMm: 500 },
      { side: 'rear', centerMm: 0, lengthMm: 600, depthMm: 500 },
      { side: 'left', centerMm: 0, lengthMm: 600, depthMm: 500 },
    ] as SlideOut[],
  });
  assert.equal(trimmed.length, 3);
  const clamped = repairSlideOuts({
    ...base,
    slideOuts: [
      { side: 'left', centerMm: 0, lengthMm: 1200, depthMm: 900 } as SlideOut,
    ],
  });
  assert.equal(clamped.length, 1);
  assert.equal(clamped[0].depthMm, 800);
  const deduped = repairSlideOuts({
    ...base,
    slideOuts: [
      { side: 'rear', centerMm: 0, lengthMm: 1200, depthMm: 500 },
      { side: 'rear', centerMm: 0, lengthMm: 1200, depthMm: 500 },
    ] as SlideOut[],
  });
  assert.equal(deduped.length, 1);
});

void test('roof fixture clash only counts for an open pop-up roof', () => {
  const popOpen = {
    ...base,
    roofType: 'pop-up' as const,
    heightMm: 2600,
    popUpOpen: true,
    popUpTravelMm: 450,
    roofFixtures: [{ kind: 'skylight' as const, positionMm: 0 }],
  };
  assert.equal(code(popOpen, 'roof-popup-clash')?.level, 'fail');
  const popClosed = { ...popOpen, popUpOpen: false };
  assert.equal(code(popClosed, 'roof-fixture-ok')?.level, 'pass');
  const flatOpen = {
    ...base,
    popUpOpen: true,
    roofFixtures: [{ kind: 'skylight' as const, positionMm: 0 }],
  };
  assert.equal(code(flatOpen, 'roof-fixture-ok')?.level, 'pass');
});

void test('clampToLegal repairs slide-outs, accessories and roof fixtures', () => {
  const messy: BodyConfig = {
    ...base,
    roofType: 'pop-up' as const,
    heightMm: 2600,
    popUpOpen: true,
    popUpTravelMm: 450,
    slideOuts: [
      { side: 'left', centerMm: -1168, lengthMm: 1200, depthMm: 100 },
      { side: 'rear', centerMm: 0, lengthMm: 1200, depthMm: 500 },
      { side: 'rear', centerMm: 0, lengthMm: 1200, depthMm: 500 },
    ] as SlideOut[],
    accessories: [
      { id: 'winch' as const, positionMm: 5000 },
      { id: 'bull-bar' as const, positionMm: 500 },
    ],
    roofFixtures: [{ kind: 'skylight' as const, positionMm: 0 }],
  };
  const fixed = clampToLegal(messy);
  assert.equal(fixed.slideOuts.length, 2);
  assert.equal(fixed.slideOuts[0].depthMm, 200);
  assert.equal(
    fixed.accessories.find((a) => a.id === 'winch')?.positionMm,
    810,
  );
  assert.equal(
    fixed.accessories.find((a) => a.id === 'bull-bar')?.positionMm,
    0,
  );
  assert.ok(
    Math.abs((fixed.roofFixtures[0]?.positionMm ?? 0) - -1461) < 0.01,
    `fixture ${fixed.roofFixtures[0]?.positionMm}`,
  );
  assert.equal(constraintsAllowBuild(checkBodyConstraints(fixed)), true);
});

void test('accessory position ranges follow mount and axis', () => {
  assert.deepEqual(accessoryPositionRange('snorkel', base), {
    minMm: -2920,
    maxMm: -1920,
  });
  assert.deepEqual(accessoryPositionRange('ladder', base), {
    minMm: -810,
    maxMm: 810,
  });
  assert.equal(accessoryPositionRange('bull-bar', base), null);
  assert.equal(defaultAccessoryPosition('snorkel', base), -2420);
  assert.equal(defaultAccessoryPosition('roof-rack', base), 0);
});
