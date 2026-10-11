/**
 * Canvas2D painter for the same Frame the WebGL renderer draws: the NO-WEBGL
 * tier and every reduced-motion static frame (MOTION_SYSTEM 8, 9.2). No
 * crossfades (0ms on these tiers); cells grouped by colour into one path each.
 */
import { BINS, binIndex, cellValue100, hexRgb } from "../model/bins";
import { trendBinIndex } from "../model/trend";
import { MISSING_F } from "../model/zonal";
import { unwrapVertex } from "./projection";
import { HIDDEN, type Frame } from "./frame";
import type { GridData } from "../state/bank";

const RGB = BINS.map((b) => hexRgb(b.color));

function dotPattern(ctx: CanvasRenderingContext2D, dpr: number, alpha: number, pitch = 4) {
  const s = Math.max(1, Math.round(pitch * dpr)), d = Math.max(1, Math.round(dpr));
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d")!;
  g.fillStyle = `rgba(255,255,255,${alpha})`;
  g.fillRect(0, 0, d, d);
  const p = ctx.createPattern(c, "repeat")!;
  p.setTransform(new DOMMatrix().scale(1 / dpr));
  return p;
}
const css = (rgb: readonly number[], k = 1) => `rgb(${Math.round(rgb[0]! * 255 * k)},${Math.round(rgb[1]! * 255 * k)},${Math.round(rgb[2]! * 255 * k)})`;

export interface Paint2DData {
  grid: (key: string) => GridData | undefined;
  core: (key: string) => Float32Array | undefined;
  /** collapse slots for the drawn grid (valid cells merge across the strip; missing cells have zero width) */
  slots: (grid: string) => Float32Array | undefined;
  trend: (key: string) => { data: Int8Array } | undefined;
  coast: { coords: number[]; starts: number[] } | null;
}

