import numpy as np
import pytest
import statsmodels.api as sm

from analytics import stats


def ar1(n, phi, sd, seed):
    rng = np.random.default_rng(seed)
    e = np.zeros(n)
    z = rng.normal(0, sd, n)
    e[0] = z[0] / np.sqrt(1 - phi ** 2)
    for i in range(1, n):
        e[i] = phi * e[i - 1] + z[i]
    return e


def test_exact_line_recovered():
    x = np.arange(1900, 1960.0)
    t = stats.ols_trend(x, 0.02 * (x - 1900) + 0.3)
    assert t["slope"] == pytest.approx(0.02) and t["intercept"] + 0.02 * 1900 == pytest.approx(0.3)


def test_hac_matches_statsmodels():
    x = np.arange(1900, 2000.0)
    y = 0.01 * (x - 1900) + ar1(100, 0.6, 0.1, 3)
    t = stats.ols_trend(x, y)
    r = sm.OLS(y, sm.add_constant(x)).fit(cov_type="HAC", cov_kwds={"maxlags": t["hac_lags"], "use_correction": True})
    assert t["se_hac"] == pytest.approx(r.bse[1], rel=1e-9)


def test_autocorrelated_noise_widens_intervals():
    x = np.arange(1950, 2026.0)
    y = 0.02 * (x - 1950) + ar1(len(x), 0.7, 0.1, 5)
    t = stats.ols_trend(x, y)
    w = lambda ci: ci[1] - ci[0]
    assert t["r1"] > 0.3
    assert w(t["ci_ar1"]) > 1.3 * w(t["ci_naive"]) and w(t["ci_hac"]) > w(t["ci_naive"])
    assert 3 <= t["n_eff"] < len(x)


def test_white_noise_does_not_widen():
    x = np.arange(1950, 2026.0)
    y = 0.02 * (x - 1950) + np.random.default_rng(9).normal(0, 0.1, len(x))
    t = stats.ols_trend(x, y)
    assert t["ci_ar1"][1] - t["ci_ar1"][0] <= 1.5 * (t["ci_naive"][1] - t["ci_naive"][0])


def test_coverage_simulation_ordering():
    cov = stats.hac_cover_sim(400, 50, 0.5, 0.2, 1)
    assert cov["naive"] < cov["ar1"] and cov["ar1"] > 0.88 and cov["naive"] < 0.85


def test_piecewise_recovers_known_break():
    t = np.arange(1900, 2000.0)
    y = np.where(t < 1960, 0.0, 0.03 * (t - 1960)) + np.random.default_rng(2).normal(0, 0.03, len(t))
    ps = stats.PiecewiseSearch(t, 1, 15, 1)
    br, sse, beta = ps.fit(y)
    assert abs(br[0] - 1960) <= 3
    s = stats.segment_slopes(beta)
    assert abs(s[0]) < 0.005 and abs(s[1] - 0.03) < 0.005


def test_loess_band_brackets_fit():
    x = np.arange(1900, 2000.0)
    y = 0.01 * (x - 1900) + np.random.default_rng(4).normal(0, 0.1, len(x))
    fit, lo, hi, frac = stats.loess_band(x, y, 30, 100, 10, 1)
    assert (lo <= hi).all() and (lo <= fit + 1e-9).mean() > 0.9 and (hi >= fit - 1e-9).mean() > 0.9
