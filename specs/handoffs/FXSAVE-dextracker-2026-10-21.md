---
from: backing-monitor
to: dextracker
date: 2026-10-21
status: delivery_complete
thread_id: 01a15d73-6f26-74a0-8419-9d0b36945c1e
---

# FXSave — dextracker delivery

Read `/home/danger/backing-monitor/specs/fxsave-feed-contract.md` and
`/home/danger/riskAnalyst/assets/fxsave.md` (revised October 21).
The September combined dashboard plan is superseded for FXSave by this contract.

Refresh direct fxSAVE-to-USDC executable depth and fxUSD-to-USDC depth, reusing the existing October 20 routed adapter where appropriate. Measure matched share inputs at $10k, $100k, $1m and larger sizes through crossings; report failed rungs and route ceilings separately. Compare direct swap with instant basket redemption plus market exit, adding direct USDC once. Coordinate same-block basket inputs with PegTracker rather than claiming atomic execution from unmatched clocks. Return venue inventory separately from executable quotes, pool addresses, routes, input/output units, NAV and mark conventions, brackets at 50/200 bps, gas basis and timestamps. The ~$4.27m historical fxUSD route peak is not whole-claim capacity. Propose three-hourly depth refresh and explicit staleness limits.

Keep candidate outputs outside auto-published source roots, under
`data/dashboard_pending/fxsave/` or the repository's established pending area.
Return exact artifact paths, commit, verification commands/results, remaining
limitations and scheduling status. Do not edit other producer repositories.
User explicitly authorized dispatch and coordination on 2026-10-21.
Return a self-contained completion report in your task with candidate paths, commit,
checks, unresolved items, and scheduling state. backing-monitor coordinates and integrates.
Do not edit this source handoff or other producer repositories.
