"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface DrawdownPoint {
  timestamp: string;
  drawdownAbs: number;
  drawdownPct: number;
}

interface Props {
  data: DrawdownPoint[];
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtMoney(v: number) {
  return `${v >= 0 ? "+" : "-"}$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function DrawdownChart({ data }: Props) {
  if (data.length === 0) {
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
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="ddGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05} />
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
          tickFormatter={(v) => `${v.toFixed(1)}%`}
          tick={{ fill: "#6b7280", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={55}
        />
        <ReferenceLine y={0} stroke="#2a2a2a" />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const row = payload[0].payload as DrawdownPoint;
            return (
              <div
                className="rounded-md border px-2.5 py-2 text-xs shadow-lg"
                style={{ background: "#1a1a1a", borderColor: "#2a2a2a" }}
              >
                <p className="mb-1.5" style={{ color: "#9ca3af" }}>
                  {fmtDate(String(label))}
                </p>
                <p className="font-medium tabular-nums">
                  <span style={{ color: "#ef4444" }}>{fmtMoney(row.drawdownAbs)}</span>
                  <span className="ml-1.5 font-normal" style={{ color: "#9ca3af" }}>
                    ({row.drawdownPct.toFixed(2)}%)
                  </span>
                </p>
              </div>
            );
          }}
        />
        <Area
          type="monotone"
          dataKey="drawdownPct"
          stroke="#ef4444"
          strokeWidth={1.5}
          fill="url(#ddGradient)"
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
