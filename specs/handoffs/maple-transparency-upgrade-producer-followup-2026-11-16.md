# To PegTracker, then BM/RA: upgraded Maple Transparency source adoption

User asks whether the upgraded official transparency pages can improve our data/dashboards. Reconcile and adopt useful fields through the existing Maple producers, reusing the November16 weekly source/candidate work. No duplicate collector, jobs, trades, issuer outreach, automatic scores or production publication. Staging remains the consumer boundary.

BM has captured the exact current official USDC HTML and retrieval receipt, selected exact-address rows and prior-source comparison leads under `/home/danger/backing-monitor/.private-reviews/maple-transparency-upgrade-2026-11-16/manifest.json`. Hash-verify those inputs; direct HTML was HTTP200. Preserve the unknown upstream financial/valuation clock: fetch time is not collateral observation time. Canonical URLs:
- `https://maple.finance/transparency/products/syrupusdc`
- `https://maple.finance/transparency/products/syrupusdt`
- `https://maple.finance/transparency/products/syrupusdg`
- `https://maple.finance/transparency/financials`

## Priority1: source contradictions before changing financial warnings

Official page now displays the16.5m USDC loan0xbd331e5fd515e3ce4bdadccbefa0eebc05e2fb3f at139.1% versus prior producer25.58%;30m loan0x7669... at123.9% versus37.90%; repeated25m loans at125.7% versus31.90%. The200m0x7f110... now has313.53m displayed collateral/156.8%, while the old currentAssetAmount-based model was null.33.5m WBTC0x63ea... now displays47.62m/142.2%. These are exact-address contradictory publisher figures, not verified collateral cures or losses.

Find the upgraded page's actual structured source, transformation and perimeters; compare with existing GraphQL/API fields and retained raw fixtures. Determine unit/asset/price/clock bindings, gross versus assigned collateral, shared allocations, source-stated loan types and next-call versus maturity. Do not blindly replace currentAssetAmount with assetAmount: that hypothesis may explain some BTC rows but cannot be assumed for all assets/loans. A visible collateral-wallet list is publisher-reported inventory, not allocation/title/control proof. The new page's loan-type labels must not silently replace deployed-contract/version bindings.

## Priority2: better allocation and liquidity evidence

Export source-scoped allocation by lending, Treasury/DeFi/trading, LP strategy and idle cash, including exact strategy address/chain and attributed amount. Reconcile the old USDT50m and new categories/borrower grouping. Keep headline AUM, deposit allocation, pool-native accounting assets/principal and collateral totals separate; the current USDC page shows different headline/deposit/AUM-breakdown totals.

Its liquidity ladder groups idle cash plus multi-chain DEX LP as instant, then scheduled loan amounts/interest and other strategies by typical timing. Preserve those as issuer projections. Separate funded local pool cash, owned receipt/LP unwindability, bridge/transport, restrictions/fees, scheduled borrower payments and actual completed receipts. Scheduled inflow is not confirmed cash; pooled LP value is not measured Ethereum USDC execution. Add queue snapshot/status data and source clocks when supported. Reuse our bounded completed-wait/receipt evidence; no repeat census or simulations.

## Output and adoption contract

Return a finite hash-pinned source/mapping delta, old/new numerical fixtures per exact instrument, per-field owners/units/clocks/perimeter and explicit nulls. Use the normal producer/report/summary functions and an isolated staged full export with byte-identical offline rebuild; keep production sources inactive until separately authorized. Add supported schema fields for conflicting issuer figures rather than hardcoding research values in BM JavaScript. Distinguish confirmed parser/schema defects, genuine source changes and unresolved publisher disagreements. Prevent double-counted collateral and LP cash.

Financial/issuer page claims and LedgerLens remain separate: preserve original displayed product clocks and NON-ATTEST limits; no parent Treasury/SYRUP buyback assets or parent revenue become loan first loss or pool backing. Bring DA/Security in only for genuinely missing documentary/binding inputs, using existing requests; do not open a duplicate broad authority walk.

BM will adopt returned fields into the existing six-axis pair views (and keep USDG scope separate), expose reconciled/unknown source disagreements, strategy allocation and a qualified liquidity ladder, and verify served desktop/mobile parity. RA owns any assessment change. Preserve accepted financialc862 baseline, Pegv2 and subsequent Axis1/spec-style lineage; return a new version with shared-v1/check_task, never overwrite accepted artifacts.

## Assessment correction rule — RiskAnalyst follow-up

Preserve accepted assessmentv2/reader-final-v5/deploy6afa8331 until new source/mapping evidence is reviewed. If the old parser/model is demonstrated to be invalid, explicitly identify and retract its invalid below-par claims; do not retain them as supposedly conservative evidence of deterioration. Return exact before/after fields, defect proof, affected claims and corrected coverage. RA will reassess any associated Backing penalty and named finding. Issuer-displayed improved ratios alone do not prove custody, a cure or net recoverability. No automatic score/publication changes.

## Producer preliminary mapping lead

PegTracker reports all24USDC and6USDT credit rows' SSR `data-collateral-value` values reproduce GraphQL `assetAmount` using a common inferred price per asset; the prior producer used `currentAssetAmount`. Exact-address proof/staged adoption is pending. This finding is source-specific: do not transplant the field rule into supporting strategies, infer independent market/oracle validation from an implied price, renew upstream clocks, or assert custody/title/recovery. Once demonstrated, identify and retract the invalid old below-par model flags rather than carrying their penalty as conservatism. RA owns the assessment correction.

Durability gate: after a credit-row valuation selector is proven wrong, a missing/failed upgraded-source read must not silently reactivate that invalid legacy calculation and its below-par flags. Preserve qualified last-good/unknown states and source failures; test missing loans, scope/identity/unit failures and field absence. This is source correctness, not a reason to switch all supporting strategies to another amount field. Source/native HF, pool cash and queue constraints remain independent of retracted collateral-deterioration claims.
