---
title: DUSD (Alto) dashboard — plan and resume context
repo: backing-monitor
status: PLAN. Written 2026-09-21. NOTHING BUILT. Order agreed with the user; two questions
  out to riskAnalyst. ⚠️ Read §0 before anything else.
---

# 0 ▶ START HERE

**Task:** build a six-axis dashboard for **DUSD (Alto)**, slug **`dusd-alto`**.

**State: nothing built. Not registered.** Three of four producers have already delivered; this is
**mostly a render job**, same shape as BOLD.

**Blocking on:** riskAnalyst answers to **Q4** (axis-5 basis) and **Q3/Q5** below. ⚠️ **Q1 turned
out to be already answered in DexTracker's data — see §3.**

⚠️ **Before declaring any data gap, check ALL FOUR producers and their subdirectories.** On BOLD
both this repo and riskAnalyst claimed a gap that did not exist, in opposite directions, because
each asked one producer. **DexTracker's payloads live in `data/liquidity/`, not `data/`.**

---

# 1. The asset, in the facts that change the page

```
slug          dusd-alto              chain  Ethereum only
contract      0x63d74d22E689C715a04F2C13962b1f77F443d35b   non-proxy, IMMUTABLE bytecode
supply        821,855.16 DUSD        market cap ~$822K     116 holders
mechanism     HYBRID — 88% treasury-operated 1:1 frxUSD stability module
                     + 12% over-collateralized CDP
owner         AltoTimelockController   ⚠️ minDelay 3,600s (ONE HOUR)
issuer        Alto Foundation — team not publicly disclosed
```

⚠️ **This is a very small asset** — most of the fleet is 100–1000× larger. **Precision the page
implies must not exceed what an $822K/116-holder token supports.**

## ⚠️⚠️ THE ADDRESS COLLISION — resolve before wiring anything

**Four live Ethereum tokens answer to DUSD/dUSD, and Alto's is the one whose `name()` carries no
issuer at all.**

```
Alto (ours)     0x63d74d22E689C715a04F2C13962b1f77F443d35b   name "DUSD"          821,855
Dialectic USD   0x1e33E98aF620F1D563fcD3cfd3C75acE841204ef   name "Dialectic USD" 1,885,087
dTRINITY USD    0x07fFf99e1664d9B116fbC158c0E99785F81cA236   name "dTRINITY USD"    848,325
DeFi Dollar     0x8DC3c42fA99E36636b33E40d7949ba434c946511   name "DeFi Dollar"       1,287
```

⚠️ **dTRINITY is 848,325 against Alto's 821,855 — 3.2% apart.** A ticker match that sanity-checks
by supply magnitude **cannot separate them**. Both also have a Curve pool against a Frax asset.

⚠️ **Curve's `DUSDUSDC` pool `0x32E616F4f17d43f9A5cd9Be0e294727187064cb3` is DIALECTIC's, not
Alto's.** **There is NO DUSD/USDC venue for Alto DUSD at all.**

✅ **Render decision (ours, made): the page resolves by ADDRESS and never shows a bare ticker.**
Same family as the BOLD-vs-Bold and three-way msUSD traps.

---

# 2. What exists, by producer — verified 2026-09-21

```
PegTracker    ✅ DUSD_Alto LIVE in data/peg_tracker_latest_usd.json
                 market_price 1.0018591422784218 · source curve_pool · 2026-09-21T05:17:54
                 wired via asset_config_usd.json, keyed BY ADDRESS, theoretical fixed 1.0
                 market source: curve pool 0x104d6a1b97A6CEf88D905d7b865A378d90be932A
                   coins(0)=frxUSD, coins(1)=Alto DUSD, token_index 1, quote frxUSD
              ⚠️ NO dusd_alto_backing.json — peg feed only, NO backing analyzer output

DexTracker    ✅ data/liquidity/dusd_alto_liquidity.json · liquidity/1 · 2026-09-21T01:35:43Z
                 depth · primary_exit · downstream_route_legs · regimes · venues ·
                 excluded_liquidity · axis_binding_constraint · consumer_status

riskAnalyst   ✅ assets/dusd-alto.md (356 lines, full assessment, revised 2026-09-21)
                 peg 5.5 · backing 5.5 · underlying 4.5 · liquidity 5.5 · structural 5.0 ·
                 issuer 4.5 · overall 5.0
                 283 daily peg samples reconstructed from ARCHIVE STATE (2025-12-11 → 2026-09-20)
                 handoffs: peg-coverage→PegTracker (done), exit-ladder→DexTracker (done),
                           retail-staging→tidresearch

sec_analyst   ❌ nothing — see Q4

us            ❌ NOT in data/assets.json. Step 0, and it is ours.
```

---

# 3. ✅ Q1 IS ANSWERED — and by DexTracker's fields, not prose

**I asked riskAnalyst what a holder's exit actually is. DexTracker had already stamped it:**

```
primary_exit.gated          true
primary_exit.capacity_usd   0
primary_exit.gate           "No holder redemption. Only the Alto treasury Safe can swap
                             DUSD to frxUSD at par."
primary_exit.capacity_basis "Zero HOLDER redemption capacity, not zero reserves."
primary_exit.note           "A holder's only exit is the secondary market measured in `depth`."
```

