import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Svg,
  Polyline,
  Line,
} from "@react-pdf/renderer";
import type { AccountReportPayload } from "@/lib/pdf/buildAccountReportPayload";
import type { SessionName } from "@/lib/analytics/patterns";
import {
  AnalyticsBestAndScoreTablesPage,
  AnalyticsHoldPage,
  AnalyticsHourlyPage,
  AnalyticsScoreDistributionsPage,
  AnalyticsSummaryAndChartsPage,
} from "@/lib/pdf/analyticsPdf";

const palette = {
  text: "#111827",
  muted: "#6b7280",
  border: "#e5e7eb",
  profit: "#15803d",
  loss: "#b91c1c",
  warn: "#a16207",
  accent: "#1d4ed8",
  card: "#f9fafb",
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: palette.text,
  },
  pageLandscape: {
    padding: 32,
    fontFamily: "Helvetica",
    fontSize: 7,
    color: palette.text,
  },
  h1: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  h2: { fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 12, marginBottom: 8, color: palette.accent },
  h3: { fontSize: 9, fontFamily: "Helvetica-Bold", marginTop: 8, marginBottom: 4 },
  muted: { color: palette.muted, fontSize: 8 },
  row: { flexDirection: "row", marginBottom: 2 },
  statGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 8, gap: 0 },
  statBox: {
    width: "25%",
    minHeight: 52,
    padding: 6,
    border: `1pt solid ${palette.border}`,
    backgroundColor: palette.card,
  },
  statLabel: { fontSize: 7, color: palette.muted, marginBottom: 2 },
  statValue: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  statSub: { fontSize: 7, color: palette.muted, marginTop: 2 },
  tableHeader: {
    flexDirection: "row",
    borderBottom: `1pt solid ${palette.border}`,
    paddingBottom: 3,
    marginBottom: 2,
  },
  tableRow: { flexDirection: "row", borderBottom: `0.5pt solid ${palette.border}`, paddingVertical: 3 },
  th: { fontSize: 7, fontFamily: "Helvetica-Bold", color: palette.muted },
  td: { fontSize: 7 },
  twoCol: { flexDirection: "row", gap: 8 },
  col: { flex: 1 },
  sessionCard: {
    marginBottom: 6,
    padding: 6,
    border: `1pt solid ${palette.border}`,
    backgroundColor: "#fafafa",
  },
  sessionTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", marginBottom: 2 },
});

