import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import type { ImportedTradeWire } from "@/lib/csv/importWire";
import { wireToImportedTrade } from "@/lib/csv/importWire";
import { CSV_ACCOUNT_ID, upsertImportedTrades } from "@/lib/import/csvAccountServer";

export const runtime = "nodejs";

/** One batch should stay well under Vercel Hobby 60s; tune client chunk size if needed. */
export const maxDuration = 60;

const MAX_BATCH = 120;
const MAX_ALL_IDS = 50_000;

type BatchBody = {
  trades: ImportedTradeWire[];
  allCsvIds?: string[];
  isFirstBatch?: boolean;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as BatchBody;
    const trades = Array.isArray(body.trades) ? body.trades : [];
    if (trades.length === 0) {
      return NextResponse.json({ error: "trades array required" }, { status: 400 });
    }
    if (trades.length > MAX_BATCH) {
      return NextResponse.json({ error: `Each batch may have at most ${MAX_BATCH} rows` }, { status: 400 });
    }

    let replacedCount: number | undefined;
    if (body.isFirstBatch && body.allCsvIds?.length) {
      if (body.allCsvIds.length > MAX_ALL_IDS) {
        return NextResponse.json({ error: "Too many ids in allCsvIds" }, { status: 400 });
      }
      replacedCount = await prisma.trade.count({
        where: { accountId: CSV_ACCOUNT_ID, id: { in: body.allCsvIds } },
      });
    }

    const parsed = (trades as ImportedTradeWire[]).map(wireToImportedTrade);
    await upsertImportedTrades(parsed);

    return NextResponse.json({
      ok: true,
      batchSize: trades.length,
      ...(replacedCount !== undefined ? { replacedCount } : {}),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Batch import failed" },
      { status: 500 }
    );
  }
}
