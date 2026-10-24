/**
 * Schematic procedural body for the body-lab page.
 *
 * This is NOT the shipped V80 model (public/model/mxgarage-rv.glb) and must
 * never be presented as one: it is a boxy schematic whose only job is to
 * make parameter changes visible (wheelbase, roof type, dimensions). Real
 * dimensions and window layouts live in the shipped asset and the
 * announcement database, not here.
 *
 * Conventions match the shipped asset: X is length, front is -X, Y is up,
 * ground is Y 0. Units are metres (config values are millimetres).
 */
import * as THREE from 'three';
import type { BodyConfig } from './parametric-body.ts';
import { isPopUpRoof } from './parametric-body.ts';

const BODY_CREAM = 0xe9e2d2;
const GLASS_DARK = 0x2b3438;
const RUBBER_DARK = 0x1c1e20;
const CANVAS_BEIGE = 0xd8cdb4;
const WHEEL_DARK = 0x222528;

function box(
  length: number,
  height: number,
  width: number,
  color: number,
  x: number,
  y: number,
  z: number,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(length, height, width),
    new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05 }),
  );
  mesh.position.set(x, y, z);
  return mesh;
}

function wheel(radius: number, width: number, x: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, width, 24),
    new THREE.MeshStandardMaterial({ color: WHEEL_DARK, roughness: 0.9 }),
  );
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(x, radius, z);
  return mesh;
}

/**
 * Build a schematic van body group from a BodyConfig. The caller owns the
 * group and should dispose it (traverse geometry/material dispose) on
 * rebuild/unmount.
 */
export function buildParametricBody(config: BodyConfig): THREE.Group {
  const group = new THREE.Group();
  const L = config.lengthMm / 1000;
  const W = config.widthMm / 1000;
  const H = config.heightMm / 1000;
  const floorY = 0.55;
  const wheelRadius = 0.36;
  const wheelbase = config.wheelbaseMm / 1000;

  // Rear body box (full height) and cab box (front, lower top).
  const rearLen = L * 0.62;
  const cabLen = L - rearLen;
  const cabTop = floorY + (H - floorY) * 0.85;
  const rear = box(rearLen, H - floorY, W, BODY_CREAM, L / 2 - rearLen / 2, (H + floorY) / 2, 0);
  const cab = box(cabLen, cabTop - floorY, W, BODY_CREAM, -L / 2 + cabLen / 2, (cabTop + floorY) / 2, 0);
  group.add(rear, cab);

  // Windshield: tilted dark plane at the cab front.
  const shield = new THREE.Mesh(
    new THREE.PlaneGeometry(W * 0.8, 0.85),
    new THREE.MeshStandardMaterial({
      color: GLASS_DARK,
      roughness: 0.15,
      metalness: 0.3,
    }),
  );
  // Lean the top rearward (+X) like a real windshield rake. The rake
  // shifts the plane's x-extent by half its height * sin(rake), so the
  // center is compensated to keep the shield inside the body length.
  const rake = 0.35;
  const shieldHalfX = (0.85 / 2) * Math.sin(rake);
  shield.position.set(-L / 2 + 0.06 + shieldHalfX, cabTop - 0.45, 0);
  shield.rotation.y = -Math.PI / 2;
  shield.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), -rake);
  group.add(shield);

  // Side windows: one cab window and one body window per side.
  for (const side of [-1, 1]) {
    const z = side * (W / 2 + 0.01);
    const cabWindow = box(0.9, 0.55, 0.02, GLASS_DARK, -L / 2 + cabLen * 0.55, cabTop - 0.4, z);
    const bodyWindow = box(1.4, 0.6, 0.02, GLASS_DARK, L * 0.12, H - 0.55, z);
    group.add(cabWindow, bodyWindow);
  }

  // Roof: closed slab, plus pop-up variants when open.
  const roofSlab = (len: number, x: number, y: number): THREE.Mesh =>
    box(len, 0.08, W * 0.96, BODY_CREAM, x, y, 0);
  const travel = config.popUpTravelMm / 1000;
  const open = isPopUpRoof(config.roofType) && config.popUpOpen;
  if (!isPopUpRoof(config.roofType) || !open) {
    group.add(roofSlab(L * 0.98, 0, H + 0.04));
  } else if (config.roofType === 'pop-up') {
    const canvas = box(L * 0.6, travel, W * 0.9, CANVAS_BEIGE, L * 0.05, H + travel / 2, 0);
    group.add(canvas, roofSlab(L * 0.98, 0, H + travel + 0.04));
  } else if (config.roofType === 'sloped-pop-up') {
    // Hinge at the front edge; the rear rises by the travel.
    const angle = (config.slopedAngleDeg * Math.PI) / 180;
    const pivot = new THREE.Group();
    pivot.position.set(-L * 0.49, H, 0);
    const slab = roofSlab(L * 0.98, L * 0.49, 0.04);
    pivot.add(slab);
    pivot.rotation.z = angle;
    group.add(pivot);
    const canvas = box(L * 0.6, travel * 0.6, W * 0.9, CANVAS_BEIGE, L * 0.15, H + travel * 0.3, 0);
    canvas.rotation.z = angle * 0.5;
    group.add(canvas);
  } else {
    // split-pop-up: front half rises, rear half stays.
    const frontLen = L * 0.45;
    const canvas = box(frontLen, travel, W * 0.9, CANVAS_BEIGE, -L / 2 + frontLen / 2 + L * 0.05, H + travel / 2, 0);
    group.add(
      canvas,
      roofSlab(frontLen, -L / 2 + frontLen / 2 + L * 0.05, H + travel + 0.04),
      roofSlab(L * 0.98 - frontLen - L * 0.05, L / 2 - (L * 0.98 - frontLen - L * 0.05) / 2, H + 0.04),
    );
  }

  // Wheels at +/- wheelbase/2, front is -X.
  for (const x of [-wheelbase / 2, wheelbase / 2]) {
    for (const z of [-(W / 2 - 0.08), W / 2 - 0.08]) {
      group.add(wheel(wheelRadius, 0.26, x, z));
    }
  }

  // Wheel-arch shadow boxes keep the schematic grounded visually.
  const skirt = box(L * 0.9, 0.12, W * 0.98, RUBBER_DARK, 0, floorY - 0.02, 0);
  group.add(skirt);
  return group;
}

/**
 * "Duang" bounce: a damped squash-and-stretch applied to the schematic
 * body for a short window after a slider drag ends. Pure function so the
 * page loop stays thin and the curve stays unit-tested.
 *
 * At t = 0 the body is squashed (y 0.94, x/z 1.03); it then springs past
 * its rest size once and settles. At or after BOUNCE_DURATION_MS the
 * scale is exactly 1, so the loop can stop applying it.
 */
export const BOUNCE_DURATION_MS = 900;

export function bounceScale(elapsedMs: number): {
  x: number;
  y: number;
  z: number;
} {
  if (elapsedMs <= 0) return { x: 1.03, y: 0.94, z: 1.03 };
  if (elapsedMs >= BOUNCE_DURATION_MS) return { x: 1, y: 1, z: 1 };
  const t = elapsedMs / 1000;
  const y = 1 - 0.06 * Math.exp(-3.5 * t) * Math.cos(16 * t);
  const xz = 1 - (y - 1) * 0.5;
  return { x: xz, y, z: xz };
}

/** Dispose every geometry/material in a built group. */
export function disposeParametricBody(group: THREE.Group): void {
  group.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      for (const material of materials) material.dispose();
    }
  });
}
