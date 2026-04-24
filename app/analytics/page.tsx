import { getActiveAccountId } from "@/lib/activeAccount";
import { tradesWhere } from "@/lib/accountScope";
import { prisma } from "@/lib/db/prisma";
import { computeSummaryMetrics } from "@/lib/analytics/metrics";
import {
  hktHoursInTradingDayOrder,
  scoreMetricsByHktHour,
  scoreMetricsByHoldingMins,
  scoreMetricsByTradingDayWeekday,
  scoreMetricsBySession,
} from "@/lib/analytics/scoreTimeMetrics";
import { getAccountSettings } from "@/lib/accountSettings";
import DrawdownChart from "@/components/DrawdownChart";
import PnlBarChart from "@/components/PnlBarChart";
import ScoreDistributionChart from "@/components/ScoreDistributionChart";
import ScorePnlChart from "@/components/ScorePnlChart";
import type { ScorePnlPoint } from "@/components/ScorePnlChart";
import ScoreTimeMetricsTables from "@/components/ScoreTimeMetricsTables";

function formatAvgHoldMins(mins: number) {
  if (mins < 60) return `${Math.round(mins)}m`;
  return `${(mins / 60).toFixed(1)}h`;
}

/** Profit factor uses 999 as “no losing trades” in `computeProfitFactor`. */
function formatProfitFactor(pf: number) {
  if (pf >= 90) return "∞";
  return pf.toFixed(2);
}

