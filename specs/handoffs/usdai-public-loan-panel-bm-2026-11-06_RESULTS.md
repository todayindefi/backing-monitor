# Public sUSDai loan/repayment panel — November6

User requested commit/push of the completed loan evidence work and more dashboard loan/repayment data. Evidence tooling/handback committed and pushed as **14ad35cfba**. Its private captures/package remain ignored and unchanged.

The new panel uses a separate explicitly allowlisted projection of public issuer API responses. Policy: `config/usdai_loan_dashboard_publication.json`; producer: `tools/refresh_usdai_loan_dashboard.py`; output: `data/usdai_loan_evidence.json`. The private assessment package, canonical private profile, borrower addresses, precise locations, holder data and the separate Entropy addendum are excluded. This authorization does not convert the whole private evidence package into public data.

## Panel behavior

- sUSDai Backing receives visible record count/principal, larger issuer aggregate and partial-population concentration, with the unreconciled scope difference explicitly distinguished from loss.
- Largest five loan records are visible; all21 API-active records, reported APRs, last scheduled due dates and original schedule-cache dates are available in a labelled disclosure. Six other-status records are excluded from active principal. Record labels are publisher labels, not legal borrower/offtaker identification.
- Next30days scheduled principal/interest are separate from reported repayment events. Schedules are not receipts or guaranteed income. Both source calculation times and window bounds remain visible/available.
-30/60/90day reported event totals retain the warning that zeros are not proof of no payments. The June26 last-positive-event date is shown separately from the November6 computation date. No due-to-receipt, DPD or default all-clear is inferred.
-0/28 liquidation-event incidence is kept in definitions, labelled as a narrow event metric rather than a general default/arrears rate. Funded DSRA, current independent GPU valuations and receipt matching remain unverified.
- USDai's separate PYUSD reserve model is not relabelled as direct ownership of this loan book. No scores, grades or Entropy-derived claims added.

Selected public export SHA256 **e04ec9c0bb04d0d2522c5440cee5caa1f254afe0655983453bd68ff106bdf8f6**. Loan snapshot computation **2026-11-06T08:20:20UTC**; future schedule source **08:11:10UTC**; schedule-cache dates and repayment computation clocks remain separate. This is a dated one-off observation, explicitly not a continuously refreshed credit monitor. No new recurring job installed.

The producer can project already captured public responses after URL/status/hash checks. A manual refresh uses `--fetch` with a **new** private capture directory, the existing approved endpoint/field policy and the same output filename. It does not contact issuers, use credentials, run trades or query paid services. It never reads/exports the private assessment snapshot; only allowlisted public HTTP source files are consumed.

## Checks and limitations

Six public-projection tests and nine private evidence tests pass, plus the USDai/sUSDai renderer suite. Checks cover units, source clocks, rejected URL/hash mismatches, allowlisted record fields, exclusion of borrower/location data, uninitialized records, signed comparisons, explicit gaps, numeric-string formatting and safe text rendering. JavaScript syntax/whitespace checks pass.

**Desktop/mobile visual QA remains blocked:** the browser tool again returns no connected browsers/apps. No screenshots, chart appearance, overflow or visual conformance pass is claimed. Source/HTTP hash verification after push is distinct from visual verification.

The separate user-requested Entropy/Dune inspection remains a private bounded addendum with inaccessible SQL/result lineage; none of it is included in this panel. No independent credit judgment or current financial assurance is created by publishing more issuer data.
