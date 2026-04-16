"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface Bucket {
  range: string;
  count: number;
}

interface Props {
  buckets: Bucket[];
}

// One distinct color per 10-pt bucket — continuous red → orange → yellow → green gradient
const BUCKET_COLORS: Record<number, string> = {
   0: "#dc2626", // red-600
  10: "#ef4444", // red-500
  20: "#f97316", // orange-500
  30: "#fb923c", // orange-400
  40: "#f59e0b", // amber-500
  50: "#eab308", // yellow-500
  60: "#84cc16", // lime-500
  70: "#22c55e", // green-500
  80: "#16a34a", // green-600
  90: "#15803d", // green-700
};

function scoreColor(range: string): string {
  const start = parseInt(range.split("–")[0]);
  return BUCKET_COLORS[start] ?? "#6b7280";
}

export default function ScoreDistributionChart({ buckets }: Props) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={buckets} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
        <XAxis
          dataKey="range"
          tickFormatter={(v) => v.split("–")[0]}
          tick={{ fill: "#6b7280", fontSize: 10 }}
          axisLine={{ stroke: "#2a2a2a" }}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: "#6b7280", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={30}
        />
        <Tooltip
          cursor={{ fill: "rgba(255,255,255,0.06)" }}
          contentStyle={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 6 }}
          labelStyle={{ color: "#9ca3af", fontSize: 11 }}
          itemStyle={{ color: "#e5e7eb", fontSize: 11 }}
          formatter={(v) => [v, "trades"]}
          labelFormatter={(label) => `Score ${label}`}
        />
        <Bar dataKey="count" maxBarSize={32} activeBar={{ fill: "#ffffff", fillOpacity: 0.15 }}>
          {buckets.map((b) => (
            <Cell key={b.range} fill={scoreColor(b.range)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
