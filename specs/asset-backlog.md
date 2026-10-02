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
4. Update `Last reviewed` on each entry touched.

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

### reusd-re — ⚠️ ESCALATED: rated Healthy 10/10 where the analyst scores liquidity 4.5/10
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
status      answered to riskAnalyst 2026-10-02 with the measurement; they agreed the declaration is
            honest for this asset and said they will NOT declare for syzusd/yzusd (gap 1.0, inside
            band resolution — no disagreement there).
note        The tooltip already states both numbers, and the head carries the report's full
            reasoning in a disclosure. So this is "visible chip overstates" rather than "hidden".
            Whether a hover is sufficient mitigation is the open question.
Last reviewed 2026-10-02
```
