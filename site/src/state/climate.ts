/**
 * The visitor's analytical parameters shared by S03a, S04 and the readouts
 * (VISUAL_DESIGN 3.4 cross-filter contract, subset for Stage A). The displayed
 * year is published by the director whenever the integer year on screen changes.
 */
import type { Baseline, Source } from "../data/types";

export interface ClimateState { source: Source; baseline: Baseline; year: number; announce: string }
export const DEFAULTS: Omit<ClimateState, "year" | "announce"> = { source: "gistemp", baseline: "1951-1980" };
/** Only HadCRUT5 has a 1850-1900 baseline (GISTEMP begins 1880). */
export const baselineAllowed = (s: Source, b: Baseline) => !(s === "gistemp" && b === "1850-1900");
export const NATIVE: Record<Source, string> = { gistemp: "1951-1980", hadcrut5: "1961-1990" };
export const FIRST_YEAR: Record<Source, number> = { gistemp: 1880, hadcrut5: 1850 };

let state: ClimateState = { ...DEFAULTS, year: 2025, announce: "" };
const listeners = new Set<() => void>();
export const getClimate = () => state;
export const subscribeClimate = (l: () => void) => { listeners.add(l); return () => void listeners.delete(l); };
export function setClimate(p: Partial<ClimateState>) {
  const next = { ...state, ...p };
  // switching to GISTEMP while 1850-1900 is active snaps the baseline and says so (S03a SOURCE rule)
  if (!baselineAllowed(next.source, next.baseline)) {
    next.baseline = "1951-1980";
    next.announce = "BASELINE SET TO 1951-1980: GISTEMP HAS NO 1850-1900";
  }
  if (next.source !== state.source || next.baseline !== state.baseline || next.year !== state.year || next.announce !== state.announce) {
    state = next;
    listeners.forEach((l) => l());
  }
}
