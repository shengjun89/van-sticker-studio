export type WrapBody = {
  xMin: number;
  length: number;
  width: number;
  height: number;
  centerZ?: number;
};
export type DecalPlacement = { center: number; height: number; scale: number };
export const circumference = (b: WrapBody) => 2 * (b.length + b.width);
const mod = (n: number, period: number) => ((n % period) + period) % period;
export const wrappedDelta = (a: number, b: number, period: number) =>
  mod(a - b + period / 2, period) - period / 2;

/** One continuous, exterior-facing chart shared by every material and moving panel. */
export function perimeterCoordinate(x: number, z: number, b: WrapBody) {
  z -= b.centerZ || 0;
  const half = b.length / 2,
    w = b.width / 2;
  const dx = x - (b.xMin + half);
  const r = Math.max(Math.abs(dx) / half, Math.abs(z) / w, 1e-6);
  const px = dx / r,
    pz = z / r;
  let s: number;
  if (Math.abs(pz / w) >= Math.abs(px / half) - 1e-8)
    s = pz < 0 ? half - px : b.length + b.width + px + half;
  else s = px < 0 ? b.length + pz + w : 2 * b.length + b.width + w - pz;
  return mod(s, circumference(b));
}
export function constrainDecal(
  p: DecalPlacement,
  aspect: number,
  b: WrapBody,
): DecalPlacement {
  const safe = (v: number, fallback: number) =>
    Number.isFinite(v) ? v : fallback;
  const scale = Math.max(
    0.25,
    Math.min(1.6, ((b.height - 0.12) * aspect) / 3.5, safe(p.scale, 1)),
  );
  const half = (3.5 * scale) / aspect / 2;
  return {
    center: mod(safe(p.center, 0), circumference(b)),
    scale,
    height: Math.max(
      half + 0.04,
      Math.min(b.height - half - 0.04, safe(p.height, 1.28)),
    ),
  };
}
export function decalHit(
  s: number,
  h: number,
  p: DecalPlacement,
  aspect: number,
  period: number,
) {
  return (
    Math.abs(wrappedDelta(s, p.center, period)) <= (3.5 * p.scale) / 2 &&
    Math.abs(h - p.height) <= (3.5 * p.scale) / aspect / 2
  );
}
