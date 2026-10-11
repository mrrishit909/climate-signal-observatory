"""Data-quality tests on the published artifacts."""
import gzip
import json

import numpy as np
import pytest

from tests.conftest import PUBLIC

arr = lambda v: np.array([np.nan if x is None else x for x in v], float)


def test_ranges_global_annual(art, sid):
    for s in sid.values():
        for b, v in s["values"].items():
            a = arr(v)
            assert np.nanmin(a) > -1.5 and np.nanmax(a) < 3.0, (s["id"], b)  # global/hemispheric annual anomalies, degC


def test_gistemp_null_before_1880_hadcrut_from_1850(art, sid):
    yrs = art["series_annual"]["years"]
    assert yrs[0] == 1850 and yrs == list(range(1850, yrs[-1] + 1))
    g = arr(sid["gistemp_glb"]["values"]["1951-1980"])
    assert np.isnan(g[:30]).all() and np.isfinite(g[30:]).all()
    assert np.isfinite(arr(sid["hadcrut5_glb"]["values"]["1951-1980"])).all()


def test_baseline_switch_is_a_constant_shift(art, sid):
    conv = {(c["series"], c["to"]): c for c in art["series_annual"]["conversions"]}
    for s in sid.values():
        if "1991-2020" in s["values"]:
            d = arr(s["values"]["1951-1980"]) - arr(s["values"]["1991-2020"])
            d = d[np.isfinite(d)]
            assert np.ptp(d) < 2e-3  # rounding only
            exp = conv[(s["id"], "1991-2020")]["offset_c"] - conv[(s["id"], "1951-1980")]["offset_c"]
            assert d.mean() == pytest.approx(exp, abs=2e-3)


def test_conversions_recorded_for_every_series_baseline(art, sid):
    keys = {(c["series"], c["to"]) for c in art["series_annual"]["conversions"]}
    for s in sid.values():
        for b in s["values"]:
            assert (s["id"], b) in keys


def test_hadcrut_ci_brackets_value(art, sid):
    s = sid["hadcrut5_glb"]
    for b in s["values"]:
        v, lo, hi = (arr(x[b]) for x in (s["values"], s["ci_lo"], s["ci_hi"]))
        assert (lo < v).all() and (v < hi).all()
    assert sid["gistemp_glb"]["ci_lo"] is None


def test_cross_source_alignment(art):
    st = art["agreement"]["annual"]["stats"]["1951-1980"]
    assert st["corr"] > 0.98 and st["rmsd"] < 0.08 and abs(st["trend_gap_per_decade"]) < 0.02
    assert art["agreement"]["coverage_matched"]["rmsd"] <= st["rmsd"] + 1e-9 or art["agreement"]["coverage_matched"]["rmsd"] < 0.06
    assert art["agreement"]["common_period"][0] == 1880


def test_agreement_diff_is_g_minus_h(art):
    a = art["agreement"]["annual"]
    for b in a["diff_gistemp_minus_hadcrut5"]:
        g, h, d = (arr(a[k][b]) for k in ("gistemp", "hadcrut5", "diff_gistemp_minus_hadcrut5"))
        m = np.isfinite(d)
        assert np.allclose(g[m] - h[m], d[m], atol=2e-3)


def test_trend_ci_sanity(art):
    for s in art["trends"]["series"]:
        for f in s["fits"]:
            lo, hi = f["ci_ar1"]
            assert lo < f["slope_per_decade"] < hi
            assert (hi - lo) >= (f["ci_naive"][1] - f["ci_naive"][0]) - 1e-4  # autocorrelation never narrows the interval
            assert f["slope_per_decade"] > 0
            assert 3 <= f["n_eff"] <= f["n"]
    g = next(s for s in art["trends"]["series"] if s["series_id"] == "gistemp_glb")
    f = {x["period"]: x for x in g["fits"]}
    assert f["1975_latest"]["slope_per_decade"] > f["1880_latest"]["slope_per_decade"]  # acceleration
    assert 0.15 < f["1975_latest"]["slope_per_decade"] < 0.3


def test_loess_and_rolling(art):
    for l in art["trends"]["loess"]:
        for b in l["fit"]:
            f, lo, hi = (arr(l[k][b]) for k in ("fit", "band_lo", "band_hi"))
            m = np.isfinite(f)
            assert (lo[m] <= hi[m]).all() and (lo[m] - 0.02 <= f[m]).all() and (f[m] <= hi[m] + 0.02).all()
    for r in art["trends"]["rolling"]:
        assert len(r["end_year"]) == len(r["slope_per_decade"]) == len(r["ci_ar1_lo"])


