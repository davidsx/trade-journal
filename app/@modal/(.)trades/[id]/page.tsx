import { notFound } from "next/navigation";
import { getActiveAccountId } from "@/lib/activeAccount";
import { tradesWhere } from "@/lib/accountScope";
import { prisma } from "@/lib/db/prisma";
import TradeModal from "@/components/TradeModal";
import TradeDetail from "@/components/TradeDetail";
import { loadDayCandles } from "@/lib/analytics/loadDayCandles";

export default async function TradeModalPage({
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
    <TradeModal>
      <TradeDetail trade={trade} dayCandles={dayCandles} />
    </TradeModal>
  );
}
