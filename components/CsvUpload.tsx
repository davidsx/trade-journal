"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parseCsv, csvRowsToTrades } from "@/lib/csv/parser";
import { importedTradeToWire } from "@/lib/csv/importWire";
import { DEFAULT_INITIAL_BALANCE } from "@/lib/accountConstants";
import { accountLabel } from "@/lib/accountLabel";

/** Parallel in-flight upserts (browser + server; avoid opening hundreds of connections). */
const UPSERT_CONCURRENCY = 16;

async function runPool<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>): Promise<void> {
  if (items.length === 0) return;
  const c = Math.max(1, Math.min(concurrency, items.length));
  let next = 0;
  await Promise.all(
    Array.from({ length: c }, async () => {
      while (true) {
        const i = next++;
        if (i >= items.length) break;
        await fn(items[i]!);
      }
    })
  );
}

/** Account choices for the import destination selector. */
export type CsvUploadAccount = {
  id: number;
  name: string;
  initialBalance: number;
  propfirmName: string | null;
};

type CsvUploadProps = {
  /** "sidebar" (default): full-width trigger pinned to the bottom. "inline": compact button for toolbars. */
  variant?: "sidebar" | "inline";
  /** Selectable import destinations. If omitted, imports target the active account. */
  accounts?: CsvUploadAccount[];
  /** Which account to preselect (typically the active one). */
  defaultAccountId?: number;
};

