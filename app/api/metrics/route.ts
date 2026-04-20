import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { computeSummaryMetrics } from "@/lib/analytics/metrics";
import { getAccountSettings } from "@/lib/accountSettings";

export async function GET() {
  const settings = await getAccountSettings();
  const trades = await prisma.trade.findMany({ orderBy: { entryTime: "asc" } });
  const metrics = computeSummaryMetrics(trades, {
    initialBalance: settings.initialBalance,
  });
  return NextResponse.json(metrics);
}
