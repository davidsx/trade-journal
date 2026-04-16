import { NextResponse } from "next/server";
import { getValidToken } from "@/lib/tradovate/auth";
import { runFullSync } from "@/lib/db/syncService";
import { prisma } from "@/lib/db/prisma";
import { scoreTrades } from "@/lib/analytics/scorer";

export async function POST() {
  try {
    const { accountId } = await getValidToken();
    const result = await runFullSync(accountId);

    // Score trades after sync
    const trades = await prisma.trade.findMany({
      where: { accountId },
      orderBy: { entryTime: "asc" },
    });

    if (trades.length > 0) {
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
              rMultiple: t.rMultiple,
            },
          })
        )
      );
    }

    return NextResponse.json({ ...result, syncedAt: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}
