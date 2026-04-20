import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { CSV_ACCOUNT_ID, finalizeCsvAccountScoring } from "@/lib/import/csvAccountServer";

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
}
