# Re backing metrics display review

The existing reUSD/reUSDe backing sections now distinguish Re's issuer-reported capital and receivables from Ethereum marked token claims and the differently scoped DeFiLlama adapter TVL. No coverage ratio or current loss cushion is inferred.

PegTracker's existing normal producers provide `backing.issuer_reported_metrics`, schema `re_issuer_metrics/1`. A durable two-asset configuration enables the additive hook without new jobs. Source failures are independently visible; any last usable metrics retain their original dates. The original core values, financial timestamps, DeFiLlama observations and authored scores were preserved on initial attachment and independently compared by BM.

Selected source: https://app.re.xyz/metrics . Reporting date November9 00:00UTC; retrieval01:16:32UTC; individual chain observations01:15:54UTC. These are source reporting/retrieval clocks, not independent insurance valuation dates. Receivables, current contractual first loss, tranche-attributed coverage and collectibility remain unverified. Constant receivable series is explicitly flagged. No displayed APY or cash-yield-paid claim is inferred from source fractional series.

Producer enabled manifest SHA256 `d671f553b23e6df3e1323aa3846ecf37dbf838e49b2482d79c4b5350d36ef685` covers25 frozen files. BM's private version is `sha256:b19f14e7ee2f312b27e063337b2658a8fa7fc6ed6f11391be59083f7c12943bb`. The private producer/source packet is not published by this change.

Local clean-release Chromium checks cover both assets at1440/390: interactive30/90-observation charts, visible source qualification, retained claim blocks, separate collapsed adapter TVL, no page overflow or JS errors. Failure tests cover dated last-usable and completely unavailable supplemental source while retaining original claims. Node tests cover unknown/null/schema/mismatched component data, provenance and escaping. Peg reports28 producer tests passed; no full fleet suite or new authority/credit audit is claimed.

Changed implementation: `js/re-protocol-metrics.js`, `css/re-protocol-metrics.css`, the two existing normal backing files and narrowly scoped index script/style loading. Other dashboard code and source scores remain unchanged. Existing report publication/registration status is preserved. Served verification receipts are recorded alongside after deployment.
