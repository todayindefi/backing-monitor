Latest consolidated BTC owner/accounting return: [ethereum-btc-assets-bm-evidence-2026-11-04_CONSOLIDATED.md](ethereum-btc-assets-bm-evidence-2026-11-04_CONSOLIDATED.md). Prior versions, partial coverage and parked status below are historical; see the consolidated return for current selection and remaining gaps.

# Ethereum BTC assets — BM initial evidence return, 2026-11-04

Status: partial one-off packages, no assessment or publication authorization. Documentary prerequisite accepted separately. No transactions, schedules, portfolio balances or vault approval. No dashboard changes; desktop/mobile and served hashes do not apply to these local packages.

## Frozen packages

Local root: `.private-reviews/ethereum-btc-assets-2026-11-04/packages/`; `manifest.json` selects content-addressed snapshots, with assessment_version null. Raw captures and source-file hashes remain private in the adjacent `raw/` and `provenance.private.json`.

| Ethereum asset | Evidence SHA-256 |
|---|---|
| WBTC | ae833832f737e90f72411941e094b30fdc1b9975ec9b0c7c7e119d98e4017c8f |
| tBTC | ce04068593aa45b2c1fac033c8531b2ac200bc7cf98b5622bcfda9747a974cc5 |
| LBTC | a0b1da9d07c9c61d6875df002040e84f7784f75fc5117fc1647d1dc14f966700 |

Shared six-axis field conventions are used; these are initial evidence manifests, not accepted evidence/assessment pair pointers. No invented scores or inherited LBTC 1:1 assumptions.

## Measurements and clocks

Ethereum chain 1, block 26340868 (`0x191ee04`), 2026-11-04 10:31:35 UTC, hash rechecked stable. ERC20 metadata/code presence and totalSupply only, not a Security authority attestation. Ethereum supply: WBTC 116,132.18373262; tBTC 4,185.15515226; LBTC 6,524.88177177. None is global liability supply.

