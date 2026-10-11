import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { copyS00, copyS03a, copyS04, yearReadout } from "./copy";
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