export default async function AnalyticsPage() {
  const [settings, accountId] = await Promise.all([getAccountSettings(), getActiveAccountId()]);
  const trades = await prisma.trade.findMany({ where: tradesWhere(accountId), orderBy: { entryTime: "asc" } });
  const metrics = computeSummaryMetrics(trades, {
    initialBalance: settings.initialBalance,
  });

  // Score distribution: one bar per integer 0..100 (chart shows separated points, not 10-point bands)
  const scoreDistBuckets = Array.from({ length: 101 }, (_, s) => ({
    range: String(s),
    bin: s,
    count: 0,
  }));
  for (const t of trades) {
    if (t.qualityScore !== null) {
      const s = Math.round(Math.min(100, Math.max(0, t.qualityScore)));
      scoreDistBuckets[s].count++;
    }
  }

  // Score vs P&L — scatter points + per-bucket averages
  const scorePnlPoints: ScorePnlPoint[] = trades
    .filter((t) => t.qualityScore !== null)
    .map((t) => ({ score: t.qualityScore!, pnl: t.netPnl, id: t.id }));

  const bucketSums = Array.from({ length: 10 }, () => ({ sum: 0, count: 0 }));
  for (const p of scorePnlPoints) {
    const idx = Math.min(Math.floor(p.score / 10), 9);
    bucketSums[idx].sum += p.pnl;
    bucketSums[idx].count++;
  }
  const bucketAvgs = bucketSums.map((b, i) => ({
    score: i * 10,
    avgPnl: b.count > 0 ? b.sum / b.count : 0,
    count: b.count,
  }));

  const sessionScoreRows = scoreMetricsBySession(trades);
  const hourlyScoreRows = hktHoursInTradingDayOrder(scoreMetricsByHktHour(trades));
  const weekdayScoreRows = scoreMetricsByTradingDayWeekday(trades);
  const holdTimeScoreRows = scoreMetricsByHoldingMins(trades);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Analytics</h1>

      {/* Summary stats — P&L, execution, and quality (see home for Sharpe / Sortino) */}
      <div
        className="rounded-lg p-4 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm"
        style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)" }}
      >
        <div>
          <div className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>
            Net P&amp;L
          </div>
          <div
            className="font-semibold text-lg"
            style={{
              color:
                metrics.totalNetPnl > 0 ? "var(--profit)" : metrics.totalNetPnl < 0 ? "var(--loss)" : "var(--text-primary)",
            }}
          >
            {metrics.totalNetPnl >= 0 ? "+" : "−"}${Math.abs(metrics.totalNetPnl).toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>
            Avg / trade
          </div>
          <div
            className="font-semibold text-lg"
            style={{
              color:
                metrics.avgNetPnl > 0 ? "var(--profit)" : metrics.avgNetPnl < 0 ? "var(--loss)" : "var(--text-primary)",
            }}
          >
            {metrics.totalTrades === 0
              ? "—"
              : `${metrics.avgNetPnl >= 0 ? "+" : "−"}$${Math.abs(metrics.avgNetPnl).toFixed(2)}`}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>
            Win rate
          </div>
          <div className="font-semibold text-lg" style={{ color: "var(--text-primary)" }}>
            {metrics.totalTrades === 0 ? "—" : `${(metrics.winRate * 100).toFixed(1)}%`}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>
            Profit factor
          </div>
          <div className="font-semibold text-lg" style={{ color: "var(--text-primary)" }}>
            {metrics.totalTrades === 0 ? "—" : formatProfitFactor(metrics.profitFactor)}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>
            Trades (W / L)
          </div>
          <div className="font-semibold text-lg tabular-nums" style={{ color: "var(--text-primary)" }}>
            {metrics.totalTrades === 0
              ? "—"
              : `${metrics.totalTrades} (${metrics.winningTrades} / ${metrics.losingTrades})`}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>
            Avg win
          </div>
          <div className="font-semibold text-lg" style={{ color: "var(--profit)" }}>
            {metrics.winningTrades === 0 ? "—" : `$${metrics.avgWin.toFixed(2)}`}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>
            Avg loss
          </div>
          <div className="font-semibold text-lg" style={{ color: "var(--loss)" }}>
            {metrics.losingTrades === 0 ? "—" : `$${metrics.avgLoss.toFixed(2)}`}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>
            Avg quality
          </div>
          <div className="font-semibold text-lg" style={{ color: "var(--text-primary)" }}>
            {metrics.avgQualityScore === null ? "—" : metrics.avgQualityScore.toFixed(1)}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>
            Avg hold
          </div>
          <div className="font-semibold text-lg" style={{ color: "var(--text-primary)" }}>
            {metrics.totalTrades === 0 ? "—" : formatAvgHoldMins(metrics.avgHoldingMins)}
          </div>
        </div>
      </div>

      {/* Drawdown */}
      <div
        className="rounded-lg p-4"
        style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)" }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
            Drawdown
          </h2>
          <span className="text-sm font-medium" style={{ color: "var(--loss)" }}>
            Max: {metrics.maxDrawdownPct.toFixed(1)}%
          </span>
        </div>
        <DrawdownChart data={metrics.drawdownSeries} />
      </div>

      {/* Per-trade P&L */}
      <div
        className="rounded-lg p-4"
        style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)" }}
      >
        <h2 className="text-sm font-medium mb-3" style={{ color: "var(--text-secondary)" }}>
          Per-Trade P&L
        </h2>
        <PnlBarChart trades={trades} />
      </div>

      {/* Score distribution */}
      <div
        className="rounded-lg p-4"
        style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)" }}
      >
        <h2 className="text-sm font-medium mb-4" style={{ color: "var(--text-secondary)" }}>
          Trade Quality Score Distribution
        </h2>
        <ScoreDistributionChart buckets={scoreDistBuckets} />
      </div>

      {/* Session / hour / weekday — quality score */}
      <ScoreTimeMetricsTables
        session={sessionScoreRows}
        hourly={hourlyScoreRows}
        weekday={weekdayScoreRows}
        holdTime={holdTimeScoreRows}
      />

      {/* Score vs P&L */}
      <div
        className="rounded-lg p-4"
        style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)" }}
      >
        <h2 className="text-sm font-medium mb-4" style={{ color: "var(--text-secondary)" }}>
          Score vs Net P&L
        </h2>
        <ScorePnlChart points={scorePnlPoints} bucketAvgs={bucketAvgs} />
      </div>
    </div>
  );
}
