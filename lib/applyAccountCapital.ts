import { prisma } from "@/lib/db/prisma";
import { finalizeCsvAccountCapital } from "@/lib/import/csvAccountServer";
import { MAX_INITIAL_BALANCE } from "@/lib/accountConstants";

const MIN = 0;

/**
 * Persists `initialBalance` on the account and recomputes running capital for its
 * trades. Use after changing starting capital.
 *
 * @param _appOrigin - retained for call-site compatibility; no longer used.
 */
export async function applyAccountInitialBalance(
  accountId: number,
  initialBalance: number,
  _appOrigin?: string
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
  await finalizeCsvAccountCapital(rounded, accountId);
}
