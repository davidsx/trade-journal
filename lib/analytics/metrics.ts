import type { TradeModel as Trade } from "@/app/generated/prisma/models";

export interface EquityPoint {
  timestamp: string; // ISO
  equity: number;
}

export interface DrawdownPoint {
  timestamp: string;
  drawdownAbs: number;
  drawdownPct: number;
}

export interface MetricsSummary {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalNetPnl: number;
  avgNetPnl: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  maxDrawdownAbs: number;
  maxDrawdownPct: number;
  sharpeRatio: number;
  sortinoRatio: number;
  avgHoldingMins: number;
  avgQualityScore: number | null;
  /** Account size before the first trade (chronological). */
  startingCapital: number;
  equityCurve: EquityPoint[];
  drawdownSeries: DrawdownPoint[];
}

export function computeEquityCurve(trades: Trade[]): EquityPoint[] {
  const points: EquityPoint[] = [];
  for (const t of trades) {
    points.push({
      timestamp: t.exitTime.toISOString(),
      equity: t.capitalAfter,
    });
  }
  return points;
}

export function computeDrawdownSeries(equityCurve: EquityPoint[]): DrawdownPoint[] {
  let peak = -Infinity;
  const series: DrawdownPoint[] = [];
  for (const pt of equityCurve) {
    if (pt.equity > peak) peak = pt.equity;
    const drawdownAbs = pt.equity - peak;
    const drawdownPct = peak > 0 ? (drawdownAbs / peak) * 100 : 0;
    series.push({ timestamp: pt.timestamp, drawdownAbs, drawdownPct });
  }
  return series;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function computeSharpe(trades: Trade[], riskFreeRate = 0): number {
  if (trades.length < 2) return 0;
  // Daily P&L aggregation
  const dailyPnl = new Map<string, number>();
  for (const t of trades) {
    const day = t.exitTime.toISOString().slice(0, 10);
    dailyPnl.set(day, (dailyPnl.get(day) ?? 0) + t.netPnl);
  }
  const returns = [...dailyPnl.values()];
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const sd = stdDev(returns);
  if (sd === 0) return 0;
  return ((mean - riskFreeRate) / sd) * Math.sqrt(252);
}

export function computeSortino(trades: Trade[], mar = 0): number {
  if (trades.length < 2) return 0;
  const dailyPnl = new Map<string, number>();
  for (const t of trades) {
    const day = t.exitTime.toISOString().slice(0, 10);
    dailyPnl.set(day, (dailyPnl.get(day) ?? 0) + t.netPnl);
  }
  const returns = [...dailyPnl.values()];
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const downside = returns.filter((r) => r < mar);
  if (downside.length < 2) return mean > 0 ? 999 : 0;
  const downsideMean = downside.reduce((a, b) => a + b, 0) / downside.length;
  const downsideVariance =
    downside.reduce((s, v) => s + (v - downsideMean) ** 2, 0) / (downside.length - 1);
  const downsideDev = Math.sqrt(downsideVariance);
  if (downsideDev === 0) return 0;
  return ((mean - mar) / downsideDev) * Math.sqrt(252);
}

export function computeProfitFactor(trades: Trade[]): number {
  const grossWins = trades
    .filter((t) => t.netPnl > 0)
    .reduce((s, t) => s + t.netPnl, 0);
  const grossLosses = Math.abs(
    trades.filter((t) => t.netPnl < 0).reduce((s, t) => s + t.netPnl, 0)
  );
  if (grossLosses === 0) return grossWins > 0 ? 999 : 1;
  return grossWins / grossLosses;
}

export function computeSummaryMetrics(trades: Trade[]): MetricsSummary {
  if (trades.length === 0) {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      totalNetPnl: 0,
      avgNetPnl: 0,
      avgWin: 0,
      avgLoss: 0,
      profitFactor: 0,
      maxDrawdownAbs: 0,
      maxDrawdownPct: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      avgHoldingMins: 0,
      avgQualityScore: null,
      startingCapital: 0,
      equityCurve: [],
      drawdownSeries: [],
    };
  }

  const winners = trades.filter((t) => t.netPnl > 0);
  const losers = trades.filter((t) => t.netPnl < 0);
  const totalNetPnl = trades.reduce((s, t) => s + t.netPnl, 0);
  const equityCurve = computeEquityCurve(trades);
  const drawdownSeries = computeDrawdownSeries(equityCurve);
  const maxDrawdownAbs = Math.min(...drawdownSeries.map((d) => d.drawdownAbs), 0);
  const maxDrawdownPct = Math.min(...drawdownSeries.map((d) => d.drawdownPct), 0);

  const scores = trades.map((t) => t.qualityScore).filter((s): s is number => s !== null);

  return {
    totalTrades: trades.length,
    winningTrades: winners.length,
    losingTrades: losers.length,
    winRate: winners.length / trades.length,
    totalNetPnl,
    avgNetPnl: totalNetPnl / trades.length,
    avgWin: winners.length > 0 ? winners.reduce((s, t) => s + t.netPnl, 0) / winners.length : 0,
    avgLoss: losers.length > 0 ? losers.reduce((s, t) => s + t.netPnl, 0) / losers.length : 0,
    profitFactor: computeProfitFactor(trades),
    maxDrawdownAbs,
    maxDrawdownPct,
    sharpeRatio: computeSharpe(trades),
    sortinoRatio: computeSortino(trades),
    avgHoldingMins: trades.reduce((s, t) => s + t.holdingMins, 0) / trades.length,
    avgQualityScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
    startingCapital: trades[0].capitalBefore,
    equityCurve,
    drawdownSeries,
  };
}
