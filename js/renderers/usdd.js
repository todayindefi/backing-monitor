/**
 * USDD renderer
 *
 * Multi-chain MakerDAO-fork analysis:
 * 1. Supply by Chain (Tron 80%, ETH 10%, BSC 9%)
 * 2. Collateral Composition (SA + PSM = HTX vs user vaults)
 * 3. PSM Coverage (per-chain exit liquidity)
 * 4. VAT Ilk Detail (per-vault-type debt/ceiling)
 * 5. TRX Stress Test (30/50/70% drop scenarios)
 * 6. Peg Status
 */

var USDDRenderer = {

    render(data) {
        var container = document.getElementById('asset-specific-panels');
        var specific = data.asset_specific;
        if (!specific || specific.type !== 'usdd') return;

        var html = '';
        var s = data.summary;

        // ====== 1. Supply by Chain ======
        var supply = specific.supply_by_chain;
        if (supply) {
            var total = supply.total || 1;
            var chains = [
                { name: 'Tron', val: supply.tron, color: '#ef4444' },
                { name: 'Ethereum', val: supply.ethereum, color: '#3b82f6' },
                { name: 'BNB Chain', val: supply.bsc, color: '#f59e0b' }
            ];

            html += '<div class="panel">' +
                '<div class="panel-title">Supply by Chain</div>' +
                '<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">';
            chains.forEach(function(c) {
                var pct = (c.val / total * 100).toFixed(1);
                html += '<div class="summary-card">' +
                    '<div class="card-label">' + c.name + '</div>' +
                    '<div class="card-value">' + CommonRenderer.formatCurrency(c.val) + '</div>' +
                    '<div class="text-xs text-slate-400 mt-1">' + pct + '% of total</div>' +
                    '</div>';
            });
            html += '</div>' +
                '<div class="h-4 rounded-full overflow-hidden flex" style="background:#e2e8f0">';
            chains.forEach(function(c) {
                var pct = c.val / total * 100;
                if (pct > 0.5) {
                    html += '<div style="width:' + pct + '%;background:' + c.color + '" title="' + c.name + ': ' + pct.toFixed(1) + '%"></div>';
                }
            });
            html += '</div>' +
                '<div class="flex justify-between text-xs text-slate-400 mt-1">';
            chains.forEach(function(c) {
                html += '<span><span style="color:' + c.color + '">\u25cf</span> ' + c.name + '</span>';
            });
            html += '</div></div>';
        }

        // ====== 2. Collateral Composition (HTX vs Independent) ======
        var coll = specific.collateral;
        if (coll) {
            var htxPct = coll.htx_pct || 0;
            var indPct = 100 - htxPct;
            var indCr = s.collateral_ratio_alt ? s.collateral_ratio_alt.value : 0;
            var indCls = indCr >= 30 ? 'positive' : indCr >= 15 ? 'warning' : 'negative';

            html += '<div class="panel">' +
                '<div class="panel-title">Collateral Composition</div>' +
                '<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">' +
                    '<div class="summary-card"><div class="card-label">HTX-Sourced</div><div class="card-value negative">' + CommonRenderer.formatCurrency(coll.htx_total) + '</div><div class="text-xs text-slate-400 mt-1">' + htxPct.toFixed(0) + '% of backing</div></div>' +
                    '<div class="summary-card"><div class="card-label">Independent (Users)</div><div class="card-value positive">' + CommonRenderer.formatCurrency(coll.independent_total) + '</div><div class="text-xs text-slate-400 mt-1">' + indPct.toFixed(0) + '% of backing</div></div>' +
                    '<div class="summary-card"><div class="card-label">Independent CR</div><div class="card-value ' + indCls + '">' + CommonRenderer.formatPercent(indCr) + '</div><div class="text-xs text-slate-400 mt-1">User vaults only</div></div>' +
                    '<div class="summary-card"><div class="card-label">Total Backing</div><div class="card-value">' + CommonRenderer.formatCurrency(coll.total) + '</div></div>' +
                '</div>' +
                '<div class="h-4 rounded-full overflow-hidden flex" style="background:#e2e8f0">' +
                    '<div style="width:' + htxPct + '%;background:#ef4444" title="HTX ' + htxPct.toFixed(0) + '%"></div>' +
                    '<div style="width:' + indPct + '%;background:#22c55e" title="Independent ' + indPct.toFixed(0) + '%"></div>' +
                '</div>' +
                '<div class="flex justify-between text-xs text-slate-400 mt-1">' +
                    '<span><span style="color:#ef4444">\u25cf</span> HTX (SA + PSM)</span>' +
                    '<span><span style="color:#22c55e">\u25cf</span> Independent (User Vaults)</span>' +
                '</div>';

            // SA breakdown
            var sa = coll.smart_allocator;
            if (sa && sa.total > 0) {
                html += '<table class="data-table mt-4"><thead><tr><th>Smart Allocator</th><th class="text-right">Debt (USDD minted)</th></tr></thead><tbody>' +
                    '<tr><td>Tron SA001-A</td><td class="text-right font-mono">' + CommonRenderer.formatCurrency(sa.tron) + '</td></tr>' +
                    '<tr><td>Ethereum SA001-A</td><td class="text-right font-mono">' + CommonRenderer.formatCurrency(sa.ethereum) + '</td></tr>' +
                    '<tr class="font-bold border-t-2 border-slate-200"><td>Total SA (HTX)</td><td class="text-right font-mono">' + CommonRenderer.formatCurrency(sa.total) + '</td></tr>' +
                    '</tbody></table>';
            }
            html += '<p class="text-xs text-slate-400 mt-2">Smart Allocator funded from HTX addresses (<a href="https://protos.com/usdd-assets-htx-justin-sun-justlend/" target="_blank" class="text-blue-500 hover:underline">Protos</a>). Admin multisig can access all funds (zero timelock).</p>' +
                '</div>';
        }

        // ====== 3. PSM Coverage ======
        var psm = specific.psm_by_chain;
        if (psm) {
            var totalPsm = specific.psm_total_usd || 0;
            var totalCov = specific.psm_coverage_pct || 0;
            var covCls = totalCov >= 30 ? 'positive' : totalCov >= 15 ? 'warning' : 'negative';

            html += '<div class="panel">' +
                '<div class="panel-title">PSM Exit Liquidity</div>' +
                '<p class="text-sm text-slate-500 mb-3">Peg Stability Module: 1:1 USDT redemption. Coverage = USDT reserves / chain USDD supply.</p>' +
                '<div class="grid grid-cols-2 md:grid-cols-2 gap-4 mb-4">' +
                    '<div class="summary-card"><div class="card-label">Total PSM Reserves</div><div class="card-value">' + CommonRenderer.formatCurrency(totalPsm) + '</div></div>' +
                    '<div class="summary-card"><div class="card-label">Total Coverage</div><div class="card-value ' + covCls + '">' + CommonRenderer.formatPercent(totalCov, 1) + '</div></div>' +
                '</div>' +
                '<table class="data-table"><thead><tr><th>Chain</th><th class="text-right">PSM USDT</th><th class="text-right">USDD Supply</th><th class="text-right">Coverage</th></tr></thead><tbody>';

            var chainOrder = ['tron', 'ethereum', 'bsc'];
            var chainNames = { tron: 'Tron', ethereum: 'Ethereum', bsc: 'BNB Chain' };
            chainOrder.forEach(function(chain) {
                var p = psm[chain] || {};
                var covPct = p.coverage_pct || 0;
                var pctCls = covPct >= 50 ? 'text-green-600' : covPct >= 15 ? 'text-amber-600' : 'text-red-600';
                html += '<tr><td class="font-medium">' + chainNames[chain] + '</td>' +
                    '<td class="text-right font-mono">' + CommonRenderer.formatCurrency(p.reserves_usd || 0) + '</td>' +
                    '<td class="text-right font-mono">' + CommonRenderer.formatCurrency(p.chain_supply || 0) + '</td>' +
                    '<td class="text-right font-mono ' + pctCls + '">' + CommonRenderer.formatPercent(covPct, 1) + '</td></tr>';
            });
            html += '<tr class="font-bold border-t-2 border-slate-200"><td>Total</td>' +
                '<td class="text-right font-mono">' + CommonRenderer.formatCurrency(totalPsm) + '</td>' +
                '<td class="text-right font-mono">' + CommonRenderer.formatCurrency(supply ? supply.total : 0) + '</td>' +
                '<td class="text-right font-mono ' + covCls + '">' + CommonRenderer.formatPercent(totalCov, 1) + '</td></tr>' +
                '</tbody></table></div>';
        }

        // ====== 4. VAT Ilk Detail ======
        var ilks = specific.ilks;
        if (ilks && Object.keys(ilks).length > 0) {
            html += '<div class="panel">' +
                '<div class="panel-title">Vault Types (On-Chain)</div>' +
                '<p class="text-sm text-slate-500 mb-3">MakerDAO-fork VAT data. Each ilk (collateral type) has its own debt and ceiling. All data queried directly from on-chain VAT contracts.</p>' +
                '<div class="overflow-x-auto"><table class="data-table"><thead><tr>' +
                '<th>Chain</th><th>Ilk</th><th class="text-right">Debt</th><th class="text-right">Ceiling</th><th class="text-right">Util.</th><th>Source</th>' +
                '</tr></thead><tbody>';

            var sorted = Object.entries(ilks).sort(function(a, b) { return b[1].debt - a[1].debt; });
            sorted.forEach(function(e) {
                var ilk = e[1];
                var utilCls = ilk.utilization_pct > 90 ? 'text-red-600 font-bold' : ilk.utilization_pct > 70 ? 'text-amber-600' : '';
                var chainLabel = ilk.chain === 'tron' ? 'Tron' : ilk.chain === 'ethereum' ? 'ETH' : 'BSC';
                var sourceTag = ilk.is_htx ?
                    '<span class="tag tag-htx">HTX</span>' :
                    '<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">User</span>';
                html += '<tr><td class="text-sm">' + chainLabel + '</td>' +
                    '<td class="font-medium">' + ilk.ilk + '</td>' +
                    '<td class="text-right font-mono">' + CommonRenderer.formatCurrency(ilk.debt) + '</td>' +
                    '<td class="text-right font-mono">' + CommonRenderer.formatCurrency(ilk.ceiling) + '</td>' +
                    '<td class="text-right font-mono ' + utilCls + '">' + CommonRenderer.formatPercent(ilk.utilization_pct, 0) + '</td>' +
                    '<td>' + sourceTag + '</td></tr>';
            });
            html += '</tbody></table></div></div>';
        }

        // ====== 5. TRX Stress Test ======
        var stress = specific.stress_test;
        if (stress && stress.scenarios) {
            var trxPrice = stress.trx_price;
            var trxChange = specific.trx_price ? specific.trx_price['24h_change_pct'] : null;

            html += '<div class="panel">' +
                '<div class="panel-title">TRX Stress Test</div>' +
                '<p class="text-sm text-slate-500 mb-3">TRX + sTRX collateral (' + CommonRenderer.formatCurrency(stress.trx_exposed_usd) + ') is vulnerable to TRX price drops. Stable backing (' + CommonRenderer.formatCurrency(stress.stable_backing_usd) + ') includes SA + PSM + USDT vaults.</p>' +
                '<div class="grid grid-cols-2 md:grid-cols-2 gap-4 mb-4">' +
                    '<div class="summary-card"><div class="card-label">TRX Price</div><div class="card-value">$' + (trxPrice ? trxPrice.toFixed(4) : '-') + '</div>' +
                    (trxChange !== null ? '<div class="text-xs mt-1 ' + (trxChange < -5 ? 'text-red-500' : 'text-slate-400') + '">' + (trxChange >= 0 ? '+' : '') + trxChange.toFixed(1) + '% 24h</div>' : '') +
                    '</div>' +
                    '<div class="summary-card"><div class="card-label">TRX Exposure</div><div class="card-value warning">' + CommonRenderer.formatCurrency(stress.trx_exposed_usd) + '</div><div class="text-xs text-slate-400 mt-1">' + (supply ? (stress.trx_exposed_usd / (s.total_backing || 1) * 100).toFixed(0) : '0') + '% of backing</div></div>' +
                '</div>' +
                '<table class="data-table"><thead><tr><th>Scenario</th><th class="text-right">TRX Backing</th><th class="text-right">Total Backing</th><th class="text-right">CR</th><th>Status</th></tr></thead><tbody>';

            // Current
            html += '<tr class="font-bold"><td>Current</td>' +
                '<td class="text-right font-mono">' + CommonRenderer.formatCurrency(stress.trx_exposed_usd) + '</td>' +
                '<td class="text-right font-mono">' + CommonRenderer.formatCurrency(s.total_backing) + '</td>' +
                '<td class="text-right font-mono positive">' + CommonRenderer.formatPercent(s.collateral_ratio) + '</td>' +
                '<td><span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">OK</span></td></tr>';

            Object.entries(stress.scenarios).sort(function(a, b) { return a[1].drop_pct - b[1].drop_pct; }).forEach(function(e) {
                var sc = e[1];
                var crCls = sc.cr_pct >= 110 ? 'positive' : sc.cr_pct >= 100 ? 'warning' : 'negative';
                var statusHtml = sc.cr_pct >= 100 ?
                    '<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">OK</span>' :
                    '<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">UNDER</span>';
                html += '<tr><td>TRX -' + sc.drop_pct + '%</td>' +
                    '<td class="text-right font-mono">' + CommonRenderer.formatCurrency(sc.trx_backing_usd) + '</td>' +
                    '<td class="text-right font-mono">' + CommonRenderer.formatCurrency(sc.total_backing_usd) + '</td>' +
                    '<td class="text-right font-mono ' + crCls + '">' + CommonRenderer.formatPercent(sc.cr_pct) + '</td>' +
                    '<td>' + statusHtml + '</td></tr>';
            });
            html += '</tbody></table></div>';
        }

        // ====== 6. Peg Status ======
        var peg = specific.peg;
        if (peg && peg.price) {
            var deviation = Math.abs(1.0 - peg.price) * 100;
            var pegCls = deviation < 0.5 ? 'positive' : deviation < 3 ? 'warning' : 'negative';
            var pegStatus = deviation < 0.5 ? 'ON PEG' : deviation < 3 ? 'MINOR DEPEG' : 'DEPEG';

            html += '<div class="panel">' +
                '<div class="panel-title">Peg Status</div>' +
                '<div class="grid grid-cols-2 md:grid-cols-4 gap-4">' +
                    '<div class="summary-card"><div class="card-label">USDD Price</div><div class="card-value ' + pegCls + '">$' + peg.price.toFixed(4) + '</div></div>' +
                    '<div class="summary-card"><div class="card-label">Deviation</div><div class="card-value ' + pegCls + '">' + deviation.toFixed(2) + '%</div><div class="text-xs text-slate-400 mt-1">' + pegStatus + '</div></div>' +
                    (peg.volume_24h ? '<div class="summary-card"><div class="card-label">24h Volume</div><div class="card-value">' + CommonRenderer.formatCurrency(peg.volume_24h) + '</div></div>' : '') +
                    (peg.market_cap ? '<div class="summary-card"><div class="card-label">Market Cap</div><div class="card-value">' + CommonRenderer.formatCurrency(peg.market_cap) + '</div></div>' : '') +
                '</div></div>';
        }

        container.innerHTML = html;
    }
};
