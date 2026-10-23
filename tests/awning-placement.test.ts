import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Box3, Mesh, Vector3 } from 'three';
async function load() {
  const b = fs.readFileSync('public/model/mxgarage-rv.glb');
  const { scene } = await new GLTFLoader().parseAsync(
    b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
    '',
  );
  scene.updateMatrixWorld(true);
  return scene;
}
void test('awning stops near entry door front and stays clear of the overcab window', async () => {
  const scene = await load(),
    f = JSON.parse(
      fs.readFileSync('tests/fixtures/awning-placement.json', 'utf8'),
    ) as {
      frontX: number;
      rearX: number;
      parts: { name: string; vertices: number[] }[];
    };
  const box = new Box3();
  for (const part of f.parts) {
    const mesh = scene.getObjectByName(part.name) as Mesh;
    for (const i of part.vertices)
      box.expandByPoint(
        new Vector3()
          .fromBufferAttribute(mesh.geometry.attributes.position, i)
          .applyMatrix4(mesh.matrixWorld),
      );
  }
  assert.ok(
    Math.abs(box.min.x - f.frontX) < 0.002,
    `cassette front ${String(box.min.x)} should stop near door`,
  );
  assert.ok(Math.abs(box.max.x - f.rearX) < 0.002, 'rear end stays in place');
  const rig = scene.getObjectByName('WebRig_Awning')!;
  for (const scale of [0.012, 0.25, 0.5, 1]) {
    rig.scale.set(1, scale, scale);
    scene.updateMatrixWorld(true);
    const expanded = new Box3().setFromObject(rig);
    assert.ok(
      expanded.min.x > box.min.x + 0.04,
      'cloth and front legs stay inside cassette ends',
    );
    assert.ok(
      expanded.max.x < box.max.x - 0.04,
      'rear legs stay inside cassette ends',
    );
  }
  const meta = JSON.parse(
    fs.readFileSync('public/model/motion_metadata.json', 'utf8'),
  );
  const motion = meta.motions.find((m: { id: string }) => m.id === 'awning');
  assert.ok(
    Math.abs(motion.nodes[0].closedPosition[0] - rig.position.x) < 0.0001,
  );
  const region = meta.hitRegions.find((r: { id: string }) => r.id === 'awning');
  assert.ok(Math.abs(region.bounds.min[0] - box.min.x) < 0.03);
  assert.ok(Math.abs(region.bounds.max[0] - box.max.x) < 0.03);
});
