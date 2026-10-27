---
from: backing-monitor
to: riskanalyst
date: 2026-10-21
status: delivery_complete
thread_id: 01a15d73-b227-7ce2-a866-378db3109ae1
---

# FXSave — riskanalyst delivery

Read `/home/danger/backing-monitor/specs/fxsave-feed-contract.md` and
`/home/danger/riskAnalyst/assets/fxsave.md` (revised October 21).
The September combined dashboard plan is superseded for FXSave by this contract.

Return a consumer-ready fxsave_axis_basis.json for the six-axis frame, plus reconciled backing/dependencies/contract/issuer overlays. Preserve the October 21 correction: previewRedeem has two outputs; no alleged 2.4% loss or 4.3% gap. Current recorded scores (NAV 5, backing 4.5, liquidity 3.5, contract 4, issuer 5.5, overall 4.5) remain dated/under review, not newly verified. Confirm the NAV/volatility mapping and whether a dependencies score is actually authored; do not borrow tidresearch's underlying_score without reconciling provenance. Merge redemption evidence into liquidity on the binding leg; do not expose redemption 7 as another axis. Reassess after DexTracker delivers depth and explicitly address 37.38% Morpho concentration. Reconcile fxSP's deliberate no-separate-report policy with the dependencies overlay's unresolved fxSP coverage-gap claim. Distinguish current wrapper custody from September gauge figures; update shared-admin and bounded second-Safe text without implying complete audit coverage.

Keep candidate outputs outside auto-published source roots, under
`data/dashboard_pending/fxsave/` or the repository's established pending area.
Return exact artifact paths, commit, verification commands/results, remaining
limitations and scheduling status. Do not edit other producer repositories.
User explicitly authorized dispatch and coordination on 2026-10-21.
Return a self-contained completion report in your task with candidate paths, commit,
checks, unresolved items, and scheduling state. backing-monitor coordinates and integrates.
Do not edit this source handoff or other producer repositories.