⚠️⚠️ **So the thing named `primary_exit` is NOT an exit a holder can take**, and the producer says
so in a machine-readable field. ✅ **Render the gate, do not render a redemption route.**

## ⚠️ And `depth` is not a slippage crossing — read its basis

```
depth.status     "supply_capped"        depth_usd  $23,935.36      is_floor false
depth.basis      "The -200bps crossing sits at $2,511,719, ABOVE the float that can actually
                  reach the market ($23,935 of $821,855 total supply, the rest sitting inside
                  curve DUSD/frxUSD pool 0x104d6a1b). Every unit that can be sold clears
                  inside the threshold…"

rungs   $1K 17.9bps · $10K 17.6 · $100K 14.8 · $1M 2.4 · $10M −7499.2
```

⚠️ **`depth_usd` is the REACHABLE FLOAT, not a price-impact figure.** **2.9% of supply is
sellable; the rest sits in the Curve pool as treasury LP.** **The binding constraint is supply
reachability, not book depth** — and rendering $23,935 as "depth" without that basis would be the
BOLD `depth_usd`-as-crossing mistake repeated.

## The honest exit chain — three constraints, all in the data

```
1  holder redemption   GATED       capacity 0, treasury Safe only
2  secondary market    $23,935     reachable float; everything sellable clears inside 200bps
3  frxUSD -> USDC      VOLATILE    custodian USDC pocket moved 59,195 -> 72,836 in TEN MINUTES
                                   ("moves by tens of percent intra-hour")
```

⚠️ **Hops 2–3 are cited from `assets/frxusd.md`, NOT re-measured** (riskAnalyst's own scope note).
✅ **Render per-leg measured/cited status. Do not blend three legs into one number.**

---

# 4. Open questions — sent to riskAnalyst 2026-09-21, unanswered

```
Q2  supply_capped depth on an $822K asset — is the useful statement the depth, the ratio,
    or "exit is constrained by supply, not by book"?           [render follows their answer]
Q3  the 88/12 hybrid on ONE backing axis — one blended CR, or two segments with separate
    bases? ⚠️ I lean TWO: a blend hides that 88% is a treasury promise and 12% is
    collateral. What field should carry the split?             ⚠️ BLOCKING the backing ask
Q4  axis 5 — no security_analyst walk exists, but their §I–§V enumerates 21 SetMinterStatus,
    19 minters ever / 17 live, 828 timelock events, minDelay 3600s. ⚠️ A 1-hour timelock on
    a 17-minter token is a FINDING, not an absence. Does their enumeration stand as the
    axis-5 basis, or commission a walk?                        ⚠️ BLOCKING
Q5  the collision — does any FEED carry the resolved address as data, or prose only?
    Prefer producers stamp it over parsing a sentence.
Q6  all six scores land 4.5–5.5. Flat profiles hide the binding constraint. Which axis do
    they consider binding — for what the page LEADS with, not for the score?
```

---

# 5. Order of work — AGREED WITH THE USER 2026-09-21

```
0  register dusd-alto in data/assets.json
   ⚠️ AND add cp lines to sync_and_push.sh — explicit allowlist; a new asset's JSONs
   SILENTLY never arrive until added. Blocked Ethena until 4975b236.
   ⚠️ THREE paths: PegTracker (peg + backing when it exists), DexTracker
   data/liquidity/dusd_alto_liquidity.json (SUBDIR), security_analyst topology if commissioned.
   ⚠️ Registering expands riskAnalyst's audit scope — their checker reads our assets.json.
   TELL THEM BEFORE, not after.

1  decide BESPOKE vs GENERIC.
   ⚠️ RECOMMENDATION: GENERIC. Small asset, mostly standard blocks, and bespoke is where
   this estate's defects cluster. BOLD went bespoke and was fine, but BOLD had a 3-branch
   table with no generic equivalent; DUSD's custom content is thinner.

2  PegTracker: emit the `peg` axis block.
   ⚠️ ONLY `peg` is strictly blocking — hasAxisBlocks() gates the WHOLE frame on data.peg.
   Same first-unblock as BOLD and STRCx.
   THEN a `backing` block — the 88/12 split is the one genuinely missing thing.
   ⚠️ Ask for the right SHAPE once, after Q3.

3  render axes 1/2/3 from what already exists.

4  axis 5 — riskAnalyst's call (Q4).

5  axis 6 — riskAnalyst, editorial.
```

---

# 6. What I would NOT build

⚠️ **No `primary_exit` redemption route.** It is gated with capacity 0. **Rendering it as an exit
would be the single worst thing this page could do** — the direct analogue of BOLD's spot
redemption floor, which the plan got wrong and riskAnalyst caught.

⚠️ **No bare depth figure.** `$23,935` without its basis reads as book depth; it is reachable
float. **The number and its basis ship together or neither ships.**

⚠️ **No blended three-leg exit cost.** Leg 1 measured, legs 2–3 cited, leg 3's inventory moves tens
of percent intra-hour. **Three different epistemic statuses cannot share one figure.**

⚠️ **No bare ticker anywhere.** Four tokens answer to it and the nearest neighbour is 3.2% away on
supply.

⚠️ **No precision the asset does not support.** 116 holders, $822K. **A number carried to four
decimals on a book this thin is a claim about resolution that the asset cannot honour.**
