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
4. **The cross-asset section** at the end — items that belong to the axis rather than to one
   slug, so they are invisible to a per-asset sweep and get skipped forever otherwise.
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
status      requested 2026-10-02 (live message + handoffs/inbox/thusd-exit-ladder-venue-selection-2026-10-02.md
            in their repo, status blocked on their codex rollout guard; with their user to decide)
note        Their own note says the blocker is venue selection across Ethereum/Arbitrum/Stable. Their
            own venues array says Ethereum holds 99.2% and Arbitrum is self-labelled dust at $0
            volume, so an Ethereum-only ladder labelled as one leg probably answers it. Asked, not
            asserted.
Last reviewed 2026-10-02
```

### ousd — not on the six-axis layout at all
```
raised      2026-10-02
what        The file carries none of the six axis sections, and the layout switches off when the peg
            section is absent. So OUSD shows no axis 3 rather than an empty one.
why         Looks like a liquidity gap and is not one. I twice reported it as a missing measurement
            before checking which layout it was on.
owner       product decision (yours), then PegTracker for the sections + riskAnalyst for the
            editorial axes
closes when either migrated, or recorded as deliberately legacy so nobody re-raises it
status      not requested — migration is a decision, not a defect
note        Six others are in the same state: usdd, cusd, strc, strcx, mstr, bmnr. The last four are
            equity-style instruments where a trading ladder is not the right question anyway.
Last reviewed 2026-10-02
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
status      recommended to the owner 2026-10-02, not decided. riskAnalyst notified as NOTICE only
            and is not acting on it.
Last reviewed 2026-10-02
```

### axis 3 — the five-part ownership proposal is drafted and unsent
```
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
status      drafted, corrections identified, not sent — awaiting the redemption decision above,
            since correction 2 depends on it
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
