import type { Candle } from "@/lib/candles/candlesServer";

/** iPhone 17 Pro Max native resolution. */
export const WALLPAPER_W = 1320;
export const WALLPAPER_H = 2868;

// App theme tokens (globals.css)
const BG_BASE = "#0f0f0f";
const BORDER = "#2a2a2a";
const TEXT_PRIMARY = "#e5e5e5";
const TEXT_SECONDARY = "#9ca3af";
const TEXT_MUTED = "#6b7280";
const PROFIT = "#22c55e";
const LOSS = "#ef4444";
const ACCENT = "#38bdf8";

const HKT_OFFSET_S = 8 * 3600;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function hktTime(ts: number): string {
  const d = new Date((ts + HKT_OFFSET_S) * 1000);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}
function hktDate(ts: number): string {
  const d = new Date((ts + HKT_OFFSET_S) * 1000);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

const FONT = "-apple-system, SF Pro Display, Helvetica, sans-serif";

/**
 * Build the wallpaper SVG from the last N (default 6) candles.
 * Pure/deterministic given `candles` — the top ~40% is left blank for the iOS clock.
 */
export function renderWallpaperSvg(candles: Candle[]): string {
  const W = WALLPAPER_W;
  const H = WALLPAPER_H;

  const cs = candles.slice(-6);
  const n = cs.length;

  const plot = { x: 140, y: 1180, w: W - 280, h: 900 };

  let priceMax = Math.max(...cs.map((c) => c.high));
  let priceMin = Math.min(...cs.map((c) => c.low));
  const pad = (priceMax - priceMin) * 0.18 || 1;
  priceMax += pad;
  priceMin -= pad;

  const priceToY = (p: number) =>
    plot.y + plot.h - ((p - priceMin) / (priceMax - priceMin)) * plot.h;

  const slot = plot.w / n;
  const bodyW = slot * 0.56;

  const first = cs[0];
  const last = cs[n - 1];
  const net = last.close - first.open;
  const netUp = net >= 0;
  const netColor = netUp ? PROFIT : LOSS;
  const pct = (net / first.open) * 100;

  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`);

  parts.push(`
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#0b0b0b"/>
    <stop offset="0.5" stop-color="${BG_BASE}"/>
    <stop offset="1" stop-color="#080808"/>
  </linearGradient>
  <radialGradient id="glow" cx="0.5" cy="0.5" r="0.6">
    <stop offset="0" stop-color="${netColor}" stop-opacity="0.10"/>
    <stop offset="1" stop-color="${netColor}" stop-opacity="0"/>
  </radialGradient>
</defs>
<rect width="${W}" height="${H}" fill="url(#bg)"/>
<ellipse cx="${plot.x + plot.w / 2}" cy="${plot.y + plot.h / 2}" rx="${plot.w * 0.75}" ry="${plot.h * 0.7}" fill="url(#glow)"/>
`);

  const GRID_N = 4;
  for (let i = 0; i <= GRID_N; i++) {
    const p = priceMin + ((priceMax - priceMin) * i) / GRID_N;
    const y = priceToY(p);
    parts.push(
      `<line x1="${plot.x}" y1="${y.toFixed(1)}" x2="${plot.x + plot.w}" y2="${y.toFixed(1)}" stroke="${BORDER}" stroke-width="1.5"/>`
    );
    parts.push(
      `<text x="${plot.x + plot.w + 20}" y="${(y + 12).toFixed(1)}" font-family="${FONT}" font-size="30" fill="${TEXT_MUTED}" text-anchor="start">${p.toFixed(0)}</text>`
    );
  }

  for (let i = 0; i < n; i++) {
    const c = cs[i];
    const cx = plot.x + slot * (i + 0.5);
    const up = c.close >= c.open;
    const col = up ? PROFIT : LOSS;
    const yHigh = priceToY(c.high);
    const yLow = priceToY(c.low);
    const bodyTop = Math.min(priceToY(c.open), priceToY(c.close));
    const bodyBot = Math.max(priceToY(c.open), priceToY(c.close));
    const bodyH = Math.max(bodyBot - bodyTop, 6);

    parts.push(
      `<line x1="${cx.toFixed(1)}" y1="${yHigh.toFixed(1)}" x2="${cx.toFixed(1)}" y2="${yLow.toFixed(1)}" stroke="${col}" stroke-width="5" stroke-linecap="round"/>`
    );
    parts.push(
      `<rect x="${(cx - bodyW / 2).toFixed(1)}" y="${bodyTop.toFixed(1)}" width="${bodyW.toFixed(1)}" height="${bodyH.toFixed(1)}" rx="8" fill="${col}"/>`
    );
    parts.push(
      `<text x="${cx.toFixed(1)}" y="${(plot.y + plot.h + 56).toFixed(1)}" font-family="${FONT}" font-size="30" fill="${TEXT_MUTED}" text-anchor="middle">${hktTime(c.time)}</text>`
    );
  }

  const headY = 940;
  parts.push(`
<text x="${plot.x}" y="${headY}" font-family="${FONT}" font-size="54" font-weight="700" fill="${TEXT_PRIMARY}" letter-spacing="1">MNQ</text>
<text x="${plot.x + 200}" y="${headY}" font-family="${FONT}" font-size="34" fill="${TEXT_SECONDARY}">Micro E-mini Nasdaq-100 · 5m</text>
`);

  const priceY = headY + 90;
  parts.push(`
<text x="${plot.x}" y="${priceY}" font-family="${FONT}" font-size="96" font-weight="700" fill="${TEXT_PRIMARY}">${last.close.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</text>
`);
  const arrow = netUp ? "▲" : "▼";
  const sign = netUp ? "+" : "";
  parts.push(`
<text x="${plot.x}" y="${priceY + 56}" font-family="${FONT}" font-size="40" font-weight="600" fill="${netColor}">${arrow} ${sign}${net.toFixed(2)}  (${sign}${pct.toFixed(2)}%)</text>
`);

  parts.push(`
<text x="${W / 2}" y="${plot.y + plot.h + 150}" font-family="${FONT}" font-size="30" fill="${TEXT_MUTED}" text-anchor="middle">Last ${n} × 5-minute candles · ${hktDate(first.time)} ${hktTime(first.time)}–${hktTime(last.time)} HKT</text>
`);

  parts.push(`
<text x="${W / 2}" y="${H - 90}" font-family="${FONT}" font-size="28" font-weight="600" fill="${ACCENT}" text-anchor="middle" letter-spacing="3">TRADE JOURNAL</text>
`);

  parts.push(`</svg>`);
  return parts.join("\n");
}
