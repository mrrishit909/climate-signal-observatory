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

// ---------------------------------------------------------------- Stage B
export function copyS01(f: Facts) {
  return {
    statement: "Every cell on this sphere is a measurement, or an honest gap.",
    card1Head: `FROM: NASA GISTEMP v4 / ${num(f, "latest_complete_year")}`,
    card1Body: `THE PLANET AVERAGED ${signed(num(f, "gistemp_latest_year_anomaly_1951_1980"))} °C ABOVE ITS 1951-1980 NORMAL.`,
    card2Head: `FROM: MAUNA LOA / ${fact<string>(f, "co2_mlo_latest_month")}`,
    card2Body: `${fixed(num(f, "co2_mlo_latest_ppm"), 2)} PPM OF CO2 IN THE AIR. MEASURED, NOT MODELLED.`,
  };
}

export function copyS02(f: Facts, x: { stepDeg: number; scale: number; missing: number; hadShare1880: number | null; offsetLabel: string; pipeline: string; generated: string; ar6Page: number | null }) {
  return [
    { chip: "RECORD 01 · THE CELL", title: "A cell, not a thermometer.",
      body: `STATIONS ON LAND AND SHIPS AND BUOYS AT SEA, BLENDED BY NASA INTO ${x.stepDeg}° SQUARES. EACH SQUARE HOLDS ONE NUMBER PER YEAR: HOW MUCH WARMER OR COOLER IT WAS THAN ITS OWN 1951-1980 NORMAL.`,
      fields: ["LAT", "LON", "YEAR", `ANOMALY (${x.scale} °C STEPS)`, `MISSING = ${x.missing}`] },
    { chip: "RECORD 02 · TWO AGENCIES", title: "Two agencies, two methods.",
      body: "NASA GISTEMP: 2° SQUARES FROM 1880. MET OFFICE HADCRUT5: 5° SQUARES FROM 1850. DIFFERENT METHODS, DIFFERENT GAPS. WE SHOW BOTH AND WHERE THEY DISAGREE." },
    { chip: "RECORD 03 · THE ZERO", title: "Every anomaly needs a zero.",
      body: `MOVING THE ZERO FROM 1951-1980 TO 1991-2020 SUBTRACTS ${x.offsetLabel} °C FROM EVERY GISTEMP YEAR. THE WARMING TREND DOES NOT CHANGE.` },
    { chip: "RECORD 04 · THE GAPS", title: "Gaps stay gaps.",
      body: `IN 1880, ${pct(num(f, "gistemp_valid_area_share_first_year"))}% OF THE SURFACE HAD A VALUE IN NASA'S RECORD, WHICH SPREADS EACH STATION'S SIGNAL UP TO 1200 KM.${x.hadShare1880 === null ? "" : ` THE MET OFFICE RECORD, WITHOUT THAT SMOOTHING, COVERED ${pct(x.hadShare1880)}%.`} WE NEVER FILL A MISSING SQUARE. IT STAYS DOTTED.`,
      foot: `PIPELINE v${x.pipeline} · GENERATED ${x.generated.slice(0, 10)}` },
    { sources: `SOURCES: NASA GISTEMP v4 · MET OFFICE HADCRUT5 5.2.0.0 · NOAA GML CO2 (MAUNA LOA AND GLOBAL) · IPCC AR6 WG1 SPM TABLE SPM.1${x.ar6Page === null ? "" : `, PRINTED PAGE ${x.ar6Page}`}` },
  ] as const;
}

export interface RegionCopy { title: string; body: string }
/** S03b state titles and bodies with their (CHECK) fallbacks (VISUAL_DESIGN 5). */
export function copyS03b(f: Facts, bandLabel: (id: string) => string, arcticSlope: number | null): { statement: string; states: RegionCopy[] } {
  const ratio = num(f, "arctic_to_global_trend_ratio_1975_latest");
  const land = fact<{ best_estimate: number }>(f, "ar6_published_land_2011_2020").best_estimate;
  const ocean = fact<{ best_estimate: number }>(f, "ar6_published_ocean_2011_2020").best_estimate;
  const gap = num(f, "land_minus_landocean_gap_latest_decade");
  const allUp = fact<boolean>(f, "band_trends_all_positive_1975_latest");
  const nUp = num(f, "n_bands_warmed_beyond_uncertainty_1975_latest");
  const north = bandLabel("arctic").toUpperCase();
  return {
    statement: "Warming is not spread evenly.",
    states: [
      ratio >= 2
        ? { title: "The far north", body: `${north} HAS WARMED ABOUT ${fixed(ratio, 1)} TIMES AS FAST AS THE GLOBE SINCE 1975.` }
        : { title: "The fastest-warming band", body: `${north}: ${arcticSlope === null ? "n/a" : signed(arcticSlope)} °C PER DECADE SINCE 1975.` },
      { title: "Land and sea", body: `${gap > 0 ? "LAND WARMS FASTER THAN THE OCEAN." : "LAND AND OCEAN, SIDE BY SIDE:"} IPCC AR6: LAND ${fixed(land, 2)} °C, OCEAN ${fixed(ocean, 2)} °C ABOVE 1850-1900 IN 2011-2020.` },
      { title: "The least-watched south", body: `THE FAR SOUTH WAS BARELY MEASURED UNTIL ${num(f, "south_band_first_year_valid_share_ge_50pct")}. LEAST KNOWN IS NOT LEAST WARMING.` },
      allUp
        ? { title: "Nowhere is cooling", body: "EVERY LATITUDE BAND HAS WARMED SINCE 1975." }
        : { title: "Not everywhere at once", body: `${nUp} OF 5 BANDS HAVE WARMED SINCE 1975 BEYOND THEIR UNCERTAINTY.` },
    ],
  };
}

