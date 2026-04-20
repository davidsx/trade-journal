import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { parseCsv, csvRowsToTrades, type ImportedTrade } from "@/lib/csv/parser";
import { scoreTrades } from "@/lib/analytics/scorer";
import type { TradeModel as Trade } from "@/app/generated/prisma/models";

const CSV_ACCOUNT_ID = 1; // Fixed account ID for CSV-imported trades
const STARTING_CAPITAL = 50_000;

function coreFromImported(t: ImportedTrade) {
  return {
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
    rMultiple: null as number | null,
    qualityScore: null as number | null,
    entryScore: null as number | null,
    exitScore: null as number | null,
    riskScore: null as number | null,
    scoreNotes: null as string | null,
    capitalBefore: 0,
    capitalAfter: 0,
  };
}

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

    await prisma.$transaction(async (tx) => {
      for (const t of trades) {
        const core = coreFromImported(t);
        await tx.trade.upsert({
          where: { id: t.id },
          create: { id: t.id, ...core, createdAt: t.createdAt },
          update: core,
        });
      }

      const all = await tx.trade.findMany({
        where: { accountId: CSV_ACCOUNT_ID },
        orderBy: { entryTime: "asc" },
      });

      let capital = STARTING_CAPITAL;
      const withCapital: Trade[] = all.map((row) => {
        const capitalBefore = capital;
        capital += row.netPnl;
        return {
          ...row,
          capitalBefore,
          capitalAfter: capital,
        };
      });

      const scored = scoreTrades(withCapital);

      for (const t of scored) {
        await tx.trade.update({
          where: { id: t.id },
          data: {
            capitalBefore: t.capitalBefore,
            capitalAfter: t.capitalAfter,
            qualityScore: t.qualityScore,
            entryScore: t.entryScore,
            exitScore: t.exitScore,
            riskScore: t.riskScore,
            scoreNotes: t.scoreNotes,
          },
        });
      }
    });

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
