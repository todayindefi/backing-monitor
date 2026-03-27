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

        // Supply Reconciliation Waterfall
        var wf = specific.supply_waterfall;
        if (wf && wf.minting_sources) {
            var ms = wf.minting_sources;
            var mh = wf.major_holders;
            var total = ms.total_minted || 1;
            function pct(v) { return (v / total * 100).toFixed(1) + '%'; }

            html += '<div class="panel">' +
                '<div class="panel-title">Supply Reconciliation</div>' +
                '<p class="text-sm text-slate-500 mb-3">totalSupply() returns ' + CommonRenderer.formatCurrency(wf.total_supply_raw) + ' (includes ' + CommonRenderer.formatCurrency(wf.ceiling_buffers) + ' in undeployed ceiling buffers).' +
                (wf.cg_circulating ? ' CoinGecko circulating: ' + CommonRenderer.formatCurrency(wf.cg_circulating) + ' (excludes contract-held).' : '') + '</p>' +

                '<table class="data-table"><thead><tr><th colspan="3" class="text-xs uppercase tracking-wide text-slate-500">Minting Sources (where crvUSD is created)</th></tr><tr><th>Source</th><th class="text-right">Amount</th><th class="text-right">% of Minted</th></tr></thead><tbody>' +
                '<tr><td>Minting markets (collateral-backed CDPs)</td><td class="text-right font-mono">' + CommonRenderer.formatCurrency(ms.minting_markets) + '</td><td class="text-right">' + pct(ms.minting_markets) + '</td></tr>' +
                '<tr><td>YieldBasis (credit line, $1B ceiling)</td><td class="text-right font-mono">' + CommonRenderer.formatCurrency(ms.yieldbasis) + '</td><td class="text-right">' + pct(ms.yieldbasis) + '</td></tr>' +
                '<tr><td>PegKeeper mints (circular AMO)</td><td class="text-right font-mono">' + CommonRenderer.formatCurrency(ms.pegkeeper_mints) + '</td><td class="text-right">' + pct(ms.pegkeeper_mints) + '</td></tr>' +
                '<tr class="font-bold border-t-2 border-slate-200"><td>Total Minted Supply</td><td class="text-right font-mono">' + CommonRenderer.formatCurrency(total) + '</td><td class="text-right">100%</td></tr>' +
                '</tbody></table>' +

                '<table class="data-table mt-4"><thead><tr><th colspan="2" class="text-xs uppercase tracking-wide text-slate-500">Major Holders (where minted crvUSD sits)</th></tr><tr><th>Destination</th><th class="text-right">Amount</th></tr></thead><tbody>' +
                '<tr><td>scrvUSD savings vault</td><td class="text-right font-mono">' + CommonRenderer.formatCurrency(mh.scrvusd) + '</td></tr>' +
                '<tr><td>LlamaLend vaults (lent to borrowers)</td><td class="text-right font-mono">' + CommonRenderer.formatCurrency(mh.llamalend_borrowed) + '</td></tr>' +
                '</tbody></table>' +
                '</div>';
        }

        // Summary cards
        html += '<div class="panel">' +
            '<div class="panel-title">System Overview</div>' +
            '<div class="grid grid-cols-2 md:grid-cols-5 gap-3">' +
                '<div class="summary-card"><div class="card-label">Total Loans</div><div class="card-value">' + (s.total_loans || 0) + '</div></div>' +
                '<div class="summary-card"><div class="card-label">Minting Markets</div><div class="card-value">' + s.n_active_markets + '</div></div>' +
                '<div class="summary-card"><div class="card-label">Lending Markets</div><div class="card-value">' + (s.n_lending_markets || 0) + '</div></div>' +
                '<div class="summary-card"><div class="card-label">PegKeeper Debt</div><div class="card-value">' + CommonRenderer.formatCurrency(s.total_pegkeeper_debt) + '</div></div>' +
                '<div class="summary-card"><div class="card-label">YieldBasis</div><div class="card-value">' + CommonRenderer.formatCurrency(s.yieldbasis_balance) + '</div></div>' +
            '</div></div>';

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

                var windDown = m.wind_down ? ' <span class="tag" style="background:#fef2f2;color:#dc2626">WIND-DOWN</span>' : '';

                html += '<tr>' +
                    '<td class="font-medium">' + m.collateral + windDown + '</td>' +
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

        // LlamaLend markets
        var lendingMarkets = specific.lending_markets;
        if (lendingMarkets && lendingMarkets.length > 0) {
            html += '<div class="panel">' +
                '<div class="panel-title">LlamaLend Markets (top ' + lendingMarkets.length + ' by debt)</div>' +
                '<p class="text-sm text-slate-500 mb-3">Isolated lending markets where crvUSD is the borrowed token. Accounts for ' + CommonRenderer.formatCurrency(data.summary.total_lending_debt) + ' of supply.</p>' +
                '<table class="data-table"><thead><tr><th>Collateral</th><th class="text-right">Debt</th><th class="text-right">Loans</th></tr></thead><tbody>';
            lendingMarkets.forEach(function(m) {
                html += '<tr><td class="font-medium">' + m.collateral + '</td>' +
                    '<td class="text-right font-mono">' + CommonRenderer.formatCurrency(m.debt) + '</td>' +
                    '<td class="text-right font-mono">' + m.n_loans + '</td></tr>';
            });
            html += '</tbody></table></div>';
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
