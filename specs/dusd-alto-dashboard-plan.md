---
title: DUSD (Alto) dashboard — plan and resume context
repo: backing-monitor
status: PLAN rev 3. Written 2026-09-21; rev 2 added riskAnalyst's answers to all six questions;
  rev 3 records the FIRST CODE SHIPPED — four axis-3 renderer fixes in common.js (§8) — and
  corrects two stale claims rev 2 carried. STILL NO DUSD PAGE: the asset is NOT registered and
  PegTracker has published no backing feed. ⚠️ THE GO/NO-GO IS STILL OPEN — see §7.
---

# 0 ▶ START HERE

**Task:** build a six-axis dashboard for **DUSD (Alto)**, slug **`dusd-alto`**.

**State: not registered, no page. But the renderer work is DONE** — see §8. Three of four
producers have already delivered; this is **mostly a render job**, same shape as BOLD.

⚠️ **§8 SHIPPED WHILE §7 IS STILL OPEN, AND THAT IS DELIBERATE.** The four fixes are generic
axis-3 corrections that DUSD forced out into the open; they stand on their own and one of them
corrected a live usg page. **None of it registers the slug or creates a DUSD page.** Building the
frame correctly is not the same decision as pointing it at this asset.

✅ **All six questions ANSWERED by riskAnalyst 2026-09-21 — see §4.** ⚠️ **The only thing blocking
is a GO/NO-GO with the user: §7.**

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
              ✅ liquidity/1 IS ALREADY ADOPTED by common.js — ADOPTED_OVERLAY_SCHEMAS,
                 mode `replace`, payload `flat`, since 2026-09-03. No adoption work needed.
              ⚠️ IT CARRIES max_age_days: 7 AND REPLACE SUPPRESSES THE BASE FEED. Past the
                 horizon the overlay is refused and axis 3 falls back to the base block —
                 which for DUSD has NO depth at all. DexTracker declares
                 `refresh_cadence: "daily"` but liquidity_payload.py is on no cron and is
                 an assembler that cannot compute depth; every payload is hand-run. Assume
                 this file goes stale unless someone re-runs it.
              ⚠️ REPLACE ALSO DELETES WHAT IS NOT MAPPED. `_adaptSchema` translates six
                 fields plus the ladder and bracket. `venues[]`, `enumeration`, `regimes`,
                 `downstream_route_legs` and `excluded_liquidity` reach `data.liquidity`
                 and render NOWHERE — including the +17.27bps whole-float exit that §3
                 says to lead with. That is the bespoke-panel question, still open.

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

## ✅ The holder's exit — ALL THREE LEGS MEASURED (corrected 2026-09-21)

⚠️⚠️ **rev 1 SAID HOPS 2–3 WERE CITED, NOT MEASURED. THAT WAS A SUPERSEDED LINE and would have
shipped as a caveat that no longer applied.** riskAnalyst's `verification_scope` said it on
09-20; DexTracker measured the full path on 09-21 at block 26,022,595; they have corrected the
field and it now states what it previously said. **A stale caveat is worse than a wrong number —
it reads as rigour.**

```
leg 1   DUSD -> frxUSD    Curve 0x104d6a1b97A6CEf88D905d7b865A378d90be932A
                          MEASURED · +17.9 bps @1k · +9.3 bps @500k  ⚠️ a PREMIUM, not a cost
leg 2   frxUSD -> USDC    Frax ERC-4626 custodian 0x4f95c5ba0c7c69fb2f9340e190ccee890b3bd87c
                          1:1, ZERO fee, previewRedeem(1000e18) = 1000.000000
                          ⚠️ HARD-CAPPED BY REVERT, not by price:
                             redeem(100,000) -> ERC4626ExceededMaxRedeem(max 32,919.582897)
                          ✅ redeem() is NOT permissioned — a holder hits only
                             ERC20InsufficientAllowance, a normal approve step
leg 2'  past the pocket   frxUSD -> crvUSD -> USDC · ~1 bp per hop · MEASURED
```

✅ **Net: the dollar exit is 0.00 bps worse than the frxUSD exit at every size the float can
produce, and at most 3.7 bps worse anywhere on the curve.** All legs are in DexTracker's
`downstream_route_legs` with addresses — **no prose needed for any of it.**

## ⚠️ `primary_exit` is a CONTRADICTION, not a field

