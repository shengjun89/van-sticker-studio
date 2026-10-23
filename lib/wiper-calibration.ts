import type { Object3D } from 'three';
import { Mesh } from 'three';

/** Reject mismatched cached exports instead of animating an older sweep with new metadata. */
export function validateWiperRig(node: Object3D, expectedPoses: number) {
  let meshes = 0;
  node.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    meshes++;
    if (
      !Number.isInteger(expectedPoses) ||
      expectedPoses < 1 ||
      object.morphTargetInfluences?.length !== expectedPoses ||
      object.geometry.morphAttributes.position?.length !== expectedPoses
    )
      throw new Error(`Wiper asset mismatch: ${node.name}`);
  });
  if (!meshes) throw new Error(`Wiper asset mismatch: ${node.name}`);
}

/** Blend the calibrated, glass-conforming sweep poses; keep the support node fixed. */
export function applyCalibratedWiper(node: Object3D, phase: number) {
  const amount = Math.min(1, Math.max(0, Number.isFinite(phase) ? phase : 0));
  node.traverse((object) => {
    if (!(object instanceof Mesh) || !object.morphTargetInfluences) return;
    const weights = object.morphTargetInfluences;
    weights.fill(0);
    const frame = amount * weights.length;
    const lower = Math.floor(frame);
    const upper = Math.ceil(frame);
    const mix = frame - lower;
    if (lower > 0) weights[lower - 1] = 1 - mix;
    if (upper > 0 && upper !== lower) weights[upper - 1] = mix;
  });
}
