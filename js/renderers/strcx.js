// ============================================================================
// STRCx — Backed's on-chain wrapper over Strategy's STRC preferred.
//
// ⚠️ THIS PAGE EXISTS BECAUSE ONE PAGE COULD NOT CARRY TWO ASSETS' SCORES.
// STRC and STRCx were a single combined dashboard ("STRC + STRCx") for as long
// as either existed, and the axis pipeline cannot express that: axis-basis/1 is
// ONE envelope with ONE `asset` identity and ONE `peg.volatility_score` /
// `liquidity.liquidity_score`. STRC's 5.0/7.0 and STRCx's 4.5/2.5 are the SAME
// FIELD NAMES, so a combined file had to delete one asset's number per axis —
// and the number it would have deleted is the most decision-relevant one here:
// liquidity 7.0 on a Nasdaq listing versus 2.5 on a ~$400k Jupiter pool, 4.5
// points apart, for the wrapper layer that is this asset's entire subject.
//
// ⚠️ THE WRAPPER PANELS MOVED HERE RATHER THAN BEING SHARED. Rendering STRCx on
// both pages would mean maintaining it twice, and a panel maintained twice
// diverges — the STRC page keeps a summary card that links here instead.
//
// ⚠️ THE BASE FEED IS SHARED AND THE AXES ARE NOT. assets.json gives this slug
// `data_source: "strc"`, so the page reads strc_backing.json (one analyzer
// covers the whole Strategy structure) while axis overlays resolve from the
// VIEW slug — strcx_axis_basis.json, strcx_issuer.json. That split is exactly
// what app.js's axisSlug change made possible; before it, this page would have
// rendered STRC's liquidity 7.0 under the STRCx label.
//
// Shared formatters (_fmtNum, _fmtMoneyShort, _truncAddr, _etherscanLink) are
// still STRCRenderer's — they are generic and used by both pages. index.html
// loads strc.js before this file; that order is load-bearing.
// ============================================================================

