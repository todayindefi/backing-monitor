# Ethereum WBTC / tBTC / LBTC sized exits — DexTracker handback

To BM thread01a19a30-50e1-7bb0-b3cf-6bb2481f3835 and origin RiskAnalyst thread01a1a375-9b44-7b13-8ec5-19bf15296705.
Request: /home/danger/backing-monitor/specs/handoffs/ethereum-btc-assets-dextracker-2026-11-04.md
Evidence root: /home/danger/DexTracker/data/exit_evidence/ethereum-btc/2026-11-04/; manifest.json hashes retained files and this handback. review_summary.json is the compact versionable owner packet; btc_wrapper_usdc_quotes.json retains all route responses.

## Release and reuse

Direct user priority via BM releases BTC as the sole active workstream and parks remaining PT/siUSD work. This handback validates/packages the already-completed capture; no fresh quote/RPC/price requests were made on release. Original clocks were preserved while parked. PARKED.json remains a historical ledger, superseded by RELEASED.json. The parking-era manifest is retained as manifest-before-release.json. Existing local quote commissions and BM BTC assembly were checked; no pre-existing scoped WBTC/tBTC/LBTC quote packet was found in DexTracker handoffs/docs, so this bounded capture reused the established KyberSwap client. No new API adapter, recurring collector, job or transaction.

Existing producer: aggregator_quotes.KyberSwapClient.route at revision 9f57c0ae6d30e3fe62ea2219b9a514f63659d755. Route capture 2026-11-04T14:37:01.506934+00:00–2026-11-04T14:37:18.024596+00:00 UTC. GET https://aggregator-api.kyberswap.com/ethereum/api/v1/routes. Router0x6131B5fae19EA4f9D964eAc0408E4408b66337b5. Original price-source HTTP response and request/receipt clocks retained, obtained before the quote ladder.

## Exact identities and dollar sizing

Ethereum chain1 only. WBTC0x2260fac5e5542a773aa44fbcfedf7c193bc2c599 (8decimals), tBTCv2 0x18084fba666a33d37592fa2633fd49a74dd93a88 (18decimals), LBTC0x8236a87084f8b84306f72007f36f2618a5634494 (8decimals), output USDC0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48 (6decimals). Exact-address decimals were read through existing publicnode eth_call at latest; metadata read clocks/raw words retained; not a pinned financial reconciliation.

Target $100k/$1m/$10m sizes use each wrapper's independent exact-address DefiLlama market USD mark. Input raw=floor(targetUSD/wrapperMark×10^decimals). Actual token inputs are below. No BTC-to-USD notional assumption, shared wrapper mark or LBTC1:1BTC sizing. The BTC price is a distinct market benchmark and does not size LBTC inputs or establish NAV/redemption entitlement.

| Mark | USD price | Source UTC | Received UTC | Confidence |
|---|---:|---|---|---:|
| WBTC (ethereum:0x2260fac5e5542a773aa44fbcfedf7c193bc2c599) | 78204.569856 | 2026-11-04T14:37:01+00:00 | 2026-11-04T14:37:01.503880+00:00 | 0.999 |
| tBTC (ethereum:0x18084fba666a33d37592fa2633fd49a74dd93a88) | 78085.97045704292 | 2026-11-04T14:22:58+00:00 | 2026-11-04T14:37:01.503880+00:00 | 0.99 |
| LBTC (ethereum:0x8236a87084f8b84306f72007f36f2618a5634494) | 78177.80928311958 | 2026-11-04T14:22:58+00:00 | 2026-11-04T14:37:01.503880+00:00 | 0.99 |
| USDC (ethereum:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48) | 0.9998285792 | 2026-11-04T14:37:01+00:00 | 2026-11-04T14:37:01.503880+00:00 | 0.999 |
| BTC (coingecko:bitcoin) | 78527.8 | 2026-11-04T14:37:01+00:00 | 2026-11-04T14:37:01.503880+00:00 | 0.999 |

Mark source: https://coins.llama.fi/prices/current/ethereum:0x2260fac5e5542a773aa44fbcfedf7c193bc2c599,ethereum:0x18084fba666a33d37592fa2633fd49a74dd93a88,ethereum:0x8236a87084f8b84306f72007f36f2618a5634494,ethereum:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48,coingecko:bitcoin. Prices are indexed observations, not independent same-time trades. tBTC/LBTC marks are approximately14minutes older than quote receipts. BTC/WBTC/USDC marks have different clocks from those older wrapper marks. A positive quote return versus an indexed mark is not a proved arbitrage or evidence of free liquidity. No continuous peg/history series was accepted or reconstructed; longitudinal stability/source-owner history coverage remains missing. No trend inferred from these samples.

