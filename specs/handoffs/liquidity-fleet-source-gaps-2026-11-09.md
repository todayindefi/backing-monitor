# Liquidity fleet — source-owner follow-up

Owners: DexTracker for structured ladders/inventory; PegTracker for authored legacy quote exports and bespoke primary-exit observations. RiskAnalyst retains specification, applicability and assessment decisions. No scores, transactions, jobs or schedule changes requested.

BM audit and repaired consumer: `specs/reviews/liquidity-fleet-2026-11-09/README.md`, per-view `audit-before.json`. Eight structured sources and 18 legacy quote-table views were found across 36 registrations. Full published observations and missing metadata are now visible; this does not close source gaps.

Dex: the existing syzUSD metadata repair request covers copied reUSD chain/leg descriptions and output assumptions. Please return that normal source with original observation clocks, identity bindings and explicit csUSDC receipt/cash distinction. Do not requote solely to fix descriptions. Seven structured sources still declare $100 baselines (USG, sUSDe, syzUSD, reUSDe, BOLD, Alto, fxUSD); identify supported current producer fields and a bounded adoption plan before any future measured refresh. reUSDe lacks a complete independently valued cash leg; Alto remains quote-only with supply/float/access limits. Do not treat this audit as a fleet-wide collection or method-migration commission.

Peg: reuse existing current exports to identify which legacy quotes can expose chain/pair, exact units, per-draw generation/receipt/block metadata, reference size/spread, threshold/refinement/stability and route/gas/expiry/access fields. Keep original clocks/nulls. Prioritize existing USDai/sUSDai, USDat/srUSDat and yzUSD/syzUSD work, coordinating with Dex to avoid duplicates. Report gaps and available normal fields first; no new broad quote run or recurring job is requested. Primary/queue/capacity views require their own contract; don't manufacture a price-impact crossing.

RiskAnalyst: this is presentation/source-gap evidence, not an assessment refresh. Confirm applicability before treating OUSD/USDD/CUSD missing sized sources or four tradfi views as failed DeFi-ladder compliance. Existing authored scores are preserved.
