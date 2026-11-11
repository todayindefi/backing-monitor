# Syrup pair consumer review — November 11, 2026

**Current status: published and verified.** See [production release](../syrup-production-2026-11-11/README.md). The staged holds and defects below are historical.

Completed BM internal association of RiskAnalyst assessment `syrup-pair-six-axis-2026-11-11-v1`, committed in RiskAnalyst revision `8ef23dc91648d658a7344f69777b2684dee7ec6f`. Ethereum syrupUSDC is 6.0 provisional and syrupUSDT is 5.5 provisional. All 14 authored score fields agree across the committed assessment, reports and index. Historical remote-chain grades are unchanged and were not reassessed. Full-verification dates remain October 13.

Evidence version: `sha256:54e6abc3d98e5a0db31757660213ad9bc2f1821a1b156955575ee5fd443b2d5b`. Common financial pin: Ethereum 26389831, November 11 at 06:16:59 UTC; other producer observation clocks remain separate.

Private consumer receipt SHA256: `28e5e3a8f2c27dfd0ae8b2a5016745fa63b61a71041c568478bae1dbd6898292`. Association SHA256: `c20904df537e9789b8e348946a7ebef3694434bcb9e3b243c9a585120255cbe0`. Field-parity receipt SHA256: `fb81f62e3df36076b1851765fa043684ef1b43e73fc1bb55e2b21ad3bcb98882`. Frozen evidence and screenshots remain in the private review workspace.

## Served checks and remaining gaps

Read-only checks covered both assets at 1440px and 390px on staging, in light and dark modes. All six sections rendered with no JavaScript errors. The new authored version is not served: axis overlays retain October 29/28 clocks, distinct from November 11 normal backing payload clocks. Internal association acceptance does not establish deployed parity. Dedicated overall-score presentation was not verified.

Both mobile pages overflow: syrupUSDC document width 595px and syrupUSDT 600px at a 390px viewport. Desktop pages did not overflow.

The displayed accounting-derived 100% backing and small surplus must not imply independent credit backing assurance. The normal shared-strategy reader uses global manager assets rather than pool-specific claims; the pinned pool-specific reconciliation is separate. Unverified collateral valuations, payment coverage and cash realizability remain explicit gaps. LedgerLens is a technology report, not an independent assurance opinion. USDG stability scores lack matched-history calibration against this pair.

TIDR owns separate report staging. This review changed no normal producers, public dashboards, jobs or publication flags and performed no transactions. Live parity and mobile repairs remain outstanding.

## Bounded follow-up: local stage v3

Completed an isolated local stage of the accepted authored overlays, qualified loan rows and corrected financial candidate. Public staging/production and normal producer roots remain unchanged. Both assets render all six sections at 1440px and 390px, with all 14 authored fields matching per viewport, no JavaScript errors and no document overflow. Mobile assessment rows expose concise scores with expandable bases. Computed bands retain their own methods. Accounting equality and small residuals no longer imply independently verified backing; protocol flags no longer imply verified servicing.

PegTracker's bounded full producer invocation uses Ethereum block **26390336**, November 11 **07:58:35 UTC**, distinct from the assessment's 26389831/06:16:59 UTC. All 21 owner artifact hashes and 226 pinned read-only RPC records were verified. Both full offline builds succeed. Cash plus pool-owned strategy claims minus NAV is exactly zero in raw native units for both pools. Shared managers use `assetsOf(poolManager)`; loss recognition uses pool-manager `unrealizedLosses`. Shared-manager principal/interest/loss allocations remain null. Independent credit NAV remains unknown. Original loan snapshots (05:42:25/05:43:29 UTC), market and documentary observations remain dated separately. The newer accounting snapshot is a supplemental stage, not a rescored assessment.

Remaining financial gaps:

- USDC $200m loan: zero current amount versus nonzero alternate amount; field semantics, custody movements and servicing unverified.
- USDC $155m across six source readings: below-par calculations uncorroborated; repeated quantities do not establish shared or separate pledged allocations.
- USDC $33.5m WBTC loan: reader defaults to 18 decimals and has no price; this explains missing valuation, but exact token/unit/price binding remains unknown. The conditional 8-decimal interpretation is not promoted to a verified value.
- USDT $50m loan: original raw collateral amount and source clock unavailable; rounded display cannot reconstruct them.
- No matched custody or actual repayment evidence closes these gaps. Exact Maple questions are prepared, not sent.

Normal producer entrypoint pinning/rollout and public deployment remain separate acceptance steps. The legacy common authority graph retains its own older clocks; current authored explanations do not certify a refreshed graph.

Private handoff `stage-v3/handoff-v1.json` SHA256: `fc7470aa9b8db1f4a53304e699caa8a00d2b8d0dec2a7e262edfd46f6ffe03ea`; receipt `0f463d7f4cbc3ef8d6b3741e32a79559c51234d5aba586f48818d13177ce8424`; source index `4cdbdf0b90f926c262eecfcd7e8c1ce3068bc38806ca94fb0ef6c3f5aa8af465`. Shared-v1 checker exits 0 for the bounded local-stage scope. Four focused renderer tests pass. RiskAnalyst and PegTracker received the handback. No jobs, transactions, scores or production publication changed.

