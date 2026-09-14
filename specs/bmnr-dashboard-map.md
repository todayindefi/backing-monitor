---
title: BMNR dashboard — panel → field → source map
repo: backing-monitor
status: LIVING. Written 2026-09-14 alongside the MSTR/STRC map, same reason.
---

# Why this file exists

BMNR (BitMine Immersion, NYSE + ETH treasury) is the fleet's **most staleness-laden asset**, and
almost everything about maintaining it is a question about *which price a number is struck at*
rather than about the number.

⚠️ **It is off the six-axis frame** — no peg/backing/liquidity axes. Sibling in kind to MSTR: a
listed company whose treasury is disclosed in 8-Ks, read through an equity-holder lens.

Companion: `specs/mstr-strc-dashboard-map.md` (three lenses on one Strategy feed).

---

# 1. ⚠️ THE SYNC ALIAS — read this before touching anything

```
PegTracker publishes    bmnr_treasury.json
the dashboard fetches   bmnr_backing.json     (app.js hardcodes the _backing suffix)
bridged by              sync_and_push.sh  BLOCK_ALIASES="bmnr_backing.json:bmnr_treasury.json"
```

⚠️ **This bridge has failed once and the failure was SILENT.** `_treasury` is also in `SUFFIXES`,
so the fresh file kept arriving hourly under its own name with no reader, while an orphaned
`bmnr_backing.json` sat beside it unwritten since 2026-08-30 — **and the page rendered that one.**
Nothing was missing; the wrong file was being read.

**Diagnostic:** `data/bmnr_backing.json` and `data/bmnr_treasury.json` must be IDENTICAL. If they
diverge, the alias has broken and the dashboard is serving the older one.

```
python3 -c "import json;print(json.load(open('data/bmnr_backing.json'))==json.load(open('data/bmnr_treasury.json')))"
```

---

# 2. Panels (`bmnr.js`)

```
_renderNavBasisNote        the basis caveat — ⚠️ load-bearing, see §3
_renderFreshnessBanner     freshness.stale / stale_effect
_renderHeadlineBanner      live.*, mnav.*
_renderMnavTrajectory      bmnr_backing_history.json
_renderTreasuryComposition treasury.*  (eth/btc/cash)
_renderCadenceTable        cadence_4w.*
_renderFirepowerRunway     firepower.*  (ATM authorised/drawn/remaining, runway)
_renderFreshness           as_of
```

---

# 3. ⚠️ The basis problem — the whole point of this asset

```
treasury.eth_value_basis     "stamped_8k_price"
mnav.nav_basis_eth_only      "stamped_8k_price"
mnav.nav_basis_full          "mixed_stamped_eth_live_btc"
mnav.nav_constant_stale      true
treasury.constant_stale      true
freshness.stale              true
```

**ETH value and NAV are struck at the price printed in the 8-K, against a FROZEN ETH count — not
at the live ETH price.** The producer says so in `mnav.basis_caveat`:

> *"NAV is struck on the 8-K's stamped price against a frozen ETH count; a current count would move
> this ratio…"*

⚠️⚠️ **DO NOT RE-MARK TO LIVE.** The count is frozen too, so marking one leg to spot and leaving
the other stamped produces a mNAV that is neither. `mnav.full_treasury` is already
`mixed_stamped_eth_live_btc` — one mixed basis in the feed is enough.

⚠️ **`freshness.stale: true` is the NORMAL state here, not an alarm.** It means "the 8-K is older
than the live price", which is true almost always. Treating it as a fault would flag the asset
permanently.

---

# 4. Freshness, measured 2026-09-14

```
block                    field              value        age     advanced by
treasury                 as_of_8k           2026-05-25   112d    a new treasury 8-K
capital_structure        as_of              2026-02-28   198d    10-Q / periodic filing
live                     (price)            hourly       —       market feed
as_of                    (run)              2026-09-14   hours   analyzer run
```

⚠️ **112 and 198 days is not a bug.** BitMine files treasury updates episodically, unlike
Strategy's weekly cadence. **The maintenance question is never "why is it old" but "does the page
say how old, and against which price".**

⚠️ **Any age quoted in prose goes stale.** An earlier memory of mine recorded "93d" and was 112d by
the time it was read. **State the field, not the number** — `treasury.as_of_8k` and
`freshness.treasury_8k_age_days` are both published.

---

# 5. What to do when a BMNR 8-K lands

```
1. Nothing. PegTracker's analyzer ingests it; treasury.as_of_8k advances on its own.
2. Verify the alias held:   bmnr_backing.json == bmnr_treasury.json
3. Check the basis fields did not change meaning — if eth_value_basis stops being
   "stamped_8k_price", the NAV panels' caveats need rewording, not just renumbering.
4. cadence_4w and firepower are DERIVED from the filing series; they move with it.
```

⚠️ **`firepower.atm_drawn_post_10q_est_usd` is an ESTIMATE** (`_est_` in the name) and feeds
`atm_remaining_usd` and the runway weeks. A runway figure built on an estimate should never be
rendered as a measurement.

---

# 6. Checked on 2026-09-14

✅ **The NAV basis caveat is VISIBLE TEXT, not a tooltip** — verified against the rendered DOM, so
it survives tidr's embeds. This was the failure mode that caught the sUSDat backing tile and the
Wolf attestation pill the same day; BMNR does not have it.

✅ **`capital_structure.as_of` was rendered NOWHERE — now fixed.** The block itself is never
displayed, but `firepower` republishes its ATM authorised/drawn/remaining figures **with no
`as_of` of its own**, so a 198-day-old capital structure was driving a "runway in weeks" number
that read as current. The firepower panel now names the source block and its date.

⚠️ **And one input there is an ESTIMATE.** `atm_drawn_post_10q_est_usd` (the `_est_` is in the
field name) feeds `atm_remaining_usd` and therefore every runway figure. Now stated on the panel:
*"they are projections, not measurements."*

✅ **Sync alias intact** — `bmnr_backing.json == bmnr_treasury.json` verified True.

⚠️ **Not checked:** whether `history_8k` (5 entries) is rendered anywhere, and whether the
`yield` block's `note` reaches the reader.
