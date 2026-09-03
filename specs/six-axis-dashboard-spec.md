---
title: Six-axis dashboard — build spec
repo: backing-monitor
status: LIVE SPEC. Written 2026-08-31 from the reUSD build and a survey of the pages
        that already work (apyusd, susdat, syrupusdc, thusd).
audience: whoever builds or reviews the next asset page
---

# How to use this

**Build a new asset against §4 (per-axis contract), §8 (what finished means) and §9 (acceptance).** Everything else
explains why the rules are what they are — read it when a rule seems wrong, because most of
them were paid for.

⚠️ **The rules here are not style preferences. Each one is a defect that shipped.** Where a rule
cites an asset, that asset is the evidence.

---

# 1. The frame

```
1 Peg / Stability     PegTracker        market vs its own reference (par OR NAV)
2 Backing             PegTracker        reserves, coverage, first-loss position
3 Liquidity & Exit    DexTracker*       venue depth AND primary redemption
4 Dependencies        riskAnalyst       what fails INTO this asset from outside
5 Contract & Admin    security_analyst  who can act ON it from inside
6 Issuer              riskAnalyst       editorial: who you are trusting
```

\* DexTracker owns axis 3 by decision; PegTracker's embedded block still serves every asset
until `liquidity/1` is adopted renderer-side.

**One producer per axis** — except where two producers cover disjoint HALVES and say so; see §5.4.

## 1.1 Who produces what, and how to reach them

⚠️ **Routing is per counterparty and getting it wrong costs a round trip.** Codex-lane repos read
a file; live sessions read a message. A message to a wrapped session is lost completely.

```
PRODUCER          REACH VIA        EMITS INTO                         WHAT
PegTracker        codex handoff    ~/PegTracker/data/                 base feed, peg history
DexTracker        codex handoff    ~/DexTracker/data/liquidity/  ⚠️   {slug}_liquidity.json
security_analyst  codex handoff    ~/security_analyst/topology/  ⚠️   YAML — NOT json
riskAnalyst       LIVE session     ~/riskAnalyst/data/axes/           axis overlays
tidr              LIVE session     tidresearch report corpus          report + production flag
```

**Codex lane:** write `handoffs/inbox/<id>.md` (`status: ready`, `from: claude`, `to: codex`, an
`output:` path) → `./agent-handoff codex --id <id>`. ⚠️ Never declare `handoffs/results/` as the
deliverable — that belongs to the launcher. ⚠️ The rollout guard trips after roughly one dispatch;
run `tools/codex-rotate.sh` first. ⚠️ Show the handoff file and the exact command to the user
BEFORE dispatching.

⚠️ **DexTracker writes to a SUBDIRECTORY and security_analyst does not write JSON at all.** Both
broke the assumption that a producer drops a file next to PegTracker's. `sync_and_push.sh` searches
`SOURCE_ROOTS`; a new root is a line there, and a file outside every root reaches nothing.

### What each producer emits, per axis

```
axis 1  PegTracker        peg.{nav,nav_source,nav_basis,market_price,market_price_source,
                          premium_discount_pct}, history_ref -> {slug}_peg_history.json
axis 2  PegTracker        backing.{collateral_ratio + basis, supply + scope, breakdown}
        riskAnalyst       backing-overlay/1 — what chain cannot show: first-loss attachment,
                          NAV write path, and an AUTHORED score gated per §6.3
axis 3  DexTracker        liquidity/1 — depth, enumeration, venues, primary_exit
        PegTracker        the embedded liquidity block, until liquidity/1 is adopted
axis 4  riskAnalyst       dependencies/1 — upstream[] with name/metric/source/note
axis 5  security_analyst  topology YAML: layers, timelock, timelock_floor, unmeasured[]
                          ⚠️ THEY DO NOT EMIT JSON. backing-monitor's tools/emit_axis5.py
                          reads their YAML fresh each sync — a generator, never a stored copy,
                          because a committed copy drifts from the walk.
        riskAnalyst       contract-overlay/1 — the CODE half (audits, architecture) + the score
axis 6  riskAnalyst       issuer/1 — score, entity, regulator, summary, facts[]
        tidr              the published report the axis links to
```

