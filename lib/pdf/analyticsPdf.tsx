import {
  Page,
  Text,
  View,
  StyleSheet,
  Svg,
  Polyline,
  Line,
  Rect,
} from "@react-pdf/renderer";
import type { AccountReportPayload } from "@/lib/pdf/buildAccountReportPayload";
import type { ScoreTimeRow } from "@/lib/analytics/scoreTimeMetrics";

const palette = {
  text: "#111827",
  muted: "#6b7280",
  border: "#e5e7eb",
  profit: "#15803d",
  loss: "#b91c1c",
  accent: "#1d4ed8",
  card: "#f9fafb",
  dd: "#dc2626",
};

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: palette.text,
  },
  h1: { fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  h2: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 10, marginBottom: 6, color: palette.accent },
  muted: { color: palette.muted, fontSize: 7 },
  statCell: {
    width: "33.33%",
    padding: 6,
    border: `1pt solid ${palette.border}`,
    backgroundColor: palette.card,
    minHeight: 44,
  },
  statLabel: { fontSize: 7, color: palette.muted, marginBottom: 2 },
  statValue: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  grid: { flexDirection: "row", flexWrap: "wrap", marginTop: 6 },
  th: { fontSize: 6.5, fontFamily: "Helvetica-Bold", color: palette.muted },
  td: { fontSize: 6.5 },
  tableHeader: { flexDirection: "row", borderBottom: `1pt solid ${palette.border}`, paddingBottom: 2, marginBottom: 1 },
  tableRow: { flexDirection: "row", borderBottom: `0.5pt solid ${palette.border}`, paddingVertical: 2 },
  twoCol: { flexDirection: "row", gap: 10 },
  col: { flex: 1 },
});

function formatAnalyticsPF(pf: number) {
  if (pf >= 90) return "∞";
  return pf.toFixed(2);
}

function formatAvgHoldMins(mins: number) {
  if (mins < 60) return `${Math.round(mins)}m`;
  return `${(mins / 60).toFixed(1)}h`;
}

function fmtPnlPlain(n: number) {
  const sign = n >= 0 ? "+" : "−";
  return `${sign}$${Math.abs(n).toFixed(0)}`;
}

function fmtUsd(v: number) {
  const sign = v >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatScoreBest(r: ScoreTimeRow | null): string {
  if (!r || r.scoredCount === 0 || r.avgQuality === null) return "— (no scored trades)";
  return `${r.label}: avg score ${r.avgQuality.toFixed(1)} · ${r.tradeCount} trades (${r.scoredCount} scored)`;
}

function formatPnlBest(r: ScoreTimeRow | null): string {
  if (!r || r.tradeCount === 0) return "— (no trades)";
  return `${r.label}: avg P&L ${fmtPnlPlain(r.avgPnl)} · total ${fmtPnlPlain(r.totalPnl)} · ${r.tradeCount} trades`;
}

function DrawdownSvg({ series, maxPctLabel }: { series: { drawdownPct: number }[]; maxPctLabel: string }) {
  const w = 500;
  const h = 95;
  const pad = 8;
  if (series.length === 0) {
    return <Text style={styles.muted}>No data</Text>;
  }
  const minPct = Math.min(...series.map((d) => d.drawdownPct), 0);
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  const pts = series.map((d, i) => {
    const x = pad + (series.length <= 1 ? innerW / 2 : (i / (series.length - 1)) * innerW);
    const t = minPct >= 0 ? 0 : (0 - d.drawdownPct) / (0 - minPct);
    const y = pad + (1 - t) * innerH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <View>
      <Svg width={w} height={h}>
        <Line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke={palette.border} strokeWidth={0.8} />
        <Line x1={pad} y1={pad} x2={w - pad} y2={pad} stroke={palette.border} strokeWidth={0.8} />
        <Line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke={palette.border} strokeWidth={0.8} />
        <Polyline points={pts.join(" ")} fill="none" stroke={palette.dd} strokeWidth={1.2} />
      </Svg>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 2 }}>
        <Text style={styles.muted}>0%</Text>
        <Text style={styles.muted}>{maxPctLabel}</Text>
      </View>
    </View>
  );
}

