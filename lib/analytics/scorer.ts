import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { TradeModel as Trade } from "@/app/generated/prisma/models";

// ── Candle helpers ────────────────────────────────────────────────────────────

interface Candle {
  time: number; // UTC seconds
  open: number;
  high: number;
  low: number;
  close: number;
}

interface Imbalance {
  low: number;
  high: number;
  formationIdx: number; // index of 3rd candle that completed the FVG
}

function loadCachedCandles(): Candle[] {
  try {
    const path = join(process.cwd(), "data", "candles-cache.json");
    if (!existsSync(path)) return [];
    const cache = JSON.parse(readFileSync(path, "utf-8"));
    return (cache.candles ?? []) as Candle[];
  } catch {
    return [];
  }
}

// A Fair Value Gap (imbalance) exists when candle[i-2].high < candle[i].low (bullish)
// or candle[i-2].low > candle[i].high (bearish). The gap is the non-overlapping range.
function detectImbalances(candles: Candle[], fromIdx: number, toIdx: number): Imbalance[] {
  const result: Imbalance[] = [];
  for (let i = Math.max(2, fromIdx); i <= toIdx; i++) {
    const c1 = candles[i - 2];
    const c3 = candles[i];
    if (c1.high < c3.low) {
      result.push({ low: c1.high, high: c3.low, formationIdx: i });
    } else if (c1.low > c3.high) {
      result.push({ low: c3.high, high: c1.low, formationIdx: i });
    }
  }
  return result;
}

function priceInImbalance(price: number, imb: Imbalance): boolean {
  return price >= imb.low && price <= imb.high;
}

function candleOverlapsImbalance(candle: Candle, imb: Imbalance): boolean {
  return candle.high >= imb.low && candle.low <= imb.high;
}

function getImbalanceScore(
  entryPrice: number,
  entryTime: Date,
  candles: Candle[]
): { pts: number; note: string } {
  if (candles.length < 3) return { pts: 0, note: "Imbalance: no candle data available" };

  const entryTs = Math.floor(entryTime.getTime() / 1000);

  // Find the last candle that closed at or before the entry time
  let entryIdx = -1;
  for (let i = 0; i < candles.length; i++) {
    if (candles[i].time <= entryTs) entryIdx = i;
    else break;
  }
  if (entryIdx < 2) return { pts: 0, note: "Imbalance: entry before candle history" };

  const prevCandle = candles[entryIdx];

  // Collect imbalances formed within 5 and 15 candles before entry
  const imb5  = detectImbalances(candles, Math.max(2, entryIdx - 4), entryIdx);
  const imb15 = detectImbalances(candles, Math.max(2, entryIdx - 14), entryIdx);

  // Tier 1 (40) — entry price IS INSIDE an imbalance formed within last 5 candles
  if (imb5.some((imb) => priceInImbalance(entryPrice, imb))) {
    return { pts: 40, note: "Entry in imbalance zone (formed within 5 candles)" };
  }
  // Tier 2 (35) — entry price IS INSIDE an imbalance formed within last 15 candles
  if (imb15.some((imb) => priceInImbalance(entryPrice, imb))) {
    return { pts: 35, note: "Entry in imbalance zone (formed within 15 candles)" };
  }
  // Tier 3 (30) — entry OUTSIDE, but the EXACT previous candle touched an imbalance within 5 candles
  if (imb5.some((imb) => candleOverlapsImbalance(prevCandle, imb))) {
    return { pts: 30, note: "Previous candle touched imbalance zone (within 5 candles)" };
  }
  // Tier 4 (25) — entry OUTSIDE, but the EXACT previous candle touched an imbalance within 15 candles
  if (imb15.some((imb) => candleOverlapsImbalance(prevCandle, imb))) {
    return { pts: 25, note: "Previous candle touched imbalance zone (within 15 candles)" };
  }
  // Tier 5 (20) — entry IS INSIDE a candle (1–5 bars back) that rebalanced a 5-candle imbalance.
  // The previous candle (lookback=0) is already handled by tiers 3/4; start at lookback=1 so
  // this tier only fires when price consolidated for at least one bar after the rebalancing event.
  for (let lookback = 1; lookback <= 5; lookback++) {
    const rebalIdx = entryIdx - lookback;
    if (rebalIdx < 2) break;
    const rebalCandle = candles[rebalIdx];
    if (entryPrice < rebalCandle.low || entryPrice > rebalCandle.high) continue;
    const imbNear5 = detectImbalances(candles, Math.max(2, rebalIdx - 5), rebalIdx - 1);
    if (imbNear5.some((imb) => candleOverlapsImbalance(rebalCandle, imb))) {
      return { pts: 20, note: "Entry inside a candle that rebalanced a recent imbalance (within 5 candles)" };
    }
  }
  // Tier 6 (15) — entry IS INSIDE a candle (1–5 bars back) that rebalanced a 15-candle imbalance.
  for (let lookback = 1; lookback <= 5; lookback++) {
    const rebalIdx = entryIdx - lookback;
    if (rebalIdx < 2) break;
    const rebalCandle = candles[rebalIdx];
    if (entryPrice < rebalCandle.low || entryPrice > rebalCandle.high) continue;
    const imbNear15 = detectImbalances(candles, Math.max(2, rebalIdx - 15), rebalIdx - 1);
    if (imbNear15.some((imb) => candleOverlapsImbalance(rebalCandle, imb))) {
      return { pts: 15, note: "Entry inside a candle that rebalanced a recent imbalance (within 15 candles)" };
    }
  }
  // Tier 7 (10) — entry OUTSIDE, but one of candles 2–5 back touched an imbalance within 5 candles
  // (the exact previous candle is already covered by tiers 3/4 above)
  for (let lookback = 2; lookback <= 5; lookback++) {
    const idx = entryIdx - lookback;
    if (idx < 0) break;
    if (imb5.some((imb) => candleOverlapsImbalance(candles[idx], imb))) {
      return { pts: 10, note: `A recent candle (${lookback} bars back) touched imbalance zone (within 5 candles)` };
    }
  }
  // Tier 8 (5) — entry OUTSIDE, but one of candles 2–5 back touched an imbalance within 15 candles
  for (let lookback = 2; lookback <= 5; lookback++) {
    const idx = entryIdx - lookback;
    if (idx < 0) break;
    if (imb15.some((imb) => candleOverlapsImbalance(candles[idx], imb))) {
      return { pts: 5, note: `A recent candle (${lookback} bars back) touched imbalance zone (within 15 candles)` };
    }
  }
  // Tier 9 (0) — not near any recent imbalance zone
  return { pts: 0, note: "Entry not near any imbalance zone" };
}

