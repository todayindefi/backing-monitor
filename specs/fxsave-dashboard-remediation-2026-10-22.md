# FXSave dashboard remediation — 2026-10-22

The six findings in `fxsave-dashboard-audit-2026-10-21.md` are addressed in the
isolated review dashboard. No production asset registration or publication was
performed. The original audit remains a record of the pre-remediation state.

| Finding | Implemented closure |
|---|---|
| F1 Authority | The existing emitter reads committed, hand-walked security_analyst topology through an isolated preview registry. The dashboard displays three authority layers, six paths, six explicit unknown scopes and the original September 22 observation date. Admin/access-control and smart-contract security are labelled separately. |
| F2 NAV/history | Market/reference/deviation fields have explicit unavailable states; the reference names `fxSAVE.nav()` and its clock. A trailing-seven-day reference-only chart declares actual sparse coverage and point counts. Historical authored NAV 5 is retained in historical assessment evidence, rather than replacing the unavailable current market rating. |
| F3 Liquidity | The 50/200-bps profiles subtract each route's smallest-rung standing cost. Fixed fees remain in the separately labelled all-in cost. Venue inventory has its own scope/time; dust pools fold separately while quoted-route venues remain visible. Holder probe, maxRedeem, negative control, fee and queue carry the vault observation block/time. |
| F4 Backing | Same-block Ethereum share supply, total assets, custody claim, raw difference and conversion are in Backing. Independent dollar CR/history/allocation are explicitly inapplicable. Share-conversion history and custody-history evidence preserve adverse readings. Underlying fxUSD context is separately dated, attributed and linked. |
| F5 Dependencies | Registered destinations resolve to dashboard links. Known Morpho/Pendle report consumers render separately from incomplete automated graph enumeration. Embedded fxSP coverage and score-provenance policy are available in full disclosures; Dependencies stays unscored. |
| F6 State/refresh | Missing/stale/mismatched market clocks, failed attempts and missing payout legs derive from data fields. The existing hourly backing-monitor sync now regenerates the isolated preview using `--from-sync`, retaining source clocks and prior validated data on invalid input. Snapshot assembly and refresh mode are explicit. |

## Verified snapshot

At validation, the assembled vault snapshot was block 26,245,259,
`2026-10-22T02:46:59Z`. It included 19 forward observations and three historical
custody/accounting mismatch readings. The current reading reconciled. The
mismatches remain visible and are not described as realized losses. The matched
exit feed had 19 sizes; the partial Curve inventory had 37 pools.

These counts describe this review run, not hard-coded dashboard values. Subsequent
hourly generations use the producers' current values and original clocks.

## Verification

- Six consumer transport tests pass: identity/raw accounting consistency, missing
  basket legs, mixed quote inputs, double-counted USDC, failed quote retention,
  legitimate adverse accounting states and null inventory TVL.
- FXSave renderer checks pass for market-clock validity, seven-day cutoff without
  widening, standing cost versus incremental impact, failed smallest probe,
  missing payout legs and failed-attempt visibility.
- Existing scrvUSD and sfrxUSD renderer regression checks pass.
- Browser spec checks pass at 1280px and 390px, in light and dark modes, including
  all evidence disclosures expanded, authority rows, dependency links, history
  charts, venue inventory and measured-size selection. No page-level horizontal
  overflow or JavaScript errors was observed.
- Browser negative cases pass: a failed direct quote cannot use retained proceeds;
  a missing USDC payout invalidates the basket; a failed producer attempt is shown
  separately from retained observation clocks.
- Shared `check_feeds.py`: zero failures and 45 warnings across 36 registered
  assets. FXSave remains outside the serving registry, so its preview is covered
  by the scoped browser/transport checks rather than that registry manifest.
- Python/JavaScript syntax, shell syntax and `git diff --check` pass.
- The installed `8 * * * * .../backing-monitor/sync_and_push.sh` entry was read
  independently. The new preview-generation hook was smoke-tested directly;
  its first automatic invocation was not separately observed during this pass.

## Remaining declared limits

There is still no synchronized FXSave market mark, so a current premium/discount
and market-price history cannot be established. NAV/reference history is not a
substitute for those measurements. No independent FXSave dollar collateral ratio
is invented. Quote brackets remain indicative, assume par token marks, exclude
gas and use independent basket/router clocks. Scores remain dated and under
review; this implementation does not author replacement scores or refresh the
September authority observation date.

The preview is ready for another content review. Production promotion and serving
feed transport remain separate from this remediation; no existing producer pending
directory was added to the public data source roots.
