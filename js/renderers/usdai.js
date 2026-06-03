/**
 * USD.AI renderer — USDai (PYUSD-reserve peg leg) + sUSDai (ERC-7540 GPU-loan
 * credit/yield vault). Permian Labs, Arbitrum.
 *
 * Single renderer registered for both slugs; the two assets share the audit
 * set, governance topology (48h timelock + 3-of-3 Safe), the api.usd.ai
 * aggregate, and the cross-asset family panel. Asset-specific divergence lives
 * in asset_specific.type ('usdai' | 'susdai') and the per-leg panels:
 *   - _renderUsdaiCoverage      (USDai only — PYUSD coverage + on-chain-verifiable badge)
 *   - _renderSusdaiDecomposition + _renderSusdaiNav (sUSDai only — totalAssets stacked bar + NAV)
 *
 * Two distinctions from the Saturn sibling this is modeled on:
 *   1. USDai coverage is two reads (PYUSD.balanceOf / totalSupply), no oracle —
 *      same "100% on-chain verifiable" treatment as Saturn's USDat.
 *   2. sUSDai's hero is the totalAssets decomposition: idle + DepositTimelock
 *      escrow (committed-undrawn loans) + drawn loans — the credit pipeline.
 * And one framing flip: governance is a STRENGTH here (48h timelock visible on
 * a 3-of-3 Safe), not a single-EOA weakness.
 *
 * Data sources (Arbitrum):
 *   - data/usdai_backing.json  + data/usdai_backing_history.json
 *   - data/susdai_backing.json + data/susdai_backing_history.json
 *   - data/usdai_family.json (async — shared governance + combined AUM + api echo)
 *
 * Global-scope namespacing: backing-monitor renderers share JS global scope;
 * every top-level identifier here is prefixed USDAI_ / UsdaiRenderer so it can't
 * collide with saturn.js / apyx.js.
 */

// Verified contract constants (Arbitrum) — used for the illustrative cast
// commands. Live governance addresses are read from usdai_family.json, not here.
var USDAI_ADDRS = {
    USDAI:            '0x0A1a1A107E45b7Ced86833863f482BC5f4ed82EF', // TransparentProxy, 18dp
    SUSDAI:           '0x0B2b2B2076d95dda7817e785989fE353fe955ef9', // ERC-7540 vault, 18dp
    PYUSD:            '0x46850aD61C2B7d64d08c9C754F45254596696984', // PayPal USD (Paxos), 6dp
    DEPOSIT_TIMELOCK: '0x0D710CC05f34d2eaD9fbA3c78d53d76a0623c9F8'  // committed-undrawn loan escrow
};

var USDAI_COLORS = {
    PYUSD:      '#10b981', // emerald — PYUSD reserve / on-chain dollar
    IDLE_USDAI: '#10b981', // emerald — idle USDai buffer (on-chain)
    IDLE_PYUSD: '#6ee7b7', // light emerald — idle PYUSD (on-chain)
    ESCROW:     '#f59e0b', // amber — DepositTimelock escrow (committed-undrawn, pre-credit)
    DRAWN:      '#ea580c'  // deep orange — drawn GPU loans (live credit)
};

