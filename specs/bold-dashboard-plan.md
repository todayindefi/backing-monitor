---
title: BOLD dashboard — six-axis plan and custom blocks
repo: backing-monitor
status: PLAN. Written 2026-09-15. Nothing built. Axis ownership is split — see §0.
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

## Axis 3 — Liquidity & Exit · ⚠️ DexTracker (no coverage) — ROUTING QUESTION

```
have    NOTHING. No liquidity block, no depth, no ladder.
```

⚠️⚠️ **BOLD has TWO exits and conflating them would be the defect here** — the same split that
syrupUSDC needed:

```
PROTOCOL exit    redemption against troves at the redemption rate. Always open, size-unbounded,
                 price-bounded by redemption_floor. Constraint is COST, not size.
SECONDARY exit   Curve/Uniswap. Constraint is SIZE. riskAnalyst's §III hand-run ladder measured
                 $100k at -0.048% (a gain) through $6M at +0.94%, with a cliff by $7M.
```

**`[riskAnalyst]`** ⚠️ **Their §III warning must survive into whatever gets built:** Convex,
StakeDAO, Yearn and Beefy "BOLD-USDC" entries are **LP-token wrappers over the same Curve pool**,
and the three liquity-v2 "BOLD" DefiLlama entries are **Stability Pools, not tradeable depth**.
**Double-counting those overstates BOLD liquidity ~3×.**

⚠️ **CUSTOM — Stability Pool coverage belongs on this axis, not axis 2.** It is pre-funded loss
absorption: the BOLD that will be burned against liquidated collateral before anyone else is
touched. **wstETH at 31.75% is already flagged** by the producer against its own
`stability_pool_coverage_pct_lt: 35`. **A branch whose pool cannot absorb its own liquidations
falls back to redistribution across other troves — that is the contagion path and it is
per-branch.**

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

# 5. Order of work

```
1  PegTracker emits `peg` (+ backing, liquidity, dependencies, issuer stubs)   UNBLOCKS EVERYTHING
2  register bold in assets.json + add cp lines to sync_and_push.sh             ⚠️ see below
3  render axes 1/2 from what already exists — branch table is the headline
4  axis 3 routing decision (DexTracker coverage vs PegTracker interim)
5  riskAnalyst axes 4 + 6 · security_analyst axis 5
```

⚠️ **Step 2 has a known trap:** `sync_and_push.sh` is an explicit `cp` allowlist. A new asset's
JSONs **silently never reach the dashboard** until its lines are added — symptom is "data in
PegTracker, nothing on the dashboard". It blocked Ethena until `4975b236`.

⚠️ **And registering the slug changes riskAnalyst's audit scope** — their checker reads our
`assets.json`, so adding `bold` puts it in their coverage. **Tell them before, not after.**

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
