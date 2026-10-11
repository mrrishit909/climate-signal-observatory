# Problem definition: Climate Signal Observatory ("The Planet Is Speaking in Data")

## Question
How much has the surface of the planet warmed since the 1880s, where and how fast, how sure are we, and do
independent records agree? The product lets a visitor see the evidence (observations), the arithmetic that
turns it into numbers (baselines, trends, uncertainty), and the published projections (IPCC AR6) as three
visibly separate things.

## Audience and use
A curious non-specialist and a technically literate reviewer. The reviewer should be able to check every number on the
site against `facts.json`, the JSON Schemas in `data/contracts/`, and the test suite.

## Scope (what this data layer produces)
1. Global, hemispheric and land-only vs land-ocean annual and monthly temperature anomalies from two independent
   analyses (NASA GISTEMP v4, Met Office HadCRUT5 5.2.0.0), each on explicit, recorded baselines.
2. Gridded annual anomalies for a globe texture (GISTEMP 2 degree, HadCRUT5 5 degree), quantized and documented.
3. Trends with autocorrelation-aware confidence intervals, LOESS smoothing with a bootstrap band, rolling 30-year trends.
4. Latitude-band summaries with the share of area that is actually observed.
5. Extremes frequency: share of area whose annual-mean anomaly exceeds the cell's own reference-period 95th percentile (and fixed thresholds).
6. Piecewise-linear change-point exploration, labeled EXPLORATORY.
7. Cross-source agreement GISTEMP vs HadCRUT5 (differences, correlation, coverage-matched comparison).
8. CO2 (NOAA GML) shown next to temperature as an association only.
9. IPCC AR6 WGI SPM Table SPM.1 assessed ranges, copied as published values with page references.

## Non-goals and hard rules
- No causal claim from CO2 vs temperature. Association only, with the shared-trend caveat quantified.
- No forecast of our own. Every projected number is an IPCC assessed value (tag PREDICTED, by IPCC), never extrapolated here.
- No infilling. Cells missing in the source stay missing; the only missing-data handling is documented aggregation rules.
- No silent baseline mixing. Each series is rebased explicitly, each conversion is recorded in `series_annual.conversions`.
- Annual-mean anomalies are not daily weather and are not extreme-event (heatwave, flood) data.
- Berkeley Earth is not used (CC BY-NC); the non-commercial question is deliberately not depended on.
- No backend: everything is precomputed to static JSON/binary artifacts under `site/public/data/`.

## Success criteria (data layer)
- Every artifact validates against its JSON Schema; arrays of the same logical axis have equal lengths.
- Missing-cell accounting reconciles exactly (see `reconciliation.json` and `tests/test_quality.py`).
- A known-value test proves baseline conversion (rebased series averages to 0 over its reference period).
- Trend CIs are wider than naive OLS CIs under autocorrelation, and a simulation reports empirical coverage.
- GISTEMP and HadCRUT5 agree on the common period to within documented RMSD; the residual disagreement is reported, not hidden.
- Grid artifacts total under 1.5 MB gzip.
- Every number in site copy comes from `facts.json`.

## Honesty tags
OBSERVED (instrument or analysis product as published), DERIVED (our arithmetic on observed data), PREDICTED (IPCC assessed projection,
not ours), SIMULATED (our synthetic-noise method validation only), SYNTHETIC (none used).
