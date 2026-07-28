/**
 * Hastra PRIME / wYLDS renderer — independent on-chain reserve monitor.
 *
 * The framing of every panel is "what does the chain say, vs what Hastra
 * claims." The feed (hastra_prime_backing.json) is reconstructed entirely from
 * public sources — Provenance LCD bank balances + Solana RPC + Ethereum RPC —
 * with Hastra's own Proof-of-Reserves page deliberately NOT a primary source.
 * That independence is the product: the PoR-named "PRIME pool" / "AUTO pool"
 * Provenance accounts hold 0 bank YLDS today, and ~99.8% of the reserve sits in
 * two accounts Hastra does not name — one of them co-mingled with Figure's
 * tokenized loan book. None of that is visible from the issuer dashboard.
 *
 * Data:
 *   - data/hastra_prime_backing.json           (dashboard snapshot — last GOOD)
 *   - data/hastra_prime_backing_history.json   (30d series)
 *   - data/hastra_prime_backing_last_attempt.json (every attempt incl. failed —
 *     read only to name the failing leg in the staleness badge)
 *
 * STALENESS — the USDD-class guard, and why it is split two ways
 * --------------------------------------------------------------
 * collateralization_pct is a ratio of a multi-source sum: Provenance balances
 * (numerator) over Solana + Ethereum supply (denominator). One dead RPC craters
 * it — exactly the 2026-07-13 USDD incident, where a single failed TRON read
 * dropped the headline CR from 101.3% to a false 48.55% CRITICAL that reached
 * the live dashboard.
 *
 * The analyzer's guard means the dashboard JSON is *never* overwritten with a
 * failed snapshot; it simply freezes at the last good read. So there are two
 * distinct conditions and they must render differently:
 *
 *   1. data.stale === true  — the snapshot itself carries a failed leg. Should
 *      not happen with the current analyzer (failed attempts go to the
 *      last_attempt slot), but if it ever does, the numbers are UNVERIFIED:
 *      suppress every red/green verdict to neutral and say so. A missing
 *      Ethereum read must never look like a collateral event.
 *   2. the file is merely OLD (stale:false, timestamp behind) — the values were
 *      validated when written, so they keep their true colors; we add an
 *      "as of" badge and, when the last_attempt slot is newer and failed, name
 *      the failing leg.
 *
 * Constants are HP_-prefixed and charts live on window._hp* per the renderer
 * global-scope convention (bare names collide across renderer files).
 */

var HP_THRESHOLDS = {
    cr_par:            100.0,  // % — below par is a genuine shortfall
    cr_thin:           100.5,  // % — above par but no cushion
    recon_tolerance:   0.5,    // % — per-chain coverage break (analyzer default)
    redeem_cov_warn:   1.25,   // × — liquid buffer ÷ pending queue
    holder_conc_warn:  50.0,   // % of PRIME supply in one owner
    stale_warn_hours:  3,      // matches the dashboard freshness digest
    stale_crit_hours:  12
};

// Mirrors the analyzer's config block (hastra_prime_backing_analyzer.py). Kept
// here only to build explorer links — the analyzer remains the source of truth
// for which addresses are read.
var HP_ADDR = {
    wylds_sol_mint:   '8fr7WGTVFszfyNWRMXj6fRjZZAnDwmXwEpCrtzmUkdih',
    prime_sol_mint:   '3b8X44fLF9ooXaUm3hhSgjpmVs6rZZ3pPoGnGahc3Uu7',
    prime_vault_ata:  'FvkbfMm98jefJWrqkvXvsSZ9RFaRBae8k6c1jaYA5vY3',
    wylds_eth:        '0x6aD038cA6C04e885630851278ca0a856Ad9a66Cc',
    prime_eth:        '0x19ebb35279A16207Ec4ba82799CC64715065F7F6',
    morpho_vault_eth: '0xC21b08C16458202593D4D9B26b9984Ee67b38BbD'
};

// Reserve-account roles. The analyzer emits balances keyed by role but not the
// labels — and the labels ARE the independent-verification story (which
// accounts Hastra names on its PoR vs where the YLDS actually sits).
var HP_RESERVE_ROLES = {
    redeem_vault:   { label: 'Redeem vault',              note: 'Liquid redemption buffer — the only account also holding USDC', kind: 'liquid' },
    dp_sweep:       { label: 'DP sweep',                  note: 'Democratized Prime sweep account', kind: 'reserve' },
    reserve_a:      { label: 'Reserve A',                 note: 'Not named on Hastra’s PoR page — found by reading bank balances', kind: 'unnamed' },
    warehouse_b:    { label: 'Warehouse B',               note: 'Not named on the PoR page, and co-mingled with Figure loan-scope tokens (heloc.forge / nq.heloc.forge / rtl.forge / dscr.forge) — not a segregated reserve', kind: 'comingled' },
    por_prime_pool: { label: 'PoR-named "PRIME pool"',    note: 'Named on Hastra’s PoR page as a reserve pool; holds 0 bank YLDS', kind: 'por_named' },
    por_auto_pool:  { label: 'PoR-named "AUTO pool"',     note: 'Named on Hastra’s PoR page as a reserve pool; holds 0 bank YLDS', kind: 'por_named' }
};

/**
 * Periodically-refreshed figures that this monitor does NOT read from chain.
 * Every value here is sourced from the riskAnalyst research report
 * (assets/hastra-prime.md) and is rendered with an explicit "not live" badge and
 * an as-of date. Nothing in this block may be presented as chain-verified.
 */
var HP_REPORT = {
    url: 'https://tidresearch.com/reports/hastra-prime',

    // Issuer's own PoR headline, for the ours-vs-theirs comparison.
    por: {
        collateralization_pct: 100.31,
        as_of: '2026-07-27',
        note: 'Hastra’s public Proof-of-Reserves dashboard, as read for the research report'
    },

    // Secondary-market depth. The analyzer emits no DEX feed today, so these are
    // report figures, not live quotes.
    liquidity: {
        as_of: '2026-07-24',
        venues: [
            { venue: 'Uniswap V3 PRIME/USDC', chain: 'Ethereum', tvl_usd: 9.0e6, vol24h_usd: 23.4e6,
              price: 1.049, note: 'Tight to NAV (+0.02%). Primary venue. Depth is PRIME Roots campaign-supported — re-verify post-campaign.' },
            { venue: 'Orca PYUSD/PRIME', chain: 'Solana', tvl_usd: null, vol24h_usd: 2.47e6,
              price: null, note: 'Secondary Solana venue.' },
            { venue: 'Manifest PRIME/USDC', chain: 'Solana', tvl_usd: null, vol24h_usd: null,
              price: null, note: 'Listed venue; depth not sized in the report.' }
        ]
    },

    // HELOC-warehouse credit. Issuer-reported, cross-checked against an
    // independent securitization proxy. Never chain-verified.
    heloc: {
        as_of: '2026-07-27',
        issuer: {
            source: 'Hastra /prime page (issuer-reported)',
            avg_ltv_pct: 59.37,
            avg_fico: 741.58,
            avg_coupon_pct: 9.19,
            cum_gross_loss: '<1.25%'
        },
        proxy: {
            source: 'FIGRE Trust securitizations — Morningstar DBRS / KBRA presales, 2026 deals',
            wa_fico: 734,
            orig_cltv_pct: 63
        },
        figure_delinquency: {
            source: 'Figure SEC filings — loans held for sale',
            y2024_pct: 3.91,
            y2025_pct: 5.46,
            note: 'A Morpheus Research short report puts this at ~2× bank/originator peers; the source is short-biased, the underlying filing figures are not.'
        },
        caveats: [
            'The Democratized Prime warehouse’s own loan quality is not independently observable — 144A private deals, no Reg-AB loan tape, no per-warehouse delinquency feed.',
            'The warehouse now also blends auto (Agora) and SMB (Credibly) receivables, so "HELOC" is not the whole book.'
        ]
    }
};

