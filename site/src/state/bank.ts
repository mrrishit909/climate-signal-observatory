/**
 * Decoded grid data shared by the WebGL renderer, the Canvas2D painter and the
 * readouts: one copy of each grid, plus derived core textures (zonal means per
 * year) built in an idle callback per (source, baseline).
 */
import { getStore } from "../data/loader";
import { COAST, GRID_INTRO, GRIDS, REGIONAL, TREND_GRIDS } from "../data/artifacts";
import type { Grid, TrendGrid } from "../data/grid";
import type { Band, Baseline, Coastlines, Regional, Source } from "../data/types";
import { collapseSlots, coreTexture, type GridGeom } from "../model/zonal";
import type { GridKey } from "../gl/frame";
import { idle } from "../lib/math";

export interface GridData extends Grid { key: GridKey; geom: GridGeom }
type Listener = () => void;

const geomOf = (g: Grid): GridGeom => ({ nLat: g.meta.grid.n_lat, nLon: g.meta.grid.n_lon, latFirst: g.meta.grid.lat_first_center, step: g.meta.grid.lat_step_deg });

class Bank {
  grids = new Map<GridKey, GridData>();
  cores = new Map<string, Float32Array>();
  coast: Coastlines | null = null;
  trends = new Map<Source, TrendGrid>();
  bands: Band[] = [];
  version = 0;
  private listeners = new Set<Listener>();
  private pending = new Set<string>();

  subscribe = (l: Listener) => { this.listeners.add(l); return () => void this.listeners.delete(l); };
  getVersion = () => this.version;
  private bump() { this.version++; this.listeners.forEach((l) => l()); }

  addGrid(key: GridKey, g: Grid) {
    if (this.grids.has(key)) return;
    this.grids.set(key, { ...g, key, geom: geomOf(g) });
    this.bump();
  }
  setCoast(c: Coastlines) { this.coast = c; this.bump(); }
  addTrend(s: Source, t: TrendGrid) { if (!this.trends.has(s)) { this.trends.set(s, t); this.bump(); } }
  setBands(b: Band[]) { this.bands = b; this.bump(); }
  band(id: string) { return this.bands.find((b) => b.id === id); }
  /** Layer indices of a trend period in a DR-3 grid: [slope, significant]. */
  trendLayers(s: Source, period: string): [number, number] | null {
    const t = this.trends.get(s);
    const i = t?.meta.periods.findIndex((p) => p.id === period) ?? -1;
    return t && i >= 0 ? [i, t.meta.periods.length + i] : null;
  }

  /** The shared annual axis 1850..latest complete year (DATA_CONTRACTS). */
  axis(): number[] {
    const last = this.grids.get("gistemp")?.meta.years.last ?? this.grids.get("hadcrut5")?.meta.years.last ?? this.grids.get("intro")?.meta.years.last ?? 2025;
    return Array.from({ length: last - 1849 }, (_, i) => 1850 + i);
  }

  /** Core texture key for (grid, baseline): requested lazily, built in an idle slot (MOTION_SYSTEM 5.7). */
  core(key: GridKey, base: Baseline): Float32Array | null {
    const id = `${key}:${base}`;
    const hit = this.cores.get(id);
    if (hit) return hit;
    const g = this.grids.get(key);
    const off = g?.meta.baseline_offsets[base]?.values;
    if (!g || !off || this.pending.has(id)) return null;
    this.pending.add(id);
    const run = () => {
      this.cores.set(id, coreTexture(g.data, g.geom, g.meta.years.list, off, this.axis()));
      this.pending.delete(id);
      this.bump();
    };
    idle(run, 200);
    return null;
  }

  slots(key: GridKey, year: number, base: Baseline) {
    const g = this.grids.get(key);
    const off = g?.meta.baseline_offsets[base]?.values;
    const layer = g?.meta.years.list.indexOf(year) ?? -1;
    return g && off && layer >= 0 ? collapseSlots(g.data, layer, g.geom, off) : null;
  }
}

export const bank = new Bank();

const watch = <T,>(store: { subscribe: (l: Listener) => () => void; getState: () => { status: string; data?: T } }, fn: (d: T) => void) => {
  const check = () => { const s = store.getState(); if (s.status === "ready") fn(s.data as T); };
  store.subscribe(check);
  check();
};

/** Wire artifact stores into the bank once. The full grids load on demand (after first paint). */
export function connectBank() {
  watch<Grid>(getStore(GRID_INTRO), (g) => bank.addGrid("intro", g));
  watch<Coastlines>(getStore(COAST), (c) => bank.setCoast(c));
  (["gistemp", "hadcrut5"] as Source[]).forEach((s) => {
    watch<Grid>(getStore(GRIDS[s]), (g) => bank.addGrid(s, g));
    watch<TrendGrid>(getStore(TREND_GRIDS[s]), (t) => bank.addTrend(s, t));
  });
  watch<Regional>(getStore(REGIONAL), (r) => bank.setBands(r.bands));
}
