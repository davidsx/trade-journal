import type { SessionPattern } from "@/lib/analytics/patterns";

type Props = {
  sessions: SessionPattern[];
  title?: string;
  /** Extra wrapper classes for the inner grid (e.g. responsive columns) */
  gridClassName?: string;
};

export default function SessionPerformanceGrid({
  sessions,
  title = "Session performance (HKT)",
  gridClassName = "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3",
}: Props) {
  return (
    <div
      className="rounded-lg p-5"
      style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)" }}
    >
      <h2 className="text-sm font-medium mb-4" style={{ color: "var(--text-secondary)" }}>
        {title}
      </h2>
      <div className={gridClassName}>
        {sessions.map((s) => {
          const sessionColor =
            s.session === "Asia"
              ? { bg: "#8b5cf618", border: "#8b5cf640", accent: "#a78bfa" }
              : s.session === "London"
                ? { bg: "#3b82f618", border: "#3b82f640", accent: "#60a5fa" }
                : s.session === "NY"
                  ? { bg: "#22c55e18", border: "#22c55e40", accent: "#4ade80" }
                  : { bg: "#6b728018", border: "#6b728040", accent: "#9ca3af" };
          const noData = s.tradeCount === 0;
          return (
            <div
              key={s.session}
              className="rounded-lg p-4"
              style={{ background: sessionColor.bg, border: `1px solid ${sessionColor.border}` }}
            >
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
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  No trades
                </p>
              ) : (
                <div className="space-y-2">
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
  );
}
