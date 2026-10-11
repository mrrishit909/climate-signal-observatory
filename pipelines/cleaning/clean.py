"""data/raw -> data/interim: parse tables and grids, account for every missing value.

Outputs
  data/interim/monthly.npz        monthly series on one axis (1850-01 .. latest), NaN = missing
  data/interim/annual_grids.npz   annual cell means per source (year, lat, lon), NaN = missing
  data/manifests/cleaning_ledger.json   counts that must reconcile (tests/test_reconciliation.py)
"""
from __future__ import annotations

import csv
import json
import math

import numpy as np
import xarray as xr

from pipelines.common import INTERIM, MANIFESTS, MIN_MONTHS_CELL_YEAR, RAW

Y0 = 1850  # first year of the shared monthly axis


def midx(y: int, m: int) -> int:
    return (y - Y0) * 12 + (m - 1)


def parse_gistemp_table(path, ledger_rows, source, axis_n):
    """GISTEMP CSV: Year,Jan..Dec,J-D,... missing = '***'. Returns monthly array on the shared axis."""
    out = np.full(axis_n, np.nan)
    rows = months_valid = months_missing = partial = 0
    with open(path, newline="") as f:
        for r in csv.reader(f):
            if not r or not r[0].strip().isdigit():
                continue  # title line / repeated header
            y = int(r[0])
            rows += 1
            vals = r[1:13]
            nvalid = 0
            for m, s in enumerate(vals, start=1):
                s = s.strip()
                if s == "***" or s == "":
                    months_missing += 1
                else:
                    out[midx(y, m)] = float(s)
                    months_valid += 1
                    nvalid += 1
            if nvalid < 12:
                partial += 1
    ledger_rows.append({"source": source, "file": path.name, "rows": rows, "months_expected": rows * 12, "months_valid": months_valid,
                        "months_missing": months_missing, "sentinel_values": "'***' (missing month)", "partial_year_rows": partial})
    return out


def parse_had_monthly(path, ledger_rows, source, axis_n):
    cols = {k: np.full(axis_n, np.nan) for k in ("anom", "lo", "hi")}
    rows = 0
    with open(path, newline="") as f:
        rd = csv.reader(f)
        next(rd)
        for r in rd:
            y, m = int(r[0][:4]), int(r[0][5:7])
            i = midx(y, m)
            for k, s in zip(("anom", "lo", "hi"), r[1:4]):
                cols[k][i] = float(s)
            rows += 1
    ledger_rows.append({"source": source, "file": path.name, "rows": rows, "months_expected": rows, "months_valid": rows, "months_missing": 0,
                        "sentinel_values": "none (no missing months in the summary series)", "partial_year_rows": 0})
    return cols


def parse_had_annual(path, ledger_rows, source, n_years):
    cols = {k: np.full(n_years, np.nan) for k in ("anom", "lo", "hi")}
    rows = 0
    with open(path, newline="") as f:
        rd = csv.reader(f)
        next(rd)
        for r in rd:
            i = int(r[0]) - Y0
            if i >= n_years:
                continue
            for k, s in zip(("anom", "lo", "hi"), r[1:4]):
                cols[k][i] = float(s)
            rows += 1
    ledger_rows.append({"source": source, "file": path.name, "rows": rows, "months_expected": rows, "months_valid": rows, "months_missing": 0,
                        "sentinel_values": "none (annual rows; the last row is a partial year and is excluded downstream)", "partial_year_rows": 1})
    return cols


def parse_co2(path, kind, axis_n):
    """NOAA GML: '#' comment header. MLO sentinel: sdev<0 / unc<0 / ndays=-1. Global file has none."""
    mean = np.full(axis_n, np.nan)
    des = np.full(axis_n, np.nan)
    flag = np.zeros(axis_n, dtype=bool)
    n = nflag = 0
    with open(path) as f:
        rows = [r for r in csv.reader(l for l in f if not l.startswith("#"))]
    hdr, rows = rows[0], rows[1:]
    ix = {h.strip(): i for i, h in enumerate(hdr)}
    for r in rows:
        y, m = int(r[ix["year"]]), int(r[ix["month"]])
        i = midx(y, m)
        mean[i] = float(r[ix["average"]])
        if kind == "mlo":
            des[i] = float(r[ix["deseasonalized"]])
            if float(r[ix["sdev"]]) < 0 or float(r[ix["unc"]]) < 0:
                flag[i] = True
                nflag += 1
        else:
            if float(r[ix["average_unc"]]) < 0:
                flag[i] = True
                nflag += 1
        n += 1
    return mean, des, flag, n, nflag


