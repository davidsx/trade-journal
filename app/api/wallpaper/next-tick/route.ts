import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Small buffer so the freshly-closed 5m candle is available before the wallpaper refetches. */
const BUFFER_SEC = 8;
const BOUNDARY_SEC = 5 * 60;

/**
 * GET /api/wallpaper/next-tick — seconds to wait until the next 5-minute clock
 * boundary (+ buffer), as plain text. Lets an iOS Shortcut align its loop to
 * :00/:05/:10… without any on-device date math: Get Contents of URL → Wait → repeat.
 */
export async function GET() {
  const nowSec = Math.floor(Date.now() / 1000);
  const intoBoundary = nowSec % BOUNDARY_SEC;
  let wait = BOUNDARY_SEC - intoBoundary + BUFFER_SEC;
  // If we're within the buffer just after a boundary, target the next one.
  if (wait > BOUNDARY_SEC) wait -= BOUNDARY_SEC;

  return new NextResponse(String(wait), {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
