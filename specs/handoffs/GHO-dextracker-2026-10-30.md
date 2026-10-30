---
from: backing-monitor
to: DexTracker
status: draft-not-dispatched
date: 2026-10-30
---

# GHO venue inventory

User requested a refreshed GHO six-axis dashboard. Read
`specs/gho-dashboard-plan.md` and the current six-axis liquidity ownership
table. This draft has not been dispatched or accepted.

Provide staged `gho_liquidity.json` using `liquidity/1`: verified pool/token
identity, venue inventory, counter-assets, custody/size evidence, exclusions,
chain coverage, enumeration completeness and an independent enumeration clock.
Do not equate empty results in the current LP metrics snapshot with no GHO
venues. The existing tokenAnalyst collector found CurveTracker's GHO/crvUSD
reference pool; it is only a starting point, not a complete inventory.

PegTracker owns the canonical exit ladder/crossing. If returning diagnostic
quotes, identify route, size, reference, clock and scope, and do not silently
override the ladder with pool TVL or a different cost convention. Primary
redemption eligibility and execution must remain separately attributed.

Return staged output, integrity/source manifest, scope limitations, collector
runbook, cadence and failed/partial enumeration behavior. No public registration
or scheduled activation is performed by this brief.
