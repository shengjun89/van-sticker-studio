import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export type DraftingEdges = {
  parent: THREE.Object3D;
  geometry: THREE.BufferGeometry;
  structural?: boolean;
};

/** Extract physical edges across paint splits, but never across separate hinges. */
export function createDraftingEdges(meshes: THREE.Mesh[]): DraftingEdges[] {
  const result: DraftingEdges[] = [];
  const panels = new Map<THREE.Object3D, THREE.Mesh[]>();
  for (const mesh of meshes) {
    // Static line buffers cannot follow a flexible blade's morph targets.
    if (mesh.geometry.morphAttributes.position?.length) continue;
    const materials = [mesh.material].flat();
    if (
      mesh.parent &&
      materials.every(
        (m) => m.name === 'Body_Paint' || m.name.startsWith('Wrap_'),
      )
    ) {
      const group = panels.get(mesh.parent) || [];
      group.push(mesh);
      panels.set(mesh.parent, group);
    } else {
      result.push({
        parent: mesh,
        geometry: new THREE.EdgesGeometry(mesh.geometry, 40),
        structural: materials.some((m) => m.name === 'Glass'),
      });
    }
  }
  for (const [parent, group] of panels) {
    const inverse = parent.matrixWorld.clone().invert();
    const pieces = group.map((mesh) => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        'position',
        mesh.geometry.getAttribute('position').clone(),
      );
      geometry.setIndex(
        mesh.geometry.index?.clone() ||
          Array.from(
            { length: geometry.getAttribute('position').count },
            (_, i) => i,
          ),
      );
      geometry.applyMatrix4(
        new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld),
      );
      return geometry;
    });
    const surface = mergeGeometries(pieces)!;
    // EdgesGeometry pairs coincident positions across the original material boundary.
    result.push({
      parent,
      geometry: new THREE.EdgesGeometry(surface, 40),
      structural: true,
    });
    surface.dispose();
    pieces.forEach((piece) => piece.dispose());
  }
  return result;
}
