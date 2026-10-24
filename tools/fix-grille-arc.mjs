// R9: straighten the central arch of the top chrome grille bar.
//
// Diagnosis (see tools/inspect-grille-arc*.mjs + projection map):
// The arc line the user reported is the top edge of ONE connected
// component of RV_Static_Chrome: 571 verts / 1138 tris, bbox
// x[-2.8354,-2.7832] y[0.9782,1.0371] z[-0.6549,0.5604]. Its whole band
// follows an arched path: top edge rises from ~1.002 at the shoulders to
// 1.035 at z~=-0.06, bottom edge from ~0.978 to 1.016. The other chrome
// bars have no central dome and are left alone; the band's end rises
// toward the headlamps are also left alone.
//
// Fix: for vertices of this component with z in the arch span
// [-0.20, 0.10], subtract Delta(z) from y, where Delta(z) is the band
// centerline's rise above its shoulder baseline, recomputed from the
// model itself (0.02 z-bins, missing bins interpolated, baseline =
// median centerline over the shoulder zones). The whole cross-section
// at each z shifts together, so band thickness is preserved and no
// triangle inverts. Normals get the inverse-transpose correction for
// this y-shear (n' = normalize(nx, ny, nz + Delta'(z)*ny)).
// The Chrome node matrix is identity, so local == world coordinates
// (asserted below). Only POSITION/NORMAL floats of this component
// change; every other GLB byte is untouched, and the JSON diff is
// limited to the POSITION accessor min/max.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Vector3, Box3, Mesh } from 'three';

const input = fs.readFileSync('public/model/mxgarage-rv.glb');
const { scene } = await new GLTFLoader().parseAsync(
  input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength), '',
);
scene.updateMatrixWorld(true);

const chrome = scene.getObjectByName('RV_Static_Chrome');
const mw = chrome.matrixWorld.elements;
const isIdentity = mw.every((v, i) => Math.abs(v - (i % 5 === 0 ? 1 : 0)) < 1e-9);
if (!isIdentity) throw new Error('RV_Static_Chrome matrixWorld is not identity; aborting');

// Connected components of the Chrome mesh; pick the top grille bar.
const p = chrome.geometry.attributes.position;
const idx = chrome.geometry.index;
const parent = Array.from({ length: p.count }, (_, i) => i);
const root = (i) => (parent[i] === i ? i : (parent[i] = root(parent[i])));
const union = (a, b) => { parent[root(a)] = root(b); };
for (let i = 0; i < idx.count; i += 3) {
  union(idx.getX(i), idx.getX(i + 1));
  union(idx.getX(i), idx.getX(i + 2));
}
const groups = new Map();
for (let i = 0; i < p.count; i++) {
  const k = root(i);
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(i);
}
let target = null;
for (const ids of groups.values()) {
  const box = new Box3();
  for (const i of ids) box.expandByPoint(new Vector3().fromBufferAttribute(p, i));
  if (
    ids.length === 571 &&
    Math.abs(box.min.x + 2.8354) < 0.001 &&
    Math.abs(box.max.y - 1.0371) < 0.001 &&
    Math.abs(box.min.z + 0.6549) < 0.001
  ) target = ids;
}
if (!target) throw new Error('top chrome grille bar component (571 verts) not found');

// World positions (== local, identity matrix).
const world = [];
for (let i = 0; i < p.count; i++) world.push(new Vector3().fromBufferAttribute(p, i));

