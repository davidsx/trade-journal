Here is a concise project summary based on the repo layout and the files that were read.

## Project purpose

**Trade Journal** (`package.json` name: `trade-journal`) is a **local web dashboard** for **futures trading performance**. You import a **Performance CSV** (e.g. Tradovate P&L export), store **trades** in PostgreSQL, run a **0–100 quality score** on each trade, and review **stats, equity, patterns, and charts**.

`README.md` and `app/page.tsx` frame it as: import CSV, score trades, then explore metrics, patterns, and candle charts with optional Yahoo Finance 1m data.

---

## Tech stack

| Area | Choice |
|------|--------|
| Framework | **Next.js 16** (App Router) — `package.json` |
| UI | **React 19**, **Tailwind CSS 4** |
| Data | **Prisma 7** + **PostgreSQL** (Neon in docs) via **`@prisma/adapter-pg`** and **`pg`** |
| Validation | **Zod** |
| Charts | **Recharts** (dashboard/analytics) and **lightweight-charts** (candle/price) |
| Market data | **yahoo-finance2** for 1m candles (`/api/candles`) |
| Build | `prisma generate` on postinstall; `dev` runs `prisma migrate deploy` then `next dev` |

`app/layout.tsx` sets **`dynamic = "force-dynamic"`** so server-rendered data stays fresh (no stale RSC cache for trade-related UI).

---

## Root layout (high level)

- **`/Users/lauchunhong/repos/skills/performance-review/app/`** — App Router: pages, API routes, `globals.css`, parallel **`@modal`** for trade detail overlays.
- **`/Users/lauchunhong/repos/skills/performance-review/components/`** — UI: `Sidebar`, `EquityCurve`, `TradeTable`, `CsvUpload`, charts, modals, etc.
- **`/Users/lauchunhong/repos/skills/performance-review/lib/`** — CSV import, Prisma access, **analytics** (metrics, scorer, patterns, insights), **active account** / account scope, candle helpers.
- **`/Users/lauchunhong/repos/skills/performance-review/prisma/`** — `schema.prisma` and migrations.
- **`/Users/lauchunhong/repos/skills/performance-review/data/`** — e.g. `candles-cache.json` (used by scoring/charting paths per `lib/analytics/scorer.ts`).
- Config: **`next.config.ts`**, **`tsconfig.json`**, **`.env.example`**, **`prisma.config.ts`**.

---

## Domain knowledge (`KNOWLEDGE.md`)

- **Trading day** for NQ/MNQ is defined in **HKT** along **CME Globex** (open/close/break, session “date” = session **end** date rule).
- **Chart session windows** (Asia / London / NY) in UTC map to HKT; notes that **lightweight-charts** `timeToCoordinate` can return `null` past the last bar, so **NY session shading** must **clamp to the last candle** (see `CandleChart.tsx` / `loadDayCandles.ts`).

---

## Data model (Prisma, `prisma/schema.prisma`)

- **`Account`** — name, **`initialBalance`** (equity/capital chain; default 50k).
- **`Trade`** — contract, direction, fills/times, P&L, fees, **quality / entry / exit / risk scores**, **`scoreNotes`**, capital before/after, indexes on `accountId` + `entryTime`.
- **`Fill`** — optional fill-level sync data tied to an account.

---

## Main user-facing features (pages)

From `README.md` and `components/Sidebar.tsx` nav:

| Route | Role |
|-------|------|
| **`/`** | Dashboard: `StatCard`s, `EquityCurve`, `TradingCalendar` (`app/page.tsx`) |
| **`/trades`**, **`/trades/[id]`** | Trade log; detail (modal via `@modal`) |
| **`/analytics`** | Drawdown, P&L bars, score distribution |
| **`/patterns`** | Time/day heatmaps, instruments, streaks |
| **`/insights`** | Condition groups / “blueprint” from high-scoring trades (`lib/analytics/insights`) |
| **`/chart`** | Candle chart + trade context |
| **`/score-guide`** | Explains the scoring model |
| **`/accounts`** | Accounts + `initialBalance` (server actions in `app/accounts/`) |

---

## API surface (representative)

`README.md` documents routes such as:

- **Import & scoring**: `POST /api/import` (CSV → DB), `POST /api/import/score`, `POST /api/rescore`, overlap/import trade helpers.
- **Read model**: `GET /api/metrics`, `/api/trades`, `/api/trades/:id`, `/api/patterns`, `/api/insights`, score distribution / best / worst.
- **Infra & data**: `GET /api/health`, `GET /api/candles` (Yahoo 1m), `GET/POST /api/settings` (per codebase file list).

Import flow: multipart CSV → parse → **upsert** trades for the **active account**; a **separate score step** finalizes running capital and scores (see comments in `app/api/import/route.ts`).

---

## Scoring and analytics (key `lib` pieces)

- **`lib/analytics/scorer.ts`** — **0–100** score: **Entry 40 · Exit 40 · Risk 20** (`README.md`); uses cached 1m candles, **fair value gap / imbalance** style logic, and related notes.
- **`lib/analytics/metrics.ts`** — Summary metrics, equity curve, drawdown, Sharpe/Sortino, etc. (consumed on the dashboard and via `/api/metrics`).
- **`lib/csv/`** — Parse Tradovate-style CSV and wire into DB import.

---

## Key UI components (non-exhaustive)

- **Navigation / data entry**: `Sidebar`, `AccountSwitcher`, `CsvUpload`, `ClearTradesButton`, `RescoreButton`, `RefreshCandlesButton`.
- **Trades**: `TradeTable`, `TradeDetail`, `TradeModal`, `ScoreBadge`, `TradeDetailChart`.
- **Analytics / viz**: `EquityCurve`, `DrawdownChart`, `PnlBarChart`, `ScoreDistributionChart`, `TimeHeatmap`, `ScorePnlChart`, `ScoreTimeMetricsTables`, `CandleChart` / `ChartClient`.

---

## Documentation

- **`/Users/lauchunhong/repos/skills/performance-review/README.md`** — Setup (Neon `DATABASE_URL` / `DIRECT_URL`), `npm run dev`, Tradovate CSV export, route/API table, scoring bands.
- **`/Users/lauchunhong/repos/skills/performance-review/KNOWLEDGE.md`** — **NQ/MNQ session** and **chart session** conventions (HKT/UTC).
- **`AGENTS.md` / `CLAUDE.md`** — Pointers to Next.js in-repo docs and `KNOWLEDGE.md` (per workspace rules).

---

**In one line:** a **Next.js + Prisma** trade journal that **imports CSV performance**, **scores trades** (entry/exit/risk, with candle-based structure), and provides a **full analytics UI** (equity, patterns, insights, and candle charts) with **multi-account** support backed by **PostgreSQL**.