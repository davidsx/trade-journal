import type { Prisma } from "@/app/generated/prisma/client";

/** All trade queries must scope by the active (or chosen) account. */
export function tradesWhere(accountId: number, base: Prisma.TradeWhereInput = {}): Prisma.TradeWhereInput {
  return { ...base, accountId };
}
