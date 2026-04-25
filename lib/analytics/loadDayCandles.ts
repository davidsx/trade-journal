import {
  readMergedCandlesFromFile,
  fetchCandlesForRange,
  writeMergedCache,
  type Candle as ServerCandle,
} from "@/lib/candles/candlesServer";

export type Candle = ServerCandle;

const DAY_CHART_SYMBOL = "MNQ=F";
const DAY_CHART_INTERVAL = "1m";

/** CME NQ/MNQ session window in Unix seconds (HKT rules below). */
function cmeTradingDayUnixRange(tradeTime: Date): { startS: number; endS: number } {
  const HKT_OFFSET_MS = 8 * 60 * 60 * 1000;
  const hktMs = tradeTime.getTime() + HKT_OFFSET_MS;
  const hktDate = new Date(hktMs);
  const hktHour = hktDate.getUTCHours();

  const sessionDateUtcMs =
    Date.UTC(hktDate.getUTCFullYear(), hktDate.getUTCMonth(), hktDate.getUTCDate()) -
    HKT_OFFSET_MS +
    (hktHour < 6 ? -24 * 60 * 60 * 1000 : 0);

  const tradingDayStartUtcMs = sessionDateUtcMs + 6 * 60 * 60 * 1000;
  const tradingDayEndUtcMs = tradingDayStartUtcMs + 23 * 60 * 60 * 1000;

  return {
    startS: tradingDayStartUtcMs / 1000,
    endS: tradingDayEndUtcMs / 1000,
  };
}

/**
 * NQ/MNQ futures trading day definition (HKT = UTC+8):
 *   Start : 06:00 HKT  (= 22:00 UTC prev day = 18:00 ET  — CME open)
 *   End   : 05:00 HKT  (= 21:00 UTC same day  = 17:00 ET  — CME close)
 *   Break : 05:00–06:00 HKT (CME maintenance)
 *
 * A trade at HKT hour < 6 belongs to the trading day that STARTED the previous
 * calendar day; a trade at HKT hour >= 6 belongs to the trading day that starts
 * on that calendar day.
 *
 * Examples (HKT):
 *   Apr 10 00:50 HKT  →  trading day Apr 9 06:00 → Apr 10 05:00 HKT
 *   Apr 10 12:00 HKT  →  trading day Apr 10 06:00 → Apr 11 05:00 HKT
 *
 * `loadDayCandles` reads `data/candles-cache.json` first (no TTL); Yahoo runs only if that slice is empty.
 *
 * `refInstantForCmeSessionDayKeyHkt` — a UTC instant in the CME session labeled `dayKey` (`YYYY-MM-DD`).
 */
export function refInstantForCmeSessionDayKeyHkt(isoYmd: string): Date {
  const [y, m, d] = isoYmd.split("-").map(Number);
  if (!y || !m || !d) {
    throw new Error(`Invalid trading day key: ${isoYmd}`);
  }
  // 12:00 HKT = 04:00 UTC — inside the 06:00–05:00 HKT next-day session
  return new Date(Date.UTC(y, m - 1, d, 4, 0, 0, 0));
}

/** 1m candles for the CME session identified by the calendar’s `tradingDayKeyHkt` string. */
export async function loadDayCandlesForTradingDayKey(isoYmd: string): Promise<Candle[]> {
  return loadDayCandles(refInstantForCmeSessionDayKeyHkt(isoYmd));
}

export async function loadDayCandles(tradeTime: Date): Promise<Candle[]> {
  const { startS, endS } = cmeTradingDayUnixRange(tradeTime);
  const period1 = String(startS);
  const period2 = String(endS);

  const fromFile = await readMergedCandlesFromFile(
    DAY_CHART_SYMBOL,
    DAY_CHART_INTERVAL,
    period1,
    period2
  );
  if (fromFile) {
    const strict = fromFile.filter((c) => c.time >= startS && c.time < endS);
    if (strict.length > 0) return strict;
  }

  try {
    const { candles } = await fetchCandlesForRange(
      DAY_CHART_SYMBOL,
      DAY_CHART_INTERVAL,
      period1,
      period2
    );
    if (candles.length > 0) {
      await writeMergedCache(DAY_CHART_SYMBOL, DAY_CHART_INTERVAL, period1, period2, candles);
    }
    return candles.filter((c) => c.time >= startS && c.time < endS);
  } catch {
    return [];
  }
}
