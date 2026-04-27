import Link from "next/link";
import { getActiveAccountId } from "@/lib/activeAccount";
import { tradesWhere } from "@/lib/accountScope";
import { prisma } from "@/lib/db/prisma";
import {
  analyzeConditionGroups,
  buildSetupBlueprint,
  CONDITION_CATEGORIES,
  type ConditionCategory,
  type ConditionGroup,
} from "@/lib/analytics/insights";
import ScoreBadge from "@/components/ScoreBadge";

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

function ComponentBadge({ component }: { component: ConditionGroup["component"] }) {
  const colors: Record<ConditionGroup["component"], string> = {
    entry: "#38bdf8",
    exit:  "#a78bfa",
    risk:  "#fb923c",
  };
  return (
    <span
      className="text-[10px] rounded px-1.5 py-0.5 font-medium uppercase tracking-wide"
      style={{ background: `${colors[component]}22`, color: colors[component] }}
    >
      {component}
    </span>
  );
}

function PointsBadge({ pointsLabel, points }: { pointsLabel: string; points: number }) {
  // green for high-scoring rules, neutral for mid, gray for 0-pt rules
  const color = points >= 15 ? "var(--profit)" : points > 0 ? "var(--text-secondary)" : "var(--text-muted)";
  return (
    <span
      className="inline-block rounded px-1.5 py-0.5 text-[11px] font-medium tabular-nums"
      style={{ background: "var(--bg-card-hover)", color, border: "1px solid var(--bg-border)" }}
    >
      {pointsLabel}
    </span>
  );
}

const CATEGORY_ORDER: ConditionCategory[] = ["session", "sizing", "imbalance", "breakout", "streak"];

const COLUMN_HEADERS: { key: string; label: string; tooltip: string; align?: "left" | "right" }[] = [
  { key: "condition", label: "Condition", tooltip: "Specific finding from each trade's score breakdown notes." },
  { key: "score",     label: "Score",     tooltip: "Points awarded by the score guide when this condition is present on a trade." },
  { key: "trades",    label: "Trades",    tooltip: "Number of your scored trades that matched this condition." },
  { key: "avgScore",  label: "Avg Score", tooltip: "Average overall quality score (0–100) of the matching trades." },
  { key: "winRate",   label: "Win Rate",  tooltip: "Share of matching trades that were profitable (net P&L > 0)." },
  { key: "avgPnl",    label: "Avg P&L",   tooltip: "Mean net P&L across the matching trades." },
  { key: "uplift",    label: "P&L Uplift", tooltip: "Avg P&L of trades with this condition minus avg P&L of trades without — how much this condition shifts your typical outcome." },
];

