---
title: Analyst findings — 2026-09-14
repo: backing-monitor
source: user's analyst, relayed 2026-09-14
status: WORKING BACKLOG. Each item is UNVERIFIED until checked here.
---

# ▶ START HERE — resume context

**Immediate next action: BUILD the fix for items 12/13 (syrupUSDC collateral column).** It is fully
investigated, the plan is settled, and the user was asked to approve the build. ⚠️ **Nothing has
been built yet.** Everything below item 13's **Plan** is ready to implement as written.

**The four other syrupUSDC items (14, 15) are in the same renderer** and are cheap to do in the same
pass once you are in that file.

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
S1  syrupUSDC collateral column corrupt          items 12, 13
S2  syrupUSDC Liquidity Layer math               item 14
S3  syrupUSDC free liquidity: 3 values           item 15
S4  apxUSD slippage measured against $1.00       item 5
S5  sUSDat NAV monotonicity claim is wrong       item 8
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

**Check.** _pending_
**Plan.** _pending_
**Status.** unverified

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

**Status.** confirmed · **plan settled · NOT BUILT — awaiting the user's go-ahead**

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

**Plan.** Rewrite the footnote to state what is actually true: Maple's per-loan
`currentAssetAmount` is understated by a VARIABLE factor (3.0×, 2.0×, 16.9× observed — so not a
decimal error), affecting crypto-collateralised loans, and the pool's own on-chain
`unrealizedLosses` contradicts the per-loan reads. ⚠️ **Do not restate the at-par explanation** —
a wrong explanation closes the question.

**Status.** confirmed · plan settled · NOT BUILT

## 14 · syrupUSDC — Liquidity Layer, two visible math errors

**Claim.** Parked reserve header says **$25.0M** but the only row under it is **PYUSD $1.5K** —
the **$25M WBTC position never renders**. *"Top asset WBTC 131.6% of layer"* — **over 100%**: it
divides $25M WBTC by a **$19.0M total that excludes the WBTC**. Should be **~57%**. Same bug in
the cross-pool liquidity table: **89.3 + 32.4 + 10.7 = 132%**.

**Check.** _pending_
**Plan.** _pending_
**Status.** unverified

## 15 · syrupUSDC — free liquidity has three values on one page

**Claim.** Backing panel **$7,219,281 (0.8%)**, Liquidity panel **$9.6M (1.0%)**, deployment ratio
implies **1.01%**. Two fields — **`free_usdc`** and **`free_liquidity`** — both labelled
*"Free USDC."* Same on USDT (**$9.89M vs $10.59M**).

**Check.** _pending_
**Plan.** _pending_
**Status.** unverified

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

**Waiting on PegTracker** (two handoffs at `status: ready`, unworked):
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