export const copyS05 = {
  statement: "Choose your zero.",
  body: "DRAG THE CLAMP TO CHANGE WHAT COUNTS AS NORMAL. DRAG THE HANDLES TO MEASURE A TREND. WATCH WHAT MOVES AND WHAT DOESN'T.",
  breaks: "EXPLORATORY: THE BEST-FITTING BENDS IN THE LINE, NOT A TEST FOR ACCELERATION.",
  tooFew: "TOO FEW YEARS FOR A TREND (MIN 10)",
  disabled: "GISTEMP HAS NO 1850-1900 BASELINE",
};
export function trendLine(from: number, to: number, slope: number, ci: [number, number], naive: [number, number]) {
  return {
    result: `TREND ${from}-${to}: ${signed(slope)} °C PER DECADE · 95% CI ${fixed(ci[0], 2)} TO ${fixed(ci[1], 2)} (AR(1)-ADJUSTED)`,
    naive: `NAIVE OLS CI ${fixed(naive[0], 2)} TO ${fixed(naive[1], 2)}: TOO NARROW WHEN YEARS ARE AUTOCORRELATED`,
    spoken: `${from} to ${to}: ${fixed(slope, 2)} degrees C per decade, 95 percent interval ${fixed(ci[0], 2)} to ${fixed(ci[1], 2)}, autocorrelation-adjusted.`,
  };
}

export function copyS06(page: number) {
  return {
    statements: ["The first assessed window has already begun.", "After that, the choice of path matters.", "By 2081-2100, the paths are far apart."],
    chip: "IPCC AR6 ASSESSED RANGES, NOT OUR PROJECTION",
    callout: "One year above 1.5 °C is not a 20-year mean above it.",
    source: `IPCC AR6 WG1 SPM TABLE SPM.1 (PRINTED PAGE ${page}). VERY LIKELY RANGE = 90-100% PROBABILITY. RELATIVE TO 1850-1900.`,
    locked: "1850-1900 (LOCKED: AR6 BASELINE)",
    paris: "LEVELS NAMED IN THE PARIS AGREEMENT (20-YEAR MEANS)",
    parisShort: "DOTTED: 1.5 / 2.0 °C PARIS LEVELS",
    assessed: "ASSESSED · IPCC AR6 2001-2020",
    assessedShort: "ASSESSED · AR6",
    gap: "2061-2080 NOT IN TABLE SPM.1",
  };
}

