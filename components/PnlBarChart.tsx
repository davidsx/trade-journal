"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface Trade {
  id: string;
  netPnl: number;
  contractName: string;
  entryTime: string | Date;
}

interface Props {
  trades: Trade[];
}

function fmtUsd(v: number) {
  return `$${v >= 0 ? "+" : ""}${v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function PnlBarChart({ trades }: Props) {
  if (trades.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-40 rounded-lg text-sm"
        style={{ background: "var(--bg-card)", color: "var(--text-muted)", border: "1px solid var(--bg-border)" }}
      >
        No data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={trades} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
        <XAxis
          dataKey="entryTime"
          tickFormatter={fmtDate}
          tick={{ fill: "#6b7280", fontSize: 10 }}
          axisLine={{ stroke: "#2a2a2a" }}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tickFormatter={(v) => `$${v}`}
          tick={{ fill: "#6b7280", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={55}
        />
        <ReferenceLine y={0} stroke="#4b5563" />
        <Tooltip
          cursor={{ fill: "rgba(255,255,255,0.06)" }}
          contentStyle={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 6 }}
          labelStyle={{ color: "#9ca3af", fontSize: 11 }}
          itemStyle={{ color: "#e5e7eb", fontSize: 11 }}
          formatter={(v) => [
            <span key="v" style={{ color: Number(v) >= 0 ? "#22c55e" : "#ef4444", fontWeight: 600 }}>
              {fmtUsd(Number(v))}
            </span>,
            "Net P&L",
          ]}
          labelFormatter={(label) => fmtDate(String(label))}
        />
        <Bar dataKey="netPnl" maxBarSize={16} activeBar={{ fill: "#d1d5db", fillOpacity: 0.5 }}>
          {trades.map((t) => (
            <Cell key={t.id} fill={t.netPnl >= 0 ? "#22c55e" : "#ef4444"} fillOpacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
