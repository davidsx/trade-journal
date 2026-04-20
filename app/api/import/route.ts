import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { parseCsv, csvRowsToTrades, type ImportedTrade } from "@/lib/csv/parser";
import { scoreTrades } from "@/lib/analytics/scorer";
import type { TradeModel as Trade } from "@/app/generated/prisma/models";

/** Prisma + DB; Edge is unsupported for this route. */
export const runtime = "nodejs";

/**
 * Vercel (and similar) cap request duration: Hobby max 60s, Pro up to 300s.
 * Local `next dev` effectively has no cap. Requested value is clamped by plan.
 */
export const maxDuration = 300;

const CSV_ACCOUNT_ID = 1; // Fixed account ID for CSV-imported trades
const STARTING_CAPITAL = 50_000;

/** Bounded parallelism so serverless finishes within Vercel limits without exhausting the DB pool. */
async function runPool<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>): Promise<void> {
  if (items.length === 0) return;
  const c = Math.max(1, Math.min(concurrency, items.length));
  let next = 0;
  await Promise.all(
    Array.from({ length: c }, async () => {
      while (true) {
        const i = next++;
        if (i >= items.length) break;
        await fn(items[i]!);
      }
    })
  );
}

function dbConcurrency(): number {
  const raw = process.env.IMPORT_DB_CONCURRENCY;
  const n = raw ? parseInt(raw, 10) : 8;
  if (Number.isNaN(n)) return 8;
  return Math.min(16, Math.max(1, n));
}

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

    const conc = dbConcurrency();

    // Parallel upserts: sequential work inside one long $transaction often exceeds Vercel Hobby (60s wall).
    await runPool(trades, conc, async (t) => {
      const core = coreFromImported(t);
      await prisma.trade.upsert({
        where: { id: t.id },
        create: { id: t.id, ...core, createdAt: t.createdAt },
        update: core,
      });
    });

    const all = await prisma.trade.findMany({
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

    await runPool(scored, conc, async (t) => {
      await prisma.trade.update({
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
