# scrvUSD dashboard scope — 2026-10-17

Status: implemented and release-validated. scrvUSD is registered for production;
publication uses the reviewed producer adapter below. The public report remains
unpublished and the authority inventory remains explicitly partial.

## Decision

Build a compact Ethereum wrapper dashboard at `?asset=scrvusd`, linked both ways
with `?asset=crvusd`. Keep crvUSD as the canonical collateral and underlying peg
analysis. scrvUSD is an ERC-4626 NAV-accruing share, not a second dollar stablecoin.
Its separate monitoring covers share accounting, custody, rewards, redemption
and administrative state. No second parent collateral model is needed.

## Evidence reviewed

- Committed internal assessment: riskAnalyst `8ee3dc4`, `assets/scrvusd.md`.
- Pinned evidence: `riskAnalyst/data/reviews/scrvusd-2026-10-17/`, Ethereum block
  26,211,046. Vault `0x0655977FEb2f289A4aB78af67BAB0d17aAb84367`;
  underlying crvUSD `0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E`.
- Current tidresearch draft: `src/content/reports/scrvusd.md`, refreshed today
  but still `production: false`. This is not yet a public report-link target.
- Existing parent producer: `PegTracker/crvusd_backing_analyzer.py`. It reads
  crvUSD held at scrvUSD and separately tracks HybridVault required allocation.
  These are supply destinations/demand observations, not new crvUSD issuance or
  an independent savings-vault health feed.
- Existing dependency overlay: `riskAnalyst/data/axes/scrvusd_dependencies.json`.
  No dedicated scrvUSD backing/history/liquidity feed or dashboard registration
  was found in the inspected producer registries and serving files.
- Existing authority YAML is August 22 generator-v1.7 output, with only an upgrade
  layer. `tools/emit_axis5.py` deliberately refuses generated authority files.
  It cannot establish the active Yearn role system or a universal DAO delay.
- Official implementation: https://github.com/curvefi/scrvusd
- Official yield statistics: https://prices.curve.finance/v1/crvusd/savings/statistics
  Rechecked October 17: approximately 2.591% projected APY, with its own API clock.

Snapshot: totalAssets, totalIdle and actual vault custody each 14,823,681.79
crvUSD; totalDebt zero; effective supply 13,355,395.75 scrvUSD; one-share NAV
1.109939538 crvUSD. Current shutdown false, default queue empty, accountant and
withdrawal/deposit-limit modules zero. These are dated observations.

## Reader-facing page

Keep the six-axis spine, with short results and expandable evidence. A compact
headline shows crvUSD/share, USD NAV/share, projected APY, actual custody and exit
status. Place yield next to the NAV panel so it does not become a seventh risk axis.

| Axis | Wrapper-specific content | Parent relationship / guardrail |
|---|---|---|
| 1: NAV / price | `convertToAssets(one share)`, `previewRedeem(one share)`, underlying USD mark and clocks; NAV/share history; projected vs realized return | USD NAV = crvUSD/share × crvUSD USD price. Parent price is not a scrvUSD market quote. Independent wrapper premium/discount stays unmeasured until a genuine wrapper quote exists. Never compare scrvUSD to $1. |
| 2: Backing | Actual underlying balance, totalIdle, totalDebt, totalAssets, share supply and reconciliation | Say “custody reconciles in crvUSD units.” This is not dollar solvency or a standalone 100% CR rating. Link parent collateral analysis with its own scope/date; no duplicated parent collateral table or fake independent reserve. |
| 3: Exit | Primary redemption availability and owner-scoped limits; dated simulations; second-leg crvUSD→USDC routes | Separate the two legs. No fictitious scrvUSD DEX depth; no claim of an executable whole-vault exit. |
| 4: Dependencies | Direct crvUSD edge; Yearn code and rewards pipeline; upstream/downstream coverage status | Link to parent risk graph instead of cloning it. No dependency pie. Use riskAnalyst’s authored dependency score under the later Axis 4 spec amendment. |
| 5: Contract & admin | Fixed clone target; live shutdown, modules, managers, queue, accountant and detected changes; audit evidence limits | Immutability does not remove role authority. Seven days is profit unlocking, not admin execution delay. Existing generated YAML is inadmissible as a verified walk. |
| 6: Issuer | Curve DAO, linked to the parent; wrapper-specific evidence limits and report availability | Yearn supplies implementation code, not a second issuer guarantee. Do not link an unpublished report. |

