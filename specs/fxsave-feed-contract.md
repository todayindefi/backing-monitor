# FXSave feed contract — 2026-10-21

Status: proposed producer contract; consumer preview implemented. No live registration.
Canonical identity: Ethereum 0x7743e50F534a7f9F1791DdE7dCD89F7783Eefc39.
Source: /home/danger/riskAnalyst/assets/fxsave.md, revised October 21.

## Ownership and delivery

PegTracker: recurring fxsave_backing.json, fxsave_backing_history.json and
fxsave_backing_last_attempt.json. DexTracker: fxsave_liquidity.json, direct swap
ladder and fxUSD market-leg ladder. RiskAnalyst: axis_basis, backing_overlay,
dependencies, contract_overlay and issuer. tidresearch: report alignment.
All candidate files stay outside serving roots, preferably each producer's
 data/dashboard_pending/fxsave/ directory. Return paths, commit, test commands,
refresh command and scheduling proposal. Existing authored overlays are inputs,
not permission to invent absent scores. Consumer integration follows delivery.

## Base document

Follow the existing scrvusd_backing.json common envelope: asset_slug fxsave,
asset, chain, timestamp, summary, peg, backing, liquidity, asset_specific.
summary.collateral_ratio, summary.total_backing, backing.collateral_ratio and
backing.total_backing must be null. backing.collateral_ratio_basis explains
that fxSAVE has no independent dollar collateral ratio. Do not substitute the
fxUSD system ratio. No collateral pie for a vault claim.
peg is NAV mode, with separately timestamped market_price and dollar nav;
withhold premium/discount if either mark is missing, stale or mismatched.
Never compare the accruing share price to $1. No fabricated historical series.

asset_specific.fxsave uses schema_version fxsave-detail/1:
- as_of: actual observation UTC; block: pinned Ethereum block.
- identity: address above, underlying fxSP address, custody vault and gauge.
- nav_usd, total_supply_shares, total_assets_fxsp, fxsp_per_share: numeric or null.
- redemption: queued and instant objects, each with fxusd_per_share and
  usdc_per_share. queue_seconds, instant_fee_pct, evidence, as_of and block.
  preview is not a completed redemption. Encode unavailable legs as null,
  never zero. Decode 18-decimal fxUSD and 6-decimal USDC independently.
- concentration: morpho_shares, morpho_pct, review_trigger_pct (30), as_of, block.
- accounting: status, custody_fxsp, accounting_difference_fxsp; report whether
  gauge claims reconcile with totalAssets using raw integer precision.
- exits: fxusd_route with as_of, crossing_50bps_usd [lower, upper],
  crossing_200bps_usd [lower, upper], observed_peak_usdc; direct_fxsave_status.
  Every route carries its own time, status, input units and venue scope.
- assessment: status, overall_score, score_as_of. Review status is independent
  of measurement freshness. No numerical dependency score without an author.
- source: source path or evidence pointer; snapshot_kind: report_snapshot or live.

## Exit semantics

For each identical input share size compare direct fxSAVE-to-USDC with redeemed
fxUSD-to-USDC PLUS the direct USDC redemption leg. An instant path includes its
fee exactly once; a queued path states its delay. Compare all-in costs with
same-block NAV and timestamped fxUSD/USDC marks; state gas inclusion. Do not
combine unrelated simulation clocks into a claim of atomic execution. Failure,
owner limits, liquidity crossings, inventory and observed proceeds peaks are
separate facts. TVL is never executable depth. The fxUSD route peak is never a
ceiling for the complete two-token claim. Keep fxUSD primary-redemption state
separate from fxSP redemption; its $0.998 EMA gate is not a holder price floor.

## Integration acceptance

Reject incorrect identity, non-finite numbers, missing units or either payout
leg. Show missing/stale inputs explicitly and retain last-good values with their
original clocks after failure. Reconcile the basket against nav and fee settings;
verify the two-output September regression and caller negative control. Render
no live depth from dated report values. Scores remain authored and under review
until RiskAnalyst returns an updated axis mapping. Never average the axes or show
redemption 7.0 as a separate six-axis headline.


## Consumer remediation — October 22

The review consumer now imports committed hand-walked authority observations via
`tools/emit_axis5.py`, plus separately clocked venue inventory. The source walk's
observation date remains unchanged. `fxsave_contract.json` is a generated preview
artifact, not an authored copy. Preview regeneration runs from the existing
hourly sync without registering FXSave or adding pending roots to public transport.

Accounting observations may legitimately carry `status: mismatch`. The consumer
checks that raw custody minus raw assets agrees with the reported raw difference
and status; it retains consistent adverse readings rather than rejecting them.
A mismatch is an accounting observation, not a conclusion about realized loss.

Depth means additional cost relative to the same route's smallest tested rung.
Standing cost and all-in cost remain separate. If the smallest probe failed,
there is no substitute baseline and the size-impact profile is unavailable.
Historical retained quotes never become current proceeds or a replacement baseline.
See `fxsave-dashboard-remediation-2026-10-22.md` for acceptance evidence.

