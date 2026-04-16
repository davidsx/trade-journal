"use client";

import { useEffect, useRef } from "react";
import type { Candle } from "@/lib/analytics/loadDayCandles";

interface TradeMarkerInfo {
  time: number;       // Unix seconds
  price: number;
  direction: "Long" | "Short";
  type: "entry" | "exit";
  pnl?: number;
}

interface Props {
  candles: Candle[];
  entry: TradeMarkerInfo;
  exit: TradeMarkerInfo;
  height?: number;
}

export default function TradeDetailChart({ candles, entry, exit, height = 320 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || candles.length === 0) return;
    const el = containerRef.current;
    let cleanup: (() => void) | undefined;

    (async () => {
      const {
        createChart,
        ColorType,
        CandlestickSeries,
        createSeriesMarkers,
      } = await import("lightweight-charts");

      const HKT_OFFSET_S = 8 * 3600;
      const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

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

      // Entry + exit markers — floor to minute boundary so the marker lands on the correct
      // 1-minute candle (e.g. 01:57:52 → 01:57:00 = the 01:57 candle open time).
      const markers = [entry, exit].map((m) => ({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        time: (Math.floor(m.time / 60) * 60) as any,
        position:
          m.type === "entry"
            ? m.direction === "Long" ? ("belowBar" as const) : ("aboveBar" as const)
            : m.direction === "Long" ? ("aboveBar" as const) : ("belowBar" as const),
        color:
          m.type === "entry"
            ? m.direction === "Long" ? "#22c55e" : "#ef4444"
            : (m.pnl ?? 0) >= 0 ? "#22c55e" : "#ef4444",
        shape:
          m.type === "entry"
            ? m.direction === "Long" ? ("arrowUp" as const) : ("arrowDown" as const)
            : ("circle" as const),
        size: 1,
        text: m.type === "entry" ? `${m.direction} @ ${m.price.toFixed(2)}` : `Exit @ ${m.price.toFixed(2)}`,
      }));

      createSeriesMarkers(candleSeries, markers);

      // Fit visible range with a small buffer around the trade
      const bufferS = 30 * 60; // 30 min on each side
      chart.timeScale().setVisibleRange({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        from: (entry.time - bufferS) as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        to: (exit.time + bufferS) as any,
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

    return () => cleanup?.();
  }, [candles, entry, exit, height]);

  if (candles.length === 0) {
    return (
      <div
        className="rounded flex items-center justify-center text-xs"
        style={{ height, background: "#111111", color: "var(--text-muted)", border: "1px solid var(--bg-border)" }}
      >
        No candle data for this trading day
      </div>
    );
  }

  return <div ref={containerRef} style={{ width: "100%", height }} />;
}
