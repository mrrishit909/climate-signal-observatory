/**
 * Canvas2D painter for the same Frame the WebGL renderer draws: the NO-WEBGL
 * tier and every reduced-motion static frame (MOTION_SYSTEM 8, 9.2). No
 * crossfades (0ms on these tiers), cells grouped by bin into one path each.
 */
import { BINS, binIndex, cellValue100, hexRgb } from "../model/bins";
import { MISSING_F } from "../model/zonal";
import { unwrapVertex } from "./projection";
import { HIDDEN, type Frame } from "./frame";
import type { GridData } from "../state/bank";

const RGB = BINS.map((b) => hexRgb(b.color));

function latticePattern(ctx: CanvasRenderingContext2D, dpr: number, alpha: number) {
  const s = Math.max(1, Math.round(4 * dpr)), d = Math.max(1, Math.round(dpr));
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d")!;
  g.fillStyle = `rgba(255,255,255,${alpha})`;
  g.fillRect(0, 0, d, d);
  const p = ctx.createPattern(c, "repeat")!;
  p.setTransform(new DOMMatrix().scale(1 / dpr));
  return p;
}
const css = ([r, g, b]: number[], k = 1) => `rgb(${Math.round(r! * 255 * k)},${Math.round(g! * 255 * k)},${Math.round(b! * 255 * k)})`;

export interface Paint2DData {
  grid: (key: string) => GridData | undefined;
  core: (key: string) => Float32Array | undefined;
  /** collapse slots for the drawn grid (valid cells share the strip; missing cells have zero width) */
  slots: (grid: string) => Float32Array | undefined;
  coast: { coords: number[]; starts: number[] } | null;
}

/** Paint `f` into ctx (already scaled to CSS px). */
export function paint2d(ctx: CanvasRenderingContext2D, f: Frame, data: Paint2DData) {
  ctx.save();
  const lattice = latticePattern(ctx, f.dpr, f.lattice);
  const L = [...f.cells].sort((a, b) => b.alpha - a.alpha)[0];
  const g = L ? data.grid(L.grid) : undefined;
  const u = f.u;
  if (L && g && f.cellAlpha > 0) {
    const layer = L.mix >= 0.5 ? L.layerB : L.layerA;
    const off = g.meta.baseline_offsets[L.baseMix >= 0.5 ? L.baseB : L.baseA]?.values;
    const collapse = f.collapseKey && f.core ? data.core(f.collapseKey) : undefined;
    const { nLat, nLon, step } = g.geom;
    const paths = RGB.map(() => new Path2D()), miss = new Path2D();
    const mixed = new Map<string, Path2D>();
    const base = layer * nLat * nLon;
    const shrink = 1 - 2 * f.gap;
    const slots = u.s2 > 0 ? data.slots(L.grid) : undefined;
    for (let r = 0; r < nLat; r++) {
      const latN = 90 - r * step, latS = latN - step;
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
        let cx = 0, cy = 0;
        for (const p of pts) { cx += p[0] / 4; cy += p[1] / 4; }
        let target: Path2D;
        const cellBin = v === null ? -2 : binIndex(v);
        const bin = rowBin !== -1 && u.s2 >= 0.5 ? rowBin : cellBin;
        if (rowBin !== -1 && u.s2 > 0 && u.s2 < 1 && rowBin >= 0 && cellBin >= 0 && rowBin !== cellBin) {
          const t = u.s2, a = RGB[cellBin]!, b = RGB[rowBin]!;
          const key = css(a.map((x, k) => x + (b[k]! - x) * t));
          target = mixed.get(key) ?? new Path2D();
          mixed.set(key, target);
        } else target = bin < 0 ? miss : paths[bin]!;
        pts.forEach((p, k) => {
          const x = cx + (p[0] - cx) * shrink, y = cy + (p[1] - cy) * shrink;
          if (k === 0) target.moveTo(x, y); else target.lineTo(x, y);
        });
        target.closePath();
      }
    }
    ctx.globalAlpha = f.cellAlpha;
    paths.forEach((p, k) => { ctx.fillStyle = css(RGB[k]!, f.dim); ctx.fill(p); });
    mixed.forEach((p, key) => { ctx.fillStyle = key; ctx.globalAlpha = f.cellAlpha * f.dim; ctx.fill(p); });
    ctx.globalAlpha = f.cellAlpha;
    ctx.fillStyle = "#000"; ctx.fill(miss);
    ctx.globalAlpha = f.cellAlpha * f.dim;
    ctx.fillStyle = lattice; ctx.fill(miss);
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
  const k = f.core, core = k ? data.core(k.key) : undefined;
  if (k && core) {
    const W = k.nLat + 1, half = (k.rect[1] - k.rect[0]) / 2, xc = k.rect[0] + half, H = k.rect[3];
    ctx.globalAlpha = k.alpha;
    for (let i = 0; i < k.ys.length; i++) {
      const y = k.ys[i]!;
      if (y > HIDDEN) for (let r = 0; r < k.nLat; r++) {
        const latN = 90 - r * k.step, latS = Math.max(-90, latN - k.step);
        const xa = xc + half * Math.sin((latS * Math.PI) / 180), xb = xc + half * Math.sin((latN * Math.PI) / 180);
        const m = core[i * W + r]!;
        ctx.fillStyle = m <= MISSING_F ? lattice : css(RGB[binIndex(m)]!, f.dim);
        if (m <= MISSING_F) { ctx.save(); ctx.fillStyle = "#000"; ctx.fillRect(xa, y, xb - xa, H); ctx.restore(); }
        ctx.fillRect(xa, y, xb - xa + 0.4, H);
      }
      const sy = k.spineYs[i]!;
      if (sy > HIDDEN) {
        const m = core[i * W + k.nLat]!;
        ctx.fillStyle = m <= MISSING_F ? lattice : css(RGB[binIndex(m)]!, f.dim);
        ctx.fillRect(k.spine[0], sy, k.spine[1] - k.spine[0], H);
      }
    }
  }
  ctx.restore();
}
