/** Serialized trade row for the dashboard trading calendar and day-detail modal. */
export type CalendarDayTrade = {
  id: string;
  contractName: string;
  direction: string;
  entryTime: string;
  exitTime: string;
  entryPrice: number;
  exitPrice: number;
  netPnl: number;
  holdingMins: number;
  qualityScore: number | null;
};
