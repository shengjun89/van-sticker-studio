import test from 'node:test';
import assert from 'node:assert/strict';
import {
  perimeterCoordinate,
  wrappedDelta,
  constrainDecal,
  decalHit,
} from '../lib/wrap-layout.ts';

const body = { xMin: -2.85, length: 5.8, width: 2.22, height: 3.05 };
void test('adjacent faces share coordinates at all four corners without mirroring lettering', () => {
  const corners = [
    [2.95, -1.11, 0],
    [-2.85, -1.11, 5.8],
    [-2.85, 1.11, 8.02],
    [2.95, 1.11, 13.82],
  ];
  for (const [x, z, expected] of corners)
    assert.ok(
      Math.abs(wrappedDelta(perimeterCoordinate(x, z, body), expected, 16.04)) <
        1e-8,
    );
  const a = perimeterCoordinate(-2.849, -1.11, body);
  const b = perimeterCoordinate(-2.85, -1.109, body);
  assert.ok(b > a && b - a < 0.003);
});
void test('a decal spanning the rear seam can be grabbed on either adjoining face', () => {
  const p = { center: 0.1, height: 1.4, scale: 1 };
  assert.ok(decalHit(15.95, 1.4, p, 3, 16.04));
  assert.ok(decalHit(0.3, 1.4, p, 3, 16.04));
  assert.equal(decalHit(0.3, 2.9, p, 3, 16.04), false);
});
void test('invalid or extreme drag/scale values stay finite and keep the design within body height', () => {
  for (const scale of [NaN, Infinity, -5, 0.3, 4]) {
    const p = constrainDecal({ center: -33, height: Infinity, scale }, 3, body);
    assert.ok(Number.isFinite(p.scale) && p.scale >= 0.25 && p.scale <= 1.6);
    assert.ok(p.center >= 0 && p.center < 16.04);
    assert.ok(p.height + (3.5 * p.scale) / 3 / 2 <= 3.05);
  }
});
