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

        // ====== 1. Supply Layers ======
        var sl = specific.supply_layers;
        var wh = specific.where_it_sits;
        if (sl) {
            html += '<div class="panel">' +
                '<div class="panel-title">Supply Layers</div>' +
                '<p class="text-sm text-slate-500 mb-3">crvUSD has three supply layers. Circulating supply (from StablecoinLens) is the headline number. YB factory holds a pre-minted allocation. totalSupply() includes all ceiling buffers.</p>' +
                '<table class="data-table"><thead><tr><th>Layer</th><th class="text-right">Amount</th><th>Note</th></tr></thead><tbody>' +
                '<tr class="font-bold"><td>Circulating (StablecoinLens)</td><td class="text-right font-mono">' + CommonRenderer.formatCurrency(sl.circulating) + '</td><td class="text-sm text-slate-500">Headline supply — minting market debt + PK debt</td></tr>' +
                (sl.cg_circulating ? '<tr><td class="text-slate-500">CoinGecko circulating</td><td class="text-right font-mono text-slate-500">' + CommonRenderer.formatCurrency(sl.cg_circulating) + '</td><td class="text-sm text-slate-400">Cross-check</td></tr>' : '') +
                '<tr><td>YB factory pre-minted allocation</td><td class="text-right font-mono">' + CommonRenderer.formatCurrency(sl.yb_factory_allocation) + '</td><td class="text-sm text-slate-500">$1B ceiling, includes idle buffer</td></tr>' +
                '<tr class="text-slate-400"><td>totalSupply() (authorized capacity)</td><td class="text-right font-mono">' + CommonRenderer.formatCurrency(sl.total_supply_raw) + '</td><td class="text-sm">Includes all undeployed ceiling buffers</td></tr>' +
                '</tbody></table>';

            if (wh) {
                html += '<table class="data-table mt-4"><thead><tr><th colspan="2" class="text-xs uppercase tracking-wide text-slate-500">Where Circulating crvUSD Sits</th></tr></thead><tbody>' +
                    '<tr><td>scrvUSD savings vault</td><td class="text-right font-mono">' + CommonRenderer.formatCurrency(wh.scrvusd) + '</td></tr>' +
                    '<tr><td>LlamaLend vaults (lent to borrowers)</td><td class="text-right font-mono">' + CommonRenderer.formatCurrency(wh.llamalend_borrowed) + '</td></tr>' +
                    '</tbody></table>';
            }
            html += '</div>';
        }

        // ====== 2. YieldBasis Pre-minted Allocation ======
        if (s.yieldbasis_balance > 0) {
            var ybUtil = s.yieldbasis_utilization || 0;
            var ybCeiling = s.yieldbasis_ceiling || 1000000000;
            var utilClass = ybUtil > 80 ? 'warning' : '';

            html += '<div class="panel" style="border-left: 4px solid #d97706;">' +
                '<div class="panel-title">YieldBasis Pre-minted Allocation</div>' +
                '<p class="text-sm text-slate-500 mb-3">YieldBasis holds a $1B credit line from ControllerFactory. The factory balance (' + CommonRenderer.formatCurrency(s.yieldbasis_balance) + ') includes both actively-paired crvUSD in BTC/crvUSD pools AND idle buffer. This is NOT circulating supply — it\'s a pre-minted allocation like totalSupply() ceiling buffers.</p>' +
                '<div class="grid grid-cols-2 md:grid-cols-3 gap-3">' +
                    '<div class="summary-card"><div class="card-label">YB Factory Balance</div><div class="card-value">' + CommonRenderer.formatCurrency(s.yieldbasis_balance) + '</div></div>' +
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
