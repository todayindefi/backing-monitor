---
title: sfrxUSD dashboard — six-axis build plan
repo: backing-monitor
date: 2026-10-16
status: Production approved 2026-10-16; release and live verification in progress
---

# Scope and source

The owner explicitly approved production publication on October 16, superseding
the earlier public-staging request. TIDResearch's report source now shows the
aligned Dependencies 4.0. See [the production release](sfrxusd-production-release-2026-10-16.md)
for source transport, scheduled refresh and deployment results.

Producer requests were delivered manually by the user; no automated dispatch
was performed by backing-monitor:
[PegTracker](handoffs/SFRXUSD-pegtracker-2026-10-16.md),
[DexTracker](handoffs/SFRXUSD-dextracker-2026-10-16.md),
[security_analyst](handoffs/SFRXUSD-security-analyst-2026-10-16.md), and
[RiskAnalyst](handoffs/SFRXUSD-riskanalyst-2026-10-16.md).
Each references this plan and the proposed
[presentation contract](sfrxusd-feed-contract.md). PegTracker is requested to
accept sfrxUSD-specific primary-route measurement ownership; its return now
confirms acceptance. Producer return and contract reconciliation precede page
integration.

Latest return inspection on 2026-10-16: PegTracker's four candidate feeds and
DexTracker's venue/ownership candidate are now present in the requested staging
paths, with return notes. PegTracker accepts primary-route measurement ownership.
security_analyst finalized eligible topology in `6ec34a4` and retained reproducible
evidence and conservative source clocks in `0f68686`. RiskAnalyst finalized
Dependencies 4.0 and corrected LP custody in `c62a967`; internal report/index and
pending overlays agree. The external TIDResearch report source still says 4.5
and requires its owner's alignment. These findings supersede earlier
missing-return inspections. The concrete preview and validation are documented
in [the preview review](sfrxusd-preview-review-2026-10-16.md).
See [the producer review](sfrxusd-producer-review-2026-10-16.md).

Build a distinct `sfrxusd` dashboard for the Ethereum token
`0xcf62F905562626CfcDD2261162a51fd02Fc9c5b6`, with the Fraxtal
mint/redeemer and global strategy balance sheet shown at their actual scope.
Cross-link the live `frxusd` dashboard. Do not reuse frxUSD's backing ratio,
score, exit capacity or contract assessment as if the wrapper inherited them.
Follow [the six-axis spec](six-axis-dashboard-spec.md) and
[renderer rules](renderer-design-rules.md).

Research baseline: `/home/danger/riskAnalyst/assets/sfrxusd.md`, revised
2026-10-15, with reproducible observations in
`/home/danger/riskAnalyst/data/reviews/sfrxusd-2026-10-15/`.
`/home/danger/tidresearch/src/content/reports/sfrxusd.md` is already
`production: true`. These are dated evidence and editorial judgments, not
scheduled measurements. The report's overall **4.5/10** is an authored verdict,
not an average of the dashboard axes.

# Findings that determine the page

1. One sfrxUSD share had an administered PPS of **1.2155106428 frxUSD** at the
   review block. The displayed `totalAssets()` is supply times a PPS formula;
   the Ethereum token contract held **zero frxUSD**. The configured roughly
   **5.10% APY** is an accrual setting, not verified strategy profit or an
   immutable rate cap. Axis 1 must compare market price with a named share
   reference, not $1 par, and distinguish the frxUSD-denominated PPS from a
   USD market price. A market-vs-PPS USD comparison must include a dated frxUSD
   USD mark or explicitly say it uses $1 frxUSD face value.
2. The issuer reported **$38.025657M** assets against **$37.968538M** net
   circulating NAV claims: **100.15044%** coverage and **$57,119 / 15.04bp**
   surplus on 2026-10-15. The denominator nets protocol-held and bridge
   inventory. Gross global supply times PPS is not that liability measure.
   The issuer-listed strategy rows were substantially re-read onchain, but a
   complete independent global asset and liability census was not established.
   Keep the coverage labeled *issuer reported*.
3. About **42.80%** of reported assets was in Aave V4, **60.17%** in lending
   claims across Aave/Fraxlend/Gearbox, and **19.88%** in external LP legs.
   About **19.21%** was frxUSD in the Fraxtal mint/redeemer. Strategy claims,
   withdrawable cash and redeemable inventory are different quantities.
   The scrvUSD LP row has an unresolved roughly **$13,539** valuation difference.
