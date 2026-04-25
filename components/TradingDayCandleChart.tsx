"use client";

import { useEffect, useRef } from "react";
import type { Candle } from "@/lib/analytics/loadDayCandles";

export type SessionCandleMarker = {
  time: number; // Unix seconds
  price: number;
  direction: "Long" | "Short";
  type: "entry" | "exit";
  pnl?: number;
  /** Preformatted marker label (HKT 1m bar alignment handled below). */
  text: string;
};

type Props = {
  candles: Candle[];
  markers: SessionCandleMarker[];
  height?: number;
};

/**
 * Full-session OHLC (1m) with optional entry/exit markers (one day, multiple trades).
 */
export default function TradingDayCandleChart({ candles, markers, height = 280 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const markersKey = JSON.stringify(
    markers.map((m) => [m.time, m.type, m.text, m.pnl])
  );

  useEffect(() => {
    if (!containerRef.current || candles.length === 0) return;
    const el = containerRef.current;
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      const { createChart, ColorType, CandlestickSeries, createSeriesMarkers } = await import("lightweight-charts");
      if (cancelled) return;

      const HKT_OFFSET_S = 8 * 3600;
      const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hktTickFormatter = (ts: any, type: number): string => {
        const d = new Date((Number(ts) + HKT_OFFSET_S) * 1000);
        if (type <= 2) return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
        const hh = String(d.getUTCHours()).padStart(2, "0");
        const mm = String(d.getUTCMinutes()).padStart(2, "0");
        return `${hh}:${mm}`;
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hktTooltipFormatter = (ts: any): string => {
        const d = new Date((Number(ts) + HKT_OFFSET_S) * 1000);
        const hh = String(d.getUTCHours()).padStart(2, "0");
        const mm = String(d.getUTCMinutes()).padStart(2, "0");
        return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${hh}:${mm} HKT`;
      };

      if (cancelled) return;

      const chart = createChart(el, {
        layout: {
          background: { type: ColorType.Solid, color: "#111111" },
          textColor: "#9ca3af",
          fontSize: 10,
        },
        grid: {
          vertLines: { color: "#1f1f1f" },
          horzLines: { color: "#1f1f1f" },
        },
        crosshair: {
          vertLine: { color: "#38bdf855", width: 1, style: 1 },
          horzLine: { color: "#38bdf855", width: 1, style: 1 },
        },
        localization: { timeFormatter: hktTooltipFormatter },
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
          borderColor: "#2a2a2a",
          rightOffset: 5,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tickMarkFormatter: hktTickFormatter as any,
        },
        rightPriceScale: { borderColor: "#2a2a2a" },
        width: el.clientWidth,
        height,
      });

      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: "#22c55e",
        downColor: "#ef4444",
        borderVisible: false,
        wickUpColor: "#22c55e",
        wickDownColor: "#ef4444",
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      candleSeries.setData(candles.map((c) => ({ ...c, time: c.time as any })));

      const forMarkers = markers
        .map((m) => ({
          time: m.time,
          position:
            m.type === "entry"
              ? m.direction === "Long"
                ? ("belowBar" as const)
                : ("aboveBar" as const)
              : m.direction === "Long"
                ? ("aboveBar" as const)
                : ("belowBar" as const),
          color:
            m.type === "entry"
              ? m.direction === "Long"
                ? "#22c55e"
                : "#ef4444"
              : (m.pnl ?? 0) >= 0
                ? "#22c55e"
                : "#ef4444",
          shape:
            m.type === "entry" ? (m.direction === "Long" ? ("arrowUp" as const) : ("arrowDown" as const)) : ("circle" as const),
          size: 1,
          text: m.text,
        }))
        .sort((a, b) => a.time - b.time)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((row) => ({ ...row, time: (Math.floor(row.time / 60) * 60) as any }));

      createSeriesMarkers(candleSeries, forMarkers);

      const tmin = Math.min(...candles.map((c) => c.time));
      const tmax = Math.max(...candles.map((c) => c.time));
      const bufferS = 5 * 60;
      chart.timeScale().setVisibleRange({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        from: (tmin - bufferS) as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        to: (tmax + bufferS) as any,
      });

      const ro = new ResizeObserver(() => {
        chart.applyOptions({ width: el.clientWidth });
      });
      ro.observe(el);

      cleanup = () => {
        ro.disconnect();
        chart.remove();
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [candles, height, markersKey]);

  if (candles.length === 0) {
    return (
      <div
        className="rounded flex items-center justify-center text-xs"
        style={{
          height,
          background: "#111111",
          color: "var(--text-muted)",
          border: "1px solid var(--bg-border)",
        }}
      >
        No candle data for this session
      </div>
    );
  }

  return <div ref={containerRef} style={{ width: "100%", height }} />;
}
