# Data sources, provenance and licensing

Verified 2026-10-10 (HTTP HEAD/GET; bytes, sha256, Last-Modified and retrieval time in `data/manifests/raw_manifest.json`,
re-created by `uv run python -m pipelines.ingestion.fetch`). Upstream files are re-published monthly, so the recorded Last-Modified
is the vintage. Byte counts for the Met Office CSVs are of the decoded body (the server sends them content-encoded).

| Id | Source | Used for | Format | Native baseline | Terms | Tag |
|---|---|---|---|---|---|---|
| gistemp_grid | NASA GISS GISTEMP v4, `gistemp1200_GHCNv4_ERSSTv5.nc.gz` (GHCNv4 land + ERSSTv5 ocean, 1200 km smoothing) | 2 degree grid 1880-01..latest, regional summaries, extremes | gzipped NetCDF, 25.9 MB, 90 x 180 | 1951-1980 | No data licence stated; GISS asks for acknowledgment ("NASA GISS/GISTEMP"). Formal data licence UNVERIFIED | OBSERVED |
| gistemp_glb/nh/sh | `tabledata_v4/{GLB,NH,SH}.Ts+dSST.csv` (land-ocean) | global/hemispheric monthly | CSV, ~12.9 KB; missing = `***` | 1951-1980 | same | OBSERVED |
| gistemp_glb_landonly | `tabledata_v4/GLB.Ts.csv` (meteorological stations only, no ocean) | land vs land-ocean | CSV | 1951-1980 | same | OBSERVED |
| hadcrut5_grid | Met Office / UEA HadCRUT5 5.2.0.0 analysis ensemble mean, 5 degree (36 x 72), 1850-01..latest | cross-source grid, 1850-1900 baseline | NetCDF, 32.8 MB | 1961-1990 | Open Government Licence v3.0 (stated in file attributes). Cite Morice et al. 2021, JGR Atmospheres, doi 10.1029/2019JD032361 | OBSERVED |
| hadcrut5_glb/nh/sh monthly + annual | `analysis/diagnostics/*summary_series.{global,northern_hemisphere,southern_hemisphere}.{monthly,annual}.csv` | series with 95% CI | CSV | 1961-1990 | OGL v3 | OBSERVED |
| noaa_co2_mlo / gl | NOAA GML `co2_mm_mlo.csv` (1958-03..), `co2_mm_gl.csv` (1979-01..) | CO2 association | CSV, ppm | n/a | Freely available; GML asks for citation (Lan, Tans, Thoning, doi 10.15138/9N0H-ZH07). Formal public-domain statement UNVERIFIED | OBSERVED |
| ipcc_ar6_spm | IPCC AR6 WGI Summary for Policymakers PDF, Table SPM.1 (PDF p.18, printed p.14) and A.1.2 (PDF p.9, printed p.5) | assessed warming ranges, published observed warming | PDF 3.7 MB, transcribed to `data/reference/*.csv` | 1850-1900 | AR6 licence page returned 403 and could not be verified; only short factual values are quoted, each with page citation. A test re-extracts the PDF text to confirm every transcribed value | PREDICTED (by IPCC, not by us) |
| ne_110m_coastline / ne_110m_land | Natural Earth 110m, GeoJSON from github.com/nvkelso/natural-earth-vector (140 KB each) | coastlines, land fraction per cell | GeoJSON | n/a | Public domain (terms page quoted: "All versions of Natural Earth raster + vector map data found on this website are in the public domain") | OBSERVED |

URLs: see `pipelines/ingestion/fetch.py` (single source of truth) and `research/P03-sources.md` in the workspace.

## Not used
- Berkeley Earth (CC BY-NC 4.0): deliberately excluded.
- HadCRUT5 5.0.2.0 (superseded), GISTEMP zarr copy (redundant), GISTEMP zonal annual CSV (we compute our own bands from the grid).
- Ocean-only series: neither product publishes one in the files used (see LIMITATIONS: land-only vs land-ocean is shown, never "ocean = difference").
- HadCRUT5 ensemble members (not downloaded); uncertainty comes from the published summary-series 95% CI (which includes the ensemble).

## Product facts that matter for interpretation
- GISTEMP: "normal" means the 1951-1980 average for that place and time of year. GISTEMP extrapolates station anomalies up to 1200 km, so it
  has far fewer missing cells than HadCRUT5, especially before 1950 and in the Arctic. That is smoothing by the source, not by us.
- HadCRUT5 ensemble-mean grid is statistically infilled by the Met Office (Gaussian-process style analysis) only where the analysis does so; cells with no value remain missing in the file and in our artifacts.
- Anomalies, not absolute temperatures. Grid cells are anomaly boxes; a single hot or cold cell is noise, large-area means are signal.
- Latest year may be partial (2026 is Jan to Aug/Sep). Partial years are excluded from annual products and reported separately.
