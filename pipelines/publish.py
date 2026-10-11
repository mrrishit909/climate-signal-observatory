"""Assemble, validate and write every artifact to site/public/data/, plus facts.json, validation.json, reconciliation.json, meta.json."""
from __future__ import annotations

import csv
import datetime as dt
import gzip
import hashlib
import json
import re

import numpy as np
from jsonschema import Draft202012Validator

from analytics import core, stats
from pipelines import contracts
from pipelines.common import BASELINES, CONTRACTS, INTERIM, MANIFESTS, PUBLIC, RAW, REFERENCE, ROOT, SCHEMA_VERSION, write_json
from pipelines.modeling import build

PIPELINE_VERSION = "1.0.0"
SOURCE_INFO = {
    "gistemp_grid_nc_gz": ("NASA GISTEMP v4 gridded 1200 km (GHCNv4 + ERSSTv5)", "GISTEMP v4", "1951-1980", "OBSERVED",
                           "No data licence stated by GISS; acknowledgment requested (NASA GISS/GISTEMP). Formal data licence unverified.", "GISTEMP Team, 2026: GISS Surface Temperature Analysis (GISTEMP), version 4. NASA Goddard Institute for Space Studies. https://data.giss.nasa.gov/gistemp/"),
    "gistemp_glb_landocean": ("NASA GISTEMP v4 global land-ocean monthly", "GISTEMP v4", "1951-1980", "OBSERVED", "As above.", "GISTEMP Team, 2026."),
    "gistemp_nh_landocean": ("NASA GISTEMP v4 Northern Hemisphere monthly", "GISTEMP v4", "1951-1980", "OBSERVED", "As above.", "GISTEMP Team, 2026."),
    "gistemp_sh_landocean": ("NASA GISTEMP v4 Southern Hemisphere monthly", "GISTEMP v4", "1951-1980", "OBSERVED", "As above.", "GISTEMP Team, 2026."),
    "gistemp_glb_landonly": ("NASA GISTEMP v4 global land-only (meteorological stations) monthly", "GISTEMP v4", "1951-1980", "OBSERVED", "As above.", "GISTEMP Team, 2026."),
    "hadcrut5_grid_nc": ("HadCRUT5 analysis ensemble-mean grid", "HadCRUT.5.2.0.0", "1961-1990", "OBSERVED", "Open Government Licence v3.0 (stated in the file attributes).",
                         "Morice, C. P. et al. (2021), An updated assessment of near-surface temperature change from 1850: the HadCRUT5 data set, J. Geophys. Res. Atmos., 126, e2019JD032361, doi:10.1029/2019JD032361"),
    "hadcrut5_global_monthly": ("HadCRUT5 global monthly summary series with 95% CI", "HadCRUT.5.2.0.0", "1961-1990", "OBSERVED", "Open Government Licence v3.0.", "Morice et al. (2021)."),
    "hadcrut5_nh_monthly": ("HadCRUT5 NH monthly", "HadCRUT.5.2.0.0", "1961-1990", "OBSERVED", "Open Government Licence v3.0.", "Morice et al. (2021)."),
    "hadcrut5_sh_monthly": ("HadCRUT5 SH monthly", "HadCRUT.5.2.0.0", "1961-1990", "OBSERVED", "Open Government Licence v3.0.", "Morice et al. (2021)."),
    "hadcrut5_global_annual": ("HadCRUT5 global annual summary series with 95% CI", "HadCRUT.5.2.0.0", "1961-1990", "OBSERVED", "Open Government Licence v3.0.", "Morice et al. (2021)."),
    "hadcrut5_nh_annual": ("HadCRUT5 NH annual", "HadCRUT.5.2.0.0", "1961-1990", "OBSERVED", "Open Government Licence v3.0.", "Morice et al. (2021)."),
    "hadcrut5_sh_annual": ("HadCRUT5 SH annual", "HadCRUT.5.2.0.0", "1961-1990", "OBSERVED", "Open Government Licence v3.0.", "Morice et al. (2021)."),
    "noaa_co2_mlo_monthly": ("NOAA GML Mauna Loa monthly CO2", "GML trends file", None, "OBSERVED", "Freely available; citation requested. Formal public-domain statement unverified.",
                             "Lan, X., Tans, P. and Thoning, K.W.: Trends in globally-averaged CO2 determined from NOAA Global Monitoring Laboratory measurements, doi:10.15138/9N0H-ZH07"),
    "noaa_co2_global_monthly": ("NOAA GML global marine-surface monthly CO2", "GML trends file", None, "OBSERVED", "As above.", "Lan, Tans and Thoning, doi:10.15138/9N0H-ZH07"),
    "ne_110m_coastline": ("Natural Earth 110m coastline", "Natural Earth 110m (GitHub nvkelso/natural-earth-vector master)", None, "OBSERVED", "Public domain (naturalearthdata.com terms of use).", "Made with Natural Earth. Free vector and raster map data at naturalearthdata.com."),
    "ne_110m_land": ("Natural Earth 110m land polygons", "Natural Earth 110m (GitHub nvkelso/natural-earth-vector master)", None, "OBSERVED", "Public domain (naturalearthdata.com terms of use).", "Made with Natural Earth. Free vector and raster map data at naturalearthdata.com."),
    "ipcc_ar6_wgi_spm_pdf": ("IPCC AR6 WGI Summary for Policymakers (Table SPM.1, A.1.2)", "AR6 WGI 2021 SPM final", "1850-1900", "PREDICTED",
                             "Licence page unverifiable (HTTP 403). Only short factual values quoted with page citation.", "IPCC, 2021: Summary for Policymakers. In: Climate Change 2021: The Physical Science Basis. Cambridge University Press."),
}


