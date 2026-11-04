# Exact-token PT-linkage exit evidence — DexTracker handback

To BM thread 01a19a30-50e1-7bb0-b3cf-6bb2481f3835 and RiskAnalyst thread 01a1a375-9b44-7b13-8ec5-19bf15296705.
Request: /home/danger/backing-monitor/specs/handoffs/pt-linkage-security-dex-bm-2026-11-04.md
Prepared 2026-11-04 UTC. Evidence root: /home/danger/DexTracker/data/exit_evidence/pt-linkage/2026-11-04/; manifest.json hashes each retained artifact and this report. Capture uses existing aggregator_quotes.KyberSwapClient.route and onchain_quotes._JsonRpc; no new collector interface, adapter, job or transaction. Source revision: 9f57c0ae6d30e3fe62ea2219b9a514f63659d755.

## Reuse and scope

Existing commissions were checked first: RiskAnalyst's accepted November 2 secondary-cash receipt, November 4 Monad Saturn review, BM initial financial observations and pending DA/Security owner work. No duplicate srUSDat/private-held-size simulation or PT/SY routing approval was requested or performed. Current Ethereum quotes below use public market-dollar sizes; no account balances or position-sized inputs.

### Monad srUSDat: reuse only

Exact Monad143 share 0x17b8f7373ecd556192abfc85be314e5d4fb6b3fa is not USDat or sUSDat. Reused source references/hashes are in srusdat-reuse-references.json. The accepted receipt remains at /home/danger/riskAnalyst/data/reviews/six-portfolio-risk-refresh-2026-11-02/srusdat-secondary-cash-acceptance.json. Its underlying sale evidence was accepted at 2026-11-02T09:56:48.806305Z; Ethereum get_dy block26326317/source09:51:59Z and Monad block118724873/source09:52:09Z supported conditional USDat→USDC legs. Receipt validation was of saved evidence, not a fresh chain rerun. It did not establish local Monad srUSDat→USDat conversion, share bridge delivery, actual redemption or a complete cash exit. Intermediate tokens/allowances were absent. No private held-size quotes repeated here.

November4 review snapshot: /home/danger/riskAnalyst/data/reviews/monad-saturn-vault-liquidity-2026-11-04/summary.json, observed06:56–06:59UTC; Monad Curve block119261326 at06:58:18Z. Its PT-srUSDat market 0xc945210f85b55946eb970f427e4b9150fff600de and PT0x355e82c60d51d6942bdfd0f2b95a204acd068963 produce srUSDat shares. Reused $10k API-mark input10221794833 PT raw (6decimals) quoted9618.887509967741192936 srUSDat; $100k input102217948333 quoted95684.104822694365110509 srUSDat (18decimals), provider first-leg price impact about6.5163/58.9591bps and fee estimates$4.1518065934/$41.3000589731. Quotes received06:57:04.468230/06:57:04.408215UTC, API share USD mark1.0389438519097765 updated06:56:30.096UTC. These are PT→shares, not share→cash.

The same review's direct PT→USDC request failed because tokenOut was outside the SY output list with enableAggregator=false. The larger MarketProportionTooHigh errors also describe scoped API requests, not zero liquidity across venues. Direct Monad share secondary exit remains unestablished by these reused inputs. USDat sale liquidity, Ethereum share previews, srUSDat LayerZero transport and Saturn CCIP migration are distinct; sequential quotes and future/conditional intermediates cannot be called delivered, atomic or settled USDC. Security/bridge accounting attestation and issuer backing remain other owner scopes. No fresh PT or underlying route has been approved.

## Ethereum quote basis and route classification

Exact siUSD0xdbdc1ef57537e34680b898e1febd3d68c7389bcb, underlying iUSD0x48f9e38f3070ad8945dfeae3fa70987722e3d89c. Exact sUSN0xe24a3dc889621612422a64e6388927901608b91d, underlying USN0xda67b4284609d2d48e5d10cfac411572727dc1ed. Share/underlying18decimals reused from BM pinned RPC results; USDC0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48 is6decimals. BM observed asset/convertToAssets/previewRedeem at block0x191f24b (26341963) around14:11:43–47UTC; exact selected records are retained inside exit_quotes.json, source file hash retained. Those reads do not establish a generic ERC4626 execution path or withdrawal access.

