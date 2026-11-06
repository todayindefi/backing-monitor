/**
 * USDai / sUSDai: Arbitrum peg/NAV and backing observations, standard six-axis
 * placement, and separately sourced chain-specific liquidity. Code/authority,
 * documentary review, valuation and quote clocks retain their own provenance.
 * Financial marks and fresh aggregate accounting do not verify credit quality,
 * payment performance, custody rights or actual cash execution.
 */

// Verified contract constants (Arbitrum) — used for the illustrative cast
// commands. Live governance addresses are read from usdai_family.json, not here.
var USDAI_ADDRS = {
    USDAI:            '0x0A1a1A107E45b7Ced86833863f482BC5f4ed82EF', // TransparentProxy, 18dp
    SUSDAI:           '0x0B2b2B2076d95dda7817e785989fE353fe955ef9', // ERC-7540 vault, 18dp
    PYUSD:            '0x46850aD61C2B7d64d08c9C754F45254596696984', // PayPal USD (Paxos), 6dp
    DEPOSIT_TIMELOCK: '0x0D710CC05f34d2eaD9fbA3c78d53d76a0623c9F8'  // committed-undrawn loan escrow
};

var USDAI_COLORS = {
    PYUSD:      '#10b981', // emerald — PYUSD reserve / on-chain dollar
    IDLE_USDAI: '#10b981', // emerald — idle USDai buffer (on-chain)
    IDLE_PYUSD: '#6ee7b7', // light emerald — idle PYUSD (on-chain)
    ESCROW:     '#f59e0b', // amber — DepositTimelock escrow (committed-undrawn, pre-credit)
    DRAWN:      '#ea580c'  // deep orange — drawn GPU loans (live credit)
};

