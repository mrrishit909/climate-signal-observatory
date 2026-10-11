"""interim -> in-memory artifact dicts (series, trends, regional, extremes, changepoints, agreement, co2, ar6, grids)."""
from __future__ import annotations

import csv
import gzip
import hashlib
import math

import numpy as np

from analytics import core, stats
from pipelines.common import RAW, BASE_YEARS, BASELINES, INTERIM, MIN_MONTHS_CELL_YEAR, MIN_REF_SHARE, REFERENCE, SCHEMA_VERSION
from analytics.core import Y0, to_list

SERIES = [  # id, label, source, region, domain, native baseline
    ("gistemp_glb", "GISTEMP global land-ocean", "gistemp", "global", "land_ocean", "1951-1980"),
    ("gistemp_nh", "GISTEMP Northern Hemisphere", "gistemp", "nh", "land_ocean", "1951-1980"),
    ("gistemp_sh", "GISTEMP Southern Hemisphere", "gistemp", "sh", "land_ocean", "1951-1980"),
    ("gistemp_glb_landonly", "GISTEMP global land stations only", "gistemp", "global", "land_only", "1951-1980"),
    ("hadcrut5_glb", "HadCRUT5 global", "hadcrut5", "global", "land_ocean", "1961-1990"),
    ("hadcrut5_nh", "HadCRUT5 Northern Hemisphere", "hadcrut5", "nh", "land_ocean", "1961-1990"),
    ("hadcrut5_sh", "HadCRUT5 Southern Hemisphere", "hadcrut5", "sh", "land_ocean", "1961-1990"),
]
SRC_NAME = {"gistemp": "NASA GISTEMP v4", "hadcrut5": "HadCRUT5 5.2.0.0"}
RAW_NE = RAW / "natural_earth"


def tagged(d: dict, tags: dict) -> dict:
    return {"schema_version": SCHEMA_VERSION, "tags": tags, **d}


class Ctx:
    """Loads interim data once and caches rebased series."""

    def __init__(self):
        mz = np.load(INTERIM / "monthly.npz")
        self.m = {k: mz[k] for k in mz.files}
        self.n_months = int(mz["n_months"])
        self.last_year = core.last_complete_year(self.n_months)
        self.years = np.arange(Y0, self.last_year + 1)
        gz = np.load(INTERIM / "annual_grids.npz")
        self.g = {k: gz[k] for k in gz.files}
        self._monthly: dict = {}
        self._annual: dict = {}
        self.conversions: list = []
        for sid, label, src, region, domain, native in SERIES:
            raw = self.m[sid]
            for b in BASELINES:
                r = core.rebase_monthly(raw, b)
                self._monthly[(sid, b)] = r[0] if r else None
                if r:
                    self._annual[(sid, b)] = core.annual_from_monthly(r[0], self.last_year)
                    first = int(np.argmax(np.isfinite(raw))) // 12 + Y0
                    self.conversions.append({
                        "series": sid, "from": native, "to": b, "offset_c": round(float(r[1].mean()), 4),
                        "monthly_offsets_c": [round(float(v), 4) for v in r[1]], "n_years_per_month": [int(c) for c in r[2]],
                        "method": f"per calendar month, mean of the native monthly anomaly over {b}; rebased = native - offset; annual value = mean of 12 rebased months"})
            # native annual too (for trends: baseline-independent)
        self.id_label = {s[0]: s[1] for s in SERIES}

    def annual(self, sid: str, b: str):
        return self._annual.get((sid, b))

    def monthly(self, sid: str, b: str):
        return self._monthly.get((sid, b))

    def native_annual(self, sid: str):
        nat = {s[0]: s[5] for s in SERIES}[sid]
        key = (sid, nat) if (sid, nat) in self._annual else None
        if key:
            return self._annual[key]
        # HadCRUT5 native 1961-1990 is not one of our three baselines: use 1951-1980 (trend slope is shift invariant)
        return self._annual[(sid, "1951-1980")]


def series_annual(c: Ctx) -> dict:
    out = []
    for sid, label, src, region, domain, native in SERIES:
        vals, lo, hi = {}, {}, {}
        for b in BASELINES:
            a = c.annual(sid, b)
            if a is None or not np.isfinite(a).any():
                continue
            vals[b] = to_list(a)
        if src == "hadcrut5":
            ann = c.m[sid + "_annfile"][:len(c.years)]
            alo = c.m[sid + "_annfile_lo"][:len(c.years)]
            ahi = c.m[sid + "_annfile_hi"][:len(c.years)]
            raw_ann = core.annual_from_monthly(c.m[sid], c.last_year)  # native monthly mean (1961-1990)
            for b in vals:
                off = raw_ann - c.annual(sid, b)  # per-year offset (constant up to rounding of NaNs)
                lo[b] = to_list(alo - off)
                hi[b] = to_list(ahi - off)
        years_ok = np.isfinite(c.annual(sid, "1951-1980"))
        out.append({"id": sid, "label": label, "source": SRC_NAME[src], "region": region, "domain": domain, "native_baseline": native,
                    "first_year": int(c.years[years_ok][0]), "last_year": int(c.years[years_ok][-1]), "values": vals,
                    "ci_lo": lo or None, "ci_hi": hi or None,
                    "ci_note": ("HadCRUT5 published 95% interval (ensemble of measurement, coverage and bias uncertainty), shifted with the anomaly; "
                                "the uncertainty of the baseline mean itself is NOT added") if src == "hadcrut5" else None})
    return tagged({"years": [int(y) for y in c.years], "baselines": list(BASELINES), "partial_year_excluded": c.n_months // 12 + Y0 if c.n_months % 12 else None,
                   "series": out, "conversions": c.conversions},
                  {"years": "DERIVED", "series": "OBSERVED/DERIVED", "conversions": "DERIVED", "baselines": "DERIVED"})


def series_monthly(c: Ctx) -> dict:
    out = []
    for sid in ("gistemp_glb", "hadcrut5_glb"):
        vals, lo, hi = {}, {}, {}
        for b in BASELINES:
            r = c.monthly(sid, b)
            if r is None:
                continue
            vals[b] = to_list(r)
            if sid.startswith("hadcrut5"):
                off = c.m[sid] - r
                lo[b] = to_list(c.m[sid + "_lo"] - off)
                hi[b] = to_list(c.m[sid + "_hi"] - off)
        lab = c.id_label[sid]
        out.append({"id": sid, "label": lab, "source": SRC_NAME[sid.split("_")[0]], "native_baseline": "1951-1980" if sid.startswith("gistemp") else "1961-1990",
                    "values": vals, "ci_lo": lo or None, "ci_hi": hi or None})
    return tagged({"start": f"{Y0}-01", "n_months": c.n_months, "baselines": list(BASELINES), "series": out},
                  {"series": "OBSERVED/DERIVED", "baselines": "DERIVED"})