New quote run 2026-11-04T14:29:22.159040+00:00–2026-11-04T14:29:50.313732+00:00 UTC. $100 baseline/$10k/$100k inputs are sized using external DefiLlama share market USD marks captured14:28:44–45UTC, floored to native integer wei. They are not one-dollar shares, NAV notional or private positions. Source price timestamps differ from retrieval and routing; table below preserves them. USD output valuation uses the separately timestamped USDC mark, not an assumed peg.

siUSD router results are **Gateway conversion/redemption estimates**, not a demonstrated pure AMM secondary share sale: every first hop is InfiniFi0x3f04b65ddbd87f9ce0a2e7eb24d80e7fb87625b5; $10k/$100k share→USDC and iUSD→USDC use the Gateway directly. The $100 path is Gateway share→iUSD then Fluid iUSD→USDe and Ekubo USDe→USDC. Documentary profile says siUSD Gateway-only interface after June2025; preview methods responding do not override access/version/fees/withdrawal requirements. No transaction simulation established those Gateway quotes as fillable or universally redeemable.

sUSN quotes are secondary swaps: Uniswap v3 sUSN→USN pool0x5cba2738c4df481db7228e1545f29532ed0a2dee, followed by USN→USDT pool0x526cd4f72f2cc54d6a02a7fefc84753a826a5737 and Ekubo or Metric USDT→USDC. This differs from seven-day primary unstaking and conditional USN issuer redemption. Route pool IDs, actual hops/blocks, nested alternative metadata, raw amounts, route IDs and gas/fee fields remain in the source artifacts. No same-block state or complete execution verified.

### Whole share-input router quotes (before gas)

| Asset | Target market USD | Native shares in | USDC quoted | Added average-rate cost vs $100 baseline (bps) | Signed return vs external input market value (bps) |
|---|---:|---:|---:|---:|---:|
| siusd | 100 | 91.119624180656105805 | 100.050035 | 0.000000 | 3.102549 |
| siusd | 10000 | 9111.962418065610580597 | 10010.867729 | -5.861296 | 8.965664 |
| siusd | 100000 | 91119.624180656105805976 | 100108.677294 | -5.861297 | 8.965665 |
| susn | 100 | 81.111114077082639354 | 99.956632 | 0.000000 | -6.235976 |
| susn | 10000 | 8111.111407708263935476 | 9992.54097 | 3.123585 | -9.357613 |
| susn | 100000 | 81111.114077082639354766 | 99627.421594 | 32.935324 | -39.150762 |

Added cost =10000×(1−current average output-per-share/small-quote average output-per-share). Negative added cost is an observed rate improvement with changed routes/clocks, not negative fees or increased depth. Signed market-value return =10000×(USDCout×externalUSDCmark/inputMarketUSD−1). For an accruing share, discount to one dollar per share is invalid. These sample differences are not a marginal-rung curve or a depth/capacity ceiling.

### Underlying steps: separate previews and exact routed intermediate amounts

For each size, previewRedeem of exact share wei was read at the reused BM block0x191f24b, not latest. Exact preview outputs and a separately timed underlying→USDC quote for each are saved in exit_quotes.json. Preview is a book/interface estimate, not unstaking, asset availability or delivered underlying. The preview-derived cash estimate must not replace the direct secondary quote.

A second bounded query uses the **exact underlying amount from the prior share→underlying router quote**, preserving prior source clock and routeID in exact_intermediate_quotes.json. These are sequential conditional legs, not a full-path simulation or realized final USDC:

| Asset | Target share market USD | Secondary/Gateway underlying quoted | Underlying raw input to separate USDC query | Separately quoted USDC |
|---|---:|---:|---:|---:|
| siusd | 100 | 100.108677294463294698 | 100108677294463294698 | 100.050084 |
| siusd | 10000 | 10010.86772944632946996 | 10010867729446329469960 | 10010.867729 |
| siusd | 100000 | 100108.67729446329469961 | 100108677294463294699610 | 100108.677294 |
| susn | 100 | 100.0916197797130015 | 100091619779713001500 | 100.126551 |
| susn | 10000 | 10007.62167158556081497 | 10007621671585560814970 | 10006.692524 |
| susn | 100000 | 99936.406006175150359942 | 99936406006175150359942 | 99759.871482 |

Underlying rates, nominal-dollar discount versus underlying peg and wrapper exchange rate must stay separate. The retained preview is in iUSD/USN, not USDC; a $1 nominal underlying benchmark does not independently establish that underlying is redeemable at $1. No sum of sequential quote gas/fees is a proved all-in executable route cost.

## Source prices and sparse historical evidence

