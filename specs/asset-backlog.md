# Asset backlog — data issues waiting for the next refresh

**What this is for.** Data problems and missing measurements get found while working on something
else. Chasing each one as it appears derails whatever was in progress; forgetting them loses real
findings. They are recorded here instead, and worked during the manual asset refresh — the pass over
every asset checking for updates and bringing it current.

**One file, not one per asset.** Greppable by slug, and it covers assets that have no other doc.

⚠️ **This file is NOT read by the dashboard.** Deliberately not in `data/assets.json`: that is loaded
at page render and wired into the sync, so an editorial note there could reach a reader.

---

## Triage — when something jumps the queue

```
DEFAULT              next refresh. Almost everything.
ESCALATE TO NOW      only when a page is showing something FALSE to a reader.
                     Not "missing", not "thin", not "unmeasured" — WRONG.
```

⚠️ **"Missing" is not "wrong."** An asset with no depth figure is incomplete and waits. An asset
showing `n/a` on top of a live measurement is asserting something untrue and does not.

⚠️ **AN ENTRY IN THIS FILE IS OUT OF THE ACTIVE QUEUE. THAT IS THE POINT OF THE FILE.** Owner
instruction 2026-10-02. Once something is recorded here and triaged to the refresh, it stops being a
thing to raise in status updates or to offer as the next task. Re-surfacing it costs the owner the
same attention twice and defeats the batching this file exists to do. It comes back at the refresh,
or when its triage changes — not because it is still on someone's mind.

⚠️ **Holdings are not a factor here and are not recorded in this repo.** riskAnalyst holds that
context. If an asset's exposure makes something urgent, that call comes from them or the owner — do
not infer it, and do not keep a holdings list here to guess with.

---

## The refresh pass

For each asset, in this order:

1. **Freshness** — does each axis's own clock match the cadence its producer declares? An age past
   the declared cadence means the producer is late, which is a different fact from an axis that was
   never scheduled.
2. **This file** — read the asset's entries below. Each one is either CLOSED or RESTATED with why it
   is still true. ⚠️ A third option does not exist: an entry left untouched rots into a stale claim,
   and a stale reason is worse than a stale number because it closes the question.
3. **Published-vs-rendered** — anything new in the payload reaching no pixel. This repo's most
   repeated defect.
4. **The cross-asset section** at the end. ⚠️ **Owner instruction 2026-10-03: a cross-asset item
   is worked PER ASSET, at that asset's refresh, unless it is urgent.** So every cross-asset entry
   carries an `affects` line naming its slugs, and a grep for the slug you are refreshing surfaces
   it alongside that asset's own entries. Do the slice that belongs to this asset and leave the
   rest; the entry closes when its last asset does.
5. Update `Last reviewed` on each entry touched.

---

## Entries

### thusd — exit measurement never configured
```
raised      2026-10-02
what        No exit ladder. PegTracker has no config entry in asset_config_usd.json or
            asset_config_eth.json, so nothing measures it. The liquidity axis renders four blanks.
why         $4.08M of pool value and ~$335/24h turnover (~0.008% daily). A reader cannot tell
            "thin" from "unmeasured", and those are very different holdings decisions.
owner       PegTracker
closes when rungs appear under liquidity.exit_mark.quotes, or a depth figure does. Our renderer
            derives the 0.5% answer from rungs with no change on our side.
status      ✅ DELIVERED by PegTracker 2026-10-02 06:40Z (their 40f3c03); handoff closed completed.
            Our copy syncs on the next cycle. Our side needed one change, shipped ahead of the data
            (d2d70a48f): prefer their published scope sentence over our derived one.
result      ⚠️ FAR WORSE THAN THE $4.08M TVL SUGGESTED. The sell side caps at about $8,800 of
            OUTPUT at any size. Fill ratio 0.9994 at $1K, 0.972 at $2.5K, 0.446 at $10K, 0.075 at
            $100K, 0.0088 at $1M. The 0.5% crossing is bracketed [$1,000, $2,500] — so the measured
            exit is roughly a thousand dollars, against $4.08M of pool value.
            The pool is one Uniswap v4 thUSD/USDC pool that is almost entirely thUSD, so BUYING $1M
            fills at par while selling collapses. ParaSwap agrees independently; syrupUSDC as a
            control is normal on both aggregators.
            ⚠️ Scope matters as much as the figure: Ethereum only, and Stable holds ~38% of SUPPLY
            with NO indexed venue (GeckoTerminal 404s thUSD there, none of Stable's top 60 pools
            contain it, and KyberSwap does not route Stable). Their control was that GeckoTerminal
            does index Stable.
            Our band will read Stress 2/10 against riskAnalyst's authored 3.5 — a 1.5 gap, inside
            band resolution, so not a flagged divergence.
note        The venue question is settled and I was right to ask rather than assert: their stale
            three-way-split note was the blocker, and the ladder is now labelled ONE LEG.
            Also changed in their payload: peg.market_price_self_referential flips to FALSE, because
            the exit leg is now KyberSwap-routed rather than the GeckoTerminal mark.
Last reviewed 2026-10-02
```

### ousd — ⚠️ a measured ladder, ten hours old, rendering as "n/a"
```
raised      2026-10-02. ⚠️ ENTRY REWRITTEN 2026-10-03 — the 10-02 version was WRONG ON ITS
            CENTRAL CLAIM and is kept below so the error is not silently replaced.
⚠️ WRONG     "The file carries none of the six axis sections, and the layout switches off when the
   as filed  peg section is absent. So OUSD shows no axis 3 rather than an empty one."
            ALL THREE SENTENCES ARE FALSE TODAY, measured 2026-10-03:
              - OUSD IS on the six-axis layout. riskAnalyst's axis_basis file supplies peg,
                backing, liquidity and dependencies, and `hasAxisBlocks` is literally `!!data.peg`
                — so their envelope switching the layout ON is the same mechanism that unhid the
                frame on the MSTR equity page. The file has been there since 2026-09-11.
              - It shows an EMPTY axis 3, which is precisely what the entry said it did not do.
              - The entry was written to correct an earlier mistake ("looks like a liquidity gap
                and is not one") and it over-corrected into a second one. It IS a liquidity gap.
what        THREE PARTIES EACH HOLD PART OF THE ANSWER AND NONE OF IT REACHES THE PAGE:
              PegTracker measured OUSD's full ladder at 2026-10-03T01:35Z — 4 rungs, $1K to
                $100K, status ok, EVERY RUNG CLEARING AT A PREMIUM (fill_ratio 1.00048-1.00067).
                It lands in the combined `peg_tracker_latest_usd.json` and nothing in this repo
                reads that file. See [[project-pegtracker-ladder-output-path]].
              PegTracker's `ousd_backing_analyzer.py` is ALIVE and current (02:35Z the same day)
                but emits the pre-six-axis shape — summary, backing_breakdown, risk_flags,
                vault_status, and no axis blocks at all.
              riskAnalyst authored liquidity 5.0/10 WITH a written non-derivability reason, in
                `liquidity_score_depth_caveat`: "NO COMPUTED DEPTH EXISTS FOR THIS ASSET — the
                feed carries no liquidity block at all." Our FILL gate wants a STRUCTURED
                declaration (derived_score_status, two_pct_depth_size_responsive,
                two_pct_depth_status), so the prose is rejected and the score is withheld.
            Net: "0.5% depth n/a · Max ≤25bps n/a · Pool TVL n/a · No exit-mark RFQ ladder in
            this snapshot", and no rating.
why         ⚠️ The depth is NOT unknown. Every tested size through $100,000 clears at a GAIN, so
            the honest answer is a floor at ≥$100K — against a ~$6.94M book, ~1.4% of supply at
            the top rung. "n/a" asserts we do not know something we do know. Same class as the
            reUSD-RE / syzUSD escalation, different mechanism: there an overlay deleted a
            measurement, here the measurement is in a file no consumer reads.
⚠️ and the  The gate is arguably RIGHT to reject riskAnalyst's prose, and that is worth keeping
   gate is  separate from the wiring: "no depth exists because nobody produced one" is a GAP,
   not the  not a by-design absence. It is the `not_measured` vs `not_size_responsive`
   bug      distinction, and the FILL gate exists to stop an authored score papering over a
            broken feed. Widening it to accept this prose would admit exactly the case it
            guards. Once the ladder is wired the question dissolves — a real depth exists.
owner       PegTracker (emit the axis blocks for OUSD, as its analyzer already does for the other
            ~20 assets). Ours only if they decline, by reading the combined store.
not         a product decision about layout, which is how this was filed. It is one producer
            emitting for OUSD what it already emits fleet-wide, over data measured today.
closes when OUSD's own feed carries a liquidity block, or we record that this legacy asset stays
            unmeasured on purpose AND the tile stops saying n/a over a live ladder
status      DEFERRED to OUSD's next refresh — not in the active queue, not awaiting the owner.
            ⚠️ Ask before asking: PegTracker's weETH test is still red and a
            previous handoff from here was mistaken for their own work.
⚠️ DECISION  "Is a ~$7M legacy asset worth a producer ask?" was held open as a question for the
   TOO       owner, which was wrong twice over: it is not urgent (OUSD is not a held asset), and
            keeping it open parks the whole entry behind a reply. ⚠️ DECIDE IT AT THE REFRESH,
            with the other five tasks in front of you, not in isolation — the answer depends on
            what else OUSD needs, and task 1 costs almost nothing because the measurement
            already exists. If the answer is no, record THAT: "OUSD stays unmeasured on purpose"
            is a finished state, and the tile must then stop saying n/a over a live ladder
            (see `why` above) — declining task 1 does not dispose of the false reading.
            Moved out of the active queue 2026-10-03 at the owner's instruction.

TASKS — in order, for OUSD's next refresh. Each one measured 2026-10-03, not inferred.
  1  AXIS 3, the ladder. Ask PegTracker to have `ousd_backing_analyzer.py` emit a `liquidity`
     block, as its siblings already do for ~20 assets. ⚠️ NO MEASUREMENT IS NEEDED — the ladder
     ran at 2026-10-03T01:35Z and sits in `peg_tracker_latest_usd.json` under key "OUSD": 4
     rungs $1K-$100K, status ok, fill_ratio 1.00067 / 1.00065 / 1.00058 / 1.00048. This is a
     transport ask, not an analysis ask, and that is the whole reason it is cheap.
     Verify: the tile stops reading "0.5% depth n/a" and shows a floor at ≥$100K.
  2  AXIS 6, a stranded authored score. riskAnalyst authored `issuer_score: 6.0` inside
     `ousd_axis_basis.json` and it reaches no reader. ⚠️ THEY ALREADY TOLD US, in the payload:
     `issuer_score_routing: "⚠️ UNROUTED — backing-monitor holding axis-6 registration"`, and
     their routing_note repeats it. The score arrives on every other asset from the BASE feed's
     own `issuer` block (usde 7.0, syzusd 4.0, yzusd 4.0) — and OUSD's base feed has no issuer
     block at all, so there is nothing to carry it.
     ⚠️ `AXIS_OVERLAYS.issuer` is `_issuer` ONLY, with no `_axis_basis`, unlike axes 2/3/4.
     But do NOT just add it: `ousd_issuer.json` does not exist, and the 19 `_issuer.json` files
     that DO exist carry NARRATIVE (summary, facts) and no score — measured, so the one-line fix
     is not the fix it looks like. Decide WHERE axis 6's score is supposed to come from first.
     affects cusd, usdd — same shape exactly: authored score, no base issuer block. ⚠️ NOT
     syzusd or yzusd: they have no `_issuer.json` either but their BASE feed carries the score,
     so they render fine. A missing `_issuer.json` is not the discriminator; an absent base
     issuer block is.
  3  AXIS 1 — CHECK, not a finding. `pegRating` is null for OUSD and 5 for usde, and OUSD has no
     measured peg block, though `ousd_peg_history.json` exists and riskAnalyst authors
     `peg_mechanism_score: 5.5`. I have NOT established whether axis 1 is meant to show that
     mechanism score, whether the history file can fill the measured half, or whether null is
     correct here. Establish which before filing anything against a producer.
  4  Registry. `assets.json` gives OUSD no `report_url`, so axis 6 reads "No report linked" —
     and axis 6 is the editorial axis whose whole convention is to link the report instead of
     showing a number. Add the URL if a report exists; if none does, that is the answer and
     should be recorded rather than left looking like an oversight.
  5  ⚠️ LAST, and only after 1 lands: riskAnalyst's `coverage_note` says "THIS ASSET CARRIES 3 OF
     6 AXES … AND THE FEED SUPPLIES NO COMPUTED VALUE ON ANY AXIS, so nothing on this asset is
     cross-checked by a measurement." True today, FALSE the moment the ladder is wired, and it is
     the kind of sentence that survives the change that falsifies it. Theirs to refresh; flag it
     rather than editing their copy.
note        The others in the pre-six-axis state are NOT all alike, and the 10-02 entry lumped
            them: usdd and cusd are in OUSD's position (axis_basis present, layout on, axis 3
            empty); strc has peg+liquidity; bmnr genuinely has no axis blocks and no overlay, so
            its layout stays off. mstr and strcx have no feed of their own — they are sibling
            views on strc's. For bmnr/mstr/strcx an exit ladder is not the right question.
Last reviewed 2026-10-03
```

