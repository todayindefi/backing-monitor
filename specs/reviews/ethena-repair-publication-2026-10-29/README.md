# Ethena dashboard publication verified — October 29, 2026

The user explicitly authorized publication after the pre-publication acceptance handback. Commit **`abbf893bff1c9b1d2cbbc1abe1354039bc460701`** was pushed to main; GitHub Pages deployment **40838784648** succeeded. This supersedes the earlier candidate's publication-blocked status, not its immutable source evidence or unresolved custody/liquidity limits.

Actual public index and renderer bytes were fetched and matched to the approved files. The public script URL is `js/renderers/ethena.js?v=20261029a`.

- Served renderer SHA-256: `1275bc3f4ff6e857756d762bbe45100726aec6250abf19885faaca00deb7986b`.
- Served index SHA-256: `b6852c93517a223159b28779c87d3af29bd3518ab5c75c8a590d0a084a3302a4`.
- Full 25-response manifest: `specs/reviews/ethena-repair-publication-2026-10-29/served-sources.json`.
- Executed public-code/source result: `specs/reviews/ethena-repair-publication-2026-10-29/result.json`.
- Verification time: **2026-10-29T08:00:03.667Z**. JavaScript-generated HTML checks; not visual browser QA.

| Asset | Producer generation | Issuer source observation | Selected liquidity quote |
|---|---|---|---|
| usde | 2026-10-29T07:02:10Z | 2026-10-29T05:59:28.000000Z | 2026-10-29T00:10:21Z |
| susde | 2026-10-29T07:02:10Z | 2026-10-29T05:59:28.000000Z | 2026-10-28T23:49:20Z |

The actual served JavaScript was executed against freshly fetched public inputs. Verified:

- Issuer-reported coverage/backing/fund visible, with issuer observation/retrieval and canonical-supply clocks, issuer USD denominator and distinct token/share/USDe units. Independent offchain custody and allocation remain unverified; unknown custody/CEX allocation is no longer shown as zero/100%.
- Fee-switch `insufficient_history` means no current mean or milestone verdict; requested and actual windows are shown. This is not governance activation evidence.
- Source/definition/acquisition gaps break history lines; token quantities and dollar values have distinct axes. Historical gaps are not filled or interpolated.
- sUSDe selects the DexTracker **sUSDe→USDe** overlay, primary **50bps** unresolved **$1m last clear / $10m first fail / $9m width**, precision false and refinement refusal retained. Provider, quote clock, notional anchor, first-rung impact convention and execution limitations are visible. The legacy ~$3.32m result remains explicitly **200bps**. The base direct-USDC floor and old 50bps crossing are not substituted.
- USDe's legacy **200bps** headline and separate nested **50bps** floor are explicitly distinguished. Provider, source values and threshold fields were not altered.
- Every numeric score and selected liquidity chain map matches pre-publication verification, and Ethena pre-render does not mutate them. Reports and their overrides were not changed by this publication.

**Remaining rationale gap:** the issuer block in `*_axis_basis.json` is not consumed by the existing issuer overlay mapping, which reads `*_issuer.json`. The four financial/dependency basis blocks are consumed correctly. RiskAnalyst should supply the issuer prose through the selected envelope or authorize an explicit mapping change, preserving the score. The dashboard patch did not silently introduce a new overlay contract.

Other limits remain: issuer-only offchain assurance/full allocation, separately dated composition/positions, complete current 14-day history, authoritative fee activation evidence, liquidity producer ownership/convention/precision metadata clarification, simulation, fills, settlement and primary latency. Publication does not close these evidence gaps.

Prior exact six source hashes, report score/chain override checks, original history preservation and raw source evidence remain in `specs/reviews/ethena-repair-verification-2026-10-29/`. Publication re-fetched the current source set; unchanged responses reference their original evidence files by hash, while changed public code/index are stored in the publication directory. No unrelated FXSave work was published.
