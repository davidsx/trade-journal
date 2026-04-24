import { NextRequest, NextResponse } from "next/server";
import { getAccountSettings } from "@/lib/accountSettings";
import { getActiveAccountId } from "@/lib/activeAccount";
import { applyAccountInitialBalance } from "@/lib/applyAccountCapital";

export const runtime = "nodejs";

export async function GET() {
  const settings = await getAccountSettings();
  return NextResponse.json({
    initialBalance: settings.initialBalance,
    accountId: settings.accountId,
    accountName: settings.accountName,
  });
}

export async function PATCH(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const initialBalance = Number(b.initialBalance);

  if (!Number.isFinite(initialBalance) || initialBalance <= 0) {
    return NextResponse.json({ error: "initialBalance must be a positive number" }, { status: 400 });
  }

  const activeId = await getActiveAccountId();
  try {
    await applyAccountInitialBalance(activeId, initialBalance, req.nextUrl.origin);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const settings = await getAccountSettings();
  return NextResponse.json({
    initialBalance: settings.initialBalance,
    accountId: settings.accountId,
    accountName: settings.accountName,
  });
}