### syrupusdt · syrupusdc — crossing published in a layout we cannot read
```
raised      2026-10-02
what        PegTracker publishes these two assets' crossing nested inside the exit mark rather than
            at the top level like the other seventeen. Our resolver cannot see it, so these two are
            served by our own derivation.
why         Looks like a violation of "a producer's published block beats our derivation" and is
            not: the nested figure is measured at a 2% cost limit while we headline 0.5%, so reading
            it would print a 2% number under a 0.5% label. Our derived floor is the stronger true
            statement because every rung also clears inside 0.5%.
owner       PegTracker (convention question), then us if the layout spreads
closes when either they converge on one layout, or the nested one carries a 0.5% figure we can read,
            or we record that these two stay derived on purpose
status      not requested — deliberately kept out of the thUSD handoff, which was execution work
note        Also unread: the machine-readable block on these two assets declaring which of their
            figures answers which question. Worth adopting once it is fleet-wide; it would replace a
            convention our code currently infers.
Last reviewed 2026-10-02
```

### reusd-re · syzusd — ⚠️ ESCALATED: showing n/a over a live measurement
```
raised      2026-10-01
what        DexTracker's liquidity file replaces the whole axis, so their declining to publish a
            depth figure deletes PegTracker's. Both pages read "0.5% depth n/a · Not rated" over a
            PegTracker measurement taken hours earlier.
why         This is the FALSE case, not the missing case — the page asserts no depth is known when it
            is. Hence escalated rather than deferred.
owner       us
closes when the fallback rule in the specification is built: an owner with nothing to say hands off
            rather than taking the axis down.
status      ✅ CLOSED 2026-10-02 (fe1d82f10). reUSD-RE now reads 0.5% depth $10.0M, crossing
            between $10.0M and $20.0M, chip Healthy, attributed to the base feed with the owner's
            reason for declining in the tooltip. syzUSD $100K bracketed to $150K. 29 other panels
            byte-identical.
Last reviewed 2026-10-02
```

### reusd-re — rated Healthy 10/10 where the analyst scores liquidity 4.5/10 — DEFERRED to next refresh
```
raised      2026-10-02
what        Our band is computed from DEPTH ALONE and renders 10/10. The spec defines this axis as
            the worse of {venue depth, primary redemption}; reUSD-RE's binding leg is redemption,
            gated to non-U.S. persons, which is what riskAnalyst's 4.5/10 prices. So the band is a
            measurement of the NON-BINDING leg rendered as the axis rating.
why         A 5.5-point gap on a 10-scale, in the FLATTERING direction, on an asset riskAnalyst
            holds at $172,641. Our own divergence threshold is 2.0 points.
            ⚠️ Created by our own fix the same day: the hand-off (fe1d82f10) moved this asset off
            the authored-only path and onto the computed path. Before it the chip read Not rated.
owner       riskAnalyst supplies a liquidity non-derivability declaration; then us, to implement the
            liquidity equivalent of the backing gate (score + applies_when + basis, all required).
closes when the declaration exists and the chip shows the authored score, OR the band learns to
            account for the redemption leg, OR this is recorded as acceptable with the tooltip
            disclosure as the mitigation.
status      ⏸ DEFERRED by the owner 2026-10-02 to reUSD-RE's next refresh. Was raised as
            ESCALATED the same day and is deliberately NOT any more — see the re-triage below.
            riskAnalyst answered 2026-10-02: the declaration is honest for this asset, and they will
            NOT declare for syzusd/yzusd (gap 1.0, inside band resolution — no disagreement there).
            They are holding the field unpublished until the build is approved, so nothing of theirs
            is waiting on the refresh either.

re-triage   ⚠️ This was escalated under the rule "a page showing something FALSE jumps the queue",
            and the owner has deferred it anyway. Both are defensible and the reason the second one
            is, is an interim fix that landed the same day (de9586303): the hover on that rating now
            carries riskAnalyst's own explanation — that the axis measures the worse of venue depth
            and primary redemption, that the binding leg here is redemption, and that 4.5 and $10M
            are therefore not in conflict. Before that it showed two bare numbers and no reason.
            ⚠️ So what remains is a VISIBLE chip that overstates with a correct explanation one hover
            away. That is a weaker defect than the n/a-over-a-live-measurement case this file
            escalated and closed, and it is the reason deferring is reasonable rather than a
            concession. If the mitigation is ever reverted, this goes back to escalated.
note        The tooltip already states both numbers, and the head carries the report's full
            reasoning in a disclosure. So this is "visible chip overstates" rather than "hidden".
            Whether a hover is sufficient mitigation is the open question.

            ⚠️ THE JUDGEMENT IS ALREADY PUBLISHED, PER ASSET — 28 entries of
            liquidity_score_depth_caveat in riskAnalyst's overlays, and they already split the way
            we spent today re-deriving: reUSD-RE "it measures the leg this axis does NOT score on";
            syzUSD and yzUSD "this one may be read as depth". It is PROSE, which is why it cannot be
            the gate: matching a rating against a sentence makes the wording load-bearing and the
            green-making fix becomes un-improving the copy.

            AGREED SHAPE if the build is approved (mirrors the backing gate, which riskAnalyst
            already authors on this same asset):
              liquidity_score               4.5                                already published
              liquidity_score_applies_when   "depth_measures_non_binding_leg"   exact sentinel, NEW
              liquidity_score_depth_caveat   the existing prose                 required
            All three present and the sentinel matched exactly, else the computed band renders
            unchanged. The sentinel names the REASON, not the outcome, so a different reason needs
            its own value.

            ⚠️ WHAT THE SENTINEL MUST NOT FIRE ON, and this is the constraint that keeps it from
            becoming an override (riskAnalyst's, from their backing precedent): not an ABSENT depth
            figure but a PRESENT one they merely disagree with. It must be false whenever depth IS
            the binding leg and the score simply differs — exactly the syzUSD/yzUSD case, gap 1.0,
            which they refused to declare. Their backing notes carry the equivalent sentence for
            their own case ("MUST NOT fire on a merely-absent collateral_ratio ... promoting an
            authored score over a measured one on the strength of an outage is the failure").

            ⚠️ THE DECLARED SCORE RENDERS AS 4.5, NEVER ROUND-TRIPPED TO "4/10". Already logged as
            a bug once here (an authored 5.5 rendered "Watch · 6/10", provenance stripped and the
            number changed). riskAnalyst adds the sharper reason: their scale is 0.5-granular and a
            band holds five values, so the round trip asserts a number nobody authored — and its
            DIRECTION depends on parity (4.5 reads harsher, 5.5 read softer). A transform that moves
            a rating either way depending on parity is not a display choice. Route through the
            unrounded path usds/susds/thUSD already use.

            ⚠️ Neither side pre-stages: riskAnalyst will not publish the sentinel until the build is
            approved, because a field with no consumer is a dead key, and the build is not approved
            because it changes a rendered rating on a held asset.
Last reviewed 2026-10-02
```

