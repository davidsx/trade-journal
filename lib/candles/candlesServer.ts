import { readFile, writeFile, mkdir, access } from "fs/promises";
import { constants } from "fs";
import { join, dirname } from "path";
import YahooFinance from "yahoo-finance2";
import {
  CANDLE_CHUNK_FETCH_SEC,
  clampUnixRangeForYahoo1m,
} from "@/lib/candleRange";
import { getCandlePeriodFromTradesInMemory } from "@/lib/tradeCandleBounds";

const CACHE_PATH = join(process.cwd(), "data", "candles-cache.json");
// Cache is valid for 6 hours (unless refresh or stale slice)
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
/** Keep merged on-disk history bounded (~20 months of 1m bars max). */
const MAX_RETAIN_SEC = 600 * 24 * 60 * 60;
/** If newest bar is older than this before the requested window end, refetch (live edge only). */
const FRESH_SLACK_SEC = 12 * 60 * 60;
/** If period2 is within this many seconds of now, treat the request as needing a fresh live edge. */
const LIVE_EDGE_WINDOW_SEC = 6 * 60 * 60;

/** Browser-like UA — Yahoo often blocks the library default + datacenter requests without it. */
const yahooFinance = new YahooFinance({
  fetchOptions: {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept: "application/json, text/plain, */*",
      Referer: "https://finance.yahoo.com/",
    },
  },
});

export interface Candle {
  time: number; // Unix timestamp (seconds)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface CacheFile {
  fetchedAt: number;
  symbol: string;
  interval: string;
  period1: string;
  period2: string;
  candles: Candle[];
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function fetchTimeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(ms);
  }
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c.signal;
}

