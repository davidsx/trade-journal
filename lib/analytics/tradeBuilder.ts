import type { FillModel as Fill } from "@/app/generated/prisma/models";

// Point value per contract (dollars per point)
export const POINT_VALUES: Record<string, number> = {
  NQ: 20,
  MNQ: 2,
  ES: 50,
  MES: 5,
  CL: 1000,
  GC: 100,
  YM: 5,
  MYM: 0.5,
  RTY: 50,
  M2K: 10,
};

function getPointValue(contractName: string): number {
  // Strip expiry suffix (e.g. "NQM5" → "NQ")
  const base = contractName.replace(/[A-Z]\d+$/, "");
  return POINT_VALUES[base] ?? 1;
}

interface OpenLot {
  price: number;
  qty: number;
  fillId: string;
  time: Date;
  fees: number;
}

export interface TradeBuildInput {
  id: string;
  accountId: number;
  contractId: number;
  contractName: string;
  action: string;
  qty: number;
  price: number;
  fees: number;
  timestamp: Date;
  orderId: string;
}

export interface BuiltTrade {
  accountId: number;
  contractId: number;
  contractName: string;
  direction: string;
  qty: number;
  entryFillId: string;
  exitFillId: string;
  entryPrice: number;
  exitPrice: number;
  entryTime: Date;
  exitTime: Date;
  holdingMins: number;
  grossPnl: number;
  fees: number;
  netPnl: number;
  rMultiple: number | null;
  qualityScore: number | null;
  entryScore: number | null;
  exitScore: number | null;
  riskScore: number | null;
  scoreNotes: string | null;
  capitalBefore: number;
  capitalAfter: number;
}

export function buildTrades(fills: Fill[], accountId: number): BuiltTrade[] {
  // Group by contractId
  const byContract = new Map<number, Fill[]>();
  for (const fill of fills) {
    if (!byContract.has(fill.contractId)) byContract.set(fill.contractId, []);
    byContract.get(fill.contractId)!.push(fill);
  }

  const trades: BuiltTrade[] = [];
  // Running capital — starts at 50,000 (demo default); updated as trades are built
  let runningCapital = 50_000;

  for (const [, contractFills] of byContract) {
    // Sort chronologically
    contractFills.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const longLots: OpenLot[] = [];  // open buy lots
    const shortLots: OpenLot[] = []; // open sell lots
    let positionQty = 0; // positive = long, negative = short

    for (const fill of contractFills) {
      const pointValue = getPointValue(fill.contractName);

      if (fill.action === "Buy") {
        if (positionQty >= 0) {
          // Adding to or opening a long
          longLots.push({
            price: fill.price,
            qty: fill.qty,
            fillId: fill.id,
            time: fill.timestamp,
            fees: fill.fees,
          });
          positionQty += fill.qty;
        } else {
          // Closing short position
          let remaining = fill.qty;
          while (remaining > 0 && shortLots.length > 0) {
            const lot = shortLots[0];
            const matched = Math.min(remaining, lot.qty);
            const grossPnl = (lot.price - fill.price) * matched * pointValue;
            const fees = (lot.fees / lot.qty) * matched + (fill.fees / fill.qty) * matched;
            const capitalBefore = runningCapital;
            runningCapital += grossPnl - fees;

            trades.push({
              accountId,
              contractId: fill.contractId,
              contractName: fill.contractName,
              direction: "Short",
              qty: matched,
              entryFillId: lot.fillId,
              exitFillId: fill.id,
              entryPrice: lot.price,
              exitPrice: fill.price,
              entryTime: lot.time,
              exitTime: fill.timestamp,
              holdingMins: (fill.timestamp.getTime() - lot.time.getTime()) / 60_000,
              grossPnl,
              fees,
              netPnl: grossPnl - fees,
              rMultiple: null,
              qualityScore: null,
              entryScore: null,
              exitScore: null,
              riskScore: null,
              scoreNotes: null,
              capitalBefore,
              capitalAfter: runningCapital,
            });

            if (matched < lot.qty) {
              shortLots[0] = { ...lot, qty: lot.qty - matched };
            } else {
              shortLots.shift();
            }
            remaining -= matched;
          }
          positionQty += fill.qty;
          // If qty flipped to long, push remainder as new long lots
          if (remaining > 0) {
            longLots.push({
              price: fill.price,
              qty: remaining,
              fillId: fill.id,
              time: fill.timestamp,
              fees: fill.fees,
            });
          }
        }
      } else {
        // action === "Sell"
        if (positionQty <= 0) {
          // Adding to or opening a short
          shortLots.push({
            price: fill.price,
            qty: fill.qty,
            fillId: fill.id,
            time: fill.timestamp,
            fees: fill.fees,
          });
          positionQty -= fill.qty;
        } else {
          // Closing long position
          let remaining = fill.qty;
          while (remaining > 0 && longLots.length > 0) {
            const lot = longLots[0];
            const matched = Math.min(remaining, lot.qty);
            const grossPnl = (fill.price - lot.price) * matched * pointValue;
            const fees = (lot.fees / lot.qty) * matched + (fill.fees / fill.qty) * matched;
            const capitalBefore = runningCapital;
            runningCapital += grossPnl - fees;

            trades.push({
              accountId,
              contractId: fill.contractId,
              contractName: fill.contractName,
              direction: "Long",
              qty: matched,
              entryFillId: lot.fillId,
              exitFillId: fill.id,
              entryPrice: lot.price,
              exitPrice: fill.price,
              entryTime: lot.time,
              exitTime: fill.timestamp,
              holdingMins: (fill.timestamp.getTime() - lot.time.getTime()) / 60_000,
              grossPnl,
              fees,
              netPnl: grossPnl - fees,
              rMultiple: null,
              qualityScore: null,
              entryScore: null,
              exitScore: null,
              riskScore: null,
              scoreNotes: null,
              capitalBefore,
              capitalAfter: runningCapital,
            });

            if (matched < lot.qty) {
              longLots[0] = { ...lot, qty: lot.qty - matched };
            } else {
              longLots.shift();
            }
            remaining -= matched;
          }
          positionQty -= fill.qty;
          // If flipped to short, push remainder
          if (remaining > 0) {
            shortLots.push({
              price: fill.price,
              qty: remaining,
              fillId: fill.id,
              time: fill.timestamp,
              fees: fill.fees,
            });
          }
        }
      }
    }
  }

  // Sort final trade list by entryTime
  trades.sort((a, b) => a.entryTime.getTime() - b.entryTime.getTime());

  // Recompute capitalBefore/After sequentially after sorting
  let capital = 50_000;
  for (const t of trades) {
    t.capitalBefore = capital;
    capital += t.netPnl;
    t.capitalAfter = capital;
  }

  return trades;
}
