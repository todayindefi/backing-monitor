// Alto DUSD: producer-owned issuance, encumbered LP collateral and cash-exit
// perimeters remain separate. Null valuation is unknown, not zero collateral.
// Historical evidence retains its source clocks; authored scores belong to RiskAnalyst.

var DUSD_ALTO_POOL_SHARE_WATCH_PCT = 50;

var DusdAltoRenderer = {

    preRender: function(data) {
        // Nothing to alias — the feed's own peg/backing blocks are already in the
        // shape the shared frame reads. Kept as an explicit no-op so the next
        // person does not go looking for a hidden mutation.
        return data;
    },

    render: function(data) {
        var specific = data.asset_specific || {};
        var backing = data.backing || {};
        var backingSlot = document.getElementById('backing-extra-panels');
        var liquiditySlot = document.getElementById('liquidity-extra-panels');
        var pegSlot = document.getElementById('peg-extra-panels');
        // Producer rows partition issued DUSD; they are liabilities, not USD reserves.
        var issuanceTable = document.getElementById('breakdown-table');
        if (issuanceTable && Array.isArray(backing.breakdown) && backing.breakdown.length && backing.breakdown.every(function(r) { return r.basis === 'minted DUSD partition'; })) {
            issuanceTable.innerHTML = '<thead><tr><th>Mint module</th><th>Issued DUSD</th><th>Share of issuance</th></tr></thead><tbody>' + backing.breakdown.map(function(r) {
                return '<tr><td>' + CommonRenderer._escapeAttr(r.label || r.name || '') + '</td><td class="text-right font-mono">' + DusdAltoRenderer._units(r.amount, 'DUSD') + '</td><td class="text-right">' + CommonRenderer.formatPercent(r.pct, 1) + '</td></tr>';
            }).join('') + '</tbody>';
            var issuancePanel = issuanceTable.closest('.panel');
            var issuanceTitle = issuancePanel && issuancePanel.querySelector('.panel-title');
            if (issuanceTitle) issuanceTitle.textContent = 'DUSD issuance by mint module';
            var issuanceCaption = document.getElementById('breakdown-caption');
            if (issuanceCaption) issuanceCaption.textContent = backing.breakdown_basis || 'Shares partition issued DUSD; they do not measure external backing value.';
        }


        if (backingSlot) {
            backingSlot.innerHTML =
                this._identityHtml(data, specific) +
                this._trancheCoverageHtml(backing) +
                this._creditLineHtml(backing) +
                this._usmHtml(backing, specific, data) +
                this._cdpHtml(backing) +
                '<div id="dusd-minters"></div>';
        }
        if (liquiditySlot) {
            liquiditySlot.innerHTML = this._exitRealityHtml(data);
        }
        if (pegSlot) {
            pegSlot.innerHTML = '<div id="dusd-lifetime-peg"></div>';
        }

        // Post-render: canvases and the two async files.
        this._paintTrancheChart(data);
        this._loadMinters(data);
        this._loadLifetimePeg(data);
    },

    // ---- identity ---------------------------------------------------------
    // ⚠️ FOUR LIVE ETHEREUM TOKENS ANSWER TO DUSD/dUSD and the nearest is 3.2%
    // away on supply, so a reader who matches this page to a ticker elsewhere can
    // be looking at a different asset. The warning was in assets.json (index-card
    // copy) and on no asset page.
    _identityHtml: function(data, specific) {
        var addr = data.contract_address || (specific.contracts || {}).dusd;
        if (!addr) return '';
        return '<div class="risk-flag risk-info mb-4">' +
            '<span class="font-semibold">Resolve this asset by address, not by ticker.</span> ' +
            'Same-symbol tokens are different assets; this page targets Ethereum DUSD ' +
            '<span class="font-mono text-xs">' + CommonRenderer._escapeAttr(addr) + '</span> ' +
            '<a href="https://etherscan.io/token/' + CommonRenderer._escapeAttr(addr) + '" target="_blank" ' +
            'class="text-blue-600 hover:underline text-xs">↗</a>' +
            '<span class="text-xs text-slate-500"> — module, LP and oracle observations retain their own addresses and source clocks.</span>' +
        '</div>';
    },

    // ---- axis 2: the two tranches ----------------------------------------
    _units: function(value, unit) {
        return value == null || !isFinite(Number(value)) ? 'Not established' :
            Number(value).toLocaleString('en-US', {maximumFractionDigits: 2}) + ' ' + unit;
    },

    _issuanceShare: function(backing, name) {
        var row = (backing.breakdown || []).find(function(x) { return x.name === name; });
        return row && typeof row.pct === 'number' ? row.pct.toFixed(1) + '% of issued DUSD' : 'Issuance share not supplied';
    },

    _trancheCoverageHtml: function(backing) {
        var usm = backing.usm || {}, cdp = backing.cdp || {}, self = this;
        var pct = function(v) { return v == null ? 'Not established' : CommonRenderer.formatPercent(v * 100, 2); };
        return '<div class="panel"><div class="panel-title">Minting modules — separate accounting perimeters</div>' +
            '<p class="text-sm">No combined reserve-coverage ratio is established. USM token matching, isolated market marks and LP credit-line claims answer different questions.</p>' +
            '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3"><div><div class="card-label">USM nominal token ratio</div><div class="text-2xl font-bold text-amber-700">' + pct(usm.ratio) + '</div>' +
            '<p class="text-sm">' + self._issuanceShare(backing, 'USM issuance') + '. No excess-token buffer; frxUSD asset quality and holder access remain separate.</p></div>' +
            '<div><div class="card-label">Non-USM collateral coverage</div><div class="text-2xl font-bold">' + pct(cdp.ratio) + '</div>' +
            '<p class="text-sm">' + self._issuanceShare(backing, 'CDP issuance') + '. Includes isolated markets, the LP credit line and unreadable modules.</p></div></div>' +
            '<p class="text-sm text-amber-700 mt-3">Known direct-custody oracle-mark subset: ' + self._units(cdp.known_subset_collateral_value_dusd, 'DUSD') +
            '; debt without established external valuation: ' + self._units(cdp.unknown_valuation_debt, 'DUSD') + '. These do not establish a loss, a whole-book ratio or holder recovery.</p>' +
            '<p class="text-xs text-slate-500 mt-2">USM + non-USM liability partition gap: ' + CommonRenderer._escapeAttr(String((backing.totals || {}).liability_partition_gap_raw == null ? 'unknown' : (backing.totals || {}).liability_partition_gap_raw)) + ' raw DUSD units.</p>' +
            '<div id="dusd-tranche-chart-slot" class="chart-container"><canvas id="dusd-tranche-chart"></canvas></div>' +
            '<p class="text-xs text-slate-500">Historical CDP ratios are withheld while their custody/valuation completeness is unresolved; no loss trend is inferred. Stored history and the operator-held peg backfill are unchanged.</p></div>';
    },

    _creditLineHtml: function(backing) {
        var self = this, esc = CommonRenderer._escapeAttr;
        return ((backing.cdp || {}).markets || []).filter(function(m) { return m.module_type === 'AltoConvexCreditLineMarket'; }).map(function(m) {
            var lt = m.lookthrough || {};
            return '<div class="panel" id="dusd-lp-creditline"><div class="panel-title">LP credit line — staked collateral, separate from cash</div>' +
                '<p class="text-sm">' + self._units(m.collateral_balance, 'LP tokens') + ' held through Convex against ' + self._units(m.debt, 'DUSD issued debt') + '.</p>' +
                '<p class="text-sm mt-2">Position / staked custody reconciliation: ' + (m.custody_covers_position === true ? 'matched at the source observation' : 'not established') + '.</p>' +
                '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3"><div><div class="card-label">External-token look-through</div><div class="text-lg font-semibold">' + self._units(lt.external_frxusd_units, 'frxUSD') + '</div></div>' +
                '<div><div class="card-label">Own-token look-through</div><div class="text-lg font-semibold">' + self._units(lt.own_dusd_units, 'DUSD') + '</div></div></div>' +
                '<p class="text-sm text-amber-700 mt-3">Own DUSD is circular and excluded from external backing. These are pro-rata pool-balance allocations, not executable proceeds; do not add them to the LP mark.</p>' +
                '<details class="mt-3"><summary class="text-sm">Nominal mark, custody and valuation limits</summary><p class="text-sm mt-2">Fixed-oracle nominal LP mark: ' + self._units(m.nominal_lp_value_dusd, 'DUSD') + ', not independent USD NAV.</p>' +
                '<p class="text-sm">' + esc(m.encumbrance || 'Encumbrance not established') + '. ' + esc(m.redeemability_status || 'Withdrawal availability unknown') + '.</p>' +
                '<p class="text-xs text-slate-500">' + esc(lt.basis || 'Look-through basis unavailable') + '</p><p class="text-xs">Market ' + self._ethLink(m.market) + ' · reward pool ' + self._ethLink(m.convex_reward_pool) + '</p></details></div>';
        }).join('');
    },

    // Two labelled series from the pool's own history. ⚠️ Plotted on separate
    // scales would invite a visual comparison of two ratios that answer different
    // questions; one axis with both lines and an explicit legend keeps the 100%
    // flat line visibly BELOW the CDP line, which is the honest picture.
    _paintTrancheChart: function(data) {
        var slot = document.getElementById('dusd-tranche-chart-slot');
        if (!slot) return;
        if (typeof Chart === 'undefined') { slot.remove(); return; }
        var ref = (data.asset_slug || 'dusd_alto').replace(/-/g, '_') + '_backing_history.json';
        var nocache = Math.floor(Date.now() / 60000);
        fetch('data/' + ref + '?nocache=' + nocache)
            .then(function(r) { return r.ok ? r.json() : null; })
            .then(function(h) {
                var entries = (h && Array.isArray(h.entries)) ? h.entries : [];
                var pts = entries.filter(function(e) {
                    return e && e.timestamp && (e.usm_ratio != null || e.cdp_ratio != null);
                });
                if (pts.length < 2) { slot.remove(); return; }
                DusdAltoRenderer._drawTrancheChart(pts.map(function(e) { return Object.assign({}, e, {cdp_ratio: e.cdp_valuation_status === 'complete_nominal_oracle_marks' ? e.cdp_ratio : null}); }));
            })
            .catch(function() { slot.remove(); });
    },

    _drawTrancheChart: function(pts) {
        var ctx = document.getElementById('dusd-tranche-chart');
        if (!ctx) return;
        var labels = pts.map(function(e) {
            return new Date(e.timestamp.endsWith('Z') ? e.timestamp : e.timestamp + 'Z');
        });
        var usm = pts.map(function(e) { return e.usm_ratio != null ? e.usm_ratio * 100 : null; });
        var cdp = pts.map(function(e) { return e.cdp_ratio != null ? e.cdp_ratio * 100 : null; });
        if (window._dusdTrancheChart) window._dusdTrancheChart.destroy();
        window._dusdTrancheChart = new Chart(ctx, {
            type: 'line',
            data: { labels: labels, datasets: [
                { label: 'USM tranche — 1:1, zero buffer', data: usm, borderColor: '#f59e0b',
                  fill: false, tension: 0, pointRadius: 0, borderWidth: 2 },
                { label: 'Non-USM nominal marks — source-qualified points only', data: cdp, borderColor: '#6366f1',
                  fill: false, tension: 0.2, pointRadius: 0, borderWidth: 2, borderDash: [4, 3] }
            ]},
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    x: { type: 'time', time: { unit: 'day' }, ticks: { font: { size: 10 } } },
                    y: { ticks: { font: { size: 10 }, callback: function(v) { return v + '%'; } } }
                },
                plugins: {
                    legend: { labels: { font: { size: 10 }, boxWidth: 12 } },
                    tooltip: { callbacks: { label: function(c) {
                        return c.dataset.label + ': ' + (c.parsed.y == null ? 'n/a' : c.parsed.y.toFixed(2) + '%');
                    } } }
                }
            }
        });
    },

    // ---- axis 2: the stability module -------------------------------------
    _usmHtml: function(backing, specific, dataRef) {
        var u = backing.usm;
        if (!u || typeof u !== 'object') return '';
        var esc = function(v) { return CommonRenderer._escapeAttr(String(v)); };
        var row = function(k, v, cls) {
            return '<tr><td class="text-sm text-slate-600">' + k + '</td>' +
                '<td class="text-right font-mono text-sm ' + (cls || '') + '">' + v + '</td></tr>';
        };
        var permissioned = typeof u.access_mode === 'string' && /PERMISSION/i.test(u.access_mode);
        var treasury = (specific.contracts || {}).treasury_safe;

        return '<div class="panel">' +
            '<div class="panel-title">Universal Stability Module ' +
                '<span class="text-xs font-normal text-slate-500">(' + this._issuanceShare(backing, 'USM issuance') + ')</span></div>' +
            (permissioned
                ? '<div class="risk-flag risk-warning mb-3">' +
                    '<span class="font-semibold">Not a holder redemption route.</span> The swap is ' +
                    esc(u.access_mode) + ' — general holder eligibility is not established. ' +
                    '<span class="text-xs text-slate-500">Access mode is the producer’s own field; ' +
                    'this snapshot does not renew older role-enumeration or lifetime-swap claims.</span>' +
                  '</div>'
                : '') +
            '<div class="overflow-x-auto"><table class="data-table"><tbody>' +
                row('Module', '<span class="text-xs">' + DusdAltoRenderer._truncAddr(u.module) + '</span> ' +
                    DusdAltoRenderer._ethLink(u.module)) +
                row('Underlying', esc(u.underlying || '—') + ' ' +
                    (u.underlying_address ? DusdAltoRenderer._ethLink(u.underlying_address) : '')) +
                row('Minted / underlying held',
                    DusdAltoRenderer._units(u.minted, 'DUSD') + ' / ' +
                    DusdAltoRenderer._units(u.underlying_balance, u.underlying || 'underlying units') +
                    (u.reconciled_to_wei ? ' <span class="text-green-600 text-xs">reconciled to the wei</span>' : '')) +
                row('Buffer', (u.buffer_pct != null ? CommonRenderer.formatPercent(u.buffer_pct, 2) : '—') +
                    ' <span class="text-xs text-amber-700">by construction</span>', 'text-amber-600 font-semibold') +
                row('Backstop', u.backstop === 'none'
                    ? '<span class="text-amber-600 font-semibold">none</span>' : esc(u.backstop || '—')) +
                row('Swap fee', u.fee_bps != null ? u.fee_bps + ' bps' : '—') +
                row('Exposure cap', u.exposure_cap != null ? CommonRenderer.formatCurrency(u.exposure_cap) +
                    ' <span class="text-xs text-slate-400">token units</span>' : '—') +
                row('Frozen', u.is_frozen === false ? '<span class="text-green-600">no</span>'
                    : u.is_frozen === true ? '<span class="text-red-600 font-semibold">YES</span>' : '—') +
                row('Seized', u.is_seized === false ? '<span class="text-green-600">no</span>'
                    : u.is_seized === true ? '<span class="text-red-600 font-semibold">YES</span>' : '—') +
                (treasury ? row('Treasury Safe',
                    '<span class="text-xs">' + DusdAltoRenderer._truncAddr(treasury) + '</span> ' +
                    DusdAltoRenderer._ethLink(treasury) +
                    DusdAltoRenderer._sharedAuthorityMark(dataRef, treasury)) : '') +
            '</tbody></table></div>' +
            // ⚠️ THE PRODUCER CALLS THIS SOLVENCY-CRITICAL AND IT IS ONE FIELD.
            (u.is_seized_basis
                ? '<div class="risk-flag risk-critical mt-3">' +
                    '<span class="font-semibold">seize() is a solvency path, not an admin nicety.</span> ' +
                    esc(u.is_seized_basis) + '</div>'
                : '') +
            '<div id="dusd-usm-history" class="text-xs text-slate-500 mt-3"></div>' +
        '</div>';
    },

    // ---- axis 2: the CDP markets -----------------------------------------
    _cdpHtml: function(backing) {
        var cdp = backing.cdp || {};
        var markets = Array.isArray(cdp.markets) ? cdp.markets : [];
        if (!markets.length) return '';
        // ⚠️ THE FIELD NAMES ARE THE PRODUCER'S: `collateral` (a SYMBOL), `debt`,
        // `coll_value`, `ratio` (a multiple) and `oracle`. My first draft guessed
        // `collateral_symbol` / `collateral_value_usd` and fell through to printing
        // the market ADDRESS in the collateral column with an empty ratio beside
        // it. And the ratio is PUBLISHED — recomputing coll_value/debt here would
        // be deriving what the feed already states.
        var rows = markets.slice().sort(function(a, b) {
            return (b.debt || 0) - (a.debt || 0);
        }).map(function(m) {
            var debt = m.debt, coll = m.coll_value;
            var ratio = typeof m.ratio === 'number' ? m.ratio * 100 : null;
            var cls = ratio == null ? '' : 'text-slate-700';
            return '<tr>' +
                '<td class="font-mono text-xs">' + CommonRenderer._escapeAttr(
                    m.collateral || '—') + '</td>' +
                '<td class="text-xs">' + (m.market
                    ? DusdAltoRenderer._truncAddr(m.market) + ' ' +
                      DusdAltoRenderer._ethLink(m.market) : '—') + '</td>' +
                '<td class="text-right font-mono">' + DusdAltoRenderer._units(debt, 'DUSD') + '</td>' +
                '<td class="text-right font-mono">' + DusdAltoRenderer._units(coll, 'DUSD') + '</td>' +
                '<td class="text-right font-mono ' + cls + '">' +
                    (ratio != null ? CommonRenderer.formatPercent(ratio, 1) : '—') + '</td>' +
                '<td class="text-[11px] text-slate-400">' +
                    CommonRenderer._escapeAttr(m.oracle || '—') + '</td>' +
            '</tr>';
        }).join('');
        return '<div class="panel">' +
            '<div class="panel-title">Non-USM mint modules ' +
                '<span class="text-xs font-normal text-slate-500">(' + this._issuanceShare(backing, 'CDP issuance') + ')</span></div>' +
            '<p class="text-sm text-slate-500 mb-3">Each market is isolated: its collateral answers to ' +
                'its own borrower or credit account; this table is not a DUSD-holder reserve-coverage calculation. ' +
                '<span class="text-xs">Collateral is marked with each market’s own Alto oracle.</span></p>' +
            '<div class="overflow-x-auto"><table class="data-table"><thead><tr>' +
                '<th>Collateral</th><th>Market</th><th class="text-right">DUSD debt</th>' +
                '<th class="text-right">Nominal oracle mark (DUSD)</th><th class="text-right">Mark / debt</th>' +
                '<th>Mark</th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
        '</div>';
    },

    // ---- axis 3: what an exit actually looks like -------------------------
    // ⚠️ EVERY NUMBER HERE IS DexTracker's OWN, including the arithmetic: the
    // tradable remainder is the producer's float minus the producer's own
    // enumerated non-swap holders, and the subtraction is shown rather than
    // asserted, because the two figures differ by three orders of magnitude and
    // that difference is the finding.
    _currentExitScopeHtml: function(lq) {
        var self = this, esc = CommonRenderer._escapeAttr, depth = lq.depth || {}, holdings = depth.holdings || {};
        var residual = holdings.third_party_float || {}, downstream = lq.downstream_route_legs || {};
        var rungs = Array.isArray(depth.rungs) ? depth.rungs : (lq.rungs || []);
        function table(rows) {
            return '<div class="overflow-x-auto"><table class="data-table"><thead><tr><th>Input sizing (USD)</th><th>Indicative USDC output</th><th>Nominal return (bps)</th><th>Change vs $100 baseline (bps)</th><th>Quote clock</th></tr></thead><tbody>' + rows.map(function(r) {
                function n(v) { return typeof v === 'number' && isFinite(v) ? v.toFixed(3) : 'Not established'; }
                return '<tr><td>' + esc(n(r.size_usd)) + '</td><td>' + esc(n(r.amount_out_tokens)) + '</td><td>' + esc(n(r.slippage_bps)) + '</td><td>' + esc(n(r.slippage_bps_debiased)) + '</td><td class="text-xs">' + esc(r.quote_as_of || 'Unknown') + '</td></tr>';
            }).join('') + '</tbody></table></div>';
        }
        var valid = rungs.filter(function(r) { return r.status === 'ok' && r.exceeds_recorded_total_supply === false; });
        var above = rungs.filter(function(r) { return r.exceeds_recorded_total_supply === true; });
        return '<div class="panel" id="dusd-current-exit-scope"><div class="panel-title">Cash exit — indicative quotes, unresolved holder capacity</div>' +
            '<p class="text-sm">Saved quote clock: ' + esc((depth.quote || {}).quoted_as_of || lq.as_of || 'Unknown') + '. Quotes are not funded fills, public float or guaranteed execution. Gas estimates are not deducted from the output; expiry and settlement are not established.</p>' + table(valid) +
            '<p class="text-xs mt-2">Signed nominal return compares output with input sizing. Baseline-relative change compares average execution rates with the source $100 sample; it is not interval marginal impact.</p>' +
            '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4"><div><div class="card-label">Recorded supply outside pool</div>' + self._units(holdings.supply_outside_pool_units, 'DUSD') + '</div><div><div class="card-label">Named-contract direct-balance residual</div>' + self._units(residual.units, 'DUSD') + '</div></div>' +
            '<p class="text-sm mt-2">Current economic public float and current treasury LP ownership: not established. Holder-list basis: ' + esc(residual.holder_list_as_of || 'Unknown') + '. These distribution figures are separate from the quoted sample size.</p>' +
            '<p class="text-xs">' + esc(holdings.basis || '') + ' ' + esc(holdings.lp_withdrawal_caveat || '') + '</p>' +
            '<p class="text-sm mt-3">DUSD → frxUSD sale and downstream cash conversion are separate. ' + esc(downstream.basis || '') + ' Current Frax conversion eligibility, cash and limit: not established. Permissioned Alto USM access is not a general-holder cash guarantee.</p>' +
            (above.length ? '<details class="mt-3"><summary>Above-supply mathematical observations — not sellable capacity</summary>' + table(above) + '</details>' : '') + '</div>';
    },

    _exitRealityHtml: function(data) {
        var lq = data.liquidity || {};
        if (lq.two_pct_depth_status === 'quote_only_supply_bounded_floor' || (lq.depth || {}).status === 'quote_only_supply_bounded_floor') return this._currentExitScopeHtml(lq);
        var venues = Array.isArray(lq.venues) ? lq.venues : [];
        var live = venues.filter(function(v) { return v && v.kind === 'swap' && !/exclud|dead/i.test(String(v.status || '')); });
        var pool = live[0];
        if (!pool && !lq.axis_binding_constraint) return '';

        var share = null, dusdBal = null, otherBal = null, otherSym = null;
        if (pool && Array.isArray(pool.balances) && pool.balances.length === 2) {
            var d = pool.balances.find(function(b) { return /dusd/i.test(b.symbol); });
            var o = pool.balances.find(function(b) { return !/dusd/i.test(b.symbol); });
            if (d && o && (d.amount + o.amount) > 0) {
                dusdBal = d.amount; otherBal = o.amount; otherSym = o.symbol;
                share = d.amount / (d.amount + o.amount) * 100;
            }
        }
        // ⚠️ THE SWEEP'S CLOCK, NOT THE BLOCK'S. `liquidity.as_of` is the payload's,
        // and the balances came from the enumeration pass at its own pinned block;
        // quoting the wrong one of the two invites comparison against a figure
        // measured elsewhere (riskAnalyst read 23.33% at a later block).
        var enumBlk = lq.enumeration || {};
        var enumAsOf = enumBlk.as_of || null, enumBlock = enumBlk.pinned_block || null;
        var excl = lq.excluded_liquidity || {};
        var nonSwap = Array.isArray(excl.non_swap_entries) ? excl.non_swap_entries : [];
        var floatUsd = typeof lq.total_2pct_depth === 'number' ? lq.total_2pct_depth : null;

        var shareCls = share == null ? '' :
            share >= DUSD_ALTO_POOL_SHARE_WATCH_PCT ? 'text-red-600' : 'text-slate-700';

        return '<div class="panel">' +
            '<div class="panel-title">Exit reality ' +
                '<span class="text-xs font-normal text-slate-500">(one venue, and the float is the cap)</span></div>' +
            (share != null
                ? '<div class="flex flex-wrap gap-6 mb-3">' +
                    '<div><div class="text-xs text-slate-400 font-medium uppercase">Pool composition</div>' +
                    '<div class="text-2xl font-bold font-mono ' + shareCls + '">' +
                        CommonRenderer.formatPercent(share, 2) + ' DUSD</div>' +
                    '<div class="text-[11px] text-slate-500 mt-1" style="line-height:1.45;">' +
                        CommonRenderer.formatCurrency(dusdBal) + ' DUSD against ' +
                        CommonRenderer.formatCurrency(otherBal) + ' ' +
                        CommonRenderer._escapeAttr(otherSym || '') + '. DUSD is the SCARCE coin here, ' +
                        'which is why the unit quotes at a premium. A move toward ' +
                        DUSD_ALTO_POOL_SHARE_WATCH_PCT + '% is the premium inverting.' +
                        // ⚠️ A COMPOSITION FIGURE WITHOUT ITS CLOCK INVITES A FALSE
                        // COMPARISON. riskAnalyst measured 23.33% at block
                        // 26,053,165 today; this payload's balances are its own
                        // reading at its own as_of, and the two are hours apart on
                        // a pool where third-party deposits move the denominator.
                        (enumAsOf
                            ? ' <span class="text-slate-400">Pool balances read at ' +
                              CommonRenderer._escapeAttr(enumAsOf) +
                              (enumBlock ? ', block ' + CommonRenderer._escapeAttr(enumBlock) : '') +
                              '.</span>'
                            : '') +
                    '</div></div>' +
                  '</div>'
                : '') +
            this._floatLadderHtml(lq, floatUsd, nonSwap, excl) +
            (lq.axis_binding_constraint && lq.axis_binding_constraint.basis
                ? '<div class="risk-flag risk-warning mb-3"><span class="font-semibold">Binding leg — ' +
                    CommonRenderer._escapeAttr(String(lq.axis_binding_constraint.leg || '').replace(/_/g, ' ')) +
                    ':</span> ' + CommonRenderer._escapeAttr(lq.axis_binding_constraint.basis) + '</div>'
                : '') +
            this._regimeHtml(lq) +
            this._downstreamHtml(lq) +
            this._measurementClocksHtml(lq) +
        '</div>';
    },


    // ⚠️ "FLOAT" IS THREE DIFFERENT NUMBERS AND THE PAGE WAS SHOWING THE MIDDLE
    // ONE UNDER THE BIGGEST CLAIM. My earlier version printed the depth figure as
    // "float that can reach the market": that is supply-less-pool, 24,936 — and
    // the number a holder could actually sell into is 946.70, twenty-six times
    // smaller. riskAnalyst measured and published the split after I declined to
    // derive it, and the reason the distinction matters arrived with it: supply
    // moved +1,000 into an AltoBorrowMarket, so supply-less-pool grew by 1,000
    // while third-party float did not move at all. A page quoting the middle
    // number renders growth that never reaches a holder.
    //
    // ⚠️ THE METHOD LABEL IS NOT DECORATION AND THE PRODUCER ASKED FOR IT BY
    // NAME. `method: residual` means totalSupply minus five known addresses, so
    // an unrecognised protocol contract makes the figure OVERSTATE third-party
    // float — it errs generous, which on an exit axis is the unsafe direction.
    // Rendering the number without the method would publish the optimistic read
    // of an optimistic method.
    _floatLadderHtml: function(lq, floatUsd, nonSwap, excl) {
        var fs = lq.float_split;
        // Two decimals on every rung, including the trailing zero: 946.70 beside
        // 24,936.18 reads as the same kind of measurement, and "946.7" reads as a
        // rounder number than the producer published.
        var fmt = function(n) {
            return (typeof n === 'number')
                ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
                  ' DUSD' : '—';
        };
        if (!fs || typeof fs !== 'object') {
            // No published split: state the one figure we have and DO NOT derive
            // the rest. (This was the whole panel before 2026-09-25.)
            return floatUsd == null ? '' :
                '<div class="text-sm text-slate-700 mb-2"><span class="font-semibold">Supply outside ' +
                'the pool: ' + CommonRenderer.formatCurrency(floatUsd) + '</span>' +
                '<div class="text-xs text-slate-500 mt-1">⚠️ This is not the tradable float and no ' +
                'split is published for this asset.</div></div>';
        }
        var row = function(label, value, cls, note) {
            return '<tr>' +
                '<td class="text-sm text-slate-600">' + label +
                    (note ? '<div class="text-[11px] text-slate-500" style="line-height:1.4;">' +
                        note + '</div>' : '') + '</td>' +
                '<td class="text-right font-mono text-sm ' + (cls || '') + '">' + value + '</td>' +
            '</tr>';
        };
        var det = function(label, text) {
            return (typeof text === 'string' && text.trim())
                ? CommonRenderer._scoreBasisHtml(label, text) : '';
        };
        return '<div class="mb-3">' +
            '<div class="text-sm font-semibold text-slate-700 mb-1">Float ladder ' +
                '<span class="text-xs font-normal text-slate-400">' +
                (fs.measured_at ? 'measured ' + CommonRenderer._escapeAttr(fs.measured_at) : '') +
                (fs.measured_at_block ? ' · block ' + CommonRenderer._escapeAttr(fs.measured_at_block) : '') +
                '</span></div>' +
            '<div class="overflow-x-auto"><table class="data-table"><tbody>' +
                row('Total supply', fmt(fs.total_supply_dusd)) +
                row('Supply outside the pool', fmt(fs.supply_less_pool_dusd), 'text-slate-500',
                    '⚠️ NOT the tradable float — DUSD minted into a borrow market inflates this and ' +
                    'never reaches a holder.') +
                row('Third-party float', fmt(fs.third_party_float_dusd),
                    'text-amber-600 font-semibold',
                    (fs.method ? 'method: <span class="font-mono">' +
                        CommonRenderer._escapeAttr(fs.method) + '</span> — errs generous' : '')) +
            '</tbody></table></div>' +
            det('How the residual is computed, and what it cannot bound', fs.method_note) +
            det('Cross-check against the full enumeration', fs.cross_check_note) +
            det('⚠️ Supply moved — and only one of the two floats moved with it', fs.supply_moved_note) +
            det('Holder count and largest holder are a different basis',
                fs.holder_count_and_largest_are_a_DIFFERENT_BASIS) +
            (nonSwap.length
                ? '<div class="text-[11px] text-slate-400 mt-2" style="line-height:1.5;">' +
                  'DexTracker separately enumerates the non-venue holders that make up the gap — ' +
                  nonSwap.map(function(e) { return CommonRenderer._escapeAttr(String(e)); }).join('; ') +
                  '. ' + (excl.non_swap_reason ? CommonRenderer._escapeAttr(excl.non_swap_reason) : '') +
                  '</div>'
                : '') +
        '</div>';
    },

    // ⚠️ ONE CLOCK PER MEASUREMENT, BECAUSE THE FILE'S as_of SPEAKS FOR NONE OF
    // THEM. The producer added this after my merge was caught re-dating
    // DexTracker's pool read to their authoring time — including an explicit line
    // that their 23.33% DUSD share and DexTracker's rendered share are two
    // readings of one quantity at two blocks, not a correction of one by the other.
    _measurementClocksHtml: function(lq) {
        var mc = lq.measurement_clocks;
        if (!mc || typeof mc !== 'object') return '';
        var rows = Object.keys(mc).filter(function(k) { return k !== 'note' && typeof mc[k] === 'string'; })
            .map(function(k) {
                return '<tr><td class="text-xs text-slate-600">' +
                    CommonRenderer._escapeAttr(k.replace(/_/g, ' ')) + '</td>' +
                    '<td class="text-xs text-slate-500">' + CommonRenderer._escapeAttr(mc[k]) + '</td></tr>';
            }).join('');
        if (!rows) return '';
        return '<details class="score-basis mt-2"><summary class="score-basis-toggle">' +
            'What was measured when — one clock per figure</summary>' +
            '<div class="score-basis-body">' +
            (mc.note ? '<div class="mb-2">' + CommonRenderer._escapeAttr(mc.note) + '</div>' : '') +
            '<table class="data-table"><tbody>' + rows + '</tbody></table>' +
            '</div></details>';
    },

    // The counterfactual the producer measured: what the float becomes if the
    // issuer withdraws its LP. ⚠️ Rendered as the producer's own note, not
    // recomputed — the scaling uses a StableSwap invariant property and deriving
    // it here would be a second implementation of someone else's measurement.
    _regimeHtml: function(lq) {
        var r = lq.regimes;
        if (!r || typeof r !== 'object' || !r.note) return '';
        return '<details class="score-basis"><summary class="score-basis-toggle">' +
            'If the issuer withdraws its LP — the producer’s scaled ladder</summary>' +
            '<div class="score-basis-body">' + CommonRenderer._mdInlineHtml(String(r.note)) +
            (r.pinned_block ? '<div class="text-[11px] text-slate-400 mt-1">Pinned at block ' +
                CommonRenderer._escapeAttr(r.pinned_block) +
                (r.pinned_block_time_utc ? ' · ' + CommonRenderer._escapeAttr(r.pinned_block_time_utc) : '') +
                '</div>' : '') +
            '</div></details>';
    },

    // Hops 2-3 of the dollar exit. These are NOT DUSD venues and the producer
    // says so in the payload; they are here because their inventory bounds the
    // exit, which is the only reason a DUSD holder would care about them.
    _downstreamHtml: function(lq) {
        var d = lq.downstream_route_legs;
        if (!d || typeof d !== 'object') return '';
        var legs = Object.keys(d).filter(function(k) {
            return k !== 'note' && d[k] && typeof d[k] === 'object';
        });
        if (!legs.length) return '';
        var rows = legs.map(function(k) {
            var l = d[k];
            return '<tr>' +
                '<td class="text-xs">' + CommonRenderer._escapeAttr(k.replace(/_/g, ' ')) + '</td>' +
                '<td class="text-xs">' + (l.address ? DusdAltoRenderer._truncAddr(l.address) + ' ' +
                    DusdAltoRenderer._ethLink(l.address) : '—') + '</td>' +
                '<td class="text-xs">' + CommonRenderer._escapeAttr(l.kind || '—') + '</td>' +
                '<td class="text-xs">' + CommonRenderer._escapeAttr(l.rate || '—') + '</td>' +
            '</tr>';
        }).join('');
        return '<details class="score-basis mt-2"><summary class="score-basis-toggle">' +
            'The dollar legs after DUSD (hops 2–3)</summary>' +
            '<div class="score-basis-body">' +
            (d.note ? '<div class="mb-2">' + CommonRenderer._escapeAttr(String(d.note)) + '</div>' : '') +
            '<div class="overflow-x-auto"><table class="data-table"><thead><tr>' +
                '<th>Leg</th><th>Address</th><th>Kind</th><th>Rate</th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
            '</div></details>';
    },

    // ---- axis 5/6 input: who can mint ------------------------------------
    // ⚠️ SYNCED SEPARATELY AND NEVER BEFORE COPIED: `_minters` was not a block
    // type in sync_and_push.sh, so PegTracker's enumeration sat in its own repo
    // for four days. On an 822K-supply token the minter set IS the admin surface.
    _loadMinters: function(data) {
        var slot = document.getElementById('dusd-minters');
        if (!slot) return;
        var ref = (data.asset_slug || 'dusd_alto').replace(/-/g, '_') + '_minters.json';
        var nocache = Math.floor(Date.now() / 60000);
        fetch('data/' + ref + '?nocache=' + nocache)
            .then(function(r) { return r.ok ? r.json() : null; })
            .then(function(j) {
                var list = j && Array.isArray(j.minters) ? j.minters : null;
                if (!list || !list.length) { slot.remove(); return; }
                slot.innerHTML = DusdAltoRenderer._mintersHtml(j, list);
            })
            .catch(function() { slot.remove(); });
    },

    _mintersHtml: function(j, list) {
        var cells = list.map(function(a) {
            return '<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 ' +
                'text-[11px] font-mono text-slate-600 mr-1 mb-1">' +
                DusdAltoRenderer._truncAddr(a) + DusdAltoRenderer._ethLink(a) + '</span>';
        }).join('');
        return '<div class="panel">' +
            '<div class="panel-title">Who can mint ' +
                '<span class="text-xs font-normal text-slate-500">(' + list.length + ' live minters)</span></div>' +
            // ⚠️ The producer's own method line, verbatim. My first draft
            // paraphrased it AND printed it, so the panel said the same thing
            // twice in two voices.
            (j.discovery_basis
                ? '<p class="text-sm text-slate-500 mb-3">' +
                  CommonRenderer._escapeAttr(j.discovery_basis) + '</p>'
                : '') +
            '<div>' + cells + '</div>' +
            (j.last_scanned_block
                ? '<div class="text-[11px] text-slate-400 mt-2">Scanned through block ' +
                  CommonRenderer._escapeAttr(j.last_scanned_block) +
                  (j.discovered_at ? ' · ' + CommonRenderer.formatDate(j.discovered_at) : '') + '</div>'
                : '') +
        '</div>';
    },

    // ---- axis 1: the lifetime record -------------------------------------
    // ⚠️ A SEPARATE CHART, NEVER SPLICED INTO THE LIVE SERIES. PegTracker
    // declares the archive "HELD standalone by operator decision; it is not
    // spliced into this series" and the reason is visible in the data: the venue
    // CHANGES mid-life (UniV3 DUSD/USDC while it was liquid, Curve thereafter),
    // so one continuous line would imply one continuous measurement basis.
    _loadLifetimePeg: function(data) {
        var slot = document.getElementById('dusd-lifetime-peg');
        if (!slot) return;
        if (typeof Chart === 'undefined') { slot.remove(); return; }
        var ref = (data.asset_slug || 'dusd_alto').replace(/-/g, '_') + '_peg_backfill.json';
        var nocache = Math.floor(Date.now() / 60000);
        fetch('data/' + ref + '?nocache=' + nocache)
            .then(function(r) { return r.ok ? r.json() : null; })
            .then(function(j) {
                var rows = j && Array.isArray(j.rows) ? j.rows.filter(function(x) {
                    return x && x.timestamp && typeof x.market_price === 'number';
                }) : [];
                if (rows.length < 10) { slot.remove(); return; }
                slot.innerHTML = DusdAltoRenderer._lifetimePegShellHtml(j, rows);
                DusdAltoRenderer._drawLifetimePeg(rows);
            })
            .catch(function() { slot.remove(); });
    },

    _lifetimePegShellHtml: function(j, rows) {
        var byVenue = {};
        rows.forEach(function(r) { byVenue[r.venue || 'unknown'] = (byVenue[r.venue || 'unknown'] || 0) + 1; });
        var excluded = rows.filter(function(r) { return Array.isArray(r.excluded) && r.excluded.length; }).length;
        var prices = rows.map(function(r) { return r.market_price; });
        var min = Math.min.apply(null, prices), max = Math.max.apply(null, prices);
        return '<div class="panel">' +
            '<div class="panel-title">Lifetime peg record ' +
                '<span class="text-xs font-normal text-slate-500">(' + rows.length +
                ' archive samples — a separate series)</span></div>' +
            '<div class="risk-flag risk-info mb-3">' +
                '<span class="font-semibold">Not spliced into the live chart, deliberately.</span> ' +
                'This is an archive reconstruction whose VENUE changes mid-life (' +
                Object.keys(byVenue).map(function(v) {
                    return CommonRenderer._escapeAttr(v) + ' ' + byVenue[v];
                }).join(' · ') + '), so joining it to the hourly series would imply one ' +
                'continuous measurement basis. The producer holds it standalone; this renders it ' +
                'as what it is.' +
                (excluded ? ' <span class="text-xs">' + excluded + ' sample' + (excluded === 1 ? '' : 's') +
                    ' carry the producer’s own exclusion flag and are plotted as gaps.</span>' : '') +
            '</div>' +
            '<div class="flex flex-wrap gap-6 mb-2 text-sm">' +
                '<div><span class="text-slate-400 text-xs uppercase">Low</span> ' +
                    '<span class="font-mono font-semibold">' + min.toFixed(4) + '</span></div>' +
                '<div><span class="text-slate-400 text-xs uppercase">High</span> ' +
                    '<span class="font-mono font-semibold">' + max.toFixed(4) + '</span></div>' +
                '<div><span class="text-slate-400 text-xs uppercase">Samples</span> ' +
                    '<span class="font-mono font-semibold">' + rows.length + '</span></div>' +
            '</div>' +
            (j.statistic ? '<div class="text-[11px] text-slate-400 mb-2">' +
                CommonRenderer._escapeAttr(j.statistic) + '</div>' : '') +
            '<div class="chart-container"><canvas id="dusd-lifetime-chart"></canvas></div>' +
        '</div>';
    },

    _drawLifetimePeg: function(rows) {
        var ctx = document.getElementById('dusd-lifetime-chart');
        if (!ctx) return;
        var labels = rows.map(function(r) {
            return new Date(r.timestamp.endsWith('Z') ? r.timestamp : r.timestamp + 'Z');
        });
        // One dataset per venue so the basis change is visible as two segments
        // rather than one line pretending to be homogeneous.
        var venues = [];
        rows.forEach(function(r) { if (venues.indexOf(r.venue) < 0) venues.push(r.venue); });
        var palette = { univ3_dusd_usdc: '#94a3b8', curve_dusd_frxusd: '#6366f1' };
        var sets = venues.map(function(v, i) {
            return {
                label: String(v).replace(/_/g, ' '),
                data: rows.map(function(r) {
                    return (r.venue === v && !(Array.isArray(r.excluded) && r.excluded.length))
                        ? r.market_price : null;
                }),
                borderColor: palette[v] || ['#f59e0b', '#14b8a6'][i % 2],
                fill: false, tension: 0.2, pointRadius: 0, borderWidth: 2, spanGaps: false
            };
        });
        if (window._dusdLifetimeChart) window._dusdLifetimeChart.destroy();
        window._dusdLifetimeChart = new Chart(ctx, {
            type: 'line',
            data: { labels: labels, datasets: sets },
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    x: { type: 'time', time: { unit: 'month' }, ticks: { font: { size: 10 } } },
                    y: { ticks: { font: { size: 10 }, callback: function(v) { return v.toFixed(3); } } }
                },
                plugins: {
                    legend: { labels: { font: { size: 10 }, boxWidth: 12 } },
                    annotation: { annotations: {
                        par: { type: 'line', yMin: 1, yMax: 1, borderColor: '#94a3b8',
                               borderWidth: 1, borderDash: [4, 4],
                               label: { content: 'par', display: true, position: 'start',
                                        font: { size: 9 }, color: '#94a3b8' } }
                    } }
                }
            }
        });
    },


    // ⚠️ THREE SAFE ADDRESSES, ONE SIGNER SET — AND THIS PAGE NAMES TWO OF THEM.
    // riskAnalyst publishes `contract.one_authority_three_safes`: governance,
    // treasury and emergency Safes each return the IDENTICAL seven EOAs at 4-of-7,
    // and the field states the consumer obligation outright — "a panel naming any
    // one of these Safes beside another must state that four signatures reach
    // both". The Stability Module panel prints the treasury Safe and the exit
    // panel references it, so without this a reader counts separate controls that
    // do not exist. Same shape as the frxUSD six-addresses-one-owner-set pattern.
    //
    // ⚠️⚠️ "FOUR SIGNATURES REACH ALL THREE" WAS WRONG AND I RENDERED IT. The
    // producer corrected the field on 2026-10-01: treasury and governance are
    // genuinely 4-of-7 over one owner set, but the EmergencyController gates on
    // `pauserSafe.isOwner(msg.sender)` and never calls execTransaction, so the
    // Safe threshold is bypassed entirely for halting. THREE ADDRESSES, ONE OWNER
    // SET, TWO EFFECTIVE THRESHOLDS: four keys to move value, ONE to halt.
    //
    // ⚠️ So the marker no longer states a threshold at all. Any single figure is
    // wrong for this asset whichever one is picked, and the producer publishes
    // `power_surface_by_delay` for the full split — a number in a chip cannot
    // carry it.
    //
    // ⚠️ MEMBERSHIP IS TESTED AGAINST THE PRODUCER'S OWN TEXT, not a list I keep.
    // A hardcoded address list here would silently stop matching the day they
    // revise the set, and would be a second place to maintain the same fact.
    // ⚠️ MATCHED ON THE ADDRESS PREFIX, ACROSS BOTH FIELDS — because matching the
    // FULL address against prose broke the moment the producer reformatted. Their
    // corrected text abbreviates to "0xA1148A1b…4228", so the full-string test
    // failed and the marker silently disappeared from the page. That is the cost
    // of testing membership against prose: it is hostage to formatting. A 10-char
    // prefix (4 bytes) survives both the full and the elided form and is still
    // distinctive; and both authority fields are searched, since the split now
    // lives in `power_surface_by_delay`.
    _sharedAuthorityMark: function(data, addr) {
        var c = (data || {}).contract || {};
        var note = [c.one_authority_three_safes, c.power_surface_by_delay]
            .filter(function(x) { return typeof x === 'string'; }).join('\n');
        if (!note || !addr) return '';
        var probe = String(addr).slice(0, 10).toLowerCase();
        if (probe.length < 10 || note.toLowerCase().indexOf(probe) < 0) return '';
        return ' <span class="shared-authority" title="' + CommonRenderer._escapeAttr(note) +
            '">\u26a0\ufe0f 1 of 3 Safes, one owner set \u2014 two thresholds</span>';
    },

    // ---- helpers ---------------------------------------------------------
    // ⚠️ LOCAL, because there is no shared truncator in common.js — syrupusdc.js
    // carries its own `_truncAddr` for the same reason. Not promoted to the
    // shared layer as a drive-by: four renderers would then need re-checking.
    _truncAddr: function(a) {
        var s = String(a || '');
        return s.length > 12 ? s.slice(0, 6) + '…' + s.slice(-4) : s;
    },

    _ethLink: function(addr) {
        if (!addr) return '';
        return '<a href="https://etherscan.io/address/' + CommonRenderer._escapeAttr(addr) +
            '" target="_blank" class="text-blue-500 hover:underline text-xs" title="' +
            CommonRenderer._escapeAttr(addr) + '">↗</a>';
    }
};
