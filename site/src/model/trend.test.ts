import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { olsTrend, tQuantile } from "./trend";
import type { SeriesAnnual } from "../data/types";

const read = <T,>(f: string): T => JSON.parse(readFileSync(new URL(`../../public/data/${f}`, import.meta.url), "utf-8"));
const sa = read<SeriesAnnual>("series_annual.json");
type Fit = { period: string; start: number; end: number; slope_per_decade: number; ci_ar1: [number, number]; ci_naive: [number, number]; ci_hac: [number, number]; n: number; n_eff: number; lag1_autocorr_resid: number };
const trends = read<{ series: { series_id: string; fits: Fit[] }[] }>("trends.json");

describe("t quantile", () => {
  it("matches scipy at integer and fractional df", () => {
    expect(tQuantile(0.975, 10)).toBeCloseTo(2.228138851986, 9);
    expect(tQuantile(0.975, 144)).toBeCloseTo(1.9765750658304433, 9);
    expect(tQuantile(0.975, 2.5)).toBeCloseTo(3.574654842003682, 9);
  });
});

describe("client trend parity with trends.json (global and hemispheric series)", () => {
  // trends.json publishes 4 decimals, so parity is to half that rounding unit plus the 3-decimal input rounding
  const tol = 6e-4;
  for (const s of trends.series.filter((x) => sa.series.some((y) => y.id === x.series_id))) {
    for (const f of s.fits) it(`${s.series_id} ${f.period}`, () => {
      const ser = sa.series.find((y) => y.id === s.series_id)!;
      const base = ser.values["1951-1980"] ? "1951-1980" : "1850-1900";
      const idx = sa.years.map((y, i) => [y, i] as const).filter(([y]) => y >= f.start && y <= f.end);
      const fit = olsTrend(idx.map(([y]) => y), idx.map(([, i]) => ser.values[base as "1951-1980"]![i]!))!;
      expect(fit.n).toBe(f.n);
      expect(Math.abs(fit.slope - f.slope_per_decade)).toBeLessThan(tol);
      for (const k of [0, 1]) {
        expect(Math.abs(fit.ciAr1[k]! - f.ci_ar1[k]!)).toBeLessThan(tol);
        expect(Math.abs(fit.ciNaive[k]! - f.ci_naive[k]!)).toBeLessThan(tol);
        expect(Math.abs(fit.ciHac[k]! - f.ci_hac[k]!)).toBeLessThan(tol);
      }
    });
  }
  it("the slope does not change with the baseline (a constant shift); the CI does not either", () => {
    const g = sa.series.find((y) => y.id === "gistemp_glb")!;
    const a = olsTrend(sa.years, g.values["1951-1980"]!)!, b = olsTrend(sa.years, g.values["1991-2020"]!)!;
    expect(Math.abs(a.slope - b.slope)).toBeLessThan(1e-3 / 10 + 1e-4);
    expect(Math.abs(a.ciAr1[1] - b.ciAr1[1])).toBeLessThan(2e-4);
  });
});
