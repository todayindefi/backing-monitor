/**
 * USG (Tangent Finance) renderer.
 *
 * USG is a crvUSD-architecture CDP stablecoin (LLAMMA-style markets +
 * PegKeepers). Supply has three sources:
 *   - CDP debt    : user-minted against stablecoin-LP collateral in 12 markets
 *   - POL deployed: protocol-owned USG minted into its PegKeeper pools (circular)
 *   - sUSG        : staked USG (a derivative holding of already-minted supply)
 *
 * Three backing ratios, all surfaced — none hidden, but the sub-100 one is
 * never shown as a headline CR:
 *   - CDP-book CR (mint_cr, ~119%): CDP collateral / CDP debt — lending-book health.
 *   - Inclusive CR (~135%): (CDP collateral + POL pool stables) / real supply.
 *   - Collateral-backed share of supply (~55%): external collateral / supply.
 *     This is the analyzer's `collateral_ratio`. For a POL-heavy design ~50% is
 *     by design, NOT undercollateralization, so preRender re-points the summary
 *     cards + history chart at the two real CRs and labels the conservative
 *     number "collateral-backed share of supply" only inside the panel below.
 *
 * Data: data/usg_backing.json (+ data/usg_backing_history.json).
 * Modeled on crvusd.js (shared CDP + PegKeeper structure).
 */

