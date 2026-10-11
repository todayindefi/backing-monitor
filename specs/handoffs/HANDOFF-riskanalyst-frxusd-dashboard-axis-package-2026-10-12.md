---
target_repo: riskAnalyst (~/riskAnalyst)
target_claude: riskanalyst
status: ready
from: backing-monitor
date: 2026-10-12
priority: high
outputs:
  - data/axes/frxusd_axis_basis.json
  - data/axes/frxusd_issuer.json
---

# Package the reviewed frxUSD assessment for the dashboard

The frxUSD report was fully refreshed on 2026-10-12, and its dependency and contract overlays are
already machine-readable. Please package the remaining reviewed judgments for backing-monitor. This
is a serialization task, not a request to re-score the asset.

## Required outputs

Create `frxusd_axis_basis.json` using `axis-basis/1`, carrying the report's current authored scores
and bases:

- peg mechanism 6.5;
- backing 6.5;
- liquidity 5.5;
- dependencies 4.5.

Each block must state what that axis measures, retain `riskAnalyst:authored` provenance and the true
generation/as-of timestamp, and distinguish observations from judgment. Do not copy the 3.5
contract score into this envelope: `frxusd_contract_overlay.json` already owns the rendering basis,
and two authored bases for one score will drift.

Create `frxusd_issuer.json` using `issuer/1`, carrying the current authored 5.0 issuer score, entity,
summary, supporting facts, source/provenance, and report-link status. If the public report URL is not
live, declare it unavailable rather than publishing a guessed URL.

The overall 5.5 may be retained as envelope metadata if the schema supports it, but it must not be
substituted for an axis score. Canonical Ethereum is the dashboard's phase-one market/authority
scope; issuer-wide reserve and organizational facts should remain explicitly global where they are
global.

## Acceptance

- Validate both files against the repository's current schemas and asset-identity checks.
- Keep the existing `frxusd_dependencies.json` and `frxusd_contract_overlay.json` authoritative and
  unchanged unless a genuine correction is required.
- Return the commit, changed paths, schema checks, timestamps, and report-link status to
  backing-monitor.

