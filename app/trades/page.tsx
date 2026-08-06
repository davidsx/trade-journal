import Link from "next/link";
import type { Prisma } from "@/app/generated/prisma/client";
import { getActiveAccountId } from "@/lib/activeAccount";
import { tradesWhere } from "@/lib/accountScope";
import { prisma } from "@/lib/db/prisma";
import TradeTable from "@/components/TradeTable";
import ClearTradesButton from "@/components/ClearTradesButton";
import TradingCalendar from "@/components/TradingCalendar";

const VALID_SORT_FIELDS = ["entryTime", "netPnl", "holdingMins"] as const;
type SortField = (typeof VALID_SORT_FIELDS)[number];

export default async function TradesPage({
  searchParams,
}: {
  searchParams: Promise<{ offset?: string; contract?: string; from?: string; to?: string; sort?: string; dir?: string; scope?: string }>;
}) {
  const params = await searchParams;
  const offset = Number(params.offset ?? 0);
  const allMode = params.scope === "all";
  const limit = 50;
  const contract = params.contract;
  const from = params.from;
  const to = params.to;
  const sortBy: SortField = VALID_SORT_FIELDS.includes(params.sort as SortField)
    ? (params.sort as SortField)
    : "entryTime";
  const sortDir: "asc" | "desc" = params.dir === "asc" ? "asc" : "desc";

  const accountId = await getActiveAccountId();

  // "all" mode spans every non-hidden account; otherwise scope to the active account.
  const hiddenAccounts = allMode
    ? await prisma.account.findMany({ where: { hiddenFromStats: true }, select: { id: true } })
    : [];
  const hiddenIds = hiddenAccounts.map((a) => a.id);
  const scopeWhere: Prisma.TradeWhereInput = allMode
    ? hiddenIds.length > 0
      ? { accountId: { notIn: hiddenIds } }
      : {}
    : tradesWhere(accountId);

  const filter: Prisma.TradeWhereInput = { ...scopeWhere };
  if (contract) filter.contractName = contract;
  if (from || to) {
    filter.entryTime = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }
  const where = filter;

  const [trades, total] = await Promise.all([
    prisma.trade.findMany({
      where,
      orderBy: { [sortBy]: sortDir },
      take: limit,
      skip: offset,
    }),
    prisma.trade.count({ where }),
  ]);

  const contracts = await prisma.trade.findMany({
    where: scopeWhere,
    distinct: ["contractName"],
    select: { contractName: true },
  });

  // Calendar follows the same scope as the rest of the page.
  const calendarTrades = await prisma.trade.findMany({
    where: scopeWhere,
    orderBy: { entryTime: "asc" },
  });

  // Preserve the current filters/sort when toggling scope (drop offset — page 1).
  const scopeToggleQuery = new URLSearchParams({
    ...(contract ? { contract } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    sort: sortBy,
    dir: sortDir,
    ...(allMode ? {} : { scope: "all" }),
  }).toString();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-semibold">Trade Log</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            {total} {allMode ? "trades across all accounts" : "total trades"}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            href={`/trades${scopeToggleQuery ? `?${scopeToggleQuery}` : ""}`}
            scroll={false}
            className="text-sm px-3 py-1.5 rounded-md font-medium"
            style={
              allMode
                ? { background: "var(--accent)", color: "#000" }
                : { border: "1px solid var(--bg-border)", color: "var(--text-secondary)" }
            }
          >
            {allMode ? "Viewing all accounts" : "View all accounts"}
          </Link>
          <ClearTradesButton />
        </div>
      </div>

      {allMode ? (
        <div
          className="rounded-lg px-4 py-3 flex items-center gap-2 text-sm font-medium"
          style={{
            background: "color-mix(in srgb, var(--accent) 18%, var(--bg-card))",
            border: "1px solid color-mix(in srgb, var(--accent) 40%, var(--bg-border))",
            color: "var(--accent)",
          }}
        >
          <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ background: "var(--accent)", color: "#000" }}>
            All accounts
          </span>
          Showing trades across every account
          {hiddenIds.length > 0 ? ` (${hiddenIds.length} account${hiddenIds.length === 1 ? "" : "s"} hidden)` : ""}. Switch back to see only the active account.
        </div>
      ) : null}

      {/* Calendar — client aggregates by CME/HKT trading day */}
      <div
        className="rounded-lg p-4"
        style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)" }}
      >
        <TradingCalendar
          trades={calendarTrades.map((t) => ({
            id: t.id,
            contractName: t.contractName,
            direction: t.direction,
            entryTime: t.entryTime.toISOString(),
            exitTime: t.exitTime.toISOString(),
            entryPrice: t.entryPrice,
            exitPrice: t.exitPrice,
            netPnl: t.netPnl,
            holdingMins: t.holdingMins,
          }))}
        />
      </div>

      {/* Filters */}
      <form className="flex gap-3 flex-wrap">
        {allMode ? <input type="hidden" name="scope" value="all" /> : null}
        <select
          name="contract"
          defaultValue={contract ?? ""}
          className="rounded px-3 py-1.5 text-sm"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--bg-border)",
            color: "var(--text-primary)",
          }}
        >
          <option value="">All instruments</option>
          {contracts.map((c) => (
            <option key={c.contractName} value={c.contractName}>
              {c.contractName}
            </option>
          ))}
        </select>
        <input
          type="date"
          name="from"
          defaultValue={from ?? ""}
          className="rounded px-3 py-1.5 text-sm"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--bg-border)",
            color: "var(--text-primary)",
          }}
        />
        <input
          type="date"
          name="to"
          defaultValue={to ?? ""}
          className="rounded px-3 py-1.5 text-sm"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--bg-border)",
            color: "var(--text-primary)",
          }}
        />
        <button
          type="submit"
          className="rounded px-4 py-1.5 text-sm font-medium"
          style={{ background: "var(--accent)", color: "#000" }}
        >
          Filter
        </button>
      </form>

      <TradeTable
        trades={trades}
        sortBy={sortBy}
        sortDir={sortDir}
        queryParams={{
          ...(contract ? { contract } : {}),
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
          ...(allMode ? { scope: "all" } : {}),
        }}
      />

      {/* Pagination */}
      {total > limit && (
        <div className="flex items-center gap-4 text-sm" style={{ color: "var(--text-secondary)" }}>
          <span>
            {offset + 1}–{Math.min(offset + limit, total)} of {total}
          </span>
          <div className="flex gap-2">
            {offset > 0 && (
              <a
                href={`/trades?${new URLSearchParams({ ...(contract ? { contract } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}), sort: sortBy, dir: sortDir, ...(allMode ? { scope: "all" } : {}), offset: String(Math.max(0, offset - limit)) })}`}
                className="px-3 py-1 rounded"
                style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)" }}
              >
                ← Prev
              </a>
            )}
            {offset + limit < total && (
              <a
                href={`/trades?${new URLSearchParams({ ...(contract ? { contract } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}), sort: sortBy, dir: sortDir, ...(allMode ? { scope: "all" } : {}), offset: String(offset + limit) })}`}
                className="px-3 py-1 rounded"
                style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)" }}
              >
                Next →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
