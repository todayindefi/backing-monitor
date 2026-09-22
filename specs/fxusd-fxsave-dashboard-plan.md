---
title: fxUSD and fxSAVE dashboards — plan
repo: backing-monitor
status: PLAN rev 2, 2026-09-22. NOTHING BUILT, NOTHING REGISTERED.
  ⚠️ rev 1 CARRIED FOUR WRONG SCORES AND A WRONG RENDER INSTRUCTION — corrected in §2 and §1.
  ⚠️ A SCOPE GO/NO-GO IS STILL OPEN WITH riskAnalyst's USER — see §6.
---

# 0 ▶ START HERE

**Task:** six-axis dashboards for **fxUSD** (first) and **fxSAVE**, f(x) Protocol (AladdinDAO).

**State: nothing built, neither slug registered.** One of six producer inputs is in flight; the
rest are unstarted. Sources read end to end: `~/riskAnalyst/assets/fxusd.md` (282 lines) and
`fxsave.md` (259).

⚠️ **THE TWO ASSETS ARE NOT INDEPENDENT AND THE PAGES MUST NOT IMPLY THEY ARE.** They share one
ProxyAdmin `0x9b54b770…edda4`, one 72h timelock and one 6-of-9 Safe — **byte-identical**. fxSAVE
redeems INTO fxUSD and its exit terminates in fxUSD's own USDC pool. Two pages each showing an
independent Contract & Admin chip is the read riskAnalyst explicitly warns overstates
diversification. **A shared-admin callout ships on BOTH pages, in their words (§4).**

---

# 1. The assets, in the facts that change the page

```
fxUSD   0x085780639CC2cACd35E474e71f4d000e2405d8f6   f(x) Protocol (AladdinDAO) · Ethereum only
        supply 85,334,217.48 (2026-09-22)  price $0.99966  mcap ~$85.3M
        ⚠️ supply +8.6% in 16 days — any ratio struck on an older denominator is stale
        collateral wstETH + WBTC, pledged against LEVERAGED positions (xPOSITIONs)

fxSAVE  ERC-4626 over fxSP (the f(x) STABILITY POOL), NOT over fxUSD
        ⚠️ every public description calls it "saved fxUSD"; asset() returns fxSP
        quoted $1.1189 · instant-redemption proceeds ~$1.0708
```

## 🔴 fxUSD — ONE OF THE TWO PEG DEFENSES IS NOT CALLABLE

```
redeem(address,uint256,uint256) on the PoolManager, simulated 2026-09-22:
  holder of 77.1M fxUSD (the Stability Pool)  -> ErrorRedeemNotAllowed()   BOTH pools
  0x…dEaD, holds nothing                      -> ErrorRedeemExceedBalance()
✅ the pair discriminates: the stranger fails the balance check and never reaches the gate
⚠️ getRedeemFeeRatio() returns a LIVE 0.5% — a designed feature, refused, not a vestige
```

⚠️⚠️ **REV 1 SAID RENDER THIS AS "NOT CALLABLE". THAT IS NOW WRONG AND WOULD MISLEAD.**

**The condition is established, and it is not discretionary.** `isRedeemAllowed()` lives on
PoolConfiguration and gates on **Curve EMA fxUSD < $0.998**. Live EMA is **0.99883**, so
**redemption is closed BECAUSE THE PEG IS HOLDING.** There is no admin switch. rev 1 recorded that
a healthy state-gate and an admin switch look identical from outside — true when written, and
security_analyst has since separated them.

✅ **RENDER IT AS "OPENS BELOW $0.998".** Not "gated", not "not callable", not "refused" — all of
those imply a discretion that does not exist. ⚠️ `capacity_usd: 0` remains correct **today**, but
the reason field must carry the BAND, not the refusal.

⚠️ **AND IT IS NOT A HOLDER'S FLOOR.** It is an arbitrage that caps downside near $0.998. The
distinction survives into the caption: a reader must not take "redemption opens at $0.998" as
"I can redeem at $0.998".

✅ **A holder's only exit today is the DEX**, and the Liquidity axis was never scored on a
redemption floor — fortunate, because there isn't one.

## ⚠️ The backing is REFLEXIVE, and that is the fact the page must carry

The collateral is not idle wstETH/WBTC — it is wstETH/WBTC **pledged against leveraged positions**.
In a sharp ETH or BTC drawdown, the positions backing fxUSD are the same positions under
liquidation stress. **fxUSD's worst day correlates with its collateral's worst day rather than
being insulated from it.** This is a caption problem, not a component problem.

