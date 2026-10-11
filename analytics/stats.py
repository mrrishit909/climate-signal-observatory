"""Trend statistics: OLS with naive / AR(1)-adjusted / HAC CIs, LOESS + block bootstrap, rolling trends, piecewise-linear search."""
from __future__ import annotations

import itertools
import math

import numpy as np
from scipy import stats as sps
from statsmodels.nonparametric.smoothers_lowess import lowess


def ols_trend(x: np.ndarray, y: np.ndarray) -> dict:
    """x in years. Returns slope per YEAR and three 95% CIs (per year). Rows with NaN dropped."""
    m = np.isfinite(y) & np.isfinite(x)
    x, y = x[m], y[m]
    n = len(x)
    xc = x - x.mean()
    sxx = (xc ** 2).sum()
    b = (xc * (y - y.mean())).sum() / sxx
    a = y.mean() - b * x.mean()
    e = y - (a + b * x)
    sse = (e ** 2).sum()
    s2 = sse / (n - 2)
    se = math.sqrt(s2 / sxx)
    t = sps.t.ppf(0.975, n - 2)
    r1 = float((e[1:] * e[:-1]).sum() / (e ** 2).sum())
    # AR(1) effective sample size (Santer et al. 2000): n_eff = n (1 - r1) / (1 + r1), only deflated for positive autocorrelation
    n_eff = n * (1 - r1) / (1 + r1) if r1 > 0 else float(n)
    n_eff = max(n_eff, 3.0)
    n_eff = min(n_eff, float(n))
    se_ar = math.sqrt(sse / (n_eff - 2) / sxx) if n_eff < n else se
    t_ar = sps.t.ppf(0.975, n_eff - 2)
    # Newey-West HAC (Bartlett kernel), lag rule floor(4 (n/100)^(2/9)), small-sample factor n/(n-2)
    L = int(math.floor(4 * (n / 100) ** (2 / 9)))
    u = xc * e
    S = (u ** 2).sum()
    for k in range(1, L + 1):
        S += 2 * (1 - k / (L + 1)) * (u[k:] * u[:-k]).sum()
    se_hac = math.sqrt(S * n / (n - 2)) / sxx
    return {"n": n, "slope": b, "intercept": a, "r2": 1 - sse / ((y - y.mean()) ** 2).sum(), "r1": r1, "n_eff": n_eff,
            "ci_naive": (b - t * se, b + t * se), "ci_ar1": (b - t_ar * se_ar, b + t_ar * se_ar), "ci_hac": (b - t * se_hac, b + t * se_hac),
            "se_naive": se, "se_ar1": se_ar, "se_hac": se_hac, "hac_lags": L}


def block_resample(res: np.ndarray, block: int, rng: np.random.Generator) -> np.ndarray:
    n = len(res)
    nb = math.ceil(n / block)
    starts = rng.integers(0, n - block + 1, nb)
    return np.concatenate([res[s:s + block] for s in starts])[:n]


def loess_band(x: np.ndarray, y: np.ndarray, span_years: float, n_boot: int, block: int, seed: int):
    """Classic (non-robust) LOESS fit and a pointwise 95% band from a moving-block residual bootstrap. x/y must be finite."""
    frac = min(1.0, span_years / len(x))
    fit = lowess(y, x, frac=frac, it=0, return_sorted=False)
    res = y - fit
    rng = np.random.default_rng(seed)
    boots = np.empty((n_boot, len(x)))
    for i in range(n_boot):
        boots[i] = lowess(fit + block_resample(res, block, rng), x, frac=frac, it=0, return_sorted=False)
    return fit, np.percentile(boots, 2.5, 0), np.percentile(boots, 97.5, 0), frac


def rolling_trends(x: np.ndarray, y: np.ndarray, window: int):
    end, sl, lo, hi = [], [], [], []
    for i in range(0, len(x) - window + 1):
        xs, ys = x[i:i + window], y[i:i + window]
        if np.isfinite(ys).sum() < window:
            continue
        t = ols_trend(xs, ys)
        end.append(int(xs[-1]))
        sl.append(t["slope"] * 10)
        lo.append(t["ci_ar1"][0] * 10)
        hi.append(t["ci_ar1"][1] * 10)
    return end, sl, lo, hi