function mergeCandles(prior: Candle[], incoming: Candle[]): Candle[] {
  const byTime = new Map<number, Candle>();
  for (const c of prior) byTime.set(c.time, c);
  for (const c of incoming) byTime.set(c.time, c);
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

function trimCandles(candles: Candle[], oldestAllowedSec: number): Candle[] {
  return candles.filter((c) => c.time >= oldestAllowedSec);
}

/**
 * In-memory + TTL + live-edge check on merged cache, filtered to the requested [period1, period2] window.
 */
export async function readCacheAsync(
  symbol: string,
  interval: string,
  period1: string,
  period2: string,
  bust: boolean
): Promise<Candle[] | null> {
  if (bust) return null;
  try {
    await access(CACHE_PATH, constants.F_OK);
  } catch {
    return null;
  }
  let cache: CacheFile;
  try {
    const text = await readFile(CACHE_PATH, "utf-8");
    cache = JSON.parse(text) as CacheFile;
  } catch {
    return null;
  }
  if (cache.symbol !== symbol || cache.interval !== interval) return null;
  if (Date.now() - cache.fetchedAt >= CACHE_TTL_MS) return null;

  const p1 = Number(period1);
  const p2 = Number(period2);
  const merged = cache.candles ?? [];
  if (merged.length === 0) return null;

  const nowSec = Math.floor(Date.now() / 1000);
  const maxT = Math.max(...merged.map((c) => c.time));
  const needLiveEdge = p2 >= nowSec - LIVE_EDGE_WINDOW_SEC;
  if (needLiveEdge) {
    const end = Math.min(p2, nowSec);
    if (maxT < end - FRESH_SLACK_SEC) return null;
  }

  const filtered = merged.filter((c) => c.time >= p1 && c.time <= p2);
  if (filtered.length === 0) return null;
  return filtered;
}

/**
 * Slice merged 1m bars from `candles-cache.json` for [period1, period2] (unix seconds, inclusive)
 * with **no TTL or live-edge checks**. Use for session/day views: read disk first, call Yahoo
 * only when this returns null or the caller still needs a gap fill.
 */
export async function readMergedCandlesFromFile(
  symbol: string,
  interval: string,
  period1: string,
  period2: string
): Promise<Candle[] | null> {
  try {
    await access(CACHE_PATH, constants.F_OK);
  } catch {
    return null;
  }
  let cache: CacheFile;
  try {
    const text = await readFile(CACHE_PATH, "utf-8");
    cache = JSON.parse(text) as CacheFile;
  } catch {
    return null;
  }
  if (cache.symbol !== symbol || cache.interval !== interval) return null;
  const p1 = Number(period1);
  const p2 = Number(period2);
  const merged = cache.candles ?? [];
  if (merged.length === 0) return null;
  const filtered = merged.filter((c) => c.time >= p1 && c.time <= p2);
  if (filtered.length === 0) return null;
  return filtered;
}

export async function writeMergedCache(
  symbol: string,
  interval: string,
  period1: string,
  period2: string,
  incoming: Candle[]
): Promise<void> {
  try {
    let prior: Candle[] = [];
    try {
      const text = await readFile(CACHE_PATH, "utf-8");
      const prev: CacheFile = JSON.parse(text) as CacheFile;
      if (prev.symbol === symbol && prev.interval === interval) prior = prev.candles ?? [];
    } catch {
      /* no prior */
    }
    const nowSec = Math.floor(Date.now() / 1000);
    const merged = trimCandles(mergeCandles(prior, incoming), nowSec - MAX_RETAIN_SEC);
    const dir = dirname(CACHE_PATH);
    try {
      await access(dir, constants.F_OK);
    } catch {
      await mkdir(dir, { recursive: true });
    }
    const cache: CacheFile = {
      fetchedAt: Date.now(),
      symbol,
      interval,
      period1,
      period2,
      candles: merged,
    };
    await writeFile(CACHE_PATH, JSON.stringify(cache), "utf-8");
  } catch {
    /* ignore disk errors */
  }
}

async function fetchYahooChartText(url: string): Promise<string> {
  const headers: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    Accept: "application/json",
    "Accept-Language": "en-US,en;q=0.9",
    Referer: "https://finance.yahoo.com/",
  };
  const direct = async () => {
    const res = await fetch(url, {
      headers,
      signal: fetchTimeoutSignal(28_000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);
    return res.text();
  };
  /** Third-party raw proxy — last resort when Yahoo blocks Vercel / serverless IPs. */
  const viaAllOrigins = async () => {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl, {
      signal: fetchTimeoutSignal(45_000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`allorigins HTTP ${res.status}`);
    return res.text();
  };
  try {
    return await direct();
  } catch {
    return viaAllOrigins();
  }
}

function parseYahooChart(raw: string): Candle[] {
  const json = JSON.parse(raw);
  const result = json?.chart?.result?.[0];
  if (!result) {
    const errMsg = json?.chart?.error?.description ?? "No data in response";
    throw new Error(errMsg);
  }

  const timestamps: number[] = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0] ?? {};
  const opens: number[] = quote.open ?? [];
  const highs: number[] = quote.high ?? [];
  const lows: number[] = quote.low ?? [];
  const closes: number[] = quote.close ?? [];
  const volumes: number[] = quote.volume ?? [];

  const candles: Candle[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    if (closes[i] == null || opens[i] == null) continue;
    candles.push({
      time: timestamps[i],
      open: opens[i],
      high: highs[i],
      low: lows[i],
      close: closes[i],
      volume: volumes[i] ?? 0,
    });
  }
  return candles;
}

/**
 * Pure-JS Yahoo chart (same data as curl path) — works on Vercel where python3/curl are absent.
 */
async function fetchViaYahooFinance2(
  symbol: string,
  period1: string,
  period2: string,
  barInterval: "1m" | "5m" = "1m"
): Promise<Candle[]> {
  const p1 = Number(period1);
  const p2 = Number(period2);
  if (p2 <= p1) return [];
  const result = await yahooFinance.chart(symbol, {
    period1: new Date(p1 * 1000),
    period2: new Date(p2 * 1000),
    interval: barInterval,
    includePrePost: true,
    return: "array",
  });
  const quotes = result.quotes ?? [];
  const candles: Candle[] = [];
  for (const q of quotes) {
    if (q.close == null || q.open == null) continue;
    candles.push({
      time: Math.floor(q.date.getTime() / 1000),
      open: q.open,
      high: q.high ?? q.close,
      low: q.low ?? q.close,
      close: q.close,
      volume: q.volume ?? 0,
    });
  }
  return candles;
}

function yahooChartUrl(
  host: "query1" | "query2",
  symbol: string,
  interval: string,
  p1: number,
  p2: number
): string {
  const base =
    host === "query1"
      ? "https://query1.finance.yahoo.com/v8/finance/chart/"
      : "https://query2.finance.yahoo.com/v8/finance/chart/";
  return (
    `${base}${encodeURIComponent(symbol)}` +
    `?interval=${interval}&period1=${p1}&period2=${p2}&includePrePost=true`
  );
}

/** Direct chart HTTP (often blocked on cloud IPs; kept as fallback after yahoo-finance2). */
async function fetchYahooChunk(
  symbol: string,
  interval: string,
  p1: number,
  p2: number,
  host: "query1" | "query2" = "query1"
): Promise<Candle[]> {
  const raw = await fetchYahooChartText(yahooChartUrl(host, symbol, interval, p1, p2));
  return parseYahooChart(raw);
}

/**
 * One Yahoo chart interval (1m or coarser fallback).
 */
async function fetchOneYahooInterval(
  symbol: string,
  chartInterval: string,
  p1: number,
  p2: number
): Promise<{ candles: Candle[]; source?: "yahoo-finance2" }> {
  try {
    const bar: "1m" | "5m" = chartInterval === "5m" ? "5m" : "1m";
    const fromLib = await fetchViaYahooFinance2(symbol, String(p1), String(p2), bar);
    if (fromLib.length > 0) return { candles: fromLib, source: "yahoo-finance2" };
  } catch {
    /* try HTTP */
  }
  try {
    const fromQ1 = await fetchYahooChunk(symbol, chartInterval, p1, p2, "query1");
    if (fromQ1.length > 0) return { candles: fromQ1 };
  } catch {
    /* try query2 */
  }
  try {
    const fromQ2 = await fetchYahooChunk(symbol, chartInterval, p1, p2, "query2");
    if (fromQ2.length > 0) return { candles: fromQ2 };
  } catch {
    /* empty */
  }
  return { candles: [] };
}

/**
 * Fetch [p1, p2]. Try 1m, then 5m bars (same OHLC shape; scorer is less precise but data loads on blocked hosts).
 */
async function fetchChunkWithFallback(
  symbol: string,
  interval: string,
  p1: number,
  p2: number
): Promise<{ candles: Candle[]; source?: "yahoo-finance2"; used5m?: boolean }> {
  const one = await fetchOneYahooInterval(symbol, interval, p1, p2);
  if (one.candles.length > 0) return { ...one, used5m: false };

  if (interval === "1m") {
    const five = await fetchOneYahooInterval(symbol, "5m", p1, p2);
    if (five.candles.length > 0) return { ...five, used5m: true };
  }
  return { candles: [], used5m: false };
}

/**
 * Fetch [p1, p2]. Try 1m, then 5m; batched for wide ranges; optional recent fallback when 1m has no data.
 */
export async function fetchCandlesForRange(
  symbol: string,
  interval: string,
  period1Str: string,
  period2Str: string
): Promise<{
  candles: Candle[];
  source?: "yahoo-finance2";
  batched: boolean;
  rangeClamped?: boolean;
  usedRecentFallback?: boolean;
  used5mBars?: boolean;
}> {
  let p1 = Number(period1Str);
  let p2 = Number(period2Str);
  let rangeClamped = false;

  if (interval === "1m") {
    const c = clampUnixRangeForYahoo1m(p1, p2);
    p1 = c.p1;
    p2 = c.p2;
    rangeClamped = c.clamped;
  }

  const span = p2 - p1;
  if (span <= 0) return { candles: [], batched: false, rangeClamped };

  async function runBatched(): Promise<{ merged: Candle[]; anyLib: boolean; any5m: boolean }> {
    if (span <= CANDLE_CHUNK_FETCH_SEC) {
      const r = await fetchChunkWithFallback(symbol, interval, p1, p2);
      return {
        merged: r.candles,
        anyLib: r.source === "yahoo-finance2",
        any5m: !!r.used5m,
      };
    }
    let merged: Candle[] = [];
    let anyLib = false;
    let any5m = false;
    let cursor = p1;
    while (cursor < p2) {
      const chunkEnd = Math.min(cursor + CANDLE_CHUNK_FETCH_SEC, p2);
      const r = await fetchChunkWithFallback(symbol, interval, cursor, chunkEnd);
      if (r.source === "yahoo-finance2") anyLib = true;
      if (r.used5m) any5m = true;
      merged = mergeCandles(merged, r.candles);
      cursor = chunkEnd;
      await sleep(200);
    }
    return { merged, anyLib, any5m };
  }

  let { merged, anyLib, any5m } = await runBatched();

  if (merged.length === 0 && interval === "1m") {
    const now = Math.floor(Date.now() / 1000);
    const fb1 = now - 7 * 24 * 60 * 60;
    const r = await fetchChunkWithFallback(symbol, interval, fb1, now);
    if (r.candles.length > 0) {
      merged = r.candles;
      anyLib = r.source === "yahoo-finance2" || anyLib;
      if (r.used5m) any5m = true;
      rangeClamped = true;
      return {
        candles: merged,
        source: anyLib ? "yahoo-finance2" : undefined,
        batched: false,
        rangeClamped: true,
        usedRecentFallback: true,
        ...(any5m ? { used5mBars: true } : {}),
      };
    }
  }

  return {
    candles: merged,
    source: anyLib ? "yahoo-finance2" : undefined,
    batched: span > CANDLE_CHUNK_FETCH_SEC,
    ...(rangeClamped ? { rangeClamped: true } : {}),
    ...(any5m ? { used5mBars: true } : {}),
  };
}

const SCORING_SYMBOL = "MNQ=F";
const SCORING_INTERVAL = "1m";

/**
 * Candles for quality scoring: read merged file slice first (no TTL), then Yahoo + merge if missing.
 */
export async function loadCandlesForScoringAsync(
  trades: { entryTime: Date; exitTime: Date }[]
): Promise<Candle[]> {
  if (trades.length === 0) return [];
  const { period1, period2 } = getCandlePeriodFromTradesInMemory(trades);
  const fromFile = await readMergedCandlesFromFile(SCORING_SYMBOL, SCORING_INTERVAL, period1, period2);
  if (fromFile) {
    const p1n = Number(period1);
    const p2n = Number(period2);
    return fromFile.filter((c) => c.time >= p1n && c.time <= p2n);
  }
  const { candles } = await fetchCandlesForRange(SCORING_SYMBOL, SCORING_INTERVAL, period1, period2);
  if (candles.length > 0) {
    await writeMergedCache(SCORING_SYMBOL, SCORING_INTERVAL, period1, period2, candles);
  }
  const p1n = Number(period1);
  const p2n = Number(period2);
  return candles.filter((c) => c.time >= p1n && c.time <= p2n);
}
