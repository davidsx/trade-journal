import { NextResponse } from "next/server";
import { getActiveAccountId } from "@/lib/activeAccount";
import { tradesWhere } from "@/lib/accountScope";
import { prisma } from "@/lib/db/prisma";
import { warmCandleCacheForScoring } from "@/lib/candles/warmForScoring";
import { scoreTrades } from "@/lib/analytics/scorer";

export async function POST(request: Request) {
  try {
    const accountId = await getActiveAccountId();
    const trades = await prisma.trade.findMany({ where: tradesWhere(accountId), orderBy: { entryTime: "asc" } });

    if (trades.length === 0) {
      return NextResponse.json({ updated: 0 });
    }

    await warmCandleCacheForScoring(new URL(request.url).origin);

    const scored = scoreTrades(trades);
    await Promise.all(
      scored.map((t) =>
        prisma.trade.update({
          where: { id: t.id },
          data: {
            qualityScore: t.qualityScore,
            entryScore: t.entryScore,
            exitScore: t.exitScore,
            riskScore: t.riskScore,
            scoreNotes: t.scoreNotes,
          },
        })
      )
    );

    return NextResponse.json({ updated: scored.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Rescore failed" },
      { status: 500 }
    );
  }
}
