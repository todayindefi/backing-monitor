/** BOLD additions. Baseline content stays in CommonRenderer; every panel is axis-slotted. */
var BOLDRenderer = {
    _e: function(v) { return CommonRenderer._escapeAttr(String(v == null ? '' : v)); },
    _pct: function(v, n) { return v == null ? 'not measured' : Number(v).toFixed(n == null ? 1 : n) + '%'; },
    _money: function(v) { return v == null ? 'not measured' : CommonRenderer.formatCurrency(Number(v)); },
    _panel: function(title, body) {
        return '<div class="panel"><div class="panel-title">' + title + '</div>' + body + '</div>';
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
        if (liquiditySlot) liquiditySlot.innerHTML = this._exitPanel(liq, s) + this._stabilityPanel(branches, t);

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
        var headroom = Number(t.branch_cr_less_than_ccr_plus_pp || 0), spFloor = Number(t.stability_pool_coverage_pct_lt || 0);
        var rows = branches.map(function(b) {
            var crWarn = b.collateral_ratio_pct < b.ccr_pct + headroom;
            var spWarn = b.stability_pool_coverage_pct < spFloor;
            var shutdown = Number(b.shutdown_time || 0) !== 0;
            return '<tr><td class="font-semibold">' + BOLDRenderer._e(b.symbol) + '</td><td class="text-right">' + BOLDRenderer._money(b.debt_bold) + '</td>' +
                '<td class="text-right font-mono ' + (crWarn ? 'text-amber-700 font-semibold' : '') + '">' + BOLDRenderer._pct(b.collateral_ratio_pct, 1) + '</td>' +
                '<td class="text-right font-mono">' + BOLDRenderer._pct(b.mcr_pct, 0) + ' / ' + BOLDRenderer._pct(b.ccr_pct, 0) + ' / ' + BOLDRenderer._pct(b.scr_pct, 0) + '</td>' +
                '<td class="text-right font-mono ' + (spWarn ? 'text-amber-700 font-semibold' : '') + '">' + BOLDRenderer._pct(b.stability_pool_coverage_pct, 1) + '</td>' +
                '<td class="text-right">' + Number(b.troves || 0) + '</td><td class="text-right ' + (shutdown ? 'text-red-700 font-semibold' : 'text-green-700') + '">' + (shutdown ? BOLDRenderer._e(b.shutdown_time) : 'active') + '</td></tr>';
        }).join('');
        return this._panel('Independent branch health', '<p class="text-sm text-slate-500 mb-3">Aggregate CR can hide an individual branch nearing its own floor. MCR / CCR / SCR and warning bands come from producer fields.</p><div class="overflow-x-auto"><table class="data-table"><thead><tr><th>Branch</th><th class="text-right">Debt</th><th class="text-right">CR</th><th class="text-right">MCR / CCR / SCR</th><th class="text-right">SP coverage</th><th class="text-right">Troves</th><th class="text-right">State</th></tr></thead><tbody>' + rows + '</tbody></table></div>');
    },
    _reconciliationPanel: function(s, t) {
        var limit = Number(t.abs_reconciliation_gap_pct_gt || 0), gap = Math.abs(Number(s.reconciliation_gap_pct || 0));
        return this._panel('Supply ↔ branch-debt reconciliation', '<div class="grid grid-cols-1 md:grid-cols-3 gap-3"><div class="summary-card"><div class="card-label">Token supply</div><div class="card-value">' + this._money(s.total_supply) + '</div></div><div class="summary-card"><div class="card-label">Summed branch debt</div><div class="card-value">' + this._money(s.total_debt) + '</div></div><div class="summary-card"><div class="card-label">Gap</div><div class="card-value ' + (gap > limit ? 'text-red-700' : 'text-green-700') + '">' + this._pct(s.reconciliation_gap_pct, 4) + '</div><div class="text-xs text-slate-400">alert above ' + this._pct(limit, 2) + '</div></div></div><p class="text-xs text-slate-400 mt-3">This is a data-integrity invariant, not a solvency ratio.</p>');
    },
    _exitPanel: function(liq, s) {
        var d = liq.depth || {}, ex = liq.primary_exit || {}, excluded = liq.excluded_liquidity || {};
        return this._panel('Two exits: size-bound market vs cost-bound protocol', '<div class="grid grid-cols-1 md:grid-cols-2 gap-4"><div class="summary-card"><div class="card-label">Secondary market</div><div class="card-value">' + this._money(d.depth_usd) + '</div><div class="text-xs text-slate-500">' + this._e(d.status || 'unmeasured') + ' at ' + this._e(d.threshold_bps) + ' bps; tested through ' + this._money(d.tested_through_input_usd) + '</div></div><div class="summary-card"><div class="card-label">Protocol redemption</div><div class="card-value">permissionless</div><div class="text-xs text-slate-500">Size-unbounded, fee rises with size; spot fee ' + this._pct(s.redemption_rate_pct, 3) + '</div></div></div><p class="text-sm text-slate-500 mt-3">Excluded from swap depth: ' + this._e((excluded.lp_wrappers || []).join(', ') || 'none declared') + '. ' + this._e(excluded.lp_wrapper_reason || '') + ' ' + this._e(excluded.non_swap_reason || '') + '</p>');
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
