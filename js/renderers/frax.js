/**
 * FRAX-specific renderer — layout reorder, tier breakdown, Curve pool, supply.
 *
 * Layout order (FRAX-specific):
 *   1. Summary cards (common, then overridden here)
 *   2. Status panel (injected after summary)
 *   3. Liabilities breakdown (injected after status)
 *   4. Risk flags — full-width (cloned from sidebar, sidebar hidden)
 *   5. CR trend chart (common, unchanged)
 *   6. Backing breakdown table — full-width (pie hidden)
 *   7. Four-tier classification with stacked bar
 *   8. Curve pool with supply-context line
 *   9. Supply breakdown (collapsed)
 */

var FRAXRenderer = {

    render(data) {
        var container = document.getElementById('asset-specific-panels');
        var specific = data.asset_specific;
        if (!specific || specific.type !== 'frax') return;

        var s = data.summary;

        // Clean up injected panels from prior render (auto-refresh every 5min)
        ['frax-status-panel', 'frax-liabilities-panel', 'frax-risk-flags-panel'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.remove();
        });

        // ── 1. Override summary cards ──
        if (s.total_liabilities) {
            var cards = document.querySelectorAll('#summary-cards .summary-card');
            if (cards.length >= 2) {
                cards[0].querySelector('.card-label').textContent = 'Total Liabilities';
                cards[0].querySelector('.card-value').textContent = CommonRenderer.formatCurrencyExact(s.total_liabilities);
                cards[1].querySelector('.card-label').textContent = 'Total Assets';
            }
        }

        // ── 2. Status panel — inject after summary cards ──
        var summaryCards = document.getElementById('summary-cards');
        var vs = data.vault_status;
        if (vs && vs.frax_deprecated && summaryCards) {
            var statusHtml = '<div class="panel" id="frax-status-panel">' +
                '<div class="panel-title">Status</div>' +
                '<div class="risk-flag risk-warning">' + vs.note + '</div>' +
                '<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">';
            if (vs.on_chain_cr !== null) {
                var computedCR = s.collateral_ratio;
                var crDiff = vs.on_chain_cr - computedCR;
                var crDivergence = Math.abs(crDiff) > 1;
                statusHtml += '<div class="summary-card"><div class="card-label">On-Chain CR (frozen)</div><div class="card-value ' + (crDivergence ? 'negative' : '') + '">' + CommonRenderer.formatPercent(vs.on_chain_cr, 1) + '</div></div>';
                if (crDivergence) {
                    statusHtml += '<div class="summary-card"><div class="card-label">Oracle Divergence</div><div class="card-value negative">+' + crDiff.toFixed(1) + 'pp stale</div></div>';
                }
            }
            if (vs.cr_paused !== null) {
                statusHtml += '<div class="summary-card"><div class="card-label">CR Refresh</div><div class="card-value ' + (vs.cr_paused ? 'negative' : 'positive') + '">' + (vs.cr_paused ? 'Paused' : 'Active') + '</div></div>';
            }
            statusHtml += '</div></div>';

            var statusEl = document.createElement('div');
            statusEl.innerHTML = statusHtml;
            summaryCards.after(statusEl.firstChild);
        }

        // ── 3. Liabilities breakdown — inject after status panel ──
        var liabilities = data.liabilities_breakdown;
        var insertAfter = document.getElementById('frax-status-panel') || summaryCards;
        if (liabilities && liabilities.length > 0 && insertAfter) {
            var totalLiab = liabilities.reduce(function(sum, l) { return sum + l.value; }, 0);
            var liabHtml = '<div class="panel" id="frax-liabilities-panel">' +
                '<div class="panel-title">Liabilities Breakdown</div>' +
                '<table class="data-table"><thead><tr>' +
                '<th>Liability</th><th class="text-right">Value</th>' +
                '</tr></thead><tbody>';
            liabilities.forEach(function(l) {
                if (l.value > 0) {
                    liabHtml += '<tr><td>' + l.label + '</td>' +
                        '<td class="text-right font-mono">' + CommonRenderer.formatCurrencyExact(l.value) + '</td></tr>';
                }
            });
            liabHtml += '<tr class="font-bold border-t-2 border-slate-200">' +
                '<td>Total</td><td class="text-right font-mono">' + CommonRenderer.formatCurrencyExact(totalLiab) + '</td></tr>';
            liabHtml += '</tbody></table></div>';

            var liabEl = document.createElement('div');
            liabEl.innerHTML = liabHtml;
            insertAfter.after(liabEl.firstChild);
        }

        // ── 4. Risk flags — clone to full-width panel, hide sidebar + pie ──
        var liabPanel = document.getElementById('frax-liabilities-panel') || insertAfter;
        var riskFlagsOrig = document.getElementById('risk-flags');
        if (riskFlagsOrig && liabPanel) {
            var flagsHtml = '<div class="panel" id="frax-risk-flags-panel">' +
                '<div class="panel-title">Risk Flags</div>' +
                '<div>' + riskFlagsOrig.innerHTML + '</div></div>';
            var flagsEl = document.createElement('div');
            flagsEl.innerHTML = flagsHtml;
            liabPanel.after(flagsEl.firstChild);

            // Hide the sidebar column (risk flags + pie)
            var sidebarCol = riskFlagsOrig.closest('.panel').parentElement;
            if (sidebarCol) sidebarCol.style.display = 'none';

            // Make breakdown table full-width
            var bTable = document.getElementById('breakdown-table');
            if (bTable) {
                var twoColGrid = bTable.closest('.grid');
                if (twoColGrid) {
                    twoColGrid.classList.remove('lg:grid-cols-3');
                    twoColGrid.classList.add('lg:grid-cols-1');
                }
                // Remove col-span constraint from breakdown panel
                var bPanel = bTable.closest('.panel');
                if (bPanel) bPanel.classList.remove('lg:col-span-2');
            }
        }

        // ── 5-6. CR chart + breakdown table: no changes, common renderer handles ──

        // ── 7-9. Asset-specific panels ──
        var html = '';

        // 7. Four-tier classification with stacked bar
        var tiers = specific.tier_breakdown;
        if (tiers) {
            // Compute proportions for stacked bar (excluding frxusd_system)
            var tierTotal = tiers.circular.total + tiers.ecosystem.total + tiers.external.total;
            var circPct = tierTotal > 0 ? (tiers.circular.total / tierTotal * 100) : 0;
            var ecoPct = tierTotal > 0 ? (tiers.ecosystem.total / tierTotal * 100) : 0;
            var extPct = tierTotal > 0 ? (tiers.external.total / tierTotal * 100) : 0;

            html += '<div class="panel">' +
                '<div class="panel-title">Four-Tier Asset Classification</div>' +
                '<p class="text-sm text-slate-500 mb-4">L-FRAX assets are classified into tiers. Only "External" represents hard, non-FRAX backing.</p>';

            // Stacked bar
            html += '<div class="flex rounded-lg overflow-hidden h-6 mb-4" title="Circular: ' + circPct.toFixed(1) + '% · Ecosystem: ' + ecoPct.toFixed(1) + '% · External: ' + extPct.toFixed(1) + '%">';
            if (circPct > 0) html += '<div style="width:' + circPct + '%; background:#dc2626" class="flex items-center justify-center text-white text-xs font-bold">' + (circPct >= 8 ? circPct.toFixed(0) + '%' : '') + '</div>';
            if (ecoPct > 0) html += '<div style="width:' + ecoPct + '%; background:#f59e0b" class="flex items-center justify-center text-white text-xs font-bold">' + (ecoPct >= 8 ? ecoPct.toFixed(0) + '%' : '') + '</div>';
            if (extPct > 0) html += '<div style="width:' + extPct + '%; background:#16a34a" class="flex items-center justify-center text-white text-xs font-bold">' + (extPct >= 8 ? extPct.toFixed(0) + '%' : '') + '</div>';
            html += '</div>';

            // Legend
            html += '<div class="flex gap-4 text-xs text-slate-500 mb-4">' +
                '<span><span class="inline-block w-3 h-3 rounded-sm mr-1" style="background:#dc2626"></span>Circular</span>' +
                '<span><span class="inline-block w-3 h-3 rounded-sm mr-1" style="background:#f59e0b"></span>Ecosystem</span>' +
                '<span><span class="inline-block w-3 h-3 rounded-sm mr-1" style="background:#16a34a"></span>External</span>' +
                '</div>';

            // Tier cards
            html += '<div class="grid grid-cols-1 md:grid-cols-4 gap-4">';
            var tierItems = [
                { label: 'Circular (Treasury)', value: tiers.circular.total, cls: 'negative', detail: tiers.circular.tokens },
                { label: 'Ecosystem', value: tiers.ecosystem.total, cls: 'warning', detail: tiers.ecosystem.tokens },
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

        // 8. Curve pool health with supply context
        var pool = specific.curve_pool;
        if (pool && pool.frax_balance) {
            var poolHealthClass = pool.frax_pct > 60 ? 'negative' : pool.frax_pct > 50 ? 'warning' : 'positive';
            var poolHealthLabel = pool.frax_pct > 60 ? 'Imbalanced' : pool.frax_pct > 50 ? 'Slightly FRAX-heavy' : 'Balanced';
            var totalPool = pool.frxusd_balance + pool.frax_balance;

            html += '<div class="panel">' +
                '<div class="panel-title">Curve frxUSD/FRAX Pool (AMO Peg Health)</div>' +
                '<div class="grid grid-cols-1 md:grid-cols-4 gap-4">' +
                    '<div class="summary-card"><div class="card-label">frxUSD Balance</div><div class="card-value">' + CommonRenderer.formatCurrency(pool.frxusd_balance) + '</div></div>' +
                    '<div class="summary-card"><div class="card-label">FRAX Balance</div><div class="card-value">' + CommonRenderer.formatCurrency(pool.frax_balance) + '</div></div>' +
                    '<div class="summary-card"><div class="card-label">FRAX % of Pool</div><div class="card-value ' + poolHealthClass + '">' + CommonRenderer.formatPercent(pool.frax_pct, 1) + '</div></div>' +
                    '<div class="summary-card"><div class="card-label">Pool Health</div><div class="card-value ' + poolHealthClass + '">' + poolHealthLabel + '</div></div>' +
                '</div>';

            // Supply context line
            var circSupply = s.total_liabilities || s.total_supply;
            if (circSupply > 0 && totalPool > 0) {
                var poolPct = totalPool / circSupply * 100;
                var poolPctClass = poolPct < 3 ? 'text-red-600 font-semibold' : poolPct < 5 ? 'text-amber-600 font-semibold' : 'text-slate-500';
                html += '<div class="text-sm mt-3 ' + poolPctClass + '">Pool depth is ' + poolPct.toFixed(1) + '% of circulating supply (' + CommonRenderer.formatCurrency(totalPool) + ' / ' + CommonRenderer.formatCurrency(circSupply) + ')</div>';
            }

            if (pool.swap_rate !== null) {
                html += '<div class="text-sm text-slate-500 mt-1">1 FRAX &rarr; ' + pool.swap_rate.toFixed(6) + ' frxUSD</div>';
            }
            html += '</div>';
        }

        // 9. Supply breakdown (collapsed)
        var supply = specific.supply_breakdown;
        if (supply) {
            html += '<div class="panel">' +
                '<details>' +
                '<summary class="panel-title cursor-pointer select-none" style="margin-bottom:0">Supply Breakdown <span class="text-xs font-normal text-slate-400">(click to expand)</span></summary>' +
                '<table class="data-table mt-3"><tbody>' +
                '<tr><td>FRAX + LFRAX supply</td><td class="text-right font-mono">' + Number(supply.csv_frax_lfrax_qty).toLocaleString() + '</td></tr>' +
                '<tr><td>+ sFRAX supply (on-chain)</td><td class="text-right font-mono">' + Number(supply.sfrax_supply_qty).toLocaleString() + '</td></tr>' +
                '<tr><td>+ sfrxUSD supply (on-chain)</td><td class="text-right font-mono">' + Number(supply.sfrxusd_supply_qty).toLocaleString() + '</td></tr>' +
                '<tr><td>- Protocol-held</td><td class="text-right font-mono">-' + Number(supply.protocol_held_qty).toLocaleString() + '</td></tr>' +
                '<tr class="font-bold border-t-2 border-slate-200"><td>Net circulating</td><td class="text-right font-mono">' + Number(supply.net_circulating_qty).toLocaleString() + '</td></tr>' +
                '</tbody></table>' +
                '</details></div>';
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
