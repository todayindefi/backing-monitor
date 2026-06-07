/**
 * Common renderer — handles generic sections shared by all assets.
 */

// 5-axis rating thresholds. Namespaced top-level const (renderer files share JS
// global scope — see the cross-file collision rule). Cutoffs map a metric to a
// 1–5 rating; per-asset overrides come via data.asset_specific.axis_thresholds.
var RISK_AXIS_THRESHOLDS = {
    peg:       { abs_dev_pct: [0.15, 0.30, 0.50, 1.0] },  // 5/4/3/2 cutoffs (smaller = better); else 1
    liquidity: { depth_usd:   [2e6, 1e6, 5e5, 1e5] },     // 5/4/3/2 cutoffs (larger = better); else 1
    backing:   { cr_pct:      [130, 110, 100, 90] }       // 5/4/3/2 cutoffs (larger = better); else 1
};

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

    // ------ Peg / NAV-spread shared helpers ------
    // Threshold mirrors the Layer-3 alerter:
    //   <0.25% → Healthy (ok)
    //   <0.50% → Watch   (warn)
    //   ≥0.50% → Stress  (critical)
    // Absolute value — premium and discount of equal magnitude get the same severity.
    pegStatusClass(pctValue) {
        if (pctValue == null) return 'unknown';
        var abs = Math.abs(pctValue);
        if (abs < 0.25) return 'ok';
        if (abs < 0.50) return 'warn';
        return 'critical';
    },

    pegStatusLabel(state) {
        if (state === 'ok') return 'Healthy';
        if (state === 'warn') return 'Watch';
        if (state === 'critical') return 'Stress';
        return '—';
    },

    pegPctText(pct, decimals) {
        if (pct == null) return '—';
        decimals = decimals != null ? decimals : 3;
        var sign = pct >= 0 ? '+' : '';
        return sign + pct.toFixed(decimals) + '%';
    },

    pegPctClass(state) {
        if (state === 'ok') return 'text-green-600';
        if (state === 'warn') return 'text-amber-600';
        if (state === 'critical') return 'text-red-600';
        return 'text-slate-500';
    },

    // ±25 / ±50 / ±100 bps reference bands for peg/spread charts.
    pegBandAnnotations() {
        return {
            healthyBand:   { type: 'box', yMin: -0.25, yMax: 0.25, backgroundColor: 'rgba(34, 197, 94, 0.07)', borderWidth: 0 },
            watchBandPos:  { type: 'box', yMin: 0.25, yMax: 0.50, backgroundColor: 'rgba(245, 158, 11, 0.06)', borderWidth: 0 },
            watchBandNeg:  { type: 'box', yMin: -0.50, yMax: -0.25, backgroundColor: 'rgba(245, 158, 11, 0.06)', borderWidth: 0 },
            stressBandPos: { type: 'box', yMin: 0.50, yMax: 1.00, backgroundColor: 'rgba(239, 68, 68, 0.06)', borderWidth: 0 },
            stressBandNeg: { type: 'box', yMin: -1.00, yMax: -0.50, backgroundColor: 'rgba(239, 68, 68, 0.06)', borderWidth: 0 },
            line25pos:  { type: 'line', yMin: 0.25,  yMax: 0.25,  borderColor: '#22c55e', borderWidth: 1, borderDash: [3, 3], label: { content: '+25 bps', display: true, position: 'end', font: { size: 9 }, color: '#16a34a' } },
            line25neg:  { type: 'line', yMin: -0.25, yMax: -0.25, borderColor: '#22c55e', borderWidth: 1, borderDash: [3, 3], label: { content: '-25 bps', display: true, position: 'end', font: { size: 9 }, color: '#16a34a' } },
            line50pos:  { type: 'line', yMin: 0.50,  yMax: 0.50,  borderColor: '#f59e0b', borderWidth: 1, borderDash: [3, 3], label: { content: '+50 bps', display: true, position: 'end', font: { size: 9 }, color: '#d97706' } },
            line50neg:  { type: 'line', yMin: -0.50, yMax: -0.50, borderColor: '#f59e0b', borderWidth: 1, borderDash: [3, 3], label: { content: '-50 bps', display: true, position: 'end', font: { size: 9 }, color: '#d97706' } },
            line100pos: { type: 'line', yMin: 1.00,  yMax: 1.00,  borderColor: '#ef4444', borderWidth: 1, borderDash: [3, 3], label: { content: '+100 bps', display: true, position: 'end', font: { size: 9 }, color: '#dc2626' } },
            line100neg: { type: 'line', yMin: -1.00, yMax: -1.00, borderColor: '#ef4444', borderWidth: 1, borderDash: [3, 3], label: { content: '-100 bps', display: true, position: 'end', font: { size: 9 }, color: '#dc2626' } },
            zero:       { type: 'line', yMin: 0,     yMax: 0,     borderColor: '#94a3b8', borderWidth: 1 }
        };
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

        // Basis caption: the % column is each line's share of the displayed
        // backing pie (the 100% row), NOT share of token supply. Generic line
        // for every asset; USG gets an addendum because the same page shows POL
        // on two different bases that otherwise look contradictory — the pie's
        // "POL pool stables" counter-side % vs the Supply Composition panel's
        // "POL deployed" share. Figures are read from live data so they always
        // match the panels above (no hardcoded numbers to go stale).
        var cap = document.getElementById('breakdown-caption');
        if (cap) {
            var note = "Percentages are each line’s share of total displayed backing (the 100% row) — not share of token supply.";
            if (data.asset_slug === 'usg') {
                var sc = data.asset_specific && data.asset_specific.supply_composition;
                var polRow = (data.backing_breakdown || []).filter(function(i) {
                    return i.tags && i.tags.indexOf('pol') >= 0;
                })[0];
                var polPiePct = polRow ? CommonRenderer.formatPercent(polRow.pct, 1) : null;
                var polSupplyPct = sc && sc.pol_pct != null ? CommonRenderer.formatPercent(sc.pol_pct, 1) : null;
                note += ' <strong>USG:</strong> this is the inclusive-CR backing pie (CDP collateral + PegKeeper pool counter-side stables).';
                if (polPiePct && polSupplyPct) {
                    note += ' The “POL pool stables (PegKeeper)” line — the pool counter-side stablecoins (USDC/frxUSD paired against protocol-minted USG) — is ' + polPiePct +
                        ' of this pie. That is a different quantity from the “POL deployed” figure (' + polSupplyPct +
                        ') in the Supply Composition panel above, which counts the protocol-minted USG itself as a share of supply. Both are correct: different numerators (counter-side stables vs minted USG) and different denominators (backing pie vs supply).';
                }
            }
            cap.innerHTML = note;
        }
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
    },

    // =====================================================================
    // 5-AXIS RISK FRAME
    // Activated only for assets that carry the Layer-1 axis blocks (peg /
    // liquidity / backing / dependencies / issuer). Assets without the blocks
    // keep the legacy backing-only layout untouched (the 4 non-backing
    // sections stay hidden and #summary-cards shows the old CR cards).
    // =====================================================================

    // True once the analyzer emits the standard axis contract. Keyed on `peg`
    // (the first block the analyzer attaches); the whole set lands together.
    hasAxisBlocks(data) {
        return !!(data && data.peg && typeof data.peg === 'object');
    },

    // Map a metric to a 1–5 rating against ascending/descending cutoffs.
    // direction 'high' = larger is better (liquidity, backing);
    // 'low' = smaller is better (peg deviation).
    _rate(value, cutoffs, direction) {
        if (value == null || !Array.isArray(cutoffs) || cutoffs.length !== 4) return null;
        if (direction === 'low') {
            if (value < cutoffs[0]) return 5;
            if (value < cutoffs[1]) return 4;
            if (value < cutoffs[2]) return 3;
            if (value < cutoffs[3]) return 2;
            return 1;
        }
        if (value >= cutoffs[0]) return 5;
        if (value >= cutoffs[1]) return 4;
        if (value >= cutoffs[2]) return 3;
        if (value >= cutoffs[3]) return 2;
        return 1;
    },

    _axisThresholds(data) {
        var ov = (data.asset_specific && data.asset_specific.axis_thresholds) || {};
        return {
            peg:       ov.peg       || RISK_AXIS_THRESHOLDS.peg,
            liquidity: ov.liquidity || RISK_AXIS_THRESHOLDS.liquidity,
            backing:   ov.backing   || RISK_AXIS_THRESHOLDS.backing
        };
    },

    // Rating → display chip. 5/4 healthy, 3 watch, ≤2 stress, null = not rated.
    _ratingChip(rating) {
        if (rating == null) return { cls: 'r-na', text: 'Not rated' };
        var cls = rating >= 4 ? 'r-ok' : (rating === 3 ? 'r-warn' : 'r-crit');
        var word = rating >= 4 ? 'Healthy' : (rating === 3 ? 'Watch' : 'Stress');
        return { cls: cls, text: word + ' · ' + rating + '/5' };
    },

    _ratingChipHtml(rating) {
        var c = this._ratingChip(rating);
        return '<span class="axis-rating ' + c.cls + '">' + c.text + '</span>';
    },

    // --- per-axis ratings ---
    pegRating(data, history) {
        var th = this._axisThresholds(data).peg.abs_dev_pct;
        // Prefer 7-day average absolute deviation when peg-history is available;
        // else the latest premium/discount magnitude (As-built: history lives in
        // *_backing_history.json under peg.history_field).
        var avg = this._pegAvgAbsDev(data, history, 7);
        var dev = (avg != null) ? avg
            : (data.peg.premium_discount_pct != null ? Math.abs(data.peg.premium_discount_pct) : null);
        return this._rate(dev, th, 'low');
    },

    _pegAvgAbsDev(data, history, days) {
        if (!history || !Array.isArray(history.entries) || !history.entries.length) return null;
        var field = data.peg.history_field || 'peg_premium_discount_pct';
        var nav = data.peg.nav != null ? data.peg.nav : 1.0;
        var entries = history.entries;
        // Window the last `days` worth of points by timestamp; fall back to the
        // tail count if timestamps are missing.
        var last = entries[entries.length - 1];
        var cutoff = null;
        if (last && last.timestamp) {
            var t = new Date(last.timestamp.endsWith('Z') ? last.timestamp : last.timestamp + 'Z').getTime();
            cutoff = t - days * 86400000;
        }
        var devs = [];
        for (var i = 0; i < entries.length; i++) {
            var e = entries[i];
            if (cutoff != null && e.timestamp) {
                var et = new Date(e.timestamp.endsWith('Z') ? e.timestamp : e.timestamp + 'Z').getTime();
                if (et < cutoff) continue;
            }
            var v = e[field];
            if (v == null) continue;
            // Field may be a price (→ convert to % deviation vs nav) or already a %.
            var devPct = (field.indexOf('pct') >= 0) ? Math.abs(v)
                : (nav ? Math.abs((v - nav) / nav * 100) : null);
            if (devPct != null) devs.push(devPct);
        }
        if (!devs.length) return null;
        return devs.reduce(function(a, b) { return a + b; }, 0) / devs.length;
    },

    liquidityRating(data) {
        var th = this._axisThresholds(data).liquidity.depth_usd;
        return this._rate(data.liquidity ? data.liquidity.total_2pct_depth : null, th, 'high');
    },

    // Backing rating honours an asset's chart_bands override (e.g. USG PCR) when
    // present, otherwise the generic CR cutoffs.
    backingRating(data) {
        var cr = (data.backing && data.backing.collateral_ratio != null)
            ? data.backing.collateral_ratio
            : (data.summary && data.summary.collateral_ratio);
        if (cr == null) return null;
        var bands = data.asset_specific && data.asset_specific.chart_bands;
        if (bands) {
            // verbose {critical,thin,amber,healthy:[lo,hi]} or short {pcr|thresholds:[a,b,c,d]}
            var healthyFloor, watchFloor;
            if (Array.isArray(bands.healthy) && Array.isArray(bands.amber)) {
                healthyFloor = bands.healthy[0];
                watchFloor = bands.amber[0];
            } else {
                var short = bands.pcr || bands.thresholds;
                if (Array.isArray(short) && short.length === 4) {
                    healthyFloor = short[2];  // app.js maps healthy:[c,d]
                    watchFloor = short[1];    // amber:[b,c]
                }
            }
            if (healthyFloor != null && watchFloor != null) {
                if (cr >= healthyFloor) return 5;
                if (cr >= watchFloor) return 3;
                return 1;
            }
        }
        return this._rate(cr, this._axisThresholds(data).backing.cr_pct, 'high');
    },

    // --- summary band (replaces the legacy 5 CR cards in 5-axis mode) ---
    renderAxisBand(data, history) {
        var container = document.getElementById('summary-cards');
        if (!container) return;
        var peg = data.peg || {}, liq = data.liquidity || {}, dep = data.dependencies || {};
        var issuer = data.issuer || {};

        var pegPct = peg.premium_discount_pct;
        var pegCls = this.pegPctClass(this.pegStatusClass(pegPct));
        var pegArrow = this._pegTrendArrow(data, history);

        var nUp = Array.isArray(dep.upstream) ? dep.upstream.length : 0;
        // Downstream is a reserved stub until a consumer analyzer exists; an
        // absent/false `downstream_tracked` flag means "not tracked", NOT "0".
        var downTracked = dep.downstream_tracked === true;
        var nDown = Array.isArray(dep.downstream) ? dep.downstream.length : 0;
        var depDownHtml = downTracked
            ? nDown + ' <span class="text-sm font-normal text-slate-400">down</span>'
            : '<span class="text-base font-normal text-slate-400">downstream not tracked</span>';

        var depthTxt = (liq.total_2pct_depth != null) ? this.formatCurrency(liq.total_2pct_depth) : 'n/a';

        var cards = [
            {
                label: 'Peg',
                valueHtml: '<span class="' + pegCls + '">' + this.pegPctText(pegPct, 2) + ' ' + pegArrow + '</span>',
                sub: 'premium / discount',
                chip: this._ratingChipHtml(this.pegRating(data, history))
            },
            {
                label: 'Liquidity',
                valueHtml: depthTxt,
                sub: '2% depth · vol n/a',
                chip: this._ratingChipHtml(this.liquidityRating(data))
            },
            {
                label: 'Backing',
                valueHtml: this._backingValueHtml(data),
                sub: this._backingSubText(data),
                chip: this._ratingChipHtml(this.backingRating(data))
            },
            {
                label: 'Dependencies',
                valueHtml: nUp + ' <span class="text-sm font-normal text-slate-400">up</span> · ' + depDownHtml,
                sub: 'upstream / downstream',
                chip: '<a href="#section-dependencies" class="axis-rating r-na">View links →</a>'
            },
            {
                label: 'Issuer',
                valueHtml: this._issuerBadgeText(issuer),
                sub: 'editorial · subjective',
                chip: issuer.report_url
                    ? '<a href="' + issuer.report_url + '" target="_blank" rel="noopener noreferrer" class="axis-rating r-na">Report →</a>'
                    : ''
            }
        ];

        container.innerHTML = cards.map(function(c) {
            return '<div class="summary-card">' +
                '<div class="card-label">' + c.label + '</div>' +
                '<div class="card-value">' + c.valueHtml + '</div>' +
                (c.sub ? '<div class="text-xs text-slate-400 mt-1">' + c.sub + '</div>' : '') +
                (c.chip ? '<div class="mt-2">' + c.chip + '</div>' : '') +
            '</div>';
        }).join('');
        container.style.display = '';
    },

    _pegTrendArrow(data, history) {
        // Compare current |deviation| to the 7-day average; ▲ = widening (worse),
        // ▼ = tightening (better). Muted when no history.
        var avg = this._pegAvgAbsDev(data, history, 7);
        var cur = data.peg && data.peg.premium_discount_pct != null ? Math.abs(data.peg.premium_discount_pct) : null;
        if (avg == null || cur == null) return '';
        if (cur > avg * 1.05) return '<span class="text-red-500" title="widening vs 7d avg">▲</span>';
        if (cur < avg * 0.95) return '<span class="text-green-500" title="tightening vs 7d avg">▼</span>';
        return '<span class="text-slate-400" title="flat vs 7d avg">▶</span>';
    },

    _backingValueHtml(data) {
        var cr = (data.backing && data.backing.collateral_ratio != null)
            ? data.backing.collateral_ratio : (data.summary && data.summary.collateral_ratio);
        if (cr == null) return '—';
        var cls = cr >= 100 ? 'text-green-600' : 'text-red-600';
        return '<span class="' + cls + '">' + this.formatPercent(cr, 2) + '</span>';
    },

    _backingSubText(data) {
        var sd = (data.backing && data.backing.surplus_deficit != null)
            ? data.backing.surplus_deficit : (data.summary && data.summary.surplus_deficit);
        if (sd == null) return 'collateral ratio';
        return (sd >= 0 ? 'surplus +' : 'deficit −') + this.formatCurrency(Math.abs(sd));
    },

    _issuerBadgeText(issuer) {
        if (issuer.badge) return issuer.badge.replace(/^Issuer\s+/i, '');
        if (issuer.issuer_score != null) return issuer.issuer_score + '/10';
        return '—';
    },

    // --- section heads ---
    _renderAxisHead(name, num, title, sub, ratingHtml) {
        var el = document.getElementById('axis-' + name + '-head');
        if (!el) return;
        el.innerHTML =
            '<span class="axis-num">' + num + '</span>' +
            '<span class="axis-title">' + title + '</span>' +
            (sub ? '<span class="axis-sub">' + sub + '</span>' : '') +
            (ratingHtml || '');
    },

    // --- the four non-backing sections + backing head ---
    renderAxisSections(data, history) {
        var ids = ['section-peg', 'section-liquidity', 'section-dependencies', 'section-issuer'];
        if (!this.hasAxisBlocks(data)) {
            // Legacy asset: keep the 4 sections hidden and the backing head empty.
            ids.forEach(function(id) { var s = document.getElementById(id); if (s) s.classList.add('hidden'); });
            var bh = document.getElementById('axis-backing-head'); if (bh) bh.innerHTML = '';
            return false;
        }
        ids.forEach(function(id) { var s = document.getElementById(id); if (s) s.classList.remove('hidden'); });

        // 1 · Peg
        this._renderAxisHead('peg', 1, 'Peg',
            (data.peg.source ? 'market vs NAV · ' + data.peg.source : 'market vs NAV'),
            this._ratingChipHtml(this.pegRating(data, history)));
        this._renderPegSection(data, history);

        // 2 · Liquidity
        this._renderAxisHead('liquidity', 2, 'Liquidity', 'exit depth & venue spread',
            this._ratingChipHtml(this.liquidityRating(data)));
        this._renderLiquiditySection(data);

        // 3 · Backing (head only — panels are rendered by the existing common path)
        this._renderAxisHead('backing', 3, 'Backing', 'reserves & collateral ratio',
            this._ratingChipHtml(this.backingRating(data)));

        // 4 · Dependencies
        var dep = data.dependencies || {};
        var nUp = Array.isArray(dep.upstream) ? dep.upstream.length : 0;
        var downSub = (dep.downstream_tracked === true)
            ? (Array.isArray(dep.downstream) ? dep.downstream.length : 0) + ' downstream'
            : 'downstream not tracked';
        this._renderAxisHead('dependencies', 4, 'Dependencies', nUp + ' upstream · ' + downSub, '');
        this._renderDependenciesSection(data);

        // 5 · Issuer
        this._renderAxisHead('issuer', 5, 'Issuer', 'editorial — subjective axis', '');
        this._renderIssuerSection(data);
        return true;
    },

    _renderPegSection(data, history) {
        var body = document.getElementById('axis-peg-body');
        if (!body) return;
        var peg = data.peg || {};
        var pct = peg.premium_discount_pct;
        var st = this.pegStatusClass(pct);
        var pctCls = this.pegPctClass(st);
        var mkt = peg.market_price, nav = peg.nav;
        var fmtP = function(v) { return v != null ? v.toFixed(4) : '—'; };

        var metricRow =
            '<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">' +
                '<div><div class="text-xs text-slate-400 font-medium uppercase">Market price</div>' +
                    '<div class="text-lg font-bold font-mono">' + fmtP(mkt) + '</div></div>' +
                '<div><div class="text-xs text-slate-400 font-medium uppercase">NAV / theoretical</div>' +
                    '<div class="text-lg font-bold font-mono">' + fmtP(nav) + '</div></div>' +
                '<div><div class="text-xs text-slate-400 font-medium uppercase">Premium / discount</div>' +
                    '<div class="text-lg font-bold font-mono ' + pctCls + '">' + this.pegPctText(pct, 3) + '</div></div>' +
                '<div><div class="text-xs text-slate-400 font-medium uppercase">Status</div>' +
                    '<div class="text-lg font-bold ' + pctCls + '">' + this.pegStatusLabel(st) + '</div></div>' +
            '</div>';

        var hasHist = history && Array.isArray(history.entries) &&
            history.entries.some(function(e) { return e[peg.history_field] != null; });
        var chartBlock = hasHist
            ? '<div class="chart-container"><canvas id="peg-chart"></canvas></div>'
            : '<div class="text-sm text-slate-400">Peg history not tracked for this asset.</div>';

        body.innerHTML =
            '<div class="panel">' +
                '<div class="panel-title">Peg Performance</div>' +
                metricRow +
                chartBlock +
            '</div>';

        if (hasHist) this._renderPegChart(data, history);
    },

    _renderPegChart(data, history) {
        var ctx = document.getElementById('peg-chart');
        if (!ctx) return;
        var field = data.peg.history_field || 'peg_market_price';
        var nav = data.peg.nav != null ? data.peg.nav : 1.0;
        var entries = history.entries.filter(function(e) { return e[field] != null; });
        var labels = entries.map(function(e) { return new Date(e.timestamp.endsWith('Z') ? e.timestamp : e.timestamp + 'Z'); });
        var series = entries.map(function(e) { return e[field]; });

        if (window._pegChart) window._pegChart.destroy();
        window._pegChart = new Chart(ctx, {
            type: 'line',
            data: { labels: labels, datasets: [{
                label: 'Market price',
                data: series,
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.08)',
                fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2
            }] },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    x: { type: 'time', time: { unit: 'day', displayFormats: { day: 'MMM d' } },
                         grid: { display: false }, ticks: { maxTicksLimit: 8, font: { size: 11 } } },
                    y: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 11 },
                         callback: function(v) { return v.toFixed(3); } } }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: function(c) { return 'Price: ' + c.raw.toFixed(4); } } },
                    annotation: { annotations: {
                        par: { type: 'line', yMin: nav, yMax: nav, borderColor: '#94a3b8',
                               borderWidth: 1, borderDash: [4, 4],
                               label: { content: 'NAV ' + nav.toFixed(2), display: true, position: 'start',
                                        font: { size: 9 }, color: '#64748b' } }
                    } }
                },
                interaction: { intersect: false, mode: 'index' }
            }
        });
    },

    _renderLiquiditySection(data) {
        var body = document.getElementById('axis-liquidity-body');
        if (!body) return;
        var liq = data.liquidity || {};
        var em = liq.exit_mark || {};
        var quotes = em.quotes || {};

        // Headline exit mark = the KyberSwap RFQ ladder (As-built #2). Lead with it.
        var sizes = Object.keys(quotes).map(Number).filter(function(n) { return !isNaN(n); }).sort(function(a, b) { return a - b; });
        var ladderRows = sizes.map(function(sz) {
            var q = quotes['' + sz] || quotes[sz] || {};
            var bps = q.slippage_bps;
            var cls = bps == null ? '' : (bps <= 25 ? 'text-green-600' : (bps <= 200 ? 'text-amber-600' : 'text-red-600'));
            return '<tr>' +
                '<td class="font-mono">' + CommonRenderer.formatCurrency(sz) + '</td>' +
                '<td class="text-right font-mono ' + cls + '">' + (bps != null ? bps.toFixed(1) + ' bps' : '—') + '</td>' +
                '<td class="text-right font-mono">' + (q.output_usd != null ? CommonRenderer.formatCurrencyExact(q.output_usd) : '—') + '</td>' +
            '</tr>';
        }).join('');

        var ladderBlock = sizes.length
            ? '<div class="text-sm font-semibold text-slate-700 mb-2">Exit mark — ' +
                  (em.source || 'RFQ') + ' sell into ' + (em.sell_into || '—') + '</div>' +
              '<div class="data-table-scroll"><table class="data-table">' +
                  '<thead><tr><th>Size sold</th><th class="text-right">Slippage</th><th class="text-right">Net out</th></tr></thead>' +
                  '<tbody>' + ladderRows + '</tbody></table></div>'
            : '<div class="text-sm text-slate-400">No exit-mark RFQ ladder in this snapshot.</div>';

        var eff = liq.effective_max_under_25bps_usd;
        var statRow =
            '<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">' +
                '<div><div class="text-xs text-slate-400 font-medium uppercase">2% depth</div>' +
                    '<div class="text-lg font-bold">' + (liq.total_2pct_depth != null ? this.formatCurrency(liq.total_2pct_depth) : 'n/a') + '</div></div>' +
                '<div><div class="text-xs text-slate-400 font-medium uppercase">Max ≤25 bps</div>' +
                    '<div class="text-lg font-bold">' + (eff != null ? this.formatCurrency(eff) : 'n/a') + '</div></div>' +
                '<div><div class="text-xs text-slate-400 font-medium uppercase">Pool TVL</div>' +
                    '<div class="text-lg font-bold">' + (liq.total_tvl != null ? this.formatCurrency(liq.total_tvl) : 'n/a') + '</div></div>' +
                '<div><div class="text-xs text-slate-400 font-medium uppercase">24h volume</div>' +
                    '<div class="text-lg font-bold text-slate-400">n/a</div>' +
                    '<div class="text-[11px] text-slate-400">not tracked</div></div>' +
            '</div>';

        // Pool table (depth_usd; As-built #2 — no per-pool 2% depth / volume).
        var pools = liq.pools || [];
        var poolRows = pools.map(function(p) {
            var ratio = p.balance_ratio != null ? (p.balance_ratio * 100).toFixed(1) + '%' : '—';
            return '<tr>' +
                '<td class="font-medium">' + (p.venue || '—') + '<span class="text-xs text-slate-400 ml-1">' + (p.pair || '') + '</span></td>' +
                '<td class="text-xs text-slate-400">' + (p.chain || '') + '</td>' +
                '<td class="text-right font-mono">' + (p.depth_usd != null ? CommonRenderer.formatCurrencyExact(p.depth_usd) : '—') + '</td>' +
                '<td class="text-right font-mono">' + ratio + '</td>' +
            '</tr>';
        }).join('');
        var poolBlock = pools.length
            ? '<div class="text-sm font-semibold text-slate-700 mb-2 mt-6">Pools</div>' +
              '<div class="data-table-scroll"><table class="data-table">' +
                  '<thead><tr><th>Venue</th><th>Chain</th><th class="text-right">Depth (USD)</th><th class="text-right">Balance</th></tr></thead>' +
                  '<tbody>' + poolRows + '</tbody></table></div>'
            : '';

        body.innerHTML = '<div class="panel">' +
            '<div class="panel-title">Liquidity &amp; Exit</div>' +
            statRow + ladderBlock + poolBlock +
        '</div>';
    },

    _renderDependenciesSection(data) {
        var body = document.getElementById('axis-dependencies-body');
        if (!body) return;
        var dep = data.dependencies || {};
        var up = Array.isArray(dep.upstream) ? dep.upstream : [];
        var down = Array.isArray(dep.downstream) ? dep.downstream : [];

        function card(d) {
            var inner =
                '<div class="dep-card-name">' + (d.name || '—') + '</div>' +
                (d.metric ? '<div class="dep-card-metric">' + d.metric + '</div>' : '');
            if (d.link && d.link_type === 'internal') {
                return '<a href="' + d.link + '" class="dep-card">' + inner +
                    '<div class="dep-card-link">Open dashboard →</div></a>';
            }
            if (d.link && d.link_type === 'external') {
                return '<a href="' + d.link + '" target="_blank" rel="noopener noreferrer" class="dep-card">' + inner +
                    '<div class="dep-card-link">External ↗</div></a>';
            }
            return '<div class="dep-card">' + inner +
                '<div class="dep-card-link text-slate-400">No dashboard</div></div>';
        }

        var upBlock = up.length
            ? '<div class="dep-grid">' + up.map(card).join('') + '</div>'
            : '<div class="text-sm text-slate-400">No upstream dependencies tracked.</div>';

        // Downstream is a reserved stub until a consumer analyzer exists. An
        // absent/false `downstream_tracked` flag means "not tracked" (NOT "0") —
        // show the future-version placeholder. Once the analyzer flips the flag
        // true, real cards (or an honest empty state) render with no code change.
        var downBlock;
        if (dep.downstream_tracked === true) {
            downBlock = down.length
                ? '<div class="dep-grid">' + down.map(card).join('') + '</div>'
                : '<div class="text-sm text-slate-400">No downstream consumers currently tracked.</div>';
        } else {
            downBlock = '<div class="dep-card dep-stub">' +
                  '<div class="dep-card-name text-slate-500">Downstream not tracked</div>' +
                  '<div class="dep-card-metric">Consumer tracking (Morpho / Pendle / etc.) coming in a future version.</div>' +
              '</div>';
        }

        body.innerHTML = '<div class="panel">' +
            '<div class="panel-title">Dependencies</div>' +
            '<div class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Upstream — what this asset depends on</div>' +
            upBlock +
            '<div class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 mt-6">Downstream — what depends on this asset</div>' +
            downBlock +
        '</div>';
    },

    _renderIssuerSection(data) {
        var body = document.getElementById('axis-issuer-body');
        if (!body) return;
        var issuer = data.issuer || {};
        var badge = issuer.badge || (issuer.issuer_score != null ? 'Issuer ' + issuer.issuer_score + '/10' : null);
        var age = issuer.attestation_age_days;

        var chips =
            (badge ? '<span class="axis-rating r-warn">' + badge + '</span>' : '') +
            (age != null ? '<span class="axis-rating r-na" title="Last attestation age">Attested ' + age + 'd ago</span>' : '');

        var reportLink = issuer.report_url
            ? '<a href="' + issuer.report_url + '" target="_blank" rel="noopener noreferrer" ' +
                'class="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700">' +
                'Read the full risk report →</a>'
            : '<span class="text-sm text-slate-400">No report linked.</span>';

        body.innerHTML = '<div class="panel">' +
            '<div class="panel-title">Issuer</div>' +
            '<div class="flex flex-wrap items-center gap-2 mb-3">' + chips + '</div>' +
            '<p class="text-sm text-slate-500 mb-3">The issuer axis is an editorial, subjective rating — KYC, permissioning, governance and admin posture are assessed in the full report rather than scored live here.</p>' +
            reportLink +
        '</div>';
    }
};