/** Paint `f` into ctx (already scaled to CSS px). */
export function paint2d(ctx: CanvasRenderingContext2D, f: Frame, data: Paint2DData) {
  ctx.save();
  const lattice = dotPattern(ctx, f.dpr, f.lattice);
  const stipple = dotPattern(ctx, f.dpr, 0.25, 3);
  const L = [...f.cells].sort((a, b) => b.alpha - a.alpha)[0];
  const g = L ? data.grid(L.grid) : undefined;
  const u = f.u;
  if (L && g && f.cellAlpha > 0) {
    const layer = L.mix >= 0.5 ? L.layerB : L.layerA;
    const off = g.meta.baseline_offsets[L.baseMix >= 0.5 ? L.baseB : L.baseA]?.values;
    const collapse = f.collapseKey && f.core ? data.core(f.collapseKey) : undefined;
    const tr = f.mode === 1 && f.trend && L.grid !== "intro" ? data.trend(f.trend.key) : undefined;
    const { nLat, nLon, step } = g.geom;
    const fills = new Map<string, Path2D>();
    const add = (key: string) => { let p = fills.get(key); if (!p) { p = new Path2D(); fills.set(key, p); } return p; };
    const miss = new Path2D(), unsure = new Path2D(), outline = new Path2D();
    const base = layer * nLat * nLon, plane = nLat * nLon;
    const slots = u.s2 > 0 ? data.slots(L.grid) : undefined;
    const [bMin, bMax, bOn] = f.band;
    for (let r = 0; r < nLat; r++) {
      const latN = 90 - r * step, latS = latN - step, latC = latN - step / 2;
      const outside = bOn > 0 && (latC < bMin || latC > bMax);
      let rowBin = -1;
      if (collapse && u.s2 > 0) {
        const m = collapse[f.core!.cur * (nLat + 1) + r]!;
        rowBin = m <= MISSING_F ? -2 : binIndex(m);
      }
      for (let c = 0; c < nLon; c++) {
        const i = r * nLon + c, lonW = -180 + c * step, lonE = lonW + step;
        const v = off ? cellValue100(g.data[base + i]!, off[i] ?? null) : null;
        const slot0 = slots ? slots[i * 2]! : c / nLon, slot1 = slots ? slots[i * 2 + 1]! : (c + 1) / nLon;
        const pts = [unwrapVertex(lonW, latN, slot0, u), unwrapVertex(lonE, latN, slot1, u), unwrapVertex(lonE, latS, slot1, u), unwrapVertex(lonW, latS, slot0, u)];
        if (u.s1 <= 0 && pts.every((p) => p[2] < 0)) continue;
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, cx = 0, cy = 0;
        for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); cx += p[0] / 4; cy += p[1] / 4; }
        let bin = v === null ? -2 : binIndex(v);
        let rgb: readonly number[] | null = bin >= 0 ? RGB[bin]! : null;
        let sig = true, hot = false;
        if (tr) {
          const sl = tr.data[f.trend!.slope * plane + i]!;
          bin = sl === -128 ? -2 : trendBinIndex(sl);
          rgb = bin >= 0 ? RGB[bin]! : null;
          sig = tr.data[f.trend!.sig * plane + i] !== 0;
        } else if (f.mode === 3) rgb = v === null ? null : [0.3, 0.3, 0.3];
        else if (f.mode === 2 && rgb) { hot = v! >= 200; if (!hot) rgb = rgb.map((x) => x * 0.35); }
        if (rowBin !== -1 && u.s2 > 0) {
          const rb = rowBin >= 0 ? RGB[rowBin]! : null;
          if (u.s2 >= 1 || !rgb || !rb) rgb = u.s2 >= 0.5 ? rb : rgb;
          else rgb = rgb.map((x, k) => x + (rb[k]! - x) * u.s2);
        }
        const k = (outside ? 0.3 : 1) * f.dim;
        // 0.5px hairline only where a cell is large enough to carry it
        const big = Math.min(x1 - x0, y1 - y0) > 7 && f.gap > 0;
        const target = rgb ? add(css(rgb, k)) : miss;
        const shrink = (p: [number, number, number]): [number, number] => {
          if (!big) return [p[0], p[1]];
          const dx = p[0] - cx, dy = p[1] - cy, d = Math.hypot(dx, dy) || 1;
          return [p[0] - (dx / d) * 0.7, p[1] - (dy / d) * 0.7];
        };
        const q = pts.map(shrink);
        for (const t of [target, ...(rgb && !sig ? [unsure] : []), ...(hot ? [outline] : [])]) {
          q.forEach(([x, y], j) => (j === 0 ? t.moveTo(x, y) : t.lineTo(x, y)));
          t.closePath();
        }
      }
    }
    ctx.globalAlpha = f.cellAlpha;
    fills.forEach((p, key) => { ctx.fillStyle = key; ctx.fill(p); });
    ctx.fillStyle = "#000"; ctx.fill(miss);
    ctx.globalAlpha = f.cellAlpha * f.dim;
    ctx.fillStyle = lattice; ctx.fill(miss);
    ctx.fillStyle = stipple; ctx.fill(unsure);
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.stroke(outline);
  }
  if (data.coast && f.coast > 0) {
    const { coords, starts } = data.coast, n = coords.length / 2;
    const path = new Path2D();
    for (let i = 0; i < starts.length; i++) {
      const a = starts[i]!, b = (starts[i + 1] ?? n) - 1;
      let pen = false;
      for (let k = a; k <= b; k++) {
        const [x, y, z] = unwrapVertex(coords[k * 2]!, coords[k * 2 + 1]!, 0.5, u);
        if (u.s1 <= 0 && z < 0) { pen = false; continue; }
        if (pen) path.lineTo(x, y); else path.moveTo(x, y);
        pen = true;
      }
    }
    ctx.globalAlpha = f.coast;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    ctx.stroke(path);
  }
  if (f.band[2] > 0) {
    const path = new Path2D();
    for (const lat of [f.band[0], f.band[1]]) {
      if (Math.abs(lat) >= 89.9) continue;
      let pen = false;
      for (let lon = -180; lon <= 180; lon += 2) {
        const [x, y, z] = unwrapVertex(lon, lat, 0.5, u);
        if (u.s1 <= 0 && z < 0) { pen = false; continue; }
        if (pen) path.lineTo(x, y); else path.moveTo(x, y);
        pen = true;
      }
    }
    ctx.globalAlpha = f.band[2] * f.cellAlpha;
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.stroke(path);
  }
  const k = f.core, core = k ? data.core(k.key) : undefined;
  if (k && core) {
    const W = k.nLat + 1, n = k.v.length / 4, t = k.bench;
    ctx.globalAlpha = k.alpha;
    const fillQuad = (style: string | CanvasPattern, c: [number, number][]) => {
      ctx.fillStyle = style;
      ctx.beginPath(); c.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill();
    };
    // corner (s, t) of stratum i: upright (x + s w, y + t h) mixed with lying (x + t w, y + (1 - s) h)
    const corner = (i: number, s: number, tt: number, box: Float32Array, lie: Float32Array): [number, number] => {
      const ux = box[i * 4]! + s * box[i * 4 + 2]!, uy = box[i * 4 + 1]! + tt * box[i * 4 + 3]!;
      const lx = lie[i * 4]! + tt * lie[i * 4 + 2]!, ly = lie[i * 4 + 1]! + (1 - s) * lie[i * 4 + 3]!;
      return [ux + (lx - ux) * t, uy + (ly - uy) * t];
    };
    for (let i = 0; i < n; i++) {
      if (k.v[i * 4 + 1]! <= HIDDEN) continue;
      for (let r = 0; r < k.nLat; r++) {
        const latN = 90 - r * k.step, latS = Math.max(-90, latN - k.step);
        const s0 = (1 + Math.sin((latS * Math.PI) / 180)) / 2, s1 = (1 + Math.sin((latN * Math.PI) / 180)) / 2;
        const m = core[i * W + r]!;
        const quad = [corner(i, s0, 0, k.v, k.h), corner(i, s1, 0, k.v, k.h), corner(i, s1, 1, k.v, k.h), corner(i, s0, 1, k.v, k.h)];
        if (m <= MISSING_F) { fillQuad("#000", quad); fillQuad(lattice, quad); } else fillQuad(css(RGB[binIndex(m)]!, f.dim), quad);
      }
      if (t < 1 && k.spine[i * 4 + 1]! > HIDDEN) {
        const m = core[i * W + k.nLat]!;
        const [x, y, w, h] = [k.spine[i * 4]!, k.spine[i * 4 + 1]!, k.spine[i * 4 + 2]!, k.spine[i * 4 + 3]!];
        ctx.fillStyle = m <= MISSING_F ? lattice : css(RGB[binIndex(m)]!, f.dim);
        ctx.fillRect(x, y, w, h);
      }
    }
  }
  ctx.restore();
}
