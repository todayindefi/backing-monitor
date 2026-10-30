---
title: GHO standard dashboard correction — coverage history and layout
date: 2026-10-30
status: Corrected staged preview; browser acceptance passed; unpublished
---

The earlier GHO implementation did not satisfy the standard. It showed a
coverage figure without the required coverage-history chart (§4.0), and left
supporting reconciliation as a long default-visible panel stream instead of
the scan-first presentation required by §9. A shared six-axis header alone
was not sufficient conformance.

This correction follows `six-axis-dashboard-spec.md` §§2–4, 4.0, 4.1, 8 and 9
and `renderer-design-rules.md`. It reuses the existing common renderer and
styles; it introduces no new visual system or backing score.

| Standard element | Selected implementation / verification |
| --- | --- |
| Six axes in standard order | Existing shared frame and summary cards retained |
| Peg tiles, then price chart | Existing Peg Performance panel; cross-source observation placed in the fourth tile; full clock evidence remains available |
| Collateral ratio history | Existing `#chart-panel` / `#cr-chart`, rendered by `CommonRenderer.renderCRChart`; source-qualified ratio, percent scale |
| Same peg and coverage horizon | Both use `peg.chart_window_days = 7`; sparse windows do not silently widen |
| Actual retained observations | 1,203 daily observations, 2023-07-15 through 2026-10-29; every ratio checked against its own numerator and denominator |
| Date precision | Source daily date retained; midnight UTC is only the chart coordinate, never a claimed observation instant |
| Clipping disclosure | Shared stats line states six readings in the current seven-day cutoff out of 1,203 retained; latest source reading is labelled as such |
| Backing summary | Ratio, pro-rata collateral, same-day source denominator and separately scoped origin supply immediately above the chart |
| Composition table | Shared breakdown renderer; source asset categories, source date and basis caption |
| Allocation chart | Shared pie renderer; six mutually exclusive categories partition the pro-rata collateral numerator |
| Exit quotes | Standard `liquidity.exit_mark` supplies the shared ladder and ≥$100k observed floor; chip states floor, not a measurement, plus scope and quote clock; crossing and primary redemption remain unmeasured and the axis remains Not rated |
| Supporting evidence | Full prior reconciliation tables and producer basis strings retained inside labelled disclosures under their original axes |
| Material limits visible | Source-valuation qualification, recorded reserve deficit and unresolved residuals remain default-visible |
| Missing-data states | Current dependency, contract/admin and issuer gaps remain explicit; no invented scores or issuer summary |
| Responsive rendering | Mobile table scroll containers and wrapped chart stats; no horizontal page overflow, including expanded evidence |

The six-category allocation is TokenLogic's pro-rata oracle collateral, not
all assets backing GHO and not a partition of supply. Its total is
$468,870,214.15822566 on source date 2026-10-29. Separate GSM inventory is
excluded. Independent liquidation coverage remains unrated.

Producer exporter: `/home/danger/PegTracker/gho_coverage_history.py`.
Staged source directory:
`/home/danger/PegTracker/data/dashboard_pending/gho-coverage-history/`.
The generator records source response hashes and checks all 1,203 daily
ratios. It rejects duplicate/mismatched dates, inconsistent ratios, invalid
values, empty history and potentially truncated responses. The consumer checks
manifest integrity, source identity and agreement between the latest chart
point and displayed snapshot before selection.

`prepare_gho_preview.py` now defaults to the reviewed backing reconciliation
and coverage-history sources. A normal rebuild retains the chart. Script cache
token `gho.js?v=20261030c` makes the corrected renderer a new browser resource.
The existing canonical independent-coverage fields remain null; source history
is transported under `reported_collateral_ratio` and mapped only for display.

Validation:

- Producer coverage-history tests pass, including invalid/truncated/duplicate
  source cases; consumer projection tests pass.
- Actual browser charts contain the expected source values at the shared
  seven-day cutoff. The source scale is 153.76%, not 1.5376% or 15,376%.
- Desktop 1280px and mobile 390px pass in light and dark mode. Both standard
  charts, the standard breakdown and allocation render; evidence remains
  reachable when opened, with no page overflow.
- A missing peg file leaves coverage available. A missing coverage file shows
  an explicit fetch-failure state while retaining the latest snapshot.
- A simulated future date with fewer than two recent observations makes both
  histories insufficient; neither silently falls back to the full archive.
- Default-visible evidence excludes the detailed reserve-book tables, but the
  recorded deficit remains visible. Expanded evidence checks confirm the
  original values and full source rationale remain present.

Rebuild and inspect:

```bash
python3 tools/prepare_gho_preview.py --state /tmp/gho-state-refresh.json --report-check /tmp/gho-report-verification.json
node tests/test_gho_browser.cjs
```

Preview: `http://127.0.0.1:8891/?asset=gho`.
Frozen review: `specs/reviews/gho-dashboard-2026-10-30/standard-history-layout/`.
No public registration, report score, deployed site or schedule changes are
part of this correction. Current authored assessments remain outstanding.


Axis 3 follow-up: the original renderer appended a display-only ladder and
hardcoded the summary to “Depth not measured”. The preview adapter now maps
those same PegTracker quote samples into `liquidity.exit_mark`, preserving their
signed impact, source, Ethereum scope and own observation clock. Shared depth
logic derives the ≥$100k floor at 50 bps; no scalar crossing is invented.
`primary_redemption_depth_status: not_measured` keeps the numeric score withheld
without claiming that redemption is gated. The bespoke duplicate ladder was
removed. The summary explicitly says “floor, not a measurement”. Quotes remain
the existing 2026-10-30T04:30:37Z samples, not a new market refresh.

Consumer tests verify quote mapping and missing primary execution. Browser
checks verify floor, clock, scope, unrated status, one ladder, correct USD
notional basis, four responsive/theme layouts and existing chart failure
states. All pass. Frozen follow-up: `specs/reviews/gho-dashboard-2026-10-30/liquidity-floor/`.


Adaptive ladder follow-up (2026-10-30): the five-normal/seven-maximum request
policy is now specified fleet-wide as the target contract. Standalone
PegTracker `adaptive_exit_ladder.py` is installed with unit tests and a staged
GHO output; the regular fleet collector/cron remains unchanged. The preview
adapter defaults to that selected artifact, verifies identity and budget and
checks that bracket endpoints are actual quotes on opposite sides of 50 bps.
An invalid/unmeasured candidate is rejected rather than replacing the preview
with a fabricated crossing. Source evidence is copied with a hash into the
selection manifest. Explicit `--ladder` supports another reviewed artifact.

Live run: seven KyberSwap requests, 2026-10-30 06:56:18–06:56:33 UTC. The
$22,360,680 sample clears at 20.7321 bps, while $33,437,015 costs 974.3896 bps.
The displayed range is the unresolved crossing bracket, not an exact 50 bps
quote. The run's clock starts at 06:56:16 UTC; every rung has its own response
clock. USD sizing uses the recorded $0.99850861 mark whose upstream update
clock is unavailable. Gas excluded; primary redemption/eligibility unmeasured;
score remains Not rated. No immediate second batch was used to circumvent the
seven-request cap.

Tests: adaptive algorithm (five tests, including multiple market depths,
errors, cap floors, fresh/stale warm starts and non-monotonicity); existing four
consumer tests; real-browser four layout/theme variants plus history failure
states. The current review archive is `adaptive-50bps/`. Remaining fleet
integration and DexTracker alignment are in
`specs/handoffs/adaptive-exit-ladder-2026-10-30.md` (repository handoff, not dispatched).
Renderer cache token: `gho.js?v=20261030d`.
