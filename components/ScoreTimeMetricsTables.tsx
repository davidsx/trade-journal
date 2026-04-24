import type { ReactNode } from "react";
import {
  type ScoreTimeRow,
  pickBestByAvgPnl,
  pickBestByAvgScore,
} from "@/lib/analytics/scoreTimeMetrics";

function fmtPnl(n: number) {
  const sign = n >= 0 ? "+" : "−";
  return `${sign}$${Math.abs(n).toFixed(0)}`;
}

function ScoreBar({ value }: { value: number | null }) {
  if (value === null) {
    return <span style={{ color: "var(--text-muted)" }}>—</span>;
  }
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="w-14 h-1.5 rounded-sm shrink-0 overflow-hidden" style={{ background: "var(--bg-border)" }}>
        <div
          className="h-full rounded-sm"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg, var(--accent) 0%, #22c55e 100%)",
            opacity: 0.9,
          }}
        />
      </div>
      <span className="tabular-nums font-medium" style={{ color: "var(--text-primary)" }}>
        {value.toFixed(1)}
      </span>
    </div>
  );
}

function rowKey(r: ScoreTimeRow) {
  return `${r.label}||${r.sublabel ?? ""}`;
}

function rowsWithTradesOnly(rows: ScoreTimeRow[]) {
  return rows.filter((r) => r.tradeCount > 0);
}

function formatScoreBestCallout(r: ScoreTimeRow | null): { title: string; detail: string } {
  if (!r) return { title: "—", detail: "No scored trades in this split." };
  return {
    title: r.label,
    detail: `avg score ${r.avgQuality!.toFixed(1)} · ${r.tradeCount} trade${r.tradeCount === 1 ? "" : "s"} (${r.scoredCount} scored)`,
  };
}

function formatPnlBestCallout(r: ScoreTimeRow | null): { title: string; detail: string } {
  if (!r) return { title: "—", detail: "No trades in this split yet." };
  return {
    title: r.label,
    detail: `avg P&L ${fmtPnl(r.avgPnl)} · total ${fmtPnl(r.totalPnl)} · ${r.tradeCount} trade${r.tradeCount === 1 ? "" : "s"}`,
  };
}

