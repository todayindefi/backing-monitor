# Reserve Ethereum eUSD — maintained six-axis staging handback

Exact identity: Reserve Electronic Dollar, Ethereum chain 1, `0xa0d69e286b938e21cbf7e51d71f6a4c8918f482f`; Main `0x7697ae4def3c3cd52493ba3a6f57fc6d8c59108a`. Not Lybra eUSD. BM source branch `staging/eusd-product-2026-11-13`, commit `dea2160ebc`. Original main checkout and production publication remain unchanged.

Consumer: RiskAnalyst, after BM final served acceptance, for the new six-axis asset report and a user-forwardable TIDR asset-report staging handoff. This is separate from the already commissioned unscored Reserve architecture hierarchy. No automatic report dispatch or production promotion.

## Version and contracts

Frozen scheduled-run evidence: `sha256:9b3f88363c2dafa13e5aeb85408e4c52c067bf8f1a398e1c68b3a9d65feceeb9`. Local canonical pointer: `.private-reviews/eusd-runtime/shared/current.json`; immutable evidence under `shared/snapshots/`. Contract: `specs/shared-asset-evidence-v1.schema.json`, governed by `specs/shared-asset-evidence-contract.md` and `specs/shared-asset-evidence-ownership.md`. UI contract: `specs/six-axis-dashboard-spec.md`, particularly baseline manifest and acceptance.

All six evidence axes now contain selected observations. Authored RiskAnalyst scores/interpretation remain separate and pending; March 18's old 6.0 is not selected as current. Dashboard measurements are not substituted for authored grades. No family grade or architecture control is inherited.

## Selected clocks

- Financial/native allocation pin: Ethereum **26404118**, **2026-11-13 06:01:59 UTC**, hash `0x541281b5bac6e7ffa82997ca605465d23ccf77bd60e6219dd863e804bbda379e`. Backing read completed 06:18:02.382685 UTC; allocation and API retrieval clocks remain individually recorded.
- eUSD quote window: **06:18:03.356730–06:18:10.316464 UTC**. RSR rows retain their own requested/received times. Underlying aggregator route block is unavailable.
- USDC/USD oracle's own source timestamp remains separate from the quote and backing clocks; its raw round, precision, read block/hash and policy age are preserved in `accounting_reference`.
- Security pin: Ethereum **26403764**, **04:51:11 UTC**. Security collection/review 06:01–06:07 UTC does not change that source block. The scheduled refresh proved this pin stays unchanged.
- DeFiAnalyst: selected component export SHA256 `7f3ee6122dd69d43739e784951d6cb05da67a751e687473a51fdb3035cca0e1f`. Twenty facts/two entities retain individual source/effective/review clocks. Original/revised November proposals remain separately dated active observations, not assumed passed/executed.

## Six-axis content and limits

1. **Stability:** paired small indicative eUSD/USDC quote and accounting reference, signed deviation, conversion oracle and clocks, actual retained seven-day-window history. History is sparse since cutover; no invented week/month statistics. One selected eUSD quote provider; no independent second eUSD spot source.
2. **Backing:** registered backing-manager balances versus current basket requirements, supply scope, target weights separate from actual marked partition, one-layer receipt claims, separate RSR active/draft/remainder and three indicative sale probes. Plugin marks/basket-unit coverage are not independently recoverable backing; that value remains null. Own eUSD/RSR are excluded from external marked collateral. Underlying claims are not added again.
3. **Liquidity/exit:** protocol redemption throttle/state, basket delivery, receipt withdrawal and final cash remain distinct. Seven generic Kyber eUSD probes; 10/25/50-bps crossings are bracketed versus the small quote, separate from NAV cost, gas and fees. No transaction or execution simulation, wallet lookup, venue inventory or firm maximum capacity. All three RSR probes returned; they are not guaranteed stress insurance.
4. **Dependencies:** LMT's maintained reader binds five receipts; three Morpho vaults expose 31 native adapter-market references, 30 distinct markets and separately clocked 16/7/10 API positions. Whole-vault books/idle/residuals and eUSD's same-pin pro-rata claims are labelled separately. Shared ordinary exit market liquidity is not counted twice. API-only markets are not silently promoted to native inventory. No borrower-default/recovery or downstream-holder census.
5. **Contract/admin:** Security's 18 pinned runtime/verification-record comparisons, nine observations and seven explicit unsupported classes. Current owner timelock minimum is 72h, without an exclusive-role or universal-delay claim. Components remain upgradeable. Exact Morpho maxWithdraw/maxRedeem return zero by design; actual idle/adapter/gate paths are separate. Conditional RSR seizure includes active stake, drafts and rewards. Full protective-role/controller census, registry authorities, recursive upstream/library coverage, exact-version audit correspondence and executable exits remain unsupported.
6. **Issuer:** selected documentary facts/identities and source links; operator versus legal issuer/par-obligor distinctions and assurance gaps preserved. No issuer assessment/report is fabricated. Editorial section has no dashboard score; report link remains unavailable until RA/TIDR completes the asset report.

