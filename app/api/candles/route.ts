import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

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
// Cache is valid for 6 hours
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

interface CacheFile {
  fetchedAt: number;
  symbol: string;
  interval: string;
  period1: string;
  period2: string;
  candles: Candle[];
}

function readCache(
  symbol: string,
  interval: string,
  period1: string,
  period2: string
): Candle[] | null {
  try {
    if (!existsSync(CACHE_PATH)) return null;
    const cache: CacheFile = JSON.parse(readFileSync(CACHE_PATH, "utf-8"));
    if (
      cache.symbol === symbol &&
      cache.interval === interval &&
      cache.period1 === period1 &&
      cache.period2 === period2 &&
      Date.now() - cache.fetchedAt < CACHE_TTL_MS
    ) {
      return cache.candles;
    }
  } catch {}
  return null;
}

function writeCache(
  symbol: string,
  interval: string,
  period1: string,
  period2: string,
  candles: Candle[]
) {
  try {
    const cache: CacheFile = {
      fetchedAt: Date.now(),
      symbol,
      interval,
      period1,
      period2,
      candles,
    };
    writeFileSync(CACHE_PATH, JSON.stringify(cache));
  } catch {}
}

async function curlYahoo(url: string): Promise<string> {
  const { stdout } = await execFileAsync(
    "curl",
    [
      "-s",
      "-L",
      "--max-time", "20",
      "-H", "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "-H", "Accept: application/json",
      "-H", "Accept-Language: en-US,en;q=0.9",
      "-H", "Referer: https://finance.yahoo.com/",
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

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const symbol = searchParams.get("symbol") ?? "MNQ=F";
  const interval = searchParams.get("interval") ?? "1m";
  const period1 = searchParams.get("period1") ?? "1775606400";
  const period2 = searchParams.get("period2") ?? "1775865600";
  const bust = searchParams.has("refresh");

  // Serve from cache when available (and not forcing a refresh)
  if (!bust) {
    const cached = readCache(symbol, interval, period1, period2);
    if (cached) {
      return NextResponse.json({ candles: cached, symbol, interval, cached: true });
    }
  }

  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?interval=${interval}&period1=${period1}&period2=${period2}&includePrePost=true`;

  try {
    const raw = await curlYahoo(url);
    const candles = parseYahooChart(raw);
    writeCache(symbol, interval, period1, period2, candles);
    return NextResponse.json({ candles, symbol, interval, cached: false });
  } catch (err) {
    // If Yahoo Finance is rate-limiting, try the yfinance Python fallback
    try {
      const candles = await fetchViaYfinance(symbol, period1, period2);
      if (candles.length > 0) {
        writeCache(symbol, interval, period1, period2, candles);
        return NextResponse.json({ candles, symbol, interval, cached: false, source: "yfinance" });
      }
    } catch {}
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