PERIODS = [("full", None), ("1880_latest", 1880), ("1900_latest", 1900), ("1951_latest", 1951), ("1975_latest", 1975), ("1991_latest", 1991)]


def trends(c: Ctx, n_boot: int = 500, reg: dict | None = None) -> dict:
    last = c.last_year
    periods = [{"id": "1850_latest", "start": 1850, "end": last}] + [{"id": pid, "start": s, "end": last} for pid, s in PERIODS if s]
    res = []

    def fits_for(a, min_share):
        fits = []
        for p in periods:
            sel = (c.years >= p["start"]) & (c.years <= p["end"])
            x, y = c.years[sel].astype(float), a[sel]
            if np.isfinite(y).sum() < math.ceil(min_share * len(y)) or np.isfinite(y).sum() < 10:
                continue
            t = stats.ols_trend(x, y)
            span = p["end"] - p["start"]
            fits.append({"period": p["id"], "start": p["start"], "end": p["end"], "n": t["n"], "slope_per_decade": round(t["slope"] * 10, 4),
                         "intercept_c": round(t["intercept"], 4), "r2": round(t["r2"], 4), "lag1_autocorr_resid": round(t["r1"], 3), "n_eff": round(t["n_eff"], 1),
                         "ci_naive": [round(v * 10, 4) for v in t["ci_naive"]], "ci_ar1": [round(v * 10, 4) for v in t["ci_ar1"]],
                         "ci_hac": [round(v * 10, 4) for v in t["ci_hac"]], "total_change_c": round(t["slope"] * span, 3),
                         "total_change_ci_ar1": [round(v * span, 3) for v in t["ci_ar1"]]})
        return fits

    for sid, label, *_ in SERIES:
        res.append({"series_id": sid, "label": label, "fits": fits_for(c.native_annual(sid), 1.0)})
    if reg is not None:  # latitude-band series (observed band-years only; at least 80% of the period's years needed)
        names = {b["id"]: b["label"] for b in reg["bands"]}
        for row in reg["rows"]:
            a = np.array([np.nan if v is None else v for v in row["values"]["1951-1980"]])
            res.append({"series_id": f"{row['source']}_band_{row['band']}", "label": f"{SRC_NAME[row['source']]}, {names[row['band']]}", "fits": fits_for(a, 0.8)})
    loess, rolling = [], []
    for sid in ("gistemp_glb", "hadcrut5_glb"):
        a = c.native_annual(sid)
        ok = np.isfinite(a)
        x, y = c.years[ok].astype(float), a[ok]
        fit, lo, hi, frac = stats.loess_band(x, y, 30.0, n_boot, 10, seed=20260810 + len(sid))
        full = lambda v: np.where(np.isin(c.years, x), np.interp(c.years, x, v), np.nan)
        F, L, H = full(fit), full(lo), full(hi)
        nat = a  # fit lives on the same (native-annual) scale as a; shifting by offset maps to each baseline
        by = {}
        for b in BASELINES:
            ab = c.annual(sid, b)
            if ab is None:
                continue
            off = np.nanmean(nat - ab)  # constant (all years valid share one monthly offset set)
            by[b] = (F - off, L - off, H - off)
        loess.append({"series_id": sid, "frac": round(frac, 4), "span_years": 30.0, "n_boot": n_boot, "block_len": 10, "years": [int(v) for v in c.years],
                      "fit": {b: to_list(v[0]) for b, v in by.items()}, "band_lo": {b: to_list(v[1]) for b, v in by.items()},
                      "band_hi": {b: to_list(v[2]) for b, v in by.items()}})
        e, s, l, h = stats.rolling_trends(x, y, 30)
        rolling.append({"series_id": sid, "window_years": 30, "end_year": e, "slope_per_decade": [round(v, 4) for v in s],
                        "ci_ar1_lo": [round(v, 4) for v in l], "ci_ar1_hi": [round(v, 4) for v in h]})
    method = {"primary_ci": "ci_ar1", "naive": "OLS slope CI assuming independent residuals (too narrow for temperature series)",
              "ar1_adjustment": "Effective sample size n_eff = n (1 - r1) / (1 + r1) from the lag-1 autocorrelation r1 of the OLS residuals (Santer et al. 2000), t distribution with n_eff - 2 df",
              "hac": "Newey-West heteroskedasticity and autocorrelation consistent standard error, Bartlett kernel, lags = floor(4 (n/100)^(2/9)), small-sample factor n/(n-2), t distribution",
              "loess": "Classic LOESS (tricube, local linear, no robustness iterations), span 30 years, statsmodels lowess",
              "loess_band": "Pointwise 2.5-97.5 percentile band of 500 moving-block (10 year) residual bootstrap refits; reflects smoother variability under stationary noise, not measurement uncertainty"}
    return tagged({"unit": "degC_per_decade", "method": method, "periods": periods, "series": res, "loess": loess, "rolling": rolling},
                  {"series": "DERIVED", "loess": "DERIVED", "rolling": "DERIVED", "method": "DERIVED"})


def _bands():
    # edges are multiples of 10 degrees so they coincide with whole cells on both the 2 degree and the 5 degree grid
    edges = [("arctic", "Northern high latitudes, 60N to 90N", 60.0, 90.0), ("n_mid", "Northern mid-latitudes, 30N to 60N", 30.0, 60.0),
             ("low", "Low latitudes, 30S to 30N", -30.0, 30.0), ("s_mid", "Southern mid-latitudes, 60S to 30S", -60.0, -30.0),
             ("antarctic", "Southern high latitudes, 90S to 60S", -90.0, -60.0)]
    return [{"id": i, "label": l, "lat_min": a, "lat_max": b, "area_share_of_globe": round((math.sin(math.radians(b)) - math.sin(math.radians(a))) / 2, 4)}
            for i, l, a, b in edges]


MIN_VALID_AREA = 0.4


def grid_set(c: Ctx):
    return {"gistemp": (c.g["g_ann"].astype(np.float64), c.g["g_years"], c.g["g_lat"], c.g["g_lon"]),
            "hadcrut5": (c.g["h_ann"].astype(np.float64), c.g["h_years"], c.g["h_lat"], c.g["h_lon"])}


def _onto_axis(c: Ctx, years, arr):
    """Place per-year array (first dim = years) on the shared annual axis with NaN for years the source lacks."""
    out = np.full((len(c.years),) + arr.shape[1:], np.nan)
    for i, y in enumerate(years):
        if y - Y0 < len(c.years):
            out[y - Y0] = arr[i]
    return out


