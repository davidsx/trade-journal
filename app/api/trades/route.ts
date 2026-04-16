import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 500);
  const offset = Number(searchParams.get("offset") ?? 0);
  const contract = searchParams.get("contract");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: Record<string, unknown> = {};
  if (contract) where.contractName = contract;
  if (from || to) {
    where.entryTime = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }

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
