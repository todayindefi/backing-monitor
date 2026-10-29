# Ethena repaired-source and served-consumer verification — October 29, 2026

Status: **producer repair and actual served-input verification PASS; end-to-end display acceptance NOT COMPLETE**. The existing PegTracker assignment is completed and the routine BM sync has already published its reviewed outputs. No competing producer run, report/score/override edit, dashboard deployment or public push was performed in this verification. Prepared dashboard changes remain local because the acceptance supplement explicitly says: “Do not publish reports or dashboards as part of this assessment handoff.”

Acceptance source: `/home/danger/riskAnalyst/specs/handoffs/ethena-assessment-repair-acceptance-2026-10-29.md`. Source repair report: `producer-report.md`; exact public acquisition manifest: `served-sources.json` (25 inputs/code responses with retrieval clocks and SHA-256). `source-results.json` and `consumer-results.json` record the replay and limits.

## Actual served hashes

All six public files match PegTracker's independently reviewed repair package **byte for byte**:

| Public file | SHA-256 |
|---|---|
| `usde_backing.json` | `02cb2a909b3a7c3b47f5067fef72a508ee67e60ebbc75716a2c75c7cb4ea0fb5` |
| `susde_backing.json` | `60f7b7b0c586db6e0c3528c55b5be30ca1d96a20422e431f2d0c37c848762fb4` |
| `ethena_family.json` | `6e18c76eb70a747f6950e2abcb7a2c15474004a2e22956cdddc33b76059fe97a` |
| `usde_backing_history.json` | `a0726174749120d585362138e4a66c50061eb92584bc9d3ab36e0dba7a3a40a7` |
| `susde_backing_history.json` | `717a111d6deb17f4d8eef2111e79d8d65d94c574008251663b94b60c5d1906b2` |
| `ethena_measurements_daily.json` | `356fd0204fb3dc27df72f874866d55f355ef1bcb25d653e6d047666ebe1b0a15` |

The updated authored files also match RiskAnalyst exactly:

| Authored file | Served SHA-256 |
|---|---|
| `usde_axis_basis.json` | `fa874381177f36a799b7a5063662f4bbcf0c0cfde6a8fe37ad59a3bcb5791fce` |
| `susde_axis_basis.json` | `02f10d0d93a42ab7ae3d1cb43dd3bee6b516e45f77bbf5bd0936ae8bcfc2507e` |

The financial/dependency axis-basis prose for peg, backing, liquidity and dependencies is actually selected for both assets. **Issuer prose in the axis-basis envelope is not selected:** the issuer mapping reads `_issuer`, not `_axis_basis`. Current selected issuer basis is absent. This remaining rationale-wiring gap is explicit; byte-identical file transport is not equivalent to every field being consumed. RiskAnalyst should propagate that prose through the existing selected issuer envelope or approve an explicit consumer mapping change; no score change is needed.

## Observation clocks and units

- Backing and family generation: **2026-10-29T07:02:10Z**.
- Issuer status observation: **2026-10-29T05:59:28Z**; successful retrieval **07:01:31.868228Z**.
- Issuer backing **$4,560,198,405.35**, RF **$62,059,526.94**, same-snapshot issuer denominator **$4,542,907,916.34008**. Arithmetic reproduces **100.3806% excluding / 101.7467% including** RF after published rounding. This is issuer reporting, **not independent offchain custody or full allocation verification**.
- Canonical USDe supply: **4,543,971,515.530076 USDe tokens**, Ethereum block **26,296,767**, block time **07:01:23Z**. This separately timed quantity is not the issuer USD denominator; it includes adapter-locked supply. Remote supply must not be added. Difference from the older issuer status is a separately timed supply diagnostic, not a custody verdict.
- Same-block sUSDe: **951,705,614.5658604 shares**, **1,194,804,931.2529356 USDe assets**, NAV **1.255435412974809 USDe/share**, block **26,296,767**. Same-block ratio checks pass. One-day cooldown versus 90-day maximum is retained, without claiming actual redemption latency or fresh role assurance.
- Executable market prices and dollar values for sUSDe-held USDe remain null. Par, NAV and oracle marks were not used to invent them.
- Timestamp-less composition retains `source_timestamp=null`. Positions use their own source time; no same-snapshot allocation is inferred. Family remains partial; wallets, onchain RF and historical attestations remain separate populations.

## History and fee-switch acceptance

Both original **2,180-row prefixes** are preserved exactly as parsed, with original byte-level files retained in `producer-evidence/`. USDe's original endpoint is **October 14 14:49:58Z**; sUSDe's is **14:50:00Z**. Two acquired rows were appended prospectively, with source definitions and separate source/vault clocks. There is an explicit acquisition gap; no October 14–29 observations, prices or collateral history were invented. Source break annotations remain in each public history. Repeated issuer timestamps are not independent reserve remeasurements.

Fee status is **`insufficient_history`**, mean **null**, milestone **null**. Requested window **October 15 07:02:11Z–October 29 07:02:11Z**; observed current-window samples **07:00:29Z–07:02:10Z**, **two points**. The complete 14-day window is unavailable. The daily cache's **October 28 19:05:01Z** computation clock and other NAV/oracle/mint-redeem blocks are unchanged. The cheap fee freshness check is separate from that cache age. Neither current spot supply nor a future statistical milestone verdict proves governance activation; threshold authority evidence remains separately limited.

## Actual selected liquidity — source/rationale agreement

The public `CommonRenderer.mergeAxisOverlays` was executed against the complete captured set of registered asset overlays, followed by Ethena pre-render handling. Pre-render does not change selection, scores or per-chain judgments.

