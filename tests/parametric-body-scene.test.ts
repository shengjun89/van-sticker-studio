import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  DEFAULT_BODY_CONFIG,
  KIND_DEFAULTS,
  type VehicleKind,
} from '../lib/parametric-body.ts';
import {
  BOUNCE_DURATION_MS,
  bounceScale,
  buildParametricBody,
} from '../lib/parametric-body-scene.ts';

void test('bounce starts squashed, springs past rest size, then settles at 1', () => {
  const start = bounceScale(0);
  assert.ok(start.y < 1, 'starts squashed');
  assert.ok(start.x > 1, 'squash widens x/z');
  const mid = bounceScale(200);
  assert.ok(mid.y > 1, 'springs past rest size');
  const end = bounceScale(BOUNCE_DURATION_MS);
  assert.deepEqual(end, { x: 1, y: 1, z: 1 });
  assert.deepEqual(bounceScale(BOUNCE_DURATION_MS + 500), { x: 1, y: 1, z: 1 });
});

void test('schematic body spans the configured length and height', () => {
  const group = buildParametricBody(DEFAULT_BODY_CONFIG);
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  // Length is exact (rear + cab boxes); height is the closed height plus
  // the 0.08 roof slab sitting on top.
  assert.ok(Math.abs(size.x - 5.84) < 0.01, `length ${size.x}`);
  assert.ok(Math.abs(size.y - 3.13) < 0.02, `height ${size.y}`);
  assert.ok(group.children.length > 10);
});

void test('schematic body builds for every vehicle kind', () => {
  for (const kind of Object.keys(KIND_DEFAULTS) as VehicleKind[]) {
    const group = buildParametricBody(KIND_DEFAULTS[kind]);
    assert.ok(group.children.length > 0, kind);
  }
});

void test('bus, C-type and pickup bodies span their configured length', () => {
  for (const kind of ['motorhome-a', 'motorhome-c', 'motorhome-t'] as const) {
    const config = KIND_DEFAULTS[kind];
    const group = buildParametricBody(config);
    group.updateMatrixWorld(true);
    const size = new THREE.Box3()
      .setFromObject(group)
      .getSize(new THREE.Vector3());
    assert.ok(
      Math.abs(size.x - config.lengthMm / 1000) < 0.01,
      `${kind} length ${size.x}`,
    );
  }
});

void test('trailer body spans body length plus the hitch bar', () => {
  const config = KIND_DEFAULTS['towable-b'];
  const group = buildParametricBody(config);
  group.updateMatrixWorld(true);
  const size = new THREE.Box3()
    .setFromObject(group)
    .getSize(new THREE.Vector3());
  assert.ok(
    Math.abs(size.x - (config.lengthMm + 1200) / 1000) < 0.05,
    `trailer length ${size.x}`,
  );
});

void test('schematic body builds for every roof type, open and closed', () => {
  const roofs = [
    'flat',
    'low',
    'high',
    'semi-high',
    'pop-up',
    'sloped-pop-up',
    'split-pop-up',
  ] as const;
  for (const roofType of roofs) {
    for (const popUpOpen of [false, true]) {
      const group = buildParametricBody({
        ...DEFAULT_BODY_CONFIG,
        roofType,
        popUpOpen,
      });
      assert.ok(group.children.length > 0, `${roofType} open=${popUpOpen}`);
    }
  }
});

void test('left slide-out extends the schematic width by its depth', () => {
  const plain = buildParametricBody(DEFAULT_BODY_CONFIG);
  plain.updateMatrixWorld(true);
  const plainBox = new THREE.Box3().setFromObject(plain);
  const extended = buildParametricBody({
    ...DEFAULT_BODY_CONFIG,
    slideOuts: [{ side: 'left', centerMm: 0, lengthMm: 1200, depthMm: 500 }],
  });
  extended.updateMatrixWorld(true);
  const extendedBox = new THREE.Box3().setFromObject(extended);
  assert.ok(extendedBox.min.z < -1.5, `slide-out z min ${extendedBox.min.z}`);
  assert.ok(extendedBox.min.z < plainBox.min.z - 0.4, 'slide-out sticks out left');
});

void test('rear slide-out and awning extend length and width', () => {
  const rear = buildParametricBody({
    ...DEFAULT_BODY_CONFIG,
    slideOuts: [{ side: 'rear', centerMm: 0, lengthMm: 1200, depthMm: 500 }],
  });
  rear.updateMatrixWorld(true);
  const rearBox = new THREE.Box3().setFromObject(rear);
  assert.ok(rearBox.max.x > 3.3, `rear slide-out x max ${rearBox.max.x}`);
  const awning = buildParametricBody({
    ...DEFAULT_BODY_CONFIG,
    accessories: [{ id: 'awning', positionMm: 0 }],
  });
  awning.updateMatrixWorld(true);
  const awningBox = new THREE.Box3().setFromObject(awning);
  assert.ok(awningBox.max.z > 2.0, `awning z max ${awningBox.max.z}`);
});

void test('roof AC fixture raises the schematic top', () => {
  const plain = buildParametricBody(DEFAULT_BODY_CONFIG);
  plain.updateMatrixWorld(true);
  const plainTop = new THREE.Box3().setFromObject(plain).max.y;
  const fitted = buildParametricBody({
    ...DEFAULT_BODY_CONFIG,
    roofFixtures: [{ kind: 'ac', positionMm: 0 }],
  });
  fitted.updateMatrixWorld(true);
  const fittedTop = new THREE.Box3().setFromObject(fitted).max.y;
  assert.ok(fittedTop > plainTop + 0.15, `ac top ${fittedTop} vs ${plainTop}`);
});

void test('every add-on adds exactly one mesh', () => {
  const plain = buildParametricBody(DEFAULT_BODY_CONFIG);
  const loaded = buildParametricBody({
    ...DEFAULT_BODY_CONFIG,
    slideOuts: [{ side: 'left', centerMm: 0, lengthMm: 1200, depthMm: 500 }],
    accessories: [
      { id: 'roof-rack', positionMm: 0 },
      { id: 'ladder', positionMm: 0 },
      { id: 'awning', positionMm: 0 },
      { id: 'bike-rack', positionMm: 0 },
      { id: 'spare-tire', positionMm: 0 },
      { id: 'storage-box', positionMm: 0 },
      { id: 'roof-platform', positionMm: 0 },
      { id: 'snorkel', positionMm: -2000 },
      { id: 'winch', positionMm: 0 },
      { id: 'bull-bar', positionMm: 0 },
    ],
    roofFixtures: [{ kind: 'skylight', positionMm: 0 }],
  });
  const count = (group: THREE.Group) => {
    let n = 0;
    group.traverse((object) => {
      if (object instanceof THREE.Mesh) n += 1;
    });
    return n;
  };
  assert.equal(count(loaded) - count(plain), 12);
});
