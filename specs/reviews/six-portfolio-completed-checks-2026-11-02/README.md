# Completed checks incorporated into BM — November 2, 2026

Continuation of the existing six-portfolio review. No new chain calls, approvals, signatures, transactions or notifications; no scores changed. Private evidence was copied into the existing gitignored BM follow-up packet with source hashes and validated against the original retained BM quote file and calldata.

## Changes in evidence status

| Item | Incorporated result | Remaining limit |
|---|---|---|
| Apyx retained apyUSD/USDC routes | Both pass at Ethereum block 26,324,817 / 04:51:23 UTC with an allowance-only ephemeral stateDiff; original-state calls still fail; real allowance remains zero | Conditional replay of old payloads, not fresh quotes, actual authorization/execution, November 5 payout or cash settlement |
| Felix feUSDC | Full owner-context held-share vault redemption succeeds at HyperEVM block 50,159,805 / 04:38:16 UTC; source-matched MetaMorphoV1_1; dated nominal role/configuration checks accepted | Curator can allocate to eligible existing markets; three days is not every-operation delay. Effective Safe control, full pending actions, oracle audit and future liquidity remain open |
| Gauntlet gtUSDT0 | Full owner-context vault redemption succeeds at the same block; nominal role/owner-slot overlap and stored allocation estimates accepted | Source equivalence was not established by the supplied queries. Stored allocation is not accrued market-price NAV; no full authority or oracle audit |
| roxFX | Both owner-context vault-redemption samples succeed at Ethereum block 26,324,751 / 04:38:11 UTC; expectedSupplyAssets concentration and selector configuration accepted | Abdicated zero-delay powers are not instant callable powers; forced-deallocation penalty is not an ordinary-redemption fee; future/stress settlement and effective authority remain open |
| Stake DAO wrappers | Four owner-context full wrapper redemptions pass to the matched Curve LP assets at Ethereum block 26,324,844 / 04:56:47 UTC | LP-to-final-stablecoin exit and complete retirement-list exclusion remain open |
| RiskAnalyst consumer model | gUSDC, feUSDC, gtUSDT0 and native LLP remain separate; unassessed holdings excluded from weighted means; all-unassessed is N/A | feUSDC/LLP remain asset-coverage gaps. Local core Lagoon MM coverage remains in the private register and excludes the separate additional Lighter sleeve pending canonical export. No BM rescore or external deployment claim |

The exact owner balances, quote payloads and simulated return amounts remain private in:

`.private-reviews/six-portfolio-refresh-2026-11-02/followup/completed-checks/`

Existing `status-register.json` and `RETURN.md` now distinguish completed first legs from remaining obligations. The base report builder reapplies this reconciliation so regeneration does not restore superseded blanket blockers.

## Source/validation scope

RiskAnalyst acceptance receipts and raw files were read and retained. Checks establish receipt/raw SHA-256 agreement, unchanged original BM quote SHA-256, both calldata SHA-256 values and decoded-argument checks; source/runtime, storage slot and getter validation are accepted within RiskAnalyst’s documented scope, not independently rerun by BM. Full-held-share successful vault calls and Stake DAO payout-asset identities were checked against their raw records.

One source wording inconsistency is retained explicitly: roxFX's generic `source_code_scope` string mentions Gauntlet, while its specific runtime/source records identify VaultV2 and MorphoMarketV1AdapterV2 and match the pinned code. BM uses those specific records for the narrow roxFX source association; it does not silently edit the supplied receipt.

No BM frontend change is warranted by these account-specific results. Apyx's public dated receipt-configuration warning concerns a separate, still-open producer-monitoring gap. The curator/wrapper products have no corresponding production BM consumer to update, and RiskAnalyst owns the portfolio aggregation/scoring correction. Existing dashboard acceptance is unchanged; this incorporation is not a new deployment assertion.
