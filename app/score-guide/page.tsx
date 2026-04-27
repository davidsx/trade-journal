import RescoreButton from "@/components/RescoreButton";

export default function ScoreGuidePage() {
  return (
    <div className="space-y-6 w-full max-w-none min-w-0">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Trade Quality Score</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Each trade is scored 0–100 across three components. Click the score badge in the{" "}
            <a href="/trades" style={{ color: "var(--accent)" }}>Trades</a> tab to see the breakdown for that trade.
          </p>
        </div>
        <RescoreButton />
      </div>

      {/* Entry */}
      <Section title="Entry Quality" max={70} color="var(--accent)">
        <Row label="Session timing" max={15}>
          <table className="w-full text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
            <tbody>
              <ScoreRow pts={15} desc="Session open — London first hour (4:00–5:00pm HKT) or NY first hour (9:30–10:30pm HKT)" />
              <ScoreRow pts={10} desc="Regular hours — Asia session, rest of London, NY up to 11:30pm HKT" />
              <ScoreRow pts={5}  desc="New York Afternoon — 11:30pm–1:30am HKT (reduced liquidity)" />
              <ScoreRow pts={0}  desc="After 1:30am HKT (low activity)" />
            </tbody>
          </table>
        </Row>
        <Row label="Imbalance handling" max={40}>
          An imbalance (Fair Value Gap) is the price gap left by three consecutive candles where the middle candle is not overlapped by the first and third — i.e. candle[1].high &lt; candle[3].low (bullish) or candle[1].low &gt; candle[3].high (bearish). The gap range is the non-overlapping space between candle 1 and candle 3.
          <table className="w-full text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
            <tbody>
              <ScoreRow pts={40} desc="Entry price is inside an imbalance formed within the last 5 candles" />
              <ScoreRow pts={35} desc="Entry price is inside an imbalance formed within the last 15 candles" />
              <ScoreRow pts={30} desc="Entry price is outside, but the exact previous candle touched an imbalance within 5 candles" />
              <ScoreRow pts={25} desc="Entry price is outside, but the exact previous candle touched an imbalance within 15 candles" />
              <ScoreRow pts={20} desc="Entry price is inside a candle (within the last 5) that rebalanced a 5-candle imbalance" />
              <ScoreRow pts={15} desc="Entry price is inside a candle (within the last 5) that rebalanced a 15-candle imbalance" />
              <ScoreRow pts={10} desc="Entry price is outside, but one of the previous 5 candles touched an imbalance within 5 candles" />
              <ScoreRow pts={5}  desc="Entry price is outside, but one of the previous 5 candles touched an imbalance within 15 candles" />
              <ScoreRow pts={0}  desc="Not near any recent imbalance zone" />
            </tbody>
          </table>
        </Row>
        <Row label="Breakout handling" max={5}>
          A pivot level is identified when two or more candle wicks (highs or lows) in the prior 50 candles cluster within 5 price points of each other. If the entry candle's range runs through any such pivot level, the entry is treated as a breakout entry.
          <table className="w-full text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
            <tbody>
              <ScoreRow pts={5} desc="Entry candle breaks through a pivot level (resistance or support)" />
              <ScoreRow pts={0} desc="No pivot breakout detected on the entry candle" />
            </tbody>
          </table>
        </Row>
        <Row label="Position sizing" max={10}>
          Dollar exposure if price moves 1% against you (qty × price × point value × 1%), as a % of capital. This is a futures-appropriate metric — full notional is misleading for leveraged instruments like NQ/MNQ.
          <table className="w-full text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
            <tbody>
              <ScoreRow pts={10} desc="1% move ≤ 5% of capital — conservative" />
              <ScoreRow pts={7} desc="1% move 5–10% of capital — moderate" />
              <ScoreRow pts={4} desc="1% move 10–15% of capital — moderate" />
              <ScoreRow pts={0} desc="1% move > 15% of capital — oversized" />
            </tbody>
          </table>
        </Row>
      </Section>

      {/* Exit */}
      <Section title="Exit Quality" max={25} color="var(--profit)">
        <Row label="Return on capital" max={15}>
          Net P&L as a percentage of account balance before the trade (no peer comparison).
          <table className="w-full text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
            <tbody>
              <ScoreRow pts={15} desc="&gt; 2% of capital" />
              <ScoreRow pts={10} desc="&gt; 1.5% of capital" />
              <ScoreRow pts={5}  desc="&gt; 1% of capital" />
              <ScoreRow pts={0}  desc="Loss, or win ≤ 1% of capital" />
            </tbody>
          </table>
        </Row>
        <Row label="Hold time" max={10}>
          Absolute hold duration (entry to exit), no comparison to other trades.
          <table className="w-full text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
            <tbody>
              <ScoreRow pts={10} desc="&lt; 1 minute" />
              <ScoreRow pts={7}  desc="&lt; 15 minutes" />
              <ScoreRow pts={4}  desc="&lt; 1 hour" />
              <ScoreRow pts={0}  desc="≥ 1 hour" />
            </tbody>
          </table>
        </Row>
      </Section>

      {/* Risk */}
      <Section title="Risk Management" max={5} color="var(--warn)">
        <Row label="Streak context" max={5}>
          <table className="w-full text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
            <tbody>
              <ScoreRow pts={5} desc="Win after 3+ consecutive losses — discipline rewarded" />
              <ScoreRow pts={3} desc="Normal context" />
              <ScoreRow pts={0} desc="Large loss after 3+ consecutive wins — possible revenge trade" />
            </tbody>
          </table>
        </Row>
      </Section>

      {/* Score breakdown notes explained */}
      <div
        className="rounded-lg p-5 space-y-5"
        style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)" }}
      >
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
          Understanding the Score Breakdown Notes
        </h2>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Each trade detail page shows a bullet-point breakdown. Here is what each note means.
        </p>

        {[
          {
            title: "Entry in imbalance zone (formed within 5 candles) / Entry in imbalance zone (formed within 15 candles)",
            body: "The entry price is directly inside a Fair Value Gap — the most precise and timely entry. Price is currently inside the unmitigated imbalance zone, meaning the structural gap has not yet been filled and the entry catches price at the moment of rebalancing. A FVG formed within 5 candles (40 pts) is fresher and carries more weight than one formed within the last 15 candles (35 pts), but both represent a direct, on-zone entry.",
          },
          {
            title: "Previous candle touched imbalance zone (within 5 candles) / Previous candle touched imbalance zone (within 15 candles)",
            body: "A one-minute-late version of a direct FVG entry. The exact previous candle swept through the imbalance zone, but the entry candle itself opened slightly outside it — the trader entered one bar after the ideal touch. Price has not moved far yet, so the entry is still well-positioned relative to the structure. A fresher FVG (within 5 candles, 30 pts) scores higher than an older one (within 15 candles, 25 pts).",
          },
          {
            title: "Entry inside a candle that rebalanced a recent imbalance (within 5 candles) / (within 15 candles)",
            body: "Price previously rebalanced a Fair Value Gap (a candle overlapped and filled the zone), and the entry price falls inside that rebalancing candle's range. This represents a delayed but still valid entry — price consolidated near the structural level for several candles after the gap was filled, suggesting the zone remains relevant and the move has not exhausted itself. The original FVG being within 5 candles of the rebalancing candle (20 pts) is a tighter and more reliable setup than a wider 15-candle FVG lookback (15 pts).",
          },
          {
            title: "A recent candle (N bars back) touched imbalance zone (within 5 candles) / (within 15 candles)",
            body: "A very late entry. Price interacted with an imbalance zone 2–5 candles ago and has since moved away — the trader is entering well after the structural event, betting on a strong continuation rather than catching the zone itself. The risk is that the best of the move has already occurred. Within-5-candle FVG (10 pts) is a stronger signal than within-15 (5 pts), but neither represents good timing.",
          },
          {
            title: "Entry at session open (prime) / Entry during regular session hours / Entry New York Afternoon — 11:30pm–1:30am HKT (reduced liquidity) / Entry after 1:30am HKT (low activity)",
            body: "Prime (15 pts) is the first hour of the London open (4:00–5:00pm HKT) or the first hour of the NY open (9:30–10:30pm HKT). Regular session hours (10 pts) cover the Asia session, the rest of London, and NY up to 11:30pm HKT. New York Afternoon (5 pts) is 11:30pm–1:30am HKT — reduced liquidity, but not the worst overnight slot. After 1:30am HKT through the rest of the deep overnight window scores 0.",
          },
          {
            title: "Position size: 1% move = X% of capital (conservative / moderate / oversized)",
            body: "Measures your dollar exposure if price moves 1% against you (qty × price × point value × 1%), as a percentage of your account before the trade. Tiers: ≤ 5% of capital → 10 pts (conservative); 5–10% → 7 pts (moderate); 10–15% → 4 pts (moderate); above 15% → 0 (oversized). Boundaries are inclusive at the top of each band (e.g. exactly 10% scores 7). Full notional is misleading for leveraged instruments — this keeps the metric futures-appropriate.",
          },
          {
            title: "Exit +X% of capital (>2% / >1.5% / >1% / ≤1%) / Trade was a loss / Profitable trade (capital unknown)",
            body: "Scores the win as a percentage of balance before the trade: above 2% of capital earns 15 pts, above 1.5% earns 10, above 1% earns 5. A loss always scores 0 on this row. Wins at 1% or below, or wins when capital before the trade is unknown, score 0 here.",
          },
          {
            title: "Hold … (<1 min / <15 min / <1 hour / ≥1 hour)",
            body: "Points depend only on how long the position was open: under 1 minute scores 10, under 15 minutes scores 7, under 1 hour scores 4, and 1 hour or longer scores 0.",
          },
          {
            title: "Win after X consecutive losses (discipline)",
            body: "A winning trade that comes after 3 or more consecutive losses. This is rewarded — it means you stayed disciplined and did not abandon your process during a drawdown.",
          },
          {
            title: "Normal streak context",
            body: "No notable winning or losing streak leading into this trade. A neutral 3 pts is awarded.",
          },
          {
            title: "Large loss after X wins (possible revenge trade)",
            body: "A larger-than-average loss that follows 3 or more consecutive winning trades. This pattern can indicate overconfidence or revenge trading after a streak ends. Scores 0 pts.",
          },
          {
            title: "First trade",
            body: "No prior trades exist to establish streak context. A neutral 3 pts is awarded.",
          },
        ].map((item) => (
          <div key={item.title} style={{ borderTop: "1px solid var(--bg-border)", paddingTop: 14 }}>
            <div className="text-xs font-medium mb-1.5 font-mono" style={{ color: "var(--accent)" }}>
              &ldquo;{item.title}&rdquo;
            </div>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{item.body}</p>
          </div>
        ))}
      </div>

      {/* Score tiers */}
      <div
        className="rounded-lg p-5"
        style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)" }}
      >
        <h2 className="text-sm font-medium mb-3" style={{ color: "var(--text-secondary)" }}>Score Tiers</h2>
        <div className="space-y-2">
          {[
            { range: "90–100", label: "Excellent",   color: "#15803d" },
            { range: "80–89",  label: "Great",       color: "#16a34a" },
            { range: "70–79",  label: "Good",        color: "#22c55e" },
            { range: "60–69",  label: "Above avg",   color: "#84cc16" },
            { range: "50–59",  label: "Average",     color: "#eab308" },
            { range: "40–49",  label: "Below avg",   color: "#f59e0b" },
            { range: "30–39",  label: "Weak",        color: "#fb923c" },
            { range: "20–29",  label: "Poor",        color: "#f97316" },
            { range: "10–19",  label: "Bad",         color: "#ef4444" },
            { range: "0–9",    label: "Very bad",    color: "#dc2626" },
          ].map((t) => (
            <div key={t.range} className="flex items-center gap-3 text-sm">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: t.color }} />
              <span className="tabular-nums w-16" style={{ color: t.color }}>{t.range}</span>
              <span style={{ color: "var(--text-secondary)" }}>{t.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Section({ title, max, color, children }: {
  title: string; max: number; color: string; children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-lg p-5 space-y-4"
      style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)" }}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold" style={{ color }}>{title}</h2>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>max {max} pts</span>
      </div>
      {children}
    </div>
  );
}

function Row({ label, max, children }: { label: string; max: number; children: React.ReactNode }) {
  return (
    <div className="text-sm" style={{ borderTop: "1px solid var(--bg-border)", paddingTop: 12 }}>
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium">{label}</span>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>0–{max} pts</span>
      </div>
      <div style={{ color: "var(--text-secondary)" }}>{children}</div>
    </div>
  );
}

function ScoreRow({ pts, desc }: { pts: number; desc: string }) {
  return (
    <tr>
      <td className="py-0.5 pr-3 tabular-nums font-medium w-8" style={{ color: "var(--text-primary)" }}>{pts}</td>
      <td className="py-0.5">{desc}</td>
    </tr>
  );
}
