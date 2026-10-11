/**
 * Per-scene visitor parameters (VISUAL_DESIGN 4): S03a +2 C, S03b regional
 * turn, S05 Zero Lab, S06 scenario, OBS cross-filter store. Source and
 * baseline live in state/climate.ts (shared by every scene).
 */
import { createStore } from "./store";

export const PERIODS = ["1880_latest", "1951_latest", "1975_latest", "1991_latest"] as const;
export type PeriodId = (typeof PERIODS)[number];
export const BAND_IDS = ["arctic", "n_mid", "low", "s_mid", "antarctic"] as const;
export type BandId = (typeof BAND_IDS)[number];

export const years = createStore({ plus2: false });

/** S03b: the authored state comes from scroll; a ledger click / arrow key / drag overrides until the next threshold. */
export const regions = createStore({ period: "1975_latest" as PeriodId, override: null as BandId | null, drag: null as null | { lon: number; lat: number } });

export const LAB_DEFAULT = { from: 1975, to: 2025, smooth: false, breaks: false };
export const lab = createStore({ ...LAB_DEFAULT });

export const SCENARIOS = ["SSP1-1.9", "SSP1-2.6", "SSP2-4.5", "SSP3-7.0", "SSP5-8.5"] as const;
export const futures = createStore({ scenario: "SSP2-4.5" as (typeof SCENARIOS)[number] });

export type Layer = "anomaly" | "trend" | "plus2" | "coverage";
export type Region = BandId | { lat0: number; lat1: number } | null;
export const OBS_DEFAULT = { year: 2025, view: "globe" as "globe" | "map", layer: "anomaly" as Layer, region: null as Region, cell: null as null | { row: number; col: number }, lon0: -30, lat0: 15, playing: false, period: "1975_latest" as PeriodId };
export const obs = createStore({ ...OBS_DEFAULT });
