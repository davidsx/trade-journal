import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { analyzeConditionGroups, buildSetupBlueprint } from "@/lib/analytics/insights";

export async function GET(req: NextRequest) {
  const minScore = Math.max(
    0,
    Math.min(100, Number(req.nextUrl.searchParams.get("minScore") ?? 70))
  );

  const trades = await prisma.trade.findMany({ orderBy: { entryTime: "asc" } });

  const conditionGroups = analyzeConditionGroups(trades);
  const blueprint = buildSetupBlueprint(trades, minScore);

  const bestTrades = await prisma.trade.findMany({
    where: { qualityScore: { not: null } },
    orderBy: { qualityScore: "desc" },
    take: 20,
  });

  return NextResponse.json({ conditionGroups, blueprint, bestTrades });
}
