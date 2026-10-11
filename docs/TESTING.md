# Testing (data layer)

`uv run pytest -q` (62 tests, about 5 s after `uv run python -m pipelines.run_all`).

| File | Covers |
|---|---|
| `tests/test_contracts.py` | schemas match the generator and the metaschema; every artifact validates; facts keys complete; tag vocabulary; no U+2014/U+2015 anywhere |
| `tests/test_baselines.py` | known-value baseline conversion on synthetic series with analytic answers; composition; missing stays missing; unavailable baseline refused; grid offsets; weighted means |
| `tests/test_trends.py` | line recovery, HAC equals statsmodels, autocorrelation widens intervals, coverage simulation ordering, piecewise break recovery, LOESS band |
| `tests/test_quality.py` | ranges, null handling by source start year, baseline switch is a constant shift equal to the recorded offset, CI sanity, cross-source alignment, extremes calibration, Arctic amplification, change-point labelling, CO2 association-only, AR6 values vs PDF, grid binary vs sidecar (counts, orientation, hash), size budget, facts match artifacts, file hashes |
| `tests/test_reconciliation.py` | missing-cell identities and an independent netCDF4 recount of valid cells for both grids, CSV sentinel recount, raw hashes |

Slow tests need `data/raw` (re-create with `uv run python -m pipelines.run_all --fetch`).
