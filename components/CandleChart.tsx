"use client";

import { useEffect, useRef } from "react";
import type { Candle } from "@/app/api/candles/route";

export interface TradeMarker {
  time: number; // Unix timestamp (seconds)
  price: number;
  direction: "Long" | "Short";
  type: "entry" | "exit";
  pnl?: number;  // for exits: used to color green/red
  label?: string;
}

export interface TradeLine {
  entryTime: number;  // Unix timestamp (seconds)
  entryPrice: number;
  exitTime: number;
  exitPrice: number;
  pnl: number;
}

interface Props {
  candles: Candle[];
  markers?: TradeMarker[];
  tradeLines?: TradeLine[];
  height?: number;
}

export default function CandleChart({ candles, markers = [], tradeLines = [], height = 520 }: Props) {
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
        LineSeries,
        createSeriesMarkers,
      } = await import("lightweight-charts");

      // HKT = UTC+8 (+8h offset)
      const HKT_OFFSET_S = 8 * 3600;
      const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

      // tickMarkFormatter controls x-axis labels; TickMarkType: 0=Year,1=Month,2=DayOfMonth,3=Time,4=TimeWithSeconds
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hktTickFormatter = (ts: any, type: number): string => {
        const d = new Date((Number(ts) + HKT_OFFSET_S) * 1000);
        if (type <= 2) {
          // Day / Month / Year label
          return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
        }
        // Time label
        const hh = String(d.getUTCHours()).padStart(2, "0");
        const mm = String(d.getUTCMinutes()).padStart(2, "0");
        return `${hh}:${mm}`;
      };

      // localization.timeFormatter controls the crosshair tooltip time display
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hktTooltipFormatter = (ts: any): string => {
        const d = new Date((Number(ts) + HKT_OFFSET_S) * 1000);
        const hh = String(d.getUTCHours()).padStart(2, "0");
        const mm = String(d.getUTCMinutes()).padStart(2, "0");
        return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${hh}:${mm} HKT`;
      };

      const chart = createChart(el, {
        layout: {
          background: { type: ColorType.Solid, color: "#0f0f0f" },
          textColor: "#d1d5db",
          fontSize: 11,
        },
        grid: {
          vertLines: { color: "#1f1f1f" },
          horzLines: { color: "#1f1f1f" },
        },
        crosshair: {
          vertLine: { color: "#38bdf866", width: 1, style: 1 },
          horzLine: { color: "#38bdf866", width: 1, style: 1 },
        },
        localization: {
          timeFormatter: hktTooltipFormatter,
        },
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
          borderColor: "#2a2a2a",
          rightOffset: 8,
          fixLeftEdge: false,
          fixRightEdge: false,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tickMarkFormatter: hktTickFormatter as any,
        },
        rightPriceScale: { borderColor: "#2a2a2a" },
        width: el.clientWidth,
        height,
      });

      // Candlestick series
      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: "#22c55e",
        downColor: "#ef4444",
        borderVisible: false,
        wickUpColor: "#22c55e",
        wickDownColor: "#ef4444",
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      candleSeries.setData(candles.map((c) => ({ ...c, time: c.time as any })));


      // Trade markers — icons only (no text), small size
      let markersPlugin: ReturnType<typeof createSeriesMarkers> | null = null;
      if (markers.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const markerData = markers.map((m) => ({
          time: m.time as any,
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
              ? m.direction === "Long" ? "#22c55e" : "#ef4444"
              : (m.pnl ?? 0) >= 0 ? "#22c55e" : "#ef4444",
          shape:
            m.type === "entry"
              ? m.direction === "Long" ? ("arrowUp" as const) : ("arrowDown" as const)
              : ("circle" as const),
          size: 1,
          text: m.label ?? "",
        }));
        markersPlugin = createSeriesMarkers(candleSeries, markerData);
      }

      // Trade connector lines — one LineSeries per trade (entry → exit)
      // TODO: timestamps need verification before enabling
      const SHOW_CONNECTOR_LINES = false;
      const connectorSeriesList: ReturnType<typeof chart.addSeries>[] = [];
      for (const line of SHOW_CONNECTOR_LINES ? tradeLines : []) {
        const cs = chart.addSeries(LineSeries, {
          color: "rgba(250,204,21,0.75)",
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
          priceScaleId: "right",
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cs.setData([
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          { time: line.entryTime as any, value: line.entryPrice },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          { time: line.exitTime as any, value: line.exitPrice },
        ]);
        connectorSeriesList.push(cs);
      }

      // Session boxes — for each UTC date in the data, mark Asia / London / NY windows
      // Session windows in UTC (HKT = UTC+8)
      // Asia   08:00–16:00 HKT = 00:00–08:00 UTC
      // London 16:00–21:30 HKT = 08:00–13:30 UTC
      // NY     21:30–05:00 HKT = 13:30–21:00 UTC
      const SESSIONS = [
        { label: "Asia (8am–4pm HKT)",    startH: 0,    endH: 8,    color: "rgba(139,92,246,0.07)",  border: "rgba(139,92,246,0.35)",  textColor: "rgba(167,139,250,0.8)"  },
        { label: "London (4pm–9:30pm HKT)", startH: 8,  endH: 13.5, color: "rgba(59,130,246,0.07)",  border: "rgba(59,130,246,0.35)",  textColor: "rgba(96,165,250,0.8)"   },
        { label: "NY (9:30pm–5am HKT)",   startH: 13.5, endH: 21,   color: "rgba(34,197,94,0.07)",   border: "rgba(34,197,94,0.35)",   textColor: "rgba(74,222,128,0.8)"   },
      ];

      // Collect unique UTC dates from candles
      const utcDates = [...new Set(candles.map((c) => {
        const d = new Date(c.time * 1000);
        return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 1000;
      }))];

      // Build one [start, end] entry per session per day
      const sessionRanges = utcDates.flatMap((midnight) =>
        SESSIONS.map((s) => ({
          start: midnight + s.startH * 3600,
          end:   midnight + s.endH   * 3600,
          label: s.label,
          color: s.color,
          border: s.border,
          textColor: s.textColor,
        }))
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sessionPrimitive: any = {
        paneViews() {
          return [{
            zOrder() { return "bottom"; },
            renderer() {
              return {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                draw(target: any) {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  target.useBitmapCoordinateSpace(({ context, bitmapSize, horizontalPixelRatio, verticalPixelRatio }: any) => {
                    context.save();
                    context.font = `${Math.round(10 * verticalPixelRatio)}px sans-serif`;

                    // Cap session ends at the last loaded candle (+1 bar) so fills never
                    // extend into empty space to the right of the data.  Without this,
                    // sessions whose real end time is past the last candle return a null
                    // coordinate and the fallback paints to canvas-width, causing multiple
                    // semi-transparent fills to stack and pale the background.
                    // Using the data boundary (not the visible range) avoids the jumpiness
                    // caused by scroll-position-dependent clamping.
                    const firstT     = candles[0].time;
                    const lastCandle = candles[candles.length - 1].time;
                    const lastT      = lastCandle + 60; // +1 bar width, for skip-check only

                    // Helper: timeToCoordinate can return null when the requested time
                    // falls in a gap between trading sessions (e.g. 21:00–22:00 UTC CME
                    // maintenance break).  Fall back to the last candle whose time ≤ t.
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const coordFor = (t: number): number | null => {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const c = chart.timeScale().timeToCoordinate(t as any);
                      if (c !== null) return c;
                      // Binary-search for largest candle.time ≤ t
                      let lo = 0, hi = candles.length - 1, idx = -1;
                      while (lo <= hi) {
                        const mid = (lo + hi) >> 1;
                        if (candles[mid].time <= t) { idx = mid; lo = mid + 1; }
                        else hi = mid - 1;
                      }
                      if (idx < 0) return null;
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      return chart.timeScale().timeToCoordinate(candles[idx].time as any);
                    };

                    for (const s of sessionRanges) {
                      // Skip sessions entirely outside the loaded data
                      if (s.end <= firstT || s.start >= lastT) continue;

                      const t1 = Math.max(s.start, firstT);
                      const t2 = Math.min(s.end, lastCandle);

                      const x1raw = coordFor(t1);
                      const x2raw = coordFor(t2);
                      if (x1raw === null || x2raw === null) continue;

                      // Clamp pixel coords to canvas bounds
                      const x1 = Math.round(Math.max(0, x1raw) * horizontalPixelRatio);
                      const x2 = Math.round(Math.min(bitmapSize.width / horizontalPixelRatio, x2raw) * horizontalPixelRatio);
                      if (x2 <= x1) continue;

                      // Fill
                      context.fillStyle = s.color;
                      context.fillRect(x1, 0, x2 - x1, bitmapSize.height);

                      // Left border — only when the real session start is on-screen
                      context.strokeStyle = s.border;
                      context.lineWidth = 1 * horizontalPixelRatio;
                      context.setLineDash([]);
                      if (s.start >= firstT && x1raw >= 0) {
                        context.beginPath();
                        context.moveTo(x1, 0); context.lineTo(x1, bitmapSize.height);
                        context.stroke();
                      }
                      // Right border — only when the real session end is on-screen
                      if (s.end < lastT && x2raw <= bitmapSize.width / horizontalPixelRatio) {
                        context.beginPath();
                        context.moveTo(x2, 0); context.lineTo(x2, bitmapSize.height);
                        context.stroke();
                      }

                      // Label — only when the session's left edge is on-screen
                      if (x1raw >= 0) {
                        context.fillStyle = s.textColor;
                        context.fillText(s.label, x1 + 4 * horizontalPixelRatio, 12 * verticalPixelRatio);
                      }
                    }
                    context.restore();
                  });
                },
              };
            },
          }];
        },
      };
      chart.panes()[0].attachPrimitive(sessionPrimitive);

      // Day breaker lines — find the first candle of each new calendar day (UTC)
      const dayBreakTimes: number[] = [];
      let prevDay = -1;
      for (const c of candles) {
        const day = new Date(c.time * 1000).getUTCDate();
        if (prevDay !== -1 && day !== prevDay) {
          dayBreakTimes.push(c.time);
        }
        prevDay = day;
      }

      if (dayBreakTimes.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const dayBreakerPrimitive: any = {
          paneViews() {
            return [
              {
                zOrder() {
                  return "bottom";
                },
                renderer() {
                  return {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    draw(target: any) {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      target.useBitmapCoordinateSpace(({ context, bitmapSize, horizontalPixelRatio }: any) => {
                        context.save();
                        context.strokeStyle = "#38bdf855";
                        context.setLineDash([
                          4 * horizontalPixelRatio,
                          4 * horizontalPixelRatio,
                        ]);
                        context.lineWidth = 1 * horizontalPixelRatio;
                        for (const t of dayBreakTimes) {
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          const x = chart.timeScale().timeToCoordinate(t as any);
                          if (x === null) continue;
                          const bx = Math.round(x * horizontalPixelRatio);
                          context.beginPath();
                          context.moveTo(bx, 0);
                          context.lineTo(bx, bitmapSize.height);
                          context.stroke();
                        }
                        context.restore();
                      });
                    },
                  };
                },
              },
            ];
          },
        };
        chart.panes()[0].attachPrimitive(dayBreakerPrimitive);
      }

      chart.timeScale().fitContent();

      const ro = new ResizeObserver(() => {
        chart.applyOptions({ width: el.clientWidth });
      });
      ro.observe(el);

      cleanup = () => {
        ro.disconnect();
        markersPlugin?.detach();
        connectorSeriesList.forEach((cs) => chart.removeSeries(cs));
        chart.remove();
      };
    })();

    return () => cleanup?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles, markers, tradeLines, height]);

  if (candles.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg text-sm"
        style={{ height, background: "#0f0f0f", color: "var(--text-muted)" }}
      >
        No candle data — market may be closed or data unavailable
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height }}
      className="rounded-lg overflow-hidden"
    />
  );
}
