import { prisma } from "@/lib/db/prisma";
import type { ImportedTrade } from "@/lib/csv/parser";
import { getActiveAccountId } from "@/lib/activeAccount";
import { DEFAULT_INITIAL_BALANCE } from "@/lib/accountConstants";
import { tradesWhere } from "@/lib/accountScope";
/** @deprecated use getAccountSettings().initialBalance or DEFAULT_INITIAL_BALANCE */
export const STARTING_CAPITAL = DEFAULT_INITIAL_BALANCE;

/** Bounded parallelism for DB writes. */
export async function runPool<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>): Promise<void> {
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

export function dbConcurrency(): number {
  const raw = process.env.IMPORT_DB_CONCURRENCY;
  const n = raw ? parseInt(raw, 10) : 8;
  if (Number.isNaN(n)) return 8;
  return Math.min(16, Math.max(1, n));
}

export function coreFromImported(t: ImportedTrade) {
  return {
    accountId: t.accountId,
    contractId: t.contractId,
    contractName: t.contractName,
    direction: t.direction,
    qty: t.qty,
    entryFillId: t.entryFillId,
    exitFillId: t.exitFillId,
    entryPrice: t.entryPrice,
    exitPrice: t.exitPrice,
    entryTime: t.entryTime,
    exitTime: t.exitTime,
    holdingMins: t.holdingMins,
    grossPnl: t.grossPnl,
    fees: t.fees,
    netPnl: t.netPnl,
    rMultiple: null as number | null,
    qualityScore: null as number | null,
    entryScore: null as number | null,
    exitScore: null as number | null,
    riskScore: null as number | null,
    scoreNotes: null as string | null,
    capitalBefore: 0,
    capitalAfter: 0,
  };
}

/**
 * Resolve + validate a CSV import destination. Rejects hidden or breached accounts
 * (matches the UI, which hides them from the destination picker). Throws on invalid target.
 */
export async function resolveImportAccountId(accountIdOverride?: number): Promise<number> {
  const accountId = accountIdOverride ?? (await getActiveAccountId());
  const acc = await prisma.account.findUnique({
    where: { id: accountId },
    select: { id: true, hiddenFromStats: true, status: true },
  });
  if (!acc) throw new Error("Import account not found");
  if (acc.hiddenFromStats) throw new Error("Cannot import into a hidden account");
  if (acc.status === "Breached") throw new Error("Cannot import into a breached account");
  return acc.id;
}

export async function upsertOneImportedTrade(t: ImportedTrade, accountIdOverride?: number): Promise<void> {
  const accountId = await resolveImportAccountId(accountIdOverride);
  const core = { ...coreFromImported(t), accountId };
  await prisma.trade.upsert({
    where: { id: t.id },
    create: { id: t.id, ...core, createdAt: t.createdAt },
    update: core,
  });
}

export async function upsertImportedTrades(trades: ImportedTrade[]): Promise<void> {
  if (trades.length === 0) return;
  const conc = dbConcurrency();
  await runPool(trades, conc, upsertOneImportedTrade);
}

/**
 * Recompute running capital (capitalBefore/After) for an account's trades in
 * entry-time order. Run after importing or after changing starting capital.
 *
 * @param initialBalanceOverride - starting capital for the run (default: from `Account` row)
 * @param accountIdParam - which account’s trades to recompute (default: active account)
 */
export async function finalizeCsvAccountCapital(
  initialBalanceOverride?: number,
  accountIdParam?: number
): Promise<void> {
  const conc = dbConcurrency();
  const accountId = accountIdParam ?? (await getActiveAccountId());
  const acc = await prisma.account.findUnique({ where: { id: accountId } });
  if (!acc) return;
  const all = await prisma.trade.findMany({
    where: tradesWhere(accountId),
    orderBy: { entryTime: "asc" },
  });

  const start = initialBalanceOverride ?? acc.initialBalance;
  let capital = start;
  const withCapital = all.map((row) => {
    const capitalBefore = capital;
    capital += row.netPnl;
    return { id: row.id, capitalBefore, capitalAfter: capital };
  });

  await runPool(withCapital, conc, async (t) => {
    await prisma.trade.update({
      where: { id: t.id },
      data: { capitalBefore: t.capitalBefore, capitalAfter: t.capitalAfter },
    });
  });
}
