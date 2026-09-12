/**
 * Common renderer — handles generic sections shared by all assets.
 */

// 5-axis rating thresholds. Namespaced top-level const (renderer files share JS
// global scope — see the cross-file collision rule). Cutoffs map a metric to a
// 1–5 rating; per-asset overrides come via data.asset_specific.axis_thresholds.
var RISK_AXIS_THRESHOLDS = {
    peg:       { abs_dev_pct: [0.15, 0.30, 0.50, 1.0] },  // 5/4/3/2 cutoffs (smaller = better); else 1
    liquidity: { depth_usd:   [2e6, 1e6, 5e5, 1e5] },     // 5/4/3/2 cutoffs (larger = better); else 1
    backing:   { cr_pct:      [130, 110, 100, 90] }       // 5/4/3/2 cutoffs (larger = better); else 1
};

const CommonRenderer = {

    // ------ Per-axis overlay merge ------
    //
    // The six-axis pipeline is ONE PRODUCER PER AXIS, each publishing
    // {slug}_<axis>.json in its own repo, the sync copying per block, NO
    // ASSEMBLER. The no-assembler rule exists because an assembler RE-STAMPS:
    // one file timestamp laid over six clocks reports "fresh" above a two-day-old
    // block. So the merge happens HERE, at render time, per field, and every
    // field keeps its own origin.
    //
    // ⚠️ AXIS 2 CANNOT HAVE AN OVERLAY AND THIS IS A NAME COLLISION, NOT A
    // POLICY. Axis 2 is `backing`, so its overlay would be {slug}_backing.json —
    // which is already the whole-file feed every asset loads. The convention
    // {slug}_<axis>.json silently has one axis whose name is taken. Axis 2 stays
    // inside the base file (PegTracker owns it, per the ownership table), and a
    // second producer with axis-2 CONTENT — riskAnalyst's attachment point for
    // reUSD is exactly this — has nowhere to put it under the current spelling.
    // Resolve at the spec, not by inventing a name here.
    //
    // ⚠️ PREFERENCE IS BY OWNERSHIP, NOT BY FRESHNESS. DexTracker is canonical
    // for axis 3 even when its file is older than the embedded block, because
    // the alternative — preferring whichever number is newer — makes the page's
    // source depend on cron timing and silently alternate between two bases.
    // The cost is that a stale overlay can downgrade a fresh page, so the age
    // is always shown and the origin always named.
    AXIS_OVERLAYS: {
        // ⚠️ AXIS 2 IS `_backing_overlay`, NOT `_backing`, AND THE REASON IS A
        // NAME COLLISION RATHER THAN A DISTINCTION. {slug}_backing.json is
        // already the whole-file feed every asset loads, so axis 2 is the one
        // axis whose per-axis name was taken before the convention existed.
        // riskAnalyst proposed the suffix rather than inventing a namespace, and
        // it is honoured here — but a DIRECTORY namespace (axes/{slug}_backing.json)
        // is the better general fix, because this collision recurs the moment two
        // producers both emit the same block type. Deferred deliberately: it
        // changes the sync's copy shape and every fetch path, so it is a
        // coordinated rename done once, not mid-flight.
        // ⚠️ ONE FILE, THREE AXES. `_axis_basis` carries peg / backing / liquidity
        // blocks in one envelope, so it is listed under all three. It is ADDITIVE:
        // it declares what each authored score MEASURES and whether that score is
        // persistence-filtered — which the feed never said, so a reader saw a live
        // band beside an authored score with no way to tell why they differ.
        //
        // ⚠️ `peg` had NO overlay entry before this. It is the first.
        peg:          '_axis_basis',
        backing:      ['_backing_overlay', '_axis_basis'],
        liquidity:    ['_liquidity', '_axis_basis'],
        // ⚠️ `_axis_basis` WAS REGISTERED ON THREE AXES AND THE FILE WRITES FOUR.
        // The crvUSD pilot carries a `dependencies` block with a fully-argued
        // underlying_score_basis, and nothing read it — the only *_dependencies.json
        // files on disk belong to two STAGED assets, so that basis reached no reader
        // at all. Mine to fix: I wired peg/backing/liquidity and stopped.
        dependencies: ['_dependencies', '_axis_basis'],
        // ⚠️ TWO PRODUCERS, TWO HALVES OF ONE AXIS — applied in this order.
        // security_analyst's hand-walk supplies the AUTHORITY half and replaces
        // the axis; riskAnalyst's overlay merges the CODE half plus the score on
        // top. This is not the "two producers on one axis" the pipeline forbids:
        // that rule exists because a split axis needs something to COMPUTE a
        // merge, and here there is nothing to compute — the halves do not
        // overlap and riskAnalyst's file says so in `authority_note` rather than
        // restating the walk. The seam is declared by the producers, not
        // inferred here.
        contract:     ['_contract', '_contract_overlay'],
        issuer:       '_issuer'
    },

    // ⚠️ PER-FIELD MERGE IS ONLY SAFE WHEN BOTH PRODUCERS SHARE A VOCABULARY,
    // and the first real overlay proved they do not. DexTracker's liquidity/1
    // and PegTracker's embedded liquidity block name almost nothing in common:
    //
    //   PegTracker   total_2pct_depth, two_pct_depth_status, pools, exit_mark
    //   liquidity/1  depth{status,depth_usd,basis}, enumeration, venues[], swap_tvl_usd
    //
    // Merged per field, EVERY PegTracker field survives untouched because the new
    // producer never names it — so the page would keep rendering
    // total_2pct_depth while liquidity/1 says `depth.status: "unmeasured",
    // basis: "Depth withheld: the anchor is missing"`. ⚠️ That is worse than
    // showing nothing: it prints a number the axis's own canonical producer
    // declined to publish, over a chip claiming the canonical producer as the
    // source.
    //
    // So the rule is declared by the overlay itself:
    //
    //   schema_version PRESENT  -> the producer is claiming a NEW vocabulary.
    //                              It must be adopted here before use. Adopted
    //                              means the axis is REPLACED wholesale — one
    //                              producer owns the axis, which is the pipeline
    //                              rule; blending two producers inside one block
    //                              is an assembler at field scale.
    //   schema_version ABSENT   -> the producer is claiming the EXISTING
    //                              vocabulary, so per-field merge is what it
    //                              asked for and what it gets.
    //
    // An unknown schema is REFUSED and SAID SO on the page. Refusing silently
    // would leave a producer emitting a file for hours into a dashboard that
    // ignores it — which is exactly what happened: liquidity/1 has existed since
    // 12:03 and reached nothing, because its commit message asserted the sync
    // already carried it and nobody ran the copy.
    // ⚠️ A SCHEMA IS ADOPTED WITH A MODE, NOT JUST A YES. The first cut had one
    // rule — declared schema means the producer owns the axis, replace wholesale
    // — and the second real overlay broke it. riskAnalyst's backing-overlay/1
    // carries ONLY what this dashboard cannot compute (a report-derived
    // attachment point). Replacing the backing block with it would discard the
    // collateral ratio the dashboard measures for itself. Two legitimate kinds:
    //
    //   replace  the axis's canonical OWNER supplies the whole axis. Nothing of
    //            the embedded block survives, so no field is a survivor of a
    //            different source. (DexTracker's liquidity/1, when adopted.)
    //   merge    a SUPPLEMENT: fields the dashboard cannot derive, added beside
    //            the ones it computes. Per-field, each keeping its origin.
    //
    // `payload` is likewise per schema and this is NOT the both-spellings trap:
    // an envelope vs a flat block is what a schema_version EXISTS to pin down.
    // Accepting two spellings of one FIELD entrenches divergence; accepting two
    // versioned schemas, each with a declared shape, is the versioning working.
    //
    //   envelope  { schema_version, asset, as_of, <axis>: { ...block } }
    //   flat      { schema_version, asset_slug, as_of, ...block }
    //
    // ⚠️ ENVELOPE IS THE PREFERRED SHAPE FOR ANY NEW SCHEMA. It needs no
    // reserved-key stripping, so a producer can never lose a data field to a
    // meta name collision. `flat` is honoured because liquidity/1 shipped that
    // way, not because it is equally good.
    ADOPTED_OVERLAY_SCHEMAS: {
        // ⚠️ `additive: true` — an issuer overlay contributes summary / summary_source
        // / facts, which the asset feed never carries. Sharing no field with the feed
        // is this schema's NORMAL state, not the ambiguous case the disjoint warning
        // was written for, and without this every issuer overlay renders an amber
        // ⚠️ chip saying it overrode nothing.
        issuer:       { 'issuer/1':          { mode: 'merge', payload: 'envelope', identity: 'asset', additive: true } },
        peg:          { 'axis-basis/1':      { mode: 'merge', payload: 'envelope', identity: 'asset', additive: true } },
        backing:      { 'backing-overlay/1': { mode: 'merge', payload: 'envelope', identity: 'asset' },
                        'axis-basis/1':      { mode: 'merge', payload: 'envelope', identity: 'asset', additive: true } },
        dependencies: { 'dependencies/1':    { mode: 'merge', payload: 'envelope', identity: 'asset' },
                        'axis-basis/1':      { mode: 'merge', payload: 'envelope', identity: 'asset', additive: true } },
        // ⚠️ REPLACE, not merge: security_analyst owns axis 5 outright and the
        // base feed publishes no contract block at all, so nothing is discarded.
        // The mode still matters — it guarantees no field on this axis is a
        // survivor of a different source, which for an authority walk is the
        // difference between evidence and a composite nobody measured.
        contract:     {
            'contract/1':         { mode: 'replace', payload: 'envelope', identity: 'asset' },
            // Merges ON TOP of the walk: adds the code half and the score,
            // overrides nothing the walk established.
            'contract-overlay/1': { mode: 'merge',   payload: 'envelope', identity: 'asset' }
        },
        // ⚠️ ADOPTED 2026-09-03. DexTracker owns axis 3 and replaces it whole.
        // Its payload carries `primary_exit` as well as `depth`, so replacing
        // does NOT drop the redemption leg — checked before adopting, because a
        // wholesale replace that loses the primary window would have made the
        // axis worse while looking richer.
        // ⚠️ max_age_days IS DECLARED WHERE A PRODUCER WAS MEANT TO RE-MEASURE.
        // ⚠️ NOTE THE CAUSE IS NOT A MISSING CRON LINE. I diagnosed it that way
        // and asked DexTracker to schedule `liquidity_payload.py`; they refused,
        // correctly. That script is an ASSEMBLER — it takes depth as an argument
        // it cannot compute, its `main()` never passes one, and the CLI path
        // therefore always emits an unmeasured stub. Scheduling it would have
        // OVERWRITTEN every file holding real rungs with a 0-rung stub. Depth
        // measurement is bespoke per asset and venue type (Curve get_dy, a
        // Uniswap v3 tick simulator, a Mento FPMM floor) and generalises behind
        // no flag. Axis 3 has no automated depth producer — that is a scope
        // question, not a scheduling one.
        // A replace overlay SUPPRESSES a live feed, so one that stops refreshing
        // outranks fresh data forever rather than briefly. DexTracker's
        // liquidity_payload.py is not on any cron — every overlay is a hand-run
        // artifact frozen at its authoring date — so syzUSD's 13-day-old refusal
        // to publish depth was hiding PegTracker's live ladder, which locates
        // that crossing between $200K and $250K.
        //
        // ⚠️ DELIBERATELY NOT APPLIED TO contract/1, WHICH IS ALSO `replace`.
        // That axis is a security_analyst HAND-WALK: being weeks old is its
        // normal condition, not a stall, and ageing it out would blank axis 5
        // across the estate. A staleness horizon is only meaningful for a
        // producer that was supposed to re-measure. Whoever adds the next
        // replace schema should ask which of the two it is.
        liquidity: { 'liquidity/1':   { mode: 'replace', payload: 'flat', identity: 'asset_slug',
                                        max_age_days: 7 },
                     'axis-basis/1': { mode: 'merge',   payload: 'envelope', identity: 'asset', additive: true } }
    },

    // ⚠️ A KEPT FIELD THAT RENDERS AN OVERRIDDEN ONE IS STALE, AND IT WINS BY
    // DEFAULT. Found on the first real reUSD render: PegTracker published the
    // report's OVERALL score as the issuer badge ("Overall 6.0/10"), riskAnalyst's
    // overlay overrode issuer_score to its authored 5.5 — and the page showed
    // axis 6 TITLED "Overall" reading 6.0/10, because _issuerAxisInfo derives
    // both the label and the value from `badge` when one is present. The merge
    // was correct field-by-field and the result was wrong twice over: wrong axis
    // name, wrong number.
    //
    // Per-field merge cannot see this on its own — `badge` and `issuer_score` are
    // different keys, so nothing marks one as describing the other. It has to be
    // declared. If the underlying value is overridden and its rendering is not,
    // the rendering is dropped so the renderer rebuilds it from the live value.
    //
    // ⚠️ Keep this list SHORT and only for fields that are literally a rendering
    // of another. It is not a general "recompute what looks derived" rule — that
    // would start discarding producer-authored text on suspicion.
    DERIVED_FIELDS: {
        issuer: { badge: ['issuer_score', 'structural_score'] }
    },

    // Set by mergeAxisOverlays, read by _renderAxisHead. Mutable static, same
    // idiom as KNOWN_ASSET_SLUGS. Reset on every merge so an SPA navigation
    // cannot carry the previous asset's provenance onto this one.
    AXIS_PROVENANCE: {},

    // `overlays` is [{axis, file, json}] — nulls (404s) already filtered by the
    // caller. A missing overlay is the NORMAL case today: no producer emits one
    // yet, so this must be a no-op on all 25 live assets.
    mergeAxisOverlays(data, overlays, sourceSlug) {
        this.AXIS_PROVENANCE = {};
        if (!data || !Array.isArray(overlays)) return data;
        var self = this;
        var has = function(o, k) { return Object.prototype.hasOwnProperty.call(o, k); };

        // The identities this page will answer to. An overlay naming a DIFFERENT
        // asset is refused rather than merged: a mis-copied file would otherwise
        // paint one asset's data onto another's page silently, with a chip
        // vouching for it.
        //
        // ⚠️ TWO SPELLINGS OF THE SLUG ARE IN PLAY AND BOTH ARE LEGITIMATE. The
        // dashboard's URL slug is dashed (reusd-re); the data filename and every
        // producer's identity field are underscored (reusd_re), because the sync
        // derives filenames as slug.replace('-','_'). Accepting the feed's own
        // asset_slug AND the resolved source slug is not laxity — they are the
        // same identity in the two spellings the pipeline already uses.
        var expected = [];
        if (typeof data.asset_slug === 'string' && data.asset_slug) expected.push(data.asset_slug);
        if (typeof sourceSlug === 'string' && sourceSlug) expected.push(sourceSlug);
        // ⚠️ THE DASHED SPELLING WAS REFUSED DESPITE THE COMMENT ABOVE SAYING IT
        // SHOULD NOT BE. The stated intent is that reusd-re and reusd_re are "the
        // same identity in the two spellings the pipeline already uses" — but both
        // entries pushed above are the UNDERSCORED form (asset_slug and the
        // resolved source slug are derived the same way), so a producer writing the
        // dashed URL slug in `asset` hit an identity refusal.
        //
        // ⚠️ Found on riskAnalyst's completed axis-basis rollout: they renamed
        // three dashed FILENAMES so the sync would resolve them, deliberately left
        // the `asset` field dashed — and verified that on purpose, because a rename
        // that silently rewrote the payload would have been worse. The files then
        // synced and merged into NOTHING. The trap one level deeper than the one we
        // had just fixed.
        //
        // Normalising both sides closes it without loosening what identity means:
        // a genuinely wrong slug still refuses.
        expected.forEach(function(e) {
            var alt = e.replace(/_/g, '-');
            if (alt !== e && expected.indexOf(alt) === -1) expected.push(alt);
        });

        overlays.forEach(function(o) {
            if (!o || !o.json || typeof o.json !== 'object' || Array.isArray(o.json)) return;
            var axis = o.axis, ov = o.json;
            var base = (data[axis] && typeof data[axis] === 'object' && !Array.isArray(data[axis]))
                ? data[axis] : {};
            var srcName = typeof ov.producer === 'string' ? ov.producer : null;

            // Contributions accumulate: an axis served by two producers must name
            // both, not just whichever file was fetched last.
            function priorContributors() {
                var e = self.AXIS_PROVENANCE[axis];
                return (e && e.contributors) ? e.contributors.slice() : [];
            }
            // ⚠️ A REFUSAL MUST SURVIVE A LATER OVERLAY ON THE SAME AXIS.
            // AXIS_PROVENANCE[axis] is wholly reassigned per overlay and only
            // `contributors` was carried forward, so liquidity/1 being refused
            // and then axis-basis/1 merging cleanly ERASED the refusal — the
            // fallback happened, and the chip explaining it did not render.
            // Found by checking the DOM rather than the merged object: the data
            // was right and the reader was told nothing.
            // ⚠️ CARRY EVERY VERDICT, NOT JUST THE ONE THAT BIT FIRST. The
            // original version of this carried `refused` only — and the very
            // next verdict added (stale_sole_source) was silently dropped by a
            // later axis-basis/1 merge, reproducing the exact bug this function
            // was written to fix, one field along. Fixing the symptom is not
            // fixing the class: anything an earlier overlay concluded about this
            // axis has to survive a later one.
            var VERDICT_KEYS = ['refused', 'refused_detail', 'stale_sole_source'];
            function priorVerdict() {
                var e = self.AXIS_PROVENANCE[axis];
                if (!e) return null;
                var carried = null;
                VERDICT_KEYS.forEach(function(k) {
                    if (e[k] != null) { carried = carried || {}; carried[k] = e[k]; }
                });
                if (carried) { carried.file = e.file; carried.producer = e.producer; }
                return carried;
            }
            function carryVerdict(entry) {
                var r = priorVerdict();
                if (!r) return entry;
                VERDICT_KEYS.forEach(function(k) { if (r[k] != null) entry[k] = r[k]; });
                // The chip names the file the verdict is ABOUT, not whichever
                // overlay merged afterwards.
                entry.file = r.file;
                entry.producer = r.producer;
                return entry;
            }
            function refuse(reason, detail) {
                self.AXIS_PROVENANCE[axis] = {
                    contributors: priorContributors(),
                    file: o.file, producer: srcName, refused: reason, refused_detail: detail || null,
                    overridden: [], added: [], kept: Object.keys(base),
                    overlay_as_of: typeof ov.as_of === 'string' ? ov.as_of : null
                };
            }

            var schema = typeof ov.schema_version === 'string' ? ov.schema_version : null;
            var spec = schema ? ((self.ADOPTED_OVERLAY_SCHEMAS || {})[axis] || {})[schema] : null;
            var staleSoleSource = null;

            // Identity, checked under whichever key this schema declares. An
            // UNADOPTED schema is refused on the schema before identity is even
            // consulted — its identity field is by definition unknown to us.
            var idKey = spec ? spec.identity : 'asset_slug';
            var claimed = typeof ov[idKey] === 'string' ? ov[idKey] : null;
            if (claimed && expected.length && expected.indexOf(claimed) === -1) {
                refuse('asset mismatch',
                       'The overlay names ' + claimed + '; this page is ' + expected.join(' / ') + '.');
                return;
            }

            if (schema) {
                if (!spec) { refuse('schema not adopted', schema); return; }

                // ⚠️ A STALLED OWNER MUST NOT OUTRANK A LIVE FEED INDEFINITELY.
                // Refusal is WHOLESALE — the base block renders untouched —
                // because per-field merge across these two vocabularies is the
                // documented-unsafe case that made this a `replace` axis to
                // begin with. Either the overlay owns the axis or it does not.
                //
                // ⚠️ A REFUSAL HAS A SHELF LIFE TOO — where there IS one. For an
                // overlay carrying measured rungs (usg 15, reusde-re 18, usdm 8)
                // the block is a real measurement, and setting it aside past a
                // horizon is the judgement call this threshold makes: it was
                // sound when measured and is not evidence about today.
                //
                // ⚠️ BUT DO NOT ASSUME A WITHHELD DEPTH IS A JUDGEMENT AT ALL.
                // I argued this guard was overriding DexTracker's considered
                // decision not to publish syzUSD's depth, quoting its basis
                // string back at them. That string is a HARDCODED FALLBACK in
                // `build_liquidity_payload`, emitted whenever depth is absent —
                // and `main()` never passes depth, so the CLI path always emits
                // it. syzUSD's block is bare CLI output: depth was never measured
                // for it at all. There was no refusal to have a shelf life.
                // Corrected by DexTracker, who read their own code rather than
                // accept my characterisation of it.
                //
                // The chip names exactly what was set aside — status and figure,
                // read from the block — so a stub reads as a stub rather than as
                // a suppressed judgement.
                if (spec.max_age_days) {
                    var stampStr = typeof ov.as_of === 'string' ? ov.as_of
                        : (ov[axis] && typeof ov[axis].as_of === 'string' ? ov[axis].as_of : null);
                    var stampT = stampStr ? Date.parse(
                        /Z$|[+-]\d\d:?\d\d$/.test(stampStr) ? stampStr : stampStr + 'Z') : NaN;
                    if (isFinite(stampT)) {
                        var ageDays = (Date.now() - stampT) / 86400000;
                        if (ageDays > spec.max_age_days) {
                            // ⚠️ REFUSING A SOLE SOURCE LOSES THE MEASUREMENT
                            // INSTEAD OF REPLACING IT. I shipped this guard
                            // assuming a fallback always exists. It does not:
                            // reusde-re and usdm have NO PegTracker ladder, so
                            // refusing their overlay turned "$15.5K, crossing
                            // solved" and "≥$500.4K floor" into "n/a" — a stale
                            // figure that says it is stale replaced by silence,
                            // which is strictly worse for a reader.
                            //
                            // So the horizon only bites where something fresher
                            // can actually take over. Where the overlay is the
                            // only source it is KEPT and marked instead, and the
                            // existing age clock already states how old it is.
                            if (!self._baseHasDepth(base, axis)) {
                                staleSoleSource = {
                                    age_days: ageDays, max_age_days: spec.max_age_days
                                };
                            } else {
                            var said = self._overlayDepthSummary(ov, axis);
                            refuse('overlay stale',
                                'Its as_of is ' + stampStr + ' \u2014 ' + ageDays.toFixed(1) +
                                ' days old, past the ' + spec.max_age_days +
                                '-day limit declared for this schema. The axis owner\u2019s producer ' +
                                'has not re-measured, so its block is NOT being used and the feed\u2019s ' +
                                'own figures are rendered instead.' +
                                (said ? ' What the stale overlay said: ' + said : ''));
                            return;
                            }
                        }
                    }
                }

                // Envelope schemas nest the block under the axis name; flat ones
                // put it at top level beside the meta keys.
                var payload = base, isEnvelope = spec.payload === 'envelope';
                if (isEnvelope) {
                    payload = ov[axis];
                    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
                        refuse('envelope missing its block',
                               'schema ' + schema + ' declares an envelope, so the block belongs under "' +
                               axis + '" — that key is absent or not an object.');
                        return;
                    }
                } else {
                    payload = {};
                    Object.keys(ov).forEach(function(k) {
                        if (k === 'producer' || k === 'schema_version' || k === 'asset_slug' || k === 'asset') return;
                        payload[k] = ov[k];
                    });
                }

                // ⚠️ The envelope's own `as_of` becomes the block's clock only
                // when the block declares none. That is NOT the re-stamping the
                // no-assembler rule forbids: it is one producer's own clock for
                // its own block, one level up — not a merged file's timestamp
                // laid over six producers. And it never overwrites a stamp the
                // block already declared, so a block that dates itself wins.
                var pay = {};
                Object.keys(payload).forEach(function(k) { pay[k] = payload[k]; });
                if (!has(pay, 'as_of') && typeof ov.as_of === 'string') pay.as_of = ov.as_of;

                if (spec.mode === 'replace') {
                    var droppedKeys = Object.keys(base);
                    self._adaptSchema(axis, schema, pay);
                    data[axis] = pay;
                    self.AXIS_PROVENANCE[axis] = carryVerdict({
                        contributors: priorContributors().concat([
                            { producer: srcName, file: o.file, schema: schema, half: 'replace' }]),
                        file: o.file, producer: srcName, schema: schema, replaced: true,
                        overridden: [], added: Object.keys(pay), kept: [], dropped: droppedKeys,
                        overlay_as_of: typeof ov.as_of === 'string' ? ov.as_of : null,
                        stale_sole_source: staleSoleSource
                    });
                    return;
                }

                // mode 'merge': a SUPPLEMENT. Per field, base retained.
                var m = {}, ovr = [], add = [], kpt = [];
                Object.keys(base).forEach(function(k) { m[k] = base[k]; });
                Object.keys(pay).forEach(function(k) {
                    (has(base, k) ? ovr : add).push(k);
                    m[k] = pay[k];
                });
                Object.keys(base).forEach(function(k) { if (!has(pay, k)) kpt.push(k); });
                var stale = self._dropStaleDerived(axis, m, ovr, kpt);
                var replacedArrays = self._recordArrayReplacements(base, pay, ovr);
                data[axis] = m;
                self.AXIS_PROVENANCE[axis] = carryVerdict({
                    contributors: priorContributors().concat([
                        { producer: srcName, file: o.file, schema: schema, half: 'merge' }]),
                    file: o.file, producer: srcName, schema: schema,
                    overridden: ovr, added: add, kept: kpt, stale_dropped: stale,
                    replaced_arrays: replacedArrays,
                    overlay_as_of: typeof ov.as_of === 'string' ? ov.as_of : null
                });
                return;
            }

            // The overlay file's top-level object IS the block. `producer` is the
            // one reserved meta key — it names the emitting repo and must not
            // land in the block as a data field.
            //
            // ⚠️ ONE SPELLING ONLY. Not `producer` OR `source` OR `emitted_by`:
            // a consumer that accepts several spellings entrenches the
            // divergence it is papering over, which is why the `name`/`label`
            // fallback on dependency entries was dropped rather than kept.
            var merged = {}, overridden = [], added = [], kept = [];
            Object.keys(base).forEach(function(k) { merged[k] = base[k]; });
            Object.keys(ov).forEach(function(k) {
                if (k === 'producer' || k === 'asset_slug') return;
                (has(base, k) ? overridden : added).push(k);
                merged[k] = ov[k];
            });
            Object.keys(base).forEach(function(k) { if (!has(ov, k)) kept.push(k); });

            var staleP = self._dropStaleDerived(axis, merged, overridden, kept);
            var replacedP = self._recordArrayReplacements(base, ov, overridden);
            data[axis] = merged;
            self.AXIS_PROVENANCE[axis] = {
                file: o.file,
                producer: srcName,
                stale_dropped: staleP,
                replaced_arrays: replacedP,
                overridden: overridden,
                added: added,
                kept: kept,
                overlay_as_of: typeof ov.as_of === 'string' ? ov.as_of : null
            };
        });
        return data;
    },

    // ⚠️ OVERRIDING AN ARRAY REPLACES THE WHOLE LIST, AND THAT IS NOT THE SAME
    // EVENT AS OVERRIDING A SCALAR. On reUSD, riskAnalyst's 2-entry editorial
    // `upstream` replaced PegTracker's 3-entry measured one, and the measured
    // "Ethena sUSDe — 93.87% of reserves and Ethereum redemption payout asset"
    // disappeared from the axis where a reader would look for it. Nothing on the
    // page said a list had been swapped: the chip reported "3 fields" either way.
    //
    // Per-field merge cannot union two lists safely — the same dependency is
    // named differently by each producer ("Ethena sUSDe" vs "sUSDe collateral
    // layer"), so a union produces duplicates and a name-match produces false
    // merges. So the list IS replaced, per axis ownership, and what was dropped
    // is recorded and shown instead of being guessed at.
    _recordArrayReplacements(base, pay, overridden) {
        var out = [];
        overridden.forEach(function(k) {
            var b = base[k], o = pay[k];
            if (!Array.isArray(b) || !b.length || !Array.isArray(o)) return;
            var names = b.map(function(e) {
                return e && typeof e === 'object' ? (e.name || e.label || null) : null;
            }).filter(Boolean);
            out.push({ field: k, from: b.length, to: o.length, dropped_names: names });
        });
        return out;
    },

    // ⚠️ A TRANSLATION, NOT A SECOND SOURCE OF TRUTH. liquidity/1 names the same
    // quantities differently from the block this dashboard grew up reading, and
    // rewriting every read site at once would be a large change with no way to
    // verify it asset-by-asset. So the producer's fields stay authoritative and
    // untouched, and the legacy names are ADDED beside them for the rating and
    // tile paths.
    //
    // ⚠️ ONLY QUANTITIES THAT ARE GENUINELY THE SAME THING ARE MAPPED. Pool TVL
    // is NOT mapped to depth under any circumstance: PegTracker withheld a depth
    // figure for this very asset specifically to avoid that substitution, and
    // $560K of pool TVL beside $15.5K of executable depth is exactly the pair a
    // fallback would silently confuse.
    _adaptSchema(axis, schema, block) {
        if (axis !== 'liquidity' || schema !== 'liquidity/1') return;
        var d = block.depth;
        if (!d || typeof d !== 'object') return;
        if (typeof d.depth_usd === 'number') block.total_2pct_depth = d.depth_usd;
        if (typeof d.is_floor === 'boolean') block.total_2pct_depth_is_floor = d.is_floor;
        if (d.status) block.two_pct_depth_status = d.status;
        if (d.basis) block.two_pct_depth_basis = d.basis;
        if (typeof block.total_tvl_usd === 'number' && block.total_tvl == null) {
            block.total_tvl = block.total_tvl_usd;
        }

        // ⚠️ FOUR FIELDS CROSSED AND THE MEASUREMENT ITSELF DID NOT.
        //
        // liquidity/1 is a `replace` axis — DexTracker owns axis 3 and the whole
        // block is swapped — so anything this translation does not name is GONE,
        // including PegTracker's bracket and its exit_mark ladder. The overlay
        // carries both of its own, under different names, and neither was mapped.
        // The result on USG: a bare "bracketed" with no range and "No exit-mark
        // RFQ ladder in this snapshot", on the one asset where BOTH producers had
        // just built a full ladder. 5b81e8703 taught the qualifier PegTracker's
        // bracket shape for exactly this asset — the shape `replace` throws away.
        //
        // ⚠️ Anything ADDED to liquidity/1 from here on has the same problem by
        // default. A field that reaches `data.liquidity` is not a field a reader
        // sees, and on a replace axis an unmapped field is not merely unrendered,
        // it is deleted.
        var br = d.bracket;
        if (br && typeof br === 'object' && !Array.isArray(br) &&
            typeof br.last_clearing_size_usd === 'number' &&
            typeof br.first_crossing_size_usd === 'number') {
            block.two_pct_depth_bracket = {
                lower_size_usd: br.last_clearing_size_usd,
                lower_slippage_bps: br.last_clearing_marginal_impact_bps,
                upper_size_usd: br.first_crossing_size_usd,
                upper_slippage_bps: br.first_crossing_marginal_impact_bps
            };
        }
        this._adaptLadder(d, block);
    },

    // liquidity/1 `depth.rungs` -> the `exit_mark.quotes` map the ladder table
    // reads. Same translate-don't-replace rule as above: the producer's array is
    // left untouched and the legacy shape is built beside it.
    _adaptLadder(d, block) {
        var rungs = Array.isArray(d.rungs) ? d.rungs : null;
        if (!rungs || !rungs.length) return;
        var em = block.exit_mark || {};
        if (em.quotes && Object.keys(em.quotes).length) return;   // producer's own wins

        // ⚠️ THE QUOTES MAP IS KEYED BY SIZE AND A MULTI-ROUTE LADDER IS NOT.
        // reusd-re quotes the SAME size down several routes — $100 appears four
        // times, $1,000 returns −84 bps on one venue and −6255 bps on another.
        // Keying those into one object silently drops all but the last, and the
        // survivor is whichever the producer happened to write last: a made-up
        // number wearing a measured number's clothes. The table has no venue
        // column to tell them apart, so the ladder is WITHHELD rather than
        // collapsed. A missing ladder is a visible absence; a collapsed one is
        // not. Revisit by giving the table a route column, not by picking one.
        var seen = {}, duplicated = false;
        rungs.forEach(function(r) {
            if (!r || typeof r.size_usd !== 'number') return;
            if (seen[r.size_usd]) duplicated = true;
            seen[r.size_usd] = true;
        });
        if (duplicated) return;

        var quotes = {};
        rungs.forEach(function(r) {
            if (!r || typeof r.size_usd !== 'number') return;
            var q = {};
            if (r.status && r.status !== 'ok') {
                // The table's failed-quote branch keys off `error` and says, in
                // the cell, that a failed read is not a measurement of zero.
                q.error = r.reason || String(r.status).replace(/_/g, ' ');
            } else {
                // ⚠️ TWO SLIPPAGE FIELDS AND THE THRESHOLD USES THE SECOND ONE.
                // usdm's `slippage_bps` is the TOTAL return against the dated
                // mark and is a flat −9.56 bps at every rung — that is the price
                // bias, which its own `bias_measures` says is excluded from the
                // measurement. `slippage_bps_debiased` (~0.00) is the marginal
                // impact the 2% crossing is actually graded on. Rendering the
                // raw field would show a 9.6 bps exit cost the producer
                // explicitly does not claim. usg publishes no debiased field
                // because its rungs are already baseline-relative ($100 = 0.0).
                var bps = typeof r.slippage_bps_debiased === 'number'
                    ? r.slippage_bps_debiased : r.slippage_bps;
                if (typeof bps === 'number') q.slippage_bps = bps;
                // ⚠️ The out-leg field is named for the ASSET RECEIVED, and it is
                // not always dollars: amount_out_usd (usg), amount_out_usdc
                // (usdm) — but reusde-re's is amount_out_susde, a TOKEN amount.
                // Printing that in a "Net out" column formatted as currency
                // would price sUSDe at $1. Only the USD-denominated legs are
                // carried; the rest leave the cell an em-dash, and size and
                // slippage still render.
                var out = typeof r.amount_out_usd === 'number' ? r.amount_out_usd
                        : (typeof r.amount_out_usdc === 'number' ? r.amount_out_usdc : null);
                if (out != null) q.output_usd = out;
            }
            quotes['' + r.size_usd] = q;
        });
        if (!Object.keys(quotes).length) return;
        em.quotes = quotes;
        // Header and convention line, so a get_dy ladder is not labelled "RFQ"
        // and the reader is told which convention the bps column is in.
        var qt = d.quote || {};
        if (!em.measured_leg && qt.measured_leg) em.measured_leg = qt.measured_leg;
        if (!em.slippage_convention && d.slippage_convention) {
            em.slippage_convention = d.slippage_convention;
        }
        if (em.price_bias_bps == null && typeof d.price_bias_bps === 'number') {
            em.price_bias_bps = d.price_bias_bps;
            if (d.bias_measures) em.bias_measures = d.bias_measures;
        }
        block.exit_mark = em;
    },

    // Drop kept-but-stale renderings;    // Drop kept-but-stale renderings; mutates `block` and `kept`, returns what went.
    // What a refused overlay had claimed, so the chip can name it rather than
    // saying only that something was set aside. Reads only fields the schema
    // declares, and returns '' when it cannot say anything specific instead of
    // guessing at the block's shape.
    // Does the block the overlay would REPLACE carry a depth reading of its own?
    // This is the whole question behind keeping vs refusing a stale overlay: a
    // horizon is only meaningful when something can take over past it.
    _baseHasDepth(base, axis) {
        if (axis !== 'liquidity' || !base || typeof base !== 'object') return false;
        if (typeof base.total_2pct_depth === 'number') return true;
        var q = (base.exit_mark || {}).quotes;
        return !!(q && Object.keys(q).length);
    },

    _overlayDepthSummary(ov, axis) {
        if (axis !== 'liquidity' || !ov || typeof ov !== 'object') return '';
        var d = ov.depth;
        if (!d || typeof d !== 'object') return '';
        var bits = [];
        if (d.status) bits.push('status "' + String(d.status).replace(/_/g, ' ') + '"');
        bits.push(typeof d.depth_usd === 'number'
            ? 'depth ' + CommonRenderer.formatCurrency(d.depth_usd)
            : 'no depth figure');
        return bits.join(', ') + '.';
    },

    _dropStaleDerived(axis, block, overridden, kept) {
        var map = (this.DERIVED_FIELDS || {})[axis];
        if (!map) return [];
        var gone = [];
        Object.keys(map).forEach(function(field) {
            if (kept.indexOf(field) === -1) return;          // producer supplied it, or absent
            var sources = map[field] || [];
            var overriddenSource = sources.some(function(sc) { return overridden.indexOf(sc) !== -1; });
            if (!overriddenSource) return;
            delete block[field];
            var at = kept.indexOf(field);
            if (at !== -1) kept.splice(at, 1);
            gone.push(field);
        });
        return gone;
    },

    // The origin chip. Rendered ONLY when an overlay contributed — silence means
    // the block came whole from the feed named in the page header, which is
    // already stated there. Naming a source on all six axes on all 25 assets to
    // say "same as the header" is noise that trains the eye to skip the chip,
    // and the chip's whole job is to be read on the day it says something else.
    // ⚠️ PRODUCER IDENTIFIERS ARE INTERNAL REPO NAMES AND WERE RENDERING TO
    // EXTERNAL READERS. The crvUSD page showed "mixed · security_analyst +
    // riskanalyst · 12 fields" on the face of axis 5 — two repo names, meaningless
    // to a reader and an unnecessary disclosure of how this estate is wired.
    //
    // The provenance itself is worth keeping and is the whole point of the chip:
    // a reader SHOULD know an authority walk and a judgement came from different
    // places. What they should not get is our directory listing. So the identity
    // is mapped to WHAT THE PRODUCER DOES, not what its repo is called.
    //
    // ⚠️ Unknown producers fall through to a de-underscored form rather than
    // being dropped. A new producer must not silently lose attribution, and a
    // name that looks slightly odd is a prompt to add it here — dropping it would
    // credit an axis to nobody and nobody would notice.
    PRODUCER_LABELS: {
        // ⚠️ Labels must read in EVERY position they render, not just the chip.
        // "contract walk" works in "mixed · contract walk + risk desk" and breaks
        // in "reviewed by contract walk". "security desk" parallels "risk desk"
        // and reads in both.
        'security_analyst': 'security desk',
        'securityanalyst':  'security desk',
        'riskanalyst':      'risk desk',
        'riskAnalyst':      'risk desk',
        'pegtracker':       'peg feed',
        'dextracker':       'depth feed',
        'backing-monitor':  'this dashboard',
        'backing_monitor':  'this dashboard',
    },

    _producerLabel(name) {
        if (!name || typeof name !== 'string') return name;
        var key = name.trim();
        var hit = this.PRODUCER_LABELS[key] || this.PRODUCER_LABELS[key.toLowerCase()];
        return hit || key.replace(/[_-]+/g, ' ');
    },

    _axisSourceHtml(axis) {
        var p = this.AXIS_PROVENANCE && this.AXIS_PROVENANCE[axis];
        if (!p) return '';
        var n = p.overridden.length + p.added.length;
        // ⚠️ Name EVERY contributor, not the last file fetched. Axis 5 is served
        // by two producers on two declared halves, and crediting only riskanalyst
        // would attribute security_analyst's hand-walk to them — the same
        // laundering the verbatim `unmeasured[]` rendering exists to prevent.
        var self = this;
        var contribs = (p.contributors || []).map(function(c) { return self._producerLabel(c.producer); })
            .filter(function(v, i, a) { return v && a.indexOf(v) === i; });
        var src = contribs.length > 1
            ? contribs.join(' + ')
            : (this._producerLabel(p.producer) || (p.file || '').split('/').pop() || 'overlay');

        // ⚠️ A REFUSED OVERLAY MUST BE LOUDER THAN AN ACCEPTED ONE. The page is
        // rendering the embedded block while a file from the axis's own producer
        // sits unread beside it — the reader is looking at the SECOND-choice
        // source and has no way to know. Silence here reproduces the exact
        // failure this chip exists to end.
        // ⚠️ KEPT PAST ITS HORIZON BECAUSE NOTHING CAN REPLACE IT. Distinct from
        // a refusal: the overlay IS being rendered, and the reader needs to know
        // it is being rendered on sufferance rather than because it is current.
        if (p.stale_sole_source) {
            var ss = p.stale_sole_source;
            return '<span class="axis-src axis-src-stale" title="' + this._escapeAttr(
                'This overlay is ' + ss.age_days.toFixed(1) + ' days old, past the ' +
                ss.max_age_days + '-day limit for its schema — but it is the ONLY source of ' +
                'depth for this asset, so it is still being rendered.\n' +
                'Refusing it would replace a stale measurement with nothing, which is worse ' +
                'for a reader than a stale one that says so.\n' +
                'File: ' + (p.file || '?') +
                (p.producer ? ' (producer: ' + this._producerLabel(p.producer) + ')' : '') + '.') +
                '">\u26a0\ufe0f ' + this._escapeAttr(src) + ' overlay stale \u2014 sole source</span>';
        }

        if (p.refused) {
            var why = p.refused === 'schema not adopted'
                ? 'It declares schema_version "' + (p.refused_detail || '?') + '", which this ' +
                  'dashboard does not yet read. Adopting a schema means teaching the section its ' +
                  'field names — until then the embedded block is rendered unchanged, because ' +
                  'merging an unknown vocabulary field-by-field silently keeps the OLD producer\u2019s ' +
                  'numbers wherever the new one renamed something.'
                : 'Refused: ' + p.refused + '. ' + (p.refused_detail || '');
            return '<span class="axis-src axis-src-refused" title="' + this._escapeAttr(
                'An overlay for this axis EXISTS and is NOT being used.\n' +
                'File: ' + (p.file || '?') +
                // Only claim a producer when one was DECLARED. src falls back to
                // the filename for chip text, and "producer: reusd_re_issuer.json"
                // would attribute a file to itself.
                (p.producer ? ' (producer: ' + this._producerLabel(p.producer) + ')' : ' (producer undeclared)') +
                '.\n' + why +
                '\nThe figures shown come from the asset feed, not from ' + src + '.'
            ) + '">\u26a0\ufe0f ' + this._escapeAttr(src) + ' overlay not used</span>';
        }

        if (p.replaced) {
            return '<span class="axis-src" title="' + this._escapeAttr(
                'This axis is served WHOLLY by ' + src + ' (' + (p.file || '?') + '), schema ' +
                (p.schema || '?') + '. One producer owns the axis: the embedded block was ' +
                'REPLACED, not blended, so no field here is a survivor of a different source.\n' +
                'Dropped from the asset feed: ' +
                ((p.dropped && p.dropped.length) ? p.dropped.sort().join(', ') : 'nothing') + '.\n' +
                (p.overlay_as_of ? 'as_of ' + p.overlay_as_of : '\u26a0\ufe0f declares no as_of')
            ) + '">' + this._escapeAttr(src) + ' \u00b7 whole axis</span>';
        }
        // ⚠️ MIXED is the case worth naming. A block assembled from two producers
        // has two clocks, and the axis clock beside this shows only the OLDEST —
        // honest about staleness, silent about the split. Without this the page
        // would imply one source for a block that has two.
        var mixed = p.kept.length > 0 && n > 0;
        // ⚠️ THE QUIET FAILURE. An overlay that shares NO field name with the
        // embedded block overrides NOTHING: every figure on the page is still
        // the feed's, and the overlay's own numbers are inert. It looks like a
        // successful merge — "6 fields" — and is a vocabulary mismatch wearing
        // a merge's clothes. Caught live: riskAnalyst publishes `score` where
        // the renderer reads `issuer_score`, so a 5.5 authored by the axis owner
        // sat beside a 5.5 relayed through PegTracker and nothing indicated
        // which one the page was showing. Only an overlay declaring a
        // schema_version gets caught by the adoption gate; this one declares
        // none, so it needs its own signal.
        // ⚠️ THE WARNING SAYS THE PAGE "CANNOT TELL" WHETHER AN OVERLAY IS ADDITIVE
        // BY DESIGN. Where the schema DECLARES it, the page can tell — so asking
        // the reader to worry is wrong, and firing on every issuer overlay would
        // train them to ignore the chip on the axes where it means something.
        //
        // Only a schema that has NOT declared itself additive still warns; an
        // unknown vocabulary sharing no field with the feed remains exactly the
        // ambiguous case this was written for.
        var _adopted = (this.ADOPTED_OVERLAY_SCHEMAS[axis] || {})[p.schema] || {};
        var disjoint = p.overridden.length === 0 && p.added.length > 0 &&
            p.kept.length > 0 && _adopted.additive !== true;
        var tip = 'Axis merged per field, no assembler.\n' +
            'From ' + src + ' (' + (p.file || '?') + '): ' +
            (n ? p.overridden.concat(p.added).sort().join(', ') : 'nothing') + '.\n' +
            'From the asset feed: ' + (p.kept.length ? p.kept.sort().join(', ') : 'nothing') + '.\n' +
            (p.overlay_as_of
                ? 'Overlay declares as_of ' + p.overlay_as_of + '.'
                : '\u26a0\ufe0f The overlay declares NO as_of, so its own age is unknown — the ' +
                  'clock beside this can only report the stamps the asset feed declared.') +
            (mixed ? '\n\u26a0\ufe0f MIXED: two producers, two clocks. The age shown is the oldest ' +
                     'of them, which is not necessarily this source\u2019s.' : '') +
            ((p.stale_dropped && p.stale_dropped.length)
                ? '\n\u26a0\ufe0f Dropped as stale: ' + p.stale_dropped.sort().join(', ') +
                  ' \u2014 the asset feed\u2019s rendering of a value this overlay overrode. Kept, it ' +
                  'would have displayed the OLD number under the OLD label.'
                : '');
        if (disjoint) {
            tip += '\n\u26a0\ufe0f NO FIELD IN COMMON with the asset feed: this overlay overrode ' +
                   'NOTHING. Every figure rendered on this axis is still the feed\u2019s. Either the ' +
                   'two producers spell the same quantity differently, or this overlay is additive ' +
                   'by design \u2014 the page cannot tell which, and it must not assume the second.';
        }
        return '<span class="axis-src' + (disjoint ? ' axis-src-refused' : (mixed ? ' axis-src-mixed' : '')) +
            '" title="' + this._escapeAttr(tip) + '">' +
            (disjoint ? '\u26a0\ufe0f ' + this._escapeAttr(src) + ' \u00b7 no field in common'
                      : (mixed ? 'mixed \u00b7 ' : '') + this._escapeAttr(src) +
                        (n ? ' \u00b7 ' + n + (n === 1 ? ' field' : ' fields') : '')) + '</span>';
    },

    // ------ Collateral-ratio scale resolution ------
    //
    // Feeds disagree on units: USDm publishes collateral_ratio as a RAW ratio
    // (1.296) while every other feed publishes percent (129.60). This used to
    // be resolved with `if (cr < 2) cr *= 100` — inferring the unit from the
    // value's magnitude. That is the same class of bug as guessing token
    // decimals from a number's size: correct until the value enters the
    // ambiguous range, then silently and confidently wrong.
    //
    // It fails BOTH ways. A raw feed reaching 2.0 (double-collateralised, the
    // healthiest state it can reach) rendered as "2.00%". A percent feed
    // falling below 2% (near-total loss of backing) would be multiplied to
    // "150%" and coloured green.
    //
    // Resolution order — never magnitude:
    //   1. summary.collateral_ratio_scale, if the feed declares it
    //   2. RAW_CR_ASSETS, an explicit per-asset list
    //   3. default: percent, returned unchanged
    //
    // The default is deliberate. An undeclared raw feed renders alarmingly low
    // and gets investigated; the reverse — a distressed feed silently rendered
    // healthy — is the failure that sits on a public page unnoticed.
    // Retired 2026-08-27: usdm now declares collateral_ratio_scale on both blocks,
    // so the declared branch resolves it and a per-asset list encoding producer
    // knowledge in the consumer is no longer needed. Kept empty rather than
    // deleted so the resolution order below still reads as three steps, and so
    // re-adding an entry is visibly a fallback rather than the normal path.
    RAW_CR_ASSETS: [],

    normalizeCollateralRatio(value, assetSlug, summary) {
        if (value === null || value === undefined) return value;
        var declared = summary && summary.collateral_ratio_scale;
        if (declared === 'percent') return value;
        if (declared === 'ratio') return value * 100;
        if (declared) return value;  // unrecognised declaration: trust it as-is
        if (assetSlug && CommonRenderer.RAW_CR_ASSETS.indexOf(assetSlug) !== -1) {
            return value * 100;
        }
        return value;
    },

    formatCurrency(num) {
        if (num === null || num === undefined) return '-';
        if (Math.abs(num) >= 1e6) return '$' + (num / 1e6).toFixed(1) + 'M';
        if (Math.abs(num) >= 1e3) return '$' + (num / 1e3).toFixed(1) + 'K';
        return '$' + num.toFixed(0);
    },

    formatCurrencyExact(num) {
        if (num === null || num === undefined) return '-';
        return '$' + num.toLocaleString('en-US', { maximumFractionDigits: 0 });
    },

    formatPercent(num, decimals) {
        if (num === null || num === undefined) return '-';
        decimals = decimals !== undefined ? decimals : 2;
        return num.toFixed(decimals) + '%';
    },

    formatDate(isoString) {
        if (!isoString) return '-';
        var utc = isoString.endsWith('Z') ? isoString : isoString + 'Z';
        return new Date(utc).toLocaleString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
        });
    },

    // ------ Peg / NAV-spread shared helpers ------
    // Threshold mirrors the Layer-3 alerter:
    //   <0.25% → Healthy (ok)
    //   <0.50% → Watch   (warn)
    //   ≥0.50% → Stress  (critical)
    // Absolute value — premium and discount of equal magnitude get the same severity.
    pegStatusClass(pctValue) {
        if (pctValue == null) return 'unknown';
        var abs = Math.abs(pctValue);
        if (abs < 0.25) return 'ok';
        if (abs < 0.50) return 'warn';
        return 'critical';
    },

    pegStatusLabel(state) {
        if (state === 'ok') return 'Healthy';
        if (state === 'warn') return 'Watch';
        if (state === 'critical') return 'Stress';
        return '—';
    },

    pegPctText(pct, decimals) {
        if (pct == null) return '—';
        decimals = decimals != null ? decimals : 3;
        var sign = pct >= 0 ? '+' : '';
        return sign + pct.toFixed(decimals) + '%';
    },

    pegPctClass(state) {
        if (state === 'ok') return 'text-green-600';
        if (state === 'warn') return 'text-amber-600';
        if (state === 'critical') return 'text-red-600';
        return 'text-slate-500';
    },

    // ±25 / ±50 / ±100 bps reference bands for peg/spread charts.
    pegBandAnnotations() {
        return {
            healthyBand:   { type: 'box', yMin: -0.25, yMax: 0.25, backgroundColor: 'rgba(34, 197, 94, 0.07)', borderWidth: 0 },
            watchBandPos:  { type: 'box', yMin: 0.25, yMax: 0.50, backgroundColor: 'rgba(245, 158, 11, 0.06)', borderWidth: 0 },
            watchBandNeg:  { type: 'box', yMin: -0.50, yMax: -0.25, backgroundColor: 'rgba(245, 158, 11, 0.06)', borderWidth: 0 },
            stressBandPos: { type: 'box', yMin: 0.50, yMax: 1.00, backgroundColor: 'rgba(239, 68, 68, 0.06)', borderWidth: 0 },
            stressBandNeg: { type: 'box', yMin: -1.00, yMax: -0.50, backgroundColor: 'rgba(239, 68, 68, 0.06)', borderWidth: 0 },
            line25pos:  { type: 'line', yMin: 0.25,  yMax: 0.25,  borderColor: '#22c55e', borderWidth: 1, borderDash: [3, 3], label: { content: '+25 bps', display: true, position: 'end', font: { size: 9 }, color: '#16a34a' } },
            line25neg:  { type: 'line', yMin: -0.25, yMax: -0.25, borderColor: '#22c55e', borderWidth: 1, borderDash: [3, 3], label: { content: '-25 bps', display: true, position: 'end', font: { size: 9 }, color: '#16a34a' } },
            line50pos:  { type: 'line', yMin: 0.50,  yMax: 0.50,  borderColor: '#f59e0b', borderWidth: 1, borderDash: [3, 3], label: { content: '+50 bps', display: true, position: 'end', font: { size: 9 }, color: '#d97706' } },
            line50neg:  { type: 'line', yMin: -0.50, yMax: -0.50, borderColor: '#f59e0b', borderWidth: 1, borderDash: [3, 3], label: { content: '-50 bps', display: true, position: 'end', font: { size: 9 }, color: '#d97706' } },
            line100pos: { type: 'line', yMin: 1.00,  yMax: 1.00,  borderColor: '#ef4444', borderWidth: 1, borderDash: [3, 3], label: { content: '+100 bps', display: true, position: 'end', font: { size: 9 }, color: '#dc2626' } },
            line100neg: { type: 'line', yMin: -1.00, yMax: -1.00, borderColor: '#ef4444', borderWidth: 1, borderDash: [3, 3], label: { content: '-100 bps', display: true, position: 'end', font: { size: 9 }, color: '#dc2626' } },
            zero:       { type: 'line', yMin: 0,     yMax: 0,     borderColor: '#94a3b8', borderWidth: 1 }
        };
    },

    // ------ Summary cards ------
    renderSummaryCards(data) {
        var s = data.summary;
        var displaySupply = s.circulating_supply || s.tvl_ex_pol || s.total_supply;
        var supplyLabel = (s.circulating_supply || s.tvl_ex_pol) ? 'Circulating Supply' : 'Total Supply';
        // Vault-share assets (1 unit ≠ $1) opt out of dollar formatting via summary.supply_unit.
        var supplyValue;
        if (s.supply_unit === 'shares') {
            supplyValue = (displaySupply || 0).toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' shares';
        } else {
            supplyValue = this.formatCurrencyExact(displaySupply);
        }

        var cards = [
            { label: supplyLabel, value: supplyValue },
            { label: 'Total Backing', value: this.formatCurrencyExact(s.total_backing) },
            { label: 'Collateral Ratio', value: this.formatPercent(s.collateral_ratio), cls: s.collateral_ratio >= 100 ? 'positive' : 'negative' },
            { label: s.collateral_ratio_alt.label, value: s.collateral_ratio_alt.is_currency ? this.formatCurrency(s.collateral_ratio_alt.value) : this.formatPercent(s.collateral_ratio_alt.value), cls: s.collateral_ratio_alt.is_currency ? '' : (s.collateral_ratio_alt.value >= 100 ? 'positive' : 'warning') },
            { label: 'Surplus / Deficit', value: this.formatCurrencyExact(s.surplus_deficit), cls: s.surplus_deficit >= 0 ? 'positive' : 'negative' },
        ];

        // Asset-specific renderers can prepend extra cards (e.g. NAV for vault shares).
        var spec = data.asset_specific || {};
        if (Array.isArray(spec.extra_summary_cards)) {
            cards = spec.extra_summary_cards.concat(cards);
        }
        // Asset-specific renderers can override individual cards by label
        // (e.g. relabel "Collateral Ratio" → "Pool Coverage Ratio" + add subtext).
        // An override with `hidden: true` removes the card entirely.
        var overrides = spec.card_overrides;
        if (overrides && typeof overrides === 'object') {
            cards = cards.map(function(c) {
                var ov = overrides[c.label];
                if (!ov) return c;
                return Object.assign({}, c, ov);
            }).filter(function(c) { return !c.hidden; });
        }

        var container = document.getElementById('summary-cards');
        container.innerHTML = cards.map(function(c) {
            return '<div class="summary-card">' +
                '<div class="card-label">' + c.label + '</div>' +
                (c.prefix_html ? c.prefix_html : '') +
                '<div class="card-value ' + (c.cls || '') + '">' + c.value + '</div>' +
                (c.subtext ? '<div class="text-xs text-slate-400 mt-1">' + c.subtext + '</div>' : '') +
                (c.extra_html ? c.extra_html : '') +
                '</div>';
        }).join('');
    },

    // Legacy top-level backing_breakdown vs the 5-axis backing.breakdown.
    //
    // Bespoke renderers either synthesise the legacy field or hide this table, so
    // the unguarded data.backing_breakdown.map() below only ever saw feeds that
    // had it. susds is the first GENERIC-path asset emitting the 5-axis shape
    // only, and it threw "Cannot read properties of undefined (reading 'map')" —
    // which fails the WHOLE page, not just the table. Every future 5-axis-only
    // asset would hit the same wall.
    //
    // Falls back to the publisher's own backing.breakdown rather than deriving
    // anything; `tags` is optional there, so it is defaulted at the read site.
    _backingBreakdown(data) {
        if (data && Array.isArray(data.backing_breakdown)) return data.backing_breakdown;
        if (data && data.backing && Array.isArray(data.backing.breakdown)) return data.backing.breakdown;
        return [];
    },

    // ------ Backing breakdown table ------
    renderBreakdownTable(data) {
        var tbody = document.querySelector('#breakdown-table tbody');
        var bd = CommonRenderer._backingBreakdown(data);
        if (!bd.length) { var bp = tbody && tbody.closest('.panel'); if (bp) bp.style.display = 'none'; return; }
        var rows = bd.map(function(item) {
            // `tags` is optional in the 5-axis backing.breakdown shape. Normalise
            // once here rather than guarding each read — the previous fix guarded
            // .map and the very next line still threw on .indexOf.
            var itemTags = Array.isArray(item.tags) ? item.tags : [];
            var tags = itemTags.map(function(t) {
                return '<span class="tag tag-' + t + '">' + t + '</span>';
            }).join('');
            var barColor = itemTags.indexOf('amo') >= 0 ? '#ef4444' :
                           itemTags.indexOf('cross-chain') >= 0 ? '#3b82f6' :
                           itemTags.indexOf('idle') >= 0 ? '#22c55e' : '#6366f1';
            return '<tr>' +
                '<td class="font-medium">' + item.label + tags + '</td>' +
                '<td class="text-right font-mono">' + CommonRenderer.formatCurrencyExact(item.value) + '</td>' +
                '<td class="text-right font-mono">' + CommonRenderer.formatPercent(item.pct, 1) + '</td>' +
                '<td><div class="pct-bar-container"><div class="pct-bar" style="width:' + item.pct + '%; background:' + barColor + '"></div></div></td>' +
                '</tr>';
        });

        // Total row
        var total = bd.reduce(function(sum, i) { return sum + i.value; }, 0);
        rows.push(
            '<tr class="font-bold border-t-2 border-slate-200">' +
            '<td>Total</td>' +
            '<td class="text-right font-mono">' + CommonRenderer.formatCurrencyExact(total) + '</td>' +
            '<td class="text-right">100%</td>' +
            '<td></td></tr>'
        );
        tbody.innerHTML = rows.join('');

        // Basis caption: the % column is each line's share of the displayed
        // backing pie (the 100% row), NOT share of token supply. Generic line
        // for every asset; USG gets an addendum because the same page shows POL
        // on two different bases that otherwise look contradictory — the pie's
        // "POL pool stables" counter-side % vs the Supply Composition panel's
        // "POL deployed" share. Figures are read from live data so they always
        // match the panels above (no hardcoded numbers to go stale).
        var cap = document.getElementById('breakdown-caption');
        if (cap) {
            var note = "Percentages are each line’s share of total displayed backing (the 100% row) — not share of token supply.";
            if (data.asset_slug === 'usg') {
                var sc = data.asset_specific && data.asset_specific.supply_composition;
                var polRow = CommonRenderer._backingBreakdown(data).filter(function(i) {
                    return i.tags && i.tags.indexOf('pol') >= 0;
                })[0];
                var polPiePct = polRow ? CommonRenderer.formatPercent(polRow.pct, 1) : null;
                var polSupplyPct = sc && sc.pol_pct != null ? CommonRenderer.formatPercent(sc.pol_pct, 1) : null;
                note += ' <strong>USG:</strong> this is the inclusive-CR backing pie (CDP collateral + PegKeeper pool counter-side stables).';
                if (polPiePct && polSupplyPct) {
                    note += ' The “POL pool stables (PegKeeper)” line — the pool counter-side stablecoins (USDC/frxUSD paired against protocol-minted USG) — is ' + polPiePct +
                        ' of this pie. That is a different quantity from the “POL deployed” figure (' + polSupplyPct +
                        ') in the Supply Composition panel above, which counts the protocol-minted USG itself as a share of supply. Both are correct: different numerators (counter-side stables vs minted USG) and different denominators (backing pie vs supply).';
                }
            }
            cap.innerHTML = note;
        }
    },

    // ⚠️ THE ROW DOES NOT COLLAPSE ON ITS OWN. The backing row is a 3-column
    // grid: "Backing Breakdown" spans 2 and the Risk Flags / Allocation sidebar
    // takes 1. Both wide panels hide themselves when an asset publishes no
    // breakdown — and the sidebar then sits alone in column 1 with two thirds of
    // a 1440px row empty beside it, which looks like a broken layout rather than
    // an asset with less to show.
    //
    // So when the wide panel is gone the sidebar spans the full row, and the
    // flags inside lay out in columns rather than stretching one short sentence
    // across the viewport.
    reflowBackingGrid() {
        var grid = document.querySelector('#section-backing .grid');
        if (!grid) return;
        var wide = grid.querySelector('.lg\\:col-span-2');
        var sidebar = null;
        Array.prototype.forEach.call(grid.children, function(c) {
            if (c !== wide && !c.classList.contains('lg:col-span-2')) sidebar = c;
        });
        if (!sidebar) return;
        var wideHidden = !wide || getComputedStyle(wide).display === 'none';
        sidebar.classList.toggle('backing-sidebar-full', wideHidden);
        var flags = document.getElementById('risk-flags');
        if (flags) flags.classList.toggle('risk-flags-columns', wideHidden);
    },

    // ⚠️ A DEPTH FIGURE THAT MEASURES ONE LEG OF A TWO-LEG EXIT IS NOT A DOLLAR
    // FIGURE, and rendered bare it will be read as one. reUSDe's $15.5K is the
    // reUSDe -> sUSDe leg on Curve; a dollar exit also pays sUSDe -> USD, which
    // this ladder does not measure. So the number UNDERSTATES true exit cost —
    // the producer declared that scope rather than quoting a dollar figure it had
    // not measured, and declaring it is worthless if the consumer drops it.
    //
    // Also renders which leg BINDS the axis. The axis scores the worse of {venue
    // depth, primary redemption}; saying which one that is turns a rating into a
    // statement a reader can act on: here $15.5K of venue against $1.5M/quarter
    // of primary, so the venue is the constraint.
    _renderDepthScope(data) {
        var l = data.liquidity || {};
        var head = document.getElementById('axis-liquidity-head');
        if (!head) return;
        var ds = (l.depth && l.depth.denomination_scope) || l.denomination_scope;
        var bind = l.axis_binding_constraint;
        // ⚠️ A WITHHELD DEPTH MUST SAY WHY IT WAS WITHHELD. Adopting liquidity/1
        // replaces the axis, and on syzUSD that swapped a $200K figure for
        // "unmeasured" — correctly: DexTracker withheld it because the anchor
        // "came from the router being measured", which is the syzUSD case where
        // 194 of 201bps turned out to be basis rather than slippage. Showing the
        // old number would show one known to be unsound. But a bare "n/a" reads
        // as a broken feed, and the producer's reason is right there.
        var withheld = l.depth && typeof l.depth === 'object' &&
            l.depth.depth_usd == null && l.depth.basis;
        var self = this, bits = [];

        // ⚠️ EMBEDDED FALLBACK. The three fields above are liquidity/1 (DexTracker),
        // and only 3 of 25 published assets have that overlay — so for the other 22
        // this function could never fire, no matter what their feed declared. Ten of
        // them DO declare a measured venue, in four different shapes, and none of it
        // reached the page: yzUSD publishes a full by_chain breakdown that rendered
        // nowhere.
        //
        // This is the axis-3 twin of the backing axis's `supply_scope` chip, which
        // exists because usdat published a 100.00% collateral ratio that was an
        // ETHEREUM-ONLY statement, and the word Ethereum appeared once on the page.
        // A depth figure with no scope is populated but misleading — it looks
        // complete, which is worse than a blank.
        var derived = null;
        if (!ds && !bind && !withheld) {
            // 1. An explicit producer declaration beats anything I derive.
            if (typeof l.scope === 'string' && l.scope.trim()) {
                derived = 'Measured scope: ' + l.scope.trim().replace(/_/g, ' ');
            } else {
                // 2. Otherwise the pools' own chains — but ONLY as a union, never a
                // pick. Naming one chain when pools span several would be inventing
                // a scope, which is the failure this line exists to prevent.
                var pools = Array.isArray(l.pools) ? l.pools : [];
                var chains = [];
                pools.forEach(function(pl) {
                    var c = pl && pl.chain ? String(pl.chain).trim().toLowerCase() : '';
                    if (c && chains.indexOf(c) < 0) chains.push(c);
                });
                // by_chain names venues per chain; use its keys when pools carry none.
                if (!chains.length && Array.isArray(l.by_chain)) {
                    l.by_chain.forEach(function(e) {
                        var c = e && e.chain ? String(e.chain).trim().toLowerCase() : '';
                        if (c && chains.indexOf(c) < 0) chains.push(c);
                    });
                }
                if (chains.length === 1) {
                    derived = 'Depth measured on ' + chains[0] + ' only.';
                } else if (chains.length > 1) {
                    derived = 'Depth measured across ' + chains.length + ' chains: ' +
                        chains.sort().join(', ') + '.';
                }
            }
            // ⚠️ NOT `volume_24h_scope`. That names the DATA SOURCE for volume
            // ("geckoterminal_…"), not the chain depth was measured on. Reading it
            // as a depth scope would be the same error as reading `base_token` on a
            // PYUSD-reserved dollar as the token — a field name assumed to mean what
            // it sounds like.
            if (!derived) return;
        }
        if (derived) {
            bits.push('<div class="ds-line"><span class="ds-key">Scope:</span> ' +
                self._escapeAttr(derived) + '</div>');
        }
        if (withheld) {
            bits.push('<div class="ds-line ds-warn">\u26a0\ufe0f Depth not published \u2014 ' +
                self._escapeAttr(String(l.depth.basis)) + '</div>');
        }
        if (ds && typeof ds === 'object') {
            bits.push('<div class="ds-line"><span class="ds-key">Measured leg:</span> ' +
                self._escapeAttr(String(ds.measured_leg || '?')) +
                (ds.excluded_leg
                    ? ' \u00b7 <span class="ds-warn">excludes ' +
                      self._escapeAttr(String(ds.excluded_leg)) + '</span>' : '') + '</div>');
            if (ds.exit_cost_scope) {
                bits.push('<div class="ds-line ds-warn">\u26a0\ufe0f ' +
                    self._escapeAttr(String(ds.exit_cost_scope)) + '</div>');
            }
        }
        if (bind && typeof bind === 'object' && bind.basis) {
            bits.push('<div class="ds-line"><span class="ds-key">Binding leg:</span> ' +
                self._escapeAttr(String(bind.leg || '?').replace(/_/g, ' ')) + ' \u2014 ' +
                self._escapeAttr(String(bind.basis)) + '</div>');
        }
        if (!bits.length) return;
        var el = document.createElement('div');
        el.className = 'depth-scope';
        el.innerHTML = bits.join('');
        head.appendChild(el);
    },

    // ⚠️ WHEN DEPTH IS UNMEASURABLE, THE EXIT IS STILL KNOWN — show it rather
    // than "n/a". reUSDe publishes no depth for an honest reason: its only venue
    // prices it in sUSDe, not dollars, so a USD ladder would inherit a second
    // asset's price. But its PRIMARY exit is measured precisely — a quarterly
    // window capped at $1.5M, ~7.9% of the tranche, first window filled exactly
    // to its ceiling. "n/a" over that is the blank-tile defect the spec forbids:
    // a reader scanning the top row learns nothing about an exit we can describe
    // better than most assets on the dashboard.
    //
    // ⚠️ Rendered as a RATE, never as a depth figure. $1.5M per quarter is not
    // $1.5M of depth, and the sub-label says which. The axis rating still comes
    // from depth alone and stays unrated here — this fills the VALUE slot, not
    // the score.
    _exitCapacityHtml(liq) {
        var pe = liq && liq.primary_exit;
        if (!pe || typeof pe !== 'object') return 'n/a';
        var pct = typeof pe.capacity_pct_of_tranche === 'number' ? pe.capacity_pct_of_tranche : null;
        var cad = pe.cadence ? String(pe.cadence) : null;
        if (pct != null && cad) {
            return '<span title="' + this._escapeAttr(
                    [pe.gate, pe.capacity_basis, pe.note].filter(Boolean).join(' \u2014 ')) + '">' +
                pct + '%<span class="text-slate-400 text-base font-normal">/' +
                this._escapeAttr(cad.replace(/ly$/, '')) + '</span></span>';
        }
        if (typeof pe.capacity_usd === 'number') {
            return this.formatCurrency(pe.capacity_usd) +
                (cad ? '<span class="text-slate-400 text-base font-normal">/' +
                       this._escapeAttr(cad.replace(/ly$/, '')) + '</span>' : '');
        }
        return 'n/a';
    },

    // ------ Pie chart ------
    renderPieChart(data) {
        var ctx = document.getElementById('pie-chart');
        if (!ctx) return;

        var items = CommonRenderer._backingBreakdown(data).filter(function(i) { return i.pct > 0.5; });
        // ⚠️ An empty doughnut is a large blank card with a title, which reads as
        // a failed render rather than as "this asset publishes no breakdown".
        // renderBreakdownTable already hides ITS panel on the same condition;
        // this one never did, so reUSD showed a titled ~200px void. Five assets
        // publish no breakdown (bmnr, mstr, strc, usdm and now reusd-re), so this
        // was visible on all of them.
        var pieShell = ctx.closest ? ctx.closest('.panel') : null;
        if (pieShell) pieShell.style.display = items.length ? '' : 'none';
        if (!items.length) {
            if (window._pieChart) { window._pieChart.destroy(); window._pieChart = null; }
            CommonRenderer.reflowBackingGrid();
            return;
        }
        var palette = ['#6366f1', '#3b82f6', '#14b8a6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#84cc16'];
        var colorIdx = 0;
        var colors = items.map(function(i) {
            var ts = Array.isArray(i.tags) ? i.tags : [];
            if (ts.indexOf('amo') >= 0 || ts.indexOf('circular') >= 0) return '#ef4444';
            if (ts.indexOf('cross-chain') >= 0) return '#3b82f6';
            if (ts.indexOf('idle') >= 0) return '#22c55e';
            if (ts.indexOf('pegkeeper') >= 0) return '#f97316';
            return palette[colorIdx++ % palette.length];
        });

        if (window._pieChart) window._pieChart.destroy();
        window._pieChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: items.map(function(i) { return i.label; }),
                datasets: [{
                    data: items.map(function(i) { return i.value; }),
                    backgroundColor: colors,
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: true, position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } },
                    tooltip: {
                        callbacks: {
                            label: function(ctx) {
                                return ctx.label + ': ' + CommonRenderer.formatCurrencyExact(ctx.raw) + ' (' + CommonRenderer.formatPercent(ctx.raw / data.summary.total_backing * 100, 1) + ')';
                            }
                        }
                    }
                }
            }
        });
    },

    // ⚠️ An accounting divergence is not a solvency event, and the flag text
    // cannot say so.
    //
    // USDat's critical flag reads "holds $80,461,171.08 but totalAssets() reports
    // $0.00 (100.000000% of supply unaccounted by the contract)". To a holder,
    // "100% unaccounted" reads as THE MONEY IS MISSING. It is not: backing and
    // supply tie to the cent. What is absent is the contract's recognition of the
    // assets, because the token holding all of them is not on its own allowlist.
    //
    // Both halves matter and neither substitutes. Quoting only the backing
    // understates a real defect; quoting only "unaccounted" is a false solvency
    // alarm. The flag is feed-emitted and is NOT reworded here — this adds the
    // half the reader needs, from the producer's own structured fields
    // (contract_total_assets_usd, backing_total_usd, supply_usd), not by parsing
    // the message. Generic: any asset emitting these fields gets it.
    _divergenceContextHtml(data) {
        var s = data.summary || {};
        var contractTA = s.contract_total_assets_usd;
        var backing = s.backing_total_usd;
        var supply = s.supply_usd;
        if (contractTA == null || backing == null || supply == null) return '';
        if (contractTA >= backing * 0.5) return '';          // no material divergence
        if (!(backing > 0) || Math.abs(backing - supply) / supply > 0.005) return '';
        return '<div class="text-xs text-slate-700 dark:text-slate-200 bg-slate-50 ' +
            'dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded p-2 mt-2">' +
            '<span class="font-semibold">What the divergence is, and is not.</span> The assets are ' +
            'present: backing <span class="font-mono">' + this.formatCurrencyExact(backing) +
            '</span> against supply <span class="font-mono">' + this.formatCurrencyExact(supply) +
            '</span>, tying to the cent. What is missing is the <em>contract\u2019s recognition</em> ' +
            'of them \u2014 <span class="font-mono">totalAssets()</span> reports ' +
            this.formatCurrencyExact(contractTA) + '. That is a real defect, and anything dividing ' +
            'by it degenerates rather than mispricing, but it is not absent backing.' +
        '</div>';
    },

    // ⚠️ report_url_status is published and was unread — both link sites keyed on
    // report_url alone. PegTracker's convention: "published" is verified live,
    // "unavailable" is known-dead, "unverified" means the producer could not
    // check (transport failure, stale cache) and emits the link anyway.
    //
    // A renderer must not turn "could not verify" into a promise. yzUSD and
    // syzUSD ship report_url with status "unverified" and both URLs 404 today —
    // linking them would put two dead links on a public page, which is the same
    // six-404 problem this repo hit last week from the other direction.
    //
    // Absent status still links, so feeds that never emit the field are
    // unaffected. Every live asset today is "published" and unchanged.
    _reportUrlUsable(issuer) {
        if (!issuer || !issuer.report_url) return false;
        var st = issuer.report_url_status;
        return (st == null || st === 'published');
    },

    // ------ Feed staleness ------
    //
    // ⚠️ Built because NOTHING detected Saturn going 4.1h stale. usdat, susdat
    // and saturn_family sat on a timed-out analyzer's previous output; the only
    // time on those pages was a bare "Updated:" stamp with no judgement attached,
    // and a human noticed it looked old. Seven renderers had a bespoke freshness
    // surface and seven did not — saturn.js was in the second group.
    //
    // Deliberately ONE implementation in the common path rather than fourteen.
    // Per-renderer is how thusd ended up the only tier-3 page missing its section
    // suppression: a thing added n times gets added n-1 times.
    //
    // A timed-out analyzer leaves the PREVIOUS file in place, so a stale payload
    // has correct schema, correct blocks and plausible numbers. It differs from a
    // good one only in its timestamp — which is why this reads the timestamp and
    // nothing else.
    //
    // Silent when fresh. A permanent "data is current" badge on 22 pages is the
    // noise that teaches people to skip the one that matters.
    //
    // ⚠️ Thresholds mirror check_feeds.py deliberately. Two places to update; the
    // alternative is a page and a checker that disagree about what stale means,
    // which is worse than the duplication.
    STALE_SLOW_ASSETS: { bmnr: 1, frax: 1 },   // own cadences, not hourly

    renderStalenessBanner(data, slug) {
        var el = document.getElementById('staleness-banner');
        if (!el) return;
        el.innerHTML = '';
        // ⚠️ Three field names in use across the feeds: timestamp (most),
        // as_of (bmnr, saturn), timestamp_utc (strc/mstr). Reading only the
        // first two left strc and mstr silently unbannered — found by backdating
        // every feed and loading all 23 pages, not by reading the code. A
        // staleness banner that cannot see an asset's timestamp is exactly the
        // failure it exists to catch, one level up.
        var ts = data && (data.timestamp || data.as_of || data.timestamp_utc);
        if (!ts) return;
        var t = Date.parse(String(ts).endsWith('Z') || /[+-]\d\d:?\d\d$/.test(String(ts))
            ? ts : ts + 'Z');
        if (!isFinite(t)) return;
        var hours = (Date.now() - t) / 3600000;

        var slow = slug && this.STALE_SLOW_ASSETS[slug];
        var warnAt = slow ? 12 : 3;
        var failAt = slow ? 30 : 6;
        if (hours <= warnAt) return;

        var crit = hours > failAt;
        var cls = crit
            ? 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-800 dark:text-red-200'
            : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200';
        var age = hours < 48 ? hours.toFixed(1) + ' hours' : (hours / 24).toFixed(1) + ' days';

        el.innerHTML =
            '<div class="border rounded p-3 mb-4 text-sm ' + cls + '">' +
                '<span class="font-semibold">' +
                    (crit ? 'This data is stale.' : 'This data is older than expected.') +
                '</span> Last updated <span class="font-mono">' + age + '</span> ago' +
                (slow ? ' (this asset refreshes on a slower cadence).' : ', against an hourly refresh.') +
                ' Every figure below is from that snapshot' +
                (crit
                    ? ' \u2014 an analyzer that fails leaves its previous output in place, so these ' +
                      'numbers look normal and are simply old.'
                    : '.') +
            '</div>';
    },

    // ------ Risk flags ------
    renderRiskFlags(data) {
        var container = document.getElementById('risk-flags');
        if (!data.risk_flags || data.risk_flags.length === 0) {
            container.innerHTML = '<div class="text-green-600 text-sm font-medium">No risk flags</div>';
            return;
        }
        container.innerHTML = data.risk_flags.map(function(f) {
            return '<div class="risk-flag risk-' + f.severity + '">' + f.message + '</div>';
        }).join('') + this._divergenceContextHtml(data);
    },

    // ------ CR trend chart ------
    renderCRChart(historyData, opts) {
        var ctx = document.getElementById('cr-chart');
        if (!ctx || !historyData || !historyData.entries || historyData.entries.length < 2) {
            document.getElementById('chart-panel').style.display = 'none';
            return;
        }
        document.getElementById('chart-panel').style.display = '';

        // Idempotency, not SPA cleanup — every asset change here is a full page
        // load (nothing in js/ calls pushState or listens for popstate), so the
        // panel never carries another asset's state. What this guards is a
        // SECOND call on the same page: the absent-note branch below mutates the
        // panel, and a re-render must be able to undo that.
        var chartPanel = document.getElementById('chart-panel');
        var priorNote = document.getElementById('cr-chart-absent-note');
        if (priorNote) priorNote.remove();
        var chartHolder = chartPanel.querySelector('.chart-container');
        if (chartHolder) chartHolder.style.display = '';

        opts = opts || {};
        var bands = opts.bands || {
            critical: [0, 100], thin: [100, 110], amber: [110, 130], healthy: [130, 200],
            min_line: 100, max_line: 130
        };
        var title = opts.title || 'Collateral Ratio History';
        var datasetLabel = opts.dataset_label || 'CR';
        var altDatasetLabel = opts.alt_dataset_label || 'CR (gross)';
        // suggestedMin/Max default keeps the original 80-150 range; tight ratios (PCR) want to override
        var yMin = opts.y_min !== undefined ? opts.y_min : 80;
        var yMax = opts.y_max !== undefined ? opts.y_max : 150;
        // Asset-specific renderers can opt in through chart_bands metadata;
        // absence preserves the shared renderer's historical behavior.
        var sanityFloor = opts.cr_sanity_floor !== undefined ? opts.cr_sanity_floor : bands.cr_sanity_floor;
        // ⚠️ THE EXCLUSION WAS OPT-IN AND NOBODY OPTED IN. Every branch below that
        // filters, counts and discloses a flagged read was gated behind
        // `chart_bands.exclude_suspect`, and across all 27 assets NOT ONE declares
        // it — so this machinery had never executed in production. crvUSD is the
        // only history with a tripped flag, and all three of its flagged reads were
        // being plotted: the 122.02% spike (producer: "OVERSTATED ... against
        // neighbours near 107%", an unreadable operator mint) and the 101.15% one
        // (producer: hardcoded BTC=$67,000/ETH=$2,000 after a CoinGecko failure,
        // "the true CR was ~106.5%"). Those two ARE the Min and Max, so the whole
        // published "Range: 20.87pp" was the distance between two reads the
        // producer had already written a paragraph explaining were wrong.
        //
        // A producer that sets `suspect: true` AND writes the reason has made the
        // call. Requiring a second per-asset declaration before honouring it means
        // a known-bad read reaches the reader, which is backwards. So the presence
        // of the field IS the opt-in; an explicit `false` still disables it.
        //
        // ⚠️ NOT extended to `cr_sanity_floor`. That one is an editorial threshold
        // and needs a value per asset — inferring it is the mis-scaling trap this
        // file keeps hitting. It stays opt-in and stays dormant.
        //
        // Nothing is hidden: the excluded count renders in the stats line with the
        // producer's own reasons in its tooltip.
        var historyFlagsSuspect = (historyData.entries || []).some(function(e) {
            return e && Object.prototype.hasOwnProperty.call(e, 'suspect');
        });
        var excludeSuspect = opts.exclude_suspect !== undefined ? opts.exclude_suspect
            : (bands.exclude_suspect !== undefined ? bands.exclude_suspect : historyFlagsSuspect);
        var hardYBounds = opts.hard_y_bounds !== undefined ? opts.hard_y_bounds : bands.hard_y_bounds;
        var hasSanityFloor = sanityFloor !== undefined && sanityFloor !== null;
        function saneCR(v) {
            if (v === null || v === undefined) return false;
            // Preserve the old null-only behavior unless the asset opted in.
            return !hasSanityFloor || (Number.isFinite(v) && v >= sanityFloor);
        }
        function isSuspect(e) {
            // Missing keys are intentionally treated as false for pre-flag
            // history exports and cached data.
            return !!excludeSuspect && e && e.suspect === true;
        }
        function escapeAttr(value) {
            return String(value)
                .replace(/&/g, '&amp;')
                .replace(/"/g, '&quot;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
        }
        // Update panel title if overridden
        var titleEl = document.querySelector('#chart-panel .panel-title');
        if (titleEl) titleEl.textContent = title;

        // Min/max CR stats
        //
        // ⚠️ The history series needs the SAME scale resolution as the headline
        // tile. USDm publishes collateral_ratio as a raw ratio and declares
        // `collateral_ratio_scale: "ratio"`; the tile honoured that and this
        // chart did not, so the page showed 129.57% in the headline and plotted
        // 1.2957 — a flat line at the bottom of a 0-140% axis, sitting inside
        // the red Critical band, with "Min: 1.21%" in red above it.
        //
        // A double-collateralised reserve rendered as total loss of backing.
        // Same failure the retired `if (cr < 2) cr *= 100` guard was written for,
        // reached by a different route: the fix was applied to the summary path
        // and the history path was never brought along.
        //
        // collateral_ratio_alt is deliberately NOT normalised here — usdm.js
        // already converts it (stable_only_coverage_ratio * 100) before this
        // runs, which is why the alt series was the only correct one on the chart.
        var crScaleSummary = opts.cr_scale_summary || null;
        var crScaleSlug = opts.asset_slug || null;
        var rawCRValues = historyData.entries.map(function(e) {
            return CommonRenderer.normalizeCollateralRatio(e.collateral_ratio, crScaleSlug, crScaleSummary);
        });
        var rawAltCRValues = historyData.entries.map(function(e) { return e.collateral_ratio_alt; });
        var rawAltHasData = !opts.omit_alt && rawAltCRValues.some(function(v) {
            return v !== null && v !== undefined;
        });
        // ⚠️ A CHART FRAME WITH NOTHING IN IT IS NOT AN EMPTY CHART, IT IS AN
        // UNANSWERED QUESTION. syzusd, reusd-re and reusde-re publish no
        // `_backing_history.json` at all, so the peg history arrives here and
        // every point maps to null: axes, bands, gridlines and the title
        // "Collateral Ratio History" drawn over a blank plot. A reader cannot
        // tell that from a chart that failed to load, or from a ratio that went
        // to zero. Same symptom crvusd/usds/yzusd had from the app.js ref swap,
        // and the same fix applies at the other end — say the series is absent.
        //
        // NOT the same as a series filtered to nothing by the suspect or sanity
        // guards: there the values exist, the exclusion is the finding, and the
        // stats line already reports it. This branch fires only when the field
        // is not in the data at all.
        var anyCRField = rawCRValues.some(function(v) { return v !== null && v !== undefined; });
        if (!anyCRField && !rawAltHasData) {
            if (chartHolder) chartHolder.style.display = 'none';
            var note = document.createElement('div');
            note.id = 'cr-chart-absent-note';
            note.className = 'text-sm text-slate-400';
            note.textContent = 'No collateral-ratio history is published for this asset.';
            chartPanel.appendChild(note);
            var sEl = document.getElementById('cr-chart-stats');
            if (sEl) sEl.innerHTML = '';
            return;
        }

        var crValues = rawCRValues.filter(function(v, i) {
            return !isSuspect(historyData.entries[i]) && saneCR(v);
        });
        var missingReadCount = 0;
        var suspectReadCount = 0;
        var suspectReasonCounts = {};
        var excludedCount = 0;
        if (hasSanityFloor || excludeSuspect) {
            missingReadCount = historyData.entries.filter(function(e, i) {
                var primaryMissing = rawCRValues[i] === null || rawCRValues[i] === undefined;
                var altMissing = rawAltHasData &&
                    (rawAltCRValues[i] === null || rawAltCRValues[i] === undefined);
                return primaryMissing || altMissing;
            }).length;
            historyData.entries.forEach(function(e, i) {
                var primaryPresent = rawCRValues[i] !== null && rawCRValues[i] !== undefined;
                var altPresent = !rawAltHasData ||
                    (rawAltCRValues[i] !== null && rawAltCRValues[i] !== undefined);
                if (!isSuspect(e) || !primaryPresent || !altPresent) return;
                suspectReadCount++;
                var reasons = Array.isArray(e.suspect_reasons) ? e.suspect_reasons.slice() : [];
                ['mento_api_ok', 'monad_rpc_ok', 'ethereum_rpc_ok', 'celo_rpc_ok'].forEach(function(key) {
                    if (e[key] === false && !reasons.some(function(reason) {
                        return String(reason).indexOf(key + '=false') !== -1;
                    })) {
                        reasons.push(key + '=false');
                    }
                });
                if (reasons.length === 0) reasons.push('flagged by analyzer (no reason supplied)');
                Array.from(new Set(reasons.map(String))).forEach(function(reason) {
                    suspectReasonCounts[reason] = (suspectReasonCounts[reason] || 0) + 1;
                });
            });
            if (hasSanityFloor) {
                historyData.entries.forEach(function(e, i) {
                    if (isSuspect(e)) return;
                    if (rawCRValues[i] !== null && rawCRValues[i] !== undefined &&
                        !saneCR(rawCRValues[i])) excludedCount++;
                    if (rawAltHasData && rawAltCRValues[i] !== null &&
                        rawAltCRValues[i] !== undefined && !saneCR(rawAltCRValues[i])) {
                        excludedCount++;
                    }
                });
            }
        }
        if (crValues.length > 0) {
            var minCR = Math.min.apply(null, crValues);
            var maxCR = Math.max.apply(null, crValues);
            var statsEl = document.getElementById('cr-chart-stats');
            if (!statsEl) {
                statsEl = document.createElement('div');
                statsEl.id = 'cr-chart-stats';
                statsEl.className = 'flex gap-4 text-xs text-slate-500 mb-2';
                var chartPanel = document.getElementById('chart-panel');
                var titleEl = chartPanel.querySelector('.panel-title');
                if (titleEl) titleEl.after(statsEl);
            }
            var minCls = minCR < 100 ? 'text-red-600 font-semibold' : minCR < 110 ? 'text-amber-600 font-semibold' : '';
            var suspectTooltip = Object.keys(suspectReasonCounts).sort(function(a, b) {
                return suspectReasonCounts[b] - suspectReasonCounts[a] || a.localeCompare(b);
            }).map(function(reason) {
                return reason + (suspectReasonCounts[reason] > 1 ? ' (' + suspectReasonCounts[reason] + ')' : '');
            }).join('; ');
            // ⚠️ These labels read "30d" for a long time while min/max were taken
            // over the WHOLE file. That was accidentally true — every history
            // export held ~29 days — until it wasn't: yzUSD ships 309 points
            // over 317 days, so the page called a 7.63pp ten-month range a "30d
            // range" when the real 30-day range is 3.88pp. USDS at 50 days had
            // the same defect, smaller.
            //
            // ⚠️ It inverts the reading, it does not just widen it. A 2pp move
            // against a claimed 7.63pp band looks like ordinary noise; against
            // the true 3.88pp band it is half the range and worth looking at.
            // The mislabel argues AGAINST investigating the thing it should
            // argue for.
            //
            // So: state the window instead of asserting one. A range means
            // nothing without the span it covers, and the span is right here in
            // the data — there is no reason to hardcode a guess at it.
            // ⚠️ PREFER THE PUBLISHED WINDOW. PegTracker now emits
            // asset_specific.history_window carrying the window, the point count
            // and the range computed over it — added precisely because the
            // full-file range was being read as a 30-day one. Deriving my own
            // span from the entries reproduces the original defect in a politer
            // form: yzUSD's file spans 11 months, so I would show 7.63pp while
            // the producer publishes 3.88pp over the last 30 days, and the wider
            // band makes a real step look like noise.
            //
            // The published block wins whenever it is present; the derived span
            // stays as the fallback for feeds that do not emit one.
            var hw = opts.history_window || null;
            var spanLabel = '';
            if (hw && hw.collateral_ratio_min != null && hw.collateral_ratio_max != null) {
                minCR = hw.collateral_ratio_min;
                maxCR = hw.collateral_ratio_max;
                spanLabel = (hw.points != null ? hw.points + ' obs over ' : '') +
                    (hw.window_days != null ? hw.window_days + ' days' : 'the published window');
            }
            var tsAll = (historyData.entries || []).map(function(e) {
                if (!e || !e.timestamp) return null;
                return new Date(e.timestamp.endsWith('Z') ? e.timestamp : e.timestamp + 'Z').getTime();
            }).filter(function(t) { return t && !isNaN(t); });
            if (!spanLabel && tsAll.length > 1) {
                var spanDays = Math.round((Math.max.apply(null, tsAll) - Math.min.apply(null, tsAll)) / 86400000);
                spanLabel = crValues.length + ' obs over ' +
                    (spanDays >= 60 ? Math.round(spanDays / 30) + ' months' : spanDays + ' days');
            }
            // The durable form of the reserve-step flag. The per-run flag fires
            // the hour a step happens and clears the next, while the LEVEL
            // persists — so a reader meets an odd ratio with no flag attached.
            // reserve_step_last_seen is what lets the page say the numerator
            // moved recently rather than only that it moved this hour.
            var stepNote = '';
            if (hw && hw.reserve_step_count) {
                stepNote = '<span class="text-amber-700" title="' +
                    this._escapeAttr(hw.note || '') + '">' + hw.reserve_step_count +
                    ' reserve step' + (hw.reserve_step_count === 1 ? '' : 's') +
                    ' in window' +
                    (hw.reserve_step_last_seen
                        ? ' · last ' + this.formatDate(hw.reserve_step_last_seen) : '') +
                    ' \u24d8</span>';
            }

            statsEl.innerHTML = '<span>Min: <span class="font-mono ' + minCls + '">' + minCR.toFixed(2) + '%</span></span>' +
                '<span>Max: <span class="font-mono">' + maxCR.toFixed(2) + '%</span></span>' +
                '<span>Range: <span class="font-mono">' + (maxCR - minCR).toFixed(2) + 'pp</span></span>' +
                (spanLabel ? '<span class="text-slate-400">' + spanLabel + '</span>' : '') +
                stepNote +
                (missingReadCount > 0 ? '<span class="text-slate-400">' + missingReadCount + ' observations unavailable (missing/incomplete reads)</span>' : '') +
                (suspectReadCount > 0 ? '<span class="text-amber-600" title="' + escapeAttr(suspectReadCount + ' excluded: ' + suspectTooltip) + '">' + suspectReadCount + ' flagged observations excluded as incomplete reads ⓘ</span>' : '') +
                (excludedCount > 0 ? '<span class="text-amber-600">' + excludedCount + ' implausible values excluded (&lt;' + sanityFloor + '%)</span>' : '');
        }

        var entries = historyData.entries;
        var labels = entries.map(function(e) { return new Date(e.timestamp.endsWith('Z') ? e.timestamp : e.timestamp + 'Z'); });
        var crData = rawCRValues.map(function(v, i) {
            return !isSuspect(entries[i]) && saneCR(v) ? v : null;
        });
        var crAltData = rawAltCRValues.map(function(v, i) {
            return !isSuspect(entries[i]) && saneCR(v) ? v : null;
        });

        // Drop the second series if explicitly suppressed, or if every value is null/undefined.
        var altHasData = rawAltHasData && crAltData.some(function(v) { return v !== null && v !== undefined; });
        var datasets = [{
            label: datasetLabel,
            data: crData,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            borderWidth: 2
        }];
        if (altHasData) {
            datasets.push({
                label: altDatasetLabel,
                data: crAltData,
                borderColor: '#f59e0b',
                backgroundColor: 'transparent',
                borderDash: [5, 3],
                tension: 0.3,
                pointRadius: 0,
                borderWidth: 2
            });
        }

        var minLine = bands.min_line;
        var maxLine = bands.max_line;
        var annotations = {
            critical: { type: 'box', yMin: bands.critical[0], yMax: bands.critical[1], backgroundColor: 'rgba(220, 38, 38, 0.08)', borderWidth: 0, label: { content: 'Critical', display: true, position: 'start', font: { size: 9 }, color: '#dc2626' } },
            thin: { type: 'box', yMin: bands.thin[0], yMax: bands.thin[1], backgroundColor: 'rgba(239, 68, 68, 0.06)', borderWidth: 0 },
            amber: { type: 'box', yMin: bands.amber[0], yMax: bands.amber[1], backgroundColor: 'rgba(245, 158, 11, 0.06)', borderWidth: 0 },
            healthy: { type: 'box', yMin: bands.healthy[0], yMax: bands.healthy[1], backgroundColor: 'rgba(22, 163, 74, 0.04)', borderWidth: 0 }
        };
        if (minLine !== undefined && minLine !== null) {
            annotations.minLine = { type: 'line', yMin: minLine, yMax: minLine, borderColor: '#dc2626', borderWidth: 1, borderDash: [4, 4], label: { content: minLine + '%', display: true, position: 'end', font: { size: 9 }, color: '#dc2626' } };
        }
        if (maxLine !== undefined && maxLine !== null) {
            annotations.maxLine = { type: 'line', yMin: maxLine, yMax: maxLine, borderColor: '#16a34a', borderWidth: 1, borderDash: [4, 4], label: { content: maxLine + '%', display: true, position: 'end', font: { size: 9 }, color: '#16a34a' } };
        }

        // Keep the raw Chart.js config unambiguous: a scale has either hard
        // bounds or suggested bounds, never min/max keys whose values happen
        // to be undefined. Suggested bounds yield to genuine data outside the
        // normal envelope after asset-level artifact filtering.
        var yScaleOptions = {
            grid: { color: '#f1f5f9' },
            ticks: {
                callback: function(v) { return v + '%'; },
                font: { size: 11 }
            }
        };
        if (hardYBounds) {
            yScaleOptions.min = yMin;
            yScaleOptions.max = yMax;
        } else {
            yScaleOptions.suggestedMin = yMin;
            yScaleOptions.suggestedMax = yMax;
        }

        if (window._crChart) window._crChart.destroy();
        window._crChart = new Chart(ctx, {
            type: 'line',
            data: { labels: labels, datasets: datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'time',
                        time: { unit: 'day', displayFormats: { day: 'MMM d' } },
                        grid: { display: false },
                        ticks: { maxTicksLimit: 8, font: { size: 11 } }
                    },
                    y: yScaleOptions
                },
                plugins: {
                    legend: { display: true, position: 'top', labels: { boxWidth: 12, font: { size: 11 } } },
                    tooltip: {
                        callbacks: {
                            label: function(ctx) { return ctx.dataset.label + ': ' + ctx.raw.toFixed(2) + '%'; }
                        }
                    },
                    annotation: { annotations: annotations }
                },
                interaction: { intersect: false, mode: 'index' }
            }
        });
    },

    // =====================================================================
    // 5-AXIS RISK FRAME
    // Activated only for assets that carry the Layer-1 axis blocks (peg /
    // liquidity / backing / dependencies / issuer). Assets without the blocks
    // keep the legacy backing-only layout untouched (the 4 non-backing
    // sections stay hidden and #summary-cards shows the old CR cards).
    // =====================================================================

    // True once the analyzer emits the standard axis contract. Keyed on `peg`
    // (the first block the analyzer attaches); the whole set lands together.
    hasAxisBlocks(data) {
        return !!(data && data.peg && typeof data.peg === 'object');
    },

    // Map a metric to a 1–5 rating against ascending/descending cutoffs.
    // direction 'high' = larger is better (liquidity, backing);
    // 'low' = smaller is better (peg deviation).
    _rate(value, cutoffs, direction) {
        if (value == null || !Array.isArray(cutoffs) || cutoffs.length !== 4) return null;
        if (direction === 'low') {
            if (value < cutoffs[0]) return 5;
            if (value < cutoffs[1]) return 4;
            if (value < cutoffs[2]) return 3;
            if (value < cutoffs[3]) return 2;
            return 1;
        }
        if (value >= cutoffs[0]) return 5;
        if (value >= cutoffs[1]) return 4;
        if (value >= cutoffs[2]) return 3;
        if (value >= cutoffs[3]) return 2;
        return 1;
    },

    _axisThresholds(data) {
        var ov = (data.asset_specific && data.asset_specific.axis_thresholds) || {};
        return {
            peg:       ov.peg       || RISK_AXIS_THRESHOLDS.peg,
            liquidity: ov.liquidity || RISK_AXIS_THRESHOLDS.liquidity,
            backing:   ov.backing   || RISK_AXIS_THRESHOLDS.backing
        };
    },

    // Rating → display chip. Bands 5/4 healthy, 3 watch, ≤2 stress, null = not rated.
    // Internal domain stays 1-5; only the RENDERING is /10 (§6.5.1).
    // ⚠️ Why an axis is UNRATED, when the null is deliberate.
    //
    // "Not rated" looks worse on a live page than "Healthy 5/5", and the first
    // person to meet a blank axis will reasonably read it as a pipeline fault.
    // The thing it prevents — a rating that is affirmatively wrong — is
    // invisible. So a guard that does not say what it protects gets relaxed by
    // whoever meets it next, and "restore the fallback" is the reasonable-looking
    // relaxation available here. Name the 5/5 explicitly or the null looks like
    // the defect.
    backingUnratedReason(data) {
        var sum = data.summary || {};
        var aspThr = data.asset_specific && data.asset_specific.axis_thresholds;
        var bOv = aspThr && aspThr.backing;
        var fromBacking = data.backing && data.backing.collateral_ratio != null;
        var cr = fromBacking ? data.backing.collateral_ratio : sum.collateral_ratio;

        // What the generic band WOULD say, so the reason can name it.
        var generic = (cr == null) ? null
            : this._rate(CommonRenderer.normalizeCollateralRatio(cr, data.asset_slug, sum),
                         this._axisThresholds({}).backing.cr_pct, 'high');
        var wouldSay = (generic == null) ? '' :
            ' Falling back to the generic cutoffs would rate this ' +
            this._ratingChip(generic).text + ' — the outcome this band exists to prevent.';

        if (!aspThr && data.axis_thresholds) {
            return 'The producer published axis_thresholds at the top level, where this ' +
                'renderer cannot read it, so the asset-specific band is unreachable.' + wouldSay;
        }
        if (bOv && Array.isArray(bOv.cr_pct)) {
            if (bOv.stale_by_floor_drift === true) {
                return 'The band\u2019s measured floor has drifted beyond tolerance' +
                    (bOv.live_floor_pct != null && bOv.anchored_floor_pct != null
                        ? ' (' + bOv.anchored_floor_pct + '% \u2192 ' + bOv.live_floor_pct + '%)' : '') +
                    ', so the cutoffs no longer describe this book. Re-derive them.' + wouldSay;
            }
            if (bOv.expires === true && bOv.review_by &&
                Date.now() > Date.parse(bOv.review_by + 'T00:00:00Z')) {
                return 'The band expired on ' + CommonRenderer._escapeAttr(bOv.review_by) +
                    ' and is a property of the book as measured then, not of the protocol. ' +
                    'Re-derive it rather than extending the date.' + wouldSay;
            }
        }
        if (!fromBacking && sum.collateral_ratio_synthetic === true) {
            return 'The only collateral ratio available is a placeholder synthesised by the ' +
                'renderer, not a producer value. Rating it would invent a number.';
        }
        return null;
    },

    // ⚠️ Bands are 1-5 internally; the PAGE renders /10 (spec §6.5.1, user
    // decision 2026-09-07). Every other surface in the estate — riskAnalyst
    // assets, the risk feed, tidresearch reports — is /10, and a /5 chip beside
    // a /10 report gives a reader no way to tell whether the two AGREE.
    // The x2 mapping emits only EVEN numbers, and that spacing is the honest
    // tell that the scale is coarse. Do NOT cap the top at 9 to soften
    // "10/10": it breaks the spacing and makes 9 read as a FINER measurement
    // than 8, inventing the granularity the cap was meant to prevent. The
    // misreading is fixed by the LABEL — the band word plus the tooltip below.
    _ratingChip(rating) {
        if (rating == null) return { cls: 'r-na', text: 'Not rated' };
        var cls = rating >= 4 ? 'r-ok' : (rating === 3 ? 'r-warn' : 'r-crit');
        var word = rating >= 4 ? 'Healthy' : (rating === 3 ? 'Watch' : 'Stress');
        return { cls: cls, text: word + ' · ' + (rating * 2) + '/10', band: rating };
    },

    // The band word carries provenance (computed) against "Authored" (§6.3);
    // the tooltip STATES the granularity rather than encoding it in the digits.
    _ratingChipBasis(rating) {
        return 'Band ' + rating + ' of 5, mapped to /10. A five-level band, not ' +
            'a 10-point score — the top band means "inside the healthy threshold", not "perfect".';
    },

    _ratingChipHtml(rating, reason, extraNote) {
        var c = this._ratingChip(rating);
        if (rating == null && reason) {
            return '<span class="axis-rating ' + c.cls + '" title="' +
                this._escapeAttr(reason) + '">' + c.text + ' \u24d8</span>';
        }
        if (rating == null) {
            return '<span class="axis-rating ' + c.cls + '">' + c.text + '</span>';
        }
        // `extraNote` appends what the band was computed FROM (e.g. 7-day average
        // vs a single reading). A band and its basis are one fact, not two.
        var title = this._ratingChipBasis(rating) + (extraNote ? ' — ' + extraNote : '');
        var warn = (extraNote && extraNote.indexOf('⚠') >= 0) ? ' ⚠️' : '';
        return '<span class="axis-rating ' + c.cls + '" title="' +
            this._escapeAttr(title) + '">' + c.text + warn + '</span>';
    },

    // --- per-axis ratings ---
    pegRating(data, history) {
        var th = this._axisThresholds(data).peg.abs_dev_pct;
        // Prefer 7-day average absolute deviation when peg-history is available;
        // else the latest premium/discount magnitude (As-built: history lives in
        // *_backing_history.json under peg.history_field).
        // Basis is tracked so the chip can SAY whether it is a 7-day average or a
        // single reading — see _pegDevBasis. Same value as before; the difference
        // is that the fallback is no longer invisible.
        var basis = this._pegDevBasis(data, history, 7);
        return this._rate(basis.value, th, 'low');
    },

    // Tooltip text for the peg chip: what the band was computed FROM.
    pegRatingBasisNote(data, history) {
        var b = this._pegDevBasis(data, history, 7);
        if (b.value == null) return null;
        var head = (b.basis === '7d')
            ? 'Basis: 7-day average absolute deviation (' + b.value.toFixed(4) + '%).'
            : '⚠️ Basis: ONE instantaneous reading (' + b.value.toFixed(4) + '%), not a 7-day average.';
        return head + ' ' + (b.note || '');
    },

    // ⚠️ WHY THE BAND USES A 7-DAY AVERAGE AND WHY THE FALLBACK MUST BE VISIBLE.
    // The peg axis is a DYNAMIC measured score by design (user decision
    // 2026-09-07) — it reports how the peg is actually performing, not an
    // editorial judgement of the mechanism. That is only honest if the window is
    // real: a single instantaneous reading near par rates 10/10 on one tick.
    //
    // The averaging was already the design and SILENTLY WASN'T REACHING a third
    // of the fleet — 7 of 21 assets fell through to one instantaneous reading and
    // the chip looked identical either way. Three declared a `history_field`
    // ('peg_market_price') that does not exist in their own history entries; four
    // have no history file. A fallback nobody can see is a different metric
    // wearing the same label.
    //
    // So the basis is now computed alongside the value and rendered. This does
    // NOT guess a replacement field — deriving what a producer should declare is
    // the mis-scaling trap this codebase keeps hitting. It reports the gap.
    _pegDevBasis(data, history, days) {
        var peg = data.peg || {};
        var declared = peg.history_field || 'peg_premium_discount_pct';
        var cur = peg.premium_discount_pct != null ? Math.abs(peg.premium_discount_pct) : null;
        var out = { value: null, basis: 'instant', n: 0, note: null, degenerate: false };

        if (!history || !Array.isArray(history.entries) || !history.entries.length) {
            out.value = cur;
            out.note = 'No peg history is published for this asset, so the band is a SINGLE ' +
                'instantaneous reading rather than a 7-day average. One tick near par rates ' +
                'the same as a week of stability.';
            return out;
        }
        // Is the declared field actually in the entries?
        var tail = history.entries.slice(-5), present = false;
        for (var i = 0; i < tail.length; i++) {
            if (tail[i] && tail[i][declared] != null) { present = true; break; }
        }
        if (!present) {
            out.value = cur;
            out.note = 'The feed declares history_field "' + declared + '", which is ABSENT from ' +
                'its own history entries — so the 7-day average could not be computed and the band ' +
                'is a single instantaneous reading. This is a producer-side field-name mismatch, ' +
                'not a missing history.';
            return out;
        }
        // ⚠️ Degenerate: averaging the NAV reference against itself measures NAV
        // ACCRUAL over the window, not deviation from it. Reported, not silently
        // repaired — picking a substitute field is the producer's call.
        if (declared === 'nav' || declared === peg.nav_field) {
            out.degenerate = true;
        }
        var avg = this._pegAvgAbsDev(data, history, days);
        if (avg == null) {
            out.value = cur;
            out.note = 'Peg history is present but yielded no usable readings in the window; ' +
                'the band is a single instantaneous reading.';
            return out;
        }
        out.value = avg; out.basis = '7d';
        out.n = history.entries.length;
        if (out.degenerate) {
            out.note = '⚠️ The 7-day average is computed from "' + declared + '" against the ' +
                'current NAV, so for a NAV-tracking asset it measures NAV ACCRUAL over the week ' +
                'rather than deviation from NAV. Treat this band as indicative until the feed ' +
                'declares a market-price field.';
        } else {
            out.note = '7-day average absolute deviation, the basis for this band — not a single ' +
                'reading. A momentary print near par cannot lift it on its own.';
        }
        return out;
    },

    _pegAvgAbsDev(data, history, days) {
        if (!history || !Array.isArray(history.entries) || !history.entries.length) return null;
        var field = data.peg.history_field || 'peg_premium_discount_pct';
        var nav = data.peg.nav != null ? data.peg.nav : 1.0;
        var entries = history.entries;
        // Window the last `days` worth of points by timestamp; fall back to the
        // tail count if timestamps are missing.
        var last = entries[entries.length - 1];
        var cutoff = null;
        if (last && last.timestamp) {
            var t = new Date(last.timestamp.endsWith('Z') ? last.timestamp : last.timestamp + 'Z').getTime();
            cutoff = t - days * 86400000;
        }
        var devs = [];
        for (var i = 0; i < entries.length; i++) {
            var e = entries[i];
            if (cutoff != null && e.timestamp) {
                var et = new Date(e.timestamp.endsWith('Z') ? e.timestamp : e.timestamp + 'Z').getTime();
                if (et < cutoff) continue;
            }
            var v = e[field];
            if (v == null) continue;
            // Field may be a price (→ convert to % deviation vs nav) or already a %.
            var devPct = (field.indexOf('pct') >= 0) ? Math.abs(v)
                : (nav ? Math.abs((v - nav) / nav * 100) : null);
            if (devPct != null) devs.push(devPct);
        }
        if (!devs.length) return null;
        var mean = devs.reduce(function(a, b) { return a + b; }, 0) / devs.length;
        // ⚠️ UNIT SANITY GUARD. The price-vs-percent test above is a SUBSTRING
        // MATCH on 'pct' in the field name, which is fragile by construction: a
        // field named `peg_deviation` already holds a percent (0.1239) and gets
        // treated as a PRICE, yielding |0.1239 - 1.1086| / 1.1086 * 100 = 85.8%
        // — and 85.8% average deviation rates 2/10, a catastrophic misread
        // rendered as a confident score.
        //
        // No stablecoin or NAV-share on this dashboard averages tens of percent
        // off its reference for a week without being a headline failure, so a
        // mean this large is far better explained by a unit mismatch than by the
        // asset. Refuse rather than rate: pegRating then falls back and the chip
        // says which basis it used. An unrated axis is honest; a 2/10 computed
        // from a misread unit is not.
        if (mean > 50) return null;
        return mean;
    },

    liquidityRating(data) {
        // Credit vaults emit an explicit 1-5 band_score (from free-liquidity %); prefer it.
        if (data.liquidity && data.liquidity.band_score != null) return data.liquidity.band_score;
        // ⚠️ Refuse to rate a depth the feed's OWN LADDER contradicts.
        //
        // usde publishes total_2pct_depth = $5,000,000 and quotes that same rung
        // at −1588 bps. 200bps is the threshold, so the 2% crossing is bracketed
        // INSIDE its own ladder between $2M (−1.4bps) and $5M — and the published
        // figure is the rung BEYOND it. That rated Healthy 5/5.
        //
        // This does not derive a depth; deriving one is the producer's job and
        // guessing would be the mis-scaling this codebase keeps being bitten by.
        // It withholds a rating the payload does not support, which is the same
        // rule backingRating already applies to synthesised ratios: an unrated
        // axis is honest, a rating computed from a contradicted number is not.
        //
        // Fires only when a quoted rung at or below the published depth costs
        // worse than 2%. Verified against all 12 assets carrying both a depth and
        // a ladder — usde is the only one, and the others stay rated.
        if (this._depthContradictedByLadder(data)) return null;
        // ⚠️ And refuse to rate a figure the producer says bounds nothing. USDS
        // publishes $50,000,000 with status not_size_responsive because every
        // rung from $1M to $50M returned identical 0.00bps. Rating that Healthy
        // 5/5 would make the one asset whose depth was NOT measured the deepest
        // on the dashboard. Same rule as the ladder contradiction and as
        // backingRating's refusal to rate a synthesised ratio.
        var lq = data.liquidity || {};
        if (lq.two_pct_depth_status === 'not_size_responsive' ||
            lq.two_pct_depth_size_responsive === false) return null;
        var th = this._axisThresholds(data).liquidity.depth_usd;
        return this._rate(data.liquidity ? data.liquidity.total_2pct_depth : null, th, 'high');
    },

    // The liquidity twin of backing's authored path (§6.3, §6.5.1). susds is the
    // case: its ladder returns an IDENTICAL 0.00bps from $1k to $1M and then a
    // constant 1078.15bps across $5M-$100M, so liquidityRating correctly refuses
    // a band — a fixed-rate redemption quote bounds nothing. Meanwhile a measured
    // Liquidity & Exit judgement existed upstream with nowhere to render.
    //
    // ⚠️ PRECEDENCE: THE COMPUTED BAND ALWAYS WINS. An authored number silently
    // overriding a measured one is the category error §1.1 names, and it is what
    // put syrup's retired structural_score into a field named issuer_score on two
    // live pages. Authored fills ONLY where the band is genuinely absent.
    //
    // ⚠️ And it requires a DECLARATION, not just a number: the producer must say
    // the measurement is not derivable. Without that gate an authored score would
    // paper over a feed that is merely broken, which is the opposite of the job.
    // Returns {score, basis} when accepted, {rejected: why} when a score was
    // SUPPLIED and refused, or null when the producer offered nothing.
    //
    // ⚠️ The rejected case must not be indistinguishable from a genuine refusal.
    // Both render "Not rated" on the face, but "we correctly declined to compute
    // a band" and "an authored score arrived malformed and was dropped" are
    // opposite facts, and this is the same rule §6.3 applies to authored scores —
    // turned on this gate. The reason rides in the tooltip.
    // ⚠️ `requireDeclaration` FALSE for the DIVERGENCE case, TRUE for FILL, and
    // the asymmetry is the point rather than an oversight (riskAnalyst, 2026-09-08).
    //
    //   FILL     authored REPLACES an absent band  -> declaration REQUIRED. Without
    //            it an authored number papers over a feed that is merely broken,
    //            and broken and unmeasurable are opposite facts.
    //   DIVERGE  authored shown BESIDE a band      -> no declaration needed. Nothing
    //            is being papered over: the measurement is rendered right next to
    //            it and the reader can see both numbers.
    //
    // The declaration's whole justification is "this could hide a broken feed",
    // and that justification does not survive when the feed's own number is on
    // screen beside it. Applying one condition to both cases silences a real
    // conflict on any asset whose depth IS derivable — which is exactly the
    // situation the divergence chip exists for.
    //
    // ⚠️ The BASIS requirement stays in both paths. A judgement with no stated
    // reasoning cannot be assessed by a reader whether or not a band sits beside it.
    _authoredLiquidity(data, requireDeclaration) {
        if (requireDeclaration === undefined) requireDeclaration = true;
        var lq = data.liquidity || {};
        if (typeof lq.liquidity_score !== 'number') return null;
        var declared = lq.derived_score_status === 'not_computed' ||
            lq.two_pct_depth_status === 'not_size_responsive' ||
            lq.two_pct_depth_size_responsive === false;
        if (!declared && !requireDeclaration) {
            var b0 = lq.liquidity_score_basis || lq.liquidity_score_source;
            if (!b0) return { rejected: 'An authored liquidity score of ' + lq.liquidity_score +
                '/10 was supplied with no basis or source string, so it was not rendered.' };
            // ⚠️ `field` is REQUIRED by _divergenceChipHtml, which prints it as
            // "(field: X)". Omitting it rendered "field: undefined" on the ONLY
            // working divergence flag on the page — the one place a reader can see
            // that a judgement and a measurement disagree looked like a bug.
            // The peg/backing path gets this free from _authoredAxisScore, which
            // sets it; this one builds its object by hand and did not.
            return { score: lq.liquidity_score, basis: String(b0), field: 'liquidity_score' };
        }
        if (!declared) {
            return { rejected: 'An authored liquidity score of ' + lq.liquidity_score +
                '/10 was supplied WITHOUT a non-derivability declaration ' +
                '(derived_score_status / two_pct_depth_size_responsive), so it was not ' +
                'rendered. An authored score may only fill a gap the producer has ' +
                'declared unmeasurable — otherwise it would paper over a broken feed. ' +
                'Showing neither.' };
        }
        var basis = lq.liquidity_score_basis || lq.liquidity_score_source;
        if (!basis) {
            return { rejected: 'An authored liquidity score of ' + lq.liquidity_score +
                '/10 was supplied with no basis or source string, so it was not ' +
                'rendered. A judgement with no stated reasoning cannot be assessed ' +
                'by a reader. Showing neither.' };
        }
        return { score: lq.liquidity_score, basis: String(basis), field: 'liquidity_score' };
    },

    _liquidityChipHtml(data) {
        var band = this.liquidityRating(data);
        // ⚠️ Declaration required ONLY when the authored score would FILL an
        // absent band. Beside a rendered measurement it is a divergence, and the
        // gate's justification does not apply — see _authoredLiquidity.
        var authored = this._authoredLiquidity(data, band == null);
        // ⚠️ `authored` has THREE shapes: accepted {score,basis}, {rejected},
        // and null. Every branch below must test `.score`, not truthiness — a
        // rejected object is truthy and would render "Authored undefined/10".
        var accepted = (authored && typeof authored.score === 'number') ? authored : null;

        if (band != null) {
            // ⚠️ Both present is a DIVERGENCE, not something to reconcile
            // silently. Render the measurement and SAY the judgement disagrees;
            // a reader who cannot see the conflict cannot report it.
            // Threshold and tooltip come from the SAME helpers the peg and
            // backing axes use — the gap rule is defined once
            // (AUTHORED_DIVERGENCE_MIN_GAP), not typed into three axes.
            return this._ratingChipHtml(band, null, this._authoredTooltipNote(band, accepted)) +
                this._divergenceChipHtml(band, accepted);
        }
        if (accepted) {
            // Say it is authored — the word carries provenance, not the scale (§6.5.1).
            return '<span class="axis-rating r-warn" title="' +
                this._escapeAttr(accepted.basis) + '">Authored ' + accepted.score + '/10</span>';
        }
        // Same face as a genuine refusal, distinguishable on hover.
        return this._ratingChipHtml(null, authored ? authored.rejected : null);
    },

    // ⚠️ A LAYER SUMMARY CAN HIDE A PATH OF DIFFERENT CHARACTER, and until now
    // this table rendered `layers` and NEVER read `.paths`. 13 layers across 7
    // assets carry paths whose (reach, timelock) differ from the row shown.
    //
    // This is not cosmetic. I read crvUSD's layer-level `reach: full` and
    // attributed it to BOTH paths, then told my user "five keys can mint on a
    // $244M stablecoin immediately" — the walk said `reach: bounded` and
    // "not represented as a full arbitrary-mint or upgrade path". riskAnalyst
    // caught it. The per-path data was right; the page could not show it, so
    // they carried the branch in their overlay prose with the note "CARRIED HERE
    // BECAUSE IT RENDERS NOWHERE ELSE". A producer working around a consumer bug
    // in published copy is the signal to fix the consumer.
    //
    // ⚠️ Only DIVERGENT paths render. Where every path matches the summary the
    // row is complete already and sub-rows would be noise — most layers have one
    // path, and a table that repeats itself teaches readers to skip it.
    _divergentPathRows(l, esc) {
        var paths = Array.isArray(l.paths) ? l.paths : [];
        if (paths.length < 2) return '';
        var shapes = {};
        paths.forEach(function(p) { shapes[(p.reach || '?') + '|' + String(p.timelock)] = 1; });
        if (Object.keys(shapes).length < 2) return '';
        return paths.map(function(p) {
            var tl = String(p.timelock == null ? '' : p.timelock);
            var undelayed = !tl || tl === 'none';
            var unknown = tl === 'unresolved';
            // ⚠️ `terminal` distinguishes a PARTY from a CONTRACT, and conflating
            // them is how an architectural ward reads as a discretionary actor.
            // usds's undelayed full-reach path terminates in UsdsJoin — the join
            // adapter must hold wards to mint. Naming the terminal kind lets a
            // reader tell that from a key-holder without the renderer judging it.
            var who = p.name || p.holder_kind || p.terminal || '—';
            return '<tr class="tw-path">' +
                '<td style="padding-left:1.5em;opacity:.75;">↳ ' + esc(who) +
                    (p.terminal ? '<span class="tw-sub"> (' + esc(p.terminal) + ')</span>' : '') + '</td>' +
                '<td>' + (p.threshold != null ? esc(String(p.threshold)) +
                    (p.owners != null ? ' of ' + esc(String(p.owners)) : '') : '—') + '</td>' +
                '<td class="' + (unknown ? 'tw-unknown' : (undelayed ? 'tw-bad' : 'tw-ok')) + '">' +
                    (unknown ? '\u26a0\ufe0f not measured' : (undelayed ? '\u26a0\ufe0f none' : esc(tl))) + '</td>' +
                '<td>' + esc(p.via || '—') + '</td>' +
                // ⚠️ "bounded" is useless without the bound. security_analyst
                // corrected apyUSD's ADMIN path from full to bounded and named
                // what it reaches: "the UnlockReceipt contract only; the apyUSD
                // vault and apxUSD are not reachable by this path". Rendering
                // "bounded" alone loses the half that tells a reader whether the
                // bound matters — a bounded path over in-flight unlock claims is
                // not the same as a bounded path over a fee parameter.
                '<td>' + esc(p.reach || '—') +
                    (p.reach_bound
                        ? '<span class="tw-sub"> \u2014 ' + esc(p.reach_bound) + '</span>'
                        : '') + '</td>' +
            '</tr>';
        }).join('');
    },

    // ⚠️ META-AUTHORITY: who administers the ROLES rather than who holds them.
    // Recorded as `role_admin` on the layer it bounds (their schema.md 1.9) rather
    // than as a fourth path, because a path entry would double-count the same Safe
    // in the holder list.
    //
    // ⚠️ IT MUST RENDER OR THE PAGE LOSES THE BINDING NUMBER. apyUSD's ADMIN Safe
    // reaches only the receipt contract directly — but it administers roles 21-25,
    // so it CAN reach the vault by re-pointing the gate. That route is 72h, not
    // instant. Without this row the layer reads "ADMIN · none · bounded" with no
    // indication the vault is reachable at all, which understates in one direction
    // while the old "bypassable 72h" reading overstated in the other.
    _roleAdminRowHtml(l, esc) {
        var ra = l && l.role_admin;
        if (!ra || typeof ra !== 'object') return '';
        var route = ra.shortest_route_to_vault;
        return '<tr class="tw-path tw-roleadmin">' +
            '<td style="padding-left:1.5em;opacity:.75;">\u21b3 role admin' +
                (ra.kind ? '<span class="tw-sub"> (' + esc(ra.kind) + ')</span>' : '') + '</td>' +
            '<td>' + (ra.holder ? esc(String(ra.holder).slice(0, 10) + '\u2026') : '\u2014') + '</td>' +
            '<td class="' + (route ? 'tw-ok' : 'tw-unknown') + '"' +
                (ra.note ? ' title="' + esc(ra.note) + '"' : '') + '>' +
                (route ? esc(route) + '<span class="tw-sub"> to vault</span>'
                       : '\u26a0\ufe0f route not measured') + '</td>' +
            '<td>' + esc(ra.via || '\u2014') + '</td>' +
            '<td>meta</td>' +
        '</tr>';
    },

    _exitScopeHtml(liq) {
        liq = liq || {};
        var pe = liq.primary_exit;
        if (!pe) {
            // Not "unmeasured" — UNREPRESENTED. Nothing in the payload says a
            // redemption leg exists, so the scope of the score is unknown rather
            // than known-narrow. That is worse and must read worse.
            return ' · <span class="text-amber-700" title="The score is venue depth only. The payload represents no redemption leg at all, so the scope of this rating is unknown rather than known-narrow.">exit leg undeclared</span>';
        }
        var basis = pe.gated_basis;
        if (typeof basis === 'string' && basis.indexOf('measured') === 0) return '';
        // ⚠️ A boolean gated with no basis is an ASSERTION, not an unprobed leg.
        // susds publishes gated: false and no basis at all — calling that
        // "unprobed" states the opposite of what the producer said. And an
        // asserted-open exit with undeclared provenance is the flattering
        // direction, which is why usdm's gated: false is still withheld pending
        // the dispute with riskAnalyst over whether that path is allowlisted.
        if (typeof pe.gated === 'boolean' && !basis) {
            return ' · <span class="text-amber-700" title="The producer states a gate value but declares no basis for it, so how it was established is unknown. The score is venue depth only.">exit asserted, basis undeclared</span>';
        }
        return ' · <span class="text-slate-500" title="' +
            this._escapeAttr(pe.gated_note || 'The producer declares the redemption leg unmeasured. The score is venue depth only.') +
            '">exit unprobed (declared)</span>';
    },

    // ⚠️ THE BAND IS SIZE-BLIND AND THIS IS THE FIX THAT DOES NOT RE-GRADE 25 ASSETS.
    //
    // liquidity thresholds are ABSOLUTE — [2M, 1M, 500K, 100K] for every asset —
    // so $5M of depth rates Healthy 10/10 whether the book is $5M or $600M.
    // hastra-prime renders 10/10 on depth worth ~0.85% of its supply, against a
    // measured wall where output stops increasing entirely. USDe rated 3/5 on
    // 0.011% of supply while yzUSD rated 2/5 on seventy times that share.
    //
    // Owner decision: keep the absolute band — it stays comparable across assets,
    // answers "can MY position exit", and does not inherit the supply-definition
    // disputes several assets carry — and render the SHARE beside it so a reader
    // sees both readings at once.
    //
    // ⚠️ THE DENOMINATOR IS NAMED, NEVER ASSUMED. total_supply and total_backing
    // differ materially — apyUSD publishes 129M against 184M, 42% apart — so the
    // label says which one was divided by. Falls back to backing only where supply
    // is absent, and renders nothing when neither is.
    _depthShareHtml(data) {
        var liq = (data && data.liquidity) || {};
        var depth = liq.total_2pct_depth;
        if (typeof depth !== 'number' || !(depth > 0)) return '';
        // ⚠️ IF THE BAND IS WITHHELD, THE SHARE IS WITHHELD. liquidityRating returns
        // null exactly where the producer says the figure does not bound anything —
        // not_size_responsive, or a ladder that contradicts its own published depth.
        // Dividing such a number by supply produces a percentage that looks precise
        // and means nothing, printed directly beside a qualifier saying so. If we
        // will not rate it, we will not divide it.
        if (this.liquidityRating(data) == null) return '';
        var sum = (data && data.summary) || {};
        var bk = (data && data.backing) || {};
        var denom = null, label = null;
        if (typeof sum.total_supply === 'number' && sum.total_supply > 0) {
            denom = sum.total_supply; label = 'supply';
        } else if (typeof sum.circulating_supply === 'number' && sum.circulating_supply > 0) {
            denom = sum.circulating_supply; label = 'circulating supply';
        } else if (typeof sum.real_supply === 'number' && sum.real_supply > 0) {
            denom = sum.real_supply; label = 'supply';
        } else if (typeof bk.total_backing === 'number' && bk.total_backing > 0) {
            denom = bk.total_backing; label = 'backing';
        }
        if (denom == null) return '';
        var pct = (depth / denom) * 100;
        // ⚠️ Below 0.01% prints "0.0%", which reads as zero rather than as small.
        var txt = pct >= 0.1 ? pct.toFixed(1) + '%'
                : pct >= 0.01 ? pct.toFixed(2) + '%'
                : '<0.01%';
        return '<div class="text-[11px] text-slate-500" title="' + this._escapeAttr(
            'The band above grades depth against FIXED dollar thresholds, identical for every ' +
            'asset, so it answers "can a position of this size exit". This figure answers the ' +
            'other question — what share of the asset could exit at 2% — and the two can point ' +
            'in opposite directions on a large book. Denominator: ' + label + ' ' +
            this.formatCurrency(denom) + '.') +
            '">\u2248 ' + txt + ' of ' + label + ' exits at 2%</div>';
    },

    // ⚠️ A DEPTH MEASURED AGAINST ITS OWN VENUE'S QUOTE, WITH NOTHING SAYING SO.
    // Both producers declare this and the page read neither. usg's overlay
    // carries `anchor.self_referential: true`; PegTracker declares
    // `peg.market_price_self_referential: true` for usg AND usdm. usdm renders
    // "≥$500.4K" as the SOLE source on its page — a floor derived from the same
    // Mento getAmountOut quote that anchors it — and said nothing at all.
    //
    // ⚠️ Why it matters even for a floor: a uniformly mispriced venue quotes
    // ~0bps against its own mid, so the number cannot detect the failure it
    // exists to detect. A bound is weaker than a crossing, but it is still a
    // figure derived from its own mark.
    //
    // ⚠️ ATTRIBUTED, NEVER INFERRED. This renders only where a producer has
    // DECLARED the flag, and the tooltip names which one and about what. The
    // two declarations are about the same mark but they are not the same claim,
    // and joining them silently would be the renderer deciding a question that
    // belongs to the producers. Where neither declares, nothing renders —
    // absence of a flag is not evidence of independence, and this must not be
    // read as certifying the assets it stays quiet on.
    _selfReferentialHtml(data) {
        var liq = (data && data.liquidity) || {};
        if (liq.total_2pct_depth == null) return '';
        var claims = [];
        var a = (liq.exit_mark || {}).anchor || (liq.depth || {}).anchor || {};
        if (a.self_referential === true) {
            claims.push('The depth feed declares its anchor self-referential' +
                (a.self_referential_note ? ': ' + a.self_referential_note : '.'));
        }
        var peg = (data && data.peg) || {};
        if (peg.market_price_self_referential === true) {
            claims.push('The price feed declares this market mark self-referential' +
                (peg.market_price_self_referential_basis
                    ? ': ' + peg.market_price_self_referential_basis : '.'));
        }
        if (!claims.length) return '';
        return '<div class="text-[11px] text-amber-700 dark:text-amber-300" title="' +
            this._escapeAttr(claims.join('\n\n') +
                '\n\nA venue quoted against its own mid returns ~0bps however mispriced it is, ' +
                'so a depth anchored this way cannot detect the failure it exists to detect.') +
            '">\u26a0\ufe0f anchored to the venue being measured \u24d8</div>';
    },

    _depthQualifierHtml(liq) {
        var st = liq.two_pct_depth_status;
        var br = liq.two_pct_depth_bracket;
        if (liq.total_2pct_depth == null) return '';
        var tip = liq.two_pct_depth_basis || '';
        function wrap(txt, cls) {
            return '<div class="text-[11px] ' + (cls || 'text-slate-400') + '"' +
                (tip ? ' title="' + CommonRenderer._escapeAttr(tip) + '"' : '') + '>' +
                txt + (tip ? ' \u24d8' : '') + '</div>';
        }
        // ⚠️ TWO BRACKET SHAPES, AND THE RICHER ONE IS THE NEW DEFAULT.
        //
        // The array form [lower, upper] is what crvUSD and syzUSD still publish.
        // PegTracker's ca4943e emits an OBJECT carrying the slippage at each end —
        // {lower_size_usd, lower_slippage_bps, upper_size_usd, upper_slippage_bps} —
        // and USG already ships it. Accepting only the array meant USG rendered a
        // bare "bracketed" with no range at all, on the one asset where the ladder
        // had just been built from nothing.
        //
        // ⚠️ Every asset migrates to the object form as its ladder is rebuilt, so
        // this is not a special case for one feed — the array branch is the legacy
        // one and must keep working until the last of them turns over.
        if (st === 'bracketed' && br && typeof br === 'object') {
            var lo = Array.isArray(br) ? br[0] : br.lower_size_usd;
            var hi = Array.isArray(br) ? br[1] : br.upper_size_usd;
            if (typeof lo === 'number' && typeof hi === 'number') {
                // ⚠️ A BISECTED BRACKET IS NOT A RANGE, AND PRINTING IT AS ONE
                // INVENTS AN UNCERTAINTY THAT WAS MEASURED AWAY. DexTracker
                // bisects to convergence: USG's bracket is $677,124 → $677,139,
                // fifteen dollars wide, and reusde-re's is under a dollar.
                // "crossing between $677.1K and $677.1K" reads as a rounding
                // artefact or a bug; the honest reading is that the headline
                // figure IS the crossing rather than the last rung below it,
                // which is the opposite of what a wide bracket says.
                //
                // The gap is stated instead of the range, so the precision is
                // the reader's to judge. 1% is comfortably below any real
                // bracket — PegTracker's USG ladder is 33% wide and crvUSD's
                // is 10× — so this cannot swallow one.
                var gap = hi - lo;
                if (gap >= 0 && gap <= Math.max(1, lo * 0.01)) {
                    return wrap('crossing solved \u2014 bracket ' +
                        (gap < 1 ? '<$1' : this.formatCurrencyExact(gap)) + ' wide',
                        'text-slate-500');
                }
                var loBps = Array.isArray(br) ? null : br.lower_slippage_bps;
                var hiBps = Array.isArray(br) ? null : br.upper_slippage_bps;
                // The slippage at each end is what makes the bracket readable: a
                // reader can see how close the lower rung came to crossing.
                var detail = (typeof loBps === 'number' && typeof hiBps === 'number')
                    ? ' (' + loBps.toFixed(0) + 'bps \u2192 ' + hiBps.toFixed(0) + 'bps)'
                    : '';
                return wrap('crossing between ' + this.formatCurrency(lo) +
                            ' and ' + this.formatCurrency(hi) + detail, 'text-slate-500');
            }
        }
        if (st === 'not_size_responsive' || liq.two_pct_depth_size_responsive === false) {
            return wrap('no depth curve \u2014 this figure bounds nothing', 'text-amber-700');
        }
        if (st === 'quote_failed') {
            return wrap('floor \u2014 the deeper rung returned a broken route', 'text-amber-700');
        }
        if (st === 'ladder_exhausted' || liq.total_2pct_depth_is_floor === true) {
            return wrap('ladder exhausted \u2014 floor, not a measurement');
        }
        if (st) return wrap(String(st).replace(/_/g, ' '), 'text-slate-500');
        return '';
    },

    _depthContradictedByLadder(data) {
        var liq = data.liquidity || {};
        var dp = liq.total_2pct_depth;
        var quotes = (liq.exit_mark || {}).quotes || {};
        if (dp == null) return false;
        return Object.keys(quotes).some(function(k) {
            var size = Number(k);
            var bps = quotes[k] && quotes[k].slippage_bps;
            return !isNaN(size) && size <= dp && typeof bps === 'number' && bps < -200;
        });
    },

    // Backing rating honours an asset's chart_bands override (e.g. USG PCR) when
    // present, otherwise the generic CR cutoffs.
    // ⚠️ AN AUTHORED FALLBACK THAT FIRES ONLY ON A DECLARED IMPOSSIBILITY.
    //
    // riskAnalyst withheld their backing_score on the correct general rule that a
    // judgement must not displace a measurement. On reUSD there is no measurement
    // and cannot be one — Re publishes combined reUSD + reUSDe reserves with no
    // asset-attributed denominator — so the rule was leaving the axis blank while
    // the judgement sat in the report unread.
    //
    // ⚠️ THE GATE IS THE PRODUCER'S DECLARATION, NOT THE FIELD'S ABSENCE, and
    // that distinction is riskAnalyst's, not mine — I proposed the weaker
    // "if no computed ratio". A bare null means at least three different things:
    //
    //   declared underivable  the producer said so, with a basis   -> safe
    //   not yet computed      a new asset, a pending pass          -> unsafe
    //   failed to load        a fetch error, a feed outage         -> DANGEROUS
    //
    // Falling back on the third promotes an authored score over a measurement
    // that EXISTS but did not load, and it would look identical on the page to
    // the legitimate case. So this requires collateral_ratio_basis — a sentence
    // the producer wrote saying no ratio is establishable. A null cannot carry
    // that; only a declaration can.
    // ⚠️ A DISAGREEMENT A READER CANNOT SEE IS A DISAGREEMENT NOBODY CAN REPORT.
    // Same treatment the Liquidity axis already gets: where a computed band AND
    // an authored score both exist and differ, render the MEASUREMENT and say
    // the judgement disagrees. Precedence is unchanged — the band stays the
    // score, nothing is overridden, and this adds no new authority.
    //
    // ⚠️ Axis 1 has NO single field name: a stablecoin carries
    // `peg_mechanism_score`, a vault-share carries `volatility_score`, and both
    // are the same axis. Reading only one silently shows nothing on half the
    // fleet — so the candidates are enumerated, not assumed.
    // ⚠️ SHARED SO A BESPOKE PAGE CANNOT HIDE AN AUTHORED SCORE AND SAY NOTHING.
    // Four renderers hide `section-dependencies` to avoid duplicating their own
    // panel — usdai (which also serves susdai), thusd and hastra-prime. The axis
    // head still rendered, into a node with `display:none`, so riskAnalyst's
    // dependencies scores were in the DOM and invisible: susdai 4.5, usdai 7.0,
    // thusd 3.0, all with a written basis. Three of those were refreshed the
    // morning this was found and reached no reader at all.
    //
    // ⚠️ Extracted rather than copied into each renderer. A second copy of this
    // markup would drift from the tooltip the shared path uses, and the tooltip
    // is where the basis and the "not computed from live data" caveat live.
    //
    // Returns '' when the block carries no authored score, so a caller can
    // append it unconditionally.
    authoredScoreChipHtml(block, names, label) {
        var auth = this._authoredAxisScore(block || {}, names);
        if (!auth || typeof auth.score !== 'number') return '';
        return '<span class="axis-rating r-na" title="' + this._escapeAttr(
                'Authored score for this axis: ' + auth.score + '/10' +
                (auth.basis ? '. ' + this._mdPlain(auth.basis) : '') +
                '. This axis is not computed from live data \u2014 there is no measured band to ' +
                'compare it against.') +
            '">' + this._escapeAttr(label) + ' ' + auth.score + '/10</span>';
    },

    _authoredAxisScore(block, names) {
        block = block || {};
        for (var i = 0; i < names.length; i++) {
            var n = names[i];
            if (typeof block[n] === 'number') {
                return {
                    score: block[n],
                    field: n,
                    basis: block[n + '_basis'] || block[n + '_source'] || null,
                    status: block[n + '_status'] || null,
                    ageHours: block[n + '_age_hours'] != null ? block[n + '_age_hours'] : null
                };
            }
        }
        // ⚠️ An enumerated list is only as good as its enumeration. If the block
        // carries a numeric *_score this list does NOT name, that is a producer
        // adding a field the consumer silently ignores — the exact failure this
        // helper exists to prevent, one field name later. Report it instead of
        // returning a bare null that looks like "no authored score exists".
        for (var k in block) {
            if (!Object.prototype.hasOwnProperty.call(block, k)) continue;
            if (typeof block[k] !== 'number') continue;
            if (!/_score$/.test(k)) continue;
            if (names.indexOf(k) >= 0) continue;
            return { score: null, unknownField: k, unknownValue: block[k] };
        }
        return null;
    },

    // ⚠️ MINIMUM GAP BEFORE A DIVERGENCE IS A DISAGREEMENT RATHER THAN ARITHMETIC.
    //
    // Bands are 1-5 mapped x2, so they emit ONLY {2,4,6,8,10} — steps of 2.
    // Authored scores use 0.5 steps across 1.0-10.0. Measured on this
    // dashboard's own feeds: ZERO of the 6 authored scores currently published
    // can be expressed by any band. An authored 7.0 sits exactly between bands 6
    // and 8 and CANNOT match either, so its minimum possible gap is 1.0 on an
    // asset where nobody disagrees about anything.
    //
    // On exact inequality the chip therefore fires on the GRID, not on a
    // conflict — 14 of 15 backing axes would flag, which is noise that trains a
    // reader to ignore the marker that matters.
    //
    // ⚠️ >= 2.0, NOT > 2.0. 2.0 is exactly one band step, and 6.0 IS expressible
    // as a band — so an authored 6.0 against a band of 8 is a real one-band
    // disagreement with nothing structural to explain it, and must fire. Only
    // sub-2.0 gaps are the ones resolution accounts for. riskAnalyst's checker
    // uses >= at the same boundary (e6afbdc); two tools sharing a nominal
    // threshold and disagreeing at exactly 2.0 is its own trap.
    AUTHORED_DIVERGENCE_MIN_GAP: 2.0,

    // The authored value belongs in the tooltip EVEN WHEN THE CHIP IS SILENT.
    // Suppressing the warning is a statement about noise, not about the number —
    // a reader who opens the tooltip must still see both.
    _authoredTooltipNote(band, authored) {
        if (band == null || !authored || typeof authored.score !== 'number') return null;
        var gap = Math.abs(authored.score - band * 2);
        var head = 'Authored score for this axis: ' + authored.score + '/10 (' + authored.field + '), ' +
            'against the measured band of ' + (band * 2) + '/10.';
        if (gap >= this.AUTHORED_DIVERGENCE_MIN_GAP) return head;
        return head + ' Gap of ' + gap.toFixed(1) + ' is below the ' +
            this.AUTHORED_DIVERGENCE_MIN_GAP.toFixed(1) + '-point threshold and is NOT flagged: bands ' +
            'can only emit even numbers, so an authored ' + authored.score + ' cannot match one ' +
            'exactly. The difference here is resolution, not disagreement.' +
            (authored.basis ? ' Basis: ' + authored.basis : '');
    },

    // Appended to a band chip when an authored score disagrees with it.
    _divergenceChipHtml(band, authored) {
        // An authored score under a field name this renderer does not know is a
        // gap, not an absence. Say so rather than render nothing.
        if (authored && authored.unknownField) {
            return '<span class="axis-rating r-na" title="' + this._escapeAttr(
                'The feed publishes "' + authored.unknownField + '" = ' + authored.unknownValue +
                ', which this renderer does not recognise as an axis score, so it is NOT being ' +
                'compared against the band. A published score reaching no reader is a transport ' +
                'gap — the field name needs adding to the consumer, not the value changing.') +
                '"> ⚠️ unread score field</span>';
        }
        if (band == null || !authored || typeof authored.score !== 'number') return '';
        // ⚠️ THE AUTHORED SCORE IS NO LONGER SHOWN BESIDE A LIVE ONE. Owner decision.
        //
        // It rendered "⚠️ authored 6/10 differs" next to a computed band, which read
        // as a contradiction between two numbers when it was never one: the band is
        // a live measurement and the authored score is a persistence-filtered
        // judgement of a DIFFERENT subject. crvUSD's own basis says it outright —
        // "MEASURES THE MECHANISM, NOT THE CURRENT DEVIATION" — and on liquidity the
        // authored score prices a dollar exit while the band measures aggregate
        // depth across pools, not one of which pairs crvUSD with a dollar.
        //
        // ⚠️ Flagging a conflict that does not exist is worse than not flagging one
        // that does: it invites a reader to reconcile two numbers that cannot be
        // reconciled, and it made the report look wrong. The axes where a live
        // number exists now show ONLY the live number; the authored score lives in
        // the report, and the standing note under the score strip says the two can
        // differ and why.
        //
        // ⚠️ This function still returns '' for band == null BY THE LINE ABOVE, so
        // the authored-only fallbacks are untouched — the four tiles that have an
        // authored score and NO measured band (thusd backing/liquidity, usds and
        // susds liquidity) render through separate paths and keep their number. A
        // blank tile would be worse than an authored one, and with no rival number
        // there is no divergence to imply.
        return '';
    },

    _authoredBackingRating(data) {
        var b = data.backing || {};
        if (typeof b.backing_score !== 'number') return null;
        if (b.backing_score_applies_when !== 'collateral_ratio_declared_underivable') return null;
        // The declaration itself. Without it, stay unrated.
        if (!b.collateral_ratio_basis) return null;
        // Scores are /10; the axis bands are 1-5.
        return Math.max(1, Math.min(5, Math.round(b.backing_score / 2)));
    },

    backingRating(data) {
        var sum = data.summary || {};
        var fromBacking = data.backing && data.backing.collateral_ratio != null;
        var cr = fromBacking ? data.backing.collateral_ratio : sum.collateral_ratio;
        if (cr == null) return this._authoredBackingRating(data);

        // ⚠️ Never rate a manufactured value. Renderers synthesise a placeholder
        // collateral_ratio in preRender so the legacy card has something to
        // format, and preRender runs BEFORE this — so without the marker a
        // placeholder is indistinguishable from a producer figure. An unrated
        // axis is honest; a rating derived from a placeholder is not. The
        // fallback itself stays: six assets rely on it legitimately (bold, frax,
        // ousd, usdd, usdm, usg all emit a real summary.collateral_ratio).
        if (!fromBacking && sum.collateral_ratio_synthetic === true) return null;

        // ⚠️ Scale. usdm publishes a RAW ratio (1.2198); every other feed
        // publishes percent. Unnormalised, 1.2198 falls through the default
        // [130,110,100,90] cutoffs to 1/5 instead of 4/5 — a three-band
        // misrating in the alarming direction. The index grid already normalises
        // (app.js); this did not. Resolution is by declared scale or the explicit
        // asset list, never by magnitude — see normalizeCollateralRatio.
        //
        // ⚠️ The scale declaration must come from the block the VALUE came from.
        // summary.collateral_ratio_scale describes summary.collateral_ratio. Once
        // an asset migrates to 5-axis, backing.collateral_ratio becomes the source
        // and a payload can carry both fields under near-identical names. Applying
        // summary's declaration to a backing value is a guess, and with a raw-list
        // asset the normaliser is not idempotent — a percent value multiplied
        // again reads 12198 and rates 5/5, the reassuring direction.
        // A declaration describes ITS OWN block and nothing else. backing and
        // summary routinely hold different quantities under the same field name —
        // usdm's backing.collateral_ratio is stable-only reserve over Mento debt
        // (91.02, percent) while summary.collateral_ratio is gross over the same
        // debt (1.2231, ratio). Both declarations are right; they are 31pp apart
        // because they measure different things.
        //
        // ⚠️ REMOVED: a check that rejected the payload when the two declared
        // scales differed. It compared STRINGS, which cannot tell "two fields,
        // two scales, both correct" from "one quantity, contradictory scales" —
        // and it was strictly harmful. It fired ONLY when both blocks declared,
        // which is exactly when per-block resolution already gets it right, and
        // stayed silent on the hazard it was written for (an undeclared backing
        // value inheriting summary's declaration), which still rated 5/5. It
        // unrated usdm on a live page for being correct, and would have unrated
        // every asset adopting the per-block declarations we asked for.
        //
        // So: never inherit across blocks. A backing value with no declaration of
        // its own falls to the default (percent), not to summary's — guessing
        // from a sibling field's scale is the mis-scaling this is meant to avoid.
        var backingBlock = data.backing || {};
        var scaleSrc = fromBacking ? backingBlock : sum;

        cr = CommonRenderer.normalizeCollateralRatio(cr, data.asset_slug, scaleSrc);
        if (cr == null) return null;
        // Explicit per-asset cr_pct override (finer 5/4/3/2/1) wins over chart_bands' binary
        // 5/3/1 — credit vaults (PCR ~100 by construction) need the finer bands so PCR 100 reads
        // Healthy 4, not a perfect 5 (chart_bands stays for the CR-chart rendering).
        // ⚠️ Misplaced override: refuse rather than rate on the generic band.
        //
        // The schema location is asset_specific.axis_thresholds. A producer that
        // emits axis_thresholds at TOP LEVEL has published a band this reader
        // cannot see, and the failure is silent and flattering — usg's 131.64
        // rates 5/5 HEALTHY on the generic [130,110,100,90] and 3/5 WATCH on its
        // own [158,145,130,120], which is anchored on a measured liquidation
        // floor. Rating on defaults while a real band sits unread would publish
        // the reassuring answer.
        //
        // Deliberately NOT reading the top-level copy. Accepting an undefined
        // location lets the renderer define the contract by what it tolerates,
        // which is how a schema rots quietly; and check_feeds.py already surfaces
        // the misplacement. An unrated axis is honest and visibly wrong-looking,
        // which is what gets it fixed.
        var aspThr = data.asset_specific && data.asset_specific.axis_thresholds;
        if (!aspThr && data.axis_thresholds) return null;

        var bOv = aspThr && aspThr.backing;
        if (bOv && Array.isArray(bOv.cr_pct)) {
            // ⚠️ An override may declare its own expiry. usg's carries
            // expires:true, review_by, and an expiry_reason saying the floor is a
            // property of TODAY'S book — an active market set the issuer opens and
            // pauses — with an explicit "re-derive it, do not extend the date".
            //
            // Rating on it past that date asserts a currency the producer has
            // said it will not have. This repo already has the scar: a hardcoded
            // editorial score sat at 8.0 through a depeg because nothing
            // recomputed it. Falling back to the generic band would be worse than
            // unrated here — that is the 5/5 the override exists to prevent — so
            // an expired band goes UNRATED, which is visible and prompts the
            // re-derivation the producer asked for.
            // stale_by_floor_drift is the REAL trigger; review_by is the
            // backstop. The band is derived from a measured floor that the
            // producer recomputes every run — if an idle market activates with a
            // different liquidation threshold the floor moves and the flag fires
            // in September rather than waiting for November. The tolerance is a
            // detection threshold, not a slack allowance: a drift firing early
            // means re-derive, not widen.
            if (bOv.stale_by_floor_drift === true) return null;
            if (bOv.expires === true && bOv.review_by &&
                Date.now() > Date.parse(bOv.review_by + 'T00:00:00Z')) {
                return null;
            }
            return this._rate(cr, bOv.cr_pct, 'high');
        }
        // ⚠️ A display band is not a rating scale. Five renderers set chart_bands
        // in preRender purely so two series stay legible on one axis — usdm's
        // comment says so outright ("keep both named series continuously
        // visible") — and preRender runs BEFORE this, so those bands were
        // silently scoring the asset. A shading boundary makes a poor rating
        // boundary: critical:[0,98] collapses 97% and 60% into the same 1/5.
        //
        // Measured: apxusd and usdm each rated 1/5 on injected display bands
        // where the real cutoffs give 2/5 — both in the alarming direction.
        // Feed-emitted bands (syrup's `pcr`) are deliberately rating-shaped and
        // are still honoured; only renderer-set ones carry display_only.
        var bands = data.asset_specific && data.asset_specific.chart_bands;
        if (bands && bands.display_only === true) bands = null;
        if (bands) {
            // verbose {critical,thin,amber,healthy:[lo,hi]} or short {pcr|thresholds:[a,b,c,d]}
            var healthyFloor, watchFloor;
            if (Array.isArray(bands.healthy) && Array.isArray(bands.amber)) {
                healthyFloor = bands.healthy[0];
                watchFloor = bands.amber[0];
            } else {
                var short = bands.pcr || bands.thresholds;
                if (Array.isArray(short) && short.length === 4) {
                    healthyFloor = short[2];  // app.js maps healthy:[c,d]
                    watchFloor = short[1];    // amber:[b,c]
                }
            }
            if (healthyFloor != null && watchFloor != null) {
                if (cr >= healthyFloor) return 5;
                if (cr >= watchFloor) return 3;
                return 1;
            }
        }
        return this._rate(cr, this._axisThresholds(data).backing.cr_pct, 'high');
    },

    _escapeAttr(str) {
        return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
            .replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },

    _indexerLabel(source) {
        if (!source || typeof source !== 'string') return null;
        var known = { geckoterminal: 'GeckoTerminal' };
        var normalized = source.trim().toLowerCase();
        if (known[normalized]) return known[normalized];
        return source.trim().replace(/[_-]+/g, ' ').replace(/\b\w/g, function(c) {
            return c.toUpperCase();
        });
    },

    // 24h volume for the Liquidity card subtitle. Two contracts to keep:
    //   1. `volume_24h` is emitted as null (never 0) when the lookup fails — an absent
    //      figure must render "n/a", never a false $0 on a pool doing tens of millions.
    //   2. It is indexer-derived (GeckoTerminal), unlike the 2% depth beside it, which is
    //      an executable on-chain quote — so it carries an explicit (indexer) qualifier
    //      and its source/as-of in the tooltip rather than reading as a chain verification.
    // The upstream cadence is daily, so the as-of is context only: no staleness warning.
    // ⚠️ Two spellings for one quantity. hastra-prime, thusd and usdai publish
    // `volume_24h`; the Yuzu feeds publish `volume_24h_usd`. This read only the
    // first, so the summary tile said "vol n/a" while the panel eight lines
    // below rendered $24.74 from the other field — the SAME defect as the
    // hardcoded literal, one layer up, and invisible because "n/a" is exactly
    // what an unmeasured asset should show.
    //
    // Accepting both is a stopgap, not the resolution: a second accepted
    // spelling entrenches the divergence. Raised with the producer to settle on
    // one; when it lands, drop the fallback rather than leave two.
    _volumeSubHtml(liq) {
        var vol = liq ? liq.volume_24h : null;
        if (vol == null && liq) vol = liq.volume_24h_usd;
        if (vol == null) return 'vol n/a';
        var src = this._indexerLabel(liq.volume_24h_source);
        var tip = '24h volume ' + (Math.abs(vol) < 1000
                ? '$' + vol.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : this.formatCurrencyExact(vol)) + ' · ' +
            (src ? src + ' — indexer-derived, not an on-chain quote'
                 : 'indexer-derived, not an on-chain quote');
        if (liq.volume_24h_as_of) tip += ' · as of ' + this.formatDate(liq.volume_24h_as_of);
        // ⚠️ formatCurrency floors to whole dollars below $1k, so yzUSD's $24.74
        // renders "$25" here too — the same rounding that nearly cost the finding
        // in the panel. Where the number is tiny, the exact figure IS the point.
        var volTxt = Math.abs(vol) < 1000
            ? '$' + vol.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : this.formatCurrency(vol);
        return '<span class="indexer-figure" title="' +
            this._escapeAttr(tip) + '">vol ' + volTxt + ' (indexer)</span>';
    },

    // --- summary band (replaces the legacy 5 CR cards in 5-axis mode) ---
    renderAxisBand(data, history) {
        var container = document.getElementById('summary-cards');
        if (!container) return;
        var peg = data.peg || {}, liq = data.liquidity || {}, dep = data.dependencies || {};
        var issuer = data.issuer || {};

        var pegPct = peg.premium_discount_pct;
        var pegCls = this.pegPctClass(this.pegStatusClass(pegPct));
        var pegArrow = this._pegTrendArrow(data, history);

        var nUp = Array.isArray(dep.upstream) ? dep.upstream.length : 0;
        // Downstream is a reserved stub until a consumer analyzer exists; an
        // absent/false `downstream_tracked` flag means "not tracked", NOT "0".
        var downTracked = dep.downstream_tracked === true;
        var nDown = Array.isArray(dep.downstream) ? dep.downstream.length : 0;
        var depDownHtml = downTracked
            ? nDown + ' <span class="text-sm font-normal text-slate-400">down</span>'
            : '<span class="text-base font-normal text-slate-400">downstream not tracked</span>';

        // Liquidity metric: credit vaults (e.g. Maple Syrup) expose free-liquidity % (instant-exit
        // capacity, rest queues at NAV) rather than a DEX 2% depth — show whichever the asset emits.
        var liqIsFree = liq.free_liquidity_pct != null;
        // ⚠️ The qualifier has to live on the TILE, not only in the panel.
        // usde, usdat and usdai are served by bespoke renderers that replace the
        // liquidity panel, so a floor/bracket note placed there never reaches
        // them — and usde is the exact asset whose $5M turned out to be past its
        // own crossing. The band is generic, so this is the one place every
        // asset passes through.
        var dStatus = liq.two_pct_depth_status;
        // ⚠️ not_size_responsive must NOT render like a floor, even though the
        // producer sets is_floor alongside it. A floor says "at least this much"
        // and is a real bound. USDS's $50M says only that the call returns the
        // same answer at any number — every rung from $1M to $50M came back
        // identical 0.00bps, because it routes the Sky PSM, a fixed-rate swap
        // bounded by pocket balance rather than slippage.
        //
        // Render them the same and the WORST-MEASURED asset on the page becomes
        // the deepest: "≥$50.0M" would put USDS above crvUSD's genuinely
        // bracketed $25M.
        var dUnresponsive = dStatus === 'not_size_responsive' ||
                            liq.two_pct_depth_size_responsive === false;
        var dFloor = !dUnresponsive &&
                     (liq.total_2pct_depth_is_floor === true ||
                      dStatus === 'ladder_exhausted' || dStatus === 'quote_failed');
        var depthTxt = liqIsFree
            ? (liq.free_liquidity_pct.toFixed(1) + '% free')
            : ((liq.total_2pct_depth != null)
                ? (dFloor ? '\u2265' : '') + this.formatCurrency(liq.total_2pct_depth)
                : this._exitCapacityHtml(liq));
        var dWord = '';
        // ⚠️ The label moves with the value — same rule the backing tile needed.
        // A capped periodic window shown under "2% depth" would read as depth.
        var exitAsValue = !liqIsFree && liq.total_2pct_depth == null && liq.primary_exit &&
            typeof liq.primary_exit.capacity_pct_of_tranche === 'number';
        if (!liqIsFree && liq.total_2pct_depth != null) {
            if (dUnresponsive) dWord = ' \u2014 quote does not vary with size';
            else if (dStatus === 'bracketed') dWord = ' (bracketed)';
            else if (dStatus === 'quote_failed') dWord = ' (floor \u2014 route failed)';
            else if (dFloor) dWord = ' (floor)';
        }
        // ⚠️ The liquidity score is one leg of two. The axis is "exit", and exit
        // has a venue leg and a redemption leg — but the rating is computed from
        // depth alone, so the number is narrower than the label.
        //
        // Refusing to rate would unrate 17 of 19 assets: only usdm and susds
        // carry a measured gate. An honest page nobody can use is not better
        // than a bounded number, so the scope is STATED rather than the rating
        // withdrawn.
        //
        // ⚠️ And the three states must render differently, which is the whole
        // point. If "redemption unprobed" looked the same on an asset that
        // DECLARES gated_basis: "unmeasured" and on one that says nothing, then
        // declaring a gap would cost the discloser exactly as much as hiding it
        // — the incentive this is meant to fix, rebuilt inside the fix. Four
        // assets scored with no exit leg represented at all while two declared
        // theirs; the honest feeds must not read worse than the silent ones.
        var exitScope = this._exitScopeHtml(liq);
        var liqSub = liqIsFree
            ? 'redemption · free at NAV, rest queues'
            // ⚠️ REPLACE the "2% depth" prefix, never extend it. The first cut
            // appended to it and produced "2% depth of tranche per quarter" — a
            // periodic redemption cap described as venue depth, which is the exact
            // mislabel the value fallback exists to prevent, reintroduced in the
            // sub-line of the same tile.
            : (exitAsValue
                ? 'of tranche per ' +
                  this._escapeAttr(String(liq.primary_exit.cadence || 'period').replace(/ly$/, '')) +
                  ' — primary exit, capped · venue depth not measured'
                : '2% depth' + dWord + ' · ' + this._volumeSubHtml(liq) + exitScope);
        // Say WHY it is unrated, or an honest blank reads as a missing feed.
        if (this._depthContradictedByLadder(data)) {
            liqSub = '<span class="text-amber-700">depth exceeds the 2% crossing in its own ladder</span>';
        } else if (dUnresponsive) {
            liqSub = '<span class="text-amber-700">quote returns the same answer at every size</span>';
        }

        var cards = [
            {
                label: 'Peg',
                valueHtml: '<span class="' + pegCls + '">' + this.pegPctText(pegPct, 2) + ' ' + pegArrow + '</span>',
                sub: 'premium / discount',
                chip: this._ratingChipHtml(this.pegRating(data, history), null,
                          this.pegRatingBasisNote(data, history)) +
                      this._divergenceChipHtml(this.pegRating(data, history),
                          this._authoredAxisScore(data.peg, ['peg_mechanism_score', 'volatility_score']))
            },
            {
                label: 'Backing',
                valueHtml: this._backingValueHtml(data),
                sub: this._backingSubText(data),
                chip: (function(self) {
                    var b = data.backing || {};
                    var authored = b.collateral_ratio == null &&
                        typeof b.backing_score === 'number' &&
                        b.backing_score_applies_when === 'collateral_ratio_declared_underivable' &&
                        b.collateral_ratio_basis;
                    // ⚠️ Say it is authored. A fallback rendered identically to a
                    // computed band would let a judgement pass as a measurement,
                    // which is the very thing the producer's rule guards against.
                    if (authored) {
                        return '<span class="axis-rating r-warn" title="' + self._escapeAttr(
                                   String(b.backing_score_basis || '')) + '">Authored ' +
                               b.backing_score + '/10</span>';
                    }
                    var bBand = self.backingRating(data);
                    return self._ratingChipHtml(bBand, self.backingUnratedReason(data),
                        self._authoredTooltipNote(bBand, self._authoredAxisScore(b, ["backing_score"]))) +
                        self._divergenceChipHtml(bBand, self._authoredAxisScore(b, ['backing_score']));
                })(this)
            },
            {
                label: 'Liquidity & Exit',
                valueHtml: depthTxt,
                sub: liqSub,
                chip: this._liquidityChipHtml(data)
            },
            {
                label: 'Dependencies',
                valueHtml: nUp + ' <span class="text-sm font-normal text-slate-400">up</span> · ' + depDownHtml,
                sub: 'upstream / downstream',
                chip: '<a href="#section-dependencies" class="axis-rating r-na">View links →</a>'
            },
            {
                // ⚠️ Unrated by design, and the card says why rather than showing a
                // bare dash. contract_score does not exist for any asset; see the
                // axis-5 comment in renderAxisSections.
                // ⚠️ "Contract & Admin", matching the section head — NOT "Contract".
                // The axis is TWO halves from two producers: security_analyst's
                // authority walk (who can act, keys, delays, upgrade & pause) and
                // riskAnalyst's code half (audits, architecture) plus the score.
                // A card reading "Contract" invites a reader to take it as
                // smart-contract risk only, and on most assets here the ADMIN half
                // is the one carrying the finding — susdai's code is not the issue,
                // PAUSE_ADMIN and STRATEGY_ADMIN acting with no delay on a $463M
                // vault is. Same length as 'Liquidity & Exit', so no layout risk.
                label: 'Contract & Admin',
                // ⚠️ The per-layer detail moves into the tooltip rather than the
                // face: the face carries ONE measurement, the tooltip carries
                // what it is a minimum over — including that a delayed layer with
                // timelock_floor: none is itself reducible, so even the non-zero
                // delays are not guaranteed.
                valueHtml: '<span title="' + this._escapeAttr(this._delayTooltip(data)) + '">' +
                           this._contractValueHtml(data) + '</span>',
                sub: this._contractSubText(data),
                chip: (typeof (data.contract || {}).structural_score === 'number'
                    ? '<span class="axis-rating r-warn" title="' + this._escapeAttr(
                          this._mdPlain(String((data.contract || {}).structural_score_basis || ''))) + '">Structural ' +
                      data.contract.structural_score + '/10</span>'
                    : '<span class="axis-rating r-na" title="No contract_score exists for any asset in the risk feed. The material is rendered in the axis below; the score is not yet authored.">Not scored yet</span>')
            },
            {
                label: this._escapeAttr(this._issuerAxisInfo(issuer).label),
                valueHtml: this._issuerBadgeHtml(issuer),
                sub: 'editorial · subjective',
                // ⚠️ This slot was EMPTY whenever the report was not linkable,
                // and it is the only card in the band that can be. Four cards
                // carry a chip and the fifth carries nothing, which reads as a
                // failed render rather than as an absent report — the same
                // "correct-looking blank" that has cost the most today.
                //
                // The producer already says why: report_url_status is
                // "unavailable" when a report exists but is not published yet
                // (yzUSD/syzUSD are staged on tidresearch and 404), and
                // "unverified" when it could not be checked. Say which, rather
                // than leaving a gap the reader has to interpret.
                chip: this._reportUrlUsable(issuer)
                    ? '<a href="' + issuer.report_url + '" target="_blank" rel="noopener noreferrer" class="axis-rating r-na">Report →</a>'
                    : this._reportChipHtml(issuer)
            }
        ];

        // ⚠️ SAY THAT THESE ARE LIVE, ONCE, WHERE THE SCORES ARE.
        //
        // Axes 1-3 are recomputed every refresh from the feed; 5 and 6 are authored
        // judgements. A reader seeing "Peg 10/10" beside a report saying 6.0 had no way
        // to know the first is a 7-day performance reading and the second a mechanism
        // score — the two look like a contradiction and the page never said they answer
        // different questions.
        //
        // ⚠️ Says they MAY differ, never which is right. Neither is: they measure
        // different things, and picking a winner here would be this renderer adjudicating
        // between two producers on a question neither asked it.
        // ⚠️ `col-span-full` IS LOAD-BEARING, not styling. #summary-cards is a
        // 6-column grid, so appending this note made it a grid ITEM and it rendered
        // as a chip-shaped block one cell wide on the left. Spanning the row is what
        // makes it read as prose.
        //
        // ⚠️ The report link renders ONLY where one exists. The registry and the
        // feed have DIFFERENT gaps — usg/usdm are absent from the registry but
        // present in the feed, strc/mstr the reverse — and app.js backfills
        // registry -> feed before this runs, so the union is 19 of 25. The other six
        // (ousd, usdd, bmnr, cusd, yzusd, syzusd) get the note with no link rather
        // than a dangling arrow to nothing.
        var _reportUrl = (data && data.issuer && data.issuer.report_url) || null;
        var liveNote = '<div class="axis-band-note col-span-full text-sm text-slate-500 mt-3 leading-relaxed">' +
            'Peg, Backing and Liquidity are <strong>live measurements</strong>, recomputed ' +
            'each refresh from on-chain and venue data. Contract &amp; Admin and Issuer are ' +
            '<strong>authored assessments</strong>. Live readings can differ from the scores ' +
            'in the published report \u2014 they answer different questions, and an asset can ' +
            'perform well on a mechanism that is structurally weak.' +
            (_reportUrl
                ? ' <a href="' + this._escapeAttr(_reportUrl) + '" target="_blank" ' +
                  'rel="noopener noreferrer" class="text-blue-600 hover:underline whitespace-nowrap">' +
                  'Read the full risk report for the authored scores \u2192</a>'
                : '') +
        '</div>';
        container.innerHTML = cards.map(function(c) {
            return '<div class="summary-card">' +
                '<div class="card-label">' + c.label + '</div>' +
                '<div class="card-value">' + c.valueHtml + '</div>' +
                (c.sub ? '<div class="text-xs text-slate-400 mt-1">' + c.sub + '</div>' : '') +
                (c.chip ? '<div class="mt-2">' + c.chip + '</div>' : '') +
            '</div>';
        }).join('') + liveNote;
        container.style.display = '';
    },

    // ⚠️ DO NOT DROP THIS FIELD TO MAKE THE BACKING AXIS LOOK FRESHER. Read this
    // before any freshness sweep touches it.
    //
    // The axis clock takes the OLDEST declared input, so attachment_point_as_of
    // drags axis 2 to "6d old" while the reserve figures beside it are minutes
    // old. That reading is CORRECT — an axis is only as fresh as its stalest
    // component — but it creates a perverse incentive that riskAnalyst named:
    // supplying a valuable older fact makes the axis look WORSE, and the
    // cheapest way to turn the clock green is to delete the attachment point.
    //
    // ⚠️ That would remove the single most important thing on this axis in order
    // to improve a number describing it, and it would look like tidying. An
    // output must not be allowed to remove its own input. The right fixes are a
    // per-field freshness display, or re-measuring more often — the producer has
    // taken the second (11.0% -> 9.7% -> 9.66% over twelve days; it is not
    // static). Neither is "publish less."
    //
    // ⚠️ SUPPLY IS SCOPED AND THE SCOPE IS CONTESTED. This is the ETHEREUM
    // supply. The feed's own header says "Ethereum primary; also Arbitrum, Base,
    // Avalanche", while security_analyst measured code size 0 at the same address
    // on all three — bounded to the same-address case, since a deployment at a
    // different address was never searched. So neither "one chain" nor "four
    // chains" is established, and this label says what was MEASURED (Ethereum)
    // rather than resolving a question nobody has answered.
    //
    // ⚠️ Claim value is supply x issuer-set NAV. It is what holders are TOLD they
    // hold, not what is held for them — and on this asset the NAV in that product
    // is issuer-written (see the NAV write path on axis 1). Labelled as claim,
    // never as backing.
    _renderClaimSize(data) {
        var b = (data && data.backing) || {};
        var head = document.getElementById('axis-backing-head');
        if (!head) return;
        var supply = typeof b.ethereum_supply === 'number' ? b.ethereum_supply : null;
        var claim = typeof b.nav_claim_value === 'number' ? b.nav_claim_value : null;
        if (supply == null && claim == null) return;

        var parts = [];
        if (supply != null) {
            parts.push('<span class="cs-item"><span class="cs-key">Supply</span>' +
                '<span class="cs-val">' + (supply / 1e6).toFixed(1) + 'M</span>' +
                '<span class="cs-scope">Ethereum \u2014 the only chain measured</span></span>');
        }
        if (claim != null) {
            parts.push('<span class="cs-item"><span class="cs-key">Claim value</span>' +
                '<span class="cs-val">$' + (claim / 1e6).toFixed(1) + 'M</span>' +
                '<span class="cs-scope">supply \u00d7 issuer-set NAV \u2014 not backing</span></span>');
        }
        var el = document.createElement('div');
        el.className = 'claim-size';
        el.innerHTML = parts.join('') +
            (b.nav_claim_value_basis
                ? '<div class="cs-basis">' + this._escapeAttr(b.nav_claim_value_basis) + '</div>' : '') +
            (b.total_backing_basis
                ? '<div class="cs-basis"><span class="cs-key">No total backing:</span> ' +
                  this._escapeAttr(b.total_backing_basis) + '</div>' : '');
        head.appendChild(el);
    },

    // ⚠️ THE HAZARD IS A DIVISION THE READER PERFORMS, NOT A FIGURE WE OMIT.
    // This page already shows nav_claim_value ($220.8M for reUSD). Put a reserves
    // total beside it and a reader divides the two and reads a coverage ratio —
    // but the numerator is PROTOCOL-WIDE (reUSD *and* reUSDe) while the
    // denominator is reUSD alone. Two different scopes, so the quotient means
    // nothing, and it means nothing in the alarming direction.
    //
    // The producer says this outright — scope: "not attributable to reUSD alone",
    // integrity.note: "it is not used to claim reUSD coverage" — so the warning
    // is the feed's own position, rendered rather than left in the payload. The
    // scope line is the SUBTITLE of the figure, not a footnote under the table:
    // a qualifier that arrives after the number has been read is too late.
    //
    // ⚠️ It is also why no ratio is computed here even though both operands are
    // on the page. The dashboard declining to divide is the whole point.
    _renderIssuerReportedReserves(data) {
        var b = (data && data.backing) || {};
        var pt = b.protocol_reserves_passthrough;
        if (!pt || typeof pt !== 'object' || typeof pt.total_usd !== 'number') return;
        var head = document.getElementById('axis-backing-head');
        if (!head) return;

        var rows = Array.isArray(pt.breakdown) ? pt.breakdown : [];
        var self = this;
        var body = rows.map(function(r) {
            var pct = typeof r.pct === 'number' ? r.pct : null;
            // ⚠️ Flag the concentration rather than leaving it as one row among
            // six. sUSDe at 93.87% is not a line item, it is the asset's largest
            // single dependency, and a reader scanning a table does not rank it.
            var dominant = pct != null && pct >= 50;
            return '<tr' + (dominant ? ' class="irr-dominant"' : '') + '>' +
                '<td>' + self._escapeAttr(r.name || '—') + (dominant ? ' \u26a0\ufe0f' : '') + '</td>' +
                '<td class="irr-num">' + (typeof r.value_usd === 'number'
                    ? '$' + Math.round(r.value_usd).toLocaleString('en-US') : '—') + '</td>' +
                '<td class="irr-num">' + (pct != null ? pct.toFixed(2) + '%' : '—') + '</td>' +
                '<td class="irr-num">' + (r.chains != null ? r.chains : '—') + '</td>' +
            '</tr>';
        }).join('');

        var el = document.createElement('div');
        el.className = 'issuer-reserves';
        el.innerHTML =
            '<div class="irr-head">Issuer-reported reserves \u2014 protocol-wide</div>' +
            '<div class="irr-total">$' + (pt.total_usd / 1e6).toFixed(1) + 'M</div>' +
            '<div class="irr-scope">\u26a0\ufe0f ' +
                this._escapeAttr(pt.scope || 'Scope not declared by the producer.') +
                ' <strong>This is not a coverage figure.</strong> Dividing it by reUSD\u2019s supply ' +
                'or claim value compares a two-asset numerator with a one-asset denominator, so the ' +
                'result is meaningless \u2014 and misleadingly low.' +
            '</div>' +
            (rows.length
                ? '<div class="irr-tablewrap"><table class="irr-table">' +
                  '<thead><tr><th>Asset</th><th class="irr-num">Value</th>' +
                  '<th class="irr-num">Share</th><th class="irr-num">Chains</th></tr></thead>' +
                  '<tbody>' + body + '</tbody></table></div>'
                : '') +
            '<div class="irr-note">' +
                (pt.source ? 'Source: ' + this._escapeAttr(String(pt.source)) + '. ' : '') +
                (pt.retrieved_at
                    ? '\u26a0\ufe0f Retrieved ' + this._escapeAttr(pt.retrieved_at) +
                      ' \u2014 that is when the page was FETCHED, not when the issuer computed these ' +
                      'figures. No source timestamp is published, so their true age is unknown.'
                    : '') +
            '</div>' +
            (b.integrity && b.integrity.note
                ? '<div class="irr-note"><span class="irr-key">Integrity' +
                  (b.integrity.status ? ' (' + this._escapeAttr(String(b.integrity.status)) + ')' : '') +
                  ':</span> ' + this._escapeAttr(b.integrity.note) + '</div>'
                : '');
        head.appendChild(el);
    },

    // Data-gated: no-op for the 25 assets that publish no attachment point.
    _renderAttachmentPoint(data) {
        var b = data.backing || {};
        var pct = b.attachment_point_pct;
        if (typeof pct !== 'number' || !isFinite(pct)) return;
        var head = document.getElementById('axis-backing-head');
        if (!head) return;

        var norm = typeof b.attachment_point_norm_pct === 'number' ? b.attachment_point_norm_pct : null;
        // ⚠️ Trust the producer's own verdict over re-deriving it from the two
        // numbers. `below_norm` is the analyst's call; a renderer recomputing
        // pct < norm would silently disagree the first time a norm is expressed
        // as a band or the comparison is not a bare less-than.
        var below = b.attachment_point_below_norm === true;

        var el = document.createElement('div');
        el.className = 'attachment-point' + (below ? ' attachment-point-warn' : '');
        var bits = [];
        bits.push('<span class="ap-label">First-loss attachment point</span>' +
                  '<span class="ap-value">' + pct.toFixed(2) + '%</span>' +
                  (norm != null
                      ? '<span class="ap-norm">' + (below ? '\u26a0\ufe0f below' : 'vs') +
                        ' the ' + norm + '% norm</span>'
                      : ''));
        if (b.attachment_point_basis) {
            bits.push('<div class="ap-note"><span class="ap-note-key">Basis:</span> ' +
                      this._escapeAttr(b.attachment_point_basis) + '</div>');
        }
        if (b.attachment_point_direction_note) {
            bits.push('<div class="ap-note ap-note-direction">' +
                      this._escapeAttr(b.attachment_point_direction_note) + '</div>');
        }
        // ⚠️ THE JUNIOR FIGURE IS NOT THIS RATIO'S DENOMINATOR, AND RENDERING IT
        // BESIDE THE RATIO IS THE ONE PLACE THAT COULD GO WRONG.
        //
        // $73.0M is the BALANCE-SHEET junior — Re's "$77M" product-page quantity,
        // computed as a /tvl residual. The attachment point divides by the $20.0M
        // WATERFALL layer. Substitute one for the other and 7.94% becomes ~29%:
        // the tile reads FOUR TIMES SAFER than it is. The producer wrote that trap
        // into the field's own basis, so the label here names what the number is
        // NOT, in the same breath as what it is.
        //
        // It earns its place because it is what makes the ratio checkable: the
        // junior layer moved +0.4% in three weeks against +39.3% senior growth,
        // so "the cushion thinned because the denominator rose" is measured here
        // rather than assumed.
        // ⚠️ THE SERIES NOTE RENDERS BECAUSE ITS EXCLUSION IS THE POINT. It carries
        // a clean three-point all-chain series with the 2026-08-24 reading
        // deliberately LEFT OUT and the reason stated — that reading's $207.0M was
        // an ETHEREUM-LEG denominator, not comparable to the all-chain points
        // either side of it. A dropped point that says why it was dropped is
        // evidence; one that vanishes is a gap nobody can audit.
        if (b.attachment_point_series_note) {
            bits.push('<div class="ap-note ap-series"><span class="ap-note-key">Series:</span> ' +
                this._escapeAttr(String(b.attachment_point_series_note)) + '</div>');
        }
        if (typeof b.junior_capital_usd === 'number') {
            bits.push('<div class="ap-note ap-junior">' +
                '<span class="ap-note-key">Junior capital:</span> $' +
                (b.junior_capital_usd / 1e6).toFixed(1) + 'M balance-sheet ' +
                '<span class="ap-junior-warn">\u2014 NOT the $20.0M waterfall layer this ratio ' +
                'divides by</span>' +
                (b.junior_capital_basis
                    ? '<span class="ap-junior-basis" title="' +
                      this._escapeAttr(String(b.junior_capital_basis)) + '"> \u24d8</span>'
                    : '') +
            '</div>');
        }
        if (b.attachment_point_as_of) {
            // Its own clock: the attachment point is measured on a different
            // cadence from the reserve figures beside it, and is usually older.
            // ⚠️ "As of", NOT "Measured" — the difference is the whole claim.
            // tidr's report marks this figure INDICATIVE because it divides a
            // June 2026 junior-capital figure by a 2026-08-23 on-chain senior
            // read: a two-month-old numerator over a current denominator. The
            // producer's field is named `attachment_point_as_of` and says
            // nothing about measurement; "Measured" was the renderer asserting
            // a vintage the data does not claim.
            bits.push('<div class="ap-note ap-note-asof">As of ' +
                      this._escapeAttr(b.attachment_point_as_of) +
                      (b.attachment_point_vintage_note
                          ? ' \u00b7 ' + this._escapeAttr(b.attachment_point_vintage_note)
                          : '') + '</div>');
        }
        el.innerHTML = bits.join('');
        head.appendChild(el);
    },

    // Data-gated: silent for every asset that publishes no write path.
    _navWritePathHtml(data) {
        var b = (data && data.backing) || {};
        var path = typeof b.nav_write_path === 'string' ? b.nav_write_path.trim() : '';
        if (!path) return '';
        var basis = typeof b.nav_write_path_basis === 'string' ? b.nav_write_path_basis.trim() : '';

        // ⚠️ RENDER THE LIMIT, NOT ONLY THE CLAIM — the producer asked for this
        // explicitly and was right to. Their evidence is selector presence in
        // bytecode, which does NOT distinguish a contract that IMPLEMENTS a
        // function from one that CALLS it, and no disassembly was done. The
        // claim as written is stronger than the evidence supports, and a finding
        // this serious is exactly the one that must carry its own uncertainty:
        // a reader who later discovers the limit unaided discounts everything
        // else on the page too.
        //
        // The limit is NOT hidden in a tooltip. It is the same size and in the
        // same block as the claim, because a caveat a touch device cannot reach
        // is a caveat that does not exist.
        return '<div class="nav-write-path">' +
            '<div class="nwp-head">\u26a0\ufe0f NAV write path</div>' +
            '<div class="nwp-claim">' + this._escapeAttr(path) + '</div>' +
            (basis
                ? '<div class="nwp-basis"><span class="nwp-basis-key">Basis &amp; limit:</span> ' +
                  this._escapeAttr(basis) + '</div>'
                : '<div class="nwp-basis nwp-basis-none">\u26a0\ufe0f No basis published for this ' +
                  'claim \u2014 it is asserted here without stated evidence or limits.</div>') +
            '</div>';
    },

    _pegTrendArrow(data, history) {
        // Compare current |deviation| to the 7-day average; ▲ = widening (worse),
        // ▼ = tightening (better). Muted when no history.
        var avg = this._pegAvgAbsDev(data, history, 7);
        var cur = data.peg && data.peg.premium_discount_pct != null ? Math.abs(data.peg.premium_discount_pct) : null;
        if (avg == null || cur == null) return '';
        if (cur > avg * 1.05) return '<span class="text-red-500" title="widening vs 7d avg">▲</span>';
        if (cur < avg * 0.95) return '<span class="text-green-500" title="tightening vs 7d avg">▼</span>';
        return '<span class="text-slate-400" title="flat vs 7d avg">▶</span>';
    },

    // ⚠️ collateral_ratio_basis was published by five feeds and read by none.
    //
    // A CR is only comparable to another CR on the same basis, and these are not:
    // apxusd's is netted of POL and inventory, usg's is a debt-weighted mean over
    // active markets, usdm's backing CR is stable-only while its SUMMARY basis
    // says in as many words "NOT USDm's own coverage". That warning was sitting
    // in the payload, invisible, next to the number it warns about.
    //
    // Taken from the block the VALUE came from, same discipline as the scale.
    _backingBasis(data) {
        var fromBacking = data.backing && data.backing.collateral_ratio != null;
        var blk = fromBacking ? data.backing : (data.summary || {});
        if (blk.collateral_ratio_basis) return blk.collateral_ratio_basis;
        // ⚠️ A DELIBERATELY NULL ratio still has a basis, and it is the most
        // load-bearing one on the page: thUSD's says "Deliberately null. Total
        // backing is NOT OBSERVABLE", sUSDai's says "No collateral ratio is
        // defined for this asset." Keying on the value being non-null dropped
        // the explanation precisely where there is no number to speak for
        // itself. A basis describing an absent value is still describing its
        // own block.
        var b = data.backing || {};
        if (!fromBacking && b.collateral_ratio === null && b.collateral_ratio_basis) {
            return b.collateral_ratio_basis;
        }
        return null;
    },

    // Shared basis panel for the BESPOKE renderers.
    //
    // ⚠️ Eight assets showed their ratio basis on hover only, because their
    // renderers clear axis-backing-head to build their own and the generic basis
    // line cannot reach them. The strings were doing real work behind that
    // tooltip — sUSDe "a claim on USDe is worth what USDe is backed by", thUSD
    // "total backing is NOT OBSERVABLE", syrup "three INDEPENDENT reads".
    //
    // Returns a panel so each renderer can place it inside its own §3 rather
    // than having a line injected into a head it owns.
    backingBasisPanelHtml(data) {
        var b = (data && data.backing) || {};
        var rows = [];
        function add(label, text) {
            if (!text) return;
            rows.push('<div class="text-xs text-slate-600 mt-2" style="line-height:1.5;">' +
                '<span class="font-semibold">' + label + ':</span> ' +
                CommonRenderer._escapeAttr(text) + '</div>');
        }
        var basis = this._backingBasis(data);
        add('Ratio basis', basis);
        // collateral_ratio_note is a SECOND field, not a copy — thUSD publishes
        // both and they differ. Skip it only when it restates the basis.
        // ⚠️ Compare case- and punctuation-insensitively. thUSD's two fields open
        // "Deliberately null. Total backing is NOT OBSERVABLE" and "...is not
        // observable" — the same sentence in different case, which a literal
        // comparison treats as two findings and prints twice.
        var note = b.collateral_ratio_note;
        function key(x) { return String(x).toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 60); }
        if (note && basis && key(note) === key(basis)) note = null;
        add('Ratio note', note);
        add('Surplus basis', this._surplusBasis(data));
        // ⚠️ "RESIDUAL... Ties by construction and is NOT evidence the off-chain
        // backing exists" — a figure that looks measured and is not.
        add('Off-chain backing', b.off_chain_backing_note);
        if (!rows.length) return '';
        return '<div class="panel">' +
            '<div class="panel-title" style="margin-bottom:0.15rem;">What this number is</div>' +
            rows.join('') +
        '</div>';
    },

    // Same block discipline as _backingBasis: the basis describes the value in
    // ITS OWN block, so take it from wherever surplus_deficit itself came from.
    _surplusBasis(data) {
        var b = data.backing || {};
        var sum = data.summary || {};
        if (b.surplus_deficit != null) return b.surplus_deficit_basis || null;
        if (sum.surplus_deficit != null) return sum.surplus_deficit_basis || null;
        return b.surplus_deficit_basis || sum.surplus_deficit_basis || null;
    },

    // Format a CR so rounding cannot move it across a rating cutoff.
    _crDisplay(cr, data) {
        var cuts = [];
        var bOv = data.asset_specific && data.asset_specific.axis_thresholds
                  && data.asset_specific.axis_thresholds.backing;
        if (bOv && Array.isArray(bOv.cr_pct)) cuts = bOv.cr_pct;
        else cuts = this._axisThresholds(data).backing.cr_pct || [];
        for (var dp = 2; dp <= 6; dp++) {
            var rounded = Number(cr.toFixed(dp));
            var crossed = cuts.some(function (c) {
                return (cr < c && rounded >= c) || (cr >= c && rounded < c);
            });
            if (!crossed) return this.formatPercent(cr, dp);
        }
        return this.formatPercent(cr, 6);
    },

    // ⚠️ THE OLD TILE ZIPPED TWO VALUES AGAINST N NAMES AND BROKE AT N>2.
    // It emitted the first delayed layer and the first open one — at most two
    // tokens — while the caption named EVERY layer. USG rendered "none" over
    // "asset permission / oracle / governance": one value, three names. The
    // positional pairing only ever held for a 1-delayed/1-open asset, which was
    // the only asset emitting when it was written.
    //
    // ⚠️ AND "48h / none" WAS AMBIGUOUS IN A WAY THAT MATTERED. It means
    // "contract-upgrade 48h, asset-permission none", but it also reads as "48h
    // delay, with no floor" — which is ALSO true of reUSD, since that layer's
    // timelock_floor really is none. A string with two true readings, one of
    // which is not what it says, caught riskAnalyst with the layer JSON open in
    // front of them.
    //
    // So the value is a single MEASUREMENT with nothing to zip against: the
    // shortest warning any admin path gives. Derived by min(), never authored.
    //
    // ⚠️ A `none` FIXES THE MINIMUM AT ZERO REGARDLESS OF UNKNOWNS — one
    // undelayed path is enough, so unresolved layers cannot raise it. With no
    // `none` but some unresolved, the min is only an UPPER BOUND and renders as
    // "≤Nh"; with everything unresolved it is not established. An unmeasured
    // layer must never round down to zero.
    _delaySummary(data) {
        var c = data.contract;
        var layers = (c && Array.isArray(c.layers)) ? c.layers : [];
        if (!layers.length) return null;
        function hours(v) {
            var t = String(v == null ? '' : v).trim().toLowerCase();
            var m = /^(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours|d|day|days|m|min|mins)$/.exec(t);
            if (m) {
                var n = parseFloat(m[1]);
                if (/^d/.test(m[2])) return n * 24;
                if (/^m/.test(m[2])) return n / 60;
                return n;
            }
            if (/^\d+$/.test(t)) return parseInt(t, 10) / 3600;  // bare seconds
            return null;
        }
        var open = 0, unresolved = 0, delayed = [], floorless = 0;
        layers.forEach(function(l) {
            var tl = String(l.timelock == null ? '' : l.timelock).trim().toLowerCase();
            if (tl === 'unresolved') { unresolved++; return; }
            if (!tl || tl === 'none') { open++; return; }
            var h = hours(tl);
            if (h == null) { unresolved++; return; }
            delayed.push(h);
            if (l.timelock_floor === 'none') floorless++;
        });
        var min = delayed.length ? Math.min.apply(null, delayed) : null;
        return {
            total: layers.length, open: open, unresolved: unresolved,
            delayed: delayed.length, floorless: floorless,
            hours: open > 0 ? 0 : min,
            definite: open > 0 || (unresolved === 0 && min != null),
            established: open > 0 || min != null
        };
    },

    _fmtHours(h) {
        if (h === 0) return '0h';
        if (h < 1) return Math.round(h * 60) + 'm';
        if (h < 48) return (h % 1 ? h.toFixed(1) : h) + 'h';
        return (h / 24 % 1 ? (h / 24).toFixed(1) : h / 24) + 'd';
    },

    _delayTooltip(data) {
        var c = data.contract || {};
        var layers = Array.isArray(c.layers) ? c.layers : [];
        if (!layers.length) return 'No admin layers published.';
        var lines = layers.map(function(l) {
            var tl = String(l.timelock == null ? '' : l.timelock).trim() || 'none';
            var isDelayed = tl.toLowerCase() !== 'unresolved' && tl.toLowerCase() !== 'none';
            return '\u2022 ' + (l.authority_layer || '?') + ': ' +
                (tl.toLowerCase() === 'unresolved' ? 'NOT MEASURED' : tl) +
                // ⚠️ Only where there is a delay to reduce. `timelock_floor: none`
                // on an already-undelayed layer says nothing, and printing it
                // three times on USG made the tooltip look like three findings.
                (isDelayed && l.timelock_floor === 'none' ? ' (no floor \u2014 reducible)' : '');
        });
        return 'Shortest warning any admin path gives, min() over the measured layers:\n' +
            lines.join('\n') +
            '\n\u26a0\ufe0f One undelayed path fixes the minimum at zero regardless of the others.';
    },

    _contractValueHtml(data) {
        var d = this._delaySummary(data);
        if (!d) return '<span class="text-slate-400">—</span>';
        if (!d.established) return '<span class="text-amber-700">not established</span>';
        var txt = (d.definite ? '' : '\u2264') + this._fmtHours(d.hours) + ' warning';
        var cls = d.hours === 0 ? 'text-red-600' : 'text-slate-700 dark:text-slate-200';
        return '<span class="' + cls + '">' + this._escapeAttr(txt) + '</span>';
    },

    // ⚠️ States the COUNT instead of implying a pairing, so it cannot misalign at
    // any number of layers — and "N delayed" is what actually discriminates
    // between assets, since every hand-walked asset in the book currently has at
    // least one undelayed path and so shares the same 0h value.
    _contractSubText(data) {
        var d = this._delaySummary(data);
        var c = data.contract || {};
        if (!d) return 'admin authority & delay';
        var parts = ['shortest of ' + d.total + ' admin path' + (d.total === 1 ? '' : 's')];
        parts.push(d.delayed ? d.delayed + ' delayed' : 'none delayed');
        if (d.unresolved) parts.push(d.unresolved + ' unmeasured');
        if (c.method) parts.push(c.method);
        return parts.join(' \u00b7 ');
    },

    _backingValueHtml(data) {
        var cr = (data.backing && data.backing.collateral_ratio != null)
            ? data.backing.collateral_ratio : (data.summary && data.summary.collateral_ratio);
        // No CR, but a measured partial coverage figure — show what IS known.
        // Uses on_chain_coverage_display_pct, which the producer publishes
        // already-scaled beside on_chain_coverage_pct_is_fraction; the raw field
        // is a FRACTION and rendering it directly would print 0.43%.
        if (cr == null) {
            var cov = data.backing && data.backing.on_chain_coverage_display_pct;
            if (cov != null) {
                var covCls = cov >= 70 ? 'text-green-600' : 'text-red-600';
                var covBasis = (data.backing || {}).collateral_ratio_basis;
                return '<span class="' + covCls + '"' +
                    (covBasis ? ' title="' + this._escapeAttr(covBasis) + '"' : '') + '>' +
                    this.formatPercent(cov, 2) + '</span>' +
                    '<span class="text-slate-400 text-xs"> on-chain</span>';
            }
            // ⚠️ STILL NOTHING? Fall through to the FIRST-LOSS ATTACHMENT POINT
            // before printing a dash. Same principle as the coverage fallback
            // above — show what IS known — and it matters more here: reUSD has
            // no derivable collateral ratio (the issuer publishes combined
            // reUSD + reUSDe reserves with no asset-attributed denominator), so
            // the tile printed "—" over an axis whose headline is a cushion
            // measured BELOW the norm its own report invokes. The top row is
            // what a reader scans; a dash there reads as "nothing measured".
            //
            // ⚠️ Labelled, never presented as a coverage ratio. It answers a
            // different question — how much loss lands on someone else first —
            // and the sub text switches with it so the two cannot be confused.
            var ap = data.backing && data.backing.attachment_point_pct;
            if (typeof ap === 'number') {
                var below = data.backing.attachment_point_below_norm === true;
                var apTitle = [data.backing.attachment_point_basis,
                               data.backing.attachment_point_vintage_note]
                    .filter(Boolean).join(' \u2014 ');
                return '<span class="' + (below ? 'text-amber-700' : 'text-slate-700') + '"' +
                    (apTitle ? ' title="' + this._escapeAttr(apTitle) + '"' : '') + '>' +
                    this.formatPercent(ap, 2) + '</span>' +
                    (below ? '<span class="text-amber-700 text-xs"> \u26a0\ufe0f</span>' : '');
            }
            return '—';
        }
        var cls = cr >= 100 ? 'text-green-600' : 'text-red-600';
        var basis = this._backingBasis(data);
        // ⚠️ Never round ACROSS a rating boundary. susds is 99.999993 — seven
        // millionths of a point below par, which its own basis explains as noise
        // between a token balance and a chi-derived denominator — and it rendered
        // "100.00%" beside a Stress chip and a deficit. The number and the chip
        // then contradict each other and the page reads as broken when it is not.
        // Show enough decimals that the displayed figure sits on the same side of
        // the boundary as the real one. A no-op for every value not sitting on a
        // cutoff.
        var shown = this._crDisplay(cr, data);
        return '<span class="' + cls + '"' +
            (basis ? ' title="Basis: ' + this._escapeAttr(basis) + '"' : '') + '>' +
            shown + '</span>' +
            (basis ? '<span class="text-slate-400 text-xs" title="Basis: ' +
                     this._escapeAttr(basis) + '"> \u24d8</span>' : '');
    },

    _backingSubText(data) {
        var b = data.backing || {};
        // ⚠️ A null CR is not always "nothing to show". thUSD's is deliberately
        // null because TOTAL backing is unobservable — but on-chain coverage IS
        // measured, is flagged critical, and was sitting six inches below a blank
        // card. Distinguish that from susdai, whose null means a NAV vault has no
        // backing ratio at all: there, nothing is known and a dash is honest.
        if (b.collateral_ratio == null && b.on_chain_coverage_display_pct != null) {
            return 'on-chain only \u2014 total backing unobservable';
        }
        // ⚠️ THE LABEL MUST MOVE WITH THE VALUE. When the tile falls through to
        // the attachment point, "collateral ratio" underneath it is a mislabel of
        // exactly the kind this file keeps fixing elsewhere — a number rendered
        // under the name of a different quantity. 9.66% is not coverage; it is
        // how much loss lands on someone else before this tranche is touched.
        if (b.collateral_ratio == null && typeof b.attachment_point_pct === 'number') {
            return 'first-loss attachment' +
                (b.attachment_point_norm_pct != null
                    ? ' \u00b7 ' + b.attachment_point_norm_pct + '% norm' : '') +
                ' \u2014 no collateral ratio derivable';
        }
        var sd = (b.surplus_deficit != null)
            ? b.surplus_deficit : (data.summary && data.summary.surplus_deficit);
        var base = (sd == null)
            ? 'collateral ratio'
            : (sd >= 0 ? 'surplus +' : 'deficit −') + this.formatCurrency(Math.abs(sd));
        // ⚠️ USDat's tile read "100.00% · surplus +$0 · Healthy 4/5" while its
        // own feed said the ratio is an ETHEREUM-ONLY statement and the BSC leg
        // exposes no backing accessor, so that leg's backing is UNREAD, not
        // absent. The word Ethereum appeared once on the page and BSC not at
        // all. 100.00% Healthy is the most reassuring pair of figures a backing
        // tile can show, and the one fact qualifying it was published and
        // rendered nowhere.
        //
        // supply_scope is a machine-readable enum, not prose — render it, don't
        // parse the note. The full note goes near the panels; this is the chip
        // that stops the headline being read as a global claim.
        var scope = data.summary && data.summary.supply_scope;
        if (scope) {
            base += ' \u00b7 ' + String(scope).replace(/_/g, '-') + ' scope';
        }
        return base;
    },

    _issuerAxisInfo(issuer) {
        issuer = issuer || {};
        var badge = typeof issuer.badge === 'string' ? issuer.badge.trim() : '';
        // Only treat a badge as an axis score when it ends in a numeric N/10.
        // Names such as USDS's "Sky (MakerDAO)" must remain opaque badge text.
        var scoredBadge = badge.match(/^(.+?)\s+(\d+(?:\.\d+)?)\/10$/i);
        var isStructural = Object.prototype.hasOwnProperty.call(issuer, 'structural_score') ||
            issuer.structural_score_status != null;
        var prefix = isStructural ? 'structural' : 'issuer';
        var score = issuer[prefix + '_score'];
        var status = issuer[prefix + '_score_status'];
        var label = scoredBadge ? scoredBadge[1].trim() : (isStructural ? 'Structural' : 'Issuer');

        return {
            label: label,
            badge: badge,
            scoredBadge: scoredBadge,
            score: score,
            status: status,
            source: issuer[prefix + '_score_source'],
            generatedAt: issuer[prefix + '_score_generated_at'],
            ageHours: issuer[prefix + '_score_age_hours'],
            inheritedFrom: issuer[prefix + '_score_inherited_from'] ||
                (prefix !== 'issuer' ? null : issuer.issuer_score_inherited_from)
        };
    },

    _issuerBadgeText(issuer) {
        var info = this._issuerAxisInfo(issuer);
        if (info.scoredBadge) return info.scoredBadge[2] + '/10';
        if (info.badge) {
            // The unavailable badge follows the same "Axis unavailable" contract,
            // but the summary card already carries the axis label above it.
            if (info.status === 'unavailable' && /\s+unavailable$/i.test(info.badge)) return 'unavailable';
            return info.badge;
        }
        if (info.score != null) return info.score + '/10';
        if (info.status === 'unavailable') return 'unavailable';
        return '—';
    },

    _issuerScoreTooltip(info) {
        var parts = [];
        if (info.inheritedFrom) parts.push(info.label + ' score inherited from ' + info.inheritedFrom);
        if (info.status && info.status !== 'ok') parts.push('Status: ' + info.status.replace(/_/g, ' '));
        if (info.generatedAt) parts.push('Generated ' + this.formatDate(info.generatedAt));
        if (info.ageHours != null) parts.push('Age ' + Number(info.ageHours).toFixed(1) + 'h');
        if (info.source) parts.push('Source: ' + info.source);
        return parts.join(' · ');
    },

    _issuerBadgeHtml(issuer) {
        var info = this._issuerAxisInfo(issuer);
        var text = this._issuerBadgeText(issuer);
        var tooltip = this._issuerScoreTooltip(info);
        var status = info.status && info.status !== 'ok'
            ? ' <span class="text-xs font-normal text-amber-600">· ' +
                this._escapeAttr(info.status.replace(/_/g, ' ')) + '</span>'
            : '';
        return '<span' + (tooltip ? ' title="' + this._escapeAttr(tooltip) + '"' : '') + '>' +
            this._escapeAttr(text) + '</span>' + status;
    },

    // --- section heads ---
    _renderAxisHead(name, num, title, sub, ratingHtml, block) {
        var el = document.getElementById('axis-' + name + '-head');
        if (!el) return;
        el.innerHTML =
            '<span class="axis-num">' + num + '</span>' +
            '<span class="axis-title">' + title + '</span>' +
            (sub ? '<span class="axis-sub">' + sub + '</span>' : '') +
            (ratingHtml || '') +
            this._axisClockHtml(block) +
            this._axisSourceHtml(name);
    },

    // ⚠️ ONE PAGE STAMP OVER SIX CLOCKS. The header reads "Updated: 0.4h ago"
    // from the file's top-level timestamp while, on yzUSD right now:
    //
    //   peg.market_price_as_of        23.9h
    //   liquidity.venues_as_of         5.4h
    //   issuer.issuer_score_...       17.8h
    //   asset_specific.exposure_as_of 41.8h
    //
    // pegtracker-f9 found this by taking my own argument against an assembler
    // and applying it INSIDE a single producer's file — six cadences, one stamp,
    // and a block with no clock silently inherits one that is honest about the
    // file and wrong about the block. No assembler required.
    //
    // So each axis states its own age. ⚠️ It is NOT an alarm: 17.8h is correct
    // for an editorial score and 41.8h is the issuer's own exposure cadence.
    // The defect was never that the data is old, it is that the page implied it
    // was 0.4h old. Amber only past 24h, and only to draw the eye.
    _axisClockHtml(block) {
        if (!block || typeof block !== 'object') return '';
        // ⚠️ Take the OLDEST declared input, not the first one found. An axis is
        // only as fresh as its stalest component: yzUSD's liquidity block carries
        // exit_mark.as_of at 1.7h AND venues_as_of at 5.4h, and quoting the 1.7h
        // would be the same flattery as the file stamp, one level down.
        //
        // Scans one level deep plus exit_mark, because the producers name these
        // per-field (market_price_as_of, venues_as_of, volume_24h_as_of) rather
        // than with a block-level `as_of`. I have asked for one spelling; until
        // it lands, accepting the existing names beats rendering "undeclared"
        // over clocks that are plainly there.
        // ⚠️ The oldest-wins rule means a SUPPLEMENTAL field can set the whole
        // axis's age — see _renderAttachmentPoint for why that must not be
        // "fixed" by dropping the supplement. The stamp's field is named in the
        // tooltip precisely so a reader can tell a stale AXIS from one stale
        // input beside fresh ones.
        var stamp = null, oldest = -1, stampKey = null;
        function consider(v, key) {
            if (typeof v !== 'string') return;
            var t = new Date(v.endsWith('Z') || v.indexOf('+') > 0 ? v : v + 'Z');
            if (isNaN(t)) return;
            var age = Date.now() - t.getTime();
            if (age > oldest) { oldest = age; stamp = v; stampKey = key; }
        }
        var RX = /(as_of|generated_at|observed_at)$/;
        Object.keys(block).forEach(function(k) {
            if (RX.test(k)) consider(block[k], k);
            var v = block[k];
            if (v && typeof v === 'object' && !Array.isArray(v)) {
                Object.keys(v).forEach(function(k2) { if (RX.test(k2)) consider(v[k2], k + '.' + k2); });
            }
        });
        if (!stamp) {
            // A block with no clock is UNDECLARED, not fresh. Saying nothing
            // would let it inherit the header stamp by implication — the exact
            // thing this fixes — and would penalise the producers who do declare.
            return '<span class="axis-clock axis-clock-none" title="This block declares no as_of, so its age is unknown. It is NOT necessarily as fresh as the page header.">cadence undeclared</span>';
        }
        var t = new Date(stamp.endsWith('Z') || stamp.indexOf('+') > 0 ? stamp : stamp + 'Z');
        if (isNaN(t)) return '';
        var h = (Date.now() - t.getTime()) / 3600000;
        var txt = h < 1 ? Math.max(0, Math.round(h * 60)) + 'm' :
                  h < 48 ? h.toFixed(1) + 'h' : Math.round(h / 24) + 'd';
        // ⚠️ AN AGE WITHOUT AN EXPECTED CADENCE IS UNREADABLE. "6d old" means
        // nothing on its own: a reader cannot tell a producer that refreshes
        // daily and is five days late from one that was never on a schedule at
        // all. Axis 3 spent weeks in the second state and the page said only
        // "Nd old" — the number was right and the reader could not act on it.
        //
        // ⚠️ THE CADENCE IS THE PRODUCER'S TO DECLARE, NOT MINE TO ASSERT.
        // Hardcoding "daily" here would be a claim about another repo's crontab
        // that goes stale the moment they change it, and would keep reading
        // "daily" through an outage. Rendered only when the block declares it;
        // silent otherwise, so a producer that has not declared one is not
        // credited with a schedule it does not keep.
        var cadence = block.refresh_cadence || block.cadence_declared || null;
        var cadenceHtml = '';
        if (typeof cadence === 'string' && cadence) {
            cadenceHtml = '<span class="axis-clock" title="' + this._escapeAttr(
                'The producer declares this block refreshes ' + cadence + '. Compare it with the ' +
                'age beside it: an age well past the declared cadence means the producer is LATE, ' +
                'which is a different fact from an axis that was never scheduled.') +
                '">refreshes ' + this._escapeAttr(cadence) + '</span>';
        }
        return cadenceHtml + '<span class="axis-clock' + (h > 24 ? ' axis-clock-old' : '') +
            '" title="Oldest declared input on this axis: ' + this._escapeAttr(stampKey || 'as_of') +
            ' = ' + this._escapeAttr(stamp) +
            '. \u26a0\ufe0f The field is NAMED because the oldest stamp is not always an input \u2014 syzUSD retains coingecko_price_as_of for a mark it REJECTED, and that diagnostic is older than the price actually published. The page header shows when the FILE was assembled, which is not the same thing as any of these.">' +
            txt + ' old</span>';
    },

    // --- the four non-backing sections + backing head ---
    renderAxisSections(data, history) {
        var ids = ['section-peg', 'section-liquidity', 'section-dependencies',
                   'section-contract', 'section-issuer'];
        if (!this.hasAxisBlocks(data)) {
            // Legacy asset: keep the 4 sections hidden and the backing head empty.
            ids.forEach(function(id) { var s = document.getElementById(id); if (s) s.classList.add('hidden'); });
            var bh = document.getElementById('axis-backing-head'); if (bh) bh.innerHTML = '';
            return false;
        }
        ids.forEach(function(id) { var s = document.getElementById(id); if (s) s.classList.remove('hidden'); });

        // 1 · Peg
        this._renderAxisHead('peg', 1, 'Peg',
            // ⚠️ THE SUBTITLE NAMES WHAT THE NUMBER MEASURES. It was unlabelled while
            // the authored score beside it said "authored" — one side declared its
            // provenance and the other did not, so the live reading read as the verdict
            // and the judgement as a footnote.
            ('7d peg performance · ' + (data.peg.source ? 'market vs NAV · ' + data.peg.source : 'market vs NAV')),
            this._ratingChipHtml(this.pegRating(data, history), null,
                this.pegRatingBasisNote(data, history)) +
            this._divergenceChipHtml(this.pegRating(data, history),
                this._authoredAxisScore(data.peg, ['peg_mechanism_score', 'volatility_score'])), data.peg);
        this._renderPegSection(data, history);

        // ⚠️ 2 is BACKING and 3 is LIQUIDITY — swapped from the original frame.
        // The dashboard ran 1 Peg · 2 Liquidity · 3 Backing while the published
        // reports ran 2 Backing · 3 Liquidity, so "axis 2" meant two different
        // things depending which surface you were reading. Three of five
        // positions disagreed while everyone argued about the label at 5.
        //
        // 2 · Backing (head only — panels are rendered by the existing common path)
        // ⚠️ The head must label an authored score too. Fixing only the tile left
        // the axis head reading "Watch · 3/5" — a fallback rendered exactly like a
        // computed band, which is precisely the confusion the producer's gate
        // exists to prevent, reintroduced one element away from where it was
        // fixed.
        var bAuth = (data.backing || {});
        var backingAuthored = bAuth.collateral_ratio == null &&
            typeof bAuth.backing_score === 'number' &&
            bAuth.backing_score_applies_when === 'collateral_ratio_declared_underivable' &&
            bAuth.collateral_ratio_basis;
        this._renderAxisHead('backing', 2, 'Backing', 'live reserves & collateral ratio',
            (backingAuthored
                ? '<span class="axis-rating r-warn" title="' +
                  this._escapeAttr(String(bAuth.backing_score_basis || '')) +
                  '">Authored ' + bAuth.backing_score + '/10</span>'
                : this._ratingChipHtml(this.backingRating(data)) +
                  this._divergenceChipHtml(this.backingRating(data),
                      this._authoredAxisScore(data.backing, ['backing_score']))), data.backing);
        // ⚠️ collateral_ratio_basis was rendered ONLY as a hover tooltip on a ⓘ
        // glyph beside the tile. For most assets that is a reasonable place for
        // a definition. For syzUSD it is not: its basis says the headline
        // 109.02% is "INHERITED from yzUSD" — the number belongs to a DIFFERENT
        // ASSET — and a qualifier of that weight cannot live behind a hover,
        // which does not exist at all on a touch device.
        //
        // So it also renders as text under the Backing head, where the reader
        // meets it before the panels. Same string, same source block, no
        // heuristics about which basis "matters" — 23 of 25 feeds publish one
        // and every one of them is explaining a denominator a reader would
        // otherwise assume.
        var basisText = this._backingBasis(data);
        // The tile prints "surplus +$X" beside the ratio, and for three feeds the
        // surplus is NOT on the ratio's basis — apxUSD's is gross where the ratio
        // is netted, frax's is against liabilities where supply gives a different
        // sign, and USDS says outright "NOT total_backing - total_supply.
        // Subtracting the published totals gives +$23.2M against this figure."
        // A reader who tries to reconcile the two numbers cannot, and nothing on
        // the page said why. Published by 11 feeds, rendered by none.
        var sdBasis = this._surplusBasis(data);
        var backingHead = document.getElementById('axis-backing-head');
        if ((basisText || sdBasis) && backingHead) {
            if (basisText) {
                var bNote = document.createElement('div');
                bNote.className = 'axis-basis-note';
                bNote.textContent = 'Basis: ' + basisText;
                backingHead.appendChild(bNote);
            }
            if (sdBasis) {
                var sNote = document.createElement('div');
                sNote.className = 'axis-basis-note';
                sNote.textContent = 'Surplus basis: ' + sdBasis;
                backingHead.appendChild(sNote);
            }
        }
        // The authored-score rationale, reachable rather than hovered.
        (function(self) {
            var head = document.getElementById('axis-backing-head');
            var basis = (data.backing || {}).backing_score_basis;
            if (!head || !basis) return;
            var el = document.createElement('div');
            el.className = 'axis-basis-note';
            el.innerHTML = self._scoreBasisHtml('Why this backing score', basis);
            head.appendChild(el);
        })(this);

        // ⚠️ AXES 1 AND 3 LOST THEIR BASIS WHEN THE AUTHORED SCORE CAME OFF.
        //
        // Removing the divergence chip removed a NUMBER that read as a rival to
        // the live band — correct — but the producer's EXPLANATION lived in the
        // same chip and went with it. Measured after the change: axis 2 rendered
        // its basis (it has the block above), axis 1 rendered none at all, and
        // axis 3 only when an authored score filled an absent band.
        //
        // So the axis-basis rollout was writing axis-1 arguments that reached no
        // reader. This gives 1 and 3 what 2 and 5 already had.
        //
        // ⚠️ NO NUMBER ON THE FACE. This is a collapsed explanation, not a second
        // score — nothing to compare against the band, so it does not reopen the
        // divergence the owner closed. crvUSD's reads "MEASURES THE MECHANISM, NOT
        // THE CURRENT DEVIATION … PERSISTENCE-FILTERED", which is precisely why the
        // page and the report differ and was invisible until now.
        //
        // ⚠️ `*_per_chain` RIDES ALONG, and it is the sharper half on some assets:
        // yzUSD publishes "ethereum 4.5 · monad 3.5 — the rendered figure is the
        // Ethereum one", and a Monad holder had no way to learn their leg scores
        // worse. Rendered as the producer's own string; never recomputed here.
        (function(self) {
            [['axis-peg-head', data.peg, ['peg_mechanism_score', 'volatility_score'],
              'Why the report scores peg differently'],
             // ⚠️ LIQUIDITY IS NOT HANDLED HERE. This block runs BEFORE
             // _renderAxisHead('liquidity', …), so anything appended to that head
             // is overwritten moments later by the head render. The liquidity
             // equivalent lives after that call — see below. The peg half worked,
             // which is exactly why the broken half went unnoticed: a check that
             // ORs the two axes passes on peg alone.
            ].forEach(function(row) {
                var head = document.getElementById(row[0]);
                var blk = row[1] || {};
                if (!head) return;
                var basis = null, perChain = null;
                row[2].forEach(function(f) {
                    if (!basis && typeof blk[f + '_basis'] === 'string' && blk[f + '_basis'].trim()) {
                        basis = blk[f + '_basis'];
                    }
                    if (!perChain && typeof blk[f + '_per_chain'] === 'string' && blk[f + '_per_chain'].trim()) {
                        perChain = blk[f + '_per_chain'];
                    }
                });
                if (!basis && !perChain) return;
                var el = document.createElement('div');
                el.className = 'axis-basis-note';
                el.innerHTML =
                    (perChain
                        ? '<div class="text-xs text-amber-700 mb-1">' +
                          self._mdInlineHtml(perChain) + '</div>'
                        : '') +
                    (basis ? self._scoreBasisHtml(row[3], basis) : '');
                head.appendChild(el);
            });
        })(this);

        // ⚠️ THE FIRST-LOSS ATTACHMENT POINT, WHICH A COLLATERAL RATIO CANNOT SAY.
        // For a tranched asset the question is not "is there enough collateral"
        // but "how much loss lands on somebody else first". The dashboard cannot
        // compute it — it comes from the report — so it arrives as a backing
        // overlay and would otherwise sit in the payload unrendered, which is
        // this repo's most-repeated defect.
        //
        // ⚠️ IT MUST RENDER THE DIRECTION, NOT ONLY THE LEVEL. reUSD's cushion
        // thinned because the DENOMINATOR ROSE — senior deposits grew, no loss
        // occurred. So a supply chart beside this reads as demand and health
        // while the cushion erodes underneath it. The level alone would let a
        // reader draw exactly the wrong conclusion from the rest of the page.
        this._renderAttachmentPoint(data);

        // ⚠️ Issuer-reported reserves. Rendered because $136.9M sat in the payload
        // invisible while the axis read "Not rated" — but rendered CAREFULLY,
        // because the danger here is not omission, it is arithmetic the reader
        // does unprompted. See _renderIssuerReportedReserves.
        // ⚠️ HOW BIG IS IT. Both figures were published and rendered nowhere, so
        // the backing axis showed a "Not rated" chip, a basis note and no size
        // at all. Supply is the one number every other question scales against.
        this._renderClaimSize(data);
        this._renderIssuerReportedReserves(data);

        // Optional composition sub-panel (USDC held-vs-denominated split + per-Star
        // breakdown). Data-gated & additive: no-op for assets lacking the fields.
        this._renderBackingComposition(data);

        // 3 · Liquidity & Exit. Renamed from "Liquidity": the axis covers BOTH
        // exit paths — secondary venue depth AND primary redemption with the
        // issuer — and they fail independently. The rating is still computed
        // from depth alone, which is why the tile states its scope.
        this._renderAxisHead('liquidity', 3, 'Liquidity & Exit',
            'live venue depth & primary redemption',
            this._liquidityChipHtml(data), data.liquidity);
        this._renderDepthScope(data);
        this._renderLiquiditySection(data);

        // ⚠️ AFTER the head render, never before — see the note in the peg block.
        //
        // Carries three things the liquidity head had been missing:
        //  - the depth QUALIFIER and the SHARE, which lived in axis-liquidity-body
        //    until three bespoke renderers were found blanking that node
        //    (hastra-prime.js, thusd.js, usdai.js). On those assets the band was
        //    correctly WITHHELD and the reason for it was invisible, which is the
        //    worse half of the pair.
        //  - the liquidity BASIS, which was appended too early and overwritten.
        (function(self) {
            var lh = document.getElementById('axis-liquidity-head');
            if (!lh) return;
            var liq = (data && data.liquidity) || {};
            var parts = self._depthQualifierHtml(liq) + self._depthShareHtml(data);
            var basis = typeof liq.liquidity_score_basis === 'string' && liq.liquidity_score_basis.trim()
                ? liq.liquidity_score_basis : null;
            var perChain = typeof liq.liquidity_score_per_chain === 'string' && liq.liquidity_score_per_chain.trim()
                ? liq.liquidity_score_per_chain : null;
            if (perChain) {
                parts += '<div class="text-xs text-amber-700 mb-1">' + self._mdInlineHtml(perChain) + '</div>';
            }
            if (basis) {
                parts += self._scoreBasisHtml('Why the report scores liquidity differently', basis);
            }
            if (!parts) return;
            var el = document.createElement('div');
            el.className = 'axis-basis-note';
            el.innerHTML = parts;
            lh.appendChild(el);
        })(this);

        // 4 · Dependencies
        // ⚠️ An array's LENGTH is how many rows the producer sent, not how many
        // exist. A producer-side cap of 6 became the on-page claim "6 upstream"
        // when there were 13 — and the length looked authoritative precisely
        // because it was wrong. Prefer the declared count, and when the list is
        // knowingly partial say so rather than passing the cap off as the total.
        var dep = data.dependencies || {};
        var upRows = Array.isArray(dep.upstream) ? dep.upstream.length : 0;
        var upTotal = (typeof dep.upstream_count === 'number') ? dep.upstream_count : upRows;
        var upSub = (dep.upstream_complete === false || upTotal > upRows)
            ? 'top ' + upRows + ' of ' + upTotal + ' upstream'
            : upTotal + ' upstream';
        // Ordering is a claim too: thinnest-first reads as largest-first to
        // anyone who assumes size ordering, so name it when the producer does.
        if (dep.upstream_sorted_by) {
            upSub += ' (' + String(dep.upstream_sorted_by).replace(/_/g, ' ') + ')';
        }
        var downSub = (dep.downstream_tracked === true)
            ? (Array.isArray(dep.downstream) ? dep.downstream.length : 0) + ' downstream'
            : 'downstream not tracked';
        // ⚠️ AXIS 4 NOW CARRIES ITS AUTHORED SCORE. It was a link tile with no
        // number while the producer published `underlying_score` with a full basis
        // — counterparty concentration in the supply architecture, on a denominator
        // swept from the complete SetDebtCeiling history.
        //
        // ⚠️ This does NOT reopen the divergence problem the owner closed today.
        // That rule was "no authored score beside a LIVE one", because two numbers
        // measuring different things read as a contradiction. Axis 4 computes
        // nothing, so the authored score is the only number here — the same case as
        // axes 5 and 6, which is what the rule permits.
        //
        // ⚠️ Labelled "Dependencies", not "Underlying". Axis 5 labels from its field
        // (`structural_score` -> "Structural") but `underlying_score` -> "Underlying"
        // tells a reader nothing. The axis name is the honest label and matches
        // axis 6's "Issuer".
        var depChip = this.authoredScoreChipHtml(data.dependencies, ['underlying_score'], 'Dependencies');
        this._renderAxisHead('dependencies', 4, 'Dependencies', upSub + ' \u00b7 ' + downSub, depChip, data.dependencies);
        this._renderDependenciesSection(data);

        // 5 · Contract & Admin — MEASURED. Split from Issuer because they fail
        // independently and the evidence is of different kinds. USDat is the
        // live case: 4-of-6 behind a 72h delay at token level, while a 3-of-6
        // with NO timelock owns the CCIP pools. One score over both hides that.
        //
        // ⚠️ It renders UNRATED for now, and the reason is stated on the page.
        // contract_score does not exist for any asset — 0 of 146 in the risk
        // feed. It exists only at PROTOCOL level, where it means smart-contract
        // SECURITY (audit quality), which is a different measurement: a protocol
        // scoring 9.0 on audits can still hold a bare EOA upgrade key, which is
        // exactly what this axis is for. An unexplained blank is
        // indistinguishable from an oversight, so it must never be silent.
        // ⚠️ The score is the AUTHORITY half's, not the code half's, and the
        // producer's basis says so outright: "audits do not offset an authority
        // path. The number is set by the authority half." Rendering it without
        // that basis would be the halo this axis exists to catch.
        var cScore = (data.contract || {}).structural_score;
        this._renderAxisHead('contract', 5, 'Contract & Admin',
            'admin authority, delay, upgrade & pause surface',
            (typeof cScore === 'number'
                ? '<span class="axis-rating r-warn" title="' + this._escapeAttr(
                      this._mdPlain(String((data.contract || {}).structural_score_basis || ''))) + '">Structural ' +
                  cScore + '/10</span>'
                : this._ratingChipHtml(null)),
            data.contract || (data.asset_specific || {}).control || (data.asset_specific || {}).governance);
        (function(self) {
            var head = document.getElementById('axis-contract-head');
            var basis = (data.contract || {}).structural_score_basis;
            if (!head || !basis) return;
            var el = document.createElement('div');
            el.className = 'axis-basis-note';
            el.innerHTML = self._scoreBasisHtml('Why this contract score', basis);
            head.appendChild(el);
        })(this);
        this._renderContractSection(data);

        // 6 · Editorial axis (issuer, structural, or a future per-asset label)
        var issuerInfo = this._issuerAxisInfo(data.issuer || {});
        this._renderAxisHead('issuer', 6, this._escapeAttr(issuerInfo.label), 'editorial — subjective axis', '',
            { as_of: (data.issuer || {}).issuer_score_generated_at ||
                     (data.issuer || {}).structural_score_generated_at });
        this._renderIssuerSection(data);
        return true;
    },

    // ------ Backing composition sub-panel (data-gated, additive) ------
    // Renders into #backing-extra-panels ONLY when the analyzer emits the
    // composition fields (backing.usdc_raw_held / usdc_denominated and/or
    // backing.stars[]). For every other asset the slot is cleared, so this is a
    // pure no-op that cannot regress a page lacking the fields. Same safe/additive,
    // gated-on-data pattern as the syrup credit-vault primitives (liquidityRating
    // band_score, free_liquidity_pct, backingRating cr_pct).
    // ⚠️ backing.alternatives and backing.volatile_bucket — a SCHEMA-LEVEL
    // convention, published and unread. The point of `alternatives` is that the
    // rated headline is one of several legitimate readings, so publishing the
    // headline alone reproduces exactly the ambiguity the field exists to close.
    // usdm carries it today; usg, apxusd and susdat have the same shape.
    //
    // Deliberately key-agnostic. The producer renamed drawdown_to_gross_100_pct
    // to drawdown_to_par_pct between two copies of the same file, so anything
    // that hardcoded a key would have silently stopped rendering. Any *_pct is
    // shown as a percent, any *_usd as currency, note as prose, *_basis as a
    // tooltip on its sibling.
    _humanizeKey(k) {
        return String(k).replace(/_pct$|_usd$/, '').replace(/_/g, ' ')
            .replace(/\bpct\b/g, '%');
    },

    _renderAlternativesHtml(b) {
        var alt = b.alternatives;
        var vol = b.volatile_bucket;
        if ((!alt || typeof alt !== 'object') && (!vol || typeof vol !== 'object')) return '';
        var self = this;

        function rowsFor(obj) {
            return Object.keys(obj).filter(function (k) {
                return k !== 'note' && !/_basis$/.test(k) && typeof obj[k] === 'number';
            }).map(function (k) {
                var v = obj[k];
                // Explicit about what it can format. An unrecognised key renders
                // its bare number rather than being silently given a unit.
                var val = /_usd$/.test(k) ? self.formatCurrencyExact(v)
                        : /_pct$/.test(k) ? self.formatPercent(v, 2)
                        : String(v) + ' <span class="text-slate-400 text-xs">(unit not declared)</span>';
                var basis = obj[k.replace(/_pct$|_usd$/, '') + '_basis'] || obj[k + '_basis'];
                return '<tr>' +
                    '<td class="text-slate-600 dark:text-slate-300">' + self._escapeAttr(self._humanizeKey(k)) + '</td>' +
                    '<td class="text-right font-mono"' + (basis ? ' title="' + self._escapeAttr(basis) + '"' : '') +
                        '>' + val + (basis ? ' \u24d8' : '') + '</td>' +
                '</tr>';
            }).join('');
        }

        var head = '';
        if (vol && typeof vol === 'object') {
            // The drawdown figure is the one number here that does not depend on
            // choosing a mark, so it leads.
            var ddKey = Object.keys(vol).filter(function (k) { return /^drawdown_/.test(k) && /_pct$/.test(k); })[0];
            var dd = ddKey ? vol[ddKey] : null;
            head = '<div class="text-sm text-slate-700 dark:text-slate-200 mb-2">' +
                (dd != null ? '<span class="font-semibold">Par survives a ' + this.formatPercent(dd, 1) +
                    ' drawdown</span> in the volatile bucket' : 'Volatile bucket') +
                (vol.pct_of_reserve != null ? ', which is <span class="font-mono">' +
                    this.formatPercent(vol.pct_of_reserve, 1) + '</span> of the reserve' : '') +
                (vol.composition ? ' \u2014 ' + this._escapeAttr(vol.composition) : '') + '.' +
            '</div>';
        }

        // Table carries the ALTERNATIVE RATIOS only. The volatile bucket is
        // already stated in the sentence above, and putting its fields through
        // the same formatter produced "usd = 4862481.42" and "% of reserve =
        // 24.09" — my suffix heuristic reads _usd/_pct endings and these are
        // named `usd` and `pct_of_reserve`. Rather than widen a unit guess based
        // on key names (the thing this repo keeps getting wrong), scope the table
        // to the block that is actually a list of ratios.
        var body = alt ? rowsFor(alt) : '';
        var notes = [alt && alt.note, vol && vol.note].filter(Boolean).map(function (n) {
            return '<div class="text-xs text-slate-500 mt-2">' + self._escapeAttr(n) + '</div>';
        }).join('');

        return '<div class="panel">' +
            '<div class="panel-title">Other readings of this ratio</div>' +
            '<p class="text-sm text-slate-500 mb-3">The rated figure is one of several defensible ' +
                'denominators. These are published so it can be audited against the ones not chosen.</p>' +
            head +
            (body ? '<div class="data-table-scroll"><table class="data-table"><tbody>' + body + '</tbody></table></div>' : '') +
            notes +
        '</div>';
    },

    _renderBackingComposition(data) {
        var slot = document.getElementById('backing-extra-panels');
        if (!slot) return;
        var b = data.backing || {};
        var altHtml = this._renderAlternativesHtml(b);
        var raw = b.usdc_raw_held, den = b.usdc_denominated;
        var hasUsdcSplit = (raw && raw.value != null) || (den && den.value != null);
        var stars = Array.isArray(b.stars) ? b.stars : [];
        if (!hasUsdcSplit && !stars.length) { slot.innerHTML = altHtml; return; }

        var fmt = this.formatCurrencyExact.bind(this);
        var pct1 = function(v) { return v != null ? CommonRenderer.formatPercent(v, 1) : '—'; };
        // Compact $ for the star cards (billions read cleanly in a narrow card).
        var fmtBig = function(v) {
            if (v == null) return '—';
            if (Math.abs(v) >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
            return CommonRenderer.formatCurrency(v);
        };
        var esc = function(s) {
            return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        };
        // Trust chip: on-chain / trustless → green; attested / off-chain source → amber.
        var trustChip = function(trust, source, labelOverride) {
            var t = String(trust || '').toLowerCase();
            var s = String(source || '').toLowerCase();
            var onchain = t === 'trustless' || t === 'onchain' || s === 'onchain';
            var cls = onchain ? 'r-ok' : 'r-warn';
            var txt = labelOverride || (onchain ? 'on-chain' : 'attested');
            return '<span class="axis-rating ' + cls + '">' + esc(txt) + '</span>';
        };
        var palette = ['#6366f1', '#3b82f6', '#14b8a6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#84cc16'];

        var html = '';

        // ---- Dual-USDC row: held (raw) vs denominated ----
        if (hasUsdcSplit) {
            var usdcTile = function(obj, label, badgeText) {
                if (!obj || obj.value == null) return '';
                return '<div class="dep-card">' +
                    '<div class="flex items-center justify-between mb-1 gap-2">' +
                        '<div class="card-label">' + esc(label) + '</div>' +
                        trustChip(obj.trust, obj.source, badgeText) +
                    '</div>' +
                    '<div class="card-value">' + fmt(obj.value) + '</div>' +
                    '<div class="text-xs text-slate-400 mt-1">' + pct1(obj.pct) + ' of supply · source: ' + esc(obj.source || '—') + '</div>' +
                    (obj.note ? '<div class="text-xs text-slate-400 mt-1">' + esc(obj.note) + '</div>' : '') +
                '</div>';
            };
            html +=
                '<div class="panel">' +
                    '<div class="panel-title">USDC exposure — held vs denominated</div>' +
                    '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">' +
                        usdcTile(raw, 'USDC held (raw)', 'on-chain') +
                        usdcTile(den, 'USDC-denominated exposure', 'attested · denominated, not held') +
                    '</div>' +
                    '<p class="text-xs text-slate-400 mt-3">Raw = actual USDC held on-chain (trustless). Denominated = USDC-settled instruments (T-bills / CLO / OTC lending) attested by BlockAnalitica — denominated in USDC but not held as USDC.</p>' +
                '</div>';
        }

        // ---- Per-Star composition cards ----
        if (stars.length) {
            var recon = b.reconciliation || {};
            var driftByStar = {};
            (Array.isArray(recon.star_drift) ? recon.star_drift : []).forEach(function(d) {
                if (d && d.star) driftByStar[d.star] = d;
            });

            var cards = stars.map(function(st) {
                var trust = st.trust || {};
                var sizeChip = trustChip(trust.size, st.size_source, null);
                var mix = Array.isArray(st.mix) ? st.mix : [];
                var mixHtml = '';
                if (mix.length) {
                    mixHtml = '<div class="mt-3">' + mix.map(function(m, i) {
                        var color = palette[i % palette.length];
                        var w = Math.max(0, Math.min(100, m.pct || 0));
                        return '<div class="flex items-center justify-between text-xs mb-0.5">' +
                                '<span>' + esc(m.category) + '</span>' +
                                '<span class="font-mono text-slate-500">' + pct1(m.pct) + '</span>' +
                            '</div>' +
                            '<div class="pct-bar-container mb-1.5"><div class="pct-bar" style="width:' + w + '%; background:' + color + '"></div></div>';
                    }).join('') + '</div>';
                    mixHtml += '<div class="text-[11px] text-slate-400 mt-1">mix source: ' + esc(st.mix_source || (trust.mix || 'aggregate')) + '</div>';
                } else {
                    mixHtml = '<div class="text-[11px] text-slate-400 mt-3">Per-star asset mix not itemised in this snapshot (aggregate-only).</div>';
                }
                // Surface a size-drift caveat where BA-backed and on-chain size disagree.
                var drift = driftByStar[st.star];
                var driftHtml = '';
                if (drift && drift.status && String(drift.status).toUpperCase() === 'WARN' && drift.drift_pct != null) {
                    driftHtml = '<div class="text-[11px] text-amber-600 mt-1" title="On-chain allocator debt vs BlockAnalitica backed value">' +
                        'size drift vs attested: ' + CommonRenderer.formatPercent(drift.drift_pct, 1) + '</div>';
                }
                var vaultHtml = st.allocator_vault
                    ? '<div class="text-[11px] font-mono text-slate-400 mt-1" title="Allocator vault">' + esc(st.allocator_vault.slice(0, 6) + '…' + st.allocator_vault.slice(-4)) + '</div>'
                    : '';
                return '<div class="dep-card">' +
                    '<div class="flex items-center justify-between mb-1 gap-2">' +
                        '<div class="dep-card-name">' + esc(st.label || st.star) + '</div>' +
                        sizeChip +
                    '</div>' +
                    '<div class="card-value" style="font-size:1.25rem">' + fmtBig(st.size_usd) + '</div>' +
                    '<div class="text-xs text-slate-400 mt-0.5">' + pct1(st.size_pct) + ' of supply · size: ' + esc(st.size_source || '—') + '</div>' +
                    driftHtml +
                    vaultHtml +
                    mixHtml +
                '</div>';
            }).join('');

            html +=
                '<div class="panel">' +
                    '<div class="panel-title">Per-Star composition</div>' +
                    '<div class="dep-grid">' + cards + '</div>' +
                '</div>';
        }

        slot.innerHTML = html;
    },

    _renderPegSection(data, history) {
        var body = document.getElementById('axis-peg-body');
        if (!body) return;
        var peg = data.peg || {};
        var pct = peg.premium_discount_pct;
        var st = this.pegStatusClass(pct);
        var pctCls = this.pegPctClass(st);
        var mkt = peg.market_price, nav = peg.nav;
        var fmtP = function(v) { return v != null ? v.toFixed(4) : '—'; };

        var metricRow =
            '<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">' +
                '<div><div class="text-xs text-slate-400 font-medium uppercase">Market price</div>' +
                    '<div class="text-lg font-bold font-mono">' + fmtP(mkt) + '</div>' +
                    // ⚠️ A peg mark with no timestamp cannot be told from a stale
                    // one, and syzUSD proved the cost: a 30.2-hour-old CoinGecko
                    // price divided by a live accruing NAV rendered −2.84% and
                    // rated the axis Stress 1/5, against a true −0.25%. The
                    // producer now publishes market_price_as_of / _age_hours /
                    // _source, so the age travels WITH the number instead of
                    // being a thing a reader has to assume.
                    // ⚠️ AGE IS COMPUTED FROM `market_price_as_of`, NOT read from a
                    // published `market_price_age_hours`. A stored age is stale by
                    // construction — this fleet already published
                    // `price_age_hours: 0.012` identically across four unrelated
                    // assets, because it was the age of the RUN rather than of the
                    // mark, which made a downstream freshness guard unable to fire.
                    //
                    // pegtracker-f9 kept the stored field alive behind a named
                    // exemption solely because this line read it. This removes the
                    // reason, so the field can go.
                    (function () {
                        var srcTxt = peg.market_price_source
                            ? CommonRenderer._escapeAttr(String(peg.market_price_source).replace(/^peg_tracker:/, ''))
                            : (peg.market_price_as_of ? 'source not named' : null);
                        var h = null;
                        if (peg.market_price_as_of) {
                            var t = new Date(peg.market_price_as_of.endsWith('Z') ||
                                             peg.market_price_as_of.indexOf('+') > 0
                                             ? peg.market_price_as_of : peg.market_price_as_of + 'Z');
                            if (!isNaN(t)) h = (Date.now() - t.getTime()) / 3600000;
                        }
                        if (srcTxt == null && h == null) return '';
                        var ageTxt = h == null ? '' :
                            ' · ' + (h < 1 ? Math.max(0, Math.round(h * 60)) + 'm old'
                                           : h.toFixed(1) + 'h old');
                        return '<div class="text-[11px] mt-0.5 ' +
                            (h != null && h > 6 ? 'text-amber-700 font-semibold' : 'text-slate-400') + '"' +
                            (peg.market_price_as_of
                                ? ' title="as of ' + CommonRenderer._escapeAttr(peg.market_price_as_of) + '"'
                                : ' title="No market_price_as_of is published, so the age of this mark is unknown."') +
                            '>' + (srcTxt || 'source not named') + ageTxt + '</div>';
                    })() +
                '</div>' +
                '<div><div class="text-xs text-slate-400 font-medium uppercase">NAV / theoretical</div>' +
                    '<div class="text-lg font-bold font-mono">' + fmtP(nav) + '</div>' +
                    // ⚠️ syzUSD is rated Stress 1/5 on a −2.84% deviation measured
                    // against "the on-chain ERC-4626 NAV (a redemption value, not
                    // a peg)" — its own words, published in nav_basis and shown
                    // nowhere. A discount to a redemption value on a yield-bearing
                    // vault is not the same claim as a stablecoin off its peg, and
                    // the tile said the second while the feed said the first.
                    (peg.nav_basis
                        ? '<div class="text-[11px] text-slate-400 mt-0.5" style="line-height:1.35;">vs ' +
                          this._escapeAttr(peg.nav_basis) + '</div>' : '') +
                    // ⚠️ WHO WRITES THE NAV, RENDERED BESIDE THE NAV. A
                    // discount-to-NAV is only as trustworthy as the number in the
                    // denominator, and on an issuer-written NAV that denominator
                    // is a claim rather than a measurement. This must sit next to
                    // the figure it qualifies — behind a tooltip or one section
                    // down, it qualifies nothing.
                    //
                    // ⚠️ CROSS-BLOCK READ, DELIBERATE. The field lives in the
                    // BACKING overlay because its evidence is a contract audit,
                    // but the number it describes is on the PEG tile. Rendering
                    // it where its producer files it would put the warning on a
                    // panel that does not show the NAV.
                '</div>' +
                '<div><div class="text-xs text-slate-400 font-medium uppercase">Premium / discount</div>' +
                    '<div class="text-lg font-bold font-mono ' + pctCls + '">' + this.pegPctText(pct, 3) + '</div></div>' +
                '<div><div class="text-xs text-slate-400 font-medium uppercase">Status</div>' +
                    '<div class="text-lg font-bold ' + pctCls + '">' + this.pegStatusLabel(st) + '</div></div>' +
            '</div>' +
            // Below the stat row, not inside the NAV cell: in the cell it renders
            // as a ~20-character column and a warning nobody finishes reading is
            // not a warning. Still directly beneath the figure it qualifies.
            this._navWritePathHtml(data);

        // peg.history_ref may name a file OTHER than the backing history that was
        // passed in — the per-asset {slug}_peg_history.json exports do exactly
        // that. Until now history_ref was never fetched: this read only the
        // backing history, so crvusd (0 peg fields in 692 rows) and usds rendered
        // "Peg history not tracked" while a populated export sat unread beside
        // them. Declaring a source is not the same as reading it.
        var pegRef = peg.history_ref;
        var usesOwnFile = !!(pegRef && !/_backing_history\.json$/.test(pegRef));
        var hasHist = usesOwnFile || (history && Array.isArray(history.entries) &&
            history.entries.some(function(e) { return e[peg.history_field] != null; }));
        var chartBlock = hasHist
            ? '<div class="chart-container"><canvas id="peg-chart"></canvas></div>'
            : '<div class="text-sm text-slate-400">Peg history not tracked for this asset.</div>';

        // The producer's own reading of the deviation. For yzUSD: "24h volume is
        // $24.74 — a deviation struck on this little turnover is weak evidence
        // about fair value and strong evidence about exit cost." That is the
        // interpretation of the number directly above it, and it was published
        // and unrendered.
        var pegNote = peg.note
            ? '<div class="text-xs text-slate-500 mt-3" style="line-height:1.5;">' +
              this._escapeAttr(peg.note) + '</div>'
            : '';

        body.innerHTML =
            '<div class="panel">' +
                '<div class="panel-title">Peg Performance</div>' +
                metricRow +
                pegNote +
                chartBlock +
            '</div>';

        if (hasHist) {
            if (usesOwnFile) {
                var self = this;
                var nc = Math.floor(Date.now() / 60000);
                fetch('data/' + pegRef + '?nocache=' + nc)
                    .then(function(r) { return r.ok ? r.json() : null; })
                    .then(function(h) {
                        if (h && Array.isArray(h.entries)) self._renderPegChart(data, h);
                        else self._pegChartUnavailable(pegRef);
                    })
                    .catch(function() { self._pegChartUnavailable(pegRef); });
            } else {
                this._renderPegChart(data, history);
            }
        }
    },

    _pegChartUnavailable(ref) {
        var ctx = document.getElementById('peg-chart');
        if (ctx && ctx.parentElement) {
            ctx.parentElement.innerHTML =
                '<div class="text-sm text-slate-400">Peg history unavailable (' +
                String(ref).replace(/[<>&]/g, '') + ').</div>';
        }
    },

    _renderPegChart(data, history) {
        var ctx = document.getElementById('peg-chart');
        if (!ctx) return;
        var field = data.peg.history_field || 'peg_market_price';
        var nav = data.peg.nav != null ? data.peg.nav : 1.0;
        var entries = history.entries.filter(function(e) { return e[field] != null; });
        var labels = entries.map(function(e) { return new Date(e.timestamp.endsWith('Z') ? e.timestamp : e.timestamp + 'Z'); });
        var series = entries.map(function(e) { return e[field]; });

        // ⚠️ THE REFERENCE LINE WAS TODAY'S NAV DRAWN FLAT ACROSS ALL HISTORY.
        //
        // Correct for a $1 par target. Wrong for an accruing share, where every
        // historical point gets compared against a NAV that had not accrued
        // yet — so the whole series sits under the line and reads as a
        // persistent discount, with the error zero at the right edge and growing
        // backwards. sUSDe's left edge read −1.09% on a day it was AT its NAV;
        // the gap drawn was three months of yield.
        //
        // Three cases, resolved by what the data can actually support:
        //   per-row theoretical  -> plot it as a real second line, no annotation
        //   percent-scale field  -> the reference is ZERO, not a price
        //   par target (nav = 1) -> the flat line is right, keep it
        //   otherwise            -> draw NO reference and say why
        //
        // The last one matters: sUSDe is the asset that motivated this and it has
        // NO per-row theoretical in 2,159 rows, so the fix that works for apyUSD
        // cannot work for it. A wrong reference line is worse than none.
        var theoSeries = entries.map(function(e) { return e.peg_theoretical_price; });
        var theoCount = theoSeries.filter(function(v) { return v != null; }).length;
        var theoDistinct = {};
        theoSeries.forEach(function(v) { if (v != null) theoDistinct[v] = 1; });
        var hasTheo = theoCount >= entries.length * 0.9 && Object.keys(theoDistinct).length > 1;

        // The `_pct` suffix is the producer's own naming of the field, not a unit
        // inferred from a value — but bound it anyway, so a mis-named price field
        // cannot silently move the reference to zero.
        var isPct = /_pct$/.test(field) && series.every(function(v) {
            return typeof v === 'number' && Math.abs(v) <= 50;
        });
        // ⚠️ sUSDS plots `field: nav` — the SERIES IS the NAV curve, so a marker at
        // today's value is a legitimate "you are here" on its own line, not a
        // false reference. riskAnalyst named it explicitly so a sweep would not
        // "fix" it into something worse, and the first cut of this did exactly
        // that: stripped its marker and captioned it as unreferenced.
        var isSelfNav = /^(nav|nav_per_share|peg_theoretical_price)$/.test(field);
        var isPar = !isPct && !hasTheo && !isSelfNav && Math.abs(nav - 1) < 1e-9;
        var noReference = !isPct && !hasTheo && !isPar && !isSelfNav;

        if (window._pegChart) window._pegChart.destroy();
        window._pegChart = new Chart(ctx, {
            type: 'line',
            data: { labels: labels, datasets: [{
                label: isPct ? 'Deviation' : (isSelfNav ? 'NAV' : 'Market price'),
                data: series,
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.08)',
                fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2
            }].concat(hasTheo ? [{
                label: 'NAV / theoretical',
                data: theoSeries,
                borderColor: '#94a3b8',
                borderDash: [4, 4],
                fill: false, tension: 0.3, pointRadius: 0, borderWidth: 1.5
            }] : []) },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    x: { type: 'time', time: { unit: 'day', displayFormats: { day: 'MMM d' } },
                         grid: { display: false }, ticks: { maxTicksLimit: 8, font: { size: 11 } } },
                    y: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 11 },
                         callback: function(v) { return v.toFixed(3); } } }
                },
                plugins: {
                    legend: { display: hasTheo },
                    tooltip: { callbacks: { label: function(c) {
                        var v = c.raw;
                        if (v == null) return '';
                        return (c.dataset.label || '') + ': ' +
                               (isPct ? v.toFixed(3) + '%' : v.toFixed(4));
                    } } },
                    annotation: { annotations: (isPct
                        ? { par: { type: 'line', yMin: 0, yMax: 0, borderColor: '#94a3b8',
                                   borderWidth: 1, borderDash: [4, 4],
                                   label: { content: '0% \u2014 at NAV', display: true, position: 'start',
                                            font: { size: 9 }, color: '#64748b' } } }
                        : (isPar
                            ? { par: { type: 'line', yMin: 1, yMax: 1, borderColor: '#94a3b8',
                                       borderWidth: 1, borderDash: [4, 4],
                                       label: { content: 'Par 1.00', display: true, position: 'start',
                                                font: { size: 9 }, color: '#64748b' } } }
                            : (isSelfNav
                                ? { par: { type: 'line', yMin: nav, yMax: nav, borderColor: '#94a3b8',
                                           borderWidth: 1, borderDash: [4, 4],
                                           label: { content: 'Today ' + nav.toFixed(4), display: true,
                                                    position: 'end', font: { size: 9 }, color: '#64748b' } } }
                                : {}))) }
                },
                interaction: { intersect: false, mode: 'index' }
            }
        });

        // When no reference can be drawn honestly, say so rather than leaving a
        // bare series a reader will mentally compare against par.
        var holder = ctx.parentNode;
        if (holder) {
            var prev = holder.parentNode && holder.parentNode.querySelector('.peg-chart-note');
            if (prev) prev.remove();
            if (noReference) {
                var n = document.createElement('div');
                n.className = 'peg-chart-note text-xs text-slate-500 mt-2';
                n.style.lineHeight = '1.45';
                n.textContent = 'No NAV reference drawn: this asset\'s NAV accrues (today ' +
                    nav.toFixed(4) + ') and the history carries no per-row theoretical, so a flat ' +
                    'line at today\'s value would read as a discount that never happened. ' +
                    'Compare points to each other, not to a level.';
                holder.parentNode.insertBefore(n, holder.nextSibling);
            }
        }
    },

    // ⚠️ SHARED SO A BESPOKE PAGE CANNOT SILENTLY LOSE THE LADDER — OR RE-ACQUIRE
    // A BUG THIS ONE HAS ALREADY FIXED. hastra-prime renders its own axis-3 panel
    // and clears `axis-liquidity-body`, so everything below was unreachable on it:
    // 13 measured rungs, including the collapse from -10.0bps at $5M to -857bps at
    // $6M and -6088bps at $14M. Its own copy calls that "a hard inventory wall, not
    // a slippage curve" — the rungs ARE the evidence for the claim, and the page
    // made the claim without them.
    //
    // Copying the markup instead would have re-introduced the signed-vs-magnitude
    // colouring defect on a fresh page the same week it was fixed here.
    //
    // Returns '' when the feed carries no ladder; the caller owns the empty state.
    ladderBlockHtml(liq) {
        liq = liq || {};
        var em = liq.exit_mark || {};
        var quotes = em.quotes || {};

        // Headline exit mark = the KyberSwap RFQ ladder (As-built #2). Lead with it.
        var sizes = Object.keys(quotes).map(Number).filter(function(n) { return !isNaN(n); }).sort(function(a, b) { return a - b; });

        // ⚠️ A BISECTED LADDER ROUNDS TWO DISTINCT RUNGS ONTO ONE LABEL. USG's
        // bracket rungs are $677,124 and $677,139 at −199.994 and −200.010 bps:
        // formatted at the table's usual precision they print as two identical
        // rows, "$677.1K / −200.0 bps", one amber and one red. A reader sees a
        // duplicated row with inconsistent colouring — which reads as a bug and
        // hides the one thing those rows exist to show, the 2% crossing falling
        // between them. Precision widens only when the rounding is what collided.
        var qOf = function(sz) { return quotes['' + sz] || quotes[sz] || {}; };

        // Smallest precision at which no two rungs share a label. Escalating once
        // is not enough: reusde-re's bracket rungs are $15,461.12 and $15,461.35
        // at -199.9984 and -200.0008 bps, which still collide at two decimals.
        function firstDistinct(decs, label) {
            for (var i = 0; i < decs.length; i++) {
                var seenL = {}, clash = false;
                for (var j = 0; j < sizes.length; j++) {
                    var k = label(sizes[j], decs[i]);
                    if (k == null) continue;
                    if (seenL[k]) { clash = true; break; }
                    seenL[k] = true;
                }
                if (!clash) return decs[i];
            }
            return decs[decs.length - 1];
        }
        function money(n, dec) {
            return '$' + n.toLocaleString('en-US',
                { minimumFractionDigits: dec, maximumFractionDigits: dec });
        }
        // -1 is the table's usual compact form ($1.0K / $1.0M); it is kept
        // wherever it is unambiguous, because whole-dollar sizes are harder to
        // scan down a column.
        var sizeDec = firstDistinct([-1, 0, 2], function(sz, dec) {
            return dec === -1 ? CommonRenderer.formatCurrency(sz) : money(sz, dec);
        });
        var sizeLabel = function(sz) {
            return sizeDec === -1 ? CommonRenderer.formatCurrency(sz) : money(sz, sizeDec);
        };

        // ⚠️ Not "any duplicate bps" — usdm's ladder is genuinely flat at every
        // rung and more decimals there add noise without adding a distinction.
        // Only a collision that STRADDLES the 2% colour boundary is one where
        // the displayed number contradicts the colour beside it.
        function bpsClass(bps) {
            if (bps == null) return null;
            var m = Math.abs(bps);
            return m <= 25 ? 'g' : (m <= 200 ? 'a' : 'r');
        }
        function bpsCollidesAcrossColour(dec) {
            var byLabel = {};
            for (var i = 0; i < sizes.length; i++) {
                var bps = qOf(sizes[i]).slippage_bps;
                if (typeof bps !== 'number') continue;
                var k = bps.toFixed(dec);
                if (byLabel[k] && byLabel[k] !== bpsClass(bps)) return true;
                byLabel[k] = bpsClass(bps);
            }
            return false;
        }
        var bpsDigits = 1;
        while (bpsDigits < 4 && bpsCollidesAcrossColour(bpsDigits)) bpsDigits++;

        var ladderRows = sizes.map(function(sz) {
            var q = quotes['' + sz] || quotes[sz] || {};
            var bps = q.slippage_bps;
            // ⚠️ A FAILED QUOTE RENDERED IDENTICALLY TO AN UNATTEMPTED ONE.
            //
            // The producer publishes {"error": "http_530"} for a size whose RFQ
            // did not return, and `error` was never read — so the row printed
            // "— —", indistinguishable from a size nobody asked about, and from
            // a reader's point of view indistinguishable from nothing to report.
            //
            // ⚠️ On crvUSD it is the $10M rung, sitting exactly at the inflection:
            // 5M quotes at -2.3 bps and 25M at -606.9 bps. The blank hides that the
            // measurement FAILED at the one size where the ladder turns, and a
            // reader scanning down sees smooth, blank, catastrophic.
            //
            // A failed read is not an absence — the distinction this estate has
            // had to relearn repeatedly. It now says so, in the cell, in amber.
            if (q.error) {
                // ⚠️ AND SAY WHEN IT CANNOT BE A DEPTH LIMIT, because the blank
                // invited exactly that reading and I made it myself: I described
                // crvUSD's failed $10M rung as landing "at the inflection", which
                // read meaning into noise. In 6 of the 9 failures across the
                // estate a LARGER size quoted successfully in the same run —
                // crvUSD failed at $10M while $50M returned; susDS failed at $10K.
                // A quote that fails while a bigger one succeeds cannot mean depth
                // ran out, and the row should tell a reader that rather than leave
                // them to notice it.
                var biggerOk = sizes.some(function(other) {
                    var oq = quotes['' + other] || quotes[other] || {};
                    return other > sz && !oq.error && oq.slippage_bps != null;
                });
                return '<tr>' +
                    '<td class="font-mono">' + sizeLabel(sz) + '</td>' +
                    '<td class="text-right font-mono text-amber-600" title="' +
                        CommonRenderer._escapeAttr('The quote for this size FAILED (' +
                        String(q.error) + '). This is an unsuccessful measurement, not a ' +
                        'measurement of zero and not a size that was skipped — nothing is ' +
                        'established about depth at this level.' +
                        (biggerOk
                            ? ' \u26a0\ufe0f A LARGER size quoted successfully in the same ' +
                              'run, so this failure CANNOT mean depth ran out — it is a ' +
                              'failed request, not a liquidity finding.'
                            : '')) +
                        '">\u26a0\ufe0f quote failed</td>' +
                    '<td class="text-right font-mono text-slate-400">' +
                        (biggerOk ? 'request failed' : 'not measured') + '</td>' +
                '</tr>';
            }
            // ⚠️ THE LADDER WAS COLOURED BY SIGNED VALUE, AND HALF THE ESTATE
            // PUBLISHES COST AS NEGATIVE. `bps <= 25` is true for EVERY negative
            // rung, so the worst reading on the page rendered green: crvUSD's $50M
            // rung showed −4197.4 bps — $50M in, $29.0M out, a 42% haircut — in the
            // same colour as a 0.0 bps fill. Live on crvusd, hastra-prime (−6262),
            // syzusd (−5265), yzusd (−4007) and usde (−427).
            //
            // ⚠️ This is the SAME defect the depth qualifier above documents:
            // "usde published $5M while quoting that same rung at −1490bps, because
            // one comparison read a signed cost as though it were a magnitude." It
            // was fixed there and left standing here. Sign carries the convention,
            // MAGNITUDE carries the cost — grade on magnitude, always.
            var mag = bps == null ? null : Math.abs(bps);
            var cls = mag == null ? '' : (mag <= 25 ? 'text-green-600' : (mag <= 200 ? 'text-amber-600' : 'text-red-600'));
            return '<tr>' +
                '<td class="font-mono">' + sizeLabel(sz) + '</td>' +
                '<td class="text-right font-mono ' + cls + '">' + (bps != null ? bps.toFixed(bpsDigits) + ' bps' : '—') + '</td>' +
                '<td class="text-right font-mono">' + (q.output_usd != null ? CommonRenderer.formatCurrencyExact(q.output_usd) : '—') + '</td>' +
            '</tr>';
        }).join('');

        // ⚠️ "RFQ" WAS A DEFAULT, NOT A READ FIELD. The As-built #2 ladder was a
        // KyberSwap RFQ, so the fallback named one; the liquidity/1 ladders are
        // Curve get_dy eth_calls, and labelling an on-chain quote "RFQ" misstates
        // how the number was obtained. Named source wins; otherwise the leg the
        // producer says it measured; otherwise nothing.
        var ladderTitle = em.source
            ? 'Exit mark — ' + em.source + ' sell into ' + (em.sell_into || '\u2014')
            : (em.measured_leg
                ? 'Exit mark — ' + this._escapeAttr(em.measured_leg)
                : 'Exit mark');

        // ⚠️ TWO CONVENTIONS NOW SHARE ONE COLUMN. PegTracker quotes slippage
        // against $1 nominal par; liquidity/1 quotes marginal impact against its
        // own smallest rung, with the price bias held out. Same header, same
        // colour thresholds, different question — so the producer's own
        // statement of it renders under the table head rather than being left
        // for the reader to assume. First sentence visible, full text on hover.
        var conv = em.slippage_convention;
        var convLine = '';
        if (conv) {
            // Plain split, not a lookbehind — older Safari does not have them
            // and a thrown regex here would blank the whole axis.
            var convParts = String(conv).split('. ');
            var firstSentence = convParts.length > 1 ? convParts[0] + '.' : convParts[0];
            var biasTxt = typeof em.price_bias_bps === 'number'
                ? ' \u00b7 price bias ' + em.price_bias_bps.toFixed(1) + ' bps'
                : '';
            convLine = '<div class="text-[11px] text-slate-500 mb-2" title="' +
                this._escapeAttr(conv + (em.bias_measures
                    ? '\n\nPrice bias measures: ' + em.bias_measures : '')) + '">' +
                this._escapeAttr(firstSentence) + biasTxt + ' \u24d8</div>';
        }

        // Empty state is the CALLER's call: the shared axis-3 panel says so out
        // loud because four n/a tiles beside it would otherwise read as "nothing
        // known", while a bespoke panel that already states its depth another way
        // just wants nothing added.
        if (!sizes.length) return '';
        return '<div class="text-sm font-semibold text-slate-700 mb-2">' + ladderTitle + '</div>' +
              convLine +
              '<div class="data-table-scroll"><table class="data-table">' +
                  '<thead><tr><th>Size sold</th><th class="text-right">Slippage</th><th class="text-right">Net out</th></tr></thead>' +
                  '<tbody>' + ladderRows + '</tbody></table></div>';
    },

    _renderLiquiditySection(data) {
        var body = document.getElementById('axis-liquidity-body');
        if (!body) return;
        var liq = data.liquidity || {};
        var ladderBlock = this.ladderBlockHtml(liq) ||
            '<div class="text-sm text-slate-400">No exit-mark RFQ ladder in this snapshot.</div>';

        // ⚠️ Four n/a's read as "we know nothing about this asset's liquidity".
        // For usdm the feed says something quite different: there is no secondary
        // depth BY DESIGN, because Mento pools are a mint/redeem venue, and the
        // holder's actual exit is the reserve swap. Same shape as usdat's two
        // zero rows — the page said something answerable, so nobody asked.
        //
        // "How does a holder get out" is the question this axis exists to
        // answer, and for a reserve-backed asset the answer is a redemption venue
        // rather than pool depth. Generic: any such asset has this shape and
        // total_2pct_depth: null stays correct for all of them.
        var pe = liq.primary_exit;
        var exitLine = '';
        if (pe && (pe.venue || pe.into)) {
            exitLine =
                '<div class="text-sm text-slate-700 dark:text-slate-200 mt-3">' +
                    '<span class="font-semibold">Primary exit:</span> ' +
                    this._escapeAttr(pe.venue || 'venue not named') +
                    (pe.into ? ' \u2192 ' + this._escapeAttr(pe.into) : '') +
                    // ⚠️ pe.gated is DELIBERATELY NOT RENDERED. usdm publishes
                    // gated:false while riskAnalyst's report says the redemption
                    // path is gated to allowlisted strategies. One is wrong and
                    // it is unresolved with PegTracker. Rendering false would
                    // assert "open to any holder" on the strength of a field
                    // under dispute — and that is the more dangerous direction,
                    // since it overstates how easily a holder can leave.
                    // Restore once the producer confirms it is measured.
                    //
                    // ⚠️ The UNMEASURED case is different and safe to show. "Primary
                    // exit: Yuzu redemption → reserve stables" reads as an exit that
                    // exists and works; yzUSD's own gated_note says "Redemption
                    // reachability is not probed in v1. ⚠️ Unmeasured, not open."
                    // Naming a venue while withholding that is the flattering
                    // direction — it implies a route out that nothing has tested.
                    //
                    // Rendered ONLY when the exit is not asserted open, so the
                    // disputed gated:false case stays withheld as above.
                    ((pe.gated == null || pe.gated_basis === 'unmeasured') && pe.gated_note
                        ? '<div class="text-xs text-amber-700 mt-1" style="line-height:1.45;">' +
                          this._escapeAttr(pe.gated_note) + '</div>' : '') +
                '</div>';
        }
        var poolsNote = liq.pools_note
            ? '<div class="text-xs text-slate-500 mt-1">' + this._escapeAttr(liq.pools_note) + '</div>'
            : '';

        var eff = liq.effective_max_under_25bps_usd;

        // ⚠️ Sell-side inventory: a MEASURED number that was going unshown.
        //
        // Where a pool is heavily skewed, a symmetric depth figure overstates what
        // a SELLER can execute — usg's worst pool is 73.6% USG, so the counter-side
        // stablecoin inventory is the real exit. The producer measured it and,
        // correctly, refused to put it in total_2pct_depth, which is reserved for
        // quoted depth. The result was a card showing four n/a's and a pool TVL the
        // producer had flagged as misleading, while the one figure it had measured
        // appeared nowhere — implying less is known than is.
        //
        // Displayed only. NOT fed to liquidityRating: that stays null, because an
        // executable inventory is not quoted depth and rating one as the other is
        // the substitution the producer declined to make. Generic on the field
        // names, not usg-specific — other feeds will want "what a seller can
        // execute into" as distinct from depth.
        var sellSide = liq.sell_side_counter_inventory_usd;
        var sellCard = (sellSide == null) ? '' :
            '<div><div class="text-xs text-slate-400 font-medium uppercase">Sell-side inventory</div>' +
                '<div class="text-lg font-bold">' + this.formatCurrency(sellSide) + '</div>' +
                '<div class="text-[11px] text-slate-400"' +
                    (liq.sell_side_basis ? ' title="' + this._escapeAttr(liq.sell_side_basis) + '"' : '') +
                    '>executable, not quoted depth' +
                    (liq.worst_pool_usg_share_pct != null
                        ? ' \u00b7 worst pool ' + liq.worst_pool_usg_share_pct.toFixed(1) + '% skewed' : '') +
                '</div></div>';

        // ⚠️ The pool table read {venue, pair, depth_usd, balance_ratio} and the
        // yzUSD/syzUSD feeds publish {name, project, chain, tvl_usd}, so every
        // row rendered "— Monad — —". Two of those columns are not a rename:
        // depth and balance ratio have no source in these feeds and shouldn't be
        // faked from TVL — TVL is not depth.
        //
        // So the columns follow the data instead of asserting a fixed schema. A
        // column appears when at least one pool supplies it; a feed that gains
        // depth later gains the column with no change here, and a feed without
        // it shows a narrower table rather than a wall of dashes.
        var pools = liq.pools || [];
        function anyPool(key) {
            return pools.some(function(p) { return p && p[key] != null; });
        }
        var cols = [];
        cols.push({ th: 'Venue', cls: '', get: function(p) {
            var nm = p.venue || p.project || p.name || '—';
            return '<span class="font-medium">' + nm + '</span>' +
                   (p.pair ? '<span class="text-xs text-slate-400 ml-1">' + p.pair + '</span>' : '');
        }});
        if (anyPool('chain')) cols.push({ th: 'Chain', cls: 'text-xs text-slate-400',
            get: function(p) { return p.chain || ''; }});
        if (anyPool('tvl_usd')) cols.push({ th: 'TVL (USD)', cls: 'text-right font-mono',
            get: function(p) { return p.tvl_usd != null ? CommonRenderer.formatCurrencyExact(p.tvl_usd) : '—'; }});
        if (anyPool('depth_usd')) cols.push({ th: 'Depth (USD)', cls: 'text-right font-mono',
            get: function(p) { return p.depth_usd != null ? CommonRenderer.formatCurrencyExact(p.depth_usd) : '—'; }});
        if (anyPool('volume_24h')) cols.push({ th: '24h Vol', cls: 'text-right font-mono',
            get: function(p) {
                if (p.volume_24h == null) return '—';
                return Math.abs(p.volume_24h) < 1000
                    ? '$' + p.volume_24h.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : CommonRenderer.formatCurrencyExact(p.volume_24h);
            }});
        if (anyPool('balance_ratio')) cols.push({ th: 'Balance', cls: 'text-right font-mono',
            get: function(p) { return (p.balance_ratio * 100).toFixed(1) + '%'; }});

        var poolRows = pools.map(function(p) {
            return '<tr>' + cols.map(function(c) {
                return '<td class="' + c.cls + '">' + c.get(p) + '</td>';
            }).join('') + '</tr>';
        }).join('');
        // ⚠️ pools_note points at a number the page did not show: "Lending markets
        // are listed under asset_specific.lending_exposure: they are the LARGER
        // numbers." On syzUSD that is $1.83M of lending exposure against $554K of
        // swap TVL — the pool table showed the smaller figure and the note sent
        // the reader to a field with no rendering.
        //
        // by_chain is the structure behind it: swap, lending and issuer-vault TVL
        // per chain from one enumeration. syzUSD's Plasma row is $71K of swap
        // against $36.2M sitting in the issuer vault, which is the whole
        // exit-capacity story and it was in the payload unread.
        var byChain = Array.isArray(liq.by_chain) ? liq.by_chain : [];
        var chainBlock = '';
        if (byChain.length) {
            var showLend = byChain.some(function(c) { return c.lending_tvl_usd; });
            var showVault = byChain.some(function(c) { return c.issuer_vault_tvl_usd; });
            chainBlock =
                '<div class="text-sm font-semibold text-slate-700 mb-2 mt-6">TVL by chain</div>' +
                '<div class="data-table-scroll"><table class="data-table">' +
                '<thead><tr><th>Chain</th><th class="text-right">Swap</th>' +
                (showLend ? '<th class="text-right">Lending</th>' : '') +
                (showVault ? '<th class="text-right">Issuer vault</th>' : '') +
                '<th>Local venue</th></tr></thead><tbody>' +
                byChain.map(function(c) {
                    return '<tr>' +
                        '<td class="font-medium">' + CommonRenderer._escapeAttr(c.chain || '—') + '</td>' +
                        '<td class="text-right font-mono">' + (c.swap_tvl_usd != null ? CommonRenderer.formatCurrency(c.swap_tvl_usd) : '—') + '</td>' +
                        (showLend ? '<td class="text-right font-mono">' + (c.lending_tvl_usd != null ? CommonRenderer.formatCurrency(c.lending_tvl_usd) : '—') + '</td>' : '') +
                        (showVault ? '<td class="text-right font-mono">' + (c.issuer_vault_tvl_usd != null ? CommonRenderer.formatCurrency(c.issuer_vault_tvl_usd) : '—') + '</td>' : '') +
                        '<td class="text-xs ' + (c.no_local_swap_venue ? 'text-amber-700 font-semibold' : 'text-slate-500') + '">' +
                            (c.no_local_swap_venue ? 'none — holders cannot exit locally'
                                : (c.swap_venues != null ? c.swap_venues + ' venue' + (c.swap_venues === 1 ? '' : 's') : '—')) +
                        '</td>' +
                    '</tr>';
                }).join('') +
                '</tbody></table></div>' +
                (liq.by_chain_note ? '<div class="text-xs text-slate-500 mt-2" style="line-height:1.45;">' +
                    this._escapeAttr(liq.by_chain_note) + '</div>' : '') +
                (liq.lending_exposure_usd
                    ? '<div class="text-xs text-slate-600 mt-2"><span class="font-semibold">Lending exposure:</span> ' +
                      this.formatCurrencyExact(liq.lending_exposure_usd) +
                      ' — a liquidation-risk figure, not exit depth.</div>' : '');
        }

        var poolBlock = pools.length
            ? '<div class="text-sm font-semibold text-slate-700 mb-2 mt-6">Pools</div>' +
              '<div class="data-table-scroll"><table class="data-table">' +
                  '<thead><tr>' + cols.map(function(c) {
                      return '<th' + (/text-right/.test(c.cls) ? ' class="text-right"' : '') + '>' + c.th + '</th>';
                  }).join('') + '</tr></thead>' +
                  '<tbody>' + poolRows + '</tbody></table></div>'
            : '';

        // ⚠️ "24h volume: n/a — not tracked" was a HARDCODED literal that read no
        // field, sitting in a panel whose own object carries volume_24h_usd. It
        // was true when written and silently stopped being true.
        //
        // For yzUSD this is the most informative liquidity fact on the page:
        // $24.74 of 24h volume against $852K of pool TVL says more than any
        // rating. It is also the reason no executable ladder was built — the
        // volume figure IS the finding, and it could not reach the page.
        //
        // "not tracked" was additionally false for hastra-prime, usdat and
        // susdat, which publish per-pool volume_24h with a source and an as-of.
        // ⚠️ formatCurrencyExact rounds to whole dollars, which renders yzUSD's
        // $24.74 as "$25" — and the exactness IS the finding here. A tiny volume
        // is the signal; rounding it away turns a striking number into a dull
        // one. Cents below $1,000, whole dollars above.
        function volFmt(v) {
            return Math.abs(v) < 1000
                ? '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : CommonRenderer.formatCurrencyExact(v);
        }
        var vol = liq.volume_24h_usd;
        var volCard;
        if (vol != null) {
            volCard = '<div><div class="text-xs text-slate-400 font-medium uppercase">24h volume</div>' +
                '<div class="text-lg font-bold">' + volFmt(vol) + '</div></div>';
        } else if (anyPool('volume_24h')) {
            volCard = '<div><div class="text-xs text-slate-400 font-medium uppercase">24h volume</div>' +
                '<div class="text-lg font-bold text-slate-400">per pool</div>' +
                '<div class="text-[11px] text-slate-400">see table</div></div>';
        } else {
            volCard = '<div><div class="text-xs text-slate-400 font-medium uppercase">24h volume</div>' +
                '<div class="text-lg font-bold text-slate-400">n/a</div>' +
                '<div class="text-[11px] text-slate-400">not published</div></div>';
        }

        var statRow =
            '<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">' +
                '<div><div class="text-xs text-slate-400 font-medium uppercase">2% depth</div>' +
                    // ⚠️ total_2pct_depth_is_floor means the quote ladder was
                    // EXHAUSTED before price moved 2% — the real depth is at
                    // least this, not equal to it. sUSDS publishes it true and
                    // nothing read it, so the page showed "$1.0M" where the
                    // honest reading is "≥$1.0M". It understates, which makes
                    // the liquidity rating harsher than the measurement warrants.
                    '<div class="text-lg font-bold">' +
                        // ⚠️ NOT_SIZE_RESPONSIVE MUST NOT WEAR FLOOR NOTATION, and this
                        // panel was doing it while the band tile guarded correctly — the
                        // same asset rendered "$50.0M" on the tile and "≥$50.0M" here.
                        // A floor says "AT LEAST this much" and is a real bound; USDS's
                        // $50M says only that the call returns the same answer at any
                        // size. The tile's own comment spells out the consequence:
                        // "≥$50.0M would put USDS above crvUSD's genuinely bracketed
                        // $25M" — the worst-measured asset rendering as the deepest.
                        // Found by riskAnalyst reading a truncated comment and ASKING
                        // rather than asserting.
                        (liq.total_2pct_depth != null
                            ? ((liq.total_2pct_depth_is_floor === true &&
                                liq.two_pct_depth_status !== 'not_size_responsive' &&
                                liq.two_pct_depth_size_responsive !== false) ? '\u2265' : '') +
                              this.formatCurrency(liq.total_2pct_depth)
                            : 'n/a') + '</div>' +
                    // ⚠️ Four kinds of number wore the same label. The producer
                    // now declares which: `bracketed` located the crossing
                    // between two rungs, `ladder_exhausted` never reached it,
                    // `quote_failed` hit a broken route, `not_size_responsive`
                    // means the quote path ignores the size argument entirely
                    // (USDS returns 0.00bps from $5M to $100M — a fixed-rate PSM
                    // swap, so "clears $5M" is evidence about the call, not the
                    // venue). Extending rungs there only extends the tautology.
                    //
                    // The distinction is the whole finding: usde published $5M
                    // while quoting that same rung at −1490bps, because one
                    // comparison read a signed cost as though it were a
                    // magnitude. Rendering "≥" or a bracket is what stops a
                    // bound being read as a measurement.
                    this._depthQualifierHtml(liq) +
                    this._selfReferentialHtml(data) +
                    this._depthShareHtml(data) +
                    (liq.total_2pct_depth == null && liq.total_2pct_depth_note
                        ? '<div class="text-[11px] text-slate-400" title="' +
                          this._escapeAttr(liq.total_2pct_depth_note) + '">unmeasured, not zero \u24d8</div>' : '') +
                '</div>' +
                sellCard +
                '<div><div class="text-xs text-slate-400 font-medium uppercase">Max ≤25 bps</div>' +
                    '<div class="text-lg font-bold">' + (eff != null ? this.formatCurrency(eff) : 'n/a') + '</div></div>' +
                '<div><div class="text-xs text-slate-400 font-medium uppercase">Pool TVL</div>' +
                    '<div class="text-lg font-bold">' + (liq.total_tvl != null ? this.formatCurrency(liq.total_tvl) : 'n/a') + '</div></div>' +
                volCard +
            '</div>';


        body.innerHTML = '<div class="panel">' +
            '<div class="panel-title">Liquidity &amp; Exit</div>' +
            statRow + exitLine + ladderBlock + poolBlock + poolsNote + chainBlock +
        '</div>';
    },

    _renderDependenciesSection(data) {
        var body = document.getElementById('axis-dependencies-body');
        if (!body) return;
        var dep = data.dependencies || {};
        var up = Array.isArray(dep.upstream) ? dep.upstream : [];
        var down = Array.isArray(dep.downstream) ? dep.downstream : [];

        // A dependency's `note` is where the producer puts the thing that makes
        // the row mean something other than what it looks like: a ticker
        // collision (USG's reUSD is Resupply's, not Re Protocol's), a 100%
        // concentration (sUSDS), a circularity. Every one of those was
        // published and dropped on the floor here — the card rendered name and
        // metric only. `circular` gets its own marker so it survives even when
        // no prose accompanies it.
        //
        // `label` is accepted as a name fallback because not every feed spells
        // the field `name`; a dependency with no renderable name showed as an
        // em-dash, which is indistinguishable from an unnamed dependency.
        function card(d) {
            var note = d.note
                ? '<div class="dep-card-note' +
                      (d.circular === true ? ' dep-card-note-warn' : '') + '">' +
                      d.note + '</div>'
                : '';
            var circChip = (d.circular === true && !d.note)
                ? '<div class="dep-card-note dep-card-note-warn">⚠️ Circular: this dependency\'s own backing includes the asset above.</div>'
                : '';
            var inner =
                '<div class="dep-card-name">' + (d.name || '—') + '</div>' +
                (d.metric ? '<div class="dep-card-metric">' + d.metric + '</div>' : '') +
                // `source` says where the row's claim comes from — "onchain
                // issuer-set value" and "issuer disclosures" are very different
                // warrants for the same-looking row, and it was published and
                // dropped here exactly like `note` was.
                (d.source ? '<div class="dep-card-source">' +
                    CommonRenderer._escapeAttr(String(d.source)) + '</div>' : '') +
                note + circChip;
            if (d.link && d.link_type === 'internal') {
                // An internal link is only a link if the target is registered.
                // Feeds name dependencies this dashboard may not serve, and an
                // ?asset= href to an unregistered slug renders as a live link
                // and lands on nothing. Show the dependency, not the dead link.
                var m = /[?&]asset=([^&]+)/.exec(d.link);
                var known = !m || !Array.isArray(CommonRenderer.KNOWN_ASSET_SLUGS) ||
                            CommonRenderer.KNOWN_ASSET_SLUGS.indexOf(m[1]) !== -1;
                if (known) {
                    return '<a href="' + d.link + '" class="dep-card">' + inner +
                        '<div class="dep-card-link">Open dashboard →</div></a>';
                }
                return '<div class="dep-card">' + inner +
                    '<div class="dep-card-link text-slate-400">No dashboard</div></div>';
            }
            if (d.link && d.link_type === 'external') {
                return '<a href="' + d.link + '" target="_blank" rel="noopener noreferrer" class="dep-card">' + inner +
                    '<div class="dep-card-link">External ↗</div></a>';
            }
            return '<div class="dep-card">' + inner +
                '<div class="dep-card-link text-slate-400">No dashboard</div></div>';
        }

        var upBlock = up.length
            ? '<div class="dep-grid">' + up.map(card).join('') + '</div>'
            : '<div class="text-sm text-slate-400">No upstream dependencies tracked.</div>';

        // ⚠️ SAY WHAT THE OVERLAY REPLACED, AND NAME IT. An axis owner supplying
        // its own dependency list is correct — but a reader cannot tell a list
        // that is short because the asset has two dependencies from one that is
        // short because a longer measured list was swapped out. On reUSD the
        // dropped list contained "Ethena sUSDe — 93.87% of reserves and Ethereum
        // redemption payout asset", the largest single dependency on the asset.
        var prov = (CommonRenderer.AXIS_PROVENANCE || {}).dependencies || {};
        var repl = (prov.replaced_arrays || []).filter(function(r) { return r.field === 'upstream'; })[0];
        // ⚠️ ON-PAGE ONLY ON A NET LOSS OF ROWS. riskAnalyst rebuilt their list to
        // CARRY the measurements rather than replace them — 3 entries in, 3 out,
        // each now holding the metric the feed's version had. The warning had
        // done its job and kept firing, and a notice that stays lit after the
        // thing it warns about is fixed is one readers learn to skip.
        //
        // ⚠️ The limit, stated rather than hidden: an equal-count swap CAN still
        // drop a dependency and add an unrelated one, and this test would not
        // catch it. That is why provenance keeps the dropped names either way and
        // the chip tooltip still reports them — only the page-level banner is
        // gated, on the case where a reader would be misled about COMPLETENESS.
        if (repl && repl.dropped_names && repl.dropped_names.length && repl.to < repl.from) {
            upBlock += '<div class="dep-replaced">\u26a0\ufe0f These ' + repl.to +
                ' entries come from <strong>' + this._escapeAttr(prov.producer || 'an overlay') +
                '</strong>, which owns this axis. They REPLACED ' + repl.from +
                ' entries published by the asset feed \u2014 ' +
                this._escapeAttr(repl.dropped_names.join('; ')) +
                ' \u2014 rather than being added to them. The two producers name the same ' +
                'dependencies differently, so the lists cannot be safely merged; what was dropped ' +
                'is named here instead of being silently absent.</div>';
        }

        // The block-level note describes the LIST — what it contains and how it
        // is ordered (USG: "ALL active markets, thinnest headroom first"; USDm:
        // why the volatile bucket sits apart). Without it the grid is a set of
        // rows with no stated basis, which is the same defect as an undeclared
        // denominator. Sits under the grid it describes, not above it.
        if (dep.note) {
            upBlock += '<div class="dep-block-note">' + dep.note + '</div>';
        }

        // ⚠️ THE LEGS DO NOT PARTITION. yzUSD's 16 upstream shares sum to 108.53%,
        // and nothing on the page said so — a reader adding the rows gets 108%
        // and either distrusts the page or, worse, does not add them.
        //
        // riskAnalyst found this while reproducing my protocol-grouping finding,
        // and it is the same rule I had just given them one axis over: publish
        // the set, not the derived number. `distinct_protocol_count` alone would
        // have hidden it completely — the count is right, the shares are right,
        // and the SUM is the thing that says what they mean.
        //
        // ⚠️ States the arithmetic only. The CAUSE — that a levered leg's
        // collateral and its borrowed asset can both appear — is their inference
        // and belongs in the producer's note, not asserted by a renderer.
        // Prefers the producer's own `pct_sums_to` / `is_partition` once emitted.
        // ⚠️ SAME-COUNTERPARTY LEGS READ AS INDEPENDENT EXPOSURES. yzUSD lists 16
        // upstream legs that resolve to 10 counterparties. Ethena has a
        // CONCENTRATION flag pointing at it; MAPLE DOES NOT — 20.67% split across
        // three separate rows with no flag, no adjacency, and no reason for a
        // reader to add them. riskAnalyst's case, and it is stronger than the
        // Ethena one I led with.
        //
        // ⚠️ AND IT UNDERSTATES. riskAnalyst found the limit: the prefix names the
        // ISSUER OF THE UNDERLYING, not every counterparty in the leg.
        // "[Agora]_PT_AUSD_Loop" (4.93%) and "[Sky]_PT_sUSDS_Loop" (1.32%) are
        // both principal-token positions — 6.25% attributed entirely to Agora and
        // Sky, while the protocol whose contract, oracle and maturity mechanics
        // sit between yzUSD and those underlyings has NO ROW AT ALL. At 6.25% it
        // would rank sixth of eleven, above Superstate and PayPal.
        //
        // ⚠️ NOT fixed by parsing "PT_" — that is the world-knowledge assertion
        // this caption exists to avoid, and riskAnalyst explicitly asked that it
        // not be. Verified there is nothing better to group on: a leg carries
        // name, value, metric, pct, source, link — no protocol field, no address.
        // It belongs in the producer's `by_protocol`, WHERE A LEG CAN CARRY MORE
        // THAN ONE COUNTERPARTY — which means by_protocol is not a partition of
        // legs either, and that is worth knowing before it is designed.
        //
        // ⚠️ Deliberately narrow about what this claims. It groups on the
        // PRODUCER'S OWN NAME PREFIX — "[Maple]_syrupUSDT_Loop" — and says so.
        // It does NOT assert that two legs are the same counterparty from any
        // knowledge of the world, and it does NOT sum their shares, because the
        // legs do not partition (108.53%) and a summed share would be a number I
        // invented. The producer's `by_protocol` is the right home for the
        // arithmetic; this makes the repetition visible until it exists.
        //
        // Fires only where the convention is actually used: 15 of 16 legs on
        // yzUSD, zero on every other asset.
        var prefixCount = {};
        up.forEach(function(x) {
            var m = /^\[([^\]]+)\]/.exec(x && x.name || '');
            if (m) prefixCount[m[1]] = (prefixCount[m[1]] || 0) + 1;
        });
        var shared = Object.keys(prefixCount).filter(function(k) { return prefixCount[k] > 1; });
        if (shared.length) {
            upBlock += '<div class="dep-block-note"><span class="text-amber-700">' +
                'Several legs share a name prefix:</span> ' +
                shared.sort(function(a, b) { return prefixCount[b] - prefixCount[a]; })
                      .map(function(k) { return CommonRenderer._escapeAttr(k) + ' \u00d7' + prefixCount[k]; })
                      .join(' \u00b7 ') +
                '. Grouped on the producer\'s own name prefix, not on an independent ' +
                'counterparty check \u2014 and their shares are NOT summed here, because the ' +
                'legs do not partition. ' + up.length + ' rows are not ' + up.length +
                ' independent exposures. \u26a0\ufe0f A prefix names the ISSUER OF THE ' +
                'UNDERLYING, which is not every counterparty in the leg: a wrapped or ' +
                'principal-token position also depends on the contracts that wrap it, and ' +
                'the name does not record them. So this understates sharing as well as ' +
                'showing it.</div>';
        }

        var pctSum = dep.pct_sums_to;
        if (pctSum == null && up.length > 1) {
            var acc = 0, seen = 0;
            up.forEach(function(x) { if (typeof x.pct === 'number') { acc += x.pct; seen++; } });
            if (seen === up.length) pctSum = acc;
        }
        if (up.length > 1 && typeof pctSum === 'number' &&
            (dep.is_partition === false || pctSum > 101 || pctSum < 99)) {
            // ⚠️ THE PRODUCER'S OWN BASIS WINS WHERE IT EXISTS. This composed its
            // sentence unconditionally and dropped `is_partition_basis`, which on
            // yzUSD says something this renderer cannot know and must not invent:
            // "⚠️ The CAUSE of the overlap is NOT established here and is
            // deliberately not named — the excess is measured, the mechanism is
            // not." A generic "legs are not mutually exclusive" asserts a mechanism
            // the producer explicitly refused to assert.
            //
            // Same rule as issuer and authority prose: where the producer has
            // authored the explanation, render theirs; compose only as a fallback.
            upBlock += '<div class="dep-block-note"><span class="text-amber-700">' +
                'These shares do not partition:</span> they sum to ' + pctSum.toFixed(1) +
                '%, not 100%. ' +
                (typeof dep.is_partition_basis === 'string' && dep.is_partition_basis.trim()
                    ? this._escapeAttr(dep.is_partition_basis.trim())
                    : 'Legs are not mutually exclusive, so they cannot be read as ' +
                      'slices of the backing and must not be added.') + '</div>';
        }

        // Downstream is a reserved stub until a consumer analyzer exists. An
        // absent/false `downstream_tracked` flag means "not tracked" (NOT "0") —
        // show the future-version placeholder. Once the analyzer flips the flag
        // true, real cards (or an honest empty state) render with no code change.
        var downBlock;
        if (dep.downstream_tracked === true) {
            downBlock = down.length
                ? '<div class="dep-grid">' + down.map(card).join('') + '</div>'
                : '<div class="text-sm text-slate-400">No downstream consumers currently tracked.</div>';
        } else {
            downBlock = '<div class="dep-card dep-stub">' +
                  '<div class="dep-card-name text-slate-500">Downstream not tracked</div>' +
                  '<div class="dep-card-metric">Consumer tracking (Morpho / Pendle / etc.) coming in a future version.</div>' +
              '</div>';
        }

        // ⚠️ THE BASIS RENDERS WHERE THE SCORE IS, not in a tooltip. A 900-character
        // argument about counterparty concentration is not something a reader
        // hovers for — same rule already applied to backing_score_basis and
        // structural_score_basis, which were tooltip-only until they weren't.
        var depBasis = (dep.underlying_score_basis && typeof dep.underlying_score_basis === 'string')
            ? this._scoreBasisHtml('Why this dependencies score', dep.underlying_score_basis) +
              (dep.underlying_score_denominator
                  ? '<div class="text-xs text-slate-500 mb-3">Denominator: ' +
                    this._escapeAttr(String(dep.underlying_score_denominator)) + '</div>'
                  : '')
            : '';

        body.innerHTML = '<div class="panel">' +
            '<div class="panel-title">Dependencies</div>' +
            depBasis +
            '<div class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Upstream — what this asset depends on</div>' +
            upBlock +
            '<div class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 mt-6">Downstream — what depends on this asset</div>' +
            downBlock +
        '</div>';
    },

    _renderIssuerSection(data) {
        var body = document.getElementById('axis-issuer-body');
        if (!body) return;
        body.innerHTML = this.issuerPanelHtml(data) + this._issuerContextHtml(data);
    },

    // Extracted so the BESPOKE renderers can emit axis 6 too. They build their
    // whole axis set into #asset-specific-panels and clear the generic bodies,
    // so before this they simply had no axis 6 — their old "5 Issuer" head was
    // sitting above admin-topology panels, which is Contract & Admin content.
    issuerPanelHtml(data) {
        var issuer = data.issuer || {};
        var info = this._issuerAxisInfo(issuer);
        // ⚠️ A NAME BADGE MUST NOT DISPLACE THE SCORE. This was
        // `info.badge || (score…)`, so any badge short-circuited the score
        // branch. usds publishes badge "Sky (MakerDAO)" — a name, deliberately,
        // with the analyzer commenting "a name, not a score" — and an authored
        // issuer_score of 7.0. The name won and the 7.0 reached NO READER, while
        // susds on the same axis showed "Issuer 7.0/10". A published score
        // rendering nowhere is the failure this dashboard keeps re-finding.
        //
        // Three cases, not two: a badge that ALREADY carries the score is the
        // score chip; a badge that is a NAME accompanies it; no badge falls back
        // to the score alone.
        // One decimal: an authored score reads N.N estate-wide ("Authored 4.0/10",
        // §6.5.1), and 7.0 arriving as the JS number 7 rendered "Issuer 7/10"
        // beside susds's "Issuer 7.0/10" for the identical value.
        var scoreText = (info.score != null)
            ? info.label + ' ' + Number(info.score).toFixed(1) + '/10'
            : (info.status === 'unavailable' ? info.label + ' unavailable' : null);
        var nameBadge = (info.badge && !info.scoredBadge) ? info.badge : null;
        var badge = info.scoredBadge ? info.badge : scoreText;
        var age = issuer.attestation_age_days;
        var scoreTooltip = this._issuerScoreTooltip(info);
        var methodology = info.label.toLowerCase() === 'issuer'
            ? 'The issuer axis is an editorial, subjective rating — KYC, permissioning, governance and admin posture are assessed in the full report rather than scored live here.'
            : 'The ' + this._escapeAttr(info.label.toLowerCase()) +
                ' axis is an editorial, subjective rating. Its asset-specific methodology is assessed in the full report rather than scored live here.';

        var chips =
            // The name, when the badge is one — rendered as identity, not as a rating.
            (nameBadge ? '<span class="axis-rating r-na">' +
                this._escapeAttr(nameBadge) + '</span>' : '') +
            (badge ? '<span class="axis-rating r-warn"' +
                (scoreTooltip ? ' title="' + this._escapeAttr(scoreTooltip) + '"' : '') + '>' +
                this._escapeAttr(badge) + '</span>' : '') +
            (info.status && info.status !== 'ok'
                ? '<span class="axis-rating r-na"' +
                    (scoreTooltip ? ' title="' + this._escapeAttr(scoreTooltip) + '"' : '') +
                    '>Score ' + this._escapeAttr(info.status.replace(/_/g, ' ')) + '</span>'
                : '') +
            (age != null ? '<span class="axis-rating r-na" title="Last attestation age">Attested ' + age + 'd ago</span>' : '');

        var reportLink = this._reportUrlUsable(issuer)
            ? '<a href="' + issuer.report_url + '" target="_blank" rel="noopener noreferrer" ' +
                'class="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700">' +
                'Read the full risk report →</a>'
            // ⚠️ Three states, not two. "No report linked" was being shown for a
            // report that EXISTS and is deliberately withheld, which reads as
            // "nobody has written one". A status without a URL is the withheld
            // case: production 404s while the report is unpublished, and the
            // staging host cannot be linked because it renders the whole
            // unpublished corpus to anyone who follows the link.
            : (issuer.report_url || issuer.report_url_status
                ? '<span class="text-sm text-slate-400" title="' + this._escapeAttr(
                      'The producer marks this report "' + String(issuer.report_url_status) +
                      '" rather than published.' +
                      (!issuer.report_url
                          ? ' A report exists; it is withheld until publication, so there is no safe ' +
                            'URL to link \u2014 the production URL 404s and the staging host renders ' +
                            'the whole unpublished corpus.' : '')) +
                  '">Report not yet published \u24d8</span>'
                : '<span class="text-sm text-slate-400">No report linked.</span>');

        // ⚠️ issuer.facts is an EXISTING feed convention that nothing rendered.
        // usds has published four of them — "48h GSM timelock", "Pause Proxy is
        // the sole owner/admin", "Freeze / emergency-shutdown functions exist",
        // an allocator-visibility caveat — and every one was invisible while this
        // section showed only the generic "editorial, subjective axis" line.
        //
        // This is deliberately the mechanism for issuer material rather than
        // hardcoding prose into a renderer. Claims like "unlicensed", "not
        // bankruptcy-remote" or a jurisdiction are assertions about a real
        // company: they belong to the producer, must move when the assessment
        // moves, and are exactly what this repo shipped unsourced once before.
        // A renderer that names a custodian or a legal status is a constant that
        // nothing recomputes.
        var facts = (issuer.facts && Array.isArray(issuer.facts)) ? issuer.facts : [];
        // ⚠️ Collapsed past a handful. Ten bullets under a paragraph is the same
        // wall axis 5 had, and the reader who needs the detail is one click from
        // it while the reader scanning six axes is not made to wade through it.
        // Few enough entries stay open — usds publishes four, thusd five, and
        // collapsing those buys nothing.
        var factsList = facts.length
            ? '<ul class="text-sm text-slate-600 dark:text-slate-300 list-disc ml-5 space-y-1">' +
                facts.map(function (f) {
                    return '<li>' + CommonRenderer._escapeAttr(String(f)) + '</li>';
                }).join('') +
              '</ul>'
            : '';
        var factsHtml = !facts.length ? ''
            : facts.length <= 5
                ? '<div class="mb-3">' + factsList + '</div>'
                : '<details class="issuer-facts"><summary class="issuer-facts-toggle">' +
                  facts.length + ' assessment points</summary>' + factsList + '</details>';

        // ⚠️ `issuer.summary` — prose, and AUTHORED BY THE PRODUCER, never here.
        // The axis is editorial: it says who the issuer is, which regulator, what
        // the legal instrument actually is. Every one of those is an assertion
        // about a real company, so the same rule as `facts` applies and applies
        // harder to a paragraph than to a bullet — this repo has already shipped
        // an invented "Cayman-SPV / daily attestation" line that contradicted its
        // own panels, and a renderer that composes issuer prose from fields is
        // that failure with extra steps.
        //
        // `summary_source` is rendered with it. A summary of a PUBLISHED report
        // and a summary of an INTERNAL one are different objects: the first can
        // be followed by a reader, the second cannot, and on this asset the two
        // are demonstrably not in sync — the internal §III carries a four-entity
        // map, the Note structure and the BVI regulator that the published report
        // does not mention at all.
        var summary = typeof issuer.summary === 'string' ? issuer.summary.trim() : '';
        // ⚠️ COLLAPSED WHEN THERE ARE BULLETS TO SCAN, and the choice of what to
        // collapse is deliberate. The prose and `facts[]` cover the same ground —
        // the bullets are the producer's own scannable form of it — so a reader
        // meeting an unbroken 1,100-character block above ten bullets reads the
        // same material twice, badly, and most will read neither.
        //
        // ⚠️ COLLAPSED, NOT TRUNCATED. Cutting to the first N sentences would mean
        // this renderer choosing WHICH of the producer's warnings a reader sees,
        // and on this asset the second ⚠️ (no direct claim on the §114 trust
        // assets) is the one most likely to surprise someone — a length-based cut
        // would have hidden exactly it. Nothing is dropped; it is one click away
        // and the click is labelled with what it opens.
        //
        // With no facts to fall back on, the prose stays open: collapsing the only
        // content on the axis would leave a panel that says nothing.
        // ⚠️ The visible lead is the producer's OWN FIRST SENTENCE, taken
        // mechanically — never a sentence composed here. On this asset it is
        // "The issuer is FOUR entities, not one.", which is exactly the finding;
        // but the rule is mechanical precisely so the renderer is not choosing
        // which claim about a real company leads the card.
        var leadMatch = summary ? /^([\s\S]*?\.)\s+([\s\S]+)$/.exec(summary) : null;
        var lead = leadMatch ? leadMatch[1] : summary;
        var rest = leadMatch ? leadMatch[2] : '';
        // ⚠️ THIS COLLAPSED ON FACT COUNT AND NEVER LOOKED AT LENGTH, which was
        // right for the summaries that existed when it was written and became
        // wrong the moment they were rewritten.
        //
        // The original reasoning was real: a 290-word block sitting above ten
        // bullets covering the same ground meant a reader read the same material
        // twice, badly, and most read neither. But the producer has since split
        // the roles explicitly — summary = ORIENTATION, facts[] = the depth — and
        // shortened every summary to ~95 words to match. A 95-word orienting
        // paragraph is not a wall, and it is no longer a duplicate of the bullets.
        //
        // ⚠️ WITH THE OLD RULE ALL FIVE REWRITTEN SUMMARIES STILL COLLAPSED TO ONE
        // SENTENCE — which is precisely the complaint that prompted the rewrite
        // ("they read as one key line with the substance hidden behind it"). The
        // producer shortened the prose believing that would put it on the face; it
        // would not have, because this rule counts bullets rather than words.
        //
        // Length is now the trigger and the fact count stays as a secondary
        // condition, so the collapse survives as a safety valve for genuinely long
        // prose (reusd-re's 1,159-character summary still collapses) while an
        // orienting paragraph renders where it can be read.
        var SUMMARY_COLLAPSE_CHARS = 900;
        var collapseSummary = summary && facts.length >= 3 &&
            summary.length > SUMMARY_COLLAPSE_CHARS;
        var srcHtml = summary
            ? (issuer.summary_source
                  ? '<div class="issuer-summary-src">Source: ' +
                    this._escapeAttr(String(issuer.summary_source)) + '</div>'
                  : '<div class="issuer-summary-src issuer-summary-src-none">\u26a0\ufe0f No source ' +
                    'declared for this summary.</div>')
            : '';
        var summaryHtml = !summary ? ''
            : collapseSummary && rest
                ? '<div class="issuer-lead">' + this._escapeAttr(lead) + '</div>' +
                  '<details class="issuer-summary-details"><summary class="issuer-summary-toggle">' +
                  'Full issuer assessment' +
                  (issuer.entity ? ' \u2014 ' + this._escapeAttr(String(issuer.entity)) : '') +
                  '</summary><div class="issuer-summary">' + this._escapeAttr(rest) +
                  srcHtml + '</div></details>'
                : '<div class="issuer-summary">' + this._escapeAttr(summary) + srcHtml + '</div>';

        return '<div class="panel">' +
            '<div class="panel-title">' + this._escapeAttr(info.label) + '</div>' +
            '<div class="flex flex-wrap items-center gap-2 mb-3">' + chips + '</div>' +
            summaryHtml +
            factsHtml +
            // ⚠️ The methodology sentence is identical on every asset and says
            // the axis is editorial — true, unchanging, and the longest visible
            // line on the card once the content collapsed. It belongs on hover,
            // not above the fold, and the "editorial — subjective axis" label in
            // the axis head already carries the same claim in three words.
            '<div class="issuer-meta" title="' + this._escapeAttr(methodology.replace(/<[^>]+>/g, '')) +
                '">Editorial axis \u2014 how this is rated \u24d8</div>' +
            reportLink +
        '</div>';
    },

    // ⚠️ Axis 5 · Contract & Admin. The panels below were rendered under Issuer
    // until the six-axis split, which was a misfiling rather than an omission —
    // 12 of 25 assets carried this material all along.
    //
    // It renders even with no score, because the content is the point and an
    // unrated axis with a stated reason beats a rated one built on the wrong
    // measurement. See the head comment in renderAxisSections.
    _renderContractSection(data) {
        var body = document.getElementById('axis-contract-body');
        if (!body) return;
        var html = this._contractPanelsHtml(data);
        body.innerHTML = html ||
            '<div class="panel"><div class="panel-title">Not assessed</div>' +
            '<div class="text-sm text-slate-500" style="line-height:1.5;">' +
            'No admin-control facts are published for this asset. ' +
            '\u26a0\ufe0f Not assessed \u2014 this is an absence of data, not a finding that ' +
            'control is unconstrained.</div></div>';
    },

    // ⚠️ The issuer axis read "4.0/10" and a line of boilerplate while the feed
    // carried the material a reader actually wants: whether the issuer's own
    // figures were checked against the chain, where they came from, and who can
    // move the money. It sat in asset_specific rather than the issuer block, so
    // this section never looked at it.
    //
    // Everything below is data-gated and no-ops for assets that publish none of
    // it. Nothing is inferred: where the producer says a thing is unknown, the
    // page says unknown.
    _reportChipHtml(issuer) {
        issuer = issuer || {};
        var st = issuer.report_url_status;
        if (st === 'unavailable') {
            return '<span class="axis-rating r-na" title="A report exists but the publisher has not released it yet, so there is nothing to link.">Report not published</span>';
        }
        if (st === 'unverified') {
            return '<span class="axis-rating r-na" title="The producer could not verify the report URL resolves, so it is deliberately not linked.">Report unverified</span>';
        }
        if (st) {
            return '<span class="axis-rating r-na">Report ' + this._escapeAttr(String(st).replace(/_/g, ' ')) + '</span>';
        }
        return '<span class="axis-rating r-na" title="No report URL is published for this asset.">No report</span>';
    },

    // ⚠️ A RATIONALE THAT ONLY EXISTS IN A TOOLTIP IS UNPUBLISHED.
    //
    // I rendered backing_score_basis and structural_score_basis as title=""
    // attributes. syrupUSDC's is 2,162 characters; reUSD's backing basis is
    // 1,162. A hover tooltip is invisible on touch, invisible to anyone who does
    // not hover, and browsers truncate long title text — so the argument for why
    // a score is what it is was functionally not on the page.
    //
    // ⚠️ This is the same defect class as "published but unrendered", one step
    // further in: the field IS read, and rendered somewhere nobody looks. An
    // audit that greps renderer source counts it as DONE.
    //
    // A basis must render WHERE IT QUALIFIES THE NUMBER. Collapsed is fine —
    // reachable by click, discoverable by an affordance — but a hover is not a
    // place a 2,000-character argument can live.
    // ⚠️ PRODUCERS WRITE MARKDOWN AND THIS RENDERED IT AS PUNCTUATION.
    //
    // 346 emphasis spans across 20 files — 334 of them in structural_score_basis
    // alone — arrived as literal `**bold**` and backticked `code`. The emphasis is
    // deliberate: riskAnalyst uses bold to mark the load-bearing turn in a
    // 5,000-character argument, and stripping it to plain text loses the structure
    // a reader navigates by.
    //
    // ⚠️ ESCAPE FIRST, THEN CONVERT. The input is producer prose and must never
    // reach innerHTML unescaped; converting afterwards means only the markers this
    // function creates become tags, and a producer writing "<script>" still lands
    // as text. The patterns deliberately refuse to span newlines so an unclosed
    // marker cannot swallow a paragraph.
    _mdInlineHtml(text) {
        if (!text || typeof text !== 'string') return '';
        return this._escapeAttr(text)
            .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
            .replace(/`([^`\n]+)`/g, '<code>$1</code>');
    },

    // ⚠️ TOOLTIPS GET THE MARKERS STRIPPED, NOT CONVERTED. A title="" attribute
    // renders its value as plain text, so <strong> there would show the TAG to a
    // reader — worse than the asterisk it replaced. Same prose, two destinations,
    // two treatments.
    _mdPlain(text) {
        if (!text || typeof text !== 'string') return '';
        return text.replace(/\*\*([^*\n]+)\*\*/g, '$1')
                   .replace(/`([^`\n]+)`/g, '$1');
    },

    _scoreBasisHtml(label, text) {
        if (!text || typeof text !== 'string') return '';
        var t = text.trim();
        if (!t) return '';
        return '<details class="score-basis"><summary class="score-basis-toggle">' +
            this._escapeAttr(label) + '</summary>' +
            '<div class="score-basis-body">' + this._mdInlineHtml(t) + '</div></details>';
    },

    // ⚠️ HOW FAR THE CHECK WENT, ON THE FACE — because the FINDING is on the
    // face and a bound that renders one click down is not a bound.
    //
    // This block describes the MEASUREMENT, never the asset: who authored the
    // walk, who reviewed it, and how many claims were re-measured. That is
    // precisely why the producer could publish it where a prose findings[] was
    // refused — "four claims re-measured" is an observation, "therefore this is
    // safe" would be judgement and belongs to the editorial producer.
    //
    // ⚠️ IT EXISTS BECAUSE ONE OF THESE WALKS WAS PEER-AUTHORED AND PUBLISHED
    // FOR A DAY while I reported all five were the producer's own — from a git
    // check that had exactly one possible output, in a repo where every session
    // commits under the same name. A reader deserves to see the provenance of a
    // walk without taking my word that it was verified.
    _reviewHtml(c) {
        var r = c && c.review;
        if (!r || typeof r !== 'object') return '';
        var self = this;
        var esc = function(x) { return self._escapeAttr(String(x)); };
        var bits = [];
        if (r.scope) bits.push(esc(String(r.scope)) + ' review');
        if (r.claims_remeasured != null) bits.push(esc(r.claims_remeasured) + ' claims re-measured');
        if (r.reviewed_by) bits.push('reviewed by ' + esc(this._producerLabel(r.reviewed_by)));
        if (r.reviewed_at) bits.push(esc(r.reviewed_at));
        return '<div class="walk-review">' +
            '<div class="wr-head">\u26a0\ufe0f ' + bits.join(' \u00b7 ') + '</div>' +
            (r.authored_by
                ? '<div class="wr-line"><span class="wr-key">Authored by:</span> ' +
                  esc(r.authored_by) + ' \u2014 not by the reviewing repo</div>'
                : '') +
            (r.note ? '<div class="wr-line">' + esc(r.note) + '</div>' : '') +
        '</div>';
    },

    // ⚠️ SHARED AUTHORITY, RENDERED STRUCTURALLY AND WITHOUT A CONCLUSION.
    //
    // The producer publishes ADDRESSES ONLY and deliberately dropped the prose
    // note I drafted: "the subordination is not protected by separate control"
    // is a JUDGEMENT, and judgement is riskAnalyst's field, not
    // security_analyst's store. ⚠️ That reasoning binds this renderer too — if I
    // supply the sentence they refused to supply, I have moved the authoring one
    // layer FURTHER from the evidence, which is worse than where it started.
    //
    // So this states what is shared and with whom, and lets the rows do the work:
    // one timelock over both tokens, one implementation, one 3-of-5 Safe behind
    // every minter, one AccessManager at admin delay zero.
    //
    // ⚠️ ON THE FACE, NOT IN THE COLLAPSED TRAIL, for a specific reason: two
    // sibling pages each showing "48h timelock" invite a reader to count two
    // independent controls where there is one. On a tranched product that is not
    // a detail — the junior tranche exists to absorb losses first, and whether
    // that ordering is separately controlled is the question a holder has.
    _sharedAuthorityHtml(c) {
        var list = (c && Array.isArray(c.authority_shared_with)) ? c.authority_shared_with : [];
        if (!list.length) return '';
        var self = this;
        var esc = function(x) { return self._escapeAttr(String(x)); };
        var short = function(a) {
            var t = String(a || '');
            return t.length > 14 ? t.slice(0, 8) + '\u2026' + t.slice(-4) : t;
        };
        return list.map(function(e) {
            var other = String(e.asset || '');
            var known = !Array.isArray(CommonRenderer.KNOWN_ASSET_SLUGS) ||
                        CommonRenderer.KNOWN_ASSET_SLUGS.indexOf(other) !== -1;
            var rows = (e.shares || []).map(function(sh) {
                var bits = [];
                if (sh.roles && sh.roles.length) bits.push(sh.roles.join(', '));
                if (sh.n != null && sh.m != null) bits.push(sh.n + '-of-' + sh.m);
                if (sh.admin_delay === 0) bits.push('admin delay 0');
                else if (sh.admin_delay != null) bits.push('admin delay ' + sh.admin_delay);
                return '<tr><td>' + esc(String(sh.kind || '?').replace(/-/g, ' ')) + '</td>' +
                    '<td class="sa-addr" title="' + esc(sh.address || '') + '">' +
                    esc(short(sh.address)) + '</td>' +
                    '<td>' + esc(bits.join(' \u00b7 ')) + '</td></tr>';
            }).join('');
            return '<div class="shared-authority">' +
                '<div class="sa-head">\u26a0\ufe0f Shares admin authority with ' +
                    (known ? '<a href="?asset=' + esc(other) + '">' + esc(other) + '</a>' : esc(other)) +
                '</div>' +
                '<div class="sa-sub">The same addresses hold these roles over both assets \u2014 ' +
                    'measured on each proxy separately, not inherited.</div>' +
                '<div class="sa-tablewrap"><table class="sa-table"><thead><tr>' +
                    '<th>Shared</th><th>Address</th><th>Holds</th></tr></thead><tbody>' +
                    rows + '</tbody></table></div>' +
            '</div>';
        }).join('');
    },

    // Code half with NO authority walk. Leads with what is not established.
    _codeHalfOnlyHtml(c) {
        var self = this;
        var esc = function(x) { return self._escapeAttr(String(x)); };
        var note = c.authority_note || c.no_walk_note ||
            'The authority half of this axis has not been walked.';
        // ⚠️ THE HEADLINE IS THE PRODUCER'S SENTENCE, NEVER MINE. The first cut
        // hardcoded "the authority half is NOT ESTABLISHED" — true when written,
        // FALSE within the hour: riskAnalyst found reUSDe's DEFAULT_ADMIN_ROLE is
        // held by the same 48h TimelockController, read on-chain 2026-08-12 and
        // recorded in their own report. A renderer that asserts an absence is
        // making a claim about an asset, and it cannot know when that claim stops
        // being true. Their `authority_note` says what is and is not established,
        // in their words, and it moves when their assessment moves.
        return '<div class="panel topology-walk">' +
            '<div class="panel-title">Contract &amp; Admin \u2014 no topology walk filed</div>' +
            '<div class="tw-flag">' + esc(note) + '</div>' +
            (c.no_structural_score_note
                ? '<div class="tw-sub">' + esc(c.no_structural_score_note) + '</div>' : '') +
            // ⚠️ Their explicit gaps, rendered as prominently as the score.
            // The producer states the DIRECTION — every open question here can
            // only push the score down — so a reader cannot mistake the gap for
            // reassurance, which is the failure this axis keeps producing.
            (Array.isArray(c.unmeasured) && c.unmeasured.length
                ? '<div class="tw-unresolved"><div class="tw-unresolved-head">\u26a0\ufe0f Not ' +
                  'measured \u2014 ' + c.unmeasured.length + '</div><ul>' +
                  c.unmeasured.map(function(u) { return '<li>' + esc(u) + '</li>'; }).join('') +
                  '</ul></div>'
                : '') +
            '<details class="tw-code"><summary class="tw-code-toggle">Code &amp; audits \u2014 ' +
                c.code_facts.length + ' points (the OTHER half)</summary>' +
                '<ul class="tw-code-list">' +
                c.code_facts.map(function(f) { return '<li>' + esc(f) + '</li>'; }).join('') +
                '</ul><div class="tw-sub">\u26a0\ufe0f These describe the CODE. They say nothing ' +
                'about who can act on it, which is the half above and is unmeasured.</div>' +
            '</details>' +
            // Same collapse as the walked path — see _topologyWalkHtml.
            (Array.isArray(c.cross_axis) && c.cross_axis.length
                ? '<details class="tw-scope"><summary class="tw-code-toggle">' +
                  'What this score does and does not cover \u2014 ' + c.cross_axis.length +
                  ' notes</summary><ul class="tw-code-list">' +
                  c.cross_axis.map(function(x) { return '<li>' + esc(x) + '</li>'; }).join('') +
                  '</ul></details>'
                : '') +
        '</div>';
    },

    // Axis 5 from a topology walk (contract/1). Data-gated: every asset without
    // one keeps the existing asset_specific.governance / .control panels, and
    // assets with neither keep the "Not assessed" state, which is correct and
    // is not a gap to paper over.
    _topologyWalkHtml(data) {
        var c = data.contract;
        if (!c || typeof c !== 'object') return '';
        // ⚠️ THE CODE HALF CAN EXIST WITHOUT THE AUTHORITY HALF, and gating the
        // whole panel on `headline` (a walk-only field) made the page state a
        // flat negative — "No admin-control facts are published" — while five
        // published code facts sat loaded in memory. Both cannot be right.
        //
        // ⚠️ BUT THE ORDER IS THE WHOLE ANSWER. Audits shown alone under a
        // heading that says "admin authority & delay" read as reassurance about
        // the half nobody measured. So when there is no walk, the panel LEADS
        // with the absence, in the producer's own words, and the code half is
        // subordinate and collapsed beneath it. Strong audits under an
        // unmeasured key is the halo this axis exists to catch — the same
        // reasoning that keeps reUSD's 4.0 from being lifted by its audits.
        var hasWalk = !!c.headline;
        var hasCode = Array.isArray(c.code_facts) && c.code_facts.length;
        if (!hasWalk && !hasCode) return '';
        if (!hasWalk) return this._codeHalfOnlyHtml(c);
        var self = this;
        var esc = function(x) { return self._escapeAttr(String(x)); };

        var layers = Array.isArray(c.layers) ? c.layers : [];
        var layerRows = layers.map(function(l) {
            var tl = String(l.timelock == null ? '' : l.timelock);
            // ⚠️ "unresolved" is NOT "none" and must not render as a clean cell.
            // Their coverage audit exists because `timelock: unresolved` was read
            // as "no timelock" — it means NOT MEASURED. An unmeasured field shown
            // as an empty cell converts an unknown into an implied clean bill.
            var undelayed = !tl || tl === 'none';
            var unknown = tl === 'unresolved';
            return '<tr>' +
                '<td>' + esc(l.authority_layer || '—') + '</td>' +
                '<td>' + ((l.keys || []).map(esc).join(', ') || '—') + '</td>' +
                // ⚠️ A CONFIGURED DELAY IS NOT AN ENFORCED ONE, and the column now
                // says so in two words instead of a paragraph. `timelock: 48h`
                // only ever meant a delay is SET; `timelock_floor: none` means
                // MINIMUM_DELAY()/MIN_DELAY() were called and reverted, so the
                // delay is reducible by whoever can schedule against the
                // timelock's own admin. security_analyst shipped the field rather
                // than the prose I asked for, and they were right: it is a chain
                // read with a positive control, not a judgement, so it joins for
                // every consumer instead of rendering for one.
                //
                // ⚠️ ABSENT IS NOT `none`. A missing floor field means NOT
                // MEASURED and renders nothing — inventing "no floor" from
                // silence would be the same error as reading `timelock:
                // unresolved` as "no timelock".
                '<td class="' + (unknown ? 'tw-unknown' : (undelayed ? 'tw-bad' : 'tw-ok')) + '">' +
                    (unknown ? '\u26a0\ufe0f not measured' : (undelayed ? '\u26a0\ufe0f none' : esc(tl))) +
                    (l.timelock_floor === 'none'
                        ? '<span class="tw-nofloor" title="MINIMUM_DELAY() and MIN_DELAY() both revert, so no MIN_DELAY constant is enforced. \u26a0\ufe0f WHAT THIS DOES NOT SAY: on a stock OZ TimelockController, updateDelay is onlySelf \u2014 reducing the delay must itself be scheduled and executed through the timelock, so it first clears the CURRENT delay. Read this as \u2018no hardcoded minimum\u2019, NOT as \u2018this can happen instantly\u2019. The convention behind this field is being settled between producers.">' +
                          ' \u00b7 no floor</span>'
                        : (l.timelock_floor
                            ? '<span class="tw-sub"> \u00b7 floor ' + esc(l.timelock_floor) + '</span>'
                            // ⚠️ UNREAD MUST NOT RENDER AS SILENCE. A delay with no floor
                            // field was rendering nothing at all, so a reader saw "3d" with
                            // no qualifier and read it as a clean, complete measurement.
                            // Absent means NOT MEASURED — the same distinction this column
                            // already makes for `timelock: unresolved`. Seven layers were
                            // silently in this state, all syrup.
                            // ⚠️ Only where a DELAY EXISTS. A floor qualifies a delay; beside
                            // "⚠️ none" or "not measured" it is noise, and noise in the column
                            // that carries the real warnings is how a reader learns to skip it.
                            : ((undelayed || unknown) ? ''
                                : '<span class="tw-unknown" title="The floor was NOT MEASURED for this layer \u2014 the field is absent, not set to none. Whether this delay can be shortened, and how fast, is unknown rather than established.">' +
                                  ' \u00b7 floor not measured</span>'))) +
                '</td>' +
                '<td>' + esc(l.topology || '—') + '</td>' +
                '<td>' + esc(l.reach || '—') + '</td>' +
            '</tr>' + CommonRenderer._roleAdminRowHtml(l, esc) +
                     CommonRenderer._divergentPathRows(l, esc);
        }).join('');

        var unresolved = Array.isArray(c.unresolved) ? c.unresolved : [];

        // ⚠️ THE MARKER RULE BACKFIRED AND THE FAILURE WAS MINE. I promoted every
        // ⚠️-marked paragraph in the producer's header to page copy, then told
        // them those paragraphs were now page copy — so they correctly added
        // ⚠️-marked notes FOR FUTURE EDITORS of their file ("THIS FILE HAS A LIVE
        // PUBLIC CONSUMER", "SLUG_TO_FILE needs one line added"), and repo
        // maintenance instructions started rendering to readers of a risk
        // dashboard. Five flagged paragraphs, two of them findings.
        //
        // A source comment serves two audiences and the glyph does not
        // distinguish them. Emphasis inside a repo file is not the same signal as
        // importance to an outside reader, and no renderer-side heuristic can
        // separate them without guessing at meaning.
        //
        // So header prose renders in the verbatim trail below and NOT as page
        // copy. ⚠️ That temporarily moves one real finding — the 48h delay has NO
        // FLOOR, since MINIMUM_DELAY/MIN_DELAY both revert — one click away. It
        // belongs in a STRUCTURED field the producer publishes deliberately for
        // this surface, which is what has been asked for; a comment that happens
        // to carry a glyph is not that.
        var notes = Array.isArray(c.walk_notes) ? c.walk_notes : [];
        var findings = Array.isArray(c.findings) ? c.findings : [];
        var flagged = findings.map(function(f) {
            return typeof f === 'string' ? f : (f && f.text) ? f.text : '';
        }).filter(Boolean);

        return '<div class="panel topology-walk">' +
            '<div class="panel-title">Authority walk \u2014 ' + esc(c.method || 'unknown method') + '</div>' +
            // ⚠️ Provenance goes in tooltips, not in the reading line. Three
            // meta sentences above the table — how the headline was derived, what
            // file it came from, what generator row it replaced, and their
            // coverage-audit percentage — were longer than the finding itself.
            // All of it is true, none of it is what the axis is for, and it is
            // still one hover (and one click, in the trail) away.
            '<div class="tw-headline"' +
                (c.headline_basis ? ' title="' + esc(c.headline_basis) + '"' : '') + '>' +
                esc(c.headline) + '</div>' +
            '<div class="tw-sub">Walked ' + esc(c.observed_at || '?') +
                // ⚠️ `source_file` DROPPED FROM THE READER'S TOOLTIP. Its value is a
                // path into a PRODUCER'S REPO — "security_analyst/topology/assets/
                // crvusd.yaml" — on 21 of 21 assets that publish it. An external
                // reader cannot open it, learns nothing from it, and it discloses
                // how this estate is wired for no benefit. `method_note` is kept:
                // it describes HOW the walk was done, which is reader material.
                //
                // Not deleted from the feed — the field is real provenance and the
                // producer should keep publishing it. It simply stops being
                // rendered, the way `producer_note` already is.
                (c.method_note
                    ? ' <span class="tw-meta" title="' + esc(c.method_note) +
                      '">\u24d8</span>'
                    : '') + '</div>' +
            // ⚠️ COVERAGE ON THE FACE, beside the walk date, because a scope limit
            // qualifies every row below it. riskAnalyst split this out of
            // `authority_note`, which mixed a reader-facing scope caveat with repo
            // bookkeeping in one string — "2 of 5 chains" next to "replaces
            // generator v2.1 output". The first changes how the table reads; the
            // second is a note about our own gate.
            // ⚠️ COVERAGE: TOGGLE ON THE FACE, NOT THE PARAGRAPH.
            //
            // I asked riskAnalyst to split the reader-facing scope limit out of
            // `authority_note` and then rendered the whole field inline. crvUSD's
            // is 1,287 chars, so it sat between the headline and the authority
            // table and pushed the measurement below a wall — visible text went
            // 1098 -> 2386, WORSE than before the split I requested.
            //
            // ⚠️ A first-sentence split does not rescue it: this note opens with
            // the label "READER-FACING SCOPE LIMIT.", so the mechanical lead is
            // the label rather than the scope. Skipping "label-like" sentences
            // would mean judging what a sentence IS, which is the prose-parsing
            // line this renderer does not cross.
            //
            // So the whole note collapses under a named toggle until the producer
            // supplies a one-line form. Coverage stays one click from the table it
            // qualifies, and the table stays first.
            // ⚠️ `coverage_summary` IS THE FACE, `coverage_note` IS THE DETAIL.
            // The one-line form earns the position beside the walk date because a
            // scope limit qualifies every row of the table below it; the 1,287-char
            // note does not, and putting it there once pushed the measurement under
            // a wall of prose.
            (c.coverage_summary
                ? '<div class="tw-coverage">' + esc(c.coverage_summary) + '</div>'
                : '') +
            (c.coverage_note
                ? '<details class="tw-scope"><summary class="tw-code-toggle">' +
                  (c.coverage_summary ? 'Coverage \u2014 full scope statement'
                                      : 'Coverage \u2014 which chains this walk covers') +
                  '</summary><div class="tw-sub">' + self._mdInlineHtml(c.coverage_note) + '</div></details>'
                : '') +
            (layerRows
                ? '<div class="tw-tablewrap"><table class="tw-table"><thead><tr>' +
                  '<th>Authority</th><th>Keys</th><th>Delay</th><th>Topology</th><th>Reach</th>' +
                  '</tr></thead><tbody>' + layerRows + '</tbody></table></div>'
                : '') +
            (flagged.length
                ? '<div class="tw-flagged">' + flagged.map(function(f) {
                      return '<div class="tw-flag">' + esc(f) + '</div>'; }).join('') + '</div>'
                : '') +
            this._reviewHtml(c) +
            this._sharedAuthorityHtml(c) +
            // ⚠️ NOT ESTABLISHED is rendered as prominently as what WAS, and
            // verbatim. These entries carry their own attribution — the
            // attribution is inside the producer's own text. ⚠️ This comment used
            // to say the MINTER_ROLE finding was riskAnalyst's — it WAS, and
            // security_analyst measured it themselves on 2026-09-06 and retired
            // the entry. Rendering verbatim is what let that correction reach the
            // page without a code change; summarising would have frozen the old
            // credit in this file.
            // ⚠️ COLLAPSED, BUT THE SCOPES STAY VISIBLE. "Not established" must
            // remain as prominent as what WAS established — that is the whole
            // argument for publishing it — but prominence is the reader knowing
            // THAT four things are unmeasured and WHICH, not 1,400 characters of
            // justification stacked above the fold. The scopes are taken
            // mechanically from the text before each first colon.
            (unresolved.length
                // ⚠️ The attribute must be OMITTED, not set empty: <details open="">
                // is OPEN. Few enough items stay expanded; a long list collapses.
                ? '<details class="tw-unresolved"' + (unresolved.length <= 2 ? ' open' : '') + '>' +
                  '<summary class="tw-unresolved-head">\u26a0\ufe0f Not established \u2014 ' +
                  unresolved.length + ' item' + (unresolved.length === 1 ? '' : 's') + ': ' +
                  esc(unresolved.map(function(u) {
                      var i = u.indexOf(':');
                      return i > 0 && i < 60 ? u.slice(0, i) : u.split(/\.\s/)[0].slice(0, 40);
                  }).join(' \u00b7 ')) + '</summary><ul>' +
                  unresolved.map(function(u) {
                      // First sentence as the visible label, remainder behind an
                      // expander. Mechanical — split on the first sentence end —
                      // so the renderer never chooses WHICH part of a producer's
                      // caveat a reader sees. These run to 648 characters each
                      // and four of them stacked is a wall nobody finishes.
                      var m = /^([^.]*\.)\s+([\s\S]+)$/.exec(u);
                      if (!m) return '<li>' + esc(u) + '</li>';
                      return '<li>' + esc(m[1]) +
                          ' <details class="tw-more"><summary>why</summary>' +
                          esc(m[2]) + '</details></li>';
                  }).join('') +
                  '</ul><div class="tw-sub">Absence of a measurement is not a finding that the ' +
                  'authority is unconstrained \u2014 nor that it is constrained.</div></details>'
                : '') +
            // ⚠️ THE CODE HALF, AND THE SEAM BETWEEN THE TWO PRODUCERS DECLARED.
            // riskAnalyst supplies audits and the score; security_analyst supplies
            // the authority walk above. Their `authority_note` states that they do
            // NOT restate the walk — rendered, so a reader can see the axis is
            // split by design rather than wondering which producer is missing.
            (Array.isArray(c.code_facts) && c.code_facts.length
                ? '<details class="tw-code"><summary class="tw-code-toggle">Code &amp; audits \u2014 ' +
                  c.code_facts.length + ' points</summary><ul class="tw-code-list">' +
                  c.code_facts.map(function(f) { return '<li>' + esc(f) + '</li>'; }).join('') +
                  '</ul>' +
                  // ⚠️ FALLBACK ONLY. While a producer still emits the old combined
                  // `authority_note` AND the new split fields, rendering both would
                  // show the coverage caveat twice. Rendering NEITHER is the worse
                  // failure — riskAnalyst kept `authority_note` populated on purpose
                  // so a split landing before renderer support could not turn a
                  // verbose paragraph into a silent blank, which is what happened to
                  // `axis_exemptions` and to usdg's axis-5 score. So: prefer the new
                  // field, fall back to the old, never drop both.
                  (c.coverage_note ? '' :
                      (c.authority_note ? '<div class="tw-sub">' + esc(c.authority_note) + '</div>' : '')) +
                  // Bookkeeping — collapsed with the code half, never on the face.
                  (c.provenance_note ? '<div class="tw-sub tw-provenance">' + esc(c.provenance_note) + '</div>' : '') +
                  '</details>'
                : '') +
            // ⚠️ SCOPE NOTES COLLAPSE. These are "what this score does NOT cover"
            // — legitimate, and not findings. Rendered flat they stacked four
            // ⚠️-prefixed paragraphs into the reading path directly under the
            // authority table, so the tile read as 1,130 characters of caveat
            // after 700 characters of measurement.
            //
            // ⚠️ AND THEY WERE SPENDING THE COLUMN'S ONLY SEVERITY SIGNAL. The
            // Delay column uses ⚠️ for `none` and `not measured`; five consecutive
            // ⚠️ where none marks a finding teaches a reader to skip the glyph,
            // including on the row that means an undelayed full-reach upgrade.
            //
            // One click away, not deleted — a technical reader still gets every
            // word, in the producer's wording, which is the same treatment
            // code_facts and the walk notes already get.
            (Array.isArray(c.cross_axis) && c.cross_axis.length
                ? '<details class="tw-scope"><summary class="tw-code-toggle">' +
                  'What this score does and does not cover \u2014 ' + c.cross_axis.length +
                  ' notes</summary><ul class="tw-code-list">' +
                  c.cross_axis.map(function(x) { return '<li>' + esc(x) + '</li>'; }).join('') +
                  '</ul></details>'
                : '') +
            (notes.length
                ? '<details class="tw-details"><summary>Verification trail &amp; walk notes (verbatim, ' +
                  notes.length + ' lines)</summary><pre class="tw-pre">' +
                  esc(notes.join('\n')) + '</pre></details>'
                : '') +
        '</div>';
    },

    _contractPanelsHtml(data) {
        var sp = data.asset_specific || {};
        var out = this._topologyWalkHtml(data);

        // 2. Governance — gated on the NORMALISED shape only. apxusd and
        // syrupusdc publish governance under entirely different keys and are
        // served by their own renderers; matching on quorum_threshold keeps this
        // from half-rendering someone else's schema.
        var g = sp.governance;
        if (g && g.quorum_threshold != null) {
            // ⚠️ "4 of an unstated total" is the whole point. The producer
            // publishes quorum_denominator: null deliberately, having asked the
            // same question I did, so the page says 4-of-unknown rather than
            // implying 4-of-5. A quorum without a denominator is not a posture.
            var quorum = g.quorum_denominator != null
                ? this._escapeAttr(g.quorum_threshold) + '-of-' + this._escapeAttr(g.quorum_denominator)
                : this._escapeAttr(g.quorum_threshold) + '-of-<span class="text-amber-700">unknown</span>';
            var unknowns = Array.isArray(g.unknowns) ? g.unknowns : [];
            out += '<div class="panel">' +
                '<div class="panel-title">Governance (issuer-disclosed)</div>' +
                '<div class="text-sm text-slate-700 dark:text-slate-200">' +
                    '<span class="font-semibold">Quorum:</span> ' + quorum +
                    (g.default_action ? ' · <span class="font-semibold">Default action:</span> ' +
                        this._escapeAttr(g.default_action) : '') +
                    (g.policy_modified_at ? ' · <span class="font-semibold">Policy changed:</span> ' +
                        this.formatDate(g.policy_modified_at) : '') +
                '</div>' +
                (Array.isArray(g.attestation_kinds) && g.attestation_kinds.length
                    ? '<div class="text-xs text-slate-500 mt-2"><span class="font-semibold">Attestation kinds:</span> ' +
                      g.attestation_kinds.map(function(k) { return CommonRenderer._escapeAttr(k); }).join(' · ') +
                      '</div>' : '') +
                (unknowns.length
                    ? '<div class="text-xs mt-2" style="line-height:1.45;">' +
                      '<span class="font-semibold text-amber-700">Not established:</span>' +
                      '<ul class="list-disc ml-5 mt-1 space-y-1 text-slate-600">' +
                        unknowns.map(function(u) {
                            return '<li>' + CommonRenderer._escapeAttr(String(u)) + '</li>';
                        }).join('') +
                      '</ul></div>' : '') +
                (g.note ? '<div class="text-xs text-slate-500 mt-2" style="line-height:1.45;">' +
                    this._escapeAttr(g.note) + '</div>' : '') +
            '</div>';
        }

        // 3. Control surface — who can change the contract, and what was checked
        // rather than assumed. sUSDS publishes this in full and nothing read it:
        // the pause surface it does NOT have (five selectors tried, all revert),
        // that it IS upgradeable, the authority holding that power, and whether
        // the deployed implementation matches the published one.
        //
        // ⚠️ "No pause function" is only reassuring if someone looked. The
        // producer's note makes the distinction the page has to keep: summary
        // .paused is null "because there is nothing to read — not because a read
        // failed", and the equivalent risk on that asset is an upgrade.
        var ctl = sp.control;
        if (ctl && (ctl.authority || ctl.pause_surface || ctl.upgradeable != null)) {
            var auth = ctl.authority || {};
            var ps = ctl.pause_surface || {};
            var rows = [];
            if (auth.name || auth.address) {
                rows.push(['Authority',
                    this._escapeAttr(auth.name || '—') +
                    (auth.address ? ' <span class="font-mono text-xs">' +
                        this._escapeAttr(auth.address) + '</span>' : '')]);
            }
            if (ctl.upgradeable != null) {
                rows.push(['Upgradeable', ctl.upgradeable
                    ? '<span class="text-amber-700 font-semibold">yes</span>' +
                      (ctl.proxy_admin_slot ? ' <span class="text-xs text-slate-500">· ' +
                        this._escapeAttr(ctl.proxy_admin_slot) + '</span>' : '')
                    : 'no']);
            }
            if (ctl.impl_matches_published != null) {
                rows.push(['Deployed implementation', ctl.impl_matches_published
                    ? '<span class="text-green-600">matches published</span>'
                    : '<span class="text-red-600 font-semibold">DOES NOT match published</span>']);
            }
            if (ps.exists != null) {
                rows.push(['Pause surface', ps.exists
                    ? '<span class="text-amber-700">present</span>'
                    : 'none' + (Array.isArray(ps.checked) && ps.checked.length
                        ? ' <span class="text-xs text-slate-500">(' + ps.checked.length +
                          ' selectors checked: ' +
                          ps.checked.map(function(c) { return CommonRenderer._escapeAttr(c); }).join(', ') +
                          ')</span>' : '')]);
            }
            out += '<div class="panel">' +
                '<div class="panel-title">Control surface</div>' +
                '<table class="data-table"><tbody>' +
                rows.map(function(r) {
                    return '<tr><td class="font-medium" style="width:32%">' + r[0] + '</td><td>' + r[1] + '</td></tr>';
                }).join('') +
                '</tbody></table>' +
                (ps.note ? '<div class="text-xs text-slate-500 mt-2" style="line-height:1.45;">' +
                    this._escapeAttr(ps.note) + '</div>' : '') +
            '</div>';
        }

        return out;
    },

    // ⚠️ Stays with ISSUER (axis 6), not Contract & Admin. Corroboration is
    // about whether the ISSUER'S OWN FIGURES survive an independent read, and
    // the disclosed wallet set is a disclosure-quality fact. Neither is a
    // statement about who can change the contract.
    _issuerContextHtml(data) {
        var sp = data.asset_specific || {};
        var out = '';

        // 1. Corroboration — the strongest issuer-axis fact available: how much
        // of what the issuer reports has been independently reproduced on-chain.
        var corr = sp.corroboration;
        if (corr && corr.checks) {
            var rows = Object.keys(corr.checks).map(function(k) {
                var c = corr.checks[k] || {};
                var ok = c.agrees === true;
                return '<tr>' +
                    '<td class="font-medium">' + CommonRenderer._escapeAttr(k.replace(/_/g, ' ')) + '</td>' +
                    '<td class="text-right font-mono text-xs">' + (c.feed != null ? c.feed : '—') + '</td>' +
                    '<td class="text-right font-mono text-xs">' + (c.chain != null ? c.chain : '—') + '</td>' +
                    '<td class="text-xs ' + (ok ? 'text-green-600' : 'text-red-600') + '">' +
                        (ok ? 'agrees' : 'DISAGREES') + '</td>' +
                '</tr>';
            }).join('');
            out += '<div class="panel">' +
                '<div class="panel-title">Independent verification</div>' +
                '<div class="data-table-scroll"><table class="data-table">' +
                '<thead><tr><th>Check</th><th class="text-right">Issuer feed</th>' +
                '<th class="text-right">On-chain</th><th>Result</th></tr></thead>' +
                '<tbody>' + rows + '</tbody></table></div>' +
                (corr.note ? '<div class="text-xs text-slate-500 mt-2" style="line-height:1.45;">' +
                    this._escapeAttr(corr.note) + '</div>' : '') +
                (sp.feed_url ? '<div class="text-xs text-slate-500 mt-2">' +
                    '<span class="font-semibold">Issuer source:</span> ' +
                    this._escapeAttr(sp.feed_url) +
                    (sp.feed_as_of ? ' · as of ' + this.formatDate(sp.feed_as_of) : '') +
                    '</div>' : '') +
            '</div>';
        }

        // 4. Issuer-disclosed wallets. A count and the addresses, nothing more —
        // the disclosure is the fact, and whether the balances are in the
        // backing figure is a different question the feed answers elsewhere.
        var wal = sp.wallets;
        if (wal && typeof wal === 'object') {
            var groups = Object.keys(wal).filter(function(k) { return Array.isArray(wal[k]) && wal[k].length; });
            if (groups.length) {
                out += '<div class="panel">' +
                    '<div class="panel-title">Issuer-disclosed wallets</div>' +
                    groups.map(function(gname) {
                        var list = wal[gname];
                        return '<div class="mb-2">' +
                            '<div class="text-sm font-semibold text-slate-700 dark:text-slate-200">' +
                                CommonRenderer._escapeAttr(gname) + ' \u00b7 ' + list.length + '</div>' +
                            '<div class="text-xs font-mono text-slate-500" style="line-height:1.6; word-break:break-all;">' +
                                list.map(function(w) {
                                    return CommonRenderer._escapeAttr(w.wallet || w.address || '—');
                                }).join(' \u00b7 ') +
                            '</div>' +
                        '</div>';
                    }).join('') +
                    (sp.wallets_note ? '<div class="text-xs text-slate-500 mt-1" style="line-height:1.45;">' +
                        this._escapeAttr(sp.wallets_note) + '</div>' : '') +
                '</div>';
            }
        }
        return out;
    }
};
