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

function pnlToColor(totalPnl: number, maxAbsPnl: number, count: number): string {
  if (count < 2 || maxAbsPnl === 0) return "#2a2a2a";
  const ratio = Math.min(1, Math.abs(totalPnl) / maxAbsPnl);
  // Low ratio → dim (lightness ~18%), high ratio → vivid (lightness ~36%)
  const lightness = 18 + ratio * 18;
  const saturation = 55 + ratio * 25;
  return totalPnl >= 0
    ? `hsl(120, ${saturation}%, ${lightness}%)`
    : `hsl(0, ${saturation}%, ${lightness}%)`;
}

function fmtUsd(v: number) {
  return `${v >= 0 ? "+" : "-"}$${Math.abs(v).toFixed(0)}`;
}

export default function TimeHeatmap({ timeOfDay, dayOfWeek }: Props) {
  const [tooltip, setTooltip] = useState<TooltipState>({
    x: 0, y: 0, content: "", visible: false,
  });

  const show = (x: number, y: number, content: string) =>
    setTooltip({ x, y, content, visible: true });
  const hide = () => setTooltip((t) => ({ ...t, visible: false }));
  const move = (x: number, y: number) =>
    setTooltip((t) => (t.visible ? { ...t, x, y } : t));

  // Normalise total P&L per section so colours are relative within each section
  const todTotals = timeOfDay.map((b) => b.avgPnl * b.tradeCount);
  const todMax = Math.max(...todTotals.map(Math.abs), 1);

  const dowTotals = dayOfWeek.map((b) => b.avgPnl * b.tradeCount);
  const dowMax = Math.max(...dowTotals.map(Math.abs), 1);

  return (
    <div className="space-y-6">
      {/* Time of Day heatmap */}
      <div>
        <h3 className="text-sm font-medium mb-3" style={{ color: "var(--text-secondary)" }}>
          Time of Day (UTC hours)
        </h3>
        <div className="flex flex-wrap gap-1">
          {timeOfDay.map((b, i) => {
            const totalPnl = b.avgPnl * b.tradeCount;
            return (
              <div
                key={b.hourLabel}
                className="relative rounded cursor-default"
                style={{
                  width: 36,
                  height: 36,
                  background: pnlToColor(totalPnl, todMax, b.tradeCount),
                  border: "1px solid #1a1a1a",
                }}
                onMouseEnter={(e) =>
                  show(e.clientX, e.clientY,
                    `${b.hourLabel} UTC\n${b.tradeCount} trades\nWin rate: ${(b.winRate * 100).toFixed(0)}%\nTotal P&L: ${fmtUsd(totalPnl)}\nAvg P&L: ${fmtUsd(b.avgPnl)}`)
                }
                onMouseMove={(e) => move(e.clientX, e.clientY)}
                onMouseLeave={hide}
              >
                <span
                  className="absolute inset-0 flex items-center justify-center text-xs font-mono"
                  style={{ color: b.tradeCount >= 2 ? "#e5e5e5" : "#6b7280" }}
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
          Day of Week
        </h3>
        <div className="flex gap-2">
          {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map((day) => {
            const b = dayOfWeek.find((d) => d.dayName === day);
            if (!b) return (
              <div
                key={day}
                className="flex-1 rounded p-3 text-center"
                style={{ background: "#2a2a2a" }}
              >
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>{day.slice(0, 3)}</div>
                <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>—</div>
              </div>
            );
            const totalPnl = b.avgPnl * b.tradeCount;
            return (
              <div
                key={day}
                className="flex-1 rounded p-3 text-center cursor-default"
                style={{ background: pnlToColor(totalPnl, dowMax, b.tradeCount) }}
                onMouseEnter={(e) =>
                  show(e.clientX, e.clientY,
                    `${b.dayName}\n${b.tradeCount} trades\nWin rate: ${(b.winRate * 100).toFixed(0)}%\nTotal P&L: ${fmtUsd(totalPnl)}\nAvg P&L: ${fmtUsd(b.avgPnl)}`)
                }
                onMouseMove={(e) => move(e.clientX, e.clientY)}
                onMouseLeave={hide}
              >
                <div className="text-xs font-medium" style={{ color: "#e5e5e5" }}>{day.slice(0, 3)}</div>
                <div className="text-xs mt-1 tabular-nums" style={{ color: "#d1d5db" }}>
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

      {/* Tooltip — always in the DOM, visibility toggled to avoid layout shifts */}
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