### What each producer will refuse, and why it is right

- ⚠️ **security_analyst will not publish prose findings or scores.** They emit OBSERVATIONS —
  a chain read with a positive control. Judgement is riskAnalyst's. When a finding needs to reach
  the page, ask for a structured FIELD (`timelock_floor`), not a paragraph: a field joins for every
  consumer, a paragraph renders for one.
- ⚠️ **riskAnalyst will not score an axis the dashboard computes.** An authored number silently
  overriding a measured band is a category error. The exception is a DECLARED impossibility (§6.3).
- ⚠️ **They will also not score an axis that is unrated fleet-wide** (axis 4), because one asset
  scoring it redefines what every other page's blank means.
- **PegTracker will not derive a figure the issuer does not attribute** — e.g. a collateral ratio
  from combined multi-asset reserves. Do not ask twice; render the absence.

### Whose gate blocks what

```
security_analyst walks     their user      reUSDe is unwalked and stays unwalked until they say
report publication         tidr's owner    production: true; until then there is NO safe link
promotion (reports+pages)  our user        the four artifacts promote as one set
```

⚠️ **Axis 4 and axis 5 answer different questions and the distinction is load-bearing:**
*whose failure reaches me from outside* vs *who can act on me from inside*. An issuer's own NAV
writer is axis 5, not axis 4, even though the asset depends on it. Getting this wrong makes
"dependency" mean two things in one list — it happened on reUSD and was removed.

---

# 2. ⚠️ STRUCTURE: every panel slots under its axis

**A panel MUST render inside the section of the axis it describes.** The six axes are the page's
spine, not a summary strip above an unrelated page.

**Measured 2026-08-31, and this is the single biggest inconsistency in the fleet:**

```
                axis-section chars   page total   panels   pattern
apyusd          backing 7,503 / 8 panels  15,114     18    ✅ axis-slotted
reusd-re        249–1,494 per axis         ~6,000    12    ✅ axis-slotted
susdat          125–911 per axis            9,118    18    ⚠️ mixed
syrupusdc       46–255 per axis            15,300    20    ❌ appended below
thusd           42–320 per axis             8,814    14+   ❌ appended below
```

**On the appended pages the frame is a header strip over a page that ignores it.** A reader
clicking Liquidity on syrupusdc gets 79 characters while "Liquidity Layer (pool-owned positions)"
sits far below, unconnected.

⚠️ **It also produces duplicates, which is how you can tell it is a structural fault and not a
style choice:** thusd renders **"Risk Flags" twice**; syrupusdc renders the generic "Backing
Breakdown" AND a bespoke "Backing"; susdat shows "Price vs NAV" in two separate tiles.

