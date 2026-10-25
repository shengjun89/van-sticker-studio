import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Mesh, Vector3 } from 'three';

// R10 regression: roughness pass on the main-page vehicle. The forehead
// side-wall top line is pulled toward a two-segment chord, the wheel-arch
// openings are lifted, and a new trim-rings mesh carries window frames,
// wheel rims/spokes and side brow ribbons. Anchors (grille arc, wipers,
// window glass) are guarded by their own tests; this file guards the R10
// additions themselves.
async function loadScene() {
  const b = fs.readFileSync('public/model/mxgarage-rv.glb');
  const { scene } = await new GLTFLoader().parseAsync(
    b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
    '',
  );
  scene.updateMatrixWorld(true);
  return scene;
}

void test('trim rings mesh carries frames, rims, spokes and brow ribbons', async () => {
  const scene = await loadScene();
  const mesh = scene.getObjectByName('RV_Static_Trim_Rings') as Mesh;
  assert.ok(mesh, 'RV_Static_Trim_Rings not found');
  assert.equal(mesh.geometry.attributes.position.count, 384);
  assert.equal((mesh.geometry.index?.count ?? 0) / 3, 340);
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  assert.deepEqual(mats.map((m) => m.name), ['Graphite']);
  // Brow ribbons: 2 sides x 32 verts at |z| = 1.058, x in [-1.35, -1.05].
  // (Frames and wheel rims also exceed |z| 1.05, so the band must be
  // matched tightly, not by a loose threshold.)
  const p = mesh.geometry.attributes.position;
  let ribbonVerts = 0;
  const v = new Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld);
    if (
      Math.abs(v.z) > 1.056 && Math.abs(v.z) < 1.060 &&
      v.x >= -1.36 && v.x <= -1.04
    ) ribbonVerts++;
  }
  assert.equal(ribbonVerts, 64);
});

void test('rear wheel arch opening is lifted (gap vs tyre top)', async () => {
  const scene = await loadScene();
  const mesh = scene.getObjectByName('RV_Static_Body_Paint') as Mesh;
  const p = mesh.geometry.attributes.position;
  const v = new Vector3();
  // Arch edge = per-0.05-x-bin minimum y of the door-side skin; the apex
  // is the highest of those minima (the edge's top point).
  const bins = new Map<number, number>();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld);
    if (v.z < -1.10 || v.z > -0.90) continue;
    if (v.x < 1.35 || v.x > 2.25 || v.y > 0.95) continue;
    const bx = Math.round(v.x * 20) / 20;
    if (v.y < (bins.get(bx) ?? Infinity)) bins.set(bx, v.y);
  }
  let apex = 0;
  for (const m of bins.values()) if (m > apex) apex = m;
  // R9 apex was 0.745 (38 mm gap); R10 lifts it to ~0.790 (83 mm gap).
  assert.ok(apex > 0.78, `rear arch apex ${apex} not lifted`);
  assert.ok(apex < 0.82, `rear arch apex ${apex} unexpectedly high`);
});

void test('forehead side-wall top is pulled down from the R9 dome', async () => {
  const scene = await loadScene();
  const mesh = scene.getObjectByName('RV_Static_Body_Paint') as Mesh;
  const p = mesh.geometry.attributes.position;
  const v = new Vector3();
  let top = -Infinity;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld);
    const az = Math.abs(v.z);
    if (az < 0.90 || az > 1.12) continue;
    if (Math.round(v.x * 20) / 20 !== -1.85) continue;
    if (v.y > top) top = v.y;
  }
  // R9 bin top was 2.309 (dome); R10 pulls it to ~2.167.
  assert.ok(top < 2.20, `forehead bin -1.85 top ${top} not pulled down`);
  assert.ok(top > 2.10, `forehead bin -1.85 top ${top} unexpectedly low`);
});