def regional(c: Ctx) -> dict:
    bands = _bands()
    rows = []
    gs = grid_set(c)
    for src, (ann, yrs, lat, lon) in gs.items():
        w2 = np.repeat(core.lat_weights(lat)[:, None], len(lon), 1)
        for bnd in bands:
            lat_m = (lat >= bnd["lat_min"]) & (lat < bnd["lat_max"]) if bnd["lat_max"] < 90 else (lat >= bnd["lat_min"])
            vals = {}
            share_native = None
            for b in ("1951-1980", "1991-2020"):
                rb, _ = core.rebase_grid(ann, yrs, b)
                sub = rb[:, lat_m, :].reshape(len(yrs), -1)
                w = w2[lat_m].reshape(-1)
                mean, share = core.weighted_mean(sub, w, MIN_VALID_AREA)
                vals[b] = to_list(_onto_axis(c, yrs, mean))
            nat = ann[:, lat_m, :].reshape(len(yrs), -1)
            _, share = core.weighted_mean(nat, w2[lat_m].reshape(-1))
            rows.append({"source": src, "band": bnd["id"], "values": vals, "valid_area_share": to_list(_onto_axis(c, yrs, share), 3),
                         "native_baseline": "1951-1980" if src == "gistemp" else "1961-1990"})
    # land vs land-ocean (GISTEMP stations-only series vs land-ocean)
    lo = {}
    ob = {}
    for b in ("1951-1980", "1991-2020"):
        L, LO = c.annual("gistemp_glb_landonly", b), c.annual("gistemp_glb", b)
        lo[b] = to_list(L), to_list(LO), to_list(L - LO)
    ar6 = {r["quantity"]: r for r in csv.DictReader(open(REFERENCE / "ar6_observed.csv"))}
    def pub(q):
        r = ar6[q]
        return {"best_estimate_c": float(r["best_estimate_c"]), "low_c": float(r["assessed_low_c"]), "high_c": float(r["assessed_high_c"]),
                "baseline": r["baseline"], "source_page_pdf": int(r["source_page_pdf"])}
    land_ocean = {"note": ("GISTEMP 'land-only' is the meteorological-station series (Ts) and 'land-ocean' is the blended series (Ts+dSST). The gap is NOT an ocean series: "
                           "neither product used here publishes an ocean-only index, and the land series covers fewer cells. AR6 values are shown only as published context (1850-1900 baseline, different datasets)."),
                  "years": [int(y) for y in c.years], "land_only": {b: v[0] for b, v in lo.items()}, "land_ocean": {b: v[1] for b, v in lo.items()},
                  "gap_land_minus_landocean": {b: v[2] for b, v in lo.items()},
                  "ar6_land_2011_2020": pub("land_surface_temperature_change"), "ar6_ocean_2011_2020": pub("ocean_surface_temperature_change")}
    return tagged({"years": [int(y) for y in c.years], "baselines": ["1951-1980", "1991-2020"], "bands": bands, "rows": rows, "land_ocean": land_ocean,
                   "min_valid_area_share": MIN_VALID_AREA,
                   "method": ("Cell annual anomalies are rebased per cell (offset = cell mean of annual values over the baseline, >= 80% of reference years required), "
                              "then averaged with cos(latitude) weights over the observed cells of the band. A band-year with < 40% of its area observed is null. Band edges are multiples of 10 degrees (whole cells on both grids).")},
                  {"bands": "DERIVED", "rows": "DERIVED", "land_ocean": "OBSERVED/DERIVED"})


def extremes(c: Ctx) -> dict:
    metrics = []
    gs = grid_set(c)
    for src, (ann, yrs, lat, lon) in gs.items():
        w = np.repeat(core.lat_weights(lat)[:, None], len(lon), 1)
        for refb, tag in (("1951-1980", "p1951"), ("1991-2020", "p1991")):
            b0, b1 = BASE_YEARS[refb]
            sel = (yrs >= b0) & (yrs <= b1)
            ref = ann[sel]
            nvalid = np.isfinite(ref).sum(0)
            has = nvalid >= math.ceil(MIN_REF_SHARE * (b1 - b0 + 1))
            with np.errstate(all="ignore"):
                p95 = np.where(has, np.nanpercentile(ref, 95, 0), np.nan)
                p05 = np.where(has, np.nanpercentile(ref, 5, 0), np.nan)
            ok = np.isfinite(ann) & has[None]
            wh = (w * has).sum()
            def share(mask):
                num = (mask & ok) * w
                den = ok * w
                return _onto_axis(c, yrs, num.sum((1, 2)) / np.maximum(den.sum((1, 2)), 1e-12)), _onto_axis(c, yrs, den.sum((1, 2)) / wh)
            hi, vs = share(ann > p95[None])
            in_ref = (c.years >= b0) & (c.years <= b1)
            metrics.append({"id": f"{src}_above_p95_{refb}", "label": f"Share of area above the local 95th percentile of {refb}", "source": src, "reference": refb,
                            "area_share": to_list(hi, 4), "expected_share_in_reference": round(float(np.nanmean(hi[in_ref])), 4), "valid_area_share": to_list(vs, 4), "n_cells_with_reference": int(has.sum())})
            if refb == "1951-1980":
                lw, _ = share(ann < p05[None])
                metrics.append({"id": f"{src}_below_p05_{refb}", "label": f"Share of area below the local 5th percentile of {refb}", "source": src, "reference": refb,
                                "area_share": to_list(lw, 4), "expected_share_in_reference": round(float(np.nanmean(lw[in_ref])), 4), "valid_area_share": to_list(vs, 4), "n_cells_with_reference": int(has.sum())})
                rb, _ = core.rebase_grid(ann, yrs, "1951-1980")
                for th in (1.0, 2.0):
                    m_, vs2 = share(rb >= th)
                    metrics.append({"id": f"{src}_ge_{int(th)}C_{refb}", "label": f"Share of area at least +{th:.0f} C above the {refb} cell mean", "source": src, "reference": refb,
                                    "area_share": to_list(m_, 4), "expected_share_in_reference": None, "valid_area_share": to_list(vs2, 4), "n_cells_with_reference": int(has.sum())})
    return tagged({"definition": ("For each grid cell, the 95th (5th) percentile of its own annual-mean anomalies over the reference period is the local threshold. "
                                  "The metric is the cos(lat)-weighted share of observed area whose annual-mean anomaly exceeds (falls below) it. "
                                  "In the reference period itself the in-sample share is about 6.7% (2 of 30 reference years lie above the interpolated 95th percentile), which is the baseline to compare against. These are ANNUAL-MEAN anomalies, not daily or heatwave extremes."),
                   "reference_period": "1951-1980", "years": [int(y) for y in c.years], "min_reference_years": math.ceil(MIN_REF_SHARE * 30), "metrics": metrics},
                  {"metrics": "DERIVED", "definition": "DERIVED"})


