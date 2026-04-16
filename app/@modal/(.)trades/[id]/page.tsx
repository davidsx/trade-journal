import { notFound } from "next/navigation";
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
  const trade = await prisma.trade.findUnique({ where: { id } });
  if (!trade) notFound();

  const dayCandles = loadDayCandles(new Date(trade.entryTime));

  return (
    <TradeModal>
      <TradeDetail trade={trade} dayCandles={dayCandles} />
    </TradeModal>
  );
}
