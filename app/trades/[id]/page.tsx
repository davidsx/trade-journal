import { notFound } from "next/navigation";
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
  const trade = await prisma.trade.findUnique({ where: { id } });
  if (!trade) notFound();

  const dayCandles = loadDayCandles(new Date(trade.entryTime));

  return (
    <div className="max-w-2xl space-y-2">
      <Link href="/trades" className="text-sm" style={{ color: "var(--text-muted)" }}>
        ← Trades
      </Link>
      <TradeDetail trade={trade} dayCandles={dayCandles} />
    </div>
  );
}
