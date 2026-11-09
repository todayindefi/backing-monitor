# Re metrics backing-section adoption — BM served return

User requested checking re.xyz metrics and improving the existing backing section. Updated both existing reUSD/reUSDe views; no new page, score, registration, RiskAnalyst assessment, TIDR publication, transaction or recurring job.

- reUSD: https://todayindefi.github.io/backing-monitor/?asset=reusd-re
- reUSDe: https://todayindefi.github.io/backing-monitor/?asset=reusde-re
- Deployment commit `569e96b95338f4a1f8df660ec7df8544abbb1d58`; GitHub Pages run42545347075 succeeded.
- Receipt `specs/reviews/re-metrics-2026-11-09/served-acceptance.json`; all five served file hashes match. Actual Chromium1440/390 checks pass for both assets, no JS errors/overflow;30/90-calendar-day chart controls and retained original claim blocks verified. Separate last-usable/missing-source browser states pass.

## Data and normal producer

PegTracker provided `backing.issuer_reported_metrics`, schema `re_issuer_metrics/1`, through both existing analyzer hooks. Durable `config/re_issuer_metrics.json` enrolls exactly these two assets; no cron, job or environment changes. Source failure remains independent of core financial data; current becomes null and any last usable document retains original dates.

Enabled producer manifest **d671f553b23e6df3e1323aa3846ecf37dbf838e49b2482d79c4b5350d36ef685**, all25 frozen file hashes independently verified. Private BM acceptance **sha256:b19f14e7ee2f312b27e063337b2658a8fa7fc6ed6f11391be59083f7c12943bb**, pointer `.private-reviews/re-metrics-dashboard-2026-11-09/packages/current.json`. Private source/research packet is excluded from publication.

Metrics reporting date **2026-11-09 00:00UTC**, retrieved **01:16:32.679293UTC**, chain observations **01:15:54.410–.693UTC**. These source/fetch dates do not establish original insurance ledger valuation periods or assurance-report dates. Underlying insurance valuation period, redemption-section valuation date, current contractual first-loss capital and tranche-attributed coverage remain null.

Reported components: onchain238.051799m +offchain250.367626m +premium receivables318.925958m =807.345384m. This is an **issuer-reported combined-program total including uncollected premiums**, not independent reserve coverage or liquid collateral. The unchanged receivables across91 daily observations are flagged; no daily revaluation, collection or aging proof follows. No cash-yield-paid claim is imported from issuer “Total Yield Paid.” Fractional pct card values are not guessed into APY.

Original core fields were compared deeply before/after attachment; only issuer_reported_metrics changed. Exact prior BM file hashes matched Peg's before hashes. Core timestamps preserved: seniorNovember8 23:01:12UTC, junior23:59:38UTC. Claim values, Ethereum supply/NAV, DefiLlama observations/composition, null ratios/current cushion and authored scores remain identical. Their own future normal producer updates retain independent source clocks.

## Display and limits

New data-gated shared helper shows three capital components and an interactive stacked history, original reporting date, uncollected-receivable qualification and collapsed definitions/source dates/gaps. Existing adapter TVL/composition is available separately under a clearly different source/perimeter disclosure. Totals are never added, divided into tranche claims or presented as like-for-like revisions. Existing claim-value block remains visible.

Current legal title/encumbrance, receivable collectibility/aging, overlap with trust collateral, complete liabilities, actual holder exit capacity, solvency and contractual loss cushion are not established. Issuer byAsset assignments and reserve/payout rows are source claims, not independent legal allocation or settlement. Prior Rea9bfe financial/documentary review and assessment clocks are unchanged.

Implementation paths: `js/re-protocol-metrics.js`, `css/re-protocol-metrics.css`, two normal Re backing JSONs, narrow index script/style loading, `tests/test_re_protocol_metrics.js`. Unrelated dirty common/app/styles/index changes were excluded from the scoped commit. Node failure/null/schema/provenance/escaping tests pass; producer reports28 focused tests. This is not a full fleet test or authority/backing audit.
