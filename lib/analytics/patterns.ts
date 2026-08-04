import type { TradeModel as Trade } from "@/app/generated/prisma/models";
import { GLOBEX_SESSION_START_HOUR_HKT, tradingDayWeekdayIndexHkt } from "@/lib/tradingDay";

const HKT_OFFSET_MS = 8 * 60 * 60 * 1000;

/** One CME Globex “trading day” in 15-minute steps: 06:00 HKT → … → 05:45 HKT (96 slots). */
export const TRADING_DAY_QUARTER_HOUR_SLOT_COUNT = 96;

export interface TimeOfDayBucket {
  hourLabel: string; // e.g. "09:15"
  hour: number;
  minute: number;
  /** Index 0 = 06:00 HKT (session open), 95 = 05:45 HKT — CME trading-day order. */
  slotIndex: number;
  winRate: number;
  avgPnl: number;
  tradeCount: number;
}

export interface DayOfWeekBucket {
  dayName: string;
  dayIndex: number; // 0=Sun
  winRate: number;
  avgPnl: number;
  tradeCount: number;
}

export interface InstrumentPattern {
  contractName: string;
  tradeCount: number;
  winRate: number;
  profitFactor: number;
  avgPnl: number;
  totalPnl: number;
  warning: string | null;
}

export interface StreakAnalysis {
  currentStreak: number;       // positive = wins, negative = losses
  currentStreakType: "win" | "loss" | "none";
  maxWinStreak: number;
  maxLossStreak: number;
  longestUnderwaterTrades: number; // trades spent below equity peak
}

export interface EdgeDecayPoint {
  tradeIndex: number;
  rollingWinRate: number;
  decayAlert: boolean;
}

function hktWallClock(instant: Date): { h: number; m: number } {
  const t = new Date(instant.getTime() + HKT_OFFSET_MS);
  return { h: t.getUTCHours(), m: t.getUTCMinutes() };
}

/** Map wall clock to the 15-minute bucket start (00, 15, 30, or 45). */
function toQuarterHourBucketKey(h: number, m: number): string {
  const q = m < 15 ? 0 : m < 30 ? 15 : m < 45 ? 30 : 45;
  return `${String(h).padStart(2, "0")}:${String(q).padStart(2, "0")}`;
}

/** 96 keys: 06:00, 06:15, …, 23:45, 00:00, …, 05:45 (CME Globex day, HKT). */
export function tradingDayQuarterHourKeysHkt(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < TRADING_DAY_QUARTER_HOUR_SLOT_COUNT; i++) {
    const totalMins = (GLOBEX_SESSION_START_HOUR_HKT * 60 + i * 15) % (24 * 60);
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    keys.push(toQuarterHourBucketKey(h, m));
  }
  return keys;
}

export function analyzeTimeOfDay(trades: Trade[]): TimeOfDayBucket[] {
  const orderedKeys = tradingDayQuarterHourKeysHkt();
  const buckets = new Map<string, { wins: number; total: number; pnlSum: number }>();
  for (const k of orderedKeys) {
    buckets.set(k, { wins: 0, total: 0, pnlSum: 0 });
  }

  for (const t of trades) {
    const { h, m } = hktWallClock(t.entryTime);
    const key = toQuarterHourBucketKey(h, m);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.total++;
    if (t.netPnl > 0) bucket.wins++;
    bucket.pnlSum += t.netPnl;
  }

  return orderedKeys.map((key, slotIndex) => {
    const b = buckets.get(key)!;
    const [h, m] = key.split(":").map(Number);
    return {
      hourLabel: key,
      hour: h,
      minute: m,
      slotIndex,
      winRate: b.total > 0 ? b.wins / b.total : 0,
      avgPnl: b.total > 0 ? b.pnlSum / b.total : 0,
      tradeCount: b.total,
    };
  });
}

export interface HourlyBucket {
  /** "06:00", "07:00", … in CME trading-day order (06:00 HKT start). */
  hourLabel: string;
  hour: number; // HKT clock hour 0–23
  /** 0 = 06:00 HKT (session open) … 23 = 05:00 HKT. */
  slotIndex: number;
  session: SessionName;
  tradeCount: number;
  winRate: number;
  avgPnl: number;
  totalPnl: number;
  profitFactor: number;
  bestTrade: number;
  worstTrade: number;
}

/** 24 HKT clock hours in CME Globex trading-day order: 06, 07, …, 23, 00, …, 05. */
export function tradingDayHoursHkt(): number[] {
  return Array.from({ length: 24 }, (_, i) => (GLOBEX_SESSION_START_HOUR_HKT + i) % 24);
}