---

## Cross-asset — belongs to the axis, not to one slug

⚠️ **These are invisible to a per-asset sweep.** Recorded here because an item that no single asset
owns gets skipped by a pass that walks assets, and both of these have been "next" for a day already.

### axis 3 — who owns primary redemption
```
affects     reusd-re reusde-re syzusd usdm usg bold dusd-alto fxusd  (8 publishing a redemption entry)
raised      2026-10-02
what        The "can I redeem with the issuer, and am I eligible" half of the axis has NO owner.
            The specification's ownership table marks it OPEN rather than assigning it.
why         Both market-data producers publish it, coverage is asymmetric in both directions, and
            they contradict each other on live data: on syzUSD PegTracker publishes "not gated" off
            an actual contract probe while DexTracker publishes "unmeasured", and riskAnalyst's
            report disagrees with PegTracker, so our renderer currently withholds the field
            entirely. A reader gets nothing about redemption on that asset.
            ⚠️ Assigning it to PegTracker would strip USG, BOLD, DUSD and fxUSD of their only
            redemption data. Assigning it to DexTracker would promote two riskAnalyst relays to the
            status of measurements.
owner       owner decision, then whoever it lands on
closes when the ownership table's redemption row names an owner and a conflict rule
recommendation it goes to riskAnalyst, and the field splits in two: a mechanical probe of whether
            redemption executes, and an editorial judgement of who is eligible. That split also
            dissolves the syzUSD conflict — both producers are right about different questions,
            which is the same shape as the impact-vs-all-in confusion one layer up.
status      ✅ DECIDED 2026-10-02 and recorded in specs/six-axis-dashboard-spec.md §Axis 3 as
            "SPLIT rather than assigned — owner decision": the PROBE (does the call execute, at
            what cost, to what size) to whoever runs it on its own cadence; the ELIGIBILITY
            judgement (who may actually use it) to riskAnalyst on theirs.
            ⚠️ This status line read "recommended to the owner, not decided" for a day after the
            decision was taken and written into the spec — and I nearly asked the owner to decide
            it twice. A backlog status lagging the spec is the same defect as a stale reason in a
            data file, which this file exists to catch.
            What remains is NOT this decision: it is the typed field each producer must publish
            before the split is implementable, which has its own entry.
Last reviewed 2026-10-02
```

### axis 3 — the five-part ownership proposal is drafted and unsent
```
affects     none directly — fleet-level, and largely superseded by the typed-field entry below
raised      2026-10-01
what        specs/handoffs/DISPATCH-axis3-tiers-2026-10-01.md proposes replacing "who owns the whole
            axis" with five named parts, each with one owner, its own cadence and a declared
            fallback. Needs two corrections before it goes out.
why         The current arrangement is what produced the blank-depth bug: one producer declining to
            publish deleted another's live measurement. The fallback rule is now built for the depth
            part, so the acute failure is fixed — but the ownership it rests on is still only
            written on our side and unagreed by either producer.
owner       us to send; then PegTracker and DexTracker to agree
closes when both producers have responded to the proposal
corrections 1. Venue SIZE moves to DexTracker, not PegTracker. I assigned it on freshness; the
               evidence says consistency — PegTracker's pool rows come in 7 shapes across 11 assets
               (two carry 4 fields and no pool address at all) against DexTracker's 1 shape across
               8, and the two lists cannot be joined.
            2. The redemption row becomes the OPEN question above rather than an assignment. My
               first draft gave it to PegTracker, which would have stripped four assets of their
               only redemption data — the same "tier it, do not strip it" rule the proposal already
               applies to venues, got wrong one field along.
status      ⚠️ DO NOT RETIRE — reinstated 2026-10-03. I marked this for deletion on the strength of
            DexTracker's coverage cap, which they corrected hours later: their owner's "no" was
            about LADDERS, not venues, and DexTracker IS widening venue coverage. So the "tier it,
            do not strip it" sub-decision is live again and the fallback is transitional.
            DexTracker has asked for the proposal file to be UPDATED with the corrected split, and
            for the exact slug list where PegTracker rows venues and they publish nothing.
            Sent 2026-10-03: crvusd apxusd apyusd hastra-prime usdat thusd yzusd susdat — EIGHT,
            computed from data, against the "roughly ten" both sides had been repeating. Their
            list also had usdai, which publishes TVL and volume with NO pool rows at all.
Last reviewed 2026-10-02
```

### usdm — the sentence that bounds its redemption verdict is dropped by the overlay
```
raised      2026-10-02
what        The page now reads "Primary exit: Mento V3 USDm/USDC FPMM — Not gated — public router
            route". PegTracker publishes the sentence that bounds that: "Any address may call swap()
            on the Monad FPMMs — the probe reverts on economics, not permission. The Celo Reserve's
            own mint/redeem is a SEPARATE venue and is allowlisted to strategies; this field
            describes the FPMM only." DexTracker's overlay replaces the axis and its own entry has
            no equivalent note, so that sentence never reaches the page.
why         Not urgent: the venue name says FPMM and the basis says "public router route", so a
            reader is not told they can redeem with the issuer. But "Not gated" is the flattering
            direction, and the one sentence that makes it precise is published and invisible.
            ⚠️ This same lost sentence is what the renderer had been citing as an unresolved
            producer dispute, for weeks, as its reason for withholding the verdict on all seven
            assets. The producer had answered it in the data.
owner       us
closes when the hand-off carries a base scoping note where the overlay's redemption entry has
            none — the same mechanism already built for depth (fe1d82f10) — or DexTracker publishes
            the scope itself.
status      not started. Deliberately left out of 7397dfb6c to keep that change to rendering a
            published verdict rather than widening the merge.
Last reviewed 2026-10-02
```

### cross-asset — the redemption split needs one typed field from each producer
```
affects     reusd-re reusde-re syzusd usdm usg bold dusd-alto fxusd
raised      2026-10-02
what        The specification now splits redemption into a PROBE (does the call execute, at what
            cost, to what size — owned by whoever runs it) and an ELIGIBILITY judgement (who may
            actually use it — riskAnalyst). Nothing in the data distinguishes the two, so the split
            is specced and unimplementable.
why         Measured across the 10 published redemption entries: 3 carry a usable typed prefix, 4
            are prose, and 3 — including BOTH producers on reUSD-RE — publish no basis at all.
            Gating on the prose prefixes would make the wording load-bearing, which the spec
            forbids elsewhere for the same reason.
owner       PegTracker and DexTracker, one field each; then us to route by it
closes when each redemption entry declares which of the two questions it answers
status      not sent. ⚠️ Scope corrected 2026-10-02: this REPLACES the drafted five-part ownership
            proposal (DISPATCH-axis3-tiers-2026-10-01.md), which asked for agreement we do not need
            — ownership is our decision and we choose which fields we read. Fold in the one useful
            remainder: telling each producer which of their fields we actually READ, since a prose
            audit the same day found ~60 fields they publish that reach no reader.
Last reviewed 2026-10-02
```

### weeth — NOT registered, owner decision 2026-10-02. Do not re-raise.
```
raised      2026-10-02 by riskAnalyst
what        Three producers have written weETH payloads — PegTracker (axes 1/2 + the ladder, NAV-
            shaped not CR-shaped, wrapped share re-derived at 96.499%), DexTracker (280 venues
            across four chains), riskAnalyst (liquidity 6.5 headline with per-chain 6.5 / 5.0 / 4.0
            / 2.0 for eth / base / arb / op). None of it reaches a reader.
decision    ⏸ NO DASHBOARD FOR NOW. Owner, 2026-10-02: "i dont want a dashboard for weeth yet."
            Not a judgement on the data or the producers — we are simply not taking the asset on.
why it is   One entry in data/assets.json does three things at once: creates the page, makes the
a decision  hourly sync copy and PUBLISH every weETH file from all three producer repos, and
            expands riskAnalyst's audit scope because their checker reads our registry. Reversible,
            but the data will have been public in the interim.
            ⚠️ The `published: false` half-state does NOT stage anything — the sync builds its file
            list from the registry and ignores that flag. It hides an asset from the menu only.
if revisited two things come with it, both already established and neither needing re-derivation:
            1. weETH is the FIRST depth_threshold_bps entry — 200 bps, not our 50 bps default. The
               test is riskAnalyst's and our spec should have used it: would a 2% move in this
               asset's unit value be a FAILURE of its design? For an ETH-denominated wrapper, no.
               Material: on Arbitrum 50 bps brackets 25-50 ETH against 200 bps at 50-100 ETH. Our
               spec reserved the override for exactly this and said "a volatile asset would be the
               first entry". ⚠️ Owner's to set — the 50 bps default came from two explicit owner
               decisions (2026-09-22, 2026-09-26).
            2. Axes 4, 5 and 6 are NOT refreshed. A topology walk is outstanding with
               security_analyst, so axis 5 would carry a 2026-08-27 hand-walk (renders its real age,
               since our axis clock takes the oldest declared input) and signer_independence is
               "unverified" — riskAnalyst carries the word explicitly, because an absent field and
               an unverified one are opposite claims.
            ⚠️ Unverified on our side: riskAnalyst's `contract_admin` block is a shape our axis-5
            renderer has not seen, so signer_independence may be published-and-unrendered. Check on
            arrival, do not assume.
already     Nothing here was wasted. Three renderer fixes landed from the conversation and none
shipped     depended on weETH existing: the per-chain OBJECT shape (ac08bd855 — weETH's four legs
            would have been dropped silently, Optimism 2.0 under a 6.5 headline), inherited risk
            flags saying they are inherited (b4aec7f90 — live on sUSDe, held), and the producer's
            published depth scope beating our derived one (d2d70a48f).
Last reviewed 2026-10-02
```

