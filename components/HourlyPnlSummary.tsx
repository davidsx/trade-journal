"use client";

import { useEffect, useMemo, useState } from "react";
import type { SessionName } from "@/lib/analytics/patterns";
import LivePill from "@/components/LivePill";

interface HourlyBucket {
  hourLabel: string;
  hour: number;
  slotIndex: number;
  session: SessionName;
  tradeCount: number;
  winRate: number;
  avgPnl: number;
  totalPnl: number;
  profitFactor: number;
  bestTrade: number;
  worstTrade: number;
}

interface Props {
  hourly: HourlyBucket[];
  title?: string;
}

const HKT_OFFSET_MS = 8 * 60 * 60 * 1000;

function hktHour(d: Date): number {
  return new Date(d.getTime() + HKT_OFFSET_MS).getUTCHours();
}

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

export default function HourlyPnlSummary({ hourly, title = "Hourly P&L (HKT, entry)" }: Props) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const liveHour = useMemo(() => (now ? hktHour(now) : null), [now]);

  const active = hourly.filter((b) => b.tradeCount > 0);
  const maxAbs = Math.max(...hourly.map((b) => Math.abs(b.totalPnl)), 1);
  const totalPnl = hourly.reduce((s, b) => s + b.totalPnl, 0);
  const totalTrades = hourly.reduce((s, b) => s + b.tradeCount, 0);

  const best = active.reduce<HourlyBucket | null>(
    (acc, b) => (acc === null || b.totalPnl > acc.totalPnl ? b : acc),
    null
  );
  const worst = active.reduce<HourlyBucket | null>(
    (acc, b) => (acc === null || b.totalPnl < acc.totalPnl ? b : acc),
    null
  );

  // Top 3 hours by total P&L (only profitable ones qualify) → hour → rank 1..3.
  const rankByHour = useMemo(() => {
    const m = new Map<number, number>();
    active
      .filter((b) => b.totalPnl > 0)
      .sort((a, b) => b.totalPnl - a.totalPnl)
      .slice(0, 3)
      .forEach((b, i) => m.set(b.hour, i + 1));
    return m;
  }, [active]);

  const RANK_COLORS = ["#fbbf24", "#cbd5e1", "#d8a15a"]; // gold / silver / bronze

  return (
    <div
      className="rounded-lg p-5"
      style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <h2 className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
          {title}
        </h2>
        <div className="flex items-center gap-3 text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>
          <span>
            {totalTrades} trades ·{" "}
            <span style={{ color: totalPnl >= 0 ? "var(--profit)" : "var(--loss)", fontWeight: 600 }}>
              {fmtUsd(totalPnl)}
            </span>
          </span>
        </div>
      </div>
      <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
        One row per clock hour, CME day order 06:00 → 05:00 HKT. Bar length = total P&amp;L vs the biggest hour.
        {best && worst && best.hour !== worst.hour && (
          <span className="ml-1">
            Best <span style={{ color: "var(--profit)" }}>{best.hourLabel}</span> ({fmtUsd(best.totalPnl)}), worst{" "}
            <span style={{ color: "var(--loss)" }}>{worst.hourLabel}</span> ({fmtUsd(worst.totalPnl)}).
          </span>
        )}
      </p>

      {active.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          No trades yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--bg-border)" }}>
                {["Hour", "Session", "Trades", "Win %", "Total P&L", "P&L", "Avg", "PF", "Best", "Worst"].map((h) => (
                  <th
                    key={h}
                    className={`pb-2 text-xs uppercase tracking-wide ${
                      h === "Hour" || h === "Session" || h === "P&L" ? "text-left" : "text-right"
                    }`}
                    style={{ color: "var(--text-muted)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hourly.map((b) => {
                const isLive = liveHour !== null && b.hour === liveHour;
                const empty = b.tradeCount === 0;
                const ratio = Math.min(1, Math.abs(b.totalPnl) / maxAbs);
                const pos = b.totalPnl >= 0;
                const meta = sessionMeta(b.session);
                const rank = rankByHour.get(b.hour);
                return (
                  <tr
                    key={b.hour}
                    style={{
                      borderBottom: "1px solid var(--bg-border)",
                      background: isLive
                        ? "color-mix(in srgb, var(--accent) 10%, transparent)"
                        : undefined,
                      opacity: empty ? 0.45 : 1,
                    }}
                  >
                    <td className="py-1.5 pr-2 font-mono tabular-nums whitespace-nowrap">
                      <span className="flex items-center gap-1.5">
                        {b.hourLabel}
                        {isLive && <LivePill size="sm" />}
                        {rank !== undefined && (
                          <span
                            className="inline-flex items-center gap-0.5 text-xs font-bold leading-none"
                            style={{ color: RANK_COLORS[rank - 1] }}
                            title={`#${rank} best hour by total P&L`}
                          >
                            <span aria-hidden>{["🥇", "🥈", "🥉"][rank - 1]}</span>
                            {rank}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="py-1.5 pr-2">
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                        style={{ background: meta.bg, color: meta.fg }}
                      >
                        {meta.abbr}
                      </span>
                    </td>
                    <td className="py-1.5 pl-2 text-right tabular-nums" style={{ color: "var(--text-secondary)" }}>
                      {empty ? "—" : b.tradeCount}
                    </td>
                    <td
                      className="py-1.5 pl-2 text-right tabular-nums"
                      style={{ color: empty ? "var(--text-muted)" : b.winRate >= 0.5 ? "var(--profit)" : "var(--loss)" }}
                    >
                      {empty ? "—" : `${(b.winRate * 100).toFixed(0)}%`}
                    </td>
                    <td
                      className="py-1.5 pl-2 text-right tabular-nums font-medium"
                      style={{ color: empty ? "var(--text-muted)" : pos ? "var(--profit)" : "var(--loss)" }}
                    >
                      {empty ? "—" : fmtUsd(b.totalPnl)}
                    </td>
                    <td className="py-1.5 pl-3 w-40">
                      {!empty && (
                        <div className="relative h-3 w-full" title={fmtUsd(b.totalPnl)}>
                          {/* center line */}
                          <div
                            className="absolute top-0 bottom-0"
                            style={{ left: "50%", width: 1, background: "var(--bg-border)" }}
                          />
                          <div
                            className="absolute top-0 bottom-0 rounded-sm"
                            style={{
                              left: pos ? "50%" : `${50 - ratio * 50}%`,
                              width: `${ratio * 50}%`,
                              background: pos ? "var(--profit)" : "var(--loss)",
                              opacity: 0.85,
                            }}
                          />
                        </div>
                      )}
                    </td>
                    <td
                      className="py-1.5 pl-2 text-right tabular-nums"
                      style={{ color: empty ? "var(--text-muted)" : b.avgPnl >= 0 ? "var(--profit)" : "var(--loss)" }}
                    >
                      {empty ? "—" : fmtUsd(b.avgPnl)}
                    </td>
                    <td className="py-1.5 pl-2 text-right tabular-nums" style={{ color: "var(--text-secondary)" }}>
                      {empty ? "—" : b.profitFactor >= 999 ? "∞" : b.profitFactor.toFixed(2)}
                    </td>
                    <td className="py-1.5 pl-2 text-right tabular-nums" style={{ color: "var(--text-muted)" }}>
                      {empty ? "—" : fmtUsd(b.bestTrade)}
                    </td>
                    <td className="py-1.5 pl-2 text-right tabular-nums" style={{ color: "var(--text-muted)" }}>
                      {empty ? "—" : fmtUsd(b.worstTrade)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
