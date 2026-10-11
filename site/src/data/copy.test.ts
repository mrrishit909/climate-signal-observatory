import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { copyOBS, copyS00, copyS01, copyS02, copyS03a, copyS03b, copyS04, copyS05, copyS06, copyS07, copyS08, footer, trendLine, yearReadout } from "./copy";
import { fixed, int, pct, signed } from "../model/format";
import { num, type Facts, type GridMeta, type Validation } from "./types";
import { EDGE_LABELS } from "../model/bins";

const read = <T,>(f: string): T => JSON.parse(readFileSync(new URL(`../../public/data/${f}`, import.meta.url), "utf-8"));
const facts = read<Facts>("facts.json");
const gm = read<GridMeta>("grid_gistemp_2deg.meta.json");
const hm = read<GridMeta>("grid_hadcrut5_5deg.meta.json");
const validation = read<Validation>("validation.json");
/** Every number printed in a string, as written. */
const numbers = (s: string) => (s.match(/\d[\d,]*(\.\d+)?/g) ?? []).map((n) => n.replace(/,$/, ""));

const s04 = (src: "gistemp" | "hadcrut5") => {
  const m = src === "gistemp" ? gm : hm;
  return copyS04(facts, {
    nCells: m.grid.n_lat * m.grid.n_lon, nLayers: 176, source: src, firstYear: m.years.first, firstShare: m.valid_area_share_per_year[0]!,
    latestYear: m.years.last, latestShare: m.valid_area_share_per_year.at(-1)!, validation, baseline: "1951-1980",
  });
};

describe("copy deck numbers are artifact values (VISUAL_DESIGN 5, 6)", () => {
  const allowed = new Set<string>([
    // bound values
    String(num(facts, "latest_complete_year")), String(gm.years.first), String(hm.years.first),
    int(gm.grid.n_lat * gm.grid.n_lon), int(hm.grid.n_lat * hm.grid.n_lon), "176",
    pct(gm.valid_area_share_per_year[0]!), pct(gm.valid_area_share_per_year.at(-1)!), pct(hm.valid_area_share_per_year[0]!), pct(hm.valid_area_share_per_year.at(-1)!),
    fixed(validation.grid_vs_official_global.gistemp.max_abs_diff, 3), fixed(validation.grid_vs_official_global.hadcrut5.max_abs_diff, 3),
    // design literals, not data: baseline names, grid resolutions (meta.grid.lat_step_deg), product version v4,
    // the copy-deck year 2010, the 95th percentile, the "1-5" phase caption ordinals and the bin-edge legend
    "1850", "1900", "1951", "1980", "1991", "2020", "1961", "1990", String(gm.grid.lat_step_deg), String(hm.grid.lat_step_deg), "4", "2010", "95",
    "1", "3", ...EDGE_LABELS.map((e) => e.replace(/^[+-]/, "")),
  ]);
  const texts = [
    ...Object.values(copyS00(facts)), ...Object.values(copyS03a),
    ...(["gistemp", "hadcrut5"] as const).flatMap((s) => { const c = s04(s); return [c.s1, c.s2, c.footnote, c.coverage, c.begins, c.loading, c.alt, ...c.captions]; }),
  ];
  it("contains no number that is not bound to a named field", () => {
    for (const t of texts) for (const n of numbers(t)) expect(allowed, `"${n}" in "${t}"`).toContain(n);
  });
  it("renders the bound values exactly", () => {
    const c = s04("gistemp");
    expect(c.captions[0]).toBe(`1 · ${int(16200)} SQUARES`);
    expect(c.coverage).toBe(`MEASURED AREA ${pct(num(facts, "gistemp_valid_area_share_first_year"))}% IN 1880 → ${pct(num(facts, "gistemp_valid_area_share_latest_year"))}% IN ${num(facts, "latest_complete_year")}`);
    expect(c.footnote).toContain(fixed(validation.grid_vs_official_global.gistemp.max_abs_diff, 3));
  });
  it("(CHECK) the S04 spine statement follows years_since_2010_in_gistemp_top10", () => {
    const at = (n: number) => copyS04({ ...facts, facts: { ...facts.facts, years_since_2010_in_gistemp_top10: { ...facts.facts.years_since_2010_in_gistemp_top10!, value: n } } }, { nCells: 1, nLayers: 1, source: "gistemp", firstYear: 1880, firstShare: 1, latestYear: 2025, latestShare: 1, validation: null, baseline: "1951-1980" }).s2;
    expect(at(10)).toBe("The ten warmest layers all came after 2010.");
    expect(at(7)).toBe("7 of the ten warmest layers came after 2010.");
    expect(at(3)).toBe("The warmest layers are on top.");
    expect(s04("gistemp").s2).toBe(at(num(facts, "years_since_2010_in_gistemp_top10")));
  });
  it("S03a readout prints the facts' latest values with sign and baseline", () => {
    const r = (g: number, b: "1951-1980" | "1991-2020") => yearReadout({ year: 2025, source: "gistemp", baseline: b, global: g, rank: { rank: 2, of: 146 }, co2: null, co2First: 1958, measured: 0.9922, extremes: null, lostMost: false });
    expect(r(num(facts, "gistemp_latest_year_anomaly_1951_1980"), "1951-1980").global).toBe(`GLOBAL ${signed(num(facts, "gistemp_latest_year_anomaly_1951_1980"))} °C VS 1951-1980`);
    expect(r(num(facts, "gistemp_latest_year_anomaly_1991_2020"), "1991-2020").global).toBe("GLOBAL +0.57 °C VS 1991-2020");
    expect(r(1, "1951-1980").measured).toBe("MEASURED AREA 99%");
  });
});

