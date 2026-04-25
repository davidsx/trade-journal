import { notFound } from "next/navigation";
import { getActiveAccountId } from "@/lib/activeAccount";
import { tradesWhere } from "@/lib/accountScope";
import { prisma } from "@/lib/db/prisma";
import Link from "next/link";
import TradeDetail from "@/components/TradeDetail";
import { loadDayCandles } from "@/lib/analytics/loadDayCandles";

export default async function TradeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const accountId = await getActiveAccountId();
  const trade = await prisma.trade.findFirst({ where: tradesWhere(accountId, { id }) });
  if (!trade) notFound();

  const dayCandles = await loadDayCandles(new Date(trade.entryTime));

  return (
    <div className="max-w-2xl space-y-2">
      <Link href="/trades" className="text-sm" style={{ color: "var(--text-muted)" }}>
        ← Trades
      </Link>
      <TradeDetail trade={trade} dayCandles={dayCandles} />
    </div>
  );
}