## Public staging and normal entrypoint acceptance

**Acceptance reopened after user review:** the first public candidate omitted measured peg/backing/liquidity/dependency/issuer blocks and thresholds. The original fourteen-score/layout checks did not establish measured dashboard completeness. The repair below must supersede that narrower acceptance.

User-authorized staging-only integration is complete. Both actual producer `main()` subprocesses ran in isolated outputs, acquired/rechecked Ethereum block **26390739**, November 11 **09:19:23 UTC**, and passed offline entrypoint replay. All 55 owner artifact hashes and 224 read-only pinned RPC records were verified. Required own-claim failure produces no snapshot/history; production output roots are rejected. Both raw NAV reconciliations are zero. The original assessment pin26389831, earlier supplement26390336 and original loan/market/documentary clocks remain separate. Grades and independent financial unknowns are unchanged.

Public staging URLs:

- https://staging.tidresearch.com/dashboards/?asset=syrupusdc&syrup_stage_review=20261111
- https://staging.tidresearch.com/dashboards/?asset=syrupusdt&syrup_stage_review=20261111

Deployment `6af4358f90076c06cfaf521d` targets the separate `tidresearch-staging` Netlify site. Eleven allowlisted static overrides were added; previous staging build bytes and routing configuration were preserved. No private evidence tree was uploaded. All eleven public file hashes match. Both assets pass desktop1440/mobile390, light/dark, fourteen authored fields per viewport, original/current clock checks, privacy checks, zero JavaScript errors and zero document overflow.

Served SHA256 fingerprints:

| Public staging file | SHA256 |
|---|---|
| syrupUSDC backing | `32357f2d3606510644b11febe7bd5b317103b08874cbb469ad9da797d6478d8f` |
| syrupUSDT backing | `a882b9cc0157bf11d933513edf5eb82f07c373d93923d63c3aeb2a06a257b994` |
| Syrup renderer | `bc95df8fd3f48d1820936b268ccd6001f9106dfd98edc5666bb558470c5714b1` |

Production source/output/runner/overlay-selection fingerprints checked locally are unchanged. Nine successful production Syrup asset responses retain exact hashes. Two production dependency endpoints return503/404 and are unavailable for valid-payload equality checks. Production hub raw HTML varies because Cloudflare rewrites footer email-protection tokens; repeated normalized content and the owner's accepted-build comparison match, and production deploy identity remains unchanged. No production deployment, job, trade, issuer outreach or score change occurred.

Final private shared-v1 handoff SHA256 `342b332de226e463cf17c1855f9ed509cd91f9384a515e182bb49031809d6714`, receipt `b60fbcd9524006a25d39aa142420c0923f31d3e2b121d10ac1b1ea0a6b87412d`, source index `2ac28450b4cb505b2022b3363d45d350b404fcb35a00ee7ff50252c6c9709e60`. Checker exits0. Served browser receipt SHA256 `ffca7061f1f33ffcf22536ce2107cba5c0fe5f6e6fe988a74d7de563c640a9d7`. RiskAnalyst received the handback.

Remaining gaps: the collateral/custody/servicing questions above, complete authority/build and remote coverage, canonical report links still targeting production, and future staging builds needing to retain or explicitly replace this one-off versioned override. Public staging is not production acceptance.

## Complete-measurement repair accepted — both Syrup assets

The earlier public-stage acceptance is superseded. The candidate had consumed the base producer's `.staging` intermediate without the normal family enrichment. It also omitted nested measured peg/liquidity inputs. Authored scores and six section containers survived, so the earlier score/layout checks passed while most measured tiles and the peg charts were empty. This was a transport/pipeline regression, not evidence that peg tracking had ceased.

The repaired actual isolated producer-plus-family pipeline restores the measured blocks, market/exit sources, thresholds and history references. All 45 owner artifact hashes verify. Existing frozen full histories supply the actual chart series. A new read-only coverage gate rejects the original broken candidate independently of score matching, with five regression tests covering missing measurements/history/clocks and noncash accrual misclassified as cash.

Current public staging:

