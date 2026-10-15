/** DOLA detail is additive; shared rendering retains all six baseline axes. */
var DOLARenderer = {
    preRender: function(data) {
        if (data.peg) {
            // The DOLA export has a separate recent hourly observation array.
            // Do not use the unattributed daily archive to fill a sparse new chart.
            data.peg.chart_history_array = 'observations';
            data.peg.chart_history_field = 'price';
            data.peg.chart_time_unit = 'hour';
        }
        var detail = (data.asset_specific || {}).dola || {};
        var psm = detail.psm;
        // The graph producer uses an array where older feeds used a boolean flag.
        var dep = data.dependencies || {};
        if (Array.isArray(dep.downstream_tracked)) {
            dep.downstream = dep.downstream_tracked.map(function(slug) { return { name: slug, slug: slug }; });
            dep.downstream_tracked = true;
        }
        // Adapt the producer's declared primary-exit state for the shared frame.
        // No fees/reserves calculation or wall-clock inference is performed here.
        if (psm && !((data.liquidity || {}).primary_exit)) {
            data.liquidity = data.liquidity || {};
            data.liquidity.primary_redemption_depth_status = psm.sale_simulation_status || 'not_measured';
            data.liquidity.primary_redemption_note = psm.basis;
        }
        return data;
    },
    _e: function(value) { return CommonRenderer._escapeAttr(String(value == null ? '' : value)); },
    _number: function(value, unit) {
        return typeof value === 'number' && Number.isFinite(value) ?
            this._e(value.toLocaleString('en-US', { maximumFractionDigits: 2 })) + ' ' + this._e(unit) :
            'not measured';
    },
    _meta: function(block) {
        return '<p class="text-xs text-slate-500">Observed: ' + this._e(block.as_of || 'not supplied') +
            ' · Source: ' + this._e(block.source || 'not supplied') + '</p>' +
            (block.basis ? '<details><summary class="text-sm text-slate-500">Measurement basis and evidence</summary><p class="text-sm text-slate-500">' + this._e(block.basis) + '</p></details>' : '') +
            (block.component_clocks ? '<details><summary class="text-sm text-slate-500">Component observation clocks</summary><pre class="text-xs whitespace-pre-wrap">' +
                this._e(JSON.stringify(block.component_clocks, null, 2)) + '</pre></details>' : '');
    },
    _panel: function(title, body) {
        return '<div class="panel"><div class="panel-title">' + this._e(title) + '</div>' + body + '</div>';
    },
    _metrics: function(block, fields) {
        var self = this;
        return '<table class="data-table"><tbody>' + fields.map(function(field) {
            return '<tr><td>' + self._e(field[1]) + '</td><td class="text-right font-mono">' +
                self._number(block[field[0]], field[2]) + '</td></tr>';
        }).join('') + '</tbody></table>';
    },
    _accounting: function(block) {
        if (!block) return this._panel('DOLA accounting', 'Accounting detail is not published.');
        var self = this;
        var rows = Array.isArray(block.markets) ? block.markets : [];
        return this._panel('Loan sources and supply definitions', this._meta(block) +
            '<p class="text-sm text-amber-700">Independent backing coverage: ' +
            this._e(block.coverage_status || 'not supplied') + '. ' + this._e(block.coverage_basis || '') + '</p>' +
            this._metrics(block, [
                ['ethereum_supply_dola', 'Ethereum token supply', 'DOLA'],
                ['circulating_supply_dola', 'Issuer-defined circulating supply', 'DOLA'],
                ['firm_debt_dola', 'FiRM loan debt', 'DOLA'],
                ['firm_collateral_tvl_usd', 'Oracle-valued FiRM collateral', 'USD'],
                ['bad_debt_dola', 'Known bad debt', 'DOLA'],
                ['dola_lp_debt_share_pct', 'Debt from DOLA/sDOLA LP markets', '% of FiRM debt'],
                ['ethena_linked_debt_share_pct', 'Ethena-linked debt sources', '% of FiRM debt']
            ]) + '<p class="text-xs text-slate-500">Debt shares describe loan sources. Oracle collateral value does not establish independent dollar backing.</p>' +
            (rows.length ? '<details><summary>FiRM debt by market (' + rows.length + ')</summary><div class="overflow-x-auto"><table class="data-table"><thead><tr><th>Market</th><th>Debt (DOLA)</th><th>FiRM debt share</th></tr></thead><tbody>' +
                rows.map(function(row) { return '<tr><td>' + self._e(row.name) + '</td><td>' +
                    self._number(row.debt_dola, 'DOLA') + '</td><td>' + self._number(row.debt_share_pct, '%') + '</td></tr>'; }).join('') +
                '</tbody></table></div></details>' : '<p>Market breakdown is not published.</p>'));
    },
    _psm: function(block) {
        if (!block) return this._panel('PSM primary exit', 'PSM measurements are not integrated.');
        return this._panel('PSM reserves and sale simulation', this._meta(block) +
            '<p class="text-xs font-mono">Contract: ' + this._e(block.contract_address || 'not supplied') + '</p>' +
            this._metrics(block, [['reserves', 'Reserve assets available', block.reserve_symbol || 'unit not supplied'],
                ['dola_inventory', 'DOLA inventory for the opposite swap direction', 'DOLA']]) +
            '<p>Sale simulation: ' + this._e(block.sale_simulation_status || 'not measured') + '</p>');
    },
    _junior: function(block) {
        if (!block) return this._panel('Junior protection', 'Capital and market eligibility are not published.');
        var self = this;
        var markets = Array.isArray(block.markets) ? block.markets : null;
        function rowHtml(row) {
            return '<p>' + self._e(row.name) + ': ' + self._e(row.status || 'unresolved') +
                (row.activation_at ? ' · Activation: ' + self._e(row.activation_at) : '') + '</p>';
        }
        return this._panel('Junior capital and eligibility', this._meta(block) +
            this._metrics(block, [['assets_sdola', 'Vault assets', 'sDOLA'],
                ['assets_dola_equivalent', 'Converted assets', 'DOLA'],
                ['firm_debt_coverage_pct', 'Capital / FiRM debt', '%']]) +
            (markets ? markets.filter(function(row) { return row.status !== 'active'; }).map(rowHtml).join('') +
                '<details><summary>All measured market eligibility (' + markets.length + ')</summary>' +
                markets.map(rowHtml).join('') + '</details>' : '<p>Market eligibility is not published.</p>'));
    },
    _lookThrough: function(block) {
        var rows = block && block.lp_compositions;
        if (!Array.isArray(rows) || !rows.length) return this._panel('LP collateral composition', 'LP component measurements are not published.');
        var self = this;
        var clocks = block.component_clocks || {};
        return this._panel('LP collateral composition — token units',
            '<p class="text-xs text-slate-500">Observed: ' + this._e(clocks.ethereum_supply_block_time || 'not supplied') +
            ' · Ethereum block: ' + this._e(clocks.ethereum_supply_block || 'not supplied') + '</p>' +
            rows.map(function(row) {
                return '<p class="font-semibold">' + self._e(row.name) + '</p>' + self._metrics(row, [
                    ['dola_amount', 'Internal DOLA claim', 'DOLA'],
                    ['pair_amount', 'Counter-token balance', row.pair_symbol],
                    ['pair_underlying_amount', 'Counter-token underlying', row.pair_underlying_symbol]
                ]) + '<p class="text-xs text-slate-500">' + self._e(row.basis) + '</p>';
            }).join(''));
    },
    render: function(data) {
        var detail = (data.asset_specific || {}).dola;
        var backing = document.getElementById('backing-extra-panels');
        var exit = document.getElementById('liquidity-extra-panels');
        if (!detail || detail.schema_version !== 'dola-detail/1') {
            if (backing) backing.innerHTML = this._panel('DOLA detail', 'Supported DOLA accounting detail is not published.');
            if (exit) exit.innerHTML = this._psm(null);
            return;
        }
        if (backing) backing.innerHTML = this._accounting(detail.accounting) + this._lookThrough(detail.accounting) + this._junior(detail.junior);
        if (exit) exit.innerHTML = this._psm(detail.psm);
    }
};