function fmtUsd(v: number) {
  const sign = v >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPct(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}

function fmtHktFromIso(iso: string) {
  const HKT_OFFSET_MS = 8 * 60 * 60 * 1000;
  const d = new Date(new Date(iso).getTime() + HKT_OFFSET_MS);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const mon = months[d.getUTCMonth()];
  const day = d.getUTCDate();
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${mon} ${day} ${hh}:${mm} HKT`;
}

function sessionAccent(session: SessionName) {
  switch (session) {
    case "Asia":
      return "#6d28d9";
    case "London":
      return "#2563eb";
    case "NY":
      return "#16a34a";
    default:
      return "#6b7280";
  }
}

function EquityChart({ points, startingLabel }: { points: { equity: number }[]; startingLabel: string }) {
  const w = 500;
  const h = 90;
  const pad = 6;
  if (points.length === 0) {
    return <Text style={styles.muted}>No closed trades — equity flat at {startingLabel}.</Text>;
  }
  const eqs = points.map((p) => p.equity);
  let minE = Math.min(...eqs);
  let maxE = Math.max(...eqs);
  if (minE === maxE) {
    minE -= 1;
    maxE += 1;
  }
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  const coords = points.map((p, i) => {
    const x = pad + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
    const t = (p.equity - minE) / (maxE - minE);
    const y = pad + (1 - t) * innerH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <View>
      <Svg width={w} height={h}>
        <Line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke={palette.border} strokeWidth={1} />
        <Line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke={palette.border} strokeWidth={1} />
        <Polyline
          points={coords.join(" ")}
          fill="none"
          stroke={palette.accent}
          strokeWidth={1.5}
        />
      </Svg>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 2 }}>
        <Text style={styles.muted}>${minE.toLocaleString("en-US", { maximumFractionDigits: 0 })}</Text>
        <Text style={styles.muted}>${maxE.toLocaleString("en-US", { maximumFractionDigits: 0 })}</Text>
      </View>
    </View>
  );
}

function formatPf(p: number) {
  return p >= 999 ? "∞" : p.toFixed(2);
}

function DashboardPage({ data }: { data: AccountReportPayload }) {
  const m = data.metrics;
  const scoreColor =
    m.avgQualityScore !== null
      ? m.avgQualityScore >= 70
        ? palette.profit
        : m.avgQualityScore >= 40
        ? palette.warn
        : palette.loss
      : palette.muted;
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.h1}>Trade Journal — report</Text>
      <Text style={styles.muted}>
        {data.account.name} · starting capital ${data.account.initialBalance.toLocaleString("en-US", { maximumFractionDigits: 0 })} ·
        generated {data.generatedAt.slice(0, 10)} (UTC)
      </Text>
      <Text style={[styles.h2, { marginTop: 16 }]}>Summary (home dashboard)</Text>
      <View style={styles.statGrid}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Net P&amp;L</Text>
          <Text style={[styles.statValue, { color: m.totalNetPnl >= 0 ? palette.profit : palette.loss }]}>{fmtUsd(m.totalNetPnl)}</Text>
          <Text style={styles.statSub}>Avg {fmtUsd(m.avgNetPnl)} / trade</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Win rate</Text>
          <Text style={[styles.statValue, { color: m.winRate >= 0.5 ? palette.profit : palette.loss }]}>{fmtPct(m.winRate)}</Text>
          <Text style={styles.statSub}>
            {m.winningTrades}W / {m.losingTrades}L
          </Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Profit factor</Text>
          <Text style={[styles.statValue, { color: m.profitFactor >= 1.5 ? palette.profit : m.profitFactor >= 1 ? palette.warn : palette.loss }]}>
            {formatPf(m.profitFactor)}
          </Text>
          <Text style={styles.statSub}>Gross wins / gross losses</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Sharpe (daily)</Text>
          <Text style={[styles.statValue, { color: m.sharpeRatio >= 1 ? palette.profit : m.sharpeRatio >= 0 ? palette.warn : palette.loss }]}>
            {m.sharpeRatio.toFixed(2)}
          </Text>
          <Text style={styles.statSub}>Sortino: {m.sortinoRatio.toFixed(2)}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Max drawdown</Text>
          <Text style={[styles.statValue, { color: palette.loss }]}>{m.maxDrawdownPct.toFixed(1)}%</Text>
          <Text style={styles.statSub}>{fmtUsd(m.maxDrawdownAbs)}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Avg win / loss</Text>
          <Text style={[styles.statValue, { color: palette.profit }]}>{fmtUsd(m.avgWin)}</Text>
          <Text style={styles.statSub}>Avg loss: {fmtUsd(m.avgLoss)}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Avg hold</Text>
          <Text style={styles.statValue}>
            {m.avgHoldingMins < 60
              ? `${m.avgHoldingMins.toFixed(0)}m`
              : `${(m.avgHoldingMins / 60).toFixed(1)}h`}
          </Text>
          <Text style={styles.statSub}>Average hold time</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Avg quality</Text>
          <Text style={[styles.statValue, { color: scoreColor }]}>{m.avgQualityScore !== null ? m.avgQualityScore.toFixed(0) : "—"}</Text>
          <Text style={styles.statSub}>0–100 score</Text>
        </View>
      </View>
      <Text style={styles.h2}>Equity curve</Text>
      <Text style={styles.muted} wrap={false}>
        After each trade (exit time order); baseline ${m.startingCapital.toLocaleString("en-US", { maximumFractionDigits: 0 })}.
      </Text>
      <View style={{ marginTop: 6 }}>
        <EquityChart points={m.equityCurve} startingLabel={`$${m.startingCapital.toLocaleString("en-US", { maximumFractionDigits: 0 })}`} />
      </View>
    </Page>
  );
}

function TimeBucketTable({ rows }: { rows: AccountReportPayload["timeOfDay"] }) {
  return (
    <View>
      <View style={styles.tableHeader}>
        <Text style={{ ...styles.th, width: "22%" }}>Time</Text>
        <Text style={{ ...styles.th, width: "20%" }}>Trades</Text>
        <Text style={{ ...styles.th, width: "25%" }}>Win %</Text>
        <Text style={{ ...styles.th, width: "33%" }}>Avg P&amp;L</Text>
      </View>
      {rows.map((b) => (
        <View key={b.hourLabel} style={styles.tableRow} wrap={false}>
          <Text style={{ ...styles.td, width: "22%" }}>{b.hourLabel}</Text>
          <Text style={{ ...styles.td, width: "20%" }}>{b.tradeCount}</Text>
          <Text style={{ ...styles.td, width: "25%", color: b.winRate >= 0.5 ? palette.profit : palette.loss }}>
            {(b.winRate * 100).toFixed(0)}%
          </Text>
          <Text style={{ ...styles.td, width: "33%" }}>{fmtUsd(b.avgPnl)}</Text>
        </View>
      ))}
    </View>
  );
}

function PatternsPage({ data }: { data: AccountReportPayload }) {
  const timeBuckets = data.timeOfDay.filter((b) => b.tradeCount > 0);
  const mid = Math.ceil(timeBuckets.length / 2);
  const timeLeft = timeBuckets.slice(0, mid);
  const timeRight = timeBuckets.slice(mid);
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.h1}>Patterns</Text>
      <Text style={styles.muted}>
        Time buckets and sessions use HKT. Entry time drives 30m buckets. Day of week is based on the trading day (CME, HKT) from exit time.
      </Text>
      <Text style={styles.h2}>Time of day (30m buckets, entry HKT)</Text>
      <View style={styles.twoCol}>
        <View style={styles.col}>
          <TimeBucketTable rows={timeLeft} />
        </View>
        <View style={styles.col}>
          <TimeBucketTable rows={timeRight} />
        </View>
      </View>
      <Text style={styles.h2}>Day of week (trading day, HKT rule)</Text>
      <View style={styles.tableHeader}>
        <Text style={{ ...styles.th, width: "30%" }}>Day</Text>
        <Text style={{ ...styles.th, width: "20%" }}>Trades</Text>
        <Text style={{ ...styles.th, width: "25%" }}>Win %</Text>
        <Text style={{ ...styles.th, width: "25%" }}>Avg P&amp;L</Text>
      </View>
      {data.dayOfWeek.map((b) => (
        <View key={b.dayName} style={styles.tableRow} wrap={false}>
          <Text style={{ ...styles.td, width: "30%" }}>{b.dayName}</Text>
          <Text style={{ ...styles.td, width: "20%" }}>{b.tradeCount}</Text>
          <Text style={{ ...styles.td, width: "25%", color: b.winRate >= 0.5 ? palette.profit : palette.loss }}>
            {(b.winRate * 100).toFixed(0)}%
          </Text>
          <Text style={{ ...styles.td, width: "25%" }}>{fmtUsd(b.avgPnl)}</Text>
        </View>
      ))}
    </Page>
  );
}

function PatternsPage2({ data }: { data: AccountReportPayload }) {
  const decayAlerts = data.edgeDecay.filter((e) => e.decayAlert);
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.h1}>Patterns (continued)</Text>
      <Text style={styles.h2}>Session performance (HKT)</Text>
      {data.sessions.map((s) => {
        const c = sessionAccent(s.session);
        const noData = s.tradeCount === 0;
        return (
          <View key={s.session} style={styles.sessionCard} wrap={false}>
            <Text style={[styles.sessionTitle, { color: c }]}>
              {s.session} · {s.hktRange} HKT
            </Text>
            {noData ? (
              <Text style={styles.muted}>No trades</Text>
            ) : (
              <View>
                <Text style={styles.td}>
                  {s.tradeCount} trades · win {(s.winRate * 100).toFixed(0)}% · total {fmtUsd(s.totalPnl)} · avg {fmtUsd(s.avgPnl)} · PF {formatPf(s.profitFactor)}
                </Text>
                <Text style={styles.muted}>
                  Avg hold:{" "}
                  {s.avgHoldMins < 60
                    ? `${s.avgHoldMins.toFixed(0)}m`
                    : `${(s.avgHoldMins / 60).toFixed(1)}h`}{" "}
                  · best +${s.bestTrade.toFixed(0)} · worst ${s.worstTrade.toFixed(0)} · long {s.longCount} / short {s.shortCount} · L WR{" "}
                  {(s.longWinRate * 100).toFixed(0)}% · S WR {(s.shortWinRate * 100).toFixed(0)}%
                </Text>
              </View>
            )}
          </View>
        );
      })}
      <Text style={styles.h2}>Instruments</Text>
      {data.instruments.length === 0 ? (
        <Text style={styles.muted}>No data</Text>
      ) : (
        <>
          <View style={styles.tableHeader}>
            <Text style={{ ...styles.th, width: "22%" }}>Contract</Text>
            <Text style={{ ...styles.th, width: "12%" }}>N</Text>
            <Text style={{ ...styles.th, width: "16%" }}>Win %</Text>
            <Text style={{ ...styles.th, width: "16%" }}>PF</Text>
            <Text style={{ ...styles.th, width: "16%" }}>Avg</Text>
            <Text style={{ ...styles.th, width: "18%" }}>Total</Text>
          </View>
          {data.instruments.map((ins) => (
            <View key={ins.contractName} style={styles.tableRow} wrap={false}>
              <Text style={{ ...styles.td, width: "22%" }}>{ins.contractName}</Text>
              <Text style={{ ...styles.td, width: "12%" }}>{ins.tradeCount}</Text>
              <Text style={{ ...styles.td, width: "16%", color: ins.winRate >= 0.5 ? palette.profit : palette.loss }}>
                {(ins.winRate * 100).toFixed(0)}%
              </Text>
              <Text style={{ ...styles.td, width: "16%", color: ins.profitFactor >= 1 ? palette.profit : palette.loss }}>
                {formatPf(ins.profitFactor)}
              </Text>
              <Text style={{ ...styles.td, width: "16%" }}>{fmtUsd(ins.avgPnl)}</Text>
              <Text
                style={{
                  ...styles.td,
                  width: "18%",
                  fontFamily: "Helvetica-Bold",
                  color: ins.totalPnl >= 0 ? palette.profit : palette.loss,
                }}
              >
                {fmtUsd(ins.totalPnl)}
              </Text>
            </View>
          ))}
        </>
      )}
      <Text style={styles.h2}>Streaks</Text>
      <Text style={styles.td} wrap>
        Current:{" "}
        {data.streaks.currentStreakType === "win"
          ? `+${data.streaks.currentStreak} wins`
          : data.streaks.currentStreakType === "loss"
            ? `${data.streaks.currentStreak} losses`
            : "—"}{" "}
        · Max win streak: {data.streaks.maxWinStreak} · Max loss streak: {data.streaks.maxLossStreak} · Longest underwater: {data.streaks.longestUnderwaterTrades}{" "}
        trades
      </Text>
      {data.edgeDecay.length > 0 && (
        <>
          <Text style={styles.h2}>Edge decay (20-trade rolling win rate)</Text>
          <Text style={styles.muted}>
            {decayAlerts.length} rolling window(s) flagged (drop &gt; 15% vs full-sample win rate). Trades {data.edgeDecay[0]?.tradeIndex}–{data.edgeDecay[data.edgeDecay.length - 1]?.tradeIndex}.
          </Text>
        </>
      )}
    </Page>
  );
}

const TRADES_PER_PAGE = 28;

function TradesPageChunk({
  data,
  chunk,
  pageIndex,
  totalPages,
}: {
  data: AccountReportPayload;
  chunk: typeof data.tradeRows;
  pageIndex: number;
  totalPages: number;
}) {
  return (
    <Page size="A4" orientation="landscape" style={styles.pageLandscape}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
        <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold" }}>Trades — {data.account.name}</Text>
        <Text style={styles.muted}>
          Page {pageIndex + 1} / {totalPages} · {data.tradeRows.length} total
        </Text>
      </View>
      {chunk.length === 0 ? (
        <Text style={styles.muted}>No trades in this account.</Text>
      ) : (
        <>
          <View style={styles.tableHeader}>
            <Text style={{ ...styles.th, width: "10%" }}>Contract</Text>
            <Text style={{ ...styles.th, width: "5%" }}>Dir</Text>
            <Text style={{ ...styles.th, width: "3%" }}>Qty</Text>
            <Text style={{ ...styles.th, width: "20%" }}>Entry</Text>
            <Text style={{ ...styles.th, width: "20%" }}>Exit</Text>
            <Text style={{ ...styles.th, width: "6%" }}>Hold</Text>
            <Text style={{ ...styles.th, width: "10%" }}>Net P&amp;L</Text>
            <Text style={{ ...styles.th, width: "6%" }}>Score</Text>
          </View>
          {chunk.map((t) => (
            <View key={t.id} style={styles.tableRow} wrap={false}>
              <Text style={{ ...styles.td, width: "10%" }}>{t.contractName}</Text>
              <Text
                style={{
                  ...styles.td,
                  width: "5%",
                  color: t.direction === "Long" ? palette.profit : palette.loss,
                }}
              >
                {t.direction}
              </Text>
              <Text style={{ ...styles.td, width: "3%" }}>{t.qty}</Text>
              <Text style={{ ...styles.td, width: "20%" }}>{t.entryPrice.toFixed(2)} · {fmtHktFromIso(t.entryTime)}</Text>
              <Text style={{ ...styles.td, width: "20%" }}>{t.exitPrice.toFixed(2)} · {fmtHktFromIso(t.exitTime)}</Text>
              <Text style={{ ...styles.td, width: "6%" }}>
                {t.holdingMins < 60
                  ? `${t.holdingMins.toFixed(0)}m`
                  : `${(t.holdingMins / 60).toFixed(1)}h`}
              </Text>
              <Text style={{ ...styles.td, width: "10%", color: t.netPnl >= 0 ? palette.profit : palette.loss, fontFamily: "Helvetica-Bold" }}>
                {fmtUsd(t.netPnl)}
              </Text>
              <Text style={{ ...styles.td, width: "6%" }}>{t.qualityScore ?? "—"}</Text>
            </View>
          ))}
        </>
      )}
    </Page>
  );
}

export function AccountReportDocument({ data }: { data: AccountReportPayload }) {
  const tradeChunks: typeof data.tradeRows[] = [];
  if (data.tradeRows.length === 0) {
    tradeChunks.push([]);
  } else {
    for (let i = 0; i < data.tradeRows.length; i += TRADES_PER_PAGE) {
      tradeChunks.push(data.tradeRows.slice(i, i + TRADES_PER_PAGE));
    }
  }
  const totalTradePages = Math.max(1, tradeChunks.length);
  return (
    <Document>
      <DashboardPage data={data} />
      <AnalyticsSummaryAndChartsPage data={data} />
      <AnalyticsScoreDistributionsPage data={data} />
      <AnalyticsBestAndScoreTablesPage data={data} />
      <AnalyticsHoldPage data={data} />
      <AnalyticsHourlyPage data={data} />
      <PatternsPage data={data} />
      <PatternsPage2 data={data} />
      {tradeChunks.map((chunk, i) => (
        <TradesPageChunk
          key={i}
          data={data}
          chunk={chunk}
          pageIndex={i}
          totalPages={totalTradePages}
        />
      ))}
    </Document>
  );
}