def changepoints(c: Ctx, n_boot: int = 200) -> dict:
    results = []
    min_seg = 15
    for sid in ("gistemp_glb", "hadcrut5_glb"):
        a = c.native_annual(sid)
        ok = np.isfinite(a)
        t = c.years[ok].astype(float)
        y = a[ok]
        n = len(y)
        cand, best = [], {}
        for k in range(0, 4):
            step = 1 if k <= 2 else 2
            ps = stats.PiecewiseSearch(t, k, min_seg, step)
            br, sse, beta = ps.fit(y)
            fitv = ps.fitted(beta, br)
            e = y - fitv
            r1 = float((e[1:] * e[:-1]).sum() / (e ** 2).sum())
            bic, n_eff = stats.adj_bic(sse, n, k, r1)
            best[k] = (ps, br, sse, beta, fitv, bic)
            cand.append({"k": k, "breaks": [int(b) for b in br], "sse": round(sse, 5), "bic": round(bic, 3),
                         "slopes_per_decade": [round(s * 10, 4) for s in stats.segment_slopes(beta)]})
        ksel = min(best, key=lambda k: best[k][5])
        ps, br, sse, beta, fitv, _ = best[ksel]
        ci = []
        if ksel:
            rng = np.random.default_rng(7 + ksel + len(sid))
            e = y - fitv
            bb = np.empty((n_boot, ksel))
            for i in range(n_boot):
                ys = fitv + stats.block_resample(e, 10, rng)
                bb[i] = ps.fit(ys)[0]
            ci = [[float(np.percentile(bb[:, j], 2.5)), float(np.percentile(bb[:, j], 97.5))] for j in range(ksel)]
        fit_full = np.full(len(c.years), np.nan)
        fit_full[ok] = fitv
        by = {}
        for b in BASELINES:
            ab = c.annual(sid, b)
            if ab is not None:
                by[b] = to_list(fit_full - np.nanmean(a - ab))
        results.append({"series_id": sid, "start": int(t[0]), "end": int(t[-1]), "candidates": cand, "selected_k": int(ksel),
                        "selected_breaks": [int(b) for b in br], "selected_slopes_per_decade": [round(s * 10, 4) for s in stats.segment_slopes(beta)],
                        "break_ci_95": ci, "fit": by, "years": [int(v) for v in c.years]})
    return tagged({"status": "EXPLORATORY",
                   "caveat": ("Exploratory description of where a straight-line fit bends, not a detection of regime shifts. Break years depend on the chosen minimum segment length, "
                              "the grid step and autocorrelation; the intervals are bootstrap intervals conditional on the selected model. Do not read a break as a cause. When the selected k equals the search maximum (3) the data would accept even more breaks, which is a sign of a smooth, curved trend rather than of discrete shifts."),
                   "method": {"model": "continuous piecewise-linear (hinge) regression on annual global anomalies, breaks found by exhaustive least-squares search",
                              "min_segment_years": min_seg, "max_breaks": 3,
                              "selection": "AR(1)-adjusted BIC: -2 logL scaled to n_eff = n (1 - r1) / (1 + r1) of each model's own residuals; penalty (2 + 2k + 1) ln(n_eff). k = 3 searched on a 2-year grid, k <= 2 on a 1-year grid",
                              "n_boot": n_boot, "block_len": 10,
                              "autocorrelation_note": "Plain BIC over-selects breaks for positively autocorrelated residuals; the n_eff adjustment is a mitigation, not a cure."},
                   "results": results}, {"results": "DERIVED", "status": "DERIVED", "caveat": "DERIVED"})


# ------------------------------------------------------------------------------------------------ agreement

def _corr(a, b):
    m = np.isfinite(a) & np.isfinite(b)
    return float(np.corrcoef(a[m], b[m])[0, 1])


def _box(ann, w, fy, fx, min_share=0.5):
    """(year, lat, lon) -> (year, 18, 36) cos-weighted box means of observed cells; box needs >= min_share of its weight observed."""
    n, nl, no = ann.shape
    a = ann.reshape(n, 18, fy, 36, fx)
    ww = np.broadcast_to(w[None, :, None, None, None].reshape(1, 18, fy, 1, 1), a.shape) if False else w.reshape(1, 18, fy, 1, 1) * np.ones((1, 1, 1, 36, fx))
    m = np.isfinite(a)
    num = np.where(m, a, 0.0) * ww
    den = (m * ww).sum((2, 4))
    tot = ww.sum((2, 4)) * np.ones((n, 1, 1))
    with np.errstate(all="ignore"):
        mean = num.sum((2, 4)) / den
    return np.where(den / tot >= min_share, mean, np.nan)


