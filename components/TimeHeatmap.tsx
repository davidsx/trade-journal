"use client";

import { useState } from "react";

interface TimeOfDayBucket {
  hourLabel: string;
  hour: number;
  minute: number;
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

/** P&L strength → accent color for border only (background stays neutral). */
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

function fmtUsd(v: number) {
  return `${v >= 0 ? "+" : "-"}$${Math.abs(v).toFixed(0)}`;
}

export default function TimeHeatmap({ timeOfDay, dayOfWeek }: Props) {
  const [tooltip, setTooltip] = useState<TooltipState>({
    x: 0,
    y: 0,
    content: "",
    visible: false,
  });

  const show = (x: number, y: number, content: string) =>
    setTooltip({ x, y, content, visible: true });
  const hide = () => setTooltip((t) => ({ ...t, visible: false }));
  const move = (x: number, y: number) =>
    setTooltip((t) => (t.visible ? { ...t, x, y } : t));

  const todTotals = timeOfDay.map((b) => b.avgPnl * b.tradeCount);
  const todMax = Math.max(...todTotals.map(Math.abs), 1);

  const dowTotals = dayOfWeek.map((b) => b.avgPnl * b.tradeCount);
  const dowMax = Math.max(...dowTotals.map(Math.abs), 1);

  return (
    <div className="space-y-6">
      {/* Time of Day heatmap */}
      <div>
        <h3 className="text-sm font-medium mb-3" style={{ color: "var(--text-secondary)" }}>
          Time of Day (HKT, entry time)
        </h3>
        <div className="flex flex-wrap gap-1">
          {timeOfDay.map((b) => {
            const totalPnl = b.avgPnl * b.tradeCount;
            const bw = borderWidthPx(b.tradeCount, todMax);
            const bc = pnlToBorderColor(totalPnl, todMax, b.tradeCount);
            return (
              <div
                key={b.hourLabel}
                className="relative rounded cursor-default box-border"
                style={{
                  width: 36,
                  height: 36,
                  background: "var(--bg-card)",
                  border: `${bw}px solid ${bc}`,
                }}
                onMouseEnter={(e) =>
                  show(
                    e.clientX,
                    e.clientY,
                    `${b.hourLabel} HKT (entry)\n${b.tradeCount} trades\nWin rate: ${(b.winRate * 100).toFixed(0)}%\nTotal P&L: ${fmtUsd(totalPnl)}\nAvg P&L: ${fmtUsd(b.avgPnl)}`
                  )
                }
                onMouseMove={(e) => move(e.clientX, e.clientY)}
                onMouseLeave={hide}
              >
                <span
                  className="absolute inset-0 flex items-center justify-center text-xs font-mono"
                  style={{ color: b.tradeCount >= 2 ? "var(--text-primary)" : "var(--text-muted)" }}
                >
                  {b.hourLabel.slice(0, 2)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Day of Week */}
      <div>
        <h3 className="text-sm font-medium mb-3" style={{ color: "var(--text-secondary)" }}>
          Day of Week (CME trading day, HKT — from exit)
        </h3>
        <div className="flex gap-2">
          {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day) => {
            const b = dayOfWeek.find((d) => d.dayName === day);
            if (!b)
              return (
                <div
                  key={day}
                  className="flex-1 rounded p-3 text-center box-border"
                  style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)" }}
                >
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
                className="flex-1 rounded p-3 text-center cursor-default box-border"
                style={{
                  background: "var(--bg-card)",
                  border: `${bw}px solid ${bc}`,
                }}
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
