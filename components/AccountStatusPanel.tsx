import Link from "next/link";
import type { AccountStage, AccountStatus } from "@/components/AccountsManager";

export type AccountStatusRow = {
  id: number;
  label: string;
  stage: AccountStage;
  status: AccountStatus;
  numberOfAccounts: number;
  pnl: number;
  tradeCount: number;
};

function fmtUsd(v: number) {
  return `${v >= 0 ? "+" : "-"}$${Math.abs(v).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function StageColumn({ title, rows }: { title: string; rows: AccountStatusRow[] }) {
  const running = rows.filter((r) => r.status !== "Breached");
  const breachedCount = rows
    .filter((r) => r.status === "Breached")
    .reduce((sum, r) => sum + r.numberOfAccounts, 0);
  const runningCount = running.reduce((sum, r) => sum + r.numberOfAccounts, 0);
  const combinedPnl = running.reduce((sum, r) => sum + r.pnl, 0);

  return (
    <div
      className="rounded-lg p-4 flex flex-col gap-3"
      style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)" }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          {title}
        </span>
        <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
          {runningCount} running
        </span>
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Combined P&amp;L
        </span>
        <span
          className="text-lg font-semibold tabular-nums"
          style={{ color: running.length === 0 ? "var(--text-muted)" : combinedPnl >= 0 ? "var(--profit)" : "var(--loss)" }}
        >
          {running.length === 0 ? "—" : fmtUsd(combinedPnl)}
        </span>
      </div>

      {running.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {running.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate" style={{ color: "var(--text-secondary)" }}>
                {r.label}
                {r.numberOfAccounts > 1 ? (
                  <span className="ml-1 text-xs" style={{ color: "var(--text-muted)" }}>
                    ×{r.numberOfAccounts}
                  </span>
                ) : null}
              </span>
              <span
                className="shrink-0 tabular-nums"
                style={{
                  color:
                    r.tradeCount === 0
                      ? "var(--text-muted)"
                      : r.pnl >= 0
                      ? "var(--profit)"
                      : "var(--loss)",
                }}
              >
                {r.tradeCount === 0 ? "No trades" : fmtUsd(r.pnl)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          None running.
        </p>
      )}

      {breachedCount > 0 ? (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          {breachedCount} breached (not counted)
        </p>
      ) : null}
    </div>
  );
}

export default function AccountStatusPanel({ accounts }: { accounts: AccountStatusRow[] }) {
  const evals = accounts.filter((a) => a.stage === "Eval");
  const funded = accounts.filter((a) => a.stage === "Funded");

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <h2 className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
          Account status
        </h2>
        <Link
          href="/accounts"
          className="text-xs underline-offset-2 hover:underline"
          style={{ color: "var(--accent)" }}
        >
          Manage
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StageColumn title="Evals" rows={evals} />
        <StageColumn title="Funded" rows={funded} />
      </div>
    </div>
  );
}
