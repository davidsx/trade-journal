"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { ACTIVE_ACCOUNT_COOKIE, getActiveAccountId } from "@/lib/activeAccount";
import { prisma } from "@/lib/db/prisma";
import { DEFAULT_INITIAL_BALANCE, MAX_INITIAL_BALANCE } from "@/lib/accountConstants";
import { applyAccountInitialBalance } from "@/lib/applyAccountCapital";
import { getRequestOriginFromHeaders } from "@/lib/requestOrigin";

const COOKIE_OPTIONS = {
  path: "/",
  maxAge: 60 * 60 * 24 * 400,
  sameSite: "lax" as const,
  httpOnly: true,
};

function revalidateAll() {
  revalidatePath("/", "layout");
}

export async function switchAccountAction(accountId: number) {
  const acc = await prisma.account.findUnique({ where: { id: accountId } });
  if (!acc) return { error: "Account not found" };
  (await cookies()).set(ACTIVE_ACCOUNT_COOKIE, String(accountId), COOKIE_OPTIONS);
  revalidateAll();
  return { ok: true as const };
}

export async function createAccountAction(name: string) {
  const n = name.trim();
  if (!n) return { error: "Name is required" };
  if (n.length > 120) return { error: "Name is too long (max 120 characters)" };
  const a = await prisma.account.create({
    data: { name: n, initialBalance: DEFAULT_INITIAL_BALANCE },
  });
  (await cookies()).set(ACTIVE_ACCOUNT_COOKIE, String(a.id), COOKIE_OPTIONS);
  revalidateAll();
  return { ok: true as const, id: a.id };
}

export async function renameAccountAction(accountId: number, name: string) {
  const n = name.trim();
  if (!n) return { error: "Name is required" };
  if (n.length > 120) return { error: "Name is too long" };
  const exists = await prisma.account.findUnique({ where: { id: accountId } });
  if (!exists) return { error: "Account not found" };
  await prisma.account.update({ where: { id: accountId }, data: { name: n } });
  revalidateAll();
  return { ok: true as const };
}

export async function deleteAccountAction(accountId: number) {
  const total = await prisma.account.count();
  if (total <= 1) {
    return { error: "You cannot delete the only account. Create another account first." };
  }
  const current = await getActiveAccountId();
  const victim = await prisma.account.findUnique({ where: { id: accountId } });
  if (!victim) return { error: "Account not found" };

  await prisma.account.delete({ where: { id: accountId } });

  if (current === accountId) {
    const other = await prisma.account.findFirst({ orderBy: { id: "asc" } });
    if (other) {
      (await cookies()).set(ACTIVE_ACCOUNT_COOKIE, String(other.id), COOKIE_OPTIONS);
    }
  }
  revalidateAll();
  return { ok: true as const };
}

export async function updateAccountInitialBalanceAction(accountId: number, initialBalance: number) {
  if (!Number.isFinite(initialBalance) || initialBalance <= 0) {
    return { error: "Starting capital must be a positive number" };
  }
  if (initialBalance > MAX_INITIAL_BALANCE) {
    return { error: `Starting capital may not exceed ${MAX_INITIAL_BALANCE.toLocaleString()}` };
  }
  const exists = await prisma.account.findUnique({ where: { id: accountId } });
  if (!exists) return { error: "Account not found" };
  const origin = await getRequestOriginFromHeaders();
  try {
    await applyAccountInitialBalance(accountId, Math.round(initialBalance), origin);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Update failed" };
  }
  revalidateAll();
  return { ok: true as const };
}