var USGRenderer = {

    _crClass: function(cr) {
        if (cr == null) return '';
        return cr < 110 ? 'text-red-600' : cr < 120 ? 'text-amber-600' : 'text-green-600';
    },

    // Low headroom_to_liq is AMBER, not red: it is baseline-normal for
    // max-leveraged borrowing on low-vol stable LPs (badDebt 0, peg fine) and
    // becomes a liquidation risk only if that market's collateral leg depegs.
    // Semibold amber on the lowest still draws the eye to the cascade-sensitive legs.
    _headroomClass: function(h) {
        if (h == null) return '';
        return h < 2.5 ? 'text-amber-600 font-semibold' : 'text-slate-600';
    },

    // NAV divergence vs the optimistic oracle read; threshold (typically 1.0%)
    // is the analyzer's flag line — only a real breach goes red.
    _divClass: function(pct, threshold) {
        if (pct == null) return 'text-slate-400';
        var a = Math.abs(pct), t = threshold || 1.0;
        return a >= t ? 'text-red-600 font-semibold' : a >= t * 0.5 ? 'text-amber-600' : 'text-green-600';
    },

    _shortMarketType: function(t) {
        var map = { curveGauge: 'Curve Gauge', stakeDaoVault: 'StakeDAO', convexFxn: 'Convex FXN' };
        return map[t] || t || '-';
    },

    // ============================================================
    // pre-render — runs before the common renderer paints.
    // ============================================================
    preRender: function(data, history) {
        var specific = data.asset_specific || {};
        if (specific.type !== 'usg') return;
        var s = data.summary || {};

        // Common "Total Supply" card + index-grid card read summary.total_supply,
        // which the USG analyzer doesn't emit. real_supply (= CDP debt + POL
        // deployed) is the meaningful circulating figure; totalSupply() is inflated
        // by pre-minted PegKeeper ceiling buffer (the crvUSD trap).
        if (s.total_supply == null && s.real_supply != null) s.total_supply = s.real_supply;

        // Re-point the two headline CR cards. By default the common cards would show
        // "Collateral Ratio" = collateral_ratio (~55%, the conservative share) and an
        // alt card = POL Pool Stables ($). Replace with the two real CRs.
        var ov = specific.card_overrides = specific.card_overrides || {};
        if (s.mint_cr != null) {
            ov['Collateral Ratio'] = {
                label: 'CDP-book CR',
                value: CommonRenderer.formatPercent(s.mint_cr, 1),
                cls: s.mint_cr >= 100 ? 'positive' : 'negative',
                subtext: 'CDP collateral ÷ CDP debt'
            };
        }
        if (s.collateral_ratio_inclusive != null && s.collateral_ratio_alt && s.collateral_ratio_alt.label) {
            ov[s.collateral_ratio_alt.label] = {
                label: 'Inclusive CR',
                value: CommonRenderer.formatPercent(s.collateral_ratio_inclusive, 1),
                cls: s.collateral_ratio_inclusive >= 100 ? 'positive' : 'negative',
                subtext: 'incl. POL pool stables'
            };
        }
        if (!ov['Total Backing']) ov['Total Backing'] = { subtext: 'CDP-market collateral (external)' };
        if (!ov['Surplus / Deficit']) ov['Surplus / Deficit'] = { subtext: 'inclusive backing − supply' };

        // CR-history chart: common.js plots entry.collateral_ratio (the ~55%
        // conservative share) and suppresses the alt (it is a $ value). Re-point the
        // primary series at the inclusive CR so the chart never headlines the sub-100
        // number. (Only matters once >=2 history samples exist.)
        if (history && Array.isArray(history.entries)) {
            history.entries.forEach(function(e) {
                if (e.collateral_ratio_inclusive != null) {
                    e.collateral_ratio_conservative = e.collateral_ratio;
                    e.collateral_ratio = e.collateral_ratio_inclusive;
                }
            });
        }
        specific.chart_title = 'Inclusive Collateral Ratio — history';
        specific.chart_dataset_label = 'Inclusive CR';
        if (specific.chart_y_min === undefined) specific.chart_y_min = 100;
        if (specific.chart_y_max === undefined) specific.chart_y_max = 170;
    },

    // ============================================================
    // render — asset-specific panels
    // ============================================================
    render: function(data) {
        var container = document.getElementById('asset-specific-panels');
        var specific = data.asset_specific;
        if (!specific || specific.type !== 'usg') return;
        var s = data.summary;
        var html = '';

        // ====== 1. Supply Composition ======
        var sc = specific.supply_composition;
        if (sc) {
            var rows = [
                { label: 'CDP debt', sub: 'user-minted against collateral', value: sc.cdp, pct: sc.cdp_pct, color: '#3b82f6' },
                { label: 'POL deployed', sub: 'protocol-owned USG minted into PegKeeper pools (circular)', value: sc.pol, pct: sc.pol_pct, color: '#f97316' },
                { label: 'sUSG', sub: 'staked USG (derivative of minted supply)', value: sc.susg, pct: sc.susg_pct, color: '#94a3b8' }
            ];
            html += '<div class="panel"><div class="panel-title">Supply Composition</div>' +
                '<p class="text-sm text-slate-500 mb-3">Real supply ' + CommonRenderer.formatCurrency(s.real_supply) +
                ' = CDP debt + POL deployed. totalSupply() reads ' + CommonRenderer.formatCurrency(s.total_supply_raw) +
                ' — inflated by pre-minted PegKeeper ceiling buffer (the crvUSD artifact), not circulating. POL is the largest source: protocol-owned USG minted into its own PegKeeper pools.</p>' +
                '<table class="data-table"><thead><tr><th>Source</th><th class="text-right">Amount</th><th class="text-right">%</th><th></th></tr></thead><tbody>';
            rows.forEach(function(r) {
                html += '<tr><td class="font-medium">' + r.label +
                        '<div class="text-xs text-slate-400 font-normal">' + r.sub + '</div></td>' +
                    '<td class="text-right font-mono">' + CommonRenderer.formatCurrencyExact(r.value) + '</td>' +
                    '<td class="text-right font-mono">' + CommonRenderer.formatPercent(r.pct, 1) + '</td>' +
                    '<td><div class="pct-bar-container"><div class="pct-bar" style="width:' + r.pct + '%;background:' + r.color + '"></div></div></td></tr>';
            });
            html += '</tbody></table>' +
                '<p class="text-xs text-slate-400 mt-2">sUSG is staked USG (a destination of already-minted supply), shown alongside the two minting sources per the analyzer’s breakdown.</p></div>';
        }

        // ====== 2. Backing Ratios ======
        var cb = specific.collateral_breakdown;
        html += '<div class="panel"><div class="panel-title">Backing Ratios</div>' +
            '<p class="text-sm text-slate-500 mb-3">USG collateral sits in two buckets: external CDP-market collateral, and the stablecoin counter-side of its protocol-owned PegKeeper pools. Three lenses on the same backing:</p>' +
            '<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">' +
                '<div class="summary-card"><div class="card-label">CDP-book CR</div><div class="card-value ' + (s.mint_cr >= 100 ? 'positive' : 'negative') + '">' + CommonRenderer.formatPercent(s.mint_cr, 1) + '</div><div class="text-xs text-slate-400 mt-1">CDP collateral ÷ CDP debt</div></div>' +
                '<div class="summary-card"><div class="card-label">Inclusive CR</div><div class="card-value ' + (s.collateral_ratio_inclusive >= 100 ? 'positive' : 'negative') + '">' + CommonRenderer.formatPercent(s.collateral_ratio_inclusive, 1) + '</div><div class="text-xs text-slate-400 mt-1">(CDP collateral + POL pool stables) ÷ real supply</div></div>' +
                '<div class="summary-card"><div class="card-label">Collateral-backed share of supply</div><div class="card-value">' + CommonRenderer.formatPercent(s.collateral_backed_share_pct != null ? s.collateral_backed_share_pct : s.collateral_ratio, 1) + '</div><div class="text-xs text-slate-400 mt-1">external collateral ÷ supply — ~half is by design for a POL-heavy model, not undercollateralization</div></div>' +
            '</div>';
        if (cb) {
            html += '<table class="data-table"><thead><tr><th>Collateral component</th><th class="text-right">Value</th></tr></thead><tbody>' +
                '<tr><td>CDP-market collateral (external)</td><td class="text-right font-mono">' + CommonRenderer.formatCurrencyExact(cb.cdp_collateral) + '</td></tr>' +
                '<tr><td>POL pool stables (PegKeeper counter-side)</td><td class="text-right font-mono">' + CommonRenderer.formatCurrencyExact(cb.pol_pool_stables) + '</td></tr>' +
                '<tr class="font-bold border-t-2 border-slate-200"><td>Total backing (inclusive)</td><td class="text-right font-mono">' + CommonRenderer.formatCurrencyExact(cb.total) + '</td></tr>' +
                '</tbody></table>' +
                '<p class="text-xs text-slate-400 mt-2">POL pool stables are user-supplied USDC/frxUSD paired against protocol-minted USG — they back the POL leg but carry no redemption right; peg rests on keepers, dynamic rates and arbitrage.</p>';
        }
        html += '</div>';

        // ====== 3. CDP Markets ======
        var markets = specific.markets;
        if (markets && markets.length) {
            var active = markets.filter(function(m) { return m.debt >= 1; })
                                .sort(function(a, b) { return b.debt - a.debt; });
            html += '<div class="panel"><div class="panel-title">CDP Markets (' + active.length + ' active, book CR ' + CommonRenderer.formatPercent(s.mint_cr, 1) + ')</div>' +
                '<p class="text-sm text-slate-500 mb-3">Per-market lending health. Headroom to liquidation = how far the collateral oracle price can fall before positions cross their liquidation threshold. Low headroom (amber) is baseline-normal for max-leveraged borrowing on low-vol stable LPs — it becomes a liquidation risk only if that market’s collateral leg depegs; badDebt is currently $0 everywhere.</p>' +
                '<div class="overflow-x-auto"><table class="data-table"><thead><tr>' +
                '<th>Market</th><th class="text-right">Debt</th><th class="text-right">maxLTV</th><th class="text-right">Liq Thr</th><th class="text-right">CR</th><th class="text-right">Headroom</th><th class="text-right">Bad Debt</th>' +
                '</tr></thead><tbody>';
            active.forEach(function(m) {
                html += '<tr><td class="font-medium">' + m.name + ' <span class="text-xs text-slate-400">' + USGRenderer._shortMarketType(m.market_type) + '</span></td>' +
                    '<td class="text-right font-mono">' + CommonRenderer.formatCurrency(m.debt) + '</td>' +
                    '<td class="text-right font-mono">' + CommonRenderer.formatPercent(m.maxLTV, 1) + '</td>' +
                    '<td class="text-right font-mono">' + CommonRenderer.formatPercent(m.liqThreshold, 2) + '</td>' +
                    '<td class="text-right font-mono ' + USGRenderer._crClass(m.cr) + '">' + CommonRenderer.formatPercent(m.cr, 1) + '</td>' +
                    '<td class="text-right font-mono ' + USGRenderer._headroomClass(m.headroom_to_liq) + '" title="max-leveraged — becomes a liquidation risk only if this market’s collateral leg depegs">' + CommonRenderer.formatPercent(m.headroom_to_liq, 2) + '</td>' +
                    '<td class="text-right font-mono ' + (m.badDebt > 0 ? 'text-red-600 font-semibold' : 'text-slate-400') + '">' + CommonRenderer.formatCurrencyExact(m.badDebt) + '</td></tr>';
            });
            html += '</tbody></table></div>' +
                '<p class="text-xs text-slate-400 mt-2">Total bad debt across markets: <span class="font-mono">' + CommonRenderer.formatCurrencyExact(s.total_bad_debt) + '</span>. maxLTV 84–90% with liquidation thresholds ~1–1.5% above and a 20% liquidation fee.</p></div>';
        }

        // ====== 4. Oracle Integrity (independent NAV vs oracle read) ======
        var on = specific.oracle_nav;
        var oracleMarkets = (markets || []).filter(function(m) { return m.debt >= 1 && m.independent_nav != null; });
        if (on && oracleMarkets.length) {
            var thr = on.threshold_pct || 1.0;
            html += '<div class="panel"><div class="panel-title">Oracle Integrity</div>' +
                '<p class="text-sm text-slate-500 mb-3">Each market prices its Curve-LP collateral via an on-chain oracle. We cross-check that read against an independent NAV computed bottom-up, and flag any market whose oracle diverges past ' + CommonRenderer.formatPercent(thr, 1) + '. Divergence is measured against the <em>optimistic</em> oracle read (the pessimistic read would structurally false-flag).</p>' +
                '<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">' +
                    '<div class="summary-card"><div class="card-label">Max NAV divergence</div><div class="card-value ' + USGRenderer._divClass(on.max_divergence_pct, thr) + '">' + CommonRenderer.formatPercent(on.max_divergence_pct, 2) + '</div><div class="text-xs text-slate-400 mt-1">flag threshold ' + CommonRenderer.formatPercent(thr, 1) + '</div></div>' +
                    '<div class="summary-card"><div class="card-label">Divergent markets</div><div class="card-value ' + (on.n_divergent > 0 ? 'negative' : 'positive') + '">' + on.n_divergent + ' / ' + oracleMarkets.length + '</div><div class="text-xs text-slate-400 mt-1">beyond threshold</div></div>' +
                '</div>';
            if (on.method) {
                html += '<p class="text-xs text-slate-400 mb-3"><span class="font-semibold">Method:</span> ' + on.method + '</p>';
            }
            var oSorted = oracleMarkets.slice().sort(function(a, b) { return Math.abs(b.nav_divergence_pct || 0) - Math.abs(a.nav_divergence_pct || 0); });
            html += '<div class="overflow-x-auto"><table class="data-table"><thead><tr>' +
                '<th>Market</th><th>Oracle</th><th class="text-right">Oracle px</th><th class="text-right">Virtual px</th><th class="text-right">Indep. NAV</th><th class="text-right">Divergence</th><th class="text-right">Min coin</th>' +
                '</tr></thead><tbody>';
            oSorted.forEach(function(m) {
                html += '<tr><td class="font-medium">' + m.name + '</td>' +
                    '<td class="font-mono text-xs text-slate-500" title="' + (m.oracle || '') + '">' + (m.oracle_name || '-') + '</td>' +
                    '<td class="text-right font-mono">' + (m.oracle_price_optimistic != null ? m.oracle_price_optimistic.toFixed(4) : '-') + '</td>' +
                    '<td class="text-right font-mono text-slate-400">' + (m.virtual_price != null ? m.virtual_price.toFixed(4) : '-') + '</td>' +
                    '<td class="text-right font-mono">' + (m.independent_nav != null ? m.independent_nav.toFixed(4) : '-') + '</td>' +
                    '<td class="text-right font-mono ' + USGRenderer._divClass(m.nav_divergence_pct, thr) + '">' + (m.nav_divergence_pct != null ? CommonRenderer.formatPercent(m.nav_divergence_pct, 3) : '-') + '</td>' +
                    '<td class="text-right font-mono text-xs text-slate-500">' + (m.min_coin_symbol || '-') + (m.min_coin_price != null ? ' @ $' + m.min_coin_price.toFixed(4) : '') + '</td></tr>';
            });
            html += '</tbody></table></div></div>';
        }

        // ====== 5. Collateral Cascade Risk (exotic peg legs) ======
        var exotic = specific.exotic_pegs;
        if (exotic && exotic.length) {
            var pegged = exotic.filter(function(e) { return e.par_target; })
                               .sort(function(a, b) { return Math.abs(b.deviation_pct || 0) - Math.abs(a.deviation_pct || 0); });
            var wrappers = exotic.filter(function(e) { return !e.par_target; });
            var worst = s.worst_exotic_deviation_pct;
            html += '<div class="panel"><div class="panel-title">Collateral Cascade Risk</div>' +
                '<p class="text-sm text-slate-500 mb-3">USG is a CDP stablecoin collateralized by Curve LPs that themselves contain <em>other</em> CDP / exotic stables — a productive-LP cascade. These are the non-USDC/frxUSD stable legs reached through that collateral; a depeg here feeds into the LP NAV before USG’s own oracle reacts.</p>' +
                '<div class="summary-card mb-4" style="display:inline-block"><div class="card-label">Worst $1-peg deviation</div><div class="card-value ' + CommonRenderer.pegPctClass(CommonRenderer.pegStatusClass(worst)) + '">' + CommonRenderer.pegPctText(worst, 2) + '</div><div class="text-xs text-slate-400 mt-1">across par-target legs</div></div>' +
                '<table class="data-table"><thead><tr><th>Token</th><th class="text-right">Price</th><th class="text-right">Deviation</th><th>Used in markets</th></tr></thead><tbody>';
            pegged.forEach(function(e) {
                var st = CommonRenderer.pegStatusClass(e.deviation_pct);
                var emphasis = e.symbol === 'reUSD' ? ' <span class="tag" style="background:#fef2f2;color:#dc2626">cascade-sensitive</span>' : '';
                html += '<tr><td class="font-medium">' + e.symbol + emphasis + '</td>' +
                    '<td class="text-right font-mono">$' + e.price.toFixed(4) + '</td>' +
                    '<td class="text-right font-mono ' + CommonRenderer.pegPctClass(st) + '">' + CommonRenderer.pegPctText(e.deviation_pct, 2) + '</td>' +
                    '<td class="text-xs text-slate-500">' + (e.in_markets || []).join(', ') + '</td></tr>';
            });
            wrappers.forEach(function(e) {
                html += '<tr><td class="font-medium">' + e.symbol + ' <span class="tag" style="background:#f1f5f9;color:#475569">wrapper</span></td>' +
                    '<td class="text-right font-mono">$' + e.price.toFixed(4) + '</td>' +
                    '<td class="text-right font-mono text-slate-400" title="yield-bearing wrapper, not a $1 peg — price drifts up with accrued yield">n/a</td>' +
                    '<td class="text-xs text-slate-500">' + (e.in_markets || []).join(', ') + '</td></tr>';
            });
            html += '</tbody></table>' +
                '<p class="text-xs text-slate-400 mt-2">sDOLA and scrvUSD are yield-bearing wrappers — their price sits above $1 by accrued yield, which is not a depeg. reUSD (Resupply) is the most cascade-sensitive leg: a recursive-CDP stablecoin reached via two markets.</p></div>';
        }

        // ====== 6. PegKeeper Pools (POL peg defense) ======
        var pks = specific.pegkeepers;
        if (pks && pks.length) {
            html += '<div class="panel"><div class="panel-title">PegKeeper Pools (POL peg defense, ' + pks.length + ')</div>' +
                '<p class="text-sm text-slate-500 mb-3">Protocol-owned liquidity. The stablecoin side (' + CommonRenderer.formatCurrency(s.pol_pool_stables) + ') is the counter-side backing POL-minted USG and the first line of peg defense; a high USG % signals selling pressure (balanced = 50%).</p>' +
                '<table class="data-table"><thead><tr><th>Pool</th><th class="text-right">PK debt</th><th class="text-right">Stables</th><th class="text-right">USG</th><th class="text-right">USG %</th><th class="text-right">USG price</th></tr></thead><tbody>';
            var tStable = 0, tUsg = 0, tDebt = 0;
            pks.forEach(function(pk) {
                var poolTotal = pk.stable_in_pool + pk.usg_in_pool;
                var usgPct = poolTotal > 0 ? pk.usg_in_pool / poolTotal * 100 : 0;
                var pctCls = usgPct > 70 ? 'text-red-600 font-bold' : usgPct > 60 ? 'text-amber-600' : 'text-green-600';
                tStable += pk.stable_in_pool; tUsg += pk.usg_in_pool; tDebt += pk.debt;
                html += '<tr><td class="font-mono text-xs">' + pk.stable_symbol + '/USG</td>' +
                    '<td class="text-right font-mono">' + CommonRenderer.formatCurrency(pk.debt) + '</td>' +
                    '<td class="text-right font-mono">' + CommonRenderer.formatCurrency(pk.stable_in_pool) + ' <span class="text-xs text-slate-400">' + pk.stable_symbol + '</span></td>' +
                    '<td class="text-right font-mono text-slate-400">' + CommonRenderer.formatCurrency(pk.usg_in_pool) + '</td>' +
                    '<td class="text-right font-mono ' + pctCls + '">' + usgPct.toFixed(0) + '%</td>' +
                    '<td class="text-right font-mono">$' + pk.usg_price.toFixed(4) + '</td></tr>';
            });
            var totPct = (tStable + tUsg) > 0 ? tUsg / (tStable + tUsg) * 100 : 0;
            html += '<tr class="font-bold border-t-2 border-slate-200"><td>Total</td>' +
                '<td class="text-right font-mono">' + CommonRenderer.formatCurrency(tDebt) + '</td>' +
                '<td class="text-right font-mono">' + CommonRenderer.formatCurrency(tStable) + '</td>' +
                '<td class="text-right font-mono text-slate-400">' + CommonRenderer.formatCurrency(tUsg) + '</td>' +
                '<td class="text-right font-mono">' + totPct.toFixed(0) + '%</td><td></td></tr>' +
                '</tbody></table></div>';
        }

        container.innerHTML = html;
    }
};