describe("site source hygiene", () => {
  const files: string[] = [];
  const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.(tsx?|css|html)$/.test(f)) files.push(p); } };
  walk(new URL("..", import.meta.url).pathname);
  files.push(new URL("../../index.html", import.meta.url).pathname);
  // built from code points so this file never contains the characters it bans
  const banned = new RegExp(`[${String.fromCharCode(0x2014)}${String.fromCharCode(0x2015)}]`);
  const arctic = new RegExp(["arctic", "circle"].join(" "), "i");
  it("has no U+2014 or U+2015 dash anywhere", () => {
    for (const f of files) expect(banned.test(readFileSync(f, "utf-8")), f).toBe(false);
  });
  it("never names the polar circle: the band is 60-90N (ENGINEERING_DECISIONS #20)", () => {
    for (const f of files) expect(arctic.test(readFileSync(f, "utf-8")), f).toBe(false);
  });
});

describe("Stage B copy numbers are artifact values", () => {
  const f = facts;
  const v = read<{ trend_ci_simulation: { coverage_naive: number; coverage_ar1: number; coverage_hac: number } }>("validation.json").trend_ci_simulation;
  const ar6 = read<{ source: { page_printed: number } }>("ar6.json");
  const meta = read<{ generated_at: string; pipeline_version: string; sources: Record<string, { last_modified?: string }> }>("meta.json");
  const lm = Object.entries(meta.sources).find(([k]) => k.startsWith("gistemp"))![1].last_modified!;
  const fv = (k: string) => (facts.facts[k]!.value as { best_estimate: number; low: number; high: number });
  const allowed = new Set<string>([
    // bound values
    String(num(f, "latest_complete_year")), signed(num(f, "gistemp_latest_year_anomaly_1951_1980")).slice(1), fixed(num(f, "co2_mlo_latest_ppm"), 2),
    ...String(facts.facts.co2_mlo_latest_month!.value).split("-"), pct(num(f, "gistemp_valid_area_share_first_year")), pct(hm.valid_area_share_per_year[hm.years.list.indexOf(1880)]!),
    fixed(num(f, "baseline_offset_1951_1980_to_1991_2020_gistemp"), 2), String(gm.grid.lat_step_deg), meta.pipeline_version, ...meta.generated_at.slice(0, 10).split("-"),
    String(ar6.source.page_printed), fixed(num(f, "arctic_to_global_trend_ratio_1975_latest"), 1), fixed(fv("ar6_published_land_2011_2020").best_estimate, 2),
    ...["best_estimate", "low", "high"].map((k) => fixed(fv("ar6_published_ocean_2011_2020")[k as "low"], 2)), String(num(f, "south_band_first_year_valid_share_ge_50pct")),
    fixed(num(f, "gistemp_hadcrut5_annual_corr"), 3), fixed(num(f, "gistemp_hadcrut5_annual_rmsd"), 2), fixed(Math.abs(num(f, "gistemp_hadcrut5_trend_gap_1880_latest")), 3),
    pct(num(f, "gistemp_missing_cells_total_share")), ...(facts.facts.changepoint_gistemp_selected_breaks!.value as { breaks: number[] }).breaks.map(String),
    fixed(num(f, "co2_temperature_corr_levels"), 2), fixed(num(f, "co2_temperature_corr_first_differences"), 2),
    fixed(num(f, "trend_gistemp_1975_latest_naive_ci_halfwidth"), 3), fixed(num(f, "trend_gistemp_1975_latest_ar1_ci_halfwidth"), 3),
    ...meta.pipeline_version.match(/\d[\d,]*(\.\d+)?/g)!, pct(v.coverage_ar1), pct(v.coverage_naive), pct(v.coverage_hac), ...(lm.match(/\d+(:\d+)*/g) ?? []), ...lm.split(/[ :]/),
    "0.1", "128", // grid sidecar encoding: scale_degC_per_unit and missing_value
    // design literals: baseline names, AR6 table periods, the very likely 90-100% definition, Paris levels, product versions, the 1200 km GISTEMP smoothing radius
    "1850", "1900", "1951", "1980", "1991", "2020", "1975", "1880", "2011", "2021", "2040", "2041", "2060", "2061", "2080", "2081", "2100", "90", "100", "1.5", "2", "1200", "4",
    "5.2", "0.0", "20", "3", "1", "5", "10", "95", "30", "15", "6", "12", "2010", "04", "03", "02", "01",
  ]);
  const texts = [
    ...Object.values(copyS01(f)),
    ...copyS02(f, { stepDeg: gm.grid.lat_step_deg, scale: 0.1, missing: -128, hadShare1880: hm.valid_area_share_per_year[hm.years.list.indexOf(1880)]!, offsetLabel: fixed(num(f, "baseline_offset_1951_1980_to_1991_2020_gistemp"), 2), pipeline: meta.pipeline_version, generated: meta.generated_at, ar6Page: ar6.source.page_printed })
      .flatMap((c) => Object.values(c).flat().map(String)),
    copyS03b(f, () => "NORTHERN HIGH LATITUDES, 60N TO 90N", 0.5).statement, ...copyS03b(f, () => "NORTHERN HIGH LATITUDES, 60N TO 90N", null).states.flatMap((x) => [x.title, x.body]),
    ...Object.values(copyS05), ...Object.values(copyS06(ar6.source.page_printed)).flat(),
    ...copyS07(f, { lastModified: lm, coverage: { naive: v.coverage_naive, ar1: v.coverage_ar1, hac: v.coverage_hac } }).flatMap((e) => [e.q, e.a, e.simulated ?? ""]),
    ...Object.values(copyS08(f)).flat(), footer(meta.generated_at), ...Object.values(copyOBS),
  ];
  it("contains no unbound number", () => {
    for (const t of texts) for (const n of numbers(t.replace(/60N TO 90N/g, ""))) expect(allowed, `"${n}" in "${t}"`).toContain(n);
  });
  it("(CHECK) S03b claims follow their checks", () => {
    const set = (k: string, value: unknown) => ({ ...facts, facts: { ...facts.facts, [k]: { ...facts.facts[k]!, value } } });
    expect(copyS03b(set("arctic_to_global_trend_ratio_1975_latest", 1.5), () => "X", 0.3).states[0]!.title).toBe("The fastest-warming band");
    expect(copyS03b(set("band_trends_all_positive_1975_latest", false), () => "X", 0.3).states[3]!.title).toBe("Not everywhere at once");
    expect(copyS03b(facts, () => "X", 0.3).states[0]!.title).toBe("The far north");
  });
  it("the S05 result line prints the fit with its sign and AR(1) CI", () => {
    expect(trendLine(1975, 2025, 0.2067, [0.1771, 0.2363], [0.1865, 0.2269]).result).toBe("TREND 1975-2025: +0.21 °C PER DECADE · 95% CI 0.18 TO 0.24 (AR(1)-ADJUSTED)");
  });
});
