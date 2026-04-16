# Tradovate Performance Review Dashboard

A local trading performance dashboard that imports your Tradovate trade history, computes metrics, scores each trade for quality, and visualizes patterns.

**Stack**: Next.js 14 (App Router) · TypeScript · Prisma 7 + SQLite · Recharts · Tailwind CSS

---

## Quick Start (CSV — no API key required)

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), then click **Import CSV** in the sidebar and upload your Tradovate export.

### How to export from Tradovate

1. Open Tradovate web or desktop
2. Go to **Account → Performance** (the P&L history tab)
3. Click the **Export** or **Download CSV** button
4. Upload the file to the dashboard via the sidebar button

> The dashboard auto-detects direction (Long/Short) and scores every trade immediately on import. Re-importing overwrites previous data.

---

## Getting Your Tradovate API Credentials

### Step 1 — Create a Tradovate Account

1. Go to **https://trader.tradovate.com** and sign up
2. Select **Demo** (free, real market data, fake money)
3. Confirm your email and log in

### Step 2 — Register an API Application

1. Log in at **https://trader.tradovate.com**
2. Go to **Account → API Access**
3. Click **Create New Application**
4. Fill in:
   - **App Name**: anything (e.g. `perf-dashboard`)
   - **Redirect URI**: `http://localhost:3000`
5. Save — you'll be shown:
   - `App ID` → `TRADOVATE_APP_ID`
   - `App Secret` → `TRADOVATE_APP_SECRET`
   - `CID` (numeric) → `TRADOVATE_CID`

> If you don't see API Access, email **technology@tradovate.com** to have it enabled.

### Step 3 — Fill in `.env.local`

```bash
# Your Tradovate login
TRADOVATE_USERNAME=your_email@example.com
TRADOVATE_PASSWORD=your_tradovate_password

# From the API application you created
TRADOVATE_APP_ID=perf-dashboard
TRADOVATE_APP_SECRET=xxxxxxxxxxxxxxxxxxxx
TRADOVATE_CID=12345

# Generate once — see Step 4
TRADOVATE_DEVICE_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# "demo" or "live"
TRADOVATE_ENVIRONMENT=demo

DATABASE_URL=file:./data/tradovate.db
```

### Step 4 — Generate a Device ID

Tradovate requires a stable, permanent device identifier. Generate it **once** and never change it:

```bash
# Mac / Linux
uuidgen

# Windows PowerShell
[guid]::NewGuid()
```

Paste the result as `TRADOVATE_DEVICE_ID`. If you change it, Tradovate treats your app as a new device.

### Step 5 — (Optional) Pin a Specific Account

If you have multiple accounts and want to pin one:

1. Start the app and call `GET /api/auth/status` — it returns all account IDs
2. Add `TRADOVATE_ACCOUNT_ID=12345` to `.env.local`

Otherwise the app auto-selects your first active account.

---

## Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard — 8 stat cards, equity curve, recent trades |
| `/trades` | Full trade log with filters and score badges |
| `/trades/:id` | Trade detail — score breakdown (entry / exit / risk) |
| `/analytics` | Drawdown chart, per-trade P&L bars, score distribution |
| `/patterns` | Time/day heatmaps, instrument breakdown, streak panel |

---

## API Routes

```
POST /api/auth/connect       Connect to Tradovate (triggers OAuth)
GET  /api/auth/status        Token validity
POST /api/sync               Pull fills → rebuild trades → score trades
GET  /api/sync/status        Last sync log
GET  /api/metrics            Summary metrics + equity curve + drawdown
GET  /api/trades             Paginated trade list (?limit&offset&contract&from&to)
GET  /api/trades/:id         Single trade + score notes
GET  /api/patterns           Time-of-day, day-of-week, instruments, streaks
GET  /api/scores/best        Top N trades by quality score
GET  /api/scores/worst       Bottom N trades by quality score
GET  /api/scores/distribution Score histogram (0–100 in 10-pt buckets)
```

---

## Trade Quality Score (0–100)

Each trade is scored across three dimensions:

| Dimension | Max | What it measures |
|-----------|-----|-----------------|
| Entry Quality | 40 | Session timing, position sizing, entry slippage |
| Exit Quality | 40 | P&L vs median winner, hold time, exit slippage |
| Risk Management | 20 | R-multiple vs average loss, streak discipline |

Scores are color-coded: **green ≥ 70**, **yellow 40–69**, **red < 40**.

---

## Pattern Detection

- **Time of day** — 30-min buckets, win rate + avg P&L per bucket
- **Day of week** — Mon–Fri breakdown
- **Instruments** — per-contract win rate, profit factor, warnings if < 40% WR
- **Streaks** — current streak, max win/loss streak, longest underwater period
- **Edge decay** — rolling 20-trade win rate, alerts if drops >15pp vs overall

---

## Database

SQLite at `data/tradovate.db` — created automatically on first run. Never committed (`.gitignore`).

To reset: delete `data/tradovate.db` and re-sync.