def test_extremes_calibrated_and_rising(art):
    yrs = art["extremes"]["years"]
    for m in art["extremes"]["metrics"]:
        a = arr(m["area_share"])
        assert np.nanmin(a) >= 0 and np.nanmax(a) <= 1
        if m["id"].endswith("above_p95_1951-1980"):
            ref = (np.array(yrs) >= 1951) & (np.array(yrs) <= 1980)
            assert np.nanmean(a[ref]) == pytest.approx(m["expected_share_in_reference"], abs=1e-4)
            assert 0.04 < m["expected_share_in_reference"] < 0.09  # 2/30 in-sample, nominal 5%
            assert a[-1] > 5 * m["expected_share_in_reference"]


def test_regional_bands_and_coverage(art):
    r = art["regional"]
    assert abs(sum(b["area_share_of_globe"] for b in r["bands"]) - 1) < 1e-3
    for row in r["rows"]:
        vs = arr(row["valid_area_share"])
        v = arr(row["values"]["1951-1980"])
        assert (vs[np.isfinite(vs)] <= 1.0001).all()
        assert (np.isfinite(v) <= (vs >= r["min_valid_area_share"] - 1e-9)).all()  # a value implies enough observed area
    arctic = next(x for x in r["rows"] if x["source"] == "gistemp" and x["band"] == "arctic")
    low = next(x for x in r["rows"] if x["source"] == "gistemp" and x["band"] == "low")
    assert arr(arctic["values"]["1951-1980"])[-1] > 1.5 * arr(low["values"]["1951-1980"])[-1]  # Arctic amplification


def test_changepoints_labeled_exploratory(art):
    c = art["changepoints"]
    assert c["status"] == "EXPLORATORY" and "cause" in c["caveat"]
    for r in c["results"]:
        assert r["selected_k"] == len(r["selected_breaks"]) == len(r["break_ci_95"])
        assert [x["k"] for x in r["candidates"]] == [0, 1, 2, 3]
        sse = [x["sse"] for x in r["candidates"]]
        assert sse == sorted(sse, reverse=True)  # more breaks never fit worse


def test_co2_association_only(art):
    c = art["co2"]
    assert c["association_only"] is True and "ASSOCIATION ONLY" in c["association"]["interpretation"]
    a = c["association"]
    assert a["levels"]["corr"] > 0.9 and abs(a["first_differences"]["corr"]) < a["levels"]["corr"]
    g = arr(c["global_annual_ppm"])
    assert np.nanmin(g) > 330 and np.nanmax(g) < 450 and np.nanmax(g) > np.nanmin(g)
    assert (np.diff(g[np.isfinite(g)]) > 0).all()  # annual global CO2 rises every year in the record


def test_ar6_values_and_labels(art):
    a = art["ar6"]
    assert a["source"]["baseline"] == "1850-1900" and a["tags"]["scenarios"] == "PREDICTED"
    for s in a["scenarios"]:
        for r in s["rows"]:
            assert r["very_likely_low_c"] <= r["best_estimate_c"] <= r["very_likely_high_c"]
    long = {s["id"]: s["rows"][-1] for s in a["scenarios"]}
    assert long["SSP2-4.5"]["best_estimate_c"] == 2.7 and long["SSP5-8.5"]["very_likely_high_c"] == 5.7
    assert a["observed_derived"]["within_ar6_assessed_range_2011_2020"] is True
    assert art["validation"]["ar6_text_check"]["all_found_in_pdf_page"] is True


def test_validation_all_pass(art):
    v = art["validation"]
    assert all(c["pass"] for c in v["baseline_conversion"]["known_value_checks"])
    assert all(c["pass"] for c in v["internal_consistency"])
    assert v["grid_vs_official_global"]["gistemp"]["rmsd"] < 0.03 and v["grid_vs_official_global"]["hadcrut5"]["rmsd"] < 0.03
    assert all(e["roundtrip_ok"] and e["clipped_cells"] == 0 and e["max_abs_error_c"] <= 0.0501 for e in v["grid_encoding"].values())
    sim = v["trend_ci_simulation"]
    assert sim["coverage_naive"] < sim["coverage_ar1"] and sim["coverage_ar1"] > 0.9 and sim["tag"] == "SIMULATED"


