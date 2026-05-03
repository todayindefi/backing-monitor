/**
 * Common renderer — handles generic sections shared by all assets.
 */

const CommonRenderer = {

    formatCurrency(num) {
        if (num === null || num === undefined) return '-';
        if (Math.abs(num) >= 1e6) return '$' + (num / 1e6).toFixed(1) + 'M';
        if (Math.abs(num) >= 1e3) return '$' + (num / 1e3).toFixed(1) + 'K';
        return '$' + num.toFixed(0);
    },

    formatCurrencyExact(num) {
        if (num === null || num === undefined) return '-';
        return '$' + num.toLocaleString('en-US', { maximumFractionDigits: 0 });
    },

    formatPercent(num, decimals) {
        if (num === null || num === undefined) return '-';
        decimals = decimals !== undefined ? decimals : 2;
        return num.toFixed(decimals) + '%';
    },

    formatDate(isoString) {
        if (!isoString) return '-';
        var utc = isoString.endsWith('Z') ? isoString : isoString + 'Z';
        return new Date(utc).toLocaleString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
        });
    },

    // ------ Summary cards ------
    renderSummaryCards(data) {
        var s = data.summary;
        var displaySupply = s.circulating_supply || s.tvl_ex_pol || s.total_supply;
        var supplyLabel = (s.circulating_supply || s.tvl_ex_pol) ? 'Circulating Supply' : 'Total Supply';
        // Vault-share assets (1 unit ≠ $1) opt out of dollar formatting via summary.supply_unit.
        var supplyValue;
        if (s.supply_unit === 'shares') {
            supplyValue = (displaySupply || 0).toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' shares';
        } else {
            supplyValue = this.formatCurrencyExact(displaySupply);
        }

        var cards = [
            { label: supplyLabel, value: supplyValue },
            { label: 'Total Backing', value: this.formatCurrencyExact(s.total_backing) },
            { label: 'Collateral Ratio', value: this.formatPercent(s.collateral_ratio), cls: s.collateral_ratio >= 100 ? 'positive' : 'negative' },
            { label: s.collateral_ratio_alt.label, value: s.collateral_ratio_alt.is_currency ? this.formatCurrency(s.collateral_ratio_alt.value) : this.formatPercent(s.collateral_ratio_alt.value), cls: s.collateral_ratio_alt.is_currency ? '' : (s.collateral_ratio_alt.value >= 100 ? 'positive' : 'warning') },
            { label: 'Surplus / Deficit', value: this.formatCurrencyExact(s.surplus_deficit), cls: s.surplus_deficit >= 0 ? 'positive' : 'negative' },
        ];

        // Asset-specific renderers can prepend extra cards (e.g. NAV for vault shares).
        var spec = data.asset_specific || {};
        if (Array.isArray(spec.extra_summary_cards)) {
            cards = spec.extra_summary_cards.concat(cards);
        }
        // Asset-specific renderers can override individual cards by label
        // (e.g. relabel "Collateral Ratio" → "Pool Coverage Ratio" + add subtext).
        // An override with `hidden: true` removes the card entirely.
        var overrides = spec.card_overrides;
        if (overrides && typeof overrides === 'object') {
            cards = cards.map(function(c) {
                var ov = overrides[c.label];
                if (!ov) return c;
                return Object.assign({}, c, ov);
            }).filter(function(c) { return !c.hidden; });
        }

        var container = document.getElementById('summary-cards');
        container.innerHTML = cards.map(function(c) {
            return '<div class="summary-card">' +
                '<div class="card-label">' + c.label + '</div>' +
                (c.prefix_html ? c.prefix_html : '') +
                '<div class="card-value ' + (c.cls || '') + '">' + c.value + '</div>' +
                (c.subtext ? '<div class="text-xs text-slate-400 mt-1">' + c.subtext + '</div>' : '') +
                (c.extra_html ? c.extra_html : '') +
                '</div>';
        }).join('');
    },

    // ------ Backing breakdown table ------
    renderBreakdownTable(data) {
        var tbody = document.querySelector('#breakdown-table tbody');
        var rows = data.backing_breakdown.map(function(item) {
            var tags = item.tags.map(function(t) {
                return '<span class="tag tag-' + t + '">' + t + '</span>';
            }).join('');
            var barColor = item.tags.indexOf('amo') >= 0 ? '#ef4444' :
                           item.tags.indexOf('cross-chain') >= 0 ? '#3b82f6' :
                           item.tags.indexOf('idle') >= 0 ? '#22c55e' : '#6366f1';
            return '<tr>' +
                '<td class="font-medium">' + item.label + tags + '</td>' +
                '<td class="text-right font-mono">' + CommonRenderer.formatCurrencyExact(item.value) + '</td>' +
                '<td class="text-right font-mono">' + CommonRenderer.formatPercent(item.pct, 1) + '</td>' +
                '<td><div class="pct-bar-container"><div class="pct-bar" style="width:' + item.pct + '%; background:' + barColor + '"></div></div></td>' +
                '</tr>';
        });

        // Total row
        var total = data.backing_breakdown.reduce(function(sum, i) { return sum + i.value; }, 0);
        rows.push(
            '<tr class="font-bold border-t-2 border-slate-200">' +
            '<td>Total</td>' +
            '<td class="text-right font-mono">' + CommonRenderer.formatCurrencyExact(total) + '</td>' +
            '<td class="text-right">100%</td>' +
            '<td></td></tr>'
        );
        tbody.innerHTML = rows.join('');
    },

    // ------ Pie chart ------
    renderPieChart(data) {
        var ctx = document.getElementById('pie-chart');
        if (!ctx) return;

        var items = data.backing_breakdown.filter(function(i) { return i.pct > 0.5; });
        var palette = ['#6366f1', '#3b82f6', '#14b8a6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#84cc16'];
        var colorIdx = 0;
        var colors = items.map(function(i) {
            if (i.tags.indexOf('amo') >= 0 || i.tags.indexOf('circular') >= 0) return '#ef4444';
            if (i.tags.indexOf('cross-chain') >= 0) return '#3b82f6';
            if (i.tags.indexOf('idle') >= 0) return '#22c55e';
            if (i.tags.indexOf('pegkeeper') >= 0) return '#f97316';
            return palette[colorIdx++ % palette.length];
        });

        if (window._pieChart) window._pieChart.destroy();
        window._pieChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: items.map(function(i) { return i.label; }),
                datasets: [{
                    data: items.map(function(i) { return i.value; }),
                    backgroundColor: colors,
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: true, position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } },
                    tooltip: {
                        callbacks: {
                            label: function(ctx) {
                                return ctx.label + ': ' + CommonRenderer.formatCurrencyExact(ctx.raw) + ' (' + CommonRenderer.formatPercent(ctx.raw / data.summary.total_backing * 100, 1) + ')';
                            }
                        }
                    }
                }
            }
        });
    },

    // ------ Risk flags ------
    renderRiskFlags(data) {
        var container = document.getElementById('risk-flags');
        if (!data.risk_flags || data.risk_flags.length === 0) {
            container.innerHTML = '<div class="text-green-600 text-sm font-medium">No risk flags</div>';
            return;
        }
        container.innerHTML = data.risk_flags.map(function(f) {
            return '<div class="risk-flag risk-' + f.severity + '">' + f.message + '</div>';
        }).join('');
    },

    // ------ CR trend chart ------
    renderCRChart(historyData, opts) {
        var ctx = document.getElementById('cr-chart');
        if (!ctx || !historyData || !historyData.entries || historyData.entries.length < 2) {
            document.getElementById('chart-panel').style.display = 'none';
            return;
        }
        document.getElementById('chart-panel').style.display = '';

        opts = opts || {};
        var bands = opts.bands || {
            critical: [0, 100], thin: [100, 110], amber: [110, 130], healthy: [130, 200],
            min_line: 100, max_line: 130
        };
        var title = opts.title || 'Collateral Ratio History';
        var datasetLabel = opts.dataset_label || 'CR';
        var altDatasetLabel = opts.alt_dataset_label || 'CR (gross)';
        // suggestedMin/Max default keeps the original 80-150 range; tight ratios (PCR) want to override
        var yMin = opts.y_min !== undefined ? opts.y_min : 80;
        var yMax = opts.y_max !== undefined ? opts.y_max : 150;
        // Update panel title if overridden
        var titleEl = document.querySelector('#chart-panel .panel-title');
        if (titleEl) titleEl.textContent = title;

        // Min/max CR stats
        var crValues = historyData.entries.map(function(e) { return e.collateral_ratio; }).filter(function(v) { return v !== null && v !== undefined; });
        if (crValues.length > 0) {
            var minCR = Math.min.apply(null, crValues);
            var maxCR = Math.max.apply(null, crValues);
            var statsEl = document.getElementById('cr-chart-stats');
            if (!statsEl) {
                statsEl = document.createElement('div');
                statsEl.id = 'cr-chart-stats';
                statsEl.className = 'flex gap-4 text-xs text-slate-500 mb-2';
                var chartPanel = document.getElementById('chart-panel');
                var titleEl = chartPanel.querySelector('.panel-title');
                if (titleEl) titleEl.after(statsEl);
            }
            var minCls = minCR < 100 ? 'text-red-600 font-semibold' : minCR < 110 ? 'text-amber-600 font-semibold' : '';
            statsEl.innerHTML = '<span>30d Min: <span class="font-mono ' + minCls + '">' + minCR.toFixed(2) + '%</span></span>' +
                '<span>30d Max: <span class="font-mono">' + maxCR.toFixed(2) + '%</span></span>' +
                '<span>Range: <span class="font-mono">' + (maxCR - minCR).toFixed(2) + 'pp</span></span>';
        }

        var entries = historyData.entries;
        var labels = entries.map(function(e) { return new Date(e.timestamp.endsWith('Z') ? e.timestamp : e.timestamp + 'Z'); });
        var crData = entries.map(function(e) { return e.collateral_ratio; });
        var crAltData = entries.map(function(e) { return e.collateral_ratio_alt; });

        // Drop the second series if explicitly suppressed, or if every value is null/undefined.
        var altHasData = !opts.omit_alt && crAltData.some(function(v) { return v !== null && v !== undefined; });
        var datasets = [{
            label: datasetLabel,
            data: crData,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            borderWidth: 2
        }];
        if (altHasData) {
            datasets.push({
                label: altDatasetLabel,
                data: crAltData,
                borderColor: '#f59e0b',
                backgroundColor: 'transparent',
                borderDash: [5, 3],
                tension: 0.3,
                pointRadius: 0,
                borderWidth: 2
            });
        }

        var minLine = bands.min_line;
        var maxLine = bands.max_line;
        var annotations = {
            critical: { type: 'box', yMin: bands.critical[0], yMax: bands.critical[1], backgroundColor: 'rgba(220, 38, 38, 0.08)', borderWidth: 0, label: { content: 'Critical', display: true, position: 'start', font: { size: 9 }, color: '#dc2626' } },
            thin: { type: 'box', yMin: bands.thin[0], yMax: bands.thin[1], backgroundColor: 'rgba(239, 68, 68, 0.06)', borderWidth: 0 },
            amber: { type: 'box', yMin: bands.amber[0], yMax: bands.amber[1], backgroundColor: 'rgba(245, 158, 11, 0.06)', borderWidth: 0 },
            healthy: { type: 'box', yMin: bands.healthy[0], yMax: bands.healthy[1], backgroundColor: 'rgba(22, 163, 74, 0.04)', borderWidth: 0 }
        };
        if (minLine !== undefined && minLine !== null) {
            annotations.minLine = { type: 'line', yMin: minLine, yMax: minLine, borderColor: '#dc2626', borderWidth: 1, borderDash: [4, 4], label: { content: minLine + '%', display: true, position: 'end', font: { size: 9 }, color: '#dc2626' } };
        }
        if (maxLine !== undefined && maxLine !== null) {
            annotations.maxLine = { type: 'line', yMin: maxLine, yMax: maxLine, borderColor: '#16a34a', borderWidth: 1, borderDash: [4, 4], label: { content: maxLine + '%', display: true, position: 'end', font: { size: 9 }, color: '#16a34a' } };
        }

        if (window._crChart) window._crChart.destroy();
        window._crChart = new Chart(ctx, {
            type: 'line',
            data: { labels: labels, datasets: datasets },
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
                        suggestedMin: yMin,
                        suggestedMax: yMax,
                        ticks: {
                            callback: function(v) { return v + '%'; },
                            font: { size: 11 }
                        }
                    }
                },
                plugins: {
                    legend: { display: true, position: 'top', labels: { boxWidth: 12, font: { size: 11 } } },
                    tooltip: {
                        callbacks: {
                            label: function(ctx) { return ctx.dataset.label + ': ' + ctx.raw.toFixed(2) + '%'; }
                        }
                    },
                    annotation: { annotations: annotations }
                },
                interaction: { intersect: false, mode: 'index' }
            }
        });
    }
};
