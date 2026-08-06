import { prisma } from "@/lib/db/prisma";
import { getActiveAccountId } from "@/lib/activeAccount";
import AccountsManager from "@/components/AccountsManager";

export default async function AccountsPage() {
  const activeId = await getActiveAccountId();
  const accounts = await prisma.account.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true,
      name: true,
      propfirmName: true,
      description: true,
      status: true,
      numberOfAccounts: true,
      stage: true,
      cost: true,
      hiddenFromStats: true,
      initialBalance: true,
      createdAt: true,
      _count: { select: { trades: true } },
      payouts: {
        orderBy: { date: "desc" },
        select: { id: true, amount: true, date: true, note: true },
      },
    },
  });

  const pnlByAccount = await prisma.trade.groupBy({
    by: ["accountId"],
    _sum: { netPnl: true },
  });
  const pnlMap = new Map(pnlByAccount.map((g) => [g.accountId, g._sum.netPnl ?? 0]));

  return (
    <div className="space-y-6">
      <div className="max-w-3xl">
        <h1 className="text-xl font-semibold">Accounts</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Starting capital is stored on each account (one value per account). It drives the equity curve, per-trade
          capital, and CSV import. Switch account from the sidebar; the active account sets which data you see
          everywhere.
        </p>
      </div>

      <AccountsManager
        initialAccounts={accounts.map((a) => ({
          id: a.id,
          name: a.name,
          propfirmName: a.propfirmName,
          description: a.description,
          status: a.status,
          numberOfAccounts: a.numberOfAccounts,
          stage: a.stage,
          cost: a.cost,
          payout: a.payouts.reduce((sum, p) => sum + p.amount, 0),
          payouts: a.payouts.map((p) => ({
            id: p.id,
            amount: p.amount,
            date: p.date.toISOString(),
            note: p.note,
          })),
          hiddenFromStats: a.hiddenFromStats,
          pnl: pnlMap.get(a.id) ?? 0,
          initialBalance: a.initialBalance,
          createdAt: a.createdAt.toISOString(),
          tradeCount: a._count.trades,
        }))}
        activeId={activeId}
      />
    </div>
  );
}
