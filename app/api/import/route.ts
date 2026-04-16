import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { parseCsv, csvRowsToTrades } from "@/lib/csv/parser";
import { scoreTrades } from "@/lib/analytics/scorer";

const CSV_ACCOUNT_ID = 1; // Fixed account ID for CSV-imported trades

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

    // Score trades before insert
    // We need TradeModel-compatible objects — cast is safe since shapes match
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scored = scoreTrades(trades as any);

    // Upsert: delete existing CSV trades for this account, then insert fresh
    await prisma.trade.deleteMany({ where: { accountId: CSV_ACCOUNT_ID } });
    await prisma.trade.createMany({
      data: scored.map((t) => ({
        id: t.id,
        accountId: t.accountId,
        contractId: t.contractId,
        contractName: t.contractName,
        direction: t.direction,
        qty: t.qty,
        entryFillId: t.entryFillId,
        exitFillId: t.exitFillId,
        entryPrice: t.entryPrice,
        exitPrice: t.exitPrice,
        entryTime: t.entryTime,
        exitTime: t.exitTime,
        holdingMins: t.holdingMins,
        grossPnl: t.grossPnl,
        fees: t.fees,
        netPnl: t.netPnl,
        rMultiple: t.rMultiple,
        qualityScore: t.qualityScore,
        entryScore: t.entryScore,
        exitScore: t.exitScore,
        riskScore: t.riskScore,
        scoreNotes: t.scoreNotes,
        capitalBefore: t.capitalBefore,
        capitalAfter: t.capitalAfter,
      })),
    });

    return NextResponse.json({
      imported: trades.length,
      symbol: rows[0]?.symbol,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Import failed" },
      { status: 500 }
    );
  }
}
