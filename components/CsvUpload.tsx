"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parseCsv, csvRowsToTrades } from "@/lib/csv/parser";
import { importedTradeToWire } from "@/lib/csv/importWire";
import { DEFAULT_INITIAL_BALANCE } from "@/lib/accountConstants";

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

export default function CsvUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
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
      const settingsRes = await fetch("/api/settings");
      const settings = (await settingsRes.json()) as {
        initialBalance?: number;
        accountId?: number;
      };
      const initialBalance =
        typeof settings.initialBalance === "number" && settings.initialBalance > 0
          ? settings.initialBalance
          : DEFAULT_INITIAL_BALANCE;
      const accountId =
        typeof settings.accountId === "number" && settings.accountId > 0 ? settings.accountId : 1;
      const trades = csvRowsToTrades(rows, accountId, initialBalance);
      const total = trades.length;

      setMessage("1/3 Checking overlap…");
      const overlapRes = await fetch("/api/import/overlap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvIds: trades.map((t) => t.id) }),
      });
      const overlapData = await overlapRes.json();
      if (!overlapRes.ok) throw new Error(overlapData.error ?? "Overlap query failed");
      const replacedCount: number = overlapData.replacedCount;

      let done = 0;
      await runPool(trades, UPSERT_CONCURRENCY, async (t) => {
        const res = await fetch("/api/import/trade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trade: importedTradeToWire(t) }),
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
        }),
      });
      const data = await finRes.json();
      if (!finRes.ok) throw new Error(data.error ?? "Scoring failed");

      setStatus("done");
      const parts: string[] = [];
      if (typeof data.addedFromCsv === "number" && typeof data.updatedFromCsv === "number") {
        parts.push(`${data.addedFromCsv} new, ${data.updatedFromCsv} updated from CSV`);
      } else {
        parts.push(`${data.imported ?? total} rows in file`);
      }
      if (typeof data.totalTrades === "number") {
        parts.push(`${data.totalTrades} total in account`);
      }
      if (data.symbol) parts.push(String(data.symbol));
      setMessage(parts.join(" · "));
      router.refresh();
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Error");
    }

    setTimeout(() => {
      setStatus("idle");
      setMessage(null);
    }, 6000);
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

  return (
    <div className="mt-auto space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleChange}
      />

      {/* Drop zone / button */}
      <button
        onClick={() => inputRef.current?.click()}
        disabled={isLoading}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className="flex h-9 w-full min-h-9 shrink-0 items-center justify-center rounded-md border border-transparent px-3 text-center text-xs font-medium leading-none transition-colors"
        style={{
          background: isLoading ? "var(--accent-dim)" : "var(--accent)",
          color: "#000",
          opacity: isLoading ? 0.7 : 1,
          cursor: isLoading ? "not-allowed" : "pointer",
          border: "1px dashed transparent",
        }}
      >
        {isLoading ? "Importing…" : "Import CSV"}
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

      <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
        Use your broker’s Performance / P&L export:
        <br />
        tabular CSV with fills, prices, and timestamps
      </p>
    </div>
  );
}
