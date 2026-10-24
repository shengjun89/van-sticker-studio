import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { DEFAULT_BODY_CONFIG } from '../lib/parametric-body.ts';
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
