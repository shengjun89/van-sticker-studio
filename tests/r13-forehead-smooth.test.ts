import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Matrix3, Mesh, Vector3 } from 'three';

// R13 regression (user decision 2026-10-25): the forehead is rebuilt as
// one clean smooth dome, forehead only. R10 had pulled the side-wall top
// line toward a two-segment chord and clamped it at the cab roof, which
// read on the live demo as kinked lines and a dented face; R13 restores
// the R9 forehead vertex-for-vertex (the smooth reference the user
// approved), removes the brand lettering from the chrome face, and drops
// the R10 brow ribbons. Wheel arches, window frames, wheel rims/spokes,
// grille, wipers and motion metadata are untouched (arches are still
// guarded by tests/r10-roughness.test.ts).
//
// These tests pin that state from the shipped file alone (no R9 archive
// needed at test time): R9 face stations, R9 skylight stations, the
// trim-rings compaction, and the lettering removal.
//
// Honest scope note: NO smoothness number is asserted here. The r11/r12
// tests carried a face-profile second-difference bound (max2 < 0.035);
// measured with that exact method, the visually smooth R9/R13 dome scores
// 0.0396 — worse than the kinked R10 (0.0287) and the R11 face (0.0227).
// The ranking is inverted against visual smoothness, so the metric is
// retired, not re-bound to fit. Acceptance is the drawing-mode visual
// evidence (see vss-r13 report), finally signed off by the user's own eye
// on the demo.
async function loadScene() {
  const b = fs.readFileSync('public/model/mxgarage-rv.glb');
  const { scene } = await new GLTFLoader().parseAsync(
    b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
    '',
  );
  scene.updateMatrixWorld(true);
  return scene;
}

// Face profile: same method as tests/r11/r12-forehead.test.ts —
// paint/wrap face verts with forward-facing normals, 0.05 m floor y-bins
// of min-x, 5-bin moving average.
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

// Skylight profile: Rooflight glass verts in the forehead box, 0.05 m
// floor y-bins of min-x, RAW bins (no smoothing).
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

void test('forehead face stations sit on the R9 smooth arc (R13)', async () => {
  const prof = await faceProfile();
  // Measured R9 stations with this method (R13 restores R9 values).
  const want: Array<[number, number]> = [
    [2.60, -1.6299],
    [2.70, -1.5082],
    [2.75, -1.4316],
    [2.80, -1.3945],
    [2.85, -1.3538],
  ];
  for (const [y, x] of want) {
    assert.ok(Math.abs(at(prof, y) - x) < 0.04, `face station ${y}: ${at(prof, y)} (want ${x})`);
  }
});

void test('skylight glass stations sit back on R9 (R13)', async () => {
  const prof = await skylightProfile();
  // Measured R9 stations with this method (raw bins).
  const want: Array<[number, number]> = [
    [2.70, -1.5258],
    [2.80, -1.3721],
    [2.85, -1.2696],
  ];
  for (const [y, x] of want) {
    assert.ok(Math.abs(at(prof, y) - x) < 0.04, `glass station ${y}: ${at(prof, y)} (want ${x})`);
  }
});

void test('trim rings compacted, brow ribbons gone (R13)', async () => {
  const scene = await loadScene();
  const rings = scene.getObjectByName('RV_Static_Trim_Rings') as Mesh;
  assert.ok(rings, 'RV_Static_Trim_Rings not found');
  // R13: brow ribbons removed and their 64 exclusive verts compacted out;
  // window frames and wheel rims/spokes stay.
  assert.equal(rings.geometry.attributes.position.count, 320);
  assert.equal((rings.geometry.index?.count ?? 0) / 3, 280);
  // No triangle left whose three verts all sit in the brow-ribbon box.
  const p = rings.geometry.attributes.position;
  const idx = rings.geometry.index!;
  const v = new Vector3();
  let ribbonTris = 0;
  for (let t = 0; t < idx.count / 3; t++) {
    const inBox = [0, 1, 2].map((k) => {
      v.fromBufferAttribute(p, idx.getX(t * 3 + k)).applyMatrix4(rings.matrixWorld);
      return Math.abs(v.z) > 1.056 && Math.abs(v.z) < 1.060 && v.x >= -1.36 && v.x <= -1.04;
    });
    if (inBox.every(Boolean)) ribbonTris++;
  }
  assert.equal(ribbonTris, 0);
});

// NOTE on the retired second-difference bound: the r11/r12 tests carried a
// max2 < 0.035 tripwire on this same smoothed face profile. Measured with
// that exact method, the visually smooth R9/R13 dome scores 0.0396 —
// WORSE than the kinked R10 (0.0287) and the R11 face (0.0227). The ranking
// is inverted against visual smoothness, so the metric is retired with
// the r11/r12 tests rather than re-bound to fit. No smoothness number is
// asserted here; the stations above plus the drawing-mode visual evidence
// (vss-r13 report) are the pins.

void test('chrome face lettering is gone, chrome ovals kept (R13)', async () => {
  const scene = await loadScene();
  const mesh = scene.getObjectByName('RV_Static_Chrome') as Mesh;
  assert.ok(mesh, 'RV_Static_Chrome not found');
  const p = mesh.geometry.attributes.position;
  const idx = mesh.geometry.index!;
  // R13 removed 3,974 letter triangles from the chrome index.
  assert.equal(idx.count / 3, 45004);
  const v = new Vector3();
  let letterBox = 0;
  let plateTris = 0;
  for (let t = 0; t < idx.count / 3; t++) {
    const ws = [0, 1, 2].map((k) => {
      v.fromBufferAttribute(p, idx.getX(t * 3 + k)).applyMatrix4(mesh.matrixWorld);
      return [v.x, v.y, v.z] as const;
    });
    const cx = (ws[0][0] + ws[1][0] + ws[2][0]) / 3;
    const cy = (ws[0][1] + ws[1][1] + ws[2][1]) / 3;
    const cz = (ws[0][2] + ws[1][2] + ws[2][2]) / 3;
    // Expanded R9 letter box: no chrome triangle centroid may sit here.
    if (cx > -1.96 && cx < -1.85 && cy > 2.27 && cy < 2.40 && cz > -0.51 && cz < 0.42) letterBox++;
    // Forehead plate region: letters (3,974) + ovals (928) = 4,902 in R9;
    // with letters gone exactly the 928 oval triangles remain.
    if (cx > -2.10 && cx < -1.75 && cy > 2.00 && cy < 2.95) plateTris++;
  }
  assert.equal(letterBox, 0);
  assert.equal(plateTris, 928);
});
