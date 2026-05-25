/**
 * Ethena renderer — USDe (synthetic dollar) + sUSDe (staking vault).
 *
 * Single renderer registered for both slugs. USDe and sUSDe are backed by
 * the SAME reserve pool (sUSDe is staked USDe), so the custody / DeFi /
 * CEX-hedge / attestation panels are identical on both pages and are
 * sourced from the shared family JSON. Asset-specific divergence lives in:
 *   - asset_specific.type ('usde' | 'susde')
 *   - _renderHeadlineCard (coverage frame vs vault/NAV frame)
 *   - _renderSusdeVaultPanel + NAV trajectory (sUSDe only)
 *
 * Data sources:
 *   - data/usde_backing.json   + data/usde_backing_history.json
 *   - data/susde_backing.json  + data/susde_backing_history.json
 *   - data/ethena_family.json  (async — custody breakdown, DeFi drill-down,
 *                               Coinbase wallets, CEX hedge, attestation,
 *                               risk flags; shared by both pages)
 *
 * Modeled on js/renderers/apyx.js — same _suppressCommonPanels approach,
 * same preRender backfill, same async family-panel + anchor-nav patterns.
 *
 * IMPORTANT on data semantics (from ethena_family.json `notes`):
 *   - custody_breakdown sums to LlamaRisk "Unallocated" (Liquid Cash);
 *     custody + cex_hedge ≈ total_backing.
 *   - defi_protocol_breakdown is a DRILL-DOWN of the Coinbase Onchain
 *     Wallets custody slice, NOT additive to total backing. The DeFi panel
 *     must frame it that way so viewers don't double-count.
 *
 * Constants are ETHENA_-prefixed per the renderer global-scope convention
 * (bare names like EDITORIAL_LIQUIDITY collide at load across renderers).
 */

// Custody-venue palette (handoff §2). Keyed by the exact `venue` strings the
// analyzer emits; unknown venues fall back to slate.
var ETHENA_CUSTODY_COLORS = {
    'Coinbase Onchain Wallets':  '#3b82f6',
    'Copper':                    '#f59e0b',
    'Anchorage Digital Bank':    '#10b981',
    'Ceffu':                     '#eab308',
    'Kraken Custody':            '#a855f7',
    'Unattributed Liquid Cash':  '#94a3b8',
    'MintRedeem Contract':       '#64748b',
    'Reserve Fund (on-chain)':   '#475569'
};

var ETHENA_PROTOCOL_COLORS = {
    'Aave V3':   '#9333ea',
    'Morpho':    '#06b6d4',
    'Pendle':    '#f59e0b',
    'Sky':       '#22c55e',
    'Spark':     '#3b82f6',
    'Compound':  '#10b981',
    'LIDO':      '#64748b',
    'Merkl':     '#ec4899',
    'MantleETH': '#14b8a6'
};

var ETHENA_CEX_COLORS = {
    'Binance':  '#f59e0b',
    'Bybit':    '#3b82f6',
    'INTX':     '#06b6d4',
    'OKX':      '#22c55e',
    'Deribit':  '#a855f7'
};

var ETHENA_THRESHOLDS = {
    cex_concentration_warn:      70.0,   // % of hedge in one venue
    cex_concentration_critical:  90.0,
    defi_aave_concentration_warn: 65.0,  // % of wallet DeFi in one protocol
    attestation_stale_days:      45,
    coverage_floor:              100.0   // % — par
};

var ETHENA_OFFICIAL_DASHBOARD = 'https://app.ethena.fi/dashboards/transparency';