# ---- piecewise linear (continuous) with k breaks -------------------------------------------------

def _combos(cands: list[int], k: int, min_gap: int):
    def rec(start, left, chosen):
        if left == 0:
            yield tuple(chosen)
            return
        for j in range(start, len(cands)):
            if chosen and cands[j] - chosen[-1] < min_gap:
                continue
            yield from rec(j + 1, left - 1, chosen + [cands[j]])
    return list(rec(0, k, []))


def design(t: np.ndarray, breaks: tuple[int, ...]) -> np.ndarray:
    cols = [np.ones_like(t), t - t[0]] + [np.maximum(t - b, 0.0) for b in breaks]
    return np.stack(cols, 1)


class PiecewiseSearch:
    """Exhaustive search of continuous piecewise-linear fits over a grid of candidate break years.

    XtX inverses are computed once so that bootstrap replicates only need X^T y per candidate (batched)."""

    def __init__(self, t: np.ndarray, k: int, min_seg: int, step: int):
        self.t, self.k = t, k
        lo, hi = int(t[0]) + min_seg - 1, int(t[-1]) - min_seg + 1
        cands = [b for b in range(lo, hi + 1) if (b - lo) % step == 0] if k else []
        self.combos = _combos(cands, k, min_seg) if k else [()]
        self.X = np.stack([design(t, c) for c in self.combos])  # (C, n, p)
        XtX = np.einsum("cnp,cnq->cpq", self.X, self.X)
        self.inv = np.linalg.inv(XtX)

    def fit(self, y: np.ndarray):
        Xty = np.einsum("cnp,n->cp", self.X, y)
        beta = np.einsum("cpq,cq->cp", self.inv, Xty)
        sse = y @ y - (beta * Xty).sum(1)
        i = int(np.argmin(sse))
        return self.combos[i], float(sse[i]), beta[i]

    def fitted(self, beta, breaks):
        return design(self.t, breaks) @ beta


def segment_slopes(beta: np.ndarray) -> list[float]:
    """Slopes (per year) of each segment from hinge coefficients: slope0 = b1, slope_j = slope_{j-1} + hinge_j."""
    s = [beta[1]]
    for h in beta[2:]:
        s.append(s[-1] + h)
    return s


def adj_bic(sse: float, n: int, k: int, r1: float):
    """BIC with the likelihood scaled to the AR(1) effective sample size of the model's own residuals."""
    n_eff = n * (1 - r1) / (1 + r1) if r1 > 0 else n
    n_eff = min(max(n_eff, 5.0), n)
    p = 2 + 2 * k + 1  # intercept, slope, hinges, break locations, variance
    return n_eff * math.log(sse / n) + p * math.log(n_eff), n_eff


def hac_cover_sim(n_sims: int, n: int, phi: float, slope_dec: float, seed: int) -> dict:
    """Empirical 95% CI coverage of naive / AR(1)-adjusted / HAC slope CIs on synthetic AR(1)-noise + linear trend. SIMULATED."""
    rng = np.random.default_rng(seed)
    x = np.arange(n, dtype=float)
    hit = {"naive": 0, "ar1": 0, "hac": 0}
    true = slope_dec / 10
    for _ in range(n_sims):
        e = np.zeros(n)
        z = rng.normal(0, 0.1, n)
        e[0] = z[0] / math.sqrt(1 - phi ** 2)
        for i in range(1, n):
            e[i] = phi * e[i - 1] + z[i]
        t = ols_trend(x, true * x + e)
        for k, key in (("naive", "ci_naive"), ("ar1", "ci_ar1"), ("hac", "ci_hac")):
            lo, hi = t[key]
            hit[k] += lo <= true <= hi
    return {k: v / n_sims for k, v in hit.items()}
