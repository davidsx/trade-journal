import { prisma } from "@/lib/db/prisma";
import { scoreTrades } from "@/lib/analytics/scorer";
import type { ImportedTrade } from "@/lib/csv/parser";
import type { TradeModel as Trade } from "@/app/generated/prisma/models";
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

export async function upsertOneImportedTrade(t: ImportedTrade): Promise<void> {
  const accountId = await getActiveAccountId();
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
 * @param initialBalanceOverride - starting capital for the run (default: from `Account` row)
 * @param accountIdParam - which account’s trades to rescore (default: active account)
 */
export async function finalizeCsvAccountScoring(
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
  const withCapital: Trade[] = all.map((row) => {
    const capitalBefore = capital;
    capital += row.netPnl;
    return {
      ...row,
      capitalBefore,
      capitalAfter: capital,
    };
  });

  const scored = await scoreTrades(withCapital);

  await runPool(scored, conc, async (t) => {
    await prisma.trade.update({
      where: { id: t.id },
      data: {
        capitalBefore: t.capitalBefore,
        capitalAfter: t.capitalAfter,
        qualityScore: t.qualityScore,
        entryScore: t.entryScore,
        exitScore: t.exitScore,
        riskScore: t.riskScore,
        scoreNotes: t.scoreNotes,
      },
    });
  });
}
