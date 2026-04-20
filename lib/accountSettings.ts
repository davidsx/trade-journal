import { prisma } from "@/lib/db/prisma";
import { DEFAULT_INITIAL_BALANCE } from "@/lib/accountConstants";

export type AccountSettingsDTO = {
  initialBalance: number;
};

export async function getAccountSettings(): Promise<AccountSettingsDTO> {
  const row = await prisma.accountSettings.findUnique({ where: { id: 1 } });
  if (!row) {
    return { initialBalance: DEFAULT_INITIAL_BALANCE };
  }
  return {
    initialBalance: row.initialBalance,
  };
}

export async function upsertAccountSettings(data: { initialBalance: number }): Promise<AccountSettingsDTO> {
  const row = await prisma.accountSettings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      initialBalance: data.initialBalance,
    },
    update: {
      initialBalance: data.initialBalance,
    },
  });
  return {
    initialBalance: row.initialBalance,
  };
}
