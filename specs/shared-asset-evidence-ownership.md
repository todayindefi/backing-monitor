# Shared asset evidence: ownership, cadence and scope

User decision, 2026-11-04. Applies to report and dashboard evidence going forward. This records the target operating model; existing adapters/jobs/publication routes do not become migrated merely because this document exists.

## Ownership

BackingMonitor owns the canonical backing-data product: collection orchestration, collateral/liability/circulation accounting, custody/encumbrance perimeter, reconciliation, uncertainty and normalized exports for riskAnalyst, TIDR and BM views. Existing specialist readers can remain implementation components. Avoid a parallel report-only backing pipeline.

This supersedes the older BM six-axis specification's blanket rule that primary backing must always be produced in PegTracker. Migrate per asset, with explicit source cutover/acceptance; preserve existing production readers and schedules until their replacements are verified. No global collector move or cron change is authorized by this policy alone.

| Axis | Primary evidence ownership | BM responsibility | RiskAnalyst responsibility |
|---|---|---|---|
| 1 Stability | Existing price/reference/history producer, currently usually PegTracker | Consume/reference normalized price and NAV evidence; preserve clocks and mark basis | Interpret stability versus the asset's own reference; author report grade |
| 2 Backing | BM canonical backing product; reusable specialist readers underneath | Own accounting perimeter, collection, reconciliation and export; leave impossible ratios unavailable | Interpret financial quality/uncertainty and author grade; no parallel recurring balance collection |
| 3 Liquidity & Exit | Existing venue/quote owners (DexTracker, PegTracker, PendleTracker as applicable); protocol redemption state coordinated by BM | Assemble exact route stages, units, fees, eligibility, queue/bridge limits and coverage; designate one field owner where existing outputs overlap | Judge cash-exit risk and score; distinguish quotes, simulation, eligibility and settlement |
| 4 Dependencies | RiskAnalyst interpretation; producer look-through/composition evidence | Supply measured holdings, concentration and dependency inputs with attribution | Own causal dependency assessment and grade |
| 5 Contract & Admin | security_analyst live authority/code/control verification; RiskAnalyst code/audit interpretation | Project and consume the owner's observations; never renew their clocks by fetching | Interpret controls/code risks and author grade |
| 6 Issuer | DeFiAnalyst canonical documentary identities/terms/news/governance; relevant financial producers | Consume reviewed component exports and financial evidence, respecting publication permissions | Own issuer interpretation and grade |

BM is the shared assembler and backing producer, not a replacement researcher for every axis. Existing dashboard-computed bands and report-authored grades retain their respective methodologies and labels; this policy does not automatically unify scores or authorize BM to change authored grades.

## Two independent decisions for every asset

1. Collection cadence: one-off, daily, hourly/two-hourly, or an explicitly justified exception.
2. Evidence scope: backing-only refresh, selected axes/fields, or a six-axis evidence package.

A six-axis package assembles all six owners' available evidence. It does not mean six new BM collectors or a fresh security/legal investigation at each run. A backing-only refresh is not a completed six-axis risk assessment. A complete evidence manifest may explicitly mark missing/unavailable owners and inputs; do not invent healthy grades or fresh clocks to fill it.

## Cadence defaults

- No dashboard, not held, and no material indirect/dependency exposure: one-off dated pull for the report by default. Re-run on a substantive refresh or material event.
- No dashboard, held directly or materially through another asset/venue: daily dynamic backing refresh by default, subject to source availability and value. Record any different cadence with rationale.
- Dashboard: hourly or every two hours for supported dynamic measurements, selected for source update rate and operational need. An exceptional slower/faster cadence must be explicit.
- Documentary disclosures, financial statements and authority walks keep their natural update/event cadence. Polling a source hourly does not make a quarterly statement or an old authority walk fresh.
- A one-off snapshot creates no implied ongoing monitoring promise. Exiting a direct holding does not justify stopping a job while material indirect exposure remains.

Record asset/component/exact chain/token, requested consumer, exposure evidence and as-of (held/indirect/unheld/unknown), chosen cadence and reason, field owners and scope, source clocks/freshness rules, unresolved gaps, output contract and publication state, and reassessment/retirement triggers. Unknown exposure must be explicit rather than silently classified unheld. A cadence decision is separate from actually installing/changing a schedule.

## Shared evidence contract

Every output distinguishes source observation and block time, fetch/check time, documentary effective date and assessment date. Include exact units, chain/component identity, covered liabilities/assets, exclusions and reconciliation residuals. Null means unknown/unavailable, not zero. Gross pool collateral/borrower ratios do not become global solvency ratios when supply/bootstrap/custody is unreconciled. Preserve balance versus debt, internal own-token holdings versus external backing, bridge escrow versus remote issuance, and asset NAV versus executable proceeds.

Reports retain the frozen evidence snapshot supporting an authored judgment. The dashboard may show newer readings from the same producer; material changes trigger report review rather than silently rewriting its historical basis. A newly fetched file cannot renew whole-report verification or a specialist walk's timestamp.

Canonical DeFiAnalyst research remains prerequisite context for substantive risk work. Normal publication/source-contract review applies; a private profile or owner packet is not automatically public data. Research, collection, grading, staging and production promotion remain separate states.

## Initial pilot: Mezo MUSD

Use exact Ethereum MUSD 0xdd468a1ddc392dcdbef6db6e34e89aa338f9f186, canonical mezo/musd-mezo, plus separately scoped native/Base dependencies. Start with a one-off backing/reconciliation pull and shared export for the active report; no new recurring schedule yet. Holding/indirect exposure classification remains to be recorded before choosing any ongoing daily schedule.

Reuse PegTracker's November 4 pinned financial packet, Security's committed authority packet and DexTracker's exit packet. BM owns resolution or explicit bounded retention of supply/bootstrap/custody and NTT accounting gaps. A high borrower-only TCR and unexplained residual do not certify global coverage or prove losses. The report's provisional grade can change only through RiskAnalyst review of additional evidence. This pilot creates no new dashboard or production publication authority.

## Aggregation and cross-surface parity

User confirmed, 2026-11-04: BM assembles the shared six-axis evidence package; RiskAnalyst primarily consumes that package, checks critical underlying evidence and authors interpretation/grades. RiskAnalyst does not operate a parallel recurring six-axis collector. Individual field owners remain attributable and correctable.

Each package must expose an asset/component/chain identity, stable evidence-version or snapshot identifier, original source references and field clocks, and per-axis/field coverage. BM may select its normal versioning implementation. A package assembled today does not imply each specialist source was observed today. Assembly success and evidence completeness are separate states.

Every consumer records the selected evidence version. Authored scores separately identify the RiskAnalyst assessment version/date and supporting evidence version. BM's computed dashboard bands retain explicit methodology and are not silently substituted for authored report grades. Consumer-side factual corrections must be fixed at their canonical producer and propagated, not hand-patched independently into three surfaces.

Before acceptance, compare internal report, TIDR candidate and BM view at the same selected version for exact token/component/chain; key balances/liabilities/ratios and explicit nulls; units and valuation/denominator basis; quote discount versus impact and route stage; source clocks/freshness/coverage; and authored grade/scope where that grade is displayed. A missing consumer is a coverage gap, not a passed parity check. An unavailable source remains unavailable rather than falling back to a wrong-family or stale value.

Report snapshots versus live dashboards may intentionally select different versions. Show their dates and version relationship; classify that difference as a dated baseline versus newer measurement, not accidental numerical drift. Material changed readings trigger RiskAnalyst review. No automatic report rewrite, grade change or production promotion follows from a new package.
