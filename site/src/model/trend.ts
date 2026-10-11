/**
 * Client trend model (S05 Zero Lab): the analytics/stats.py ols_trend method,
 * mirrored for parity with every trends.json fit. Slope per decade; three 95%
 * intervals: naive, AR(1)-adjusted (primary: n_eff = n (1 - r1) / (1 + r1),
 * t with n_eff - 2 df, Santer et al. 2000) and Newey-West HAC.
 */

/** ln Gamma (Lanczos, g = 7). */
function lgamma(x: number): number {
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
  x -= 1;
  let a = c[0]!;
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += c[i]! / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/** Regularized incomplete beta I_x(a, b) (continued fraction). */
function betainc(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x > (a + 1) / (a + b + 2)) return 1 - betainc(1 - x, b, a);
  let c = 1, d = 1 - ((a + b) * x) / (a + 1);
  d = 1 / (Math.abs(d) < 1e-300 ? 1e-300 : d);
  let f = d;
  for (let m = 1; m <= 300; m++) {
    for (const num of [(m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m)), -((a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1))]) {
      d = 1 + num * d; d = 1 / (Math.abs(d) < 1e-300 ? 1e-300 : d);
      c = 1 + num / c; if (Math.abs(c) < 1e-300) c = 1e-300;
      f *= c * d;
    }
    if (Math.abs(c * d - 1) < 1e-15) break;
  }
  return (front * f) / a;
}

/** Student t CDF for any real df > 0. */
export function tCdf(t: number, df: number) {
  const x = df / (df + t * t);
  const tail = 0.5 * betainc(x, df / 2, 0.5);
  return t >= 0 ? 1 - tail : tail;
}

/** Student t quantile (bisection to 1e-12; df may be fractional, as n_eff - 2 is). */
export function tQuantile(p: number, df: number) {
  let lo = 0, hi = 1;
  while (tCdf(hi, df) < p) hi *= 2;
  for (let i = 0; i < 200 && hi - lo > 1e-13; i++) {
    const mid = (lo + hi) / 2;
    if (tCdf(mid, df) < p) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

export interface TrendFit {
  n: number; slope: number; intercept: number; r1: number; nEff: number;
  ciNaive: [number, number]; ciAr1: [number, number]; ciHac: [number, number];
}

/** OLS over (years, values) with nulls dropped. Returns per-DECADE slope and CIs, or null under 10 valid years. */
export function olsTrend(years: readonly number[], values: readonly (number | null)[]): TrendFit | null {
  const xs: number[] = [], ys: number[] = [];
  years.forEach((x, i) => { const y = values[i]; if (y !== null && y !== undefined && Number.isFinite(y)) { xs.push(x); ys.push(y); } });
  const n = xs.length;
  if (n < 10) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) { sxx += (xs[i]! - mx) ** 2; sxy += (xs[i]! - mx) * (ys[i]! - my); }
  const b = sxy / sxx, a = my - b * mx;
  const e = xs.map((x, i) => ys[i]! - (a + b * x));
  const sse = e.reduce((s, v) => s + v * v, 0);
  const se = Math.sqrt(sse / (n - 2) / sxx);
  const t = tQuantile(0.975, n - 2);
  let num = 0;
  for (let i = 1; i < n; i++) num += e[i]! * e[i - 1]!;
  const r1 = num / sse;
  let nEff = r1 > 0 ? (n * (1 - r1)) / (1 + r1) : n;
  nEff = Math.min(Math.max(nEff, 3), n);
  const seAr = nEff < n ? Math.sqrt(sse / (nEff - 2) / sxx) : se;
  const tAr = tQuantile(0.975, nEff - 2);
  const Lg = Math.floor(4 * (n / 100) ** (2 / 9));
  const uu = xs.map((x, i) => (x - mx) * e[i]!);
  let S = uu.reduce((s, v) => s + v * v, 0);
  for (let k = 1; k <= Lg; k++) {
    let acc = 0;
    for (let i = k; i < n; i++) acc += uu[i]! * uu[i - k]!;
    S += 2 * (1 - k / (Lg + 1)) * acc;
  }
  const seHac = Math.sqrt((S * n) / (n - 2)) / sxx;
  const d = (lo: number, hi: number): [number, number] => [lo * 10, hi * 10];
  return {
    n, slope: b * 10, intercept: a, r1, nEff,
    ciNaive: d(b - t * se, b + t * se), ciAr1: d(b - tAr * seAr, b + tAr * seAr), ciHac: d(b - t * seHac, b + t * seHac),
  };
}

/** TREND layer bins (VISUAL_DESIGN 0): anomaly hues with edges at +-0.05, 0.1, 0.2, 0.4, 0.6 C/decade; v in 0.01 C/decade. */
export function trendBinIndex(v: number) {
  if (v <= -60) return 0;
  if (v <= -40) return 1;
  if (v <= -20) return 2;
  if (v <= -10) return 3;
  if (v <= -5) return 4;
  if (v < 5) return 5;
  if (v < 10) return 6;
  if (v < 20) return 7;
  if (v < 40) return 8;
  if (v < 60) return 9;
  return 10;
}
export const TREND_EDGE_LABELS = ["-0.6", "-0.4", "-0.2", "-0.1", "-0.05", "+0.05", "+0.1", "+0.2", "+0.4", "+0.6"];
