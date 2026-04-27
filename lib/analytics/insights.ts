import type { TradeModel as Trade } from "@/app/generated/prisma/models";

// ── Parsed conditions from scoreNotes ────────────────────────────────────────
// scoreNotes is a JSON array of 7 strings (see `scoreTrades` in scorer.ts), in order:
//   [0] session timing  [1] position sizing  [2] imbalance  [3] breakout
//   [4] exit relative   [5] hold time       [6] streak context

export type SessionCategory = "prime" | "regular" | "afternoon" | "deep-overnight";
export type SizingCategory = "conservative" | "moderate" | "oversized" | "unknown";
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

  // [0] session timing — 4 buckets, all distinguishable by unique markers
  let session: SessionCategory = "regular";
  if (notes[0].includes("after 1:30am") || notes[0].includes("low activity")) {
    session = "deep-overnight";
  } else if (notes[0].includes("New York Afternoon") || notes[0].includes("11:30pm")) {
    session = "afternoon";
  } else if (notes[0].includes("prime") || notes[0].includes("session open")) {
    session = "prime";
  }

  // [1] position sizing
  let sizing: SizingCategory = "moderate";
  if (notes[1].includes("capital unknown")) sizing = "unknown";
  else if (notes[1].includes("conservative")) sizing = "conservative";
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

export type ConditionCategory =
  | "session"
  | "sizing"
  | "imbalance"
  | "breakout"
  | "streak";

export interface ConditionGroup {
  key: string;
  label: string;
  category: ConditionCategory;
  component: "entry" | "exit" | "risk";
  /** Representative score points awarded when this condition is present (max of the bucket if a range). */
  points: number;
  /** Display label for points awarded by the score guide, e.g. "15 pts" or "25–30 pts". */
  pointsLabel: string;
  tradeCount: number;
  avgScore: number;
  avgPnl: number;
  winRate: number;
  pnlUplift: number; // avg P&L with this condition − avg P&L without
}

interface ConditionDef {
  key: string;
  label: string;
  category: ConditionCategory;
  component: "entry" | "exit" | "risk";
  points: number;
  pointsLabel: string;
  matches: (c: ParsedConditions) => boolean;
}