def agreement(c: Ctx) -> dict:
    yrs = c.years
    common = (yrs >= 1880)
    st, ga, ha, diffs = {}, {}, {}, {}
    for b in ("1951-1980", "1991-2020"):
        g, h = c.annual("gistemp_glb", b), c.annual("hadcrut5_glb", b)
        d = g - h
        ga[b], ha[b], diffs[b] = to_list(g), to_list(h), to_list(d)
        m = common & np.isfinite(d)
        dd = d[m]
        tg = stats.ols_trend(yrs[m].astype(float), g[m])["slope"] * 10
        th = stats.ols_trend(yrs[m].astype(float), h[m])["slope"] * 10
        i = int(np.argmax(np.abs(dd)))
        st[b] = {"n": int(m.sum()), "mean_diff": round(float(dd.mean()), 4), "rmsd": round(float(np.sqrt((dd ** 2).mean())), 4),
                 "max_abs_diff": round(float(np.abs(dd[i])), 4), "max_abs_diff_year": int(yrs[m][i]), "corr": round(_corr(g[m], h[m]), 5),
                 "corr_first_differences": round(_corr(np.diff(g[m]), np.diff(h[m])), 4),
                 "trend_gistemp_per_decade": round(float(tg), 4), "trend_hadcrut5_per_decade": round(float(th), 4), "trend_gap_per_decade": round(float(tg - th), 4)}
    d = c.annual("gistemp_glb", "1951-1980") - c.annual("hadcrut5_glb", "1951-1980")
    dec = []
    for dc in range(1880, c.last_year + 1, 10):
        sel = (yrs >= dc) & (yrs < dc + 10) & np.isfinite(d)
        if sel.any():
            dec.append({"decade": dc, "mean_diff": round(float(d[sel].mean()), 4), "n": int(sel.sum())})
    # coverage-matched: 10-degree boxes, both on 1951-1980 cell baseline, only boxes observed in BOTH sources that year
    gs = grid_set(c)
    boxes = {}
    for src, fy in (("gistemp", 5), ("hadcrut5", 2)):
        ann, gy, lat, lon = gs[src]
        rb, _ = core.rebase_grid(ann, gy, "1951-1980")
        bx = _box(rb, core.lat_weights(lat), fy, fy)
        boxes[src] = _onto_axis(c, gy, bx)
    bw = np.cos(np.deg2rad(np.arange(-85, 90, 10.0)))[:, None] * np.ones((1, 36))
    both = np.isfinite(boxes["gistemp"]) & np.isfinite(boxes["hadcrut5"])
    def gm(x):
        return np.where(both.any((1, 2)), (np.where(both, x, 0) * bw).sum((1, 2)) / (both * bw).sum((1, 2)).clip(1e-9), np.nan)
    gc, hc = gm(boxes["gistemp"]), gm(boxes["hadcrut5"])
    dc_ = gc - hc
    m = common & np.isfinite(dc_)
    cm = {"box_deg": 10, "min_valid_share_in_box": 0.5, "n_common_boxes_mean": round(float(both[common].sum((1, 2)).mean()), 1), "baseline": "1951-1980",
          "gistemp_common": to_list(gc), "hadcrut5_common": to_list(hc), "diff": to_list(dc_),
          "rmsd": round(float(np.sqrt((dc_[m] ** 2).mean())), 4), "corr": round(_corr(gc[m], hc[m]), 5), "mean_diff": round(float(dc_[m].mean()), 4),
          "note": ("Both sources are rebased per cell to 1951-1980, averaged into 10 degree boxes (box needs >= 50% of its area observed) and compared only over boxes observed by BOTH in that year, "
                   "so differences in spatial coverage are removed. What remains is analysis-method and input-data disagreement.")}
    hem = []
    for r in ("nh", "sh"):
        dd = c.annual(f"gistemp_{r}", "1951-1980") - c.annual(f"hadcrut5_{r}", "1951-1980")
        m = common & np.isfinite(dd)
        hem.append({"region": r, "baseline": "1951-1980", "rmsd": round(float(np.sqrt((dd[m] ** 2).mean())), 4),
                    "corr": round(_corr(c.annual(f"gistemp_{r}", "1951-1980")[m], c.annual(f"hadcrut5_{r}", "1951-1980")[m]), 5), "mean_diff": round(float(dd[m].mean()), 4)})
    gm_, hm_ = c.monthly("gistemp_glb", "1951-1980"), c.monthly("hadcrut5_glb", "1951-1980")
    md = gm_ - hm_
    mm = np.isfinite(md)
    mon = {"baseline": "1951-1980", "start": f"{Y0}-01", "diff": to_list(md), "rmsd": round(float(np.sqrt((md[mm] ** 2).mean())), 4), "corr": round(_corr(gm_[mm], hm_[mm]), 5)}
    return tagged({"baseline_used": "1951-1980", "common_period": [1880, c.last_year], "years": [int(y) for y in yrs],
                   "annual": {"gistemp": ga, "hadcrut5": ha, "diff_gistemp_minus_hadcrut5": diffs, "stats": st}, "by_decade": dec,
                   "coverage_matched": cm, "hemispheres": hem, "monthly": mon},
                  {"annual": "DERIVED", "by_decade": "DERIVED", "coverage_matched": "DERIVED", "hemispheres": "DERIVED", "monthly": "DERIVED"})


# ------------------------------------------------------------------------------------------------ co2

def co2(c: Ctx) -> dict:
    ny = len(c.years)
    def ann(key):
        out = np.full(ny, np.nan)
        for i in range(ny):
            v = c.m[key][i * 12:(i + 1) * 12]
            if len(v) == 12 and np.isfinite(v).all():
                out[i] = v.mean()
        return out
    def flags(key, valkey):
        out = []
        for i in range(ny):
            v = c.m[valkey][i * 12:(i + 1) * 12]
            out.append(int(c.m[key][i * 12:(i + 1) * 12].sum()) if np.isfinite(v).any() else None)
        return out
    mlo, gl = ann("co2_mlo"), ann("co2_gl")
    temp = {b: c.annual("gistemp_glb", b) for b in ("1951-1980", "1991-2020")}
    t = temp["1951-1980"]
    ok = np.isfinite(gl) & np.isfinite(t)
    x, T = gl[ok], t[ok]
    yrs = c.years[ok].astype(float)
    lv = stats.ols_trend(x, T)
    d = stats.ols_trend(np.diff(x), np.diff(T))
    # detrended: remove each series' own linear time trend
    dx = x - np.polyval(np.polyfit(yrs, x, 1), yrs)
    dT = T - np.polyval(np.polyfit(yrs, T, 1), yrs)
    assoc = {"co2_series_used": "NOAA GML global marine-surface monthly means (co2_mm_gl), annual mean of complete years; no interpolated months", "years_used": [int(v) for v in yrs],
             "exclusion_rule": f"Years need 12 monthly CO2 values and a GISTEMP global annual value. The Mauna Loa series is shown for context but not used: {int(c.m['co2_mlo_flag'].sum())} of its {int(np.isfinite(c.m['co2_mlo']).sum())} monthly rows carry NOAA's negative-sdev flag (interpolated or pre-daily record).",
             "levels": {"n": lv["n"], "corr": round(float(np.corrcoef(x, T)[0, 1]), 4), "slope_c_per_ppm": round(lv["slope"], 5),
                        "slope_ci_ar1": [round(v, 5) for v in lv["ci_ar1"]], "r2": round(lv["r2"], 4), "lag1_autocorr_resid": round(lv["r1"], 3)},
             "first_differences": {"n": d["n"], "corr": round(float(np.corrcoef(np.diff(x), np.diff(T))[0, 1]), 4), "slope_c_per_ppm": round(d["slope"], 5),
                                   "slope_ci_ar1": [round(v, 5) for v in d["ci_ar1"]]},
             "detrended": {"n": len(x), "corr": round(float(np.corrcoef(dx, dT)[0, 1]), 4)},
             "interpretation": (f"ASSOCIATION ONLY. Both series trend upward, so the level correlation ({np.corrcoef(x, T)[0, 1]:.2f}) is high largely by construction and says nothing on its own about cause. "
                                f"Year-to-year changes correlate far less ({np.corrcoef(np.diff(x), np.diff(T))[0, 1]:.2f}, slope interval {'includes' if d['ci_ar1'][0] <= 0 <= d['ci_ar1'][1] else 'excludes'} zero) because other drivers such as El Nino dominate annual variability; "
                                f"after removing each series' linear trend the correlation is {np.corrcoef(dx, dT)[0, 1]:.2f}. "
                                "The physical attribution rests on radiative physics and the IPCC assessment, not on this regression.")}
    return tagged({"association_only": True, "note": "CO2 and temperature are displayed side by side. No causal or predictive model is fitted.",
                   "sentinels": "NOAA MLO flags interpolated or no-daily-data months with sdev < 0 / unc < 0 / ndays = -1 (the file header: 'Missing months have been interpolated, for NOAA data indicated by negative stdev and uncertainty'). The deseasonalized column is a real value in those rows. The global file has no flagged rows.",
                   "mlo_site_note": "Mauna Loa observations were suspended 2022-11-29 to 2023-07 after the eruption and resumed at the Maunakea Observatories about 21 miles north (NOAA file header). Months in the gap are interpolated and flagged.",
                   "annual_years": [int(y) for y in c.years], "mlo_annual_ppm": to_list(mlo, 2), "mlo_interpolated_months": flags("co2_mlo_flag", "co2_mlo"),
                   "global_annual_ppm": to_list(gl, 2), "temperature_annual": {b: to_list(v) for b, v in temp.items()}, "temperature_series_id": "gistemp_glb",
                   "monthly": {"start": f"{Y0}-01", "mlo_ppm": to_list(c.m["co2_mlo"], 2), "mlo_deseasonalized_ppm": to_list(c.m["co2_mlo_des"], 2),
                               "mlo_interpolated": [bool(v) if np.isfinite(c.m["co2_mlo"][i]) else None for i, v in enumerate(c.m["co2_mlo_flag"])],
                               "global_ppm": to_list(c.m["co2_gl"], 2)},
                   "association": assoc},
                  {"annual_years": "DERIVED", "mlo_annual_ppm": "OBSERVED/DERIVED", "global_annual_ppm": "OBSERVED/DERIVED", "temperature_annual": "OBSERVED/DERIVED",
                   "monthly": "OBSERVED", "association": "DERIVED", "mlo_interpolated_months": "OBSERVED"})


