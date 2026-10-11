import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { anomalyAt, regionMean, shareAtLeast, type GridGeom } from "./zonal";
import { futuresModel } from "./futures";
import { decodeGrid } from "../data/grid";
import { equalEarthRaw, faceQuat, invertEqualEarth, invertOrtho, quatMat3, unwrapVertex } from "../gl/projection";
import type { Ar6, GridMeta, Regional, SeriesAnnual } from "../data/types";

const data = (f: string) => new URL(`../../public/data/${f}`, import.meta.url);
const json = <T,>(f: string): T => JSON.parse(readFileSync(data(f), "utf-8"));
const geom = (m: GridMeta): GridGeom => ({ nLat: m.grid.n_lat, nLon: m.grid.n_lon, latFirst: m.grid.lat_first_center, step: m.grid.lat_step_deg });

describe("OBS region readout = area-weighted mean of the cells rendered as valid", async () => {
  const reg = json<Regional>("regional.json");
  for (const [src, file] of [["gistemp", "grid_gistemp_2deg"], ["hadcrut5", "grid_hadcrut5_5deg"]] as const) {
    const m = json<GridMeta>(`${file}.meta.json`);
    const grid = await decodeGrid(new Uint8Array(readFileSync(data(`${file}.i8.bin.gz`))), m);
    it(`${src}: every band x year x baseline matches regional.json (40% coverage rule)`, () => {
      let checked = 0;
      for (const row of reg.rows.filter((r) => r.source === src)) {
        const band = reg.bands.find((b) => b.id === row.band)!;
        for (const [base, vals] of Object.entries(row.values)) {
          const off = m.baseline_offsets[base as "1951-1980"]?.values;
          if (!off) continue;
          for (const year of [1900, 1950, 1998, 2025]) {
            const layer = m.years.list.indexOf(year), yi = reg.years.indexOf(year);
            if (layer < 0) continue;
            const r = regionMean(geom(m), band.lat_min, band.lat_max, anomalyAt(grid, layer, geom(m), off));
            const want = vals![yi];
            if (want === null || want === undefined) { expect(r.mean === null || r.share < reg.min_valid_area_share + 0.01).toBe(true); continue; }
            // regional.json is computed from unquantized cell means; the shipped grid is 0.1 C Int8 (max 0.05 C per cell)
            expect(Math.abs(r.mean! - want), `${row.band} ${base} ${year}`).toBeLessThan(0.01);
            checked++;
          }
        }
      }
      expect(checked).toBeGreaterThan(20);
    });
  }
  it("+2 C share under 1951-1980 matches extremes.json gistemp_ge_2C", async () => {
    const m = json<GridMeta>("grid_gistemp_2deg.meta.json");
    const grid = await decodeGrid(new Uint8Array(readFileSync(data("grid_gistemp_2deg.i8.bin.gz"))), m);
    const ex = json<{ years: number[]; metrics: { id: string; area_share: (number | null)[] }[] }>("extremes.json");
    const metric = ex.metrics.find((x) => x.id === "gistemp_ge_2C_1951-1980")!;
    for (const year of [1950, 2016, 2025]) {
      const s = shareAtLeast(grid, m.years.list.indexOf(year), geom(m), m.baseline_offsets["1951-1980"]!.values)!;
      expect(Math.abs(s - metric.area_share[ex.years.indexOf(year)]!), String(year)).toBeLessThan(0.01);
    }
  });
});

describe("inverse projections (inspector picking)", () => {
  it("orthographic round trip on the visible hemisphere", () => {
    const rot = quatMat3(faceQuat(-30, 15));
    const u = { rot, sphere: [560, 470, 340] as [number, number, number], sheet: [0, 0, 1] as [number, number, number], s1: 0, s2: 0, s3: 0, strip: [0, 1] as [number, number], core: [0, 1, 0, 1] as [number, number, number, number] };
    for (const [lon, lat] of [[-30, 15], [0, 0], [-60, 50], [10, -40]]) {
      const [x, y] = unwrapVertex(lon!, lat!, 0, u);
      const back = invertOrtho(x, y, rot, u.sphere)!;
      expect(back[0]).toBeCloseTo(lon!, 4); expect(back[1]).toBeCloseTo(lat!, 4);
    }
    expect(invertOrtho(0, 0, rot, u.sphere)).toBeNull();
  });
  it("Equal Earth round trip", () => {
    for (const [lon, lat] of [[0, 0], [120, 60], [-170, -80], [45, -10]]) {
      const [x, y] = equalEarthRaw((lon! * Math.PI) / 180, (lat! * Math.PI) / 180);
      const b = invertEqualEarth(x, y)!;
      expect(b[0]).toBeCloseTo(lon!, 6); expect(b[1]).toBeCloseTo(lat!, 6);
    }
  });
});

describe("S06 futures model (honesty)", () => {
  const ar6 = json<Ar6>("ar6.json");
  const sa = json<SeriesAnnual>("series_annual.json");
  const h = sa.series.find((s) => s.id === "hadcrut5_glb")!;
  const f = futuresModel(ar6, sa.years, h.values["1850-1900"]!);
  it("every bracket equals ar6.json exactly (5 scenarios x 3 windows)", () => {
    expect(f.brackets).toHaveLength(15);
    for (const s of ar6.scenarios) for (const r of s.rows) {
      const b = f.brackets.find((x) => x.scenario === s.id && x.period === r.period)!;
      expect([b.low, b.best, b.high]).toEqual([r.very_likely_low_c, r.best_estimate_c, r.very_likely_high_c]);
    }
  });
  it("observed marks stop at the latest complete year; no bracket starts before 2021; nothing joins them", () => {
    expect(Math.max(...f.observed.map((o) => o.year))).toBe(sa.years.at(-1));
    expect(Math.min(...f.brackets.map((b) => b.y0))).toBeGreaterThanOrEqual(2021);
    expect(Object.keys(f).sort()).toEqual(["assessed", "brackets", "means", "observed"]);
  });
});
