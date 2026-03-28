/**
 * crvUSD renderer — aligned with DefiLlama methodology
 *
 * Supply = mint market debt + PK debt + YB deployed + LlamaLend debt
 * Conservative CR = (mint collateral + YB BTC) / supply
 * Inclusive CR = conservative + PK pool reserves
 */

var CrvUSDRenderer = {

    render(data) {
        var container = document.getElementById('asset-specific-panels');
        var specific = data.asset_specific;
        if (!specific || specific.type !== 'crvusd') return;

        var html = '';
        var s = data.summary;

        // ====== 1. Supply Breakdown ======
        var sb = specific.supply_breakdown;
        if (sb) {
            html += '<div class="panel">' +
                '<div class="panel-title">Supply Breakdown (DefiLlama methodology)</div>' +
                '<p class="text-sm text-slate-500 mb-3">Sum of all crvUSD minting/borrowing sources. totalSupply() returns ' + CommonRenderer.formatCurrency(sb.total_supply_raw) + ' (includes undeployed ceiling buffers).' +
                (sb.cg_circulating ? ' CoinGecko: ' + CommonRenderer.formatCurrency(sb.cg_circulating) + '.' : '') + '</p>' +
                '<table class="data-table"><thead><tr><th>Source</th><th class="text-right">Amount</th><th class="text-right">%</th></tr></thead><tbody>' +
                '<tr><td>Minting markets (collateral-backed CDPs)</td><td class="text-right font-mono">' + CommonRenderer.formatCurrency(sb.minting_markets) + '</td><td class="text-right">' + (sb.minting_markets / sb.total * 100).toFixed(1) + '%</td></tr>' +
                '<tr><td>YieldBasis deployed (crvUSD in YB pools)</td><td class="text-right font-mono">' + CommonRenderer.formatCurrency(sb.yb_deployed) + '</td><td class="text-right">' + (sb.yb_deployed / sb.total * 100).toFixed(1) + '%</td></tr>' +
                '<tr><td>LlamaLend debt (Curve Lend borrowed)</td><td class="text-right font-mono">' + CommonRenderer.formatCurrency(sb.llamalend_debt) + '</td><td class="text-right">' + (sb.llamalend_debt / sb.total * 100).toFixed(1) + '%</td></tr>' +
                '<tr><td>PegKeeper debt</td><td class="text-right font-mono">' + CommonRenderer.formatCurrency(sb.pegkeeper_debt) + '</td><td class="text-right">' + (sb.pegkeeper_debt / sb.total * 100).toFixed(1) + '%</td></tr>' +
                '<tr class="font-bold border-t-2 border-slate-200"><td>Total crvUSD Supply</td><td class="text-right font-mono">' + CommonRenderer.formatCurrency(sb.total) + '</td><td class="text-right">100%</td></tr>' +
                '</tbody></table></div>';
        }

        // ====== 2. Collateral Ratio ======
        var cb = specific.collateral_breakdown;
        if (cb) {
            var consCls = s.collateral_ratio < 100 ? 'negative' : s.collateral_ratio < 120 ? 'warning' : 'positive';
            var inclCls = s.collateral_ratio_alt.value < 100 ? 'negative' : s.collateral_ratio_alt.value < 130 ? 'warning' : 'positive';

            html += '<div class="panel">' +
                '<div class="panel-title">Collateral Ratio</div>' +
                '<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">' +
                    '<div class="summary-card"><div class="card-label">Conservative CR</div><div class="card-value ' + consCls + '">' + CommonRenderer.formatPercent(s.collateral_ratio, 1) + '</div><div class="text-xs text-slate-400 mt-1">Mint + YB collateral / supply</div></div>' +
                    '<div class="summary-card"><div class="card-label">Inclusive CR</div><div class="card-value ' + inclCls + '">' + CommonRenderer.formatPercent(s.collateral_ratio_alt.value, 1) + '</div><div class="text-xs text-slate-400 mt-1">+ PK pool reserves</div></div>' +
                '</div>' +
                '<table class="data-table"><thead><tr><th>Collateral Component</th><th class="text-right">Amount</th></tr></thead><tbody>' +
                '<tr><td>Minting market collateral</td><td class="text-right font-mono">' + CommonRenderer.formatCurrency(cb.mint_collateral) + '</td></tr>' +
                '<tr><td>YB pool BTC/ETH value</td><td class="text-right font-mono">' + CommonRenderer.formatCurrency(cb.yb_btc_collateral) + '</td></tr>' +
                '<tr class="font-bold border-t border-slate-200"><td>Conservative total</td><td class="text-right font-mono">' + CommonRenderer.formatCurrency(cb.conservative_total) + '</td></tr>' +
                '<tr><td>+ PK pool reserves (stablecoins)</td><td class="text-right font-mono">' + CommonRenderer.formatCurrency(cb.pk_reserves) + '</td></tr>' +
                '<tr class="font-bold border-t border-slate-200"><td>Inclusive total</td><td class="text-right font-mono">' + CommonRenderer.formatCurrency(cb.inclusive_total) + '</td></tr>' +
                '</tbody></table></div>';
        }

        // ====== 3. YB Pool Detail ======
        var ybPools = specific.yb_pools;
        if (ybPools && Object.keys(ybPools).length > 0) {
            html += '<div class="panel">' +
                '<div class="panel-title">YieldBasis Pools</div>' +
                '<p class="text-sm text-slate-500 mb-3">50/50 BTC/crvUSD AMM pools. The crvUSD side is supply, the BTC side is collateral.</p>' +
                '<table class="data-table"><thead><tr><th>Pool</th><th class="text-right">crvUSD (supply)</th><th class="text-right">Collateral (USD)</th></tr></thead><tbody>';
            var ybTotal = {crvusd: 0, collateral: 0};
            Object.entries(ybPools).sort(function(a, b) { return b[1].crvusd - a[1].crvusd; }).forEach(function(e) {
                ybTotal.crvusd += e[1].crvusd;
                ybTotal.collateral += e[1].collateral_usd;
                html += '<tr><td class="font-medium">' + e[0] + '</td>' +
                    '<td class="text-right font-mono">' + CommonRenderer.formatCurrency(e[1].crvusd) + '</td>' +
                    '<td class="text-right font-mono">' + CommonRenderer.formatCurrency(e[1].collateral_usd) + '</td></tr>';
            });
            html += '<tr class="font-bold border-t-2 border-slate-200"><td>Total</td>' +
                '<td class="text-right font-mono">' + CommonRenderer.formatCurrency(ybTotal.crvusd) + '</td>' +
                '<td class="text-right font-mono">' + CommonRenderer.formatCurrency(ybTotal.collateral) + '</td></tr>' +
                '</tbody></table></div>';
        }

        // ====== 4. Minting Markets ======
        var markets = specific.markets;
        if (markets && markets.length > 0) {
            var activeMarkets = markets.filter(function(m) { return m.debt >= 1; });
            html += '<div class="panel">' +
                '<div class="panel-title">Minting Markets (' + activeMarkets.length + ' active, CR ' + CommonRenderer.formatPercent(s.mint_cr, 1) + ')</div>' +
                '<div class="overflow-x-auto"><table class="data-table"><thead><tr>' +
                '<th>Collateral</th><th class="text-right">Debt</th><th class="text-right">Ceiling</th><th class="text-right">CR</th><th class="text-right">Loans</th><th class="text-right">APR</th>' +
                '</tr></thead><tbody>';
            activeMarkets.forEach(function(m) {
                var crClass = m.collateral_ratio < 120 ? 'text-red-600' : m.collateral_ratio < 150 ? 'text-amber-600' : 'text-green-600';
                var windDown = m.wind_down ? ' <span class="tag" style="background:#fef2f2;color:#dc2626">WIND-DOWN</span>' : '';
                html += '<tr><td class="font-medium">' + m.collateral + windDown + '</td>' +
                    '<td class="text-right font-mono">' + CommonRenderer.formatCurrency(m.debt) + '</td>' +
                    '<td class="text-right font-mono">' + CommonRenderer.formatCurrency(m.debt_ceiling) + '</td>' +
                    '<td class="text-right font-mono ' + crClass + '">' + CommonRenderer.formatPercent(m.collateral_ratio, 1) + '</td>' +
                    '<td class="text-right font-mono">' + m.n_loans + '</td>' +
                    '<td class="text-right font-mono">' + CommonRenderer.formatPercent(m.borrow_apr, 1) + '</td></tr>';
            });
            html += '</tbody></table></div></div>';
        }

        // ====== 5. LlamaLend ======
        var lm = specific.lending_markets;
        if (lm && lm.length > 0) {
            html += '<div class="panel"><div class="panel-title">LlamaLend Markets (top ' + lm.length + ')</div>' +
                '<table class="data-table"><thead><tr><th>Collateral</th><th class="text-right">Borrowed</th><th class="text-right">Loans</th></tr></thead><tbody>';
            lm.forEach(function(m) {
                html += '<tr><td class="font-medium">' + m.collateral + '</td><td class="text-right font-mono">' + CommonRenderer.formatCurrency(m.debt) + '</td><td class="text-right font-mono">' + m.n_loans + '</td></tr>';
            });
            html += '</tbody></table></div>';
        }

        // ====== 6. PK Pool Reserves ======
        var pkPools = specific.pk_pool_reserves;
        if (pkPools && Object.keys(pkPools).length > 0) {
            html += '<div class="panel"><div class="panel-title">PK Pool Reserves (' + Object.keys(pkPools).length + ' pools)</div>' +
                '<p class="text-sm text-slate-500 mb-3">crvUSD in PegKeeper pools acts as peg defense reserve. If crvUSD depegs below $1, these pools absorb selling pressure.</p>' +
                '<table class="data-table"><thead><tr><th>Pool</th><th class="text-right">crvUSD Balance</th></tr></thead><tbody>';
            var pkTotal = 0;
            Object.entries(pkPools).sort(function(a, b) { return b[1] - a[1]; }).forEach(function(e) {
                pkTotal += e[1];
                html += '<tr><td>' + e[0].replace('Curve.fi Factory Plain Pool: ', '') + '</td><td class="text-right font-mono">' + CommonRenderer.formatCurrency(e[1]) + '</td></tr>';
            });
            html += '<tr class="font-bold border-t border-slate-200"><td>Total reserves</td><td class="text-right font-mono">' + CommonRenderer.formatCurrency(pkTotal) + '</td></tr>';
            html += '</tbody></table></div>';
        }

        // ====== 7. PegKeeper Debt ======
        var pks = specific.pegkeepers;
        if (pks && pks.length > 0) {
            var totalPkDebt = pks.reduce(function(a, pk) { return a + pk.debt; }, 0);
            if (totalPkDebt === 0) {
                html += '<div class="panel"><div class="panel-title">PegKeepers (' + pks.length + ')</div>' +
                    '<div class="text-green-600 text-sm font-medium">All PegKeepers at $0 debt — no circular minting active</div></div>';
            }
        }

        container.innerHTML = html;
    }
};