`at_nav: true` **and** `gated: true` — **the at-NAV exit exists and no holder can take it.**
PERMISSIONED since inception; treasury Safe `0xA1148A1b94262540994Cf9Aa431A13ad39764228` is the
sole `SWAPPER_ROLE` holder and originated **all 16 lifetime swaps across all three modules. Zero
third-party swaps ever.**

✅ **riskAnalyst's render guidance, adopted:** label it *"at-NAV redemption exists — for one
address"* and make the three-leg market path **THE** exit. ⚠️ **Equal visual weight would let a
reader assume the first is available.**

## ⚠️⚠️ SPLIT THE FLOAT — the $23,935 is not third-party float

```
23,935 DUSD   DexTracker's supply_capped figure (supply less pool)   ✅ correct as published
              ├─ 18,556  inside the two AltoBorrowMarkets
              ├─  4,434  fee timelocks
              └─    945  GENUINELY THIRD PARTY, ~110 addresses, largest holding 238
```

**Both numbers are legitimate** — a borrow market can in principle be drained to holders, so
DexTracker's cap is right. ⚠️ **But what a non-Alto party could sell TODAY is ~945 DUSD — three
orders of magnitude below the 2% crossing, not two.** **tidresearch conflated exactly these two
and riskAnalyst had it wrong in the canonical before they were caught.**

✅ **And the fact worth leading with: THE ENTIRE FLOAT SELLS AT A PREMIUM.** All 23,935 DUSD
returns **23,976.70 USDC, +17.27 bps**. **There is no size at which a holder of this asset pays to
leave.** The 2% crossing bisects to 2,515,625–2,531,250 DUSD — **3.06× the entire supply.**

---

# 4. ✅ ANSWERED by riskAnalyst 2026-09-21 — all six

## Q3 · Backing — TWO SEGMENTS, separate bases. "Not a close call."

```
USM segment   722,605 DUSD  vs  722,604.611770924639631386 frxUSD
              EXACTLY 1:1 TO THE WEI · FixedPriceStrategy returns 1e18 · feeStrategy address(0)
              ⚠️ ZERO BUFFER. Every cent of frxUSD impairment is a cent of DUSD impairment.

CDP segment    99,251 DUSD  vs  ~$186,806 WETH/wstETH/rETH/sUSDe/syrupUSDC/frxUSD
              ~188% · liquidatable · isolated per collateral
              ⚠️ NOT claimable by DUSD holders generally — it backs those markets' own borrowers
```

⚠️ **No insurance fund or surplus buffer anywhere in the system.** **If a blended ratio (110.7%)
is published at all, label it ARITHMETIC-ONLY and never as a safety margin** — a blend hides that
the two halves have opposite failure modes.

### Field shape for the PegTracker handoff — asked once, as requested

```
usm.minted · usm.underlying_balance · usm.ratio · usm.fee_bps · usm.access_mode
usm.is_frozen · usm.is_seized · usm.exposure_cap
cdp.total_debt · cdp.collateral_value_usd · cdp.ratio
cdp.markets[] { collateral, debt, coll_value, ratio, oracle }
totals.supply · totals.minted_sum
```

⚠️ **`totals.supply` and `totals.minted_sum` MUST BE EQUAL** — sum of `minterConfig.minted` over
live minters == `totalSupply` to the wei. **A divergence IS the finding.**
⚠️ **Do NOT ask for a single `collateral_ratio`.** That is the whole point of Q3.
⚠️ **`Usm.seize()` transfers the module's ENTIRE underlying to `stableTokenTreasury` while leaving
the DUSD outstanding — `is_seized` is a SOLVENCY field, not a status flag.** Worth its own
threshold.

## Q4 · Axis 5 — their enumeration MAY stand as the basis, with limits named

✅ **Stands for:** minter/burner set (21 `SetMinterStatus`, 50 `SetMinterCeiling`, 21
`SetBurnerStatus`; 19 minters ever, 17 live), ownership history (3 transfers), full timelock role
history (828 events, all deployer EOAs revoked), minDelay 3,600s with its change history, pauser
set, OFT peers never set, three Safes' identical seven owners at 4-of-7. **A negative control was
run** — `0x…dEaD` false on every role.

⚠️ **It is NOT a security_analyst authority walk and MUST NOT be labelled one.** Two declared gaps:

