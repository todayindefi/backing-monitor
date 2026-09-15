---
title: BOLD dashboard — six-axis plan and custom blocks
repo: backing-monitor
status: PLAN rev 2. Written 2026-09-15, corrected the same day against riskAnalyst's field
  spec. ⚠️ rev 1 asserted two data gaps that do not exist — see §0.5. Nothing built.
---

# 0. ⚠️ Who this question is for — both of us, split by axis

**The user asked whether this is mine or riskAnalyst's. It is both, and the six-axis standard
already says where the line is** (`specs/six-axis-dashboard-spec.md` §1):

```
1 Peg / Stability     PegTracker        ← analyzer exists, block missing
2 Backing             PegTracker        ← analyzer exists, block missing
3 Liquidity & Exit    DexTracker        ← ⚠️ ZERO BOLD coverage; live routing question
4 Dependencies        riskAnalyst       ← theirs by ownership
5 Contract & Admin    security_analyst  ← theirs by ownership
6 Issuer              riskAnalyst       ← theirs by ownership, editorial
```

**Mine:** the frame, what renders, how it is keyed, how custom blocks are organised, and refusing
to render anything that cannot be checked.

**riskAnalyst's:** axes 4 and 6 by ownership — and ⚠️ **they also know BOLD better than this repo
does.** They hold a hand-run exit ladder in `assets/bold.md` §III, they caught the hardcoded BOLD
liquidity constants in PegTracker, and their desk has exposure. **Ask them for the judgment calls
in §3 marked `[riskAnalyst]`; do not ask them how the page should be laid out.**

⚠️ **Axis 3 is the live problem and it is a ROUTING question, not a measurement one.** DexTracker
owns axis 3 and has zero BOLD files; PegTracker has the analyzer but not the depth. This is the
same gap as `DISPATCH-dextracker-axis3-migration-2026-09-14` and should be resolved there, not by
quietly having PegTracker do it.

---

# 0.5 ⚠️ REV 1 WAS WRONG ABOUT THE DATA, AND SO WAS THE FIELD SPEC — IN OPPOSITE DIRECTIONS

**Both documents claimed a gap. Neither gap exists. Both were LOOKUP failures, not data failures.**

```
rev 1 claimed   "DexTracker has ZERO BOLD coverage"
actually        ~/DexTracker/data/liquidity/bold_liquidity.json — schema liquidity/1,
                bracketed depth, 7 rungs, venues, exclusions, as_of 2026-09-15T00:43Z
why missed      I listed data/*bold* and not data/liquidity/*bold*
                ⚠️ MY OWN MEMORY RECORDS THAT EXACT SUBDIR AS A TRAP and I walked into it

field spec      "the redemption fee ladder is NOT YET PRODUCED — three eth_calls,
   claimed       asked of PegTracker, never built"
actually        it IS built — by DEXTRACKER, inside primary_exit.fee_ladder:
                $100k 1.04% · $1M 3.65% · $2M 6.55% · $10M 29.76%
why missed      it was asked of PegTracker, so PegTracker was where it was looked for
```

⚠️⚠️ **THE RULE THIS YIELDS: in a multi-producer estate, "not produced" almost always means "not
produced by the producer I asked."** Before declaring a data gap, check **all three** producers and
their subdirectories. **Two experienced sessions made the same class of error on the same asset
within an hour of each other, in opposite directions.**

✅ **Consequence: there is NO data gap for BOLD. Axes 1–5 are fully sourced today.** This is a
registration and render job, exactly as the field spec concluded — it was just righter than its own
evidence.

⚠️ **And it inverts the axis-3 story in rev 1.** BOLD is not an asset DexTracker has failed to
cover; **it is one of the few where DexTracker produced FIRST.** BOLD would be DexTracker-native
from day one rather than inheriting PegTracker's transitional block — which makes it the **cleanest
possible test case for the axis-3 migration**, not a casualty of it.

---

# 1. What BOLD is, in one paragraph

