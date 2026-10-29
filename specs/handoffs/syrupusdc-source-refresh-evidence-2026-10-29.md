# syrupUSDC axes 1–3 — evidence returned to riskAnalyst

Status: **ready for assessment**. The user-requested source coordination, BM synchronization and actual served-input/history verification are complete. Collateral, custody, bridge and execution assurance gaps remain open; this status is not a re-score or report-publication approval.

## One common-source package

Delivered directory: `/home/danger/riskAnalyst/data/reviews/syrupusdc-source-refresh-2026-10-29/`.

Delivered bundle: `/home/danger/riskAnalyst/data/reviews/syrupusdc-source-refresh-evidence-2026-10-29.tar.gz`.

Bundle SHA-256: `affbf1065c25cd59d09cbc2fd02af6f661bde48d59d1ba1e1a622c8e8ccf179b`.

BM copy and entry point: [evidence README](../reviews/syrupusdc-source-refresh-2026-10-29/README.md). Its 58-file manifest covers actual served before/after data and code, selected standard producer files, exact membership/history changes, final display checks, raw source subpackage and standalone replay scripts. The old October 28 riskAnalyst evidence archive is unchanged.

Producer assignment: `PegTracker/handoffs/inbox/syrupusdc-source-refresh-2026-10-29.md`, bounded completion report at `PegTracker/docs/syrupusdc-source-refresh-2026-10-29.md`, also included in this package. Producer report says 47 focused tests passed; BM independently verified the 539-file producer manifest, exact 24 issuer credit links, raw accounting preservation and the shared source outputs.

## Selected actual serving

- Backing `2026-10-29T01:49:29Z`, family `01:50:32Z`, canonical Ethereum quote `01:33:04Z`.
- All four selected standard backing/history/family/sibling outputs match actual public served files byte for byte.
- Public JavaScript merge retains CoinGecko market / theoretical-NAV backing history and the exact PegTracker KyberSwap Ethereum/USDC market-notional ladder. DexTracker remains venue inventory, not replacement depth or rating.
- Source publication `784d26ce9c`; final source-aligned display `9f6de2300a`. Final index cache token, renderer bytes and rendered-panel assertions were checked against actual served responses; this is JavaScript/HTML execution verification, not visual browser QA.

## Changes relevant to assessment

New USDC version `issuer_economic_usdc_v1_2026-10-29` publishes exact reviewed loan/borrower/metadata provenance and credit/non-credit/unknown states. Current book: 24 credit records ($898.72M), nine non-credit strategies ($36.15M), zero unknown principal. The only membership delta is $5 USDtb moved from heuristic loan to Treasury strategy. All-position principal $934.87M still reconciles exactly to principalOut; rates, borrowers and status flags are preserved. Non-credit strategies are not immediately withdrawable cash.

Credit collateral ratio remains null: $865.22M of $898.72M has numeric values; the $33.5M WBTC credit position lacks one. Selected available row collateral is $1,103.83M versus $1,612.24M reported aggregate. The seven material below-par reads cover $355M. Issuer values appear consistent with GraphQL assetAmount while the producer values currentAssetAmount; matched raw evidence narrows but does not resolve allocation, valuation or custody scope. A separate $5 USTB below-par diagnostic is not one of the seven material health readings. Combined two-pool external verification does not fill per-pool/per-loan gaps. No verified shortfall or safe recovery buffer is inferred from accounting PCR or zero losses.

Nine registered networks returned supply observations. Additive supply totals/resident shares/reconciliation ratios remain null and bridge completeness false. The family now declares each pool's versioned economic membership; no USDT address or zero-hook conclusion was transferred to USDC.

No overlapping historical financial fields were rewritten: 718 shared rows unchanged, two new normally produced rows carry the new version, two expired rows retained in the before archive. Post-hour-deduplication month statistics use 719 hourly observations and 701 paired peg samples from 720 raw rows. The quote store contains 220 distinct successful $250K quotes over 27.52 days (median all-in −7.83bps, IQR 3.18bps), not fills or a success-rate denominator. Current $250K impact −7.60bps versus all-in −5.95bps are separate quantities. Primary 50bps depth remains a ≥$1M floor, not an exact crossing.

BM now preserves unresolved collateral wording, uses exact strategy subtypes for complete versioned books rather than inferring parked reserve, and shows unmeasured strategy readiness. Supply display preserves non-additive/incomplete scope. These display fixes do not alter observations or scores.

## Required assessment boundary

Authored `syrupusdc_axis_basis.json` still references `2026-10-28T08:44:43Z`; its older rationale/coverage/aggregate fields require explicit regeneration and assessment from the same selected standard inputs. The package makes that clock gap explicit and does not silently update authored facts. Retain original evidence and prospectively segment the definition break. Quote-duration observations do not prove primary request-to-fill latency. USDC-specific route simulation, fills/settlement, local-chain execution, custody allocation and synchronized bridge reconciliation remain unproved.

Overall **6.5**, axes **8.5 / 6.5 / 7.0 / 5.5 / 4.5 / 5.5**, legacy Redemption **7.5**, all unchanged. RiskAnalyst owns assessment and any subsequent authored-rationale/report changes. No report or dashboard score was automatically changed; no report publication, transaction or cron change was performed.
