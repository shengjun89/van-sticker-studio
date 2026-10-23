import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { findFrontWrapTransitions } from '../lib/wrap-eligibility.ts';

type Point = [number, number, number];
function mesh(name: string, material: string, triangles: Point[][]) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(triangles.flat(2), 3),
  );
  const surface = new THREE.MeshBasicMaterial();
  surface.name = material;
  const result = new THREE.Mesh(geometry, surface);
  result.name = name;
  return result;
}
const a: Point = [-2.48, 0.9, -0.8],
  b: Point = [-2.48, 1, -0.8];
const c: Point = [-2.48, 0.9, -0.9],
  d: Point = [-2.48, 1, -0.9];
const seed = () =>
  mesh('RV_Static_Wrap_Front', 'Wrap_Front', [[a, [-2.48, 0.9, -0.7], b]]);

void test('front paint continuity propagates across shared edges but does not flood disconnected or inward surfaces', () => {
  const paint = mesh('RV_Static_Body_Paint', 'Body_Paint', [
    [a, b, c],
    [b, d, c],
    [
      [-2.48, 1.2, -0.8],
      [-2.48, 1.3, -0.8],
      [-2.48, 1.2, -0.9],
    ],
    [a, c, b],
    [c, [-2.48, 0.85, -0.95], [-2.48, 0.8, -0.9]],
  ]);
  assert.deepEqual(
    Array.from(findFrontWrapTransitions([seed(), paint]).get(paint) || []),
    [1, 1, 0, 0, 0],
  );
});

void test('eligibility uses closed world coordinates without changing indexed source data', () => {
  const paint = mesh('RV_Static_Body_Paint', 'Body_Paint', [[a, b, c]]);
  const neighbor = seed();
  for (const surface of [paint, neighbor]) {
    surface.geometry.translate(1, 0, 0);
    surface.position.x = -1;
    surface.updateMatrixWorld(true);
  }
  paint.geometry.setIndex([0, 1, 2]);
  const positions = Array.from(paint.geometry.attributes.position.array);
  assert.equal(findFrontWrapTransitions([neighbor, paint]).get(paint)?.[0], 1);
  assert.deepEqual(
    Array.from(paint.geometry.attributes.position.array),
    positions,
  );
  assert.deepEqual(Array.from(paint.geometry.index!.array), [0, 1, 2]);
});

void test('rear trim and moving panels remain excluded even when sharing a painted boundary', () => {
  const rear = mesh('RV_Static_Body_Paint', 'Body_Paint', [[a, b, c]]);
  rear.position.x = 5.36;
  rear.updateMatrixWorld(true);
  const door = mesh('RV_WebRig_Cab_L_Body_Paint', 'Body_Paint', [[a, b, c]]);
  const falseStatic = mesh('RV_Static_Body_Paint', 'Body_Paint', [[a, b, c]]);
  const hinge = new THREE.Group();
  hinge.name = 'WebRig_Cab_L';
  hinge.add(falseStatic);
  const result = findFrontWrapTransitions([seed(), rear, door, falseStatic]);
  assert.ok(!result.get(rear)?.some(Boolean));
  assert.ok(!result.has(door));
  assert.ok(!result.has(falseStatic));
});

void test('actual V80 missing headlamp transition faces are eligible on both sides while rear rails remain untouched', async () => {
  const bytes = fs.readFileSync('public/model/mxgarage-rv.glb');
  const loaded = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  loaded.scene.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = [];
  loaded.scene.traverse((object) => {
    if (object instanceof THREE.Mesh) meshes.push(object);
  });
  const masks = findFrontWrapTransitions(meshes);
  const paint = meshes.find(
    (surface) => surface.name === 'RV_Static_Body_Paint',
  )!;
  const flags = masks.get(paint)!;
  assert.ok(flags, 'the original static painted shell is included');
  const counts = [0, 0];
  const position = paint.geometry.getAttribute('position'),
    index = paint.geometry.index;
  const vertex = new THREE.Vector3(),
    center = new THREE.Vector3();
  for (let triangle = 0; triangle < flags.length; triangle++) {
    if (!flags[triangle]) continue;
    center.set(0, 0, 0);
    for (let k = 0; k < 3; k++) {
      vertex
        .fromBufferAttribute(
          position,
          index ? index.getX(triangle * 3 + k) : triangle * 3 + k,
        )
        .applyMatrix4(paint.matrixWorld);
      center.add(vertex);
    }
    center.divideScalar(3);
    assert.ok(
      center.x < -2.4 && center.x > -2.86,
      'only the audited front transition is extended',
    );
    assert.ok(
      center.y > 0.47 && center.y < 1.45,
      'hood, cabin and underbody remain excluded',
    );
    counts[center.z < -0.0473 ? 0 : 1]++;
  }
  assert.ok(
    counts.every((count) => count > 30 && count < 1500),
    `bounded front coverage on both sides: ${counts.join(', ')}`,
  );
  assert.equal(masks.size, 1, 'no moving panel or other material is added');
});
