import { prisma } from "@/lib/db/prisma";
import { computeSummaryMetrics } from "@/lib/analytics/metrics";
import StatCard from "@/components/StatCard";
import TradeTable from "@/components/TradeTable";
import EquityCurve from "@/components/EquityCurve";

function fmtUsd(v: number) {
  return `${v >= 0 ? "+" : "-"}$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPct(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}

export default async function DashboardPage() {
  const trades = await prisma.trade.findMany({ orderBy: { entryTime: "asc" } });
  const recent = await prisma.trade.findMany({
    orderBy: { entryTime: "desc" },
    take: 20,
  });
  const metrics = computeSummaryMetrics(trades);

  const scoreColor =
    metrics.avgQualityScore !== null
      ? metrics.avgQualityScore >= 70
        ? "var(--profit)"
        : metrics.avgQualityScore >= 40
        ? "var(--warn)"
        : "var(--loss)"
      : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          {metrics.totalTrades} trades loaded
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Net P&L"
          value={fmtUsd(metrics.totalNetPnl)}
          valueColor={metrics.totalNetPnl >= 0 ? "var(--profit)" : "var(--loss)"}
          subLabel={`Avg ${fmtUsd(metrics.avgNetPnl)} / trade`}
        />
        <StatCard
          label="Win Rate"
          value={fmtPct(metrics.winRate)}
          subLabel={`${metrics.winningTrades}W / ${metrics.losingTrades}L`}
          valueColor={metrics.winRate >= 0.5 ? "var(--profit)" : "var(--loss)"}
        />
        <StatCard
          label="Profit Factor"
          value={metrics.profitFactor >= 999 ? "∞" : metrics.profitFactor.toFixed(2)}
          subLabel="Gross wins / gross losses"
          valueColor={metrics.profitFactor >= 1.5 ? "var(--profit)" : metrics.profitFactor >= 1 ? "var(--warn)" : "var(--loss)"}
        />
        <StatCard
          label="Sharpe Ratio"
          value={metrics.sharpeRatio.toFixed(2)}
          subLabel={`Sortino: ${metrics.sortinoRatio.toFixed(2)}`}
          valueColor={metrics.sharpeRatio >= 1 ? "var(--profit)" : metrics.sharpeRatio >= 0 ? "var(--warn)" : "var(--loss)"}
        />
        <StatCard
          label="Max Drawdown"
          value={`${metrics.maxDrawdownPct.toFixed(1)}%`}
          subLabel={fmtUsd(metrics.maxDrawdownAbs)}
          valueColor="var(--loss)"
        />
        <StatCard
          label="Avg Win"
          value={fmtUsd(metrics.avgWin)}
          valueColor="var(--profit)"
          subLabel={`Avg loss: ${fmtUsd(metrics.avgLoss)}`}
        />
        <StatCard
          label="Avg Hold"
          value={
            metrics.avgHoldingMins < 60
              ? `${metrics.avgHoldingMins.toFixed(0)}m`
              : `${(metrics.avgHoldingMins / 60).toFixed(1)}h`
          }
          subLabel="Average holding time"
        />
        <StatCard
          label="Avg Quality"
          value={metrics.avgQualityScore !== null ? metrics.avgQualityScore.toFixed(0) : "—"}
          subLabel="Trade quality score (0–100)"
          valueColor={scoreColor}
        />
      </div>

      {/* Equity curve */}
      <div
        className="rounded-lg p-4"
        style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)" }}
      >
        <h2 className="text-sm font-medium mb-3" style={{ color: "var(--text-secondary)" }}>
          Equity Curve
        </h2>
        <EquityCurve data={metrics.equityCurve} />
      </div>

      {/* Recent trades */}
      <div>
        <h2 className="text-sm font-medium mb-3" style={{ color: "var(--text-secondary)" }}>
          Recent Trades
        </h2>
        <TradeTable trades={recent} />
      </div>
    </div>
  );
}
