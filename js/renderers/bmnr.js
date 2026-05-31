/**
 * BMNR renderer — BitMine Immersion ETH-treasury firepower view.
 *
 * Consumes data/bmnr_backing.json (renamed from PegTracker's bmnr_treasury.json
 * via sync_and_push.sh, to match dashboard's _backing.json convention) plus
 * data/bmnr_backing_history.json for the mNAV trajectory chart.
 *
 * Five panels for v1 (handoff intentionally smaller than MSTR — BMNR has no
 * debt, no preferred, no convertibles; firepower + cadence + runway is the
 * entire story):
 *   1. Headline banner — price, mNAV (both ways), ETH-per-share
 *   2. mNAV trajectory chart (two lines + parity reference)
 *   3. Treasury composition (ETH + cash + strategic stakes + BTC)
 *   4. Weekly ETH-buy cadence (last 8 weeks from 8-K)
 *   5. Firepower & runway (cash-only, ATM-remaining, weeks-to-5%-target)
 *
 * Plus standard risk-flag panel + freshness footer.
 *
 * Handoff: ~/riskAnalyst/specs/handoffs/bmnr-renderer-backing-monitor.md
 * Asset analysis: ~/riskAnalyst/assets/bmnr.md
 * Pattern mirrored: js/renderers/mstr.js (sibling treasury-company equity view)
 */

