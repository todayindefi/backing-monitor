/**
 * OUSD-specific renderer — AMO analysis, cross-chain, vault status panels.
 */

var OUSDRenderer = {

    render(data) {
        var container = document.getElementById('asset-specific-panels');
        var specific = data.asset_specific;
        if (!specific || specific.type !== 'ousd') return;

        var html = '';
        var s = data.summary;

        // Peg performance — sits at the top of the asset-specific section,
        // immediately under the static Backing Breakdown / Allocation panels.
        html += OUSDRenderer._renderPegPerformance(specific);

        // Supply breakdown: circulating vs POL
        var circulating = s.circulating_supply || s.tvl_ex_pol;
        if (circulating && s.pol_self_minted) {
            var polPct = s.pol_self_minted / s.total_supply * 100;
            var circPct = 100 - polPct;
            html += '<div class="panel">' +
                '<div class="panel-title">Supply Breakdown</div>' +
                '<p class="text-sm text-slate-500 mb-3">Protocol-minted OUSD in Curve pools (POL) is excluded from both backing and circulating supply in the CR calculation. Only USDC in AMO pools counts as real backing.</p>' +
                '<div class="grid grid-cols-1 md:grid-cols-3 gap-4">' +
                    '<div class="summary-card"><div class="card-label">Circulating Supply</div><div class="card-value positive">' + CommonRenderer.formatCurrencyExact(circulating) + '</div><div class="text-xs text-slate-400 mt-1">' + CommonRenderer.formatPercent(circPct, 1) + ' of total</div></div>' +
                    '<div class="summary-card"><div class="card-label">POL (self-minted)</div><div class="card-value warning">' + CommonRenderer.formatCurrencyExact(s.pol_self_minted) + '</div><div class="text-xs text-slate-400 mt-1">' + CommonRenderer.formatPercent(polPct, 1) + ' of total</div></div>' +
                    '<div class="summary-card"><div class="card-label">Total Supply</div><div class="card-value">' + CommonRenderer.formatCurrencyExact(s.total_supply) + '</div></div>' +
                '</div></div>';
        }

        // AMO Analysis
        var amo = specific.amo_analysis;
        var amoGross = amo ? (amo.amo_total_gross || amo.amo_total || 0) : 0;
        var amoUsdc = amo ? (amo.amo_usdc_only || (amoGross - (amo.total_ousd_in_pools || 0))) : 0;
        if (amo && amoGross > 0) {
            var poolRows = '';
            if (amo.curve_pools) {
                var pools = Object.entries(amo.curve_pools).sort(function(a, b) { return b[1].ousd_balance - a[1].ousd_balance; });
                poolRows = pools.map(function(p) {
                    return '<tr><td class="text-sm">' + p[0] + '</td>' +
                        '<td class="text-right font-mono text-sm">' + CommonRenderer.formatCurrencyExact(p[1].ousd_balance) + '</td></tr>';
                }).join('');
                poolRows += '<tr class="font-bold border-t border-slate-200"><td>Total OUSD in pools (excluded)</td>' +
                    '<td class="text-right font-mono">' + CommonRenderer.formatCurrencyExact(amo.total_ousd_in_pools) + '</td></tr>';
            }

            html += '<div class="panel">' +
                '<div class="panel-title">AMO Pool Breakdown</div>' +
                '<div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">' +
                    '<div class="summary-card"><div class="card-label">AMO Gross Value</div><div class="card-value">' + CommonRenderer.formatCurrency(amoGross) + '</div></div>' +
                    '<div class="summary-card"><div class="card-label">USDC Only (counted)</div><div class="card-value positive">' + CommonRenderer.formatCurrency(amoUsdc) + '</div></div>' +
                    '<div class="summary-card"><div class="card-label">OUSD (excluded)</div><div class="card-value warning">' + CommonRenderer.formatCurrency(amo.total_ousd_in_pools) + '</div></div>' +
                    '<div class="summary-card"><div class="card-label">Pool % of Supply</div><div class="card-value">' + CommonRenderer.formatPercent(amo.pool_pct_of_supply, 1) + '</div></div>' +
                '</div>' +
                '<p class="text-sm text-slate-500 mb-3">AMO strategies mint OUSD into Curve pools. Only the USDC side counts as backing \u2014 protocol-minted OUSD is excluded from both backing and circulating supply.</p>' +
                (poolRows ? '<table class="data-table"><thead><tr><th>Pool</th><th class="text-right">OUSD Balance (excluded)</th></tr></thead><tbody>' + poolRows + '</tbody></table>' : '') +
                '</div>';
        }

        // Morpho Market Allocations
        var morpho = specific.morpho_allocations;
        if (morpho && morpho.markets && morpho.markets.length > 0) {
            var marketRows = morpho.markets.map(function(m) {
                var selfRef = m.self_referential ? ' <span class="tag tag-circular">same issuer</span>' : '';
                var utilCls = m.utilization_pct >= 90 ? ' class="text-amber-600 font-semibold"' : '';
                return '<tr' + (m.self_referential ? ' class="bg-red-50 dark:bg-red-950"' : '') + '>' +
                    '<td class="font-medium">' + m.collateral + selfRef + '</td>' +
                    '<td class="text-right font-mono">' + CommonRenderer.formatCurrencyExact(m.vault_supply_usd) + '</td>' +
                    '<td class="text-right font-mono">' + CommonRenderer.formatPercent(m.pct_of_morpho, 1) + '</td>' +
                    '<td class="text-right font-mono"' + utilCls + '>' + CommonRenderer.formatPercent(m.utilization_pct, 1) + '</td>' +
                    '<td class="text-right font-mono">' + CommonRenderer.formatCurrency(m.available_liquidity_usd) + '</td>' +
                    '<td class="text-right font-mono">' + (m.lltv ? (m.lltv * 100).toFixed(0) + '%' : '-') + '</td>' +
                    '</tr>';
            });

            html += '<div class="panel">' +
                '<div class="panel-title">Morpho Lending Markets \u2014 Collateral Breakdown</div>' +
                '<p class="text-sm text-slate-500 mb-3">The Morpho v2 strategy deploys into ' + morpho.markets.length + ' markets via <span class="font-mono text-xs">' + morpho.vault_name + '</span>. ' +
                    (morpho.origin_collateral_pct > 0 ? '<span class="text-red-600 font-semibold">' + CommonRenderer.formatPercent(morpho.origin_collateral_pct, 0) + ' of Morpho lending is collateralized by Origin products (OETH) \u2014 same issuer as OUSD.</span>' : '') +
                '</p>' +
                '<div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">' +
                    '<div class="summary-card"><div class="card-label">Morpho Total</div><div class="card-value">' + CommonRenderer.formatCurrency(morpho.total_assets_usd) + '</div></div>' +
                    '<div class="summary-card"><div class="card-label">Available Liquidity</div><div class="card-value">' + CommonRenderer.formatCurrency(morpho.available_liquidity_usd) + '</div></div>' +
                    '<div class="summary-card"><div class="card-label">Origin Collateral</div><div class="card-value warning">' + CommonRenderer.formatPercent(morpho.origin_collateral_pct, 0) + '</div></div>' +
                    '<div class="summary-card"><div class="card-label">Origin $ Amount</div><div class="card-value warning">' + CommonRenderer.formatCurrency(morpho.origin_collateral_usd) + '</div></div>' +
                '</div>' +
                '<div class="overflow-x-auto"><table class="data-table"><thead><tr>' +
                    '<th>Collateral</th><th class="text-right">Allocation</th><th class="text-right">%</th>' +
                    '<th class="text-right">Utilization</th><th class="text-right">Avail. Liq.</th><th class="text-right">LLTV</th>' +
                '</tr></thead><tbody>' + marketRows.join('') + '</tbody></table></div>' +
                '</div>';
        }

        // Redemption Capacity
        var redeem = specific.redemption_capacity;
        if (redeem && redeem.instant_capacity_usd !== undefined) {
            var instantPct = redeem.instant_pct || 0;
            var barColor = instantPct >= 50 ? '#22c55e' : instantPct >= 25 ? '#f59e0b' : '#ef4444';
            html += '<div class="panel">' +
                '<div class="panel-title">Redemption Capacity</div>' +
                '<p class="text-sm text-slate-500 mb-3">Estimated instant redeemable USDC from vault idle balance and available Morpho liquidity. Remaining requires strategy withdrawal (up to 24h for cross-chain).</p>' +
                '<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">' +
                    '<div class="summary-card"><div class="card-label">Instant Capacity</div><div class="card-value ' + (instantPct >= 50 ? 'positive' : 'warning') + '">' + CommonRenderer.formatCurrency(redeem.instant_capacity_usd) + '</div>' +
                        '<div class="text-xs text-slate-400 mt-1">' + CommonRenderer.formatPercent(instantPct, 0) + ' of supply</div></div>' +
                    '<div class="summary-card"><div class="card-label">Vault Idle</div><div class="card-value">' + CommonRenderer.formatCurrency(redeem.vault_idle_usd) + '</div></div>' +
                    '<div class="summary-card"><div class="card-label">Morpho Available</div><div class="card-value">' + CommonRenderer.formatCurrency(redeem.morpho_available_usd) + '</div></div>' +
                '</div>' +
                '<div class="w-full bg-slate-200 dark:bg-slate-700 rounded h-4 mb-2">' +
                    '<div class="h-4 rounded" style="width:' + Math.min(instantPct, 100) + '%; background:' + barColor + '"></div>' +
                '</div>' +
                '<div class="text-xs text-slate-500">' + CommonRenderer.formatCurrency(redeem.instant_capacity_usd) + ' of ' + CommonRenderer.formatCurrency(redeem.total_supply_usd) + ' instantly redeemable</div>' +
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

        // Post-render chart — DOM nodes must exist first.
        OUSDRenderer._loadPegHistoryChart('ousd');
    },

    // ============================================================
    // Peg Performance — mirrors apxUSD's panel pattern.
    //
    // Renders a placeholder when peg data is absent or peg.market_price is
    // null — covers both the "analyzer patch not yet shipped" case (no peg
    // block on asset_specific) and a transient fetch failure mid-cycle.
    // ============================================================
    _renderPegPerformance: function(specific) {
        var peg = (specific && specific.peg) || {};
        var hasMarket = peg.market_price != null;

        if (!hasMarket) {
            return '<div class="panel">' +
                '<div class="panel-title">Peg Performance</div>' +
                '<div class="risk-flag risk-info">' +
                    '<strong>Peg data not yet available.</strong> ' +
                    'The OUSD analyzer has not emitted a peg block yet — this panel will ' +
                    'populate automatically once <span class="font-mono">ousd_backing.json</span> ' +
                    'begins carrying <span class="font-mono">asset_specific.peg.market_price</span>.' +
                '</div>' +
            '</div>';
        }

        var pdPct = peg.premium_discount_pct;
        var state = CommonRenderer.pegStatusClass(pdPct);
        var pdCls = CommonRenderer.pegPctClass(state);

        var marketTxt = '$' + peg.market_price.toFixed(4);
        var theoTxt = (peg.theoretical_price != null) ?
            '$' + peg.theoretical_price.toFixed(4) : '$1.0000';

        var statCards =
            '<div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">' +
                '<div class="summary-card"><div class="card-label">Market price</div>' +
                    '<div class="card-value">' + marketTxt + '</div>' +
                    '<div class="text-xs text-slate-400 mt-1">vs theoretical ' + theoTxt + '</div></div>' +
                '<div class="summary-card"><div class="card-label">Premium / Discount</div>' +
                    '<div class="card-value ' + pdCls + '">' + CommonRenderer.pegPctText(pdPct) + '</div></div>' +
                '<div class="summary-card"><div class="card-label">Status</div>' +
                    '<div class="mt-2">' + OUSDRenderer._statusPill(CommonRenderer.pegStatusLabel(state), state) + '</div></div>' +
            '</div>';

        var chartBlock =
            '<div class="mt-4">' +
                '<div class="text-sm font-semibold text-slate-700 mb-2">7-day premium / discount vs $1</div>' +
                '<div style="height: 360px; position: relative;">' +
                    '<canvas id="ousd-peg-history"></canvas>' +
                '</div>' +
            '</div>';

        var sourceTxt = peg.source || '—';
        var obsAgo = '—';
        if (peg.timestamp) {
            var pegMs = new Date(peg.timestamp.endsWith('Z') ? peg.timestamp : peg.timestamp + 'Z').getTime();
            if (!isNaN(pegMs)) {
                obsAgo = OUSDRenderer._formatAge((Date.now() - pegMs) / 1000);
            }
        }

        var secondaryRow =
            '<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-xs">' +
                '<div><div class="text-slate-400 uppercase font-medium">Source</div>' +
                    '<div class="font-mono text-slate-700 mt-0.5">' + sourceTxt + '</div></div>' +
                '<div><div class="text-slate-400 uppercase font-medium">Last observation</div>' +
                    '<div class="text-slate-700 mt-0.5">' + obsAgo + '</div></div>' +
            '</div>';

        return '<div class="panel">' +
            '<div class="panel-title">Peg Performance</div>' +
            statCards +
            chartBlock +
            secondaryRow +
        '</div>';
    },

    _loadPegHistoryChart: function(slug) {
        var ctx = document.getElementById('ousd-peg-history');
        if (!ctx || typeof Chart === 'undefined') return;
        var nocache = Math.floor(Date.now() / 60000);
        fetch('data/' + slug + '_backing_history.json?nocache=' + nocache)
            .then(function(r) { return r.ok ? r.json() : null; })
            .then(function(hist) {
                if (!hist || !Array.isArray(hist.entries)) {
                    ctx.parentElement.innerHTML = '<div class="text-xs text-slate-400 italic">Peg history unavailable.</div>';
                    return;
                }
                var cutoff = Date.now() - 7 * 24 * 3600 * 1000;
                var pts = hist.entries.filter(function(e) {
                    if (e.peg_premium_discount_pct == null) return false;
                    var ts = e.timestamp.endsWith('Z') ? e.timestamp : (e.timestamp + 'Z');
                    return new Date(ts).getTime() >= cutoff;
                });
                if (pts.length < 2) {
                    ctx.parentElement.innerHTML = '<div class="text-xs text-slate-400 italic">' +
                        'Peg history not yet populated — chart will appear once the analyzer emits a few cycles of OUSD peg readings.</div>';
                    return;
                }
                OUSDRenderer._drawPegHistory(ctx, pts);
            })
            .catch(function() {
                ctx.parentElement.innerHTML = '<div class="text-xs text-slate-400 italic">Peg history unavailable.</div>';
            });
    },

    _drawPegHistory: function(ctx, entries) {
        var labels = entries.map(function(e) {
            var ts = e.timestamp.endsWith('Z') ? e.timestamp : (e.timestamp + 'Z');
            return new Date(ts);
        });
        var pdSeries = entries.map(function(e) { return e.peg_premium_discount_pct; });
        var pointColors = pdSeries.map(function(v) {
            var st = CommonRenderer.pegStatusClass(v);
            if (st === 'ok') return '#3b82f6';
            if (st === 'warn') return '#f59e0b';
            if (st === 'critical') return '#ef4444';
            return '#94a3b8';
        });

        if (window._ousdPegChart) {
            try { window._ousdPegChart.destroy(); } catch (e) {}
        }
        window._ousdPegChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Premium / Discount',
                    data: pdSeries,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.08)',
                    pointBackgroundColor: pointColors,
                    pointBorderColor: pointColors,
                    fill: false,
                    tension: 0.25,
                    pointRadius: 2,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'time',
                        time: { unit: 'day', displayFormats: { day: 'MMM d' } },
                        grid: { display: false },
                        ticks: { maxTicksLimit: 8, font: { size: 11 } }
                    },
                    y: {
                        grid: { color: '#f1f5f9' },
                        suggestedMin: -1.0,
                        suggestedMax: 1.0,
                        ticks: {
                            font: { size: 11 },
                            callback: function(v) { return (v > 0 ? '+' : '') + Number(v).toFixed(2) + '%'; }
                        }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(c) { return c.dataset.label + ': ' + (c.raw != null ? c.raw.toFixed(3) + '%' : '—'); }
                        }
                    },
                    annotation: { annotations: CommonRenderer.pegBandAnnotations() }
                },
                interaction: { intersect: false, mode: 'index' }
            }
        });
    },

    _statusDot: function(state) {
        var color;
        if (state === 'ok') color = '#22c55e';
        else if (state === 'warn') color = '#f59e0b';
        else if (state === 'critical') color = '#ef4444';
        else color = '#94a3b8';
        return '<span class="inline-block w-2 h-2 rounded-full align-middle" style="background:' + color + '"></span>';
    },

    _statusPill: function(label, state, extra) {
        var bg, fg;
        if (state === 'ok')        { bg = 'bg-green-100'; fg = 'text-green-800'; }
        else if (state === 'warn') { bg = 'bg-amber-100'; fg = 'text-amber-800'; }
        else if (state === 'critical') { bg = 'bg-red-100'; fg = 'text-red-800'; }
        else                       { bg = 'bg-slate-100'; fg = 'text-slate-700'; }
        return '<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ' + bg + ' ' + fg + '">' +
            OUSDRenderer._statusDot(state) +
            '<span>' + label + (extra ? ' <span class="font-mono">' + extra + '</span>' : '') + '</span>' +
        '</span>';
    },

    _formatAge: function(seconds) {
        if (seconds == null) return '—';
        var s = Math.max(0, Math.floor(seconds));
        if (s < 60) return s + 's ago';
        if (s < 3600) {
            var m = Math.floor(s / 60);
            var r = s - m * 60;
            return m + 'm ' + (r < 10 ? '0' + r : r) + 's ago';
        }
        if (s < 86400) {
            var h = Math.floor(s / 3600);
            var m2 = Math.floor((s - h * 3600) / 60);
            return h + 'h ' + (m2 < 10 ? '0' + m2 : m2) + 'm ago';
        }
        var d = Math.floor(s / 86400);
        return d + (d === 1 ? ' day ago' : ' days ago');
    }
};
