import type { CSSProperties, ReactNode } from "react";

const baseStyle: CSSProperties = {
  borderColor: "color-mix(in srgb, var(--accent) 45%, var(--bg-border))",
  color: "var(--accent)",
  background: "color-mix(in srgb, var(--accent) 12%, var(--bg-card))",
};

type Props = { children?: ReactNode; size?: "default" | "sm" };

/**
 * Compact accent-bordered status chip (uppercase). Default label "Live". Pass children to override.
 * Use `size="sm"` in dense layouts (e.g. heatmap / day-of-week).
 */
export default function LivePill({ children = "Live", size = "default" }: Props) {
  return (
    <span
      className={
        size === "sm"
          ? "inline-block text-[7px] font-semibold uppercase tracking-tight rounded border px-0.5 py-px leading-none"
          : "text-[9px] font-semibold uppercase tracking-wide rounded border px-1.5 py-0.5"
      }
      style={baseStyle}
    >
      {children}
    </span>
  );
}
