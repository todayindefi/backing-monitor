# Ethereum BTC assets — consolidated bounded BM return

Source dates: November4, 2026 UTC. Assembly may fall on November5 Asia/Taipei; no source clock is renewed by that date change.

Origin RiskAnalyst **01a1a375-9b44-7b13-8ec5-19bf15296705**; BM **01a19a30-50e1-7bb0-b3cf-6bb2481f3835**. Exact Ethereum chain1 WBTC `0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599`, tBTCv2 `0x18084fbA666a33d37592fA2633fD49a74DD93a88`, LBTC `0x8236a87084f8B84306f72007F36F2618A5634494`.

BM accounting, Security controls/routes, Dex exits, LMT identity/denominator and selected accepted DA documentary facts are assembled. **Unscored, private, pending RiskAnalyst review; no assessment binding accepted.** No full-coverage/custody/settlement clearance. No jobs, trades, approvals, third-party outreach, score updates, UI changes or publication. PT remains parked; completed optional siUSD addendum stays with its owner and is not adopted here. Actual portfolio exposure remains unknown.

## Selected immutable versions

Private manifest `.private-reviews/ethereum-btc-assets-2026-11-04/packages/manifest.json`; each asset has `current.json` and content-addressed snapshots. Old versions remain. Canonical project/component and separate RiskAnalyst slug are explicit.

| Asset slug | Canonical project/component | Selected evidence version |
|---|---|---|
| lbtc | lombard-finance/lombard-lbtc | sha256:1af01e1381cd22b8eb781f5b973e0f5728a3560eb0ccf6f55f907c0b0d403d5d |
| tbtc | threshold-network/tbtc | sha256:33dc96b76d5e86a163bba4cbaf0e661a1dc4406344fee1f3411dc3628e937858 |
| wbtc | bit-global/wbtc | sha256:8cddb8ad40138d1e95c76ed192bb7e5d2b11eaa17f39a3f16d93cede7cad59c2 |

`field-source-parity.private.json` records selected field hashes, source owners, references, coverage and original clocks. Assessment versions are null. Source→package identities/joins are checked. RiskAnalyst selection/review is pending; TIDR/served BM surfaces were not requested or changed, so no three-surface, desktop/mobile or served-hash pass is claimed.

## tBTC: exact route matrix at the Security pin

Security Ethereum **26342414**, hash `0x3d47e1411b82e1206de9620f675b17802fdf514d2f0dfe3d3bc2e8ef568abf58`, **2026-11-04 15:41:47 UTC**. This is a saved pin, not renewed latest state.

| Route | Pinned finding | Limit |
|---|---|---|
| New optimistic mint | **Blocked** | Admitted-minter request and finalize both revert `Optimistic minting paused`. |
| Pending optimistic finalization | **Blocked** | Preexisting request does not bypass pause. |
| New canonical mint | Conditional | Trusted vault/deposit reveal and SPV sweep/Bank path are separate from optimistic pause; operators/Bitcoin settlement unverified. |
| Pending canonical mint | Conditional | Valid proof and admitted maintainer required; Bank callback mint is not a completion guarantee. |
| New redemption | Conditional | Sample watchtower safety and live wallet observed; exact UTXO, holder balance, script, capacity, signers and service remain conditions. |
| Pending redemption | Conditional; sampled pending | Latest three indexed Oct30–31 requests remain pending at pin; valid Bitcoin proof and applicable gates still required. |

**Operational reopening and BTC delivery remain unverified.** There is no global open/closed inference from token pause-bit absence, the news lead, secondary quotes, unmint/burn or Bank balances. Event discovery covers blocks26292414–26342414, not all historical/pending requests. Full wallet capacity, pending queue, guardian/authority enumeration and independent receipt/settlement audit remain unclosed.

Vault owner is nominal6-of-9 Safe; Bridge upgrade timelock measured86400seconds. Immediate governance paths also exist; not every operation has24h protection. No signer independence or operational availability inferred.