var BMNRRenderer = {

    // ============================================================
    // helpers — namespaced to avoid global-scope collision with
    // mstr.js / strc.js / other renderers that share this scope.
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

    // BMNR analyzer can emit hybrid strings like "parity_to_discount" when
    // ETH-only is at parity but full-treasury slips into discount. Snap to
    // the worse tone so the badge tracks the more conservative read.
    _normalizeRegime: function (regime) {
        if (!regime) return 'unknown';
        var r = String(regime).toLowerCase();
        if (r.indexOf('distress') >= 0) return 'distress';
        if (r.indexOf('discount') >= 0) return 'discount';
        if (r.indexOf('parity') >= 0)   return 'parity';
        if (r.indexOf('premium') >= 0)  return 'premium';
        return 'unknown';
    },

    _mnavBandClass: function (regime) {
        var r = BMNRRenderer._normalizeRegime(regime);
        if (r === 'premium')  return 'border-green-300 bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-200';
        if (r === 'parity')   return 'border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200';
        if (r === 'discount') return 'border-orange-300 bg-orange-50 text-orange-800 dark:bg-orange-900/20 dark:text-orange-200';
        if (r === 'distress') return 'border-red-300 bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-200';
        return 'border-slate-300 bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-200';
    },
    _mnavBandLabel: function (regime) {
        var r = BMNRRenderer._normalizeRegime(regime);
        if (r === 'premium')  return 'PREMIUM';
        if (r === 'parity')   return 'PARITY';
        if (r === 'discount') return 'DISCOUNT';
        if (r === 'distress') return 'DISTRESS';
        return (regime || '—').toString().toUpperCase();
    },

    // mNAV-per-tile color (a single mNAV scalar drives the tile band).
    _mnavTileClass: function (value) {
        if (value == null) return 'border-slate-300 bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-200';
        if (value >= 1.05) return 'border-green-300 bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-200';
        if (value >= 0.95) return 'border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200';
        if (value >= 0.85) return 'border-orange-300 bg-orange-50 text-orange-800 dark:bg-orange-900/20 dark:text-orange-200';
        return 'border-red-300 bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-200';
    },

    _editorialCaption: function (regime) {
        var r = BMNRRenderer._normalizeRegime(regime);
        if (r === 'premium')  return 'ATM issuance accretive — every $1 raised buys >$1 of ETH for existing holders. Compounding regime.';
        if (r === 'parity')   return 'ATM marginal — neither accretive nor dilutive in ETH-per-share terms. The fulcrum.';
        if (r === 'discount') return 'ATM dilutive to ETH-per-share. BMNR can still raise cash but at a per-share-NAV cost to existing holders.';
        if (r === 'distress') return 'Capital markets pricing meaningful execution doubt. Treasury narrative breaking.';
        return '—';
    },

    // ============================================================
    // preRender — runs before common.renderSummaryCards / renderBreakdown.
    // BMNR JSON has neither a `summary` block nor `backing_breakdown`, so
    // scaffold placeholders to keep common.js from NPE'ing. _suppressCommonPanels
    // hides them outright in render().
    // ============================================================
    preRender: function (data) {
        if (!data) return;
        // Header override — without this, app.js renders "bmnr (NYSE + ETH treasury)".
        data.asset = 'BMNR';
        data.chain = 'NYSE + ETH treasury';
        // app.js reads data.timestamp; analyzer emits data.as_of.
        if (!data.timestamp && data.as_of) data.timestamp = data.as_of;

        var live = data.live || {};
        var treasury = data.treasury || {};

        if (!data.summary) {
            data.summary = {
                total_supply: live.market_cap_usd || 0,
                total_backing: treasury.treasury_nav_full_usd || 0,
                collateral_ratio: 100,
                collateral_ratio_alt: {
                    label: 'ETH-only mNAV',
                    value: (data.mnav && data.mnav.eth_only != null) ? data.mnav.eth_only : 0,
                    is_currency: false
                },
                surplus_deficit: 0
            };
        }
        if (!Array.isArray(data.backing_breakdown)) data.backing_breakdown = [];
        if (!data.asset_specific) data.asset_specific = { type: 'bmnr' };
    },

    // ============================================================
    // render — entry point.
    // ============================================================
    render: function (data) {
        var container = document.getElementById('asset-specific-panels');
        if (!container) return;

        BMNRRenderer._suppressCommonPanels(data);

        var html = '';
        html += BMNRRenderer._renderFreshnessBanner(data);
        html += BMNRRenderer._renderHeadlineBanner(data);
        html += BMNRRenderer._renderMnavTrajectory(data);
        html += BMNRRenderer._renderTreasuryComposition(data);
        html += BMNRRenderer._renderCadenceTable(data);
        html += BMNRRenderer._renderFirepowerRunway(data);
        html += BMNRRenderer._renderFreshness(data);

        container.innerHTML = html;

        // Post-paint — DOM nodes must exist first.
        BMNRRenderer._paintCompositionChart(data);
        BMNRRenderer._loadHistoryAndPaintMnavChart();
    },

    _suppressCommonPanels: function (data) {
        var s = document.getElementById('summary-cards');
        if (s) s.style.display = 'none';
        var bd = document.getElementById('breakdown-table');
        if (bd) { var p = bd.closest('.panel'); if (p) p.style.display = 'none'; }
        var pie = document.getElementById('pie-chart');
        if (pie) { var p2 = pie.closest('.panel'); if (p2) p2.style.display = 'none'; }
        var cp = document.getElementById('chart-panel');
        if (cp) cp.style.display = 'none';

        // Risk flags panel: widen to full-width when flags fire; hide otherwise.
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
    // Freshness banner — surfaced above the headline when stale.
    // Conditions per handoff §Verification.
    // ============================================================
    _renderFreshnessBanner: function (data) {
        var f = data.freshness || {};
        var warnings = [];
        if (f.price_age_seconds != null && f.price_age_seconds > 86400) {
            var hrs = Math.round(f.price_age_seconds / 3600);
            warnings.push('BMNR price data is over 24h old (' + hrs + 'h).');
        }
        if (f.treasury_8k_age_days != null && f.treasury_8k_age_days > 14) {
            warnings.push('Treasury composition is over 2 weeks stale (' + f.treasury_8k_age_days + 'd since last 8-K refresh).');
        }
        if (warnings.length === 0) return '';
        return '<div class="risk-flag risk-warning mb-4">' +
            '<strong>Freshness warning.</strong> ' + warnings.join(' ') +
        '</div>';
    },

    // ============================================================
    // Panel 1 — Headline banner
    // ============================================================
    _renderHeadlineBanner: function (data) {
        var live = data.live || {};
        var treasury = data.treasury || {};
        var mnav = data.mnav || {};
        var price = live.bmnr_price_usd;
        var shares = live.shares_outstanding;
        var ethCount = treasury.eth_count;
        var ethPerShare = (ethCount != null && shares) ? (ethCount / shares) : null;

        var mnavEth = mnav.eth_only;
        var mnavFull = mnav.full_treasury;
        var ethTileCls = BMNRRenderer._mnavTileClass(mnavEth);
        var fullTileCls = BMNRRenderer._mnavTileClass(mnavFull);
        var regimeLabel = BMNRRenderer._mnavBandLabel(mnav.regime);
        var bandCls = BMNRRenderer._mnavBandClass(mnav.regime);
        var caption = BMNRRenderer._editorialCaption(mnav.regime);

        return '<div class="panel">' +
            '<div class="panel-title">Headline status <span class="text-xs font-normal text-slate-500">— ETH-treasury firepower lens</span></div>' +
            '<div class="grid grid-cols-2 md:grid-cols-4 gap-3">' +
                '<div class="rounded-lg border border-slate-200 dark:border-slate-700 p-4">' +
                    '<div class="text-xs uppercase font-semibold text-slate-500">BMNR price</div>' +
                    '<div class="text-3xl font-bold mt-1 text-slate-800 dark:text-slate-100">' + (price != null ? BMNRRenderer._fmtMoney(price, 2) : '—') + '</div>' +
                    '<div class="text-xs text-slate-500 mt-1">Market cap ' + BMNRRenderer._fmtMoneyShort(live.market_cap_usd) + '</div>' +
                '</div>' +
                '<div class="rounded-lg border p-4 ' + ethTileCls + '">' +
                    '<div class="text-xs uppercase font-semibold opacity-70">mNAV (ETH-only)</div>' +
                    '<div class="text-3xl font-bold mt-1">' + (mnavEth != null ? mnavEth.toFixed(3) : '—') + '</div>' +
                    '<div class="text-xs font-semibold mt-1">market cap / ETH NAV</div>' +
                '</div>' +
                '<div class="rounded-lg border p-4 ' + fullTileCls + '">' +
                    '<div class="text-xs uppercase font-semibold opacity-70">mNAV (full treasury)</div>' +
                    '<div class="text-3xl font-bold mt-1">' + (mnavFull != null ? mnavFull.toFixed(3) : '—') + '</div>' +
                    '<div class="text-xs font-semibold mt-1">incl. cash + BTC + stakes</div>' +
                '</div>' +
                '<div class="rounded-lg border border-slate-200 dark:border-slate-700 p-4">' +
                    '<div class="text-xs uppercase font-semibold text-slate-500">ETH per share</div>' +
                    '<div class="text-3xl font-bold mt-1 text-slate-800 dark:text-slate-100">' +
                        (ethPerShare != null ? ethPerShare.toFixed(6) : '—') +
                    '</div>' +
                    '<div class="text-xs text-slate-500 mt-1">' +
                        (shares ? BMNRRenderer._fmtNum(shares) + ' shares · ' : '') +
                        BMNRRenderer._fmtNum(ethCount) + ' ETH' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div class="mt-4 p-3 rounded border ' + bandCls + '">' +
                '<div class="text-xs uppercase font-semibold opacity-80 mb-1">Regime · ' + regimeLabel + '</div>' +
                '<div class="text-sm">' + caption + '</div>' +
                (mnav.regime_band ? '<div class="text-xs mt-2 opacity-80">' + mnav.regime_band + '</div>' : '') +
            '</div>' +
        '</div>';
    },

    // ============================================================
    // Panel 2 — mNAV trajectory chart (load-bearing).
    // 90-day series, two lines + parity reference.
    // ============================================================
    _renderMnavTrajectory: function (data) {
        var mnav = data.mnav || {};
        var thresholds = mnav.regime_thresholds || {};
        return '<div class="panel">' +
            '<div class="panel-title">mNAV trajectory <span class="text-xs font-normal text-slate-500">— ETH-only vs full treasury, 90d</span></div>' +
            '<div style="height: 300px; position: relative;"><canvas id="bmnr-mnav-chart"></canvas></div>' +
            '<div class="text-xs text-slate-500 mt-3 leading-relaxed">' +
                'Solid line: market cap / ETH-only NAV. Dashed line: market cap / full-treasury NAV ' +
                '(ETH + cash + BTC + strategic stakes). The wedge between them is the equity-multiple ' +
                'drag from non-ETH treasury items. Dashed reference at parity 1.00. ' +
                'Regime bands: premium ' + (thresholds.premium || '≥1.05') +
                ' · parity ' + (thresholds.parity || '0.95–1.05') +
                ' · discount ' + (thresholds.discount || '0.85–0.95') +
                ' · distress ' + (thresholds.distress || '<0.85') + '.' +
            '</div>' +
        '</div>';
    },

    // ============================================================
    // Panel 3 — Treasury composition
    // ============================================================
    _renderTreasuryComposition: function (data) {
        var treasury = data.treasury || {};
        var navFull = treasury.treasury_nav_full_usd || 0;

        function pctOf(v) {
            if (v == null || !navFull) return '—';
            return (v / navFull * 100).toFixed(1) + '%';
        }

        var rows = [
            ['ETH holdings',       treasury.eth_value_usd,        BMNRRenderer._fmtNum(treasury.eth_count) + ' ETH'],
            ['Cash & equivalents', treasury.cash_usd,             ''],
            ['Strategic stakes',   treasury.strategic_stakes_usd, ''],
            ['BTC holdings',       treasury.btc_value_usd,        BMNRRenderer._fmtNum(treasury.btc_count) + ' BTC']
        ];

        var rowHtml = rows.map(function (r) {
            return '<tr>' +
                '<td class="font-medium">' + r[0] + '</td>' +
                '<td class="text-right font-mono">' + (r[1] != null ? BMNRRenderer._fmtMoneyShort(r[1]) : '—') + '</td>' +
                '<td class="text-right font-mono text-slate-500">' + pctOf(r[1]) + '</td>' +
                '<td class="text-xs text-slate-500">' + r[2] + '</td>' +
            '</tr>';
        }).join('') +
            '<tr class="font-bold border-t-2 border-slate-200">' +
                '<td>Treasury NAV (full)</td>' +
                '<td class="text-right font-mono">' + BMNRRenderer._fmtMoneyShort(navFull) + '</td>' +
                '<td class="text-right font-mono">100.0%</td>' +
                '<td></td>' +
            '</tr>';

        var stakedPct = treasury.eth_staked_pct;
        var stakedTile =
            '<div class="rounded-lg border border-slate-200 dark:border-slate-700 p-4">' +
                '<div class="text-xs uppercase font-semibold text-slate-500">ETH staked</div>' +
                '<div class="text-3xl font-bold mt-1 text-slate-800 dark:text-slate-100">' + (stakedPct != null ? BMNRRenderer._fmtPct(stakedPct, 1) : '—') + '</div>' +
                '<div class="text-xs text-slate-500 mt-1">' + BMNRRenderer._fmtNum(treasury.eth_staked_count) + ' ETH · earning native yield</div>' +
            '</div>';

        var ethSupplyTile =
            '<div class="rounded-lg border border-slate-200 dark:border-slate-700 p-4">' +
                '<div class="text-xs uppercase font-semibold text-slate-500">% of ETH supply</div>' +
                '<div class="text-3xl font-bold mt-1 text-slate-800 dark:text-slate-100">' + (treasury.eth_pct_of_supply != null ? BMNRRenderer._fmtPct(treasury.eth_pct_of_supply, 2) : '—') + '</div>' +
                '<div class="text-xs text-slate-500 mt-1">stated target: 5%</div>' +
            '</div>';

        var asOf = treasury.as_of_8k || '—';
        var srcUrl = treasury.source_url;
        var srcLink = srcUrl ? ' · <a href="' + srcUrl + '" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline">latest 8-K ↗</a>' : '';

        return '<div class="panel">' +
            '<div class="panel-title">Treasury composition</div>' +
            '<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">' +
                '<div>' +
                    '<div style="height: 260px; position: relative;"><canvas id="bmnr-composition-chart"></canvas></div>' +
                '</div>' +
                '<div class="data-table-scroll">' +
                    '<table class="data-table">' +
                        '<thead><tr><th>Asset</th><th class="text-right">USD</th><th class="text-right">% of NAV</th><th>Count</th></tr></thead>' +
                        '<tbody>' + rowHtml + '</tbody>' +
                    '</table>' +
                '</div>' +
            '</div>' +
            '<div class="grid grid-cols-2 gap-3 mt-4">' +
                stakedTile +
                ethSupplyTile +
            '</div>' +
            '<div class="text-xs text-slate-500 mt-3 leading-relaxed">' +
                'As of 8-K dated <span class="font-mono">' + asOf + '</span> — refreshed weekly' + srcLink + '.' +
            '</div>' +
        '</div>';
    },

    // ============================================================
    // Panel 4 — Weekly ETH-buy cadence
    // Derives weekly deltas from history_8k (entries are 8-K-dated).
    // ============================================================
    _renderCadenceTable: function (data) {
        var hist = Array.isArray(data.history_8k) ? data.history_8k.slice() : [];
        var ethPxFallback = (data.live && data.live.eth_price_usd) || null;

        // history_8k is chronological; sort ascending then iterate to compute deltas.
        hist.sort(function (a, b) { return (a.date || '').localeCompare(b.date || ''); });

        var rows = hist.map(function (e, i) {
            var prev = i > 0 ? hist[i - 1] : null;
            var delta = (prev && e.eth_count != null && prev.eth_count != null) ? (e.eth_count - prev.eth_count) : null;
            // Treat the cumulative total_crypto_cash_usd as week-end snapshot; not a
            // straight USD-spent figure. Approximate weekly USD spent as delta × current
            // ETH price (analyzer's cadence_4w uses the same approximation).
            var usdSpent = (delta != null && ethPxFallback) ? (delta * ethPxFallback) : null;
            return '<tr>' +
                '<td class="font-mono">' + (e.date || '—') + '</td>' +
                '<td class="text-right font-mono">' + (e.eth_count != null ? BMNRRenderer._fmtNum(e.eth_count) : '—') + '</td>' +
                '<td class="text-right font-mono ' + (delta != null && delta > 0 ? 'text-green-700' : 'text-slate-500') + '">' +
                    (delta != null ? (delta > 0 ? '+' : '') + BMNRRenderer._fmtNum(delta) : '—') +
                '</td>' +
                '<td class="text-right font-mono">' + (usdSpent != null ? '~' + BMNRRenderer._fmtMoneyShort(usdSpent) : '—') + '</td>' +
                '<td class="text-right font-mono">' + (e.total_crypto_cash_usd != null ? BMNRRenderer._fmtMoneyShort(e.total_crypto_cash_usd) : '—') + '</td>' +
            '</tr>';
        });

        // Reverse so most-recent-first in the rendered table (more useful reading order).
        rows.reverse();

        var cadence = data.cadence_4w || {};
        var footer = '';
        if (cadence.weekly_avg_eth != null) {
            footer =
                '<div class="text-sm text-slate-700 dark:text-slate-200 mt-3">' +
                    '<span class="font-semibold">4-week avg:</span> ' +
                    '<span class="font-mono">' + BMNRRenderer._fmtNum(cadence.weekly_avg_eth) + ' ETH/week</span>' +
                    (cadence.weekly_avg_usd_est != null ? ' (~<span class="font-mono">' + BMNRRenderer._fmtMoneyShort(cadence.weekly_avg_usd_est) + '</span>)' : '') +
                    (cadence.window_start && cadence.window_end ?
                        '<span class="text-xs text-slate-500"> · window ' + cadence.window_start + ' → ' + cadence.window_end + '</span>' : '') +
                '</div>' +
                (cadence.source ? '<div class="text-xs text-slate-500 italic mt-1">' + cadence.source + '</div>' : '');
        }

        return '<div class="panel">' +
            '<div class="panel-title">Weekly ETH-buy cadence <span class="text-xs font-normal text-slate-500">— from 8-K announcements</span></div>' +
            (rows.length > 0 ?
                '<div class="data-table-scroll">' +
                    '<table class="data-table">' +
                        '<thead><tr>' +
                            '<th>Week ending</th>' +
                            '<th class="text-right">ETH count (total)</th>' +
                            '<th class="text-right">ETH added</th>' +
                            '<th class="text-right">USD spent (est)</th>' +
                            '<th class="text-right">Crypto + cash (8-K)</th>' +
                        '</tr></thead>' +
                        '<tbody>' + rows.join('') + '</tbody>' +
                    '</table>' +
                '</div>' :
                '<div class="text-sm text-slate-500">No 8-K history available yet.</div>') +
            footer +
        '</div>';
    },

    // ============================================================
    // Panel 5 — Firepower & runway
    // ============================================================
    _renderFirepowerRunway: function (data) {
        var fp = data.firepower || {};
        var yield_ = data.yield || {};
        var cadence = data.cadence_4w || {};
        var target = fp.target || {};
        var live = data.live || {};

        var weeksTo5 = fp.weeks_to_5pct_target_at_current_pace;
        var atmRunway = fp.atm_runway_weeks_at_current_pace;
        var cashOnly = fp.cash_only_eth_at_spot;
        var weeklyOrganic = yield_.weekly_eth_from_staking_est;
        var weeklyAvg = cadence.weekly_avg_eth;

        function tile(label, value, sub, valueCls) {
            valueCls = valueCls || 'text-slate-800 dark:text-slate-100';
            return '<div class="rounded-lg border border-slate-200 dark:border-slate-700 p-4">' +
                '<div class="text-xs uppercase font-semibold text-slate-500">' + label + '</div>' +
                '<div class="text-3xl font-bold mt-1 ' + valueCls + '">' + value + '</div>' +
                '<div class="text-xs text-slate-500 mt-1 leading-relaxed">' + sub + '</div>' +
            '</div>';
        }

        var atmAuthTxt = fp.atm_authorized_usd != null ? ' of ' + BMNRRenderer._fmtMoneyShort(fp.atm_authorized_usd) + ' authorized' : '';

        var organicShareTxt = '';
        if (weeklyAvg && weeklyOrganic) {
            var share = weeklyOrganic / weeklyAvg;
            organicShareTxt = ' (~' + BMNRRenderer._fmtPct(share, 0) + ' of current pace)';
        }

        var capCaption = '';
        if (weeklyOrganic != null && cashOnly != null && weeklyAvg) {
            var share2 = weeklyOrganic / weeklyAvg;
            capCaption =
                '<div class="text-sm text-slate-700 dark:text-slate-200 mt-4 leading-relaxed">' +
                    '<strong>If the ATM goes offline</strong> (sustained mNAV distress, market disruption), BMNR can keep buying ETH at ' +
                    '<span class="font-mono">' + BMNRRenderer._fmtNum(weeklyOrganic) + ' ETH/week</span> from organic staking yield indefinitely, ' +
                    'plus a one-shot ~<span class="font-mono">' + BMNRRenderer._fmtNum(cashOnly) + ' ETH</span> from the cash hoard. ' +
                    'That\'s <span class="font-mono">' + BMNRRenderer._fmtPct(share2, 0) + '</span> of the current ATM-driven pace — meaningful but not transformative.' +
                '</div>';
        }

        var grid =
            '<div class="grid grid-cols-1 md:grid-cols-2 gap-3">' +
                tile(
                    'Cash-only firepower',
                    cashOnly != null ? BMNRRenderer._fmtNum(cashOnly) + ' ETH' : '—',
                    'ETH BMNR could buy with current cash hoard at spot, no ATM. ' +
                    (fp.cash_only_eth_at_spot && live.eth_price_usd ? '@ ' + BMNRRenderer._fmtMoney(live.eth_price_usd, 0) + '/ETH' : '')
                ) +
                tile(
                    'ATM remaining',
                    fp.atm_remaining_usd != null ? BMNRRenderer._fmtMoneyShort(fp.atm_remaining_usd) : '—',
                    'Authorization headroom' + atmAuthTxt +
                    (atmRunway != null ? ' · ~' + atmRunway + ' weeks at current pace' : '')
                ) +
                tile(
                    'Weeks to 5% target',
                    weeksTo5 != null ? weeksTo5 + ' wk' : '—',
                    (weeklyAvg ? 'At ' + BMNRRenderer._fmtNum(weeklyAvg) + ' ETH/week pace · ' : '') +
                    (fp.eth_needed_for_5pct_target != null ? BMNRRenderer._fmtNum(fp.eth_needed_for_5pct_target) + ' ETH to go' : '') +
                    (target.rationale ? '<br/><span class="italic">' + target.rationale + '</span>' : '')
                ) +
                tile(
                    'Organic ETH growth',
                    weeklyOrganic != null ? BMNRRenderer._fmtNum(weeklyOrganic) + ' ETH/wk' : '—',
                    'From native staking yield alone (no ATM needed)' + organicShareTxt + '. ' +
                    (yield_.annualized_yield_pct != null ? '~' + BMNRRenderer._fmtPct(yield_.annualized_yield_pct, 2) + '/yr' : '')
                ) +
            '</div>';

        return '<div class="panel">' +
            '<div class="panel-title">Firepower &amp; runway <span class="text-xs font-normal text-slate-500">— how fast can BMNR keep accumulating?</span></div>' +
            grid +
            capCaption +
        '</div>';
    },

    // ============================================================
    // Freshness footer
    // ============================================================
    _renderFreshness: function (data) {
        var ts = data.timestamp || data.as_of;
        var age = data.freshness_seconds;
        var ageTxt = '';
        if (age != null) {
            if (age < 60) ageTxt = age + 's ago';
            else if (age < 3600) ageTxt = Math.round(age / 60) + 'm ago';
            else if (age < 86400) ageTxt = Math.round(age / 3600) + 'h ago';
            else ageTxt = Math.round(age / 86400) + 'd ago';
        }
        var priceAge = data.freshness && data.freshness.price_age_seconds;
        var t8kAge = data.freshness && data.freshness.treasury_8k_age_days;
        var freshnessLine = '';
        if (priceAge != null || t8kAge != null) {
            var parts = [];
            if (priceAge != null) parts.push('price ' + (priceAge < 60 ? priceAge + 's' : priceAge < 3600 ? Math.round(priceAge / 60) + 'm' : priceAge < 86400 ? Math.round(priceAge / 3600) + 'h' : Math.round(priceAge / 86400) + 'd') + ' old');
            if (t8kAge != null) parts.push('8-K ' + t8kAge + 'd old');
            freshnessLine = ' · ' + parts.join(' · ');
        }
        return '<div class="text-xs text-slate-500 mt-4 text-center">' +
            'Data refreshed ' + (ts ? CommonRenderer.formatDate(ts) : '—') +
            (ageTxt ? ' (' + ageTxt + ')' : '') +
            ' · source <span class="font-mono">bmnr_backing.json</span>' +
            freshnessLine +
            ' · <a href="https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=BMNR&type=8-K&dateb=&owner=include&count=40" target="_blank" rel="noopener noreferrer" class="hover:underline">SEC EDGAR filings ↗</a>' +
        '</div>';
    },

    // ============================================================
    // Chart paint
    // ============================================================
    _paintCompositionChart: function (data) {
        var ctx = document.getElementById('bmnr-composition-chart');
        if (!ctx) return;
        var treasury = data.treasury || {};

        var slices = [
            { label: 'ETH',               value: treasury.eth_value_usd        || 0, color: '#627eea' },
            { label: 'Cash',              value: treasury.cash_usd             || 0, color: '#22c55e' },
            { label: 'Strategic stakes',  value: treasury.strategic_stakes_usd || 0, color: '#a855f7' },
            { label: 'BTC',               value: treasury.btc_value_usd        || 0, color: '#f7931a' }
        ].filter(function (s) { return s.value > 0; });

        if (window._bmnrCompositionChart) window._bmnrCompositionChart.destroy();
        window._bmnrCompositionChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: slices.map(function (s) { return s.label; }),
                datasets: [{
                    data: slices.map(function (s) { return s.value; }),
                    backgroundColor: slices.map(function (s) { return s.color; }),
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: true, position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } },
                    tooltip: {
                        callbacks: {
                            label: function (c) {
                                var total = c.dataset.data.reduce(function (a, b) { return a + b; }, 0);
                                var pct = total ? (c.raw / total * 100).toFixed(1) : '—';
                                return c.label + ': ' + BMNRRenderer._fmtMoneyShort(c.raw) + ' (' + pct + '%)';
                            }
                        }
                    }
                }
            }
        });
    },

    _seriesXY: function (series, field) {
        return series.filter(function (p) { return p && p[field] != null && p.ts; }).map(function (p) {
            var ts = p.ts.endsWith('Z') ? p.ts : p.ts + 'Z';
            return { x: new Date(ts), y: p[field] };
        });
    },

    _loadHistoryAndPaintMnavChart: function () {
        var nocache = Math.floor(Date.now() / 60000);
        fetch('data/bmnr_backing_history.json?nocache=' + nocache)
            .then(function (r) { return r.ok ? r.json() : null; })
            .catch(function () { return null; })
            .then(function (hist) {
                var series = (hist && Array.isArray(hist.series)) ? hist.series : [];
                BMNRRenderer._paintMnavChart(series);
            });
    },

    _paintMnavChart: function (series) {
        var ctx = document.getElementById('bmnr-mnav-chart');
        if (!ctx) return;

        var ethOnly = BMNRRenderer._seriesXY(series, 'mnav_eth_only');
        var fullTreas = BMNRRenderer._seriesXY(series, 'mnav_full_treasury');

        var ann = {
            parity: { type: 'line', yMin: 1.00, yMax: 1.00, borderColor: '#22c55e', borderWidth: 1, borderDash: [4, 4],
                      label: { content: 'parity 1.00', display: true, position: 'end', font: { size: 9 }, color: '#16a34a' } },
            discount: { type: 'line', yMin: 0.95, yMax: 0.95, borderColor: '#f59e0b', borderWidth: 1, borderDash: [4, 4],
                        label: { content: 'discount 0.95', display: true, position: 'end', font: { size: 9 }, color: '#d97706' } },
            distress: { type: 'line', yMin: 0.85, yMax: 0.85, borderColor: '#ef4444', borderWidth: 1, borderDash: [4, 4],
                        label: { content: 'distress 0.85', display: true, position: 'end', font: { size: 9 }, color: '#dc2626' } }
        };

        if (window._bmnrMnavChart) window._bmnrMnavChart.destroy();
        window._bmnrMnavChart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [
                    {
                        label: 'mNAV (ETH-only)',
                        data: ethOnly,
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59,130,246,0.1)',
                        fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2
                    },
                    {
                        label: 'mNAV (full treasury)',
                        data: fullTreas,
                        borderColor: '#a855f7',
                        backgroundColor: 'transparent',
                        borderDash: [5, 3], tension: 0.3, pointRadius: 0, borderWidth: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                scales: {
                    x: {
                        type: 'time',
                        time: { unit: 'day', displayFormats: { day: 'MMM d' } },
                        grid: { display: false },
                        ticks: { maxTicksLimit: 8, font: { size: 10 } }
                    },
                    y: {
                        grid: { color: '#f1f5f9' },
                        suggestedMin: 0.5,
                        suggestedMax: 1.5,
                        ticks: { font: { size: 10 } }
                    }
                },
                plugins: {
                    legend: { display: true, position: 'top', labels: { boxWidth: 10, font: { size: 10 } } },
                    annotation: { annotations: ann },
                    tooltip: {
                        intersect: false, mode: 'index',
                        callbacks: {
                            label: function (c) { return c.dataset.label + ': ' + c.raw.y.toFixed(4); }
                        }
                    }
                },
                interaction: { intersect: false, mode: 'index' }
            }
        });
    }
};
