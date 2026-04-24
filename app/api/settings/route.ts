import { NextRequest, NextResponse } from "next/server";
import { getAccountSettings, upsertAccountSettings } from "@/lib/accountSettings";
import { warmCandleCacheForScoring } from "@/lib/candles/warmForScoring";
import { finalizeCsvAccountScoring } from "@/lib/import/csvAccountServer";

export const runtime = "nodejs";

export async function GET() {
  const settings = await getAccountSettings();
  return NextResponse.json(settings);
}

export async function PATCH(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const initialBalance = Number(b.initialBalance);

  if (!Number.isFinite(initialBalance) || initialBalance <= 0) {
    return NextResponse.json({ error: "initialBalance must be a positive number" }, { status: 400 });
  }

  await upsertAccountSettings({ initialBalance });
  await warmCandleCacheForScoring(req.nextUrl.origin);
  await finalizeCsvAccountScoring(initialBalance);

  const settings = await getAccountSettings();
  return NextResponse.json(settings);
}
