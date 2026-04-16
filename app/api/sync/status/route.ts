import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const log = await prisma.syncLog.findFirst({ orderBy: { syncedAt: "desc" } });
  return NextResponse.json(log ?? { status: "never" });
}
