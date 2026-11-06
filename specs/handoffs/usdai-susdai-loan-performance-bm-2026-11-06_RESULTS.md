# USDai / sUSDai one-off loan-performance evidence — bounded return

To originating RiskAnalyst session01a1afc6-7a19-7c43-aa03-ccc72ce47706 and assessment owner01a1a375-9b44-7b13-8ec5-19bf15296705. Consumes the November6 loan-performance brief, reusing the November4 documentary request, normal producer inputs and frozen November6 credit review. PegTracker confirmed it has no completed/active separate loan-tape/payment reader; no duplicate commission opened.

**New public issuer data was found.** The old aggregate-only/CORS/private-API assumption must not be carried forward as a blanket statement. Public Swagger documents proof-of-reserves deal rows, remaining per-loan schedules, future payments, event-derived repayment histories, liquidation-event counts and queue endpoints. These were accessible without authentication. They provide useful additional issuer reporting, but do not supply independently verified current credit performance or a complete cash bridge.

## Frozen return

Private root: `/home/danger/backing-monitor/.private-reviews/usdai-loan-performance-2026-11-06/`.

- Pointer: `packages/current.json`.
- Selected evidence: **sha256:ecb7a4d5cba3e2b2bd5428d8838224a6164feb9690b4e8a1c3088d7522a1882f**.
- Immutable snapshot: `packages/snapshots/ecb7a4d5cba3e2b2bd5428d8838224a6164feb9690b4e8a1c3088d7522a1882f.json`.
- 194 frozen input files, manifest `raw/v1/input-manifest.private.json`; matching per-version private provenance in `packages/provenance/`.
- Nine focused tests pass. Builder `tools/build_usdai_loan_performance.py`; tests `tests/test_usdai_loan_performance.py`.
- All fields are **internal-only, publication not authorized**. `assessment_version=null`; no scores/jobs/trades/external outreach/site updates. No issuer contact or access-control bypass. Changes uncommitted; prior dashboard commit is separate.

Exact identities remain Arbitrum42161 USDai `0x0a1a1a107e45b7ced86833863f482bc5f4ed82ef` and sUSDai `0x0b2b2b2076d95dda7817e785989fe353fe955ef9`. USDai's reserve perimeter remains separate from sUSDai credit. Do not interpret the evidence as a PT/remote-chain grade.

## 1. Population and scheduled payments: useful partial coverage

Public `proof-of-reserves?chainId=42161` returned28 rows:27 DEAL records and one PYUSD reserve record. All27 published **document UUID** schedule requests succeeded:21 return API Active status1, six Uninitialized status0. Uninitialized/pipeline schedules are not funded debt. Per-row borrower address, issuer name/group, hardware/location/APR, remaining scheduled principal/interest and original source clocks are in the private tape. Borrower addresses and publisher labels do not establish legal SPVs, related groups or offtakers.

Initial requests using the future-payment `loanTermsHash` returned404; the actual public schedule identifier is the published document UUID. The rejected responses are retained. This was an identifier mismatch, not an authorization denial, unavailable API, or finding that loans do not exist.

For the21 API-active records:

- Remaining raw schedule principal divided by the stated18-decimal USDai currency: **176,739,359.451587862579016444**.
- This matches their `totalRemainingAmount` fields within the checked precision.
-620 future-payment rows for21 hashes sum to principal **176,739,359.451299**, a **−0.000288862579016444** difference. Future endpoint numeric amounts are already decimal currency amounts, supported by schema and raw-schedule reconciliation; contradictory endpoint prose calls them raw units. Do not divide them by1e18 again.
- Aggregate `loan-snapshot.current.deployed`: **305,511,551.26922596**. Difference from the visible schedule principal: **128,772,191.817638097420983556**. The visible amount is57.8503% of that larger number, a **cross-perimeter comparison, not verified population coverage**. Full current loan coverage remains null; legacy/current mappings, accruals and definitions must be reconciled. Do not call the difference losses or missing assets.

The published `default-rate` returned0 liquidated loans out of28 qualifying loans. Its documented definition counts `LoanLiquidated` events. **It does not establish zero arrears, breaches, extensions, restructurings, impairments or financial defaults.** Loan DPD buckets and scheduled-versus-verified-settled matches remain null.

## 2. Payment-history and queue contradictions remain unresolved

The principal/yield daily-history endpoints returned a full calendar but zero reported amounts over the30/60/90 completed-day windows ending November6(exclusive). Their last positive reported day is **June26**. Compute clock is November6 **08:20:40UTC**. This could be an incomplete event-indexed perimeter or another source problem; **it is not proof borrowers made no payments**. Cumulative yield/origination metrics and remaining/future schedules have different scopes and do not repair the receipt linkage. No independently verified collection ratio, arrears aging, restructuring history or full repayment ledger is established.

The API queue returned `items=[]` and zero totals at **08:20:41UTC**. Separate fresh native reads at Arbitrum **521735413 /08:23:08UTC** give:

- totalAssets **441,306,113.414826682297981537 USDai**;
- idle USDai **134,523,775.058375282575019694**;
- implied non-idle mark **306,782,338.356451399722961843**;
- `totalShares − totalSupply − bridgedSupply` **424,037.490749780641952723 shares**.

The nonzero native identity residual versus empty API queue is an unresolved coverage/implementation/definition mismatch, not a certified empty queue. The identity does not enumerate queue ages, ready claims or available holder cash. No API current-capacity or immediate-redemption guarantee is accepted.

October30 to the selected07:46 baseline shows idle cash falling from about251.312m to134.524m. That is an observed book change; deposits, redemptions, actual loan funding, payments, fees, accrual and impairments have not been transaction-reconciled. Neither cash depletion nor residual credit movements establishes default/loss causation. Settled GLX proceeds and CHR donation receipts remain null; listings, forecasts, headline yield and a capital-dependent hurdle are not settled cash.

