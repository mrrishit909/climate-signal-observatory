import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { geoEqualEarth, geoOrthographic } from "d3-geo";
import { BINS, binIndex, cellValue100 } from "./bins";
import { areaShares, collapseSlots, coreTexture, MISSING_F, zonalLayer, type GridGeom } from "./zonal";
import { RANK_BASELINE, rankOf } from "./rank";
import { fixed, pct, signed } from "./format";
import { EE_XMAX, equalEarthRaw, faceQuat, quatMat3, slerp, unwrapVertex, type Unwrap } from "../gl/projection";
import { decodeGrid, gunzipIfNeeded } from "../data/grid";
import type { Baseline, Facts, GridMeta, SeriesAnnual } from "../data/types";
import { num } from "../data/types";

const data = (f: string) => new URL(`../../public/data/${f}`, import.meta.url);
const json = <T,>(f: string): T => JSON.parse(readFileSync(data(f), "utf-8"));
const gz = (f: string) => new Uint8Array(readFileSync(data(f)));
const geom = (m: GridMeta): GridGeom => ({ nLat: m.grid.n_lat, nLon: m.grid.n_lon, latFirst: m.grid.lat_first_center, step: m.grid.lat_step_deg });

describe("anomaly bins (edges inclusive away from zero, integer hundredths)", () => {
  it("places every edge on the side away from zero", () => {
    const cases: [number, string][] = [[-301, "C5"], [-300, "C5"], [-299, "C4"], [-200, "C4"], [-100, "C3"], [-50, "C2"], [-20, "C1"], [-19, "N"],
      [0, "N"], [19, "N"], [20, "W1"], [49, "W1"], [50, "W2"], [100, "W3"], [200, "W4"], [299, "W4"], [300, "W5"]];
    for (const [v, id] of cases) expect(BINS[binIndex(v)]!.id, String(v)).toBe(id);
  });
  it("decodes byte 0.1 C minus offset 0.01 C; -128 or a null offset is missing", () => {
    expect(cellValue100(12, 5)).toBe(115);
    expect(cellValue100(-128, 0)).toBeNull();
    expect(cellValue100(3, null)).toBeNull();
  });
});

describe("grid decode", async () => {
  const meta = json<GridMeta>("grid_gistemp_2deg_intro.meta.json");
  const file = gz("grid_gistemp_2deg_intro.i8.bin.gz");
  it("the shipped file is pre-compressed (1f 8b magic)", () => expect([file[0], file[1]]).toEqual([0x1f, 0x8b]));
  it("gunzips and verifies sha256 against the sidecar", async () => {
    const g = await decodeGrid(file, meta);
    expect(g.length).toBe(16 * 90 * 180);
  });
  it("accepts bytes a server already inflated (no magic) unchanged", async () => {
    const raw = await gunzipIfNeeded(file);
    expect(await gunzipIfNeeded(raw)).toBe(raw);
    expect((await decodeGrid(raw, meta)).length).toBe(raw.length);
  });
  it("rejects a corrupted grid as CHECKSUM", async () => {
    const raw = new Uint8Array(await gunzipIfNeeded(file));
    raw[1000] = raw[1000]! ^ 1;
    await expect(decodeGrid(new Uint8Array(gzipSync(raw)), meta)).rejects.toThrow("CHECKSUM");
  });
});

