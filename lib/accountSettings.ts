import { prisma } from "@/lib/db/prisma";
import { getActiveAccountId } from "@/lib/activeAccount";
import { DEFAULT_INITIAL_BALANCE } from "@/lib/accountConstants";

export type AccountSettingsDTO = {
  initialBalance: number;
  accountId: number;
  accountName: string;
};

/**
 * Starting capital and display name: always read from the `Account` row (no separate settings table).
 */
export async function getAccountSettings(): Promise<AccountSettingsDTO> {
  const accountId = await getActiveAccountId();
  const acc = await prisma.account.findUnique({ where: { id: accountId } });
  if (!acc) {
    return {
      initialBalance: DEFAULT_INITIAL_BALANCE,
      accountId,
      accountName: "Account",
    };
  }
  return {
    initialBalance: acc.initialBalance,
    accountId: acc.id,
    accountName: acc.name,
  };
}
