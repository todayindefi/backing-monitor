/**
 * STRC renderer — Strategy Series A Perpetual Preferred Stock (STRC) +
 * Backed STRCx on-chain wrapper.
 *
 * Mixes TradFi market data (mNAV, MSTR/BTC, STRC secondary, dividend rate)
 * with on-chain STRCx wrapper state (multi-chain supply, top holders,
 * multiplier) and downstream portfolio exposure (Apyx + Saturn).
 *
 * Schema diverges from the standard backing-monitor shape: top-level
 * `tradfi`, `wrapper_strcx`, `downstream_exposure` instead of `summary` +
 * `backing_breakdown`. preRender() backfills hidden scaffolding so common.js
 * renderers don't NPE; render() then suppresses the common panels and paints
 * its own 7-panel layout.
 *
 * History file (data/strc_backing_history.json) is `{series: [...]}` not
 * `{entries: [...]}`, so CommonRenderer.renderCRChart short-circuits.
 *
 * Framework: ~/riskAnalyst/assets/_frameworks/strc-framework.md
 * Analyzer:  PegTracker strc_backing_analyzer.py
 */

// STRC dividend cadence: monthly → semi-monthly effective 2026-06-30 (rate
// unchanged at 11.50%, per SEC 8-K A&R Certificate of Designations
// 0001193125-26-270366). Namespaced top-level fallbacks — these renderer files
// share JS global scope, so NEVER use a bare `frequency`/`effective`. Driven off
// the PegTracker JSON fields (strc_dividend_frequency / semi_monthly_effective)
// when present; these constants are the fallback until the analyzer republishes.
var STRC_DIVIDEND_FREQUENCY = 'semi-monthly';
var STRC_SEMIMONTHLY_EFFECTIVE = '2026-06-30';

