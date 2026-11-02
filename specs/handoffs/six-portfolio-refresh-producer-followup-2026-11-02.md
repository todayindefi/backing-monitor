---
status: evidence_required
from: backing-monitor
to: PegTracker, DexTracker, PendleTracker, LendingMarketTracker, FarmTracker
date: 2026-11-02
---

# Source-owner evidence obligations after BM first-wave repairs

This file records follow-up requirements; it is not proof of delivery or owner acceptance. User requested current measurements and dashboard upkeep through BM. No trades, transfers, score changes or notifications are authorized by this file.

BM return: `specs/reviews/six-portfolio-refresh-2026-11-02/README.md`. Portfolio identities, gross legs, owner clocks, unsigned PT quotes and exact-address lending joins are retained locally in `.private-reviews/six-portfolio-refresh-2026-11-02/` (gitignored; do not publish holdings or calldata).

## PegTracker

- `apyx_backing_analyzer.py` backing collateral_ratio_basis and surplus_deficit_basis still include stale fixed examples (99.20/98.86 and 99.22/98.88) and say netting always lowers coverage. The current source itself correctly explains netting moves coverage away from 1 on either side of par. Replace fixed examples with current operands or direction-neutral wording. Preserve 101.9496% attested ratio, gross 100.99047% and reconstructed netted 101.94965%, residual about -0.00005pp. Do not overwrite one basis with the other.
- Source observation remains November 1 09:59:07Z; November 2 regeneration must keep the stale Accountable warning. Consumer now calculates age from the source timestamp.
- Saturn current issuer disclosures describe Ondo STRCon, while sUSDat producer reserves remain an oracle-implied remainder labelled off-chain STRC. Bind latest implementation, token balances, oracle/processor accounting, custody and issuer claims. Return observed block/time, token units and independent versus attested scope. Do not re-label an implied remainder as verified STRCon custody. Preserve implementation-drift and low-buffer flags pending reconciliation.
- Alto composition/swap-count/concentration claims were removed from static metadata. Return current supported reserve and CDP denominators, lifetime event scan bounds and holder route/eligibility before new numeric composition claims are added.

## PendleTracker + FarmTracker

- Exact PT/SY/market/expiry confirmed by November 2 API and on-chain identity reads; see private packet. SY assetInfo accounting denomination is apxUSD; SY getTokensOut returns only apyUSD. A PT is not one apyUSD share. November 5 maturity does not establish a USDC cash settlement or February rollover.
- Existing `swap_price_impact` discards amountOut, minTokenOut, fee, output token, intermediate routing and quote clocks; collector sizes by USD/price rather than exact current PT units. Return those fields for exact held units, native and aggregator routes, with gas, limit-order expiries and simulation status. API quotes alone do not establish sender eligibility or executable eth_call success.
- Confirm live held units and owner identity, router/index settlement after maturity, apyUSD unlock queue/cooldown/current fee, apxUSD redemption eligibility and final stablecoin exit. No action is requested.

## LendingMarketTracker + FarmTracker

- Exact-address joins find Morpho fxSAVE/USDC and Euler K3 PYUSD/RLUSD debt vaults. Aave joins are pool addresses with multiple reserves: use chain + supplied-token + debt-token identity. Fluid reUSD/GHO's captured address had no match; do not join a different GHO market by name.
- Return account-specific oracle basis/value/round time, token roles, collateral factor/LLTV/liquidation thresholds, current HF, borrow supply/utilization/caps and cash liquidity, plus observed block/time. Current oracle status `ok` reflects discovery/configuration, not current oracle round freshness. Some DB timestamps are naive; declare timezone explicitly.
- Separate NAV accretion, paid borrow APY, supply rewards and borrow incentives. LendingMarketTracker SQLite rates are percent; FarmTracker feed rates are decimal fractions. Reward spot marks are not realized cash yield.
- Return actual-size unwind quotes/simulations for Morpho, both sUSDe debts, syrupUSDC/K3, Fluid reUSD/GHO, Monad syrupUSDC/GHO and Plasma syrupUSDT/GHO. Preserve gross debt/collateral and chain identity; generic asset depth is insufficient.

## DexTracker / remaining venue coverage

Return remote-chain syrup/GHO venue inventory separately from executable depth, plus failed/stale route states. Strategy/LP/vault evidence for Stake DAO/Mento, K3/RockawayX/Felix/Gauntlet, gUSDC, Lighter LLP, Flowdesk, TIDMM/Lagoon and TIDAVAY is unresolved. Identity/ownership and duplicate reconciliation remain with FarmTracker; risk judgments and authored scores remain with RiskAnalyst.
