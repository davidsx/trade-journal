"use client";

import { useEffect, useState } from "react";
import CandleChart from "./CandleChart";
import type { Candle } from "@/app/api/candles/route";
import type { TradeMarker, TradeLine } from "./CandleChart";

const INTERVALS = [
  { label: "1m",  value: "1m" },
  { label: "5m",  value: "5m" },
  { label: "15m", value: "15m" },
  { label: "30m", value: "30m" },
  { label: "1h",  value: "60m" },
] as const;

type IntervalValue = typeof INTERVALS[number]["value"];

// Apr 8–11 2026 UTC
const PERIOD1 = "1775606400";
const PERIOD2 = "1775865600";

interface Props {
  markers: TradeMarker[];
  tradeLines: TradeLine[];
  tradeCount: number;
}

export default function ChartClient({ markers, tradeLines, tradeCount }: Props) {
  const [interval, setInterval] = useState<IntervalValue>("1m");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    setStatus("loading");
    setCandles([]);
    fetch(
      `/api/candles?symbol=MNQ%3DF&interval=${interval}&period1=${PERIOD1}&period2=${PERIOD2}`
    )
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setError(d.error);
          setStatus("error");
        } else {
          setCandles(d.candles ?? []);
          setStatus("ok");
        }
      })
      .catch((e) => {
        setError(String(e));
        setStatus("error");
      });
  }, [interval]);

  return (
    <>
      {/* Interval selector */}
      <div className="flex items-center gap-1 mb-3">
        {INTERVALS.map((iv) => (
          <button
            key={iv.value}
            onClick={() => setInterval(iv.value)}
            className="px-2.5 py-1 rounded text-xs font-medium transition-colors"
            style={{
              background: interval === iv.value ? "var(--accent)" : "var(--bg-border)",
              color: interval === iv.value ? "#000" : "var(--text-secondary)",
            }}
          >
            {iv.label}
          </button>
        ))}
        {status === "loading" && (
          <span className="text-xs ml-2" style={{ color: "var(--text-muted)" }}>
            Loading…
          </span>
        )}
        {status === "ok" && (
          <span className="text-xs ml-2 tabular-nums" style={{ color: "var(--text-muted)" }}>
            {candles.length.toLocaleString()} bars · {tradeCount} markers
          </span>
        )}
      </div>

      {status === "error" ? (
        <div
          className="flex flex-col items-center justify-center rounded-lg text-sm gap-2"
          style={{ height: 560, background: "#0f0f0f", color: "var(--text-muted)" }}
        >
          <span style={{ color: "var(--loss)" }}>Failed to load candles</span>
          <span className="text-xs">{error}</span>
          <a
            href={`/api/candles?symbol=MNQ%3DF&interval=${interval}&period1=${PERIOD1}&period2=${PERIOD2}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs underline"
            style={{ color: "var(--accent)" }}
          >
            Check API route directly →
          </a>
        </div>
      ) : (
        <CandleChart candles={candles} markers={markers} tradeLines={tradeLines} height={560} />
      )}
    </>
  );
}
