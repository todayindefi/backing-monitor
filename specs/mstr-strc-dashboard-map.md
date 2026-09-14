---
title: MSTR / STRC dashboard — panel → field → source map
repo: backing-monitor
status: LIVING. Written 2026-09-14 because "what does a new 8-K touch?" took an hour of grepping.
---

# Why this file exists

`?asset=mstr` and `?asset=strc` are **two lenses on one feed**. `assets.json` gives mstr
`data_source: "strc"` — same JSON, equity-holder framing versus credit-holder framing.

⚠️ **Nothing here is on the six-axis frame.** These are TradFi-extended monitors; `check_feeds.py`
lists both among the seven assets wholly off it. Do not look for peg/backing/liquidity axes.

⚠️ **This map exists because the panels were being learned one defect at a time.** On 2026-09-14 a
new 8-K arrived and answering *"does it render automatically, and what needs updating?"* required
reading nine render functions and three JSON files. Three separate staleness defects were found in
the process, all of the same shape: **a published `as_of` that never reached the reader.**

---

# 0. ⚠️ THREE lenses share this feed — and one of them is NOT this spec's job

```
?asset=strc    credit-holder lens    strc.js    data_source: strc   ← this spec
?asset=mstr    equity-holder lens    mstr.js    data_source: strc   ← this spec
?asset=strcx   the on-chain wrapper  strcx.js   data_source: strc   → six-axis spec
```

**STRCx is a crypto asset and lives on the six-axis frame**, via `strcx_axis_basis.json`, which
publishes `peg` / `backing` / `liquidity` / `dependencies` overlays. Read
`specs/six-axis-dashboard-spec.md` for it — not this file. ⚠️ **The base feed carries no `peg`
block, so it is the OVERLAY that puts STRCx on the frame**; a conformance check reading
`strc_backing.json` alone will report it as off-frame and be wrong about the rendered page.

**Two things about STRCx belong here anyway, because they are properties of THIS feed:**

⚠️ **The multiplier makes one feed mean different things in different lenses.** STRCx's supply and
CoinGecko price are BOTH pre-scaled; one *scaled* STRCx is one STRC share. Valuing a pre-scaled
count at the scaled mark understates by the multiplier — **I did exactly that on 2026-09-14 and
had to reverse it.** Do not carry an MSTR-lens price assumption onto the wrapper.

⚠️ **`strcx.js` `preRender` runs AFTER `mergeAxisOverlays`** (app.js:351), so `data.liquidity`
already exists by then and must be filled field-by-field, never replaced — replacing it drops
riskAnalyst's authored axis score.

---

# 1. Data sources — all three are SYNCED COPIES

```
data/strc_backing.json           byte-identical copy of PegTracker's
data/strc_backing_history.json   time series for the charts
data/strategy_events.json        EDGAR 8-K monitor output
```

⚠️ **We produce none of it and must never hand-edit it** — `sync_and_push.sh` overwrites `data/`
and a hand-entered figure is gone within the hour. When a filing lands, the correct action here is
**nothing**: PegTracker's EDGAR poll ingests it and the panels move on their own.

**The one thing we own is whether the page tells the truth about how old the number is.**

## Blocks inside `strc_backing.json`

```
tradfi                      market-derived: STRC price, mNAV inputs, quote detail
mstr_view                   equity lens: share count, balance sheet, capital structure, ATM cadence
mstr_view.digital_credit_framework   the 06-29 8-K standing programs (reserve, DCS, buyback, BTC)
wrapper_strcx               the on-chain wrapper — belongs to ?asset=strcx, not here
downstream_exposure         Apyx + Saturn STRC holdings — feeds the shared-upstream table elsewhere
```

---

# 2. Panels, and what each reads

## `?asset=strc` — credit-holder lens (`strc.js`), in page order

```
_renderHeadlineBanner            tradfi              STRC price vs par, rate, status
_renderStrcInstrument            tradfi              rate mechanics + secondary chart
_renderStrcDividendObligation    data                dividend obligation, STRC-only runway, rate ceiling
STRC_FRAMEWORK_CARD              dcf                 ⚠️ shared with MSTR — see §4
_renderStrcxHandoffCard          wrapper_strcx       handoff to ?asset=strcx, not the wrapper's own view
_renderDownstreamExposure        downstream_exposure Apyx + Saturn STRC holdings
_renderDependencyStrategyFunding tradfi, dcf         mNAV + issuer funding regime
Strategy Event Log               strategy_events     ⚠️ shared with MSTR — see §4
_renderFreshness                 data                feed timestamp + 8-K age
```

