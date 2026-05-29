/**
 * Saturn renderer — USDat (synthetic stablecoin) + sUSDat (ERC-4626 vault share).
 *
 * Single renderer registered for both slugs; the two assets share the audit
 * set, the admin EOA, and the cross-asset family panel. Asset-specific
 * divergence lives in:
 *   - asset_specific.type ('usdat' | 'susdat')
 *   - _renderHeadlineCard (different headline metrics)
 *   - _renderUsdatBackingComposition + _renderUsdatDriftProbe (USDat only)
 *   - _renderSusdatReserveSplit + _renderSusdatNavTrajectory (sUSDat only)
 *
 * Data sources:
 *   - data/usdat_backing.json + data/usdat_backing_history.json
 *   - data/susdat_backing.json + data/susdat_backing_history.json
 *   - data/saturn_family.json (async-loaded for the cross-asset family panel)
 *
 * Modeled on js/renderers/apyx.js — same Trust Stack pattern, same suppression
 * of common panels, same async family-panel load. Materially simpler than apyx
 * (no CCIP bridge, no live Accountable feed, single chain).
 */

var SATURN_ADDRS = {
    USDAT:             '0x23238f20b894f29041f48d88ee91131c395aaa71',
    SUSDAT:            '0xd166337499e176bbc38a1fbd113ab144e5bd2df7',
    USDAT_PROXY_ADMIN: '0xcf1072da5f0d127aef99136489bad08bfa3d1a7d',
    ADMIN_EOA:         '0x610182581C93687Ca03F4a8E7f124f8cEC616820',
    M_TOKEN:           '0x866A2BF4E572CbcF37D5071A7a58503Bfb36be1b',
    USDC:              '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
};

var SATURN_COLORS = {
    M:     '#10b981',  // emerald — $M (T-bill-backed)
    USDC:  '#3b82f6',  // blue — on-chain dollar
    STRC:  '#f59e0b',  // amber — oracle-attested off-chain
    OTHER: '#ef4444'   // red — would be a drift signal
};

// Editorial Liquidity scores from riskAnalyst/assets/<slug>.md frontmatter.
// Bump these when the internal report rescores; the panel renders the delta
// vs the live derived score so drift surfaces immediately.
// TODO: plumb editorial score into JSON (analyzer or static config) to
//       eliminate this manual sync — see specs/handoffs/saturn-liquidity-derivation-dashboard-backing-monitor.md.
var EDITORIAL_LIQUIDITY = {
    usdat:  7.5,
    susdat: 5.0
};

