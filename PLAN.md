# Tradovate Performance Review Dashboard

## Context

Build a local trading performance review dashboard that automatically pulls trade data from Tradovate's API, computes performance metrics, scores each trade for quality, detects behavioral patterns, and visualizes everything in a dark-themed React UI.

**User's setup**: Tradovate demo account, trades NQ/MNQ futures, wants a dark-themed dashboard.

---

## Tech Stack

- **Framework**: Next.js 14 (App Router) — unified frontend + API route handlers
- **Database**: SQLite via Prisma (local caching of fills and computed trades)
- **Charts**: Recharts (equity curve, drawdown, P&L bars, patterns)
- **Tradovate API**: `https://demo.tradovateapi.com/v1` (REST, password grant auth)

---

## Directory Structure

```
performance-review/
├── .env.local.example
├── .gitignore
├── package.json
├── next.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── prisma/
│   └── schema.prisma
├── data/                             # SQLite file lives here
├── lib/
│   ├── core/
│   │   └── config.ts                 # Zod-validated env vars
│   ├── tradovate/
│   │   ├── auth.ts                   # Password grant + auto-renewal singleton
│   │   ├── client.ts                 # Authenticated fetch wrapper
│   │   ├── accounts.ts               # GET /account/list
│   │   └── fills.ts                  # GET /fill/list (paginated)
│   ├── db/
│   │   ├── prisma.ts                 # PrismaClient singleton
│   │   └── syncService.ts            # Upsert fills, rebuild trades, log syncs
│   └── analytics/
│       ├── tradeBuilder.ts           # FIFO fill matching → round-trip Trades
│       ├── metrics.ts                # Equity curve, drawdown, Sharpe, Sortino, PF
│       ├── scorer.ts                 # 0–100 quality score per trade
│       └── patterns.ts              # Time-of-day, day-of-week, streaks, edge decay
├── app/
│   ├── layout.tsx                    # Root layout, dark theme, nav sidebar
│   ├── page.tsx                      # Dashboard — metrics + equity curve + recent trades
│   ├── globals.css                   # Dark theme CSS vars
│   ├── trades/
│   │   ├── page.tsx                  # Full paginated trade log with filters
│   │   └── [id]/
│   │       └── page.tsx              # Trade detail — score breakdown
│   ├── analytics/
│   │   └── page.tsx                  # Drawdown + P&L bars + score distribution
│   ├── patterns/
│   │   └── page.tsx                  # Heatmaps + instrument breakdown + streaks
│   └── api/
│       ├── health/route.ts
│       ├── auth/
│       │   ├── connect/route.ts      # POST — trigger token request
│       │   └── status/route.ts       # GET — token validity
│       ├── sync/
│       │   ├── route.ts              # POST — pull fills, rebuild trades
│       │   └── status/route.ts       # GET — last SyncLog row
│       ├── trades/
│       │   ├── route.ts              # GET — paginated + filtered
│       │   └── [id]/route.ts         # GET — single trade + score notes
│       ├── metrics/route.ts          # GET — MetricsSummary + equityCurve + drawdown
│       ├── patterns/route.ts         # GET — all pattern analyses
│       └── scores/
│           ├── distribution/route.ts
│           ├── best/route.ts
│           └── worst/route.ts
└── components/
    ├── StatCard.tsx
    ├── MetricCards.tsx
    ├── TradeTable.tsx
    ├── ScoreBadge.tsx
    ├── EquityCurve.tsx               # Recharts AreaChart, 'use client'
    ├── DrawdownChart.tsx             # Recharts AreaChart (inverted), 'use client'
    ├── PnlBarChart.tsx               # Recharts BarChart, 'use client'
    ├── TimeHeatmap.tsx               # SVG hour × weekday grid, 'use client'
    └── PatternPanel.tsx
```

---

## Prisma Schema

