"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ClearTradesButton() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [info, setInfo] = useState("");

  async function handleClear() {
    if (
      !window.confirm(
        "Delete every trade in the database? This cannot be undone."
      )
    ) {
      return;
    }
    setStatus("loading");
    setInfo("");
    try {
      const res = await fetch("/api/trades/delete-all", { method: "POST" });
      const d = (await res.json()) as { deleted?: number; error?: string };
      if (!res.ok || d.error) {
        setInfo(d.error ?? "Request failed");
        setStatus("error");
      } else {
        setInfo(`${d.deleted ?? 0} trades removed`);
        setStatus("ok");
        router.refresh();
      }
    } catch (e) {
      setInfo(String(e));
      setStatus("error");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleClear}
        disabled={status === "loading"}
        className="px-3 py-1 rounded text-xs font-medium transition-colors"
        style={{
          background: status === "error" ? "#ef444422" : "var(--loss)",
          color: "#fff",
          opacity: status === "loading" ? 0.6 : 1,
          cursor: status === "loading" ? "wait" : "pointer",
        }}
      >
        {status === "loading" ? "Clearing…" : "Clear all trades"}
      </button>
      {info && (
        <span className="text-xs" style={{ color: status === "ok" ? "var(--profit)" : "var(--loss)" }}>
          {info}
        </span>
      )}
    </div>
  );
}