### cross-asset — bespoke-renderer pages cannot be audited by a numbered-axis parse
```
affects     usde susde  (the bespoke-renderer assets; weeth too if ever registered)
raised      2026-10-02
what        Five of the six generic axis sections are hidden with inline display:none on
            bespoke-renderer assets (ethena.js does it for susde and usde, replacing them with
            UNNUMBERED panels). So any audit that locates axes by their number finds none.
why         riskAnalyst's checker reported susde as "zero of six axes MISSING" and spent an
            afternoon on it. Their URL was correct — tidresearch.com/dashboards/ fronts our page,
            byte-identical. Their control asset was generic-rendered, so it held the page constant
            and varied the RENDERER without knowing it.
            ⚠️ Nothing is actually absent for a reader: Peg Performance, Backing Breakdown,
            Liquidity & Exit, Dependencies 6/10, Authority walk, Issuer and Risk Flags are all
            visible as unnumbered panels. The numbering is what is missing, by design — a lone
            "5 Contract & Admin" on a page with no 1-4 or 6 reads as a rendering failure.
owner       riskAnalyst for their parse; us only if we want the layout difference documented for
            auditors
closes when the audit keys on the axis LABEL or carries a per-asset bespoke-layout flag
status      explained to riskAnalyst 2026-10-02 with the measurement. Not ours to fix.
⚠️ ours      I told them "susde renders all six axes" on the strength of a classList check and
            section lengths. Both PASS on display:none content. Five sections are not visible; I
            got the reader-facing answer right by luck. Recorded as a memory rule, not a code fix.
⚠️ history   Our comments record that axes 1, 4, 5 and 6 were once hidden with NOTHING put back —
            a security_analyst hand-walk and a ~1,750-char authored basis painting into a
            display:none node for seventeen days. During that window the report would have been
            straightforwardly correct. Worth re-checking after any future bespoke-renderer change.
Last reviewed 2026-10-02
```

### cross-asset — a computed band sits in an authored judgement's seat (4 instances, 3 assets)
```
affects     reusd-re usde susde
raised      2026-10-02
what        Where a live band and an authored score both exist, the chip shows ONLY the band (owner
            decision) and the authored score goes in the tooltip. On four axis-asset pairs the gap
            is at or above our own 2.0-point flag threshold, so it is a real disagreement rather
            than band arithmetic — and on all four the BAND IS THE FRIENDLIER NUMBER.
measured    2026-10-02, our band vs riskAnalyst's authored, both on /10:
              reusd-re  liquidity  10/10 vs 4.5   gap 5.5   (own entry above, DEFERRED)
              usde      peg        10/10 vs 6.5   gap 3.5
              susde     peg        10/10 vs 6.5   gap 3.5
              usde      liquidity  10/10 vs 7.0   gap 3.0
            ⚠️ NOT divergences, below the 2.0 threshold — recorded because riskAnalyst reported one
            of them as a divergence and it is not: susde backing 8/10 vs 6.5 (gap 1.5), usde
            backing 8/10 vs 6.5 (1.5), reusd-re backing 6/10 vs 5.0 (1.0). A band emits only even
            numbers, so an authored 6.5 cannot match one exactly.
why         usde and susde are a held position ($159,736 on susde) and the stale-attestation
            finding is live on both. A reader sees our friendlier number on the axes where the
            analyst is most cautious. ⚠️ Same class as the reUSD-RE entry above, which carries the
            full agreed design for the fix — a producer non-derivability declaration plus our gate.
owner       owner decision (deferred on reUSD-RE 2026-10-02); then riskAnalyst declares, then us
closes when the declaration gate exists and these pairs either resolve or are recorded as accepted
status      ⏸ DEFERRED with the reUSD-RE instance. Not re-raised in status updates.
⚠️ ours      I told riskAnalyst and the owner this class was "already parked in the backlog". Only
            the reUSD-RE instance was. The other three were unrecorded while I described them as
            recorded — which is the shape of claim this file exists to stop. Measured and written
            down rather than left as an assertion.
⚠️ note      USDe's liquidity panel deliberately did NOT gain a score chip in 1fdf4dd2e for exactly
            this reason: adding the band there would have answered the deferred decision by
            implementation, in the generous direction, on a held asset.
Last reviewed 2026-10-02
```

### cross-asset — 7 assets owe the coverage-history element, and silence is the failure
```
affects     hastra-prime msusd-metronome susdat susde susds syzusd thusd  (our half is BUILT; the data gap is per asset)
raised      2026-10-02
what        §4.0's manifest requires a coverage history chart wherever a coverage figure exists,
            and where there is no series the absence must be DECLARED: "coverage is not tracked
            over time". ⚠️ SEVEN assets have the figure, no series, and say nothing — corrected from
            16 after fixing two more bugs in the test (d241f1e88 then the follow-up): it hand-wrote
            a narrow key list while the wider `_COV` tuple sat four lines above, and it ignored the
            manifest's own condition that the element is only owed where a coverage figure exists.
            Each asset has its own entry below so it surfaces at that asset's refresh.
why         The governing rule is explicit — "every element is either RENDERED or its absence is
            DECLARED ON THE PAGE. Silence is the failure." A missing chart with no statement reads
            as an oversight, and ABSENT and UNMEASURED must not look alike.
            ⚠️ sUSDe is the instructive case: its coverage history genuinely belongs to USDe, the
            same reserve pool, and the page carries a "View USDe ↗" link. But a link to another
            asset is not a declaration about this element on this page.
owner       us — a generic declared-absence string in the renderer, not per-asset copy
closes when a coverage figure with no series renders the declared absence instead of nothing
status      ✅ BUILT 2026-10-02 (705fc6341) — the declaration renders, so §4.0 is satisfied on all
            seven and each per-asset entry is closed. ⚠️ Building it uncovered a SEPARATE live
            defect: four assets publish a coverage series under a field name this chart does not
            read. That has its own entry below and is the part still open.
how found   Answering "is sUSDe up to spec?". ⚠️ check_feeds.py was reporting 11 assets as missing
            coverage or composition they DO publish — it read summary.* and backing_breakdown but
            never the six-axis `backing.*` block. Fixed in d241f1e88. Its own comment had predicted
            exactly that failure one shape earlier ("cry-wolf with a work order attached"), and I
            was about to report its three sUSDe gaps as fact without reading the predicate.
            Real conformance for sUSDe after the fix: ONE gap, this one.
Last reviewed 2026-10-02
```


### hastra-prime — coverage-history absence now DECLARED; the data gap remains
```
raised      2026-10-02
what        Publishes a coverage figure (100.21%) with no coverage series, and the page says
            nothing. §4.0 requires the chart where a figure exists, or the absence DECLARED
            ("coverage is not tracked over time"). Silence is the failure.
detail      664 entries and no coverage column at all.
owner       the producer, if a coverage series should exist for this asset
closes when the producer publishes a coverage series, or this is accepted as permanent
status      ✅ OUR HALF DONE 2026-10-02 (705fc6341) — the page now states the absence with what
            would close it, so §4.0 is satisfied and this is no longer a spec gap. What remains is
            a DATA gap: the asset has a coverage figure and no series behind it.
            ⚠️ My earlier version of this entry said "the page says nothing". That was wrong for
            five of the seven — they already declared it, and I had taken the conformance
            checker's data-side verdict for the reader's experience.
Last reviewed 2026-10-02
```

### msusd-metronome — coverage-history absence now DECLARED; the data gap remains
```
raised      2026-10-02
what        Publishes a coverage figure (21.90%) with no coverage series, and the page says
            nothing. §4.0 requires the chart where a figure exists, or the absence DECLARED
            ("coverage is not tracked over time"). Silence is the failure.
detail      349 entries carrying supply only, no coverage column. ⚠️ The figure itself is 21.90% — unusually low for a collateral ratio, so a reader seeing it with no series has no way to tell a structural level from a deterioration. Worth confirming the figure means what the label says when this one is refreshed.
owner       the producer, if a coverage series should exist for this asset
closes when the producer publishes a coverage series, or this is accepted as permanent
status      ✅ OUR HALF DONE 2026-10-02 (705fc6341) — the page now states the absence with what
            would close it, so §4.0 is satisfied and this is no longer a spec gap. What remains is
            a DATA gap: the asset has a coverage figure and no series behind it.
            ⚠️ My earlier version of this entry said "the page says nothing". That was wrong for
            five of the seven — they already declared it, and I had taken the conformance
            checker's data-side verdict for the reader's experience.
Last reviewed 2026-10-02
```