// ── Breakout handling ─────────────────────────────────────────────────────────
// A pivot level exists when 2+ candle wicks are within 5 price points of each other.
// A breakout occurs when the entry candle's range runs through that pivot level.

function findPivotLevels(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const levels: number[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i + 1;
    while (j < sorted.length && sorted[j] - sorted[i] <= 5) j++;
    if (j - i >= 2) {
      // Average of the cluster
      const cluster = sorted.slice(i, j);
      levels.push(cluster.reduce((a, b) => a + b, 0) / cluster.length);
    }
    i = j;
  }
  return levels;
}

function getBreakoutScore(
  entryTime: Date,
  candles: Candle[]
): { pts: number; note: string } {
  if (candles.length < 5) return { pts: 0, note: "Breakout: no candle data" };

  const entryTs = Math.floor(entryTime.getTime() / 1000);
  let entryIdx = -1;
  for (let i = 0; i < candles.length; i++) {
    if (candles[i].time <= entryTs) entryIdx = i;
    else break;
  }
  if (entryIdx < 3) return { pts: 0, note: "Breakout: insufficient history" };

  const entryCandle = candles[entryIdx];

  // Use up to 50 prior candles (excluding the entry candle) to detect pivot levels
  const startIdx = Math.max(0, entryIdx - 50);
  const prior = candles.slice(startIdx, entryIdx);

  const resistancePivots = findPivotLevels(prior.map((c) => c.high));
  const supportPivots    = findPivotLevels(prior.map((c) => c.low));

  // Breakout = entry candle's range crosses the pivot level
  for (const level of resistancePivots) {
    if (entryCandle.low < level && entryCandle.high > level) {
      return { pts: 5, note: `Breakout through resistance pivot at ${level.toFixed(2)}` };
    }
  }
  for (const level of supportPivots) {
    if (entryCandle.low < level && entryCandle.high > level) {
      return { pts: 5, note: `Breakout through support pivot at ${level.toFixed(2)}` };
    }
  }

  return { pts: 0, note: "No pivot breakout on entry candle" };
}

export interface TradeScore {
  total: number;
  entry: number;
  exit: number;
  risk: number;
  notes: string[];
}

