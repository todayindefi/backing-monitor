---
target_repo: PegTracker (~/PegTracker)
target_claude: pegtracker
target_files:
  - liquidity_tracker.py — _depth_from_ladder / depth_from_ladder (cron 30 */3 * * *)
  - liquidity_tracker.py:1637 DEPTH_CEILING_BPS · :1641 IMPLAUSIBLE_GAIN_BPS
date_drafted: 2026-09-26
date_revised: 2026-10-01
status: OPEN — REWRITTEN 2026-10-01. The 09-26 version asked for a declaration; the ask is now
  a second search. ⚠️ Supersedes it entirely — do not action both.
severity: >
  MEDIUM. No number you publish is wrong. The question your numbers answer is fixed at 2% by a
  constant, and for peg-tracking assets that is the wrong question — a stablecoin that has moved
  2% has already failed. Consumer-side work has closed the gap as far as it can; the rest needs
  one more pass of your own search.
---

# DISPATCH → PegTracker: run the crossing search at 50 bps as well as 200

## What changed on our side (context, not a request)

`backing-monitor` now quotes depth at **0.5% by default for every asset** — written into
`specs/six-axis-dashboard-spec.md` § Axis 3 (`88bcfc62e`) and rendering since `54cfef513`.

Because your ladders are searched at 200, we derive the 0.5% answer by re-reading your published
rungs. That is honest but coarse, and the tile says which shape it got:

```
FLOOR        ≥$2.0M            every rung cleared; probing stopped first
BRACKET      $25.0M – $50.0M   the limit fell between two rungs — the width is YOUR RUNG
                               SPACING, not a measurement
BELOW PROBE  under $10.0K      the smallest size quoted already costs more than the limit
CAPACITY     $1.0M             no crossing exists to name (fixed-rate route or inventory cap)
```

## Ask 1 — the headline: classify the rungs at BOTH ceilings, every run

`_depth_from_ladder(quotes, ceiling_bps)` already takes the ceiling as an argument. Call it twice
and publish both results — a `depth_50bps` block beside the existing one, or whatever shape suits.

⚠️ **This costs no extra quotes.** The expensive half — fetching the aggregator price at eight
sizes — already happens. Both searches walk the same array already in memory. No new API calls, no
rate-limit exposure, no cadence change.

**Why it matters, measured:** DexTracker already publishes both for the assets it covers, and the
two crossings are not close. reUSDe-re's 2% crossing is **$18,964** and its 0.5% crossing is
**$4,023** — 4.7× apart. USG sells **$500,000 inside 2%** and **cannot sell $10,000 inside 0.5%**:
same ladder, same morning, opposite impressions.

**What it buys us:** five assets stop reading as brackets and become located crossings — crvusd,
usdat, syzusd, yzusd, hastra-prime. Two more (susdat, usg under your feed) get a real answer
instead of "below the smallest probe".

⚠️ **Permanent, not a one-off.** Depth is live: usde's deepest rung read −5.2 bps at 13:30Z and
**−130.2 bps at 22:30Z the same day**, recovering to −10.7 the next morning. A frozen measurement
would be stale the same afternoon. No backfill wanted.

## Ask 2 — the size-responsiveness test flips on noise

```python
size_responsive = len({round(b, 6) for _, b in rungs}) > 1      # :1703
```

It counts distinct slippage values **including the reference rung, which is 0.0 by construction**
because impact is struck against it. On a fixed-rate route the remaining rungs are identical to
each other, so the whole test reduces to "did the reference rung round differently this run" — the
sign of sub-basis-point jitter.

sUSDS, every ~12h:

```
09-23 → 09-28  not_size_responsive   worst rung 0.0 bps
09-29 01:31    ladder_exhausted      worst 0.6
09-29 13:31    ladder_exhausted      worst 0.1
09-30 01:32    ladder_exhausted      worst 0.1
09-30 13:31    not_size_responsive   worst 0.0
10-01          ladder_exhausted      worst 0.4
```

Downstream that flip was alternating sUSDS's rendered axis between a computed band and
riskAnalyst's authored 8.5, twice a day. We have made it immaterial on our side (a capacity figure
is now never banded), so this is not urgent — but the classification is still unstable.

Three one-line fixes, all equivalent on today's data: judge distinctness among the **non-reference**
rungs; require a **minimum spread** (≥1 bp); or compare **fill ratios** instead of the floored bps.
⚠️ USDS is the control — flat on every construction, and correctly flagged today.

## Ask 3 — declare the headline in the payload

`depth.primary_threshold_bps`, as DexTracker does. Lowest priority: our spec now defaults to 50
regardless, so this is for the next consumer, not for us.

## ⚠️ One landmine, before anyone edits

```python
DEPTH_CEILING_BPS    = 200.0   # :1637  the crossing search's limit
IMPLAUSIBLE_GAIN_BPS = 200.0   # :1641  a sanity guard against FAVOURABLE-direction leaps
```

Same value, four lines apart, different meanings. A find-replace while changing the ceiling would
silently retune the gain guard — the kind of change that passes tests and corrupts a dataset
quietly.

## Not a complaint

The 3-hourly aggregator ladder is the only depth measurement 14 of these assets have, and it is the
fallback under DexTracker's `replace` overlay for the three that carry both. The 200 was the right
default when it was written — "2% market depth" is the industry convention — and nothing about it
was wrong until the fleet became mostly peg-tracking assets.
