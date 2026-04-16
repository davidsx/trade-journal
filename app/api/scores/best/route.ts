import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 10), 50);
  const trades = await prisma.trade.findMany({
    where: { qualityScore: { not: null } },
    orderBy: { qualityScore: "desc" },
    take: limit,
  });
  return NextResponse.json(trades);
}