4. Ethereum `deposit/mint/withdraw/redeem` revert with
   `MintRedeemsDisabled()`. The documented primary route goes through Hop and
   Fraxtal to receive **frxUSD**, subject to messaging, pricing and destination
   cash. Fraxtal's **7.306M frxUSD** inventory exposed about **6.011M shares**
   of read-only redeemable capacity at the review, before fee/rounding; this
   is not reserved capacity for an Ethereum holder or a tested round trip.
5. A read-only Ethereum sfrxUSD→frxUSD pool quote was cheap through **$5M**
   NAV-sized input, then hit an inventory wall. The tested second hop to USDT
   cost **6.90bp at $100K** and about **10.69% at $1M**. The controller owned
   virtually all LP supply in both tested pools, so their depth is operator
   controlled. A frxUSD output is not a dollar cash exit. Quotes exclude gas
   and do not establish executable fills or optimal routing.
6. Overlapping undelayed **3-of-6 and 3-of-5 Safes** control pricing, minting,
   upgrades and redemption assets. A Chainlink-shaped `latestRoundData()` has a
   current timestamp while extrapolating stored PPS parameters; its `lastSync`
   was 2026-09-24. A fresh round timestamp is not a fresh independent NAV.

# Producer work and ownership

Output paths in this table are intended final serving paths. Candidate files
remain in the nonpublishing locations specified in the handoffs and contract.

| Part | Owner | Required output |
| --- | --- | --- |
| Axis 1 market and reference | PegTracker | `sfrxusd_backing.json` `peg` block and `sfrxusd_peg_history.json`: USD market mark, frxUSD PPS, frxUSD/USD conversion or explicit face-value convention, source clocks and comparison basis. The existing `asset_config_usd.json` entry is configuration, not a dashboard feed; revisit its old claim that `convertToAssets` is a redeemable local rate. |
| Axis 2 strategy backing | PegTracker | Base `backing` block and history from Frax's sfrxUSD balance sheet plus same-block reads: external owned assets, net circulating NAV claims, excluded internal/bridge claims, surplus, allocation, valuation method, reconciliation status and source clocks. Expose issuer coverage; withhold an independent global ratio until the denominator and ownership are complete. The upstream frxUSD reserve layer links to its own dashboard. |
| Axis 3 executable ladder | PegTracker | `sfrxusd_exit_ladder.json`, measured from sfrxUSD to **USDC/USDT dollars** with frxUSD intermediate legs kept visible; successful and failed rungs, all-in cost, threshold crossing/bracket, route/chain, quote block, token marks and gas convention. Preserve a separate sfrxUSD→frxUSD ladder if useful, but never headline that as dollar depth. |
| Axis 3 venues | DexTracker | `data/liquidity/sfrxusd_liquidity.json` (`liquidity/1`): Ethereum inventory, verified pool roles, treasury LP ownership, exclusions, enumeration clock and remote-chain coverage states. TVL is not exit depth. |
| Axis 3 primary redemption | PegTracker — sfrxUSD-specific assignment accepted | Structured route probe in `asset_specific.sfrxusd.primary_exit`: disabled Ethereum calls, Hop/Fraxtal route, destination inventory/share bound, fee, oracle parameter age and read-only simulations. Cross-chain settlement is untested; the shared fleet-wide primary schema remains open. |
| Axis 4 dependencies | riskAnalyst | `data/axes/sfrxusd_dependencies.json` (`dependencies/1`): measured Aave/Fraxlend/Gearbox and external LP exposures, frxUSD reserve dependence, correlated Frax collateral and Fraxtal/Hop/oracle paths. Distinguish backing holdings from market-only venues. |
| Axis 5 authority and code | security_analyst + riskAnalyst | Committed `topology/assets/sfrxusd.yaml` for checked authority paths, then generated `sfrxusd_contract.json`; `data/axes/sfrxusd_contract_overlay.json` for deployed-code/audit interpretation and authored structural score. Include Ethereum, Fraxtal and relevant adapter roots, signer overlap, no observed delay, mutable PPS/minter powers and underlying recovery. |
| Axis 6 issuer and cross-axis basis | riskAnalyst | `sfrxusd_issuer.json` plus `sfrxusd_axis_basis.json`: shared Frax issuer context, authored score/basis and report URL; no independent issuer uplift for the wrapper. Confirm how the report's 2026-10-15 scores map to dashboard chips without treating its separate redemption score as a seventh axis. |
| Consumer | backing-monitor | Sync and validate approved producer blocks; register an unpublished `sfrxusd` view, wire an asset renderer and script, then review and promote. `sync_and_push.sh` already searches the three producer roots and knows the normal suffixes, but `sfrxusd` is absent from `data/assets.json`, so nothing asset-specific syncs yet. |

