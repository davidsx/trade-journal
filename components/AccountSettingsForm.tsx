"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  initialBalance: number;
  /** Tighter layout on the dashboard */
  compact?: boolean;
};

export default function AccountSettingsForm({ initialBalance, compact }: Props) {
  const router = useRouter();
  const [bal, setBal] = useState(String(initialBalance));
  const [status, setStatus] = useState<"idle" | "saving" | "ok" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const ib = parseFloat(bal);
    if (!Number.isFinite(ib) || ib <= 0) {
      setMsg("Initial balance must be a positive number");
      setStatus("error");
      return;
    }

    setStatus("saving");
    setMsg("");
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initialBalance: ib }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(typeof data.error === "string" ? data.error : "Save failed");
        setStatus("error");
        return;
      }
      setStatus("ok");
      setMsg("Saved — capital and scores updated");
      router.refresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed");
      setStatus("error");
    }

    setTimeout(() => {
      setStatus("idle");
      setMsg("");
    }, 4000);
  }

  return (
    <form
      onSubmit={save}
      className={compact ? "flex flex-wrap gap-3 items-end" : "space-y-4 max-w-lg"}
    >
      <div className={compact ? "flex-1 min-w-[140px]" : ""}>
        <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>
          Initial account balance ($)
        </label>
        <input
          type="number"
          min={1}
          step="any"
          required
          value={bal}
          onChange={(e) => setBal(e.target.value)}
          className="w-full px-3 py-2 rounded-md text-sm"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--bg-border)",
            color: "var(--text-primary)",
          }}
        />
        {!compact && (
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Starting capital for the equity curve and per-trade running balance.
          </p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={status === "saving"}
          className="px-4 py-2 rounded-md text-sm font-medium transition-colors"
          style={{
            background: "var(--accent)",
            color: "#000",
            opacity: status === "saving" ? 0.7 : 1,
            cursor: status === "saving" ? "wait" : "pointer",
          }}
        >
          {status === "saving" ? "Saving…" : "Save"}
        </button>
        {msg && (
          <span
            className="text-xs"
            style={{ color: status === "error" ? "var(--loss)" : "var(--profit)" }}
          >
            {msg}
          </span>
        )}
      </div>
    </form>
  );
}
