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
    9,
  );
  assert.equal(MODEL_CATALOG.length, 30);
});

void test('current gate state: zero selectable models, one partial row', () => {
  assert.deepEqual(registryStatusOf(shippedEntries), {
    complete: 0,
    partial: 1,
  });
  for (const model of MODEL_CATALOG) {
    assert.equal(
      isModelSelectableIn(shippedEntries, model.id),
      false,
      `${model.id} must not be selectable yet`,
    );
  }
  assert.equal(isModelSelectableIn(shippedEntries, 'sh5030xjca3d4'), false);
  assert.equal(isModelSelectableIn(shippedEntries, 'unknown-model'), false);
});

void test('configForModelIn returns null without a complete row', () => {
  for (const model of MODEL_CATALOG) {
    assert.equal(configForModelIn(shippedEntries, model.id), null);
  }
  assert.equal(configForModelIn(shippedEntries, 'nope'), null);
});

void test('configForEntry builds a registry-driven config', () => {
  const model = MODEL_CATALOG.find((candidate) => candidate.id === 'v80');
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
    Math.abs(repaired.accessories[0]?.positionMm ?? 99999) <=
      base.lengthMm / 2,
  );
  assert.equal(
    repaired.roofFixtures.some((fixture) =>
      roofFixtureClashes(repaired, fixture.positionMm),
    ),
    false,
  );
});
