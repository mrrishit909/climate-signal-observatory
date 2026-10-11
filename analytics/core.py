"""Baselines, annual aggregation, area weights, grid helpers. Pure numpy, no I/O."""
from __future__ import annotations

import numpy as np

from pipelines.common import BASE_YEARS, MIN_REF_SHARE

Y0 = 1850


def month_of_index(n: int) -> np.ndarray:
    return np.arange(n) % 12


def rebase_monthly(x: np.ndarray, base: str):
    """Rebase a monthly series (axis starts 1850-01) onto `base`.

    offset_m = mean over reference years of the series' values in calendar month m (needs >= 80% of the reference years, for every m).
    Returns (rebased, offsets[12], counts[12]) or None if the baseline cannot be computed. Never fills: NaN stays NaN."""
    b0, b1 = BASE_YEARS[base]
    ny = b1 - b0 + 1
    off, cnt = np.full(12, np.nan), np.zeros(12, int)
    for m in range(12):
        idx = np.array([(y - Y0) * 12 + m for y in range(b0, b1 + 1)])
        idx = idx[idx < len(x)]
        v = x[idx]
        v = v[np.isfinite(v)]
        cnt[m] = len(v)
        if len(v) >= np.ceil(MIN_REF_SHARE * ny):
            off[m] = v.mean()
    if not np.isfinite(off).all():
        return None
    return x - off[month_of_index(len(x))], off, cnt


def annual_from_monthly(x: np.ndarray, last_year: int) -> np.ndarray:
    """Annual means for years 1850..last_year; a year is valid only with all 12 months present."""
    ny = last_year - Y0 + 1
    out = np.full(ny, np.nan)
    for i in range(ny):
        v = x[i * 12:(i + 1) * 12]
        if len(v) == 12 and np.isfinite(v).all():
            out[i] = v.mean()
    return out


def last_complete_year(n_months: int) -> int:
    """Last year whose 12 months all lie on the axis."""
    return Y0 + n_months // 12 - 1


def lat_weights(lat: np.ndarray) -> np.ndarray:
    return np.cos(np.deg2rad(lat))


def weighted_mean(vals: np.ndarray, w: np.ndarray, min_share: float = 0.0):
    """Area-weighted mean over finite cells. vals (..., cells) or any broadcast with w. Returns (mean, valid_share)."""
    m = np.isfinite(vals)
    ws = (m * w).sum(-1)
    tot = np.broadcast_to(w, vals.shape).sum(-1)
    with np.errstate(all="ignore"):
        mean = np.where(m, vals, 0.0).__mul__(w).sum(-1) / ws
    share = ws / tot
    mean = np.where(ws > 0, mean, np.nan)
    if min_share:
        mean = np.where(share >= min_share, mean, np.nan)
    return mean, share


def grid_offsets(ann: np.ndarray, years: np.ndarray, base: str):
    """Per-cell offset = mean of stored annual anomalies over the reference years; NaN when < 80% of reference years are valid."""
    b0, b1 = BASE_YEARS[base]
    sel = (years >= b0) & (years <= b1)
    ny = b1 - b0 + 1
    sub = ann[sel]
    cnt = np.isfinite(sub).sum(0)
    with np.errstate(all="ignore"):
        off = np.nansum(sub, 0) / np.maximum(cnt, 1)
    return np.where(cnt >= np.ceil(MIN_REF_SHARE * ny), off, np.nan).astype(np.float64)


def rebase_grid(ann: np.ndarray, years: np.ndarray, base: str):
    off = grid_offsets(ann, years, base)
    return ann - off[None], off


def to_list(a: np.ndarray, nd: int = 3):
    """numpy -> JSON list with None for NaN."""
    return [None if not np.isfinite(v) else round(float(v), nd) for v in np.asarray(a, float)]
