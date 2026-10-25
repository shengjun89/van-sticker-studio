import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  DEFAULT_BODY_CONFIG,
  KIND_DEFAULTS,
  repairAttachments,
  roofFixtureClashes,
  type BodyConfig,
} from '../lib/parametric-body.ts';
import {
  MODEL_CATALOG,
  REQUIRED_REGISTRY_FIELDS,
  configForEntry,
  configForModelIn,
  entryForModel,
  isEntryComplete,
  isModelSelectableIn,
  registryStatusOf,
  type RegistryEntry,
} from '../lib/announcement-db.ts';

/** Shipped registry, read the same way node --test can read it. */
const shipped = JSON.parse(
  fs.readFileSync(
    new URL('../lib/announcement-db.json', import.meta.url),
    'utf8',
  ),
) as { version: number; entries: RegistryEntry[] };

const shippedEntries = shipped.entries;

const completeFixture: RegistryEntry = {
  id: 'fixture-complete',
  name: 'Fixture model (test only, not announcement data)',
  announcement_model: 'FIXTURE0001',
  announcement_batch: 999,
  chassis_model: 'FIXTURE-CHASSIS',
  status: 'complete',
  verified: {
    length_mm: 5000,
    width_mm: 2000,
    height_mm: 2500,
    wheelbase_mm: 3000,
    front_overhang_mm: 1000,
    rear_overhang_mm: 1000,
    gross_mass_kg: 3500,
  },
  source: 'test fixture',
  source_url: '',
  notes: 'Test-only row.',
};

void test('shipped registry carries only verified figures, no nulls', () => {
  assert.equal(shipped.version, 1);
  assert.ok(Array.isArray(shippedEntries));
  for (const entry of shippedEntries) {
    assert.ok(entry.id.length > 0);
    assert.ok(entry.announcement_model.length > 0);
    assert.ok(entry.source.length > 0);
    for (const [field, value] of Object.entries(entry.verified)) {
      assert.equal(
        typeof value,
        'number',
        `${entry.id}.${field} must be a verified number, not null`,
      );
      assert.ok(Number.isFinite(value as number));
    }
  }
});

void test('shipped inspection row matches the seed verified set', () => {
  const row = entryForModel(shippedEntries, 'sh5030xjca3d4');
  assert.ok(row !== undefined);
  assert.equal(row.announcement_model, 'SH5030XJCA3D4');
  assert.equal(row.announcement_batch, 233);
  assert.equal(row.chassis_model, 'SH6501A3D4');
  assert.equal(row.verified.length_mm, 5160);
  assert.equal(row.verified.rear_overhang_mm, 1195);
  assert.equal(row.verified.height_mm, 2132);
  // Unconfirmed fields are absent, not null placeholders.
  assert.equal(row.verified.width_mm, undefined);
  assert.equal(row.verified.wheelbase_mm, undefined);
  assert.equal(row.verified.front_overhang_mm, undefined);
  assert.equal(row.verified.gross_mass_kg, undefined);
  assert.equal(isEntryComplete(row), false);
});

void test('completeness needs every required field', () => {
  assert.equal(isEntryComplete(completeFixture), true);
  const missingMass: RegistryEntry = {
    ...completeFixture,
    verified: { ...completeFixture.verified, gross_mass_kg: undefined },
  };
  assert.equal(isEntryComplete(missingMass), false);
  const nullWidth = {
    ...completeFixture,
    verified: { ...completeFixture.verified, width_mm: null },
  } as unknown as RegistryEntry;
  assert.equal(isEntryComplete(nullWidth), false);
  for (const field of REQUIRED_REGISTRY_FIELDS) {
    assert.ok(
      field in completeFixture.verified,
      `required field ${field} missing from fixture`,
    );
  }
});

void test('catalog carries names and kinds only, ids unique', () => {
  const kinds = new Set(Object.keys(KIND_DEFAULTS));
  const ids = new Set<string>();
  for (const model of MODEL_CATALOG) {
    assert.ok(kinds.has(model.kind), `unknown kind for ${model.id}`);
    assert.ok(!ids.has(model.id), `duplicate catalog id ${model.id}`);
    ids.add(model.id);
  }
  assert.equal(
    MODEL_CATALOG.filter((model) => model.kind === 'motorhome-b').length,
    33,
  );
  assert.equal(MODEL_CATALOG.length, 54);
});

const V4_COMPLETE_IDS = [
  'sh6601h4db-s-h2525',
  'sh6601h4db-s-h2740',
  'sh6601h4db-s-h2480',
  'sh6601h4db-s-h2700',
  'sh6591h4db-h2735',
  'sh6591h4db-h2520',
  'sh6592h4db-h2740',
  'sh6592h4db-h2525',
  'sh6601h4db-ns-h2525',
  'sh6601h4db-ns-h2740',
  'sh6601h4db-ns-h2700',
  'sh6601h4db-ns-h2480',
  'sh6591h4db-ns-h2525',
  'sh6591h4db-ns-h2740',
  'sh6591h4db-ns-h2480',
  'sh6591h4db-ns-h2700',
  'sh6591h4db-s-h2525',
  'sh6591h4db-s-h2740',
  'sh6591h4db-s-h2480',
  'sh6591h4db-s-h2700',
  'sh6601a4db-h2372',
  'sh6601a4db-h2577',
  'sh6601a4db-n-h2372',
  'sh6601a4db-n-h2577',
];

