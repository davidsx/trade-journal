"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  createAccountAction,
  deleteAccountAction,
  renameAccountAction,
  setAccountHiddenFromStatsAction,
  switchAccountAction,
  updateAccountDetailsAction,
  updateAccountInitialBalanceAction,
} from "@/app/accounts/actions";
import { DEFAULT_INITIAL_BALANCE } from "@/lib/accountConstants";
import CsvUpload from "@/components/CsvUpload";
import { accountLabel } from "@/lib/accountLabel";

export type AccountStage = "Eval" | "Funded";
export type AccountStatus = "Running" | "Passed" | "Breached";

/** Statuses selectable per type: Funded has no "Passed" phase (eval-only). */
function allowedStatuses(stage: AccountStage): AccountStatus[] {
  return stage === "Funded" ? ["Running", "Breached"] : ["Running", "Passed", "Breached"];
}

const PROPFIRM_OPTIONS = ["Lucid", "Tradeify", "Apex", "FundedNext", "Topstep"] as const;

/** Selectable starting-capital account sizes ($). */
const CAPITAL_OPTIONS = [25_000, 50_000, 100_000, 150_000] as const;

export type AccountRow = {
  id: number;
  name: string;
  propfirmName: string | null;
  description: string | null;
  status: AccountStatus;
  numberOfAccounts: number;
  stage: AccountStage;
  cost: number;
  payout: number;
  hiddenFromStats: boolean;
  pnl: number;
  initialBalance: number;
  createdAt: string;
  tradeCount: number;
};

type Props = {
  initialAccounts: AccountRow[];
  activeId: number;
};

