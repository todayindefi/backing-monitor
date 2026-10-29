# USDe / sUSDe issuer envelope consumption verified — October 29, 2026

Status: **published and actual served consumption verified**. Commit `2618a84642f738af45e688a33e6d514d928c1f46` synced only `data/usde_issuer.json` and `data/susde_issuer.json`. GitHub Pages run `40842427367` succeeded. No consumer mapping or renderer change was needed.

Source request: `riskAnalyst/specs/handoffs/ethena-issuer-rationale-wiring-2026-10-29.md`. This closes the earlier issuer-basis **selection** gap through the existing selected `issuer/1` envelopes.

| Asset | Actual served issuer SHA-256 | Selected score | Original authored score generation date |
|---|---|---:|---|
| usde | `9cc7b88cea6517cd1a59af7b119efc7e6931677a473ff882820f92de73aac3ca` | 7.0 | `2026-10-11T00:00:00Z` |
| susde | `879f80026d113380e6de0aee2ee580f8da54e1aecf4fd92cf63ce6ee4f93d5d0` | 7.0 | `2026-10-11T00:00:00Z` |

The envelopes' review `as_of` is `2026-10-29T08:22:12.607726Z`; it does not replace the original October 11 authored score date. Both payloads match RiskAnalyst's exact source bytes and its recorded expected hashes.

## Consumption checks

The actual public `common.js` (SHA-256 `d9d7cbb5fe1dd8f7be3bd324391e912ed660c88451d8cf8d38b3f5915584511a`) and Ethena renderer (SHA-256 `1275bc3f4ff6e857756d762bbe45100726aec6250abf19885faaca00deb7986b`) were fetched with all present registered overlays. Actual optional backing overlays returned 404 and were not silently omitted from a complete selection replay.

1. Executed the served `CommonRenderer.mergeAxisOverlays` for each asset. The selected issuer score basis exactly equals the corrected envelope and the authored axis-basis counterpart. The selected facts exactly equal the corrected envelope.
2. Executed the actual `EthenaRenderer.preRender`. It preserves the entire corrected basis and facts; neither stale-fact compatibility handling nor other overlays replace them.
3. Executed the shared `issuerPanelHtml`, which the Ethena renderer explicitly inserts into its visible issuer panel. Corrected facts appear in generated HTML, including `insufficient_history`, null average/milestone, current activation uncertainty and dated issuer disclosure/custody limits. The old current-dormancy and live-October-11-fund claims are absent.
4. Compared every numeric score and every per-chain/override field captured from the consumer before/after publication and before/after pre-render. They are unchanged. Both issuer badges render **Issuer 7.0/10**; score tooltips use the original October 11 generation date with authored/inherited source attribution.

**Display scope:** the complete score-basis paragraph is selected and retained in the issuer object; the existing issuer panel prints its summary/facts rather than that full paragraph verbatim. This result proves served selection and rendered corrected facts, not a new full-basis paragraph layout or visual browser QA. No renderer change was requested or introduced.

## Artifacts and remaining limits

BM evidence directory: `specs/reviews/ethena-issuer-wiring-2026-10-29/`. `before/` and `after/` contain actual public payload/code bytes, serving URLs, SHA-256 and retrieval clocks. `expected/` contains the exact RiskAnalyst envelopes. `after-results.json` contains selected full rationale/facts, score tooltip/dates, unchanged score/chain maps and selection assertions. HTML snapshots are `after-usde-issuer.html` and `after-susde-issuer.html`.

Replay: `node verify.cjs after` from this directory. The earlier `candidate` replay is preserved separately; it is not used as proof of publication.

The underlying limits are unchanged: issuer-reported backing is not independent custody assurance; current complete 14-day supply history/activation evidence remains unavailable; source gaps and liquidity route/bracket/precision/execution limits remain as previously handed back. No report, score, chain override or verification-date change was performed by this sync.
