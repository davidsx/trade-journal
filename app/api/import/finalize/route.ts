import { NextRequest, NextResponse } from "next/server";
import { runImportFinalizePost } from "@/lib/import/runImportFinalizePost";

export const runtime = "nodejs";

/** Step 3: recompute running capital (capitalBefore/After) for all CSV-account trades, then persist. */
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    return await runImportFinalizePost(req);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Finalize failed" },
      { status: 500 }
    );
  }
}
