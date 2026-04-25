import { NextRequest, NextResponse } from "next/server";
import { loadDayCandlesForTradingDayKey } from "@/lib/analytics/loadDayCandles";

export const maxDuration = 120;
export const runtime = "nodejs";

/**
 * 1m MNQ session candles for a CME trading day (HKT `YYYY-MM-DD` session key).
 */
export async function GET(req: NextRequest) {
  const day = req.nextUrl.searchParams.get("day");
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return NextResponse.json({ error: "Query `day=YYYY-MM-DD` is required" }, { status: 400 });
  }
  try {
    const candles = await loadDayCandlesForTradingDayKey(day);
    return NextResponse.json(
      { day, candles },
      {
        headers: {
          // Browser + CDN can reuse; server still uses `data/candles-cache.json` for the heavy path.
          "Cache-Control": "private, max-age=300, s-maxage=300, stale-while-revalidate=3600",
        },
      }
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load session candles" },
      { status: 500 }
    );
  }
}