⚠️ **`_renderPegVsPar` and `_renderCommonBtcCoverageLine` exist in `strc.js` but are NOT in the
page assembly** — do not assume a function in this file is rendered. Check the `html +=` chain in
`render()`.

⚠️ **Issuer-side analysis deliberately does NOT live here** — capital structure, the full cash
waterfall and per-share BTC NAV are the MSTR lens. The two pages are complements, not duplicates,
and a figure appearing on only one is usually intentional.

## `?asset=mstr` — equity-holder lens (`mstr.js`), in page order

```
_renderHeadlineBanner          tradfi, mv          mNAV, per-share NAV basic/diluted, share count
_renderMnavRegime              tradfi, dcf         regime bands, issuance-accretion signal
_renderBalanceSheet            mv.balance_sheet    cash, converts, preferred notional, BTC
_renderCapitalStructure        mv.capital_structure senior → junior → common stack
_renderCashServiceWaterfall    data                preferred service + rate-ceiling overlay
_renderPerShareNavTrajectory   tradfi, mv, history per-share BTC NAV series
_renderDilutionMaturityWall    mv.atm_cadence_90d  ATM cadence + convertible maturity wall
MSTR_FRAMEWORK_CARD            dcf                 ⚠️ thin wrapper — see §4
Strategy Event Log             strategy_events     ⚠️ borrowed from strc.js — see §4
_renderFreshness               data                feed timestamp
```

---

# 3. ⚠️ Freshness — the table that answers "what does a new 8-K touch?"

Measured 2026-09-14:

```
block                 as_of        age    advanced by            stamp rendered?
share_count           2026-08-30    15d   weekly 8-K ATM table   ✅ added 2026-09-14
share_count_anchor    2026-07-24    52d   10-Q/10-K cover        ✅ added 2026-09-14
balance_sheet         2026-08-09    36d   periodic 8-K + 10-Q    ✅ pre-existing
capital_structure     2026-08-09    36d   periodic 8-K + 10-Q    ✅ added 2026-09-14
usd_reserve_policy    2026-09-07     7d   weekly 8-K             ✅ (+ 2nd instance 09-14)
dcs_repurchase        2026-09-08     6d   weekly 8-K             ✅ fixed 2026-09-14
atm_cadence_90d       rolling       n/a   EDGAR poll             ✅ added 2026-09-14
```

⚠️ **A weekly 8-K advances `share_count`, `usd_reserve_policy`, `dcs_repurchase_program` and
`atm_cadence_90d`. It does NOT advance `balance_sheet` or `capital_structure`** — those move on
periodic filings, which is why they legitimately sit 36 days old and why their stamps matter more,
not less.

## The three defects this audit found, all one shape

```
dcs stamp gated on `dcs.as_of`   the payload has remaining_as_of / executed_as_of / … and no
                                 plain as_of, so the guard was ALWAYS false. A fix keyed to a
                                 field that does not exist reads as a fix that keeps passing.
atm_cadence_90d undated          a rolling window is only as current as its last poll; it named
                                 its source and not its date while silently excluding a filing.
share_count undated              the denominator of every per-share figure on the page, and it
                                 is CONSTRUCTED: 10-Q anchor + shares carried forward across 5
                                 weekly ATM tables, including unsettled shares.
```

✅ **`capital_structure.as_of` was the one still unrendered and is now fixed** — found missing on
BMNR first and then here, same field, both dashboards. It moves on periodic filings rather than
weekly 8-Ks, so it is legitimately the oldest block on the page, **which makes its date more
load-bearing than the weekly ones, not less.**

---

# 4. Dependencies and shared code — the traps

⚠️ **`MSTR_FRAMEWORK_CARD` and `STRC_FRAMEWORK_CARD` are both thin wrappers around
`renderDigitalCreditFrameworkCard(dcf, lens)`, which lives in `strc.js`.** A fix there lands on
BOTH dashboards. I briefly believed MSTR had its own copy and nearly fixed the same bug twice.

⚠️ **The Strategy Event Log on MSTR is `strc.js`'s** — `STRCRenderer._loadStrategyEventLog('mstr-event-log-panel')`.
It already carries an EDGAR health footer (last poll + consecutive failures). **It needs no
maintenance when a filing lands; it is the component that self-heals.**

⚠️ **`mstr.js` depends on `strc.js` being loaded first** (it calls `renderDigitalCreditFrameworkCard`
and `STRCRenderer.*` directly). Script order in `index.html` is load-bearing.

---

# 5. ⚠️ TWO staleness failure modes ran concurrently, and only one is uncatchable

**This section was written on 2026-09-14 describing only the first, and was wrong by omission.**
Corrected the same day after PegTracker's parser fix exposed the second.

