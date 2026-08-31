---
title: Six-axis dashboard — build spec
repo: backing-monitor
status: LIVE SPEC. Written 2026-08-31 from the reUSD build and a survey of the pages
        that already work (apyusd, susdat, syrupusdc, thusd).
audience: whoever builds or reviews the next asset page
---

# How to use this

**Build a new asset against §4 (per-axis contract) and §8 (acceptance).** Everything else
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

⚠️ **A stale CDN 200 is not a liveness check.** A published-report link was wired on a measured
`200` that was a Netlify edge cache; the origin was 404. Cache-bust, and read the `cache-status`.

⚠️ **Never anchor a measurement to the thing being measured.** A router quoting against its own
mid reads ~0bps however mispriced it is; 194 of 201bps on syzUSD were basis, not slippage.

⚠️ **`balance_ratio` on a twocrypto pool is an exchange rate, not an imbalance.** No feed field
distinguishes stableswap from twocrypto — require `pool_type`, do not guess from the pair.

⚠️ **A malformed timestamp does not warn — it silently stops counting.** `"2026-08-24"` without
`T`/`Z` fails to parse and the axis reports a freshness it never established.

⚠️ **A feed with no analyzer behind it freezes while looking live.** Every field present and
internally consistent; only the timestamp moves. Check age separately from shape.

⚠️ **A kept field that RENDERS an overridden one is stale.** `badge` survived while `issuer_score`
was overridden, so the axis showed "Overall 6.0/10" over an authored 5.5.

---

# 8. Acceptance — before an asset is promoted

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
[ ] Verified IN A BROWSER with a cache-bust — never curl. The SPA 200s any slug.
[ ] Both light and dark render.
```

⚠️ **The published-vs-DOM diff is the highest-yield check in this list.** On reUSD it found 54
fields in the payload reaching no pixel, including $136.9M of reserves and the entire exit
asymmetry.
