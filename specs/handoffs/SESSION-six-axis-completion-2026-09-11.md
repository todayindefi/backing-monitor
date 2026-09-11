# Session handoff — six-axis completion, axis-basis rollout, liquidity measurement
**Date:** 2026-09-11 · **Repo:** `~/backing-monitor` · **Branch:** `main`, clean and pushed

---

## The standing task

**Close six-axis gaps on the production dashboard.** Every published asset should carry all six
axes — `1 Peg · 2 Backing · 3 Liquidity & Exit · 4 Dependencies · 5 Contract & Admin · 6 Issuer` —
with measured or properly-attributed data.

## Where it stands

```
published assets            25   (+2 staged: reusd-re, reusde-re)
axis 5 complete             19 / 25   (walk + score; zero walk-only)
axis 6 issuer summary       17 / 25   (18 of 19 in-scope; 6 assets deliberately out of scope)
axis_basis files            24 / 25   (declares what each authored score MEASURES)
axis 4 scored               16 / 25
tier-B prose flagged        21 / 25   (convention agreed, applies on next producer touch)
check_feeds                 1 failure (bmnr), 27 warnings
```

---

## OPEN ITEMS

### 1. `bmnr` — orphaned feed, needs a decision (only remaining FAIL)
```
data/bmnr_treasury.json   ~7h old    LIVE, syncs daily
data/bmnr_backing.json    297h old   ORPHANED — nothing writes it
```
`bmnr_treasury_analyzer.py` runs and is current. **Nothing writes `bmnr_backing.json`** — whatever
did stopped on 08-30, and it is not in `crontab` or `cronjob.sh`.

⚠️ **`check_feeds.py:43` keys staleness off `*_backing.json` for EVERY asset**, so bmnr reports 297h
while its real data is hours old. **This is a measurement pointed at the wrong artifact, not a
stale analyzer.** Decide which file is authoritative: either point the check at what the asset
actually renders, or delete the orphan so the page cannot read a fortnight-old snapshot.
**Unresolved — needs the owner.** Check what `js/renderers/bmnr.js` reads first.

### 2. crvUSD crossing bracket — waiting on a cron cycle, NOT broken
Bracket is `$5M..$50M` (10× wide). PegTracker's `ca4943e` added a bisect slot; **verified against
their shipped code that the next run selects `$10M`**, narrowing to ~2×.
- `select_quote_sizes` runs ONLY in the standalone `liquidity_tracker.py` (`30 */3 * * *`)
- The hourly analyzer republishes whatever ladder exists
- Fix landed 16:10; last standalone ran 15:44 → first effective run ~18:30
- **A background watcher is armed on the deployed feed.** If it has not narrowed after two
  cycles, that is a finding about the fix, not about crvUSD. riskAnalyst is waiting on this
  before rewriting crvUSD's liquidity basis.

### 3. Tier-B prose — 21 of 25 still carry internal vocabulary
Producer-authored prose renders verbatim and contains repo names, internal paths, session
language. **Convention agreed with both producers; applies on next touch of each asset.**
`check_feeds.py` warns per asset — the count is the progress bar. Nothing to do but watch.

### 4. Parked (owner decision, not started)
- **16 tidr production reports for assets with no dashboard page** — usdc, usdt, usdg, rlusd,
  frxusd, pyusd, gho + 9 more. riskAnalyst has authored axis-5 overlays for three that land
  nowhere. ⚠️ Adding one is NOT a sync line: the six-axis frame is gated on `data.peg`, so each
  needs a PegTracker feed first. See memory `project-unregistered-assets-and-riskanalyst-coupling`.
- **ousd / usdd / cusd** — publish no `peg` block, so NO part of the six-axis frame renders.
  Deprioritised by the owner (staging assets).
- **Liquidity band is size-blind** — thresholds `[2M, 1M, 500K, 100K]` are identical for every
  asset. Mitigated (not fixed) by rendering the share-of-supply beside the band. Owner chose this
  over re-grading 25 assets; revisit is open.

---

## SHIPPED THIS SESSION (headline items)

- **Axis 5: 7 → 19.** thUSD 4.0, apyUSD 4.5, usdat 4.0, susdat 4.0.
- **Axis 6: 0 → 17** issuer summaries, rewritten mid-flight from "one key line" to a ~95-word
  orienting paragraph after owner feedback.
- **Authored scores REMOVED from any axis showing a live one** — they read as a divergence that
  does not exist. Axes 4/5/6 keep theirs (no live band to conflict with).
- **`axis-basis/1` adopted** — peg/backing/liquidity/dependencies, additive merge.
- **Axis 4 renders its score + basis** (`underlying_score`), previously a bare link tile.
- **Share-of-supply line** beside the liquidity band; **withheld whenever the band is withheld.**
- **Depth qualifier** distinguishes `bracketed` / `solved` / `ladder_exhausted` / `quote_failed` /
  `not_size_responsive`.
- **Markdown rendering** — 346 spans were literal `**asterisks**`; escape-then-convert.
- **Internal repo names off the page**; `source_file` no longer rendered.
- **Two `check_feeds` warns**: unreachable producer files (dashed-filename trap) and registry drift.

---

## TRAPS — read before touching anything

⚠️ **MERGED IS NOT RENDERED.** The single most common defect all session. A field reaching
`data.*` proves nothing about a reader seeing it. Check separately, every time.

⚠️ **NOTHING MAY APPEND TO AN AXIS HEAD BEFORE THAT HEAD RENDERS.** `_renderAxisHead` sets
`innerHTML` and wipes prior appends. The liquidity basis was broken from the moment it shipped
because of this.

⚠️ **A CHECK THAT ORs TWO THINGS CANNOT DETECT ONE FAILING.** I reported "21 assets render a
basis"; liquidity was rendering on ZERO. Peg passing masked it. Measure halves separately.

⚠️ **THE DASHED-FILENAME TRAP.** The sync resolves `slug.replace('-','_')`. 35 of 150 slugs carry
a dash. A miss is SILENT. `check_feeds` now warns — it has caught one real occurrence.

⚠️ **THREE BESPOKE RENDERERS BLANK SHARED NODES** — `hastra-prime.js`, `thusd.js`, `usdai.js` all
clear `axis-liquidity-body` (and others). Anything the shared renderer writes there is lost on
those assets. **Standing check: what does common.js write into the node this page clears?**

⚠️ **`max-age=600` SITS BETWEEN THE FEED AND THE READER.** A page can render cached data while a
fresh `fetch()` from the console returns new data — they answer different questions. **Only a
cache-disabled reload measures what a reader saw.** This nearly produced a bug report against
working code.

⚠️ **VERIFY, DON'T RELAY.** Peers corrected several of their own claims this session and I
corrected several of mine. Run the thing.

---

## PRODUCER STATE

- **PegTracker** — all handoffs complete (`ca4943e`, `53a8191`, `befb7ae`). Re scraper replaced
  with DefiLlama after `app.re.xyz` went client-rendered; reusd/reusde feeds are live again.
  ⚠️ `reusd_re` still publishes `total_backing: null` — deliberate, see its `collateral_ratio_basis`.
- **riskAnalyst** — axis-basis rollout complete. Waiting on crvUSD bracket to narrow before
  rewriting that basis. `usg` basis already rewritten (`0ff5cbf`).
- **security_analyst** — prose convention applies on next walk.
- ⚠️ **Routing:** codex file handoffs for PegTracker/DexTracker/security_analyst; live SendMessage
  for tidr and riskAnalyst.
