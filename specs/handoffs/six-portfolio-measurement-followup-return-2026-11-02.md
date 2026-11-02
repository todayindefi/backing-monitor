---
status: partial_with_evidence_and_named_blockers
from: backing-monitor
to: riskAnalyst, PegTracker, FarmTracker, LendingMarketTracker, PendleTracker, DexTracker
date: 2026-11-02
---

# Six-portfolio measurement follow-up return

Continuation of the accepted first wave. No trades, transfers, approvals or notifications. No scores changed. Account-specific holdings, outputs and unsigned calldata are in the gitignored private packet, not public dashboard data:

`.private-reviews/six-portfolio-refresh-2026-11-02/followup/RETURN.md`

`status-register.json` gives complete/partial states, sources and named evidence obligations for 11 workstreams and 39 non-dust candidates. The final FarmTracker inventory supplies the dispositions of all 78 candidates, including dust and unresolved residuals. `manifest.json` hashes the retained raw responses and reproduction scripts. This document is a handoff artifact, not proof that downstream owners accepted or completed their obligations.

## Apyx November 5 — partial settlement evidence, complete dated configuration check

Live PT balance, exact-unit native and aggregator quotes, fees, matched-order expiry, gas-price basis and read-only simulation failures retained. Both routes fail eth_call with insufficient allowance; no approval sent. Gas estimate fails for the same reason. No top-level quote-validity TTL or guaranteed gas cost was invented.

Verified YT source establishes post-expiry PT-only redemption: SY payout is PT accounting units divided by the current monotonic PY index, then SY unwraps into apyUSD shares. The first post-expiry index anchors treasury-interest accounting; later yield does not accrue to PT. The current-index payout calculation is retained, but future November 5 settlement index and exact proceeds remain unknown today. No rollover is implied.

**Material new producer scope issue:** pinned Ethereum block 26,324,501 at November 2 03:47:59 UTC binds apyUSD.receipt() to `0x9bf51f33955ec70f87c4b5c49441815589043237`. New redeems mint NFT receipts. The vault charges an upfront 0.1%; receipt fee configuration is 2.5% at day 3 declining to zero by day 20 with curvature 0.75. The standard methods route to the new receipt as well. Deployed implementation/configuration differs from the documentation’s linear 3.5%-to-0.1% description and legacy single-request text. Old UnlockToken still has a 20-day setting, but its queue does not measure active new receipt liabilities.

**PegTracker obligation:** extend the existing producer to read active receipt/configuration, liabilities and claims; preserve legacy versus active scopes and exact block/source clocks. Do not regenerate the old queue and label it current coverage. Dashboard now exposes the dated check and missing receipt monitoring, with old observations collapsed. This is a dated correction, not a second recurring pipeline.

**Remaining owners:** PendleTracker/FarmTracker for sender/allowance-aware simulation and final index; Apyx/PegTracker for ongoing receipt state, eligibility and apxUSD cash settlement. Technical deny-list status does not establish legal/frontend eligibility.

## Leveraged positions — partial

- Reused FarmTracker’s final block-timed Aave identity/account evidence, then pinned additional oracle/configuration observations. Both Lagoon loops use e-mode overrides: 90% LTV and 92% liquidation threshold. Base reserve configuration alone gives the wrong account interpretation.
- TID sUSDe/PYUSD’s liquidation LTV is 91.5%; live weighted account liquidity, exact debt, vault cash/caps and oracle rounds retained. The PYUSD and USDe rounds were within their configured 90,000-second age limits at the observation block.
- Personal Euler positions belong to separate EVC subaccounts, not the owner EOA. All 256 addresses under the owner prefix were queried via read-only Multicall; live controllers/collaterals/debts establish the exact bindings. An EOA debt read of zero does not mean the loans exited. **FarmTracker/LMT must preserve these account identities.** Account addresses remain private.
- Morpho fxSAVE/USDC reuses FarmTracker’s existing expected-accrual reader, including exact rounding and the live market oracle. Stored market debt is not treated as accrued debt.
- Fluid’s no-match join is resolved: DB address is the ERC721 factory. The owned NFT resolves to vault 162 through the live resolver, with matching Re Protocol collateral and GHO debt. Source includes exact position amounts, oracle, thresholds, limits and a calculated resolver-based HF. It differs from the earlier DeBank snapshot; no producer HF was overwritten. Vault 181 and Resupply’s similarly named reUSD are excluded.
- Actual-size conditional full-collateral swap quotes were captured for all eight loops. They do not simulate repay→withdraw→swap/flash-loan execution. Debt repayment, withdrawal HF and route permissions remain binding constraints. Cash, utilization and caps are observations, not executable unwind guarantees. No 1−1/HF loss tolerance is asserted.

**Remaining owners:** FarmTracker/LMT for account-level and collateral/vault conventions; DexTracker for atomic unwind/flash feasibility and complete fee basis. Oracle round ages are explicit; CAPO growth-anchor dates are not treated as price timestamps. Some underlying-feed freshness limits remain unestablished; see `oracle-clocks.json`.

## Saturn/Monad — partial, migration completion unverified

The held PT’s Monad SY pays the remote 18-decimal srUSDat share, while PT/accounting USDat units use six decimals. Its native quote exists; direct Monad USDC output is rejected, and eth_call fails allowance. The LayerZero peer and reverse Ethereum adapter linkage are measured. Ethereum adapter srUSDat holdings and remote supply reconcile in share units at their pinned blocks. This establishes that link’s inventory, not independently verified reserve custody or a completed cross-chain cash exit.

Ethereum Strata senior withdrawal configuration and shared declared availability were read. These are strategy-defined amounts, not simulated bridge delivery or holder cash proceeds.

The primary October 29 issuer notice reschedules USDat/sUSDat BNB/Monad token-pool upgrades from CCIP v1.0.0 to v2.0.0, expected around November 6. The post was captured successfully with its text. It is a schedule, not a completed migration receipt. Directly measured Strata senior-share LayerZero custody is a separate dependency.

**Saturn/Strata/PegTracker obligation:** provide exact upgraded pool authorization, completed migration transactions and operational destination/settlement evidence. **PendleTracker/DexTracker:** bridge-message gas/fees, delivery and full redemption-to-cash simulation remain absent. No migration loss, guaranteed completion date or forced PT conversion is inferred.

## Comparable changes and remaining material coverage

Retained genuine observations near October 26, last meaningful check and latest source snapshots for 39 non-dust candidates and 14 BM histories. No histories were synthesized. Exact-unit historical cash-exit quotes, receipt configuration and current-round oracle observations are absent or incomparable; no changed denominator/route is presented as investment performance.

Per-position named blockers include confidential Flowdesk ownership, suspected deprecated TIDAVAY economic claim, managed strategy/LP withdrawability, Lighter assets outside the deployment mandate and Boros CrossEx API whitelist failure. TIDMM/Lagoon posted/live and ownership/deployment residuals reuse FarmTracker’s final evidence; receipt and deployment values are not counted twice. The accepted five-page repair was not closure of this whole review.

## Completed checks incorporated after this measurement return

See `specs/reviews/six-portfolio-completed-checks-2026-11-02/README.md`. The original-state Apyx allowance failure remains; a later allowance-only conditional replay now succeeds for both retained routes. Felix/Gauntlet/roxFX held-share vault calls and four Stake DAO wrapper-to-LP calls are accepted within their pinned scope. The private status register narrows the earlier generic first-leg blockers. Fresh quotes, actual authorization, final cash settlement, effective authority, full pending/retirement scans and future liquidity are not established. No score or frontend change follows automatically from these results.