// Per-0.02-bin top/bottom profiles over z in [-0.30, 0.20].
const zLo = -0.30, zHi = 0.20, binW = 0.02;
const nb = Math.round((zHi - zLo) / binW);
const top = Array(nb).fill(-Infinity);
const bot = Array(nb).fill(Infinity);
for (const i of target) {
  const w = world[i];
  const bi = Math.floor((w.z - zLo) / binW);
  if (bi < 0 || bi >= nb) continue;
  if (w.y > top[bi]) top[bi] = w.y;
  if (w.y < bot[bi]) bot[bi] = w.y;
}
const fill = (arr, isTop) => {
  const out = [...arr];
  const valid = out.map((v) => (isTop ? v !== -Infinity : v !== Infinity));
  for (let i = 0; i < nb; i++) {
    if (valid[i]) continue;
    let l = i - 1;
    while (l >= 0 && !valid[l]) l--;
    let r = i + 1;
    while (r < nb && !valid[r]) r++;
    if (l >= 0 && r < nb) out[i] = out[l] + ((out[r] - out[l]) * (i - l)) / (r - l);
    else if (l >= 0) out[i] = out[l];
    else out[i] = out[r];
  }
  return out;
};
const topF = fill(top, true);
const botF = fill(bot, false);
const centerRaw = topF.map((t, i) => (t + botF[i]) / 2);
// Smooth the centerline (5-bin moving average): per-bin extremes carry
// vertex-level noise, and an unsmoothed Delta would leave a rippled
// edge after flattening. The arch itself is smooth, so averaging only
// removes noise, not shape.
const center = centerRaw.map((_, i) => {
  const lo = Math.max(0, i - 2);
  const hi = Math.min(nb - 1, i + 2);
  let s = 0;
  for (let j = lo; j <= hi; j++) s += centerRaw[j];
  return s / (hi - lo + 1);
});
// Baseline: median centerline over shoulder zones.
const shoulder = [];
for (let i = 0; i < nb; i++) {
  const zc = zLo + (i + 0.5) * binW;
  if ((zc >= -0.30 && zc <= -0.20) || (zc >= 0.10 && zc <= 0.20)) shoulder.push(center[i]);
}
shoulder.sort((a, b) => a - b);
const baseline = shoulder[Math.floor(shoulder.length / 2)];
// Delta table at bin centers; 0 outside the arch span.
const spanLo = -0.20, spanHi = 0.10;
const deltaAt = (z) => {
  if (z <= spanLo || z >= spanHi) return 0;
  const x = (z - zLo) / binW - 0.5;
  const i0 = Math.max(0, Math.floor(x));
  const i1 = Math.min(nb - 1, i0 + 1);
  const f = Math.max(0, Math.min(1, x - i0));
  const d0 = Math.max(0, center[i0] - baseline);
  const d1 = Math.max(0, center[i1] - baseline);
  let d = d0 + (d1 - d0) * f;
  // 0.04 m linear taper at both span edges, so no step remains even if
  // one edge bin carries an outlier (e.g. a mounting-tab vertex).
  const taper = Math.min(1, (z - spanLo) / 0.04, (spanHi - z) / 0.04);
  return d * Math.max(0, taper);
};
const deltaPrimeAt = (z) => {
  const h = 0.005;
  return (deltaAt(z + h) - deltaAt(z - h)) / (2 * h);
};

// Apply to the stored floats. POSITION accessor 163 / NORMAL 164 are
// located from the GLB JSON (not hardcoded) — see below.
const jsonLength = input.readUInt32LE(12);
const g = JSON.parse(input.subarray(20, 20 + jsonLength));
const binOffset = 28 + jsonLength;
const node = g.nodes.find((n) => n.name === 'RV_Static_Chrome');
const prim = g.meshes[node.mesh].primitives[0];
const pa = g.accessors[prim.attributes.POSITION];
const pv = g.bufferViews[pa.bufferView];
const po = binOffset + (pv.byteOffset || 0) + (pa.byteOffset || 0);
const pStride = pv.byteStride || 12;
const na = g.accessors[prim.attributes.NORMAL];
const nv = g.bufferViews[na.bufferView];
const no = binOffset + (nv.byteOffset || 0) + (na.byteOffset || 0);
const nStride = nv.byteStride || 12;

