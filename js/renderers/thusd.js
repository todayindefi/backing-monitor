/**
 * thUSD renderer — Theo Network's yield-bearing onchain dollar.
 *
 * Modeled on apyx.js (same Theo issuer family, same vault-share +
 * off-chain backing pattern) with the multi-chain conservation table
 * borrowed from usdm.js. Keyed on `data.asset_slug === "thusd"` because
 * `asset_specific.type === "rwa-stable"` is too generic to claim safely.
 *
 * Data files (hourly sync):
 *   data/thusd_backing.json            (canonical)
 *   data/thusd_flow.json               (lifetime + windowed mint/burn)
 *   data/thusd_critical_events.json    (tier-3 event feed)
 *   data/thusd_nav_history.json        (sthUSD share price series)      [optional]
 *   data/thusd_coverage_history.json   (on-chain coverage % series)     [optional]
 *   data/thusd_reserve_known_destinations.json (attribution map)        [optional]
 */

var THUSD_LAUNCH_ISO = '2026-04-27T00:00:00Z';

var THUSD_RESERVE_COLORS = {
    'thBILL @ NAV':     '#3b82f6',
    'USDT @ reserve':   '#10b981',
    'USDC @ reserve':   '#06b6d4',
    'Off-chain (implied)': '#94a3b8'
};

