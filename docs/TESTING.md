# Testing (data layer)

`uv run pytest -q` (80 tests as of 2026-10-11, see Results below).

| File | Covers |
|---|---|
| `tests/test_contracts.py` | schemas match the generator and the metaschema; every artifact validates; facts keys complete; tag vocabulary; no U+2014/U+2015 anywhere |
| `tests/test_baselines.py` | known-value baseline conversion on synthetic series with analytic answers; composition; missing stays missing; unavailable baseline refused; grid offsets; weighted means |
| `tests/test_trends.py` | line recovery, HAC equals statsmodels, autocorrelation widens intervals, coverage simulation ordering, piecewise break recovery, LOESS band |
| `tests/test_quality.py` | ranges, null handling by source start year, baseline switch is a constant shift equal to the recorded offset, CI sanity, cross-source alignment, extremes calibration, Arctic amplification, change-point labelling, CO2 association-only, AR6 values vs PDF, grid binary vs sidecar (counts, orientation, hash), size budget, facts match artifacts, file hashes |
| `tests/test_requests.py` | intro layers equal full-grid layers; cell-trend grid parity with `ols_trend` on sampled cells and counts; zonal fixture parity with `analytics/zonal.py` and the 20% rule; coastlines well-formed; land fraction on known places; land warms faster than ocean; band edges and band trends; design-requested facts |
| `tests/test_reconciliation.py` | missing-cell identities and an independent netCDF4 recount of valid cells for both grids, CSV sentinel recount, raw hashes |

Slow tests need `data/raw` (re-create with `uv run python -m pipelines.run_all --fetch`).
| `site/src/**/*.test.ts` | Vitest (6 files): loader states, copy deck, progress, trend/zonal/rank parity with Python artifacts, Stage B models |

Slow tests need `data/raw` (re-create with `uv run python -m pipelines.run_all --fetch`). Four tests in `test_reconciliation.py` skip when `data/raw` is absent (`slow` skipif in `tests/conftest.py`) and one in `test_requests.py` skips without `data/interim`; the `slow` marker is not applied, so `-m "not slow"` deselects nothing.

## Results

Every figure below comes from a command run on 2026-10-11 on the build machine (macOS, Python 3.12 via uv). Unrun items say `TBD (pending QA)`. Green tests are necessary, not sufficient; independent visual QA of real screenshots is still required.

| Command | Result |
|---|---|
| `uv run pytest -q` (project root, full data present) | 80 passed |
| `uv run pytest -q` in a fresh `git clone` after `uv sync --frozen` (no `data/raw`, no `data/interim`, as in CI) | 75 passed, 5 skipped |
| `npm run typecheck` (site) | clean |
| `npm run lint` (site) | clean |
| `npm test` (site, Vitest 5.0.3) | 6 test files, 117 tests passed |
| `npm run e2e` (Playwright against the production build) | TBD (pending QA). Not run for this document because it rebuilds `site/dist`. Specs `site/e2e/{prototype,shell,stageb}.spec.ts` contain 31 `test(` calls (grep count) |
| `npm run build` | TBD (pending QA) |

## Quality gates not yet measured

| Gate | Target | Result |
|---|---|---|
| Lighthouse performance (production build) | 90+ | TBD (pending QA) |
| Lighthouse accessibility | 95+ | TBD (pending QA) |
| LCP | 2.5 s or less | TBD (pending QA) |
| CLS | 0.1 or less | TBD (pending QA) |
| axe-core on every scene at 3 breakpoints | 0 violations | TBD (pending QA) |
| Frame pacing (desktop ~60 fps, mobile ~30 fps+), device stated | per gate | TBD (pending QA). Headless runs use SwiftShader, not a device |
| Screenshots at 1440x900, 768x1024, 390x844 plus scroll recording | read by an independent QA pass | TBD (pending QA) for the final build; earlier stage evidence is in `artifacts/evidence/stage-a`, `stage-b` |
| Public URL checked with curl and a real screenshot | HTTP 200 + screenshot | TBD (pending deploy) |

## CI

`.github/workflows/ci.yml` runs `uv run pytest -q` (Python 3.12; the 5 tests needing raw data skip themselves) and the site typecheck, lint, Vitest and build. Playwright e2e is excluded from CI: it needs browser binaries and WebGL and was only verified locally. Run it locally before every deploy.
