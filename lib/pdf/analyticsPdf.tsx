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
