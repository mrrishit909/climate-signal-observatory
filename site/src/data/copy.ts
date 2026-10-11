/**
 * Copy deck bindings (VISUAL_DESIGN 5). Every number on screen is formatted
 * here, by model/format.ts, from a named facts.json / artifact field, so the
 * copy-parity Vitest can check the rendered copy against the artifacts.
 * Mono copy is uppercase; serif statements are sentence case.
 */
import { fixed, int, pct, signed } from "../model/format";
import { fact, num, type Baseline, type Facts, type Source, type Validation } from "./types";

export const SOURCE_LABEL: Record<Source, string> = { gistemp: "GISTEMP 2°", hadcrut5: "HADCRUT5 5°" };
export const SOURCE_NAME: Record<Source, string> = { gistemp: "NASA GISTEMP v4", hadcrut5: "MET OFFICE HADCRUT5" };

export function copyS00(f: Facts | null) {
  const year = f ? String(num(f, "latest_complete_year")) : "";
  return {
    headline: "The planet is keeping a record.",
    note: "CELLS = GISTEMP v4, 2° ANNUAL MEANS VS 1951-1980. DOTS = NOT MEASURED.",
    noGl: "3D GLOBE UNAVAILABLE: FLAT MAPS USED",
    alt: `Animated introduction: a giant glowing orb cools into a globe of measured temperature anomalies, running from 1880 to ${year}. Unmeasured areas are dotted.`,
  };
}

export const copyS03a = {
  statement: "The planet, one year at a time.",
  body: "EACH SQUARE IS 2° OF SURFACE. ORANGE IS WARMER THAN THE CHOSEN NORMAL, BLUE IS COOLER, DOTS WERE NOT MEASURED.",
  disabled1850: "GISTEMP BEGINS IN 1880: NO 1850-1900 BASELINE",
};

export interface YearReadoutIn {
  year: number;
  source: Source;
  baseline: Baseline;
  global: number | null;
  rank: { rank: number; of: number } | null;
  co2: number | null;
  co2First: number;
  measured: number | null;
  extremes: { share: number | null; expected: number | null } | null;
  lostMost: boolean;
}
/** S03a readout lines (each value already bound by the caller to its artifact field). */
export function yearReadout(r: YearReadoutIn) {
  return {
    year: String(r.year),
    global: r.global === null ? `GLOBAL n/a VS ${r.baseline}` : `GLOBAL ${signed(r.global)} °C VS ${r.baseline}`,
    rank: r.rank ? `RANK ${r.rank.rank} OF ${r.rank.of} COMPLETE YEARS` : "NOT RANKED",
    co2: r.co2 === null ? `NOT MEASURED AT MAUNA LOA (RECORD BEGINS ${r.co2First})` : `CO2 ${fixed(r.co2, 1)} PPM · MAUNA LOA`,
    measured: r.measured === null ? "MEASURED AREA n/a" : `MEASURED AREA ${pct(r.measured)}%`,
    extremes: r.extremes === null ? `NO EXTREMES REFERENCE FOR ${r.baseline}`
      : r.extremes.share === null ? `NO EXTREMES VALUE FOR ${r.year}`
      : `${pct(r.extremes.share)}% OF MEASURED AREA ABOVE ITS OWN ${r.baseline} 95TH PERCENTILE (${pct(r.extremes.expected ?? 0)}% EXPECTED)`,
    lost: r.lostMost ? `MANY CELLS HAVE NO ${r.baseline} REFERENCE` : "",
  };
}

export function copyS04(f: Facts, x: { nCells: number; nLayers: number; source: Source; firstYear: number; firstShare: number; latestYear: number; latestShare: number; validation: Validation | null; baseline: Baseline }) {
  const n = num(f, "years_since_2010_in_gistemp_top10");
  const s2 = n >= 10 ? "The ten warmest layers all came after 2010." : n >= 5 ? `${n} of the ten warmest layers came after 2010.` : "The warmest layers are on top.";
  const who = x.source === "gistemp" ? "NASA'S" : "THE MET OFFICE'S";
  const v = x.validation?.grid_vs_official_global[x.source]?.max_abs_diff;
  return {
    s1: "Unwrap the planet and it becomes a record.",
    s2,
    captions: [
      `1 · ${int(x.nCells)} SQUARES`,
      "2 · UNWRAPPED, EQUAL AREA",
      "3 · EACH ROW AVERAGED",
      "4 · ONE YEAR = ONE LAYER",
      `5 · ${x.nLayers} LAYERS, OLDEST AT THE BOTTOM`,
    ],
    footnote: v === undefined ? "SPINE = MEAN OF THE GRID CELLS SHOWN." : `SPINE = MEAN OF THE GRID CELLS SHOWN. ${who} OFFICIAL GLOBAL SERIES DIFFERS BY AT MOST ${fixed(v, 3)} °C (NATIVE BASELINE).`,
    coverage: `MEASURED AREA ${pct(x.firstShare)}% IN ${x.firstYear} → ${pct(x.latestShare)}% IN ${x.latestYear}`,
    begins: "GISTEMP BEGINS 1880",
    loading: "LAYERS FILL WHEN THE FULL GRID LANDS",
    alt: `Each year's layer is the average of every measured ${x.source === "gistemp" ? "2" : "5"}-degree cell in each latitude row, under the ${x.baseline} baseline.`,
  };
}

/** Facts the S01 intro chip and alternative text need (DR-1 years come from the sidecar). */
export const latestYear = (f: Facts) => num(f, "latest_complete_year");
export const top10 = (f: Facts) => fact<number[]>(f, "top10_warmest_years_gistemp");