**Rule for bespoke renderers:** append into `#section-<axis>` (or the axis's extra-panels slot),
never into the page root. If a panel does not belong to exactly one axis, it is two panels.

### Migration policy — user decision 2026-08-31

⚠️ **OPPORTUNISTIC, NOT A SWEEP. Migrate a page when its CONTENT is next refreshed** — when the
asset's data goes out of date and someone is in the file anyway. Do not schedule a mass migration:
these are the richest pages in the fleet, they are not broken, and a bulk rewrite risks the content
for a structural gain.

⚠️ **But do not let a refresh pass without migrating.** "Next time" is how this survived three
producers and a frame change. If you are editing an asset's renderer for any reason, it leaves
conforming.

**Measured non-conforming (2026-08-31):** `syrupusdc`, `thusd` (appended below), `susdat` (mixed).
**Measured conforming:** `apyusd`, `reusd-re`.
⚠️ **The other 17 bespoke renderers are UNVERIFIED, not passing** — `apxusd, bmnr, crvusd, cusd,
frax, hastra-prime, mstr, ousd, strc, susdai, susde, syrupusdt, usdai, usdat, usdd, usde, usg`.
Check with the §9 panel-placement item before assuming any of them conforms.

---

# 3. The top row

Six tiles, one per axis, in axis order. **A tile is a summary OF its axis, not a separate fact.**

- ⚠️ **A tile must not be blank while its axis has a finding.** reUSD showed `—` on Backing over a
  first-loss attachment point BELOW its norm, and `—` on Contract over a hand-walked topology.
  Both read as "nothing measured".
- **Fall through to the next-best known figure** rather than printing a dash: CR → on-chain
  coverage → attachment point. This chain already existed for coverage; extend it, do not
  special-case.
- ⚠️ **THE LABEL MOVES WITH THE VALUE.** When the tile falls through, its sub-label must change
  too. Rendering an attachment point under the label "collateral ratio" is a number under the name
  of a different quantity — shipped once, caught on screenshot.
- **Never invent a rating from a fallback.** See §6.3.

---

# 4. Per-axis contract

For each axis: **REQUIRED** (render or the axis is incomplete), **OPTIONAL**, and ⚠️ **UNRATED
RULE** — what to render when it cannot be scored. *Unrated is a defined state, not a gap.*

## Axis 1 — Peg / Stability

**REQUIRED** · the deviation figure, signed · what it is measured AGAINST (par or NAV — say which)
· the reference's SOURCE · the reference's `as_of` · a history chart.

⚠️ **A NAV-tracking share is not a $1 peg.** Rendering one against an implied par draws a depeg
that does not exist (reUSDe would show ~40%). If `theoretical_price` is a NAV, the axis must say
so in words.

⚠️ **If the reference is issuer-written, name the WRITE PATH beside the number** — not in a
tooltip, not one section down. A "0.0% discount to NAV" over an issuer-set NAV asserts a
verification that did not happen. reUSD's writer is an undocumented 632-byte contract that also
holds the deviation-guard bypass; that sentence sits under the NAV figure.

**OPTIONAL** · trend arrow vs 7d · cross-check against a second source.

**UNRATED** · state the reference and why it cannot be evaluated. Never fall back to par.

## Axis 2 — Backing

**REQUIRED** · coverage figure OR an explicit statement that none is derivable, WITH its basis ·
supply, and its SCOPE (which chains it covers) · first-loss position where the asset is tranched.

⚠️ **Never derive a ratio the producer declined to publish.** Re publishes combined
reUSD + reUSDe reserves with no per-asset denominator; the honest render is "no collateral ratio
is establishable" plus the reason.

⚠️ **BLOCK THE DIVISION A READER WILL PERFORM.** If the page shows a reserves total and a supply
figure on different scopes, say in the reserves subtitle that dividing them is meaningless. The
scope line is the figure's SUBTITLE, never a footnote under a table — a qualifier that arrives
after the number has been read is too late.

**OPTIONAL** · breakdown table + allocation chart (⚠️ hide BOTH when empty; an empty doughnut is
a titled void) · attestations · concentration lens.

**UNRATED** · see §6.3 for the authored-score fallback.

## Axis 3 — Liquidity & Exit

**REQUIRED** · depth figure with its STATUS (`bracketed` / `ladder_exhausted` / `quote_failed` /
`not_size_responsive`) · whether it is a floor · what the depth was measured AGAINST · primary
redemption: gated or not, and for whom.

⚠️ **A floor is not a measurement.** `≥$100k` because the ladder stopped at $100k must not rate
like $100k of measured depth. Say "floor, not a measurement" on the tile.

⚠️ **Exit eligibility is part of the axis, not a footnote.** reUSD's primary redemption is
non-U.S.-persons-only and pays sUSDe on Mainnet. An axis that says "redeemable at NAV" without the
gate describes an exit most holders do not have.

**UNRATED** · name which half is missing — depth or redemption — not just "unrated".

## Axis 4 — Dependencies

**REQUIRED** · each upstream entry with `name`, and a `metric` where one is measured · `source`
per entry (an issuer dashboard and an on-chain read are different warrants) · whether downstream
is tracked (absent ≠ zero).

⚠️ **`name`, not `label`.** ⚠️ **Shares do not necessarily partition** — yzUSD's 16 legs sum to
108.53%; never render as a pie.

**UNRATED is the DESIGN here**, fleet-wide: axis 4 renders a link list and no score. Do not add a
score to one asset — it silently redefines what every other page's blank means.

## Axis 5 — Contract & Admin

**REQUIRED** · per authority layer: what it controls, the keys, the delay, the topology · ⚠️ an
explicit NOT-ESTABLISHED list · the method (hand-walk vs generated) · the walk's `observed_at`.

⚠️ **THREE STATES IN THE DELAY COLUMN, never two:** a real duration, an explicit `none`, and
`not measured`. `timelock: unresolved` means NOT MEASURED — rendering it blank converts an unknown
into an implied clean bill, which is exactly what security_analyst's own coverage audit found.

⚠️ **A CONFIGURED DELAY IS NOT AN ENFORCED ONE.** If `timelock_floor: none` — the MINIMUM_DELAY
getter reverts — the delay is reducible and the column says `48h · no floor`. Their audit found
this on 14 of 14 hand-walked timelock rows.

⚠️ **Audit quality does not lift an authority finding.** Strong audits under a key that can
rewrite the mark in one transaction is the case this axis exists to catch. If the score comes from
a code/audit rubric, the basis must say what it does and does not cover.

**UNRATED** · "Not assessed — an absence of data, not a finding that control is unconstrained,
nor that it is constrained."

## Axis 6 — Issuer

**REQUIRED** · the score, or an explicit unrated state · WHO the issuer is · the report link, or
why there is none.

⚠️ **PROSE ON THIS AXIS IS ALWAYS PRODUCER-AUTHORED.** Claims like "unlicensed", a jurisdiction,
an auditor, a custodian are assertions about a real company. A renderer that composes them from
fields is the invented "Cayman-SPV / daily attestation" line with extra steps. **Never write
issuer prose in the renderer, and never summarise the producer's.**

**OPTIONAL** · `facts[]` bullets with inline attribution · a lead sentence (take the producer's
own FIRST sentence mechanically; do not compose one).

---

# 5. The data contract

## 5.1 Files

Base feed `{slug}_backing.json`; per-axis overlays `{slug}_<axis>.json`. ⚠️ Axis 2's overlay is
`_backing_overlay` — `{slug}_backing.json` is already the whole-file feed. A directory namespace
(`axes/{slug}_backing.json`) is the better general fix, deferred.

⚠️ **Registration wires transport.** `sync_and_push.sh` derives its copy list from
`data/assets.json` × block types, so a slug must be registered BEFORE any producer file can
arrive. And a dashed slug needs an explicit `data_source` — the sync writes underscored while the
fetch reads `data_source || slug`.

## 5.2 Envelope

```json
{ "schema_version": "issuer/1", "producer": "riskanalyst",
  "asset": "reusd_re", "as_of": "2026-08-30T00:00:00Z",
  "issuer": { ...block... } }
```

⚠️ **`as_of` is when the DATA was observed, never when the file was generated.** A generator that
stamps its run time makes a three-week-old walk render as fresh on every sync. Emit `generated_at`
separately.

## 5.3 Adoption

A declared `schema_version` must be adopted renderer-side before it renders, WITH a mode:

- **replace** — the axis's owner supplies the whole axis; nothing of the base survives.
- **merge** — a SUPPLEMENT beside what the dashboard computes, per field.

⚠️ **Mode is not inferable from the schema.** Replacing wholesale on a supplement would have
discarded a computed collateral ratio and left only an attachment point.

⚠️ **An unadopted schema is REFUSED and SAID SO on the page** — never silently ignored. A
producer emitting into a dashboard that ignores it is a real failure mode: DexTracker's
`liquidity/1` sat unread for hours.

## 5.4 Two producers on one axis

Allowed ONLY when they cover disjoint halves AND the seam is declared in the data (axis 5:
security_analyst's authority walk + riskAnalyst's code half, whose `authority_note` states it does
not restate the walk). ⚠️ **The chip must name every contributor** — crediting the last file
fetched attributes one repo's work to another.

## 5.5 Identity

Check the overlay's declared asset against BOTH the feed's `asset_slug` and the resolved source
slug (dashed and underscored are the same identity). ⚠️ **Identity is the ADDRESS where one is
available, never the ticker** — two unrelated protocols ship "reUSD", and a name check cannot tell
them apart.

---

# 6. Rendering rules

## 6.1 Length

⚠️ **COLLAPSE, NEVER TRUNCATE.** Cutting to the first N characters means the renderer choosing
which of a producer's warnings a reader sees — and a length-based cut on reUSD's issuer summary
lands immediately before "holders have NO direct claim on the §114 trust assets".

- Collapse behind a labelled toggle that says what it opens.
- Keep the SCOPES visible on the summary line: "4 items: ethereum asset-permission · … · forceNAVUpdate path".
- A first-sentence lead is fine because it is MECHANICAL. ⚠️ It only works if producers write
  claim-first; say so in the field's documentation.
- Provenance and methodology boilerplate belong in tooltips, not above the fold.

**Targets, from the reUSD pass:** axis 5 went 7,556 → 698 visible chars, axis 6 1,400+ → 249, with
nothing deleted.

## 6.2 Marker discipline

⚠️ **NEVER promote source-file comments to page copy.** A repo file's emphasis and a reader's
interest are different signals and one glyph cannot carry both — selecting ⚠️-marked paragraphs
from a YAML header put "THIS FILE HAS A LIVE PUBLIC CONSUMER" and "SLUG_TO_FILE needs one line"
onto a public risk page. Page copy comes from a field the producer publishes deliberately.

## 6.2b ⚠️ A renderer must never assert a claim about an asset

**Not the presence of a fact, and not its absence.** A hard-coded line like *"the authority half
is NOT ESTABLISHED"* is a latent FALSE NEGATIVE for every future asset that arrives with the thing
established — it cannot know when it stops being true. It shipped on reUSDe and was false within
the hour: the authority half had been verified on-chain and recorded in the producer's own report.

**Drive the lead off the producer's field.** Their note says what is and is not established, in
their words, and it moves when their assessment moves. This is the same rule as never composing
issuer prose; absence claims are simply the case where it is easiest to forget, because a blank
feels like the neutral option.

⚠️ **OVERSTATING RISK IS NOT THE SAFE DIRECTION.** riskAnalyst's framing, kept verbatim: *a page
telling a holder that nobody has checked who controls their asset, when a 48h timelock was in fact
verified, pushes them toward an exit over nothing.* **It fails in a direction that merely FEELS
responsible.** "When unsure, say it is worse" is not conservatism, it is a different error.

## 6.3 Authored vs computed

An authored score may fill a gap ONLY when the producer DECLARES the measurement impossible.

```
declared underivable   producer said so, with a basis   -> safe to fall back
not yet computed       new asset, pending pass          -> unsafe
failed to load         fetch error, feed outage         -> ⚠️ DANGEROUS
```

⚠️ **A bare null cannot distinguish these.** Require an explicit `applies_when` AND the
producer's basis string. And **label it on the page** — "Authored 5.5/10", never a computed band —
in the tile AND the axis head.

## 6.4 Provenance

Every axis states its own age from its own `as_of`, taking the OLDEST declared input. ⚠️ **A
supplemental field may therefore set the whole axis's age** (reUSD's attachment point makes
Backing read 7d beside minute-old reserves). **That is correct. Do not fix it by dropping the
field** — an output must not be allowed to remove its own input.

