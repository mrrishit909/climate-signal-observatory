/**
 * Artifact types (subset of data/contracts/*.schema.json the site reads) and
 * hand-written guards at the trust boundary: a mismatch is a SCHEMA MISMATCH
 * error state, never a half-rendered scene.
 */
export type Tag = "OBSERVED" | "DERIVED" | "PREDICTED" | "SIMULATED" | "SYNTHETIC";
export type Baseline = "1850-1900" | "1951-1980" | "1991-2020";
export type Source = "gistemp" | "hadcrut5";
export const BASELINES: Baseline[] = ["1951-1980", "1991-2020", "1850-1900"];

export interface Fact { value: unknown; unit: string; tag: Tag; source_artifact: string; note?: string }
export interface Facts { schema_version: string; facts: Record<string, Fact> }

export interface GridMeta {
  id: string;
  native_baseline: string;
  source: string;
  grid: { n_lat: number; n_lon: number; lat_first_center: number; lat_step_deg: number; lon_first_center: number; lon_step_deg: number };
  years: { first: number; last: number; n: number; list: number[] };
  encoding: { sha256_uncompressed: string; uncompressed_bytes: number; gz_bytes: number };
  baseline_offsets: Partial<Record<Baseline, { values: (number | null)[]; n_valid_cells: number }>>;
  valid_area_share_per_year: number[];
}

export interface Coastlines { coords: number[]; starts: number[]; n_lines: number }

export interface SeriesAnnual {
  years: number[];
  series: { id: string; native_baseline: string; first_year: number; values: Partial<Record<Baseline, (number | null)[]>>; ci_lo: Partial<Record<Baseline, (number | null)[]>> | null; ci_hi: Partial<Record<Baseline, (number | null)[]>> | null }[];
}

export interface Co2 { annual_years: number[]; mlo_annual_ppm: (number | null)[]; monthly: { start: string; mlo_ppm: (number | null)[] } }

export interface Extremes {
  years: number[];
  metrics: { id: string; area_share: (number | null)[]; expected_share_in_reference: number | null }[];
}

export interface Validation { grid_vs_official_global: Record<Source, { max_abs_diff: number }> }

const obj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const arr = Array.isArray;

export const isFacts = (v: unknown): v is Facts =>
  obj(v) && obj(v.facts) && Object.values(v.facts).every((f) => obj(f) && "value" in f && typeof f.tag === "string");

export const isGridMeta = (v: unknown): v is GridMeta =>
  obj(v) && obj(v.grid) && typeof v.grid.n_lat === "number" && obj(v.years) && arr(v.years.list) && obj(v.encoding) &&
  typeof v.encoding.sha256_uncompressed === "string" && obj(v.baseline_offsets) && arr(v.valid_area_share_per_year);

export const isCoastlines = (v: unknown): v is Coastlines => obj(v) && arr(v.coords) && arr(v.starts);

export const isSeriesAnnual = (v: unknown): v is SeriesAnnual =>
  obj(v) && arr(v.years) && arr(v.series) && v.series.every((s) => obj(s) && typeof s.id === "string" && obj(s.values));

export const isCo2 = (v: unknown): v is Co2 => obj(v) && arr(v.annual_years) && arr(v.mlo_annual_ppm) && obj(v.monthly);

export const isExtremes = (v: unknown): v is Extremes =>
  obj(v) && arr(v.years) && arr(v.metrics) && v.metrics.every((m) => obj(m) && typeof m.id === "string" && arr(m.area_share));

export const isValidation = (v: unknown): v is Validation => obj(v) && obj(v.grid_vs_official_global);

/** Typed fact accessors: a missing or mistyped key throws (caught by the scene's error state). */
export function num(f: Facts, key: string): number {
  const v = f.facts[key]?.value;
  if (typeof v !== "number") throw new Error(`facts.${key} is not a number`);
  return v;
}
export function fact<T>(f: Facts, key: string): T {
  const v = f.facts[key];
  if (!v) throw new Error(`facts.${key} missing`);
  return v.value as T;
}

