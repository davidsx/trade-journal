"use client";

import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export interface ScoreDistBucket {
  /** Label in tooltip, e.g. "67" for exact score */
  range: string;
  count: number;
  /** X position: integer score 0–100 */
  bin: number;
}

interface Props {
  buckets: ScoreDistBucket[];
}

const BUCKET_COLORS: Record<number, string> = {
  0: "#dc2626",
  10: "#ef4444",
  20: "#f97316",
  30: "#fb923c",
  40: "#f59e0b",
  50: "#eab308",
  60: "#84cc16",
  70: "#22c55e",
  80: "#16a34a",
  90: "#15803d",
};

function bandColor(bin: number) {
  const k = Math.min(90, Math.floor(bin / 10) * 10);
  return BUCKET_COLORS[k] ?? "#6b7280";
}

function toChartData(buckets: ScoreDistBucket[]) {
  return buckets.map((b) => ({
    range: b.range,
    count: b.count,
    bin: b.bin,
    color: bandColor(b.bin),
  }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CountDot(props: any) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null || !payload) return null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      fill={payload.color}
      stroke="var(--bg-base)"
      strokeWidth={1.5}
    />
  );
}

export default function ScoreDistributionChart({ buckets }: Props) {
  const fullData = toChartData(buckets);
  const hasAny = fullData.some((d) => d.count > 0);
  const yMax = Math.max(1, ...fullData.map((d) => d.count));
  const yCeil = Math.max(1, Math.ceil(yMax * 1.15));

  if (!hasAny) {
    return (
      <div className="w-full py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
        No scored trades yet — nothing to show on the distribution.
      </div>
    );
  }

  return (
    <div className="w-full" style={{ minHeight: 220 }}>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart
          data={fullData}
          margin={{ top: 8, right: 12, left: 4, bottom: 4 }}
        >
          <defs>
            <linearGradient id="scoreDistFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 6" stroke="#2a2a2a" vertical={false} />
          <XAxis
            dataKey="bin"
            type="number"
            domain={[0, 100]}
            ticks={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]}
            tick={{ fill: "#6b7280", fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: "#2a2a2a" }}
            interval={0}
          />
          <YAxis
            allowDecimals={false}
            domain={[0, yCeil]}
            width={32}
            tick={{ fill: "#6b7280", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ stroke: "rgba(56, 189, 248, 0.35)", strokeWidth: 1, strokeDasharray: "4 4" }}
            contentStyle={{
              background: "#1a1a1a",
              border: "1px solid #2a2a2a",
              borderRadius: 6,
            }}
            labelStyle={{ color: "#9ca3af", fontSize: 11 }}
            itemStyle={{ color: "#e5e7eb", fontSize: 11 }}
            formatter={(v) => [typeof v === "number" ? v : 0, "trades"]}
            labelFormatter={(_, p) => {
              const s = p?.[0]?.payload?.range;
              return s != null ? `Score ${s}` : "Score";
            }}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke="none"
            fill="url(#scoreDistFill)"
            isAnimationActive={false}
            baseValue={0}
          />
          {/* Full 0–100 series so the line shows the shape; dots only where count &gt; 0 */}
          <Line
            type="monotone"
            dataKey="count"
            stroke="#38bdf8"
            strokeWidth={1.5}
            isAnimationActive={false}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            dot={(props: any) =>
              (props.payload?.count ?? 0) < 1 ? null : <CountDot {...props} />
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            activeDot={(props: any) =>
              (props.payload?.count ?? 0) < 1 || props.cx == null || props.cy == null ? null : (
                <circle
                  cx={props.cx}
                  cy={props.cy}
                  r={6}
                  stroke="#38bdf8"
                  strokeWidth={2}
                  fill="#0f0f0f"
                />
              )
            }
          />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="mt-2 text-center text-[11px]" style={{ color: "var(--text-muted)" }}>
        Line and area use every integer score 0–100 (zeros included). Colored dots appear only for scores with at
        least one trade.
      </p>
    </div>
  );
}