export default async function InsightsPage() {
  const accountId = await getActiveAccountId();
  const trades = await prisma.trade.findMany({ where: tradesWhere(accountId), orderBy: { entryTime: "asc" } });

  const conditionGroups = analyzeConditionGroups(trades);
  const blueprint = buildSetupBlueprint(trades, 70);

  const bestTrades = await prisma.trade.findMany({
    where: tradesWhere(accountId, { qualityScore: { not: null } }),
    orderBy: { qualityScore: "desc" },
    take: 20,
  });

  const hasData = conditionGroups.length > 0;

  // Bucket conditions by category for the Impact table
  const byCategory = new Map<ConditionCategory, ConditionGroup[]>();
  for (const cat of CATEGORY_ORDER) byCategory.set(cat, []);
  for (const g of conditionGroups) byCategory.get(g.category)?.push(g);
  // Within each category, sort by points DESC to mirror the score guide
  for (const cat of CATEGORY_ORDER) {
    byCategory.get(cat)?.sort((a, b) => b.points - a.points);
  }

  return (
    <div className="space-y-6">
      <style>{`.trade-row:hover { background: var(--bg-card-hover); }`}</style>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Insights</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Which scoring conditions actually move your P&L.
          </p>
        </div>
        <Link
          href="/score-guide"
          className="text-xs rounded px-2.5 py-1.5"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--bg-border)",
            color: "var(--accent)",
            textDecoration: "none",
          }}
        >
          View Score Guide →
        </Link>
      </div>

      {/* How to read this page */}
      <div
        className="rounded-lg p-5 text-sm"
        style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)" }}
      >
        <h2 className="text-sm font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>
          How to read this page
        </h2>
        <p style={{ color: "var(--text-secondary)" }}>
          Every trade gets a 0–100 quality score. The score is a sum of points awarded by{" "}
          <Link href="/score-guide" style={{ color: "var(--accent)" }}>specific rules</Link>
          {" "}— things like <em>was the entry inside a Fair Value Gap?</em>, <em>was sizing conservative?</em>,
          <em> was this a revenge trade after wins?</em>. Each rule outcome is what we call a{" "}
          <strong>condition</strong>. The tables below group your real trades by these conditions so you can see
          which ones correlate with profit and which don&rsquo;t.
        </p>
        <ul className="mt-3 space-y-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
          <li>
            <strong style={{ color: "var(--text-secondary)" }}>Setup Blueprint</strong> — conditions that show up
            disproportionately in your top-scoring trades (≥70).
          </li>
          <li>
            <strong style={{ color: "var(--text-secondary)" }}>Condition Impact</strong> — every condition,
            grouped by score-guide category, with the points it&rsquo;s worth and how P&L compares with vs.
            without it.
          </li>
        </ul>
      </div>

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
              Conditions overrepresented in trades scoring ≥{blueprint.minScore} vs. all scored trades.
              Avg score of good trades: {blueprint.avgScoreInGood.toFixed(0)} · Avg P&L:{" "}
              <span style={{ color: blueprint.avgPnlInGood >= 0 ? "var(--profit)" : "var(--loss)" }}>
                {fmt(blueprint.avgPnlInGood)}
              </span>
            </p>
            <div className="space-y-2">
              {blueprint.conditions.map((cond) => {
                const goodPct = (cond.prevalenceInGood * 100).toFixed(0);
                const allPct = (cond.prevalenceInAll * 100).toFixed(0);
                const barWidth = Math.round(cond.prevalenceInGood * 100);
                const categoryTitle = CONDITION_CATEGORIES[cond.category].title;
                return (
                  <div key={cond.key}>
                    <div className="flex items-center justify-between text-xs mb-1 gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <PointsBadge pointsLabel={cond.pointsLabel} points={cond.points} />
                        <span style={{ color: "var(--text-primary)" }} className="truncate">
                          {categoryTitle}: {cond.label}
                        </span>
                      </div>
                      <span className="shrink-0 tabular-nums" style={{ color: "var(--text-muted)" }}>
                        {goodPct}% of good · {allPct}% overall
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

      {/* Condition Impact Table — grouped by category */}
      <div
        className="rounded-lg p-5"
        style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)" }}
      >
        <h2 className="text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
          Condition Impact
        </h2>
        <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
          Each row is one rule from the{" "}
          <Link href="/score-guide" style={{ color: "var(--accent)" }}>Score Guide</Link>
          . The <strong>Score</strong> column shows the points the rule awards; the right-hand columns show how
          your trades that matched the rule actually performed. Hover any column header for a full definition.
        </p>

        {!hasData ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            No scored trades found. Run a sync and rescore first.
          </p>
        ) : (
          <div className="space-y-6">
            {CATEGORY_ORDER.map((catKey) => {
              const rows = byCategory.get(catKey) ?? [];
              if (rows.length === 0) return null;
              const cat = CONDITION_CATEGORIES[catKey];

              return (
                <section key={catKey}>
                  <div className="flex items-baseline justify-between gap-3 mb-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                        {cat.title}
                      </h3>
                      <ComponentBadge component={cat.component} />
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        max {cat.maxPoints} pts
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {cat.description}
                    </p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid var(--bg-border)" }}>
                          {COLUMN_HEADERS.map((h) => (
                            <th
                              key={h.key}
                              title={h.tooltip}
                              className="text-left py-2 px-2 text-[11px] font-medium uppercase tracking-wide"
                              style={{ color: "var(--text-muted)", cursor: "help" }}
                            >
                              {h.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((g, i) => (
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
                              <PointsBadge pointsLabel={g.pointsLabel} points={g.points} />
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
                </section>
              );
            })}
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