export interface Band { id: string; label: string; lat_min: number; lat_max: number; area_share_of_globe: number }
export interface Regional {
  years: number[];
  bands: Band[];
  min_valid_area_share: number;
  rows: { band: string; source: Source; native_baseline: string; valid_area_share: (number | null)[]; values: Partial<Record<Baseline, (number | null)[]>> }[];
  land_ocean: { ar6_land_2011_2020: { best_estimate_c: number; low_c: number; high_c: number; source_page_pdf: number }; ar6_ocean_2011_2020: { best_estimate_c: number; low_c: number; high_c: number; source_page_pdf: number } };
}
export interface TrendFitA { period: string; start: number; end: number; n: number; slope_per_decade: number; ci_ar1: [number, number]; ci_naive: [number, number]; ci_hac: [number, number] }
export interface Trends {
  series: { series_id: string; label: string; fits: TrendFitA[] }[];
  loess: { series_id: string; years: number[]; fit: Partial<Record<Baseline, (number | null)[]>>; band_lo: Partial<Record<Baseline, (number | null)[]>>; band_hi: Partial<Record<Baseline, (number | null)[]>>; span_years: number }[];
  rolling: { series_id: string; end_year: number[]; slope_per_decade: (number | null)[]; ci_ar1_lo: (number | null)[]; ci_ar1_hi: (number | null)[]; window_years: number }[];
}
export interface Changepoints {
  caveat: string;
  results: { series_id: string; years: number[]; fit: Partial<Record<Baseline, (number | null)[]>>; selected_breaks: number[]; break_ci_95: [number, number][]; selected_slopes_per_decade: number[] }[];
}
export interface Ar6Row { period: string; best_estimate_c: number; very_likely_low_c: number; very_likely_high_c: number }
export interface Ar6 {
  scenarios: { id: string; label: string; ghg_description: string; rows: Ar6Row[] }[];
  observed_published: { period: string; quantity: string; best_estimate_c: number; assessed_low_c: number; assessed_high_c: number; page_pdf: number }[];
  observed_derived: { hadcrut5_rebased_1850_1900: Record<string, number> };
  source: { page_printed: number; page_pdf: number; table: string; name: string; url: string };
}
export interface Agreement { annual: { diff_gistemp_minus_hadcrut5: Partial<Record<Baseline, (number | null)[]>>; stats: Record<string, { corr: number; rmsd: number; trend_gap_per_decade: number; max_abs_diff_year: number }> }; years: number[] }
export interface MetaA {
  pipeline_version: string;
  generated_at: string;
  limitations: string[];
  artifact_files: Record<string, { sha256: string; bytes: number }>;
  sources: Record<string, { name: string; last_modified?: string; url: string }>;
}
export interface Reconciliation { grids: { source: string; missing_share: number; cells_never_valid: number; total_cells: number; missing_cells: number; n_lat: number; n_lon: number }[] }
const o2 = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
export const isRegional = (v: unknown): v is Regional => o2(v) && Array.isArray(v.bands) && Array.isArray(v.rows);
export const isTrends = (v: unknown): v is Trends => o2(v) && Array.isArray(v.series) && Array.isArray(v.loess);
export const isChangepoints = (v: unknown): v is Changepoints => o2(v) && Array.isArray(v.results);
export const isAr6 = (v: unknown): v is Ar6 => o2(v) && Array.isArray(v.scenarios) && Array.isArray(v.observed_published);
export const isAgreement = (v: unknown): v is Agreement => o2(v) && o2(v.annual);
export const isMeta = (v: unknown): v is MetaA => o2(v) && Array.isArray(v.limitations) && o2(v.artifact_files);
export const isReconciliation = (v: unknown): v is Reconciliation => o2(v) && Array.isArray(v.grids);
