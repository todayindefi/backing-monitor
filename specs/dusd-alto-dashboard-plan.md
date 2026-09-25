---
title: DUSD (Alto) dashboard — state of play
repo: backing-monitor
status: rev 4, 2026-09-25. ⚠️ REWRITTEN FROM A PLAN INTO A RECORD. revs 1–3 were a plan for a
  page that did not exist; the page exists, is registered, is fed by all four producers and now
  carries bespoke panels (0086cf81d). Everything revs 1–3 listed as blocking has landed.
---

# 0 ▶ WHAT THIS DOCUMENT IS NOW

⚠️ **rev 3 OPENED WITH "State: NOT STARTED as a dashboard. 1 of 6 axes has renderable data. No
page exists." EVERY CLAUSE OF THAT WAS FALSE BY 2026-09-25, and it cost a session real time** —
it was read first, believed, and the work was scoped against it before the page was opened. A
handoff that outlives its own completion is a live instruction. That is the failure this rewrite
exists to stop, and it is the same one recorded in
`axis5-label-per-asset-not-hardcoded-issuer-backing-monitor.md`.

**Current state, measured in the rendered DOM on 2026-09-25, not inferred:**

```
slug dusd-alto   registered in data/assets.json   report_status: unavailable (correct — see §4)
axis 1 peg          band 8/10 (measured) + authored 5.5 basis + 3 authored notes
axis 2 backing      authored 5.5 · two-tranche coverage · USM · CDP markets · minters
axis 3 liquidity    authored 5.5 ON THE FACE · venues/roles/exclusions · exit reality
axis 4 dependencies deliberately UNSCORED by the producer, declaration rendered
axis 5 contract     authored 5.0 from riskAnalyst's enumeration + "no topology walk filed"
axis 6 issuer       4.5 (their `score` -> `issuer_score` rename, 2026-09-25)
```

---

# 1. The asset, in the facts that change the page

```
slug          dusd-alto            chain  Ethereum only
token         0x63d74d22E689C715a04F2C13962b1f77F443d35b   non-proxy, immutable
supply        ~822K DUSD           ~88% USM tranche · ~12% isolated CDP markets
USM           0x1BD08B43D1579881cfAd0A35AEEa5b547dBE4c91   1:1 frxUSD, PERMISSIONED swap
venue         one — Curve DUSD/frxUSD 0x104d6a1b97A6CEf88D905d7b865A378d90be932A
```

⚠️ **RESOLVE BY ADDRESS, NEVER BY TICKER.** Four live Ethereum tokens answer to DUSD/dUSD and the
nearest is 3.2% away on supply. This now renders on the page itself, not only on the index card.

⚠️ **NO SINGLE COLLATERAL RATIO EXISTS FOR THIS ASSET, BY DECLARATION.** PegTracker publishes
`collateral_ratio: null` with a basis; riskAnalyst's overlay argues it at length. The USM's
100.00% is a 1:1 warehouse with ZERO surplus — the worst sustainable reading, not a cushion — and
the CDP's ~194% belongs to those markets' own borrowers. **Anything that renders one number here
misinforms in one direction or the other.**

⚠️ **THE CURRENT DEVIATION IS A PREMIUM, NOT A DEPEG**, and an absolute-deviation alerter will
score it as one. Whatever gets wired to this asset must be SIGNED (riskAnalyst, 2026-09-25).

---

# 2. What shipped, and where each piece lives

**Generic — `js/renderers/common.js` / `js/app.js`.** ⚠️ The rev-2 decision "GENERIC, no dusd.js"
was recorded as user-agreed and it still holds *for the class of thing it was about*: anything
computed before an asset renderer runs (bands, merges, chart gating) cannot be fixed from a
bespoke file, only overwritten in the DOM afterwards. All four defects below are that class.

- CR-history chart honours a `collateral_ratio: null` + basis declaration instead of plotting the
  history file's `100.0`.
- `DEPTH_NON_DERIVABLE_STATUSES` — one list for the band's refusal and the authored score's gate.
  They had diverged, and `supply_capped` was in one of them.
- An envelope-derived `as_of` no longer overwrites a measured one.
- The unread-score reporter now catches a bare `score` key.
- Block-level authored notes render, with unadopted keys named.

**Bespoke — `js/renderers/dusd-alto.js`.** Only asset-shaped panels, none of which a generic
renderer could express: two-tranche coverage chart, the stability module, CDP markets, the minter
set, exit reality, the lifetime peg archive, the address-collision line.

**Sync.** `_minters` and `_peg_backfill` added to SUFFIXES — both had been published since 09-21
and never copied.

---

# 3. Traps that still bind

⚠️ **`axis_thresholds` ARE DESCENDING.** `cutoffs[0]` is the 5/5 floor. A reversed array does not
error — it silently scores 5/5. (riskAnalyst, 2026-09-21.)

⚠️ **COPYING IS PUBLISHING.** `sync_and_push.sh` commits and pushes `data/` minutes later. There
is no review step between a producer writing a file and a reader seeing it.

⚠️ **REGISTERING EXPANDS riskAnalyst's AUDIT SCOPE** — their checker reads our `assets.json`.

⚠️ **THE LIFETIME PEG ARCHIVE IS HELD STANDALONE ON PURPOSE.** PegTracker declares it "not
spliced", and the data says why: the venue CHANGES mid-life (UniV3 while liquid, Curve after).
It renders as its own chart with one dataset per venue. **Do not join it to the live series.**

⚠️ **THE FLOAT AND THE NON-VENUE HOLDERS ARE DIFFERENT BASES.** A USD depth float minus DUSD
token counts read at another block is not a third-party float. The page shows both inputs and
subtracts neither; the producer who measures the split should publish it.

---

# 4. Open, with owners

| Item | Owner | State |
|---|---|---|
| Report link | riskAnalyst / tidresearch | ⚠️ NOT published — `dusd-alto-retail.md` carries `production: false` and both URLs 404. Keep `report_status: "unavailable"`. When it lands the URL is `/reports/dusd-alto/`, **not** the `-retail` filename (that tier suffix was retired 2026-09-10). |
| Axis 5 topology walk | riskAnalyst's user | Not commissioned. The enumeration stands as the basis with "no topology walk filed" rendered. They will come back with a yes/no. |
| Third-party float split | riskAnalyst | Measured on their side (~945 DUSD across ~110 addresses at block 26,053,165) and published in no file. Asked for it as a field. |
| `pool_token_share_pct` alerting | undecided | riskAnalyst's recommendation: alert on pool composition (23–24% DUSD), not on deviation. Nothing is wired to this asset yet. |

---

# 5. What I would still NOT build

- **A blended collateral ratio anywhere on the page**, in any styling. It averages a zero-buffer
  tranche with a cushion that belongs to someone else.
- **A derived third-party float** (see §3).
- **An unsigned deviation alert** (see §1).
- **A `score` -> `issuer_score` translation.** riskAnalyst asked for the marker to keep tripping
  instead; a translation silences the next typo.
