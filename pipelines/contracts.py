"""Generate JSON Schemas (draft 2020-12) for every published artifact into data/contracts/*.schema.json.

    uv run python -m pipelines.contracts

Contract-first: these schemas are the interface the site is designed against. Array lengths that are
structural (grid shapes, 12 months) are fixed here; lengths that grow with each source update
(years, months) are checked for mutual consistency in tests/test_contracts.py instead.
"""
from __future__ import annotations

import json

from pipelines.common import CONTRACTS

N, I, S, B = {"type": "number"}, {"type": "integer"}, {"type": "string"}, {"type": "boolean"}
NN = {"type": ["number", "null"]}
IN = {"type": ["integer", "null"]}
TAG = "^(OBSERVED|DERIVED|PREDICTED|SIMULATED|SYNTHETIC)(/(OBSERVED|DERIVED|PREDICTED|SIMULATED|SYNTHETIC))*$"
TAGS = {"type": "object", "minProperties": 1, "additionalProperties": {"type": "string", "pattern": TAG}}
BASELINES = ["1850-1900", "1951-1980", "1991-2020"]
BASE_PROP = {"enum": BASELINES}
BASE_KEY = {"propertyNames": BASE_PROP}  # object keyed by baseline id


def arr(item, n=None, lo=None):
    d = {"type": "array", "items": item}
    if n is not None:
        d["minItems"] = d["maxItems"] = n
    elif lo is not None:
        d["minItems"] = lo
    return d


def obj(props: dict, req: list | None = None, extra: bool = False) -> dict:
    return {"type": "object", "properties": props, "required": req if req is not None else list(props), "additionalProperties": extra}


def by_base(item) -> dict:
    """Object keyed by baseline id; every value matches item."""
    return {"type": "object", **BASE_KEY, "minProperties": 1, "additionalProperties": item}


def top(name: str, props: dict, req: list | None = None) -> dict:
    p = {"schema_version": {"const": "v1"}, "tags": TAGS, **props}
    r = ["schema_version", "tags"] + (req if req is not None else list(props))
    return {"$schema": "https://json-schema.org/draft/2020-12/schema", "title": name, **obj(p, r)}


YEARS = arr({"type": "integer", "minimum": 1850, "maximum": 2100}, lo=100)
CI = arr(NN)  # same length as years, enforced in tests
PCI = arr(N, 2)  # [lo, hi]
FACT = obj({"value": {}, "unit": S, "tag": {"type": "string", "pattern": TAG}, "source_artifact": S, "note": S}, ["value", "unit", "tag", "source_artifact"])

FACT_KEYS = [
    "latest_complete_year", "latest_month_gistemp", "latest_month_hadcrut5",
    "gistemp_latest_year_anomaly_1951_1980", "gistemp_latest_year_anomaly_1991_2020", "hadcrut5_latest_year_anomaly_1850_1900",
    "warmest_year_gistemp", "warmest_year_hadcrut5", "top10_warmest_years_gistemp", "years_since_2010_in_gistemp_top10",
    "baseline_offset_1951_1980_to_1991_2020_gistemp",
    "trend_gistemp_1880_latest", "trend_gistemp_1975_latest", "trend_gistemp_1991_latest", "trend_hadcrut5_1850_latest",
    "trend_gistemp_1975_latest_naive_ci_halfwidth", "trend_gistemp_1975_latest_ar1_ci_halfwidth",
    "hadcrut5_2011_2020_vs_1850_1900", "ar6_published_2011_2020", "hadcrut5_2015_2024_vs_1850_1900",
    "co2_mlo_latest_ppm", "co2_mlo_latest_month", "co2_global_growth_2015_latest", "co2_temperature_corr_levels", "co2_temperature_corr_first_differences",
    "gistemp_hadcrut5_annual_corr", "gistemp_hadcrut5_annual_rmsd", "gistemp_hadcrut5_trend_gap_1880_latest",
    "gistemp_valid_area_share_first_year", "gistemp_valid_area_share_latest_year", "gistemp_missing_cells_total_share",
    "extremes_area_share_above_p95_latest_year", "extremes_area_share_above_p95_reference_mean",
    "changepoint_gistemp_selected_breaks", "grid_artifact_gzip_bytes_total",
]

