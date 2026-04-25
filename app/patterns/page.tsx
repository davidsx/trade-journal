import { getActiveAccountId } from "@/lib/activeAccount";
import { tradesWhere } from "@/lib/accountScope";
import { prisma } from "@/lib/db/prisma";
import {
  analyzeTimeOfDay,
  analyzeDayOfWeek,
  analyzeInstruments,
  analyzeStreaks,
  analyzeEdgeDecay,
  analyzeSessionPerformance,
} from "@/lib/analytics/patterns";
import TimeHeatmap from "@/components/TimeHeatmap";
import SessionPerformanceGrid from "@/components/SessionPerformanceGrid";

function fmtUsd(v: number) {
  return `${v >= 0 ? "+" : "-"}$${Math.abs(v).toFixed(2)}`;
}

export default async function PatternsPage() {
  const accountId = await getActiveAccountId();
  const trades = await prisma.trade.findMany({ where: tradesWhere(accountId), orderBy: { entryTime: "asc" } });
  const timeOfDay = analyzeTimeOfDay(trades);
  const dayOfWeek = analyzeDayOfWeek(trades);
  const instruments = analyzeInstruments(trades);
  const streaks = analyzeStreaks(trades);
  const edgeDecay = analyzeEdgeDecay(trades);
  const sessions = analyzeSessionPerformance(trades);

  const decayAlerts = edgeDecay.filter((e) => e.decayAlert);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Patterns</h1>

      {/* Heatmaps */}
      <div
        className="rounded-lg p-5"
        style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)" }}
      >
        <h2 className="text-sm font-medium mb-4" style={{ color: "var(--text-secondary)" }}>
          Time Patterns
        </h2>
        <TimeHeatmap timeOfDay={timeOfDay} dayOfWeek={dayOfWeek} />
      </div>

      <SessionPerformanceGrid
        sessions={sessions}
        title="Session Performance (HKT)"
      />

      {/* Instrument breakdown */}
      <div
        className="rounded-lg p-5"
        style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)" }}
      >
        <h2 className="text-sm font-medium mb-4" style={{ color: "var(--text-secondary)" }}>
          Instrument Performance
        </h2>
        {instruments.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No data yet</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--bg-border)" }}>
                {["Instrument", "Trades", "Win Rate", "Profit Factor", "Avg P&L", "Total P&L", ""].map((h) => (
                  <th
                    key={h}
                    className="text-left pb-2 text-xs uppercase tracking-wide"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {instruments.map((ins) => (
                <tr key={ins.contractName} style={{ borderBottom: "1px solid var(--bg-border)" }}>
                  <td className="py-2 font-medium">{ins.contractName}</td>
                  <td className="py-2 tabular-nums" style={{ color: "var(--text-secondary)" }}>
                    {ins.tradeCount}
                  </td>
                  <td
                    className="py-2 tabular-nums"
                    style={{ color: ins.winRate >= 0.5 ? "var(--profit)" : "var(--loss)" }}
                  >
                    {(ins.winRate * 100).toFixed(1)}%
                  </td>
                  <td
                    className="py-2 tabular-nums"
                    style={{ color: ins.profitFactor >= 1 ? "var(--profit)" : "var(--loss)" }}
                  >
                    {ins.profitFactor >= 999 ? "∞" : ins.profitFactor.toFixed(2)}
                  </td>
                  <td
                    className="py-2 tabular-nums"
                    style={{ color: ins.avgPnl >= 0 ? "var(--profit)" : "var(--loss)" }}
                  >
                    {fmtUsd(ins.avgPnl)}
                  </td>
                  <td
                    className="py-2 tabular-nums font-medium"
                    style={{ color: ins.totalPnl >= 0 ? "var(--profit)" : "var(--loss)" }}
                  >
                    {fmtUsd(ins.totalPnl)}
                  </td>
                  <td className="py-2">
                    {ins.warning && (
                      <span
                        className="text-xs px-2 py-0.5 rounded"
                        style={{ background: "#f59e0b22", color: "var(--warn)" }}
                      >
                        ⚠ {ins.warning}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Streak analysis */}
      <div
        className="rounded-lg p-5"
        style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)" }}
      >
        <h2 className="text-sm font-medium mb-4" style={{ color: "var(--text-secondary)" }}>
          Streak Analysis
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>
              Current Streak
            </div>
            <div
              className="font-semibold text-lg tabular-nums"
              style={{
                color:
                  streaks.currentStreakType === "win"
                    ? "var(--profit)"
                    : streaks.currentStreakType === "loss"
                    ? "var(--loss)"
                    : "var(--text-secondary)",
              }}
            >
              {streaks.currentStreakType === "win"
                ? `+${streaks.currentStreak} wins`
                : streaks.currentStreakType === "loss"
                ? `${streaks.currentStreak} losses`
                : "—"}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>
              Max Win Streak
            </div>
            <div className="font-semibold text-lg tabular-nums" style={{ color: "var(--profit)" }}>
              {streaks.maxWinStreak}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>
              Max Loss Streak
            </div>
            <div className="font-semibold text-lg tabular-nums" style={{ color: "var(--loss)" }}>
              {streaks.maxLossStreak}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>
              Longest Underwater
            </div>
            <div className="font-semibold text-lg tabular-nums">
              {streaks.longestUnderwaterTrades} trades
            </div>
          </div>
        </div>
      </div>

      {/* Edge decay */}
      {edgeDecay.length > 0 && (
        <div
          className="rounded-lg p-5"
          style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
              Edge Decay (20-trade rolling win rate)
            </h2>
            {decayAlerts.length > 0 && (
              <span
                className="text-xs px-2 py-0.5 rounded"
                style={{ background: "#ef444422", color: "var(--loss)" }}
              >
                ⚠ {decayAlerts.length} decay periods detected
              </span>
            )}
          </div>
          <div className="flex items-end gap-0.5 h-16 overflow-x-auto">
            {edgeDecay.map((pt) => (
              <div
                key={pt.tradeIndex}
                title={`Trade ${pt.tradeIndex}: ${(pt.rollingWinRate * 100).toFixed(0)}%`}
                className="flex-shrink-0 rounded-sm"
                style={{
                  width: 6,
                  height: `${Math.max(pt.rollingWinRate * 100, 2)}%`,
                  background: pt.decayAlert ? "var(--loss)" : "var(--profit)",
                  opacity: 0.8,
                }}
              />
            ))}
          </div>
          <div className="flex justify-between mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            <span>Trade {edgeDecay[0]?.tradeIndex}</span>
            <span>Trade {edgeDecay[edgeDecay.length - 1]?.tradeIndex}</span>
          </div>
        </div>
      )}
    </div>
  );
}
