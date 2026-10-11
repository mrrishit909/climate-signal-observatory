/** One ArtifactSpec per file; getStore() shares a single request per artifact. */
import type { ArtifactSpec } from "./loader";
import { gridReader, type Grid } from "./grid";
import {
  isCo2, isCoastlines, isExtremes, isFacts, isSeriesAnnual, isValidation,
  type Co2, type Coastlines, type Extremes, type Facts, type SeriesAnnual, type Source, type Validation,
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
