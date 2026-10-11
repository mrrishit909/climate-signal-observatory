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
  G1: Disc; // planet centred (S04 start)
  sheet: { cx: number; cy: number; k: number; width: number };
  strip: number; // collapsed strip width
  core: { x0: number; x1: number; y0: number; H: number; n: number; spine: [number, number] };
}

export function layout(w: number, h: number, n = 176, cls: ViewportClass = viewportClass(w)): Layout {
  const half = Math.hypot(w, h) / 2;
  // G0: D 560/900, T 620/1024, M 510/844 of the height; on M also at least the half-diagonal (frame is all planet)
  const G0: Disc = cls === "D" ? { cx: w / 2, cy: h / 2, r: 0.622 * h } : cls === "T" ? { cx: w / 2, cy: h / 2, r: 0.606 * h } : { cx: w / 2, cy: h / 2, r: Math.max(0.605 * h, half + 2) };
  const G1s: Disc = cls === "D" ? { cx: 0.694 * w, cy: 0.522 * h, r: 0.356 * h } : cls === "T" ? { cx: w / 2, cy: 0.664 * h, r: 0.264 * h } : { cx: w / 2, cy: 0.5 * h, r: Math.min(0.385 * w, 0.178 * h) };
  const G1: Disc = cls === "D" ? { cx: w / 2, cy: h / 2, r: 0.322 * h } : cls === "T" ? { cx: w / 2, cy: 0.44 * h, r: 0.273 * h } : { cx: w / 2, cy: 0.391 * h, r: Math.min(0.41 * w, 0.19 * h) };
  const sheetW = cls === "D" ? 0.75 * w : 0.917 * w;
  const sheet = { cx: w / 2, cy: (cls === "D" ? 0.478 : cls === "T" ? 0.508 : 0.45) * h, k: sheetW / (2 * EE_XMAX), width: sheetW };
  const H = Math.min(cls === "M" ? 3 : 4, Math.max(1, Math.floor((0.8 * h) / n)));
  const cw = cls === "D" ? 220 : cls === "T" ? 200 : 150;
  const x0 = Math.round(w / 2 - cw / 2), total = n * H;
  const y0 = Math.round(cls === "M" ? 0.114 * h : (h - total) / 2 - (cls === "T" ? 10 : 0));
  const sw = cls === "M" ? 8 : 12;
  return {
    cls, w, h, G0, G1s, G1, sheet, strip: cls === "D" ? 24 : cls === "T" ? 20 : 16,
    core: { x0, x1: x0 + cw, y0, H, n, spine: [x0 + cw + 4, x0 + cw + 4 + sw] },
  };
}

/** Log-space radius and linear centre between two discs (MOTION_SYSTEM 5.3). */
export const discLerp = (a: Disc, b: Disc, s: number): Disc => ({
  cx: a.cx + (b.cx - a.cx) * s,
  cy: a.cy + (b.cy - a.cy) * s,
  r: a.r * Math.pow(b.r / a.r, s),
});
