import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import { DEFAULT_ACCOUNT_ID } from "@/lib/accountConstants";

export const ACTIVE_ACCOUNT_COOKIE = "activeAccountId";

/**
 * Resolves the account for this request: cookie, else first account in DB, else 1.
 * Must only be called from a Server Component, Server Action, or Route Handler.
 */
export async function getActiveAccountId(): Promise<number> {
  const store = await cookies();
  const raw = store.get(ACTIVE_ACCOUNT_COOKIE)?.value;
  const parsed = raw ? parseInt(raw, 10) : NaN;
  if (Number.isInteger(parsed) && parsed > 0) {
    const a = await prisma.account.findUnique({ where: { id: parsed } });
    if (a) return a.id;
  }
  const first = await prisma.account.findFirst({ orderBy: { id: "asc" } });
  return first?.id ?? DEFAULT_ACCOUNT_ID;
}

export async function getActiveAccount(): Promise<{ id: number; name: string }> {
  const id = await getActiveAccountId();
  const a = await prisma.account.findUnique({ where: { id } });
  if (a) return { id: a.id, name: a.name };
  const first = await prisma.account.findFirst({ orderBy: { id: "asc" } });
  return { id: first?.id ?? DEFAULT_ACCOUNT_ID, name: first?.name ?? "Default" };
}
