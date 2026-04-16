import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const trade = await prisma.trade.findUnique({ where: { id } });
  if (!trade) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({
    ...trade,
    scoreNotes: trade.scoreNotes ? JSON.parse(trade.scoreNotes) : [],
  });
}
