/** Canonical-Ethereum frxUSD dashboard adapter. */
var FrxUSDRenderer = {
    preRender: function (data) {
        var issuer = data.issuer || {};
        var reserves = issuer.reserves || {};
        var backing = data.backing || (data.backing = {});

        backing.collateral_ratio = issuer.coverage_ratio;
        backing.collateral_ratio_scale = issuer.coverage_ratio_scale || 'percent';
        backing.collateral_ratio_basis = issuer.coverage_ratio_basis;
        backing.total_backing = issuer.total_assets_usd;
        backing.total_liabilities = issuer.total_liabilities_usd;
        backing.surplus_deficit = issuer.surplus_usd;
        backing.surplus_deficit_basis = issuer.surplus_basis;
        backing.breakdown = (reserves.categories || []).map(function (row) {
            return { label: row.symbol, value: row.value_usd, pct: row.pct_of_assets };
        });

        data.summary = data.summary || {};
        data.summary.total_supply = issuer.total_liabilities_usd;
        data.summary.total_backing = issuer.total_assets_usd;
        data.summary.total_liabilities = issuer.total_liabilities_usd;
        data.summary.collateral_ratio = issuer.coverage_ratio;
        data.summary.collateral_ratio_scale = issuer.coverage_ratio_scale || 'percent';
        data.summary.collateral_ratio_basis = issuer.coverage_ratio_basis;
        data.summary.surplus_deficit = issuer.surplus_usd;
        data.summary.surplus_deficit_basis = issuer.surplus_basis;

        data.peg = data.peg || {};
        data.peg.chart_window_days = 7;
        data.peg.chart_min_points = 2;

        data.asset_specific = data.asset_specific || {};
        data.asset_specific.chart_title = 'Global issuer-reported coverage — 7d';
        data.asset_specific.chart_dataset_label = 'Coverage %';
        data.asset_specific.chart_y_min = 99;
        data.asset_specific.chart_y_max = 105;
        data.asset_specific.chart_bands = {
            critical: [0, 99], thin: [99, 100], amber: [100, 101], healthy: [101, 110],
            min_line: 100, max_line: null
        };
    },

    render: function (data) {
        var issuer = data.issuer || {};
        var eth = data.onchain_ethereum || {};
        var backingSlot = document.getElementById('backing-extra-panels');
        if (backingSlot) {
            backingSlot.innerHTML =
                '<div class="panel"><div class="panel-title">Scope and reconciliation</div>' +
                '<div class="grid grid-cols-1 md:grid-cols-3 gap-4">' +
                  this.metric('Global assets', this.money(issuer.total_assets_usd), 'Issuer-reported') +
                  this.metric('Global liabilities', this.money(issuer.total_liabilities_usd), 'Issuer-reported') +
                  this.metric('Surplus', this.money(issuer.surplus_usd), 'Assets minus liabilities') +
                '</div>' +
                '<p class="text-xs text-slate-500 mt-4">' + this.esc(issuer.scope_basis || '') + '</p>' +
                '<p class="text-xs text-slate-500 mt-2">' + this.esc(((issuer.source || {}).caveat) || '') + '</p>' +
                '</div>' + this.verificationHtml((data.backing || {}).verification);
        }

        var depSlot = document.getElementById('dependencies-extra-panels');
        if (depSlot && typeof eth.total_supply === 'number') {
            var verify = eth.issuer_row_verification || {};
            depSlot.innerHTML =
                '<div class="panel"><div class="panel-title">Canonical Ethereum supply check</div>' +
                '<div class="grid grid-cols-1 md:grid-cols-3 gap-4">' +
                  this.metric('Ethereum supply', this.money(eth.total_supply), 'frxUSD totalSupply()') +
                  this.metric('Observation block', this.num(eth.block_number), 'Ethereum') +
                  this.metric('Issuer-row match', this.esc(verify.status || 'unknown'), 'Same-block token and bridge reads') +
                '</div></div>';
        }

        var contract = data.contract || {};
        var contractSlot = document.getElementById('contract-extra-panels');
        if (contractSlot && (contract.custody_disclosure || contract.provenance_note)) {
            contractSlot.innerHTML =
                '<div class="panel"><div class="panel-title">Custody and scoring disclosure</div>' +
                (contract.custody_disclosure ? '<p class="text-sm text-slate-600">' +
                    this.esc(contract.custody_disclosure) + '</p>' : '') +
                (contract.custody_disclosure_sources ? '<p class="text-xs text-slate-500 mt-2">' +
                    this.esc(contract.custody_disclosure_sources) + '</p>' : '') +
                (contract.provenance_note ? '<p class="text-xs text-slate-500 mt-3">' +
                    this.esc(contract.provenance_note) + '</p>' : '') +
                '</div>';
        }

        var liq = data.liquidity || {};
        var probe = liq.redemption_probe;
        var liqSlot = document.getElementById('liquidity-extra-panels');
        if (liqSlot && probe && Array.isArray(probe.routes)) {
            var rows = probe.routes.map(function (r) {
                var amount = r.redeemable_now_units;
                var eligibility = r.eligibility && typeof r.eligibility === 'object'
                    ? r.eligibility.status : (r.eligibility || r.access);
                return '<tr><td>' + FrxUSDRenderer.esc(r.pays_out || r.asset || r.name || 'Route') + '</td>' +
                    '<td>' + FrxUSDRenderer.esc(String(eligibility || 'unknown').replace(/_/g, ' ')) + '</td>' +
                    '<td class="text-right font-mono">' + (typeof amount === 'number' ? FrxUSDRenderer.num(amount) : 'n/a') + '</td>' +
                    '<td class="text-right font-mono">' + (r.fee_bps != null ? FrxUSDRenderer.esc(r.fee_bps) + ' bps' : 'n/a') + '</td></tr>';
            }).join('');
            liqSlot.innerHTML = '<div class="panel"><div class="panel-title">Primary redemption — separate from market depth</div>' +
                '<div class="overflow-x-auto"><table class="data-table"><thead><tr><th>Payout</th><th>Eligibility</th><th class="text-right">Redeemable now</th><th class="text-right">Fee</th></tr></thead><tbody>' +
                rows + '</tbody></table></div><p class="text-xs text-slate-500 mt-3">' +
                this.esc(probe.semantics || '') + '</p></div>';
        }
    },

    metric: function (label, value, note) {
        return '<div class="summary-card"><div class="card-label">' + this.esc(label) + '</div>' +
            '<div class="card-value text-xl">' + value + '</div><div class="text-xs text-slate-500">' +
            this.esc(note) + '</div></div>';
    },
    verificationHtml: function (v) {
        if (!v || !v.coverage) return '';
        var c = v.coverage;
        var rows = (v.reserve_balances || []).map(function (r) {
            var rec = r.issuer_reconciliation || {};
            var qty = typeof r.quantity === 'number' ? FrxUSDRenderer.num(r.quantity) : 'unmeasured';
            var value = typeof r.value_usd === 'number' ? FrxUSDRenderer.money(r.value_usd) : 'unmeasured';
            var diff = typeof rec.value_difference_usd === 'number' ? FrxUSDRenderer.money(rec.value_difference_usd) : 'n/a';
            return '<tr><td>' + FrxUSDRenderer.esc(r.symbol + ' · ' + r.id.replace(/_/g, ' ')) + '</td>' +
                '<td>' + FrxUSDRenderer.esc(r.fetch_status) + '</td><td class="text-right font-mono">' + qty + '</td>' +
                '<td class="text-right font-mono">' + value + '</td><td class="text-right font-mono">' + diff + '</td></tr>';
        }).join('');
        var obs = v.observation || {};
        var gap = c.unverified_or_unmeasured_gap_usd;
        var alerts = (v.alerts || []).map(function (a) { return a.type.replace(/_/g, ' '); }).join(' · ');
        return '<div class="panel"><div class="panel-title">Independent backing verification</div>' +
            '<div class="grid grid-cols-1 md:grid-cols-3 gap-4">' +
              this.metric('Onchain-observed assets', this.money(c.onchain_verifiable_assets_usd), (typeof c.onchain_share_of_issuer_assets_pct === 'number' ? c.onchain_share_of_issuer_assets_pct.toFixed(2) + '% of issuer-reported assets' : 'Ethereum token balances')) +
              this.metric('vs issuer liabilities', typeof c.onchain_assets_vs_issuer_liabilities_pct === 'number' ? c.onchain_assets_vs_issuer_liabilities_pct.toFixed(2) + '%' : 'withheld', 'Hybrid lower-bound comparison') +
              this.metric('Unverified / unmeasured gap', this.money(gap), 'Principally Erebor cash') +
            '</div>' +
            '<p class="text-xs text-slate-500 mt-3">Independent global coverage is <strong>withheld</strong>: remote OFT liabilities remain unmeasured. Onchain assets divided by issuer liabilities is shown only as a lower-bound comparison, not an independently reconstructed coverage ratio.</p>' +
            '<div class="overflow-x-auto mt-4"><table class="data-table"><thead><tr><th>Reserve address</th><th>Status</th><th class="text-right">Quantity</th><th class="text-right">Independent value</th><th class="text-right">vs issuer value</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
            '<p class="text-xs text-slate-500 mt-3">Ethereum block ' + this.esc(obs.block_number) + ' · ' + this.esc(obs.block_timestamp || '') + '. BitGo WTGXX is balance-observed but beneficial ownership remains custody-dependent. Erebor is explicitly offchain_unverified.</p>' +
            (alerts ? '<p class="text-xs text-amber-700 mt-2">Alerts: ' + this.esc(alerts) + '</p>' : '') +
            '</div>';
    },
    money: function (v) { return typeof v === 'number' ? CommonRenderer.formatCurrency(v) : 'n/a'; },
    num: function (v) { return Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 }); },
    esc: function (v) {
        return String(v == null ? '' : v).replace(/[&<>"']/g, function (ch) {
            return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];
        });
    }
};
