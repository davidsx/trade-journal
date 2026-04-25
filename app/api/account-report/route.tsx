import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { AccountReportDocument } from "@/lib/pdf/AccountReportDocument";
import { buildAccountReportPayload } from "@/lib/pdf/buildAccountReportPayload";
import { getActiveAccountId } from "@/lib/activeAccount";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("accountId");
  let accountId: number;
  if (q != null && q !== "") {
    const n = parseInt(q, 10);
    if (!Number.isInteger(n) || n < 1) {
      return NextResponse.json({ error: "Invalid accountId" }, { status: 400 });
    }
    const acc = await prisma.account.findUnique({ where: { id: n } });
    if (!acc) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }
    accountId = n;
  } else {
    accountId = await getActiveAccountId();
  }

  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const payload = await buildAccountReportPayload(accountId);
  const buffer = await renderToBuffer(
    <AccountReportDocument data={payload} />,
  );
  const day = new Date().toISOString().slice(0, 10);
  const safe =
    account.name
      .replace(/[^\w\-. ()]+/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60) || "account";
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="trade-journal-${safe}-${day}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