/** Per-hour P&L summary (by entry time, HKT), in CME trading-day order. */
export function analyzeHourly(trades: ReadonlyArray<{ entryTime: Date; netPnl: number }>): HourlyBucket[] {
  const orderedHours = tradingDayHoursHkt();
  type Bucket = {
    wins: number;
    total: number;
    pnlSum: number;
    grossWins: number;
    grossLosses: number;
    best: number;
    worst: number;
  };
  const empty = (): Bucket => ({
    wins: 0,
    total: 0,
    pnlSum: 0,
    grossWins: 0,
    grossLosses: 0,
    best: -Infinity,
    worst: Infinity,
  });
  const buckets = new Map<number, Bucket>(orderedHours.map((h) => [h, empty()]));

  for (const t of trades) {
    const { h } = hktWallClock(t.entryTime);
    const b = buckets.get(h);
    if (!b) continue;
    b.total++;
    b.pnlSum += t.netPnl;
    if (t.netPnl > 0) {
      b.wins++;
      b.grossWins += t.netPnl;
    } else {
      b.grossLosses += Math.abs(t.netPnl);
    }
    if (t.netPnl > b.best) b.best = t.netPnl;
    if (t.netPnl < b.worst) b.worst = t.netPnl;
  }

  return orderedHours.map((hour, slotIndex) => {
    const b = buckets.get(hour)!;
    return {
      hourLabel: `${String(hour).padStart(2, "0")}:00`,
      hour,
      slotIndex,
      session: sessionFromHktWallClock(hour, 30),
      tradeCount: b.total,
      winRate: b.total > 0 ? b.wins / b.total : 0,
      avgPnl: b.total > 0 ? b.pnlSum / b.total : 0,
      totalPnl: b.pnlSum,
      profitFactor: b.grossLosses > 0 ? b.grossWins / b.grossLosses : b.grossWins > 0 ? 999 : 0,
      bestTrade: b.total > 0 ? b.best : 0,
      worstTrade: b.total > 0 ? b.worst : 0,
    };
  });
}

export interface HourRankTally {
  hour: number;
  hourLabel: string;
  session: SessionName;
  /** 3·#1 + 2·#2 + 1·#3 across accounts. */
  weightedScore: number;
  firsts: number;
  seconds: number;
  thirds: number;
  /** Accounts where this hour landed in the top 3. */
  appearances: number;
  /** Sum of this hour's total P&L across the accounts where it ranked. */
  totalPnl: number;
}

/** #1 → 3 pts, #2 → 2 pts, #3 → 1 pt. */
const HOUR_RANK_WEIGHTS = [3, 2, 1] as const;

/** Minimal fields `analyzeHourly` needs, for lightweight cross-account calls. */
type HourlyTradeLike = { entryTime: Date; netPnl: number };

/**
 * Across accounts, rank each account's top 3 P&L hours, then tally a weighted
 * vote per hour (#1=3, #2=2, #3=1). Returned sorted by weighted score desc.
 */
export function rankTopHoursAcrossAccounts(tradesByAccount: HourlyTradeLike[][]): HourRankTally[] {
  type Tally = {
    weightedScore: number;
    firsts: number;
    seconds: number;
    thirds: number;
    appearances: number;
    totalPnl: number;
  };
  const tallies = new Map<number, Tally>();

  for (const trades of tradesByAccount) {
    if (trades.length === 0) continue;
    const top3 = analyzeHourly(trades)
      .filter((b) => b.tradeCount > 0 && b.totalPnl > 0)
      .sort((a, b) => b.totalPnl - a.totalPnl)
      .slice(0, 3);

    top3.forEach((bucket, i) => {
      const t = tallies.get(bucket.hour) ?? {
        weightedScore: 0,
        firsts: 0,
        seconds: 0,
        thirds: 0,
        appearances: 0,
        totalPnl: 0,
      };
      t.weightedScore += HOUR_RANK_WEIGHTS[i];
      if (i === 0) t.firsts++;
      else if (i === 1) t.seconds++;
      else t.thirds++;
      t.appearances++;
      t.totalPnl += bucket.totalPnl;
      tallies.set(bucket.hour, t);
    });
  }

  return [...tallies.entries()]
    .map(([hour, t]) => ({
      hour,
      hourLabel: `${String(hour).padStart(2, "0")}:00`,
      session: sessionFromHktWallClock(hour, 30),
      ...t,
    }))
    .sort((a, b) =>
      b.weightedScore - a.weightedScore ||
      b.firsts - a.firsts ||
      b.totalPnl - a.totalPnl
    );
}

