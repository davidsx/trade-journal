"use client";

import type { SVGProps } from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { switchAccountAction } from "@/app/accounts/actions";

type Props = {
  activeId: number;
  accounts: { id: number; name: string }[];
  compact: boolean;
};

function AccountIcon({ className, ...rest }: { className?: string } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      className={className}
      {...rest}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 4.5h12v9H2zM2 4.5V3a1 1 0 0 1 1-1h4l1.5 1.5H13a1 1 0 0 1 1 1V4.5" />
      <path d="M4.5 7.5h2M4.5 9.5h4" opacity="0.6" />
    </svg>
  );
}

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg className={className} width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M2.5 4.5L6 7.75L9.5 4.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
      />
    </svg>
  );
}

export default function AccountSwitcher({ activeId, accounts, compact }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const multi = accounts.length >= 2;

  if (accounts.length === 0) {
    return null;
  }

  return (
    <div className="px-2">
      <label
        className={compact ? "sr-only" : "mb-1.5 block text-[10px] font-semibold uppercase tracking-widest"}
        style={{ color: "var(--text-muted)" }}
        htmlFor="account-switcher"
      >
        Account
      </label>
      <div className="group relative h-9 w-full min-h-9 max-w-full" style={{ maxWidth: "100%" }}>
        <div
          className="pointer-events-none absolute left-0 top-0 z-10 flex h-9 w-7 select-none items-center justify-center"
          style={{ color: "var(--accent)" }}
        >
          <AccountIcon className="h-3.5 w-3.5 opacity-90" />
        </div>
        <select
          id="account-switcher"
          value={activeId}
          disabled={pending || !multi}
          title={!multi ? "Only one account — add another in Accounts" : pending ? "Switching…" : "Switch account"}
          aria-label="Active account"
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
          className={[
            "h-9 w-full min-h-9 min-w-0 cursor-pointer appearance-none font-medium",
            "rounded-md pl-7 pr-7 text-xs leading-none tabular-nums",
            "border border-solid transition-all duration-200",
            "hover:enabled:border-stone-500/45",
            "focus:outline-none focus:ring-2 focus:ring-cyan-400/20",
            "disabled:cursor-not-allowed",
            !multi && "opacity-95",
            pending && "pointer-events-none opacity-70",
          ].join(" ")}
          style={{
            background: "var(--bg-card)",
            borderColor: "var(--bg-border)",
            color: "var(--text-primary)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 1px 2px rgba(0,0,0,0.2)",
            boxSizing: "border-box",
          }}
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {compact ? (a.name.length > 12 ? `${a.name.slice(0, 11)}…` : a.name) : a.name}
            </option>
          ))}
        </select>
        <div
          className="pointer-events-none absolute right-0 top-0 z-10 flex h-9 w-7 select-none items-center justify-center"
          style={{ color: "var(--text-muted)" }}
        >
          {pending ? (
            <span
              className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent opacity-80 animate-spin"
              aria-hidden
            />
          ) : (
            <ChevronDown className="opacity-100 transition-transform duration-200 group-hover:translate-y-px" />
          )}
        </div>
      </div>
      {!compact && !multi && (
        <p className="mt-1.5 text-[10px] leading-tight" style={{ color: "var(--text-muted)" }}>
          Add accounts on{" "}
          <a href="/accounts" className="font-medium underline-offset-2 hover:underline" style={{ color: "var(--accent)" }}>
            Accounts
          </a>
        </p>
      )}
    </div>
  );
}
