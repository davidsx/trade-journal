import { prisma } from "@/lib/db/prisma";
import { warmCandleCacheForScoring } from "@/lib/candles/warmForScoring";
import { finalizeCsvAccountScoring } from "@/lib/import/csvAccountServer";
import { MAX_INITIAL_BALANCE } from "@/lib/accountConstants";

const MIN = 0;

/**
 * Persists `initialBalance` on the account, warms the candle range for that account’s
 * trades, and re-runs scoring. Use after changing starting capital.
 */
export async function applyAccountInitialBalance(
  accountId: number,
  initialBalance: number,
  appOrigin: string
): Promise<void> {
  if (!Number.isFinite(initialBalance) || initialBalance <= MIN) {
    throw new Error("Initial balance must be a positive number");
  }
  if (initialBalance > MAX_INITIAL_BALANCE) {
    throw new Error(`Initial balance may not exceed ${MAX_INITIAL_BALANCE.toLocaleString()}`);
  }
  const exists = await prisma.account.findUnique({ where: { id: accountId } });
  if (!exists) {
    throw new Error("Account not found");
  }
  const rounded = Math.round(initialBalance);
  await prisma.account.update({
    where: { id: accountId },
    data: { initialBalance: rounded },
  });
  await warmCandleCacheForScoring(appOrigin, accountId);
  await finalizeCsvAccountScoring(rounded, accountId);
}
