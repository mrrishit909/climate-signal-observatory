/**
 * Geometry states (VISUAL_DESIGN 3.3) as functions of the stage box, so any
 * viewport gets the D / T / M composition scaled from the table. CSS px.
 */
import { EE_XMAX } from "../gl/projection";
import { viewportClass, type ViewportClass } from "../graphics/canvas";

export interface Disc { cx: number; cy: number; r: number }
export interface Layout {
  cls: ViewportClass;
  w: number;
  h: number;
  G0: Disc; // oversized orb / planet (S00, S01 start): at least 120vh
  G1s: Disc; // planet aside (S01-S03b)
  /** S03a planet: on phones it rises to sit just under the headline so the readout fits below it; G1s elsewhere */
  G1m: Disc;
  /** S03b planet: on phones it also shrinks so the regional card sits under it; G1s elsewhere */
  G1r: Disc;
  G1: Disc; // planet centred (S04 start)
  sheet: { cx: number; cy: number; k: number; width: number };
  strip: number; // collapsed strip width
  core: { x0: number; x1: number; y0: number; H: number; n: number; spine: [number, number] };
  /** S05 bench (K3): the core lying down, time on x shared with the series band above it */
  bench: { x0: number; x1: number; y0: number; y1: number; series: [number, number] };
  /** OBS: the docked core (K2) and the planet; on M the docked core lies horizontally */
  dock: { x0: number; x1: number; y0: number; y1: number; lying: boolean };
  obs: Disc;
  /** S08: the surface, radius past the half-diagonal so no limb is in frame */
  G5: Disc;
}

/**
 * The composition class comes from the full window width, the same number the CSS media queries use (L1):
 * with classic scrollbars clientWidth is 15px narrower and would draw the next class down. Positions use w.
 */
