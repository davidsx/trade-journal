import { getActiveAccountId } from "@/lib/activeAccount";
import { tradesWhere } from "@/lib/accountScope";
import { prisma } from "@/lib/db/prisma";
import { computeSummaryMetrics } from "@/lib/analytics/metrics";
import { getAccountSettings } from "@/lib/accountSettings";
import TradingCalendar from "@/components/TradingCalendar";
import AccountStatusPanel from "@/components/AccountStatusPanel";
import CsvUpload from "@/components/CsvUpload";
import { accountLabel } from "@/lib/accountLabel";

export default async function DashboardPage() {
  const [settings, accountId] = await Promise.all([getAccountSettings(), getActiveAccountId()]);
  const trades = await prisma.trade.findMany({ where: tradesWhere(accountId), orderBy: { entryTime: "asc" } });

  // Calendar aggregates every non-hidden account (running, breached, and passed alike);
  // only accounts explicitly hidden from stats are excluded.
  const hiddenAccounts = await prisma.account.findMany({
    where: { hiddenFromStats: true },
    select: { id: true },
  });
  const hiddenIds = hiddenAccounts.map((a) => a.id);
  const calendarTrades = await prisma.trade.findMany({
    where: hiddenIds.length > 0 ? { accountId: { notIn: hiddenIds } } : {},
    orderBy: { entryTime: "asc" },
  });

  // Cross-account status: running (non-breached) evals + funded. Hidden accounts are excluded.
  const [statusAccounts, pnlByAccount] = await Promise.all([
    prisma.account.findMany({
      where: { hiddenFromStats: false },
      orderBy: { id: "asc" },
      select: {
        id: true,
        name: true,
        propfirmName: true,
        initialBalance: true,
        stage: true,
        status: true,
        numberOfAccounts: true,
        cost: true,
        payout: true,
        _count: { select: { trades: true } },
      },
    }),
    prisma.trade.groupBy({ by: ["accountId"], _sum: { netPnl: true } }),
  ]);
  const pnlMap = new Map(pnlByAccount.map((g) => [g.accountId, g._sum.netPnl ?? 0]));
  // Import destinations: hidden accounts are already excluded above; also drop breached ones.
  const importAccounts = statusAccounts
    .filter((a) => a.status !== "Breached")
    .map((a) => ({
      id: a.id,
      name: a.name,
      initialBalance: a.initialBalance,
      propfirmName: a.propfirmName,
    }));
  // Passed evals are cleared/awaiting funding — exclude from status metrics (but not economics).
  const statusRows = statusAccounts
    .filter((a) => a.status !== "Passed")
    .map((a) => ({
      id: a.id,
      label: accountLabel(a),
      stage: a.stage as "Eval" | "Funded",
      status: a.status,
      numberOfAccounts: a.numberOfAccounts,
      pnl: pnlMap.get(a.id) ?? 0,
      tradeCount: a._count.trades,
    }));

  // Cost / payout totals across non-hidden accounts (both are per-row totals already).
  const totalCost = statusAccounts.reduce((sum, a) => sum + a.cost, 0);
  const totalPayout = statusAccounts.reduce((sum, a) => sum + a.payout, 0);
  const netAfterFees = totalPayout - totalCost;

  const metrics = computeSummaryMetrics(trades, {
    initialBalance: settings.initialBalance,
  });

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <CsvUpload variant="inline" accounts={importAccounts} defaultAccountId={accountId} />
        </div>
      </div>

      {/* Cross-account status: running evals + funded */}
      <AccountStatusPanel accounts={statusRows} />

      {/* Account economics — cost paid vs payouts received */}
      <div
        className="rounded-lg p-4"
        style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)" }}
      >
        <h2 className="text-sm font-medium mb-3" style={{ color: "var(--text-secondary)" }}>
          Account economics
        </h2>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>
              Total cost
            </div>
            <div className="font-semibold text-lg tabular-nums" style={{ color: "var(--text-primary)" }}>
              ${totalCost.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>
              Total payout
            </div>
            <div
              className="font-semibold text-lg tabular-nums"
              style={{ color: totalPayout > 0 ? "var(--profit)" : "var(--text-primary)" }}
            >
              ${totalPayout.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>
              Payout − cost
            </div>
            <div
              className="font-semibold text-lg tabular-nums"
              style={{
                color:
                  netAfterFees > 0 ? "var(--profit)" : netAfterFees < 0 ? "var(--loss)" : "var(--text-primary)",
              }}
            >
              {netAfterFees >= 0 ? "+" : "−"}${Math.abs(netAfterFees).toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </div>
          </div>
        </div>
      </div>

      {/* Calendar — client aggregates by local exit date */}
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
    </div>
  );
}
