import type { TradeModel as Trade } from "@/app/generated/prisma/models";
import { tradingDayWeekdayIndexHkt } from "@/lib/tradingDay";

export interface TimeOfDayBucket {
  hourLabel: string; // e.g. "09:30"
  hour: number;
  minute: number;
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

export function analyzeTimeOfDay(trades: Trade[]): TimeOfDayBucket[] {
  // 30-min buckets across 24 hours
  const buckets = new Map<string, { wins: number; total: number; pnlSum: number }>();

  const HKT_OFFSET_MS = 8 * 60 * 60 * 1000;
  for (const t of trades) {
    const hkt = new Date(t.entryTime.getTime() + HKT_OFFSET_MS);
    const h = hkt.getUTCHours();
    const m = hkt.getUTCMinutes() < 30 ? 0 : 30;
    const key = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    const bucket = buckets.get(key) ?? { wins: 0, total: 0, pnlSum: 0 };
    bucket.total++;
    if (t.netPnl > 0) bucket.wins++;
    bucket.pnlSum += t.netPnl;
    buckets.set(key, bucket);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, b]) => {
      const [h, m] = key.split(":").map(Number);
      return {
        hourLabel: key,
        hour: h,
        minute: m,
        winRate: b.total > 0 ? b.wins / b.total : 0,
        avgPnl: b.total > 0 ? b.pnlSum / b.total : 0,
        tradeCount: b.total,
      };
    });
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
// Asia    00:00–08:00 UTC  ↔  08:00–16:00 HKT
// London  08:00–13:30 UTC  ↔  16:00–21:30 HKT
// NY      13:30–21:00 UTC  ↔  21:30–05:00 HKT
// Off     21:00–24:00 UTC  ↔  05:00–08:00 HKT

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
  if (h < 8)   return "Asia";
  if (h < 13.5) return "London";
  if (h < 21)  return "NY";
  return "Off-hours";
}

/** Map entry instant (stored in UTC) to chart session: Asia / London / NY / Off-hours. */
export function getEntrySessionName(entryTime: Date): SessionName {
  return getSession(entryTime.getUTCHours(), entryTime.getUTCMinutes());
}

export function analyzeSessionPerformance(trades: Trade[]): SessionPattern[] {
  const DEFS: { session: SessionName; hktRange: string }[] = [
    { session: "Asia",      hktRange: "8:00am – 4:00pm" },
    { session: "London",    hktRange: "4:00pm – 9:30pm" },
    { session: "NY",        hktRange: "9:30pm – 5:00am" },
    { session: "Off-hours", hktRange: "5:00am – 8:00am" },
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
