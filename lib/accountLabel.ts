/** Compact account size, e.g. 50000 → "50K", 150000 → "150K", 48750 → "48.75K". */
export function accountSizeLabel(initialBalance: number): string {
  if (!Number.isFinite(initialBalance) || initialBalance <= 0) return "";
  return `${(initialBalance / 1000).toLocaleString("en-US", { maximumFractionDigits: 2 })}K`;
}

/**
 * Display label for an account: combines the prop firm, account name, and size.
 * The DB keeps these as separate columns — this is presentation only.
 * "Lucid" + "Main" + 50000 → "Lucid · Main · 50K"; no firm → "Main · 50K".
 */
export function accountLabel(account: {
  name: string;
  propfirmName?: string | null;
  initialBalance?: number | null;
}): string {
  const firm = account.propfirmName?.trim();
  const size =
    typeof account.initialBalance === "number" ? accountSizeLabel(account.initialBalance) : "";
  return [firm, account.name, size].filter(Boolean).join(" · ");
}
