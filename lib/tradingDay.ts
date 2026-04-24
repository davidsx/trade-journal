/**
 * NQ/MNQ CME Globex "trading day" in HKT (UTC+8). Same rule as KNOWLEDGE.md and
 * `loadDayCandles.ts`: session 06:00–05:00 HKT next calendar day; 05:00–06:00 break.
 *
 * Session **calendar date** (the Y-M-D label for that trading day): if HKT hour < 06:00,
 * use the **previous** civil calendar date; otherwise use **today** (HKT date).
 */
const HKT_OFFSET_MS = 8 * 60 * 60 * 1000;

/** First HKT hour of the CME Globex *trading day* (after the 05:00–06:00 daily break). */
export const GLOBEX_SESSION_START_HOUR_HKT = 6;

export function tradingDayKeyHkt(instant: Date): string {
  const hktMs = instant.getTime() + HKT_OFFSET_MS;
  const hktDate = new Date(hktMs);
  const hktHour = hktDate.getUTCHours();
  let y = hktDate.getUTCFullYear();
  let mo = hktDate.getUTCMonth();
  let d = hktDate.getUTCDate();
  if (hktHour < 6) {
    const t = new Date(Date.UTC(y, mo, d));
    t.setUTCDate(t.getUTCDate() - 1);
    y = t.getUTCFullYear();
    mo = t.getUTCMonth();
    d = t.getUTCDate();
  }
  return `${y}-${String(mo + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** 0 = Sunday … 6 = Saturday for the trading session calendar date (HKT). */
export function tradingDayWeekdayIndexHkt(instant: Date): number {
  const key = tradingDayKeyHkt(instant);
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
