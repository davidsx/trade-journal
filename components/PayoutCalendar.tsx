"use client";

import { useMemo, useState } from "react";

/** Serialized payout row for the dashboard payout calendar. */
export type CalendarPayout = {
  id: number;
  accountLabel: string;
  amount: number;
  /** ISO timestamp; the payout is placed on this date's UTC calendar day. */
  date: string;
  note: string | null;
};

/** Serialized account-cost entry, placed on the account's creation day. */
export type CalendarCost = {
  id: number;
  accountLabel: string;
  amount: number;
  /** ISO timestamp; the cost is placed on this date's UTC calendar day. */
  date: string;
};

type DayStat = {
  payoutAmount: number;
  payoutCount: number;
  costAmount: number;
  costCount: number;
  payouts: CalendarPayout[];
  costs: CalendarCost[];
};

function emptyDay(): DayStat {
  return { payoutAmount: 0, payoutCount: 0, costAmount: 0, costCount: 0, payouts: [], costs: [] };
}

/** Key an ISO timestamp by its UTC calendar day (amounts are stored at UTC midnight). */
function utcDayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate()
  ).padStart(2, "0")}`;
}

function buildDailyStats(payouts: CalendarPayout[], costs: CalendarCost[]): Record<string, DayStat> {
  const map = new Map<string, DayStat>();
  for (const p of payouts) {
    const k = utcDayKey(p.date);
    const cur = map.get(k) ?? emptyDay();
    cur.payoutAmount += p.amount;
    cur.payoutCount += 1;
    cur.payouts.push(p);
    map.set(k, cur);
  }
  for (const c of costs) {
    const k = utcDayKey(c.date);
    const cur = map.get(k) ?? emptyDay();
    cur.costAmount += c.amount;
    cur.costCount += 1;
    cur.costs.push(c);
    map.set(k, cur);
  }
  return Object.fromEntries(map);
}

function monthGridCells(viewYear: number, viewMonth: number): ({ key: string; day: number } | null)[] {
  const first = new Date(viewYear, viewMonth, 1);
  const last = new Date(viewYear, viewMonth + 1, 0);
  const startPad = first.getDay();
  const days = last.getDate();
  const cells: ({ key: string; day: number } | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= days; d++) {
    const key = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ key, day: d });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function fmtUsd(v: number) {
  const s = Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `${v < 0 ? "-" : "+"}$${s}`;
}

/** Unsigned dollar amount, no leading + (for cost / gross figures). */
function fmtPlain(v: number) {
  return `$${Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function netColor(v: number) {
  return v > 0 ? "var(--profit)" : v < 0 ? "var(--loss)" : "var(--text-primary)";
}

function prettyDay(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1)).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_MIN_H = "min-h-[48px]";
/** 7 day columns + weekly summary */
const GRID_COLS = "grid-cols-[repeat(7,minmax(0,1fr))_minmax(4rem,5rem)]";

type Props = {
  payouts: CalendarPayout[];
  costs: CalendarCost[];
  /** Total account cost across non-hidden accounts (matches sum of `costs`). */
  totalCost: number;
};

