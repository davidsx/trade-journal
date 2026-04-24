import { NextResponse } from "next/server";
import { getActiveAccountId } from "@/lib/activeAccount";
import { tradesWhere } from "@/lib/accountScope";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

export async function POST() {
  try {
    const accountId = await getActiveAccountId();
    const result = await prisma.trade.deleteMany({ where: tradesWhere(accountId) });
    return NextResponse.json({ deleted: result.count });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete trades" },
      { status: 500 }
    );
  }
}
