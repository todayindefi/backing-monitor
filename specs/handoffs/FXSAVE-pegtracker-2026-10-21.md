---
from: backing-monitor
to: pegtracker
date: 2026-10-21
status: delivery_complete
thread_id: 01a15d72-fef6-76a0-b6f6-5211a90be68f
---

# FXSave — pegtracker delivery

Read `/home/danger/backing-monitor/specs/fxsave-feed-contract.md` and
`/home/danger/riskAnalyst/assets/fxsave.md` (revised October 21).
The September combined dashboard plan is superseded for FXSave by this contract.

Build and schedule the recurring vault/NAV/redemption producer described in the contract. Inspect existing farmAnalyst/FarmTracker October 20–21 evidence and RiskAnalyst's evidence before duplicating RPC work. Pin all related calls to one block; measure totalSupply, totalAssets, convertToAssets, nav, vault/gauge custody, both previewRedeem outputs, instant fee, queue delay and Morpho balance. Probe funded-holder redemption with a negative control read-only; no transactions. Preserve raw precision for reconciliation. Track forward history and last-good/failed-attempt clocks. Propose hourly refresh; return scheduling evidence rather than assuming it is enabled. No independent dollar collateral ratio is required or appropriate.

Keep candidate outputs outside auto-published source roots, under
`data/dashboard_pending/fxsave/` or the repository's established pending area.
Return exact artifact paths, commit, verification commands/results, remaining
limitations and scheduling status. Do not edit other producer repositories.
User explicitly authorized dispatch and coordination on 2026-10-21.
Return a self-contained completion report in your task with candidate paths, commit,
checks, unresolved items, and scheduling state. backing-monitor coordinates and integrates.
Do not edit this source handoff or other producer repositories.
