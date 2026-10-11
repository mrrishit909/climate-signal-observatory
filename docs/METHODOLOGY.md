# Methodology

Every step is implemented in `analytics/` and `pipelines/modeling/build.py`, and every number the site shows comes from
`site/public/data/facts.json`. Figures below are from the run of 2026-10-10 (data vintage in `meta.json`); the site must read the artifacts, not this page.

## 1. Cleaning and accounting (`pipelines/cleaning/clean.py`)
- GISTEMP tables: `***` = missing month (counted). HadCRUT5 summary series have no gaps. NOAA MLO: `sdev < 0 or unc < 0` flags interpolated or no-daily-data months (196 of 823 rows).
- Grids are read twice in the tests (netCDF4 masked arrays) to confirm valid-cell counts independently of the pipeline. GISTEMP: 28,528,200 monthly cells, 10.86% missing. HadCRUT5: 5,495,040 cells, 20.01% missing.
- Annual cell mean = mean of the 12 monthly values of a complete calendar year, requiring at least 9 valid months. The partial current year (2026) is excluded from every annual product.

## 2. Baselines (`analytics/core.py`)
- Series: per calendar month m, offset_m = mean of the native monthly anomaly over the reference years (every month needs >= 80% of reference years); rebased = native - offset_m.
  Annual = mean of the 12 rebased months. Known-value tests: rebased series average exactly 0 over the reference period; 1951-1980 -> 1991-2020 equals the direct rebase to 1e-9.
- Grids: per-cell offset = mean of the cell's annual values over the reference years (>= 80% valid), shipped in the grid sidecar. The client subtracts it.
- GISTEMP 1951-1980 -> 1991-2020 offset: +0.611 C. HadCRUT5 1961-1990 -> 1850-1900: -0.359 C (so 1850-1900 is 0.36 C cooler than 1961-1990).
- GISTEMP cannot be put on 1850-1900 (it starts 1880; only 21 of 51 years). That baseline is withheld for GISTEMP rather than silently using 1880-1900.
- Baseline uncertainty (the standard error of the reference mean) is not added to published intervals.

## 3. Trends (`analytics/stats.py`)
- OLS slope on annual global anomalies per period. Three 95% intervals: naive; **AR(1)-adjusted (primary)** using n_eff = n(1-r1)/(1+r1) and a t distribution with n_eff-2 df (Santer et al. 2000); Newey-West HAC (Bartlett, lags floor(4(n/100)^(2/9))), verified equal to statsmodels in tests.
- Residual lag-1 autocorrelation of 1975-2025 GISTEMP is 0.33 (n_eff 26 of 51), widening the interval half-width from 0.020 to 0.030 C/decade. Over 1880-2025 r1 is 0.80 and the interval is about 3.4x wider than naive.
- Method check on synthetic AR(1) noise (SIMULATED, 2000 runs, n = 50, phi = 0.5): 95% intervals cover the true slope 73% (naive), 93% (AR(1)-adjusted), 83% (HAC). The tests require naive < AR(1) and AR(1) above 90%.
- LOESS: classic local-linear tricube, span 30 years, no robustness iterations. Band: 2.5-97.5 percentile of 500 moving-block (10-year) residual bootstrap refits. It shows smoother variability only, never measurement uncertainty.
- Rolling 30-year slopes with the same AR(1) interval.

## 4. Regional summaries and land vs land-ocean
- Five latitude bands (66.5N-90N, 30-66.5N, 30S-30N, 66.5S-30S, 90S-66.5S). Cell-rebased anomalies, cos(lat) weights over observed cells; a band-year with less than 40% observed area is null; the observed area share is published beside every value.
- Land-only (GISTEMP station series) vs land-ocean (blended) are two GISTEMP products. The difference is not an ocean series. AR6 published land and ocean values are shown only as labelled context.

## 5. Extremes frequency
- Per cell, the 95th/5th percentile of its own annual anomalies over a reference period (1951-1980, alternatively 1991-2020; >= 24 valid years). Metric = cos(lat)-weighted share of observed area above/below it, plus fixed +1 and +2 C (vs 1951-1980).
- In the reference years the in-sample share is 6.7% (2 of 30 values exceed the interpolated 95th percentile); the latest year (2025) is 83% of observed area against that. Annual means only: not heatwaves.

## 6. Change points (EXPLORATORY)
- Continuous piecewise-linear (hinge) regression, exhaustive least-squares search, minimum segment 15 years, up to 3 breaks (k=3 on a 2-year grid). Selection by AR(1)-adjusted BIC; bootstrap break intervals (200 block resamples).
- Both series select k=3 (the search maximum): GISTEMP 1912, 1942, 1972; HadCRUT5 1912, 1940, 1970. That is a sign of a curved trend rather than discrete regimes; the caveat is in the artifact.

## 7. Cross-source agreement
- Annual GISTEMP vs HadCRUT5 1880-2025 on a common baseline: corr 0.992, RMSD 0.052 C, mean difference 0.000 C (1951-1980), trend gap -0.005 C/decade (HadCRUT5 slightly steeper).
- Coverage-matched comparison: both grids rebased per cell to 1951-1980, aggregated to 10 degree boxes (box needs >= 50% observed), compared over boxes observed by both: RMSD 0.043 C. So coverage explains part but not all of the disagreement.
- Hemispheres and decades reported; the largest annual difference is 1892 (0.15 C).

## 8. CO2
- NOAA global marine-surface annual means 1979-2025 against GISTEMP annual anomaly. Levels corr 0.95, first differences 0.19, detrended 0.53. Association only. Mauna Loa is shown for context (flagged months and the 2022-23 interruption documented).

## 9. AR6
- Table SPM.1 and A.1.2 values transcribed to `data/reference/*.csv`; `validation.ar6_text_check` re-extracts the PDF page and finds all 57 numbers. HadCRUT5 rebased to 1850-1900 gives 1.12 C for 2011-2020 against AR6's assessed 1.09 [0.95, 1.20] C (inside the range; AR6 is a multi-dataset assessment).

## 10. Grid artifacts
See `DATA_CONTRACTS.md`. Quantization max error 0.05 C (tested), no clipping, 0.76 MB gzip for both grids.
