import { prisma } from "@/lib/db/prisma";
import { defaultCandlePeriodUnix } from "@/lib/candleRange";

const BUFFER_BEFORE_SEC = 2 * 24 * 60 * 60;
const BUFFER_AFTER_SEC = 24 * 60 * 60;

/**
 * Unix range [period1, period2] covering all trades (with buffers), capped at now.
 * Falls back to a short rolling window when there are no trades.
 */
export async function getCandleFetchRangeFromTrades(): Promise<{
  period1: string;
  period2: string;
  tradeCount: number;
}> {
  const [agg, count] = await Promise.all([
    prisma.trade.aggregate({
      _min: { entryTime: true },
      _max: { exitTime: true },
    }),
    prisma.trade.count(),
  ]);

  if (
    count === 0 ||
    !agg._min.entryTime ||
    !agg._max.exitTime
  ) {
    const d = defaultCandlePeriodUnix();
    return { ...d, tradeCount: 0 };
  }

  const minSec = Math.floor(new Date(agg._min.entryTime).getTime() / 1000);
  const maxSec = Math.ceil(new Date(agg._max.exitTime).getTime() / 1000);
  const nowSec = Math.floor(Date.now() / 1000);

  const p1 = minSec - BUFFER_BEFORE_SEC;
  const p2 = Math.min(nowSec, maxSec + BUFFER_AFTER_SEC);
  const safeP2 = p2 > p1 ? p2 : p1 + 3600;

  return {
    period1: String(p1),
    period2: String(safeP2),
    tradeCount: count,
  };
}
