import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Matrix3, Mesh, Vector3 } from 'three';

// R12 regression (user decision 2026-10-25): the forehead is reverted to
// R10, forehead only. R11 had pushed the front face forward (up to
// ~0.089 m at y 2.80) and tightened the top corner; on the live demo the
// top-corner/top-line junction still read as a kink, so the user ordered
// a revert instead of further smoothing. The revert is exact, not
// approximate: the 12 forehead POSITION/NORMAL accessors (6 meshes) were
// copied vertex-for-vertex from the R10 archive into R11, so the R12 GLB
// is byte-identical to the R10 GLB (sha256 532f2a55...). These tests pin
// that state from the shipped file alone (no R10 archive needed at test
// time): face stations, skylight stations, and the smoothness bound.
//
// Honest scope note: face-profile smoothness metrics do NOT separate R10
// from R11 (second difference 0.0287 vs 0.0227, both under the 0.035
// bound; upper-segment slope change 0.06 vs 0.08). The visible R11
// regression was the skylight + face moving forward against the unmoved
// roof/side walls (skylight glass mean -0.017 m, max -0.089 m), which the
// glass-station test below pins back to R10.
//
// Profile method (face): same as tests/r11-forehead.test.ts: paint/wrap
// face verts with forward-facing normals, 0.05 m floor y-bins of min-x,
// 5-bin moving average, +/-0.04 m bounds.
// Skylight method: Rooflight glass verts in the forehead box, 0.05 m
// floor y-bins of min-x, RAW bins (no smoothing), +/-0.04 m bounds.
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

async function skylightProfile() {
  const scene = await loadScene();
  const bins = new Map<number, number>();
  const mesh = scene.getObjectByName('RV_WebRig_Rooflight_Glass') as Mesh;
  const p = mesh.geometry.attributes.position;
  const v = new Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld);
    if (v.x < -2.10 || v.x > -1.0 || v.y < 2.05 || v.y > 2.95) continue;
    const bin = Math.floor(v.y / 0.05) * 0.05;
    if (v.x < (bins.get(bin) ?? Infinity)) bins.set(bin, v.x);
  }
  return bins;
}

function at(prof: Map<number, number>, y: number) {
  for (const [yy, x] of prof) if (Math.abs(yy - y) < 0.026) return x;
  throw new Error(`no profile bin near ${y}`);
}

void test('forehead face stations sit on the R10 arc (R12 revert)', async () => {
  const prof = await faceProfile();
  // Measured R10 stations with this method (R12 == R10 by construction).
  const want: Array<[number, number]> = [
    [2.60, -1.542],
    [2.70, -1.404],
    [2.75, -1.335],
    [2.80, -1.295],
    [2.85, -1.252],
  ];
  for (const [y, x] of want) {
    assert.ok(Math.abs(at(prof, y) - x) < 0.04, `face station ${y}: ${at(prof, y)} (want ${x})`);
  }
});

void test('skylight glass stations sit back on R10 (R12 revert)', async () => {
  const prof = await skylightProfile();
  // R11 had pushed the skylight forward with the face (2.80: -1.341,
  // 2.85: -1.296); R12 puts it back on the R10 stations.
  const want: Array<[number, number]> = [
    [2.70, -1.423],
    [2.80, -1.253],
    [2.85, -1.218],
  ];
  for (const [y, x] of want) {
    assert.ok(Math.abs(at(prof, y) - x) < 0.04, `glass station ${y}: ${at(prof, y)} (want ${x})`);
  }
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
  // Measured R12 (= R10 forehead): 0.0287, under the 0.035 bound.
  assert.ok(max2 < 0.035, `face profile second difference ${max2} too large`);
  const scene = await loadScene();
  const rings = scene.getObjectByName('RV_Static_Trim_Rings') as Mesh;
  assert.ok(rings, 'RV_Static_Trim_Rings not found');
  assert.equal(rings.geometry.attributes.position.count, 384);
  assert.equal((rings.geometry.index?.count ?? 0) / 3, 340);
});
