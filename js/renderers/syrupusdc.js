/**
 * syrupUSDC renderer — v2 layout (8 visible blocks).
 *
 * Render order:
 *   §1 Backing            — Pool TVL / cap / NAV / fee + asset composition + 2-slice donut
 *   §2 Loan Book Health   — 4 sub-blocks: A status · B buffer (NEW) · C collateral mix · D loan table
 *   §3 Borrower Concentration
 *   §4 Repayment Schedule (renamed from Payment Ladder)
 *   §5 Liquidity & Peg    — folds Exit Realism + Stress Anchor + new Peg deviation row
 *   §6 Trust Stack        — Governance + 1-line audit roll-up
 *   §7 Yield (demoted)
 *   Multi-Chain (hidden when only Ethereum)
 *
 * Suppresses the common-header Backing Breakdown table + Allocation pie panel for
 * syrupUSDC only — they're replaced by §1's asset-composition table + donut.
 * OUSD / crvUSD / USDD don't run this renderer, so they keep the common layout.
 */

// Static metadata for the Collateral Mix sub-block + loan-table column.
var SYRUP_COLLATERAL_META = {
    BTC:   { category: 'crypto',     issuer: '—',           color: '#f59e0b' },
    cbBTC: { category: 'crypto',     issuer: 'Coinbase',    color: '#f59e0b' },
    ETH:   { category: 'crypto',     issuer: '—',           color: '#6366f1' },
    XRP:   { category: 'crypto',     issuer: '—',           color: '#0ea5e9' },
    HYPE:  { category: 'crypto',     issuer: '—',           color: '#06b6d4' },
    USDC:  { category: 'stablecoin', issuer: 'Circle',      color: '#3b82f6' },
    USDT:  { category: 'stablecoin', issuer: 'Tether',      color: '#10b981' },
    PYUSD: { category: 'stablecoin', issuer: 'Paxos',       color: '#a855f7' },
    USTB:  { category: 'rwa',        issuer: 'Superstate',  color: '#ec4899' }
};

// Static facts for §6 audit roll-up — sourced from the public risk report.
var SYRUP_AUDIT_INFO = {
    primary_audits: 'Spearbit + Trail of Bits',
    other_audits_count: 6,
    total_audits: '8+',
    bug_bounty: 'Immunefi $1M+'
};

