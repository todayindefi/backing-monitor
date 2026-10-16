# sfrxUSD presentation contract — proposed v1, 2026-10-16

Read with [the dashboard plan](sfrxusd-dashboard-plan.md). This is a proposal for
producer review; no sfrxUSD renderer or feed is installed yet. Existing shared
axis schemas remain authoritative. Return changes before integration where the
producer's established schema differs. backing-monitor owns presentation and
transport; measurements belong in the producer repositories.

## Identity, time and staging

- View/feed slug: `sfrxusd`. Ethereum token:
  `0xcf62F905562626CfcDD2261162a51fd02Fc9c5b6`, 18 decimals.
- Fraxtal token: `0xfc00000000000000000000000000000000000008`.
  Research mint/redeemer: `0xBFc4D34Db83553725eC6c768da71D2D9c1456B55`;
  recheck live identity and implementation before using it.
- Base file: `sfrxusd_backing.json`, with `asset_slug: "sfrxusd"`, shared
  `peg`/`backing` blocks and `asset_specific.sfrxusd` detail. A frxUSD feed alias
  would erase the savings strategy layer and is unsuitable.
- Every observation needs status, measurement time, source, scope and units;
  RPC observations also need chain and block. Keep API snapshot time, retrieval
  time, quote time, oracle round time and parameter `lastSync` distinct.
- Failed reads produce null plus a reason. An observed zero remains zero.
  Preserve last-good snapshots with their original measurement clocks and expose
  the latest attempt's failure. Cadence and maximum accepted input age must be
  declared by the producer. A saved research response is historical evidence.
- Keep new unapproved files outside automatic sync paths. Proposed staging:
  PegTracker `data/dashboard_pending/sfrxusd/`, DexTracker
  `data/liquidity_pending/`, RiskAnalyst `data/axes_pending/`, and a draft
  security topology outside eligible `topology/assets/`. Follow any stricter
  producer repository rule. Return staged-to-final path mappings. Do not activate
  publishing schedules or promote the dashboard through these requests.

## Axis 1 — reference and history

PegTracker publishes the existing `peg` schema and `sfrxusd_peg_history.json`.
Custom `pricing` detail under `asset_specific.sfrxusd` must expose:

| Field meaning | Units / requirement |
| --- | --- |
| Administered PPS | frxUSD per sfrxUSD share, with source method and block |
| frxUSD market mark | USD per frxUSD, with independent source time/status |
| USD share reference | PPS × frxUSD/USD mark; if a $1 convention is used, declare that convention explicitly |
| sfrxUSD market mark | USD per share, with price venue/aggregation scope and source time |
| Deviation | Percent versus the declared USD share reference, with comparable input times |
| Accrual parameter and implied APY | Original raw rate and decoded convention; configured accrual, not realized earnings |
| Pricing parameter update time | Actual last update/lastSync where established, separate from a computed oracle round timestamp |

Use the existing field names for shared `peg.nav`, `nav_basis`, `nav_source`,
`market_price`, `market_price_source`, `premium_discount_pct` and `history_ref`.
Each history point retains its contemporaneous reference; do not project today's
PPS backward. Export existing tracker observations where trustworthy, identify
mixed-unit legacy history and missing source clocks, and declare usable coverage.
When conversion inputs fail or are too old, withhold the comparison with a reason.

## Axis 2 — accounting and strategies

Use the shared backing schema for issuer-reported assets, liabilities, coverage
and surplus with explicit percent scale and basis. `asset_specific.sfrxusd`
contains versioned detail (`sfrxusd-detail/1` proposed) with these sections:

| Section | Required contents |
| --- | --- |
| `accounting` | Issuer assets USD; net circulating claims USD; surplus USD and bps of claims; coverage percent and `issuer_reported` basis; gross/circulating share quantities; protocol/bridge inventory offsets and liability row reconciliation; Ethereum and Fraxtal supplies with separate scope. An independently complete global coverage field remains null with its own status/basis until proved. |
| `strategies` | Row identity, protocol, chain, custody/receipt/pool addresses, position quantity and units, valuation method/mark, issuer value, observed/reconstructed value and difference, share of reported assets, ownership/status, and source clocks/blocks. Distinguish owned external LP legs from own-token liability offsets. Discovery is issuer-listed unless separately expanded. |
| `withdrawal_limits` | Per-position getter maxWithdraw or shared available cash, observation block, units, holder, method and constraints. Mark shared Aave hub cash as an inventory bound rather than an established per-position withdrawal allowance. |
| `pricing` | Axis 1 reference fields above, plus formula-derived totalAssets and actual token-contract frxUSD balance as separately named quantities. |

