import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { wiperPhase, playfulEase } from '../components/studio/scene-engine.ts';
void test('wipers rest for five seconds then make one complete sweep, repeating every five seconds', () => {
  for (const t of [0, 1, 4.99, 5, 6.35, 8, 9.9, 10])
    assert.ok(Math.abs(wiperPhase(t)) < 1e-6);
  assert.ok(wiperPhase(5.675) > 0.999);
  assert.ok(Math.abs(wiperPhase(5.4) - wiperPhase(10.4)) < 1e-12);
});
void test('hinges settle at their physical range and never exceed the open limit', () => {
  assert.ok(playfulEase(0) === 0);
  assert.equal(playfulEase(1), 1);
  for (let t = 0; t <= 1; t += 0.01)
    assert.ok(playfulEase(t) <= 1 && playfulEase(t) >= -0.0181);
});
void test('all declared motion nodes and wrap surfaces exist in the final GLB', () => {
  const b = fs.readFileSync('public/model/mxgarage-rv.glb');
  const json = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString());
  const meta = JSON.parse(
    fs.readFileSync('public/model/motion_metadata.json', 'utf8'),
  );
  const nodes = new Set(json.nodes.map((n: { name: string }) => n.name));
  for (const m of meta.motions)
    for (const n of m.nodes) assert.ok(nodes.has(n.name), n.name);
  assert.equal(
    meta.motions.find((m: { id: string }) => m.id === 'entry-door')
      .rangeDegrees[1],
    180,
  );
  assert.ok(
    json.nodes.filter(
      (n: { extras?: { wrapSurface?: boolean } }) => n.extras?.wrapSurface,
    ).length >= 7,
  );
  assert.match(meta.wrap.entryU, /^1/);
  assert.ok(!meta.wrap.driverU.startsWith('1'));
});
