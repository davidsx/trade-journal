import { prisma } from "@/lib/db/prisma";
import TradeTable from "@/components/TradeTable";
import RescoreButton from "@/components/RescoreButton";

const VALID_SORT_FIELDS = ["entryTime", "netPnl", "qualityScore", "holdingMins"] as const;
type SortField = (typeof VALID_SORT_FIELDS)[number];

export default async function TradesPage({
  searchParams,
}: {
  searchParams: Promise<{ offset?: string; contract?: string; from?: string; to?: string; sort?: string; dir?: string }>;
}) {
  const params = await searchParams;
  const offset = Number(params.offset ?? 0);
  const limit = 50;
  const contract = params.contract;
  const from = params.from;
  const to = params.to;
  const sortBy: SortField = VALID_SORT_FIELDS.includes(params.sort as SortField)
    ? (params.sort as SortField)
    : "entryTime";
  const sortDir: "asc" | "desc" = params.dir === "asc" ? "asc" : "desc";

  const where: Record<string, unknown> = {};
  if (contract) where.contractName = contract;
  if (from || to) {
    where.entryTime = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }

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
    distinct: ["contractName"],
    select: { contractName: true },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-semibold">Trade Log</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            {total} total trades
          </p>
        </div>
        <RescoreButton />
      </div>

      {/* Filters */}
      <form className="flex gap-3 flex-wrap">
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
                href={`/trades?${new URLSearchParams({ ...(contract ? { contract } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}), sort: sortBy, dir: sortDir, offset: String(Math.max(0, offset - limit)) })}`}
                className="px-3 py-1 rounded"
                style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)" }}
              >
                ← Prev
              </a>
            )}
            {offset + limit < total && (
              <a
                href={`/trades?${new URLSearchParams({ ...(contract ? { contract } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}), sort: sortBy, dir: sortDir, offset: String(offset + limit) })}`}
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
