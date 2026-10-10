/** Canonical Ethereum wstETH dashboard additions. Bridged deployments are phase two. */
var WstETHRenderer = {
    preRender: function (data) {
        var backing = data.backing || (data.backing = {});
        if (typeof backing.coverage_pct === 'number') {
            backing.collateral_ratio = backing.coverage_pct;
            backing.collateral_ratio_scale = 'percent';
            backing.collateral_ratio_basis = backing.coverage_formula || backing.evidence_basis;
        }
        // Axis 2 is a RiskAnalyst judgment informed by the directly measured
        // wrapper ratio. Do not round-trip the 9.0 authored score through the
        // fleet's generic collateral-ratio bands and display it as 6/10.
        if (typeof backing.backing_score === 'number') {
            backing.backing_score_display = 'authored';
        }

        var liq = data.liquidity || (data.liquidity = {});
        var depth50 = liq.depth_50bps;
        if (depth50 && typeof depth50 === 'object') {
            if (depth50.depth_usd == null && typeof depth50.value_usd === 'number') {
                depth50.depth_usd = depth50.value_usd;
            }
            if (!depth50.bracket && Array.isArray(depth50.bracket_usd)) {
                depth50.bracket = depth50.bracket_usd.slice();
            }
            if (!depth50.basis && depth50.impact_basis) depth50.basis = depth50.impact_basis;
            // The shared renderer retains its historical `total_2pct_depth`
            // field name, while this stable/LST feed deliberately publishes a
            // 50 bp threshold. Carry the value with an explicit threshold so
            // the label renders as 0.5% depth rather than relabelling it 2%.
            if (typeof depth50.depth_usd === 'number') {
                liq.total_2pct_depth = depth50.depth_usd;
                liq.depth_threshold_bps = Number(depth50.threshold_bps || 50);
                liq.two_pct_depth_status = depth50.status;
                liq.two_pct_depth_basis = depth50.basis || depth50.note;
                liq.total_2pct_depth_is_floor = depth50.is_floor === true;
            }
        }
        if (!liq.exit_mark && liq.quotes && typeof liq.quotes === 'object') {
            var quotes = {};
            Object.keys(liq.quotes).forEach(function (size) {
                var row = liq.quotes[size] || {};
                quotes[size] = {
                    size_usd: Number(size),
                    slippage_bps: typeof row.exit_cost_bps_ex_gas === 'number'
                        ? -row.exit_cost_bps_ex_gas
                        : (typeof row.all_in_exit_cost_bps === 'number' ? row.all_in_exit_cost_bps : null),
                    status: row.status,
                    route_venues: row.route_pools || []
                };
            });
            liq.exit_mark = {
                measured_at: data.timestamp,
                quotes: quotes,
                basis: liq.cost_basis,
                sell_into: liq.sell_into,
                source: liq.aggregator
            };
            liq.slippage_reference_size_usd = Math.min.apply(null,
                Object.keys(quotes).map(Number).filter(isFinite));
        }

        data.summary = data.summary || {};
        if (typeof backing.coverage_pct === 'number') {
            data.summary.collateral_ratio = backing.coverage_pct;
            data.summary.collateral_ratio_scale = 'percent';
        }
        // Do not expose token-denominated wrapper supply as the shared USD
        // liquidity denominator. The common panel would otherwise present a
        // meaningless "depth as % of supply" comparison across unlike units.
    },

    render: function (data) {
        document.getElementById('asset-specific-panels').innerHTML = '';
        this.renderBacking(data);
        this.renderIdentity(data);
    },

    renderBacking: function (data) {
        var b = data.backing || {};
        var slot = document.getElementById('backing-extra-panels');
        if (!slot || typeof b.wrapper_total_supply !== 'number') return;
        slot.innerHTML =
            '<div class="panel">' +
              '<div class="panel-title">Canonical wrapper reconciliation</div>' +
              '<div class="grid grid-cols-1 md:grid-cols-3 gap-4">' +
                this.metric('wstETH supply', this.num(b.wrapper_total_supply, 0) + ' wstETH', 'Ethereum mainnet') +
                this.metric('Represented claim', this.num(b.represented_steth_claim, 0) + ' stETH', 'supply × stEthPerToken') +
                this.metric('stETH held', this.num(b.wrapper_steth_balance, 0) + ' stETH', 'balanceOf(wrapper), same block') +
              '</div>' +
              '<p class="text-xs text-slate-500 mt-4">' + this.esc(b.evidence_basis || '') + '</p>' +
              '<p class="text-xs text-slate-400 mt-1">Block ' + this.esc(b.block_number) +
                ' · canonical contract ' + this.esc(b.wrapper_contract || '') + '</p>' +
            '</div>';
    },

    renderIdentity: function (data) {
        var c = data.contract || {};
        var slot = document.getElementById('contract-extra-panels');
        if (!slot) return;
        slot.innerHTML =
            '<div class="panel">' +
              '<div class="panel-title">What this page covers</div>' +
              '<p class="text-sm text-slate-600">Canonical Ethereum wstETH at <span class="font-mono text-xs">' +
                this.esc((data.identity || {}).contract || '') + '</span>: an immutable wrapper whose economic ' +
                'risk passes through to stETH and Lido. Bridged representations, including Monad CCIP wstETH, ' +
                'are deliberately outside this first release.</p>' +
              (c.structural_score_basis ? '<details class="mt-3"><summary class="text-xs font-semibold text-slate-600 cursor-pointer">Contract-score basis</summary><p class="text-xs text-slate-500 mt-2">' + this.esc(c.structural_score_basis) + '</p></details>' : '') +
            '</div>';
    },

    metric: function (label, value, note) {
        return '<div class="summary-card"><div class="card-label">' + this.esc(label) + '</div>' +
            '<div class="card-value text-xl">' + this.esc(value) + '</div>' +
            '<div class="text-xs text-slate-500">' + this.esc(note) + '</div></div>';
    },

    num: function (value, decimals) {
        return Number(value).toLocaleString(undefined, { maximumFractionDigits: decimals });
    },

    esc: function (value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
            return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[ch];
        });
    }
};