var EthenaRenderer = {

    // ============================================================
    // helpers
    // ============================================================
    _isEthena: function(t) { return t === 'usde' || t === 'susde'; },

    // Compact USD with a B tier — common.formatCurrency caps at M, which
    // reads as "$4451.9M" for a $4.5B asset. Headline numbers want B.
    _money: function(num) {
        if (num === null || num === undefined) return '-';
        var a = Math.abs(num);
        if (a >= 1e9) return '$' + (num / 1e9).toFixed(2) + 'B';
        if (a >= 1e6) return '$' + (num / 1e6).toFixed(1) + 'M';
        if (a >= 1e3) return '$' + (num / 1e3).toFixed(1) + 'K';
        return '$' + num.toFixed(0);
    },

    _truncAddr: function(addr) {
        if (!addr) return '-';
        return addr.slice(0, 6) + '…' + addr.slice(-4);
    },

    _explorerLink: function(addr) {
        if (!addr) return '';
        return '<a href="https://etherscan.io/address/' + addr + '" target="_blank" rel="noopener noreferrer" ' +
            'class="text-blue-500 hover:underline text-xs" title="' + addr + '">↗</a>';
    },

    _debankLink: function(addr) {
        if (!addr) return '';
        return '<a href="https://debank.com/profile/' + addr + '" target="_blank" rel="noopener noreferrer" ' +
            'class="text-blue-500 hover:underline text-xs">DeBank ↗</a>';
    },

    _addrCell: function(addr) {
        if (!addr) return '<span class="text-slate-400">-</span>';
        return '<span class="font-mono text-xs" title="' + addr + '">' +
            EthenaRenderer._truncAddr(addr) + '</span> ' + EthenaRenderer._explorerLink(addr);
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
        if (state === 'ok') { bg = 'bg-green-100'; fg = 'text-green-800'; }
        else if (state === 'warn') { bg = 'bg-amber-100'; fg = 'text-amber-800'; }
        else if (state === 'critical') { bg = 'bg-red-100'; fg = 'text-red-800'; }
        else { bg = 'bg-slate-100'; fg = 'text-slate-700'; }
        return '<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ' + bg + ' ' + fg + '">' +
            EthenaRenderer._statusDot(state) +
            '<span>' + label + (extra ? ' <span class="font-mono">' + extra + '</span>' : '') + '</span>' +
        '</span>';
    },

    // Inject an id into a panel's outer div so the anchor nav can jump to it.
    _anchor: function(id, html) {
        if (!html || typeof html !== 'string') return html;
        return html.replace(/^(<div class="panel")/, '<div id="' + id + '" class="panel"');
    },

    // Map a custody-slice `source` string to a scannable freshness badge.
    // `asOf` is the attestation snapshot date label (e.g. "Apr 25").
    _custodySourceBadge: function(source, asOf) {
        if (!source) return EthenaRenderer._statusPill('—', 'neutral');
        if (source.indexOf('live') === 0) {
            var via = source.indexOf('debank') >= 0 ? 'DeBank' : 'on-chain';
            return EthenaRenderer._statusPill('Live · ' + via, 'ok');
        }
        if (source.indexOf('attestation') === 0) {
            return EthenaRenderer._statusPill('Attestation · ' + (asOf || 'monthly'), 'warn');
        }
        if (source.indexOf('residual') === 0) {
            return EthenaRenderer._statusPill('Derived (residual)', 'neutral');
        }
        return EthenaRenderer._statusPill(source, 'neutral');
    },

    _pegState: function(pct) { return CommonRenderer.pegStatusClass(pct); },

    // Downsample a long history array to ~maxPts evenly-spaced points so
    // charts stay responsive as the hourly feed accumulates.
    _downsample: function(arr, maxPts) {
        if (!arr || arr.length <= maxPts) return arr || [];
        var step = Math.ceil(arr.length / maxPts);
        var out = [];
        for (var i = 0; i < arr.length; i += step) out.push(arr[i]);
        if (out[out.length - 1] !== arr[arr.length - 1]) out.push(arr[arr.length - 1]);
        return out;
    },

    // ============================================================
    // pre-render — runs before common.js paints summary cards / chart.
    // ============================================================
    // The Ethena JSONs don't carry the common schema (collateral_ratio_alt,
    // backing_breakdown, surplus_deficit). Synthesize the minimum so
    // common.js doesn't NPE; we suppress those common panels in render().
    // For USDe we ALSO remap the history series so the common CR chart
    // becomes a Coverage Ratio (incl. Reserve Fund) chart — free, fully
    // featured time-series. For sUSDe the common chart is hidden (NAV isn't
    // a %; we draw a dedicated NAV trajectory in the vault panel).
    preRender: function(data, history) {
        var specific = data.asset_specific || {};
        if (!EthenaRenderer._isEthena(specific.type)) return;
        var s = data.summary;
        if (!s) return;

        if (!s.collateral_ratio_alt) {
            s.collateral_ratio_alt = { label: '_ethenaAlt', value: 0, is_currency: false };
        }
        specific.card_overrides = specific.card_overrides || {};
        specific.card_overrides['_ethenaAlt'] = { hidden: true };
        specific.card_overrides['Surplus / Deficit'] = { hidden: true };

        if (!Array.isArray(data.backing_breakdown)) data.backing_breakdown = [];

        if (specific.type === 'usde' && history && Array.isArray(history.entries)) {
            // Remap coverage (ratio) → collateral_ratio (%) so common.js plots it.
            history.entries.forEach(function(e) {
                if (e.coverage_ratio_with_reserve_fund != null) {
                    e.collateral_ratio = e.coverage_ratio_with_reserve_fund * 100;
                } else if (e.coverage_ratio != null) {
                    e.collateral_ratio = e.coverage_ratio * 100;
                }
                // single line — leave collateral_ratio_alt unset so common drops it
            });
            specific.chart_title = 'Coverage Ratio History (incl. Reserve Fund)';
            specific.chart_dataset_label = 'Coverage %';
            specific.chart_y_min = 98;
            specific.chart_y_max = 104;
            specific.chart_bands = {
                critical: [0, 99.5],
                thin:     [99.5, 100],
                amber:    [100, 100.5],
                healthy:  [100.5, 200],
                min_line: 100,
                max_line: null
            };
        }
    },

    // ============================================================
    // entry point
    // ============================================================
    render: function(data) {
        var container = document.getElementById('asset-specific-panels');
        if (!container) return;
        var specific = data.asset_specific || {};
        if (!EthenaRenderer._isEthena(specific.type)) return;

        var slug = data.asset_slug;
        var s = data.summary;

        EthenaRenderer._suppressCommonPanels(data, slug);

        var anc = EthenaRenderer._anchor;
        var html = '';
        html += anc('panel-headline', EthenaRenderer._renderHeadlineCard(data, slug));
        // Async-filled placeholders (all from ethena_family.json):
        html += '<div id="ethena-custody-panel"></div>';
        html += '<div id="ethena-defi-panel"></div>';
        html += '<div id="ethena-wallets-panel"></div>';
        html += '<div id="ethena-cex-panel"></div>';
        if (slug === 'susde') {
            html += anc('panel-vault', EthenaRenderer._renderSusdeVaultPanel(specific, s));
        }
        html += '<div id="ethena-attestation-panel"></div>';
        html += '<div id="ethena-riskflags-panel"></div>';
        html += '<div id="ethena-family-panel"></div>';

        container.innerHTML = html;

        EthenaRenderer._setupAnchorNav(slug);
        EthenaRenderer._setupCompanionLink(slug);

        // Post-DOM charts / async fills.
        if (slug === 'susde') EthenaRenderer._loadSusdeNavChart(slug);
        EthenaRenderer._loadFamily(slug);
    },

    _suppressCommonPanels: function(data, slug) {
        // Drop the common top summary-card strip — the §1 Headline carries
        // richer per-asset metrics.
        var summaryCards = document.getElementById('summary-cards');
        if (summaryCards) summaryCards.style.display = 'none';

        // Hide the empty common breakdown table + pie (we backfilled [] ).
        var bd = document.getElementById('breakdown-table');
        if (bd) { var p = bd.closest('.panel'); if (p) p.style.display = 'none'; }
        var pie = document.getElementById('pie-chart');
        if (pie) { var p2 = pie.closest('.panel'); if (p2) p2.style.display = 'none'; }

        // Hide the common risk-flags panel — we render the real (family-sourced)
        // flags in §8. The per-asset risk_flags array is empty; the meaningful
        // flags (e.g. Aave DeFi concentration) live in ethena_family.json.
        var risk = document.getElementById('risk-flags');
        if (risk) { var rp = risk.closest('.panel'); if (rp) rp.style.display = 'none'; }

        // sUSDe: hide the common CR chart (NAV isn't a %; dedicated NAV chart
        // lives in the vault panel). USDe keeps it — repurposed as Coverage.
        if (slug === 'susde') {
            var chartPanel = document.getElementById('chart-panel');
            if (chartPanel) chartPanel.style.display = 'none';
        }
    },

    _setupAnchorNav: function(slug) {
        var navEl = document.getElementById('asset-anchor-nav');
        var inner = document.getElementById('asset-anchor-nav-inner');
        if (!navEl || !inner) return;

        var items = [{ id: 'panel-headline', label: 'Asset' }];
        if (slug === 'usde') items.unshift({ id: 'chart-panel', label: 'Coverage' });
        items.push({ id: 'ethena-custody-panel', label: 'Custody' });
        items.push({ id: 'ethena-defi-panel',    label: 'DeFi' });
        items.push({ id: 'ethena-wallets-panel', label: 'Wallets' });
        items.push({ id: 'ethena-cex-panel',     label: 'CEX hedge' });
        if (slug === 'susde') items.push({ id: 'panel-vault', label: 'Vault' });
        items.push({ id: 'ethena-attestation-panel', label: 'Attestation' });
        items.push({ id: 'ethena-family-panel',       label: 'Family' });

        inner.innerHTML = items.map(function(item) {
            return '<a href="#' + item.id + '" ' +
                'class="text-slate-600 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400 px-2 py-0.5 rounded transition-colors">' +
                item.label + '</a>';
        }).join('');
        navEl.classList.remove('hidden');
    },

    _setupCompanionLink: function(slug) {
        var link = document.getElementById('header-companion-link');
        if (!link) return;
        var sibling, label;
        if (slug === 'usde') { sibling = 'susde'; label = 'View sUSDe ↗'; }
        else if (slug === 'susde') { sibling = 'usde'; label = 'View USDe ↗'; }
        else return;
        link.setAttribute('href', '?asset=' + sibling);
        link.textContent = label;
        link.classList.remove('hidden');
    },

    // ============================================================
    // §1 Headline card
    // ============================================================
    _renderHeadlineCard: function(data, slug) {
        var s = data.summary;
        var specific = data.asset_specific || {};
        var pausedState = s.paused ? 'critical' : 'ok';
        var pausedLabel = s.paused ? 'PAUSED' : 'Active';

        var titleRow, metricsRow, sub;

        if (slug === 'usde') {
            var covWithRf = (s.coverage_ratio_with_reserve_fund != null) ? s.coverage_ratio_with_reserve_fund * 100 : null;
            var covBase = (s.coverage_ratio != null) ? s.coverage_ratio * 100 : null;
            var covCls = (covWithRf != null && covWithRf >= ETHENA_THRESHOLDS.coverage_floor) ? 'text-green-600' : 'text-red-600';
            var pegPct = (specific.peg && specific.peg.premium_discount_pct != null) ? specific.peg.premium_discount_pct : null;
            var pegState = EthenaRenderer._pegState(pegPct);

            titleRow = '<div class="text-xl font-bold text-slate-800">USDe</div>' +
                '<div class="text-xs text-slate-500 mt-1">Ethena · Synthetic dollar (delta-hedged ETH/BTC + stables)</div>';
            metricsRow =
                '<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">' +
                    '<div><div class="text-xs text-slate-400 font-medium uppercase">Supply</div>' +
                        '<div class="text-lg font-bold text-slate-800">' + EthenaRenderer._money(s.total_supply) + '</div></div>' +
                    '<div><div class="text-xs text-slate-400 font-medium uppercase">Coverage (incl. RF)</div>' +
                        '<div class="text-lg font-bold ' + covCls + '">' + CommonRenderer.formatPercent(covWithRf, 2) + '</div>' +
                        '<div class="text-xs text-slate-500 mt-0.5">' + CommonRenderer.formatPercent(covBase, 2) + ' without RF</div></div>' +
                    '<div><div class="text-xs text-slate-400 font-medium uppercase">Peg</div>' +
                        '<div class="text-lg font-bold ' + CommonRenderer.pegPctClass(pegState) + '">$' + (s.price != null ? s.price.toFixed(4) : '-') + '</div>' +
                        '<div class="text-xs ' + CommonRenderer.pegPctClass(pegState) + ' mt-0.5">' + CommonRenderer.pegPctText(pegPct) + ' · ' + CommonRenderer.pegStatusLabel(pegState) + '</div></div>' +
                    '<div><div class="text-xs text-slate-400 font-medium uppercase">Status</div>' +
                        '<div class="text-lg">' + EthenaRenderer._statusPill(pausedLabel, pausedState) + '</div></div>' +
                '</div>';
            sub = 'Total backing ' + EthenaRenderer._money(s.total_backing) +
                ' · Reserve Fund ' + EthenaRenderer._money(s.reserve_fund_usd);
        } else {
            // sUSDe — vault / NAV frame
            var vs = specific.vault_state || {};
            var nav = (vs.nav_usde_per_share != null) ? vs.nav_usde_per_share : s.nav;
            var assets = (vs.total_assets_usde != null) ? vs.total_assets_usde : s.total_assets_usde;
            var mkt = (specific.peg && specific.peg.market_price != null) ? specific.peg.market_price : s.price;
            var navP = (specific.peg && specific.peg.nav_usde_per_share != null) ? specific.peg.nav_usde_per_share : nav;
            var disc = (mkt != null && navP) ? ((mkt - navP) / navP * 100) : null;
            var discState = EthenaRenderer._pegState(disc);

            titleRow = '<div class="text-xl font-bold text-slate-800">sUSDe</div>' +
                '<div class="text-xs text-slate-500 mt-1">Ethena · Staked USDe (ERC-4626 yield vault)</div>';
            metricsRow =
                '<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">' +
                    '<div><div class="text-xs text-slate-400 font-medium uppercase">Vault assets</div>' +
                        '<div class="text-lg font-bold text-slate-800">' + EthenaRenderer._money(assets) + '</div>' +
                        '<div class="text-xs text-slate-500 mt-0.5">USDe staked</div></div>' +
                    '<div><div class="text-xs text-slate-400 font-medium uppercase">NAV / share</div>' +
                        '<div class="text-lg font-bold text-slate-800">' + (nav != null ? nav.toFixed(4) : '-') +
                        '<span class="text-xs text-slate-400 font-normal ml-1">USDe</span></div></div>' +
                    '<div><div class="text-xs text-slate-400 font-medium uppercase">Market price</div>' +
                        '<div class="text-lg font-bold ' + CommonRenderer.pegPctClass(discState) + '">$' + (mkt != null ? mkt.toFixed(4) : '-') + '</div>' +
                        '<div class="text-xs ' + CommonRenderer.pegPctClass(discState) + ' mt-0.5">' + CommonRenderer.pegPctText(disc) + ' vs NAV</div></div>' +
                    '<div><div class="text-xs text-slate-400 font-medium uppercase">Status</div>' +
                        '<div class="text-lg">' + EthenaRenderer._statusPill(pausedLabel, pausedState) + '</div></div>' +
                '</div>';
            sub = 'Shares outstanding ' + (s.total_supply != null ? s.total_supply.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '-') +
                ' · backed by the same reserve pool as USDe (see Custody below)';
        }

        return '<div class="panel">' +
            '<div class="flex items-start justify-between gap-4">' +
                '<div>' + titleRow + '</div>' +
                '<div class="text-right text-xs">' +
                    '<a href="' + ETHENA_OFFICIAL_DASHBOARD + '" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline">Ethena transparency dashboard ↗</a>' +
                    '<div class="text-slate-400 mt-1 max-w-[15rem]">This view adds a per-protocol DeFi breakdown, risk-flag aggregation, and historical coverage Ethena\'s does not expose.</div>' +
                '</div>' +
            '</div>' +
            metricsRow +
            '<div class="text-xs text-slate-500 mt-3">' + sub + '</div>' +
        '</div>';
    },

    // ============================================================
    // §6a sUSDe vault panel (sUSDe only)
    // ============================================================
    _renderSusdeVaultPanel: function(specific, s) {
        var vs = specific.vault_state || {};
        var nav = (vs.nav_usde_per_share != null) ? vs.nav_usde_per_share : s.nav;
        var assets = (vs.total_assets_usde != null) ? vs.total_assets_usde : s.total_assets_usde;
        var shares = (vs.total_supply_shares != null) ? vs.total_supply_shares : s.total_supply;

        return '<div class="panel">' +
            '<div class="panel-title">sUSDe Vault</div>' +
            '<div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">' +
                '<div class="summary-card"><div class="card-label">Total assets</div>' +
                    '<div class="card-value">' + EthenaRenderer._money(assets) + '</div>' +
                    '<div class="text-xs text-slate-400 mt-1">USDe held by the vault</div></div>' +
                '<div class="summary-card"><div class="card-label">NAV / share</div>' +
                    '<div class="card-value">' + (nav != null ? nav.toFixed(6) : '-') + '</div>' +
                    '<div class="text-xs text-slate-400 mt-1">USDe per sUSDe (convertToAssets)</div></div>' +
                '<div class="summary-card"><div class="card-label">Shares</div>' +
                    '<div class="card-value">' + (shares != null ? (shares / 1e6).toFixed(1) + 'M' : '-') + '</div>' +
                    '<div class="text-xs text-slate-400 mt-1">sUSDe outstanding</div></div>' +
            '</div>' +
            '<div class="chart-container" style="height:240px;position:relative;"><canvas id="ethena-susde-nav-chart"></canvas></div>' +
            '<div class="text-xs text-slate-400 mt-2">NAV rises as staking yield accrues; sUSDe→USDe unstaking is subject to a cooldown. ' +
            'Cooldown-queue depth is not exposed in the current feed.</div>' +
        '</div>';
    },

    _loadSusdeNavChart: function(slug) {
        var nocache = Math.floor(Date.now() / 60000);
        fetch('data/susde_backing_history.json?nocache=' + nocache)
            .then(function(r) { return r.ok ? r.json() : null; })
            .then(function(hist) {
                var ctx = document.getElementById('ethena-susde-nav-chart');
                if (!ctx || typeof Chart === 'undefined' || !hist || !Array.isArray(hist.entries) || hist.entries.length < 2) return;
                var entries = EthenaRenderer._downsample(hist.entries, 200);
                var labels = entries.map(function(e) { return new Date(e.timestamp.endsWith('Z') ? e.timestamp : e.timestamp + 'Z'); });
                var navSeries = entries.map(function(e) { return (e.nav != null) ? e.nav : e.theoretical_price; });
                var mktSeries = entries.map(function(e) { return e.market_price; });

                if (window._ethenaNavChart) window._ethenaNavChart.destroy();
                window._ethenaNavChart = new Chart(ctx, {
                    type: 'line',
                    data: { labels: labels, datasets: [
                        { label: 'NAV (USDe/share)', data: navSeries, borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.08)', fill: false, tension: 0.25, pointRadius: 0, borderWidth: 2 },
                        { label: 'Market price', data: mktSeries, borderColor: '#3b82f6', backgroundColor: 'transparent', borderDash: [4, 3], tension: 0.25, pointRadius: 0, borderWidth: 2 }
                    ]},
                    options: {
                        responsive: true, maintainAspectRatio: false,
                        scales: {
                            x: { type: 'time', time: { unit: 'day', displayFormats: { day: 'MMM d' } }, grid: { display: false }, ticks: { maxTicksLimit: 8, font: { size: 11 } } },
                            y: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 11 } } }
                        },
                        plugins: { legend: { display: true, position: 'top', labels: { boxWidth: 12, font: { size: 11 } } },
                            tooltip: { callbacks: { label: function(c) { return c.dataset.label + ': ' + (c.raw != null ? c.raw.toFixed(4) : '—'); } } } },
                        interaction: { intersect: false, mode: 'index' }
                    }
                });
            })
            .catch(function() {});
    },

    // ============================================================
    // family JSON — fills custody / DeFi / wallets / CEX / attestation /
    // risk / family panels (all shared by both slugs).
    // ============================================================
    _loadFamily: function(slug) {
        var nocache = Math.floor(Date.now() / 60000);
        fetch('data/ethena_family.json?nocache=' + nocache)
            .then(function(r) { return r.ok ? r.json() : null; })
            .then(function(fam) {
                if (!fam) { EthenaRenderer._familyUnavailable(); return; }
                EthenaRenderer._fillCustody(fam);
                EthenaRenderer._fillDefi(fam);
                EthenaRenderer._fillWallets(fam);
                EthenaRenderer._fillCex(fam);
                EthenaRenderer._fillAttestation(fam);
                EthenaRenderer._fillRiskFlags(fam);
                EthenaRenderer._fillFamily(fam, slug);
                // charts (canvases now exist)
                EthenaRenderer._drawDefiDonut(fam);
                EthenaRenderer._drawCustodyDonut(fam);
                EthenaRenderer._loadFamilyTrendChart();
            })
            .catch(function() { EthenaRenderer._familyUnavailable(); });
    },

    _familyUnavailable: function() {
        var el = document.getElementById('ethena-custody-panel');
        if (el) el.innerHTML = '<div class="panel"><div class="panel-title">Backing Composition</div>' +
            '<div class="risk-flag risk-warning">Shared backing data (ethena_family.json) is not available in this snapshot.</div></div>';
    },

    _set: function(id, html) { var el = document.getElementById(id); if (el) el.innerHTML = html; },

    // ----- §2 Custody breakdown -----
    _fillCustody: function(fam) {
        var rows = (fam.custody_breakdown || []).slice();
        var asOf = EthenaRenderer._attestAsOf(fam);
        var total = rows.reduce(function(a, r) { return a + (r.usd || 0); }, 0);

        // Horizontal stacked bar.
        var segs = rows.map(function(r) {
            var color = ETHENA_CUSTODY_COLORS[r.venue] || '#94a3b8';
            return '<div style="width:' + (r.pct || 0) + '%;background:' + color + '" title="' + r.venue + ': ' + CommonRenderer.formatCurrencyExact(r.usd) + ' (' + (r.pct || 0) + '%)"></div>';
        }).join('');
        var bar = '<div class="flex w-full h-7 rounded overflow-hidden mb-4" style="gap:1px;background:#e2e8f0">' + segs + '</div>';

        var tbody = rows.map(function(r) {
            var color = ETHENA_CUSTODY_COLORS[r.venue] || '#94a3b8';
            return '<tr>' +
                '<td class="font-medium"><span class="inline-block w-2.5 h-2.5 rounded-sm mr-2 align-middle" style="background:' + color + '"></span>' + r.venue + '</td>' +
                '<td>' + EthenaRenderer._custodySourceBadge(r.source, asOf) + '</td>' +
                '<td class="text-right font-mono">' + CommonRenderer.formatCurrencyExact(r.usd) + '</td>' +
                '<td class="text-right font-mono">' + (r.pct != null ? r.pct.toFixed(2) : '-') + '%</td>' +
            '</tr>';
        }).join('');
        tbody += '<tr class="font-bold border-t-2 border-slate-200"><td>Total (Liquid Cash)</td><td></td>' +
            '<td class="text-right font-mono">' + CommonRenderer.formatCurrencyExact(total) + '</td><td class="text-right">100%</td></tr>';

        EthenaRenderer._set('ethena-custody-panel',
            '<div class="panel">' +
                '<div class="panel-title">Backing Composition by Custody Venue</div>' +
                '<div class="text-xs text-slate-500 mb-3">Where the reserves sit. ' +
                    '<span class="font-medium">Live</span> slices are read on-chain / via DeBank each hour; ' +
                    '<span class="font-medium">Attestation</span> slices are from Ethena\'s monthly custodian attestation (' + (asOf || 'snapshot') + ') and refresh monthly. ' +
                    'CEX hedge collateral (' + EthenaRenderer._money(fam.cex_hedge_total_usd) + ') is shown separately below.</div>' +
                bar +
                '<table class="data-table"><thead><tr><th>Venue</th><th>Source</th><th class="text-right">Value (USD)</th><th class="text-right">%</th></tr></thead>' +
                '<tbody>' + tbody + '</tbody></table>' +
                '<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 items-center">' +
                    '<div class="md:col-span-1" style="height:180px;position:relative;"><canvas id="ethena-custody-donut"></canvas></div>' +
                    '<div class="md:col-span-2 text-xs text-slate-400">' + (fam.notes && fam.notes.custody_vs_total ? fam.notes.custody_vs_total : '') + '</div>' +
                '</div>' +
            '</div>');
    },

    _drawCustodyDonut: function(fam) {
        var ctx = document.getElementById('ethena-custody-donut');
        if (!ctx || typeof Chart === 'undefined') return;
        var rows = (fam.custody_breakdown || []).filter(function(r) { return (r.usd || 0) > 0; });
        if (window._ethenaCustodyDonut) window._ethenaCustodyDonut.destroy();
        window._ethenaCustodyDonut = new Chart(ctx, {
            type: 'doughnut',
            data: { labels: rows.map(function(r) { return r.venue; }),
                datasets: [{ data: rows.map(function(r) { return r.usd; }),
                    backgroundColor: rows.map(function(r) { return ETHENA_CUSTODY_COLORS[r.venue] || '#94a3b8'; }), borderWidth: 0 }] },
            options: { responsive: true, maintainAspectRatio: false, cutout: '55%',
                plugins: { legend: { display: false },
                    tooltip: { callbacks: { label: function(c) {
                        var t = c.dataset.data.reduce(function(a, b) { return a + b; }, 0);
                        return c.label + ': ' + CommonRenderer.formatCurrencyExact(c.raw) + ' (' + (t > 0 ? (c.raw / t * 100).toFixed(1) : '0') + '%)';
                    } } } } }
        });
    },

    // ----- §3 DeFi protocol drill-down -----
    _fillDefi: function(fam) {
        var protos = (fam.defi_protocol_breakdown || []).filter(function(p) { return (p.usd || 0) >= 1000; });
        var defiTotal = fam.defi_total_usd || 0;
        var walletsTotal = fam.coinbase_wallets_total_usd || 0;
        var aave = protos.find(function(p) { return p.protocol === 'Aave V3'; });
        var aavePct = aave ? aave.pct_of_defi : 0;
        var concWarn = aavePct >= ETHENA_THRESHOLDS.defi_aave_concentration_warn;

        var tbody = protos.map(function(p) {
            var color = ETHENA_PROTOCOL_COLORS[p.protocol] || '#94a3b8';
            return '<tr>' +
                '<td class="font-medium"><span class="inline-block w-2.5 h-2.5 rounded-sm mr-2 align-middle" style="background:' + color + '"></span>' + p.protocol + '</td>' +
                '<td class="text-right font-mono">' + CommonRenderer.formatCurrencyExact(p.usd) + '</td>' +
                '<td class="text-right font-mono">' + (p.pct_of_defi != null ? p.pct_of_defi.toFixed(2) : '-') + '%</td>' +
            '</tr>';
        }).join('');

        EthenaRenderer._set('ethena-defi-panel',
            '<div class="panel">' +
                '<div class="panel-title">DeFi Protocol Breakdown <span class="text-xs font-normal text-slate-400">— drill-down of Coinbase Onchain Wallets</span></div>' +
                '<div class="risk-flag mb-3" style="background:#eff6ff;color:#1e40af;border-left:4px solid #3b82f6;">' +
                    'Of the <span class="font-mono">' + EthenaRenderer._money(walletsTotal) + '</span> held across the 5 Coinbase Onchain Wallets, ' +
                    '<span class="font-mono">' + EthenaRenderer._money(defiTotal) + '</span> is deployed in DeFi protocols (resolved via DeBank). ' +
                    'This is a <strong>drill-down of one custody slice</strong> — not additive to total backing.</div>' +
                (concWarn ? '<div class="risk-flag risk-warning mb-3">Aave V3 is ' + aavePct.toFixed(1) + '% of wallet DeFi positions (> ' + ETHENA_THRESHOLDS.defi_aave_concentration_warn + '% concentration threshold).</div>' : '') +
                '<div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">' +
                    '<div style="height:200px;position:relative;"><canvas id="ethena-defi-donut"></canvas></div>' +
                    '<table class="data-table"><thead><tr><th>Protocol</th><th class="text-right">Value (USD)</th><th class="text-right">% of DeFi</th></tr></thead>' +
                    '<tbody>' + tbody + '</tbody></table>' +
                '</div>' +
            '</div>');
    },

    _drawDefiDonut: function(fam) {
        var ctx = document.getElementById('ethena-defi-donut');
        if (!ctx || typeof Chart === 'undefined') return;
        var protos = (fam.defi_protocol_breakdown || []).filter(function(p) { return (p.usd || 0) >= 1000; });
        if (window._ethenaDefiDonut) window._ethenaDefiDonut.destroy();
        window._ethenaDefiDonut = new Chart(ctx, {
            type: 'doughnut',
            data: { labels: protos.map(function(p) { return p.protocol; }),
                datasets: [{ data: protos.map(function(p) { return p.usd; }),
                    backgroundColor: protos.map(function(p) { return ETHENA_PROTOCOL_COLORS[p.protocol] || '#94a3b8'; }), borderWidth: 0 }] },
            options: { responsive: true, maintainAspectRatio: false, cutout: '55%',
                plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } },
                    tooltip: { callbacks: { label: function(c) {
                        var t = c.dataset.data.reduce(function(a, b) { return a + b; }, 0);
                        return c.label + ': ' + CommonRenderer.formatCurrencyExact(c.raw) + ' (' + (t > 0 ? (c.raw / t * 100).toFixed(1) : '0') + '%)';
                    } } } } }
        });
    },

    // ----- §4 Coinbase wallets table -----
    _fillWallets: function(fam) {
        var wallets = (fam.coinbase_wallets || []).slice().sort(function(a, b) { return (b.total_usd || 0) - (a.total_usd || 0); });

        function topProtocols(protocols) {
            var agg = {};
            (protocols || []).forEach(function(p) { agg[p.name] = (agg[p.name] || 0) + (p.usd || 0); });
            return Object.keys(agg).map(function(k) { return { name: k, usd: agg[k] }; })
                .filter(function(p) { return p.usd >= 1; })
                .sort(function(a, b) { return b.usd - a.usd; })
                .slice(0, 3);
        }

        var rows = wallets.map(function(w) {
            var tops = topProtocols(w.protocols);
            var topStr = tops.length ? tops.map(function(p) { return p.name + ' (' + EthenaRenderer._money(p.usd) + ')'; }).join(' · ') : '<span class="text-slate-400">raw tokens only</span>';
            var stale = (w.fetch_status && w.fetch_status !== 'ok') ? ' ' + EthenaRenderer._statusPill('stale', 'warn', w.fetch_status) : '';
            return '<tr>' +
                '<td>' + EthenaRenderer._addrCell(w.address) + stale + '</td>' +
                '<td class="text-right font-mono">' + EthenaRenderer._money(w.total_usd) + '</td>' +
                '<td class="text-right font-mono">' + EthenaRenderer._money(w.defi_usd) + '</td>' +
                '<td class="text-xs">' + topStr + '</td>' +
                '<td>' + EthenaRenderer._debankLink(w.address) + '</td>' +
            '</tr>';
        }).join('');

        EthenaRenderer._set('ethena-wallets-panel',
            '<div class="panel">' +
                '<div class="panel-title">Coinbase Onchain Wallets <span class="text-xs font-normal text-slate-400">— ' + EthenaRenderer._money(fam.coinbase_wallets_total_usd) + ' across ' + (fam.coinbase_wallets || []).length + ' wallets</span></div>' +
                '<table class="data-table"><thead><tr><th>Address</th><th class="text-right">Total</th><th class="text-right">In DeFi</th><th>Top protocols</th><th></th></tr></thead>' +
                '<tbody>' + rows + '</tbody></table>' +
            '</div>');
    },

    // ----- §5 CEX hedge breakdown -----
    _fillCex: function(fam) {
        var venues = (fam.cex_hedge_breakdown || []).slice().sort(function(a, b) { return (b.usd || 0) - (a.usd || 0); });
        var total = fam.cex_hedge_total_usd || 0;
        var top = venues[0];
        var topPct = top ? (top.pct_of_hedge || 0) : 0;
        var concState = topPct >= ETHENA_THRESHOLDS.cex_concentration_critical ? 'critical' :
                        topPct >= ETHENA_THRESHOLDS.cex_concentration_warn ? 'warn' : 'ok';

        var bars = venues.map(function(v) {
            var color = ETHENA_CEX_COLORS[v.exchange] || '#94a3b8';
            var pct = v.pct_of_hedge || 0;
            return '<div class="mb-2">' +
                '<div class="flex justify-between text-xs mb-0.5"><span class="font-medium">' + v.exchange + '</span>' +
                    '<span class="font-mono text-slate-500">' + EthenaRenderer._money(v.usd) + ' · ' + pct.toFixed(1) + '%</span></div>' +
                '<div class="pct-bar-container"><div class="pct-bar" style="width:' + Math.max(pct, 0.5) + '%;background:' + color + '"></div></div>' +
            '</div>';
        }).join('');

        EthenaRenderer._set('ethena-cex-panel',
            '<div class="panel">' +
                '<div class="panel-title">CEX Hedge Collateral <span class="text-xs font-normal text-slate-400">— ' + EthenaRenderer._money(total) + ' (delta-hedge margin)</span></div>' +
                '<div class="flex items-center gap-2 mb-3">' +
                    EthenaRenderer._statusPill('Top venue: ' + (top ? top.exchange : '—'), concState, topPct.toFixed(1) + '%') +
                    '<span class="text-xs text-slate-500">Concentration thresholds: ' + ETHENA_THRESHOLDS.cex_concentration_warn + '% watch / ' + ETHENA_THRESHOLDS.cex_concentration_critical + '% critical</span>' +
                '</div>' +
                bars +
                '<div class="text-xs text-slate-400 mt-2">Hedge margin posted to exchanges, from LlamaRisk. Counterparty concentration here is distinct from custody-venue concentration above.</div>' +
            '</div>');
    },

    // ----- §7 Attestation snapshot -----
    _attestAsOf: function(fam) {
        var a = fam.attestation_snapshot;
        if (!a || !a.snapshot_at) return null;
        var d = new Date(a.snapshot_at.endsWith('Z') ? a.snapshot_at : a.snapshot_at + 'Z');
        // Format in UTC — the attestation snapshot date is canonical in UTC
        // (Apr 25 23:59Z); local-time formatting would roll it to Apr 26 east of GMT.
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    },

    _fillAttestation: function(fam) {
        var a = fam.attestation_snapshot;
        if (!a) { EthenaRenderer._set('ethena-attestation-panel', ''); return; }
        var stale = (a.age_days != null && a.age_days > ETHENA_THRESHOLDS.attestation_stale_days);
        var ageState = stale ? 'warn' : 'ok';
        var borderStyle = stale ? 'border-left:4px solid #f59e0b;' : '';
        var asOf = EthenaRenderer._attestAsOf(fam);

        var custodians = a.custodians || {};
        var custRows = Object.keys(custodians).map(function(k) {
            return '<tr><td class="font-medium">' + k + '</td><td class="text-right font-mono">' + CommonRenderer.formatCurrencyExact(custodians[k]) + '</td></tr>';
        }).join('');

        EthenaRenderer._set('ethena-attestation-panel',
            '<div id="ethena-attestation-panel-inner" class="panel" style="' + borderStyle + '">' +
                '<div class="panel-title">Custodian Attestation <span class="text-xs font-normal text-slate-400">— anchors the off-chain custody slices</span></div>' +
                '<div class="flex flex-wrap items-center gap-2 mb-3">' +
                    EthenaRenderer._statusPill(a.month || 'Latest', 'neutral') +
                    EthenaRenderer._statusPill('Snapshot', 'neutral', asOf || '—') +
                    EthenaRenderer._statusPill(stale ? 'Attestation stale' : 'Current', ageState, (a.age_days != null ? Math.round(a.age_days) + 'd old' : '')) +
                    '<span class="ml-auto text-xs text-slate-500">Coverage at snapshot: <span class="font-mono text-base font-bold text-green-600">' + (a.coverage_pct_with_rf != null ? a.coverage_pct_with_rf.toFixed(2) + '%' : '—') + '</span> <span class="text-slate-400">(incl. RF)</span></span>' +
                '</div>' +
                '<table class="data-table"><thead><tr><th>Custodian (off-chain)</th><th class="text-right">Attested (USD)</th></tr></thead>' +
                '<tbody>' + custRows + '</tbody></table>' +
                '<div class="text-xs text-slate-500 mt-3">' +
                    'Supply at snapshot ' + EthenaRenderer._money(a.supply_usd) + '. Off-chain custody figures refresh monthly; on-chain slices above are live. ' +
                    (a.source_url ? '<a href="' + a.source_url + '" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline">Full attestation post ↗</a>' : '') +
                '</div>' +
            '</div>');
    },

    // ----- §8 Risk flags (family-sourced) -----
    _fillRiskFlags: function(fam) {
        var flags = (fam.risk_flags || []).filter(function(f) { return f.active !== false; });
        if (!flags.length) {
            EthenaRenderer._set('ethena-riskflags-panel',
                '<div class="panel"><div class="panel-title">Risk Flags</div><div class="text-green-600 text-sm font-medium">No active risk flags.</div></div>');
            return;
        }
        var sevMap = { warning: 'risk-warning', warn: 'risk-warning', critical: 'risk-critical', info: 'risk-info' };
        var rows = flags.map(function(f) {
            var cls = sevMap[f.severity] || 'risk-info';
            return '<div class="risk-flag ' + cls + '">' + (f.message || f.id || 'flag') + '</div>';
        }).join('');
        EthenaRenderer._set('ethena-riskflags-panel',
            '<div class="panel"><div class="panel-title">Risk Flags <span class="text-xs font-normal text-slate-400">— ' + flags.length + ' active</span></div>' + rows + '</div>');
    },

    // ----- §9 Family panel -----
    _fillFamily: function(fam, currentSlug) {
        var s = fam.summary || {};
        function card(slug, name, lines) {
            var hi = (slug === currentSlug) ? 'border-blue-400 ring-1 ring-blue-200' : '';
            return '<a href="?asset=' + slug + '" class="summary-card block hover:shadow-sm transition-shadow ' + hi + '">' +
                '<div class="text-xs text-slate-400 uppercase font-medium">' + name + '</div>' + lines + '</a>';
        }
        var usdeCard = card('usde', 'USDe',
            '<div class="text-base font-bold text-slate-800 mt-1">' + EthenaRenderer._money(s.usde_supply_usd) + ' supply</div>' +
            '<div class="text-xs text-slate-500">Coverage ' + (s.coverage_ratio_with_reserve_fund != null ? (s.coverage_ratio_with_reserve_fund * 100).toFixed(2) + '%' : '—') + ' incl. RF · $' + (s.usde_price != null ? s.usde_price.toFixed(4) : '—') + '</div>');
        var susdeCard = card('susde', 'sUSDe',
            '<div class="text-base font-bold text-slate-800 mt-1">' + EthenaRenderer._money(s.usde_staked_usd) + ' staked</div>' +
            '<div class="text-xs text-slate-500">' + (s.susde_supply_shares != null ? (s.susde_supply_shares / 1e6).toFixed(1) + 'M shares' : '—') + ' · $' + (s.susde_price != null ? s.susde_price.toFixed(4) : '—') + '</div>');

        EthenaRenderer._set('ethena-family-panel',
            '<div class="panel">' +
                '<div class="panel-title">Ethena Family — USDe + sUSDe</div>' +
                '<div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">' + usdeCard + susdeCard + '</div>' +
                '<div class="text-sm font-semibold text-slate-700 mb-2">Supply trend (90d)</div>' +
                '<div class="chart-container" style="height:240px;position:relative;"><canvas id="ethena-family-trend"></canvas></div>' +
                '<div class="text-xs text-slate-400 mt-2">USDe is the synthetic dollar; sUSDe is its staking vault. Both draw on the same reserve pool shown in Custody above — the figures are not additive.</div>' +
            '</div>');
    },

    _loadFamilyTrendChart: function() {
        var nocache = Math.floor(Date.now() / 60000);
        Promise.all([
            fetch('data/usde_backing_history.json?nocache=' + nocache).then(function(r) { return r.ok ? r.json() : null; }).catch(function() { return null; }),
            fetch('data/susde_backing_history.json?nocache=' + nocache).then(function(r) { return r.ok ? r.json() : null; }).catch(function() { return null; })
        ]).then(function(res) {
            var ctx = document.getElementById('ethena-family-trend');
            if (!ctx || typeof Chart === 'undefined') return;
            var usde = (res[0] && res[0].entries) ? EthenaRenderer._downsample(res[0].entries, 200) : [];
            var susde = (res[1] && res[1].entries) ? EthenaRenderer._downsample(res[1].entries, 200) : [];
            if (usde.length < 2 && susde.length < 2) { ctx.parentElement.innerHTML = '<div class="text-xs text-slate-400 italic">Trend data unavailable.</div>'; return; }

            var datasets = [];
            if (usde.length) datasets.push({
                label: 'USDe backing', data: usde.map(function(e) { return { x: new Date(e.timestamp.endsWith('Z') ? e.timestamp : e.timestamp + 'Z'), y: e.total_backing }; }),
                borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.08)', fill: false, tension: 0.25, pointRadius: 0, borderWidth: 2
            });
            if (susde.length) datasets.push({
                label: 'sUSDe assets (USDe staked)', data: susde.map(function(e) { return { x: new Date(e.timestamp.endsWith('Z') ? e.timestamp : e.timestamp + 'Z'), y: e.total_assets_usde }; }),
                borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.08)', fill: false, tension: 0.25, pointRadius: 0, borderWidth: 2
            });

            if (window._ethenaFamilyTrend) window._ethenaFamilyTrend.destroy();
            window._ethenaFamilyTrend = new Chart(ctx, {
                type: 'line',
                data: { datasets: datasets },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    scales: {
                        x: { type: 'time', time: { unit: 'day', displayFormats: { day: 'MMM d' } }, grid: { display: false }, ticks: { maxTicksLimit: 8, font: { size: 11 } } },
                        y: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 11 }, callback: function(v) { return '$' + (v / 1e9).toFixed(1) + 'B'; } } }
                    },
                    plugins: { legend: { display: true, position: 'top', labels: { boxWidth: 12, font: { size: 11 } } },
                        tooltip: { callbacks: { label: function(c) { return c.dataset.label + ': ' + EthenaRenderer._money(c.parsed.y); } } } },
                    interaction: { intersect: false, mode: 'index' }
                }
            });
        }).catch(function() {});
    }
};