function PerTradePnlSvg({ pnls }: { pnls: number[] }) {
  const w = 500;
  const h = 110;
  const pad = 8;
  if (pnls.length === 0) {
    return <Text style={styles.muted}>No data</Text>;
  }
  const maxAbs = Math.max(...pnls.map((p) => Math.abs(p)), 1e-6);
  const innerW = w - 2 * pad;
  const innerH = (h - 2 * pad) / 2;
  const mid = h / 2;
  const n = pnls.length;
  const barW = Math.max(0.4, innerW / n);
  return (
    <View>
      <Svg width={w} height={h}>
        <Line x1={pad} y1={mid} x2={w - pad} y2={mid} stroke={palette.muted} strokeWidth={0.5} />
        {pnls.map((pnl, i) => {
          const x = pad + i * (innerW / n);
          const bh = (Math.abs(pnl) / maxAbs) * (innerH - 2);
          if (pnl >= 0) {
            return (
              <Rect
                key={i}
                x={x}
                y={mid - bh}
                width={barW * 0.85}
                height={bh}
                fill={palette.profit}
              />
            );
          }
          return (
            <Rect key={i} x={x} y={mid} width={barW * 0.85} height={bh} fill={palette.loss} />
          );
        })}
      </Svg>
    </View>
  );
}

