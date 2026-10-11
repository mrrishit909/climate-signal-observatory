# Limitations (data layer)

1. Anomalies only; no absolute temperatures. Baselines differ by product and are rebased explicitly; baseline-mean uncertainty is not propagated.
2. GISTEMP's 1200 km smoothing makes early and polar coverage look better than raw observations support. HadCRUT5 leaves 20% of cell-months missing. Neither is infilled by us.
3. No ocean-only series; land-only vs land-ocean is a comparison of two GISTEMP products.
4. Only two observational records. Berkeley Earth is excluded for licensing (CC BY-NC); agreement of two analyses is not independent of shared inputs (both use ERSST/HadSST-family ocean data and overlapping station networks).
5. Trend intervals assume linear trend + AR(1)/HAC residuals; the simulation validates coverage only on synthetic AR(1) noise.
6. Change points are exploratory and selected at the search maximum; do not read them as regime shifts or causes.
7. Extremes are annual-mean exceedances, not event statistics.
8. CO2-temperature is association only. Mauna Loa has interpolated/flagged months and a 2022-23 site interruption.
9. AR6 numbers are published assessments for 20-year averages vs 1850-1900; scenarios are not forecasts by this project. The AR6 licence page could not be verified (HTTP 403); only short factual values with page citations are used.
10. Grids are 0.1 C Int8 (max error 0.05 C), 2 degree (GISTEMP) and 5 degree (HadCRUT5); small features below that scale are not shown. 2026 is a partial year and excluded from annual maps and trends.
11. GISTEMP formal data licence and NOAA GML public-domain status are not stated on the pages checked; acknowledgment and citation are provided.

## Additions for the site release

12. Baselines differ by product (GISTEMP 1951-1980, HadCRUT5 1961-1990, AR6 1850-1900) and are rebased explicitly in the pipeline. GISTEMP starts in 1880, so a 1850-1900 baseline is withheld for it rather than approximated with 1880-1900. The standard error of the reference mean is not propagated.
13. GISTEMP extrapolates station anomalies up to 1200 km, which is the source's smoothing, not ours; early and polar coverage look better than raw observations support.
14. Missing cells are kept missing, not infilled: 10.9% of monthly GISTEMP 2-degree cells and 20.0% of HadCRUT5 5-degree cells (10.86% and 20.01% in `reconciliation.json`).
15. Grids are Int8 at 0.1 C, so a displayed cell can differ from the source by up to 0.05 C. Cell trends are Int8 at 0.01 C/decade; about 0.2% of cell-period trends exceed 1.27 C/decade and are clipped (counted in the sidecar).
16. Cell-level trend significance is the AR(1) flag per cell with no multiple-testing correction; with thousands of cells some flagged cells are expected by chance. No per-cell interval is published, so the cell inspector shows significance only.
17. The AR(1)-adjusted interval is not exact: in a simulation on synthetic AR(1) noise (SIMULATED, 2000 runs, n = 50, phi = 0.5) the nominal 95% intervals covered the true slope 73% (naive), 93% (AR(1)-adjusted), 83% (HAC).
18. The AR6 licence page returned HTTP 403 and could not be verified. Only short factual values are quoted, each with its page citation, and a test re-extracts the PDF text to confirm them.
19. The far-north band is 60-90N and is called "the far north (60-90N)", never "the Arctic Circle" (66.5N). Bands are anomaly boxes, so a single cell is noise and large-area means are signal.
20. Natural Earth coastline and land are fetched from the `master` branch of nvkelso/natural-earth-vector, so the URLs track master and could change; the sha256 of the files used is recorded in the manifest.
21. Headless performance numbers (when measured) come from SwiftShader software rendering, not a physical GPU. They are not device measurements and say nothing about real frame rates on phones or laptops.
22. Without WebGL2 the site shows a flat Canvas2D map (`site/src/gl/paint2d.ts`) instead of the globe; it is painted from the same frame data with no crossfades (the same painter serves reduced-motion static frames).
23. The 2026 year is partial (9 months GISTEMP, 8 months HadCRUT5) and is shown only as a labelled year-to-date value, excluded from annual maps, ranks and trends.