describe("zonal reduction matches the DR-4 fixture to 1e-6", async () => {
  const fx = json<{ tolerance: number; years: number[]; sources: Record<string, { baselines: Record<string, { available: boolean; years: Record<string, { global_mean: number; row_mean: (number | null)[]; row_valid_share: number[] }> }> }> }>("zonal_fixture.json");
  const grids = {
    gistemp: { meta: json<GridMeta>("grid_gistemp_2deg.meta.json"), file: "grid_gistemp_2deg.i8.bin.gz" },
    hadcrut5: { meta: json<GridMeta>("grid_hadcrut5_5deg.meta.json"), file: "grid_hadcrut5_5deg.i8.bin.gz" },
  };
  for (const [src, g] of Object.entries(grids)) {
    const grid = await decodeGrid(gz(g.file), g.meta);
    for (const [base, b] of Object.entries(fx.sources[src]!.baselines)) {
      if (!b.available) {
        it(`${src} has no ${base} offsets`, () => expect(g.meta.baseline_offsets[base as Baseline]).toBeUndefined());
        continue;
      }
      for (const [year, want] of Object.entries(b.years)) {
        it(`${src} ${base} ${year}`, () => {
          const layer = g.meta.years.list.indexOf(Number(year));
          const z = zonalLayer(grid, layer, geom(g.meta), g.meta.baseline_offsets[base as Baseline]!.values);
          expect(z.globalMean!).toBeCloseTo(want.global_mean, 6);
          want.row_mean.forEach((m, r) => {
            if (m === null) expect(z.rowMean[r], `row ${r}`).toBeNull();
            else expect(Math.abs(z.rowMean[r]! - m), `row ${r}`).toBeLessThanOrEqual(fx.tolerance);
          });
          want.row_valid_share.forEach((s, r) => expect(Math.abs(z.rowValid[r]! - s)).toBeLessThanOrEqual(fx.tolerance));
        });
      }
    }
  }
  it("core texture: one row per year of the shared axis, global mean in the last column, pre-1880 GISTEMP missing", () => {
    const m = grids.gistemp.meta;
    const axis = Array.from({ length: 176 }, (_, i) => 1850 + i);
    const t = coreTexture(grid0, geom(m), m.years.list, m.baseline_offsets["1951-1980"]!.values, axis);
    expect(t[0]).toBe(MISSING_F);
    const fx2025 = fx.sources.gistemp!.baselines["1951-1980"]!.years["2025"]!;
    expect(t[175 * 91 + 90]! / 100).toBeCloseTo(fx2025.global_mean, 4);
  });
  const grid0 = await decodeGrid(gz(grids.gistemp.file), grids.gistemp.meta);
  it("measured area share equals the sidecar's valid_area_share_per_year", () => {
    const m = grids.gistemp.meta;
    for (const layer of [0, 60, m.years.list.length - 1]) {
      const a = areaShares(grid0, layer, geom(m), m.baseline_offsets["1951-1980"]!.values);
      expect(a.measured).toBeCloseTo(m.valid_area_share_per_year[layer]!, 3);
      expect(a.referenced).toBeLessThanOrEqual(a.measured + 1e-12);
    }
  });
  it("collapse slots: valid cells merge across the whole strip; missing cells have zero width", () => {
    const m = grids.gistemp.meta, off = m.baseline_offsets["1951-1980"]!.values;
    const s = collapseSlots(grid0, 0, geom(m), off);
    for (let i = 0; i < 16200; i++) {
      const valid = grid0[i] !== -128 && off[i] !== null;
      if (valid) expect([s[i * 2], s[i * 2 + 1]]).toEqual([0, 1]);
      else expect(s[i * 2]).toBe(s[i * 2 + 1]);
    }
  });
});

describe("rank (S03a readout)", () => {
  const sa = json<SeriesAnnual>("series_annual.json");
  const facts = json<Facts>("facts.json");
  const g = sa.series.find((s) => s.id === "gistemp_glb")!;
  const h = sa.series.find((s) => s.id === "hadcrut5_glb")!;
  it("never changes with the baseline (a constant shift), except where 3-decimal rounding makes a tie", () => {
    for (const [s, other] of [[g, "1991-2020"], [h, "1850-1900"], [h, "1991-2020"]] as const) {
      const ref = s.values[RANK_BASELINE]!, alt = s.values[other]!;
      for (let i = 0; i < sa.years.length; i++) {
        const a = rankOf(alt, i), b = rankOf(ref, i);
        if (a?.rank === b?.rank) continue;
        const near = ref.some((v, j) => j !== i && v !== null && Math.abs(v - ref[i]!) <= 0.0015);
        expect(near, `${s.id} ${sa.years[i]} rank ${a?.rank} vs ${b?.rank}`).toBe(true);
      }
    }
  });
  it("latest year rank equals facts.latest_year_rank_*", () => {
    const last = sa.years.length - 1;
    const fg = facts.facts.latest_year_rank_gistemp!.value as { rank: number; of: number };
    const fh = facts.facts.latest_year_rank_hadcrut5!.value as { rank: number; of: number };
    expect(rankOf(g.values[RANK_BASELINE]!, last)).toEqual({ rank: fg.rank, of: fg.of });
    expect(rankOf(h.values[RANK_BASELINE]!, last)).toEqual({ rank: fh.rank, of: fh.of });
  });
  it("readout global values equal the facts for both GISTEMP baselines", () => {
    const last = sa.years.length - 1;
    expect(g.values["1951-1980"]![last]).toBe(num(facts, "gistemp_latest_year_anomaly_1951_1980"));
    expect(g.values["1991-2020"]![last]).toBe(num(facts, "gistemp_latest_year_anomaly_1991_2020"));
  });
});

