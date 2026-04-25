import { getActiveAccountId } from "@/lib/activeAccount";
import { tradesWhere } from "@/lib/accountScope";
import { prisma } from "@/lib/db/prisma";
import { defaultCandlePeriodUnix } from "@/lib/candleRange";

export const CANDLE_TRADE_BUFFER_BEFORE_SEC = 2 * 24 * 60 * 60;
export const CANDLE_TRADE_BUFFER_AFTER_SEC = 24 * 60 * 60;

const BUFFER_BEFORE_SEC = CANDLE_TRADE_BUFFER_BEFORE_SEC;
const BUFFER_AFTER_SEC = CANDLE_TRADE_BUFFER_AFTER_SEC;

/**
 * Same unix range as {@link getCandleFetchRangeFromTrades} but from an in-memory trade list
 * (used by the quality scorer to resolve candles without a DB round-trip).
 */
export function getCandlePeriodFromTradesInMemory(
  trades: { entryTime: Date; exitTime: Date }[]
): { period1: string; period2: string; tradeCount: number } {
  if (trades.length === 0) {
    const d = defaultCandlePeriodUnix();
    return { ...d, tradeCount: 0 };
  }
  let minSec = Infinity;
  let maxSec = -Infinity;
  for (const t of trades) {
    const e1 = Math.floor(t.entryTime.getTime() / 1000);
    const e2 = Math.ceil(t.exitTime.getTime() / 1000);
    if (e1 < minSec) minSec = e1;
    if (e2 > maxSec) maxSec = e2;
  }
  const nowSec = Math.floor(Date.now() / 1000);
  const p1 = minSec - BUFFER_BEFORE_SEC;
  const p2 = Math.min(nowSec, maxSec + BUFFER_AFTER_SEC);
  const safeP2 = p2 > p1 ? p2 : p1 + 3600;
  return {
    period1: String(p1),
    period2: String(safeP2),
    tradeCount: trades.length,
  };
}

/**
 * Unix range [period1, period2] covering all trades (with buffers), capped at now.
 * Falls back to a short rolling window when there are no trades.
 * @param accountId - defaults to the active (cookie) account
 */
export async function getCandleFetchRangeFromTrades(
  accountIdParam?: number
): Promise<{
  period1: string;
  period2: string;
  tradeCount: number;
}> {
  const accountId = accountIdParam ?? (await getActiveAccountId());
  const [agg, count] = await Promise.all([
    prisma.trade.aggregate({
      where: tradesWhere(accountId),
      _min: { entryTime: true },
      _max: { exitTime: true },
    }),
    prisma.trade.count({ where: tradesWhere(accountId) }),
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
