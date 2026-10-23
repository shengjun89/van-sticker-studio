import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// User-authorized lower-edge 180-degree tandem demonstration rig.
// Reuse the source blade cross-sections; body and glazing geometry stay intact.
const source =
  process.argv[2] || '../rv_model/web_studio_asset/mxgarage-rv.glb';
const output = process.argv[3] || 'public/model/mxgarage-rv.glb';
const input = fs.readFileSync(source),
  jsonLength = input.readUInt32LE(12);
const gltf = JSON.parse(input.subarray(20, 20 + jsonLength).toString());
const oldBin = input.subarray(
  28 + jsonLength,
  28 + jsonLength + input.readUInt32LE(20 + jsonLength),
);
let bin = Buffer.from(oldBin);
const { scene } = await new GLTFLoader().parseAsync(
  input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength),
  '',
);
scene.updateMatrixWorld(true);
const glass = scene.getObjectByName('RV_Static_Glass');
glass.material.side = T.DoubleSide;
const ray = new T.Raycaster();
function glassX(y, z) {
  ray.set(new T.Vector3(-4, y, z), new T.Vector3(1, 0, 0));
  return ray.intersectObject(glass)[0]?.point.x;
}
// Linear fit to the actual exported windscreen. X is longitudinal, Y is up.
const samples = [];
for (let y = 1.56; y <= 2.04; y += 0.024)
  for (let z = -0.75; z <= 0.75; z += 0.075) {
    const x = glassX(y, z);
    if (x !== undefined) samples.push([x, y]);
  }
const meanX = samples.reduce((a, p) => a + p[0], 0) / samples.length,
  meanY = samples.reduce((a, p) => a + p[1], 0) / samples.length;
let covariance = 0,
  variance = 0;
for (const [x, y] of samples) {
  covariance += (x - meanX) * (y - meanY);
  variance += (y - meanY) ** 2;
}
const normal = new T.Vector3(-1, covariance / variance, 0).normalize();
const steps = 96,
  maxDegrees = 180,
  report = {
    sourceSha256: crypto.createHash('sha256').update(input).digest('hex'),
    method:
      'User-requested lower-edge 180-degree tandem demonstration: 500 mm blades, roots at Y=1.575 m with 520 mm spacing and overlapping swept regions. Original rubber cross-sections conform to measured glazing throughout the upper semicircle. Custom display motion, not factory dimensions.',
    normal: normal.toArray(),
    maxDegrees,
    steps,
    wipers: [],
  };