Report scores are editorial: overall 5.0, backing 5.0, liquidity 8.0,
dependencies 4.5, structural 5.5, issuer 6.0. Do not infer a dashboard peg score
from `volatility_score`, or turn custody reconciliation into a computed healthy
backing band. Any authored backing/exit fallback must have the explicit
non-derivable basis required by dashboard §6.3. Parent deterioration prompts a
child assessment review; a wrapper score never improves because underlying
borrower collateral is duplicated into a second denominator.

## Producer and file boundary

| Owner | Deliverable |
|---|---|
| PegTracker | New `scrvusd_backing_analyzer.py`; canonical `scrvusd_backing.json` and `scrvusd_backing_history.json`; NAV, vault state, redemption observations, source health and last-good handling. Reuse existing Ethereum provider and risk-feed plumbing. |
| PegTracker / existing crvUSD feeds | Parent underlying USD mark and collateral reference, retaining the parent observation clock. Select an Ethereum-appropriate mark; reject stale/unknown pricing rather than assuming $1. |
| DexTracker | Reuse current Ethereum crvUSD exit evidence where denomination, size and freshness match. Add a dedicated child liquidity overlay only if ownership/transport requires it; no duplicate venue inventory job just for this wrapper. |
| riskAnalyst | Complete child axis-basis, issuer and contract/code overlays; keep direct dependency edge; supply inherited-score rationale and limits. |
| security_analyst | Manual authority walk of vault roles, delegated holders, modules/strategies, DAO paths and handler rate managers; dates and unmeasured areas explicit. |
| backing-monitor | Registry, `scrvusd.js` renderer, report/parent links, use of existing source sync, baseline-manifest and mobile verification. No new primary backing producer here. |
| tidresearch | Review/publish the report and reciprocal dashboard link through its existing release process. Current `production: false` must be handled deliberately. |

Use one snapshot family initially rather than a bespoke proliferation of
unconsumed files. Put wrapper-specific evidence under `asset_specific.scrvusd`,
with field/block clocks. The existing suffix transport already carries backing,
backing history, liquidity, dependencies, issuer, contract overlays and axis basis
once a slug is registered. Registration makes source files publishable by the
hourly sync: keep candidates outside serving/source roots until release.

## Measurement details

- Pin each chain snapshot to one block and record block/time. Use contract share
  conversion methods, not naive `totalAssets / totalSupply`: Yearn profit locking,
  effective supply and rounding need the contract's own treatment.
- Reconcile actual crvUSD custody against totalIdle, and totalAssets against
  totalIdle + totalDebt. If strategies are deployed, custody need not equal
  totalAssets; debt is an accounting claim, not independently verified recovery.
  Any nonzero debt opens a strategy inventory and valuation requirement.
- Rewards: APY from Curve statistics with the API's own clock; handler crvUSD
  balance, FeeSplitter receiver/cap, requested weight, minimum, scaling factor,
  TWA window, supply-lens identity, profit unlock duration and last profit update.
  Handler funds are outside vault principal until transferred/reported.
- Requested weight is not actual received allocation. Preserve the distinction
  between weight, cap and realized fees. Do not reconstruct current weight from
  today's vault AUM divided by an unrelated system-supply denominator.
- A proven distribution timestamp/amount requires attribution to a handler
  reward-processing transaction plus vault report/transfer evidence. The saved
  report snapshot is not an ongoing distribution indexer, and `lastProfitUpdate`
  alone must not be relabelled “last distribution.” Declare unknown when event
  attribution cannot be established; use a bounded initial scan and durable
  event cursor thereafter, with reorg handling.
- Successful October 17 redemption simulations cover 1K/10K/50K/100K
  crvUSD-equivalent. The 1M quote covers only the later underlying cash-out leg;
  it is not proof of a combined 1M wrapper exit. Simulate the primary leg at any
  new displayed size before claiming that size was tested end to end.
- Select a real share-owning address for read-only redemption checks. A wallet
  owning only LP tokens can legitimately return zero maxRedeem. Never display
  that as a global withdrawal gate. Record simulated sender, owner and receiver.
- At equal sizes, retain nominal underlying units and share inputs. Keep deviation
  from nominal par distinct from fees, market discount and marginal size impact.
  Parent depth cannot be copied as a child depth scalar without conversion and
  a successful primary leg at that size.

## Cadence, changes and histories

Start with an hourly pinned vault/reward snapshot, matching dashboard transport.
Refresh route/simulation evidence every three hours at the existing ladder
cadence; each leg carries its own time. Polling current role getters detects
configuration changes, but does not enumerate all role holders: index the
appropriate grants/revocations or publish a bounded manual inventory separately.
Do not claim complete role-change coverage from manager getters alone.

