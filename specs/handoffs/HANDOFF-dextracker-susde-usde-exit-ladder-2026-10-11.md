---
id: dextracker-susde-usde-exit-ladder-2026-10-11
from: backing-monitor
to: DexTracker
status: ready
priority: high
date_drafted: 2026-10-11
output: data/liquidity/susde_liquidity.json
---

# Measure the canonical-Ethereum sUSDe → USDe executable exit ladder

Measure a routed secondary-market exit from canonical Ethereum sUSDe into USDe. This is a quote
ladder, not TVL and not the one-day primary unstaking cooldown.

Important existing finding: the October 2 venue enumeration found no exact Curve sUSDe/USDe pool;
the commonly cited `0x4b5e…` pool is sUSD/sUSDe. Do not invent a direct pool. Use executable routing
across verified venues and report the actual route at each rung.

Requirements:

- Canonical Ethereum only in this handoff. Other chains remain explicitly unmeasured.
- Denominate input and output in USD using the same observation-time USDe mark and sUSDe on-chain
  NAV; also retain raw sUSDe-in and USDe-out amounts.
- Publish total/all-in cost and marginal impact separately, with the first-rung reference explicit.
- Primary threshold is 50 bps because sUSDe is a dollar-denominated accruing-NAV share. A 200 bps
  crossing may be secondary context, never the headline depth.
- Start with useful retail/institutional rungs and extend to at least $10M when quotes remain inside
  50 bps. Stop after bracketing the 50 bps crossing; if no crossing is found, publish the deepest
  successful rung as a floor, not a limit.
- Preserve failed rungs and provider errors. A failed quote is not zero depth and must not erase the
  last good bracket.
- State route, venue/pool addresses, quote timestamp/block where available, and executable quote
  expiry.
- No score. DexTracker owns the observation; riskAnalyst owns scoring.

Return the producer commit, tests, one scheduled-run artifact, and the exact `depth_50bps` shape
(`crossing`, `bracket`, or `floor`) to backing-monitor and riskAnalyst.
