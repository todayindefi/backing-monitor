# fxUSD dashboard completion plan

Date: 2026-10-24. Scope: upgrade the existing registered fxUSD dashboard, not a new empty six-axis page. No dispatch, publication or promotion is authorized by this planning document. This supersedes the fxUSD execution instructions in the historical combined fxUSD/fxSAVE plan.

## October 24 re-review update

RiskAnalyst subsequently updated last_verified/last_revised to October 24 and raised Structural 4.0 → 5.0 and Overall 4.5 → 5.0; other axes held. The transported contract overlay, liquidity basis and dependencies match the updated producer files. The newly reviewed routed 50bp bracket is $4.445m–$4.480m. Both oracle ownership transfers to the timelock (October 5) and WBTC deployer-role revocation (October 10) supersede the earlier active-path claims. Undelayed Safe oracle-pointer authority and the audit-coverage gap remain.

The generated security topology still records September 22. A consumer notice now distinguishes that historical walk from the newer authored assessment, preserving both sources and their dates rather than relabeling the old walk current. The scoped source refresh is integrated from security_analyst commit 94f8329f53696239f81d9f3896c7db8a0337cade. It retains the September baseline and records October24 partial review at block26260870; deployer paths are non-actionable and collateral-oracle owner authority is delayed72h. Remaining Safe emergency/oracle-pointer paths stay active. A full re-walk of untouched layers is still outside this scoped refresh. The authority table now scrolls within its own container; full-page overflow remains a separate layout acceptance item (desktop audit observed document width 1324 at viewport 1280). Registry prose no longer freezes old debt shares/float estimates. The detailed baseline audit below describes the earlier planning snapshot; these facts supersede its old score/date and crossing findings. This limited correction does not complete the planned dashboard upgrade.

## Evidence and current state

RiskAnalyst's `/home/danger/riskAnalyst/assets/fxusd.md` exists and declares a full assessment. Last verified September 22; last revised October 21. The current frontmatter judgments are peg 5.5, backing 5, liquidity 4.5, structural 4, issuer 5.5 and overall 4.5 under review. Historical prose contains superseded judgments; use reconciled current authored fields, never average scores or author a dependency score locally.

The dashboard is registered in `data/assets.json`, uses CommonRenderer, and already receives base, two histories, liquidity, topology and editorial overlays. A local browser inspection found a peg chart, aggregate CR chart, allocation chart, three liquidity tables, five dependency tiles and authority/issuer panels. There is no fxUSD-specific renderer. Present does not mean complete.

Inspected October 24 data:

- Peg history: 387 daily observations, August 2025–October 2026; seven declared coverage gaps; 85 missing theoretical values. Export contract address is null with an unresolved-identity reason despite the canonical address being known. Repair producer identity before acceptance.
- Backing: 754 observations since September 22. Live ratios are multiples; history aggregate ratios are percentages, while historical pool ratios are multiples. These scales must be normalized explicitly.
- Backing snapshot 00:56 UTC, block 26259052: aggregate CR 132.23%; WBTC 128.07%, 87.61% of debt; wstETH 161.60%. Supply 78.220m, Stability Pool 90.12%; remainder outside fxSP 9.88%. That remainder is NOT independently measured freely tradable float.
- Liquidity snapshot October 23 23:48 UTC: seven published sizes, a separate $100 baseline, 37 venues. Headline 200-bp bracket $1m–$10m contradicts the tested $5m rung clearing at approximately 172bp incremental cost. Venue enumeration is dated September 22 and must not inherit the quote clock.
- Liquidity text still calls redemption protocol-disabled/refused using September evidence. The report establishes a designed Curve EMA gate below $0.998. Registry prose also carries stale debt/float percentages. Historical backing and authority prose quote old ratios without always separating their dates.

## Benchmark and rendering approach

Use syrupUSDC's actual charts and detailed asset measurements, BOLD's per-branch health and visible ladder, and Ethena's separation of backing, market exits, dependencies and authority as standards of usefulness. Their different mechanisms do not justify copying their financial models. Ethena intentionally uses a bespoke page stream; hidden generic sections are not its actual visible coverage.

Keep shared six-axis layout, standard tiles, charts, dependency cards, typography and disclosures. Add a small `FxUSDRenderer` only for asset-specific pool health, concentration, reconciliation and redemption mechanism panels. Do not replace the baseline with long prose or duplicate generic sections. Source clocks use compact human UTC formatting; exact timestamps belong in evidence details.