# ------------------------------------------------------------------------------------------------ AR6

def ar6(c: Ctx) -> dict:
    rows = list(csv.DictReader(open(REFERENCE / "ar6_spm1.csv")))
    labels = {"SSP1-1.9": "Very low GHG emissions", "SSP1-2.6": "Low GHG emissions", "SSP2-4.5": "Intermediate GHG emissions",
              "SSP3-7.0": "High GHG emissions", "SSP5-8.5": "Very high GHG emissions"}
    scen = []
    for sid, lab in labels.items():
        rs = [r for r in rows if r["scenario"] == sid]
        scen.append({"id": sid, "label": sid, "ghg_description": lab, "rows": [
            {"period": r["period"], "best_estimate_c": float(r["best_estimate_c"]), "very_likely_low_c": float(r["very_likely_low_c"]),
             "very_likely_high_c": float(r["very_likely_high_c"])} for r in rs]})
    obs = [{"quantity": r["quantity"], "period": r["period"], "best_estimate_c": float(r["best_estimate_c"]), "assessed_low_c": float(r["assessed_low_c"]),
            "assessed_high_c": float(r["assessed_high_c"]), "baseline": r["baseline"], "page_pdf": int(r["source_page_pdf"])}
           for r in csv.DictReader(open(REFERENCE / "ar6_observed.csv"))]
    h = c.annual("hadcrut5_glb", "1850-1900")
    yrs = c.years
    mean = lambda a, b: float(np.nanmean(h[(yrs >= a) & (yrs <= b)]))
    m1120 = mean(2011, 2020)
    pub = next(o for o in obs if o["period"] == "2011-2020" and o["quantity"] == "global_surface_temperature_change")
    derived = {"note": "HadCRUT5 annual means rebased to 1850-1900 (monthly rebasing), averaged over the same periods AR6 uses. AR6's own value is an assessment from several datasets, so a small difference is expected.",
               "hadcrut5_rebased_1850_1900": {"mean_2011_2020": round(m1120, 3), "mean_2001_2020": round(mean(2001, 2020), 3), "mean_2015_2024": round(mean(2015, 2024), 3),
                                              "mean_2005_2024": round(mean(2005, 2024), 3), "latest_year": float(c.last_year), "latest_year_value": round(float(h[-1]), 3)},
               "difference_vs_ar6_2011_2020": round(m1120 - pub["best_estimate_c"], 3),
               "within_ar6_assessed_range_2011_2020": bool(pub["assessed_low_c"] <= m1120 <= pub["assessed_high_c"]),
               "gistemp_comparison_not_available": "GISTEMP starts in 1880, so a 1850-1900 baseline would silently be 1880-1900 (a different, warmer-biased reference). It is deliberately not offered."}
    return tagged({"source": {"name": "IPCC AR6 WGI Summary for Policymakers", "url": "https://www.ipcc.ch/report/ar6/wg1/downloads/report/IPCC_AR6_WGI_SPM_final.pdf",
                              "table": "Table SPM.1 (changes in global surface temperature, relative to 1850-1900)", "page_pdf": 18, "page_printed": 14,
                              "license_note": "The AR6 licence page returned HTTP 403 and could not be verified. Only short factual values are quoted, each with a page citation; nothing is recomputed or extrapolated.",
                              "baseline": "1850-1900", "averaging": "running 20-year averages unless stated otherwise; very likely range = 90-100% probability"},
                   "scenarios": scen, "observed_published": obs, "observed_derived": derived,
                   "tags_note": "scenarios and observed_published are IPCC assessed values (PREDICTED/assessed by IPCC, not by this project); observed_derived is our HadCRUT5 arithmetic (DERIVED)."},
                  {"source": "PREDICTED", "scenarios": "PREDICTED", "observed_published": "OBSERVED", "observed_derived": "DERIVED", "tags_note": "DERIVED"})


# ------------------------------------------------------------------------------------------------ grids

def _encode(ann_ny_nlat_nlon: np.ndarray):
    q = np.clip(np.round(ann_ny_nlat_nlon / 0.1), -127, 127)
    clipped = int((np.abs(np.round(ann_ny_nlat_nlon / 0.1)[np.isfinite(ann_ny_nlat_nlon)]) > 127).sum())
    out = np.where(np.isfinite(ann_ny_nlat_nlon), q, -128).astype(np.int8)
    return out, clipped


