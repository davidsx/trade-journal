import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import {
  analyzeTimeOfDay,
  analyzeDayOfWeek,
  analyzeInstruments,
  analyzeStreaks,
  analyzeEdgeDecay,
} from "@/lib/analytics/patterns";

export async function GET() {
  const trades = await prisma.trade.findMany({ orderBy: { entryTime: "asc" } });
  return NextResponse.json({
    timeOfDay: analyzeTimeOfDay(trades),
    dayOfWeek: analyzeDayOfWeek(trades),
    instruments: analyzeInstruments(trades),
    streaks: analyzeStreaks(trades),
    edgeDecay: analyzeEdgeDecay(trades),
  });
}
