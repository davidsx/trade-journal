import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    await prisma.trade.count();
    return NextResponse.json({ status: "ok", database: true });
  } catch {
    return NextResponse.json({ status: "error", database: false }, { status: 503 });
  }
}