## 3. Concentration and AI-demand evidence

Largest five **visible active records** account for **75.1722% of that partial176.739m subset**. Largest individual visible record is retained with amount/weight in the private tape. Hardware-name exposure is derived only within this same partial denominator; API hardware counts are not independently verified physical inventory. Publisher group labels and borrower-address aggregation cannot establish ultimate related-party or offtaker concentration, and excluded exposure could contain a larger obligor.

Current borrower DSCR, compute utilization, rental rates/revenue, contracted-versus-spot cash flows, offtaker legal identity/credit and termination rights remain unavailable. Portfolio policy DSCR/LTV limits are not measured compliance.

**Public hardware health flags are unsuitable for health evidence:** `PublicHardwareServerDto` explicitly documents `isHealthy` as always true, including placeholders for unlinked declared servers. Two public sample responses contain only those flags, with38/75 server rows. They do not establish telemetry, uptime, utilization, asset condition, revenue or credit health. No positive underwriting credit is assigned to them.

## 4. Collateral, protection and bounded scenarios

The current proof-of-loans page still lists **July15,2026** as latest AUP snapshot. PDF issuedAugust25 was fetched, text-extracted, and appendix pages visually inspected. It contains13 management-selected loans:11 funded and two escrowed/unfunded at that snapshot. The historical numbered IDs are not mapped to the current UUIDs. Initial LTV/document inspection and July VSA caps do not supply current appraisals, resale proceeds, collection timeliness, current portfolio completeness or a credit-quality opinion.

17 of21 API-active schedules include issuer monthly VSA coverage curves. Four missing curves do not establish zero coverage. Present curves are projected/conditional payout data, not proof of funded DSRA, independently realizable server values, an enforceable unconditional guarantee or claims paid. Current funded loan-specific DSRA, actual warranty conditions/remaining availability/claims performance and independent current liquidation valuations remain null. No universal10% DSRA, active sCHIP capital or unconditional80% insurance credited. Published risk policy includes market-wide-shock suspension and distinguishes server disposal from whole-SPV sales.

Issuer aggregate reported LTV is **70.46017254%**, with no independently established underlying appraisal date. Mechanical fixed-debt scenarios produce:

| Assumed collateral-mark haircut | Mechanical LTV |
|---|---:|
|20%|88.0752%|
|30%|100.6574%|
|40%|117.4336%|

These are conditional arithmetic on an issuer-reported aggregate mark, **not loan-loss/NAV-loss estimates, forecasts, verified current collateral valuations or recovery guarantees**. Actual loan and NAV loss fields remain null; legal recovery, funded protection and loan-specific collateral distributions are not established.

## Source clocks and inspection limits

Aggregate loan/default compute time: **08:20:20UTC**. Daily repayment history:08:20:40UTC. Queue:08:20:41UTC. Per-loan schedules retain earlier cache times ranging from **November5 17:11UTC through November6 04:11UTC**, rather than being restamped to fetch time. Proof row response has no underlying valuation timestamp: source time unknown, retrieval recorded. Native pin08:23:08UTC is independent. Historical assuranceJuly15/issueAugust25, canonical documentary reviewNovember4, baseline07:46 and new fetch clocks remain separate.

API source registry preserves inspected URLs, HTTP status, request/receipt times and response hashes. Public endpoints were read only; no application/private/customer APIs, holder balances, credentials or external outreach used. Existing43 DeFiAnalyst primary captures were hash-verified/reused; baseline snapshots were matched to RiskAnalyst's review hashes. No second recurring collector installed. New API scope is a bounded one-off BM financial observation, not a new automatic dashboard/source cutover.

## Precise missing-document request for a later authorized issuer request

No request was sent externally. Required deliverables:

1. Closing current loan register, including legacy pools and all loans/series: stable UUID/terms-hash/contract crosswalk, borrower/SPV/ultimate related group, outstanding funded principal, accrued/PIK interest, commitments/draws, maturity/amortization/currency and accounting allocation to USDai/sUSDai. Reconcile visible176.739m to aggregate305.512m and reported non-idle marks; explain each residual without treating it as loss.
2. Executed schedules and amendments plus loan-level settled bank/onchain principal/interest receipts for at least90days: due date, contractual/grace date, amount due, amount paid, receipt date/transaction, allocation, partials, extensions/restructures, DPD, defaults/breaches and writeoffs/provisions. Reconcile the API histories' post-June zeros and future schedules to actual collections, including offchain and new/legacy router scope.
3. Current DSCR/utilization/rental revenue, contracted offtake exposure and customer credit/termination terms per obligor and related group; definitions and reporting dates required.
4. Current model/server-specific independent net liquidation appraisal, dates/method, arm's-length sale evidence, costs/time, lien/priority and LTV per funded loan. Map July report IDs to current loans and identify refinancings/collateral substitutions.
5. Funded DSRA/equity statements, draws/replenishments and legal availability by loan; executed warranty/VSA policy, beneficiary, caps/expiry/exclusions/suspension and paid/denied/pending claims. Reconcile monthly public curves to enforceable currently available protection.
6. Full vault cash-flow and queue bridge: requested/filled/rolled/canceled amounts/ages, deposits/redemptions/disbursements/repayments/fees/CHR/GLX/impairment receipts and restricted versus free cash. Explain zero API queue versus nonzero share-accounting residual at the stated observations.

RiskAnalyst owns interpretation and any later scores. This package materially expands available issuer data but **does not close independent backing, collectability, payment-health or cash-exit verification**.
