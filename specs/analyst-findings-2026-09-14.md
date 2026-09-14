---
title: Analyst findings — 2026-09-14
repo: backing-monitor
source: user's analyst, relayed 2026-09-14
status: WORKING BACKLOG. Items 12-15 FIXED 2026-09-14; items 1-11 UNVERIFIED.
---

# ▶ START HERE — resume context

**ALL 15 ITEMS ARE CLOSED. Triage bands S1–S11 complete.** 14 built and rendered; item 2 confirmed
as an absence and deferred upstream because the venue it names is not in any feed we hold.

⚠️ **Seven of the fifteen claims needed correcting before they were safe to act on, and item 5's
stated cause was REFUTED outright.** Read each item's **Check**, not its **Claim** — the Claims are
recorded as received and several are wrong in ways that would have sent a fix at the wrong thing.

**What is left, and it is all someone else's to land:**

```
PegTracker   5 handoffs at status: ready, all uncommitted (their commit = adoption)
riskAnalyst  owes the sUSDat surplus_deficit_basis "~97%" vs off_chain_pct 99.0% adjudication
```

⚠️ **The one open QUESTION that changes a rendered number:** whether CoinGecko's STRCx cross-chain
aggregate is on the scaled or pre-scaled basis. It decides which of two upstream figures is wrong
— `total_supply_usd` (item 10) or the 629,032 unlocatable residual (item 11) — and it cannot be
answered from this repo. Handoff filed.

## What this backlog was actually about

Almost none of it was arithmetic. **Eleven of the fifteen were a number rendered without its basis,
or a basis asserted that the data did not support:**

```
· a verdict the producer had already published, joined to nothing        12, 13
· a closed name list applied to rollups that carry the real field        14
· two correct measurements sharing one label                             15, 10
· a hardcoded metadata string contradicting the data beside it           5
· a claim inherited from an asset where it was TRUE                      8
· a qualifier that existed only on hover                                 7
· a stale list read as complete, then an over-retraction on top of it    9
· a measurement present in the feed and rendered nowhere                 3, 4
· one numerator over three denominators, none of them named              6
· a residual presented as an observation                                 11
```

## What a fresh session needs to know

⚠️ **Verify every claim in this file before acting on it — including the ones marked confirmed.**
The Check sections name the command or file that settled each one; re-run rather than trust. This
estate has repeatedly shipped defects by acting on plausible claims, including from peer sessions
and including my own.

**House rules that apply to this work** (all learned the hard way, all in `specs/six-axis-dashboard-spec.md`):

```
· render the page and READ it — a DOM query scoped to what you changed cannot see what you didn't
· a wrong number is worse than a declared absence; absences are renderable
· prefer the published field — ONCE you have established it measures the same thing (read the producer)
· two figures shown together must be consistent BY CONSTRUCTION, not by re-checking
· measure the blast radius before touching a shared component
· a defect report needs two measurements: what is inconsistent, AND who depends on it
· serve on a NEW PORT to verify — dataUrl() buckets its cache-buster by the hour
· a patch script that dies mid-way may have written NOTHING; re-grep each intended change
```

**Peers, and how to reach them** (`ListAgents`, then `SendMessage`):

```
riskanalyst - reports update   axis scores, issuer/contract overlays, the reports
tidr                           tidresearch.com — EMBEDS our dashboards in reports
securty analyst                axis 5 topology walks
pegtracker-f9                  the analyzers; file-based handoffs to ~/PegTracker/handoffs/inbox/
```

⚠️ **A peer's agreement is not authorisation.** Adoption decisions stay with whoever owns the repo.
⚠️ **Handoffs: write the file, do NOT commit it** — the owner's commit is the adoption.

---

# How this file works

⚠️ **Every claim below is the analyst's, recorded as received.** None is verified until its
**Check** section says so, with the command or file that settled it. This session has repeatedly
shipped defects by acting on a plausible claim — including my own — so the rule is:
**read the producer, render the page, then act.**

Each item carries: **Claim** (as received) · **Check** (what I found) · **Plan** · **Status**.

Status values: `unverified` · `confirmed` · `partly confirmed` · `refuted` · `fixed` · `deferred`.

---

# Triage

⚠️ **Not in list order.** S1 is wrong data presented as fact on a live page with red flags
attached, on 40% of a $930M book. The math errors (S3, S4) are next because they are visibly
self-contradicting. Everything else is a gap or a framing problem.

```
S1  syrupUSDC collateral column corrupt          items 12, 13   ✅ FIXED 2026-09-14
S2  syrupUSDC Liquidity Layer math               item 14        ✅ FIXED 2026-09-14
S3  syrupUSDC free liquidity: 3 values           item 15        ✅ FIXED 2026-09-14
S4  apxUSD slippage measured against $1.00       item 5         ⚠️ CAUSE REFUTED · fixed 2026-09-14
S5  sUSDat NAV monotonicity claim is wrong       item 8         ✅ FIXED 2026-09-14
S6  sUSDat backing tile hides its own caveat     item 7         ✅ FIXED 2026-09-14
S7  Wolf table self-contradiction                item 9         ✅ FIXED 2026-09-14
S8  liquidity venues missing / not wired         items 1, 2, 3  ✅ 3 FIXED · 1 partial · 2 upstream
S9  apyUSD <-> sUSDat link absent from deps      item 4         ✅ FIXED 2026-09-14 (via shared upstream)
S10 apxUSD reserve denominator (POL in/out)      item 6         ✅ FIXED 2026-09-14
S11 STRCx supply basis + unlocatable supply      items 10, 11   ✅ FIXED 2026-09-14
```

---

## 1 · apxUSD — primary exit understated

**Claim.** Panel says *"primary exit ~$5,749 across 1 pool."* There is a Uniswap V4 apxUSD/USDC
pool doing **$220K/day**, and **100% of Kyber quotes routed through it**. Real capacity is
**over $100K at under 10bps**.

**Check.** ✅ **CONFIRMED from our own feed — and the contradiction is now visible on one page.**

```
liquidity.pools   apxUSD/USDC Curve  depth_usd 5,748    ← only direct-exit venue enumerated
exit_mark.quotes  apxUSD→USDC $100,000 filled ~1-2 bps  ← same file, same run
```

A $100K fill at ~1 bp cannot come out of $5.7K of depth. ⚠️ **Until item 5's fix the ladder was
rendering as "No exit-mark RFQ ladder in this snapshot", so nothing on the page exposed it** — the
dashboard presented *"primary exit ~$5,749 across 1 pool"* as the asset's exit capacity with its
own refutation sitting unrendered in the feed.

⚠️ **The analyst's UniV4 venue is NOT confirmable in-repo** — no feed we hold names it. Not
rendered; the page says the venue "is not identified in our feed" rather than naming one.

**Built.** ✅ A computed note under the Primary-exit subtotal, derived from the two rendered
figures and shown only while the gap exists:

> *"ⓘ **This subtotal and the exit ladder on this page disagree.** The enumerated apxUSD→USDC
> venues total $5.7K, while the KyberSwap ladder above quotes a filled $100.0K at 2.1 bps.
> **A router that quotes a fill is the harder evidence**, so treat this list as incomplete rather
> than the ladder as optimistic…"*

