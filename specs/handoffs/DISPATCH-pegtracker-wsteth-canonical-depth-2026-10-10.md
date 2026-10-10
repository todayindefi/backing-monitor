---
target_repo: PegTracker (~/PegTracker)
target_claude: pegtracker
status: completed
from: backing-monitor
to: codex
date: 2026-10-10
output: data/wsteth_backing.json
result_commit: a8ba0e6
---

# Canonical wstETH: publish adaptive 50 bps depth through $10M

The canonical Ethereum feed is now correctly named and scoped. Keep `asset_slug: "wsteth"`,
`chain: "ethereum"`, the `wstETH_Ethereum` peg series, and the same-block wrapper reconciliation.
Do not turn this request into a Monad page; Monad remains deferred bridge context.

## Required producer change

Replace the bespoke 2%-only depth calculation in `wsteth_backing_analyzer.py` with the standard
impact-basis result required by `backing-monitor/specs/six-axis-dashboard-spec.md` Axis 3:

1. Quote the existing ascending ladder, extended to:

   ```text
   1K, 10K, 50K, 100K, 250K, 500K, 1M, 2M, 5M, 10M USD
   ```

2. Treat the smallest successful rung as the reference. Size impact is each later rung's exit cost
   minus that reference rung's exit cost. Do not count the standing NAV discount or first-rung gas
   cost as size impact.
3. Stop after the first successful quote whose size impact exceeds 50 bps. Retain that first
   failing rung so the crossing is bracketed. If every rung through $10M remains within 50 bps,
   publish a floor of `>= $10M` with `status: "ladder_exhausted"`; never publish `$10M` as a located
   limit.
4. Publish a standard `liquidity.depth_50bps` block with value/bracket, status, `is_floor`,
   `ladder_exhausted`, threshold and impact basis. The dashboard will use this block as primary.
5. `two_pct_depth` may remain as a secondary compatibility field, but it must not be the only
   published result.
6. If practical, bisect between the last passing and first failing rung to sharpen the crossing.
   Keep the coarse bracketing rungs in `quotes` even when a bisected crossing is published.
7. Add tests for bracket, floor, failed quote, reference-rung subtraction, adaptive stopping, and
   the checked-in payload reaching either its first >50 bps rung or the $10M ceiling.

## Canonical primary exit

Publish a structured canonical-Ethereum `primary_exit` under `liquidity`:

- permissionless `wstETH -> stETH` unwrap;
- `stETH -> ETH` through the Lido withdrawal queue;
- distinguish call accessibility from variable queue duration;
- do not describe CCIP as the canonical holder's primary exit.

RiskAnalyst owns holder-eligibility interpretation; this block should report the executable
mechanism and its measured/probed state.

## Scope cleanup

The top-level `not_established` currently says `Siloed-leg solvency is outside the CCIP shared-pool
sum.` That is bridge context and reads as a limitation of canonical wrapper backing. Remove it from
the canonical list or move it beneath an explicitly bridge-scoped block. `bridge_exit` and
`bridged_supply` may remain as non-headline context, but they must not qualify canonical backing or
liquidity.

## Acceptance

- `python3 -m pytest tests/test_wsteth_backing_analyzer.py`
- run `python3 wsteth_backing_analyzer.py`
- `data/wsteth_backing.json` remains canonical Ethereum and contains `liquidity.depth_50bps`
- the quote set stops after the first >50 bps impact or reaches $10M
- a no-crossing run states a floor, not a located limit
- canonical `primary_exit` is present
- no canonical `not_established` sentence is about CCIP shared-pool solvency
