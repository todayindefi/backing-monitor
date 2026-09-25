// ============================================================================
// DUSD (Alto) — bespoke panels
//
// ⚠️ THIS ASSET IS TWO MECHANISMS UNDER ONE TICKER AND EVERY SINGLE FIGURE
// MISINFORMS. PegTracker publishes `backing.collateral_ratio: null` with a basis
// saying so, riskAnalyst's overlay argues it at length, and the shared renderer
// still drew a flat 100% "Collateral Ratio History" over 67 reads — the exact
// misread both producers declared against. The 100.00% is a 1:1 warehouse with
// NO surplus: the tranche is definitionally never over-collateralised, so
// 100.00% is the worst sustainable reading rather than a good one, and 99.9%
// would be insolvency. The ~194% belongs to the CDP markets' own borrowers and
// is not claimable by DUSD holders. So this renderer plots the two tranches
// SEPARATELY, labelled, and the blend appears only as a number marked
// arithmetic-only.
//
// ⚠️ EVERY FIGURE HERE COMES FROM A SYNCED FILE, never from a report or a
// message. Where riskAnalyst's canonical is the source (the 16 lifetime swaps,
// the sole SWAPPER_ROLE), the producer already carries the sentence in
// `dusd_alto_liquidity.json` `primary_exit.gated_basis` with their name on it,
// and that string is rendered verbatim rather than paraphrased here.
// ============================================================================

var DUSD_ALTO_POOL_SHARE_WATCH_PCT = 50;

