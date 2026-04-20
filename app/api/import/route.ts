import { NextRequest, NextResponse } from "next/server";
import { parseCsv, csvRowsToTrades } from "@/lib/csv/parser";
import { prisma } from "@/lib/db/prisma";
import {
  CSV_ACCOUNT_ID,
  upsertImportedTrades,
  finalizeCsvAccountScoring,
} from "@/lib/import/csvAccountServer";

/** Prisma + DB; Edge is unsupported for this route. */
export const runtime = "nodejs";

/**
 * Single-request upload (multipart). Prefer the batched client flow for large files on Vercel.
 */
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const text = await (file as Blob).text();
    const rows = parseCsv(text);
    const trades = csvRowsToTrades(rows, CSV_ACCOUNT_ID);

    const csvIds = trades.map((t) => t.id);
    const replacedCount = await prisma.trade.count({
      where: { accountId: CSV_ACCOUNT_ID, id: { in: csvIds } },
    });

    await upsertImportedTrades(trades);
    await finalizeCsvAccountScoring();

    const totalTrades = await prisma.trade.count({ where: { accountId: CSV_ACCOUNT_ID } });

    return NextResponse.json({
      imported: trades.length,
      rowsInCsv: trades.length,
      updatedFromCsv: replacedCount,
      addedFromCsv: trades.length - replacedCount,
      totalTrades,
      symbol: rows[0]?.symbol,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Import failed" },
      { status: 500 }
    );
  }
}
