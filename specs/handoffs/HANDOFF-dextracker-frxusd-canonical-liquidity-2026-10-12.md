---
id: dextracker-frxusd-canonical-liquidity-2026-10-12
from: backing-monitor
to: DexTracker
status: ready
priority: high
date_drafted: 2026-10-12
output: data/liquidity/frxusd_liquidity.json
---

# Measure canonical-Ethereum frxUSD executable liquidity

Please build the phase-one frxUSD liquidity artifact for canonical Ethereum. Measure executable
frxUSD exits into USDC using routed quotes and verified venue inventory. Other chains are out of
scope and must remain explicitly unmeasured.

Canonical frxUSD is `0xCAcd6fd266aF91b8AeD52aCCC382b4e165586E29`. PegTracker's current
cache has only $1K/$10K/$50K/$100K Kyber quotes; that is useful as a cross-check but is not a
complete institutional exit ladder.

## Quote ladder

- Measure $1K, $10K, $50K, $100K, $250K, $500K, $1M, $2M, $5M, and $10M.
- Continue beyond $10M when successful quotes remain within 50 bps, then stop after the first rung
  that brackets the 50 bps crossing. If there is no crossing, report the deepest successful rung as
  a floor, not as a limit.
- Publish 50-bps depth as the stable-asset headline. A 200-bps crossing may be secondary context,
  never the headline.
- Preserve failed rungs and provider errors. Failure is not zero depth and must not erase the last
  valid bracket.
- Calculate total/all-in cost and marginal impact separately. State the smallest successful rung
  used as the reference and retain raw frxUSD input and USDC output amounts.

## Required evidence

For every successful rung, retain the route, venues and pool addresses, quote timestamp, block when
available, expiry, raw token quantities, reference prices, and price-source timestamps. Publish the
50-bps result explicitly as `crossing`, `bracket`, or `floor`, including interpolation assumptions
if any.

Publish venue inventory separately from executable depth. Apply the repository-wide venue filter:
exclude zero-volume/dust venues from the reader list, require meaningful recent activity and
liquidity, deduplicate the same economic pool across aggregators, and retain the full rejected venue
set in machine-readable diagnostics with reason codes. Do not sum TVL and call it exit depth.

Where frxUSD has a direct primary redemption route, measure and describe it separately: currently
available redemption asset/inventory, executable fee, caps, eligibility or allowlist constraints,
settlement timing, and observation provenance. Documentation alone is not executable depth, and a
gated or inventory-limited primary path must not silently augment the secondary-market ladder.

## Acceptance

- Add `data/liquidity/frxusd_liquidity.json` to the normal scheduled producer and publishing path.
- Validate canonical chain/token identity, rung ordering, units, all-in versus marginal math,
  threshold state, quote freshness, and non-destructive failure handling.
- Return the producer commit, tests, one scheduled-run artifact, venue-filter diagnostics, and any
  unresolved primary-redemption constraint to backing-monitor and RiskAnalyst.
- No score. DexTracker owns the observation; RiskAnalyst owns interpretation and scoring.

