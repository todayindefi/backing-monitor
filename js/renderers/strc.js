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
        if (regime === 'discount') return 'ATM not accretive. Strategy pivoted 2026-05-05 to BTC sales as the active preferred-dividend funding source.';
        if (regime === 'distress') return 'Funding model under acute stress. STRC dividend coverage analysis required.';
        return '—';
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

        var html = '';
        html += STRCRenderer._renderHeadlineBanner(tradfi);
        html += STRCRenderer._renderMnavRegime(tradfi);
        html += STRCRenderer._renderMstrBtcOverview(tradfi);
        html += STRCRenderer._renderStrcInstrument(tradfi);
        html += STRCRenderer._renderStrategyFunding(tradfi);
        html += STRCRenderer._renderStrcxWrapper(wrapper, riskFlags);
        html += STRCRenderer._renderDownstreamExposure(downstream);
        html += STRCRenderer._renderFreshness(data);

        container.innerHTML = html;

        // Post-paint chart renders — DOM nodes must exist first.
        STRCRenderer._loadHistoryAndPaintCharts(tradfi);
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
    // Panel 1 — Headline banner
    // ============================================================
    _renderHeadlineBanner: function (tradfi) {
        var mnav = tradfi.mnav || {};
        var strc = tradfi.strc_secondary || {};
        var mnavCls = STRCRenderer._mnavBandClass(mnav.regime);
        var mnavLabel = STRCRenderer._mnavBandLabel(mnav.regime);
        var mnavVal = (mnav.value != null) ? mnav.value.toFixed(2) : '—';
        var priceCls = STRCRenderer._strcPriceClass(strc.price_usd);
        var priceVal = (strc.price_usd != null) ? '$' + strc.price_usd.toFixed(2) : '—';
        var bpsTxt = '';
        if (strc.discount_to_par_bps != null) {
            var sign = strc.discount_to_par_bps >= 0 ? '+' : '';
            bpsTxt = sign + strc.discount_to_par_bps + ' bps vs par';
        }
        var nextRate = STRCRenderer._nextRateDecision();
        var nextDateStr = nextRate.date.toISOString().slice(0, 10);
        var nextLabel = nextRate.daysAway + ' day' + (nextRate.daysAway === 1 ? '' : 's');

        return '<div class="panel">' +
            '<div class="panel-title">Headline status</div>' +
            '<div class="grid grid-cols-1 md:grid-cols-3 gap-4">' +
                '<div class="rounded-lg border p-4 ' + mnavCls + '">' +
                    '<div class="text-xs uppercase font-semibold opacity-70">mNAV (MSTR mcap ÷ BTC NAV)</div>' +
                    '<div class="text-3xl font-bold mt-1">' + mnavVal + '</div>' +
                    '<div class="text-xs font-semibold mt-1">' + mnavLabel + '</div>' +
                '</div>' +
                '<div class="rounded-lg border border-slate-200 dark:border-slate-700 p-4">' +
                    '<div class="text-xs uppercase font-semibold text-slate-500">STRC secondary price</div>' +
                    '<div class="text-3xl font-bold mt-1 ' + priceCls + '">' + priceVal + '</div>' +
                    '<div class="text-xs text-slate-500 mt-1">' + bpsTxt + '</div>' +
                '</div>' +
                '<div class="rounded-lg border border-slate-200 dark:border-slate-700 p-4">' +
                    '<div class="text-xs uppercase font-semibold text-slate-500">Next rate decision (est.)</div>' +
                    '<div class="text-3xl font-bold mt-1 text-slate-800 dark:text-slate-100">' + nextLabel + '</div>' +
                    '<div class="text-xs text-slate-500 mt-1">' + nextDateStr + ' · mid-month VWAP reset</div>' +
                '</div>' +
            '</div>' +
        '</div>';
    },

    // ============================================================
    // Panel 2 — mNAV regime (LOAD-BEARING)
    // ============================================================
    _renderMnavRegime: function (tradfi) {
        var mnav = tradfi.mnav || {};
        var val = (mnav.value != null) ? mnav.value.toFixed(4) : '—';
        var regime = mnav.regime || 'unknown';
        var caption = STRCRenderer._mnavCaption(regime);
        var bandCls = STRCRenderer._mnavBandClass(regime);
        var label = STRCRenderer._mnavBandLabel(regime);

        return '<div class="panel">' +
            '<div class="panel-title">mNAV Regime <span class="text-xs font-normal text-slate-500">— load-bearing signal</span></div>' +
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
                    '<div style="height: 240px; position: relative;"><canvas id="strc-mnav-chart"></canvas></div>' +
                '</div>' +
            '</div>' +
            '<div class="mt-4 p-3 rounded border ' + bandCls + '">' +
                '<div class="text-sm">' + caption + '</div>' +
            '</div>' +
            '<div class="text-xs text-slate-500 mt-3">' +
                'Methodology: mNAV = MSTR market cap ÷ (Strategy BTC count × BTC spot). See ' +
                '<a href="https://github.com/todayindefi/riskAnalyst/blob/master/assets/_frameworks/strc-framework.md" ' +
                'target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline">framework §IV (MSTR cash-flow stack)</a>.' +
            '</div>' +
        '</div>';
    },

    // ============================================================
    // Panel 3 — MSTR / BTC overview
    // ============================================================
    _renderMstrBtcOverview: function (tradfi) {
        var mstr = tradfi.mstr || {};
        var btc = tradfi.btc || {};
        var hold = tradfi.strategy_btc_holdings || {};
        var btcNav = (hold.count != null && btc.price_usd != null) ? hold.count * btc.price_usd : null;
        var mstrMcap = mstr.market_cap_usd;
        var impliedMnav = (mstrMcap != null && btcNav) ? mstrMcap / btcNav : null;

        return '<div class="panel">' +
            '<div class="panel-title">MSTR / BTC overview</div>' +
            '<div class="grid grid-cols-1 md:grid-cols-3 gap-4">' +
                // MSTR
                '<div class="rounded border border-slate-200 dark:border-slate-700 p-3">' +
                    '<div class="text-xs uppercase font-semibold text-slate-500">MSTR</div>' +
                    '<div class="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">' + STRCRenderer._fmtMoney(mstr.price_usd, 2) + '</div>' +
                    '<div class="text-xs text-slate-500 mt-1">Market cap ' + STRCRenderer._fmtMoneyShort(mstrMcap) + '</div>' +
                    '<div style="height: 110px; position: relative;" class="mt-2"><canvas id="strc-mstr-chart"></canvas></div>' +
                '</div>' +
                // BTC
                '<div class="rounded border border-slate-200 dark:border-slate-700 p-3">' +
                    '<div class="text-xs uppercase font-semibold text-slate-500">BTC</div>' +
                    '<div class="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">' + STRCRenderer._fmtMoney(btc.price_usd, 0) + '</div>' +
                    '<div class="text-xs text-slate-500 mt-1">' +
                        'Strategy holds ' + STRCRenderer._fmtNum(hold.count) + ' BTC · ' +
                        'NAV ' + STRCRenderer._fmtMoneyShort(btcNav) +
                    '</div>' +
                    '<div style="height: 110px; position: relative;" class="mt-2"><canvas id="strc-btc-chart"></canvas></div>' +
                '</div>' +
                // Implied mNAV breakdown
                '<div class="rounded border border-slate-200 dark:border-slate-700 p-3">' +
                    '<div class="text-xs uppercase font-semibold text-slate-500">Implied mNAV</div>' +
                    '<div class="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">' + (impliedMnav != null ? impliedMnav.toFixed(4) : '—') + '</div>' +
                    '<div class="text-xs text-slate-500 mt-2 space-y-1">' +
                        '<div>MSTR mcap <span class="font-mono">' + STRCRenderer._fmtMoneyShort(mstrMcap) + '</span></div>' +
                        '<div>÷ BTC NAV <span class="font-mono">' + STRCRenderer._fmtMoneyShort(btcNav) + '</span></div>' +
                        '<div class="pt-1 border-t border-slate-200 dark:border-slate-700">= mNAV <span class="font-mono">' + (impliedMnav != null ? impliedMnav.toFixed(4) : '—') + '</span></div>' +
                    '</div>' +
                '</div>' +
            '</div>' +
        '</div>';
    },

    // ============================================================
    // Panel 4 — STRC instrument
    // ============================================================
    _renderStrcInstrument: function (tradfi) {
        var div = tradfi.strc_dividend || {};
        var rate = div.current_rate;
        var rateTxt = (rate != null) ? (rate * 100).toFixed(2) + '%' : '—';
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
    // Panel 5 — Strategy funding-source (lightweight v1)
    // ============================================================
    _renderStrategyFunding: function (tradfi) {
        var div = tradfi.strc_dividend || {};
        var btc = tradfi.btc || {};
        var annual = div.annual_dividend_obligation_usd;
        var btcPerYear = (annual != null && btc.price_usd) ? annual / btc.price_usd : null;
        var rateLabel = (div.current_rate != null) ? (div.current_rate * 100).toFixed(2) + '%' : '—';

        return '<div class="panel">' +
            '<div class="panel-title">Strategy funding — STRC dividend coverage</div>' +
            '<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">' +
                '<div class="summary-card">' +
                    '<div class="card-label">Annual STRC dividend obligation</div>' +
                    '<div class="card-value">' + STRCRenderer._fmtMoneyShort(annual) + '</div>' +
                    '<div class="text-xs text-slate-400 mt-1">at current ' + rateLabel + ' rate</div>' +
                '</div>' +
                '<div class="summary-card">' +
                    '<div class="card-label">BTC sales implied (STRC only)</div>' +
                    '<div class="card-value">' + (btcPerYear != null ? STRCRenderer._fmtNum(btcPerYear) + ' / yr' : '—') + '</div>' +
                    '<div class="text-xs text-slate-400 mt-1">at BTC ' + STRCRenderer._fmtMoney(btc.price_usd, 0) + '</div>' +
                '</div>' +
                '<div class="summary-card">' +
                    '<div class="card-label">Total preferred funding (disclosed)</div>' +
                    '<div class="card-value">~18,500–19,000 BTC/yr</div>' +
                    '<div class="text-xs text-slate-400 mt-1">~2.2% of treasury · Saylor 2026-05-05</div>' +
                '</div>' +
            '</div>' +
            '<div class="risk-flag risk-warning">' +
                '<strong>Regime change — Saylor pivot 2026-05-05:</strong> ' +
                'Strategy disclosed that BTC sales (not ATM equity issuance) are now the active funding source for the preferred-stock dividend stack. ' +
                'At mNAV below parity, ATM is dilutive rather than accretive, so the company draws down the BTC treasury to service preferred coupons. ' +
                'STRC sits inside that stack alongside STRF / STRK / STRD. ' +
                'v1 surfaces only derived figures; v2 will parse 10-Q preferred-dividends-payable and ATM cadence.' +
            '</div>' +
        '</div>';
    },

    // ============================================================
    // Panel 6 — STRCx wrapper
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
                '<div class="summary-card">' +
                    '<div class="card-label">Implied per-token USD</div>' +
                    '<div class="card-value">' + (wrapper.coingecko_price_usd != null ? '$' + wrapper.coingecko_price_usd.toFixed(2) : '—') + '</div>' +
                    '<div class="text-xs text-slate-400 mt-1">CoinGecko cross-chain aggregate</div>' +
                '</div>' +
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
                STRCRenderer._paintMstrChart(series);
                STRCRenderer._paintBtcChart(series);
                STRCRenderer._paintStrcPriceChart(series);
                STRCRenderer._paintMultiplierChart(series);
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

    _paintMstrChart: function (series) {
        var ctx = document.getElementById('strc-mstr-chart');
        if (!ctx) return;
        var data = STRCRenderer._seriesXY(series, 'mstr_price');
        if (window._strcMstrChart) window._strcMstrChart.destroy();
        window._strcMstrChart = new Chart(ctx, {
            type: 'line',
            data: { datasets: [{
                label: 'MSTR',
                data: data,
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99,102,241,0.1)',
                fill: true, tension: 0.3, pointRadius: 0, borderWidth: 1.5
            }] },
            options: STRCRenderer._baseChartOpts()
        });
    },

    _paintBtcChart: function (series) {
        var ctx = document.getElementById('strc-btc-chart');
        if (!ctx) return;
        var data = STRCRenderer._seriesXY(series, 'btc_price');
        if (window._strcBtcChart) window._strcBtcChart.destroy();
        window._strcBtcChart = new Chart(ctx, {
            type: 'line',
            data: { datasets: [{
                label: 'BTC',
                data: data,
                borderColor: '#f59e0b',
                backgroundColor: 'rgba(245,158,11,0.1)',
                fill: true, tension: 0.3, pointRadius: 0, borderWidth: 1.5
            }] },
            options: STRCRenderer._baseChartOpts()
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
    }
};