const metadata = JSON.parse(
  fs.readFileSync('public/model/motion_metadata.json', 'utf8'),
);
function accessorBytes(index) {
  const a = gltf.accessors[index],
    v = gltf.bufferViews[a.bufferView];
  return v.byteOffset + (a.byteOffset || 0);
}
function overwrite(index, array) {
  const a = gltf.accessors[index],
    offset = accessorBytes(index);
  Buffer.from(array.buffer, array.byteOffset, array.byteLength).copy(
    bin,
    offset,
  );
  a.min = [0, 1, 2].map((k) =>
    Math.min(
      ...Array.from({ length: array.length / 3 }, (_, i) => array[i * 3 + k]),
    ),
  );
  a.max = [0, 1, 2].map((k) =>
    Math.max(
      ...Array.from({ length: array.length / 3 }, (_, i) => array[i * 3 + k]),
    ),
  );
}
function addAccessor(array) {
  const offset = bin.length;
  bin = Buffer.concat([
    bin,
    Buffer.from(array.buffer, array.byteOffset, array.byteLength),
  ]);
  const view =
    gltf.bufferViews.push({
      buffer: 0,
      byteOffset: offset,
      byteLength: array.byteLength,
      target: 34962,
    }) - 1;
  return (
    gltf.accessors.push({
      bufferView: view,
      componentType: 5126,
      count: array.length / 3,
      type: 'VEC3',
      min: [0, 1, 2].map((k) =>
        Math.min(
          ...Array.from(
            { length: array.length / 3 },
            (_, i) => array[i * 3 + k],
          ),
        ),
      ),
      max: [0, 1, 2].map((k) =>
        Math.max(
          ...Array.from(
            { length: array.length / 3 },
            (_, i) => array[i * 3 + k],
          ),
        ),
      ),
    }) - 1
  );
}
for (let number = 1; number <= 2; number++) {
  const name = `RV_WebRig_Wiper_${number}_Rubber`,
    mesh = scene.getObjectByName(name),
    p = mesh.geometry.attributes.position;
  if (mesh.geometry.morphAttributes.position?.length)
    throw new Error(
      'Use the unmodified source GLB; do not calibrate an already calibrated asset.',
    );
  if (p.count !== 432)
    throw new Error(
      'The source wiper topology changed; inspect its spline rings before recalibrating.',
    );
  const center = (start) => {
    const c = new T.Vector3();
    for (let k = 0; k < 6; k++)
      c.add(new T.Vector3().fromBufferAttribute(p, start + k));
    return c.multiplyScalar(1 / 6);
  };
  const bladeCenters = Array.from({ length: 65 }, (_, i) => center(24 + i * 6));
  const armCenters = Array.from({ length: 3 }, (_, i) => center(414 + i * 6));
  const root = scene.getObjectByName(`WebRig_Wiper_${number}`).position;
  // Source cap/spline vertex ordering is guarded: the arm begins at the rig root.
  if (armCenters[0].distanceTo(root) > 0.00001)
    throw new Error('Unexpected source arm root.');
  // Measured windscreen: Y 1.53837..2.07780, Z -0.90059..0.80623.
  // The lower edge rounds inward. A 580 mm outer sweep radius and 520 mm
  // spacing fit both semicircles inside the measured pane with 500 mm blades.
  // Both blades start along -Z and sweep in the same direction.
  const y = 1.575,
    z = -0.04718 + (number === 1 ? 0.26 : -0.26);
  const gx = glassX(y, z);
  if (gx === undefined)
    throw new Error('No measured glazing at lower-edge pivot.');
  const pivot = new T.Vector3(gx - 0.024, y, z),
    axis = normal.clone().negate();
  const compactCenters = bladeCenters.map((_, i) =>
    pivot.clone().add(new T.Vector3(0, 0, -(0.08 + (0.5 * i) / 64))),
  );
  const geometry = mesh.geometry.clone();
  const poses = [];
  let maxBladeShift = 0,
    minGap = Infinity,
    maxGap = -Infinity;
  for (let step = 0; step <= steps; step++) {
    const angle = ((step / steps) * maxDegrees * Math.PI) / 180,
      q = new T.Quaternion().setFromAxisAngle(axis, angle);
    const conform = (c) => {
      const v = c.clone().sub(pivot).applyQuaternion(q).add(pivot);
      const x = glassX(v.y, v.z);
      if (x === undefined)
        throw new Error(
          `Blade outside glass at wiper ${number}, step ${step}: ${v.toArray()} source ${c.toArray()}`,
        );
      v.x = x - 0.0085;
      return v;
    };
    const bc = compactCenters.map(conform),
      attachment = conform(compactCenters[32]);
    const jaw = attachment.clone().addScaledVector(normal, 0.012);
    const ac = [pivot, jaw, attachment],
      positions = new Float32Array(p.count * 3);
    for (let j = 0; j < p.count; j++) {
      const original = new T.Vector3().fromBufferAttribute(p, j);
      let result;
      if (j >= 12 && j < 414) {
        const ring = j < 24 ? (j < 18 ? 64 : 0) : Math.floor((j - 24) / 6);
        result = original
          .clone()
          .sub(bladeCenters[ring])
          .applyQuaternion(q)
          .add(bc[ring]);
        if (step === 0)
          maxBladeShift = Math.max(maxBladeShift, result.distanceTo(original));
        const x = glassX(result.y, result.z);
        if (x === undefined)
          throw new Error(
            `Blade surface outside glass at wiper ${number}, step ${step}, vertex ${j}: ${result.toArray()}, source ${original.toArray()}, center ${bladeCenters[ring].toArray()}`,
          );
        const offset = original
          .clone()
          .sub(bladeCenters[ring])
          .applyQuaternion(q);
        // Preserve the tube's normal thickness while the flexible rubber follows
        // the actual curved glass beneath each vertex, including the corners.
        result.x = x - 0.0085 + offset.x - (covariance / variance) * offset.y;
        const gap = x - result.x;
        minGap = Math.min(minGap, gap);
        maxGap = Math.max(maxGap, gap);
      } else {
        const ring = j < 12 ? (j < 6 ? 2 : 0) : Math.floor((j - 414) / 6);
        const oldTangent = armCenters[Math.min(2, ring + 1)]
          .clone()
          .sub(armCenters[Math.max(0, ring - 1)])
          .normalize();
        const newTangent = ac[Math.min(2, ring + 1)]
          .clone()
          .sub(ac[Math.max(0, ring - 1)])
          .normalize();
        const orientation = new T.Quaternion().setFromUnitVectors(
          oldTangent,
          newTangent,
        );
        result = original
          .clone()
          .sub(armCenters[ring])
          .applyQuaternion(orientation)
          .add(ac[ring]);
      }
      result.toArray(positions, j * 3);
    }
    geometry.setAttribute('position', new T.BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    poses.push({
      position: positions,
      normal: new Float32Array(geometry.attributes.normal.array),
    });
  }
  // The source glazing has small faceted front/back offsets. Protect the
  // swept interval too, not just its keyframes, with the smallest outward
  // clearance envelope. This keeps a continuous flexible blade and fixed root.
  const frontOffsets = new Float64Array(steps + 1);
  for (let frame = 0; frame < steps; frame++) {
    let correction = 0;
    for (const t of [0.25, 0.5, 0.75]) {
      const a = poses[frame].position,
        b = poses[frame + 1].position;
      for (let j = 12; j < 414; j++) {
        const x =
          a[j * 3] * (1 - t) +
          b[j * 3] * t -
          frontOffsets[frame] * (1 - t) -
          frontOffsets[frame + 1] * t;
        const y = a[j * 3 + 1] * (1 - t) + b[j * 3 + 1] * t;
        const z = a[j * 3 + 2] * (1 - t) + b[j * 3 + 2] * t;
        const surface = glassX(y, z);
        if (surface === undefined)
          throw new Error('Interpolated blade leaves glazing.');
        correction = Math.max(correction, 0.0016 - (surface - x));
      }
    }
    if (correction > 0) {
      frontOffsets[frame] += correction;
      frontOffsets[frame + 1] += correction;
    }
  }
  minGap = Infinity;
  maxGap = -Infinity;
  maxBladeShift = 0;
  for (let frame = 0; frame <= steps; frame++) {
    const positions = poses[frame].position;
    for (let j = 0; j < p.count; j++) {
      const isRoot = (j >= 6 && j < 12) || (j >= 414 && j < 420);
      if (!isRoot) positions[j * 3] -= frontOffsets[frame];
      if (j >= 12 && j < 414) {
        const surface = glassX(positions[j * 3 + 1], positions[j * 3 + 2]);
        const gap = surface - positions[j * 3];
        minGap = Math.min(minGap, gap);
        maxGap = Math.max(maxGap, gap);
        if (frame === 0)
          maxBladeShift = Math.max(
            maxBladeShift,
            Math.abs(positions[j * 3] - p.getX(j)),
          );
      }
    }
    geometry.setAttribute('position', new T.BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    poses[frame].normal = new Float32Array(geometry.attributes.normal.array);
  }
  const node = gltf.nodes.find((n) => n.name === name),
    rig = gltf.nodes.find((n) => n.name === `WebRig_Wiper_${number}`),
    gm = gltf.meshes[node.mesh],
    primitive = gm.primitives[0];
  rig.translation = pivot.toArray();
  node.translation = pivot.clone().negate().toArray();
  overwrite(primitive.attributes.POSITION, poses[0].position);
  overwrite(primitive.attributes.NORMAL, poses[0].normal);
  primitive.targets = [];
  for (let step = 1; step <= steps; step++) {
    const delta = {};
    for (const key of ['position', 'normal']) {
      const a = new Float32Array(p.count * 3);
      for (let j = 0; j < a.length; j++)
        a[j] = poses[step][key][j] - poses[0][key][j];
      delta[key.toUpperCase()] = addAccessor(a);
    }
    primitive.targets.push(delta);
  }
  gm.weights = Array(steps).fill(0);
  gm.extras = {
    ...gm.extras,
    targetNames: Array.from(
      { length: steps },
      (_, i) => `sweep_${String(i + 1).padStart(2, '0')}`,
    ),
  };
  const motion = metadata.motions.find((m) => m.id === `wiper-${number}`);
  motion.nodes[0] = {
    ...motion.nodes[0],
    kind: 'morph',
    axis: axis.toArray(),
    maxRadians: (maxDegrees * Math.PI) / 180,
    closedPosition: pivot.toArray(),
    morphSteps: steps,
  };
  motion.rangeDegrees = [0, maxDegrees];
  report.wipers.push({
    id: motion.id,
    oldRoot: root.toArray(),
    pivot: pivot.toArray(),
    bladeLengthMeters: 0.5,
    nominalOuterSweepRadiusMeters: 0.58,
    nominalInnerSweepRadiusMeters: 0.08,
    parkedBladeMaxChangeMeters: maxBladeShift,
    minGlassClearanceMeters: minGap,
    maxGlassClearanceMeters: maxGap,
    bladeVertices: 402,
    armVertices: 30,
    maximumInterpolationCorrectionMeters: Math.max(...frontOffsets),
  });
}
gltf.buffers[0].byteLength = bin.length;
const raw = Buffer.from(JSON.stringify(gltf));
const json = Buffer.concat([raw, Buffer.alloc((4 - (raw.length % 4)) % 4, 32)]);
const h = Buffer.alloc(20);
h.writeUInt32LE(0x46546c67, 0);
h.writeUInt32LE(2, 4);
h.writeUInt32LE(28 + json.length + bin.length, 8);
h.writeUInt32LE(json.length, 12);
h.writeUInt32LE(0x4e4f534a, 16);
const bh = Buffer.alloc(8);
bh.writeUInt32LE(bin.length, 0);
bh.writeUInt32LE(0x004e4942, 4);
fs.writeFileSync(output, Buffer.concat([h, json, bh, bin]));
fs.writeFileSync(
  path.join(path.dirname(output), 'motion_metadata.json'),
  JSON.stringify(metadata, null, 2) + '\n',
);
report.outputSha256 = crypto
  .createHash('sha256')
  .update(fs.readFileSync(output))
  .digest('hex');
report.bytes = fs.statSync(output).size;
fs.writeFileSync(
  path.join(path.dirname(output), 'wiper_calibration.json'),
  JSON.stringify(report, null, 2) + '\n',
);
console.log(JSON.stringify(report, null, 2));
