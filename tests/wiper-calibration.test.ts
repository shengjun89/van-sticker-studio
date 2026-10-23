import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DoubleSide, Mesh, Raycaster, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  applyCalibratedWiper,
  validateWiperRig,
} from '../lib/wiper-calibration.ts';

const assetDirectory = process.env.WIPER_ASSET_DIR || 'public/model';

async function loadVehicle() {
  const bytes = fs.readFileSync(`${assetDirectory}/mxgarage-rv.glb`);
  const array = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  );
  const { scene } = await new GLTFLoader().parseAsync(array, '');
  scene.updateMatrixWorld(true);
  return scene;
}

void test('a stale or incomplete wiper asset is rejected before it can animate', async () => {
  const scene = await loadVehicle();
  const rig = scene.getObjectByName('WebRig_Wiper_1')!;
  const mesh = scene.getObjectByName('RV_WebRig_Wiper_1_Rubber') as Mesh;
  assert.doesNotThrow(() => validateWiperRig(rig, 96));
  mesh.morphTargetInfluences = mesh.morphTargetInfluences!.slice(0, 24);
  assert.throws(() => validateWiperRig(rig, 96), /Wiper asset mismatch/);
  mesh.morphTargetInfluences = undefined;
  assert.throws(() => validateWiperRig(rig, 96), /Wiper asset mismatch/);
});
function centerOfRing(mesh: Mesh, start: number) {
  const sum = new Vector3();
  for (let i = 0; i < 6; i++)
    sum.add(mesh.getVertexPosition(start + i, new Vector3()));
  return sum.multiplyScalar(1 / 6).applyMatrix4(mesh.matrixWorld);
}
function pointSegmentDistance(p: Vector3, a: Vector3, b: Vector3) {
  const delta = b.clone().sub(a);
  const t = Math.min(
    1,
    Math.max(0, p.clone().sub(a).dot(delta) / delta.lengthSq()),
  );
  return p.distanceTo(a.clone().addScaledVector(delta, t));
}
function crossesInFront(p: Vector3, p1: Vector3, q: Vector3, q1: Vector3) {
  const ax = p1.z - p.z,
    ay = p1.y - p.y;
  const bx = q1.z - q.z,
    by = q1.y - q.y;
  const cx = q.z - p.z,
    cy = q.y - p.y;
  const determinant = ax * by - ay * bx;
  if (Math.abs(determinant) < 1e-12) return false;
  const s = (cx * by - cy * bx) / determinant;
  const t = (cx * ay - cy * ax) / determinant;
  return s > 0 && s < 1 && t > 0 && t < 1;
}
function segmentDistance(p: Vector3, p1: Vector3, q: Vector3, q1: Vector3) {
  const u = p1.clone().sub(p),
    v = q1.clone().sub(q),
    w = p.clone().sub(q);
  const a = u.lengthSq(),
    b = u.dot(v),
    c = v.lengthSq(),
    d = u.dot(w),
    e = v.dot(w);
  const determinant = a * c - b * b;
  let minimum = Math.min(
    pointSegmentDistance(p, q, q1),
    pointSegmentDistance(p1, q, q1),
    pointSegmentDistance(q, p, p1),
    pointSegmentDistance(q1, p, p1),
  );
  if (determinant > 1e-16) {
    const s = (b * e - c * d) / determinant,
      t = (a * e - b * d) / determinant;
    if (s >= 0 && s <= 1 && t >= 0 && t <= 1)
      minimum = Math.min(
        minimum,
        p
          .clone()
          .addScaledVector(u, s)
          .distanceTo(q.clone().addScaledVector(v, t)),
      );
  }
  return minimum;
}

