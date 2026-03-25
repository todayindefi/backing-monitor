/**
 * OUSD-specific renderer — AMO analysis, cross-chain, vault status panels.
 */

var OUSDRenderer = {

    render(data) {
        var container = document.getElementById('asset-specific-panels');
        var specific = data.asset_specific;
        if (!specific || specific.type !== 'ousd') return;

        var html = '';

        // AMO Analysis
        var amo = specific.amo_analysis;
        if (amo && amo.amo_total > 0) {
            var poolRows = '';
            if (amo.curve_pools) {
                var pools = Object.entries(amo.curve_pools).sort(function(a, b) { return b[1].ousd_balance - a[1].ousd_balance; });
                poolRows = pools.map(function(p) {
                    return '<tr><td class="text-sm">' + p[0] + '</td>' +
                        '<td class="text-right font-mono text-sm">' + CommonRenderer.formatCurrencyExact(p[1].ousd_balance) + '</td></tr>';
                }).join('');
                poolRows += '<tr class="font-bold border-t border-slate-200"><td>Total OUSD in pools</td>' +
                    '<td class="text-right font-mono">' + CommonRenderer.formatCurrencyExact(amo.total_ousd_in_pools) + '</td></tr>';
            }

            html += '<div class="panel">' +
                '<div class="panel-title">AMO Circular Exposure</div>' +
                '<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">' +
                    '<div class="summary-card"><div class="card-label">AMO Value</div><div class="card-value warning">' + CommonRenderer.formatCurrency(amo.amo_total) + '</div></div>' +
                    '<div class="summary-card"><div class="card-label">% of Backing</div><div class="card-value warning">' + CommonRenderer.formatPercent(amo.amo_pct_of_backing, 1) + '</div></div>' +
                    '<div class="summary-card"><div class="card-label">Pool % of Supply</div><div class="card-value">' + CommonRenderer.formatPercent(amo.pool_pct_of_supply, 1) + '</div></div>' +
                '</div>' +
                '<p class="text-sm text-slate-500 mb-3">AMO strategies mint OUSD into Curve pools. The OUSD side is protocol-created (circular). Only the stablecoin side represents real backing.</p>' +
                (poolRows ? '<table class="data-table"><thead><tr><th>Pool</th><th class="text-right">OUSD Balance</th></tr></thead><tbody>' + poolRows + '</tbody></table>' : '') +
                '</div>';
        }

        // Cross-chain
        var cc = specific.cross_chain;
        if (cc && cc.remote_balance) {
            var transferWarning = cc.is_transfer_pending ?
                '<div class="risk-flag risk-warning mt-3">Transfer in progress \u2014 remote balance may be stale</div>' : '';

            html += '<div class="panel">' +
                '<div class="panel-title">Cross-Chain Breakdown (Ethereum \u2192 Base)</div>' +
                '<div class="grid grid-cols-1 md:grid-cols-3 gap-4">' +
                    '<div class="summary-card"><div class="card-label">On Base (Morpho)</div><div class="card-value">' + CommonRenderer.formatCurrency(cc.remote_balance) + '</div></div>' +
                    '<div class="summary-card"><div class="card-label">In-Flight (CCTP)</div><div class="card-value">' + CommonRenderer.formatCurrency(cc.pending_amount) + '</div></div>' +
                    '<div class="summary-card"><div class="card-label">Local USDC</div><div class="card-value">' + CommonRenderer.formatCurrency(cc.local_usdc) + '</div></div>' +
                '</div>' +
                transferWarning +
                '</div>';
        }

        // Vault status
        var vs = data.vault_status;
        if (vs) {
            var statusItems = [];
            if (vs.rebase_paused !== null) {
                var cls = vs.rebase_paused ? 'negative' : '';
                statusItems.push('<div class="summary-card"><div class="card-label">Rebase</div><div class="card-value ' + cls + '">' + (vs.rebase_paused ? 'PAUSED' : 'Active') + '</div></div>');
            }
            if (vs.capital_paused !== null) {
                var cls2 = vs.capital_paused ? 'negative' : '';
                statusItems.push('<div class="summary-card"><div class="card-label">Capital</div><div class="card-value ' + cls2 + '">' + (vs.capital_paused ? 'PAUSED' : 'Active') + '</div></div>');
            }
            if (vs.vault_buffer_pct !== null) {
                statusItems.push('<div class="summary-card"><div class="card-label">Vault Buffer</div><div class="card-value">' + CommonRenderer.formatPercent(vs.vault_buffer_pct) + '</div></div>');
            }
            if (statusItems.length > 0) {
                html += '<div class="panel"><div class="panel-title">Vault Status</div><div class="grid grid-cols-1 md:grid-cols-3 gap-4">' + statusItems.join('') + '</div></div>';
            }
        }

        container.innerHTML = html;
    }
};
