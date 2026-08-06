import { getActiveAccountId } from "@/lib/activeAccount";
import { tradesWhere } from "@/lib/accountScope";
import { prisma } from "@/lib/db/prisma";
import { computeSummaryMetrics } from "@/lib/analytics/metrics";
import { getAccountSettings } from "@/lib/accountSettings";
import EquityCurve from "@/components/EquityCurve";
import DrawdownChart from "@/components/DrawdownChart";
import PnlBarChart from "@/components/PnlBarChart";

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

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Analytics</h1>

      {/* Summary stats — P&L, execution, quality, and risk-adjusted returns */}
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
            Avg hold
          </div>
          <div className="font-semibold text-lg" style={{ color: "var(--text-primary)" }}>
            {metrics.totalTrades === 0 ? "—" : formatAvgHoldMins(metrics.avgHoldingMins)}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>
            Sharpe ratio
          </div>
          <div
            className="font-semibold text-lg tabular-nums"
            style={{
              color:
                metrics.totalTrades === 0
                  ? "var(--text-primary)"
                  : metrics.sharpeRatio >= 1
                  ? "var(--profit)"
                  : metrics.sharpeRatio >= 0
                  ? "var(--warn)"
                  : "var(--loss)",
            }}
          >
            {metrics.totalTrades === 0 ? "—" : metrics.sharpeRatio.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>
            Sortino ratio
          </div>
          <div className="font-semibold text-lg tabular-nums" style={{ color: "var(--text-primary)" }}>
            {metrics.totalTrades === 0 ? "—" : metrics.sortinoRatio.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Equity curve */}
      <div
        className="rounded-lg p-4"
        style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)" }}
      >
        <h2 className="text-sm font-medium mb-3" style={{ color: "var(--text-secondary)" }}>
          Equity Curve
        </h2>
        <EquityCurve data={metrics.equityCurve} startingCapital={metrics.startingCapital} />
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
    </div>
  );
}
