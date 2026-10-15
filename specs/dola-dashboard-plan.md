---
title: DOLA dashboard — producer ownership and build specification
repo: backing-monitor
date: 2026-10-14
status: Reconciled producer artifacts and local browser preview checked; awaiting publication review
---

# Scope and authority

Build a six-axis dashboard for Ethereum DOLA, token
`0x865377367054516e17014ccded1e7d814edc9ce4`. Remote deployments appear as separately
qualified observations, without implying verified bridge backing or local exits.
sDOLA and jrDOLA are distinct assets; neither gets a dashboard through this spec.

Follow [the six-axis standard](six-axis-dashboard-spec.md),
[Axis 5 contract](axis5-contract-admin-spec.md), and
[renderer rules](renderer-design-rules.md). Primary measurements belong in their
producer repositories. backing-monitor owns transport, presentation and verification
of the rendered result, rather than a new DOLA backing analyzer.

Research baseline: `/home/danger/riskAnalyst/assets/dola.md`, revised October 14,
and its six linked `data/research/dola-*-2026-10-14.json` evidence files.
The written adaptation is `/home/danger/tidresearch/src/content/reports/dola.md`.
The initial inspection found `production: false`; TIDR's return now confirms prior
owner-approved publication in `83edb86`. Report and dashboard states are separate.
These research artifacts are historical inputs, not scheduled feeds.

# Producer ownership

| Axis or part | Producer repository | Producer output | Responsibility |
| --- | --- | --- | --- |
| 1 Peg / Stability | PegTracker | `data/dola_backing.json` → `peg`; `data/dola_peg_history.json` | Market price against $1, price source, observations and history coverage |
| 2 Backing | PegTracker | `data/dola_backing.json` → `backing` and asset detail; `data/dola_backing_history.json` | Supplies, FiRM debt and collateral, LP look-through, bad debt, junior capital and reconciliation |
| 2 Editorial qualification | riskAnalyst | `data/axes/dola_backing_overlay.json` | Coverage interpretation, first-loss limits and eligible authored assessment |
| 3 Executable secondary exit | PegTracker | `data/dola_exit_ladder.json` | Live DOLA→USDC ladder, routes, cost conventions and crossing/bracket |
| 3 Venue inventory | DexTracker | `data/liquidity/dola_liquidity.json` (`liquidity/1`) | Venues, verified size, exclusions, chain coverage and enumeration completeness |
| 3 Primary PSM exit | **Proposed: PegTracker; assignment pending** | Block in `data/dola_backing.json` | PSM identity, reserves, inventory, fees, eligibility and read-only sale simulation |
| 4 Dependencies | riskAnalyst | `data/axes/dola_dependencies.json` (`dependencies/1`) | External failure paths, backing versus venue edges, resolution and coverage limits |
| 5 Authority observations | security_analyst | Committed `topology/assets/dola.yaml` | Validated authority paths, reach, threshold, delay, floor and unresolved topology |
| 5 Code assessment and combined score | riskAnalyst | `data/axes/dola_contract_overlay.json` (`contract-overlay/1`) | Implementation/audit interpretation and combined structural judgment |
| 6 Issuer | riskAnalyst | `data/axes/dola_issuer.json` (`issuer/1`) | Entity, governance, incident and repayment history, recourse and issuer judgment |
| Cross-axis editorial basis | riskAnalyst | `data/axes/dola_axis_basis.json` (`axis-basis/1`), where applicable | Assessment basis, provenance and provisional status; no override of measured bands |
| Written report | tidresearch | `src/content/reports/dola.md` and linked evidence | Written assessment, staging review and report publication status |
| Integration | backing-monitor | `data/` serving copies, `js/renderers/dola.js`, registry and script wiring | Sync, merges, axis layout, source clocks and visible-state validation |

Axis 3 has no single repository owner under the current standard. The PSM
assignment above is a DOLA-specific proposal, not an agreed fleet-wide resolution.
Until assigned and integrated, display primary redemption as not integrated;
do not substitute a venue producer's statement or a static research snapshot.
security_analyst owns observations, not prose scores. `tools/emit_axis5.py`
generates `data/dola_contract.json` here from an eligible committed hand-walk.
An uncommissioned or absent walk must remain explicitly unassessed.

