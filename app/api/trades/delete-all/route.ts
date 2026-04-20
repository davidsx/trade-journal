import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

export async function POST() {
  try {
    const result = await prisma.trade.deleteMany({});
    return NextResponse.json({ deleted: result.count });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete trades" },
      { status: 500 }
    );
  }
}
