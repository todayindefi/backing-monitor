---
target_repos: PegTracker (~/PegTracker) · DexTracker (~/DexTracker)
target_claude: pegtracker, dextracker
date_drafted: 2026-10-01
status: >
  SUPERSEDED 2026-10-01 by DISPATCH-axis3-tiers-2026-10-01.md, and NOT SENT in this form. The split
  below rests on a premise measurement contradicts: both producers query the same KyberSwap routing
  endpoint, and DexTracker's venue list is partly derived from DexTracker's own ladder, so "ladder
  vs venues" is not a separable partition. Kept for the three sub-decisions in §"Three decisions",
  which the tier version carries forward unchanged.
  ⚠️ Its closing line "No page is broken today" was true when the suppression discarded only raw
  rungs. It stopped being true once PegTracker published explicit 50 bps blocks — which this file's
  own opening section describes as a live failure. The later sentence is the stale one.
severity: >
  Not a defect report. Axis 3 currently has two producers publishing OVERLAPPING payloads in
  different vocabularies, and one of them can suppress the other. This proposes splitting by what
  the data IS rather than by who measures it.
---

# Axis 3 — split the ladder from the venues

## Why, in one failure

DexTracker's payload `replace`s the whole axis when present. ⚠️ **So a daily payload can suppress a
3-hourly measurement**, and has: reUSD-re rendered "2% depth n/a" while a 9-rung ladder measured
20 minutes earlier sat underneath it, because the overlay published `depth_usd: null` and replace
won. Under a field split that is structurally impossible — different owners, different keys,
nothing to suppress.

The second reason is cadence. Exit cost moves with the market (usde's deepest rung: −5.2 bps at
13:30Z, **−130.2 at 22:30Z**, −10.7 the next morning). Venue structure does not. Today they share
one refresh rate and one staleness horizon.

## The split

```
LADDER + CROSSINGS            PegTracker        every 3h      17 assets
  exit_mark.quotes (rungs) · depth at 50 and 200 · status · is_floor · bracket
  size_responsive · basis · fair_value · measured_chain/venue · scope
  primary_exit  ⚠️ a CONTRACT PROBE on the ladder's cadence, not venue structure

VENUE STRUCTURE               DexTracker        daily         10 assets
  venues[] with roles · enumeration + method + pinned block · excluded_liquidity
  regimes · downstream_route_legs · pools · total_tvl · volume_24h
  axis_binding_constraint
```

## Three decisions, with the answers we'd propose

**1. ⚠️ Venue coverage is ragged — tier it, do not strip it.** DexTracker covers 10 assets;
PegTracker publishes shallow pool/TVL rows for roughly ten OTHERS (apxusd 4 pools, crvusd 7,
hastra-prime, susdat, usdat, yzusd, usdai, thusd). A strict split deletes live content from pages
to tidy an ownership boundary. **Keep PegTracker's pool list as a fallback tier, attributed, until
DexTracker covers the asset.** Removing live data is a bigger decision than a reorganisation should
make silently.

**2. DexTracker keeps its bisected crossing — as a deeper measurement, not a rival headline.**
PegTracker's second ceiling re-searches the SAME 8 rungs, so its 0.5% answer is a bracket of the
same width (their words: crvUSD, syzUSD and yzUSD "get the SAME bracket at both ceilings"). ⚠️
DexTracker BISECTS — extra quotes between rungs — which is how usg resolves to **$381,250** instead
of a range. That is strictly better where it exists. Publish it under its own key, labelled as a
bisected crossing at a stated threshold; the consumer prefers it when present and falls back to the
rung bracket otherwise.

**3. `primary_exit` goes to PegTracker.** It is a contract probe — sUSDe's `redeem()` simulated,
gates, cooldowns — not venue structure, and it wants the ladder's cadence. DexTracker currently
publishes it for DUSD by CITING riskAnalyst's canonical, which is a relay rather than a
measurement; better as a cross-reference than as a field.

## What changes on the consumer side

`liquidity/1` stops being `replace` for the whole axis and merges into VENUE fields only. That
deletes the suppression failure mode above, and with it `superseded_depth`, `_baseHasDepth`, and
the 7-day horizon stops applying to depth (where a week is fatal) and applies to venue structure
(where a week is fine). Our work, not yours — stated so you can see the shape it leaves.

## Sequencing

⚠️ **Not now for PegTracker** — finish the 50 bps block first; this is the next conversation, not a
competing one. For DexTracker the question is whether the venue half is something you want to own
exclusively, and whether coverage can widen past 10.

Nothing here is urgent. No page is broken today; the split removes a class of failure and matches
refresh rate to what actually moves.
