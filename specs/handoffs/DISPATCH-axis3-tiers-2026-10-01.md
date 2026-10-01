---
target_repos: PegTracker (~/PegTracker) · DexTracker (~/DexTracker)
target_claude: pegtracker, dextracker
date_drafted: 2026-10-01
status: DRAFT — for backing-monitor owner review before sending
supersedes: DISPATCH-axis3-split-ladder-vs-venues-2026-10-01.md (fd874fd8f)
severity: >
  Not a defect report. Re-pitches the axis-3 ownership proposal after measuring what each producer
  actually does. The field-split version rested on a premise that is false, and asks more of both
  teams than the problem needs.
---

# Axis 3 — tiers, not halves

## Why this replaces the field-split proposal

The earlier proposal divided axis 3 into two halves: **ladder → PegTracker, venues → DexTracker**.
Measuring both repos first shows two reasons that cannot be implemented as written.

**1. ⚠️ Both producers call the same endpoint.** PegTracker's `liquidity_tracker.py` and
DexTracker's `liquidity_refresh.py` both query KyberSwap `/api/v1/routes` and derive a ladder from
the responses. This was never two instruments measuring two things; it is one instrument run twice a
day apart, on different grids. PegTracker: 4 fixed sizes ($1K/$10K/$50K/$100K), ≤8 rungs, every 3h.
DexTracker: a decade grid from $100 to $20M, **plus bisection**, daily at 07:45.

**2. ⚠️ DexTracker's venue list is partly derived from DexTracker's own ladder.** The enumeration is
built from the venues the router actually used (`rung.route_venues` →
`depth.quote.venue_enumeration`). So "stop publishing depth, keep publishing venues" removes part of
the venue data with it. The halves are not separable at the measurement level.

The failure the earlier proposal opened with is real and unchanged: `replace` on the whole axis means
a payload that DECLINES a figure deletes a measured one. reUSD-RE and syzUSD render `0.5% depth n/a`
+ `Not rated` today over a PegTracker `depth_50bps` block measured hours earlier. That is the thing
to fix. The fix just does not require anybody to give up a field.

## The measured comparison

```
                        PegTracker                      DexTracker
ladder source           KyberSwap (+Odos fallback)      KyberSwap
grid                    4 fixed sizes, <=8 rungs        $100-$20M decades + BISECTION
precision               a range as wide as a rung gap   resolves to a point (usg $381,250)
refresh                 every 3h                        daily 07:45
coverage                17 of 32 registered assets       8 of 32
cost to add an asset    3 config fields + a flag         ~29 lines of hand config
pool data               12 assets, live on-chain          8 assets, registry sweep
                        reserves, same 3h clock          (CoinGecko/GeckoTerminal/DefiLlama)
curation                none                             excluded venues WITH REASONS,
                                                         completeness, not_searched
```

⚠️ **AND THE CADENCE ARGUMENT WAS BACKWARDS.** The earlier proposal argued venue structure can
tolerate a daily refresh. True — but the enumeration is not refreshed daily or weekly. Measured from
`enumeration.as_of` on 2026-10-01:

```
syzUSD 32d · reUSDe-RE 28d · USG 25d · USDM 25d · reUSD-RE 23d · BOLD 17d · DUSD 10d · fxUSD 9d
TSM-RH and USDG: the WHOLE payload is 25d / 22d old
```

That is not a complaint — a registry-wide venue sweep is genuinely slow work, and DexTracker has
already said coverage should not be assumed to grow. It is a statement that the cadence to match is
the *enumeration's*, not the depth refresh's, and that the two must not share one clock.

**Already fixed on our side** (`2e351bc0f`): the venue list and TVL now render `enumerated <date> ·
Nd old` from `enumeration.as_of`, and the depth figure renders `ladder measured <date> · Nh old`.
Before that the axis heading showed only the oldest input — "refreshes daily · 23d old" — which read
as a producer three weeks late when the depth was 13h old. Nothing is being asked of either producer
for this; the fields were already published and we were not reading them.

