---
id: bold-standard-axis-blocks-2026-09-16
from: claude
to: codex
status: completed
priority: high
output:
  - bold_backing_analyzer.py
date_dispatched: 2026-09-16
date_completed: 2026-09-16
---

> STOP — target repo is `~/PegTracker`. Do not edit backing-monitor, riskAnalyst,
> DexTracker, or security_analyst.

# Expose BOLD's existing peg and backing measurements through the standard axis contract

This is schema wiring, not new measurement. The analyzer already refreshes `bold_backing.json`,
`bold_backing_history.json`, and `bold_peg_history.json`. The snapshot lacks top-level `peg` and
`backing` blocks. backing-monitor activates six-axis mode only when `data.peg` exists.

## Required change

In `bold_backing_analyzer.py`, construct standard blocks from values produced by the same run.
Follow a conforming stablecoin analyzer and the existing `risk_feed_client` conventions. Do not
copy live figures or report prose into constants.

### `peg`

Include current market price and source, fixed par `1.0` explicitly identified as par, signed
premium/discount, observation time, `history_ref: "bold_peg_history.json"`, and
`history_field: "peg_market_price"`. Preserve the paired theoretical-price history.

Do not use `summary.redemption_floor` as the peg reference. It is a size-zero redemption-cost output;
DexTracker's size-dependent fee ladder proves it is not executable at size.

Attach `peg_mechanism_score` only through the risk-feed client convention, without replacing
measured fields or making the run fail when the risk feed is unavailable.

### `backing`

Include `collateral_ratio`, `collateral_ratio_scale: "percent"`, producer basis, total backing and
Ethereum/live-deployment scope, total supply and scope, and composition sourced from the same
`backing_breakdown` emitted by this run using the standard renderer vocabulary.

Preserve the richer summary, breakdown, branches, reconciliation, Stability Pool, sBOLD, and alert
threshold fields. Attach `backing_score` through the risk-feed client without replacing measurements.

## Safety constraints

- Resolve live BOLD by `0x6440f144b7e50D6a8439336510312d2F54beB01D`, never ticker.
- Do not add liquidity; DexTracker already publishes BOLD `liquidity/1`.
- Do not author dependency, contract, or issuer prose.
- Do not refresh observation clocks without refreshing their inputs.
- Missing risk-feed scores must not suppress measured blocks.

## Acceptance

Run the analyzer through its normal safe path and inspect emitted JSON:

1. `peg` and `backing` are present.
2. Peg deviation agrees with market price versus par; history resolves to non-empty paired values.
3. Backing agrees with the same run's summary/composition and is not scaled by 100 twice.
4. Existing custom fields remain.
5. No liquidity/dependency/contract/issuer block is invented.
6. Relevant tests, syntax checks, and `git diff --check` pass.
7. Report what this did not establish.

When done: write your report to the `output:` path declared in this file's header, and set
`status: completed` in this file's header.