Record NAV/share, underlying USD mark, USD NAV, share supply, idle/debt/custody,
APY, handler funds, unlock state and exit outcomes forward-only. A 7d NAV plot
must use historical paired marks, not today's parent price for all past samples.
Insufficient observations get a visible absence state. Realized NAV return is
crvUSD-denominated; USD total return adds the parent's price change. Projected
APY is separately labelled and never drawn as realized yield.

Prominent changes: new strategy debt/queue entry; withdrawal module/manager or
pending manager change; shutdown; custody/accounting discrepancy beyond measured
rounding; redemption failure; altered reward cap/weight parameters; lower share
conversion; stale/missing required reads. A yield decline alone is not a backing
loss. Last-good preservation must keep its original observation time and show
failed-refresh state; never overwrite a failed read with zero.

## Build order and acceptance

1. Build/test PegTracker snapshot and forward history; retain unpublished candidate
   outputs. Validate NAV and accounting against the saved October 17 fixture plus
   fresh pinned reads. Test strategy debt, modules, shutdown and partial failures.
2. Implement compact renderer and parent references; no publication in this scope.
   Test absent wrapper market price, asynchronous parent clocks, missing history,
   two-leg limits and report-unpublished state. Verify desktop/mobile visibly.
3. Complete authored overlays and a manual authority inventory. If the authority
   walk is not ready, a clearly partial/unrated authority section is possible;
   it must not render the old generator file as a fresh complete assessment.
4. Coordinate release of the report and dashboard, register the asset, wire the
   scheduled producer and verify a scheduled refresh plus actual serving output.
   Report publication is independently required for a public report link, not
   for displaying an honest unavailable-report state.

First release excludes personalized Stake DAO/Curve LP unwinding, L2 deployments,
independent collateral reconstruction, full scrvUSD DEX venue enumeration, and
historical backfill represented as observed data. LP exposure in the internal
report remains separate from this asset-level public dashboard.

This is moderate integration work: one producer, forward histories, a small
renderer and overlays. The substantial remaining work is reliable two-leg exit
refreshing, distribution attribution and authority coverage, rather than HTML.


## Implementation and release verification

- Producer: `PegTracker/scrvusd_backing_analyzer.py`, commits `0d173fb` and
  `4fc477c`; `tests/test_scrvusd_backing.py` has 16 passing tests. The existing
  hourly `run_backing_analyzers.sh` invokes this immediately after crvUSD.
- Snapshot family remains in `PegTracker/data/dashboard_pending/scrvusd`;
  `tools/sync_scrvusd_feeds.py` transports only this asset. Editorial overlays
  are pinned to RiskAnalyst commit
  `8b3d9da7221d0f190feda4f78b4c2c6975c7b9d7`, derived from report `8ee3dc4`.
  The publisher has four passing tests for its approval/identity/atomicity guards.
- No old generator authority file is published. The live getter observations,
  bounded recent events and unresolved authority paths are displayed together.
  The October 17 authored structural score is explicitly retained as an authored,
  partial-evidence assessment, not re-walked or recomputed from clone immutability.
- Last attributed reward distribution: Ethereum transaction
  `0x11ea5ab11321681c1f0d1793684bdd223c8140abaa79cfbbe16864295a0bbf30`,
  block 26,174,479, October 12 06:05:11 UTC, 4,937.891856 crvUSD.
  A handler-to-vault transfer and vault self-report share the same successful
  receipt. Archive lookups use the canonical provider; recent logs use PublicNode.
- Successful live primary simulations reach 100K crvUSD-equivalent. The
  observed pool owner lacks enough shares for the 1M rung; its separate 1M
  underlying quote is labelled underlying-only. Quotes exclude gas and submitted
  transaction execution. Neither the user's LP unwind nor a depth crossing is claimed.
- Forward NAV and custody histories contain real observations only, retain parent
  mark clocks, and share a 7-day display horizon. Accrued conversion return is
  withheld until at least one day of forward history exists.
- Consumer invariants and existing USDM/sfrxUSD/DOLA/USDat checks pass. Chromium
  desktop and 390px mobile show six axes, axis-contained panels, working charts,
  reciprocal parent links and no page overflow or script errors.
- The source repository's full pre-commit suite reports five unrelated existing
  collateral-basis/SUSDS/Ethena failures (2,208 passing at the run); the scrvUSD
  producer tests pass. Source commits deliberately bypass that unrelated red hook.
- The initial scope text above records the intended design. Its candidate-only
  steps are now completed; the dashboard release proceeds under the user's
  instruction to implement the six-axis scope. tidresearch report publication is
  separately unchanged; the page declares it unpublished and withholds its link.
