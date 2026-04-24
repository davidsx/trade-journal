import { NextRequest, NextResponse } from "next/server";
import { getActiveAccountId } from "@/lib/activeAccount";
import { tradesWhere } from "@/lib/accountScope";
import { prisma } from "@/lib/db/prisma";
import { analyzeConditionGroups, buildSetupBlueprint } from "@/lib/analytics/insights";

export async function GET(req: NextRequest) {
  const minScore = Math.max(
    0,
    Math.min(100, Number(req.nextUrl.searchParams.get("minScore") ?? 70))
  );

  const accountId = await getActiveAccountId();
  const trades = await prisma.trade.findMany({ where: tradesWhere(accountId), orderBy: { entryTime: "asc" } });

  const conditionGroups = analyzeConditionGroups(trades);
  const blueprint = buildSetupBlueprint(trades, minScore);

  const bestTrades = await prisma.trade.findMany({
    where: tradesWhere(accountId, { qualityScore: { not: null } }),
    orderBy: { qualityScore: "desc" },
    take: 20,
  });

  return NextResponse.json({ conditionGroups, blueprint, bestTrades });
}
