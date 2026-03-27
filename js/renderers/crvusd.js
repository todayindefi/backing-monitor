/**
 * crvUSD-specific renderer — per-market table, PegKeepers, borrow rates.
 */

var CrvUSDRenderer = {

    render(data) {
        var container = document.getElementById('asset-specific-panels');
        var specific = data.asset_specific;
        if (!specific || specific.type !== 'crvusd') return;

        var html = '';
        var s = data.summary;

        // Supply context note (crvUSD supply >> factory debt due to Curve Lending)
        html += '<div class="panel">' +
            '<div class="panel-title">Supply Context</div>' +
            '<div class="grid grid-cols-1 md:grid-cols-4 gap-4">' +
                '<div class="summary-card"><div class="card-label">Total crvUSD Supply</div><div class="card-value">' + CommonRenderer.formatCurrency(s.total_supply) + '</div></div>' +
                '<div class="summary-card"><div class="card-label">Minting Market Debt</div><div class="card-value">' + CommonRenderer.formatCurrency(s.total_market_debt) + '</div></div>' +
                '<div class="summary-card"><div class="card-label">PegKeeper Debt</div><div class="card-value">' + CommonRenderer.formatCurrency(s.total_pegkeeper_debt) + '</div></div>' +
                '<div class="summary-card"><div class="card-label">Active Loans</div><div class="card-value">' + (s.total_loans || 0) + '</div></div>' +
            '</div>' +
            '<p class="text-sm text-slate-500 mt-3">crvUSD total supply includes tokens minted via Curve Lending (LlamaLend) markets which have a separate factory. The CR shown above covers only the original crvUSD minting markets.</p>' +
            '</div>';

        // Per-market table
        var markets = specific.markets;
        if (markets && markets.length > 0) {
            html += '<div class="panel">' +
                '<div class="panel-title">Markets (' + s.n_active_markets + ' active of ' + s.n_markets + ')</div>' +
                '<div class="overflow-x-auto">' +
                '<table class="data-table">' +
                '<thead><tr>' +
                    '<th>Collateral</th>' +
                    '<th class="text-right">Debt</th>' +
                    '<th class="text-right">Ceiling</th>' +
                    '<th class="text-right">Util %</th>' +
                    '<th class="text-right">CR</th>' +
                    '<th class="text-right">Loans</th>' +
                    '<th class="text-right">APR</th>' +
                    '<th class="text-right">Oracle Price</th>' +
                '</tr></thead><tbody>';

            markets.forEach(function(m) {
                if (m.debt < 1) return; // skip empty markets

                var crClass = m.collateral_ratio === 0 ? 'text-slate-400' :
                              m.collateral_ratio < 120 ? 'text-red-600' :
                              m.collateral_ratio < 150 ? 'text-amber-600' : 'text-green-600';
                var crText = m.collateral_ratio === 0 ? 'N/A' : CommonRenderer.formatPercent(m.collateral_ratio, 1);

                var utilClass = m.utilization > 90 ? 'text-red-600' :
                                m.utilization > 70 ? 'text-amber-600' : '';

                html += '<tr>' +
                    '<td class="font-medium">' + m.collateral + '</td>' +
                    '<td class="text-right font-mono">' + CommonRenderer.formatCurrency(m.debt) + '</td>' +
                    '<td class="text-right font-mono">' + CommonRenderer.formatCurrency(m.debt_ceiling) + '</td>' +
                    '<td class="text-right font-mono ' + utilClass + '">' + CommonRenderer.formatPercent(m.utilization, 1) + '</td>' +
                    '<td class="text-right font-mono ' + crClass + '">' + crText + '</td>' +
                    '<td class="text-right font-mono">' + m.n_loans + '</td>' +
                    '<td class="text-right font-mono">' + CommonRenderer.formatPercent(m.borrow_apr, 1) + '</td>' +
                    '<td class="text-right font-mono">' + CommonRenderer.formatCurrencyExact(m.oracle_price) + '</td>' +
                    '</tr>';
            });

            // Totals row
            var totalDebt = markets.reduce(function(s, m) { return s + m.debt; }, 0);
            var totalCollateral = markets.reduce(function(s, m) { return s + m.collateral_value_usd + m.crvusd_in_amm; }, 0);
            var totalLoans = markets.reduce(function(s, m) { return s + m.n_loans; }, 0);
            html += '<tr class="font-bold border-t-2 border-slate-200">' +
                '<td>Total</td>' +
                '<td class="text-right font-mono">' + CommonRenderer.formatCurrency(totalDebt) + '</td>' +
                '<td></td><td></td>' +
                '<td class="text-right font-mono">' + CommonRenderer.formatPercent(data.summary.collateral_ratio, 1) + '</td>' +
                '<td class="text-right font-mono">' + totalLoans + '</td>' +
                '<td></td><td></td></tr>';

            html += '</tbody></table></div></div>';
        }

        // PegKeepers
        var pks = specific.pegkeepers;
        if (pks && pks.length > 0) {
            var totalPkDebt = pks.reduce(function(s, pk) { return s + pk.debt; }, 0);
            html += '<div class="panel">' +
                '<div class="panel-title">PegKeepers (' + pks.length + ')</div>' +
                '<p class="text-sm text-slate-500 mb-3">PegKeepers mint crvUSD into Curve stable pools to defend the peg. Their debt is circular (not backed by external collateral).</p>';

            if (totalPkDebt === 0) {
                html += '<div class="text-green-600 text-sm font-medium">All PegKeepers at $0 debt — no circular exposure</div>';
            } else {
                html += '<table class="data-table"><thead><tr><th>Index</th><th class="text-right">Debt</th><th>Pool</th></tr></thead><tbody>';
                pks.forEach(function(pk) {
                    html += '<tr>' +
                        '<td>' + pk.index + '</td>' +
                        '<td class="text-right font-mono">' + CommonRenderer.formatCurrency(pk.debt) + '</td>' +
                        '<td class="text-sm text-slate-500 font-mono">' + pk.pool.substring(0, 10) + '...</td>' +
                        '</tr>';
                });
                html += '</tbody></table>';
            }
            html += '</div>';
        }

        container.innerHTML = html;
    }
};
