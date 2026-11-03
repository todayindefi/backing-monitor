# frxUSD shared backing evidence v1

Owner: backing-monitor. Producer: `frxusd_defillama_evidence.py`, alongside the existing `frxusd_backing_verifier.py`. Runs once in the existing hourly sync, after primary source files have been copied. No additional schedule, consumer scraper or transaction path.

## Consumer entry points

- Latest pointer: `https://todayindefi.github.io/backing-monitor/data/frxusd_backing_evidence.json` (`frxusd-backing-evidence/1`).
- Immutable body: pointer `snapshot_path`, relative to the site root (`frxusd-evidence-snapshot/1`).
- Prospective source-run/capture index: `data/frxusd_evidence_history.json`.
- Retained original documents: snapshot source references under `data/frxusd_evidence_sources/`, gzip encoded; their SHA256 covers **uncompressed original bytes**.

All three consumers—BM, riskAnalyst and TIDR—use the same body and formulas. Dated reports must bind to an immutable snapshot ID, not just the mutable pointer or BM HTML. Live widgets must label source observation/retrieval clocks and health. Do not recompute coverage or concentration in consumers.

The snapshot ID is `sha256:` plus SHA256 of the exact UTF-8 body bytes. Its filename contains the same hash. Verify the download against `snapshot_sha256`. Hash fields live in the pointer to avoid a self-referential hash. Immutable files are never overwritten or pruned by this producer. New successful captures may have new IDs even when source-run clocks are unchanged; retrieval and observation are separate. History preserves source-document revisions under the original source-run clock, not invented historical price observations.

## Attributed evidence classes

1. `issuer_reported`: PegTracker's source, reserve/liability rows, source health and effective observation clock. The original serving artifact is hash-retained. Primary producer fields and scores are not replaced.
2. `independently_measured`: the existing BM verifier's evidence, fixed-block clocks, NAV clocks/statuses, incomplete remote liabilities and offchain/ownership limits. `partial` remains partial; global independent coverage is not manufactured.
3. `third_party_verified`: DeFiLlama's public record, quantities, values, row clocks, methodology, net chain supply and **their verification claim**. This does not become a BM audit, bank-statement examination, beneficial-ownership proof, unlimited FDIC protection or independent global liability reconstruction.

Source age and original status are retained for every class. Comparison deltas carry separate clocks and are not same-block audit discrepancies. Identity matching uses chain, account and token; a source position additionally includes strategy in its immutable position ID. Ambiguous matches are withheld, never aggregated by symbol. Chain identifiers absent from the DeFiLlama position are resolved only through the frozen issuer account/token registry, visibly labelled as that identity basis; unresolved identities stay unresolved. Only EVM addresses are case folded. Offchain accounts retain their public source label and a stable label-derived account ID.

Aliases retain original names alongside canonical names: avax→avalanche, bsc→bnb, era→zksync, wc→worldchain, plume_mainnet→plume. Duplicate canonical supply aliases are rejected rather than summed twice.

## Financial formulas (producer only)

- `coverage_par_pct = 100 × reserves_usd / liabilities_tokens`, at USD1 per token.
- `coverage_market_pct = 100 × reserves_usd / liabilities_market_usd`.
- `surplus_par_usd = reserves_usd − liabilities_tokens`.
- Strategy concentration = `100 × strategy_value_usd / reserves_usd` (unavailable for zero reserves).

The handoff fixture yields98,767,313.04839623 reserves,95,494,024.10939886 tokens,95,473,373.07703812 market-valued liabilities,103.42774217499459% par coverage and103.4501137492023% market coverage. WTGXX rounds to68.56%. Falling market price must not appear as improved dollar-redemption solvency.

The Ethereum chain supply is **already net of Fraxtal bridge escrow** under DeFiLlama's current frontend methodology. The10,484,949.8635046-token fixture escrow remains disclosed, with `additional_subtraction_tokens = 0`. Never subtract it again. Thirty reconciled chain rows are arithmetic evidence, not proof of every balance or OFT/escrow interpretation. Position quantities×prices, position/group totals and net chain sums are validated before acceptance (USD0.01 and1e-6-token reconciliation tolerances).

## Source transport and failure behavior

Primary: `https://defillama.com/api/public/verified/frxusd`. Discovered in DeFiLlama's own build manifest (`/api/public/verified/[slug]`) and verified to return JSON. It is a public endpoint, **not a documented/versioned API guarantee**: no verification route was found in the general API documentation. The upstream frontend explicitly says bridge-locked units have already left the Ethereum figure.

On request failure, the public page's `__NEXT_DATA__.props.pageProps.payload` is a schema-validated fallback. It is marked `embedded_next_data_fallback` and `validated_fallback`; primary failure type remains visible. A stale or malformed successful API response is rejected, not concealed by fallback. API non-JSON, wrong project, missing fields, nonfinite/negative numbers, identity collisions, unsupported funds-in-transit and arithmetic failures cannot publish as fresh evidence.

Default freshness policy: run≤24h, position≤48h, future-clock tolerance5min. These are ingestion policy limits, not an assurance opinion. Real zero reserves can be represented as zero coverage with an undercoverage alert; missing data never becomes zero.

Rejected/stale/missing input retains the same prior immutable snapshot ID and original successful/source clocks. The mutable pointer marks `degraded_last_good`, latest attempt/error and original-source age. Without a prior validated snapshot, it is `unavailable`. `accepted` means source ingestion/normalization passed; it never means all three classes independently verified full backing. Browser hash/schema failures render unavailable. No historical coverage is backfilled from an empty upstream price-history array.

sfrxUSD may cite this as upstream frxUSD context only; it does not verify sfrxUSD strategy assets, PPS, liabilities, redemption or authority. No independent rescore is emitted.