def _grid_meta(gid, src, prod, native, step, fname, ann_n, yrs_all, layer_years, lat_n, lon, clip_note=""):
    sel = np.isin(yrs_all, layer_years)
    layers = ann_n[sel]
    q, clipped = _encode(layers)
    dec = np.where(q == -128, np.nan, q * 0.1)
    err = np.abs(dec - layers)
    err = err[np.isfinite(err)]
    raw = q.tobytes()
    gz = gzip.compress(raw, 9, mtime=0)
    w = core.lat_weights(lat_n)
    valid = np.isfinite(layers)
    offs = {}
    for b in BASELINES:
        off = core.grid_offsets(ann_n, yrs_all, b)  # offsets always from the FULL record, even for the intro subset
        nv = int(np.isfinite(off).sum())
        if nv == 0:
            continue
        offs[b] = {"unit_degC_per_unit": 0.01, "min_reference_share": MIN_REF_SHARE, "n_valid_cells": nv,
                   "values": [None if not np.isfinite(v) else int(round(v / 0.01)) for v in off.reshape(-1)]}
    ys = [int(v) for v in yrs_all[sel]]
    meta = {
        "id": gid, "source": SRC_NAME[src], "product": prod, "native_baseline": native, "units": "degC",
        "encoding": {"dtype": "int8", "scale_degC_per_unit": 0.1, "missing_value": -128, "valid_range": [-127, 127],
                     "layout": "C-order [layer][lat][lon]; layer order = years.list; lat rows north to south, lon columns west to east", "row_order": "north_to_south", "lon_order": "west_to_east",
                     "file": f"{fname}.i8.bin.gz", "compression": "gzip", "uncompressed_bytes": len(raw), "gz_bytes": len(gz),
                     "sha256_uncompressed": hashlib.sha256(raw).hexdigest(),
                     "decode": "bytes = DecompressionStream('gzip'); v = Int8Array[(layer * n_lat + row) * n_lon + col]; v === -128 ? missing : celsius = v * 0.1 - offset_int * 0.01 (offset from baseline_offsets, null = unavailable)"},
        "grid": {"n_lat": len(lat_n), "n_lon": len(lon), "lat_step_deg": step, "lon_step_deg": step, "lat_first_center": float(lat_n[0]), "lon_first_center": float(lon[0])},
        "years": {"first": ys[0], "last": ys[-1], "n": len(ys), "list": ys},
        "aggregation": {"annual_rule": "mean of the monthly anomalies of a calendar year, requiring >= 9 valid months per cell; complete calendar years only", "min_months_per_cell_year": MIN_MONTHS_CELL_YEAR},
        "valid_cells_per_year": [int(v) for v in valid.sum((1, 2))],
        "valid_area_share_per_year": [round(float((v * w[:, None]).sum() / (np.ones_like(v) * w[:, None]).sum()), 4) for v in valid],
        "baseline_offsets": offs,
        "quantization": {"max_abs_error_c": round(float(err.max()), 4), "mean_abs_error_c": round(float(err.mean()), 5), "clipped_cells": clipped,
                         "tradeoff": ("0.1 C Int8 steps: worst-case 0.05 C error vs typical cell-year noise above 0.3 C. 2 degree (GISTEMP) keeps coastlines and islands; a 4 degree grid would be about 3x smaller but blur them. "
                                      "Year-major order gzips better than cell-major; delta coding was worse (measured)." + clip_note)},
    }
    return meta, gz


def _src_grid(c: Ctx, src: str):
    ann, yrs, lat, lon = grid_set(c)[src]
    order = np.argsort(-lat)  # north to south
    return ann[:, order, :], yrs, lat[order], lon


GRID_DEFS = (("gistemp_2deg", "gistemp", "NASA GISTEMP v4 gistemp1200_GHCNv4_ERSSTv5", "1951-1980", 2.0, "grid_gistemp_2deg"),
             ("hadcrut5_5deg", "hadcrut5", "HadCRUT5 5.2.0.0 analysis ensemble mean", "1961-1990", 5.0, "grid_hadcrut5_5deg"))


def grids(c: Ctx, out_dir) -> dict:
    """Write grid binaries (full record, plus a decadal intro subset for GISTEMP) to out_dir. Returns {id: meta}."""
    metas = {}
    for gid, src, prod, native, step, fname in GRID_DEFS:
        ann_n, yrs, lat_n, lon = _src_grid(c, src)
        meta, gz = _grid_meta(gid, src, prod, native, step, fname, ann_n, yrs, yrs, lat_n, lon)
        (out_dir / f"{fname}.i8.bin.gz").write_bytes(gz)
        metas[gid] = meta
    ann_n, yrs, lat_n, lon = _src_grid(c, "gistemp")
    intro_years = [y for y in range(1880, c.last_year, 10)] + [c.last_year]
    meta, gz = _grid_meta("gistemp_2deg_intro", "gistemp", GRID_DEFS[0][2] + " (decadal subset for the intro)", "1951-1980", 2.0, "grid_gistemp_2deg_intro",
                          ann_n, yrs, np.array(intro_years), lat_n, lon)
    (out_dir / "grid_gistemp_2deg_intro.i8.bin.gz").write_bytes(gz)
    metas["gistemp_2deg_intro"] = meta
    return metas


# ------------------------------------------------------------------------------------------------ cell trend grids (DR-3)

TREND_PERIODS = (("1880_latest", 1880), ("1951_latest", 1951), ("1975_latest", 1975), ("1991_latest", 1991))


def grid_trends(c: Ctx, out_dir) -> dict:
    """Per-cell OLS slope (0.01 degC/decade, Int8) and AR(1)-adjusted significance for each standard period. Same function as the global trends."""
    metas = {}
    for gid, src, prod, native, step, fname in GRID_DEFS:
        ann_n, yrs, lat_n, lon = _src_grid(c, src)
        nl, no = ann_n.shape[1:]
        slopes = np.full((len(TREND_PERIODS), nl, no), -128, np.int8)
        sig = np.zeros((len(TREND_PERIODS), nl, no), np.int8)
        periods, clipped = [], 0
        for pi, (pid, y0) in enumerate(TREND_PERIODS):
            sel = (yrs >= y0) & (yrs <= c.last_year)
            x = yrs[sel].astype(float)
            need = math.ceil(MIN_REF_SHARE * len(x))
            sub = ann_n[sel].astype(np.float64)
            nvalid = np.isfinite(sub).sum(0)
            n_ok = n_sig = 0
            for i in range(nl):
                for j in range(no):
                    if nvalid[i, j] < need:
                        continue
                    t = stats.ols_trend(x, sub[:, i, j])
                    v = t["slope"] * 10 / 0.01
                    if abs(round(v)) > 127:
                        clipped += 1
                    slopes[pi, i, j] = int(np.clip(round(v), -127, 127))
                    lo, hi = t["ci_ar1"]
                    sig[pi, i, j] = 1 if (lo > 0 or hi < 0) else 0
                    n_ok += 1
                    n_sig += int(sig[pi, i, j])
            periods.append({"id": pid, "start": int(x[0]), "end": int(x[-1]), "n_years": len(x), "min_valid_years": need, "n_valid_cells": int(n_ok), "n_significant_cells": int(n_sig)})
        raw = np.stack([slopes, sig]).tobytes()
        gz = gzip.compress(raw, 9, mtime=0)
        tname = fname.replace("grid_", "grid_trends_")
        (out_dir / f"{tname}.i8.bin.gz").write_bytes(gz)
        metas[tname] = {
            "id": tname, "source": SRC_NAME[src], "product": prod, "units": "degC_per_decade",
            "encoding": {"dtype": "int8", "slope_scale_degC_per_decade_per_unit": 0.01, "missing_value": -128, "valid_range": [-127, 127],
                         "layers": ["slope", "significant"], "layout": "C-order [layer][period][lat][lon]; layer 0 = slope, layer 1 = significant (1/0; 0 where slope is missing); period order = periods; rows north to south, columns west to east",
                         "file": f"{tname}.i8.bin.gz", "compression": "gzip", "uncompressed_bytes": len(raw), "gz_bytes": len(gz), "sha256_uncompressed": hashlib.sha256(raw).hexdigest(),
                         "decode": "slope_degC_per_decade = byte * 0.01 (byte === -128 means insufficient data)"},
            "grid": {"n_lat": nl, "n_lon": no, "lat_step_deg": step, "lon_step_deg": step, "lat_first_center": float(lat_n[0]), "lon_first_center": float(lon[0])},
            "periods": periods, "clipped_cells": int(clipped),
            "rule": ("A cell needs at least 80% of the period's annual values (stored annual cell means, unquantized) to get a slope. The slope is the same OLS used for the global series (analytics.stats.ols_trend). "
                     "significant = the AR(1)-adjusted 95% interval (effective sample size from the cell's residual lag-1 autocorrelation) excludes zero. Many cells are tested at once, so some significant cells are expected by chance; no multiple-testing correction is applied."),
        }
    return metas


