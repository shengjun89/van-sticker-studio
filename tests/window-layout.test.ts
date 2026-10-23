import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DoubleSide, Mesh, Raycaster, Vector3, Box3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
async function vehicle() {
  const b = fs.readFileSync('public/model/mxgarage-rv.glb');
  const { scene } = await new GLTFLoader().parseAsync(
    b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
    '',
  );
  scene.updateMatrixWorld(true);
  return scene;
}
const windows = [
  { id: 1, x: 2.45694, y: 2.095156, z: -1.088, width: 0.448 },
  { id: 2, x: 1.370951, y: 2.095156, z: -1.088, width: 0.448 },
  { id: 3, x: 1.9, y: 2.041, z: 0.978, width: 0.948 },
  { id: 4, x: 0.1, y: 2.041, z: 0.978, width: 0.948 },
];
void test('V02 living windows have four real openings and paired heights', async () => {
  const scene = await vehicle(),
    paint: Mesh[] = [];
  scene.traverse((o) => {
    if (o instanceof Mesh && o.userData.wrapSurface) {
      for (const m of Array.isArray(o.material) ? o.material : [o.material])
        m.side = DoubleSide;
      paint.push(o);
    }
  });
  for (const w of windows) {
    const glass = scene.getObjectByName(`RV_WebRig_Window_${w.id}_Glass`)!;
    assert.ok(glass);
    const box = new Box3().setFromObject(glass),
      center = box.getCenter(new Vector3());
    assert.ok(
      Math.abs(center.x - w.x) < 0.003 &&
        Math.abs(center.y - w.y) < 0.003 &&
        Math.abs(center.z - w.z) < 0.003,
      `window-${w.id} incorrect glazing center ${center.toArray().join(',')}`,
    );
    assert.ok(Math.abs(box.max.x - box.min.x - w.width) < 0.003);
    const side = Math.sign(w.z),
      ray = new Raycaster(
        new Vector3(w.x, w.y, side * 2),
        new Vector3(0, 0, -side),
        0,
        1.15,
      );
    assert.equal(
      ray.intersectObjects(paint, false).length,
      0,
      `window-${w.id} blocked by body paint`,
    );
  }
  const oldLow = new Raycaster(
    new Vector3(2.486, 1.55, -2),
    new Vector3(0, 0, 1),
    0,
    1.15,
  );
  assert.ok(
    oldLow.intersectObjects(paint, false).length > 0,
    'old right lower opening must be filled',
  );
});
void test('six windows open outward at their top edge with complete hit targets', async () => {
  const scene = await vehicle(),
    meta = JSON.parse(
      fs.readFileSync('public/model/motion_metadata.json', 'utf8'),
    );
  const motions = meta.motions.filter((m: { id: string }) =>
    m.id.startsWith('window-'),
  );
  assert.equal(motions.length, 6);
  for (const m of motions) {
    const n = m.nodes[0],
      rig = scene.getObjectByName(n.name)!;
    assert.ok(m.hitNodeNames.length > 0);
    for (const name of m.hitNodeNames) assert.ok(scene.getObjectByName(name));
    const before = new Box3().setFromObject(rig).getCenter(new Vector3()),
      pivot = rig.getWorldPosition(new Vector3());
    assert.ok(pivot.y > before.y);
    rig.rotateOnAxis(
      new Vector3(n.axis[0], n.axis[1], n.axis[2]),
      n.maxRadians,
    );
    scene.updateMatrixWorld(true);
    const after = new Box3().setFromObject(rig).getCenter(new Vector3());
    assert.ok(
      Math.abs(after.z) > Math.abs(before.z) + 0.02,
      `${m.id} must open outward`,
    );
  }
});