def build_all(n_boot: int = 500, n_sims: int = 2000) -> None:
    PUBLIC.mkdir(parents=True, exist_ok=True)
    contracts.build()
    c = build.Ctx()
    art: dict[str, dict] = {}
    art["series_annual"] = build.series_annual(c)
    art["series_monthly"] = build.series_monthly(c)
    art["regional"] = build.regional(c)
    art["trends"] = build.trends(c, n_boot, art["regional"])
    art["extremes"] = build.extremes(c)
    art["changepoints"] = build.changepoints(c)
    art["agreement"] = build.agreement(c)
    art["co2"] = build.co2(c)
    art["ar6"] = build.ar6(c)
    art["coastlines"] = build.coastlines_art()
    art["land_fraction"] = build.land_fraction_art(c)
    art["regional"]["land_ocean"]["grid_land_mask"] = {
        "rule": "Grid cells with land fraction >= 50% (Natural Earth 110m, land_fraction.json) are land, the rest ocean; cos(lat)-weighted mean of observed cells; null if < 40% of the class area is observed. APPROXIMATE: GISTEMP and HadCRUT5 cells blend land stations and SST, and coastal cells mix both.",
        "land_fraction_threshold_pct": 50, "years": [int(y) for y in c.years], "sources": build.land_ocean_from_grid(c, art["land_fraction"])}
    metas = build.grids(c, PUBLIC)
    tmetas = build.grid_trends(c, PUBLIC)
    art["zonal_fixture"] = build.zonal_fixture(c, PUBLIC)
    ledger = json.loads((MANIFESTS / "cleaning_ledger.json").read_text())
    art["reconciliation"] = reconciliation(ledger)
    art["validation"] = validation(c, art, metas, tmetas, ledger, n_sims)
    art["facts"] = facts(c, art, metas, tmetas, ledger)
    # write
    for name, a in art.items():
        write_json(PUBLIC / f"{name}.json", a)
    for m in list(metas.values()) + list(tmetas.values()):
        fname = m["encoding"]["file"].replace(".i8.bin.gz", "")
        write_json(PUBLIC / f"{fname}.meta.json", tagged_grid(m))
    art["meta"] = meta(c, ledger)
    write_json(PUBLIC / "meta.json", art["meta"])
    check_schemas()
    print("published", sorted(p.name for p in PUBLIC.iterdir()))


def tagged_grid(m: dict) -> dict:
    tags = {"encoding": "DERIVED", "grid": "DERIVED", "periods": "DERIVED", "rule": "DERIVED", "baseline_offsets": "DERIVED", "valid_cells_per_year": "OBSERVED", "quantization": "DERIVED"}
    return {"schema_version": SCHEMA_VERSION, "tags": {k: v for k, v in tags.items() if k in m}, **m}


def check_schemas() -> None:
    for f in PUBLIC.glob("*.json"):
        stem = f.stem
        schema_name = ("grid_trends_meta" if stem.startswith("grid_trends_") else "grid_meta") if stem.endswith(".meta") else stem
        sp = CONTRACTS / f"{schema_name}.schema.json"
        errs = list(Draft202012Validator(json.loads(sp.read_text())).iter_errors(json.loads(f.read_text())))
        if errs:
            raise SystemExit(f"{f.name} violates {sp.name}: {errs[0].message} at {list(errs[0].path)[:6]}")


