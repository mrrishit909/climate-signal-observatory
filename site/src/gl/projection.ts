/**
 * Projection math shared by the GLSL vertex shader (gl/shaders.ts mirrors it
 * line for line), the Canvas2D painter and the parity tests against d3-geo.
 * Screen space is CSS px, y down.
 */
const A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796, M = Math.sqrt(3) / 2;
const RAD = Math.PI / 180;

/** d3.geoEqualEarthRaw: [x, y] in projection units (y north-positive). */
export function equalEarthRaw(lambda: number, phi: number): [number, number] {
  const l = Math.asin(M * Math.sin(phi)), l2 = l * l, l6 = l2 * l2 * l2;
  return [
    (lambda * Math.cos(l)) / (M * (A1 + 3 * A2 * l2 + l6 * (7 * A3 + 9 * A4 * l2))),
    l * (A1 + A2 * l2 + l6 * (A3 + A4 * l2)),
  ];
}
/** Half-width and half-height of the Equal Earth sheet in projection units. */
export const EE_XMAX = equalEarthRaw(Math.PI, 0)[0];
export const EE_YMAX = equalEarthRaw(0, Math.PI / 2)[1];

export type Quat = [number, number, number, number]; // x, y, z, w
const qmul = (a: Quat, b: Quat): Quat => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
const axisQ = (ax: 0 | 1 | 2, a: number): Quat => {
  const q: Quat = [0, 0, 0, Math.cos(a / 2)];
  q[ax] = Math.sin(a / 2);
  return q;
};
/**
 * Orientation that puts (lon0, lat0) at the centre of the disc: spin about the
 * polar axis by -lon0, then tilt about the screen x axis by lat0. World frame:
 * x right, y north, z toward the viewer at (0, 0).
 */
export const faceQuat = (lon0: number, lat0: number): Quat => qmul(axisQ(0, lat0 * RAD), axisQ(1, -lon0 * RAD));

/** Shortest-arc slerp (MOTION_SYSTEM 4: turns never swing the long way round). */
export function slerp(a: Quat, b: Quat, t: number): Quat {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  const s = d < 0 ? -1 : 1;
  d *= s;
  if (d > 0.9995) {
    const q = a.map((v, i) => v + (s * b[i]! - v) * t) as Quat;
    const n = Math.hypot(...q);
    return q.map((v) => v / n) as Quat;
  }
  const th = Math.acos(d), sn = Math.sin(th);
  const wa = Math.sin((1 - t) * th) / sn, wb = (s * Math.sin(t * th)) / sn;
  return a.map((v, i) => v * wa + b[i]! * wb) as Quat;
}

/** Column-major 3x3 (as GLSL mat3 expects). */
export function quatMat3(q: Quat): Float32Array {
  const [x, y, z, w] = q;
  return new Float32Array([
    1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w),
    2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w),
    2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y),
  ]);
}

/** Rotated unit vector of a lon/lat (degrees). */
export function rotate(m: Float32Array, lon: number, lat: number): [number, number, number] {
  const l = lon * RAD, p = lat * RAD;
  const vx = Math.cos(p) * Math.sin(l), vy = Math.sin(p), vz = Math.cos(p) * Math.cos(l);
  return [m[0]! * vx + m[3]! * vy + m[6]! * vz, m[1]! * vx + m[4]! * vy + m[7]! * vz, m[2]! * vx + m[5]! * vy + m[8]! * vz];
}

/** Every parameter the unwrap needs for one frame (MOTION_SYSTEM 5.7). */
export interface Unwrap {
  rot: Float32Array;
  sphere: [number, number, number]; // cx, cy, r
  sheet: [number, number, number]; // cx, cy, k (px per projection unit)
  s1: number; // ortho -> Equal Earth
  s2: number; // zonal collapse
  s3: number; // turn and re-space
  strip: [number, number]; // strip centre x, strip width
  core: [number, number, number, number]; // x0, x1, slot centre y, stratum height
}

/**
 * Position of one cell corner. `slot` is the corner's x fraction inside the
 * collapsed strip (collapseSlots). Returns [x, y, z] with z = sphere depth.
 */
export function unwrapVertex(lon: number, lat: number, slot: number, u: Unwrap): [number, number, number] {
  const [px, py, pz] = rotate(u.rot, lon, lat);
  const [ex, ey] = equalEarthRaw(lon * RAD, lat * RAD);
  let x = u.sphere[0] + u.sphere[2] * px, y = u.sphere[1] - u.sphere[2] * py;
  x += (u.sheet[0] + u.sheet[2] * ex - x) * u.s1;
  y += (u.sheet[1] - u.sheet[2] * ey - y) * u.s1;
  const z = pz * (1 - u.s1);
  // collapse: x travels to the cell's slot in the strip; rows keep their y
  const [sx, sw] = u.strip;
  x += (sx + (slot - 0.5) * sw - x) * u.s2;
  if (u.s3 <= 0) return [x, y, z];
  // turn: local coords about the strip centre (north-up), lerp to the stratum slot, rotate -90deg
  const [x0, x1, cy3, h] = u.core;
  const half = (x1 - x0) / 2;
  const uu0 = x - sx, vv0 = u.sheet[1] - y;
  const uu = uu0 + ((uu0 / sw) * h - uu0) * u.s3;
  const vv = vv0 + (half * Math.sin(lat * RAD) - vv0) * u.s3;
  const cx = sx + (x0 + half - sx) * u.s3, cy = u.sheet[1] + (cy3 - u.sheet[1]) * u.s3;
  const th = (u.s3 * Math.PI) / 2, c = Math.cos(th), s = Math.sin(th);
  return [cx + uu * c + vv * s, cy - (-uu * s + vv * c), z];
}
