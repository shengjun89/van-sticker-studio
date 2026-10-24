import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Box3, Mesh, Vector3 } from 'three';

// R9 regression: the top chrome grille bar must not carry a central dome
// arch anymore. The bar is one connected component of RV_Static_Chrome
// (571 verts / 1138 tris); its center top edge must sit within 15 mm of
// its shoulder level, while the end rises toward the headlamps stay.
void test('top chrome grille bar has no central arch', async () => {
  const b = fs.readFileSync('public/model/mxgarage-rv.glb');
  const { scene } = await new GLTFLoader().parseAsync(
    b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
    '',
  );
  scene.updateMatrixWorld(true);
  const mesh = scene.getObjectByName('RV_Static_Chrome') as Mesh;
  const p = mesh.geometry.attributes.position;
  const idx = mesh.geometry.index;
  assert.ok(idx, 'chrome mesh must be indexed');
  const parent = Array.from({ length: p.count }, (_, i) => i);
  const root = (i: number): number =>
    parent[i] === i ? i : (parent[i] = root(parent[i]));
  const union = (a: number, b2: number): void => {
    parent[root(a)] = root(b2);
  };
  for (let i = 0; i < idx.count; i += 3) {
    union(idx.getX(i), idx.getX(i + 1));
    union(idx.getX(i), idx.getX(i + 2));
  }
  const groups = new Map<number, number[]>();
  for (let i = 0; i < p.count; i++) {
    const k = root(i);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)?.push(i);
  }
  let bar: number[] | undefined;
  let barTop = -Infinity;
  for (const ids of groups.values()) {
    const box = new Box3();
    for (const i of ids) {
      box.expandByPoint(
        new Vector3().fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld),
      );
    }
    if (
      ids.length === 571 &&
      Math.abs(box.min.x + 2.8354) < 0.001 &&
      Math.abs(box.max.y - 1.0371) < 0.001 &&
      Math.abs(box.min.z + 0.6549) < 0.001
    ) {
      bar = ids;
      barTop = box.max.y;
    }
  }
  assert.ok(bar, 'top chrome grille bar component not found');
  const world = (i: number): Vector3 =>
    new Vector3().fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld);
  // Per-0.02-bin top edge over z in [-0.30, 0.20].
  const zLo = -0.3;
  const binW = 0.02;
  const nb = 25;
  const top = Array<number>(nb).fill(-Infinity);
  for (const i of bar) {
    const w = world(i);
    const bi = Math.floor((w.z - zLo) / binW);
    if (bi < 0 || bi >= nb) continue;
    if (w.y > top[bi]) top[bi] = w.y;
  }
  const topAt = (z: number): number => {
    const x = (z - zLo) / binW - 0.5;
    const i0 = Math.max(0, Math.min(nb - 1, Math.floor(x)));
    return top[i0];
  };
  const shoulder: number[] = [];
  for (let z = -0.29; z <= -0.21; z += 0.02) shoulder.push(topAt(z));
  for (let z = 0.11; z <= 0.19; z += 0.02) shoulder.push(topAt(z));
  shoulder.sort((a, b2) => a - b2);
  const shoulderLevel = shoulder[Math.floor(shoulder.length / 2)];
  let centerMax = -Infinity;
  for (let z = -0.17; z <= 0.07; z += 0.02) {
    centerMax = Math.max(centerMax, topAt(z));
  }
  assert.ok(
    centerMax - shoulderLevel < 0.015,
    `central arch remains: center top ${centerMax.toFixed(4)} vs shoulder ${shoulderLevel.toFixed(4)}`,
  );
  // End rises toward the headlamps must survive (no over-flattening).
  assert.ok(barTop > 1.03, `end rises lost: bar top max ${barTop.toFixed(4)}`);
});