# --------------------------------------------------------------------------------------------- reconciliation

def reconciliation(ledger: dict) -> dict:
    return {"schema_version": SCHEMA_VERSION, "tags": {"grids": "OBSERVED", "tables": "OBSERVED", "co2": "OBSERVED", "downsampling": "DERIVED", "invariant": "DERIVED"},
            "invariant": ("For each grid: total_cells = valid_cells + missing_cells and missing_cells = fill_value_cells + nan_cells. "
                          "For annual aggregation: annual_cell_years_total = annual_cell_years_valid + annual_cell_years_dropped_lt_min_months (cells with fewer than 9 valid months in a complete year). "
                          "Cells of partial years are excluded from annual products and are not counted in annual_cell_years_total. For tables: months_expected = months_valid + months_missing."),
            "grids": ledger["grids"], "tables": ledger["tables"], "co2": ledger["co2"],
            "downsampling": {"gistemp_2deg_cells": 16200, "published_cells": 16200,
                             "note": "No spatial downsampling: GISTEMP is published at its native 2 degree grid and HadCRUT5 at its native 5 degree grid. Only the 10 degree coverage-matched comparison aggregates cells, and it is not a published grid."}}


# --------------------------------------------------------------------------------------------- validation

def _jd(path):
    out = {}
    for r in csv.reader(open(path)):
        if r and r[0].strip().isdigit() and r[13].strip() not in ("***", ""):
            out[int(r[0])] = float(r[13])
    return out


def ar6_text_check() -> dict:
    from pypdf import PdfReader
    rd = PdfReader(str(RAW / "ipcc" / "IPCC_AR6_WGI_SPM_final.pdf"))
    norm = lambda t: re.sub(r"\s+", " ", t.replace("–", "-").replace("−", "-"))
    p18, p9 = norm(rd.pages[17].extract_text()), norm(rd.pages[8].extract_text())
    rows = list(csv.DictReader(open(REFERENCE / "ar6_spm1.csv")))
    n, ok = 0, True
    f = lambda v: f"{float(v):.1f}"
    for sid in sorted({r["scenario"] for r in rows}):
        rs = {r["period"]: r for r in rows if r["scenario"] == sid}
        line = sid + " " + " ".join(f"{f(rs[p]['best_estimate_c'])} {f(rs[p]['very_likely_low_c'])} to {f(rs[p]['very_likely_high_c'])}" for p in ("2021-2040", "2041-2060", "2081-2100"))
        n += 9
        ok &= line in p18
    for r in csv.DictReader(open(REFERENCE / "ar6_observed.csv")):
        s = f"{float(r['best_estimate_c']):.2f} [{float(r['assessed_low_c']):.2f} to {float(r['assessed_high_c']):.2f}]"
        n += 3
        ok &= s in p9
    return {"values_checked": n, "all_found_in_pdf_page": bool(ok)}


