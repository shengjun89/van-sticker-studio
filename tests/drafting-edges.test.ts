import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createDraftingEdges } from '../lib/drafting-edges.ts';
function triangle(points: number[], materialName: string) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(points, 3),
  );
  const material = new THREE.MeshBasicMaterial();
  material.name = materialName;
  return new THREE.Mesh(geometry, material);
}
void test('a flexible blade does not leave a second static outline at its parked position', () => {
  const blade = triangle([0, 0, 0, 1, 0, 0, 1, 1, 0], 'Rubber');
  blade.geometry.morphAttributes.position = [
    blade.geometry.attributes.position.clone(),
  ];
  assert.equal(createDraftingEdges([blade]).length, 0);
});
void test('continuous body panels do not draw the internal diagonal created by a paint material split', () => {
  const a = triangle([0, 0, 0, 1, 0, 0, 1, 1, 0], 'Body_Paint');
  const b = triangle([0, 0, 0, 1, 1, 0, 0, 1, 0], 'Wrap_Front');
  const parent = new THREE.Group();
  parent.add(a, b);
  parent.updateMatrixWorld(true);
  const before = Array.from(a.geometry.attributes.position.array);
  const edges = createDraftingEdges([a, b]);
  const count = edges.reduce(
    (n, e) => n + e.geometry.attributes.position.count / 2,
    0,
  );
  assert.equal(
    count,
    4,
    'only four outside sides; the tessellation diagonal is not a body seam',
  );
  assert.deepEqual(Array.from(a.geometry.attributes.position.array), before);
});
void test('real panel boundaries stay attached to their own moving hinge', () => {
  const a = triangle([0, 0, 0, 1, 0, 0, 1, 1, 0], 'Body_Paint');
  const b = triangle([0, 0, 0, 1, 1, 0, 0, 1, 0], 'Wrap_Entry');
  const body = new THREE.Group(),
    door = new THREE.Group();
  body.add(a);
  door.add(b);
  const scene = new THREE.Group();
  scene.add(body, door);
  scene.updateMatrixWorld(true);
  const edges = createDraftingEdges([a, b]);
  assert.equal(
    edges.reduce((n, e) => n + e.geometry.attributes.position.count / 2, 0),
    6,
  );
  assert.ok(edges.some((e) => e.parent === door || e.parent.parent === door));
});
