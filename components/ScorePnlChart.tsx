"use client";

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from "recharts";

export interface ScorePnlPoint {
  score: number;
  pnl: number;
  id: string;
}

interface Props {
  points: ScorePnlPoint[];
  bucketAvgs: { score: number; avgPnl: number; count: number }[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as ScorePnlPoint;
  if (!d) return null;
  return (
    <div
      style={{
        background: "#1a1a1a",
        border: "1px solid #2a2a2a",
        borderRadius: 6,
        padding: "6px 10px",
        fontSize: 11,
      }}
    >
      <div style={{ color: "#9ca3af" }}>Score: <span style={{ color: "#e5e7eb" }}>{d.score}</span></div>
      <div style={{ color: "#9ca3af" }}>
        P&L:{" "}
        <span style={{ color: d.pnl >= 0 ? "#22c55e" : "#ef4444", fontWeight: 600 }}>
          {d.pnl >= 0 ? "+" : ""}${d.pnl.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

export default function ScorePnlChart({ points, bucketAvgs }: Props) {
  return (
    <div className="space-y-6">
      {/* Scatter: each trade */}
      <div>
        <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
          Each dot is one trade. Green = profit, red = loss.
        </p>
        <ResponsiveContainer width="100%" height={260}>
          <ScatterChart margin={{ top: 4, right: 8, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
            <XAxis
              type="number"
              dataKey="score"
              domain={[0, 100]}
              name="Score"
              tick={{ fill: "#6b7280", fontSize: 10 }}
              axisLine={{ stroke: "#2a2a2a" }}
              tickLine={false}
              tickCount={6}
              label={{ value: "Quality Score", position: "insideBottom", offset: -12, fill: "#6b7280", fontSize: 10 }}
            />
            <YAxis
              type="number"
              dataKey="pnl"
              name="Net P&L"
              tickFormatter={(v) => `$${v}`}
              tick={{ fill: "#6b7280", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={52}
              tickCount={5}
            />
            <ReferenceLine y={0} stroke="#4b5563" strokeDasharray="4 4" />
            <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: "3 3", stroke: "#4b5563" }} />
            <Scatter data={points} opacity={0.85}>
              {points.map((p) => (
                <Cell key={p.id} fill={p.pnl >= 0 ? "#22c55e" : "#ef4444"} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Bar: avg PnL per 10-pt score bucket */}
      <div>
        <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
          Average net P&L per score bucket (n = trade count).
        </p>
        {(() => {
          const maxAbsPnl = Math.max(...bucketAvgs.map((x) => Math.abs(x.avgPnl)), 1);
          return (
        <div className="space-y-1.5">
          {bucketAvgs.map((b) => {
            const barPct = Math.abs(b.avgPnl) / maxAbsPnl * 100;
            const isProfit = b.avgPnl >= 0;
            return (
              <div key={b.score} className="flex items-center gap-2 text-xs">
                <span
                  className="tabular-nums text-right shrink-0"
                  style={{ width: 44, color: "var(--text-muted)" }}
                >
                  {b.score}–{b.score + 9}
                </span>
                <div className="flex-1 min-w-0 relative h-4">
                  <div
                    className="absolute inset-y-0 left-0 rounded-sm"
                    style={{
                      width: `${barPct}%`,
                      background: isProfit ? "#22c55e" : "#ef4444",
                      opacity: 0.8,
                      minWidth: b.count > 0 ? 2 : 0,
                    }}
                  />
                </div>
                <span className="shrink-0 tabular-nums" style={{ color: isProfit ? "#22c55e" : "#ef4444", width: 52, textAlign: "right" }}>
                  {b.count > 0 ? `${isProfit ? "+" : ""}$${b.avgPnl.toFixed(0)}` : ""}
                </span>
                <span className="shrink-0 tabular-nums" style={{ color: "var(--text-muted)", width: 32, textAlign: "right" }}>
                  {b.count > 0 ? `n=${b.count}` : "—"}
                </span>
              </div>
            );
          })}
        </div>
          );
        })()}
      </div>
    </div>
  );
}
