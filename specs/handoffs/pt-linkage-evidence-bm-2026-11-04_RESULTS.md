Latest consolidated owner return: [pt-linkage-evidence-bm-2026-11-04_CONSOLIDATED.md](pt-linkage-evidence-bm-2026-11-04_CONSOLIDATED.md). The initial package/version and pending-owner descriptions below are historical; current selected versions and owner disposition are in that consolidated return.

# PT-linkage assets — BM initial evidence return, 2026-11-04

Status: **initial partial evidence, unscored and private**. Current specialist walks and canonical documentary exports are pending. No score changes, schedule changes, approvals, transactions, PT/SY approval or publication. The June 7 light siUSD/sUSN assessments are not revalidated. Monad srUSDat does not inherit the Ethereum assessment.

## Exact identities and versions

- Monad 143 srUSDat: `0x17b8f7373ecd556192abfc85be314e5d4fb6b3fa`.
- Ethereum 1 siUSD: `0xdbdc1ef57537e34680b898e1febd3d68c7389bcb`.
- Ethereum 1 sUSN: `0xe24a3dc889621612422a64e6388927901608b91d`.

Local output: `.private-reviews/pt-linkage-evidence-2026-11-04/packages/manifest.json`. Each component has `current.json`, immutable content-addressed `snapshots/`, and field-level `coverage.json`. Assessment version stays null. The unscored evidence-pointer contract is explicitly separate from an accepted evidence/assessment pair. Earlier assembly versions remain retained; the manifest selects only the versions below.

| Component | Selected evidence version | Local share supply |
|---|---|---|
| siusd | sha256:89f10b9c9c9ae200a5480f13fbaeb53869f31e6c1a8c925240194b72f17e2f60 | 49301919.627469065029632329 |
| srusdat | sha256:569e37c5b389319a8c17381eade5fe77c4b233ae5b42fdae408d70ff178ab42c | 1028907.619118 |
| susn | sha256:e6e3881dad7ef4d6e7577d3caf5c20dc597531570ff2cf1fa86af32f27b23cbe | 28700477.640273032307735114 |

## Source clocks and scope

Financial reads reuse an existing read-only RPC client; BM did not duplicate Security's authority walk. Both block hashes were rechecked stable:

- Monad block **119347131**, **2026-11-04 14:11:45 UTC**.
- Ethereum block **26341963**, **2026-11-04 14:11:35 UTC**.
- Frozen `saturn_family.json`: Ethereum tranche context at **2026-11-04 12:47:20 UTC**. Its export does not expose a source block for every field; this remains null. Its family/tranche ratios do not become Monad backing or global Saturn solvency.
- November 2 accepted USDat sale legs: Ethereum block **26326317**, **09:51:59 UTC**; Monad block **118724873**, **09:52:09 UTC**. Receipt acceptance **09:56:48.806305 UTC** is not a new market observation.
- November 4 PT quote and failures retain each request/receipt and API mark clock, including **06:56:30.096 UTC** priceUpdatedAt. Curve cash context retains block **119261326**, **06:58:18 UTC**. These are asynchronous partial observations, not a combined current route simulation.
- Security reuse-only triage keeps its check time and original August Ethereum/PT/SY observations; it is not a fresh Monad authority measurement.

Original source paths/hashes and frozen files are retained in private raw/provenance files. No private profiles, holder balances, wallet addresses, bridge funding, calldata or private simulations are promoted to public surfaces. Public release is not requested. Exact quote inputs are retained only as bounded dated evidence, not recommended transaction sizes or capacity guarantees.

## Priority srUSDat accounting

Monad supply **1,028,907.619118 srUSDat**, 18 decimals. At the observed blocks:

- Monad `peers(30101)` returns candidate Ethereum adapter **0x3cf10056e15efd72bb175aa95264bae029f731ba**.
- Adapter `token()` returns known Ethereum senior **0xfaa9a0e1db9e22ae3a20b2b58a68dc24d053d066**.
- This senior token's `balanceOf(adapter)` equals **1,028,907.619118 shares**, also 18 decimals.
- Normalized candidate escrow minus local supply is **0.000000 shares**.

This is a **partial accounting match at separate chain blocks**, not an independently reconciled global bridge, authorized deployment or proof of exclusive minting. In-flight messages, other destinations/liabilities, shared-decimal/dust semantics, alternate mint/burn paths and effective controls remain unknown. Escrowed Ethereum shares and their remote representations must not be added as separate economic backing or independent liabilities. The full global accounting perimeter remains unresolved.

Local `asset()`, `totalAssets()`, `convertToAssets()` and `previewRedeem()` probes reverted. Actual failure results are retained. This establishes no supported local ERC4626 conversion at the tested block, not that every possible local route is impossible.

The package separates five stages:

1. **PT sale:** November 4 $100k API-marked PT input quote returns **95,684.104822694365110509 srUSDat shares**, not cash. Cancellable limit orders may contribute; API fees/impact are not total route cost. The tested $250k call failed with `MarketProportionTooHigh`; one failure is not zero liquidity everywhere. The tested direct PT→USDC nonaggregator call was unsupported.
2. **Share transport/local conversion:** LayerZero delivery and supported local conversion remain unestablished. Strata share transport is separate from Saturn underlying CCIP migration. No migration completion inferred from dates.
3. **Ethereum tranche redemption:** preview or zero tranche cooldown does not establish delivered USDat. Direct sUSDat-share output is a separate configuration.
4. **Saturn settlement:** underlying asynchronous queue remains separate; current queue eligibility and completion timing are null.
5. **USDat→USDC sale:** accepted November 2 tested-size quotes were positive on both chains. These do not establish prior conversion/delivery or actual final swaps. Actual-state missing intermediate tokens/allowances and preview-versus-redemption limits remain explicit, without copying holder details. No complete route passed in that bounded test.