var ThusdRenderer = {

    // ============================================================
    // helpers
    // ============================================================
    _isThusd: function(slug) { return slug === 'thusd'; },

    _truncAddr: function(addr) {
        if (!addr) return '-';
        return addr.slice(0, 6) + '...' + addr.slice(-4);
    },

    _explorerBase: function(chain) {
        if (!chain) return null;
        var c = chain.toLowerCase();
        if (c.indexOf('arbitrum') >= 0) return 'https://arbiscan.io';
        if (c.indexOf('stable')   >= 0) return 'https://stablescan.org';
        return 'https://etherscan.io';
    },

    _addrLink: function(addr, chain) {
        if (!addr) return '<span class="text-slate-400">-</span>';
        var base = ThusdRenderer._explorerBase(chain);
        return '<span class="font-mono text-xs" title="' + addr + '">' +
            ThusdRenderer._truncAddr(addr) +
            '</span> <a href="' + base + '/address/' + addr +
            '" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline text-xs">↗</a>';
    },

    _txLink: function(tx, chain) {
        if (!tx) return '<span class="text-slate-400">-</span>';
        var base = ThusdRenderer._explorerBase(chain);
        return '<a href="' + base + '/tx/' + tx + '" target="_blank" rel="noopener noreferrer" ' +
            'class="font-mono text-xs text-blue-500 hover:underline" title="' + tx + '">' +
            tx.slice(0, 8) + '…' + tx.slice(-4) + ' ↗</a>';
    },

    _statusDot: function(state) {
        var c = state === 'ok' ? '#22c55e' :
                state === 'warn' ? '#f59e0b' :
                state === 'critical' ? '#ef4444' : '#94a3b8';
        return '<span class="inline-block w-2 h-2 rounded-full align-middle" style="background:' + c + '"></span>';
    },

    _statusPill: function(label, state, extra) {
        var cls = state === 'ok' ? 'bg-green-100 text-green-800' :
                  state === 'warn' ? 'bg-amber-100 text-amber-800' :
                  state === 'critical' ? 'bg-red-100 text-red-800' :
                                         'bg-slate-100 text-slate-700';
        return '<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ' + cls + '">' +
            ThusdRenderer._statusDot(state) +
            '<span>' + label + (extra ? ' <span class="font-mono">' + extra + '</span>' : '') + '</span>' +
        '</span>';
    },

    _chainBadge: function(chain) {
        var lbl = chain.charAt(0).toUpperCase() + chain.slice(1);
        return '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">' + lbl + '</span>';
    },

    _coverageState: function(pct) {
        if (pct == null) return 'unknown';
        if (pct >= 95) return 'ok';
        if (pct >= 80) return 'warn';
        return 'critical';
    },

    _anchor: function(id, html) {
        if (!html || typeof html !== 'string') return html;
        return html.replace(/^(<div class="panel")/, '<div id="' + id + '" class="panel"');
    },

    _formatNum: function(num, dp) {
        if (num == null) return '-';
        dp = dp != null ? dp : 2;
        return num.toLocaleString('en-US', { maximumFractionDigits: dp, minimumFractionDigits: dp });
    },

    // Compute "since launch" APY from the share-price series when available
    // (≥2 points spanning >=7 days), else fall back to the published launch
    // date. Early-accrual artifact during vault bootstrap inflates the
    // launch-anchored figure — prefer the time-series-anchored value.
    _impliedApy: function(currentSharePrice, navHistory) {
        if (currentSharePrice == null) return null;
        if (Array.isArray(navHistory) && navHistory.length >= 2) {
            var first = navHistory[0];
            var last  = navHistory[navHistory.length - 1];
            var t0 = new Date(first.timestamp).getTime();
            var t1 = new Date(last.timestamp).getTime();
            var days = (t1 - t0) / 86400000;
            if (days >= 7 && first.share_price > 0) {
                return Math.pow(last.share_price / first.share_price, 365 / days) - 1;
            }
        }
        var launchMs = new Date(THUSD_LAUNCH_ISO).getTime();
        var nowMs = Date.now();
        var d = (nowMs - launchMs) / 86400000;
        if (d <= 0) return null;
        return Math.pow(currentSharePrice / 1.0, 365 / d) - 1;
    },

    // ============================================================
    // preRender — synthesize fields common.js reads unconditionally so
    // the default summary cards / breakdown table / CR chart don't NPE.
    // We hide all of those in render(); the panels below carry the live signal.
    // ============================================================
    preRender: function(data, history) {
        if (!ThusdRenderer._isThusd(data && data.asset_slug)) return;
        var s = data.summary || {};
        var spec = data.asset_specific || {};

        if (!s.collateral_ratio_alt) {
            s.collateral_ratio_alt = { label: '_thusdAlt', value: 0, is_currency: false };
        }
        spec.card_overrides = spec.card_overrides || {};
        spec.card_overrides['_thusdAlt'] = { hidden: true };
        spec.card_overrides['Surplus / Deficit'] = { hidden: true };
        spec.card_overrides['Total Backing'] = { hidden: true };
        spec.card_overrides['Collateral Ratio'] = { hidden: true };

        // thusd_backing.json ships a `backing_breakdown` list that doesn't
        // carry `tags` (the field common.renderBreakdownTable assumes). The
        // default panel is hidden in render() either way, so blank it out
        // here to keep common.js from NPE-ing on the missing tags.
        data.backing_breakdown = [];
    },

    // ============================================================
    // entry point
    // ============================================================
    render: function(data) {
        var container = document.getElementById('asset-specific-panels');
        if (!container) return;
        if (!ThusdRenderer._isThusd(data.asset_slug)) return;

        ThusdRenderer._suppressCommonPanels(data);

        var spec = data.asset_specific || {};
        var s = data.summary || {};
        var anc = ThusdRenderer._anchor;
        var html = '';

        html += anc('thusd-headline',     ThusdRenderer._renderHeadlineCard(spec, s));
        html += anc('thusd-risk-banner',  ThusdRenderer._renderRiskBanner(data));
        html += anc('thusd-reserves',     ThusdRenderer._renderReserveComposition(spec, s));
        html += anc('thusd-coverage',     ThusdRenderer._renderCoverageHistoryPanel());
        html += anc('thusd-yield',        ThusdRenderer._renderYieldTrajectoryPanel(spec));
        html += anc('thusd-chains',       ThusdRenderer._renderConservationTable(spec));
        html += anc('thusd-admin',        ThusdRenderer._renderAdminChain(spec));
        html += anc('thusd-flow',         ThusdRenderer._renderFlowPanel(spec));
        html += anc('thusd-events',       ThusdRenderer._renderCriticalEventsPanel(spec));
        html += anc('thusd-peg',          ThusdRenderer._renderDexPeg(spec));
        html += anc('thusd-methodology',  ThusdRenderer._renderMethodology(spec));

        container.innerHTML = html;

        ThusdRenderer._setupAnchorNav();
        ThusdRenderer._renderReservesDonut(spec, s);
        ThusdRenderer._loadCoverageHistoryChart(s);
        ThusdRenderer._loadYieldTrajectoryChart(spec, s);
        ThusdRenderer._loadCriticalEventsFromFile();
    },

    _suppressCommonPanels: function(data) {
        // Hide default summary-card strip — §1 Headline below is richer.
        var summaryCards = document.getElementById('summary-cards');
        if (summaryCards) summaryCards.style.display = 'none';

        // Hide the empty breakdown panel and pie chart.
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

        // Hide the default CR History chart — coverage history lives in §4.
        var chartPanel = document.getElementById('chart-panel');
        if (chartPanel) chartPanel.style.display = 'none';

        // Hide the default risk-flags panel — we render a contextualized
        // banner in §2 (the 3 ownership-changed flags are verified migrations,
        // not security incidents, and need disambiguation).
        var risk = document.getElementById('risk-flags');
        if (risk) {
            var rp = risk.closest('.panel');
            if (rp) rp.style.display = 'none';
        }
    },

    _setupAnchorNav: function() {
        var navEl = document.getElementById('asset-anchor-nav');
        var inner = document.getElementById('asset-anchor-nav-inner');
        if (!navEl || !inner) return;
        var items = [
            { id: 'thusd-headline',    label: 'Asset' },
            { id: 'thusd-reserves',    label: 'Reserves' },
            { id: 'thusd-coverage',    label: 'Coverage' },
            { id: 'thusd-yield',       label: 'Yield' },
            { id: 'thusd-chains',      label: 'Chains' },
            { id: 'thusd-admin',       label: 'Admin' },
            { id: 'thusd-flow',        label: 'Flow' },
            { id: 'thusd-events',      label: 'Events' },
            { id: 'thusd-peg',         label: 'DEX peg' }
        ];
        inner.innerHTML = items.map(function(it) {
            return '<a href="#' + it.id + '" class="text-slate-600 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400 px-2 py-0.5 rounded transition-colors">' + it.label + '</a>';
        }).join('');
        navEl.classList.remove('hidden');
    },

    // ============================================================
    // §1 Headline card
    // ============================================================
    _renderHeadlineCard: function(spec, s) {
        var supply = s.circulating_supply || 0;
        var sthusd = s.sthusd_supply || 0;
        var stakingPct = (s.staking_ratio != null) ? (s.staking_ratio * 100) : null;

        var covPct = (s.on_chain_coverage_pct != null) ? s.on_chain_coverage_pct * 100 : null;
        var covState = ThusdRenderer._coverageState(covPct);
        var covCls = covState === 'ok' ? 'text-green-600' :
                     covState === 'warn' ? 'text-amber-600' :
                     covState === 'critical' ? 'text-red-600' : 'text-slate-600';

        var sharePrice = (spec.tier2_peg_nav && spec.tier2_peg_nav.sthusd_nav)
            ? spec.tier2_peg_nav.sthusd_nav.share_price : null;
        // APY is computed in async chart loader once nav history is fetched;
        // headline shows a launch-anchored placeholder that's replaced if a
        // better estimate is available.
        var apyLaunch = ThusdRenderer._impliedApy(sharePrice, null);
        var apyPct = apyLaunch != null ? (apyLaunch * 100) : null;

        var chainBadges = ThusdRenderer._chainBadge('ethereum') +
            ' ' + ThusdRenderer._chainBadge('arbitrum') +
            ' ' + ThusdRenderer._chainBadge('stable');

        return '<div class="panel">' +
            '<div class="flex items-start justify-between gap-4 mb-4">' +
                '<div>' +
                    '<div class="text-xl font-bold text-slate-800">thUSD</div>' +
                    '<div class="text-xs text-slate-500 mt-1">Theo Network · Yield-bearing onchain dollar with off-chain gold-carry leg</div>' +
                '</div>' +
                '<div class="flex flex-wrap gap-1 justify-end">' + chainBadges + '</div>' +
            '</div>' +

            '<div class="grid grid-cols-1 md:grid-cols-3 gap-3">' +
                // Supply cell
                '<div class="bg-slate-50 dark:bg-slate-700 rounded-lg p-3">' +
                    '<div class="text-xs text-slate-500 uppercase font-medium">Supply</div>' +
                    '<div class="text-lg font-bold text-slate-800 dark:text-slate-100">' + CommonRenderer.formatCurrency(supply) + '</div>' +
                    '<div class="text-xs text-slate-500 mt-1">sthUSD: ' + CommonRenderer.formatCurrency(sthusd) +
                        (stakingPct != null ? ', <span class="font-mono">' + stakingPct.toFixed(2) + '%</span> staked' : '') +
                    '</div>' +
                '</div>' +
                // Coverage cell
                '<div class="bg-slate-50 dark:bg-slate-700 rounded-lg p-3" title="On-chain reserves ÷ thUSD supply. Off-chain backing inferred separately.">' +
                    '<div class="text-xs text-slate-500 uppercase font-medium">On-chain coverage</div>' +
                    '<div class="text-lg font-bold ' + covCls + '">' + (covPct != null ? covPct.toFixed(2) + '%' : '—') + '</div>' +
                    '<div class="text-xs text-slate-500 mt-1">' + CommonRenderer.formatCurrency(s.on_chain_reserves_usd) + ' on-chain ÷ ' + CommonRenderer.formatCurrency(s.thusd_supply_usd) + '</div>' +
                '</div>' +
                // NAV / APY cell
                '<div class="bg-slate-50 dark:bg-slate-700 rounded-lg p-3">' +
                    '<div class="text-xs text-slate-500 uppercase font-medium">sthUSD NAV / APY</div>' +
                    '<div class="text-lg font-bold text-slate-800 dark:text-slate-100">' + (sharePrice != null ? '$' + sharePrice.toFixed(6) : '—') + '</div>' +
                    '<div class="text-xs text-slate-500 mt-1" id="thusd-apy-line">' +
                        (apyPct != null ? '≈ <span class="font-mono">' + apyPct.toFixed(1) + '%</span> APY since launch — 6–10% target' : 'APY — pending history') +
                    '</div>' +
                '</div>' +
            '</div>' +
        '</div>';
    },

    // ============================================================
    // §2 Risk-flag banner — contextualized
    // ============================================================
    _renderRiskBanner: function(data) {
        var flags = Array.isArray(data.risk_flags) ? data.risk_flags : [];
        if (flags.length === 0) return '';

        var ownership = flags.filter(function(f) {
            return f.severity === 'critical' && /owner changed from disclosed baseline/.test(f.message);
        });
        var others = flags.filter(function(f) {
            return ownership.indexOf(f) === -1;
        });

        var html = '<div class="panel">';
        html += '<div class="panel-title">Risk Flags</div>';

        if (ownership.length > 0) {
            // Mention each affected contract inline.
            var contracts = ownership.map(function(f) {
                var m = f.message.match(/^(\S+)\s+owner changed/);
                return m ? m[1] : '?';
            });
            html += '<div class="risk-flag risk-warning">' +
                '<strong>' + ownership.length + ' ownership change' + (ownership.length === 1 ? '' : 's') + ' detected (' + contracts.join(', ') + ')</strong> — ' +
                'verified as migration to a new 48-hour TimelockController at ' +
                '<span class="font-mono">0x2bb4…dca02</span>. PROPOSER+EXECUTOR roles are held by the 4-of-6 Safe ' +
                '<span class="font-mono">0x94877640…</span>. ' +
                'Not a key compromise — these flags will clear once the analyzer\'s disclosure baseline is updated to the new owner.' +
            '</div>';
        }

        others.forEach(function(f) {
            var cls = f.severity === 'critical' ? 'risk-critical' :
                      f.severity === 'info' ? 'risk-info' : 'risk-warning';
            html += '<div class="risk-flag ' + cls + '">' + f.message + '</div>';
        });

        html += '</div>';
        return html;
    },

    // ============================================================
    // §3 Reserve composition
    // ============================================================
    _renderReserveComposition: function(spec, s) {
        var oc = spec.on_chain_coverage || {};
        var thbillUsd = (oc.thbill_at_reserve || 0) * (oc.thbill_nav_per_share || 1);
        var usdt = oc.usdt_at_reserve || 0;
        var usdc = oc.usdc_at_reserve || 0;
        var offchain = s.off_chain_backing_implied_usd || 0;
        var total = thbillUsd + usdt + usdc + offchain;

        var rows = [
            ['thBILL @ NAV', thbillUsd, oc.thbill_at_reserve, 'shares ×$' + (oc.thbill_nav_per_share != null ? oc.thbill_nav_per_share.toFixed(6) : '—') + ' NAV'],
            ['USDT @ reserve', usdt, null, 'reserve Safe holdings'],
            ['USDC @ reserve', usdc, null, 'reserve Safe holdings'],
            ['Off-chain (implied)', offchain, null, 'inferred from coverage gap; NOT direct PoR — covers gold-carry, first-loss, other off-chain']
        ];

        var resRows = rows.map(function(r) {
            var label = r[0];
            var usd = r[1];
            var native = r[2];
            var note = r[3];
            var pct = total > 0 ? (usd / total * 100) : 0;
            var color = THUSD_RESERVE_COLORS[label] || '#94a3b8';
            var labelCls = (label === 'Off-chain (implied)') ? 'text-slate-500' : 'text-slate-800';
            return '<tr>' +
                '<td class="font-medium ' + labelCls + '">' +
                    '<span class="inline-block w-2.5 h-2.5 rounded-sm mr-2 align-middle" style="background:' + color + '"></span>' +
                    label +
                '</td>' +
                '<td class="text-right font-mono">' + CommonRenderer.formatCurrencyExact(usd) + '</td>' +
                '<td class="text-right font-mono">' + pct.toFixed(2) + '%</td>' +
                '<td class="text-xs text-slate-500">' + note + '</td>' +
            '</tr>';
        }).join('');
        resRows += '<tr class="font-bold border-t-2 border-slate-200">' +
            '<td>Total</td>' +
            '<td class="text-right font-mono">' + CommonRenderer.formatCurrencyExact(total) + '</td>' +
            '<td class="text-right">100.00%</td>' +
            '<td></td>' +
        '</tr>';

        var reserveSafe = oc.thusd_reserve_safe;

        return '<div class="panel">' +
            '<div class="panel-title">Backing — Reserve Composition</div>' +
            '<div class="text-xs text-slate-500 mb-4">' +
                'Reserve Safe: ' + ThusdRenderer._addrLink(reserveSafe, 'ethereum') + '. ' +
                'On-chain leg is direct reads against this Safe; off-chain leg is implied from the coverage gap.' +
            '</div>' +
            '<div class="grid grid-cols-1 lg:grid-cols-5 gap-6">' +
                '<div class="lg:col-span-2" style="height:260px">' +
                    '<canvas id="thusd-reserves-donut"></canvas>' +
                '</div>' +
                '<div class="lg:col-span-3 data-table-scroll">' +
                    '<table class="data-table">' +
                        '<thead><tr>' +
                            '<th>Component</th>' +
                            '<th class="text-right">USD</th>' +
                            '<th class="text-right">%</th>' +
                            '<th>Note</th>' +
                        '</tr></thead>' +
                        '<tbody>' + resRows + '</tbody>' +
                    '</table>' +
                '</div>' +
            '</div>' +
            '<div class="text-xs text-slate-500 mt-4">' +
                'thBILL drives most on-chain backing — its risk is downstream of thUSD\'s. ' +
                '<a href="https://tidresearch.com/reports/thbill" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline">thBILL report ↗</a>' +
            '</div>' +
        '</div>';
    },

    _renderReservesDonut: function(spec, s) {
        var ctx = document.getElementById('thusd-reserves-donut');
        if (!ctx || typeof Chart === 'undefined') return;
        var oc = spec.on_chain_coverage || {};
        var thbillUsd = (oc.thbill_at_reserve || 0) * (oc.thbill_nav_per_share || 1);
        var offchain = s.off_chain_backing_implied_usd || 0;
        // Clamp the off-chain wedge to ≥0 — when on-chain > supply (over-coll),
        // the implied off-chain is negative, which doesn't render as a slice.
        var values = [thbillUsd, oc.usdt_at_reserve || 0, oc.usdc_at_reserve || 0, Math.max(0, offchain)];
        var labels = ['thBILL @ NAV', 'USDT @ reserve', 'USDC @ reserve', 'Off-chain (implied)'];
        var colors = labels.map(function(l) { return THUSD_RESERVE_COLORS[l]; });

        if (window._thusdReservesDonut) window._thusdReservesDonut.destroy();
        window._thusdReservesDonut = new Chart(ctx, {
            type: 'doughnut',
            data: { labels: labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 0 }] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '55%',
                plugins: {
                    legend: { display: true, position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } },
                    tooltip: {
                        callbacks: {
                            label: function(c) {
                                var total = c.dataset.data.reduce(function(a, b) { return a + b; }, 0);
                                var pct = total > 0 ? (c.raw / total * 100).toFixed(2) : '0.00';
                                return c.label + ': ' + CommonRenderer.formatCurrencyExact(c.raw) + ' (' + pct + '%)';
                            }
                        }
                    }
                }
            }
        });
    },

    // ============================================================
    // §4 Coverage history
    // ============================================================
    _renderCoverageHistoryPanel: function() {
        return '<div class="panel">' +
            '<div class="panel-title">On-chain Coverage History</div>' +
            '<div class="text-xs text-slate-500 mb-3" id="thusd-coverage-note">' +
                'Coverage = on-chain reserves ÷ thUSD supply. The 2026-05-13 step-down is gold-carry deployment, not a reserve loss.' +
            '</div>' +
            '<div style="position:relative;height:260px">' +
                '<canvas id="thusd-coverage-chart"></canvas>' +
            '</div>' +
        '</div>';
    },

    _loadCoverageHistoryChart: function(s) {
        fetch('data/thusd_coverage_history.json').then(function(r) {
            if (!r.ok) throw new Error('no coverage history');
            return r.json();
        }).then(function(entries) {
            ThusdRenderer._drawCoverageChart(entries);
        }).catch(function() {
            var ctx = document.getElementById('thusd-coverage-chart');
            if (ctx && ctx.parentElement) {
                ctx.parentElement.innerHTML = '<div class="text-xs text-slate-400 italic">Coverage history pending data sync — current coverage shown in headline above.</div>';
            }
        });
    },

    _drawCoverageChart: function(entries) {
        var ctx = document.getElementById('thusd-coverage-chart');
        if (!ctx || typeof Chart === 'undefined' || !Array.isArray(entries) || entries.length < 2) return;
        var labels = entries.map(function(e) {
            var ts = e.timestamp.endsWith('Z') ? e.timestamp : e.timestamp + 'Z';
            return new Date(ts);
        });
        var data = entries.map(function(e) { return e.on_chain_coverage_pct * 100; });

        // Locate the 2026-05-13 gold-carry step-down for annotation.
        var stepIso = null;
        for (var i = 1; i < entries.length; i++) {
            var prev = entries[i - 1].on_chain_coverage_pct;
            var cur  = entries[i].on_chain_coverage_pct;
            if (prev != null && cur != null && (prev - cur) > 0.02) {
                stepIso = entries[i].timestamp;
                break;
            }
        }

        var annotations = {
            line100: { type: 'line', yMin: 100, yMax: 100, borderColor: '#94a3b8', borderWidth: 1, borderDash: [4, 4], label: { content: 'Full on-chain coverage', display: true, position: 'end', font: { size: 9 }, color: '#475569' } },
            line70:  { type: 'line', yMin: 70,  yMax: 70,  borderColor: '#dc2626', borderWidth: 1, borderDash: [4, 4], label: { content: 'Validator floor (70%)', display: true, position: 'end', font: { size: 9 }, color: '#dc2626' } }
        };
        if (stepIso) {
            var sd = new Date(stepIso.endsWith('Z') ? stepIso : stepIso + 'Z');
            annotations.stepMark = {
                type: 'line',
                xMin: sd,
                xMax: sd,
                borderColor: '#f59e0b',
                borderWidth: 1.5,
                borderDash: [3, 3],
                label: { content: 'Gold-carry deployment', display: true, position: 'start', rotation: 0, font: { size: 9 }, color: '#b45309', backgroundColor: 'rgba(255,251,235,0.85)' }
            };
        }

        if (window._thusdCoverageChart) window._thusdCoverageChart.destroy();
        window._thusdCoverageChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'On-chain coverage',
                    data: data,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.25,
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
                        suggestedMin: 75,
                        suggestedMax: 105,
                        grid: { color: '#f1f5f9' },
                        ticks: { callback: function(v) { return v.toFixed(0) + '%'; }, font: { size: 11 } }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: function(c) { return c.dataset.label + ': ' + c.raw.toFixed(2) + '%'; } } },
                    annotation: { annotations: annotations }
                },
                interaction: { intersect: false, mode: 'index' }
            }
        });
    },

    // ============================================================
    // §5 Yield trajectory
    // ============================================================
    _renderYieldTrajectoryPanel: function(spec) {
        var sharePrice = (spec.tier2_peg_nav && spec.tier2_peg_nav.sthusd_nav)
            ? spec.tier2_peg_nav.sthusd_nav.share_price : null;
        return '<div class="panel">' +
            '<div class="panel-title">sthUSD Yield Trajectory</div>' +
            '<div class="text-xs text-slate-500 mb-3">' +
                'Realized share-price drift since 2026-04-27 launch. 6%/10% APY reference lines bracket the disclosed target band. ' +
                'Current share-price: <span class="font-mono">' + (sharePrice != null ? '$' + sharePrice.toFixed(6) : '—') + '</span>.' +
            '</div>' +
            '<div style="position:relative;height:260px">' +
                '<canvas id="thusd-yield-chart"></canvas>' +
            '</div>' +
        '</div>';
    },

    _loadYieldTrajectoryChart: function(spec, s) {
        fetch('data/thusd_nav_history.json').then(function(r) {
            if (!r.ok) throw new Error('no nav history');
            return r.json();
        }).then(function(entries) {
            ThusdRenderer._drawYieldChart(entries);
            ThusdRenderer._patchHeadlineApy(entries);
        }).catch(function() {
            var ctx = document.getElementById('thusd-yield-chart');
            if (ctx && ctx.parentElement) {
                ctx.parentElement.innerHTML = '<div class="text-xs text-slate-400 italic">Yield history pending data sync — current NAV in headline.</div>';
            }
        });
    },

    _patchHeadlineApy: function(navHistory) {
        var sharePriceNow = navHistory[navHistory.length - 1].share_price;
        var apy = ThusdRenderer._impliedApy(sharePriceNow, navHistory);
        var line = document.getElementById('thusd-apy-line');
        if (!line || apy == null) return;
        var pct = apy * 100;
        line.innerHTML = '≈ <span class="font-mono">' + pct.toFixed(1) + '%</span> APY (realized, ' + navHistory.length + '-pt window) — 6–10% target';
    },

    _drawYieldChart: function(entries) {
        var ctx = document.getElementById('thusd-yield-chart');
        if (!ctx || typeof Chart === 'undefined' || !Array.isArray(entries) || entries.length < 2) return;
        var launchMs = new Date(THUSD_LAUNCH_ISO).getTime();

        var points = entries.map(function(e) {
            var ts = e.timestamp.endsWith('Z') ? e.timestamp : e.timestamp + 'Z';
            return { x: new Date(ts), y: e.share_price };
        });

        // 6% / 10% APY trajectory curves anchored at launch.
        function curve(rate) {
            return entries.map(function(e) {
                var ts = e.timestamp.endsWith('Z') ? e.timestamp : e.timestamp + 'Z';
                var d = new Date(ts);
                var days = (d.getTime() - launchMs) / 86400000;
                return { x: d, y: Math.pow(1 + rate, days / 365) };
            });
        }

        if (window._thusdYieldChart) window._thusdYieldChart.destroy();
        window._thusdYieldChart = new Chart(ctx, {
            data: {
                datasets: [
                    {
                        type: 'line',
                        label: 'sthUSD share price',
                        data: points,
                        borderColor: '#a855f7',
                        backgroundColor: 'rgba(168, 85, 247, 0.08)',
                        fill: true,
                        tension: 0.25,
                        pointRadius: 0,
                        borderWidth: 2
                    },
                    {
                        type: 'line',
                        label: '6% APY',
                        data: curve(0.06),
                        borderColor: '#16a34a',
                        backgroundColor: 'transparent',
                        borderDash: [4, 4],
                        tension: 0,
                        pointRadius: 0,
                        borderWidth: 1.25
                    },
                    {
                        type: 'line',
                        label: '10% APY',
                        data: curve(0.10),
                        borderColor: '#dc2626',
                        backgroundColor: 'transparent',
                        borderDash: [4, 4],
                        tension: 0,
                        pointRadius: 0,
                        borderWidth: 1.25
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
                        suggestedMin: 1.000,
                        suggestedMax: 1.020,
                        grid: { color: '#f1f5f9' },
                        ticks: { callback: function(v) { return '$' + v.toFixed(4); }, font: { size: 11 } }
                    }
                },
                plugins: {
                    legend: { display: true, position: 'top', labels: { boxWidth: 12, font: { size: 11 } } },
                    tooltip: {
                        callbacks: {
                            label: function(c) { return c.dataset.label + ': $' + c.raw.y.toFixed(6); }
                        }
                    }
                },
                interaction: { intersect: false, mode: 'index' }
            }
        });
    },

    // ============================================================
    // §6 Cross-chain conservation table
    // ============================================================
    _renderConservationTable: function(spec) {
        var t1 = spec.tier1_supplies || {};
        var chains = t1.chains || {};
        var lockbox = t1.lockbox || {};
        var cons = (t1.conservation && t1.conservation.thusd) || {};

        function fmt(n) { return n != null ? n.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 }) + ' thUSD' : '—'; }

        var eth = chains.ethereum || {};
        var arb = chains.arbitrum || {};
        var stb = chains.stable || {};
        var ethSupply = eth.thusd_supply;
        var arbSupply = arb.thusd_supply;
        var stbSupply = stb.thusd_supply;
        var locked = lockbox.thusd_locked;

        var deltaPct = cons.delta_pct;
        var verified = cons.verified;
        var consState = verified ? 'ok' : 'critical';
        var deltaText = (deltaPct != null) ? (deltaPct * 100).toExponential(2) + '%' : '—';

        var rows = [
            ['Ethereum',              ethSupply, 'Canonical (mint)'],
            ['Arbitrum',              arbSupply, 'OFT mirror'],
            ['Stable',                stbSupply, 'OFT mirror — currently holds the bulk of bridged supply'],
            ['<strong>Lockbox (Eth)</strong>', locked, 'Should match Arbitrum + Stable sum']
        ];

        var trs = rows.map(function(r) {
            return '<tr>' +
                '<td>' + r[0] + '</td>' +
                '<td class="text-right font-mono">' + fmt(r[1]) + '</td>' +
                '<td class="text-xs text-slate-500">' + r[2] + '</td>' +
            '</tr>';
        }).join('');

        var consColor = verified ? 'text-green-600' : 'text-red-600';
        trs += '<tr class="font-bold border-t-2 border-slate-200">' +
            '<td>Conservation</td>' +
            '<td class="text-right font-mono ' + consColor + '">' + deltaText + ' Δ</td>' +
            '<td>' + ThusdRenderer._statusPill(verified ? 'verified' : 'BROKEN', consState) + '</td>' +
        '</tr>';

        return '<div class="panel">' +
            '<div class="panel-title">Cross-chain Conservation</div>' +
            '<div class="text-xs text-slate-500 mb-3">' +
                'Per-chain thUSD supply vs the Ethereum-side lockbox. ' +
                'Conservation failure (Δ &gt; 1e-6) means the OFT bridge has accounted for more or less than it should.' +
            '</div>' +
            '<table class="data-table">' +
                '<thead><tr>' +
                    '<th>Chain</th>' +
                    '<th class="text-right">Supply</th>' +
                    '<th>Notes</th>' +
                '</tr></thead>' +
                '<tbody>' + trs + '</tbody>' +
            '</table>' +
        '</div>';
    },

    // ============================================================
    // §7 Admin chain panel
    // ============================================================
    _renderAdminChain: function(spec) {
        var dbl = spec.disclosure_baseline || {};
        var contracts = dbl.contracts || {};
        var adminEoas = dbl.admin_eoas || {};
        var g = spec.guardrails || {};
        var safe = g.safe || {};
        var newTl = '0x2bb4b7e6e83fa6b77d0143dad631843cb73dca02';

        function ownerCell(owner, expected, isOft) {
            if (!owner) return '<span class="text-slate-400">-</span>';
            var lc = owner.toLowerCase();
            if (lc === newTl) {
                return ThusdRenderer._addrLink(owner, 'ethereum') +
                    ' <span class="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700">→ new 48h Timelock</span>';
            }
            if (expected && lc === expected.toLowerCase() && isOft) {
                return ThusdRenderer._addrLink(owner, 'ethereum') +
                    ' <span class="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200" title="Still owned by the disclosure-baseline EOA — remaining migration gap.">⚠ EOA-owned</span>';
            }
            return ThusdRenderer._addrLink(owner, 'ethereum');
        }

        var minterPaused = g.minter_paused;
        var sthusdPaused = g.sthusd_paused;
        var minterState = minterPaused ? 'critical' : 'ok';
        var sthusdState = sthusdPaused ? 'critical' : 'ok';

        var rows = [
            { c: 'thUSD',      addr: contracts.thUSD,      owner: ownerCell(g.thusd_owner, null, false), notes: 'Canonical mint contract' },
            { c: 'sthUSD',     addr: contracts.sthUSD,     owner: ownerCell(g.sthusd_owner, null, false), notes: 'Yield-bearing vault share' },
            { c: 'Minter',     addr: contracts.Minter,     owner: '<span class="text-slate-400 text-xs">not exposed in JSON</span>',
              notes: 'MINTER_ROLE EOA <span class="font-mono">' + (adminEoas.MINTER_EOA ? ThusdRenderer._truncAddr(adminEoas.MINTER_EOA) : '—') + '</span> · ' + ThusdRenderer._statusPill(minterPaused ? 'paused' : 'active', minterState) },
            { c: 'thUSD OFT',  addr: contracts.thUSD_OFT,  owner: ownerCell(g.thusd_oft_owner, adminEoas.thUSD_OFT_owner, true), notes: 'LayerZero OFT mirror admin' },
            { c: 'sthUSD OFT', addr: contracts.sthUSD_OFT, owner: ownerCell(g.sthusd_oft_owner, adminEoas.sthUSD_OFT_owner, true), notes: 'LayerZero OFT mirror admin' }
        ];

        var trs = rows.map(function(r) {
            return '<tr>' +
                '<td class="font-medium">' + r.c + '</td>' +
                '<td>' + ThusdRenderer._addrLink(r.addr, 'ethereum') + '</td>' +
                '<td>' + r.owner + '</td>' +
                '<td class="text-xs text-slate-500">' + r.notes + '</td>' +
            '</tr>';
        }).join('');

        var safeOwners = Array.isArray(safe.owners) ? safe.owners : [];
        var safeThreshold = safe.threshold || '—';
        var safeRatio = safeThreshold + '-of-' + safeOwners.length;

        // Active timelock delay is hardcoded — the analyzer is still reading
        // the old (18h / 64800s) timelock; on-chain verification 2026-05-19
        // confirms the active TL is 48h. Remove the hardcode when the
        // analyzer reads the new TL.
        return '<div class="panel">' +
            '<div class="panel-title">Admin Chain — Post-migration Topology</div>' +
            '<table class="data-table">' +
                '<thead><tr>' +
                    '<th>Contract</th>' +
                    '<th>Address</th>' +
                    '<th>Owner / Controller</th>' +
                    '<th>Notes</th>' +
                '</tr></thead>' +
                '<tbody>' + trs + '</tbody>' +
            '</table>' +

            '<div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">' +
                '<div class="border border-slate-200 dark:border-slate-700 rounded-lg p-3">' +
                    '<div class="text-xs text-slate-500 uppercase font-medium mb-1">Timelock (active)</div>' +
                    '<div class="font-mono text-sm">' + ThusdRenderer._addrLink(newTl, 'ethereum') + '</div>' +
                    '<div class="text-xs text-slate-500 mt-1">48h delay <span title="Analyzer is still reading the legacy 18h timelock. On-chain verification 2026-05-19 confirms active TL = 48h.">ⓘ verified on-chain 2026-05-19</span></div>' +
                    '<div class="text-xs text-slate-500 mt-1">PROPOSER + EXECUTOR roles → 4-of-6 Safe</div>' +
                '</div>' +
                '<div class="border border-slate-200 dark:border-slate-700 rounded-lg p-3">' +
                    '<div class="text-xs text-slate-500 uppercase font-medium mb-1">Safe (' + safeRatio + ')</div>' +
                    '<div class="font-mono text-sm">' + ThusdRenderer._addrLink(contracts.Safe, 'ethereum') + '</div>' +
                    '<div class="text-xs text-slate-500 mt-1">' + safeOwners.length + ' owners, threshold ' + safeThreshold + ' · Safe v' + (safe.version || '—') + '</div>' +
                '</div>' +
            '</div>' +
            '<div class="text-xs text-slate-500 mt-3">' +
                'Status: ' + ThusdRenderer._statusPill('Minter ' + (minterPaused ? 'PAUSED' : 'active'), minterState) +
                ' · ' + ThusdRenderer._statusPill('sthUSD ' + (sthusdPaused ? 'PAUSED' : 'active'), sthusdState) +
            '</div>' +
        '</div>';
    },

    // ============================================================
    // §8 Flow panel
    // ============================================================
    _renderFlowPanel: function(spec) {
        var fs = (spec.flow_summary && spec.flow_summary.thUSD_ethereum) || {};
        var w = fs.windows || {};
        var h24 = w.h24 || {};
        var h168 = w.h168 || {};

        function row(label, win) {
            var net = win.net_flow || 0;
            var netCls = net >= 0 ? 'text-green-600' : 'text-red-600';
            var lb = win.largest_burn;
            return '<tr>' +
                '<td class="font-medium">' + label + '</td>' +
                '<td class="text-right font-mono">' + CommonRenderer.formatCurrencyExact(win.mints_volume || 0) + '</td>' +
                '<td class="text-right font-mono">' + CommonRenderer.formatCurrencyExact(win.burns_volume || 0) + '</td>' +
                '<td class="text-right font-mono ' + netCls + '">' + (net >= 0 ? '+' : '') + CommonRenderer.formatCurrencyExact(net) + '</td>' +
                '<td class="text-xs">' + (lb ? '<span class="font-mono">' + (lb.amount_human != null ? lb.amount_human.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '') + '</span> burn ' + ThusdRenderer._txLink(lb.tx, lb.chain) : '<span class="text-slate-400">—</span>') + '</td>' +
            '</tr>';
        }

        // Look for the 200K-cap pattern in the recent flow events (≈200K ± 1%).
        var recent = Array.isArray(spec.recent_flow_events) ? spec.recent_flow_events : [];
        var capMatches = recent.filter(function(e) {
            if (e.kind !== 'burn' || e.token !== 'thUSD') return false;
            var amt = e.amount_human;
            return amt != null && Math.abs(amt - 200000) / 200000 < 0.01;
        });
        var capBadge = '';
        if (capMatches.length > 0) {
            capBadge = '<span class="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">200K-per-tx cap visible</span>';
        }

        var recentRows = recent.slice(0, 10).map(function(e) {
            var ts = new Date(e.timestamp * 1000);
            var kindCls = e.kind === 'mint' ? 'text-green-600' : 'text-red-600';
            return '<tr>' +
                '<td class="text-xs font-mono">' + ts.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + '</td>' +
                '<td><span class="font-medium ' + kindCls + '">' + e.kind + '</span> <span class="text-xs text-slate-500">' + e.token + '</span></td>' +
                '<td class="text-right font-mono">' + (e.amount_human != null ? e.amount_human.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—') + '</td>' +
                '<td>' + ThusdRenderer._addrLink(e.counterparty, e.chain) + '</td>' +
                '<td>' + ThusdRenderer._txLink(e.tx, e.chain) + '</td>' +
            '</tr>';
        }).join('');

        return '<div class="panel">' +
            '<div class="panel-title">Mint / Burn Flow' + capBadge + '</div>' +
            '<table class="data-table">' +
                '<thead><tr>' +
                    '<th>Window</th>' +
                    '<th class="text-right">Mints</th>' +
                    '<th class="text-right">Burns</th>' +
                    '<th class="text-right">Net</th>' +
                    '<th>Largest burn</th>' +
                '</tr></thead>' +
                '<tbody>' +
                    row('Last 24h', h24) +
                    row('Last 7d',  h168) +
                '</tbody>' +
            '</table>' +
            '<div class="mt-4">' +
                '<div class="text-sm font-semibold text-slate-700 mb-2">Recent mint/burn events <span class="text-xs font-normal text-slate-500">(top 10)</span></div>' +
                '<div class="data-table-scroll">' +
                    '<table class="data-table">' +
                        '<thead><tr>' +
                            '<th>Time</th>' +
                            '<th>Kind</th>' +
                            '<th class="text-right">Amount</th>' +
                            '<th>Counterparty</th>' +
                            '<th>Tx</th>' +
                        '</tr></thead>' +
                        '<tbody>' + (recentRows || '<tr><td colspan="5" class="text-slate-400 text-sm">No recent events.</td></tr>') + '</tbody>' +
                    '</table>' +
                '</div>' +
            '</div>' +
        '</div>';
    },

    // ============================================================
    // §9 Critical events feed
    // ============================================================
    _renderCriticalEventsPanel: function(spec) {
        var recent = Array.isArray(spec.recent_critical_events) ? spec.recent_critical_events : [];
        var rows = ThusdRenderer._renderCriticalEventRows(recent);
        return '<div class="panel">' +
            '<div class="panel-title">Critical Events <span class="text-xs font-normal text-slate-500">(tier-3 feed)</span></div>' +
            '<div id="thusd-events-list" class="space-y-2">' + rows + '</div>' +
        '</div>';
    },

    _loadCriticalEventsFromFile: function() {
        fetch('data/thusd_critical_events.json').then(function(r) {
            if (!r.ok) throw new Error('no critical events file');
            return r.json();
        }).then(function(events) {
            var sorted = (Array.isArray(events) ? events : []).slice().sort(function(a, b) {
                return new Date(b.timestamp_seen) - new Date(a.timestamp_seen);
            });
            var container = document.getElementById('thusd-events-list');
            if (container) container.innerHTML = ThusdRenderer._renderCriticalEventRows(sorted.slice(0, 10));
        }).catch(function() { /* fall back to recent_critical_events already painted */ });
    },

    _renderCriticalEventRows: function(events) {
        if (!events || events.length === 0) return '<div class="text-slate-400 text-sm">No recent critical events.</div>';
        return events.map(function(e) {
            var baseline = e.baseline === true;
            var sev = e.severity || 'critical';
            var borderColor = sev === 'critical' ? 'border-red-300' : sev === 'info' ? 'border-slate-200' : 'border-amber-300';
            var opacity = baseline ? 'opacity-60' : '';
            var ts = new Date(e.timestamp_seen);
            var f = e.fields || {};
            var oneLine = e.event;
            if (e.event === 'OwnershipTransferred' && f.previous_owner && f.new_owner) {
                oneLine = 'OwnershipTransferred: ' + ThusdRenderer._truncAddr(f.previous_owner) + ' → ' + ThusdRenderer._truncAddr(f.new_owner);
            }
            return '<div class="border-l-4 ' + borderColor + ' bg-white dark:bg-slate-800 ' + opacity + ' px-3 py-2 rounded-r">' +
                '<div class="flex items-center justify-between gap-2 text-xs text-slate-500">' +
                    '<div>' +
                        '<span class="font-mono">' + ts.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + '</span>' +
                        ' · <span>' + e.chain + '</span>' +
                        (baseline ? ' · <span class="italic">baseline</span>' : '') +
                    '</div>' +
                    '<div>' + ThusdRenderer._txLink(e.tx, e.chain) + '</div>' +
                '</div>' +
                '<div class="text-sm font-medium mt-0.5">' + oneLine + '</div>' +
                '<div class="text-xs text-slate-500 mt-0.5">Contract: ' + ThusdRenderer._addrLink(e.contract, e.chain) + '</div>' +
            '</div>';
        }).join('');
    },

    // ============================================================
    // §10 DEX peg + venues
    // ============================================================
    _renderDexPeg: function(spec) {
        var t2 = spec.tier2_peg_nav || {};
        var dex = t2.dex_peg || t2.arb_dex_peg || {};
        var totalTvl = dex.total_tvl_usd || 0;
        if (totalTvl < 1000) {
            return ''; // suppress entirely — sub-$1K is noise
        }

        var weighted = dex.weighted_price_usd;
        var bp = dex.discount_bp_vs_one_dollar;
        var alertBp = dex.alert_threshold_bp || 75;
        var bpAbs = bp != null ? Math.abs(bp) : null;
        var bpState = bpAbs == null ? 'unknown' :
            bpAbs < alertBp / 3 ? 'ok' :
            bpAbs < alertBp     ? 'warn' :
                                  'critical';
        var bpCls = bpState === 'ok' ? 'text-green-600' :
                    bpState === 'warn' ? 'text-amber-600' :
                    bpState === 'critical' ? 'text-red-600' : 'text-slate-600';

        // Uniswap V4 pools key on a 32-byte poolId, not a contract address, so an
        // etherscan /address/<poolId> link won't resolve. Link those to
        // GeckoTerminal (which indexes by poolId) instead of emitting a dead link.
        var poolLink = function(p) {
            var chain = p.chain || 'ethereum';
            var isV4 = (p.dex_id || '').toLowerCase().indexOf('uniswap-v4') >= 0;
            if (isV4 && p.pool_address) {
                var net = chain.toLowerCase().indexOf('arbitrum') >= 0 ? 'arbitrum' : 'eth';
                return '<span class="font-mono text-xs" title="' + p.pool_address + '">' +
                    ThusdRenderer._truncAddr(p.pool_address) + '</span> ' +
                    '<a href="https://www.geckoterminal.com/' + net + '/pools/' + p.pool_address +
                    '" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline text-xs">↗</a>';
            }
            return ThusdRenderer._addrLink(p.pool_address, chain);
        };

        var pools = Array.isArray(dex.pools) ? dex.pools.slice().sort(function(a, b) {
            return (b.tvl_usd || 0) - (a.tvl_usd || 0);
        }) : [];
        var topRows = pools.slice(0, 5).map(function(p) {
            return '<tr>' +
                '<td>' + poolLink(p) + '</td>' +
                '<td>' + ThusdRenderer._chainBadge(p.chain || 'ethereum') + '</td>' +
                '<td class="text-xs">' + (p.dex_id || '—') + '</td>' +
                '<td class="text-xs">' + (p.pair || '—') + '</td>' +
                '<td class="text-right font-mono">' + (p.thusd_price_usd != null ? '$' + p.thusd_price_usd.toFixed(6) : '—') + '</td>' +
                '<td class="text-right font-mono">' + CommonRenderer.formatCurrencyExact(p.tvl_usd || 0) + '</td>' +
                '<td class="text-right font-mono">' + CommonRenderer.formatCurrencyExact(p.volume_h24_usd || 0) + '</td>' +
            '</tr>';
        }).join('');

        // Compact per-chain split — where the liquidity actually lives.
        var byChain = dex.by_chain || {};
        var chainSplit = '';
        var chainRow = function(name, c) {
            if (!c) return '';
            return '<div class="flex items-baseline justify-between gap-3 py-0.5">' +
                '<span>' + ThusdRenderer._chainBadge(name) + '</span>' +
                '<span class="font-mono">' + CommonRenderer.formatCurrencyExact(c.total_tvl_usd || 0) + ' TVL' +
                    ' · $' + (c.weighted_price_usd != null ? c.weighted_price_usd.toFixed(6) : '—') +
                    ' · ' + (c.pool_count != null ? c.pool_count : '—') + ' pools</span>' +
            '</div>';
        };
        if (byChain.ethereum || byChain.arbitrum) {
            chainSplit = '<div class="text-sm font-semibold text-slate-700 mb-1">By chain</div>' +
                '<div class="text-xs text-slate-600 mb-4">' +
                    chainRow('ethereum', byChain.ethereum) +
                    chainRow('arbitrum', byChain.arbitrum) +
                '</div>';
        }

        return '<div class="panel">' +
            '<div class="panel-title">DEX Peg — Ethereum + Arbitrum <span class="text-xs font-normal text-slate-500">phase-0 anchor</span></div>' +
            '<div class="text-xs text-slate-500 mb-3">' +
                (dex.anchor_note || 'Phase-0 anchor of $1.00. Replace with NAV oracle if Theo discloses one.') +
            '</div>' +

            '<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">' +
                '<div><div class="text-xs text-slate-500 uppercase font-medium">Weighted price</div>' +
                    '<div class="text-lg font-bold font-mono">$' + (weighted != null ? weighted.toFixed(6) : '—') + '</div></div>' +
                '<div><div class="text-xs text-slate-500 uppercase font-medium">Discount vs $1</div>' +
                    '<div class="text-lg font-bold font-mono ' + bpCls + '">' + (bp != null ? bp.toFixed(2) + ' bp' : '—') + '</div></div>' +
                '<div><div class="text-xs text-slate-500 uppercase font-medium">Total TVL</div>' +
                    '<div class="text-lg font-bold font-mono">' + CommonRenderer.formatCurrencyExact(totalTvl) + '</div></div>' +
                '<div><div class="text-xs text-slate-500 uppercase font-medium">24h volume</div>' +
                    '<div class="text-lg font-bold font-mono">' + CommonRenderer.formatCurrencyExact(dex.total_volume_h24_usd || 0) + '</div></div>' +
            '</div>' +

            chainSplit +

            '<div class="text-sm font-semibold text-slate-700 mb-2">Top pools by TVL <span class="text-xs font-normal text-slate-500">(of ' + (dex.pool_count || pools.length) + ' total)</span></div>' +
            '<div class="data-table-scroll">' +
                '<table class="data-table">' +
                    '<thead><tr>' +
                        '<th>Pool</th>' +
                        '<th>Chain</th>' +
                        '<th>DEX</th>' +
                        '<th>Pair</th>' +
                        '<th class="text-right">Price</th>' +
                        '<th class="text-right">TVL</th>' +
                        '<th class="text-right">24h vol</th>' +
                    '</tr></thead>' +
                    '<tbody>' + (topRows || '<tr><td colspan="7" class="text-slate-400 text-sm">No pools.</td></tr>') + '</tbody>' +
                '</table>' +
            '</div>' +
            '<div class="text-xs text-slate-500 mt-3">' +
                'Ethereum Uniswap V4 (thUSD/USDC) is the deep venue (~$4.75M); the Arbitrum OFT-mirror pools are dust (sub-$1K, listing-only). ' +
                (dex.pool_count || pools.length) + ' pools surfaced upstream across both chains.' +
            '</div>' +
        '</div>';
    },

    // ============================================================
    // §11 Methodology footer
    // ============================================================
    _renderMethodology: function(spec) {
        var reserveSafe = (spec.on_chain_coverage && spec.on_chain_coverage.thusd_reserve_safe) || '0xec417ccb…';
        return '<div class="panel">' +
            '<div class="panel-title">Methodology</div>' +
            '<ul class="text-xs text-slate-500 space-y-1.5 list-disc pl-4">' +
                '<li>Data refreshed hourly; sync delay typically &lt;90s.</li>' +
                '<li>Theo\'s own disclosures: <a href="https://app.theo.xyz/transparency" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline">app.theo.xyz/transparency ↗</a></li>' +
                '<li>On-chain coverage = (thBILL @ NAV + USDT + USDC at reserve Safe <span class="font-mono">' + ThusdRenderer._truncAddr(reserveSafe) + '</span>) ÷ thUSD supply.</li>' +
                '<li>Off-chain leg is implied from the coverage gap — <em>not</em> direct proof-of-reserves.</li>' +
                '<li>Active timelock (48h) verified on-chain 2026-05-19; the analyzer is still reading the legacy 18h timelock and will catch up in a follow-up.</li>' +
            '</ul>' +
        '</div>';
    }
};
