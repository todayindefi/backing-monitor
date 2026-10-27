# FXSave dashboard audit — 2026-10-21

Follow-up: [remediation completed 2026-10-22](fxsave-dashboard-remediation-2026-10-22.md).
The findings below describe the original preview and remain as the audit record.

Original disposition: **not ready for production promotion**. The initial deliveries are
complete; dashboard specification acceptance is not. Earlier browser checks
proved rendering, responsive layout and selected arithmetic, not full conformance.
This pass audits the existing preview; it does not change implementation.

## Governing specification

- `specs/six-axis-dashboard-spec.md`: §4.0 baseline manifest; §4.1 and per-axis
  contracts; §6.1 disclosure; §6.2b producer-backed claims; §6.3 score fallback;
  §6.4 clocks; §8 reader tests; §9 acceptance.
- `specs/axis5-contract-admin-spec.md`: path-level authority observations, two
  evidence halves, explicit unknowns and controller/reach/delay precedence.
- `specs/renderer-design-rules.md`: producer-field-driven presentation and
  missing-data semantics.
- `specs/fxsave-feed-contract.md`: vault-specific units and two-output basket.

The shared spec contains superseded statements: the §4.0 manifest's blanket
no-score rule for Dependencies conflicts with its later Axis 4 text; its older
no-Issuer-chip wording conflicts with the later Axis 6 score requirement and
current shared implementation. This audit uses later axis-specific guidance and
the explicitly authored FXSave mapping. Deliberately unscored Dependencies is
correct; it is not a defect to fill with tidresearch's unsupported 4.5.

## Axis inventory

| Axis | What actually renders | Missing or incorrect | Assessment |
|---|---|---|---|
| 1 NAV / stability | NAV/share, source block/time, share conversion; missing market price and premium/discount declared; historical authored 5/10 tile | No history chart or explicit history-absence element. No standard market/reference/deviation tile row. Contract NAV source getter/basis is not named beside NAV. Current section is unrated while summary substitutes authored score despite unavailable measurements. | Incomplete |
| 2 Backing | Explicit no-independent-CR basis; reconciled custody headline, custody-chain explanation; authored 4.5/10 | No CR chart is appropriate for this vault, but the hidden chart has no explicit replacement element saying independent coverage history is inapplicable. Own share supply/assets/conversion sit under Axis 1; raw custody reconciliation numbers sit in Dependencies instead of compact Backing evidence. Underlying fxUSD pass-through context is published but not rendered as structured context. | Partial; do not invent CR |
| 3 Liquidity & exit | SVG profile of proceeds/NAV at logarithmic sizes; 19-rung table; measured-size selector; direct swap vs instant basket+market; fee and queue; separate quote clocks, stale warning, par-mark/gas limitations | No 50-bps incremental-size-impact headline/bracket, no separate standing-cost line, no venue table despite inventory, no explicit holder eligibility/maxRedeem result, and no local observation block/time beside the separate PegTracker redemption basket. | Partial |
| 4 Dependencies | Five upstream cards with metrics/source disclosures; custody/lookthrough chain; Morpho concentration; explicit unscored state | fxUSD card says “No dashboard” even though fxUSD is registered and linked in the header. Named Morpho/Pendle downstream context is omitted behind generic “tracking coming” semantics. Embedded fxSP policy/provenance blocks appear as unread blocks. | Partial |
| 5 Smart contract & admin | Authored structural 4/10; audit/code facts in disclosures; shared-admin and bounded second-Safe narrative | Falsely says “no topology walk filed.” Committed hand-walked YAML exists: 3 layers, 6 paths, observed September 22. No emitted contract feed is prepared. Therefore path reach, thresholds, execution delay/floor, cancellation, method/date and explicit unknowns do not render. | Fail |
| 6 Issuer | Entity, full producer summary in disclosure, facts, score 5.5, dated axis clock and correctly labelled staging report link | No material missing baseline element found. Historical assessment remains under review; stage status is preserved. | Baseline present |

## Findings, in priority order

### F1 — High: an existing authority walk is represented as absent

`tools/prepare_fxsave_preview.py` copies RiskAnalyst overlays but never emits
`fxsave_contract.json` from the security producer. The shared section consequently
renders **“Smart Contract & Admin — no topology walk filed.”**

Independent source check: `git show HEAD:topology/assets/fxsave.yaml` in
security_analyst returns a hand-walked file, last changed in `8e84860`, with three
layers and six paths. It also contains six explicit unmeasured scopes, including
key independence, booster administration, the router facet set and downstream
Aave/Curve governance. These are absent from the dashboard's structured evidence.

Closure: run the established committed-topology emitter through an explicit
preview scope, retain the September observation date, render both code-security
and admin/access-control blocks, and preserve the source's unknowns. A new audit
engagement is not needed merely to wire this existing walk.

### F2 — High: baseline history and price-reference elements are suppressed

`FxSaveRenderer.render()` replaces `axis-peg-body` with a short unavailable-market
note. This removes the standard history element without declaring its absence.
The imported forward NAV/custody history is not consumed by the renderer.

