/** BOLD additions. Baseline content stays in CommonRenderer; every panel is axis-slotted. */
var BOLDRenderer = {
    _e: function(v) { return CommonRenderer._escapeAttr(String(v == null ? '' : v)); },
    _pct: function(v, n) { return v == null ? 'not measured' : Number(v).toFixed(n == null ? 1 : n) + '%'; },
    _money: function(v) { return v == null ? 'not measured' : CommonRenderer.formatCurrency(Number(v)); },
    _panel: function(title, body) {
        return '<div class="panel"><div class="panel-title">' + title + '</div>' + body + '</div>';
    },
    _axis3PreviewEnabled: function() {
        return new URLSearchParams(window.location.search).get('axis3') === 'preview';
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
    _applyAxis3PreviewTile: function(liq) {
        var evidence = this._thresholdEvidence(liq, 50);
        var cards = Array.prototype.slice.call(document.querySelectorAll('#summary-cards .summary-card'));
        var card = cards.filter(function(c) {
            var label = c.querySelector('.card-label');
            return label && label.textContent.trim() === 'Liquidity & Exit';
        })[0];
        if (card) {
            var value = card.querySelector('.card-value');
            var sub = value && value.nextElementSibling;
            var chip = card.querySelector('.axis-rating');
            if (value) value.textContent = evidence.lower ? '≥' + this._money(evidence.lower.size_usd) : 'unmeasured';
            if (sub) sub.textContent = '50 bp depth floor' +
                (evidence.upper ? ' · crossing below ' + this._money(evidence.upper.size_usd) : '');
            if (chip) {
                chip.className = 'axis-rating r-na';
                chip.textContent = 'Preview · measured range';
                chip.title = 'Preview only. No liquidity score is inferred from a coarse 50 bp bracket.';
            }
        }
        var head = document.getElementById('axis-liquidity-head');
        if (head) {
            var rating = head.querySelector('.axis-rating');
            if (rating) {
                rating.className = 'axis-rating r-na';
                rating.textContent = 'Preview · 50 bp depth';
                rating.title = 'Preview only. The current feed brackets but does not yet solve the 50 bp crossing.';
            }
            var axisSub = head.querySelector('.axis-sub');
            if (axisSub) axisSub.textContent = 'usable market exit & primary redemption';
            Array.prototype.slice.call(head.querySelectorAll('.depth-scope, .axis-basis-note')).forEach(function(el) {
                el.remove();
            });
            var note = document.createElement('div');
            note.className = 'axis-basis-note';
            note.innerHTML = '<div class="text-[11px] text-slate-500">Preview uses 50 bp marginal sell depth; the existing 2% measure remains folded as severe-stress evidence.</div>';
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
        if (this._axis3PreviewEnabled()) {
            this._applyAxis3PreviewTile(liq);
            var liquidityBody = document.getElementById('axis-liquidity-body');
            if (liquidityBody) liquidityBody.innerHTML = this._axis3PreviewPanel(liq, s);
            if (liquiditySlot) liquiditySlot.innerHTML = this._stabilityPanel(branches, t);
        } else if (liquiditySlot) {
            liquiditySlot.innerHTML = this._exitPanel(liq, s) + this._stabilityPanel(branches, t);
        }

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
        return this._panel('Two exits: size-bound market vs cost-bound protocol', '<div class="grid grid-cols-1 md:grid-cols-2 gap-4"><div class="summary-card"><div class="card-label">Secondary market</div><div class="card-value">' + this._money(d.depth_usd) + '</div><div class="text-xs text-slate-500">' + this._e(d.status || 'unmeasured') + ' at ' + this._e(d.threshold_bps) + ' bps; tested through ' + this._money(d.tested_through_input_usd) + '</div></div><div class="summary-card"><div class="card-label">Protocol redemption</div><div class="card-value">permissionless</div><div class="text-xs text-slate-500">Size-unbounded, fee rises with size; spot fee ' + this._pct(s.redemption_rate_pct, 3) + '</div></div></div><details class="text-sm text-slate-500 mt-3"><summary class="cursor-pointer font-medium">Liquidity exclusions</summary><div class="mt-2">Excluded from swap depth: ' + this._e((excluded.lp_wrappers || []).join(', ') || 'none declared') + '. ' + this._e(excluded.lp_wrapper_reason || '') + ' ' + this._e(excluded.non_swap_reason || '') + '</div></details>');
    },
    _axis3PreviewPanel: function(liq, s) {
        var evidence = this._thresholdEvidence(liq, 50);
        var rows = this._marketRungs(liq);
        var wanted = [100000, 1000000, 5000000];
        var selected = wanted.map(function(size) {
            return rows.filter(function(r) { return r.size_usd === size; })[0];
        }).filter(Boolean);
        if (!selected.length) selected = rows.slice(0, 3);
        var fees = (((liq || {}).primary_exit || {}).fee_ladder || []);
        var feeBySize = {};
        fees.forEach(function(f) { feeBySize[f.size_usd] = f; });
        var tableRows = selected.map(function(r) {
            var totalCost = (typeof r.amount_out_tokens === 'number' && r.size_usd > 0)
                ? (1 - r.amount_out_tokens / r.size_usd) * 100 : null;
            var redemption = feeBySize[r.size_usd];
            return '<tr><td class="font-semibold">' + BOLDRenderer._money(r.size_usd) + '</td>' +
                '<td class="text-right font-mono">' + BOLDRenderer._pct(Math.abs(r.slippage_bps_debiased) / 100, 2) + '</td>' +
                '<td class="text-right font-mono">' + BOLDRenderer._pct(totalCost, 2) + '</td>' +
                '<td class="text-right font-mono">' + (redemption
                    ? BOLDRenderer._pct(redemption.effective_redemption_fee_pct, 2) : '—') + '</td></tr>';
        }).join('');
        var headline = evidence.lower ? '≥' + this._money(evidence.lower.size_usd) : 'unmeasured';
        var bracket = evidence.lower && evidence.upper
            ? this._money(evidence.lower.size_usd) + '–' + this._money(evidence.upper.size_usd)
            : 'not located';
        var asOf = ((liq.depth || {}).quote || {}).quoted_as_of || liq.as_of || 'time not published';
        return this._panel('Usable market exit — Axis 3 preview',
            '<div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">' +
            '<div class="summary-card"><div class="card-label">50 bp depth</div><div class="card-value">' + headline + '</div><div class="text-xs text-slate-500">measured floor</div></div>' +
            '<div class="summary-card"><div class="card-label">Current bracket</div><div class="card-value">' + bracket + '</div><div class="text-xs text-slate-500">targeted solver not yet enabled</div></div>' +
            '<div class="summary-card"><div class="card-label">Quoted at</div><div class="card-value text-base">' + this._e(asOf) + '</div><div class="text-xs text-slate-500">routed BOLD → USDC</div></div></div>' +
            '<div class="overflow-x-auto"><table class="data-table"><thead><tr><th>Sell size</th><th class="text-right">Additional impact</th><th class="text-right">Total discount vs $1</th><th class="text-right">Redemption fee</th></tr></thead><tbody>' + tableRows + '</tbody></table></div>' +
            '<details class="text-sm text-slate-500 mt-3"><summary class="cursor-pointer font-medium">Stress and methodology</summary><div class="mt-2">The current broad ladder only proves that the 50 bp crossing lies between ' + bracket + '. The existing 200 bp result remains a severe-stress measure and is not used as this preview\'s headline. Additional impact is debiased from the smallest successful quote; total discount shows expected output against $1.</div></details>');
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
