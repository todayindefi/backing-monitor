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

    // Liquidation thresholds sit only ~1-5% above price; <2% headroom is the
    // analyzer's low-headroom warning line, so colour accordingly.
    _headroomClass: function(h) {
        if (h == null) return '';
        return h < 2 ? 'text-red-600 font-semibold' : h < 3 ? 'text-amber-600' : 'text-green-600';
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
                '<div class="summary-card"><div class="card-label">Collateral-backed share of supply</div><div class="card-value">' + CommonRenderer.formatPercent(s.collateral_ratio, 1) + '</div><div class="text-xs text-slate-400 mt-1">external collateral ÷ supply — ~half is by design for a POL-heavy model, not undercollateralization</div></div>' +
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
                '<p class="text-sm text-slate-500 mb-3">Per-market lending health. Headroom to liquidation = how far the collateral oracle price can fall before positions cross their liquidation threshold; markets tagged low-headroom (&lt;2.5%) sit in amber/red.</p>' +
                '<div class="overflow-x-auto"><table class="data-table"><thead><tr>' +
                '<th>Market</th><th class="text-right">Debt</th><th class="text-right">maxLTV</th><th class="text-right">Liq Thr</th><th class="text-right">CR</th><th class="text-right">Headroom</th><th class="text-right">Bad Debt</th>' +
                '</tr></thead><tbody>';
            active.forEach(function(m) {
                html += '<tr><td class="font-medium">' + m.name + ' <span class="text-xs text-slate-400">' + USGRenderer._shortMarketType(m.market_type) + '</span></td>' +
                    '<td class="text-right font-mono">' + CommonRenderer.formatCurrency(m.debt) + '</td>' +
                    '<td class="text-right font-mono">' + CommonRenderer.formatPercent(m.maxLTV, 1) + '</td>' +
                    '<td class="text-right font-mono">' + CommonRenderer.formatPercent(m.liqThreshold, 2) + '</td>' +
                    '<td class="text-right font-mono ' + USGRenderer._crClass(m.cr) + '">' + CommonRenderer.formatPercent(m.cr, 1) + '</td>' +
                    '<td class="text-right font-mono ' + USGRenderer._headroomClass(m.headroom_to_liq) + '">' + CommonRenderer.formatPercent(m.headroom_to_liq, 2) + '</td>' +
                    '<td class="text-right font-mono ' + (m.badDebt > 0 ? 'text-red-600 font-semibold' : 'text-slate-400') + '">' + CommonRenderer.formatCurrencyExact(m.badDebt) + '</td></tr>';
            });
            html += '</tbody></table></div>' +
                '<p class="text-xs text-slate-400 mt-2">Total bad debt across markets: <span class="font-mono">' + CommonRenderer.formatCurrencyExact(s.total_bad_debt) + '</span>. maxLTV 84–90% with liquidation thresholds ~1–1.5% above and a 20% liquidation fee.</p></div>';
        }

        // ====== 4. PegKeeper Pools (POL peg defense) ======
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
