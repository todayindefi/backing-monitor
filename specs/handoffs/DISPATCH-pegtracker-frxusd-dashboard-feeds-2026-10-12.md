---
target_repo: PegTracker (~/PegTracker)
target_claude: pegtracker
status: ready
from: backing-monitor
date: 2026-10-12
priority: high
outputs:
  - data/frxusd_backing.json
  - data/frxusd_backing_history.json
  - data/frxusd_peg_history.json
---

# Build dedicated frxUSD dashboard feeds

Please add dedicated frxUSD outputs for the phase-one canonical-Ethereum dashboard. Reuse the
existing Frax Facts client and the existing `frxUSD_Ethereum` price observations where appropriate,
but do not rename, overwrite, or reinterpret `frax_backing.json`: that artifact and
`frax_backing_analyzer.py` describe legacy L-FRAX.

## Scope and known inputs

- Canonical Ethereum frxUSD:
  `0xCAcd6fd266aF91b8AeD52aCCC382b4e165586E29`.
- Existing Chainlink frxUSD/USD feed:
  `0x62a897c3e81d809c7444BB63D7D51E1F2EbB6C3D`.
- The existing canonical peg series is `frxUSD_Ethereum` in
  `data/peg_tracker_history.json`. Fraxtal's reused Ethereum mark is not an independent price
  observation and must not be mixed into this series.
- The current Frax Facts balance-sheet and summary endpoints are already consumed by the L-FRAX
  analyzer. Reuse their client/parsing logic, but isolate rows belonging to the frxUSD system.
- The latest independently observed dashboard-planning snapshot was 2026-10-11T16:03:47Z:
  $108.46M assets, $105.48M liabilities, 102.82% coverage, and $2.98M surplus. Treat these values
  only as a regression cross-check, not constants.

Phase one is canonical Ethereum. The issuer balance sheet nevertheless covers the global frxUSD
liability and reserve pool. Label that scope explicitly; do not present global issuer coverage as
an Ethereum-only reserve ratio. If supply-by-chain data is published, separate canonical Ethereum
native/circulating supply from global liabilities and leave unsupported networks unmeasured.

## Required artifacts

### `data/frxusd_backing.json`

Publish a normalized, provenance-rich current snapshot containing:

- issuer-reported total reserve assets, frxUSD liabilities, coverage ratio, and surplus/deficit;
- exact reserve categories and values, including WTGXX, USTB, BUIDL, Erebor cash, and any non-zero
  stablecoin or other lines returned by the source;
- source URL or endpoint, the source's own effective timestamp, retrieval timestamp, and source
  kind `issuer_reported`;
- a clear caveat that the data is issuer-published and is not an independent custodian
  attestation;
- canonical Ethereum token supply, block number, and observation time when an RPC read is
  available;
- global/network supply totals only where sourced, with reconciliation status and an explicit
  unattributed or unmeasured bucket rather than an estimate;
- current canonical peg mark and its source as supporting context, without duplicating liquidity
  depth;
- deterministic stale/source-failure and below-par coverage flags. Preserve the last good
  measurement on a failed refresh and publish the failed attempt separately or in status metadata.

Do not assign a risk score or convert reserve composition into a subjective quality grade.

### `data/frxusd_backing_history.json`

Append the trusted current coverage observation on the normal schedule using the source's effective
timestamp, with `collateral_ratio_scale: "percent"`, assets, liabilities, surplus, reserve breakdown,
source kind, and canonical supply/block fields when measured. Seed history only from preserved,
verifiable prior snapshots. Do not interpolate, backfill from prose, or duplicate observations.
Document the real coverage start.

The dashboard will clip this history to a trailing seven-day window aligned exactly with the peg
chart. A sparse series remains seven days; the producer must not advertise a 30-day horizon.

### `data/frxusd_peg_history.json`

Export the canonical `frxUSD_Ethereum` observations in the standard per-asset history shape. Retain
observation timestamp, source, price, chain, and feed provenance. The displayed contract is seven
days. Do not include Fraxtal's reused canonical mark as a second observation.

## Scheduling and validation

- Add all three outputs to the normal producer runner, freshness checks, JSON validation, and
  publishing path.
- Keep source timestamps distinct from job runtime and file publication time.
- Add tests proving L-FRAX output remains unchanged, the frxUSD reserve subtotal reconciles to total
  assets, percent scale is explicit, history appends are idempotent, and stale/failure handling
  cannot turn missing data into zero.
- Return the producer commit, test result, one scheduled-run sample, output timestamps, and any
  unresolved supply/reconciliation gaps to backing-monitor and RiskAnalyst.