# Initial inventory (superseded by producer returns)

Checked the configured producer directories on October 14:

- riskAnalyst has `data/axes/dola_dependencies.json`. Its envelope is October 1,
  but `collateral_as_of` is July 1. Refresh its evidence and dependency model before use.
- No DOLA base/history/ladder feed was found in PegTracker's `data/` directory.
- No DOLA venue feed was found in DexTracker's `data/liquidity/` directory.
- No DOLA topology file or other DOLA axis overlay was found in the inspected
  security_analyst and riskAnalyst producer directories.
- October 14 research contains API snapshots, state, source matching, quotes
  and partial authority reads. Convert these methods into repeatable producers;
  copying the evidence into a live feed does not make it current.

# Measurement and display contract

Use existing axis schemas and merge behavior. Each observation carries its
producer, identity, source, measurement time, units and basis. RPC reads also carry
chain and block; API reads carry request time. Generated/sync time never replaces
measurement time. New DOLA detail fields require a producer-consumer schema agreement
before implementation; field lists below specify semantics, not an invented schema.

| Axis | Required detail and rendering |
| --- | --- |
| 1 | Price and deviation from $1; history coverage/gaps. Separate observed peg behavior from peg-mechanism assessment. Do not assert uninterrupted historic par without a reconstructed series. |
| 2 | Ethereum total supply, issuer-defined circulation and their definitions; FiRM debt and oracle TVL; per-market debt and debt share; LP external/internal components; Frontier/FiRM shortfalls; junior assets converted from sDOLA to DOLA and market eligibility. |
| 3 PSM | Current app contract and older documented contract distinguished; reserve asset and reserves; DOLA inventory; fees and eligibility; simulation input, method, block and failure cause. Empty reserves, missing reads and failed simulations are different states. |
| 3 Ladder | Successful and failed rungs, quote window, route details and expiry limitations; face-value discount separately from incremental size impact; gas inclusion stated. Use existing producer crossing methodology, not browser interpolation. |
| 3 Venues | Independent enumeration clock, custody verification, excluded/implausible rows, truncated/unqueried chains and local-dollar-exit coverage. Secondary venue TVL is not executable depth. |
| 4 | Ethena/sUSDe, Curve, Convex, Yearn and other evidenced strategies/oracles/bridges; distinct backing and venue edges where both apply. DOLA inside DOLA collateral is an internal claim, not an independent upstream dollar reserve. |
| 5 | Token operator and direct mint reach; governance delay and enforceability; Fed chair; LP oracle switch/pause; shared signers; remote authority uncertainty. Separate mainnet/core paths from pool and bridge paths. Link audits only to identified deployed components. |
| 6 | Inverse Finance DAO; historical deprecated-product incidents distinguished from sampled FiRM code; repayment record; governance concentration; ordinary holder recourse and evidence limits. |

All custom panels belong under their corresponding axis. The default view shows
decision-changing findings and unresolved states; evidence and lengthy methods use
labelled disclosures. Warnings update from producer fields, not frozen report prose.

# Accounting and scoring invariants

1. Never present FiRM oracle TVL/debt as verified independent DOLA backing coverage.
   Until internal claims, excess borrower collateral, realization costs and bridge
   custody are reconciled, `collateral_ratio` must remain null with its producer basis.
2. Debt-source shares are not reserve weights. The October 14 96.37% DOLA/sDOLA LP
   debt share and 76.52% Ethena-linked debt share describe loan sources/dependencies.
3. Internal DOLA can cancel debt; it cannot simultaneously count as an external
   reserve. Self-referential collateral alone does not establish insolvency.
4. Do not sum remote supply into Ethereum supply without custody reconciliation.
   Do not equate issuer-defined circulation with token total supply.
5. PSM DOLA inventory supports the opposite swap direction; it is not USDS capacity
   available to DOLA sellers. Fees and access alone do not establish executable exit.
6. Junior vault units are sDOLA. Convert with a dated rate and retain coverage
   eligibility and activation times. Capital is not unlimited protocol insurance.
