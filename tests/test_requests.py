"""Tests for the artifacts requested by the creative direction (intro subset, cell trends, zonal fixture, coastlines, land fraction, band facts)."""
import gzip
import json

import numpy as np
import pytest

from analytics import stats, zonal
from tests.conftest import PUBLIC, ROOT, load

arr = lambda v: np.array([np.nan if x is None else x for x in v], float)


def grid(name):
    m = json.loads((PUBLIC / f"{name}.meta.json").read_text())
    g = m["grid"]
    raw = gzip.decompress((PUBLIC / m["encoding"]["file"]).read_bytes())
    return m, np.frombuffer(raw, np.int8).reshape(m["years"]["n"], g["n_lat"], g["n_lon"])


def test_intro_layers_identical_to_full_grid_layers():
    mi, ai = grid("grid_gistemp_2deg_intro")
    mf, af = grid("grid_gistemp_2deg")
    ys = mi["years"]["list"]
    assert ys[0] == 1880 and ys[-1] == mf["years"]["last"] and ys[:-1] == list(range(1880, 2025, 10))
    for k, y in enumerate(ys):
        assert (ai[k] == af[mf["years"]["list"].index(y)]).all()
    assert mi["baseline_offsets"] == mf["baseline_offsets"]  # offsets from the full record, not the subset
    assert mi["encoding"]["gz_bytes"] < 100_000


def test_trend_grid_matches_global_trend_function_on_samples():
    interim = ROOT / "data" / "interim" / "annual_grids.npz"
    if not interim.exists():
        pytest.skip("needs data/interim")
    z = np.load(interim)
    ann, yrs, lat = z["g_ann"].astype(float), z["g_years"], z["g_lat"]
    ann = ann[:, np.argsort(-lat), :]
    m = json.loads((PUBLIC / "grid_trends_gistemp_2deg.meta.json").read_text())
    g = m["grid"]
    raw = np.frombuffer(gzip.decompress((PUBLIC / m["encoding"]["file"]).read_bytes()), np.int8).reshape(2, len(m["periods"]), g["n_lat"], g["n_lon"])
    rng = np.random.default_rng(0)
    checked = 0
    for pi, p in enumerate(m["periods"]):
        sel = (yrs >= p["start"]) & (yrs <= p["end"])
        for _ in range(60):
            i, j = rng.integers(0, g["n_lat"]), rng.integers(0, g["n_lon"])
            y = ann[sel][:, i, j]
            if np.isfinite(y).sum() < p["min_valid_years"]:
                assert raw[0, pi, i, j] == -128 and raw[1, pi, i, j] == 0
                continue
            t = stats.ols_trend(yrs[sel].astype(float), y)
            exp = int(np.clip(round(t["slope"] * 10 / 0.01), -127, 127))
            assert raw[0, pi, i, j] == exp
            assert raw[1, pi, i, j] == (1 if (t["ci_ar1"][0] > 0 or t["ci_ar1"][1] < 0) else 0)
            checked += 1
    assert checked > 100
    for p, sl, sg in zip(m["periods"], raw[0], raw[1]):
        assert p["n_valid_cells"] == int((sl != -128).sum()) and p["n_significant_cells"] == int(sg.sum())
        assert (sg[sl == -128] == 0).all()
    assert m["clipped_cells"] < 0.01 * g["n_lat"] * g["n_lon"] * len(m["periods"])


def test_trend_grid_global_pattern():
    m = json.loads((PUBLIC / "grid_trends_gistemp_2deg.meta.json").read_text())
    g = m["grid"]
    raw = np.frombuffer(gzip.decompress((PUBLIC / m["encoding"]["file"]).read_bytes()), np.int8).reshape(2, 4, g["n_lat"], g["n_lon"])
    s = np.where(raw[0, 2] == -128, np.nan, raw[0, 2] * 0.01)  # 1975_latest degC/decade
    assert np.nanmean(s[:15]) > 2 * np.nanmean(s[37:53])  # north polar rows warm faster than the tropics
    assert (np.nanmean(raw[1, 2][raw[0, 2] != -128])) > 0.6  # most observed cells have a significant 1975 trend


@pytest.mark.parametrize("src,gid", [("gistemp", "grid_gistemp_2deg"), ("hadcrut5", "grid_hadcrut5_5deg")])
def test_zonal_fixture_parity_with_reference_function(src, gid):
    fx = load("zonal_fixture")
    m, a = grid(gid)
    s = fx["sources"][src]
    lat = m["grid"]["lat_first_center"] - m["grid"]["lat_step_deg"] * np.arange(m["grid"]["n_lat"])
    assert np.allclose(s["lat_centers"], lat)
    n_checked = 0
    for b, bd in s["baselines"].items():
        offs = m["baseline_offsets"].get(b)
        assert bd["available"] == (offs is not None)
        if not offs:
            continue
        off = arr(offs["values"]).reshape(a.shape[1:])
        for y, exp in bd["years"].items():
            v = zonal.decode(a[m["years"]["list"].index(int(y))], off)
            rm, share, gm = zonal.zonal(v, lat)
            assert np.allclose(arr(exp["row_mean"]), rm, atol=fx["tolerance"], equal_nan=True)
            assert np.allclose(exp["row_valid_share"], share, atol=fx["tolerance"])
            assert exp["global_mean"] == pytest.approx(gm, abs=fx["tolerance"])
            assert ((share < fx["min_row_valid"]) <= np.isnan(rm)).all()  # the 20% rule
            n_checked += 1
    assert n_checked >= 6