### susdat — coverage-history absence now DECLARED; the data gap remains
```
raised      2026-10-02
what        Publishes a coverage figure (104.08%) with no coverage series, and the page says
            nothing. §4.0 requires the chart where a figure exists, or the absence DECLARED
            ("coverage is not tracked over time"). Silence is the failure.
detail      ⚠️ SHARPER THAN "NO HISTORY": the history carries a `backing_ratio` COLUMN in all 702 entries and it is NULL in every one. Scaffolded and never populated — which is worse than absent, because a consumer testing for the key's presence concludes a series exists. The declaration owed here is not "not tracked" but "declared and never written".
owner       the producer, if a coverage series should exist for this asset
closes when the producer publishes a coverage series, or this is accepted as permanent
status      ✅ OUR HALF DONE 2026-10-02 (705fc6341) — the page now states the absence with what
            would close it, so §4.0 is satisfied and this is no longer a spec gap. What remains is
            a DATA gap: the asset has a coverage figure and no series behind it.
            ⚠️ My earlier version of this entry said "the page says nothing". That was wrong for
            five of the seven — they already declared it, and I had taken the conformance
            checker's data-side verdict for the reader's experience.
Last reviewed 2026-10-02
```

### susde — coverage-history absence now DECLARED; the data gap remains
```
raised      2026-10-02
what        Publishes a coverage figure (101.30%) with no coverage series, and the page says
            nothing. §4.0 requires the chart where a figure exists, or the absence DECLARED
            ("coverage is not tracked over time"). Silence is the failure.
detail      2,175 entries of price, NAV and supply, no coverage column. ⚠️ Its coverage history genuinely belongs to USDe — same reserve pool — and the page carries a "View USDe ↗" link. But a link to another asset is not a declaration about this element on this page, and USDe DOES publish a coverage_ratio series.
owner       the producer, if a coverage series should exist for this asset
closes when the producer publishes a coverage series, or this is accepted as permanent
status      ✅ OUR HALF DONE 2026-10-02 (705fc6341) — the page now states the absence with what
            would close it, so §4.0 is satisfied and this is no longer a spec gap. What remains is
            a DATA gap: the asset has a coverage figure and no series behind it.
            ⚠️ My earlier version of this entry said "the page says nothing". That was wrong for
            five of the seven — they already declared it, and I had taken the conformance
            checker's data-side verdict for the reader's experience.
Last reviewed 2026-10-02
```

### susds — coverage-history absence now DECLARED; the data gap remains
```
raised      2026-10-02
what        Publishes a coverage figure (100.00%) with no coverage series, and the page says
            nothing. §4.0 requires the chart where a figure exists, or the absence DECLARED
            ("coverage is not tracked over time"). Silence is the failure.
detail      2,070 entries of NAV and supply, no coverage column. Same wrapper shape as susde — the coverage belongs to USDS. Check whether USDS publishes a series before declaring the absence.
owner       the producer, if a coverage series should exist for this asset
closes when the producer publishes a coverage series, or this is accepted as permanent
status      ✅ OUR HALF DONE 2026-10-02 (705fc6341) — the page now states the absence with what
            would close it, so §4.0 is satisfied and this is no longer a spec gap. What remains is
            a DATA gap: the asset has a coverage figure and no series behind it.
            ⚠️ My earlier version of this entry said "the page says nothing". That was wrong for
            five of the seven — they already declared it, and I had taken the conformance
            checker's data-side verdict for the reader's experience.
Last reviewed 2026-10-02
```

### syzusd — coverage-history absence now DECLARED; the data gap remains
```
raised      2026-10-02
what        Publishes a coverage figure (110.98%) with no coverage series, and the page says
            nothing. §4.0 requires the chart where a figure exists, or the absence DECLARED
            ("coverage is not tracked over time"). Silence is the failure.
detail      NO history file at all, so nothing to chart and nothing said.
owner       the producer, if a coverage series should exist for this asset
closes when the producer publishes a coverage series, or this is accepted as permanent
status      ✅ OUR HALF DONE 2026-10-02 (705fc6341) — the page now states the absence with what
            would close it, so §4.0 is satisfied and this is no longer a spec gap. What remains is
            a DATA gap: the asset has a coverage figure and no series behind it.
            ⚠️ My earlier version of this entry said "the page says nothing". That was wrong for
            five of the seven — they already declared it, and I had taken the conformance
            checker's data-side verdict for the reader's experience.
Last reviewed 2026-10-02
```

### thusd — coverage-history absence now DECLARED; the data gap remains
```
raised      2026-10-02
what        Publishes a coverage figure (26.23% (on_chain_coverage_pct)) with no coverage series, and the page says
            nothing. §4.0 requires the chart where a figure exists, or the absence DECLARED
            ("coverage is not tracked over time"). Silence is the failure.
detail      NO history file at all. ⚠️ And the figure is an ON-CHAIN coverage share rather than a collateral ratio — >30% of backing is off-chain by the producer's own note — so a series would need to track the same quantity the figure names.
owner       the producer, if a coverage series should exist for this asset
closes when the producer publishes a coverage series, or this is accepted as permanent
status      ✅ OUR HALF DONE 2026-10-02 (705fc6341) — the page now states the absence with what
            would close it, so §4.0 is satisfied and this is no longer a spec gap. What remains is
            a DATA gap: the asset has a coverage figure and no series behind it.
            ⚠️ My earlier version of this entry said "the page says nothing". That was wrong for
            five of the seven — they already declared it, and I had taken the conformance
            checker's data-side verdict for the reader's experience.
Last reviewed 2026-10-02
```

### cross-asset — four assets publish a coverage series this chart cannot read
```
affects     usde usdai usdat cusd
raised      2026-10-02
what        USDe (2,175 readings of `coverage_ratio`), USDai (731, same), USDat (706 of
            `backing_ratio`) and cUSD (708, `coverage_ratio` plus `coverage_pct`) all publish a
            real coverage series. The chart reads `collateral_ratio` ONLY, so none of them plots.
why         Published-but-unrendered, this repo's most repeated defect, on four assets including a
            held one. ⚠️ Until today it rendered as "no collateral-ratio history is published",
            which blamed the producer for data they published. The page now names the field and
            says the gap is ours (705fc6341) — visible rather than silent, but still unplotted.
owner       us
closes when the chart reads the published field names and plots them
⚠️ hazard    THE SCALE IS THE WHOLE RISK. These values are RATIOS — 1.0004, 0.9999, 1.0 — where
            this chart plots PERCENTS. Scale here is resolved by declaration or an explicit
            raw-ratio list, NEVER by magnitude, because a magnitude guard inverted at 200% once
            before. Plotting 1.0004 as 1.0004% is precisely what that rule prevents. So each of
            the four needs its scale confirmed — declared in the feed or added to the list — before
            the field name is widened. cUSD is the useful case: it publishes BOTH a ratio and a
            percent, so it can corroborate the conversion rather than assume it.
status      not started. Deliberately separated from the declaration fix: one is a sentence, this
            is a plotted number on four assets with a known mis-scaling trap.
Last reviewed 2026-10-02
```

### fxusd — ✅ CLOSED: the issuer score was authored all along; its frontmatter link was missing
```
raised      2026-10-02
what        fxusd's page renders "Issuer 5.5/10". riskAnalyst's new score-derivation check reports
            that value as an ORPHAN — a score in their overlay with no frontmatter counterpart, so
            no report authored it. ⚠️ The field asserts the opposite: issuer_score_source is
            "riskAnalyst:authored", generated_at 2026-09-22. Both cannot be right.
why         ⚠️ They assessed it as not reader-visible because the asset is production:false on
            their side. It IS reachable here: fxusd is registered in data/assets.json with no
            `published` flag, so it is absent from the index and renders at ?asset=fxusd. Our own
            feed checker calls those four assets "built, reachable by direct link, NOT in the
            index". Unlisted is not staged — same lesson as "writing to a listed source root
            publishes", one layer out.
            An unauthored number carrying an authored-source label is worse than a missing one: a
            reader has no signal, and neither does an auditor.
owner       riskAnalyst to resolve the orphan (a human call — a missing axis is not a low axis, and
            they declined to resolve it by copying the underlying's number across). Then us only if
            the field is withdrawn.
closes when the score has an author, or is withdrawn from the overlay
status      ✅ CLOSED 2026-10-02. riskAnalyst transcribed all three judgements into frontmatter
            with their provenance; their check now reports 0 diverged, 0 orphan across 136 files
            and 176 values. fxUSD's live chip has the author it was claiming. Our copy is unchanged
            and byte-identical to theirs — the fix was the author record, not the number.

⚠️ MY FRAMING WAS WRONG AND THE EVIDENCE WAS IN OUR OWN COPY. This entry was titled "an issuer
            score riskAnalyst says nobody authored". The judgement existed and was substantively
            argued: `data/fxusd_issuer.json` carries FOUR sourced facts — protocol TVL $134.3M
            Ethereum-only (DefiLlama, dated), an OpenZeppelin audit at commit 56a47eab with
            1 Critical / 2 High / 7 Medium / 13 Low / 23 Note and 5 resolved, and a responsibly
            disclosed finding marked never exploited — plus a 308-character summary. I wrote
            "unauthored" from their tool's verdict while holding the basis locally and not reading
            it. ⚠️ AN ORPHAN IS EVIDENCE OF A BROKEN LINK, NEVER OF A FABRICATED NUMBER, and the
            two have OPPOSITE fixes: one restores the link, the other deletes the number.
            riskAnalyst nearly deleted three argued assessments on the same reading.
            ⚠️ And my "wider exposure" paragraph below overstated it on the same mistake — the
            detector matters less than I implied, because what it detects is a missing record and
            not a missing argument.
note        The other two orphans (fxsave backing 4.5, fxsave issuer 5.5) are NOT live here —
            fxsave is unregistered and we hold no fxsave overlay. One of three is reachable, and it
            is the one with the authored-source claim attached.
⚠️ wider     Worth a pass of its own: are there OTHER scores on our pages whose claimed provenance
            nothing can corroborate? We cannot see riskAnalyst's frontmatter, so their derivation
            check is the only detector — which means our exposure to this class is entirely
            dependent on a tool in another repo that was built today.
Last reviewed 2026-10-02
```

