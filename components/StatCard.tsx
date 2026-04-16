interface StatCardProps {
  label: string;
  value: string | number;
  subLabel?: string;
  valueColor?: string;
}

export default function StatCard({ label, value, subLabel, valueColor }: StatCardProps) {
  return (
    <div
      className="rounded-lg p-4 flex flex-col gap-1"
      style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)" }}
    >
      <span className="text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      <span
        className="text-2xl font-semibold tabular-nums"
        style={{ color: valueColor ?? "var(--text-primary)" }}
      >
        {value}
      </span>
      {subLabel && (
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {subLabel}
        </span>
      )}
    </div>
  );
}
