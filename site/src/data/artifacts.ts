/** One ArtifactSpec per file; getStore() shares a single request per artifact. */
import type { ArtifactSpec } from "./loader";
import { gridReader, trendReader, type Grid, type TrendGrid } from "./grid";
import {
  isAgreement, isAr6, isChangepoints, isCo2, isCoastlines, isExtremes, isFacts, isMeta, isReconciliation, isRegional, isSeriesAnnual, isTrends, isValidation,
  type Agreement, type Ar6, type Changepoints, type Co2, type Coastlines, type Extremes, type Facts, type MetaA, type Reconciliation, type Regional,
  type SeriesAnnual, type Source, type Trends, type Validation,
} from "./types";

export const FACTS: ArtifactSpec<Facts> = { file: "facts.json", guard: isFacts };
export const COAST: ArtifactSpec<Coastlines> = { file: "coastlines.json", guard: isCoastlines };
export const SERIES: ArtifactSpec<SeriesAnnual> = { file: "series_annual.json", guard: isSeriesAnnual };
export const CO2: ArtifactSpec<Co2> = { file: "co2.json", guard: isCo2 };
export const EXTREMES: ArtifactSpec<Extremes> = { file: "extremes.json", guard: isExtremes };
export const VALIDATION: ArtifactSpec<Validation> = { file: "validation.json", guard: isValidation };

const isGrid = (v: unknown): v is Grid => typeof v === "object" && v !== null && (v as Grid).data instanceof Int8Array;
const gridSpec = (stem: string): ArtifactSpec<Grid> => ({ file: `${stem}.i8.bin.gz`, guard: isGrid, read: gridReader(`${stem}.meta.json`) });

export const GRID_INTRO = gridSpec("grid_gistemp_2deg_intro");
export const GRIDS: Record<Source, ArtifactSpec<Grid>> = {
  gistemp: gridSpec("grid_gistemp_2deg"),
  hadcrut5: gridSpec("grid_hadcrut5_5deg"),
};
/** Mono display name used by the loading / error lines. */
export const GRID_LABEL: Record<Source, string> = { gistemp: "GRID_GISTEMP_2DEG", hadcrut5: "GRID_HADCRUT5_5DEG" };
export const REGIONAL: ArtifactSpec<Regional> = { file: "regional.json", guard: isRegional };
export const TRENDS: ArtifactSpec<Trends> = { file: "trends.json", guard: isTrends };
export const CHANGEPOINTS: ArtifactSpec<Changepoints> = { file: "changepoints.json", guard: isChangepoints };
export const AR6: ArtifactSpec<Ar6> = { file: "ar6.json", guard: isAr6 };
export const AGREEMENT: ArtifactSpec<Agreement> = { file: "agreement.json", guard: isAgreement };
export const META: ArtifactSpec<MetaA> = { file: "meta.json", guard: isMeta };
export const RECON: ArtifactSpec<Reconciliation> = { file: "reconciliation.json", guard: isReconciliation };
const isTrendGrid = (v: unknown): v is TrendGrid => typeof v === "object" && v !== null && (v as TrendGrid).data instanceof Int8Array;
const trendSpec = (stem: string): ArtifactSpec<TrendGrid> => ({ file: `${stem}.i8.bin.gz`, guard: isTrendGrid, read: trendReader(`${stem}.meta.json`) });
export const TREND_GRIDS: Record<Source, ArtifactSpec<TrendGrid>> = {
  gistemp: trendSpec("grid_trends_gistemp_2deg"),
  hadcrut5: trendSpec("grid_trends_hadcrut5_5deg"),
};
import { isGridMeta, type GridMeta } from "./types";
/** The sidecars alone (S02 cards, coverage strips): small JSON, no binary. */
export const GRID_META: Record<Source, ArtifactSpec<GridMeta>> = {
  gistemp: { file: "grid_gistemp_2deg.meta.json", guard: isGridMeta },
  hadcrut5: { file: "grid_hadcrut5_5deg.meta.json", guard: isGridMeta },
};
