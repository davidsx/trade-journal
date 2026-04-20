/**
 * Yahoo chart API allows only a short span for 1m bars (about 7 days per request).
 * Use a rolling window ending at "now" when there are no trades to anchor on.
 */
export const CANDLE_FETCH_WINDOW_SEC = 6 * 24 * 60 * 60;

/** Yahoo only retains ~30 days of 1m history; older windows return no bars. */
export const YAHOO_1M_MAX_HISTORY_SEC = 30 * 24 * 60 * 60;

/** Max span per Yahoo request for 1m; wider ranges are fetched in chunks. */
export const CANDLE_CHUNK_FETCH_SEC = 7 * 24 * 60 * 60;

/**
 * Restrict [p1, p2] to the latest window Yahoo can serve for 1m bars.
 * Long trade histories would otherwise produce all-empty chunk fetches.
 */
export function clampUnixRangeForYahoo1m(
  p1: number,
  p2: number
): { p1: number; p2: number; clamped: boolean } {
  const now = Math.floor(Date.now() / 1000);
  const p2n = Math.min(p2, now);
  const oldestAllowed = p2n - YAHOO_1M_MAX_HISTORY_SEC;
  let p1n = Math.max(p1, oldestAllowed);
  let clamped = p1n > p1 || p2n < p2;
  if (p1n >= p2n) {
    p1n = p2n - 7 * 24 * 60 * 60;
    clamped = true;
  }
  return { p1: p1n, p2: p2n, clamped };
}

export function defaultCandlePeriodUnix(nowSec = Math.floor(Date.now() / 1000)) {
  const period2 = nowSec;
  const period1 = period2 - CANDLE_FETCH_WINDOW_SEC;
  return { period1: String(period1), period2: String(period2) };
}