Name the source when an overlay contributed; say when one was refused; report when an override
replaced a non-empty ARRAY (that is a different event from overriding a scalar, and it silently
dropped a measured 93.87% dependency once).

---

# 7. Traps

⚠️ **THE SECTION THAT MATCHES YOUR QUESTION IS THE ONE MOST LIKELY TO BE STALE.** Reports file
corrections as dated UPDATE BLOCKS while the original prose stays filed by TOPIC — so a topical
search, which is every search anyone actually runs, systematically returns the superseded text
first. **The correction is structurally unreachable by the query that needs it**, and being in the
same file does not help: one grep hit feels like the file answered. This produced a wrong axis-5
render within an hour of being written. **Read the update blocks, or grep for the date, not only
the topic.**

⚠️ **A stale CDN 200 is not a liveness check.** A published-report link was wired on a measured
`200` that was a Netlify edge cache; the origin was 404. Cache-bust, and read the `cache-status`.

⚠️ **Never anchor a measurement to the thing being measured.** A router quoting against its own
mid reads ~0bps however mispriced it is; 194 of 201bps on syzUSD were basis, not slippage.

⚠️ **`balance_ratio` on a twocrypto pool is an exchange rate, not an imbalance.** No feed field
distinguishes stableswap from twocrypto — require `pool_type`, do not guess from the pair.

