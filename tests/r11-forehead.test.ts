import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Matrix3, Mesh, Vector3 } from 'three';

// R11 regression: the forehead front-face steep slope itself is reshaped
// (R10 only straightened the side-wall top line). The face is pulled onto
// a smooth parametric arc: measured bottom/top anchors, a cubic Bezier
// target, a tighter but tangent-continuous top corner. The upper face
// moves forward the most (up to ~0.089 m at y 2.80); the windshield
// junction, the roof line and the R10 side-wall top line stay put.
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

void test('forehead face stations sit on the R11 arc', async () => {
  const prof = await faceProfile();
  const at = (y: number) => {
    for (const [yy, x] of prof) if (Math.abs(yy - y) < 0.026) return x;
    throw new Error(`no profile bin near ${y}`);
  };
  // Measured R11 stations: 2.60 -1.552, 2.80 -1.364, 2.85 -1.330.
  assert.ok(Math.abs(at(2.60) - -1.552) < 0.04, `station 2.60: ${at(2.60)}`);
  assert.ok(Math.abs(at(2.80) - -1.364) < 0.04, `station 2.80: ${at(2.80)}`);
  assert.ok(Math.abs(at(2.85) - -1.330) < 0.04, `station 2.85: ${at(2.85)}`);
});

void test('upper face is pushed forward from R10', async () => {
  const prof = await faceProfile();
  const at = (y: number) => {
    for (const [yy, x] of prof) if (Math.abs(yy - y) < 0.026) return x;
    throw new Error(`no profile bin near ${y}`);
  };
  // R10 stations (measured before this round): 2.80 -1.288, 2.85 -1.242.
  // R11 pushes the upper face forward by ~0.08 m onto the clean slope.
  assert.ok(at(2.80) < -1.288 - 0.05, `upper face 2.80 not pushed: ${at(2.80)}`);
  assert.ok(at(2.85) < -1.242 - 0.05, `upper face 2.85 not pushed: ${at(2.85)}`);
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
  // Measured R11: 0.023. The bound is 0.035 (binning noise floors this
  // metric near 0.02); R10's strongly-forward profile measured 0.048.
  assert.ok(max2 < 0.035, `face profile second difference ${max2} too large`);
  const scene = await loadScene();
  const rings = scene.getObjectByName('RV_Static_Trim_Rings') as Mesh;
  assert.ok(rings, 'RV_Static_Trim_Rings not found');
  assert.equal(rings.geometry.attributes.position.count, 384);
  assert.equal((rings.geometry.index?.count ?? 0) / 3, 340);
});
