"""Idempotent raw-source ingestion for CLIMATE SIGNAL OBSERVATORY.

Downloads every source in SOURCES into data/raw/ (gitignored), records url / bytes / sha256 /
server Last-Modified / retrieval time in data/manifests/raw_manifest.json. Files are re-published
upstream (GISTEMP monthly, NOAA daily), so a stored file is only skipped when its size AND server
Last-Modified match the manifest entry; otherwise it is re-fetched.

    uv run python -m pipelines.ingestion.fetch [--only gistemp,hadcrut,co2,ar6]
"""
from __future__ import annotations

import argparse
import datetime as dt
import gzip
import hashlib
import json
import os
import shutil
import sys
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw"
MANIFEST = ROOT / "data" / "manifests" / "raw_manifest.json"
GIS = "https://data.giss.nasa.gov"
HAD = "https://www.metoffice.gov.uk/hadobs/hadcrut5/data/HadCRUT.5.2.0.0/analysis"
GML = "https://gml.noaa.gov/webdata/ccgg/trends/co2"
NE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson"
AR6 = "https://www.ipcc.ch/report/ar6/wg1/downloads/report/IPCC_AR6_WGI_SPM_final.pdf"

# (group, id, url, relative dest)
SOURCES = [
    ("gistemp", "gistemp_grid_nc_gz", f"{GIS}/pub/gistemp/gistemp1200_GHCNv4_ERSSTv5.nc.gz", "gistemp/gistemp1200_GHCNv4_ERSSTv5.nc.gz"),
    ("gistemp", "gistemp_glb_landocean", f"{GIS}/gistemp/tabledata_v4/GLB.Ts+dSST.csv", "gistemp/GLB.Ts+dSST.csv"),
    ("gistemp", "gistemp_nh_landocean", f"{GIS}/gistemp/tabledata_v4/NH.Ts+dSST.csv", "gistemp/NH.Ts+dSST.csv"),
    ("gistemp", "gistemp_sh_landocean", f"{GIS}/gistemp/tabledata_v4/SH.Ts+dSST.csv", "gistemp/SH.Ts+dSST.csv"),
    ("gistemp", "gistemp_glb_landonly", f"{GIS}/gistemp/tabledata_v4/GLB.Ts.csv", "gistemp/GLB.Ts.csv"),
    ("hadcrut", "hadcrut5_grid_nc", f"{HAD}/HadCRUT.5.2.0.0.analysis.anomalies.ensemble_mean.nc", "hadcrut5/HadCRUT.5.2.0.0.analysis.anomalies.ensemble_mean.nc"),
    ("hadcrut", "hadcrut5_global_monthly", f"{HAD}/diagnostics/HadCRUT.5.2.0.0.analysis.summary_series.global.monthly.csv", "hadcrut5/global.monthly.csv"),
    ("hadcrut", "hadcrut5_nh_monthly", f"{HAD}/diagnostics/HadCRUT.5.2.0.0.analysis.summary_series.northern_hemisphere.monthly.csv", "hadcrut5/nh.monthly.csv"),
    ("hadcrut", "hadcrut5_sh_monthly", f"{HAD}/diagnostics/HadCRUT.5.2.0.0.analysis.summary_series.southern_hemisphere.monthly.csv", "hadcrut5/sh.monthly.csv"),
    ("hadcrut", "hadcrut5_global_annual", f"{HAD}/diagnostics/HadCRUT.5.2.0.0.analysis.summary_series.global.annual.csv", "hadcrut5/global.annual.csv"),
    ("hadcrut", "hadcrut5_nh_annual", f"{HAD}/diagnostics/HadCRUT.5.2.0.0.analysis.summary_series.northern_hemisphere.annual.csv", "hadcrut5/nh.annual.csv"),
    ("hadcrut", "hadcrut5_sh_annual", f"{HAD}/diagnostics/HadCRUT.5.2.0.0.analysis.summary_series.southern_hemisphere.annual.csv", "hadcrut5/sh.annual.csv"),
    ("co2", "noaa_co2_mlo_monthly", f"{GML}/co2_mm_mlo.csv", "noaa/co2_mm_mlo.csv"),
    ("co2", "noaa_co2_global_monthly", f"{GML}/co2_mm_gl.csv", "noaa/co2_mm_gl.csv"),
    ("natural_earth", "ne_110m_coastline", f"{NE}/ne_110m_coastline.geojson", "natural_earth/ne_110m_coastline.geojson"),
    ("natural_earth", "ne_110m_land", f"{NE}/ne_110m_land.geojson", "natural_earth/ne_110m_land.geojson"),
    ("ar6", "ipcc_ar6_wgi_spm_pdf", AR6, "ipcc/IPCC_AR6_WGI_SPM_final.pdf"),
]


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def fetch(url: str, dest: Path, prev: dict | None, retries: int = 4) -> dict:
    dest.parent.mkdir(parents=True, exist_ok=True)
    head = requests.head(url, timeout=60, allow_redirects=True)
    head.raise_for_status()
    size = int(head.headers.get("content-length", -1))
    lm = head.headers.get("last-modified")
    if dest.exists() and prev and prev.get("last_modified") == lm and (size < 0 or head.headers.get('content-encoding') or dest.stat().st_size == size) and prev.get("sha256"):
        return {**prev, "skipped": True}
    tmp = dest.with_suffix(dest.suffix + ".part")
    err = None
    for attempt in range(1, retries + 1):
        try:
            with requests.get(url, stream=True, timeout=180) as r:
                r.raise_for_status()
                with tmp.open("wb") as f:
                    for chunk in r.iter_content(1 << 20):
                        f.write(chunk)
            got = tmp.stat().st_size
            # HEAD can report the compressed size (Met Office CSVs); only trust it when the GET was not content-encoded
            if size > 0 and not r.headers.get("content-encoding") and got != size:
                raise IOError(f"incomplete download {got} != {size}")
            os.replace(tmp, dest)
            return {"url": url, "bytes": got, "sha256": sha256(dest), "last_modified": lm,
                    "retrieved_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"), "skipped": False}
        except Exception as e:  # network failure: retry with backoff, then surface
            err = e
            print(f"  attempt {attempt} failed for {url}: {e}", file=sys.stderr)
            time.sleep(2 * attempt)
    raise RuntimeError(f"failed {url}: {err}")


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="gistemp,hadcrut,co2,ar6,natural_earth")
    a = ap.parse_args(argv)
    only = set(a.only.split(","))
    man = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}
    for group, sid, url, rel in SOURCES:
        if group not in only:
            continue
        dest = RAW / rel
        print(f"[{sid}] {url}", flush=True)
        man[sid] = fetch(url, dest, man.get(sid))
        if sid == "gistemp_grid_nc_gz":  # decompress next to the archive; netCDF reader needs the plain file
            nc = dest.with_suffix("")
            if man[sid]["skipped"] and nc.exists():
                pass
            else:
                with gzip.open(dest, "rb") as fi, nc.open("wb") as fo:
                    shutil.copyfileobj(fi, fo)
            man[sid]["decompressed_path"] = str(nc.relative_to(ROOT))
            man[sid]["decompressed_sha256"] = sha256(nc)
        print(f"   {man[sid]['bytes']:,} bytes  skipped={man[sid]['skipped']}", flush=True)
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    tmp = MANIFEST.with_suffix(".tmp")
    tmp.write_text(json.dumps(man, indent=1, sort_keys=True) + "\n")
    os.replace(tmp, MANIFEST)


if __name__ == "__main__":
    main()