⚠️ **A malformed timestamp does not warn — it silently stops counting.** `"2026-08-24"` without
`T`/`Z` fails to parse and the axis reports a freshness it never established.

⚠️ **DEFAULT API PRECISION CAN ROUND BELOW THE SIGNAL, AND IT WILL NOT TELL YOU.** CoinGecko's
`/simple/price` truncates unless you pass `precision: full`. On reUSDe that returned `1.41`
instead of `1.4136988` — a **0.26 percentage-point** error against a deviation measured in tenths
of a percent, **which flipped the published sign from a discount to a premium.** Any asset whose
axis-1 signal is smaller than the API's default precision is at risk; NAV-tracking shares are all
in that class.

⚠️ **INTERNAL ARITHMETIC CONSISTENCY IS NOT VERIFICATION.** The reUSDe worker re-derived its
discount "exactly" and was right to — the arithmetic was correct **on a wrong input**. A figure is
only verified against an INDEPENDENT producer of the same quantity: PegTracker's own tracker had
`+0.1663%` for the same asset on the same NAV, ninety seconds apart. **If two systems in this
estate compute the same number, diff them; if only one does, say so rather than calling it
verified.**

⚠️ **SCRAPED LABELS BREAK SILENTLY AND ASYMMETRICALLY.** Re renamed a reserve row `USDT` → `USDt`
and killed the reUSD analyzer for a day, while the reUSDe analyzer — written later, against the
new label — kept working. **Two analyzers parsing one page with two label lists is the defect; the
rename is only the trigger.** One parser per source page, matched case-insensitively, and an
unmatched row recorded rather than skipped.