```prisma
model AuthToken {
  id           String   @id @default(cuid())
  accountId    Int      @unique
  accessToken  String
  expiresAt    DateTime
  updatedAt    DateTime @updatedAt
}

model Fill {
  id           String   @id         // Tradovate fill ID
  accountId    Int
  contractId   Int
  contractName String               // e.g. "NQM5"
  action       String               // "Buy" | "Sell"
  qty          Int
  price        Float
  fees         Float
  timestamp    DateTime
  orderId      String
  tradeDate    String               // "YYYY-MM-DD"
  syncedAt     DateTime @default(now())

  @@index([accountId, timestamp])
}

model Trade {
  id             String   @id @default(cuid())
  accountId      Int
  contractId     Int
  contractName   String
  direction      String             // "Long" | "Short"
  qty            Int
  entryFillId    String
  exitFillId     String
  entryPrice     Float
  exitPrice      Float
  entryTime      DateTime
  exitTime       DateTime
  holdingMins    Float
  grossPnl       Float
  fees           Float
  netPnl         Float
  rMultiple      Float?
  qualityScore   Int?               // 0–100
  entryScore     Int?               // 0–40
  exitScore      Int?               // 0–40
  riskScore      Int?               // 0–20
  scoreNotes     String?            // JSON array
  capitalBefore  Float
  capitalAfter   Float
  createdAt      DateTime @default(now())

  @@index([accountId, entryTime])
}

model SyncLog {
  id          String   @id @default(cuid())
  accountId   Int
  syncedAt    DateTime @default(now())
  fillsAdded  Int
  tradesBuilt Int
  status      String               // "ok" | "error"
  errorMsg    String?
}
```

---

## Authentication (`lib/tradovate/auth.ts`)

Tradovate uses a **password grant** (no redirect). Flow:
1. `POST /auth/accesstokenrequest` with `{ name, password, appId, appSecret, cid, sec, deviceId }`
2. Store `accessToken` + `expirationTime` in `AuthToken` table + memory singleton
3. `startAutoRenewal()` — `setInterval` every 30s, calls `POST /auth/renewaccesstoken` if within 60s of expiry
4. All API calls go through `getValidToken()` which auto-renews if needed

**Required env vars**:
```
TRADOVATE_USERNAME=
TRADOVATE_PASSWORD=
TRADOVATE_APP_ID=
TRADOVATE_APP_SECRET=
TRADOVATE_CID=
TRADOVATE_DEVICE_ID=     # stable UUID, generate once
TRADOVATE_ENVIRONMENT=demo
DATABASE_URL=file:./data/tradovate.db
```

---

## Trade Builder Algorithm (`lib/analytics/tradeBuilder.ts`)

Matches raw fills into round-trip trades using FIFO lot tracking:

```
For each (accountId, contractId) group, sorted by timestamp ASC:
  positionQty = 0
  openLots = []   // FIFO queue of { price, qty, fillId, time, fees }

  For each fill:
    if action == "Buy" and positionQty >= 0:  // adding to long or opening long
      push to openLots
    if action == "Sell" and positionQty > 0:  // closing long
      match against FIFO openLots, create Trade per matched lot
    Short trades: mirror (Sell opens, Buy closes)
```

**Point values** (NQ/MNQ are primary):
```ts
const POINT_VALUES: Record<string, number> = {
  NQ: 20, MNQ: 2,
  ES: 50, MES: 5,
  CL: 1000, GC: 100,
  YM: 5,   MYM: 0.5,
}
```

---

## Trade Quality Scoring (0–100)

### Entry Quality (0–40 pts)
- **Slippage** (0–15 pts): 0 ticks = 15, ≥5 ticks = 0, linear interpolation. If no reference price available, award full 15.
- **Session timing** (0–10 pts): Trades in 9:30–11:00 AM or 1:30–3:00 PM EST windows get 10; outside regular hours get 5; pre-market/post-market get 0.
- **Position sizing** (0–15 pts): `qty * entryPrice * pointValue / capitalBefore`. ≤1% = 15, 1–3% = 10, 3–5% = 5, >5% = 0.