### fxsave — NOT registered; carries a live condition that can move two scores
```
raised      2026-10-02 by riskAnalyst, recorded for if this asset is ever registered
what        fxSP `previewRedeem(1e18)` returns 0.976407 — the pool redeems ~2.4% BELOW PAR — and
            whether that is a BASE FEE or ACCUMULATED STABILITY-POOL LOSSES is unestablished since
            2026-09-22. ⚠️ If it is losses, fxsave's authored backing 4.5 AND stability 5.0 are
            both wrong.
why         Not live: fxsave is unregistered here and we hold no fxsave files. Recorded because a
            2.4% sub-par redemption with an unresolved cause is exactly the fact a new dashboard
            would render as a clean number — and because the condition sits UNDER a score that is
            now properly sourced, which makes it easy to read as settled.
owner       riskAnalyst / the producer to establish fee-vs-losses; us only on registration
closes when the cause is established, or registration is declined permanently
note        fxsave's backing overlay deliberately carries
            `backing_score_applies_when: collateral_ratio_declared_underivable` — the §6.3 gate —
            so a consumer cannot silently drop its authored score on an asset that emits no ratio.
            That is the mechanism our liquidity axis still lacks.
            Both fxusd and fxsave remain 5 of 6 axes: neither carries `underlying_score`.
Last reviewed 2026-10-02
```

### cross-asset — the unread-field marker is blind to new BLOCKS, only to new prose
```
affects     syrupusdc susde reusd-re reusde-re  (marker is BUILT; adopting each named block is per asset)
raised      2026-10-03
what        riskAnalyst's axis-5 re-scope adds `contract.assurance` — an 11-field block (audit
            engagements, bounty, formal_verification, test_coverage, effect_on_score and more) — to
            syrupusdc, susde and weeth. ⚠️ Verified by merging their file: it lands in
            data.contract.assurance, NOTHING renders it, and the unread-field marker does NOT name
            it. The marker inspects only STRING values ≥120 chars, so it names `authority_note` and
            `provenance_note` on that same asset and is silent on an 11-field structure.
why         The marker exists precisely so a published field cannot vanish unnoticed — its own
            comment records being "blind to the schema next door" once before and being widened to
            cover every merge-mode overlay. It is still blind, now to a SHAPE rather than a schema:
            prose is detected, blocks are not. So the most repeated defect in this repo has a
            detector that covers half the cases.
            ⚠️ syrupusdc is REGISTERED, so this is a live silent drop on a reader-facing asset, not
            a future one. susde too. weeth is declined, so its block is correctly unreachable.
owner       us
closes when an unread object-valued key is named the way an unread prose field already is
tractable?  YES, measured 2026-10-03: across every synced overlay only 5 object-valued keys are not
            obviously read — `float_split`, `measurement_clocks` and the three `*_score_change`
            variants, and the last three ARE read via dynamic key access so they are false
            positives of a source-text test. So the marker would need an explicit known-blocks
            list rather than introspection, and would fire on roughly two keys today plus
            `assurance` when it syncs. Not noisy.
⚠️ do NOT   render the assurance block itself as part of this. riskAnalyst named three traps in
            syrupusdc's copy that must not read as credit — "8+ total audits" predates the asset's
            existence, Trail of Bits states it "did not look for security flaws", and formal
            verification is not established — plus a protocol-level Maple bounty on a
            product-level page. Their block carries `effect_on_score: NONE` with the reason, which
            is the field that stops a reader inferring the score moved. Rendering assurance is its
            own job with its own care; NAMING the unread block is this one.
status      ✅ BUILT 2026-10-03 (af507bd23). AUTHORED_BLOCK_KNOWN mirrors the prose adoption list;
            unread object- and array-valued fields are now named with their field count.
            Verified across all 32 assets and every axis: fires on exactly 2, zero false positives
            on the six known blocks, and pre-tested against riskAnalyst's un-synced files so both
            syrupusdc and susde will say "unread block: assurance" the moment it arrives.
⚠️ found    Its first real output is a genuine one, which is the validation that matters:
            reusd-re and reusde-re publish `eligible_sleeve_assets` = ["sUSDe","USDe","USDC",
            "T-Bills"] and nothing reads it. What the backing is PERMITTED to hold is reader
            content, so that is now its own item below.
⚠️ limit    The known-blocks list is GLOBAL while the reading is PER-RENDERER. float_split and
            measurement_clocks are read by dusd-alto.js alone, so listing them silences the marker
            for every other asset. A floor on detection, not a guarantee — same trade the prose
            list already makes.
Last reviewed 2026-10-03
```

### reusd-re · reusde-re — `eligible_sleeve_assets` is published and reaches no reader
```
raised      2026-10-03, by the unread-block marker's first run (af507bd23)
what        Both publish backing.eligible_sleeve_assets = ["sUSDe","USDe","USDC","T-Bills"] and
            nothing renders it. The page now NAMES it as an unread block, so the omission is
            visible rather than silent — but the content still does not reach a reader.
why         What a sleeve is PERMITTED to hold is reader content, not plumbing: it bounds what the
            backing can become, which a point-in-time composition table does not. On reUSD-RE the
            list includes sUSDe, so the permitted set reaches an asset whose own custody findings
            we already render as inherited.
owner       us — adopt it in the backing panel beside the composition
closes when the permitted set renders, or is recorded as deliberately internal
status      not started. Small and self-contained; the marker will keep naming it until it lands.
note        ⚠️ A permitted-set list must not render as a holdings list. These are four names with
            no amounts — a reader seeing them beside a composition table could read them as
            current positions. The label has to carry "permitted", not "held".
Last reviewed 2026-10-03
```

### syrupusdt · syrupusdc — an audit-count credit that predates the asset is live today
```
raised      2026-10-03
what        Both pages render "8+ published audits across the Maple v2 corpus" and
            "✅ ... 8+ audits ... roughly a three-year clean operating record" — the second with a
            green tick, i.e. explicitly as credit. Both inside collapsed disclosures, so one click
            from view rather than immediately visible.
why         ⚠️ riskAnalyst's temporal argument: syrupUSDC did not exist when three of those reviews
            (Dec 2022) or two more (Jun 2023) were performed. An audit cannot have covered an asset
            that post-dates it, so the count is wrong wherever it appears — not merely unscoped,
            and not fixable by relabelling. They raised it as a do-not for the pending `assurance`
            block; it is already live through `code_facts` and the issuer summary, which we DO read.
            ⚠️ And one of the same strings carries a Trail of Bits citation whose own report says it
            "did not look for security flaws" — the audit NAME is the part a reader recognises and
            the disclaimer is the part they do not.
owner       riskAnalyst / security_analyst — the claim is theirs to scope or withdraw; we render
            their prose verbatim and must not edit it here
closes when the count is scoped to reviews that could have covered the asset, or withdrawn
status      flagged to riskAnalyst 2026-10-03 with the live locations. Not ours to edit.
note        A $1M bounty figure in the same two strings was 2x the real $500,000 and self-resolved
            on the next sync — they corrected it in four payloads and carried a `correction_note`
            on the data rather than only in a commit message, which is why we could see it moved.
            The audit count is the half that did NOT self-resolve.
Last reviewed 2026-10-03
```

### syrupusdt — authored Liquidity 6.0 correctly refused; the fix is the producer's
```
raised      2026-10-03 by riskAnalyst as "nothing renders"
what        The liquidity chip reads "Not rated" and their authored 6.0 appears nowhere visible.
            ✅ WORKING AS SPECIFIED, not a defect: §6.3 allows an authored score to FILL an absent
            band only on an explicit non-derivability declaration, and their overlay carries none.
            Our tooltip states the refusal and names the three field values that would satisfy it.
why recorded ⚠️ riskAnalyst grouped this with the deferred band-vs-authored question. It is the
            other branch of the same asymmetry we agreed 2026-09-08: DIVERGE is a band existing and
            disagreeing (deferred, owner's call); FILL is no band plus an undeclared authored score
            (specified, producer's move). Mis-grouping it would have parked a thing that needs no
            decision behind one that does.
owner       riskAnalyst — publish any one of the declaration signals and it renders on next sync
closes when the declaration is published, or the absence is accepted
status      answered 2026-10-03. Nothing owed from us; no code change.
Last reviewed 2026-10-03
```

