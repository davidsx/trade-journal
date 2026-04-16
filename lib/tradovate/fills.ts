import { tradovateGet } from "./client";

export interface TradovateFill {
  id: number;
  orderId: number;
  contractId: number;
  timestamp: string;
  tradeDate: { year: number; month: number; day: number };
  action: "Buy" | "Sell";
  qty: number;
  price: number;
  active: boolean;
  finallyPaired: number;
}

export interface TradovateFillFee {
  id: number;
  fillId: number;
  amount: number;
  currency: string;
  tradeDate: { year: number; month: number; day: number };
  createTimestamp: string;
}

export interface TradovateContract {
  id: number;
  name: string;
  contractMaturityId: number;
}

export interface EnrichedFill {
  id: string;
  accountId: number;
  contractId: number;
  contractName: string;
  action: "Buy" | "Sell";
  qty: number;
  price: number;
  fees: number;
  timestamp: Date;
  orderId: string;
  tradeDate: string;
}

export async function fetchFills(
  accountId: number,
  since?: Date
): Promise<EnrichedFill[]> {
  const PAGE_SIZE = 100;
  let skip = 0;
  const allFills: TradovateFill[] = [];

  while (true) {
    const page = await tradovateGet<TradovateFill[]>("/fill/list", {
      limit: PAGE_SIZE,
      skip,
    });
    if (!page || page.length === 0) break;
    allFills.push(...page);
    if (page.length < PAGE_SIZE) break;
    skip += PAGE_SIZE;
  }

  // Filter by since date if provided
  const filtered = since
    ? allFills.filter((f) => new Date(f.timestamp) > since)
    : allFills;

  if (filtered.length === 0) return [];

  // Fetch fee data
  const allFees: TradovateFillFee[] = [];
  for (let s = 0; s < filtered.length; s += PAGE_SIZE) {
    const chunk = await tradovateGet<TradovateFillFee[]>("/fillFee/list", {
      limit: PAGE_SIZE,
      skip: s,
    });
    if (chunk && chunk.length > 0) allFees.push(...chunk);
    if (!chunk || chunk.length < PAGE_SIZE) break;
  }

  const feeByFillId = new Map<number, number>();
  for (const fee of allFees) {
    feeByFillId.set(fee.fillId, (feeByFillId.get(fee.fillId) ?? 0) + fee.amount);
  }

  // Fetch contract names for all unique contractIds
  const contractIds = [...new Set(filtered.map((f) => f.contractId))];
  const contractNameById = new Map<number, string>();
  for (const cid of contractIds) {
    try {
      const contract = await tradovateGet<TradovateContract>(`/contract/item`, {
        id: cid,
      });
      contractNameById.set(cid, contract.name);
    } catch {
      contractNameById.set(cid, `CONTRACT_${cid}`);
    }
  }

  return filtered.map((f) => {
    const td = f.tradeDate;
    const tradeDateStr = `${td.year}-${String(td.month).padStart(2, "0")}-${String(td.day).padStart(2, "0")}`;
    return {
      id: String(f.id),
      accountId,
      contractId: f.contractId,
      contractName: contractNameById.get(f.contractId) ?? `CONTRACT_${f.contractId}`,
      action: f.action,
      qty: f.qty,
      price: f.price,
      fees: feeByFillId.get(f.id) ?? 0,
      timestamp: new Date(f.timestamp),
      orderId: String(f.orderId),
      tradeDate: tradeDateStr,
    };
  });
}
