# Ethereum fxUSD financial and dashboard handback

Exact token 0x085780639CC2cACd35E474e71f4d000e2405d8f6. The selected PegTracker backing export was assembled November 27 at 05:52:50 UTC from Ethereum block 26,504,573 (05:52:47 UTC). Two enumerated pools carried 21,483,136.530 fxUSD debt versus supply of 21,483,210.237, leaving 73.706 fxUSD unexplained. The reported $32.244m marked collateral was 150.09% of pool debt.

| Pool | Raw collateral | Anchor | Modeled value | Debt | Collateral / debt |
|---|---:|---:|---:|---:|---:|
| wstETH | 4,926.123845 stETH-equivalent | $1,743.097500 | $8.587m | 5.206m fxUSD | 164.95% |
| WBTC | 381.935836 WBTC | $61,939.693578 | $23.657m | 16.278m fxUSD | 145.34% |

The raw wstETH pool unit is already stETH-equivalent. WBTC accounts for 75.77% of enumerated debt. The pool read fixes the observation block; original upstream oracle update timestamps are unavailable. These are marks on collateral pledged to leveraged positions. They do not establish liquidation recovery. The separately timed aggregate spot mark was $0.99972149 at 05:15:19 UTC. At the backing pin, fxSP held 15.165m fxUSD, 70.59% of supply. The remaining 6.318m is outside fxSP, with freely tradable supply unmeasured. [Backing block](https://etherscan.io/block/26504573)

At a separate public pin, block 26,504,608 on November 27 at 05:59:47 UTC, the PoolManager returned paused=false. The configured, previously source-qualified implementation remained bound to the same configuration and oracle. Its price-state getters returned isRedeemAllowed=false and isBorrowAllowed=true. The reader did not obtain archive access to align the gates at the older financial block. The current pin establishes a closed price-state gate while the manager was unpaused. Neither the numeric oracle threshold, effective redemption fee, complete per-route execution state, eligible funded capacity nor cash settlement was established. [Gate block](https://etherscan.io/block/26504608)

Secondary fxUSD → USDC quotes started November 26 at 23:47:25 UTC and were published at 23:48:18 UTC. The 50 bps marginal quote bracket was $3.232422m–$3.250000m and the 200 bps bracket $3.601563m–$3.636719m. Both met the producer precision requirement relative to the first valid $1,000 rung. Quotes for nominal $10k/$100k/$1m returned 9,998.052408 / 99,978.248928 / 999,608.934162 USDC before gas. Quotes are indicative and separate from protocol collateral delivery and funded settlement. [Route documentation](https://docs.kyberswap.com/kyberswap-solutions/kyberswap-aggregator/developer-guides/execute-a-swap-with-the-aggregator-api)

The public BM host serves a staged, unlisted fxUSD dashboard. Both serving origins matched each other for the captured payloads. The served backing at 04:53:35 UTC showed 149.13% collateral/debt, behind the selected 05:52:47 observation. The served secondary batch matches the selection. Browser checks confirmed the staging banner and dated gate qualifications. The quote producer leaves current primary state and capacity unknown. Use the separately pinned gate observation and keep the historical refusal separate. No dashboard registration, report or score was changed.
