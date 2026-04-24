import { NextRequest, NextResponse } from "next/server";
import { getActiveAccountId } from "@/lib/activeAccount";
import { tradesWhere } from "@/lib/accountScope";
import { prisma } from "@/lib/db/prisma";
import { warmCandleCacheForScoring } from "@/lib/candles/warmForScoring";
import { finalizeCsvAccountScoring } from "@/lib/import/csvAccountServer";

type ScoreBody = {
  rowsInCsv?: number;
  symbol?: string;
  replacedCount?: number;
};

export async function runImportScorePost(req: NextRequest): Promise<NextResponse> {
  let body: ScoreBody = {};
  try {
    const text = await req.text();
    if (text.trim()) body = JSON.parse(text) as ScoreBody;
  } catch {
    body = {};
  }

  await warmCandleCacheForScoring(req.nextUrl.origin);
  await finalizeCsvAccountScoring();

  const accountId = await getActiveAccountId();
  const totalTrades = await prisma.trade.count({ where: tradesWhere(accountId) });

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
}
