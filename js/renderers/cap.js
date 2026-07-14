/**
 * Cap renderer — cUSD (over-reserved stablecoin) + its stcUSD yield vault.
 *
 * Cap's model: cUSD is minted 1:1 against a shared reserve vault (USDC + an
 * RWA money-market token). The vault re-lends those reserves to a whitelisted
 * set of *operators* (Bedrock, market-makers) whose borrows are backstopped by
 * *restaker* first-loss collateral delegated through Symbiotic. So the trust
 * chain is: cUSD ← reserve coverage ← operator health ← restaker coverage.
 * Price is a weak signal here — cUSD trades DEX-only on ~$6k/24h, so coverage
 * and operator/restaker health are the headline health metrics, not the peg.
 *
 * Data sources (mirrors the Ethena split):
 *   - data/cusd_backing.json          (common schema — drives the common
 *                                       summary/risk/coverage-chart path)
 *   - data/cusd_backing_history.json  (coverage / peg / util time-series)
 *   - data/cap_family.json            (async — peg quotes, reserve composition,
 *                                       operator book, restaker coverage,
 *                                       stcUSD, contracts, risk flags)
 *
 * Display hygiene (the data has known traps — see the handoff spec):
 *   - peg.peg_signal_gated: cUSD's DEX pool is thin; a thin GeckoTerminal quote
 *     prints ~$0.958 while the real peg is ~$0.9998. When gated we render an
 *     "indicative" tile and NEVER a red CRITICAL off price, and drop/grey thin
 *     quotes.
 *   - Coverage 99.98% is USDC's oracle mark ($0.99979), not a shortfall — the
 *     stablecoin-mark band (>=99.5%) renders at-par, not alarmed.
 *   - Operator table: 27 of 42 operators carry $0 (health renders ~1e50) or
 *     dust debt (one is health 0.12 on $679). We apply a $10k min-debt floor
 *     and surface that the Bedrock operator is ~45% of borrows.
 *
 * Constants are CAP_-prefixed and charts live on window._cap* per the renderer
 * global-scope convention (bare names collide across renderer files).
 */

var CAP_THRESHOLDS = {
    coverage_at_par:   99.5,   // % — USDC-oracle-mark band; >= reads at-par
    coverage_floor:    98.0,   // % — below this is a genuine shortfall
    util_warn:         80.0,   // % vault utilization — redemptions may delay
    util_crit:         95.0,
    operator_min_debt: 10000,  // $ — hide operators below this (dust / $0)
    hf_warn:           1.50,   // health factor — approaching liquidation
    hf_crit:           1.15,
    liq_threshold:     0.80    // operator LTV liquidation threshold
};

var CAP_OFFICIAL = 'https://cap.app';