var SyrupUSDCRenderer = {

    // ----- helpers --------------------------------------------------------
    _freeLiquidityPct: function(s) {
        if (s.free_liquidity_pct !== null && s.free_liquidity_pct !== undefined) return s.free_liquidity_pct;
        if (s.deployment_ratio_pct !== null && s.deployment_ratio_pct !== undefined) return 100 - s.deployment_ratio_pct;
        return null;
    },

    _ethLink: function(addr) {
        if (!addr) return '';
        return '<a href="https://etherscan.io/address/' + addr + '" target="_blank" class="text-blue-500 hover:underline text-xs" title="' + addr + '">↗</a>';
    },

    _truncAddr: function(addr) {
        if (!addr) return '-';
        return addr.slice(0, 6) + '...' + addr.slice(-4);
    },

    _statusEmoji: function(status) {
        var s = (status || '').toLowerCase();
        if (s === 'healthy' || s === 'active') return '🟢';
        if (s === 'impaired') return '🟡';
        if (s === 'called') return '🟠';
        if (s === 'default' || s === 'defaulted') return '🔴';
        return '';
    },

    _statusFlagClass: function(status) {
        var s = (status || '').toLowerCase();
        if (s === 'healthy' || s === 'active') return 'text-green-600';
        if (s === 'impaired') return 'text-amber-600';
        if (s === 'called') return 'text-orange-600';
        if (s === 'default' || s === 'defaulted') return 'text-red-600';
        return '';
    },

    _suppressCommonPanels: function() {
        // §1 Backing absorbs the breakdown-table + allocation pie. Hide the
        // common-header panels and stretch the (now-orphan) Risk Flags wrapper
        // to span the full row width.
        var bd = document.getElementById('breakdown-table');
        if (bd) {
            var p = bd.closest('.panel');
            if (p) p.style.display = 'none';
        }
        var pie = document.getElementById('pie-chart');
        if (pie) {
            var p2 = pie.closest('.panel');
            if (p2) p2.style.display = 'none';
        }
        var risk = document.getElementById('risk-flags');
        if (risk) {
            var wrapper = risk.closest('.panel').parentElement;
            if (wrapper && !wrapper.classList.contains('lg:col-span-3')) {
                wrapper.classList.add('lg:col-span-3');
            }
        }
    },

    // ----- entry point ----------------------------------------------------
    render: function(data) {
        var container = document.getElementById('asset-specific-panels');
        var specific = data.asset_specific;
        if (!specific || specific.type !== 'syrupusdc') return;

        this._suppressCommonPanels();

        var s = data.summary;
        var html = '';

        html += this._renderBacking(specific, s);                   // §1
        html += this._renderLoanBookHealth(specific);               // §2
        html += this._renderBorrowerConcentration(specific);        // §3
        html += this._renderRepaymentSchedule(specific);            // §4
        html += this._renderLiquidityAndPeg(specific, s);           // §5
        html += this._renderTrustStack(specific);                   // §6
        html += this._renderYield(specific);                        // §7
        html += this._renderMultiChain(specific);                   // hidden when single-chain

        container.innerHTML = html;

        // Post-render canvases (after innerHTML so the DOM nodes exist).
        this._renderBackingDonut(specific);
        this._renderRepaymentScheduleChart(specific);
        this._renderAumCoverageChart(specific);
        this._attachLoanTableSort();
    },

    // ----- AUM-based coverage chart (replaces the common PCR chart) -------
    // PCR sits flat at 100% by ERC-4626 design (binary impairment alarm); the
    // live AUM-based coverage (collateralUsd / loansUsd × 100, Maple GraphQL)
    // is what actually moves day-to-day. Override the existing #cr-chart with
    // this series + a dashed deployment_pct overlay. Init-level commitment
    // stays visible as a caption since they're different metrics.
    _renderAumCoverageChart: function(specific) {
        var h = specific.aum_history;
        if (!h || !Array.isArray(h.entries) || h.entries.length < 2) return;
        var ctx = document.getElementById('cr-chart');
        if (!ctx || typeof Chart === 'undefined') return;
        var panel = document.getElementById('chart-panel');
        if (!panel) return;
        panel.style.display = '';  // unhide if common renderer suppressed it

        var entries = h.entries.slice().sort(function(a, b) { return a.timestamp - b.timestamp; });
        var labels = entries.map(function(e) { return new Date(e.timestamp * 1000); });
        var crSeries = entries.map(function(e) { return e.collateral_ratio_pct; });

        // Title + 30d stats
        var titleEl = panel.querySelector('.panel-title');
        if (titleEl) titleEl.textContent = 'Pool Coverage (live USD) — 30d';

        var statsEl = document.getElementById('cr-chart-stats');
        if (!statsEl) {
            statsEl = document.createElement('div');
            statsEl.id = 'cr-chart-stats';
            if (titleEl) titleEl.after(statsEl);
        }
        statsEl.className = 'flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mb-2';
        var crNonNull = crSeries.filter(function(v) { return v != null; });
        if (crNonNull.length > 0) {
            var minCR = Math.min.apply(null, crNonNull);
            var maxCR = Math.max.apply(null, crNonNull);
            var minCls = minCR < 110 ? 'text-red-600 font-semibold' : minCR < 130 ? 'text-amber-600 font-semibold' : '';
            // Caveat the min when it's anomalously low (< 100%) — that's the
            // Maple aumTimeSeries aggregation transient, not real undercollateralization.
            var minIdx = crSeries.indexOf(minCR);
            var minDateText = '';
            if (minIdx >= 0 && labels[minIdx]) {
                minDateText = labels[minIdx].toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
            }
            var minAnnotation = '';
            if (minCR < 100 && minDateText) {
                minAnnotation = ' <span class="text-xs text-slate-400 font-normal">on ' + minDateText + ' — likely Maple aggregation transient, not a real undercollateralization event</span>';
            }
            statsEl.innerHTML =
                '<span>30d Min: <span class="font-mono ' + minCls + '">' + minCR.toFixed(2) + '%</span>' + minAnnotation + '</span>' +
                '<span>30d Max: <span class="font-mono">' + maxCR.toFixed(2) + '%</span></span>' +
                '<span>Range: <span class="font-mono">' + (maxCR - minCR).toFixed(2) + 'pp</span></span>';
        } else {
            statsEl.innerHTML = '';
        }

        if (window._crChart) {
            try { window._crChart.destroy(); } catch (e) {}
        }

        window._crChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'AUM-based Coverage',
                    data: crSeries,
                    borderColor: '#22c55e',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 0,
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
                        suggestedMin: 95,
                        suggestedMax: 170,
                        ticks: { callback: function(v) { return v + '%'; }, font: { size: 11 } }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(c) { return c.dataset.label + ': ' + (c.raw != null ? c.raw.toFixed(2) + '%' : '—'); }
                        }
                    },
                    annotation: {
                        annotations: {
                            underwater: { type: 'box', yMin: 0,   yMax: 100, backgroundColor: 'rgba(220, 38, 38, 0.10)', borderWidth: 0, label: { content: 'Underwater', display: true, position: 'start', font: { size: 9 }, color: '#dc2626' } },
                            thin:       { type: 'box', yMin: 100, yMax: 110, backgroundColor: 'rgba(239, 68, 68, 0.06)', borderWidth: 0 },
                            amber:      { type: 'box', yMin: 110, yMax: 130, backgroundColor: 'rgba(245, 158, 11, 0.06)', borderWidth: 0 },
                            healthy:    { type: 'box', yMin: 130, yMax: 160, backgroundColor: 'rgba(22, 163, 74, 0.05)', borderWidth: 0 },
                            cushion:    { type: 'box', yMin: 160, yMax: 220, backgroundColor: 'rgba(14, 165, 233, 0.05)', borderWidth: 0 },
                            line110:    { type: 'line', yMin: 110, yMax: 110, borderColor: '#dc2626', borderWidth: 1, borderDash: [4, 4], label: { content: '110%', display: true, position: 'end', font: { size: 9 }, color: '#dc2626' } },
                            line130:    { type: 'line', yMin: 130, yMax: 130, borderColor: '#16a34a', borderWidth: 1, borderDash: [4, 4], label: { content: '130%', display: true, position: 'end', font: { size: 9 }, color: '#16a34a' } }
                        }
                    }
                },
                interaction: { intersect: false, mode: 'index' }
            }
        });

        // Subtitle + init-level commitment caption below the chart.
        var caption = panel.querySelector('.cr-source-subtitle');
        if (!caption) {
            caption = document.createElement('div');
            caption.className = 'cr-source-subtitle text-xs text-slate-400 mt-2';
            panel.appendChild(caption);
        }
        var poolCR = ((specific.loan_book || {}).collateral_summary || {}).pool_collateral_ratio_pct;
        var asOfText = '';
        if (h.as_of) {
            var d = new Date(h.as_of * 1000);
            if (!isNaN(d.getTime())) asOfText = ' · as of ' + d.toISOString().slice(0, 10);
        }
        var sourceLine = 'Source: <span class="font-mono">poolV2.aumTimeSeries</span> (Maple GraphQL) · collateralUsd ÷ loansUsd' + asOfText + '.';
        var initLine = (poolCR != null) ?
            ('<br>Init-level commitment: <span class="font-mono font-semibold text-slate-600">' + poolCR.toFixed(1) + '%</span> ' +
             '(from <span class="font-mono">poolV2.collateralRatio</span>) — the chart above shows live AUM-based coverage, which can sit below init-level when collateral prices drift.') : '';
        // Data-quality footnote — Maple's aumTimeSeries aggregates the at-par
        // stablecoin/RWA positions inconsistently across days (same root cause
        // as the per-loan currentAssetAmount anomaly). Include a check on
        // unrealizedLosses so the credit-alarm framing only fires when it's 0.
        var ul = (specific.vault_state || {}).unrealized_losses;
        var ulFragment = (ul === 0 || ul == null) ?
            ' <span class="font-mono">unrealizedLosses</span> (the on-chain credit alarm) stayed at 0 throughout the displayed window.' :
            '';
        var noteLine = '<div class="mt-2 pt-2 border-t border-slate-100 text-xs text-slate-400 leading-relaxed">' +
            '<strong class="text-slate-500">Note:</strong> Maple\'s <span class="font-mono">aumTimeSeries</span> has documented aggregation inconsistencies (correlated with the per-loan <span class="font-mono">currentAssetAmount</span> anomaly affecting at-par stablecoin/RWA positions). Day-to-day swings &gt;10pp may reflect data-quality variance rather than real composition shifts.' + ulFragment +
        '</div>';
        caption.innerHTML = sourceLine + initLine + noteLine;

        // Second stacked chart in the same panel — deployment ratio.
        this._renderDeploymentChart(panel, labels, entries);
    },

    // ----- Deployment ratio chart (stacked below AUM coverage) ------------
    _renderDeploymentChart: function(panel, labels, entries) {
        if (typeof Chart === 'undefined') return;
        var deplSeries = entries.map(function(e) { return e.deployment_pct; });

        // Build / find the deployment chart subsection — title, stats,
        // canvas, caption. Reuse on re-renders so we don't duplicate.
        var deplTitle = panel.querySelector('.syrup-depl-title');
        if (!deplTitle) {
            deplTitle = document.createElement('div');
            deplTitle.className = 'syrup-depl-title panel-title mt-6 pt-4 border-t border-slate-200';
            deplTitle.textContent = 'Pool Deployment Ratio — 30d';
            panel.appendChild(deplTitle);
        }

        var deplStats = panel.querySelector('#syrup-depl-stats');
        if (!deplStats) {
            deplStats = document.createElement('div');
            deplStats.id = 'syrup-depl-stats';
            deplStats.className = 'flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mb-2';
            panel.appendChild(deplStats);
        }
        var deplNonNull = deplSeries.filter(function(v) { return v != null; });
        if (deplNonNull.length > 0) {
            var minD = Math.min.apply(null, deplNonNull);
            var maxD = Math.max.apply(null, deplNonNull);
            var lastD = deplNonNull[deplNonNull.length - 1];
            var lastCls = lastD >= 95 ? 'text-red-600 font-semibold' :
                          lastD >= 80 ? 'text-amber-600 font-semibold' :
                          lastD < 50 ? 'text-green-600' : '';
            deplStats.innerHTML =
                '<span>30d Min: <span class="font-mono">' + minD.toFixed(2) + '%</span></span>' +
                '<span>30d Max: <span class="font-mono">' + maxD.toFixed(2) + '%</span></span>' +
                '<span>Latest: <span class="font-mono ' + lastCls + '">' + lastD.toFixed(2) + '%</span></span>' +
                '<span>Free buffer: <span class="font-mono">' + (100 - lastD).toFixed(2) + '%</span></span>';
        } else {
            deplStats.innerHTML = '';
        }

        var deplContainer = panel.querySelector('.syrup-depl-container');
        if (!deplContainer) {
            deplContainer = document.createElement('div');
            deplContainer.className = 'chart-container syrup-depl-container';
            var deplCanvas = document.createElement('canvas');
            deplCanvas.id = 'syrup-depl-chart';
            deplContainer.appendChild(deplCanvas);
            panel.appendChild(deplContainer);
        }

        var deplCaption = panel.querySelector('.syrup-depl-caption');
        if (!deplCaption) {
            deplCaption = document.createElement('div');
            deplCaption.className = 'syrup-depl-caption text-xs text-slate-400 mt-2';
            deplCaption.innerHTML = 'Share of pool deployed into loans + DeFi strategies. Higher = less free USDC buffer for redemptions. <span class="font-mono">&lt;2%</span> buffer triggers a risk flag on this page.';
            panel.appendChild(deplCaption);
        }

        var ctx = document.getElementById('syrup-depl-chart');
        if (!ctx) return;
        if (window._syrupDeplChart) {
            try { window._syrupDeplChart.destroy(); } catch (e) {}
        }

        window._syrupDeplChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Deployment',
                    data: deplSeries,
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 0,
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
                        suggestedMin: 50,
                        suggestedMax: 100,
                        ticks: { callback: function(v) { return v + '%'; }, font: { size: 11 } }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(c) { return 'Deployment: ' + (c.raw != null ? c.raw.toFixed(2) + '%' : '—'); }
                        }
                    },
                    annotation: {
                        annotations: {
                            green:    { type: 'box', yMin: 0,  yMax: 50,  backgroundColor: 'rgba(22, 163, 74, 0.05)', borderWidth: 0 },
                            amber:    { type: 'box', yMin: 50, yMax: 80,  backgroundColor: 'rgba(245, 158, 11, 0.05)', borderWidth: 0 },
                            redAmber: { type: 'box', yMin: 80, yMax: 95,  backgroundColor: 'rgba(239, 68, 68, 0.07)', borderWidth: 0 },
                            red:      { type: 'box', yMin: 95, yMax: 100, backgroundColor: 'rgba(220, 38, 38, 0.12)', borderWidth: 0, label: { content: 'Fully deployed', display: true, position: 'start', font: { size: 9 }, color: '#dc2626' } },
                            line80:   { type: 'line', yMin: 80, yMax: 80, borderColor: '#d97706', borderWidth: 1, borderDash: [4, 4], label: { content: '80%', display: true, position: 'end', font: { size: 9 }, color: '#d97706' } },
                            line95:   { type: 'line', yMin: 95, yMax: 95, borderColor: '#dc2626', borderWidth: 1, borderDash: [4, 4], label: { content: '95%', display: true, position: 'end', font: { size: 9 }, color: '#dc2626' } }
                        }
                    }
                },
                interaction: { intersect: false, mode: 'index' }
            }
        });
    },

    // ----- §1 Backing -----------------------------------------------------
    _renderBacking: function(specific, s) {
        var v = specific.vault_state || {};
        var totalAssets = v.total_assets;
        var liquidityCap = v.liquidity_cap;
        var capUtilPct = v.cap_utilization_pct;
        if ((capUtilPct === null || capUtilPct === undefined) && totalAssets && liquidityCap) {
            capUtilPct = totalAssets / liquidityCap * 100;
        }
        var nav = v.nav;
        var fee = (s && s.delegate_management_fee_pct != null) ? s.delegate_management_fee_pct :
                   (specific.yield && specific.yield.delegate_fee_pct);

        // Asset composition rows.
        var freeUsdc = (v.free_usdc !== null && v.free_usdc !== undefined) ?
            v.free_usdc :
            (s && s.collateral_ratio_alt && s.collateral_ratio_alt.is_currency ? s.collateral_ratio_alt.value : 0);
        var strategies = v.strategies || [];
        var rows = [{
            label: 'Free USDC',
            value: freeUsdc,
            tag: 'liquid',
            color: '#22c55e'
        }];
        if (strategies.length === 0) {
            // Fall back to backing_breakdown if vault_state.strategies is empty
            // (older analyzer JSON).
            rows.push({
                label: 'Strategy AUM (deployed)',
                value: (v.strategy_aum != null) ? v.strategy_aum : ((totalAssets || 0) - (freeUsdc || 0)),
                tag: 'deployed',
                color: '#6366f1'
            });
        } else {
            strategies.forEach(function(st, i) {
                if ((st.aum_usd || 0) <= 0 && i > 0 && !st.is_loan_manager) return;  // collapse zero non-LM strategies
                var label = st.is_loan_manager ?
                    'Strategy ' + i + ' (Loan Manager)' :
                    'Strategy ' + i;
                rows.push({
                    label: label,
                    value: st.aum_usd || 0,
                    tag: st.is_loan_manager ? 'deployed' : 'idle',
                    color: st.is_loan_manager ? '#6366f1' : '#94a3b8',
                    address: st.address
                });
            });
        }

        var total = (totalAssets || rows.reduce(function(a, r) { return a + (r.value || 0); }, 0)) || 1;

        var compRows = rows.map(function(r) {
            var pct = (r.value || 0) / total * 100;
            return '<tr>' +
                '<td class="font-medium">' + r.label +
                    (r.address ? ' ' + SyrupUSDCRenderer._ethLink(r.address) : '') +
                '</td>' +
                '<td class="text-right font-mono">' + CommonRenderer.formatCurrencyExact(r.value || 0) + '</td>' +
                '<td class="text-right font-mono">' + CommonRenderer.formatPercent(pct, 1) + '</td>' +
                '<td><div class="pct-bar-container"><div class="pct-bar" style="width:' + Math.min(pct, 100) + '%; background:' + r.color + '"></div></div></td>' +
            '</tr>';
        }).join('');
        compRows += '<tr class="font-bold border-t-2 border-slate-200">' +
            '<td>Total</td>' +
            '<td class="text-right font-mono">' + CommonRenderer.formatCurrencyExact(total) + '</td>' +
            '<td class="text-right">100%</td>' +
            '<td></td>' +
        '</tr>';

        var pausedBadge = v.protocol_paused ?
            '<div class="risk-flag risk-critical mt-3"><strong>PROTOCOL PAUSED</strong> — deposits/withdrawals blocked at MapleGlobals</div>' : '';
        var ulBadge = (v.unrealized_losses && v.unrealized_losses > 0) ?
            '<div class="risk-flag risk-critical mt-3"><strong>Unrealized losses:</strong> ' + CommonRenderer.formatCurrencyExact(v.unrealized_losses) + ' — PCR_principal below 100%</div>' : '';

        // Header KPI row — 4 stats split into two visual columns.
        var kpiHeader =
            '<div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">' +
                '<div class="grid grid-cols-2 gap-3">' +
                    '<div class="summary-card"><div class="card-label">Pool TVL</div><div class="card-value">' + CommonRenderer.formatCurrency(totalAssets) + '</div></div>' +
                    '<div class="summary-card"><div class="card-label">Liquidity Cap</div><div class="card-value">' + CommonRenderer.formatCurrency(liquidityCap) + '</div>' +
                        (capUtilPct != null ? '<div class="text-xs text-slate-400 mt-1">' + CommonRenderer.formatPercent(capUtilPct, 1) + ' used</div>' : '') +
                    '</div>' +
                '</div>' +
                '<div class="grid grid-cols-2 gap-3">' +
                    '<div class="summary-card"><div class="card-label">NAV per share</div><div class="card-value">' + (nav != null ? '$' + nav.toFixed(4) : '-') + '</div><div class="text-xs text-slate-400 mt-1">USDC per share</div></div>' +
                    '<div class="summary-card"><div class="card-label">Delegate fee</div><div class="card-value">' + (fee != null ? CommonRenderer.formatPercent(fee, 2) : '-') + '</div><div class="text-xs text-slate-400 mt-1">taken from gross</div></div>' +
                '</div>' +
            '</div>';

        return '<div class="panel">' +
            '<div class="panel-title">Backing</div>' +
            kpiHeader +
            '<div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-2">' +
                '<div class="lg:col-span-2">' +
                    '<div class="text-sm font-semibold text-slate-700 mb-2">Asset composition</div>' +
                    '<table class="data-table"><thead><tr>' +
                        '<th>Source</th>' +
                        '<th class="text-right">Value (USD)</th>' +
                        '<th class="text-right">%</th>' +
                        '<th style="width: 120px"></th>' +
                    '</tr></thead><tbody>' + compRows + '</tbody></table>' +
                '</div>' +
                '<div>' +
                    '<div class="text-sm font-semibold text-slate-700 mb-2">Allocation</div>' +
                    '<div style="height: 220px; position: relative;"><canvas id="syrup-backing-donut"></canvas></div>' +
                '</div>' +
            '</div>' +
            ulBadge +
            pausedBadge +
        '</div>';
    },

    _renderBackingDonut: function(specific) {
        var ctx = document.getElementById('syrup-backing-donut');
        if (!ctx || typeof Chart === 'undefined') return;
        var v = specific.vault_state || {};
        var freeUsdc = v.free_usdc || 0;
        var deployed = (v.strategy_aum != null) ? v.strategy_aum :
            ((v.total_assets || 0) - freeUsdc);

        if (window._syrupBackingDonut) window._syrupBackingDonut.destroy();
        window._syrupBackingDonut = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Free USDC', 'Deployed (loans + strategies)'],
                datasets: [{
                    data: [freeUsdc, deployed],
                    backgroundColor: ['#22c55e', '#6366f1'],
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
                            label: function(c) {
                                var total = c.dataset.data.reduce(function(a, b) { return a + b; }, 0);
                                var pct = total > 0 ? (c.raw / total * 100).toFixed(1) : '0.0';
                                return c.label + ': ' + CommonRenderer.formatCurrency(c.raw) + ' (' + pct + '%)';
                            }
                        }
                    }
                }
            }
        });
    },

    // ----- §2 Loan Book Health (4 sub-blocks) -----------------------------
    _renderLoanBookHealth: function(specific) {
        var lb = specific.loan_book;
        if (!lb) return '';

        var disclaimer = '<div class="risk-flag risk-warning"><strong>Important:</strong> These are uncollateralized-on-chain open-term loans. Collateral is held off-chain by the Pool Delegate. On-chain enforcement = noticePeriod (24h) + gracePeriod (48h) → 72h max default lag.</div>';

        if (lb.active_loan_count === null || lb.active_loan_count === undefined) {
            return '<div class="panel">' +
                '<div class="panel-title">Loan Book Health</div>' +
                disclaimer +
                '<div class="text-slate-400 text-sm mt-3 italic">Loan-level data pending — per-loan enumeration ships in Phase 2.</div>' +
            '</div>';
        }

        return '<div class="panel">' +
            '<div class="panel-title">Loan Book Health</div>' +
            disclaimer +
            this._renderLBH_status(specific, lb) +
            this._renderLBH_buffer(lb) +
            this._renderLBH_collateralMix(lb) +
            this._renderLBH_loanTable(lb) +
        '</div>';
    },

    // §2 sub-block A — Status snapshot
    _renderLBH_status: function(specific, lb) {
        var imp = lb.impaired_count || 0;
        var cal = lb.called_count || 0;
        var def = lb.default_count || 0;
        var healthy = (lb.healthy_count !== null && lb.healthy_count !== undefined) ?
            lb.healthy_count : Math.max(0, (lb.active_loan_count || 0) - imp - cal - def);

        var poolCR = lb.collateral_summary && lb.collateral_summary.pool_collateral_ratio_pct;
        var rateText = (lb.weighted_avg_rate_pct != null) ? CommonRenderer.formatPercent(lb.weighted_avg_rate_pct, 2) : '—';
        var poolCRText = (poolCR != null) ? CommonRenderer.formatPercent(poolCR, 1) : '—';

        function statusPill(label, count, cls) {
            var color = count > 0 ? cls : 'text-slate-400';
            return '<span class="' + color + '"><strong>' + label + '</strong> ' + count + '</span>';
        }

        return '<div class="mt-4 mb-4">' +
            '<div class="text-sm text-slate-700 mb-1">' +
                '<span class="font-semibold">' + (lb.active_loan_count || 0) + ' loans</span> · ' +
                '<span class="font-semibold">' + (lb.borrower_count || 0) + ' borrowers</span> · ' +
                '<span class="font-mono">' + rateText + '</span> wtd-rate · ' +
                'pool CR <span class="font-mono">' + poolCRText + '</span>' +
            '</div>' +
            '<div class="text-sm text-slate-600 flex flex-wrap gap-x-4 gap-y-1">' +
                statusPill('Healthy', healthy, 'text-green-600') +
                '<span class="text-slate-300">·</span>' +
                statusPill('Impaired', imp, 'text-amber-600') +
                '<span class="text-slate-300">·</span>' +
                statusPill('Called', cal, 'text-orange-600') +
                '<span class="text-slate-300">·</span>' +
                statusPill('Default', def, 'text-red-600') +
            '</div>' +
        '</div>';
    },

    // §2 sub-block B — Buffer health (NEW). Reads PegTracker companion fields.
    // Graceful-degrades to a placeholder when those fields aren't shipped yet.
    _renderLBH_buffer: function(lb) {
        var cs = lb.collateral_summary;
        if (!cs) return '';  // Collateral Mix sub-block handles the unavailable case below.

        var hasBuffer = cs.loans_below_init_count != null &&
                        cs.weighted_avg_buffer_pp != null &&
                        cs.tightest_loan;

        if (!hasBuffer) {
            return '<div class="mb-4 p-3 rounded-lg" style="background:#f8fafc;border:1px solid #e2e8f0">' +
                '<div class="text-sm font-semibold text-slate-700 mb-1">Buffer health</div>' +
                '<div class="text-xs text-slate-400 italic">Buffer-health metrics pending pipeline update.</div>' +
            '</div>';
        }

        var totalActive = lb.active_loan_count || 0;
        var below = cs.loans_below_init_count || 0;
        var above = Math.max(0, totalActive - below);
        var totalPrincipal = (cs.set_a_overcollateralized && cs.set_a_overcollateralized.principal_usd || 0) +
                             (cs.set_b_at_par && cs.set_b_at_par.principal_usd || 0);
        if (totalPrincipal === 0 && lb.loans) {
            totalPrincipal = lb.loans.reduce(function(s, l) { return s + (l.principal || 0); }, 0);
        }
        var belowUsd = cs.principal_below_init_usd || 0;
        var aboveUsd = Math.max(0, totalPrincipal - belowUsd);
        var belowPct = totalPrincipal > 0 ? (belowUsd / totalPrincipal * 100) : 0;
        var abovePct = totalPrincipal > 0 ? (aboveUsd / totalPrincipal * 100) : 0;
        var wab = cs.weighted_avg_buffer_pp;
        var wabSign = wab >= 0 ? '+' : '';
        var wabCls = wab >= 5 ? 'text-green-600' : wab >= 0 ? 'text-amber-600' : 'text-red-600';

        var t = cs.tightest_loan;
        var tSign = t.buffer_pp >= 0 ? '+' : '';
        var pap = (t.points_above_par != null) ? t.points_above_par.toFixed(1) :
            (t.current_level_pct != null ? (t.current_level_pct - 100).toFixed(1) : '?');
        var papCls = t.points_above_par <= 5 ? 'text-amber-600 font-semibold' :
                     t.points_above_par <= 0 ? 'text-red-600 font-semibold' : 'text-slate-700';

        return '<div class="mb-4 p-3 rounded-lg" style="background:#f8fafc;border:1px solid #e2e8f0">' +
            '<div class="text-sm font-semibold text-slate-700 mb-2">Buffer health</div>' +
            '<div class="text-sm text-slate-700 mb-1">' +
                'Above init level: <strong>' + above + ' loan' + (above === 1 ? '' : 's') + '</strong> · ' +
                CommonRenderer.formatCurrency(aboveUsd) + ' (' + CommonRenderer.formatPercent(abovePct, 1) + ')' +
            '</div>' +
            (below > 0 ?
                '<div class="text-sm text-amber-700 mb-1">' +
                    '⚠ Below init level: <strong>' + below + ' loan' + (below === 1 ? '' : 's') + '</strong> · ' +
                    CommonRenderer.formatCurrency(belowUsd) + ' (' + CommonRenderer.formatPercent(belowPct, 1) + ')' +
                    '<div class="text-xs text-amber-600 mt-1 ml-4">Delegate has discretion to call but has not — these are out of compliance with funding-time collateral terms.</div>' +
                '</div>' :
                '<div class="text-xs text-green-600 mb-1">All active loans above their funding-time required collateral level.</div>') +
            '<div class="text-sm mt-2">' +
                'Wtd-avg buffer: <span class="font-mono font-semibold ' + wabCls + '">' + wabSign + wab.toFixed(1) + 'pp</span>' +
            '</div>' +
            '<div class="text-sm mt-1">' +
                'Tightest loan: <span class="font-mono">' + CommonRenderer.formatCurrency(t.principal_usd) + ' ' + t.asset + '</span> @ ' +
                CommonRenderer.formatPercent(t.current_level_pct, 1) +
                ' (init ' + CommonRenderer.formatPercent(t.init_level_pct, 0) + ', ' + tSign + t.buffer_pp.toFixed(1) + 'pp)' +
                ' — only <span class="' + papCls + '">' + pap + 'pp above par</span>' +
            '</div>' +
        '</div>';
    },

    // §2 sub-block C — Collateral mix (folded in from old _renderCollateralMix)
    _renderLBH_collateralMix: function(lb) {
        var cs = lb.collateral_summary;
        if (!cs) return '';

        if (cs.data_source === 'unavailable') {
            return '<div class="risk-flag risk-info mb-4">Collateral data temporarily unavailable from Maple API. Loan-level credit and timing fields above are unaffected.</div>';
        }

        var setA = cs.set_a_overcollateralized || {};
        var setB = cs.set_b_at_par || {};
        var byAsset = cs.by_asset || [];
        if (byAsset.length === 0 && (setA.principal_usd || 0) === 0 && (setB.principal_usd || 0) === 0) return '';

        var poolLine = '';
        if (cs.pool_collateral_value_usd != null && cs.pool_collateral_ratio_pct != null) {
            poolLine = '<div class="text-xs text-slate-500 mb-2">Pool collateralization: <span class="font-mono font-semibold">' + CommonRenderer.formatPercent(cs.pool_collateral_ratio_pct, 1) + '</span> · <span class="font-mono">' + CommonRenderer.formatCurrency(cs.pool_collateral_value_usd) + '</span> collateral against active loan book <span class="text-slate-400">(Maple GraphQL)</span></div>';
        }

        function bar(row, color) {
            var pct = row.pct_of_book || 0;
            var meta = SYRUP_COLLATERAL_META[row.asset] || {};
            var issuerTag = meta.issuer && meta.issuer !== '—' ?
                ' <span class="text-xs text-slate-500">' + meta.issuer + '</span>' : '';
            var levelRange;
            if (row.init_level_pct_min === row.init_level_pct_max) {
                levelRange = CommonRenderer.formatPercent(row.init_level_pct_min, 0);
            } else {
                levelRange = CommonRenderer.formatPercent(row.init_level_pct_min, 0) + '–' + CommonRenderer.formatPercent(row.init_level_pct_max, 0);
            }
            return '<div class="mb-2">' +
                '<div class="flex justify-between text-sm mb-1">' +
                    '<span class="text-slate-700"><span class="font-mono font-semibold">' + row.asset + '</span>' + issuerTag + ' <span class="text-xs text-slate-400">' + (row.loans || 0) + ' loan' + (row.loans === 1 ? '' : 's') + ' · init ' + levelRange + '</span></span>' +
                    '<span class="font-mono font-semibold">' + CommonRenderer.formatPercent(pct, 1) + ' · ' + CommonRenderer.formatCurrency(row.principal_usd) + '</span>' +
                '</div>' +
                '<div class="pct-bar-container"><div class="pct-bar" style="width:' + Math.min(pct, 100) + '%; background:' + color + '"></div></div>' +
            '</div>';
        }

        var setARows = byAsset.filter(function(r) { return (r.init_level_pct_max || 0) > 105; });
        var setBRows = byAsset.filter(function(r) { return (r.init_level_pct_max || 0) <= 105; });

        var setAHtml = '<div>' +
            '<div class="text-sm font-semibold text-slate-700 mb-2">' +
                'Set A — crypto-overcollateralized · ' + CommonRenderer.formatPercent(setA.pct_of_book || 0, 1) +
                ' <span class="text-xs text-slate-500 font-normal">' + CommonRenderer.formatCurrency(setA.principal_usd || 0) +
                (setA.weighted_avg_init_level_pct ? ' · wtd-init ' + CommonRenderer.formatPercent(setA.weighted_avg_init_level_pct, 1) : '') +
                '</span>' +
            '</div>' +
            (setARows.length ? setARows.map(function(r) { return bar(r, '#22c55e'); }).join('') :
                '<div class="text-xs text-slate-400 italic">No over-collateralized loans in current book.</div>') +
        '</div>';

        var setBWarning = '';
        if (setB.principal_usd > 0) {
            var totalPrincipal = (setA.principal_usd || 0) + (setB.principal_usd || 0);
            var largestPctOfBook = totalPrincipal > 0 ? (setB.largest_position_usd / totalPrincipal * 100) : 0;
            setBWarning =
                '<div class="risk-flag risk-warning mt-3"><strong>At-par binding risk:</strong> Set B stress binds on collateral-asset peg/issuer events, NOT crypto-cycle drawdowns.' +
                (setB.largest_position_usd ?
                    ' <span class="font-mono">' + (setB.largest_position_asset || '?') + '</span> depeg → largest single position (<span class="font-mono">' + CommonRenderer.formatCurrency(setB.largest_position_usd) + '</span>, ' + CommonRenderer.formatPercent(largestPctOfBook, 1) + ' of book) underwater.' : '') +
                '</div>';
        }
        var issuerLine = setB.named_issuers && setB.named_issuers.length ?
            '<div class="text-xs text-slate-500 mt-2">Named issuers: ' + setB.named_issuers.join(' · ') + '</div>' : '';

        var setBHtml = '<div>' +
            '<div class="text-sm font-semibold text-slate-700 mb-2">' +
                'Set B — at-par stablecoin / RWA ⚠ · ' + CommonRenderer.formatPercent(setB.pct_of_book || 0, 1) +
                ' <span class="text-xs text-slate-500 font-normal">' + CommonRenderer.formatCurrency(setB.principal_usd || 0) + '</span>' +
            '</div>' +
            (setBRows.length ? setBRows.map(function(r) { return bar(r, '#f59e0b'); }).join('') :
                '<div class="text-xs text-slate-400 italic">No at-par loans in current book.</div>') +
            issuerLine +
        '</div>';

        return '<div class="mb-4">' +
            '<div class="text-sm font-semibold text-slate-700 mb-2">Collateral mix</div>' +
            poolLine +
            '<div class="grid grid-cols-1 md:grid-cols-2 gap-6">' + setAHtml + setBHtml + '</div>' +
            setBWarning +
        '</div>';
    },

    // §2 sub-block D — Loan-level table (9 columns including new Buffer)
    _renderLBH_loanTable: function(lb) {
        var loans = lb.loans || [];
        if (loans.length === 0) return '';

        var summary = lb.collateral_summary;
        var hasCollateral = !!(summary && summary.data_source && summary.data_source !== 'unavailable')
            || loans.some(function(l) { return l && l.collateral; });
        var loansSorted = loans.slice().sort(function(a, b) { return (b.principal || 0) - (a.principal || 0); }).slice(0, 10);
        var rows = loansSorted.map(function(l) { return SyrupUSDCRenderer._renderLoanRow(l, hasCollateral); }).join('');

        var collateralHeaders = hasCollateral ?
            ('<th class="cursor-pointer" data-sort="collat">Collateral</th>' +
             '<th class="text-right cursor-pointer" data-sort="init">Init</th>' +
             '<th class="text-right cursor-pointer" data-sort="cur">Cur</th>' +
             '<th class="text-right cursor-pointer" data-sort="buf">Buf</th>') : '';

        return '<div class="text-sm font-semibold text-slate-700 mb-2 mt-2">Top loans (sortable)</div>' +
            '<div class="overflow-x-auto"><table class="data-table" id="syrup-loans-table"><thead><tr>' +
                '<th class="cursor-pointer" data-sort="borrower">Borrower</th>' +
                '<th class="text-right cursor-pointer" data-sort="principal">Princ. ▾</th>' +
                '<th class="text-right cursor-pointer" data-sort="rate">Rate</th>' +
                '<th class="text-right cursor-pointer" data-sort="days">Days</th>' +
                '<th class="cursor-pointer" data-sort="status">S</th>' +
                collateralHeaders +
            '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    },

    _renderLoanRow: function(loan, hasCollateral) {
        var addr = loan.borrower || '';
        var firmTag = loan.firm ? '<span class="text-xs text-slate-500 ml-1">' + loan.firm + '</span>' : '';
        var borrowerCell = '<span class="font-mono text-xs" title="' + addr + '">' + SyrupUSDCRenderer._truncAddr(addr) + '</span>' +
            ' ' + SyrupUSDCRenderer._ethLink(addr) + firmTag;

        var days = null;
        if (loan.payment_due_date) {
            var due = typeof loan.payment_due_date === 'number' ?
                new Date(loan.payment_due_date * 1000) :
                new Date(loan.payment_due_date.endsWith && loan.payment_due_date.endsWith('Z') ? loan.payment_due_date : loan.payment_due_date + 'Z');
            if (!isNaN(due.getTime())) {
                days = Math.floor((due.getTime() - Date.now()) / 86400000);
            }
        }
        var daysText, daysCls = '';
        if (days === null) {
            daysText = '—';
        } else if (days < 0) {
            // Convert to overdue hours (rough; abs days back to hours)
            var overdueHours = Math.round(-days * 24);
            daysText = 'Overdue ' + (overdueHours >= 24 ? Math.round(-days) + 'd' : overdueHours + 'h');
            daysCls = 'text-red-600 font-semibold';
        } else {
            daysText = days + 'd';
            if (days < 7) daysCls = 'text-red-600 font-semibold';
            else if (days < 30) daysCls = 'text-amber-600';
        }

        var status = loan.status || '';
        var statusCell = SyrupUSDCRenderer._statusEmoji(status);

        var sortAttrs = {
            principal: loan.principal || 0,
            rate: loan.rate_pct || 0,
            days: days === null ? '' : days,
            status: status,
            borrower: addr
        };

        var collateralCells = '';
        if (hasCollateral) {
            var c = loan.collateral || {};
            var asset = c.asset || null;
            var collatUsd = c.usd;
            var isAnomaly = c.usd_source === 'data_anomaly';
            // Distinguish data_anomaly cells (Maple GraphQL returns broken
            // currentAssetAmount) from genuinely-unavailable: same — but with
            // a ? glyph + tooltip so readers know it's a data-quality issue,
            // not a missing oracle.
            var anomalyAttrs = isAnomaly ?
                ' title="Maple GraphQL data anomaly — collateral state unverifiable" class="cursor-help"' : '';
            var anomalyGlyph = isAnomaly ?
                ' <span class="text-amber-500 text-xs"' + anomalyAttrs + '>?</span>' : '';

            // Single combined "Collateral" cell — "PYUSD $152.7M" or "USTB — ?"
            var collatCellText;
            if (!asset) {
                collatCellText = '<span class="text-slate-400">—</span>';
            } else {
                var meta = SYRUP_COLLATERAL_META[asset] || {};
                var usdText;
                if (collatUsd != null) {
                    usdText = CommonRenderer.formatCurrency(collatUsd);
                } else if (isAnomaly) {
                    usdText = '<span class="text-slate-400"' + anomalyAttrs + '>—</span>' + anomalyGlyph;
                } else {
                    usdText = '<span class="text-slate-400">—</span>';
                }
                var issuerSuffix = meta.issuer && meta.issuer !== '—' ?
                    ' <span class="text-xs text-slate-400">(' + meta.issuer + ')</span>' : '';
                collatCellText = '<span class="font-mono text-xs">' + asset + '</span> ' +
                    '<span class="font-mono text-sm">' + usdText + '</span>' + issuerSuffix;
            }

            var initLevel = c.init_level_pct;
            var curLevel = c.current_level_pct;
            var initText = (initLevel != null) ? CommonRenderer.formatPercent(initLevel, 0) : '—';
            var curText;
            if (curLevel != null) {
                curText = CommonRenderer.formatPercent(curLevel, 1);
            } else if (isAnomaly) {
                curText = '<span' + anomalyAttrs + '>—</span>' + anomalyGlyph;
            } else {
                curText = '—';
            }

            collateralCells =
                '<td>' + collatCellText + '</td>' +
                '<td class="text-right font-mono text-slate-500">' + initText + '</td>' +
                '<td class="text-right font-mono">' + curText + '</td>' +
                SyrupUSDCRenderer._renderBufferCell(c);

            sortAttrs.collat = asset || '';
            sortAttrs.init = (initLevel != null) ? initLevel : '';
            sortAttrs.cur = (curLevel != null) ? curLevel : '';
            sortAttrs.buf = (c.buffer_pp != null) ? c.buffer_pp : '';
        }

        var dataAttrs = Object.keys(sortAttrs).map(function(k) {
            return 'data-' + k.replace(/_/g, '-') + '="' + String(sortAttrs[k]).replace(/"/g, '&quot;') + '"';
        }).join(' ');

        return '<tr ' + dataAttrs + '>' +
            '<td>' + borrowerCell + '</td>' +
            '<td class="text-right font-mono">' + CommonRenderer.formatCurrency(loan.principal || 0) + '</td>' +
            '<td class="text-right font-mono">' + (loan.rate_pct != null ? CommonRenderer.formatPercent(loan.rate_pct, 2) : '—') + '</td>' +
            '<td class="text-right font-mono ' + daysCls + '">' + daysText + '</td>' +
            '<td>' + statusCell + '</td>' +
            collateralCells +
        '</tr>';
    },

    // Per-Set buffer-color decision rule (master spec §3).
    _renderBufferCell: function(coll) {
        var buf = coll && coll.buffer_pp;
        if (buf === null || buf === undefined) {
            // Distinguish data_anomaly (collateral state unverifiable) from
            // genuinely-unavailable so readers understand the difference.
            if (coll && coll.usd_source === 'data_anomaly') {
                return '<td class="text-right font-mono text-slate-400 cursor-help" title="Maple GraphQL data anomaly — collateral state unverifiable">— <span class="text-amber-500 text-xs">?</span></td>';
            }
            return '<td class="text-right font-mono text-slate-400">—</td>';
        }
        var sign = buf >= 0 ? '+' : '';
        var label = sign + buf.toFixed(1) + 'pp';

        if (coll.is_at_par) {
            // Set B: gray "at-par" tag unless asset has depegged below par
            if (buf < -1) {
                return '<td class="text-right font-mono text-red-600 font-semibold" title="Collateral asset depegged below par">' + label + ' 🔴</td>';
            }
            return '<td class="text-right font-mono text-slate-500" title="At par by design">' + label + ' <span class="text-xs">at-par</span></td>';
        }
        // Set A
        if (buf < 0) return '<td class="text-right font-mono text-red-600 font-semibold" title="Below init level — delegate discretion to call">' + label + ' 🔴</td>';
        if (buf < 5) return '<td class="text-right font-mono text-amber-600 font-semibold" title="Approaching init level">' + label + ' ⚠</td>';
        return '<td class="text-right font-mono text-green-600">' + label + '</td>';
    },

    _attachLoanTableSort: function() {
        var table = document.getElementById('syrup-loans-table');
        if (!table) return;
        var headers = table.querySelectorAll('th[data-sort]');
        var STRING_KEYS = { borrower: 1, status: 1, collat: 1 };
        headers.forEach(function(th) {
            th.addEventListener('click', function() {
                var key = th.getAttribute('data-sort');
                var attr = 'data-' + key.replace(/_/g, '-');
                var tbody = table.querySelector('tbody');
                var rows = Array.prototype.slice.call(tbody.querySelectorAll('tr'));
                // Default click → asc (so Buf ascending = tightest first); subsequent click toggles.
                var dir = th.getAttribute('data-dir') === 'asc' ? 'desc' : 'asc';
                headers.forEach(function(h) { h.removeAttribute('data-dir'); });
                th.setAttribute('data-dir', dir);
                rows.sort(function(a, b) {
                    var av = a.getAttribute(attr) || '';
                    var bv = b.getAttribute(attr) || '';
                    if (STRING_KEYS[key]) {
                        return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
                    }
                    var aEmpty = av === '';
                    var bEmpty = bv === '';
                    if (aEmpty && bEmpty) return 0;
                    if (aEmpty) return 1;
                    if (bEmpty) return -1;
                    var an = parseFloat(av);
                    var bn = parseFloat(bv);
                    return dir === 'asc' ? an - bn : bn - an;
                });
                rows.forEach(function(r) { tbody.appendChild(r); });
            });
        });
    },

    // ----- §3 Borrower Concentration (unchanged) --------------------------
    _renderBorrowerConcentration: function(specific) {
        var lb = specific.loan_book;
        if (!lb || !lb.concentration) return '';
        var c = lb.concentration;

        if (!c.borrowers || c.borrowers.length === 0) {
            return '<div class="panel">' +
                '<div class="panel-title">Borrower Concentration</div>' +
                '<div class="text-slate-400 text-sm italic">No active loans — concentration not applicable.</div>' +
            '</div>';
        }

        var bucketCls = c.hhi_bucket === 'unconcentrated' ? 'bg-green-100 text-green-800' :
                        c.hhi_bucket === 'moderate' ? 'bg-amber-100 text-amber-800' :
                        'bg-red-100 text-red-800';
        var bucketLabel = (c.hhi_bucket || '').charAt(0).toUpperCase() + (c.hhi_bucket || '').slice(1);
        var bucketBadge = '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ' + bucketCls + '">' + bucketLabel + '</span>';

        function bar(label, pct) {
            var p = pct || 0;
            return '<div class="mb-2">' +
                '<div class="flex justify-between text-sm mb-1">' +
                    '<span class="text-slate-600">' + label + '</span>' +
                    '<span class="font-mono font-semibold">' + CommonRenderer.formatPercent(p, 1) + '</span>' +
                '</div>' +
                '<div class="pct-bar-container"><div class="pct-bar" style="width:' + Math.min(p, 100) + '%; background:#6366f1"></div></div>' +
            '</div>';
        }

        var bars = bar('Top 1', c.top_1_share_pct) +
                   bar('Top 3', c.top_3_share_pct) +
                   bar('Top 5', c.top_5_share_pct) +
                   bar('Top 10', c.top_10_share_pct);

        var rows = c.borrowers.map(function(b) {
            return '<tr>' +
                '<td><span class="font-mono text-xs" title="' + b.address + '">' + SyrupUSDCRenderer._truncAddr(b.address) + '</span> ' + SyrupUSDCRenderer._ethLink(b.address) + '</td>' +
                '<td class="text-xs text-slate-500">' + (b.firm || '—') + '</td>' +
                '<td class="text-right font-mono">' + CommonRenderer.formatCurrencyExact(b.principal_usd) + '</td>' +
                '<td class="text-right font-mono">' + (b.loan_count || 0) + '</td>' +
                '<td class="text-right font-mono">' + CommonRenderer.formatPercent(b.share_pct, 2) + '</td>' +
            '</tr>';
        }).join('');

        return '<div class="panel">' +
            '<div class="panel-title">Borrower Concentration</div>' +
            '<div class="flex items-center gap-3 mb-4">' +
                '<span class="text-sm text-slate-700"><span class="font-semibold">' + (c.total_borrowers || 0) + '</span> borrowers · HHI <span class="font-mono font-semibold">' + (c.hhi || 0) + '</span></span>' +
                bucketBadge +
                '<span class="text-xs text-slate-400">FTC merger-review thresholds: &lt;1500 unconcentrated · 1500-2500 moderate · &gt;2500 concentrated</span>' +
            '</div>' +
            '<div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">' +
                '<div>' + bars + '</div>' +
                '<div class="text-xs text-slate-500">' +
                    '<p class="mb-2"><strong>HHI</strong> (Herfindahl-Hirschman Index) is the sum of squared market shares — a single dominant borrower with 100% gives HHI = 10,000; perfectly even distribution gives HHI close to 0.</p>' +
                    '<p>Top-N shares show how much of the loan book is held by the largest 1, 3, 5, 10 borrowers — a fast read for diversification of credit risk.</p>' +
                '</div>' +
            '</div>' +
            '<div class="overflow-x-auto"><table class="data-table"><thead><tr>' +
                '<th>Borrower</th><th>Firm</th><th class="text-right">Principal</th><th class="text-right"># Loans</th><th class="text-right">Share</th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
        '</div>';
    },

    // ----- §4 Repayment Schedule (renamed from Payment Ladder) ------------
    _renderRepaymentSchedule: function(specific) {
        var lb = specific.loan_book;
        if (!lb || !lb.payment_ladder) return '';
        var pl = lb.payment_ladder;

        if (!pl.buckets || pl.buckets.length === 0) {
            return '<div class="panel">' +
                '<div class="panel-title">Repayment Schedule (next ' + (pl.horizon_days || 180) + ' days)</div>' +
                '<div class="text-slate-400 text-sm italic">No active loans — no scheduled inflows.</div>' +
            '</div>';
        }

        var t = pl.totals || {};
        var overdueCount = pl.overdue_loan_count || 0;
        var overduePrincipal = pl.overdue_principal_usd || 0;
        var overdueCls = overdueCount > 0 ? 'risk-flag risk-warning' : 'text-xs text-slate-500';

        function statBlock(label, val) {
            return '<div class="summary-card"><div class="card-label">' + label + '</div><div class="card-value">' + CommonRenderer.formatCurrency(val || 0) + '</div></div>';
        }

        return '<div class="panel">' +
            '<div class="panel-title">Repayment Schedule (next ' + (pl.horizon_days || 180) + ' days)</div>' +
            '<p class="text-sm text-slate-500 mb-3">Expected interest-only inflows from active open-term loans, bucketed by next payment-due date. Principal repays only on a Pool-Delegate call (24h notice + 48h grace) and is not modelled here.</p>' +
            '<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">' +
                statBlock('30d', t.expected_inflow_30d_usd) +
                statBlock('60d', t.expected_inflow_60d_usd) +
                statBlock('90d', t.expected_inflow_90d_usd) +
                statBlock('180d', t.expected_inflow_180d_usd) +
            '</div>' +
            '<div style="height: 220px; position: relative;"><canvas id="syrup-ladder-chart"></canvas></div>' +
            (overdueCount > 0 ?
                '<div class="' + overdueCls + ' mt-3"><strong>Overdue:</strong> ' + overdueCount + ' loan' + (overdueCount > 1 ? 's' : '') + ' · ' + CommonRenderer.formatCurrencyExact(overduePrincipal) + ' principal past payment-due date</div>' :
                '<div class="text-xs text-slate-500 mt-3">Overdue: 0 loans · $0</div>') +
            '<div class="text-xs text-slate-400 mt-2">Method: <span class="font-mono">' + (pl.method || 'rate_estimate') + '</span></div>' +
        '</div>';
    },

    _renderRepaymentScheduleChart: function(specific) {
        var ctx = document.getElementById('syrup-ladder-chart');
        if (!ctx || typeof Chart === 'undefined') return;
        var pl = specific.loan_book && specific.loan_book.payment_ladder;
        if (!pl || !pl.buckets || pl.buckets.length === 0) return;

        var labels = pl.buckets.map(function(b) {
            var d = new Date(b.period_end_iso + 'T00:00:00Z');
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
        });
        var values = pl.buckets.map(function(b) { return b.expected_inflow_usd || 0; });
        var loanCounts = pl.buckets.map(function(b) { return b.loan_count || 0; });
        var total = values.reduce(function(a, b) { return a + b; }, 0);
        var maxBucket = Math.max.apply(null, values);
        var concentrated = total > 0 && (maxBucket / total) > 0.4;
        var color = concentrated ? '#f59e0b' : '#22c55e';

        if (window._syrupLadderChart) window._syrupLadderChart.destroy();
        window._syrupLadderChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Expected interest inflow',
                    data: values,
                    backgroundColor: color,
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(ctx) {
                                var n = loanCounts[ctx.dataIndex];
                                return CommonRenderer.formatCurrency(ctx.raw) + ' · ' + n + ' loan' + (n === 1 ? '' : 's');
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            font: { size: 11 },
                            callback: function(val, idx) { return labels[idx] + ' (' + loanCounts[idx] + ')'; }
                        }
                    },
                    y: {
                        grid: { color: '#f1f5f9' },
                        ticks: {
                            font: { size: 11 },
                            callback: function(v) { return '$' + (v / 1e6).toFixed(1) + 'M'; }
                        },
                        beginAtZero: true
                    }
                }
            }
        });
    },

    // ----- §5 Liquidity & Peg (folds Exit Realism + Stress Anchor + Peg) --
    _renderLiquidityAndPeg: function(specific, s) {
        var wq = specific.withdrawal_queue;
        var liq = specific.liquidity;
        var peg = specific.peg;
        var lb = specific.loan_book || {};

        var html = '<div class="panel"><div class="panel-title">Liquidity &amp; Peg</div>' +
            '<p class="text-sm text-slate-500 mb-3">Two exit paths: (a) instant queue exit redeems against free USDC at NAV; (b) DEX/aggregator sell takes a slippage hit but settles immediately. Peg deviation = market price vs theoretical NAV.</p>';

        // Free USDC + queue
        if (wq) {
            var freeUsd = (s.collateral_ratio_alt && s.collateral_ratio_alt.is_currency) ? s.collateral_ratio_alt.value :
                          (specific.vault_state && specific.vault_state.free_usdc) || null;
            var freePct = SyrupUSDCRenderer._freeLiquidityPct(s);
            var queueEmpty = wq.is_empty === true;
            var depthUsd = (wq.queue_depth_usdc_est === null || wq.queue_depth_usdc_est === undefined) ? (queueEmpty ? 0 : null) : wq.queue_depth_usdc_est;
            var slots = wq.queue_depth_slots;
            var nextId = wq.next_request_id;
            var lastId = wq.last_request_id;
            var depthCls = depthUsd !== null && depthUsd > 10000000 ? 'warning' : '';
            var depthText = depthUsd === null ? '—' : CommonRenderer.formatCurrency(depthUsd);

            html += '<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">' +
                '<div class="summary-card"><div class="card-label">Free USDC</div><div class="card-value positive">' + CommonRenderer.formatCurrency(freeUsd) + '</div><div class="text-xs text-slate-400 mt-1">' + CommonRenderer.formatPercent(freePct, 1) + ' of supply</div></div>' +
                '<div class="summary-card"><div class="card-label">Queue Depth</div><div class="card-value ' + depthCls + '">' + depthText + '</div><div class="text-xs text-slate-400 mt-1">USDC est.</div></div>' +
                '<div class="summary-card"><div class="card-label">Queue Slots</div><div class="card-value">' + (slots !== null && slots !== undefined ? slots : '—') + '</div><div class="text-xs text-slate-400 mt-1">' + (queueEmpty ? 'empty' : 'pending') + '</div></div>' +
                '<div class="summary-card"><div class="card-label">Request IDs</div><div class="card-value text-base font-mono">' + (lastId != null ? lastId : '—') + ' / ' + (nextId != null ? nextId : '—') + '</div><div class="text-xs text-slate-400 mt-1">last filled / next to file</div></div>' +
            '</div>';
        }

        // DEX aggregator slippage
        if (liq && liq.quotes) {
            var sizes = Object.keys(liq.quotes).sort(function(a, b) { return parseFloat(a) - parseFloat(b); });
            var rows = sizes.map(function(sz) {
                var q = liq.quotes[sz];
                var bps = q.slippage_bps;
                var cls = bps > 50 ? 'text-red-600 font-semibold' : bps > 20 ? 'text-amber-600' : '';
                return '<tr>' +
                    '<td class="font-mono">$' + Number(sz).toLocaleString() + '</td>' +
                    '<td class="text-right font-mono ' + cls + '">' + (bps != null ? bps.toFixed(1) + ' bps' : '—') + '</td>' +
                    '<td class="text-right font-mono">' + (q.output_usd != null ? '$' + q.output_usd.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—') + '</td>' +
                '</tr>';
            }).join('');
            var sourceLabel = liq.source ? ' (' + liq.source + ')' : '';
            html += '<div class="text-sm font-semibold text-slate-700 mt-2 mb-1">DEX aggregator slippage → USDC' + sourceLabel + '</div>' +
                '<table class="data-table"><thead><tr><th>Notional</th><th class="text-right">Slippage</th><th class="text-right">Output</th></tr></thead><tbody>' + rows + '</tbody></table>' +
                (liq.pool_tvl ? '<div class="text-xs text-slate-400 mt-2">DEX pool TVL: ' + CommonRenderer.formatCurrency(liq.pool_tvl) + (liq.pool_count ? ' across ' + liq.pool_count + ' pools' : '') + '</div>' : '');
        }

        // NEW: Peg deviation row
        if (peg && (peg.market_price != null || peg.theoretical_price != null)) {
            // premium_discount_pct is a percentage (e.g. -0.06 = -6 bps roughly).
            // 1% = 100 bps. So bps = pct * 100.
            var pdPct = peg.premium_discount_pct;
            var pdBps = (pdPct != null) ? pdPct * 100 : null;
            var pdSign = pdBps != null && pdBps >= 0 ? '+' : '';
            var pdCls = pdBps != null && Math.abs(pdBps) > 50 ? 'text-red-600 font-semibold' :
                        pdBps != null && Math.abs(pdBps) > 20 ? 'text-amber-600' : 'text-slate-700';
            html += '<div class="text-sm font-semibold text-slate-700 mt-4 mb-1">Peg deviation</div>' +
                '<div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-2">' +
                    '<div class="summary-card"><div class="card-label">Market price</div><div class="card-value">' + (peg.market_price != null ? '$' + peg.market_price.toFixed(4) : '—') + '</div><div class="text-xs text-slate-400 mt-1">' + (peg.source || 'external') + '</div></div>' +
                    '<div class="summary-card"><div class="card-label">NAV (theoretical)</div><div class="card-value">' + (peg.theoretical_price != null ? '$' + peg.theoretical_price.toFixed(4) : '—') + '</div><div class="text-xs text-slate-400 mt-1">on-chain</div></div>' +
                    '<div class="summary-card"><div class="card-label">Discount</div><div class="card-value ' + pdCls + '">' + (pdBps != null ? pdSign + pdBps.toFixed(1) + ' bps' : '—') + '</div><div class="text-xs text-slate-400 mt-1">market vs NAV</div></div>' +
                '</div>';
        }

        // Stress anchor
        var freePct2 = SyrupUSDCRenderer._freeLiquidityPct(s);
        var freeUsd2 = (s.collateral_ratio_alt && s.collateral_ratio_alt.is_currency) ? s.collateral_ratio_alt.value : null;
        var paymentInterval = lb.weighted_avg_payment_interval_days;
        if (paymentInterval == null) paymentInterval = lb.weighted_avg_remaining_days_to_due;
        var freePctText = freePct2 != null ? freePct2.toFixed(1) + '%' : '?';
        var freeUsdText = freeUsd2 != null ?
            (freeUsd2 >= 1e6 ? '$' + (freeUsd2 / 1e6).toFixed(0) + 'M' : '$' + (freeUsd2 / 1e3).toFixed(0) + 'K') : '?';
        var intervalText = paymentInterval != null ? paymentInterval.toFixed(0) + '-day' : 'multi-week';
        var monthlyInflow = lb.payment_ladder && lb.payment_ladder.totals && lb.payment_ladder.totals.expected_inflow_30d_usd;
        var inflowFragment = (monthlyInflow != null) ?
            ' (interest-only ≈ <span class="font-mono">' + CommonRenderer.formatCurrency(monthlyInflow) + '/30d</span>)' : '';

        html += '<div class="text-sm font-semibold text-slate-700 mt-4 mb-1">Stress anchor</div>' +
            '<p class="text-sm text-slate-700">' +
                'Free liquidity (<span class="font-semibold">' + freePctText + '</span>, ' + freeUsdText + ') covers redemptions to ~<span class="font-semibold">' + freeUsdText + '</span> before queueing. ' +
                'Above that, exits depend on incoming loan repayments' + inflowFragment + '. ' +
                'Avg loan payment interval <span class="font-semibold">' + intervalText + '</span>; the pool has 24h notice + 48h grace to call a delinquent loan.' +
            '</p>' +
        '</div>';
        return html;
    },

    // ----- §6 Trust Stack (renamed from Governance + audit roll-up) -------
    _renderTrustStack: function(specific) {
        var g = specific.governance;
        if (!g) return '';

        function addrOf(v) {
            if (!v) return null;
            if (typeof v === 'string') return v;
            if (typeof v === 'object' && v.address) return v.address;
            return null;
        }

        var rows = [];
        function row(label, addr, extra) {
            if (!addr) return '';
            var addrCell = '<span class="font-mono text-xs" title="' + addr + '">' + SyrupUSDCRenderer._truncAddr(addr) + '</span> ' + SyrupUSDCRenderer._ethLink(addr);
            return '<tr>' +
                '<td class="font-medium">' + label + '</td>' +
                '<td>' + addrCell + '</td>' +
                '<td class="text-xs text-slate-500">' + (extra || '-') + '</td>' +
            '</tr>';
        }

        var govAddr = addrOf(g.governor);
        if (govAddr) {
            var govExtra = 'timelock';
            var hrs = g.timelock_hours;
            if (hrs === undefined && typeof g.governor === 'object' && g.governor.min_delay_s) {
                hrs = g.governor.min_delay_s / 3600;
            }
            if (hrs != null) govExtra += ' · min delay ' + hrs + 'h';
            rows.push(row('Governor', govAddr, govExtra));
        }
        var opAddr = addrOf(g.operational_admin);
        if (opAddr) {
            var opExtra = 'safe';
            var opThresh = (typeof g.operational_admin === 'object') ? g.operational_admin.threshold : g.operational_admin_threshold;
            if (opThresh) opExtra += ' · ' + opThresh;
            rows.push(row('Operational Safe', opAddr, opExtra));
        }
        var secAddr = addrOf(g.security_admin);
        if (secAddr) {
            var secExtra = 'safe';
            var secThresh = (typeof g.security_admin === 'object') ? g.security_admin.threshold : g.security_admin_threshold;
            if (secThresh) secExtra += ' · ' + secThresh;
            rows.push(row('Security Safe', secAddr, secExtra));
        }
        var pdAddr = addrOf(g.pool_delegate);
        if (pdAddr) {
            var pdExtra = '';
            var firm = g.pool_delegate_firm || (typeof g.pool_delegate === 'object' ? g.pool_delegate.firm : null);
            var isEoa = g.pool_delegate_is_eoa;
            if (isEoa === undefined && typeof g.pool_delegate === 'object') isEoa = (g.pool_delegate.type === 'eoa');
            if (firm) pdExtra += firm;
            if (isEoa) pdExtra += (pdExtra ? ' · ' : '') + '<span class="text-amber-600 font-semibold">⚠ EOA</span>';
            rows.push(row('Pool Delegate', pdAddr, pdExtra || '-'));
        }
        var coverAddr = (typeof g.pool_delegate_cover === 'string') ? g.pool_delegate_cover :
                        (g.pool_delegate_cover && g.pool_delegate_cover.address) || null;
        var coverBal = g.pool_delegate_cover_usdc;
        if (coverBal === undefined && g.pool_delegate_cover && typeof g.pool_delegate_cover === 'object') {
            coverBal = g.pool_delegate_cover.balance;
        }
        var coverReq = g.min_cover_amount;
        if (coverReq === undefined && g.pool_delegate_cover && typeof g.pool_delegate_cover === 'object') {
            coverReq = g.pool_delegate_cover.min_required;
        }
        if (coverAddr || coverBal !== undefined || coverReq !== undefined) {
            var coverCls = (coverBal || 0) < (coverReq || 0) || (coverBal || 0) === 0 ? 'text-amber-600 font-semibold' : '';
            var coverCell = '<span class="font-mono ' + coverCls + '">' + CommonRenderer.formatCurrency(coverBal || 0) + '</span> / required ' + CommonRenderer.formatCurrency(coverReq || 0);
            if (coverAddr) coverCell += ' ' + SyrupUSDCRenderer._ethLink(coverAddr);
            rows.push('<tr>' +
                '<td class="font-medium">PD First-Loss Cover</td>' +
                '<td>' + coverCell + '</td>' +
                '<td class="text-xs text-slate-500">Pool Delegate skin-in-the-game</td>' +
            '</tr>');
        }
        if (g.protocol_paused !== undefined) {
            var pausedCls = g.protocol_paused ? 'text-red-600 font-semibold' : 'text-green-600';
            rows.push('<tr>' +
                '<td class="font-medium">Protocol Paused</td>' +
                '<td><span class="' + pausedCls + '">' + (g.protocol_paused ? 'YES' : 'No') + '</span></td>' +
                '<td class="text-xs text-slate-500">MapleGlobals master switch</td>' +
            '</tr>');
        }

        var lastTx = '';
        if (g.last_admin_tx_timestamp) {
            lastTx = '<div class="text-xs text-slate-400 mt-2">Last admin tx: ' + CommonRenderer.formatDate(g.last_admin_tx_timestamp) + '</div>';
        }

        var auditLine =
            '<div class="text-sm text-slate-600 mt-3 pt-3 border-t border-slate-200">' +
                'Audits: <strong>' + SYRUP_AUDIT_INFO.primary_audits + '</strong> + ' + SYRUP_AUDIT_INFO.other_audits_count + ' others (' + SYRUP_AUDIT_INFO.total_audits + ' total) · ' +
                'Bug bounty: <strong>' + SYRUP_AUDIT_INFO.bug_bounty + '</strong>' +
            '</div>';

        return '<div class="panel">' +
            '<div class="panel-title">Trust Stack</div>' +
            '<table class="data-table"><thead><tr><th>Role</th><th>Address</th><th>Notes</th></tr></thead><tbody>' + rows.join('') + '</tbody></table>' +
            lastTx +
            auditLine +
        '</div>';
    },

    // ----- §7 Yield (demoted) ---------------------------------------------
    // PegTracker now sources yield live from Maple's syrupGlobals.apyTimeSeries
    // (headline_apy_source: "syrup_graphql"). core_apy_pct = organic loan
    // interest; boost_apy_pct = SYRUP-token Drips boost (0 since campaign ended
    // Feb 2026, but live-sourced so a future Season 2 would render correctly).
    _renderYield: function(specific) {
        var y = specific.yield;
        if (!y) return '';
        // Prefer live core/headline; fall back to base_apy_pct for older snapshots.
        var liveApy = y.core_apy_pct;
        if (liveApy == null) liveApy = y.headline_apy_pct;
        if (liveApy == null) liveApy = y.base_apy_pct;
        var boost = (y.boost_apy_pct != null) ? y.boost_apy_pct : 0;
        var fee = y.delegate_fee_pct;
        var isLiveSource = y.headline_apy_source === 'syrup_graphql';

        var maxApy = Math.max((liveApy || 0) + (boost || 0), 1) * 1.2;
        function bar(val, color, label, tag) {
            if (val === null || val === undefined) return '';
            var pct = Math.max(0, Math.min(100, val / maxApy * 100));
            return '<div class="mb-2">' +
                '<div class="flex justify-between text-sm mb-1">' +
                    '<span class="text-slate-700 font-semibold">' + label + (tag ? ' <span class="text-xs text-slate-400 font-normal">(' + tag + ')</span>' : '') + '</span>' +
                    '<span class="font-mono font-semibold text-slate-700">' + CommonRenderer.formatPercent(val, 2) + '</span>' +
                '</div>' +
                '<div class="pct-bar-container"><div class="pct-bar" style="width:' + pct + '%; background:' + color + '"></div></div>' +
            '</div>';
        }

        // Drips boost: render as a regular secondary bar when > 0 (future
        // campaign), otherwise as a small gray zero-line with historical note.
        var boostBlock;
        if (boost > 0) {
            boostBlock = '<div class="mt-3 pt-3 border-t border-slate-200">' +
                bar(boost, '#a855f7', 'Drips boost', 'SYRUP token, live') +
            '</div>';
        } else {
            boostBlock = '<div class="mt-3 pt-3 border-t border-slate-200">' +
                '<div class="flex justify-between text-xs text-slate-400 mb-1">' +
                    '<span>Drips boost <span class="text-slate-400">(SYRUP token campaign — ended Feb 2026)</span></span>' +
                    '<span class="font-mono">' + CommonRenderer.formatPercent(boost, 2) + '</span>' +
                '</div>' +
                '<div class="pct-bar-container"><div class="pct-bar" style="width:0%; background:#cbd5e1"></div></div>' +
            '</div>';
        }

        // "as of" timestamp + source tag — small footer line.
        var sourceLine = '';
        if (isLiveSource) {
            var asOfText = '';
            if (y.apy_as_of) {
                var d = new Date(y.apy_as_of * 1000);
                if (!isNaN(d.getTime())) asOfText = ' · as of ' + d.toISOString().slice(0, 10);
            }
            sourceLine = '<div class="text-xs text-slate-400 mt-1">Source: <span class="font-mono">syrupGlobals.apyTimeSeries</span> (Maple GraphQL)' + asOfText + '</div>';
        }

        return '<div class="panel">' +
            '<div class="panel-title">Yield Decomposition</div>' +
            '<p class="text-sm text-slate-500 mb-3">Live APY is the organic loan-interest stream — the durable yield depositors receive going forward.</p>' +
            bar(liveApy, '#22c55e', 'Live APY', 'organic loan interest') +
            boostBlock +
            (fee != null ? '<div class="text-sm text-slate-500 mt-3">Pool Delegate management fee: <span class="font-mono font-semibold">' + CommonRenderer.formatPercent(fee, 2) + '</span> taken from gross before share-holders.</div>' : '') +
            (y.apr_24h_pct != null ? '<div class="text-xs text-slate-400 mt-1">24h realised APR (NAV): ' + CommonRenderer.formatPercent(y.apr_24h_pct, 2) + ' — trailing window, can be noisy</div>' : '') +
            sourceLine +
        '</div>';
    },

    // ----- Multi-Chain (Phase 3, hidden when only Ethereum) ---------------
    _renderMultiChain: function(specific) {
        var mc = specific.multi_chain;
        if (!mc) return '';
        var chains = Object.keys(mc);
        var nonEthPopulated = chains.some(function(c) {
            return c !== 'ethereum' && mc[c] && mc[c].supply !== null && mc[c].supply !== undefined;
        });
        if (!nonEthPopulated) return '';

        var rows = chains.map(function(c) {
            var d = mc[c] || {};
            return '<tr>' +
                '<td class="font-medium">' + c.charAt(0).toUpperCase() + c.slice(1) + '</td>' +
                '<td class="text-right font-mono">' + (d.supply != null ? CommonRenderer.formatCurrency(d.supply) : '-') + '</td>' +
                '<td class="text-right font-mono">' + (d.share_of_supply_pct != null ? CommonRenderer.formatPercent(d.share_of_supply_pct, 1) : '-') + '</td>' +
                '<td class="font-mono text-xs">' + (d.ccip_pool ? SyrupUSDCRenderer._truncAddr(d.ccip_pool) + ' ' + SyrupUSDCRenderer._ethLink(d.ccip_pool) : '-') + '</td>' +
            '</tr>';
        }).join('');

        return '<div class="panel">' +
            '<div class="panel-title">Multi-Chain Distribution</div>' +
            '<table class="data-table"><thead><tr><th>Chain</th><th class="text-right">Supply</th><th class="text-right">Share</th><th>CCIP Pool</th></tr></thead><tbody>' + rows + '</tbody></table>' +
        '</div>';
    }
};
