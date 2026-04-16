import { readFileSync, existsSync } from "fs";
import { join } from "path";

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
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
 */
export function loadDayCandles(tradeTime: Date): Candle[] {
  try {
    const path = join(process.cwd(), "data", "candles-cache.json");
    if (!existsSync(path)) return [];
    const cache = JSON.parse(readFileSync(path, "utf-8"));
    const all: Candle[] = cache.candles ?? [];

    const HKT_OFFSET_MS = 8 * 60 * 60 * 1000;
    const hktMs = tradeTime.getTime() + HKT_OFFSET_MS;
    const hktDate = new Date(hktMs);
    const hktHour = hktDate.getUTCHours();

    // Trading day starts at 06:00 HKT on the "session date".
    // If the trade's HKT hour is before 06:00, the session date is the previous calendar day.
    const sessionDateUtcMs =
      Date.UTC(hktDate.getUTCFullYear(), hktDate.getUTCMonth(), hktDate.getUTCDate()) -
      HKT_OFFSET_MS +                          // convert HKT midnight → UTC midnight
      (hktHour < 6 ? -24 * 60 * 60 * 1000 : 0); // step back one day if pre-dawn

    // sessionDateUtcMs = session date 00:00 HKT expressed in UTC (already offset-corrected)
    // 06:00 HKT = session date midnight (UTC) + 6 hours
    const tradingDayStartUtcMs = sessionDateUtcMs + 6 * 60 * 60 * 1000;
    // 05:00 HKT next day = start + 23 hours
    const tradingDayEndUtcMs = tradingDayStartUtcMs + 23 * 60 * 60 * 1000;

    const startS = tradingDayStartUtcMs / 1000;
    const endS   = tradingDayEndUtcMs   / 1000;

    return all.filter((c) => c.time >= startS && c.time < endS);
  } catch {
    return [];
  }
}
