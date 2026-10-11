"""Known-value tests for baseline conversion and annual aggregation (synthetic series with analytic answers)."""
import numpy as np
import pytest

from analytics import core


def synth(n_years=60, seasonal=True):
    y = np.repeat(np.arange(1850, 1850 + n_years), 12)
    m = np.tile(np.arange(12), n_years)
    return 0.01 * (y - 1850) + (np.sin(m) if seasonal else 0.0), y, m


def test_rebase_known_value():
    x, y, m = synth()
    # baseline 1850-1900 on a series that is exactly linear + seasonal: offset_m = 0.01*(mean(1850..1900) - 1850) + sin(m) = 0.25 + sin(m)
    r, off, cnt = core.rebase_monthly(x, "1850-1900")
    assert np.allclose(off, 0.25 + np.sin(np.arange(12)))
    assert np.allclose(r, 0.01 * (y - 1875))  # seasonal cycle removed, linear part centred on the reference mean year
    assert (cnt == 51).all()


def test_rebased_series_averages_zero_over_reference():
    x, y, m = synth()
    r, *_ = core.rebase_monthly(x, "1850-1900")
    sel = (y >= 1850) & (y <= 1900)
    for k in range(12):
        assert abs(r[sel & (m == k)].mean()) < 1e-12


def test_conversion_composes():
    x = np.random.default_rng(1).normal(size=2000)
    a = core.rebase_monthly(core.rebase_monthly(x, "1951-1980")[0], "1991-2020")[0]
    b = core.rebase_monthly(x, "1991-2020")[0]
    assert np.allclose(a, b)


def test_offset_equals_difference_of_baseline_means():
    # GISTEMP-like: 1951-1980 -> 1991-2020 offset is the 1991-2020 mean on the 1951-1980 scale
    x, *_ = synth(200)
    r1, o1, _ = core.rebase_monthly(x, "1951-1980")
    r2, o2, _ = core.rebase_monthly(x, "1991-2020")
    assert np.allclose(r1 - r2, (o2 - o1)[np.arange(len(x)) % 12])


def test_missing_stays_missing_and_unavailable_baseline_is_refused():
    x, *_ = synth(60)
    x[5] = np.nan
    r, *_ = core.rebase_monthly(x, "1850-1900")
    assert np.isnan(r[5]) and np.isfinite(r[6])
    y = x.copy()
    y[:12 * 30] = np.nan  # series starting in 1880: no 1850-1900 baseline (only 21 of 51 years)
    assert core.rebase_monthly(y, "1850-1900") is None


def test_annual_requires_all_12_months():
    x, *_ = synth(3, seasonal=False)
    x[13] = np.nan
    a = core.annual_from_monthly(x, 1852)
    assert np.isfinite(a[0]) and np.isnan(a[1]) and np.isfinite(a[2])
    assert a[0] == pytest.approx(0.0)


def test_grid_offsets_known_value_and_threshold():
    years = np.arange(1951, 1981)
    ann = np.zeros((30, 2, 2))
    ann[:, 0, 0] = np.arange(30)  # mean 14.5
    ann[:, 0, 1] = np.nan
    ann[:, 1, 0] = np.nan
    ann[:25, 1, 0] = 2.0  # 25/30 valid -> accepted
    ann[:, 1, 1] = np.nan
    ann[:10, 1, 1] = 1.0  # 10/30 -> refused
    off = core.grid_offsets(ann, years, "1951-1980")
    assert off[0, 0] == pytest.approx(14.5)
    assert np.isnan(off[0, 1]) and off[1, 0] == pytest.approx(2.0) and np.isnan(off[1, 1])


def test_weighted_mean_ignores_missing_and_reports_share():
    lat = np.array([0.0, 60.0])
    w = core.lat_weights(lat)
    v = np.array([[1.0, np.nan], [1.0, 3.0]])
    mean, share = core.weighted_mean(v, w)
    assert mean[0] == pytest.approx(1.0) and mean[1] == pytest.approx((1 * 1 + 3 * 0.5) / 1.5)
    assert share[0] == pytest.approx(1 / 1.5)
