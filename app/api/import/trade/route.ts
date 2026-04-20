import { NextRequest, NextResponse } from "next/server";
import type { ImportedTradeWire } from "@/lib/csv/importWire";
import { wireToImportedTrade } from "@/lib/csv/importWire";
import { upsertOneImportedTrade } from "@/lib/import/csvAccountServer";

export const runtime = "nodejs";

/** Single-row upsert — cheap request for parallel client calls. */
export const maxDuration = 30;

type Body = { trade: ImportedTradeWire };

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    if (!body?.trade || typeof body.trade !== "object") {
      return NextResponse.json({ error: "trade object required" }, { status: 400 });
    }

    const parsed = wireToImportedTrade(body.trade);
    await upsertOneImportedTrade(parsed);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upsert failed" },
      { status: 500 }
    );
  }
}