describe("formatter (one place numbers become copy)", () => {
  it("rounds half-up through binary floats and always signs", () => {
    expect(fixed(1.185)).toBe("1.19");
    expect(signed(1.185)).toBe("+1.19");
    expect(signed(-0.004)).toBe("+0.00");
    expect(signed(-0.25, 1)).toBe("-0.3");
    expect(pct(0.8265)).toBe("83");
    expect(pct(0.9922)).toBe("99");
  });
});

describe("projection parity with d3-geo (1e-6)", () => {
  const pts: [number, number][] = [[0, 0], [-73.9, 40.7], [151.2, -33.9], [-30, 15], [179, 89], [-179, -89], [20, 72]];
  it("Equal Earth raw equals d3.geoEqualEarth at any scale", () => {
    const k = 1080 / (2 * EE_XMAX), p = geoEqualEarth().scale(k).translate([720, 430]);
    for (const [lon, lat] of pts) {
      const [x, y] = equalEarthRaw((lon * Math.PI) / 180, (lat * Math.PI) / 180);
      const [dx, dy] = p([lon, lat])!;
      expect(720 + k * x).toBeCloseTo(dx, 6);
      expect(430 - k * y).toBeCloseTo(dy, 6);
    }
  });
  it("orthographic via faceQuat equals d3.geoOrthographic().rotate([-lon0, -lat0]) on the visible hemisphere", () => {
    for (const [lon0, lat0] of [[0, 0], [-30, 15], [20, 72], [140, -62], [-150, 0]] as [number, number][]) {
      // projection units (scale 1): the Float32 rotation matrix is the shader's precision
      const u: Unwrap = { rot: quatMat3(faceQuat(lon0, lat0)), sphere: [0, 0, 1], sheet: [0, 0, 1], s1: 0, s2: 0, s3: 0, strip: [0, 1], core: [0, 1, 0, 1] };
      const d = geoOrthographic().scale(1).translate([0, 0]).rotate([-lon0, -lat0]).clipAngle(90);
      for (const [lon, lat] of pts) {
        const [x, y, z] = unwrapVertex(lon, lat, 0, u);
        if (z <= 0.01) continue;
        const [dx, dy] = d([lon, lat])!;
        expect(x).toBeCloseTo(dx, 6);
        expect(y).toBeCloseTo(dy, 6);
      }
      // the face centre lands on the disc centre, nearest the viewer
      const c = unwrapVertex(lon0, lat0, 0, u);
      expect(c[0]).toBeCloseTo(0, 6); expect(c[1]).toBeCloseTo(0, 6); expect(c[2]).toBeCloseTo(1, 6);
    }
  });
  it("s1 = 1 is exactly the Equal Earth sheet (unwrap end state)", () => {
    const k = 1080 / (2 * EE_XMAX), p = geoEqualEarth().scale(k).translate([720, 430]);
    const u: Unwrap = { rot: quatMat3(faceQuat(0, 0)), sphere: [720, 450, 290], sheet: [720, 430, k], s1: 1, s2: 0, s3: 0, strip: [0, 1], core: [0, 1, 0, 1] };
    for (const [lon, lat] of pts) {
      const [x, y] = unwrapVertex(lon, lat, 0, u);
      const [dx, dy] = p([lon, lat])!;
      expect(Math.abs(x - dx)).toBeLessThan(1e-6);
      expect(Math.abs(y - dy)).toBeLessThan(1e-6);
    }
  });
  it("s3 = 1 lands every corner on the sine-spaced stratum slot (north to the right)", () => {
    const u: Unwrap = { rot: quatMat3(faceQuat(0, 0)), sphere: [720, 450, 290], sheet: [720, 430, 100], s1: 1, s2: 1, s3: 1, strip: [400, 24], core: [610, 830, 100, 4] };
    for (const lat of [-90, -30, 0, 45, 90]) for (const slot of [0, 1]) {
      const [x, y] = unwrapVertex(10, lat, slot, u);
      expect(x).toBeCloseTo(720 + 110 * Math.sin((lat * Math.PI) / 180), 6);
      expect(y).toBeCloseTo(slot === 0 ? 98 : 102, 6);
    }
  });
  it("slerp takes the shortest arc and hits both ends", () => {
    const a = faceQuat(20, 72), b = faceQuat(-150, 0);
    expect(quatMat3(slerp(a, b, 0))[8]).toBeCloseTo(quatMat3(a)[8]!, 6);
    expect(quatMat3(slerp(a, b, 1))[0]).toBeCloseTo(quatMat3(b)[0]!, 6);
  });
});
