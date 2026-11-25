# Ethereum rETH Liquity LP Carry operator and withdrawal evidence

Assessment input for exact Ethereum vault `0xb9e806e8f2d94c015ffefa90cd24ecce18f1663c`, with 20-decimal shares and underlying WETH `0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2`. This follows the November 22 exact-vault evidence and November 24 audit mapping. It adds a current financial and withdrawal observation. Effective operator privileges remain SecurityAnalyst's scope.

## Publisher operator status

IPOR's exact registry row reports `managedByIporAlpha=true`, `alphaOperational=false`, `INSUFFICIENT_GAS` and `MISSING_ALPHA_ROLE`. The registry creation clock is 2026-11-25 13:54:38.789503295 UTC, HTTP Last-Modified is 13:54:40 UTC and HTTP Date is 13:54:41 UTC. Local retrieval reads 13:54:17.198524 UTC. The publisher clocks lead the local clock and the row has no separate update timestamp. The flag describes reported Alpha rebalance readiness. Native funding, authority and any alternate operator remain independently unverified in this evidence. [IPOR registry](https://api.ipor.io/v2/fusion/vaults) · [IPOR field definitions](https://ipor.io/docs/build-on-fusion/developer-guide/api)

## Pinned withdrawal accounting

Ethereum block **26,492,625**, hash `0x28b0416fa89cbe13e8c0f6cb0754932bfeffb853606b271770b7b0c5998eae16`, block clock **2026-11-25 13:54:35 UTC**. First native read series ended 13:54:23.580089 UTC on the local clock. The balance-delta call returned at 13:54:46.103246 UTC. All native calls used the same hash with canonicality required. [Ethereum block](https://etherscan.io/block/26492625) · [Vault source](https://eth.blockscout.com/address/0xb9e806e8f2d94c015ffefa90cd24ecce18f1663c?tab=contract)

| Field | Pinned observation |
|---|---:|
| Physical idle WETH | 675.079422737907532858 WETH |
| Active manager aggregate shares to release | 15.68262903004432216813 shares |
| Book value of aggregate release reservation | 15.343665793006246417 WETH |
| Idle less that measured reservation | 659.735756944901286441 WETH |
| Manager's separate vault-share balance | 15.80467428878634524809 shares |
| Standard withdrawal fee setting | 0.2% |
| Request fee setting | 0.2% |
| Last recorded release timestamp | November 21, 07:21:00 UTC |
| Per-request withdrawal window configured | 86,400 seconds |

The vault's manager pointer resolved to `0xe99b6ef767a42131263bdd3d4a0a7c16b32f0543`, whose vault getter returned the exact vault. The 659.7358 WETH remainder is an idle-cash bound after the measured release amount at book conversion. The manager's share balance is a separate quantity and cannot be counted again as cash or assumed to equal pending requests. Request redemption depends on the specific request's window, release timestamp and available shares. The last release timestamp and window length do not alone establish the status of every request. Any additional outstanding requests and full eligible withdrawal capacity remain unmeasured. [Vault and bundled manager interface source](https://eth.blockscout.com/api/v2/smart-contracts/0xae4362a98cd22f711f9b9f3edb9bb1379a573c) · [Withdrawal manager](https://etherscan.io/address/0xe99b6ef767a42131263bdd3d4a0a7c16b32f0543)

## Bounded withdrawal test

An unsigned, hash-pinned `eth_call` exercised the standard `redeem` path with the synthetic holder as owner and recipient. The holder's actual share balance was zero. An ERC20 balance mapping override set only the synthetic holder's share balance to **1.02209141163597147952 shares**, the native book conversion for 1 WETH. The preflight verified that balance and the same `maxRedeem`. The vault's cash, share supply, manager reservations, access roles and request state were left at the pin. No allowance, role, or request was fabricated. The holder could call the route with that test balance despite the publisher's Alpha flag.

- `previewRedeem` returned **0.997999999999999999 WETH**. The separate `previewWithdraw(1 WETH)` returned **511.045705817985739765 shares**, consistent with the previously observed divide-by-withdrawal-fee preview implementation. This is a view discrepancy. The 0.2% fee and the tested standard redemption are separately evidenced.
- Direct `redeem` returned **0.998000000003434227 WETH**. A second call at the same block used temporary code on the same synthetic address to measure the actual WETH balance increase, **0.998000000003434227 WETH** from zero. This simulated receipt is before network gas.

Reproduction uses the canonical block hash, public ERC4626 and WETH calls, and a state diff on the synthetic holder's OZ ERC-7201 ERC20 balance mapping. The balance-delta helper reads WETH before and after calling `redeem` from that same address. No approval, live transaction, operator-assisted unwind, request claim or settlement was executed. The test covers a small standard withdrawal at one pin. Larger exits, new request releases, operator-assisted liquidity, and realizable total cash remain open.