SCHEMAS = {
    "meta": top("meta", {
        "pipeline_version": S, "generated_at": S,
        "sources": {"type": "object", "minProperties": 8, "additionalProperties": obj({
            "name": S, "version": S, "url": S, "license_note": S, "citation": S, "bytes": I, "sha256": S, "last_modified": {"type": ["string", "null"]},
            "retrieved_at": S, "native_baseline": {"type": ["string", "null"]}, "tag": {"type": "string", "pattern": TAG}}, extra=True)},
        "baselines": arr(BASE_PROP, lo=3), "baseline_notes": S,
        "artifact_files": {"type": "object", "additionalProperties": obj({"bytes": I, "gzip_bytes": I, "sha256": S})},
        "tag_legend": {"type": "object"}, "limitations": arr(S, lo=5)}),

    "facts": top("facts", {"facts": obj({k: FACT for k in FACT_KEYS}, extra=False)}),

    "series_annual": top("series_annual", {
        "years": YEARS, "baselines": arr(BASE_PROP, lo=3), "partial_year_excluded": {"type": ["integer", "null"]},
        "series": arr(obj({
            "id": S, "label": S, "source": S, "region": {"enum": ["global", "nh", "sh"]}, "domain": {"enum": ["land_ocean", "land_only"]},
            "native_baseline": BASE_PROP | {"enum": ["1951-1980", "1961-1990"]}, "first_year": I, "last_year": I,
            "values": by_base(CI), "ci_lo": {"anyOf": [by_base(CI), {"type": "null"}]}, "ci_hi": {"anyOf": [by_base(CI), {"type": "null"}]},
            "ci_note": {"type": ["string", "null"]}}), lo=7),
        "conversions": arr(obj({
            "series": S, "from": S, "to": S, "offset_c": N, "monthly_offsets_c": arr(N, 12), "n_years_per_month": arr(I, 12), "method": S}), lo=10),
    }),

    "series_monthly": top("series_monthly", {
        "start": {"type": "string", "pattern": "^[0-9]{4}-[0-9]{2}$"}, "n_months": {"type": "integer", "minimum": 1000},
        "baselines": arr(BASE_PROP, lo=3),
        "series": arr(obj({"id": S, "label": S, "source": S, "native_baseline": S, "values": by_base(CI), "ci_lo": {"anyOf": [by_base(CI), {"type": "null"}]}, "ci_hi": {"anyOf": [by_base(CI), {"type": "null"}]}}), lo=2),
    }),

    "trends": top("trends", {
        "unit": {"const": "degC_per_decade"},
        "method": obj({"primary_ci": S, "ar1_adjustment": S, "hac": S, "naive": S, "loess": S, "loess_band": S}),
        "periods": arr(obj({"id": S, "start": I, "end": I}), lo=5),
        "series": arr(obj({
            "series_id": S, "label": S,
            "fits": arr(obj({
                "period": S, "start": I, "end": I, "n": I, "slope_per_decade": N, "intercept_c": N, "r2": N, "lag1_autocorr_resid": N, "n_eff": N,
                "ci_naive": PCI, "ci_ar1": PCI, "ci_hac": PCI, "total_change_c": N, "total_change_ci_ar1": PCI}), lo=5)}), lo=2),
        "loess": arr(obj({
            "series_id": S, "frac": N, "span_years": N, "n_boot": I, "block_len": I, "years": YEARS,
            "fit": by_base(CI), "band_lo": by_base(CI), "band_hi": by_base(CI)}), lo=2),
        "rolling": arr(obj({
            "series_id": S, "window_years": I, "end_year": arr(I), "slope_per_decade": arr(N), "ci_ar1_lo": arr(N), "ci_ar1_hi": arr(N)}), lo=2),
    }),

    "regional": top("regional", {
        "years": YEARS, "baselines": arr(BASE_PROP, lo=3),
        "bands": arr(obj({"id": S, "label": S, "lat_min": N, "lat_max": N, "area_share_of_globe": N}), lo=5),
        "rows": arr(obj({
            "source": {"enum": ["gistemp", "hadcrut5"]}, "band": S, "values": by_base(CI),
            "valid_area_share": arr(NN), "native_baseline": S}), lo=10),
        "land_ocean": obj({
            "note": S, "years": YEARS, "land_only": by_base(CI), "land_ocean": by_base(CI), "gap_land_minus_landocean": by_base(CI),
            "ar6_land_2011_2020": obj({"best_estimate_c": N, "low_c": N, "high_c": N, "baseline": S, "source_page_pdf": I}),
            "ar6_ocean_2011_2020": obj({"best_estimate_c": N, "low_c": N, "high_c": N, "baseline": S, "source_page_pdf": I})}),
    }),

    "extremes": top("extremes", {
        "definition": S, "reference_period": S, "years": YEARS,
        "min_reference_years": I, "n_cells_with_reference": I,
        "metrics": arr(obj({
            "id": S, "label": S, "source": {"enum": ["gistemp", "hadcrut5"]}, "reference": S,
            "area_share": CI, "expected_share_in_reference": NN, "valid_area_share": CI}), lo=6),
    }),

    "changepoints": top("changepoints", {
        "status": {"const": "EXPLORATORY"}, "caveat": S,
        "method": obj({"model": S, "min_segment_years": I, "max_breaks": I, "selection": S, "n_boot": I, "block_len": I, "autocorrelation_note": S}),
        "results": arr(obj({
            "series_id": S, "start": I, "end": I,
            "candidates": arr(obj({"k": I, "breaks": arr(I), "sse": N, "bic": N, "slopes_per_decade": arr(N)}), lo=2),
            "selected_k": I, "selected_breaks": arr(I), "selected_slopes_per_decade": arr(N),
            "break_ci_95": arr(PCI), "fit": by_base(CI), "years": YEARS}), lo=2),
    }),

    "agreement": top("agreement", {
        "baseline_used": S, "common_period": arr(I, 2), "years": YEARS,
        "annual": obj({
            "gistemp": by_base(CI), "hadcrut5": by_base(CI), "diff_gistemp_minus_hadcrut5": by_base(CI),
            "stats": by_base(obj({
                "n": I, "mean_diff": N, "rmsd": N, "max_abs_diff": N, "max_abs_diff_year": I, "corr": N, "corr_first_differences": N,
                "trend_gistemp_per_decade": N, "trend_hadcrut5_per_decade": N, "trend_gap_per_decade": N}))}),
        "by_decade": arr(obj({"decade": I, "mean_diff": N, "n": I}), lo=10),
        "coverage_matched": obj({
            "box_deg": I, "min_valid_share_in_box": N, "n_common_boxes_mean": N, "baseline": S,
            "gistemp_common": CI, "hadcrut5_common": CI, "diff": CI, "rmsd": N, "corr": N, "mean_diff": N,
            "note": S}),
        "hemispheres": arr(obj({"region": {"enum": ["nh", "sh"]}, "baseline": S, "rmsd": N, "corr": N, "mean_diff": N}), 2),
        "monthly": obj({"baseline": S, "start": S, "diff": CI, "rmsd": N, "corr": N}),
    }),

    "co2": top("co2", {
        "association_only": {"const": True}, "note": S,
        "sentinels": S, "mlo_site_note": S,
        "annual_years": YEARS,
        "mlo_annual_ppm": CI, "mlo_interpolated_months": arr(IN), "global_annual_ppm": CI,
        "temperature_annual": by_base(CI), "temperature_series_id": S,
        "monthly": obj({"start": S, "mlo_ppm": CI, "mlo_deseasonalized_ppm": CI, "mlo_interpolated": arr({"type": ["boolean", "null"]}), "global_ppm": CI}),
        "association": obj({
            "years_used": arr(I, lo=10), "exclusion_rule": S,
            "levels": obj({"n": I, "corr": N, "slope_c_per_ppm": N, "slope_ci_ar1": PCI, "r2": N, "lag1_autocorr_resid": N}),
            "first_differences": obj({"n": I, "corr": N, "slope_c_per_ppm": N, "slope_ci_ar1": PCI}),
            "detrended": obj({"n": I, "corr": N}), "interpretation": S}),
    }),

    "ar6": top("ar6", {
        "source": obj({"name": S, "url": S, "table": S, "page_pdf": I, "page_printed": I, "license_note": S, "baseline": {"const": "1850-1900"}, "averaging": S}),
        "scenarios": arr(obj({"id": S, "label": S, "ghg_description": S, "rows": arr(obj({
            "period": S, "best_estimate_c": N, "very_likely_low_c": N, "very_likely_high_c": N}), 3)}), 5),
        "observed_published": arr(obj({"quantity": S, "period": S, "best_estimate_c": N, "assessed_low_c": N, "assessed_high_c": N, "baseline": S, "page_pdf": I}), 4),
        "observed_derived": obj({
            "note": S, "hadcrut5_rebased_1850_1900": obj({"mean_2011_2020": N, "mean_2001_2020": N, "mean_2015_2024": N, "mean_2005_2024": N, "latest_year": N, "latest_year_value": N}),
            "difference_vs_ar6_2011_2020": N, "within_ar6_assessed_range_2011_2020": B, "gistemp_comparison_not_available": S}),
        "tags_note": S}),

    "validation": top("validation", {
        "baseline_conversion": obj({"known_value_checks": arr(obj({"name": S, "expected": N, "actual": N, "tol": N, "pass": B}), lo=3)}),
        "grid_vs_official_global": obj({"gistemp": obj({"baseline": S, "n_years": I, "mean_diff": N, "rmsd": N, "max_abs_diff": N, "corr": N}),
                                        "hadcrut5": obj({"baseline": S, "n_years": I, "mean_diff": N, "rmsd": N, "max_abs_diff": N, "corr": N}), "note": S}),
        "grid_encoding": obj({"gistemp": obj({"max_abs_error_c": N, "mean_abs_error_c": N, "clipped_cells": I, "roundtrip_ok": B}),
                              "hadcrut5": obj({"max_abs_error_c": N, "mean_abs_error_c": N, "clipped_cells": I, "roundtrip_ok": B})}),
        "trend_ci_simulation": obj({"note": S, "n_sims": I, "n_years": I, "phi": N, "true_slope_per_decade": N, "coverage_naive": N, "coverage_ar1": N, "coverage_hac": N, "tag": {"const": "SIMULATED"}}),
        "ar6_text_check": obj({"values_checked": I, "all_found_in_pdf_page": B}),
        "internal_consistency": arr(obj({"name": S, "pass": B, "detail": S}), lo=5)}),

    "reconciliation": top("reconciliation", {
        "invariant": S,
        "grids": arr(obj({
            "source": S, "n_time": I, "n_lat": I, "n_lon": I, "total_cells": I, "valid_cells": I, "missing_cells": I, "fill_value_cells": I,
            "nan_cells": I, "missing_share": N, "first_month": S, "last_month": S, "complete_years": I, "partial_years": arr(I),
            "annual_cell_years_total": I, "annual_cell_years_valid": I, "annual_cell_years_dropped_lt_min_months": I,
            "cells_ever_valid": I, "cells_never_valid": I}), 2),
        "tables": arr(obj({
            "source": S, "file": S, "rows": I, "months_expected": I, "months_valid": I, "months_missing": I, "sentinel_values": S, "partial_year_rows": I}), lo=8),
        "co2": obj({"mlo_rows": I, "mlo_interpolated_rows": I, "mlo_measured_rows": I, "global_rows": I, "global_interpolated_rows": I}),
        "downsampling": obj({"gistemp_2deg_cells": I, "published_cells": I, "note": S})}),

    "grid_meta": top("grid_meta", {
        "id": S, "source": S, "product": S, "native_baseline": S, "units": {"const": "degC"},
        "encoding": obj({
            "dtype": {"const": "int8"}, "scale_degC_per_unit": N, "missing_value": {"const": -128}, "valid_range": arr(I, 2),
            "layout": S, "row_order": {"const": "north_to_south"}, "lon_order": {"const": "west_to_east"},
            "file": S, "compression": {"const": "gzip"}, "uncompressed_bytes": I, "gz_bytes": I, "sha256_uncompressed": S,
            "decode": S}),
        "grid": obj({"n_lat": I, "n_lon": I, "lat_step_deg": N, "lon_step_deg": N, "lat_first_center": N, "lon_first_center": N}),
        "years": obj({"first": I, "last": I, "n": I}),
        "aggregation": obj({"annual_rule": S, "min_months_per_cell_year": I}),
        "valid_cells_per_year": arr(I), "valid_area_share_per_year": arr(N),
        "baseline_offsets": by_base(obj({"unit_degC_per_unit": N, "min_reference_share": N, "n_valid_cells": I, "values": arr(IN)})),
        "quantization": obj({"max_abs_error_c": N, "mean_abs_error_c": N, "clipped_cells": I, "tradeoff": S}),
    }),
}


def build() -> None:
    CONTRACTS.mkdir(parents=True, exist_ok=True)
    for n, sc in SCHEMAS.items():
        (CONTRACTS / f"{n}.schema.json").write_text(json.dumps(sc, indent=1, sort_keys=True) + "\n")


if __name__ == "__main__":
    build()
