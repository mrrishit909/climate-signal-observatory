/**
 * Pure frame builders: (layout, progress, parameters) -> Frame. The live
 * director, the no-WebGL tier and the reduced-motion static frames all call
 * these, so every tier shows the same states. Scrubbed parts hold no state.
 */
import { EE_XMAX, faceQuat, quatMat3, type Quat } from "../gl/projection";
import { HIDDEN, type CellLayer, type Frame, type GridKey } from "../gl/frame";
import { hexRgb } from "../model/bins";
import { clamp } from "../lib/math";
import { easeSymmetric } from "../motion/ease";
import { windowed } from "../motion/progress";
import { bank } from "../state/bank";
import type { Baseline, Source } from "../data/types";
import { discLerp, type Disc, type Layout } from "./geometry";

export const ORANGE = hexRgb("#FF7A1F");
/** S00 / S01 face (VISUAL_DESIGN 3.3 G0) and the S03b state-1 face ("the far north"). */
export const FACE_OPEN = { lon: -30, lat: 15 };
export const FACE_NORTH = faceQuat(20, 72);
export const FACE_ZERO = faceQuat(0, 0);

export function baseFrame(L: Layout, dpr: number, disc: Disc, q: Quat): Frame {
  return {
    w: L.w, h: L.h, dpr,
    u: {
      rot: quatMat3(q), sphere: [disc.cx, disc.cy, disc.r], sheet: [L.sheet.cx, L.sheet.cy, L.sheet.k],
      s1: 0, s2: 0, s3: 0, strip: [L.sheet.cx, L.strip], core: [L.core.x0, L.core.x1, L.core.y0 + L.core.H / 2, L.core.H],
    },
    cells: [], uniform: 1, uniformColor: ORANGE, cellAlpha: 1, dim: 1, gap: 1, lattice: 0.4, coast: 0.35, core: null, collapseKey: null,
    mode: 0, modeMix: 0, trend: null, band: [0, 0, 0],
  };
}

export const layerOf = (key: GridKey, year: number) => bank.grids.get(key)?.meta.years.list.indexOf(year) ?? -1;

/** The best loaded grid for (source, year): the full grid, or the intro subset when it holds that exact year. */
export function gridFor(source: Source, year: number, base: Baseline): GridKey | null {
  if (bank.grids.has(source) && layerOf(source, year) >= 0) return source;
  if (source === "gistemp" && base !== "1850-1900" && layerOf("intro", year) >= 0) return "intro";
  return null;
}

export const still = (grid: GridKey, layer: number, base: Baseline): CellLayer => ({ grid, layerA: layer, layerB: layer, mix: 0, baseA: base, baseB: base, baseMix: 0, alpha: 1 });

export const sourceKey = (grid: GridKey): Source => (grid === "hadcrut5" ? "hadcrut5" : "gistemp");

/** Planet showing one integer year (static frames, S01, S02, S03b). */
export function planetFrame(L: Layout, dpr: number, disc: Disc, q: Quat, source: Source, year: number, base: Baseline): Frame {
  const f = baseFrame(L, dpr, disc, q);
  const g = gridFor(source, year, base);
  if (g) f.cells = [still(g, layerOf(g, year), base)];
  return f;
}

/** S04 phase windows (MOTION_SYSTEM 5.7). */
export const S04 = { recentre: [0, 0.08], unwrap: [0.08, 0.3], collapse: [0.3, 0.45], turn: [0.45, 0.58], build: [0.58, 0.85], spine: 0.85, coverage: 0.93 } as const;

export function strataPhase(p: number) {
  if (p < S04.unwrap[0]) return 0;
  if (p < S04.collapse[0]) return 1;
  if (p < S04.turn[0]) return 2;
  if (p < S04.build[0]) return 3;
  return 4;
}

/** Upright box of stratum i in a core rect (oldest at the bottom). */
export const slotTop = (y0: number, H: number, n: number, i: number) => y0 + (n - 1 - i) * H;

/**
 * Core boxes at S04 progress p: stratum k (1..N-1 below the current year)
 * rises in [0.58 + 0.19 k/N, +0.08] from below the frame. Once the strip has
 * turned (s3 = 1) the current year's stratum is drawn from the same texture.
 */
