---
title: Axis 3 — 0.5% depth, and the two-producer split
repo: backing-monitor
status: open. Steps A and B are shipped; step C stage 1 is the next action and needs no producer.
written: 2026-10-01, to carry one thread into a fresh session. Everything not bearing on that
  thread has been cut — see §7 for what was deliberately left out.
---

# 0 ▶ THE NEXT ACTION, IN ONE PARAGRAPH

DexTracker's `liquidity/1` overlay is adopted in **`replace`** mode, so it supersedes the *whole*
axis rather than the fields it fills. Two assets have an overlay that publishes **no depth** over a
base feed that publishes a **measured** one, and the page shows `n/a` + `Not rated`. Stage 1 is to
stop a depth-less overlay from suppressing a measured depth. It is user-approved ("yes", 2026-10-01)
and was interrupted before the first edit — **no code has changed for it.**

```
LIVE, VERIFIED IN THE RENDERED DOM 2026-10-01
reusd-re   tile "0.5% depth  n/a — asset feed measures $10.0M on ethereum —
                 not used as the axis figure"      chip "Not rated"
           overlay depth_usd=None, bracket50=None  base: 9 rungs + a depth_50bps block
syzusd     same shape                              base: 8 rungs + a depth_50bps block
usg        overlay depth_usd=648437.5, bracket50=381250.0   -> UNAFFECTED, overlay wins
```

⚠️ **This got worse while the week's work was landing.** When the suppression mechanism was
designed we were discarding raw rungs. PegTracker now publishes an explicit **measured `depth_50bps`
block** for these assets, so today we are discarding a producer's direct answer at the exact
threshold we spent the week asking them for.

---

# 1. Stage 1 — the design, and the one trap in it

In `mergeAxisOverlays` (`js/renderers/common.js`), the `replace` branch currently stashes the base
feed's figure as `superseded_depth` and replaces anyway — which is what renders that "not used as
the axis figure" line. Change it to **carry the base's depth fields into the merged block** when the
overlay declines to publish depth (`pay.total_2pct_depth == null`).

Fields to carry when present on the base and absent on the overlay:

```
total_2pct_depth              two_pct_depth_bracket
total_2pct_depth_is_floor     exit_mark                  <- the rungs; our derivation reads them
two_pct_depth_status          slippage_reference_size_usd
two_pct_depth_basis           any depth_<n>bps block
two_pct_depth_size_responsive
two_pct_depth_unresponsive_note
```

⚠️ **THE TRAP — `depth_threshold_bps` DESCRIBES THE FIGURE, AND THE FIGURE IS CHANGING HANDS.**
`_adaptSchema` sets `pay.depth_threshold_bps` from the overlay's `primary_threshold_bps` **even when
the overlay publishes no figure at all**. Carry the base's depth while keeping that field and the
base's 200-basis number gets labelled as a 0.5% measurement — a wrong number presented as the thing
we just standardised. **Drop `depth_threshold_bps` when carrying, unless the base declares its own.**
Then the policy default (50) applies and `_publishedDepthAt` finds the base's `depth_50bps` block.

**Verify, and name what would have to break:** the fix is right only if reusd-re and syzusd start
showing PegTracker's measured 0.5% figure with a band, **and** the five DexTracker-only assets below
are byte-identical afterwards. A pass that only checks the two broken assets cannot tell a correct
carry from one that also fires where it shouldn't.

```
overlap, both producers    reusd_re  syzusd  usg
DexTracker-only (depth)    bold  dusd_alto  fxusd  reusde_re  usdm     <- must not change
PegTracker-only            14 assets                                   <- no overlay, untouched
```

⚠️ Claims in this section about `_adaptSchema`, `superseded_depth` and `_baseHasDepth` were
established earlier in the originating session and are **not re-verified as of this writing**. Read
the `replace` branch before editing — a claim about one's own repo is the least-verified kind,
because it feels like recall.

---

# 2. Stage 2 — what it is, and why it is not blocked on code

Adopt `liquidity/1` as a **merge with declared field ownership** instead of `replace`:

```
VENUE STRUCTURE   DexTracker   daily   venues, enumeration, exclusions, regimes,
                                       route legs, pools, TVL, volume
LADDER + CROSSINGS PegTracker   3h     rungs, crossings at 50 and 200, status, basis
primary_exit       PegTracker           already agreed not DexTracker's, 2026-08-29
```

That deletes `superseded_depth` and `_baseHasDepth`, and moves the 7-day `max_age_days` horizon off
depth (where a week is fatal) onto venue structure (where it is fine).

⚠️ **The blocker is not technical.** Stage 2 is implementable today; what is missing is both
producers agreeing to stop publishing everything. Merging first would paper over an unagreed
division rather than implement an agreed one.

---

# 3. Where the producers stand