var STRCRenderer = {

    // ============================================================
    // helpers
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
    _truncAddr: function (addr) {
        if (!addr) return '—';
        return addr.slice(0, 6) + '…' + addr.slice(-4);
    },
    _etherscanLink: function (addr, label) {
        if (!addr) return '';
        return '<a href="https://etherscan.io/address/' + addr + '" target="_blank" rel="noopener noreferrer" ' +
            'class="text-blue-500 hover:underline text-xs" title="' + addr + '">' + (label || '↗') + '</a>';
    },

    // mNAV regime → border/background/text classes. Green/amber/orange/red
    // for premium/parity/discount/distress (per framework regime thresholds).
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

    // STRC secondary-price color band — per handoff thresholds.
    // green $99.50–$100.50 · amber $98–$101.50 · orange $95–$103 · red outside
    _strcPriceClass: function (p) {
        if (p == null) return 'text-slate-700 dark:text-slate-200';
        if (p >= 99.5 && p <= 100.5) return 'text-green-700 dark:text-green-300';
        if (p >= 98 && p <= 101.5)   return 'text-amber-700 dark:text-amber-300';
        if (p >= 95 && p <= 103)     return 'text-orange-700 dark:text-orange-300';
        return 'text-red-700 dark:text-red-300';
    },

    // Strategy announces the next STRC rate near mid-month for the following
    // month. Estimate the next mid-month tick using the real clock (data may
    // be hours stale; countdown should reflect actual time-to-decision).
    _nextRateDecision: function () {
        var now = new Date();
        var y = now.getUTCFullYear();
        var m = now.getUTCMonth();
        var candidate = new Date(Date.UTC(y, m, 15));
        if (candidate.getTime() <= now.getTime()) {
            candidate = new Date(Date.UTC(y, m + 1, 15));
        }
        var daysAway = Math.ceil((candidate.getTime() - now.getTime()) / 86400000);
        return { date: candidate, daysAway: daysAway };
    },

    _mnavCaption: function (regime) {
        if (regime === 'premium')  return 'ATM equity issuance accretive — BTC accumulation funding model intact.';
        if (regime === 'parity')   return 'ATM marginally accretive — funding model under mild compression.';
        if (regime === 'discount') return 'ATM equity issuance dilutive vs gross BTC NAV. BTC-accumulation funding leg compressed; STRC issuance + BTC sales the load-bearing legs for preferred service.';
        if (regime === 'distress') return 'Funding model under acute stress. STRC dividend coverage analysis required.';
        return '—';
    },

    _renderCommonBtcCoverageLine: function (tradfi) {
        var coverage = (tradfi.common_btc_coverage || {}).value;
        if (coverage == null) return '';
        return '<div class="text-xs text-slate-500 mt-3 leading-snug border-t border-slate-200 dark:border-slate-700 pt-3">' +
            'Common-equity coverage (MktCap/BTC) = <span class="font-semibold">' + coverage.toFixed(2) + '</span>. ' +
            'Leverage indicator only — NOT mNAV. Less than 1.0 is mechanically expected with $22B of senior claims ahead of common.' +
        '</div>';
    },

    // ============================================================
    // preRender — runs before common.renderSummaryCards / renderBreakdown.
    // Scaffold the standard schema so common.js doesn't NPE; render()
    // hides the common panels and paints the STRC-specific layout.
    // ============================================================
    preRender: function (data) {
        if (!data) return;

        var tradfi = data.tradfi || {};
        var wrapper = data.wrapper_strcx || {};
        var supplyUsd = wrapper.total_supply_usd || 0;
        var mnavValue = (tradfi.mnav && tradfi.mnav.value != null) ? tradfi.mnav.value : null;

        // Header alias — common path renders "<asset> (<chain>)" in the
        // subtitle; bare "strc" is too terse.
        if (data.asset === 'strc') data.asset = 'STRC + STRCx';
        if (!data.chain) data.chain = 'NYSE + multi-chain wrapper';
        if (!data.timestamp && data.timestamp_utc) data.timestamp = data.timestamp_utc;

        // Synthesize summary for common.renderSummaryCards. The whole strip
        // is hidden in _suppressCommonPanels, so values here never paint —
        // they only need to exist to avoid NPE on `s.collateral_ratio_alt.label`.
        if (!data.summary) {
            data.summary = {
                total_supply: supplyUsd,
                total_backing: supplyUsd,
                collateral_ratio: 100,
                collateral_ratio_alt: {
                    label: 'mNAV',
                    value: mnavValue != null ? mnavValue * 100 : 0,
                    is_currency: false
                },
                surplus_deficit: 0
            };
        }
        if (!Array.isArray(data.backing_breakdown)) data.backing_breakdown = [];
        if (!data.asset_specific) data.asset_specific = { type: 'strc' };
    },

    // ============================================================
    // render — entry point.
    // ============================================================
    render: function (data) {
        var container = document.getElementById('asset-specific-panels');
        if (!container) return;

        STRCRenderer._suppressCommonPanels(data);

        var tradfi = data.tradfi || {};
        var wrapper = data.wrapper_strcx || {};
        var downstream = data.downstream_exposure || {};
        var riskFlags = data.risk_flags || [];

        // 7-panel layout (post-reorg):
        //   1. STRC headline (instrument-native)
        //   2. STRC instrument (rate mechanics + secondary chart)
        //   3. STRC dividend obligation + STRC-only runway + rate-ceiling
        //   4. STRCx wrapper (on-chain multi-chain mirror)
        //   5. Downstream portfolio exposure
        //   6. Dependency: Strategy Funding Regime (mNAV + issuer snapshot)
        //   7. Strategy event log (EDGAR)
        // Issuer-side analysis (capital structure, full cash-service
        // waterfall, per-share BTC NAV) lives on the MSTR dashboard.
        var html = '';
        html += STRCRenderer._renderHeadlineBanner(tradfi);
        html += STRCRenderer._renderStrcInstrument(tradfi);
        html += STRCRenderer._renderStrcDividendObligation(data);
        html += STRCRenderer._renderStrcxWrapper(wrapper, riskFlags);
        html += STRCRenderer._renderDownstreamExposure(downstream);
        html += STRCRenderer._renderDependencyStrategyFunding(tradfi);
        html += '<div id="strc-event-log-panel" class="panel"><div class="panel-title">Strategy Event Log <span class="text-xs font-normal text-slate-500">— EDGAR 8-K monitor</span></div><div class="text-xs text-slate-500 loading-pulse">Loading EDGAR feed…</div></div>';
        html += STRCRenderer._renderFreshness(data);

        container.innerHTML = html;

        // Sibling-dashboard affordance in the page header (above panel 1).
        STRCRenderer._setupCompanionLink();

        // Post-paint chart renders — DOM nodes must exist first.
        STRCRenderer._loadHistoryAndPaintCharts(tradfi);
        // Async: events JSON populates the event-log panel + appends any
        // events-side risk flags to the common Risk Flags panel.
        STRCRenderer._loadStrategyEventLog();
    },

    // Persistent header link to the sibling MSTR dashboard. Reuses the
    // shared #header-companion-link slot (also used by the apyx renderer
    // for apxUSD ↔ apyUSD). app.js resets the link to hidden on each
    // route, so we re-reveal it on every STRC render.
    _setupCompanionLink: function () {
        var link = document.getElementById('header-companion-link');
        if (!link) return;
        link.setAttribute('href', '?asset=mstr');
        link.textContent = 'Strategy issuer analysis → MSTR dashboard ↗';
        link.classList.remove('hidden');
    },

    _suppressCommonPanels: function (data) {
        // Top summary-card strip — STRC's Headline banner (panel 1) replaces it.
        var s = document.getElementById('summary-cards');
        if (s) s.style.display = 'none';
        // Backing breakdown table — not meaningful for STRC.
        var bd = document.getElementById('breakdown-table');
        if (bd) { var p = bd.closest('.panel'); if (p) p.style.display = 'none'; }
        // Allocation pie chart — not meaningful for STRC.
        var pie = document.getElementById('pie-chart');
        if (pie) { var p2 = pie.closest('.panel'); if (p2) p2.style.display = 'none'; }
        // CR history chart — STRC has no CR; the mNAV chart in panel 2 is the
        // load-bearing trend chart.
        var cp = document.getElementById('chart-panel');
        if (cp) cp.style.display = 'none';

        // Risk flags panel — keep visible; widen its column since the
        // breakdown table on its left is hidden. When no flags fire, hide.
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
    // Panel 1 — STRC headline (refocused; STRC primary, mNAV secondary)
    // ============================================================
    _renderHeadlineBanner: function (tradfi) {
        var mnav = tradfi.mnav || {};
        var strc = tradfi.strc_secondary || {};
        var div = tradfi.strc_dividend || {};
        var mnavCls = STRCRenderer._mnavBandClass(mnav.regime);
        var mnavLabel = STRCRenderer._mnavBandLabel(mnav.regime);
        var mnavVal = (mnav.value != null) ? mnav.value.toFixed(2) : '—';
        var priceCls = STRCRenderer._strcPriceClass(strc.price_usd);
        var priceVal = (strc.price_usd != null) ? '$' + strc.price_usd.toFixed(2) : '—';
        var isRegularSession = strc.market_session === 'regular';
        var quoteLabel = strc.quote_label || (isRegularSession ? 'Live market quote' : 'Latest market quote');
        var quoteDetail = strc.quote_detail || (strc.market_session ? '' : 'session unknown');
        var bpsTxt = '';
        if (strc.discount_to_par_bps != null) {
            var sign = strc.discount_to_par_bps >= 0 ? '+' : '';
            bpsTxt = sign + strc.discount_to_par_bps + ' bps vs par';
        }
        var rateTxt = (div.current_rate != null) ? (div.current_rate * 100).toFixed(2) + '%' : '—';
        var nextRate = STRCRenderer._nextRateDecision();
        var nextDateStr = nextRate.date.toISOString().slice(0, 10);
        var nextLabel = nextRate.daysAway + ' day' + (nextRate.daysAway === 1 ? '' : 's');

        return '<div class="panel">' +
            '<div class="panel-title">STRC headline <span class="text-xs font-normal text-slate-500">— instrument-native metrics</span></div>' +
            // Primary row: STRC's own metrics.
            '<div class="grid grid-cols-1 md:grid-cols-3 gap-4">' +
                '<div class="rounded-lg border border-slate-200 dark:border-slate-700 p-4">' +
                    '<div class="text-xs uppercase font-semibold text-slate-500">STRC secondary price</div>' +
                    '<div class="text-3xl font-bold mt-1 ' + priceCls + '">' + priceVal + '</div>' +
                    '<div class="text-xs text-slate-500 mt-1">' + bpsTxt + '</div>' +
                    '<div class="text-[10px] text-slate-400 mt-0.5">' + quoteLabel + (quoteDetail ? ' · ' + quoteDetail : '') + '</div>' +
                '</div>' +
                '<div class="rounded-lg border border-slate-200 dark:border-slate-700 p-4">' +
                    '<div class="text-xs uppercase font-semibold text-slate-500">Current monthly rate</div>' +
                    '<div class="text-3xl font-bold mt-1 text-slate-800 dark:text-slate-100">' + rateTxt + '</div>' +
                    '<div class="text-xs text-slate-500 mt-1">annualized · VWAP-driven reset</div>' +
                '</div>' +
                '<div class="rounded-lg border border-slate-200 dark:border-slate-700 p-4">' +
                    '<div class="text-xs uppercase font-semibold text-slate-500">Next rate decision (est.)</div>' +
                    '<div class="text-3xl font-bold mt-1 text-slate-800 dark:text-slate-100">' + nextLabel + '</div>' +
                    '<div class="text-xs text-slate-500 mt-1">' + nextDateStr + ' · mid-month VWAP reset</div>' +
                '</div>' +
            '</div>' +
            // Secondary row: small dependency indicator pointing at MSTR dashboard.
            '<div class="mt-4 flex flex-wrap items-center justify-end gap-2 text-xs">' +
                '<span class="text-slate-500">Strategy funding regime (dependency):</span>' +
                '<span class="inline-flex items-center px-2 py-0.5 rounded-full border ' + mnavCls + ' font-semibold">mNAV ' + mnavVal + ' · ' + mnavLabel + '</span>' +
                '<a href="?asset=mstr" class="text-blue-500 hover:underline">→ MSTR dashboard</a>' +
            '</div>' +
        '</div>';
    },

    // ============================================================
    // Panel 6 — Dependency: Strategy Funding Regime (RELABELED + merges
    // old mNAV regime panel + old MSTR/BTC overview snapshot row).
    //
    // STRC's risk is downstream of Strategy's funding model. This panel
    // surfaces the upstream regime + issuer-side inputs (BTC, MSTR, BTC
    // stack) for STRC holders, with explicit dependency framing so the
    // chart isn't mistaken for STRC-native analysis.
    // ============================================================
    _renderDependencyStrategyFunding: function (tradfi) {
        var mnav = tradfi.mnav || {};
        var mstr = tradfi.mstr || {};
        var btc = tradfi.btc || {};
        var hold = tradfi.strategy_btc_holdings || {};
        var val = (mnav.value != null) ? mnav.value.toFixed(4) : '—';
        var regime = mnav.regime || 'unknown';
        var caption = STRCRenderer._mnavCaption(regime);
        var bandCls = STRCRenderer._mnavBandClass(regime);
        var label = STRCRenderer._mnavBandLabel(regime);
        var btcNav = (hold.count != null && btc.price_usd != null) ? hold.count * btc.price_usd : null;

        // BTC/MSTR snapshot row — issuer-side inputs the regime is derived from.
        var snapshotRow =
            '<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">' +
                '<div class="rounded border border-slate-200 dark:border-slate-700 p-3">' +
                    '<div class="text-[10px] uppercase font-semibold text-slate-500">BTC price</div>' +
                    '<div class="text-lg font-bold text-slate-800 dark:text-slate-100 mt-0.5">' + STRCRenderer._fmtMoney(btc.price_usd, 0) + '</div>' +
                '</div>' +
                '<div class="rounded border border-slate-200 dark:border-slate-700 p-3">' +
                    '<div class="text-[10px] uppercase font-semibold text-slate-500">MSTR price</div>' +
                    '<div class="text-lg font-bold text-slate-800 dark:text-slate-100 mt-0.5">' + STRCRenderer._fmtMoney(mstr.price_usd, 2) + '</div>' +
                    '<div class="text-[10px] text-slate-500">mcap ' + STRCRenderer._fmtMoneyShort(mstr.market_cap_usd) + '</div>' +
                '</div>' +
                '<div class="rounded border border-slate-200 dark:border-slate-700 p-3">' +
                    '<div class="text-[10px] uppercase font-semibold text-slate-500">Strategy BTC holdings</div>' +
                    '<div class="text-lg font-bold text-slate-800 dark:text-slate-100 mt-0.5">' + STRCRenderer._fmtNum(hold.count) + ' BTC</div>' +
                    '<div class="text-[10px] text-slate-500">NAV ' + STRCRenderer._fmtMoneyShort(btcNav) + '</div>' +
                '</div>' +
                '<div class="rounded border border-slate-200 dark:border-slate-700 p-3">' +
                    '<div class="text-[10px] uppercase font-semibold text-slate-500">Implied mNAV</div>' +
                    '<div class="text-lg font-bold text-slate-800 dark:text-slate-100 mt-0.5">' + val + '</div>' +
                    '<div class="text-[10px] text-slate-500">EV ÷ BTC NAV</div>' +
                '</div>' +
            '</div>';

        return '<div class="panel">' +
            '<div class="panel-title">Dependency: Strategy Funding Regime <span class="text-xs font-normal text-slate-500">— upstream of STRC</span></div>' +
            '<div class="text-xs text-slate-500 leading-relaxed mb-3">' +
                'STRC\'s risk is downstream of Strategy\'s funding model — this view shows the upstream regime. ' +
                'For the canonical issuer analysis (per-share BTC NAV, capital structure, cash-service waterfall, dilution mechanics), see the ' +
                '<a href="?asset=mstr" class="text-blue-500 hover:underline">MSTR dashboard →</a>' +
            '</div>' +
            '<div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">' +
                '<div class="lg:col-span-1">' +
                    '<div class="text-xs uppercase font-semibold text-slate-500 mb-1">Current mNAV</div>' +
                    '<div class="text-5xl font-bold text-slate-800 dark:text-slate-100">' + val + '</div>' +
                    '<div class="mt-2"><span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ' + bandCls + '">' + label + '</span></div>' +
                    '<div class="text-xs text-slate-500 mt-3 leading-relaxed">' +
                        'Regime bands: premium ≥1.05 · parity 0.95–1.05 · discount 0.85–0.95 · distress &lt;0.85' +
                    '</div>' +
                    STRCRenderer._renderCommonBtcCoverageLine(tradfi) +
                '</div>' +
                '<div class="lg:col-span-2">' +
                    '<div style="height: 240px; position: relative;"><canvas id="strc-mnav-chart"></canvas></div>' +
                '</div>' +
            '</div>' +
            '<div class="mt-4 p-3 rounded border ' + bandCls + '">' +
                '<div class="text-sm">' + caption + '</div>' +
            '</div>' +
            snapshotRow +
            '<div class="text-xs text-slate-500 mt-3">' +
                'Methodology: mNAV = enterprise value ÷ (Strategy BTC count × BTC spot). See ' +
                '<a href="https://github.com/todayindefi/riskAnalyst/blob/master/assets/_frameworks/strc-framework.md" ' +
                'target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline">framework §IV (MSTR cash-flow stack)</a>. ' +
                'Canonical issuer analysis: <a href="?asset=mstr" class="text-blue-500 hover:underline">MSTR dashboard →</a>' +
            '</div>' +
        '</div>';
    },

    // ============================================================
    // Panel 2 — STRC instrument
    // ============================================================
    _renderStrcInstrument: function (tradfi) {
        var div = tradfi.strc_dividend || {};
        var rate = div.current_rate;
        var rateTxt = (rate != null) ? (rate * 100).toFixed(2) + '%' : '—';
        // Dividend cadence: prefer PegTracker JSON, fall back to namespaced const.
        var divFreq = div.strc_dividend_frequency || STRC_DIVIDEND_FREQUENCY;
        var semiMonthlyEff = div.semi_monthly_effective || STRC_SEMIMONTHLY_EFFECTIVE;
        var cadenceNote =
            '<div class="text-xs text-slate-500 mt-3 leading-relaxed">' +
                '<strong>Dividend:</strong> <span class="font-semibold">' + rateTxt + '</span> p.a. — ' +
                '<span class="font-semibold">' + divFreq + ' from ' + semiMonthlyEff + '</span> ' +
                '(two payment dates/month; monthly prior). Rate and aggregate obligation unchanged; frequency only.' +
            '</div>';
        var history = Array.isArray(div.rate_history) ? div.rate_history : [];
        var prevRate = history.length >= 2 ? history[history.length - 2].rate : null;
        var rateChangeBadge = '';
        if (prevRate != null && rate != null) {
            var deltaBps = (rate - prevRate) * 10000;
            if (deltaBps > 0) {
                rateChangeBadge = '<span class="text-xs ml-2 text-green-600">+' + deltaBps.toFixed(0) + ' bps MoM</span>';
            } else if (deltaBps < 0) {
                rateChangeBadge = '<span class="text-xs ml-2 text-red-600">' + deltaBps.toFixed(0) + ' bps MoM</span>';
            } else {
                rateChangeBadge = '<span class="text-xs ml-2 text-slate-500">No change MoM</span>';
            }
        }

        return '<div class="panel">' +
            '<div class="panel-title">STRC instrument <span class="text-xs font-normal text-slate-500">— monthly-reset preferred</span></div>' +
            '<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">' +
                '<div>' +
                    '<div class="text-xs uppercase font-semibold text-slate-500 mb-1">Current annualized rate</div>' +
                    '<div class="flex items-baseline">' +
                        '<div class="text-4xl font-bold text-slate-800 dark:text-slate-100">' + rateTxt + '</div>' +
                        rateChangeBadge +
                    '</div>' +
                    cadenceNote +
                    '<div class="text-xs text-slate-500 mt-4 mb-1">Rate history (last ' + history.length + ' months)</div>' +
                    '<div style="height: 180px; position: relative;"><canvas id="strc-rate-chart"></canvas></div>' +
                '</div>' +
                '<div>' +
                    '<div class="text-xs uppercase font-semibold text-slate-500 mb-1">Secondary price (recent)</div>' +
                    '<div style="height: 220px; position: relative;"><canvas id="strc-price-chart"></canvas></div>' +
                '</div>' +
            '</div>' +
            '<div class="text-xs text-slate-500 mt-4 leading-relaxed">' +
                '<strong>VWAP-based monthly reset:</strong> ' +
                '&lt;$95 → +50 bps or more · ' +
                '$95–$98.99 → +25 bps · ' +
                '$99–$100.99 → no change · ' +
                '≥$101 → −25 bps or more. ' +
                'Outstanding par <span class="font-mono">' + STRCRenderer._fmtMoneyShort(div.outstanding_par_usd) + '</span> ' +
                'across <span class="font-mono">' + STRCRenderer._fmtNum(div.outstanding_shares) + '</span> shares.' +
            '</div>' +
        '</div>';
    },

    // ============================================================
    // Per-token mark card — multiplier-adjusted Jupiter price (matches the
    // scaled on-chain balanceOf). The CoinGecko xStock figure is the PRE-scaled
    // price (overstates by ~the multiplier, ~$25k/day venue) and is shown as a
    // labeled reference only, never the headline mark.
    _renderStrcxMarkCard: function (wrapper) {
        var mark = wrapper.market_price_usd;
        // Back-compat: pre-fix snapshots only carried the pre-scaled CG price.
        // Rescale it by the multiplier so a stale-data window still shows the
        // per-token mark, never the inflated pre-scaled figure.
        if (mark == null) mark = wrapper.coingecko_scaled_price_usd;
        if (mark == null && wrapper.coingecko_price_usd != null
                && wrapper.multiplier) {
            mark = wrapper.coingecko_price_usd / wrapper.multiplier;
        }
        var src = wrapper.market_price_source || '';
        var srcLabel =
            src === 'jupiter_usdprice' ? 'Jupiter v3' :
            src === 'jupiter_stockdata_fallback' ? 'Jupiter (NAV-bounded)' :
            src === 'jupiter_stockdata' ? 'Jupiter stockData' :
            src === 'coingecko_scaled_fallback' ? 'CoinGecko (scaled)' :
            (src || '—');
        var underlying = wrapper.underlying_strc_price_usd;
        var cgPre = wrapper.coingecko_price_usd;
        var xbps = wrapper.price_crosscheck_bps;
        var sub = srcLabel +
            (underlying != null ? ' · STRC $' + underlying.toFixed(2) : '') +
            (cgPre != null ? ' · CG pre-scaled $' + cgPre.toFixed(2) : '');
        var xchk = (xbps != null)
            ? '<div class="text-xs text-slate-400 mt-0.5">CG cross-check ' +
              (xbps >= 0 ? '+' : '') + xbps.toFixed(0) + ' bps</div>'
            : '';
        var titleAttr = 'STRCx is a scaled-UI token: on-chain balanceOf returns ' +
            'shares×multiplier, so the matching mark is the multiplier-adjusted ' +
            'Jupiter usdPrice. The CoinGecko xStock feed is PRE-scaled (overstates ' +
            'the per-token value by ~the multiplier, on a thin ~$25k/day venue) and ' +
            'is a reference only.';
        return '<div class="summary-card">' +
            '<div class="card-label" title="' + titleAttr + '">Per-token mark ' +
                '<span class="text-slate-400 font-normal">(multiplier-adj.)</span></div>' +
            '<div class="card-value">' + (mark != null ? '$' + mark.toFixed(2) : '—') + '</div>' +
            '<div class="text-xs text-slate-400 mt-1">' + sub + '</div>' +
            xchk +
        '</div>';
    },

    // Panel 4 — STRCx wrapper
    // ============================================================
    _renderStrcxWrapper: function (wrapper, riskFlags) {
        var totalSupply = wrapper.total_supply_all_chains;
        var supplyUsd = wrapper.total_supply_usd;
        var multiplier = wrapper.multiplier;
        var perChain = wrapper.per_chain || {};
        var holders = wrapper.top_holders_ethereum || [];

        var chainOrder = ['ethereum', 'solana', 'arbitrum', 'bnb', 'mantle'];
        Object.keys(perChain).forEach(function (k) {
            if (chainOrder.indexOf(k) < 0) chainOrder.push(k);
        });
        var chainRows = chainOrder.filter(function (k) { return perChain[k]; }).map(function (k) {
            var c = perChain[k] || {};
            var supplyTxt;
            if (c.fetch_status === 'ok') {
                supplyTxt = (c.total_supply != null) ? STRCRenderer._fmtNum(c.total_supply, 0) + ' STRCx' : '—';
            } else if (c.fetch_status === 'address_unknown') {
                supplyTxt = '<span class="text-slate-400 italic">address unknown</span>';
            } else {
                supplyTxt = '<span class="text-amber-600">' + (c.fetch_status || 'unknown') + '</span>';
            }
            var addr = c.contract || c.mint || null;
            var addrCell = addr ?
                '<span class="font-mono text-xs" title="' + addr + '">' + STRCRenderer._truncAddr(addr) + '</span>' +
                (k === 'ethereum' ? ' ' + STRCRenderer._etherscanLink(addr) : '') :
                '<span class="text-slate-400 text-xs">—</span>';
            return '<tr>' +
                '<td class="font-medium">' + (k.charAt(0).toUpperCase() + k.slice(1)) + '</td>' +
                '<td class="text-right">' + supplyTxt + '</td>' +
                '<td>' + addrCell + '</td>' +
                '<td class="text-xs text-slate-500">' + (c.note || '') + '</td>' +
            '</tr>';
        }).join('');

        if (wrapper.implied_other_chains_supply != null) {
            chainRows += '<tr class="italic text-slate-500">' +
                '<td>Other chains (implied)</td>' +
                '<td class="text-right">' + STRCRenderer._fmtNum(wrapper.implied_other_chains_supply, 0) + ' STRCx</td>' +
                '<td>—</td>' +
                '<td class="text-xs">CoinGecko aggregate minus known chains</td>' +
            '</tr>';
        }
        chainRows += '<tr class="font-bold border-t-2 border-slate-200">' +
            '<td>Total (all chains)</td>' +
            '<td class="text-right">' + STRCRenderer._fmtNum(totalSupply, 2) + ' STRCx</td>' +
            '<td></td>' +
            '<td class="text-xs text-slate-500">≈ ' + STRCRenderer._fmtMoneyShort(supplyUsd) + '</td>' +
        '</tr>';

        // NEW_TOP_HOLDER flag → badge on matching holder rows.
        var newHolderMessages = (riskFlags || [])
            .filter(function (f) { return f && f.code === 'NEW_TOP_HOLDER'; })
            .map(function (f) { return (f.message || '').toLowerCase(); });
        var holderRows = holders.map(function (h) {
            var shareTxt = (h.share_of_eth_supply != null) ? (h.share_of_eth_supply * 100).toFixed(2) + '%' : '—';
            var newBadge = '';
            var addrLower = (h.address || '').toLowerCase();
            if (addrLower && newHolderMessages.some(function (m) { return m.indexOf(addrLower) >= 0; })) {
                newBadge = ' <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">NEW</span>';
            }
            return '<tr>' +
                '<td>' + (h.label || '—') + newBadge + '</td>' +
                '<td><span class="font-mono text-xs">' + STRCRenderer._truncAddr(h.address) + '</span> ' + STRCRenderer._etherscanLink(h.address) + '</td>' +
                '<td class="text-right font-mono">' + STRCRenderer._fmtNum(h.balance, 2) + '</td>' +
                '<td class="text-right font-mono">' + shareTxt + '</td>' +
            '</tr>';
        }).join('');
        if (!holderRows) {
            holderRows = '<tr><td colspan="4" class="text-slate-400 italic">No top-holder data in this snapshot.</td></tr>';
        }

        var ethChain = perChain.ethereum || {};
        var ownerHtml = ethChain.owner ?
            '<span class="font-mono text-xs">' + STRCRenderer._truncAddr(ethChain.owner) + '</span> ' + STRCRenderer._etherscanLink(ethChain.owner) :
            '<span class="text-slate-400">—</span>';
        var minterHtml = ethChain.minter ?
            '<span class="font-mono text-xs">' + STRCRenderer._truncAddr(ethChain.minter) + '</span> ' + STRCRenderer._etherscanLink(ethChain.minter) :
            '<span class="text-slate-400">—</span>';

        return '<div class="panel">' +
            '<div class="panel-title">STRCx wrapper <span class="text-xs font-normal text-slate-500">— Backed multi-chain</span></div>' +
            '<div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">' +
                '<div class="summary-card">' +
                    '<div class="card-label">Total supply (all chains)</div>' +
                    '<div class="card-value">' + STRCRenderer._fmtNum(totalSupply, 0) + ' STRCx</div>' +
                    '<div class="text-xs text-slate-400 mt-1">≈ ' + STRCRenderer._fmtMoneyShort(supplyUsd) + '</div>' +
                '</div>' +
                '<div class="summary-card">' +
                    '<div class="card-label">Current multiplier</div>' +
                    '<div class="card-value">' + (multiplier != null ? multiplier.toFixed(6) : '—') + '</div>' +
                    '<div class="text-xs text-slate-400 mt-1">from ethereum.multiplier()</div>' +
                '</div>' +
                STRCRenderer._renderStrcxMarkCard(wrapper) +
            '</div>' +
            '<div class="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-4 mb-2">Per-chain breakdown</div>' +
            '<div class="data-table-scroll">' +
                '<table class="data-table">' +
                    '<thead><tr><th>Chain</th><th class="text-right">Supply</th><th>Contract / mint</th><th>Note</th></tr></thead>' +
                    '<tbody>' + chainRows + '</tbody>' +
                '</table>' +
            '</div>' +
            '<div class="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-6 mb-2">Multiplier over time</div>' +
            '<div style="height: 160px; position: relative;"><canvas id="strc-multiplier-chart"></canvas></div>' +
            '<div class="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-6 mb-2">Top holders (Ethereum)</div>' +
            '<div class="data-table-scroll">' +
                '<table class="data-table">' +
                    '<thead><tr><th>Label</th><th>Address</th><th class="text-right">Balance (STRCx)</th><th class="text-right">% of ETH supply</th></tr></thead>' +
                    '<tbody>' + holderRows + '</tbody>' +
                '</table>' +
            '</div>' +
            '<div class="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-6 mb-2">Admin posture (Ethereum)</div>' +
            '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">' +
                '<div class="rounded border border-slate-200 dark:border-slate-700 p-3">' +
                    '<div class="text-xs uppercase text-slate-500">owner()</div>' +
                    '<div class="mt-1">' + ownerHtml + '</div>' +
                '</div>' +
                '<div class="rounded border border-slate-200 dark:border-slate-700 p-3">' +
                    '<div class="text-xs uppercase text-slate-500">minter()</div>' +
                    '<div class="mt-1">' + minterHtml + '</div>' +
                '</div>' +
            '</div>' +
        '</div>';
    },

    // ============================================================
    // Panel 7 — Downstream exposure
    // ============================================================
    _renderDownstreamExposure: function (downstream) {
        var apyx = downstream.apyx;
        var saturn = downstream.saturn;
        var total = downstream.portfolio_total_strc_family_usd;

        function unavailableRow(label, slug) {
            return '<tr><td class="font-medium">' + label + '</td>' +
                '<td colspan="3" class="text-slate-400 italic">data unavailable — check ' +
                '<a href="?asset=' + slug + '" class="text-blue-500 hover:underline">' + slug + '</a> dashboard</td></tr>';
        }
        function dataRow(label, slug, valueUsd, sharePct, note) {
            var shareTxt = (sharePct != null) ? (sharePct * 100).toFixed(1) + '%' : '—';
            return '<tr>' +
                '<td class="font-medium"><a href="?asset=' + slug + '" class="text-slate-700 dark:text-slate-200 hover:text-blue-600">' + label + ' ↗</a></td>' +
                '<td class="text-right font-mono">' + STRCRenderer._fmtMoneyShort(valueUsd) + '</td>' +
                '<td class="text-right font-mono">' + shareTxt + '</td>' +
                '<td class="text-xs text-slate-500">' + (note || '') + '</td>' +
            '</tr>';
        }

        var apyxRow = apyx ?
            dataRow('Apyx (apxUSD + apyUSD)', 'apxusd', apyx.strc_bucket_usd, apyx.strc_share_of_reserves,
                'Accountable feed; STRC bucket bundles brokerage STRC + on-chain STRCx') :
            unavailableRow('Apyx (apxUSD + apyUSD)', 'apxusd');
        var saturnRow = saturn ?
            dataRow('Saturn (sUSDat)', 'susdat', saturn.strc_raw_usd, saturn.strc_share_of_reserves,
                (saturn.verifiable === 'oracle_unverified') ? 'Off-chain STRC; oracle unverified (PoR feed planned)' : '') :
            unavailableRow('Saturn (sUSDat)', 'susdat');

        return '<div class="panel">' +
            '<div class="panel-title">Downstream portfolio exposure</div>' +
            '<div class="summary-card mb-4">' +
                '<div class="card-label">Combined portfolio STRC-family exposure</div>' +
                '<div class="card-value">' + STRCRenderer._fmtMoneyShort(total) + '</div>' +
                '<div class="text-xs text-slate-400 mt-1">Apyx + Saturn aggregation</div>' +
            '</div>' +
            '<div class="data-table-scroll">' +
                '<table class="data-table">' +
                    '<thead><tr><th>Consumer</th><th class="text-right">STRC family (USD)</th><th class="text-right">Share of reserves</th><th>Note</th></tr></thead>' +
                    '<tbody>' + apyxRow + saturnRow + '</tbody>' +
                '</table>' +
            '</div>' +
        '</div>';
    },

    // ============================================================
    // Freshness footer
    // ============================================================
    _renderFreshness: function (data) {
        var ts = data.timestamp_utc || data.timestamp;
        var age = data.freshness_seconds;
        var strcQuote = data.tradfi && data.tradfi.strc_secondary;
        var quoteTs = strcQuote && strcQuote.quote_fetched_at;
        var quoteLabel = strcQuote && strcQuote.quote_label;
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
            (quoteTs ? ' · STRC quote: ' + (quoteLabel || 'Latest market quote') + ' at ' + CommonRenderer.formatDate(quoteTs) : '') +
            ' · framework_version <span class="font-mono">' + (data.framework_version || '—') + '</span>' +
        '</div>';
    },

    // ============================================================
    // Chart paint helpers
    // ============================================================
    _loadHistoryAndPaintCharts: function (tradfi) {
        // Rate chart reads from current snapshot — paint immediately.
        STRCRenderer._paintRateChart(tradfi);

        var nocache = Math.floor(Date.now() / 60000);
        fetch('data/strc_backing_history.json?nocache=' + nocache)
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (hist) {
                var series = (hist && Array.isArray(hist.series)) ? hist.series : [];
                STRCRenderer._paintMnavChart(series);
                STRCRenderer._paintStrcPriceChart(series);
                STRCRenderer._paintMultiplierChart(series);
                STRCRenderer._paintRateTrajectoryChart(series);
            })
            .catch(function () { /* history optional */ });
    },

    _seriesXY: function (series, field) {
        return series.filter(function (p) { return p && p[field] != null && p.ts; }).map(function (p) {
            var ts = p.ts.endsWith('Z') ? p.ts : p.ts + 'Z';
            return { x: new Date(ts), y: p[field] };
        });
    },

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

    _paintMnavChart: function (series) {
        var ctx = document.getElementById('strc-mnav-chart');
        if (!ctx) return;
        var data = STRCRenderer._seriesXY(series, 'mnav');
        var ann = {
            parity:   { type: 'line', yMin: 1.00, yMax: 1.00, borderColor: '#22c55e', borderWidth: 1, borderDash: [4, 4],
                        label: { content: 'parity 1.00', display: true, position: 'end', font: { size: 9 }, color: '#16a34a' } },
            discount: { type: 'line', yMin: 0.95, yMax: 0.95, borderColor: '#f59e0b', borderWidth: 1, borderDash: [4, 4],
                        label: { content: 'discount 0.95', display: true, position: 'end', font: { size: 9 }, color: '#d97706' } },
            distress: { type: 'line', yMin: 0.85, yMax: 0.85, borderColor: '#ef4444', borderWidth: 1, borderDash: [4, 4],
                        label: { content: 'distress 0.85', display: true, position: 'end', font: { size: 9 }, color: '#dc2626' } }
        };
        if (window._strcMnavChart) window._strcMnavChart.destroy();
        window._strcMnavChart = new Chart(ctx, {
            type: 'line',
            data: { datasets: [{
                label: 'mNAV',
                data: data,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59,130,246,0.1)',
                fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2
            }] },
            options: STRCRenderer._baseChartOpts(ann)
        });
    },

    _paintRateChart: function (tradfi) {
        var ctx = document.getElementById('strc-rate-chart');
        if (!ctx) return;
        var div = (tradfi && tradfi.strc_dividend) || {};
        var history = Array.isArray(div.rate_history) ? div.rate_history : [];
        var labels = history.map(function (r) { return r.month; });
        var values = history.map(function (r) { return r.rate != null ? r.rate * 100 : null; });
        if (window._strcRateChart) window._strcRateChart.destroy();
        window._strcRateChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Rate',
                    data: values,
                    backgroundColor: 'rgba(99,102,241,0.6)',
                    borderColor: '#6366f1',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                scales: {
                    x: { grid: { display: false }, ticks: { font: { size: 10 } } },
                    y: { grid: { color: '#f1f5f9' }, ticks: { callback: function (v) { return v + '%'; }, font: { size: 10 } } }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: function (c) { return (c.raw != null ? c.raw.toFixed(2) : '—') + '%'; } } }
                }
            }
        });
    },

    _paintStrcPriceChart: function (series) {
        var ctx = document.getElementById('strc-price-chart');
        if (!ctx) return;
        var data = STRCRenderer._seriesXY(series, 'strc_price');
        var ann = {
            hike: { type: 'line', yMin: 95, yMax: 95, borderColor: '#ef4444', borderWidth: 1, borderDash: [4, 4],
                    label: { content: '$95 hike trigger', display: true, position: 'end', font: { size: 9 }, color: '#dc2626' } },
            parLow: { type: 'line', yMin: 99, yMax: 99, borderColor: '#22c55e', borderWidth: 1, borderDash: [3, 3],
                      label: { content: '$99 no-change band', display: true, position: 'end', font: { size: 9 }, color: '#16a34a' } },
            cut: { type: 'line', yMin: 101, yMax: 101, borderColor: '#3b82f6', borderWidth: 1, borderDash: [4, 4],
                   label: { content: '$101 cut trigger', display: true, position: 'end', font: { size: 9 }, color: '#2563eb' } }
        };
        if (window._strcPriceChart) window._strcPriceChart.destroy();
        window._strcPriceChart = new Chart(ctx, {
            type: 'line',
            data: { datasets: [{
                label: 'STRC',
                data: data,
                borderColor: '#0ea5e9',
                backgroundColor: 'rgba(14,165,233,0.1)',
                fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2
            }] },
            options: STRCRenderer._baseChartOpts(ann)
        });
    },

    _paintMultiplierChart: function (series) {
        var ctx = document.getElementById('strc-multiplier-chart');
        if (!ctx) return;
        var data = STRCRenderer._seriesXY(series, 'multiplier');
        if (window._strcMultiplierChart) window._strcMultiplierChart.destroy();
        window._strcMultiplierChart = new Chart(ctx, {
            type: 'line',
            data: { datasets: [{
                label: 'multiplier',
                data: data,
                borderColor: '#a855f7',
                backgroundColor: 'rgba(168,85,247,0.1)',
                fill: true, stepped: true, pointRadius: 2, borderWidth: 1.5
            }] },
            options: STRCRenderer._baseChartOpts()
        });
    },

    // ============================================================
    // Panel 3 — STRC dividend obligation + runway (STRC-slice only)
    //
    // Restructured from the v2a Cash-Service Waterfall: the full multi-tier
    // waterfall + treasury breakdown + all-preferred runway scenarios moved
    // to the MSTR dashboard (those are MSTR capital-structure objects). This
    // STRC panel keeps only the STRC-instrument-specific slice: STRC annual
    // obligation, BTC/yr to service it, STRC-only runway, and the STRC rate-
    // ceiling overlay (which is STRC-specific stress, not issuer-level).
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

    _renderStrcDividendObligation: function (data) {
        var csw = data.cash_service_waterfall;
        if (!csw) {
            return '<div class="panel">' +
                '<div class="panel-title">STRC dividend obligation + runway</div>' +
                '<div class="risk-flag risk-warning">cash_service_waterfall block not present in this snapshot — analyzer may be running an older schema.</div>' +
            '</div>';
        }

        var obl = csw.annual_obligation_usd || {};
        var btcYr = csw.btc_per_year_at_current_price || {};
        var pctStack = csw.pct_of_stack_per_year || {};
        var runway = csw.runway_years_flat_btc || {};
        var assum = csw.assumptions || {};
        var rateCeiling = csw.runway_at_rate_ceiling || {};
        var strcDiv = (data.tradfi && data.tradfi.strc_dividend) || {};

        var strcAnnual = obl.strc_dividend;
        var strcBtcYr = btcYr.strc_only;
        var strcRunway = runway.strc_only;
        var strcRunwayCls = STRCRenderer._runwayClass(strcRunway);
        var btcPx = assum.btc_price_usd;
        var strcPctStack = pctStack.strc_only;
        var rateTxt = (strcDiv.current_rate != null) ? (strcDiv.current_rate * 100).toFixed(2) + '%' : '—';

        // ---- Headline strip: STRC obligation primary, BTC/yr + runway secondary.
        var headline =
            '<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">' +
                '<div class="rounded-lg border border-slate-200 dark:border-slate-700 p-4">' +
                    '<div class="text-xs uppercase font-semibold text-slate-500">STRC annual dividend obligation</div>' +
                    '<div class="text-3xl font-bold mt-1 text-slate-800 dark:text-slate-100">' + STRCRenderer._fmtMoneyShort(strcAnnual) + '</div>' +
                    '<div class="text-xs text-slate-500 mt-1">at current ' + rateTxt + ' on ' + STRCRenderer._fmtMoneyShort(strcDiv.outstanding_par_usd) + ' outstanding</div>' +
                '</div>' +
                '<div class="rounded-lg border border-slate-200 dark:border-slate-700 p-4">' +
                    '<div class="text-xs uppercase font-semibold text-slate-500">BTC sold per year to service STRC</div>' +
                    '<div class="text-3xl font-bold mt-1 text-slate-800 dark:text-slate-100">' + (strcBtcYr != null ? STRCRenderer._fmtNum(strcBtcYr) + ' BTC' : '—') + '</div>' +
                    '<div class="text-xs text-slate-500 mt-1">at BTC ' + STRCRenderer._fmtMoney(btcPx, 0) + (strcPctStack != null ? ' · ' + (strcPctStack * 100).toFixed(2) + '% of stack/yr' : '') + '</div>' +
                '</div>' +
                '<div class="rounded-lg border border-slate-200 dark:border-slate-700 p-4">' +
                    '<div class="text-xs uppercase font-semibold text-slate-500">STRC-only runway (flat BTC)</div>' +
                    '<div class="text-3xl font-bold mt-1 ' + strcRunwayCls + '">' + (strcRunway != null ? strcRunway + ' yr' : '—') + '</div>' +
                    '<div class="text-xs text-slate-500 mt-1">BTC stack ÷ STRC BTC/yr · &gt;40 green · 25–40 amber · 15–25 orange</div>' +
                '</div>' +
            '</div>';

        // ---- STRC-specific rate-ceiling overlay (kept here — it's STRC's own stress).
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
                '<div class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">STRC rate-ceiling overlay <span class="text-xs font-normal text-slate-500">— framework §IV.5</span></div>' +
                ceilingRow +
                headroomBar +
                ceilingCaption +
                '<div style="height: 180px; position: relative;" class="mt-3"><canvas id="strc-rate-trajectory-chart"></canvas></div>' +
                '<div class="text-xs text-slate-500 italic mt-1">Stress cycles ratchet up; recovery does not ratchet down.</div>' +
            '</div>';

        // ---- Cash-buffer callout (dependency data point + cross-link).
        // Strategy's cash position is an MSTR-issuer concern, but STRC holders
        // need the headline number to size short-term dividend-suspension risk.
        // Small + dependency-framed, consistent with the d373a1d6 reorg pattern.
        var cashRunway = csw.cash_runway || null;
        var seq = csw.sequenced_runway || null;
        var cashSubPanel = '';
        if (cashRunway) {
            var totalMonths = (cashRunway.months_until_btc_sales_required || {}).total_preferred_plus_interest;
            var monthsCls = STRCRenderer._cashRunwayClass(totalMonths);
            var cashTxt = STRCRenderer._fmtMoneyShort(cashRunway.cash_and_equivalents_usd);
            var asOf = cashRunway.cash_as_of || '—';

            var saleStart = seq && seq.btc_sale_start_date_approx;
            var saleStartCls =
                (totalMonths != null && totalMonths < 6) ? 'text-red-700 dark:text-red-300' :
                (totalMonths != null && totalMonths < 12) ? 'text-amber-700 dark:text-amber-300' :
                'text-slate-800 dark:text-slate-100';
            var saleBorder =
                (totalMonths != null && totalMonths < 6) ? 'border-red-300 bg-red-50 dark:bg-red-900/10' :
                (totalMonths != null && totalMonths < 12) ? 'border-amber-300 bg-amber-50 dark:bg-amber-900/10' :
                'border-slate-200 dark:border-slate-700';

            var saleStartCard =
                '<div class="rounded-lg border-2 ' + saleBorder + ' p-4 mb-3">' +
                    '<div class="text-xs uppercase font-semibold text-slate-500">BTC-sale window opens (aggregate basis)</div>' +
                    '<div class="text-xs text-slate-500 mt-0.5">First-line cash service exhausts — Phase 2 BTC sales begin</div>' +
                    '<div class="text-3xl font-bold mt-2 ' + saleStartCls + '">' + (saleStart || '—') + '</div>' +
                    '<div class="text-xs text-slate-500 mt-1 font-mono">' +
                        (totalMonths != null ? '~' + totalMonths.toFixed(1) + ' months out · ' : '') +
                        'zero-issuance assumption' +
                    '</div>' +
                '</div>';

            var cashDetail =
                '<div class="text-sm text-slate-700 dark:text-slate-200 mb-2">' +
                    '<span class="font-bold ' + monthsCls + '">' + (totalMonths != null ? '~' + totalMonths.toFixed(1) + ' months' : '—') + '</span> ' +
                    'until BTC sales operationally required. ' +
                    'Cash <span class="font-mono">' + cashTxt + '</span> as of <span class="font-mono">' + asOf + '</span>.' +
                '</div>';

            var cashCaption =
                '<div class="text-xs text-slate-500 italic leading-relaxed">' +
                    'STRC dividends are serviced from Strategy\'s cash buffer first; BTC sales activate only when cash exhausts. ' +
                    'This is the binding near-term signal for STRC holders — BTC sales trigger reflexive BTC-price feedback (see strc.md §V). ' +
                    '<a href="?asset=mstr" class="text-blue-500 hover:underline">→ Full sequenced waterfall + Phase 2 BTC-stack detail on MSTR dashboard</a>' +
                '</div>';

            cashSubPanel =
                '<div class="rounded-lg border border-slate-200 dark:border-slate-700 p-4 mt-4 bg-slate-50/40 dark:bg-slate-800/30">' +
                    '<div class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Strategy cash service horizon <span class="text-xs font-normal text-slate-500">— Phase 1 buffer before BTC sales activate</span></div>' +
                    saleStartCard +
                    cashDetail +
                    cashCaption +
                '</div>';
        }

        // ---- Footer affordance to MSTR for the full-stack waterfall.
        var footer =
            '<div class="text-xs text-slate-500 mt-4 leading-relaxed">' +
                'STRC is one tier in Strategy\'s preferred stack. The aggregate-preferred runway, multi-tier seniority waterfall (Senior Converts / STRF / STRC / STRK+STRD), and treasury-available breakdown all live on the issuer dashboard: ' +
                '<a href="?asset=mstr" class="text-blue-500 hover:underline">→ Full Cash-Service Waterfall + all-preferred runway analysis (MSTR dashboard)</a>' +
            '</div>';

        return '<div class="panel">' +
            '<div class="panel-title">STRC dividend obligation + runway <span class="text-xs font-normal text-slate-500">— STRC-slice cash service</span></div>' +
            headline +
            cashSubPanel +
            ceilingSubPanel +
            footer +
        '</div>';
    },

    // ============================================================
    // Strategy Event Log (v2b) — async-loaded after main render.
    // ============================================================
    _loadStrategyEventLog: function () {
        var target = document.getElementById('strc-event-log-panel');
        if (!target) return;
        var nocache = Math.floor(Date.now() / 60000);
        fetch('data/strategy_events.json?nocache=' + nocache)
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (events) {
                target.innerHTML = STRCRenderer._renderStrategyEventLogHtml(events);
                STRCRenderer._wireEventFilterChips();
                STRCRenderer._appendEventRiskFlags(events && events.risk_flags);
            })
            .catch(function () {
                target.innerHTML = STRCRenderer._renderStrategyEventLogHtml(null);
            });
    },

    _renderStrategyEventLogHtml: function (events) {
        if (!events || !Array.isArray(events.events)) {
            return '<div class="panel-title">Strategy Event Log <span class="text-xs font-normal text-slate-500">— EDGAR 8-K monitor</span></div>' +
                '<div class="risk-flag risk-warning">EDGAR event monitor data not available in this snapshot.</div>';
        }

        // Type-count badges across the top.
        var counts = events.events_by_type_count_last_90d || {};
        var typeOrder = ['BTC_SALE', 'BTC_PURCHASE', 'PREFERRED_ISSUANCE', 'STRC_RATE_ANNOUNCEMENT', 'ATM_PROGRAM_UPDATE', 'OTHER'];
        function badgeClass(type, count) {
            if (type === 'BTC_SALE')              return count > 0 ? 'bg-red-100 text-red-800 border-red-200'      : 'bg-slate-100 text-slate-500';
            if (type === 'BTC_PURCHASE')          return count > 0 ? 'bg-blue-100 text-blue-800 border-blue-200'   : 'bg-slate-100 text-slate-500';
            if (type === 'PREFERRED_ISSUANCE')    return count > 0 ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-slate-100 text-slate-500';
            return 'bg-slate-100 text-slate-700';
        }
        var badges = typeOrder.map(function (t) {
            var c = counts[t] || 0;
            return '<span class="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border ' + badgeClass(t, c) + '">' +
                '<span class="font-mono">' + c + '</span><span>' + t.replace(/_/g, ' ') + '</span>' +
            '</span>';
        }).join('');

        // Filter chips — same as types plus an "All".
        var chips = '<button type="button" class="strc-event-chip px-2 py-0.5 rounded-full text-xs font-medium bg-blue-600 text-white" data-filter="ALL">All</button>' +
            typeOrder.map(function (t) {
                return '<button type="button" class="strc-event-chip px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200" data-filter="' + t + '">' + t.replace(/_/g, ' ') + '</button>';
            }).join('');

        // Sort events newest first (PegTracker may emit either order — be defensive).
        var sorted = events.events.slice().sort(function (a, b) {
            return (b.ts_utc || '').localeCompare(a.ts_utc || '');
        });
        var rows = sorted.map(function (e) { return STRCRenderer._eventRowHtml(e); }).join('');
        if (!rows) {
            rows = '<div class="text-xs text-slate-500 italic">No events in current window.</div>';
        }

        // EDGAR health footer.
        var health = events.edgar_health || {};
        var lastPoll = health.last_successful_fetch_utc || events.last_edgar_poll_utc;
        var failures = health.consecutive_failures != null ? health.consecutive_failures : 0;
        var healthCls = failures >= 4 ? 'text-red-700' : failures > 0 ? 'text-amber-700' : 'text-slate-500';
        var healthIcon = failures >= 4 ? '⚠' : failures > 0 ? '△' : '✓';
        var healthFooter =
            '<div class="text-xs ' + healthCls + ' mt-4 pt-3 border-t border-slate-200 flex items-center gap-2">' +
                '<span>' + healthIcon + '</span>' +
                '<span>EDGAR last polled ' + (lastPoll ? CommonRenderer.formatDate(lastPoll) : '—') + ' · ' + failures + ' consecutive failures</span>' +
            '</div>';

        return '<div class="panel-title">Strategy Event Log <span class="text-xs font-normal text-slate-500">— EDGAR 8-K monitor</span></div>' +
            '<div class="flex flex-wrap gap-2 mb-3">' + badges + '</div>' +
            '<div class="flex flex-wrap gap-1.5 mb-3">' + chips + '</div>' +
            '<div id="strc-event-timeline" class="space-y-2">' + rows + '</div>' +
            healthFooter;
    },

    _eventRowHtml: function (e) {
        var type = e.type || 'OTHER';
        var sev = e.severity_hint || 'info';
        var sevCls = sev === 'critical' ? 'bg-red-100 text-red-800' :
                     sev === 'high'     ? 'bg-orange-100 text-orange-800' :
                     sev === 'warning'  ? 'bg-amber-100 text-amber-800' :
                                          'bg-slate-100 text-slate-700';
        var ts = e.ts_utc || e.filing_date;
        var dateTxt = ts ? CommonRenderer.formatDate(ts) : '—';
        var ageTxt = '';
        if (ts) {
            var ageDays = Math.floor((Date.now() - new Date(ts.endsWith('Z') ? ts : ts + 'Z').getTime()) / 86400000);
            ageTxt = ageDays === 0 ? 'today' :
                     ageDays === 1 ? '1 day ago' :
                     ageDays < 30  ? ageDays + ' days ago' :
                                     Math.round(ageDays / 30) + ' months ago';
        }
        var extracted = e.extracted || {};
        var detailParts = [];
        if (extracted.btc_count != null) detailParts.push(STRCRenderer._fmtNum(extracted.btc_count) + ' BTC');
        if (extracted.shares != null) detailParts.push(STRCRenderer._fmtNum(extracted.shares) + ' shares');
        if (extracted.series) detailParts.push(extracted.series);
        if (extracted.new_rate != null) detailParts.push((extracted.new_rate * 100).toFixed(2) + '%');
        var detail = detailParts.join(' · ');
        if (!detail && e.context) {
            var ctx = e.context.length > 140 ? e.context.slice(0, 140) + '…' : e.context;
            detail = '<span class="italic text-slate-500">' + ctx + '</span>';
        }
        var title = e.title || '(untitled filing)';
        var titleTxt = title.length > 110 ? title.slice(0, 110) + '…' : title;
        var linkHtml = e.filing_url ?
            '<a href="' + e.filing_url + '" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline text-xs">filing ↗</a>' : '';

        return '<div class="strc-event-row rounded border border-slate-200 dark:border-slate-700 p-3" data-type="' + type + '">' +
            '<div class="flex items-start justify-between gap-3">' +
                '<div class="flex-1 min-w-0">' +
                    '<div class="flex items-center gap-2 flex-wrap mb-1">' +
                        '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ' + sevCls + '">' + type.replace(/_/g, ' ') + '</span>' +
                        '<span class="text-xs text-slate-500">' + dateTxt + (ageTxt ? ' · ' + ageTxt : '') + '</span>' +
                    '</div>' +
                    '<div class="text-sm text-slate-800 dark:text-slate-100" title="' + title.replace(/"/g, '&quot;') + '">' + titleTxt + '</div>' +
                    (detail ? '<div class="text-xs text-slate-600 dark:text-slate-300 mt-1">' + detail + '</div>' : '') +
                '</div>' +
                '<div class="shrink-0">' + linkHtml + '</div>' +
            '</div>' +
        '</div>';
    },

    _wireEventFilterChips: function () {
        var chips = document.querySelectorAll('.strc-event-chip');
        if (!chips.length) return;
        chips.forEach(function (chip) {
            chip.addEventListener('click', function () {
                var filter = chip.getAttribute('data-filter');
                chips.forEach(function (c) {
                    var active = (c === chip);
                    c.className = 'strc-event-chip px-2 py-0.5 rounded-full text-xs font-medium ' +
                        (active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200');
                });
                var rows = document.querySelectorAll('.strc-event-row');
                rows.forEach(function (row) {
                    if (filter === 'ALL' || row.getAttribute('data-type') === filter) {
                        row.style.display = '';
                    } else {
                        row.style.display = 'none';
                    }
                });
            });
        });
    },

    // Surface events-side risk flags into the common Risk Flags panel.
    // Appends rather than overwriting so the backing-side flags remain visible.
    _appendEventRiskFlags: function (flags) {
        if (!Array.isArray(flags) || !flags.length) return;
        var container = document.getElementById('risk-flags');
        if (!container) return;
        // If the panel was hidden because backing had no flags, reveal it.
        var panel = container.closest('.panel');
        if (panel) panel.style.display = '';
        var wrap = panel && panel.parentElement;
        if (wrap && !wrap.classList.contains('lg:col-span-3')) wrap.classList.add('lg:col-span-3');

        var appended = flags.map(function (f) {
            return '<div class="risk-flag risk-' + (f.severity || 'info') + '">' +
                '<span class="font-semibold mr-1">[EDGAR]</span>' + (f.message || f.code || '—') +
            '</div>';
        }).join('');
        container.insertAdjacentHTML('beforeend', appended);
    },

    // STRC rate-trajectory chart — small inline chart inside the rate-
    // ceiling overlay sub-panel (Panel 3). Visualizes the §IV.5 one-way
    // ratchet: stress cycles bump the rate up, recovery doesn't bring it
    // back down.
    _paintRateTrajectoryChart: function (series) {
        var ctx = document.getElementById('strc-rate-trajectory-chart');
        if (!ctx) return;
        // Convert fraction → percent for plotting.
        var raw = STRCRenderer._seriesXY(series, 'strc_current_rate');
        var data = raw.map(function (p) { return { x: p.x, y: p.y * 100 }; });
        var ann = {
            launch: { type: 'line', yMin: 10.25, yMax: 10.25, borderColor: '#22c55e', borderWidth: 1, borderDash: [3, 3],
                      label: { content: '10.25% launch', display: true, position: 'end', font: { size: 9 }, color: '#16a34a' } },
            mid:    { type: 'line', yMin: 14, yMax: 14, borderColor: '#f59e0b', borderWidth: 1, borderDash: [4, 4],
                      label: { content: '14% mid-ceiling', display: true, position: 'end', font: { size: 9 }, color: '#d97706' } },
            top:    { type: 'line', yMin: 16, yMax: 16, borderColor: '#ef4444', borderWidth: 1, borderDash: [4, 4],
                      label: { content: '16% top-ceiling', display: true, position: 'end', font: { size: 9 }, color: '#dc2626' } }
        };
        if (window._strcRateTrajChart) window._strcRateTrajChart.destroy();
        window._strcRateTrajChart = new Chart(ctx, {
            type: 'line',
            data: { datasets: [{
                label: 'STRC rate (%)',
                data: data,
                borderColor: '#0ea5e9',
                backgroundColor: 'rgba(14,165,233,0.1)',
                fill: true, stepped: true, pointRadius: 2, borderWidth: 2
            }] },
            options: Object.assign({}, STRCRenderer._baseChartOpts(ann), {
                scales: {
                    x: { type: 'time', time: { unit: 'day', displayFormats: { day: 'MMM d' } }, grid: { display: false }, ticks: { maxTicksLimit: 6, font: { size: 10 } } },
                    y: { grid: { color: '#f1f5f9' }, ticks: { callback: function (v) { return v + '%'; }, font: { size: 10 } } }
                },
                plugins: { legend: { display: false }, annotation: { annotations: ann } }
            })
        });
    }
};
