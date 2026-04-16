import Link from "next/link";
import ScoreBadge from "./ScoreBadge";

interface Trade {
  id: string;
  contractName: string;
  direction: string;
  qty: number;
  entryPrice: number;
  exitPrice: number;
  entryTime: string | Date;
  exitTime: string | Date;
  holdingMins: number;
  netPnl: number;
  qualityScore: number | null;
}

interface Props {
  trades: Trade[];
  sortBy?: string;
  sortDir?: "asc" | "desc";
  queryParams?: Record<string, string>;
}

function fmtTime(dt: string | Date) {
  const HKT_OFFSET_MS = 8 * 60 * 60 * 1000;
  const d = new Date(new Date(dt).getTime() + HKT_OFFSET_MS);
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const mon = MONTHS[d.getUTCMonth()];
  const day = d.getUTCDate();
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${mon} ${day}, ${hh}:${mm} HKT`;
}

function fmtUsd(v: number) {
  return `${v >= 0 ? "+" : "-"}$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function SortableHeader({
  label,
  field,
  sortBy,
  sortDir,
  queryParams = {},
}: {
  label: string;
  field: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  queryParams?: Record<string, string>;
}) {
  const active = sortBy === field;
  const nextDir = active && sortDir === "asc" ? "desc" : "asc";
  const href = `/trades?${new URLSearchParams({ ...queryParams, sort: field, dir: nextDir })}`;

  return (
    <th className="px-4 py-2 text-left">
      <Link
        href={href}
        className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wide transition-colors"
        style={{ color: active ? "var(--accent)" : "var(--text-muted)" }}
      >
        {label}
        <span style={{ opacity: active ? 1 : 0.35, fontSize: 10 }}>
          {active ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </Link>
    </th>
  );
}

function PlainHeader({ label }: { label: string }) {
  return (
    <th
      className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide"
      style={{ color: "var(--text-muted)" }}
    >
      {label}
    </th>
  );
}

export default function TradeTable({ trades, sortBy, sortDir, queryParams = {} }: Props) {
  if (trades.length === 0) {
    return (
      <div
        className="text-sm text-center py-12 rounded-lg"
        style={{ color: "var(--text-muted)", background: "var(--bg-card)", border: "1px solid var(--bg-border)" }}
      >
        No trades found
      </div>
    );
  }

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ border: "1px solid var(--bg-border)" }}
    >
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--bg-border)" }}>
            <PlainHeader label="Contract" />
            <PlainHeader label="Dir" />
            <PlainHeader label="Qty" />
            <SortableHeader label="Entry" field="entryTime" sortBy={sortBy} sortDir={sortDir} queryParams={queryParams} />
            <PlainHeader label="Exit" />
            <SortableHeader label="Hold" field="holdingMins" sortBy={sortBy} sortDir={sortDir} queryParams={queryParams} />
            <SortableHeader label="Net P&L" field="netPnl" sortBy={sortBy} sortDir={sortDir} queryParams={queryParams} />
            <SortableHeader label="Score" field="qualityScore" sortBy={sortBy} sortDir={sortDir} queryParams={queryParams} />
          </tr>
        </thead>
        <tbody>
          {trades.map((t, i) => (
            <tr
              key={t.id}
              style={{
                background: i % 2 === 0 ? "var(--bg-card)" : "var(--bg-base)",
                borderBottom: "1px solid var(--bg-border)",
              }}
              className="hover:opacity-80 transition-opacity"
            >
              <td className="px-4 py-2 font-medium">{t.contractName}</td>
              <td className="px-4 py-2">
                <span
                  className="text-xs font-medium px-1.5 py-0.5 rounded"
                  style={{
                    background: t.direction === "Long" ? "#22c55e22" : "#ef444422",
                    color: t.direction === "Long" ? "var(--profit)" : "var(--loss)",
                  }}
                >
                  {t.direction}
                </span>
              </td>
              <td className="px-4 py-2 tabular-nums">{t.qty}</td>
              <td className="px-4 py-2">
                <div className="tabular-nums text-xs font-medium">{t.entryPrice.toFixed(2)}</div>
                <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{fmtTime(t.entryTime)}</div>
              </td>
              <td className="px-4 py-2">
                <div className="tabular-nums text-xs font-medium">{t.exitPrice.toFixed(2)}</div>
                <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{fmtTime(t.exitTime)}</div>
              </td>
              <td className="px-4 py-2 tabular-nums text-xs" style={{ color: "var(--text-secondary)" }}>
                {t.holdingMins < 60
                  ? `${t.holdingMins.toFixed(0)}m`
                  : `${(t.holdingMins / 60).toFixed(1)}h`}
              </td>
              <td
                className="px-4 py-2 tabular-nums font-medium"
                style={{ color: t.netPnl >= 0 ? "var(--profit)" : "var(--loss)" }}
              >
                {fmtUsd(t.netPnl)}
              </td>
              <td className="px-4 py-2">
                <Link href={`/trades/${t.id}`}>
                  <ScoreBadge score={t.qualityScore} size="sm" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