## Quotes: token proceeds, market comparison and size impact

| Token | Target USD | Exact native tokens in | Raw input | USDC quote | Added avg-rate impact vs $100k baseline (bps) | Signed return vs dated market mark (bps) |
|---|---:|---:|---:|---:|---:|---:|
| WBTC | 100000 | 1.27869765 | 127869765 | 100369.486453 | 0.000000 | 35.228134 |
| WBTC | 1000000 | 12.78697653 | 1278697653 | 1001937.606733 | 17.507912 | 17.658545 |
| WBTC | 10000000 | 127.86976539 | 12786976539 | 9875061.77382 | 161.290953 | -126.631017 |
| tBTC | 100000 | 1.280639779651743528 | 1280639779651743528 | 100560.484253 | 0.000000 | 54.324609 |
| tBTC | 1000000 | 12.806397796517435288 | 12806397796517435288 | 1003976.462992 | 16.193036 | 38.043605 |
| tBTC | 10000000 | 128.063977965174352882 | 128063977965174352882 | 9624568.400054 | 429.075127 | -377.081451 |
| LBTC | 100000 | 1.27913535 | 127913535 | 100595.819723 | 0.000000 | 57.857607 |
| LBTC | 1000000 | 12.79135357 | 1279135357 | 1000654.79115 | 52.719999 | 4.832582 |
| LBTC | 10000000 | 127.91353571 | 12791353571 | 9392578.828917 | 663.052597 | -609.031254 |

The baseline is the smallest requested $100k sample **for each exact input asset**. Added average-rate cost=10000×(1−(USDCout/inputTokens)/(baselineUSDCout/baselineInputTokens)); it excludes baseline market spread and is not incremental marginal impact. Signed market-mark return=10000×(USDCout×USDCmark/(inputTokens×wrapperMark)−1). Proceeds are USDC token units; marked USD values are arithmetic using the external USDC reference, not dollars settled to a bank. Gas is not subtracted from these numbers. Three successes do not locate a depth crossing, maximum capacity, enforceable fill, or any larger-size availability.

### BTC-relative benchmark, separate from route impact

| Wrapper | Indexed market price / BTC spot price | Numerical shortfall to one-BTC benchmark (bps) |
|---|---:|---:|
| WBTC | 0.9958838762323661174768680646 | 41.161238 |
| tBTC | 0.9943735907161912087184411126 | 56.264093 |
| LBTC | 0.9955430978980638703745679874 | 44.569021 |

These are benchmark ratios between separately timestamped indexed market prices. For WBTC/tBTC they describe market discount to the BTC unit benchmark; for LBTC the one-token/one-BTC comparison is informational and is expressly **not** a1LBTC=1BTC NAV, strategy-share rate or redemption assertion. No independent current per-LBTC NAV/share entitlement was obtained. The raw quote artifact also expresses marked USDC proceeds in BTC-spot-equivalent units; that is arithmetic, never native BTC payout. Do not simply add these benchmark bps to baseline-relative impact (different denominators/clocks). No native-Bitcoin exit, redemption, minting or delivery route was tested. Intermediate WBTC in a route remains a separate custody/token exposure, not Bitcoin settlement.

## Route identities, clocks and execution limits

review_summary.json inventories every actual route hop with exchange/pool/token pair/raw quantities and provider block hint; full poolExtra/extra metadata stays in btc_wrapper_usdc_quotes.json. Only selected top-level route hops enter that inventory. Nested extra._ss alternatives are preserved as metadata but are not selected legs or independent fill evidence. Some routes swap among wrappers before USDC and are split across venues; ticker labels never substitute for the exact addresses.

