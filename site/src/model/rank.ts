/** Rank of year index i among the non-null values (1 = warmest) and the count of ranked years. */
export function rankOf(values: readonly (number | null)[], i: number): { rank: number; of: number } | null {
  const v = values[i];
  if (v === null || v === undefined) return null;
  let rank = 1, of = 0;
  for (const x of values) {
    if (x === null) continue;
    of++;
    if (x > v) rank++;
  }
  return { rank, of };
}

/**
 * Rebasing is a constant shift, so a rank is a property of the source, not the
 * baseline. Values are published to 3 decimals, which can create or break ties
 * differently per baseline, so ranks are always taken on this one baseline.
 */
export const RANK_BASELINE = "1951-1980";
