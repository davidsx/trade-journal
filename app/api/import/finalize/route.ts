import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { CSV_ACCOUNT_ID, finalizeCsvAccountScoring } from "@/lib/import/csvAccountServer";

export const runtime = "nodejs";

/** Recompute capital + scores for all CSV-account trades (may be heavy). */
export const maxDuration = 300;

type FinalizeBody = {
  rowsInCsv?: number;
  symbol?: string;
  replacedCount?: number;
};

export async function POST(req: NextRequest) {
  try {
    let body: FinalizeBody = {};
    try {
      const text = await req.text();
      if (text.trim()) body = JSON.parse(text) as FinalizeBody;
    } catch {
      body = {};
    }

    await finalizeCsvAccountScoring();

    const totalTrades = await prisma.trade.count({ where: { accountId: CSV_ACCOUNT_ID } });

    const rowsInCsv = body.rowsInCsv;
    const replaced = body.replacedCount;

    return NextResponse.json({
      ok: true,
      imported: rowsInCsv,
      rowsInCsv,
      updatedFromCsv: replaced,
      addedFromCsv:
        typeof rowsInCsv === "number" && typeof replaced === "number" ? rowsInCsv - replaced : undefined,
      totalTrades,
      symbol: body.symbol,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Finalize failed" },
      { status: 500 }
    );
  }
}