const CONDITION_DEFS: ConditionDef[] = [
  // ── Session timing (max 15 pts) ────────────────────────────────────────────
  { key: "session:prime", category: "session", component: "entry", points: 15, pointsLabel: "15 pts",
    label: "Prime — London/NY first hour",
    matches: (c) => c.session === "prime" },
  { key: "session:regular", category: "session", component: "entry", points: 10, pointsLabel: "10 pts",
    label: "Regular session hours",
    matches: (c) => c.session === "regular" },
  { key: "session:afternoon", category: "session", component: "entry", points: 5, pointsLabel: "5 pts",
    label: "NY Afternoon — 11:30pm–1:30am HKT",
    matches: (c) => c.session === "afternoon" },
  { key: "session:deep-overnight", category: "session", component: "entry", points: 0, pointsLabel: "0 pts",
    label: "Deep overnight — after 1:30am HKT",
    matches: (c) => c.session === "deep-overnight" },

  // ── Position sizing (max 10 pts) ───────────────────────────────────────────
  { key: "sizing:conservative", category: "sizing", component: "entry", points: 10, pointsLabel: "10 pts",
    label: "Conservative — 1% move ≤ 5% of capital",
    matches: (c) => c.sizing === "conservative" },
  { key: "sizing:moderate", category: "sizing", component: "entry", points: 7, pointsLabel: "4–7 pts",
    label: "Moderate — 1% move = 5–15% of capital",
    matches: (c) => c.sizing === "moderate" },
  { key: "sizing:oversized", category: "sizing", component: "entry", points: 0, pointsLabel: "0 pts",
    label: "Oversized — 1% move > 15% of capital",
    matches: (c) => c.sizing === "oversized" },

  // ── Imbalance / FVG (max 40 pts) ───────────────────────────────────────────
  { key: "imb:tier1", category: "imbalance", component: "entry", points: 40, pointsLabel: "40 pts",
    label: "Entry inside FVG (formed within 5 candles)",
    matches: (c) => c.imbalance === "tier1" },
  { key: "imb:tier2", category: "imbalance", component: "entry", points: 35, pointsLabel: "35 pts",
    label: "Entry inside FVG (formed within 15 candles)",
    matches: (c) => c.imbalance === "tier2" },
  { key: "imb:tier3-4", category: "imbalance", component: "entry", points: 30, pointsLabel: "25–30 pts",
    label: "Previous candle touched FVG zone",
    matches: (c) => c.imbalance === "tier3-4" },
  { key: "imb:tier5-6", category: "imbalance", component: "entry", points: 20, pointsLabel: "15–20 pts",
    label: "Entry inside a candle that rebalanced FVG",
    matches: (c) => c.imbalance === "tier5-6" },
  { key: "imb:tier7-8", category: "imbalance", component: "entry", points: 10, pointsLabel: "5–10 pts",
    label: "Late entry — earlier candle touched FVG",
    matches: (c) => c.imbalance === "tier7-8" },
  { key: "imb:none", category: "imbalance", component: "entry", points: 0, pointsLabel: "0 pts",
    label: "No imbalance nearby",
    matches: (c) => c.imbalance === "none" },

  // ── Breakout handling (max 5 pts) ──────────────────────────────────────────
  { key: "breakout:yes", category: "breakout", component: "entry", points: 5, pointsLabel: "5 pts",
    label: "Breakout through a pivot level",
    matches: (c) => c.breakout === "yes" },
  { key: "breakout:no", category: "breakout", component: "entry", points: 0, pointsLabel: "0 pts",
    label: "No pivot breakout on entry",
    matches: (c) => c.breakout === "no" },

  // ── Streak context (max 5 pts) ─────────────────────────────────────────────
  { key: "streak:discipline", category: "streak", component: "risk", points: 5, pointsLabel: "5 pts",
    label: "Discipline — win after 3+ losses",
    matches: (c) => c.streak === "discipline" },
  { key: "streak:normal", category: "streak", component: "risk", points: 3, pointsLabel: "3 pts",
    label: "Normal streak context",
    matches: (c) => c.streak === "normal" },
  { key: "streak:revenge", category: "streak", component: "risk", points: 0, pointsLabel: "0 pts",
    label: "Revenge signal — large loss after 3+ wins",
    matches: (c) => c.streak === "revenge" },
];

/** Public metadata about each condition category (max points, score-guide alignment). */
export const CONDITION_CATEGORIES: Record<
  ConditionCategory,
  { title: string; component: "entry" | "exit" | "risk"; maxPoints: number; description: string }
> = {
  session: {
    title: "Session timing",
    component: "entry",
    maxPoints: 15,
    description: "When the trade was entered (CME futures hours, HKT).",
  },
  sizing: {
    title: "Position sizing",
    component: "entry",
    maxPoints: 10,
    description: "Dollar exposure on a 1% adverse move, as % of capital.",
  },
  imbalance: {
    title: "Imbalance handling (FVG)",
    component: "entry",
    maxPoints: 40,
    description: "How close the entry price is to a Fair Value Gap.",
  },
  breakout: {
    title: "Breakout handling",
    component: "entry",
    maxPoints: 5,
    description: "Whether the entry candle ran through a pivot level.",
  },
  streak: {
    title: "Streak context",
    component: "risk",
    maxPoints: 5,
    description: "Recent win/loss sequence around this trade.",
  },
};

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
        key: def.key,
        label: def.label,
        category: def.category,
        component: def.component,
        points: def.points,
        pointsLabel: def.pointsLabel,
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
      key: def.key,
      label: def.label,
      category: def.category,
      component: def.component,
      points: def.points,
      pointsLabel: def.pointsLabel,
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
  category: ConditionCategory;
  component: "entry" | "exit" | "risk";
  points: number;
  pointsLabel: string;
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
      category: def.category,
      component: def.component,
      points: def.points,
      pointsLabel: def.pointsLabel,
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
