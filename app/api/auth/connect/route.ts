import { NextResponse } from "next/server";
import { requestAccessToken } from "@/lib/tradovate/auth";
import { startAutoRenewal } from "@/lib/tradovate/auth";

export async function POST() {
  try {
    const token = await requestAccessToken();
    startAutoRenewal();
    return NextResponse.json({
      connected: true,
      accountId: token.accountId,
      expiresAt: token.expiresAt.toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Auth failed" },
      { status: 500 }
    );
  }
}