The 2026-10-15 risk report supplies the initial editorial values: stability
6.5, backing 5.0, liquidity 5.0, dependencies 4.5, contract/admin 3.5,
issuer 5.0, overall 4.5. The dashboard must apply the six-axis scoring
contract: measured bands are not silently overwritten by these report scores;
an authored fallback needs the producer's explicit eligibility and basis.
Redemption 5.0 belongs inside Liquidity & Exit and must not appear as a seventh
chip or conceal the weaker dollar-exit leg.

# Page layout and data semantics

- **Top:** name, Ethereum token identity, dated overall verdict if transported
  with provenance, and a short decision-changing statement: administered
  strategy claim payable in frxUSD through Fraxtal. Link report and frxUSD.
- **Stability:** chart market value against a correctly converted share
  reference, with both mark clocks and history coverage. Show accrual setting
  separately from realized strategy earnings. Missing history is unmeasured,
  not a flat zero-deviation chart.
- **Backing:** issuer coverage and 15bp surplus with denominator definition;
  strategy allocation and verification status; separate frxUSD reserve layer.
  Highlight the valuation discrepancy. Do not add a self-held sfrxUSD asset or
  LP's own sfrxUSD leg as external backing.
- **Liquidity & Exit:** side-by-side *Ethereum market exit to dollars* and
  *primary Fraxtal redemption to frxUSD*. Show the frxUSD intermediate pool
  route without calling it dollar depth. Display size profile and treasury LP
  ownership by default; keep method and failed quotes in a disclosure. Do not
  add Fraxlend/Aave maxWithdraw, Fraxtal cash and DEX depth as independent
  capacity.
- **Dependencies:** strategy venue concentration and correlated collateral;
  inherited frxUSD reserve risk links to its page. Wrapper controls belong in
  Contract & Admin, not a duplicate dependency row.
- **Contract & Admin:** direct authority paths, common signer population,
  parameter age versus feed timestamp, code/audit scope and remote coverage
  limits. Do not call a Safe returned by `timelockAddress()` a timelock.
- **Issuer:** one Frax issuer judgment, with no suggestion that the wrapper and
  frxUSD provide issuer diversification.

Remote supply and control checks from the report may appear as dated coverage
detail. The first liquidity headline is Ethereum only. Do not extend its
measured route to Fraxtal or other chains; unqueried chains remain labeled
unqueried. Every material number carries its producer, unit, scope and
measurement time (and block for RPC observations); sync time never refreshes
the observation.

# Build sequence and acceptance

1. Agree the feed fields and denominator with PegTracker, and the primary-exit
   owner with the Axis 3 producers. Build and review the live base/history,
   ladder, venue, dependency, contract and issuer inputs in their owning repos.
   Archived RiskAnalyst RPC records are fixtures and comparison evidence, not
   feeds to copy into the hourly sync.
2. Register `sfrxusd` in `data/assets.json` as `published: false` after the
   producer files are ready. Registration wires normal suffix sync and creates
   a directly reachable page; unlisted is **not private**. Add the ladder ref,
   report link, Ethereum token and explicit global/Fraxtal scope metadata.
3. Add `js/renderers/sfrxusd.js` and index script wiring. Slot custom panels
   under their six axes, adapt the ladder only after confirming the actual
   quote schema, and keep missing/stale states explicit.
4. Run `check_feeds.py`, schema/identity/denominator checks, same-block metric
   reconciliation, and browser review with cache bust in light and dark mode.
   Confirm displayed text and tooltip visibility, each source clock, all
   adverse findings, and that every published field is either rendered or
   deliberately excluded. Compare the same-block live producer outputs with
   the saved October 15 derivation and explain material changes.
5. Promote only after the page and report links are reviewed together and the
   user's existing explicit-publication rule is satisfied. Set `published:
   true`, verify the deployed URL and index card, and confirm the scheduled sync
   refreshes without upgrading old evidence timestamps.
