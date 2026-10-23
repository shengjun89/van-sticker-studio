/** Presentation motion is separate from the user's mechanical open/closed state. */
const clamp = (v: number) => Math.min(1, Math.max(0, v));
const beats: Record<string, [number, number, number, number]> = {
  rooflight: [7.8, 0, 2.4, 0.24],
  'window-2': [8.6, 1.8, 2.8, 0.22],
  'window-4': [8.6, 1.8, 2.8, 0.22],
  'window-5': [10.2, 4.5, 2.6, 0.16],
  'window-6': [10.2, 4.5, 2.6, 0.16],
  'entry-door': [11.6, 5.8, 3, 0.055],
};
export function waitingPose(
  id: string,
  seconds: number,
  base: number,
  weight: number,
) {
  const beat = beats[id];
  if (!beat || seconds < beat[1]) return clamp(base);
  const [period, offset, duration, amplitude] = beat;
  const phase = (seconds - offset) % period;
  const pulse =
    phase < duration ? Math.sin((phase / duration) * Math.PI) ** 2 : 0;
  return clamp(base + (1 - 2 * base) * pulse * amplitude * clamp(weight));
}