let changed = 0;
let peakDelta = 0;
let peakZ = 0;
for (const i of target) {
  const w = world[i];
  const d = deltaAt(w.z);
  if (d <= 0) continue;
  if (d > peakDelta) { peakDelta = d; peakZ = w.z; }
  input.writeFloatLE(w.y - d, po + i * pStride + 4);
  // Normal inverse-transpose correction for the y-shear.
  const nx = input.readFloatLE(no + i * nStride);
  const ny = input.readFloatLE(no + i * nStride + 4);
  const nz = input.readFloatLE(no + i * nStride + 8);
  const dp = deltaPrimeAt(w.z);
  const nz2 = dp * ny + nz;
  const len = Math.hypot(nx, ny, nz2) || 1;
  input.writeFloatLE(nx / len, no + i * nStride);
  input.writeFloatLE(ny / len, no + i * nStride + 4);
  input.writeFloatLE(nz2 / len, no + i * nStride + 8);
  changed++;
}
// Recalculate POSITION accessor bounds over the whole accessor.
pa.min = [Infinity, Infinity, Infinity];
pa.max = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < pa.count; i++) {
  for (let k = 0; k < 3; k++) {
    const x = input.readFloatLE(po + i * pStride + k * 4);
    pa.min[k] = Math.min(pa.min[k], x);
    pa.max[k] = Math.max(pa.max[k], x);
  }
}

// Rebuild: JSON re-serialized + space padding, BIN bytes unchanged
// except the edited floats.
const raw = Buffer.from(JSON.stringify(g));
const json = Buffer.concat([raw, Buffer.alloc((-raw.length) & 3, 32)]);
const bin = input.subarray(binOffset);
const header = Buffer.alloc(20);
const bh = Buffer.alloc(8);
header.writeUInt32LE(0x46546c67);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(28 + json.length + bin.length, 8);
header.writeUInt32LE(json.length, 12);
header.writeUInt32LE(0x4e4f534a, 16);
bh.writeUInt32LE(bin.length);
bh.writeUInt32LE(0x004e4942, 4);
const result = Buffer.concat([header, json, bh, bin]);

// Backup the R8 file once, then publish.
const OUT = process.env.HOME + '/workspace/vss-r9';
fs.mkdirSync(OUT, { recursive: true });
if (!fs.existsSync(OUT + '/mxgarage-rv-r8.glb')) {
  fs.copyFileSync('public/model/mxgarage-rv.glb', OUT + '/mxgarage-rv-r8.glb');
}
fs.writeFileSync('public/model/mxgarage-rv.glb', result);
fs.writeFileSync(OUT + '/mxgarage-rv-r9.glb', result);
const sha = crypto.createHash('sha256').update(result).digest('hex');
const report = {
  component: 'RV_Static_Chrome top grille bar',
  componentVerts: target.length,
  changedVertices: changed,
  baselineY: +baseline.toFixed(4),
  peakDeltaMeters: +peakDelta.toFixed(4),
  peakDeltaMm: +(peakDelta * 1000).toFixed(1),
  peakAtZ: +peakZ.toFixed(4),
  archSpanZ: [spanLo, spanHi],
  oldBoundsY: [0.9782, 1.0371],
  newAccessorMin: pa.min,
  newAccessorMax: pa.max,
  sha256: sha,
  bytes: result.length,
  method: '中心拱段整体下移拉平（按实测中心线拱高逐 z 插值下压，带宽不变、法线逆转置修正）；其余 GLB 字节不变，JSON 仅 POSITION accessor min/max 变化。',
};
for (const f of ['motion_metadata.json', 'wiper_calibration.json']) {
  const m = JSON.parse(fs.readFileSync(`public/model/${f}`));
  if (f.startsWith('motion')) {
    m.glbSha256 = sha;
    m.grilleArcCorrection = report;
  } else {
    m.outputSha256 = sha;
    m.bytes = result.length;
  }
  fs.writeFileSync(`public/model/${f}`, JSON.stringify(m, null, 2));
}
fs.writeFileSync(OUT + '/correction.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