### syrupusdc · syrupusdt — ✅ CLOSED: rating and depth restored; hand-off generalised
```
raised      2026-10-03, by riskAnalyst asking why only one pool had a band
what        Both pages now read chip "Not rated" and "0.5% depth n/a". At 21:17 on 2026-10-02 both
            carried a computed band (syrupusdc Stress 2/10, syrupusdt 4/10) from PegTracker's
            `band_score`. DexTracker liquidity overlays for BOTH arrived in the 22:11 sync
            (47d69705c) and the band disappeared.
cause       `liquidity/1` is adopted in REPLACE mode, so the overlay supersedes the whole axis and
            drops the base's `band_score` and `free_liquidity_pct` — the fields the rating was
            computed from. ⚠️ syrupusdt's overlay has no `depth` key AT ALL (keys: asset_slug,
            asset_symbol, distribution, enumeration, methodology, scope, token_registry,
            token_resolution, venues), so it supplies no replacement.
⚠️ MINE      This is the suppression class fixed yesterday for reUSD-RE and syzUSD (fe1d82f10), and
            the hand-off is too narrow in TWO ways:
            1. It fires on `typeof base.total_2pct_depth === 'number'`. Syrup publishes that as
               NULL BY DESIGN with the crossing nested at `exit_mark.depth`, so the condition is
               false and nothing carries.
            2. It carries depth fields only. `band_score` and `free_liquidity_pct` are RATING
               inputs of a different kind and are not in the carry list at all.
            So yesterday's fix answered the shape it was shown and not the class.
why escalated A rating and a depth figure that existed yesterday evening are gone from two
            REGISTERED pages, and "0.5% depth n/a" asserts no depth is known while PegTracker's
            ladder (8 rungs, floor at >=$1M, both crossings) sits underneath. That is the FALSE
            case the triage rule reserves escalation for, identical to the one closed yesterday.
owner       us
closes when both pools render their band and depth again, with the carry generalised rather than
            widened once more for this shape
⚠️ note      riskAnalyst's five "byte-identical gate flags" were all irrelevant: the band never came
            from depth on these assets. It came from free-liquidity `band_score`. And the asymmetry
            they could not reconcile was two observations taken either side of the 22:11 sync — the
            overlays arrived for BOTH pools in the same commit.
status      ✅ FIXED 2026-10-03 (5f7db40cc). syrupUSDC renders 1/5 with a $1.0M floor, syrupUSDT
            3/5. 29 assets byte-identical.
            The trigger is now an OUTCOME (does the overlay supply a rating or figure at all?) and
            the carry is DEFAULT-ON with a 14-key deny-list rather than an allow-list — because
            replace drops 50 distinct base fields across 8 assets and an allow-list loses whatever
            nobody thought of, which is how this recurred.
⚠️ cost      Three wrong versions first, each caught by the fleet A/B and none by review: an empty
            `quotes` object is truthy (usdm ships `{}`); "any depth status is a claim" broke usdm,
            then once widened broke reUSD-RE and syzUSD, because a DECLINING overlay also sets a
            status. The distinction already existed here — DEPTH_NON_DERIVABLE_STATUSES means "no
            curve by design", while "not_measured" is a refusal. Every wrong version showed 3 or 4
            assets moving where 2 should have, so a check limited to the two broken assets would
            have passed all three.
Last reviewed 2026-10-03
```

### apxusd · apyusd — ⚠️ we author an unsourced audit + formal-verification claim in a Trust Stack panel
```
raised      2026-10-03
what        js/renderers/apyx.js hardcodes APYX_AUDITS and renders it, VISIBLE and uncollapsed, in
            a panel titled "Trust Stack":
              "Audits: Quantstamp + Zellic + Certora (formal verification) (3 total) ·
               Bug bounty: none disclosed"
            Confirmed on the live apxusd page 2026-10-03. Serves both apxusd and apyusd.
why         ⚠️ It is OUR claim, not a producer's — a hardcoded constant, so no producer sync can
            correct it and no provenance field carries a source or a date. That is the failure the
            apyx trust-banner incident already set a rule against: do not author security,
            custody or attestation claims in reader-facing copy.
            ⚠️ "(formal verification)" is the specific claim riskAnalyst established is NOT citable
            elsewhere without published proofs — on syrupUSDC they ruled that symbolic execution and
            invariant monitoring are neither. We assert it here with no citation at all.
            ⚠️ And "none disclosed" is a negative claim about a bounty with no as-of: if a program
            launches, the page keeps asserting its absence.
owner       us to remove; security_analyst / riskAnalyst if the facts should be re-established
closes when the hardcoded constant is gone and either a producer field renders in its place or the
            absence is declared
⚠️ sequence  Removing it leaves nothing, and §4.0 wants audits rendered where published and the
            absence DECLARED otherwise — so the honest end state is a declared absence, not silence.
            Neither producer publishes an assurance block for these two today (they exist for
            syrupusdc, susde and weeth), so there is nothing to render in its place yet.
note        Same pattern and same panel title as the syrupusdc/syrupusdt case below, which is where
            this was found — three of four renderers carrying hardcoded trust claims were found by
            checking the fourth.
Last reviewed 2026-10-03
```

### usdai · susdai — ⚠️ we author audit finding-counts and a bounty claim with no source or date
```
raised      2026-10-03
what        js/renderers/usdai.js hardcodes and renders, in a panel titled "Governance & Trust":
              "Audit: Cantina (Spearbit) reviewed USDai + sUSDai — 0 critical / 0 high /
               1 medium (fixed) / 8 low. Live bug bounty; audit set shared across both tokens."
            Serves both usdai and susdai.
why         ⚠️ Ours, hardcoded, with no source and no as-of. Specific finding COUNTS are the most
            citable-looking form a claim can take and the most quickly stale — if that review is
            superseded or re-scoped, the page keeps publishing 0/0/1/8 indefinitely.
            ⚠️ "Live bug bounty" with no programme, no maximum and no date is the shape that was
            wrong by 2x on syrupUSDC ("Immunefi $1M+" against a measured $500,000 maximum) — and
            there it was at least specific enough to be checked. This one cannot be falsified by a
            reader at all.
            ⚠️ "audit set shared across both tokens" asserts coverage of sUSDai by a USDai review.
            That is the TRANSFERRED-versus-MEASURED distinction riskAnalyst added to syrupusdt's
            assurance block precisely because a sibling's evidence reading as this asset's is the
            failure mode on paired assets.
owner       us to remove; the producers if the facts should be re-established
closes when the hardcoded strings are gone and either a producer field renders or the absence is
            declared
Last reviewed 2026-10-03
```

### syrupusdc · syrupusdt — ✅ our hardcoded audit/bounty claim removed
```
raised      2026-10-03
what        js/renderers/syrupusdc.js hardcoded, and rendered visible and uncollapsed in a "Trust
            Stack" panel: "Audits: Spearbit + Trail of Bits + 6 others (8+ total) · Bug bounty:
            Immunefi $1M+". Ours, not a producer's, so no sync could correct it.
why         Wrong on four counts: the programme maximum is $500,000 so "$1M+" asserted a FLOOR
            above the real MAXIMUM; it is Maple's protocol programme over 43 assets, not this
            pool's; five of the "8+" reviews predate the asset's existence; and Trail of Bits'
            own report says it "did not look for security flaws".
status      ✅ REMOVED 2026-10-03 (24790658b). Nothing replaces it — the declared-absence form
            would be "no audit published", which is itself false. riskAnalyst publishes an
            assurance block on axis 5 for both pools under an anti-offset rule; not synced, not
            adopted, and adopting it is its own job.
note        Found only because riskAnalyst asked us NOT to restore facts they were removing — not
            by reviewing this file. The same pattern in apyx.js and usdai.js has its own entries.
Last reviewed 2026-10-03
```

### dusd-alto — CLOSED 2026-10-03, WILL NOT RENDER: the float figures stay off the page
```
affects     dusd-alto
raised      2026-10-03 by DexTracker
what        `depth.third_party_float` joins the existing `depth.depth_usd`:
              depth_usd           supply outside the pool — the UPPER bound, ~$26.5K today
              third_party_float   that minus Alto's 2 borrow markets + 2 fee timelocks, ~$2,347
            Carries status (measured | not_assessed — a failed balance read never shows as zero),
            usd, units, protocol_holders{label: units}, method "residual", semantics and
            holder_list_source. Their user chose to show BOTH; the headline is unchanged.
why         ⚠️ THE SELLABLE AMOUNT LIES BETWEEN THE TWO, because borrow-market DUSD can be
            borrowed and sold. So neither figure alone is the answer and the smaller one must NOT
            read as the depth: rendering $2,347 next to a $26.5K cap without that sentence invites
            a reader to take the lower number as the real exit. The producer's own basis names both
            and says so — render it beside the cap labelled as held by ordinary holders, not
            instead of it.
⚠️ CORRECTED  2026-10-03, by DexTracker on riskAnalyst's finding: BOTH FIGURES ARE CEILINGS, of
 2026-10-03  different things, and the smaller one is NOT a measurement of third-party holdings.
            The issuer holder list dates from 2026-09-20 and supply has grown 61% since, so a
            newer issuer contract would be counted as an ordinary holder. The block now carries
            `is_upper_bound: true`, `upper_bound_basis` and `holder_list_as_of`.
            REQUIRED WORDING, theirs: "at most $X held by ordinary holders (issuer list as of
            2026-09-20)". Not "$X held by" — ⚠️ a bound rendered as a quantity is the exact error
            the between-them sentence exists to prevent, one level down. Render
            `holder_list_as_of`, not the payload's `as_of`: the figure is as stale as the LIST,
            and the two differ by two weeks.
            So the pair is: cap bounds supply outside the pool · residual bounds third-party
            holdings. Neither is the sellable amount; it lies between them.
owner       nobody — CLOSED
⚠️ DECIDED   2026-10-03, by the user, asked directly whether to render the pair or show depth
            alone: "depth alone is fine". So `depth.holdings` — supply_outside_pool_usd,
            third_party_float, excluded_pool_holders, lp_withdrawal_caveat — is DELIBERATELY
            UNRENDERED. Not a gap, not a backlog item, not something to fix on refresh.
why closed  Once DexTracker moved the clamp off the depth field (depth is now total supply, with
            the crossing kept beside it), the float figures stopped being load-bearing. The
            reason they had to be rendered was that one of them WAS the depth and a reader
            needed the correction. That is gone. What remains is context the user does not want
            on the tile — their own framing: "26k isn't a meaningful number except for reference
            for this. it's useful to know and it's not relevant for sell depth."
⚠️ do not    re-raise this as an unread-field gap. It will look like one: two measured dollar
   reopen   figures, a status, a caveat, all published and none rendered, and nothing flags them
            (they are nested inside `depth`, which is on the known-blocks list, so the unread
            marker is blind to them by design — see the note below). ⚠️ An audit that greps for
            published-but-unrendered fields WILL surface these. The answer is this entry.
reopen if   the depth figure ever goes back to being bounded by anything other than total supply
            — then a reader needs the distribution again to read the number. Also if DexTracker
            ever publishes a float figure that is NOT a ceiling, since the whole difficulty here
            was that both figures were upper bounds on different things.
⚠️ silent    It will NOT be flagged on arrival. The unread-block marker (af507bd23) scans only the
            TOP level of an axis block, and `third_party_float` is nested inside `depth`, which is
            on the known-blocks list — so we skip without descending. Second new nested block
            today after contract.assurance, which WAS caught because it sat at the top level.
            Recorded as the marker's limit rather than widened: descending into `depth` would name
            every sub-key we do not read (bracket_50bps, per_chain, anchor, quote, rungs) and a
            noisy marker is one a reader learns to ignore.
⚠️ do not    render a change or trend on this figure yet. Today's 2,347 against riskAnalyst's 946.70
            at block 26,053,732 is NOT established as holder growth — supply also grew 823K to
            1.32M, and the residual OVERSTATES if an unlisted protocol holder appears. DexTracker
            has asked riskAnalyst to re-check the holder set first. ⚠️ Now right TWICE OVER
            (their words): the stale holder list means the growth could be entirely an uncounted
            issuer contract. DexTracker is running a minter-attribution check on who received the
            +500K. Do not plot this series until that returns.
note        The phrase "third-party float" ALREADY appears on the page inside the producer's basis
            prose ("third-party float — the 2% crossing sits above it at ≥$3…"), so a reader meets
            the concept with no figure attached. That makes the structured block's absence easier
            to miss, not harder.
Last reviewed 2026-10-03
```