| Who | Position |
|---|---|
| **DexTracker** | Field split agreed. Their framing is sharper than the proposal's: the failure comes from **adoption working on the whole axis**, so disjoint fields fix it *regardless* of the cadence argument. ⚠️ **"Please don't plan on our coverage growing until my user says so"** — days of work per new venue type. PegTracker's shallow pool rows are therefore a **permanent** fallback tier, not transitional. |
| **PegTracker** | Agreed in principle, **has not read the proposal file yet** — deliberately told to finish the 50 bps work first. |
| **DexTracker's user** | Owns the coverage decision. Not asked yet. |

Proposal file: `specs/handoffs/DISPATCH-axis3-split-ladder-vs-venues-2026-10-01.md` (`fd874fd8f`).
Three sub-decisions already answered inside it rather than handed back: tier the venue coverage
(don't strip ~10 assets of their only pool data); DexTracker keeps its bisected crossing as a deeper
measurement; `primary_exit` goes to PegTracker.

---

# 4. Settled — do not re-litigate

User decisions, now in `specs/six-axis-dashboard-spec.md` § Axis 3 (`88bcfc62e`) and in the
renderer (`54cfef513`, `88b9aea05`, `60962baf5`, `bde1e69ff`):

- **0.5% is the default cost limit for stable assets; 200 bps for volatile ones (none exist
  today).** Per-asset override via `depth_threshold_bps` — the override list is empty on purpose.
- **A ladder answers in one of three shapes** — floor · bracket · capacity. Corpus at the time of
  writing: 8 floors · 6 brackets · 3 capacity · 0 below-the-smallest-probe. ⚠️ Cite rung and shape
  counts **only with a timestamp**; membership moves.
- **Depth is the impact of size, measured relative to the producer's declared reference rung**
  (`slippage_reference_size_usd`, else `rungs[0]`). The asset's standing discount is a separate
  line. Conflating them turned usg's −54.7 bps peg discount into a cost.
- **Compare signed, never `Math.abs`.** sUSDat's `+70.17 bps` is a *gain* at $1,000; the absolute
  form claimed we could not sell inside 0.5% the size that pays you to sell. The user caught this.
- **A producer's published block beats our derivation** (15 of 17 assets are served by one).
  `_publishedDepthAt` anchors on `/^depth_\d+bps$/` — which is what excludes the `_all_in` variants.
- **A producer's `primary_threshold_bps` is data selection, not our policy.** PegTracker's
  `DEPTH_CEILING_BPS = 200.0` is a *search* parameter. ⚠️ `IMPLAUSIBLE_GAIN_BPS = 200.0` sits four
  lines below it — same number, unrelated meaning.
- **Capacity-shaped figures are never banded**, so riskAnalyst's authored scores hold for them.

---

# 5. Still parked, unrelated to C

- `common.js` carries a stale comment claiming **"Axis 3 has no automated depth producer."**
  DexTracker has had a daily cron for weeks.
- `liquidity.note` renders for no one on six assets: hastra-prime, reusd-re, reusde-re, susdat,
  susds, plus de-duplicating syrup's bespoke copy of the same text.
- Offered, never started: an automated spec-conformance check. **Nothing tests any dashboard against
  the spec today** — conformance has been established by hand, per asset, every time.

---

# 6. How the week's defects were actually found

Recorded because the ratio is the point: **re-reading the diff found almost none of them.**

- **Running it** — the signed-slippage bug, the `_anchor` regex, the Safe chip vanishing.
- **A second party** — PegTracker caught the all-in/impact conflation; DexTracker caught me
  dispatching our own string (`common.js:3431`, "reachable float") to them as theirs; riskAnalyst
  caught a stored sentence in `derive_headline` that was false on 11 assets and backwards on
  dusd-alto.
- **Screenshots** caught two things the DOM reads called clean.
- ⚠️ One reported defect was **withdrawn**: the "empty Allocation panel" was my sample racing the
  chart draw (it paints 18,301 px). Check for a race before filing a blank-render bug.

Idiom that worked: local `http.server` + puppeteer, innerHTML length **and** hash before/after,
crafted fixtures for malformed shapes, A/B with the resolver monkey-patched, and a cache-buster bump
because `max-age=600` sits between the file and the reader.

---

# 7. Cut from this document on purpose

The originating session also completed, and **nothing below needs carrying**: the syrupusdc/usdt
refresh (`3a5e6a519`), the dusd-alto dashboard build (`0086cf81d`, `e04e41647` — its own record is
`specs/dusd-alto-dashboard-plan.md` rev 4), Ethena's four hidden axes (`021242998`, `946c70652`,
`bd10f6809`), and the axis-5 headline fix (`1d6e410df`). Step A (spec + rendering) and step B (ask
PegTracker to measure at 50 bps) are **done**; only C remains.
