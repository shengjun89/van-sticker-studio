import fs from 'node:fs';
import crypto from 'node:crypto';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Vector3 } from 'three';
const dir = '../work/拉花网页前杠黑饰板_20261007',
  backup = `${dir}/backup`;
fs.mkdirSync(backup, { recursive: true });
for (const f of [
  'mxgarage-rv.glb',
  'motion_metadata.json',
  'wiper_calibration.json',
])
  if (!fs.existsSync(`${backup}/${f}`))
    fs.copyFileSync(`public/model/${f}`, `${backup}/${f}`);
const b = fs.readFileSync(`${backup}/mxgarage-rv.glb`),
  jl = b.readUInt32LE(12),
  g = JSON.parse(b.subarray(20, 20 + jl));
let bin = Buffer.from(b.subarray(28 + jl));
const { scene } = await new GLTFLoader().parseAsync(
  b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
  '',
);
scene.updateMatrixWorld(true);
const poly = JSON.parse(fs.readFileSync(`${dir}/bumper-outline.json`));
function inside(y, z) {
  let yes = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i],
      b = poly[j];
    if (
      a[1] > z != b[1] > z &&
      y < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]
    )
      yes = !yes;
  }
  return yes;
}
function append(array, type, componentType, min, max) {
  bin = Buffer.concat([bin, Buffer.alloc(-bin.length & 3)]);
  const byteOffset = bin.length,
    data = Buffer.from(array.buffer, array.byteOffset, array.byteLength);
  bin = Buffer.concat([bin, data]);
  const view =
    g.bufferViews.push({ buffer: 0, byteOffset, byteLength: data.length }) - 1;
  const a = {
    bufferView: view,
    componentType,
    count: array.length / { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[type],
    type,
  };
  if (min) a.min = min;
  if (max) a.max = max;
  return g.accessors.push(a) - 1;
}
const material =
  g.materials.push({
    name: 'Bumper_Trim_Black',
    pbrMetallicRoughness: {
      baseColorFactor: [0.009, 0.011, 0.012, 1],
      metallicFactor: 0,
      roughnessFactor: 0.72,
    },
    doubleSided: false,
  }) - 1;
const changes = [];
let total = 0;
for (const node of [...g.nodes]) {
  if (!node.name?.startsWith('RV_Static_') || node.mesh === undefined) continue;
  const obj = scene.getObjectByName(node.name),
    mesh = g.meshes[node.mesh];
  if (!obj?.geometry || mesh.primitives.length !== 1) continue;
  const p = mesh.primitives[0],
    mat = g.materials[p.material]?.name;
  if (mat !== 'Body_Paint' && !mat?.startsWith('Wrap_')) continue;
  const geom = obj.geometry,
    idx = geom.index,
    pos = geom.attributes.position,
    black = [],
    keep = [];
  for (let i = 0; i < idx.count; i += 3) {
    const ids = [idx.getX(i), idx.getX(i + 1), idx.getX(i + 2)],
      center = new Vector3();
    for (const j of ids)
      center.add(
        new Vector3().fromBufferAttribute(pos, j).applyMatrix4(obj.matrixWorld),
      );
    center.multiplyScalar(1 / 3);
    (center.x > -2.85 && center.x < -2.35 && inside(-center.z, center.y)
      ? black
      : keep
    ).push(...ids);
  }
  if (!black.length) continue;
  p.indices = append(
    new Uint32Array(keep),
    'SCALAR',
    5125,
    [Math.min(...keep)],
    [Math.max(...keep)],
  );
  const used = [...new Set(black)],
    map = new Map(used.map((v, i) => [v, i])),
    attrs = {};
  for (const [semantic, accessorId] of Object.entries(p.attributes)) {
    const a = g.accessors[accessorId],
      v = g.bufferViews[a.bufferView],
      count = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
    if (a.componentType !== 5126) throw Error('Unexpected attribute type');
    const stride = v.byteStride || count * 4,
      off = (v.byteOffset || 0) + (a.byteOffset || 0),
      array = new Float32Array(used.length * count),
      min = Array(count).fill(Infinity),
      max = Array(count).fill(-Infinity);
    for (let i = 0; i < used.length; i++)
      for (let k = 0; k < count; k++) {
        const x = bin.readFloatLE(off + used[i] * stride + k * 4);
        array[i * count + k] = x;
        min[k] = Math.min(min[k], x);
        max[k] = Math.max(max[k], x);
      }
    attrs[semantic] = append(
      array,
      a.type,
      5126,
      semantic === 'POSITION' ? min : undefined,
      semantic === 'POSITION' ? max : undefined,
    );
  }
  const indices = append(
    new Uint32Array(black.map((i) => map.get(i))),
    'SCALAR',
    5125,
    [0],
    [used.length - 1],
  );
  const mi =
    g.meshes.push({
      name: `BlackBumper_${node.name}`,
      primitives: [{ attributes: attrs, indices, material, mode: 4 }],
    }) - 1;
  const newNode = {
    ...node,
    name: `RV_BlackBumper_${node.name}`,
    mesh: mi,
    extras: {
      wrapSurface: false,
      web_vehicle: true,
      interactive_id: 'body',
      finish: '哑黑前保险杠灯周饰板',
    },
  };
  delete newNode.children;
  const ni = g.nodes.push(newNode) - 1,
    oldi = g.nodes.indexOf(node),
    parent = g.nodes.find((n) => n.children?.includes(oldi));
  if (parent) parent.children.push(ni);
  else for (const s of g.scenes) if (s.nodes.includes(oldi)) s.nodes.push(ni);
  changes.push({
    source: node.name,
    node: newNode.name,
    triangles: black.length / 3,
    vertices: used.length,
  });
  total += black.length / 3;
}
if (!total) throw Error('No bumper faces selected');
g.buffers[0].byteLength = bin.length;
const raw = Buffer.from(JSON.stringify(g)),
  json = Buffer.concat([raw, Buffer.alloc(-raw.length & 3, 32)]),
  h = Buffer.alloc(20),
  bh = Buffer.alloc(8);
h.writeUInt32LE(0x46546c67);
h.writeUInt32LE(2, 4);
h.writeUInt32LE(28 + json.length + bin.length, 8);
h.writeUInt32LE(json.length, 12);
h.writeUInt32LE(0x4e4f534a, 16);
bh.writeUInt32LE(bin.length);
bh.writeUInt32LE(0x004e4942, 4);
const out = Buffer.concat([h, json, bh, bin]);
fs.writeFileSync('public/model/mxgarage-rv.glb', out);
const sha = crypto.createHash('sha256').update(out).digest('hex');
const report = {
  revision: '20261007-black-bumper-r5',
  sha256: sha,
  changes,
  blackTriangles: total,
  geometryMoved: false,
  lampsChanged: false,
  wrapExcluded: true,
  reference: '用户2026-10-07前保险杠实车图；复用原前杠凹槽轮廓',
  material: '哑黑塑料饰板',
};
const meta = JSON.parse(fs.readFileSync(`${backup}/motion_metadata.json`));
meta.glbSha256 = sha;
meta.bytes = out.length;
meta.bumperTrimCorrection = report;
fs.writeFileSync(
  'public/model/motion_metadata.json',
  JSON.stringify(meta, null, 2),
);
const cal = JSON.parse(fs.readFileSync(`${backup}/wiper_calibration.json`));
cal.outputSha256 = sha;
cal.bytes = out.length;
fs.writeFileSync(
  'public/model/wiper_calibration.json',
  JSON.stringify(cal, null, 2),
);
fs.writeFileSync(`${dir}/correction.json`, JSON.stringify(report, null, 2));
console.log(report);
