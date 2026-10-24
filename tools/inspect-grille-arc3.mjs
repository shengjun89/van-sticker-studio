// Identify the exact Chrome component(s) behind the grille-top arch line.
// For RV_Static_Chrome connected components with wide z-span, report:
// bbox, tri count, face-normal distribution, fine top-edge profile
// (0.02 z-bins, max y), and the vertices above y=1.010 (the arch zone).
import fs from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Vector3, Box3, Mesh, Triangle } from 'three';

const b = fs.readFileSync('public/model/mxgarage-rv.glb');
const { scene } = await new GLTFLoader().parseAsync(
  b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '',
);
scene.updateMatrixWorld(true);

scene.traverse((o) => {
  if (!(o instanceof Mesh) || o.name !== 'RV_Static_Chrome') return;
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
  let n = 0;
  for (const ids of groups.values()) {
    const box = new Box3();
    for (const i of ids) box.expandByPoint(world[i]);
    const zSpan = box.max.z - box.min.z;
    const ySpan = box.max.y - box.min.y;
    // Wide grille bars only: z-span > 1.0 m, front area (min.x < -2.75),
    // y within grille band.
    if (zSpan < 1.0 || box.min.x > -2.75 || box.max.y < 0.85 || box.min.y > 1.05) continue;
    n++;
    const idSet = new Set(ids);
    const tris = [];
    for (let i = 0; i < idx.count; i += 3) {
      if (idSet.has(idx.getX(i))) tris.push(i);
    }
    // Face normal distribution (world).
    const tri = new Triangle();
    let nFront = 0, nUp = 0, nOther = 0;
    for (const t of tris) {
      tri.set(world[idx.getX(t)], world[idx.getX(t + 1)], world[idx.getX(t + 2)]);
      const nor = new Vector3();
      tri.getNormal(nor);
      if (nor.x < -0.7) nFront++;
      else if (nor.y > 0.7) nUp++;
      else nOther++;
    }
    // Fine top-edge profile: 0.02 bins over the component z-range.
    const z0 = box.min.z, z1 = box.max.z;
    const nb = Math.ceil((z1 - z0) / 0.02);
    const prof = Array.from({ length: nb }, () => -Infinity);
    for (const i of ids) {
      const w = world[i];
      const bi = Math.min(nb - 1, Math.max(0, Math.floor((w.z - z0) / 0.02)));
      if (w.y > prof[bi]) prof[bi] = w.y;
    }
    // Arch-zone vertices: y > 1.010.
    const arch = ids.filter((i) => world[i].y > 1.010);
    let az0 = Infinity, az1 = -Infinity;
    for (const i of arch) { az0 = Math.min(az0, world[i].z); az1 = Math.max(az1, world[i].z); }
    console.log(`\n=== Chrome component #${n} verts=${ids.length} tris=${tris.length}`);
    console.log(`  bbox x[${box.min.x.toFixed(4)},${box.max.x.toFixed(4)}] y[${box.min.y.toFixed(4)},${box.max.y.toFixed(4)}] z[${box.min.z.toFixed(4)},${box.max.z.toFixed(4)}]`);
    console.log(`  face normals: front(-X)=${nFront} up(+Y)=${nUp} other=${nOther}`);
    console.log(`  top-edge profile (z 0.02 bins, max y):`);
    console.log('  ' + prof.map((v, i) => `${(z0 + i * 0.02).toFixed(2)}:${v === -Infinity ? '--' : v.toFixed(3)}`).join(' '));
    console.log(`  arch-zone verts (y>1.010): ${arch.length}, z-range [${az0.toFixed(4)},${az1.toFixed(4)}]`);
  }
});
