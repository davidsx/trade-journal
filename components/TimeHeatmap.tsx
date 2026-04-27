"use client";

import { useEffect, useMemo, useState } from "react";
import {
  TRADING_DAY_QUARTER_HOUR_SLOT_COUNT,
  getEntrySessionName,
  sessionFromHktWallClock,
  type SessionName,
} from "@/lib/analytics/patterns";
import { tradingDayWeekdayIndexHkt } from "@/lib/tradingDay";
import LivePill from "@/components/LivePill";
import RefreshLiveTimeButton from "@/components/RefreshLiveTimeButton";

const QUARTER_MINUTES = [0, 15, 30, 45] as const;
const QUARTER_ROW_LABELS = [":00", ":15", ":30", ":45"] as const;

interface TimeOfDayBucket {
  hourLabel: string;
  hour: number;
  minute: number;
  slotIndex: number;
  winRate: number;
  avgPnl: number;
  tradeCount: number;
}

interface DayOfWeekBucket {
  dayName: string;
  dayIndex: number;
  winRate: number;
  avgPnl: number;
  tradeCount: number;
}

interface Props {
  timeOfDay: TimeOfDayBucket[];
  dayOfWeek: DayOfWeekBucket[];
}

interface TooltipState {
  x: number;
  y: number;
  content: string;
  visible: boolean;
}

/** Day-of-week cells: P&L strength on border (unchanged from before). */
function pnlToBorderColor(totalPnl: number, maxAbsPnl: number, count: number): string {
  if (count < 2 || maxAbsPnl === 0) return "#3a3a3a";
  const ratio = Math.min(1, Math.abs(totalPnl) / maxAbsPnl);
  const lightness = 36 + ratio * 24;
  const saturation = 52 + ratio * 26;
  return totalPnl >= 0
    ? `hsl(120, ${saturation}%, ${lightness}%)`
    : `hsl(0, ${saturation}%, ${lightness}%)`;
}

function borderWidthPx(count: number, maxAbsPnl: number): number {
  return count >= 2 && maxAbsPnl > 0 ? 4 : 1;
}

/**
 * Heatmap fill from total P&L (diverging). Empty buckets stay neutral.
 */
function heatmapCellStyle(
  totalPnl: number,
  maxAbs: number,
  tradeCount: number,
): { background: string; color: string; border: string } {
  if (tradeCount === 0) {
    return {
      background: "color-mix(in srgb, var(--bg-border) 70%, var(--bg-card))",
      color: "var(--text-muted)",
      border: "1px solid var(--bg-border)",
    };
  }
  const m = maxAbs > 0 ? maxAbs : 1;
  const t = totalPnl / m;
  const a = Math.min(1, Math.abs(t));
  if (t >= 0) {
    const l = 26 + a * 16;
    return {
      background: `hsl(145, 48%, ${l}%)`,
      color: a > 0.4 ? "rgba(255,255,255,0.95)" : "var(--text-primary)",
      border: "1px solid color-mix(in srgb, hsl(145, 40%, 18%) 55%, var(--bg-border))",
    };
  }
  const l = 28 + a * 14;
  return {
    background: `hsl(0, 48%, ${l}%)`,
    color: a > 0.4 ? "rgba(255,255,255,0.95)" : "var(--text-primary)",
    border: "1px solid color-mix(in srgb, hsl(0, 40%, 20%) 55%, var(--bg-border))",
  };
}

function fmtUsd(v: number) {
  return `${v >= 0 ? "+" : "-"}$${Math.abs(v).toFixed(0)}`;
}

const HKT_OFFSET_MS = 8 * 60 * 60 * 1000;

/** HKT wall clock (same convention as `lib/analytics/patterns.ts`). */
function hktWallClock(d: Date): { h: number; m: number } {
  const t = new Date(d.getTime() + HKT_OFFSET_MS);
  return { h: t.getUTCHours(), m: t.getUTCMinutes() };
}

function quarterRowIndex(minute: number): number {
  if (minute < 15) return 0;
  if (minute < 30) return 1;
  if (minute < 45) return 2;
  return 3;
}

