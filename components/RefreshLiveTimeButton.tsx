"use client";

type Props = { onClick: () => void; className?: string };

/** Updates the client “now” used for live session / heatmap / CME day badges (same clock as 1m auto-refresh). */
export default function RefreshLiveTimeButton({ onClick, className = "" }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded border px-1.5 text-[13px] leading-none transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-cyan-400/20 ${className}`}
      style={{
        borderColor: "var(--bg-border)",
        color: "var(--text-secondary)",
        background: "color-mix(in srgb, var(--bg-card) 92%, var(--bg-border))",
      }}
      title="Refresh live time (HKT) for badges and current bucket"
      aria-label="Refresh live time for badges and current bucket"
    >
      ↻
    </button>
  );
}
