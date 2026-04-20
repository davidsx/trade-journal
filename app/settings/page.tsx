import { getAccountSettings } from "@/lib/accountSettings";
import AccountSettingsForm from "@/components/AccountSettingsForm";

export default async function SettingsPage() {
  const settings = await getAccountSettings();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Starting capital drives the equity curve and per-trade capital. Saving recalculates capital and scores from
          your trades.
        </p>
      </div>

      <div
        className="rounded-lg p-4"
        style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)" }}
      >
        <h2 className="text-sm font-medium mb-4" style={{ color: "var(--text-secondary)" }}>
          Account
        </h2>
        <AccountSettingsForm key={String(settings.initialBalance)} initialBalance={settings.initialBalance} />
      </div>
    </div>
  );
}