export default function PayoutCalendar({ payouts, costs, totalCost }: Props) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const dailyStats = useMemo(() => buildDailyStats(payouts, costs), [payouts, costs]);
  const cells = useMemo(() => monthGridCells(viewYear, viewMonth), [viewYear, viewMonth]);
  const weeks = useMemo(() => chunk(cells, 7), [cells]);

  const totalPayout = useMemo(() => payouts.reduce((s, p) => s + p.amount, 0), [payouts]);

  const monthPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-`;
  const monthStats = useMemo(() => {
    let payout = 0;
    let cost = 0;
    for (const [k, v] of Object.entries(dailyStats)) {
      if (!k.startsWith(monthPrefix)) continue;
      payout += v.payoutAmount;
      cost += v.costAmount;
    }
    return { payout, cost, net: payout - cost };
  }, [dailyStats, monthPrefix]);

  const selected = selectedKey ? dailyStats[selectedKey] : undefined;

  function prevMonth() {
    setSelectedKey(null);
    setViewMonth((m) => {
      if (m === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }

  function nextMonth() {
    setSelectedKey(null);
    setViewMonth((m) => {
      if (m === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }

  const label = new Date(viewYear, viewMonth, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
          Payout &amp; cost calendar
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={prevMonth}
            className="px-2 py-0.5 rounded text-xs"
            style={{ background: "var(--bg-border)", color: "var(--text-secondary)" }}
            aria-label="Previous month"
          >
            ‹
          </button>
          <span className="text-xs font-medium min-w-[128px] text-center" style={{ color: "var(--text-primary)" }}>
            {label}
          </span>
          <button
            type="button"
            onClick={nextMonth}
            className="px-2 py-0.5 rounded text-xs"
            style={{ background: "var(--bg-border)", color: "var(--text-secondary)" }}
            aria-label="Next month"
          >
            ›
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-2 text-xs" style={{ color: "var(--text-muted)" }}>
        <span>
          This month payout:{" "}
          <span className="font-semibold tabular-nums" style={{ color: monthStats.payout > 0 ? "var(--profit)" : "var(--text-primary)" }}>
            {fmtUsd(monthStats.payout)}
          </span>
        </span>
        <span>
          This month cost:{" "}
          <span className="font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
            {fmtPlain(monthStats.cost)}
          </span>
        </span>
        <span>
          This month net:{" "}
          <span className="font-semibold tabular-nums" style={{ color: netColor(monthStats.net) }}>
            {fmtUsd(monthStats.net)}
          </span>
        </span>
        <span className="ml-auto">
          All-time net:{" "}
          <span className="font-semibold tabular-nums" style={{ color: netColor(totalPayout - totalCost) }}>
            {fmtUsd(totalPayout - totalCost)}
          </span>
        </span>
      </div>

      <div className={`grid ${GRID_COLS} gap-1 mb-0.5`}>
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-[10px] uppercase tracking-wide py-0.5 px-1 font-medium text-left" style={{ color: "var(--text-muted)" }}>
            {w}
          </div>
        ))}
        <div className="text-[10px] uppercase tracking-wide py-0.5 px-1 font-medium text-right" style={{ color: "var(--text-muted)" }}>
          Week
        </div>
      </div>

      <div className="flex flex-col gap-1">
        {weeks.map((week, wi) => {
          let weekPayout = 0;
          let weekCost = 0;
          let weekEntries = 0;
          for (const cell of week) {
            if (!cell) continue;
            const s = dailyStats[cell.key];
            if (s) {
              weekPayout += s.payoutAmount;
              weekCost += s.costAmount;
              weekEntries += s.payoutCount + s.costCount;
            }
          }
          const weekNet = weekPayout - weekCost;

          return (
            <div key={`week-${wi}`} className={`grid ${GRID_COLS} gap-1 text-center`}>
              {week.map((cell, i) => {
                if (!cell) {
                  return <div key={`empty-${wi}-${i}`} className={`${DAY_MIN_H} rounded-md`} />;
                }
                const stat = dailyStats[cell.key];
                const hasPayout = !!stat && stat.payoutCount > 0;
                const hasCost = !!stat && stat.costCount > 0;
                const has = hasPayout || hasCost;
                const net = stat ? stat.payoutAmount - stat.costAmount : 0;
                const isSelected = selectedKey === cell.key;
                const bg = !has
                  ? "transparent"
                  : net >= 0
                    ? "rgba(34, 197, 94, 0.12)"
                    : "rgba(239, 68, 68, 0.12)";
                const border = isSelected
                  ? "1px solid var(--accent)"
                  : !has
                    ? "1px solid transparent"
                    : `1px solid ${net >= 0 ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)"}`;

                return (
                  <div
                    key={cell.key}
                    role="button"
                    tabIndex={0}
                    className={`${DAY_MIN_H} rounded flex flex-col px-1 py-0.5 leading-none transition-opacity cursor-pointer hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40`}
                    style={{ background: bg, border }}
                    onClick={() => setSelectedKey((k) => (k === cell.key ? null : cell.key))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedKey((k) => (k === cell.key ? null : cell.key));
                      }
                    }}
                    title={
                      has
                        ? `${cell.key} · net ${fmtUsd(net)}${hasPayout ? ` · payout ${fmtUsd(stat!.payoutAmount)}` : ""}${hasCost ? ` · cost ${fmtPlain(stat!.costAmount)}` : ""}`
                        : `${cell.key} · no payouts or cost`
                    }
                  >
                    <span className="text-[10px] self-start" style={{ color: "var(--text-muted)" }}>
                      {cell.day}
                    </span>
                    <span className="flex-1 flex flex-col items-end justify-center gap-px pr-0.5">
                      {hasPayout && (
                        <span className="text-[11px] font-semibold tabular-nums" style={{ color: "var(--profit)" }}>
                          {fmtUsd(stat!.payoutAmount)}
                        </span>
                      )}
                      {hasCost && (
                        <span className="text-[10px] font-medium tabular-nums" style={{ color: "var(--loss)" }}>
                          −{fmtPlain(stat!.costAmount)}
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}

              <div
                className={`${DAY_MIN_H} rounded flex flex-col items-end justify-center px-1 py-0.5 leading-none`}
                style={{ background: "var(--bg-base)", border: "1px solid var(--bg-border)" }}
              >
                {weekEntries > 0 ? (
                  <span className="text-[11px] font-semibold tabular-nums" style={{ color: netColor(weekNet) }}>
                    {fmtUsd(weekNet)}
                  </span>
                ) : (
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                    —
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Daily summary — details for the selected day */}
      <div
        className="mt-3 rounded-md p-3"
        style={{ background: "var(--bg-base)", border: "1px solid var(--bg-border)" }}
      >
        {!selectedKey ? (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Select a day to see its payout and cost breakdown.
          </p>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                {prettyDay(selectedKey)}
              </h3>
              <div className="flex items-center gap-3 text-xs tabular-nums">
                <span style={{ color: "var(--text-muted)" }}>
                  Payout{" "}
                  <span className="font-semibold" style={{ color: "var(--profit)" }}>
                    {fmtUsd(selected?.payoutAmount ?? 0)}
                  </span>
                </span>
                <span style={{ color: "var(--text-muted)" }}>
                  Cost{" "}
                  <span className="font-semibold" style={{ color: "var(--loss)" }}>
                    {fmtPlain(selected?.costAmount ?? 0)}
                  </span>
                </span>
                <span style={{ color: "var(--text-muted)" }}>
                  Net{" "}
                  <span className="font-semibold" style={{ color: netColor((selected?.payoutAmount ?? 0) - (selected?.costAmount ?? 0)) }}>
                    {fmtUsd((selected?.payoutAmount ?? 0) - (selected?.costAmount ?? 0))}
                  </span>
                </span>
              </div>
            </div>
            {!selected || (selected.payouts.length === 0 && selected.costs.length === 0) ? (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                No payouts or cost recorded on this day.
              </p>
            ) : (
              <ul className="text-xs space-y-1">
                {selected.payouts.map((p) => (
                  <li key={`p-${p.id}`} className="flex items-center justify-between gap-3">
                    <span style={{ color: "var(--text-secondary)" }}>
                      {p.accountLabel}
                      {p.note ? <span style={{ color: "var(--text-muted)" }}> — {p.note}</span> : null}
                    </span>
                    <span className="tabular-nums font-medium" style={{ color: "var(--profit)" }}>
                      {fmtUsd(p.amount)}
                    </span>
                  </li>
                ))}
                {selected.costs.map((c) => (
                  <li key={`c-${c.id}`} className="flex items-center justify-between gap-3">
                    <span style={{ color: "var(--text-secondary)" }}>
                      {c.accountLabel}
                      <span style={{ color: "var(--text-muted)" }}> — account cost</span>
                    </span>
                    <span className="tabular-nums font-medium" style={{ color: "var(--loss)" }}>
                      −{fmtPlain(c.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <p className="text-[11px] mt-2" style={{ color: "var(--text-muted)" }}>
        Payouts by received date; account cost is placed on the account&apos;s creation day (it has no transaction date).
        Across all accounts except those hidden from stats. Add payouts on the Accounts page.
      </p>
    </div>
  );
}
