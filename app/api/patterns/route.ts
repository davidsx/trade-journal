import { NextResponse } from "next/server";
import { getActiveAccountId } from "@/lib/activeAccount";
import { tradesWhere } from "@/lib/accountScope";
import { prisma } from "@/lib/db/prisma";
import {
  analyzeTimeOfDay,
  analyzeDayOfWeek,
  analyzeInstruments,
  analyzeStreaks,
  analyzeEdgeDecay,
} from "@/lib/analytics/patterns";

export async function GET() {
  const accountId = await getActiveAccountId();
  const trades = await prisma.trade.findMany({ where: tradesWhere(accountId), orderBy: { entryTime: "asc" } });
  return NextResponse.json({
    timeOfDay: analyzeTimeOfDay(trades),
    dayOfWeek: analyzeDayOfWeek(trades),
    instruments: analyzeInstruments(trades),
    streaks: analyzeStreaks(trades),
    edgeDecay: analyzeEdgeDecay(trades),
  });
}