export const cssClass = (): ViewportClass => (typeof window === "undefined" ? "D" : matchMedia("(min-width: 1024px)").matches ? "D" : matchMedia("(min-width: 768px)").matches ? "T" : "M");
export function layout(w: number, h: number, n = 176, cls: ViewportClass = typeof window === "undefined" ? viewportClass(w) : cssClass()): Layout {
  const half = Math.hypot(w, h) / 2;
  // G0: D 560/900, T 620/1024, M 510/844 of the height; on M also at least the half-diagonal (frame is all planet)
  const G0: Disc = cls === "D" ? { cx: w / 2, cy: h / 2, r: 0.622 * h } : cls === "T" ? { cx: w / 2, cy: h / 2, r: 0.606 * h } : { cx: w / 2, cy: h / 2, r: Math.max(0.605 * h, half + 2) };
  // L2: from 1024 to 1279 the 400px text column needs the planet pulled right and down in size (compact desktop)
  const g1r = cls === "D" && w < 1280 ? Math.min(0.356 * h, (w - 520) / 2 - 12) : 0.356 * h;
  const G1s: Disc = cls === "D" ? { cx: w < 1280 ? w - g1r - 24 : 0.694 * w, cy: 0.522 * h, r: g1r } : cls === "T" ? { cx: w / 2, cy: 0.77 * h, r: 0.18 * h } : { cx: w / 2, cy: 0.45 * h, r: Math.min(0.385 * w, 0.178 * h) };
  const G1m: Disc = cls === "M" ? { cx: w / 2, cy: Math.max(0.3 * h, 136 + G1s.r), r: G1s.r } : G1s;
  const G1r: Disc = cls === "M" ? { cx: w / 2, cy: 0.3 * h, r: Math.min(0.36 * w, 0.15 * h) } : G1s;
  const G1: Disc = cls === "D" ? { cx: w / 2, cy: h / 2, r: 0.322 * h } : cls === "T" ? { cx: w / 2, cy: 0.44 * h, r: 0.273 * h } : { cx: w / 2, cy: 0.391 * h, r: Math.min(0.41 * w, 0.19 * h) };
  const sheetW = cls === "D" ? 0.75 * w : 0.917 * w;
  const sheet = { cx: w / 2, cy: (cls === "D" ? 0.478 : cls === "T" ? 0.508 : 0.45) * h, k: sheetW / (2 * EE_XMAX), width: sheetW };
  // live stages use integer stratum heights (3.2); small static figures (reduced motion) scale fractionally
  const figure = h < 600 && cls !== "M" || h < 500;
  // phones under 840 high: a fractional 0.6h core so the source toggle and notes fit under it (L2)
  const H = figure ? (0.8 * h) / n : cls === "M" && h < 840 ? (0.6 * h) / n : Math.min(cls === "M" ? 3 : 4, Math.max(1, Math.floor((0.8 * h) / n)));
  const cw = figure ? Math.min(0.45 * w, (cls === "D" ? 220 : 200) * (h / 900)) : cls === "D" ? 220 : cls === "T" ? 200 : 150;
  // compact desktop (1024-1279): the core moves right of centre so the 380px text column clears it
  const x0 = Math.round((cls === "D" && w < 1280 && !figure ? 0.6 * w : w / 2) - cw / 2), total = n * H;
  const y0 = figure ? (h - total) / 2 : Math.round(cls === "M" ? (h < 840 ? 0.11 : 0.1) * h : (h - total) / 2 - (cls === "T" ? 10 : 0));
  const sw = cls === "M" ? 8 : 12;
  // short desktop (< 820 high): the bench rises so the result block and its tags stay above the nav
  const bench = cls === "D" ? (h < 820 ? { x0: 0.43 * w, x1: 0.43 * w + Math.floor((0.49 * w) / n) * n, y0: 0.57 * h, y1: 0.67 * h, series: [0.15 * h, 0.53 * h] as [number, number] }
    : { x0: 0.43 * w, x1: 0.43 * w + Math.floor((0.49 * w) / n) * n, y0: 0.622 * h, y1: 0.733 * h, series: [0.167 * h, 0.578 * h] as [number, number] })
    : cls === "T" ? { x0: 0.156 * w, x1: 0.156 * w + Math.floor((0.844 * w - 48) / n) * n, // whole px per year up to 48px from the edge (a 15px scrollbar must not drop a px)
      y0: 0.605 * h, y1: 0.684 * h, series: [0.2 * h, 0.57 * h] as [number, number] } // D-010: the series fills the band under the title
    // phones: the bench spans the width (fractional px per year: below 390 a whole px would halve it) and sits higher, so the result block and its tags clear the control sheet
    : { x0: 19, x1: w - 19, y0: 0.444 * h, y1: 0.51 * h, series: [0.07 * h, 0.42 * h] as [number, number] };
  const dock = cls === "D" ? { x0: 0.826 * w, x1: 0.826 * w + 120, y0: k0(), y1: k0() + n * H, lying: false }
    : cls === "T" ? { x0: 0.833 * w, x1: 0.833 * w + 80, y0: k0(), y1: k0() + n * H, lying: false }
    : { x0: 19, x1: 19 + Math.floor((w - 38) / n) * n, y0: 0.818 * h, y1: 0.889 * h, lying: true };
  function k0() { return Math.round(cls === "M" ? (h < 840 ? 0.11 : 0.1) * h : (h - n * H) / 2 - (cls === "T" ? 10 : 0)); }
  // D: the planet sits on the nav line, under the head block and left of the control rail (rail left edge as in scenes.css)
  const obsR = 0.27 * h, railLeft = w < 1280 ? 0.826 * w - 276 : 0.826 * w - 304;
  const obs: Disc = cls === "D" ? { cx: Math.min(0.4 * w, railLeft - obsR - 16), cy: h - 100 - obsR, r: obsR } : cls === "T" ? { cx: w / 2, cy: 0.385 * h, r: 0.215 * h } : { cx: w / 2, cy: 0.391 * h, r: Math.min(0.41 * w, 0.19 * h) };
  const G5: Disc = { cx: w / 2, cy: h / 2, r: 1.2 * half };
  return {
    cls, w, h, G0, G1s, G1m, G1r, G1, sheet, bench, dock, obs, G5, strip: cls === "D" ? 24 : cls === "T" ? 20 : 16,
    core: { x0, x1: x0 + cw, y0, H, n, spine: [x0 + cw + 4, x0 + cw + 4 + sw] },
  };
}

/** Log-space radius and linear centre between two discs (MOTION_SYSTEM 5.3). */
export const discLerp = (a: Disc, b: Disc, s: number): Disc => ({
  cx: a.cx + (b.cx - a.cx) * s,
  cy: a.cy + (b.cy - a.cy) * s,
  r: a.r * Math.pow(b.r / a.r, s),
});
