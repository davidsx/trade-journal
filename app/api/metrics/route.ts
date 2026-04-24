import { NextResponse } from "next/server";
import { getActiveAccountId } from "@/lib/activeAccount";
import { tradesWhere } from "@/lib/accountScope";
import { prisma } from "@/lib/db/prisma";
import { computeSummaryMetrics } from "@/lib/analytics/metrics";
import { getAccountSettings } from "@/lib/accountSettings";

export async function GET() {
  const [settings, accountId] = await Promise.all([getAccountSettings(), getActiveAccountId()]);
  const trades = await prisma.trade.findMany({ where: tradesWhere(accountId), orderBy: { entryTime: "asc" } });
  const metrics = computeSummaryMetrics(trades, {
    initialBalance: settings.initialBalance,
  });
  return NextResponse.json(metrics);
}
