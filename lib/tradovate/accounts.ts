import { tradovateGet } from "./client";

export interface TradovateAccount {
  id: number;
  name: string;
  userId: number;
  accountType: string;
  active: boolean;
  clearingHouseId: number;
  riskCategoryId: number;
  autoLiqProfileId: number;
  marginAccountType: string;
  legalStatus: string;
  timestamp: string;
}

export async function fetchAccounts(): Promise<TradovateAccount[]> {
  return tradovateGet<TradovateAccount[]>("/account/list");
}
