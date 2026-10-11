"""Missing-cell accounting, recomputed independently from data/raw (not from the pipeline's own code path)."""
import csv
import json

import netCDF4
import numpy as np
import pytest

from tests.conftest import RAW, ROOT, slow

LEDGER = ROOT / "data" / "manifests" / "cleaning_ledger.json"


@pytest.fixture(scope="module")
def ledger():
    if not LEDGER.exists():
        pytest.skip("no ledger")
    return json.loads(LEDGER.read_text())


def test_grid_identities(ledger):
    for g in ledger["grids"]:
        assert g["total_cells"] == g["n_time"] * g["n_lat"] * g["n_lon"] == g["valid_cells"] + g["missing_cells"]
        assert g["missing_cells"] == g["fill_value_cells"] + g["nan_cells"]
        assert g["annual_cell_years_total"] == g["annual_cell_years_valid"] + g["annual_cell_years_dropped_lt_min_months"]
        assert g["cells_ever_valid"] + g["cells_never_valid"] == g["n_lat"] * g["n_lon"]
        assert len(g["partial_years"]) <= 1


def test_table_identities(ledger):
    for t in ledger["tables"]:
        assert t["months_expected"] == t["months_valid"] + t["months_missing"]


@slow
def test_gistemp_counts_match_independent_read(ledger):
    ds = netCDF4.Dataset(RAW / "gistemp" / "gistemp1200_GHCNv4_ERSSTv5.nc")
    v = ds["tempanomaly"]
    v.set_auto_maskandscale(True)
    a = v[:]
    g = next(x for x in ledger["grids"] if x["source"] == "gistemp")
    assert a.shape == (g["n_time"], g["n_lat"], g["n_lon"])
    assert int((~np.ma.getmaskarray(a)).sum()) == g["valid_cells"]


@slow
def test_hadcrut_counts_match_independent_read(ledger):
    ds = netCDF4.Dataset(RAW / "hadcrut5" / "HadCRUT.5.2.0.0.analysis.anomalies.ensemble_mean.nc")
    a = ds["tas_mean"][:]
    g = next(x for x in ledger["grids"] if x["source"] == "hadcrut5")
    assert int((~np.ma.getmaskarray(a)).sum()) == g["valid_cells"]


@slow
def test_gistemp_csv_sentinel_count(ledger):
    n_star = n_val = 0
    for r in csv.reader(open(RAW / "gistemp" / "GLB.Ts+dSST.csv")):
        if r and r[0].strip().isdigit():
            for s in r[1:13]:
                n_star += s.strip() == "***"
                n_val += s.strip() != "***"
    t = next(x for x in ledger["tables"] if x["source"] == "GISTEMP land-ocean global")
    assert (t["months_missing"], t["months_valid"]) == (n_star, n_val)


@slow
def test_raw_files_match_manifest_hashes():
    import hashlib
    man = json.loads((ROOT / "data" / "manifests" / "raw_manifest.json").read_text())
    rel = {"gistemp_glb_landocean": "gistemp/GLB.Ts+dSST.csv", "noaa_co2_mlo_monthly": "noaa/co2_mm_mlo.csv"}
    for k, p in rel.items():
        assert hashlib.sha256((RAW / p).read_bytes()).hexdigest() == man[k]["sha256"]
