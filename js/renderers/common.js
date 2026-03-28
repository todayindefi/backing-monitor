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
        var cards = [
            { label: 'Total Supply', value: this.formatCurrencyExact(s.total_supply) },
            { label: 'Total Backing', value: this.formatCurrencyExact(s.total_backing) },
            { label: 'Collateral Ratio', value: this.formatPercent(s.collateral_ratio), cls: s.collateral_ratio >= 100 ? 'positive' : 'negative' },
            { label: s.collateral_ratio_alt.label, value: s.collateral_ratio_alt.is_currency ? '$' + s.collateral_ratio_alt.value.toFixed(1) + 'M' : this.formatPercent(s.collateral_ratio_alt.value), cls: s.collateral_ratio_alt.is_currency ? '' : (s.collateral_ratio_alt.value >= 100 ? 'positive' : 'warning') },
            { label: 'Surplus / Deficit', value: this.formatCurrencyExact(s.surplus_deficit), cls: s.surplus_deficit >= 0 ? 'positive' : 'negative' },
        ];

        var container = document.getElementById('summary-cards');
        container.innerHTML = cards.map(function(c) {
            return '<div class="summary-card">' +
                '<div class="card-label">' + c.label + '</div>' +
                '<div class="card-value ' + (c.cls || '') + '">' + c.value + '</div>' +
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
    renderCRChart(historyData) {
        var ctx = document.getElementById('cr-chart');
        if (!ctx || !historyData || !historyData.entries || historyData.entries.length < 2) {
            document.getElementById('chart-panel').style.display = 'none';
            return;
        }
        document.getElementById('chart-panel').style.display = '';

        var entries = historyData.entries;
        var labels = entries.map(function(e) { return new Date(e.timestamp.endsWith('Z') ? e.timestamp : e.timestamp + 'Z'); });
        var crData = entries.map(function(e) { return e.collateral_ratio; });
        var crAltData = entries.map(function(e) { return e.collateral_ratio_alt; });

        if (window._crChart) window._crChart.destroy();
        window._crChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'CR',
                        data: crData,
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        fill: true,
                        tension: 0.3,
                        pointRadius: 0,
                        borderWidth: 2
                    },
                    {
                        label: 'CR (ex-AMO)',
                        data: crAltData,
                        borderColor: '#f59e0b',
                        backgroundColor: 'transparent',
                        borderDash: [5, 3],
                        tension: 0.3,
                        pointRadius: 0,
                        borderWidth: 2
                    }
                ]
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
                    }
                },
                interaction: { intersect: false, mode: 'index' }
            }
        });
    }
};
