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
  /** core texture key `${source}:${baseline}` */
  key: string;
  nLat: number;
  step: number;
  /** current year index on the 1850.. axis (the stratum the cells became) */
  cur: number;
  rect: [number, number, number, number]; // x0, x1, unused, stratum height
  /** per-stratum top y (CSS px), or HIDDEN */
  ys: Float32Array;
  spine: [number, number];
  /** spine top y per stratum, or HIDDEN */
  spineYs: Float32Array;
  alpha: number;
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
  gap: number;
  lattice: number;
  coast: number;
  core: CoreDraw | null;
  /** core texture of the cells' own year for the zonal collapse colour */
  collapseKey: string | null;
}