/** Chart session strip (column = clock hour; session from mid-hour to match boundary hours). */
function sessionColumnMeta(s: SessionName): { bg: string; fg: string; abbr: string; title: string } {
  switch (s) {
    case "Asia":
      return {
        bg: "color-mix(in srgb, #8b5cf6 22%, var(--bg-card))",
        fg: "#c4b5fd",
        abbr: "A",
        title: "Asia · 08:00–16:00 HKT (chart session)",
      };
    case "London":
      return {
        bg: "color-mix(in srgb, #3b82f6 20%, var(--bg-card))",
        fg: "#93c5fd",
        abbr: "L",
        title: "London · 16:00–21:30 HKT",
      };
    case "NY":
      return {
        bg: "color-mix(in srgb, #22c55e 18%, var(--bg-card))",
        fg: "#86efac",
        abbr: "N",
        title: "NY · 21:30–05:00 HKT",
      };
    default:
      return {
        bg: "color-mix(in srgb, #6b7280 24%, var(--bg-card))",
        fg: "#d1d5db",
        abbr: "O",
        title: "Off-hours · 05:00–08:00 HKT",
      };
  }
}

export default function TimeHeatmap({ timeOfDay, dayOfWeek }: Props) {
  const [tooltip, setTooltip] = useState<TooltipState>({
    x: 0,
    y: 0,
    content: "",
    visible: false,
  });

  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const show = (x: number, y: number, content: string) =>
    setTooltip({ x, y, content, visible: true });
  const hide = () => setTooltip((t) => ({ ...t, visible: false }));
  const move = (x: number, y: number) =>
    setTooltip((t) => (t.visible ? { ...t, x, y } : t));

  const todTotals = timeOfDay.map((b) => b.avgPnl * b.tradeCount);
  const todMax = Math.max(...todTotals.map(Math.abs), 1);

  const quarterRows = QUARTER_MINUTES.map((m) => timeOfDay.filter((b) => b.minute === m));
  const columnCount = quarterRows[0]?.length ?? 0;
  const quarterRowsAligned =
    columnCount > 0 && quarterRows.every((r) => r.length === columnCount);

  const nowHkt = useMemo(() => {
    if (!now || !quarterRowsAligned) return null;
    const { h, m } = hktWallClock(now);
    const col = quarterRows[0]!.findIndex((b) => b.hour === h);
    if (col < 0) return null;
    const row = quarterRowIndex(m);
    const mq = m < 15 ? 0 : m < 30 ? 15 : m < 45 ? 30 : 45;
    return {
      col,
      row,
      h,
      m,
      label: `${String(h).padStart(2, "0")}:${String(mq).padStart(2, "0")}`,
      cmeDow: tradingDayWeekdayIndexHkt(now),
    };
  }, [now, quarterRowsAligned, timeOfDay]);

  const liveSession = useMemo(() => (now ? getEntrySessionName(now) : null), [now]);

  const dowTotals = dayOfWeek.map((b) => b.avgPnl * b.tradeCount);
  const dowMax = Math.max(...dowTotals.map(Math.abs), 1);

  return (
    <div className="space-y-6">
      {/* Time of day: heatmap grid */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
            Time of Day — P&L heatmap (HKT, entry)
          </h3>
          <RefreshLiveTimeButton onClick={() => setNow(new Date())} />
        </div>
        <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
          15-minute buckets, CME day order 06:00–05:45 HKT. Color = total P&amp;L (green / red, intensity vs max bucket). Top
          row: A/L/N/O = chart session. <LivePill size="sm" /> = current 15m window. Hover a cell for stats.
        </p>

        {quarterRowsAligned ? (
          <>
            <div className="overflow-x-auto w-full -mx-0.5 px-0.5 rounded-lg" style={{ WebkitOverflowScrolling: "touch" }}>
              <table
                className="border-collapse w-max"
                style={{ tableLayout: "fixed", borderSpacing: 0 }}
              >
                <thead>
                  <tr>
                    <th
                      rowSpan={2}
                      className="sticky left-0 z-20 w-9 align-middle px-1 py-1 text-center text-[9px] font-normal leading-tight"
                      style={{
                        background: "var(--bg-card)",
                        borderBottom: "1px solid var(--bg-border)",
                        borderRight: "1px solid var(--bg-border)",
                        minWidth: 36,
                        color: "var(--text-muted)",
                      }}
                    >
                      <div className="flex flex-col gap-0.5">
                        <span style={{ color: "var(--text-secondary)" }}>Session</span>
                        <span>·</span>
                        <span>hr</span>
                      </div>
                    </th>
                    {quarterRows[0]!.map((b00) => {
                      const colSes = sessionFromHktWallClock(b00.hour, 30);
                      const meta = sessionColumnMeta(colSes);
                      return (
                        <th
                          key={`ses-${b00.slotIndex}`}
                          className="px-0.5 py-0.5 text-center font-mono text-[9px] font-semibold leading-none"
                          style={{
                            minWidth: 30,
                            width: 30,
                            color: meta.fg,
                            background: meta.bg,
                            borderBottom: "1px solid var(--bg-border)",
                          }}
                          title={meta.title}
                        >
                          {meta.abbr}
                        </th>
                      );
                    })}
                  </tr>
                  <tr>
                    {quarterRows[0]!.map((b00, c) => {
                      const isNowCol = nowHkt !== null && c === nowHkt.col;
                      return (
                        <th
                          key={b00.slotIndex}
                          className="px-0.5 py-1 text-center font-mono text-[10px] font-medium tabular-nums"
                          style={{
                            minWidth: 30,
                            width: 30,
                            color: "var(--text-secondary)",
                            borderBottom: "1px solid var(--bg-border)",
                            background: "var(--bg-card)",
                          }}
                          title={isNowCol ? "This hour (HKT) contains the current 15m bucket" : undefined}
                        >
                          {String(b00.hour).padStart(2, "0")}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {quarterRows.map((row, ri) => {
                    const isNowRow = nowHkt !== null && ri === nowHkt.row;
                    return (
                      <tr key={QUARTER_MINUTES[ri]}>
                        <th
                          scope="row"
                          className="sticky left-0 z-10 py-0 pr-1.5 text-right align-middle text-[10px] font-mono font-normal"
                          style={{
                            background: "var(--bg-card)",
                            borderRight: "1px solid var(--bg-border)",
                            color: "var(--text-muted)",
                            minWidth: 36,
                            width: 36,
                          }}
                          title={isNowRow ? "This quarter row (HKT) contains the current 15m bucket" : undefined}
                        >
                          {QUARTER_ROW_LABELS[ri]}
                        </th>
                        {row.map((b, c) => {
                          const totalPnl = b.avgPnl * b.tradeCount;
                          const s = heatmapCellStyle(totalPnl, todMax, b.tradeCount);
                          const isNowCell = nowHkt !== null && c === nowHkt.col && ri === nowHkt.row;
                          return (
                            <td
                              key={b.slotIndex}
                              className="p-0 align-stretch"
                              style={{
                                minWidth: 30,
                                width: 30,
                                position: "relative",
                                verticalAlign: "top",
                              }}
                              onMouseEnter={(e) =>
                                show(
                                  e.clientX,
                                  e.clientY,
                                  `${b.hourLabel} HKT (entry, bucket start)\n${b.tradeCount} trades\nWin rate: ${(b.winRate * 100).toFixed(0)}%\nTotal P&L: ${fmtUsd(totalPnl)}\nAvg P&L: ${fmtUsd(b.avgPnl)}`
                                )
                              }
                              onMouseMove={(e) => move(e.clientX, e.clientY)}
                              onMouseLeave={hide}
                            >
                              <div className="relative min-h-7 w-full">
                                <div
                                  className="min-h-7 w-full cursor-default"
                                  style={{
                                    background: s.background,
                                    border: s.border,
                                    boxSizing: "border-box",
                                  }}
                                  aria-label={`${b.hourLabel} HKT, ${b.tradeCount} trades, total P&L ${fmtUsd(totalPnl)}${isNowCell ? " — live (HKT)" : ""}`}
                                />
                                {isNowCell && (
                                  <div
                                    className="pointer-events-none absolute right-1 top-1 z-[1] leading-none"
                                    aria-hidden
                                  >
                                    <LivePill size="sm" />
                                  </div>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div
              className="mt-3 flex flex-wrap items-center gap-2 text-[11px]"
              style={{ color: "var(--text-muted)" }}
            >
              <span>Total P&amp;L</span>
              <div
                className="h-2.5 min-w-40 max-w-64 flex-1 rounded-sm"
                style={{
                  background:
                    "linear-gradient(90deg, hsl(0, 50%, 30%) 0%, color-mix(in srgb, var(--bg-border) 85%, var(--bg-card)) 50%, hsl(145, 50%, 30%) 100%)",
                }}
                title="Losses (left) → profit (right)"
              />
              <span className="font-mono tabular-nums">
                {fmtUsd(-todMax)} · 0 · +{fmtUsd(todMax)}
              </span>
            </div>
            <p className="mt-1.5 text-[10px]" style={{ color: "var(--text-muted)" }}>
              {TRADING_DAY_QUARTER_HOUR_SLOT_COUNT} buckets. Grey = no trades in that quarter-hour.
              {now && (nowHkt || liveSession) && (
                <span className="ml-2 font-mono tabular-nums" style={{ color: "var(--accent)" }}>
                  {nowHkt && <>Live (HKT): {nowHkt.label}</>}
                  {liveSession && (
                    <span className={nowHkt ? "ml-2 opacity-90" : ""}>· {liveSession}</span>
                  )}
                </span>
              )}
            </p>
          </>
        ) : (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Time pattern data is unavailable.
          </p>
        )}
      </div>

      {/* Day of Week */}
      <div>
        <h3 className="text-sm font-medium mb-3" style={{ color: "var(--text-secondary)" }}>
          Day of Week (CME trading day, HKT — from exit)
        </h3>
        <div className="flex gap-2">
          {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day, dayIndex) => {
            const b = dayOfWeek.find((d) => d.dayName === day);
            const isCmeToday = nowHkt !== null && nowHkt.cmeDow === dayIndex;
            if (!b)
              return (
                <div
                  key={day}
                  className="relative flex-1 rounded p-3 text-center box-border"
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--bg-border)",
                  }}
                  title={isCmeToday ? "Current CME trading-day weekday (HKT)" : undefined}
                >
                  {isCmeToday && (
                    <div className="absolute right-1 top-1 leading-none" aria-label="Current CME trading day (HKT)">
                      <LivePill size="sm" />
                    </div>
                  )}
                  <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {day.slice(0, 3)}
                  </div>
                  <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    —
                  </div>
                </div>
              );
            const totalPnl = b.avgPnl * b.tradeCount;
            const bw = borderWidthPx(b.tradeCount, dowMax);
            const bc = pnlToBorderColor(totalPnl, dowMax, b.tradeCount);
            return (
              <div
                key={day}
                className="relative flex-1 rounded p-3 text-center cursor-default box-border"
                style={{
                  background: "var(--bg-card)",
                  border: `${bw}px solid ${bc}`,
                }}
                title={isCmeToday ? "Current CME trading-day weekday (HKT)" : undefined}
                onMouseEnter={(e) =>
                  show(
                    e.clientX,
                    e.clientY,
                    `${b.dayName}\n${b.tradeCount} trades\nWin rate: ${(b.winRate * 100).toFixed(0)}%\nTotal P&L: ${fmtUsd(totalPnl)}\nAvg P&L: ${fmtUsd(b.avgPnl)}`
                  )
                }
                onMouseMove={(e) => move(e.clientX, e.clientY)}
                onMouseLeave={hide}
              >
                {isCmeToday && (
                    <div className="absolute right-1 top-1 leading-none" aria-label="Current CME trading day (HKT)">
                      <LivePill size="sm" />
                    </div>
                )}
                <div className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                  {day.slice(0, 3)}
                </div>
                <div className="text-xs mt-1 tabular-nums" style={{ color: "var(--text-secondary)" }}>
                  {(b.winRate * 100).toFixed(0)}%
                </div>
                <div className="text-xs" style={{ color: totalPnl >= 0 ? "var(--profit)" : "var(--loss)" }}>
                  {fmtUsd(totalPnl)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div
        className="fixed z-50 text-xs rounded-md px-3 py-2 pointer-events-none whitespace-pre"
        style={{
          left: tooltip.x + 14,
          top: tooltip.y - 8,
          background: "#1a1a1a",
          border: "1px solid #2a2a2a",
          color: "var(--text-primary)",
          lineHeight: 1.7,
          opacity: tooltip.visible ? 1 : 0,
          visibility: tooltip.visible ? "visible" : "hidden",
          transition: "opacity 0.1s",
        }}
      >
        {tooltip.content}
      </div>
    </div>
  );
}
