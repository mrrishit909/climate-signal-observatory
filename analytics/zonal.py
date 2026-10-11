"""Reference definition of the zonal (per-latitude-row) summary the browser recomputes from the decoded grid.

Rule (defined once, here, mirrored by the site and checked against data/fixture zonal_fixture.json):
- cell value (celsius) = byte * 0.1 - offset_int * 0.01 ; byte == -128 or offset null -> missing
- row_valid_share = valid cells in the row / n_lon
- row_mean = arithmetic mean of the row's valid cells, or null when row_valid_share < MIN_ROW_VALID (0.20)
- global_mean = cos(latitude) weighted mean over ALL valid cells (the 20% rule applies to row means only)
"""
from __future__ import annotations

import numpy as np

MIN_ROW_VALID = 0.20


def decode(q: np.ndarray, off_int: np.ndarray | None) -> np.ndarray:
    v = np.where(q == -128, np.nan, q.astype(np.float64) * 0.1)
    if off_int is not None:
        v = v - off_int.astype(np.float64) * 0.01  # off_int NaN for unavailable cells
    return v


def zonal(v: np.ndarray, lat: np.ndarray):
    valid = np.isfinite(v)
    share = valid.mean(1)
    with np.errstate(all="ignore"):
        mean = np.where(valid.any(1), np.nansum(v, 1) / np.maximum(valid.sum(1), 1), np.nan)
    row_mean = np.where(share >= MIN_ROW_VALID, mean, np.nan)
    w = np.cos(np.deg2rad(lat))[:, None] * np.ones(v.shape[1])
    gm = float(np.nansum(v * w) / (valid * w).sum()) if valid.any() else float("nan")
    return row_mean, share, gm
