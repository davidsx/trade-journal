import type { TradeModel as Trade } from "@/app/generated/prisma/models";

// ── Parsed conditions from scoreNotes ────────────────────────────────────────
// scoreNotes is a JSON array of 7 strings (see `scoreTrades` in scorer.ts), in order:
//   [0] session timing  [1] position sizing  [2] imbalance  [3] breakout
//   [4] exit relative   [5] hold time       [6] streak context

export type SessionCategory = "prime" | "regular" | "low-activity";
export type SizingCategory = "conservative" | "moderate" | "oversized";
export type ImbalanceCategory =
  | "tier1"   // entry inside FVG, within 5 candles
  | "tier2"   // entry inside FVG, within 15 candles
  | "tier3-4" // prev candle touched FVG
  | "tier5-6" // entry inside candle that rebalanced FVG
  | "tier7-8" // late — candles 2-5 back touched FVG
  | "none";
export type BreakoutCategory = "yes" | "no";
export type StreakCategory = "discipline" | "normal" | "revenge";

export interface ParsedConditions {
  session: SessionCategory;
  sizing: SizingCategory;
  imbalance: ImbalanceCategory;
  breakout: BreakoutCategory;
  streak: StreakCategory;
}

export function parseScoreNotes(notesJson: string | null): ParsedConditions | null {
  if (!notesJson) return null;
  let notes: string[];
  try {
    notes = JSON.parse(notesJson) as string[];
  } catch {
    return null;
  }
  if (!Array.isArray(notes) || notes.length < 7) return null;

  // [0] session timing
  let session: SessionCategory = "regular";
  if (notes[0].includes("prime") || notes[0].includes("session open")) {
    session = "prime";
  } else if (notes[0].includes("low activity") || notes[0].includes("11:30pm")) {
    session = "low-activity";
  }

  // [1] position sizing
  let sizing: SizingCategory = "moderate";
  if (notes[1].includes("conservative")) sizing = "conservative";
  else if (notes[1].includes("oversized")) sizing = "oversized";

  // [2] imbalance — check most specific first
  let imbalance: ImbalanceCategory = "none";
  const imbNote = notes[2];
  if (imbNote.includes("Entry in imbalance zone") && imbNote.includes("within 5")) {
    imbalance = "tier1";
  } else if (imbNote.includes("Entry in imbalance zone") && imbNote.includes("within 15")) {
    imbalance = "tier2";
  } else if (imbNote.includes("Previous candle touched imbalance")) {
    imbalance = "tier3-4";
  } else if (imbNote.includes("rebalanced a recent imbalance")) {
    imbalance = "tier5-6";
  } else if (imbNote.includes("recent candle") && imbNote.includes("touched imbalance")) {
    imbalance = "tier7-8";
  }

  // [3] breakout
  const breakout: BreakoutCategory = notes[3].includes("Breakout through") ? "yes" : "no";

  // [6] streak context (last note in current 7-note format)
  const streakNote = notes[6] ?? "";
  let streak: StreakCategory = "normal";
  if (streakNote.includes("discipline")) streak = "discipline";
  else if (streakNote.includes("revenge") || streakNote.includes("possible revenge")) streak = "revenge";

  return { session, sizing, imbalance, breakout, streak };
}

// ── Condition group aggregation ───────────────────────────────────────────────

export interface ConditionGroup {
  label: string;
  component: "entry" | "exit" | "risk";
  key: string;
  tradeCount: number;
  avgScore: number;
  avgPnl: number;
  winRate: number;
  pnlUplift: number; // avg P&L with this condition − avg P&L without
}

interface ConditionDef {
  key: string;
  label: string;
  component: "entry" | "exit" | "risk";
  matches: (c: ParsedConditions) => boolean;
}

const CONDITION_DEFS: ConditionDef[] = [
  // Session timing
  { key: "session:prime",        label: "Session: Prime (London/NY open)",  component: "entry", matches: (c) => c.session === "prime" },
  { key: "session:regular",      label: "Session: Regular hours",           component: "entry", matches: (c) => c.session === "regular" },
  { key: "session:low-activity", label: "Session: Low-activity (late night)", component: "entry", matches: (c) => c.session === "low-activity" },
  // Position sizing
  { key: "sizing:conservative",  label: "Sizing: Conservative (≤5% exposure)",  component: "entry", matches: (c) => c.sizing === "conservative" },
  { key: "sizing:moderate",      label: "Sizing: Moderate (5–15% exposure)",     component: "entry", matches: (c) => c.sizing === "moderate" },
  { key: "sizing:oversized",     label: "Sizing: Oversized (>15% exposure)",     component: "entry", matches: (c) => c.sizing === "oversized" },
  // Imbalance
  { key: "imb:tier1",   label: "FVG: Entry inside (within 5 candles)",   component: "entry", matches: (c) => c.imbalance === "tier1" },
  { key: "imb:tier2",   label: "FVG: Entry inside (within 15 candles)",  component: "entry", matches: (c) => c.imbalance === "tier2" },
  { key: "imb:tier3-4", label: "FVG: Previous candle touched zone",      component: "entry", matches: (c) => c.imbalance === "tier3-4" },
  { key: "imb:tier5-6", label: "FVG: Entry inside rebalancing candle",   component: "entry", matches: (c) => c.imbalance === "tier5-6" },
  { key: "imb:tier7-8", label: "FVG: Late entry (2–5 bars after touch)", component: "entry", matches: (c) => c.imbalance === "tier7-8" },
  { key: "imb:none",    label: "FVG: No imbalance nearby",               component: "entry", matches: (c) => c.imbalance === "none" },
  // Breakout
  { key: "breakout:yes", label: "Breakout: Through pivot level",    component: "entry", matches: (c) => c.breakout === "yes" },
  { key: "breakout:no",  label: "Breakout: No pivot breakout",      component: "entry", matches: (c) => c.breakout === "no" },
  // Streak context
  { key: "streak:discipline", label: "Streak: Win after 3+ losses (discipline)", component: "risk", matches: (c) => c.streak === "discipline" },
  { key: "streak:normal",     label: "Streak: Normal context",                   component: "risk", matches: (c) => c.streak === "normal" },
  { key: "streak:revenge",    label: "Streak: Large loss after wins (revenge)",  component: "risk", matches: (c) => c.streak === "revenge" },
];