### dusd-alto — RESOLVED 2026-10-03: the depth tile no longer shows a distribution snapshot
```
affects     dusd-alto
raised      2026-10-03 by the user
what        `depth.depth_usd` publishes $26,495 — DUSD sitting outside the pool right now — and our
            depth tile renders it as the measured 0.5% figure. TWO DIFFERENT BOUNDS ARE MERGED:
              total supply  $1,323,765   HARD. Depth can never exceed it. The producer's
                                         impossibility check against it is CORRECT.
              float         $   26,495   NOT a bound on depth. A snapshot of who holds. Mint 100K
                                         to users and it sells at the same cost — the curve did
                                         not move, the distribution did.
why         ⚠️ IT INVERTS THE READING, which is why this is not cosmetic:
              pool 0.5% crossing   $3,126,953   2.36x total supply
              pool 2.0% crossing   $3,373,047   2.55x total supply
              max routed output    $3,364,882   saturation at $10M input
            The true statement is EVERY DUSD IN EXISTENCE CLEARS INSIDE 0.5%. Rendered as $26,495
            it reads as one of the thinnest assets we track. Opposite conclusions from one field.
⚠️ not a    The producer's finding is RIGHT and is the most interesting fact about this asset —
   defect   `axis_binding_constraint` already says "the binding fact is how little DUSD can reach
   in the   the market, not the curve". The objection is to WHERE IT LANDED, not to the finding.
   finding  It sits in the depth field, where it reads as a curve measurement.
proposed    depth_usd = the pool's crossing, clamped at TOTAL SUPPLY when it exceeds it, with a
            status like clears_entire_supply. Both float figures beside it as distribution facts,
            explaining why the depth figure is untestable in practice rather than overwriting it.
⚠️ caveat   Float and depth are NOT independent here: the treasury's 61.9% of LP is BOTH SIDES.
            Withdrawing it raises float to 517,907 AND drops the crossing to ~$961K (producer's
            own figures). So "if more were outside it would sell fine" holds for NEWLY MINTED
            float, not for float created by LP withdrawal. Keep this sentence wherever the pair
            is rendered — it is the non-obvious half.
owner       nobody — RESOLVED, both halves shipped
✅ theirs    DexTracker accepted the objection the same day (their user agreed) and re-measured:
            depth_usd is now total supply with status `clears_entire_supply`, the crossing is
            retained in curve_crossing_above_supply, and the distribution moved to a separate
            `depth.holdings` block. Published as a GENERAL rule, not a DUSD patch: a crossing
            above total supply is clamped and labelled, and a crossing between float and supply
            is published as measured instead of clamped to float.
✅ ours      The new status would have BANDED (4/5, graded on the asset's own supply) and
            displaced riskAnalyst's authored 5.5. Fixed in the same day's commit — see
            DEPTH_NON_DERIVABLE_STATUSES. The old status is kept beside the new one.
⚠️ left over riskAnalyst's authored basis still argues the retired facts — it cites "the published
            depth is the FLOAT CAP of 23,935 DUSD" and a "$823K market cap" against a supply of
            1.32M. The SCORE is still right and arguably better supported than when written; the
            sentence a reader sees is two weeks behind. Theirs. Passed to them via DexTracker,
            who was already in contact about the holder set.
closes when the depth figure is bounded by supply rather than by float, or they justify the float
            cap and we render the inversion risk on our side
Last reviewed 2026-10-03
```

### dusd-alto, all venue-table assets — three new TVL-trust fields are unread
```
affects     dusd-alto, bold, fxusd, reusd-re, reusde-re, syzusd, usdm, usg + the 13-asset rebuild
raised      2026-10-03 by DexTracker, ahead of publishing
what        Each venue row will carry `tvl_status` ("reported" | "implausible"),
            `tvl_exclusion_basis` and `custody_check` ("not_checked" for pool types that do not
            hold their own tokens — v4, Balancer, Fluid). An implausible row stays LISTED but
            drops out of every total on their side. ⚠️ All three appear ZERO times in our
            renderer (measured 2026-10-03).
why         An `implausible` row renders as an ordinary row carrying a TVL the producer has
            explicitly told us not to trust, and a `not_checked` custody row renders as a
            verified one. Their exclusion holds in their totals and is INVISIBLE in our table.
            ⚠️ The figures are not slightly off: GeckoTerminal read Curve crvUSD/WETH/CRV at
            $6.94B, then $964M an hour later, against ~$2-3M actually on-chain — a drained leg
            breaks the indexer's price maths. Their first guard then condemned real pools ($5M
            syrupUSDT on v4, $4M thUSD), which is why the custody check is scoped by pool type.
owner       us
decided     Told them to publish WITHOUT waiting for us — better to hold the fields with a gap on
            our side than a clean table built on TVLs they know are wrong. ⚠️ So the obligation is
            ours: do NOT show a venue table on any asset until the three states render.
closes when implausible rows render as excluded-and-why, and not_checked renders as unverified
            rather than as verified
Last reviewed 2026-10-03
```

### venue-payload assets — three chain-level facts published and unrendered
```
affects     crvusd, apyusd, susde (no local dollar exit) · thusd (chain not queried) ·
            wsteth, weeth (chains truncated — both UNREGISTERED, so no page today)
raised      2026-10-03 by DexTracker, with the venue batch
what        Three keys inside `enumeration`, none read:
              chains_without_local_dollar_exit   apyusd: base, bsc, solana
                                                 crvusd: bsc, fraxtal, taiko, xdai
                                                 susde:  blast, fraxtal, mantle, monad
              chains_not_queried                 thusd on Stable — no indexer exists
              chains_truncated                   GeckoTerminal's 10-page cap, so the chain
                                                 count is a FLOOR not a total
why         ⚠️ The first is the strongest of the three and the reason this is not cosmetic:
            "holders on those chains have no local exit" is a harder statement about a
            holder's actual position than any TVL row on the page. A reader holding crvUSD on
            bsc learns nothing today.
            The second and third are both ABSENCE-vs-ZERO: an unqueried chain and a truncated
            list each render as a complete enumeration, which is the failure the venue clock
            and the live_venue_count floor were separately built to avoid. Same class, third
            instance.
owner       us — these are published fields, nothing is owed by the producer
✅ cheap     The per-chain table ALREADY has the column: `no_local_swap_venue` renders as
            "none — holders cannot exit locally". So the dollar-exit key is a wiring job, not
            a design one. ⚠️ But `by_chain` is a DIFFERENT producer structure from
            `enumeration.chains_without_local_*`, so confirm they agree on a shared asset
            before routing one into the other — two sources for one claim is how the
            axis-3 clock split started.
⚠️ and the  weeth and wsteth are NOT registered (owner decision 2026-10-02: no weETH
   two      dashboard yet), so chains_truncated has no reader today. Do not register an asset
   truncated to render a field.
not done    deliberately, 2026-10-03: the same pass fixed a live wrong figure (crvUSD's
   in the   rejected $1.4M row) and mixing an enrichment into a correctness fix makes the A/B
   same pass unable to tell which change moved what. 12 panels moved for the fix alone.
closes when the no-local-exit chains render per asset, and an unqueried or truncated chain
            list stops reading as a complete one
Last reviewed 2026-10-03
```