- [syrupUSDC](https://staging.tidresearch.com/dashboards/?asset=syrupusdc&syrup_stage_review=20261111contrast): reported NAV approximately $905.4m, explicitly authored Backing5.5/10, retained secondary discount approximately0.13%.
- [syrupUSDT](https://staging.tidresearch.com/dashboards/?asset=syrupusdt&syrup_stage_review=20261111contrast): reported NAV approximately $274.0m, explicitly authored Backing6.0/10, retained secondary discount approximately0.11%.

The top backing value reports accounting NAV; it no longer substitutes a blanket “independent backing unverified” headline. Independent reserve-to-claims coverage remains unknown and is explicitly qualified. Both liquidity tiles use actual pool cash (~1.9% of NAV) rather than cash plus accrued interest. Cash is funding capacity subject to withdrawal gates/queue, not a guaranteed immediate exit. Authored scores remain separate from computed market/cash bands. Source-derived above-par/missing collateral readings are not mislabeled as below-par just because independent verification is absent.

Final deploy `6af43eced72eda3e49db47c1`, staging site only. All13 served file hashes match. Four asset/width cases verify all six populated tiles, actual market/NAV chart series (167 paired USDC observations and166 paired USDT observations in the displayed window), fourteen authored fields per viewport, original/current clocks, privacy, zero JavaScript errors and zero document overflow. Desktop1440/mobile390 light/dark screenshots were checked after theme refresh settled. Header and NAV text colors were checked in dark mode; this is a bounded readability check, not a full accessibility certification.

The repair reuses accounting block26390739/09:19:23UTC and the original matched market observation05:17:52.619076UTC; it performs no new collection and does not renew loan, quote, documentary or authority clocks. Eight versioned RiskAnalyst v2 exports deliberately mark backing scores as authored; grades are unchanged. Production source/routing/overlay selection/jobs are unchanged. Existing normal scheduler output advances are separately recorded, not represented as manual updates. Legacy authority, independent collateral/custody/servicing and remote coverage gaps remain open.

Final served SHA256 values:

| File | SHA256 |
|---|---|
| syrupUSDC backing | `67222441c3b6066ef0d9e929a94a595280f06b28f857d0201d03478115342246` |
| syrupUSDT backing | `ada9b5b960986191cb102216143593f86bb5027b09eaa10f9cf1ebf55bccb452` |
| Syrup renderer | `1b6971d236c4c6d92ef683d0c6c1a10e7a7aa00693cd5a6a2d0f8c65a7f00f1a` |

Private final shared-v1 handoff SHA256 `1887d4aff9d3e3789345dce6dfa112ee1055601024bc9b9440129cf2b108bfef`, receipt `e303d9015fe7b2bd3f5ab5e2c1af3fca43f5711defe52e9dd85c647039c1704f`, source index `1084bd1d3746386aa210c353511104e9d78483bc42e475d8ea28af1d8c79fd7f`. Checker exits0. Public browser receipt SHA256 `0f0e6d785a099f90f568e4496e46c4162f99489da77e194f987d035f15a0dff2`. RiskAnalyst received the corrected handback. No production publication, transactions, issuer outreach or recurring jobs occurred.

## Liquidity tile: cash and DEX depth — production promotion held

After requesting production promotion, the user paused it to require depth alongside the exit/cash metric. Production remains on hold. Both staging tiles now show pool cash and Ethereum DEX depth separately, with the band explicitly labeled **Cash band** rather than implying a combined exit rating.

The existing producer `exit_mark.depth.depth_50bps` supports a **≥$1m tested depth floor at0.5% price impact** for each asset. This is a lower bound at the tested size, not a measured crossing or maximum. Both ladders are partial. Original quote clocks remain November11 **04:31:39UTC** for USDC and **04:31:51UTC** for USDT. Price impact is relative to the source's smallest successful quote, not an all-in NAV haircut. Quotes do not prove execution or settlement, and queue cash does not establish secondary depth.

This stage changes only the renderer; all12 data/history files remain byte-identical. No new collection, grade, job, producer or production change. The renderer checks exact token/chain identity and keeps missing, nonresponsive and unsupported depth unmeasured; it preserves floor/bracket and original threshold semantics. A separate candidate-renderer test covers these cases.

Public staging deploy `6af442dada16074447bdecc0`. Both assets pass all13 served hashes, four desktop/mobile cases in light/dark, dual-metric/quote-clock/partial-floor/cash-only labels, all six tiles, real peg chart series, fourteen authored fields per viewport, privacy, zero page errors and zero document overflow. Production's previous renderer hash remains unchanged.

- [syrupUSDC depth tile](https://staging.tidresearch.com/dashboards/?asset=syrupusdc&syrup_stage_review=20261111depth)
- [syrupUSDT depth tile](https://staging.tidresearch.com/dashboards/?asset=syrupusdt&syrup_stage_review=20261111depth)

Renderer SHA256 `b0d0e8d032b63daade7c0bc0b847436924d2ce9193e38a5410a1fc88070a7a01`; public browser receipt `b4d9e5b86c888914fc1b007f08d5ac1ede65019db7ac307db7d13e5beeb7625d`. Private shared-v1 handoff `dd47b19c00498d54b3ad26fa0a188fab8e18b418d74d6c0733ce6790c4c1d093`, receipt `936093e451e142dc99e289e489a43b1cb31f4bed82a431ef66de3f071d5a1a53`, source index `47b13a465789ce2b3c38b3059463a9854f90be1b3460ecb1be733218dffd0835`; checker exits0. RiskAnalyst received the staged-only handback and production-hold status. All earlier independent collateral/custody/servicing/authority/remote gaps remain open.