**Liquity V2.** A multi-branch CDP stablecoin: BOLD is minted against ETH, wstETH and rETH in
**three independent branches**, each with its own TroveManager, Stability Pool and risk parameters.
Redemptions are protocol-native and always available, which puts a **hard arbitrage floor** under
the peg. `sBOLD` is an ERC-4626 yield wrapper holding ~13% of supply.

⚠️ **The two things that make BOLD unlike anything currently on the dashboard:** branches fail
**independently** (one can shut down while the others run), and **loss absorption is pre-funded**
by Stability Pools rather than by a buffer or a queue.

---

# 2. ⚠️ THE BLOCKER — no `peg` block means no dashboard at all

`bold_backing.json` today:

```
PRESENT   summary · backing_breakdown · risk_flags · asset_specific{contracts, branches,
          sbold, alert_thresholds} · bold_backing_history.json · bold_peg_history.json
ABSENT    peg · backing · liquidity · dependencies · issuer · contract   ← all six axis blocks
```

⚠️⚠️ **`CommonRenderer.hasAxisBlocks()` returns `!!(data && data.peg)`. With no `peg` block the
entire six-axis frame is hidden and BOLD renders as a legacy asset** — the exact state STRCx was in.
**Emitting `peg` is therefore the first and cheapest unblock, and `bold_peg_history.json` already
holds the series** (57 points; latest `peg_market_price` 0.99731, `-0.269%`).

---

# 3. Axis by axis

## Axis 1 — Peg / Stability · PegTracker

```
have    bold_peg_history.json: peg_market_price, peg_theoretical_price, peg_premium_discount_pct
need    a `peg` block: {market_price, nav/theoretical, premium_discount_pct, source, history_ref}
```

⚠️ **CUSTOM, and it is the most BOLD-specific thing on the page: `redemption_floor` (0.99083).**
Protocol redemption is always open, so **the floor is a mechanical arb bound, not a soft target.**
`base_rate_pct` (0.417) and `redemption_rate_pct` (0.917) drive where it sits and move with
redemption volume.

**Render:** the peg chart with the redemption floor as a **drawn line**, the way the CR chart draws
its bands — a reader should see how much room is left before arb binds, not be told a number.
✅ Both floor and rate are already published, so this keys on fields, not knowledge.

## Axis 2 — Backing · PegTracker

```
have    summary.collateral_ratio 279.94% · backing_breakdown (WETH/wstETH/rETH with source strings)
        reconciliation_gap_bold / _pct (0.0029%)
need    a `backing` block: {collateral_ratio, collateral_ratio_scale:"percent", total_backing,
        breakdown[], basis}
```

⚠️ **CUSTOM — the branch table is the centre of this dashboard.** An aggregate 279.94% hides that
the three branches run at **233% / 280% / 407%** against **different** MCR/CCR/SCR floors.

```
branch   debt        CR        MCR   CCR   SCR   troves  SP coverage   shutdown
WETH     $11.3M    233.4%      110   150   110     115      68.0%         0
wstETH   $19.0M    279.7%      120   160   120      85      31.8%  ⚠       0
rETH      $4.2M    407.1%      120   160   120      19     111.8%         0
```

⚠️ **`shutdown_time` per branch is the field that matters most and will read as noise while it is
0.** Non-zero means that branch is in shutdown — **an independent failure the aggregate CR cannot
show.** `alert_thresholds.shutdown_time_nonzero: "critical"` already says how to treat it.

**`reconciliation_gap_pct`** (debt vs supply) is a **data-integrity** reading, not a solvency one —
render it as such, with `alert_thresholds.abs_reconciliation_gap_pct_gt: 0.1` as the band.

## Axis 3 — Liquidity & Exit · DexTracker ✅ ALREADY PRODUCED

