"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { ACTIVE_ACCOUNT_COOKIE, getActiveAccountId } from "@/lib/activeAccount";
import { prisma } from "@/lib/db/prisma";
import { MAX_INITIAL_BALANCE } from "@/lib/accountConstants";
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
  if (acc.hiddenFromStats) return { error: "This account is hidden. Unhide it on the Accounts page to select it." };
  (await cookies()).set(ACTIVE_ACCOUNT_COOKIE, String(accountId), COOKIE_OPTIONS);
  revalidateAll();
  return { ok: true as const };
}

export type CreateAccountInput = {
  name: string;
  initialBalance: number;
  cost: number;
  propfirmName: string | null;
  stage: "Eval" | "Funded";
  numberOfAccounts: number;
  description: string | null;
};

export async function createAccountAction(input: CreateAccountInput) {
  const n = input.name.trim();
  if (!n) return { error: "Name is required" };
  if (n.length > 120) return { error: "Name is too long (max 120 characters)" };
  if (!Number.isFinite(input.initialBalance) || input.initialBalance <= 0) {
    return { error: "Starting capital must be a positive number" };
  }
  if (input.initialBalance > MAX_INITIAL_BALANCE) {
    return { error: `Starting capital may not exceed ${MAX_INITIAL_BALANCE.toLocaleString()}` };
  }
  if (!Number.isFinite(input.cost) || input.cost < 0) {
    return { error: "Cost must be a non-negative number" };
  }
  const propfirmName = input.propfirmName?.trim() || null;
  if (propfirmName && propfirmName.length > 120) return { error: "Prop firm name is too long (max 120 characters)" };
  const description = input.description?.trim() || null;
  if (description && description.length > 1000) return { error: "Description is too long (max 1000 characters)" };
  if (!Number.isInteger(input.numberOfAccounts) || input.numberOfAccounts < 1) {
    return { error: "Number of accounts must be a positive whole number" };
  }
  if (input.stage !== "Eval" && input.stage !== "Funded") return { error: "Invalid stage" };

  const a = await prisma.account.create({
    data: {
      name: n,
      initialBalance: Math.round(input.initialBalance),
      cost: input.cost,
      propfirmName,
      stage: input.stage,
      numberOfAccounts: input.numberOfAccounts,
      description,
    },
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
    const other =
      (await prisma.account.findFirst({ where: { hiddenFromStats: false }, orderBy: { id: "desc" } })) ??
      (await prisma.account.findFirst({ orderBy: { id: "asc" } }));
    if (other) {
      (await cookies()).set(ACTIVE_ACCOUNT_COOKIE, String(other.id), COOKIE_OPTIONS);
    }
  }
  revalidateAll();
  return { ok: true as const };
}

export type AccountDetailsInput = {
  propfirmName: string | null;
  description: string | null;
  breached: boolean;
  numberOfAccounts: number;
  stage: "Eval" | "Funded";
  cost: number;
};

export async function updateAccountDetailsAction(accountId: number, details: AccountDetailsInput) {
  const exists = await prisma.account.findUnique({ where: { id: accountId } });
  if (!exists) return { error: "Account not found" };

  const propfirmName = details.propfirmName?.trim() || null;
  if (propfirmName && propfirmName.length > 120) return { error: "Prop firm name is too long (max 120 characters)" };
  const description = details.description?.trim() || null;
  if (description && description.length > 1000) return { error: "Description is too long (max 1000 characters)" };
  if (!Number.isInteger(details.numberOfAccounts) || details.numberOfAccounts < 1) {
    return { error: "Number of accounts must be a positive whole number" };
  }
  if (details.stage !== "Eval" && details.stage !== "Funded") return { error: "Invalid stage" };
  if (!Number.isFinite(details.cost) || details.cost < 0) {
    return { error: "Cost must be a non-negative number" };
  }

  await prisma.account.update({
    where: { id: accountId },
    data: {
      propfirmName,
      description,
      breached: details.breached,
      numberOfAccounts: details.numberOfAccounts,
      stage: details.stage,
      cost: details.cost,
    },
  });
  revalidateAll();
  return { ok: true as const };
}

export async function setAccountHiddenFromStatsAction(accountId: number, hidden: boolean) {
  const exists = await prisma.account.findUnique({ where: { id: accountId } });
  if (!exists) return { error: "Account not found" };
  await prisma.account.update({
    where: { id: accountId },
    data: { hiddenFromStats: hidden },
  });
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
