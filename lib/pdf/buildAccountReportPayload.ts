import { prisma } from "@/lib/db/prisma";
import { tradesWhere } from "@/lib/accountScope";
import { accountLabel } from "@/lib/accountLabel";
import { computeSummaryMetrics, type MetricsSummary } from "@/lib/analytics/metrics";
import {
  analyzeTimeOfDay,
  analyzeDayOfWeek,
  analyzeInstruments,
  analyzeStreaks,
  analyzeEdgeDecay,
  analyzeSessionPerformance,
} from "@/lib/analytics/patterns";
import type { TradeModel as Trade } from "@/app/generated/prisma/models";

export type AccountReportTradeRow = {
  id: string;
  contractName: string;
  direction: string;
  qty: number;
  entryPrice: number;
  exitPrice: number;
  entryTime: string;
  exitTime: string;
  holdingMins: number;
  netPnl: number;
};

export type AccountReportPayload = {
  generatedAt: string;
  account: { id: number; name: string; initialBalance: number };
  metrics: MetricsSummary;
  timeOfDay: ReturnType<typeof analyzeTimeOfDay>;
  dayOfWeek: ReturnType<typeof analyzeDayOfWeek>;
  sessions: ReturnType<typeof analyzeSessionPerformance>;
  instruments: ReturnType<typeof analyzeInstruments>;
  streaks: ReturnType<typeof analyzeStreaks>;
  edgeDecay: ReturnType<typeof analyzeEdgeDecay>;
  tradeRows: AccountReportTradeRow[];
  /** Mirrors `/analytics`: drawdown and per-trade P&amp;L. */
  analytics: AccountReportAnalytics;
};

export type AccountReportAnalytics = {
  perTradeNetPnl: number[];
};

function mapTradesToRows(trades: Trade[]): AccountReportTradeRow[] {
  return trades.map((t) => ({
    id: t.id,
    contractName: t.contractName,
    direction: t.direction,
    qty: t.qty,
    entryPrice: t.entryPrice,
    exitPrice: t.exitPrice,
    entryTime: t.entryTime.toISOString(),
    exitTime: t.exitTime.toISOString(),
    holdingMins: t.holdingMins,
    netPnl: t.netPnl,
  }));
}

export async function buildAccountReportPayload(accountId: number): Promise<AccountReportPayload> {
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) {
    throw new Error("Account not found");
  }
  const trades = await prisma.trade.findMany({
    where: tradesWhere(accountId),
    orderBy: { entryTime: "asc" },
  });
  const metrics = computeSummaryMetrics(trades, { initialBalance: account.initialBalance });
  const timeOfDay = analyzeTimeOfDay(trades);
  const dayOfWeek = analyzeDayOfWeek(trades);
  const instruments = analyzeInstruments(trades);
  const streaks = analyzeStreaks(trades);
  const edgeDecay = analyzeEdgeDecay(trades);
  const sessions = analyzeSessionPerformance(trades);

  const analytics: AccountReportAnalytics = {
    perTradeNetPnl: trades.map((t) => t.netPnl),
  };

  return {
    generatedAt: new Date().toISOString(),
    account: {
      id: account.id,
      name: accountLabel(account),
      initialBalance: account.initialBalance,
    },
    metrics,
    timeOfDay,
    dayOfWeek,
    sessions,
    instruments,
    streaks,
    edgeDecay,
    tradeRows: mapTradesToRows(trades),
    analytics,
  };
}
