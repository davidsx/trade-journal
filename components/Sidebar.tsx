"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import CsvUpload from "./CsvUpload";

function Icon({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <path d={d} />
    </svg>
  );
}

// Dashboard: grid of four squares
const ICON_DASHBOARD = "M2 2h5v5H2zM9 2h5v5H9zM2 9h5v5H2zM9 9h5v5H9z";
// Trades: three rows (list)
const ICON_TRADES = "M2 4h12M2 8h12M2 12h12";
// Analytics: arrow trending up with bar chart feel
const ICON_ANALYTICS = "M2 13 L6 8 L9 10 L14 3";
// Patterns: overlapping circles / diamond shapes
const ICON_PATTERNS = "M8 2L14 8L8 14L2 8ZM5 8h6M8 5v6";
// Chart: candlestick
const ICON_CHART = "M4 3v3M4 9v4M4 5h2v4H4zM10 4v2M10 10v2M10 6h2v4h-2z";
// Score guide: circle with question mark
const ICON_SCORE = "M6.5 6a1.5 1.5 0 0 1 3 0c0 1-1.5 1.5-1.5 2.5M8 12v.5";
// Insights: magnifying glass
const ICON_INSIGHTS = "M10.5 10.5L14 14M7 11.5A4.5 4.5 0 1 0 7 2.5a4.5 4.5 0 0 0 0 9z";

const NAV = [
  { href: "/",            label: "Dashboard",  iconPath: ICON_DASHBOARD  },
  { href: "/trades",      label: "Trades",     iconPath: ICON_TRADES     },
  { href: "/analytics",   label: "Analytics",  iconPath: ICON_ANALYTICS  },
  { href: "/patterns",    label: "Patterns",   iconPath: ICON_PATTERNS   },
  { href: "/insights",    label: "Insights",   iconPath: ICON_INSIGHTS   },
  { href: "/chart",       label: "Chart",      iconPath: ICON_CHART      },
  { href: "/score-guide", label: "Score Guide",iconPath: ICON_SCORE      },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <nav
      className="flex-shrink-0 flex flex-col py-6 border-r transition-all duration-200"
      style={{
        width: collapsed ? 56 : 208,
        background: "var(--bg-card)",
        borderColor: "var(--bg-border)",
        height: "100vh",
        position: "sticky",
        top: 0,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div className={`mb-8 ${collapsed ? "px-3" : "px-4"}`}>
        {collapsed ? (
          <div className="text-sm font-semibold text-center" style={{ color: "var(--accent)" }}>P</div>
        ) : (
          <>
            <div className="text-sm font-semibold" style={{ color: "var(--accent)" }}>PERF REVIEW</div>
            <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>CSV import</div>
          </>
        )}
      </div>

      {/* Nav links */}
      <ul className="flex flex-col gap-1 flex-1 px-2">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                title={collapsed ? item.label : undefined}
                className="flex items-center gap-3 px-2 py-2 rounded-md text-sm transition-colors"
                style={{
                  background: active ? "var(--bg-card-hover)" : "transparent",
                  color: active ? "var(--text-primary)" : "var(--text-secondary)",
                  borderLeft: active ? `2px solid var(--accent)` : "2px solid transparent",
                  justifyContent: collapsed ? "center" : "flex-start",
                }}
              >
                <Icon d={item.iconPath} />
                {!collapsed && item.label}
              </Link>
            </li>
          );
        })}
      </ul>

      {!collapsed && <div className="px-2"><CsvUpload /></div>}

      {/* Toggle button */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="mt-4 mx-auto flex items-center justify-center rounded-md text-xs transition-colors"
        style={{
          width: 32,
          height: 24,
          background: "var(--bg-border)",
          color: "var(--text-muted)",
        }}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? "›" : "‹"}
      </button>
    </nav>
  );
}