## ⚠️ fxSAVE — the mark exceeds what can be realised, by ~4.3%

```
quoted fxSAVE price                                   $1.1189
instant-redemption proceeds (1.108142 × 0.966643)     ~$1.0708
gap                                                   ~4.3%
```

At the 86% LLTV of the direct fxSAVE/USDC market this consumes roughly a **third of the 14%
cushion before** oracle lag, liquidation incentive or slippage; at the PT market's 91.5%, over
half. **This is the most decision-relevant number in either report and belongs on the FACE of
fxSAVE's page, not in a panel.**

---

# 2. ✅ THE AXIS MAPPING IS AUTHORITATIVE — DO NOT DERIVE IT

riskAnalyst's internal frontmatter uses a different vocabulary from the six-axis frame
(`volatility_score`, `redemption_score`, no `issuer_score`). **They supplied the mapping to
tidresearch on 2026-09-22 and it is authoritative. Deriving our own would put different numbers on
our page than on theirs.**

⚠️⚠️ **REV 1 PUBLISHED THE PRE-CORRECTION NUMBERS. FOUR WERE WRONG.** Corrected by riskAnalyst
2026-09-22 (internal `20ec428`, tidresearch has the same). **These are the live ones:**

```
            Stability  Backing  Liquidity&Exit  Dependencies  Contract&Admin  Issuer   overall
fxUSD          5.5       5.0         4.5            5.0            4.0         5.5      4.5
fxSAVE         5.0       4.5         3.5            4.5            4.0         5.5      4.5
```

```
superseded (rev 1):  fxUSD  Stability 5.0 · Contract 6.0 · overall 5.0
                     fxSAVE Liquidity 4.0 · Contract 5.0
```

**🔴 Contract & Admin 6.0 → 4.0 (fxUSD) and 5.0 → 4.0 (fxSAVE).** The 6.0 rested on a timelock
enumeration treated as the system's power set. security_analyst found **four undelayed paths
beside the 72h delay** — including `updatePriceOracle(address)`, **unvalidated**, at three keys on
every pool and at **ONE key (the deployer EOA) on the WBTC pool carrying 89.7% of all fxUSD debt**.
⚠️ **THE DELAY PROTECTS THE CODE, NOT THE MARKS.**

⚠️ **AND THIS REVERSES §4's ANSWER TO THE SHARED-ADMIN QUESTION.** rev 1 recorded that the 1.0 gap
between the two was "the three extra contracts, nothing else". **They are now LEVEL at 4.0** —
fxUSD lost two notches on a surface fxSAVE shares, so the wrapper penalty is absorbed. The
shared-admin callout matters MORE now, not less: two pages showing 4.0 and 4.0 for one control
surface is precisely the duplication that reads as independent confirmation.

**Liquidity 4.0 → 4.5 (fxUSD), 4.0 → 3.5 (fxSAVE).** Their ladder spec gained §2.6 today: axis 3
is scored on a **PROFILE, not a crossing** — see §2.1 below.

⚠️⚠️ **THREE RULES THAT ARE NOT OURS TO REINTERPRET:**

1. **`volatility` → axis 1, WITH THE LABEL CHANGED.** It measures NAV behaviour, not peg
   deviation — fxSAVE is 1.108 and rising **by design**. A tile captioned "premium / discount"
   over a share price that is supposed to climb is a mislabel.
2. ⚠️ **`redemption` (7.0) DOES NOT GET ITS OWN FIGURE. It MERGES into axis 3 on the WORSE LEG,
   never the average.** Redemption alone is 7.0 (immediate, uncapped, ~$10.7M simulated); spot
   depth is ~$535K; the exit terminates in an unmeasured $10.0M fxUSD pool. Rating the exit at its
   **binding** leg gives 4.0, and the asset judgement followed it down to 4.5.
   **Rendering 7.0 beside the exit would republish the exact error that merge rule prevents.**
3. ⚠️ **fxSAVE's axis 2 is NOT underivable — it is 4.5, scored, with a basis.** A vault share over
   fxSP has no collateral ratio, but it has *backing*: a claim on the Stability Pool, itself
   fxUSD-backed by wstETH/WBTC against leveraged positions. Half a notch under fxUSD's 5.0 because
   **fxSP redeems ~2.4% below par for reasons not yet separated (fee vs absorbed losses)**.

## 2.1 ⚠️ AXIS 3 IS SCORED ON A PROFILE, AND OUR TILE IS A SINGLE NUMBER

