import { NextRequest, NextResponse } from "next/server";

/** Batched trade-range fetches can take a while (many Yahoo chunks). */
export const maxDuration = 120;
import { execFile } from "child_process";
import { promisify } from "util";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { CANDLE_CHUNK_FETCH_SEC } from "@/lib/candleRange";
import { getCandleFetchRangeFromTrades } from "@/lib/tradeCandleBounds";

export interface Candle {
  time: number; // Unix timestamp (seconds)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const execFileAsync = promisify(execFile);
const CACHE_PATH = join(process.cwd(), "data", "candles-cache.json");
// Cache is valid for 6 hours (unless refresh or stale slice)
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
/** Keep merged on-disk history bounded (~20 months of 1m bars max). */
const MAX_RETAIN_SEC = 600 * 24 * 60 * 60;
/** If newest bar is older than this before the requested window end, refetch (live edge only). */
const FRESH_SLACK_SEC = 12 * 60 * 60;
/** If period2 is within this many seconds of now, treat the request as needing a fresh live edge. */
const LIVE_EDGE_WINDOW_SEC = 6 * 60 * 60;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

interface CacheFile {
  fetchedAt: number;
  symbol: string;
  interval: string;
  period1: string;
  period2: string;
  candles: Candle[];
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

function readCache(
  symbol: string,
  interval: string,
  period1: string,
  period2: string,
  bust: boolean
): Candle[] | null {
  if (bust) return null;
  try {
    if (!existsSync(CACHE_PATH)) return null;
    const cache: CacheFile = JSON.parse(readFileSync(CACHE_PATH, "utf-8"));
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
  } catch {
    return null;
  }
}

function writeMergedCache(
  symbol: string,
  interval: string,
  period1: string,
  period2: string,
  incoming: Candle[]
) {
  try {
    let prior: Candle[] = [];
    if (existsSync(CACHE_PATH)) {
      try {
        const prev: CacheFile = JSON.parse(readFileSync(CACHE_PATH, "utf-8"));
        if (prev.symbol === symbol && prev.interval === interval) prior = prev.candles ?? [];
      } catch {
        /* ignore */
      }
    }
    const nowSec = Math.floor(Date.now() / 1000);
    const merged = trimCandles(
      mergeCandles(prior, incoming),
      nowSec - MAX_RETAIN_SEC
    );
    const dir = dirname(CACHE_PATH);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const cache: CacheFile = {
      fetchedAt: Date.now(),
      symbol,
      interval,
      period1,
      period2,
      candles: merged,
    };
    writeFileSync(CACHE_PATH, JSON.stringify(cache));
  } catch {
    /* ignore disk errors */
  }
}

async function curlYahoo(url: string): Promise<string> {
  const { stdout } = await execFileAsync(
    "curl",
    [
      "-s",
      "-L",
      "--max-time",
      "20",
      "-H",
      "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "-H",
      "Accept: application/json",
      "-H",
      "Accept-Language: en-US,en;q=0.9",
      "-H",
      "Referer: https://finance.yahoo.com/",
      url,
    ],
    { maxBuffer: 20 * 1024 * 1024 }
  );
  return stdout;
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

async function fetchViaYfinance(
  symbol: string,
  period1: string,
  period2: string
): Promise<Candle[]> {
  const start = new Date(Number(period1) * 1000).toISOString().slice(0, 10);
  const end = new Date(Number(period2) * 1000).toISOString().slice(0, 10);
  const script = `
import yfinance as yf, json, sys
df = yf.Ticker(${JSON.stringify(symbol)}).history(start=${JSON.stringify(start)}, end=${JSON.stringify(end)}, interval="1m", prepost=True)
if df.empty:
    print("[]")
else:
    out = []
    for ts, row in df.iterrows():
        c = row["Close"]; o = row["Open"]
        if c != c or o != o: continue
        out.append({"time": int(ts.timestamp()), "open": round(float(o),4), "high": round(float(row["High"]),4), "low": round(float(row["Low"]),4), "close": round(float(c),4), "volume": int(row["Volume"]) if row["Volume"]==row["Volume"] else 0})
    print(json.dumps(out))
`;
  const { stdout } = await execFileAsync("python3", ["-c", script], {
    maxBuffer: 20 * 1024 * 1024,
  });
  return JSON.parse(stdout.trim()) as Candle[];
}

function yahooChartUrl(symbol: string, interval: string, p1: number, p2: number): string {
  return (
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?interval=${interval}&period1=${p1}&period2=${p2}&includePrePost=true`
  );
}

/** One Yahoo request; empty or parse failure falls through to caller. */
async function fetchYahooChunk(
  symbol: string,
  interval: string,
  p1: number,
  p2: number
): Promise<Candle[]> {
  const raw = await curlYahoo(yahooChartUrl(symbol, interval, p1, p2));
  return parseYahooChart(raw);
}

/**
 * Fetch [p1, p2] (unix seconds). Uses Yahoo first, then yfinance for that chunk.
 */
async function fetchChunkWithFallback(
  symbol: string,
  interval: string,
  p1: number,
  p2: number
): Promise<{ candles: Candle[]; source?: "yfinance" }> {
  try {
    const fromYahoo = await fetchYahooChunk(symbol, interval, p1, p2);
    if (fromYahoo.length > 0) return { candles: fromYahoo };
  } catch {
    /* try yfinance */
  }
  const fromPy = await fetchViaYfinance(symbol, String(p1), String(p2));
  if (fromPy.length > 0) return { candles: fromPy, source: "yfinance" };
  return { candles: [] };
}

async function fetchCandlesForRange(
  symbol: string,
  interval: string,
  period1Str: string,
  period2Str: string
): Promise<{ candles: Candle[]; source?: "yfinance"; batched: boolean }> {
  const p1 = Number(period1Str);
  const p2 = Number(period2Str);
  const span = p2 - p1;
  if (span <= 0) return { candles: [], batched: false };

  if (span <= CANDLE_CHUNK_FETCH_SEC) {
    const r = await fetchChunkWithFallback(symbol, interval, p1, p2);
    return { ...r, batched: false };
  }

  let merged: Candle[] = [];
  let anyYfinance = false;
  let cursor = p1;
  while (cursor < p2) {
    const chunkEnd = Math.min(cursor + CANDLE_CHUNK_FETCH_SEC, p2);
    const r = await fetchChunkWithFallback(symbol, interval, cursor, chunkEnd);
    if (r.source === "yfinance") anyYfinance = true;
    merged = mergeCandles(merged, r.candles);
    cursor = chunkEnd;
    await sleep(200);
  }
  return {
    candles: merged,
    source: anyYfinance ? "yfinance" : undefined,
    batched: true,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const symbol = searchParams.get("symbol") ?? "MNQ=F";
  const interval = searchParams.get("interval") ?? "1m";
  const explicitP1 = searchParams.get("period1");
  const explicitP2 = searchParams.get("period2");
  const bust = searchParams.has("refresh");

  const useTradeRange = explicitP1 === null || explicitP2 === null;
  let period1: string;
  let period2: string;
  let tradeCount: number | undefined;
  if (explicitP1 !== null && explicitP2 !== null) {
    period1 = explicitP1;
    period2 = explicitP2;
  } else {
    const r = await getCandleFetchRangeFromTrades();
    period1 = r.period1;
    period2 = r.period2;
    tradeCount = r.tradeCount;
  }

  if (!bust) {
    const cached = readCache(symbol, interval, period1, period2, false);
    if (cached) {
      return NextResponse.json({
        candles: cached,
        symbol,
        interval,
        cached: true,
        tradeBased: useTradeRange,
        tradeCount,
      });
    }
  }

  try {
    const { candles, source, batched } = await fetchCandlesForRange(
      symbol,
      interval,
      period1,
      period2
    );
    if (candles.length === 0) {
      return NextResponse.json(
        { error: "No 1m candles returned for this range" },
        { status: 502 }
      );
    }
    writeMergedCache(symbol, interval, period1, period2, candles);
    const p1n = Number(period1);
    const p2n = Number(period2);
    const filtered = candles.filter((c) => c.time >= p1n && c.time <= p2n);
    return NextResponse.json({
      candles: filtered.length ? filtered : candles,
      symbol,
      interval,
      cached: false,
      source,
      batched,
      tradeBased: useTradeRange,
      tradeCount,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
