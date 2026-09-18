/** BOLD additions. Baseline content stays in CommonRenderer; every panel is axis-slotted. */
var BOLDRenderer = {
    _e: function(v) { return CommonRenderer._escapeAttr(String(v == null ? '' : v)); },
    _pct: function(v, n) { return v == null ? 'not measured' : Number(v).toFixed(n == null ? 1 : n) + '%'; },
    _money: function(v) { return v == null ? 'not measured' : CommonRenderer.formatCurrency(Number(v)); },
    _panel: function(title, body) {
        return '<div class="panel"><div class="panel-title">' + title + '</div>' + body + '</div>';
    },
    _marketRungs: function(liq) {
        return (((liq || {}).depth || {}).rungs || []).filter(function(r) {
            return r && r.status === 'ok' && typeof r.size_usd === 'number' &&
                typeof r.slippage_bps_debiased === 'number';
        }).sort(function(a, b) { return a.size_usd - b.size_usd; });
    },
    _thresholdEvidence: function(liq, thresholdBps) {
        var rows = this._marketRungs(liq), lower = null, upper = null;
        rows.forEach(function(r) {
            if (r.slippage_bps_debiased >= -thresholdBps && (!lower || r.size_usd > lower.size_usd)) lower = r;
            if (r.slippage_bps_debiased < -thresholdBps && (!upper || r.size_usd < upper.size_usd)) upper = r;
        });
        return { lower: lower, upper: upper };
    },
    _applyAxis3Headline: function(liq) {
        var evidence = this._thresholdEvidence(liq, 50);
        var cards = Array.prototype.slice.call(document.querySelectorAll('#summary-cards .summary-card'));
        var card = cards.filter(function(c) {
            var label = c.querySelector('.card-label');
            return label && label.textContent.trim() === 'Liquidity & Exit';
        })[0];
        if (card) {
            var value = card.querySelector('.card-value');
            var sub = value && value.nextElementSibling;
            if (value) value.textContent = evidence.lower ? '≥' + this._money(evidence.lower.size_usd) : 'unmeasured';
            if (sub) sub.textContent = '0.5% depth floor' +
                (evidence.upper ? ' · crossing below ' + this._money(evidence.upper.size_usd) : '');
        }
        var head = document.getElementById('axis-liquidity-head');
        if (head) {
            var rating = head.querySelector('.axis-rating');
            if (rating) {
                rating.title = 'Liquidity rating with the headline expressed as executable depth inside 0.5% incremental impact.';
            }
            var axisSub = head.querySelector('.axis-sub');
            if (axisSub) axisSub.textContent = 'usable market exit & primary redemption';
            Array.prototype.slice.call(head.querySelectorAll('.depth-scope, .axis-basis-note')).forEach(function(el) {
                el.remove();
            });
            var note = document.createElement('div');
            note.className = 'axis-basis-note';
            note.innerHTML = '<div class="text-[11px] text-slate-500">Headline uses 0.5% marginal sell depth; the 2% crossing remains folded as severe-stress evidence.</div>';
            head.appendChild(note);
        }
    },
    render: function(data) {
        if (data.view_slug !== 'bold') return;
        var a = data.asset_specific || {}, s = data.summary || {};
        var t = a.alert_thresholds || {}, branches = Array.isArray(a.branches) ? a.branches : [];
        var liq = data.liquidity || {}, exit = liq.primary_exit || {};

        var pegSlot = document.getElementById('peg-extra-panels');
        if (pegSlot) pegSlot.innerHTML = this._redemptionPanel(s, exit, data.peg || {});

        var backingSlot = document.getElementById('backing-extra-panels');
        if (backingSlot) backingSlot.innerHTML = this._branchPanel(branches, t) + this._reconciliationPanel(s, t);

        var liquiditySlot = document.getElementById('liquidity-extra-panels');
        this._applyAxis3Headline(liq);
        var liquidityBody = document.getElementById('axis-liquidity-body');
        if (liquidityBody) liquidityBody.innerHTML = this._axis3Panel(liq, s);
        if (liquiditySlot) liquiditySlot.innerHTML = this._stabilityPanel(branches, t);

        var dependencySlot = document.getElementById('dependencies-extra-panels');
        if (dependencySlot) dependencySlot.innerHTML = this._sBoldPanel(a.sbold || {});
    },
    _redemptionPanel: function(s, exit, peg) {
        var rows = Array.isArray(exit.fee_ladder) ? exit.fee_ladder : [];
        var floor = s.redemption_floor == null ? null : Number(s.redemption_floor);
        var market = peg.market_price == null ? null : Number(peg.market_price);
        var floorGapBps = floor && market != null ? (market - floor) / floor * 10000 : null;
        var floorGapText = floorGapBps == null ? 'not measured' :
            Math.abs(floorGapBps).toFixed(1) + ' bps ' + (floorGapBps >= 0 ? 'above' : 'below');
        var table = rows.length ? '<table class="data-table"><thead><tr><th>Redemption size</th><th class="text-right">Effective fee</th></tr></thead><tbody>' +
            rows.map(function(r) { return '<tr><td>' + BOLDRenderer._money(r.size_usd) + '</td><td class="text-right font-mono">' + BOLDRenderer._pct(r.effective_redemption_fee_pct, 2) + '</td></tr>'; }).join('') +
            '</tbody></table>' : '<p class="text-sm text-amber-700">No size-dependent redemption ladder is published.</p>';
        return this._panel('Redemption mechanics — spot is not size execution',
            '<div class="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">' +
            '<div class="summary-card"><div class="card-label">Base rate</div><div class="card-value">' + this._pct(s.base_rate_pct, 3) + '</div></div>' +
            '<div class="summary-card"><div class="card-label">Spot redemption fee</div><div class="card-value">' + this._pct(s.redemption_rate_pct, 3) + '</div></div>' +
            '<div class="summary-card"><div class="card-label">Spot implied floor</div><div class="card-value">$' + (floor == null ? '—' : floor.toFixed(4)) + '</div></div>' +
            '<div class="summary-card"><div class="card-label">Market vs spot floor</div><div class="card-value">' + floorGapText + '</div><div class="text-xs text-slate-400">mechanism-relative position</div></div></div>' +
            '<p class="text-sm text-slate-500 mb-3">The implied floor is the size-zero rate. It is not an executable floor for a large holder; protocol redemption cost rises with size.</p>' + table);
    },
    _branchPanel: function(branches, t) {
        if (!branches.length) return this._panel('Independent branch health', '<p class="text-sm text-amber-700">Branch state is not published.</p>');
        // ⚠️ `Number(x || 0)` HERE DID NOT MISLABEL, IT DISABLED THE CHECK. A missing
        // branch_cr_less_than_ccr_plus_pp collapsed headroom to 0, so every branch
        // passed; a missing stability_pool_coverage_pct_lt collapsed the floor to 0,
        // so NO branch could ever be below it — wstETH's live 31.75% warning would
        // have vanished silently. Invisible at review time because both thresholds
        // are published today. An absent threshold is an ABSENT CHECK, not a zero.
        var headroom = (typeof t.branch_cr_less_than_ccr_plus_pp === 'number') ? t.branch_cr_less_than_ccr_plus_pp : null;
        var spFloor  = (typeof t.stability_pool_coverage_pct_lt === 'number') ? t.stability_pool_coverage_pct_lt : null;
        var missing = [];
        if (headroom === null) missing.push('CR headroom');
        if (spFloor === null) missing.push('Stability Pool floor');
        var rows = branches.map(function(b) {
            var crWarn = headroom !== null && b.collateral_ratio_pct < b.ccr_pct + headroom;
            var spWarn = spFloor !== null && b.stability_pool_coverage_pct < spFloor;
            var shutdown = Number(b.shutdown_time || 0) !== 0;
            return '<tr><td class="font-semibold">' + BOLDRenderer._e(b.symbol) + '</td><td class="text-right">' + BOLDRenderer._money(b.debt_bold) + '</td>' +
                '<td class="text-right font-mono ' + (crWarn ? 'text-amber-700 font-semibold' : '') + '">' + BOLDRenderer._pct(b.collateral_ratio_pct, 1) + '</td>' +
                '<td class="text-right font-mono">' + BOLDRenderer._pct(b.mcr_pct, 0) + ' / ' + BOLDRenderer._pct(b.ccr_pct, 0) + ' / ' + BOLDRenderer._pct(b.scr_pct, 0) + '</td>' +
                '<td class="text-right font-mono ' + (spWarn ? 'text-amber-700 font-semibold' : '') + '">' + BOLDRenderer._pct(b.stability_pool_coverage_pct, 1) + '</td>' +
                '<td class="text-right">' + Number(b.troves || 0) + '</td><td class="text-right ' + (shutdown ? 'text-red-700 font-semibold' : 'text-green-700') + '">' + (shutdown ? BOLDRenderer._e(b.shutdown_time) : 'active') + '</td></tr>';
        }).join('');
        return this._panel('Independent branch health', '<p class="text-sm text-slate-500 mb-3">Aggregate CR can hide an individual branch nearing its own floor. MCR / CCR / SCR and warning bands come from producer fields.</p>' + (missing.length ? '<p class="text-sm text-amber-700 mb-3">\u26a0\ufe0f Not checked: <strong>' + missing.join(' and ') + '</strong> \u2014 the producer published no such threshold in <span class="font-mono">alert_thresholds</span>, so no band is applied. An unbanded column is UNCHECKED, not clear.</p>' : '') + '<div class="overflow-x-auto"><table class="data-table"><thead><tr><th>Branch</th><th class="text-right">Debt</th><th class="text-right">CR</th><th class="text-right">MCR / CCR / SCR</th><th class="text-right">SP coverage</th><th class="text-right">Troves</th><th class="text-right">State</th></tr></thead><tbody>' + rows + '</tbody></table></div>');
    },
    _reconciliationPanel: function(s, t) {
        // ⚠️ Same idiom, opposite failure: a missing limit collapsed to 0, so EVERY
        // gap exceeded it and the panel alarmed permanently. Absent = unchecked.
        var limit = (typeof t.abs_reconciliation_gap_pct_gt === 'number') ? t.abs_reconciliation_gap_pct_gt : null;
        var gap = Math.abs(Number(s.reconciliation_gap_pct || 0));
        return this._panel('Supply ↔ branch-debt reconciliation', '<div class="grid grid-cols-1 md:grid-cols-3 gap-3"><div class="summary-card"><div class="card-label">Token supply</div><div class="card-value">' + this._money(s.total_supply) + '</div></div><div class="summary-card"><div class="card-label">Summed branch debt</div><div class="card-value">' + this._money(s.total_debt) + '</div></div><div class="summary-card"><div class="card-label">Gap</div><div class="card-value ' + (limit === null ? 'text-slate-600' : (gap > limit ? 'text-red-700' : 'text-green-700')) + '">' + this._pct(s.reconciliation_gap_pct, 4) + '</div><div class="text-xs ' + (limit === null ? 'text-amber-700' : 'text-slate-400') + '">' + (limit === null ? '\u26a0\ufe0f no alert threshold published \u2014 unbanded, not clear' : 'alert above ' + this._pct(limit, 2)) + '</div></div></div><p class="text-xs text-slate-400 mt-3">This is a data-integrity invariant, not a solvency ratio.</p>');
    },
    _exitPanel: function(liq, s) {
        var d = liq.depth || {}, ex = liq.primary_exit || {}, excluded = liq.excluded_liquidity || {};
        return this._panel('Two exits: size-bound market vs cost-bound protocol', '<div class="grid grid-cols-1 md:grid-cols-2 gap-4"><div class="summary-card"><div class="card-label">Secondary market</div><div class="card-value">' + this._money(d.depth_usd) + '</div><div class="text-xs text-slate-500">' + this._e(d.status || 'unmeasured') + ' at ' + this._e(d.threshold_bps) + ' bps; tested through ' + this._money(d.tested_through_input_usd) + '</div>' + (d.is_floor === true ? '<div class="text-[11px] text-amber-700">lower bound \u2014 the crossing is above this</div>' : '') + '</div><div class="summary-card"><div class="card-label">Protocol redemption</div><div class="card-value">permissionless</div><div class="text-xs text-slate-500">Size-unbounded, fee rises with size; spot fee ' + this._pct(s.redemption_rate_pct, 3) + '</div></div></div>' + (d.basis ? '<p class="text-xs text-slate-500 mt-3 leading-relaxed">' + this._e(d.basis) + '</p>' : '') + '<details class="text-sm text-slate-500 mt-3"><summary class="cursor-pointer font-medium">Liquidity exclusions</summary><div class="mt-2">Excluded from swap depth: ' + this._e((excluded.lp_wrappers || []).join(', ') || 'none declared') + '. ' + this._e(excluded.lp_wrapper_reason || '') + ' ' + this._e(excluded.non_swap_reason || '') + '</div></details>');
    },
    _axis3Panel: function(liq, s) {
        var evidence = this._thresholdEvidence(liq, 50);
        var rows = this._marketRungs(liq);
        var fees = (((liq || {}).primary_exit || {}).fee_ladder || []);
        var tableRows = rows.map(function(r) {
            var venues = Array.isArray(r.route_venues) ? r.route_venues.length : null;
            return '<tr><td class="font-semibold">' + BOLDRenderer._money(r.size_usd) + '</td>' +
                '<td class="text-right font-mono">' + BOLDRenderer._pct(Math.abs(r.slippage_bps_debiased) / 100, 2) + '</td>' +
                '<td class="text-right font-mono">' + BOLDRenderer._money(r.amount_out_tokens) + '</td>' +
                '<td class="text-right">' + (venues == null ? '—' : venues + (venues === 1 ? ' venue' : ' venues')) + '</td></tr>';
        }).join('');
        var redemptionRows = fees.map(function(f) {
            return '<tr><td class="font-semibold">' + BOLDRenderer._money(f.size_usd) + '</td>' +
                '<td class="text-right font-mono">' + BOLDRenderer._pct(f.effective_redemption_fee_pct, 2) + '</td></tr>';
        }).join('');
        var headline = evidence.lower ? '≥' + this._money(evidence.lower.size_usd) : 'unmeasured';
        var bracket = evidence.lower && evidence.upper
            ? this._money(evidence.lower.size_usd) + '–' + this._money(evidence.upper.size_usd)
            : 'not located';
        var asOf = ((liq.depth || {}).quote || {}).quoted_as_of || liq.as_of || 'time not published';
        return this._panel('Usable market exit',
            '<div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">' +
            '<div class="summary-card"><div class="card-label">0.5% depth</div><div class="card-value">' + headline + '</div><div class="text-xs text-slate-500">measured floor</div></div>' +
            '<div class="summary-card"><div class="card-label">Current bracket</div><div class="card-value">' + bracket + '</div><div class="text-xs text-slate-500">targeted solver not yet enabled</div></div>' +
            '<div class="summary-card"><div class="card-label">Quoted at</div><div class="card-value text-base">' + this._e(asOf) + '</div><div class="text-xs text-slate-500">routed BOLD → USDC</div></div></div>' +
            '<div class="text-sm font-semibold text-slate-700 mb-2">Market depth ladder</div>' +
            '<div class="overflow-x-auto"><table class="data-table"><thead><tr><th>Sell size</th><th class="text-right">Additional impact</th><th class="text-right">Net output</th><th class="text-right">Route</th></tr></thead><tbody>' + tableRows + '</tbody></table></div>' +
            '<details class="text-sm text-slate-500 mt-3"><summary class="cursor-pointer font-medium">Stress and methodology</summary><div class="mt-2">The current broad ladder only proves that the 0.5% crossing lies between ' + bracket + '. The 2% result remains a severe-stress measure and is not used as the headline. Additional impact is measured relative to the smallest successful routed quote.</div></details>') +
            this._panel('Protocol redemption — separate exit route',
                '<div class="grid grid-cols-1 md:grid-cols-2 gap-4"><div><div class="summary-card mb-3"><div class="card-label">Access</div><div class="card-value">permissionless</div><div class="text-xs text-slate-500">continuous protocol call · fee rises with size</div></div><p class="text-sm text-slate-500">BOLD is exchanged for a protocol-selected mix of WETH, wstETH and rETH. This is not the same settlement as a market sale to USDC.</p></div>' +
                '<div class="overflow-x-auto"><table class="data-table"><thead><tr><th>Redemption size</th><th class="text-right">Effective fee</th></tr></thead><tbody>' + redemptionRows + '</tbody></table></div></div>');
    },
    _stabilityPanel: function(branches, t) {
        var floor = Number(t.stability_pool_coverage_pct_lt || 0);
        return this._panel('Stability Pool loss-absorption coverage', '<p class="text-sm text-slate-500 mb-3">Pre-funded BOLD available to absorb branch liquidations before redistribution to surviving troves.</p><div class="grid grid-cols-1 md:grid-cols-3 gap-3">' + branches.map(function(b) { var low=b.stability_pool_coverage_pct < floor; return '<div class="summary-card"><div class="card-label">' + BOLDRenderer._e(b.symbol) + '</div><div class="card-value ' + (low ? 'text-amber-700' : 'text-green-700') + '">' + BOLDRenderer._pct(b.stability_pool_coverage_pct,1) + '</div><div class="text-xs text-slate-400">warning below ' + BOLDRenderer._pct(floor,0) + '</div></div>'; }).join('') + '</div>');
    },
    _sBoldPanel: function(s) {
        if (!s.address) return this._panel('sBOLD downstream wrapper', '<p class="text-sm text-amber-700">sBOLD state is not published.</p>');
        return this._panel('sBOLD downstream wrapper', '<div class="grid grid-cols-1 md:grid-cols-3 gap-3"><div class="summary-card"><div class="card-label">Share of BOLD supply</div><div class="card-value">' + this._pct(s.pct_of_supply,1) + '</div></div><div class="summary-card"><div class="card-label">Assets per share</div><div class="card-value">' + Number(s.assets_per_share).toFixed(4) + '</div></div><div class="summary-card"><div class="card-label">Admin state</div><div class="card-value ' + (s.paused ? 'text-red-700' : 'text-green-700') + '">' + (s.paused ? 'paused' : 'active') + '</div></div></div><p class="text-xs text-slate-400 mt-3">Wrapper owner ' + this._e(s.owner) + '. This mutable wrapper is downstream of immutable BOLD core; its authority is priced on Contract & Admin.</p>');
    }
};