var UsdaiRenderer = {

    // ============================================================
    // helpers
    // ============================================================
    _isUsdai: function(t) { return t === 'usdai' || t === 'susdai'; },

    _truncAddr: function(addr) {
        if (!addr) return '-';
        return addr.slice(0, 6) + '...' + addr.slice(-4);
    },

    _explorerLink: function(addr) {
        if (!addr) return '';
        return '<a href="https://arbiscan.io/address/' + addr + '" target="_blank" rel="noopener noreferrer" ' +
            'class="text-blue-500 hover:underline text-xs" title="' + addr + '">↗</a>';
    },

    _addrCell: function(addr) {
        if (!addr) return '<span class="text-slate-400">-</span>';
        return '<span class="font-mono text-xs" title="' + addr + '">' +
            UsdaiRenderer._truncAddr(addr) +
            '</span> ' + UsdaiRenderer._explorerLink(addr);
    },

    _statusDot: function(state) {
        var color;
        if (state === 'ok')            color = '#22c55e';
        else if (state === 'warn')     color = '#f59e0b';
        else if (state === 'critical') color = '#ef4444';
        else                           color = '#94a3b8';
        return '<span class="inline-block w-2 h-2 rounded-full align-middle" ' +
            'style="background:' + color + '"></span>';
    },

    // True when the feed itself declares the coverage denominator is Arbitrum-only.
    // Keyed off the feed's own comment so every caveat downstream removes itself
    // the moment the analyzer fixes the basis — a caveat must not outlive its cause.
    _arbitrumOnlyBasis: function(specific) {
        return !!(specific && specific.peg_leg &&
                  typeof specific.peg_leg.comment === 'string' &&
                  /arbitrum-only denominator/i.test(specific.peg_leg.comment));
    },

    // Axis section divider for the bespoke panel stream — reuses the common
    // layer's .axis-head / .axis-num / .axis-title / .axis-sub styling so these
    // headers match the band above. Same shape as syrupusdc.js / hastra-prime.js.
    // ⚠️ `chip` carries an authored axis score into a bespoke header. This page
    // hides the shared axis section, so anything CommonRenderer writes into that
    // head is invisible here — which is how riskAnalyst's dependencies score sat
    // in the DOM behind `display:none` with nobody able to read it.
    _axisHead: function(num, title, sub, chip) {
        return '<div class="axis-head">' +
            '<span class="axis-num">' + num + '</span>' +
            '<span class="axis-title">' + title + '</span>' +
            (sub ? '<span class="axis-sub">' + sub + '</span>' : '') +
            (chip || '') +
        '</div>';
    },

    _esc: function(v) {
        if (v == null) return '';
        return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    },

    _statusPill: function(label, state, extra) {
        var bg, fg;
        if (state === 'ok')            { bg = 'bg-green-100'; fg = 'text-green-800'; }
        else if (state === 'warn')     { bg = 'bg-amber-100'; fg = 'text-amber-800'; }
        else if (state === 'critical') { bg = 'bg-red-100';   fg = 'text-red-800'; }
        else                           { bg = 'bg-slate-100'; fg = 'text-slate-700'; }
        return '<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ' + bg + ' ' + fg + '">' +
            UsdaiRenderer._statusDot(state) +
            '<span>' + label + (extra ? ' <span class="font-mono">' + extra + '</span>' : '') + '</span>' +
        '</span>';
    },

    _anchor: function(id, html) {
        if (!html || typeof html !== 'string') return html;
        return html.replace(/^(<div class="panel")/, '<div id="' + id + '" class="panel"');
    },

    // coverage_ratio is a ratio (1.0199): green ≥1.00, amber 0.995–1.00, red <0.995.
    // A reserve-backed 1:1 token sitting at EXACTLY par is not over-collateralized —
    // it has no buffer at all, and the first dollar of loss is a shortfall. The old
    // band returned 'ok' for anything >= 1.0, so a true 1.0000 would have rendered a
    // green "Over-collateralized" pill. That matters here specifically: the current
    // 1.00548 is an artefact of an Arbitrum-only denominator, and once the analyzer
    // sums supply across chains the real figure is ~1.0000000. The basis caveat
    // removes itself at that point, so without this band the fix would REVEAL a green
    // over-collateralized pill on a token with zero headroom — worse than today.
    _coverageState: function(ratio) {
        if (ratio == null) return 'unknown';
        if (ratio >= 1.001) return 'ok';
        if (ratio >= 0.995) return 'warn';
        return 'critical';
    },

    // Label is separate from state so "at par" can read as its own condition rather
    // than being flattened into "Thin", which implies a deficit that par is not.
    _coverageLabel: function(ratio) {
        if (ratio == null)  return 'Unknown';
        if (ratio >= 1.001) return 'Over-collateralized';
        if (ratio >= 1.0)   return 'At par \u2014 no buffer';
        if (ratio >= 0.995) return 'Thin';
        return 'Under';
    },

    // buffer_ratio is a fraction (0.182): ≥10% ok, 5–10% watch, <5% stress.
    _bufferState: function(ratio) {
        if (ratio == null) return 'unknown';
        if (ratio >= 0.10) return 'ok';
        if (ratio >= 0.05) return 'warn';
        return 'critical';
    },

    // recon_residual_pct is a FRACTION (0.00803 = 0.80%): <2% closes, ≥2% drift.
    _reconState: function(frac) {
        if (frac == null) return 'unknown';
        if (frac < 0.02) return 'ok';
        if (frac < 0.05) return 'warn';
        return 'critical';
    },

    // Stored discount_to_nav_pct = (NAV - price) / NAV * 100, positive = discount.
    // Display convention is price-vs-NAV: positive = premium, negative = discount.
    _navDevDisplay: function(nav, price, storedDiscount) {
        if (nav != null && price != null && nav > 0) {
            return (price - nav) / nav * 100;
        }
        return storedDiscount != null ? -storedDiscount : null;
    },

    _susdaiNavBasis: function(s) {
        if (s && s.discount_to_nav_basis === 'nav_per_share_deposit_fallback') {
            return s.nav_per_share;
        }
        if (s && s.discount_to_nav_basis === 'redemption_share_price' && s.redemption_share_price != null) {
            return s.redemption_share_price;
        }
        return s && s.redemption_share_price != null ? s.redemption_share_price : (s || {}).nav_per_share;
    },

    _susdaiNavBasisSource: function(s) {
        if (s && s.discount_to_nav_basis === 'nav_per_share_deposit_fallback') {
            return 'convertToAssets(1e18)';
        }
        if (s && s.discount_to_nav_basis === 'redemption_share_price' && s.redemption_share_price != null) {
            return 'redemptionSharePrice()';
        }
        return s && s.redemption_share_price != null ? 'redemptionSharePrice()' : 'convertToAssets(1e18)';
    },

    _navDevState: function(disp) {
        if (disp == null) return 'unknown';
        if (disp >= 0) {
            if (disp < 1.0) return 'ok';
            if (disp < 3.0) return 'warn';
            return 'critical';
        }
        var a = -disp;
        if (a < 0.5) return 'ok';
        if (a < 1.5) return 'warn';
        return 'critical';
    },

    _navDevWord: function(disp) {
        if (disp == null) return '—';
        if (Math.abs(disp) < 0.05) return 'at NAV';
        return disp > 0 ? 'premium · above NAV' : 'discount · below NAV';
    },

    // api divergence is a PERCENT: <2% ok, <5% watch (a gap is itself signal).
    _divergenceState: function(pct) {
        if (pct == null) return 'unknown';
        var a = Math.abs(pct);
        if (a < 2)  return 'ok';
        if (a < 5)  return 'warn';
        return 'critical';
    },

    _pegStatusClass: function(p) { return CommonRenderer.pegStatusClass(p); },
    _pegStatusLabel: function(s) { return CommonRenderer.pegStatusLabel(s); },
    _pegPctText:     function(p, d) { return CommonRenderer.pegPctText(p, d); },
    _pegPctClass:    function(s) { return CommonRenderer.pegPctClass(s); },

    _stateTextCls: function(state) {
        return state === 'ok' ? 'text-green-600' :
               state === 'warn' ? 'text-amber-600' :
               state === 'critical' ? 'text-red-600' : 'text-slate-500';
    },

    _usdShort: function(v) {
        if (v == null) return '—';
        if (Math.abs(v) >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
        if (Math.abs(v) >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'K';
        return '$' + v.toFixed(0);
    },

    // ============================================================
    // pre-render — runs before common renderer paints
    // ============================================================
    // USD.AI summary blocks don't match common renderer's shape
    // (total_supply / total_backing / collateral_ratio / collateral_ratio_alt /
    // backing_breakdown). Synthesize the minimum so common.js doesn't NPE, then
    // suppress its panels in render() and paint the rich custom panels below.
    preRender: function(data, history) {
        var specific = data.asset_specific || {};
        if (!UsdaiRenderer._isUsdai(specific.type)) return;
        var s = data.summary || {};
        data.summary = s;

        // Layer 1 emits `as_of` and (for some assets) carries `asset`/`chain`.
        // These JSONs do carry asset/chain, but alias defensively.
        if (!data.timestamp && data.as_of) data.timestamp = data.as_of;
        if (!data.asset) data.asset = (specific.type === 'usdai') ? 'USDai' : 'sUSDai';
        if (!data.chain) data.chain = 'arbitrum';

        // Common renderSummaryCards reads s.collateral_ratio_alt.label
        // unconditionally — synthesize then hide via card_overrides.
        if (!s.collateral_ratio_alt) {
            s.collateral_ratio_alt = { label: '_usdaiAltHidden', value: 0, is_currency: false };
        }
        specific.card_overrides = specific.card_overrides || {};
        specific.card_overrides['_usdaiAltHidden'] = { hidden: true };
        specific.card_overrides['Surplus / Deficit'] = { hidden: true };

        // Synthesize common fields so the (hidden) common renderer doesn't crash.
        if (specific.type === 'usdai') {
            if (s.total_supply == null)  s.total_supply  = s.supply_usd;
            if (s.total_backing == null) s.total_backing = s.pyusd_reserve_usd;
            if (s.collateral_ratio == null && s.coverage_ratio != null) {
                s.collateral_ratio = s.coverage_ratio * 100;
            }
            if (s.surplus_deficit == null && s.pyusd_reserve_usd != null && s.supply_usd != null) {
                s.surplus_deficit = s.pyusd_reserve_usd - s.supply_usd;
            }
        } else {
            if (s.total_supply == null)  s.total_supply  = s.total_assets_usd;
            if (s.total_backing == null) s.total_backing = s.total_assets_usd;
            // ⚠️ Deliberately NOT synthesising collateral_ratio / surplus_deficit.
            //
            // sUSDai is a NAV-marked private-credit vault and has no collateral
            // ratio; the feed publishes backing.collateral_ratio as null with a
            // note saying a ratio here would be manufactured. This block used to
            // fill in 100 / 0 "so the hidden common renderer doesn't crash" —
            // which was true while the common panels WERE hidden. The 5-axis band
            // now renders, CommonRenderer.backingRating falls back to
            // summary.collateral_ratio when backing.collateral_ratio is null, and
            // the manufactured 100 surfaced as "BACKING 100.00% · surplus +$0"
            // with a 3/5 rating on an asset that has no such ratio.
            //
            // backingRating and _backingValueHtml both return null / "—" on a null
            // cr, which is the correct empty state. A workaround whose safety
            // depended on the panel being hidden had to change when it stopped being.
        }

        if (!Array.isArray(data.backing_breakdown)) {
            data.backing_breakdown = [];
        }

        // History needs a synthetic collateral_ratio so common's CR chart can
        // loop — but that chart is hidden anyway.
        if (history && Array.isArray(history.entries)) {
            history.entries.forEach(function(e) {
                if (e.collateral_ratio == null) {
                    if (specific.type === 'usdai' && e.coverage_ratio != null) {
                        e.collateral_ratio = e.coverage_ratio * 100;
                    }
                }
            });
        }
    },

    // ============================================================
    // entry point
    // ============================================================
    render: function(data) {
        var container = document.getElementById('asset-specific-panels');
        var specific = data.asset_specific || {}, slug = data.asset_slug;
        if (!container || !UsdaiRenderer._isUsdai(specific.type)) return;
        UsdaiRenderer._suppressCommonPanels(data);
        container.innerHTML = '';
        function mount(axis, html) {
            var section = document.getElementById('section-' + axis);
            var body = document.getElementById('axis-' + axis + '-body');
            var extra = document.getElementById(axis + '-extra-panels');
            if (section) { section.style.display = ''; section.classList.remove('hidden'); }
            if (body) body.innerHTML = html;
            else if (extra) extra.innerHTML = html;
        }
        var s = data.summary || {}, anc = UsdaiRenderer._anchor;
        mount('peg', UsdaiRenderer._renderMarketTiles(data) + UsdaiRenderer._renderPegChartPanel(data, slug) +
            (slug === 'susdai' ? UsdaiRenderer._details('Yield and share-price details', anc('panel-nav', UsdaiRenderer._renderSusdaiNav(specific, s))) : ''));
        var backing = CommonRenderer.backingBasisPanelHtml(data) + UsdaiRenderer._renderFreshness(data) +
            (slug === 'usdai' ? '<p class="text-sm text-slate-500">Supply perimeter: ' + UsdaiRenderer._esc(Object.keys(s.supply_by_chain || {}).join(', ') || s.supply_scope || 'not supplied') + '. Coverage is limited to the producer’s declared chains. Check historical row scope before comparing periods.</p>' : '') +
            (slug === 'usdai' ? '<div class="panel" id="panel-reserve-health"><div class="panel-title">Reserve backing and loan health are separate</div><p class="text-sm">The ratio below compares reported reserves with supply across the declared chains. It does not independently establish reserve quality, immediately available cash or redemption settlement.</p><p class="text-sm mt-2">Loan records and payment-evidence gaps are shown on the <a class="text-blue-500 hover:underline" href="?asset=susdai#panel-loan-evidence">sUSDai loan-health panel ↗</a>.</p></div>' + anc('panel-coverage', UsdaiRenderer._renderUsdaiCoverage(specific, s)) :
                '<p class="text-sm text-slate-500">NAV accounting vault: no independent collateral ratio is established.</p>' + anc('panel-decomp', UsdaiRenderer._renderSusdaiDecomposition(specific, s)) + UsdaiRenderer._renderCreditEvidence(data)) +
            UsdaiRenderer._details('Asset model and measurement scope', anc('panel-headline', UsdaiRenderer._renderHeadlineCard(specific, s, slug))) +
            '<div id="usdai-family-panel"></div>';
        var bx = document.getElementById('backing-extra-panels');
        if (bx) bx.innerHTML = backing;
        var bs = document.getElementById('section-backing');
        if (bs) { bs.style.display = ''; bs.classList.remove('hidden'); }
        // Canonical liquidity renderer retains depth status/floor, source clocks,
        // primary eligibility, venue inventory and the complete published ladder.
        mount('liquidity', CommonRenderer.liquidityPanelHtml(data) + '<p class="text-sm text-amber-700">' +
            ((data.liquidity || {}).primary_exit ? 'Asynchronous primary exit: holder eligibility, funded capacity and realized queue time are not established by these aggregate getters.' :
                'Primary redemption: holder eligibility and currently available capacity are not established in this feed.') + '</p>');
        var lx = document.getElementById('liquidity-extra-panels');
        if (lx) lx.innerHTML = '<div id="usdai-chain-liquidity"><p class="text-sm text-slate-500">Chain-specific liquidity observations loading; Arbitrum remains the peg/NAV measurement chain.</p></div>';
        // Preserve the standard dependency and code/authority panels, including
        // their producer clocks, explicit unknowns, sources and authored notes.
        var cx = document.getElementById('contract-extra-panels');
        if (cx) cx.innerHTML = '<div id="usdai-gov-panel"></div>';
        UsdaiRenderer._setupAnchorNav(slug);
        UsdaiRenderer._setupCompanionLink(slug);
        UsdaiRenderer._loadPegChart(data, slug);
        if (slug === 'susdai') UsdaiRenderer._loadNavChart(slug);
        UsdaiRenderer._loadFamily(slug, data);
        UsdaiRenderer._loadChainLiquidity(slug);
        if (slug === 'susdai') UsdaiRenderer._loadLoanEvidence();
        UsdaiRenderer._compactEvidence();
    },

    _details: function(label, html) {
        return '<details class="panel mt-3"><summary class="cursor-pointer text-sm font-semibold">' +
            UsdaiRenderer._esc(label) + '</summary><div class="mt-3">' + html + '</div></details>';
    },

    _renderMarketTiles: function(data) {
        var peg = data.peg || {}, s = data.summary || {}, vault = data.asset_slug === 'susdai';
        var market = peg.market_price, low = peg.nav_band ? peg.nav_band.low : peg.nav;
        var high = peg.nav_band && peg.nav_band.high;
        // Derive the signed comparison from the named reference, never reinterpret
        // the producer's unsigned band-distance magnitude as a premium.
        var dev = market != null && low > 0 ? (market / low - 1) * 100 : null;
        function price(x) { return x == null ? 'Unknown' : '$' + Number(x).toFixed(6); }
        function tile(label, val, note) {
            return '<div class="summary-card"><div class="card-label">' + label + '</div><div class="card-value text-lg">' + val + '</div><div class="text-xs text-slate-500">' + UsdaiRenderer._esc(note) + '</div></div>';
        }
        return '<div class="panel" id="panel-secondary"><div class="panel-title">Arbitrum market vs ' + (vault ? 'NAV band' : '$1 reference') + '</div>' +
            '<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">' +
            tile('Market', price(market), peg.source || 'Price source not published') +
            tile(vault ? 'Redemption NAV' : 'Reference', price(low), vault ? 'Share-price mark; cash settlement is separate' : 'USDai par reference') +
            tile('Signed premium / discount', dev == null ? 'Unknown' : (dev > 0 ? '+' : '') + (dev * 100).toFixed(2) + ' bps', vault ? 'Versus redemption NAV; negative means discount' : 'Versus $1; negative means discount') +
            tile(vault ? 'Deposit NAV' : 'Cross-source check', vault ? price(high) : 'Not independently established', vault ? 'Entry mark, separate from redemption price' : 'One published market-price source') + '</div>' +
            '<p class="text-xs text-slate-500 mt-2">Price source clock: ' + UsdaiRenderer._esc(peg.market_price_as_of || 'not supplied; file refresh does not establish price age') + '.</p></div>';
    },

    _renderFreshness: function(data) {
        var p = CommonRenderer.AXIS_PROVENANCE || {}, stamp = data.as_of || data.timestamp;
        function row(label, time) {
            return '<tr><td>' + label + '</td><td>' + UsdaiRenderer._esc(time || 'Unknown') + '</td></tr>';
        }
        var rows = row('Backing snapshot (Arbitrum)', stamp);
        ['dependencies', 'contract', 'issuer'].forEach(function(axis) {
            var block = data[axis] || {}, provenance = p[axis] || {};
            rows += row(axis + ' review / overlay', block.as_of || provenance.overlay_as_of);
        });
        return '<div class="panel"><div class="panel-title">Measurement and review dates</div>' +
            '<p class="text-sm">A current backing snapshot does not renew older credit, authority or issuer reviews.</p>' +
            '<div class="data-table-scroll"><table class="data-table"><thead><tr><th>Evidence</th><th>Original clock</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    },

    _renderCreditEvidence: function(data) {
        var s = data.summary || {};
        var residual = s.implied_deployed_loans_usd;
        return '<div class="panel" id="panel-loan-evidence"><div class="panel-title">Loan health and payments — verification incomplete</div>' +
            '<p class="text-sm text-amber-700">Fresh vault accounting is not a current loan-quality or repayment audit.</p>' +
            '<div class="data-table-scroll"><table class="data-table"><thead><tr><th>Evidence</th><th>Current feed coverage</th></tr></thead><tbody>' +
            '<tr><td>Implied deployed credit</td><td>' + (residual == null ? 'Unknown' : CommonRenderer.formatCurrencyExact(residual)) + ' — accounting residual, not independently verified recoverable principal</td></tr>' +
            '<tr><td>Loan-level principal, arrears and impairments</td><td>Not supplied by this aggregate feed</td></tr>' +
            '<tr><td>Scheduled vs settled repayments</td><td>No reconciled payment ledger supplied</td></tr>' +
            '<tr><td>Funded DSRA and enforceable recovery coverage</td><td>Current loan-specific amounts not established here</td></tr>' +
            '</tbody></table></div><p class="text-xs text-slate-500 mt-2">Accounting snapshot: ' + UsdaiRenderer._esc(data.as_of || data.timestamp || 'unknown') +
            '. Missing credit/payment evidence is not a finding of missed payments or realized losses.</p></div>';
    },

    _loadLoanEvidence: function() {
        var target = document.getElementById('panel-loan-evidence');
        if (!target) return;
        fetch('data/usdai_loan_evidence.json?nocache=' + Math.floor(Date.now() / 60000))
            .then(function(r) { return r.ok ? r.json() : null; })
            .then(function(d) {
                var html = UsdaiRenderer._renderLoanEvidence(d);
                if (html) target.innerHTML = html;
            }).catch(function() { /* Keep explicit unavailable-evidence fallback. */ });
    },

    _renderLoanEvidence: function(d) {
        if (!d || d.schema_version !== 'usdai-public-loan-evidence/1' || d.chain_id !== 42161 || !d.population || !Array.isArray(d.loan_records)) return '';
        var e = UsdaiRenderer._esc;
        function money(v) {
            return v == null || v === '' || !isFinite(Number(v)) ? 'Unknown' : CommonRenderer.formatCurrency(Number(v));
        }
        var p = d.population || {}, records = d.loan_records || [], next = d.next_30_days_schedule || {};
        function metric(label, value, note) {
            return '<div class="summary-card"><div class="card-label">' + label + '</div><div class="card-value text-lg">' +
                e(value) + '</div><div class="text-xs text-slate-500">' + e(note) + '</div></div>';
        }
        function table(rows) {
            return '<div class="data-table-scroll"><table class="data-table"><thead><tr><th>Published record</th><th>Remaining principal</th><th>Reported APR</th><th>Last scheduled payment</th><th>Schedule source date</th></tr></thead><tbody>' +
                rows.map(function(x) {
                    return '<tr><td>' + e(x.publisher_name) + '</td><td>' + money(x.remaining_principal) + '</td><td>' +
                        e(x.reported_apr_pct == null ? 'Unknown' : Number(x.reported_apr_pct).toFixed(2) + '%') + '</td><td>' +
                        e(x.last_scheduled_due_at || 'Unknown') + '</td><td>' + e(x.schedule_as_of || 'Unknown') + '</td></tr>';
                }).join('') + '</tbody></table></div>';
        }
        var h = d.reported_payment_history || {}, principal = h.principal || {}, interest = h.yield || {};
        var paymentRows = [30,60,90].map(function(days) {
            var a = (principal.windows || {})[days], b = (interest.windows || {})[days];
            function amount(x) { return !x || x.reported_amount == null ? 'Unknown' : money(x.reported_amount) + ' reported'; }
            return '<tr><td>' + days + ' completed days</td><td>' + amount(a) + '</td><td>' + amount(b) + '</td><td>' +
                e(a ? a.start_inclusive + ' → ' + a.end_exclusive + ' (exclusive)' : 'Unknown') + '</td></tr>';
        }).join('');
        var counter = d.liquidation_event_counter || {};
        return '<div class="panel-title">Loan health — performance not established</div>' +
            '<p class="text-sm">We can observe part of the reported loan book and its scheduled payments. We cannot establish current repayment performance or recoverable loan value from these sources.</p>' +
            '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">' +
            '<div><div class="text-sm font-semibold">What the evidence shows</div><p class="text-sm">A partial loan population, concentration within that population and future scheduled principal and interest.</p></div>' +
            '<div><div class="text-sm font-semibold">What remains unknown</div><p class="text-sm">Matched payment receipts, arrears and impairments, funded debt-service reserves and current independent collateral valuations. Missing evidence does not establish missed payments or losses.</p></div></div>' +
            '<p class="text-xs text-slate-500 mt-3">sUSDai credit evidence is separate from USDai’s reported reserve-to-supply accounting. Neither establishes immediate cash-exit availability.</p>' +
            '<div class="text-sm font-semibold mt-4">Reported loan book — partial population</div>' +
            '<p class="text-sm text-amber-700">Issuer reporting, not independent underwriting. The visible schedules do not reconcile to the full reported loan metric.</p>' +
            '<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">' +
            metric('API-active records', p.reported_active_count == null ? 'Unknown' : p.reported_active_count, 'Of ' + p.published_deal_count + ' published deals; ' + p.other_status_count + ' other-status records excluded') +
            metric('Visible scheduled principal', p.visible_remaining_principal == null ? 'Unknown' : money(p.visible_remaining_principal), 'Partial schedule population; nominal reference units') +
            metric('Larger aggregate loan metric', p.aggregate_reported_principal == null ? 'Unknown' : money(p.aggregate_reported_principal), 'Issuer reporting; scope not fully reconciled') +
            metric('Top five visible records', p.largest_five_visible_pct == null ? 'Unknown' : Number(p.largest_five_visible_pct).toFixed(1) + '%', 'Of visible principal only; not global borrower concentration') + '</div>' +
            '<p class="text-sm text-amber-700 mt-3">Scope difference: ' + (p.scope_difference == null ? 'unmeasured' : money(p.scope_difference)) +
            ' — not a demonstrated loss or missing-assets finding.</p>' +
            '<div class="text-sm font-semibold mt-4">Largest visible loan records</div><p class="text-xs text-slate-500 sm:hidden">Swipe tables horizontally for payment dates and source clocks.</p>' + table(records.slice(0,5)) +
            UsdaiRenderer._details('All ' + records.length + ' API-active loan records and original schedule dates', table(records)) +
            '<div class="text-sm font-semibold mt-4">Next 30 days — scheduled, not paid</div>' +
            '<p class="text-sm">' + (next.principal == null ? 'Unknown principal' : money(next.principal) + ' principal') + ' + ' +
                (next.interest == null ? 'unknown interest' : money(next.interest) + ' interest') + ' across ' + e(next.rows == null ? 'unknown' : next.rows) + ' public schedule rows. This subset is not all protocol obligations or guaranteed receipts.</p>' +
            '<p class="text-xs text-slate-500">Schedule calculation: ' + e(next.source_computed_at || 'unknown') + '. Nominal reference units, not a cash-exit valuation.</p>' +
            '<div class="text-sm font-semibold mt-4">API-reported repayment events — incomplete evidence</div>' +
            '<p class="text-sm text-amber-700">No loan-level due-to-receipt reconciliation. Zero reported history does not establish that no payments occurred.</p>' +
            '<div class="data-table-scroll"><table class="data-table"><thead><tr><th>Window</th><th>Principal</th><th>Yield</th><th>Date bounds</th></tr></thead><tbody>' + paymentRows + '</tbody></table></div>' +
            '<p class="text-xs text-slate-500 mt-2">Last positive reported day: principal ' + e(principal.last_positive_reported_day || 'not established') + '; yield ' +
                e(interest.last_positive_reported_day || 'not established') + '. This is event-feed coverage, not a complete payment or arrears ledger.</p>' +
            '<p class="text-xs text-slate-500">Event-feed computation: principal ' + e(principal.computed_at || 'unknown') + '; yield ' + e(interest.computed_at || 'unknown') + '.</p>' +
            '<p class="text-sm mt-3">Receipt matching, arrears aging, current independent GPU valuations and funded DSRA remain unverified.</p>' +
            '<p class="text-xs text-slate-500 mt-2">Dated issuer snapshot: ' + e(d.snapshot_computed_at || 'unknown') + '. This is a one-off observation, not a continuously refreshed credit monitor.</p>' +
            UsdaiRenderer._details('Source dates, metric definitions and limits',
                '<p class="text-sm">Scheduled payments retain ' + e(next.start || 'unknown') + ' → ' + e(next.end_exclusive || 'unknown') + ' bounds. Historical event computation: ' + e(principal.computed_at || 'unknown') +
                '. Schedule source dates span ' + e((d.schedule_source_range || {}).oldest || 'unknown') + ' → ' + e((d.schedule_source_range || {}).newest || 'unknown') + '.</p>' +
                '<p class="text-sm">Reported liquidation-event count: ' + e(counter.reported == null ? 'unknown' : counter.reported) + '/' + e(counter.population == null ? 'unknown' : counter.population) +
                '. This is not a default or delinquency census. Legal related-group and offtaker concentration are not established by publisher record labels.</p>' +
                '<p class="text-sm">' + e(d.denomination || '') + '. Reported APRs are not independently normalized effective returns.</p>' +
                '<p><a class="text-blue-500 hover:underline" href="https://api.usd.ai/swagger" target="_blank" rel="noopener noreferrer">Issuer API definitions ↗</a> · ' +
                '<a class="text-blue-500 hover:underline" href="data/usdai_loan_evidence.json" target="_blank" rel="noopener noreferrer">Public source snapshot ↗</a></p>');
    },

    _loadChainLiquidity: function(slug) {
        var target = document.getElementById('usdai-chain-liquidity');
        if (!target) return;
        fetch('data/' + slug + '_chain_liquidity.json?nocache=' + Math.floor(Date.now() / 60000))
            .then(function(r) { return r.ok ? r.json() : null; })
            .then(function(d) {
                target.innerHTML = UsdaiRenderer._renderChainLiquidity(d, slug);
            }).catch(function() {
                target.innerHTML = UsdaiRenderer._renderChainLiquidity(null, slug);
            });
    },

    _renderChainLiquidity: function(d, slug) {
        if (!d || d.schema_version !== 'chain-exit-observations/1' || d.asset_slug !== slug) {
            return '<div class="panel"><div class="panel-title">Other-chain liquidity unmeasured</div><p class="text-sm">No supported chain-specific evidence is available here. This is not zero liquidity; Arbitrum peg/NAV tracking is unchanged.</p></div>';
        }
        var esc = UsdaiRenderer._esc, currency = CommonRenderer.formatCurrency;
        var rows = '', contextRows = '', details = '';
        Object.keys(d.per_chain || {}).forEach(function(key) {
            var c = d.per_chain[key], depth = c.depth_50bps || {};
            var size = depth.depth_usd == null ? 'Unmeasured — not zero' :
                (depth.is_floor ? '≥' : '') + currency(depth.depth_usd) + ' observed sample';
            var bracket = depth.bracket || {};
            var status = depth.status || 'Unmeasured';
            var recommendation = (d.display_recommendation || {})[key] || {};
            var row = '<tr><td>' + esc(c.chain || key) + '</td><td>' + esc(size) + '</td><td>' + esc(status) +
                (bracket.first_failing_size_usd != null ? '; first failing sample ' + currency(bracket.first_failing_size_usd) : '') +
                '</td><td>' + esc(c.quote_observed_at || 'Unknown') + '</td></tr>';
            if (recommendation.recommended_primary_display === true) rows += row;
            else contextRows += row;
            var rungs = (c.rungs || []).map(function(r) {
                var ok = r.status === 'quoted';
                return '<tr><td>' + currency(r.target_nav_notional_usd) + '</td><td>' +
                    (ok && r.output_tokens != null ? esc(r.output_tokens) + ' ' + esc(c.output_symbol || '') : 'Quote unavailable') +
                    '</td><td>' + (ok && r.added_average_rate_cost_bps != null ? esc(Number(r.added_average_rate_cost_bps).toFixed(2)) + ' bps' : 'Unknown') +
                    '</td><td>' + (ok && r.signed_nominal_return_vs_nav_bps != null ? esc(Number(r.signed_nominal_return_vs_nav_bps).toFixed(2)) + ' bps' : 'Unknown') +
                    '</td><td>' + esc((r.route_summary || {}).gasUsd || 'Unknown') +
                    '</td><td>' + esc(r.received_at || 'Unknown') + '</td></tr>';
            }).join('');
            details += UsdaiRenderer._details((c.chain || key) + ' quote samples and limitations',
                '<p class="text-sm">' + esc(depth.basis || 'Resolution not established') + '</p>' +
                '<p class="text-xs">' + esc(recommendation.display_basis || 'Significance not established') + '</p>' +
                '<div class="data-table-scroll"><table class="data-table"><thead><tr><th>Dated NAV size</th><th>Output</th><th>Added average-rate cost</th><th>Return vs NAV</th><th>Provider gas USD</th><th>Receipt clock</th></tr></thead><tbody>' + rungs + '</tbody></table></div>' +
                '<p class="text-xs">Minimum output: ' + esc(c.minimum_out == null ? 'not established' : c.minimum_out) +
                '; expiry: ' + esc(c.quote_expiry || 'not supplied') + '. Gas is separate; no execution or settlement is established.</p>');
        });
        return '<div class="panel"><div class="panel-title">Chain-specific liquidity — DexTracker</div>' +
            '<p class="text-sm">Primary coverage follows DexTracker’s measured significance recommendation. Observed samples are not capacity limits; chain depths are not additive.</p>' +
            '<div class="data-table-scroll"><table class="data-table"><thead><tr><th>Chain</th><th>50 bps size impact</th><th>Status / resolution</th><th>Quote clock</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
            '<p class="text-sm text-amber-700 mt-2">Sparse or failed samples leave gaps. An unavailable route is not zero liquidity. Output stablecoins are valued nominally at $1.</p>' +
            (contextRows ? UsdaiRenderer._details('Other reviewed chains — limited or unestablished', '<div class="data-table-scroll"><table class="data-table"><thead><tr><th>Chain</th><th>Observed sample</th><th>Limitation</th><th>Quote clock</th></tr></thead><tbody>' + contextRows + '</tbody></table></div>') : '') +
            '<p class="text-xs text-slate-500 mt-2">Denomination: ' + esc((d.nav_denomination || {}).basis || 'not supplied') +
            '. Original NAV clock: ' + esc((d.nav_denomination || {}).source_as_of || 'unknown') + '. Smallest-rung spread and gas are not included in added size impact.</p>' + details + '</div>';
    },

    // Collapse supporting prose intact, while warnings, limits, active authority
    // and compact tables stay visible. This is scoped to these two dashboards.
    _compactEvidence: function() {
        if (!document.querySelectorAll) return;
        document.querySelectorAll('.axis-section .text-xs, .axis-section p').forEach(function(el) {
            if (el.closest('details, table, summary, .risk-flag, .axis-head')) return;
            if (el.children.length || (el.textContent || '').trim().length <= 240) return;
            if (/not established|unmeasured|unresolved|stale|no delay|not verified|denominator|not independently/i.test(el.textContent)) return;
            var details = document.createElement('details'), summary = document.createElement('summary');
            summary.textContent = 'Source and method';
            summary.className = 'cursor-pointer text-xs text-slate-500';
            el.parentNode.insertBefore(details, el); details.appendChild(summary); details.appendChild(el);
        });
    },

    _suppressCommonPanels: function(data) {
        // #summary-cards carries the 5-axis BAND once the analyzer emits the axis
        // blocks. Hiding it unconditionally would remove the entire point of the
        // migration the moment PegTracker starts emitting — silently, because the
        // band would simply never appear and nothing would error. Keep it whenever
        // the blocks are present; hide it only in the pre-migration state, where it
        // holds generic stablecoin cards that do not fit these two assets.
        var hasAxes = (typeof CommonRenderer !== 'undefined' &&
                       typeof CommonRenderer.hasAxisBlocks === 'function' &&
                       CommonRenderer.hasAxisBlocks(data));
        // Set both ways explicitly rather than only hiding. Leaving the visible case
        // to "don't touch it" makes the band's appearance depend on nothing else
        // having hidden it first, which is a call-ordering assumption that would
        // fail quietly the day it stops holding.
        var summaryCards = document.getElementById('summary-cards');
        if (summaryCards) summaryCards.style.display = hasAxes ? '' : 'none';

        ['peg', 'backing', 'liquidity', 'dependencies', 'contract', 'issuer'].forEach(function(axis) {
            var section = document.getElementById('section-' + axis);
            if (section) { section.style.display = ''; section.classList.remove('hidden'); }
            var extra = document.getElementById(axis + '-extra-panels');
            if (extra) extra.innerHTML = '';
        });

        var chartPanel = document.getElementById('chart-panel');
        if (chartPanel) {
            chartPanel.style.display = data.asset_slug === 'usdai' ? '' : 'none';
            var title = chartPanel.querySelector('.panel-title');
            if (title && data.asset_slug === 'usdai') title.textContent = 'Reported reserve coverage history';
        }

        var bd = document.getElementById('breakdown-table');
        if (bd) { var p = bd.closest('.panel'); if (p) p.style.display = 'none'; }
        var pie = document.getElementById('pie-chart');
        if (pie) { var p2 = pie.closest('.panel'); if (p2) p2.style.display = 'none'; }

        // Risk flags: hide the "No risk flags" placeholder; stretch when real.
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

    _setupAnchorNav: function(slug) {
        var navEl = document.getElementById('asset-anchor-nav');
        var inner = document.getElementById('asset-anchor-nav-inner');
        if (!navEl || !inner) return;

        var items = [
            {id:'section-peg', label:'Peg / NAV'}, {id:'section-backing', label:'Backing'},
            {id:'section-liquidity', label:'Liquidity & exit'}, {id:'section-dependencies', label:'Dependencies'},
            {id:'section-contract', label:'Contract & admin'}, {id:'section-issuer', label:'Issuer'}
        ];

        inner.innerHTML = items.map(function(item) {
            return '<a href="#' + item.id + '" ' +
                   'class="text-slate-600 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400 ' +
                   'px-2 py-0.5 rounded transition-colors">' +
                   item.label +
                   '</a>';
        }).join('');
        navEl.classList.remove('hidden');
    },

    _setupCompanionLink: function(slug) {
        var link = document.getElementById('header-companion-link');
        if (!link) return;
        var sibling, label;
        if (slug === 'usdai')       { sibling = 'susdai'; label = 'View sUSDai ↗'; }
        else if (slug === 'susdai') { sibling = 'usdai';  label = 'View USDai ↗'; }
        else return;
        link.setAttribute('href', '?asset=' + sibling);
        link.textContent = label;
        link.classList.remove('hidden');
    },

    // ============================================================
    // §1 Headline card
    // ============================================================
    _renderHeadlineCard: function(specific, s, slug) {
        var pausedState = s.paused === true ? 'critical' : s.paused === false ? 'ok' : 'unknown';
        var pausedLabel = s.paused === true ? 'PAUSED' : s.paused === false ? 'Unpaused (measured)' : 'Pause state unknown';
        var chainBadge =
            '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">Arbitrum</span>';

        var headerLeft, metricsRow, badgeRow;

        if (slug === 'usdai') {
            headerLeft =
                '<div class="text-xl font-bold text-slate-800">USDai</div>' +
                '<div class="text-xs text-slate-500 mt-1">USD.AI · PYUSD reserve measurement; issuer obligations and migration status remain separate</div>';

            var covState = UsdaiRenderer._coverageState(s.coverage_ratio);
            var covCls = UsdaiRenderer._stateTextCls(covState);
            var covTxt = (s.coverage_ratio != null) ? (s.coverage_ratio * 100).toFixed(2) + '%' : '—';
            var pegState = UsdaiRenderer._pegStatusClass(s.peg_deviation_pct);
            var pegCls   = UsdaiRenderer._pegPctClass(pegState);
            var buffer = (s.pyusd_reserve_usd != null && s.supply_usd != null) ? (s.pyusd_reserve_usd - s.supply_usd) : null;

            // BASIS WARNING. The feed's own comment on asset_specific.peg_leg reads
            // "Arbitrum-only denominator": coverage is PYUSD reserve over ARBITRUM
            // totalSupply, while the reserve backs supply on every chain. So the
            // implied buffer is not a cushion — it is the supply on the chains the
            // denominator leaves out, counted on one side of the ratio and not the
            // other. Rendering it as a green "+" reads as spare capacity.
            //
            // The payload carries no per-chain supply, so a corrected ratio cannot
            // be computed here and is NOT invented — hardcoding the off-chain total
            // would be a constant that goes stale on the next mint. State the basis
            // instead, from the feed's own declaration, and let the number stand as
            // what it is. Remove this once the feed publishes supply_by_chain or a
            // summed denominator.
            var basisNote = UsdaiRenderer._arbitrumOnlyBasis(specific);

            metricsRow =
                '<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">' +
                    '<div><div class="text-xs text-slate-400 font-medium uppercase">Supply</div>' +
                        '<div class="text-lg font-bold text-slate-800">' + CommonRenderer.formatCurrency(s.supply_usd) + '</div>' +
                        (basisNote ? '<div class="text-xs text-slate-500 mt-0.5">Arbitrum only</div>' : '') +
                    '</div>' +
                    '<div><div class="text-xs text-slate-400 font-medium uppercase">Coverage</div>' +
                        '<div class="text-lg font-bold ' + covCls + '">' + covTxt + '</div>' +
                        (buffer != null ?
                            '<div class="text-xs text-slate-500 mt-0.5">Implied: <span class="font-mono ' +
                                (basisNote ? 'text-amber-700 dark:text-amber-300' : 'text-green-600') + '">+' +
                                UsdaiRenderer._usdShort(buffer) + '</span></div>' : '') +
                    '</div>' +
                    '<div><div class="text-xs text-slate-400 font-medium uppercase">Peg vs $1</div>' +
                        '<div class="text-lg font-bold text-slate-800">' +
                            (s.peg_secondary_px != null ? '$' + s.peg_secondary_px.toFixed(4) : '—') +
                        '</div>' +
                        '<div class="text-xs ' + pegCls + ' mt-0.5 font-mono">' +
                            UsdaiRenderer._pegPctText(s.peg_deviation_pct, 3) +
                        '</div>' +
                    '</div>' +
                    '<div><div class="text-xs text-slate-400 font-medium uppercase">Status</div>' +
                        '<div class="text-lg">' + UsdaiRenderer._statusPill(pausedLabel, pausedState) + '</div></div>' +
                '</div>';

            var baseOk = (s.base_token || '').toLowerCase() === USDAI_ADDRS.PYUSD.toLowerCase();
            badgeRow =
                '<div class="flex flex-wrap items-center gap-2 mt-3">' +
                    UsdaiRenderer._onChainVerifiableBadge(true) +
                    UsdaiRenderer._statusPill('baseToken = PYUSD' + (baseOk ? ' ✓' : ''), baseOk ? 'ok' : 'warn') +
                '</div>' +
                (basisNote ?
                '<div class="text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 ' +
                    'border border-amber-200 dark:border-amber-800 rounded p-2 mt-3">' +
                    '<span class="font-semibold">Coverage denominator is Arbitrum-only.</span> ' +
                    'Per this feed\u2019s own note, coverage is the PYUSD reserve over <em>Arbitrum</em> ' +
                    'totalSupply \u2014 but the same reserve backs USDai minted on other chains too. ' +
                    'The implied surplus above is therefore not established headroom: supply on the ' +
                    'excluded chains sits in the numerator\u2019s backing while being left out of the ' +
                    'denominator. Treat coverage above 100% here as a property of the basis until the ' +
                    'feed publishes per-chain supply. The two on-chain reads themselves are sound \u2014 ' +
                    'it is the denominator\u2019s scope, not the measurement, that is narrow.' +
                '</div>' : '');
        } else {
            // sUSDai
            headerLeft =
                '<div class="text-xl font-bold text-slate-800">sUSDai</div>' +
                '<div class="text-xs text-slate-500 mt-1">USD.AI · asynchronous vault over USDai — GPU/equipment loan book (MetaStreet engine)</div>';

            var nav = UsdaiRenderer._susdaiNavBasis(s);
            var d = UsdaiRenderer._navDevDisplay(nav, s.peg_secondary_px, s.discount_to_nav_pct);
            var dState = UsdaiRenderer._navDevState(d);
            var dCls = UsdaiRenderer._stateTextCls(dState);
            var dWord = UsdaiRenderer._navDevWord(d);

            metricsRow =
                '<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">' +
                    '<div><div class="text-xs text-slate-400 font-medium uppercase">Total Assets</div>' +
                        '<div class="text-lg font-bold text-slate-800">' + CommonRenderer.formatCurrency(s.total_assets_usd) + '</div>' +
                        '<div class="text-xs text-slate-500 mt-0.5">USDai-denominated</div></div>' +
                    '<div><div class="text-xs text-slate-400 font-medium uppercase">NAV per share (' +
                        (UsdaiRenderer._susdaiNavBasisSource(s) === 'redemptionSharePrice()' ? 'redemption' : 'deposit fallback') + ')</div>' +
                        '<div class="text-lg font-bold text-slate-800">' + (nav != null ? nav.toFixed(6) : '—') + '</div>' +
                        '<div class="text-xs text-slate-500 mt-0.5 font-mono">' + UsdaiRenderer._susdaiNavBasisSource(s) + '</div></div>' +
                    '<div><div class="text-xs text-slate-400 font-medium uppercase">Price vs NAV</div>' +
                        '<div class="text-lg font-bold ' + dCls + '">' + UsdaiRenderer._pegPctText(d, 3) + '</div>' +
                        '<div class="text-xs text-slate-500 mt-0.5">' + dWord + '</div></div>' +
                    '<div><div class="text-xs text-slate-400 font-medium uppercase">Status</div>' +
                        '<div class="text-lg">' + UsdaiRenderer._statusPill(pausedLabel, pausedState) + '</div></div>' +
                '</div>' +
                // The feed publishes share_supply (arbitrum totalSupply, explicitly scoped
                // by share_supply_scope) alongside total_shares, and NAV is correctly built
                // on total_shares. But a reader seeing only the Arbitrum number would be
                // looking at roughly two thirds of the claims on this vault. Surface the
                // split — this is the same one-chain-denominator shape as USDai's coverage,
                // one layer up, except here the analyzer already reads the full figure.
                ((s.total_shares != null && s.share_supply != null && s.total_shares > 0) ?
                    (function() {
                        // Use the published field. Deriving total_shares - share_supply
                        // silently folds in pending_redemption_shares and overstated
                        // this by exactly the queue (234,493.61 when first shipped).
                        var bridged = (s.bridged_supply != null)
                            ? s.bridged_supply
                            : (s.total_shares - s.share_supply);
                        var pct = (s.bridged_share_pct != null)
                            ? s.bridged_share_pct : (bridged / s.total_shares * 100);
                        return '<div class="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 ' +
                            'dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded p-2 mt-3">' +
                            '<span class="font-mono font-semibold">' + pct.toFixed(1) + '%</span> of sUSDai claims ' +
                            'sit off Arbitrum (<span class="font-mono">' + CommonRenderer.formatCurrency(bridged) +
                            '</span> of <span class="font-mono">' + CommonRenderer.formatCurrency(s.total_shares) +
                            '</span> shares). NAV above is computed on <em>all</em> shares' +
                            (s.share_supply_scope ? ', not the <span class="font-mono">' +
                                UsdaiRenderer._esc(s.share_supply_scope) + '</span> figure' : '') + '.' +
                        '</div>';
                    })() : '');

            var reconState = UsdaiRenderer._reconState(s.recon_residual_pct);
            var reconTxt = (s.recon_residual_pct != null) ? (s.recon_residual_pct * 100).toFixed(2) + '%' : '—';
            var bufState = UsdaiRenderer._bufferState(s.buffer_ratio);
            var bufTxt = (s.buffer_ratio != null) ? (s.buffer_ratio * 100).toFixed(1) + '%' : '—';

            // The recon flag and the claims tie measure DIFFERENT things, and only
            // the failing one was rendered. recon_residual_pct is loan attribution
            // against the issuer's figure; claims_tie_residual is share accounting —
            // total_shares x deposit_share_price against total_assets. The shares tie
            // to a few dollars on $359M. Showing the drift alone lets a reader
            // conclude the vault's books are broken, which is a wrong impression
            // assembled from two correct numbers.
            var tieUsd = s.claims_tie_residual_usd;
            var tiePct = s.claims_tie_residual_pct;
            var tiePill = '';
            if (tieUsd != null) {
                // Dollar amount only. The normalised form is ~1e-6, which renders as
                // "2.2e-4%" and reads as noise; the prose below states the tie plainly.
                tiePill = UsdaiRenderer._statusPill('Claims tie', 'ok',
                    UsdaiRenderer._usdShort(Math.abs(tieUsd)));
            }
            // Exit haircut as one number. nav_per_share IS deposit_share_price, so
            // the headline NAV is the ENTRY price and exits settle lower. Rendered
            // from the published field rather than recomputed: the analyzer takes
            // the spread on the redemption-price base (0.6506%), and differencing
            // the two displayed prices gives 0.6464% — a number that would not
            // match the feed.
            var spreadPill = (s.share_price_spread_pct != null)
                ? UsdaiRenderer._statusPill('Exit spread', 'warn',
                    s.share_price_spread_pct.toFixed(2) + '%')
                : '';
            // Redemption queue DEPTH. Explicitly not a wait time: no epoch or
            // notice-period getter exists in the implementation, and the commonly
            // quoted cadence is documented rather than measured. Do not infer one.
            var queuePill = '';
            if (s.pending_redemption_shares != null && s.total_shares) {
                var qPct = s.pending_redemption_shares / s.total_shares * 100;
                queuePill = UsdaiRenderer._statusPill('Redemption queue',
                    qPct >= 5 ? 'warn' : 'ok',
                    Math.round(s.pending_redemption_shares).toLocaleString('en-US') +
                        ' sh \u00b7 ' + qPct.toFixed(3) + '%');
            }

            badgeRow =
                '<div class="flex flex-wrap items-center gap-2 mt-3">' +
                    UsdaiRenderer._statusPill('Reconciliation Δ', reconState, reconTxt) +
                    tiePill +
                    UsdaiRenderer._statusPill('Idle buffer', bufState, bufTxt) +
                    spreadPill +
                    queuePill +
                '</div>' +
                ((tieUsd != null) ?
                '<div class="text-xs text-slate-600 dark:text-slate-300 mt-2">' +
                    '<span class="font-semibold">Two residuals, two different books.</span> ' +
                    '\u201cRecon\u201d is loan attribution against the issuer\u2019s figure; ' +
                    '\u201cClaims tie\u201d is share accounting \u2014 total shares \u00d7 deposit price ' +
                    'against total assets, closing to <span class="font-mono">' +
                    UsdaiRenderer._usdShort(Math.abs(tieUsd)) + '</span> on <span class="font-mono">' +
                    UsdaiRenderer._usdShort(s.total_assets_usd) + '</span>. A drift in the first is not ' +
                    'evidence the share ledger is wrong.' +
                '</div>' : '') +
                ((s.pending_redemption_shares != null) ?
                '<div class="text-xs text-slate-500 mt-1">' +
                    'Queue figure is <em>depth</em>, not wait time \u2014 no epoch or notice-period ' +
                    'getter exists on the implementation, so the cadence is not measurable from chain.' +
                '</div>' : '');
        }

        return '<div class="panel">' +
            '<div class="flex items-start justify-between gap-4">' +
                '<div>' + headerLeft + '</div>' +
                '<div class="flex flex-wrap gap-1 justify-end">' + chainBadge + '</div>' +
            '</div>' +
            metricsRow +
            badgeRow +
        '</div>';
    },

    // The USD.AI USP — distinct from regular status pills.
    _onChainVerifiableBadge: function(active) {
        if (!active) return '';
        return '<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ' +
            'bg-emerald-50 text-emerald-800 border border-emerald-200" ' +
            'title="USDai coverage is verifiable on-chain via two reads: PYUSD.balanceOf(USDai) / USDai.totalSupply(). No oracle. See verification commands below.">' +
            '<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">' +
                '<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />' +
            '</svg>' +
            '100% On-Chain Verifiable' +
        '</span>';
    },

    // ============================================================
    // §2u USDai Coverage (USDai only) — the marquee panel
    // ============================================================
    _renderUsdaiCoverage: function(specific, s) {
        var arbOnly = UsdaiRenderer._arbitrumOnlyBasis(specific);
        var cov = s.coverage_ratio;
        var covState = UsdaiRenderer._coverageState(cov);
        var covCls = UsdaiRenderer._stateTextCls(covState);
        var covPct = (cov != null) ? cov * 100 : null;

        var supply = s.supply_usd || 0;
        var reserve = s.pyusd_reserve_usd || 0;
        // Two comparison bars: supply = 100% baseline, reserve = coverage%.
        var reserveWidth = (supply > 0) ? Math.min((reserve / supply) * 100, 130) : 0;

        var bars =
            '<div class="mt-4 space-y-3">' +
                '<div>' +
                    '<div class="flex justify-between text-xs text-slate-500 mb-1">' +
                        '<span>USDai supply (the claim)' +
                            (arbOnly ? ' \u2014 <strong>Arbitrum only</strong>' : '') + '</span>' +
                        '<span class="font-mono">' + CommonRenderer.formatCurrencyExact(supply) + '</span>' +
                    '</div>' +
                    '<div class="pct-bar-container" style="height:1.5rem;">' +
                        '<div class="pct-bar" style="width:100%;background:#94a3b8;height:1.5rem;"></div>' +
                    '</div>' +
                '</div>' +
                '<div>' +
                    '<div class="flex justify-between text-xs text-slate-500 mb-1">' +
                        '<span>PYUSD held by USDai contract (the reserve)</span>' +
                        '<span class="font-mono">' + CommonRenderer.formatCurrencyExact(reserve) + '</span>' +
                    '</div>' +
                    '<div class="pct-bar-container" style="height:1.5rem;">' +
                        '<div class="pct-bar" style="width:' + reserveWidth + '%;background:' + USDAI_COLORS.PYUSD + ';height:1.5rem;"></div>' +
                    '</div>' +
                '</div>' +
            '</div>';

        var coverageTile =
            '<div class="flex flex-col items-center justify-center text-center px-4">' +
                '<div class="text-xs text-slate-400 font-medium uppercase">Coverage</div>' +
                '<div class="text-4xl font-bold ' + covCls + ' leading-none mt-1">' +
                    (covPct != null ? covPct.toFixed(2) + '%' : '—') +
                '</div>' +
                // On an Arbitrum-only denominator "Over-collateralized" is a claim about
                // the basis, not about the token. Neither green (over-collateralized) nor
                // amber (thin) is established, so say what IS known — the basis — in a
                // neutral pill. Absence of a verified surplus is not evidence of a deficit.
                '<div class="mt-2">' + (arbOnly
                    ? UsdaiRenderer._statusPill('Arbitrum-basis only', 'unknown')
                    : UsdaiRenderer._statusPill(UsdaiRenderer._coverageLabel(cov), covState)) + '</div>' +
                '<div class="text-xs text-slate-400 mt-2">PYUSD reserve \u00f7 ' +
                    (arbOnly ? 'Arbitrum ' : '') + 'USDai supply</div>' +
            '</div>';

        var grid =
            '<div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">' +
                '<div class="md:col-span-2">' + bars + '</div>' +
                coverageTile +
            '</div>';

        // api.usd.ai cross-check chip
        var apiRes = s.api_stablecoin_reserves_usd;
        var div = s.api_divergence_pct;
        var divState = UsdaiRenderer._divergenceState(div);
        var basisCaveat = arbOnly ?
            '<div class="text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 ' +
                'border border-amber-200 dark:border-amber-800 rounded p-2 mt-4">' +
                '<span class="font-semibold">The denominator is Arbitrum supply, the reserve is not.</span> ' +
                'Per this feed\u2019s own note the ratio is PYUSD reserve \u00f7 <em>Arbitrum</em> totalSupply, ' +
                'while the same reserve backs USDai minted on other chains. Supply on those chains is ' +
                'inside what the reserve covers but outside what it is divided by, so any excess shown ' +
                'here is a property of the basis rather than measured headroom. The two on-chain reads ' +
                'and the api.usd.ai cross-check below are unaffected \u2014 it is the denominator\u2019s ' +
                'scope that is narrow, not the measurement.' +
            '</div>' : '';

        if (basisCaveat) basisCaveat = '<p class="text-sm text-amber-700 mt-3">Arbitrum-only supply denominator: any excess is not verified global reserve headroom.</p>' + UsdaiRenderer._details('Coverage perimeter and denominator', basisCaveat);

        var crossCheck = (apiRes != null) ?
            '<div class="mt-4 flex flex-wrap items-center gap-2 text-xs">' +
                '<span class="text-slate-500">Cross-check (api.usd.ai):</span>' +
                '<span class="font-mono text-slate-700">on-chain ' + UsdaiRenderer._usdShort(reserve) +
                    ' vs reported ' + UsdaiRenderer._usdShort(apiRes) + '</span>' +
                UsdaiRenderer._statusPill('Δ ' + (div != null ? UsdaiRenderer._pegPctText(div, 2) : '—'), divState) +
            '</div>' : '';

        var verifyBlock = UsdaiRenderer._renderVerifyCommands();

        var methodology =
            '<div class="text-xs text-slate-500 italic leading-relaxed mt-4 pt-3 border-t border-slate-200">' +
                'Reserve is PYUSD held directly in the USDai contract — every dollar readable on-chain via ' +
                '<span class="font-mono">balanceOf</span>, no oracle. PYUSD is itself a Paxos-issued, NYDFS-regulated, ' +
                'T-Bill/cash-backed stablecoin with monthly attestations. <strong>On-chain verification stops at PYUSD:</strong> ' +
                'PYUSD\'s own reserves are a separate trust layer, and the reserve sits in an upgradeable contract — ' +
                '"the PYUSD is here now" is a real-time fact, not a trustless guarantee against a future privileged ' +
                'withdrawal (which is exactly what the 48h timelock below makes visible in advance).' +
            '</div>';

        return '<div class="panel">' +
            '<div class="flex items-center justify-between">' +
                '<div class="panel-title" style="margin-bottom:0;">PYUSD Coverage</div>' +
                UsdaiRenderer._onChainVerifiableBadge(true) +
            '</div>' +
            '<div style="margin-bottom:0.5rem;"></div>' +
            grid +
            basisCaveat +
            crossCheck +
            verifyBlock +
            UsdaiRenderer._details('Reserve measurement method', methodology) +
        '</div>';
    },

    _renderVerifyCommands: function() {
        var cmds =
            '# 1. USDai supply (18 decimals)\n' +
            'cast call ' + USDAI_ADDRS.USDAI + ' "totalSupply()(uint256)" \\\n' +
            '     --rpc-url $ARB_RPC\n\n' +
            '# 2. PYUSD held by the USDai contract (6 decimals)\n' +
            'cast call ' + USDAI_ADDRS.PYUSD + ' \\\n' +
            '     "balanceOf(address)(uint256)" \\\n' +
            '     ' + USDAI_ADDRS.USDAI + ' \\\n' +
            '     --rpc-url $ARB_RPC\n\n' +
            '# coverage = (PYUSD / 1e6) / (supply / 1e18)\n' +
            '#   note the decimals differ: PYUSD 6dp, USDai 18dp.';

        return '<details class="mt-4 group">' +
            '<summary class="cursor-pointer text-sm font-semibold text-emerald-700 hover:text-emerald-900 select-none" ' +
                'style="list-style:none;">' +
                '<span class="inline-block transform group-open:rotate-90 transition-transform">▶</span> ' +
                'Show verification commands' +
            '</summary>' +
            '<div class="mt-2 relative">' +
                '<button onclick="UsdaiRenderer._copyVerify(this)" ' +
                    'class="absolute top-2 right-2 px-2 py-0.5 text-xs rounded bg-slate-700 text-slate-100 hover:bg-slate-600 transition-colors">' +
                    'Copy' +
                '</button>' +
                '<pre id="usdai-verify-cmds" class="text-xs bg-slate-900 text-slate-100 p-3 pr-16 rounded overflow-x-auto font-mono leading-relaxed">' +
                    cmds +
                '</pre>' +
                '<div class="text-xs text-slate-400 italic mt-2">' +
                    'Set <span class="font-mono">$ARB_RPC</span> to any Arbitrum mainnet endpoint. ' +
                    'You should get the same coverage shown above (within block-timing tolerance).' +
                '</div>' +
            '</div>' +
        '</details>';
    },

    _copyVerify: function(btn) {
        var pre = document.getElementById('usdai-verify-cmds');
        if (!pre) return;
        var text = pre.textContent || pre.innerText;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function() {
                var orig = btn.textContent;
                btn.textContent = 'Copied!';
                setTimeout(function() { btn.textContent = orig; }, 1500);
            });
        }
    },

    // ============================================================
    // §2s sUSDai Decomposition (sUSDai only) — the hero panel
    // ============================================================
    _renderSusdaiDecomposition: function(specific, s) {
        var d = specific.decomposition || {};
        var total = d.total_assets_usd || s.total_assets_usd || 0;
        var segs = [
            { key: 'idle_usdai', label: 'Idle USDai', value: d.idle_usdai_usd, color: USDAI_COLORS.IDLE_USDAI, tag: 'on-chain' },
            { key: 'idle_pyusd', label: 'Idle PYUSD', value: d.idle_pyusd_usd, color: USDAI_COLORS.IDLE_PYUSD, tag: 'on-chain' },
            { key: 'escrow',     label: 'DepositTimelock escrow', value: d.deposit_timelock_escrow_usd, color: USDAI_COLORS.ESCROW, tag: 'committed-undrawn' },
            { key: 'drawn',      label: 'Drawn GPU loans', value: d.implied_deployed_loans_usd, color: USDAI_COLORS.DRAWN, tag: 'live credit' }
        ].filter(function(x) { return x.value != null && x.value > 0; });

        var reconState = UsdaiRenderer._reconState(d.recon_residual_pct);
        var reconTxt = (d.recon_residual_pct != null) ? (d.recon_residual_pct * 100).toFixed(2) + '%' : '—';

        // Stacked bar — segments proportional to totalAssets; tiny slices keep a
        // minimum visible width.
        var barSegs = segs.map(function(x) {
            var pct = total > 0 ? (x.value / total * 100) : 0;
            return '<div title="' + x.label + ': ' + CommonRenderer.formatCurrencyExact(x.value) + ' (' + pct.toFixed(1) + '%)" ' +
                'style="width:' + pct + '%;min-width:3px;background:' + x.color + ';height:2.5rem;"></div>';
        }).join('');
        var bar =
            '<div class="flex w-full rounded overflow-hidden mt-4" style="height:2.5rem;border:1px solid #e2e8f0;">' +
                barSegs +
            '</div>';

        // Legend
        var legend =
            '<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">' +
                segs.map(function(x) {
                    var pct = total > 0 ? (x.value / total * 100) : 0;
                    return '<div class="text-xs">' +
                        '<div class="flex items-center gap-1.5">' +
                            '<span class="inline-block w-2.5 h-2.5 rounded-sm" style="background:' + x.color + '"></span>' +
                            '<span class="font-medium text-slate-700">' + x.label + '</span>' +
                        '</div>' +
                        '<div class="font-mono text-slate-800 mt-0.5">' + CommonRenderer.formatCurrency(x.value) + '</div>' +
                        '<div class="text-slate-400">' + pct.toFixed(1) + '% · ' + x.tag + '</div>' +
                    '</div>';
                }).join('') +
            '</div>';

        // Credit pipeline summary
        var cp = d.credit_pipeline || {};
        var pipeline =
            '<div class="mt-5 rounded-lg p-4" style="background:#fff7ed;border:1px solid #fed7aa;">' +
                '<div class="text-sm font-semibold text-slate-800 mb-1">Credit pipeline</div>' +
                '<div class="text-sm text-slate-700">' +
                    '<span class="font-mono">' + UsdaiRenderer._usdShort(cp.drawn_usd) + '</span> drawn' +
                    ' &nbsp;+&nbsp; ' +
                    '<span class="font-mono">' + UsdaiRenderer._usdShort(cp.committed_undrawn_usd) + '</span> committed-undrawn' +
                    ' &nbsp;=&nbsp; ' +
                    '<span class="font-mono font-bold text-orange-700">' + UsdaiRenderer._usdShort(cp.total_loan_destined_usd) + '</span> loan-destined' +
                '</div>' +
                '<div class="text-xs text-slate-500 mt-1">' +
                    'Credit exposure is larger than the drawn-loan headline — escrow converts to live credit as borrowers draw.' +
                '</div>' +
            '</div>';

        // Cross-check vs api loansReserves
        var apiLoans = d.api_loans_reserves_usd;
        var crossCheck = (apiLoans != null) ?
            '<div class="mt-3 flex flex-wrap items-center gap-2 text-xs">' +
                '<span class="text-slate-500">Cross-check:</span>' +
                '<span class="font-mono text-slate-700">implied drawn ' + UsdaiRenderer._usdShort(d.implied_deployed_loans_usd) +
                    ' ≈ api loansReserves ' + UsdaiRenderer._usdShort(apiLoans) + '</span>' +
                UsdaiRenderer._statusPill('Recon Δ ' + reconTxt, reconState) +
            '</div>' : '';

        var escrowNote =
            '<div class="text-xs text-slate-500 italic leading-relaxed mt-4 pt-3 border-t border-slate-200">' +
                'ⓘ The <strong>DepositTimelock escrow</strong> is USDai committed to loans but awaiting borrower draw — ' +
                'returnable if a loan does not draw, and converting to live GPU-loan credit as borrowers draw down. It is ' +
                'the line that previously read as an unexplained balance; <span class="font-mono">totalAssets</span> now ' +
                'reconciles on-chain to within ' + reconTxt + '. Verify the escrow directly: ' +
                '<span class="font-mono">PYUSD/USDai balanceOf(' + UsdaiRenderer._truncAddr(USDAI_ADDRS.DEPOSIT_TIMELOCK) + ')</span> ' +
                UsdaiRenderer._explorerLink(USDAI_ADDRS.DEPOSIT_TIMELOCK) + '. ' +
                'NAV per share (deposit) = <span class="font-mono">convertToAssets(1e18)</span>; ' +
                'the exit-relevant NAV (redemption) uses <span class="font-mono">redemptionSharePrice()</span>; ' +
                '1 sUSDai ≠ $1 by design.' +
            '</div>';

        return '<div class="panel">' +
            '<div class="flex items-center justify-between flex-wrap gap-2">' +
                '<div class="panel-title" style="margin-bottom:0;">Asset Decomposition' +
                    ' <span class="text-xs font-normal text-slate-500">— totalAssets ' + UsdaiRenderer._usdShort(total) + '</span>' +
                '</div>' +
                UsdaiRenderer._statusPill('Reconciliation Δ', reconState, reconTxt) +
            '</div>' +
            bar +
            legend +
            pipeline +
            crossCheck +
            '<p class="text-sm mt-3">Loan values are reported credit marks; independent recoverability is unverified. Committed-undrawn escrow is not free redemption cash.</p>' +
            UsdaiRenderer._details('Escrow and NAV accounting method', escrowNote) +
        '</div>';
    },

    // ============================================================
    // §3s sUSDai NAV Trajectory (sUSDai only)
    // ============================================================
    _renderSusdaiNav: function(specific, s) {
        var statCards =
            '<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">' +
                '<div class="summary-card"><div class="card-label">NAV per share (deposit)</div>' +
                    '<div class="card-value">' + (s.nav_per_share != null ? s.nav_per_share.toFixed(6) : '—') + '</div>' +
                    '<div class="text-xs text-slate-400 mt-1 font-mono">convertToAssets(1e18)</div></div>' +
                '<div class="summary-card"><div class="card-label">Realized APY (7d)</div>' +
                    '<div class="card-value" id="usdai-apy-7d">—</div>' +
                    '<div class="text-xs text-slate-400 mt-1">from NAV history</div></div>' +
                '<div class="summary-card"><div class="card-label">Realized APY (30d)</div>' +
                    '<div class="card-value" id="usdai-apy-30d">—</div>' +
                    '<div class="text-xs text-slate-400 mt-1">from NAV history</div></div>' +
                '<div class="summary-card"><div class="card-label">Protocol target</div>' +
                    '<div class="card-value text-base">10–15%</div>' +
                    '<div class="text-xs text-slate-400 mt-1">loan-tier, disclosed — not a guarantee</div></div>' +
            '</div>';

        // The standalone NAV-per-share chart is gone: it plotted the band's UPPER
        // EDGE, so alongside the §1 band chart it was the same picture drawn twice
        // — and the band carries the accrual in its slope plus the exit haircut in
        // its width, which this could not show. The APY cards below still populate:
        // _loadNavChart calls _fillApyCards before it looks for the canvas, so
        // removing the canvas costs the chart and nothing else.
        var chartBlock =
            '<div class="text-xs text-slate-500 mt-4">' +
                'NAV per share over time is the upper edge of the ' +
                '<a href="#panel-peg-chart" class="text-blue-500 hover:underline">NAV band chart</a> above.' +
            '</div>';

        var methodology = '<p class="text-xs text-slate-500">Share-price history measures reported NAV changes, not independently realized holder returns. Fees, losses and valuation updates can affect it; cash settlement remains separate.</p>';

        return '<div class="panel">' +
            '<div class="panel-title">NAV Trajectory <span class="text-xs font-normal text-slate-500">— yield landing</span></div>' +
            statCards +
            chartBlock +
            UsdaiRenderer._details('Reserve measurement method', methodology) +
        '</div>';
    },

    // ---- §1 peg/deviation chart ----
    //
    // Deliberately plots DEVIATION against zero rather than price against a NAV
    // reference line. common.js::_renderPegChart draws peg.nav as that line,
    // which is right for a $1 claim and wrong for sUSDai: it has two NAVs 0.65%
    // apart by design (redemption / deposit) with the market between them, so a
    // single NAV line would render construction as error. Deviation-vs-zero is
    // correct for both — usdai's peg_deviation_pct against $1, susdai's
    // band_deviation_pct against the band, which reads zero while inside it.
    //
    // The series and field are taken from peg.history_ref / peg.history_field
    // rather than hardcoded, so a change of basis upstream moves the chart with
    // it.
    //
    // CORRECTION to an earlier version of this comment: it claimed the history
    // stores the discounts but not the raw share prices, so older rows could not
    // be recomputed. That was wrong. nav_per_share (which IS deposit_share_price),
    // redemption_share_price and peg_secondary_px are all present 101/101 —
    // band_deviation_pct alone is 1/101. A backfill is therefore a reconstruction,
    // not a fabrication, and is filed with PegTracker. It is deliberately NOT done
    // client-side: the publisher owns the accounting model, which is the rule the
    // bridged-supply bug established.
    _renderPegChartPanel: function(data, slug) {
        var peg = data.peg || {};
        var isVault = (slug === 'susdai');
        // sUSDai draws the BAND itself — redemption..deposit shaded, market price
        // through it — rather than a deviation line against zero. Deviation-vs-zero
        // needed a caption explaining that zero meant "inside a band" rather than
        // "at par", which is the tell that the picture was wrong: it also collapsed
        // trading ABOVE the band (paying a premium over the exit price) and BELOW it
        // (a real discount to the exit price) into one unsigned magnitude, and about
        // a third of readings are excursions. The band's slope carries the NAV
        // accrual and its width IS the exit haircut, so nothing is lost by merging.
        //
        // Drawn from nav_per_share / redemption_share_price / peg_secondary_px,
        // all 101/101 in history — it does NOT depend on band_deviation_pct, which
        // is the rating input and is still 1/101 pending backfill.
        if (isVault) {
            return '<div class="panel" id="panel-peg-chart">' +
                '<div class="panel-title">NAV band vs market ' +
                    '<span class="text-xs font-normal text-slate-500">\u2014 redemption \u2193 deposit \u2191, market through it</span></div>' +
                '<div style="height: 320px; position: relative;"><canvas id="usdai-peg-chart"></canvas></div>' +
                '<div class="text-xs text-slate-500 mt-2">The shaded band runs from the redemption price ' +
                'to the deposit price; its <em>width</em> is the exit haircut and its <em>slope</em> is NAV ' +
                'accrual. Price inside the band is the normal state \u2014 above it is a premium to the exit ' +
                'price, below it a discount.</div>' +
            '</div>';
        }
        if (!peg.history_field) return '<p>No peg history is published.</p>';
        return '<div class="panel" id="panel-peg-chart">' +
            '<div class="panel-title">USDai market price vs $1 ' +
                '<span class="text-xs font-normal text-slate-500">\u2014 history</span></div>' +
            '<div style="height: 240px; position: relative;"><canvas id="usdai-peg-chart"></canvas></div>' +
        '</div>';
    },

    _loadPegChart: function(data, slug) {
        var ctx = document.getElementById('usdai-peg-chart');
        if (!ctx) return;
        if (slug === 'susdai') return UsdaiRenderer._loadBandChart(ctx, data, slug);
        var peg = data.peg || {};
        var field = 'peg_secondary_px';
        var ref = peg.history_ref || (slug + '_backing_history.json');
        if (!field) return;
        var nocache = Math.floor(Date.now() / 60000);
        fetch('data/' + ref + '?nocache=' + nocache)
            .then(function(r) { return r.ok ? r.json() : null; })
            .then(function(hist) {
                var entries = (hist && Array.isArray(hist.entries)) ? hist.entries : [];
                var pts = entries.filter(function(e) { return e[field] != null && e.timestamp; })
                    .map(function(e) {
                        var ts = e.timestamp.endsWith('Z') ? e.timestamp : (e.timestamp + 'Z');
                        return { x: new Date(ts).getTime(), y: e[field] };
                    }).sort(function(a, b) { return a.x - b.x; });
                if (typeof Chart === 'undefined' || !pts.length) {
                    ctx.parentElement.innerHTML =
                        '<div class="text-xs text-slate-400 italic">No market-price history is available.</div>';
                    return;
                }
                if (pts.length < 2) {
                    // One sample is a real reading, not a failure — say which.
                    ctx.parentElement.innerHTML =
                        '<div class="text-xs text-slate-500 italic">Series starts today (' +
                        pts.length + ' sample, <span class="font-mono">' +
                        UsdaiRenderer._esc(field) + '</span>). Earlier rows predate this basis and were ' +
                        'not backfilled \u2014 they do not carry the inputs to recompute it.</div>';
                    return;
                }
                UsdaiRenderer._drawPegChart(ctx, pts, slug);
            })
            .catch(function() {
                if (ctx) ctx.parentElement.innerHTML =
                    '<div class="text-xs text-slate-400 italic">Market-price history unavailable.</div>';
            });
    },

    // Band chart: shaded redemption..deposit region with market price through it.
    // Uses three series that are fully populated in history, so it does not wait
    // on the band_deviation_pct backfill.
    _loadBandChart: function(ctx, data, slug) {
        var ref = (data.peg && data.peg.history_ref) || (slug + '_backing_history.json');
        var nocache = Math.floor(Date.now() / 60000);
        fetch('data/' + ref + '?nocache=' + nocache)
            .then(function(r) { return r.ok ? r.json() : null; })
            .then(function(hist) {
                var entries = (hist && Array.isArray(hist.entries)) ? hist.entries : [];
                var rows = entries.filter(function(e) {
                    return e.timestamp && e.nav_per_share != null &&
                           e.redemption_share_price != null && e.peg_secondary_px != null;
                }).map(function(e) {
                    var ts = e.timestamp.endsWith('Z') ? e.timestamp : (e.timestamp + 'Z');
                    var t = new Date(ts).getTime();
                    // nav_per_share IS deposit_share_price (convertToAssets is struck
                    // optimistic); ordering is asserted rather than assumed so an
                    // inversion upstream does not silently draw an inside-out band.
                    var lo = Math.min(e.redemption_share_price, e.nav_per_share);
                    var hi = Math.max(e.redemption_share_price, e.nav_per_share);
                    return { t: t, lo: lo, hi: hi, px: e.peg_secondary_px };
                }).sort(function(a, b) { return a.t - b.t; });

                if (typeof Chart === 'undefined' || rows.length < 2) {
                    ctx.parentElement.innerHTML =
                        '<div class="text-xs text-slate-400 italic">Band history not yet available.</div>';
                    return;
                }
                UsdaiRenderer._drawBandChart(ctx, rows);
            })
            .catch(function() {
                if (ctx) ctx.parentElement.innerHTML =
                    '<div class="text-xs text-slate-400 italic">Band history unavailable.</div>';
            });
    },

    _drawBandChart: function(ctx, rows) {
        if (window._usdaiPegChart) window._usdaiPegChart.destroy();
        var lo = rows.map(function(r) { return { x: r.t, y: r.lo }; });
        var hi = rows.map(function(r) { return { x: r.t, y: r.hi }; });
        var px = rows.map(function(r) { return { x: r.t, y: r.px }; });
        window._usdaiPegChart = new Chart(ctx, {
            type: 'line',
            data: { datasets: [
                // Lower bound drawn first with no fill, upper bound fills DOWN to it
                // (fill: '-1'), which shades the band between them.
                { label: 'Redemption price', data: lo, borderColor: '#94a3b8',
                  borderWidth: 1, pointRadius: 0, fill: false, tension: 0.25 },
                { label: 'Deposit price (NAV)', data: hi, borderColor: '#94a3b8',
                  borderWidth: 1, pointRadius: 0, fill: '-1',
                  backgroundColor: 'rgba(99,102,241,0.16)', tension: 0.25 },
                { label: 'Market price', data: px, borderColor: '#4f46e5',
                  borderWidth: 2, pointRadius: 0, fill: false, tension: 0.25 }
            ] },
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { display: true, labels: { boxWidth: 10, font: { size: 10 } } },
                    tooltip: { callbacks: { label: function(c) {
                        return c.dataset.label + ': ' + c.parsed.y.toFixed(6);
                    } } }
                },
                scales: {
                    x: { type: 'time', time: { unit: 'day' }, grid: { display: false },
                         ticks: { font: { size: 10 } } },
                    y: { ticks: { font: { size: 10 }, callback: function(v) { return v.toFixed(4); } } }
                }
            }
        });
    },

    _drawPegChart: function(ctx, pts, slug) {
        if (window._usdaiPegChart) window._usdaiPegChart.destroy();
        window._usdaiPegChart = new Chart(ctx, {
            type: 'line',
            data: { datasets: [{
                label: 'USDai market price (USD)',
                data: pts,
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99,102,241,0.10)',
                fill: false, tension: 0, pointRadius: 0, borderWidth: 2
            }] },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: function(c) { return '$' + c.parsed.y.toFixed(6); } } },
                    annotation: { annotations: { par: {
                        type: 'line', yMin: 1, yMax: 1,
                        label: { display: true, content: '$1 reference', position: 'end' },
                        borderColor: '#94a3b8', borderWidth: 1, borderDash: [4, 4]
                    } } }
                },
                scales: {
                    x: { type: 'time', time: { unit: 'day' }, grid: { display: false },
                         ticks: { font: { size: 10 } } },
                    y: { ticks: { font: { size: 10 }, callback: function(v) { return '$' + Number(v).toFixed(4); } } }
                }
            }
        });
    },

    _loadNavChart: function(slug) {
        var ctx = document.getElementById('usdai-nav-chart');
        var nocache = Math.floor(Date.now() / 60000);
        fetch('data/' + slug + '_backing_history.json?nocache=' + nocache)
            .then(function(r) { return r.ok ? r.json() : null; })
            .then(function(hist) {
                var entries = (hist && Array.isArray(hist.entries)) ? hist.entries : [];
                UsdaiRenderer._fillApyCards(entries);
                if (!ctx || typeof Chart === 'undefined') return;
                if (entries.length < 2) {
                    ctx.parentElement.innerHTML = '<div class="text-xs text-slate-400 italic">NAV history not yet available — chart populates after a few hours of samples.</div>';
                    return;
                }
                UsdaiRenderer._drawNavChart(ctx, entries);
            })
            .catch(function() {
                if (ctx) ctx.parentElement.innerHTML = '<div class="text-xs text-slate-400 italic">NAV history unavailable.</div>';
            });
    },

    // Annualize the NAV slope over the trailing `days` window. Returns null when
    // the window is too short or NAV hasn't moved enough to be meaningful.
    _realizedApy: function(entries, days) {
        var navd = entries.filter(function(e) { return e.nav_per_share != null; }).map(function(e) {
            var ts = e.timestamp.endsWith('Z') ? e.timestamp : (e.timestamp + 'Z');
            return { t: new Date(ts).getTime(), nav: e.nav_per_share };
        }).sort(function(a, b) { return a.t - b.t; });
        if (navd.length < 2) return null;
        var end = navd[navd.length - 1];
        var cutoff = end.t - days * 24 * 3600 * 1000;
        // First sample at or after the cutoff (the window start).
        var start = null;
        for (var i = 0; i < navd.length; i++) {
            if (navd[i].t >= cutoff) { start = navd[i]; break; }
        }
        if (!start || start.t === end.t) return null;
        var spanYears = (end.t - start.t) / (365.25 * 24 * 3600 * 1000);
        // Require at least ~1 day of span to avoid wild annualization off noise.
        if (spanYears < (1 / 365.25) || start.nav <= 0) return null;
        var growth = end.nav / start.nav;
        if (growth <= 0) return null;
        return Math.pow(growth, 1 / spanYears) - 1;
    },

    _fillApyCards: function(entries) {
        function setCard(id, days) {
            var el = document.getElementById(id);
            if (!el) return;
            var apy = UsdaiRenderer._realizedApy(entries, days);
            if (apy == null) {
                el.textContent = '—';
                el.className = 'card-value text-base text-slate-400';
                return;
            }
            el.textContent = (apy * 100).toFixed(2) + '%';
            el.className = 'card-value ' + (apy < 0 ? 'text-red-600' : '');
        }
        setCard('usdai-apy-7d', 7);
        setCard('usdai-apy-30d', 30);
    },

    _drawNavChart: function(ctx, entries) {
        var cutoff = Date.now() - 30 * 24 * 3600 * 1000;
        var windowed = entries.filter(function(e) {
            var ts = e.timestamp.endsWith('Z') ? e.timestamp : (e.timestamp + 'Z');
            return new Date(ts).getTime() >= cutoff && e.nav_per_share != null;
        });
        if (windowed.length < 2) {
            ctx.parentElement.innerHTML = '<div class="text-xs text-slate-400 italic">NAV history not yet available — chart populates after a few hours of samples.</div>';
            return;
        }
        var labels = windowed.map(function(e) {
            var ts = e.timestamp.endsWith('Z') ? e.timestamp : (e.timestamp + 'Z');
            return new Date(ts);
        });
        var navSeries = windowed.map(function(e) { return e.nav_per_share; });

        if (window._usdaiNavChart) {
            try { window._usdaiNavChart.destroy(); } catch (e) {}
        }
        window._usdaiNavChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'NAV per share',
                    data: navSeries,
                    borderColor: '#ea580c',
                    backgroundColor: 'rgba(234, 88, 12, 0.08)',
                    fill: true,
                    tension: 0.25,
                    pointRadius: 0,
                    borderWidth: 2,
                    spanGaps: true
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
                        ticks: { font: { size: 11 }, callback: function(v) { return Number(v).toFixed(4); } }
                    }
                },
                plugins: {
                    legend: { display: true, position: 'top', labels: { boxWidth: 12, font: { size: 11 } } },
                    tooltip: { callbacks: { label: function(c) { return c.dataset.label + ': ' + Number(c.raw).toFixed(6); } } }
                },
                interaction: { intersect: false, mode: 'index' }
            }
        });
    },

    // ============================================================
    // §4 Secondary Market (both)
    // ============================================================
    // `part` splits this into the §1 Peg panel and the §2 Liquidity panel.
    // Omitted renders both in one panel (the pre-5-axis shape), which nothing
    // uses today but keeps the function honest if called without it.
    //
    // The split was deferred twice: while the slippage ladder carried an
    // unmarked gated-route leg, giving it its own numbered section would have
    // handed a defective number its own headline. route_includes_gated_venue now
    // marks the affected tiers row by row, so the defect travels with the number
    // instead of being hidden by a heading. That is what changed, not the number.
    _renderSecondaryMarket: function(specific, s, slug, part) {
        var sec = specific.secondary || {};
        var slip = specific.slippage_tiers || {};
        var pools = Array.isArray(sec.top_pools) ? sec.top_pools : [];
        var isVault = slug === 'susdai';
        var quoteKey = isVault ? 'susdai_to_usdc' : 'usdai_to_usdc';
        var pairLabel = isVault ? 'sUSDai → USDC' : 'USDai → USDC';

        // Headline tile: price-vs-NAV (sUSDai) vs price-vs-$1 (USDai).
        var headlineTile;
        if (isVault) {
            var nav = UsdaiRenderer._susdaiNavBasis(s);
            var disc = UsdaiRenderer._navDevDisplay(nav, sec.price_usd, sec.discount_to_nav_pct);
            var dState = UsdaiRenderer._navDevState(disc);
            var dCls = UsdaiRenderer._pegPctClass(dState);
            var dWord = UsdaiRenderer._navDevWord(disc);
            headlineTile =
                '<div class="summary-card"><div class="card-label">Price vs NAV</div>' +
                    '<div class="card-value ' + dCls + '">' + UsdaiRenderer._pegPctText(disc, 3) + '</div>' +
                    '<div class="text-xs text-slate-500 mt-0.5">' + dWord + ' · secondary px ' +
                        (sec.price_usd != null ? '$' + sec.price_usd.toFixed(4) : '—') + ' vs contract NAV</div>' +
                    '<div class="mt-1">' + UsdaiRenderer._statusPill(UsdaiRenderer._pegStatusLabel(dState), dState) + '</div>' +
                '</div>';
        } else {
            var dev = sec.deviation_pct;
            var pState = UsdaiRenderer._pegStatusClass(dev);
            var pCls = UsdaiRenderer._pegPctClass(pState);
            headlineTile =
                '<div class="summary-card"><div class="card-label">Implied price</div>' +
                    '<div class="card-value">' + (sec.price_usd != null ? '$' + sec.price_usd.toFixed(4) : '—') + '</div>' +
                    '<div class="text-xs ' + pCls + ' mt-0.5 font-mono">' + UsdaiRenderer._pegPctText(dev, 3) + '</div>' +
                    '<div class="mt-1">' + UsdaiRenderer._statusPill(UsdaiRenderer._pegStatusLabel(pState), pState) + '</div>' +
                '</div>';
        }

        // Deepest two pools as cards (sorted by TVL).
        var sorted = pools.slice().sort(function(a, b) { return (b.tvl_usd || 0) - (a.tvl_usd || 0); });
        var poolCards = sorted.slice(0, 2).map(function(p, i) {
            return '<div class="summary-card"><div class="card-label">' + (p.name || 'Pool') +
                    (i === 0 ? ' <span class="text-[10px] font-normal text-emerald-600">(deepest)</span>' : '') + '</div>' +
                '<div class="card-value text-base">' + CommonRenderer.formatCurrency(p.tvl_usd) + ' TVL</div>' +
                '<div class="text-xs text-slate-400 mt-1">' + CommonRenderer.formatCurrency(p.vol_24h_usd) + ' / 24h vol</div>' +
                '<div class="text-xs mt-1">' + UsdaiRenderer._addrCell(p.address) + '</div>' +
            '</div>';
        }).join('');

        var topRow =
            '<div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">' +
                headlineTile +
                (poolCards || '<div class="summary-card"><div class="text-xs text-slate-400 italic">No pool data in this snapshot.</div></div>') +
            '</div>';

        // Slippage tiers — shape {output_usd, slippage_bps, ...} keyed by notional.
        var qm = slip[quoteKey] || {};
        // ⚠️ WAS A HARDCODED FOUR. The feed publishes more than these and always
        // has: usdai quotes $1M and $2M, sUSDai quotes $1M, $2.5M, $5M and $10M.
        // Every one above $500K was dropped, silently and from the TOP — the end
        // of the ladder that answers "can a large holder actually get out", on two
        // assets whose own panel note says "Depth is thin against supply, so a
        // large holder cannot exit". sUSDai showed four rungs of a ladder measured
        // to $10M and stopped at $500K.
        //
        // Derived from the feed now, so a producer extending the ladder does not
        // need a change here to be seen. Non-numeric keys are excluded: this map
        // carries only notional-keyed quotes, and anything else is not a rung.
        var tiers = Object.keys(qm)
            .filter(function(k) { return k !== '' && isFinite(Number(k)); })
            .sort(function(a, b) { return Number(a) - Number(b); });
        var hasAny = tiers.some(function(t) { return qm[t] && (qm[t].slippage_bps != null || qm[t].output_usd != null); });
        var slipBlock = '';
        if (hasAny) {
            // ⚠️ Ladder-level verdict, not per row: a sign inversion mirrors on
            // EVERY rung, a coincidence on one. See slippageSignIsInverted.
            var tierSignInverted = CommonRenderer.slippageSignIsInverted(tiers.map(function(t) {
                var q0 = qm[t] || {};
                var o0 = (q0.output_usd != null) ? q0.output_usd : q0.out;
                return { size: Number(t), output: o0, bps: q0.slippage_bps };
            }));
            var rows = tiers.map(function(t) {
                var q = qm[t] || {};
                // ⚠️ The old formatter divided by 1000 and appended 'K'
                // unconditionally, so the $10M rung this list now reaches would
                // have printed "$10000K". Shared formatter handles the magnitude.
                var sizeTxt = (typeof CommonRenderer !== 'undefined' && CommonRenderer.formatCurrency)
                    ? CommonRenderer.formatCurrency(Number(t))
                    : '$' + (Number(t) / 1000).toFixed(0) + 'K';
                var out = (q.output_usd != null) ? q.output_usd : q.out;
                var outTxt = (out != null) ? '$' + Number(out).toLocaleString('en-US', { maximumFractionDigits: 0 }) : '—';
                var bps = q.slippage_bps;
                var bpsState = (bps == null) ? 'unknown' : (bps < 25) ? 'ok' : (bps < 100) ? 'warn' : 'critical';
                var bpsCls = UsdaiRenderer._stateTextCls(bpsState);
                // Per-tier, not per-panel: the gate applies at the sizes where the
                // router reaches it, and marking the whole ladder would overstate it.
                var gated = (q.route_includes_gated_venue === true);
                return '<tr' + (gated ? ' class="bg-amber-50 dark:bg-amber-950/30"' : '') + '>' +
                    '<td class="font-mono text-right">' + sizeTxt + '</td>' +
                    '<td class="font-mono text-right">' + outTxt + '</td>' +
                    '<td class="font-mono text-right ' + (gated ? 'text-amber-700 dark:text-amber-300' : bpsCls) + '">' +
                        (bps != null ? bps.toFixed(1) + ' bps' : '—') +
                        (gated ? ' <span title="route includes a gated venue">\u26a0</span>' : '') +
                    // ⚠️ usdai and sUSDai publish slippage_bps with the sign
                    // INVERTED against their own output column — sUSDai's $10M
                    // rung reads "11.5 bps" beside $9,988,509 returned from
                    // $10,000,000, a loss shown as a gain. Shared detector, so
                    // this table and the common ladder cannot disagree about
                    // what counts as a contradiction.
                    (tierSignInverted
                        ? CommonRenderer.slippageSignWarningHtml(Number(t), out, bps) : '') +
                    '</td>' +
                '</tr>';
            }).join('');
            // ROUTE CAVEAT, derived only from fields this feed publishes.
            //
            // The quote sizes are compared against the depth of every venue the
            // feed names. When a quote exceeds that total, the route provably
            // reaches venues that are not published here, and the returned bps
            // describes that unnamed route rather than the pools shown above it.
            // The feed carries no route or venue field for the quote, so the
            // destination is unknown from this payload and is NOT guessed at.
            //
            // This is not hypothetical: riskAnalyst traced a 500K USDai->USDC
            // route through an ERC-4626 deposit into the sUSDai vault, i.e. part
            // of a quoted "exit" is a subscription into an async-redemption
            // instrument priced as if it were settled USDC. Re-check when
            // PegTracker ships route_includes_gated_venue and the ladder's
            // provenance fields; at that point the number can be trusted and
            // liquidity earns its own axis section.
            // The feed now publishes the route itself, so this no longer infers the
            // problem from pool depth. The earlier version compared quote size to
            // summed top_pools TVL; top_pools_is_total_depth is now explicitly
            // false, which means that comparison treated a partial venue list as
            // the denominator of record. Directionally right, wrongly grounded.
            // Use route_includes_gated_venue and route_venues instead.
            var gatedTiers = tiers.filter(function(t) {
                return qm[t] && qm[t].route_includes_gated_venue === true;
            });
            var routeNote = '';
            if (gatedTiers.length) {
                var firstGated = Number(gatedTiers[0]);
                var venueSet = {};
                gatedTiers.forEach(function(t) {
                    (qm[t].route_venues || []).forEach(function(v) { venueSet[v] = 1; });
                });
                var venues = Object.keys(venueSet);
                routeNote =
                    '<div class="text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 ' +
                        'border border-amber-200 dark:border-amber-800 rounded p-2 mt-2">' +
                        '<span class="font-semibold">Marked tiers route through a gated venue.</span> ' +
                        'From <span class="font-mono">$' + (firstGated / 1000).toFixed(0) + 'K</span> upward the ' +
                        'router\u2019s best path includes an <span class="font-mono">erc4626</span> vault leg \u2014 ' +
                        'a <em>subscription</em> into an async-redemption instrument, priced here as though it were ' +
                        'settled USDC. The bps on those rows is therefore not a realisable exit cost at that size. ' +
                        'Venues on the marked routes: <span class="font-mono">' +
                        UsdaiRenderer._esc(venues.join(', ')) + '</span>.' +
                    '</div>';
            }
            // Pools shown are a named subset, not total depth — the feed says so.
            var scopeNote = (sec.top_pools_is_total_depth === false) ?
                '<div class="text-xs text-slate-500 mt-2">Pools listed above are a named subset (<span ' +
                    'class="font-mono">' + UsdaiRenderer._esc(sec.top_pools_scope || 'scoped') + '</span>), ' +
                    'not total depth \u2014 do not read their combined TVL as the market\u2019s capacity.' +
                '</div>' : '';

            slipBlock =
                '<div class="mt-6">' +
                    '<div class="text-sm font-semibold text-slate-700 mb-2">Slippage tiers — ' + pairLabel + '</div>' +
                    '<div class="data-table-scroll"><table class="data-table">' +
                        '<thead><tr><th class="text-right">Size</th><th class="text-right">Output</th><th class="text-right">Slippage</th></tr></thead>' +
                        '<tbody>' + rows + '</tbody>' +
                    '</table></div>' +
                    routeNote +
                    scopeNote +
                '</div>';
        }

        var note = '<p class="text-xs text-slate-500 mt-3">Published chain-specific quotes only; pool TVL is not executable capacity. NAV marks, size impact and actual cash settlement are separate.</p>';

        if (part === 'peg') {
            return '<div class="panel">' +
                '<div class="panel-title">Secondary Market \u2014 price</div>' +
                topRow +
            '</div>';
        }
        if (part === 'liquidity') {
            if (!slipBlock) return '';
            return '<div class="panel">' +
                '<div class="panel-title">Exit depth &amp; slippage</div>' +
                slipBlock + note +
            '</div>';
        }
        return '<div class="panel">' +
            '<div class="panel-title">Secondary Market</div>' +
            topRow + slipBlock + note +
        '</div>';
    },

    // §4 Dependencies — dependencies.upstream / .downstream are published for
    // every asset here and were rendered nowhere. Internal links route to the
    // sibling dashboard; downstream_tracked distinguishes "nothing downstream"
    // from "downstream not measured", which are different claims.
    _renderDependenciesPanel: function(data) {
        var dep = data.dependencies || {};
        var up = Array.isArray(dep.upstream) ? dep.upstream : [];
        var down = Array.isArray(dep.downstream) ? dep.downstream : [];
        if (!up.length && !down.length && dep.downstream_tracked !== false) return '';

        function rows(list) {
            return list.map(function(x) {
                var nm = UsdaiRenderer._esc(x.name || '—');
                var label = (x.link && x.link_type === 'internal')
                    ? '<a href="' + UsdaiRenderer._esc(x.link) + '" class="text-blue-500 hover:underline">' + nm + ' \u2192</a>'
                    : nm;
                return '<tr><td class="font-medium">' + label + '</td>' +
                    '<td class="text-xs text-slate-600 dark:text-slate-300">' +
                        UsdaiRenderer._esc(x.metric || '') + '</td></tr>';
            }).join('');
        }
        var body = '';
        if (up.length) {
            body += '<div class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1 mt-2">Upstream \u2014 what this depends on</div>' +
                '<table class="data-table"><tbody>' + rows(up) + '</tbody></table>';
        }
        body += '<div class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1 mt-3">Downstream \u2014 what depends on this</div>';
        if (down.length) {
            body += '<table class="data-table"><tbody>' + rows(down) + '</tbody></table>';
        } else {
            body += '<div class="text-xs text-slate-500">' +
                (dep.downstream_tracked === false
                    ? 'Not tracked \u2014 this feed does not measure downstream holders, which is not the same as there being none.'
                    : 'None recorded.') +
                '</div>';
        }
        return '<div class="panel" id="panel-dependencies">' +
            '<div class="panel-title">Dependencies</div>' + body +
        '</div>';
    },

    // ============================================================
    // §5 Governance / Trust Stack (async, family) — framed as a STRENGTH
    // §6 Family panel (async, family)
    // One fetch of usdai_family.json fills both. On miss, §5 degrades to the
    // per-asset proxy facts the backing JSON carries; §6 clears.
    // ============================================================
    _loadFamily: function(slug, data) {
        var govEl = document.getElementById('usdai-gov-panel');
        var famEl = document.getElementById('usdai-family-panel');
        var nocache = Math.floor(Date.now() / 60000);
        fetch('data/usdai_family.json?nocache=' + nocache)
            .then(function(r) { return r.ok ? r.json() : null; })
            .then(function(fam) {
                if (govEl) govEl.innerHTML = UsdaiRenderer._renderGovPanel(fam, data, slug);
                if (famEl) famEl.innerHTML = fam ? UsdaiRenderer._details('Family accounting and source reconciliation', UsdaiRenderer._renderFamilyHtml(fam, slug)) : '<p class="text-sm text-amber-700">Family accounting snapshot unavailable.</p>';
                UsdaiRenderer._compactEvidence();
            })
            .catch(function() {
                if (govEl) govEl.innerHTML = UsdaiRenderer._renderGovPanel(null, data, slug);
                if (famEl) famEl.innerHTML = '<p class="text-sm text-amber-700">Family accounting snapshot unavailable.</p>';
            });
    },

    _renderGovPanel: function(fam, data, slug) {
        var g = (fam && fam.governance) || {}, esc = UsdaiRenderer._esc;
        var delay = g.min_delay_seconds == null ? 'Not established' : Number(g.min_delay_seconds) / 3600 + 'h';
        var owners = Array.isArray(g.gov_safe_owners) ? g.gov_safe_owners : [];
        var threshold = g.gov_safe_threshold == null || !owners.length ? 'Quorum not established' : g.gov_safe_threshold + '-of-' + owners.length;
        var admin = slug === 'susdai' ? g.ops_safe_holds_susdai_admin : g.ops_safe_holds_usdai_admin;
        var cs = g.call_scheduled || {}, pending = Array.isArray(cs.pending_ops) ? cs.pending_ops : [];
        var scope = fam && (fam.as_of || fam.timestamp);
        var rows = '<tr><td>Proxy upgrades</td><td>' + esc(delay) + '</td><td>' + esc(threshold) + ' · ' + UsdaiRenderer._addrCell(g.gov_safe) + '</td></tr>';
        rows += '<tr><td>Operational role grants</td><td>' + (admin === true ? 'NO DELAY — outside upgrade timelock' : 'Reach / delay not established') + '</td><td>' + UsdaiRenderer._addrCell(g.ops_safe) + '</td></tr>';
        var pendingText = pending.length ? pending.length + ' scheduled operation(s) reported' : cs.scanned === true ?
            'No scheduled events detected in the reported scan window; not a complete pending-state guarantee.' : 'Scheduled-operation scan unavailable.';
        return '<div class="panel"><div class="panel-title">Arbitrum authority observations</div>' +
            '<p class="text-sm">Upgrade delay does not establish time or liquidity to exit. Operational permissions are a separate path.</p>' +
            '<div class="data-table-scroll"><table class="data-table"><thead><tr><th>Action</th><th>Delay / reach</th><th>Authority</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
            '<p class="text-xs text-slate-500 mt-2">Family observation: ' + esc(scope || 'unavailable') + '. This does not renew the separate code/audit review.</p>' +
            '<p class="text-sm mt-2">' + esc(pendingText) + '</p>' +
            pending.map(function(op) { return '<p class="text-sm text-amber-700">Scheduled target ' + UsdaiRenderer._addrCell(op.target) +
                ' · earliest execution ' + esc(op.eta_iso || op.eta || 'not supplied') + '. Execution and purpose are not independently established here.</p>'; }).join('') +
            (pending.length ? UsdaiRenderer._details('Reported scheduled operations', '<pre class="text-xs whitespace-pre-wrap break-all">' + esc(JSON.stringify(pending, null, 2)) + '</pre>') : '') +
            '<p class="text-xs text-slate-500">Scan scope: timelock events only; direct role grants and minting are not covered.</p></div>';
    },

    _renderFamilyHtml: function(fam, currentSlug) {
        var gov = fam.governance || {};
        var totals = fam.totals || {};
        var api = fam.api_usd_ai || {};
        var credit = fam.credit_exposure || {};

        // Aggregate AUM card (double-count adjusted).
        var aumLines = [];
        if (totals.usdai_supply_usd != null) {
            aumLines.push('<div class="flex justify-between text-sm py-1">' +
                '<span class="text-slate-600">USDai supply</span>' +
                '<span class="font-mono">' + CommonRenderer.formatCurrencyExact(totals.usdai_supply_usd) + '</span></div>');
        }
        if (totals.susdai_total_assets_usd != null) {
            aumLines.push('<div class="flex justify-between text-sm py-1">' +
                '<span class="text-slate-600">sUSDai total assets</span>' +
                '<span class="font-mono">' + CommonRenderer.formatCurrencyExact(totals.susdai_total_assets_usd) + '</span></div>');
        }
        // The double-count adjustment, computed so it always equals the gap
        // between the raw sum and the reported combined AUM.
        if (totals.usdai_supply_usd != null && totals.susdai_total_assets_usd != null && totals.combined_aum_usd != null) {
            var adj = totals.usdai_supply_usd + totals.susdai_total_assets_usd - totals.combined_aum_usd;
            aumLines.push('<div class="flex justify-between text-sm py-1 text-slate-400">' +
                '<span>Less USDai inside sUSDai (idle + escrow)</span>' +
                '<span class="font-mono">−' + CommonRenderer.formatCurrencyExact(adj) + '</span></div>');
        }
        if (totals.combined_aum_usd != null) {
            aumLines.push('<div class="flex justify-between text-base font-bold py-1 border-t border-slate-200 mt-1">' +
                '<span>Combined family AUM</span>' +
                '<span class="font-mono text-indigo-700">' + CommonRenderer.formatCurrencyExact(totals.combined_aum_usd) + '</span></div>');
        }
        var creditLine = (credit.total_loan_destined_usd != null) ?
            '<div class="text-xs text-slate-500 mt-2">Credit exposure: <span class="font-mono">' +
                UsdaiRenderer._usdShort(credit.drawn_loans_usd) + '</span> drawn + <span class="font-mono">' +
                UsdaiRenderer._usdShort(credit.committed_undrawn_escrow_usd) + '</span> committed = <span class="font-mono font-semibold">' +
                UsdaiRenderer._usdShort(credit.total_loan_destined_usd) + '</span> loan-destined.</div>' : '';
        var aumCard =
            '<div>' +
                '<div class="text-sm font-semibold text-slate-700 mb-2">Aggregate AUM</div>' +
                aumLines.join('') +
                (totals.comment ? '<div class="text-xs text-slate-500 italic mt-2">' + totals.comment + '</div>' : '') +
                creditLine +
            '</div>';

        // Shared authority-chain card.
        var signers = Array.isArray(gov.gov_safe_owners) ? gov.gov_safe_owners : [];
        var signerRows = signers.map(function(a, i) {
            return '<tr><td class="font-medium">Signer ' + (i + 1) + '</td><td>' + UsdaiRenderer._addrCell(a) + '</td></tr>';
        }).join('');
        var delayHrs = (gov.min_delay_seconds != null) ? Math.round(gov.min_delay_seconds / 3600) : null;
        var govCard =
            '<div>' +
                '<div class="text-sm font-semibold text-slate-700 mb-1">Shared authority chain</div>' +
                '<div class="text-xs text-slate-500 mb-2">' + (gov.model || 'Authority model not published') + '</div>' +
                '<table class="data-table"><tbody>' +
                    '<tr><td class="font-medium">Timelock</td><td>' + UsdaiRenderer._addrCell(gov.timelock) +
                        ' <span class="text-xs text-slate-500">getMinDelay ' + (delayHrs != null ? delayHrs + 'h' : '—') + '</span></td></tr>' +
                    '<tr><td class="font-medium">Gov Safe</td><td>' + UsdaiRenderer._addrCell(gov.gov_safe) +
                        ' <span class="text-xs text-slate-500">' + (gov.gov_safe_threshold != null ? gov.gov_safe_threshold + '-of-' + signers.length : '') + '</span></td></tr>' +
                    '<tr><td class="font-medium">Ops Safe</td><td>' + UsdaiRenderer._addrCell(gov.ops_safe) + '</td></tr>' +
                    signerRows +
                '</tbody></table>' +
            '</div>';

        // api.usd.ai aggregate echo with freshness chip.
        var raw = api.raw || {};
        var stale = api.stale === true;
        var freshState = stale ? 'warn' : api.updated_at ? 'ok' : 'unknown';
        var freshTxt = api.updated_at ? 'updated ' + CommonRenderer.formatDate(api.updated_at) : 'updatedAt —';
        function apiRow(label, v) {
            return '<div class="flex justify-between text-xs py-0.5">' +
                '<span class="text-slate-500">' + label + '</span>' +
                '<span class="font-mono text-slate-700">' + UsdaiRenderer._usdShort(v) + '</span></div>';
        }
        var apiBlock = (api.url) ?
            '<div class="mt-4 pt-3 border-t border-slate-200">' +
                '<div class="flex flex-wrap items-center gap-2 mb-2">' +
                    '<span class="text-sm font-semibold text-slate-700">api.usd.ai aggregate</span>' +
                    UsdaiRenderer._statusPill(stale ? 'Producer reports stale' : api.updated_at ? 'Timestamp published' : 'Source age unknown', freshState, '') +
                    '<span class="text-xs text-slate-400">' + freshTxt + '</span>' +
                '</div>' +
                '<div class="grid grid-cols-1 md:grid-cols-2 gap-x-6">' +
                    apiRow('mintedUsdai', raw.mintedUsdai) +
                    apiRow('usdaiTvl', raw.usdaiTvl) +
                    apiRow('sUsdaiTvl', raw.sUsdaiTvl) +
                    apiRow('stablecoinReserves', raw.stablecoinReserves) +
                    apiRow('loansReserves', raw.loansReserves) +
                '</div>' +
                (api.note ? '<div class="text-xs text-slate-400 italic mt-2">' + api.note + '</div>' : '') +
            '</div>' : '';

        var asOf = fam.as_of || fam.timestamp;

        return '<div class="panel">' +
            '<div class="panel-title">USD.AI Family — cross-asset snapshot</div>' +
            '<div class="grid grid-cols-1 md:grid-cols-2 gap-6">' +
                aumCard +
                govCard +
            '</div>' +
            apiBlock +
            '<div class="text-xs text-slate-400 mt-3">As of ' + CommonRenderer.formatDate(asOf) + ' · self-computed; api.usd.ai is cross-check only, never source-of-truth.</div>' +
        '</div>';
    }
};