## The proposal: five tiers, each with one owner and its own clock

```
TIER 1  EXIT LADDER + CROSSING          PegTracker     every 3h     REQUIRED, every asset
        exit_mark.quotes · depth at 50 and 200 · status · is_floor · bracket · basis
        Generic by construction: token_address + decimals + sell_into and it works.
        This is the tier that makes a new asset's axis 3 appear with no design work.

TIER 2  BISECTED CROSSING               DexTracker     daily        OPTIONAL refinement
        Published under its own key at a stated threshold. The consumer PREFERS it when
        present and fresh, and falls back to tier 1 otherwise -- never to nothing.
        ⚠️ This one rule removes the suppression failure class entirely.

TIER 3  VENUE INVENTORY + COMPLETENESS  DexTracker     weekly/monthly, honestly labelled
        venues[] with roles · enumeration + method + pinned block · excluded_liquidity
        with reasons · regimes · route legs · axis_binding_constraint
        Must carry its OWN clock (it already does). Where DexTracker does not cover an
        asset, PegTracker's pool rows show as a labelled fallback tier -- PERMANENT, not
        transitional.

TIER 4  LIVE POOL SIZE                  PegTracker     every 3h
        On-chain reserves, which are cheaper and more current than a registry TVL.
        DexTracker's TVL becomes context on the venue list, not a live number.

TIER 5  PRIMARY REDEMPTION + GATE       PegTracker     ladder cadence
        A contract probe (redeem() simulated, cooldowns, eligibility), not venue
        structure. DexTracker currently relays riskAnalyst's canonical for one asset,
        which is a cross-reference rather than a measurement.
```

## What each producer is being asked for

**PegTracker** — nothing new to build. Tier 1 is what you already do; tiers 4 and 5 are what you
already publish. The only ask is the separate dispatch about three assets whose ladders are measured
but do not reach the per-asset feed.

**DexTracker** — nothing to stop publishing. Two asks:
1. Keep the bisected crossing under its own key with its threshold stated, so a consumer can prefer
   it without having to guess whether it is the same quantity as the rung bracket.
2. Keep `enumeration.as_of` as the venue clock (you already do) and let the depth refresh stamp only
   depth. We render both separately now.

⚠️ **Neither ask requires shrinking a payload, and that is the point.** We do not need a producer to
stop publishing a field in order for us to choose which field we read. The tidying was the part that
needed everyone's agreement, and it is the part that was never necessary.

## Three sub-decisions carried forward unchanged

From the superseded proposal, already answered rather than handed back:

1. **Tier the venue coverage, do not strip it.** PegTracker publishes pool/TVL rows for ~10 assets
   DexTracker does not cover (apxUSD, crvUSD, Hastra PRIME, sUSDat, USDat, yzUSD, USDai, thUSD). A
   strict split deletes live content from ten pages to tidy a boundary.
2. **DexTracker's bisected crossing is a deeper measurement, not a rival headline.** PegTracker's
   second ceiling re-searches the same rungs, so its 0.5% answer is a bracket of the same width;
   DexTracker's extra probes are strictly better where they exist.
3. **`primary_exit` goes to PegTracker.** A contract probe on the ladder's cadence.

## One small defect, separate from the above

⚠️ **syzUSD's `depth.basis` is reUSD-RE's, byte for byte** (identical SHA1 across the two payloads).
It names Ethereum/Arbitrum/Base/Avalanche and "PegTracker's cross-chain [10M, 20M] aggregate", while
syzUSD's own `per_chain` keys are plasma/monad/ethereum and its base bracket is [$100K, $150K]. The
rungs and `per_chain` ARE per-asset, so this is a template/prose leak rather than swapped payloads.
Two independent confirmations: the hash match, and the prose contradicting other fields in its own
file.

## Nothing here is urgent, with one exception

The tier structure removes a failure class; no page is waiting on it. The exception is the live
suppression on reUSD-RE and syzUSD, which is ours to fix on the consumer side (tier 2's fallback
rule) and does not need either producer to move first.
