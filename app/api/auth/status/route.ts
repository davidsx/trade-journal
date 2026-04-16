import { NextResponse } from "next/server";
import { getTokenCache } from "@/lib/tradovate/auth";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const cache = getTokenCache();
  if (cache) {
    return NextResponse.json({
      connected: cache.expiresAt > new Date(),
      accountId: cache.accountId,
      expiresAt: cache.expiresAt.toISOString(),
    });
  }

  // Check DB for persisted token
  const stored = await prisma.authToken.findFirst({
    orderBy: { updatedAt: "desc" },
  });
  if (stored) {
    return NextResponse.json({
      connected: stored.expiresAt > new Date(),
      accountId: stored.accountId,
      expiresAt: stored.expiresAt.toISOString(),
    });
  }

  return NextResponse.json({ connected: false, accountId: null, expiresAt: null });
}
