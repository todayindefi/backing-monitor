# Staging dashboard promotion review — November 10, 2026

No new staging-only dashboard is ready for immediate promotion unchanged. Review criteria: six substantive axes (not six headings), each value's basis/clock/scope, explicit unknowns, authored/computed score distinction, actual rendered charts, source-to-DOM coverage, scan-first prose and usable desktop/mobile light/dark views. An unmeasured quantity is acceptable when its reason and consequence are clear; a favorable score is not a publication gate.

## Priority

1. **BOLD: worth adding to the production dashboard directory.** The dashboard and report are already production; this is a discovery/registration omission rather than a new page promotion. Actual charts, branch health, debt reconciliation and separated market/redemption exits render clearly. FrxUSD and sfrxUSD are also already production but need diagnostics/prose cleanup before a complete clarity sign-off. scrvUSD needs mobile exit-table repair.
2. **Re pair: strongest next draft release after repairs.** Fresh backing/API metrics and Security observations, original source clocks, combined-reserve limitations and the separated exit ladder are substantial. Mobile venue tables currently break names into single letters. Remove unread eligible-sleeve diagnostics by deliberately rendering or documenting the field; complete the paired report/dashboard link and release gate. Current production reports are 404. Do not claim complete cash execution or tranche-specific backing.
3. **Alto DUSD: next editorial pass.** Six substantive axes distinguish unknown external collateral valuation, nominal credit-line LP marking and measured liabilities. Six default-visible paragraphs exceed 240 characters; issuer/route detail needs disclosures without hiding limitations. Dense supporting tables need a readability check. Retail report remains staging-only.
4. **fxUSD: finish financial rendering first.** Production report exists, but the staged monitor does not adequately expose per-pool CRs, supply/debt residual and Stability Pool concentration already present in normal data. Actual CR chart has one aggregate series. A live report does not close the dashboard completion plan.

## Hold the six staging-only hub entries

| Dashboard | Material blocker |
|---|---|
| OUSD | Empty peg and exit tiles; no published admin-control facts; outside-axis panels and provisional report |
| USDD | Same substantive gaps; mobile page 517px at 390px |
| cUSD | Same substantive gaps; no report; mobile page 505px at 390px |
| yzUSD / syzUSD | Normal base last assembled Nov 4 23:03:28UTC (~127 hours), reserve Nov 4 and strategy Nov 3. Plasma identity conflicts with legacy Ethereum/Monad grading labels. Parser completeness is not verified backing or cash settlement |
| BMNR | Separate TradFi monitor, not a six-axis token candidate; treasury constant 169 days old despite current assembly |

The two hosts proxy the same BM application. A staging hub tile or HTTP200 is not a distinct complete candidate, and the SPA can200 unknown slugs. BOLD/frxUSD/sfrxUSD/scrvUSD already have published BM registrations and live production reports but no hub tile. GHO/Avant/fxSAVE local or frozen preview artifacts are not new live production-ready registrations. No scores, research snapshots or publication flags were changed.

## Evidence and checks

- `hubs.json`: real browser comparison (28 staging tiles, 22 production tiles).
- `browser-audit.json`: 28 rendered cases, 1440/390 pixels, light and dark; zero JS page errors. Both themes preserve USDD/cUSD overflow; zero page-wide overflow elsewhere does not establish table readability.
- `detail-audit.json`: real Chart instances/dataset sizes, full public DOM text and production report status. No assumed charts from canvas presence.
- `source-audit.json`: 14 public base-file hashes, retrieval clock and nested original source clocks. These are independent observations of moving normal feeds, not a claim they all share one pin. Historical authored assessment clocks remain historical; fresh assembly does not refresh underwriting or authority evidence.
- Screenshots include default views and mobile backing/liquidity/authority/issuer sections. BOLD branch health, Re's mobile venue table, scrvUSD's vertically wrapped exit table and Alto's issuer prose were visually inspected.
- Intermittent proxy 503s and optional 404s are preserved in browser evidence. They are not asserted to be producer failures or proof of absent contracts. Required missing/empty states were assessed from the rendered page and available normal fields, not response status alone.
- `check_feeds.py`: 6 failures/48 warnings before; four stale script cache tokens repaired, leaving only the two Yuzu freshness failures. **Not a global pass.** PegTracker confirmed a recurring missing-venue IndexError (`swap[0]` on an empty list), with 127 failed batches since November 5 retaining both old outputs; this is not an intentional snapshot. See yuzu-producer-status.json. No financial collection, recurring jobs or transactions were run.

Cache-only repair advances DUSD/MSTR/STRC/USDai script URLs to 20261110-review so returning browsers fetch the existing committed renderer. The unrelated local GHO/shared-frame/Ethena edits remain excluded. User's preceding MSTR work was already committed/pushed before this audit.