```
1  EmergencyController 0x3c822f14a90955bf35278b42ba509feecad3a305 holds pause rights on the
   token AND SWAP_FREEZER_ROLE on the USM — who can DRIVE it was not walked. §IX item 6, open.
2  The seven signer identities are unresearched; no cross-protocol signer-overlap sweep run.
```

✅ **The 1-hour timelock is the largest single deduction on the axis** — the dock is for the lack
of a **reaction window**, and 3,600s is functionally none. **A 4-of-7 quorum does not offset it.**

## Q5 · The collision is DATA, not prose — and it is multi-chain

```
PegTracker   contract_address            0x63d74d22E689C715a04F2C13962b1f77F443d35b
             market_price_pool_address   0x104d6a1b97A6CEf88D905d7b865A378d90be932A
DexTracker   depth.quote.token_in.address · depth.supply_check.token   — same address
```

⚠️ **Wider than the four Ethereum tokens in the report.** DexTracker's control run queried
DefiLlama BY TICKER: **42 rows, 38 of them other assets** — a makina "DUSD" at $1.97M, dTRINITY,
Dialectic, plus Solana and DefiChain. **Measured, not asserted.**

## Q6 · The binding axis is DEPENDENCIES (4.5) — and the flat profile IS the answer

**Not because it is lowest (issuer ties it) but because it explains the others:**

```
92.5% of collateral value is frxUSD
frxUSD is ALSO the Curve pool's quote asset
the zero-cost dollar leg runs through a Frax custodian — an UPGRADEABLE PROXY whose
  ProxyAdmin owner is the same 24h Frax Timelock, and whose own owner() is the same
  4-of-7 Frax Safe that controls frxUSD
```

⚠️⚠️ **The reserve, the exit venue's quote asset, and the dollar leg do not merely correlate
through one asset's price — they correlate through ONE ISSUER'S FOUR KEYS.** **DUSD cannot be
worth more than frxUSD, and it cannot exit faster than Frax allows.**

✅ **If the page says one thing, say this: _structurally sound, functionally untested_ — and both
halves are load-bearing.** With **~945 DUSD in third-party hands** there is almost no holder base
to test any of it. **That is why the profile is flat: nothing is broken and nothing is proven.**

---

# 5. Order of work — AGREED WITH THE USER 2026-09-21

