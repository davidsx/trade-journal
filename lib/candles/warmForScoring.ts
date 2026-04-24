import { getCandleFetchRangeFromTrades } from "@/lib/tradeCandleBounds";

/**
 * Loads Yahoo OHLC into `data/candles-cache.json` (same as chart / GET /api/candles).
 * The scorer needs this file for imbalance (up to 40) + breakout (5) points.
 */
export async function warmCandleCacheForScoring(
  appOrigin: string,
  /** When changing capital for a non-active account, pass its id so the candle range matches its trades. */
  accountId?: number
): Promise<{ ok: boolean; barCount: number; error?: string }> {
  const range = await getCandleFetchRangeFromTrades(accountId);
  if (range.tradeCount === 0) {
    return { ok: true, barCount: 0 };
  }

  const u = new URL("/api/candles", appOrigin.replace(/\/$/, ""));
  u.searchParams.set("period1", range.period1);
  u.searchParams.set("period2", range.period2);
  u.searchParams.set("symbol", "MNQ=F");
  u.searchParams.set("interval", "1m");
  u.searchParams.set("refresh", "1");

  try {
    const res = await fetch(u.toString(), { cache: "no-store" });
    const j: unknown = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err =
        typeof j === "object" && j !== null && "error" in j && typeof (j as { error: unknown }).error === "string"
          ? (j as { error: string }).error
          : res.statusText;
      return { ok: false, barCount: 0, error: err };
    }
    if (typeof j !== "object" || j === null || !("candles" in j) || !Array.isArray((j as { candles: unknown }).candles)) {
      return { ok: false, barCount: 0, error: "Invalid candles response" };
    }
    const bars = (j as { candles: unknown[] }).candles;
    return { ok: bars.length > 0, barCount: bars.length, error: bars.length === 0 ? "No bars returned" : undefined };
  } catch (e) {
    return { ok: false, barCount: 0, error: e instanceof Error ? e.message : "Candle warm failed" };
  }
}
