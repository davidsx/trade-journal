import { NextRequest, NextResponse } from "next/server";
import { runImportScorePost } from "@/lib/import/runImportScorePost";

export const runtime = "nodejs";

/** Step 3: recompute running capital + quality scores for all CSV-account trades, then persist. */
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    return await runImportScorePost(req);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Scoring failed" },
      { status: 500 }
    );
  }
}
