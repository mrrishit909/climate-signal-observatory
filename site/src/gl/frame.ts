/**
 * One frame of the planet/sheet/core, as plain data. The director builds it;
 * the WebGL2 renderer (gl/globe.ts) and the Canvas2D painter (gl/paint2d.ts)
 * both draw exactly this, so the fallback and the static reduced-motion frames
 * show the same states as the live GL scene.
 */
import type { Unwrap } from "./projection";
import type { Baseline } from "../data/types";

export type GridKey = "intro" | "gistemp" | "hadcrut5";
export type MeshKey = "2" | "5";

export interface CellLayer {
  grid: GridKey;
  layerA: number;
  layerB: number;
  mix: number; // 0..1 crossfade A -> B (never held: MOTION_SYSTEM 5.5)
  baseA: Baseline;
  baseB: Baseline;
  baseMix: number;
  alpha: number; // source crossfade weight
}

export interface CoreDraw {
  /** core texture key `${grid}:${baseline}` */
  key: string;
  nLat: number;
  step: number;
  /** current year index on the 1850.. axis (the stratum the cells became) */
  cur: number;
  /** per stratum upright box [x, y, latitude width, thickness] (y = HIDDEN to hide) */
  v: Float32Array;
  /** per stratum lying box for the bench [x, y, thickness, latitude height] */
  h: Float32Array;
  /** 0 upright core, 1 lying bench */
  bench: number;
  /** spine boxes (upright only) */
  spine: Float32Array;
  alpha: number;
  /** decade separator strength */
  sep: number;
  thickPx: number;
}
export const HIDDEN = -1e9;

export interface Frame {
  w: number;
  h: number;
  dpr: number;
  u: Unwrap;
  cells: CellLayer[];
  /** 0 = uniform intro colour, 1 = binned data */
  uniform: number;
  uniformColor: [number, number, number];
  cellAlpha: number;
  dim: number;
  /** hairline gap strength 0..1 (drawn only where cells are large enough) */
  gap: number;
  lattice: number;
  coast: number;
  core: CoreDraw | null;
  /** core texture of the cells' own year for the zonal collapse colour */
  collapseKey: string | null;
  /** layer mode: 0 anomaly, 1 trend, 2 +2 C, 3 coverage; modeMix crossfades into it */
  mode: number;
  modeMix: number;
  trend: { key: string; slope: number; sig: number } | null;
  /** latitude band [min, max, strength]: cells outside dim to 30% at strength 1, parallels drawn */
  band: [number, number, number];
}