def annualize(cube: np.ndarray, years: np.ndarray, months: np.ndarray):
    """cube (time, lat, lon) float with NaN -> annual mean per cell for COMPLETE years only (all 12 month slots present in the file).

    A cell-year needs >= MIN_MONTHS_CELL_YEAR valid months. Returns (ann, year_list, partial_years, stats)."""
    ys = sorted(set(years.tolist()))
    complete, partial = [], []
    for y in ys:
        ms = set(months[years == y].tolist())
        (complete if len(ms) == 12 else partial).append(y)
    nl, no = cube.shape[1:]
    ann = np.full((len(complete), nl, no), np.nan, dtype=np.float32)
    valid = dropped = 0
    for k, y in enumerate(complete):
        sub = cube[years == y]
        cnt = np.isfinite(sub).sum(0)
        with np.errstate(all="ignore"):
            mean = np.nansum(sub, 0) / np.maximum(cnt, 1)
        ok = cnt >= MIN_MONTHS_CELL_YEAR
        ann[k] = np.where(ok, mean, np.nan)
        valid += int(ok.sum())
        dropped += int((~ok).sum())
    return ann, complete, partial, {"valid": valid, "dropped": dropped}


def grid_ledger(name, cube_raw_fill, cube, times, years, months, ann, complete, partial, stats):
    nt, nl, no = cube.shape
    fill = int(cube_raw_fill)
    valid = int(np.isfinite(cube).sum())
    nan_other = nt * nl * no - valid - fill
    ever = np.isfinite(cube).any(0)
    return {"source": name, "n_time": nt, "n_lat": nl, "n_lon": no, "total_cells": nt * nl * no, "valid_cells": valid,
            "missing_cells": nt * nl * no - valid, "fill_value_cells": fill, "nan_cells": nan_other,
            "missing_share": round((nt * nl * no - valid) / (nt * nl * no), 6),
            "first_month": f"{int(years[0])}-{int(months[0]):02d}", "last_month": f"{int(years[-1])}-{int(months[-1]):02d}",
            "complete_years": len(complete), "partial_years": [int(p) for p in partial],
            "annual_cell_years_total": len(complete) * nl * no, "annual_cell_years_valid": stats["valid"],
            "annual_cell_years_dropped_lt_min_months": stats["dropped"],
            "cells_ever_valid": int(ever.sum()), "cells_never_valid": int((~ever).sum())}


