"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  createAccountAction,
  deleteAccountAction,
  renameAccountAction,
  switchAccountAction,
  updateAccountInitialBalanceAction,
} from "@/app/accounts/actions";

export type AccountRow = {
  id: number;
  name: string;
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

      <ul className="space-y-2">
        {accounts.map((a) => {
          const isActive = a.id === activeId;
          return (
            <li
              key={a.id}
              className="rounded-lg p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
              style={{
                background: "var(--bg-card)",
                border: `1px solid ${isActive ? "var(--accent)" : "var(--bg-border)"}`,
              }}
            >
              <div className="min-w-0 flex-1">
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
                  <>
                    <div className="font-medium" style={{ color: "var(--text-primary)" }}>
                      {a.name}
                      {isActive ? (
                        <span
                          className="ml-2 text-[10px] font-semibold uppercase align-middle"
                          style={{ color: "var(--accent)" }}
                        >
                          active
                        </span>
                      ) : null}
                    </div>
                    {capitalEditId === a.id ? (
                      <form onSubmit={saveCapital} className="mt-1 flex flex-wrap items-end gap-2">
                        <div>
                          <label className="block text-[10px] font-medium mb-0.5" style={{ color: "var(--text-muted)" }}>
                            Starting capital ($)
                          </label>
                          <input
                            type="number"
                            min={1}
                            step="any"
                            required
                            value={capitalValue}
                            onChange={(e) => setCapitalValue(e.target.value)}
                            className="w-40 px-2 py-1 rounded text-sm"
                            style={{
                              background: "var(--bg-base)",
                              border: "1px solid var(--bg-border)",
                              color: "var(--text-primary)",
                            }}
                            autoFocus
                          />
                        </div>
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
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        Start ${a.initialBalance.toLocaleString("en-US", { maximumFractionDigits: 0 })} ·{" "}
                        {a.tradeCount} trade{a.tradeCount === 1 ? "" : "s"} · id {a.id}
                      </p>
                    )}
                  </>
                )}
              </div>
              {editingId === a.id ? null : (
                <div className="flex flex-wrap gap-2 shrink-0">
                  {!isActive ? (
                    <button
                      type="button"
                      onClick={() => handleSwitch(a.id)}
                      disabled={pending}
                      className="text-sm px-3 py-1.5 rounded-md"
                      style={{ background: "var(--bg-border)", color: "var(--text-primary)" }}
                    >
                      Use this account
                    </button>
                  ) : null}
                  {capitalEditId === a.id ? null : (
                    <button
                      type="button"
                      onClick={() => startEditCapital(a)}
                      disabled={pending}
                      className="text-sm px-3 py-1.5 rounded-md"
                      style={{ border: "1px solid var(--bg-border)", color: "var(--text-secondary)" }}
                    >
                      Starting capital
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => startEdit(a)}
                    disabled={pending}
                    className="text-sm px-3 py-1.5 rounded-md"
                    style={{ border: "1px solid var(--bg-border)", color: "var(--text-secondary)" }}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => requestDelete(a)}
                    disabled={pending || accounts.length <= 1}
                    className="text-sm px-3 py-1.5 rounded-md"
                    style={{
                      color: "var(--loss)",
                      border: "1px solid color-mix(in srgb, var(--loss) 40%, var(--bg-border))",
                      opacity: accounts.length <= 1 ? 0.4 : 1,
                    }}
                    title={accounts.length <= 1 ? "Create another account before deleting the last one" : undefined}
                  >
                    Delete
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

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