def validation(c, art, metas, tmetas, ledger, n_sims) -> dict:
    checks = []
    def add(name, expected, actual, tol):
        checks.append({"name": name, "expected": float(expected), "actual": float(actual), "tol": float(tol), "pass": bool(abs(actual - expected) <= tol)})
    # 1. rebased series average zero over the reference period, per calendar month
    for sid, base in (("gistemp_glb", "1951-1980"), ("gistemp_glb", "1991-2020"), ("hadcrut5_glb", "1850-1900"), ("hadcrut5_glb", "1991-2020")):
        r = c.monthly(sid, base)
        b0, b1 = core.BASE_YEARS[base]
        worst = max(abs(np.nanmean(r[(y0 := (b0 - core.Y0) * 12 + m):(b1 - core.Y0 + 1) * 12:12])) for m in range(12))
        add(f"{sid} rebased to {base}: every calendar-month mean over {base} is 0", 0.0, worst, 1e-9)
    # 2. composition of conversions
    x = c.m["gistemp_glb"]
    step = core.rebase_monthly(core.rebase_monthly(x, "1951-1980")[0], "1991-2020")[0]
    direct = core.rebase_monthly(x, "1991-2020")[0]
    add("GISTEMP 1951-1980 -> 1991-2020 equals direct rebase (max abs diff, degC)", 0.0, np.nanmax(np.abs(step - direct)), 1e-9)
    # 3. annual from monthly equals published J-D
    jd = _jd(RAW / "gistemp" / "GLB.Ts+dSST.csv")
    nat = core.annual_from_monthly(x, c.last_year)
    d = max(abs(nat[y - core.Y0] - v) for y, v in jd.items() if y <= c.last_year)
    add("GISTEMP annual mean of 12 months vs published J-D column (max abs diff, rounding only)", 0.0, d, 0.011)
    # 4. HadCRUT5 annual file vs monthly mean
    h = core.annual_from_monthly(c.m["hadcrut5_glb"], c.last_year)
    af = c.m["hadcrut5_glb_annfile"][:len(h)]
    add("HadCRUT5 annual file vs mean of its 12 monthly values (max abs diff, degC)", 0.0, np.nanmax(np.abs(h - af)), 0.0015)
    # 5. grid vs official global means
    out = {}
    for src, sid, nat_base in (("gistemp", "gistemp_glb", "1951-1980"), ("hadcrut5", "hadcrut5_glb", "1961-1990")):
        ann, yrs, lat, lon = build.grid_set(c)[src]
        w = np.repeat(core.lat_weights(lat)[:, None], len(lon), 1).reshape(-1)
        gm, _ = core.weighted_mean(ann.reshape(len(yrs), -1), w)
        off = core.annual_from_monthly(c.m[sid], c.last_year)
        dd = gm - np.array([off[y - core.Y0] for y in yrs])
        out[src] = {"baseline": nat_base + " (native)", "n_years": int(np.isfinite(dd).sum()), "mean_diff": round(float(np.nanmean(dd)), 4),
                    "rmsd": round(float(np.sqrt(np.nanmean(dd ** 2))), 4), "max_abs_diff": round(float(np.nanmax(np.abs(dd))), 4),
                    "corr": round(float(np.corrcoef(gm, [off[y - core.Y0] for y in yrs])[0, 1]), 5)}
    out["note"] = ("Cos(lat)-weighted mean of the OBSERVED grid cells vs the source's own published global mean. They differ because the publishers weight, "
                   "infill and handle coverage differently and because early HadCRUT5 coverage is incomplete. Reported, not hidden: the site uses the published series for headline numbers, not the grid mean.")
    # 6. encoding roundtrip
    enc = {}
    for gid, m in metas.items():
        if gid.endswith("intro"):
            continue
        src = "gistemp" if gid.startswith("gistemp") else "hadcrut5"
        raw = gzip.decompress((PUBLIC / m["encoding"]["file"]).read_bytes())
        arr = np.frombuffer(raw, np.int8).reshape(m["years"]["n"], m["grid"]["n_lat"], m["grid"]["n_lon"])
        ann = build.grid_set(c)[src][0][:, ::-1, :] if gid.startswith("had") else None
        ann0, yrs, lat, lon = build.grid_set(c)[src]
        ann_n = ann0[:, np.argsort(-lat), :]
        ok = hashlib.sha256(raw).hexdigest() == m["encoding"]["sha256_uncompressed"] and bool(((arr == -128) == ~np.isfinite(ann_n)).all())
        enc[src] = {"max_abs_error_c": m["quantization"]["max_abs_error_c"], "mean_abs_error_c": m["quantization"]["mean_abs_error_c"], "clipped_cells": m["quantization"]["clipped_cells"], "roundtrip_ok": bool(ok)}
    sim = stats.hac_cover_sim(n_sims, 50, 0.5, 0.2, 12345)
    ar6 = ar6_text_check()
    rec = art["reconciliation"]
    consistency = []
    def cons(name, ok, detail):
        consistency.append({"name": name, "pass": bool(ok), "detail": detail})
    for g in rec["grids"]:
        cons(f"{g['source']}: total cells = valid + missing", g["total_cells"] == g["valid_cells"] + g["missing_cells"], f"{g['total_cells']} = {g['valid_cells']} + {g['missing_cells']}")
        cons(f"{g['source']}: annual cell-years = valid + dropped", g["annual_cell_years_total"] == g["annual_cell_years_valid"] + g["annual_cell_years_dropped_lt_min_months"],
             f"{g['annual_cell_years_total']} = {g['annual_cell_years_valid']} + {g['annual_cell_years_dropped_lt_min_months']}")
    ny = len(art["series_annual"]["years"])
    cons("series_annual: every values array has len(years)", all(len(v) == ny for s in art["series_annual"]["series"] for v in s["values"].values()), f"len(years)={ny}")
    cons("series_monthly: every values array has n_months", all(len(v) == art["series_monthly"]["n_months"] for s in art["series_monthly"]["series"] for v in s["values"].values()), f"n={art['series_monthly']['n_months']}")
    cons("GISTEMP never gets a 1850-1900 baseline", all("1850-1900" not in s["values"] for s in art["series_annual"]["series"] if s["source"].startswith("NASA")), "GISTEMP starts 1880")
    tot = sum(m["encoding"]["gz_bytes"] for m in list(metas.values()) + list(tmetas.values()))
    cons("all grid binaries (anomaly, intro, trend) within 1.5 MB gzip total", tot < 1_500_000, str(tot))
    cons("no value outside +/-12.7 C was clipped in grid encoding", all(m["quantization"]["clipped_cells"] == 0 for m in metas.values()), "clipped_cells == 0")
    return {"schema_version": SCHEMA_VERSION, "tags": {"baseline_conversion": "DERIVED", "grid_vs_official_global": "DERIVED", "grid_encoding": "DERIVED", "trend_ci_simulation": "SIMULATED",
                                                      "ar6_text_check": "DERIVED", "internal_consistency": "DERIVED"},
            "baseline_conversion": {"known_value_checks": checks}, "grid_vs_official_global": out, "grid_encoding": enc,
            "trend_ci_simulation": {"note": ("SYNTHETIC-NOISE method check, not data: AR(1) noise (phi 0.5, innovation sd 0.1 C) plus a known linear trend, 50 years, 95% intervals. "
                                             "Shows how often each interval covers the true slope. Naive OLS undercovers; the AR(1)-adjusted interval (primary) is close to nominal; HAC is in between at this short length."),
                                    "n_sims": n_sims, "n_years": 50, "phi": 0.5, "true_slope_per_decade": 0.2, "coverage_naive": round(sim["naive"], 3),
                                    "coverage_ar1": round(sim["ar1"], 3), "coverage_hac": round(sim["hac"], 3), "tag": "SIMULATED"},
            "ar6_text_check": ar6, "internal_consistency": consistency}


