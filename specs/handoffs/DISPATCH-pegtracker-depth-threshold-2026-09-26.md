---
target_repo: PegTracker (~/PegTracker)
target_claude: pegtracker
target_files:
  - liquidity_tracker.py — the exit_mark ladder writer (cron 30 */3 * * *)
  - "*_backing_analyzer.py — the per-asset analyzers that embed their own exit_mark"
date_drafted: 2026-09-26
status: OPEN — one field, plus an optional second
severity: >
  MEDIUM. No number is wrong. The HEADLINE THRESHOLD of 17 assets is chosen by a consumer-side
  default rather than by the producer, so the same question renders as "0.5% depth" on six assets
  and "2% depth" on seventeen. Routed as a file; no pegtracker session was reachable.
---

# DISPATCH → PegTracker: declare `primary_threshold_bps` on the embedded ladders

## The asymmetry

Axis 3 has two ladder producers and we render both:

```
DexTracker  {slug}_liquidity.json   liquidity/1, daily 07:45, 10 assets
            declares primary_threshold_bps: -50 AND a bracket_50bps
PegTracker  {slug}_backing.json -> liquidity.exit_mark.quotes
            every 3h (+ hourly per-asset analyzers), 17 assets
            declares NO threshold
```

Our renderer reads the producer's `primary_threshold_bps` and falls back to **200** when it is
absent (owner decision 2026-09-22: follow the producer). So DexTracker's assets headline the 0.5%
crossing and yours headline 2% — an inconsistency that is about which producer measured, not
about the asset. **For a peg-tracking asset a 2% move is already a depeg**, so the 2% crossing
answers a question nobody holding it is asking.

## The ask

1. **`depth.primary_threshold_bps` (or a sibling of `exit_mark`) on peg-tracking assets, set to
   `-50`.** One field. It makes the headline the producer's decision rather than our default.
2. Optional and more valuable: **bracket the 50 bps crossing** the way you already bracket 200 —
   `bracket_50bps: {lower_size_usd, lower_slippage_bps, upper_size_usd, upper_slippage_bps}`. Where
   the ladder is exhausted inside 50 bps a floor is fine; where it crosses, the bracket is the
   real answer and we cannot derive it.

## What we did in the meantime, and its limits

Shipped 2026-09-26 (`f9f640161`): the headline moves to 0.5% **only** where the published figure is
already a floor, the ladder is size-responsive, every quoted rung clears inside 50 bps, and the
figure does not exceed the deepest cleared rung. Five assets qualify today — susde, usdai, susdai,
apxusd, apyusd — and the rungs that justify it render beside the figure.

⚠️ **It is a relabel, never a derivation**, and it refuses in three situations you should know
about because they are yours to close properly:

- **Located crossings are untouched.** crvusd $25M, usg $500K, usdat $2M, syzusd $150K, yzusd
  $370K are measured 200 bps crossings; their 0.5% crossing is a different, smaller number we
  cannot see. Only a 50 bps bracket from you can fill that.
- **Non-size-responsive ladders are excluded.** susDS returns 0.00 bps at every rung $1K→$1M and
  usds/hastra-prime are flagged the same way; there is nothing to relabel.
- **⚠️ It is data-responsive, and that already bit.** usde's $5M rung read −5.2 bps at 13:30Z and
  **−130.2 bps at 22:30Z the same day**. It was a 0.5% floor in the morning and is not one now.
  Our rule re-reads the rungs every render, so it followed the market — but that swing is worth a
  look from your side on its own merits.

## Not a complaint

The 3-hourly aggregator ladder is the only depth measurement 14 of these assets have, and it is
the fallback under DexTracker's `replace` overlay for the three that carry both. This is a request
for one declarative field on a feed that is doing the harder job already.
