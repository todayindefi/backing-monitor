# USDai/sUSDai significant-chain liquidity — DexTracker source handback

To BM01a19a30-50e1-7bb0-b3cf-6bb2481f3835; origin RiskAnalyst01a1a375-9b44-7b13-8ec5-19bf15296705.
Request: /home/danger/backing-monitor/specs/handoffs/usdai-susdai-dashboard-refresh-owners-2026-11-06.md
Source changes and normal outputs are ready for BM review **before adoption**. No adoption, publication, score or source-owner peg/NAV change is claimed here. No previous scoped USDai-family DexTracker commission/output was found in local handoffs/docs/config. Existing PegTracker/BM backing inputs and normal inventory/quote methods were reused.

## Producer corrections and normal output interface

- venue_inventory.py ASSETS now supports exact USDai and sUSDai inventory for eth/arbitrum/plasma, with address-keyed sister-token role handling. This remains venue-only and declares no depth/primary exit/rating, preserving PegTracker's ladder. No symbol-matched non-swap listings are added.
- usdai_chain_liquidity.py is a separate **opt-in, unscheduled** producer reusing KyberSwapClient.route and the existing LP output-monotonicity guard. It writes schema chain-exit-observations/1, with per_chain, dated nav_denomination, raw native inputs/outputs/full routes, failures, own-rate 50/200-bps statuses, no interior/refinement claim, and dynamic display_recommendation and recommended_display_chains from normal inventory plus observed clearing samples. Public normal projection removes local source paths; source_file, source_as_of/source_block/source hash and original quote clocks remain. It is not automatically a BM replace-mode overlay and must not erase PegTracker data.
- --retry-transient rechecks only same-size instrument failures once and preserves prior_attempts/source clocks. Genuine no_route_found requests are not retried. Three rate-limited sUSDai samples were retried after the initial run; all initial output snapshots remain frozen. No interpolation, cross-chain filling or zero substitution.
- tests/test_usdai_chain_liquidity.py checks unknown depth, failed-rung coarse intervals, NAV discount versus own-rate impact, remote cash/token units, missing NAV rejection, transient-only retry/provenance and output turnover despite monotonic costs. Focused checks: **58passed**, syntax and whitespace checks passed. No cron/job created or edited for this commission; existing unrelated changes are excluded.

Normal output paths (all hashes in the manifest):

1. /home/danger/DexTracker/data/liquidity/usdai_liquidity.json
2. /home/danger/DexTracker/data/liquidity/susdai_liquidity.json
3. /home/danger/DexTracker/data/liquidity/usdai_chain_liquidity.json
4. /home/danger/DexTracker/data/liquidity/susdai_chain_liquidity.json

Frozen evidence root /home/danger/DexTracker/data/exit_evidence/usdai-family/2026-11-06/. Source script/test/config snapshots, commission-only venue-config patch, full inventory source responses, initial and final quotes, pre-public-projection provenance and identity check are retained. Public normal sidecars contain no /home paths or private holdings/bookkeeping; internal source provenance stays in the separate frozen evidence directory. manifest.json hashes report, source and outputs. Do not bundle other pre-existing venue_inventory attach-census edits into this commission's adoption.

## Exact identity and measurement perimeter

Reviewed set only: Ethereum1, Arbitrum42161, Plasma9745. USDai0x0a1a1a107e45b7ced86833863f482bc5f4ed82ef and sUSDai0x0b2b2b2076d95dda7817e785989fe353fe955ef9; same spelling is not proof of equal implementation, authority, backing, redemption access or transport. Existing onchain_symbol confirmed USDai/sUSDai at all six exact chain/address pairs; request/receipt clocks in identity-symbol-check.json. This is metadata observation, not a remote authority/bridge attestation. Canonical peg/NAV measurement remains **Arbitrum**. No cross-chain supply/cash sums or private wallet reads.