# --------------------------------------------------------------------------------------------- facts

def facts(c, art, metas, tmetas, ledger) -> dict:
    arr_ = lambda v: np.array([np.nan if x is None else x for x in v], float)
    yrs = c.years
    F = {}
    def put(k, v, unit, tag, src, note=None):
        d = {"value": v, "unit": unit, "tag": tag, "source_artifact": src}
        if note:
            d["note"] = note
        F[k] = d
    r = lambda v, n=3: round(float(v), n)
    gl = lambda b: c.annual("gistemp_glb", b)
    last = c.last_year
    put("latest_complete_year", last, "year", "DERIVED", "series_annual", "Last calendar year with all 12 months in both sources; the current partial year is excluded from annual products.")
    put("latest_month_gistemp", ledger["grids"][0]["last_month"], "YYYY-MM", "OBSERVED", "reconciliation")
    put("latest_month_hadcrut5", ledger["grids"][1]["last_month"], "YYYY-MM", "OBSERVED", "reconciliation")
    put("gistemp_latest_year_anomaly_1951_1980", r(gl("1951-1980")[-1]), "degC", "OBSERVED", "series_annual", "Anomaly vs 1951-1980 (GISTEMP's native baseline).")
    put("gistemp_latest_year_anomaly_1991_2020", r(gl("1991-2020")[-1]), "degC", "DERIVED", "series_annual", "Same year rebased to 1991-2020.")
    put("hadcrut5_latest_year_anomaly_1850_1900", r(c.annual("hadcrut5_glb", "1850-1900")[-1]), "degC", "DERIVED", "series_annual", "HadCRUT5 rebased to 1850-1900, the AR6 reference.")
    for src, sid in (("gistemp", "gistemp_glb"), ("hadcrut5", "hadcrut5_glb")):
        a = c.annual(sid, "1951-1980")
        i = int(np.nanargmax(a))
        put(f"warmest_year_{src}", {"year": int(yrs[i]), "anomaly_1951_1980": r(a[i])}, "year/degC", "OBSERVED", "series_annual")
    a = gl("1951-1980")
    order = np.argsort(-np.nan_to_num(a, nan=-99))[:10]
    top10 = sorted(int(yrs[i]) for i in order)
    put("top10_warmest_years_gistemp", top10, "year", "DERIVED", "series_annual", "Ten highest annual GISTEMP global anomalies, listed in calendar order.")
    put("years_since_2010_in_gistemp_top10", int(sum(y >= 2010 for y in top10)), "count", "DERIVED", "series_annual")
    conv = next(x for x in art["series_annual"]["conversions"] if x["series"] == "gistemp_glb" and x["to"] == "1991-2020")
    put("baseline_offset_1951_1980_to_1991_2020_gistemp", conv["offset_c"], "degC", "DERIVED", "series_annual", "Subtract this from a 1951-1980 anomaly to express it relative to 1991-2020.")
    def tr(sid, per):
        s = next(s for s in art["trends"]["series"] if s["series_id"] == sid)
        return next(f for f in s["fits"] if f["period"] == per)
    for k, sid, per in (("trend_gistemp_1880_latest", "gistemp_glb", "1880_latest"), ("trend_gistemp_1975_latest", "gistemp_glb", "1975_latest"),
                        ("trend_gistemp_1991_latest", "gistemp_glb", "1991_latest"), ("trend_hadcrut5_1850_latest", "hadcrut5_glb", "1850_latest")):
        f = tr(sid, per)
        put(k, {"slope_per_decade": f["slope_per_decade"], "ci_ar1": f["ci_ar1"], "start": f["start"], "end": f["end"]}, "degC/decade", "DERIVED", "trends", "95% interval adjusted for lag-1 autocorrelation.")
    f = tr("gistemp_glb", "1975_latest")
    put("trend_gistemp_1975_latest_naive_ci_halfwidth", r((f["ci_naive"][1] - f["ci_naive"][0]) / 2, 4), "degC/decade", "DERIVED", "trends")
    put("trend_gistemp_1975_latest_ar1_ci_halfwidth", r((f["ci_ar1"][1] - f["ci_ar1"][0]) / 2, 4), "degC/decade", "DERIVED", "trends")
    d = art["ar6"]["observed_derived"]["hadcrut5_rebased_1850_1900"]
    put("hadcrut5_2011_2020_vs_1850_1900", d["mean_2011_2020"], "degC", "DERIVED", "ar6")
    pub = next(o for o in art["ar6"]["observed_published"] if o["quantity"] == "global_surface_temperature_change" and o["period"] == "2011-2020")
    put("ar6_published_2011_2020", {"best_estimate": pub["best_estimate_c"], "low": pub["assessed_low_c"], "high": pub["assessed_high_c"], "page_pdf": pub["page_pdf"]}, "degC", "OBSERVED", "ar6",
        "Assessed value published in IPCC AR6 WGI SPM A.1.2 (PDF p.9), relative to 1850-1900.")
    put("hadcrut5_2015_2024_vs_1850_1900", d["mean_2015_2024"], "degC", "DERIVED", "ar6")
    mlo = c.m["co2_mlo"]
    i = int(np.where(np.isfinite(mlo))[0][-1])
    put("co2_mlo_latest_ppm", float(mlo[i]), "ppm", "OBSERVED", "co2")
    put("co2_mlo_latest_month", f"{core.Y0 + i // 12}-{i % 12 + 1:02d}", "YYYY-MM", "OBSERVED", "co2")
    gla = np.array([np.nan if v is None else v for v in art["co2"]["global_annual_ppm"]])
    sel = (yrs >= 2015) & np.isfinite(gla)
    put("co2_global_growth_2015_latest", r(stats.ols_trend(yrs[sel].astype(float), gla[sel])["slope"], 2), "ppm/year", "DERIVED", "co2", "OLS slope of NOAA global annual mean CO2, 2015 to the latest complete year.")
    asc = art["co2"]["association"]
    put("co2_temperature_corr_levels", asc["levels"]["corr"], "r", "DERIVED", "co2", "Association only; both series trend.")
    put("co2_temperature_corr_first_differences", asc["first_differences"]["corr"], "r", "DERIVED", "co2", "Association of year-to-year changes.")
    st = art["agreement"]["annual"]["stats"]["1951-1980"]
    put("gistemp_hadcrut5_annual_corr", st["corr"], "r", "DERIVED", "agreement")
    put("gistemp_hadcrut5_annual_rmsd", st["rmsd"], "degC", "DERIVED", "agreement")
    put("gistemp_hadcrut5_trend_gap_1880_latest", st["trend_gap_per_decade"], "degC/decade", "DERIVED", "agreement", "GISTEMP minus HadCRUT5 linear trend, common period.")
    vs = metas["gistemp_2deg"]["valid_area_share_per_year"]
    put("gistemp_valid_area_share_first_year", vs[0], "share", "OBSERVED", "grid_gistemp_2deg.meta", f"Area share of the globe with an annual value in {metas['gistemp_2deg']['years']['first']}.")
    put("gistemp_valid_area_share_latest_year", vs[-1], "share", "OBSERVED", "grid_gistemp_2deg.meta")
    put("gistemp_missing_cells_total_share", ledger["grids"][0]["missing_share"], "share", "OBSERVED", "reconciliation", "Share of all monthly 2 degree cells that are missing in the source file.")
    ex = next(m for m in art["extremes"]["metrics"] if m["id"] == "gistemp_above_p95_1951-1980")
    ev = np.array([np.nan if v is None else v for v in ex["area_share"]])
    put("extremes_area_share_above_p95_latest_year", r(ev[-1], 3), "share", "DERIVED", "extremes")
    put("extremes_area_share_above_p95_reference_mean", r(np.nanmean(ev[(yrs >= 1951) & (yrs <= 1980)]), 3), "share", "DERIVED", "extremes", "In-sample share in the reference years (about 0.067, since 2 of 30 reference years exceed the interpolated 95th percentile); the value to compare the latest year against.")
    cp = next(x for x in art["changepoints"]["results"] if x["series_id"] == "gistemp_glb")
    put("changepoint_gistemp_selected_breaks", {"breaks": cp["selected_breaks"], "k": cp["selected_k"], "status": "EXPLORATORY"}, "year", "DERIVED", "changepoints", "Exploratory; see caveat.")
    put("grid_artifact_gzip_bytes_total", int(sum(m["encoding"]["gz_bytes"] for m in list(metas.values()) + list(tmetas.values()))), "bytes", "DERIVED", "grid_gistemp_2deg.meta",
        "All grid binaries: anomaly grids, the decadal intro subset and the cell trend grids.")
    # ---- latitude bands, land vs ocean, ranks, year-to-date (data requests from the design)
    def bfit(band):
        s_ = next(x for x in art["trends"]["series"] if x["series_id"] == f"gistemp_band_{band}")
        return next(x for x in s_["fits"] if x["period"] == "1975_latest")
    bands = [b["id"] for b in art["regional"]["bands"]]
    gl75 = tr("gistemp_glb", "1975_latest")["slope_per_decade"]
    put("arctic_to_global_trend_ratio_1975_latest", r(bfit("arctic")["slope_per_decade"] / gl75, 2), "ratio", "DERIVED", "trends",
        "GISTEMP 60N-90N band slope divided by the published GISTEMP global slope, 1975 to the latest complete year.")
    npos = sum(bfit(b)["ci_ar1"][0] > 0 for b in bands)
    put("n_bands_warmed_beyond_uncertainty_1975_latest", int(npos), "count of 5", "DERIVED", "trends", "Bands whose AR(1)-adjusted 95% interval lower bound is above zero.")
    put("band_trends_all_positive_1975_latest", bool(npos == len(bands)), "boolean", "DERIVED", "trends", "True when all five bands have the lower bound of the AR(1)-adjusted interval above zero.")
    ant = next(x for x in art["regional"]["rows"] if x["source"] == "gistemp" and x["band"] == "antarctic")
    vs_ = arr_(ant["valid_area_share"])
    first = next((int(yv) for yv, v_ in zip(yrs, vs_) if np.isfinite(v_) and v_ >= 0.5), None)
    put("south_band_first_year_valid_share_ge_50pct", first if first is not None else "never", "year", "DERIVED", "regional", "First year at least half of the 60S-90S band's area has an annual GISTEMP value.")
    lo_ = art["regional"]["land_ocean"]
    gap = arr_(lo_["gap_land_minus_landocean"]["1951-1980"])
    put("land_minus_landocean_gap_latest_decade", r(np.nanmean(gap[-10:]), 3), "degC", "DERIVED", "regional",
        "Mean of (GISTEMP land-only minus land-ocean) over the last 10 complete years, 1951-1980 baseline. Not an ocean series.")
    for src, sid_ in (("gistemp", "gistemp_glb"), ("hadcrut5", "hadcrut5_glb")):
        a_ = c.annual(sid_, "1951-1980")
        ok_ = np.isfinite(a_)
        rank = int((a_[ok_] > a_[-1]).sum()) + 1
        put(f"latest_year_rank_{src}", {"year": last, "rank": rank, "of": int(ok_.sum())}, "rank (1 = warmest)", "DERIVED", "series_annual")
    for q, key in (("land_surface_temperature_change", "ar6_published_land_2011_2020"), ("ocean_surface_temperature_change", "ar6_published_ocean_2011_2020")):
        o = next(x for x in art["ar6"]["observed_published"] if x["quantity"] == q)
        put(key, {"best_estimate": o["best_estimate_c"], "low": o["assessed_low_c"], "high": o["assessed_high_c"], "page_pdf": o["page_pdf"]}, "degC", "OBSERVED", "ar6",
            "Assessed value in IPCC AR6 WGI SPM A.1.2, relative to 1850-1900.")
    ytd_year = core.Y0 + c.n_months // 12
    for src, sid_, b in (("gistemp", "gistemp_glb", "1951-1980"), ("hadcrut5", "hadcrut5_glb", "1850-1900")):
        m_ = c.monthly(sid_, b)[(ytd_year - core.Y0) * 12:]
        n_ = int(np.isfinite(m_).sum())
        mean_ = r(np.nanmean(m_), 3) if n_ else None
        key = "gistemp_ytd_mean_1951_1980" if src == "gistemp" else "hadcrut5_ytd_mean_1850_1900"
        put(key, {"year": ytd_year, "months": n_, "mean_anomaly": mean_}, "degC", "DERIVED", "series_monthly",
            "Partial-year mean of monthly anomalies (each month rebased by its own calendar-month offset). Not comparable one-to-one with full-year means.")
        put(f"{src}_ytd_months", n_, "months", "OBSERVED", "series_monthly")
    return {"schema_version": SCHEMA_VERSION, "tags": {"facts": "OBSERVED/DERIVED"}, "facts": F}


