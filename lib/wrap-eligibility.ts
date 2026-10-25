import * as THREE from 'three';

const CENTER_Z = -0.0473;
const pointKey = (point: THREE.Vector3) =>
  `${Math.round(point.x * 1e5)},${Math.round(point.y * 1e5)},${Math.round(point.z * 1e5)}`;
const edgeKey = (a: string, b: string) => (a < b ? `${a}/${b}` : `${b}/${a}`);

function staticSurface(mesh: THREE.Mesh) {
  if (
    !mesh.name.startsWith('RV_Static_') ||
    mesh.geometry.morphAttributes.position?.length
  )
    return false;
  for (let parent = mesh.parent; parent; parent = parent.parent)
    if (parent.name.startsWith('WebRig_')) return false;
  return true;
}

function eachTriangle(
  mesh: THREE.Mesh,
  visit: (
    triangle: number,
    a: THREE.Vector3,
    b: THREE.Vector3,
    c: THREE.Vector3,
  ) => void,
) {
  const position = mesh.geometry.getAttribute('position'),
    index = mesh.geometry.index;
  if (!position) return;
  const vertices = [
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
  ];
  const count = Math.floor((index?.count || position.count) / 3);
  for (let triangle = 0; triangle < count; triangle++) {
    for (let corner = 0; corner < 3; corner++) {
      const offset = triangle * 3 + corner;
      vertices[corner]
        .fromBufferAttribute(position, index ? index.getX(offset) : offset)
        .applyMatrix4(mesh.matrixWorld);
    }
    visit(triangle, vertices[0], vertices[1], vertices[2]);
  }
}

function edges(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) {
  const keys = [pointKey(a), pointKey(b), pointKey(c)];
  return [
    edgeKey(keys[0], keys[1]),
    edgeKey(keys[1], keys[2]),
    edgeKey(keys[2], keys[0]),
  ];
}

/**
 * Extends the van's existing vinyl eligibility over the audited small front
 * paint-material gaps. Call with closed-pose matrixWorld values in model metres,
 * before converting any geometry. Returned bytes correspond to original triangle
 * order (index triplets, or consecutive nonindexed vertex triplets).
 *
 * Only the static Body_Paint shell can be extended. A face must be outward-facing
 * in the bounded headlamp transition and connected by full edges to a static Wrap
 * boundary. Rear rails, isolated details, inner walls and moving panels are never
 * promoted. Source attributes, indices, materials and transforms are not changed.
 */
export function findFrontWrapTransitions(
  meshes: readonly THREE.Mesh[],
): Map<THREE.Mesh, Uint8Array> {
  const result = new Map<THREE.Mesh, Uint8Array>();
  const boundaryCounts = new Map<string, number>();
  for (const mesh of meshes) {
    if (
      !staticSurface(mesh) ||
      ![mesh.material]
        .flat()
        .every((material) =>
          ['Wrap_Entry', 'Wrap_Driver', 'Wrap_Front'].includes(material.name),
        )
    )
      continue;
    eachTriangle(mesh, (_, a, b, c) => {
      for (const edge of edges(a, b, c))
        boundaryCounts.set(edge, (boundaryCounts.get(edge) || 0) + 1);
    });
  }

  const candidates: { mask: Uint8Array; triangle: number; edges: string[] }[] =
    [];
  const byEdge = new Map<string, number[]>();
  const center = new THREE.Vector3(),
    normal = new THREE.Vector3(),
    ab = new THREE.Vector3(),
    ac = new THREE.Vector3();
  for (const mesh of meshes) {
    if (
      mesh.name !== 'RV_Static_Body_Paint' ||
      !staticSurface(mesh) ||
      ![mesh.material]
        .flat()
        .every((material) => material.name === 'Body_Paint')
    )
      continue;
    const position = mesh.geometry.getAttribute('position');
    if (!position) continue;
    const mask = new Uint8Array(
      Math.floor((mesh.geometry.index?.count || position.count) / 3),
    );
    result.set(mesh, mask);
    eachTriangle(mesh, (triangle, a, b, c) => {
      center.copy(a).add(b).add(c).divideScalar(3);
      const transverse = center.z - CENTER_Z;
      if (
        center.x <= -2.86 ||
        center.x >= -2.4 ||
        center.y <= 0.47 ||
        center.y >= 1.45 ||
        Math.abs(transverse) <= 0.72 ||
        Math.abs(transverse) >= 1.12
      )
        return;
      normal.crossVectors(ab.copy(b).sub(a), ac.copy(c).sub(a));
      if (normal.lengthSq() < 1e-18) return;
      normal.normalize();
      if (
        Math.abs(normal.y) >= 0.7 ||
        -normal.x + Math.sign(transverse) * normal.z <= 0.5
      )
        return;
      const triangleEdges = edges(a, b, c),
        id = candidates.length;
      candidates.push({ mask, triangle, edges: triangleEdges });
      for (const edge of triangleEdges) {
        const list = byEdge.get(edge) || [];
        list.push(id);
        byEdge.set(edge, list);
      }
    });
  }

  const queue: number[] = [];
  const add = (id: number) => {
    const candidate = candidates[id];
    if (candidate.mask[candidate.triangle]) return;
    candidate.mask[candidate.triangle] = 1;
    queue.push(id);
  };
  candidates.forEach((candidate, id) => {
    if (candidate.edges.some((edge) => boundaryCounts.get(edge) === 1)) add(id);
  });
  for (let cursor = 0; cursor < queue.length; cursor++)
    for (const edge of candidates[queue[cursor]].edges)
      for (const neighbor of byEdge.get(edge) || []) add(neighbor);
  return result;
}