def test_zonal_rule_known_value():
    q = np.array([[10, -128, -128, -128, -128], [10, 20, -128, -128, -128], [-128] * 5], np.int8)
    rm, share, gm = zonal.zonal(zonal.decode(q, None), np.array([60.0, 0.0, -60.0]))
    assert share.tolist() == [0.2, 0.4, 0.0]
    assert rm[0] == pytest.approx(1.0) and rm[1] == pytest.approx(1.5) and np.isnan(rm[2])
    assert gm == pytest.approx((1.0 * 0.5 + (1.0 + 2.0) * 1.0) / (0.5 + 2 * 1.0))


def test_coastlines_wellformed():
    c = load("coastlines")
    xy = np.array(c["coords"]).reshape(-1, 2)
    assert len(xy) == c["n_points"] and len(c["starts"]) == c["n_lines"]
    assert c["starts"][0] == 0 and (np.diff(c["starts"]) > 0).all() and c["starts"][-1] < len(xy)
    assert xy[:, 0].min() >= -180 and xy[:, 0].max() <= 180 and xy[:, 1].min() >= -90.01 and xy[:, 1].max() <= 90
    assert "public domain" in c["source"]["license"]
    assert len(json.dumps(c)) < 120_000


def test_land_fraction_known_places_and_global_share():
    lf = load("land_fraction")["grids"]["gistemp_2deg"]
    v = np.array(lf["values"]).reshape(lf["n_lat"], lf["n_lon"])
    lat = 89 - 2 * np.arange(90)
    lon = -179 + 2 * np.arange(180)
    at = lambda la, lo: v[int((89 - la) // 2), int((lo + 179) // 2)]
    assert at(-80, 20) == 100 and at(50, 100) == 100 and at(0, -150) == 0 and at(-40, -120) == 0 and at(20, 0) == 100
    w = np.cos(np.deg2rad(lat))[:, None] * np.ones(180)
    share = (w * v / 100).sum() / w.sum()
    assert 0.27 < share < 0.31  # Earth: about 29% land


def test_land_warms_faster_than_ocean_in_both_products(art):
    gm = art["regional"]["land_ocean"]["grid_land_mask"]
    yrs = np.array(gm["years"])
    for src, s in gm["sources"].items():
        L, O = arr(s["values"]["1951-1980"]["land"]), arr(s["values"]["1951-1980"]["ocean"])
        m = (yrs >= 1975) & np.isfinite(L) & np.isfinite(O)
        assert np.polyfit(yrs[m], L[m], 1)[0] > 1.4 * np.polyfit(yrs[m], O[m], 1)[0], src
        assert 0.27 < s["land_cell_area_share"] < 0.31


def test_bands_on_whole_cell_edges_and_band_trends(art):
    for b in art["regional"]["bands"]:
        assert b["lat_min"] % 10 == 0 and b["lat_max"] % 10 == 0
    ids = {s["series_id"] for s in art["trends"]["series"]}
    for src in ("gistemp", "hadcrut5"):
        for b in art["regional"]["bands"]:
            assert f"{src}_band_{b['id']}" in ids
    periods = {f["period"] for s in art["trends"]["series"] if s["series_id"] == "gistemp_glb" for f in s["fits"]}
    assert {"1880_latest", "1951_latest", "1975_latest", "1991_latest"} <= periods


def test_design_requested_facts(art):
    f = art["facts"]["facts"]
    assert f["arctic_to_global_trend_ratio_1975_latest"]["value"] > 1.5
    assert isinstance(f["band_trends_all_positive_1975_latest"]["value"], bool)
    assert 0 <= f["n_bands_warmed_beyond_uncertainty_1975_latest"]["value"] <= 5
    assert (f["band_trends_all_positive_1975_latest"]["value"]) == (f["n_bands_warmed_beyond_uncertainty_1975_latest"]["value"] == 5)
    assert f["land_minus_landocean_gap_latest_decade"]["value"] > 0
    for k in ("gistemp", "hadcrut5"):
        r = f[f"latest_year_rank_{k}"]["value"]
        assert 1 <= r["rank"] <= r["of"] and r["year"] == f["latest_complete_year"]["value"]
    assert f["ar6_published_land_2011_2020"]["value"]["best_estimate"] == 1.59 and f["ar6_published_ocean_2011_2020"]["value"]["best_estimate"] == 0.88
    y = f["gistemp_ytd_mean_1951_1980"]["value"]
    assert y["year"] == f["latest_complete_year"]["value"] + 1 and y["months"] == f["gistemp_ytd_months"]["value"] and 1 <= y["months"] <= 11