var HastraPrimeRenderer = {

    // ============================================================
    // helpers
    // ============================================================
    _isHastra: function(data) {
        return !!(data && (data.view_slug === 'hastra-prime' || data.asset_slug === 'hastra-prime'));
    },

    _num: function(n, dp) {
        if (n === null || n === undefined || isNaN(n)) return '—';
        return n.toLocaleString('en-US', { minimumFractionDigits: dp || 0, maximumFractionDigits: dp || 0 });
    },

    // YLDS / wYLDS / PRIME token amounts (1 YLDS ≈ $1 face, but these are token
    // counts, not dollars — formatted without a $ so the two never blur).
    _tok: function(n) {
        if (n === null || n === undefined || isNaN(n)) return '—';
        var a = Math.abs(n);
        if (a >= 1e9) return (n / 1e9).toFixed(2) + 'B';
        if (a >= 1e6) return (n / 1e6).toFixed(2) + 'M';
        if (a >= 1e3) return (n / 1e3).toFixed(1) + 'K';
        return n.toFixed(2);
    },

    _money: function(n) {
        if (n === null || n === undefined || isNaN(n)) return '—';
        var a = Math.abs(n);
        if (a >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
        if (a >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
        if (a >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
        return '$' + n.toFixed(2);
    },

    _pct: function(n, dp) {
        if (n === null || n === undefined || isNaN(n)) return '—';
        return n.toFixed(dp === undefined ? 2 : dp) + '%';
    },

    _trunc: function(addr, head, tail) {
        if (!addr) return '—';
        if (addr.length <= (head || 8) + (tail || 6) + 1) return addr;
        return addr.slice(0, head || 8) + '…' + addr.slice(-(tail || 6));
    },

    _link: function(url, label, title) {
        return '<a href="' + url + '" target="_blank" rel="noopener noreferrer" ' +
            'class="text-blue-500 hover:underline font-mono text-xs"' +
            (title ? ' title="' + title + '"' : '') + '>' + label + '</a>';
    },

    _pbLink: function(addr) {
        if (!addr) return '—';
        return HastraPrimeRenderer._link('https://explorer.provenance.io/account/' + addr,
            HastraPrimeRenderer._trunc(addr, 10, 6), addr);
    },

    _solLink: function(addr, kind) {
        if (!addr) return '—';
        return HastraPrimeRenderer._link('https://solscan.io/' + (kind || 'account') + '/' + addr,
            HastraPrimeRenderer._trunc(addr, 6, 6), addr);
    },

    _ethLink: function(addr) {
        if (!addr) return '—';
        return HastraPrimeRenderer._link('https://etherscan.io/address/' + addr,
            HastraPrimeRenderer._trunc(addr, 6, 4), addr);
    },

    _dot: function(state) {
        var color = state === 'ok' ? '#22c55e' : state === 'warn' ? '#f59e0b'
            : state === 'critical' ? '#ef4444' : '#94a3b8';
        return '<span class="inline-block w-2 h-2 rounded-full align-middle" style="background:' + color + '"></span>';
    },

    _pill: function(label, state) {
        var bg, fg;
        if (state === 'ok') { bg = '#f0fdf4'; fg = '#15803d'; }
        else if (state === 'warn') { bg = '#fffbeb'; fg = '#b45309'; }
        else if (state === 'critical') { bg = '#fef2f2'; fg = '#b91c1c'; }
        else { bg = '#f1f5f9'; fg = '#475569'; }
        return '<span class="hp-pill inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium" ' +
            'style="background:' + bg + ';color:' + fg + '">' + HastraPrimeRenderer._dot(state) +
            '<span>' + label + '</span></span>';
    },

    /**
     * Provenance badge. The rule the handoff is explicit about: a field tagged
     * source:"por" is ISSUER-REPORTED and must be visually distinct from a
     * chain read — and the badge must never appear on a chain-verified field.
     * Beware the near-miss: `por_prime_pool` / `por_auto_pool` are reserve
     * ACCOUNT names, not sources, so match the source string exactly rather
     * than substring-testing for "por".
     */
    _isIssuerSourced: function(source) {
        if (!source || typeof source !== 'string') return false;
        var s = source.toLowerCase();
        return s === 'por' || s === 'issuer' || s.indexOf('por_page') === 0 || s.indexOf('issuer_') === 0;
    },

    _sourceBadge: function(source) {
        if (source === null || source === undefined || source === 'unavailable') {
            return HastraPrimeRenderer._pill('unavailable', 'neutral');
        }
        return HastraPrimeRenderer._isIssuerSourced(source)
            ? HastraPrimeRenderer._pill('issuer-reported', 'warn')
            : HastraPrimeRenderer._pill('chain-verified', 'ok');
    },

    _reportBadge: function(asOf) {
        return '<span class="hp-pill inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium" ' +
            'style="background:#eef2ff;color:#4338ca">' +
            'not live · research report' + (asOf ? ' ' + asOf : '') + '</span>';
    },

    _anchor: function(id, html) {
        if (!html || typeof html !== 'string') return html;
        return html.replace(/^(<div class="panel")/, '<div id="' + id + '" class="panel"');
    },

    _tile: function(label, value, cls, sub) {
        return '<div>' +
            '<div class="card-label">' + label + '</div>' +
            '<div class="card-value text-lg ' + (cls || '') + '">' + value + '</div>' +
            (sub ? '<div class="text-xs text-slate-500 mt-0.5">' + sub + '</div>' : '') +
        '</div>';
    },

    _bar: function(segments, height) {
        var inner = segments.map(function(s) {
            return '<div style="width:' + Math.max(0, Math.min(100, s.pct)) + '%;background:' + s.color + '"' +
                (s.title ? ' title="' + s.title + '"' : '') + '></div>';
        }).join('');
        return '<div class="pct-bar-container flex w-full rounded overflow-hidden" ' +
            'style="height:' + (height || 20) + 'px">' + inner + '</div>';
    },

    // ---- state maps -------------------------------------------------
    _crState: function(pct) {
        if (pct == null) return 'neutral';
        if (pct < HP_THRESHOLDS.cr_par) return 'critical';
        if (pct < HP_THRESHOLDS.cr_thin) return 'warn';
        return 'ok';
    },

    _stateCls: function(state) {
        return state === 'ok' ? 'positive' : state === 'warn' ? 'warning'
            : state === 'critical' ? 'negative' : '';
    },

    /**
     * The unverified gate. When the snapshot itself is flagged stale, every
     * quantitative verdict on this page is suspect — collapse it to neutral so
     * a dead RPC can never paint a red undercollateralized headline.
     */
    _gate: function(state) {
        return HastraPrimeRenderer._unverified ? 'neutral' : state;
    },

    /**
     * A pass/fail verdict pill. Greying the colour alone is not enough under
     * the gate: a grey pill still reading "break" asserts a conclusion the
     * snapshot cannot support, so the label has to carry the doubt too.
     */
    _verdictPill: function(label, state) {
        return HastraPrimeRenderer._unverified
            ? HastraPrimeRenderer._pill(label + ' · unverified', 'neutral')
            : HastraPrimeRenderer._pill(label, state);
    },

    // ============================================================
    // staleness
    // ============================================================
    _ageHours: function(iso) {
        if (!iso) return null;
        var t = Date.parse(iso.endsWith && iso.endsWith('Z') ? iso : iso + 'Z');
        if (isNaN(t)) t = Date.parse(iso);
        if (isNaN(t)) return null;
        return (Date.now() - t) / 3600000;
    },

    _hhmm: function(iso) {
        if (!iso) return '—';
        var t = new Date(iso.endsWith && iso.endsWith('Z') ? iso : iso + 'Z');
        if (isNaN(t.getTime())) return iso;
        return t.toISOString().slice(0, 16).replace('T', ' ') + 'Z';
    },

    // ============================================================
    // pre-render — runs before common.js paints the summary row / chart.
    // The feed carries the common envelope but not the exact fields common.js
    // dereferences, so neutralize those, then repurpose the common CR chart as
    // the chain-derived collateralization series.
    // ============================================================
    preRender: function(data, history) {
        if (!HastraPrimeRenderer._isHastra(data)) return;
        HastraPrimeRenderer._history = history || null;
        HastraPrimeRenderer._unverified = data.stale === true;

        var s = data.summary;
        if (!s) return;

        // renderSummaryCards() dereferences s.collateral_ratio_alt.label; this
        // feed has no alt ratio. Backfill a hidden placeholder — the whole
        // summary-cards row is hidden in _suppressCommonPanels anyway, but the
        // NPE would fire before we get there.
        if (!s.collateral_ratio_alt) {
            s.collateral_ratio_alt = { label: '_hpAlt', value: 0, is_currency: false };
        }
        var spec = data.asset_specific = data.asset_specific || {};
        spec.card_overrides = spec.card_overrides || {};
        spec.card_overrides['_hpAlt'] = { hidden: true };

        // renderBreakdownTable/renderPieChart map over data.backing_breakdown —
        // absent here (the reserve is a set of accounts, rendered bespoke).
        if (!Array.isArray(data.backing_breakdown)) data.backing_breakdown = [];

        // The header reads `asset (chain)`; the raw values are "wYLDS" and
        // "multi-chain", which undersells what is actually being reconciled.
        data.asset = 'wYLDS / PRIME';
        data.chain = 'Provenance + Solana + Ethereum';

        // Repurpose the common CR chart. History carries collateralization_pct,
        // not collateral_ratio.
        if (history && Array.isArray(history.entries)) {
            history.entries.forEach(function(e) {
                if (e.collateral_ratio == null && e.collateralization_pct != null) {
                    e.collateral_ratio = e.collateralization_pct;
                }
            });
        }
        spec.chart_title = 'Collateralization — chain-derived (reserve YLDS ÷ wYLDS supply)';
        spec.chart_dataset_label = 'Our CR %';
        spec.chart_y_min = 98;
        spec.chart_y_max = 108;
        spec.chart_bands = {
            critical: [0, 100],
            thin:     [100, 100.5],
            amber:    [100.5, 101],
            healthy:  [101, 120],
            min_line: 100,
            max_line: null
        };
    },

    // ============================================================
    // entry point
    // ============================================================
    render: function(data) {
        var container = document.getElementById('asset-specific-panels');
        if (!container || !HastraPrimeRenderer._isHastra(data)) return;

        var spec = data.asset_specific || {};
        var s = data.summary || {};
        HastraPrimeRenderer._unverified = data.stale === true;

        HastraPrimeRenderer._suppressCommonPanels();
        HastraPrimeRenderer._injectStyles();

        var anc = HastraPrimeRenderer._anchor;
        var html = '';
        html += HastraPrimeRenderer._renderStaleBanner(data);
        html += anc('hp-panel-headline',   HastraPrimeRenderer._renderHeadline(data, spec, s));
        html += anc('hp-panel-flags',      HastraPrimeRenderer._renderRiskFlags(data));
        html += anc('hp-panel-recon',      HastraPrimeRenderer._renderReconciliation(spec));
        html += anc('hp-panel-redemption', HastraPrimeRenderer._renderRedemption(spec));
        html += anc('hp-panel-reserves',   HastraPrimeRenderer._renderReserveMap(spec));
        html += anc('hp-panel-supply',     HastraPrimeRenderer._renderSupplyByChain(spec));
        html += anc('hp-panel-control',    HastraPrimeRenderer._renderControlSurface(spec));
        html += anc('hp-panel-liquidity',  HastraPrimeRenderer._renderLiquidity(data, spec));
        html += anc('hp-panel-warehouse',  HastraPrimeRenderer._renderWarehouse(data, spec));
        html += anc('hp-panel-heloc-credit', HastraPrimeRenderer._renderHelocCredit());
        html += anc('hp-panel-provenance', HastraPrimeRenderer._renderDataProvenance(data, spec));

        container.innerHTML = html;

        HastraPrimeRenderer._drawSupplyCharts(spec);
        HastraPrimeRenderer._drawHolderChart(spec);
        HastraPrimeRenderer._drawWarehouseChart();
        HastraPrimeRenderer._setupAnchorNav();
        HastraPrimeRenderer._loadLastAttempt(data);
    },

    _suppressCommonPanels: function() {
        // Legacy mode (no axis blocks). Hide the legacy CR summary cards, the
        // common backing-breakdown table, the allocation pie and the common
        // risk-flags panel — all four are rendered bespoke below. Keep
        // #chart-panel: it is the collateralization series.
        var summaryCards = document.getElementById('summary-cards');
        if (summaryCards) summaryCards.style.display = 'none';

        ['breakdown-table', 'pie-chart', 'risk-flags'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) { var p = el.closest('.panel'); if (p) p.style.display = 'none'; }
        });
    },

    // Scoped styles: the issuer-proxy panel has to be unmistakably NOT part of
    // the chain-verified set, and Tailwind's dark: variant does not track this
    // app's body.dark toggle, so the dark rules are written explicitly.
    _injectStyles: function() {
        if (document.getElementById('hp-styles')) return;
        var css = '' +
            '#hp-panel-heloc-credit{border:1px dashed #c7d2fe;background:#f8fafc}' +
            'body.dark #hp-panel-heloc-credit{border-color:#4338ca;background:#0f172a}' +
            '#hp-panel-heloc-credit .panel-title{color:#4338ca}' +
            'body.dark #hp-panel-heloc-credit .panel-title{color:#c7d2fe}' +
            '.hp-stale-banner{border-left:4px solid #f59e0b;background:#fffbeb;color:#92400e;' +
            'padding:0.75rem 1rem;border-radius:0.5rem;margin-bottom:1.25rem;font-size:0.875rem}' +
            'body.dark .hp-stale-banner{background:#451a03;color:#fcd34d}' +
            '.hp-stale-banner.hp-unverified{border-left-color:#dc2626;background:#fef2f2;color:#991b1b}' +
            'body.dark .hp-stale-banner.hp-unverified{background:#450a0a;color:#fca5a5}' +
            '.hp-comingled td{background:rgba(245,158,11,0.06)}' +
            '.hp-zero td{color:#94a3b8}';
        var el = document.createElement('style');
        el.id = 'hp-styles';
        el.textContent = css;
        document.head.appendChild(el);
    },

    // ============================================================
    // staleness banner
    // ============================================================
    _renderStaleBanner: function(data) {
        var age = HastraPrimeRenderer._ageHours(data.timestamp);
        var unverified = data.stale === true;
        var old = age != null && age > HP_THRESHOLDS.stale_warn_hours;

        if (!unverified && !old) return '';

        var legs = Array.isArray(data.failed_legs) ? data.failed_legs : [];
        var legHtml = legs.length
            ? ' Failing leg' + (legs.length > 1 ? 's' : '') + ': <span class="font-mono">' + legs.join(', ') + '</span>.'
            : '';

        if (unverified) {
            // Case 1: the snapshot itself carries a failed leg. This is the
            // USDD trap — a multi-source ratio with a dead leg reads as a
            // collapse. Every verdict on the page is neutralised.
            return '<div id="hp-stale" class="hp-stale-banner hp-unverified">' +
                '<span class="font-semibold">Data stale — showing last good values from ' +
                HastraPrimeRenderer._hhmm(data.timestamp) + '.</span>' + legHtml +
                ' Collateralization here is a ratio of Provenance balances over Solana + Ethereum supply, so a single dead ' +
                'read would understate it. Verdicts are suppressed rather than shown red — <span class="font-semibold">this is ' +
                'not a collateral event</span>.' +
                '<div id="hp-last-attempt" class="text-xs mt-1 opacity-80"></div>' +
            '</div>';
        }

        // Case 2: values were validated when written; they simply have not been
        // refreshed. Keep the real colours, flag the age.
        var sev = age > HP_THRESHOLDS.stale_crit_hours ? 'stopped updating' : 'behind schedule';
        return '<div id="hp-stale" class="hp-stale-banner">' +
            '<span class="font-semibold">Feed ' + sev + ' — last good read ' +
            HastraPrimeRenderer._hhmm(data.timestamp) + ' (' + age.toFixed(1) + 'h ago).</span> ' +
            'Values below are the last snapshot that passed every leg check, so they are internally consistent — ' +
            'but they are not current.' +
            '<div id="hp-last-attempt" class="text-xs mt-1 opacity-80"></div>' +
        '</div>';
    },

    /**
     * The dashboard JSON freezes at last-good on failure, so it cannot itself
     * say WHY it stopped. The last_attempt slot can — read it opportunistically
     * to name the failing leg. Absent file is fine: the banner already stands
     * on the timestamp alone.
     */
    _loadLastAttempt: function(data) {
        var el = document.getElementById('hp-last-attempt');
        if (!el) return;
        fetch('data/hastra_prime_backing_last_attempt.json?nocache=' + Math.floor(Date.now() / 60000))
            .then(function(r) { return r.ok ? r.json() : null; })
            .then(function(att) {
                if (!att || !att.timestamp) return;
                var attNewer = Date.parse(att.timestamp) > Date.parse(data.timestamp);
                if (!attNewer || att.stale !== true) return;
                var legs = Array.isArray(att.failed_legs) ? att.failed_legs : [];
                el.innerHTML = 'Most recent attempt ' + HastraPrimeRenderer._hhmm(att.timestamp) +
                    ' failed validation and was not published' +
                    (legs.length ? ': <span class="font-mono">' + legs.join(', ') + '</span>' : '') + '.';
            })
            .catch(function() { /* optional signal */ });
    },

    // ============================================================
    // §1 Collateralization — ours vs theirs
    // ============================================================
    _renderHeadline: function(data, spec, s) {
        var ours = spec.collateralization_pct != null ? spec.collateralization_pct : s.collateral_ratio;
        var theirs = HP_REPORT.por.collateralization_pct;
        var delta = (ours != null && theirs != null) ? (ours - theirs) : null;

        var state = HastraPrimeRenderer._gate(HastraPrimeRenderer._crState(ours));
        var cls = HastraPrimeRenderer._stateCls(state);

        var reserve = spec.reserve_ylds_total;
        var supply = spec.wylds_supply_total;
        var surplus = s.surplus_deficit;
        var provSupply = spec.provenance_ylds_supply;

        // How much of the reserve is the co-mingled account — the single
        // biggest reason our number and the issuer's can legitimately differ.
        var rb = spec.reserve_balances || {};
        var wb = rb.warehouse_b ? rb.warehouse_b.ylds : null;
        var wbShare = (wb != null && reserve) ? (wb / reserve * 100) : null;

        var gapNote = '';
        if (delta != null) {
            var dir = delta >= 0 ? 'above' : 'below';
            gapNote =
                '<p><span class="font-medium">Read this as a band, not a single number.</span> True wYLDS collateralization sits between ' +
                'Hastra’s designated <span class="font-mono">' + theirs.toFixed(2) + '%</span> and our all-reserve upper bound of ' +
                '<span class="font-mono">' + (ours != null ? ours.toFixed(2) : '—') + '%</span> — <span class="font-medium">both clear 100%, so ' +
                'backing sufficiency is independently confirmed</span>, even though the exact ratio is not independently pinnable.</p>' +
                '<p>Our reading is <span class="font-mono font-semibold">' + (delta >= 0 ? '+' : '') + delta.toFixed(2) + 'pp</span> ' +
                dir + ' the issuer’s. That gap is the panel — it is a <span class="font-medium">definition</span> difference, not ' +
                'necessarily a discrepancy: we sum the <span class="font-medium">entire</span> bank balance of every reserve account we can ' +
                'identify, including ' + (wbShare != null ? '<span class="font-mono">' + wbShare.toFixed(1) + '%</span> of the reserve sitting in ' : '') +
                'the co-mingled Warehouse B account, which also holds Figure loan-scope tokens. Hastra’s PoR counts a designated subset. ' +
                'Neither number is independently reconstructable from the labels the PoR page publishes — that is precisely why this monitor ' +
                'reads the raw balances instead.</p>';
        }

        return '<div class="panel">' +
            '<div class="flex items-start justify-between gap-4 mb-4">' +
                '<div>' +
                    '<div class="text-xl font-bold panel-title" style="margin:0">Collateralization — ours vs Hastra’s</div>' +
                    '<div class="text-xs text-slate-500 mt-1">Reserve YLDS on Provenance ÷ complete wYLDS supply (Solana + Ethereum), ' +
                        'computed from raw bank balances. Hastra’s Proof-of-Reserves page is not an input.</div>' +
                '</div>' +
                '<div class="text-right">' + HastraPrimeRenderer._pill('independent', 'ok') + '</div>' +
            '</div>' +
            '<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">' +
                HastraPrimeRenderer._tile('Upper-bound CR (chain)', HastraPrimeRenderer._pct(ours),
                    cls, HastraPrimeRenderer._unverified ? 'unverified — stale leg' : 'all identified reserve ÷ supply — a superset') +
                HastraPrimeRenderer._tile('Hastra PoR CR', HastraPrimeRenderer._pct(theirs), '',
                    'issuer-reported · ' + HP_REPORT.por.as_of) +
                HastraPrimeRenderer._tile('Gap', delta != null ? (delta >= 0 ? '+' : '') + delta.toFixed(2) + 'pp' : '—', '',
                    'ours − theirs') +
                HastraPrimeRenderer._tile('Reserve YLDS', HastraPrimeRenderer._tok(reserve), '',
                    'summed across ' + Object.keys(rb).length + ' accounts') +
                HastraPrimeRenderer._tile('wYLDS supply', HastraPrimeRenderer._tok(supply), '',
                    'both chains') +
                HastraPrimeRenderer._tile('Surplus / deficit',
                    (surplus != null ? (surplus >= 0 ? '+' : '') + HastraPrimeRenderer._tok(surplus) : '—'),
                    HastraPrimeRenderer._gate(surplus >= 0 ? 'ok' : 'critical') === 'ok' ? 'positive'
                        : HastraPrimeRenderer._unverified ? '' : 'negative',
                    'YLDS') +
            '</div>' +
            '<div class="text-sm text-slate-600 space-y-2">' + gapNote +
                (provSupply != null
                    ? '<p class="text-xs text-slate-400">Total YLDS in existence on Provenance is <span class="font-mono">' +
                      HastraPrimeRenderer._tok(provSupply) + '</span>; the reserve set above is the subset held by accounts we can ' +
                      'attribute to the wYLDS wrapper. A reserve reshuffle into an unattributed account would show up as ' +
                      'drift (see the reserve map).</p>'
                    : '') +
            '</div>' +
        '</div>';
    },

    // ============================================================
    // risk flags (bespoke strip — the common panel is hidden)
    // ============================================================
    _renderRiskFlags: function(data) {
        var flags = Array.isArray(data.risk_flags) ? data.risk_flags.slice() : [];
        if (!flags.length) {
            return '<div class="panel">' +
                '<div class="panel-title">Risk Flags</div>' +
                '<div class="text-sm"><span class="text-green-600 font-medium">No flags firing.</span> ' +
                '<span class="text-slate-500">Thresholds watched: CR &lt; 100%, per-chain backing break, redemption coverage &lt; ' +
                HP_THRESHOLDS.redeem_cov_warn.toFixed(2) + '×, reserve-account drift, mint/freeze authority change, top-holder step change.</span></div>' +
            '</div>';
        }
        var order = { critical: 0, warning: 1, info: 2 };
        flags.sort(function(a, b) {
            return (order[a.severity] != null ? order[a.severity] : 3) - (order[b.severity] != null ? order[b.severity] : 3);
        });
        var body = flags.map(function(f) {
            // Under the unverified gate a CRITICAL may be an artefact of the
            // failed leg, not a real event — de-escalate the styling and say so.
            var sev = (HastraPrimeRenderer._unverified && f.severity === 'critical') ? 'warning' : f.severity;
            var prefix = (HastraPrimeRenderer._unverified && f.severity === 'critical')
                ? '<span class="font-semibold">[unverified — stale snapshot]</span> ' : '';
            return '<div class="risk-flag risk-' + sev + '">' + prefix + (f.message || '') + '</div>';
        }).join('');
        return '<div class="panel">' +
            '<div class="panel-title">Risk Flags <span class="text-xs font-normal text-slate-400">— ' + flags.length + '</span></div>' +
            body +
        '</div>';
    },

    // ============================================================
    // §2 Backing reconciliation — per chain, never cross-compared
    // ============================================================
    _renderReconciliation: function(spec) {
        var recon = spec.backing_reconciliation || {};
        var tol = recon.tolerance_pct != null ? recon.tolerance_pct : HP_THRESHOLDS.recon_tolerance;
        var chains = [
            { key: 'solana',   label: 'Solana' },
            { key: 'ethereum', label: 'Ethereum' }
        ];

        var rows = chains.map(function(c) {
            var r = recon[c.key];
            if (!r) {
                return '<tr><td class="font-medium">' + c.label + '</td>' +
                    '<td colspan="6" class="text-slate-400">not reported in this snapshot</td></tr>';
            }
            // Solana reports the staking-vault ATA balance; Ethereum reports the
            // ERC-4626 vault's observed assets. Same concept, different key.
            var held = r.prime_vault_wylds != null ? r.prime_vault_wylds : r.observed_backing_wylds;
            var cov = r.coverage_pct;
            var broken = r.under_collateralized === true ||
                (cov != null && cov < 100 - tol);
            // Don't amber a rounding gap. Both vaults sit a few thousand wYLDS
            // off exact parity on a ~300M base (99.9994%); the analyzer's own
            // tolerance is what decides a break, so only warn once coverage has
            // eaten half of it. Anything tighter fires permanently and trains
            // the eye to ignore the column.
            var state = HastraPrimeRenderer._gate(
                broken ? 'critical'
                : (cov != null && cov < 100 - tol / 2) ? 'warn'
                : 'ok');
            var navIsCrossRef = typeof r.nav_source === 'string' && r.nav_source.indexOf('cross_chain_reference') >= 0;

            return '<tr>' +
                '<td class="font-medium">' + c.label + '</td>' +
                '<td class="text-right font-mono">' + HastraPrimeRenderer._tok(r.prime_supply) + '</td>' +
                '<td class="text-right font-mono">' + (r.nav_wylds_per_prime != null ? r.nav_wylds_per_prime.toFixed(6) : '—') +
                    (navIsCrossRef ? ' <span class="text-xs text-amber-600" title="NAV read on Solana and applied to the Ethereum vault">↔</span>' : '') + '</td>' +
                '<td class="text-right font-mono">' + HastraPrimeRenderer._tok(r.required_wylds) + '</td>' +
                '<td class="text-right font-mono">' + HastraPrimeRenderer._tok(held) + '</td>' +
                '<td class="text-right font-mono">' + (cov != null ? cov.toFixed(4) + '%' : '—') + '</td>' +
                '<td>' + HastraPrimeRenderer._verdictPill(
                    broken ? 'break' : (cov != null && cov < 100 - tol / 2) ? 'thin' : 'covered',
                    state) + '</td>' +
            '</tr>';
        }).join('');

        var sol = recon.solana || {};
        var oracleStale = sol.oracle_stale === true;

        return '<div class="panel">' +
            '<div class="panel-title">Backing Reconciliation ' +
                '<span class="text-xs font-normal text-slate-400">— PRIME vault holdings vs PRIME supply × NAV, per chain</span></div>' +
            '<div class="data-table-scroll"><table class="data-table">' +
                '<thead><tr>' +
                    '<th>Chain</th>' +
                    '<th class="text-right">PRIME supply</th>' +
                    '<th class="text-right">NAV (wYLDS/PRIME)</th>' +
                    '<th class="text-right">Required wYLDS</th>' +
                    '<th class="text-right">Held wYLDS</th>' +
                    '<th class="text-right">Cover</th>' +
                    '<th>Status</th>' +
                '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
            '<div class="flex flex-wrap items-center gap-2 mt-3">' +
                HastraPrimeRenderer._pill('tolerance ±' + tol + '%', 'neutral') +
                HastraPrimeRenderer._pill('NAV oracle ' + (oracleStale ? 'stale' : 'fresh'),
                    HastraPrimeRenderer._gate(oracleStale ? 'warn' : 'ok')) +
                (sol.nav_source ? HastraPrimeRenderer._pill(sol.nav_source, 'neutral') : '') +
            '</div>' +
            '<div class="text-xs text-slate-400 mt-2">' +
                'Reconciled <span class="font-medium">per chain, never pooled</span>: the Solana staking-vault ATA backs Solana PRIME, ' +
                'the Ethereum ERC-4626 vault backs Ethereum PRIME. Comparing the Solana vault against total PRIME supply would ' +
                'manufacture a ~46% phantom shortfall. The <span class="text-amber-600">↔</span> marker means NAV was read on Solana and ' +
                'applied to the Ethereum vault as a cross-chain reference — an assumption, and the place EVM↔Solana semantic drift ' +
                'would first show up.' +
            '</div>' +
        '</div>';
    },

    // ============================================================
    // §3 Redemption health
    // ============================================================
    _renderRedemption: function(spec) {
        var lb = spec.liquid_buffer || {};
        var bufUsd = spec.liquid_buffer_usd;
        var pending = spec.pending_redeem_wylds || {};
        var pendingSale = spec.ylds_pending_sale || {};
        var ratio = spec.redeem_coverage_ratio;

        var state = HastraPrimeRenderer._gate(
            ratio == null ? 'neutral'
            : ratio >= HP_THRESHOLDS.redeem_cov_warn ? 'ok'
            : ratio >= 1 ? 'warn' : 'critical');

        // Buffer vs queue, both in ~$1-face units.
        var queueUsd = pending.value;
        var maxSide = Math.max(bufUsd || 0, queueUsd || 0) || 1;

        return '<div class="panel">' +
            '<div class="panel-title">Redemption Health ' +
                '<span class="text-xs font-normal text-slate-400">— liquid buffer vs the pending queue</span></div>' +
            '<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">' +
                HastraPrimeRenderer._tile('Coverage ratio',
                    ratio != null ? ratio.toFixed(2) + '×' : '—',
                    HastraPrimeRenderer._stateCls(state), 'buffer ÷ pending queue') +
                HastraPrimeRenderer._tile('Liquid buffer', HastraPrimeRenderer._money(bufUsd), '',
                    'redeem vault only') +
                HastraPrimeRenderer._tile('Pending redemptions', HastraPrimeRenderer._tok(pending.value) + ' wYLDS', '',
                    (pending.request_count != null ? pending.request_count + ' open requests' : '')) +
                HastraPrimeRenderer._tile('YLDS pending sale',
                    pendingSale.value != null ? HastraPrimeRenderer._tok(pendingSale.value) : '—', '',
                    pendingSale.value == null ? 'not readable on-chain' : '') +
            '</div>' +

            '<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">' +
                '<div>' +
                    '<div class="text-xs text-slate-400 font-medium uppercase mb-1">Buffer composition</div>' +
                    HastraPrimeRenderer._bar([
                        { pct: bufUsd ? ((lb.redeem_vault_ylds || 0) / bufUsd * 100) : 0, color: '#6366f1', title: 'YLDS' },
                        { pct: bufUsd ? ((lb.redeem_vault_usdc || 0) / bufUsd * 100) : 0, color: '#22c55e', title: 'USDC' }
                    ]) +
                    '<div class="flex flex-wrap gap-3 text-xs text-slate-500 mt-1">' +
                        '<span><span class="inline-block w-2.5 h-2.5 rounded-sm mr-1 align-middle" style="background:#6366f1"></span>' +
                            HastraPrimeRenderer._num(lb.redeem_vault_ylds, 2) + ' YLDS</span>' +
                        '<span><span class="inline-block w-2.5 h-2.5 rounded-sm mr-1 align-middle" style="background:#22c55e"></span>' +
                            '$' + HastraPrimeRenderer._num(lb.redeem_vault_usdc, 2) + ' USDC</span>' +
                    '</div>' +
                '</div>' +
                '<div>' +
                    '<div class="text-xs text-slate-400 font-medium uppercase mb-1">Buffer vs queue</div>' +
                    HastraPrimeRenderer._bar([{ pct: (bufUsd || 0) / maxSide * 100, color: '#6366f1', title: 'Liquid buffer' }]) +
                    '<div class="mt-1"></div>' +
                    HastraPrimeRenderer._bar([{ pct: (queueUsd || 0) / maxSide * 100, color: '#f59e0b', title: 'Pending queue' }]) +
                    '<div class="flex flex-wrap gap-3 text-xs text-slate-500 mt-1">' +
                        '<span><span class="inline-block w-2.5 h-2.5 rounded-sm mr-1 align-middle" style="background:#6366f1"></span>' +
                            'buffer ' + HastraPrimeRenderer._money(bufUsd) + '</span>' +
                        '<span><span class="inline-block w-2.5 h-2.5 rounded-sm mr-1 align-middle" style="background:#f59e0b"></span>' +
                            'queue ' + HastraPrimeRenderer._tok(queueUsd) + ' wYLDS</span>' +
                    '</div>' +
                '</div>' +
            '</div>' +

            '<div class="data-table-scroll"><table class="data-table">' +
                '<thead><tr><th>Field</th><th class="text-right">Value</th><th>Source</th><th>Read from</th></tr></thead>' +
                '<tbody>' +
                    '<tr><td class="font-medium">Redeem-vault YLDS</td>' +
                        '<td class="text-right font-mono">' + HastraPrimeRenderer._num(lb.redeem_vault_ylds, 2) + '</td>' +
                        '<td>' + HastraPrimeRenderer._sourceBadge('provenance_bank') + '</td>' +
                        '<td class="text-xs text-slate-500">Provenance bank balance</td></tr>' +
                    '<tr><td class="font-medium">Redeem-vault USDC</td>' +
                        '<td class="text-right font-mono">' + HastraPrimeRenderer._num(lb.redeem_vault_usdc, 6) + '</td>' +
                        '<td>' + HastraPrimeRenderer._sourceBadge('provenance_bank') + '</td>' +
                        '<td class="text-xs text-slate-500">Provenance bank balance</td></tr>' +
                    '<tr><td class="font-medium">Pending redemptions</td>' +
                        '<td class="text-right font-mono">' + HastraPrimeRenderer._num(pending.value, 2) + '</td>' +
                        '<td>' + HastraPrimeRenderer._sourceBadge(pending.source) + '</td>' +
                        '<td class="text-xs text-slate-500">' + (pending.source || '—') +
                            (pending.program ? '<br>' + HastraPrimeRenderer._solLink(pending.program) : '') + '</td></tr>' +
                    '<tr><td class="font-medium">YLDS pending sale</td>' +
                        '<td class="text-right font-mono">' + (pendingSale.value != null ? HastraPrimeRenderer._num(pendingSale.value, 2) : '—') + '</td>' +
                        '<td>' + HastraPrimeRenderer._sourceBadge(pendingSale.source) + '</td>' +
                        '<td class="text-xs text-slate-500">' + (pendingSale.source || '—') + '</td></tr>' +
                '</tbody></table></div>' +

            '<div class="text-xs text-slate-400 mt-2">' +
                'The queue is read from the vault-mint program’s redemption-request accounts, so it is chain-verified rather than ' +
                'taken from the issuer’s dashboard. Read the ratio with the structure in mind: the buffer is <span class="font-medium">' +
                'not a standing USDC reserve</span> — it is almost entirely YLDS, and honouring redemptions means selling YLDS at Figure ' +
                'Markets (off-chain, market hours) and wiring USDC back. Orderly in calm conditions; there is nothing here to draw down in a run. ' +
                'The warn line is on the queue-growth side (&lt;' + HP_THRESHOLDS.redeem_cov_warn.toFixed(2) + '×), because a buffer-side ' +
                'threshold would fire permanently by design.' +
            '</div>' +
        '</div>';
    },

    // ============================================================
    // §4 Reserve map + drift
    // ============================================================
    _renderReserveMap: function(spec) {
        var rb = spec.reserve_balances || {};
        var total = spec.reserve_ylds_total || 0;
        var drift = Array.isArray(spec.reserve_account_drift) ? spec.reserve_account_drift : [];
        var driftKeys = {};
        drift.forEach(function(d) {
            var k = d.account || d.key || d.address;
            if (k) driftKeys[k] = d;
        });

        var keys = Object.keys(rb).sort(function(a, b) { return (rb[b].ylds || 0) - (rb[a].ylds || 0); });

        var rows = keys.map(function(k) {
            var acct = rb[k] || {};
            var role = HP_RESERVE_ROLES[k] || { label: k, note: '', kind: 'reserve' };
            var ylds = acct.ylds;
            var share = total ? (ylds / total * 100) : null;
            var d = driftKeys[k] || driftKeys[acct.address];
            var rowCls = role.kind === 'comingled' ? 'hp-comingled' : (!ylds ? 'hp-zero' : '');

            var marker = '';
            if (role.kind === 'comingled') marker = ' ' + HastraPrimeRenderer._pill('co-mingled', 'warn');
            else if (role.kind === 'unnamed') marker = ' ' + HastraPrimeRenderer._pill('unnamed on PoR', 'neutral');
            else if (role.kind === 'por_named') marker = ' ' + HastraPrimeRenderer._pill('PoR-named', 'neutral');
            else if (role.kind === 'liquid') marker = ' ' + HastraPrimeRenderer._pill('liquid', 'ok');

            return '<tr class="' + rowCls + '">' +
                '<td><div class="font-medium">' + role.label + marker + '</div>' +
                    '<div class="text-xs text-slate-400 mt-0.5">' + role.note + '</div></td>' +
                '<td>' + HastraPrimeRenderer._pbLink(acct.address) + '</td>' +
                '<td class="text-right font-mono">' + HastraPrimeRenderer._num(ylds, 2) + '</td>' +
                '<td class="text-right font-mono">' + (share != null ? share.toFixed(2) + '%' : '—') + '</td>' +
                '<td style="width:110px"><div class="pct-bar-container"><div class="pct-bar" style="width:' +
                    (share || 0) + '%;background:' + (role.kind === 'comingled' ? '#f59e0b' : '#6366f1') + '"></div></div></td>' +
                '<td>' + (d ? HastraPrimeRenderer._pill('drift', 'warn') : '') + '</td>' +
            '</tr>';
        }).join('');

        var driftBody;
        if (!drift.length) {
            driftBody = '<div class="text-sm"><span class="text-green-600 font-medium">No drift.</span> ' +
                '<span class="text-slate-500">Every account in the configured reserve set still holds its expected balance, and the live ' +
                '<span class="font-mono">denom_owners</span> enumeration surfaced no unexpected large YLDS holder' +
                (spec.denom_owners_complete === false ? ' <span class="text-amber-600">(enumeration incomplete this run)</span>' : '') +
                '.</span></div>';
        } else {
            driftBody = drift.map(function(d) {
                var label = d.account || d.address || 'unknown account';
                var msg = d.message || d.reason || d.type || '';
                return '<div class="risk-flag risk-warning">' +
                    '<span class="font-medium">' + label + '</span>' + (msg ? ' — ' + msg : '') +
                    (d.ylds != null ? ' <span class="font-mono">' + HastraPrimeRenderer._num(d.ylds, 2) + ' YLDS</span>' : '') +
                '</div>';
            }).join('');
        }

        // Largest YLDS holders not in the reserve set — the drift check's raw
        // material, useful even when nothing tripped.
        var top = spec.ylds_top_holders || {};
        var reserveAddrs = {};
        keys.forEach(function(k) { if (rb[k].address) reserveAddrs[rb[k].address] = true; });
        var outside = Object.keys(top)
            .filter(function(a) { return !reserveAddrs[a]; })
            .sort(function(a, b) { return top[b] - top[a]; })
            .slice(0, 5);

        var outsideRows = outside.map(function(a) {
            return '<tr><td>' + HastraPrimeRenderer._pbLink(a) + '</td>' +
                '<td class="text-right font-mono">' + HastraPrimeRenderer._num(top[a], 2) + '</td></tr>';
        }).join('');

        return '<div class="panel">' +
            '<div class="panel-title">Reserve Map ' +
                '<span class="text-xs font-normal text-slate-400">— where the YLDS actually sits, and whether it moved</span></div>' +
            '<div class="data-table-scroll"><table class="data-table">' +
                '<thead><tr><th>Account</th><th>Address</th><th class="text-right">YLDS</th>' +
                '<th class="text-right">% of reserve</th><th></th><th></th></tr></thead>' +
                '<tbody>' + rows + '</tbody></table></div>' +

            '<div class="risk-flag risk-info mt-3">' +
                '<span class="font-medium">Standing caveat, not an alert:</span> Warehouse B is <span class="font-medium">co-mingled</span> ' +
                'with Figure’s tokenized loan book — the same account holds <span class="font-mono">heloc.forge</span>, ' +
                '<span class="font-mono">nq.heloc.forge</span>, <span class="font-mono">rtl.forge</span> and ' +
                '<span class="font-mono">dscr.forge</span> denominations. It is a working account, not a ring-fenced reserve. This is a ' +
                'structural property of the design and is expected to be true on every run; it does not fire a flag, and its absence would ' +
                'be the surprising event. <a href="#hp-panel-warehouse" class="text-blue-600 hover:underline">Panel 8a measures the live ' +
                'warehouse inventory and turnover signal ↓</a>' +
            '</div>' +

            '<div class="text-sm font-semibold panel-title mt-4 mb-2" style="font-size:0.9rem">Drift check</div>' +
            driftBody +

            (outsideRows
                ? '<div class="text-sm font-semibold panel-title mt-4 mb-2" style="font-size:0.9rem">Largest YLDS holders outside the reserve set</div>' +
                  '<div class="data-table-scroll"><table class="data-table">' +
                  '<thead><tr><th>Address</th><th class="text-right">YLDS</th></tr></thead><tbody>' + outsideRows + '</tbody></table></div>' +
                  '<div class="text-xs text-slate-400 mt-2">These are ordinary YLDS holders, not reserve accounts. They are listed because a ' +
                  'reserve reshuffle would appear here first — as a new large holder — before any balance in the configured set changed.</div>'
                : '') +
        '</div>';
    },

    // ============================================================
    // §5 Supply by chain
    // ============================================================
    _renderSupplyByChain: function(spec) {
        var w = spec.wylds_supply_by_chain || {};
        var p = spec.prime_supply_by_chain || {};
        var wTot = spec.wylds_supply_total || ((w.solana || 0) + (w.ethereum || 0));
        var pTot = spec.prime_supply_total || ((p.solana || 0) + (p.ethereum || 0));

        var split = function(label, byChain, total) {
            var eth = byChain.ethereum || 0, sol = byChain.solana || 0;
            var ethPct = total ? eth / total * 100 : 0;
            var solPct = total ? sol / total * 100 : 0;
            return '<div>' +
                '<div class="flex items-baseline justify-between mb-1">' +
                    '<span class="text-xs text-slate-400 font-medium uppercase">' + label + '</span>' +
                    '<span class="font-mono text-xs text-slate-500">' + HastraPrimeRenderer._tok(total) + '</span>' +
                '</div>' +
                HastraPrimeRenderer._bar([
                    { pct: ethPct, color: '#6366f1', title: 'Ethereum' },
                    { pct: solPct, color: '#14b8a6', title: 'Solana' }
                ]) +
                '<div class="flex flex-wrap gap-3 text-xs text-slate-500 mt-1">' +
                    '<span><span class="inline-block w-2.5 h-2.5 rounded-sm mr-1 align-middle" style="background:#6366f1"></span>' +
                        'Ethereum ' + HastraPrimeRenderer._tok(eth) + ' (' + ethPct.toFixed(1) + '%)</span>' +
                    '<span><span class="inline-block w-2.5 h-2.5 rounded-sm mr-1 align-middle" style="background:#14b8a6"></span>' +
                        'Solana ' + HastraPrimeRenderer._tok(sol) + ' (' + solPct.toFixed(1) + '%)</span>' +
                '</div>' +
            '</div>';
        };

        var hasHistory = HastraPrimeRenderer._history &&
            Array.isArray(HastraPrimeRenderer._history.entries) &&
            HastraPrimeRenderer._history.entries.length >= 2;

        return '<div class="panel">' +
            '<div class="panel-title">Supply by Chain ' +
                '<span class="text-xs font-normal text-slate-400">— the Ethereum migration</span></div>' +
            '<div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">' +
                split('wYLDS', w, wTot) +
                split('PRIME', p, pTot) +
            '</div>' +
            (hasHistory
                ? '<div class="grid grid-cols-1 md:grid-cols-2 gap-6">' +
                      '<div><div class="text-xs text-slate-400 font-medium uppercase mb-1">wYLDS over time</div>' +
                          '<div style="height:200px;position:relative"><canvas id="hp-wylds-chart"></canvas></div></div>' +
                      '<div><div class="text-xs text-slate-400 font-medium uppercase mb-1">PRIME over time</div>' +
                          '<div style="height:200px;position:relative"><canvas id="hp-prime-chart"></canvas></div></div>' +
                  '</div>'
                : '<div class="text-xs text-slate-400">Not enough history yet to plot the split over time.</div>') +
            '<div class="text-xs text-slate-400 mt-3">' +
                'Ethereum is now the majority deployment for both tokens. That matters twice over: it is where the deep secondary exit ' +
                'lives, and it is why an Ethereum RPC failure would distort the headline collateralization more than a Solana one — the ' +
                'denominator is mostly Ethereum. It also adds multichain surface (EVM↔Solana drift) that a Solana-only deployment did not have.' +
            '</div>' +
        '</div>';
    },

    _drawSupplyCharts: function(spec) {
        var hist = HastraPrimeRenderer._history;
        if (!hist || !Array.isArray(hist.entries) || hist.entries.length < 2 || typeof Chart === 'undefined') return;
        var entries = hist.entries;
        var labels = entries.map(function(e) {
            return new Date(e.timestamp && e.timestamp.endsWith('Z') ? e.timestamp : e.timestamp + 'Z');
        });

        var mk = function(canvasId, chartKey, field) {
            var ctx = document.getElementById(canvasId);
            if (!ctx) return;
            var eth = entries.map(function(e) { return (e[field] || {}).ethereum; });
            var sol = entries.map(function(e) { return (e[field] || {}).solana; });
            if (window[chartKey]) window[chartKey].destroy();
            window[chartKey] = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        { label: 'Ethereum', data: eth, borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.35)',
                          fill: true, tension: 0.3, pointRadius: 0, borderWidth: 1.5 },
                        { label: 'Solana', data: sol, borderColor: '#14b8a6', backgroundColor: 'rgba(20,184,166,0.35)',
                          fill: true, tension: 0.3, pointRadius: 0, borderWidth: 1.5 }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    scales: {
                        x: { type: 'time', time: { unit: 'day', displayFormats: { day: 'MMM d' } },
                             grid: { display: false }, ticks: { maxTicksLimit: 5, font: { size: 10 } } },
                        y: { stacked: true, grid: { color: '#f1f5f9' },
                             ticks: { font: { size: 10 }, callback: function(v) { return (v / 1e6).toFixed(0) + 'M'; } } }
                    },
                    plugins: {
                        legend: { display: true, position: 'top', labels: { boxWidth: 10, font: { size: 10 } } },
                        annotation: { annotations: {} },
                        tooltip: { callbacks: { label: function(c) {
                            return c.dataset.label + ': ' + HastraPrimeRenderer._tok(c.raw);
                        } } }
                    },
                    interaction: { intersect: false, mode: 'index' }
                }
            });
        };

        mk('hp-wylds-chart', '_hpWyldsChart', 'wylds_supply_by_chain');
        mk('hp-prime-chart', '_hpPrimeChart', 'prime_supply_by_chain');
    },

    // ============================================================
    // §6 Control surface
    // ============================================================
    _renderControlSurface: function(spec) {
        var auth = spec.authority_state || {};
        var tokens = [
            { key: 'wylds', label: 'wYLDS', mint: HP_ADDR.wylds_sol_mint },
            { key: 'prime', label: 'PRIME', mint: HP_ADDR.prime_sol_mint }
        ];

        var rows = [];
        tokens.forEach(function(t) {
            var a = auth[t.key];
            if (!a) return;
            [
                { field: 'mint_authority', label: 'Mint authority' },
                { field: 'freeze_authority', label: 'Freeze authority' }
            ].forEach(function(f) {
                var cur = a[f.field];
                var exp = a['expected_' + f.field];
                var changed = a[f.field + '_changed'] === true;
                var state = HastraPrimeRenderer._gate(changed ? 'critical' : 'ok');
                rows.push('<tr>' +
                    '<td class="font-medium">' + t.label + ' ' + HastraPrimeRenderer._solLink(t.mint, 'token') + '</td>' +
                    '<td>' + f.label + '</td>' +
                    '<td>' + (cur ? HastraPrimeRenderer._solLink(cur) :
                        '<span class="text-slate-400 text-xs">renounced (null)</span>') + '</td>' +
                    '<td>' + (exp ? HastraPrimeRenderer._solLink(exp) : '<span class="text-slate-400 text-xs">—</span>') + '</td>' +
                    '<td>' + HastraPrimeRenderer._verdictPill(changed ? '✗ changed' : '✓ unchanged', state) + '</td>' +
                '</tr>');
            });
        });

        var holder = spec.top_prime_holder || {};
        var pct = spec.top_prime_holder_pct != null ? spec.top_prime_holder_pct : holder.pct;
        var concState = HastraPrimeRenderer._gate(
            pct == null ? 'neutral' : pct >= HP_THRESHOLDS.holder_conc_warn ? 'warn' : 'ok');
        var fallback = holder.largest_account_enumerated === false;

        var accounts = Array.isArray(holder.token_accounts) ? holder.token_accounts
            : (holder.token_account ? [holder.token_account] : []);

        return '<div class="panel">' +
            '<div class="panel-title">Control Surface ' +
                '<span class="text-xs font-normal text-slate-400">— who can mint, who can freeze, who holds</span></div>' +

            (rows.length
                ? '<div class="data-table-scroll"><table class="data-table">' +
                      '<thead><tr><th>Token</th><th>Authority</th><th>Current</th><th>Expected</th><th>State</th></tr></thead>' +
                      '<tbody>' + rows.join('') + '</tbody></table></div>'
                : '<div class="text-sm text-slate-400">Authority state not reported in this snapshot.</div>') +

            '<div class="risk-flag risk-warning mt-3">' +
                '<span class="font-medium">Live keys, not renounced.</span> Both mints retain an active mint authority <em>and</em> an active ' +
                'freeze authority at the token layer — not a renounced mint, and not behind a Squads multisig. "Unchanged" above means the ' +
                'keys still match the values we pinned; it does not mean the powers are absent. A holder’s balance can be frozen unilaterally.' +
            '</div>' +

            '<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 items-center">' +
                '<div style="height:150px;position:relative"><canvas id="hp-holder-chart"></canvas></div>' +
                '<div class="md:col-span-2">' +
                    '<div class="grid grid-cols-2 gap-3 mb-2">' +
                        HastraPrimeRenderer._tile('Top PRIME holder',
                            pct != null ? pct.toFixed(2) + '%' : '—',
                            concState === 'warn' ? 'warning' : '',
                            'of Solana PRIME supply') +
                        HastraPrimeRenderer._tile('Amount held',
                            HastraPrimeRenderer._tok(holder.amount) + ' PRIME', '',
                            holder.owner ? 'owner ' + HastraPrimeRenderer._solLink(holder.owner) : '') +
                    '</div>' +
                    (accounts.length
                        ? '<div class="text-xs text-slate-500">Token accounts: ' +
                          accounts.map(function(a) { return HastraPrimeRenderer._solLink(a); }).join(' · ') + '</div>'
                        : '') +
                    (fallback
                        ? '<div class="text-xs text-amber-600 mt-2">' +
                          '<span class="font-medium">Fallback enumeration.</span> ' +
                          '<span class="font-mono">getTokenLargestAccounts</span> did not return this run' +
                          (holder.enumeration_error ? ' (' + String(holder.enumeration_error).slice(0, 120) + '…)' : '') +
                          '; the figure is the balance of the known dominant owner’s accounts, so it is a floor on concentration ' +
                          'rather than a full ranking — a different holder could in principle be larger and unlisted.</div>'
                        : '') +
                '</div>' +
            '</div>' +

            '<div class="text-xs text-slate-400 mt-3">' +
                'A single EOA holding a supermajority of Solana PRIME is a governance-free but liquidity-relevant concentration: its exit ' +
                'would move through the same unbonding queue and the same secondary pools as everyone else’s.' +
            '</div>' +
        '</div>';
    },

    _drawHolderChart: function(spec) {
        var ctx = document.getElementById('hp-holder-chart');
        if (!ctx || typeof Chart === 'undefined') return;
        var pct = spec.top_prime_holder_pct;
        if (pct == null) return;
        if (window._hpHolderChart) window._hpHolderChart.destroy();
        window._hpHolderChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Top holder', 'Everyone else'],
                datasets: [{
                    data: [pct, Math.max(0, 100 - pct)],
                    backgroundColor: [pct >= HP_THRESHOLDS.holder_conc_warn ? '#f59e0b' : '#6366f1', '#e2e8f0'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '62%',
                plugins: {
                    legend: { display: false },
                    annotation: { annotations: {} },
                    tooltip: { callbacks: { label: function(c) { return c.label + ': ' + c.raw.toFixed(2) + '%'; } } }
                }
            }
        });
    },

    // ============================================================
    // §7 Liquidity & peg
    // ============================================================
    _renderLiquidity: function(data, spec) {
        var sol = spec.solana || {};
        var eth = spec.ethereum || {};
        var oracle = sol.prime_oracle || {};
        var price = data.price || {};

        var oracleStale = oracle.stale === true;
        var ageS = oracle.price_age_seconds;
        var maxS = oracle.price_max_staleness;

        var venueRows = HP_REPORT.liquidity.venues.map(function(v) {
            return '<tr>' +
                '<td class="font-medium">' + v.venue + '</td>' +
                '<td>' + v.chain + '</td>' +
                '<td class="text-right font-mono">' + (v.tvl_usd != null ? HastraPrimeRenderer._money(v.tvl_usd) : '—') + '</td>' +
                '<td class="text-right font-mono">' + (v.vol24h_usd != null ? HastraPrimeRenderer._money(v.vol24h_usd) : '—') + '</td>' +
                '<td class="text-right font-mono">' + (v.price != null ? '$' + v.price.toFixed(3) : '—') + '</td>' +
                '<td class="text-xs text-slate-500">' + v.note + '</td>' +
            '</tr>';
        }).join('');

        return '<div class="panel">' +
            '<div class="panel-title">Liquidity &amp; Peg ' +
                '<span class="text-xs font-normal text-slate-400">— NAV is live; venue depth is not</span></div>' +

            '<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">' +
                HastraPrimeRenderer._tile('PRIME NAV',
                    oracle.nav_wylds_per_prime != null ? oracle.nav_wylds_per_prime.toFixed(6) : '—', '',
                    'wYLDS per PRIME · on-chain oracle') +
                HastraPrimeRenderer._tile('Oracle age',
                    ageS != null ? Math.round(ageS / 60) + 'm' : '—',
                    HastraPrimeRenderer._gate(oracleStale ? 'warn' : 'ok') === 'warn' ? 'warning' : '',
                    maxS != null ? 'max ' + Math.round(maxS / 60) + 'm' : '') +
                HastraPrimeRenderer._tile('YLDS mark',
                    price.value != null ? '$' + price.value.toFixed(4) : '—', '',
                    price.source || '') +
                HastraPrimeRenderer._tile('Morpho vault wYLDS',
                    HastraPrimeRenderer._tok(eth.morpho_prime_wylds), '',
                    'Sentora PRIME Main · live') +
            '</div>' +

            '<div class="flex flex-wrap items-center gap-2 mb-3">' +
                HastraPrimeRenderer._pill('NAV oracle ' + (oracleStale ? 'stale' : 'fresh'),
                    HastraPrimeRenderer._gate(oracleStale ? 'warn' : 'ok')) +
                (oracle.pda ? HastraPrimeRenderer._pill('PDA ' + HastraPrimeRenderer._trunc(oracle.pda, 6, 4), 'neutral') : '') +
                (oracle.source ? HastraPrimeRenderer._pill(oracle.source, 'neutral') : '') +
                HastraPrimeRenderer._pill('Morpho vault ' + HastraPrimeRenderer._trunc(HP_ADDR.morpho_vault_eth, 6, 4), 'neutral') +
            '</div>' +

            '<div class="risk-flag risk-info mb-3">' +
                '<span class="font-medium">This monitor has no live DEX feed.</span> The four tiles above are read from chain every run; ' +
                'the venue table below is <span class="font-medium">not</span> — it is carried from the research report and only moves when ' +
                'that report is refreshed. Do not size an exit off it without re-checking depth.' +
            '</div>' +

            '<div class="flex items-center justify-between gap-2 mb-2">' +
                '<div class="text-sm font-semibold panel-title" style="font-size:0.9rem;margin:0">Secondary venues</div>' +
                HastraPrimeRenderer._reportBadge(HP_REPORT.liquidity.as_of) +
            '</div>' +
            '<div class="data-table-scroll"><table class="data-table">' +
                '<thead><tr><th>Venue</th><th>Chain</th><th class="text-right">TVL</th>' +
                '<th class="text-right">24h vol</th><th class="text-right">Price</th><th>Note</th></tr></thead>' +
                '<tbody>' + venueRows + '</tbody></table></div>' +

            '<div class="text-xs text-slate-400 mt-2">' +
                'The Ethereum Uniswap V3 pool is the only exit that does not route through the nil-buffer redeem pipeline, which makes it ' +
                'the load-bearing liquidity fact for this asset — and it is campaign-supported, so its durability is an open question rather ' +
                'than an established one. ' + HastraPrimeRenderer._link(HP_REPORT.url, 'Full report ↗') +
            '</div>' +
        '</div>';
    },

    // ============================================================
    // §8a HELOC warehouse turnover — live, chain-derived + EDGAR
    // ============================================================
    _renderWarehouse: function(data, spec) {
        var w = spec.warehouse || {};
        var sec = spec.securitization || {};
        var yr = spec.yield_realization || {};
        var monitor = spec.warehouse_monitoring_flags || {};
        var flags = Array.isArray(data.risk_flags) ? data.risk_flags : [];
        var failed = Array.isArray(data.failed_legs) ? data.failed_legs : [];
        var unverified = data.stale === true || failed.length > 0;
        var alertCodes = {
            securitization_cadence_stalled: true,
            prime_nav_accrual_below_target: true
        };
        var warehouseAlerts = flags.filter(function(f) { return alertCodes[f.code]; });
        var headlineState = unverified ? 'neutral' : (warehouseAlerts.length ? 'critical' : 'ok');
        var headlineLabel = unverified ? 'stale · last-good values' :
            (warehouseAlerts.length ? 'live threshold firing' : 'live monitoring');
        var tokens = w.loan_tokens || {};
        var tokenRows = Object.keys(tokens).sort().map(function(denom) {
            var row = tokens[denom] || {};
            return '<tr><td class="font-mono">' + denom + '</td>' +
                '<td class="text-right font-mono">' + HastraPrimeRenderer._num(row.balance, 0) + '</td>' +
                '<td class="text-right font-mono">' + HastraPrimeRenderer._num(row.supply, 0) + '</td>' +
                '<td>' + HastraPrimeRenderer._pill(
                    row.fully_in_warehouse ? '✓ fully in warehouse' : 'partial',
                    row.fully_in_warehouse ? 'ok' : 'warn') + '</td></tr>';
        }).join('');

        var hist = HastraPrimeRenderer._history;
        var warehouseHistory = hist && Array.isArray(hist.entries)
            ? hist.entries.filter(function(e) {
                return e.warehouse && e.warehouse.loan_token_total_native != null &&
                    e.warehouse.scope_count != null;
            }) : [];
        var hasHistory = warehouseHistory.length >= 2;
        var turnover = w.turnover || {};
        var loanTrend = turnover.loan_notional_delta_7d_pct != null
            ? (turnover.loan_notional_delta_7d_pct >= 0 ? '+' : '') +
                turnover.loan_notional_delta_7d_pct.toFixed(2) + '%'
            : 'insufficient history';
        var scopeTrend = turnover.scope_count_delta_7d != null
            ? (turnover.scope_count_delta_7d >= 0 ? '+' : '') +
                HastraPrimeRenderer._num(turnover.scope_count_delta_7d, 0)
            : 'insufficient history';

        var decimalsResolved = w.decimals_resolved === true;
        var hasUsd = decimalsResolved && w.usd_value != null;
        var cominglingPct = hasUsd && w.ylds_in_warehouse != null &&
            (w.usd_value + w.ylds_in_warehouse) > 0
            ? w.usd_value / (w.usd_value + w.ylds_in_warehouse) * 100 : null;
        var cominglingValue = cominglingPct != null ? cominglingPct.toFixed(1) + '%' : 'unresolved';
        var cominglingSub = cominglingPct != null ? 'loan assets ÷ loan assets + YLDS' :
            'loan-token decimals unavailable; no cross-unit ratio';

        var cadenceState = sec.available === false ? 'neutral' :
            (sec.days_since_last_deal != null && sec.trailing_median_gap_days != null &&
             sec.days_since_last_deal > 2 * sec.trailing_median_gap_days ? 'critical' : 'ok');
        if (unverified) cadenceState = 'neutral';
        var yield30 = yr.nav_accrual_apy_30d;
        var target = yr.target_apy;
        var yieldState = yield30 == null ? 'neutral' :
            (target != null && yield30 <= target - 2 ? 'critical' : 'ok');
        if (unverified || yr.oracle_stale === true) yieldState = 'neutral';
        var liveFlags = Array.isArray(monitor.live) ? monitor.live : [];
        var pendingFlags = Array.isArray(monitor.pending) ? monitor.pending : [];

        return '<div class="panel">' +
            '<div class="flex items-start justify-between gap-4 mb-3">' +
                '<div><div class="panel-title" style="margin:0">HELOC Warehouse — turnover</div>' +
                    '<div class="text-xs text-slate-500 mt-1">Live inventory, clearing cadence and realized NAV accrual — the leg that can strand capital.</div></div>' +
                HastraPrimeRenderer._pill(headlineLabel, headlineState) +
            '</div>' +

            (unverified
                ? '<div class="risk-flag risk-warning mb-4"><span class="font-semibold">Warehouse reads are stale — showing last-good values.</span> ' +
                  'A failed Provenance metadata or EDGAR request is not a turnover event, so warehouse verdicts are suppressed.</div>'
                : '') +

            '<div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">' +
                HastraPrimeRenderer._tile('Loan-token inventory',
                    w.loan_token_total_native != null ? HastraPrimeRenderer._num(w.loan_token_total_native, 0) : '—', '',
                    decimalsResolved ? (hasUsd ? HastraPrimeRenderer._money(w.usd_value) : 'decimals resolved; valuation unavailable') :
                        'native units · USD suppressed') +
                HastraPrimeRenderer._tile('Loan scopes',
                    w.scope_count != null ? HastraPrimeRenderer._num(w.scope_count, 0) : '—', '', scopeTrend + ' over 7d') +
                HastraPrimeRenderer._tile('Days since ABS-15G',
                    sec.days_since_last_deal != null ? HastraPrimeRenderer._num(sec.days_since_last_deal, 0) : '—',
                    HastraPrimeRenderer._stateCls(cadenceState),
                    'trailing median ' + (sec.trailing_median_gap_days != null ? sec.trailing_median_gap_days.toFixed(1) + 'd' : '—')) +
                HastraPrimeRenderer._tile('Co-mingling ratio', cominglingValue, '', cominglingSub) +
            '</div>' +

            '<div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-4">' +
                '<div><div class="text-xs text-slate-400 font-medium uppercase mb-2">Inventory on Warehouse B</div>' +
                    '<div class="data-table-scroll"><table class="data-table"><thead><tr><th>Denom</th>' +
                    '<th class="text-right">Balance</th><th class="text-right">Supply</th><th>Custody</th></tr></thead>' +
                    '<tbody>' + tokenRows + '</tbody></table></div>' +
                    '<div class="text-xs text-slate-400 mt-2">Balances are native units. ' +
                    (decimalsResolved ? 'Denom decimals are resolved.' :
                        'Provenance exposes no denom metadata for these loan tokens, so no decimal guess or USD scale is shown.') + '</div></div>' +
                '<div><div class="text-xs text-slate-400 font-medium uppercase mb-2">Inventory + scope-count trend</div>' +
                    (hasHistory
                        ? '<div style="height:230px;position:relative"><canvas id="hp-warehouse-chart"></canvas></div>'
                        : '<div class="text-sm text-slate-400 border border-slate-200 dark:border-slate-700 rounded-lg p-4">' +
                          '<span class="font-medium">Insufficient history.</span> At least two warehouse observations are required; a single point is not a trend.</div>') +
                    '<div class="grid grid-cols-2 gap-3 mt-3">' +
                        HastraPrimeRenderer._tile('Loan notional 7d', loanTrend, '', 'threshold pending') +
                        HastraPrimeRenderer._tile('Scope count 7d', scopeTrend, '', 'threshold pending') +
                    '</div></div>' +
            '</div>' +

            '<div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-4">' +
                '<div><div class="text-xs text-slate-400 font-medium uppercase mb-2">Securitization cadence</div>' +
                    '<div class="grid grid-cols-2 gap-3">' +
                        HastraPrimeRenderer._tile('Deals TTM', sec.deals_ttm != null ? String(sec.deals_ttm) : '—') +
                        HastraPrimeRenderer._tile('Threshold', 'live', HastraPrimeRenderer._stateCls(cadenceState),
                            'alert above 2× trailing median') +
                    '</div><div class="text-xs text-slate-400 mt-2">Source: EDGAR ABS-15G filings. ' +
                        (sec.source_caveat || '') + '</div></div>' +
                '<div><div class="text-xs text-slate-400 font-medium uppercase mb-2">Realized NAV accrual vs target</div>' +
                    '<div class="grid grid-cols-3 gap-3">' +
                        HastraPrimeRenderer._tile('7d APY', yr.nav_accrual_apy_7d != null ? yr.nav_accrual_apy_7d.toFixed(2) + '%' : '—') +
                        HastraPrimeRenderer._tile('30d APY', yield30 != null ? yield30.toFixed(2) + '%' : '—',
                            HastraPrimeRenderer._stateCls(yieldState)) +
                        HastraPrimeRenderer._tile('Target', target != null ? target.toFixed(1) + '%' : '—') +
                    '</div><div class="text-xs text-slate-400 mt-2"><span class="font-medium">Issuer-administered NAV:</span> ' +
                        (yr.source_caveat || 'This is a lagging symptom gauge, not an independent impairment read.') + '</div></div>' +
            '</div>' +

            '<div class="risk-flag risk-info mb-3"><span class="font-medium">Co-mingling, quantified when units permit:</span> ' +
                (w.loan_vs_ylds_note || 'Warehouse B holds both loan tokens and YLDS.') + ' ' +
                '<a href="#hp-panel-reserves" class="text-blue-600 hover:underline">See the reserve-map custody caveat ↑</a></div>' +

            '<div class="flex flex-wrap gap-1.5">' +
                liveFlags.map(function(f) {
                    return HastraPrimeRenderer._pill('live · ' + f.code, unverified ? 'neutral' : 'ok');
                }).join('') +
                pendingFlags.map(function(f) {
                    return HastraPrimeRenderer._pill('pending · ' + f.metric, 'warn');
                }).join('') +
            '</div>' +
        '</div>';
    },

    _drawWarehouseChart: function() {
        var hist = HastraPrimeRenderer._history;
        if (!hist || !Array.isArray(hist.entries) || typeof Chart === 'undefined') return;
        var entries = hist.entries.filter(function(e) {
            return e.warehouse && e.warehouse.loan_token_total_native != null &&
                e.warehouse.scope_count != null;
        });
        if (entries.length < 2) return;
        var ctx = document.getElementById('hp-warehouse-chart');
        if (!ctx) return;
        if (window._hpWarehouseChart) window._hpWarehouseChart.destroy();
        window._hpWarehouseChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: entries.map(function(e) { return new Date(e.timestamp); }),
                datasets: [
                    { label: 'Loan-token inventory (native)', data: entries.map(function(e) {
                        return e.warehouse.loan_token_total_native;
                    }), borderColor: '#6366f1', yAxisID: 'y', tension: 0.25, pointRadius: 1, borderWidth: 2 },
                    { label: 'Loan scopes', data: entries.map(function(e) {
                        return e.warehouse.scope_count;
                    }), borderColor: '#14b8a6', yAxisID: 'y1', tension: 0.25, pointRadius: 1, borderWidth: 2 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { intersect: false, mode: 'index' },
                scales: {
                    x: { type: 'time', time: { unit: 'day', displayFormats: { day: 'MMM d' } },
                         grid: { display: false }, ticks: { maxTicksLimit: 5, font: { size: 10 } } },
                    y: { position: 'left', grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } },
                    y1: { position: 'right', grid: { drawOnChartArea: false }, ticks: { precision: 0, font: { size: 10 } } }
                },
                plugins: { legend: { position: 'top', labels: { boxWidth: 10, font: { size: 10 } } } }
            }
        });
    },

    // ============================================================
    // §8b HELOC credit proxy — issuer-reported, permanently opaque
    // ============================================================
    _renderHelocCredit: function() {
        var h = HP_REPORT.heloc;
        var iss = h.issuer, px = h.proxy, dq = h.figure_delinquency;

        var caveats = h.caveats.map(function(c) {
            return '<li>' + c + '</li>';
        }).join('');

        return '<div class="panel">' +
            '<div class="flex items-start justify-between gap-4 mb-3">' +
                '<div>' +
                    '<div class="panel-title" style="margin:0">HELOC Warehouse — credit proxy</div>' +
                    '<div class="text-xs text-slate-500 mt-1">PRIME’s yield comes from financing Figure-originated HELOCs ' +
                        'pre-securitization, not from Treasuries. This is the credit leg.</div>' +
                '</div>' +
                '<div class="text-right whitespace-nowrap">' +
                    HastraPrimeRenderer._pill('issuer-proxy — not independently verified', 'warn') +
                '</div>' +
            '</div>' +

            '<div class="risk-flag risk-warning mb-4">' +
                '<span class="font-semibold">Everything in this panel sits outside the chain-verified set.</span> Panels 1–7 above are ' +
                'recomputed from Provenance, Solana and Ethereum on every run. Nothing here is: these are issuer disclosures and ' +
                'third-party ratings figures, refreshed only when the research report is. Treat this as a monitored proxy with a standing ' +
                'opacity caveat, not a metric. ' + HastraPrimeRenderer._reportBadge(h.as_of) +
            '</div>' +

            '<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">' +
                '<div>' +
                    '<div class="text-xs text-slate-400 font-medium uppercase mb-2">Issuer-reported loan pool</div>' +
                    '<div class="grid grid-cols-2 gap-3 mb-2">' +
                        HastraPrimeRenderer._tile('Avg LTV', iss.avg_ltv_pct.toFixed(2) + '%') +
                        HastraPrimeRenderer._tile('Avg FICO', iss.avg_fico.toFixed(0)) +
                        HastraPrimeRenderer._tile('Avg coupon', iss.avg_coupon_pct.toFixed(2) + '%') +
                        HastraPrimeRenderer._tile('Cum. gross loss', iss.cum_gross_loss) +
                    '</div>' +
                    '<div class="text-xs text-slate-400">' + iss.source + '</div>' +
                '</div>' +
                '<div>' +
                    '<div class="text-xs text-slate-400 font-medium uppercase mb-2">Independent proxy — rated securitizations</div>' +
                    '<div class="grid grid-cols-2 gap-3 mb-2">' +
                        HastraPrimeRenderer._tile('WA FICO', '~' + px.wa_fico) +
                        HastraPrimeRenderer._tile('Orig. CLTV', '~' + px.orig_cltv_pct + '%') +
                    '</div>' +
                    '<div class="text-xs text-slate-400">' + px.source + '</div>' +
                    '<div class="text-xs text-slate-500 mt-2">The issuer’s figures are <span class="font-medium">consistent</span> with ' +
                        'these independently-rated deals — reassuring, but the warehouse’s own book is a different pool.</div>' +
                '</div>' +
            '</div>' +

            '<div class="text-xs text-slate-400 font-medium uppercase mt-5 mb-2">Parent-originator signal</div>' +
            '<div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-2">' +
                HastraPrimeRenderer._tile('Delinquency 2024', dq.y2024_pct.toFixed(2) + '%') +
                HastraPrimeRenderer._tile('Delinquency 2025', dq.y2025_pct.toFixed(2) + '%', 'warning',
                    '+' + (dq.y2025_pct - dq.y2024_pct).toFixed(2) + 'pp YoY') +
                HastraPrimeRenderer._tile('Trend', '↑ rising', 'warning', 'loans held for sale') +
            '</div>' +
            '<div class="text-xs text-slate-400">' + dq.source + '. ' + dq.note + '</div>' +

            '<div class="text-xs text-slate-500 mt-4">' +
                '<div class="risk-flag risk-info mb-3"><span class="font-semibold">Why this can never become a live public panel:</span> ' +
                    'a live loan-scope read exposes 16 record names, but every record value is only a SHA-256 hash. The payloads live in ' +
                    'Provenance’s permissioned Object Store. Schema and record names are public; loan data is not. With no Reg-AB tape ' +
                    'for this 144A warehouse, per-loan delinquency, LTV/FICO, cure rates and loss severity are structurally unobservable.</div>' +
                '<span class="font-medium text-slate-600">Standing proxy caveats:</span>' +
                '<ul class="list-disc ml-5 mt-1 space-y-1">' + caveats + '</ul>' +
            '</div>' +
        '</div>';
    },

    // ============================================================
    // Data provenance — the independence claim, made auditable
    // ============================================================
    _renderDataProvenance: function(data, spec) {
        var ds = spec.data_sources || {};
        var dq = spec.data_quality || {};
        var legs = dq.core_legs || {};
        var failed = Array.isArray(dq.failed_core_legs) ? dq.failed_core_legs : [];
        var fetchErrors = Array.isArray(dq.fetch_errors) ? dq.fetch_errors : [];

        // Flatten the nested core-legs tree into leaf paths.
        var leaves = [];
        (function walk(node, path) {
            Object.keys(node || {}).forEach(function(k) {
                var v = node[k];
                var p = path ? path + '.' + k : k;
                if (v && typeof v === 'object') walk(v, p);
                else leaves.push({ path: p, ok: v === true });
            });
        })(legs, '');

        var okCount = leaves.filter(function(l) { return l.ok; }).length;

        var chips = leaves.map(function(l) {
            return HastraPrimeRenderer._pill(l.path, l.ok ? 'ok' : 'critical');
        }).join(' ');

        var lcds = Array.isArray(ds.provenance_lcd) ? ds.provenance_lcd : (ds.provenance_lcd ? [ds.provenance_lcd] : []);

        return '<div class="panel">' +
            '<div class="panel-title">Data Provenance &amp; Leg Health ' +
                '<span class="text-xs font-normal text-slate-400">— what this snapshot was built from</span></div>' +

            '<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">' +
                HastraPrimeRenderer._tile('Core legs',
                    okCount + ' / ' + leaves.length,
                    failed.length ? 'negative' : 'positive', 'succeeded this run') +
                HastraPrimeRenderer._tile('Issuer PoR used',
                    ds.issuer_por_used === true ? 'yes' : 'no',
                    ds.issuer_por_used === true ? 'warning' : 'positive',
                    ds.issuer_por_used === true ? 'a field fell back to the issuer' : 'fully independent') +
                HastraPrimeRenderer._tile('Snapshot',
                    HastraPrimeRenderer._hhmm(data.timestamp), '',
                    data.stale === true ? 'flagged stale' : 'passed validation') +
                HastraPrimeRenderer._tile('Fetch warnings',
                    String(fetchErrors.length),
                    fetchErrors.length ? 'warning' : 'positive',
                    'non-fatal retries / fallbacks') +
            '</div>' +

            '<div class="data-table-scroll"><table class="data-table">' +
                '<thead><tr><th>Source</th><th>Endpoint</th></tr></thead><tbody>' +
                    lcds.map(function(u) {
                        return '<tr><td class="font-medium">Provenance LCD</td><td class="font-mono text-xs">' + u + '</td></tr>';
                    }).join('') +
                    '<tr><td class="font-medium">Solana RPC</td><td class="font-mono text-xs">' + (ds.solana_rpc || '—') + '</td></tr>' +
                    '<tr><td class="font-medium">Ethereum RPC</td><td class="font-mono text-xs">' + (ds.ethereum_rpc || '—') + '</td></tr>' +
                '</tbody></table></div>' +

            '<div class="text-xs text-slate-400 font-medium uppercase mt-4 mb-2">Per-leg result</div>' +
            '<div class="flex flex-wrap gap-1.5">' + chips + '</div>' +

            (fetchErrors.length
                ? '<div class="text-xs text-slate-500 mt-3"><span class="font-medium">Non-fatal fetch warnings:</span><ul class="list-disc ml-5 mt-1">' +
                  fetchErrors.slice(0, 5).map(function(e) { return '<li class="font-mono">' + String(e).slice(0, 160) + '</li>'; }).join('') +
                  '</ul></div>'
                : '') +

            '<div class="text-xs text-slate-400 mt-3">' +
                'Every leg must succeed for a snapshot to publish. If any fails, the analyzer writes the attempt to a side file and leaves ' +
                'this dashboard on its last good read rather than publishing a ratio with a hole in it — the failure mode that produced a ' +
                'false 48.55% CRITICAL on the USDD dashboard in July 2026.' +
            '</div>' +
        '</div>';
    },

    // ============================================================
    // anchor nav
    // ============================================================
    _setupAnchorNav: function() {
        var navEl = document.getElementById('asset-anchor-nav');
        var inner = document.getElementById('asset-anchor-nav-inner');
        if (!navEl || !inner) return;
        var items = [
            { id: 'hp-panel-headline',   label: 'Ours vs theirs' },
            { id: 'chart-panel',         label: 'CR history' },
            { id: 'hp-panel-recon',      label: 'Reconciliation' },
            { id: 'hp-panel-redemption', label: 'Redemption' },
            { id: 'hp-panel-reserves',   label: 'Reserve map' },
            { id: 'hp-panel-supply',     label: 'Supply' },
            { id: 'hp-panel-control',    label: 'Control' },
            { id: 'hp-panel-liquidity',  label: 'Liquidity' },
            { id: 'hp-panel-warehouse',  label: 'HELOC turnover' },
            { id: 'hp-panel-heloc-credit', label: 'HELOC credit proxy' },
            { id: 'hp-panel-provenance', label: 'Provenance' }
        ];
        inner.innerHTML = items.map(function(item) {
            return '<a href="#' + item.id + '" ' +
                'class="text-slate-600 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400 px-2 py-0.5 rounded transition-colors">' +
                item.label + '</a>';
        }).join('');
        navEl.classList.remove('hidden');
    }
};
