import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { CSV_ACCOUNT_ID } from "@/lib/import/csvAccountServer";

export const runtime = "nodejs";

export const maxDuration = 60;

const MAX_IDS = 50_000;

type Body = { csvIds: string[] };

/** Count how many of the given trade ids already exist (call once before parallel upserts). */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const csvIds = Array.isArray(body.csvIds) ? body.csvIds : [];
    if (csvIds.length === 0) {
      return NextResponse.json({ error: "csvIds array required" }, { status: 400 });
    }
    if (csvIds.length > MAX_IDS) {
      return NextResponse.json({ error: `At most ${MAX_IDS} ids` }, { status: 400 });
    }

    const replacedCount = await prisma.trade.count({
      where: { accountId: CSV_ACCOUNT_ID, id: { in: csvIds } },
    });

    return NextResponse.json({ replacedCount });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Overlap query failed" },
      { status: 500 }
    );
  }
}
