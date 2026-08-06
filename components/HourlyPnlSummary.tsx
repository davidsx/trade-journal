"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
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

export interface HourlyTradeRow {
  id: string;
  contractName: string;
  direction: string;
  entryTime: string; // ISO
  netPnl: number;
  holdingMins: number;
}

interface Props {
  hourly: HourlyBucket[];
  title?: string;
  /** Individual trades, used to drill down into a clicked hour (grouped by HKT entry hour). */
  trades?: HourlyTradeRow[];
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

function fmtTimeHkt(iso: string) {
  const d = new Date(new Date(iso).getTime() + HKT_OFFSET_MS);
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${hh}:${mm}`;
}

function fmtHold(mins: number) {
  return mins < 60 ? `${mins.toFixed(0)}m` : `${(mins / 60).toFixed(1)}h`;
}

export default function HourlyPnlSummary({ hourly, title = "Hourly P&L (HKT, entry)", trades }: Props) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const liveHour = useMemo(() => (now ? hktHour(now) : null), [now]);

  const [openHour, setOpenHour] = useState<number | null>(null);

  // Trades grouped by HKT entry hour, newest first within each hour.
  const tradesByHour = useMemo(() => {
    const m = new Map<number, HourlyTradeRow[]>();
    for (const t of trades ?? []) {
      const h = hktHour(new Date(t.entryTime));
      const arr = m.get(h);
      if (arr) arr.push(t);
      else m.set(h, [t]);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => +new Date(b.entryTime) - +new Date(a.entryTime));
    }
    return m;
  }, [trades]);

  const canExpand = (trades?.length ?? 0) > 0;

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

  // Bottom 3 hours by total P&L (only losing ones qualify) → hour → rank 1..3 (1 = worst).
  const worstRankByHour = useMemo(() => {
    const m = new Map<number, number>();
    active
      .filter((b) => b.totalPnl < 0)
      .sort((a, b) => a.totalPnl - b.totalPnl)
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
        {canExpand && <span className="ml-1">Click an hour to see its trades.</span>}
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
                {["Hour", "Session", "Trades", "Win %", "Total P&L", "P&L", "P&L / trade", "PF", "Best", "Worst"].map((h) => (
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
                const worstRank = worstRankByHour.get(b.hour);
                const expandable = canExpand && !empty;
                const isOpen = openHour === b.hour;
                const hourTrades = isOpen ? tradesByHour.get(b.hour) ?? [] : [];
                return (
                  <Fragment key={b.hour}>
                  <tr
                    onClick={expandable ? () => setOpenHour((h) => (h === b.hour ? null : b.hour)) : undefined}
                    style={{
                      borderBottom: "1px solid var(--bg-border)",
                      background: isOpen
                        ? "color-mix(in srgb, var(--accent) 8%, transparent)"
                        : isLive
                        ? "color-mix(in srgb, var(--accent) 10%, transparent)"
                        : undefined,
                      opacity: empty ? 0.45 : 1,
                      cursor: expandable ? "pointer" : undefined,
                    }}
                  >
                    <td className="py-1.5 pr-2 font-mono tabular-nums whitespace-nowrap">
                      <span className="flex items-center gap-1.5">
                        {expandable && (
                          <span
                            aria-hidden
                            className="inline-block text-[10px] transition-transform"
                            style={{ color: "var(--text-muted)", transform: isOpen ? "rotate(90deg)" : "none" }}
                          >
                            ▶
                          </span>
                        )}
                        {b.hourLabel}
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
                        {worstRank !== undefined && (
                          <span
                            className="inline-flex items-center gap-0.5 text-xs font-bold leading-none"
                            style={{ color: "var(--loss)" }}
                            title={`#${worstRank} worst hour by total P&L`}
                          >
                            <span aria-hidden>⚠</span>
                            {worstRank}
                          </span>
                        )}
                        {isLive && <LivePill size="sm" />}
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
                  {isOpen && (
                    <tr style={{ borderBottom: "1px solid var(--bg-border)" }}>
                      <td colSpan={10} className="px-3 pb-3 pt-1">
                        <div
                          className="rounded-md overflow-hidden"
                          style={{ border: "1px solid var(--bg-border)", background: "var(--bg-base)" }}
                        >
                          <table className="w-full text-xs">
                            <thead>
                              <tr style={{ borderBottom: "1px solid var(--bg-border)" }}>
                                {["Contract", "Dir", "Entry (HKT)", "Hold", "Net P&L", ""].map((h) => (
                                  <th
                                    key={h}
                                    className={`px-3 py-1.5 uppercase tracking-wide ${
                                      h === "Net P&L" ? "text-right" : "text-left"
                                    }`}
                                    style={{ color: "var(--text-muted)" }}
                                  >
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {hourTrades.map((t) => (
                                <tr key={t.id} style={{ borderBottom: "1px solid var(--bg-border)" }}>
                                  <td className="px-3 py-1.5 font-medium">{t.contractName}</td>
                                  <td
                                    className="px-3 py-1.5"
                                    style={{ color: t.direction === "Long" ? "var(--profit)" : "var(--loss)" }}
                                  >
                                    {t.direction}
                                  </td>
                                  <td className="px-3 py-1.5 tabular-nums" style={{ color: "var(--text-secondary)" }}>
                                    {fmtTimeHkt(t.entryTime)}
                                  </td>
                                  <td className="px-3 py-1.5 tabular-nums" style={{ color: "var(--text-secondary)" }}>
                                    {fmtHold(t.holdingMins)}
                                  </td>
                                  <td
                                    className="px-3 py-1.5 text-right tabular-nums font-medium"
                                    style={{ color: t.netPnl >= 0 ? "var(--profit)" : "var(--loss)" }}
                                  >
                                    {fmtUsd(t.netPnl)}
                                  </td>
                                  <td className="px-3 py-1.5 text-right">
                                    <Link
                                      href={`/trades/${t.id}`}
                                      className="font-medium hover:underline"
                                      style={{ color: "var(--accent)" }}
                                    >
                                      Details →
                                    </Link>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