```
0  register dusd-alto in data/assets.json
   ✅ THAT IS THE WHOLE OF STEP 0. **rev 2's "add cp lines to sync_and_push.sh" IS STALE
   AND WAS WRONG WHEN WRITTEN.** The script is no longer an explicit cp allowlist: it is
   SUFFIXES × SLUGS, where SLUGS is read from assets.json (dashes → underscores) and the
   suffixes are searched across THREE source roots —
       /home/danger/PegTracker/data
       /home/danger/DexTracker/data/liquidity
       /home/danger/riskAnalyst/data/axes
   `_liquidity` × `dusd_alto` already resolves to DexTracker's file. **Registering the slug
   wires the entire file set with zero edits to the sync.** Verified by reading the script,
   not inferred from the Ethena history that produced the old warning.
   ⚠️ Registering expands riskAnalyst's audit scope — their checker reads our assets.json.
   TELL THEM BEFORE, not after.
   ⚠️ COPYING IS PUBLISHING. The same script commits and pushes data/ to a public site
   minutes later; there is no review step between a producer writing a file and a reader
   seeing it. Registering is what starts that, so it waits on §7.

⚠️ **BEFORE ANY SCORING WIRE-UP: `axis_thresholds` are DESCENDING.** `cutoffs[0]` is the 5/5
floor. **A reversed array does not error — it silently scores 5/5.** (riskAnalyst, 2026-09-21.)

1  ✅ DECIDED 2026-09-21: GENERIC, no dusd.js. Done — see §8.
   The deciding argument was NOT "less code". Three of the four defects generic would have
   shipped (§8 A, B, C) live in code that runs BEFORE any asset renderer: the axis-3 score
   is computed in common.js and a bespoke file can only reach into the DOM and overwrite
   the card text afterwards, which is what bold.js:_applyAxis3Headline actually does. A
   bespoke file would have been the more expensive route to a less correct page, and would
   have left the same landmine armed for the next asset — as it was for usg, which had been
   silently carrying two of them.

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

✅ **The first two are now ENFORCED IN CODE, not left as intentions — see §8 A and D.** A rule that
lives only in a plan file is a rule the next renderer breaks. The rest still bind on whoever builds
the page.

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

---

# 7. ⚠️ OPEN WITH THE USER — a go/no-go, not a detail

**Raised by riskAnalyst 2026-09-21, and it is the right question to ask before building:**

```
DUSD is UNHELD — no position.
The owner DECLINED promoting the tidresearch page to production on 2026-09-20.
⚠️ That is a DECISION, not a deferral.
```

**So a dashboard would be the ONLY live surface for an asset with no position and no public page.**

⚠️ **This is the mirror of the defect our own pre-commit hook warns about** — an overlay with
transport and no consumer. **Here it would be a consumer with no upstream demand.**

✅ **It may be exactly what is wanted** — riskAnalyst calls it a credible watch candidate, and a
$822K asset with 945 DUSD of third-party float, a gated at-NAV exit and a 1-hour timelock is
genuinely interesting to watch. **But it should be a decision, not a side effect of the plan
existing.**

**Confirm before step 0.** Registering the slug also expands riskAnalyst's audit scope, so it is
not a free action.

⚠️ **riskAnalyst was explicit: "Nothing here is an authorisation to build."** Their user asked them
to plan and brief; **the decision to render is between this repo and its user.**

---

# 8. ✅ SHIPPED 2026-09-21 — four axis-3 fixes in js/renderers/common.js

**What this is:** the four defects a generic render of DUSD would have shipped, found by dry-running
the real `dusd_alto_liquidity.json` through common.js's read paths. **All four are generic** — DUSD
is the forcing case, not the beneficiary. **No DUSD page exists; nothing here registers the slug.**

```
A  primary_exit rendered as a NAMED VENUE with the gate suppressed   _renderLiquiditySection
B  "exit unprobed (declared)" on a measured, closed leg              _exitScopeHtml
C  1/5 Critical computed from a figure that is not depth             liquidityRating
D  that figure printed under a "2% depth" label                      renderAxisBand + qualifier
```

## A · the gate renders, in ONE direction only

`pe.gated` was suppressed in **both** directions. The suppression is right about `gated: false` —
usdm publishes `false` while riskAnalyst says the path is allowlisted, and asserting "open to any
holder" is the dangerous direction. Applied to `gated: true` it produced **"Primary exit: Alto
Universal Stability Module (frxUSD)"** and nothing else, on a leg with capacity 0 that no holder has
ever used. **`gated: false` still does not render. The usdm dispute is untouched.**

⚠️ **It also fires with no venue.** usg and tsm_rh publish `venue: null` + `gated: true` + a full
gate/capacity_basis/note, and the whole block was skipped by a `pe.venue || pe.into` guard. **A gate
is a fact about the asset whether or not a venue is named.**

⚠️ **`capacity_usd: 0` ships with its basis.** A bare "$0" beside a fully-reserved module is a
solvency claim we did not make; DexTracker and usg both say so in their own words.

## B · closed ≠ unprobed, and it sits ABOVE the `measured` short-circuit

`_exitScopeHtml` returned `''` for any `gated_basis` starting `"measured"`. Correct for
susds/syzusd/usdm — measured and **open**, nothing to qualify — and wrong for usg, whose basis reads
`measured_protocol_design: … the protocol exposes no holder redemption`. **Measured-and-open and
measured-and-closed are not the same qualification.** Reason is accepted from `gate` as well as
`gated_basis`, so reusde-re is not penalised for the field name it used.

## C · refuse to rate a float as depth — and that UNBLOCKS the authored path

`supply_capped` means the producer measured the crossing, found it above the reachable float, and
published **the float**. The band is absolute `[2M, 1M, 500K, 100K]`, so $23,935 rated **1/5
Critical** — a grading of the asset's *size* dressed as a grading of its book, on a payload whose own
numbers say the entire float exits at **+17.27 bps**.

✅ **Counted before committing: ZERO of the 22 feeds with a liquidity block and ZERO of the 8
`liquidity/1` overlays carry `supply_capped`. Nothing is re-graded.**

✅ **The band is now withheld, so `_authoredLiquidity` can fill it.** Under the old behaviour the
computed 1/5 outranked riskAnalyst's 5.5/10 **permanently** — "the computed band always wins".

⚠️ **Accepted cost:** `_depthShareHtml` refuses to divide a number it will not rate, so DUSD loses
its "2.9% of supply" line. Owner's call 2026-09-21: **respect the rule.** Running it showed the
existing copy would have read **"≈ 2.9% of supply would clear at 2% depth"** — flatly false here,
where the 2% crossing is at $2.5M. The rule was protecting against exactly this.

## D · the label moves with the value

Sub-line prefix **replaced**, never extended — the rule the `exitAsValue` case already follows —
with *"float that can reach the market — not a 2% depth"*, producer basis on hover. The qualifier
was falling to a grey catch-all (`text-slate-500`, the same style as "crossing solved", which is the
opposite kind of fact); it is now amber and names the real crossing, **read** from
`depth.curve_crossing_above_supply` rather than recomputed from the rungs.

## ⚠️ The near-miss, and it was caught by RUNNING, not reading

The first cut of A/B said **"not an exit a holder can take"** on every `gated: true`. **False for
reusde-re**, whose quarterly window a holder genuinely can take: 72 claims, 1,077,727 tokens,
$1,500,075 settled, filled to the ceiling and rationed pro rata. **I would have shipped an invented
fact onto a page** — the copy read as considered and was wrong about the one asset that disproves it.

✅ Split into **closed** vs **restricted** on a PUBLISHED discriminator — `_exitClosedToHolders`:
`capacity_usd === 0` or `mechanism: "none_for_holders"`. **Not parsed from the gate prose.** Reading
the sentence for words like "no" would be inferring a state that is already a field.

## Verification — and it could have come out otherwise

Probe: `common.js` loaded in node against a stubbed DOM, each registered asset's data rebuilt through
the **real** `mergeAxisOverlays`, then the **real** `renderAxisBand` and `_renderLiquiditySection`
run and diffed against the pre-edit file from git.
*(⚠️ `const CommonRenderer` is a lexical binding — it never lands on a vm sandbox object. An export
epilogue is appended to the source.)*

```
29 assets probed (2 legacy skipped: mstr, bmnr — no axis blocks, correct)
 3 changed:  dusd-alto (target) · usg (published, user approved) · reusde-re (staged)
