"""Natural Earth 110m helpers: coastline polylines and land fraction per grid cell (point-in-polygon, even-odd rule)."""
from __future__ import annotations

import json

import numpy as np


def coastlines(path, nd: int = 2):
    """Flat lon/lat coordinate list + polyline start indices (index into the coordinate PAIRS)."""
    d = json.loads(open(path).read())
    starts, coords = [], []
    for f in d["features"]:
        g = f["geometry"]
        lines = [g["coordinates"]] if g["type"] == "LineString" else g["coordinates"]
        for ln in lines:
            starts.append(len(coords) // 2)
            for x, y in ln:
                coords += [round(float(x), nd), round(float(y), nd)]
    return starts, coords


def _inside(px, py, rings):
    """Even-odd ray casting for points against all rings of one polygon (outer + holes)."""
    inside = np.zeros(len(px), bool)
    for ring in rings:
        r = np.asarray(ring, float)
        x1, y1, x2, y2 = r[:-1, 0], r[:-1, 1], r[1:, 0], r[1:, 1]
        for a, b, c, d in zip(x1, y1, x2, y2):
            if b == d:
                continue
            cond = ((b > py) != (d > py)) & (px < (c - a) * (py - b) / (d - b) + a)
            inside ^= cond
    return inside


def land_fraction(path, lat_centers: np.ndarray, lon_centers: np.ndarray, step: float, n_sub: int) -> np.ndarray:
    """Share (0..1) of n_sub x n_sub sample points per cell that fall on land. Shape (nlat, nlon)."""
    d = json.loads(open(path).read())
    off = (np.arange(n_sub) + 0.5) / n_sub - 0.5
    LA = (lat_centers[:, None] + off[None, :] * step).reshape(-1)  # (nlat*n_sub)
    LO = (lon_centers[:, None] + off[None, :] * step).reshape(-1)
    PX, PY = np.meshgrid(LO, LA)
    px, py = PX.reshape(-1), PY.reshape(-1)
    land = np.zeros(len(px), bool)
    for f in d["features"]:
        g = f["geometry"]
        polys = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
        for rings in polys:
            xs = np.concatenate([np.asarray(r)[:, 0] for r in rings])
            ys = np.concatenate([np.asarray(r)[:, 1] for r in rings])
            m = (px >= xs.min()) & (px <= xs.max()) & (py >= ys.min()) & (py <= ys.max())
            if m.any():
                idx = np.where(m)[0]
                land[idx] ^= _inside(px[idx], py[idx], rings)
    L = land.reshape(len(LA), len(LO)).reshape(len(lat_centers), n_sub, len(lon_centers), n_sub)
    return L.mean((1, 3))
