---
title: Analyst findings — 2026-09-14
repo: backing-monitor
source: user's analyst, relayed 2026-09-14
status: WORKING BACKLOG. Items 12-15 FIXED 2026-09-14; items 1-11 UNVERIFIED.
---

# ▶ START HERE — resume context

**Items 12, 13, 14, 15 and 5 are BUILT, rendered and verified.** Triage bands S1–S4 are closed.
⚠️ **Four of the five claims needed correcting before they were safe to act on, and item 5's
stated cause was REFUTED outright — read each item's Check, not just its Claim.**

**Immediate next action: item 8 (sUSDat NAV monotonicity), triage S5.** Items 1–4 and 6–11 are
still `unverified` — nothing has been checked on any of them.

⚠️ **Item 5 is the cautionary one.** The analyst read a published `fair_value_basis` field and
reported exactly what it said; the field is hardcoded and contradicts the numbers beside it. Two
renderer defects were found underneath it that nobody had reported, including a ladder that had
been rendering as *"No exit-mark RFQ ladder in this snapshot"* over live data.

**One new defect surfaced by rendering the fix** — recorded at the bottom under *Found while
building*, not fixed, because it is outside every item on this list and is an editorial call:
a $50.0M BTC loan at **124.9%** collateralisation renders **red 🔴** on buffer-to-init while the
same panel says *"init is not the health threshold."* My change promoted that loan to the
headline, so the contradiction is now more visible than it was.

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
S5  sUSDat NAV monotonicity claim is wrong       item 8         ← NEXT
S6  sUSDat backing tile hides its own caveat     item 7
S7  Wolf table self-contradiction                item 9
S8  liquidity venues missing / not wired         items 1, 2, 3
S9  apyUSD <-> sUSDat link absent from deps      item 4
S10 apxUSD reserve denominator (POL in/out)      item 6
S11 STRCx supply basis + unlocatable supply      items 10, 11
```

---

## 1 · apxUSD — primary exit understated

**Claim.** Panel says *"primary exit ~$5,749 across 1 pool."* There is a Uniswap V4 apxUSD/USDC
pool doing **$220K/day**, and **100% of Kyber quotes routed through it**. Real capacity is
**over $100K at under 10bps**.

**Check.** _pending_
**Plan.** _pending_
**Status.** unverified

## 2 · apyUSD — dominant venue missing from the pool list

**Claim.** UniV4 **apyUSD/apxUSD** is the dominant venue (**~76% of volume, ~$299K/day**) and is
not in the pool list.

**Check.** _pending_
**Plan.** _pending_
**Status.** unverified

## 3 · STRCx — liquidity axis n/a on every field

**Claim.** Every field reads `n/a`. Actual: **$354K Jupiter depth, $2.4M/day, Kraken listed** —
deepest of the four. ⚠️ **`jupiter_liquidity_usd` is already in `strc_backing.json`, just not
wired to the axis.**

**Check.** _pending_
**Plan.** _pending_
**Status.** unverified

## 4 · Missing link — apyUSD <-> sUSDat pools not in any Dependencies panel

**Claim.** Live UniV4 **apyUSD/sUSDat** pools (**~$21.5K/day**). A direct price link between the
Apyx and Saturn stacks, and contagion-relevant: **apyUSD holders can be the ones who drain
sUSDat's $36K ceiling.** Absent from both Dependencies panels.

**Check.** _pending_
**Plan.** _pending_
**Status.** unverified

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

**Check.** _pending_
**Plan.** _pending_
**Status.** unverified

## 7 · sUSDat — headline tile hides what its own basis says

**Claim.** *"BACKING 102.56%"* is the biggest number on the page and **99% of what is behind it is
oracle-unverified.** The basis note says so; the tile does not. Suggested: a badge on the tile —
**102.56% / 1% verifiable**.

**Check.** _pending_
**Plan.** _pending_
**Status.** unverified

## 8 · sUSDat — the NAV monotonicity claim is false

**Claim.** Panel states *"NAV must monotonically rise under ERC-4626 vesting; a drop implies an
STRC loss event."* NAV **declined on 9 hourly observations this week**, several around **-10bps**.
Analyst checked one: **10 Sep 09:44 -> 10:43** — `share_supply` and `onchain_buffer_usd` both
unchanged, `total_assets` **-$75,836**, entirely in `offchain_strc_usd_implied`. ⚠️ **So it is
neither a loss event nor vesting — NAV is mark-to-market on an oracle-marked claim.**

**Check.** _pending_
**Plan.** _pending_
**Status.** unverified

## 9 · Wolf & Co table contradicts itself

**Claim.** Table shows **April 2026** as latest, badged **"Stale 119d."** Apyx docs publish
**March through July 2026**, and our own **Issuer axis text says "published through July 2026."**
Real gap is **~45 days**.

**Check.** _pending_
**Plan.** _pending_
**Status.** unverified

## 10 · STRCx — supply basis differs from CoinGecko

**Claim.** We show **$297.2M on total supply**; CoinGecko shows **$155.3M on 1.462M circulating**
— looks like CG nets out the custodial addresses.

**Check.** _pending_
**Plan.** _pending_
**Status.** unverified

## 11 · STRCx — unlocatable supply is a basis note, not a flag

**Claim.** **629,032 STRCx (22.3%, ~$62M)** on chains with no registered contract sits in a basis
note rather than a top-line flag.

**Check.** _pending_
**Plan.** _pending_
**Status.** unverified

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

