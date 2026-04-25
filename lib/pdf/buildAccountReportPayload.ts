import { prisma } from "@/lib/db/prisma";
import { tradesWhere } from "@/lib/accountScope";
import { computeSummaryMetrics, type MetricsSummary } from "@/lib/analytics/metrics";
import {
  analyzeTimeOfDay,
  analyzeDayOfWeek,
  analyzeInstruments,
  analyzeStreaks,
  analyzeEdgeDecay,
  analyzeSessionPerformance,
} from "@/lib/analytics/patterns";
import {
  hktHoursInTradingDayOrder,
  pickBestByAvgPnl,
  pickBestByAvgScore,
  scoreMetricsByHktHour,
  scoreMetricsByHoldingMins,
  scoreMetricsBySession,
  scoreMetricsByTradingDayWeekday,
  type ScoreTimeRow,
} from "@/lib/analytics/scoreTimeMetrics";
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
  qualityScore: number | null;
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
  /** Mirrors `/analytics`: score×time tables, drawdown, per-trade P&amp;L, score distribution, score vs P&amp;L. */
  analytics: AccountReportAnalytics;
};

export type AccountReportAnalytics = {
  sessionRows: ScoreTimeRow[];
  hourlyRows: ScoreTimeRow[];
  weekdayRows: ScoreTimeRow[];
  holdRows: ScoreTimeRow[];
  bests: {
    session: { byScore: ScoreTimeRow | null; byPnl: ScoreTimeRow | null };
    hour: { byScore: ScoreTimeRow | null; byPnl: ScoreTimeRow | null };
    weekday: { byScore: ScoreTimeRow | null; byPnl: ScoreTimeRow | null };
    hold: { byScore: ScoreTimeRow | null; byPnl: ScoreTimeRow | null };
  };
  /** 10 score bands: 0-9, …, 80-89, 90-100 (inclusive). */
  scoreDist10Bins: { label: string; count: number }[];
  /** Same 10-bucket `floor(score/10)` rule as the analytics page (last bucket 90-100). */
  scorePnl10Buckets: { label: string; avgPnl: number; count: number }[];
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
    qualityScore: t.qualityScore,
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

  const sessionScoreRows = scoreMetricsBySession(trades);
  const hourlyScoreRows = hktHoursInTradingDayOrder(scoreMetricsByHktHour(trades));
  const weekdayScoreRows = scoreMetricsByTradingDayWeekday(trades);
  const holdTimeScoreRows = scoreMetricsByHoldingMins(trades);

  const sessionRowsF = sessionScoreRows.filter((r) => r.tradeCount > 0);
  const hourlyWithTrades = hourlyScoreRows.filter((r) => r.tradeCount > 0);
  const weekdayRowsF = weekdayScoreRows.filter((r) => r.tradeCount > 0);
  const holdRowsF = holdTimeScoreRows.filter((r) => r.tradeCount > 0);

  const byInt = Array.from({ length: 101 }, () => 0);
  for (const t of trades) {
    if (t.qualityScore !== null) {
      const s = Math.round(Math.min(100, Math.max(0, t.qualityScore)));
      byInt[s] += 1;
    }
  }
  const scoreDist10Bins: { label: string; count: number }[] = [];
  for (let b = 0; b < 9; b++) {
    const lo = b * 10;
    const hi = b * 10 + 9;
    const count = byInt.slice(lo, hi + 1).reduce((a, c) => a + c, 0);
    scoreDist10Bins.push({ label: `${lo}-${hi}`, count });
  }
  {
    const count = byInt.slice(90, 101).reduce((a, c) => a + c, 0);
    scoreDist10Bins.push({ label: "90-100", count });
  }

  const bucketSums = Array.from({ length: 10 }, () => ({ sum: 0, count: 0 }));
  for (const t of trades) {
    if (t.qualityScore === null) continue;
    const idx = Math.min(Math.floor(t.qualityScore / 10), 9);
    bucketSums[idx]!.sum += t.netPnl;
    bucketSums[idx]!.count += 1;
  }
  const scorePnl10Buckets = bucketSums.map((b, i) => ({
    label: i === 9 ? "90-100" : `${i * 10}-${i * 10 + 9}`,
    avgPnl: b.count > 0 ? b.sum / b.count : 0,
    count: b.count,
  }));

  const analytics: AccountReportAnalytics = {
    sessionRows: sessionRowsF,
    hourlyRows: hourlyScoreRows,
    weekdayRows: weekdayRowsF,
    holdRows: holdRowsF,
    bests: {
      session: {
        byScore: pickBestByAvgScore(sessionRowsF),
        byPnl: pickBestByAvgPnl(sessionRowsF),
      },
      hour: {
        byScore: pickBestByAvgScore(hourlyWithTrades),
        byPnl: pickBestByAvgPnl(hourlyWithTrades),
      },
      weekday: {
        byScore: pickBestByAvgScore(weekdayRowsF),
        byPnl: pickBestByAvgPnl(weekdayRowsF),
      },
      hold: {
        byScore: pickBestByAvgScore(holdRowsF),
        byPnl: pickBestByAvgPnl(holdRowsF),
      },
    },
    scoreDist10Bins,
    scorePnl10Buckets,
    perTradeNetPnl: trades.map((t) => t.netPnl),
  };

  return {
    generatedAt: new Date().toISOString(),
    account: {
      id: account.id,
      name: account.name,
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