var STRCxRenderer = {

    // Shapes the shared STRC feed for the common frame. The STRCx view needs the
    // same NPE guards the STRC view needs — neither feed carries `summary`.
    preRender: function (data) {
        if (!data.timestamp && data.timestamp_utc) data.timestamp = data.timestamp_utc;
        var wrapper = data.wrapper_strcx || {};
        if (!data.summary) {
            data.summary = {
                total_supply: wrapper.total_supply_usd,
                total_backing: wrapper.total_supply_usd,
                // ⚠️ NOT 100. A placeholder CR here is not inert: the common frame RATES
                // axis 2 off it, and 100 lands in the [130,110,100,90] band at 3/5, so
                // the Backing head printed "Watch · 6/10" — a score computed from a
                // number this renderer invented, sitting above riskAnalyst's authored
                // backing 4.0. null rates as "Not rated", which is what an asset with no
                // published collateral ratio actually is.
                collateral_ratio: null,
                collateral_ratio_alt: { label: 'Multiplier', value: wrapper.multiplier || 0, is_currency: false },
                surplus_deficit: 0
            };
        }
        if (!Array.isArray(data.backing_breakdown)) data.backing_breakdown = [];
        if (!data.asset_specific) data.asset_specific = { type: 'strcx' };
        // The combined title belongs to the combined page that no longer exists.
        data.asset = 'STRCx';
        // ⚠️ app.js:439 renders `data.asset + ' (' + data.chain + ')'` and the shared
        // STRC feed carries no `chain`, so this page's header read "STRCx (undefined)"
        // — on the asset whose whole point is that it is multi-chain. STRCRenderer
        // sets its own; the copy that became this file did not bring that line.
        if (!data.chain) data.chain = 'Ethereum · Solana · BNB · Arbitrum · Mantle';
    },

    render: function (data) {
        var container = document.getElementById('asset-specific-panels');
        if (!container) return;

        STRCxRenderer._suppressCommonPanels(data);

        var wrapper = data.wrapper_strcx || {};
        var riskFlags = data.risk_flags || [];

        var html = '';
        html += STRCxRenderer._renderUnderlyingLink(data);
        html += STRCxRenderer._renderStrcxWrapper(wrapper, riskFlags);
        if (typeof STRCRenderer !== 'undefined' && STRCRenderer._renderFreshness) {
            html += STRCRenderer._renderFreshness(data);
        }
        container.innerHTML = html;

        // ⚠️ THE PANEL MOVED AND ITS PAINTER DID NOT. The wrapper panel carries a
        // <canvas id="strc-multiplier-chart">, and the only thing that draws into it
        // is STRCRenderer's history loader — which this page never called, so
        // "Multiplier over time" rendered as a heading above blank space. Every
        // painter in that loader guards on node existence, so calling it here paints
        // the one canvas this page has and no-ops on the four it does not.
        if (typeof STRCRenderer !== 'undefined' && STRCRenderer._loadHistoryAndPaintCharts) {
            STRCRenderer._loadHistoryAndPaintCharts(data.tradfi || {});
        }

        // \u26a0\ufe0f REPLACES the common Peg Performance card, which rendered four dashes
        // on an asset whose peg IS measured. app.js runs renderAxisSections() before
        // this, so overwriting axis-peg-body here is the last write and wins.
        STRCxRenderer._renderPegVsNav(wrapper);

        var link = document.getElementById('header-companion-link');
        if (link) {
            link.setAttribute('href', '?asset=strc');
            link.textContent = 'The underlying preferred \u2192 STRC dashboard \u2197';
            link.classList.remove('hidden');
        }
    },

    // ============================================================
    // Axis 1 · Peg vs NAV — a RANGE, not a chip.
    //
    // ⚠️ THIS ASSET'S PEG IS MEASURED AND THE FRAME SHOWED FOUR DASHES. The
    // analyzer emits no `peg` block, so data.peg.premium_discount_pct does not exist
    // and the common card had nothing to print — while the mark and its reference
    // sat one panel below, in wrapper_strcx, under different names.
    //
    // ⚠️ WHY A PANEL AND NOT A RATED CHIP. Populating data.peg would make
    // pegRating() compute a band, and this frame's owner decision is that an authored
    // score is NEVER shown beside a live one — so the report's 4.5 would vanish and be
    // replaced by a green band, turning "report 4.5 / panel Not rated" into "report
    // 4.5 / panel 8-10 of 10". Two numbers pointing opposite ways is worse than one
    // absence. A chip is a single number; this quantity is a range with three
    // dispersions around it, so it gets a panel and axis 1 keeps its stated refusal.
    //
    // ⚠️ EVERY FIGURE IS FIRST-PARTY — computed from wrapper_strcx and the history
    // series in this repo. The report's pool-level depth measurements are deliberately
    // NOT copied in: they are riskAnalyst's, they live on axis 3 with their basis, and
    // a number retyped here is one that nothing refreshes.
    _renderPegVsNav: function (wrapper) {
        var body = document.getElementById('axis-peg-body');
        if (!body || !wrapper) return;
        var mk = wrapper.market_price_usd, nav = wrapper.underlying_strc_price_usd;
        if (mk == null || nav == null) return;

        var bps = (mk / nav - 1) * 10000;
        var cross = wrapper.price_crosscheck_bps;
        var fmtBps = function (v) { return (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(1) + ' bps'; };
        var money = function (v) { return (typeof STRCRenderer !== 'undefined')
            ? STRCRenderer._fmtMoneyShort(v) : ('$' + v); };

        var pc = wrapper.per_chain || {};
        var eth = (pc.ethereum || {}).total_supply, sol = (pc.solana || {}).total_supply;
        var tot = wrapper.total_supply_all_chains;
        var held = (wrapper.top_holders_ethereum || []).reduce(function (a, h) {
            return a + (h && h.balance ? h.balance : 0); }, 0);
        var ethFloat = (eth != null) ? eth - held : null;
        var num = function (v) { return v == null ? '—'
            : v.toLocaleString('en-US', { maximumFractionDigits: 0 }); };
        var pct = function (v) { return (v == null || !tot) ? '—' : (v / tot * 100).toFixed(1) + '%'; };

        var tile = function (label, value, sub) {
            return '<div class="summary-card">' +
                '<div class="card-label">' + label + '</div>' +
                '<div class="card-value">' + value + '</div>' +
                '<div class="text-xs text-slate-400 mt-1">' + sub + '</div>' +
            '</div>';
        };

        body.innerHTML =
            '<div class="panel">' +
                '<div class="panel-title">Peg vs NAV ' +
                    '<span class="text-xs font-normal text-slate-500">— wrapper against the share it holds</span></div>' +
                '<div class="grid grid-cols-1 md:grid-cols-4 gap-3">' +
                    tile('Market price', '$' + mk.toFixed(2),
                         CommonRenderer._escapeAttr(wrapper.market_price_source || 'DEX') +
                         ' · multiplier-adjusted') +
                    tile('NAV per token', '$' + nav.toFixed(2),
                         'the underlying STRC share — exact, 1:1') +
                    tile('Premium to NAV', '<span id="strcx-peg-now">…</span>',
                         '<span id="strcx-peg-7d">loading published series…</span>') +
                    tile('Cross-source check', (cross != null ? fmtBps(cross) : '—'),
                         'CoinGecko aggregate vs this mark') +
                '</div>' +
                '<div class="text-xs text-slate-500 leading-relaxed mt-4">' +
                    '<strong>NAV is exact here, which is unusual.</strong> STRCx is 1:1 against real ' +
                    'STRC shares and the rebasing multiplier does the scaling, so the reference is a ' +
                    'listed share price rather than an estimate. ' +
                    // ⚠️ THE TILES DO NOT DIVIDE TO THE PREMIUM, AND SAYING SO IS THE POINT.
                    // The first version of this panel computed the premium itself, from the mark
                    // over `underlying_strc_price_usd`, and printed −20.9 bps directly above a
                    // published 7-day range of −17.7 to −9.4 — a headline sitting OUTSIDE
                    // its own stated range, because the two were different measurements. The feed
                    // publishes this premium as a series; recomputing it from two fields I picked
                    // is the derive-instead-of-read trap, and it produced a number that contradicted
                    // the producer's own.
                    '<span class="italic">The premium is the analyzer’s published measure on its ' +
                    'own paired snapshot, not a division of the two tiles beside it — those are ' +
                    'sampled independently and will not divide to it exactly. The feed also carries a ' +
                    'second STRC reference about 18 bps from this one, which is part of why no tighter ' +
                    'figure is quotable.</span>' +
                '</div>' +
                '<div class="text-xs text-slate-500 leading-relaxed mt-3">' +
                    '<strong>Priced on Solana, which is the right venue rather than a compromise.</strong> ' +
                    'Ethereum holds ' + num(eth) + ' STRCx (' + pct(eth) + ' of supply), but ' +
                    num(held) + ' of that sits in two custodial addresses — the Apyx treasury and ' +
                    'Backed’s distribution hub — leaving about ' + num(ethFloat) + ' (' +
                    pct(ethFloat) + ' of supply) as float. Solana carries ' + num(sol) + ' (' +
                    pct(sol) + '), essentially all float, and it is the side with an order book' +
                    (wrapper.jupiter_liquidity_usd != null
                        ? ' (' + money(wrapper.jupiter_liquidity_usd) + ' visible depth)' : '') +
                    '. ' + num(wrapper.implied_other_chains_supply) + ' (' +
                    pct(wrapper.implied_other_chains_supply) + ') sits on chains with no registered ' +
                    'contract and cannot be located. Exit depth is scored on axis 3, on its own ' +
                    'measurement.' +
                '</div>' +
                // ⚠️ REUSES CommonRenderer._renderPegChart rather than painting a second
                // one here: it already carries the reference-line reasoning this estate
                // paid for (a flat line at today's NAV drawn across history read as a
                // discount that never happened on sUSDe), and for a `_pct`-scale field
                // it draws the zero line — which is exactly this asset's case. The
                // canvas id is passed in, because declaring a second <canvas id="peg-chart">
                // collides with the common one and check_feeds.py fails it.
                '<div class="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-5 mb-2">' +
                    'Premium to NAV over time</div>' +
                '<div style="height: 200px; position: relative;"><canvas id="strcx-peg-chart"></canvas></div>' +
                '<div class="text-xs text-slate-400 mt-1">Plotted in percent, as published \u2014 ' +
                    '0.10% = 10 bps. Zero is at NAV.</div>' +
                (cross != null ? '<div class="text-xs text-slate-500 leading-relaxed mt-3">' +
                    '⚠️ <strong>The cross-source gap is a diagnostic, not a rival mark.</strong> ' +
                    'CoinGecko’s cross-chain aggregate reads ' + fmtBps(cross) + ' against this ' +
                    'mark, and the gap moves. A plausible reading is that the aggregate folds in ' +
                    'quotes from chains with no real trading, which would drag it exactly this way ' +
                    '— stated as a hypothesis, not a finding: nothing here reads CoinGecko’s ' +
                    'per-chain inputs.' +
                '</div>' : '') +
            '</div>';

        // 7-day range from the published series. ⚠️ The field is
        // `premium_discount_pct` under `series` — this feed does not use `entries`,
        // which is why the frame's own 7-day path cannot see it.
        fetch('data/strc_backing_history.json?nocache=' + Math.floor(Date.now() / 60000))
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (h) {
                var el = document.getElementById('strcx-peg-7d');
                if (!el) return;
                var pts = (h && Array.isArray(h.series)) ? h.series : [];
                var cut = Date.now() - 7 * 24 * 3600 * 1000, vals = [];
                for (var i = 0; i < pts.length; i++) {
                    var v = pts[i] && pts[i].premium_discount_pct;
                    var t = pts[i] && pts[i].ts ? Date.parse(pts[i].ts) : NaN;
                    if (v != null && !isNaN(t) && t >= cut) vals.push(v * 100);
                }
                var nowEl = document.getElementById('strcx-peg-now');
                // ⚠️ The LATEST PUBLISHED POINT is the premium, not a figure derived here.
                // Same field as the range, so the headline is inside its own range by
                // construction rather than by luck.
                var latest = null, latestTs = null;
                for (var j = pts.length - 1; j >= 0; j--) {
                    if (pts[j] && pts[j].premium_discount_pct != null) {
                        latest = pts[j].premium_discount_pct * 100; latestTs = pts[j].ts; break;
                    }
                }
                if (nowEl) nowEl.textContent = (latest != null) ? fmtBps(latest) : '—';
                if (!vals.length) { el.textContent = '7-day range unavailable'; return; }
                el.textContent = '7-day ' + fmtBps(Math.min.apply(null, vals)) + ' to ' +
                    fmtBps(Math.max.apply(null, vals)) + ' (' + vals.length + ' pts)' +
                    (latestTs ? ' · as of ' + latestTs.slice(0, 16).replace('T', ' ') + 'Z' : '');

                // ⚠️ SHAPED, NOT MUTATED. The shared chart reads history.entries[].timestamp
                // and data.peg.history_field; this feed publishes `series[].ts`. Passing a
                // SYNTHETIC {peg:{history_field}} keeps the real data.peg empty — setting
                // premium_discount_pct on it would give pegRating() an instant value and
                // produce the rated band this panel exists to avoid.
                var entries = [];
                for (var k = 0; k < pts.length; k++) {
                    if (pts[k] && pts[k].premium_discount_pct != null && pts[k].ts) {
                        entries.push({ timestamp: pts[k].ts,
                                       premium_discount_pct: pts[k].premium_discount_pct });
                    }
                }
                if (entries.length && typeof CommonRenderer !== 'undefined' &&
                    CommonRenderer._renderPegChart) {
                    try {
                        CommonRenderer._renderPegChart(
                            { peg: { history_field: 'premium_discount_pct' } },
                            { entries: entries }, 'strcx-peg-chart');
                    } catch (e) { /* chart is optional; the figures above are not */ }
                }
            })
            .catch(function () {
                var el = document.getElementById('strcx-peg-7d');
                var n2 = document.getElementById('strcx-peg-now');
                if (el) el.textContent = 'published series unavailable';
                if (n2) n2.textContent = '—';
            });
    },

    // \u26a0\ufe0f The STRC panels are NOT repeated here. Everything about the preferred
    // itself \u2014 the monthly rate reset, the dividend obligation and runway, the
    // Strategy funding regime, the EDGAR event log \u2014 is one asset down, and this
    // card is the whole of what this page says about it.
    _renderUnderlyingLink: function (data) {
        var tradfi = data.tradfi || {};
        var div = tradfi.strc_dividend || {};
        var rate = div.current_rate;
        var rateTxt = (rate != null) ? (rate * 100).toFixed(2) + '%' : '\u2014';
        // ⚠️ `tradfi.strc_price.last` DOES NOT EXIST — that was a guess, and the feed
        // returns null for it. The secondary quote lives in `strc_secondary`, with
        // its own par and discount fields. Checked against the live file rather than
        // assumed from the panel above, which reads the same block.
        var sec = tradfi.strc_secondary || {};
        var px = (sec.price_usd != null) ? sec.price_usd : null;
        var parTxt = (sec.par_usd != null) ? 'par $' + sec.par_usd.toFixed(0) : 'par $100';
        var disc = sec.discount_to_par_bps;
        // ⚠️ The venue is still not named on this card, but the CONTRADICTION is
        // resolved: the feed's quote_detail said "NYSE", the report said Nasdaq, and
        // the 10-Q cover page (accession 0001050446-26-000044) says The Nasdaq Global
        // Select Market with zero NYSE hits. The feed is wrong and its venue word is
        // stripped at render — see CommonRenderer.sanitizeQuoteDetail. Neither side
        // deferring to the other's account is what got this read from the primary.
        return '<div class="panel">' +
            '<div class="panel-title">Underlying <span class="text-xs font-normal text-slate-500">\u2014 STRC (Strategy Series A perpetual preferred)</span></div>' +
            '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">' +
                '<div class="summary-card">' +
                    '<div class="card-label">STRC dividend rate</div>' +
                    '<div class="card-value">' + rateTxt + '</div>' +
                    '<div class="text-xs text-slate-400 mt-1">monthly reset, discretionary since 06-29</div>' +
                '</div>' +
                '<div class="summary-card">' +
                    '<div class="card-label">STRC secondary price</div>' +
                    '<div class="card-value">' + (px != null ? '$' + px.toFixed(2) : '\u2014') + '</div>' +
                    '<div class="text-xs text-slate-400 mt-1">' + parTxt +
                        (disc != null ? ' \u00b7 ' + (disc > 0 ? '+' : '') + disc + ' bps to par' : '') + '</div>' +
                '</div>' +
            '</div>' +
            '<div class="text-xs text-slate-500 leading-relaxed">' +
                'This token wraps the security above; its risks are the underlying\'s PLUS the wrapper\'s. ' +
                'Rate mechanics, dividend obligation, runway, the Strategy funding regime and the EDGAR ' +
                'event log are on the <a href="?asset=strc" class="text-blue-500 hover:underline">STRC ' +
                'dashboard \u2192</a>. Full write-up: ' +
                '<a href="https://tidresearch.com/reports/strcx" target="_blank" rel="noopener noreferrer" ' +
                'class="text-blue-500 hover:underline">STRCx risk report \u2197</a>.' +
            '</div>' +
        '</div>';
    },

    // ⚠️ DELEGATES rather than reimplements. The first version here copied three of
    // STRCRenderer's five suppressions and missed the CR-history panel, which then
    // rendered an empty "Collateral Ratio History" on a page whose asset has no CR.
    // Both views read the same feed and need the same panels gone; a second copy of
    // that list is a second thing to keep in step, which is the exact reason the
    // wrapper panel moved here instead of being shared.
    _suppressCommonPanels: function (data) {
        if (typeof STRCRenderer !== 'undefined' && STRCRenderer._suppressCommonPanels) {
            STRCRenderer._suppressCommonPanels(data);
            return;
        }
        var s = document.getElementById('summary-cards');
        if (s) s.style.display = 'none';
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

    // The wrapper panel itself — supply, multiplier, holders, admin posture.
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
                // ⚠️ "from ethereum.multiplier()" ALONE PRESENTS AN ISSUER INPUT AS AN
                // OBSERVATION. The call is a chain read, so the provenance line was
                // true and the implication was not: the VALUE is written by Backed,
                // not derived by formula. Caveat authored by riskAnalyst and rendered
                // in their wording; this side does not write claims about Backed's
                // attestation scope (see the apyx trust-banner retraction).
                '<div class="summary-card">' +
                    '<div class="card-label">Current multiplier ' +
                        '<span class="text-slate-400 font-normal" title="' +
                        CommonRenderer._escapeAttr(
                            'Read as an issuer input, not an observation. multiplier() is read from the ' +
                            'chain, but the value is written by Backed, not derived from an on-chain ' +
                            'formula — it is how the STRC dividend is passed through, net of ' +
                            'withholding. A missing or undersized monthly step-up would be an ' +
                            'issuer-behaviour signal, not a market one. (Expected pattern ~0.96pp/month ' +
                            'at the current rate.)') + '">\u24d8 issuer-set</span></div>' +
                    '<div class="card-value">' + (multiplier != null ? multiplier.toFixed(6) : '—') + '</div>' +
                    '<div class="text-xs text-slate-400 mt-1">from ethereum.multiplier() \u2014 ' +
                        '<span class="text-amber-700 dark:text-amber-300">written by Backed, not formula-derived</span></div>' +
                '</div>' +
                STRCxRenderer._renderStrcxMarkCard(wrapper) +
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
};
