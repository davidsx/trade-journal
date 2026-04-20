"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parseCsv, csvRowsToTrades } from "@/lib/csv/parser";
import { importedTradeToWire } from "@/lib/csv/importWire";

/** Keep each /api/import/batch request small enough for Vercel time limits. */
const BATCH_SIZE = 60;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
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
      const trades = csvRowsToTrades(rows, 1);
      const batches = chunk(trades, BATCH_SIZE);
      const allCsvIds = trades.map((t) => t.id);

      let replacedCount: number | undefined;

      for (let i = 0; i < batches.length; i++) {
        setMessage(`Uploading… batch ${i + 1}/${batches.length}`);
        const wires = batches[i]!.map(importedTradeToWire);
        const res = await fetch("/api/import/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trades: wires,
            isFirstBatch: i === 0,
            ...(i === 0 ? { allCsvIds } : {}),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `Batch ${i + 1} failed`);
        if (typeof data.replacedCount === "number") replacedCount = data.replacedCount;
      }

      setMessage("Scoring trades…");
      const finRes = await fetch("/api/import/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rowsInCsv: trades.length,
          symbol: trades[0]?.contractName,
          replacedCount,
        }),
      });
      const data = await finRes.json();
      if (!finRes.ok) throw new Error(data.error ?? "Finalize failed");

      setStatus("done");
      const parts: string[] = [];
      if (typeof data.addedFromCsv === "number" && typeof data.updatedFromCsv === "number") {
        parts.push(`${data.addedFromCsv} new, ${data.updatedFromCsv} updated from CSV`);
      } else {
        parts.push(`${data.imported ?? trades.length} rows in file`);
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
        className="w-full py-2 px-3 rounded-md text-sm font-medium transition-colors text-center"
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
