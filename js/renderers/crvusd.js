/**
 * crvUSD renderer
 *
 * Supply = mint markets + YB deployed + CurveLendOperator + PK debt
 * CR = (mint collateral + YB BTC/ETH) / supply
 *
 * Section order:
 * 1. Supply Breakdown (minting sources + recirculation)
 * 2. Collateral Breakdown (all $329M — YB + mint, matching header)
 * 3. Collateral & Peg Defense (CR, PK burn cap, peg defense liquidity)
 * 4. YB Pools (per-pool detail with balance ratios)
 * 5. Minting Markets (per-market detail)
 * 6. LlamaLend (recirculation detail)
 * 7. PK Pool Liquidity (per-pool with imbalance flags)
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
            var total = sb.total || 1;

            var rc = specific.recirculation || {};

            html += '<div class="panel">' +
                '<div class="panel-title">Supply Breakdown</div>' +
                '<p class="text-sm text-slate-500 mb-3">Only sources that mint new crvUSD. totalSupply() returns ' + CommonRenderer.formatCurrency(sb.total_supply_raw) + ' (includes undeployed ceiling buffers).' +
                (sb.cg_circulating ? ' Curve/CoinGecko cross-check: ' + CommonRenderer.formatCurrency(sb.cg_circulating) + '.' : '') + '</p>' +
                '<table class="data-table"><thead><tr><th colspan="3" class="text-xs uppercase tracking-wide text-slate-500">Minting Sources (create new crvUSD)</th></tr><tr><th>Source</th><th class="text-right">Amount</th><th class="text-right">%</th></tr></thead><tbody>' +
                '<tr><td>YieldBasis deployed (AMM get_debt)</td><td class="text-right font-mono">' + CommonRenderer.formatCurrency(sb.yb_deployed) + '</td><td class="text-right">' + (sb.yb_deployed / total * 100).toFixed(1) + '%</td></tr>' +
                '<tr><td>Minting markets (collateral-backed CDPs)</td><td class="text-right font-mono">' + CommonRenderer.formatCurrency(sb.minting_markets) + '</td><td class="text-right">' + (sb.minting_markets / total * 100).toFixed(1) + '%</td></tr>' +
                (sb.operator_minted ? '<tr><td>CurveLendOperator (sreUSD market)</td><td class="text-right font-mono">' + CommonRenderer.formatCurrency(sb.operator_minted) + '</td><td class="text-right">' + (sb.operator_minted / total * 100).toFixed(1) + '%</td></tr>' : '') +
                '<tr><td>PegKeeper debt</td><td class="text-right font-mono">' + CommonRenderer.formatCurrency(sb.pegkeeper_debt) + '</td><td class="text-right">' + (sb.pegkeeper_debt / total * 100).toFixed(1) + '%</td></tr>' +
                '<tr class="font-bold border-t-2 border-slate-200"><td>Total crvUSD Supply</td><td class="text-right font-mono">' + CommonRenderer.formatCurrency(total) + '</td><td class="text-right">100%</td></tr>' +
                '</tbody></table>' +
                '<table class="data-table mt-4"><thead><tr><th colspan="2" class="text-xs uppercase tracking-wide text-slate-500">Recirculation (uses existing crvUSD, not minting)</th></tr></thead><tbody>' +
                '<tr><td>LlamaLend borrowed</td><td class="text-right font-mono">' + CommonRenderer.formatCurrency(rc.llamalend_borrowed || 0) + '</td></tr>' +
                '<tr><td>scrvUSD savings vault</td><td class="text-right font-mono">' + CommonRenderer.formatCurrency(rc.scrvusd_savings || 0) + '</td></tr>' +
                '</tbody></table></div>';
        }

        // ====== 1b. Supply Composition Over Time (stacked area + YB% danger line) ======
        // Canvases are populated by _loadSupplyCompChart() after innerHTML is set below.
        html += '<div class="panel">' +
            '<div class="panel-title">Supply Composition Over Time</div>' +
            '<p class="text-sm text-slate-500 mb-3">crvUSD supply by source. YieldBasis is the watch-item — its share is tracked against the report\'s 80%-of-supply concentration danger line.</p>' +
            '<div id="crvusd-supply-comp-section">' +
                '<div class="text-sm font-semibold text-slate-700 mb-2">Supply by source (stacked, reconciles to total supply)</div>' +
                '<div style="height:320px;position:relative;"><canvas id="crvusd-supply-comp-chart"></canvas></div>' +
            '</div>' +
            '<div id="crvusd-yb-pct-section">' +
                '<div class="text-sm font-semibold text-slate-700 mb-2 mt-5">YieldBasis % of supply</div>' +
                '<div style="height:220px;position:relative;"><canvas id="crvusd-yb-pct-chart"></canvas></div>' +
            '</div>' +
            '<p class="text-xs text-slate-400 mt-2">Supply-composition history begins 2026-05-26 (when per-source persistence was added). The window lengthens on its own as samples accumulate.</p>' +
            '</div>';

        // ====== 2. Collateral Breakdown (matches Total Backing header) ======
        var cb = specific.collateral_breakdown;
        if (cb) {
            var crCls = s.collateral_ratio < 100 ? 'negative' : s.collateral_ratio < 120 ? 'warning' : 'positive';
            var ybPct = cb.total > 0 ? (cb.yb_btc_collateral / cb.total * 100).toFixed(1) : '0';
            var mintPct = cb.total > 0 ? (cb.mint_collateral / cb.total * 100).toFixed(1) : '0';

            html += '<div class="panel">' +
                '<div class="panel-title">Collateral Breakdown</div>' +
                '<p class="text-sm text-slate-500 mb-3">All locked collateral backing crvUSD supply. CR: <span class="font-bold ' + crCls + '">' + CommonRenderer.formatPercent(s.collateral_ratio, 1) + '</span></p>' +
                '<table class="data-table"><thead><tr><th>Component</th><th class="text-right">Value</th><th class="text-right">%</th></tr></thead><tbody>' +
                '<tr><td>YB pool BTC/ETH</td><td class="text-right font-mono">' + CommonRenderer.formatCurrency(cb.yb_btc_collateral) + '</td><td class="text-right">' + ybPct + '%</td></tr>' +
                '<tr><td>Minting market collateral</td><td class="text-right font-mono">' + CommonRenderer.formatCurrency(cb.mint_collateral) + '</td><td class="text-right">' + mintPct + '%</td></tr>' +
                '<tr class="font-bold border-t-2 border-slate-200"><td>Total Backing</td><td class="text-right font-mono">' + CommonRenderer.formatCurrency(cb.total) + '</td><td class="text-right">100%</td></tr>' +
                '</tbody></table></div>';
        }

        // ====== 3. Peg Defense ======
        var pd = specific.peg_defense;
        if (pd) {
            var pkCls = pd.pk_burn_capacity > 0 ? (pd.pk_burn_capacity / s.total_supply > 0.05 ? 'positive' : 'warning') : 'negative';

            html += '<div class="panel">' +
                '<div class="panel-title">Peg Defense</div>' +
                '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">' +
                    '<div class="summary-card"><div class="card-label">PK Burn Capacity</div><div class="card-value ' + pkCls + '">' + CommonRenderer.formatCurrency(pd.pk_burn_capacity) + '</div><div class="text-xs text-slate-400 mt-1">Protocol-controlled supply removal</div></div>' +
                    '<div class="summary-card"><div class="card-label">Peg Defense Liquidity</div><div class="card-value">' + CommonRenderer.formatCurrency(pd.pk_pool_stables) + '</div><div class="text-xs text-slate-400 mt-1">LP-owned stables in PK pools, not guaranteed</div></div>' +
                '</div></div>';
        }

        // ====== 3. YB Pool Detail ======
        var ybPools = specific.yb_pools;
        if (ybPools && Object.keys(ybPools).length > 0) {
            html += '<div class="panel">' +
                '<div class="panel-title">YieldBasis Pools</div>' +
                '<p class="text-sm text-slate-500 mb-3">Debt = crvUSD borrowed by YB (counts as supply). Collateral = BTC/ETH in underlying Cryptoswap pools backing YB positions.</p>' +
                '<table class="data-table"><thead><tr><th>Pool</th><th class="text-right" style="width:140px">Debt (supply)</th><th class="text-right" style="width:140px">Collateral (USD)</th></tr></thead><tbody>';
            var ybTotal = {debt: 0, collateral: 0};
            Object.entries(ybPools).sort(function(a, b) { return (b[1].debt || b[1].crvusd || 0) - (a[1].debt || a[1].crvusd || 0); }).forEach(function(e) {
                var debt = e[1].debt || e[1].crvusd || 0;
                var collat = e[1].collateral_usd || 0;
                ybTotal.debt += debt;
                ybTotal.collateral += collat;
                html += '<tr><td class="font-medium">' + e[0] + '</td>' +
                    '<td class="text-right font-mono">' + CommonRenderer.formatCurrency(debt) + '</td>' +
                    '<td class="text-right font-mono">' + CommonRenderer.formatCurrency(collat) + '</td></tr>';
            });
            html += '<tr class="font-bold border-t-2 border-slate-200"><td>Total</td>' +
                '<td class="text-right font-mono">' + CommonRenderer.formatCurrency(ybTotal.debt) + '</td>' +
                '<td class="text-right font-mono">' + CommonRenderer.formatCurrency(ybTotal.collateral) + '</td></tr>' +
                '</tbody></table>' +
                '<p class="text-xs text-slate-400 mt-2">Detailed pool composition: <a href="https://yieldbasis.com/analytics/markets" target="_blank" class="text-blue-500 hover:underline">yieldbasis.com/analytics/markets</a></p></div>';
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

        // ====== 5. PK Pool Liquidity ======
        var pkPools = specific.pk_pool_liquidity;
        if (pkPools && Object.keys(pkPools).length > 0) {
            var pkDebt = s.total_pegkeeper_debt || 0;
            var pkDesc = pkDebt > 0 ?
                'PK debt: ' + CommonRenderer.formatCurrency(pkDebt) + '. PegKeepers can actively withdraw and burn crvUSD from these pools to push price up (protocol-controlled defense).' :
                'PK debt: $0 (no protocol-controlled burn capacity). Peg defense currently relies on market arbitrage only \u2014 if crvUSD depegs below $1, arbitrageurs can buy cheap crvUSD using the stablecoin reserves (' + CommonRenderer.formatCurrency(s.pk_stables) + '). PegKeeper active defense (withdraw + burn) is unavailable until PK debt > $0.';

            html += '<div class="panel"><div class="panel-title">PK Pool Liquidity (' + Object.keys(pkPools).length + ' pools)</div>' +
                '<p class="text-sm text-slate-500 mb-3">' + pkDesc + '</p>' +
                '<table class="data-table"><thead><tr><th>Pool</th><th class="text-right">Stablecoins</th><th class="text-right">crvUSD</th><th class="text-right">crvUSD %</th></tr></thead><tbody>';
            var stableTotal = 0, crvTotal = 0;
            Object.entries(pkPools).filter(function(e) { return e[1].stables > 1000 || e[1].crvusd > 1000; }).sort(function(a, b) { return b[1].stables - a[1].stables; }).forEach(function(e) {
                stableTotal += e[1].stables;
                crvTotal += e[1].crvusd;
                var poolTotal = e[1].stables + e[1].crvusd;
                var crvPct = poolTotal > 0 ? (e[1].crvusd / poolTotal * 100) : 0;
                var pctClass = crvPct > 70 ? 'text-red-600 font-bold' : crvPct > 60 ? 'text-amber-600' : 'text-green-600';
                html += '<tr><td>' + e[0] + '</td>' +
                    '<td class="text-right font-mono">' + CommonRenderer.formatCurrency(e[1].stables) + ' <span class="text-xs text-slate-400">' + e[1].stable_symbol + '</span></td>' +
                    '<td class="text-right font-mono text-slate-400">' + CommonRenderer.formatCurrency(e[1].crvusd) + '</td>' +
                    '<td class="text-right font-mono ' + pctClass + '">' + crvPct.toFixed(0) + '%</td></tr>';
            });
            var totalPct = (stableTotal + crvTotal) > 0 ? (crvTotal / (stableTotal + crvTotal) * 100) : 0;
            html += '<tr class="font-bold border-t border-slate-200"><td>Total</td>' +
                '<td class="text-right font-mono">' + CommonRenderer.formatCurrency(stableTotal) + '</td>' +
                '<td class="text-right font-mono text-slate-400">' + CommonRenderer.formatCurrency(crvTotal) + '</td>' +
                '<td class="text-right font-mono">' + totalPct.toFixed(0) + '%</td></tr>';
            html += '</tbody></table>';
            if (totalPct > 70) {
                html += '<p class="text-sm text-amber-600 mt-2">Pools are ' + totalPct.toFixed(0) + '% crvUSD (balanced = 50%). Indicates persistent selling pressure \u2014 consistent with crvUSD trading slightly below peg. Stablecoin reserves (' + CommonRenderer.formatCurrency(stableTotal) + ') absorb further depeg pressure.</p>';
            }
            html += '</div>';
        }

        // ====== 7. PegKeeper Debt (only show if debt > 0) ======
        var pks = specific.pegkeepers;
        if (pks && pks.length > 0) {
            var totalPkDebt = pks.reduce(function(a, pk) { return a + pk.debt; }, 0);
            if (totalPkDebt > 0) {
                html += '<div class="panel"><div class="panel-title">PegKeeper Debt</div>' +
                    '<p class="text-sm text-slate-500 mb-3">PegKeepers have minted crvUSD into pools (circular supply). This debt can be withdrawn and burned.</p>' +
                    '<div class="summary-card" style="display:inline-block"><div class="card-label">Total PK Debt</div><div class="card-value negative">' + CommonRenderer.formatCurrency(totalPkDebt) + '</div></div></div>';
            }
        }

        container.innerHTML = html;

        // Canvases now exist in the DOM — fetch history and draw.
        CrvUSDRenderer._loadSupplyCompChart();
    },

    // ====== Supply-composition charts ======

    // Stride-based downsample that always keeps the first and last point.
    _downsample: function(arr, max) {
        if (arr.length <= max) return arr;
        var step = Math.ceil(arr.length / max);
        var out = [];
        for (var i = 0; i < arr.length; i += step) out.push(arr[i]);
        if (out[out.length - 1] !== arr[arr.length - 1]) out.push(arr[arr.length - 1]);
        return out;
    },

    _toDate: function(e) {
        var t = e.timestamp;
        return new Date(t.endsWith('Z') ? t : t + 'Z');
    },

    _loadSupplyCompChart: function() {
        var canvas = document.getElementById('crvusd-supply-comp-chart');
        if (!canvas || typeof Chart === 'undefined') return;
        var nocache = Math.floor(Date.now() / 60000);
        fetch('data/crvusd_backing_history.json?nocache=' + nocache)
            .then(function(r) { return r.ok ? r.json() : null; })
            .then(function(hist) {
                // yb_crvusd_deployed is forward-only (null before 2026-05-26). Without this
                // filter the "Other" residual swallows the whole YB amount on pre-fix entries
                // and the stack shows a false cliff the hour the field landed.
                var entries = (hist && Array.isArray(hist.entries) ? hist.entries : [])
                    .filter(function(e) { return e.yb_crvusd_deployed != null; });
                if (entries.length < 2) {
                    CrvUSDRenderer._compUnavailable();
                    return;
                }
                entries = CrvUSDRenderer._downsample(entries, 300);
                CrvUSDRenderer._drawSupplyCompChart(canvas, entries);
                CrvUSDRenderer._drawYbPctChart(entries);
            })
            .catch(function() { CrvUSDRenderer._compUnavailable(); });
    },

    _compUnavailable: function() {
        var sec = document.getElementById('crvusd-supply-comp-section');
        if (sec) sec.innerHTML = '<div class="text-xs text-slate-400 italic">Supply-composition history populates after a few hours of samples (per-source persistence began 2026-05-26).</div>';
        var yb = document.getElementById('crvusd-yb-pct-section');
        if (yb) yb.style.display = 'none';
    },

    _drawSupplyCompChart: function(canvas, entries) {
        var labels = entries.map(CrvUSDRenderer._toDate);
        var totals = entries.map(function(e) { return e.total_supply || 0; });
        var mint = entries.map(function(e) { return e.total_market_debt || 0; });
        var yb   = entries.map(function(e) { return e.yb_crvusd_deployed || 0; });
        var pk   = entries.map(function(e) { return e.total_pegkeeper_debt || 0; });
        // "Other" is the residual vs total_supply so the four bands always sum to supply
        // (absorbs operator-minted / LlamaLend-supplied crvUSD). Clamp at 0 — timing/rounding
        // can occasionally make it marginally negative.
        var other = entries.map(function(e) {
            return Math.max(0, (e.total_supply || 0) - (e.total_market_debt || 0) - (e.yb_crvusd_deployed || 0) - (e.total_pegkeeper_debt || 0));
        });

        var ds = function(label, data, border, bg) {
            return { label: label, data: data, borderColor: border, backgroundColor: bg, fill: true, stack: 'supply', tension: 0.2, pointRadius: 0, borderWidth: 1.5 };
        };

        if (window._crvusdSupplyCompChart) { try { window._crvusdSupplyCompChart.destroy(); } catch (e) {} }
        window._crvusdSupplyCompChart = new Chart(canvas, {
            type: 'line',
            data: { labels: labels, datasets: [
                // bottom -> top: Mint, YieldBasis (highlighted), PegKeeper, Other
                ds('Mint markets (CDP)', mint, '#3b82f6', 'rgba(59,130,246,0.55)'),
                ds('YieldBasis', yb, '#f59e0b', 'rgba(245,158,11,0.75)'),
                ds('PegKeeper', pk, '#94a3b8', 'rgba(148,163,184,0.5)'),
                ds('Other (operator / LlamaLend)', other, '#22c55e', 'rgba(34,197,94,0.45)')
            ] },
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { intersect: false, mode: 'index' },
                scales: {
                    x: { type: 'time', time: { unit: 'day', displayFormats: { day: 'MMM d' } }, grid: { display: false }, ticks: { maxTicksLimit: 8, font: { size: 11 } } },
                    y: { stacked: true, beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 11 }, callback: function(v) { return '$' + (v / 1e6).toFixed(0) + 'M'; } } }
                },
                plugins: {
                    legend: { display: true, position: 'top', labels: { boxWidth: 12, font: { size: 11 } } },
                    tooltip: { callbacks: {
                        label: function(c) {
                            var tot = totals[c.dataIndex] || 0;
                            var pct = tot > 0 ? (c.parsed.y / tot * 100).toFixed(1) : '0.0';
                            return c.dataset.label + ': $' + (c.parsed.y / 1e6).toFixed(1) + 'M (' + pct + '%)';
                        },
                        footer: function(items) {
                            if (!items.length) return '';
                            var tot = totals[items[0].dataIndex] || 0;
                            return 'Total supply: $' + (tot / 1e6).toFixed(1) + 'M';
                        }
                    } }
                }
            }
        });
    },

    _drawYbPctChart: function(entries) {
        var canvas = document.getElementById('crvusd-yb-pct-chart');
        if (!canvas) return;
        var labels = entries.map(CrvUSDRenderer._toDate);
        var pct = entries.map(function(e) {
            return (e.total_supply > 0) ? e.yb_crvusd_deployed / e.total_supply * 100 : 0;
        });

        if (window._crvusdYbPctChart) { try { window._crvusdYbPctChart.destroy(); } catch (e) {} }
        window._crvusdYbPctChart = new Chart(canvas, {
            type: 'line',
            data: { labels: labels, datasets: [{
                label: 'YieldBasis % of supply', data: pct,
                borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.08)',
                fill: true, tension: 0.25, pointRadius: 0, borderWidth: 2
            }] },
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { intersect: false, mode: 'index' },
                scales: {
                    x: { type: 'time', time: { unit: 'day', displayFormats: { day: 'MMM d' } }, grid: { display: false }, ticks: { maxTicksLimit: 8, font: { size: 11 } } },
                    y: { suggestedMin: 0, suggestedMax: 100, grid: { color: '#f1f5f9' }, ticks: { font: { size: 11 }, callback: function(v) { return Number(v).toFixed(0) + '%'; } } }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: function(c) { return 'YieldBasis: ' + c.parsed.y.toFixed(1) + '% of supply'; } } },
                    annotation: { annotations: { ybDanger: {
                        type: 'line', yMin: 80, yMax: 80,
                        borderColor: 'rgba(220,38,38,0.8)', borderWidth: 1, borderDash: [4, 4],
                        label: { content: 'YB concentration danger (80%)', display: true, position: 'end', font: { size: 10 }, color: '#fff', backgroundColor: 'rgba(220,38,38,0.8)' }
                    } } }
                }
            }
        });
    }
};
