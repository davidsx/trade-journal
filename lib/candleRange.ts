/**
 * Yahoo chart API allows only a short span for 1m bars (about 7 days).
 * Use a rolling window ending at "now" when there are no trades to anchor on.
 */
export const CANDLE_FETCH_WINDOW_SEC = 6 * 24 * 60 * 60;

/** Max span per Yahoo request for 1m; wider ranges are fetched in chunks. */
export const CANDLE_CHUNK_FETCH_SEC = 5 * 24 * 60 * 60;

export function defaultCandlePeriodUnix(nowSec = Math.floor(Date.now() / 1000)) {
  const period2 = nowSec;
  const period1 = period2 - CANDLE_FETCH_WINDOW_SEC;
  return { period1: String(period1), period2: String(period2) };
}
