"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  createAccountAction,
  deleteAccountAction,
  renameAccountAction,
  switchAccountAction,
  updateAccountDetailsAction,
  updateAccountInitialBalanceAction,
} from "@/app/accounts/actions";

export type AccountStage = "Eval" | "Funded";

const PROPFIRM_OPTIONS = ["Lucid", "Tradeify", "Apex", "FundedNext", "Topstep"] as const;

export type AccountRow = {
  id: number;
  name: string;
  propfirmName: string | null;
  description: string | null;
  breached: boolean;
  numberOfAccounts: number;
  stage: AccountStage;
  cost: number;
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
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [deleting, setDeleting] = useState<AccountRow | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [capitalEditId, setCapitalEditId] = useState<number | null>(null);
  const [capitalValue, setCapitalValue] = useState("");
  const [costEditId, setCostEditId] = useState<number | null>(null);
  const [costValue, setCostValue] = useState("");

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

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const n = newName.trim();
    if (!n) return;
    startTransition(async () => {
      const r = await createAccountAction(n);
      if ("error" in r && r.error) {
        setError(r.error);
        return;
      }
      setNewName("");
      refresh();
    });
  }

  function startEdit(a: AccountRow) {
    setCapitalEditId(null);
    setCapitalValue("");
    setEditingId(a.id);
    setEditName(a.name);
  }

  function startEditCapital(a: AccountRow) {
    setEditingId(null);
    setEditName("");
    setCapitalEditId(a.id);
    setCapitalValue(String(a.initialBalance));
  }

  function cancelCapitalEdit() {
    setCapitalEditId(null);
    setCapitalValue("");
  }

  function saveCapital(e: React.FormEvent) {
    e.preventDefault();
    if (capitalEditId === null) return;
    setError(null);
    const n = parseFloat(capitalValue);
    if (!Number.isFinite(n) || n <= 0) {
      setError("Starting capital must be a positive number");
      return;
    }
    startTransition(async () => {
      const r = await updateAccountInitialBalanceAction(capitalEditId, n);
      if ("error" in r && r.error) {
        setError(r.error);
        return;
      }
      setAccounts((rows) =>
        rows.map((x) => (x.id === capitalEditId ? { ...x, initialBalance: Math.round(n) } : x))
      );
      setCapitalEditId(null);
      setCapitalValue("");
      refresh();
    });
  }

  function toggleStage(a: AccountRow) {
    setError(null);
    const nextStage: AccountStage = a.stage === "Eval" ? "Funded" : "Eval";
    const payload = {
      propfirmName: a.propfirmName,
      description: a.description,
      breached: a.breached,
      numberOfAccounts: a.numberOfAccounts,
      stage: nextStage,
      cost: a.cost,
    };
    setAccounts((rows) => rows.map((x) => (x.id === a.id ? { ...x, stage: nextStage } : x)));
    startTransition(async () => {
      const r = await updateAccountDetailsAction(a.id, payload);
      if ("error" in r && r.error) {
        setError(r.error);
        setAccounts((rows) => rows.map((x) => (x.id === a.id ? { ...x, stage: a.stage } : x)));
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
      breached: a.breached,
      numberOfAccounts: next,
      stage: a.stage,
      cost: a.cost,
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

  function setPropfirm(a: AccountRow, value: string) {
    setError(null);
    const next = value || null;
    const payload = {
      propfirmName: next,
      description: a.description,
      breached: a.breached,
      numberOfAccounts: a.numberOfAccounts,
      stage: a.stage,
      cost: a.cost,
    };
    setAccounts((rows) => rows.map((x) => (x.id === a.id ? { ...x, propfirmName: next } : x)));
    startTransition(async () => {
      const r = await updateAccountDetailsAction(a.id, payload);
      if ("error" in r && r.error) {
        setError(r.error);
        setAccounts((rows) => rows.map((x) => (x.id === a.id ? { ...x, propfirmName: a.propfirmName } : x)));
        return;
      }
      refresh();
    });
  }

  function toggleBreached(a: AccountRow) {
    setError(null);
    const nextBreached = !a.breached;
    const payload = {
      propfirmName: a.propfirmName,
      description: a.description,
      breached: nextBreached,
      numberOfAccounts: a.numberOfAccounts,
      stage: a.stage,
      cost: a.cost,
    };
    setAccounts((rows) => rows.map((x) => (x.id === a.id ? { ...x, breached: nextBreached } : x)));
    startTransition(async () => {
      const r = await updateAccountDetailsAction(a.id, payload);
      if ("error" in r && r.error) {
        setError(r.error);
        setAccounts((rows) => rows.map((x) => (x.id === a.id ? { ...x, breached: a.breached } : x)));
        return;
      }
      refresh();
    });
  }

  function startEditCost(a: AccountRow) {
    setEditingId(null);
    setEditName("");
    setCapitalEditId(null);
    setCapitalValue("");
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
      breached: a.breached,
      numberOfAccounts: a.numberOfAccounts,
      stage: a.stage,
      cost: n,
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

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
  }

  function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (editingId === null) return;
    setError(null);
    const n = editName.trim();
    if (!n) return;
    startTransition(async () => {
      const r = await renameAccountAction(editingId, n);
      if ("error" in r && r.error) {
        setError(r.error);
        return;
      }
      setAccounts((rows) => rows.map((x) => (x.id === editingId ? { ...x, name: n } : x)));
      setEditingId(null);
      setEditName("");
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

      <form
        onSubmit={handleCreate}
        className="flex flex-wrap items-end gap-3 rounded-lg p-4"
        style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)" }}
      >
        <div className="min-w-[200px] flex-1">
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>
            New account name
          </label>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={120}
            placeholder="e.g. Main SIM, Prop firm 2025"
            className="w-full px-3 py-2 rounded-md text-sm"
            style={{
              background: "var(--bg-base)",
              border: "1px solid var(--bg-border)",
              color: "var(--text-primary)",
            }}
          />
        </div>
        <button
          type="submit"
          disabled={pending || !newName.trim()}
          className="px-4 py-2 rounded-md text-sm font-medium"
          style={{
            background: "var(--accent)",
            color: "#000",
            opacity: pending ? 0.6 : 1,
          }}
        >
          {pending ? "…" : "Add account"}
        </button>
      </form>

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
                Prop firm
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                Stage
              </th>
              <th className="px-4 py-2 text-center text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                Breached
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                # Accts
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                Starting capital
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                Cost
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
            {accounts.map((a, i) => {
              const isActive = a.id === activeId;
              return (
                <tr
                  key={a.id}
                  style={{
                    background: i % 2 === 0 ? "var(--bg-card)" : "var(--bg-base)",
                    borderBottom: "1px solid var(--bg-border)",
                    boxShadow: isActive ? "inset 3px 0 0 0 var(--accent)" : undefined,
                  }}
                >
                  <td className="px-4 py-2 text-right tabular-nums" style={{ color: "var(--text-muted)" }}>
                    {a.id}
                  </td>
                  <td className="px-4 py-2">
                    {editingId === a.id ? (
                      <form onSubmit={saveEdit} className="flex flex-wrap gap-2 items-center">
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          maxLength={120}
                          className="flex-1 min-w-[12rem] px-2 py-1 rounded text-sm"
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
                        <button type="button" onClick={cancelEdit} className="text-sm" style={{ color: "var(--text-muted)" }}>
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        {isActive ? (
                          <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                            {a.name}
                            <span
                              className="ml-2 text-[10px] font-semibold uppercase align-middle"
                              style={{ color: "var(--accent)" }}
                            >
                              active
                            </span>
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
                            {a.name}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => startEdit(a)}
                          disabled={pending}
                          className="shrink-0 p-1 rounded hover:opacity-80 transition-opacity"
                          style={{ color: "var(--text-muted)" }}
                          title="Rename account"
                          aria-label="Rename account"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
                          </svg>
                        </button>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={a.propfirmName ?? ""}
                      onChange={(e) => setPropfirm(a, e.target.value)}
                      disabled={pending}
                      className="px-2 py-1 rounded text-sm"
                      style={{
                        background: "var(--bg-base)",
                        border: "1px solid var(--bg-border)",
                        color: a.propfirmName ? "var(--text-secondary)" : "var(--text-muted)",
                      }}
                    >
                      <option value="">—</option>
                      {PROPFIRM_OPTIONS.map((firm) => (
                        <option key={firm} value={firm}>
                          {firm}
                        </option>
                      ))}
                    </select>
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
                      onClick={() => toggleBreached(a)}
                      disabled={pending}
                      className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded hover:opacity-80 transition-opacity"
                      style={
                        a.breached
                          ? { background: "color-mix(in srgb, var(--loss) 15%, transparent)", color: "var(--loss)" }
                          : { background: "var(--bg-border)", color: "var(--text-secondary)" }
                      }
                      title={`Click to mark as ${a.breached ? "not breached" : "breached"}`}
                    >
                      {a.breached ? "Breached" : "OK"}
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
                    {capitalEditId === a.id ? (
                      <form onSubmit={saveCapital} className="flex flex-wrap items-center justify-end gap-2">
                        <input
                          type="number"
                          min={1}
                          step="any"
                          required
                          value={capitalValue}
                          onChange={(e) => setCapitalValue(e.target.value)}
                          className="w-32 px-2 py-1 rounded text-sm text-right"
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
                          onClick={cancelCapitalEdit}
                          className="text-sm"
                          style={{ color: "var(--text-muted)" }}
                        >
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <span className="inline-flex items-center justify-end gap-1.5">
                        ${a.initialBalance.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                        <button
                          type="button"
                          onClick={() => startEditCapital(a)}
                          disabled={pending}
                          className="shrink-0 p-1 rounded hover:opacity-80 transition-opacity"
                          style={{ color: "var(--text-muted)" }}
                          title="Edit starting capital"
                          aria-label="Edit starting capital"
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
                  <td
                    className="px-4 py-2 text-right tabular-nums font-medium"
                    style={{ color: a.pnl >= 0 ? "var(--profit)" : "var(--loss)" }}
                  >
                    {a.pnl >= 0 ? "+" : "-"}$
                    {Math.abs(a.pnl).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums" style={{ color: "var(--text-secondary)" }}>
                    {a.tradeCount}
                  </td>
                  <td className="px-4 py-2">
                    {editingId === a.id ? null : (
                      <div className="flex flex-wrap gap-2 justify-end">
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
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

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
              Delete “{deleting.name}”?
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
