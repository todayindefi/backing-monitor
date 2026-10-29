# syrupUSDC axes 1–3 — common-source evidence package

Status: **ready for riskAnalyst assessment**. Producer source reconciliation coordinated and common outputs synchronized; actual served files and retained histories verified. Collateral/custody, bridge and execution limits remain open. No automatic score changes or report publication.

## Selected common inputs and source clocks

- Canonical backing: **2026-10-29T01:49:29Z**; family: **2026-10-29T01:50:32Z**; canonical Ethereum quote: **2026-10-29T01:33:04Z**.
- [Dashboard](https://todayindefi.github.io/backing-monitor/?asset=syrupusdc); public [backing](https://todayindefi.github.io/backing-monitor/data/syrupusdc_backing.json), [history](https://todayindefi.github.io/backing-monitor/data/syrupusdc_backing_history.json), [family](https://todayindefi.github.io/backing-monitor/data/syrup_family.json).
- `after/sources.json` pins every actual served URL, retrieval clock, byte size and SHA-256, including the served app/renderers, sibling and authored overlays. `producer-selection/sources.json` pins the exact selected standard producer files. All four served standard files match those selected hashes, including history and sibling/family input.
- `before/` preserves the served **2026-10-29T00:44:01Z** source definition and history. The older riskAnalyst October 28 archive is unchanged. Neither archive is replaced by a newly classified report-only dataset.
- The first instrumented producer run was **01:48:44Z**, followed by ordinary scheduler backing **01:49:29Z** and family **01:50:32Z**. Instrumented raw request/response evidence does not claim to capture every request from the separate scheduler. Each generation's prices/valuations retain its own clock.

The report and dashboard should consume these same standard payloads, peg references and canonical ladder. The report's longer-term interpretation belongs to riskAnalyst; the package does not substitute different observations or set ratings.

## Definition and source changes

`issuer_economic_usdc_v1_2026-10-29` replaces USDC's unversioned heuristic prospectively. Credit requires the reviewed exact issuer credit-table loan address and matching enumerated borrower. Non-credit requires reviewed address/borrower plus matching Maple strategy metadata. A new/mismatched address or metadata stays unknown; symbols alone do not establish economic use. All 33 current positions carry provenance; unknown principal is zero in this snapshot, not a guarantee about future positions or verified custody.

There are **24 credit records / $898.72M** and **nine non-credit strategy records / $36.15M**. The sole membership delta is **$5 USDtb**, from heuristic loan to Treasury strategy. PYUSD, USTB and USDtb classifications have separately declared issuer/metadata evidence; metadata assurance is not independent allocation/custody assurance. Compatibility `liquidity` means non-credit strategies, **not immediately withdrawable cash**. The exact address changes and source assurance are in `source-definition-changes.json` and the producer review JSON inside `producer-evidence.tar.gz`.

Both concentration tables now declare exact scope and members: all active loan-manager positions versus classified credit. Raw principal, borrower, rates and status flags are preserved; total enumerated principal **$934.87M** equals manager principalOut, residual zero. The family now declares per-pool versioned economic membership rather than legacy unreviewed USDC membership. Credit collateral ratios remain unavailable where coverage is incomplete.

Supply enumeration extends to **Ethereum, Solana, Arbitrum, Base, Monad, Ink, Tempo, Robinhood and Arc**. All nine returned observations in this generation. Canonical Ethereum supply includes bridge locks, remote supplies are representations, and additive totals/resident percentages/reconciliation ratios remain null with completeness false. These asynchronous token reads do not establish bridge migration, authority or settlement reconciliation. Plasma's USDT deployment and USDT zero-hook evidence are not transferred to USDC.

## Axis 1 — selected price and retained stability history

Selected series remains **CoinGecko market / theoretical NAV**, from `syrupusdc_backing_history.json` fields `peg_market_price` and `peg_theoretical_price`. Accounting NAV and `syrupusdc_peg_history.json` are not substitutions.

Latest indicative discount is **-11.52bps**. The retained month has **720 raw rows / 719 hourly observations / 701 valid paired peg samples**, spanning **29.96 days**. Sample mean deviation **-8.72bps**, range **-48.35 to 15.55bps**, largest retained gap **2.00h**. These are sample observations, not duration at the extrema or executable prices. The requested 90-day window contains only the same retained ~30 days; no 90-day conclusion is supported.

## Axis 2 — accounting and collateral scope

| Measure | Selected served value | Scope |
|---|---:|---|
| Canonical totalAssets | $949.13M | Canonical vault accounting |
| Enumerated principal | $934.87M | All 33 manager positions, zero principal residual |
| Numeric row valuations | 25 / 33 | 94.28% of all principal; numeric presence is not custody assurance |
| Numeric collateral sum | $1,103.83M | Available position rows, currentAssetAmount × configured unit scale × producer price |
| Reported pool aggregate | $1,612.24M / 172.46% | Maple poolV2 scope/time/allocation unresolved against row sum |
| Credit principal priced | $865.22M / $898.72M | Missing $33.5M WBTC valuation; full-credit ratio null |
| Free liquidity / pool cash | $14.26M / $11.57M | Cash plus accrued interest / immediately held USDC respectively |

The **seven material low reads cover $355M**. A direct below-par row diagnostic also includes a separate $5 USTB dust row; it must not be conflated with those seven health readings. The matched issuer figures appear consistent with GraphQL `assetAmount`, while the producer values `currentAssetAmount`; raw amounts, scales, source prices and times are retained. This narrows the disagreement but does not resolve which quantity represents realizable collateral or the loan/custody allocation. Neither issuer display nor GraphQL is silently promoted to recovery truth. The row/aggregate mismatch remains unresolved.

The retrievable Network Firm summary covers **both Syrup pools**, dated October 27 01:00 UTC, not a per-USDC or per-loan attestation allocation. Accounting PCR 100%, zero recognized losses and zero current protocol distress flags do not establish safe custody or disprove a shortfall. The BM tooltip/body no longer declares low readings an artifact or PCR an authoritative off-chain solvency measure. Remaining unknowns are evidence gaps, not scored loss determinations.

## Axis 3 — canonical liquidity and retained quote history

Canonical selection remains **PegTracker KyberSwap / Ethereum / sell to USDC / market-sized notional**. DexTracker's `liquidity/1` overlay supplies venue inventory and does not replace depth, primary exit or rating. The actual served merge retains the exact base `exit_mark`; supplemental route/venue observations do not create a competing ladder.

At $250K, current baseline-relative impact is **-7.60bps**, while all-in signed return `(fill_ratio−1)×10000` is **-5.95bps** versus market-sized notional. Neither is full cost versus NAV. The primary **50bps depth is a floor ≥$1M**, `ladder_exhausted`; no exact crossing is located. The separate 200bps field is not substituted.

The retained $250K series contains **220 distinct successful quotes over 27.52 days**; all-in median **-7.83bps**, IQR **3.18bps**, largest quote gap **6.00h**. Retained quotes are not fills, settlement, an attempt/failure denominator or measured primary request-to-fill latency. Empty queue pointers do not close latency evidence.

The latest week contains **168 hourly cushion samples** over 6.96 covered days, median **1.34%**, **164/168 below 2%**. This cash-plus-interest measure is distinct from pool cash and from executable secondary depth. No USDC-specific new hook/route assurance is inferred from the USDT follow-up.

## Retention and definition boundary

All **718 overlapping timestamp rows** preserve their financial fields; there are no changed common rows. Two rows expired from the rolling export and remain in `before/`; two normally generated rows carry the new classification version. The two new rows fall in one UTC hour, so hourly statistics keep only its newest observation. Old unversioned rows retain their old definition. No historical credit population, borrower/custody/valuation trend or per-position collateral history was fabricated or retrospectively relabelled.

Method: newest observation per UTC hour, unweighted arithmetic/empirical statistics, valid paired peg observations only, quote deduplication by measured_at with source/chain/pair/market identity fixed. `derived-metrics.json` preserves full precision, endpoints, counts, gaps and per-window version counts.

## Assessment items and remaining gaps

1. **riskAnalyst authored envelope is still pinned to 2026-10-28T08:44:43Z**, while measured backing is 2026-10-29T01:49:29Z. Its older coverage/aggregate and rationale fields need explicit reassessment/regeneration from this package. Do not present those old authored snapshot facts as refreshed measurements or silently overwrite the old evidence archive. Scores remain held during this handoff.
2. Determine implications of the issuer/GraphQL field disagreement, unpriced WBTC, aggregate allocation/time mismatch and missing per-pool/per-loan custody evidence. Numeric coverage does not close these questions.
3. USDC route simulation, actual fills/settlement, primary latency and local-chain executable coverage remain unproved. The successful quote-duration evidence is separately available; an upgrade is not automatic.
4. Token enumeration is not bridge lock/liability, replacement-pool authority, migration or in-flight settlement reconciliation.
5. **Consumer scope:** complete versioned books now group non-credit positions by exact source strategy_subtype, even when roles share a token symbol. Treasury/LP labels no longer become parked reserve or T+0 cash assertions; exit readiness is unmeasured. Legacy grouping remains only for older or incomplete row sets and is not independent cash-availability evidence. No source classification or score was changed by the display adapter.
6. An optional live TIDR report-context request returned HTTP 403; no live report-content or publication verification is claimed in this task. Report refresh/publication follows riskAnalyst's assessment rather than this source handoff.

All authored scores are held: **Overall 6.5; axes 8.5 / 6.5 / 7.0 / 5.5 / 4.5 / 5.5; legacy Redemption 7.5**. No automatic score, aggregation-convention, authority-date or report changes were made.

## Package contents and replay

- `before/`, `after/`: actual served inputs, JavaScript, manifests, metrics and actual merge selection checks.
- `producer-selection/`: exact standard producer outputs selected for BM publication.
- `producer-evidence.tar.gz`: retained public source bodies and 239 instrumented HTTP request/response captures, producer report, review mapping, source code, matched collateral investigation, validation and tests. Its source manifest refers to the full producer workspace archive; omitted operational logs and fleet-wide latest data are not represented as delivered payloads. Every delivered file is separately covered by the outer package manifest.
- `source-definition-changes.json`: exact membership/denominator/version/retention differences and remaining authored-input gap.
- `display-verification/`: final served renderer/index check, separate from the earlier immutable `after/` capture.
- `reproduce/`: standalone scripts; `package-manifest.json` hashes every delivered file.

From this directory, replay without network or writes:

```bash
python3 reproduce/build_syrupusdc_evidence.py --phase before --review-dir .
python3 reproduce/build_syrupusdc_evidence.py --phase after --review-dir .
python3 reproduce/compare_syrupusdc_refresh.py --review-dir .
node reproduce/verify_syrupusdc_selection.cjs before .
node reproduce/verify_syrupusdc_selection.cjs after .
```

Producer reports **47 focused tests passed** and its 539-file archive manifest was independently checked. BM independently checked exact 24 issuer credit links, all emitted provenance, raw accounting preservation, four selected/served file hashes, full source manifests, unchanged overlapping histories, retained quote/peg identities and all six served authored scores. The original riskAnalyst calculator independently reproduced all retained-window peg/cushion statistics. BM regression tests cover unavailable loan-only scope, uncorroborated collateral copy and route-assurance boundaries. These are source-selection/statistical checks, not custody, economic-loss or trade proofs.
