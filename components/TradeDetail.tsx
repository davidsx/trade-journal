import ScoreBadge from "@/components/ScoreBadge";
import TradeDetailChart from "@/components/TradeDetailChart";
import type { TradeModel as Trade } from "@/app/generated/prisma/models";
import type { Candle } from "@/lib/analytics/loadDayCandles";

function fmtUsd(v: number) {
  return `${v >= 0 ? "+" : "-"}$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtTime(dt: Date) {
  const HKT_OFFSET_MS = 8 * 60 * 60 * 1000;
  const d = new Date(dt.getTime() + HKT_OFFSET_MS);
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const mon = MONTHS[d.getUTCMonth()];
  const day = d.getUTCDate();
  const year = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${mon} ${day}, ${year} ${hh}:${mm}:${ss} HKT`;
}

function ScoreBar({ label, value, max, color }: { label: string; value: number | null; max: number; color: string }) {
  const pct = value !== null ? (value / max) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span style={{ color: "var(--text-secondary)" }}>{label}</span>
        <span className="font-medium tabular-nums">{value ?? "—"} / {max}</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-border)" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export default function TradeDetail({ trade, dayCandles }: { trade: Trade; dayCandles?: Candle[] }) {
  const notes: string[] = trade.scoreNotes ? JSON.parse(trade.scoreNotes) : [];

  const entryMarker = {
    time: Math.floor(new Date(trade.entryTime).getTime() / 1000),
    price: trade.entryPrice,
    direction: trade.direction as "Long" | "Short",
    type: "entry" as const,
  };
  const exitMarker = {
    time: Math.floor(new Date(trade.exitTime).getTime() / 1000),
    price: trade.exitPrice,
    direction: trade.direction as "Long" | "Short",
    type: "exit" as const,
    pnl: trade.netPnl,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">{trade.contractName}</h1>
        <span
          className="text-xs font-medium px-2 py-0.5 rounded"
          style={{
            background: trade.direction === "Long" ? "#22c55e22" : "#ef444422",
            color: trade.direction === "Long" ? "var(--profit)" : "var(--loss)",
          }}
        >
          {trade.direction}
        </span>
      </div>

      {/* Key stats */}
      <div
        className="rounded-lg p-5 grid grid-cols-2 gap-4"
        style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)" }}
      >
        <div>
          <div className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Entry</div>
          <div className="font-semibold tabular-nums text-lg">{trade.entryPrice.toFixed(2)}</div>
          <div className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{fmtTime(trade.entryTime)}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Exit</div>
          <div className="font-semibold tabular-nums text-lg">{trade.exitPrice.toFixed(2)}</div>
          <div className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{fmtTime(trade.exitTime)}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Qty / Hold</div>
          <div className="font-semibold">
            {trade.qty} ×{" "}
            {trade.holdingMins < 60 ? `${trade.holdingMins.toFixed(0)}m` : `${(trade.holdingMins / 60).toFixed(1)}h`}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Net P&L</div>
          <div className="font-semibold text-lg tabular-nums" style={{ color: trade.netPnl >= 0 ? "var(--profit)" : "var(--loss)" }}>
            {fmtUsd(trade.netPnl)}
          </div>
          <div className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>Fees: {fmtUsd(trade.fees)}</div>
        </div>
      </div>

      {/* Execution chart */}
      <div
        className="rounded-lg overflow-hidden"
        style={{ border: "1px solid var(--bg-border)" }}
      >
        <div className="px-4 pt-3 pb-2 flex items-center justify-between" style={{ background: "var(--bg-card)" }}>
          <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            Execution — 1m candles
          </span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {dayCandles && dayCandles.length > 0 ? `${dayCandles.length} bars` : "no data"}
          </span>
        </div>
        <TradeDetailChart
          candles={dayCandles ?? []}
          entry={entryMarker}
          exit={exitMarker}
        />
      </div>

      {/* Quality score */}
      <div className="rounded-lg p-5 space-y-4" style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)" }}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Quality Score</h2>
          <ScoreBadge score={trade.qualityScore} size="lg" />
        </div>
        <ScoreBar label="Entry Quality" value={trade.entryScore} max={60} color="var(--accent)" />
        <ScoreBar label="Exit Quality" value={trade.exitScore} max={25} color="var(--profit)" />
        <ScoreBar label="Risk Management" value={trade.riskScore} max={15} color="var(--warn)" />
      </div>

      {/* Score notes */}
      {notes.length > 0 && (
        <div className="rounded-lg p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)" }}>
          <h2 className="text-sm font-medium mb-3" style={{ color: "var(--text-secondary)" }}>Score Breakdown</h2>
          <ul className="space-y-2">
            {notes.map((note, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span style={{ color: "var(--text-muted)", marginTop: 2 }}>•</span>
                <span style={{ color: "var(--text-secondary)" }}>{note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Capital context */}
      <div className="rounded-lg p-5 grid grid-cols-2 gap-4" style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)" }}>
        <div>
          <div className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Capital Before</div>
          <div className="font-semibold tabular-nums">{fmtUsd(trade.capitalBefore)}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Capital After</div>
          <div
            className="font-semibold tabular-nums"
            style={{ color: trade.capitalAfter >= trade.capitalBefore ? "var(--profit)" : "var(--loss)" }}
          >
            {fmtUsd(trade.capitalAfter)}
          </div>
        </div>
      </div>
    </div>
  );
}