var DusdAltoRenderer = {

    preRender: function(data) {
        // Nothing to alias — the feed's own peg/backing blocks are already in the
        // shape the shared frame reads. Kept as an explicit no-op so the next
        // person does not go looking for a hidden mutation.
        return data;
    },

    render: function(data) {
        var specific = data.asset_specific || {};
        var backing = data.backing || {};
        var backingSlot = document.getElementById('backing-extra-panels');
        var liquiditySlot = document.getElementById('liquidity-extra-panels');
        var pegSlot = document.getElementById('peg-extra-panels');

        if (backingSlot) {
            backingSlot.innerHTML =
                this._identityHtml(data, specific) +
                this._trancheCoverageHtml(backing) +
                this._usmHtml(backing, specific) +
                this._cdpHtml(backing) +
                '<div id="dusd-minters"></div>';
        }
        if (liquiditySlot) {
            liquiditySlot.innerHTML = this._exitRealityHtml(data);
        }
        if (pegSlot) {
            pegSlot.innerHTML = '<div id="dusd-lifetime-peg"></div>';
        }

        // Post-render: canvases and the two async files.
        this._paintTrancheChart(data);
        this._loadMinters(data);
        this._loadLifetimePeg(data);
    },

    // ---- identity ---------------------------------------------------------
    // ⚠️ FOUR LIVE ETHEREUM TOKENS ANSWER TO DUSD/dUSD and the nearest is 3.2%
    // away on supply, so a reader who matches this page to a ticker elsewhere can
    // be looking at a different asset. The warning was in assets.json (index-card
    // copy) and on no asset page.
    _identityHtml: function(data, specific) {
        var addr = data.contract_address || (specific.contracts || {}).dusd;
        if (!addr) return '';
        return '<div class="risk-flag risk-info mb-4">' +
            '<span class="font-semibold">Resolve this asset by address, not by ticker.</span> ' +
            'Four live Ethereum tokens answer to DUSD/dUSD; this page is ' +
            '<span class="font-mono text-xs">' + CommonRenderer._escapeAttr(addr) + '</span> ' +
            '<a href="https://etherscan.io/token/' + CommonRenderer._escapeAttr(addr) + '" target="_blank" ' +
            'class="text-blue-600 hover:underline text-xs">↗</a>' +
            '<span class="text-xs text-slate-500"> — every figure on this page is read at that ' +
            'address. Source: riskAnalyst canonical dusd-alto.md, address-disambiguation table.</span>' +
        '</div>';
    },

    // ---- axis 2: the two tranches ----------------------------------------
    _trancheCoverageHtml: function(backing) {
        var usm = backing.usm || {}, cdp = backing.cdp || {};
        if (usm.ratio == null && cdp.ratio == null) return '';
        var pct = function(r) { return r == null ? '—' : CommonRenderer.formatPercent(r * 100, 2); };
        var blended = backing.arithmetic_only_blended_ratio;

        var cell = function(label, value, colorCls, lines) {
            return '<div class="flex-1 min-w-[220px]">' +
                '<div class="text-xs text-slate-400 font-medium uppercase">' + label + '</div>' +
                '<div class="text-2xl font-bold font-mono ' + colorCls + '">' + value + '</div>' +
                lines.map(function(l) {
                    return '<div class="text-[11px] text-slate-500 mt-1" style="line-height:1.45;">' + l + '</div>';
                }).join('') +
            '</div>';
        };

        return '<div class="panel">' +
            '<div class="panel-title">Coverage by tranche ' +
                '<span class="text-xs font-normal text-slate-500">(no single ratio is derivable)</span></div>' +
            '<p class="text-sm text-slate-500 mb-3">The producer publishes ' +
                '<span class="font-mono text-xs">collateral_ratio: null</span> for this asset by ' +
                'declaration, not by omission. The two tranches have OPPOSITE failure modes, so ' +
                'they are shown separately and never averaged into a headline.</p>' +
            '<div class="flex flex-wrap gap-6 mb-4">' +
                cell('USM — frxUSD tranche', pct(usm.ratio), 'text-amber-600', [
                    '⚠️ <span class="font-semibold">Zero buffer by construction</span> — 1:1 to the ' +
                        'wei against frxUSD, so 100.00% is the WORST SUSTAINABLE reading, not a cushion. ' +
                        'There is no surplus to absorb anything and 99.9% would mean insolvency.',
                    (usm.reconciled_to_wei ? '✅ minted reconciles to the underlying balance to the wei' : ''),
                    (usm.minted != null ? CommonRenderer.formatCurrency(usm.minted) + ' DUSD against ' +
                        CommonRenderer.formatCurrency(usm.underlying_balance) + ' frxUSD' : '')
                ].filter(Boolean)) +
                cell('CDP tranche', pct(cdp.ratio), 'text-slate-700', [
                    '⚠️ <span class="font-semibold">This cushion is not a DUSD-holder claim.</span> It ' +
                        'backs those isolated markets’ own borrowers and is liquidatable to them.',
                    (cdp.collateral_value_usd != null
                        ? CommonRenderer.formatCurrency(cdp.collateral_value_usd) + ' collateral against ' +
                          CommonRenderer.formatCurrency(cdp.total_debt) + ' debt' : ''),
                    (cdp.ratio_basis ? '<span class="text-slate-400">' +
                        CommonRenderer._escapeAttr(cdp.ratio_basis) + '</span>' : '')
                ].filter(Boolean)) +
                cell('Blend', blended != null ? CommonRenderer.formatPercent(blended * 100, 1) : '—',
                     'text-slate-400', [
                    '⚠️ <span class="font-semibold">Arithmetic only — do not read as coverage.</span> It ' +
                        'averages a zero-buffer tranche carrying ~88% of supply with a tranche whose ' +
                        'cushion belongs to someone else.'
                ]) +
            '</div>' +
            '<div id="dusd-tranche-chart-slot" class="chart-container"><canvas id="dusd-tranche-chart"></canvas></div>' +
            // ⚠️ THE BASIS IS NOT REPRINTED HERE. It already renders on the axis
            // head as "Basis: …", and a screenshot of the finished page showed the
            // same 1,400-character paragraph three times in one section — the axis
            // head, the ratio-history panel and this one. A reader who sees an
            // argument repeated stops reading it.
        '</div>';
    },

    // Two labelled series from the pool's own history. ⚠️ Plotted on separate
    // scales would invite a visual comparison of two ratios that answer different
    // questions; one axis with both lines and an explicit legend keeps the 100%
    // flat line visibly BELOW the CDP line, which is the honest picture.
    _paintTrancheChart: function(data) {
        var slot = document.getElementById('dusd-tranche-chart-slot');
        if (!slot) return;
        if (typeof Chart === 'undefined') { slot.remove(); return; }
        var ref = (data.asset_slug || 'dusd_alto').replace(/-/g, '_') + '_backing_history.json';
        var nocache = Math.floor(Date.now() / 60000);
        fetch('data/' + ref + '?nocache=' + nocache)
            .then(function(r) { return r.ok ? r.json() : null; })
            .then(function(h) {
                var entries = (h && Array.isArray(h.entries)) ? h.entries : [];
                var pts = entries.filter(function(e) {
                    return e && e.timestamp && (e.usm_ratio != null || e.cdp_ratio != null);
                });
                if (pts.length < 2) { slot.remove(); return; }
                DusdAltoRenderer._drawTrancheChart(pts);
            })
            .catch(function() { slot.remove(); });
    },

    _drawTrancheChart: function(pts) {
        var ctx = document.getElementById('dusd-tranche-chart');
        if (!ctx) return;
        var labels = pts.map(function(e) {
            return new Date(e.timestamp.endsWith('Z') ? e.timestamp : e.timestamp + 'Z');
        });
        var usm = pts.map(function(e) { return e.usm_ratio != null ? e.usm_ratio * 100 : null; });
        var cdp = pts.map(function(e) { return e.cdp_ratio != null ? e.cdp_ratio * 100 : null; });
        if (window._dusdTrancheChart) window._dusdTrancheChart.destroy();
        window._dusdTrancheChart = new Chart(ctx, {
            type: 'line',
            data: { labels: labels, datasets: [
                { label: 'USM tranche — 1:1, zero buffer', data: usm, borderColor: '#f59e0b',
                  fill: false, tension: 0, pointRadius: 0, borderWidth: 2 },
                { label: 'CDP tranche — cushion is the borrowers’', data: cdp, borderColor: '#6366f1',
                  fill: false, tension: 0.2, pointRadius: 0, borderWidth: 2, borderDash: [4, 3] }
            ]},
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    x: { type: 'time', time: { unit: 'day' }, ticks: { font: { size: 10 } } },
                    y: { ticks: { font: { size: 10 }, callback: function(v) { return v + '%'; } } }
                },
                plugins: {
                    legend: { labels: { font: { size: 10 }, boxWidth: 12 } },
                    tooltip: { callbacks: { label: function(c) {
                        return c.dataset.label + ': ' + (c.parsed.y == null ? 'n/a' : c.parsed.y.toFixed(2) + '%');
                    } } }
                }
            }
        });
    },

    // ---- axis 2: the stability module -------------------------------------
    _usmHtml: function(backing, specific) {
        var u = backing.usm;
        if (!u || typeof u !== 'object') return '';
        var esc = function(v) { return CommonRenderer._escapeAttr(String(v)); };
        var row = function(k, v, cls) {
            return '<tr><td class="text-sm text-slate-600">' + k + '</td>' +
                '<td class="text-right font-mono text-sm ' + (cls || '') + '">' + v + '</td></tr>';
        };
        var permissioned = typeof u.access_mode === 'string' && /PERMISSION/i.test(u.access_mode);
        var treasury = (specific.contracts || {}).treasury_safe;

        return '<div class="panel">' +
            '<div class="panel-title">Universal Stability Module ' +
                '<span class="text-xs font-normal text-slate-500">(~88% of supply is minted here)</span></div>' +
            (permissioned
                ? '<div class="risk-flag risk-warning mb-3">' +
                    '<span class="font-semibold">Not a holder redemption route.</span> The swap is ' +
                    esc(u.access_mode) + ' — a holder cannot exit through this module at par. ' +
                    '<span class="text-xs text-slate-500">Access mode is the producer’s own field; ' +
                    'the sole-SWAPPER_ROLE finding and the 16-lifetime-swap count are riskAnalyst’s, ' +
                    'carried in the Liquidity axis’ primary-exit basis.</span>' +
                  '</div>'
                : '') +
            '<div class="overflow-x-auto"><table class="data-table"><tbody>' +
                row('Module', '<span class="text-xs">' + DusdAltoRenderer._truncAddr(u.module) + '</span> ' +
                    DusdAltoRenderer._ethLink(u.module)) +
                row('Underlying', esc(u.underlying || '—') + ' ' +
                    (u.underlying_address ? DusdAltoRenderer._ethLink(u.underlying_address) : '')) +
                row('Minted / underlying held',
                    CommonRenderer.formatCurrency(u.minted) + ' / ' +
                    CommonRenderer.formatCurrency(u.underlying_balance) +
                    (u.reconciled_to_wei ? ' <span class="text-green-600 text-xs">reconciled to the wei</span>' : '')) +
                row('Buffer', (u.buffer_pct != null ? CommonRenderer.formatPercent(u.buffer_pct, 2) : '—') +
                    ' <span class="text-xs text-amber-700">by construction</span>', 'text-amber-600 font-semibold') +
                row('Backstop', u.backstop === 'none'
                    ? '<span class="text-amber-600 font-semibold">none</span>' : esc(u.backstop || '—')) +
                row('Swap fee', u.fee_bps != null ? u.fee_bps + ' bps' : '—') +
                row('Exposure cap', u.exposure_cap != null ? CommonRenderer.formatCurrency(u.exposure_cap) +
                    ' <span class="text-xs text-slate-400">token units</span>' : '—') +
                row('Frozen', u.is_frozen === false ? '<span class="text-green-600">no</span>'
                    : u.is_frozen === true ? '<span class="text-red-600 font-semibold">YES</span>' : '—') +
                row('Seized', u.is_seized === false ? '<span class="text-green-600">no</span>'
                    : u.is_seized === true ? '<span class="text-red-600 font-semibold">YES</span>' : '—') +
                (treasury ? row('Treasury Safe',
                    '<span class="text-xs">' + DusdAltoRenderer._truncAddr(treasury) + '</span> ' +
                    DusdAltoRenderer._ethLink(treasury)) : '') +
            '</tbody></table></div>' +
            // ⚠️ THE PRODUCER CALLS THIS SOLVENCY-CRITICAL AND IT IS ONE FIELD.
            (u.is_seized_basis
                ? '<div class="risk-flag risk-critical mt-3">' +
                    '<span class="font-semibold">seize() is a solvency path, not an admin nicety.</span> ' +
                    esc(u.is_seized_basis) + '</div>'
                : '') +
            '<div id="dusd-usm-history" class="text-xs text-slate-500 mt-3"></div>' +
        '</div>';
    },

    // ---- axis 2: the CDP markets -----------------------------------------
    _cdpHtml: function(backing) {
        var cdp = backing.cdp || {};
        var markets = Array.isArray(cdp.markets) ? cdp.markets : [];
        if (!markets.length) return '';
        // ⚠️ THE FIELD NAMES ARE THE PRODUCER'S: `collateral` (a SYMBOL), `debt`,
        // `coll_value`, `ratio` (a multiple) and `oracle`. My first draft guessed
        // `collateral_symbol` / `collateral_value_usd` and fell through to printing
        // the market ADDRESS in the collateral column with an empty ratio beside
        // it. And the ratio is PUBLISHED — recomputing coll_value/debt here would
        // be deriving what the feed already states.
        var rows = markets.slice().sort(function(a, b) {
            return (b.debt || 0) - (a.debt || 0);
        }).map(function(m) {
            var debt = m.debt, coll = m.coll_value;
            var ratio = typeof m.ratio === 'number' ? m.ratio * 100 : null;
            var cls = ratio == null ? '' : ratio < 110 ? 'text-red-600 font-semibold'
                : ratio < 130 ? 'text-amber-600' : 'text-green-600';
            return '<tr>' +
                '<td class="font-mono text-xs">' + CommonRenderer._escapeAttr(
                    m.collateral || '—') + '</td>' +
                '<td class="text-xs">' + (m.market
                    ? DusdAltoRenderer._truncAddr(m.market) + ' ' +
                      DusdAltoRenderer._ethLink(m.market) : '—') + '</td>' +
                '<td class="text-right font-mono">' + CommonRenderer.formatCurrency(debt) + '</td>' +
                '<td class="text-right font-mono">' + CommonRenderer.formatCurrency(coll) + '</td>' +
                '<td class="text-right font-mono ' + cls + '">' +
                    (ratio != null ? CommonRenderer.formatPercent(ratio, 1) : '—') + '</td>' +
                '<td class="text-[11px] text-slate-400">' +
                    CommonRenderer._escapeAttr(m.oracle || '—') + '</td>' +
            '</tr>';
        }).join('');
        return '<div class="panel">' +
            '<div class="panel-title">CDP markets ' +
                '<span class="text-xs font-normal text-slate-500">(~12% of supply · isolated)</span></div>' +
            '<p class="text-sm text-slate-500 mb-3">Each market is isolated: its collateral answers to ' +
                'its own borrowers, and a shortfall in one does not reach the others. ' +
                '<span class="text-xs">Collateral is marked with each market’s own Alto oracle.</span></p>' +
            '<div class="overflow-x-auto"><table class="data-table"><thead><tr>' +
                '<th>Collateral</th><th>Market</th><th class="text-right">DUSD debt</th>' +
                '<th class="text-right">Collateral (USD)</th><th class="text-right">Ratio</th>' +
                '<th>Mark</th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
        '</div>';
    },

    // ---- axis 3: what an exit actually looks like -------------------------
    // ⚠️ EVERY NUMBER HERE IS DexTracker's OWN, including the arithmetic: the
    // tradable remainder is the producer's float minus the producer's own
    // enumerated non-swap holders, and the subtraction is shown rather than
    // asserted, because the two figures differ by three orders of magnitude and
    // that difference is the finding.
    _exitRealityHtml: function(data) {
        var lq = data.liquidity || {};
        var venues = Array.isArray(lq.venues) ? lq.venues : [];
        var live = venues.filter(function(v) { return v && v.kind === 'swap' && !/exclud|dead/i.test(String(v.status || '')); });
        var pool = live[0];
        if (!pool && !lq.axis_binding_constraint) return '';

        var share = null, dusdBal = null, otherBal = null, otherSym = null;
        if (pool && Array.isArray(pool.balances) && pool.balances.length === 2) {
            var d = pool.balances.find(function(b) { return /dusd/i.test(b.symbol); });
            var o = pool.balances.find(function(b) { return !/dusd/i.test(b.symbol); });
            if (d && o && (d.amount + o.amount) > 0) {
                dusdBal = d.amount; otherBal = o.amount; otherSym = o.symbol;
                share = d.amount / (d.amount + o.amount) * 100;
            }
        }
        // ⚠️ THE SWEEP'S CLOCK, NOT THE BLOCK'S. `liquidity.as_of` is the payload's,
        // and the balances came from the enumeration pass at its own pinned block;
        // quoting the wrong one of the two invites comparison against a figure
        // measured elsewhere (riskAnalyst read 23.33% at a later block).
        var enumBlk = lq.enumeration || {};
        var enumAsOf = enumBlk.as_of || null, enumBlock = enumBlk.pinned_block || null;
        var excl = lq.excluded_liquidity || {};
        var nonSwap = Array.isArray(excl.non_swap_entries) ? excl.non_swap_entries : [];
        var floatUsd = typeof lq.total_2pct_depth === 'number' ? lq.total_2pct_depth : null;

        var shareCls = share == null ? '' :
            share >= DUSD_ALTO_POOL_SHARE_WATCH_PCT ? 'text-red-600' : 'text-slate-700';

        return '<div class="panel">' +
            '<div class="panel-title">Exit reality ' +
                '<span class="text-xs font-normal text-slate-500">(one venue, and the float is the cap)</span></div>' +
            (share != null
                ? '<div class="flex flex-wrap gap-6 mb-3">' +
                    '<div><div class="text-xs text-slate-400 font-medium uppercase">Pool composition</div>' +
                    '<div class="text-2xl font-bold font-mono ' + shareCls + '">' +
                        CommonRenderer.formatPercent(share, 2) + ' DUSD</div>' +
                    '<div class="text-[11px] text-slate-500 mt-1" style="line-height:1.45;">' +
                        CommonRenderer.formatCurrency(dusdBal) + ' DUSD against ' +
                        CommonRenderer.formatCurrency(otherBal) + ' ' +
                        CommonRenderer._escapeAttr(otherSym || '') + '. DUSD is the SCARCE coin here, ' +
                        'which is why the unit quotes at a premium. A move toward ' +
                        DUSD_ALTO_POOL_SHARE_WATCH_PCT + '% is the premium inverting.' +
                        // ⚠️ A COMPOSITION FIGURE WITHOUT ITS CLOCK INVITES A FALSE
                        // COMPARISON. riskAnalyst measured 23.33% at block
                        // 26,053,165 today; this payload's balances are its own
                        // reading at its own as_of, and the two are hours apart on
                        // a pool where third-party deposits move the denominator.
                        (enumAsOf
                            ? ' <span class="text-slate-400">Pool balances read at ' +
                              CommonRenderer._escapeAttr(enumAsOf) +
                              (enumBlock ? ', block ' + CommonRenderer._escapeAttr(enumBlock) : '') +
                              '.</span>'
                            : '') +
                    '</div></div>' +
                  '</div>'
                : '') +
            // ⚠️ THE RESIDUAL IS NOT DERIVED HERE, AND THAT IS DELIBERATE. My first
            // draft subtracted the enumerated non-venue holders from the float and
            // printed the remainder as "third-party hands". The two figures are a
            // USD float and DUSD token counts, read at different blocks by
            // different producers — subtracting them produces a number with no
            // basis, on an asset where the honest answer spans three orders of
            // magnitude. Both inputs are shown; whoever measures the split should
            // publish it as a field. (riskAnalyst has measured it: ask them.)
            (floatUsd != null
                ? '<div class="text-sm text-slate-700 mb-2">' +
                    '<span class="font-semibold">Float that can reach the market: ' +
                    CommonRenderer.formatCurrency(floatUsd) + '</span>' +
                    (nonSwap.length
                        ? '<div class="text-xs text-slate-500 mt-1" style="line-height:1.5;">' +
                          'The producer separately enumerates DUSD held by contracts that are NOT ' +
                          'venues — ' +
                          nonSwap.map(function(e) { return CommonRenderer._escapeAttr(String(e)); }).join('; ') +
                          '. ⚠️ Those are token counts at the enumeration block and the float above is ' +
                          'a USD figure from the depth measurement, so the genuinely third-party ' +
                          'remainder is NOT subtracted here — it would be arithmetic across two bases. ' +
                          (excl.non_swap_reason ? CommonRenderer._escapeAttr(excl.non_swap_reason) : '') +
                          '</div>'
                        : '') +
                  '</div>'
                : '') +
            (lq.axis_binding_constraint && lq.axis_binding_constraint.basis
                ? '<div class="risk-flag risk-warning mb-3"><span class="font-semibold">Binding leg — ' +
                    CommonRenderer._escapeAttr(String(lq.axis_binding_constraint.leg || '').replace(/_/g, ' ')) +
                    ':</span> ' + CommonRenderer._escapeAttr(lq.axis_binding_constraint.basis) + '</div>'
                : '') +
            this._regimeHtml(lq) +
            this._downstreamHtml(lq) +
        '</div>';
    },

    // The counterfactual the producer measured: what the float becomes if the
    // issuer withdraws its LP. ⚠️ Rendered as the producer's own note, not
    // recomputed — the scaling uses a StableSwap invariant property and deriving
    // it here would be a second implementation of someone else's measurement.
    _regimeHtml: function(lq) {
        var r = lq.regimes;
        if (!r || typeof r !== 'object' || !r.note) return '';
        return '<details class="score-basis"><summary class="score-basis-toggle">' +
            'If the issuer withdraws its LP — the producer’s scaled ladder</summary>' +
            '<div class="score-basis-body">' + CommonRenderer._mdInlineHtml(String(r.note)) +
            (r.pinned_block ? '<div class="text-[11px] text-slate-400 mt-1">Pinned at block ' +
                CommonRenderer._escapeAttr(r.pinned_block) +
                (r.pinned_block_time_utc ? ' · ' + CommonRenderer._escapeAttr(r.pinned_block_time_utc) : '') +
                '</div>' : '') +
            '</div></details>';
    },

    // Hops 2-3 of the dollar exit. These are NOT DUSD venues and the producer
    // says so in the payload; they are here because their inventory bounds the
    // exit, which is the only reason a DUSD holder would care about them.
    _downstreamHtml: function(lq) {
        var d = lq.downstream_route_legs;
        if (!d || typeof d !== 'object') return '';
        var legs = Object.keys(d).filter(function(k) {
            return k !== 'note' && d[k] && typeof d[k] === 'object';
        });
        if (!legs.length) return '';
        var rows = legs.map(function(k) {
            var l = d[k];
            return '<tr>' +
                '<td class="text-xs">' + CommonRenderer._escapeAttr(k.replace(/_/g, ' ')) + '</td>' +
                '<td class="text-xs">' + (l.address ? DusdAltoRenderer._truncAddr(l.address) + ' ' +
                    DusdAltoRenderer._ethLink(l.address) : '—') + '</td>' +
                '<td class="text-xs">' + CommonRenderer._escapeAttr(l.kind || '—') + '</td>' +
                '<td class="text-xs">' + CommonRenderer._escapeAttr(l.rate || '—') + '</td>' +
            '</tr>';
        }).join('');
        return '<details class="score-basis mt-2"><summary class="score-basis-toggle">' +
            'The dollar legs after DUSD (hops 2–3)</summary>' +
            '<div class="score-basis-body">' +
            (d.note ? '<div class="mb-2">' + CommonRenderer._escapeAttr(String(d.note)) + '</div>' : '') +
            '<div class="overflow-x-auto"><table class="data-table"><thead><tr>' +
                '<th>Leg</th><th>Address</th><th>Kind</th><th>Rate</th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
            '</div></details>';
    },

    // ---- axis 5/6 input: who can mint ------------------------------------
    // ⚠️ SYNCED SEPARATELY AND NEVER BEFORE COPIED: `_minters` was not a block
    // type in sync_and_push.sh, so PegTracker's enumeration sat in its own repo
    // for four days. On an 822K-supply token the minter set IS the admin surface.
    _loadMinters: function(data) {
        var slot = document.getElementById('dusd-minters');
        if (!slot) return;
        var ref = (data.asset_slug || 'dusd_alto').replace(/-/g, '_') + '_minters.json';
        var nocache = Math.floor(Date.now() / 60000);
        fetch('data/' + ref + '?nocache=' + nocache)
            .then(function(r) { return r.ok ? r.json() : null; })
            .then(function(j) {
                var list = j && Array.isArray(j.minters) ? j.minters : null;
                if (!list || !list.length) { slot.remove(); return; }
                slot.innerHTML = DusdAltoRenderer._mintersHtml(j, list);
            })
            .catch(function() { slot.remove(); });
    },

    _mintersHtml: function(j, list) {
        var cells = list.map(function(a) {
            return '<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 ' +
                'text-[11px] font-mono text-slate-600 mr-1 mb-1">' +
                DusdAltoRenderer._truncAddr(a) + DusdAltoRenderer._ethLink(a) + '</span>';
        }).join('');
        return '<div class="panel">' +
            '<div class="panel-title">Who can mint ' +
                '<span class="text-xs font-normal text-slate-500">(' + list.length + ' live minters)</span></div>' +
            // ⚠️ The producer's own method line, verbatim. My first draft
            // paraphrased it AND printed it, so the panel said the same thing
            // twice in two voices.
            (j.discovery_basis
                ? '<p class="text-sm text-slate-500 mb-3">' +
                  CommonRenderer._escapeAttr(j.discovery_basis) + '</p>'
                : '') +
            '<div>' + cells + '</div>' +
            (j.last_scanned_block
                ? '<div class="text-[11px] text-slate-400 mt-2">Scanned through block ' +
                  CommonRenderer._escapeAttr(j.last_scanned_block) +
                  (j.discovered_at ? ' · ' + CommonRenderer.formatDate(j.discovered_at) : '') + '</div>'
                : '') +
        '</div>';
    },

    // ---- axis 1: the lifetime record -------------------------------------
    // ⚠️ A SEPARATE CHART, NEVER SPLICED INTO THE LIVE SERIES. PegTracker
    // declares the archive "HELD standalone by operator decision; it is not
    // spliced into this series" and the reason is visible in the data: the venue
    // CHANGES mid-life (UniV3 DUSD/USDC while it was liquid, Curve thereafter),
    // so one continuous line would imply one continuous measurement basis.
    _loadLifetimePeg: function(data) {
        var slot = document.getElementById('dusd-lifetime-peg');
        if (!slot) return;
        if (typeof Chart === 'undefined') { slot.remove(); return; }
        var ref = (data.asset_slug || 'dusd_alto').replace(/-/g, '_') + '_peg_backfill.json';
        var nocache = Math.floor(Date.now() / 60000);
        fetch('data/' + ref + '?nocache=' + nocache)
            .then(function(r) { return r.ok ? r.json() : null; })
            .then(function(j) {
                var rows = j && Array.isArray(j.rows) ? j.rows.filter(function(x) {
                    return x && x.timestamp && typeof x.market_price === 'number';
                }) : [];
                if (rows.length < 10) { slot.remove(); return; }
                slot.innerHTML = DusdAltoRenderer._lifetimePegShellHtml(j, rows);
                DusdAltoRenderer._drawLifetimePeg(rows);
            })
            .catch(function() { slot.remove(); });
    },

    _lifetimePegShellHtml: function(j, rows) {
        var byVenue = {};
        rows.forEach(function(r) { byVenue[r.venue || 'unknown'] = (byVenue[r.venue || 'unknown'] || 0) + 1; });
        var excluded = rows.filter(function(r) { return Array.isArray(r.excluded) && r.excluded.length; }).length;
        var prices = rows.map(function(r) { return r.market_price; });
        var min = Math.min.apply(null, prices), max = Math.max.apply(null, prices);
        return '<div class="panel">' +
            '<div class="panel-title">Lifetime peg record ' +
                '<span class="text-xs font-normal text-slate-500">(' + rows.length +
                ' archive samples — a separate series)</span></div>' +
            '<div class="risk-flag risk-info mb-3">' +
                '<span class="font-semibold">Not spliced into the live chart, deliberately.</span> ' +
                'This is an archive reconstruction whose VENUE changes mid-life (' +
                Object.keys(byVenue).map(function(v) {
                    return CommonRenderer._escapeAttr(v) + ' ' + byVenue[v];
                }).join(' · ') + '), so joining it to the hourly series would imply one ' +
                'continuous measurement basis. The producer holds it standalone; this renders it ' +
                'as what it is.' +
                (excluded ? ' <span class="text-xs">' + excluded + ' sample' + (excluded === 1 ? '' : 's') +
                    ' carry the producer’s own exclusion flag and are plotted as gaps.</span>' : '') +
            '</div>' +
            '<div class="flex flex-wrap gap-6 mb-2 text-sm">' +
                '<div><span class="text-slate-400 text-xs uppercase">Low</span> ' +
                    '<span class="font-mono font-semibold">' + min.toFixed(4) + '</span></div>' +
                '<div><span class="text-slate-400 text-xs uppercase">High</span> ' +
                    '<span class="font-mono font-semibold">' + max.toFixed(4) + '</span></div>' +
                '<div><span class="text-slate-400 text-xs uppercase">Samples</span> ' +
                    '<span class="font-mono font-semibold">' + rows.length + '</span></div>' +
            '</div>' +
            (j.statistic ? '<div class="text-[11px] text-slate-400 mb-2">' +
                CommonRenderer._escapeAttr(j.statistic) + '</div>' : '') +
            '<div class="chart-container"><canvas id="dusd-lifetime-chart"></canvas></div>' +
        '</div>';
    },

    _drawLifetimePeg: function(rows) {
        var ctx = document.getElementById('dusd-lifetime-chart');
        if (!ctx) return;
        var labels = rows.map(function(r) {
            return new Date(r.timestamp.endsWith('Z') ? r.timestamp : r.timestamp + 'Z');
        });
        // One dataset per venue so the basis change is visible as two segments
        // rather than one line pretending to be homogeneous.
        var venues = [];
        rows.forEach(function(r) { if (venues.indexOf(r.venue) < 0) venues.push(r.venue); });
        var palette = { univ3_dusd_usdc: '#94a3b8', curve_dusd_frxusd: '#6366f1' };
        var sets = venues.map(function(v, i) {
            return {
                label: String(v).replace(/_/g, ' '),
                data: rows.map(function(r) {
                    return (r.venue === v && !(Array.isArray(r.excluded) && r.excluded.length))
                        ? r.market_price : null;
                }),
                borderColor: palette[v] || ['#f59e0b', '#14b8a6'][i % 2],
                fill: false, tension: 0.2, pointRadius: 0, borderWidth: 2, spanGaps: false
            };
        });
        if (window._dusdLifetimeChart) window._dusdLifetimeChart.destroy();
        window._dusdLifetimeChart = new Chart(ctx, {
            type: 'line',
            data: { labels: labels, datasets: sets },
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    x: { type: 'time', time: { unit: 'month' }, ticks: { font: { size: 10 } } },
                    y: { ticks: { font: { size: 10 }, callback: function(v) { return v.toFixed(3); } } }
                },
                plugins: {
                    legend: { labels: { font: { size: 10 }, boxWidth: 12 } },
                    annotation: { annotations: {
                        par: { type: 'line', yMin: 1, yMax: 1, borderColor: '#94a3b8',
                               borderWidth: 1, borderDash: [4, 4],
                               label: { content: 'par', display: true, position: 'start',
                                        font: { size: 9 }, color: '#94a3b8' } }
                    } }
                }
            }
        });
    },

    // ---- helpers ---------------------------------------------------------
    // ⚠️ LOCAL, because there is no shared truncator in common.js — syrupusdc.js
    // carries its own `_truncAddr` for the same reason. Not promoted to the
    // shared layer as a drive-by: four renderers would then need re-checking.
    _truncAddr: function(a) {
        var s = String(a || '');
        return s.length > 12 ? s.slice(0, 6) + '…' + s.slice(-4) : s;
    },

    _ethLink: function(addr) {
        if (!addr) return '';
        return '<a href="https://etherscan.io/address/' + CommonRenderer._escapeAttr(addr) +
            '" target="_blank" class="text-blue-500 hover:underline text-xs" title="' +
            CommonRenderer._escapeAttr(addr) + '">↗</a>';
    }
};
