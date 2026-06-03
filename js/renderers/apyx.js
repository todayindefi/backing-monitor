/**
 * Apyx renderer — apxUSD (non-yield) + apyUSD (ERC-4626 wrapper).
 *
 * Single renderer registered for both slugs; the two products share the
 * same Accountable proof-of-solvency feed, the same bridge admin, and the
 * same governance topology. Asset-specific divergence lives in:
 *   - asset_specific.type ('apxusd' | 'apyusd')
 *   - _renderHeadlineCard (different headline metrics)
 *   - _renderYieldTrajectory + _renderUnlockQueue (apyUSD only)
 *   - _renderLiquidity (different quote pairs)
 *   - _renderMultiChainBridge (different conservation invariants, rate limits)
 *
 * Data sources:
 *   - data/apxusd_backing.json + data/apxusd_backing_history.json
 *   - data/apyusd_backing.json + data/apyusd_backing_history.json
 *   - data/apyx_family.json   (async-loaded for the cross-asset family panel)
 *
 * Modeled on js/renderers/syrupusdc.js — same vault-share frame, same
 * Trust Stack pattern, same _suppressCommonPanels approach.
 */

var APYX_BRIDGE_INFO = {
    ccip_version: '1.6.1',
    architecture: 'LockRelease (Ethereum) + BurnMint (Base)',
    router_canonical_eth: '0x80226fc0Ee2b096224EeAc085Bb9a8cba1146f7D',
    rmn_canonical_eth: '0x411dE17f12D1A34ecC7F45f49844626267c75e81'
};

var APYX_AUDITS = {
    primary_audits: 'Quantstamp + Zellic + Certora (formal verification)',
    bug_bounty: 'none disclosed',
    total_audits: 3
};

var ACCOUNTABLE_INFO = {
    enclave_key: '0x5fd592cD004F9089ee56356BD5a46Fa0E62eAf7f',
    parent: 'Accountable (accountable.capital)',
    type: 'AWS Nitro Enclave (TEE)'
};

var APYX_RESERVES_COLORS = {
    'Cash & Equivalents': '#3b82f6',
    'STRC':               '#f59e0b',
    'SATA':               '#a855f7',
    'Other':              '#94a3b8'
};

var APYX_RESERVES_ISSUER = {
    'Cash & Equivalents': '(unitemized)',
    'STRC':               'Strategy (MSTR)',
    'SATA':               'Other DAT',
    'Other':              '—'
};

// Editorial Liquidity scores from riskAnalyst/assets/<slug>.md frontmatter.
// Kept in sync manually — update when the internal report rescore lands.
// apxusd updated 2026-05-21: derived 8.0 = editorial 8.0 (rescore landed in
// riskAnalyst — old editorial was 4.5; bundled redemption-opacity + pool-vs-supply
// concerns now correctly attributed to Peg/Backing axes per the discipline reset).
// Namespaced (not bare EDITORIAL_LIQUIDITY) because saturn.js declares its own
// top-level EDITORIAL_LIQUIDITY for usdat/susdat — bare names collide at load.
var APYX_EDITORIAL_LIQUIDITY = {
    apxusd: 8.0,
    apyusd: 5.5
};