Important indexer mismatch: Ethereum USDai's exact address is labelled `susdai` by GeckoTerminal, while its live symbol read is USDai. Normal inventory gate conservatively did not query/accept that mismatched token's pools: inventory status token_unverified/finding unknown, NOT zero/no pools. All six Ethereum USDai USDC quote requests also returned provider no_route_found; that is source/provider-scoped. Do not substitute Ethereum sUSDai's pools or a ticker lookalike.

Input USD notionals are denomination references, not independently measured market value. USDai uses nominal$1/token. sUSDai uses dated Arbitrum redemption_share_price1.12111 from backing source06:46:03UTC/block521714946, not optimistic deposit NAV1.124145. Exact backing-source SHA and clock retained in nav_denomination. That canonical denomination is not proof of remote-chain immediately redeemable NAV. Input tokens=targetnotional/reference, floored to18decimal raw units. Outputs are native USDC (ETH/Arbitrum) or USDT0 (Plasma),6decimals. No independent output-dollar market mark was collected; nominal-dollar return is labelled accordingly.

## Venue evidence and coverage recommendation

Whole-pool reported TVL, **not** executable depth or independent cash. Pool lists are exact-address paginated GeckoTerminal source observations, $1k publishing floor, normal plausibility exclusions and role classifications; source coverage/truncation/status fields retained. Volumes are indexed24h context, not settlement clocks or route fills. Quiet/zero reported volume is not a reason to reject a venue. No guaranteed live status inferred from listing; normal liveness unknowns persist. Do not sum the two assets' TVLs because shared pools may overlap.

| Asset | Chain | Inventory/source status | Reported eligible pool count | Whole-pool TVL USD | Reported24h volume USD | Enumeration UTC |
|---|---|---|---:|---:|---:|---|
| usdai | eth | token_unverified | None | None | None | None |
| usdai | arbitrum | queried | 16 | 1711926.1892000001 | 1029365.4676259126 | 2026-11-06T07:38:28Z |
| usdai | plasma | queried | 2 | 3326986.83 | 0.0 | 2026-11-06T07:38:36Z |
| susdai | eth | queried | 3 | 29834496.0722 | 1253802.1847387464 | 2026-11-06T07:39:27Z |
| susdai | arbitrum | queried | 7 | 17146644.211900003 | 3729177.930347063 | 2026-11-06T07:39:57Z |
| susdai | plasma | queried | 3 | 557428.1537 | 36089.5396818176 | 2026-11-06T07:40:48Z |

Coverage recommendations have **no hard TVL cutoff**. The producer selects the joint highest observed 50-bps own-rate clearing rung per asset among reviewed chains with exact-token venue support and no output turnover. This relative sampled evidence is not an exact capacity ranking; TVL and volume substantiate context separately. Recommendations derive from measurements rather than deployments:

- USDai: **Arbitrum** has significant measured venue context and supported public-size cash quotes. Keep **Plasma** as a separate venue-context/quote-quality-warning panel: ~$3.33m reported TVL, but severe routed deterioration/output turnover; do not promote its TVL to a usable cash-depth headline. Ethereum USDai remains explicit unknown/unavailable by these sources and does not merit a successful-liquidity card merely because a token is deployed.
- sUSDai: **Ethereum and Arbitrum** have significant venue context (~$29.83m/$17.15m) and measured multi-million-notional clearing samples. **Plasma** is a smaller measured market (~$0.56m), with a supported100k sample and unavailable larger quote sizes. Retain this as optional smaller-market context, not mandatory significant-chain headline coverage or zero liquidity.
- Family dashboard: ETH/Arbitrum are meaningful for sUSDai; USDai's main cash view remains Arbitrum. Plasma is separately qualified context, not silently combined with those cash paths. Base/other deployments were outside this requested review; no liquidity assertion about them.

## Chain-specific own-rate observations

The baseline is the smallest successful same-chain quote (final samples$100). Positive average-rate cost =10000×(1−currentOutputPerToken/baselineOutputPerToken). This is **not incremental marginal impact** and excludes the baseline's spread/standing NAV discount. signed_nominal_return_vs_nav_bps=10000×(nominalOutput/(inputTokens×datedReference)−1), negative for shortfall. Gas is excluded from both. The field convention must not be relabelled as PegTracker's incremental margin or a signed positive premium; separate clocks/references matter.