void test('calibrated wiper roots stay fixed and every intermediate blade pose stays in front of the windscreen', async (context) => {
  const scene = await loadVehicle();
  const glass = scene.getObjectByName('RV_Static_Glass') as Mesh;
  const glassMaterials = Array.isArray(glass.material)
    ? glass.material
    : [glass.material];
  glassMaterials.forEach((material) => {
    material.side = DoubleSide;
  });
  const ray = new Raycaster();
  const rigs = [1, 2].map((number) =>
    scene.getObjectByName(`WebRig_Wiper_${number}`)!,
  );
  const meshes = [1, 2].map(
    (number) =>
      scene.getObjectByName(`RV_WebRig_Wiper_${number}_Rubber`) as Mesh,
  );
  const roots = meshes.map((mesh) => centerOfRing(mesh, 414));
  // These points in the center of the windscreen must be wiped by both blades
  // at different times. A shared path must not mean simultaneous collisions.
  const overlapSamples = [0.07, 0.09, 0.11].flatMap((dy) =>
    [-0.025, 0, 0.025].map((dz) => {
      const y = roots[0].y + dy,
        z = (roots[0].z + roots[1].z) / 2 + dz;
      ray.set(new Vector3(-4, y, z), new Vector3(1, 0, 0));
      const hit = ray.intersectObject(glass)[0]!;
      return hit.point.clone().add(new Vector3(-0.0085, 0, 0));
    }),
  );
  const overlapDistances = meshes.map(() => overlapSamples.map(() => Infinity));
  let minimumClearance = Infinity,
    maximumClearance = 0,
    minimumPairDistance = Infinity;
  for (let step = 0; step <= 192; step++) {
    const phase = step / 192;
    rigs.forEach((rig) => applyCalibratedWiper(rig, phase));
    for (const [index, mesh] of meshes.entries()) {
      assert.ok(
        centerOfRing(mesh, 414).distanceTo(roots[index]) < 1e-7,
        `support root drifted at phase ${phase}`,
      );
      assert.equal(mesh.morphTargetInfluences!.length, 96);
      for (const [cap, ring] of [
        [0, 426],
        [6, 414],
        [12, 408],
        [18, 24],
      ])
        assert.ok(
          centerOfRing(mesh, cap).distanceTo(centerOfRing(mesh, ring)) < 1e-7,
          `cap separated from its end ring at ${phase}`,
        );
      for (let vertex = 0; vertex < 432; vertex++) {
        const blade = vertex >= 12 && vertex < 414;
        const position = mesh
          .getVertexPosition(vertex, new Vector3())
          .applyMatrix4(mesh.matrixWorld);
        ray.set(new Vector3(-4, position.y, position.z), new Vector3(1, 0, 0));
        const hit = ray.intersectObject(glass)[0];
        assert.ok(
          hit,
          `blade left the glass outline: wiper ${index + 1}, phase ${phase}, vertex ${vertex}`,
        );
        assert.ok(
          Math.abs(hit.face!.normal.y) > 0.4,
          'hit must be the inclined windscreen, not an interior gauge',
        );
        const clearance = hit.point.x - position.x;
        minimumClearance = Math.min(minimumClearance, clearance);
        maximumClearance = Math.max(maximumClearance, clearance);
        assert.ok(
          clearance > 0.001,
          `blade penetrated glazing: ${clearance}; wiper ${index + 1}, phase ${phase}, vertex ${vertex}`,
        );
        assert.ok(
          clearance < (blade ? 0.022 : 0.04),
          `wiper floated away from glazing: ${clearance}`,
        );
      }
    }
    const lines = meshes.map((mesh) =>
      Array.from({ length: 65 }, (_, index) =>
        centerOfRing(mesh, 24 + index * 6),
      ),
    );
    for (const side of [0, 1])
      for (const [index, sample] of overlapSamples.entries())
        for (let segment = 0; segment < 64; segment++)
          overlapDistances[side][index] = Math.min(
            overlapDistances[side][index],
            pointSegmentDistance(
              sample,
              lines[side][segment],
              lines[side][segment + 1],
            ),
          );
    const directions = lines.map((line) =>
      line[64].clone().sub(line[0]).normalize(),
    );
    for (const side of [0, 1])
      for (const vertex of [6, 7, 8, 9, 10, 11, 414, 415, 416, 417, 418, 419]) {
        const p = meshes[side]
          .getVertexPosition(vertex, new Vector3())
          .applyMatrix4(meshes[side].matrixWorld);
        for (let segment = 0; segment < 64; segment++)
          assert.ok(
            pointSegmentDistance(
              p,
              lines[side][segment],
              lines[side][segment + 1],
            ) > 0.005,
            `own pivot cap is too close to its blade at ${phase}`,
          );
      }
    const arms = meshes.map((mesh) =>
      [414, 420, 426].map((start) => centerOfRing(mesh, start)),
    );
    for (const side of [0, 1])
      for (let a = 0; a < 2; a++) {
        for (let b = 0; b < 64; b++)
          assert.ok(
            segmentDistance(
              arms[side][a],
              arms[side][a + 1],
              lines[1 - side][b],
              lines[1 - side][b + 1],
            ) > 0.01,
            `support arm touched opposite blade at ${phase}`,
          );
        for (let b = 0; b < 2; b++)
          assert.ok(
            segmentDistance(
              arms[side][a],
              arms[side][a + 1],
              arms[1 - side][b],
              arms[1 - side][b + 1],
            ) > 0.01,
            `support arms touched at ${phase}`,
          );
      }
    for (const line of lines) {
      const length = line
        .slice(1)
        .reduce((sum, p, index) => sum + p.distanceTo(line[index]), 0);
      assert.ok(
        length > 0.48 && length < 0.55,
        `blade length changed unexpectedly: ${length}`,
      );
    }
    assert.ok(
      directions[0].dot(directions[1]) > 0.995,
      `wipers sweep in opposite directions at ${phase}`,
    );
    for (let a = 0; a < 64; a++)
      for (let b = 0; b < 64; b++) {
        assert.ok(
          !crossesInFront(
            lines[0][a],
            lines[0][a + 1],
            lines[1][b],
            lines[1][b + 1],
          ),
          `wipers form an X in front view at ${phase}`,
        );
        minimumPairDistance = Math.min(
          minimumPairDistance,
          segmentDistance(
            lines[0][a],
            lines[0][a + 1],
            lines[1][b],
            lines[1][b + 1],
          ),
        );
      }
  }
  assert.ok(
    minimumPairDistance > 0.0076,
    `blades collide: centerline distance ${minimumPairDistance}`,
  );
  assert.ok(minimumClearance > 0.001);
  for (const distances of overlapDistances)
    assert.ok(
      distances.every((distance) => distance < 0.008),
      `both blades must cover the center overlap patch: ${distances.join(', ')}`,
    );
  context.diagnostic(
    JSON.stringify({
      phaseSamples: 193,
      verticesPerBlade: 402,
      minimumClearanceMeters: minimumClearance,
      maximumClearanceMeters: maximumClearance,
      minimumBladeCenterlineDistanceMeters: minimumPairDistance,
      overlapWitnessesPerBlade: overlapSamples.length,
      maximumOverlapWitnessDistanceMeters: Math.max(...overlapDistances.flat()),
    }),
  );
  rigs.forEach((rig) => applyCalibratedWiper(rig, 0));
  meshes.forEach((mesh) =>
    assert.ok(mesh.morphTargetInfluences!.every((weight) => weight === 0)),
  );
});

