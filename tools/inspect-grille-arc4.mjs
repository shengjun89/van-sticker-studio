// Front-view projection map of the grille-top zone (no raycast: rasterize
// front triangles onto a YZ grid, keep the front-most (min x) mesh per cell).
// Also: bottom-edge profile of the 571-vert Chrome band and of the
// Body_Paint panel above it, to see whether the arch lives in one mesh
// or in the gap between two.
import fs from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Vector3, Box3, Mesh } from 'three';

const b = fs.readFileSync('public/model/mxgarage-rv.glb');
const { scene } = await new GLTFLoader().parseAsync(
  b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '',
);
scene.updateMatrixWorld(true);

const code = {
  RV_Static_Chrome: 'C',
  RV_Static_Graphite: 'g',
  RV_Static_Body_Paint: 'B',
  RV_Static_Rubber: 'R',
  RV_Static_Wrap_Front: 'W',
  RV_Static_Optic: 'O',
  RV_Static_Headlamp_Glass: 'H',
};

// --- Edge profiles for the two neighbours of the arch ---
function componentProfiles(meshName, wantVerts, wantBox) {
  const out = [];
  scene.traverse((o) => {
    if (!(o instanceof Mesh) || o.name !== meshName) return;
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
    const world = [];
    for (let i = 0; i < p.count; i++) {
      world.push(new Vector3().fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld));
    }
    for (const ids of groups.values()) {
      if (ids.length !== wantVerts) continue;
      const box = new Box3();
      for (const i of ids) box.expandByPoint(world[i]);
      if (Math.abs(box.min.x - wantBox[0]) > 0.001 || Math.abs(box.max.y - wantBox[1]) > 0.001) continue;
      const z0 = -0.30, z1 = 0.20, nb = 25;
      const top = Array.from({ length: nb }, () => -Infinity);
      const bot = Array.from({ length: nb }, () => Infinity);
      for (const i of ids) {
        const w = world[i];
        const bi = Math.floor((w.z - z0) / 0.02);
        if (bi < 0 || bi >= nb) continue;
        if (w.y > top[bi]) top[bi] = w.y;
        if (w.y < bot[bi]) bot[bi] = w.y;
      }
      out.push({ mesh: meshName, verts: ids.length, top, bot });
    }
  });
  return out;
}

for (const r of componentProfiles('RV_Static_Chrome', 571, [-2.8354, 1.0371])) {
  console.log(`\n${r.mesh} 571-vert band, central z -0.30..0.20 (0.02 bins):`);
  console.log('  top y: ' + r.top.map((v, i) => `${(-0.30 + i * 0.02).toFixed(2)}:${v === -Infinity ? '--' : v.toFixed(3)}`).join(' '));
  console.log('  bot y: ' + r.bot.map((v, i) => `${(-0.30 + i * 0.02).toFixed(2)}:${v === Infinity ? '--' : v.toFixed(3)}`).join(' '));
}
for (const r of componentProfiles('RV_Static_Body_Paint', 164, [-2.8120, 1.0439])) {
  console.log(`\n${r.mesh} 164-vert panel, central z -0.30..0.20 (0.02 bins):`);
  console.log('  top y: ' + r.top.map((v, i) => `${(-0.30 + i * 0.02).toFixed(2)}:${v === -Infinity ? '--' : v.toFixed(3)}`).join(' '));
  console.log('  bot y: ' + r.bot.map((v, i) => `${(-0.30 + i * 0.02).toFixed(2)}:${v === Infinity ? '--' : v.toFixed(3)}`).join(' '));
}

// --- Projection map ---
const yTop = 1.06, yBot = 0.96, yStep = 0.0025;
const zLeft = -0.40, zRight = 0.30, zStep = 0.005;
const nRows = Math.round((yTop - yBot) / yStep) + 1;
const nCols = Math.round((zRight - zLeft) / zStep) + 1;
const best = Array.from({ length: nRows }, () => Array.from({ length: nCols }, () => ({ x: Infinity, c: '.' })));

scene.traverse((o) => {
  if (!(o instanceof Mesh) || !(o.name in code)) return;
  const p = o.geometry.attributes.position;
  const idx = o.geometry.index;
  const world = [];
  for (let i = 0; i < p.count; i++) {
    world.push(new Vector3().fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld));
  }
  const ch = code[o.name];
  for (let t = 0; t < idx.count; t += 3) {
    const a = world[idx.getX(t)], c2 = world[idx.getX(t + 1)], d = world[idx.getX(t + 2)];
    const minX = Math.min(a.x, c2.x, d.x);
    if (minX > -2.70) continue; // not a front surface
    const yMin = Math.min(a.y, c2.y, d.y), yMax = Math.max(a.y, c2.y, d.y);
    const zMin = Math.min(a.z, c2.z, d.z), zMax = Math.max(a.z, c2.z, d.z);
    if (yMax < yBot || yMin > yTop || zMax < zLeft || zMin > zRight) continue;
    const r0 = Math.max(0, Math.floor((yMin - yBot) / yStep));
    const r1 = Math.min(nRows - 1, Math.floor((yMax - yBot) / yStep));
    const c0 = Math.max(0, Math.floor((zMin - zLeft) / zStep));
    const c1 = Math.min(nCols - 1, Math.floor((zMax - zLeft) / zStep));
    // Barycentric denominator in (z,y) plane.
    const den = (c2.z - d.z) * (a.y - d.y) - (c2.y - d.y) * (a.z - d.z);
    if (Math.abs(den) < 1e-12) continue;
    for (let r = r0; r <= r1; r++) {
      const y = yBot + r * yStep;
      for (let cc = c0; cc <= c1; cc++) {
        const z = zLeft + cc * zStep;
        const w1 = ((c2.z - d.z) * (y - d.y) - (c2.y - d.y) * (z - d.z)) / den;
        const w2 = ((d.z - a.z) * (y - d.y) - (d.y - a.y) * (z - d.z)) / den;
        const w3 = 1 - w1 - w2;
        if (w1 < -0.001 || w2 < -0.001 || w3 < -0.001) continue;
        const x = w1 * a.x + w2 * c2.x + w3 * d.x;
        if (x < best[r][cc].x) { best[r][cc].x = x; best[r][cc].c = ch; }
      }
    }
  }
});

console.log('\nPROJECTION MAP rows y 1.06->0.96 step 0.0025, cols z -0.40->0.30 step 0.005');
console.log('legend: C=Chrome g=Graphite B=Body_Paint R=Rubber W=Wrap_Front O=Optic H=Headlamp .=none');
for (let r = nRows - 1; r >= 0; r--) {
  console.log(`y=${(yBot + r * yStep).toFixed(4)} ` + best[r].map((c) => c.c).join(''));
}
