import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Matrix3, Mesh, Vector3 } from 'three';

// R11 regression, SUPERSEDED BY R12 (2026-10-25, user decision): the R11
// arc below was reverted to the R10 forehead, forehead only. The R11 arc
// values are preserved in git history and in ~/workspace/vss-r11/report.md;
// the station/push assertions below now pin the R10 arc (R12), and the
// authoritative revert proof lives in tests/r12-forehead-revert.test.ts.
// Profile method (same as the fix script): paint/wrap face verts with
// forward-facing normals, 0.05 m y-bins of min-x, 5-bin moving average.
// Bounds are +/-0.04 m: binning plus the face's own transverse scatter
// floors this measurement at ~0.02 m, so the bounds pin the arc position
// without pretending to sub-centimetre precision.
async function loadScene() {
  const b = fs.readFileSync('public/model/mxgarage-rv.glb');
  const { scene } = await new GLTFLoader().parseAsync(
    b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
    '',
  );
  scene.updateMatrixWorld(true);
  return scene;
}

async function faceProfile() {
  const scene = await loadScene();
  const bins = new Map<number, number>();
  for (const name of [
    'RV_Static_Body_Paint',
    'RV_Static_Wrap_Driver',
    'RV_Static_Wrap_Entry',
  ]) {
    const mesh = scene.getObjectByName(name) as Mesh;
    const p = mesh.geometry.attributes.position;
    const n = mesh.geometry.attributes.normal;
    const nMat = new Matrix3().getNormalMatrix(mesh.matrixWorld);
    const v = new Vector3();
    const nv = new Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld);
      nv.fromBufferAttribute(n, i).applyMatrix3(nMat).normalize();
      if (nv.x >= -0.3) continue;
      if (v.x < -2.10 || v.x > -1.0 || v.y < 2.05 || v.y > 2.95) continue;
      const bin = Math.floor(v.y / 0.05) * 0.05;
      if (v.x < (bins.get(bin) ?? Infinity)) bins.set(bin, v.x);
    }
  }
  const ys = [...bins.keys()].sort((a, b) => a - b);
  const raw = ys.map((y) => [y, bins.get(y)!] as const);
  const sm = new Map<number, number>();
  for (let i = 0; i < raw.length; i++) {
    let s = 0;
    let c = 0;
    for (let k = Math.max(0, i - 2); k <= Math.min(raw.length - 1, i + 2); k++) {
      s += raw[k][1];
      c++;
    }
    sm.set(raw[i][0], s / c);
  }
  return sm;
}

void test('forehead face stations sit back on the R10 arc (R12 revert)', async () => {
  const prof = await faceProfile();
  const at = (y: number) => {
    for (const [yy, x] of prof) if (Math.abs(yy - y) < 0.026) return x;
    throw new Error(`no profile bin near ${y}`);
  };
  // R12 reverts the R11 arc to R10. Measured R10 stations with this
  // floor-bin method: 2.60 -1.542, 2.80 -1.295, 2.85 -1.252. (The R11
  // report's round-bin R10 stations were -1.569/-1.288/-1.242; both sets
  // agree within the +/-0.04 bound.)
  assert.ok(Math.abs(at(2.60) - -1.542) < 0.04, `station 2.60: ${at(2.60)}`);
  assert.ok(Math.abs(at(2.80) - -1.295) < 0.04, `station 2.80: ${at(2.80)}`);
  assert.ok(Math.abs(at(2.85) - -1.252) < 0.04, `station 2.85: ${at(2.85)}`);
});

void test('R11 forward push is reverted (R12)', async () => {
  const prof = await faceProfile();
  const at = (y: number) => {
    for (const [yy, x] of prof) if (Math.abs(yy - y) < 0.026) return x;
    throw new Error(`no profile bin near ${y}`);
  };
  // Negation of the R11 push assertions (which required the upper face
  // at least 0.05 m forward of the R10 stations -1.288/-1.242). R12 puts
  // the face back, so it must NOT clear those push thresholds.
  assert.ok(at(2.80) > -1.288 - 0.05, `upper face 2.80 still pushed: ${at(2.80)}`);
  assert.ok(at(2.85) > -1.242 - 0.05, `upper face 2.85 still pushed: ${at(2.85)}`);
});

void test('forehead face profile stays smooth, R10 trim rings intact', async () => {
  const prof = await faceProfile();
  const mid = [...prof.entries()]
    .filter(([y]) => y >= 2.25 && y <= 2.85)
    .sort((a, b) => a[0] - b[0]);
  let max2 = 0;
  for (let i = 1; i < mid.length - 1; i++) {
    const d = Math.abs(mid[i + 1][1] - 2 * mid[i][1] + mid[i - 1][1]);
    if (d > max2) max2 = d;
  }
  // Measured R12 (= R10 forehead): 0.0287; R11 measured 0.0227. The bound
  // is 0.035 (binning noise floors this metric near 0.02). This metric
  // alone does not separate R10 from R11; the revert itself is pinned by
  // the station tests above and by tests/r12-forehead-revert.test.ts.
  assert.ok(max2 < 0.035, `face profile second difference ${max2} too large`);
  const scene = await loadScene();
  const rings = scene.getObjectByName('RV_Static_Trim_Rings') as Mesh;
  assert.ok(rings, 'RV_Static_Trim_Rings not found');
  assert.equal(rings.geometry.attributes.position.count, 384);
  assert.equal((rings.geometry.index?.count ?? 0) / 3, 340);
});
