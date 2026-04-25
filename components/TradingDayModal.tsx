"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { tradingDayKeyHkt } from "@/lib/tradingDay";
import { analyzeSessionPerformanceLite } from "@/lib/analytics/patterns";
import type { CalendarDayTrade } from "@/lib/calendarDayTrade";
import SessionPerformanceGrid from "@/components/SessionPerformanceGrid";
import PnlBarChart from "@/components/PnlBarChart";
import ScoreBadge from "@/components/ScoreBadge";
import TradingDayCandleChart, { type SessionCandleMarker } from "@/components/TradingDayCandleChart";
import type { Candle } from "@/lib/analytics/loadDayCandles";

type Props = {
  open: boolean;
  onClose: () => void;
  dayKey: string;
  allTrades: CalendarDayTrade[];
};

function formatTradingDayTitle(isoYmd: string) {
  const [y, m, d] = isoYmd.split("-").map(Number);
  if (!y || !m || !d) return isoYmd;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function fmtUsd(v: number) {
  return `${v >= 0 ? "+" : "-"}$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtTimeHkt(iso: string) {
  const HKT_OFFSET_MS = 8 * 60 * 60 * 1000;
  const dt = new Date(new Date(iso).getTime() + HKT_OFFSET_MS);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[dt.getUTCMonth()]} ${dt.getUTCDate()} ${String(dt.getUTCHours()).padStart(2, "0")}:${String(
    dt.getUTCMinutes(),
  ).padStart(2, "0")} HKT`;
}

export default function TradingDayModal({ open, onClose, dayKey, allTrades }: Props) {
  const dayTrades = useMemo(() => {
    return allTrades
      .filter((t) => tradingDayKeyHkt(new Date(t.exitTime)) === dayKey)
      .sort((a, b) => +new Date(a.entryTime) - +new Date(b.entryTime));
  }, [allTrades, dayKey]);

  const sessions = useMemo(() => {
    return analyzeSessionPerformanceLite(
      dayTrades.map((t) => ({
        entryTime: new Date(t.entryTime),
        netPnl: t.netPnl,
        direction: t.direction,
        holdingMins: t.holdingMins,
      })),
    );
  }, [dayTrades]);

  const cumSeries = useMemo(() => {
    let c = 0;
    return dayTrades.map((t, i) => {
      c += t.netPnl;
      return { n: i + 1, cum: c };
    });
  }, [dayTrades]);

  const stats = useMemo(() => {
    if (dayTrades.length === 0) {
      return { total: 0, wins: 0, wr: 0, avgQ: null as number | null };
    }
    const total = dayTrades.reduce((s, t) => s + t.netPnl, 0);
    const wins = dayTrades.filter((t) => t.netPnl > 0).length;
    const wr = wins / dayTrades.length;
    const scored = dayTrades.filter((t) => t.qualityScore != null);
    const avgQ =
      scored.length > 0 ? scored.reduce((a, t) => a + (t.qualityScore ?? 0), 0) / scored.length : null;
    return { total, wins, wr, avgQ };
  }, [dayTrades]);

  const [dayCandles, setDayCandles] = useState<Candle[] | null>(null);
  const [candlesLoading, setCandlesLoading] = useState(false);
  const [candlesError, setCandlesError] = useState<string | null>(null);

  const loadSessionCandles = useCallback(async (key: string): Promise<Candle[]> => {
    const u = new URL("/api/candles/trading-day", window.location.origin);
    u.searchParams.set("day", key);
    const res = await fetch(u.toString());
    const j: unknown = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err =
        typeof j === "object" && j !== null && "error" in j && typeof (j as { error: unknown }).error === "string"
          ? (j as { error: string }).error
          : res.statusText;
      throw new Error(err);
    }
    if (typeof j === "object" && j !== null && "candles" in j && Array.isArray((j as { candles: unknown }).candles)) {
      return (j as { candles: Candle[] }).candles;
    }
    return [];
  }, []);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setCandlesError(null);
      setCandlesLoading(false);
      return;
    }
    if (!dayKey) return;
    setCandlesError(null);

    setDayCandles(null);
    let cancelled = false;

    (async () => {
      setCandlesLoading(true);
      try {
        const candles = await loadSessionCandles(dayKey);
        if (cancelled) return;
        setDayCandles(candles);
        setCandlesError(null);
      } catch (e) {
        if (cancelled) return;
        setCandlesError(e instanceof Error ? e.message : "Chart load failed");
        setDayCandles([]);
      } finally {
        if (!cancelled) setCandlesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, dayKey, loadSessionCandles]);

  const chartMarkers: SessionCandleMarker[] = useMemo(() => {
    const multi = dayTrades.length > 1;
    return dayTrades.flatMap((t, i) => {
      const d = t.direction === "Short" ? "Short" : "Long";
      const p = multi ? `${i + 1}·` : "";
      const en = Math.floor(new Date(t.entryTime).getTime() / 1000);
      const ex = Math.floor(new Date(t.exitTime).getTime() / 1000);
      return [
        {
          time: en,
          price: t.entryPrice,
          direction: d,
          type: "entry" as const,
          text: `${p}${d === "Long" ? "L" : "S"} @ ${t.entryPrice.toFixed(2)}`,
        },
        {
          time: ex,
          price: t.exitPrice,
          direction: d,
          type: "exit" as const,
          pnl: t.netPnl,
          text: `${p}X @ ${t.exitPrice.toFixed(2)}`,
        },
      ];
    });
  }, [dayTrades]);

  if (!open) return null;

  const cumLineColor = stats.total >= 0 ? "var(--profit)" : "var(--loss)";

  const pnlTrades = dayTrades.map((t) => ({
    id: t.id,
    netPnl: t.netPnl,
    contractName: t.contractName,
    entryTime: t.entryTime,
  }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative w-full max-w-3xl overflow-y-auto rounded-lg shadow-2xl"
        style={{
          maxHeight: "min(90vh, 900px)",
          background: "var(--bg-base)",
          border: "1px solid var(--bg-border)",
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="trading-day-modal-title"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-md text-sm transition-colors"
          style={{ background: "var(--bg-border)", color: "var(--text-muted)" }}
          aria-label="Close"
        >
          ✕
        </button>
        <div className="p-5 pr-12">
          <h2 id="trading-day-modal-title" className="text-lg font-semibold pr-2" style={{ color: "var(--text-primary)" }}>
            {formatTradingDayTitle(dayKey)}
          </h2>
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            CME Globex session date (HKT) · same as calendar · entries grouped by <strong>entry session</strong> below
          </p>

          <div className="mt-4 flex flex-wrap gap-4 text-sm" style={{ color: "var(--text-secondary)" }}>
            <span>
              <span style={{ color: "var(--text-muted)" }}>Trades: </span>
              <span className="font-medium tabular-nums" style={{ color: "var(--text-primary)" }}>
                {dayTrades.length}
              </span>
            </span>
            <span>
              <span style={{ color: "var(--text-muted)" }}>Net P&L: </span>
              <span
                className="font-semibold tabular-nums"
                style={{ color: stats.total >= 0 ? "var(--profit)" : "var(--loss)" }}
              >
                {fmtUsd(stats.total)}
              </span>
            </span>
            {dayTrades.length > 0 && (
              <span>
                <span style={{ color: "var(--text-muted)" }}>Win rate: </span>
                <span className="font-medium tabular-nums" style={{ color: "var(--text-primary)" }}>
                  {(stats.wr * 100).toFixed(0)}%
                </span>
              </span>
            )}
            {stats.avgQ !== null && (
              <span>
                <span style={{ color: "var(--text-muted)" }}>Avg quality: </span>
                <span className="font-medium tabular-nums" style={{ color: "var(--text-primary)" }}>
                  {stats.avgQ.toFixed(1)}
                </span>
              </span>
            )}
          </div>

          <div
            className="mt-5 rounded-lg overflow-hidden"
            style={{ border: "1px solid var(--bg-border)" }}
          >
            <div
              className="px-3 pt-2 pb-1 flex items-center justify-between"
              style={{ background: "var(--bg-card)" }}
            >
              <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                Session — 1m candles (MNQ)
              </span>
              {candlesLoading && (
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Loading…
                </span>
              )}
              {!candlesLoading && dayCandles && (
                <span className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>
                  {dayCandles.length} bars
                </span>
              )}
            </div>
            {candlesError && (
              <p className="px-3 py-2 text-xs" style={{ color: "var(--loss)" }}>
                {candlesError}
              </p>
            )}
            {!candlesLoading && dayCandles !== null && (
              <TradingDayCandleChart
                key={dayKey}
                candles={dayCandles}
                markers={chartMarkers}
                height={260}
              />
            )}
            {candlesLoading && (
              <div
                className="flex items-center justify-center text-xs"
                style={{ height: 260, background: "#111111", color: "var(--text-muted)" }}
              >
                Loading chart…
              </div>
            )}
          </div>

          {dayTrades.length === 0 ? (
            <p className="mt-6 text-sm" style={{ color: "var(--text-muted)" }}>
              No trades for this CME session date (exits on this HKT day). Choose another day, or add trades in this range.
            </p>
          ) : (
            <>
              <div
                className="mt-5 rounded-lg p-3"
                style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)" }}
              >
                <h3 className="text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
                  Cumulative P&amp;L (trade order)
                </h3>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={cumSeries} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                    <XAxis
                      dataKey="n"
                      tick={{ fill: "#6b7280", fontSize: 10 }}
                      tickLine={false}
                    />
                    <YAxis
                      width={48}
                      tick={{ fill: "#6b7280", fontSize: 10 }}
                      tickLine={false}
                      tickFormatter={(v) => `$${v}`}
                    />
                    <Tooltip
                      contentStyle={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 6 }}
                      labelStyle={{ color: "#9ca3af", fontSize: 11 }}
                      formatter={(v) =>
                        typeof v === "number" ? [fmtUsd(v), "Cumulative"] : [String(v ?? ""), "Cumulative"]
                      }
                    />
                    <Line
                      type="stepAfter"
                      dataKey="cum"
                      stroke={cumLineColor}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div
                className="mt-4 rounded-lg p-3"
                style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)" }}
              >
                <h3 className="text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
                  Per-trade P&amp;L
                </h3>
                <PnlBarChart trades={pnlTrades} />
              </div>
            </>
          )}

          <div className={dayTrades.length > 0 ? "mt-4" : "mt-6"}>
            <SessionPerformanceGrid
              sessions={sessions}
              title="Session performance (entry HKT) — this day"
              gridClassName="grid grid-cols-1 sm:grid-cols-2 gap-3"
            />
          </div>

          {dayTrades.length > 0 && (
            <div
              className="mt-4 overflow-x-auto rounded-lg"
              style={{ border: "1px solid var(--bg-border)" }}
            >
              <table className="w-full text-sm min-w-[520px]">
                <thead>
                  <tr style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--bg-border)" }}>
                    <th className="text-left p-2 pl-3 text-xs font-medium uppercase" style={{ color: "var(--text-muted)" }}>
                      Contract
                    </th>
                    <th className="text-left p-2 text-xs font-medium uppercase" style={{ color: "var(--text-muted)" }}>
                      Side
                    </th>
                    <th className="text-left p-2 text-xs font-medium uppercase" style={{ color: "var(--text-muted)" }}>
                      Entry
                    </th>
                    <th className="text-right p-2 text-xs font-medium uppercase" style={{ color: "var(--text-muted)" }}>
                      Net P&amp;L
                    </th>
                    <th className="text-left p-2 pr-3 text-xs font-medium uppercase" style={{ color: "var(--text-muted)" }}>
                      Score
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dayTrades.map((t, i) => (
                    <tr
                      key={t.id}
                      style={{
                        background: i % 2 === 0 ? "var(--bg-card)" : "var(--bg-base)",
                        borderBottom: "1px solid var(--bg-border)",
                      }}
                    >
                      <td className="p-2 pl-3 font-medium">
                        <Link
                          href={`/trades/${t.id}`}
                          className="hover:underline"
                          style={{ color: "var(--accent)" }}
                          onClick={onClose}
                        >
                          {t.contractName}
                        </Link>
                      </td>
                      <td className="p-2" style={{ color: t.direction === "Long" ? "var(--profit)" : "var(--loss)" }}>
                        {t.direction}
                      </td>
                      <td className="p-2 text-xs tabular-nums" style={{ color: "var(--text-secondary)" }}>
                        {fmtTimeHkt(t.entryTime)}
                      </td>
                      <td
                        className="p-2 text-right font-medium tabular-nums"
                        style={{ color: t.netPnl >= 0 ? "var(--profit)" : "var(--loss)" }}
                      >
                        {fmtUsd(t.netPnl)}
                      </td>
                      <td className="p-2 pr-3">
                        <Link href={`/trades/${t.id}`} onClick={onClose}>
                          <ScoreBadge score={t.qualityScore} size="sm" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
