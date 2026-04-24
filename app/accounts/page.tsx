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
      initialBalance: true,
      createdAt: true,
      _count: { select: { trades: true } },
    },
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
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
          initialBalance: a.initialBalance,
          createdAt: a.createdAt.toISOString(),
          tradeCount: a._count.trades,
        }))}
        activeId={activeId}
      />
    </div>
  );
}
