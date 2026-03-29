/**
 * FRAX-specific renderer — tier breakdown, Curve pool health, supply breakdown.
 */

var FRAXRenderer = {

    render(data) {
        var container = document.getElementById('asset-specific-panels');
        var specific = data.asset_specific;
        if (!specific || specific.type !== 'frax') return;

        var html = '';

        // Tier breakdown
        var tiers = specific.tier_breakdown;
        if (tiers) {
            html += '<div class="panel">' +
                '<div class="panel-title">Four-Tier Asset Classification</div>' +
                '<p class="text-sm text-slate-500 mb-4">L-FRAX assets are classified into tiers. Only "External" represents hard, non-FRAX backing.</p>' +
                '<div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">';

            var tierItems = [
                { label: 'Circular (Treasury)', value: tiers.circular.total, cls: 'warning', detail: tiers.circular.tokens },
                { label: 'Ecosystem', value: tiers.ecosystem.total, cls: '', detail: tiers.ecosystem.tokens },
                { label: 'External', value: tiers.external.total, cls: 'positive', detail: null },
                { label: 'frxUSD-sys (excluded)', value: tiers.frxusd_system.total, cls: '', detail: tiers.frxusd_system.positions + ' positions' },
            ];

            tierItems.forEach(function(t) {
                var detailHtml = '';
                if (t.detail && typeof t.detail === 'object') {
                    detailHtml = '<div class="text-xs text-slate-400 mt-1">' +
                        Object.entries(t.detail).map(function(e) { return e[0] + ': ' + Number(e[1]).toLocaleString(); }).join(', ') +
                        '</div>';
                } else if (t.detail) {
                    detailHtml = '<div class="text-xs text-slate-400 mt-1">' + t.detail + '</div>';
                }
                html += '<div class="summary-card">' +
                    '<div class="card-label">' + t.label + '</div>' +
                    '<div class="card-value ' + t.cls + '">' + CommonRenderer.formatCurrency(t.value) + '</div>' +
                    detailHtml + '</div>';
            });
            html += '</div></div>';
        }

        // Supply breakdown
        var supply = specific.supply_breakdown;
        if (supply) {
            html += '<div class="panel">' +
                '<div class="panel-title">Supply Breakdown</div>' +
                '<table class="data-table"><tbody>' +
                '<tr><td>FRAX + LFRAX supply</td><td class="text-right font-mono">' + Number(supply.csv_frax_lfrax_qty).toLocaleString() + '</td></tr>' +
                '<tr><td>+ sFRAX supply (on-chain)</td><td class="text-right font-mono">' + Number(supply.sfrax_supply_qty).toLocaleString() + '</td></tr>' +
                '<tr><td>+ sfrxUSD supply (on-chain)</td><td class="text-right font-mono">' + Number(supply.sfrxusd_supply_qty).toLocaleString() + '</td></tr>' +
                '<tr><td>- Protocol-held</td><td class="text-right font-mono">-' + Number(supply.protocol_held_qty).toLocaleString() + '</td></tr>' +
                '<tr class="font-bold border-t-2 border-slate-200"><td>Net circulating</td><td class="text-right font-mono">' + Number(supply.net_circulating_qty).toLocaleString() + '</td></tr>' +
                '</tbody></table></div>';
        }

        // Curve pool health
        var pool = specific.curve_pool;
        if (pool && pool.frax_balance) {
            var poolHealthClass = pool.frax_pct > 60 ? 'negative' : pool.frax_pct > 50 ? 'warning' : 'positive';
            var poolHealthLabel = pool.frax_pct > 60 ? 'Imbalanced' : pool.frax_pct > 50 ? 'Slightly FRAX-heavy' : 'Balanced';

            html += '<div class="panel">' +
                '<div class="panel-title">Curve frxUSD/FRAX Pool (AMO Peg Health)</div>' +
                '<div class="grid grid-cols-1 md:grid-cols-4 gap-4">' +
                    '<div class="summary-card"><div class="card-label">frxUSD Balance</div><div class="card-value">' + CommonRenderer.formatCurrency(pool.frxusd_balance) + '</div></div>' +
                    '<div class="summary-card"><div class="card-label">FRAX Balance</div><div class="card-value">' + CommonRenderer.formatCurrency(pool.frax_balance) + '</div></div>' +
                    '<div class="summary-card"><div class="card-label">FRAX % of Pool</div><div class="card-value ' + poolHealthClass + '">' + CommonRenderer.formatPercent(pool.frax_pct, 1) + '</div></div>' +
                    '<div class="summary-card"><div class="card-label">Pool Health</div><div class="card-value ' + poolHealthClass + '">' + poolHealthLabel + '</div></div>' +
                '</div>';
            if (pool.swap_rate !== null) {
                html += '<div class="text-sm text-slate-500 mt-3">1 FRAX &rarr; ' + pool.swap_rate.toFixed(6) + ' frxUSD</div>';
            }
            html += '</div>';
        }

        // Vault status / deprecation notice
        var vs = data.vault_status;
        if (vs && vs.frax_deprecated) {
            html += '<div class="panel">' +
                '<div class="panel-title">Status</div>' +
                '<div class="risk-flag risk-info">' + vs.note + '</div>' +
                '<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">';
            if (vs.on_chain_cr !== null) {
                html += '<div class="summary-card"><div class="card-label">On-Chain CR (frozen)</div><div class="card-value">' + CommonRenderer.formatPercent(vs.on_chain_cr, 1) + '</div></div>';
            }
            if (vs.cr_paused !== null) {
                html += '<div class="summary-card"><div class="card-label">CR Refresh</div><div class="card-value warning">' + (vs.cr_paused ? 'Paused' : 'Active') + '</div></div>';
            }
            html += '</div></div>';
        }

        // Data snapshot note
        var snapshot = data.data_snapshot || data.csv_snapshot;
        if (snapshot) {
            var sourceLabel = data.data_source === 'api' ? 'API' : 'CSV';
            html += '<div class="text-xs text-slate-400 mt-2">Data snapshot: ' + snapshot + ' (source: ' + sourceLabel + ', from facts.frax.finance)</div>';
        }

        container.innerHTML = html;
    }
};