**sUSDe selected producer:** DexTracker `susde_liquidity.json`, scope `venue_inventory_and_canonical_ethereum_exit_ladder`, which explicitly publishes depth. It therefore **overrides** the base direct-USDC ladder. Selected route is **KyberSwap Ethereum sUSDe → USDe**; quote **October 28 23:49:20Z**, envelope **23:49:49Z**. It is a secondary USDe-output route, not a complete stablecoin exit or the one-day primary cooldown.

**Primary 50-bps marginal bracket:** **$1,000,000 last clear at −4.0829bps / $10,000,000 first fail at −6550.9651bps**, width **$9,000,000**, precision obligation **false**, refinement **refusal_non_monotonic**. This is an unresolved interval, not a located $1m capacity limit. The metadata also has `monotonic_in_bracket=true` for sampled bounds while the refinement refuses non-monotonic behavior; the inconsistency remains exposed for DexTracker/PegTracker clarification and does not justify asserting precision.

The external input-notional anchor is **onchain NAV × CoinGecko USDe/USD**, observed **23:49:15Z**; its NAV uses block **26,294,625**, USDe/USD mark **0.999408** observed **23:48:49Z**. The impact reference is the first successful **$100** execution rung, not that external notional anchor. Baseline spread/all-in cost and marginal deterioration are different quantities. The source's separately retained **~$3.32m lower bound is 200bps**, with its own unresolved precision, not the current primary 50bps result. The older report's ~$3.30m 50bps crossing and the base direct-USDC ≥$2m floor are not selected current replacements. No liquidity trend is inferred from those noncomparable dates/routes.

**USDe:** venue-only overlay preserves the base KyberSwap USDe → USDC ladder. The legacy top-level field is a **200bps ≥$5m floor**; a separate nested **50bps ≥$5m floor** is published. Both remain explicitly labelled until the source owner resolves the primary-headline definition. Same size does not make the thresholds/conventions interchangeable. Neither source supplies execution/fill/settlement proof; composing the sUSDe and USDe legs is non-atomic.

Both served liquidity rationales match these route/threshold limitations and carry the original scores. No source quote, threshold, bracket, precision flag, score or chain override was changed by this review or by the prepared display candidate.

## Actual display discrepancies and local candidate

The actual served renderer still gates on `source_status.llamarisk`. Because that is now `retired_http_404`, it hides the repaired issuer amounts and claims they are unavailable. Empty unknown custody allocation falls into a legacy **zero total / 100%** table; this is not acceptable. The old fee panel withholds its verdict correctly but does not expose actual input-window status/endpoints. Family trend rendering does not segment the acquisition/source-definition break. Canonical supply and USDe assets can also retain misleading dollar formatting. Liquidity provider/route, primary versus legacy threshold and false precision need explicit display context.

A concrete local candidate fixes those display issues, labels issuer amounts versus canonical tokens and shares, retains unknown allocation instead of zero, exposes fee windows and non-activation boundaries, separates token-versus-dollar chart axes, inserts null line breaks at acquisition/definition gaps, and shows the selected wide bracket/provider/anchor/conventions and legacy threshold. It does not alter source selection or observations. Candidate tests and legacy Ethena tests pass.

Candidate files: BM `js/renderers/ethena.js`, `index.html`, `tests/test_ethena_source_repair.js`; frozen copies are in `candidate/`. Patch: `/tmp/ethena-dashboard-repair-2026-10-29.patch`, SHA-256 **`d42a219a0c49ad735de2c64604df8b2a0644116d2a6e77e7c030fda3e5a56ecf`**. `git apply --reverse --check` validates it against the prepared local tree. Candidate HTML captures are labelled `candidate-*`; served captures are `served-*`. They are JavaScript-generated HTML checks, not a visual browser publication test.

**No deployment, commit or push of the candidate was made.** Public renderer/index hashes in `served-sources.json` continue to identify the old display. This is why overall display synchronization remains incomplete despite successful source repair and file transport. Explicit authorization is needed before publishing the dashboard candidate under the acceptance instruction. The issuer-basis consumption gap also remains an owner/consumer mapping follow-up.

## Validation and preserved scope

- PegTracker: **55 targeted tests passed**, and the independent offline producer-package check passed. Standard validator package records **85 passes, zero failures, one explicit unknown-allocation/custody warning**.
- BM: six actual served reviewed hashes; issuer raw-body/arithmetic/clock/unit checks; same-block vault identity; preserved history prefixes and gaps; withheld fee mean/verdict; unchanged other daily blocks; exact updated rationale file match; actual complete consumer merge and route selection; candidate/served source-selection, scores and chain-map invariance.
- RiskAnalyst report frontmatter scores, chain overrides and **October 11 full-verification dates** match their baselines. Their values and source hashes are saved in `source-results.json`. No expired rounding exception was extended. No report was edited or published by this BM task. TIDR reported its own authorized publication separately; this handback does not certify an end-to-end display rollout.
- Remaining gaps: issuer-only offchain reserve assurance; allocation/positions timestamp reconciliation; complete current 14-day supply history; authoritative activation evidence; canonical route/convention owner acknowledgment and precision metadata inconsistency; USDe 200/50bps primary definition; simulation, fills/settlement, full stablecoin exit and primary latency; deployed display and issuer-basis consumption.

Replay (no publication): `python3 verify_sources.py`, `python3 producer-evidence/verify.py`, `node verify_consumer.cjs`. Candidate tests from BM root: `node tests/test_ethena_source_repair.js` and `node tests/test_ethena_review_copy.js`. Original source archives remain unchanged.