7. A falling bad-debt percentage from supply growth does not establish repayment.
8. Quotes are estimates, not executed fills. No absent or failed quote becomes zero
   liquidity; no successful largest rung becomes a precise maximum exit.
9. Research scores remain provisional editorial judgments. Do not calculate overall
   as a mean or relabel a market peg band as the report's mechanism score. Authored
   overrides require the standard's declared-impossibility basis. Dependencies stay
   unscored in the dashboard unless its fleet-wide convention changes.

# Refresh and failure behavior

Proposed initial schedules, to be confirmed by each producer: hourly peg/backing/PSM
reads; three-hourly exit ladder under PegTracker's existing ladder cadence;
daily venue enumeration if provider budgets allow, with its own declared cadence.
Editorial overlays and authority walks refresh on relevant changes and explicit
review, rather than acquiring fresh timestamps through sync.

Preserve the last successful snapshot on collection failure, expose last attempt
and stale status, and keep observation clocks separate per block. A partial run
must identify missing components; it must not present mixed-age measurements as
a single pinned-state balance sheet. Archive successful peg/backing observations.

# Implementation sequence and acceptance

1. Confirm the DOLA PSM assignment and producer field/schema agreements. This spec
   records required work; no producer has been dispatched or claimed completion.
2. PegTracker implements the base feed including `peg` (required for the six-axis
   frame), backing/history and exit ladder. Validate research reproduction and
   successful, partial and failed collection behavior.
3. DexTracker produces venues; riskAnalyst refreshes dependencies and supplies
   eligible overlays and score bases. Commission a security_analyst walk through
   the established workflow if authorized; otherwise show the coverage gap.
4. backing-monitor builds `dola.js` and connects existing shared axis rendering.
   Test locally with explicitly staged inputs before registry changes. Confirm
   each file is reachable through the actual sync roots and suffix allowlist.
5. Keep unapproved payloads outside sync roots (e.g. `data/axes_pending/`). Registering
   DOLA enables automatic transport of published files; registration and scheduled
   sync are publication-relevant steps. Preserve staged report status, and verify
   its URL before adding a link. Promote after concrete dashboard/report review.
6. Run meaningful feed/merge checks and verify the rendered page: correct units,
   denominations and clocks; null versus zero; all six axis sections; unresolved
   backing; empty PSM; junior activation state; failed ladder rungs; venue exclusions;
   absent topology and staged report label. Then verify the deployed URL with
   `tools/visible_text_check.js` and actual visible boxes after approved deployment.

Finished means each required block is either sourced and visible or explicitly
unmeasured with its reason; recurring measurements have a working schedule and
failure state. Remote bridge reconciliation and complete historical peg coverage
may remain open only when their limits are visible and no dependent claim is made.

# Local implementation state (October 14)

`js/renderers/dola.js` implements the additive accounting, junior-capital and PSM
panels in [the proposed feed contract](dola-feed-contract.md). It preserves shared
axis bodies. The renderer is wired into `index.html` and `js/app.js`; the standalone
ladder adapter accepts generic `input_amount` while retaining frxUSD compatibility.
`node tests/test_dola_renderer.js` checks absence, null versus zero, units, escaping,
producer activation states and both ladder input formats.

Five `specs/handoffs/DOLA-*-2026-10-14.md` files are ready for manual delivery to
PegTracker, DexTracker, riskAnalyst, security_analyst and tidresearch. Send this spec
and `dola-feed-contract.md` with them. No dispatch occurred. DOLA remains unregistered;
no live feeds, scheduled collector, deployed verification or promotion is claimed.
Integration resumes when producer outputs and agreed schemas return.

All five producers have now returned. See
[the readiness review](dola-producer-review-2026-10-14.md) for merge checks and the
remaining stale authority-coverage statement in riskAnalyst's pending overlay.
PegTracker accepted DOLA PSM ownership. No DOLA dashboard registration or pending
overlay publication has occurred.

RiskAnalyst's reconciliation has now returned, and local desktop/mobile plus
missing-feed browser checks pass. See [the preview review](dola-preview-review-2026-10-14.md)
and `tools/prepare_dola_preview.py`. The pending overlays remain unpromoted;
the actual dashboard registry remains unchanged.