## Per-axis delivery contract

| Axis | Required default-visible content | Data and chart acceptance |
|---|---|---|
| 1 Peg | Market price, fixed $1 reference, signed deviation, source time and coverage | Actual market-price vs $1 chart, trailing seven days; longer selectable history with honest gaps. Statistics computed from plotted observations. No NAV proxy for market price. Separately show current EMA gate state and threshold once measured. |
| 2 Backing | Aggregate CR plus per-pool collateral, oracle mark, value, debt, debt share, CR and custody | Aggregate + WBTC + wstETH CR history; labeled debt-allocation chart; supply and fxSP holdings/concentration history; explicit supply–debt reconciliation. Charts use the same declared time window. No double application of wstETH wrap rate. |
| 3 Liquidity | 50bp incremental depth headline, 200bp stress bracket, visible sorted ladder, primary exit state, venue inventory | Size vs net-USDC-proceeds/cost chart and table including actual baseline, output, all-in discount and additional impact. Both thresholds refined against all successful sizes; preserve failures, nonmonotonicity, cached route blocks and gross-output peaks as observations, never universal capacity. |
| 4 Dependencies | Shared upstream/downstream tiles; WBTC custody, Lido, oracles, Curve and fxSAVE/USG/reUSD/msUSD links and coverage gaps | Current quantities tied to measured pool rows; dated editorial explanations stay dated. Generated downstream edges translated to display without hand-maintaining reverse links. No meaningless dependency pie or invented score. |
| 5 Contract and admin | Shared authority topology, keys, reach, delay, operational exceptions, unknowns; separate deployed-code/audit evidence | Recheck the 72h upgrade path alongside instant emergency/oracle paths and the reported WBTC single-key path. Clearly distinguish audited wrapper scope from later pool/custody implementations; do not infer coverage from an audit logo. No chart required for this categorical evidence. |
| 6 Issuer | Named entity, authored summary, incident/disclosure record, dated assessment and report link/status | Reconcile report/frontmatter/overlays, dates and staging status. Editorial facts are not real-time measurements. No decorative history chart. |

Pool rebalance/liquidation ratios are position-level parameters, not aggregate CR floors. Do not draw them on pool CR charts as insolvency thresholds. Any additional safety or stress threshold needs a producer-published definition and RiskAnalyst interpretation.

## Prerequisite handoffs

Prepare scoped messages first; none sent as part of this plan. Reuse the existing producer sessions if dispatch is authorized. Do not create four competing collectors.

### PegTracker

Own backing, peg history, per-pool history, normalization and recurring refresh. Repair fxUSD address binding and timestamp timezone provenance; preserve old gaps. Emit complete pool discovery/coverage, supply/debt reconciliation status, units, fxSP concentration and last-attempt/stale policy. Re-measure PoolConfiguration gate (EMA, threshold, allowed state, block/time, fee and relevant pause state), with positive/negative caller evidence where feasible; never turn a historical revert into a current refusal claim. Publish material thresholds as fields, not consumer constants. Verify scheduled output and observed runs.

### DexTracker

Own the existing fxUSD routed ladder and venue inventory; retain ownership of this delivered ladder for this upgrade rather than commission a duplicate. The fleet spec generally assigns PegTracker ladder ownership: document this existing-producer exception/fallback explicitly and do not allow overlay precedence to erase valid evidence. PegTracker supplies primary-gate measurements; DexTracker references their clock rather than restating a stale independent verdict.

Reconcile every successful size before computing 50/200bp brackets; include the $100 baseline in the displayed set. Refine crossings to the fleet precision requirement (1% of bracket midpoint) when quotes support it, otherwise declare a measured failure/unstable interval with endpoint evidence. Revalidate endpoints, preserve nonmonotonic outcomes and no-route vs instrument failures. Publish all-in vs incremental conventions, USDC reference assumptions, swap gas vs full-path gas exclusions and quote clocks. Refresh venue balances/enumeration independently, excluding wrappers and fxSP locked holdings from executable depth. Correct stale refusal/whole-fxSAVE-exit text and old stress-size claims.

### RiskAnalyst and security_analyst