riskAnalyst's ladder spec §2.6, added 2026-09-22: **a lone crossing hides curve shape.** fxUSD's
profile, which IS the basis of the 4.5:

```
$100k    0.20 bps        0.5% crossing   $3.72M – $3.74M
$1M      2.37 bps        2%   crossing   $4.25M – $4.30M
                         ceiling         $4,648,576
```

The 0.5% crossing is **~2× the entire free float**, so unlocked fxUSD exits cheaply — but the
**ceiling binds a fxSAVE unwind**, which is why the two assets moved in OPPOSITE directions on the
same measurement (fxUSD 4.0 → 4.5, fxSAVE 4.0 → 3.5).

⚠️⚠️ **THIS IS A FRAME-LEVEL PROBLEM, NOT AN fxUSD ONE.** Our axis-3 tile renders exactly one
figure (`total_2pct_depth`). The rungs render in the ladder table below it, so the profile IS on
the page — but the tile is what a reader scans, and riskAnalyst says a single number is now "the
thing to avoid", having been misled by one themselves.

**Not a unilateral change.** Re-shaping the axis-3 headline touches every asset on the dashboard.
Options, for a decision rather than a patch: keep the crossing and add the ceiling beside it;
render a two-point summary (cheap-size bps + ceiling); or leave the tile and strengthen the
ladder's prominence. ⚠️ Whatever is chosen, **the ceiling must appear for fxUSD** — it is the
binding quantity for fxSAVE and it is not the crossing.

⚠️ **My own first instinct got 2 of these 3 wrong** — I proposed redemption as its own axis-3
figure and axis 2 as declared-underivable. Recorded so the next reader does not re-derive them.

## ⚠️ AND DO NOT COMPUTE AN AXIS MEAN

riskAnalyst's consistency checker omitted `redemption_score` from `AXIS_KEYS` while recognising a
"Redemption" row — a **truncated mean** that affected **106 of 152 assets and failed in BOTH
directions**: manufacturing false violations *and* hiding real ones, the hidden three each sitting
at exactly the truncated mean. Fixed their side (`394eb53`, `7fc5137`).

✅ **Checked here: `common.js` computes NO axis mean** — its only means are 7-day peg-deviation
averages, a different quantity. And `_authoredAxisScore` already carries the guard their
`AXIS_KEYS` lacked: a numeric `*_score` the accepted list does not name returns
`{unknownField, unknownValue}` rather than being silently dropped. **Verified by execution, both
branches.** `volatility_score` is already in the axis-1 accepted list, so fxSAVE's stability score
lands with no renderer change.

---

# 3. What exists, by producer — verified 2026-09-22

```
PegTracker    ✅ fxUSD IS CONFIGURED — .assets.fxUSD (note: config is {"assets":{…}}, so a
                 top-level key scan MISSES it; I made that error first)
                 active · tracking_mode "peg" · CoinGecko f-x-protocol-fxusd · theoretical fixed 1.0
              ⚠️ price_staleness_basis: "UNKNOWN — the upstream source publishes no timestamp
                 through this path yet, so freshness is not established"
              ❌ NO fxusd_backing.json and NO analyzer. THE SAME GAP DUSD JUST HAD.
              ❌ fxSAVE not configured at all

DexTracker    ⏳ LADDER DISPATCHED 2026-09-22 (riskAnalyst → live session,
                 specs/handoffs/fxusd-usdc-exit-ladder-dextracker.md)
              ✅ ONE LADDER SETTLES BOTH — fxUSD's liquidity axis IS fxSAVE's binding constraint
              ⚠️ it blocks promotion of both tidresearch pages

riskAnalyst   ✅ assets/fxusd.md (282 lines) + assets/fxsave.md (259), both refreshed 2026-09-22
              ✅ issuer text AUTHORED (§4), mapping authoritative (§2)
              ❌ ZERO overlay JSON in data/axes/ for either — known is not wired

tidresearch   ✅ reports for BOTH, already carrying `axis_frame: six`
              ⚠️ production: false on both (same state as bold) — so NO production link;
                 bold's precedent is report_status "staged" + a staging URL

security_analyst  ✅ ANSWERED the open question — four undelayed paths (§2), and the redemption
                 gate separated into a price band, not a discretion (§1). Four scores moved on it.

us            ❌ neither slug registered
```

---

# 4. ✅ Producer-authored text to render VERBATIM

**Issuer (5.5, identical on both — same issuer):**

