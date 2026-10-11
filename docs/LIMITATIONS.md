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
