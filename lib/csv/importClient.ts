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

export type ImportCsvOptions = {
  /** Destination account id. */
  accountId: number;
  /** Account's starting capital; falls back to the default when non-positive. */
  initialBalance: number;
  /** Progress callback (drives UI status text). */
  onProgress?: (message: string) => void;
};

/**
 * Parse a Performance/P&L CSV and import its trades into an account:
 * check overlap → upsert round-trip trades → recompute running capital.
 * Shared by the CSV upload modal and the new-account flow. Throws on any
 * step failure.
 */
export async function importCsvIntoAccount(file: File, opts: ImportCsvOptions): Promise<void> {
  if (!file.name.endsWith(".csv")) {
    throw new Error("Please upload a .csv file");
  }

  const { accountId, onProgress } = opts;
  const initialBalance = opts.initialBalance > 0 ? opts.initialBalance : DEFAULT_INITIAL_BALANCE;

  const text = await file.text();
  const rows = parseCsv(text);
  const trades = csvRowsToTrades(rows, accountId, initialBalance);
  const total = trades.length;

  onProgress?.("1/3 Checking overlap…");
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
      onProgress?.(`2/3 Importing… ${done}/${total}`);
    }
  });

  onProgress?.("3/3 Finalizing…");
  const finRes = await fetch("/api/import/finalize", {
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
  if (!finRes.ok) throw new Error(data.error ?? "Finalize failed");
}