function ScoreMetricsTable({
  title,
  firstColumnLabel,
  rows,
}: {
  title: string;
  firstColumnLabel: string;
  rows: ScoreTimeRow[];
}) {
  if (rows.length === 0) {
    return (
      <View>
        <Text style={styles.h2}>{title}</Text>
        <Text style={styles.muted}>No data</Text>
      </View>
    );
  }
  return (
    <View>
      <Text style={styles.h2}>{title}</Text>
      <View style={styles.tableHeader}>
        <Text style={{ ...styles.th, width: "28%" }}>{firstColumnLabel}</Text>
        <Text style={{ ...styles.th, width: "10%" }}>Trades</Text>
        <Text style={{ ...styles.th, width: "10%" }}>Scored</Text>
        <Text style={{ ...styles.th, width: "12%" }}>Avg Q</Text>
        <Text style={{ ...styles.th, width: "20%" }}>Avg P&amp;L</Text>
        <Text style={{ ...styles.th, width: "20%" }}>Total P&amp;L</Text>
      </View>
      {rows.map((r) => (
        <View key={`${r.label}||${r.sublabel ?? ""}`} style={styles.tableRow} wrap={false}>
          <View style={{ width: "28%" }}>
            <Text style={styles.td}>{r.label}</Text>
            {r.sublabel ? <Text style={styles.muted}>{r.sublabel}</Text> : null}
          </View>
          <Text style={{ ...styles.td, width: "10%" }}>{r.tradeCount}</Text>
          <Text style={{ ...styles.td, width: "10%" }}>{r.scoredCount}</Text>
          <Text style={{ ...styles.td, width: "12%" }}>{r.avgQuality !== null ? r.avgQuality.toFixed(1) : "—"}</Text>
          <Text
            style={{
              ...styles.td,
              width: "20%",
              color: r.tradeCount > 0 ? (r.avgPnl >= 0 ? palette.profit : palette.loss) : palette.muted,
            }}
          >
            {r.tradeCount > 0 ? fmtPnlPlain(r.avgPnl) : "—"}
          </Text>
          <Text
            style={{
              ...styles.td,
              width: "20%",
              color: r.tradeCount > 0 ? (r.totalPnl >= 0 ? palette.profit : palette.loss) : palette.muted,
            }}
          >
            {r.tradeCount > 0 ? fmtPnlPlain(r.totalPnl) : "—"}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function AnalyticsSummaryAndChartsPage({ data }: { data: AccountReportPayload }) {
  const m = data.metrics;
  const a = data.analytics;
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.h1}>Analytics</Text>
      <Text style={styles.muted}>
        Same high-level numbers as the Analytics page. Sharpe and Sortino are on the dashboard; this section focuses on P&amp;L, win/loss, quality, and drawdowns.
      </Text>
      <View style={styles.grid}>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>Net P&amp;L</Text>
          <Text
            style={[
            styles.statValue,
            { color: m.totalNetPnl > 0 ? palette.profit : m.totalNetPnl < 0 ? palette.loss : palette.text },
            ]}
          >
            {m.totalTrades === 0
              ? "—"
              : `${m.totalNetPnl >= 0 ? "+" : "−"}$${Math.abs(m.totalNetPnl).toFixed(2)}`}
          </Text>
        </View>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>Avg / trade</Text>
          <Text
            style={[
            styles.statValue,
            { color: m.avgNetPnl > 0 ? palette.profit : m.avgNetPnl < 0 ? palette.loss : palette.text },
            ]}
          >
            {m.totalTrades === 0
              ? "—"
              : `${m.avgNetPnl >= 0 ? "+" : "−"}$${Math.abs(m.avgNetPnl).toFixed(2)}`}
          </Text>
        </View>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>Win rate</Text>
          <Text style={styles.statValue}>
            {m.totalTrades === 0 ? "—" : `${(m.winRate * 100).toFixed(1)}%`}
          </Text>
        </View>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>Profit factor</Text>
          <Text style={styles.statValue}>
            {m.totalTrades === 0 ? "—" : formatAnalyticsPF(m.profitFactor)}
          </Text>
        </View>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>Trades (W / L)</Text>
          <Text style={styles.statValue}>
            {m.totalTrades === 0
              ? "—"
              : `${m.totalTrades} (${m.winningTrades} / ${m.losingTrades})`}
          </Text>
        </View>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>Avg win</Text>
          <Text style={[styles.statValue, { color: palette.profit }]}>
            {m.winningTrades === 0 ? "—" : `$${m.avgWin.toFixed(2)}`}
          </Text>
        </View>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>Avg loss</Text>
          <Text style={[styles.statValue, { color: palette.loss }]}>
            {m.losingTrades === 0 ? "—" : `$${m.avgLoss.toFixed(2)}`}
          </Text>
        </View>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>Avg quality</Text>
          <Text style={styles.statValue}>
            {m.avgQualityScore === null ? "—" : m.avgQualityScore.toFixed(1)}
          </Text>
        </View>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>Avg hold</Text>
          <Text style={styles.statValue}>
            {m.totalTrades === 0 ? "—" : formatAvgHoldMins(m.avgHoldingMins)}
          </Text>
        </View>
      </View>
      <Text style={styles.h2}>Drawdown</Text>
      <Text style={styles.muted} wrap>
        Max: {m.maxDrawdownPct.toFixed(1)}% · {fmtUsd(m.maxDrawdownAbs)} (underwater from peak equity, same series as the app chart)
      </Text>
      <View style={{ marginTop: 4 }}>
        <DrawdownSvg series={m.drawdownSeries} maxPctLabel={`${m.maxDrawdownPct.toFixed(1)}%`} />
      </View>
      <Text style={styles.h2}>Per-trade P&amp;L</Text>
      <Text style={styles.muted} wrap>
        One bar per trade in entry-time order; green above zero, red below (same as the P&amp;L bar chart in the app).
      </Text>
      <View style={{ marginTop: 4 }}>
        <PerTradePnlSvg pnls={a.perTradeNetPnl} />
      </View>
    </Page>
  );
}

export function AnalyticsScoreDistributionsPage({ data }: { data: AccountReportPayload }) {
  const a = data.analytics;
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.h1}>Analytics (continued)</Text>
      <Text style={styles.h2}>Trade quality score distribution</Text>
      <Text style={styles.muted} wrap>
        Counts of rounded scores 0-100, grouped in 10-point bands; last band 90-100. Matches a binned view of the app histogram.
      </Text>
      <View style={[styles.tableHeader, { marginTop: 6 }]}>
        <Text style={{ ...styles.th, width: "50%" }}>Score range</Text>
        <Text style={{ ...styles.th, width: "50%" }}>Trades</Text>
      </View>
      {a.scoreDist10Bins.map((b) => (
        <View key={b.label} style={styles.tableRow} wrap={false}>
          <Text style={{ ...styles.td, width: "50%" }}>{b.label}</Text>
          <Text style={{ ...styles.td, width: "50%" }}>{b.count}</Text>
        </View>
      ))}
      <Text style={styles.h2}>Score vs net P&amp;L</Text>
      <Text style={styles.muted} wrap>
        Average net P&amp;L by score decile: same floor(score/10) bucketing as the app; 90-100 in the last bucket.
      </Text>
      <View style={[styles.tableHeader, { marginTop: 6 }]}>
        <Text style={{ ...styles.th, width: "30%" }}>Score bucket</Text>
        <Text style={{ ...styles.th, width: "20%" }}>Trades</Text>
        <Text style={{ ...styles.th, width: "50%" }}>Avg net P&amp;L</Text>
      </View>
      {a.scorePnl10Buckets.map((b) => (
        <View key={b.label} style={styles.tableRow} wrap={false}>
          <Text style={{ ...styles.td, width: "30%" }}>{b.label}</Text>
          <Text style={{ ...styles.td, width: "20%" }}>{b.count}</Text>
          <Text
            style={{
              ...styles.td,
              width: "50%",
              color: b.count > 0 ? (b.avgPnl >= 0 ? palette.profit : palette.loss) : palette.muted,
            }}
          >
            {b.count > 0 ? fmtPnlPlain(b.avgPnl) : "—"}
          </Text>
        </View>
      ))}
    </Page>
  );
}

export function AnalyticsBestAndScoreTablesPage({ data }: { data: AccountReportPayload }) {
  const b = data.analytics.bests;
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.h1}>Quality by time (summary)</Text>
      <Text style={styles.muted} wrap>
        Session and hour: entry in HKT. Hour order is Globex trading day (from 06:00). Weekday = CME session trading day. Hold = minutes in position. Best buckets use the same rules as the app callouts.
      </Text>
      <View style={styles.twoCol}>
        <View style={styles.col}>
          <Text style={[styles.h2, { color: palette.accent }]}>Best avg quality (score)</Text>
          <Text style={styles.muted} wrap>
            Session: {formatScoreBest(b.session.byScore)}
          </Text>
          <Text style={styles.muted} wrap>
            Hour: {formatScoreBest(b.hour.byScore)}
          </Text>
          <Text style={styles.muted} wrap>
            Weekday: {formatScoreBest(b.weekday.byScore)}
          </Text>
          <Text style={styles.muted} wrap>
            Hold: {formatScoreBest(b.hold.byScore)}
          </Text>
        </View>
        <View style={styles.col}>
          <Text style={[styles.h2, { color: palette.profit }]}>Best avg P&amp;L</Text>
          <Text style={styles.muted} wrap>
            Session: {formatPnlBest(b.session.byPnl)}
          </Text>
          <Text style={styles.muted} wrap>
            Hour: {formatPnlBest(b.hour.byPnl)}
          </Text>
          <Text style={styles.muted} wrap>
            Weekday: {formatPnlBest(b.weekday.byPnl)}
          </Text>
          <Text style={styles.muted} wrap>
            Hold: {formatPnlBest(b.hold.byPnl)}
          </Text>
        </View>
      </View>
      <View style={{ marginTop: 8 }}>
        <ScoreMetricsTable
          title="Quality score by session"
          firstColumnLabel="Session"
          rows={data.analytics.sessionRows}
        />
      </View>
      <View style={{ marginTop: 8 }}>
        <ScoreMetricsTable title="By weekday" firstColumnLabel="Day" rows={data.analytics.weekdayRows} />
      </View>
    </Page>
  );
}

export function AnalyticsHoldPage({ data }: { data: AccountReportPayload }) {
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.h1}>By hold time</Text>
      <Text style={styles.muted} wrap>
        Time from entry to exit, same nine hold bands as the Analytics page (from sub-minute through multi-hour).
      </Text>
      <View style={{ marginTop: 6 }}>
        <ScoreMetricsTable
          title="By hold time"
          firstColumnLabel="Hold"
          rows={data.analytics.holdRows}
        />
      </View>
    </Page>
  );
}

export function AnalyticsHourlyPage({ data }: { data: AccountReportPayload }) {
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.h1}>By hour of day</Text>
      <Text style={styles.muted} wrap>
        HKT hour of entry, 06:00 through 05:00 (Globex trading-day order), including hours with no trades, matching the in-app table.
      </Text>
      <View style={{ marginTop: 6 }}>
        <ScoreMetricsTable
          title="By hour of day (HKT, entry time)"
          firstColumnLabel="Hour"
          rows={data.analytics.hourlyRows}
        />
      </View>
    </Page>
  );
}
