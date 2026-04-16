"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface EquityPoint {
  timestamp: string;
  equity: number;
}

interface Props {
  data: EquityPoint[];
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtUsd(v: number) {
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function EquityCurve({ data }: Props) {
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-48 rounded-lg text-sm"
        style={{ background: "var(--bg-card)", color: "var(--text-muted)", border: "1px solid var(--bg-border)" }}
      >
        No trade data yet — sync to load
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
        <XAxis
          dataKey="timestamp"
          tickFormatter={fmtDate}
          tick={{ fill: "#6b7280", fontSize: 11 }}
          axisLine={{ stroke: "#2a2a2a" }}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tickFormatter={fmtUsd}
          tick={{ fill: "#6b7280", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={70}
        />
        <Tooltip
          contentStyle={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 6 }}
          labelStyle={{ color: "#9ca3af", fontSize: 11 }}
          formatter={(v) => [fmtUsd(Number(v)), "Equity"]}
          labelFormatter={(label) => fmtDate(String(label))}
        />
        <Area
          type="monotone"
          dataKey="equity"
          stroke="#22c55e"
          strokeWidth={2}
          fill="url(#equityGradient)"
          dot={false}
          activeDot={{ r: 4, fill: "#22c55e" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
