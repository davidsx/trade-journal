import { NextResponse } from "next/server";
import { getActiveAccountId } from "@/lib/activeAccount";
import { tradesWhere } from "@/lib/accountScope";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const accountId = await getActiveAccountId();
    await prisma.trade.count({ where: tradesWhere(accountId) });
    return NextResponse.json({ status: "ok", database: true });
  } catch {
    return NextResponse.json({ status: "error", database: false }, { status: 503 });
  }
}