var ApyxRenderer = {

    // ============================================================
    // helpers
    // ============================================================
    _isApyx: function(t) { return t === 'apxusd' || t === 'apyusd'; },

    _truncAddr: function(addr) {
        if (!addr) return '-';
        return addr.slice(0, 6) + '...' + addr.slice(-4);
    },

    _explorerLink: function(addr, chain) {
        if (!addr) return '';
        var base = (chain === 'base') ?
            'https://basescan.org/address/' :
            'https://etherscan.io/address/';
        return '<a href="' + base + addr + '" target="_blank" rel="noopener noreferrer" ' +
            'class="text-blue-500 hover:underline text-xs" title="' + addr + '">↗</a>';
    },

    _addrCell: function(addr, chain) {
        if (!addr) return '<span class="text-slate-400">-</span>';
        return '<span class="font-mono text-xs" title="' + addr + '">' +
            ApyxRenderer._truncAddr(addr) +
            '</span> ' + ApyxRenderer._explorerLink(addr, chain);
    },

    // Three-state colored dot — uses inline span so it works without
    // additional CSS classes beyond what Tailwind already ships.
    _statusDot: function(state) {
        var color;
        if (state === 'ok')       color = '#22c55e';   // green
        else if (state === 'warn') color = '#f59e0b';  // amber
        else if (state === 'critical') color = '#ef4444'; // red
        else color = '#94a3b8';                        // slate (neutral)
        return '<span class="inline-block w-2 h-2 rounded-full align-middle" ' +
            'style="background:' + color + '"></span>';
    },

    _statusPill: function(label, state, extra) {
        var bg, fg;
        if (state === 'ok')        { bg = 'bg-green-100'; fg = 'text-green-800'; }
        else if (state === 'warn') { bg = 'bg-amber-100'; fg = 'text-amber-800'; }
        else if (state === 'critical') { bg = 'bg-red-100'; fg = 'text-red-800'; }
        else                       { bg = 'bg-slate-100'; fg = 'text-slate-700'; }
        return '<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ' + bg + ' ' + fg + '">' +
            ApyxRenderer._statusDot(state) +
            '<span>' + label + (extra ? ' <span class="font-mono">' + extra + '</span>' : '') + '</span>' +
        '</span>';
    },

    _provenancePill: function(kind) {
        var cfg = {
            tee: {
                label: 'TEE-attested (MTM)',
                cls: 'bg-blue-50 text-blue-700 border-blue-200',
                title: 'Accountable TEE proof-of-solvency feed. Values are mark-to-market per Accountable NAV docs; per-instrument pricing rules are not disclosed in the public feed.'
            },
            cpa: {
                label: 'CPA-attested',
                cls: 'bg-violet-50 text-violet-700 border-violet-200',
                title: 'Wolf & Company monthly AICPA examination.'
            },
            onchain: {
                label: 'On-chain',
                cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                title: 'Read directly from contract state by the analyzer.'
            }
        }[kind];
        if (!cfg) return '';
        return '<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium border ' + cfg.cls + ' cursor-help" title="' + cfg.title + '">' + cfg.label + '</span>';
    },

    // R13: inject an id into the outermost <div class="panel"> of a
    // rendered panel so the anchor nav can jump-link to it. Idempotent —
    // if the html doesn't lead with <div class="panel">, it's returned
    // unchanged (e.g. the family-panel placeholder, which is a bare div).
    _anchor: function(id, html) {
        if (!html || typeof html !== 'string') return html;
        return html.replace(/^(<div class="panel")/, '<div id="' + id + '" class="panel"');
    },

    // Amber trust banner injected above the CR History chart. Pairs with the
    // tidresearch report disclaimer so a reader who jumps between dashboard
    // and report sees the same caveats with the same framing. Apyx-only —
    // other dashboards short-circuit. Idempotent — the #apyx-trust-disclaimer
    // id guard means re-renders (5-minute auto-refresh, anchor-nav clicks)
    // don't stack copies.
    _renderTrustDisclaimer: function(slug) {
        if (!ApyxRenderer._isApyx(slug)) return;
        var chartPanel = document.getElementById('chart-panel');
        if (!chartPanel || !chartPanel.parentNode) return;
        if (document.getElementById('apyx-trust-disclaimer')) return;

        var banner = document.createElement('div');
        banner.id = 'apyx-trust-disclaimer';
        banner.className = 'risk-flag risk-warning mb-4';
        banner.innerHTML =
            '<strong>Trust posture — read before acting:</strong> ' +
            'Backing sits off-chain with an unnamed custodian/broker (legal structure not publicly ' +
            'disclosed) and is published via Accountable\'s real-time TEE-attested proof-of-solvency ' +
            'feed — not on-chain proof-of-reserves and not a PCAOB-firm audit. ' +
            'Cash composition is not itemized, and the bridge-admin Safe (3-of-6) can re-configure ' +
            'rate limits, chain peers, and RMN with no timelock. Treat panels below as analyst ' +
            'inference over the public attestation and on-chain state; the full report ' +
            '(link in header) carries the sourcing and limitations.';
        chartPanel.parentNode.insertBefore(banner, chartPanel);
    },

    _chainBadge: function(chain) {
        var label = chain.charAt(0).toUpperCase() + chain.slice(1);
        var cls = (chain === 'base') ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-700';
        return '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ' + cls + '">' + label + '</span>';
    },

    // "3m 34s ago" / "1h 04m ago" — used for the attestation-age pill.
    _formatAge: function(seconds) {
        if (seconds == null) return '—';
        var s = Math.max(0, Math.floor(seconds));
        if (s < 60) return s + 's ago';
        if (s < 3600) {
            var m = Math.floor(s / 60);
            var r = s - m * 60;
            return m + 'm ' + (r < 10 ? '0' + r : r) + 's ago';
        }
        if (s < 86400) {
            var h = Math.floor(s / 3600);
            var m2 = Math.floor((s - h * 3600) / 60);
            return h + 'h ' + (m2 < 10 ? '0' + m2 : m2) + 'm ago';
        }
        var d = Math.floor(s / 86400);
        return d + (d === 1 ? ' day ago' : ' days ago');
    },

    _formatToken: function(num, decimals) {
        if (num === null || num === undefined) return '-';
        decimals = decimals !== undefined ? decimals : 2;
        return num.toLocaleString('en-US', { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
    },

    _formatShares: function(num) {
        if (num == null) return '-';
        if (Math.abs(num) >= 1e6) return (num / 1e6).toFixed(2) + 'M shares';
        if (Math.abs(num) >= 1e3) return (num / 1e3).toFixed(2) + 'K shares';
        return num.toFixed(0) + ' shares';
    },

    _rawToTokens: function(raw, decimals) {
        if (raw == null) return null;
        decimals = decimals || 18;
        // Defensive: large integers may arrive as Number from JSON; we
        // still divide as floats. Precision is more than enough for the
        // dashboard's display rounding.
        return Number(raw) / Math.pow(10, decimals);
    },

    _attestationFreshness: function(ageSeconds) {
        if (ageSeconds == null) return 'critical';
        if (ageSeconds <= 1800) return 'ok';       // <=30m
        if (ageSeconds <= 14400) return 'warn';     // <=4h
        return 'critical';
    },

    _slippageState: function(pct) {
        if (pct == null) return 'critical';
        if (pct < 0.5) return 'ok';
        if (pct < 2.0) return 'warn';
        return 'critical';
    },

    // Peg / NAV-spread helpers — canonical implementations live in CommonRenderer
    // (shared with the OUSD renderer). These pass-throughs preserve the existing
    // ApyxRenderer._peg* call sites.
    // R4: apyUSD trades a steady ~−40 bp structural cooldown discount per
    // assets/apyusd.md and the alerter's exclude-band policy. Widen the
    // healthy band to ±50 bps (vs ±25 bps for apxUSD's true peg) so the
    // visual matches the alerter — otherwise the operating norm renders
    // as amber Watch every snapshot.
    _pegStatusClass: function(pctValue, slug) {
        if (slug === 'apyusd') {
            if (pctValue == null) return 'unknown';
            var abs = Math.abs(pctValue);
            if (abs < 0.50) return 'ok';
            if (abs < 1.00) return 'warn';
            return 'critical';
        }
        return CommonRenderer.pegStatusClass(pctValue);
    },
    _pegStatusLabel: function(state) { return CommonRenderer.pegStatusLabel(state); },
    _pegPctText: function(pct, decimals) { return CommonRenderer.pegPctText(pct, decimals); },
    _pegPctClass: function(state) { return CommonRenderer.pegPctClass(state); },

    // ============================================================
    // pre-render — runs before common renderer paints summary cards.
    // ============================================================
    // The apxUSD/apyUSD summary blocks don't carry collateral_ratio_alt or
    // backing_breakdown (the analyzer leaves them out — neither concept
    // maps cleanly onto a vault-share + reserve-attestation product). We
    // synthesize minimal values here so common.js doesn't crash, then the
    // per-asset panels below carry the rich view.
    preRender: function(data) {
        var specific = data.asset_specific || {};
        if (!ApyxRenderer._isApyx(specific.type)) return;
        var s = data.summary;
        if (!s) return;

        // Synthesize collateral_ratio_alt — common renderSummaryCards reads
        // .label unconditionally, so the field must exist. We immediately
        // hide the card via card_overrides; the rich version lives in §1
        // Headline below (capture ratio / buffer over par).
        var altLabel = (specific.type === 'apxusd') ? '_apyxAltBuffer' : '_apyxAltCapture';
        if (!s.collateral_ratio_alt) {
            s.collateral_ratio_alt = { label: altLabel, value: 0, is_currency: false };
        }
        specific.card_overrides = specific.card_overrides || {};
        specific.card_overrides[altLabel] = { hidden: true };

        // Surplus / Deficit is structurally 0 for apyUSD (ERC-4626 wrapper)
        // and already prominent in the §1 Headline card for apxUSD — hide
        // the duplicated common card on both pages.
        specific.card_overrides['Surplus / Deficit'] = { hidden: true };

        // Add a NAV card for apyUSD so the common top-strip immediately
        // surfaces share-price (1 share = N apxUSD).
        if (specific.type === 'apyusd') {
            specific.extra_summary_cards = specific.extra_summary_cards || [];
            var vs = specific.vault_state || {};
            var nav = (vs.nav != null) ? vs.nav : s.nav;
            specific.extra_summary_cards.push({
                label: 'NAV per share',
                value: (nav != null) ? nav.toFixed(4) : '-',
                subtext: 'apxUSD per share'
            });
        }

        // Empty backing_breakdown — common.renderBreakdownTable iterates
        // this array and would NPE without it. The actual reserve breakdown
        // lives in §2 Backing Attestation as a custom donut + table.
        if (!Array.isArray(data.backing_breakdown)) {
            data.backing_breakdown = [];
        }

        // Mirror syrupusdc: collateral_ratio is already on summary and
        // common will color it green/red against 100 — fine as-is.

        // R1: tighten CR chart for the actual asset shape. common.js defaults
        // to Y=[80,150]% with a 130% "healthy" line — calibrated for
        // over-collateralized lending. For Apyx, the meaningful range is
        // much tighter, par (100%) is the floor not a critical threshold,
        // and the 130% line is irrelevant. app.js reads these fields off
        // asset_specific when present.
        if (specific.type === 'apxusd') {
            specific.chart_y_min = 99;
            specific.chart_y_max = 103;
            specific.chart_bands = {
                critical: [0, 99.5],
                thin: [99.5, 100],
                amber: [100, 100.5],
                healthy: [100.5, 200],
                min_line: 100,
                max_line: null
            };
        } else if (specific.type === 'apyusd') {
            specific.chart_y_min = 99;
            specific.chart_y_max = 101;
            specific.chart_bands = {
                critical: [0, 99],
                thin: [99, 99.9],
                amber: [99.9, 100.1],
                healthy: [100.1, 200],
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
        if (!ApyxRenderer._isApyx(specific.type)) return;

        ApyxRenderer._suppressCommonPanels(data);

        var slug = data.asset_slug;
        var s = data.summary;
        var html = '';

        // Top-of-page trust banner — mirrors the framing on the tidresearch
        // report so a reader who jumps between dashboard and report sees the
        // same language. Apyx-only; idempotent.
        ApyxRenderer._renderTrustDisclaimer(slug);

        // R1: apyUSD CR is ~100% by ERC-4626 construction — annotate the
        // chart so visible rounding-level drift isn't misread as volatility.
        if (slug === 'apyusd') {
            var chartPanel = document.getElementById('chart-panel');
            if (chartPanel && !chartPanel.querySelector('.cr-note-apyusd')) {
                var note = document.createElement('p');
                note.className = 'cr-note-apyusd text-xs text-slate-500 mt-2 italic';
                note.textContent = 'CR is ~100% by ERC-4626 construction; visible drift is rounding-level. ' +
                                   'See Liquidity panel below for the price-vs-NAV chart that actually matters.';
                chartPanel.appendChild(note);
            }
        }

        var anc = ApyxRenderer._anchor;
        html += anc('panel-headline',    ApyxRenderer._renderHeadlineCard(specific, s, slug));
        // R9: Family panel promoted to row 2 — cross-asset framing sets context
        // before the asset-specific panels. _loadFamilyPanel(slug) populates
        // this placeholder via async fetch later in this same render() call.
        html += '<div id="apyx-family-panel"></div>';
        html += anc('panel-attestation', ApyxRenderer._renderBackingAttestation(specific, slug));
        html += anc('panel-stress',      ApyxRenderer._renderStressLens(specific, slug));
        html += anc('panel-watch',       ApyxRenderer._renderExternalWatch(specific, slug));
        if (slug === 'apyusd') {
            html += anc('panel-yield',   ApyxRenderer._renderYieldTrajectory(specific, s));
            html += anc('panel-unlock',  ApyxRenderer._renderUnlockQueue(specific));
        }
        html += anc('panel-liquidity',   ApyxRenderer._renderLiquidity(specific, s, slug));
        html += anc('panel-bridge',      ApyxRenderer._renderMultiChainBridge(specific, slug));
        html += anc('panel-trust',       ApyxRenderer._renderTrustStack(specific));

        container.innerHTML = html;

        // R13/R14: populate sticky nav + companion-asset header link.
        ApyxRenderer._setupAnchorNav(slug);
        ApyxRenderer._setupCompanionLink(slug);

        // Post-render chart renders — DOM nodes must exist first.
        ApyxRenderer._renderReservesDonut(specific, slug);
        ApyxRenderer._renderAttestationTimeline(specific, slug);
        ApyxRenderer._renderSlippageChart(specific, slug);
        if (slug === 'apxusd') {
            ApyxRenderer._loadPegHistoryChart(slug);
        }
        if (slug === 'apyusd') {
            ApyxRenderer._loadMarketPriceTrajectory(slug);
            ApyxRenderer._loadMarketDiscountChart(slug);
        }
        ApyxRenderer._loadStressLensStrcAnchor();
        ApyxRenderer._loadFamilyPanel(slug);
        ApyxRenderer._loadWolfSection();
    },

    _suppressCommonPanels: function(data) {
        // R2: drop the top summary-card strip. The §1 Headline card below
        // already carries Supply / Backing / Collateralization / Status with
        // richer context (chain pills, asset tagline, status pill, NAV for
        // apyUSD). The top strip is pure duplication.
        var summaryCards = document.getElementById('summary-cards');
        if (summaryCards) summaryCards.style.display = 'none';

        // §2 Backing Attestation supplies a custom reserves donut + table —
        // hide the default breakdown panel and the default pie panel.
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

        // R3: hide Risk Flags panel when only the "No risk flags" placeholder
        // would render. Structural caveats are surfaced in Trust Stack +
        // Backing Attestation; a green "No risk flags" pill here misleads.
        // When real exception flags fire, keep the panel and stretch it.
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

    // R13: build and reveal the sticky anchor nav. Per-slug item lists —
    // apxUSD has Peg Performance where apyUSD has Secondary Market + Yield
    // + Unlock. #chart-panel is the common CR-history panel rendered by
    // common.js and is linked by its hard-coded id.
    _setupAnchorNav: function(slug) {
        var navEl = document.getElementById('asset-anchor-nav');
        var inner = document.getElementById('asset-anchor-nav-inner');
        if (!navEl || !inner) return;

        var items;
        if (slug === 'apxusd') {
            items = [
                { id: 'chart-panel',       label: 'CR' },
                { id: 'panel-headline',    label: 'Asset' },
                { id: 'apyx-family-panel', label: 'Family' },
                { id: 'panel-attestation', label: 'Backing' },
                { id: 'panel-stress',      label: 'Stress' },
                { id: 'panel-watch',       label: 'Watch' },
                { id: 'panel-liquidity',   label: 'Liquidity' },
                { id: 'panel-bridge',      label: 'Bridge' },
                { id: 'panel-trust',       label: 'Trust' }
            ];
        } else if (slug === 'apyusd') {
            items = [
                { id: 'chart-panel',       label: 'CR' },
                { id: 'panel-headline',    label: 'Asset' },
                { id: 'apyx-family-panel', label: 'Family' },
                { id: 'panel-attestation', label: 'Backing' },
                { id: 'panel-stress',      label: 'Stress' },
                { id: 'panel-watch',       label: 'Watch' },
                { id: 'panel-yield',       label: 'Yield' },
                { id: 'panel-unlock',      label: 'Unlock' },
                { id: 'panel-liquidity',   label: 'Liquidity' },
                { id: 'panel-bridge',      label: 'Bridge' },
                { id: 'panel-trust',       label: 'Trust' }
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

    // R14: point the header "View companion" link at the sibling asset.
    // Same-tab navigation (no target="_blank") — both pages are this
    // dashboard, not external.
    _setupCompanionLink: function(slug) {
        var link = document.getElementById('header-companion-link');
        if (!link) return;
        var sibling, label;
        if (slug === 'apxusd') {
            sibling = 'apyusd';
            label = 'View apyUSD ↗';
        } else if (slug === 'apyusd') {
            sibling = 'apxusd';
            label = 'View apxUSD ↗';
        } else {
            return;
        }
        link.setAttribute('href', '?asset=' + sibling);
        link.textContent = label;
        link.classList.remove('hidden');
    },

    // ============================================================
    // §1 Headline card
    // ============================================================
    _renderHeadlineCard: function(specific, s, slug) {
        var vs = specific.vault_state || {};
        var pausedState = vs.paused ? 'critical' : 'ok';
        var pausedLabel = vs.paused ? 'PAUSED' : 'Active';
        var chainBadges = ApyxRenderer._chainBadge('ethereum') + ' ' + ApyxRenderer._chainBadge('base');
        var teePill = ApyxRenderer._provenancePill('tee');

        var headerLeft, metricsRow, captureRow = '';

        if (slug === 'apxusd') {
            headerLeft = '<div class="text-xl font-bold text-slate-800">apxUSD</div>' +
                '<div class="text-xs text-slate-500 mt-1">Apyx · RWA-backed synthetic stablecoin (non-yield)</div>';
            var crCls = (s.collateral_ratio >= 100) ? 'text-green-600' : 'text-red-600';
            metricsRow =
                '<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">' +
                    '<div><div class="text-xs text-slate-400 font-medium uppercase">Supply</div>' +
                        '<div class="text-lg font-bold text-slate-800">' + CommonRenderer.formatCurrency(s.total_supply) + '</div></div>' +
                    '<div><div class="text-xs text-slate-400 font-medium uppercase">Backing</div>' +
                        '<div class="text-lg font-bold text-slate-800">' + CommonRenderer.formatCurrency(s.total_backing) + '</div></div>' +
                    '<div><div class="text-xs text-slate-400 font-medium uppercase">Collateralization</div>' +
                        '<div class="text-lg font-bold ' + crCls + '">' + CommonRenderer.formatPercent(s.collateral_ratio, 2) + '</div>' +
                        '<div class="mt-1">' + teePill + '</div>' +
                        // R6: surface the absolute buffer alongside CR — assets/apxusd.md
                        // §Key Risk Notes flags "thin absolute buffer" as a binding
                        // constraint; the percentage form hides how thin the cushion is.
                        (function() {
                            var buf = s.surplus_deficit;
                            if (buf == null) return '';
                            var sign = buf >= 0 ? '+' : '−';
                            var bufCls = buf >= 0 ? 'text-green-600' : 'text-red-600';
                            var bufMag = '$' + (Math.abs(buf) / 1e6).toFixed(2) + 'M';
                            return '<div class="text-xs text-slate-500 mt-0.5">' +
                                'Buffer: <span class="font-mono ' + bufCls + '">' + sign + bufMag + '</span>' +
                            '</div>';
                        })() +
                    '</div>' +
                    '<div><div class="text-xs text-slate-400 font-medium uppercase">Status</div>' +
                        '<div class="text-lg">' + ApyxRenderer._statusPill(pausedLabel, pausedState) + '</div></div>' +
                '</div>';
        } else {
            // apyUSD
            headerLeft = '<div class="text-xl font-bold text-slate-800">apyUSD</div>' +
                '<div class="text-xs text-slate-500 mt-1">Apyx · ERC-4626 yield wrapper over apxUSD</div>';
            var nav = vs.nav;
            var tvl = s.total_supply_usd_at_nav || s.total_backing;
            metricsRow =
                '<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">' +
                    '<div><div class="text-xs text-slate-400 font-medium uppercase">Shares</div>' +
                        '<div class="text-lg font-bold text-slate-800">' + ApyxRenderer._formatShares(s.total_supply) + '</div></div>' +
                    '<div><div class="text-xs text-slate-400 font-medium uppercase">NAV</div>' +
                        '<div class="text-lg font-bold text-slate-800">' + (nav != null ? nav.toFixed(4) : '-') +
                        '<span class="text-xs text-slate-400 font-normal ml-1">apxUSD</span></div></div>' +
                    '<div><div class="text-xs text-slate-400 font-medium uppercase">TVL</div>' +
                        '<div class="text-lg font-bold text-slate-800">' + CommonRenderer.formatCurrency(tvl) + '</div></div>' +
                    '<div><div class="text-xs text-slate-400 font-medium uppercase">Status</div>' +
                        '<div class="text-lg">' + ApyxRenderer._statusPill(pausedLabel, pausedState) + '</div></div>' +
                '</div>';
            var cap = specific.capture_ratio_pct;
            if (cap != null) {
                captureRow =
                    '<div class="mt-3">' +
                        '<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">' +
                            'Captures <span class="font-mono mx-1">' + cap.toFixed(1) + '%</span> of apxUSD supply' +
                        '</span>' +
                    '</div>';
            }
        }

        return '<div class="panel">' +
            '<div class="flex items-start justify-between gap-4">' +
                '<div>' + headerLeft + '</div>' +
                '<div class="flex flex-wrap gap-1 justify-end">' + chainBadges + '</div>' +
            '</div>' +
            metricsRow +
            captureRow +
        '</div>';
    },

    // ============================================================
    // §2 Backing Attestation (the marquee panel)
    // ============================================================
    _renderBackingAttestation: function(specific, slug) {
        var ba = specific.backing_attestation;
        if (!ba) {
            return '<div class="panel"><div class="panel-title">Backing Attestation</div>' +
                '<div class="risk-flag risk-warning">Accountable feed data not available in this snapshot.</div></div>';
        }

        var feedState  = ba.fetch_status === 'ok' ? 'ok' : 'critical';
        var keyState   = ba.signing_key_match ? 'ok' : 'critical';
        var freshState = ApyxRenderer._attestationFreshness(ba.attestation_age_seconds);
        var crossState = ba.cross_source_supply_consistency ? 'ok' : 'warn';
        var collat = ba.collateralization_pct;
        var collatCls = (collat != null && collat >= 100) ? 'text-green-600' : 'text-red-600';
        var teePill = ApyxRenderer._provenancePill('tee');
        var cpaPill = ApyxRenderer._provenancePill('cpa');
        var onchainPill = ApyxRenderer._provenancePill('onchain');

        var truncKey = ba.signing_key ? (ba.signing_key.slice(0, 10) + '...' + ba.signing_key.slice(-4)) : '—';

        var statusRow =
            '<div class="flex flex-wrap items-center gap-2 mb-4">' +
                ApyxRenderer._statusPill('Accountable feed', feedState, ba.source || '') +
                ApyxRenderer._statusPill('Signing key', keyState, truncKey) +
                '<span title="Accountable enclave signing timestamp for this proof-of-solvency snapshot; underlying custodian and pricing observations may have their own observation times.">' +
                    ApyxRenderer._statusPill('Last attested', freshState, ApyxRenderer._formatAge(ba.attestation_age_seconds)) +
                '</span>' +
                '<span class="ml-auto text-xs text-slate-500">' +
                    'Collateralization: <span class="font-mono text-base font-bold ' + collatCls + '">' +
                        CommonRenderer.formatPercent(collat, 2) +
                    '</span> ' + teePill +
                '</span>' +
            '</div>';

        // Reserves table — uses the canonical order in APYX_RESERVES_COLORS
        // so even an unexpected analyzer ordering renders predictably.
        var splitUsd = ba.reserves_split || {};
        var splitPct = ba.reserves_split_pct || {};
        var totalReserves = ba.total_reserves_usd || 0;
        var reserveOrder = ['Cash & Equivalents', 'STRC', 'SATA', 'Other'];
        // Preserve any unknown keys at the end so the renderer doesn't silently drop them.
        Object.keys(splitUsd).forEach(function(k) {
            if (reserveOrder.indexOf(k) < 0) reserveOrder.push(k);
        });
        var resRows = reserveOrder.filter(function(k) { return splitUsd[k] != null; }).map(function(k) {
            var usd = splitUsd[k] || 0;
            var pct = (splitPct[k] != null) ? (splitPct[k] * 100) : (totalReserves > 0 ? (usd / totalReserves * 100) : 0);
            var color = APYX_RESERVES_COLORS[k] || '#94a3b8';
            var issuer = APYX_RESERVES_ISSUER[k] || '—';
            // R5: promote "(unitemized)" from faint gray to an amber
            // disclosure-gap badge. Public Accountable attestation doesn't
            // break Cash & Equivalents into deposits / T-bills / USDC, so
            // the cash-side risk profile is unobservable. Pattern-matches
            // on the magic string so any future unitemized component
            // (APYX_RESERVES_ISSUER) inherits the badge.
            var issuerCell = (issuer === '(unitemized)')
                ? '<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200" ' +
                  'title="Cash composition is not itemized in the public Accountable attestation — could be bank deposits, T-bills, USDC, or another instrument. ' +
                  'Disclosure gap flagged in assets/apxusd.md §Key Risk Notes.">⚠ unitemized</span>'
                : '<span class="text-xs text-slate-500">' + issuer + '</span>';
            // STRC bucket bundles brokerage STRC + on-chain STRCx — Accountable's
            // reserves_split rolls them into one figure. Surface the disclosure
            // inline so a reader doesn't miss the brokerage-vs-on-chain split.
            // The STRCx Safe is identified on-chain (0x37b0779a…) — see Wolf
            // section below for the split's last attested breakdown.
            var nameCell = '<td class="font-medium">' +
                '<span class="inline-block w-2.5 h-2.5 rounded-sm mr-2 align-middle" style="background:' + color + '"></span>' +
                k +
                (k === 'STRC' ?
                    ' <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200 ml-1 cursor-help" ' +
                    'title="Bundles brokerage-custodied STRC (at Alpaca) and on-chain STRCx (in a 3-of-6 Gnosis Safe at 0x37b0779a…323a555 — same six owners as Apyx\'s MAINTAINER + ADMIN Safes, verified on-chain). Accountable publishes this as one mark-to-market STRC-family bucket; the public feed does not disclose the per-instrument pricing rule. Wolf & Company discloses the brokerage-vs-on-chain split monthly (latest: 4/30/2026 — $76.8M STRC + $51.5M STRCx). The STRCx slice is directly observable via balanceOf() on the Safe — see the On-Chain Verified tile below.">ⓘ incl. STRCx</span>' :
                    '') +
            '</td>';
            return '<tr>' +
                nameCell +
                '<td class="text-right font-mono">' + CommonRenderer.formatCurrencyExact(usd) + '</td>' +
                '<td class="text-right font-mono">' + pct.toFixed(2) + '%</td>' +
                '<td>' + issuerCell + '<div class="mt-1">' + teePill + '</div></td>' +
            '</tr>';
        }).join('');
        resRows += '<tr class="font-bold border-t-2 border-slate-200">' +
            '<td>Total reserves</td>' +
            '<td class="text-right font-mono">' + CommonRenderer.formatCurrencyExact(totalReserves) + '</td>' +
            '<td class="text-right">100.00%</td>' +
            '<td></td>' +
        '</tr>';

        // Donut + table side-by-side on desktop, stacked on mobile.
        var donutBlock =
            '<div class="grid grid-cols-1 lg:grid-cols-5 gap-6">' +
                '<div class="lg:col-span-3">' +
                    '<div class="text-sm font-semibold text-slate-700 mb-2">Reserves split</div>' +
                    '<div class="data-table-scroll">' +
                        '<table class="data-table">' +
                            '<thead><tr>' +
                                '<th>Asset</th>' +
                                '<th class="text-right">USD</th>' +
                                '<th class="text-right">%</th>' +
                                '<th>Issuer</th>' +
                            '</tr></thead>' +
                            '<tbody>' + resRows + '</tbody>' +
                        '</table>' +
                    '</div>' +
                '</div>' +
                '<div class="lg:col-span-2">' +
                    '<div class="text-sm font-semibold text-slate-700 mb-2">Composition</div>' +
                    '<div style="height: 240px; position: relative;">' +
                        '<canvas id="apyx-reserves-donut"></canvas>' +
                    '</div>' +
                '</div>' +
            '</div>';

        // Timeline chart — 21-day Accountable supply vs reserves.
        var timelineBlock =
            '<div class="mt-6">' +
                '<div class="flex items-center justify-between mb-2">' +
                    '<div class="text-sm font-semibold text-slate-700">21-day supply vs reserves (Accountable)</div>' +
                    ApyxRenderer._statusPill('Cross-source supply check', crossState,
                        (ba.cross_source_drift_pct != null) ? (ba.cross_source_drift_pct.toFixed(3) + '% drift') : '') +
                '</div>' +
                '<div style="height: 260px; position: relative;">' +
                    '<canvas id="apyx-attestation-timeline"></canvas>' +
                '</div>' +
            '</div>';

        var attTs = CommonRenderer.formatDate(ba.attestation_timestamp);
        var methodology =
            '<div class="text-xs text-slate-500 italic leading-relaxed mt-4 pt-3 border-t border-slate-200">' +
                '<div class="not-italic flex flex-wrap gap-2 mb-2">' + teePill + cpaPill + onchainPill + '</div>' +
                '<strong>TEE-attested (MTM):</strong> Accountable proof-of-solvency feed (' + ACCOUNTABLE_INFO.type + ', on-chain-registered signing key). ' +
                'Values are mark-to-market per Accountable NAV docs; the public feed does not disclose the per-instrument pricing rule. ' +
                'The enclave signature proves the feed processed and signed the data shown; it is not a CPA-firm audit. ' +
                'Last attested ' + attTs + ' · enclave key <span class="font-mono">' + truncKey + '</span>.' +
                '<br><br>' +
                '<strong>CPA-attested:</strong> Wolf & Company monthly AICPA examinations, with reports and scope detail in the Wolf section above.' +
                '<br>' +
                '<strong>On-chain:</strong> STRCx Safe balance, bridge supply, pause state, and governance topology are read directly by this analyzer where contract state exposes them.' +
            '</div>';

        // Layer B (Wolf) — extends this panel as a sibling section. Static
        // JSON (data/apyx_wolf_attestations.json) is manually maintained;
        // panel-attestation id intentionally unchanged so existing anchor
        // links (#panel-attestation) keep working.
        var wolfPlaceholder = '<div id="apyx-wolf-section" class="mt-6"></div>';

        return '<div class="panel">' +
            '<div class="panel-title">Backing Attestations <span class="text-xs font-normal text-slate-500">— Accountable feed + Wolf & Company CPA examinations</span></div>' +
            statusRow +
            donutBlock +
            timelineBlock +
            wolfPlaceholder +
            ApyxRenderer._renderOnChainVerifiedSection(specific) +
            methodology +
        '</div>';
    },

    // On-Chain Verified sub-section — promotes the STRCx Safe verifiability
    // story from a tooltip in the STRC bucket to a first-class artifact:
    // STRCx is the only Apyx reserve component directly readable on-chain
    // via a single balanceOf() call. Sub-section pattern mirrors the
    // Liquidity-panel consolidation (H3 + divider). Renders empty when the
    // upstream onchain_verified_usd field is missing — analyzer fields ship
    // via PegTracker apyx-strcx-verification-fields-pegtracker handoff.
    _renderOnChainVerifiedSection: function(specific) {
        var ba = (specific && specific.backing_attestation) || {};
        var safe = ba.strcx_safe || {};
        var verifiedUsd = safe.onchain_verified_usd;
        if (verifiedUsd == null) return '';
        var onchainPill = ApyxRenderer._provenancePill('onchain');

        var balanceTokens = safe.balance_strcx;
        var coverageTotal = safe.coverage_pct_of_total_reserves;
        var coverageStrc = safe.coverage_pct_of_strc_bucket;
        var delta = safe.delta_vs_last_wolf_attestation_pct;
        var priceSource = safe.implied_price_source;
        var addr = safe.address;
        var etherscanUrl = safe.etherscan_url ||
            (addr ? 'https://etherscan.io/address/' + addr : null);

        var balanceTxt = (balanceTokens != null) ?
            balanceTokens.toLocaleString('en-US', { maximumFractionDigits: 0 }) :
            '—';
        var usdTxt = CommonRenderer.formatCurrency(verifiedUsd);
        var parAnnotation = (priceSource === 'par_fallback') ?
            ' <span class="text-xs text-slate-400 italic font-normal">(par-priced)</span>' : '';

        var deltaTxt = '';
        if (delta != null) {
            var deltaArrow = delta >= 0 ? '↑' : '↓';
            var deltaCls = delta >= 0 ? 'text-emerald-700' : 'text-red-600';
            var deltaSign = (delta > 0) ? '+' : (delta < 0 ? '−' : '');
            deltaTxt = '<div class="text-xs ' + deltaCls + ' mt-1">' +
                deltaArrow + ' ' + deltaSign + Math.abs(delta).toFixed(1) + '% vs last Wolf attestation' +
            '</div>';
        }

        var coverageTotalTxt = (coverageTotal != null) ? coverageTotal.toFixed(2) + '%' : '—';
        var coverageStrcRow = (coverageStrc != null) ?
            '<div class="text-xs text-slate-400 mt-1">' + coverageStrc.toFixed(2) + '% of STRC family</div>' : '';

        var balanceTile =
            '<div class="summary-card">' +
                '<div class="card-label">STRCx Safe balance</div>' +
                '<div class="card-value text-base">' + balanceTxt + ' <span class="text-xs text-slate-400 font-normal">STRCx</span></div>' +
                '<div class="text-xs text-slate-400 mt-1">at the Apyx 3-of-6 Safe</div>' +
            '</div>';

        var usdTile =
            '<div class="summary-card">' +
                '<div class="card-label">Implied USD value</div>' +
                '<div class="card-value">' + usdTxt + parAnnotation + '</div>' +
                deltaTxt +
            '</div>';

        var coverageTile =
            '<div class="summary-card">' +
                '<div class="card-label">Coverage of total reserves</div>' +
                '<div class="card-value">' + coverageTotalTxt + '</div>' +
                coverageStrcRow +
            '</div>';

        var tilesRow =
            '<div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">' +
                balanceTile + usdTile + coverageTile +
            '</div>';

        var badgeHtml = ApyxRenderer._strcxReconciliationBadge(delta);
        var addrShort = addr ? (addr.slice(0, 10) + '…' + addr.slice(-7)) : '—';
        var addrLink = etherscanUrl ?
            '<a href="' + etherscanUrl + '" target="_blank" rel="noopener noreferrer" ' +
                'class="text-blue-500 hover:underline">view on Etherscan ↗</a>' : '';
        var addressRow =
            '<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-4 text-xs">' +
                '<div class="text-slate-600">' +
                    'Address: <span class="font-mono text-slate-700" title="' + (addr || '') + '">' + addrShort + '</span> ' +
                    '<span class="text-slate-400">(3-of-6 Safe)</span>' +
                    (addrLink ? ' · ' + addrLink : '') +
                '</div>' +
                (badgeHtml ? '<div>' + badgeHtml + '</div>' : '') +
            '</div>';

        // Methodology footnote — surfaces "STRCx = only TEE + CPA + on-chain
        // triple-verified component." Uses "approximately" rather than tilde
        // per feedback_markdown_tilde_gfm gotcha (same applies if this string
        // ever flows through a markdown layer).
        var coveragePctTxt = (coverageTotal != null) ?
            'approximately ' + coverageTotal.toFixed(0) + '%' : 'approximately 16%';
        var remainingPctTxt = (coverageTotal != null) ?
            'approximately ' + (100 - coverageTotal).toFixed(0) + '%' : 'approximately 84%';
        var methodology =
            '<div class="text-xs text-slate-500 italic leading-relaxed mt-4">' +
                'Of Apyx\'s total reserves, ' + coveragePctTxt + ' is directly readable on-chain via a single ' +
                '<span class="font-mono not-italic">balanceOf</span> call on the STRCx contract at the Apyx Safe. The remaining ' +
                remainingPctTxt + ' (brokerage STRC, cash &amp; equivalents, SATA) is verifiable only through the Accountable ' +
                'TEE-attested proof-of-solvency feed and monthly Wolf &amp; Company CPA examinations. STRCx is Wolf-anchored ' +
                'for USD pricing — refreshed when each monthly Wolf attestation publishes. This makes STRCx the only Apyx ' +
                'reserve component combining TEE attestation + CPA examination + direct on-chain readability.' +
            '</div>';

        var divider = '<div class="border-t border-slate-200 pt-6 mt-6"></div>';
        return divider +
            '<div class="flex flex-wrap items-center gap-2 mt-0 mb-3">' +
                '<h3 class="text-sm font-semibold text-slate-900">On-Chain Verified</h3>' +
                onchainPill +
            '</div>' +
            tilesRow +
            addressRow +
            methodology;
    },

    // Reconciliation badge for the STRCx Safe vs last Wolf attestation.
    // Asymmetric on direction: positive delta is accumulation between
    // monthly Wolf snapshots and is benign by default — emerald through
    // +20%, amber through +100% (notable but expected), red only beyond
    // +100% (verify). Negative delta is outflow from the Safe — any
    // shrinkage greater than 2% in magnitude is significant enough to
    // warrant red regardless of size, since unexplained Safe outflow is
    // the signal that genuinely matters here.
    _strcxReconciliationBadge: function(delta) {
        if (delta == null) return '';
        var label, bg, fg, icon;
        if (delta < -2) {
            label = 'Outflow detected — investigate';
            bg = 'bg-red-50';     fg = 'text-red-800';     icon = '⚠';
        } else if (delta <= 20) {
            label = 'Reconciles to Wolf attestation';
            bg = 'bg-emerald-50'; fg = 'text-emerald-800'; icon = '✓';
        } else if (delta <= 100) {
            label = 'Tracking (notable accumulation since attestation)';
            bg = 'bg-amber-50';   fg = 'text-amber-800';   icon = '△';
        } else {
            label = 'Extreme growth — verify';
            bg = 'bg-red-50';     fg = 'text-red-800';     icon = '⚠';
        }
        return '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ' + bg + ' ' + fg + '">' +
            '<span>' + icon + '</span><span>' + label + '</span>' +
        '</span>';
    },

    // ============================================================
    // §2a' Wolf & Company section (Layer B, point-in-time)
    //
    // Extends panel-attestation as a sibling block to the Accountable
    // (Layer A) view above. Reads data/apyx_wolf_attestations.json —
    // a manually-maintained static file updated whenever a new monthly
    // attestation lands. Degrades gracefully to a link-only tile if the
    // JSON is missing.
    // ============================================================
    _loadWolfSection: function() {
        var target = document.getElementById('apyx-wolf-section');
        if (!target) return;
        var nocache = Math.floor(Date.now() / 60000);
        fetch('data/apyx_wolf_attestations.json?nocache=' + nocache)
            .then(function(r) { return r.ok ? r.json() : null; })
            .then(function(wolf) {
                target.innerHTML = ApyxRenderer._renderWolfSectionHtml(wolf);
            })
            .catch(function() {
                target.innerHTML = ApyxRenderer._renderWolfSectionHtml(null);
            });
    },

    _renderWolfSectionHtml: function(wolf) {
        // Phase-1 fallback when the static JSON is missing — link tile only.
        if (!wolf) {
            return '<div class="rounded-lg border border-slate-200 dark:border-slate-700 p-4 bg-slate-50/50 dark:bg-slate-800/40">' +
                '<div class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">' +
                    'Third-Party CPA Attestations (Wolf &amp; Company)' +
                '</div>' +
                '<div class="text-xs text-slate-500 dark:text-slate-400 mb-3">' +
                    'AICPA-standards monthly examination engagements · ' +
                    '<a href="https://docs.apyx.fi/collateral-and-custody/third-party-attestation" ' +
                        'target="_blank" rel="noopener noreferrer" ' +
                        'class="text-blue-600 hover:underline">' +
                        'View attestations &rarr; docs.apyx.fi/collateral-and-custody/third-party-attestation' +
                    '</a>' +
                '</div>' +
            '</div>';
        }

        var auditor = wolf.auditor || {};
        var reports = Array.isArray(wolf.reports) ? wolf.reports : [];

        // Auditor identity row.
        var auditorLine =
            '<div class="text-xs text-slate-500 dark:text-slate-400 mb-3">' +
                '<strong class="text-slate-700 dark:text-slate-200">' + (auditor.name || 'Wolf & Company, P.C.') + '</strong>' +
                ' — ' + (auditor.standard || 'AICPA attestation standards') + ' examinations · ' +
                (auditor.city || 'Boston, MA') +
                (auditor.affiliation ? ' · ' + auditor.affiliation + ' member' : '') +
                (wolf.issuer_entity ? ' · Issuer entity: <span class="font-medium">' + wolf.issuer_entity + '</span>' : '') +
            '</div>';

        // Latest-report freshness pill — CRIT if no report in 45+ days.
        var latest = reports[0] || null;
        var freshState = 'unknown';
        var freshLabel = 'No reports';
        if (latest && latest.signed_date) {
            var ageDays = (Date.now() - new Date(latest.signed_date).getTime()) / 86400000;
            if (ageDays <= 35)      { freshState = 'ok';       freshLabel = 'Latest: ' + latest.period; }
            else if (ageDays <= 45) { freshState = 'warn';     freshLabel = 'Latest: ' + latest.period + ' (' + Math.round(ageDays) + 'd ago)'; }
            else                    { freshState = 'critical'; freshLabel = 'Stale — ' + Math.round(ageDays) + 'd since ' + latest.period; }
        }

        // Reports table.
        function totalForReport(r) {
            if (!r || !r.balances) return null;
            var dates = Object.keys(r.balances).sort();
            if (dates.length === 0) return null;
            var last = r.balances[dates[dates.length - 1]];
            return last && last.total_securities != null ? last.total_securities :
                   last && last.total != null            ? last.total :
                   null;
        }
        function snapshotDate(r) {
            if (!r || !r.balances) return '—';
            var dates = Object.keys(r.balances).sort();
            return dates.length ? dates[dates.length - 1] : '—';
        }
        function scopePill(scope) {
            if (scope === 'full_balance') {
                return '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">full-scope</span>';
            }
            if (scope === 'securities_only') {
                return '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">securities-only</span>';
            }
            return '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">' + (scope || '—') + '</span>';
        }

        var rowsHtml = reports.map(function(r) {
            var total = totalForReport(r);
            var snap = snapshotDate(r);
            var pdfCell = r.pdf_url ?
                '<a href="' + r.pdf_url + '" target="_blank" rel="noopener noreferrer" ' +
                    'class="text-blue-600 hover:underline text-xs">PDF &uarr;</a>' :
                '<span class="text-slate-400">—</span>';
            return '<tr>' +
                '<td class="font-medium">' + (r.period || '—') + '</td>' +
                '<td>' + scopePill(r.scope) + '</td>' +
                '<td class="text-right font-mono">' + (total != null ? CommonRenderer.formatCurrencyExact(total) : '—') + '</td>' +
                '<td class="text-xs text-slate-500">' + snap + '</td>' +
                '<td class="text-xs text-slate-500">' + (r.signed_date || '—') + '</td>' +
                '<td>' + pdfCell + '</td>' +
            '</tr>';
        }).join('');

        var tableBlock =
            '<div class="data-table-scroll">' +
                '<table class="data-table">' +
                    '<thead><tr>' +
                        '<th>Period</th>' +
                        '<th>Scope</th>' +
                        '<th class="text-right">Snapshot total</th>' +
                        '<th>Snapshot date</th>' +
                        '<th>Signed</th>' +
                        '<th>PDF</th>' +
                    '</tr></thead>' +
                    '<tbody>' + rowsHtml + '</tbody>' +
                '</table>' +
            '</div>';

        // STRC vs STRCx breakout — only when the latest report is securities-only
        // and carries the split. Surfaces the figures the Accountable feed hides.
        var breakoutBlock = '';
        if (latest && latest.scope === 'securities_only' && latest.balances) {
            var dates = Object.keys(latest.balances).sort();
            var last = latest.balances[dates[dates.length - 1]] || {};
            if (last.STRC != null || last.STRCx != null) {
                breakoutBlock =
                    '<div class="mt-3 text-xs text-slate-600 dark:text-slate-300">' +
                        '<strong>Latest STRC-family breakout (' + dates[dates.length - 1] + '):</strong> ' +
                        'STRC <span class="font-mono">' + CommonRenderer.formatCurrencyExact(last.STRC || 0) + '</span> · ' +
                        'STRCx <span class="font-mono">' + CommonRenderer.formatCurrencyExact(last.STRCx || 0) + '</span>' +
                        (last.SATA != null ? ' · SATA <span class="font-mono">' + CommonRenderer.formatCurrencyExact(last.SATA) + '</span>' : '') +
                        ' <span class="text-slate-400">(Wolf-attested; the public Accountable feed bundles STRC + STRCx into a single STRC figure)</span>' +
                    '</div>';
            }
        }

        // Scope-regression warning — only render when the latest scope is narrower
        // than the prior one. Avoids false positives if scope re-expands.
        var scopeWarning = '';
        if (reports.length >= 2 &&
            latest && latest.scope === 'securities_only' &&
            reports[1] && reports[1].scope === 'full_balance') {
            scopeWarning =
                '<div class="risk-flag risk-warning mt-3">' +
                    '<strong>⚠ Scope regression:</strong> ' +
                    latest.period + ' narrowed to securities only — cash, stablecoin, and dividends-in-motion ' +
                    '(covered in ' + reports[1].period + ') all dropped out. ' +
                    'The largest reserve component (Cash &amp; Equivalents) has no CPA-firm coverage for any date after ' +
                    snapshotDate(reports[1]) + '. ' +
                    'Watch the next report for scope re-inclusion.' +
                '</div>';
        }

        // Header row with auditor identity + freshness pill + landing-page link.
        var landing = wolf.landing_page || 'https://docs.apyx.fi/collateral-and-custody/third-party-attestation';
        var headerRow =
            '<div class="flex flex-wrap items-center justify-between gap-2 mb-2">' +
                '<div class="text-sm font-semibold text-slate-700 dark:text-slate-200">' +
                    'Third-Party CPA Attestations (Wolf &amp; Company)' +
                '</div>' +
                '<div class="flex items-center gap-2">' +
                    ApyxRenderer._statusPill(freshLabel, freshState) +
                    '<a href="' + landing + '" target="_blank" rel="noopener noreferrer" ' +
                        'class="text-xs text-blue-600 hover:underline">' +
                        'All attestations &uarr;' +
                    '</a>' +
                '</div>' +
            '</div>';

        return headerRow +
            auditorLine +
            tableBlock +
            breakoutBlock +
            scopeWarning;
    },

    // ============================================================
    // §2b STRC Concentration Stress Lens
    //
    // Splits the Accountable mark-to-market baseline from relative STRC-bucket
    // downside shocks. The sibling STRC dashboard quote is shown as a price-
    // source/freshness check only; the public Apyx feed does not expose the raw
    // STRC share count needed to reprice the whole bundled STRC + STRCx bucket.
    // ============================================================
    _renderStressLens: function(specific, slug) {
        var ba = specific.backing_attestation || {};
        var split = ba.reserves_split || {};
        var supplyUsd = ba.total_supply_usd;
        var strc = split['STRC'] || 0;
        var nonStrc = (split['Cash & Equivalents'] || 0) +
                      (split['SATA'] || 0) +
                      (split['Other'] || 0);

        if (!supplyUsd || strc === 0) return '';

        var scenarios = [
            { label: 'Accountable mark',        mult: 1.00, kind: 'attested' },
            { label: 'External quote check',    mult: null, kind: 'live' },
            { label: '−5% from current mark',   mult: 0.95, kind: 'hypothetical' },
            { label: '−7% from current mark',   mult: 0.93, kind: 'hypothetical' },
            { label: '−10% from current mark',  mult: 0.90, kind: 'hypothetical' }
        ];

        var fmtUsdM = function(v) {
            var sign = v >= 0 ? '+' : '−';
            return sign + '$' + (Math.abs(v) / 1e6).toFixed(2) + 'M';
        };

        var tierClasses = function(cr) {
            if (cr >= 100) {
                return {
                    crCls: 'text-green-600',
                    badgeCls: 'bg-green-50 border-green-200'
                };
            }
            if (cr >= 90) {
                return {
                    crCls: 'text-amber-600',
                    badgeCls: 'bg-amber-50 border-amber-200'
                };
            }
            return {
                crCls: 'text-red-600',
                badgeCls: 'bg-red-50 border-red-200'
            };
        };
        var mutedClasses = {
            crCls: 'text-slate-600 dark:text-slate-300',
            badgeCls: 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
        };

        var cardsHtml = scenarios.map(function(sc) {
            var isLive = sc.kind === 'live';
            var backing = isLive ? null : nonStrc + strc * sc.mult;
            var cr = isLive ? null : (backing / supplyUsd) * 100;
            var buffer = isLive ? null : backing - supplyUsd;

            var classes = (sc.kind === 'attested' || sc.kind === 'hypothetical')
                ? mutedClasses
                : mutedClasses;
            var labelEmphasis = (sc.kind === 'attested')
                ? 'text-slate-700 font-semibold'
                : 'text-slate-500';
            var label = (sc.kind === 'hypothetical') ? 'If ' + sc.label : sc.label;
            var subLine = '';
            var hereIndicator = '';
            var cardId = '';
            var extraAttrs = '';
            var crHtml = isLive ? '—' : cr.toFixed(2) + '%';
            var bufferHtml = isLive ? '—' : fmtUsdM(buffer);

            if (sc.kind === 'attested') {
                subLine = '<div class="text-[10px] text-slate-400 mt-0.5">TEE MTM feed</div>';
            } else if (sc.kind === 'live') {
                cardId = ' id="apyx-stress-card-live"';
                extraAttrs =
                    ' data-supply-usd="' + supplyUsd + '"' +
                    ' data-strc-usd="' + strc + '"' +
                    ' data-nonstrc-usd="' + nonStrc + '"';
                subLine = '<div class="apyx-stress-card-live-subline text-[10px] text-slate-400 mt-0.5">loading…</div>';
                hereIndicator = '<div class="apyx-stress-card-live-here text-[10px] text-slate-500 font-medium mt-0.5 hidden"></div>';
            }

            return '<div' + cardId + extraAttrs + ' class="rounded-lg border ' + classes.badgeCls + ' p-3">' +
                '<div class="apyx-stress-card-label text-xs uppercase ' + labelEmphasis + '">' + label + '</div>' +
                subLine +
                hereIndicator +
                '<div class="apyx-stress-card-cr text-2xl font-bold ' + classes.crCls + ' mt-1">' + crHtml + '</div>' +
                '<div class="apyx-stress-card-buffer text-xs text-slate-500 mt-0.5 font-mono">' + bufferHtml + '</div>' +
            '</div>';
        }).join('');

        var methodology;
        if (slug === 'apxusd') {
            methodology =
                '<strong>Current mark anchor</strong> — scenarios are hypothetical writedown stress, not observed. ' +
                'STRC is Strategy\'s variable-rate perpetual preferred and the largest single-issuer ' +
                'concentration in Apyx\'s reserves. Accountable publishes the STRC-family bucket as a TEE-attested ' +
                'mark-to-market USD value; the public feed does not disclose the per-instrument pricing rule. ' +
                'The external quote card is a price-source / freshness check against the sibling STRC dashboard, ' +
                'not a valuation override. Downside cards shock the current Accountable STRC-family mark by ' +
                '5% / 7% / 10% to model what happens if STRC tape moves lower from here. At current composition (STRC ≈ 61% of reserves on ' +
                'the $' + (supplyUsd / 1e6).toFixed(1) + 'M supply, with a low single-digit $M absolute buffer), ' +
                'modest relative moves push CR meaningfully under par — this lens is for ' +
                'normal STRC-tape sensitivity, not tail risk. The buffer is the binding constraint: each ' +
                'card shows the resulting USD buffer, which is the figure that ultimately decides whether ' +
                'apxUSD can clear redemptions at $1. MSTR equity price and STRC dividend health ' +
                'are the leading indicators per assets/apxusd.md §Key Risk Notes.';
        } else {
            methodology =
                '<strong>Current mark anchor</strong> — scenarios are hypothetical writedown stress, not observed. ' +
                'apyUSD inherits backing through the apxUSD wrapper, so the same STRC band applies to ' +
                'your shares. Accountable publishes the STRC-family bucket as a TEE-attested mark-to-market USD value; ' +
                'the public feed does not disclose the per-instrument pricing rule. The external quote card is a ' +
                'price-source / freshness check against the sibling STRC dashboard, not a valuation override. ' +
                'Downside cards shock the current Accountable STRC-family mark by 5% / 7% / 10% to model what happens ' +
                'if STRC tape moves lower from here. Cards show ' +
                'resulting apxUSD-side collateralization and USD buffer; in stressed ' +
                'redemption your NAV per share would proportionally reflect the backing shortfall. ' +
                'MSTR equity price and STRC dividend health are the leading indicators per ' +
                'assets/apxusd.md §Key Risk Notes; the 20-day UnlockToken cooldown amplifies this — by ' +
                'the time you can exit, the underlying may have moved further than any card on the grid shows.';
        }

        return '<div class="panel">' +
            '<div class="panel-title">Concentration Stress Lens — STRC writedown scenarios</div>' +
            '<div id="apyx-strc-live-anchor" class="text-xs text-slate-500 leading-relaxed mt-2">' +
                'STRC secondary price loading…' +
            '</div>' +
            '<div class="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">' +
                cardsHtml +
            '</div>' +
            '<div class="text-xs text-slate-500 italic leading-relaxed mt-4 pt-3 border-t border-slate-200">' +
                methodology +
            '</div>' +
        '</div>';
    },

    _loadStressLensStrcAnchor: function() {
        var target = document.getElementById('apyx-strc-live-anchor');
        var liveCard = document.getElementById('apyx-stress-card-live');
        if (!target && !liveCard) return;
        var nocache = Math.floor(Date.now() / 60000);

        var fmtUsdM = function(v) {
            var sign = v >= 0 ? '+' : '−';
            return sign + '$' + (Math.abs(v) / 1e6).toFixed(2) + 'M';
        };
        var tierClasses = function(cr) {
            if (cr >= 100) {
                return {
                    crCls: 'text-green-600',
                    badgeCls: 'bg-green-50 border-green-200'
                };
            }
            if (cr >= 90) {
                return {
                    crCls: 'text-amber-600',
                    badgeCls: 'bg-amber-50 border-amber-200'
                };
            }
            return {
                crCls: 'text-red-600',
                badgeCls: 'bg-red-50 border-red-200'
            };
        };
        var setLiveUnavailable = function() {
            if (!liveCard) return;
            var sub = liveCard.querySelector('.apyx-stress-card-live-subline');
            var crEl = liveCard.querySelector('.apyx-stress-card-cr');
            var bufEl = liveCard.querySelector('.apyx-stress-card-buffer');
            var here = liveCard.querySelector('.apyx-stress-card-live-here');
            if (sub) {
                sub.innerHTML = 'Market mark unavailable — <a href="?asset=strc" class="text-blue-500 hover:underline">STRC dashboard &rarr;</a>';
            }
            if (crEl) crEl.textContent = '—';
            if (bufEl) bufEl.textContent = '—';
            if (here) {
                here.textContent = '';
                here.classList.add('hidden');
            }
        };

        Promise.all([
            fetch('data/strc_backing.json?nocache=' + nocache)
                .then(function(r) { return r.ok ? r.json() : null; })
                .catch(function() { return null; })
        ]).then(function(results) {
            var strcData = results[0];
            var secondary = strcData && strcData.tradfi && strcData.tradfi.strc_secondary;
            var price = secondary ? Number(secondary.price_usd) : NaN;
            if (!secondary || secondary.price_usd == null || !isFinite(price)) {
                if (target) {
                    target.innerHTML =
                        'STRC secondary price unavailable; scenario cards remain hypothetical writedown marks. ' +
                        '<a href="?asset=strc" class="text-blue-500 hover:underline">STRC dashboard &rarr;</a>';
                }
                setLiveUnavailable();
                return;
            }

            var bps = secondary.discount_to_par_bps;
            var bpsTxt = '';
            if (bps != null) {
                bpsTxt = ' (' + (bps > 0 ? '+' : '') + bps + ' bps to par)';
            }
            if (target) {
                var isRegularSession = secondary.market_session === 'regular';
                var quoteLabel = secondary.quote_label || (isRegularSession ? 'Live market quote' : 'Latest market quote');
                var quoteDetail = secondary.quote_detail ? ' · ' + secondary.quote_detail : '';
                target.innerHTML =
                    quoteLabel + ': STRC <span class="font-mono font-semibold text-slate-700 dark:text-slate-200">$' +
                    price.toFixed(2) + '</span>' + bpsTxt +
                    quoteDetail +
                    ' · <a href="?asset=strc" class="text-blue-500 hover:underline">STRC dashboard &rarr;</a>';
            }

            if (liveCard) {
                var supplyUsd = Number(liveCard.getAttribute('data-supply-usd'));
                var strcUsd = Number(liveCard.getAttribute('data-strc-usd'));
                var nonStrcUsd = Number(liveCard.getAttribute('data-nonstrc-usd'));
                if (!isFinite(supplyUsd) || !isFinite(strcUsd) || !isFinite(nonStrcUsd)) {
                    setLiveUnavailable();
                    return;
                }

                var liveBacking = nonStrcUsd + strcUsd;
                var liveCr = (liveBacking / supplyUsd) * 100;
                var liveBuffer = liveBacking - supplyUsd;
                var cls = tierClasses(liveCr);
                liveCard.className = 'rounded-lg border bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 p-3';
                var crEl = liveCard.querySelector('.apyx-stress-card-cr');
                var bufEl = liveCard.querySelector('.apyx-stress-card-buffer');
                var sub = liveCard.querySelector('.apyx-stress-card-live-subline');
                var here = liveCard.querySelector('.apyx-stress-card-live-here');
                var labelEl = liveCard.querySelector('.apyx-stress-card-label');
                var isLiveSession = secondary.market_session === 'regular';
                if (labelEl) labelEl.textContent = 'External quote check';
                if (crEl) {
                    crEl.className = 'apyx-stress-card-cr text-2xl font-bold ' + cls.crCls + ' mt-1';
                    crEl.textContent = liveCr.toFixed(2) + '%';
                }
                if (bufEl) bufEl.textContent = fmtUsdM(liveBuffer);
                if (sub) sub.textContent = '$' + price.toFixed(2) + ' · ' + (isLiveSession ? 'live STRC quote' : 'latest STRC quote');
                if (here) {
                    here.textContent = 'Accountable bucket already MTM; raw units not public';
                    here.classList.remove('hidden');
                }
            }
        });
    },

    // ============================================================
    // §2c External Watch — STRC leading indicators
    //
    // Pairs with the Stress Lens above. Stress Lens shows hypothetical
    // writedowns; this panel surfaces the observed inputs a reader should
    // check to anticipate which scenario is moving toward realized. Per
    // assets/apxusd.md §Key Risk Notes: MSTR equity price, STRC's
    // monthly-reset dividend rate, Strategy's 10-Q filing cadence.
    //
    // R12.minimal: three click-through tiles, no live data. Upgradeable
    // in-place to value-and-context displays if demand emerges.
    // ============================================================
    _renderExternalWatch: function(specific, slug) {
        var tiles = [
            {
                label: 'MSTR price',
                source: 'Yahoo Finance',
                href: 'https://finance.yahoo.com/quote/MSTR',
                why: 'Strategy\'s underlying equity. Drawdown is the binding stress trigger for STRC.'
            },
            {
                label: 'STRC dividend rate',
                source: 'Strategy IR',
                href: 'https://www.strategy.com/investor-relations',
                why: 'Monthly-reset variable-rate preferred. Watch for moves outside the historical 11–15% band.'
            },
            {
                label: 'Strategy 10-Q filings',
                source: 'SEC EDGAR',
                href: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001050446&type=10-Q',
                why: 'Quarterly disclosure of BTC holdings, STRC outstanding, and dividend coverage.'
            }
        ];

        var tilesHtml = tiles.map(function(t) {
            return '<a href="' + t.href + '" target="_blank" rel="noopener noreferrer" ' +
                   'class="block rounded-lg border border-slate-200 dark:border-slate-700 p-3 ' +
                   'hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors">' +
                '<div class="flex items-baseline justify-between gap-2">' +
                    '<div class="text-sm font-semibold text-slate-800 dark:text-slate-200">' + t.label + '</div>' +
                    '<div class="text-xs text-blue-600 dark:text-blue-400">' + t.source + ' &#8599;</div>' +
                '</div>' +
                '<div class="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">' + t.why + '</div>' +
            '</a>';
        }).join('');

        return '<div class="panel">' +
            '<div class="panel-title">External Watch <span class="text-xs font-normal text-slate-500">— STRC leading indicators</span></div>' +
            '<div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">' +
                tilesHtml +
            '</div>' +
            '<div class="text-xs text-slate-500 italic leading-relaxed mt-4 pt-3 border-t border-slate-200">' +
                'These are the report\'s named leading indicators for STRC concentration risk ' +
                '(see assets/apxusd.md §Key Risk Notes). They sit alongside the Stress Lens above ' +
                'to let you correlate observed inputs with hypothetical writedown scenarios — ' +
                'e.g. a sharp MSTR drawdown or STRC rate cut should move the relevant Stress Lens ' +
                'scenarios from hypothetical toward "watch closely." Links open in a new tab.' +
            '</div>' +
        '</div>';
    },

    _renderReservesDonut: function(specific, slug) {
        var ctx = document.getElementById('apyx-reserves-donut');
        if (!ctx || typeof Chart === 'undefined') return;
        var ba = specific.backing_attestation || {};
        var split = ba.reserves_split || {};
        var order = ['Cash & Equivalents', 'STRC', 'SATA', 'Other'];
        Object.keys(split).forEach(function(k) { if (order.indexOf(k) < 0) order.push(k); });
        var labels = order.filter(function(k) { return split[k] != null && split[k] > 0; });
        var values = labels.map(function(k) { return split[k]; });
        var colors = labels.map(function(k) { return APYX_RESERVES_COLORS[k] || '#94a3b8'; });

        if (window._apyxReservesDonut) window._apyxReservesDonut.destroy();
        window._apyxReservesDonut = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{ data: values, backgroundColor: colors, borderWidth: 0 }]
            },
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

    _renderAttestationTimeline: function(specific, slug) {
        var ctx = document.getElementById('apyx-attestation-timeline');
        if (!ctx || typeof Chart === 'undefined') return;
        var ba = specific.backing_attestation || {};
        var timeline = ba.timeline || [];
        if (timeline.length < 2) {
            ctx.parentElement.innerHTML = '<div class="text-xs text-slate-400 italic">Timeline data unavailable.</div>';
            return;
        }
        var labels = timeline.map(function(p) {
            // ts is millis-as-string; date field is already a YYYY-MM-DD string.
            return new Date(Number(p.ts));
        });
        var supplySeries = timeline.map(function(p) { return p.supply; });
        var reservesSeries = timeline.map(function(p) { return p.reserves; });
        var collatSeries = timeline.map(function(p) {
            return (p.supply > 0) ? (p.reserves / p.supply * 100) : null;
        });

        if (window._apyxAttestationTimeline) window._apyxAttestationTimeline.destroy();
        window._apyxAttestationTimeline = new Chart(ctx, {
            data: {
                labels: labels,
                datasets: [
                    {
                        type: 'line',
                        label: 'Supply (USD)',
                        data: supplySeries,
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.08)',
                        fill: false,
                        tension: 0.25,
                        pointRadius: 0,
                        borderWidth: 2,
                        yAxisID: 'y'
                    },
                    {
                        type: 'line',
                        label: 'Reserves (USD)',
                        data: reservesSeries,
                        borderColor: '#22c55e',
                        backgroundColor: 'rgba(34, 197, 94, 0.08)',
                        fill: false,
                        tension: 0.25,
                        pointRadius: 0,
                        borderWidth: 2,
                        yAxisID: 'y'
                    },
                    {
                        type: 'line',
                        label: 'Collateralization (%)',
                        data: collatSeries,
                        borderColor: '#a855f7',
                        backgroundColor: 'transparent',
                        borderDash: [4, 3],
                        tension: 0.25,
                        pointRadius: 0,
                        borderWidth: 1.5,
                        yAxisID: 'yPct'
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
                        position: 'left',
                        grid: { color: '#f1f5f9' },
                        ticks: {
                            font: { size: 11 },
                            callback: function(v) {
                                if (Math.abs(v) >= 1e6) return '$' + (v / 1e6).toFixed(0) + 'M';
                                if (Math.abs(v) >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'K';
                                return '$' + v;
                            }
                        }
                    },
                    yPct: {
                        position: 'right',
                        grid: { display: false },
                        suggestedMin: 99,
                        suggestedMax: 102,
                        ticks: {
                            font: { size: 11 },
                            callback: function(v) { return v.toFixed(2) + '%'; }
                        }
                    }
                },
                plugins: {
                    legend: { display: true, position: 'top', labels: { boxWidth: 12, font: { size: 11 } } },
                    tooltip: {
                        callbacks: {
                            label: function(c) {
                                if (c.dataset.yAxisID === 'yPct') {
                                    return c.dataset.label + ': ' + (c.raw != null ? c.raw.toFixed(3) + '%' : '—');
                                }
                                return c.dataset.label + ': ' + CommonRenderer.formatCurrencyExact(c.raw);
                            }
                        }
                    }
                },
                interaction: { intersect: false, mode: 'index' }
            }
        });
    },

    // ============================================================
    // §2b Peg Performance (apxUSD)
    //
    // Surface market-price drift vs the $1 theoretical for apxUSD. Conditionally
    // hidden (replaced with a placeholder note) when peg.market_price is null —
    // the source feed (peg_tracker_latest_usd.json) doesn't yet carry the
    // Apyx tokens, so the analyzer emits an empty peg block.
    // ============================================================
    // ============================================================
    // §4 Liquidity (consolidated parent — apxUSD + apyUSD)
    //
    // One panel mapped to the report's "Liquidity" axis, replacing the
    // prior per-asset pair (apxUSD: Peg Performance + Secondary Liquidity;
    // apyUSD: Secondary Market + Secondary Liquidity, with APY tiles relocated
    // to the Yield Trajectory panel where they belong). Sub-sections render
    // summary → detail: Derived Score (summary tile + components reveal)
    // → Peg Performance / Discount to NAV → Secondary Market Depth.
    // Mirrors saturn.js's consolidation (commits c578741e + 1a640777).
    // ============================================================
    _renderLiquidity: function(specific, s, slug) {
        var divider = '<div class="border-t border-slate-200 pt-6 mt-6"></div>';
        // Vault-share peg metric is discount-to-NAV, not absolute price vs $1 —
        // sub-section heading reflects that for apyUSD.
        var pegHeading = (slug === 'apxusd') ? 'Peg Performance' : 'Discount to NAV';
        return '<div class="panel">' +
            '<div class="panel-title">Liquidity</div>' +
            ApyxRenderer._renderLiquidityScoreSection(specific, s, slug) +
            divider +
            '<h3 class="text-sm font-semibold text-slate-900 mt-0 mb-3">' + pegHeading + '</h3>' +
            ApyxRenderer._renderLiquidityPegSection(specific, s, slug) +
            divider +
            '<h3 class="text-sm font-semibold text-slate-900 mt-0 mb-3">Secondary Market Depth</h3>' +
            ApyxRenderer._renderLiquidityDepthSection(specific, slug) +
        '</div>';
    },

    // Score sub-section — summary tile (derived score · editorial · Δ · badge)
    // with a <details> reveal for the components breakdown. No chart canvas;
    // the underlying time-series story is covered by the Peg sub-section's
    // chart below, so a separate score chart is redundant.
    _renderLiquidityScoreSection: function(specific, s, slug) {
        var ld = (s && s.liquidity_depth_derived) || null;
        if (!ld) {
            return '<div class="risk-flag" style="background:#f1f5f9;color:#475569;border-left:4px solid #94a3b8;">' +
                '<strong>Liquidity derivation pending.</strong> Formula codified, awaiting analyzer wire-up. ' +
                'See <span class="font-mono">specs/handoffs/apyx-liquidity-derivation-pegtracker.md</span>.' +
            '</div>';
        }

        var editorial = APYX_EDITORIAL_LIQUIDITY[slug];
        var derived = ld.score;
        var derivedTxt = (derived != null) ? derived.toFixed(1) + ' / 10' : '—';
        var editorialTxt = (editorial != null) ? editorial.toFixed(1) : '—';
        var delta = (editorial != null && derived != null) ? (derived - editorial) : null;
        var deltaTxt = (delta == null) ? '—' :
                       (delta === 0) ? '0.0' :
                       (delta > 0 ? '+' : '−') + Math.abs(delta).toFixed(1);
        var badge = ApyxRenderer._liquidityReconciliationBadge(delta);

        var comp = ld.components || {};

        // Pull Curve pool TVL for the depth-tier context "capped to 5% × $X
        // Curve TVL". apxUSD uses Curve apxUSD/USDC; apyUSD uses Curve
        // apyUSD/apxUSD as its analyzer-anchor pair.
        var pools = (specific.liquidity || {}).pools || [];
        var curvePair = (slug === 'apxusd') ? 'apxUSD/USDC' : 'apyUSD/apxUSD';
        var curvePool = null;
        for (var i = 0; i < pools.length; i++) {
            var p = pools[i];
            if (p.venue === 'curve' && p.pair && p.pair.indexOf(curvePair) >= 0) {
                curvePool = p;
                break;
            }
        }
        var poolTvl = curvePool ? curvePool.depth_usd : null;

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

    // Peg sub-section — slug-branched body.
    // apxUSD: Peg Performance (market price vs theoretical $1, 7d premium/discount chart).
    // apyUSD: Discount to NAV (contract NAV vs Curve market price, trajectory + discount chart).
    // Canvas IDs preserved so the existing chart loaders find their targets:
    //   apxUSD: apyx-peg-history → _loadPegHistoryChart
    //   apyUSD: apyx-market-price-trajectory + apyx-market-discount
    //           → _loadMarketPriceTrajectory + _loadMarketDiscountChart
    _renderLiquidityPegSection: function(specific, s, slug) {
        if (slug === 'apxusd') {
            return ApyxRenderer._renderApxusdPegBody(specific);
        }
        return ApyxRenderer._renderApyusdDiscountBody(specific);
    },

    _renderApxusdPegBody: function(specific) {
        var peg = specific.peg || {};
        var hasMarket = peg.market_price != null;

        if (!hasMarket) {
            return '<div class="risk-flag risk-info">' +
                '<strong>Peg data not yet tracked.</strong> ' +
                'apxUSD has not been added to the upstream peg-tracker feed yet — DEX-implied state ' +
                'is visible in the Secondary Market Depth sub-section below. This sub-section will populate ' +
                'automatically once <span class="font-mono">peg_tracker_latest_usd.json</span> ' +
                'begins emitting apxUSD entries.' +
            '</div>';
        }

        var pdPct = peg.premium_discount_pct;
        var state = ApyxRenderer._pegStatusClass(pdPct);
        var pdCls = ApyxRenderer._pegPctClass(state);

        var marketTxt = '$' + peg.market_price.toFixed(4);
        var theoTxt = (peg.theoretical_price != null) ?
            '$' + peg.theoretical_price.toFixed(4) : '$1.0000';

        var statCards =
            '<div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">' +
                '<div class="summary-card"><div class="card-label">Market price</div>' +
                    '<div class="card-value">' + marketTxt + '</div>' +
                    '<div class="text-xs text-slate-400 mt-1">vs theoretical ' + theoTxt + '</div></div>' +
                '<div class="summary-card"><div class="card-label">Premium / Discount</div>' +
                    '<div class="card-value ' + pdCls + '">' + ApyxRenderer._pegPctText(pdPct) + '</div></div>' +
                '<div class="summary-card"><div class="card-label">Status</div>' +
                    '<div class="mt-2">' + ApyxRenderer._statusPill(ApyxRenderer._pegStatusLabel(state), state) + '</div></div>' +
            '</div>';

        var chartBlock =
            '<div class="mt-4">' +
                '<div class="text-sm font-semibold text-slate-700 mb-2">7-day premium / discount vs $1</div>' +
                '<div style="height: 360px; position: relative;">' +
                    '<canvas id="apyx-peg-history"></canvas>' +
                '</div>' +
            '</div>';

        // Secondary metrics — slippage and Curve pool balance ratio are
        // contemporaneous proxies for peg pressure; rising exit-cost or a
        // tilting pool signals the same stress before the price moves.
        var liq = specific.liquidity || {};
        var quotes = liq.quotes || {};
        var slip100k = (quotes.apxUSD_to_USDC && quotes.apxUSD_to_USDC['100000']) ?
            quotes.apxUSD_to_USDC['100000'].slippage_pct : null;

        var pools = liq.pools || [];
        var curveApxPool = null;
        for (var i = 0; i < pools.length; i++) {
            var p = pools[i];
            if (p.venue === 'curve' && p.pair && p.pair.indexOf('apxUSD/USDC') >= 0) {
                curveApxPool = p;
                break;
            }
        }
        var poolRatio = (curveApxPool && curveApxPool.balance_ratio != null) ?
            curveApxPool.balance_ratio : null;

        var sourceTxt = peg.source || '—';
        var obsAgo = '—';
        if (peg.timestamp) {
            var pegMs = new Date(peg.timestamp).getTime();
            if (!isNaN(pegMs)) {
                obsAgo = ApyxRenderer._formatAge((Date.now() - pegMs) / 1000);
            }
        }

        var secondaryRow =
            '<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-xs">' +
                '<div><div class="text-slate-400 uppercase font-medium">Source</div>' +
                    '<div class="font-mono text-slate-700 mt-0.5">' + sourceTxt + '</div></div>' +
                '<div><div class="text-slate-400 uppercase font-medium">Last observation</div>' +
                    '<div class="text-slate-700 mt-0.5">' + obsAgo + '</div></div>' +
                '<div><div class="text-slate-400 uppercase font-medium">$100K slippage</div>' +
                    '<div class="font-mono text-slate-700 mt-0.5">' + (slip100k != null ? slip100k.toFixed(3) + '%' : '—') + '</div>' +
                    '<div class="text-slate-400">peg-pressure proxy</div></div>' +
                '<div><div class="text-slate-400 uppercase font-medium">Curve apxUSD share</div>' +
                    '<div class="font-mono text-slate-700 mt-0.5">' + (poolRatio != null ? poolRatio.toFixed(4) : '—') + '</div>' +
                    '<div class="text-slate-400">drift from 0.5 = pressure</div></div>' +
            '</div>';

        return statCards + chartBlock + secondaryRow;
    },

    // Discount-to-NAV body for apyUSD. Contract NAV vs Curve market price
    // (apyUSD/apxUSD) — no APY tile row; the Yield Trajectory panel is the
    // canonical home for yield metrics, this sub-section covers exit cost.
    // Field reads use Layer-1 names with a fallback to legacy:
    //   dex_market_price ?? dex_implied_nav
    //   market_discount_pct ?? nav_spread_pct
    _renderApyusdDiscountBody: function(specific) {
        var vs = specific.vault_state || {};
        var contractNav = vs.nav;
        var marketPrice = (vs.dex_market_price != null) ? vs.dex_market_price : vs.dex_implied_nav;
        var discountPct = (vs.market_discount_pct != null) ? vs.market_discount_pct : vs.nav_spread_pct;

        var state = ApyxRenderer._pegStatusClass(discountPct, 'apyusd');
        var discountCls = ApyxRenderer._pegPctClass(state);

        var contractTxt = (contractNav != null) ? contractNav.toFixed(4) : '—';
        var marketTxt = (marketPrice != null) ? marketPrice.toFixed(4) : '—';

        var contractUnit = (contractNav != null) ?
            '<span class="text-xs text-slate-400 font-normal ml-1">apxUSD/share</span>' : '';
        var marketUnit = (marketPrice != null) ?
            '<span class="text-xs text-slate-400 font-normal ml-1">apxUSD/share</span>' : '';

        var statCards =
            '<div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">' +
                '<div class="summary-card"><div class="card-label">Contract NAV</div>' +
                    '<div class="card-value">' + contractTxt + contractUnit + '</div>' +
                    '<div class="text-xs text-slate-400 mt-1">on-chain ERC-4626 share price</div></div>' +
                '<div class="summary-card"><div class="card-label">Market Price</div>' +
                    '<div class="card-value">' + marketTxt + marketUnit + '</div>' +
                    '<div class="text-xs text-slate-400 mt-1">Curve apyUSD/apxUSD spot, apxUSD/share</div></div>' +
                '<div class="summary-card"><div class="card-label">Market Discount</div>' +
                    '<div class="card-value ' + discountCls + '">' + ApyxRenderer._pegPctText(discountPct) + '</div>' +
                    '<div class="mt-1">' + ApyxRenderer._statusPill(ApyxRenderer._pegStatusLabel(state), state) + '</div></div>' +
            '</div>';

        var trajectoryBlock =
            '<div class="mt-4">' +
                '<div class="text-sm font-semibold text-slate-700 mb-2">Market price vs contract NAV (7 days)</div>' +
                '<div style="height: 320px; position: relative;">' +
                    '<canvas id="apyx-market-price-trajectory"></canvas>' +
                '</div>' +
            '</div>';

        var discountChartBlock =
            '<div class="mt-4">' +
                '<div class="text-sm font-semibold text-slate-700 mb-2">Market discount over time</div>' +
                '<div style="height: 200px; position: relative;">' +
                    '<canvas id="apyx-market-discount"></canvas>' +
                '</div>' +
            '</div>';

        var methodology =
            '<div class="text-xs text-slate-500 italic leading-relaxed mt-4 pt-3 border-t border-slate-200">' +
                'Contract NAV is the on-chain ERC-4626 share price (how many apxUSD each apyUSD share ' +
                'represents). Market Price is the live Curve apyUSD/apxUSD spot — what the secondary ' +
                'market actually pays for one share right now. A persistent market discount typically ' +
                'reflects arb-bounded redemption inefficiency from the 20-day UnlockToken cooldown ' +
                '(arbs can\'t close the gap atomically), not a peg break. Reference bands are widened ' +
                'vs the apxUSD true-peg panel — ±50 bps healthy / ±100 bps watch / ±200 bps stress — ' +
                'because the cooldown imposes a structural discount floor of roughly −40 bps that is ' +
                'not stress and should not alert.' +
            '</div>';

        return statCards + trajectoryBlock + discountChartBlock + methodology;
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

    _pegBandAnnotations: function(slug) {
        if (slug !== 'apyusd') return CommonRenderer.pegBandAnnotations();
        // apyUSD bands are 2× the apxUSD true-peg bands.
        // ±50 bps healthy / ±100 bps watch / ±200 bps stress.
        return {
            healthyBand:   { type: 'box', yMin: -0.50, yMax: 0.50,  backgroundColor: 'rgba(34, 197, 94, 0.07)', borderWidth: 0 },
            watchBandPos:  { type: 'box', yMin: 0.50,  yMax: 1.00,  backgroundColor: 'rgba(245, 158, 11, 0.06)', borderWidth: 0 },
            watchBandNeg:  { type: 'box', yMin: -1.00, yMax: -0.50, backgroundColor: 'rgba(245, 158, 11, 0.06)', borderWidth: 0 },
            stressBandPos: { type: 'box', yMin: 1.00,  yMax: 2.00,  backgroundColor: 'rgba(239, 68, 68, 0.06)', borderWidth: 0 },
            stressBandNeg: { type: 'box', yMin: -2.00, yMax: -1.00, backgroundColor: 'rgba(239, 68, 68, 0.06)', borderWidth: 0 },
            line50pos:  { type: 'line', yMin: 0.50,  yMax: 0.50,  borderColor: '#22c55e', borderWidth: 1, borderDash: [3, 3], label: { content: '+50 bps',  display: true, position: 'end', font: { size: 9 }, color: '#16a34a' } },
            line50neg:  { type: 'line', yMin: -0.50, yMax: -0.50, borderColor: '#22c55e', borderWidth: 1, borderDash: [3, 3], label: { content: '-50 bps',  display: true, position: 'end', font: { size: 9 }, color: '#16a34a' } },
            line100pos: { type: 'line', yMin: 1.00,  yMax: 1.00,  borderColor: '#f59e0b', borderWidth: 1, borderDash: [3, 3], label: { content: '+100 bps', display: true, position: 'end', font: { size: 9 }, color: '#d97706' } },
            line100neg: { type: 'line', yMin: -1.00, yMax: -1.00, borderColor: '#f59e0b', borderWidth: 1, borderDash: [3, 3], label: { content: '-100 bps', display: true, position: 'end', font: { size: 9 }, color: '#d97706' } },
            line200pos: { type: 'line', yMin: 2.00,  yMax: 2.00,  borderColor: '#ef4444', borderWidth: 1, borderDash: [3, 3], label: { content: '+200 bps', display: true, position: 'end', font: { size: 9 }, color: '#dc2626' } },
            line200neg: { type: 'line', yMin: -2.00, yMax: -2.00, borderColor: '#ef4444', borderWidth: 1, borderDash: [3, 3], label: { content: '-200 bps', display: true, position: 'end', font: { size: 9 }, color: '#dc2626' } },
            zero: { type: 'line', yMin: 0, yMax: 0, borderColor: '#94a3b8', borderWidth: 1 }
        };
    },

    _loadPegHistoryChart: function(slug) {
        var ctx = document.getElementById('apyx-peg-history');
        if (!ctx || typeof Chart === 'undefined') return;
        var nocache = Math.floor(Date.now() / 60000);
        fetch('data/' + slug + '_backing_history.json?nocache=' + nocache)
            .then(function(r) { return r.ok ? r.json() : null; })
            .then(function(hist) {
                if (!hist || !Array.isArray(hist.entries)) {
                    ctx.parentElement.innerHTML = '<div class="text-xs text-slate-400 italic">Peg history unavailable.</div>';
                    return;
                }
                var cutoff = Date.now() - 7 * 24 * 3600 * 1000;
                var pts = hist.entries.filter(function(e) {
                    if (e.peg_premium_discount_pct == null) return false;
                    var ts = e.timestamp.endsWith('Z') ? e.timestamp : (e.timestamp + 'Z');
                    return new Date(ts).getTime() >= cutoff;
                });
                if (pts.length < 2) {
                    ctx.parentElement.innerHTML = '<div class="text-xs text-slate-400 italic">' +
                        'Peg history not yet populated — chart will appear once the upstream peg tracker emits apxUSD readings.</div>';
                    return;
                }
                ApyxRenderer._drawPegHistory(ctx, pts);
            })
            .catch(function() {
                ctx.parentElement.innerHTML = '<div class="text-xs text-slate-400 italic">Peg history unavailable.</div>';
            });
    },

    _drawPegHistory: function(ctx, entries) {
        var labels = entries.map(function(e) {
            var ts = e.timestamp.endsWith('Z') ? e.timestamp : (e.timestamp + 'Z');
            return new Date(ts);
        });
        var pdSeries = entries.map(function(e) { return e.peg_premium_discount_pct; });
        var pointColors = pdSeries.map(function(v) {
            var st = ApyxRenderer._pegStatusClass(v);
            if (st === 'ok') return '#3b82f6';
            if (st === 'warn') return '#f59e0b';
            if (st === 'critical') return '#ef4444';
            return '#94a3b8';
        });

        if (window._apyxPegChart) {
            try { window._apyxPegChart.destroy(); } catch (e) {}
        }
        window._apyxPegChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Premium / Discount',
                    data: pdSeries,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.08)',
                    pointBackgroundColor: pointColors,
                    pointBorderColor: pointColors,
                    fill: false,
                    tension: 0.25,
                    pointRadius: 2,
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
                        suggestedMin: -1.0,
                        suggestedMax: 1.0,
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
                            label: function(c) { return c.dataset.label + ': ' + (c.raw != null ? c.raw.toFixed(3) + '%' : '—'); }
                        }
                    },
                    annotation: { annotations: ApyxRenderer._pegBandAnnotations() }
                },
                interaction: { intersect: false, mode: 'index' }
            }
        });
    },

    _loadMarketPriceTrajectory: function(slug) {
        var ctx = document.getElementById('apyx-market-price-trajectory');
        if (!ctx || typeof Chart === 'undefined') return;
        var nocache = Math.floor(Date.now() / 60000);
        fetch('data/' + slug + '_backing_history.json?nocache=' + nocache)
            .then(function(r) { return r.ok ? r.json() : null; })
            .then(function(hist) {
                if (!hist || !Array.isArray(hist.entries) || hist.entries.length < 2) {
                    ctx.parentElement.innerHTML = '<div class="text-xs text-slate-400 italic">Market price history not yet available.</div>';
                    return;
                }
                var cutoff = Date.now() - 7 * 24 * 3600 * 1000;
                var windowed = hist.entries.filter(function(e) {
                    var ts = e.timestamp.endsWith('Z') ? e.timestamp : (e.timestamp + 'Z');
                    return new Date(ts).getTime() >= cutoff;
                });
                if (windowed.length < 2) {
                    ctx.parentElement.innerHTML = '<div class="text-xs text-slate-400 italic">Market price history not yet available.</div>';
                    return;
                }
                ApyxRenderer._drawMarketPriceTrajectory(ctx, windowed);
            })
            .catch(function() {
                ctx.parentElement.innerHTML = '<div class="text-xs text-slate-400 italic">Market price history unavailable.</div>';
            });
    },

    _drawMarketPriceTrajectory: function(ctx, entries) {
        var labels = entries.map(function(e) {
            var ts = e.timestamp.endsWith('Z') ? e.timestamp : (e.timestamp + 'Z');
            return new Date(ts);
        });
        var navSeries = entries.map(function(e) { return e.nav; });
        // Layer 1 emits dex_market_price; fall back to legacy dex_implied_nav
        // until all live JSONs carry the new name.
        var marketSeries = entries.map(function(e) {
            return (e.dex_market_price != null) ? e.dex_market_price : e.dex_implied_nav;
        });

        if (window._apyxMarketPriceChart) {
            try { window._apyxMarketPriceChart.destroy(); } catch (e) {}
        }
        window._apyxMarketPriceChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Contract NAV',
                        data: navSeries,
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.08)',
                        fill: false,
                        tension: 0.25,
                        pointRadius: 0,
                        borderWidth: 2,
                        spanGaps: true
                    },
                    {
                        label: 'Market Price',
                        data: marketSeries,
                        borderColor: '#f59e0b',
                        backgroundColor: 'transparent',
                        borderDash: [5, 4],
                        fill: false,
                        tension: 0.25,
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
                            label: function(c) { return c.dataset.label + ': ' + (c.raw != null ? Number(c.raw).toFixed(6) : '—'); }
                        }
                    },
                    annotation: {
                        annotations: {
                            baseline: {
                                type: 'line', yMin: 1.0, yMax: 1.0,
                                borderColor: '#cbd5e1', borderWidth: 1, borderDash: [4, 4],
                                label: { content: 'launch baseline 1.0', display: true, position: 'start', font: { size: 9 }, color: '#94a3b8' }
                            }
                        }
                    }
                },
                interaction: { intersect: false, mode: 'index' }
            }
        });
    },

    _loadMarketDiscountChart: function(slug) {
        var ctx = document.getElementById('apyx-market-discount');
        if (!ctx || typeof Chart === 'undefined') return;
        var nocache = Math.floor(Date.now() / 60000);
        fetch('data/' + slug + '_backing_history.json?nocache=' + nocache)
            .then(function(r) { return r.ok ? r.json() : null; })
            .then(function(hist) {
                if (!hist || !Array.isArray(hist.entries)) {
                    ctx.parentElement.innerHTML = '<div class="text-xs text-slate-400 italic">Market discount history unavailable.</div>';
                    return;
                }
                // Layer 1 field market_discount_pct, fallback to legacy nav_spread_pct.
                var cutoff = Date.now() - 7 * 24 * 3600 * 1000;
                var pts = hist.entries.filter(function(e) {
                    if (e.market_discount_pct == null && e.nav_spread_pct == null) return false;
                    var ts = e.timestamp.endsWith('Z') ? e.timestamp : (e.timestamp + 'Z');
                    return new Date(ts).getTime() >= cutoff;
                });
                if (pts.length < 2) {
                    ctx.parentElement.innerHTML = '<div class="text-xs text-slate-400 italic">' +
                        'Market discount history is accumulating — chart will populate after a few hours of samples.</div>';
                    return;
                }
                ApyxRenderer._drawMarketDiscountChart(ctx, pts);
            })
            .catch(function() {
                ctx.parentElement.innerHTML = '<div class="text-xs text-slate-400 italic">Market discount history unavailable.</div>';
            });
    },

    _drawMarketDiscountChart: function(ctx, entries) {
        var labels = entries.map(function(e) {
            var ts = e.timestamp.endsWith('Z') ? e.timestamp : (e.timestamp + 'Z');
            return new Date(ts);
        });
        var discountSeries = entries.map(function(e) {
            return (e.market_discount_pct != null) ? e.market_discount_pct : e.nav_spread_pct;
        });
        var pointColors = discountSeries.map(function(v) {
            var st = ApyxRenderer._pegStatusClass(v, 'apyusd');
            if (st === 'ok') return '#3b82f6';
            if (st === 'warn') return '#f59e0b';
            if (st === 'critical') return '#ef4444';
            return '#94a3b8';
        });

        if (window._apyxMarketDiscountChart) {
            try { window._apyxMarketDiscountChart.destroy(); } catch (e) {}
        }
        var marketDiscountAnnotations = ApyxRenderer._pegBandAnnotations('apyusd');
        window._apyxMarketDiscountChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Market discount',
                    data: discountSeries,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.08)',
                    pointBackgroundColor: pointColors,
                    pointBorderColor: pointColors,
                    fill: false,
                    tension: 0.25,
                    pointRadius: 2,
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
                        suggestedMin: -1.0,
                        suggestedMax: 1.0,
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
                            label: function(c) { return c.dataset.label + ': ' + (c.raw != null ? c.raw.toFixed(3) + '%' : '—'); }
                        }
                    },
                    annotation: { annotations: marketDiscountAnnotations }
                },
                interaction: { intersect: false, mode: 'index' }
            }
        });
    },

    // ============================================================
    // §3a Yield Trajectory  (apyUSD only)
    // ============================================================
    _renderYieldTrajectory: function(specific, s) {
        var y = specific.yield || {};
        var apy7 = y.implied_apy_7d_pct;
        var apy30 = y.implied_apy_30d_pct;
        var headline = (apy30 != null) ? apy30 : apy7;

        var headlineHtml;
        if (headline != null) {
            headlineHtml = '<div class="text-2xl font-bold text-slate-800">~' +
                headline.toFixed(2) + '% APY</div>' +
                '<div class="text-xs text-slate-500 mt-1">Trailing implied APY · NAV-delta rolling window</div>';
        } else {
            headlineHtml = '<div class="text-base text-slate-500 italic">' +
                'Insufficient history — yield chart will populate after 7 days of NAV samples' +
                '</div>';
        }

        var apyRow =
            '<div class="grid grid-cols-3 gap-3 mt-4">' +
                '<div class="summary-card"><div class="card-label">7d implied APY</div>' +
                    '<div class="card-value">' + (apy7 != null ? CommonRenderer.formatPercent(apy7, 2) : '—') + '</div></div>' +
                '<div class="summary-card"><div class="card-label">30d implied APY</div>' +
                    '<div class="card-value">' + (apy30 != null ? CommonRenderer.formatPercent(apy30, 2) : '—') + '</div></div>' +
                '<div class="summary-card"><div class="card-label">Since inception</div>' +
                    '<div class="card-value text-base text-slate-500 italic">(awaiting history)</div></div>' +
            '</div>';

        // NAV trajectory chart lives inside the Liquidity panel's Discount-to-NAV
        // sub-section — it overlays the Curve apyUSD/apxUSD market price alongside
        // contract NAV, which subsumes the standalone contract-only chart that
        // used to live here.
        var methodology =
            '<div class="text-xs text-slate-500 italic leading-relaxed mt-4 pt-3 border-t border-slate-200">' +
                'Yield is real STRC dividend pass-through. NAV growth in the first week of operations ' +
                '(Feb 20-27 2026) included a one-time ~33% launch seed from donation-pattern apxUSD ' +
                'inflows; the post-launch trajectory is the recurring rate (~13% APY, consistent with ' +
                'STRC\'s 11-15% indicated-rate range). <strong>New buyers earn the ongoing rate, not the ' +
                'headline.</strong> See the Liquidity panel below for the live market-price-vs-NAV overlay.' +
            '</div>';

        return '<div class="panel">' +
            '<div class="panel-title">Yield Trajectory</div>' +
            headlineHtml +
            apyRow +
            methodology +
        '</div>';
    },

    // ============================================================
    // §3b Unlock Queue  (apyUSD only)
    // ============================================================
    _renderUnlockQueue: function(specific) {
        var u = specific.unlock_queue || {};
        var depth = u.queue_depth_apxusd;
        var wow = u.week_over_week_growth_x;
        // Prefer live cooldown_days from the analyzer (2026-04-15 lever flip); fall back to legacy doc field; final default 20 (current on-chain).
        var docDays = u.cooldown_days != null ? u.cooldown_days
                    : u.duration_documented_days != null ? u.duration_documented_days
                    : 20;
        var known = u.duration_known;

        var wowState = (wow != null && wow > 2.0) ? 'critical' : (wow != null && wow > 1.5) ? 'warn' : 'ok';
        var wowPill = (wow != null) ?
            ApyxRenderer._statusPill('Week-over-week growth', wowState, wow.toFixed(2) + '×') :
            ApyxRenderer._statusPill('Week-over-week growth', 'warn', 'no history');

        var durationCaveat = '';
        if (!known) {
            durationCaveat =
                '<div class="text-xs text-amber-700 mt-2">' +
                    '<strong>Note:</strong> Live <span class="font-mono">unlockingDelay()</span> ' +
                    'read failed on this snapshot; displaying last-known value.' +
                '</div>';
        }

        // R10 layer-2: drain rate + implied wait. Analyzer emits a 7-day
        // rolling sum of UnlockToken Withdraw events as drain_rate; implied
        // wait = queue depth / drain rate (null when drain is zero). Wait
        // card color-tiers against docDays: green within docDays+5, amber
        // up to 2× nominal (back-loading visible), red beyond 2× or stalled.
        var drainRate = u.drain_rate_7d_apxusd_per_day;
        var impliedWait = u.implied_wait_days;

        var drainCard = '';
        if (drainRate != null) {
            drainCard =
                '<div class="summary-card">' +
                    '<div class="card-label">7d drain rate</div>' +
                    '<div class="card-value">' + CommonRenderer.formatCurrency(drainRate) +
                        '<span class="text-xs text-slate-400 font-normal ml-1">/day</span>' +
                    '</div>' +
                    '<div class="text-xs text-slate-400 mt-1">apxUSD exiting cooldown (7-day rolling)</div>' +
                '</div>';
        }

        var waitCard = '';
        if (impliedWait != null || drainRate === 0) {
            var waitValue, waitValueCls, waitSubtext;
            if (impliedWait == null || drainRate === 0) {
                waitValue = 'stalled';
                waitValueCls = 'text-red-600';
                waitSubtext = 'no exits in 7-day window';
            } else {
                var ratio = impliedWait / docDays;
                waitValue = impliedWait.toFixed(1) + ' days';
                if (impliedWait <= docDays + 5) {
                    waitValueCls = 'text-green-600';
                    waitSubtext = 'queue tracking nominal cooldown';
                } else if (ratio <= 2.0) {
                    waitValueCls = 'text-amber-600';
                    waitSubtext = ratio.toFixed(2) + '× nominal — queue back-loaded';
                } else {
                    waitValueCls = 'text-red-600';
                    waitSubtext = ratio.toFixed(2) + '× nominal — heavy back-loading';
                }
            }
            waitCard =
                '<div class="summary-card">' +
                    '<div class="card-label">Implied wait</div>' +
                    '<div class="card-value ' + waitValueCls + '">' + waitValue + '</div>' +
                    '<div class="text-xs text-slate-400 mt-1">' + waitSubtext + '</div>' +
                '</div>';
        }

        var methodology =
            '<div class="text-xs text-slate-500 italic leading-relaxed mt-4 pt-3 border-t border-slate-200">' +
                '<strong>Cooldown</strong> is read live from the UnlockToken\'s ' +
                '<span class="font-mono">unlockingDelay()</span> getter on each snapshot. ' +
                'The cooldown was 30 days at deploy; Apyx admin reduced it to 20 days on 2026-04-15 ' +
                'via <span class="font-mono">setUnlockingDelay()</span>. The setting is admin-mutable ' +
                'subject to a 72-hour AccessManager delay, so future changes surface with a 3-day window. ' +
                '<strong>Drain rate</strong> is a 7-day rolling sum of UnlockToken Withdraw events; ' +
                '<strong>implied wait</strong> = queue depth ÷ drain rate. When implied wait exceeds ' +
                'the nominal cooldown, the queue is back-loaded — new entrants nominally face the ' +
                docDays + '-day SLA but the existing queue-tail has been there longer, so realized exit ' +
                'time tracks implied wait, not nominal cooldown.' +
            '</div>';

        return '<div class="panel">' +
            '<div class="panel-title">Unlock Queue</div>' +
            '<div class="grid grid-cols-2 md:grid-cols-5 gap-3">' +
                '<div class="summary-card"><div class="card-label">Queue depth</div>' +
                    '<div class="card-value">' + CommonRenderer.formatCurrency(depth) + '</div>' +
                    '<div class="text-xs text-slate-400 mt-1">apxUSD locked in cooldown</div></div>' +
                '<div class="summary-card"><div class="card-label">W-o-W growth</div>' +
                    '<div class="mt-1">' + wowPill + '</div></div>' +
                '<div class="summary-card"><div class="card-label">Cooldown</div>' +
                    '<div class="card-value">' + docDays + ' days</div>' +
                    (known
                        ? '<div class="text-xs text-slate-400 mt-1">live on-chain</div>'
                        : '<div class="text-xs text-amber-600 mt-1">last known</div>') +
                '</div>' +
                drainCard +
                waitCard +
            '</div>' +
            durationCaveat +
            methodology +
        '</div>';
    },

    // ============================================================
    // Depth sub-section — pool table + KyberSwap slippage tiers bar chart.
    // Renamed from _renderLiquidity; panel/title wrap moved to the parent
    // _renderLiquidity. Preserves apxUSD-vs-apyUSD pool-table branching and
    // canvas id apyx-slippage-chart so _renderSlippageChart finds its target.
    // ============================================================
    _renderLiquidityDepthSection: function(specific, slug) {
        var liq = specific.liquidity || {};
        var pools = liq.pools || [];

        function poolRowHtml(p) {
            var venueName = (p.venue === 'pcs_v3') ? 'PancakeSwap V3' :
                            (p.venue === 'curve') ? 'Curve' :
                            (p.venue ? p.venue.charAt(0).toUpperCase() + p.venue.slice(1) : '—');
            var ratio = (p.balance_ratio != null) ? p.balance_ratio.toFixed(4) : '—';
            var ratioCls = (p.balance_ratio != null && Math.abs(p.balance_ratio - 1) < 0.1) ? '' :
                           (p.balance_ratio != null && p.balance_ratio < 0.5) ? 'text-amber-600' : 'text-slate-500';
            return '<tr>' +
                '<td class="font-medium">' + venueName + '</td>' +
                '<td>' + ApyxRenderer._chainBadge(p.chain || 'ethereum') + '</td>' +
                '<td class="font-mono text-xs">' + (p.pair || '—') + '</td>' +
                '<td class="text-right font-mono">' + CommonRenderer.formatCurrencyExact(p.depth_usd || 0) + '</td>' +
                '<td class="text-right font-mono ' + ratioCls + '">' + ratio + '</td>' +
                '<td>' + ApyxRenderer._addrCell(p.address, p.chain) + '</td>' +
            '</tr>';
        }

        function sectionHtml(title, sectionPools, subtitle) {
            if (!sectionPools.length) return '';
            var depthEth = sectionPools.filter(function(p) { return p.chain === 'ethereum'; })
                .reduce(function(s, p) { return s + (p.depth_usd || 0); }, 0);
            var depthBase = sectionPools.filter(function(p) { return p.chain === 'base'; })
                .reduce(function(s, p) { return s + (p.depth_usd || 0); }, 0);
            var subtotal = '~' + CommonRenderer.formatCurrency(depthEth + depthBase) +
                ' across ' + sectionPools.length + ' pool' + (sectionPools.length === 1 ? '' : 's') +
                ' (' + CommonRenderer.formatCurrency(depthEth) + ' Ethereum';
            if (depthBase > 0) subtotal += ' · ' + CommonRenderer.formatCurrency(depthBase) + ' Base';
            subtotal += ')';

            return '<div class="mt-4">' +
                '<div class="text-sm font-semibold text-slate-700">' + title + '</div>' +
                (subtitle ? '<div class="text-xs text-slate-500 mt-0.5">' + subtitle + '</div>' : '') +
                '<div class="text-sm text-slate-600 mt-1 mb-2">' + subtotal + '</div>' +
                '<div class="data-table-scroll">' +
                    '<table class="data-table">' +
                        '<thead><tr>' +
                            '<th>Venue</th><th>Chain</th><th>Pair</th>' +
                            '<th class="text-right">Depth (USD)</th>' +
                            '<th class="text-right">Balance ratio</th>' +
                            '<th>Pool</th>' +
                        '</tr></thead>' +
                        '<tbody>' + sectionPools.map(poolRowHtml).join('') + '</tbody>' +
                    '</table>' +
                '</div>' +
            '</div>';
        }

        var sectionsHtml = '';
        if (slug === 'apxusd') {
            // R8: split apxUSD secondary liquidity into primary-exit (USDC-quoted)
            // and cross-asset (apxUSD without USDC) sections. Per-section subtotals
            // keep the actual USDC-exit depth from being masked by cross-asset
            // depth that doesn't help an apxUSD holder reach dollars. Filter is
            // USDC-substring rather than "any dollar stable" — a future USDT/DAI
            // pool would need the predicate broadened by hand.
            var primaryPools = pools.filter(function(p) {
                return p.pair && p.pair.indexOf('USDC') >= 0;
            });
            var crossPools = pools.filter(function(p) {
                return p.pair && p.pair.indexOf('apxUSD') >= 0 && p.pair.indexOf('USDC') < 0;
            });
            sectionsHtml =
                sectionHtml(
                    'Primary exit (→ USDC)',
                    primaryPools,
                    'Direct apxUSD-to-USDC venues — the actual retail exit path to dollars.'
                ) +
                sectionHtml(
                    'Cross-asset (apyUSD ↔ apxUSD)',
                    crossPools,
                    'apyUSD holders use these to convert into apxUSD (then exit via the primary venues above). Not an apxUSD-side exit.'
                );
        } else if (slug === 'apyusd') {
            var apyusdPools = pools.filter(function(p) {
                return p.pair && p.pair.indexOf('apyUSD') >= 0;
            });
            sectionsHtml = sectionHtml('Secondary depth', apyusdPools, null);
        } else {
            sectionsHtml = sectionHtml('Pools', pools, null);
        }

        var quotes = liq.quotes || {};
        var quoteKey = (slug === 'apxusd') ? 'apxUSD_to_USDC' : 'apyUSD_to_apxUSD';
        var qm = quotes[quoteKey] || {};
        var tiers = ['1000', '10000', '50000', '100000'];
        var has100k = qm['100000'] && qm['100000'].slippage_pct != null;
        var slip100k = has100k ? qm['100000'].slippage_pct : null;
        var routeState = ApyxRenderer._slippageState(slip100k);
        var routeLabel = (routeState === 'ok') ? 'Aggregator route OK' :
                         (routeState === 'warn') ? 'Aggregator route — moderate slippage' :
                         'Aggregator route — heavy slippage';
        var routePill = ApyxRenderer._statusPill(routeLabel, routeState,
            slip100k != null ? slip100k.toFixed(3) + '% @ $100K' : '');

        var hasAnyQuotes = tiers.some(function(t) { return qm[t] && qm[t].slippage_pct != null; });

        var slippageBlock = '';
        if (hasAnyQuotes) {
            slippageBlock =
                '<div class="mt-6">' +
                    '<div class="flex items-center justify-between mb-2">' +
                        '<div class="text-sm font-semibold text-slate-700">KyberSwap slippage tiers — ' +
                            (slug === 'apxusd' ? 'apxUSD → USDC' : 'apyUSD → apxUSD') +
                        '</div>' +
                        routePill +
                    '</div>' +
                    '<div style="height: 200px; position: relative;">' +
                        '<canvas id="apyx-slippage-chart"></canvas>' +
                    '</div>' +
                '</div>';
        }

        return (sectionsHtml || '<div class="text-xs text-slate-400 italic mt-2">No pools enumerated in this snapshot.</div>') +
            slippageBlock;
    },

    _renderSlippageChart: function(specific, slug) {
        var ctx = document.getElementById('apyx-slippage-chart');
        if (!ctx || typeof Chart === 'undefined') return;
        var quotes = (specific.liquidity || {}).quotes || {};
        var quoteKey = (slug === 'apxusd') ? 'apxUSD_to_USDC' : 'apyUSD_to_apxUSD';
        var qm = quotes[quoteKey] || {};
        var tiers = ['1000', '10000', '50000', '100000'];
        var labels = tiers.map(function(t) {
            var n = Number(t);
            return (n >= 1000) ? '$' + (n / 1000) + 'K' : '$' + n;
        });
        var values = tiers.map(function(t) {
            return qm[t] && qm[t].slippage_pct != null ? qm[t].slippage_pct : null;
        });
        var colors = values.map(function(v) {
            var st = ApyxRenderer._slippageState(v);
            if (st === 'ok') return '#22c55e';
            if (st === 'warn') return '#f59e0b';
            return '#ef4444';
        });

        if (window._apyxSlippageChart) window._apyxSlippageChart.destroy();
        window._apyxSlippageChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Slippage %',
                    data: values,
                    backgroundColor: colors,
                    borderWidth: 0,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { grid: { display: false }, ticks: { font: { size: 11 } } },
                    y: {
                        beginAtZero: true,
                        grid: { color: '#f1f5f9' },
                        ticks: {
                            font: { size: 11 },
                            callback: function(v) { return v.toFixed(2) + '%'; }
                        }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(c) {
                                return 'Slippage: ' + (c.raw != null ? c.raw.toFixed(4) + '%' : '—');
                            }
                        }
                    }
                }
            }
        });
    },

    // ============================================================
    // §5 Multi-chain + CCIP Bridge
    // ============================================================
    _renderMultiChainBridge: function(specific, slug) {
        var mc = specific.multi_chain || {};
        var bridge = specific.bridge || {};
        var isApyUsd = slug === 'apyusd';
        var unit = isApyUsd ? ' shares' : '';

        var supplyEth, supplyBase, lockedEth, totalEth;
        // Prefer the on-chain LockRelease pool balance (ccip_locked_eth_raw)
        // as the "locked" display value — it's the same number the
        // conservation invariant compares against base supply. Falling
        // back to canonical - user_circulating keeps older snapshots
        // working but the derived value diverges when conservation breaks.
        var lockedFromPool = ApyxRenderer._rawToTokens(mc.ccip_locked_eth_raw);
        if (isApyUsd) {
            totalEth = mc.canonical_total_supply_shares;
            supplyEth = mc.ethereum && mc.ethereum.user_circulating_shares;
            lockedEth = (lockedFromPool != null) ? lockedFromPool :
                (mc.ethereum && (mc.canonical_total_supply_shares - mc.ethereum.user_circulating_shares));
            supplyBase = mc.base && mc.base.supply_shares;
        } else {
            totalEth = mc.canonical_total_supply;
            supplyEth = mc.ethereum && mc.ethereum.user_circulating;
            lockedEth = (lockedFromPool != null) ? lockedFromPool :
                (mc.ethereum && (mc.canonical_total_supply - mc.ethereum.user_circulating));
            supplyBase = mc.base && mc.base.supply;
        }

        function fmtAmt(n) {
            if (n == null) return '—';
            return isApyUsd ? ApyxRenderer._formatShares(n) : CommonRenderer.formatCurrency(n);
        }

        // Distribution row
        var distRow =
            '<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">' +
                '<div class="summary-card"><div class="card-label">Ethereum circulating</div>' +
                    '<div class="card-value">' + fmtAmt(supplyEth) + '</div>' +
                    '<div class="text-xs text-slate-400 mt-1">user-held</div></div>' +
                '<div class="summary-card"><div class="card-label">Ethereum locked</div>' +
                    '<div class="card-value">' + fmtAmt(lockedEth) + '</div>' +
                    '<div class="text-xs text-slate-400 mt-1">in CCIP LockRelease pool</div></div>' +
                '<div class="summary-card"><div class="card-label">Base supply</div>' +
                    '<div class="card-value">' + fmtAmt(supplyBase) + '</div>' +
                    '<div class="text-xs text-slate-400 mt-1">BurnMint mirror</div></div>' +
                '<div class="summary-card"><div class="card-label">Canonical total</div>' +
                    '<div class="card-value">' + fmtAmt(totalEth) + '</div>' +
                    '<div class="text-xs text-slate-400 mt-1">Ethereum totalSupply</div></div>' +
            '</div>';

        // Conservation invariant banner — the live signal.
        var consBanner;
        if (mc.ccip_conservation_match === true) {
            consBanner =
                '<div class="risk-flag" style="background:#dcfce7;color:#166534;border-left:4px solid #22c55e;">' +
                    '<strong>✓ Conservation invariant satisfied</strong> — locked-on-ETH equals Base supply (exact match).' +
                '</div>';
        } else if (mc.ccip_conservation_match === false) {
            var lockedTok = ApyxRenderer._rawToTokens(mc.ccip_locked_eth_raw);
            var baseTok = ApyxRenderer._rawToTokens(mc.ccip_burnmint_supply_base_raw);
            var diff = (lockedTok != null && baseTok != null) ? (lockedTok - baseTok) : null;
            var diffTxt = (diff != null) ? (isApyUsd ?
                ApyxRenderer._formatToken(diff, 4) + ' shares' :
                CommonRenderer.formatCurrencyExact(diff)) : '—';
            consBanner =
                '<div class="risk-flag risk-critical">' +
                    '<strong>🚨 CONSERVATION VIOLATED</strong> — ' +
                    'locked-on-ETH (' + (isApyUsd ? ApyxRenderer._formatToken(lockedTok, 4) + ' shares' : CommonRenderer.formatCurrencyExact(lockedTok)) + ') ' +
                    '≠ Base supply (' + (isApyUsd ? ApyxRenderer._formatToken(baseTok, 4) + ' shares' : CommonRenderer.formatCurrencyExact(baseTok)) + ') · ' +
                    'diff <span class="font-mono">' + diffTxt + '</span>' +
                    '<div class="text-xs mt-2 font-normal">' +
                        '<strong>Most likely:</strong> in-flight CCIP message (L1 → L2 finality is ~20-30 min). ' +
                        'If persistent &gt; 1h, escalate as structural breach.' +
                    '</div>' +
                '</div>';
        } else {
            consBanner =
                '<div class="risk-flag risk-info">Conservation invariant status unknown for this snapshot.</div>';
        }

        // Bridge mechanics row
        var bridgeMeta =
            '<div class="mt-4">' +
                '<div class="text-sm font-semibold text-slate-700 mb-2">Bridge mechanics</div>' +
                '<table class="data-table"><tbody>' +
                    '<tr><td class="font-medium">CCIP version</td><td><span class="font-mono">' + (bridge.ccip_version || APYX_BRIDGE_INFO.ccip_version) + '</span></td></tr>' +
                    '<tr><td class="font-medium">Architecture</td><td>' + APYX_BRIDGE_INFO.architecture + '</td></tr>' +
                    '<tr><td class="font-medium">Router</td><td>' +
                        ApyxRenderer._statusPill('Chainlink-canonical', bridge.router_canonical ? 'ok' : 'critical') +
                        ' ' + ApyxRenderer._addrCell(bridge.router_eth || APYX_BRIDGE_INFO.router_canonical_eth, 'ethereum') +
                    '</td></tr>' +
                    '<tr><td class="font-medium">RMN</td><td>' +
                        ApyxRenderer._statusPill('Chainlink-canonical', bridge.rmn_canonical ? 'ok' : 'critical') +
                        ' ' + ApyxRenderer._addrCell(bridge.rmn_proxy_eth || APYX_BRIDGE_INFO.rmn_canonical_eth, 'ethereum') +
                    '</td></tr>' +
                    '<tr><td class="font-medium">Rebalancer</td><td>' +
                        (bridge.rebalancer_zero ?
                            ApyxRenderer._statusPill('0x0 (no operator)', 'ok', 'locked inventory cannot leave pool') :
                            ApyxRenderer._statusPill('Set', 'warn') + ' ' + ApyxRenderer._addrCell(bridge.rebalancer, 'ethereum')) +
                    '</td></tr>' +
                '</tbody></table>' +
            '</div>';

        // Rate-limit gauges
        var rlOutCap = ApyxRenderer._rawToTokens(bridge.rate_limit_outbound_capacity_raw);
        var rlInCap = ApyxRenderer._rawToTokens(bridge.rate_limit_inbound_capacity_raw);
        var rlOutUtil = (bridge.rate_limit_outbound_utilization_pct != null) ? bridge.rate_limit_outbound_utilization_pct : 0;
        function rlBar(label, capTokens, utilPct) {
            var capTxt = (capTokens != null) ?
                (capTokens >= 1e6 ? (capTokens / 1e6).toFixed(2) + 'M' : (capTokens / 1e3).toFixed(0) + 'K') +
                (isApyUsd ? ' shares' : '') : '—';
            var barWidth = Math.max(0, Math.min(100, utilPct));
            var color = utilPct < 50 ? '#22c55e' : utilPct < 85 ? '#f59e0b' : '#ef4444';
            return '<div class="mb-2">' +
                '<div class="flex justify-between text-sm mb-1">' +
                    '<span class="text-slate-700 font-medium">' + label + '</span>' +
                    '<span class="text-xs text-slate-500 font-mono">' + capTxt + '/day · ' + utilPct.toFixed(2) + '% used</span>' +
                '</div>' +
                '<div class="pct-bar-container"><div class="pct-bar" style="width:' + barWidth + '%; background:' + color + '"></div></div>' +
            '</div>';
        }
        var rlBlock =
            '<div class="mt-4">' +
                '<div class="text-sm font-semibold text-slate-700 mb-2">CCIP rate limits</div>' +
                rlBar('Outbound (Eth → Base)', rlOutCap, rlOutUtil) +
                '<div class="text-xs text-slate-500 mt-1">' +
                    'Inbound capacity ' + (rlInCap != null ? (rlInCap >= 1e6 ? (rlInCap / 1e6).toFixed(2) + 'M' : (rlInCap / 1e3).toFixed(0) + 'K') : '—') +
                    (isApyUsd ? ' shares' : '') + '/day · refills continuously.' +
                '</div>' +
            '</div>';

        // Pool addresses (CCIP eth + base pools)
        var poolAddrs =
            '<div class="mt-4">' +
                '<div class="text-sm font-semibold text-slate-700 mb-2">CCIP pool addresses</div>' +
                '<table class="data-table"><tbody>' +
                    '<tr><td class="font-medium">Ethereum (LockRelease)</td><td>' + ApyxRenderer._addrCell(bridge.eth_pool_address, 'ethereum') + '</td></tr>' +
                    '<tr><td class="font-medium">Base (BurnMint)</td><td>' + ApyxRenderer._addrCell(bridge.base_pool_address, 'base') + '</td></tr>' +
                '</tbody></table>' +
            '</div>';

        return '<div class="panel">' +
            '<div class="panel-title">Multi-chain &amp; CCIP Bridge</div>' +
            distRow +
            consBanner +
            bridgeMeta +
            rlBlock +
            poolAddrs +
        '</div>';
    },

    // ============================================================
    // §6 Trust Stack
    // ============================================================
    _renderTrustStack: function(specific) {
        var g = specific.governance || {};

        function trow(role, addr, threshold, timelock, notes, chain, isWarn) {
            var rowCls = isWarn ?
                ' style="background:#fffbeb;border-left:3px solid #f59e0b;"' :
                '';
            return '<tr' + rowCls + '>' +
                '<td class="font-medium">' + role +
                    (isWarn ? ' <span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-200 text-amber-900 ml-1" title="Bridge admin posture is one tier weaker than token admin. 3-of-6 quorum can change rate limits, add chain peers, swap RMN/router, or set rebalancer instantly.">⚠ structural</span>' : '') +
                '</td>' +
                '<td>' + ApyxRenderer._addrCell(addr, chain) + '</td>' +
                '<td class="text-xs">' + (threshold || '—') + '</td>' +
                '<td class="text-xs">' + (timelock || '—') + '</td>' +
                '<td class="text-xs text-slate-500">' + (notes || '') + '</td>' +
            '</tr>';
        }

        var adminDelayH = (g.target_admin_delay_seconds != null) ? (g.target_admin_delay_seconds / 3600) : null;
        var adminTimelock = adminDelayH != null ? adminDelayH + 'h via AccessManager' : '—';

        var rows = '';
        rows += trow('ADMIN Safe (root admin)',
            g.admin_safe, g.admin_threshold, adminTimelock,
            'Holds ADMIN_ROLE; governs token contracts', 'ethereum', false);
        rows += trow('MAINTAINER Safe (bridge owner)',
            g.maintainer_safe, g.maintainer_threshold, 'None (Ownable, no delay)',
            'Owns CCIP pools — can change rate limits / peers / RMN / router instantly', 'ethereum', true);
        rows += trow('AccessManager',
            g.access_manager, '—', '—',
            'OZ AccessManager; authority for apxUSD / apyUSD / UnlockToken / AddressList', 'ethereum', false);

        // Maintainer warning callout
        var maintainerCallout =
            '<div class="risk-flag risk-warning mt-3">' +
                '<strong>Bridge admin gap (structural):</strong> the MAINTAINER Safe owning the CCIP pools is ' +
                '3-of-6 with <strong>no timelock</strong>, while the token-level ADMIN Safe is 4-of-6 with a ' +
                (adminDelayH != null ? adminDelayH + 'h' : '72h') + ' AccessManager delay. ' +
                '3 signatures can re-configure rate limits, add chain peers, swap RMN/router, or set a ' +
                'rebalancer with no review window. On-chain rate limits + Chainlink-canonical RMN provide ' +
                'operational containment but do not eliminate this asymmetry.' +
            '</div>';

        var auditLine =
            '<div class="text-sm text-slate-600 mt-3 pt-3 border-t border-slate-200">' +
                'Audits: <strong>' + APYX_AUDITS.primary_audits + '</strong> (' + APYX_AUDITS.total_audits + ' total) · ' +
                'Bug bounty: <strong>' + APYX_AUDITS.bug_bounty + '</strong>' +
            '</div>';

        return '<div class="panel">' +
            '<div class="panel-title">Trust Stack</div>' +
            '<div class="data-table-scroll">' +
                '<table class="data-table">' +
                    '<thead><tr>' +
                        '<th>Role</th><th>Address</th><th>Threshold</th><th>Timelock</th><th>Notes</th>' +
                    '</tr></thead>' +
                    '<tbody>' + rows + '</tbody>' +
                '</table>' +
            '</div>' +
            maintainerCallout +
            auditLine +
        '</div>';
    },

    // ============================================================
    // §7 Family panel (async)
    // ============================================================
    _loadFamilyPanel: function(currentSlug) {
        var target = document.getElementById('apyx-family-panel');
        if (!target) return;
        var nocache = Math.floor(Date.now() / 60000);
        fetch('data/apyx_family.json?nocache=' + nocache)
            .then(function(r) { return r.ok ? r.json() : null; })
            .then(function(fam) {
                if (!fam) {
                    target.innerHTML = '';
                    return;
                }
                target.innerHTML = ApyxRenderer._renderFamilyHtml(fam, currentSlug);
            })
            .catch(function() { target.innerHTML = ''; });
    },

    _renderFamilyHtml: function(fam, currentSlug) {
        var tokens = fam.tokens || [];
        var bt = fam.bridge_topology || {};
        var ba = fam.backing_attestation || {};
        var ct = fam.custody_topology || {};

        // ----- Cross-asset comparison row -----
        function tokenCard(t) {
            var isCurrent = (t.slug === currentSlug);
            var hiCls = isCurrent ? 'border-blue-400 ring-1 ring-blue-200' : '';
            var lines = [];
            lines.push('<div class="text-xs text-slate-400 uppercase font-medium">' + t.name + '</div>');
            if (t.slug === 'apxusd') {
                lines.push('<div class="text-base font-bold text-slate-800 mt-1">' + CommonRenderer.formatCurrency(t.supply_usd) + ' supply</div>');
                lines.push('<div class="text-xs text-slate-500">NAV ' + (t.nav != null ? t.nav.toFixed(4) : '—') + ' · CR ' + (t.collateral_ratio_pct != null ? t.collateral_ratio_pct.toFixed(2) + '%' : '—') + '</div>');
            } else {
                lines.push('<div class="text-base font-bold text-slate-800 mt-1">' + ApyxRenderer._formatShares(t.supply_shares) + '</div>');
                lines.push('<div class="text-xs text-slate-500">NAV ' + (t.nav != null ? t.nav.toFixed(4) : '—') + ' · TVL ' + CommonRenderer.formatCurrency(t.tvl_usd) + '</div>');
                if (t.capture_ratio_pct != null) {
                    lines.push('<div class="text-xs text-indigo-600 mt-1">Captures ' + t.capture_ratio_pct.toFixed(1) + '% of apxUSD</div>');
                }
            }
            return '<a href="?asset=' + t.slug + '" class="summary-card block hover:shadow-sm transition-shadow ' + hiCls + '">' +
                lines.join('') +
            '</a>';
        }

        var tokenRow =
            '<div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">' +
                tokens.map(tokenCard).join('') +
            '</div>';

        // ----- Bridge integrity dashboard -----
        function consCard(slug, name, c) {
            if (!c) {
                return '<div class="summary-card"><div class="text-xs text-slate-400 uppercase font-medium">' + name + '</div>' +
                    '<div class="text-sm text-slate-500 mt-2 italic">data unavailable</div></div>';
            }
            var state = c.match ? 'ok' : 'critical';
            var lockedTok = ApyxRenderer._rawToTokens(c.locked_eth_raw);
            var baseTok = ApyxRenderer._rawToTokens(c.supply_base_raw);
            var diffTok = ApyxRenderer._rawToTokens(c.diff_raw);
            var isApyShare = (slug === 'apyusd');
            function fmtTok(v) {
                if (v == null) return '—';
                return isApyShare ?
                    ApyxRenderer._formatToken(v, 4) + ' sh' :
                    CommonRenderer.formatCurrency(v);
            }
            return '<div class="summary-card">' +
                '<div class="flex items-center justify-between">' +
                    '<div class="text-xs text-slate-400 uppercase font-medium">' + name + ' conservation</div>' +
                    ApyxRenderer._statusPill(c.match ? 'Match' : 'Drift', state) +
                '</div>' +
                '<div class="grid grid-cols-2 gap-2 mt-2 text-xs">' +
                    '<div><span class="text-slate-500">Locked-ETH</span><div class="font-mono">' + fmtTok(lockedTok) + '</div></div>' +
                    '<div><span class="text-slate-500">Base supply</span><div class="font-mono">' + fmtTok(baseTok) + '</div></div>' +
                '</div>' +
                (!c.match && diffTok != null ? '<div class="text-xs mt-2 text-red-700">Diff: <span class="font-mono">' + fmtTok(diffTok) + '</span></div>' : '') +
            '</div>';
        }

        var anyBreach = bt.any_breach === true;
        var combinedBanner =
            (anyBreach ?
                '<div class="risk-flag risk-warning mb-3"><strong>Bridge family — drift detected on one or more pools.</strong> See per-pool detail below; CCIP finality typically resolves transient drift within 30 min.</div>'
                :
                '<div class="risk-flag mb-3" style="background:#dcfce7;color:#166534;border-left:4px solid #22c55e;"><strong>Bridge family — all conservation invariants satisfied.</strong></div>'
            );

        var bridgeBlock =
            '<div class="mt-4">' +
                '<div class="text-sm font-semibold text-slate-700 mb-2">Bridge integrity dashboard</div>' +
                combinedBanner +
                '<div class="grid grid-cols-1 md:grid-cols-2 gap-3">' +
                    consCard('apxusd', 'apxUSD', bt.apxusd_conservation) +
                    consCard('apyusd', 'apyUSD', bt.apyusd_conservation) +
                '</div>' +
                '<div class="text-xs text-slate-500 mt-2">' +
                    'Owner Safe: ' + ApyxRenderer._addrCell(bt.owner_safe, 'ethereum') +
                    ' · threshold ' + (bt.owner_threshold || '—') +
                    ' · timelock ' + (bt.owner_timelock_seconds === 0 ? 'none' : (bt.owner_timelock_seconds || '—')) +
                '</div>' +
            '</div>';

        // ----- Shared backing summary -----
        var backingState = ba.fetch_status === 'ok' ? 'ok' : 'critical';
        var backingBlock =
            '<div class="mt-4">' +
                '<div class="text-sm font-semibold text-slate-700 mb-2">Shared backing</div>' +
                '<div class="flex flex-wrap items-center gap-2">' +
                    ApyxRenderer._statusPill('Accountable feed', backingState, ba.source || '—') +
                    ApyxRenderer._statusPill('Collateralization', (ba.collateralization_pct != null && ba.collateralization_pct >= 100) ? 'ok' : 'critical',
                        (ba.collateralization_pct != null) ? ba.collateralization_pct.toFixed(2) + '%' : '—') +
                    '<span class="text-xs text-slate-500">Reserves ' + CommonRenderer.formatCurrency(ba.total_reserves_usd) + ' · same feed powers both tokens</span>' +
                '</div>' +
            '</div>';

        // ----- Custody topology summary -----
        var custodyBlock = '';
        if (ct.entries && ct.entries.length) {
            var entryRows = ct.entries.map(function(e) {
                return '<tr>' +
                    '<td class="font-medium text-xs">' + (e.role || '—') + '</td>' +
                    '<td>' + ApyxRenderer._addrCell(e.address, 'ethereum') + '</td>' +
                    '<td class="text-xs text-slate-500">' + (e.control_type || '—') +
                        (e.timelock_seconds != null ? ' · timelock ' + (e.timelock_seconds === 0 ? 'none' : Math.round(e.timelock_seconds / 3600) + 'h') : '') +
                    '</td>' +
                '</tr>';
            }).join('');
            custodyBlock =
                '<div class="mt-4">' +
                    '<div class="text-sm font-semibold text-slate-700 mb-2">Shared governance topology</div>' +
                    '<table class="data-table"><tbody>' + entryRows + '</tbody></table>' +
                '</div>';
        }

        return '<div class="panel">' +
            '<div class="panel-title">Apyx Family — cross-asset snapshot</div>' +
            tokenRow +
            bridgeBlock +
            backingBlock +
            custodyBlock +
            '<div class="text-xs text-slate-400 mt-3">As of ' + CommonRenderer.formatDate(fam.timestamp || fam.as_of) + ' · self-computed.</div>' +
        '</div>';
    }
};
