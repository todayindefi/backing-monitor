---
from: backing-monitor
to: PegTracker
date: 2026-10-14
status: ready-for-manual-delivery
---

# DOLA — Axes 1/2, executable exit ladder, and proposed DOLA PSM ownership

Read `backing-monitor/specs/dola-dashboard-plan.md` and `specs/dola-feed-contract.md` before implementation. Canonical research is `/home/danger/riskAnalyst/assets/dola.md` and six linked October 14 evidence JSON files. Ethereum DOLA is `0x865377367054516e17014ccded1e7d814edc9ce4`; sDOLA and jrDOLA are separate assets.

Use existing repository schemas and validation. Preserve independent clocks, block/source provenance, null versus zero, last-good snapshots and explicit partial/failure states. Historical research is a reproduction reference, not a fresh feed. Do not change other producers' files, dispatch other agents, register DOLA or promote/publish its report through this handoff. Keep unapproved artifacts outside automatic sync roots; return the implementation commit, exact output paths, cadence, validation results and unresolved work. These handoffs are for manual delivery by the user; no dispatch has occurred.

# Requested work

Build the canonical `data/dola_backing.json`, backing/peg histories and `data/dola_exit_ladder.json`. Supply the `peg` block required by the shared six-axis frame. Use $1 as reference and disclose historical-series gaps.

Measure Ethereum supply separately from issuer-defined circulation. Collect FiRM market debt/TVL, LP compositions and external versus internal claims, shortfalls and junior capital/eligibility. Keep independent coverage null until reconciled; TVL/debt is not independent backing. Convert junior sDOLA units using a measured rate.

Take DOLA primary PSM measurement ownership if accepted; explicitly confirm or report why it cannot be accepted. Identify the current app PSM separately from older documented deployment; read reserves, DOLA inventory, fees/controller and simulate an ordinary holder sale read-only. Distinguish missing approval from exhausted reserves. Publish the DOLA-specific presentation blocks in the attached contract.

Measure fresh Ethereum DOLA→USDC routes from a small reference through 10K, 100K, 1M, 1.5M, 2M, 3M and 5M where supported, refine crossings with the existing method. Publish generic `input_amount` per rung (DOLA units), output USDC, raw amounts, separate face-value/size/marginal costs, timestamps, failed rungs and route evidence. Reuse the standalone ladder envelope consumed by `exitLadderOverlay`; no `input_frxusd` field for DOLA. Proposed cadence: hourly base/peg/PSM, three-hourly ladder; confirm actual scheduler. No trades or approvals.
