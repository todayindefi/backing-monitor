---
from: backing-monitor
to: PegTracker
date: 2026-10-18
status: ready-for-manual-delivery
---

# scrvUSD: wire market price versus contemporaneous dollar NAV

The scrvUSD dashboard is live at
https://todayindefi.github.io/backing-monitor/?asset=scrvusd but its standard
peg chart is blank. This is an implementation omission: the newly added
`/home/danger/PegTracker/scrvusd_backing_analyzer.py` deliberately emits
`peg.market_price = null`, `premium_discount_pct = null`, and null market
observations in `persist()`. That does not establish that no market price exists.

Please review and implement the market-price/history seam in your repository.
The existing analyzer was implemented by the backing-monitor agent; this handoff
requests PegTracker ownership/review of the missing pricing integration, not a
claim that PegTracker already reviewed the whole implementation.

## Identity and sources

- Ethereum scrvUSD vault: `0x0655977FEb2f289A4aB78af67BAB0d17aAb84367`.
- Underlying crvUSD: `0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E`.
- CoinGecko identity: `savings-crvusd`, listing:
  https://www.coingecko.com/en/coins/savings-crvusd
- Candidate market endpoint:
  `https://api.coingecko.com/api/v3/simple/price?ids=savings-crvusd&vs_currencies=usd&include_last_updated_at=true&precision=full`.
  Verify the response, source age, contract identity and market methodology;
  listing existence alone does not establish a reliable current API observation.
- Existing `special_assets/metadata.json` includes Pyth
  `Crypto.SCRVUSD/CRVUSD.RR`. That is a redemption-rate reference, NOT an independent
  scrvUSD market quote. Inspect existing special-asset price/history plumbing for
  reusable observed data before creating duplicate collection/history.
- The committed October 17 assessment is `riskAnalyst` commit `8ee3dc4`,
  `assets/scrvusd.md`. Existing wrapper implementation/runner commits in PegTracker:
  `0d173fb` and `4fc477c`. Inspect current HEAD before editing.

## Requested change

1. Add a real USD/share market observation. CoinGecko is a candidate, with its own
   `last_updated_at`, source and scope. Confirm that it supplies market evidence
   rather than a NAV/redemption-derived reference for this token. If unsuitable,
   return the concrete issue or implement a dated Ethereum spot/route quote with
   explicit size, payout token and conversion basis. Never label vault redemption,
   Pyth RR, or NAV multiplied by the parent mark as an independent market price.
2. Retain the existing reference:
   `USD NAV/share = convertToAssets(one scrvUSD share) × dated crvUSD/USD mark`.
   Compute signed premium/discount as `(market_price / nav - 1) × 100` only when
   both inputs are valid. scrvUSD is NAV-accruing, not a $1 peg. A price above $1
   is not a depeg. Never compare the market quote to a fixed $1 reference.
3. Publish market source/time separately from vault block/time and parent
   crvUSD-mark source/time. Enforce and document freshness and clock-skew limits.
   Invalid, missing or stale inputs withhold the current comparison with a reason;
   any retained last-good quote keeps its original source time and stale status.
   Do not re-stamp a carried quote or turn fetch failure into zero.
4. Persist contemporaneous market/reference pairs and the resulting deviation.
   Prefer extending `scrvusd_backing_history.json`, already transported, rather
   than introducing a second unconsumed file. Preserve existing NAV, custody,
   debt, rewards and source-clock fields. Do not compare old prices with today's
   NAV, rewrite the earlier null market observations, interpolate fabricated
   prices, or describe reconstructed history as observed history.

## Consumer-compatible field contract

For the existing backing history, emit the following declarations once real
observations exist:

```json
{
  "peg": {
    "market_price": "number USD/share, or null with status/reason",
    "market_price_source": "provider and scope",
    "market_price_as_of": "provider observation time, UTC ISO-8601",
    "nav": "number USD/share, or null",
    "premium_discount_pct": "signed percent, or null",
    "history_ref": "scrvusd_backing_history.json",
    "history_field": "peg_premium_discount_pct",
    "chart_history_field": "peg_market_price",
    "chart_reference_field": "peg_theoretical_price",
    "chart_window_days": 7,
    "chart_min_points": 2
  }
}
```

This is a field/type illustration, not literal strings to put in numeric fields.
Each new `entries[]` row should carry `timestamp`, `peg_market_price`,
`peg_theoretical_price` (that row's USD NAV), `peg_premium_discount_pct`,
`market_price_as_of`, market source, vault block/time and underlying-mark time.
The `pct` history field matters: the current generic rating path otherwise
converts historical prices against the latest NAV. The chart independently
reads the paired price/reference fields above.

Keep UTC timestamps compatible with the dashboard (`Z` suffix preferred).
Do not declare history fields that have no usable observations yet. Fewer than
two valid points should remain an honest sparse-history state until another
observation arrives. If using saved history, verify its actual coverage, units
and contemporaneous reference provenance before adopting it.

## Publication boundary — important

The default directory `data/dashboard_pending/scrvusd/` is NOW LIVE INPUT,
despite its name. The hourly backing-monitor adapter
`tools/sync_scrvusd_feeds.py` explicitly allowlists its backing, backing-history
and last-attempt files. The hourly PegTracker runner also invokes the analyzer.
Changing the live module/default outputs can therefore publish on the next run.

Develop/review in an isolated checkout or a separate candidate module and use
`--out-dir data/review_pending/scrvusd_market_price/` (not the live default path).
Keep candidates outside all serving roots until reviewed. Do not register new
assets, activate a schedule, run the whole analyzer fleet, dispatch other agents,
edit other repositories, or publish as part of this handoff.

If a separate peg-history file is necessary, return its exact schema/path:
backing-monitor's scrvUSD allowlist and preview assembler must be amended before
that file can reach the page. Merely writing a new suffix is not enough here.

## Validation and return

Test genuine market/NAV separation, correct identity and quote units, positive
and negative deviations, missing/stale/future timestamps, clock skew, partial
fetch failure, last-good clocks, per-row historical NAV, and sparse history.
Retain the existing scrvUSD accounting/redemption tests. No trades or approvals.

Return candidate paths, commit/diff, sample current observation with all three
clocks, history coverage, market-source methodology, test results and any blocker.
Keep the change scoped to scrvUSD pricing/history and any necessary shared adapter.

backing-monitor will then validate the generic price-versus-NAV chart, update the
scrvUSD renderer's currently hardcoded “market quote unmeasured”/NAV-only summary,
and check current status labels and measured peg-rating behavior. A producer-only
fix must not be described as a completed visible dashboard fix until those
consumer checks pass.

This file is for user delivery. No external message or agent launcher was sent.