```
mode A  CADENCE        the filing has not been polled yet
mode B  PARSE FAILURE  the filing WAS polled; one section of it did not parse
```

**What actually happened, reconstructed from the artifacts:**

```
09-08 filing   polled ~6 days earlier
               SECURITY_REPURCHASE parsed  -> DCS remaining $1.19B as of 09-08   ✅
               btc_update PARSE_FAILURE    -> BTC/ATM data missing for SIX DAYS  ⚠️
09-14 filing   not polled until 14:44 (6-hourly cadence)
               -> the $1.05B DCS figure could not arrive before then             ⚠️ mode A
```

⚠️ **So the DCS figure was genuinely cadence-limited and the BTC figure was genuinely broken, at
the same time, in the same feed.** Diagnosing one does not diagnose the other.

## The discriminating-check rule

The check used to diagnose this was *"is the newest accession present in `strategy_events.json`?"*
It was absent, mtime was hours old, and the conclusion drawn was "cadence".

⚠️⚠️ **That check cannot distinguish mode A from mode B — both produce an absent newest
accession.** It is consistent with the cadence hypothesis and equally consistent with the parse
hypothesis, so it is evidence for neither.

**A check that cannot discriminate between two hypotheses cannot support choosing one.**

```
non-discriminating   is the NEWEST accession present?        absent under both modes
discriminating       is the PREVIOUS filing's data COMPLETE?  one line, and it was never run
```

⚠️ **Both parties reached for the non-discriminating check** — riskAnalyst ran it, and this repo
adopted the conclusion and wrote it into this spec without testing it. The PARSE_FAILURE on the
09-08 filing was visible in the feed the whole time and was read as a "known prior" rather than as
a live finding.

**Mode A is genuinely uncatchable by an age threshold** — the poll ran three hours before the
filing, fresh by any cutoff. Rendering the poll timestamp so a human can compare against a filing
date they know about is the only thing that works, and that is why it ships.

⚠️ **Mode B is very catchable, and now is:** the MSTR ATM panel counts `PARSE_FAILURE` events
inside its own window and declares the totals incomplete. It self-retired when the parser was
fixed. **Check for it by asking whether a polled filing's sections are complete, never by asking
whether the newest one arrived.**

⚠️ **And the backing analyzer re-running does not help with mode A** — it re-reads
`strategy_events.json`. `strc_backing.json` re-ran at 13:51 and still carried the 09-08 DCS figure
because the poll behind it had not moved. **Watch the poll, not the backing run.**

---

# 5b. ⚠️ Status as of 2026-09-14 22:xx — NOT current with the latest 8-K

```
new 8-K            0001193125-26-389858   period 09-08 -> 09-13
EDGAR poll         2026-09-14T10:50:44Z   has not advanced; filing NOT ingested
newest in feed     0001193125-26-384402

DCS remaining      shows $1.19B (09-08)   actual $1.05B (09-13)   ⚠️ $140M stale
USD reserve        shows $5.10B (09-07)   flat again -> RIGHT BY VALUE, stale by date
share_count        as of 2026-08-30
```

⚠️ **The $140M gap is the 1,420,467-share / $139.3M STRC repurchase in that filing.** Both lenses
show it, because both read the same block.

✅ **Every one of those figures now renders its own date**, which is the only thing this repo can
do about it — the fix for the staleness itself is a PegTracker poll, not a render change. Before
2026-09-14 all three rendered bare.

⚠️ **The reserve is the dangerous one, not the DCS figure.** It is correct this week only because
the reserve was flat, so a reader has no way to tell a live figure from a frozen one — which is
why it now carries `(2026-09-07)` in both places it appears.

---

# 6. What to do when a filing lands

```
1. Nothing, at first. PegTracker's poll ingests it; the panels move on their own.
2. Check the poll advanced:  strategy_events.json last_edgar_poll_utc
3. Check the block advanced: the §3 table's as_of fields
4. If the poll has not moved by the next day, that is a PegTracker finding, not a render bug.
```

⚠️ **Do not derive a rate from two prints.** Weekly 8-K periods are not equal-length — 2026-09-14's
was 6 days against the prior 8. riskAnalyst measured spend down 21% on calendar days and roughly
flat on trading days; **no rate is published and the direction is not established.**

⚠️ **Flat is a state, not a non-event.** The USD reserve rose every week 05-25 → 08-31 and then
went flat twice; BTC has been unchanged three weeks with both ATMs at zero. Render those as
standing states — `atm_cadence_90d` zero rows now read *"flat, not unreported"* for this reason.

⚠️ **Sign-aware labels.** `btc_purchased_count` is a NET over the window and goes negative on a
monetization week; it rendered as *"BTC purchased −1,793 BTC"* until 2026-09-14.
