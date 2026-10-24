// Inspect the front grille top region to locate the arch line the user
// reported (screenshot: front grille close-up, a line arching upward at
// the top-center of the grille). Front faces -X. Region: x < -2.70,
// y in [0.80, 1.45], z in [-0.80, 0.80]. Prints per-mesh connected
// components in that region with bbox, tri/vertex counts, and a y-vs-z
// profile (max y per z-bin) so an arch shape is visible in numbers.
import fs from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Vector3, Box3, Mesh } from 'three';

const b = fs.readFileSync('public/model/mxgarage-rv.glb');
const { scene } = await new GLTFLoader().parseAsync(
  b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '',
);
scene.updateMatrixWorld(true);

const inRegion = (p) => p.x < -2.70 && p.y >= 0.80 && p.y <= 1.45 && p.z >= -0.80 && p.z <= 0.80;

const report = [];
scene.traverse((o) => {
  if (!(o instanceof Mesh) || !o.name.startsWith('RV_Static_')) return;
  const p = o.geometry.attributes.position;
  const idx = o.geometry.index;
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
  // World positions once.
  const world = [];
  for (let i = 0; i < p.count; i++) {
    world.push(new Vector3().fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld));
  }
  for (const ids of groups.values()) {
    const box = new Box3();
    let inCount = 0;
    for (const i of ids) {
      if (inRegion(world[i])) { box.expandByPoint(world[i]); inCount++; }
    }
    if (inCount < 3) continue;
    // Tri count of this component (approx: tris whose first vertex is in it).
    const idSet = new Set(ids);
    let tris = 0;
    for (let i = 0; i < idx.count; i += 3) {
      if (idSet.has(idx.getX(i))) tris++;
    }
    // y-vs-z profile: 16 bins over z [-0.80, 0.80], max y per bin.
    const bins = Array.from({ length: 16 }, () => -Infinity);
    for (const i of ids) {
      const w = world[i];
      if (!inRegion(w)) continue;
      const bi = Math.min(15, Math.max(0, Math.floor((w.z + 0.80) / 0.10)));
      if (w.y > bins[bi]) bins[bi] = w.y;
    }
    report.push({
      mesh: o.name,
      verts: ids.length,
      vertsInRegion: inCount,
      tris,
      bounds: [box.min.toArray().map((v) => +v.toFixed(4)), box.max.toArray().map((v) => +v.toFixed(4))],
      profileMaxYPerZBin: bins.map((v) => (v === -Infinity ? null : +v.toFixed(4))),
    });
  }
});

report.sort((a, b) => b.bounds[1][1] - a.bounds[1][1]);
console.log(JSON.stringify({ componentsInGrilleTopRegion: report }, null, 2));
