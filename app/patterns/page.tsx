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

      {/* Session Performance */}
      <div
        className="rounded-lg p-5"
        style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)" }}
      >
        <h2 className="text-sm font-medium mb-4" style={{ color: "var(--text-secondary)" }}>
          Session Performance (HKT)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {sessions.map((s) => {
            const sessionColor =
              s.session === "Asia"      ? { bg: "#8b5cf618", border: "#8b5cf640", accent: "#a78bfa" } :
              s.session === "London"    ? { bg: "#3b82f618", border: "#3b82f640", accent: "#60a5fa" } :
              s.session === "NY"        ? { bg: "#22c55e18", border: "#22c55e40", accent: "#4ade80" } :
                                          { bg: "#6b728018", border: "#6b728040", accent: "#9ca3af" };
            const noData = s.tradeCount === 0;
            return (
              <div
                key={s.session}
                className="rounded-lg p-4"
                style={{ background: sessionColor.bg, border: `1px solid ${sessionColor.border}` }}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold" style={{ color: sessionColor.accent }}>
                    {s.session}
                  </span>
                  {!noData && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full tabular-nums"
                      style={{ background: "var(--bg-card)", color: "var(--text-muted)" }}
                    >
                      {s.tradeCount} trades
                    </span>
                  )}
                </div>
                <div className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
                  {s.hktRange} HKT
                </div>

                {noData ? (
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>No trades</p>
                ) : (
                  <div className="space-y-2">
                    {/* Win rate bar */}
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span style={{ color: "var(--text-muted)" }}>Win rate</span>
                        <span
                          className="tabular-nums font-medium"
                          style={{ color: s.winRate >= 0.5 ? "var(--profit)" : "var(--loss)" }}
                        >
                          {(s.winRate * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ background: "var(--bg-border)" }}>
                        <div
                          className="h-1.5 rounded-full"
                          style={{
                            width: `${s.winRate * 100}%`,
                            background: s.winRate >= 0.5 ? "var(--profit)" : "var(--loss)",
                          }}
                        />
                      </div>
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs mt-2">
                      <div>
                        <div style={{ color: "var(--text-muted)" }}>Total P&L</div>
                        <div
                          className="tabular-nums font-medium"
                          style={{ color: s.totalPnl >= 0 ? "var(--profit)" : "var(--loss)" }}
                        >
                          {s.totalPnl >= 0 ? "+" : "-"}${Math.abs(s.totalPnl).toFixed(0)}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: "var(--text-muted)" }}>Avg P&L</div>
                        <div
                          className="tabular-nums font-medium"
                          style={{ color: s.avgPnl >= 0 ? "var(--profit)" : "var(--loss)" }}
                        >
                          {s.avgPnl >= 0 ? "+" : "-"}${Math.abs(s.avgPnl).toFixed(0)}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: "var(--text-muted)" }}>Profit factor</div>
                        <div
                          className="tabular-nums font-medium"
                          style={{ color: s.profitFactor >= 1 ? "var(--profit)" : "var(--loss)" }}
                        >
                          {s.profitFactor >= 999 ? "∞" : s.profitFactor.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: "var(--text-muted)" }}>Avg hold</div>
                        <div className="tabular-nums font-medium" style={{ color: "var(--text-secondary)" }}>
                          {s.avgHoldMins < 60
                            ? `${s.avgHoldMins.toFixed(0)}m`
                            : `${(s.avgHoldMins / 60).toFixed(1)}h`}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: "var(--text-muted)" }}>Best</div>
                        <div className="tabular-nums font-medium" style={{ color: "var(--profit)" }}>
                          +${s.bestTrade.toFixed(0)}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: "var(--text-muted)" }}>Worst</div>
                        <div className="tabular-nums font-medium" style={{ color: "var(--loss)" }}>
                          -${Math.abs(s.worstTrade).toFixed(0)}
                        </div>
                      </div>
                    </div>

                    {/* Long / Short breakdown */}
                    <div
                      className="mt-2 pt-2 grid grid-cols-2 gap-x-3 text-xs"
                      style={{ borderTop: "1px solid var(--bg-border)" }}
                    >
                      <div>
                        <span style={{ color: "var(--profit)" }}>▲ Long </span>
                        <span className="tabular-nums" style={{ color: "var(--text-secondary)" }}>
                          {s.longCount} · {(s.longWinRate * 100).toFixed(0)}% WR
                        </span>
                      </div>
                      <div>
                        <span style={{ color: "var(--loss)" }}>▼ Short </span>
                        <span className="tabular-nums" style={{ color: "var(--text-secondary)" }}>
                          {s.shortCount} · {(s.shortWinRate * 100).toFixed(0)}% WR
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

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
