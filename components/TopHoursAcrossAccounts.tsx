import type { SessionName } from "@/lib/analytics/patterns";

interface HourRankTally {
  hour: number;
  hourLabel: string;
  session: SessionName;
  weightedScore: number;
  firsts: number;
  seconds: number;
  thirds: number;
  appearances: number;
  totalPnl: number;
}

interface Props {
  /** Full cross-account ranking, best → worst, of every traded hour. */
  tallies: HourRankTally[];
  accountsCounted: number;
}

const MEDALS = ["🥇", "🥈", "🥉"] as const;
const RANK_COLORS = ["#fbbf24", "#cbd5e1", "#d8a15a"] as const;

function fmtUsd(v: number) {
  return `${v >= 0 ? "+" : "−"}$${Math.abs(v).toFixed(2)}`;
}

function sessionMeta(s: SessionName): { fg: string; bg: string; abbr: string } {
  switch (s) {
    case "Asia":
      return { fg: "#c4b5fd", bg: "color-mix(in srgb, #8b5cf6 22%, var(--bg-card))", abbr: "Asia" };
    case "London":
      return { fg: "#93c5fd", bg: "color-mix(in srgb, #3b82f6 20%, var(--bg-card))", abbr: "London" };
    case "NY":
      return { fg: "#86efac", bg: "color-mix(in srgb, #22c55e 18%, var(--bg-card))", abbr: "NY" };
    default:
      return { fg: "#d1d5db", bg: "color-mix(in srgb, #6b7280 24%, var(--bg-card))", abbr: "Off" };
  }
}

/** Podium card for a top-3 hour (medal + rank). */
function PodiumCard({
  t,
  rank,
  accountsCounted,
}: {
  t: HourRankTally;
  rank: number;
  accountsCounted: number;
}) {
  const meta = sessionMeta(t.session);
  const color = RANK_COLORS[rank - 1];
  const badge = MEDALS[rank - 1];
  const vote = (i: number) => MEDALS[i];
  return (
    <div
      className="rounded-lg p-4 flex flex-col gap-2"
      style={{ background: "var(--bg-base)", border: `1px solid ${color}` }}
    >
      <div className="flex items-center justify-between">
        <span className="leading-none" style={{ fontSize: "1.5rem" }} aria-hidden>
          {badge}
          <span className="text-xs font-bold ml-0.5 align-middle">#{rank}</span>
        </span>
        <span
          className="text-[10px] font-medium px-1.5 py-0.5 rounded"
          style={{ background: meta.bg, color: meta.fg }}
        >
          {meta.abbr}
        </span>
      </div>
      <div className="font-mono text-xl font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
        {t.hourLabel}
        <span className="text-xs font-normal ml-1" style={{ color: "var(--text-muted)" }}>
          HKT
        </span>
      </div>
      <div className="text-xs tabular-nums" style={{ color: "var(--text-secondary)" }}>
        <span className="font-semibold" style={{ color }}>
          {t.weightedScore}
        </span>{" "}
        pts · {t.appearances} of {accountsCounted} accounts
      </div>
      <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] tabular-nums" style={{ color: "var(--text-muted)" }}>
        {t.firsts > 0 && <span>{vote(0)} ×{t.firsts}</span>}
        {t.seconds > 0 && <span>{vote(1)} ×{t.seconds}</span>}
        {t.thirds > 0 && <span>{vote(2)} ×{t.thirds}</span>}
        {t.firsts + t.seconds + t.thirds === 0 && <span>no top-3 votes</span>}
      </div>
      <div
        className="text-sm font-medium tabular-nums mt-auto"
        style={{ color: t.totalPnl >= 0 ? "var(--profit)" : "var(--loss)" }}
      >
        {fmtUsd(t.totalPnl)}
        <span className="text-[11px] font-normal ml-1" style={{ color: "var(--text-muted)" }}>
          combined
        </span>
      </div>
    </div>
  );
}

export default function TopHoursAcrossAccounts({ tallies, accountsCounted }: Props) {
  const top3 = tallies.slice(0, 3);
  const runnersUp = tallies.slice(3); // ranks #4 onward — show them all

  // Worst three hours by combined P&L (only losing ones qualify) → set of hours,
  // and a rank map (1 = worst). Marked at the tail of the full ranking.
  const worst3 = [...tallies]
    .filter((t) => t.totalPnl < 0)
    .sort((a, b) => a.totalPnl - b.totalPnl)
    .slice(0, 3);
  const worstRankByHour = new Map(worst3.map((t, i) => [t.hour, i + 1]));

  return (
    <div
      className="rounded-lg p-5"
      style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)" }}
    >
      <h2 className="text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
        Hours Across Accounts (weighted)
      </h2>
      <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
        Every traded hour ranked best → worst across {accountsCounted} account
        {accountsCounted === 1 ? "" : "s"}. Each account&apos;s three best P&amp;L hours vote — #1 = 3 pts, #2 = 2 pts,
        #3 = 1 pt — to order the leaders; combined P&amp;L breaks ties. The three worst hours by combined P&amp;L are
        flagged <span style={{ color: "var(--loss)" }}>⚠</span> at the tail.
      </p>

      {top3.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Not enough data — no account has a profitable hour yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {top3.map((t, i) => (
            <PodiumCard key={t.hour} t={t} rank={i + 1} accountsCounted={accountsCounted} />
          ))}
        </div>
      )}

      {runnersUp.length > 0 && (
        <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--bg-border)" }}>
          <div className="text-[11px] uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>
            Ranks #4–#{3 + runnersUp.length}
          </div>
          <div className="flex flex-col gap-1">
            {runnersUp.map((t, i) => {
              const meta = sessionMeta(t.session);
              const worstRank = worstRankByHour.get(t.hour);
              return (
                <div
                  key={t.hour}
                  className="flex items-center gap-3 text-xs py-1 px-2 rounded"
                  style={{
                    background:
                      worstRank !== undefined
                        ? "color-mix(in srgb, var(--loss) 10%, var(--bg-base))"
                        : "var(--bg-base)",
                    border:
                      worstRank !== undefined
                        ? "1px solid color-mix(in srgb, var(--loss) 35%, transparent)"
                        : "1px solid transparent",
                  }}
                >
                  <span className="w-6 tabular-nums font-medium" style={{ color: "var(--text-muted)" }}>
                    #{i + 4}
                  </span>
                  <span className="font-mono tabular-nums font-medium w-14" style={{ color: "var(--text-primary)" }}>
                    {t.hourLabel}
                  </span>
                  <span
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                    style={{ background: meta.bg, color: meta.fg }}
                  >
                    {meta.abbr}
                  </span>
                  <span className="tabular-nums" style={{ color: "var(--text-secondary)" }}>
                    <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
                      {t.weightedScore}
                    </span>{" "}
                    pts
                  </span>
                  <span className="tabular-nums hidden sm:inline" style={{ color: "var(--text-muted)" }}>
                    {t.appearances} of {accountsCounted}
                  </span>
                  {worstRank !== undefined && (
                    <span
                      className="inline-flex items-center gap-0.5 text-[11px] font-bold leading-none"
                      style={{ color: "var(--loss)" }}
                      title={`#${worstRank} worst hour by combined P&L`}
                    >
                      <span aria-hidden>⚠</span>
                      {worstRank}
                    </span>
                  )}
                  <span
                    className="tabular-nums font-medium ml-auto"
                    style={{ color: t.totalPnl >= 0 ? "var(--profit)" : "var(--loss)" }}
                  >
                    {fmtUsd(t.totalPnl)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
