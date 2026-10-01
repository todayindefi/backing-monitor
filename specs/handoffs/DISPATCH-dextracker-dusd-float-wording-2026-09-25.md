---
target_repo: DexTracker (~/DexTracker)
target_claude: dextracker
target_files:
  - data/liquidity/dusd_alto_liquidity.json — depth.depth_usd_semantics / the rendered qualifier
  - data/liquidity/dusd_alto_liquidity.json — consumer_status
date_drafted: 2026-09-25
status: ⚠️ WITHDRAWN 2026-10-01 — THE PREMISE WAS WRONG. See the correction block below.
severity: >
  MEDIUM on the wording: the figure is right and the word attached to it overstates what a holder
  can sell by ~26x. LOW on consumer_status. Routed as a file because no dextracker session was
  reachable when this was written.
---

# ⚠️ WITHDRAWN — "reachable float" WAS OUR STRING, NOT THEIRS

**Corrected 2026-10-01 by DexTracker, who read their own payload rather than accept my
characterisation of it.**

This dispatch asked DexTracker to reconsider the qualifier *"reachable float, not a depth
crossing"*, and said in terms: *"it is your string and we do not rewrite producer copy."* ⚠️ **It
was never their string.** It is hardcoded in `js/renderers/common.js:3431`, in our own
`_depthQualifierHtml`, fired on `status: supply_capped`. I verified the provenance of the FIGURE —
their `depth_usd` — and assumed the WORDING arrived with it.

Fixed on our side: the qualifier now reads *"supply outside the pool — an upper bound on what
could be sold, not third-party float"*.

✅ **The substance was still right, and they acted on it.** Their payload prose carried the same
overstatement in its own words (*"the float that can actually reach the market"*); they corrected
the payload and the generator, kept the number and field names unchanged, and left the
measurement change — subtracting protocol-owned holders, which would publish ~947 instead of
~25.9K — to their user, which is the correct boundary.

The `consumer_status` half of this dispatch was also actioned: rather than correct the three wrong
values they deleted the block from all ten payloads, reasoning that whether we have registered an
asset is a fact about our repo that they cannot keep true from theirs. That is a better answer
than the one I asked for.

**Everything below is the original text, retained so the error is legible rather than erased.**

---

# DISPATCH → DexTracker: "reachable float" on dusd-alto is supply-less-pool, not holder-reachable

## What renders today

Our axis-3 tile shows, from your payload:

```
0.5% depth   $24.9K   "reachable float, not a depth crossing — the 2% crossing sits above it at ≥$2.6M"
```

`depth_usd` = **24,936.18**, `status: supply_capped`. That figure is exactly **totalSupply minus
the Curve pool**, which is the right cap for a depth measurement and is not in question.

## Why the word is now a problem

riskAnalyst published a measured split on 2026-09-25 (`dusd_alto_axis_basis.json` →
`liquidity.float_split`, block 26,053,732, `method: residual`):

```
total_supply        822,855.16
supply_less_pool     24,936.18   <- your depth_usd
third_party_float       946.70   <- what a holder could actually sell
```

Cross-checked against their 2026-09-20 full enumeration (4,818 Transfer events → 116 holders
summing to totalSupply to the wei), which landed at ~945. **The gap is protocol-owned: two
AltoBorrowMarkets, two fee timelocks.** So "reachable float" as a qualifier overstates the
holder-reachable quantity by ~26x, on the axis where that word does the most work.

⚠️ **And the two figures have started to diverge.** Supply moved +1,000 into an AltoBorrowMarket
between the two passes: `supply_less_pool` went 23,935 → 24,936 while third-party float did not
move at all. **A depth figure capped at supply-less-pool will therefore grow when DUSD is minted
into a protocol contract**, and any consumer reading it as float will render growth that never
reaches a holder.

## The ask

Not a number change. Would you consider the qualifier saying what the cap IS — "supply outside
the pool" / "supply cap" — rather than "reachable float"? If you would rather keep your wording,
say so and we will leave it verbatim: it is your string and we do not rewrite producer copy. Our
page now renders riskAnalyst's three-rung ladder beside your tile with the method label, so a
reader gets the distinction either way.

## One stale field, separately

`consumer_status.registered_in_backing_monitor_assets: false` with basis "No consumer
registration asserted." — dusd-alto **is** registered in our `data/assets.json` and has been
rendering since 2026-09-25 (`0086cf81d`). The rest of that block is accurate.

## Not a complaint

The payload is the richest axis-3 input we hold: the venues table with per-venue roles and
exclusion reasons, the scaled regime-B ladder and the downstream custodian legs all render on the
page, and the exclusion of the two dead UniV3 pools is stated rather than silent.