def main() -> None:
    INTERIM.mkdir(parents=True, exist_ok=True)
    MANIFESTS.mkdir(parents=True, exist_ok=True)
    axis_n = None
    # axis end = the later of the GISTEMP table end and HadCRUT end, read from the grids' last times below
    g_raw = xr.open_dataset(RAW / "gistemp" / "gistemp1200_GHCNv4_ERSSTv5.nc", mask_and_scale=False)
    g_t = g_raw.indexes["time"] if "time" in g_raw.indexes else None
    gy, gm = g_raw.time.dt.year.values, g_raw.time.dt.month.values
    h_ds = xr.open_dataset(RAW / "hadcrut5" / "HadCRUT.5.2.0.0.analysis.anomalies.ensemble_mean.nc", mask_and_scale=False)
    hy, hm = h_ds.time.dt.year.values, h_ds.time.dt.month.values
    last = max((int(gy[-1]), int(gm[-1])), (int(hy[-1]), int(hm[-1])))
    axis_n = midx(*last) + 1
    ledger = {"tables": [], "grids": []}

    # --- tables
    P = RAW / "gistemp"
    m = {}
    for key, fn, src in (("gistemp_glb", "GLB.Ts+dSST.csv", "GISTEMP land-ocean global"), ("gistemp_nh", "NH.Ts+dSST.csv", "GISTEMP land-ocean NH"),
                         ("gistemp_sh", "SH.Ts+dSST.csv", "GISTEMP land-ocean SH"), ("gistemp_glb_landonly", "GLB.Ts.csv", "GISTEMP land-only global")):
        m[key] = parse_gistemp_table(P / fn, ledger["tables"], src, axis_n)
    H = RAW / "hadcrut5"
    for key, fn, src in (("hadcrut5_glb", "global.monthly.csv", "HadCRUT5 global monthly"), ("hadcrut5_nh", "nh.monthly.csv", "HadCRUT5 NH monthly"),
                         ("hadcrut5_sh", "sh.monthly.csv", "HadCRUT5 SH monthly")):
        c = parse_had_monthly(H / fn, ledger["tables"], src, axis_n)
        m[key], m[key + "_lo"], m[key + "_hi"] = c["anom"], c["lo"], c["hi"]
    n_years = axis_n // 12 + 1
    for key, fn, src in (("hadcrut5_glb", "global.annual.csv", "HadCRUT5 global annual"), ("hadcrut5_nh", "nh.annual.csv", "HadCRUT5 NH annual"),
                         ("hadcrut5_sh", "sh.annual.csv", "HadCRUT5 SH annual")):
        c = parse_had_annual(H / fn, ledger["tables"], src, n_years)
        m[key + "_annfile"], m[key + "_annfile_lo"], m[key + "_annfile_hi"] = c["anom"], c["lo"], c["hi"]
    N = RAW / "noaa"
    mlo, mlo_des, mlo_flag, mlo_rows, mlo_nflag = parse_co2(N / "co2_mm_mlo.csv", "mlo", axis_n)
    gl, _, gl_flag, gl_rows, gl_nflag = parse_co2(N / "co2_mm_gl.csv", "gl", axis_n)
    m.update(co2_mlo=mlo, co2_mlo_des=mlo_des, co2_mlo_flag=mlo_flag.astype(np.int8), co2_gl=gl, co2_gl_flag=gl_flag.astype(np.int8))
    ledger["co2"] = {"mlo_rows": mlo_rows, "mlo_interpolated_rows": mlo_nflag, "mlo_measured_rows": mlo_rows - mlo_nflag,
                     "global_rows": gl_rows, "global_interpolated_rows": gl_nflag}
    np.savez_compressed(INTERIM / "monthly.npz", **m, start_year=np.array(Y0), n_months=np.array(axis_n))

    # --- grids
    sc = float(g_raw.tempanomaly.attrs.get("scale_factor", 0.01))
    fv = g_raw.tempanomaly.attrs.get("_FillValue", 32767)
    raw = g_raw.tempanomaly.values
    fillmask = raw == fv
    cube = np.where(fillmask, np.nan, raw.astype(np.float32) * np.float32(sc)).astype(np.float32)
    ann_g, cy_g, py_g, st_g = annualize(cube, gy, gm)
    ledger["grids"].append(grid_ledger("gistemp", fillmask.sum(), cube, None, gy, gm, ann_g, cy_g, py_g, st_g))
    lat_g, lon_g = g_raw.lat.values, g_raw.lon.values
    del cube, raw, fillmask

    hv = h_ds.tas_mean
    hfv = hv.attrs.get("_FillValue", h_ds.tas_mean.encoding.get("_FillValue", -1e30))
    hraw = hv.values.astype(np.float64)
    hfill = np.isclose(hraw, hfv) if hfv is not None else np.zeros_like(hraw, bool)
    hcube = np.where(hfill, np.nan, hraw).astype(np.float32)
    ann_h, cy_h, py_h, st_h = annualize(hcube, hy, hm)
    ledger["grids"].append(grid_ledger("hadcrut5", hfill.sum(), hcube, None, hy, hm, ann_h, cy_h, py_h, st_h))
    lat_h, lon_h = h_ds.latitude.values, h_ds.longitude.values
    np.savez_compressed(INTERIM / "annual_grids.npz", g_ann=ann_g, g_years=np.array(cy_g), g_lat=lat_g, g_lon=lon_g,
                        h_ann=ann_h, h_years=np.array(cy_h), h_lat=lat_h, h_lon=lon_h)
    ledger["scale_factor_gistemp"] = sc
    (MANIFESTS / "cleaning_ledger.json").write_text(json.dumps(ledger, indent=1, sort_keys=True) + "\n")
    for g in ledger["grids"]:
        print(g["source"], {k: g[k] for k in ("total_cells", "valid_cells", "missing_share", "complete_years", "partial_years", "last_month")})
    print("co2", ledger["co2"])


if __name__ == "__main__":
    main()