```
have  DexTracker data/liquidity/bold_liquidity.json (schema liquidity/1, as_of 2026-09-15T00:43Z)
      depth.status "bracketed" · depth_usd $1,000,000 (is_floor false) · 7 rungs
      execution_envelope: turnover_observed, tested through $20M, output NOT monotonic
      quote_stability (4 samples) · venues · enumeration · excluded_liquidity
      primary_exit: Liquity V2 redemption via CollateralRegistry, size_dependent, WITH fee_ladder
```

⚠️ **BOLD has TWO exits and conflating them is the defect to avoid** — the same split syrupUSDC
needed:

```
PROTOCOL   permissionless redemption. Always open, size-UNBOUNDED, but COST-bound and the
           cost is steeply size-dependent.
SECONDARY  Curve/Uniswap. SIZE-bound. 2% crossing bracketed $1M–$10M, lower bound published.
```

⚠️⚠️ **THE MOST IMPORTANT SINGLE THING ON THIS DASHBOARD — and rev 1 got it backwards.**
`redemption_floor` (0.9908) is the **SPOT** rate: it describes a trade of **size zero**. The real
cost at size, from `primary_exit.fee_ladder`:

```
$100k   1.04%        $1M   3.65%        $2M   6.55%        $10M   29.76%
```

**rev 1 proposed drawing `redemption_floor` on the peg chart as a bound.** ⚠️ **That render would be
actively misleading** — a reader would take 0.9908 as their floor at size and be wrong by orders of
magnitude. riskAnalyst caught this and they are right. ✅ **The floor may only be rendered WITH the
ladder beside it, labelled SPOT.** A drawn line without the ladder is the single worst thing this
page could do.

✅ **`excluded_liquidity` already handles the double-count** riskAnalyst warned about — Convex,
StakeDAO, Yearn and Beefy named as LP wrappers over the same Curve pool, with the reason string.
**Render the exclusions, do not re-derive them.**

⚠️ **CUSTOM — Stability Pool coverage belongs on THIS axis, not axis 2.** It is pre-funded loss
absorption: BOLD burned against liquidated collateral before anyone else is touched. **wstETH at
31.75% is already flagged** by the producer against its own `stability_pool_coverage_pct_lt: 35`.
A branch whose pool cannot absorb its own liquidations falls back to redistribution across other
troves — **the contagion path, and it is per-branch.**

⚠️ `execution_envelope.output_monotonic_within_tested_range: false` — **turnover observed.** That is
a declared limit on the measurement and must survive to the page.

## Axis 4 — Dependencies · riskAnalyst

```
upstream    Chainlink ETH/USD · wstETH and rETH exchange rates (collateral_rate_eth per branch)
downstream  sBOLD — ERC-4626 wrapper, $4.18M supply, 13% of BOLD, assets_per_share 1.08499
```

**`[riskAnalyst]`** — the oracle set, what a stale or wrong LST rate does per branch, and whether
sBOLD is the only material downstream.

⚠️ **`sbold.paused` and `sbold.owner` are already published and
`alert_thresholds.sbold_paused_or_owner_changed: "critical"`.** That is an **admin** fact about a
**dependency** — render it on axis 4 and cross-reference axis 5 rather than duplicating.

## Axis 5 — Contract & Admin · security_analyst

```
have    asset_specific.contracts + per-branch TroveManager / StabilityPool / ActivePool /
        BorrowerOperations addresses — a complete walk target, already enumerated
need    a security_analyst walk
```

⚠️ **The interesting question for BOLD is the absence of admin, not its presence** — Liquity V2 is
governance-minimal by design. **A walk finding "no upgrade path, no admin key" is a strong positive
and must be rendered as a MEASURED absence, not left blank**, or the axis reads as unexamined.
✅ `sbold.owner` is the one live admin handle and is already published.

## Axis 6 — Issuer · riskAnalyst

**`[riskAnalyst]`** — editorial. Liquity AG / the V2 deployment, immutability claims, the
governance story. ⚠️ Per the six-axis standard axis 6 is **editorial and scored by them**; this repo
renders the score and the report link and does not author it.

---

# 4. Custom blocks — the layout

