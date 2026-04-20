"use client";

import { useMemo, useState } from "react";
import { tradingDayKeyHkt } from "@/lib/tradingDay";

export type CalendarTradeRow = {
  exitTime: string;
  netPnl: number;
};

export type DayStat = {
  netPnl: number;
  tradeCount: number;
  winCount: number;
};

function buildDailyStats(trades: CalendarTradeRow[]): Record<string, DayStat> {
  const map = new Map<string, DayStat>();
  for (const t of trades) {
    const k = tradingDayKeyHkt(new Date(t.exitTime));
    const cur = map.get(k) ?? { netPnl: 0, tradeCount: 0, winCount: 0 };
    cur.netPnl += t.netPnl;
    cur.tradeCount += 1;
    if (t.netPnl > 0) cur.winCount += 1;
    map.set(k, cur);
  }
  return Object.fromEntries(map);
}

function winRatePct(wins: number, total: number): number {
  if (total <= 0) return 0;
  return (wins / total) * 100;
}

function fmtWinRate(wins: number, total: number): string {
  if (total <= 0) return "—";
  return `${winRatePct(wins, total).toFixed(0)}%`;
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

function fmtPnl(v: number) {
  const abs = Math.abs(v);
  const s = abs.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `${v >= 0 ? "+" : "-"}$${s}`;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DAY_MIN_H = "min-h-[84px]";

/** 7 day columns + weekly summary */
const GRID_COLS = "grid-cols-[repeat(7,minmax(0,1fr))_minmax(5.5rem,8rem)]";

type Props = {
  trades: CalendarTradeRow[];
};

export default function TradingCalendar({ trades }: Props) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const dailyStats = useMemo(() => buildDailyStats(trades), [trades]);
  const cells = useMemo(() => monthGridCells(viewYear, viewMonth), [viewYear, viewMonth]);
  const weeks = useMemo(() => chunk(cells, 7), [cells]);

  function prevMonth() {
    setViewMonth((m) => {
      if (m === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }

  function nextMonth() {
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
          Trading calendar
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

      <div className={`grid ${GRID_COLS} gap-1 text-center mb-0.5`}>
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="text-[10px] uppercase tracking-wide py-0.5 font-medium"
            style={{ color: "var(--text-muted)" }}
          >
            {w}
          </div>
        ))}
        <div
          className="text-[10px] uppercase tracking-wide py-0.5 px-0.5 font-medium"
          style={{ color: "var(--text-muted)" }}
        >
          Week
        </div>
      </div>

      <div className="flex flex-col gap-1">
        {weeks.map((week, wi) => {
          let weekPnl = 0;
          let weekTrades = 0;
          let weekWins = 0;
          for (const cell of week) {
            if (!cell) continue;
            const s = dailyStats[cell.key];
            if (s) {
              weekPnl += s.netPnl;
              weekTrades += s.tradeCount;
              weekWins += s.winCount;
            }
          }

          const firstReal = week.find((c) => c !== null);
          const lastReal = [...week].reverse().find((c) => c !== null);
          const rangeLabel =
            firstReal && lastReal
              ? `${firstReal.day}–${lastReal.day} ${label.split(" ")[0] ?? ""}`.trim()
              : `Week ${wi + 1}`;

          return (
            <div key={`week-${wi}`} className={`grid ${GRID_COLS} gap-1 text-center`}>
              {week.map((cell, i) => {
                if (!cell) {
                  return <div key={`empty-${wi}-${i}`} className={`${DAY_MIN_H} rounded-md`} />;
                }
                const stat = dailyStats[cell.key];
                const has = stat && stat.tradeCount > 0;
                const pnl = stat?.netPnl ?? 0;
                const wr = stat ? fmtWinRate(stat.winCount, stat.tradeCount) : "—";
                const bg = !has
                  ? "transparent"
                  : pnl >= 0
                    ? "rgba(34, 197, 94, 0.12)"
                    : "rgba(239, 68, 68, 0.12)";
                const border = !has
                  ? "1px solid transparent"
                  : `1px solid ${pnl >= 0 ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)"}`;

                return (
                  <div
                    key={cell.key}
                    className={`${DAY_MIN_H} rounded-md flex flex-col items-center justify-start p-1.5 gap-0.5`}
                    style={{
                      background: bg,
                      border,
                    }}
                    title={
                      has
                        ? `${cell.key}: ${stat!.tradeCount} trades, ${wr} win rate, ${fmtPnl(pnl)}`
                        : undefined
                    }
                  >
                    <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                      {cell.day}
                    </span>
                    {has && (
                      <>
                        <span
                          className="text-xs font-semibold leading-tight tabular-nums"
                          style={{ color: pnl >= 0 ? "var(--profit)" : "var(--loss)" }}
                        >
                          {fmtPnl(pnl)}
                        </span>
                        <span className="text-[10px] leading-tight" style={{ color: "var(--text-secondary)" }}>
                          {stat!.tradeCount} tr
                        </span>
                        <span className="text-[10px] leading-tight" style={{ color: "var(--text-muted)" }}>
                          {wr} WR
                        </span>
                      </>
                    )}
                  </div>
                );
              })}

              <div
                className={`${DAY_MIN_H} rounded-md flex flex-col items-center justify-start px-1.5 pb-1.5 pt-2 gap-0.5`}
                style={{
                  background: "var(--bg-base)",
                  border: "1px solid var(--bg-border)",
                }}
                title={
                  weekTrades > 0
                    ? `${rangeLabel} · ${weekTrades} trades · ${fmtWinRate(weekWins, weekTrades)} win rate`
                    : rangeLabel
                }
              >
                <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  Week {wi + 1}
                </span>
                {weekTrades > 0 ? (
                  <>
                    <span
                      className="text-xs font-semibold tabular-nums leading-tight text-center"
                      style={{ color: weekPnl >= 0 ? "var(--profit)" : "var(--loss)" }}
                    >
                      {fmtPnl(weekPnl)}
                    </span>
                    <span className="text-[10px] leading-tight" style={{ color: "var(--text-secondary)" }}>
                      {weekTrades} tr
                    </span>
                    <span className="text-[10px] leading-tight" style={{ color: "var(--text-muted)" }}>
                      {fmtWinRate(weekWins, weekTrades)} WR
                    </span>
                  </>
                ) : (
                  <span className="text-[10px] leading-tight" style={{ color: "var(--text-muted)" }}>
                    —
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] mt-2" style={{ color: "var(--text-muted)" }}>
        Daily net P&amp;L by CME trading day (HKT session date from exit). Session 06:00–05:00 HKT; 05:00–06:00 break.
        Win rate = winners / trades in that day or week row.
      </p>
    </div>
  );
}
