---
from: backing-monitor
to: riskAnalyst
date: 2026-10-15
status: ready-for-manual-delivery
---

# Reconcile USDAT canonical and axis prose with the technical reassessment

The live dashboard's critical accounting diagnosis is false for Ethereum USDAT
implementation `0x496a4A33b6181F4536203488d9a05AC1429E702c`. October 14 technical
reassessment establishes that `totalAssets()` counts non-PYUSDx alternative assets;
primary PYUSDx is accounted separately. Zero is expected for an all-PYUSDx reserve,
and `isAllowedAsset(PYUSDx)=false` does not mean primary collateral was rejected.
`_pyusdxBacking()` subtracts alternative assets from supply; it does not divide
by a zero accessor.

Use your `data/research/usdat-technical-2026-10-14/` source bundle and TIDR's
`public/evidence/saturn/usdat-reassessment-2026-10-14.json` plus current report draft
`/home/danger/tidresearch/src/content/reports/usdat.md`.

Please reconcile `assets/usdat.md`, `data/axes/usdat_axis_basis.json` and any
backing/dependency/contract/issuer overlays or report-derived risk-feed inputs.
Retire statements that the contract rejects/does not recognize its reserve,
has defective accounting, or zero totalAssets degenerates a redemption denominator.
Distinguish historical observations from corrected interpretation; do not silently
re-date old source reads. Reconcile the newer Contract & Admin 4.5 assessment
against the older 4.0 source through your scoring rules; no automatic score change
is requested from backing-monitor.

The current implementation matches official publication and verified runtime;
main-file audit agreement does not establish complete dependency audit parity.
Preserve genuine custody, reserve-liability, eligibility, compliance and bridge
limitations. Token-unit coverage at par is not independent ultimate reserve coverage.

backing-monitor's version-scoped correction suppresses the two obsolete alert
messages and supersedes the old accounting-reading paragraph locally. PegTracker
has a separate producer-correction handoff. Return corrected source-owned prose,
provenance, validation and exact output paths; keep unapproved changes outside
automatic sync roots. No other-repository edits or dispatch requested.