export function coreBoxes(L: Layout, p: number, cur: number, spine: number, viewH = L.h) {
  const { n, y0, H, x0, x1 } = L.core;
  const v = new Float32Array(n * 4), sp = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const k = cur - i, slot = slotTop(y0, H, n, i);
    let y = HIDDEN;
    if (k >= 1) {
      const e = easeSymmetric(clamp((p - (S04.build[0] + (0.19 * k) / n)) / 0.08));
      if (e > 0) y = viewH + 40 + (slot - viewH - 40) * e;
    } else if (k === 0 && p >= S04.turn[1]) y = slot;
    v.set([x0, y, x1 - x0, H], i * 4);
    sp.set([L.core.spine[0], spine > 0 && i <= spine * n - 0.5 ? slot : HIDDEN, L.core.spine[1] - L.core.spine[0], H], i * 4);
  }
  return { v, spine: sp };
}

/** Lying boxes in a horizontal rect (time left to right, north on top). */
export function lyingBoxes(n: number, r: { x0: number; x1: number; y0: number; y1: number }) {
  const h = new Float32Array(n * 4), bw = (r.x1 - r.x0) / n;
  for (let i = 0; i < n; i++) h.set([r.x0 + i * bw, r.y0, bw, r.y1 - r.y0], i * 4);
  return h;
}
/** Upright boxes in a vertical rect (latitude across, oldest at the bottom). */
export function uprightBoxes(n: number, r: { x0: number; x1: number; y0: number; y1: number }) {
  const v = new Float32Array(n * 4), H = (r.y1 - r.y0) / n;
  for (let i = 0; i < n; i++) v.set([r.x0, r.y0 + (n - 1 - i) * H, r.x1 - r.x0, H], i * 4);
  return v;
}

export interface StrataOpts { source: Source; base: Baseline; spine: number; lattice: number; nogl?: boolean }

/** S04 at progress p: re-centre, unwrap, collapse, turn, build, spine. Returns null pieces while data loads. */
export function strataFrame(L: Layout, dpr: number, p: number, o: StrataOpts) {
  const e0 = easeSymmetric(windowed(p, S04.recentre[0], S04.recentre[1]));
  const disc = discLerp(L.G1s, L.G1, e0);
  const f = baseFrame(L, dpr, disc, FACE_ZERO); // S03b hands over already facing (0, 0)
  const axis = bank.axis(), cur = axis.length - 1, year = axis[cur]!;
  const s1 = o.nogl ? 1 : easeSymmetric(windowed(p, S04.unwrap[0], S04.unwrap[1]));
  const s2 = easeSymmetric(windowed(p, S04.collapse[0], S04.collapse[1]));
  const s3 = easeSymmetric(windowed(p, S04.turn[0], S04.turn[1]));
  Object.assign(f.u, { s1, s2, s3 });
  f.gap = 1 - s2;
  f.coast = 0.35 * (1 - s2);
  f.lattice = o.lattice;
  const g = gridFor(o.source, year, o.base);
  if (g) f.cells = [still(g, layerOf(g, year), o.base)];
  // collapse colour = the row's zonal mean for this year: full-grid core, else the intro subset's (same year)
  const fullKey = `${o.source}:${o.base}`;
  const full = bank.core(o.source, o.base);
  f.collapseKey = full ? fullKey : g ? (bank.core(g, o.base) ? `${g}:${o.base}` : null) : null;
  const geomGrid = g ? bank.grids.get(g) : bank.grids.get(o.source);
  const nLat = geomGrid?.geom.nLat ?? 90, step = geomGrid?.geom.step ?? 2;
  const boxes = coreBoxes(L, full ? p : 0, cur, full ? o.spine : 0);
  f.core = { key: fullKey, nLat, step, cur, v: boxes.v, h: boxes.v, bench: 0, spine: boxes.spine, alpha: 1, sep: clamp((p - S04.build[1]) / 0.05), thickPx: L.core.H * dpr };
  return { frame: f, disc, year, fullReady: !!full, phase: strataPhase(p) };
}

/** OBS MAP view sheet: Equal Earth beside the docked core on D, full width otherwise (shared by the director and picking). */
export function obsSheet(L: Layout) {
  const d = L.obs;
  const sw = Math.min(2.7 * d.r, L.w - (L.cls === "D" ? L.w - L.dock.x0 + 48 : 24));
  return { cx: L.cls === "D" ? Math.min(d.cx, (L.dock.x0 - 24) / 2) : d.cx, cy: d.cy, k: sw / (2 * EE_XMAX), width: sw };
}