The reviewed preview has two points (09:52:11–09:53:47 UTC); the current producer
has seven (through 14:46:47 UTC). Neither a week of price history nor a market
comparison may be fabricated. Render reference-only NAV history with its real
coverage if useful, plus the required explicit absence of market/peg history.
Retain a seven-day requested horizon and label sparse coverage honestly. Name
`fxSAVE.nav()` and the pinned block/time beside its reference value.

The summary's authored 5/10 versus the section's “Not rated” must be reconciled:
retain the historical authored assessment as historical context, not a substitute
for missing current market measurements under §6.3.

### F3 — High: liquidity lacks the spec's depth summary and venue inventory

Current costs are valid **all-in cost versus share NAV**, including the instant
fee once. They are not the spec's incremental **size impact relative to the
smallest successful rung**. No current depth figure is actually rendered, so the
present issue is omission; do not relabel the existing all-in brackets as depth.

Independent recomputation on the preview's quote set:

| Route | Standing cost at smallest rung | 50-bps additional size impact | 200-bps additional size impact |
|---|---:|---:|---:|
| Direct FXSave swap | 15.0842 bps | $10k–$100k NAV | $250k–$500k NAV |
| Instant basket plus market | 99.1090 bps | $4.5m–$5m NAV | $5m–$7.5m NAV |

These are dated, coarse **indicative brackets**, not current executable capacity.
The producer's all-in instant 50-bps result fails at the smallest size because
of the standing fee; that is not a depth crossing. Keep both conventions visible
and distinct. The optional observed proceeds peak must never become a ceiling.

DexTracker's `venue_inventory.json` contains four FXSave pools and 33 fxUSD pools
across its declared Curve registry scope. None reaches the preview. Transport and
render this separately dated inventory with scope, exclusions/dust rules and route
venue preservation. TVL must remain separate from executable depth.

Also surface PegTracker's funded-holder probe/maxRedeem and negative control with
its own block/time. The adjacent router basket is from another block; the header's
router time cannot date the primary-redemption observation.

### F4 — Medium: Backing is spread across other axes

A collateral-ratio chart must stay absent because no independent FXSave dollar
collateral ratio exists. This is a legitimate asset-specific exception, not a
reason to import fxUSD's ratio or draw an invented reserve history.

Make that chart disposition explicit. Put same-block supply/assets, custody gauge
claim, raw reconciliation difference, scope and clock in Backing. Show custody or
share-conversion history as such, never as dollar collateral coverage. If underlying
fxUSD ratio/composition is shown, label it as separately dated lookthrough context
and link to its dashboard. Do not use a pie unless the displayed components form
an actual partition.

### F5 — Medium: dependency links and downstream semantics are wrong/incomplete

The overlay supplies `slug: fxusd`, while the common card renderer requires an
internal `link` and `link_type`. No adapter resolves it, so the existing fxUSD
dashboard is described as absent. Resolve only registered destinations.

`downstream_tracked: []` belongs to generated graph coverage. It does not erase
separately authored named Morpho/Pendle observations. Display the distinction:
known report consumers versus incomplete automated downstream enumeration.
Consume the embedded-fxSP policy and provenance fields deliberately instead of
leaving “unread block” markers as the final interface.

### F6 — Medium: state and snapshot transport are not self-maintaining

The preview is generated manually and is frozen behind the installed producers.
The renderer does not use its imported `refresh_attempt` or `exit_refresh_attempt`
objects. Its footer states producer cadences but does not say that this consumer
snapshot requires regeneration. It also hard-codes market-unavailable, score-review,
legacy-correction and governance statements instead of deriving them from the
published fields. Those statements will not retire when data changes.

Closure: visible snapshot/sync status; distinguish current observation, failed
attempt, retained quote and review date; derive warning states from fields;
retain producer basis text in labelled disclosures. Install consumer transport
before making production-refresh claims. Stale ladder warning itself is working.

## Checks and limits

- Audited the actual rendered shared-app preview with a cache-busted local URL,
  not merely source code. All six sections render; no JavaScript error occurred.
- DOM inventory: Axis 1 has no chart; Axis 2's CR/pie canvases are hidden; Axis 3
  has one SVG, a two-route comparison and a collapsed 19-row ladder; Axis 5 has no
  authority table. The hidden canvases do not count as displayed charts.
- Producer file keys and committed topology were compared with the DOM. This is
  why delivery completion did not imply dashboard acceptance.
- Existing mobile/desktop checks passed. A dark screenshot was captured during
  this audit; this pass does not claim a full visual contrast/accessibility audit.
- No selected visible paragraph exceeded the ~240-character prose trigger, but
  section-wide repeated notes and revision history still deserve consolidation.
- No live trades were performed. RPC, oracle and quote correctness beyond the
  delivered evidence is outside this consumer audit.
- Findings are implementation/coverage issues. They do not author new asset scores.

## Recommended closure order

1. Wire existing authority topology and remove the false absence claim.
2. Restore the standard Axis 1 reference/history states and Backing evidence slots.
3. Add incremental-impact depth summaries and transport venue inventory.
4. Repair dependency destinations/downstream coverage and field-driven states.
5. Regenerate current data, run published-versus-DOM and failure-state checks,
   verify light/dark/mobile, then consider production transport/publication.