export function analyzeDayOfWeek(trades: Trade[]): DayOfWeekBucket[] {
  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const buckets = new Map<number, { wins: number; total: number; pnlSum: number }>();

  for (const t of trades) {
    const day = tradingDayWeekdayIndexHkt(t.exitTime);
    const b = buckets.get(day) ?? { wins: 0, total: 0, pnlSum: 0 };
    b.total++;
    if (t.netPnl > 0) b.wins++;
    b.pnlSum += t.netPnl;
    buckets.set(day, b);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([day, b]) => ({
      dayName: DAY_NAMES[day],
      dayIndex: day,
      winRate: b.total > 0 ? b.wins / b.total : 0,
      avgPnl: b.total > 0 ? b.pnlSum / b.total : 0,
      tradeCount: b.total,
    }));
}

export function analyzeInstruments(trades: Trade[]): InstrumentPattern[] {
  const byContract = new Map<
    string,
    { wins: number; total: number; grossWins: number; grossLosses: number; pnlSum: number }
  >();

  for (const t of trades) {
    const b = byContract.get(t.contractName) ?? {
      wins: 0,
      total: 0,
      grossWins: 0,
      grossLosses: 0,
      pnlSum: 0,
    };
    b.total++;
    if (t.netPnl > 0) {
      b.wins++;
      b.grossWins += t.netPnl;
    } else {
      b.grossLosses += Math.abs(t.netPnl);
    }
    b.pnlSum += t.netPnl;
    byContract.set(t.contractName, b);
  }

  return [...byContract.entries()].map(([contractName, b]) => {
    const winRate = b.total > 0 ? b.wins / b.total : 0;
    const profitFactor = b.grossLosses > 0 ? b.grossWins / b.grossLosses : b.grossWins > 0 ? 999 : 1;
    const warning =
      winRate < 0.4 && b.total >= 5
        ? "Win rate < 40%"
        : profitFactor < 1.0 && b.total >= 5
        ? "Profit factor < 1.0"
        : null;
    return {
      contractName,
      tradeCount: b.total,
      winRate,
      profitFactor,
      avgPnl: b.total > 0 ? b.pnlSum / b.total : 0,
      totalPnl: b.pnlSum,
      warning,
    };
  });
}

export function analyzeStreaks(trades: Trade[]): StreakAnalysis {
  if (trades.length === 0) {
    return {
      currentStreak: 0,
      currentStreakType: "none",
      maxWinStreak: 0,
      maxLossStreak: 0,
      longestUnderwaterTrades: 0,
    };
  }

  let currentStreak = 0;
  let maxWinStreak = 0;
  let maxLossStreak = 0;

  for (const t of trades) {
    if (t.netPnl > 0) {
      currentStreak = currentStreak > 0 ? currentStreak + 1 : 1;
    } else {
      currentStreak = currentStreak < 0 ? currentStreak - 1 : -1;
    }
    if (currentStreak > maxWinStreak) maxWinStreak = currentStreak;
    if (-currentStreak > maxLossStreak) maxLossStreak = -currentStreak;
  }

  // Longest underwater period
  let peakEquity = -Infinity;
  let underwaterCount = 0;
  let maxUnderwater = 0;
  let currentUnderwater = 0;
  for (const t of trades) {
    if (t.capitalAfter > peakEquity) {
      peakEquity = t.capitalAfter;
      currentUnderwater = 0;
    } else {
      currentUnderwater++;
      if (currentUnderwater > maxUnderwater) maxUnderwater = currentUnderwater;
    }
    underwaterCount = currentUnderwater;
  }

  return {
    currentStreak,
    currentStreakType: currentStreak > 0 ? "win" : currentStreak < 0 ? "loss" : "none",
    maxWinStreak,
    maxLossStreak,
    longestUnderwaterTrades: maxUnderwater,
  };
}

// Session boundaries in UTC hours (HKT = UTC+8)
// Asia    22:00–08:00 UTC  ↔  06:00–16:00 HKT
// London  08:00–13:00 UTC  ↔  16:00–21:00 HKT
// NY      13:00–21:00 UTC  ↔  21:00–05:00 HKT
// Off     21:00–22:00 UTC  ↔  05:00–06:00 HKT (daily Globex break)

export type SessionName = "Asia" | "London" | "NY" | "Off-hours";

export interface SessionPattern {
  session: SessionName;
  hktRange: string;
  tradeCount: number;
  winRate: number;
  avgPnl: number;
  totalPnl: number;
  profitFactor: number;
  longCount: number;
  shortCount: number;
  longWinRate: number;
  shortWinRate: number;
  avgHoldMins: number;
  bestTrade: number;
  worstTrade: number;
}

function getSession(utcHour: number, utcMinute: number): SessionName {
  const h = utcHour + utcMinute / 60;
  // Asia 06:00–16:00 HKT wraps midnight in UTC (22:00–08:00).
  if (h >= 22 || h < 8) return "Asia";
  if (h < 13) return "London"; // 16:00–21:00 HKT
  if (h < 21) return "NY";     // 21:00–05:00 HKT
  return "Off-hours";          // 05:00–06:00 HKT (daily break)
}

