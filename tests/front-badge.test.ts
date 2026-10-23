import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Mesh, Vector3 } from 'three';
void test('front badge sits on the grille support plane with less than 5mm relief', async () => {
  const fixture = JSON.parse(
    fs.readFileSync('tests/fixtures/front-badge.json', 'utf8'),
  ) as {
    mountingX: number;
    maximumRelief: number;
    parts: { name: string; vertices: number[] }[];
  };
  const b = fs.readFileSync('public/model/mxgarage-rv.glb');
  const { scene } = await new GLTFLoader().parseAsync(
    b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
    '',
  );
  scene.updateMatrixWorld(true);
  let min = Infinity,
    max = -Infinity;
  for (const part of fixture.parts) {
    const mesh = scene.getObjectByName(part.name) as Mesh;
    for (const i of part.vertices) {
      const p = new Vector3()
        .fromBufferAttribute(mesh.geometry.attributes.position, i)
        .applyMatrix4(mesh.matrixWorld);
      min = Math.min(min, p.x);
      max = Math.max(max, p.x);
    }
  }
  assert.ok(
    Math.abs(max - fixture.mountingX) < 0.00005,
    `backing is off mounting plane by ${String((max - fixture.mountingX) * 1000)} mm`,
  );
  assert.ok(
    max - min < fixture.maximumRelief,
    'emblem relief must remain below 5 mm',
  );
});