export default function CsvUpload({ variant = "sidebar", accounts, defaultAccountId }: CsvUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const canChoose = Array.isArray(accounts) && accounts.length > 0;
  const [targetId, setTargetId] = useState<number | null>(
    defaultAccountId ?? accounts?.[0]?.id ?? null
  );
  useEffect(() => {
    if (defaultAccountId != null) setTargetId(defaultAccountId);
  }, [defaultAccountId]);
  const router = useRouter();

  async function handleFile(file: File) {
    if (!file.name.endsWith(".csv")) {
      setStatus("error");
      setMessage("Please upload a .csv file");
      return;
    }

    setStatus("uploading");
    setMessage(null);

    try {
      const text = await file.text();
      const rows = parseCsv(text);

      // Prefer an explicitly chosen destination; otherwise fall back to the active account.
      const chosen = canChoose ? accounts!.find((a) => a.id === targetId) : undefined;
      let initialBalance: number;
      let accountId: number;
      if (chosen) {
        initialBalance = chosen.initialBalance > 0 ? chosen.initialBalance : DEFAULT_INITIAL_BALANCE;
        accountId = chosen.id;
      } else {
        const settingsRes = await fetch("/api/settings");
        const settings = (await settingsRes.json()) as {
          initialBalance?: number;
          accountId?: number;
        };
        initialBalance =
          typeof settings.initialBalance === "number" && settings.initialBalance > 0
            ? settings.initialBalance
            : DEFAULT_INITIAL_BALANCE;
        accountId =
          typeof settings.accountId === "number" && settings.accountId > 0 ? settings.accountId : 1;
      }
      const trades = csvRowsToTrades(rows, accountId, initialBalance);
      const total = trades.length;

      setMessage("1/3 Checking overlap…");
      const overlapRes = await fetch("/api/import/overlap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvIds: trades.map((t) => t.id), accountId }),
      });
      const overlapData = await overlapRes.json();
      if (!overlapRes.ok) throw new Error(overlapData.error ?? "Overlap query failed");
      const replacedCount: number = overlapData.replacedCount;

      let done = 0;
      await runPool(trades, UPSERT_CONCURRENCY, async (t) => {
        const res = await fetch("/api/import/trade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trade: importedTradeToWire(t), accountId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Upsert failed");
        done += 1;
        if (done % 25 === 0 || done === total) {
          setMessage(`2/3 Importing… ${done}/${total}`);
        }
      });

      setMessage("3/3 Scoring…");
      const finRes = await fetch("/api/import/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rowsInCsv: total,
          symbol: trades[0]?.contractName,
          replacedCount,
          accountId,
        }),
      });
      const data = await finRes.json();
      if (!finRes.ok) throw new Error(data.error ?? "Scoring failed");

      setStatus("done");
      setMessage(null);
      setOpen(false);
      router.refresh();
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Error");
      setTimeout(() => {
        setStatus("idle");
        setMessage(null);
      }, 6000);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  const isLoading = status === "uploading";

  const inline = variant === "inline";

  return (
    <div className={inline ? "inline-flex flex-col items-stretch" : "mt-auto"}>
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleChange}
      />

      {/* Trigger — opens the import modal */}
      {inline ? (
        <button
          onClick={() => setOpen(true)}
          className="px-4 py-2 rounded-md text-sm font-medium"
          style={{ border: "1px solid var(--bg-border)", color: "var(--text-secondary)" }}
        >
          Import CSV
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex h-9 w-full min-h-9 shrink-0 items-center justify-center rounded-md px-3 text-center text-xs font-medium leading-none transition-colors"
          style={{ background: "var(--accent)", color: "#000" }}
        >
          Import CSV
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "color-mix(in srgb, #000 45%, transparent)" }}
          onClick={() => !isLoading && setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-lg p-5 space-y-4"
            style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                Import trades from CSV
              </h2>
              <button
                type="button"
                onClick={() => !isLoading && setOpen(false)}
                disabled={isLoading}
                className="text-lg leading-none px-1"
                style={{ color: "var(--text-muted)", opacity: isLoading ? 0.4 : 1 }}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div
              className="rounded-md p-3 text-xs leading-relaxed"
              style={{ background: "var(--bg-base)", border: "1px solid var(--bg-border)", color: "var(--text-secondary)" }}
            >
              Use your broker’s <strong>Performance / P&amp;L export</strong>: a tabular CSV with fills, prices, and
              timestamps. Rows are matched into round-trip trades, scored, and merged into the{" "}
              {canChoose ? "selected account" : "active account"} — re-importing an overlapping range replaces those
              trades rather than duplicating them.
            </div>

            {canChoose && (
              <div>
                <label
                  htmlFor="csv-import-account"
                  className="block text-xs font-medium mb-1"
                  style={{ color: "var(--text-muted)" }}
                >
                  Import into account
                </label>
                <select
                  id="csv-import-account"
                  value={targetId ?? ""}
                  onChange={(e) => setTargetId(Number(e.target.value))}
                  disabled={isLoading}
                  className="w-full px-3 py-2 rounded-md text-sm"
                  style={{ background: "var(--bg-base)", border: "1px solid var(--bg-border)", color: "var(--text-primary)" }}
                >
                  {accounts!.map((a) => (
                    <option key={a.id} value={a.id}>
                      {accountLabel(a)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Drop zone / file picker */}
            <button
              onClick={() => inputRef.current?.click()}
              disabled={isLoading}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="flex min-h-24 w-full flex-col items-center justify-center gap-1 rounded-md px-3 py-6 text-center text-sm font-medium transition-colors"
              style={{
                background: isLoading ? "var(--accent-dim)" : "color-mix(in srgb, var(--accent) 10%, var(--bg-base))",
                color: isLoading ? "#000" : "var(--text-primary)",
                border: "1px dashed color-mix(in srgb, var(--accent) 45%, var(--bg-border))",
                opacity: isLoading ? 0.8 : 1,
                cursor: isLoading ? "not-allowed" : "pointer",
              }}
            >
              {isLoading ? (
                "Importing…"
              ) : (
                <>
                  <span>Click to choose a .csv file</span>
                  <span className="text-xs font-normal" style={{ color: "var(--text-muted)" }}>
                    or drag &amp; drop it here
                  </span>
                </>
              )}
            </button>

            {message && (
              <p
                className="text-xs text-center px-1"
                style={{
                  color: status === "error" ? "var(--loss)" : status === "done" ? "var(--profit)" : "var(--text-muted)",
                }}
              >
                {message}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