26 unchanged — INCLUDING usdm, susds, syzusd, bold, the gated:false / measured-open cases
```

**Pre-edit run reproduced all four defects verbatim**, including `Primary exit: Alto Universal
Stability Module (frxUSD)` with nothing after it — §6's forbidden render, confirmed by execution
rather than by reading.

**usg, the collateral fix (approved by the user before shipping):** it publishes `gated: true`,
`capacity_usd: 0`, a gate sentence and a capacity_basis, and **because its venue is null, none of it
reached the page.** It now reads *"Primary exit: none for holders — ⚠️ Gated … Capacity $0 …"*.

⚠️ **One false alarm, dismissed by checking:** the ladder shows `$1.0K → 0.0 bps` where the payload's
`slippage_bps` is 17.88. **Not a defect** — DexTracker also publishes `slippage_bps_debiased: 0.0`
and the renderer correctly prefers it, per its own documented usdm rule. My first read of the rung
sample was truncated before that field.

## ⚠️ Known gap, reported not fixed

DUSD's liquidity chip now reads **"Not rated" with an EMPTY tooltip**. The *why* is on the tile
sub-line, which is how the other withheld cases carry it, and one existing asset
(msusd-metronome) already renders exactly this — so it is the established pattern, not a
regression. **But the backing axis has `backingUnratedReason` and liquidity has no equivalent.**
Closing it touches another published page and is outside the A–D scope; it is a separate change.

⚠️ **This resolves itself the moment riskAnalyst publishes `dusd_alto_axis_basis.json`** — they have
NO overlay file for dusd today (`~/riskAnalyst/data/axes/` has nothing), which is why every axis
would currently fall to auto-rating. With the band withheld, their authored 5.5/10 will land as
"Authored 5.5/10" instead of being outranked.

## What is still blocking a DUSD page

```
1  §7 GO/NO-GO — unanswered. Registering is publishing.
2  PegTracker: NO dusd_alto_backing.json. renderAsset throws without it and
   hasAxisBlocks gates the whole six-axis frame on data.peg. THE ENTIRE CRITICAL PATH.
   Renderer work is hours; this handoff is the schedule.
3  riskAnalyst: no axis_basis / issuer / contract_overlay for dusd-alto.
```
