import { prisma } from "./prisma";
import { fetchFills } from "../tradovate/fills";
import { buildTrades } from "../analytics/tradeBuilder";

export async function syncFills(accountId: number): Promise<number> {
  // Find the latest fill timestamp we have
  const latest = await prisma.fill.findFirst({
    where: { accountId },
    orderBy: { timestamp: "desc" },
    select: { timestamp: true },
  });

  const since = latest?.timestamp ?? undefined;
  const fills = await fetchFills(accountId, since);

  if (fills.length === 0) return 0;

  // Upsert all fills
  await Promise.all(
    fills.map((f) =>
      prisma.fill.upsert({
        where: { id: f.id },
        update: {
          action: f.action,
          qty: f.qty,
          price: f.price,
          fees: f.fees,
          timestamp: f.timestamp,
        },
        create: f,
      })
    )
  );

  return fills.length;
}

export async function rebuildTrades(accountId: number): Promise<number> {
  // Load all fills for account, sorted chronologically
  const fills = await prisma.fill.findMany({
    where: { accountId },
    orderBy: { timestamp: "asc" },
  });

  const trades = buildTrades(fills, accountId);

  // Replace all trades for this account
  await prisma.trade.deleteMany({ where: { accountId } });

  if (trades.length > 0) {
    await prisma.trade.createMany({ data: trades });
  }

  return trades.length;
}

export async function runFullSync(
  accountId: number
): Promise<{ fillsAdded: number; tradesBuilt: number }> {
  let fillsAdded = 0;
  let tradesBuilt = 0;
  let errorMsg: string | undefined;

  try {
    fillsAdded = await syncFills(accountId);
    tradesBuilt = await rebuildTrades(accountId);
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : String(err);
  }

  await prisma.syncLog.create({
    data: {
      accountId,
      fillsAdded,
      tradesBuilt,
      status: errorMsg ? "error" : "ok",
      errorMsg,
    },
  });

  if (errorMsg) throw new Error(errorMsg);

  return { fillsAdded, tradesBuilt };
}