> Running since 2023, $134.3M protocol TVL, Ethereum only, two audits. When ChainSecurity found a
> double-flash-loan access-control bypass in the router peripheral in April 2025 with over $2M at
> risk, it was fixed under responsible disclosure and never exploited. Held below 6 for a small DAO
> with no external governance check over a complex multi-contract system; the disclosure response
> evidences engagement, not the absence of further issues.

**Shared-admin callout — ON BOTH PAGES:**

> fxUSD and fxSAVE are governed by the same ProxyAdmin and the same 72-hour timelock. A single
> control failure reaches both; they are not independent legs.

⚠️⚠️ **SUPERSEDED — THERE IS NO LONGER A GAP.** rev 1 recorded that the 6.0 vs 5.0 difference was
"three extra contracts, nothing else". **Both are now 4.0**: fxUSD lost two notches to the
undelayed oracle paths (§2), on a surface fxSAVE shares, so the wrapper penalty is absorbed into
the larger finding. The wrapper stack is still real — an EIP-1167 custody vault, a gauge and the
Stability Pool, none visible through the ERC-4626 interface — it is simply no longer what separates
the two scores, because nothing does.

✅ **The callout matters MORE at equal scores, not less.** Two pages each showing 4.0 for ONE
control surface is exactly the duplication that reads as two independent confirmations.

---

# 5. Order of work

```
0  ⚠️ WAIT on §6. Registering is publishing — the sync copies data/ to a public site hourly.

1  PegTracker: fxusd_backing.json + an ANALYZER, registered in run_backing_analyzers.sh.
   ⚠️ THE BLOCKER. renderAsset throws without the file; hasAxisBlocks gates the whole frame
   on data.peg. Ask for the MECHANISM, not the file — the DUSD handoff asked for a file,
   got a correct one-off artifact with no writer, and cost a second round trip.
   ⚠️ Ask them to establish peg freshness or declare it: the CoinGecko path publishes no
   timestamp, so `price_staleness_basis` currently reads UNKNOWN.

2  DexTracker ladder — IN FLIGHT. Nothing to send; it settles axis 3 on BOTH assets.
   ⚠️ Ask that primary_exit carry gated:true + capacity_usd:0 + the reason verbatim, so the
   existing renderer states the refusal. Wording: NOT CALLABLE.

3  riskAnalyst: dependencies/1, contract-overlay/1, issuer/1 for BOTH. Their standing
   authorisation covers this class — ask and they draft. (See project-producer-standing-arrangements.)

4  render fxUSD, staged. Then fxSAVE.

5  security_analyst — OPTIONAL, and the only party who can close the redemption re-enable
   condition. Worth asking whether it is worth their queue for an unheld asset.
```

## Renderer work, and most of it already exists

✅ **Reusable from DUSD with no change:** the gated-exit render (`primary_exit.gated` + capacity-zero
basis rendered verbatim), the refusal to rate axis 3 on an absent redemption floor, the
declared-underivable backing render, the venue table with `is_live` tri-state.

**Genuinely new, and both are caption problems:**
- **Reflexive backing** on fxUSD — the collateral's stress and the asset's stress are one event.
- **NAV-not-peg** labelling on fxSAVE's axis 1, plus the **4.3% mark-vs-realisable gap** on the face.

---

# 6. ⚠️ OPEN — A SCOPE DECISION, WITH riskAnalyst's USER

`fxusd.md` says on its face: *"WRITTEN AS A DEPENDENCY REPORT, NOT A HOLDING ASSESSMENT… Scope is
therefore deliberately narrow: enough to score the leg, NOT a full assessment."* It exists because
fxUSD was the only unscored leg in USG's collateral lookthrough.

**A six-axis dashboard is a comprehensive surface.** Publishing one on deliberately narrow work
presents scoped-for-one-purpose analysis as an assessment of the asset.

Two things bear on it and **neither settles it**: today's refresh **widened it substantially** (role
membership enumerated, venue liquidity measured, redemption measured and found refused, peg cut
5.5 → 5.0 on that), so it is materially less narrow than the header warning implies; and their user
**has already approved a tidresearch fxUSD page** on that reasoning, staged at `production: false`.

⚠️ **But approving a report page is not approving a dashboard, and riskAnalyst is explicitly not
inferring one from the other.** They are asking their user and will return a yes/no.

**We hold no fxUSD.** Same shape as the DUSD question, and it should be a decision rather than a
side effect of the plan existing.
