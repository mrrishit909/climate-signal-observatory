export const clamp = (v: number, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Shortest signed angular delta in degrees from a to b, in (-180, 180]. */
export const shortestDelta = (a: number, b: number) => {
  const d = (((b - a) % 360) + 540) % 360 - 180;
  return d === -180 ? 180 : d;
};
/** requestIdleCallback where it exists (not Safari), else a macrotask. */
export const idle = (fn: () => void, timeout = 1000) =>
  typeof window !== "undefined" && "requestIdleCallback" in window ? window.requestIdleCallback(fn, { timeout }) : setTimeout(fn, 0);