## Indicative market integration — October 23 (Taiwan)

The preview accepts `peg.status: indicative_market_quote` only with an eligible
`indicative_usd_quote` sell observation and successful USD reference. Quote,
provider, NAV and oracle-read clocks must be no older than four hours and within
120 seconds; future clocks beyond five minutes fail. Chainlink `updatedAt` is
validated separately against the producer-verified 82,800-second heartbeat, not
replaced by the read clock. USD conversion must reconcile. Failed/missing/stale
observations remain unavailable even if retained values exist. Quote size,
original oracle clocks/age, cached route blocks and excluded gas are visible.
This is a size-specific indicative comparison, not a fresh numerical axis score
or a continuous market history series.

DexTracker v2 costs convert USDC proceeds with the supplied USD reference, with
both basket legs added once before conversion. The consumer verifies producer
cost arithmetic and retains mark, route-clock and swap-only gas evidence. A
missing/failed v2 USD reference rejects snapshot assembly rather than silently
assuming par. Original v1 fixtures retain their explicitly stated par basis.

Validation: seven transport tests, renderer positive/negative policy cases, and
four desktop/mobile light/dark browser combinations plus intercepted valid and
failed market-observation cases. The existing hourly sync hook was exercised via
`prepare_fxsave_preview.py --from-sync`; automatic cron completion was not
independently observed. No serving registration, score change or publication.

## Native price chart integration October 26

The isolated preview now consumes PegTracker's pending native USD history adapter
alongside the existing pinned-block backing history. Canonical Ethereum identity,
USD/share units, original block/timestamp and NAV equality are validated before
assembly. A new nonnull standard market field fails closed pending policy review;
the delivered adapter currently publishes null market marks deliberately.

Axis 1 follows section 4.1: tiles first, then a strict trailing-seven-day price
chart; a neutral 3px dashed historical NAV reference overlays a thin 1.4px
coloured series explicitly labeled 100-share indicative exit value, gas excluded.
That second series comes only from same-size retained quotes that pass the
original observation's clock/reference/eligibility policy. Validation uses the
historical observation clock, never today's age as a reason to erase history.
Missing, mismatched and changed-size observations remain gaps; gaps above two
hours break lines. No unrestricted market series is invented from NAV or routed
exit quotes. The chart caption distinguishes both sources and actual coverage;
seven-day indicative deviation extrema are calculated from the same plotted
pairs. Standard market price and current premium remain unavailable when the
current producer withholds them. Chart y-axis is USD/share, x-axis is time;
hover gives original series observation UTC and price.

Inspected delivery: 117 native NAV points, October21 09:52 UTC through October26
02:10 UTC; 83 eligible historical 100-share quotes from October22 through
October26 01:47 UTC. The latest sampled direct ladder has a 3222-second mismatch
against NAV, so it is not promoted to the current market mark. Data counts remain
source-derived. Native exports are candidate-only; serving publication is not
implied. Existing hourly preview sync includes the native adapter on each run.

Verification: eight transport tests; renderer identity/units/historical policy,
strict cutoff and no-market-synthesis tests; actual Chart.js datasets and
reference weights inspected in desktop1280/mobile390 and light/dark browser
checks, including source failures. Desktop chart screenshot visually inspected.

## Standard presentation and rung correction October 26

Ordinary price/backing/concentration metrics use the fleet summary-card,
card-label and card-value classes. Dependency cards retain shared dep-grid /
dep-card styling. Asset-specific two-token payout and same-share exit comparisons
remain useful additions; they do not justify a new style for ordinary metrics.

RiskAnalyst liquidity-ladder-spec section7 governs publication: fixed decade grid
starting USD1000, at most10 published rungs per ladder, threshold termination,
refinement/diagnostic probes separate. The old FXSave source's19 bespoke sizes,
missing1000 and100 baseline were deviations, not a justified exception. The
existing DexTracker session supplied a fresh pending fleet-section7/1 run at
2026-10-26 05:30UTC, with sizes1000/10000/100000/1m/10m, both route baselines1000,
16 separate diagnostic probes and per-route50/200 profiles. Main tables terminate
at the50bp threshold; the complete published stress rungs and diagnostic evidence
remain in labeled disclosures. Both exit paths retain matched shares and both
payout legs. No missing rung is interpolated.

Consumer transport checks the max10 decade grid and declared first-successful
standard baseline. Only an explicit standard policy authorizes that baseline;
legacy failed first-rung feeds do not silently substitute larger quotes. Source
endpoint checks, stability metadata and floor/precision status survive transport.
Verified coarse floors are labeled floors on the header and depth summary; an
unverified source floor does not become a located crossing. Current source does
not meet1% precision and declares floor-only status. Numeric columns follow the
fleet right-aligned table convention. Useful price and exit-profile charts remain
visible; selector, exact clocks and all-probe methodology are disclosures.

Eight transport tests, renderer grid/baseline/floor tests and desktop/mobile
light/dark browser checks passed. No production publication is performed.