Report scrvUSD units before and after `convertToAssets`; keep issuer and
reconstructed LP values side by side while a difference is unresolved. Neither
approach silently replaces the issuer's denominator or creates a global
independent ratio. Separate direct cash, lending claims, LP external legs and
self-held shares. Reuse frxUSD's upstream feed by explicit source/clock or link;
do not merge its reserve assets into the sfrxUSD strategy total.

## Axis 3 — routes and venue inventory

PegTracker's proposed primary-exit assignment is **sfrxUSD specific**, pending
its explicit acceptance. Publish `primary_exit` detail under
`asset_specific.sfrxusd` and a compatible shared exit summary if supported:
Ethereum local call status/error; route contracts and payout; messaging and
destination dependencies; Fraxtal frxUSD inventory and bound in shares; fee and
scale; oracle/price configuration, round time and parameter age; eligibility;
simulation method/result/failure cause. Distinguish a view bound, local eth_call
simulation and completed cross-chain settlement. Settlement latency/recovery
remains untested unless separately evidenced. No approvals, transfers or trades.

The authoritative dollar exit ladder should target **USDC** using the existing
standalone `sfrxusd_exit_ladder.json` envelope consumed by `exitLadderOverlay`:
`asset_slug`, Ethereum token identity, `sell_into: "USDC"`, `measured_at`,
`quote_window`, `cost_conventions`, `reference_rung_usd`, `headline`, `rungs` and
failure evidence. Per rung, `input_amount` is sfrxUSD shares, `size_usd` is the
declared notional, and `output_usdc` is USDC units. Keep raw integers, price
marks, route legs, gas treatment, actual quote clocks/blocks and expiry basis.

Use the producer's crossing method; distinguish all-in discount from additional
size impact. A maximum successful rung is a floor, not an exact capacity. A
nonmonotonic curve needs an explicit warning. Reject stale or failed quotes as
headline inputs. Retain failures instead of emitting zero output or liquidity.

Measure the research sfrxUSD→frxUSD→USDT route as a separate diagnostic if
available, valuing USDT using a timestamped mark. An optional frxUSD-only profile
must identify its payout/units and never supply the dollar-depth headline.
**Do not put USDT or frxUSD units in `output_usdc`.** If USDC routing cannot be
measured, return an explicit unavailable headline and propose a general output
schema; backing-monitor must adapt it before accepting another settlement token.

Suggested NAV-sized rungs: $1K, $10K, $100K, $500K, $1M, $3M, $5M, $7M and $10M,
with existing crossing refinement and resource limits. Initial proposed cadence:
hourly base/reference/primary probe and three-hourly quotes; producer confirms
the supported cadence and freshness budget before activation.

DexTracker publishes `sfrxusd_liquidity.json` (`liquidity/1`) for Ethereum venue
inventory, roles, chain-specific enumeration time/completeness and exclusions.
Publish pool ownership evidence separately from TVL: LP/Convex position, holder,
total LP supply, ownership percentage and block. Both treasury-owned depth and
its withdrawal risk must remain visible. Do not add strategy withdrawal limits,
redemption inventory and secondary pool balances into a total exit capacity.

## Editorial overlays and authority

RiskAnalyst owns `dependencies/1`, `issuer/1`, `contract-overlay/1`, optional
`backing-overlay/1`, and `axis-basis/1` for this view. Confirm the report-to-feed
mapping and authored/computed eligibility. The Dependencies section of the live
six-axis spec supersedes its older unscored rule: emit the normal fleet
`underlying_score` with its basis. A report score alone does not authorize an
override of a measured band. Keep the separate report redemption score within
Liquidity & Exit; overall is an authored judgment, never a computed mean.

security_analyst owns observed authority paths in the established topology YAML
schema. RiskAnalyst owns code/audit interpretation and combined scoring.
backing-monitor generates Axis 5 JSON from an eligible committed walk and then
merges the editorial overlay. Missing walks remain explicitly unassessed; report
tables do not substitute for a commissioned walk.
