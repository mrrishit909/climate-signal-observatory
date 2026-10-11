/**
 * Zonal reduction (DR-4, analytics/zonal.py mirror). A row's mean uses valid
 * cells only and is null when fewer than 20% of the row is observed. The global
 * mean is the cos(latitude)-weighted mean of every valid cell (no row rule).
 */
import { MISSING_BYTE } from "./bins";

export const MIN_ROW_VALID = 0.2;
export interface GridGeom { nLat: number; nLon: number; latFirst: number; step: number }

export interface Zonal { rowMean: (number | null)[]; rowValid: number[]; globalMean: number | null }

export function zonalLayer(grid: Int8Array, layer: number, g: GridGeom, offsets: readonly (number | null)[]): Zonal {
  const { nLat, nLon } = g;
  const base = layer * nLat * nLon;
  const rowMean: (number | null)[] = [];
  const rowValid: number[] = [];
  let wSum = 0, vSum = 0;
  for (let r = 0; r < nLat; r++) {
    const w = Math.cos(((g.latFirst - r * g.step) * Math.PI) / 180);
    let n = 0, s = 0;
    for (let c = 0; c < nLon; c++) {
      const i = r * nLon + c;
      const b = grid[base + i]!, off = offsets[i];
      if (b === MISSING_BYTE || off === null || off === undefined) continue;
      const v = b * 0.1 - off * 0.01;
      n++; s += v;
    }
    const share = n / nLon;
    rowValid.push(share);
    rowMean.push(n > 0 && share >= MIN_ROW_VALID ? s / n : null);
    wSum += w * n; vSum += w * s;
  }
  return { rowMean, rowValid, globalMean: wSum > 0 ? vSum / wSum : null };
}

/** Sentinel for "missing" in float textures (NaN is unreliable in some GPU drivers). */
export const MISSING_F = -1e9;

/**
 * Core texture: for each year of the shared axis (1850..latest), nLat row means
 * plus the global mean in column nLat, in hundredths of a degree. Layout
 * [yearIdx][nLat + 1]. Years the grid does not cover are MISSING_F.
 */
export function coreTexture(grid: Int8Array, g: GridGeom, gridYears: readonly number[], offsets: readonly (number | null)[], axis: readonly number[]) {
  const W = g.nLat + 1;
  const out = new Float32Array(axis.length * W).fill(MISSING_F);
  const layerOf = new Map(gridYears.map((y, i) => [y, i]));
  axis.forEach((y, yi) => {
    const layer = layerOf.get(y);
    if (layer === undefined) return;
    const z = zonalLayer(grid, layer, g, offsets);
    z.rowMean.forEach((m, r) => { if (m !== null) out[yi * W + r] = m * 100; });
    if (z.globalMean !== null) out[yi * W + g.nLat] = z.globalMean * 100;
  });
  return out;
}

/**
 * Collapse slots (MOTION_SYSTEM 5.7 phase 3): for one year, each cell's
 * [x0, x1] fraction of the strip it travels to. Valid cells merge: each widens
 * to the whole strip while its colour becomes the row mean, so the row lands as
 * one solid band (sub-pixel slivers would rasterize as moire). Missing cells
 * collapse to zero width at their column position and vanish. A row under the
 * 20% rule merges the same way and becomes lattice.
 */
export function collapseSlots(grid: Int8Array, layer: number, g: GridGeom, offsets: readonly (number | null)[]) {
  const { nLat, nLon } = g;
  const out = new Float32Array(nLat * nLon * 2);
  const base = layer * nLat * nLon;
  for (let i = 0; i < nLat * nLon; i++) {
    const off = offsets[i], f = ((i % nLon) + 0.5) / nLon;
    const valid = grid[base + i] !== MISSING_BYTE && off !== null && off !== undefined;
    out[i * 2] = valid ? 0 : f;
    out[i * 2 + 1] = valid ? 1 : f;
  }
  return out;
}

/**
 * Area shares for one year: `measured` = cos(lat)-weighted share of the globe
 * with a value (equals the sidecar's valid_area_share_per_year); `referenced` =
 * share that also has an offset under the chosen baseline (renders as colour).
 */
export function areaShares(grid: Int8Array, layer: number, g: GridGeom, offsets: readonly (number | null)[]) {
  const { nLat, nLon } = g, base = layer * nLat * nLon;
  let all = 0, measured = 0, referenced = 0;
  for (let r = 0; r < nLat; r++) {
    const w = Math.cos(((g.latFirst - r * g.step) * Math.PI) / 180);
    for (let c = 0; c < nLon; c++) {
      const i = r * nLon + c;
      all += w;
      if (grid[base + i] === MISSING_BYTE) continue;
      measured += w;
      if (offsets[i] !== null && offsets[i] !== undefined) referenced += w;
    }
  }
  return { measured: measured / all, referenced: referenced / all };
}

/**
 * Region readout (OBS cross-filter contract): the cos(lat)-weighted mean of
 * exactly the cells rendered as valid in [latMin, latMax] (cell centres), plus
 * the observed share of the region's area. `value` maps a cell to the number
 * shown (anomaly, trend, ...) or null when it is not rendered as valid.
 */
export function regionMean(g: GridGeom, latMin: number, latMax: number, value: (i: number) => number | null) {
  let all = 0, w = 0, s = 0, n = 0;
  for (let r = 0; r < g.nLat; r++) {
    const lat = g.latFirst - r * g.step;
    if (lat < latMin || lat > latMax) continue;
    const c = Math.cos((lat * Math.PI) / 180);
    for (let k = 0; k < g.nLon; k++) {
      all += c;
      const v = value(r * g.nLon + k);
      if (v === null) continue;
      w += c; s += c * v; n++;
    }
  }
  return { mean: w > 0 ? s / w : null, share: all > 0 ? w / all : 0, n };
}

/** Anomaly accessor in degrees C for one layer and offset set (null = missing or no reference). */
export const anomalyAt = (grid: Int8Array, layer: number, g: GridGeom, offsets: readonly (number | null)[]) => {
  const base = layer * g.nLat * g.nLon;
  return (i: number) => { const b = grid[base + i]!, o = offsets[i]; return b === MISSING_BYTE || o === null || o === undefined ? null : b * 0.1 - o * 0.01; };
};

/** Share of the measured (referenced) area at +2 C or more under the given offsets (S03a / OBS +2 C readout). */
export function shareAtLeast(grid: Int8Array, layer: number, g: GridGeom, offsets: readonly (number | null)[], c100 = 200) {
  const at = anomalyAt(grid, layer, g, offsets);
  const all = regionMean(g, -90, 90, at);
  const hot = regionMean(g, -90, 90, (i) => { const v = at(i); return v === null ? null : Math.round(v * 100) >= c100 ? 1 : 0; });
  return all.share > 0 ? hot.mean : null;
}