var SaturnRenderer = {

    // ============================================================
    // helpers
    // ============================================================
    _isSaturn: function(t) { return t === 'usdat' || t === 'susdat'; },

    _truncAddr: function(addr) {
        if (!addr) return '-';
        return addr.slice(0, 6) + '...' + addr.slice(-4);
    },

    _explorerLink: function(addr) {
        if (!addr) return '';
        return '<a href="https://etherscan.io/address/' + addr + '" target="_blank" rel="noopener noreferrer" ' +
            'class="text-blue-500 hover:underline text-xs" title="' + addr + '">↗</a>';
    },

    _addrCell: function(addr) {
        if (!addr) return '<span class="text-slate-400">-</span>';
        return '<span class="font-mono text-xs" title="' + addr + '">' +
            SaturnRenderer._truncAddr(addr) +
            '</span> ' + SaturnRenderer._explorerLink(addr);
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
            SaturnRenderer._statusDot(state) +
            '<span>' + label + (extra ? ' <span class="font-mono">' + extra + '</span>' : '') + '</span>' +
        '</span>';
    },

    _anchor: function(id, html) {
        if (!html || typeof html !== 'string') return html;
        return html.replace(/^(<div class="panel")/, '<div id="' + id + '" class="panel"');
    },

    _backingRatioState: function(ratio) {
        if (ratio == null) return 'unknown';
        if (ratio >= 0.999) return 'ok';
        if (ratio >= 0.99)  return 'warn';
        return 'critical';
    },

    _bufferRatioState: function(ratio) {
        if (ratio == null) return 'unknown';
        if (ratio >= 0.10) return 'ok';
        if (ratio >= 0.05) return 'warn';
        return 'critical';
    },

    _apyState: function(apy) {
        // Headline target is 11% per Saturn docs; alerter thresholds:
        //   > 8% ok, 3-8% watch, < 3% stall.
        if (apy == null) return 'unknown';
        if (apy >= 0.08) return 'ok';
        if (apy >= 0.03) return 'warn';
        return 'critical';
    },

    _pegStatusClass: function(pctValue) { return CommonRenderer.pegStatusClass(pctValue); },
    _pegStatusLabel: function(state)    { return CommonRenderer.pegStatusLabel(state); },
    _pegPctText:     function(pct, d)   { return CommonRenderer.pegPctText(pct, d); },
    _pegPctClass:    function(state)    { return CommonRenderer.pegPctClass(state); },

    // ============================================================
    // pre-render — runs before common renderer paints
    // ============================================================
    // Saturn summary blocks don't match common renderer's expected shape
    // (total_supply / total_backing / collateral_ratio / backing_breakdown).
    // We synthesize the minimum so common.js doesn't crash, then suppress
    // its panels in render() and paint the rich custom panels below.
    preRender: function(data, history) {
        var specific = data.asset_specific || {};
        if (!SaturnRenderer._isSaturn(specific.type)) return;
        var s = data.summary || {};
        data.summary = s;

        // Layer 1 (PegTracker) emits Saturn JSONs with `as_of` rather than the
        // legacy `timestamp` field, and omits `asset` / `chain` (single-chain
        // Ethereum-only product). Alias these so the common app.js header
        // (which reads data.timestamp / data.asset / data.chain) renders.
        if (!data.timestamp && data.as_of) data.timestamp = data.as_of;
        if (!data.asset) data.asset = (specific.type === 'usdat') ? 'USDat' : 'sUSDat';
        if (!data.chain) data.chain = 'ethereum';

        // Common renderSummaryCards reads s.collateral_ratio_alt.label
        // unconditionally — synthesize it then hide via card_overrides.
        if (!s.collateral_ratio_alt) {
            s.collateral_ratio_alt = { label: '_saturnAltHidden', value: 0, is_currency: false };
        }
        specific.card_overrides = specific.card_overrides || {};
        specific.card_overrides['_saturnAltHidden'] = { hidden: true };
        specific.card_overrides['Surplus / Deficit'] = { hidden: true };

        // Synthesize the common fields so the unused common renderer doesn't
        // NPE before we hide its panels. Values are overwritten in display
        // by our custom headline card.
        if (specific.type === 'usdat') {
            if (s.total_supply == null)      s.total_supply      = s.supply_usd;
            if (s.total_backing == null)     s.total_backing     = s.backing_total_usd;
            if (s.collateral_ratio == null && s.backing_ratio != null) {
                s.collateral_ratio = s.backing_ratio * 100;
            }
            if (s.surplus_deficit == null && s.net_buffer_usd != null) {
                s.surplus_deficit = s.net_buffer_usd;
            }
        } else {
            if (s.total_supply == null)  s.total_supply  = s.total_assets_usd;
            if (s.total_backing == null) s.total_backing = s.total_assets_usd;
            // sUSDat is a vault share — supply_unit signals common renderer
            // to format as "shares" not USD. But we hide the card anyway.
            if (s.collateral_ratio == null) s.collateral_ratio = 100;
            if (s.surplus_deficit == null)  s.surplus_deficit  = 0;
        }

        // backing_breakdown — empty array so common.js loops cleanly.
        if (!Array.isArray(data.backing_breakdown)) {
            data.backing_breakdown = [];
        }

        // History entries also need a synthetic collateral_ratio so the
        // common CR chart could plot — but we hide that chart anyway.
        if (history && Array.isArray(history.entries)) {
            history.entries.forEach(function(e) {
                if (e.collateral_ratio == null) {
                    if (specific.type === 'usdat' && e.backing_ratio != null) {
                        e.collateral_ratio = e.backing_ratio * 100;
                    } else {
                        e.collateral_ratio = 100;
                    }
                }
            });
        }
    },

    // ============================================================
    // entry point
    // ============================================================
    render: function(data) {
        var container = document.getElementById('asset-specific-panels');
        if (!container) return;
        var specific = data.asset_specific || {};
        if (!SaturnRenderer._isSaturn(specific.type)) return;

        SaturnRenderer._suppressCommonPanels(data);

        var slug = data.asset_slug;
        var s = data.summary || {};
        var anc = SaturnRenderer._anchor;
        var html = '';

        html += anc('panel-headline', SaturnRenderer._renderHeadlineCard(specific, s, slug));
        if (slug === 'usdat') {
            html += anc('panel-backing',   SaturnRenderer._renderUsdatBackingComposition(specific, s));
            html += anc('panel-drift',     SaturnRenderer._renderUsdatDriftProbe(specific));
        } else {
            html += anc('panel-reserve',   SaturnRenderer._renderSusdatReserveSplit(specific, s));
            html += anc('panel-nav',       SaturnRenderer._renderSusdatNavTrajectory(specific, s));
        }
        html += anc('panel-liquidity', SaturnRenderer._renderLiquidity(specific, s, slug));
        html += anc('panel-trust',     SaturnRenderer._renderTrustStack(specific, slug));
        html += '<div id="saturn-family-panel"></div>';

        container.innerHTML = html;

        SaturnRenderer._setupAnchorNav(slug);
        SaturnRenderer._setupCompanionLink(slug);

        // Post-render chart paints — DOM nodes must exist first.
        if (slug === 'usdat') {
            SaturnRenderer._renderUsdatBackingDonut(specific);
        } else {
            SaturnRenderer._renderSusdatReserveDonut(specific);
            SaturnRenderer._loadSusdatNavChart(slug, s);
        }
        SaturnRenderer._loadPegHistoryChart(slug, s);
        SaturnRenderer._loadFamilyPanel(slug);
    },

    _suppressCommonPanels: function(data) {
        // Hide the top summary-card strip — our §1 Headline card carries
        // richer per-asset metrics (NAV, buffer ratio, paused, on-chain
        // verifiability badge) with proper context.
        var summaryCards = document.getElementById('summary-cards');
        if (summaryCards) summaryCards.style.display = 'none';

        // Hide the common CR History chart — for USDat the meaningful trend
        // is the supply/backing ratio (always ~100% by design), and for sUSDat
        // it's the NAV trajectory; both have dedicated panels below.
        var chartPanel = document.getElementById('chart-panel');
        if (chartPanel) chartPanel.style.display = 'none';

        // Hide the default breakdown table + pie chart — we use a custom
        // composition donut + verifiability-tiered table.
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

        // Risk flags: hide when only "No risk flags" would render — structural
        // caveats are surfaced in Trust Stack + Reserve panels; a green
        // placeholder here misleads. Stretch the panel when real flags fire.
        var hasRealFlags = data && Array.isArray(data.risk_flags) && data.risk_flags.length > 0;
        var risk = document.getElementById('risk-flags');
        if (risk) {
            var riskPanel = risk.closest('.panel');
            if (riskPanel) {
                if (!hasRealFlags) {
                    riskPanel.style.display = 'none';
                } else {
                    var wrapper = riskPanel.parentElement;
                    if (wrapper && !wrapper.classList.contains('lg:col-span-3')) {
                        wrapper.classList.add('lg:col-span-3');
                    }
                }
            }
        }
    },

    _setupAnchorNav: function(slug) {
        var navEl = document.getElementById('asset-anchor-nav');
        var inner = document.getElementById('asset-anchor-nav-inner');
        if (!navEl || !inner) return;

        var items;
        if (slug === 'usdat') {
            items = [
                { id: 'panel-headline',       label: 'Asset' },
                { id: 'panel-backing',        label: 'Backing' },
                { id: 'panel-drift',          label: 'Drift' },
                { id: 'panel-liquidity',      label: 'Liquidity' },
                { id: 'panel-trust',          label: 'Trust' },
                { id: 'saturn-family-panel',  label: 'Family' }
            ];
        } else if (slug === 'susdat') {
            items = [
                { id: 'panel-headline',       label: 'Asset' },
                { id: 'panel-reserve',        label: 'Reserve' },
                { id: 'panel-nav',            label: 'NAV' },
                { id: 'panel-liquidity',      label: 'Liquidity' },
                { id: 'panel-trust',          label: 'Trust' },
                { id: 'saturn-family-panel',  label: 'Family' }
            ];
        } else {
            return;
        }

        inner.innerHTML = items.map(function(item) {
            return '<a href="#' + item.id + '" ' +
                   'class="text-slate-600 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400 ' +
                   'px-2 py-0.5 rounded transition-colors">' +
                   item.label +
                   '</a>';
        }).join('');
        navEl.classList.remove('hidden');
    },

    _setupCompanionLink: function(slug) {
        var link = document.getElementById('header-companion-link');
        if (!link) return;
        var sibling, label;
        if (slug === 'usdat')       { sibling = 'susdat'; label = 'View sUSDat ↗'; }
        else if (slug === 'susdat') { sibling = 'usdat';  label = 'View USDat ↗'; }
        else return;
        link.setAttribute('href', '?asset=' + sibling);
        link.textContent = label;
        link.classList.remove('hidden');
    },

    // ============================================================
    // §1 Headline card
    // ============================================================
    _renderHeadlineCard: function(specific, s, slug) {
        var pausedState = s.paused ? 'critical' : 'ok';
        var pausedLabel = s.paused ? 'PAUSED' : 'Active';
        var chainBadge =
            '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">Ethereum</span>';

        var headerLeft, metricsRow, badgeRow;

        if (slug === 'usdat') {
            headerLeft =
                '<div class="text-xl font-bold text-slate-800">USDat</div>' +
                '<div class="text-xs text-slate-500 mt-1">Saturn Labs · Synthetic stablecoin, $M + USDC backed (on-chain verifiable)</div>';

            var ratioState = SaturnRenderer._backingRatioState(s.backing_ratio);
            var ratioCls = ratioState === 'ok' ? 'text-green-600' :
                           ratioState === 'warn' ? 'text-amber-600' : 'text-red-600';
            var ratioTxt = (s.backing_ratio != null) ? (s.backing_ratio * 100).toFixed(4) + '%' : '—';
            var pegState = SaturnRenderer._pegStatusClass(s.peg_deviation_pct);
            var pegCls   = SaturnRenderer._pegPctClass(pegState);

            metricsRow =
                '<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">' +
                    '<div><div class="text-xs text-slate-400 font-medium uppercase">Supply</div>' +
                        '<div class="text-lg font-bold text-slate-800">' + CommonRenderer.formatCurrency(s.supply_usd) + '</div></div>' +
                    '<div><div class="text-xs text-slate-400 font-medium uppercase">Backing Ratio</div>' +
                        '<div class="text-lg font-bold ' + ratioCls + '">' + ratioTxt + '</div>' +
                        (function() {
                            var buf = s.net_buffer_usd;
                            if (buf == null) return '';
                            var sign = buf >= 0 ? '+' : '−';
                            var bufCls = buf >= 0 ? 'text-green-600' : 'text-red-600';
                            var bufMag = (Math.abs(buf) >= 1e6) ?
                                '$' + (Math.abs(buf) / 1e6).toFixed(2) + 'M' :
                                '$' + Math.abs(buf).toLocaleString('en-US', { maximumFractionDigits: 0 });
                            return '<div class="text-xs text-slate-500 mt-0.5">' +
                                'Buffer: <span class="font-mono ' + bufCls + '">' + sign + bufMag + '</span>' +
                            '</div>';
                        })() +
                    '</div>' +
                    '<div><div class="text-xs text-slate-400 font-medium uppercase">Curve Peg</div>' +
                        '<div class="text-lg font-bold text-slate-800">' +
                            (s.peg_curve_usdc != null ? '$' + s.peg_curve_usdc.toFixed(4) : '—') +
                        '</div>' +
                        '<div class="text-xs ' + pegCls + ' mt-0.5 font-mono">' +
                            SaturnRenderer._pegPctText(s.peg_deviation_pct, 3) +
                        '</div>' +
                    '</div>' +
                    '<div><div class="text-xs text-slate-400 font-medium uppercase">Status</div>' +
                        '<div class="text-lg">' + SaturnRenderer._statusPill(pausedLabel, pausedState) + '</div></div>' +
                '</div>';

            var driftClean = !(specific.drift_probe && specific.drift_probe.tier1_drift_flagged);
            var driftLabel = driftClean ? 'Allowlist clean' : 'Allowlist BREACH';
            var driftState = driftClean ? 'ok' : 'critical';

            badgeRow =
                '<div class="flex flex-wrap items-center gap-2 mt-3">' +
                    SaturnRenderer._onChainVerifiableBadge(true) +
                    SaturnRenderer._statusPill(driftLabel, driftState) +
                '</div>';
        } else {
            // sUSDat
            headerLeft =
                '<div class="text-xl font-bold text-slate-800">sUSDat</div>' +
                '<div class="text-xs text-slate-500 mt-1">Saturn Labs · ERC-4626 vault share over USDat (on-chain buffer + off-chain STRC)</div>';

            var nav = s.nav_per_share;
            var apy = s.implied_apy_30d;
            var apyState = SaturnRenderer._apyState(apy);
            var apyCls = apyState === 'ok' ? 'text-green-600' :
                         apyState === 'warn' ? 'text-amber-600' : 'text-red-600';
            var apyTxt = (apy != null) ? (apy * 100).toFixed(2) + '%' : '—';

            metricsRow =
                '<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">' +
                    '<div><div class="text-xs text-slate-400 font-medium uppercase">Total Assets</div>' +
                        '<div class="text-lg font-bold text-slate-800">' + CommonRenderer.formatCurrency(s.total_assets_usd) + '</div>' +
                        '<div class="text-xs text-slate-500 mt-0.5">USDat-denominated</div></div>' +
                    '<div><div class="text-xs text-slate-400 font-medium uppercase">NAV per share</div>' +
                        '<div class="text-lg font-bold text-slate-800">' +
                            (nav != null ? nav.toFixed(6) : '—') +
                        '</div>' +
                        '<div class="text-xs text-slate-500 mt-0.5">USDat per share (not $/share)</div></div>' +
                    '<div><div class="text-xs text-slate-400 font-medium uppercase">Implied APY (30d)</div>' +
                        '<div class="text-lg font-bold ' + apyCls + '">' + apyTxt + '</div>' +
                        '<div class="text-xs text-slate-500 mt-0.5">vs 11% target</div></div>' +
                    '<div><div class="text-xs text-slate-400 font-medium uppercase">Status</div>' +
                        '<div class="text-lg">' + SaturnRenderer._statusPill(pausedLabel, pausedState) + '</div></div>' +
                '</div>';

            var bufRatio = s.buffer_ratio;
            var bufState = SaturnRenderer._bufferRatioState(bufRatio);
            var bufPctTxt = (bufRatio != null) ? (bufRatio * 100).toFixed(2) + '% on-chain buffer' : 'buffer ratio —';
            var sc = specific.self_consistency || {};
            var scState = (sc.delta_bps != null && sc.delta_bps < 1) ? 'ok' : 'warn';
            var scLabel = (scState === 'ok') ? 'Self-consistency ✓' : 'Self-consistency drift';
            var scExtra = (sc.delta_bps != null) ? sc.delta_bps.toFixed(3) + ' bps' : '';

            badgeRow =
                '<div class="flex flex-wrap items-center gap-2 mt-3">' +
                    SaturnRenderer._statusPill(bufPctTxt, bufState) +
                    SaturnRenderer._statusPill(scLabel, scState, scExtra) +
                '</div>';
        }

        return '<div class="panel">' +
            '<div class="flex items-start justify-between gap-4">' +
                '<div>' + headerLeft + '</div>' +
                '<div class="flex flex-wrap gap-1 justify-end">' + chainBadge + '</div>' +
            '</div>' +
            metricsRow +
            badgeRow +
        '</div>';
    },

    // The Saturn USP — distinct from regular status pills.
    _onChainVerifiableBadge: function(active) {
        if (!active) return '';
        return '<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ' +
            'bg-emerald-50 text-emerald-800 border border-emerald-200" ' +
            'title="USDat backing is verifiable on-chain via three balanceOf reads. See verification commands below.">' +
            '<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">' +
                '<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />' +
            '</svg>' +
            '100% On-Chain Verifiable' +
        '</span>';
    },

    // ============================================================
    // §2u USDat Backing Composition  (USDat only — the marquee panel)
    // ============================================================
    _renderUsdatBackingComposition: function(specific, s) {
        var comp = specific.composition || {};
        var rows = [];

        function row(label, data, color, verifyHtml) {
            var bal = data && data.balance;
            var pct = data && data.pct_of_supply;
            return '<tr>' +
                '<td class="font-medium">' +
                    '<span class="inline-block w-2.5 h-2.5 rounded-sm mr-2 align-middle" style="background:' + color + '"></span>' +
                    label +
                '</td>' +
                '<td class="text-right font-mono">' + (bal != null ? CommonRenderer.formatCurrencyExact(bal) : '—') + '</td>' +
                '<td class="text-right font-mono">' + (pct != null ? (pct * 100).toFixed(2) + '%' : '—') + '</td>' +
                '<td>' + verifyHtml + '</td>' +
            '</tr>';
        }

        var verifyOnchain = '<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">✓ on-chain</span>';

        if (comp.M)    rows.push(row('$M  <span class="text-xs text-slate-500 font-normal">(M^0 T-bill backed)</span>', comp.M, SATURN_COLORS.M, verifyOnchain));
        if (comp.USDC) rows.push(row('USDC',                                                                              comp.USDC, SATURN_COLORS.USDC, verifyOnchain));

        // OTHER is an array of non-allowlist holdings from the drift probe. Each entry
        // carries .flagged — true for ≥$10K real drift (loud red row each), false for
        // sub-threshold airdrop dust (collapsed into one quiet grey row). See
        // saturn_backing_analyzer.py scan_drift + handoff usdat-drift-probe-dollar-filter.
        var other = comp.OTHER;
        if (Array.isArray(other) && other.length > 0) {
            var flaggedOther = other.filter(function(o) { return o.flagged === true; });
            var dustOther    = other.filter(function(o) { return o.flagged !== true; });

            flaggedOther.forEach(function(o) {
                var verifyBreach = '<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200" ' +
                    'title="Non-allowlist ERC20 (≥$10K) held by USDat treasury — investigate.">⚠ drift</span>';
                rows.push(row(
                    (o.symbol || 'Unknown') + ' <span class="text-xs text-slate-500 font-mono">' + SaturnRenderer._truncAddr(o.address || '') + '</span>',
                    o, SATURN_COLORS.OTHER, verifyBreach));
            });

            if (dustOther.length > 0) {
                var drift   = specific.drift_probe || {};
                var dustN   = drift.airdrop_dust_count != null ? drift.airdrop_dust_count : dustOther.length;
                var dustUsd = drift.airdrop_dust_total_usd || 0;
                var thresh  = drift.drift_value_threshold_usd || 10000;
                rows.push('<tr class="text-slate-400">' +
                    '<td>' +
                        '<span class="inline-block w-2.5 h-2.5 rounded-sm mr-2 align-middle" style="background:' + SATURN_COLORS.OTHER + ';opacity:0.3"></span>' +
                        'Airdrop dust <span class="text-xs">(' + dustN + ' tokens &lt; $' + thresh.toLocaleString() + ')</span>' +
                    '</td>' +
                    '<td class="text-right font-mono">' + (dustUsd > 0 ? CommonRenderer.formatCurrencyExact(dustUsd) : '$0') + '</td>' +
                    '<td class="text-right font-mono">≈ 0%</td>' +
                    '<td><span class="text-xs text-slate-400 italic">filtered, no exit value</span></td>' +
                '</tr>');
            }
        } else {
            // Explicit Other = 0 line — the absence of this row would hide
            // the signal that allowlist breach is monitored.
            rows.push('<tr class="text-slate-400">' +
                '<td>' +
                    '<span class="inline-block w-2.5 h-2.5 rounded-sm mr-2 align-middle" style="background:' + SATURN_COLORS.OTHER + ';opacity:0.3"></span>' +
                    'Other (non-allowlist ERC20)' +
                '</td>' +
                '<td class="text-right font-mono">$0</td>' +
                '<td class="text-right font-mono">0.00%</td>' +
                '<td><span class="text-xs text-slate-400 italic">monitored, clean</span></td>' +
            '</tr>');
        }

        var totalBacking = s.backing_total_usd;
        var supply = s.supply_usd;
        var ratio = s.backing_ratio;
        var ratioCls = (ratio != null && ratio >= 0.999) ? 'text-green-600' : 'text-red-600';

        rows.push('<tr class="font-bold border-t-2 border-slate-200">' +
            '<td>Total backing</td>' +
            '<td class="text-right font-mono">' + CommonRenderer.formatCurrencyExact(totalBacking) + '</td>' +
            '<td class="text-right font-mono ' + ratioCls + '">' +
                (ratio != null ? (ratio * 100).toFixed(4) + '%' : '—') +
            '</td>' +
            '<td></td>' +
        '</tr>');

        var headerRight =
            '<div class="flex items-center gap-2">' +
                SaturnRenderer._onChainVerifiableBadge(true) +
            '</div>';

        var donutBlock =
            '<div class="grid grid-cols-1 lg:grid-cols-5 gap-6">' +
                '<div class="lg:col-span-3">' +
                    '<div class="text-sm font-semibold text-slate-700 mb-2">Backing split</div>' +
                    '<div class="data-table-scroll">' +
                        '<table class="data-table">' +
                            '<thead><tr>' +
                                '<th>Asset</th>' +
                                '<th class="text-right">Balance</th>' +
                                '<th class="text-right">% of supply</th>' +
                                '<th>Verifiability</th>' +
                            '</tr></thead>' +
                            '<tbody>' + rows.join('') + '</tbody>' +
                        '</table>' +
                    '</div>' +
                    '<div class="text-xs text-slate-500 mt-2">' +
                        'Supply ' + CommonRenderer.formatCurrencyExact(supply) +
                        (s.net_buffer_usd != null ?
                            ' · Net buffer <span class="font-mono">' + CommonRenderer.formatCurrencyExact(s.net_buffer_usd) + '</span>' :
                            '') +
                    '</div>' +
                '</div>' +
                '<div class="lg:col-span-2">' +
                    '<div class="text-sm font-semibold text-slate-700 mb-2">Composition</div>' +
                    '<div style="height: 240px; position: relative;">' +
                        '<canvas id="saturn-usdat-donut"></canvas>' +
                    '</div>' +
                '</div>' +
            '</div>';

        // Reveal-on-click verification commands — the Saturn USP made literal.
        var verifyBlock = SaturnRenderer._renderVerifyCommands();

        var methodology =
            '<div class="text-xs text-slate-500 italic leading-relaxed mt-4 pt-3 border-t border-slate-200">' +
                'USDat treasury holds $M and USDC at the token contract address. Every dollar is readable ' +
                'on-chain via <span class="font-mono">balanceOf</span> — no oracle, no enclave, no off-chain ' +
                'custodian to trust. <strong>On-chain verification stops at $M.</strong> $M itself is T-bill ' +
                'backed by M^0\'s federated minters off-chain; the $M issuer\'s reserves are a separate ' +
                'trust layer beyond Saturn\'s control.' +
            '</div>';

        return '<div class="panel">' +
            '<div class="flex items-center justify-between">' +
                '<div class="panel-title" style="margin-bottom:0;">Backing Composition</div>' +
                headerRight +
            '</div>' +
            '<div style="margin-bottom:1rem;"></div>' +
            donutBlock +
            verifyBlock +
            methodology +
        '</div>';
    },

    _renderVerifyCommands: function() {
        var cmds =
            '# 1. USDat supply\n' +
            'cast call ' + SATURN_ADDRS.USDAT + ' "totalSupply()(uint256)" \\\n' +
            '     --rpc-url $RPC\n\n' +
            '# 2. $M held by USDat\n' +
            'cast call ' + SATURN_ADDRS.M_TOKEN + ' \\\n' +
            '     "balanceOf(address)(uint256)" \\\n' +
            '     ' + SATURN_ADDRS.USDAT + ' \\\n' +
            '     --rpc-url $RPC\n\n' +
            '# 3. USDC held by USDat\n' +
            'cast call ' + SATURN_ADDRS.USDC + ' \\\n' +
            '     "balanceOf(address)(uint256)" \\\n' +
            '     ' + SATURN_ADDRS.USDAT + ' \\\n' +
            '     --rpc-url $RPC\n\n' +
            '# Sum (2) + (3), divide by 1e6, compare to (1) / 1e6.';

        return '<details class="mt-4 group">' +
            '<summary class="cursor-pointer text-sm font-semibold text-emerald-700 hover:text-emerald-900 select-none" ' +
                'style="list-style:none;">' +
                '<span class="inline-block transform group-open:rotate-90 transition-transform">▶</span> ' +
                'Show verification commands' +
            '</summary>' +
            '<div class="mt-2 relative">' +
                '<button onclick="SaturnRenderer._copyVerify(this)" ' +
                    'class="absolute top-2 right-2 px-2 py-0.5 text-xs rounded bg-slate-700 text-slate-100 hover:bg-slate-600 transition-colors">' +
                    'Copy' +
                '</button>' +
                '<pre id="saturn-verify-cmds" class="text-xs bg-slate-900 text-slate-100 p-3 pr-16 rounded overflow-x-auto font-mono leading-relaxed">' +
                    cmds +
                '</pre>' +
                '<div class="text-xs text-slate-400 italic mt-2">' +
                    'Set <span class="font-mono">$RPC</span> to any Ethereum mainnet endpoint. ' +
                    'You should get the same numbers shown in the table above (within block-timing tolerance).' +
                '</div>' +
            '</div>' +
        '</details>';
    },

    _copyVerify: function(btn) {
        var pre = document.getElementById('saturn-verify-cmds');
        if (!pre) return;
        var text = pre.textContent || pre.innerText;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function() {
                var orig = btn.textContent;
                btn.textContent = 'Copied!';
                setTimeout(function() { btn.textContent = orig; }, 1500);
            });
        }
    },

    _renderUsdatBackingDonut: function(specific) {
        var ctx = document.getElementById('saturn-usdat-donut');
        if (!ctx || typeof Chart === 'undefined') return;
        var comp = specific.composition || {};

        var labels = [];
        var values = [];
        var colors = [];
        if (comp.M)    { labels.push('$M');   values.push(comp.M.balance || 0);    colors.push(SATURN_COLORS.M); }
        if (comp.USDC) { labels.push('USDC'); values.push(comp.USDC.balance || 0); colors.push(SATURN_COLORS.USDC); }
        if (Array.isArray(comp.OTHER)) {
            comp.OTHER.forEach(function(o) {
                labels.push(o.symbol || 'Other');
                values.push(o.balance || 0);
                colors.push(SATURN_COLORS.OTHER);
            });
        }

        if (window._saturnUsdatDonut) {
            try { window._saturnUsdatDonut.destroy(); } catch (e) {}
        }
        window._saturnUsdatDonut = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: colors,
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '60%',
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
    // §3u USDat Drift Probe  (USDat only)
    // ============================================================
    _renderUsdatDriftProbe: function(specific) {
        var drift = specific.drift_probe || {};
        var allowlist = drift.allowlist || ['M', 'USDC'];
        var breaches = drift.non_allowlist_holdings || [];
        var flagged = drift.tier1_drift_flagged === true;

        var dustN = drift.airdrop_dust_count || 0;
        var dustThresh = drift.drift_value_threshold_usd || 10000;
        var dustNote = dustN > 0
            ? '<div class="text-xs text-slate-400 mt-2">Sub-threshold dust filtered: ' +
                '<span class="font-mono">' + dustN + '</span> non-allowlist tokens below $' +
                dustThresh.toLocaleString() + ' (typically airdrop spam — no liquid market, $0 exit value).</div>'
            : '';

        if (!flagged) {
            // Quiet green state — one-line confirmation, low visual weight.
            return '<div class="panel">' +
                '<div class="panel-title">Drift Probe <span class="text-xs font-normal text-slate-500">— composition watchdog</span></div>' +
                '<div class="risk-flag" style="background:#dcfce7;color:#166534;border-left:4px solid #22c55e;">' +
                    '<strong>✓ Treasury allowlist clean.</strong> ' +
                    'Allowlist: <span class="font-mono">' + allowlist.join(', ') + '</span>. ' +
                    'Any non-allowlist ERC20 (STRC, SATA, etc.) appearing in treasury would fire a tier-1 backing-composition-drift alert.' +
                '</div>' +
                '<div class="text-xs text-slate-500 italic leading-relaxed mt-3">' +
                    'Saturn docs disclose a planned future rotation toward STRC (Strategy digital credit). ' +
                    'Until that activates, any non-allowlist token in the USDat treasury is a tier-1 ' +
                    'backing-composition-drift signal — both intentional rotation and unauthorized minting ' +
                    'would surface here.' +
                '</div>' +
                dustNote +
            '</div>';
        }

        // BREACH STATE — promoted to full red callout. Dust entries stay out of this
        // table even when a separate real breach is firing.
        var flaggedBreaches = breaches.filter(function(b) { return b.flagged === true; });
        var breachRows = flaggedBreaches.map(function(b) {
            return '<tr>' +
                '<td class="font-semibold text-red-700">' + (b.symbol || 'Unknown') + '</td>' +
                '<td>' + SaturnRenderer._addrCell(b.address) + '</td>' +
                '<td class="text-right font-mono">' + CommonRenderer.formatCurrencyExact(b.value_usd || 0) + '</td>' +
            '</tr>';
        }).join('');

        return '<div class="panel">' +
            '<div class="panel-title">Drift Probe <span class="text-xs font-normal text-red-600">— ALLOWLIST BREACH</span></div>' +
            '<div class="risk-flag risk-critical">' +
                '<strong>🚨 Backing composition drift detected.</strong> ' +
                'A non-allowlist ERC20 is held by the USDat treasury. ' +
                'This may reflect the planned STRC rotation or an unauthorized minting/transfer — investigate immediately.' +
            '</div>' +
            '<table class="data-table mt-3">' +
                '<thead><tr><th>Token</th><th>Address</th><th class="text-right">Value (USD)</th></tr></thead>' +
                '<tbody>' + breachRows + '</tbody>' +
            '</table>' +
            dustNote +
        '</div>';
    },

    // ============================================================
    // §2s sUSDat Reserve Split  (sUSDat only)
    // ============================================================
    _renderSusdatReserveSplit: function(specific, s) {
        var rs = specific.reserve_split || {};
        var on = rs.onchain_usdat || {};
        var off = rs.offchain_strc || {};
        var totalAssets = s.total_assets_usd;

        var verifyOn = '<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200" title="USDat held by sUSDat vault — readable via USDat.balanceOf(sUSDat).">✓ on-chain</span>';
        var verifyOff = '<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200" title="STRC NAV is reported via sUSDat.totalAssets() but not independently verified by an oracle or PoR feed. Accountable + Chainlink NAV oracle planned, not live.">⚠ oracle-unverified</span>';

        var resRows = '';
        resRows += '<tr>' +
            '<td class="font-medium">' +
                '<span class="inline-block w-2.5 h-2.5 rounded-sm mr-2 align-middle" style="background:' + SATURN_COLORS.USDC + '"></span>' +
                'On-chain USDat buffer' +
            '</td>' +
            '<td class="text-right font-mono">' + CommonRenderer.formatCurrencyExact(on.value_usd) + '</td>' +
            '<td class="text-right font-mono">' + (on.pct != null ? (on.pct * 100).toFixed(2) + '%' : '—') + '</td>' +
            '<td>' + verifyOn + '</td>' +
        '</tr>';
        resRows += '<tr>' +
            '<td class="font-medium">' +
                '<span class="inline-block w-2.5 h-2.5 rounded-sm mr-2 align-middle" style="background:' + SATURN_COLORS.STRC + '"></span>' +
                'Off-chain STRC (Strategy digital credit)' +
            '</td>' +
            '<td class="text-right font-mono">' + CommonRenderer.formatCurrencyExact(off.value_usd) + '</td>' +
            '<td class="text-right font-mono">' + (off.pct != null ? (off.pct * 100).toFixed(2) + '%' : '—') + '</td>' +
            '<td>' + verifyOff + '</td>' +
        '</tr>';
        resRows += '<tr class="font-bold border-t-2 border-slate-200">' +
            '<td>Total assets</td>' +
            '<td class="text-right font-mono">' + CommonRenderer.formatCurrencyExact(totalAssets) + '</td>' +
            '<td class="text-right">100.00%</td>' +
            '<td><span class="text-xs text-slate-500">via totalAssets()</span></td>' +
        '</tr>';

        // Self-consistency pill — the on-chain check that NAV × supply ≈ totalAssets.
        var sc = specific.self_consistency || {};
        var scState = (sc.delta_bps != null && sc.delta_bps < 1) ? 'ok' :
                      (sc.delta_bps != null && sc.delta_bps < 100) ? 'warn' : 'critical';
        var scPill = SaturnRenderer._statusPill(
            'Self-consistency: ' + (scState === 'ok' ? '✓' : 'drift'),
            scState,
            (sc.delta_bps != null) ? sc.delta_bps.toFixed(3) + ' bps' : ''
        );

        // LTV-band table — published thresholds (analyzer can't supply current_strc_target_pct yet).
        var lb = specific.ltv_band || {};
        var bands = Array.isArray(lb.published_thresholds) ? lb.published_thresholds : [];
        var ltvRows = bands.map(function(b) {
            return '<tr>' +
                '<td class="font-mono text-right">&lt; ' + (b.max_ltv * 100).toFixed(2) + '%</td>' +
                '<td class="font-mono text-right">' + (b.strc_pct * 100).toFixed(0) + '%</td>' +
            '</tr>';
        }).join('');
        // The terminal threshold per Saturn docs — when LTV > 100% the policy is 0% STRC.
        ltvRows += '<tr><td class="font-mono text-right">&gt; 100.00%</td><td class="font-mono text-right">0%</td></tr>';

        var currentLtv = lb.current_strc_target_pct;
        var ltvHeader = (currentLtv != null) ?
            'Current target: <span class="font-mono">' + (currentLtv * 100).toFixed(2) + '% STRC</span>' :
            '<span class="italic text-slate-400">Current LTV not available (no live Strategy NAV input)</span>';

        var donutBlock =
            '<div class="grid grid-cols-1 lg:grid-cols-5 gap-6">' +
                '<div class="lg:col-span-3">' +
                    '<div class="flex items-center justify-between mb-2">' +
                        '<div class="text-sm font-semibold text-slate-700">Reserve split</div>' +
                        scPill +
                    '</div>' +
                    '<div class="data-table-scroll">' +
                        '<table class="data-table">' +
                            '<thead><tr>' +
                                '<th>Component</th>' +
                                '<th class="text-right">USD value</th>' +
                                '<th class="text-right">%</th>' +
                                '<th>Verifiability</th>' +
                            '</tr></thead>' +
                            '<tbody>' + resRows + '</tbody>' +
                        '</table>' +
                    '</div>' +
                '</div>' +
                '<div class="lg:col-span-2">' +
                    '<div class="text-sm font-semibold text-slate-700 mb-2">Composition</div>' +
                    '<div style="height: 240px; position: relative;">' +
                        '<canvas id="saturn-susdat-donut"></canvas>' +
                    '</div>' +
                '</div>' +
            '</div>';

        var ltvBlock =
            '<div class="mt-6">' +
                '<div class="flex items-center justify-between mb-2">' +
                    '<div class="text-sm font-semibold text-slate-700">LTV-band policy <span class="text-xs font-normal text-slate-500">(published — STRC % vs Strategy LTV)</span></div>' +
                    '<div class="text-xs text-slate-500">' + ltvHeader + '</div>' +
                '</div>' +
                '<div class="data-table-scroll" style="max-width:360px;">' +
                    '<table class="data-table">' +
                        '<thead><tr><th class="text-right">If LTV is</th><th class="text-right">Target STRC</th></tr></thead>' +
                        '<tbody>' + ltvRows + '</tbody>' +
                    '</table>' +
                '</div>' +
            '</div>';

        var methodology =
            '<div class="text-xs text-slate-500 italic leading-relaxed mt-4 pt-3 border-t border-slate-200">' +
                '<strong>~19% on-chain, ~81% oracle-unverified</strong> — the USDat buffer is readable directly ' +
                'via <span class="font-mono">USDat.balanceOf(sUSDat)</span>; the STRC leg is reported by ' +
                'the vault\'s own <span class="font-mono">totalAssets()</span> with no independent oracle ' +
                'or proof-of-reserves verifying the off-chain custodian. Accountable + Chainlink NAV oracle ' +
                'pipeline is planned but not live as of this snapshot — until the feed activates, the 81% ' +
                'leg relies on the contract\'s own report (trust-the-oracle, where the contract is the ' +
                'oracle). Self-consistency only proves NAV × supply ≈ totalAssets — it does not prove the ' +
                'STRC actually exists at the reported value.' +
            '</div>';

        return '<div class="panel">' +
            '<div class="flex items-center justify-between">' +
                '<div class="panel-title" style="margin-bottom:0;">Reserve Composition</div>' +
                '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">Mixed verification</span>' +
            '</div>' +
            '<div style="margin-bottom:1rem;"></div>' +
            donutBlock +
            ltvBlock +
            methodology +
        '</div>';
    },

    _renderSusdatReserveDonut: function(specific) {
        var ctx = document.getElementById('saturn-susdat-donut');
        if (!ctx || typeof Chart === 'undefined') return;
        var rs = specific.reserve_split || {};
        var on = rs.onchain_usdat || {};
        var off = rs.offchain_strc || {};

        if (window._saturnSusdatDonut) {
            try { window._saturnSusdatDonut.destroy(); } catch (e) {}
        }
        window._saturnSusdatDonut = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['USDat buffer (on-chain)', 'STRC (oracle-unverified)'],
                datasets: [{
                    data: [on.value_usd || 0, off.value_usd || 0],
                    backgroundColor: [SATURN_COLORS.USDC, SATURN_COLORS.STRC],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '60%',
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
    // §3s sUSDat NAV Trajectory  (sUSDat only)
    // ============================================================
    _renderSusdatNavTrajectory: function(specific, s) {
        var apy30 = s.implied_apy_30d;
        var apyTxt = (apy30 != null) ? (apy30 * 100).toFixed(2) + '%' : '—';
        var apyState = SaturnRenderer._apyState(apy30);
        var apyCls = SaturnRenderer._pegPctClass(apyState === 'ok' ? 'ok' : apyState === 'warn' ? 'warn' : 'critical');
        var apyLabel = (apyState === 'ok') ? 'On track' :
                       (apyState === 'warn') ? 'Below target' :
                       (apyState === 'critical') ? 'Stalled' : '—';

        var statCards =
            '<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">' +
                '<div class="summary-card"><div class="card-label">NAV per share</div>' +
                    '<div class="card-value">' + (s.nav_per_share != null ? s.nav_per_share.toFixed(6) : '—') + '</div>' +
                    '<div class="text-xs text-slate-400 mt-1">USDat per share (not $/share)</div></div>' +
                '<div class="summary-card"><div class="card-label">$ NAV per share</div>' +
                    '<div class="card-value">' + (
                        (s.nav_per_share != null && s.peg_curve_usdc != null)
                            ? '$' + (s.nav_per_share * s.peg_curve_usdc).toFixed(4)
                            : '—'
                    ) + '</div>' +
                    '<div class="text-xs text-slate-400 mt-1">' + (
                        (s.nav_per_share != null && s.peg_curve_usdc != null)
                            ? s.nav_per_share.toFixed(6) + ' USDat × $' + s.peg_curve_usdc.toFixed(4) + ' (Curve)'
                            : 'Curve-implied USDat × 4626 NAV'
                    ) + '</div></div>' +
                '<div class="summary-card"><div class="card-label">30d implied APY</div>' +
                    '<div class="card-value ' + apyCls + '">' + apyTxt + '</div>' +
                    '<div class="mt-1">' + SaturnRenderer._statusPill(apyLabel, apyState) + '</div></div>' +
                '<div class="summary-card"><div class="card-label">Headline target</div>' +
                    '<div class="card-value">11.00%</div>' +
                    '<div class="text-xs text-slate-400 mt-1">Saturn docs APY target</div></div>' +
            '</div>';

        var chartBlock =
            '<div class="mt-6">' +
                '<div class="text-sm font-semibold text-slate-700 mb-2">' +
                    'NAV per share — 30d' +
                    ' <span class="text-xs font-normal text-slate-500">(solid = actual · dashed = 11% target line)</span>' +
                '</div>' +
                '<div style="height: 320px; position: relative;">' +
                    '<canvas id="saturn-susdat-nav-chart"></canvas>' +
                '</div>' +
            '</div>';

        var methodology =
            '<div class="text-xs text-slate-500 italic leading-relaxed mt-4 pt-3 border-t border-slate-200">' +
                'NAV must monotonically rise under ERC-4626 vesting — a drop between cycles implies an ' +
                'STRC loss event. 30-day vesting design intentionally delays yield landing, so a fresh ' +
                'sUSDat position accrues with a lag for its first 30 days. Implied APY is computed from ' +
                'the NAV slope over the trailing window; the 11% headline target is a Saturn-disclosed ' +
                'design number, not a guarantee. sUSDat NAV is denominated in USDat (the vault\'s underlying), ' +
                'not USD. USDat\'s own peg deviation stacks on top, so $-equivalent NAV ≈ 4626 NAV × current USDat peg.' +
            '</div>';

        return '<div class="panel">' +
            '<div class="panel-title">NAV Trajectory <span class="text-xs font-normal text-slate-500">— yield landing</span></div>' +
            statCards +
            chartBlock +
            methodology +
        '</div>';
    },

    _loadSusdatNavChart: function(slug, s) {
        var ctx = document.getElementById('saturn-susdat-nav-chart');
        if (!ctx || typeof Chart === 'undefined') return;
        var nocache = Math.floor(Date.now() / 60000);
        fetch('data/' + slug + '_backing_history.json?nocache=' + nocache)
            .then(function(r) { return r.ok ? r.json() : null; })
            .then(function(hist) {
                if (!hist || !Array.isArray(hist.entries) || hist.entries.length < 2) {
                    ctx.parentElement.innerHTML = '<div class="text-xs text-slate-400 italic">NAV history not yet available — chart populates after a few hours of samples.</div>';
                    return;
                }
                SaturnRenderer._drawSusdatNavChart(ctx, hist.entries);
            })
            .catch(function() {
                ctx.parentElement.innerHTML = '<div class="text-xs text-slate-400 italic">NAV history unavailable.</div>';
            });
    },

    _drawSusdatNavChart: function(ctx, entries) {
        var cutoff = Date.now() - 30 * 24 * 3600 * 1000;
        var windowed = entries.filter(function(e) {
            var ts = e.timestamp.endsWith('Z') ? e.timestamp : (e.timestamp + 'Z');
            return new Date(ts).getTime() >= cutoff && e.nav_per_share != null;
        });
        if (windowed.length < 2) {
            ctx.parentElement.innerHTML = '<div class="text-xs text-slate-400 italic">NAV history not yet available — chart populates after a few hours of samples.</div>';
            return;
        }

        var labels = windowed.map(function(e) {
            var ts = e.timestamp.endsWith('Z') ? e.timestamp : (e.timestamp + 'Z');
            return new Date(ts);
        });
        var navSeries = windowed.map(function(e) { return e.nav_per_share; });

        // 11% APY target line — extrapolated from the first NAV sample.
        var navStart = windowed[0].nav_per_share;
        var tsStart = new Date(windowed[0].timestamp.endsWith('Z') ? windowed[0].timestamp : windowed[0].timestamp + 'Z').getTime();
        var apyTarget = 0.11;
        var targetSeries = windowed.map(function(e) {
            var ts = new Date(e.timestamp.endsWith('Z') ? e.timestamp : e.timestamp + 'Z').getTime();
            var years = (ts - tsStart) / (365.25 * 24 * 3600 * 1000);
            return navStart * Math.pow(1 + apyTarget, years);
        });

        if (window._saturnSusdatNavChart) {
            try { window._saturnSusdatNavChart.destroy(); } catch (e) {}
        }
        window._saturnSusdatNavChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'NAV per share (actual)',
                        data: navSeries,
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.08)',
                        fill: true,
                        tension: 0.25,
                        pointRadius: 0,
                        borderWidth: 2,
                        spanGaps: true
                    },
                    {
                        label: '11% APY target',
                        data: targetSeries,
                        borderColor: '#f59e0b',
                        backgroundColor: 'transparent',
                        borderDash: [5, 4],
                        fill: false,
                        tension: 0,
                        pointRadius: 0,
                        borderWidth: 2,
                        spanGaps: true
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
                        title: { display: true, text: 'NAV (USDat per sUSDat)', font: { size: 11 }, color: '#64748b' },
                        grid: { color: '#f1f5f9' },
                        ticks: {
                            font: { size: 11 },
                            callback: function(v) { return Number(v).toFixed(4); }
                        }
                    }
                },
                plugins: {
                    legend: { display: true, position: 'top', labels: { boxWidth: 12, font: { size: 11 } } },
                    tooltip: {
                        callbacks: {
                            label: function(c) { return c.dataset.label + ': ' + Number(c.raw).toFixed(6) + ' USDat'; }
                        }
                    }
                },
                interaction: { intersect: false, mode: 'index' }
            }
        });
    },

    // ============================================================
    // §4b Peg Performance — 30d history
    //
    // USDat: Curve-derived peg vs $1.00 (fixed-peg model).
    // sUSDat: discount-to-NAV vs 0% baseline (vault-share — absolute
    // price vs $1 would understate the discount because NAV grows).
    // Sources from {slug}_backing_history.json — same file the NAV
    // trajectory chart loads on sUSDat, browser HTTP cache makes the
    // second fetch effectively free.
    // ============================================================
    _renderPegHistory: function(specific, s, slug) {
        return '<div class="panel">' +
            '<div class="panel-title">Peg Performance</div>' +
            SaturnRenderer._renderPegHistoryInner(specific, s, slug) +
        '</div>';
    },

    // Inner body shared by the standalone Peg Performance panel (sUSDat)
    // and the consolidated Liquidity parent's Peg sub-section (USDat).
    _renderPegHistoryInner: function(specific, s, slug) {
        var headline, methodology, chartTitle;

        if (slug === 'usdat') {
            var pegState = SaturnRenderer._pegStatusClass(s.peg_deviation_pct);
            var pegCls   = SaturnRenderer._pegPctClass(pegState);
            var pegTxt   = (s.peg_curve_usdc != null) ? '$' + s.peg_curve_usdc.toFixed(4) : '—';
            headline =
                '<div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">' +
                    '<div class="summary-card"><div class="card-label">Current peg (Curve)</div>' +
                        '<div class="card-value">' + pegTxt + '</div>' +
                        '<div class="text-xs ' + pegCls + ' mt-0.5 font-mono">' +
                            SaturnRenderer._pegPctText(s.peg_deviation_pct, 3) +
                        '</div>' +
                        '<div class="mt-1">' + SaturnRenderer._statusPill(SaturnRenderer._pegStatusLabel(pegState), pegState) + '</div>' +
                    '</div>' +
                    '<div class="summary-card"><div class="card-label">24h range</div>' +
                        '<div class="card-value text-base" id="saturn-peg-range-24h">—</div>' +
                        '<div class="text-xs text-slate-400 mt-1">min · max</div></div>' +
                    '<div class="summary-card"><div class="card-label">7d range</div>' +
                        '<div class="card-value text-base" id="saturn-peg-range-7d">—</div>' +
                        '<div class="text-xs text-slate-400 mt-1">min · max</div></div>' +
                '</div>';
            chartTitle = '30-day peg vs $1.00 (Curve USDAT/USDC)';
            methodology =
                '<div class="text-xs text-slate-500 italic leading-relaxed mt-4 pt-3 border-t border-slate-200">' +
                    'Peg sampled per hourly analyzer cycle as the Curve USDAT/USDC implied rate; ±25 bps healthy, ' +
                    '±50 bps watch, ±100 bps stress (same bands as the Layer-3 alerter). Higher-fidelity than ' +
                    'CoinGecko aggregate price for short-window observation — analyzer reads pool state directly.' +
                '</div>';
        } else {
            // sUSDat — discount-to-NAV, not absolute price.
            var sec = specific.secondary || {};
            var poolPrice = sec.curve_susdat_usdc && sec.curve_susdat_usdc.implied_price;
            var d = s.discount_to_nav_pct;
            var dState = (d == null) ? 'unknown' :
                         (Math.abs(d) < 0.5) ? 'ok' :
                         (Math.abs(d) < 1.5) ? 'warn' : 'critical';
            var dCls = SaturnRenderer._pegPctClass(dState);
            headline =
                '<div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">' +
                    '<div class="summary-card"><div class="card-label">Discount to NAV</div>' +
                        '<div class="card-value ' + dCls + '">' + SaturnRenderer._pegPctText(d, 3) + '</div>' +
                        '<div class="text-xs text-slate-400 mt-0.5">Curve sUSDat/USDC vs NAV</div>' +
                        '<div class="mt-1">' + SaturnRenderer._statusPill(SaturnRenderer._pegStatusLabel(dState), dState) + '</div>' +
                    '</div>' +
                    '<div class="summary-card"><div class="card-label">Current NAV</div>' +
                        '<div class="card-value text-base">' +
                            (s.nav_per_share != null ? s.nav_per_share.toFixed(6) : '—') +
                        '</div>' +
                        '<div class="text-xs text-slate-400 mt-1">USDat / sUSDat</div></div>' +
                    '<div class="summary-card"><div class="card-label">Curve market price</div>' +
                        '<div class="card-value text-base">' +
                            (poolPrice != null ? '$' + poolPrice.toFixed(4) :
                                (s.peg_curve_usdc != null ? '$' + s.peg_curve_usdc.toFixed(4) : '—')) +
                        '</div>' +
                        '<div class="text-xs text-slate-400 mt-1">Curve sUSDat/USDC spot</div></div>' +
                '</div>';
            chartTitle = '30-day discount-to-NAV (sUSDat)';
            methodology =
                '<div class="text-xs text-slate-500 italic leading-relaxed mt-4 pt-3 border-t border-slate-200">' +
                    '<strong>Vault-share peg is measured as discount-to-NAV, not absolute price vs $1.00.</strong> ' +
                    'NAV accrues over time (currently ~$' + (s.nav_per_share != null ? s.nav_per_share.toFixed(4) : '1.0007') +
                    ' and growing under the 11% APY design target), so absolute-price comparisons would understate ' +
                    'the true discount. A persistent small positive discount typically reflects the 30-day vesting ' +
                    'queue — arbs can\'t close the gap atomically — and is not a peg break.' +
                '</div>';
        }

        var chartBlock =
            '<div class="mt-4">' +
                '<div class="text-sm font-semibold text-slate-700 mb-2">' + chartTitle + '</div>' +
                '<div style="height: 320px; position: relative;">' +
                    '<canvas id="saturn-peg-history-chart"></canvas>' +
                '</div>' +
            '</div>';

        return headline + chartBlock + methodology;
    },

    _loadPegHistoryChart: function(slug, s) {
        var ctx = document.getElementById('saturn-peg-history-chart');
        if (!ctx || typeof Chart === 'undefined') return;
        var nocache = Math.floor(Date.now() / 60000);
        fetch('data/' + slug + '_backing_history.json?nocache=' + nocache)
            .then(function(r) { return r.ok ? r.json() : null; })
            .then(function(hist) {
                if (!hist || !Array.isArray(hist.entries) || hist.entries.length < 2) {
                    ctx.parentElement.innerHTML = '<div class="text-xs text-slate-400 italic">Peg history not yet available — chart populates after a few hours of samples.</div>';
                    return;
                }
                if (slug === 'usdat') {
                    SaturnRenderer._drawUsdatPegChart(ctx, hist.entries, s);
                } else {
                    SaturnRenderer._drawSusdatDiscountChart(ctx, hist.entries, s);
                }
            })
            .catch(function() {
                ctx.parentElement.innerHTML = '<div class="text-xs text-slate-400 italic">Peg history unavailable.</div>';
            });
    },

    _drawUsdatPegChart: function(ctx, entries, s) {
        var cutoff = Date.now() - 30 * 24 * 3600 * 1000;
        var windowed = entries.filter(function(e) {
            if (e.peg_curve_usdc == null) return false;
            var ts = e.timestamp.endsWith('Z') ? e.timestamp : (e.timestamp + 'Z');
            return new Date(ts).getTime() >= cutoff;
        });
        if (windowed.length < 2) {
            ctx.parentElement.innerHTML = '<div class="text-xs text-slate-400 italic">Peg history not yet available — chart populates after a few hours of samples.</div>';
            return;
        }

        // Backfill 24h / 7d range tiles populated by _renderPegHistory.
        SaturnRenderer._fillPegRangeTiles(windowed);

        var labels = windowed.map(function(e) {
            var ts = e.timestamp.endsWith('Z') ? e.timestamp : (e.timestamp + 'Z');
            return new Date(ts);
        });
        var values = windowed.map(function(e) { return e.peg_curve_usdc; });

        // Y range — anchored at $1.00 with ±0.5% padding default, but auto-rescale
        // if real data widens beyond. Per spec: "auto-rescale if a stress event
        // widens the range".
        var minV = Math.min.apply(null, values);
        var maxV = Math.max.apply(null, values);
        var pad = Math.max(0.005, (maxV - minV) * 0.4);
        var yMin = Math.min(1 - 0.005, minV - pad);
        var yMax = Math.max(1 + 0.005, maxV + pad);

        var pointColors = values.map(function(v) {
            var dev = (v - 1) * 100;
            var st = SaturnRenderer._pegStatusClass(dev);
            if (st === 'ok')       return '#3b82f6';
            if (st === 'warn')     return '#f59e0b';
            if (st === 'critical') return '#ef4444';
            return '#94a3b8';
        });

        if (window._saturnPegChart) {
            try { window._saturnPegChart.destroy(); } catch (e) {}
        }
        window._saturnPegChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Curve USDAT/USDC',
                    data: values,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.08)',
                    pointBackgroundColor: pointColors,
                    pointBorderColor: pointColors,
                    fill: true,
                    tension: 0.25,
                    pointRadius: 2,
                    borderWidth: 2,
                    spanGaps: true
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
                        suggestedMin: yMin,
                        suggestedMax: yMax,
                        ticks: {
                            font: { size: 11 },
                            callback: function(v) { return '$' + Number(v).toFixed(4); }
                        }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(c) {
                                var v = c.raw;
                                var dev = (v - 1) * 100;
                                var sign = dev >= 0 ? '+' : '';
                                return 'Curve: $' + Number(v).toFixed(6) + '  (' + sign + (dev * 100).toFixed(1) + ' bps)';
                            }
                        }
                    },
                    annotation: {
                        annotations: {
                            peg: {
                                type: 'line', yMin: 1.0, yMax: 1.0,
                                borderColor: '#94a3b8', borderWidth: 1, borderDash: [4, 4],
                                label: { content: '$1.00', display: true, position: 'end', font: { size: 9 }, color: '#64748b' }
                            }
                        }
                    }
                },
                interaction: { intersect: false, mode: 'index' }
            }
        });
    },

    _drawSusdatDiscountChart: function(ctx, entries, s) {
        var cutoff = Date.now() - 30 * 24 * 3600 * 1000;
        var windowed = entries.filter(function(e) {
            if (e.discount_to_nav_pct == null) return false;
            var ts = e.timestamp.endsWith('Z') ? e.timestamp : (e.timestamp + 'Z');
            return new Date(ts).getTime() >= cutoff;
        });
        if (windowed.length < 2) {
            ctx.parentElement.innerHTML = '<div class="text-xs text-slate-400 italic">Discount history not yet available — chart populates after a few hours of samples.</div>';
            return;
        }

        var labels = windowed.map(function(e) {
            var ts = e.timestamp.endsWith('Z') ? e.timestamp : (e.timestamp + 'Z');
            return new Date(ts);
        });
        var values = windowed.map(function(e) { return e.discount_to_nav_pct; });
        var navMap = windowed.map(function(e) { return e.nav_per_share; });
        var priceMap = windowed.map(function(e) { return e.peg_curve_usdc; });

        // Y range — anchored at 0% with ±2% padding default, auto-rescale if real
        // data widens.
        var absMax = Math.max.apply(null, values.map(function(v) { return Math.abs(v); }));
        var padPct = Math.max(2.0, absMax * 1.2);

        var pointColors = values.map(function(v) {
            var absV = Math.abs(v);
            if (absV < 0.5) return '#3b82f6';
            if (absV < 1.5) return '#f59e0b';
            return '#ef4444';
        });

        if (window._saturnPegChart) {
            try { window._saturnPegChart.destroy(); } catch (e) {}
        }
        window._saturnPegChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Discount to NAV',
                    data: values,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.08)',
                    pointBackgroundColor: pointColors,
                    pointBorderColor: pointColors,
                    fill: false,
                    tension: 0.25,
                    pointRadius: 2,
                    borderWidth: 2,
                    spanGaps: true
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
                        suggestedMin: -padPct,
                        suggestedMax:  padPct,
                        title: { display: true, text: 'Discount to NAV (%)', font: { size: 11 } },
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
                            label: function(c) {
                                var idx = c.dataIndex;
                                var nav = navMap[idx];
                                var p   = priceMap[idx];
                                var dev = c.raw;
                                var sign = dev >= 0 ? '+' : '';
                                return [
                                    'Discount: ' + sign + Number(dev).toFixed(3) + '%',
                                    'NAV: ' + (nav != null ? Number(nav).toFixed(6) : '—'),
                                    'Curve: ' + (p != null ? '$' + Number(p).toFixed(4) : '—')
                                ];
                            }
                        }
                    },
                    annotation: {
                        annotations: {
                            zero: {
                                type: 'line', yMin: 0, yMax: 0,
                                borderColor: '#94a3b8', borderWidth: 1, borderDash: [4, 4],
                                label: { content: 'NAV (0%)', display: true, position: 'end', font: { size: 9 }, color: '#64748b' }
                            }
                        }
                    }
                },
                interaction: { intersect: false, mode: 'index' }
            }
        });
    },

    // Helper for the 24h / 7d range tiles on the USDat peg panel.
    _fillPegRangeTiles: function(entries) {
        var now = Date.now();
        var cutoff24h = now - 24 * 3600 * 1000;
        var cutoff7d  = now - 7 * 24 * 3600 * 1000;

        function rangeOver(threshold) {
            var vals = entries.filter(function(e) {
                if (e.peg_curve_usdc == null) return false;
                var ts = e.timestamp.endsWith('Z') ? e.timestamp : (e.timestamp + 'Z');
                return new Date(ts).getTime() >= threshold;
            }).map(function(e) { return e.peg_curve_usdc; });
            if (vals.length === 0) return null;
            return { min: Math.min.apply(null, vals), max: Math.max.apply(null, vals), n: vals.length };
        }

        function setTile(id, range) {
            var el = document.getElementById(id);
            if (!el) return;
            if (range == null) {
                el.textContent = '—';
                return;
            }
            el.textContent = '$' + range.min.toFixed(4) + ' · $' + range.max.toFixed(4);
        }

        setTile('saturn-peg-range-24h', rangeOver(cutoff24h));
        setTile('saturn-peg-range-7d',  rangeOver(cutoff7d));
    },

    // ============================================================
    // §4 Secondary Market
    // ============================================================
    _renderSecondaryMarket: function(specific, slug) {
        return '<div class="panel">' +
            '<div class="panel-title">Secondary Market</div>' +
            SaturnRenderer._renderSecondaryMarketInner(specific, slug) +
        '</div>';
    },

    // Inner body shared by the standalone Secondary Market panel (sUSDat)
    // and the consolidated Liquidity parent's Depth sub-section (USDat).
    // Returns the inner content with no panel/title wrap; returns the empty
    // "No Curve pool data" placeholder directly when pool data is missing.
    _renderSecondaryMarketInner: function(specific, slug) {
        var sec = specific.secondary || {};
        var slip = specific.slippage_tiers || {};
        var pool, secondPool, headlineMetric, quoteKey, pairLabel;

        if (slug === 'usdat') {
            pool = sec.curve_usdat_usdc;
            quoteKey = 'usdat_to_usdc';
            pairLabel = 'USDat → USDC';
            headlineMetric = 'price';
        } else {
            pool = sec.curve_susdat_usdc;
            secondPool = sec.curve_susdat_frxusd;
            quoteKey = 'susdat_to_usdc';
            pairLabel = 'sUSDat → USDC';
            headlineMetric = 'discount_to_nav';
        }

        if (!pool) {
            return '<div class="text-xs text-slate-400 italic">No Curve pool data in this snapshot.</div>';
        }

        // Headline tile — price (USDat) vs discount-to-NAV (sUSDat) per the
        // vault-share peg-metric rule.
        var headlineTile;
        if (headlineMetric === 'price') {
            var pegState = SaturnRenderer._pegStatusClass(pool.deviation_pct);
            var pegCls   = SaturnRenderer._pegPctClass(pegState);
            headlineTile =
                '<div class="summary-card"><div class="card-label">Implied price (Curve)</div>' +
                    '<div class="card-value">' + (pool.implied_price != null ? '$' + pool.implied_price.toFixed(4) : '—') + '</div>' +
                    '<div class="text-xs ' + pegCls + ' mt-0.5 font-mono">' +
                        SaturnRenderer._pegPctText(pool.deviation_pct, 3) +
                    '</div>' +
                    '<div class="mt-1">' + SaturnRenderer._statusPill(SaturnRenderer._pegStatusLabel(pegState), pegState) + '</div>' +
                '</div>';
        } else {
            // sUSDat: discount-to-NAV is the headline (not price vs $1).
            var d = pool.discount_to_nav_pct;
            // Vault-share discount: small positive discount is normal (cooldown-arb structural).
            // Use the same classification as price deviation for now — Layer-1 alerter thresholds.
            var dState = (d == null) ? 'unknown' :
                         (Math.abs(d) < 0.5) ? 'ok' :
                         (Math.abs(d) < 1.5) ? 'warn' : 'critical';
            var dCls = SaturnRenderer._pegPctClass(dState);
            headlineTile =
                '<div class="summary-card"><div class="card-label">Discount to NAV</div>' +
                    '<div class="card-value ' + dCls + '">' + SaturnRenderer._pegPctText(d, 3) + '</div>' +
                    '<div class="text-xs text-slate-400 mt-0.5">Curve sUSDat/USDC vs contract NAV</div>' +
                    '<div class="mt-1">' + SaturnRenderer._statusPill(SaturnRenderer._pegStatusLabel(dState), dState) + '</div>' +
                '</div>';
        }

        var poolMeta =
            '<div class="summary-card"><div class="card-label">' + (headlineMetric === 'price' ? 'Curve USDAT/USDC' : 'Curve sUSDAT/USDC') + '</div>' +
                '<div class="card-value text-base">' + CommonRenderer.formatCurrency(pool.tvl_usd) + ' TVL</div>' +
                '<div class="text-xs text-slate-400 mt-1">' + CommonRenderer.formatCurrency(pool.vol_24h_usd) + ' / 24h vol</div>' +
                '<div class="text-xs mt-1">' + SaturnRenderer._addrCell(pool.address) + '</div>' +
            '</div>';

        var secondTile = '';
        if (secondPool) {
            secondTile =
                '<div class="summary-card"><div class="card-label">Curve sUSDAT/frxUSD <span class="text-[10px] font-normal text-slate-400">(secondary)</span></div>' +
                    '<div class="card-value text-base">' + CommonRenderer.formatCurrency(secondPool.tvl_usd) + ' TVL</div>' +
                    '<div class="text-xs text-slate-400 mt-1">' + CommonRenderer.formatCurrency(secondPool.vol_24h_usd) + ' / 24h vol</div>' +
                    '<div class="text-xs mt-1">' + SaturnRenderer._addrCell(secondPool.address) + '</div>' +
                '</div>';
        }

        var topRow =
            '<div class="grid grid-cols-1 md:grid-cols-' + (secondTile ? '3' : '2') + ' gap-3 mt-4">' +
                headlineTile +
                poolMeta +
                secondTile +
            '</div>';

        // Slippage tiers
        var qm = slip[quoteKey] || {};
        var tiers = ['1000', '10000', '100000', '500000'];
        var hasAnyQuotes = tiers.some(function(t) { return qm[t] && (qm[t].slippage_bps != null || qm[t].out != null); });

        var slipBlock = '';
        if (hasAnyQuotes) {
            var rows = tiers.map(function(t) {
                var q = qm[t] || {};
                var sizeTxt = Number(t) >= 1000 ?
                    '$' + (Number(t) / 1000).toFixed(0) + 'K' :
                    '$' + t;
                var outTxt = (q.out != null) ? '$' + Number(q.out).toLocaleString('en-US', { maximumFractionDigits: 0 }) : '—';
                var slipBps = q.slippage_bps;
                var slipState = (slipBps == null) ? 'unknown' :
                                (slipBps < 25) ? 'ok' :
                                (slipBps < 100) ? 'warn' : 'critical';
                var slipCls = slipState === 'ok' ? 'text-green-600' :
                              slipState === 'warn' ? 'text-amber-600' :
                              slipState === 'critical' ? 'text-red-600' : 'text-slate-500';
                return '<tr>' +
                    '<td class="font-mono text-right">' + sizeTxt + '</td>' +
                    '<td class="font-mono text-right">' + outTxt + '</td>' +
                    '<td class="font-mono text-right ' + slipCls + '">' +
                        (slipBps != null ? slipBps.toFixed(0) + ' bps' : '—') +
                    '</td>' +
                '</tr>';
            }).join('');
            slipBlock =
                '<div class="mt-6">' +
                    '<div class="text-sm font-semibold text-slate-700 mb-2">Slippage tiers — ' + pairLabel + '</div>' +
                    '<table class="data-table">' +
                        '<thead><tr><th class="text-right">Size</th><th class="text-right">Output</th><th class="text-right">Slippage</th></tr></thead>' +
                        '<tbody>' + rows + '</tbody>' +
                    '</table>' +
                '</div>';
        }

        var note = (slug === 'susdat') ?
            '<div class="text-xs text-slate-500 italic leading-relaxed mt-4 pt-3 border-t border-slate-200">' +
                'Discount-to-NAV is the meaningful metric for a vault share — Curve sUSDat/USDC spot ' +
                'is not "the peg" because 1 sUSDat ≠ $1 by design. Persistent discount typically ' +
                'reflects the 30-day vesting queue (arbs can\'t close the gap atomically), not a backing problem.' +
            '</div>' : '';

        return topRow + slipBlock + note;
    },

    // ============================================================
    // §4 Liquidity (consolidated parent — USDat)
    //
    // One panel mapped to the report's "Liquidity" axis, replacing the
    // prior three (Secondary Market + Peg Performance + Derived score).
    // Sub-sections render summary → detail: Derived Score (summary tile +
    // components reveal) → Peg Performance → Secondary Market Depth.
    // sUSDat still ships as three separate panels until a follow-up
    // consolidation pass — see saturn-usdat-liquidity-panel-consolidation
    // handoff for the USDat-only scope.
    // ============================================================
    _renderLiquidity: function(specific, s, slug) {
        var divider = '<div class="border-t border-slate-200 pt-6 mt-6"></div>';
        // Vault-share peg metric is discount-to-NAV, not absolute price vs $1 —
        // the sub-section heading reflects that for sUSDat.
        var pegHeading = (slug === 'susdat') ? 'Discount to NAV' : 'Peg Performance';
        return '<div class="panel">' +
            '<div class="panel-title">Liquidity</div>' +
            SaturnRenderer._renderLiquidityScoreSection(specific, s, slug) +
            divider +
            '<h3 class="text-sm font-semibold text-slate-900 mt-0 mb-3">' + pegHeading + '</h3>' +
            SaturnRenderer._renderLiquidityPegSection(specific, s, slug) +
            divider +
            '<h3 class="text-sm font-semibold text-slate-900 mt-0 mb-3">Secondary Market Depth</h3>' +
            SaturnRenderer._renderLiquidityDepthSection(specific, slug) +
        '</div>';
    },

    // Score sub-section — summary tile (derived score · editorial · Δ · badge)
    // with a <details> reveal for the components breakdown. No chart canvas;
    // the underlying time-series story is covered by the Peg sub-section's
    // chart below, so a separate score chart is redundant.
    _renderLiquidityScoreSection: function(specific, s, slug) {
        var ld = s.liquidity_depth_derived;
        if (!ld) {
            return '<div class="risk-flag" style="background:#f1f5f9;color:#475569;border-left:4px solid #94a3b8;">' +
                '<strong>Liquidity derivation pending.</strong> Formula codified, awaiting analyzer wire-up. ' +
                'See <span class="font-mono">specs/handoffs/saturn-liquidity-derivation-pegtracker.md</span>.' +
            '</div>';
        }

        var editorial = EDITORIAL_LIQUIDITY[slug];
        var derived = ld.score;
        var derivedTxt = (derived != null) ? derived.toFixed(1) + ' / 10' : '—';
        var editorialTxt = (editorial != null) ? editorial.toFixed(1) : '—';
        var delta = (editorial != null && derived != null) ? (derived - editorial) : null;
        var deltaTxt = (delta == null) ? '—' :
                       (delta === 0) ? '0.0' :
                       (delta > 0 ? '+' : '−') + Math.abs(delta).toFixed(1);
        var badge = SaturnRenderer._liquidityReconciliationBadge(delta);

        var comp = ld.components || {};
        var sec = specific.secondary || {};
        var poolKey = (slug === 'usdat') ? 'curve_usdat_usdc' : 'curve_susdat_usdc';
        var poolTvl = sec[poolKey] && sec[poolKey].tvl_usd;

        function fmtUsdShort(v) {
            if (v == null) return '—';
            if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
            if (v >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'K';
            return '$' + v.toFixed(0);
        }
        function fmtAdj(v) {
            if (v == null) return '—';
            if (v === 0) return '0.0';
            return (v > 0 ? '+' : '−') + Math.abs(v).toFixed(1);
        }
        function adjCls(v) {
            if (v == null) return 'text-slate-500';
            if (v === 0) return 'text-slate-600';
            return v > 0 ? 'text-emerald-700' : 'text-red-600';
        }

        var rows = [
            {
                label: 'Depth tier',
                value: comp.depth_tier != null ? comp.depth_tier.toFixed(1) : '—',
                valueCls: 'text-slate-800',
                context: (comp.effective_max_under_25bps_usd != null ?
                          fmtUsdShort(comp.effective_max_under_25bps_usd) + ' under 25 bps' :
                          '—') +
                         (poolTvl != null ?
                          ', capped to 5% × ' + fmtUsdShort(poolTvl) + ' Curve TVL' :
                          '')
            },
            {
                label: 'Peg band 30d',
                value: fmtAdj(comp.peg_adj),
                valueCls: adjCls(comp.peg_adj),
                context: (comp.peg_band_30d_bps != null ?
                          comp.peg_band_30d_bps.toFixed(2) + ' bps over window' :
                          '—') +
                         (comp.peg_band_30d_partial === true ?
                          ' · <em>partial 30d window</em>' :
                          '')
            },
            {
                label: 'Venues ≥ $1M TVL',
                value: fmtAdj(comp.venue_adj),
                valueCls: adjCls(comp.venue_adj),
                context: (comp.deep_venues_count != null ?
                          comp.deep_venues_count + ' deep venue' + (comp.deep_venues_count === 1 ? '' : 's') :
                          '—')
            },
            {
                label: 'Turnover (24h vol / TVL)',
                value: fmtAdj(comp.turnover_adj),
                valueCls: adjCls(comp.turnover_adj),
                context: comp.turnover_ratio_24h != null ? (comp.turnover_ratio_24h * 100).toFixed(1) + '%' : '—'
            },
            {
                label: 'Pool / supply ratio',
                value: fmtAdj(comp.pool_adj),
                valueCls: adjCls(comp.pool_adj),
                context: comp.pool_supply_ratio != null ? (comp.pool_supply_ratio * 100).toFixed(1) + '%' : '—'
            }
        ];

        var compRows = rows.map(function(r) {
            return '<tr>' +
                '<td class="font-medium text-slate-700">' + r.label + '</td>' +
                '<td class="text-right font-mono ' + r.valueCls + '">' + r.value + '</td>' +
                '<td class="text-xs text-slate-500">' + r.context + '</td>' +
            '</tr>';
        }).join('');

        var scoreHeader =
            '<div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">' +
                '<div>' +
                    '<h3 class="text-sm font-semibold text-slate-900" style="margin:0;">Derived Score</h3>' +
                    '<div class="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">' +
                        '<span>Editorial: <strong>' + editorialTxt + '</strong></span>' +
                        '<span>· Δ <span class="font-mono">' + deltaTxt + '</span></span>' +
                        badge +
                    '</div>' +
                '</div>' +
                '<div class="text-2xl font-bold text-slate-800 sm:text-right whitespace-nowrap">' + derivedTxt + '</div>' +
            '</div>';

        var componentsReveal =
            '<details class="mt-3 group">' +
                '<summary class="cursor-pointer text-xs font-medium text-blue-700 hover:text-blue-900 select-none" style="list-style:none;">' +
                    '<span class="inline-block transform group-open:rotate-90 transition-transform">▶</span> How this score is computed' +
                '</summary>' +
                '<div class="mt-3 data-table-scroll">' +
                    '<table class="data-table">' +
                        '<thead><tr>' +
                            '<th>Component</th>' +
                            '<th class="text-right">Contribution</th>' +
                            '<th>Detail</th>' +
                        '</tr></thead>' +
                        '<tbody>' + compRows + '</tbody>' +
                    '</table>' +
                '</div>' +
                '<div class="text-xs text-slate-500 italic leading-relaxed mt-3">' +
                    'Pure-data formula — observed depth + peg behavior + venue diversification. ' +
                    'Permissioning and addressable-universe constraints score in the <strong>Issuer</strong> axis, not here.' +
                '</div>' +
            '</details>';

        return scoreHeader + componentsReveal;
    },

    // Peg sub-section — wraps the shared Peg Performance inner body
    // (3 tiles + chart canvas + methodology). Canvas id is preserved as
    // saturn-peg-history-chart so _loadPegHistoryChart finds it unchanged.
    _renderLiquidityPegSection: function(specific, s, slug) {
        return SaturnRenderer._renderPegHistoryInner(specific, s, slug);
    },

    // Depth sub-section — wraps the shared Secondary Market inner body
    // (headline tile + pool meta + slippage tiers + methodology note).
    _renderLiquidityDepthSection: function(specific, slug) {
        return SaturnRenderer._renderSecondaryMarketInner(specific, slug);
    },

    _liquidityReconciliationBadge: function(delta) {
        if (delta == null) {
            return '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">No editorial reference</span>';
        }
        var abs = Math.abs(delta);
        var label, bg, fg, icon;
        if (abs <= 0.5) {
            label = 'aligned';                              bg = 'bg-emerald-50'; fg = 'text-emerald-800'; icon = '✓';
        } else if (abs <= 1.0) {
            label = 'slight drift';                         bg = 'bg-amber-50';   fg = 'text-amber-800';   icon = '△';
        } else {
            label = 'stale editorial — refresh recommended'; bg = 'bg-red-50';    fg = 'text-red-800';     icon = '⚠';
        }
        return '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ' + bg + ' ' + fg + '">' +
            '<span>' + icon + '</span><span>' + label + '</span>' +
        '</span>';
    },

    // ============================================================
    // §5 Trust Stack
    // ============================================================
    _renderTrustStack: function(specific, slug) {
        var ts = specific.trust_stack || {};
        var s = specific; // for occasional reads from sibling fields

        var proxyType = ts.proxy_type || (slug === 'usdat' ? 'TransparentUpgradeableProxy' : 'ERC1967Proxy');
        var proxyAdminContract = ts.proxy_admin_contract;
        var proxyAdminOwner = ts.proxy_admin_owner || ts.admin_role_holder;
        var adminIsEoa = (slug === 'usdat') ? ts.proxy_admin_owner_is_eoa : ts.admin_role_holder_is_eoa;
        var impl = (specific.summary && specific.summary.implementation) || null;
        // (impl normally lives on the top-level summary, not on trust_stack — render reads it where present)

        function row(label, value, extra) {
            return '<tr>' +
                '<td class="font-medium">' + label + '</td>' +
                '<td>' + value + '</td>' +
                (extra ? '<td class="text-xs text-slate-500">' + extra + '</td>' : '<td></td>') +
            '</tr>';
        }

        var rows = '';
        rows += row('Proxy type', '<span class="font-mono text-xs">' + proxyType + '</span>',
            (slug === 'usdat') ? 'OZ TransparentUpgradeableProxy — upgrade authority routes through ProxyAdmin' : 'OZ ERC1967Proxy — upgrade authority is DEFAULT_ADMIN_ROLE holder');

        if (slug === 'usdat' && proxyAdminContract) {
            rows += row('ProxyAdmin contract', SaturnRenderer._addrCell(proxyAdminContract), 'Owns the USDat upgrade path');
        }
        rows += row(
            (slug === 'usdat') ? 'ProxyAdmin owner' : 'DEFAULT_ADMIN_ROLE holder',
            SaturnRenderer._addrCell(proxyAdminOwner),
            'Same address controls USDat + sUSDat'
        );
        // Admin custody — Saturn-disclosed Fireblocks MPC representation.
        // The ⓘ tooltip carries the on-chain-indistinguishability caveat per
        // saturn-fireblocks-mpc-disclosure-backing-monitor.md.
        rows += row(
            'Admin custody',
            '<span class="font-medium">Saturn-stated Fireblocks 2-of-3 MPC</span>' +
            ' <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200 ml-1 cursor-help" ' +
            'title="Saturn represents this address as a Fireblocks 2-of-3 MPC wallet. On-chain reads cannot distinguish MPC from single-key EOA — the address shows no contract code and a low outbound nonce in either case. Claim taken at face value pending independent attestation. The raw single-key-compromise vector is closed by the MPC quorum requirement, but concentration-under-Saturn and no-on-chain-timelock remain.">ⓘ on-chain indistinguishable</span>',
            'Same (shared address)'
        );

        if (slug === 'susdat' && specific.trust_stack && specific.trust_stack.vesting_period_days != null) {
            rows += row('Vesting period', '<span class="font-mono">' + specific.trust_stack.vesting_period_days + ' days</span>',
                'ERC-4626 redemption queue');
        }
        if (slug === 'susdat' && specific.trust_stack && specific.trust_stack.deposit_fee_bps != null) {
            rows += row('Deposit fee', '<span class="font-mono">' + specific.trust_stack.deposit_fee_bps + ' bps</span>', '');
        }
        if (slug === 'susdat' && specific.trust_stack && specific.trust_stack.min_withdrawal_usdat != null) {
            rows += row('Min withdrawal', '<span class="font-mono">' + specific.trust_stack.min_withdrawal_usdat + ' USDat</span>', '');
        }

        // Pause + timelock state
        rows += row('Timelock', ts.timelock ? SaturnRenderer._statusPill('Set', 'ok') : SaturnRenderer._statusPill('None', 'warn'),
            ts.timelock ? '' : 'Admin actions execute instantly');

        // Audits — handoff lists Three Sigma ×1 + Certora ×2, shared across both tokens.
        var audits = Array.isArray(ts.audits) ? ts.audits : null;
        var auditList = audits ?
            audits.map(function(a) { return a.firm + (a.id ? ' (' + a.id + ')' : ''); }).join(' · ') :
            'Three Sigma + Certora ×2 (shared with sibling)';

        var auditLine =
            '<div class="text-sm text-slate-600 mt-3 pt-3 border-t border-slate-200">' +
                'Audits: <strong>' + auditList + '</strong>' +
                ' · <span class="text-xs text-slate-500">audit set is shared across USDat + sUSDat</span>' +
            '</div>';

        // Admin posture callout — Saturn-represented Fireblocks 2-of-3 MPC.
        // Amber/warn rather than red/crit: the raw single-key vector is
        // closed by the MPC quorum (taking Saturn's representation at face
        // value), but three structural residuals remain — surfaced inline.
        var adminCallout = '';
        if (adminIsEoa) {
            adminCallout =
                '<div class="risk-flag risk-warning mt-3">' +
                    '<strong>Admin layer is a Saturn-represented Fireblocks 2-of-3 MPC</strong> ' +
                    '<span class="text-xs font-normal">(on-chain reads cannot distinguish MPC from single-key EOA)</span> ' +
                    'at ' + SaturnRenderer._addrCell(proxyAdminOwner) + '. ' +
                    'Taking the claim at face value, the raw single-key-compromise vector is closed — a 2-of-3 quorum is required for any admin action. ' +
                    'Three residual concerns remain: signers are internal to Saturn\'s custody process (not multi-org), ' +
                    'there is no on-chain timelock (admin actions land immediately once the quorum signs), and Fireblocks ' +
                    'doesn\'t publish customer-verifiable infrastructure proofs. ' +
                    'Same residual risk class as Apyx\'s admin posture.' +
                '</div>';
        }

        return '<div class="panel">' +
            '<div class="panel-title">Trust Stack</div>' +
            '<div class="data-table-scroll">' +
                '<table class="data-table">' +
                    '<thead><tr><th>Component</th><th>Value</th><th>Notes</th></tr></thead>' +
                    '<tbody>' + rows + '</tbody>' +
                '</table>' +
            '</div>' +
            adminCallout +
            auditLine +
        '</div>';
    },

    // ============================================================
    // §6 Family panel (async)
    // ============================================================
    _loadFamilyPanel: function(currentSlug) {
        var target = document.getElementById('saturn-family-panel');
        if (!target) return;
        var nocache = Math.floor(Date.now() / 60000);
        fetch('data/saturn_family.json?nocache=' + nocache)
            .then(function(r) { return r.ok ? r.json() : null; })
            .then(function(fam) {
                if (!fam) {
                    target.innerHTML = '';
                    return;
                }
                target.innerHTML = SaturnRenderer._renderFamilyHtml(fam, currentSlug);
            })
            .catch(function() { target.innerHTML = ''; });
    },

    _renderFamilyHtml: function(fam, currentSlug) {
        var admin = fam.shared_admin_eoa || {};
        var totals = fam.totals || {};
        var acc = fam.accountable || {};
        var recon = fam.cross_reconciliation || {};

        // Aggregate AUM card
        var aumLines = [];
        if (totals.usdat_supply_usd != null) {
            aumLines.push('<div class="flex justify-between text-sm py-1">' +
                '<span class="text-slate-600">USDat supply</span>' +
                '<span class="font-mono">' + CommonRenderer.formatCurrencyExact(totals.usdat_supply_usd) + '</span></div>');
        }
        if (totals.susdat_total_assets_usd != null) {
            aumLines.push('<div class="flex justify-between text-sm py-1">' +
                '<span class="text-slate-600">sUSDat total assets</span>' +
                '<span class="font-mono">' + CommonRenderer.formatCurrencyExact(totals.susdat_total_assets_usd) + '</span></div>');
        }
        if (recon.usdat_in_susdat_vs_susdat_buffer && recon.usdat_in_susdat_vs_susdat_buffer.value_usd != null) {
            aumLines.push('<div class="flex justify-between text-sm py-1 text-slate-400">' +
                '<span>Less USDat held by sUSDat</span>' +
                '<span class="font-mono">−' + CommonRenderer.formatCurrencyExact(recon.usdat_in_susdat_vs_susdat_buffer.value_usd) + '</span></div>');
        }
        if (totals.combined_aum_usd != null) {
            aumLines.push('<div class="flex justify-between text-base font-bold py-1 border-t border-slate-200 mt-1">' +
                '<span>Combined family AUM</span>' +
                '<span class="font-mono text-indigo-700">' + CommonRenderer.formatCurrencyExact(totals.combined_aum_usd) + '</span></div>');
        }
        var aumCard =
            '<div>' +
                '<div class="text-sm font-semibold text-slate-700 mb-2">Aggregate AUM</div>' +
                aumLines.join('') +
                (totals.comment ? '<div class="text-xs text-slate-500 italic mt-2">' + totals.comment + '</div>' : '') +
            '</div>';

        // Shared admin card — Saturn-represented Fireblocks 2-of-3 MPC
        // (on-chain shape is EOA-shaped — no contract code, low nonce). Title
        // + subtitle carry the MPC framing; the on-chain shape stays visible
        // in the Type row so the indistinguishability is legible.
        var adminCard =
            '<div>' +
                '<div class="text-sm font-semibold text-slate-700 mb-1">Shared admin MPC</div>' +
                '<div class="text-xs text-slate-500 mb-2">Saturn-stated Fireblocks 2-of-3 — on-chain EOA-shaped</div>' +
                '<table class="data-table"><tbody>' +
                    '<tr><td class="font-medium">Address</td><td>' + SaturnRenderer._addrCell(admin.address) + '</td></tr>' +
                    '<tr><td class="font-medium">On-chain shape</td><td>' +
                        (admin.is_eoa ?
                            SaturnRenderer._statusPill('EOA (no code)', 'warn') :
                            SaturnRenderer._statusPill('Contract', 'warn')) +
                    '</td></tr>' +
                    '<tr><td class="font-medium">Outbound nonce</td><td><span class="font-mono">' +
                        (admin.nonce != null ? admin.nonce : '—') +
                    '</span> <span class="text-xs text-slate-500">(any tick is a signal)</span></td></tr>' +
                    '<tr><td class="font-medium">ETH balance</td><td><span class="font-mono">' +
                        (admin.balance_eth != null ? admin.balance_eth.toFixed(6) + ' ETH' : '—') +
                    '</span></td></tr>' +
                '</tbody></table>' +
                (Array.isArray(admin.controls) && admin.controls.length ?
                    '<div class="text-xs text-slate-500 mt-2">' +
                        '<strong>Controls:</strong> ' + admin.controls.join(' · ') +
                    '</div>' : '') +
            '</div>';

        // Accountable feed status
        var accBlock = '';
        if (acc.status) {
            var accState = acc.status === 'live' ? 'ok' : 'warn';
            var accLabel = acc.status === 'live' ? 'Accountable feed: LIVE' : 'Accountable feed: not live';
            accBlock =
                '<div class="mt-4 pt-3 border-t border-slate-200">' +
                    '<div class="flex flex-wrap items-center gap-2">' +
                        SaturnRenderer._statusPill(accLabel, accState) +
                        '<span class="text-xs text-slate-500">' +
                            'STRC PoR feed is planned per Saturn docs. ' +
                            (Array.isArray(acc.probed_urls) && acc.probed_urls.length ?
                                'Probing: <span class="font-mono">' + acc.probed_urls.length + '</span> candidate endpoint(s).' :
                                '') +
                        '</span>' +
                    '</div>' +
                '</div>';
        }

        // Family AUM ts
        var asOf = fam.as_of || fam.timestamp;

        return '<div class="panel">' +
            '<div class="panel-title">Saturn Family — cross-asset snapshot</div>' +
            '<div class="grid grid-cols-1 md:grid-cols-2 gap-6">' +
                aumCard +
                adminCard +
            '</div>' +
            accBlock +
            '<div class="text-xs text-slate-400 mt-3">As of ' + CommonRenderer.formatDate(asOf) + ' · self-computed.</div>' +
        '</div>';
    }
};