DefiLlama exact-address prices/current plus historical endpoints are retained in current_prices.json and price_history_7d.json/price_history_30d.json, with request/receipt clocks, returned upstream timestamps and confidence. These are source-owner indexed marks, not independent exchange transactions or a continuous peg series. Sparse current/7d/30d snapshots do not validate interpolation, repeated fresh liquidity, return attribution, full history coverage or a trend. Historical share NAV/exchange-rate series was not collected; share appreciation and underlying depeg cannot be decomposed historically from these marks alone. Existing Pendle API prices remain price references, not share settlement proof.

| Snapshot | Token | USD mark | Upstream UTC |
|---|---|---:|---|
| current | siUSD (ethereum:0xdbdc1ef57537e34680b898e1febd3d68c7389bcb) | 1.097458433341839 | 2026-11-04T14:21:26+00:00 |
| current | sUSN (ethereum:0xe24a3dc889621612422a64e6388927901608b91d) | 1.2328766672464468 | 2026-11-04T14:22:14+00:00 |
| current | iUSD (ethereum:0x48f9e38f3070ad8945dfeae3fa70987722e3d89c) | 0.9989240703049878 | 2026-11-04T14:22:58+00:00 |
| current | USN (ethereum:0xda67b4284609d2d48e5d10cfac411572727dc1ed) | 0.9988116915719941 | 2026-11-04T14:22:14+00:00 |
| current | USDC (ethereum:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48) | 0.99981 | 2026-11-04T14:28:41+00:00 |
| 7d | siUSD (ethereum:0xdbdc1ef57537e34680b898e1febd3d68c7389bcb) | 1.09594897353227 | 2026-10-28T14:24:08+00:00 |
| 7d | sUSN (ethereum:0xe24a3dc889621612422a64e6388927901608b91d) | 1.230571426436637 | 2026-10-28T14:36:21+00:00 |
| 7d | iUSD (ethereum:0x48f9e38f3070ad8945dfeae3fa70987722e3d89c) | 0.9989223910893977 | 2026-10-28T14:22:47+00:00 |
| 7d | USN (ethereum:0xda67b4284609d2d48e5d10cfac411572727dc1ed) | 0.9983305839585416 | 2026-10-28T14:36:21+00:00 |
| 30d | siUSD (ethereum:0xdbdc1ef57537e34680b898e1febd3d68c7389bcb) | 1.092627767351826 | 2026-10-05T14:23:53+00:00 |
| 30d | sUSN (ethereum:0xe24a3dc889621612422a64e6388927901608b91d) | 1.2263523881879277 | 2026-10-05T14:22:44+00:00 |
| 30d | iUSD (ethereum:0x48f9e38f3070ad8945dfeae3fa70987722e3d89c) | 0.9997367969416143 | 2026-10-05T14:21:50+00:00 |
| 30d | USN (ethereum:0xda67b4284609d2d48e5d10cfac411572727dc1ed) | 0.999411058281157 | 2026-10-05T14:22:44+00:00 |

## Clocks, fee/gas and explicit unknowns

GET https://aggregator-api.kyberswap.com/ethereum/api/v1/routes; router0x6131B5fae19EA4f9D964eAc0408E4408b66337b5. Each artifact retains request/receipt clocks and router generation timestamp independently. Provider generation clocks run a few seconds ahead of local receipts; not normalized into a fictional common clock. Pool blocks can be old: sUSN routes include26335438/26330351 and Metric26204062, while InfiniFi reports26342052. They are provider-reported state hints, not audited freshness or current head. Alternative nested _ss metadata is not an actual selected hop or independent quote/fill. Do not treat a new response timestamp as proof every pool refreshed.