⚠️ **A feed with no analyzer behind it freezes while looking live.** Every field present and
internally consistent; only the timestamp moves. Check age separately from shape.

⚠️ **A kept field that RENDERS an overridden one is stale.** `badge` survived while `issuer_score`
was overridden, so the axis showed "Overall 6.0/10" over an authored 5.5.

---

# 8. What "finished" means

⚠️ **§9 proves a page is COMPLETE. This section is whether it is any GOOD.** A page can pass every
mechanical check and still tell a reader nothing — every axis populated, every field rendered, and
no one any better informed.

## 8.1 The four things every number carries

**A figure alone is not content.** Finished means:

```
VALUE     the number
BASIS     what it is measured against, in words a reader can check
CLOCK     when it was observed — its own as_of, not the page's
SCOPE     what it covers and what it excludes
```

⚠️ **Scope is the one most often missing and the most expensive.** "Supply 201.1M" is not finished;
"201.1M — Ethereum, the only chain measured" is. "$136.9M reserves" is not finished; "combined
reUSD + reUSDe, not attributable to reUSD alone" is. **A figure whose scope is unstated invites the
reader to compute something wrong with it.**

## 8.2 An adverse finding is not finished until it carries direction and limit

- ⚠️ **DIRECTION.** "Attachment point 9.66%" is a number. *"…and it thinned because the
  DENOMINATOR ROSE, not because the junior layer shrank"* is the finding — without it a reader
  watching supply grow concludes the opposite of the truth.
