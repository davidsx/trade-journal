import type { TradeModel as Trade } from "@/app/generated/prisma/models";
import { getEntrySessionName, type SessionName } from "@/lib/analytics/patterns";
import { tradingDayWeekdayIndexHkt } from "@/lib/tradingDay";

const HKT_OFFSET_MS = 8 * 60 * 60 * 1000;

const SESSION_ORDER: { session: SessionName; hktRange: string }[] = [
  { session: "Asia", hktRange: "8:00am – 4:00pm" },
  { session: "London", hktRange: "4:00pm – 9:30pm" },
  { session: "NY", hktRange: "9:30pm – 5:00am" },
  { session: "Off-hours", hktRange: "5:00am – 8:00am" },
];

const DOW_HKT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function aggBucket() {
  return {
    tradeCount: 0,
    scoredCount: 0,
    qualitySum: 0,
    pnlSum: 0,
  };
}

type Agg = ReturnType<typeof aggBucket>;

function finishRow(
  a: Agg,
  extra: { label: string; sublabel?: string }
): {
  label: string;
  sublabel?: string;
  tradeCount: number;
  scoredCount: number;
  avgQuality: number | null;
  totalPnl: number;
  avgPnl: number;
} {
  return {
    ...extra,
    tradeCount: a.tradeCount,
    scoredCount: a.scoredCount,
    avgQuality: a.scoredCount > 0 ? a.qualitySum / a.scoredCount : null,
    totalPnl: a.pnlSum,
    avgPnl: a.tradeCount > 0 ? a.pnlSum / a.tradeCount : 0,
  };
}

/**
 * Avg & total **quality** score and P&L by **entry** session (UTC bands → HKT labels in existing chart).
 */
export function scoreMetricsBySession(trades: readonly Trade[]) {
  const map = new Map<SessionName, ReturnType<typeof aggBucket>>(
    SESSION_ORDER.map((d) => [d.session, aggBucket()])
  );
  for (const t of trades) {
    const s = getEntrySessionName(t.entryTime);
    const b = map.get(s)!;
    b.tradeCount++;
    b.pnlSum += t.netPnl;
    if (t.qualityScore != null) {
      b.scoredCount++;
      b.qualitySum += t.qualityScore;
    }
  }
  return SESSION_ORDER.map(({ session, hktRange }) => {
    const a = map.get(session)!;
    return finishRow(a, { label: session, sublabel: hktRange });
  });
}

/**
 * One row per HKT **hour** of **entry** (0–23), fixed order.
 */
export function scoreMetricsByHktHour(trades: readonly Trade[]) {
  const hours: Map<number, ReturnType<typeof aggBucket>> = new Map();
  for (let h = 0; h < 24; h++) hours.set(h, aggBucket());
  for (const t of trades) {
    const hktDate = new Date(t.entryTime.getTime() + HKT_OFFSET_MS);
    const hour = hktDate.getUTCHours();
    const b = hours.get(hour)!;
    b.tradeCount++;
    b.pnlSum += t.netPnl;
    if (t.qualityScore != null) {
      b.scoredCount++;
      b.qualitySum += t.qualityScore;
    }
  }
  return Array.from({ length: 24 }, (_, hour) => {
    const a = hours.get(hour)!;
    const pad = String(hour).padStart(2, "0");
    return finishRow(a, { label: `${pad}:00`, sublabel: "HKT" });
  });
}

/**
 * Avg **quality** and P&L by **weekday of the CME Globex trading session date** (HKT),
 * same rule as `tradingDayKeyHkt` / KNOWLEDGE.md: session 06:00–05:00 HKT, label before 06:00
 * rolls to the previous civil date.
 */
export function scoreMetricsByTradingDayWeekday(trades: readonly Trade[]) {
  const dows: Map<number, ReturnType<typeof aggBucket>> = new Map();
  for (let d = 0; d < 7; d++) dows.set(d, aggBucket());
  for (const t of trades) {
    const dow = tradingDayWeekdayIndexHkt(t.entryTime);
    const b = dows.get(dow)!;
    b.tradeCount++;
    b.pnlSum += t.netPnl;
    if (t.qualityScore != null) {
      b.scoredCount++;
      b.qualitySum += t.qualityScore;
    }
  }
  const order = [1, 2, 3, 4, 5, 6, 0] as const; // Mon → Sun
  return order.map((d) => {
    const a = dows.get(d)!;
    return finishRow(a, { label: DOW_HKT[d]!, sublabel: "Trading day (HKT)" });
  });
}

export type ScoreTimeRow = ReturnType<typeof finishRow>;

function resolveRow(rows: readonly ScoreTimeRow[], winner: ScoreTimeRow): ScoreTimeRow {
  return rows.find((r) => r.label === winner.label && r.sublabel === winner.sublabel) ?? winner;
}

/**
 * Highest average quality score (buckets with at least one scored trade only).
 * Ties: more scored trades, then higher total P&amp;L.
 */
export function pickBestByAvgScore(rows: readonly ScoreTimeRow[]): ScoreTimeRow | null {
  const pool = rows.filter((r) => r.scoredCount > 0 && r.avgQuality !== null);
  if (pool.length === 0) return null;
  const sorted = [...pool].sort((a, b) => {
    const dq = (b.avgQuality ?? 0) - (a.avgQuality ?? 0);
    if (dq !== 0) return dq;
    if (b.scoredCount !== a.scoredCount) return b.scoredCount - a.scoredCount;
    return b.totalPnl - a.totalPnl;
  });
  return resolveRow(rows, sorted[0]!);
}

/**
 * Highest average net P&amp;L per trade in the bucket (all buckets with trades).
 * Ties: higher total P&amp;L in bucket, then more trades.
 */
export function pickBestByAvgPnl(rows: readonly ScoreTimeRow[]): ScoreTimeRow | null {
  const pool = rows.filter((r) => r.tradeCount > 0);
  if (pool.length === 0) return null;
  const sorted = [...pool].sort((a, b) => {
    if (b.avgPnl !== a.avgPnl) return b.avgPnl - a.avgPnl;
    if (b.totalPnl !== a.totalPnl) return b.totalPnl - a.totalPnl;
    return b.tradeCount - a.tradeCount;
  });
  return resolveRow(rows, sorted[0]!);
}