### Exit Quality (0–40 pts)
- **Relative to median winner** (0–20 pts): `netPnl / medianWinPnl[contractName]`. ≥1.5× = 20, 1.0× = 15, 0.5× = 8, <0 = 0.
- **Hold time appropriateness** (0–10 pts): `holdingMins / medianHoldMins[contractName]`. 0.5–2.0× range = 10; extremes penalized.
- **Exit slippage** (0–10 pts): same logic as entry slippage.

### Risk Management (0–20 pts)
- **R-multiple** (0–10 pts): `netPnl / avgLoss[contractName]`. R ≥ 2.0 = 10, R 1.0–2.0 = 7, R 0.5–1.0 = 4, R < 0.5 = 0.
- **Streak context** (0–10 pts): If trade follows 3+ consecutive losses, award 10 pts for any winning trade (discipline). If trade is a large loss during a winning streak (revenge trading signal), penalize 5 pts.

---

## Pattern Detection (`lib/analytics/patterns.ts`)

```ts
analyzeTimeOfDay(trades)     // bucket by 30-min window, return winRate + avgPnl per bucket
analyzeDayOfWeek(trades)     // Mon–Fri breakdown
analyzeInstruments(trades)   // per-contractName: winRate, profitFactor, avgPnl, tradeCount
analyzeStreaks(trades)        // currentStreak, maxWinStreak, maxLossStreak, longestUnderwater
analyzeEdgeDecay(trades, 20) // rolling 20-trade winRate series, flag if drops >15pp
```

---

## API Routes (Next.js Route Handlers in `app/api/`)

```
GET  /api/health                    → { status, lastSync, tokenValid }
GET  /api/auth/status               → { connected, accountId, expiresAt }
POST /api/auth/connect              → triggers token request
POST /api/sync                      → pull fills, rebuild trades → { fillsAdded, tradesBuilt }
GET  /api/sync/status               → last SyncLog row
GET  /api/trades                    → paginated, ?limit&offset&contract&from&to
GET  /api/trades/:id                → single trade + score breakdown
GET  /api/metrics                   → MetricsSummary + equityCurve[] + drawdown[]
GET  /api/patterns                  → { timeOfDay, dayOfWeek, instruments, streaks, edgeDecay }
GET  /api/scores/distribution       → histogram by 10-pt bracket
GET  /api/scores/best?limit=10      → top N trades
GET  /api/scores/worst?limit=10     → bottom N trades
```

Route handlers import directly from `lib/` — no separate server process needed.

---

## Dashboard Pages

| Page | Route | Data Sources |
|------|-------|-------------|
| Dashboard | `/` | `/api/metrics`, `/api/trades?limit=20` |
| Trades | `/trades` | `/api/trades` (paginated + filtered) |
| Trade Detail | `/trades/:id` | `/api/trades/:id` |
| Analytics | `/analytics` | `/api/metrics`, `/api/scores/distribution` |
| Patterns | `/patterns` | `/api/patterns` |

Pages are Next.js Server Components where possible; chart components are `'use client'`.

**Dark theme**: `#0f0f0f` background, `#1a1a1a` cards, `#22c55e` profit green, `#ef4444` loss red, `#38bdf8` accent blue. Tailwind CSS for layout.

---

## Implementation Sequence

1. **Bootstrap**: `npx create-next-app@latest` with TypeScript + Tailwind + App Router, add Prisma + Recharts
2. **Database**: `prisma/schema.prisma` → `prisma migrate dev`
3. **Auth pipeline**: `lib/core/config.ts` → `lib/tradovate/auth.ts` → `lib/tradovate/client.ts`
4. **Data fetching**: `lib/tradovate/accounts.ts` → `lib/tradovate/fills.ts`
5. **Sync service**: `lib/db/prisma.ts` → `lib/db/syncService.ts`
6. **Analytics core**: `tradeBuilder.ts` → `metrics.ts` → `patterns.ts` → `scorer.ts`
7. **API route handlers**: all files under `app/api/`
8. **Root layout + globals**: `app/layout.tsx` with dark theme, sidebar nav, `app/globals.css`
9. **Components**: StatCard, MetricCards, ScoreBadge, TradeTable, chart components (`'use client'`)
10. **Pages**: Dashboard → Trades → TradeDetail → Analytics → Patterns