void test('current gate state: 24 selectable variants, 11 partial rows', () => {
  assert.deepEqual(registryStatusOf(shippedEntries), {
    complete: 24,
    partial: 11,
  });
  for (const id of V4_COMPLETE_IDS) {
    assert.equal(
      isModelSelectableIn(shippedEntries, id),
      true,
      `${id} must be selectable`,
    );
  }
  for (const model of MODEL_CATALOG) {
    if (V4_COMPLETE_IDS.includes(model.id)) continue;
    assert.equal(
      isModelSelectableIn(shippedEntries, model.id),
      false,
      `${model.id} must not be selectable yet`,
    );
  }
  assert.equal(isModelSelectableIn(shippedEntries, 'sh5030xjca3d4'), false);
  assert.equal(isModelSelectableIn(shippedEntries, 'unknown-model'), false);
});

void test('configForModelIn builds configs only for complete rows', () => {
  for (const model of MODEL_CATALOG) {
    if (V4_COMPLETE_IDS.includes(model.id)) continue;
    assert.equal(configForModelIn(shippedEntries, model.id), null);
  }
  assert.equal(configForModelIn(shippedEntries, 'nope'), null);
  const config = configForModelIn(shippedEntries, 'sh6601h4db-s-h2525');
  assert.ok(config !== null);
  assert.equal(config.lengthMm, 6005);
  assert.equal(config.widthMm, 2110);
  assert.equal(config.heightMm, 2525);
  assert.equal(config.wheelbaseMm, 3760);
  assert.equal(config.estimatedMassKg, 4250);
  assert.equal(config.chassis, 'SH6601H4DB-S');
});

void test('v4 variant rows split by height only, never paired across fields', () => {
  const byModel = new Map<string, RegistryEntry[]>();
  for (const entry of shippedEntries) {
    if (!V4_COMPLETE_IDS.includes(entry.id)) continue;
    const list = byModel.get(entry.announcement_model) ?? [];
    list.push(entry);
    byModel.set(entry.announcement_model, list);
  }
  const heightOptions: Record<string, number[]> = {
    SH6601H4DB_S: [2525, 2740, 2480, 2700],
    SH6591H4DB: [2735, 2520],
    SH6592H4DB: [2740, 2525],
    SH6601H4DB_NS: [2525, 2740, 2700, 2480],
    SH6591H4DB_NS: [2525, 2740, 2480, 2700],
    SH6591H4DB_S: [2525, 2740, 2480, 2700],
    SH6601A4DB: [2372, 2577],
    SH6601A4DB_N: [2372, 2577],
  };
  const singles: Record<
    string,
    {
      length: number;
      width: number;
      wb: number;
      f: number;
      r: number;
      gm: number;
    }
  > = {
    SH6601H4DB_S: {
      length: 6005,
      width: 2110,
      wb: 3760,
      f: 1020,
      r: 1225,
      gm: 4250,
    },
    SH6591H4DB: {
      length: 5940,
      width: 2062,
      wb: 3760,
      f: 1020,
      r: 1160,
      gm: 4000,
    },
    SH6592H4DB: {
      length: 5940,
      width: 2062,
      wb: 3760,
      f: 1020,
      r: 1160,
      gm: 4000,
    },
    SH6601H4DB_NS: {
      length: 6005,
      width: 2110,
      wb: 3760,
      f: 1020,
      r: 1225,
      gm: 4250,
    },
    SH6591H4DB_NS: {
      length: 5940,
      width: 2110,
      wb: 3760,
      f: 1020,
      r: 1160,
      gm: 4250,
    },
    SH6591H4DB_S: {
      length: 5940,
      width: 2110,
      wb: 3760,
      f: 1020,
      r: 1160,
      gm: 4250,
    },
    SH6601A4DB: {
      length: 5995,
      width: 1998,
      wb: 4175,
      f: 845,
      r: 975,
      gm: 4100,
    },
    SH6601A4DB_N: {
      length: 5995,
      width: 1998,
      wb: 4175,
      f: 845,
      r: 975,
      gm: 4100,
    },
  };
  const keyOf = (model: string) => model.replace(/-/g, '_');
  for (const [model, rows] of byModel) {
    const key = keyOf(model);
    assert.deepEqual(
      rows.map((row) => row.verified.height_mm),
      heightOptions[key],
      `${model} heights must follow announcement order`,
    );
    for (const row of rows) {
      const s = singles[key];
      assert.equal(row.verified.length_mm, s.length);
      assert.equal(row.verified.width_mm, s.width);
      assert.equal(row.verified.wheelbase_mm, s.wb);
      assert.equal(row.verified.front_overhang_mm, s.f);
      assert.equal(row.verified.rear_overhang_mm, s.r);
      assert.equal(row.verified.gross_mass_kg, s.gm);
      assert.equal(row.chassis_model, '承载式车身');
    }
  }
  assert.equal(byModel.size, 8);
});

