# Trading Performance Review

A local dashboard that imports a **Performance CSV** (e.g. from Tradovate), scores trades, and surfaces metrics, patterns, and charts.

**Stack**: Next.js (App Router) · TypeScript · Prisma 7 + PostgreSQL ([Neon](https://neon.tech)) · Recharts · Tailwind CSS

---

## Quick start

1. Create a **Neon** project and branch (free tier is fine). In the Neon dashboard, copy:
   - **Pooled** connection string → use as `DATABASE_URL` (used by the app at runtime).
   - **Direct** connection string → use as `DIRECT_URL` (used by `prisma migrate`; avoids pooler issues with DDL).

2. Copy `.env.example` to `.env.local` in the repo root and replace the placeholders with your Neon URLs:

```bash
DATABASE_URL="postgresql://…?sslmode=verify-full"
DIRECT_URL="postgresql://…?sslmode=verify-full"
```

If Neon’s dashboard gives `sslmode=require`, change it to **`verify-full`** in both URLs (Neon supports it). That matches what the **`pg`** driver recommends today and removes the Node **SSL modes deprecation** warning at startup.

**Difference:** **`DATABASE_URL`** should be Neon’s **pooled** URL (via their pooler, e.g. `-pooler` in the host). The Next.js app uses it for every request—good for serverless and many concurrent connections. **`DIRECT_URL`** should be the **non-pooled** URL (host like `ep-…` without `-pooler`). Prisma Migrate talks to Postgres for DDL and migration bookkeeping; going **through** the pooler can break or confuse that, so `prisma.config.ts` uses `DIRECT_URL` first, then falls back to `DATABASE_URL` if you omit it (fine for a single direct URL, e.g. local Postgres—set both to the same string).

3. Install and run the app ( **`npm run dev` runs `prisma migrate deploy` first** so tables exist on Neon):

```bash
npm install
npm run dev
```

To apply migrations without starting Next.js: **`npm run db:migrate`**.

If **`The table public.Trade does not exist`** still appears, the app is connecting to a database where migrations never succeeded. Confirm **`DATABASE_URL`** / **`DIRECT_URL`** in `.env.local` point at the intended Neon branch, then run **`npm run db:migrate`** and check for errors. Prisma CLI loads `.env` then `.env.local` via `prisma.config.ts` (same as documented above).

If the dev server crashes with **Turbopack / `.next` cache** errors, stop it and run `rm -rf .next` before `npm run dev` again.

Open [http://localhost:3000](http://localhost:3000), then use **Import CSV** in the sidebar.

### CSV export (Tradovate)

1. Open Tradovate web or desktop  
2. **Account → Performance** (P&L history)  
3. **Export** / **Download CSV**  
4. Upload the file in the app  

Re-importing **replaces** trades for the fixed CSV account (`accountId = 1` in `app/api/import/route.ts`).

---

## Deploy (e.g. Vercel)

- Set **`DATABASE_URL`** and **`DIRECT_URL`** in the project environment (same values as locally, or Neon branch-specific URLs for preview).
- Build runs **`prisma generate`** via `postinstall` / `build`. Run **`npx prisma migrate deploy`** once against the production database (from your machine or CI) whenever you add migrations.

---

## Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard — stats, equity curve, recent trades |
| `/trades` | Trade log with filters and score badges |
| `/trades/:id` | Trade detail — score breakdown |
| `/analytics` | Drawdown, P&L bars, score distribution |
| `/patterns` | Time/day heatmaps, instruments, streaks |
| `/chart` | Candle chart with trade markers |

---

## API routes

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/health` | App + database connectivity |
| `POST` | `/api/import` | Upload CSV → replace scored trades for the CSV account |
| `GET` | `/api/candles` | Yahoo / yfinance 1m candles (optional `period1`/`period2`; default range from trades in DB) |
| `GET` | `/api/metrics` | Summary metrics, equity curve, drawdown series |
| `GET` | `/api/trades` | Paginated trades (`limit`, `offset`, `contract`, `from`, `to`) |
| `GET` | `/api/trades/:id` | Single trade + score notes |
| `GET` | `/api/patterns` | Time-of-day, day-of-week, instruments, streaks |
| `GET` | `/api/insights` | Insight summaries used by the insights page |
| `GET` | `/api/scores/best` | Top trades by quality score |
| `GET` | `/api/scores/worst` | Bottom trades by quality score |
| `GET` | `/api/scores/distribution` | Score histogram buckets |
| `POST` | `/api/rescore` | Re-run scoring over trades in DB |

---

## Database & Prisma 7

- **Runtime**: `lib/db/prisma.ts` uses `@prisma/adapter-pg` with **`DATABASE_URL`** (Neon pooled URL on serverless is OK).
- **Migrations**: `prisma.config.ts` uses **`DIRECT_URL`**, falling back to **`DATABASE_URL`** if `DIRECT_URL` is unset. Prefer setting both for Neon.

---

## Trade quality score (0–100)

Entry (40) · Exit (40) · Risk (20). Color bands: **green ≥ 70**, **yellow 40–69**, **red < 40**.