## WBTC: full published address inventory and independent balance match

The official frontend exposed [asset totals](https://www.wbtc.network/api/v2/assets), [native/bridged deployments](https://www.wbtc.network/api/v2/chains) and [paginated custody addresses](https://www.wbtc.network/api/v2/custodialAddresses?pageIndex=1&pageSize=20). BM captured all six pages: **109 unique addresses**. Their publisher balances sum exactly to **116,492.03385674 BTC**. Published native circulation is **116,479.19176143 WBTC**, and all seven published native chain rows sum to that total.

API assets publisher update **15:40:07.023 UTC**, received **15:42:24.265702 UTC** November4. Page1 recheck unchanged; assets recheck changed BTC price/updateTime but reserve/supply quantities stayed unchanged. Pages have separate HTTP clocks and no exposed common inventory observation block. Earlier HTML10:18 displayed gross reserves116,511.9939BTC remains an older source, not silently replaced/restamped; difference across those clocks is not a loss finding.

BM independently queried [Blockstream's public Esplora address API](https://blockstream.info/api/address/3PRCCQMdWwjEKy89iVdL8LouknsgygwWpL) for **all109** published addresses. Confirmed funded-minus-spent balances match each reported address balance, aggregate **116,492.03385674 BTC**, with aggregate mempool net0 at the observed responses. Capture **15:44:45.532626–15:45:08.264790 UTC**. Tip hash before/after is the same `000000000000000000017fa2219b939b8876aac971fb848a7ee958e48aeca634`. These are independently indexed balances, not per-address common-block RPC pins, cryptographic ownership/custody proofs or independently verified title.

Reserves minus **publisher** native circulation = **12.84209531 BTC-equivalent**, arithmetic only. Ethereum supply was independently read at BM's earlier Ethereum pin and equals the publisher Ethereum row in raw8-decimal units. Other native chains are publisher rows, not independently reconciled liabilities. Six published bridged deployments are listed separately; their native escrow, remote issuance, burns and in-flight units are not globally reconciled. Do not add bridge representations again as new native liabilities or claim full conservation.

Security matches direct WBTC runtime, observes unpaused/minting-not-finished, Controller ownership and nominal6-of-10 controller-owner multisig/dailyLimit0; Factory/Members/custodian paths are qualified. Ethereum role/control thresholds do **not** establish BTC key quorum or legal custody. Effective BiT Global/BitGo custody transition, Bitcoin beneficial/key control, encumbrances, complete Members authority, global liabilities and end-to-end merchant settlement remain open. March1 announcement scheduled May1 completion; elapsed calendar time is not confirmation. Full independently reconciled net backing stays null.

## LBTC: available NAV/strategy metrics versus missing liabilities

First-party [protocol report](https://api.lombard.finance/v2/transparency/reports/latest): as_of **November4 00:00 UTC**, source block_time **08:04:57 UTC**, created_at **08:12:24.513202 UTC**, received **13:08:18 UTC**. Reported gross BTC backing **7,076.47468652 BTC**, global supply **7,039.30342452 LBTC**. Raw lbtc_ratio is LBTC/BTC scaled1e18; reciprocal is the reported BTC-per-LBTC rate. ratio_block chain remains unestablished, not labeled Ethereum. Ethereum supply at BM pin is6,524.88177177LBTC; mixed-clock difference from reported global supply is not verified remote liabilities.

First-party [strategy allocation](https://bff.prod.lombard-fi.com/transparency/allocation), **November3 21:00 UTC**, received November4 13:08:18 UTC: reported strategy NAV **1,958.60342841 BTC**; listed account buckets **1,359.46328604 BTC**; **599.14014237 BTC basis/completeness residual unexplained**. It is not a measured loss, surplus or option-liability value. Do not clip values or derive measured passive reserves from mixed-clock gross-minus-active subtraction.

Signed manager snapshot at the same strategy close contains Greeks with original units, deployment47.358683757890205%, average maturity44.8472days, max87days and netSold=true. Deployment is a strategy-book metric, not measured share of total LBTC reserves. Signature matches the same publisher's key; key identity/financial/custody accuracy is not independently established. Greek/tenor data do not price the options book.

Exact public inputs: protocol `/reports/latest` provides gross totals/ratio; BFF `/allocation` provides NAV/account buckets; `/snapshots` supplies signed risk metrics; `/public-key` supplies same-publisher key. DA archived disclosure says individual trade lines are not published because they are manager proprietary execution. Full positions/strikes/marks/counterparty/netting liabilities, reconciliation of account-bucket basis and residual Babylon staked/unwinding/slashable inventory are unavailable in these inputs. **Options net liabilities, independent net strategy NAV and residual Babylon exposure remain null, not zero.** Strategy transition does not prove Babylon fully exited.

Documented feed observations at BM's older Ethereum pin are preserved separately: Chainlink descriptionLBTC/BTC reports **1.00170827 BTC/LBTC**, updated **November4 04:55:11 UTC**. RedStone generic description reports normalized1.005332, updated **November3 15:24:47 UTC**, quote unit unestablished. They are not assumed current Gauntlet leaf inputs or independent NAV. Security's later protocol-rate input is1005280531290996973/1e18 with inverse ratio994747206250761037/1e18, agreeing with the first-party accounting rate at its scope. Different references/clocks do not establish an oracle error, full backing, or1:1LBTC entitlement.

Security matches StakedLBTC implementation and observes paused=false, mintBurnPaused=false and redeems enabled, with LombardTimeLock minimum86400seconds for named admin paths. Multiple candidate minters exist; router is not the only admitted minter and enumeration is not exhaustive. Consortium pointer does not establish quorum; actual Bascule is GMPBasculeV1, with observed validateThreshold0/trusted signer but unresolved full semantics. Consortium/remote attestation, minter limits, operational-role chains, complete upgrades/router/mailbox settlement, actual BTC delivery and custody agreements remain gaps.

## Sized exits: all three exact Ethereum tokens

Dex reused **nine saved quotes**, collected **14:37:01.506934–14:37:18.024596 UTC November4**; no refresh inferred from release from parked status. Inputs use separate dated external market USD marks, not one-dollar tokens, private holdings or assumed LBTC1:1 NAV. USDC outputs below are token units **before gas**, not realized cash.

| Asset | Target market USD | Actual token input | Quoted USDC | Added average-rate impact vs $100k sample, bps |
|---|---:|---:|---:|---:|
| lbtc | 100000 | 1.27913535 | 100595.819723 | 0.0000 |
| lbtc | 1000000 | 12.79135357 | 1000654.79115 | 52.7200 |
| lbtc | 10000000 | 127.91353571 | 9392578.828917 | 663.0526 |
| tbtc | 100000 | 1.280639779651743528 | 100560.484253 | 0.0000 |
| tbtc | 1000000 | 12.806397796517435288 | 1003976.462992 | 16.1930 |
| tbtc | 10000000 | 128.063977965174352882 | 9624568.400054 | 429.0751 |
| wbtc | 100000 | 1.27869765 | 100369.486453 | 0.0000 |
| wbtc | 1000000 | 12.78697653 | 1001937.606733 | 17.5079 |
| wbtc | 10000000 | 127.86976539 | 9875061.77382 | 161.2910 |

Baseline impact0 is by definition, not zero total cost. Market-value discount/BTC-spot comparison, added average-rate impact, raw provider fees and gas remain separate. API sizing marks/BTC/USDC prices and pool block hints have different clocks; updated response time is not proof every pool refreshed. Minimum-out/expiry are null. No fills, native BTC payout, max capacity, reserved depth, oracle/lending or vault approval inferred. Continuous price/NAV history remains unavailable.

## Gauntlet: candidate verified, reported opportunity not reproduced

LMT confirms Ethereum USDC Core vault **0x8eB67A509616cd6A7c1B3c8C21D48FF57df3d458**, USDC loan asset. Indexed vault clock **14:24:47 UTC**, block **26342029**; received **14:33:19.293958 UTC**. Nested market clocks differ and remain per market.

API gross ex-reward APY6.6600528652%; net ex-reward6.3167531079%; performance-fee fraction0.05. Realized average net lookback unspecified, not assumed seven-day. Exact BTC collateral-market vault-supplied USDC / vault-total-USDC allocation shares: **WBTC45.1090399352%, tBTC18.0667922815%, LBTC14.1011711297%**. These are loan-supply allocation exposures, not private portfolio weights, posted collateral, borrower concentration or market-wide debt. Other markets exist; do not normalize these three to100%.

The reported6.95% base APY and27.5/18.3/13 percentages are not reproduced; original quote date/denominator/APY definition unavailable. Candidate is absent from the captured normal LMT feed; no substitute vault/chain used. Raw allocation residual21,579,802USDCbase units and USD residual21.07570292049079 are not proved idle cash. Existing reader's removed `uniqueKey` field caused400/None; owner repaired it to `marketId` preserving output/unavailable behavior, with two tests. No BM sibling edits. Oracle addresses are captured but leaf feeds, borrower concentration, redeemable vault cash and all gates are not established.

## Verification, files and disposition

Security source index: **72 files**, owner11 consistency checks; BM verifies all hashes/control pointers. Dex manifest/selected native token joins and LMT **23-file** manifest verified. DA exact-component selected fields retain document dates; private parent summaries/xrefs/events/profile hashes omitted from candidate payloads. Independent WBTC raw responses/hashes, API pages, endpoint discovery and one-off capture-script audit copies remain private. All nested raw inputs are included in private provenance.

**10 focused BM tests pass**, including exact identities/canonical mapping, immutable repeatable versions, original clocks, rate direction/generic-unit unknown, owner-file tamper rejection, wrong-token rejection, quotes versus fills/NAV, denominator/mixed clocks, all109 balances versus full backing, incomplete-indexer response stays null, and tBTC route blocking versus reopening/settlement. All three full shared schemas and snapshot-byte hashes pass. `validation.private.json` and `field-source-parity.private.json` record checks/consumer gaps.

Changed BM paths: `tools/build_ethereum_btc_evidence.py`, `tools/collect_ethereum_btc_snapshot.py`, `tools/ethereum_btc_owner_evidence.py`, `tools/ethereum_btc_security.py`, `tools/ethereum_btc_wbtc.py`, `tools/ethereum_btc_lbtc.py`, `tests/test_ethereum_btc_evidence.py`, this handback and dispatch/status notes. No live data/dashboard/job changes. Local private snapshots are versioned but not production-published.

**For RiskAnalyst:** review these exact versions, distinguish supported bounded conclusions from the named open branches and decide assessment scope/unscored/provisional status. No accepted assessment version, grade or readiness is inferred from delivery. Missing private financial/custody inputs are explicit results, not a reason to keep collecting indefinitely under this one-off brief.

## RiskAnalyst acceptance recorded

RiskAnalyst accepted the exact three versions listed above at **2026-11-04 16:17:23.454049 UTC**, receipt `riskAnalyst/data/reviews/ethereum-btc-assets-2026-11-04/consolidated-acceptance-2026-11-05.json`. Disposition: **accepted bounded source evidence; collection pass closed with explicit gaps; no current grade or assessment binding**. The initial pending-review wording above describes delivery state and is superseded by this receipt. All evidence bytes, original clocks and explicit nulls remain unchanged. Local receipt and review status are retained privately alongside the packages.

The Security machine summary supplied again by the user byte-matches the frozen adopted input. Its MCP notification failure does not affect filesystem evidence ingestion or the matched RiskAnalyst acceptance. Authored asset-report review is RiskAnalyst's next step; no further general collection, owner wait, score update or publication is implied.
