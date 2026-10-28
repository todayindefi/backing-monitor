# syrupUSDT — BM → TIDR completion, October 28, 2026

Status: completed; public HTML and deployed renderer verified at 2026-10-28T15:22Z. Original dispatch is `riskAnalyst/specs/handoffs/syrupusdt-dashboard-report-sync-2026-10-28.md`.

## Delivered

- BM `55c4f4da71`: remove book-wide borrower/CR fallbacks from loan-only status and qualify all-position concentration text.
- BM `b47630ec66`: sync corrected common backing/family snapshots from PegTracker; consume explicit credit coverage, withhold incomplete ratios and non-additive supply shares. Authored syrupUSDT axis basis/contract/issuer inputs already matched their riskAnalyst sources.
- BM `8ebf286c8a`: archive the actual corrected public files and derived metrics, expose mixed family definitions, and label incomplete scope without implying classification is still pending.
- TIDR `5fc43c7`: apply prepared report candidate, then update superseded financial paragraphs and tables from the corrected served inputs. Replace internal tool names with public source descriptions and remove wording rejected by report checks. Publish only `src/content/reports/syrupusdt-retail.md`.

Public destinations: [dashboard](https://todayindefi.github.io/backing-monitor/?asset=syrupusdt), [report](https://tidresearch.com/reports/syrupusdt/).

## Evidence and definition break

The new immutable archive is [specs/reviews/syrupusdt-2026-10-28-corrected](../reviews/syrupusdt-2026-10-28-corrected/). Its manifest records actual serving URLs, retrieval clocks and SHA-256 hashes. A copy is saved in `riskAnalyst/data/reviews/syrupusdt-2026-10-28-corrected/`; the original pre-correction archive is unchanged.

Selected financial snapshot: `2026-10-28T15:03:04Z`; family: `15:03:39Z`; current quote: `13:32:15Z`. Canonical assets $318.67M; enumerated principal $312.76M, zero residual. New `issuer_economic_v2_2026-10-28` credit membership: seven records, five borrower addresses, $215.05M, top-3 91.80%, HHI 3089. Credit collateral ratio is unavailable because coverage is incomplete. Non-credit strategy principal is not immediately available cash.

All five documented chains are enumerated; remote representations are not added to canonical supply. Global sum, reconciliation ratio and chain-resident decomposition remain unavailable/incomplete. Family classification mixes reviewed USDT membership and legacy unreviewed USDC heuristics; no sibling remapping or re-score was performed.

History observations are not rewritten. The candidate's retained historical statistics remain explicitly pinned to its pre-correction archive ending 08:45:18Z; the current snapshot and current quote table use the newly served files. Historical classified diagnostics are not spliced into the corrected population.

Overall 6.0; displayed axes 8.5 / 6.0 / 6.0 / 4.0 / 4.5 / 5.5. Legacy Redemption 6.5 remains outside the six-axis display. Public last_verified September 6; last_revised October 28. No fresh authority/hook inspection or timed redemption is claimed.

## Verification

- `node tests/test_syrup_scope.js`: missing companions, explicit zero, incomplete credit coverage, family scope and unavailable multi-chain shares.
- `python3 tools/verify_syrupusdt_corrected.py`: hash manifest, exact credit members/principal, recomputed concentration, incomplete coverage, non-additive five-chain supply and unchanged peg/ladder selection.
- Original riskAnalyst evidence, report consistency and overlay checks passed against the preserved original evidence; these do not certify corrected economic classifications independently.
- TIDR `npm run build`: full prebuild validation and 95-page build passed after the report corrections.
- Actual public report HTML checked for all six body headings, sidebar scores, dates, corrected metrics and absence of internal service names/stale completion claims. BM live index cache token and renderer bytes match final code. Result: `live-publication-check.json` in the corrected archive.
- Browser inventory was empty, so visual viewport QA was unavailable; HTML checks are not claimed as visual rendering verification.

Unrelated existing FXSave, sync-log, sfrxUSD report and dashboard-hub edits were left out of the targeted commits. Normal hourly BM sync continued separately.