**Status.** confirmed · **renderer part FIXED** · enumeration is upstream —
`apyx-pool-enumeration-misses-the-routed-venue-2026-09-14`



## 2 · apyUSD — dominant venue missing from the pool list

**Claim.** UniV4 **apyUSD/apxUSD** is the dominant venue (**~76% of volume, ~$299K/day**) and is
not in the pool list.

**Check.** ⚠️ **PARTLY CONFIRMED — the absence is real, the venue is not confirmable here.**
`apyusd_backing.json` `liquidity.pools` carries Curve + PancakeSwap apyUSD/apxUSD and nothing else.
Whether UniV4 is the dominant venue at ~76% of volume is **not answerable from any feed we hold**,
and 24h volume is `null` fleet-wide on these two assets, so we cannot even state a denominator.

⚠️ **Not rendered as a finding.** Same reasoning as item 1: naming a venue we cannot see is the
[[feedback-do-not-invent-facts-in-user-facing-copy]] trap.

**Plan.** Upstream, in the same handoff as item 1. The clean fix is to enumerate pools **from the
route the KyberSwap quote returns**, so the pool list and the ladder can never disagree again.

**Status.** partly confirmed · deferred to upstream



## 3 · STRCx — liquidity axis n/a on every field

**Claim.** Every field reads `n/a`. Actual: **$354K Jupiter depth, $2.4M/day, Kraken listed** —
deepest of the four. ⚠️ **`jupiter_liquidity_usd` is already in `strc_backing.json`, just not
wired to the axis.**