---

## User Guide: Getting Tradovate API Credentials

Before running the app, you need to obtain credentials from Tradovate. All of these are free to get with a demo account.

### Step 1 — Create a Tradovate Demo Account
1. Go to **https://trader.tradovate.com** and sign up for a free account
2. Select **Demo** when prompted for account type (no real money required)
3. Confirm your email and log in

### Step 2 — Register an API Application
1. Log in to the Tradovate web platform at **https://trader.tradovate.com**
2. Go to **Account** → **API Access** (or navigate to **https://trader.tradovate.com/account/api-access**)
3. Click **Create New Application**
4. Fill in:
   - **App Name**: anything (e.g. `perf-dashboard`)
   - **Redirect URI**: `http://localhost:3000` (only used for OAuth browser flow; not needed for password grant)
5. Click **Save** — you will be shown:
   - `App ID` → this is your `TRADOVATE_APP_ID`
   - `App Secret` → this is your `TRADOVATE_APP_SECRET`
   - `CID` (client ID number) → this is your `TRADOVATE_CID`

> **Note**: If you don't see an API Access menu, contact Tradovate support at **technology@tradovate.com** to have API access enabled on your account.

### Step 3 — Gather Your Credentials

Copy these into your `.env.local` file:

```bash
# Your Tradovate login credentials
TRADOVATE_USERNAME=your_email@example.com
TRADOVATE_PASSWORD=your_tradovate_password

# From the API application you created in Step 2
TRADOVATE_APP_ID=perf-dashboard          # the App Name you entered
TRADOVATE_APP_SECRET=xxxxxxxxxxxxxxxxxxxx # the App Secret shown after saving
TRADOVATE_CID=12345                       # the numeric CID shown after saving

# Generate once and keep stable — paste any UUID here
# Mac/Linux: run `uuidgen` in your terminal
TRADOVATE_DEVICE_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# "demo" to use demo.tradovateapi.com, "live" for live.tradovateapi.com
TRADOVATE_ENVIRONMENT=demo

# Leave as-is for local development
DATABASE_URL=file:./data/tradovate.db
```

### Step 4 — Generate a Device ID
Tradovate requires a stable unique identifier per device. Generate it **once** and never change it:

```bash
# On Mac/Linux:
uuidgen

# On Windows PowerShell:
[guid]::NewGuid()
```

Paste the output as `TRADOVATE_DEVICE_ID` in your `.env.local`. If you regenerate it, Tradovate may treat your app as a new device and require re-authentication.

### Step 5 — Find Your Account ID (optional)
If you have multiple accounts, you can pin a specific one:
1. After the app starts, call `GET /api/auth/status` — it returns all accounts
2. Copy the `id` of the account you want to use
3. Add `TRADOVATE_ACCOUNT_ID=12345` to `.env.local`

If omitted, the app automatically picks your first active account.

---

## Verification

1. `npx prisma migrate dev` — migrations apply cleanly
2. Set `.env.local` with demo credentials → `POST /api/auth/connect` returns 200 with `accountId`
3. `POST /api/sync` → fills appear in SQLite, trades are built, SyncLog shows `status: "ok"`
4. `GET /api/metrics` → returns non-empty equity curve and numeric Sharpe/drawdown values
5. `GET /api/patterns` → returns time-of-day buckets and instrument stats
6. `npm run dev` → Next.js app at `localhost:3000`, dashboard shows metrics cards and equity curve
7. Navigate to `/trades` → trade table loads with score badges
8. Click a trade → detail page shows three score bars and notes
