/**
 * MSTR renderer — Strategy common-equity sibling view to ?asset=strc.
 *
 * Equity-holder lens on the same Strategy/BTC dataset the STRC view renders.
 * Consumes data/strc_backing.json (no separate JSON file) — both the existing
 * `tradfi.*` blocks and the new `mstr_view.*` sub-block (added in PegTracker
 * b436aa6 on 2026-05-30).
 *
 * Six panels for v1:
 *   1. Headline banner — MSTR price, mNAV, per-share BTC NAV, premium/discount
 *   2. mNAV regime (same chart as STRC view; equity-holder caption variant)
 *   3. Balance sheet snapshot
 *   4. Capital structure stack
 *   5. Per-share BTC NAV trajectory (load-bearing equity metric)
 *   6. Dilution + maturity wall combined
 *
 * Handoff: ~/riskAnalyst/specs/handoffs/mstr-view-renderer-backing-monitor.md
 * Asset analysis: ~/riskAnalyst/assets/mstr.md
 * Pattern mirrored: js/renderers/strc.js
 */

var MSTRRenderer = {

    // ============================================================
    // helpers (parallel to STRCRenderer._fmt*)
    // ============================================================
    _fmtMoney: function (n, decimals) {
        if (n == null) return '—';
        decimals = decimals != null ? decimals : 0;
        return '$' + n.toLocaleString('en-US', { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
    },
    _fmtMoneyShort: function (n) {
        if (n == null) return '—';
        var abs = Math.abs(n);
        if (abs >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
        if (abs >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
        if (abs >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
        return '$' + n.toFixed(0);
    },
    _fmtNum: function (n, decimals) {
        if (n == null) return '—';
        decimals = decimals != null ? decimals : 0;
        return n.toLocaleString('en-US', { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
    },
    _fmtPct: function (frac, decimals) {
        if (frac == null) return '—';
        decimals = decimals != null ? decimals : 1;
        return (frac * 100).toFixed(decimals) + '%';
    },

    _mnavBandClass: function (regime) {
        if (regime === 'premium')  return 'border-green-300 bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-200';
        if (regime === 'parity')   return 'border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200';
        if (regime === 'discount') return 'border-orange-300 bg-orange-50 text-orange-800 dark:bg-orange-900/20 dark:text-orange-200';
        if (regime === 'distress') return 'border-red-300 bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-200';
        return 'border-slate-300 bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-200';
    },
    _mnavBandLabel: function (regime) {
        if (regime === 'premium')  return 'PREMIUM';
        if (regime === 'parity')   return 'PARITY';
        if (regime === 'discount') return 'DISCOUNT';
        if (regime === 'distress') return 'DISTRESS';
        return (regime || '—').toUpperCase();
    },

    // Equity-holder framing: same regime bands as STRC but caption swap.
    _mnavCaptionEquity: function (regime) {
        if (regime === 'premium')  return 'ATM equity issuance accretive — BTC accumulation continues, per-share BTC NAV grows.';
        if (regime === 'parity')   return 'ATM marginally accretive — per-share BTC NAV growth slowing.';
        if (regime === 'discount') return 'ATM offline for BTC accumulation but active for liability management (e.g. convert buybacks). Per-share BTC NAV compressed by dilution offsets.';
        if (regime === 'distress') return 'Equity issuance dilutes per-share BTC NAV materially. Cash-settlement of convert maturities likely; BTC stack drain accelerating.';
        return '—';
    },

    // Premium/discount color band — green if positive, red if deeply negative.
    _pdClass: function (frac) {
        if (frac == null) return 'text-slate-700 dark:text-slate-200';
        if (frac > 0) return 'text-green-700 dark:text-green-300';
        if (frac < -0.10) return 'text-red-700 dark:text-red-300';
        return 'text-orange-700 dark:text-orange-300';
    },

    // ============================================================
    // preRender — runs before common.renderSummaryCards / renderBreakdown.
    // Mirrors STRCRenderer.preRender pattern: scaffold the standard schema
    // so common.js doesn't NPE; render() then hides the common panels.
    // ============================================================
    preRender: function (data) {
        if (!data) return;
        var tradfi = data.tradfi || {};
        var mstr = tradfi.mstr || {};
        var mv = data.mstr_view || {};

        // Header subtitle override — common path renders "<asset> (<chain>)".
        // The STRC analyzer emits asset='strc'; without override the MSTR view
        // would inherit it and read "strc (NYSE + multi-chain wrapper)".
        data.asset = 'MSTR';
        data.chain = 'NASDAQ + Strategy capital structure';
        if (!data.timestamp && data.timestamp_utc) data.timestamp = data.timestamp_utc;

        // Scaffold common-section schema so common.js renderers don't NPE.
        // All four panels (summary cards, breakdown, pie, CR chart) are
        // suppressed in _suppressCommonPanels — these placeholders never paint.
        if (!data.summary) {
            data.summary = {
                total_supply: mv.market_cap_usd || mstr.market_cap_usd || 0,
                total_backing: mv.market_cap_usd || 0,
                collateral_ratio: 100,
                collateral_ratio_alt: {
                    label: 'per-share BTC NAV',
                    value: mv.btc_nav_per_share_usd || 0,
                    is_currency: true
                },
                surplus_deficit: 0
            };
        }
        if (!Array.isArray(data.backing_breakdown)) data.backing_breakdown = [];
        if (!data.asset_specific) data.asset_specific = { type: 'mstr' };
    },

    // ============================================================
    // render — entry point.
    // ============================================================
    render: function (data) {
        var container = document.getElementById('asset-specific-panels');
        if (!container) return;

        MSTRRenderer._suppressCommonPanels(data);

        var tradfi = data.tradfi || {};
        var mv = data.mstr_view || {};
        var riskFlags = data.risk_flags || [];

        // 7-panel layout (post-reorg, MSTR owns issuer-side analysis):
        //   1. MSTR headline (equity-holder lens)
        //   2. mNAV regime (equity-caption variant)
        //   3. Balance sheet snapshot
        //   4. Capital structure stack (with → STRC affordance)
        //   5. Cash-Service Waterfall + Rate-Ceiling Overlay (moved from STRC)
        //   6. Per-share BTC NAV trajectory
        //   7. Dilution + maturity wall
        var html = '';
        html += MSTRRenderer._renderHeadlineBanner(tradfi, mv);
        html += MSTRRenderer._renderMnavRegime(tradfi);
        html += MSTRRenderer._renderBalanceSheet(mv);
        html += MSTRRenderer._renderCapitalStructure(mv);
        html += MSTRRenderer._renderCashServiceWaterfall(data);
        html += MSTRRenderer._renderPerShareNavTrajectory(tradfi, mv);
        html += MSTRRenderer._renderDilutionMaturityWall(mv);
        html += MSTRRenderer._renderFreshness(data);

        container.innerHTML = html;

        // Sibling-dashboard affordance in the page header (above panel 1).
        MSTRRenderer._setupCompanionLink();

        // Post-paint charts — DOM nodes must exist first.
        MSTRRenderer._paintCapitalStructureChart(mv);
        MSTRRenderer._paintMaturityWallChart(mv);
        MSTRRenderer._loadHistoryAndPaintTrajectory(tradfi, mv);
    },

    // Persistent header link to the sibling STRC dashboard. Reuses the
    // shared #header-companion-link slot; app.js resets it on each route.
    _setupCompanionLink: function () {
        var link = document.getElementById('header-companion-link');
        if (!link) return;
        link.setAttribute('href', '?asset=strc');
        link.textContent = 'STRC + STRCx preferred analysis → STRC dashboard ↗';
        link.classList.remove('hidden');
    },

    _suppressCommonPanels: function (data) {
        // Top summary-card strip — Headline banner (panel 1) replaces it.
        var s = document.getElementById('summary-cards');
        if (s) s.style.display = 'none';
        // Backing breakdown table — not meaningful for MSTR equity.
        var bd = document.getElementById('breakdown-table');
        if (bd) { var p = bd.closest('.panel'); if (p) p.style.display = 'none'; }
        // Allocation pie chart — not meaningful for MSTR equity.
        var pie = document.getElementById('pie-chart');
        if (pie) { var p2 = pie.closest('.panel'); if (p2) p2.style.display = 'none'; }
        // CR history chart — MSTR has no CR; per-share BTC NAV trajectory
        // (panel 5) is the load-bearing equity-holder chart.
        var cp = document.getElementById('chart-panel');
        if (cp) cp.style.display = 'none';

        // Risk flags panel — widen + only show if any flags fire.
        var hasFlags = data && Array.isArray(data.risk_flags) && data.risk_flags.length > 0;
        var risk = document.getElementById('risk-flags');
        if (risk) {
            var rp = risk.closest('.panel');
            if (rp) {
                if (!hasFlags) {
                    rp.style.display = 'none';
                } else {
                    var wrap = rp.parentElement;
                    if (wrap && !wrap.classList.contains('lg:col-span-3')) {
                        wrap.classList.add('lg:col-span-3');
                    }
                }
            }
        }
    },

    // ============================================================
    // Panel 1 — Headline banner
    // ============================================================
    _renderHeadlineBanner: function (tradfi, mv) {
        var mstr = tradfi.mstr || {};
        var mnav = tradfi.mnav || {};
        var price = mstr.price_usd;
        var navPs = mv.btc_nav_per_share_usd;
        var pdFrac = mv.premium_discount_pct;
        var pdUsd = mv.premium_discount_per_share_usd;

        var mnavCls = MSTRRenderer._mnavBandClass(mnav.regime);
        var mnavLabel = MSTRRenderer._mnavBandLabel(mnav.regime);
        var mnavVal = (mnav.value != null) ? mnav.value.toFixed(2) : '—';
        var pdCls = MSTRRenderer._pdClass(pdFrac);
        var pdSign = (pdFrac != null && pdFrac > 0) ? '+' : '';
        var pdTxt = (pdFrac != null) ? pdSign + MSTRRenderer._fmtPct(pdFrac, 1) : '—';
        var pdSub = (pdUsd != null) ? (pdUsd >= 0 ? '+' : '') + MSTRRenderer._fmtMoney(pdUsd, 2) + ' / share' : '';

        return '<div class="panel">' +
            '<div class="panel-title">Headline status <span class="text-xs font-normal text-slate-500">— equity-holder lens · ' +
                '<a href="?asset=strc" class="text-blue-500 hover:underline">STRC credit-holder view →</a></span></div>' +
            '<div class="grid grid-cols-2 md:grid-cols-4 gap-3">' +
                '<div class="rounded-lg border border-slate-200 dark:border-slate-700 p-4">' +
                    '<div class="text-xs uppercase font-semibold text-slate-500">MSTR price</div>' +
                    '<div class="text-3xl font-bold mt-1 text-slate-800 dark:text-slate-100">' + (price != null ? MSTRRenderer._fmtMoney(price, 2) : '—') + '</div>' +
                    '<div class="text-xs text-slate-500 mt-1">Market cap ' + MSTRRenderer._fmtMoneyShort(mstr.market_cap_usd) + '</div>' +
                '</div>' +
                '<div class="rounded-lg border p-4 ' + mnavCls + '">' +
                    '<div class="text-xs uppercase font-semibold opacity-70">mNAV</div>' +
                    '<div class="text-3xl font-bold mt-1">' + mnavVal + '</div>' +
                    '<div class="text-xs font-semibold mt-1">' + mnavLabel + '</div>' +
                '</div>' +
                '<div class="rounded-lg border border-slate-200 dark:border-slate-700 p-4">' +
                    '<div class="text-xs uppercase font-semibold text-slate-500">Per-share BTC NAV</div>' +
                    '<div class="text-3xl font-bold mt-1 text-slate-800 dark:text-slate-100">' + (navPs != null ? MSTRRenderer._fmtMoney(navPs, 2) : '—') + '</div>' +
                    '<div class="text-xs text-slate-500 mt-1">' + MSTRRenderer._fmtNum(mv.share_count) + ' shares</div>' +
                '</div>' +
                '<div class="rounded-lg border border-slate-200 dark:border-slate-700 p-4">' +
                    '<div class="text-xs uppercase font-semibold text-slate-500">Premium / discount</div>' +
                    '<div class="text-3xl font-bold mt-1 ' + pdCls + '">' + pdTxt + '</div>' +
                    '<div class="text-xs text-slate-500 mt-1">' + pdSub + '</div>' +
                '</div>' +
            '</div>' +
        '</div>';
    },

    // ============================================================
    // Panel 2 — mNAV regime (load-bearing — equity caption variant)
    // ============================================================
    _renderMnavRegime: function (tradfi) {
        var mnav = tradfi.mnav || {};
        var val = (mnav.value != null) ? mnav.value.toFixed(4) : '—';
        var regime = mnav.regime || 'unknown';
        var caption = MSTRRenderer._mnavCaptionEquity(regime);
        var bandCls = MSTRRenderer._mnavBandClass(regime);
        var label = MSTRRenderer._mnavBandLabel(regime);

        return '<div class="panel">' +
            '<div class="panel-title">mNAV Regime <span class="text-xs font-normal text-slate-500">— equity issuance accretion signal</span></div>' +
            '<div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">' +
                '<div class="lg:col-span-1">' +
                    '<div class="text-xs uppercase font-semibold text-slate-500 mb-1">Current mNAV</div>' +
                    '<div class="text-5xl font-bold text-slate-800 dark:text-slate-100">' + val + '</div>' +
                    '<div class="mt-2"><span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ' + bandCls + '">' + label + '</span></div>' +
                    '<div class="text-xs text-slate-500 mt-3 leading-relaxed">' +
                        'Regime bands: premium ≥1.05 · parity 0.95–1.05 · discount 0.85–0.95 · distress &lt;0.85' +
                    '</div>' +
                '</div>' +
                '<div class="lg:col-span-2">' +
                    '<div style="height: 240px; position: relative;"><canvas id="mstr-mnav-chart"></canvas></div>' +
                '</div>' +
            '</div>' +
            '<div class="mt-4 p-3 rounded border ' + bandCls + '">' +
                '<div class="text-sm">' + caption + '</div>' +
            '</div>' +
        '</div>';
    },

    // ============================================================
    // Panel 3 — Balance sheet snapshot
    // ============================================================
    _renderBalanceSheet: function (mv) {
        var bs = mv.balance_sheet || {};
        var cap = mv.capital_structure || {};
        var denom = cap.total_capitalization_usd;

        function pctOfCap(v) {
            if (v == null || !denom) return '—';
            return (v / denom * 100).toFixed(1) + '%';
        }

        var rows = [
            ['BTC holdings', bs.btc_holdings_usd, false],
            ['Cash & equivalents', bs.cash_and_equivalents_usd, false],
            ['Senior convertible debt', bs.senior_convertible_debt_usd, false],
            ['Total preferred notional', bs.total_preferred_notional_usd, false],
            ['Implied equity book value', bs.implied_equity_book_value_usd, true]
        ];

        var rowHtml = rows.map(function (r) {
            var bg = r[2] ? 'bg-blue-50 dark:bg-blue-900/20 font-semibold' : '';
            return '<tr class="' + bg + '">' +
                '<td class="font-medium">' + r[0] + '</td>' +
                '<td class="text-right font-mono">' + (r[1] != null ? MSTRRenderer._fmtMoneyShort(r[1]) : '—') + '</td>' +
                '<td class="text-right font-mono text-slate-500">' + pctOfCap(r[1]) + '</td>' +
            '</tr>';
        }).join('');

        var asOf = bs.as_of || '—';
        var src = bs.source || '—';

        return '<div class="panel">' +
            '<div class="panel-title">Balance sheet snapshot</div>' +
            '<div class="data-table-scroll">' +
                '<table class="data-table">' +
                    '<thead><tr><th>Line</th><th class="text-right">USD</th><th class="text-right">% of total cap</th></tr></thead>' +
                    '<tbody>' + rowHtml + '</tbody>' +
                '</table>' +
            '</div>' +
            '<div class="text-xs text-slate-500 mt-3 leading-relaxed">' +
                'Balance sheet as of <span class="font-mono">' + asOf + '</span> (' + src + '). ' +
                'Refresh on each new 10-Q + transaction 8-K. BTC valued at spot for this view; GAAP treats per FASB ASU 2023-08.' +
            '</div>' +
        '</div>';
    },

    // ============================================================
    // Panel 4 — Capital structure stack
    // ============================================================
    _renderCapitalStructure: function (mv) {
        var cap = mv.capital_structure || {};
        var total = cap.total_capitalization_usd;

        // 5 tiers from most senior to common equity, with STRC highlighted
        // as the largest single tier on the preferred stack.
        var tiers = [
            { key: 'senior',  label: 'Senior converts',         value: cap.senior_convertible_debt_usd },
            { key: 'strf',    label: 'STRF preferred',          value: cap.strf_preferred_usd },
            { key: 'strc',    label: 'STRC preferred',          value: cap.strc_preferred_usd_est, highlight: true },
            { key: 'strkstrd', label: 'STRK + STRD residual',   value: cap.strk_strd_preferred_residual_usd },
            { key: 'common',  label: 'Common equity (MSTR)',    value: cap.common_equity_market_cap_usd }
        ];

        var rowHtml = tiers.map(function (t) {
            var pct = (t.value != null && total) ? (t.value / total * 100) : null;
            var bg = t.highlight ? 'bg-blue-50 dark:bg-blue-900/20 font-semibold' : '';
            var marker = '';
            if (t.key === 'strc') {
                marker = ' <span class="text-xs text-blue-700">◄ largest preferred tier</span>' +
                    ' <a href="?asset=strc" class="text-xs text-blue-500 hover:underline ml-1">→ STRC dashboard</a>';
            }
            return '<tr class="' + bg + '">' +
                '<td class="font-medium">' + t.label + marker + '</td>' +
                '<td class="text-right font-mono">' + (t.value != null ? MSTRRenderer._fmtMoneyShort(t.value) : '—') + '</td>' +
                '<td class="text-right font-mono text-slate-500">' + (pct != null ? pct.toFixed(1) + '%' : '—') + '</td>' +
            '</tr>';
        }).join('') +
            '<tr class="font-bold border-t-2 border-slate-200">' +
                '<td>Total capitalization</td>' +
                '<td class="text-right font-mono">' + MSTRRenderer._fmtMoneyShort(total) + '</td>' +
                '<td class="text-right font-mono">100.0%</td>' +
            '</tr>';

        return '<div class="panel">' +
            '<div class="panel-title">Capital structure stack <span class="text-xs font-normal text-slate-500">— senior → junior → common</span></div>' +
            '<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">' +
                '<div>' +
                    '<div style="height: 280px; position: relative;"><canvas id="mstr-capital-stack-chart"></canvas></div>' +
                '</div>' +
                '<div class="data-table-scroll">' +
                    '<table class="data-table">' +
                        '<thead><tr><th>Tier</th><th class="text-right">USD</th><th class="text-right">% of cap</th></tr></thead>' +
                        '<tbody>' + rowHtml + '</tbody>' +
                    '</table>' +
                '</div>' +
            '</div>' +
            '<div class="text-xs text-slate-500 mt-3">' +
                'Annual cash service through these tiers is shown in the next panel. ' +
                'For the STRC instrument-native view (rate mechanics, STRCx wrapper, downstream exposure), see the ' +
                '<a href="?asset=strc" class="text-blue-500 hover:underline">STRC dashboard →</a>' +
            '</div>' +
        '</div>';
    },

    // ============================================================
    // Panel 5 — Cash-Service Waterfall + Rate-Ceiling Overlay
    //
    // Ported from STRC dashboard (was strc panel 6). The waterfall is
    // MSTR-issuer analysis — where annual cash service flows in the
    // senior-to-junior capital stack. STRC is one tier within it; the
    // other three (Senior Converts, STRF, STRK+STRD) are MSTR capital-
    // structure objects. Lives here as the dynamic counterpart to the
    // static Capital Structure stack (#4).
    // ============================================================
    _runwayClass: function (years) {
        if (years == null) return 'text-slate-700 dark:text-slate-200';
        if (years > 40) return 'text-green-700 dark:text-green-300';
        if (years >= 25) return 'text-amber-700 dark:text-amber-300';
        if (years >= 15) return 'text-orange-700 dark:text-orange-300';
        return 'text-red-700 dark:text-red-300';
    },

    // Cash-runway color bands (months): >12 green, 6–12 amber, 3–6 orange, <3 red.
    _cashRunwayClass: function (months) {
        if (months == null) return 'text-slate-700 dark:text-slate-200';
        if (months > 12) return 'text-green-700 dark:text-green-300';
        if (months >= 6) return 'text-amber-700 dark:text-amber-300';
        if (months >= 3) return 'text-orange-700 dark:text-orange-300';
        return 'text-red-700 dark:text-red-300';
    },

    _renderCashServiceWaterfall: function (data) {
        var csw = data.cash_service_waterfall;
        if (!csw) {
            return '<div class="panel">' +
                '<div class="panel-title">Cash-Service Waterfall</div>' +
                '<div class="risk-flag risk-warning">cash_service_waterfall block not present in this snapshot — analyzer may be running an older schema.</div>' +
            '</div>';
        }

        var obl = csw.annual_obligation_usd || {};
        var btcYr = csw.btc_per_year_at_current_price || {};
        var pctStack = csw.pct_of_stack_per_year || {};
        var runway = csw.runway_years_flat_btc || {};
        var assum = csw.assumptions || {};
        var rateCeiling = csw.runway_at_rate_ceiling || {};
        var mnav = (data.tradfi && data.tradfi.mnav) || {};

        var headlineRunway = runway.total_preferred_plus_interest;
        var runwayCls = MSTRRenderer._runwayClass(headlineRunway);

        // ---- Seniority waterfall table — 4 tiers, STRC row highlighted +
        // STRC tier cross-links to the STRC dashboard.
        function rowHtml(tier, label, faceUsd, annualUsd, btcYrVal, extra, highlight) {
            var bg = highlight ? 'bg-blue-50 dark:bg-blue-900/20 font-semibold' : '';
            var crossLink = highlight ? ' <a href="?asset=strc" class="text-xs text-blue-500 hover:underline ml-1">→ STRC dashboard</a>' : '';
            return '<tr class="' + bg + '">' +
                '<td><span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ' +
                    (tier === 'SENIOR' ? 'bg-slate-200 text-slate-800' : tier === 'STRC' ? 'bg-blue-200 text-blue-900' : 'bg-amber-100 text-amber-800') + '">' + tier + '</span></td>' +
                '<td class="font-medium">' + label + crossLink + '</td>' +
                '<td class="text-right font-mono">' + (faceUsd != null ? MSTRRenderer._fmtMoneyShort(faceUsd) : '—') + '</td>' +
                '<td class="text-right font-mono">' + (annualUsd != null ? MSTRRenderer._fmtMoneyShort(annualUsd) + '/yr' : '—') + '</td>' +
                '<td class="text-right font-mono">' + (btcYrVal != null ? MSTRRenderer._fmtNum(btcYrVal) + ' BTC/yr' : '—') + '</td>' +
                '<td class="text-xs text-slate-500">' + (extra || '') + '</td>' +
            '</tr>';
        }
        var btcPx = assum.btc_price_usd;
        function annualToBtc(annual) {
            return (annual != null && btcPx) ? Math.round(annual / btcPx) : null;
        }
        var seniorConvertFace = 8200000000;  // matches PegTracker SENIOR_CONVERT_FACE_USD constant
        var strfPar = (obl.strf_dividend != null) ? obl.strf_dividend / 0.10 : null;
        var strcPar = (data.tradfi && data.tradfi.strc_dividend && data.tradfi.strc_dividend.outstanding_par_usd) || null;
        var strcRateLabel = (data.tradfi && data.tradfi.strc_dividend && data.tradfi.strc_dividend.current_rate != null)
            ? ((data.tradfi.strc_dividend.current_rate || 0) * 100).toFixed(2) + '%'
            : '—';

        var waterfallRows =
            rowHtml('SENIOR', 'Senior Converts (0.42% blended)', seniorConvertFace, obl.senior_convert_interest,
                annualToBtc(obl.senior_convert_interest),
                '2030 wall ' + MSTRRenderer._fmtMoneyShort(csw.senior_convert_2030_maturity_wall_usd), false) +
            rowHtml('SENIOR', 'STRF (10% fixed)', strfPar, obl.strf_dividend,
                annualToBtc(obl.strf_dividend), '', false) +
            rowHtml('STRC', 'STRC (variable, ' + strcRateLabel + ')',
                strcPar, obl.strc_dividend, annualToBtc(obl.strc_dividend), '', true) +
            rowHtml('JUNIOR', 'STRK + STRD residual (conservative)', null, obl.junior_preferred_estimate,
                annualToBtc(obl.junior_preferred_estimate), '', false) +
            '<tr class="font-bold border-t-2 border-slate-200">' +
                '<td></td>' +
                '<td>Aggregate annual obligation</td>' +
                '<td></td>' +
                '<td class="text-right font-mono">' + MSTRRenderer._fmtMoneyShort(obl.total) + '/yr</td>' +
                '<td class="text-right font-mono">' + MSTRRenderer._fmtNum(btcYr.total_preferred_plus_interest) + ' BTC/yr</td>' +
                '<td></td>' +
            '</tr>';

        // ---- Three runway readouts.
        function runwayCard(label, sub, years, btc, pct) {
            var yrCls = MSTRRenderer._runwayClass(years);
            return '<div class="rounded-lg border border-slate-200 dark:border-slate-700 p-4">' +
                '<div class="text-xs uppercase font-semibold text-slate-500">' + label + '</div>' +
                '<div class="text-xs text-slate-500 mt-0.5">' + sub + '</div>' +
                '<div class="text-3xl font-bold mt-2 ' + yrCls + '">' + (years != null ? years + ' yr' : '—') + '</div>' +
                '<div class="text-xs text-slate-500 mt-1 font-mono">' +
                    (btc != null ? MSTRRenderer._fmtNum(btc) + ' BTC/yr' : '—') +
                    (pct != null ? ' · ' + (pct * 100).toFixed(2) + '% of stack/yr' : '') +
                '</div>' +
            '</div>';
        }
        var runwayRow =
            '<div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">' +
                runwayCard('STRC alone', 'STRC dividend only', runway.strc_only, btcYr.strc_only, pctStack.strc_only) +
                runwayCard('Senior-to-STRC', 'STRF + STRC + senior convert interest', runway.senior_to_strc, btcYr.senior_to_strc, pctStack.senior_to_strc) +
                runwayCard('All preferred + interest', 'Adds STRK + STRD residual', runway.total_preferred_plus_interest, btcYr.total_preferred_plus_interest, pctStack.total_preferred_plus_interest) +
            '</div>';

        // ---- Cash runway sub-panel: short-term operational stress horizon
        // (months until BTC sales become required absent new issuance inflow).
        // Complements the year-runway above (long-term flat-BTC solvency).
        var cashRunway = csw.cash_runway || null;
        var cashSubPanel = '';
        if (cashRunway) {
            var monthsByTier = cashRunway.months_until_btc_sales_required || {};
            var monthlyObl = cashRunway.monthly_obligation_usd || {};
            function cashCard(label, sub, months, monthly, primary) {
                var bandCls = MSTRRenderer._cashRunwayClass(months);
                var sizeCls = primary ? 'text-3xl' : 'text-2xl';
                var border = primary ? 'border-2' : 'border';
                return '<div class="rounded-lg ' + border + ' border-slate-200 dark:border-slate-700 p-3">' +
                    '<div class="text-xs uppercase font-semibold text-slate-500">' + label + '</div>' +
                    '<div class="text-xs text-slate-500 mt-0.5">' + sub + '</div>' +
                    '<div class="' + sizeCls + ' font-bold mt-1 ' + bandCls + '">' + (months != null ? months.toFixed(1) + ' mo' : '—') + '</div>' +
                    '<div class="text-[10px] text-slate-500 mt-1 font-mono">' + (monthly != null ? MSTRRenderer._fmtMoneyShort(monthly) + '/mo obligation' : '—') + '</div>' +
                '</div>';
            }
            var cashRunwayRow =
                '<div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">' +
                    cashCard('STRC alone', 'STRC dividend only',
                        monthsByTier.strc_only, monthlyObl.strc_only, false) +
                    cashCard('Senior-to-STRC', 'STRF + STRC + senior convert interest',
                        monthsByTier.senior_to_strc, monthlyObl.senior_to_strc, false) +
                    cashCard('Total preferred + interest', 'All preferred + STRK/STRD residual',
                        monthsByTier.total_preferred_plus_interest, monthlyObl.total_preferred_plus_interest, true) +
                '</div>';

            var cashAsOf = cashRunway.cash_as_of;
            var staleDaysTxt = '';
            if (cashAsOf) {
                var ageMs = Date.now() - Date.parse(cashAsOf + 'T00:00:00Z');
                var ageDays = Math.floor(ageMs / 86400000);
                if (ageDays > 60) {
                    staleDaysTxt = ' <span class="text-amber-700 dark:text-amber-300 font-semibold">(stale by ' + ageDays + ' days)</span>';
                }
            }
            var cashCaption =
                '<div class="text-xs text-slate-600 dark:text-slate-300 mt-2">' +
                    '<span class="font-semibold">Cash on hand:</span> ' +
                    '<span class="font-mono">' + MSTRRenderer._fmtMoneyShort(cashRunway.cash_and_equivalents_usd) + '</span>' +
                    ' as of <span class="font-mono">' + (cashAsOf || '—') + '</span>' +
                    staleDaysTxt +
                    ' · source: <span class="italic">' + (cashRunway.cash_source || '—') + '</span>' +
                '</div>';
            var cashCaveat =
                '<div class="text-xs text-slate-500 italic mt-1 leading-relaxed">' +
                    'Cash runway assumes ZERO new issuance inflow. In practice Strategy continuously refills cash via preferred + ATM activity. ' +
                    'Treat as a stress-scenario watermark, not a forward forecast.' +
                '</div>';

            cashSubPanel =
                '<div class="rounded-lg border border-slate-200 dark:border-slate-700 p-4 mt-4 bg-slate-50/40 dark:bg-slate-800/30">' +
                    '<div class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Cash Runway <span class="text-xs font-normal text-slate-500">— months until BTC sales required (no-issuance stress)</span></div>' +
                    cashRunwayRow +
                    cashCaption +
                    cashCaveat +
                '</div>';
        }

        // ---- Sequenced runway sub-panel: operational timeline from cash
        // service (Phase 1) into BTC sales (Phase 2).
        var seq = csw.sequenced_runway || null;
        var seqSubPanel = '';
        if (seq) {
            var p1 = seq.phase1_cash_months || {};
            var p2 = seq.phase2_btc_years_after_cash || {};
            var tot = seq.total_operational_timeline_years || {};

            function seqRow(label, p1m, p2y, totY) {
                return '<tr>' +
                    '<td class="font-medium">' + label + '</td>' +
                    '<td class="text-right font-mono">' + (p1m != null ? p1m.toFixed(1) + ' mo' : '—') + '</td>' +
                    '<td class="text-right font-mono">' + (p2y != null ? p2y + ' yr' : '—') + '</td>' +
                    '<td class="text-right font-mono font-semibold">' + (totY != null ? totY.toFixed(1) + ' yr' : '—') + '</td>' +
                '</tr>';
            }
            var seqTable =
                '<div class="data-table-scroll">' +
                    '<table class="data-table">' +
                        '<thead><tr>' +
                            '<th>Obligation slice</th>' +
                            '<th class="text-right">Phase 1 (cash)</th>' +
                            '<th class="text-right">Phase 2 (BTC)</th>' +
                            '<th class="text-right">Total timeline</th>' +
                        '</tr></thead>' +
                        '<tbody>' +
                            seqRow('STRC alone', p1.strc_only, p2.strc_only, tot.strc_only) +
                            seqRow('Senior-to-STRC', p1.senior_to_strc, p2.senior_to_strc, tot.senior_to_strc) +
                            seqRow('Total preferred + interest', p1.total_preferred_plus_interest, p2.total_preferred_plus_interest, tot.total_preferred_plus_interest) +
                        '</tbody>' +
                    '</table>' +
                '</div>';
            var seqCaption =
                '<div class="text-xs text-slate-500 italic mt-2 leading-relaxed">' +
                    'Sequenced model — cash funds Phase 1, BTC sales begin Phase 2. ' +
                    'The total timeline is barely distinguishable from the BTC-only runway (months + decades) — ' +
                    '<span class="font-semibold">the load-bearing field is when Phase 1 exhausts</span>, since BTC sales activate the BTC-price feedback chain. ' +
                    'Same zero-issuance assumption as the cash-runway sub-panel above.' +
                '</div>';
            seqSubPanel =
                '<div class="rounded-lg border border-slate-200 dark:border-slate-700 p-4 mt-4 bg-slate-50/40 dark:bg-slate-800/30">' +
                    '<div class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Sequenced Runway by obligation slice <span class="text-xs font-normal text-slate-500">— Phase 1 / Phase 2 / Total breakdown</span></div>' +
                    seqTable +
                    seqCaption +
                '</div>';
        }

        // ---- Rate-ceiling overlay (sub-panel) — STRC's rate stress, but
        // shown here because it determines the multi-tier runway profile.
        var midCycles = rateCeiling.stress_cycles_to_mid;
        var topCycles = rateCeiling.stress_cycles_to_top;
        var midColor = (midCycles != null && midCycles <= 3) ? 'amber' : 'neutral';
        function ceilingCard(label, sub, years, color) {
            var cls = 'border-slate-200 dark:border-slate-700';
            var yearsCls = 'text-slate-800 dark:text-slate-100';
            if (color === 'amber') { cls = 'border-amber-300 bg-amber-50 dark:bg-amber-900/10'; yearsCls = 'text-amber-700 dark:text-amber-300'; }
            else if (color === 'red') { cls = 'border-red-300 bg-red-50 dark:bg-red-900/10'; yearsCls = 'text-red-700 dark:text-red-300'; }
            return '<div class="rounded-lg border p-3 ' + cls + '">' +
                '<div class="text-xs uppercase font-semibold text-slate-500">' + label + '</div>' +
                '<div class="text-xs text-slate-500 mt-0.5">' + sub + '</div>' +
                '<div class="text-2xl font-bold mt-1 ' + yearsCls + '">' + (years != null ? years + ' yr' : '—') + '</div>' +
            '</div>';
        }
        var ceilingRow =
            '<div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">' +
                ceilingCard('Current rate', ((rateCeiling.current_rate || 0) * 100).toFixed(2) + '%', rateCeiling.runway_at_current_rate_years, 'neutral') +
                ceilingCard('Mid-ceiling', ((rateCeiling.mid_ceiling_rate || 0) * 100).toFixed(0) + '% — ' + (midCycles != null ? midCycles + ' stress ' + (midCycles === 1 ? 'cycle' : 'cycles') + ' away' : ''), rateCeiling.runway_at_mid_ceiling_years, midColor) +
                ceilingCard('Top-ceiling', ((rateCeiling.top_ceiling_rate || 0) * 100).toFixed(0) + '% — ' + (topCycles != null ? topCycles + ' stress cycles away' : ''), rateCeiling.runway_at_top_ceiling_years, 'red') +
            '</div>';

        var launchRate = 0.1025;
        var topRate = (rateCeiling.top_ceiling_rate != null) ? rateCeiling.top_ceiling_rate : 0.16;
        var midRate = (rateCeiling.mid_ceiling_rate != null) ? rateCeiling.mid_ceiling_rate : 0.14;
        var currRate = (rateCeiling.current_rate != null) ? rateCeiling.current_rate : 0.115;
        function pctAcross(rate) {
            var x = (rate - launchRate) / (topRate - launchRate) * 100;
            return Math.max(0, Math.min(100, x));
        }
        var headroomBar =
            '<div class="mt-2 mb-3">' +
                '<div class="text-xs text-slate-500 mb-1">Rate-ceiling headroom (launch 10.25% → top 16%)</div>' +
                '<div class="relative h-6 rounded bg-slate-100 dark:bg-slate-700">' +
                    '<div class="absolute top-0 left-0 h-full rounded-l bg-gradient-to-r from-green-400 via-amber-400 to-red-500" style="width:' + pctAcross(currRate).toFixed(2) + '%; opacity:0.5"></div>' +
                    '<div class="absolute top-0 h-full border-l-2 border-amber-600" style="left:' + pctAcross(midRate).toFixed(2) + '%"><div class="absolute -top-4 -translate-x-1/2 text-[10px] font-semibold text-amber-700">14%</div></div>' +
                    '<div class="absolute top-0 h-full border-l-2 border-red-600" style="left:' + pctAcross(topRate).toFixed(2) + '%"><div class="absolute -top-4 -translate-x-1/2 text-[10px] font-semibold text-red-700">16%</div></div>' +
                    '<div class="absolute top-0 h-full border-l-2 border-blue-600" style="left:' + pctAcross(currRate).toFixed(2) + '%"><div class="absolute -bottom-4 -translate-x-1/2 text-[10px] font-semibold text-blue-700">' + (currRate * 100).toFixed(2) + '%</div></div>' +
                '</div>' +
                '<div class="text-xs text-slate-500 mt-5">' +
                    (midCycles != null ? midCycles + ' stress ' + (midCycles === 1 ? 'cycle' : 'cycles') + ' to 14% ceiling' : '—') +
                    (topCycles != null ? ' · ' + topCycles + ' to 16%' : '') +
                    ' · one stress cycle ≈ 125 bp (observed Oct 2025 → Mar 2026)' +
                '</div>' +
            '</div>';

        var ceilingCaption =
            '<div class="text-xs text-slate-500 italic mt-2 leading-relaxed">' +
                'STRC rate trends monotonically upward (sticky on recovery — framework §IV.5). ' +
                'At ~14–16% Strategy may elect dividend suspension over further hikes.' +
            '</div>';

        var ceilingSubPanel =
            '<div class="rounded-lg border border-slate-200 dark:border-slate-700 p-4 mt-4 bg-slate-50/40 dark:bg-slate-800/30">' +
                '<div class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Rate-ceiling overlay <span class="text-xs font-normal text-slate-500">— framework §IV.5</span></div>' +
                ceilingRow +
                headroomBar +
                ceilingCaption +
            '</div>';

        // ---- Treasury available table.
        var btcStack = assum.btc_stack;
        var btcStackUsd = (btcStack != null && btcPx) ? btcStack * btcPx : null;
        var mnavTxt = (mnav.value != null) ? mnav.value.toFixed(4) : '—';
        var atmStatus = (mnav.value != null && mnav.value < 1.0) ? 'Offline (mNAV ' + mnavTxt + ' < 1.0)' : 'Live (mNAV ' + mnavTxt + ')';
        var atmCls = (mnav.value != null && mnav.value < 1.0) ? 'text-orange-700' : 'text-green-700';
        var treasuryTable =
            '<div class="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-6 mb-2">Treasury available</div>' +
            '<div class="data-table-scroll">' +
                '<table class="data-table">' +
                    '<thead><tr><th>Source</th><th>Value</th><th>Note</th></tr></thead>' +
                    '<tbody>' +
                        '<tr><td class="font-medium">Cash on balance sheet</td><td class="font-mono">~$0.5–1B</td><td class="text-xs text-slate-500">First-line dividend service · BTC sales not triggered until depleted</td></tr>' +
                        '<tr><td class="font-medium">BTC stack</td><td class="font-mono">' + MSTRRenderer._fmtMoneyShort(btcStackUsd) + '</td><td class="text-xs text-slate-500">Second-line (activated when cash exhausted) · ' + MSTRRenderer._fmtNum(btcStack) + ' BTC @ ' + MSTRRenderer._fmtMoney(btcPx, 0) + '</td></tr>' +
                        '<tr><td class="font-medium">Software cash flow</td><td class="font-mono">≈ $0</td><td class="text-xs text-slate-500">Immaterial</td></tr>' +
                        '<tr><td class="font-medium">ATM equity</td><td class="font-mono ' + atmCls + '">' + atmStatus + '</td><td class="text-xs text-slate-500">Accretive only at mNAV ≥ 1.0</td></tr>' +
                        '<tr><td class="font-medium">Preferred re-issuance</td><td class="font-mono">Tappable</td><td class="text-xs text-slate-500">…but compounds the obligation</td></tr>' +
                    '</tbody>' +
                '</table>' +
            '</div>';

        // ---- Caveat block.
        var caveat =
            '<div class="risk-flag risk-warning mt-4">' +
                '<strong>Caveat.</strong> Runway assumes flat BTC, frozen preferred outstanding, and frozen rates. ' +
                'All three are fragile — a BTC bear case + continued preferred growth + rising STRC rate could collapse runway materially. ' +
                'The rate-ceiling overlay shows the <em>rate stress dimension only</em> — it does NOT compound with BTC stress; in a joint stress scenario, runway compresses faster than either alone. ' +
                'See <a href="https://github.com/todayindefi/riskAnalyst/blob/master/assets/_frameworks/strc-framework.md" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline">framework §IV</a> (waterfall) and §IV.5 (rate-ratchet thesis).' +
            '</div>';

        // ---- History charts (runway over time + STRC rate trajectory).
        var historyCharts =
            '<div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">' +
                '<div>' +
                    '<div class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Runway over time (3 series)</div>' +
                    '<div style="height: 220px; position: relative;"><canvas id="mstr-runway-chart"></canvas></div>' +
                '</div>' +
                '<div>' +
                    '<div class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">STRC rate trajectory <span class="text-xs font-normal text-slate-500">— §IV.5 one-way ratchet</span></div>' +
                    '<div style="height: 220px; position: relative;"><canvas id="mstr-rate-trajectory-chart"></canvas></div>' +
                    '<div class="text-xs text-slate-500 italic mt-1">Stress cycles ratchet up; recovery does not ratchet down.</div>' +
                '</div>' +
            '</div>';

        // ---- Headline strip: promote the sequenced sale-start date when the
        // block is present; preserve the legacy BTC-only headline otherwise.
        var headlineStrip;
        if (seq) {
            var saleStart = seq.btc_sale_start_date_approx;
            var p1AggMonths = (seq.phase1_cash_months || {}).total_preferred_plus_interest;
            var saleCls = (p1AggMonths != null && p1AggMonths < 6) ? 'text-red-700 dark:text-red-300' :
                          (p1AggMonths != null && p1AggMonths < 12) ? 'text-amber-700 dark:text-amber-300' :
                          'text-slate-800 dark:text-slate-100';
            var saleBorder = (p1AggMonths != null && p1AggMonths < 6) ? 'border-red-300 bg-red-50 dark:bg-red-900/20' :
                             (p1AggMonths != null && p1AggMonths < 12) ? 'border-amber-300 bg-amber-50 dark:bg-amber-900/10' :
                             'border-slate-200 dark:border-slate-700';
            headlineStrip =
                '<div class="flex flex-col md:flex-row md:items-stretch md:gap-6 mb-4 p-4 rounded-lg border ' + saleBorder + '">' +
                    '<div class="flex-1 md:border-r md:pr-6 md:border-slate-200 md:dark:border-slate-700">' +
                        '<div class="text-xs uppercase font-semibold text-slate-500">BTC-sale window opens (aggregate basis)</div>' +
                        '<div class="text-xs text-slate-500 mt-0.5">First-line cash service exhausts — Phase 2 BTC sales begin</div>' +
                        '<div class="text-5xl font-bold mt-2 ' + saleCls + '">' + (saleStart || '—') + '</div>' +
                        '<div class="text-xs text-slate-500 mt-1 font-mono">' +
                            (p1AggMonths != null ? '~' + p1AggMonths.toFixed(1) + ' months out · ' : '') +
                            'zero-issuance assumption · binding signal for portfolio decisions' +
                        '</div>' +
                    '</div>' +
                    '<div class="flex-1 md:pl-6 mt-4 md:mt-0">' +
                        '<div class="text-xs uppercase font-semibold text-slate-500">Long-term solvency (BTC-only)</div>' +
                        '<div class="text-xs text-slate-500 mt-0.5">Phase 2 horizon after cash exhausts — flat BTC</div>' +
                        '<div class="text-3xl font-bold mt-2 ' + runwayCls + '">' + (headlineRunway != null ? headlineRunway + ' years' : '—') + '</div>' +
                        '<div class="text-xs text-slate-500 mt-1 font-mono">' +
                            MSTRRenderer._fmtMoneyShort(obl.total) + '/yr aggregate · ' +
                            MSTRRenderer._fmtNum(btcYr.total_preferred_plus_interest) + ' BTC/yr @ ' + MSTRRenderer._fmtMoney(btcPx, 0) +
                        '</div>' +
                    '</div>' +
                '</div>';
        } else {
            headlineStrip =
                '<div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4 p-4 rounded-lg border ' + (headlineRunway != null && headlineRunway < 25 ? 'border-orange-300 bg-orange-50 dark:bg-orange-900/20' : 'border-slate-200 dark:border-slate-700') + '">' +
                    '<div>' +
                        '<div class="text-xs uppercase font-semibold text-slate-500">Aggregate-preferred runway (flat BTC)</div>' +
                        '<div class="text-5xl font-bold mt-1 ' + runwayCls + '">' + (headlineRunway != null ? headlineRunway + ' years' : '—') + '</div>' +
                        '<div class="text-xs text-slate-500 mt-1">' +
                            MSTRRenderer._fmtMoneyShort(obl.total) + '/yr aggregate · ' +
                            MSTRRenderer._fmtNum(btcYr.total_preferred_plus_interest) + ' BTC/yr @ ' + MSTRRenderer._fmtMoney(btcPx, 0) +
                        '</div>' +
                    '</div>' +
                    '<div class="text-xs text-slate-500 max-w-md leading-relaxed">' +
                        'Color bands: >40 yr green · 25–40 yr amber · 15–25 yr orange · &lt;15 yr red. ' +
                        'Assumes flat BTC price, frozen outstanding, frozen rates.' +
                    '</div>' +
                '</div>';
        }

        return '<div class="panel">' +
            '<div class="panel-title">Cash-Service Waterfall <span class="text-xs font-normal text-slate-500">— senior → junior preferred service + rate-ceiling overlay</span></div>' +
            headlineStrip +
            // Seniority waterfall.
            '<div class="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-2 mb-2">Seniority waterfall</div>' +
            '<div class="data-table-scroll mb-4">' +
                '<table class="data-table">' +
                    '<thead><tr><th>Tier</th><th>Series</th><th class="text-right">Face / outstanding</th><th class="text-right">Annual</th><th class="text-right">BTC/yr</th><th>Note</th></tr></thead>' +
                    '<tbody>' + waterfallRows + '</tbody>' +
                '</table>' +
            '</div>' +
            // Three runway readouts (long-term, flat BTC).
            '<div class="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-4 mb-2">Phase 2 BTC-only runway by obligation slice</div>' +
            runwayRow +
            // Cash runway (short-term, no-issuance stress).
            cashSubPanel +
            // Sequenced runway (cash Phase 1 into BTC-sale Phase 2).
            seqSubPanel +
            // Rate-ceiling overlay (STRC-specific stress).
            ceilingSubPanel +
            // Treasury table.
            treasuryTable +
            // Caveat.
            caveat +
            // Two history charts.
            historyCharts +
        '</div>';
    },

    _paintRunwayChart: function (series) {
        var ctx = document.getElementById('mstr-runway-chart');
        if (!ctx) return;
        var strcOnly = MSTRRenderer._seriesXY(series, 'runway_strc_only_years');
        var seniorToStrc = MSTRRenderer._seriesXY(series, 'runway_senior_to_strc_years');
        var total = MSTRRenderer._seriesXY(series, 'runway_total_years');
        var ann = {
            green:  { type: 'line', yMin: 40, yMax: 40, borderColor: '#22c55e', borderWidth: 1, borderDash: [4, 4],
                      label: { content: '40 yr · green', display: true, position: 'end', font: { size: 9 }, color: '#16a34a' } },
            amber:  { type: 'line', yMin: 25, yMax: 25, borderColor: '#f59e0b', borderWidth: 1, borderDash: [4, 4],
                      label: { content: '25 yr · amber', display: true, position: 'end', font: { size: 9 }, color: '#d97706' } },
            red:    { type: 'line', yMin: 15, yMax: 15, borderColor: '#ef4444', borderWidth: 1, borderDash: [4, 4],
                      label: { content: '15 yr · red', display: true, position: 'end', font: { size: 9 }, color: '#dc2626' } }
        };
        if (window._mstrRunwayChart) window._mstrRunwayChart.destroy();
        window._mstrRunwayChart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [
                    { label: 'STRC only', data: strcOnly, borderColor: '#3b82f6', backgroundColor: 'transparent', tension: 0.3, pointRadius: 0, borderWidth: 1.5 },
                    { label: 'Senior-to-STRC', data: seniorToStrc, borderColor: '#a855f7', backgroundColor: 'transparent', tension: 0.3, pointRadius: 0, borderWidth: 1.5 },
                    { label: 'Total', data: total, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.08)', fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2 }
                ]
            },
            options: Object.assign({}, MSTRRenderer._baseChartOpts(ann), {
                plugins: {
                    legend: { display: true, position: 'top', labels: { boxWidth: 10, font: { size: 10 } } },
                    annotation: { annotations: ann }
                }
            })
        });
    },

    _paintRateTrajectoryChart: function (series) {
        var ctx = document.getElementById('mstr-rate-trajectory-chart');
        if (!ctx) return;
        var raw = MSTRRenderer._seriesXY(series, 'strc_current_rate');
        var data = raw.map(function (p) { return { x: p.x, y: p.y * 100 }; });
        var ann = {
            launch: { type: 'line', yMin: 10.25, yMax: 10.25, borderColor: '#22c55e', borderWidth: 1, borderDash: [3, 3],
                      label: { content: '10.25% launch', display: true, position: 'end', font: { size: 9 }, color: '#16a34a' } },
            mid:    { type: 'line', yMin: 14, yMax: 14, borderColor: '#f59e0b', borderWidth: 1, borderDash: [4, 4],
                      label: { content: '14% mid-ceiling', display: true, position: 'end', font: { size: 9 }, color: '#d97706' } },
            top:    { type: 'line', yMin: 16, yMax: 16, borderColor: '#ef4444', borderWidth: 1, borderDash: [4, 4],
                      label: { content: '16% top-ceiling', display: true, position: 'end', font: { size: 9 }, color: '#dc2626' } }
        };
        if (window._mstrRateTrajChart) window._mstrRateTrajChart.destroy();
        window._mstrRateTrajChart = new Chart(ctx, {
            type: 'line',
            data: { datasets: [{
                label: 'STRC rate (%)',
                data: data,
                borderColor: '#0ea5e9',
                backgroundColor: 'rgba(14,165,233,0.1)',
                fill: true, stepped: true, pointRadius: 2, borderWidth: 2
            }] },
            options: Object.assign({}, MSTRRenderer._baseChartOpts(ann), {
                scales: {
                    x: { type: 'time', time: { unit: 'day', displayFormats: { day: 'MMM d' } }, grid: { display: false }, ticks: { maxTicksLimit: 6, font: { size: 10 } } },
                    y: { grid: { color: '#f1f5f9' }, ticks: { callback: function (v) { return v + '%'; }, font: { size: 10 } } }
                },
                plugins: { legend: { display: false }, annotation: { annotations: ann } }
            })
        });
    },

    // ============================================================
    // Panel 6 — Per-share BTC NAV trajectory (LOAD-BEARING)
    // ============================================================
    _renderPerShareNavTrajectory: function (tradfi, mv) {
        var mstr = tradfi.mstr || {};
        var nav = mv.btc_nav_per_share_usd;
        var pdFrac = mv.premium_discount_pct;
        var pdCls = MSTRRenderer._pdClass(pdFrac);

        return '<div class="panel">' +
            '<div class="panel-title">Per-share BTC NAV trajectory <span class="text-xs font-normal text-slate-500">— equity-holder headline metric</span></div>' +
            '<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">' +
                '<div class="rounded-lg border border-slate-200 dark:border-slate-700 p-3">' +
                    '<div class="text-xs uppercase font-semibold text-slate-500">Per-share BTC NAV</div>' +
                    '<div class="text-2xl font-bold mt-1">' + (nav != null ? MSTRRenderer._fmtMoney(nav, 2) : '—') + '</div>' +
                '</div>' +
                '<div class="rounded-lg border border-slate-200 dark:border-slate-700 p-3">' +
                    '<div class="text-xs uppercase font-semibold text-slate-500">MSTR price</div>' +
                    '<div class="text-2xl font-bold mt-1">' + (mstr.price_usd != null ? MSTRRenderer._fmtMoney(mstr.price_usd, 2) : '—') + '</div>' +
                '</div>' +
                '<div class="rounded-lg border border-slate-200 dark:border-slate-700 p-3">' +
                    '<div class="text-xs uppercase font-semibold text-slate-500">Premium / discount</div>' +
                    '<div class="text-2xl font-bold mt-1 ' + pdCls + '">' + (pdFrac != null ? (pdFrac > 0 ? '+' : '') + MSTRRenderer._fmtPct(pdFrac, 1) : '—') + '</div>' +
                '</div>' +
            '</div>' +
            '<div style="height: 280px; position: relative;"><canvas id="mstr-pershare-chart"></canvas></div>' +
            '<div class="text-xs text-slate-500 mt-3 leading-relaxed">' +
                'Vertical markers denote major EDGAR-filed dilution events (PREFERRED_ISSUANCE, ATM_PROGRAM_UPDATE). ' +
                'Per-share BTC NAV growth is the structural equity-holder thesis — see ' +
                '<a href="https://github.com/todayindefi/biz/blob/master/assets/mstr.md" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline">mstr.md framework</a>. ' +
                'Trajectory series populates over time (sparse early as the analyzer began emitting the field on 2026-05-30).' +
            '</div>' +
        '</div>';
    },

    // ============================================================
    // Panel 7 — Dilution + maturity wall combined
    // ============================================================
    _renderDilutionMaturityWall: function (mv) {
        var atm = mv.atm_cadence_90d || {};
        var wall = Array.isArray(mv.convertible_maturity_wall) ? mv.convertible_maturity_wall : [];

        // Left half — ATM cadence table.
        function atmRow(label, usd, note) {
            return '<tr>' +
                '<td class="font-medium">' + label + '</td>' +
                '<td class="text-right font-mono">' + MSTRRenderer._fmtMoneyShort(usd) + '</td>' +
                '<td class="text-xs text-slate-500">' + (note || '') + '</td>' +
            '</tr>';
        }
        var btcUsd = (atm.btc_purchased_count != null && atm.btc_purchased_count > 0) ?
            null : null; // analyzer doesn't carry a price; show BTC count instead in note
        var atmRows =
            atmRow('MSTR ATM volume', atm.mstr_atm_count_usd, 'Common equity sales — dilutive when below mNAV parity') +
            atmRow('STRC ATM volume', atm.strc_atm_count_usd, 'Preferred issuance — adds to perpetual dividend obligation') +
            atmRow('Convertible buybacks', atm.buyback_count_usd, 'Liability management — reduces 2027–2032 maturity wall') +
            '<tr>' +
                '<td class="font-medium">BTC purchased</td>' +
                '<td class="text-right font-mono">' + MSTRRenderer._fmtNum(atm.btc_purchased_count) + ' BTC</td>' +
                '<td class="text-xs text-slate-500">Net new treasury accumulation (rolling 90d)</td>' +
            '</tr>';

        // Right half — maturity wall: sum cash-likely (deep_otm) face.
        var cashLikelySum = wall.reduce(function (acc, t) {
            return acc + ((t && t.deep_otm) ? (t.face_usd_due || 0) : 0);
        }, 0);
        var totalFace = wall.reduce(function (acc, t) {
            return acc + ((t && t.face_usd_due != null) ? t.face_usd_due : 0);
        }, 0);

        return '<div class="panel">' +
            '<div class="panel-title">Dilution + maturity wall</div>' +
            '<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">' +
                // LEFT — ATM cadence
                '<div>' +
                    '<div class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">ATM cadence — rolling 90d</div>' +
                    '<div class="data-table-scroll">' +
                        '<table class="data-table">' +
                            '<thead><tr><th>Activity</th><th class="text-right">Volume</th><th>Note</th></tr></thead>' +
                            '<tbody>' + atmRows + '</tbody>' +
                        '</table>' +
                    '</div>' +
                    '<div class="text-xs text-slate-500 mt-2 italic">Source: ' + (atm.source || 'strategy_events.json aggregation') + '</div>' +
                '</div>' +
                // RIGHT — Maturity wall
                '<div>' +
                    '<div class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Convertible maturity wall</div>' +
                    '<div style="height: 240px; position: relative;"><canvas id="mstr-maturity-chart"></canvas></div>' +
                    '<div class="text-xs text-slate-500 mt-2">' +
                        'Cash-settlement-likely face (deep OTM): ' +
                        '<span class="font-mono font-semibold text-red-700 dark:text-red-300">' + MSTRRenderer._fmtMoneyShort(cashLikelySum) + '</span>' +
                        ' of ' + MSTRRenderer._fmtMoneyShort(totalFace) + ' total. ' +
                        'Recent pattern: convert buybacks funded by MSTR ATM + new STRC issuance (see 5/26 transaction).' +
                    '</div>' +
                '</div>' +
            '</div>' +
        '</div>';
    },

    // ============================================================
    // Freshness footer (mirrors STRC)
    // ============================================================
    _renderFreshness: function (data) {
        var ts = data.timestamp_utc || data.timestamp;
        var age = data.freshness_seconds;
        var ageTxt = '';
        if (age != null) {
            if (age < 60) ageTxt = age + 's ago';
            else if (age < 3600) ageTxt = Math.round(age / 60) + 'm ago';
            else if (age < 86400) ageTxt = Math.round(age / 3600) + 'h ago';
            else ageTxt = Math.round(age / 86400) + 'd ago';
        }
        return '<div class="text-xs text-slate-500 mt-4 text-center">' +
            'Data refreshed ' + (ts ? CommonRenderer.formatDate(ts) : '—') +
            (ageTxt ? ' (' + ageTxt + ')' : '') +
            ' · source <span class="font-mono">strc_backing.json</span>' +
            ' · framework_version <span class="font-mono">' + (data.framework_version || '—') + '</span>' +
        '</div>';
    },

    // ============================================================
    // Chart paint helpers
    // ============================================================
    _baseChartOpts: function (annotations) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            scales: {
                x: {
                    type: 'time',
                    time: { unit: 'day', displayFormats: { day: 'MMM d' } },
                    grid: { display: false },
                    ticks: { maxTicksLimit: 6, font: { size: 10 } }
                },
                y: {
                    grid: { color: '#f1f5f9' },
                    ticks: { font: { size: 10 } }
                }
            },
            plugins: {
                legend: { display: false },
                annotation: annotations ? { annotations: annotations } : undefined,
                tooltip: { intersect: false, mode: 'index' }
            },
            interaction: { intersect: false, mode: 'index' }
        };
    },

    _seriesXY: function (series, field) {
        return series.filter(function (p) { return p && p[field] != null && p.ts; }).map(function (p) {
            var ts = p.ts.endsWith('Z') ? p.ts : p.ts + 'Z';
            return { x: new Date(ts), y: p[field] };
        });
    },

    _paintCapitalStructureChart: function (mv) {
        var ctx = document.getElementById('mstr-capital-stack-chart');
        if (!ctx) return;
        var cap = mv.capital_structure || {};

        // Single stacked horizontal bar — most senior at bottom.
        var labels = ['Capital'];
        var datasets = [
            { label: 'Senior converts',   data: [cap.senior_convertible_debt_usd || 0],         backgroundColor: '#475569' },
            { label: 'STRF preferred',    data: [cap.strf_preferred_usd || 0],                  backgroundColor: '#94a3b8' },
            { label: 'STRC preferred',    data: [cap.strc_preferred_usd_est || 0],              backgroundColor: '#3b82f6' },
            { label: 'STRK + STRD',       data: [cap.strk_strd_preferred_residual_usd || 0],    backgroundColor: '#a78bfa' },
            { label: 'Common equity',     data: [cap.common_equity_market_cap_usd || 0],        backgroundColor: '#fbbf24' }
        ];

        if (window._mstrCapStackChart) window._mstrCapStackChart.destroy();
        window._mstrCapStackChart = new Chart(ctx, {
            type: 'bar',
            data: { labels: labels, datasets: datasets },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                scales: {
                    x: {
                        stacked: true,
                        ticks: {
                            font: { size: 10 },
                            callback: function (v) {
                                var n = Number(v);
                                if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(0) + 'B';
                                if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(0) + 'M';
                                return '$' + n;
                            }
                        },
                        grid: { color: '#f1f5f9' }
                    },
                    y: { stacked: true, grid: { display: false }, ticks: { font: { size: 10 } } }
                },
                plugins: {
                    legend: { display: true, position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } },
                    tooltip: {
                        callbacks: {
                            label: function (c) {
                                var v = c.raw;
                                return c.dataset.label + ': ' + MSTRRenderer._fmtMoneyShort(v);
                            }
                        }
                    }
                }
            }
        });
    },

    _paintMaturityWallChart: function (mv) {
        var ctx = document.getElementById('mstr-maturity-chart');
        if (!ctx) return;
        var wall = Array.isArray(mv.convertible_maturity_wall) ? mv.convertible_maturity_wall : [];
        var labels = wall.map(function (t) { return String(t.year); });
        var values = wall.map(function (t) { return t.face_usd_due || 0; });
        var colors = wall.map(function (t) { return t.deep_otm ? '#dc2626' : '#16a34a'; });

        if (window._mstrMaturityChart) window._mstrMaturityChart.destroy();
        window._mstrMaturityChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Face due (USD)',
                    data: values,
                    backgroundColor: colors,
                    borderColor: colors,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                scales: {
                    x: { grid: { display: false }, ticks: { font: { size: 10 } } },
                    y: {
                        grid: { color: '#f1f5f9' },
                        ticks: {
                            font: { size: 10 },
                            callback: function (v) {
                                var n = Number(v);
                                if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
                                if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(0) + 'M';
                                return '$' + n;
                            }
                        }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function (c) {
                                var t = wall[c.dataIndex] || {};
                                var tag = t.deep_otm ? ' · deep OTM → likely cash settlement' : ' · in-the-money path possible';
                                return MSTRRenderer._fmtMoneyShort(c.raw) + tag;
                            }
                        }
                    }
                }
            }
        });
    },

    _loadHistoryAndPaintTrajectory: function (tradfi, mv) {
        var nocache = Math.floor(Date.now() / 60000);
        Promise.all([
            fetch('data/strc_backing_history.json?nocache=' + nocache).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
            fetch('data/strategy_events.json?nocache=' + nocache).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
        ]).then(function (results) {
            var hist = results[0];
            var events = results[1];
            var series = (hist && Array.isArray(hist.series)) ? hist.series : [];
            MSTRRenderer._paintMnavChart(series);
            MSTRRenderer._paintPerShareNavChart(series, tradfi, mv, events);
            MSTRRenderer._paintRunwayChart(series);
            MSTRRenderer._paintRateTrajectoryChart(series);
        });
    },

    _paintMnavChart: function (series) {
        var ctx = document.getElementById('mstr-mnav-chart');
        if (!ctx) return;
        var data = MSTRRenderer._seriesXY(series, 'mnav');
        var ann = {
            parity:   { type: 'line', yMin: 1.00, yMax: 1.00, borderColor: '#22c55e', borderWidth: 1, borderDash: [4, 4],
                        label: { content: 'parity 1.00', display: true, position: 'end', font: { size: 9 }, color: '#16a34a' } },
            discount: { type: 'line', yMin: 0.95, yMax: 0.95, borderColor: '#f59e0b', borderWidth: 1, borderDash: [4, 4],
                        label: { content: 'discount 0.95', display: true, position: 'end', font: { size: 9 }, color: '#d97706' } },
            distress: { type: 'line', yMin: 0.85, yMax: 0.85, borderColor: '#ef4444', borderWidth: 1, borderDash: [4, 4],
                        label: { content: 'distress 0.85', display: true, position: 'end', font: { size: 9 }, color: '#dc2626' } }
        };
        if (window._mstrMnavChart) window._mstrMnavChart.destroy();
        window._mstrMnavChart = new Chart(ctx, {
            type: 'line',
            data: { datasets: [{
                label: 'mNAV',
                data: data,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59,130,246,0.1)',
                fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2
            }] },
            options: MSTRRenderer._baseChartOpts(ann)
        });
    },

    _paintPerShareNavChart: function (series, tradfi, mv, events) {
        var ctx = document.getElementById('mstr-pershare-chart');
        if (!ctx) return;

        var navSeries = MSTRRenderer._seriesXY(series, 'btc_nav_per_share_usd');
        // Fallback: derive per-share NAV from raw history fields when the
        // analyzer-emitted field isn't populated yet (history was emitting
        // the raw inputs before the b436aa6 schema change).
        if (navSeries.length === 0) {
            var shareCount = mv.share_count;
            var holdings = (tradfi.strategy_btc_holdings && tradfi.strategy_btc_holdings.count) || null;
            if (shareCount) {
                navSeries = series.filter(function (p) {
                    return p && p.ts && p.btc_price != null && (p.mstr_share_count != null || holdings != null);
                }).map(function (p) {
                    var ts = p.ts.endsWith('Z') ? p.ts : p.ts + 'Z';
                    var sc = p.mstr_share_count || shareCount;
                    var btcCount = p.strategy_btc_count != null ? p.strategy_btc_count : holdings;
                    var nav = (btcCount != null && sc) ? (p.btc_price * btcCount) / sc : null;
                    return nav != null ? { x: new Date(ts), y: nav } : null;
                }).filter(function (x) { return x != null; });
            }
        }
        var mstrSeries = MSTRRenderer._seriesXY(series, 'mstr_price');

        // Vertical markers for EDGAR dilution events.
        var ann = {};
        var mstrPrice = (tradfi.mstr && tradfi.mstr.price_usd) || null;
        if (mstrPrice != null) {
            ann.currentMstr = {
                type: 'line', yMin: mstrPrice, yMax: mstrPrice,
                borderColor: '#6366f1', borderWidth: 1, borderDash: [4, 4],
                label: { content: 'MSTR ' + MSTRRenderer._fmtMoney(mstrPrice, 0), display: true, position: 'start', font: { size: 9 }, color: '#4f46e5' }
            };
        }
        if (events && Array.isArray(events.events)) {
            var dilutionTypes = { PREFERRED_ISSUANCE: '#f59e0b', ATM_PROGRAM_UPDATE: '#a855f7' };
            events.events.forEach(function (e, i) {
                if (!e || !e.ts_utc) return;
                var color = dilutionTypes[e.type];
                if (!color) return;
                var ts = e.ts_utc.endsWith('Z') ? e.ts_utc : e.ts_utc + 'Z';
                var x = new Date(ts).getTime();
                ann['ev' + i] = {
                    type: 'line',
                    xMin: x, xMax: x,
                    borderColor: color, borderWidth: 1, borderDash: [2, 3],
                    label: { content: e.type.replace(/_/g, ' '), display: false }
                };
            });
        }

        if (window._mstrPerShareChart) window._mstrPerShareChart.destroy();
        window._mstrPerShareChart = new Chart(ctx, {
            type: 'line',
            data: { datasets: [
                {
                    label: 'Per-share BTC NAV',
                    data: navSeries,
                    borderColor: '#0ea5e9',
                    backgroundColor: 'rgba(14,165,233,0.15)',
                    fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2
                },
                {
                    label: 'MSTR price',
                    data: mstrSeries,
                    borderColor: '#6366f1',
                    backgroundColor: 'transparent',
                    tension: 0.3, pointRadius: 0, borderWidth: 1.5, borderDash: [3, 3]
                }
            ] },
            options: Object.assign({}, MSTRRenderer._baseChartOpts(ann), {
                plugins: {
                    legend: { display: true, position: 'top', labels: { boxWidth: 10, font: { size: 10 } } },
                    annotation: { annotations: ann },
                    tooltip: {
                        intersect: false, mode: 'index',
                        callbacks: {
                            label: function (c) {
                                return c.dataset.label + ': ' + MSTRRenderer._fmtMoney(c.raw.y, 2);
                            }
                        }
                    }
                }
            })
        });
    }
};