export function analyzeConditionGroups(trades: Trade[]): ConditionGroup[] {
  const scored = trades.filter((t) => t.qualityScore !== null && t.scoreNotes != null);
  if (scored.length === 0) return [];

  const allAvgPnl = scored.reduce((s, t) => s + t.netPnl, 0) / scored.length;

  return CONDITION_DEFS.map((def) => {
    const withCondition: Trade[] = [];
    const without: Trade[] = [];

    for (const t of scored) {
      const conds = parseScoreNotes(t.scoreNotes);
      if (!conds) continue;
      if (def.matches(conds)) withCondition.push(t);
      else without.push(t);
    }

    if (withCondition.length === 0) {
      return {
        label: def.label,
        component: def.component,
        key: def.key,
        tradeCount: 0,
        avgScore: 0,
        avgPnl: 0,
        winRate: 0,
        pnlUplift: 0,
      };
    }

    const avgScore =
      withCondition.reduce((s, t) => s + (t.qualityScore ?? 0), 0) / withCondition.length;
    const avgPnl =
      withCondition.reduce((s, t) => s + t.netPnl, 0) / withCondition.length;
    const winRate =
      withCondition.filter((t) => t.netPnl > 0).length / withCondition.length;
    const withoutAvgPnl =
      without.length > 0
        ? without.reduce((s, t) => s + t.netPnl, 0) / without.length
        : allAvgPnl;
    const pnlUplift = avgPnl - withoutAvgPnl;

    return {
      label: def.label,
      component: def.component,
      key: def.key,
      tradeCount: withCondition.length,
      avgScore,
      avgPnl,
      winRate,
      pnlUplift,
    };
  })
    .filter((g) => g.tradeCount > 0)
    .sort((a, b) => b.pnlUplift - a.pnlUplift);
}

// ── Setup blueprint ───────────────────────────────────────────────────────────

export interface BlueprintCondition {
  key: string;
  label: string;
  component: "entry" | "exit" | "risk";
  prevalenceInGood: number; // fraction of good trades with this condition
  prevalenceInAll: number;  // fraction of all trades with this condition
  uplift: number;           // prevalenceInGood − prevalenceInAll
}

export interface SetupBlueprint {
  minScore: number;
  goodTradeCount: number;
  totalTradeCount: number;
  avgScoreInGood: number;
  avgPnlInGood: number;
  conditions: BlueprintCondition[]; // sorted by uplift desc, prospective conditions only
  sampleTradeIds: string[];
}

export function buildSetupBlueprint(trades: Trade[], minScore = 70): SetupBlueprint {
  const scored = trades.filter((t) => t.qualityScore !== null && t.scoreNotes != null);
  const goodTrades = scored.filter((t) => (t.qualityScore ?? 0) >= minScore);

  const blueprint: SetupBlueprint = {
    minScore,
    goodTradeCount: goodTrades.length,
    totalTradeCount: scored.length,
    avgScoreInGood:
      goodTrades.length > 0
        ? goodTrades.reduce((s, t) => s + (t.qualityScore ?? 0), 0) / goodTrades.length
        : 0,
    avgPnlInGood:
      goodTrades.length > 0
        ? goodTrades.reduce((s, t) => s + t.netPnl, 0) / goodTrades.length
        : 0,
    conditions: [],
    sampleTradeIds: goodTrades
      .sort((a, b) => (b.qualityScore ?? 0) - (a.qualityScore ?? 0))
      .slice(0, 5)
      .map((t) => t.id),
  };

  if (goodTrades.length === 0 || scored.length === 0) return blueprint;

  // Only prospective conditions (entry + risk) make sense for a setup blueprint
  const prospectiveDefs = CONDITION_DEFS.filter((d) => d.component !== "exit");

  const conditions: BlueprintCondition[] = prospectiveDefs.map((def) => {
    const countInGood = goodTrades.filter((t) => {
      const c = parseScoreNotes(t.scoreNotes);
      return c ? def.matches(c) : false;
    }).length;
    const countInAll = scored.filter((t) => {
      const c = parseScoreNotes(t.scoreNotes);
      return c ? def.matches(c) : false;
    }).length;

    const prevalenceInGood = countInGood / goodTrades.length;
    const prevalenceInAll = countInAll / scored.length;

    return {
      key: def.key,
      label: def.label,
      component: def.component,
      prevalenceInGood,
      prevalenceInAll,
      uplift: prevalenceInGood - prevalenceInAll,
    };
  });

  // Keep conditions that are positively overrepresented in good trades
  blueprint.conditions = conditions
    .filter((c) => c.prevalenceInGood > 0 && c.uplift > 0)
    .sort((a, b) => b.uplift - a.uplift)
    .slice(0, 6);

  return blueprint;
}