Custom does not mean bespoke-and-unkeyed. **Each block hangs under an axis and keys on a published
field**, per `specs/renderer-design-rules.md`:

```
axis 1   Redemption mechanics     base_rate · redemption_rate · redemption_floor drawn on the chart
axis 2   BRANCH TABLE             per-branch CR vs its OWN MCR/CCR/SCR, troves, shutdown_time
axis 2   Reconciliation           debt-vs-supply gap as data integrity, banded on alert_thresholds
axis 3   Two-exit split           protocol redemption (cost-bound) vs secondary (size-bound)
axis 3   Stability Pool coverage  per branch, banded on stability_pool_coverage_pct_lt
axis 4   sBOLD                    wrapper supply, share price, paused/owner
```

⚠️⚠️ **THE SINGLE BEST THING IN THIS FEED: `asset_specific.alert_thresholds` is already
published.**

```json
{"shutdown_time_nonzero":"critical","abs_reconciliation_gap_pct_gt":0.1,
 "branch_cr_less_than_ccr_plus_pp":15,"stability_pool_coverage_pct_lt":35,
 "base_rate_pct_gt":1.5,"sbold_paused_or_owner_changed":"critical","supply_lt":25000000}
```

✅ **Every band on this dashboard should read from that object and none should be hardcoded.**
Today's defects were closed name lists and hardcoded guards; **BOLD arrives with its thresholds
declared, so the renderer can be keyed from day one** rather than retrofitted. **If a threshold
changes upstream, the page moves with it.**

---

# 5. Order of work — revised

**No data collection. Registration, one decision, then render.**

```
0  ⚠️ TELL riskAnalyst BEFORE registering. Their checker reads our assets.json, so adding
   `bold` expands their audit scope. Courtesy, and it is their coverage commitment.

1  Register `bold` in data/assets.json.
   ⚠️ AND add cp lines to sync_and_push.sh — it is an explicit allowlist. A new asset's
   JSONs silently never reach the dashboard until they are added. Symptom: "data in
   PegTracker, nothing on the dashboard." Blocked Ethena until 4975b236.
   ⚠️ THREE producers, THREE paths — bold_backing.json + bold_peg_history.json +
   bold_backing_history.json (PegTracker), bold_liquidity.json (DexTracker,
   data/liquidity/ SUBDIR — the one rev 1 missed), topology (security_analyst).

2  ⚠️ DECIDE BESPOKE vs GENERIC BEFORE ANYTHING ELSE. This gates step 4 and the overlay.
   riskAnalyst reports 8 of 22 existing overlays orphaned by bespoke renderers that skip
   the generic path. I have NOT verified the count — 12 of 22 assets with overlays have a
   bespoke renderer, and whether each skips the overlay path is per-renderer. ⚠️ The count
   does not change the advice: settle the path first, then author.
   MY RECOMMENDATION: start GENERIC. BOLD's axis blocks are standard once emitted, and the
   custom content is tables that hang under axes. Bespoke is where this week's defects
   clustered.

3  PegTracker emits the axis blocks. ⚠️ ONLY `peg` is strictly blocking —
   hasAxisBlocks() gates the whole frame on data.peg. Everything else can follow.

4  Render axes 1/2/3 from data that already exists. Branch table is the headline.

5  security_analyst axis 5 walk; riskAnalyst axes 4 + 6.

6  bold_contract_overlay.json LAST — after step 2 is settled, per riskAnalyst's caution.
```

---

# 6. What I would NOT build

⚠️ **No aggregate-only backing panel.** A single 279.94% across three branches with different
floors and one pool already under-covered is the number most likely to be quoted and least likely
to be true of any individual position.

⚠️ **No liquidity figure sourced from DefiLlama totals** until the wrapper/Stability-Pool
double-count riskAnalyst identified is excluded at the source.

⚠️ **No redemption-cost estimate derived here.** The floor and the rate are published; the cost of
a given redemption size depends on trove ordering, which this repo cannot see. **Render the bound,
not a simulation.**