The November 4 Curve USDC cash observation is pool context, not srUSDat liquid buffer or reserved executable capacity. Exchange-rate/NAV liquidation impairment remains separate from market discount, slippage and other unwind cost. No health-factor approval or PT/SY approval follows.

## siUSD and sUSN wrapper observations

siUSD's `asset()` returns iUSD **0x48f9e38f3070ad8945dfeae3fa70987722e3d89c**. Reported totalAssets and direct iUSD balance at the wrapper both equal **54,165,472.856414208269145261 iUSD**. One-share convert/preview returns **1.098648354175551517 iUSD**. Underlying iUSD totalSupply is retained separately from wrapper supply.

sUSN's `asset()` returns USN **0xda67b4284609d2d48e5d10cfac411572727dc1ed**. Reported totalAssets and direct USN balance at the wrapper both equal **35,426,246.528843832782320747 USN**. One-share convert/preview returns **1.234343447968722277 USN**. Underlying USN totalSupply is retained separately from wrapper supply.

These are **underlying token units**, not USD NAV, independently verified external reserves or available USDC. Matching totalAssets and token balance is a wrapper bookkeeping check. Full underlying exposures, liabilities/encumbrances, net NAV, loss ordering, external liquid buffers, queues/fees/access, sized exits and live controls remain explicit owner-scoped nulls where not established. Previews do not test withdrawal access or settlement. Historical private-credit/tranche descriptions are not copied as current exposures.

## Owner coordination and blockers

- **Security:** reuse-only return received at `/home/danger/security_analyst/handoffs/pt-linkage-existing-security-evidence-2026-11-04.md`, with source index. No current exact-deployment packet located. Historical August Ethereum two-day/nominal Safe records carry generator warnings and do not verify Monad. Follow-up was sent directly requesting ONE targeted current owner walk: srUSDat local mint/burn/pause/upgrades, Ethereum adapter, LayerZero endpoint/peer/delegate/config/security-stack controls, then exact siUSD/sUSN implementation/withdrawal controls. Completion pending; BM will not duplicate the walk.
- **DA:** existing `pt-linkage-profiles-defianalyst-2026-11-04.md` request confirmed in progress; directly asked for standard exact-component returns and issuer-authorized Monad linkage. Documentary claims and loss ordering remain pending canonical return; no duplicate profile commission.
- **DexTracker/price owner:** current siUSD/sUSN sized exits and price history remain pending. Consolidated request `specs/handoffs/pt-linkage-security-dex-bm-2026-11-04.md` was supplied to RiskAnalyst for existing-owner forwarding coordination. Direct Dex dispatch/completion is not claimed.
- **BM:** underlying iUSD/USN exposure/liability/NAV/cash reconciliation depends on documented source perimeter and producer inputs; no existing normal exact-asset backing feed located in this search. Bridge balance match needs Security semantics plus in-flight/other-chain reconciliation. Unknown is not zero.
- **RiskAnalyst:** source-critical review, assessment/score and accepted evidence-version binding after required returns. No updated score, feed, dashboard, staging or production approval is implied.

## Reproduction and verification

`tools/collect_pt_linkage_snapshot.py` is a one-off public accounting reader reusing the existing RPC client. `tools/build_pt_linkage_evidence.py` freezes existing producer/acceptance inputs and builds offline. No existing producers or sibling repos changed. No jobs installed. Private/local output paths are enforced.

`python3 -m unittest discover -s tests -p test_pt_linkage_evidence.py`: **7 tests pass**: exact identities and stable hashes, separate bridge accounting/execution, wrapper units versus cash, wrong identity rejection, missing escrow remains null, immutable prior-version retention and public-output rejection. All three packages validate against `specs/shared-asset-evidence-v1.schema.json` and field/privacy checks. No served UI changed; desktop/mobile and served hashes are not applicable to this private evidence-only return.

## Documentary adoption follow-up

DA return received and component export byte hashes checked against `HANDOFF_pt_linkage_profiles_RESULTS_2026-11-04.json`. Selected exact-component source fields adopted into new immutable versions selected in the table above; original chain/quote clocks unchanged and earlier versions retained. Monad srUSDat publisher authorization is now documentary-supported by the exact official frontend chain/address mapping; this does not clear live peers/authorities, escrow exclusivity or cash execution. siUSD FAQ three-tier loss ordering versus slashing-page two-tranche conflict is preserved; no verified waterfall inferred. sUSN issuer/operator distinctions, conditional unsecured claim, freeze/principal-reduction rights and separate unstaking/primary-redemption timing remain qualified dated facts. Full source profiles, hashes, summary text, xrefs and unrelated components are not copied into candidate fields.

Superseding owner status: DA documentary return is received; effective legal/financial/live-control gaps remain. Security final live packet pending (preliminary observations are not yet adopted). Dex was contacted directly after context check; quote packet pending. No score/assessment binding or publication. Origin RiskAnalyst `01a1a375-9b44-7b13-8ec5-19bf15296705`; BM `01a19a30-50e1-7bb0-b3cf-6bb2481f3835`.