| Asset/targetUSD/leg | Local receipt UTC | Provider UTC | Actual hop block hints | Provider gas USD |
|---|---|---|---|---:|
| siusd/100/share_to_usdc | 2026-11-04T14:29:23.262328+00:00 | 2026-11-04T14:29:26+00:00 | [26341823, 26342026, 26342032] | 0.6689444146211179 |
| siusd/100/share_to_underlying | 2026-11-04T14:29:24.631729+00:00 | 2026-11-04T14:29:28+00:00 | [26342052] | 0.5914476772113721 |
| siusd/100/preview_underlying_to_usdc | 2026-11-04T14:29:26.051450+00:00 | 2026-11-04T14:29:29+00:00 | [26341823, 26342026] | 0.11561618283824597 |
| siusd/10000/share_to_usdc | 2026-11-04T14:29:27.882495+00:00 | 2026-11-04T14:29:31+00:00 | [26342052] | 1.0702488870490015 |
| siusd/10000/share_to_underlying | 2026-11-04T14:29:29.320832+00:00 | 2026-11-04T14:29:32+00:00 | [26342052] | 0.6062417628766893 |
| siusd/10000/preview_underlying_to_usdc | 2026-11-04T14:29:30.821733+00:00 | 2026-11-04T14:29:34+00:00 | [26342052] | 0.8781680622039263 |
| siusd/100000/share_to_usdc | 2026-11-04T14:29:32.602803+00:00 | 2026-11-04T14:29:36+00:00 | [26342052] | 1.0702488870490015 |
| siusd/100000/share_to_underlying | 2026-11-04T14:29:33.971359+00:00 | 2026-11-04T14:29:37+00:00 | [26342052] | 0.6062417628766893 |
| siusd/100000/preview_underlying_to_usdc | 2026-11-04T14:29:35.512592+00:00 | 2026-11-04T14:29:39+00:00 | [26342052] | 0.8781680622039263 |
| susn/100/share_to_usdc | 2026-11-04T14:29:37.222162+00:00 | 2026-11-04T14:29:40+00:00 | [26330351, 26335438, 26342046] | 0.13516199391140296 |
| susn/100/share_to_underlying | 2026-11-04T14:29:38.561790+00:00 | 2026-11-04T14:29:42+00:00 | [26335438] | 0.06169160619657955 |
| susn/100/preview_underlying_to_usdc | 2026-11-04T14:29:39.891200+00:00 | 2026-11-04T14:29:43+00:00 | [26330351, 26342046] | 0.11188602539303427 |
| susn/10000/share_to_usdc | 2026-11-04T14:29:41.552657+00:00 | 2026-11-04T14:29:45+00:00 | [26204062, 26330351, 26335438] | 0.20374409968691248 |
| susn/10000/share_to_underlying | 2026-11-04T14:29:42.881613+00:00 | 2026-11-04T14:29:46+00:00 | [26335438] | 0.06294885292118911 |
| susn/10000/preview_underlying_to_usdc | 2026-11-04T14:29:44.242825+00:00 | 2026-11-04T14:29:47+00:00 | [26204062, 26330351] | 0.17771340107138964 |
| susn/100000/share_to_usdc | 2026-11-04T14:29:46.213634+00:00 | 2026-11-04T14:29:49+00:00 | [26204062, 26330351, 26335438] | 0.2073200503703263 |
| susn/100000/share_to_underlying | 2026-11-04T14:29:47.833366+00:00 | 2026-11-04T14:29:51+00:00 | [26335438] | 0.06291704307693702 |
| susn/100000/preview_underlying_to_usdc | 2026-11-04T14:29:49.306251+00:00 | 2026-11-04T14:29:53+00:00 | [26204062, 26330351] | 0.18139416943519812 |

Gas units, gasPrice, gasUsd, l1FeeUsd, extraFee and every poolExtra/extra fee field are retained raw; gasETH is gas×gasPrice/1e18 assuming wei/gas. Gas is separate from output/impact, not silently subtracted. USD gas values are provider estimates. Approval costs, current execution fee, account access, Gateway/unstaking/issuer fees, and execution/slippage reserves are unmeasured. Blank extraFee fields do not prove zero fees; AMM/Gateway fees embedded in modeled output are not independently audited or aggregated across mixed units. Minimum-out/quote expiry are null; no calldata build/slippage policy was requested. Responses are indicative and require fresh quoting and execution checks before a trade.

All 18 initial leg queries plus six exact-intermediate leg queries succeeded; no failed result was erased or classified as zero liquidity. Future single-venue API/no-route failures would not prove zero aggregate liquidity. There was no signature, approval, swap, bridge, private-size simulation, actual-state execution, fill/settlement, new recurring job, score or publication. This task does not verify mint/upgrade/transport authority, loss order, full backing or financial coverage. Monad asset remains unscored; siUSD/sUSN historical4.0/June7 is not refreshed by these quotes. BM's packages remain private/unscored pending owner returns and RiskAnalyst review; no fresh PT/SY approval.

Validation: exact token pair and native input response matches asserted for every quote; Decimal arithmetic used for sizing/outputs/impact; selected BM source and reused RA evidence hashes recorded; source clocks never substituted with write clocks. Quotes/previews prove no fills or final cash settlement. Report revision precedes any BM/TIDR surface update.
