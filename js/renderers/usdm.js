/**
 * USDm (Mento Dollar) renderer.
 *
 * Reserve-backed fiat stablecoin. Two-chain footprint:
 *   - Celo (home): API-reported aggregate debt + reserve.
 *   - Monad (spoke): API + on-chain ReserveV2 sanity check is the trust
 *     differentiator (the API alone is just proxying Mento).
 *
 * Data sources:
 *   - data/usdm_backing.json + data/usdm_backing_history.json
 *
 * Modeled on apyx.js (multi-chain reserve-backed pattern) but simpler:
 *   no Trust Stack, no family panel, no DEX liquidity, no alerter pairing.
 *
 * Note on scale: PegTracker's analyzer writes collateral_ratio as a ratio
 * (1.0101) — other dashboards use percentage (101.01). preRender() normalizes
 * both the summary and history into the percentage convention common.js
 * expects, so the standard summary cards and CR chart render correctly.
 */

var USDmRenderer = {

    // ============================================================
    // helpers
    // ============================================================
    _truncAddr: function(addr) {
        if (!addr) return '-';
        return addr.slice(0, 6) + '...' + addr.slice(-4);
    },

    _explorerLink: function(addr, chain) {
        if (!addr) return '';
        var base;
        if (chain === 'celo') base = 'https://celoscan.io/address/';
        else if (chain === 'monad') base = 'https://monad-testnet.socialscan.io/address/';
        else base = 'https://etherscan.io/address/';
        return '<a href="' + base + addr + '" target="_blank" rel="noopener noreferrer" ' +
            'class="text-blue-500 hover:underline text-xs" title="' + addr + '">↗</a>';
    },

    _addrCell: function(addr, chain) {
        if (!addr) return '<span class="text-slate-400">-</span>';
        return '<span class="font-mono text-xs" title="' + addr + '">' +
            USDmRenderer._truncAddr(addr) +
            '</span> ' + USDmRenderer._explorerLink(addr, chain);
    },

    _statusDot: function(state) {
        var color;
        if (state === 'ok')            color = '#22c55e';
        else if (state === 'warn')     color = '#f59e0b';
        else if (state === 'critical') color = '#ef4444';
        else                           color = '#94a3b8';
        return '<span class="inline-block w-2 h-2 rounded-full align-middle" ' +
            'style="background:' + color + '"></span>';
    },

    _statusPill: function(label, state, extra) {
        var bg, fg;
        if (state === 'ok')            { bg = 'bg-green-100'; fg = 'text-green-800'; }
        else if (state === 'warn')     { bg = 'bg-amber-100'; fg = 'text-amber-800'; }
        else if (state === 'critical') { bg = 'bg-red-100';   fg = 'text-red-800'; }
        else                           { bg = 'bg-slate-100'; fg = 'text-slate-700'; }
        return '<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ' + bg + ' ' + fg + '">' +
            USDmRenderer._statusDot(state) +
            '<span>' + label + (extra ? ' <span class="font-mono">' + extra + '</span>' : '') + '</span>' +
        '</span>';
    },

    _chainBadge: function(chain) {
        var label, cls;
        if (chain === 'celo')      { label = 'Celo';  cls = 'bg-yellow-50 text-yellow-700'; }
        else if (chain === 'monad'){ label = 'Monad'; cls = 'bg-violet-50 text-violet-700'; }
        else                       { label = chain;   cls = 'bg-slate-100 text-slate-700'; }
        return '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ' + cls + '">' + label + '</span>';
    },

    _tierPill: function(tier) {
        var bg, fg, label;
        if (tier === 1)      { bg = 'bg-green-100'; fg = 'text-green-800'; label = 'Tier 1'; }
        else if (tier === 2) { bg = 'bg-amber-100'; fg = 'text-amber-800'; label = 'Tier 2'; }
        else                 { bg = 'bg-slate-200'; fg = 'text-slate-700'; label = 'Tier ' + tier; }
        return '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ' + bg + ' ' + fg + '">' + label + '</span>';
    },

    _formatToken: function(num, decimals) {
        if (num === null || num === undefined) return '-';
        decimals = decimals !== undefined ? decimals : 2;
        return num.toLocaleString('en-US', { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
    },

    // Drift severity for API↔RPC bucket comparison.
    _driftState: function(pct) {
        var abs = Math.abs(pct || 0);
        if (abs < 5)  return 'ok';
        if (abs < 10) return 'warn';
        return 'critical';
    },

    // Monad reserve coverage: how much of Monad-bucket USDm supply is
    // demonstrably backed by ReserveV2 holdings on-chain. The single most
    // important number on the page.
    _coverageState: function(ratio) {
        if (ratio == null) return 'unknown';
        var pct = ratio * 100;
        if (pct >= 90) return 'ok';
        if (pct >= 75) return 'warn';
        return 'critical';
    },

    // Stable-only Reserve coverage state. Thresholds from the editorial
    // handoff: ≥1.10 green / 1.00–1.10 neutral / 0.95–1.00 warn / <0.95 alert.
    _stableOnlyState: function(ratio) {
        if (ratio == null) return 'unknown';
        if (ratio >= 1.10) return 'ok';
        if (ratio >= 1.00) return 'neutral';
        if (ratio >= 0.95) return 'warn';
        return 'critical';
    },

    // ============================================================
    // pre-render — runs before common renderer paints summary cards.
    // ============================================================
    preRender: function(data, history) {
        var specific = data.asset_specific || {};
        if (specific.type !== 'fiat-stable-reserve-backed') return;
        var s = data.summary;
        if (!s) return;

        // PegTracker emits collateral_ratio as a ratio (1.0101); common.js
        // expects percentage (101.01). Normalize the live datum + every
        // history entry so the standard summary card + CR chart work.
        if (s.collateral_ratio != null && s.collateral_ratio < 2) {
            s.collateral_ratio = s.collateral_ratio * 100;
        }
        if (history && Array.isArray(history.entries)) {
            history.entries.forEach(function(e) {
                if (e.collateral_ratio != null && e.collateral_ratio < 2) {
                    e.collateral_ratio = e.collateral_ratio * 100;
                }
            });
        }

        // Synthesize collateral_ratio_alt — common.renderSummaryCards reads
        // .label unconditionally. When the analyzer publishes the stable-only
        // bucket fields, surface stable-only coverage here (the editorial
        // headline: 16% of Reserve is volatile, fiat-comparable view is barely
        // covered). Otherwise fall back to Reserve / USDm-only.
        var agg = specific.aggregate || {};
        var stableOnlyAggRatio = agg.stablecoin_aggregate_ratio_stable_only;
        if (stableOnlyAggRatio != null) {
            s.collateral_ratio_alt = {
                label: 'Stable-Only Coverage',
                value: stableOnlyAggRatio * 100,
                is_currency: false
            };
        } else {
            var altValue = (agg.reserve_to_supply_ratio != null) ? agg.reserve_to_supply_ratio * 100 : 0;
            s.collateral_ratio_alt = {
                label: 'Reserve / USDm only',
                value: altValue,
                is_currency: false
            };
        }

        // Per-entry chart overlay: stable-only coverage as the second series.
        // renderCRChart reads e.collateral_ratio_alt; populate it from the new
        // per-snapshot stable_only_coverage_ratio (ratio scale → percent).
        if (history && Array.isArray(history.entries)) {
            history.entries.forEach(function(e) {
                if (e.stable_only_coverage_ratio != null) {
                    e.collateral_ratio_alt = e.stable_only_coverage_ratio * 100;
                }
            });
        }

        // Synthesize backing_breakdown — common.renderBreakdownTable +
        // renderPieChart both iterate this array. Map the aggregate custodian
        // split onto the standard breakdown shape; richer per-chain detail
        // lives in §5 Chain Breakdown below.
        var cb = agg.custodian_breakdown || {};
        var total = (cb.hot_usd || 0) + (cb.cold_usd || 0) + (cb.ops_usd || 0);
        function pct(v) { return total > 0 ? (v / total) * 100 : 0; }
        data.backing_breakdown = [
            { label: 'Cold Storage', value: cb.cold_usd || 0, pct: pct(cb.cold_usd || 0), tags: ['idle'] },
            { label: 'Hot Wallets',  value: cb.hot_usd  || 0, pct: pct(cb.hot_usd  || 0), tags: [] },
            { label: 'Ops Wallets',  value: cb.ops_usd  || 0, pct: pct(cb.ops_usd  || 0), tags: [] }
        ];

        // CR chart band — Mento targets ~par with small surplus; meaningful
        // range is tighter than common.js defaults.
        specific.chart_y_min = 95;
        specific.chart_y_max = 110;
        specific.chart_bands = {
            critical: [0, 98],
            thin: [98, 100],
            amber: [100, 102],
            healthy: [102, 200],
            min_line: 100,
            max_line: null
        };
        specific.chart_title = 'Collateral Ratio History — Reserve vs All Stablecoin Debt';
        specific.chart_dataset_label = stableOnlyAggRatio != null ? 'All Collateral' : 'Reserve / Σ(stablecoins)';
        if (stableOnlyAggRatio != null) {
            specific.chart_alt_dataset_label = 'Stable Only';
        }
    },

    // ============================================================
    // entry point
    // ============================================================
    render: function(data) {
        var container = document.getElementById('asset-specific-panels');
        if (!container) return;
        var specific = data.asset_specific || {};
        if (specific.type !== 'fiat-stable-reserve-backed') return;

        var html = '';
        html += USDmRenderer._renderHeadlineCard(specific, data.summary);
        html += USDmRenderer._renderReserveBuckets(specific.aggregate || {});
        html += USDmRenderer._renderMonadReserveTable(specific.monad_state || {});
        html += USDmRenderer._renderSupplyDistribution(specific.monad_state || {});
        html += USDmRenderer._renderFXSynthetics(specific.monad_state || {});
        html += USDmRenderer._renderChainBreakdown(specific);
        html += USDmRenderer._renderGovernance(specific.governance_state || {});
        html += USDmRenderer._renderDataIntegrity(specific);

        container.innerHTML = html;
    },

    // ============================================================
    // §1 Headline Card
    // ============================================================
    _renderHeadlineCard: function(specific, s) {
        var agg = specific.aggregate || {};
        var cb = agg.custodian_breakdown || {};

        var totalSupply = s.total_supply;
        var totalBacking = s.total_backing;
        // collateral_ratio already normalized to % in preRender.
        var crPct = s.collateral_ratio;
        var crCls = crPct >= 100 ? 'text-green-600' : 'text-red-600';
        var surplus = s.surplus_deficit;
        var surplusCls = surplus >= 0 ? 'text-green-600' : 'text-red-600';

        var custTotal = (cb.hot_usd || 0) + (cb.cold_usd || 0) + (cb.ops_usd || 0);
        function custPct(v) { return custTotal > 0 ? ((v / custTotal) * 100).toFixed(1) + '%' : '—'; }

        var rsr = (agg.reserve_to_supply_ratio != null) ? (agg.reserve_to_supply_ratio * 100) : null;
        var sar = (agg.stablecoin_aggregate_ratio != null) ? (agg.stablecoin_aggregate_ratio * 100) : null;

        // Stable-only headline. Only present once the PegTracker analyzer
        // emits bucket fields; until then, the tile + sub-text degrade silently.
        var stableOnlyRatio = agg.stablecoin_aggregate_ratio_stable_only;
        var stableOnlyPct = (stableOnlyRatio != null) ? stableOnlyRatio * 100 : null;
        var volatileBucket = agg.total_reserve_volatile_bucket;
        var hasStableOnly = (stableOnlyRatio != null);
        var crSubtext = hasStableOnly && volatileBucket != null ?
            'Includes ' + CommonRenderer.formatCurrencyExact(volatileBucket) +
            ' volatile collateral (CELO + stETH); see Stable-Only Coverage for the fiat-comparable view.' :
            '';
        var stableOnlyState = USDmRenderer._stableOnlyState(stableOnlyRatio);
        var stableOnlyCls = stableOnlyState === 'ok' ? 'text-green-600' :
                            stableOnlyState === 'neutral' ? 'text-slate-800 dark:text-slate-100' :
                            stableOnlyState === 'warn' ? 'text-amber-600' :
                            stableOnlyState === 'critical' ? 'text-red-600' : 'text-slate-600';
        var stableOnlySub = (volatileBucket != null) ?
            'Reserve excluding CELO + stETH ÷ all Mento stablecoin debt. Strips ' +
            CommonRenderer.formatCurrencyExact(volatileBucket) + ' of volatile assets from the headline.' :
            'Reserve excluding volatile collateral ÷ all Mento stablecoin debt.';

        var html = '<div class="panel">' +
            '<div class="panel-title flex items-center gap-2">' +
                '<span>Mento Dollar — Reserve-Backed Stable</span>' +
                USDmRenderer._chainBadge('celo') +
                USDmRenderer._chainBadge('monad') +
            '</div>' +

            // Row 1: aggregate metrics. Grid bumps to 5 cols on lg+ when the
            // analyzer has emitted the stable-only headline so it sits next to
            // the gross Collateral Ratio tile.
            '<div class="grid grid-cols-2 md:grid-cols-4 ' + (hasStableOnly ? 'lg:grid-cols-5 ' : '') + 'gap-3 mb-4">' +
                '<div class="bg-slate-50 dark:bg-slate-700 rounded-lg p-3">' +
                    '<div class="text-xs text-slate-500 uppercase font-medium">Total Supply (USDm)</div>' +
                    '<div class="text-lg font-bold text-slate-800 dark:text-slate-100">' + CommonRenderer.formatCurrencyExact(totalSupply) + '</div>' +
                '</div>' +
                '<div class="bg-slate-50 dark:bg-slate-700 rounded-lg p-3">' +
                    '<div class="text-xs text-slate-500 uppercase font-medium">Total Backing</div>' +
                    '<div class="text-lg font-bold text-slate-800 dark:text-slate-100">' + CommonRenderer.formatCurrencyExact(totalBacking) + '</div>' +
                '</div>' +
                '<div class="bg-slate-50 dark:bg-slate-700 rounded-lg p-3">' +
                    '<div class="text-xs text-slate-500 uppercase font-medium">Collateral Ratio</div>' +
                    '<div class="text-lg font-bold ' + crCls + '">' + (crPct != null ? crPct.toFixed(2) + '%' : '—') + '</div>' +
                    (crSubtext ? '<div class="text-xs text-slate-400 mt-1">' + crSubtext + '</div>' : '') +
                '</div>' +
                (hasStableOnly ?
                    '<div class="bg-slate-50 dark:bg-slate-700 rounded-lg p-3">' +
                        '<div class="text-xs text-slate-500 uppercase font-medium">Stable-Only Coverage</div>' +
                        '<div class="text-lg font-bold ' + stableOnlyCls + '">' + (stableOnlyPct != null ? stableOnlyPct.toFixed(2) + '%' : '—') + '</div>' +
                        '<div class="text-xs text-slate-400 mt-1">' + stableOnlySub + '</div>' +
                    '</div>'
                : '') +
                '<div class="bg-slate-50 dark:bg-slate-700 rounded-lg p-3">' +
                    '<div class="text-xs text-slate-500 uppercase font-medium">Surplus / Deficit</div>' +
                    '<div class="text-lg font-bold ' + surplusCls + '">' + CommonRenderer.formatCurrencyExact(surplus) + '</div>' +
                '</div>' +
            '</div>' +

            // Row 2: custodian split bar
            '<div class="mb-4">' +
                '<div class="text-xs text-slate-500 uppercase font-medium mb-1">Custodian Split</div>' +
                '<div class="flex h-3 rounded overflow-hidden bg-slate-200" title="Cold / Hot / Ops">' +
                    (custTotal > 0 ? '<div style="width:' + (cb.cold_usd / custTotal * 100) + '%; background:#22c55e"></div>' : '') +
                    (custTotal > 0 ? '<div style="width:' + (cb.hot_usd  / custTotal * 100) + '%; background:#3b82f6"></div>' : '') +
                    (custTotal > 0 ? '<div style="width:' + (cb.ops_usd  / custTotal * 100) + '%; background:#f59e0b"></div>' : '') +
                '</div>' +
                '<div class="flex gap-4 text-xs text-slate-500 mt-1">' +
                    '<span><span class="inline-block w-2 h-2 rounded-sm align-middle" style="background:#22c55e"></span> Cold ' + CommonRenderer.formatCurrencyExact(cb.cold_usd || 0) + ' (' + custPct(cb.cold_usd || 0) + ')</span>' +
                    '<span><span class="inline-block w-2 h-2 rounded-sm align-middle" style="background:#3b82f6"></span> Hot ' + CommonRenderer.formatCurrencyExact(cb.hot_usd || 0) + ' (' + custPct(cb.hot_usd || 0) + ')</span>' +
                    '<span><span class="inline-block w-2 h-2 rounded-sm align-middle" style="background:#f59e0b"></span> Ops ' + CommonRenderer.formatCurrencyExact(cb.ops_usd || 0) + ' (' + custPct(cb.ops_usd || 0) + ')</span>' +
                '</div>' +
            '</div>' +

            // Row 3: two side-by-side ratios
            '<div class="grid grid-cols-1 md:grid-cols-2 gap-3">' +
                '<div class="border border-slate-200 dark:border-slate-700 rounded-lg p-3">' +
                    '<div class="text-xs text-slate-500 uppercase font-medium">Reserve / USDm only</div>' +
                    '<div class="text-xl font-bold text-slate-800 dark:text-slate-100">' + (rsr != null ? rsr.toFixed(2) + '%' : '—') + '</div>' +
                    '<div class="text-xs text-slate-400 mt-1">Reserve backing the USDm float in isolation.</div>' +
                '</div>' +
                '<div class="border border-slate-200 dark:border-slate-700 rounded-lg p-3" title="Lower because the Reserve also backs EURm / GBPm / JPYm / CHFm.">' +
                    '<div class="text-xs text-slate-500 uppercase font-medium">Reserve / All Stablecoin Debt</div>' +
                    '<div class="text-xl font-bold text-slate-800 dark:text-slate-100">' + (sar != null ? sar.toFixed(2) + '%' : '—') + '</div>' +
                    '<div class="text-xs text-slate-400 mt-1">Reserve vs USDm + EURm + GBPm + JPYm + CHFm combined.</div>' +
                '</div>' +
            '</div>' +

        '</div>';
        return html;
    },

    // ============================================================
    // §1b Reserve Bucket Breakdown — USD-stable / EUR-stable / Volatile / Other
    // ============================================================
    // Renders only when the PegTracker analyzer has emitted the bucket fields
    // under aggregate.*. Editorial goal: surface the volatile slice (CELO +
    // stETH) explicitly so "is the volatile counted as collateral?" is
    // answered at a glance.
    _renderReserveBuckets: function(agg) {
        var usd = agg.total_reserve_usd_stable_bucket;
        var eur = agg.total_reserve_eur_stable_bucket;
        var vol = agg.total_reserve_volatile_bucket;
        var other = agg.total_reserve_other_bucket;
        if (usd == null && eur == null && vol == null && other == null) return '';

        usd = usd || 0; eur = eur || 0; vol = vol || 0; other = other || 0;
        var total = usd + eur + vol + other;
        if (total <= 0) return '';

        function pct(v) { return (v / total) * 100; }
        var buckets = [
            { label: 'USD-stable',              value: usd,   color: '#22c55e', note: '' },
            { label: 'EUR-stable',              value: eur,   color: '#3b82f6', note: '' },
            { label: 'Volatile (CELO + stETH)', value: vol,   color: '#f59e0b', note: 'Stripped from Stable-Only Coverage' },
            { label: 'Other',                   value: other, color: '#94a3b8', note: '' }
        ];

        var bar = buckets.map(function(b) {
            var w = pct(b.value);
            if (w <= 0) return '';
            return '<div style="width:' + w + '%; background:' + b.color + '" title="' + b.label + ' — ' + CommonRenderer.formatCurrencyExact(b.value) + ' (' + w.toFixed(1) + '%)"></div>';
        }).join('');

        var rows = buckets.map(function(b) {
            var p = pct(b.value);
            return '<tr>' +
                '<td><span class="inline-block w-2 h-2 rounded-sm align-middle mr-2" style="background:' + b.color + '"></span><span class="font-medium">' + b.label + '</span>' +
                    (b.note ? '<div class="text-xs text-slate-400 ml-4">' + b.note + '</div>' : '') + '</td>' +
                '<td class="text-right font-mono">' + CommonRenderer.formatCurrencyExact(b.value) + '</td>' +
                '<td class="text-right font-mono">' + p.toFixed(1) + '%</td>' +
            '</tr>';
        }).join('');

        return '<div class="panel">' +
            '<div class="panel-title">Reserve Composition by Bucket <span class="text-xs font-normal text-slate-500">stable vs volatile</span></div>' +
            '<div class="text-xs text-slate-500 mb-3">Mento Reserve totals ' + CommonRenderer.formatCurrencyExact(total) + '. The Volatile bucket (CELO + stETH) is the slice that pulls the headline Collateral Ratio above the Stable-Only Coverage figure.</div>' +
            '<div class="flex h-4 rounded overflow-hidden bg-slate-200 mb-3">' + bar + '</div>' +
            '<table class="data-table">' +
                '<thead><tr>' +
                    '<th>Bucket</th>' +
                    '<th class="text-right">USD Value</th>' +
                    '<th class="text-right">% of Reserve</th>' +
                '</tr></thead>' +
                '<tbody>' + rows + '</tbody>' +
            '</table>' +
        '</div>';
    },

    // ============================================================
    // §2 Monad Reserve Composition
    // ============================================================
    _renderMonadReserveTable: function(monad) {
        var rc = monad.reserve_composition || {};
        var symbols = Object.keys(rc);
        if (symbols.length === 0) {
            return '<div class="panel"><div class="panel-title">Monad Reserve Composition</div>' +
                '<div class="text-slate-400 text-sm">No on-chain reserve data.</div></div>';
        }

        var rows = symbols.map(function(sym) {
            var r = rc[sym];
            return '<tr>' +
                '<td class="font-medium">' + sym + '</td>' +
                '<td class="text-right font-mono">' + USDmRenderer._formatToken(r.balance) + '</td>' +
                '<td class="text-right font-mono">' + CommonRenderer.formatCurrencyExact(r.usd_value) + '</td>' +
                '<td class="text-right font-mono">' + (r.pct != null ? r.pct.toFixed(2) + '%' : '—') + '</td>' +
                '<td class="text-center">' + USDmRenderer._tierPill(r.tier) + '</td>' +
            '</tr>';
        }).join('');

        var rpcTotal = monad.reserve_v2_usd_value;
        var apiTotal = monad.reserve_per_api_usd;
        var driftPct = (monad.api_vs_rpc_drift_pct != null) ? monad.api_vs_rpc_drift_pct * 100 : null;
        var driftState = USDmRenderer._driftState(driftPct);

        return '<div class="panel">' +
            '<div class="panel-title">Monad Reserve Composition <span class="text-xs font-normal text-slate-500">on-chain ReserveV2</span></div>' +
            '<div class="text-xs text-slate-500 mb-3">Live ReserveV2 holdings on Monad. Tier-1 (USDC) is the trust anchor; Tier-3 (USDT0) is a bridged dependency.</div>' +
            '<table class="data-table">' +
                '<thead><tr>' +
                    '<th>Asset</th>' +
                    '<th class="text-right">Balance</th>' +
                    '<th class="text-right">USD Value</th>' +
                    '<th class="text-right">Bucket %</th>' +
                    '<th class="text-center">Tier</th>' +
                '</tr></thead>' +
                '<tbody>' + rows + '</tbody>' +
            '</table>' +
            '<div class="mt-3 flex flex-wrap items-center gap-3 text-sm">' +
                '<span class="text-slate-600 dark:text-slate-300">On-chain ReserveV2: <span class="font-mono font-semibold">' + CommonRenderer.formatCurrencyExact(rpcTotal) + '</span></span>' +
                '<span class="text-slate-500">·</span>' +
                '<span class="text-slate-600 dark:text-slate-300">API reports: <span class="font-mono font-semibold">' + CommonRenderer.formatCurrencyExact(apiTotal) + '</span></span>' +
                '<span class="text-slate-500">·</span>' +
                USDmRenderer._statusPill('API↔RPC drift', driftState, (driftPct != null ? driftPct.toFixed(2) + '%' : '—')) +
            '</div>' +
        '</div>';
    },

    // ============================================================
    // §3 Monad Supply Distribution
    // ============================================================
    _renderSupplyDistribution: function(monad) {
        var rls = monad.usdm_supply_in_rls_pools || 0;
        var ols = monad.usdm_supply_in_ols_pools || 0;
        var retail = monad.usdm_supply_retail_or_other || 0;
        var total = monad.usdm_supply_total || (rls + ols + retail);
        if (total === 0) {
            return '<div class="panel"><div class="panel-title">Monad USDm Supply Distribution</div>' +
                '<div class="text-slate-400 text-sm">No Monad supply data.</div></div>';
        }
        function p(v) { return ((v / total) * 100).toFixed(2) + '%'; }

        return '<div class="panel">' +
            '<div class="panel-title">Monad USDm Supply Distribution <span class="text-xs font-normal text-slate-500">where does the float sit?</span></div>' +
            '<div class="text-xs text-slate-500 mb-3">USDm circulating on Monad: ' + USDmRenderer._formatToken(total) + ' USDm. FX pools (OLS) are largely Mento-seeded today — high in-pool % is expected.</div>' +
            '<div class="flex h-4 rounded overflow-hidden bg-slate-200 mb-3" title="RLS / OLS / Retail">' +
                '<div style="width:' + (rls    / total * 100) + '%; background:#6366f1"></div>' +
                '<div style="width:' + (ols    / total * 100) + '%; background:#a855f7"></div>' +
                '<div style="width:' + (retail / total * 100) + '%; background:#94a3b8"></div>' +
            '</div>' +
            '<div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">' +
                '<div>' +
                    '<div class="flex items-center gap-2"><span class="inline-block w-3 h-3 rounded-sm" style="background:#6366f1"></span><span class="font-medium">RLS Pools</span></div>' +
                    '<div class="font-mono">' + USDmRenderer._formatToken(rls) + ' USDm <span class="text-slate-400">(' + p(rls) + ')</span></div>' +
                    '<div class="text-xs text-slate-400">Stablecoin/USDm liquidity (USDC, AUSD, USDT0)</div>' +
                '</div>' +
                '<div>' +
                    '<div class="flex items-center gap-2"><span class="inline-block w-3 h-3 rounded-sm" style="background:#a855f7"></span><span class="font-medium">OLS Pools</span></div>' +
                    '<div class="font-mono">' + USDmRenderer._formatToken(ols) + ' USDm <span class="text-slate-400">(' + p(ols) + ')</span></div>' +
                    '<div class="text-xs text-slate-400">FX/USDm liquidity (GBPm, EURm, JPYm, CHFm)</div>' +
                '</div>' +
                '<div>' +
                    '<div class="flex items-center gap-2"><span class="inline-block w-3 h-3 rounded-sm" style="background:#94a3b8"></span><span class="font-medium">Retail / Other</span></div>' +
                    '<div class="font-mono">' + USDmRenderer._formatToken(retail) + ' USDm <span class="text-slate-400">(' + p(retail) + ')</span></div>' +
                    '<div class="text-xs text-slate-400">Wallets and non-Mento venues</div>' +
                '</div>' +
            '</div>' +
        '</div>';
    },

    // ============================================================
    // §4 FX Synthetics
    // ============================================================
    _renderFXSynthetics: function(monad) {
        var fx = monad.fx_synthetic_supplies || {};
        var symbols = Object.keys(fx);
        if (symbols.length === 0) {
            return '<div class="panel"><div class="panel-title">FX Synthetics (Monad)</div>' +
                '<div class="text-slate-400 text-sm">No FX synthetic data.</div></div>';
        }

        var rows = symbols.map(function(sym) {
            var f = fx[sym] || {};
            var pip = f.pct_in_pool;
            var pipCls = (pip != null && pip > 99) ? 'text-amber-600' : 'text-slate-700 dark:text-slate-200';
            return '<tr>' +
                '<td class="font-medium">' + sym + '</td>' +
                '<td class="text-right font-mono">' + USDmRenderer._formatToken(f.supply) + '</td>' +
                '<td class="text-right font-mono">' + USDmRenderer._formatToken(f.in_pool) + '</td>' +
                '<td class="text-right font-mono ' + pipCls + '">' + (pip != null ? pip.toFixed(2) + '%' : '—') + '</td>' +
            '</tr>';
        }).join('');

        return '<div class="panel">' +
            '<div class="panel-title">FX Synthetics on Monad <span class="text-xs font-normal text-slate-500">EURm / GBPm / JPYm / CHFm</span></div>' +
            '<div class="text-xs text-slate-500 mb-3">Mento\'s non-USD stablecoins paired with USDm on Monad. >99% pool-resident = seed liquidity dominated (informational, not alarming).</div>' +
            '<table class="data-table">' +
                '<thead><tr>' +
                    '<th>Asset</th>' +
                    '<th class="text-right">Total Supply</th>' +
                    '<th class="text-right">In USDm Pool</th>' +
                    '<th class="text-right">% In Pool</th>' +
                '</tr></thead>' +
                '<tbody>' + rows + '</tbody>' +
            '</table>' +
        '</div>';
    },

    // ============================================================
    // §5 Chain Breakdown — Celo vs Monad
    // ============================================================
    _renderChainBreakdown: function(specific) {
        var celo = specific.celo_state || {};
        var monad = specific.monad_state || {};

        var coverage = monad.reserve_v2_coverage_ratio;
        var coverageState = USDmRenderer._coverageState(coverage);
        var covCls = coverageState === 'ok' ? 'text-green-600' :
                     coverageState === 'warn' ? 'text-amber-600' :
                     coverageState === 'critical' ? 'text-red-600' : 'text-slate-600';
        var covPct = (coverage != null) ? (coverage * 100).toFixed(2) + '%' : '—';

        var lostCell = (celo.lost != null && celo.lost > 0) ?
            '<span class="text-amber-600 font-mono" title="Mento\'s own &quot;lost&quot; transparency field">' + USDmRenderer._formatToken(celo.lost) + ' USDm</span>' :
            '<span class="font-mono text-slate-600">' + USDmRenderer._formatToken(celo.lost) + ' USDm</span>';

        return '<div class="panel">' +
            '<div class="panel-title">Chain Breakdown</div>' +
            '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">' +

                // Celo card
                '<div class="border border-slate-200 dark:border-slate-700 rounded-lg p-4">' +
                    '<div class="flex items-center gap-2 mb-3">' + USDmRenderer._chainBadge('celo') + '<span class="font-semibold">Celo (home)</span></div>' +
                    '<dl class="text-sm space-y-1">' +
                        '<div class="flex justify-between"><dt class="text-slate-500">USDm Supply</dt><dd class="font-mono">' + USDmRenderer._formatToken(celo.usdm_supply) + '</dd></div>' +
                        '<div class="flex justify-between"><dt class="text-slate-500">Reserve Debt</dt><dd class="font-mono">' + CommonRenderer.formatCurrencyExact(celo.reserve_debt) + '</dd></div>' +
                        '<div class="flex justify-between"><dt class="text-slate-500">Reserve Held</dt><dd class="font-mono">' + CommonRenderer.formatCurrencyExact(celo.reserve_held) + '</dd></div>' +
                        '<div class="flex justify-between"><dt class="text-slate-500" title="Mento publishes a &quot;lost&quot; field — historic burns / inaccessible reserves.">Lost</dt><dd>' + lostCell + '</dd></div>' +
                    '</dl>' +
                '</div>' +

                // Monad card
                '<div class="border border-slate-200 dark:border-slate-700 rounded-lg p-4">' +
                    '<div class="flex items-center gap-2 mb-3">' + USDmRenderer._chainBadge('monad') + '<span class="font-semibold">Monad (spoke)</span></div>' +
                    '<dl class="text-sm space-y-1">' +
                        '<div class="flex justify-between"><dt class="text-slate-500">USDm Supply</dt><dd class="font-mono">' + USDmRenderer._formatToken(monad.usdm_supply_total) + '</dd></div>' +
                        '<div class="flex justify-between"><dt class="text-slate-500">ReserveV2 (on-chain)</dt><dd class="font-mono">' + CommonRenderer.formatCurrencyExact(monad.reserve_v2_usd_value) + '</dd></div>' +
                        '<div class="flex justify-between items-baseline border-t border-slate-100 dark:border-slate-700 pt-2 mt-2">' +
                            '<dt class="text-slate-700 dark:text-slate-200 font-semibold" title="The on-chain answer to &quot;is Monad USDm actually backed?&quot;">ReserveV2 Coverage</dt>' +
                            '<dd class="text-xl font-bold font-mono ' + covCls + '">' + covPct + '</dd>' +
                        '</div>' +
                    '</dl>' +
                    '<div class="text-xs text-slate-400 mt-2">Pool-resident USDm pulls local coverage below 100%. The gap is closed by Mento operational top-ups (visible in chart), not by an on-chain bridge — Wormhole NTT is announced but not yet operational.</div>' +
                '</div>' +

            '</div>' +
        '</div>';
    },

    // ============================================================
    // §6 Governance
    // ============================================================
    _renderGovernance: function(gov) {
        var delaySec = gov.celo_timelock_min_delay_seconds;
        var celoOk = (delaySec === 172800);
        var celoState = celoOk ? 'ok' : (delaySec != null ? 'critical' : 'unknown');
        var celoLabel = celoOk ? 'getMinDelay() = 2 days' : (delaySec != null ? 'getMinDelay() = ' + delaySec + 's (changed)' : 'unavailable');

        var monadHasTimelock = gov.monad_admin_timelock != null && gov.monad_admin_timelock > 0;
        var monadState = monadHasTimelock ? 'ok' : 'warn';
        var monadLabel = monadHasTimelock ? 'Timelocked' : 'No timelock';

        return '<div class="panel">' +
            '<div class="panel-title">Governance</div>' +
            '<dl class="text-sm space-y-3">' +
                '<div class="flex flex-wrap items-center gap-3 justify-between">' +
                    '<dt class="text-slate-700 dark:text-slate-200"><span class="font-semibold">Celo Timelock</span> <span class="text-xs text-slate-500">— Mento V3 governance upgrade path</span></dt>' +
                    '<dd>' + USDmRenderer._statusPill(celoLabel, celoState) + '</dd>' +
                '</div>' +
                '<div class="flex flex-wrap items-center gap-3 justify-between">' +
                    '<dt class="text-slate-700 dark:text-slate-200">' +
                        '<div><span class="font-semibold">Monad Admin</span> <span class="text-xs text-slate-500">— ' + (gov.monad_admin_type || '—') + '</span></div>' +
                        '<div class="text-xs text-slate-500 mt-0.5">' + USDmRenderer._addrCell(gov.monad_admin_address, 'monad') + '</div>' +
                    '</dt>' +
                    '<dd>' + USDmRenderer._statusPill(monadLabel, monadState) + '</dd>' +
                '</div>' +
            '</dl>' +
            (monadHasTimelock ? '' :
                '<div class="risk-flag risk-warning mt-3 text-xs">' +
                    '<strong>Structural concern:</strong> Monad admin is a multisig with no timelock. ' +
                    'Reserve composition and pool parameters can be changed without a public delay window.' +
                '</div>'
            ) +
        '</div>';
    },

    // ============================================================
    // §7 Data Integrity
    // ============================================================
    _renderDataIntegrity: function(specific) {
        var ds = specific.data_sources || {};
        var monad = specific.monad_state || {};

        var driftPct = (monad.api_vs_rpc_drift_pct != null) ? monad.api_vs_rpc_drift_pct * 100 : null;
        var driftState = USDmRenderer._driftState(driftPct);

        function srcPill(label, ok, note) {
            var state = ok === true ? 'ok' : (ok === false ? 'critical' : 'unknown');
            var stateLabel = ok === true ? 'live' : (ok === false ? 'down' : 'unknown');
            return USDmRenderer._statusPill(label + ': ' + stateLabel, state, note || '');
        }

        return '<div class="panel">' +
            '<div class="panel-title">Data Integrity</div>' +
            '<div class="flex flex-wrap gap-2 text-xs">' +
                srcPill('Mento API', ds.mento_api_ok) +
                srcPill('Monad RPC', ds.monad_rpc_ok) +
                srcPill('Celo RPC',  ds.celo_rpc_ok) +
                USDmRenderer._statusPill('API↔RPC drift', driftState, (driftPct != null ? driftPct.toFixed(2) + '%' : '—')) +
            '</div>' +
            '<div class="text-xs text-slate-500 mt-3">' +
                'Monad RPC is non-blocking — if down, the on-chain ReserveV2 cross-check is skipped and only the API value is shown above. ' +
                'API↔RPC drift &lt;5% is the expected baseline (pool-resident reserves count in the API but not in the raw RPC balance).' +
            '</div>' +
        '</div>';
    }
};
