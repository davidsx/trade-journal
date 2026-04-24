"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { switchAccountAction } from "@/app/accounts/actions";

type Props = {
  activeId: number;
  accounts: { id: number; name: string }[];
  compact: boolean;
};

export default function AccountSwitcher({ activeId, accounts, compact }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (accounts.length === 0) {
    return null;
  }

  return (
    <div className={compact ? "px-2" : "px-4"}>
      <label className="sr-only" htmlFor="account-switcher">
        Active account
      </label>
      <select
        id="account-switcher"
        value={activeId}
        disabled={pending || accounts.length < 2}
        title={accounts.length < 2 ? "Add another account to switch" : "Switch account"}
        onChange={(e) => {
          const id = parseInt(e.target.value, 10);
          if (!Number.isFinite(id) || id === activeId) return;
          startTransition(async () => {
            const r = await switchAccountAction(id);
            if ("error" in r && r.error) {
              alert(r.error);
              return;
            }
            router.refresh();
          });
        }}
        className="w-full rounded-md text-sm py-1.5 px-2"
        style={{
          background: "var(--bg-base)",
          border: "1px solid var(--bg-border)",
          color: "var(--text-primary)",
          maxWidth: "100%",
        }}
      >
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {compact ? (a.name.length > 12 ? `${a.name.slice(0, 11)}…` : a.name) : a.name}
          </option>
        ))}
      </select>
    </div>
  );
}
