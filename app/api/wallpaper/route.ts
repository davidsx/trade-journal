import { NextResponse } from "next/server";
import sharp from "sharp";
import { fetchCandlesForRange, type Candle } from "@/lib/candles/candlesServer";
import { renderWallpaperSvg } from "@/lib/wallpaper/renderWallpaperSvg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Yahoo 5m fetch can be slow on cold cloud IPs. */
export const maxDuration = 60;

const SYMBOL = "MNQ=F";

/**
 * GET /api/wallpaper — live iPhone 17 Pro Max wallpaper (PNG) built from the last
 * 6 five-minute MNQ candles. Cached 5 min at the edge so the image effectively
 * "regenerates every 5 minutes" without hammering Yahoo.
 */
export async function GET() {
  const nowSec = Math.floor(Date.now() / 1000);
  // Look back far enough to survive weekends / CME maintenance gaps.
  const period1 = String(nowSec - 5 * 24 * 60 * 60);
  const period2 = String(nowSec);

  let candles: Candle[] = [];
  try {
    const r = await fetchCandlesForRange(SYMBOL, "5m", period1, period2);
    candles = r.candles;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Candle fetch failed: ${msg}` }, { status: 502 });
  }

  // Keep only real bars, take the most recent 6.
  const clean = candles
    .filter((c) => c.open != null && c.close != null)
    .sort((a, b) => a.time - b.time)
    .slice(-6);

  if (clean.length < 2) {
    return NextResponse.json(
      { error: "Not enough recent 5-minute candles to build a wallpaper." },
      { status: 502 }
    );
  }

  const svg = renderWallpaperSvg(clean);
  const png = await sharp(Buffer.from(svg)).png().toBuffer();

  return new NextResponse(new Uint8Array(png), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      // Fresh every 5 min; serve stale briefly while revalidating.
      "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=60",
      "Content-Disposition": 'inline; filename="mnq-iphone17promax.png"',
    },
  });
}
