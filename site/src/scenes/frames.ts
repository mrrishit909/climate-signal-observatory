/**
 * Pure frame builders: (layout, progress, parameters) -> Frame. The live
 * director, the no-WebGL tier and the reduced-motion static frames all call
 * these, so every tier shows the same states. Scrubbed parts hold no state.
 */
import { faceQuat, quatMat3, slerp, type Quat } from "../gl/projection";
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
    cells: [], uniform: 1, uniformColor: ORANGE, cellAlpha: 1, dim: 1, gap: 0.03, lattice: 0.4, coast: 0.35, core: null, collapseKey: null,
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

/** Stratum k (1..N-1 below the current year) rises in [0.58 + 0.19 k/N, +0.08] from below the frame. */
export function strataYs(L: Layout, p: number, cur: number, viewH = L.h) {
  const { n, y0, H } = L.core;
  const ys = new Float32Array(n).fill(HIDDEN);
  for (let i = 0; i < n; i++) {
    const k = cur - i;
    if (k < 1) continue;
    const a = S04.build[0] + (0.19 * k) / n;
    const e = easeSymmetric(clamp((p - a) / 0.08));
    if (e <= 0) continue;
    const slot = y0 + (n - 1 - i) * H;
    ys[i] = viewH + 40 + (slot - viewH - 40) * e;
  }
  return ys;
}

export interface StrataOpts { source: Source; base: Baseline; spine: number; lattice: number; nogl?: boolean }

/** S04 at progress p: re-centre, unwrap, collapse, turn, build, spine. Returns null pieces while data loads. */
export function strataFrame(L: Layout, dpr: number, p: number, o: StrataOpts) {
  const e0 = easeSymmetric(windowed(p, S04.recentre[0], S04.recentre[1]));
  const disc = discLerp(L.G1s, L.G1, e0);
  const f = baseFrame(L, dpr, disc, slerp(FACE_NORTH, FACE_ZERO, e0));
  const axis = bank.axis(), cur = axis.length - 1, year = axis[cur]!;
  const s1 = o.nogl ? 1 : easeSymmetric(windowed(p, S04.unwrap[0], S04.unwrap[1]));
  const s2 = easeSymmetric(windowed(p, S04.collapse[0], S04.collapse[1]));
  const s3 = easeSymmetric(windowed(p, S04.turn[0], S04.turn[1]));
  Object.assign(f.u, { s1, s2, s3 });
  f.gap = 0.03 * (1 - s2);
  f.coast = 0.35 * (1 - s2);
  f.lattice = o.lattice;
  const g = gridFor(o.source, year, o.base);
  if (g) f.cells = [still(g, layerOf(g, year), o.base)];
  // collapse colour = the row's zonal mean for this year: full-grid core, else the intro subset's (same year)
  const fullKey = `${o.source}:${o.base}`;
  const full = bank.core(o.source, o.base);
  const collapse = full ? fullKey : g ? (bank.core(g, o.base) ? `${g}:${o.base}` : null) : null;
  f.collapseKey = collapse;
  const geomGrid = g ? bank.grids.get(g) : bank.grids.get(o.source);
  const nLat = geomGrid?.geom.nLat ?? 90, step = geomGrid?.geom.step ?? 2;
  const ys = full ? strataYs(L, p, cur) : new Float32Array(L.core.n).fill(HIDDEN);
  const spineYs = new Float32Array(L.core.n).fill(HIDDEN);
  if (full && o.spine > 0) for (let i = 0; i < L.core.n; i++) if (i <= o.spine * L.core.n - 0.5) spineYs[i] = L.core.y0 + (L.core.n - 1 - i) * L.core.H;
  f.core = {
    key: fullKey, nLat, step, cur, rect: [L.core.x0, L.core.x1, 0, L.core.H], ys, spine: L.core.spine, spineYs, alpha: 1,
  };
  return { frame: f, disc, year, fullReady: !!full, phase: strataPhase(p) };
}