export default function AccountsManager({ initialAccounts, activeId }: Props) {
  const router = useRouter();
  const [accounts, setAccounts] = useState(initialAccounts);
  useEffect(() => {
    setAccounts(initialAccounts);
  }, [initialAccounts]);
  const emptyNewAccount = {
    name: "",
    initialBalance: String(DEFAULT_INITIAL_BALANCE),
    cost: "0",
    propfirmName: "",
    stage: "Eval" as AccountStage,
    numberOfAccounts: "1",
    description: "",
  };
  const [newAccount, setNewAccount] = useState(emptyNewAccount);
  const [addOpen, setAddOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [deleting, setDeleting] = useState<AccountRow | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [editAcct, setEditAcct] = useState<AccountRow | null>(null);
  const [editForm, setEditForm] = useState({ name: "", propfirmName: "", initialBalance: "" });
  const [costEditId, setCostEditId] = useState<number | null>(null);
  const [costValue, setCostValue] = useState("");
  const [payoutEditId, setPayoutEditId] = useState<number | null>(null);
  const [payoutValue, setPayoutValue] = useState("");
  const [showHidden, setShowHidden] = useState(false);

  const totalCost = accounts.reduce((sum, a) => sum + a.cost * a.numberOfAccounts, 0);
  const totalPayout = accounts.reduce((sum, a) => sum + a.payout, 0);
  const hiddenCount = accounts.filter((a) => a.hiddenFromStats).length;
  const visibleAccounts = showHidden ? accounts : accounts.filter((a) => !a.hiddenFromStats);

  function refresh() {
    router.refresh();
  }

  function handleSwitch(id: number) {
    setError(null);
    startTransition(async () => {
      const r = await switchAccountAction(id);
      if ("error" in r && r.error) {
        setError(r.error);
        return;
      }
      refresh();
    });
  }

  function openAdd() {
    setError(null);
    setNewAccount(emptyNewAccount);
    setAddOpen(true);
  }

  function closeAdd() {
    setAddOpen(false);
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const n = newAccount.name.trim();
    if (!n) return;
    const initialBalance = parseFloat(newAccount.initialBalance);
    if (!Number.isFinite(initialBalance) || initialBalance <= 0) {
      setError("Starting capital must be a positive number");
      return;
    }
    const cost = parseFloat(newAccount.cost);
    if (!Number.isFinite(cost) || cost < 0) {
      setError("Cost must be a non-negative number");
      return;
    }
    const numberOfAccounts = parseInt(newAccount.numberOfAccounts, 10);
    if (!Number.isInteger(numberOfAccounts) || numberOfAccounts < 1) {
      setError("Number of accounts must be a positive whole number");
      return;
    }
    startTransition(async () => {
      const r = await createAccountAction({
        name: n,
        initialBalance,
        cost,
        propfirmName: newAccount.propfirmName || null,
        stage: newAccount.stage,
        numberOfAccounts,
        description: newAccount.description.trim() || null,
      });
      if ("error" in r && r.error) {
        setError(r.error);
        return;
      }
      setNewAccount(emptyNewAccount);
      setAddOpen(false);
      refresh();
    });
  }

  function startEdit(a: AccountRow) {
    setError(null);
    setEditAcct(a);
    setEditForm({
      name: a.name,
      propfirmName: a.propfirmName ?? "",
      initialBalance: String(a.initialBalance),
    });
  }

  function closeEdit() {
    setEditAcct(null);
  }

  function saveEditModal(e: React.FormEvent) {
    e.preventDefault();
    if (!editAcct) return;
    setError(null);
    const a = editAcct;
    const name = editForm.name.trim();
    if (!name) {
      setError("Name is required");
      return;
    }
    const initialBalance = parseFloat(editForm.initialBalance);
    if (!Number.isFinite(initialBalance) || initialBalance <= 0) {
      setError("Starting capital must be a positive number");
      return;
    }
    const nextPropfirm = editForm.propfirmName || null;
    const nameChanged = name !== a.name;
    const propfirmChanged = nextPropfirm !== a.propfirmName;
    const capitalChanged = Math.round(initialBalance) !== a.initialBalance;

    startTransition(async () => {
      if (nameChanged) {
        const r = await renameAccountAction(a.id, name);
        if ("error" in r && r.error) {
          setError(r.error);
          return;
        }
      }
      if (propfirmChanged) {
        const r = await updateAccountDetailsAction(a.id, {
          propfirmName: nextPropfirm,
          description: a.description,
          status: a.status,
          numberOfAccounts: a.numberOfAccounts,
          stage: a.stage,
          cost: a.cost,
          payout: a.payout,
        });
        if ("error" in r && r.error) {
          setError(r.error);
          return;
        }
      }
      if (capitalChanged) {
        const r = await updateAccountInitialBalanceAction(a.id, initialBalance);
        if ("error" in r && r.error) {
          setError(r.error);
          return;
        }
      }
      setAccounts((rows) =>
        rows.map((x) =>
          x.id === a.id
            ? { ...x, name, propfirmName: nextPropfirm, initialBalance: Math.round(initialBalance) }
            : x
        )
      );
      setEditAcct(null);
      refresh();
    });
  }

  function toggleStage(a: AccountRow) {
    setError(null);
    const nextStage: AccountStage = a.stage === "Eval" ? "Funded" : "Eval";
    // Funded accounts have no "Passed" phase — coerce it to Running when switching.
    const nextStatus: AccountStatus = allowedStatuses(nextStage).includes(a.status) ? a.status : "Running";
    const payload = {
      propfirmName: a.propfirmName,
      description: a.description,
      status: nextStatus,
      numberOfAccounts: a.numberOfAccounts,
      stage: nextStage,
      cost: a.cost,
      payout: a.payout,
    };
    setAccounts((rows) => rows.map((x) => (x.id === a.id ? { ...x, stage: nextStage, status: nextStatus } : x)));
    startTransition(async () => {
      const r = await updateAccountDetailsAction(a.id, payload);
      if ("error" in r && r.error) {
        setError(r.error);
        setAccounts((rows) => rows.map((x) => (x.id === a.id ? { ...x, stage: a.stage, status: a.status } : x)));
        return;
      }
      refresh();
    });
  }

  function adjustAccountCount(a: AccountRow, delta: number) {
    setError(null);
    const next = a.numberOfAccounts + delta;
    if (next < 1) return;
    const payload = {
      propfirmName: a.propfirmName,
      description: a.description,
      status: a.status,
      numberOfAccounts: next,
      stage: a.stage,
      cost: a.cost,
      payout: a.payout,
    };
    setAccounts((rows) => rows.map((x) => (x.id === a.id ? { ...x, numberOfAccounts: next } : x)));
    startTransition(async () => {
      const r = await updateAccountDetailsAction(a.id, payload);
      if ("error" in r && r.error) {
        setError(r.error);
        setAccounts((rows) => rows.map((x) => (x.id === a.id ? { ...x, numberOfAccounts: a.numberOfAccounts } : x)));
        return;
      }
      refresh();
    });
  }

  function cycleStatus(a: AccountRow) {
    setError(null);
    const order = allowedStatuses(a.stage);
    // Current status may not be in the type's order (e.g. legacy data); fall back to first.
    const idx = order.indexOf(a.status);
    const nextStatus = order[(idx + 1) % order.length];
    const payload = {
      propfirmName: a.propfirmName,
      description: a.description,
      status: nextStatus,
      numberOfAccounts: a.numberOfAccounts,
      stage: a.stage,
      cost: a.cost,
      payout: a.payout,
    };
    setAccounts((rows) => rows.map((x) => (x.id === a.id ? { ...x, status: nextStatus } : x)));
    startTransition(async () => {
      const r = await updateAccountDetailsAction(a.id, payload);
      if ("error" in r && r.error) {
        setError(r.error);
        setAccounts((rows) => rows.map((x) => (x.id === a.id ? { ...x, status: a.status } : x)));
        return;
      }
      refresh();
    });
  }

  function toggleHiddenFromStats(a: AccountRow) {
    setError(null);
    const next = !a.hiddenFromStats;
    setAccounts((rows) => rows.map((x) => (x.id === a.id ? { ...x, hiddenFromStats: next } : x)));
    startTransition(async () => {
      const r = await setAccountHiddenFromStatsAction(a.id, next);
      if ("error" in r && r.error) {
        setError(r.error);
        setAccounts((rows) => rows.map((x) => (x.id === a.id ? { ...x, hiddenFromStats: a.hiddenFromStats } : x)));
        return;
      }
      refresh();
    });
  }

  function startEditCost(a: AccountRow) {
    setCostEditId(a.id);
    setCostValue(String(a.cost));
  }

  function cancelCostEdit() {
    setCostEditId(null);
    setCostValue("");
  }

  function saveCost(a: AccountRow, e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const n = parseFloat(costValue);
    if (!Number.isFinite(n) || n < 0) {
      setError("Cost must be a non-negative number");
      return;
    }
    const payload = {
      propfirmName: a.propfirmName,
      description: a.description,
      status: a.status,
      numberOfAccounts: a.numberOfAccounts,
      stage: a.stage,
      cost: n,
      payout: a.payout,
    };
    setAccounts((rows) => rows.map((x) => (x.id === a.id ? { ...x, cost: n } : x)));
    setCostEditId(null);
    setCostValue("");
    startTransition(async () => {
      const r = await updateAccountDetailsAction(a.id, payload);
      if ("error" in r && r.error) {
        setError(r.error);
        setAccounts((rows) => rows.map((x) => (x.id === a.id ? { ...x, cost: a.cost } : x)));
        return;
      }
      refresh();
    });
  }

  function startEditPayout(a: AccountRow) {
    setPayoutEditId(a.id);
    setPayoutValue(String(a.payout));
  }

  function cancelPayoutEdit() {
    setPayoutEditId(null);
    setPayoutValue("");
  }

  function savePayout(a: AccountRow, e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const n = parseFloat(payoutValue);
    if (!Number.isFinite(n) || n < 0) {
      setError("Payout must be a non-negative number");
      return;
    }
    const payload = {
      propfirmName: a.propfirmName,
      description: a.description,
      status: a.status,
      numberOfAccounts: a.numberOfAccounts,
      stage: a.stage,
      cost: a.cost,
      payout: n,
    };
    setAccounts((rows) => rows.map((x) => (x.id === a.id ? { ...x, payout: n } : x)));
    setPayoutEditId(null);
    setPayoutValue("");
    startTransition(async () => {
      const r = await updateAccountDetailsAction(a.id, payload);
      if ("error" in r && r.error) {
        setError(r.error);
        setAccounts((rows) => rows.map((x) => (x.id === a.id ? { ...x, payout: a.payout } : x)));
        return;
      }
      refresh();
    });
  }

  function requestDelete(a: AccountRow) {
    setDeleting(a);
    setDeleteConfirm("");
    setError(null);
  }

  function closeDelete() {
    setDeleting(null);
    setDeleteConfirm("");
  }

  function confirmDelete() {
    if (!deleting) return;
    if (deleteConfirm.toLowerCase() !== "delete") {
      setError('Type the word "delete" to confirm.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await deleteAccountAction(deleting.id);
      if ("error" in r && r.error) {
        setError(r.error);
        return;
      }
      closeDelete();
      refresh();
    });
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p className="text-sm rounded-md px-3 py-2" style={{ background: "color-mix(in srgb, var(--loss) 12%, var(--bg-card))", color: "var(--loss)" }}>
          {error}
        </p>
      ) : null}

      <div className="flex justify-between items-center gap-2 flex-wrap">
        <div className="flex items-center gap-4 text-sm" style={{ color: "var(--text-secondary)" }}>
          <span>
            Total cost:{" "}
            <span className="font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
              ${totalCost.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </span>
          </span>
          <span>
            Total payout:{" "}
            <span
              className="font-semibold tabular-nums"
              style={{ color: totalPayout > 0 ? "var(--profit)" : "var(--text-primary)" }}
            >
              ${totalPayout.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </span>
          </span>
        </div>
        <div className="flex justify-end items-center gap-2">
          {hiddenCount > 0 ? (
            <button
              type="button"
              onClick={() => setShowHidden((v) => !v)}
              className="px-3 py-2 rounded-md text-sm font-medium"
              style={{
                background: "var(--bg-base)",
                border: "1px solid var(--bg-border)",
                color: "var(--text-secondary)",
              }}
              title={showHidden ? "Hide hidden accounts" : "Show hidden accounts"}
            >
              {showHidden ? "Hide hidden" : `Show hidden (${hiddenCount})`}
            </button>
          ) : null}
          <CsvUpload
            variant="inline"
            accounts={accounts
              .filter((a) => !a.hiddenFromStats && a.status !== "Breached")
              .map((a) => ({
                id: a.id,
                name: a.name,
                initialBalance: a.initialBalance,
                propfirmName: a.propfirmName,
              }))}
            defaultAccountId={activeId}
          />
          <button
            type="button"
            onClick={openAdd}
            disabled={pending}
            className="px-4 py-2 rounded-md text-sm font-medium"
            style={{ background: "var(--accent)", color: "#000", opacity: pending ? 0.6 : 1 }}
          >
            + Add account
          </button>
        </div>
      </div>

      {addOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "color-mix(in srgb, #000 45%, transparent)" }}
          onClick={closeAdd}
        >
          <form
            onSubmit={handleCreate}
            className="w-full max-w-2xl rounded-lg p-5 space-y-4 max-h-[90vh] overflow-y-auto"
            style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
              New account
            </h2>
            {error ? (
              <p
                className="text-sm rounded-md px-3 py-2"
                style={{ background: "color-mix(in srgb, var(--loss) 12%, var(--bg-card))", color: "var(--loss)" }}
              >
                {error}
              </p>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2 lg:col-span-1">
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>
              Name
            </label>
            <input
              value={newAccount.name}
              onChange={(e) => setNewAccount((f) => ({ ...f, name: e.target.value }))}
              maxLength={120}
              required
              placeholder="e.g. Main SIM, Prop firm 2025"
              className="w-full px-3 py-2 rounded-md text-sm"
              style={{ background: "var(--bg-base)", border: "1px solid var(--bg-border)", color: "var(--text-primary)" }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>
              Prop firm
            </label>
            <select
              value={newAccount.propfirmName}
              onChange={(e) => setNewAccount((f) => ({ ...f, propfirmName: e.target.value }))}
              className="w-full px-3 py-2 rounded-md text-sm"
              style={{ background: "var(--bg-base)", border: "1px solid var(--bg-border)", color: "var(--text-primary)" }}
            >
              <option value="">—</option>
              {PROPFIRM_OPTIONS.map((firm) => (
                <option key={firm} value={firm}>
                  {firm}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>
              Stage
            </label>
            <select
              value={newAccount.stage}
              onChange={(e) => setNewAccount((f) => ({ ...f, stage: e.target.value as AccountStage }))}
              className="w-full px-3 py-2 rounded-md text-sm"
              style={{ background: "var(--bg-base)", border: "1px solid var(--bg-border)", color: "var(--text-primary)" }}
            >
              <option value="Eval">Eval</option>
              <option value="Funded">Funded</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>
              Starting capital ($)
            </label>
            <select
              required
              value={newAccount.initialBalance}
              onChange={(e) => setNewAccount((f) => ({ ...f, initialBalance: e.target.value }))}
              className="w-full px-3 py-2 rounded-md text-sm tabular-nums"
              style={{ background: "var(--bg-base)", border: "1px solid var(--bg-border)", color: "var(--text-primary)" }}
            >
              {CAPITAL_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  ${c.toLocaleString("en-US")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>
              Cost ($)
            </label>
            <input
              type="number"
              min={0}
              step="any"
              required
              value={newAccount.cost}
              onChange={(e) => setNewAccount((f) => ({ ...f, cost: e.target.value }))}
              className="w-full px-3 py-2 rounded-md text-sm tabular-nums"
              style={{ background: "var(--bg-base)", border: "1px solid var(--bg-border)", color: "var(--text-primary)" }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>
              # Accounts
            </label>
            <input
              type="number"
              min={1}
              step={1}
              required
              value={newAccount.numberOfAccounts}
              onChange={(e) => setNewAccount((f) => ({ ...f, numberOfAccounts: e.target.value }))}
              className="w-full px-3 py-2 rounded-md text-sm tabular-nums"
              style={{ background: "var(--bg-base)", border: "1px solid var(--bg-border)", color: "var(--text-primary)" }}
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>
              Description
            </label>
            <textarea
              value={newAccount.description}
              onChange={(e) => setNewAccount((f) => ({ ...f, description: e.target.value }))}
              maxLength={1000}
              rows={2}
              placeholder="Notes about this account (optional)"
              className="w-full px-3 py-2 rounded-md text-sm resize-y"
              style={{ background: "var(--bg-base)", border: "1px solid var(--bg-border)", color: "var(--text-primary)" }}
            />
          </div>
        </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeAdd}
                className="text-sm px-3 py-1.5 rounded-md"
                style={{ color: "var(--text-secondary)" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending || !newAccount.name.trim()}
                className="px-4 py-2 rounded-md text-sm font-medium"
                style={{ background: "var(--accent)", color: "#000", opacity: pending || !newAccount.name.trim() ? 0.6 : 1 }}
              >
                {pending ? "…" : "Add account"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="rounded-lg overflow-x-auto" style={{ border: "1px solid var(--bg-border)" }}>
        <table className="w-full text-sm whitespace-nowrap">
          <thead>
            <tr style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--bg-border)" }}>
              <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                #
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                Account
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                Type
              </th>
              <th className="px-4 py-2 text-center text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                Status
              </th>
              <th className="px-4 py-2 text-center text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }} title="Include this account in cross-account calculations">
                In stats
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                # Accts
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                Cost
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                Payout
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                PnL
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                Trades
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleAccounts.map((a, i) => {
              const isActive = a.id === activeId;
              return (
                <tr
                  key={a.id}
                  style={{
                    background: i % 2 === 0 ? "var(--bg-card)" : "var(--bg-base)",
                    borderBottom: "1px solid var(--bg-border)",
                    boxShadow: isActive ? "inset 3px 0 0 0 var(--accent)" : undefined,
                    opacity: a.hiddenFromStats ? 0.55 : 1,
                  }}
                >
                  <td className="px-4 py-2 text-right tabular-nums" style={{ color: "var(--text-muted)" }}>
                    {a.id}
                  </td>
                  <td className="px-4 py-2">
                    <span className="inline-flex items-center gap-1.5">
                      {isActive ? (
                        <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                          {accountLabel(a)}
                          <span
                            className="ml-2 text-[10px] font-semibold uppercase align-middle"
                            style={{ color: "var(--accent)" }}
                          >
                            active
                          </span>
                        </span>
                      ) : a.hiddenFromStats ? (
                        <span
                          className="font-medium text-left"
                          style={{ color: "var(--text-muted)" }}
                          title="Hidden accounts can't be selected — set to Included first"
                        >
                          {accountLabel(a)}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSwitch(a.id)}
                          disabled={pending}
                          className="font-medium text-left hover:underline"
                          style={{ color: "var(--text-primary)" }}
                          title="Switch to this account"
                        >
                          {accountLabel(a)}
                        </button>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      onClick={() => toggleStage(a)}
                      disabled={pending}
                      className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded hover:opacity-80 transition-opacity"
                      style={
                        a.stage === "Funded"
                          ? { background: "color-mix(in srgb, var(--profit) 15%, transparent)", color: "var(--profit)" }
                          : { background: "var(--bg-border)", color: "var(--text-secondary)" }
                      }
                      title={`Click to switch to ${a.stage === "Eval" ? "Funded" : "Eval"}`}
                    >
                      {a.stage}
                    </button>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => cycleStatus(a)}
                      disabled={pending}
                      className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded hover:opacity-80 transition-opacity"
                      style={
                        a.status === "Breached"
                          ? { background: "color-mix(in srgb, var(--loss) 15%, transparent)", color: "var(--loss)" }
                          : a.status === "Passed"
                          ? { background: "color-mix(in srgb, var(--profit) 15%, transparent)", color: "var(--profit)" }
                          : { background: "color-mix(in srgb, var(--accent) 15%, transparent)", color: "var(--accent)" }
                      }
                      title={`Status: ${a.status}. Click to cycle ${allowedStatuses(a.stage).join(" → ")}`}
                    >
                      {a.status}
                    </button>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => toggleHiddenFromStats(a)}
                      disabled={pending}
                      className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded hover:opacity-80 transition-opacity"
                      style={
                        a.hiddenFromStats
                          ? { background: "var(--bg-border)", color: "var(--text-muted)" }
                          : { background: "color-mix(in srgb, var(--accent) 15%, transparent)", color: "var(--accent)" }
                      }
                      title={
                        a.hiddenFromStats
                          ? "Hidden from cross-account calculations — click to include"
                          : "Included in cross-account calculations — click to hide"
                      }
                    >
                      {a.hiddenFromStats ? "Hidden" : "Included"}
                    </button>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => adjustAccountCount(a, -1)}
                        disabled={pending || a.numberOfAccounts <= 1}
                        className="w-6 h-6 rounded flex items-center justify-center leading-none hover:opacity-80 transition-opacity"
                        style={{
                          border: "1px solid var(--bg-border)",
                          color: "var(--text-secondary)",
                          opacity: a.numberOfAccounts <= 1 ? 0.4 : 1,
                        }}
                        title="Remove one account"
                        aria-label="Decrease account count"
                      >
                        −
                      </button>
                      <span className="tabular-nums w-6 text-center" style={{ color: "var(--text-secondary)" }}>
                        {a.numberOfAccounts}
                      </span>
                      <button
                        type="button"
                        onClick={() => adjustAccountCount(a, 1)}
                        disabled={pending}
                        className="w-6 h-6 rounded flex items-center justify-center leading-none hover:opacity-80 transition-opacity"
                        style={{ border: "1px solid var(--bg-border)", color: "var(--text-secondary)" }}
                        title="Add one account"
                        aria-label="Increase account count"
                      >
                        +
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {costEditId === a.id ? (
                      <form onSubmit={(e) => saveCost(a, e)} className="flex flex-wrap items-center justify-end gap-2">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          required
                          value={costValue}
                          onChange={(e) => setCostValue(e.target.value)}
                          className="w-24 px-2 py-1 rounded text-sm text-right"
                          style={{
                            background: "var(--bg-base)",
                            border: "1px solid var(--bg-border)",
                            color: "var(--text-primary)",
                          }}
                          autoFocus
                        />
                        <button
                          type="submit"
                          disabled={pending}
                          className="text-sm px-2 py-1 rounded"
                          style={{ background: "var(--accent)", color: "#000" }}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={cancelCostEdit}
                          className="text-sm"
                          style={{ color: "var(--text-muted)" }}
                        >
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <span className="inline-flex items-center justify-end gap-1.5">
                        ${a.cost.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                        <button
                          type="button"
                          onClick={() => startEditCost(a)}
                          disabled={pending}
                          className="shrink-0 p-1 rounded hover:opacity-80 transition-opacity"
                          style={{ color: "var(--text-muted)" }}
                          title="Edit cost"
                          aria-label="Edit cost"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
                          </svg>
                        </button>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {payoutEditId === a.id ? (
                      <form onSubmit={(e) => savePayout(a, e)} className="flex flex-wrap items-center justify-end gap-2">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          required
                          value={payoutValue}
                          onChange={(e) => setPayoutValue(e.target.value)}
                          className="w-24 px-2 py-1 rounded text-sm text-right"
                          style={{
                            background: "var(--bg-base)",
                            border: "1px solid var(--bg-border)",
                            color: "var(--text-primary)",
                          }}
                          autoFocus
                        />
                        <button
                          type="submit"
                          disabled={pending}
                          className="text-sm px-2 py-1 rounded"
                          style={{ background: "var(--accent)", color: "#000" }}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={cancelPayoutEdit}
                          className="text-sm"
                          style={{ color: "var(--text-muted)" }}
                        >
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <span
                        className="inline-flex items-center justify-end gap-1.5"
                        style={{ color: a.payout > 0 ? "var(--profit)" : "var(--text-primary)" }}
                      >
                        ${a.payout.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                        <button
                          type="button"
                          onClick={() => startEditPayout(a)}
                          disabled={pending}
                          className="shrink-0 p-1 rounded hover:opacity-80 transition-opacity"
                          style={{ color: "var(--text-muted)" }}
                          title="Edit payout"
                          aria-label="Edit payout"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
                          </svg>
                        </button>
                      </span>
                    )}
                  </td>
                  <td
                    className="px-4 py-2 text-right tabular-nums font-medium"
                    style={{
                      color: a.tradeCount === 0 ? "var(--text-muted)" : a.pnl >= 0 ? "var(--profit)" : "var(--loss)",
                    }}
                  >
                    {a.tradeCount === 0 ? (
                      "No trades"
                    ) : (
                      <>
                        {a.pnl >= 0 ? "+" : "-"}$
                        {Math.abs(a.pnl).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums" style={{ color: "var(--text-secondary)" }}>
                    {a.tradeCount}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-nowrap gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => startEdit(a)}
                          disabled={pending}
                          className="p-1.5 rounded-md hover:opacity-80 transition-opacity"
                          style={{
                            color: "var(--text-secondary)",
                            border: "1px solid var(--bg-border)",
                          }}
                          title="Edit account (name, prop firm, starting capital)"
                          aria-label="Edit account"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
                          </svg>
                        </button>
                        <a
                          href={`/api/account-report?accountId=${a.id}`}
                          className="p-1.5 rounded-md hover:opacity-80 transition-opacity inline-flex"
                          style={{
                            color: "var(--text-secondary)",
                            border: "1px solid var(--bg-border)",
                          }}
                          title={`Export PDF report for “${accountLabel(a)}”`}
                          aria-label="Export PDF report"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <path d="M7 10l5 5 5-5" />
                            <path d="M12 15V3" />
                          </svg>
                        </a>
                        <button
                          type="button"
                          onClick={() => requestDelete(a)}
                          disabled={pending || accounts.length <= 1}
                          className="p-1.5 rounded-md hover:opacity-80 transition-opacity"
                          style={{
                            color: "var(--loss)",
                            border: "1px solid color-mix(in srgb, var(--loss) 40%, var(--bg-border))",
                            opacity: accounts.length <= 1 ? 0.4 : 1,
                          }}
                          title={accounts.length <= 1 ? "Create another account before deleting the last one" : "Delete account"}
                          aria-label="Delete account"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18" />
                            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                            <path d="M10 11v6M14 11v6" />
                          </svg>
                        </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editAcct ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "color-mix(in srgb, #000 45%, transparent)" }}
          onClick={closeEdit}
        >
          <form
            onSubmit={saveEditModal}
            className="w-full max-w-md rounded-lg p-5 space-y-4"
            style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
              Edit account
            </h2>
            {error ? (
              <p
                className="text-sm rounded-md px-3 py-2"
                style={{ background: "color-mix(in srgb, var(--loss) 12%, var(--bg-card))", color: "var(--loss)" }}
              >
                {error}
              </p>
            ) : null}
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>
                Name
              </label>
              <input
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                maxLength={120}
                required
                autoFocus
                className="w-full px-3 py-2 rounded-md text-sm"
                style={{ background: "var(--bg-base)", border: "1px solid var(--bg-border)", color: "var(--text-primary)" }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>
                Prop firm
              </label>
              <select
                value={editForm.propfirmName}
                onChange={(e) => setEditForm((f) => ({ ...f, propfirmName: e.target.value }))}
                className="w-full px-3 py-2 rounded-md text-sm"
                style={{ background: "var(--bg-base)", border: "1px solid var(--bg-border)", color: "var(--text-primary)" }}
              >
                <option value="">—</option>
                {PROPFIRM_OPTIONS.map((firm) => (
                  <option key={firm} value={firm}>
                    {firm}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>
                Starting capital ($)
              </label>
              <select
                required
                value={editForm.initialBalance}
                onChange={(e) => setEditForm((f) => ({ ...f, initialBalance: e.target.value }))}
                className="w-full px-3 py-2 rounded-md text-sm tabular-nums"
                style={{ background: "var(--bg-base)", border: "1px solid var(--bg-border)", color: "var(--text-primary)" }}
              >
                {CAPITAL_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    ${c.toLocaleString("en-US")}
                  </option>
                ))}
                {!CAPITAL_OPTIONS.includes(Number(editForm.initialBalance) as (typeof CAPITAL_OPTIONS)[number]) &&
                editForm.initialBalance ? (
                  <option value={editForm.initialBalance}>
                    ${Number(editForm.initialBalance).toLocaleString("en-US")}
                  </option>
                ) : null}
              </select>
              <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                Changing starting capital recomputes the equity curve and per-trade capital.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeEdit}
                className="text-sm px-3 py-1.5 rounded-md"
                style={{ color: "var(--text-secondary)" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending || !editForm.name.trim()}
                className="px-4 py-2 rounded-md text-sm font-medium"
                style={{ background: "var(--accent)", color: "#000", opacity: pending || !editForm.name.trim() ? 0.6 : 1 }}
              >
                {pending ? "…" : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {deleting ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "color-mix(in srgb, #000 45%, transparent)" }}
          onClick={closeDelete}
        >
          <div
            className="w-full max-w-md rounded-lg p-5 space-y-4"
            style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold" style={{ color: "var(--loss)" }}>
              Delete “{accountLabel(deleting)}”?
            </h2>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              This will <strong>permanently</strong> remove <strong>all {deleting.tradeCount} trade(s)</strong>, scores, and
              settings for this account. Fills linked to it are removed too. This cannot be undone.
            </p>
            {deleting.id === activeId ? (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                After deletion, the app will switch to another account automatically.
              </p>
            ) : null}
            <label className="block text-xs" style={{ color: "var(--text-muted)" }}>
              Type <span className="font-mono font-semibold">delete</span> to confirm
            </label>
            <input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              className="w-full px-3 py-2 rounded-md text-sm"
              style={{
                background: "var(--bg-base)",
                border: "1px solid var(--bg-border)",
                color: "var(--text-primary)",
              }}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeDelete}
                className="text-sm px-3 py-1.5 rounded-md"
                style={{ color: "var(--text-secondary)" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={pending}
                className="text-sm px-3 py-1.5 rounded-md font-medium"
                style={{ background: "var(--loss)", color: "#fff" }}
              >
                {pending ? "Deleting…" : "Delete forever"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