RiskAnalyst reconciles stale prose, current scores and rationale, dependencies and issuer facts against producer evidence; dates remain original until verified. No numerical score is demanded where the fleet leaves an axis unrated. Request a scoped security_analyst observation refresh for changed implementations, oracle wiring, roles, pending ownership and current authority reach; RiskAnalyst interprets observations and public audit coverage. Confirm which existing FXSave refresh evidence genuinely covers shared fxUSD contracts, avoiding duplicate walks. Do not edit the security repository from backing-monitor.

### tidresearch

The staging report source `src/content/reports/fxusd.md` exists, remains `production: false`, and has no `live_dashboard_url`. `src/lib/dashboards.ts` omits fxusd from `DASHBOARD_EMBED_SLUGS`; `dashboardUrlFor()` therefore returns undefined. This explains the absent link in the inspected source. The deployed staging report could not be verified through the web tool during planning.

Prepare a staging-only dashboard link/registry handoff. Confirm that the deployed staging `/dashboards/?asset=fxusd` serves the intended candidate before linking; a local preview is not a remotely available destination. Use relative `/dashboards/?asset=fxusd` or the repo's existing staging-aware convention. Verify sidebar/CTA and reports-index badge/filter resolve consistently. Preserve `production: false`, authored scores and verification dates. Do not use the link change as completion certification. If staging must wait for the completed dashboard, return a prepared patch and publish it with the candidate in the final staging delivery. Production promotion remains separate.

## Implementation sequence

1. Snapshot current source files and rendered evidence; freeze a checklist of required values/charts and provenance. Accept completed upstream files, not completion messages alone.
2. Resolve producer correctness gates: peg identity/time semantics; liquidity bracket inconsistency; current redemption state; stale source prose and topology evidence. Keep valid existing charts available during work.
3. Integrate feeds via current registered-source sync. No parallel primary backing collector in this repo. Add schema/scale/failure validation and independent attempt/observation clocks.
4. Build baseline-preserving custom panels and charts. Keep complete ladder visible by default; fold route JSON and exact clocks. Standard dependency tiles and standard chart controls, no bespoke visual vocabulary.
5. Assemble one review candidate with every required quantitative chart populated from real validated observations. If a required measurement remains unavailable, report the specific blocker; do not call the candidate complete because six headings exist.
6. Verify source → transported file → merged model → DOM/chart dataset. Complete staging link integration and report reconciliation together with the candidate. Present staging review; no production promotion implicit.

## Completion gates

- Peg chart actually draws market price and $1 with nonempty, identity-bound datasets; CR chart draws aggregate and both pools with correct units. Window labels, statistics and plotted points agree; gaps are not interpolated into evidence.
- Pool table and debt allocation agree with the source; supply–debt residual is retained, dated and classified without pretending the longstanding residual is solved.
- Liquidity chart and full sorted ladder render; baseline, outputs, both cost conventions, correct clearing/crossing endpoints and failed probes agree. The tested $5m counterexample has a regression check. No capacity is inferred from TVL or a proceeds maximum.
- Current redemption condition is sourced to a current read; historical probes cannot silently supply current state. EMA trigger is not represented as a holder price floor or discretionary admin switch.
- Shared dependency tiles render real edges, unresolved coverage and registered links. Authority and code-risk evidence remain distinct and dated. Source facts about fxSP/fxSAVE do not become an independent-risk claim.
- Computed bands, historical authored judgments, review status and unavailable scores are visibly distinguished. No single snapshot or indicative quote masquerades as a historical score. Resolve conflicting old spec statements against current shared implementation before acceptance.
- Browser QA at desktop/mobile in light/dark; actual canvas datasets and visibility checked, including screenshots. No page-wide overflow, raw timestamps in main ladder, silent JS failures or missing data due to overlay precedence. Expanded evidence remains usable.
- Negative fixtures: missing pool, changed pool discovery, stale/future price, failed/missing oracle, null/mixed scales, failed quote, old retained quote, nonmonotonic ladder, outdated venue enumeration and stale authority evidence. Failures remain failures, never zero or healthy.
- Appropriate tests and `check_feeds.py` pass; any pre-existing fleet warnings are listed separately. Repeated sync demonstrates current source consumption without updating original clocks after failure; inspect an actual scheduled run before claiming automatic freshness.
- Staging report sidebar/CTA/index link resolves to the correct deployed dashboard, with reciprocal report link and staging status preserved. Completion summary lists actual datasets, chart coverage, remaining limitations and deployment state.
