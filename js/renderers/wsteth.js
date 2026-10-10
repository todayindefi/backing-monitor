/** Canonical Ethereum wstETH dashboard additions. Bridged deployments are phase two. */
var WstETHRenderer = {
    preRender: function (data) {
        // This feed is sampled daily. Eight points are enough to show the
        // requested seven-day view; do not widen it to the fleet's 30-day
        // sparse-series fallback while the axis title says 7d.
        data.peg = data.peg || {};
        data.peg.chart_window_days = 7;
        data.peg.chart_min_points = 2;

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

        // ⚠️ THE SAME ERROR AS THE SCORE, ONE PANEL LOWER, AND IT SHIPPED FOR AN HOUR.
        // The guard above refuses to round-trip the authored 9.0 through the fleet's
        // generic collateral-ratio bands — and the coverage history, which landed
        // 2026-10-10, went straight through them: a flat line at 100.000000% drawn on
        // the wrapper's par line, directly above a red "Critical" box, under an axis
        // whose "healthy" starts at 130%, with "Min: 100.00%" coloured amber.
        //
        // Those bands describe an OVER-COLLATERALISED stablecoin, where 130% is a
        // cushion. This is an immutable 1:1 wrapper: 100% is not a thin result, it is
        // the only correct one, and there is nothing to be above. A reader who knows
        // the fleet's frame reads that chart as a token sitting on the edge of
        // insolvency. Frame it on the quantity actually measured instead.
        //
        // display_only: the bands shade the chart and must never score the asset —
        // axis 2 here is RiskAnalyst's authored judgment, which is the whole point of
        // backing_score_display above.
        var specific = data.asset_specific || (data.asset_specific = {});
        specific.chart_title = 'Wrapper coverage — stETH held vs represented claim';
        specific.chart_dataset_label = 'Coverage %';
        // ⚠️ A ±0.1pp frame, not a wider "safe-looking" one. The residual on a
        // canonical read is ~2.5e-8 pp — four million times smaller than this axis —
        // so nothing here renders float noise as movement, while anything a reader
        // CAN see at this zoom is at least 0.001pp and therefore real. These are
        // suggested bounds, so a genuine break pushes the axis open rather than
        // being clipped off the bottom of it.
        specific.chart_y_min = 99.9;
        specific.chart_y_max = 100.1;
        specific.chart_bands = {
            display_only: true,
            // A shortfall in a wrapper is an accounting break, not a thinner cushion:
            // 99.9% of a 4.58M stETH claim is ~4,580 stETH that is not there.
            critical: [0, 99.9],
            thin:     [99.9, 99.99],
            amber:    [99.99, 99.999],
            healthy:  [99.999, 100.5],
            // Par only. The generic frame's 130% "max" line has no meaning here —
            // stETH donated above the claim would be dust, not strength.
            min_line: 100,
            max_line: null
        };
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
