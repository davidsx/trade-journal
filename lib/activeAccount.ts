import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import { DEFAULT_ACCOUNT_ID } from "@/lib/accountConstants";

export const ACTIVE_ACCOUNT_COOKIE = "activeAccountId";

/**
 * Default account when no (valid, selectable) cookie is set: the most recent
 * account **with trades** that is not hidden from stats (highest id). Falls back
 * to the most recent non-hidden account, then any account.
 */
export async function resolveDefaultAccountId(): Promise<number> {
  const withTrades = await prisma.account.findFirst({
    where: { hiddenFromStats: false, trades: { some: {} } },
    orderBy: { id: "desc" },
    select: { id: true },
  });
  if (withTrades) return withTrades.id;
  const visible = await prisma.account.findFirst({
    where: { hiddenFromStats: false },
    orderBy: { id: "desc" },
    select: { id: true },
  });
  if (visible) return visible.id;
  const any = await prisma.account.findFirst({ orderBy: { id: "asc" }, select: { id: true } });
  return any?.id ?? DEFAULT_ACCOUNT_ID;
}

/**
 * Resolves the account for this request: the cookie if it points to a valid,
 * non-hidden account; otherwise {@link resolveDefaultAccountId}. Hidden accounts
 * are never active — they can't be selected.
 * Must only be called from a Server Component, Server Action, or Route Handler.
 */
export async function getActiveAccountId(): Promise<number> {
  const store = await cookies();
  const raw = store.get(ACTIVE_ACCOUNT_COOKIE)?.value;
  const parsed = raw ? parseInt(raw, 10) : NaN;
  if (Number.isInteger(parsed) && parsed > 0) {
    const a = await prisma.account.findUnique({ where: { id: parsed } });
    if (a && !a.hiddenFromStats) return a.id;
  }
  return resolveDefaultAccountId();
}

export async function getActiveAccount(): Promise<{ id: number; name: string }> {
  const id = await getActiveAccountId();
  const a = await prisma.account.findUnique({ where: { id }, select: { id: true, name: true } });
  if (a) return a;
  return { id: DEFAULT_ACCOUNT_ID, name: "Default" };
}
