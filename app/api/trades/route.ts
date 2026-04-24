import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/app/generated/prisma/client";
import { getActiveAccountId } from "@/lib/activeAccount";
import { tradesWhere } from "@/lib/accountScope";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 500);
  const offset = Number(searchParams.get("offset") ?? 0);
  const contract = searchParams.get("contract");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const filter: Prisma.TradeWhereInput = {};
  if (contract) filter.contractName = contract;
  if (from || to) {
    filter.entryTime = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }
  const accountId = await getActiveAccountId();
  const where = tradesWhere(accountId, filter);

  const [trades, total] = await Promise.all([
    prisma.trade.findMany({
      where,
      orderBy: { entryTime: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.trade.count({ where }),
  ]);

  return NextResponse.json({ trades, total, limit, offset });
}
