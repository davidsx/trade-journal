"use client";

import { useState } from "react";

export default function RefreshCandlesButton() {
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [info, setInfo] = useState("");

  async function handleRefresh() {
    setStatus("loading");
    setInfo("");
    try {
      const res = await fetch(`/api/candles?symbol=MNQ%3DF&interval=1m&refresh=1`, {
        method: "GET",
      });
      const d = await res.json();
      if (d.error) {
        setInfo(d.error);
        setStatus("error");
      } else {
        const parts = [
          `${d.candles?.length ?? 0} bars`,
          d.batched ? "multi-fetch" : null,
          d.source === "yfinance" ? "yfinance" : null,
          typeof d.tradeCount === "number" ? `${d.tradeCount} trades` : null,
        ].filter(Boolean);
        setInfo(parts.join(" · "));
        setStatus("ok");
      }
    } catch (e) {
      setInfo(String(e));
      setStatus("error");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleRefresh}
        disabled={status === "loading"}
        className="px-3 py-1 rounded text-xs font-medium transition-colors"
        style={{
          background: status === "error" ? "#ef444422" : "var(--bg-border)",
          color: status === "error" ? "var(--loss)" : "var(--text-secondary)",
          opacity: status === "loading" ? 0.6 : 1,
          cursor: status === "loading" ? "wait" : "pointer",
        }}
      >
        {status === "loading" ? "Fetching…" : "↻ Refresh candles"}
      </button>
      {info && (
        <span
          className="text-xs"
          style={{ color: status === "ok" ? "var(--profit)" : "var(--loss)" }}
        >
          {info}
        </span>
      )}
    </div>
  );
}