@pytest.mark.parametrize("gid", ["gistemp_2deg", "hadcrut5_5deg"])
def test_grid_binary_matches_meta_and_budget(gid):
    f = {"gistemp_2deg": "grid_gistemp_2deg", "hadcrut5_5deg": "grid_hadcrut5_5deg"}[gid]
    m = json.loads((PUBLIC / f"{f}.meta.json").read_text())
    gz = (PUBLIC / m["encoding"]["file"]).read_bytes()
    assert len(gz) == m["encoding"]["gz_bytes"]
    raw = gzip.decompress(gz)
    g, y = m["grid"], m["years"]
    assert len(raw) == y["n"] * g["n_lat"] * g["n_lon"] == m["encoding"]["uncompressed_bytes"]
    a = np.frombuffer(raw, np.int8).reshape(y["n"], g["n_lat"], g["n_lon"])
    assert [int((a[i] != -128).sum()) for i in range(y["n"])] == m["valid_cells_per_year"]
    assert y["n"] == y["last"] - y["first"] + 1
    for b, o in m["baseline_offsets"].items():
        assert len(o["values"]) == g["n_lat"] * g["n_lon"] and o["n_valid_cells"] == sum(v is not None for v in o["values"])
    # north is up: polar rows warmed more than tropical rows in the last year
    last = np.where(a[-1] == -128, np.nan, a[-1] * 0.1)
    assert np.nanmean(last[: g["n_lat"] // 6]) > np.nanmean(last[g["n_lat"] * 5 // 12: g["n_lat"] * 7 // 12])


def test_grid_budget_total():
    total = sum((PUBLIC / n).stat().st_size for n in ("grid_gistemp_2deg.i8.bin.gz", "grid_hadcrut5_5deg.i8.bin.gz"))
    assert total < 1_500_000


def test_grid_decoded_baseline_rebase_matches_series(art, sid):
    """A decoded + rebased grid, area-averaged, must track the published global series (known-value cross-check across artifacts)."""
    m = json.loads((PUBLIC / "grid_gistemp_2deg.meta.json").read_text())
    g = m["grid"]
    a = np.frombuffer(gzip.decompress((PUBLIC / m["encoding"]["file"]).read_bytes()), np.int8).reshape(m["years"]["n"], g["n_lat"], g["n_lon"])
    v = np.where(a == -128, np.nan, a * 0.1)
    off = arr(m["baseline_offsets"]["1991-2020"]["values"]).reshape(g["n_lat"], g["n_lon"]) * 0.01
    lat = g["lat_first_center"] - g["lat_step_deg"] * np.arange(g["n_lat"])
    w = np.cos(np.deg2rad(lat))[:, None] * np.ones(g["n_lon"])
    r = v - off[None]
    gm = np.array([np.nansum(x * w) / np.nansum(np.isfinite(x) * w) for x in r])
    pub = arr(sid["gistemp_glb"]["values"]["1991-2020"])[30:30 + m["years"]["n"]]
    assert np.sqrt(np.nanmean((gm - pub) ** 2)) < 0.06


def test_facts_match_artifacts(art, sid):
    f = art["facts"]["facts"]
    g = arr(sid["gistemp_glb"]["values"]["1951-1980"])
    assert f["gistemp_latest_year_anomaly_1951_1980"]["value"] == pytest.approx(g[-1], abs=1e-3)
    assert f["latest_complete_year"]["value"] == art["series_annual"]["years"][-1]
    w = f["warmest_year_gistemp"]["value"]
    assert w["year"] == art["series_annual"]["years"][int(np.nanargmax(g))]
    tr = next(s for s in art["trends"]["series"] if s["series_id"] == "gistemp_glb")
    t = next(x for x in tr["fits"] if x["period"] == "1975_latest")
    assert f["trend_gistemp_1975_latest"]["value"]["slope_per_decade"] == t["slope_per_decade"]
    assert f["ar6_published_2011_2020"]["value"]["best_estimate"] == 1.09
    assert f["grid_artifact_gzip_bytes_total"]["value"] < 1_500_000


def test_meta_hashes_match_files(art):
    import hashlib
    for name, d in art["meta"]["artifact_files"].items():
        b = (PUBLIC / name).read_bytes()
        assert len(b) == d["bytes"] and hashlib.sha256(b).hexdigest() == d["sha256"], name
    assert len(art["meta"]["sources"]) >= 8 and len(art["meta"]["limitations"]) >= 5
