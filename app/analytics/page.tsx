import { prisma } from "@/lib/db/prisma";
import { computeSummaryMetrics } from "@/lib/analytics/metrics";
import DrawdownChart from "@/components/DrawdownChart";
import PnlBarChart from "@/components/PnlBarChart";
import ScoreDistributionChart from "@/components/ScoreDistributionChart";
import ScorePnlChart from "@/components/ScorePnlChart";
import type { ScorePnlPoint } from "@/components/ScorePnlChart";

export default async function AnalyticsPage() {
  const trades = await prisma.trade.findMany({ orderBy: { entryTime: "asc" } });
  const metrics = computeSummaryMetrics(trades);

  // Score distribution
  const buckets = Array.from({ length: 10 }, (_, i) => ({
    range: `${i * 10}–${i * 10 + 9}`,
    count: 0,
  }));
  for (const t of trades) {
    if (t.qualityScore !== null) {
      const idx = Math.min(Math.floor(t.qualityScore / 10), 9);
      buckets[idx].count++;
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

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Analytics</h1>

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
        <ScoreDistributionChart buckets={buckets} />
      </div>

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

      {/* Summary stats */}
      <div
        className="rounded-lg p-4 grid grid-cols-2 gap-4 text-sm"
        style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)" }}
      >
        <div>
          <div className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>
            Sharpe Ratio
          </div>
          <div className="font-semibold text-lg">{metrics.sharpeRatio.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>
            Sortino Ratio
          </div>
          <div className="font-semibold text-lg">{metrics.sortinoRatio.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>
            Avg Win
          </div>
          <div className="font-semibold" style={{ color: "var(--profit)" }}>
            ${metrics.avgWin.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>
            Avg Loss
          </div>
          <div className="font-semibold" style={{ color: "var(--loss)" }}>
            ${metrics.avgLoss.toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
}
