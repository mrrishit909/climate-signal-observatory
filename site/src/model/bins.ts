/**
 * Anomaly bins (VISUAL_DESIGN 0). Values are binned in integer hundredths of a
 * degree so TS and GLSL can never disagree at an edge. Edges are inclusive on
 * the side away from zero: -0.2 is C1, +0.2 is W1.
 */
export const BINS = [
  { id: "C5", color: "#E6F6FF", label: "-3.0 OR BELOW" },
  { id: "C4", color: "#8FD9FF", label: "-3.0 TO -2.0" },
  { id: "C3", color: "#58B8E1", label: "-2.0 TO -1.0" },
  { id: "C2", color: "#3A7BD5", label: "-1.0 TO -0.5" },
  { id: "C1", color: "#192CE4", label: "-0.5 TO -0.2" },
  { id: "N", color: "#2E2E2E", label: "-0.2 TO +0.2" },
  { id: "W1", color: "#B8361A", label: "+0.2 TO +0.5" },
  { id: "W2", color: "#FF4C25", label: "+0.5 TO +1.0" },
  { id: "W3", color: "#FF7A1F", label: "+1.0 TO +2.0" },
  { id: "W4", color: "#FFC23D", label: "+2.0 TO +3.0" },
  { id: "W5", color: "#FFF3A6", label: "+3.0 OR ABOVE" },
] as const;

/** Legend edge labels written under the 11 swatches (design constants, not data). */
export const EDGE_LABELS = ["-3", "-2", "-1", "-0.5", "-0.2", "+0.2", "+0.5", "+1", "+2", "+3"];

/** Bin index 0..10 for a value in hundredths of a degree C. */
export function binIndex(v100: number): number {
  if (v100 <= -300) return 0;
  if (v100 <= -200) return 1;
  if (v100 <= -100) return 2;
  if (v100 <= -50) return 3;
  if (v100 <= -20) return 4;
  if (v100 < 20) return 5;
  if (v100 < 50) return 6;
  if (v100 < 100) return 7;
  if (v100 < 200) return 8;
  if (v100 < 300) return 9;
  return 10;
}

export const MISSING_BYTE = -128;
/** Cell anomaly in hundredths (integer): stored byte is 0.1 C, offset is 0.01 C. null = missing. */
export function cellValue100(byte: number, off: number | null): number | null {
  return byte === MISSING_BYTE || off === null ? null : byte * 10 - off;
}

export const hexRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
};