var UsdaiRenderer = {

    // ============================================================
    // helpers
    // ============================================================
    _isUsdai: function(t) { return t === 'usdai' || t === 'susdai'; },

    _truncAddr: function(addr) {
        if (!addr) return '-';
        return addr.slice(0, 6) + '...' + addr.slice(-4);
    },

    _explorerLink: function(addr) {
        if (!addr) return '';
        return '<a href="https://arbiscan.io/address/' + addr + '" target="_blank" rel="noopener noreferrer" ' +
            'class="text-blue-500 hover:underline text-xs" title="' + addr + '">↗</a>';
    },

    _addrCell: function(addr) {
        if (!addr) return '<span class="text-slate-400">-</span>';
        return '<span class="font-mono text-xs" title="' + addr + '">' +
            UsdaiRenderer._truncAddr(addr) +
            '</span> ' + UsdaiRenderer._explorerLink(addr);
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
            UsdaiRenderer._statusDot(state) +
            '<span>' + label + (extra ? ' <span class="font-mono">' + extra + '</span>' : '') + '</span>' +
        '</span>';
    },

    _anchor: function(id, html) {
        if (!html || typeof html !== 'string') return html;
        return html.replace(/^(<div class="panel")/, '<div id="' + id + '" class="panel"');
    },

    // coverage_ratio is a ratio (1.0199): green ≥1.00, amber 0.995–1.00, red <0.995.
    _coverageState: function(ratio) {
        if (ratio == null) return 'unknown';
        if (ratio >= 1.0)   return 'ok';
        if (ratio >= 0.995) return 'warn';
        return 'critical';
    },

    // buffer_ratio is a fraction (0.182): ≥10% ok, 5–10% watch, <5% stress.
    _bufferState: function(ratio) {
        if (ratio == null) return 'unknown';
        if (ratio >= 0.10) return 'ok';
        if (ratio >= 0.05) return 'warn';
        return 'critical';
    },

    // recon_residual_pct is a FRACTION (0.00803 = 0.80%): <2% closes, ≥2% drift.
    _reconState: function(frac) {
        if (frac == null) return 'unknown';
        if (frac < 0.02) return 'ok';
        if (frac < 0.05) return 'warn';
        return 'critical';
    },

    // Stored discount_to_nav_pct = (NAV - price) / NAV * 100, positive = discount.
    // Display convention is price-vs-NAV: positive = premium, negative = discount.
    _navDevDisplay: function(nav, price, storedDiscount) {
        if (nav != null && price != null && nav > 0) {
            return (price - nav) / nav * 100;
        }
        return storedDiscount != null ? -storedDiscount : null;
    },

    _navDevState: function(disp) {
        if (disp == null) return 'unknown';
        if (disp >= 0) {
            if (disp < 1.0) return 'ok';
            if (disp < 3.0) return 'warn';
            return 'critical';
        }
        var a = -disp;
        if (a < 0.5) return 'ok';
        if (a < 1.5) return 'warn';
        return 'critical';
    },

    _navDevWord: function(disp) {
        if (disp == null) return '—';
        if (Math.abs(disp) < 0.05) return 'at NAV';
        return disp > 0 ? 'premium · above NAV' : 'discount · below NAV';
    },

    // api divergence is a PERCENT: <2% ok, <5% watch (a gap is itself signal).
    _divergenceState: function(pct) {
        if (pct == null) return 'unknown';
        var a = Math.abs(pct);
        if (a < 2)  return 'ok';
        if (a < 5)  return 'warn';
        return 'critical';
    },

    _pegStatusClass: function(p) { return CommonRenderer.pegStatusClass(p); },
    _pegStatusLabel: function(s) { return CommonRenderer.pegStatusLabel(s); },
    _pegPctText:     function(p, d) { return CommonRenderer.pegPctText(p, d); },
    _pegPctClass:    function(s) { return CommonRenderer.pegPctClass(s); },

    _stateTextCls: function(state) {
        return state === 'ok' ? 'text-green-600' :
               state === 'warn' ? 'text-amber-600' :
               state === 'critical' ? 'text-red-600' : 'text-slate-500';
    },

    _usdShort: function(v) {
        if (v == null) return '—';
        if (Math.abs(v) >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
        if (Math.abs(v) >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'K';
        return '$' + v.toFixed(0);
    },

    // ============================================================
    // pre-render — runs before common renderer paints
    // ============================================================
    // USD.AI summary blocks don't match common renderer's shape
    // (total_supply / total_backing / collateral_ratio / collateral_ratio_alt /
    // backing_breakdown). Synthesize the minimum so common.js doesn't NPE, then
    // suppress its panels in render() and paint the rich custom panels below.
    preRender: function(data, history) {
        var specific = data.asset_specific || {};
        if (!UsdaiRenderer._isUsdai(specific.type)) return;
        var s = data.summary || {};
        data.summary = s;

        // Layer 1 emits `as_of` and (for some assets) carries `asset`/`chain`.
        // These JSONs do carry asset/chain, but alias defensively.
        if (!data.timestamp && data.as_of) data.timestamp = data.as_of;
        if (!data.asset) data.asset = (specific.type === 'usdai') ? 'USDai' : 'sUSDai';
        if (!data.chain) data.chain = 'arbitrum';

        // Common renderSummaryCards reads s.collateral_ratio_alt.label
        // unconditionally — synthesize then hide via card_overrides.
        if (!s.collateral_ratio_alt) {
            s.collateral_ratio_alt = { label: '_usdaiAltHidden', value: 0, is_currency: false };
        }
        specific.card_overrides = specific.card_overrides || {};
        specific.card_overrides['_usdaiAltHidden'] = { hidden: true };
        specific.card_overrides['Surplus / Deficit'] = { hidden: true };

        // Synthesize common fields so the (hidden) common renderer doesn't crash.
        if (specific.type === 'usdai') {
            if (s.total_supply == null)  s.total_supply  = s.supply_usd;
            if (s.total_backing == null) s.total_backing = s.pyusd_reserve_usd;
            if (s.collateral_ratio == null && s.coverage_ratio != null) {
                s.collateral_ratio = s.coverage_ratio * 100;
            }
            if (s.surplus_deficit == null && s.pyusd_reserve_usd != null && s.supply_usd != null) {
                s.surplus_deficit = s.pyusd_reserve_usd - s.supply_usd;
            }
        } else {
            if (s.total_supply == null)  s.total_supply  = s.total_assets_usd;
            if (s.total_backing == null) s.total_backing = s.total_assets_usd;
            if (s.collateral_ratio == null) s.collateral_ratio = 100;
            if (s.surplus_deficit == null)  s.surplus_deficit  = 0;
        }

        if (!Array.isArray(data.backing_breakdown)) {
            data.backing_breakdown = [];
        }

        // History needs a synthetic collateral_ratio so common's CR chart can
        // loop — but that chart is hidden anyway.
        if (history && Array.isArray(history.entries)) {
            history.entries.forEach(function(e) {
                if (e.collateral_ratio == null) {
                    if (specific.type === 'usdai' && e.coverage_ratio != null) {
                        e.collateral_ratio = e.coverage_ratio * 100;
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
        if (!UsdaiRenderer._isUsdai(specific.type)) return;

        UsdaiRenderer._suppressCommonPanels(data);

        var slug = data.asset_slug;
        var s = data.summary || {};
        var anc = UsdaiRenderer._anchor;
        var html = '';

        html += anc('panel-headline', UsdaiRenderer._renderHeadlineCard(specific, s, slug));
        if (slug === 'usdai') {
            html += anc('panel-coverage', UsdaiRenderer._renderUsdaiCoverage(specific, s));
        } else {
            html += anc('panel-decomp', UsdaiRenderer._renderSusdaiDecomposition(specific, s));
            html += anc('panel-nav',    UsdaiRenderer._renderSusdaiNav(specific, s));
        }
        html += anc('panel-secondary', UsdaiRenderer._renderSecondaryMarket(specific, slug));
        html += '<div id="usdai-gov-panel"></div>';      // §5 governance (async, family)
        html += '<div id="usdai-family-panel"></div>';   // §6 family (async)

        container.innerHTML = html;

        UsdaiRenderer._setupAnchorNav(slug);
        UsdaiRenderer._setupCompanionLink(slug);

        // Post-render: charts (DOM must exist first) + async family fetch that
        // fills both the governance (§5) and family (§6) panels.
        if (slug === 'susdai') {
            UsdaiRenderer._loadNavChart(slug);
        }
        UsdaiRenderer._loadFamily(slug, data);
    },

    _suppressCommonPanels: function(data) {
        var summaryCards = document.getElementById('summary-cards');
        if (summaryCards) summaryCards.style.display = 'none';

        var chartPanel = document.getElementById('chart-panel');
        if (chartPanel) chartPanel.style.display = 'none';

        var bd = document.getElementById('breakdown-table');
        if (bd) { var p = bd.closest('.panel'); if (p) p.style.display = 'none'; }
        var pie = document.getElementById('pie-chart');
        if (pie) { var p2 = pie.closest('.panel'); if (p2) p2.style.display = 'none'; }

        // Risk flags: hide the "No risk flags" placeholder; stretch when real.
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
        if (slug === 'usdai') {
            items = [
                { id: 'panel-headline',     label: 'Asset' },
                { id: 'panel-coverage',     label: 'Coverage' },
                { id: 'panel-secondary',    label: 'Market' },
                { id: 'usdai-gov-panel',    label: 'Governance' },
                { id: 'usdai-family-panel', label: 'Family' }
            ];
        } else if (slug === 'susdai') {
            items = [
                { id: 'panel-headline',     label: 'Asset' },
                { id: 'panel-decomp',       label: 'Decomposition' },
                { id: 'panel-nav',          label: 'NAV' },
                { id: 'panel-secondary',    label: 'Market' },
                { id: 'usdai-gov-panel',    label: 'Governance' },
                { id: 'usdai-family-panel', label: 'Family' }
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
        if (slug === 'usdai')       { sibling = 'susdai'; label = 'View sUSDai ↗'; }
        else if (slug === 'susdai') { sibling = 'usdai';  label = 'View USDai ↗'; }
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
            '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">Arbitrum</span>';

        var headerLeft, metricsRow, badgeRow;

        if (slug === 'usdai') {
            headerLeft =
                '<div class="text-xl font-bold text-slate-800">USDai</div>' +
                '<div class="text-xs text-slate-500 mt-1">Permian Labs · PYUSD-reserved synthetic dollar (100% on-chain verifiable)</div>';

            var covState = UsdaiRenderer._coverageState(s.coverage_ratio);
            var covCls = UsdaiRenderer._stateTextCls(covState);
            var covTxt = (s.coverage_ratio != null) ? (s.coverage_ratio * 100).toFixed(2) + '%' : '—';
            var pegState = UsdaiRenderer._pegStatusClass(s.peg_deviation_pct);
            var pegCls   = UsdaiRenderer._pegPctClass(pegState);
            var buffer = (s.pyusd_reserve_usd != null && s.supply_usd != null) ? (s.pyusd_reserve_usd - s.supply_usd) : null;

            metricsRow =
                '<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">' +
                    '<div><div class="text-xs text-slate-400 font-medium uppercase">Supply</div>' +
                        '<div class="text-lg font-bold text-slate-800">' + CommonRenderer.formatCurrency(s.supply_usd) + '</div></div>' +
                    '<div><div class="text-xs text-slate-400 font-medium uppercase">Coverage</div>' +
                        '<div class="text-lg font-bold ' + covCls + '">' + covTxt + '</div>' +
                        (buffer != null ?
                            '<div class="text-xs text-slate-500 mt-0.5">Buffer: <span class="font-mono text-green-600">+' +
                                UsdaiRenderer._usdShort(buffer) + '</span></div>' : '') +
                    '</div>' +
                    '<div><div class="text-xs text-slate-400 font-medium uppercase">Peg vs $1</div>' +
                        '<div class="text-lg font-bold text-slate-800">' +
                            (s.peg_secondary_px != null ? '$' + s.peg_secondary_px.toFixed(4) : '—') +
                        '</div>' +
                        '<div class="text-xs ' + pegCls + ' mt-0.5 font-mono">' +
                            UsdaiRenderer._pegPctText(s.peg_deviation_pct, 3) +
                        '</div>' +
                    '</div>' +
                    '<div><div class="text-xs text-slate-400 font-medium uppercase">Status</div>' +
                        '<div class="text-lg">' + UsdaiRenderer._statusPill(pausedLabel, pausedState) + '</div></div>' +
                '</div>';

            var baseOk = (s.base_token || '').toLowerCase() === USDAI_ADDRS.PYUSD.toLowerCase();
            badgeRow =
                '<div class="flex flex-wrap items-center gap-2 mt-3">' +
                    UsdaiRenderer._onChainVerifiableBadge(true) +
                    UsdaiRenderer._statusPill('baseToken = PYUSD' + (baseOk ? ' ✓' : ''), baseOk ? 'ok' : 'warn') +
                '</div>';
        } else {
            // sUSDai
            headerLeft =
                '<div class="text-xl font-bold text-slate-800">sUSDai</div>' +
                '<div class="text-xs text-slate-500 mt-1">Permian Labs · ERC-7540 vault over USDai — GPU/equipment loan book (MetaStreet engine)</div>';

            var nav = s.nav_per_share;
            var d = UsdaiRenderer._navDevDisplay(s.nav_per_share, s.peg_secondary_px, s.discount_to_nav_pct);
            var dState = UsdaiRenderer._navDevState(d);
            var dCls = UsdaiRenderer._stateTextCls(dState);
            var dWord = UsdaiRenderer._navDevWord(d);

            metricsRow =
                '<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">' +
                    '<div><div class="text-xs text-slate-400 font-medium uppercase">Total Assets</div>' +
                        '<div class="text-lg font-bold text-slate-800">' + CommonRenderer.formatCurrency(s.total_assets_usd) + '</div>' +
                        '<div class="text-xs text-slate-500 mt-0.5">USDai-denominated</div></div>' +
                    '<div><div class="text-xs text-slate-400 font-medium uppercase">NAV per share</div>' +
                        '<div class="text-lg font-bold text-slate-800">' + (nav != null ? nav.toFixed(6) : '—') + '</div>' +
                        '<div class="text-xs text-slate-500 mt-0.5 font-mono">convertToAssets(1e18)</div></div>' +
                    '<div><div class="text-xs text-slate-400 font-medium uppercase">Price vs NAV</div>' +
                        '<div class="text-lg font-bold ' + dCls + '">' + UsdaiRenderer._pegPctText(d, 3) + '</div>' +
                        '<div class="text-xs text-slate-500 mt-0.5">' + dWord + '</div></div>' +
                    '<div><div class="text-xs text-slate-400 font-medium uppercase">Status</div>' +
                        '<div class="text-lg">' + UsdaiRenderer._statusPill(pausedLabel, pausedState) + '</div></div>' +
                '</div>';

            var reconState = UsdaiRenderer._reconState(s.recon_residual_pct);
            var reconTxt = (s.recon_residual_pct != null) ? (s.recon_residual_pct * 100).toFixed(2) + '%' : '—';
            var bufState = UsdaiRenderer._bufferState(s.buffer_ratio);
            var bufTxt = (s.buffer_ratio != null) ? (s.buffer_ratio * 100).toFixed(1) + '%' : '—';

            badgeRow =
                '<div class="flex flex-wrap items-center gap-2 mt-3">' +
                    UsdaiRenderer._statusPill('Recon closes', reconState, reconTxt) +
                    UsdaiRenderer._statusPill('Idle buffer', bufState, bufTxt) +
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

    // The USD.AI USP — distinct from regular status pills.
    _onChainVerifiableBadge: function(active) {
        if (!active) return '';
        return '<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ' +
            'bg-emerald-50 text-emerald-800 border border-emerald-200" ' +
            'title="USDai coverage is verifiable on-chain via two reads: PYUSD.balanceOf(USDai) / USDai.totalSupply(). No oracle. See verification commands below.">' +
            '<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">' +
                '<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />' +
            '</svg>' +
            '100% On-Chain Verifiable' +
        '</span>';
    },

    // ============================================================
    // §2u USDai Coverage (USDai only) — the marquee panel
    // ============================================================
    _renderUsdaiCoverage: function(specific, s) {
        var cov = s.coverage_ratio;
        var covState = UsdaiRenderer._coverageState(cov);
        var covCls = UsdaiRenderer._stateTextCls(covState);
        var covPct = (cov != null) ? cov * 100 : null;

        var supply = s.supply_usd || 0;
        var reserve = s.pyusd_reserve_usd || 0;
        // Two comparison bars: supply = 100% baseline, reserve = coverage%.
        var reserveWidth = (supply > 0) ? Math.min((reserve / supply) * 100, 130) : 0;

        var bars =
            '<div class="mt-4 space-y-3">' +
                '<div>' +
                    '<div class="flex justify-between text-xs text-slate-500 mb-1">' +
                        '<span>USDai supply (the claim)</span>' +
                        '<span class="font-mono">' + CommonRenderer.formatCurrencyExact(supply) + '</span>' +
                    '</div>' +
                    '<div class="pct-bar-container" style="height:1.5rem;">' +
                        '<div class="pct-bar" style="width:100%;background:#94a3b8;height:1.5rem;"></div>' +
                    '</div>' +
                '</div>' +
                '<div>' +
                    '<div class="flex justify-between text-xs text-slate-500 mb-1">' +
                        '<span>PYUSD held by USDai contract (the reserve)</span>' +
                        '<span class="font-mono">' + CommonRenderer.formatCurrencyExact(reserve) + '</span>' +
                    '</div>' +
                    '<div class="pct-bar-container" style="height:1.5rem;">' +
                        '<div class="pct-bar" style="width:' + reserveWidth + '%;background:' + USDAI_COLORS.PYUSD + ';height:1.5rem;"></div>' +
                    '</div>' +
                '</div>' +
            '</div>';

        var coverageTile =
            '<div class="flex flex-col items-center justify-center text-center px-4">' +
                '<div class="text-xs text-slate-400 font-medium uppercase">Coverage</div>' +
                '<div class="text-4xl font-bold ' + covCls + ' leading-none mt-1">' +
                    (covPct != null ? covPct.toFixed(2) + '%' : '—') +
                '</div>' +
                '<div class="mt-2">' + UsdaiRenderer._statusPill(
                    covState === 'ok' ? 'Over-collateralized' : covState === 'warn' ? 'Thin' : 'Under', covState) + '</div>' +
                '<div class="text-xs text-slate-400 mt-2">PYUSD reserve ÷ USDai supply</div>' +
            '</div>';

        var grid =
            '<div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">' +
                '<div class="md:col-span-2">' + bars + '</div>' +
                coverageTile +
            '</div>';

        // api.usd.ai cross-check chip
        var apiRes = s.api_stablecoin_reserves_usd;
        var div = s.api_divergence_pct;
        var divState = UsdaiRenderer._divergenceState(div);
        var crossCheck = (apiRes != null) ?
            '<div class="mt-4 flex flex-wrap items-center gap-2 text-xs">' +
                '<span class="text-slate-500">Cross-check (api.usd.ai):</span>' +
                '<span class="font-mono text-slate-700">on-chain ' + UsdaiRenderer._usdShort(reserve) +
                    ' vs reported ' + UsdaiRenderer._usdShort(apiRes) + '</span>' +
                UsdaiRenderer._statusPill('Δ ' + (div != null ? UsdaiRenderer._pegPctText(div, 2) : '—'), divState) +
            '</div>' : '';

        var verifyBlock = UsdaiRenderer._renderVerifyCommands();

        var methodology =
            '<div class="text-xs text-slate-500 italic leading-relaxed mt-4 pt-3 border-t border-slate-200">' +
                'Reserve is PYUSD held directly in the USDai contract — every dollar readable on-chain via ' +
                '<span class="font-mono">balanceOf</span>, no oracle. PYUSD is itself a Paxos-issued, NYDFS-regulated, ' +
                'T-Bill/cash-backed stablecoin with monthly attestations. <strong>On-chain verification stops at PYUSD:</strong> ' +
                'PYUSD\'s own reserves are a separate trust layer, and the reserve sits in an upgradeable contract — ' +
                '"the PYUSD is here now" is a real-time fact, not a trustless guarantee against a future privileged ' +
                'withdrawal (which is exactly what the 48h timelock below makes visible in advance).' +
            '</div>';

        return '<div class="panel">' +
            '<div class="flex items-center justify-between">' +
                '<div class="panel-title" style="margin-bottom:0;">PYUSD Coverage</div>' +
                UsdaiRenderer._onChainVerifiableBadge(true) +
            '</div>' +
            '<div style="margin-bottom:0.5rem;"></div>' +
            grid +
            crossCheck +
            verifyBlock +
            methodology +
        '</div>';
    },

    _renderVerifyCommands: function() {
        var cmds =
            '# 1. USDai supply (18 decimals)\n' +
            'cast call ' + USDAI_ADDRS.USDAI + ' "totalSupply()(uint256)" \\\n' +
            '     --rpc-url $ARB_RPC\n\n' +
            '# 2. PYUSD held by the USDai contract (6 decimals)\n' +
            'cast call ' + USDAI_ADDRS.PYUSD + ' \\\n' +
            '     "balanceOf(address)(uint256)" \\\n' +
            '     ' + USDAI_ADDRS.USDAI + ' \\\n' +
            '     --rpc-url $ARB_RPC\n\n' +
            '# coverage = (PYUSD / 1e6) / (supply / 1e18)\n' +
            '#   note the decimals differ: PYUSD 6dp, USDai 18dp.';

        return '<details class="mt-4 group">' +
            '<summary class="cursor-pointer text-sm font-semibold text-emerald-700 hover:text-emerald-900 select-none" ' +
                'style="list-style:none;">' +
                '<span class="inline-block transform group-open:rotate-90 transition-transform">▶</span> ' +
                'Show verification commands' +
            '</summary>' +
            '<div class="mt-2 relative">' +
                '<button onclick="UsdaiRenderer._copyVerify(this)" ' +
                    'class="absolute top-2 right-2 px-2 py-0.5 text-xs rounded bg-slate-700 text-slate-100 hover:bg-slate-600 transition-colors">' +
                    'Copy' +
                '</button>' +
                '<pre id="usdai-verify-cmds" class="text-xs bg-slate-900 text-slate-100 p-3 pr-16 rounded overflow-x-auto font-mono leading-relaxed">' +
                    cmds +
                '</pre>' +
                '<div class="text-xs text-slate-400 italic mt-2">' +
                    'Set <span class="font-mono">$ARB_RPC</span> to any Arbitrum mainnet endpoint. ' +
                    'You should get the same coverage shown above (within block-timing tolerance).' +
                '</div>' +
            '</div>' +
        '</details>';
    },

    _copyVerify: function(btn) {
        var pre = document.getElementById('usdai-verify-cmds');
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

    // ============================================================
    // §2s sUSDai Decomposition (sUSDai only) — the hero panel
    // ============================================================
    _renderSusdaiDecomposition: function(specific, s) {
        var d = specific.decomposition || {};
        var total = d.total_assets_usd || s.total_assets_usd || 0;
        var segs = [
            { key: 'idle_usdai', label: 'Idle USDai', value: d.idle_usdai_usd, color: USDAI_COLORS.IDLE_USDAI, tag: 'on-chain' },
            { key: 'idle_pyusd', label: 'Idle PYUSD', value: d.idle_pyusd_usd, color: USDAI_COLORS.IDLE_PYUSD, tag: 'on-chain' },
            { key: 'escrow',     label: 'DepositTimelock escrow', value: d.deposit_timelock_escrow_usd, color: USDAI_COLORS.ESCROW, tag: 'committed-undrawn' },
            { key: 'drawn',      label: 'Drawn GPU loans', value: d.implied_deployed_loans_usd, color: USDAI_COLORS.DRAWN, tag: 'live credit' }
        ].filter(function(x) { return x.value != null && x.value > 0; });

        var reconState = UsdaiRenderer._reconState(d.recon_residual_pct);
        var reconTxt = (d.recon_residual_pct != null) ? (d.recon_residual_pct * 100).toFixed(2) + '%' : '—';

        // Stacked bar — segments proportional to totalAssets; tiny slices keep a
        // minimum visible width.
        var barSegs = segs.map(function(x) {
            var pct = total > 0 ? (x.value / total * 100) : 0;
            return '<div title="' + x.label + ': ' + CommonRenderer.formatCurrencyExact(x.value) + ' (' + pct.toFixed(1) + '%)" ' +
                'style="width:' + pct + '%;min-width:3px;background:' + x.color + ';height:2.5rem;"></div>';
        }).join('');
        var bar =
            '<div class="flex w-full rounded overflow-hidden mt-4" style="height:2.5rem;border:1px solid #e2e8f0;">' +
                barSegs +
            '</div>';

        // Legend
        var legend =
            '<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">' +
                segs.map(function(x) {
                    var pct = total > 0 ? (x.value / total * 100) : 0;
                    return '<div class="text-xs">' +
                        '<div class="flex items-center gap-1.5">' +
                            '<span class="inline-block w-2.5 h-2.5 rounded-sm" style="background:' + x.color + '"></span>' +
                            '<span class="font-medium text-slate-700">' + x.label + '</span>' +
                        '</div>' +
                        '<div class="font-mono text-slate-800 mt-0.5">' + CommonRenderer.formatCurrency(x.value) + '</div>' +
                        '<div class="text-slate-400">' + pct.toFixed(1) + '% · ' + x.tag + '</div>' +
                    '</div>';
                }).join('') +
            '</div>';

        // Credit pipeline summary
        var cp = d.credit_pipeline || {};
        var pipeline =
            '<div class="mt-5 rounded-lg p-4" style="background:#fff7ed;border:1px solid #fed7aa;">' +
                '<div class="text-sm font-semibold text-slate-800 mb-1">Credit pipeline</div>' +
                '<div class="text-sm text-slate-700">' +
                    '<span class="font-mono">' + UsdaiRenderer._usdShort(cp.drawn_usd) + '</span> drawn' +
                    ' &nbsp;+&nbsp; ' +
                    '<span class="font-mono">' + UsdaiRenderer._usdShort(cp.committed_undrawn_usd) + '</span> committed-undrawn' +
                    ' &nbsp;=&nbsp; ' +
                    '<span class="font-mono font-bold text-orange-700">' + UsdaiRenderer._usdShort(cp.total_loan_destined_usd) + '</span> loan-destined' +
                '</div>' +
                '<div class="text-xs text-slate-500 mt-1">' +
                    'Credit exposure is larger than the drawn-loan headline — escrow converts to live credit as borrowers draw.' +
                '</div>' +
            '</div>';

        // Cross-check vs api loansReserves
        var apiLoans = d.api_loans_reserves_usd;
        var crossCheck = (apiLoans != null) ?
            '<div class="mt-3 flex flex-wrap items-center gap-2 text-xs">' +
                '<span class="text-slate-500">Cross-check:</span>' +
                '<span class="font-mono text-slate-700">implied drawn ' + UsdaiRenderer._usdShort(d.implied_deployed_loans_usd) +
                    ' ≈ api loansReserves ' + UsdaiRenderer._usdShort(apiLoans) + '</span>' +
                UsdaiRenderer._statusPill('Recon Δ ' + reconTxt, reconState) +
            '</div>' : '';

        var escrowNote =
            '<div class="text-xs text-slate-500 italic leading-relaxed mt-4 pt-3 border-t border-slate-200">' +
                'ⓘ The <strong>DepositTimelock escrow</strong> is USDai committed to loans but awaiting borrower draw — ' +
                'returnable if a loan does not draw, and converting to live GPU-loan credit as borrowers draw down. It is ' +
                'the line that previously read as an unexplained balance; <span class="font-mono">totalAssets</span> now ' +
                'reconciles on-chain to within ' + reconTxt + '. Verify the escrow directly: ' +
                '<span class="font-mono">PYUSD/USDai balanceOf(' + UsdaiRenderer._truncAddr(USDAI_ADDRS.DEPOSIT_TIMELOCK) + ')</span> ' +
                UsdaiRenderer._explorerLink(USDAI_ADDRS.DEPOSIT_TIMELOCK) + '. ' +
                'NAV per share = <span class="font-mono">convertToAssets(1e18)</span>; 1 sUSDai ≠ $1 by design.' +
            '</div>';

        return '<div class="panel">' +
            '<div class="flex items-center justify-between flex-wrap gap-2">' +
                '<div class="panel-title" style="margin-bottom:0;">Asset Decomposition' +
                    ' <span class="text-xs font-normal text-slate-500">— totalAssets ' + UsdaiRenderer._usdShort(total) + '</span>' +
                '</div>' +
                UsdaiRenderer._statusPill('Recon closes', reconState, reconTxt) +
            '</div>' +
            bar +
            legend +
            pipeline +
            crossCheck +
            escrowNote +
        '</div>';
    },

    // ============================================================
    // §3s sUSDai NAV Trajectory (sUSDai only)
    // ============================================================
    _renderSusdaiNav: function(specific, s) {
        var statCards =
            '<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">' +
                '<div class="summary-card"><div class="card-label">NAV per share</div>' +
                    '<div class="card-value">' + (s.nav_per_share != null ? s.nav_per_share.toFixed(6) : '—') + '</div>' +
                    '<div class="text-xs text-slate-400 mt-1 font-mono">convertToAssets(1e18)</div></div>' +
                '<div class="summary-card"><div class="card-label">Realized APY (7d)</div>' +
                    '<div class="card-value" id="usdai-apy-7d">—</div>' +
                    '<div class="text-xs text-slate-400 mt-1">from NAV history</div></div>' +
                '<div class="summary-card"><div class="card-label">Realized APY (30d)</div>' +
                    '<div class="card-value" id="usdai-apy-30d">—</div>' +
                    '<div class="text-xs text-slate-400 mt-1">from NAV history</div></div>' +
                '<div class="summary-card"><div class="card-label">Protocol target</div>' +
                    '<div class="card-value text-base">10–15%</div>' +
                    '<div class="text-xs text-slate-400 mt-1">loan-tier, disclosed — not a guarantee</div></div>' +
            '</div>';

        var chartBlock =
            '<div class="mt-6">' +
                '<div class="text-sm font-semibold text-slate-700 mb-2">NAV per share — 30d</div>' +
                '<div style="height: 320px; position: relative;">' +
                    '<canvas id="usdai-nav-chart"></canvas>' +
                '</div>' +
            '</div>';

        var methodology =
            '<div class="text-xs text-slate-500 italic leading-relaxed mt-4 pt-3 border-t border-slate-200">' +
                'NAV should rise monotonically as loan interest accrues — a drop between cycles is a loan-loss signal ' +
                '(<span class="font-mono">nav_regression</span> alert). sUSDai is an ERC-7540 async vault with an ' +
                'epoch/vesting redemption queue, so realized yield lands with a lag and a fresh position accrues slowly ' +
                'at first. Realized APY is derived from the NAV slope over the available window; the 10–15% target is ' +
                'a Permian-disclosed design number on the loan tier, not a promise.' +
            '</div>';

        return '<div class="panel">' +
            '<div class="panel-title">NAV Trajectory <span class="text-xs font-normal text-slate-500">— yield landing</span></div>' +
            statCards +
            chartBlock +
            methodology +
        '</div>';
    },

    _loadNavChart: function(slug) {
        var ctx = document.getElementById('usdai-nav-chart');
        var nocache = Math.floor(Date.now() / 60000);
        fetch('data/' + slug + '_backing_history.json?nocache=' + nocache)
            .then(function(r) { return r.ok ? r.json() : null; })
            .then(function(hist) {
                var entries = (hist && Array.isArray(hist.entries)) ? hist.entries : [];
                UsdaiRenderer._fillApyCards(entries);
                if (!ctx || typeof Chart === 'undefined') return;
                if (entries.length < 2) {
                    ctx.parentElement.innerHTML = '<div class="text-xs text-slate-400 italic">NAV history not yet available — chart populates after a few hours of samples.</div>';
                    return;
                }
                UsdaiRenderer._drawNavChart(ctx, entries);
            })
            .catch(function() {
                if (ctx) ctx.parentElement.innerHTML = '<div class="text-xs text-slate-400 italic">NAV history unavailable.</div>';
            });
    },

    // Annualize the NAV slope over the trailing `days` window. Returns null when
    // the window is too short or NAV hasn't moved enough to be meaningful.
    _realizedApy: function(entries, days) {
        var navd = entries.filter(function(e) { return e.nav_per_share != null; }).map(function(e) {
            var ts = e.timestamp.endsWith('Z') ? e.timestamp : (e.timestamp + 'Z');
            return { t: new Date(ts).getTime(), nav: e.nav_per_share };
        }).sort(function(a, b) { return a.t - b.t; });
        if (navd.length < 2) return null;
        var end = navd[navd.length - 1];
        var cutoff = end.t - days * 24 * 3600 * 1000;
        // First sample at or after the cutoff (the window start).
        var start = null;
        for (var i = 0; i < navd.length; i++) {
            if (navd[i].t >= cutoff) { start = navd[i]; break; }
        }
        if (!start || start.t === end.t) return null;
        var spanYears = (end.t - start.t) / (365.25 * 24 * 3600 * 1000);
        // Require at least ~1 day of span to avoid wild annualization off noise.
        if (spanYears < (1 / 365.25) || start.nav <= 0) return null;
        var growth = end.nav / start.nav;
        if (growth <= 0) return null;
        return Math.pow(growth, 1 / spanYears) - 1;
    },

    _fillApyCards: function(entries) {
        function setCard(id, days) {
            var el = document.getElementById(id);
            if (!el) return;
            var apy = UsdaiRenderer._realizedApy(entries, days);
            if (apy == null) {
                el.textContent = '—';
                el.className = 'card-value text-base text-slate-400';
                return;
            }
            el.textContent = (apy * 100).toFixed(2) + '%';
            el.className = 'card-value ' + (apy < 0 ? 'text-red-600' : '');
        }
        setCard('usdai-apy-7d', 7);
        setCard('usdai-apy-30d', 30);
    },

    _drawNavChart: function(ctx, entries) {
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

        if (window._usdaiNavChart) {
            try { window._usdaiNavChart.destroy(); } catch (e) {}
        }
        window._usdaiNavChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'NAV per share',
                    data: navSeries,
                    borderColor: '#ea580c',
                    backgroundColor: 'rgba(234, 88, 12, 0.08)',
                    fill: true,
                    tension: 0.25,
                    pointRadius: 0,
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
                        ticks: { font: { size: 11 }, callback: function(v) { return Number(v).toFixed(4); } }
                    }
                },
                plugins: {
                    legend: { display: true, position: 'top', labels: { boxWidth: 12, font: { size: 11 } } },
                    tooltip: { callbacks: { label: function(c) { return c.dataset.label + ': ' + Number(c.raw).toFixed(6); } } }
                },
                interaction: { intersect: false, mode: 'index' }
            }
        });
    },

    // ============================================================
    // §4 Secondary Market (both)
    // ============================================================
    _renderSecondaryMarket: function(specific, slug) {
        var sec = specific.secondary || {};
        var slip = specific.slippage_tiers || {};
        var pools = Array.isArray(sec.top_pools) ? sec.top_pools : [];
        var isVault = slug === 'susdai';
        var quoteKey = isVault ? 'susdai_to_usdc' : 'usdai_to_usdc';
        var pairLabel = isVault ? 'sUSDai → USDC' : 'USDai → USDC';

        // Headline tile: price-vs-NAV (sUSDai) vs price-vs-$1 (USDai).
        var headlineTile;
        if (isVault) {
            var nav = specific.nav_per_share;
            var disc = UsdaiRenderer._navDevDisplay(nav, sec.price_usd, sec.discount_to_nav_pct);
            var dState = UsdaiRenderer._navDevState(disc);
            var dCls = UsdaiRenderer._pegPctClass(dState);
            var dWord = UsdaiRenderer._navDevWord(disc);
            headlineTile =
                '<div class="summary-card"><div class="card-label">Price vs NAV</div>' +
                    '<div class="card-value ' + dCls + '">' + UsdaiRenderer._pegPctText(disc, 3) + '</div>' +
                    '<div class="text-xs text-slate-500 mt-0.5">' + dWord + ' · secondary px ' +
                        (sec.price_usd != null ? '$' + sec.price_usd.toFixed(4) : '—') + ' vs contract NAV</div>' +
                    '<div class="mt-1">' + UsdaiRenderer._statusPill(UsdaiRenderer._pegStatusLabel(dState), dState) + '</div>' +
                '</div>';
        } else {
            var dev = sec.deviation_pct;
            var pState = UsdaiRenderer._pegStatusClass(dev);
            var pCls = UsdaiRenderer._pegPctClass(pState);
            headlineTile =
                '<div class="summary-card"><div class="card-label">Implied price</div>' +
                    '<div class="card-value">' + (sec.price_usd != null ? '$' + sec.price_usd.toFixed(4) : '—') + '</div>' +
                    '<div class="text-xs ' + pCls + ' mt-0.5 font-mono">' + UsdaiRenderer._pegPctText(dev, 3) + '</div>' +
                    '<div class="mt-1">' + UsdaiRenderer._statusPill(UsdaiRenderer._pegStatusLabel(pState), pState) + '</div>' +
                '</div>';
        }

        // Deepest two pools as cards (sorted by TVL).
        var sorted = pools.slice().sort(function(a, b) { return (b.tvl_usd || 0) - (a.tvl_usd || 0); });
        var poolCards = sorted.slice(0, 2).map(function(p, i) {
            return '<div class="summary-card"><div class="card-label">' + (p.name || 'Pool') +
                    (i === 0 ? ' <span class="text-[10px] font-normal text-emerald-600">(deepest)</span>' : '') + '</div>' +
                '<div class="card-value text-base">' + CommonRenderer.formatCurrency(p.tvl_usd) + ' TVL</div>' +
                '<div class="text-xs text-slate-400 mt-1">' + CommonRenderer.formatCurrency(p.vol_24h_usd) + ' / 24h vol</div>' +
                '<div class="text-xs mt-1">' + UsdaiRenderer._addrCell(p.address) + '</div>' +
            '</div>';
        }).join('');

        var topRow =
            '<div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">' +
                headlineTile +
                (poolCards || '<div class="summary-card"><div class="text-xs text-slate-400 italic">No pool data in this snapshot.</div></div>') +
            '</div>';

        // Slippage tiers — shape {output_usd, slippage_bps, ...} keyed by notional.
        var qm = slip[quoteKey] || {};
        var tiers = ['1000', '10000', '100000', '500000'];
        var hasAny = tiers.some(function(t) { return qm[t] && (qm[t].slippage_bps != null || qm[t].output_usd != null); });
        var slipBlock = '';
        if (hasAny) {
            var rows = tiers.map(function(t) {
                var q = qm[t] || {};
                var sizeTxt = '$' + (Number(t) / 1000).toFixed(0) + 'K';
                var out = (q.output_usd != null) ? q.output_usd : q.out;
                var outTxt = (out != null) ? '$' + Number(out).toLocaleString('en-US', { maximumFractionDigits: 0 }) : '—';
                var bps = q.slippage_bps;
                var bpsState = (bps == null) ? 'unknown' : (bps < 25) ? 'ok' : (bps < 100) ? 'warn' : 'critical';
                var bpsCls = UsdaiRenderer._stateTextCls(bpsState);
                return '<tr>' +
                    '<td class="font-mono text-right">' + sizeTxt + '</td>' +
                    '<td class="font-mono text-right">' + outTxt + '</td>' +
                    '<td class="font-mono text-right ' + bpsCls + '">' + (bps != null ? bps.toFixed(1) + ' bps' : '—') + '</td>' +
                '</tr>';
            }).join('');
            slipBlock =
                '<div class="mt-6">' +
                    '<div class="text-sm font-semibold text-slate-700 mb-2">Slippage tiers — ' + pairLabel + '</div>' +
                    '<div class="data-table-scroll"><table class="data-table">' +
                        '<thead><tr><th class="text-right">Size</th><th class="text-right">Output</th><th class="text-right">Slippage</th></tr></thead>' +
                        '<tbody>' + rows + '</tbody>' +
                    '</table></div>' +
                '</div>';
        }

        var note =
            '<div class="text-xs text-slate-500 italic leading-relaxed mt-4 pt-3 border-t border-slate-200">' +
                'No CEX listings; on-chain DEX only. Depth is thin against supply, so a large holder cannot exit ' +
                'at par through the secondary market alone — expect material slippage approaching $500k. Quotes via ' +
                (sec.source || 'GeckoTerminal') + '/KyberSwap. ' +
                (isVault ?
                    'For a vault share, price-vs-NAV (not price-vs-$1) is the meaningful peg metric — 1 sUSDai ≠ $1 by ' +
                    'design. Positive (+) = premium above NAV; negative (-) = discount below NAV. A persistent small ' +
                    'discount typically reflects the redemption queue, not a backing problem.' :
                    'USDai is a $1 claim; deviation is measured vs $1.00.') +
            '</div>';

        return '<div class="panel">' +
            '<div class="panel-title">Secondary Market</div>' +
            topRow + slipBlock + note +
        '</div>';
    },

    // ============================================================
    // §5 Governance / Trust Stack (async, family) — framed as a STRENGTH
    // §6 Family panel (async, family)
    // One fetch of usdai_family.json fills both. On miss, §5 degrades to the
    // per-asset proxy facts the backing JSON carries; §6 clears.
    // ============================================================
    _loadFamily: function(slug, data) {
        var govEl = document.getElementById('usdai-gov-panel');
        var famEl = document.getElementById('usdai-family-panel');
        var nocache = Math.floor(Date.now() / 60000);
        fetch('data/usdai_family.json?nocache=' + nocache)
            .then(function(r) { return r.ok ? r.json() : null; })
            .then(function(fam) {
                if (govEl) govEl.innerHTML = UsdaiRenderer._renderGovPanel(fam, data, slug);
                if (famEl) famEl.innerHTML = fam ? UsdaiRenderer._renderFamilyHtml(fam, slug) : '';
            })
            .catch(function() {
                if (govEl) govEl.innerHTML = UsdaiRenderer._renderGovPanel(null, data, slug);
                if (famEl) famEl.innerHTML = '';
            });
    },

    _renderGovPanel: function(fam, data, slug) {
        var gov = (fam && fam.governance) || {};
        var s = (data && data.summary) || {};
        var proxies = gov.proxies || {};
        // Prefer family per-asset proxy data; fall back to the backing summary.
        var uImpl = (proxies.usdai && proxies.usdai.implementation) || (slug === 'usdai' ? s.implementation : null);
        var uAdmin = (proxies.usdai && proxies.usdai.proxy_admin_slot) || (slug === 'usdai' ? s.admin_slot : null);
        var sImpl = (proxies.susdai && proxies.susdai.implementation) || (slug === 'susdai' ? s.implementation : null);
        var sAdmin = (proxies.susdai && proxies.susdai.proxy_admin_slot) || (slug === 'susdai' ? s.admin_slot : null);

        var minDelay = gov.min_delay_seconds;
        var delayHrs = (minDelay != null) ? Math.round(minDelay / 3600) : null;
        var delayTxt = (delayHrs != null) ? delayHrs + 'h' : '48h';
        var threshold = gov.gov_safe_threshold;
        var thresholdTxt = (threshold != null) ? threshold + '-of-' + (Array.isArray(gov.gov_safe_owners) ? gov.gov_safe_owners.length : threshold) : '3-of-3';

        function row(label, u, sv) {
            return '<tr>' +
                '<td class="font-medium">' + label + '</td>' +
                '<td>' + u + '</td>' +
                '<td>' + (sv != null ? sv : '') + '</td>' +
            '</tr>';
        }

        var rows = '';
        rows += row('Proxy implementation', UsdaiRenderer._addrCell(uImpl), UsdaiRenderer._addrCell(sImpl));
        rows += row('Proxy admin', UsdaiRenderer._addrCell(uAdmin), UsdaiRenderer._addrCell(sAdmin));
        if (gov.timelock) {
            rows += row('Upgrade authority',
                UsdaiRenderer._statusPill(delayTxt + ' timelock', 'ok') + ' ' + UsdaiRenderer._addrCell(gov.timelock),
                '<span class="text-xs text-slate-500">same timelock owns both proxy admins</span>');
        }
        if (gov.gov_safe) {
            var delayOk = gov.min_delay_ok !== false;
            rows += row('Governance multisig',
                UsdaiRenderer._statusPill(thresholdTxt + ' Safe', delayOk ? 'ok' : 'warn') + ' ' + UsdaiRenderer._addrCell(gov.gov_safe),
                '<span class="text-xs text-slate-500">proposer · executor · canceller on the timelock</span>');
        }
        if (gov.ops_safe) {
            rows += row('Operational admin',
                UsdaiRenderer._addrCell(gov.ops_safe),
                '<span class="text-xs text-slate-500">holds DEFAULT_ADMIN_ROLE (same signer set)</span>');
        }

        // Pending-upgrade (CallScheduled) watch.
        var cs = gov.call_scheduled || {};
        var watch;
        if (Array.isArray(cs.pending_ops) && cs.pending_ops.length > 0) {
            var lines = cs.pending_ops.map(function(op) {
                var eta = op.eta || op.executes_at || op.ready_at;
                var etaTxt = '';
                if (eta) {
                    var ms = new Date(eta.endsWith && eta.endsWith('Z') ? eta : eta).getTime() - Date.now();
                    etaTxt = ms > 0 ? ' — executes in ~' + Math.ceil(ms / 3600000) + 'h' : ' — executable now';
                }
                return '<li class="font-mono text-xs">' + (op.id || op.operation_id || 'op') + etaTxt + '</li>';
            }).join('');
            watch =
                '<div class="risk-flag risk-warning mt-3">' +
                    '<strong>⏳ Pending upgrade scheduled on the timelock.</strong> Visible on-chain now; cannot execute ' +
                    'until the ' + delayTxt + ' delay elapses — that is the holder exit window.' +
                    '<ul class="mt-1 ml-4 list-disc">' + lines + '</ul>' +
                '</div>';
        } else if (cs.scanned === true) {
            watch =
                '<div class="mt-3">' +
                    UsdaiRenderer._statusPill('No pending upgrades', 'ok') +
                    '<span class="text-xs text-slate-500 ml-2">timelock scanned' +
                        (cs.scan_window_blocks ? ' over last ' + Number(cs.scan_window_blocks).toLocaleString() + ' blocks' : '') +
                        ' — no CallScheduled events.</span>' +
                '</div>';
        } else {
            watch =
                '<div class="mt-3">' +
                    UsdaiRenderer._statusPill('Pending-upgrade scan initializing', 'unknown') +
                    '<span class="text-xs text-slate-500 ml-2">CallScheduled watch not yet active in this snapshot.</span>' +
                '</div>';
        }

        // Green strength banner — the inverse of a single-EOA red banner.
        var banner =
            '<div class="risk-flag mt-3" style="background:#ecfdf5;color:#065f46;border-left:4px solid #10b981;">' +
                '<strong>Governance is a relative strength.</strong> Upgrades to both proxies pass through a ' +
                delayTxt + ' OZ TimelockController controlled by a ' + thresholdTxt + ' Safe — there is no single ' +
                'admin EOA. A malicious or buggy upgrade is visible on-chain for ~' + delayTxt + ' before it can land, ' +
                'giving holders an exit window. (The residual is that admin actions are still possible at all: the ' +
                'reserve/loan contracts are upgradeable — the timelock bounds the surprise, it does not remove the power.)' +
            '</div>';

        var auditLine =
            '<div class="text-sm text-slate-600 mt-3 pt-3 border-t border-slate-200">' +
                'Audit: <strong>Cantina (Spearbit)</strong> reviewed USDai + sUSDai — 0 critical / 0 high / 1 medium (fixed) / 8 low. ' +
                '<span class="text-xs text-slate-500">Live bug bounty; audit set shared across both tokens.</span>' +
            '</div>';

        return '<div class="panel">' +
            '<div class="panel-title">Governance &amp; Trust</div>' +
            '<div class="data-table-scroll">' +
                '<table class="data-table">' +
                    '<thead><tr><th>Component</th><th>USDai</th><th>sUSDai</th></tr></thead>' +
                    '<tbody>' + rows + '</tbody>' +
                '</table>' +
            '</div>' +
            watch +
            banner +
            auditLine +
            (!fam ? '<div class="text-xs text-slate-400 italic mt-2">Live timelock / multisig details load from the family snapshot — currently unavailable; showing per-asset proxy facts only.</div>' : '') +
        '</div>';
    },

    _renderFamilyHtml: function(fam, currentSlug) {
        var gov = fam.governance || {};
        var totals = fam.totals || {};
        var api = fam.api_usd_ai || {};
        var credit = fam.credit_exposure || {};

        // Aggregate AUM card (double-count adjusted).
        var aumLines = [];
        if (totals.usdai_supply_usd != null) {
            aumLines.push('<div class="flex justify-between text-sm py-1">' +
                '<span class="text-slate-600">USDai supply</span>' +
                '<span class="font-mono">' + CommonRenderer.formatCurrencyExact(totals.usdai_supply_usd) + '</span></div>');
        }
        if (totals.susdai_total_assets_usd != null) {
            aumLines.push('<div class="flex justify-between text-sm py-1">' +
                '<span class="text-slate-600">sUSDai total assets</span>' +
                '<span class="font-mono">' + CommonRenderer.formatCurrencyExact(totals.susdai_total_assets_usd) + '</span></div>');
        }
        // The double-count adjustment, computed so it always equals the gap
        // between the raw sum and the reported combined AUM.
        if (totals.usdai_supply_usd != null && totals.susdai_total_assets_usd != null && totals.combined_aum_usd != null) {
            var adj = totals.usdai_supply_usd + totals.susdai_total_assets_usd - totals.combined_aum_usd;
            aumLines.push('<div class="flex justify-between text-sm py-1 text-slate-400">' +
                '<span>Less USDai inside sUSDai (idle + escrow)</span>' +
                '<span class="font-mono">−' + CommonRenderer.formatCurrencyExact(adj) + '</span></div>');
        }
        if (totals.combined_aum_usd != null) {
            aumLines.push('<div class="flex justify-between text-base font-bold py-1 border-t border-slate-200 mt-1">' +
                '<span>Combined family AUM</span>' +
                '<span class="font-mono text-indigo-700">' + CommonRenderer.formatCurrencyExact(totals.combined_aum_usd) + '</span></div>');
        }
        var creditLine = (credit.total_loan_destined_usd != null) ?
            '<div class="text-xs text-slate-500 mt-2">Credit exposure: <span class="font-mono">' +
                UsdaiRenderer._usdShort(credit.drawn_loans_usd) + '</span> drawn + <span class="font-mono">' +
                UsdaiRenderer._usdShort(credit.committed_undrawn_escrow_usd) + '</span> committed = <span class="font-mono font-semibold">' +
                UsdaiRenderer._usdShort(credit.total_loan_destined_usd) + '</span> loan-destined.</div>' : '';
        var aumCard =
            '<div>' +
                '<div class="text-sm font-semibold text-slate-700 mb-2">Aggregate AUM</div>' +
                aumLines.join('') +
                (totals.comment ? '<div class="text-xs text-slate-500 italic mt-2">' + totals.comment + '</div>' : '') +
                creditLine +
            '</div>';

        // Shared authority-chain card.
        var signers = Array.isArray(gov.gov_safe_owners) ? gov.gov_safe_owners : [];
        var signerRows = signers.map(function(a, i) {
            return '<tr><td class="font-medium">Signer ' + (i + 1) + '</td><td>' + UsdaiRenderer._addrCell(a) + '</td></tr>';
        }).join('');
        var delayHrs = (gov.min_delay_seconds != null) ? Math.round(gov.min_delay_seconds / 3600) : null;
        var govCard =
            '<div>' +
                '<div class="text-sm font-semibold text-slate-700 mb-1">Shared authority chain</div>' +
                '<div class="text-xs text-slate-500 mb-2">' + (gov.model || '48h timelock + 3-of-3 Safe') + '</div>' +
                '<table class="data-table"><tbody>' +
                    '<tr><td class="font-medium">Timelock</td><td>' + UsdaiRenderer._addrCell(gov.timelock) +
                        ' <span class="text-xs text-slate-500">getMinDelay ' + (delayHrs != null ? delayHrs + 'h' : '—') + '</span></td></tr>' +
                    '<tr><td class="font-medium">Gov Safe</td><td>' + UsdaiRenderer._addrCell(gov.gov_safe) +
                        ' <span class="text-xs text-slate-500">' + (gov.gov_safe_threshold != null ? gov.gov_safe_threshold + '-of-' + signers.length : '') + '</span></td></tr>' +
                    '<tr><td class="font-medium">Ops Safe</td><td>' + UsdaiRenderer._addrCell(gov.ops_safe) + '</td></tr>' +
                    signerRows +
                '</tbody></table>' +
            '</div>';

        // api.usd.ai aggregate echo with freshness chip.
        var raw = api.raw || {};
        var stale = api.stale === true;
        var freshState = stale ? 'warn' : 'ok';
        var freshTxt = api.updated_at ? 'updated ' + CommonRenderer.formatDate(api.updated_at) : 'updatedAt —';
        function apiRow(label, v) {
            return '<div class="flex justify-between text-xs py-0.5">' +
                '<span class="text-slate-500">' + label + '</span>' +
                '<span class="font-mono text-slate-700">' + UsdaiRenderer._usdShort(v) + '</span></div>';
        }
        var apiBlock = (api.url) ?
            '<div class="mt-4 pt-3 border-t border-slate-200">' +
                '<div class="flex flex-wrap items-center gap-2 mb-2">' +
                    '<span class="text-sm font-semibold text-slate-700">api.usd.ai aggregate</span>' +
                    UsdaiRenderer._statusPill(stale ? 'Stale (>6h)' : 'Fresh', freshState, '') +
                    '<span class="text-xs text-slate-400">' + freshTxt + '</span>' +
                '</div>' +
                '<div class="grid grid-cols-1 md:grid-cols-2 gap-x-6">' +
                    apiRow('mintedUsdai', raw.mintedUsdai) +
                    apiRow('usdaiTvl', raw.usdaiTvl) +
                    apiRow('sUsdaiTvl', raw.sUsdaiTvl) +
                    apiRow('stablecoinReserves', raw.stablecoinReserves) +
                    apiRow('loansReserves', raw.loansReserves) +
                '</div>' +
                (api.note ? '<div class="text-xs text-slate-400 italic mt-2">' + api.note + '</div>' : '') +
            '</div>' : '';

        var asOf = fam.as_of || fam.timestamp;

        return '<div class="panel">' +
            '<div class="panel-title">USD.AI Family — cross-asset snapshot</div>' +
            '<div class="grid grid-cols-1 md:grid-cols-2 gap-6">' +
                aumCard +
                govCard +
            '</div>' +
            apiBlock +
            '<div class="text-xs text-slate-400 mt-3">As of ' + CommonRenderer.formatDate(asOf) + ' · self-computed; api.usd.ai is cross-check only, never source-of-truth.</div>' +
        '</div>';
    }
};