WBTC [publisher transparency](https://www.wbtc.network/transparency), captured 10:31:46 UTC: displayed update `11/04/2026 10:18`, timezone unspecified. Reported global circulation 116,479.1918 WBTC and gross reserves 116,511.9939 BTC. Arithmetic difference 32.8021 BTC-equivalent is publisher-only, not independently verified unencumbered surplus. Published Ethereum row agrees with the independent supply within its four-decimal rounding. Only a paginated subset of BTC addresses was captured; full independent reserves and liabilities reconciliation remains blocked. Current effective custody/key control and completion of the announced BiT Global transition remain unverified. Merchant burns do not prove final BTC delivery.

LBTC [protocol report](https://api.lombard.finance/v2/transparency/reports/latest), received 13:08:18 UTC: as_of November 4 00:00 UTC; block_time 08:04:57 UTC; created_at 08:12:24.513202 UTC. Gross backing 7,076.47468652 BTC and reported supply 7,039.30342452 LBTC. Ratio is LBTC/BTC scaled 1e18 and must be inverted for BTC/LBTC. Its ratio_block chain is unestablished; it is not labeled Ethereum. This is not independent net NAV after options liabilities.

LBTC [strategy allocation](https://bff.prod.lombard-fi.com/transparency/allocation), asOfInstant November 3 21:00 UTC, received November 4 13:08:18 UTC: first-party strategy NAV 1,958.60342841 BTC, listed accounts 1,359.46328604 BTC, residual 599.14014237 BTC. Basis/completeness unexplained: not loss, surplus, or measured options liability. Do not subtract mixed-clock strategy NAV from gross backing to claim measured passive allocation. Options net liabilities and residual Babylon exposure remain null. Latest three strategy snapshot signatures match the same publisher's public key; this authenticates returned bytes against that key, not financial accuracy, custody or key identity. Greek metrics do not value options liabilities.

Documented LBTC Chainlink feed reports 1.00170827 BTC/LBTC at the pinned Ethereum block. RedStone generic description does not establish quote unit; do not call its numeric answer net NAV or confirmed BTC/LBTC. Original feed update timestamps remain in raw observations; fetch time must not replace them.

tBTC reported mint/redemption pause remains a documentary lead. Current reopening, exact Bridge/Vault/optimistic/canonical routes, new requests versus already pending requests and final delivery eligibility remain unknown pending Security's return. Token metadata does not establish an open bridge.

## Explicit owner blockers and routing

- Security: `ethereum-btc-assets-security-2026-11-04.md`; prioritize tBTC current pause/reopening and affected routes, then LBTC/WBTC control.
- DexTracker: `ethereum-btc-assets-dextracker-2026-11-04.md`; BTC-relative executable exits at supported $100k/$1m/$10m sizes. Failure/unavailable does not mean zero liquidity.
- LendingMarketTracker: `ethereum-btc-assets-feed-join-lmt-2026-11-04.md`; exact Gauntlet opportunity identity, denominators and APY. Existing historical vault reader returned HTTP 400/None; no validated join. User-reported opportunity is not a portfolio holding.
- BM: full WBTC BTC-address inventory and reserve/liability/custody reconciliation; LBTC complete net strategy valuation, options positions/liabilities and residual Babylon exposure.
- RiskAnalyst: assessment review and explicit accepted evidence/assessment binding after owner returns. Scores and feed publication remain pending.

Requests were supplied to RiskAnalyst for forwarding coordination; this is not confirmation that specialist owners have accepted or completed them. No sibling repository writes.

## Reproduction and checks

`tools/collect_ethereum_btc_snapshot.py` reuses existing read-only RPC and LMT clients for the one-off capture. `tools/build_ethereum_btc_evidence.py` builds offline from frozen captures. WBTC extraction is explicitly pinned to reviewed captured values and refuses changed HTML; it is not a recurring live producer. Output is restricted to private/local directories.

`python3 -m unittest discover -s tests -p test_ethereum_btc_evidence.py`: 2 tests passed: content hashes/repeatability, rate direction, original strategy clock, unexplained residual, null liabilities/exits and public output rejection. Source/privacy validation passed. No network calls in the assembler, no profile hashes/private account data in candidate payloads, no live dashboard/feed updates.

## Follow-up: direct dispatch, canonical identities and bounded accounting

Origin RiskAnalyst `01a1a375-9b44-7b13-8ec5-19bf15296705`; BM `01a19a30-50e1-7bb0-b3cf-6bb2481f3835`. RiskAnalyst received the initial return and recorded initial review; **no assessment binding has been accepted**. Receipt is not acceptance.

Latest contexts were checked and all three requests were delivered directly (messaging acknowledgments): Security `01a1911f-0fce-7a73-a48c-00879f9cd0f9`, DexTracker `01a186c3-10be-7d93-9887-8ef323ed95f0`, LendingMarketTracker `01a199f5-964f-70d1-8293-8aa2e1e11205`. These are separate BTC requests, not duplicate PT commissions. Security acknowledged BTC queued after finalizing its PT packet; Dex/LMT completion pending.

Corrected selected versions below supersede the initial table while retaining its immutable snapshots. Canonical project/component is explicit, separate from RiskAnalyst slug. Source measurement clocks unchanged; metadata/accounting coverage improvements are not new market observations. All three now validate against the full shared JSON schema.

| Asset | Canonical project/component | Selected SHA-256 |
|---|---|---|
| lbtc | lombard-finance/lombard-lbtc | f6d9e1fb638b0174bc606444f83960ac2f2e90a2a11680c70eb204fe7ebc5dd1 |
| tbtc | threshold-network/tbtc | db6f16f681ad07555e047db4e33eb4e278415e74edfe7adf8ce995bbd1b09c8f |
| wbtc | bit-global/wbtc | 9d7ac74b300d83002c658316ac46af99acf63f811a34764eac41bd09d5b5ba37 |

WBTC: seven displayed publisher chain rows sum to 116479.1918 WBTC and reconcile to its displayed global circulation at four-decimal precision. Captured first-page 20 BTC-address balances sum to 43233.5014 BTC; these are publisher subset balances, not an independent Bitcoin verification. Complete paginated inventory, independently pinned Bitcoin balances/UTXOs and legal title/encumbrance/current key attestation are absent from the captured packet. They are explicit unavailable inputs, not inferred clean backing or missing reserves.

LBTC exact available sources: `https://api.lombard.finance/v2/transparency/reports/latest` supplies gross backing/supply/ratio, `https://bff.prod.lombard-fi.com/transparency/allocation` supplies strategy NAV/account buckets, and `/transparency/snapshots` supplies signed Greek/tenor/deployment metrics. None supplies full individual option positions/strikes/marks/counterparty liabilities/closeout-netting reconciliation or a residual Babylon inventory. DA archived `lbtc-reserves.txt` explicitly states individual trade lines are not published (manager proprietary execution). Those missing inputs block independent net option-liability/NAV reconciliation. A signed manager snapshot or PoR is not a substitute. Mixed-clock gross-minus-active subtraction remains null as measured passive allocation. No further arbitrary endpoints or stale PegTracker 1:1 aliases substituted.

Workstream priority supersession: BTC is PARKED pending explicit RiskAnalyst release after PT-linkage review/acceptance. All three owners notified directly; no automatic queue resume. Preserve existing bounded results and original clocks; no further BTC reads/research requested. Dex/LMT reported already-completed bounded captures retained privately, not adopted while parked.
