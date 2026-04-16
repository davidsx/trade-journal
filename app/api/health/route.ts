import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getTokenCache } from "@/lib/tradovate/auth";

export async function GET() {
  const lastSync = await prisma.syncLog.findFirst({
    orderBy: { syncedAt: "desc" },
  });
  const token = getTokenCache();
  return NextResponse.json({
    status: "ok",
    lastSync: lastSync?.syncedAt ?? null,
    lastSyncStatus: lastSync?.status ?? null,
    tokenValid: token ? token.expiresAt > new Date() : false,
  });
}
