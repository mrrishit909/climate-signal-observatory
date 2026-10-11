/**
 * S06 Assessed Futures composition, as plain data (VISUAL_DESIGN 3.4 S06).
 * Observed marks and PREDICTED brackets live in separate groups and nothing
 * joins them: there is no polyline in this model at all (Vitest checks it).
 */
import type { Ar6 } from "../data/types";

export interface Bracket { scenario: string; period: string; y0: number; y1: number; low: number; high: number; best: number }
export interface ObservedMark { year: number; value: number; lo: number | null; hi: number | null }
export interface FuturesModel {
  observed: ObservedMark[];
  means: { label: string; y0: number; y1: number; value: number }[];
  assessed: { y0: number; y1: number; best: number; low: number; high: number; page: number } | null;
  brackets: Bracket[];
}

const span = (period: string) => period.split("-").map(Number) as [number, number];

export function futuresModel(ar6: Ar6, years: readonly number[], values: readonly (number | null)[], lo?: readonly (number | null)[], hi?: readonly (number | null)[]): FuturesModel {
  const observed: ObservedMark[] = [];
  years.forEach((y, i) => { const v = values[i]; if (v !== null && v !== undefined) observed.push({ year: y, value: v, lo: lo?.[i] ?? null, hi: hi?.[i] ?? null }); });
  const d = ar6.observed_derived.hadcrut5_rebased_1850_1900;
  const means = [["2001-2020", d.mean_2001_2020], ["2005-2024", d.mean_2005_2024]]
    .filter((m): m is [string, number] => typeof m[1] === "number")
    .map(([p, v]) => { const [a, b] = span(p); return { label: p, y0: a, y1: b, value: v }; });
  const pub = ar6.observed_published.find((o) => o.period === "2001-2020" && o.quantity === "global_surface_temperature_change");
  const assessed = pub ? { y0: 2001, y1: 2020, best: pub.best_estimate_c, low: pub.assessed_low_c, high: pub.assessed_high_c, page: pub.page_pdf } : null;
  const brackets = ar6.scenarios.flatMap((s) => s.rows.map((r) => { const [a, b] = span(r.period); return { scenario: s.id, period: r.period, y0: a, y1: b, low: r.very_likely_low_c, high: r.very_likely_high_c, best: r.best_estimate_c }; }));
  return { observed, means, assessed, brackets };
}