export interface Exchange { q: string; a: string; tag: "OBSERVED" | "DERIVED"; receipt: string; simulated?: string }
export function copyS07(f: Facts, x: { lastModified: string | null; coverage: { naive: number; ar1: number; hac: number } | null }): Exchange[] {
  const ocean = fact<{ best_estimate: number; low: number; high: number }>(f, "ar6_published_ocean_2011_2020");
  const brk = fact<{ breaks: number[] }>(f, "changepoint_gistemp_selected_breaks").breaks;
  return [
    { q: "CITIES ARE HOTTER. ISN'T THIS JUST URBAN HEAT?", a: `THE OCEAN HAS NO CITIES AND IT WARMED TOO: ${fixed(ocean.best_estimate, 2)} °C (${fixed(ocean.low, 2)} TO ${fixed(ocean.high, 2)}) IN 2011-2020 VS 1850-1900, AS ASSESSED BY THE IPCC.`, tag: "OBSERVED", receipt: "ar6.json" },
    { q: "DO THE TWO AGENCIES EVEN AGREE?", a: `YEAR TO YEAR, CORRELATION ${fixed(num(f, "gistemp_hadcrut5_annual_corr"), 3)}, TYPICAL GAP ${fixed(num(f, "gistemp_hadcrut5_annual_rmsd"), 2)} °C. THEIR LONG-RUN TRENDS DIFFER BY ${fixed(Math.abs(num(f, "gistemp_hadcrut5_trend_gap_1880_latest")), 3)} °C PER DECADE. WE SHOW THE DISAGREEMENT, NOT AN AVERAGE.`, tag: "DERIVED", receipt: "agreement.json" },
    { q: "THE NUMBER WAS DIFFERENT LAST TIME I LOOKED.", a: `TWO REASONS. THE ZERO: EVERY ANOMALY IS RELATIVE TO A CHOSEN PERIOD, AND WE NAME IT EVERYWHERE. THE VINTAGE: AGENCIES REVISE PAST MONTHS. THIS SITE USES FILES DATED ${(x.lastModified ?? "n/a").toUpperCase()}.`, tag: "DERIVED", receipt: "meta.json" },
    { q: "WHAT ABOUT THE PLACES NOBODY MEASURED?", a: `${pct(num(f, "gistemp_missing_cells_total_share"))}% OF ALL SQUARE-MONTHS IN NASA'S GRID ARE MISSING. THEY STAY MISSING. AVERAGES USE MEASURED SQUARES ONLY, AND THE MEASURED SHARE IS ALWAYS SHOWN.`, tag: "DERIVED", receipt: "reconciliation.json" },
    { q: "IS IT SPEEDING UP?", a: `EXPLORATORY ONLY: THE BEST PIECEWISE FIT BENDS AT ${brk.join(", ")}. ROLLING 30-YEAR TRENDS ARE SHOWN WITH THEIR UNCERTAINTY. THIS IS NOT A FORMAL TEST FOR ACCELERATION.`, tag: "DERIVED", receipt: "changepoints.json" },
    { q: "CO2 AND TEMPERATURE RISE TOGETHER. ISN'T THAT PROOF?", a: `NO. TWO RISING LINES CORRELATE (${fixed(num(f, "co2_temperature_corr_levels"), 2)}) EVEN WITHOUT A LINK. YEAR-TO-YEAR CHANGES CORRELATE ${fixed(num(f, "co2_temperature_corr_first_differences"), 2)}. ASSOCIATION, NOT ATTRIBUTION. ATTRIBUTION COMES FROM PHYSICS, AS ASSESSED IN IPCC AR6.`, tag: "DERIVED", receipt: "co2.json" },
    { q: "HOW SURE IS THAT TREND?", a: `NEIGHBOURING YEARS ARE NOT INDEPENDENT, SO A NAIVE INTERVAL IS TOO NARROW: ±${fixed(num(f, "trend_gistemp_1975_latest_naive_ci_halfwidth"), 3)} NAIVE VERSUS ±${fixed(num(f, "trend_gistemp_1975_latest_ar1_ci_halfwidth"), 3)} ADJUSTED, °C PER DECADE.`, tag: "DERIVED", receipt: "trends.json",
      simulated: x.coverage ? `IN A SIMULATION WITH KNOWN ANSWERS, THE ADJUSTED INTERVAL COVERED THE TRUTH ${pct(x.coverage.ar1)}% OF THE TIME (NAIVE ${pct(x.coverage.naive)}%, HAC ${pct(x.coverage.hac)}%).` : undefined },
  ];
}

export function copyS08(f: Facts) {
  return {
    paragraph: "The planet doesn't speak in words. It speaks in small numbers, written every year, everywhere we look. Some of those numbers are missing. None of them are made up.",
    caption: `${num(f, "latest_complete_year")}: ${signed(num(f, "gistemp_latest_year_anomaly_1951_1980"))} °C ABOVE 1951-1980 · GISTEMP v4`,
    links: ["→ OPEN THE OBSERVATORY", "→ REPLAY THE INTRO", "→ READ THE METHODOLOGY", "→ SOURCE CODE"],
  };
}
export const footer = (generated: string) => `DATA: NASA GISS GISTEMP v4 · MET OFFICE HADCRUT5 5.2.0.0 (OPEN GOVERNMENT LICENCE v3) · NOAA GML CO2 · IPCC AR6 WG1 SPM TABLE SPM.1 · COASTLINES: NATURAL EARTH · GENERATED ${generated.slice(0, 10)} · RISHIT MATHUR`;

export const copyOBS = {
  title: "THE CLIMATE SIGNAL OBSERVATORY",
  line: "Any year, any place, any zero.",
  hint: "DRAG THE CORE TO MOVE THROUGH TIME. DRAG ACROSS IT TO PICK LATITUDES. DRAG THE GLOBE TO TURN IT. SELECT A SQUARE TO INSPECT IT.",
};
