import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const trades = await prisma.trade.findMany({
    select: { qualityScore: true },
    where: { qualityScore: { not: null } },
  });

  const buckets = Array.from({ length: 10 }, (_, i) => ({
    range: `${i * 10}–${i * 10 + 9}`,
    min: i * 10,
    max: i * 10 + 9,
    count: 0,
  }));

  for (const t of trades) {
    const idx = Math.min(Math.floor((t.qualityScore ?? 0) / 10), 9);
    buckets[idx].count++;
  }

  return NextResponse.json(buckets);
}
