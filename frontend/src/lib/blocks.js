// A settlement block seen three ways: its forecast, its costed action, its actual output.

export const BLOCK_HOURS = 0.25;
export const BLOCK_MS = 15 * 60 * 1000;

// Attach each block's recommendation (if its window breached the band) and a numeric time.
export function joinBlocks(forecast, recommendations) {
  const recByStart = new Map(recommendations.map((r) => [r.window_start, r]));
  return forecast.blocks.map((b) => ({
    ...b,
    t: new Date(b.target_timestamp).getTime(),
    rec: recByStart.get(b.target_timestamp) ?? null,
  }));
}

export const sum = (items, fn) => items.reduce((acc, x) => acc + (fn(x) ?? 0), 0);

export const maxBy = (items, fn) =>
  items.reduce((best, x) => (best == null || fn(x) > fn(best) ? x : best), null);