Primary50bps, secondary200bps; table reports the primary. Coarse brackets retain measured endpoints and precisionfalse; lower-bound depth is is_floor=true, never an exact crossing or ceiling. monotonic_in_bracket is null because interiors were not refined, even if the sampled series appears monotonic. Non-monotonic successful costs/output turnover are separately flagged; no invalid bisection or fabricated precision. No trend comparison with old dashboard values.

| Asset | Chain/output | 50bps status | Observed lower bound | First sampled failing endpoint | Precision | Quotes started→finished UTC |
|---|---|---|---:|---:|---|---|
| usdai | eth/USDC | quote_unavailable | None | None | not established | 2026-11-06T07:39:30.391014+00:00 → 2026-11-06T07:39:47.521241+00:00 |
| usdai | arbitrum/USDC | bracketed_coarse | 2500000 | 10000000 | not established | 2026-11-06T07:39:30.391014+00:00 → 2026-11-06T07:39:47.521241+00:00 |
| usdai | plasma/USDT0 | bracketed_coarse | 100 | 10000 | not established | 2026-11-06T07:39:30.391014+00:00 → 2026-11-06T07:39:47.521241+00:00 |
| susdai | eth/USDC | bracketed_coarse | 2500000 | 10000000 | not established | 2026-11-06T07:39:38.827626+00:00 → 2026-11-06T07:42:18.103337+00:00 |
| susdai | arbitrum/USDC | bracketed_coarse | 2500000 | 10000000 | not established | 2026-11-06T07:39:38.827626+00:00 → 2026-11-06T07:42:18.103337+00:00 |
| susdai | plasma/USDT0 | incomplete_floor | 100000 | None | not established | 2026-11-06T07:39:38.827626+00:00 → 2026-11-06T07:42:18.103337+00:00 |

Concrete samples (full raw inputs/amounts/routes/gas/blocks/provider timestamps in normal output):

| Asset | Chain | Denomination notional | Input native tokens | Output native cash tokens | Own-rate cost bps | Signed nominal return vs dated NAV bps |
|---|---|---:|---:|---:|---:|---:|
| usdai | eth | 100 | 100 | null | null | null |
| usdai | eth | 100000 | 100000 | null | null | null |
| usdai | eth | 2500000 | 2500000 | null | null | null |
| usdai | eth | 10000000 | 10000000 | null | null | null |
| usdai | arbitrum | 100 | 100 | 99.994611 | 0 | -0.53890000 |
| usdai | arbitrum | 100000 | 100000 | 99982.185105 | 1.242656466756993534381568000 | -1.78148950000 |
| usdai | arbitrum | 2500000 | 2500000 | 2492984.457355 | 27.52475388898707751360720800 | -28.062170580000 |
| usdai | arbitrum | 10000000 | 10000000 | 4350729.028643 | 5649.036497933873656451346163 | -5649.2709713570000 |
| usdai | plasma | 100 | 100 | 100.135985 | 0 | 13.59850000 |
| usdai | plasma | 100000 | 100000 | 573.760501 | 9942.701866766477605428258383 | -9942.62394990000 |
| usdai | plasma | 2500000 | 2500000 | 356.334497 | 9998.576597625718666471398868 | -9998.5746620120000 |
| usdai | plasma | 10000000 | 10000000 | 356.334497 | 9999.644149406429666617849717 | -9999.6436655030000 |
| susdai | eth | 100 | 89.197313376921087136 | 99.934614 | 0 | -6.538599999999999904158708000 |
| susdai | eth | 100000 | 89197.313376921087136855 | 99943.347483 | -0.873919721148870304536720000 | -5.665251699999999999950933000 |
| susdai | eth | 2500000 | 2229932.834423027178421385 | 2497925.864749 | 1.759091203374238375324276000 | -8.296541003999999999995752000 |
| susdai | eth | 10000000 | 8919731.337692108713685543 | 8245611.272152 | 1748.993724884953275627880024 | -1754.388727847999999999999269 |
| susdai | arbitrum | 100 | 89.197313376921087136 | 99.914651 | 0 | -8.534899999999999904177853000 |
| susdai | arbitrum | 100000 | 89197.313376921087136855 | 99901.305657 | 1.335674284645201929154815000 | -9.869434299999999999950953000 |
| susdai | arbitrum | 2500000 | 2229932.834423027178421385 | 2496184.043037 | 6.734675830474551820987065000 | -15.26382785199999999999575400 |
| susdai | arbitrum | 10000000 | 8919731.337692108713685543 | 3373186.595476 | 6623.931964216138832364384588 | -6626.813404523999999999999701 |
| susdai | plasma | 100 | 89.197313376921087136 | 100.046302 | 0 | 4.630200000000000095948410000 |
| susdai | plasma | 100000 | 89197.313376921087136855 | 99992.771825 | 5.350540092926173419031497000 | -0.7228174999999999999509090000 |
| susdai | plasma | 2500000 | 2229932.834423027178421385 | null | null | null |
| susdai | plasma | 10000000 | 8919731.337692108713685543 | null | null | null |