function MetricsTable({
  rows,
  dense,
  bestByScore,
  bestByPnl,
  fillHeight,
  firstColumnLabel = "When",
}: {
  rows: ScoreTimeRow[];
  dense?: boolean;
  bestByScore: ScoreTimeRow | null;
  bestByPnl: ScoreTimeRow | null;
  fillHeight?: boolean;
  /** Column header for the first column (default “When”). */
  firstColumnLabel?: string;
}) {
  const scoreKey = bestByScore ? rowKey(bestByScore) : null;
  const pnlKey = bestByPnl ? rowKey(bestByPnl) : null;
  const scrollClass = dense
    ? fillHeight
      ? "h-full min-h-0 overflow-x-auto overflow-y-auto"
      : "max-h-[22rem] overflow-x-auto overflow-y-auto"
    : "overflow-x-auto";
  return (
    <div
      className={scrollClass}
      style={{ border: "1px solid var(--bg-border)", borderRadius: 8 }}
    >
      <table className="w-full text-sm border-collapse">
        <thead
          className="sticky top-0 z-10"
          style={{ background: "var(--bg-card)", boxShadow: "0 1px 0 var(--bg-border)" }}
        >
          <tr style={{ color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            <th className="text-left font-medium p-2 pl-3">{firstColumnLabel}</th>
            <th className="text-right font-medium p-2">Trades</th>
            <th className="text-right font-medium p-2">Scored</th>
            <th className="text-left font-medium p-2 min-w-[7rem]">Avg score</th>
            <th className="text-right font-medium p-2">Avg P&amp;L</th>
            <th className="text-right font-medium p-2 pr-3">Total P&amp;L</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const byScore = scoreKey !== null && rowKey(r) === scoreKey;
            const byPnl = pnlKey !== null && rowKey(r) === pnlKey;
            const highlight =
              byScore && byPnl
                ? "color-mix(in srgb, var(--accent) 6%, color-mix(in srgb, var(--profit) 8%, var(--bg-card)))"
                : byScore
                  ? "color-mix(in srgb, var(--accent) 10%, var(--bg-card))"
                  : byPnl
                    ? "color-mix(in srgb, var(--profit) 10%, var(--bg-card))"
                    : undefined;
            const edge =
              byScore || byPnl
                ? `inset 3px 0 0 0 ${byScore ? "var(--accent)" : "var(--profit)"}`
                : undefined;
            return (
            <tr
              key={`${r.label}-${r.sublabel ?? ""}`}
              className="border-t"
              style={{
                borderColor: "var(--bg-border)",
                background: highlight,
                boxShadow: edge,
              }}
            >
              <td className="p-2 pl-3">
                <div className="font-medium" style={{ color: "var(--text-primary)" }}>
                  {r.label}
                  {byScore ? (
                    <span
                      className="ml-1.5 text-[10px] font-semibold uppercase align-middle"
                      style={{ color: "var(--accent)" }}
                    >
                      top score
                    </span>
                  ) : null}
                  {byPnl ? (
                    <span
                      className="ml-1.5 text-[10px] font-semibold uppercase align-middle"
                      style={{ color: "var(--profit)" }}
                    >
                      top P&amp;L
                    </span>
                  ) : null}
                </div>
                {r.sublabel ? (
                  <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {r.sublabel}
                  </div>
                ) : null}
              </td>
              <td className="text-right p-2 tabular-nums" style={{ color: "var(--text-secondary)" }}>
                {r.tradeCount}
              </td>
              <td className="text-right p-2 tabular-nums" style={{ color: "var(--text-secondary)" }}>
                {r.scoredCount}
              </td>
              <td className="p-2">
                <ScoreBar value={r.avgQuality} />
              </td>
              <td
                className="text-right p-2 tabular-nums font-medium"
                style={{ color: r.avgPnl >= 0 ? "var(--profit)" : "var(--loss)" }}
              >
                {r.tradeCount > 0 ? fmtPnl(r.avgPnl) : "—"}
              </td>
              <td
                className="text-right p-2 pr-3 tabular-nums font-medium"
                style={{ color: r.totalPnl >= 0 ? "var(--profit)" : "var(--loss)" }}
              >
                {r.tradeCount > 0 ? fmtPnl(r.totalPnl) : "—"}
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

type Props = {
  session: ScoreTimeRow[];
  hourly: ScoreTimeRow[];
  weekday: ScoreTimeRow[];
  holdTime: ScoreTimeRow[];
};

function BestPanel({
  title,
  hint,
  variant,
  children,
}: {
  title: string;
  hint: string;
  variant: "score" | "pnl";
  children: ReactNode;
}) {
  const accent = variant === "score" ? "var(--accent)" : "var(--profit)";
  const bg =
    variant === "score"
      ? "color-mix(in srgb, var(--accent) 8%, var(--bg-card))"
      : "color-mix(in srgb, var(--profit) 8%, var(--bg-card))";
  return (
    <div
      className="rounded-lg p-3 text-sm"
      style={{
        border: `1px solid ${accent}`,
        background: bg,
      }}
    >
      <div
        className="text-[11px] font-semibold uppercase tracking-wide mb-1"
        style={{ color: accent }}
      >
        {title}
      </div>
      <p className="text-[10px] mb-2" style={{ color: "var(--text-muted)" }}>
        {hint}
      </p>
      <ul className="space-y-1.5" style={{ color: "var(--text-primary)" }}>
        {children}
      </ul>
    </div>
  );
}

function BestStrips({
  bestSessionByScore,
  bestSessionByPnl,
  bestHourByScore,
  bestHourByPnl,
  bestWeekdayByScore,
  bestWeekdayByPnl,
  bestHoldByScore,
  bestHoldByPnl,
  hasTrades,
}: {
  bestSessionByScore: ScoreTimeRow | null;
  bestSessionByPnl: ScoreTimeRow | null;
  bestHourByScore: ScoreTimeRow | null;
  bestHourByPnl: ScoreTimeRow | null;
  bestWeekdayByScore: ScoreTimeRow | null;
  bestWeekdayByPnl: ScoreTimeRow | null;
  bestHoldByScore: ScoreTimeRow | null;
  bestHoldByPnl: ScoreTimeRow | null;
  hasTrades: boolean;
}) {
  const sS = formatScoreBestCallout(bestSessionByScore);
  const sP = formatPnlBestCallout(bestSessionByPnl);
  const hS = formatScoreBestCallout(bestHourByScore);
  const hP = formatPnlBestCallout(bestHourByPnl);
  const wS = formatScoreBestCallout(bestWeekdayByScore);
  const wP = formatPnlBestCallout(bestWeekdayByPnl);
  const hoS = formatScoreBestCallout(bestHoldByScore);
  const hoP = formatPnlBestCallout(bestHoldByPnl);

  const scoreBlock = (
    <>
      <li>
        <span className="font-medium" style={{ color: "var(--text-secondary)" }}>Session: </span>
        <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{sS.title}</span>
        <span className="text-[var(--text-muted)]"> — {sS.detail}</span>
      </li>
      <li>
        <span className="font-medium" style={{ color: "var(--text-secondary)" }}>Hour: </span>
        <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{hS.title}</span>
        <span className="text-[var(--text-muted)]"> — {hS.detail}</span>
      </li>
      <li>
        <span className="font-medium" style={{ color: "var(--text-secondary)" }}>Weekday: </span>
        <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{wS.title}</span>
        <span className="text-[var(--text-muted)]"> — {wS.detail}</span>
      </li>
      {hasTrades ? (
        <li>
          <span className="font-medium" style={{ color: "var(--text-secondary)" }}>Hold: </span>
          <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{hoS.title}</span>
          <span className="text-[var(--text-muted)]"> — {hoS.detail}</span>
        </li>
      ) : null}
    </>
  );

  const pnlBlock = (
    <>
      <li>
        <span className="font-medium" style={{ color: "var(--text-secondary)" }}>Session: </span>
        <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{sP.title}</span>
        <span className="text-[var(--text-muted)]"> — {sP.detail}</span>
      </li>
      <li>
        <span className="font-medium" style={{ color: "var(--text-secondary)" }}>Hour: </span>
        <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{hP.title}</span>
        <span className="text-[var(--text-muted)]"> — {hP.detail}</span>
      </li>
      <li>
        <span className="font-medium" style={{ color: "var(--text-secondary)" }}>Weekday: </span>
        <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{wP.title}</span>
        <span className="text-[var(--text-muted)]"> — {wP.detail}</span>
      </li>
      {hasTrades ? (
        <li>
          <span className="font-medium" style={{ color: "var(--text-secondary)" }}>Hold: </span>
          <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{hoP.title}</span>
          <span className="text-[var(--text-muted)]"> — {hoP.detail}</span>
        </li>
      ) : null}
    </>
  );

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <BestPanel
        title="Best avg quality (score)"
        hint="Among buckets with at least one scored trade."
        variant="score"
      >
        {scoreBlock}
      </BestPanel>
      <BestPanel
        title="Best avg P&amp;L (and total)"
        hint="Ranked by highest average P&amp;L per trade; line shows avg, then total in that bucket."
        variant="pnl"
      >
        {pnlBlock}
      </BestPanel>
    </div>
  );
}

export default function ScoreTimeMetricsTables({ session, hourly, weekday, holdTime }: Props) {
  const hasTrades = session.some((r) => r.tradeCount > 0);
  const sessionRows = rowsWithTradesOnly(session);
  const hourlyRowsWithTrades = rowsWithTradesOnly(hourly);
  const weekdayRows = rowsWithTradesOnly(weekday);
  const holdRows = rowsWithTradesOnly(holdTime);

  const bestSessionByScore = pickBestByAvgScore(sessionRows);
  const bestSessionByPnl = pickBestByAvgPnl(sessionRows);
  const bestHourByScore = pickBestByAvgScore(hourlyRowsWithTrades);
  const bestHourByPnl = pickBestByAvgPnl(hourlyRowsWithTrades);
  const bestWeekdayByScore = pickBestByAvgScore(weekdayRows);
  const bestWeekdayByPnl = pickBestByAvgPnl(weekdayRows);
  const bestHoldByScore = pickBestByAvgScore(holdRows);
  const bestHoldByPnl = pickBestByAvgPnl(holdRows);

  return (
    <div className="space-y-6">
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Session and hour use <strong className="text-[var(--text-secondary)]">entry time (HKT)</strong>.{" "}
        The hour table lists every HKT hour in <strong className="text-[var(--text-secondary)]">Globex trading-day</strong> order
        (06:00 through 05:00), including hours with no trades.{" "}
        Weekday uses the <strong className="text-[var(--text-secondary)]">CME session trading day</strong> (HKT,
        06:00 session start — same as the calendar). <strong className="text-[var(--text-secondary)]">Hold time</strong>{" "}
        is minutes from entry to exit, in a multi-band hold spectrum. Avg quality uses scored trades; P&amp;L uses all trades in
        the bucket. Empty buckets (no trades) are hidden, except the hour grid. Summary cards: one for best <strong className="text-[var(--text-secondary)]">avg quality</strong> (scored trades only), one for best <strong className="text-[var(--text-secondary)]">avg P&amp;L</strong> (and that bucket&apos;s total).
      </p>

      <BestStrips
        bestSessionByScore={bestSessionByScore}
        bestSessionByPnl={bestSessionByPnl}
        bestHourByScore={bestHourByScore}
        bestHourByPnl={bestHourByPnl}
        bestWeekdayByScore={bestWeekdayByScore}
        bestWeekdayByPnl={bestWeekdayByPnl}
        bestHoldByScore={bestHoldByScore}
        bestHoldByPnl={bestHoldByPnl}
        hasTrades={hasTrades}
      />

      {/*
        lg+: two columns — left: session, weekday, hold (stacked); right: by hour (stretches to full left height).
        narrow: single column order — session, weekday, hold, then hour.
      */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:items-stretch min-w-0">
        <div className="flex min-w-0 flex-col gap-6">
          <section
            className="rounded-lg p-4"
            style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)" }}
          >
            <h2 className="text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
              Quality score by session
            </h2>
            <p className="text-xs mb-2 space-y-1" style={{ color: "var(--text-muted)" }}>
              <span className="block">
                Same sessions as the chart: Asia (8am–4pm HKT), London, NY, off-hours.
              </span>
              <span className="block" style={{ color: "var(--accent)" }}>
                Top score: {formatScoreBestCallout(bestSessionByScore).title} —{" "}
                {formatScoreBestCallout(bestSessionByScore).detail}
              </span>
              <span className="block" style={{ color: "var(--profit)" }}>
                Top P&amp;L: {formatPnlBestCallout(bestSessionByPnl).title} —{" "}
                {formatPnlBestCallout(bestSessionByPnl).detail}
              </span>
            </p>
            <MetricsTable rows={sessionRows} bestByScore={bestSessionByScore} bestByPnl={bestSessionByPnl} />
          </section>
          <section
            className="rounded-lg p-4"
            style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)" }}
          >
            <h2 className="text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
              By weekday
            </h2>
            <p className="text-xs mb-2 space-y-1" style={{ color: "var(--text-muted)" }}>
              <span className="block">
                Weekday of the <strong className="text-[var(--text-secondary)]">trading session date</strong>{" "}
                (Globex day in HKT, not civil clock). Mon → Sun.
              </span>
              <span className="block" style={{ color: "var(--accent)" }}>
                Top score: {formatScoreBestCallout(bestWeekdayByScore).title} —{" "}
                {formatScoreBestCallout(bestWeekdayByScore).detail}
              </span>
              <span className="block" style={{ color: "var(--profit)" }}>
                Top P&amp;L: {formatPnlBestCallout(bestWeekdayByPnl).title} —{" "}
                {formatPnlBestCallout(bestWeekdayByPnl).detail}
              </span>
            </p>
            <MetricsTable rows={weekdayRows} bestByScore={bestWeekdayByScore} bestByPnl={bestWeekdayByPnl} />
          </section>
          <section
            className="rounded-lg p-4"
            style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)" }}
          >
            <h2 className="text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
              By hold time
            </h2>
            <p className="text-xs mb-2 space-y-1" style={{ color: "var(--text-muted)" }}>
              <span className="block">
                Time from entry to exit, split into <strong className="text-[var(--text-secondary)]">nine hold bands</strong> from
                sub-minute through multi-hour (finer than the quality scorer’s four hold categories).
              </span>
              <span className="block" style={{ color: "var(--accent)" }}>
                Top score: {formatScoreBestCallout(bestHoldByScore).title} — {formatScoreBestCallout(bestHoldByScore).detail}
              </span>
              <span className="block" style={{ color: "var(--profit)" }}>
                Top P&amp;L: {formatPnlBestCallout(bestHoldByPnl).title} — {formatPnlBestCallout(bestHoldByPnl).detail}
              </span>
            </p>
            <MetricsTable
              rows={holdRows}
              bestByScore={bestHoldByScore}
              bestByPnl={bestHoldByPnl}
              firstColumnLabel="Hold time"
            />
          </section>
        </div>

        <section
          className="flex h-full w-full min-w-0 flex-col min-h-[20rem] rounded-lg p-4 lg:min-h-0"
          style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)" }}
        >
          <h2 className="text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
            By hour of day
          </h2>
          <p className="mb-2 shrink-0 space-y-1 text-xs" style={{ color: "var(--text-muted)" }}>
            <span className="block">
              HKT hour of entry, ordered from session open (06:00) through 05:00; every hour is shown, including with zero
              trades.
            </span>
            <span className="block" style={{ color: "var(--accent)" }}>
              Top score: {formatScoreBestCallout(bestHourByScore).title} —{" "}
              {formatScoreBestCallout(bestHourByScore).detail}
            </span>
            <span className="block" style={{ color: "var(--profit)" }}>
              Top P&amp;L: {formatPnlBestCallout(bestHourByPnl).title} —{" "}
              {formatPnlBestCallout(bestHourByPnl).detail}
            </span>
          </p>
          <div className="flex min-h-0 flex-1 flex-col">
            <MetricsTable
              rows={hourly}
              dense
              bestByScore={bestHourByScore}
              bestByPnl={bestHourByPnl}
              fillHeight
            />
          </div>
        </section>
      </div>
    </div>
  );
}