// Session times in UTC (HKT = UTC+8):
// Asia      00:00–08:00 UTC  (08:00–16:00 HKT)
// London    08:00–13:30 UTC  (16:00–21:30 HKT)
// NY        13:30–21:00 UTC  (21:30–05:00 HKT)
// Off-hours 21:00–00:00 UTC  (05:00–08:00 HKT)
//
// Prime  = first hour of London (08:00–09:00 UTC / 16:00–17:00 HKT)
//        + first hour of NY     (13:30–14:30 UTC / 21:30–22:30 HKT)
// Lowest = after 23:30 HKT = after 15:30 UTC (late NY + off-hours)
function getSessionTimingScore(entryTime: Date): { pts: number; note: string } {
  const utcHour = entryTime.getUTCHours();
  const utcMin = entryTime.getUTCMinutes();
  const utcTotal = utcHour * 60 + utcMin;

  const londonOpenStart =  8 * 60;       // 08:00 UTC = 16:00 HKT
  const londonOpenEnd   =  9 * 60;       // 09:00 UTC = 17:00 HKT
  const nyOpenStart     = 13 * 60 + 30;  // 13:30 UTC = 21:30 HKT
  const nyOpenEnd       = 14 * 60 + 30;  // 14:30 UTC = 22:30 HKT
  const lateNightCutoff = 15 * 60 + 30;  // 15:30 UTC = 23:30 HKT

  if (
    (utcTotal >= londonOpenStart && utcTotal < londonOpenEnd) ||
    (utcTotal >= nyOpenStart     && utcTotal < nyOpenEnd)
  ) {
    return { pts: 10, note: "Entry at session open (prime)" };
  }

  if (utcTotal >= lateNightCutoff) {
    return { pts: 0, note: "Entry after 11:30pm HKT (low activity)" };
  }

  return { pts: 5, note: "Entry during regular session hours" };
}

function getPositionSizingScore(
  qty: number,
  entryPrice: number,
  pointValue: number,
  capitalBefore: number
): { pts: number; note: string } {
  if (capitalBefore <= 0) return { pts: 3, note: "Position sizing: capital unknown" };
  // For leveraged futures, use "1% price move exposure" rather than full notional.
  // A 1% move in price × pointValue × qty gives the dollar risk per 1% adverse move.
  const exposure = qty * entryPrice * pointValue * 0.01;
  const pct = exposure / capitalBefore;

  if (pct <= 0.05) return { pts: 5, note: `Position size: 1% move = ${(pct * 100).toFixed(1)}% of capital (conservative)` };
  if (pct <= 0.15) return { pts: 3, note: `Position size: 1% move = ${(pct * 100).toFixed(1)}% of capital (moderate)` };
  return { pts: 0, note: `Position size: 1% move = ${(pct * 100).toFixed(1)}% of capital (oversized)` };
}

function getExitRelativeScore(
  netPnl: number,
  medianWinPnl: number
): { pts: number; note: string } {
  if (medianWinPnl <= 0 || netPnl <= 0) {
    if (netPnl <= 0) return { pts: 0, note: "Trade was a loss" };
    return { pts: 8, note: "Profitable trade (no median benchmark yet)" };
  }
  const ratio = netPnl / medianWinPnl;
  if (ratio >= 1.5) return { pts: 15, note: `Exit captured ${ratio.toFixed(1)}× median winner` };
  if (ratio >= 1.0) return { pts: 10, note: `Exit captured ${ratio.toFixed(1)}× median winner` };
  if (ratio >= 0.5) return { pts: 5, note: `Exit captured ${ratio.toFixed(1)}× median winner (early exit)` };
  return { pts: 0, note: `Exit captured only ${ratio.toFixed(1)}× median winner` };
}

function getHoldTimeScore(
  holdingMins: number,
  medianHoldMins: number
): { pts: number; note: string } {
  if (medianHoldMins <= 0) return { pts: 5, note: "Hold time: no median benchmark yet" };
  const ratio = holdingMins / medianHoldMins;
  if (ratio >= 0.5 && ratio <= 2.0) {
    return { pts: 10, note: `Hold time ${holdingMins.toFixed(0)}m (${ratio.toFixed(1)}× median)` };
  }
  if (ratio < 0.5) {
    return { pts: 2, note: `Short hold ${holdingMins.toFixed(0)}m (${ratio.toFixed(1)}× median, possible early exit)` };
  }
  return { pts: 6, note: `Long hold ${holdingMins.toFixed(0)}m (${ratio.toFixed(1)}× median, possible overstay)` };
}

function getRMultipleScore(
  netPnl: number,
  avgLoss: number
): { pts: number; note: string } {
  if (avgLoss >= 0) return { pts: 5, note: "R-multiple: no loss benchmark yet" };
  const rMultiple = netPnl / Math.abs(avgLoss);
  if (rMultiple >= 2.0) return { pts: 10, note: `R-multiple ${rMultiple.toFixed(1)}R (excellent)` };
  if (rMultiple >= 1.0) return { pts: 7, note: `R-multiple ${rMultiple.toFixed(1)}R (good)` };
  if (rMultiple >= 0.5) return { pts: 4, note: `R-multiple ${rMultiple.toFixed(1)}R (below target)` };
  return { pts: 0, note: `R-multiple ${rMultiple.toFixed(1)}R (poor)` };
}