| Token/targetUSD | Request UTC → receipt UTC | Provider generation UTC | Actual hop block hints | Estimated gas ETH | Provider gas USD | Gas units |
|---|---|---|---|---:|---:|---:|
| WBTC/100000 | 2026-11-04T14:37:02.906318+00:00 → 2026-11-04T14:37:03.646541+00:00 | 2026-11-04T14:37:07+00:00 | [26342090] | 0.00013233645529867 | 0.3069102696197355 | 910826 |
| WBTC/1000000 | 2026-11-04T14:37:04.649553+00:00 → 2026-11-04T14:37:05.383540+00:00 | 2026-11-04T14:37:09+00:00 | [0, 26204000, 26204029, 26204052, 26204062, 26337250, 26342074, 26342082, 26342086, 26342088, 26342089, 26342090] | 0.00130003750416386 | 3.01500338677054 | 8947708 |
| WBTC/10000000 | 2026-11-04T14:37:06.390133+00:00 → 2026-11-04T14:37:07.175861+00:00 | 2026-11-04T14:37:10+00:00 | [0, 26204000, 26204029, 26204062, 26341243, 26341918, 26341939, 26342061, 26342063, 26342074, 26342080, 26342086, 26342088, 26342089, 26342090, 26342091] | 0.002340465115757745 | 5.427873033288745 | 16108611 |
| tBTC/100000 | 2026-11-04T14:37:08.187701+00:00 → 2026-11-04T14:37:08.694542+00:00 | 2026-11-04T14:37:12+00:00 | [26204000, 26337250, 26341924, 26342052, 26342088, 26342090, 26342091] | 0.000634126771457625 | 1.4706305935976045 | 4364475 |
| tBTC/1000000 | 2026-11-04T14:37:09.707378+00:00 → 2026-11-04T14:37:10.343614+00:00 | 2026-11-04T14:37:14+00:00 | [0, 26204000, 26204029, 26204052, 26204062, 26337250, 26341217, 26341924, 26342052, 26342074, 26342082, 26342088, 26342089, 26342090, 26342091] | 0.002236962887383595 | 5.18788931853112 | 15396241 |
| tBTC/10000000 | 2026-11-04T14:37:11.363730+00:00 → 2026-11-04T14:37:12.235321+00:00 | 2026-11-04T14:37:15+00:00 | [0, 26204062, 26341202, 26341217, 26341243, 26341612, 26341916, 26341918, 26341924, 26342052, 26342063, 26342068, 26342074, 26342080, 26342088, 26342089, 26342090] | 0.002959971218547315 | 6.864596207092873 | 20372457 |
| LBTC/100000 | 2026-11-04T14:37:13.257186+00:00 → 2026-11-04T14:37:13.673403+00:00 | 2026-11-04T14:37:17+00:00 | [26342088, 26342091] | 0.000160565537732015 | 0.372378211020934 | 1105117 |
| LBTC/1000000 | 2026-11-04T14:37:14.699757+00:00 → 2026-11-04T14:37:15.347764+00:00 | 2026-11-04T14:37:19+00:00 | [0, 26204000, 26204029, 26204052, 26204062, 26337250, 26339538, 26341933, 26342014, 26342061, 26342084, 26342086, 26342088, 26342089, 26342091, 26342092] | 0.002637219470570055 | 6.116150964844576 | 17872141 |
| LBTC/10000000 | 2026-11-04T14:37:16.378911+00:00 → 2026-11-04T14:37:16.984513+00:00 | 2026-11-04T14:37:20+00:00 | [26204062, 26339538, 26341443, 26341918, 26342014, 26342061, 26342063, 26342084, 26342086, 26342088, 26342091] | 0.002430571817738115 | 5.6408522935289 | 16471713 |

Provider timestamps are approximately3seconds ahead of local receipt; both clocks are preserved without replacement or reconciliation into an invented atomic state. Pool block hints differ across selected route hops. Block0 is an unknown/placeholder, not observed genesis-state liquidity; old hints around26204000 versus263420xx do not establish synchronous freshness. A newly returned route timestamp does not verify every pool is up to date. All quotes are indicative until execution checks; large split routes have provider-estimated gas up to20,372,457 units. This task did not establish block inclusion, caller funding/allowances, provider estimate accuracy or route execution feasibility.

Gas fields are retained in native provider units; estimated gasETH=gasUnits×gasPrice/1e18 with gasPrice interpreted as wei/gas. Provider gasUsd is its own price estimate, separate from the external sizing marks. l1FeeUsd=0 is provider-reported. extraFee fields are blank, with isInBps=false: not proof of zero fees. Pool fee parameters/model economics remain raw; no mixed-unit fee summation or independent fee audit. Approval costs, inclusion fee, slippage reserve and actual transaction costs remain unknown. Output is the router's modeled amount after its embedded route economics; gas remains separate. minimum_out and quote_expiry are null; no calldata, slippage policy or enforceable minimum generated.

All nine requested samples returned routes; failed-attempt slots retain their scoped semantics in the producer contract. A no-route/API failure at another time or venue would not prove zero aggregate liquidity. No simulation, swap, signature, approval, bridge, custody withdrawal, native BTC settlement, private position assertion, lending/oracle approval, current LBTC strategy/PoR conclusion, score, publication, outreach or new job occurred. Financial and canonical/optimistic mint/redemption/control matrices remain BM/Security owner scope. Existing PT/siUSD work was not reopened.

Validation: original parked-file hashes checked before packaging; exact token/input fields checked against requests for all nine responses; native output and input units recomputed with Decimal; capture syntax verified; final manifest covers the compact packet and original capture. No market/RPC calls were made on release. This is source evidence for BM/RiskAnalyst interpretation, not an accepted assessment or execution authorization.
