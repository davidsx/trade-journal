"use client";

import { useEffect, useState } from "react";
import CandleChart from "./CandleChart";
import type { Candle } from "@/app/api/candles/route";
import type { TradeMarker, TradeLine } from "./CandleChart";
import { CANDLES_REFRESH_EVENT } from "@/lib/candles/refreshEvent";

const INTERVALS = [
  { label: "1m",  value: "1m" },
  { label: "5m",  value: "5m" },
  { label: "15m", value: "15m" },
  { label: "30m", value: "30m" },
  { label: "1h",  value: "60m" },
] as const;

type IntervalValue = typeof INTERVALS[number]["value"];

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
  const [cacheBust, setCacheBust] = useState(0);

  useEffect(() => {
    const onRefreshed = () => setCacheBust((n) => n + 1);
    window.addEventListener(CANDLES_REFRESH_EVENT, onRefreshed);
    return () => window.removeEventListener(CANDLES_REFRESH_EVENT, onRefreshed);
  }, []);

  // Auto-fetch on mount, interval change, or after "↻ Refresh candles" updates the on-disk file.
  useEffect(() => {
    setStatus("loading");
    setCandles([]);

    const ac = new AbortController();
    const run = async () => {
      try {
        const r = await fetch(`/api/candles?symbol=MNQ%3DF&interval=${interval}`, {
          signal: ac.signal,
          cache: "no-store",
        });
        const d = (await r.json()) as { error?: string; candles?: Candle[] };
        if (ac.signal.aborted) return;
        if (!r.ok) {
          setError((d as { error?: string }).error ?? r.statusText);
          setStatus("error");
          return;
        }
        if (d.error) {
          setError(d.error);
          setStatus("error");
        } else {
          setCandles(d.candles ?? []);
          setStatus("ok");
        }
      } catch (e) {
        if (ac.signal.aborted) return;
        if (e instanceof Error && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : String(e));
        setStatus("error");
      }
    };
    void run();
    return () => ac.abort();
  }, [interval, cacheBust]);

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
            href={`/api/candles?symbol=MNQ%3DF&interval=${interval}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs underline"
            style={{ color: "var(--accent)" }}
          >
            Check API route directly →
          </a>
        </div>
      ) : status === "loading" ? (
        <div
          className="flex flex-col items-center justify-center gap-3 rounded-lg text-sm"
          style={{ height: 560, background: "#0f0f0f", color: "var(--text-muted)" }}
        >
          <span
            className="h-6 w-6 rounded-full border-2 border-current border-t-transparent opacity-80 animate-spin"
            style={{ color: "var(--accent)" }}
            aria-hidden
          />
          <p style={{ color: "var(--text-secondary)" }}>Loading candles from Yahoo (via API)…</p>
          <p className="text-xs text-center max-w-sm px-4">
            If this is your first visit, the server may be filling the range from your trades (can take a minute).
          </p>
        </div>
      ) : candles.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center rounded-lg text-sm gap-1"
          style={{ height: 560, background: "#0f0f0f", color: "var(--text-muted)" }}
        >
          <span style={{ color: "var(--text-secondary)" }}>No bars returned for this range</span>
          <span className="text-xs">Import trades or use Refresh in the header to re-fetch from Yahoo.</span>
        </div>
      ) : (
        <CandleChart candles={candles} markers={markers} tradeLines={tradeLines} height={560} />
      )}
    </>
  );
}