function getStreakContextScore(
  tradeIndex: number,
  trades: Trade[],
  trade: Trade
): { pts: number; note: string } {
  if (tradeIndex === 0) return { pts: 3, note: "First trade" };

  // Count consecutive prior losses
  let consecutiveLosses = 0;
  for (let i = tradeIndex - 1; i >= 0; i--) {
    if (trades[i].netPnl < 0) consecutiveLosses++;
    else break;
  }

  if (consecutiveLosses >= 3 && trade.netPnl > 0) {
    return { pts: 5, note: `Win after ${consecutiveLosses} consecutive losses (discipline)` };
  }

  // Check for revenge-trade signal: large loss following a winning streak
  let consecutiveWins = 0;
  for (let i = tradeIndex - 1; i >= 0; i--) {
    if (trades[i].netPnl > 0) consecutiveWins++;
    else break;
  }

  const avgPnl = trades.slice(0, tradeIndex).reduce((s, t) => s + Math.abs(t.netPnl), 0) / tradeIndex;
  if (consecutiveWins >= 3 && trade.netPnl < 0 && Math.abs(trade.netPnl) > avgPnl * 1.5) {
    return { pts: 0, note: `Large loss after ${consecutiveWins} wins (possible revenge trade)` };
  }

  return { pts: 3, note: "Normal streak context" };
}

function getPointValue(contractName: string): number {
  const { POINT_VALUES } = require("./tradeBuilder") as { POINT_VALUES: Record<string, number> };
  const base = contractName.replace(/[A-Z]\d+$/, "");
  return POINT_VALUES[base] ?? 1;
}

export function scoreTrades(trades: Trade[]): Trade[] {
  if (trades.length === 0) return [];
  const candles = loadCachedCandles();

  // Pre-compute per-instrument stats for benchmarking
  const byContract = new Map<
    string,
    { pnls: number[]; holdMins: number[]; losses: number[] }
  >();
  for (const t of trades) {
    const s = byContract.get(t.contractName) ?? { pnls: [], holdMins: [], losses: [] };
    s.pnls.push(t.netPnl);
    s.holdMins.push(t.holdingMins);
    if (t.netPnl < 0) s.losses.push(t.netPnl);
    byContract.set(t.contractName, s);
  }

  const median = (arr: number[]): number => {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  };

  const medianWinByContract = new Map<string, number>();
  const medianHoldByContract = new Map<string, number>();
  const avgLossByContract = new Map<string, number>();
  for (const [contract, stats] of byContract) {
    const wins = stats.pnls.filter((p) => p > 0);
    medianWinByContract.set(contract, median(wins));
    medianHoldByContract.set(contract, median(stats.holdMins));
    avgLossByContract.set(
      contract,
      stats.losses.length > 0
        ? stats.losses.reduce((a, b) => a + b, 0) / stats.losses.length
        : 0
    );
  }

  return trades.map((trade, i) => {
    const notes: string[] = [];
    const pointValue = getPointValue(trade.contractName);
    const medianWin = medianWinByContract.get(trade.contractName) ?? 0;
    const medianHold = medianHoldByContract.get(trade.contractName) ?? 0;
    const avgLoss = avgLossByContract.get(trade.contractName) ?? 0;

    // Entry scores (max 40)
    const timing   = getSessionTimingScore(trade.entryTime);
    const sizing   = getPositionSizingScore(trade.qty, trade.entryPrice, pointValue, trade.capitalBefore);
    const imbalance = getImbalanceScore(trade.entryPrice, trade.entryTime, candles);
    const breakout  = getBreakoutScore(trade.entryTime, candles);
    notes.push(timing.note);
    notes.push(sizing.note);
    notes.push(imbalance.note);
    notes.push(breakout.note);

    const entryScore = timing.pts + sizing.pts + imbalance.pts + breakout.pts;

    // Exit scores (max 30)
    const exitRel = getExitRelativeScore(trade.netPnl, medianWin);
    const holdTime = getHoldTimeScore(trade.holdingMins, medianHold);
    notes.push(exitRel.note);
    notes.push(holdTime.note);

    const exitScore = exitRel.pts + holdTime.pts;

    // Risk scores
    const rMult = getRMultipleScore(trade.netPnl, avgLoss);
    const streakCtx = getStreakContextScore(i, trades, trade);
    notes.push(rMult.note);
    notes.push(streakCtx.note);

    const riskScore = rMult.pts + streakCtx.pts;
    const qualityScore = entryScore + exitScore + riskScore;

    return {
      ...trade,
      qualityScore,
      entryScore,
      exitScore,
      riskScore,
      scoreNotes: JSON.stringify(notes),
    };
  });
}