# ------------------------------------------------------------------------------------------------ zonal fixture (DR-4)

def zonal_fixture(c: Ctx, out_dir) -> dict:
    from analytics import zonal
    years = [1900, 1980, c.last_year]
    out = {}
    for gid, src, prod, native, step, fname in GRID_DEFS:
        ann_n, yrs, lat_n, lon = _src_grid(c, src)
        q, _ = _encode(ann_n)
        per_base = {}
        for b in BASELINES:
            off = core.grid_offsets(ann_n, yrs, b)
            # offsets as shipped (0.01 C integers) so the fixture matches what the browser decodes
            off_int = np.where(np.isfinite(off), np.round(off / 0.01), np.nan)
            if not np.isfinite(off_int).any():
                per_base[b] = {"available": False, "years": {}}
                continue
            ys = {}
            for y in years:
                v = zonal.decode(q[int(np.where(yrs == y)[0][0])], off_int)
                rm, share, gm = zonal.zonal(v, lat_n)
                ys[str(y)] = {"row_mean": [None if not np.isfinite(x) else round(float(x), 6) for x in rm], "row_valid_share": [round(float(x), 6) for x in share],
                              "global_mean": round(gm, 6)}
            per_base[b] = {"available": True, "years": ys}
        out[src] = {"grid_id": gid, "n_lat": len(lat_n), "lat_centers": [float(x) for x in lat_n], "baselines": per_base}
    return {"schema_version": SCHEMA_VERSION, "tags": {"sources": "DERIVED", "rule": "DERIVED"},
            "rule": ("cell = byte*0.1 - offset_int*0.01 (missing if byte == -128 or offset null); row_valid_share = valid cells / n_lon; row_mean = mean of valid cells or null when row_valid_share < min_row_valid; "
                     "global_mean = cos(latitude) weighted mean over all valid cells (the row rule is not applied). Reference implementation: analytics/zonal.py"),
            "min_row_valid": zonal.MIN_ROW_VALID, "tolerance": 1e-6, "years": years, "sources": out}


# ------------------------------------------------------------------------------------------------ coastlines and land fraction (DR-2, DR-9)

def coastlines_art() -> dict:
    from analytics import geo
    starts, coords = geo.coastlines(RAW_NE / "ne_110m_coastline.geojson")
    return {"schema_version": SCHEMA_VERSION, "tags": {"coords": "OBSERVED"},
            "source": {"name": "Natural Earth 110m coastline", "url": "https://www.naturalearthdata.com/", "license": "public domain (https://www.naturalearthdata.com/about/terms-of-use/)",
                       "file": "ne_110m_coastline.geojson"},
            "layout": "coords = [lon0, lat0, lon1, lat1, ...] in degrees (2 decimals); polyline i spans coordinate pairs starts[i] .. starts[i+1]-1 (the last to the end). Do not join polylines.",
            "n_lines": len(starts), "n_points": len(coords) // 2, "starts": starts, "coords": coords}


def land_fraction_art(c: Ctx) -> dict:
    from analytics import geo
    out = {}
    for gid, src, prod, native, step, fname in GRID_DEFS:
        _, _, lat_n, lon = _src_grid(c, src)
        lf = geo.land_fraction(RAW_NE / "ne_110m_land.geojson", lat_n, lon, step, 8 if step <= 2 else 10)
        out[gid] = {"n_lat": len(lat_n), "n_lon": len(lon), "row_order": "north_to_south", "lon_order": "west_to_east", "scale": "percent of cell area (rounded)",
                    "values": [int(round(v * 100)) for v in lf.reshape(-1)]}
    return {"schema_version": SCHEMA_VERSION, "tags": {"grids": "DERIVED"},
            "source": {"name": "Natural Earth 110m land polygons", "url": "https://www.naturalearthdata.com/", "license": "public domain (https://www.naturalearthdata.com/about/terms-of-use/)"},
            "method": "Share of an 8 x 8 (2 degree cell) or 10 x 10 (5 degree cell) grid of sample points inside the land polygons (even-odd ray casting). A coarse 110m mask: coastal cells and small islands are approximate.",
            "grids": out}


def land_ocean_from_grid(c: Ctx, lf: dict, thr: int = 50) -> dict:
    """Land-cell vs ocean-cell means from the grids (cells with land fraction >= thr are land, the rest ocean). An approximation, labelled so."""
    res = {}
    for gid, src, *_ in GRID_DEFS:
        ann_n, yrs, lat_n, lon = _src_grid(c, src)
        lfa = np.array(lf["grids"][gid]["values"]).reshape(len(lat_n), len(lon))
        w = np.cos(np.deg2rad(lat_n))[:, None] * np.ones(len(lon))
        land = lfa >= thr
        per = {}
        for b in ("1951-1980", "1991-2020"):
            rb, _ = core.rebase_grid(ann_n, yrs, b)
            land_m, land_s = core.weighted_mean(rb.reshape(len(yrs), -1), (w * land).reshape(-1), MIN_VALID_AREA)  # weight 0 outside the mask
            oc_m, oc_s = core.weighted_mean(rb.reshape(len(yrs), -1), (w * ~land).reshape(-1), MIN_VALID_AREA)
            per[b] = {"land": to_list(_onto_axis(c, yrs, land_m)), "ocean": to_list(_onto_axis(c, yrs, oc_m))}
        res[src] = {"land_cell_area_share": round(float((w * land).sum() / w.sum()), 4), "values": per,
                    "land_valid_area_share_latest": round(float(land_s[-1]), 3), "ocean_valid_area_share_latest": round(float(oc_s[-1]), 3)}
    return res
