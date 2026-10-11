/** The one place numbers become copy (VISUAL_DESIGN 5: shares render as whole percents). */
const half = (v: number, d: number) => Math.round(Number((v * 10 ** d).toPrecision(12))) / 10 ** d;
/** Half-up decimal rounding that survives binary floats (1.185 -> "1.19"). */
export const fixed = (v: number, d = 2) => half(v, d).toFixed(d);
export const signed = (v: number, d = 2) => {
  const s = fixed(Math.abs(v), d);
  return `${v < 0 && Number(s) !== 0 ? "-" : "+"}${s}`;
};
export const pct = (share: number) => String(half(share * 100, 0));
export const int = (n: number) => Math.round(n).toLocaleString("en-US");
