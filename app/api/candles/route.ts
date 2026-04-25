import { NextRequest, NextResponse } from "next/server";
import {
  readCacheAsync,
  writeMergedCache,
  fetchCandlesForRange,
} from "@/lib/candles/candlesServer";
import { getCandleFetchRangeFromTrades } from "@/lib/tradeCandleBounds";

/** Batched trade-range fetches can take a while (many Yahoo chunks). */
export const maxDuration = 120;

export const runtime = "nodejs";

export { type Candle } from "@/lib/candles/candlesServer";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const symbol = searchParams.get("symbol") ?? "MNQ=F";
  const interval = searchParams.get("interval") ?? "1m";
  const explicitP1 = searchParams.get("period1");
  const explicitP2 = searchParams.get("period2");
  const bust = searchParams.has("refresh");

  const useTradeRange = explicitP1 === null || explicitP2 === null;
  let period1: string;
  let period2: string;
  let tradeCount: number | undefined;
  if (explicitP1 !== null && explicitP2 !== null) {
    period1 = explicitP1;
    period2 = explicitP2;
  } else {
    const r = await getCandleFetchRangeFromTrades();
    period1 = r.period1;
    period2 = r.period2;
    tradeCount = r.tradeCount;
  }

  if (!bust) {
    const cached = await readCacheAsync(symbol, interval, period1, period2, false);
    if (cached) {
      return NextResponse.json({
        candles: cached,
        symbol,
        interval,
        cached: true,
        tradeBased: useTradeRange,
        tradeCount,
      });
    }
  }

  try {
    const { candles, source, batched, rangeClamped, usedRecentFallback, used5mBars } =
      await fetchCandlesForRange(symbol, interval, period1, period2);
    if (candles.length === 0) {
      return NextResponse.json(
        {
          error:
            "No candle data returned from Yahoo (blocked IP, rate limit, or symbol/range issue). ~30 days of 1m history max. Retry later or import candles from another source if this persists.",
        },
        { status: 502 }
      );
    }
    await writeMergedCache(symbol, interval, period1, period2, candles);
    const p1n = Number(period1);
    const p2n = Number(period2);
    const filtered = candles.filter((c) => c.time >= p1n && c.time <= p2n);
    return NextResponse.json({
      candles: filtered.length ? filtered : candles,
      symbol,
      interval,
      cached: false,
      source,
      batched,
      tradeBased: useTradeRange,
      tradeCount,
      ...(rangeClamped ? { rangeClamped: true } : {}),
      ...(usedRecentFallback ? { usedRecentFallback: true } : {}),
      ...(used5mBars ? { used5mBars: true } : {}),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