**Check.** ✅ **CONFIRMED — every field read `n/a` while a measurement sat in the feed.**
`strc_backing.json` publishes **no `liquidity` block at all**; the one venue figure,
`wrapper_strcx.jupiter_liquidity_usd` (**$442,632**, the analyst's $354K has moved), appeared only
inside a prose sentence that ends *"Exit depth is scored on axis 3, on its own measurement"* —
pointing the reader at an empty panel.

⚠️ **Read the producer before wiring it.** `strc_backing_analyzer.py` takes it from Jupiter's
price-v3 `liquidity` field: **pool liquidity on the Solana float.** It is NOT a 2% depth, NOT a 24h
volume and NOT an exit ladder. ⚠️ **The analyst's "$2.4M/day, Kraken listed" are in no feed we
hold** — wiring those would be inventing them.

**Built.** ✅ `strcx.js` `preRender` fills **Pool TVL only** ($442.6K) with a note naming the
source, leaving the other three as the declared absences they are.

⚠️⚠️ **TWO TRAPS, BOTH CAUGHT BY RENDERING RATHER THAN READING.**
**(a)** The first guard read `if (!data.liquidity)` and **never fired** — `mergeAxisOverlays` runs
BEFORE `preRender` (app.js:351) and has already built `data.liquidity` from the axis-basis overlay.
⚠️ **My standalone test passed** because fetching the raw JSON and calling `preRender` on it skips
the merge entirely. **A test that bypasses the pipeline only tells you about the pipeline it
bypassed.** Now fills a gap and never replaces, so the overlay's authored score survives.
**(b)** My first instrumentation reported *"liquidity seen by section: null"* and I nearly chased
that — the variable was simply **never assigned**, because `hasAxisBlocks` had returned false in
that contrived object. **A probe's initial value can masquerade as its finding.**

✅ Verified the axis score is untouched: `liquidityRating` reads `total_2pct_depth`, never
`total_tvl`, so the head still reads riskAnalyst's **Authored 2.5/10** rather than inventing a
measured band.

**Status.** confirmed · **FIXED**



## 4 · Missing link — apyUSD <-> sUSDat pools not in any Dependencies panel

**Claim.** Live UniV4 **apyUSD/sUSDat** pools (**~$21.5K/day**). A direct price link between the
Apyx and Saturn stacks, and contagion-relevant: **apyUSD holders can be the ones who drain
sUSDat's $36K ceiling.** Absent from both Dependencies panels.

**Check.** ⚠️ **The ABSENCE is confirmed. The VENUE is not confirmable here, and a much larger link
is — one that was already measured and rendered on exactly one page.**

**What is true:** neither panel names the other. All four Apyx/Saturn feeds carry
`downstream: []` and `downstream_tracked: false`.

⚠️ **What I could not confirm:** no `apyUSD/sUSDat` pool exists in ANY feed we hold — grepping every
`"pair"` across `data/` returns only `apyUSD/apxUSD`. The **$21.5K/day** and the **$36K ceiling**
are likewise absent; sUSDat's published figures are `total_tvl` **$63,292** and a 2% depth
**bracketed between $10K and $100K**. ⚠️ **Third unconfirmable UniV4 claim in this backlog**
(items 1, 2, 4) — all plausible, none in our data. Not rendered.

✅ **What IS measured, and is a bigger channel than a DEX pool:** `strc_backing.json`
`downstream_exposure` quantifies both stacks against the same collateral —

```
apyx    $170.2M STRC   54.8% of its reserves   attested
saturn  $ 70.4M STRC   99.0% of its reserves   oracle-marked, unverified
                       combined $240.6M
```

⚠️ **$240.6M of shared collateral versus a $21.5K/day pool.** The analyst reached for a *price*
transmission channel; the *value* channel is four orders of magnitude larger, published, and
**rendered on exactly one page — the STRC dashboard, which a reader of these two is least likely
to be on.**

**Built.** ✅ `common.js` `loadCommonModeExposure` adds a **"Shared upstream — who else holds this
collateral"** table to the Dependencies panel, marking which row is the page you are on:

> *"STRC is not this asset's exposure alone. A move in the STRC mark reaches every stack below at
> once, so these are correlated by construction rather than independent — and a stress on one is
> not diversified by the other."*

⚠️ **Keyed on the dependency rows the page ALREADY renders** (any upstream linking to
`?asset=strc`), not on a slug list — it extends itself if another asset starts naming the same
upstream. Verified silent on USG, **including no wasted fetch** (0 requests for
`strc_backing.json` on a non-family page).

⚠️ **Deliberately one-hop.** apyUSD's direct upstream is apxUSD, so apyUSD does NOT get the table —
its STRC exposure is inherited, and the panel answers *"what this asset depends on."* The table
renders on apxUSD, one click away through the row apyUSD already shows. Two-hop traversal would
mean fetching every intermediate on every page to discover a link that is one click away.

**Status.** ⚠️ **absence confirmed · venue unconfirmable (not rendered) · a larger measured link
FIXED**

## 5 · apxUSD — slippage measured against $1.00 while the peg panel says 0.9770

**Claim.** `fair_value` is null with basis `par_fallback`, so slippage is measured against
**$1.00** — while the Peg panel on the same screen says **0.9770**. A reader sees
*"+0.02% slippage at 100K"* beside *"-2.30% peg"* and cannot reconcile them.

**Check.** ⚠️ **THE STATED CAUSE IS REFUTED. The symptom was real but not on this asset, and the
field the analyst cited is itself wrong.** Three separate findings — take them in order.

**(a) apxUSD's ladder is NOT measured against $1.00.** The arithmetic settles it without needing
the producer. `quote_pair` sets `amount_in = size_usd / fair_value_usd_per_in`, so the implied
execution price is `output_usd ÷ amount_in`:

```
size      output_usd    if measured vs MARKET (0.976908)   if measured vs PAR ($1.00)
$1,000     1,000.00     implied 0.976908  ← the peg mark   implied 1.000000
$100,000  99,990.86     implied 0.976819  (−0.9 bps)       implied 0.999909
```

⚠️ **Under the par hypothesis apxUSD would have to trade at exactly $1.000000 on-chain**, while
the peg tracker's own `market_price_source: "kyberswap_rfq"` says 0.976909 and its
`market_price_reference_coingecko` cross-check says 0.977661 — **two independent sources, 8 bps
apart.** The market hypothesis requires only one hardcoded metadata field to be wrong.

✅ **And the producer says so itself.** `derive_liquidity_score_apyx`'s docstring:
*"apxUSD is quoted against its live MARKET mark (executable exit ≈ smallest-tier price)."*

**(b) ⚠️ SO WHY DOES THE FEED SAY `par_fallback`? BECAUSE IT IS HARDCODED.**
`apyx_backing_analyzer.py:3486-3487` publishes `"fair_value": None, "fair_value_basis":
"par_fallback"` as literals, while the sibling apyUSD block six lines later publishes the real
values. The quote code above it branches correctly on `apxusd_mark_valid` and passes
`fair_value_basis="market"` — **that branch's result is then overwritten by the literal.**

⚠️ **The analyst did nothing wrong: they read a published field and reported what it said. The
field is a lie about the data next to it.** This is the *"stated reasons are claims"* pattern in
its purest form — a wrong explanation that closes the question, shipped in the feed.

**(c) The symptom the claim describes is real — on apyUSD, with a different cause.** The
*"Max ≤25 bps"* card and the ladder beneath it are measured differently:

```
card    Max ≤25 bps  $100.0K     ← max_under_25 reads MARGINAL bps (raw − baseline)
ladder  $100K rung   193.3 bps   ← prints RAW
        193.3 − 173.5 = 19.8 bps marginal, which IS under 25. Both figures correct.
```

⚠️ **Nothing on the page said they were different measures**, so the card and the table under it
read as a contradiction — exactly the *"cannot reconcile them"* the claim describes.

**(d) ⚠️ AND THE LADDER WAS NOT RENDERING AT ALL — a FALSE ABSENCE, fleet-wide in shape.**
`common.js` scanned `exit_mark.quotes` for numeric size keys. Seven feeds key on size directly;
**the two apyx feeds key on the PAIR first** (`{"apxUSD_to_USDC": {"1000": …}}`), so the scan found
nothing and the page printed **"No exit-mark RFQ ladder in this snapshot"** over a complete
four-rung ladder — *while showing "Max ≤25 bps $100.0K" beside it, derived from the very quotes it
called absent.* The apyx feeds also publish `slippage_pct` where the other seven publish
`slippage_bps`, so every downstream bps comparison would have graded 1.93 as 1.93 bps, not 193.

**Built.** ✅ `js/renderers/common.js`:

```
_unwrapLadderQuotes()   unwrap ONE level when the top holds exactly one pair of sizes
_ladderRungBps()        slippage_bps, else slippage_pct × 100 — normalise on read
_ladderBaselineBps()    smallest rung = the producer's own depth_baseline_bps
```

apxUSD now renders `0.0 / 0.7 / ⚠ quote failed / 0.9 bps`; apyUSD renders its rungs with a note
that they are denominated in **apxUSD, not USD** (it is an ERC-4626 vault over apxUSD, so its NAV
is apxUSD-per-share and BOTH legs are apxUSD — the ratio is consistent, only `output_usd` is a
misnomer). The 25bps card now carries **"marginal basis · 174 bps baseline held out"**, shown only
where the baseline is material so the ~26 near-zero-baseline assets are untouched.

⚠️ **A CORRECTION I MADE MID-BUILD, recorded because the first answer was confident and wrong.**
I read apyUSD's ladder as mixed-basis — size divided by NAV, proceeds valued at $1.00 while apxUSD
marks at 0.977 — and **built a block that WITHHELD the ladder as "not an exit cost on either
basis."** Then I read `apyusd_nav = nav_raw / 10**APXUSD_DEC`, printed by the analyzer as
`apyUSD NAV: … apxUSD/share`. **Both legs are apxUSD. The ladder was right and I was about to
suppress it.** Reverted before it shipped; the near-miss is in the code comment.

**Blast radius.** 7 flat feeds verified untouched by construction (numeric keys → unwrap is a
no-op; `slippage_bps` present → normaliser passes it through) and by render: USG unchanged at
`0.0 / −0.0 / −0.2 … −416.3 bps`, no unit note, no basis note. ⚠️ The at-par test also had to be
hardened — an `every()` over all rungs meant one `http_503` on apxUSD's $50K rung switched the
whole guard off.

**Plan.** Handoff filed for (b) and the shape/unit divergence in (d). Nothing further here.

**Status.** ⚠️ **cause REFUTED · symptom confirmed on apyUSD · two renderer defects FIXED** ·
handoff written to `~/PegTracker/handoffs/inbox/apyx-fair-value-basis-hardcoded-2026-09-14.md`

## 6 · apxUSD — reserve denominator includes POL

**Claim.** Shows **STRC at 67.8%** by counting **$53.9M of POL** as a reserve asset. Accountable's
own dashboard says **86.3%** excluding it. ⚠️ **Both defensible.**

**Check.** ✅ **CONFIRMED — and BOTH of the analyst's figures reproduce to the cent from our own
feed.** The same $170.2M STRC position over three denominators:

```
everything in                310,305,302   54.83%   reserves_split_pct
ex-Inventory                 251,049,483   67.78%   reserves_split_pct_ex_inventory  ← what we show
ex-Inventory, ex-POL         197,158,624   86.30%   ← the analyst's Accountable figure
```

The table already names its own basis (*"Net backing (ex-Inventory)"* = 100.00%) and POL carries a
*"⟳ reflexive"* badge. ⚠️ **What was missing is the third denominator** — a reader comparing this
page to the issuer's sees 67.8% vs 86.3% with no way to reconcile them.

**Built.** ✅ A note under the reserves table giving all three, computed from published fields:

> *"**STRC concentration depends on what counts as a reserve.** The same $170.2M position reads
> 54.83% of gross reserves, 67.78% of net backing (the basis used in the table above), and 86.30%
> if Protocol Owned Liquidity is excluded as well. POL is real USDC, but it is deployed against
> Apyx's own assets — whether that dilutes a concentration measure is a judgement, not a
> calculation… **All three are the same numerator over three denominators**, so a gap between
> surfaces is a basis difference, not a disagreement about the position."*

⚠️ **Nothing is attributed to Accountable's dashboard** — that is a surface this repo cannot read
(same rule that kept UniV4 off the page in items 1, 2, 4).

**Status.** confirmed · **FIXED** (the analyst's "both defensible" is right; the page now says so)

## 7 · sUSDat — headline tile hides what its own basis says

**Claim.** *"BACKING 102.56%"* is the biggest number on the page and **99% of what is behind it is
oracle-unverified.** The basis note says so; the tile does not. Suggested: a badge on the tile —
**102.56% / 1% verifiable**.

**Check.** ✅ **CONFIRMED in substance, with one correction: the tile DOES carry the caveat — in a
`title` attribute.** Read off the live DOM, the Backing tile's value span holds the producer's
`collateral_ratio_basis` verbatim:

> *"ATTESTED, NOT MEASURED: 99.0% of the reserve is an OFF-CHAIN STRC claim marked by oracle
> (breakdown tags it `oracle_unverified`); only 1.0% is on-chain USDat this repo can verify."*

⚠️ **So this is not an absent qualifier, it is a hover-only one — which is worse than it sounds.**
A `title` does not exist on touch, does not appear in a screenshot, is not in the text a reader
skims, and **is invisible in tidr's embeds of these dashboards.** The visible tile read
`102.57% · surplus +$1.8M · Watch 6/10` — three reassuring figures with the disqualifier one
hover away.

The data was fully published and only partly rendered: `on_chain_pct: 1.0`, `off_chain_pct: 99.0`,
and per-item `detail.verifiable` of `onchain` / `oracle_unverified`.

**Built.** ✅ `_backingSubText` in `common.js` now appends `· 1.0% on-chain verifiable`, following
the existing `supply_scope` precedent in the same function. Tile now reads:

```
Backing  102.57% ⓘ  surplus +$1.8M · 1.0% on-chain verifiable   Watch · 6/10
```

⚠️ **Keyed on the PUBLISHED `on_chain_pct` / `off_chain_pct`, not on a name list** — it appears for
any feed that starts declaring them and stays absent for the ~20 that do not. Measured: **sUSDat is
the only asset publishing them today**, so blast radius is one page. Verified on USDat (same
renderer family): tile unchanged at `surplus +$0 · ethereum-only scope`.

⚠️ **One inconsistency left for upstream, not worth a render change:** `surplus_deficit_basis`
prose says *"~97% of the reserve"* while `off_chain_pct` and the breakdown both say **99.0%**.

**Status.** confirmed with a correction · **FIXED**

## 8 · sUSDat — the NAV monotonicity claim is false

**Claim.** Panel states *"NAV must monotonically rise under ERC-4626 vesting; a drop implies an
STRC loss event."* NAV **declined on 9 hourly observations this week**, several around **-10bps**.
Analyst checked one: **10 Sep 09:44 -> 10:43** — `share_supply` and `onchain_buffer_usd` both
unchanged, `total_assets` **-$75,836**, entirely in `offchain_strc_usd_implied`. ⚠️ **So it is
neither a loss event nor vesting — NAV is mark-to-market on an oracle-marked claim.**

**Check.** ✅ **CONFIRMED, to the cent, and the real count is far worse than "9 this week."**
The analyst's specific observation reproduces exactly:

```
10 Sep 09:44 -> 10:43
  share_supply               72,088,708.039867 -> 72,088,708.039867   UNCHANGED
  onchain_buffer_usd          2,542,834.04     ->  2,542,834.04       UNCHANGED
  total_assets_usd           73,394,842.99     -> 73,319,006.89        -75,836.10
  offchain_strc_usd_implied  70,852,008.95     -> 70,776,172.85        -75,836.10  ← all of it
```

**Across the full 30-day history: 48 declines in 659 transitions (7.3%)**, median −10.0 bps,
largest −73.4 bps. ⚠️ **`offchain_strc_usd_implied` moved in 48 of 48.** On the panel's own logic
that is **48 STRC loss events in a month** — while NAV is **+4.91% net** over the same window.

⚠️⚠️ **AND THE DECISIVE CONTRAST: the same sentence is TRUE for its sibling.** `usdai.js:1054`
says *"NAV should rise monotonically as loan interest accrues — a drop between cycles is a
loan-loss signal."* Measured on sUSDai: **0 declines in 743 observations.** Its assets accrue loan
interest with no mark-to-market leg, so monotonicity holds by construction.

**So the wording was carried from an asset where it is true to one where it cannot be**, because
sUSDat's reserve is ~99% an oracle-marked off-chain claim. ⚠️ **This is item 13's pattern inverted
— not a rule inheriting a bug's scope, but a rule inheriting a scope where it was CORRECT.**
⚠️ **Do not "re-sync" these two paragraphs: `usdai.js` is right as written.** A comment in
`saturn.js` now says so, because the next person to notice they differ will be tempted.

**Built.** ✅ `saturn.js`. The claim is replaced by what the data supports, and the evidence is
computed in `_drawSusdatNavChart` from the **same windowed array the chart plots** — so the
sentence and the line above it cannot disagree, and no count can go stale:

> *"NAV is not monotonic here, and a decline does not imply a loss event. ~99% of the reserve is an
> off-chain STRC claim carried at an oracle mark, so NAV is marked to that price between cycles and
> falls whenever the mark falls. **Over the 659 transitions plotted above, 48 are declines (median
> −10.0 bps, largest −73.4 bps) while NAV is +4.91% net across the window.** Vesting sets the
> upward drift; the mark sets the noise around it — read a decline by size and persistence, not by
> direction, because a single hourly tick is ordinary mark movement."*

✅ The injected figures were computed independently in JS and match the Python analysis exactly.

**Status.** confirmed · **FIXED**

## 9 · Wolf & Co table contradicts itself

**Claim.** Table shows **April 2026** as latest, badged **"Stale 119d."** Apyx docs publish
**March through July 2026**, and our own **Issuer axis text says "published through July 2026."**
Real gap is **~45 days**.

**Check.** ✅ **CONFIRMED, and it is the worst kind of wrong number: an accusation about a named
audit firm and issuer, derived from our own stale file.**

`data/apyx_wolf_attestations.json` holds **two reports — March and April 2026.** The renderer
computes the pill from the newest row's `signed_date` (2026-05-18), which on 2026-09-14 is
**119 days**, and prints **"Stale — 119d since April 2026."** The arithmetic is right; the premise
is not.

⚠️ **The file is MANUALLY MAINTAINED IN THIS REPO** — not synced from PegTracker, absent from the
sync allowlist, committed exactly once (`0a9851c3a`) from a riskAnalyst handoff dated 2026-05-20
covering March + April. **It was never extended.**

Three in-repo places say otherwise, all sourced to primary documents:

```
apxusd_issuer.json / apyusd_issuer.json structure[]
  "March, April, May, June and July 2026 opinions all published; July signed
   2026-08-12, an ~12-day lag, so the cadence is current and August is not yet late."
apxusd_issuer.json summary_source
  "the Wolf & Company July 2026 opinion and its attached Monthly Securities Balance
   Attestation ... [verified 2026-09-10]"
apyx.js:990  references "both 7/20 and 7/31 in Apyx's July 2026 Wolf attestation"
```

⚠️ **The two files do not actually contradict each other — the RENDERER invented the conflict.**
The attestation JSON never claimed to be complete; it is a list. The renderer inferred *"latest
published"* from *"latest enumerated"* and printed the difference as a finding about someone
else's conduct. **A second inferred claim rode along:** *"The largest reserve component (Cash &
Equivalents) has no CPA-firm coverage for any date after 2026-03-31"* — an assertion about
examinations we had not looked at.

⚠️ **This is the [[feedback-do-not-invent-facts-in-user-facing-copy]] rule's exact subject matter**
— attestation cadences and audit firms — reached this time not by writing an unsourced sentence but
by letting a stale file speak as a current one.

**Built.** ✅ The file now declares its own scope, and the renderer respects it:

```json
"enumeration": {
  "complete_through": "2026-04", "known_published_through": "2026-07",
  "is_complete_record": false, "known_published_source": "<citation to the issuer axis>",
  "note": "THIS FILE IS A PARTIAL RECORD AND IS MANUALLY MAINTAINED ... Do not read the
           newest row as the issuer's latest examination ..." }
```

Pill: `Stale — 119d since April 2026` → **`Partial record — published through July 2026`**.
The scope-regression warning now stops at what is established. And a **visible** notice — not a
tooltip, because these dashboards are embedded elsewhere:

> *"ⓘ **Partial record.** This table lists the opinions enumerated in the dashboard's own static
> file (complete through April 2026), which is maintained by hand and is not a feed. **Wolf &
> Company opinions are published through July 2026** and the later ones are not listed here. The
> absence of a row is a gap in this file — it is not evidence that an examination was missed."*

⚠️ **Deliberately NOT done: I did not add May/June/July rows.** I do not hold those PDFs, and
inventing balances, signed dates or scope pills for an audit firm's opinions is precisely what the
house rule forbids. A real lapse still pages — `is_complete_record: true` restores the staleness
verdict.

**⚠️ FOLLOW-UP, SAME DAY — riskAnalyst supplied the reports AND corrected me. I OVER-RETRACTED.**

I pulled two claims off that panel. **Only one of them was false.**

```
"Stale — 119d since April 2026"                          FALSE  — Mar..Jul all published
"Cash & Equivalents has no CPA-firm coverage for any
 date after 2026-03-31"                                  ⚠️ TRUE — and still true
```

⚠️ **April, May, June AND July are all `securities_only`**, each carrying the identical criteria
clause *"limited to … Marketable Preferred Equity Securities (STRC, SATA) / On-Chain Tokenized
Securities (STRCx)"*. Cash, stablecoin and dividends-in-motion appear in March and in nothing
after. **My conservative render was suppressing a true and continuing finding about ~43.6% of the
reserve — the cost of over-correcting is a silence that reads as an all-clear.**

⚠️ **The two claims rested on DIFFERENT evidence and I retracted the second on the first one's
momentum.** Finding one error in a panel is not evidence about its neighbours.

⚠️ **One premise of mine was also wrong:** I said riskAnalyst "hold the PDFs". They did not — their
2026-09-10 note came from the docs page with only July transcribed. **They fetched and read all
five today.**

**Built (second pass).** ✅ All five reports now in the file, `is_complete_record: true`. Pill:
`Partial record` → **`Latest: July 2026`** (signed 2026-08-12, 33 days — correctly not stale). The
scope-regression warning is restored and **derived from the `scope` fields** rather than asserted,
so it retires itself when a full-scope report lands:

> *"⚠ Scope regression: narrowed to securities only in April 2026 … and **every examination since
> has kept that scope (4 consecutive reports through July 2026)**. The largest reserve component
> (Cash & Equivalents) has no CPA-firm coverage for any date after 2026-03-31. **SATA has been
> examined at $0 since 2026-06-17**, so the examined securities leg is now STRC plus its own
> on-chain wrapper (STRCx) and nothing else — a single-issuer leg."*

⚠️⚠️ **AND FILLING IN THE DATA WOULD HAVE SILENTLY DROPPED THE WARNING.** The guard read
`reports[1].scope === 'full_balance'` — true only while April and March were the whole file. With
May/June/July added, `reports[1]` became securities-only and the block stopped rendering. **Adding
correct data would have retired a live finding as a side effect.** Caught by rendering the page,
not by reading the diff. A regression is *"latest is narrow and some earlier report was wide"*, not
*"the last two rows differ"*.

**Still open (riskAnalyst's notes, not built):** the opinion letter says *"Monthly **Asset** Balance
Attestation Report"* while the attached document is the *"Monthly **Securities** Balance
Attestation"* — **in all four post-March reports**, not the July one-off their report records. They
suggest `opinion_letter_title` / `report_title` fields rather than one `scope` string. Left for
when it changes a rendered label.

**Status.** confirmed · **FIXED** (the false verdict removed; the enumeration gap stays declared
until riskAnalyst supplies the reports)

## 10 · STRCx — supply basis differs from CoinGecko

**Claim.** We show **$297.2M on total supply**; CoinGecko shows **$155.3M on 1.462M circulating**
— looks like CG nets out the custodial addresses.

**Check.** ✅ **CONFIRMED, and investigating it surfaced a worse defect the claim does not
mention: our own $ figure mixes two price bases.**

The supply-basis gap is real (2.817M total vs CG's 1.462M circulating). ⚠️ **But
`total_supply_usd` is computed at CoinGecko's PRE-SCALED price while the page's headline mark is
the multiplier-adjusted one:**

```
strc_backing_analyzer.py:2270   total_supply_usd = total_supply_all_chains * cg_price_usd
  2,817,125 x $105.55 (pre-scaled)  = $297,347,509   ← published, and shown as the headline
  2,817,125 x $ 98.38 (the mark)    = $277,159,712
                               gap  = $20.2M / 7.3% = exactly the multiplier
```

⚠️⚠️ **The tile read "≈ $297.3M at the current mark" — and that is not the current mark.** This
file's own mark-card comment says the CoinGecko price *"overstates by ~the multiplier"* and is
*"shown as a labeled reference only, never the headline mark"*. **The supply tile used it as the
headline anyway.** The token count is on the scaled basis (Ethereum's leg is an on-chain
`totalSupply()` call), so the mark is the consistent pairing.

**Built.** ✅ Valued at the mark — *"≈ $277.2M at the $98.38 mark"* — with a note naming both
figures and what would overturn the choice. ⚠️ **The first pass fixed ONE of the two sites** and
left the sibling panel showing $297.3M, so the page briefly carried both. Caught by grepping the
rendered DOM for `$297`, not by reading the diff. Now 4 consistent occurrences of $277.2M and
exactly one `$297.3M` — inside the note that explains it.

⚠️ **NOT resolved, and it cannot be from here:** whether CoinGecko's cross-chain aggregate is
itself scaled. That single question decides which of two upstream figures is wrong — see item 11.

**Status.** confirmed · **FIXED** · basis question raised upstream



## 11 · STRCx — unlocatable supply is a basis note, not a flag

**Claim.** **629,032 STRCx (22.3%, ~$62M)** on chains with no registered contract sits in a basis
note rather than a top-line flag.

**Check.** ✅ **CONFIRMED exactly** — 629,032.4322 STRCx = **22.33%** of supply = **$61.9M** at the
mark, and it was a clause in a paragraph on a page whose Risk Flags panel reads *"No risk flags"*.

**Built.** ✅ Promoted to a visible amber callout. ⚠️ **NOT injected into `data.risk_flags`** —
that would dress a renderer's inference as a producer's finding.

⚠️ **And the callout says what the number IS, which the original prose did not:**

> *"629,032 STRCx (22.3% of supply, $61.9M at the mark) cannot be located on any chain this
> dashboard can read. **It is a residual, not an observation** — CoinGecko's cross-chain aggregate
> minus the Ethereum and Solana supplies read directly. Arbitrum, BNB and Mantle have no registered
> contract address… ⚠️ **A residual also absorbs any basis mismatch** between the aggregate and the
> on-chain counts, so it is an upper bound on what is genuinely elsewhere."*

⚠️⚠️ **THE TWO UPSTREAM READINGS ARE MUTUALLY EXCLUSIVE**, and this is the finding worth carrying:

```
CG aggregate is SCALED      -> total_supply_usd is overstated by the multiplier   (item 10)
CG aggregate is PRE-SCALED  -> this 629,032 residual is inflated by a basis mismatch
```

`other_chains_implied = cg_total_supply - known_supply` subtracts an on-chain (scaled) sum from the
CG aggregate. **One of those two figures is wrong and the same unanswered question decides which.**
Handoff filed asking PegTracker to settle it and publish the basis.

**Status.** confirmed · **FIXED** · the underlying basis question is upstream

## 12 · syrupUSDC — collateral column is corrupt and shown as fact ⚠️ TOP PRIORITY

**Claim.** **10 loans ($373M, 40% of book)** read under 100% collateralised, **four under 8%**.
Maple's own front end shows the same loans at **123-206%**. The **$200M** loan reads **62.16%** on
TID vs **188.1%** on Maple. The **25M** loans read **7.69%** vs **129.8%**. There is a footnote,
but ⚠️ **the table still prints red flags**, and **"Buffer health / distance to par"** plus
**"Tightest loan: $6.5M BTC @ 21.9%"** are all computed off the bad values. That loan is
**201.6%** on Maple.

**Check.** ✅ **CONFIRMED, and the cause is not what anyone assumed.** Measured from
`data/syrupusdc_backing.json`:

```
11 loans below 100%: $372,550,005 of a $941,268,474 book = 39.6%
  $200,000,000   62.89%   init 143%    1,616.7734 BTC   chainlink   healthy
  $ 30,000,000   61.45%   init 125%      236.9727 BTC   chainlink   healthy
  $ 25,000,000    7.78%   init 125%       25.0000 BTC   chainlink   healthy   ×4 loans
  $ 20,000,000   61.59%   init 125%      158.3505 BTC   chainlink   healthy
  $ 10,000,000   96.00%   init 143%    3,809.5479 ETH   chainlink   healthy
  $  6,550,000   22.16%   init 167%       18.6610 BTC   chainlink   healthy
  $  6,000,000   40.63%   init 167%       31.3391 BTC   chainlink   healthy
  $          5   14.06%   init 100%        0.7028 USTB  peg_assumed healthy   (dust, at-par)
```

⚠️ **The ratio arithmetic is CORRECT** — `collateral.usd / principal` reproduces every figure
exactly. The wrong value is `collateral.amount`, upstream.

⚠️⚠️ **AND THE PRODUCER ALREADY KNOWS.** `syrupusdc_backing_analyzer.py` runs a corroboration gate:
a below-100 read only pages CRITICAL if the pool shows `unrealizedLosses > 0` **or** the loan is
impaired/called/defaulted. Its own comment: *"Uncorroborated below-100 reads are almost always
Maple GraphQL collateral-amount artifacts (currentAssetAmount understated while the pool is
clean)."* It emits an **info** flag, present in our feed right now:

> *"10 Set A loans ($373M, 39.6% of book) read below 100% collateralization in Maple GraphQL but
> are uncorroborated (unrealizedLosses=0, none impaired/called/defaulted) — likely collateral-amount
> data artifact; PCR authoritative"*

⚠️ **SO THIS IS A CONSUMER-SIDE DEFECT.** `syrupusdc.js` `_renderBufferCell` colours purely on
`buffer_pp < 0` and prints **`-80.1pp 🔴`** with title *"Below init level — delegate discretion to
call."* The analyzer graded 40% of the book unreliable; the page prints it as a finding. **Same
shape as the STRCx peg: the verdict is published and nothing joins it to the display.**

**The cross-check is genuinely independent**, which is why the artifact conclusion is safe:
`unrealizedLosses()` is read **on-chain from the pool contract**, not from Maple's API. Maple's own
front end is a third reading and shows these loans at 123–206%, so **Maple's UI and API disagree**
— the fault is in that API field, not in our pipeline.

**Reproduced the producer's rule from the feed and it matches to the dollar:** pool
`unrealized_losses == 0` · loan not impaired/called/in-default · Set A (not at-par) →
**10 loans, $372,550,000**, exactly the producer's flag.

**Plan.** ⚠️ **No heuristic needed — read the producer's verdict instead of re-deriving a colour.**

```
1  _renderBufferCell: consult corroboration before colouring. Uncorroborated below-100
   rows render as unverifiable WITH THE REASON, not as red distress. The number still
   shows — this is assert-vs-qualify, not hide-vs-show.
2  Exclude those rows from "Tightest loan" and "Buffer health / distance to par", which
   currently compute off artifact values. State how many were excluded.
3  Rewrite the footnote (syrupusdc.js ~line 1103) — see item 13.
4  PegTracker handoff: the per-loan record carries no artifact marker, so every consumer
   must reconstruct the rule. Ask them to stamp it on the loan. ALSO: the `usd_anomaly`
   threshold is `raw < required * 0.05`, tuned to the near-zero at-par case; the four
   $25M loans sit at ~6.2% of required and fall just outside it.
```

**Built.** ✅ `js/renderers/syrupusdc.js`. Three pieces, none of them a heuristic:

```
_collateralUncorroborated(loan, poolUL)   reconstructs the producer's gate per row
_bufferStatsExUncorroborated(lb, poolUL)  one filtered pass → tightest + wtd-avg + below-init
_renderBufferCell(coll, uncorroborated)   qualified cell, not red distress
```

⚠️ **The reconstruction is conservative**: an unknown or live `unrealizedLosses` leaves the read
asserted. Only a pool that actively contradicts its own loan rows gets the softer treatment.

What the page says now, read back from the DOM:

```
Tightest verifiable loan: $50.0M BTC @ 124.9% (init 125%, -0.1pp) — only 24.9pp above par
Figures above exclude the uncorroborated reads listed above, and are computed over the
16 corroborated reads ($524.7M).
$200.0M row:  BTC $125.8M  143%  62.9%  -80.1pp unverified      ← was  -80.1pp 🔴
```

⚠️ **The exclusion note deliberately carries no share-of-book percentage.** The producer already
publishes one on its risk flag (39.6% of book). A second denominator on the same page is the
defect this pass exists to remove — the first draft printed *"41.5% of the reads on this book"*
and was caught by reading the rendered page, not the diff.

**Blast radius — `syrupUSDT` uses the same renderer and has ZERO uncorroborated reads.** Verified
unchanged after the change: no `unverified` cells, no exclusion note, still *"Tightest loan"* (not
*"verifiable"*), still the producer's published `$40.0M BTC @ 126.0%`. ⚠️ **That is the check that
could have gone red** — a gate that fired on `poolUL == null` would have rewritten that pool too.

**Status.** confirmed · **FIXED** · handoff for step 4 written to
`~/PegTracker/handoffs/inbox/syrup-loan-artifact-marker-not-stamped-2026-09-14.md` (uncommitted)

## 13 · syrupUSDC — the stated root cause does not match the symptom

**Claim.** Footnote blames *"at-par stablecoin/RWA positions."* ⚠️ **All ten bad loans are
BTC-collateralised.** The wrong-to-right ratios are not constant (**3.0x, 2.0x, 16.9x**) so it is
not a decimal bug. Looks more like **returning collateral from only some wallets per loan** —
Maple lists **48 collateral wallets**.

**Check.** ✅ **CONFIRMED and stronger than stated.** The footnote at `syrupusdc.js:1103` reads
*"Maple GraphQL returns a broken `currentAssetAmount` for **at-par stablecoin/RWA positions**."*
Of the 11 affected loans: **9 BTC, 1 ETH, 1 USTB** — and the only at-par one is the **$5** dust
position. ⚠️ **The stated cause explains $5 of $372,550,005.**

⚠️ **One correction to the analyst:** they said all ten are BTC-collateralised. One is ETH
($10M, 3,809.55 ETH).

**Where the wrong cause came from:** the `usd_anomaly` detector in the analyzer was built for the
at-par case — its own comment says *"Observed on some at-par USTB/USDC loans"* — and the footnote
inherited that origin story. ⚠️ **This is the "a rule written at the site of the bug inherits that
bug's scope" pattern**, same as the sync script's missing-source comment. The detector's threshold
was tuned to near-zero readings; the crypto cases sit above it and pass through unflagged.

**⚠️ CORRECTION — the plan above was wrong, and so was my own Check.** *"Do not restate the at-par
explanation"* would have deleted a true sentence. Read the producer before rewriting:

```
$ python3 -c "...usd_source in ('data_anomaly','unavailable')..."
  data_anomaly  liquidity  USDC  at_par=True  cat=stablecoin   ×5
  data_anomaly  liquidity  PYUSD at_par=True  cat=stablecoin
```

**All six `data_anomaly` rows — the ONLY rows that carry the `?` glyph — are at-par
stablecoin/RWA positions.** The footnote sentence about them is accurate. The `?` marks rows where
Maple returns *no usable* value at all, and those really are the at-par sleeve.

⚠️ **So this was never one wrong sentence. It is two different failure modes and only one of them
was described.** The ten below-par reads are `usd_source: chainlink` and carry no `?` at all —
which is exactly why they rendered as confident red instead of as a data-quality caveat. **The
footnote did not misexplain them; it never mentioned them.**

**Built.** ✅ Kept the at-par sentence (tightened *"broken"* → *"no usable … leaving their cells
blank"*, which is what actually happens) and added the second mode. Generated from the live feed,
not hardcoded — it disappears entirely on a pool with no such reads, and the range cannot go stale:

> *"A second, distinct read fails the other way: on **10 loans** ($372.6M, collateralised in
> BTC/ETH) Maple GraphQL returns an understated `currentAssetAmount`, so the loan prices below par
> while nothing else about it is distressed — it is not impaired, called or in default, and the
> pool's own on-chain `unrealizedLosses` is 0. The understatement is not a constant factor
> (roughly **1.5× to 16.1×** against each loan's funding-time init level), so it is not a
> decimal-scale error. Those cells read `unverified` in the loan table and are excluded from the
> buffer-health figures; the number is shown, not asserted."*

⚠️ **The factor range is computed against OUR OWN feed (init ÷ current), not against Maple's front
end.** The analyst's 3.0×/2.0×/16.9× came from comparing to Maple's UI, which this session cannot
read. Same conclusion — not constant, therefore not a decimal error — reached from a source that
is in the repo.

**Status.** confirmed with a correction · **FIXED**

## 14 · syrupUSDC — Liquidity Layer, two visible math errors

**Claim.** Parked reserve header says **$25.0M** but the only row under it is **PYUSD $1.5K** —
the **$25M WBTC position never renders**. *"Top asset WBTC 131.6% of layer"* — **over 100%**: it
divides $25M WBTC by a **$19.0M total that excludes the WBTC**. Should be **~57%**. Same bug in
the cross-pool liquidity table: **89.3 + 32.4 + 10.7 = 132%**.

**Check.** ✅ **CONFIRMED — all three symptoms, and they are ONE bug with one line behind it.**

```js
_isLoanAsset: function(asset) {
    return ['BTC', 'cbBTC', 'ETH', 'XRP', 'HYPE'].indexOf(asset) >= 0;   // WBTC is not here
}
```

A closed name list. The per-loan rows stopped needing it when the analyzer shipped
`position_type` — `_isLoan` / `_isLiquidity` read that field and fall back to the list only for
older snapshots. ⚠️ **But the `by_asset` and family rollups carry no `position_type`, so they were
still being classified by name.** The $25M WBTC loan therefore renders in the loan table (correct,
`position_type: "loan"`) **and** lands in the liquidity sleeve subtotals (wrong). One position,
counted on both sides of the split.

⚠️ **One correction to the analyst: the WBTC position does render — as a loan, which is what it
is.** The symptom is not a missing row, it is a phantom $25M in a sleeve whose only member is
PYUSD $1.5K. Naming it "never renders" would have sent a fix at the liquidity table.

⚠️ **And the bug is wider than WBTC: `USDtb` is loan collateral in both pools and is also missing
from the list.** Small ($9,210 combined) and therefore invisible — which is the point. Every
collateral asset Maple adds is silently misfiled until someone edits that array.

Arithmetic reproduced exactly: 25,000,000 ÷ 19,001,505 = **131.57%**; and on the family table
69.0 ÷ 77.25 = **89.3%**, 25.0 ÷ 77.25 = **32.4%**, 8.25 ÷ 77.25 = **10.7%** → **132.4%**.

**Built.** ✅ `_assetPositionTypes(lb, ...)` harvests asset → `position_type` from the loan rows
that carry it; `_isLoanAssetIn(asset, map)` consults it and falls back to the name list only for a
rollup row with no visible loan. Applied at all three rollup call sites (liquidity layer, family
cross-pool, loans-by-asset). The name list stays, now commented as last-resort.

⚠️ **This is not "a different classifier gives a different answer" — it is checkable against the
producer**, and that check is an independent discriminator, not the same rule re-applied:

```
                    renderer sum      producer published        result
syrupusdc  liq       19,001,505   principal_liquidity_usd       MATCH
syrupusdc  loans    922,266,968   principal_loans_only_usd      MATCH
syrupusdt  liq       58,250,015   principal_liquidity_usd       MATCH
syrupusdt  loans    277,052,552   principal_loans_only_usd      MATCH
family     liq       77,251,520   combined.aum_liquidity_usd    MATCH
family     loans  1,199,319,521   combined.aum_loans_usd        MATCH
```

**Six exact reconciliations. The name heuristic matched none of them.** The producer's own AUM
split had encoded the right answer the whole time.

Rendered: *"top asset **USDC 100.0%** of layer"*; liquidity class now **89.3 + 10.7 = 100.0%**;
loans class gains WBTC (2.1%) and USDtb; the phantom parked-reserve sleeve is gone (PYUSD $1.5K
falls under the $100k display threshold and is acknowledged in the dust tail line).

**Status.** confirmed with a correction · **FIXED**

## 15 · syrupUSDC — free liquidity has three values on one page

**Claim.** Backing panel **$7,219,281 (0.8%)**, Liquidity panel **$9.6M (1.0%)**, deployment ratio
implies **1.01%**. Two fields — **`free_usdc`** and **`free_liquidity`** — both labelled
*"Free USDC."* Same on USDT (**$9.89M vs $10.59M**).

**Check.** ✅ **CONFIRMED as a labelling defect — NOT three values, and neither number is wrong.**
Read the producer (`~/PegTracker/syrupusdt_backing_analyzer.py`):

```python
free_usdc      = usdc.balanceOf(POOL) / 10**USDC_DEC      # idle in the pool contract
free_liquidity = total_assets - principal_out             # "USDC + accrued interest in strategies"
```

Two different measurements, both correct. Today: **$7,091,843** and **$9,473,965**; the
$2,382,122 gap is interest accrued into `total_assets` but not into any position's principal.
Verified: 950,742,439.20 − 941,268,473.84 = 9,473,965.36 exactly. The "third value" is not a third
value — `deployment_ratio_pct` 99.0 is the complement of `free_liquidity_pct` 1.0, the same
measure.

⚠️⚠️ **And the producer had already published the correct label, which the renderer was throwing
away:**

```json
"collateral_ratio_alt": {
  "label": "Free Liquidity", "value": 9473965.36, "is_currency": true,
  "note": "Pool USDC + accrued interest in strategies (not in active loans)"
}
```

The renderer took `.value` and hardcoded `'Free ' + underlying` over the top of `.label`, dropping
`.note` entirely. ⚠️ **A published-but-unrendered case where rendering the published field would
have prevented the defect outright.**

**Built.** ✅ Card now reads the producer's `label` and `note`, names the other measure beside it,
and states the right basis:

```
was:  Free USDC        $9.5M    1.0% of supply
now:  Free Liquidity ⓘ $9.5M    1.0% of pool assets · pool USDC balance $7.1M
```

Stress anchor now splits the figure instead of letting one number stand for both — *"covers
redemptions to ~$9.5M before queueing — **$7.1M of that is the pool's own USDC balance**, the
remainder accrued interest booked in the strategies."*

⚠️ **Also fixed in passing: the stress anchor hand-rounded to whole millions**, printing free
liquidity of $9.47M as *"$9M"* — understating the very anchor it exists to state. Now uses
`formatCurrency`.

syrupUSDT renders the same shape correctly: *"Free Liquidity $11.5M · 3.3% of pool assets · pool
USDT balance $10.8M."*

**Status.** confirmed with a correction · **FIXED**

---

# Found while building — not on the analyst's list

## A · A 124.9%-collateralised loan renders red

`_renderBufferCell` colours Set A rows on **buffer-to-init**: `buf < 0` → red 🔴, title
*"Below init level — delegate discretion to call."* The $50.0M BTC loan sits at **124.9%** against
a **125%** init level — a **-0.08pp** buffer, and **24.9pp above par**.

⚠️ **The same panel, four lines above, says the opposite in words:** *"init is not the health
threshold, see distance-to-par above"* — and the Set A tiers it leads with are measured against
par, not init. So the table contradicts the panel's own stated framing.

Both the number and the tooltip are **true**; nothing here is a wrong figure. It is an emphasis
choice made before the distance-to-par framing landed, and it never got revisited.

⚠️ **Item 12's fix made this more visible, not less:** with the ten artifact reads excluded, this
loan is now *"Tightest verifiable loan"* — the headline of the block.

**Not fixed.** Out of scope for every item on this list, and it is an editorial call about what
red means on this page, not a defect. Recorded for the owner. Options, cheapest first: colour the
Set A cell on distance-to-par and keep buffer-to-init as the number; or keep the colour and
reword the panel line so the two agree.

## B · Four dead locals in `_renderLBH_buffer`

`above` / `aboveUsd` / `belowPct` / `abovePct` were computed and never read. Removed — they sat
directly above the new filtered pass and would have read as its source.

---

# Elsewhere — open items not from the analyst's list

These predate this backlog and are not blocking it. Recorded so a fresh session does not
rediscover them.

**Waiting on riskAnalyst** (two intent questions, raised 2026-09-13, unanswered):
- **Axis 4** — all 22 `*_axis_basis.json` publish `underlying_score` and it renders, while spec §4
  says axis 4 carries no score fleet-wide. Recorded as superseded-by-observation; they own whether
  that was the plan or drift.
- **Axis 6** — 19 of 21 issuer blocks publish no score. The frame reads `issuer_score` and would
  render it. Their editorial choice to confirm, not our defect to fix.

**Waiting on PegTracker** (four handoffs at `status: ready`, unworked):
- `apyx-fair-value-basis-hardcoded-2026-09-14` — written this session, uncommitted. apxUSD's
  `fair_value` / `fair_value_basis` are literals that overwrite the branch that computed them, and
  the apyx pair is the only one of nine off the fleet ladder shape (pair-nested, `slippage_pct`).
- `syrup-loan-artifact-marker-not-stamped-2026-09-14` — written this session, uncommitted. Asks
  them to stamp the corroboration verdict on the loan record so consumers stop reconstructing it,
  and flags that the `usd_anomaly` threshold (`raw < required * 0.05`) misses the four $25M loans
  at ~6.2% of required. ⚠️ **Until it lands, `_collateralUncorroborated()` in `syrupusdc.js` is a
  reconstruction of THEIR rule** — if they change the gate and we don't, the page goes stale
  silently. Both helpers carry a comment pointing at the handoff.
- `hastra-prime-heloc-is-a-facility-name-2026-09-12`
- `exit-ladder-bracket-lost-on-quote-failure-2026-09-11`

**Standing backlog, surfaced by the manifest check on every sync:**
`check_feeds.py` prints §4.0 conformance — **8 of 26 published assets carry every baseline
element**. Seven assets are wholly off the six-axis frame (bmnr, mstr, strc, strcx, usdd, ousd,
cusd) and **coverage-history is the most common gap fleet-wide**. ⚠️ The check is DATA-SIDE: it
sees whether an element has data behind it, never whether a renderer draws it.

**A live consumer-side stopgap that should be retired when upstream lands:**
`CommonRenderer.sanitizeQuoteDetail` strips the venue word from `quote_detail` because the feed
said "outside NYSE regular session" and STRC is Nasdaq-listed (10-Q cover, accession
0001050446-26-000044, "NYSE" appears zero times in 508,121 chars). PegTracker fixed the analyzer;
⚠️ **remove the strip only once the new string is visible IN THE PAYLOAD** — a source read is not a
payload read.

**STRCx axis 5** is a genuine absence: no security_analyst walk exists for it, and the page says so
correctly. Not a gap to close on our side.