- ⚠️ **LIMIT.** *"Selector presence does not distinguish implements-from-calls; no disassembly was
  done."* A serious claim rendered without its limit is stronger than the evidence supports, and a
  reader who discovers the limit unaided discounts everything else on the page.
- ⚠️ **VINTAGE where operands differ.** A ratio of a June numerator over an August denominator is
  INDICATIVE, not measured, and must say so. "As of", never "Measured", unless it was.

## 8.3 The reader tests

Apply these to each axis before calling it done:

1. **The so-what test.** Can a reader say what this axis means for them? "Healthy 5/5" over an
   issuer-written NAV fails: it says the price tracks the mark, not that the mark is trustworthy.
2. **The standalone test.** Is the page comprehensible without the report? The report may be
   unpublished, gated, or superseded. ⚠️ An axis that is a score plus a link is not finished.
3. **The wrong-computation test.** Take every pair of numbers on the page. Would dividing or
   comparing any pair mislead? If so, say so where the numbers are — not in a footnote.
4. **The blank test.** For every blank: does the page say WHY? "Not rated" alone fails.
   "No collateral ratio is establishable — the issuer publishes combined reserves with no
   per-asset denominator" passes.
5. **The scan test.** Does the top row alone give an honest first impression? A blank tile over a
   below-norm finding fails it.

## 8.4 Finished vs merely present — real examples

```
NOT FINISHED                          FINISHED
"Not rated"                           "Not rated — no collateral ratio is establishable,
                                       because the issuer publishes combined reUSD+reUSDe
                                       reserves with no per-asset denominator"
"48h timelock"                        "48h · no floor" — MINIMUM_DELAY reverts, so it is
                                       reducible by whoever schedules against the admin
"2 upstream"                          two named legs with metric, source, and the caveat
                                       that 93.87% is COMBINED, not reUSD-only
"Issuer 5.5/10"                       "The issuer is FOUR entities, not one" + who bears
                                       the underwriting risk + no claim on the trust assets
"admin-written on SharePriceCalculator"  …via an undocumented 632-byte contract that ALSO
                                       holds forceNAVUpdate, the deviation-guard bypass
                                       — with the disassembly limit attached
```

## 8.5 ⚠️ What finished does NOT mean

- **Not "every field rendered".** Some fields are diagnostics. Deliberately not rendering is a
  decision; failing to notice is a defect. Know which you did.
- **Not "no blanks".** A declared absence is finished content. An undeclared one is not.
- **Not "a score on every axis".** Axes 4 and 5 are unrated by design, and inventing a number to
  fill them is worse than the blank.
- **Not "the most text".** The richest pages in the fleet were also the least legible; axis 5 lost
  90% of its visible characters and gained the finding it had buried.
- ⚠️ **Not "it looks right".** It looked right on every occasion in this repo's history when it was
  wrong. Run the diff, render the page, check the clock.

---

# 9. Acceptance — before an asset is promoted

```
[ ] check_feeds.py: 0 failures
[ ] Every axis: a figure OR a stated unrated reason. No bare dashes.
[ ] Every tile: not blank while its axis has a finding; label matches the value shown.
[ ] Every panel renders INSIDE its axis section. No duplicates across the page.
[ ] Every published field either renders or is deliberately not rendered
    (run the published-vs-DOM diff; "published but unrendered" is this repo's
     most repeated defect).
[ ] Every score labelled computed or authored.
[ ] Every axis clock derived from its own as_of.
[ ] Producer-authored prose is producer-authored. No composed issuer claims.
[ ] Every derived figure cross-checked against an INDEPENDENT producer of the
    same quantity — not merely re-derived from its own inputs.
[ ] Verified IN A BROWSER with a cache-bust — never curl. The SPA 200s any slug.
[ ] Both light and dark render.
```

⚠️ **The published-vs-DOM diff is the highest-yield check in this list.** On reUSD it found 54
fields in the payload reaching no pixel, including $136.9M of reserves and the entire exit
asymmetry.