Current whole-vault stored-book residuals at the financial pin are **37.480084 USDC** (Frontier), **19.300103 USDC** (Prime), and **1,274.016473 PYUSD** (Sentora). These are explicitly unassigned, not established losses or merely rounding; books are stored-state estimates, not accrued valuations. They are not eUSD-owned amounts. No residual is declared reconciled.

Sentora's zero automatic liquidity adapter is an observed configuration, not a finding of zero assets or loss. Ordinary exit cannot automatically pull allocated positions; idle assets and separate deallocation conditions/penalties matter. Actual executable size remains unverified.

## Maintained producer and verification

One BM-owned job, `17 */2 * * *` on the UTC+08 host, invokes the accepted pinned Peg readers/quote adapter plus LMT's hash-checked reusable reader at the same financial block. No duplicate specialist job. Existing unrelated crontab entries preserved. The actual 14:17 Taipei run completed 06:18:21 UTC with no quote/RSR/allocation errors, all 7+3 probes returned, and Security's older clock preserved. Source failures retain last-good evidence with its original clock or expose unavailable state; exact Security hash/scope failure never falls back to generic Reserve topology.

Peg source `fbbdd489a2d9555942119d2a6a0c7a0d8091fc67`; critical dependencies including the underlying quote adapter are pinned. LMT source cutover `2026-11-13-reusable-reader-v1`/commit `93b1b26` with six critical source hashes. No hardcoded collection block in the installed reader.

Security selected export SHA256 `246e15020e8da50e2357555bd0a74c97e1a2240c4b146dd93c23a93f1dcf0242`; manifest `d44bdeecfe1640efcffa642a9fdce4814801017b9430943b818170734c5584d5`, all **92** indexed files hash-verified. Source correspondence reuses third-party compiler verification; `match`, `exact_match` and Blockscout statuses remain distinct. No independent recompilation or blanket audit clearance.

**23 focused tests pass**, covering units/identity, independent quote math, history deduplication, shared-market deduplication, stored-book residual checks, same-pin pro-rata scope, Security source hash/scope and clock preservation, immutable generation failure behavior and single-job installation. Desktop/mobile light/dark browser checks verify charts, quotes, allocation disclosures, Security detail expansion and no JS errors/overflow.

Staging URL: https://staging.tidresearch.com/previews/eusd/?asset=eusd . Final static deploy `6af6ab8c7c1d56858f9e7022`; renderer SHA256 `1d985ae424d193d4182eb81410410ac4e15cf1f2fc459c5b4913aa2ae1c6c510`. TIDR verified all 50 static hashes and preserved all 221 outside-prefix files, including the Reserve hierarchy and processed route configuration. Dynamic data flows from isolated `staging/eusd-canonical`, not a production-data mutation. Normal bounded cache propagation remains possible; BM final acceptance receipt records the actually served immutable generation, not merely the local latest pointer.

Operational receipts and final served generation/browser results: `.private-reviews/eusd-refresh-2026-11-13/`. These contain no private positions or wallet-derived sizing; raw owner traces and private file paths are excluded from public dashboard JSON/UI.

## Final served acceptance

At **06:24:48 UTC**, both desktop1440 and mobile390 browser sessions selected scheduled generation `4c37e6cf785d60b90da21dd97418a0b038acc63e939ddfa4d9a9c72541b3ac57` on the same final static deploy. All four immutable JSON hashes independently match, the financial/native allocation clocks agree at26404118 and Security remains26403764. No JS errors or page overflow; both charts and all six populated evidence sections render in light/dark mode. This closes the earlier cache-propagation wait without redeploying the site.

Served product SHA256 `ce0e4af9eaf7dd875646951b8d6fa1fab15544feaab4bfd5b46954814d8bfb72`; served dashboard payload SHA256 `200e324bf6ba66f4771521ed34f0dda1e73431dfcfb3e978c7da7fe91b5f5f8c`. The final private acceptance receipt SHA256 is `f33f8c1564ffc693f4affc5a26c3d17bf7036dc8b7534e405c7b2806ca5b92c0`; `final-receipt-manifest.json` binds the browser, hash, schedule and deployment receipts. BM evidence integration and maintained staging verification are complete within the documented bounds; RiskAnalyst assessment/report work is next.