void test('wiper pose blending clamps invalid phases and uses no more than two neighbouring poses', async () => {
  const scene = await loadVehicle(),
    rig = scene.getObjectByName('WebRig_Wiper_1')!;
  const mesh = scene.getObjectByName('RV_WebRig_Wiper_1_Rubber') as Mesh;
  const metadata = JSON.parse(
    fs.readFileSync(`${assetDirectory}/motion_metadata.json`, 'utf8'),
  );
  const motion = metadata.motions.find(
    (entry: { id: string }) => entry.id === 'wiper-1',
  );
  assert.equal(motion.nodes[0].kind, 'morph');
  assert.equal(motion.nodes[0].morphSteps, mesh.morphTargetInfluences!.length);
  assert.deepEqual(motion.rangeDegrees, [0, 180]);
  assert.deepEqual(motion.nodes[0].closedPosition, rig.position.toArray());
  for (const phase of [-1, 0, 0.023, 0.5, 0.997, 1, 2, NaN]) {
    applyCalibratedWiper(rig, phase);
    const weights = mesh.morphTargetInfluences!;
    assert.ok(weights.every((weight) => weight >= 0 && weight <= 1));
    assert.ok(weights.filter((weight) => weight > 0).length <= 2);
    assert.ok(weights.reduce((sum, weight) => sum + weight, 0) <= 1.000001);
  }
});

void test('each wiper parks at the lower glass edge and makes a real 180-degree sweep', async () => {
  const scene = await loadVehicle();
  const rigs = [1, 2].map((n) => scene.getObjectByName(`WebRig_Wiper_${n}`)!);
  const meshes = [1, 2].map(
    (n) => scene.getObjectByName(`RV_WebRig_Wiper_${n}_Rubber`) as Mesh,
  );
  const phases = [0, 0.5, 1].map((phase) => {
    rigs.forEach((rig) => applyCalibratedWiper(rig, phase));
    return meshes.map((mesh) => {
      const root = centerOfRing(mesh, 414),
        a = centerOfRing(mesh, 24),
        b = centerOfRing(mesh, 24 + 64 * 6);
      assert.ok(
        root.y > 1.54 && root.y < 1.59,
        'pivot must sit along the lower windscreen edge, not mid-glass',
      );
      assert.ok(
        a.distanceTo(b) > 0.48 && a.distanceTo(b) < 0.55,
        'blade should retain its compact calibrated length',
      );
      if (phase === 0 || phase === 1)
        assert.ok(
          Math.max(a.y, b.y) < 1.59,
          'horizontal end poses must park along the lower glass edge',
        );
      if (phase === 0.5)
        assert.ok(
          b.y > 1.94,
          'upright blade must reach the upper viewing area',
        );
      return b.clone().sub(a).normalize();
    });
  });
  for (let i = 0; i < 2; i++) {
    assert.ok(
      phases[0][i].dot(phases[2][i]) < -0.98,
      'end pose must be a half-turn from the parked pose',
    );
    assert.ok(
      Math.abs(phases[0][i].dot(phases[1][i])) < 0.12,
      'mid-sweep must be approximately perpendicular',
    );
  }
});