USDai Plasma deserves special caution: $100 quotes100.135985USDT0, $10k quotes1080.081151, $100k573.760501, and larger sizes settle in the router model at356.334497. The existing truncate_at_non_monotonic guard flags output decline beginning at100k. This contradicts any attempt to treat the reported3.3mTVL as cash capacity. It is **quote-model evidence with unresolved route freshness/reliability**, not independently verified achievable proceeds or a confirmed loss. A quiet source day is not itself proof of a dead venue.

sUSDai Plasma$1m/$2.5m/$10m requests returned no_route_found, not sampled threshold crossings; publish the100k observed floor with incomplete coverage rather than a100k capacity limit. Initial429 errors on sUSDai Arb2.5m/10m and Plasma100 are preserved in prior_attempts and initial snapshots; later same-size successful samples do not rewrite earlier source clocks. Source code supports transient-only retry and did not retry genuine no-route findings.

## Clocks, fees, blocks and adoption boundaries

Inventory as_of/queried_at, full response receipts, quote request/receipt/provider generation timestamps, NAV source clock and revised-at are different fields. Quote source is GET https://aggregator-api.kyberswap.com/{chain}/api/v1/routes. All actual top-level route hops/pool IDs/block hints and nested metadata remain in raw route_summary; nested alternate _ss metadata is not an additional selected leg or fill. Returned pool hints can be old/mixed and provider clocks can lead local receipt; no same-block freshness or independence claim.

Raw gas/gasPrice/gasUsd/l1FeeUsd/extraFee and pool fee fields are preserved, not subtracted from nominal output or own-rate impact. ETH/Arbitrum gas is ETH; Plasma gas is XPL, not ETH. gasUsd is the provider's valuation, not an independent current mark; actual approval/inclusion costs unknown. Empty extraFee fields do not establish zero AMM/router/redemption fees. No mixed-unit fee sum, verified all-in cost or aggregate bridged cash capacity.

minimum_out/quote_expiry null. No calldata/slippage policy, account funding/approval, transaction simulation, fill, settlement, bridge delivery or primary redemption was established. Results are indicative and must be refreshed before execution. A failed/unindexed/unsupported source is not zero liquidity; a sampled success is not an execution guarantee. No wallet, transaction, approval, new schedule, score or publication. Arbitrum peg/NAV and stale signed-discount/prose corrections remain PegTracker scope. BM should consume the normalized source fields only after reviewing this return; source changes precede adoption, not hard-coded dashboard snapshots.

Reproduction: `python3 venue_inventory.py usdai susdai`; then `python3 usdai_chain_liquidity.py usdai --backing-file <usdai_backing.json>` and equivalent susdai. Optional --retry-transient preserves previous failed sample clocks. These are manual source entrypoints, no cron installed. Do not replace BM's entire liquidity axis with a venue-only payload or suppress the per-chain provenance.
