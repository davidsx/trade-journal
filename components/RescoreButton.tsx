"use client";

import { useState } from "react";

export default function RescoreButton() {
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [info, setInfo] = useState("");

  async function handleRescore() {
    setStatus("loading");
    setInfo("");
    try {
      const res = await fetch("/api/rescore", { method: "POST" });
      const d = await res.json();
      if (d.error) {
        setInfo(d.error);
        setStatus("error");
      } else {
        setInfo(`${d.updated} trades rescored`);
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
        onClick={handleRescore}
        disabled={status === "loading"}
        className="px-3 py-1 rounded text-xs font-medium transition-colors"
        style={{
          background: status === "error" ? "#ef444422" : "var(--bg-border)",
          color: status === "error" ? "var(--loss)" : "var(--text-secondary)",
          opacity: status === "loading" ? 0.6 : 1,
          cursor: status === "loading" ? "wait" : "pointer",
        }}
      >
        {status === "loading" ? "Rescoring…" : "↻ Rescore trades"}
      </button>
      {info && (
        <span className="text-xs" style={{ color: status === "ok" ? "var(--profit)" : "var(--loss)" }}>
          {info}
        </span>
      )}
    </div>
  );
}
