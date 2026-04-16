import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { computeSummaryMetrics } from "@/lib/analytics/metrics";

export async function GET() {
  const trades = await prisma.trade.findMany({ orderBy: { entryTime: "asc" } });
  const metrics = computeSummaryMetrics(trades);
  return NextResponse.json(metrics);
}
