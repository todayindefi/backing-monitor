---
title: Analyst findings — 2026-09-14
repo: backing-monitor
source: user's analyst, relayed 2026-09-14
status: WORKING BACKLOG. Each item is UNVERIFIED until checked here.
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

**Check.** _pending_
**Plan.** _pending_
**Status.** unverified

## 13 · syrupUSDC — the stated root cause does not match the symptom

**Claim.** Footnote blames *"at-par stablecoin/RWA positions."* ⚠️ **All ten bad loans are
BTC-collateralised.** The wrong-to-right ratios are not constant (**3.0x, 2.0x, 16.9x**) so it is
not a decimal bug. Looks more like **returning collateral from only some wallets per loan** —
Maple lists **48 collateral wallets**.

**Check.** _pending_
**Plan.** _pending_
**Status.** unverified

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
