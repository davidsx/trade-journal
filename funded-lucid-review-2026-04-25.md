# Trading Performance Analysis & Forward Plan

## Context
Analysis of 195 MNQM6 trades on the "Funded Lucid" account ($50k starting capital, now breached). The account ended at ~$54,579 peak but breached drawdown rules. The goal is to identify what worked, what didn't, and build a concrete plan for the next funded account.

---

## 1. What the Data Shows

### The Good
- **Net profitable**: +$1,015 across 195 trades — the strategy has a positive edge
- **NY session is the money-maker**: 83 trades, 51% win rate, PF 1.39, +$1,917 total, avg +$23/trade
- **Hold time sweet spots**: 5–15 min (+$95 avg, +$3,622 total) and 1–2 hr (+$325 avg, +$2,275 total) are the two most profitable hold bands
- **Thursday is the best day**: 49 trades, 43% WR but +$34 avg, +$1,688 total — patient, higher-quality setups
- **18:00 HKT entry hour is the peak**: 7 trades, 57% WR, +$183 avg, +$1,282 total — early London/NY overlap
- **Late-night shorts work**: 00:00–01:00 HKT shorts are highly profitable (+$57–$364 avg)
- **Sharpe 1.62** is solid for a scalping strategy

### The Bad
- **42.6% win rate with only 1.09 PF** — the edge is razor-thin and fragile
- **London session is a grind**: 100 trades (51% of all trades), 36% WR, PF 0.91, -$505 total — net negative
- **Asia session**: 12 trades, 42% WR, PF 0.28, -$397 total — losing money
- **Friday is a disaster**: 86 trades (44% of all), 38% WR, -$25 avg, -$2,176 total — this single day wiped out most profits
- **20:00 HKT is the worst hour**: 38 trades, 26% WR (in 30m bucket), -$78 avg, -$1,599 total
- **Sub-1-min scalps bleed money**: 50 trades, -$83 avg, -$4,171 total — the largest single source of losses
- **Max loss streak of 12**, longest underwater 71 trades — severe tilt periods
- **Edge decay**: 16 of 176 rolling windows flagged — inconsistent execution
- **Account breached** despite being net profitable — drawdown management failed

### The Ugly — April 24 Meltdown
The final trading day (Apr 24) is where the account breached. Looking at the trade log:
- From 20:00–22:03 HKT on Apr 24, there are **~50 trades in 2 hours** with rapidly increasing size (8, 9, 10 contracts)
- This period shows classic revenge trading: rapid-fire entries, growing position sizes, mostly losses
- The quality scores stay 50–70 (the scorer doesn't penalize enough for this behavior), but the P&L is catastrophic
- This single session likely caused the breach

---

## 2. Root Cause Analysis

### Problem 1: Overtrading in London session
100 of 195 trades are in London (16:00–21:30 HKT). Win rate is only 36% and PF < 1. The trader is forcing setups during a session where their edge doesn't exist.

### Problem 2: Friday overtrading
86 trades on Fridays — nearly half of all trades in one day. Friday has the worst win rate (38%) and worst avg P&L (-$25). End-of-week positioning and reduced liquidity work against the strategy.

### Problem 3: Sub-1-minute scalps are negative EV
50 trades held < 1 minute with -$83 avg. These are impulsive entries without conviction. The scorer gives them high quality (60.4 avg) because the entry criteria may be met, but the instant exit means the trade thesis was never tested.

### Problem 4: Tilt / revenge trading
The Apr 24 20:00–22:00 cluster and the 12-trade loss streak pattern suggest the trader doubles down after losses instead of stepping away. Position sizes escalate (up to 10 contracts at $50k capital = significant leverage).

### Problem 5: Position sizing escalation
Multiple trades at 8–10 contracts on a $50k account. At MNQM6 prices (~27,000), 10 MNQ contracts = $1,350,000 notional. A 1% move = $13,500 = 27% of capital. This is extreme.

---

## 3. Forward Trading Plan

### Rule 1: Session Filter — NY Only (with exceptions)
- **Primary session**: NY (21:30–05:00 HKT). This is where the edge lives (51% WR, PF 1.39)
- **Exception**: London entries only at 18:00–19:30 HKT (the overlap zone where data shows positive expectancy)
- **No Asia session trading** until the account is profitable for 2 consecutive weeks

### Rule 2: Friday Trade Cap
- Maximum **10 trades** on Fridays
- Stop trading Fridays entirely if down $200+ for the day
- Consider skipping Fridays for the first funded account restart

### Rule 3: Hold Time Discipline
- **Minimum hold**: 2 minutes. No sub-1-minute exits unless stop-loss is hit
- **Target hold**: 5–15 minutes (the best expectancy band at +$95 avg)
- If a thesis requires > 30 min hold, size down to 2–3 contracts max

### Rule 4: Position Sizing Hard Caps
- **Max 5 contracts** per entry on a $50k account (this was the most common and most profitable size)
- **Never exceed 5** regardless of conviction. The 8–10 contract trades on Apr 24 were the account killers
- Only increase to 5 after the first trade of the day is profitable

### Rule 5: Daily Loss Limit & Tilt Protocol
- **Daily loss limit**: -$500 (1% of capital). Stop trading for the day when hit
- **3 consecutive losses**: Take a 15-minute break, no screens
- **5 consecutive losses**: Done for the day, no exceptions
- **Rolling 20-trade check**: If rolling win rate drops below 30%, take a full session off

### Rule 6: Trade Count Cap
- **Max 15 trades per day**. The data shows quality degrades rapidly with volume
- Best days had 5–15 well-chosen trades. Worst days had 30–50 trades

### Rule 7: Time-of-Day Focus
Based on the 30-minute bucket data, concentrate entries in these windows:
- **18:00–19:30 HKT** (London/NY overlap): Best avg P&L zone
- **22:00–23:30 HKT** (NY mid-session): Positive expectancy, decent volume
- **00:00–01:00 HKT** (NY late): High win rate on shorts, low trade count — selective only

**Avoid**:
- 20:00–20:30 HKT (NY open volatility trap): 23 trades at 26% WR, -$78 avg
- 21:00–21:30 HKT: 13–35% WR, consistently negative

### Rule 8: Direction Bias by Session
- **London overlap (18:00–19:30)**: Longs preferred (the big winners like +$1,585 came from longs here)
- **NY late (00:00–01:00)**: Shorts preferred (100% WR on shorts in this window)
- **NY open (21:30–22:00)**: Wait 15 min after 21:30 before first trade — the initial chop is a grinder

---

## 4. Verification Plan
- After implementing these rules, track compliance for 2 weeks on a sim/eval account
- Key metrics to watch: trades/day (target < 15), max position size (target ≤ 5), Friday trade count, session distribution
- Compare rolling 20-trade win rate stability to this dataset's 16/176 flagged windows — target < 5 flags
