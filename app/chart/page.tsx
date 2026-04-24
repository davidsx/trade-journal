import { getActiveAccountId } from "@/lib/activeAccount";
import { tradesWhere } from "@/lib/accountScope";
import { prisma } from "@/lib/db/prisma";
import type { TradeMarker, TradeLine } from "@/components/CandleChart";
import ChartClient from "@/components/ChartClient";
import RefreshCandlesButton from "@/components/RefreshCandlesButton";

export default async function ChartPage() {
  const accountId = await getActiveAccountId();
  const trades = await prisma.trade.findMany({ where: tradesWhere(accountId), orderBy: { entryTime: "asc" } });

  // Raw per-trade lines (entry → exit), used for yellow connector lines
  const tradeLines: TradeLine[] = trades.map((t) => ({
    entryTime:  Math.floor(new Date(t.entryTime).getTime() / 1000),
    entryPrice: t.entryPrice,
    exitTime:   Math.floor(new Date(t.exitTime).getTime()  / 1000),
    exitPrice:  t.exitPrice,
    pnl:        t.netPnl,
  }));

  // Group entries and exits that fall in the same minute + same direction
  type Group = {
    time: number;          // floored to minute
    type: "entry" | "exit";
    direction: "Long" | "Short";
    totalQty: number;
    totalPnl: number;
    priceSum: number;
    count: number;
  };

  const groupMap = new Map<string, Group>();

  for (const t of trades) {
    const dir = t.direction as "Long" | "Short";
    const entryMin = Math.floor(new Date(t.entryTime).getTime() / 60000) * 60;
    const exitMin  = Math.floor(new Date(t.exitTime).getTime()  / 60000) * 60;

    for (const [min, price, type, pnl] of [
      [entryMin, t.entryPrice, "entry", 0],
      [exitMin,  t.exitPrice,  "exit",  t.netPnl],
    ] as [number, number, "entry" | "exit", number][]) {
      const key = `${min}:${type}:${dir}`;
      const g = groupMap.get(key) ?? { time: min, type, direction: dir, totalQty: 0, totalPnl: 0, priceSum: 0, count: 0 };
      g.totalQty += t.qty;
      g.totalPnl += pnl;
      g.priceSum += price;
      g.count++;
      groupMap.set(key, g);
    }
  }

  const markers: TradeMarker[] = [...groupMap.values()].map((g) => {
    const avgPrice = g.priceSum / g.count;
    const label =
      g.type === "entry"
        ? `${g.direction === "Long" ? "▲" : "▼"} ${g.totalQty}`
        : g.totalPnl >= 0
        ? `+$${g.totalPnl.toFixed(0)}`
        : `-$${Math.abs(g.totalPnl).toFixed(0)}`;

    return {
      time: g.time,
      price: avgPrice,
      direction: g.direction,
      type: g.type,
      pnl: g.type === "exit" ? g.totalPnl : undefined,
      label,
    };
  });

  markers.sort((a, b) => a.time - b.time);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-semibold">Chart</h1>
        <RefreshCandlesButton />
        <div className="text-xs space-x-3" style={{ color: "var(--text-muted)" }}>
          <span>
            <span style={{ color: "#22c55e" }}>▲</span> long entry
          </span>
          <span>
            <span style={{ color: "#ef4444" }}>▼</span> short entry
          </span>
          <span>
            <span style={{ color: "#38bdf8" }}>●</span> exit
          </span>
        </div>
      </div>

      <div
        className="rounded-lg p-4"
        style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)" }}
      >
        <ChartClient markers={markers} tradeLines={tradeLines} tradeCount={trades.length} />
      </div>

    </div>
  );
}
