# FXSave delivery plan — 2026-10-21

User authorized planning the external handoffs and proceeding with the dashboard.
User explicitly authorized dispatch and coordination on 2026-10-21.
Dispatch receipts and returned work are tracked in FXSAVE-dispatch-status-2026-10-21.json.
No live registration, scheduler activation or publication has been performed.

| Owner | Handoff | Required return |
|---|---|---|
| PegTracker | [Vault producer](FXSAVE-pegtracker-2026-10-21.md) | Recurring pinned-block snapshot, both payout legs, custody reconciliation, history, failure clocks and cadence |
| DexTracker | [Executable exits](FXSAVE-dextracker-2026-10-21.md) | Direct and fxUSD exit ladders, matched route costs, brackets and independent timestamps |
| RiskAnalyst | [Scores and overlays](FXSAVE-riskanalyst-2026-10-21.md) | Reconciled six-axis mapping, pending-score review and fxSP coverage policy |
| tidresearch | [Report alignment](FXSAVE-tidresearch-2026-10-21.md) | Corrected report, score provenance and verified staging status |

PegTracker and DexTracker can begin independently, then coordinate basket/quote
clocks for matched exits. RiskAnalyst finalizes the liquidity/overall review once
the new depth is available. tidresearch aligns to the resulting report revision.
A new security review is not commissioned: retain the existing authority walk
with its original date and explicit incomplete audit coverage.

Implemented locally:
- Shared producer/consumer contract: `specs/fxsave-feed-contract.md`.
- Dated report-snapshot preview: `previews/fxsave/index.html`.
- Consumer renderer and application routing hook: `js/renderers/fxsave.js`.
- No FXSave entry in the serving asset registry and no dated fixture in `data/`.
- Historical plan/backlog marked with the two-output decoding correction.

Next integration steps:
1. Validate delivered candidates against the contract, without changing clocks.
2. Add a strict transport adapter with identity, schema and two-output validation;
   keep serving-file writes conditional on complete validation and last-good handling.
3. Merge authored overlays, reconcile unavailable scores, and exercise the full
   six-axis application with real producer files. Do not fabricate missing scores.
4. Register FXSave, verify recurring refreshes and report links, and publish the
   completed dashboard through the existing repository workflow.

Validation completed: FXSave renderer invariants, existing scrvUSD/sfrxUSD
renderer checks, JS syntax, whitespace check, and browser preview at 1280px and
390px (six panels, correct basket, no JS errors or horizontal overflow).

To preview locally: serve the repository with `python3 -m http.server 8876
--bind 127.0.0.1`, then open `/previews/fxsave/`. The report fixture is rounded
and dated; it is not a current market quote or producer feed.


## Completed review integration

All four deliveries, including DexTracker hardening and RiskAnalyst's final
producer evidence review, are complete and recorded in the coordination ledger.
The original prose-style preview has been replaced at `previews/fxsave/` by the
actual shared application template with six axis tiles, exit-profile chart and
19 measured-size comparisons. It reads validated producer measurements and pinned
RiskAnalyst overlays under `previews/fxsave/data/`; no production `data/` or
serving asset registry is modified. Regenerate with
`python3 tools/prepare_fxsave_preview.py`. This is an isolated review snapshot,
not an installed consumer sync job. Producer refresh jobs are installed separately.

Dependencies remains deliberately unscored. All numeric assessments remain dated
and under review after evidence review. Par token marks, coarse quote brackets,
separate observation clocks and gas exclusions remain visible. Production
promotion and recurring consumer transport are not yet installed.


October 22: renderer/spec audit remediation is complete in the review dashboard.
See `specs/fxsave-dashboard-remediation-2026-10-22.md`. The existing hourly sync
now regenerates the isolated preview; serving asset registration/publication is
still unchanged. Authority topology, declared history gaps, backing history,
incremental-impact depth, venues and dependency links are covered by explicit
browser specification checks, including failure states.