# --------------------------------------------------------------------------------------------- meta

def meta(c, ledger) -> dict:
    man = json.loads((MANIFESTS / "raw_manifest.json").read_text())
    sources = {}
    for sid, (name, ver, nb, tag, lic, cite) in SOURCE_INFO.items():
        m = man[sid]
        sources[sid] = {"name": name, "version": ver, "url": m["url"], "license_note": lic, "citation": cite, "bytes": m["bytes"], "sha256": m["sha256"],
                        "last_modified": m.get("last_modified"), "retrieved_at": m["retrieved_at"], "native_baseline": nb, "tag": tag}
    files = {}
    for p in sorted(PUBLIC.iterdir()):
        if p.name == "meta.json" or p.suffix == ".tmp":
            continue
        b = p.read_bytes()
        files[p.name] = {"bytes": len(b), "gzip_bytes": len(b) if p.name.endswith(".gz") else len(gzip.compress(b, 9, mtime=0)), "sha256": hashlib.sha256(b).hexdigest()}
    limits = [
        "Anomalies, not absolute temperatures; baselines differ between products and are always rebased explicitly (see series_annual.conversions).",
        "GISTEMP smooths station anomalies up to 1200 km, so its pre-1950 and Arctic coverage is higher than HadCRUT5's; that is the source's smoothing, not ours. Missing cells stay missing.",
        "Land-only vs land-ocean compares two GISTEMP products; no ocean-only series is published in the files used.",
        "Annual-mean anomalies are not extreme-event data: the extremes metric is the area share of unusually warm or cold ANNUAL means.",
        "Trend intervals assume AR(1) residuals (or HAC); real climate noise is more complex. The simulation in validation.json shows coverage on synthetic AR(1) noise only.",
        "Change-point results are EXPLORATORY; a smooth curved trend also produces apparent breaks.",
        "CO2 vs temperature is association only; both series trend, so level correlation is inflated by construction.",
        "AR6 ranges are published IPCC assessed values for 20-year averages relative to 1850-1900, not our forecasts; the AR6 licence page could not be verified.",
        "Grids are quantized to 0.1 C Int8 (max error 0.05 C) and annual cell means require 9 of 12 valid months.",
        "Berkeley Earth was not used (CC BY-NC); no third independent record is shown.",
    ]
    return {"schema_version": SCHEMA_VERSION, "tags": {"sources": "OBSERVED", "artifact_files": "DERIVED", "limitations": "DERIVED"},
            "pipeline_version": PIPELINE_VERSION, "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"), "sources": sources,
            "baselines": list(BASELINES),
            "baseline_notes": "GISTEMP native 1951-1980; HadCRUT5 native 1961-1990; AR6 1850-1900. Offered baselines: 1850-1900 (HadCRUT5 only), 1951-1980, 1991-2020. Every conversion is recorded; no series is silently mixed.",
            "artifact_files": files,
            "tag_legend": {"OBSERVED": "published by the source analysis (instrument-based, as released)", "DERIVED": "our arithmetic on observed data (rebasing, averages, trends)",
                           "PREDICTED": "IPCC assessed projection, quoted as published, not produced here", "SIMULATED": "synthetic-noise method validation only", "SYNTHETIC": "unused"},
            "limitations": limits}