/** Map entry instant (stored in UTC) to chart session: Asia / London / NY / Off-hours. */
export function getEntrySessionName(entryTime: Date): SessionName {
  return getSession(entryTime.getUTCHours(), entryTime.getUTCMinutes());
}

/**
 * Session for an HKT wall-clock time (same rules as {@link getEntrySessionName}).
 * HKT = UTC+8 → UTC hour = (hktHour − 8) mod 24.
 */
export function sessionFromHktWallClock(hktHour: number, hktMinute: number): SessionName {
  let utcH = hktHour - 8;
  if (utcH < 0) utcH += 24;
  return getSession(utcH, hktMinute);
}

/**
 * Session stats by **entry** time (HKT/UTC), same as `analyzeSessionPerformance` but
 * without requiring a full Prisma `Trade` — for client modals and lightweight calls.
 */
export function analyzeSessionPerformanceLite(
  trades: ReadonlyArray<{
    entryTime: Date;
    netPnl: number;
    direction: string;
    holdingMins: number;
  }>
): SessionPattern[] {
  return analyzeSessionPerformance(trades as unknown as Trade[]);
}

export function analyzeSessionPerformance(trades: Trade[]): SessionPattern[] {
  const DEFS: { session: SessionName; hktRange: string }[] = [
    { session: "Asia",      hktRange: "6:00am – 4:00pm" },
    { session: "London",    hktRange: "4:00pm – 9:00pm" },
    { session: "NY",        hktRange: "9:00pm – 5:00am" },
    { session: "Off-hours", hktRange: "5:00am – 6:00am" },
  ];

  type Bucket = {
    wins: number; losses: number;
    grossWins: number; grossLosses: number;
    pnlSum: number; holdSum: number;
    longWins: number; longTotal: number;
    shortWins: number; shortTotal: number;
    best: number; worst: number;
  };

  const empty = (): Bucket => ({
    wins: 0, losses: 0,
    grossWins: 0, grossLosses: 0,
    pnlSum: 0, holdSum: 0,
    longWins: 0, longTotal: 0,
    shortWins: 0, shortTotal: 0,
    best: -Infinity, worst: Infinity,
  });

  const map = new Map<SessionName, Bucket>(DEFS.map((d) => [d.session, empty()]));

  for (const t of trades) {
    const s = getSession(t.entryTime.getUTCHours(), t.entryTime.getUTCMinutes());
    const b = map.get(s)!;
    if (t.netPnl > 0) { b.wins++; b.grossWins += t.netPnl; }
    else               { b.losses++; b.grossLosses += Math.abs(t.netPnl); }
    b.pnlSum += t.netPnl;
    b.holdSum += t.holdingMins;
    if (t.netPnl > b.best)  b.best  = t.netPnl;
    if (t.netPnl < b.worst) b.worst = t.netPnl;
    if (t.direction === "Long") {
      b.longTotal++;
      if (t.netPnl > 0) b.longWins++;
    } else {
      b.shortTotal++;
      if (t.netPnl > 0) b.shortWins++;
    }
  }

  return DEFS.map(({ session, hktRange }) => {
    const b = map.get(session)!;
    const total = b.wins + b.losses;
    return {
      session,
      hktRange,
      tradeCount: total,
      winRate: total > 0 ? b.wins / total : 0,
      avgPnl: total > 0 ? b.pnlSum / total : 0,
      totalPnl: b.pnlSum,
      profitFactor: b.grossLosses > 0 ? b.grossWins / b.grossLosses : b.grossWins > 0 ? 999 : 0,
      longCount: b.longTotal,
      shortCount: b.shortTotal,
      longWinRate: b.longTotal > 0 ? b.longWins / b.longTotal : 0,
      shortWinRate: b.shortTotal > 0 ? b.shortWins / b.shortTotal : 0,
      avgHoldMins: total > 0 ? b.holdSum / total : 0,
      bestTrade: total > 0 ? b.best : 0,
      worstTrade: total > 0 ? b.worst : 0,
    };
  });
}

export function analyzeEdgeDecay(
  trades: Trade[],
  windowSize = 20
): EdgeDecayPoint[] {
  if (trades.length < windowSize) return [];

  const overallWinRate =
    trades.filter((t) => t.netPnl > 0).length / trades.length;

  return trades.slice(windowSize - 1).map((_, i) => {
    const window = trades.slice(i, i + windowSize);
    const wins = window.filter((t) => t.netPnl > 0).length;
    const rollingWinRate = wins / windowSize;
    return {
      tradeIndex: i + windowSize,
      rollingWinRate,
      decayAlert: overallWinRate - rollingWinRate > 0.15,
    };
  });
}