void test('v4 partial rows carry only single-valued fields', () => {
  const rv = entryForModel(shippedEntries, 'sh5043xljh9db-c');
  assert.ok(rv !== undefined);
  assert.equal(rv.announcement_model, 'SH5043XLJH9DB-C');
  assert.equal(rv.announcement_batch, 374);
  assert.equal(rv.chassis_model, 'SH1043H7DB-PS');
  assert.equal(rv.verified.length_mm, 5990);
  assert.equal(rv.verified.front_overhang_mm, 1020);
  assert.equal(rv.verified.rear_overhang_mm, 1210);
  assert.equal(rv.verified.gross_mass_kg, 4495);
  // Wheelbase is blank in the official text; width/height are option lists.
  assert.equal(rv.verified.wheelbase_mm, undefined);
  assert.equal(rv.verified.width_mm, undefined);
  assert.equal(rv.verified.height_mm, undefined);
  assert.equal(isEntryComplete(rv), false);
  const multi = entryForModel(shippedEntries, 'sh6631a4db');
  assert.ok(multi !== undefined);
  assert.equal(multi.verified.width_mm, 1998);
  assert.equal(multi.verified.wheelbase_mm, 4180);
  assert.equal(multi.verified.front_overhang_mm, 865);
  assert.equal(multi.verified.gross_mass_kg, 4180);
  assert.equal(multi.verified.length_mm, undefined);
  assert.equal(multi.verified.height_mm, undefined);
  assert.equal(multi.verified.rear_overhang_mm, undefined);
  assert.equal(isEntryComplete(multi), false);
});

void test('no new row claims the SH6501A3D4 chassis; seats units stay unknown where unmarked', () => {
  for (const entry of shippedEntries) {
    if (entry.id === 'sh5030xjca3d4') continue;
    assert.notEqual(
      entry.chassis_model,
      'SH6501A3D4',
      `${entry.id} must not claim SH6501A3D4`,
    );
  }
  for (const id of ['sh6631a4db-n', 'sh6501a4db-n', 'sh6571a4db-n']) {
    const row = entryForModel(shippedEntries, id);
    assert.ok(row !== undefined);
    assert.match(row.notes, /载客单位/);
  }
  for (const id of ['sh6601a4db-h2372', 'sh6601a4db-n-h2577']) {
    const row = entryForModel(shippedEntries, id);
    assert.ok(row !== undefined);
    assert.match(row.notes, /载客单位/);
  }
});

void test('configForEntry builds a registry-driven config', () => {
  const model = MODEL_CATALOG.find(
    (candidate) => candidate.id === 'motorhome-b-01',
  );
  assert.ok(model !== undefined);
  const config = configForEntry(model, completeFixture);
  assert.ok(config !== null);
  assert.equal(config.lengthMm, 5000);
  assert.equal(config.widthMm, 2000);
  assert.equal(config.heightMm, 2500);
  assert.equal(config.wheelbaseMm, 3000);
  assert.equal(config.estimatedMassKg, 3500);
  assert.equal(config.chassis, 'FIXTURE0001');
  assert.deepEqual(config.slideOuts, []);
  assert.deepEqual(config.accessories, []);
  assert.deepEqual(config.roofFixtures, []);
  // A partial row never builds a config.
  const partial = entryForModel(shippedEntries, 'sh5030xjca3d4');
  assert.ok(partial !== undefined);
  assert.equal(configForEntry(model, partial), null);
});

void test('repairAttachments never moves dimensions or mass', () => {
  const base: BodyConfig = {
    ...DEFAULT_BODY_CONFIG,
    roofType: 'pop-up',
    popUpOpen: true,
    slideOuts: [
      // Center -44 sits in the gap between the door and the rear
      // window, so it survives repair with only its depth clamped.
      { side: 'left', centerMm: -44, lengthMm: 1200, depthMm: 9999 },
    ],
    accessories: [{ id: 'awning', positionMm: 99999 }],
    roofFixtures: [{ kind: 'vent', positionMm: 0 }],
  };
  assert.equal(roofFixtureClashes(base, 0), true);
  const repaired = repairAttachments(base);
  assert.equal(repaired.lengthMm, base.lengthMm);
  assert.equal(repaired.widthMm, base.widthMm);
  assert.equal(repaired.heightMm, base.heightMm);
  assert.equal(repaired.wheelbaseMm, base.wheelbaseMm);
  assert.equal(repaired.estimatedMassKg, base.estimatedMassKg);
  assert.equal(repaired.slideOuts[0]?.depthMm, 800);
  assert.ok(
    Math.abs(repaired.accessories[0]?.positionMm ?? 99999) <= base.lengthMm / 2,
  );
  assert.equal(
    repaired.roofFixtures.some((fixture) =>
      roofFixtureClashes(repaired, fixture.positionMm),
    ),
    false,
  );
});
