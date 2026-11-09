# Seven legacy-reference repairs — November 9, 2026

The seven existing producers now apply the existing RiskAnalyst §7.5 rule: no separate $100 probe/reference; fix each route's reference to its lowest successful economically valid decade rung starting at $1,000. This is a bounded one-off refresh through normal producers, with durable source changes and no new schedule/jobs, user-wallet queries, transactions, alerts or authored score edits.

## Results and clocks

| Asset | November 9 UTC collection window | Primary 50 bps result | Reference |
|---|---|---|---|
| USG | 12:57:06–12:57:41 | $455,078.125–$458,593.75; revalidated, precision met | $1,000 |
| fxUSD | 12:57:41–12:58:37 | $4,304,687.5–$4,339,843.75; revalidated, precision met | $1,000 |
| BOLD | 12:58:37–12:59:37 | $1m–$10m coarse range; stability-floor refusal | $1,000 |
| sUSDe | 12:59:37–13:00:44 | $1m–$10m coarse range; endpoint validation failed | $1,000 |
| DUSD-Alto | 13:00:44–13:01:46 | Observed $1m quote-size floor below minted supply; no current sellable-float/cash claim | $1,000 |
| syzUSD | 13:01:46–13:01:56 | Configured Plasma/Monad/Ethereum legs failed or invalid; depth unknown | All three null |
| reUSDe | 13:01:56–13:02:02 | Native sUSDe partial leg only; USD cost/threshold/depth null | $1,000 input-reference notional |

These are dated quote observations, not executed capacities, exact maximum exits or settled cash. Secondary 200bps evidence remains separate. Input sizing marks keep their own original clocks, including syzUSD's older mark. No cross-chain sum, improved-liquidity trend, source timestamp substitution or downstream cash valuation is inferred.

## Source and acceptance

DexTracker source commit `577317e64c2ddbd51994d778a505b51c251a2db0` (not pushed per owner). Frozen delivery manifest SHA256 `6ce9e6244b336eb015c260f66f4118bdc53c8b7d5ef2b524f063d8a9aa57e0b7`. Private BM version `sha256:0e23df72eee9e20753209de6adcf692cec25a1f36b9d1f6e69bddb1d00b9bdae`; complete source index and content objects remain ignored/private.

Independently rehashed 26 delivery entries, 359 raw entries and seven original raw manifests; seven source/test snapshots match committed bytes. Run inventory confirms seven live journals with 345 HTTP attempts (including ten HTTP429 retries within the pass) and seven mock/no-HTTP directories. Native journals retain eleven RPC execution errors; these are not zero-liquidity measurements.

Independently checked exact configured asset identities, 164 routed-request token pairs, native raw-output scaling, lowest valid decade references, baseline-relative arithmetic, no sub-$1,000 grid rows, true precision flags within the specified width, Alto's null accepted brackets/below-minted-supply floor and native null USD measures. Grid measurement values and row clocks match the collected-before-projection versions; USG's inherited Kyber expiry explanation was correctly replaced with its Curve-view scope. Registry and authored assessment-input hashes remain unchanged. Exact normal hashes and clocks: `producer-acceptance.json`; prior versions: `before-manifest.json`.

Owner reports 87 focused tests passing in an isolated staged checkout; no full-suite claim. The owner supplied a separate primary/secondary wording erratum without mutating the accepted packet. Machine fields, specification and corrected live handoff agree: primary50, secondary200; native USD thresholds remain null.

## Consumer repair

Per-request evidence now renders supported normalized fields, original source/request/receipt clocks, failure states and sizing/phase bases. Where only raw request fields exist, raw amounts remain raw and status is not promoted to economic validity. Unlabelled phases stay unclassified; no phase is invented from request order. Derived USD input sizes are labelled with the producer's dated-anchor basis. USG's scalar output is explicitly the producer's marked aggregate across USDC/frxUSD legs, not one cash token.

BOLD's bespoke headline previously ignored the producer's refined 50bps bracket and estimated a range from the decade grid while claiming its solver was disabled. It now prefers the declared matching-threshold result, renders exact interval/precision status, fails closed for an explicitly unavailable result and qualifies its legacy grid-only fallback. Rating-number logic is unchanged. All seven views retain original cost signs and distinguish reference spread, impact and gas.

Local browser checks cover all seven at 1440/390px: complete source grids, all published non-grid request rows, no stale $100 warning, actual baseline/failure/native/Alto bounds, BOLD declared range/precision, working details and no page overflow or JavaScript errors. Source/null/unit/clock/escaping, draw provenance, BOLD source precedence, Saturn issuer/queue/oracle-HF/privacy, USDat accounting and Re/Syrup regressions pass. Served hashes and screenshots are recorded alongside after deployment.

## Remaining gaps

BOLD/sUSDe primary precision is unresolved. syzUSD has no valid reference and no demonstrated onward csUSDC cash conversion; configured-chain attempts are not exhaustive deployment coverage. Alto's quote floor is not economic public float, funded recovery or usable Frax access. reUSDe lacks a complete independently valued cash leg. Some draw phases are unknown; RPC views lack provider generation/expiry and use latest-tag observations, while routed hop blocks may be mixed/older/zero. Current contract authorities, approvals, fills, withdrawal settlement and bridge delivery are not certified by these quotes. Historical inventory/primary-exit statements are not refreshed by this commission.