var CapRenderer = {

    // ============================================================
    // helpers
    // ============================================================
    _isCap: function(data) {
        return (data && (data.view_slug === 'cusd' ||
            (data.summary && data.summary.asset === 'cUSD')));
    },

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

    _explorerLink: function(addr, label) {
        if (!addr) return '';
        return '<a href="https://etherscan.io/address/' + addr + '" target="_blank" ' +
            'rel="noopener noreferrer" class="text-blue-500 hover:underline text-xs" title="' + addr + '">' +
            (label || '↗') + '</a>';
    },

    _statusDot: function(state) {
        var color = state === 'ok' ? '#22c55e' : state === 'warn' ? '#f59e0b'
            : state === 'critical' ? '#ef4444' : '#94a3b8';
        return '<span class="inline-block w-2 h-2 rounded-full align-middle" style="background:' + color + '"></span>';
    },

    _statusPill: function(label, state, extra) {
        var bg, fg;
        if (state === 'ok') { bg = 'bg-green-100'; fg = 'text-green-800'; }
        else if (state === 'warn') { bg = 'bg-amber-100'; fg = 'text-amber-800'; }
        else if (state === 'critical') { bg = 'bg-red-100'; fg = 'text-red-800'; }
        else { bg = 'bg-slate-100'; fg = 'text-slate-700'; }
        return '<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ' + bg + ' ' + fg + '">' +
            CapRenderer._statusDot(state) +
            '<span>' + label + (extra ? ' <span class="font-mono">' + extra + '</span>' : '') + '</span>' +
        '</span>';
    },

    _anchor: function(id, html) {
        if (!html || typeof html !== 'string') return html;
        return html.replace(/^(<div class="panel")/, '<div id="' + id + '" class="panel"');
    },

    _rgba: function(hex, a) {
        var h = hex.replace('#', '');
        var r = parseInt(h.substring(0, 2), 16), g = parseInt(h.substring(2, 4), 16), b = parseInt(h.substring(4, 6), 16);
        return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
    },

    _set: function(id, html) { var el = document.getElementById(id); if (el) el.innerHTML = html; },

    // Health-factor severity. HF = liquidation_threshold / LTV; HF→1 means at
    // the liquidation line. Dust/$0-debt operators render ~1e50 (filtered out
    // upstream so they never reach the color map).
    _hfState: function(hf) {
        if (hf == null) return 'neutral';
        if (hf < CAP_THRESHOLDS.hf_crit) return 'critical';
        if (hf < CAP_THRESHOLDS.hf_warn) return 'warn';
        return 'ok';
    },

    _coverageState: function(pct) {
        if (pct == null) return 'neutral';
        if (pct >= CAP_THRESHOLDS.coverage_at_par) return 'ok';
        if (pct >= CAP_THRESHOLDS.coverage_floor) return 'warn';
        return 'critical';
    },

    // ============================================================
    // pre-render — runs before common.js paints the summary row / chart.
    // cusd_backing.json carries the common schema *shape* but not the exact
    // fields common.js reads (collateral_ratio_alt, backing_breakdown tags),
    // so neutralize those to avoid NPEs, then repurpose the common CR chart as
    // a Coverage chart off the coverage_pct history series.
    // ============================================================
    preRender: function(data, history) {
        if (!CapRenderer._isCap(data)) return;
        var s = data.summary;
        if (!s) return;

        // renderSummaryCards() dereferences s.collateral_ratio_alt.label — cUSD
        // doesn't emit it. Backfill a hidden placeholder + hide the derived
        // legacy cards (we render a bespoke headline instead; the whole
        // summary-cards row is hidden in _suppressCommonPanels anyway).
        if (!s.collateral_ratio_alt) {
            s.collateral_ratio_alt = { label: '_capAlt', value: 0, is_currency: false };
        }
        var specific = data.asset_specific = data.asset_specific || {};
        specific.card_overrides = specific.card_overrides || {};
        specific.card_overrides['_capAlt'] = { hidden: true };
        specific.card_overrides['Surplus / Deficit'] = { hidden: true };

        // The common breakdown table/pie read item.tags/item.label/item.value —
        // cUSD's backing_breakdown uses name/value_usd and carries no tags.
        // Clear it (we render a bespoke Reserve Composition panel) so the common
        // table/pie render empty and are then hidden.
        data.backing_breakdown = [];

        // Prettier header chain label ("ethereum" -> "Ethereum").
        if (data.chain === 'ethereum') data.chain = 'Ethereum';

        // Repurpose the common CR chart as a Coverage chart. The history feed
        // carries coverage_pct (~99.98) but not collateral_ratio; remap so
        // common.renderCRChart plots it. Band frames >=99.5% as at-par (the
        // stablecoin-oracle-mark band), not a shortfall.
        if (history && Array.isArray(history.entries)) {
            history.entries.forEach(function(e) {
                if (e.collateral_ratio == null && e.coverage_pct != null) {
                    e.collateral_ratio = e.coverage_pct;
                }
            });
        }
        specific.chart_title = 'Reserve Coverage — reserves vs cUSD supply';
        specific.chart_dataset_label = 'Coverage %';
        specific.chart_y_min = 99;
        specific.chart_y_max = 100.5;
        specific.chart_bands = {
            critical: [0, 98],
            thin:     [98, 99],
            amber:    [99, 99.5],
            healthy:  [99.5, 101],
            min_line: 99.5,
            max_line: 100
        };
    },

    // ============================================================
    // entry point
    // ============================================================
    render: function(data) {
        var container = document.getElementById('asset-specific-panels');
        if (!container || !CapRenderer._isCap(data)) return;
        var s = data.summary || {};

        CapRenderer._suppressCommonPanels();

        var anc = CapRenderer._anchor;
        var html = '';
        html += anc('panel-headline', CapRenderer._renderHeadline(data, s));
        html += anc('panel-utilization', CapRenderer._renderUtilization(s));
        // Async-filled placeholders (all from cap_family.json):
        html += '<div id="cap-reserve-panel"></div>';
        html += '<div id="cap-operators-panel"></div>';
        html += '<div id="cap-restaker-panel"></div>';
        html += '<div id="cap-stcusd-panel"></div>';
        html += '<div id="cap-peg-panel"></div>';
        html += '<div id="cap-riskflags-panel"></div>';
        html += anc('panel-model', CapRenderer._renderModelNote());
        html += '<div id="cap-centralization-panel"></div>';

        container.innerHTML = html;

        CapRenderer._setupAnchorNav();
        CapRenderer._loadFamily();
    },

    _suppressCommonPanels: function() {
        // Legacy mode (no peg block → hasAxisBlocks false). Hide the legacy CR
        // summary cards — we render a bespoke headline.
        var summaryCards = document.getElementById('summary-cards');
        if (summaryCards) summaryCards.style.display = 'none';

        // Hide the common backing breakdown table + allocation pie (we render a
        // bespoke Reserve Composition panel) and the common risk-flags panel (we
        // render a bespoke strip). Keep #chart-panel — it's the Coverage chart.
        ['breakdown-table', 'pie-chart', 'risk-flags'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) { var p = el.closest('.panel'); if (p) p.style.display = 'none'; }
        });
    },

    // ============================================================
    // §1 Headline
    // ============================================================
    _renderHeadline: function(data, s) {
        var covPct = s.coverage_pct;
        var covState = CapRenderer._coverageState(covPct);
        var covCls = covState === 'ok' ? 'text-green-600' : covState === 'warn' ? 'text-amber-600' : 'text-red-600';

        return '<div class="panel">' +
            '<div class="flex items-start justify-between gap-4">' +
                '<div>' +
                    '<div class="text-xl font-bold text-slate-800">cUSD</div>' +
                    '<div class="text-xs text-slate-500 mt-1">Cap · Over-reserved stablecoin re-lent to restaker-backed operators</div>' +
                '</div>' +
                '<div class="text-right text-xs">' +
                    '<a href="' + CAP_OFFICIAL + '" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline">cap.app ↗</a>' +
                    '<div class="text-slate-400 mt-1 max-w-[15rem]">Coverage + operator/restaker health are the headline signals — cUSD trades DEX-only on thin liquidity, so price is secondary.</div>' +
                '</div>' +
            '</div>' +
            '<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">' +
                '<div><div class="text-xs text-slate-400 font-medium uppercase">Supply</div>' +
                    '<div class="text-lg font-bold text-slate-800">' + CapRenderer._money(s.total_supply) + '</div>' +
                    '<div class="text-xs text-slate-500 mt-0.5">cUSD outstanding</div></div>' +
                '<div><div class="text-xs text-slate-400 font-medium uppercase">Reserve coverage</div>' +
                    '<div class="text-lg font-bold ' + covCls + '">' + CommonRenderer.formatPercent(covPct, 2) + '</div>' +
                    '<div class="text-xs text-slate-500 mt-0.5">' +
                        (covState === 'ok' ? 'at par · USDC oracle mark' : 'below par') + '</div></div>' +
                '<div><div class="text-xs text-slate-400 font-medium uppercase">Peg</div>' +
                    '<div id="cap-headline-peg" class="text-lg font-bold text-slate-400">—</div></div>' +
                '<div><div class="text-xs text-slate-400 font-medium uppercase">Total backing</div>' +
                    '<div class="text-lg font-bold text-slate-800">' + CapRenderer._money(s.total_backing) + '</div>' +
                    '<div class="text-xs text-slate-500 mt-0.5">reserve value</div></div>' +
            '</div>' +
            '<div class="text-xs text-slate-500 mt-3">' +
                'Coverage is reserve value ÷ cUSD supply. The sub-100% reading is USDC marked at its oracle price ' +
                '($0.9998), not a reserve shortfall — this reads <span class="font-medium text-green-600">at par</span>.' +
            '</div>' +
        '</div>';
    },

    // ============================================================
    // §2 Utilization / redemption headroom
    // ============================================================
    _renderUtilization: function(s) {
        var utilPct = (s.max_utilization != null) ? s.max_utilization * 100 : null;
        var state = utilPct == null ? 'neutral'
            : utilPct >= CAP_THRESHOLDS.util_crit ? 'critical'
            : utilPct >= CAP_THRESHOLDS.util_warn ? 'warn' : 'ok';
        var barCls = state === 'ok' ? '#22c55e' : state === 'warn' ? '#f59e0b' : '#ef4444';
        var w = utilPct != null ? Math.max(0, Math.min(100, utilPct)) : 0;
        var headroom = utilPct != null ? (100 - utilPct) : null;
        var borrowed = s.total_borrows_usd;

        return '<div class="panel">' +
            '<div class="panel-title">Vault Utilization <span class="text-xs font-normal text-slate-400">— redemption headroom</span></div>' +
            '<div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">' +
                '<div><div class="text-xs text-slate-400 font-medium uppercase">Utilization</div>' +
                    '<div class="text-lg font-bold" style="color:' + barCls + '">' + CommonRenderer.formatPercent(utilPct, 1) + '</div></div>' +
                '<div><div class="text-xs text-slate-400 font-medium uppercase">Borrowed by operators</div>' +
                    '<div class="text-lg font-bold text-slate-800">' + CapRenderer._money(borrowed) + '</div></div>' +
                '<div><div class="text-xs text-slate-400 font-medium uppercase">Free headroom</div>' +
                    '<div class="text-lg font-bold text-slate-800">' + (headroom != null ? headroom.toFixed(1) + '%' : '—') + '</div>' +
                    '<div id="cap-util-available" class="text-xs text-slate-500 mt-0.5"></div></div>' +
            '</div>' +
            '<div class="flex w-full h-6 rounded overflow-hidden" style="background:#e2e8f0">' +
                '<div style="width:' + w + '%;background:' + barCls + '" title="Borrowed ' + CommonRenderer.formatPercent(utilPct, 1) + '"></div>' +
            '</div>' +
            '<div class="text-xs text-slate-400 mt-2">' +
                'High utilization means less reserve is instantly redeemable — redemptions above the free buffer wait for operators to repay. ' +
                'Warn above ' + CAP_THRESHOLDS.util_warn + '%.' +
            '</div>' +
        '</div>';
    },

    // ============================================================
    // family JSON — fills reserve / operators / restaker / stcUSD / peg /
    // risk / centralization (+ the headline peg tile).
    // ============================================================
    _loadFamily: function() {
        var nocache = Math.floor(Date.now() / 60000);
        fetch('data/cap_family.json?nocache=' + nocache)
            .then(function(r) { return r.ok ? r.json() : null; })
            .then(function(fam) {
                if (!fam) { CapRenderer._familyUnavailable(); return; }
                CapRenderer._fillPegHeadline(fam);
                CapRenderer._fillReserve(fam);
                CapRenderer._fillOperators(fam);
                CapRenderer._fillRestaker(fam);
                CapRenderer._fillStcusd(fam);
                CapRenderer._fillPeg(fam);
                CapRenderer._fillRiskFlags(fam);
                CapRenderer._fillCentralization(fam);
                // charts (canvases now exist)
                CapRenderer._drawReserveDonut(fam);
            })
            .catch(function() { CapRenderer._familyUnavailable(); });
    },

    _familyUnavailable: function() {
        var el = document.getElementById('cap-reserve-panel');
        if (el) el.innerHTML = '<div class="panel"><div class="panel-title">Reserve Composition</div>' +
            '<div class="risk-flag risk-warning">Shared Cap data (cap_family.json) is not available in this snapshot.</div></div>';
    },

    // ----- headline peg tile (thin-liquidity gated) -----
    _fillPegHeadline: function(fam) {
        var peg = fam.peg || {};
        var el = document.getElementById('cap-headline-peg');
        if (!el) return;
        var price = peg.market_price;
        var bps = peg.deviation_bps;
        var gated = peg.peg_signal_gated === true;
        // Never a red CRITICAL off price here. Gated → neutral "indicative".
        el.className = 'text-lg font-bold ' + (gated ? 'text-slate-600' : (Math.abs(bps || 0) < 25 ? 'text-green-600' : 'text-amber-600'));
        el.innerHTML = '$' + (price != null ? price.toFixed(4) : '—');
        var sub = document.createElement('div');
        sub.className = 'text-xs text-slate-500 mt-0.5';
        sub.innerHTML = (bps != null ? (bps >= 0 ? '+' : '') + bps.toFixed(0) + ' bps · ' : '') +
            (gated ? 'indicative (thin liq.)' : 'peg');
        el.parentNode.appendChild(sub);
    },

    // ----- §3 Reserve composition -----
    _fillReserve: function(fam) {
        var rc = fam.reserve_composition || {};
        var assets = (rc.assets || []).slice().sort(function(a, b) { return (b.total_supplies_usd || 0) - (a.total_supplies_usd || 0); });
        var iv = rc.idle_vs_deployed || {};
        var palette = ['#6366f1', '#14b8a6', '#f59e0b', '#ec4899', '#3b82f6'];

        // Update the utilization panel's "available" line now that we have the $.
        var availEl = document.getElementById('cap-util-available');
        if (availEl && iv.idle_or_available_usd != null) {
            availEl.textContent = '≈' + CapRenderer._money(iv.idle_or_available_usd) + ' available';
        }

        var rows = assets.map(function(a, i) {
            var color = palette[i % palette.length];
            return '<tr>' +
                '<td class="font-medium"><span class="inline-block w-2.5 h-2.5 rounded-sm mr-2 align-middle" style="background:' + color + '"></span>' +
                    (a.symbol || '—') + ' ' + CapRenderer._explorerLink(a.asset) + '</td>' +
                '<td class="text-right font-mono">' + CommonRenderer.formatCurrencyExact(a.total_supplies_usd) + '</td>' +
                '<td class="text-right font-mono">' + (a.pct_of_reserves != null ? a.pct_of_reserves.toFixed(2) : '-') + '%</td>' +
                '<td class="text-right font-mono">' + (a.utilization_pct != null ? a.utilization_pct.toFixed(1) + '%' : '—') + '</td>' +
                '<td class="text-right font-mono text-slate-500">$' + (a.oracle_price_usd != null ? a.oracle_price_usd.toFixed(4) : '—') + '</td>' +
            '</tr>';
        }).join('');

        // idle-vs-deployed stacked bar (borrowed by operators vs available reserve).
        var borrowed = iv.borrowed_by_agents_usd || 0;
        var avail = iv.idle_or_available_usd || 0;
        var totalIV = borrowed + avail;
        var bPct = totalIV > 0 ? (borrowed / totalIV * 100) : 0;
        var aPct = totalIV > 0 ? (avail / totalIV * 100) : 0;

        CapRenderer._set('cap-reserve-panel',
            '<div class="panel">' +
                '<div class="panel-title">Reserve Composition <span class="text-xs font-normal text-slate-400">— ' + CapRenderer._money(rc.total_reserves_usd) + ' backing cUSD</span></div>' +
                '<div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-center mb-4">' +
                    '<div style="height:180px;position:relative;"><canvas id="cap-reserve-donut"></canvas></div>' +
                    '<div class="md:col-span-2">' +
                        '<table class="data-table"><thead><tr><th>Asset</th><th class="text-right">Value (USD)</th><th class="text-right">% reserves</th><th class="text-right">Util</th><th class="text-right">Oracle</th></tr></thead>' +
                        '<tbody>' + rows + '</tbody></table>' +
                    '</div>' +
                '</div>' +
                '<div class="text-sm font-semibold text-slate-700 mb-2">Idle vs deployed</div>' +
                '<div class="flex w-full h-6 rounded overflow-hidden mb-2" style="gap:1px;background:#e2e8f0">' +
                    '<div style="width:' + bPct + '%;background:#f59e0b" title="Borrowed by operators"></div>' +
                    '<div style="width:' + aPct + '%;background:#22c55e" title="Available / idle reserve"></div>' +
                '</div>' +
                '<div class="flex gap-4 text-xs text-slate-500">' +
                    '<span><span class="inline-block w-2.5 h-2.5 rounded-sm mr-1 align-middle" style="background:#f59e0b"></span>Borrowed by operators ' + CapRenderer._money(borrowed) + '</span>' +
                    '<span><span class="inline-block w-2.5 h-2.5 rounded-sm mr-1 align-middle" style="background:#22c55e"></span>Available / idle ' + CapRenderer._money(avail) + '</span>' +
                '</div>' +
                '<div class="text-xs text-slate-400 mt-2">Idle reserve is loaned to fractional-reserve vaults (Aave/Morpho-style) to earn yield while staying redeemable; ' +
                    'deployed reserve is borrowed by whitelisted operators (see below).</div>' +
            '</div>');
    },

    _drawReserveDonut: function(fam) {
        var ctx = document.getElementById('cap-reserve-donut');
        if (!ctx || typeof Chart === 'undefined') return;
        var assets = ((fam.reserve_composition || {}).assets || []).filter(function(a) { return (a.total_supplies_usd || 0) > 0; });
        var palette = ['#6366f1', '#14b8a6', '#f59e0b', '#ec4899', '#3b82f6'];
        if (window._capReserveDonut) window._capReserveDonut.destroy();
        window._capReserveDonut = new Chart(ctx, {
            type: 'doughnut',
            data: { labels: assets.map(function(a) { return a.symbol; }),
                datasets: [{ data: assets.map(function(a) { return a.total_supplies_usd; }),
                    backgroundColor: assets.map(function(a, i) { return palette[i % palette.length]; }), borderWidth: 0 }] },
            options: { responsive: true, maintainAspectRatio: false, cutout: '55%',
                plugins: { legend: { display: false },
                    tooltip: { callbacks: { label: function(c) {
                        var t = c.dataset.data.reduce(function(a, b) { return a + b; }, 0);
                        return c.label + ': ' + CommonRenderer.formatCurrencyExact(c.raw) + ' (' + (t > 0 ? (c.raw / t * 100).toFixed(1) : '0') + '%)';
                    } } } } }
        });
    },

    // ----- §4 Operator book -----
    _fillOperators: function(fam) {
        var ob = fam.operator_book || {};
        var all = (ob.operators || []).slice();
        var totalBorrows = (fam.summary && fam.summary.total_borrows_usd) || 0;
        var MIN = CAP_THRESHOLDS.operator_min_debt;

        var material = all.filter(function(o) { return (o.total_debt_usd || 0) >= MIN; });
        var hidden = all.length - material.length;
        // Sort riskiest first (lowest health among the material book).
        material.sort(function(a, b) { return (a.health_factor || 0) - (b.health_factor || 0); });

        // Concentration: largest operator's share of total borrows.
        var largest = all.slice().sort(function(a, b) { return (b.total_debt_usd || 0) - (a.total_debt_usd || 0); })[0];
        var concPct = (largest && totalBorrows > 0) ? (largest.total_debt_usd / totalBorrows * 100) : null;
        var concLabel = largest ? (largest.label || CapRenderer._truncAddr(largest.agent)) : '';
        var concState = concPct == null ? 'neutral' : concPct >= 40 ? 'warn' : 'ok';

        var rows = material.map(function(o) {
            var hf = o.health_factor;
            var st = CapRenderer._hfState(hf);
            var hfCls = st === 'ok' ? 'text-green-600' : st === 'warn' ? 'text-amber-600' : 'text-red-600';
            var name = o.label
                ? '<span class="font-medium">' + o.label + '</span>'
                : '<span class="font-mono text-xs">' + CapRenderer._truncAddr(o.agent) + '</span>';
            var pctBorrows = totalBorrows > 0 ? (o.total_debt_usd / totalBorrows * 100) : null;
            return '<tr>' +
                '<td>' + name + ' ' + CapRenderer._explorerLink(o.agent) + '</td>' +
                '<td class="text-right font-mono">' + CapRenderer._money(o.total_debt_usd) +
                    (pctBorrows != null ? ' <span class="text-xs text-slate-400">' + pctBorrows.toFixed(0) + '%</span>' : '') + '</td>' +
                '<td class="text-right font-mono">' + CapRenderer._money(o.total_delegation_usd) + '</td>' +
                '<td class="text-right font-mono">' + (o.ltv != null ? (o.ltv * 100).toFixed(1) + '%' : '—') + '</td>' +
                '<td class="text-right font-mono ' + hfCls + '">' + (hf != null ? hf.toFixed(2) : '—') + '</td>' +
            '</tr>';
        }).join('');

        var concCallout = concPct != null
            ? '<div class="risk-flag mb-3" style="background:' + (concState === 'warn' ? '#fffbeb' : '#eff6ff') + ';color:' +
                  (concState === 'warn' ? '#92400e' : '#1e40af') + ';border-left:4px solid ' + (concState === 'warn' ? '#f59e0b' : '#3b82f6') + ';">' +
                  '<span class="font-medium">' + concLabel + '</span> is <span class="font-mono">' + concPct.toFixed(1) + '%</span> of all operator borrows ' +
                  '(' + CapRenderer._money(largest.total_debt_usd) + ' of ' + CapRenderer._money(totalBorrows) + '). ' +
                  'Single-operator concentration is the dominant credit exposure — its health, not the aggregate, drives tail risk.</div>'
            : '';

        CapRenderer._set('cap-operators-panel',
            '<div class="panel">' +
                '<div class="panel-title">Operator Book <span class="text-xs font-normal text-slate-400">— ' + material.length + ' material borrowers · ' + (ob.source || '') + '</span></div>' +
                concCallout +
                '<div class="data-table-scroll"><table class="data-table">' +
                    '<thead><tr><th>Operator</th><th class="text-right">Debt</th><th class="text-right">Delegation</th><th class="text-right">LTV</th><th class="text-right" title="liquidation_threshold ÷ LTV; →1 = at liquidation">Health</th></tr></thead>' +
                    '<tbody>' + rows + '</tbody></table></div>' +
                '<div class="text-xs text-slate-400 mt-2">Sorted riskiest-first by health factor (HF = ' + CAP_THRESHOLDS.liq_threshold.toFixed(2) +
                    ' liquidation-threshold ÷ LTV; <span class="text-red-600 font-medium">&lt;' + CAP_THRESHOLDS.hf_crit.toFixed(2) + '</span> critical, ' +
                    '<span class="text-amber-600 font-medium">&lt;' + CAP_THRESHOLDS.hf_warn.toFixed(2) + '</span> watch). ' +
                    hidden + ' operators with &lt;' + CapRenderer._money(MIN) + ' debt (mostly $0-borrow delegations) are hidden.</div>' +
            '</div>');
    },

    // ----- §5 Restaker coverage -----
    _fillRestaker: function(fam) {
        var rc = fam.restaker_coverage || {};
        var ratio = rc.coverage_to_debt_ratio;
        var cov = rc.total_coverage_usd, slash = rc.total_slashable_collateral_usd, debt = rc.total_debt_usd;
        var state = ratio == null ? 'neutral' : ratio >= 2 ? 'ok' : ratio >= 1 ? 'warn' : 'critical';
        var ratioCls = state === 'ok' ? 'text-green-600' : state === 'warn' ? 'text-amber-600' : 'text-red-600';

        // Coverage-vs-debt bar (capped display at a sane multiple so the debt
        // sliver stays visible).
        var covW = 100, debtW = (cov > 0 && debt != null) ? Math.max(2, Math.min(100, debt / cov * 100)) : 0;

        var eigen = rc.eigenlayer || {};
        var notes = [];
        if (rc.symbiotic_only_v1) notes.push('Symbiotic-only in v1');
        if (eigen.status) notes.push('EigenLayer ' + eigen.status + (eigen.reason ? ' (' + eigen.reason + ')' : ''));

        CapRenderer._set('cap-restaker-panel',
            '<div class="panel">' +
                '<div class="panel-title">Restaker Coverage <span class="text-xs font-normal text-slate-400">— credit-layer first-loss collateral</span></div>' +
                '<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">' +
                    '<div><div class="text-xs text-slate-400 font-medium uppercase">Coverage ÷ debt</div>' +
                        '<div class="text-lg font-bold ' + ratioCls + '">' + (ratio != null ? ratio.toFixed(2) + '×' : '—') + '</div></div>' +
                    '<div><div class="text-xs text-slate-400 font-medium uppercase">Total coverage</div>' +
                        '<div class="text-lg font-bold text-slate-800">' + CapRenderer._money(cov) + '</div></div>' +
                    '<div><div class="text-xs text-slate-400 font-medium uppercase">Slashable collateral</div>' +
                        '<div class="text-lg font-bold text-slate-800">' + CapRenderer._money(slash) + '</div></div>' +
                    '<div><div class="text-xs text-slate-400 font-medium uppercase">Operator debt</div>' +
                        '<div class="text-lg font-bold text-slate-800">' + CapRenderer._money(debt) + '</div></div>' +
                '</div>' +
                '<div class="relative w-full h-6 rounded overflow-hidden mb-2" style="background:' + CapRenderer._rgba('#22c55e', 0.18) + '">' +
                    '<div class="h-full" style="width:' + debtW + '%;background:#f59e0b" title="Debt covered"></div>' +
                '</div>' +
                '<div class="flex gap-4 text-xs text-slate-500">' +
                    '<span><span class="inline-block w-2.5 h-2.5 rounded-sm mr-1 align-middle" style="background:#22c55e"></span>Restaker coverage</span>' +
                    '<span><span class="inline-block w-2.5 h-2.5 rounded-sm mr-1 align-middle" style="background:#f59e0b"></span>Operator debt covered</span>' +
                '</div>' +
                '<div class="text-xs text-slate-400 mt-2">Aggregate ' + (ratio != null ? ratio.toFixed(2) + '×' : '—') +
                    ' coverage is robust, but it is <span class="font-medium">concentration-sensitive</span> — a single operator/restaker default draws on that operator\'s slice, not the pooled aggregate. ' +
                    (notes.length ? notes.join(' · ') + '.' : '') + '</div>' +
            '</div>');
    },

    // ----- §6 stcUSD NAV + APY -----
    _fillStcusd: function(fam) {
        var st = fam.stcusd || {};
        var apy = st.implied_apy || {};
        var bench = apy.benchmark_rate_apy, util = apy.utilization_rate_apy;
        var floorApy = (bench != null ? bench : 0) + (util != null ? util : 0);

        CapRenderer._set('cap-stcusd-panel',
            '<div class="panel">' +
                '<div class="panel-title">stcUSD <span class="text-xs font-normal text-slate-400">— staked cUSD yield vault</span></div>' +
                '<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">' +
                    '<div><div class="text-xs text-slate-400 font-medium uppercase">NAV / share</div>' +
                        '<div class="text-lg font-bold text-slate-800">' + (st.nav_cusd_per_share != null ? st.nav_cusd_per_share.toFixed(4) : '—') +
                        '<span class="text-xs text-slate-400 font-normal ml-1">cUSD</span></div></div>' +
                    '<div><div class="text-xs text-slate-400 font-medium uppercase">Vault assets</div>' +
                        '<div class="text-lg font-bold text-slate-800">' + CapRenderer._money(st.total_assets_cusd) + '</div>' +
                        '<div class="text-xs text-slate-500 mt-0.5">cUSD staked</div></div>' +
                    '<div><div class="text-xs text-slate-400 font-medium uppercase">Shares</div>' +
                        '<div class="text-lg font-bold text-slate-800">' + (st.total_supply != null ? (st.total_supply / 1e6).toFixed(1) + 'M' : '—') + '</div>' +
                        '<div class="text-xs text-slate-500 mt-0.5">stcUSD outstanding</div></div>' +
                    '<div><div class="text-xs text-slate-400 font-medium uppercase">On-chain rate floor</div>' +
                        '<div class="text-lg font-bold text-slate-800">' + (floorApy * 100).toFixed(2) + '%</div>' +
                        '<div class="text-xs text-slate-500 mt-0.5">benchmark + utilization</div></div>' +
                '</div>' +
                '<div class="risk-flag mb-0" style="background:#fffbeb;color:#92400e;border-left:4px solid #f59e0b;">' +
                    '<span class="font-medium">Novel-model caveat.</span> stcUSD holders sit <span class="font-medium">behind restaker first-loss collateral</span> — ' +
                    'they earn the operator lending spread, but if operator losses exceed restaker coverage, stcUSD absorbs the residual before cUSD. ' +
                    'The credit backstop is designed-but-unproven. ' + (apy.note ? '<span class="text-xs">' + apy.note + '</span>' : '') + '</div>' +
            '</div>');
    },

    // ----- §7 Peg detail (thin-liquidity annotated) -----
    _fillPeg: function(fam) {
        var peg = fam.peg || {};
        var gated = peg.peg_signal_gated === true;
        var quotes = (peg.quotes || []).slice();

        var rows = quotes.map(function(q) {
            var thin = q.liquidity_thin === true;
            var priceOff = q.price_usd != null && Math.abs(q.price_usd - 1) > 0.01;
            // Grey out thin quotes; specifically flag the thin off-peg DEX outlier.
            var cls = thin ? 'text-slate-400' : '';
            var flag = thin
                ? CapRenderer._statusPill('thin' + (priceOff ? ' · off-peg outlier' : ''), 'warn')
                : CapRenderer._statusPill('used', 'ok');
            return '<tr class="' + cls + '">' +
                '<td class="font-medium">' + (q.source || '—') + '</td>' +
                '<td class="text-right font-mono">$' + (q.price_usd != null ? q.price_usd.toFixed(4) : '—') + '</td>' +
                '<td class="text-right font-mono">' + (q.volume_24h_usd != null ? CapRenderer._money(q.volume_24h_usd) : '—') + '</td>' +
                '<td class="text-right font-mono">' + (q.liquidity_usd != null ? CapRenderer._money(q.liquidity_usd) : '—') + '</td>' +
                '<td>' + flag + '</td>' +
            '</tr>';
        }).join('');

        var bps = peg.deviation_bps;

        CapRenderer._set('cap-peg-panel',
            '<div class="panel">' +
                '<div class="panel-title">Peg <span class="text-xs font-normal text-slate-400">— market vs $1</span></div>' +
                (gated
                    ? '<div class="risk-flag mb-3" style="background:#f8fafc;color:#475569;border-left:4px solid #94a3b8;">' +
                          '<span class="font-medium">Thin liquidity — peg read is indicative.</span> cUSD trades DEX-only (~$6k/24h). ' +
                          'The signal is <span class="font-medium">gated</span>: a thin GeckoTerminal pool prints ~$0.958, but the deep quotes agree near $0.9998. ' +
                          'We do not raise a peg alert off a thin quote — coverage and operator/restaker health are the headline signals.</div>'
                    : '') +
                '<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">' +
                    '<div><div class="text-xs text-slate-400 font-medium uppercase">Market price</div>' +
                        '<div class="text-lg font-bold font-mono">$' + (peg.market_price != null ? peg.market_price.toFixed(4) : '—') + '</div></div>' +
                    '<div><div class="text-xs text-slate-400 font-medium uppercase">Deviation</div>' +
                        '<div class="text-lg font-bold font-mono">' + (bps != null ? (bps >= 0 ? '+' : '') + bps.toFixed(0) + ' bps' : '—') + '</div></div>' +
                    '<div><div class="text-xs text-slate-400 font-medium uppercase">Non-thin quotes</div>' +
                        '<div class="text-lg font-bold text-slate-800">' + (peg.non_thin_quote_count != null ? peg.non_thin_quote_count : '—') +
                        '<span class="text-xs text-slate-400 font-normal"> / ' + (peg.usable_quote_count != null ? peg.usable_quote_count : quotes.length) + '</span></div></div>' +
                    '<div><div class="text-xs text-slate-400 font-medium uppercase">Signal</div>' +
                        '<div class="text-lg">' + (gated ? CapRenderer._statusPill('Indicative', 'warn') : CapRenderer._statusPill('Live', 'ok')) + '</div></div>' +
                '</div>' +
                '<table class="data-table"><thead><tr><th>Source</th><th class="text-right">Price</th><th class="text-right">24h vol</th><th class="text-right">Liquidity</th><th>Quality</th></tr></thead>' +
                '<tbody>' + rows + '</tbody></table>' +
            '</div>');
    },

    // ----- §8 Risk flags strip -----
    _fillRiskFlags: function(fam) {
        var flags = (fam.risk_flags || []).slice();
        if (!flags.length) {
            CapRenderer._set('cap-riskflags-panel',
                '<div class="panel"><div class="panel-title">Risk Flags</div>' +
                '<div class="text-green-600 text-sm font-medium">No risk flags</div></div>');
            return;
        }
        // Order critical → warning → info.
        var order = { critical: 0, warning: 1, info: 2 };
        flags.sort(function(a, b) { return (order[a.severity] != null ? order[a.severity] : 3) - (order[b.severity] != null ? order[b.severity] : 3); });
        var body = flags.map(function(f) {
            return '<div class="risk-flag risk-' + f.severity + '">' + f.message + '</div>';
        }).join('');
        CapRenderer._set('cap-riskflags-panel',
            '<div class="panel"><div class="panel-title">Risk Flags <span class="text-xs font-normal text-slate-400">— ' + flags.length + '</span></div>' + body + '</div>');
    },

    // ----- centralization badge (static risk marker) -----
    _fillCentralization: function(fam) {
        var c = fam.contracts || {};
        var link = function(addr, label) {
            if (!addr) return label;
            return '<a href="https://etherscan.io/address/' + addr + '" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline font-mono text-xs" title="' + addr + '">' + label + ' ' + CapRenderer._truncAddr(addr) + '</a>';
        };
        CapRenderer._set('cap-centralization-panel',
            '<div class="panel">' +
                '<div class="panel-title">Centralization & Admin Powers</div>' +
                '<div class="flex flex-wrap items-center gap-2 mb-3">' +
                    CapRenderer._statusPill('1-day timelock', 'warn') +
                    CapRenderer._statusPill('Admin-set oracle', 'warn') +
                    CapRenderer._statusPill('Whitelisted operators', 'warn') +
                '</div>' +
                '<p class="text-sm text-slate-500 mb-3">Cap admin actions route through a <span class="font-medium">1-day timelock</span> — short enough that a governance capture or key compromise leaves a narrow exit window. ' +
                    'Reserve marks come from an <span class="font-medium">admin-set oracle</span>, and the operator set is permissioned. These are structural, standing risks (not incident flags).</p>' +
                '<div class="flex flex-wrap gap-x-4 gap-y-1 text-xs">' +
                    link(c.timelock, 'Timelock') +
                    link(c.oracle, 'Oracle') +
                    link(c.access_control, 'AccessControl') +
                    link(c.delegation, 'Delegation') +
                    link(c.cusd_vault, 'Vault') +
                '</div>' +
            '</div>');
    },

    // ----- novel-model explainer (static) -----
    _renderModelNote: function() {
        return '<div class="panel">' +
            '<div class="panel-title">How cUSD is backed <span class="text-xs font-normal text-slate-400">— read the coverage number with this caveat</span></div>' +
            '<div class="text-sm text-slate-600 space-y-2">' +
                '<p>cUSD is over-reserved by a shared vault (USDC + an RWA money-market token). That reserve is <span class="font-medium">re-lent to whitelisted operators</span> ' +
                    '(e.g. the Bedrock CAP operator, market-makers) who post <span class="font-medium">restaker first-loss collateral</span> via Symbiotic against their borrows.</p>' +
                '<p>So "coverage 100%" describes the <span class="font-medium">reserve</span> leg. The <span class="font-medium">credit</span> leg — whether operator losses stay within restaker coverage — ' +
                    'is a separate, novel, designed-but-unproven backstop. Read the two together: reserve coverage at par + operator health + restaker coverage ÷ debt.</p>' +
            '</div>' +
        '</div>';
    },

    _setupAnchorNav: function() {
        var navEl = document.getElementById('asset-anchor-nav');
        var inner = document.getElementById('asset-anchor-nav-inner');
        if (!navEl || !inner) return;
        var items = [
            { id: 'panel-headline', label: 'Overview' },
            { id: 'chart-panel', label: 'Coverage' },
            { id: 'panel-utilization', label: 'Utilization' },
            { id: 'cap-reserve-panel', label: 'Reserves' },
            { id: 'cap-operators-panel', label: 'Operators' },
            { id: 'cap-restaker-panel', label: 'Restakers' },
            { id: 'cap-stcusd-panel', label: 'stcUSD' },
            { id: 'cap-peg-panel', label: 'Peg' },
            { id: 'cap-centralization-panel', label: 'Admin' }
        ];
        inner.innerHTML = items.map(function(item) {
            return '<a href="#' + item.id + '" ' +
                'class="text-slate-600 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400 px-2 py-0.5 rounded transition-colors">' +
                item.label + '</a>';
        }).join('');
        navEl.classList.remove('hidden');
    }
};
