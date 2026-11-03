# To DeFiAnalyst: STRC-family structured issuer profiles

2026-11-03. BM migration is waiting for this return. Please complete the canonical source data in DeFiAnalyst; do not edit BM, change scores/full-verification dates, perform transactions, or send external messages.

## Purpose

The owner approved extending BM's existing structured issuer panels to STRC/STRCx and supported downstream assets. Keep each legal layer distinct: Strategy security issuer; STRCx wrapper issuer/custody; STRCon wrapper issuer/custody; Apyx, Saturn and Strata product/interface entities; PT maturity/conversion scope. Upstream exposure does not transfer shareholder rights, liquidity, guarantees or legal protections.

## Observed source gaps

Read-only inspection of `db/projects.db`:

- `strategy` has exact MSTR/STRC component mappings, a verified Strategy Inc entity and the November2 filing event. Its profile explicitly covers that filing rather than a full issuer review. Standard holder-rights, legal/access, financial-assurance and governance fields are not populated.
- There is no curated STRCx component or reviewed Backed/xStocks issuer profile. The directory-imported `backedfi`/`xstocks` projects have no profile check date; they cannot substitute for a reviewed legal-issuer record. Do not promote the older RiskAnalyst “Swiss DLT-regulated Backed Finance” shorthand into a verified legal entity or regulatory finding.
- No reviewed STRCon component/issuer profile is mapped. Saturn's canonical backing description names Ondo STRCon and Ondo Global Markets (BVI) Limited; that is not a complete wrapper issuer/custody/enforcement profile.
- Apyx, Saturn and Strata have reviewed entity/fact records, but some sources are free-text references rather than direct URLs. Apyx has component-specific apxUSD/apyUSD rights that must remain separate; its mixed documentary exit paths do not replace BM's accepted active-receipt measurements.
- The current database maps PT-srUSDat to Strata. Please clarify the distinct PT layer and its component-specific maturity/conversion evidence rather than treating generic interface terms or Pendle governance as complete PT holder rights. PT-apxUSD/PT-apyUSD mappings also need an explicit owner decision.

## Requested canonical return

1. Exact project/component identities and `riskanalyst_slug` mappings for STRC and STRCx; STRCon as a distinct upstream wrapper component. Preserve MSTR common-stock versus STRC preferred-stock scope.
2. For each supported component, identify legal issuer, operator/intermediary, custodian/reserve holder and relevant jurisdictions as separate roles. Supply documented holder rights, governing law/dispute terms, eligibility/primary access and redemption/enforcement limitations. Unknown fields must remain explicitly unknown or searched-not-found in a named source scope.
3. Distinguish financial-statement audit, reserve/backing attestation and smart-contract audit. Preserve coverage level (family versus per-token), observation dates, source dates and checked dates.
4. Document governance/control design separately from measured deployed authority. Do not infer implementation from passed proposals; provide execution evidence/clocks where available or mark missing.
5. Supply component-scoped dependency routes: STRCx→STRC→Strategy; apxUSD reserve exposure/apyUSD inheritance; Ethereum sUSDat→STRCon→STRC; srUSDat through its actual underlying; PTs through their own maturity/conversion layer. Do not give USDat's PYUSDx route or Apyx Treasury products blanket STRC exposure. No new allocations, balances, accruals or pass-through claims from the corporate filing.
6. Retain the November2 Strategy filing as a dated upstream development. Keep811 BTC purchases versus810 holdings increase unresolved unless supported by an issuer explanation. Do not turn repurchases into verified retirement/outstanding, reduce dividend burden, or infer unconditional daily-dividend effectiveness without separate evidence. These existing producer blockers are not a request to repeat unrelated reviews.
7. Return a public-safe source contract: explicit publishable fields/visibility or an owner-approved export with direct primary URLs, scope/status/basis, original clocks and any material event references. Private-default database rows, internal notes, account balances and private simulations must not be exported wholesale. Normalize free-text citations to direct supporting document URLs where possible.

## Acceptance and handback

Return canonical file/database build commit, exact component mapping changes, public-safe example records, field/source clocks, validation results and remaining gaps. A bounded partial return with explicit missing components is preferable to inferred identities or rights. Facts remain DeFiAnalyst-owned; judgments/scores remain RiskAnalyst-owned. BM will consume the accepted fields, preserve authored assessments and the accepted Apyx receipt release, then perform desktop/mobile and served-hash verification.

BM has not changed the issuer publication policy, producer or renderer for this migration. Implementation is waiting for this handback. No sibling repository has been modified or contacted by BM for this task.

BM acceptance update: the selected DeFiAnalyst contract and RiskAnalyst corrected exports are accepted for bounded component-field migration. Parent/private records and missing fields are not inherited. See `specs/reviews/strc-structured-issuer-2026-11-03/README.md`; original dispatch-state statements above are historical.
