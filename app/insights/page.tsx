import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { analyzeConditionGroups, buildSetupBlueprint } from "@/lib/analytics/insights";
import ScoreBadge from "@/components/ScoreBadge";
import type { ConditionGroup } from "@/lib/analytics/insights";

function fmt(n: number, prefix = "$"): string {
  const abs = Math.abs(n).toFixed(0);
  return (n >= 0 ? `+${prefix}` : `-${prefix}`) + abs;
}

function PnlCell({ value }: { value: number }) {
  return (
    <span style={{ color: value >= 0 ? "var(--profit)" : "var(--loss)", fontVariantNumeric: "tabular-nums" }}>
      {fmt(value)}
    </span>
  );
}

function UpliftCell({ value }: { value: number }) {
  const color = value > 0 ? "var(--profit)" : value < 0 ? "var(--loss)" : "var(--text-muted)";
  return (
    <span style={{ color, fontVariantNumeric: "tabular-nums" }}>
      {value >= 0 ? "+" : ""}
      {fmt(value)}
    </span>
  );
}

function ComponentTag({ c }: { c: ConditionGroup["component"] }) {
  const colors: Record<string, string> = {
    entry: "#38bdf8",
    exit:  "#a78bfa",
    risk:  "#fb923c",
  };
  return (
    <span
      className="text-xs rounded px-1.5 py-0.5 font-medium uppercase tracking-wide"
      style={{ background: `${colors[c]}22`, color: colors[c] }}
    >
      {c}
    </span>
  );
}

export default async function InsightsPage() {
  const trades = await prisma.trade.findMany({ orderBy: { entryTime: "asc" } });

  const conditionGroups = analyzeConditionGroups(trades);
  const blueprint = buildSetupBlueprint(trades, 70);

  const bestTrades = await prisma.trade.findMany({
    where: { qualityScore: { not: null } },
    orderBy: { qualityScore: "desc" },
    take: 20,
  });

  const hasData = conditionGroups.length > 0;

  return (
    <div className="space-y-6">
      <style>{`.trade-row:hover { background: var(--bg-card-hover); }`}</style>
      <h1 className="text-xl font-semibold">Insights</h1>

      {/* Setup Blueprint */}
      <div
        className="rounded-lg p-5"
        style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)" }}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
            Setup Blueprint
          </h2>
          {blueprint.goodTradeCount > 0 && (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {blueprint.goodTradeCount} of {blueprint.totalTradeCount} trades score ≥{blueprint.minScore}
            </span>
          )}
        </div>

        {blueprint.goodTradeCount === 0 ? (
          <p className="text-sm mt-3" style={{ color: "var(--text-muted)" }}>
            No scored trades found. Run a sync and rescore first.
          </p>
        ) : blueprint.conditions.length === 0 ? (
          <p className="text-sm mt-3" style={{ color: "var(--text-muted)" }}>
            Not enough data to identify distinguishing conditions yet.
          </p>
        ) : (
          <>
            <p className="text-xs mb-4 mt-1" style={{ color: "var(--text-muted)" }}>
              Conditions that appear most often in your top-scoring trades vs. the overall average.
              Avg score: {blueprint.avgScoreInGood.toFixed(0)} · Avg P&L:{" "}
              <span style={{ color: blueprint.avgPnlInGood >= 0 ? "var(--profit)" : "var(--loss)" }}>
                {fmt(blueprint.avgPnlInGood)}
              </span>
            </p>
            <div className="space-y-2">
              {blueprint.conditions.map((cond) => {
                const goodPct = (cond.prevalenceInGood * 100).toFixed(0);
                const allPct = (cond.prevalenceInAll * 100).toFixed(0);
                const barWidth = Math.round(cond.prevalenceInGood * 100);
                return (
                  <div key={cond.key}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-2">
                        <ComponentTag c={cond.component} />
                        <span style={{ color: "var(--text-primary)" }}>{cond.label}</span>
                      </div>
                      <span style={{ color: "var(--text-muted)" }}>
                        {goodPct}% of good trades · {allPct}% overall
                      </span>
                    </div>
                    <div
                      className="h-1.5 rounded-full overflow-hidden"
                      style={{ background: "var(--bg-border)" }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${barWidth}%`, background: "var(--accent)" }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Condition Impact Table */}
      <div
        className="rounded-lg p-5"
        style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)" }}
      >
        <h2 className="text-sm font-medium mb-4" style={{ color: "var(--text-secondary)" }}>
          Condition Impact
        </h2>

        {!hasData ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            No scored trades found. Run a sync and rescore first.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--bg-border)" }}>
                  {["Condition", "Type", "Trades", "Avg Score", "Win Rate", "Avg P&L", "P&L Uplift"].map(
                    (h) => (
                      <th
                        key={h}
                        className="text-left py-2 px-2 text-xs font-medium uppercase tracking-wide"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {conditionGroups.map((g, i) => (
                  <tr
                    key={g.key}
                    style={{
                      borderBottom: "1px solid var(--bg-border)",
                      background: i % 2 === 0 ? "transparent" : "var(--bg-card-hover)",
                    }}
                  >
                    <td className="py-2 px-2" style={{ color: "var(--text-primary)" }}>
                      {g.label}
                    </td>
                    <td className="py-2 px-2">
                      <ComponentTag c={g.component} />
                    </td>
                    <td className="py-2 px-2 tabular-nums" style={{ color: "var(--text-secondary)" }}>
                      {g.tradeCount}
                    </td>
                    <td className="py-2 px-2 tabular-nums" style={{ color: "var(--text-secondary)" }}>
                      {g.avgScore.toFixed(0)}
                    </td>
                    <td className="py-2 px-2 tabular-nums" style={{ color: "var(--text-secondary)" }}>
                      {(g.winRate * 100).toFixed(0)}%
                    </td>
                    <td className="py-2 px-2">
                      <PnlCell value={g.avgPnl} />
                    </td>
                    <td className="py-2 px-2">
                      <UpliftCell value={g.pnlUplift} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Best Trades */}
      <div
        className="rounded-lg p-5"
        style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)" }}
      >
        <h2 className="text-sm font-medium mb-4" style={{ color: "var(--text-secondary)" }}>
          Top Scored Trades
        </h2>

        {bestTrades.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            No scored trades found.
          </p>
        ) : (
          <div className="space-y-1">
            {bestTrades.map((t) => {
              const entryDate = new Date(t.entryTime).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
                timeZone: "Asia/Hong_Kong",
              });
              return (
                <Link
                  key={t.id}
                  href={`/trades/${t.id}`}
                  className="trade-row flex items-center gap-3 rounded-md px-3 py-2 text-sm"
                  style={{ color: "inherit", textDecoration: "none" }}
                >
                  <ScoreBadge score={t.qualityScore} size="sm" />
                  <span
                    className="font-medium w-16 shrink-0 tabular-nums"
                    style={{ color: "var(--accent)" }}
                  >
                    {t.contractName}
                  </span>
                  <span
                    className="w-12 shrink-0 text-xs"
                    style={{
                      color: t.direction === "Long" ? "var(--profit)" : "var(--loss)",
                    }}
                  >
                    {t.direction}
                  </span>
                  <span className="flex-1 text-xs" style={{ color: "var(--text-muted)" }}>
                    {entryDate} HKT
                  </span>
                  <span
                    className="tabular-nums text-xs font-medium"
                    style={{ color: t.netPnl >= 0 ? "var(--profit)" : "var(--loss)" }}
                  >
                    {t.netPnl >= 0 ? "+" : ""}${t.netPnl.toFixed(0)}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
