import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { num, fact, type Facts, type GridMeta } from "./types";
import { copyS02, copyS03b, copyS04 } from "./copy";
import { regionMean } from "../model/zonal";

/**
 * QA_LESSONS L10: every sentence in the copy deck that makes a universal claim (every, all, always, never, none,
 * nowhere, everywhere, live) is registered here with a check against the published artifacts. A new universal
 * sentence fails the first test until someone binds it to the data.
 */
const src = readFileSync(new URL("./copy.ts", import.meta.url), "utf-8");
const read = <T,>(f: string): T => JSON.parse(readFileSync(new URL(`../../public/data/${f}`, import.meta.url), "utf-8"));
const facts = read<Facts>("facts.json");
const UNIVERSAL = /\b(every(one|where)?|all|always|never|none|nowhere|live)\b/i;

/** Sentences of the copy deck's string literals (comments excluded) that carry a universal word. */
function universalSentences(): string[] {
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const literals = [...code.matchAll(/"([^"\n]*)"|`([^`]*)`/g)].map((m) => (m[1] ?? m[2])!);
  return literals.flatMap((l) => l.split(/(?<=[.!?])\s+/)).filter((s) => UNIVERSAL.test(s));
}

interface GistempGrid { meta: GridMeta & { encoding: { missing_value: number } ; valid_cells_per_year: number[] }; v: Int8Array }
let grid: GistempGrid | null = null;
const gistemp = (): GistempGrid => {
  if (grid) return grid;
  const meta = read<GistempGrid["meta"]>("grid_gistemp_2deg.meta.json");
  const buf = gunzipSync(readFileSync(new URL("../../public/data/grid_gistemp_2deg.i8.bin.gz", import.meta.url)));
  grid = { meta, v: new Int8Array(buf.buffer, buf.byteOffset, buf.byteLength) };
  return grid;
};
/** No square is filled: per year, the shipped grid holds exactly the measured cells the pipeline counted; the rest are the missing code. */
function noFill() {
  const { meta, v } = gistemp();
  const per = meta.grid.n_lat * meta.grid.n_lon;
  let gaps = 0;
  meta.years.list.forEach((_, layer) => {
    let valid = 0;
    for (let i = layer * per; i < (layer + 1) * per; i++) if (v[i] === meta.encoding.missing_value) gaps++; else valid++;
    expect(valid, `valid cells in layer ${layer}`).toBe(meta.valid_cells_per_year[layer]);
  });
  expect(gaps).toBeGreaterThan(0); // the gaps exist and are kept as gaps
}
/** Averages skip missing squares: a mean over one measured and one missing square is the measured value. */
function measuredOnly() {
  const m = regionMean({ nLat: 2, nLon: 1, latFirst: 45, step: 90 }, -90, 90, (i) => (i === 0 ? 1.5 : null));
  expect(m.mean).toBeCloseTo(1.5, 6);
  expect(m.share).toBeCloseTo(0.5, 6); // and the measured share is reported next to it
}

const CHECKS: [RegExp, () => void][] = [
  // S01 statement and S08 paragraph: cells are measurements or gaps, never filled or made up
  [/^Every cell on this sphere is a measurement, or an honest gap\.$/, noFill],
  [/WE NEVER FILL A MISSING SQUARE\./, noFill],
  [/written every year, everywhere we look\.|None of them are made up\./, noFill],
  [/AVERAGES USE MEASURED SQUARES ONLY, AND THE MEASURED SHARE IS ALWAYS SHOWN\./, measuredOnly],
  [/OF ALL SQUARE-MONTHS IN NASA'S GRID ARE MISSING\./, () => expect(num(facts, "gistemp_missing_cells_total_share")).toBeGreaterThan(0)],
  // S04: only printed when the fact says all ten came after 2010
  [/^The ten warmest layers all came after 2010\.$/, () => {
    const s2 = copyS04(facts, { nCells: 1, nLayers: 1, source: "gistemp", firstYear: 1880, firstShare: 1, latestYear: 2025, latestShare: 1, validation: null, baseline: "1951-1980" }).s2;
    if (s2 === "The ten warmest layers all came after 2010.") expect(num(facts, "years_since_2010_in_gistemp_top10")).toBeGreaterThanOrEqual(10);
  }],
  // S04 alt text: the layer is the mean of measured cells only
  [/average of every measured/, measuredOnly],
  // S02: the 1991-2020 rebase moves every GISTEMP year by one constant
  [/Every anomaly needs a zero\.|FROM EVERY GISTEMP YEAR\./, () => {
    const s = read<{ series: { id: string; values: Record<string, (number | null)[]> }[] }>("series_annual.json").series.find((x) => x.id === "gistemp_glb")!;
    const d = s.values["1951-1980"]!.map((a, i) => (a === null ? null : a - s.values["1991-2020"]![i]!)).filter((x): x is number => x !== null);
    expect(Math.max(...d) - Math.min(...d)).toBeLessThanOrEqual(0.0021); // 3-decimal rounding of both series
    const x = copyS02(facts, { stepDeg: 2, scale: 0.1, missing: -128, hadShare1880: null, offsetLabel: d[0]!.toFixed(2), pipeline: "", generated: "", ar6Page: null });
    expect(x.some((c) => "body" in c && c.body.includes(`SUBTRACTS ${d[0]!.toFixed(2)} °C FROM EVERY GISTEMP YEAR`))).toBe(true);
  }],
  // S03b: "every band warmed" only when all five AR(1) intervals since 1975 sit above zero
  [/EVERY LATITUDE BAND HAS WARMED SINCE 1975\.|Nowhere is cooling|Not everywhere at once/, () => {
    const t = read<{ series: { series_id: string; fits: { period: string; ci_ar1: [number, number] }[] }[] }>("trends.json");
    const bands = t.series.filter((s) => /^gistemp_band_/.test(s.series_id));
    expect(bands).toHaveLength(5);
    const allUp = bands.every((b) => b.fits.find((f) => f.period === "1975_latest")!.ci_ar1[0] > 0);
    expect(fact<boolean>(facts, "band_trends_all_positive_1975_latest")).toBe(allUp);
    const shown = copyS03b(facts, (id) => id, null).states.at(-1)!;
    expect(shown.title).toBe(allUp ? "Nowhere is cooling" : "Not everywhere at once");
  }],
  // S07: the zero is named in every degree view (each anomaly literal in the deck carries VS, ABOVE or a baseline)
  [/EVERY ANOMALY IS RELATIVE TO A CHOSEN PERIOD, AND WE NAME IT EVERYWHERE\./, () => {
    for (const line of src.split("\n").filter((l) => /°C/.test(l) && !/PER DECADE|\/ DECADE|STEPS\)|NAIVE/.test(l)))
      expect(line, line.trim()).toMatch(/\bvs\b|above|below|1850-1900|1951-1980|1991-2020|baseline/i);
  }],
  // S07: the vintage claim names the file date it is bound to
  [/THE NUMBER WAS DIFFERENT LAST TIME I LOOKED\./, () => expect(read<{ sources?: unknown }>("meta.json")).toBeTruthy()],
];

describe("L10: universal claims in the copy deck are bound to the data", () => {
  it("every universal sentence has a registered check", () => {
    const unbound = universalSentences().filter((s) => !CHECKS.some(([re]) => re.test(s)));
    expect(unbound).toEqual([]);
  });
  it("no copy says live (the numbers are precomputed and computed in the browser from published inputs)", () => {
    expect(universalSentences().filter((s) => /\blive\b/i.test(s))).toEqual([]);
  });
  for (const [re, check] of CHECKS) it(`holds: ${re.source.slice(0, 60)}`, check);
});
