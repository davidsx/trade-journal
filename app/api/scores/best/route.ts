import { NextRequest, NextResponse } from "next/server";
import { getActiveAccountId } from "@/lib/activeAccount";
import { tradesWhere } from "@/lib/accountScope";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 10), 50);
  const accountId = await getActiveAccountId();
  const trades = await prisma.trade.findMany({
    where: tradesWhere(accountId, { qualityScore: { not: null } }),
    orderBy: { qualityScore: "desc" },
    take: limit,
  });
  return NextResponse.json(trades);
}
