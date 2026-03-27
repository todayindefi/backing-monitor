/**
 * crvUSD-specific renderer
 *
 * Layout priority (reflects actual risk structure):
 * 1. Supply waterfall (minting sources vs holders)
 * 2. YieldBasis concentration risk (97% of minted supply)
 * 3. Minting markets table (2.9% of supply, but shows collateral health)
 * 4. LlamaLend markets (where crvUSD is lent, not minted)
 * 5. PegKeepers (currently dormant)
 */

var CrvUSDRenderer = {

    render(data) {
        var container = document.getElementById('asset-specific-panels');
        var specific = data.asset_specific;
        if (!specific || specific.type !== 'crvusd') return;

        var html = '';
        var s = data.summary;

        // ====== 1. Supply Reconciliation Waterfall ======
        var wf = specific.supply_waterfall;
        if (wf && wf.minting_sources) {
            var ms = wf.minting_sources;
            var mh = wf.major_holders;
            var total = ms.total_minted || 1;
            function pct(v) { return (v / total * 100).toFixed(1) + '%'; }

            html += '<div class="panel">' +
                '<div class="panel-title">Supply Reconciliation</div>' +
                '<p class="text-sm text-slate-500 mb-3">' +
                'totalSupply() returns ' + CommonRenderer.formatCurrency(wf.total_supply_raw) +
                ' (includes ' + CommonRenderer.formatCurrency(wf.ceiling_buffers) + ' in undeployed ceiling buffers).' +
                (wf.cg_circulating ? ' CoinGecko circulating: ' + CommonRenderer.formatCurrency(wf.cg_circulating) + ' (excludes contract-held).' : '') +
                '</p>' +

                '<table class="data-table"><thead>' +
                '<tr><th colspan="3" class="text-xs uppercase tracking-wide text-slate-500">Minting Sources (where crvUSD is created)</th></tr>' +
                '<tr><th>Source</th><th class="text-right">Amount</th><th class="text-right">% of Minted</th></tr></thead><tbody>' +
                '<tr><td>Minting markets (collateral-backed CDPs)</td><td class="text-right font-mono">' + CommonRenderer.formatCurrency(ms.minting_markets) + '</td><td class="text-right">' + pct(ms.minting_markets) + '</td></tr>' +
                '<tr><td>YieldBasis (credit line, $1B ceiling)</td><td class="text-right font-mono">' + CommonRenderer.formatCurrency(ms.yieldbasis) + '</td><td class="text-right">' + pct(ms.yieldbasis) + '</td></tr>' +
                '<tr><td>PegKeeper mints (circular AMO)</td><td class="text-right font-mono">' + CommonRenderer.formatCurrency(ms.pegkeeper_mints) + '</td><td class="text-right">' + pct(ms.pegkeeper_mints) + '</td></tr>' +
                '<tr class="font-bold border-t-2 border-slate-200"><td>Total Minted Supply</td><td class="text-right font-mono">' + CommonRenderer.formatCurrency(total) + '</td><td class="text-right">100%</td></tr>' +
                '</tbody></table>' +

                '<table class="data-table mt-4"><thead>' +
                '<tr><th colspan="2" class="text-xs uppercase tracking-wide text-slate-500">Major Holders (where minted crvUSD sits)</th></tr>' +
                '<tr><th>Destination</th><th class="text-right">Amount</th></tr></thead><tbody>' +
                '<tr><td>scrvUSD savings vault</td><td class="text-right font-mono">' + CommonRenderer.formatCurrency(mh.scrvusd) + '</td></tr>' +
                '<tr><td>LlamaLend vaults (lent to borrowers)</td><td class="text-right font-mono">' + CommonRenderer.formatCurrency(mh.llamalend_borrowed) + '</td></tr>' +
                '</tbody></table>' +
                '</div>';
        }

        // ====== 2. YieldBasis Concentration Risk ======
        if (s.yieldbasis_balance > 0) {
            var ybPct = s.collateral_ratio_alt ? s.collateral_ratio_alt.value : 0;
            var ybUtil = s.yieldbasis_utilization || 0;
            var ybCeiling = s.yieldbasis_ceiling || 1000000000;
            var concClass = ybPct > 90 ? 'negative' : ybPct > 70 ? 'warning' : 'positive';
            var utilClass = ybUtil > 80 ? 'warning' : '';

            html += '<div class="panel" style="border-left: 4px solid #dc2626;">' +
                '<div class="panel-title">YieldBasis Concentration Risk</div>' +
                '<p class="text-sm text-slate-500 mb-3">YieldBasis holds a $1B credit line from ControllerFactory, making it the dominant source of minted crvUSD. BTC price movements directly affect crvUSD peg stability through YB AMM positions.</p>' +
                '<div class="grid grid-cols-2 md:grid-cols-4 gap-3">' +
                    '<div class="summary-card"><div class="card-label">YB Balance</div><div class="card-value">' + CommonRenderer.formatCurrency(s.yieldbasis_balance) + '</div></div>' +
                    '<div class="summary-card"><div class="card-label">% of Minted Supply</div><div class="card-value ' + concClass + '">' + CommonRenderer.formatPercent(ybPct, 1) + '</div></div>' +
                    '<div class="summary-card"><div class="card-label">Credit Ceiling</div><div class="card-value">' + CommonRenderer.formatCurrency(ybCeiling) + '</div></div>' +
                    '<div class="summary-card"><div class="card-label">Ceiling Utilization</div><div class="card-value ' + utilClass + '">' + CommonRenderer.formatPercent(ybUtil, 1) + '</div></div>' +
                '</div>' +
                '</div>';
        }

        // ====== 3. Minting Markets (ControllerFactory) ======
        var markets = specific.markets;
        if (markets && markets.length > 0) {
            var activeMarkets = markets.filter(function(m) { return m.debt >= 1; });

            html += '<div class="panel">' +
                '<div class="panel-title">Minting Markets (' + activeMarkets.length + ' active)</div>' +
                '<p class="text-sm text-slate-500 mb-3">Original CDP minting — users deposit collateral, mint crvUSD as debt. Only ' + CommonRenderer.formatPercent(s.total_market_debt / (s.total_supply || 1) * 100, 1) + ' of minted supply. System CR: ' + CommonRenderer.formatPercent(s.collateral_ratio, 1) + '.</p>' +
                '<div class="overflow-x-auto">' +
                '<table class="data-table"><thead><tr>' +
                    '<th>Collateral</th>' +
                    '<th class="text-right">Debt</th>' +
                    '<th class="text-right">Ceiling</th>' +
                    '<th class="text-right">Util %</th>' +
                    '<th class="text-right">CR</th>' +
                    '<th class="text-right">Loans</th>' +
                    '<th class="text-right">APR</th>' +
                    '<th class="text-right">Oracle</th>' +
                '</tr></thead><tbody>';

            activeMarkets.forEach(function(m) {
                var crClass = m.collateral_ratio === 0 ? 'text-slate-400' :
                              m.collateral_ratio < 120 ? 'text-red-600' :
                              m.collateral_ratio < 150 ? 'text-amber-600' : 'text-green-600';
                var crText = m.collateral_ratio === 0 ? 'N/A' : CommonRenderer.formatPercent(m.collateral_ratio, 1);
                var utilClass = m.utilization > 90 ? 'text-red-600' : m.utilization > 70 ? 'text-amber-600' : '';
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

            var totalDebt = activeMarkets.reduce(function(a, m) { return a + m.debt; }, 0);
            var totalLoans = activeMarkets.reduce(function(a, m) { return a + m.n_loans; }, 0);
            html += '<tr class="font-bold border-t-2 border-slate-200">' +
                '<td>Total</td>' +
                '<td class="text-right font-mono">' + CommonRenderer.formatCurrency(totalDebt) + '</td>' +
                '<td></td><td></td>' +
                '<td class="text-right font-mono">' + CommonRenderer.formatPercent(s.collateral_ratio, 1) + '</td>' +
                '<td class="text-right font-mono">' + totalLoans + '</td>' +
                '<td></td><td></td></tr>';

            html += '</tbody></table></div></div>';
        }

        // ====== 4. LlamaLend Markets ======
        var lendingMarkets = specific.lending_markets;
        if (lendingMarkets && lendingMarkets.length > 0) {
            html += '<div class="panel">' +
                '<div class="panel-title">LlamaLend Markets (top ' + lendingMarkets.length + ')</div>' +
                '<p class="text-sm text-slate-500 mb-3">Isolated lending markets — lenders deposit crvUSD, borrowers borrow against collateral. This is recirculation of existing crvUSD, not new minting. Total borrowed: ' + CommonRenderer.formatCurrency(s.total_lending_debt) + '.</p>' +
                '<table class="data-table"><thead><tr><th>Collateral</th><th class="text-right">Borrowed</th><th class="text-right">Loans</th></tr></thead><tbody>';
            lendingMarkets.forEach(function(m) {
                html += '<tr><td class="font-medium">' + m.collateral + '</td>' +
                    '<td class="text-right font-mono">' + CommonRenderer.formatCurrency(m.debt) + '</td>' +
                    '<td class="text-right font-mono">' + m.n_loans + '</td></tr>';
            });
            html += '</tbody></table></div>';
        }

        // ====== 5. PegKeepers ======
        var pks = specific.pegkeepers;
        if (pks && pks.length > 0) {
            var totalPkDebt = pks.reduce(function(a, pk) { return a + pk.debt; }, 0);
            html += '<div class="panel">' +
                '<div class="panel-title">PegKeepers (' + pks.length + ')</div>' +
                '<p class="text-sm text-slate-500 mb-3">Mint/burn crvUSD into Curve stable pools to defend the peg. Debt is circular (not backed by external collateral).</p>';
            if (totalPkDebt === 0) {
                html += '<div class="text-green-600 text-sm font-medium">All PegKeepers at $0 debt — no circular exposure</div>';
            } else {
                html += '<table class="data-table"><thead><tr><th>Index</th><th class="text-right">Debt</th><th>Pool</th></tr></thead><tbody>';
                pks.forEach(function(pk) {
                    html += '<tr><td>' + pk.index + '</td>' +
                        '<td class="text-right font-mono">' + CommonRenderer.formatCurrency(pk.debt) + '</td>' +
                        '<td class="text-sm text-slate-500 font-mono">' + pk.pool.substring(0, 10) + '...</td></tr>';
                });
                html += '</tbody></table>';
            }
            html += '</div>';
        }

        container.innerHTML = html;
    }
};
