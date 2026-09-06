---
target_repo: backing-monitor (~/backing-monitor)
target_claude: backing-monitor
target_files:
  - js/renderers/common.js (_issuerBadgeText ~L758; axis-5 head ~L814; axis-issuer body ~L1143-1162)
  - js/renderers/common.js ~L712 — SECOND hardcoded label, added by riskAnalyst 2026-08-12; see note below
date_drafted: 2026-08-12
status: DONE — verified in code 2026-09-06, not by memory
verified_by: |
  common.js:2773  _renderAxisHead('contract', 5, 'Contract & Admin', ...)  — axis 5 is its own
                  axis with its own title; it is no longer the issuer axis wearing a hardcoded label.
  common.js:2485  label = scoredBadge ? scoredBadge[1].trim() : (isStructural ? 'Structural' : 'Issuer')
                  — the label is derived from the payload's badge, which is what this asked for.
  ⚠️ The stale DRAFT marker solicited finished work and cost riskAnalyst one wrong
  recommendation before they checked the code. A handoff that outlives its own completion is a
  live instruction; closing it is part of doing it.
severity: >
  LOW-MEDIUM, and cosmetic-but-misleading rather than broken. Nothing disappears from the
  dashboard. Syrup's axis-5 tile now reads "Structural 6.5/10" under a section header
  hardcoded to "Issuer", so the header and the value name different axes.
---

> ## 🛑 WRONG REPO CHECK
> **Target: `~/backing-monitor`.** The analyzer side is already done in PegTracker
> (`risk_feed_client.py` + 8 analyzers). This is the renderer half.

# Axis 5: take the label from the data, not from a hardcoded "Issuer"

## What changed upstream

PegTracker now reads editorial axis scores from `todayindefi/risk-feed` instead of
hardcoding them. As part of that, Syrup's axis-5 was corrected: its value is the report's
**structural** score (6.5 / 6.0 — the curator/contract axis, correct for a credit vault),
but it was stored as `issuer_score` and rendered **"Issuer 6.5/10"** while syrupusdc's
actual issuer score is **5.5**. The label was a point high and named the wrong axis.

Resolved by keeping the value and fixing the label. Syrup's per-pool JSONs now publish:

```json
"issuer": {
  "report_url": "...",
  "badge": "Structural 6.5/10",
  "structural_score": 6.5,
  "structural_score_source": "risk-feed@2026-08-12T01:57:21Z",
  "structural_score_status": "ok",
  "curator": "Maple Finance"
}
```

`issuer_score` is **gone** from those two files. Every other asset is unchanged in shape and
gains provenance fields (`issuer_score_source` / `_status` / `_generated_at` / `_age_hours`).

## Why nothing is currently broken

`_issuerBadgeText()` (~L758) reads `issuer.badge` first and only falls back to
`issuer.issuer_score`, so Syrup still renders. Two cosmetic consequences:

1. The strip is `badge.replace(/^Issuer\s+/i, '')`, which doesn't match "Structural", so
   Syrup's tile shows the full **"Structural 6.5/10"** where other assets show a bare
   **"5.5/10"**.
2. `_renderAxisHead('issuer', 5, 'Issuer', …)` (~L814) hardcodes the section title, so the
   header still says **Issuer** above a structural value.

(1) is arguably an improvement — it's self-describing. (2) is the actual mislabel, just
relocated from the value to the header.

## The fix

- Derive the axis-5 title from the payload rather than hardcoding it. Something like:
  the label is whatever precedes the score in `badge`, defaulting to `"Issuer"`. Or
  explicitly: prefer `structural_score` → "Structural", else `issuer_score` → "Issuer".
- Make the prefix strip label-agnostic — `replace(/^[A-Za-z ]+\s+(?=[\d.]+\/10)/, '')`
  rather than matching `Issuer` literally — so the tile stays consistent whichever axis
  an asset publishes.
- The body renderer (~L1146) has the same `'Issuer ' + issuer.issuer_score` fallback;
  it should follow the same rule and not synthesise an "Issuer" prefix for a structural score.
- USDS is the reminder that badge is not always a score: it publishes `"Sky (MakerDAO)"`.
  Whatever the label logic is, it must leave a non-numeric badge alone.

## Also worth surfacing: the new provenance fields

Every asset's issuer block now carries where the score came from and how old it is:

```
issuer_score_source:       "risk-feed@2026-08-12T01:57:21Z"
issuer_score_status:       ok | stale | cached | missing_slug | missing_field | unavailable
issuer_score_generated_at: "2026-08-12T01:57:21Z"
issuer_score_age_hours:    0.17
```

The feed silently froze for seven days in August 2026 and served pre-refresh scores, so
the status is worth showing rather than hiding — a small "as of" or a muted marker when
`status !== "ok"`. On `missing_*` / `unavailable` the score is `null` and the badge reads
**"Issuer unavailable"** by design: PegTracker will not substitute a hardcoded number.
The renderer should handle a null score without collapsing the tile.

sUSDe additionally carries `issuer_score_inherited_from: "usde"` — it publishes no issuer
score of its own, and the inheritance is recorded rather than applied silently. Worth a
tooltip rather than being presented as sUSDe's own rating.

## Verification

- `?asset=syrupusdc` and `?asset=syrupusdt`: axis-5 header and value name the SAME axis,
  and the value still reads 6.5 / 6.0.
- `?asset=usdat`, `?asset=usds`, `?asset=usde`, `?asset=susde`, `?asset=crvusd`,
  `?asset=apxusd`, `?asset=hastra-prime`: unchanged from today.
- USDS still shows "Sky (MakerDAO)".
- Simulate `issuer_score: null` + `status: "unavailable"` → tile renders "unavailable"
  rather than blank or `null/10`.

## Context

PegTracker side: `risk_feed_client.py`, `tests/test_risk_feed_client.py` (badge==feed
contract per slug, plus stale/missing/cached policy). The axis question in §3 of
`issuer-badges-read-risk-feed-not-hardcoded-pegtracker.md` was settled by user call on
2026-08-12: keep the value, fix the label.


---

## Added by riskAnalyst 2026-08-12 — a second hardcoded label at ~L712

Verified the `~L814` citation (correct: `js/renderers/common.js:814`,
`this._renderAxisHead('issuer', 5, 'Issuer', 'editorial — subjective axis', '')`). While there,
found a **second** hardcoded `Issuer` that is not in the target list above — the **axis summary
strip** at ~L712:

```js
{
    label: 'Issuer',
    valueHtml: this._issuerBadgeText(issuer),   // ← now renders "Structural 6.5/10" for Syrup
    sub: 'editorial · subjective',
```

This is the same mislabel in a second place, and it is the more visible one — the strip is above
the fold. **Fixing only L814 would leave the summary strip still saying "Issuer" over a
"Structural" badge.** Both sites need the per-asset label, and `sub:` (`editorial · subjective`)
is fine for either axis so it can stay.

Suggest driving both from one source — the analyzer already publishes enough to infer it, since
the badge string itself now carries the axis name. Reading the label off the payload rather than
hardcoding it is also what stops this recurring the next time an asset uses a different axis.
