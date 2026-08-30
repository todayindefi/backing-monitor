/**
 * Common renderer — handles generic sections shared by all assets.
 */

// 5-axis rating thresholds. Namespaced top-level const (renderer files share JS
// global scope — see the cross-file collision rule). Cutoffs map a metric to a
// 1–5 rating; per-asset overrides come via data.asset_specific.axis_thresholds.
var RISK_AXIS_THRESHOLDS = {
    peg:       { abs_dev_pct: [0.15, 0.30, 0.50, 1.0] },  // 5/4/3/2 cutoffs (smaller = better); else 1
    liquidity: { depth_usd:   [2e6, 1e6, 5e5, 1e5] },     // 5/4/3/2 cutoffs (larger = better); else 1
    backing:   { cr_pct:      [130, 110, 100, 90] }       // 5/4/3/2 cutoffs (larger = better); else 1
};

const CommonRenderer = {

    // ------ Collateral-ratio scale resolution ------
    //
    // Feeds disagree on units: USDm publishes collateral_ratio as a RAW ratio
    // (1.296) while every other feed publishes percent (129.60). This used to
    // be resolved with `if (cr < 2) cr *= 100` — inferring the unit from the
    // value's magnitude. That is the same class of bug as guessing token
    // decimals from a number's size: correct until the value enters the
    // ambiguous range, then silently and confidently wrong.
    //
    // It fails BOTH ways. A raw feed reaching 2.0 (double-collateralised, the
    // healthiest state it can reach) rendered as "2.00%". A percent feed
    // falling below 2% (near-total loss of backing) would be multiplied to
    // "150%" and coloured green.
    //
    // Resolution order — never magnitude:
    //   1. summary.collateral_ratio_scale, if the feed declares it
    //   2. RAW_CR_ASSETS, an explicit per-asset list
    //   3. default: percent, returned unchanged
    //
    // The default is deliberate. An undeclared raw feed renders alarmingly low
    // and gets investigated; the reverse — a distressed feed silently rendered
    // healthy — is the failure that sits on a public page unnoticed.
    // Retired 2026-08-27: usdm now declares collateral_ratio_scale on both blocks,
    // so the declared branch resolves it and a per-asset list encoding producer
    // knowledge in the consumer is no longer needed. Kept empty rather than
    // deleted so the resolution order below still reads as three steps, and so
    // re-adding an entry is visibly a fallback rather than the normal path.
    RAW_CR_ASSETS: [],

    normalizeCollateralRatio(value, assetSlug, summary) {
        if (value === null || value === undefined) return value;
        var declared = summary && summary.collateral_ratio_scale;
        if (declared === 'percent') return value;
        if (declared === 'ratio') return value * 100;
        if (declared) return value;  // unrecognised declaration: trust it as-is
        if (assetSlug && CommonRenderer.RAW_CR_ASSETS.indexOf(assetSlug) !== -1) {
            return value * 100;
        }
        return value;
    },

    formatCurrency(num) {
        if (num === null || num === undefined) return '-';
        if (Math.abs(num) >= 1e6) return '$' + (num / 1e6).toFixed(1) + 'M';
        if (Math.abs(num) >= 1e3) return '$' + (num / 1e3).toFixed(1) + 'K';
        return '$' + num.toFixed(0);
    },

    formatCurrencyExact(num) {
        if (num === null || num === undefined) return '-';
        return '$' + num.toLocaleString('en-US', { maximumFractionDigits: 0 });
    },

    formatPercent(num, decimals) {
        if (num === null || num === undefined) return '-';
        decimals = decimals !== undefined ? decimals : 2;
        return num.toFixed(decimals) + '%';
    },

    formatDate(isoString) {
        if (!isoString) return '-';
        var utc = isoString.endsWith('Z') ? isoString : isoString + 'Z';
        return new Date(utc).toLocaleString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
        });
    },

    // ------ Peg / NAV-spread shared helpers ------
    // Threshold mirrors the Layer-3 alerter:
    //   <0.25% → Healthy (ok)
    //   <0.50% → Watch   (warn)
    //   ≥0.50% → Stress  (critical)
    // Absolute value — premium and discount of equal magnitude get the same severity.
    pegStatusClass(pctValue) {
        if (pctValue == null) return 'unknown';
        var abs = Math.abs(pctValue);
        if (abs < 0.25) return 'ok';
        if (abs < 0.50) return 'warn';
        return 'critical';
    },

    pegStatusLabel(state) {
        if (state === 'ok') return 'Healthy';
        if (state === 'warn') return 'Watch';
        if (state === 'critical') return 'Stress';
        return '—';
    },

    pegPctText(pct, decimals) {
        if (pct == null) return '—';
        decimals = decimals != null ? decimals : 3;
        var sign = pct >= 0 ? '+' : '';
        return sign + pct.toFixed(decimals) + '%';
    },

    pegPctClass(state) {
        if (state === 'ok') return 'text-green-600';
        if (state === 'warn') return 'text-amber-600';
        if (state === 'critical') return 'text-red-600';
        return 'text-slate-500';
    },

    // ±25 / ±50 / ±100 bps reference bands for peg/spread charts.
    pegBandAnnotations() {
        return {
            healthyBand:   { type: 'box', yMin: -0.25, yMax: 0.25, backgroundColor: 'rgba(34, 197, 94, 0.07)', borderWidth: 0 },
            watchBandPos:  { type: 'box', yMin: 0.25, yMax: 0.50, backgroundColor: 'rgba(245, 158, 11, 0.06)', borderWidth: 0 },
            watchBandNeg:  { type: 'box', yMin: -0.50, yMax: -0.25, backgroundColor: 'rgba(245, 158, 11, 0.06)', borderWidth: 0 },
            stressBandPos: { type: 'box', yMin: 0.50, yMax: 1.00, backgroundColor: 'rgba(239, 68, 68, 0.06)', borderWidth: 0 },
            stressBandNeg: { type: 'box', yMin: -1.00, yMax: -0.50, backgroundColor: 'rgba(239, 68, 68, 0.06)', borderWidth: 0 },
            line25pos:  { type: 'line', yMin: 0.25,  yMax: 0.25,  borderColor: '#22c55e', borderWidth: 1, borderDash: [3, 3], label: { content: '+25 bps', display: true, position: 'end', font: { size: 9 }, color: '#16a34a' } },
            line25neg:  { type: 'line', yMin: -0.25, yMax: -0.25, borderColor: '#22c55e', borderWidth: 1, borderDash: [3, 3], label: { content: '-25 bps', display: true, position: 'end', font: { size: 9 }, color: '#16a34a' } },
            line50pos:  { type: 'line', yMin: 0.50,  yMax: 0.50,  borderColor: '#f59e0b', borderWidth: 1, borderDash: [3, 3], label: { content: '+50 bps', display: true, position: 'end', font: { size: 9 }, color: '#d97706' } },
            line50neg:  { type: 'line', yMin: -0.50, yMax: -0.50, borderColor: '#f59e0b', borderWidth: 1, borderDash: [3, 3], label: { content: '-50 bps', display: true, position: 'end', font: { size: 9 }, color: '#d97706' } },
            line100pos: { type: 'line', yMin: 1.00,  yMax: 1.00,  borderColor: '#ef4444', borderWidth: 1, borderDash: [3, 3], label: { content: '+100 bps', display: true, position: 'end', font: { size: 9 }, color: '#dc2626' } },
            line100neg: { type: 'line', yMin: -1.00, yMax: -1.00, borderColor: '#ef4444', borderWidth: 1, borderDash: [3, 3], label: { content: '-100 bps', display: true, position: 'end', font: { size: 9 }, color: '#dc2626' } },
            zero:       { type: 'line', yMin: 0,     yMax: 0,     borderColor: '#94a3b8', borderWidth: 1 }
        };
    },

    // ------ Summary cards ------
    renderSummaryCards(data) {
        var s = data.summary;
        var displaySupply = s.circulating_supply || s.tvl_ex_pol || s.total_supply;
        var supplyLabel = (s.circulating_supply || s.tvl_ex_pol) ? 'Circulating Supply' : 'Total Supply';
        // Vault-share assets (1 unit ≠ $1) opt out of dollar formatting via summary.supply_unit.
        var supplyValue;
        if (s.supply_unit === 'shares') {
            supplyValue = (displaySupply || 0).toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' shares';
        } else {
            supplyValue = this.formatCurrencyExact(displaySupply);
        }

        var cards = [
            { label: supplyLabel, value: supplyValue },
            { label: 'Total Backing', value: this.formatCurrencyExact(s.total_backing) },
            { label: 'Collateral Ratio', value: this.formatPercent(s.collateral_ratio), cls: s.collateral_ratio >= 100 ? 'positive' : 'negative' },
            { label: s.collateral_ratio_alt.label, value: s.collateral_ratio_alt.is_currency ? this.formatCurrency(s.collateral_ratio_alt.value) : this.formatPercent(s.collateral_ratio_alt.value), cls: s.collateral_ratio_alt.is_currency ? '' : (s.collateral_ratio_alt.value >= 100 ? 'positive' : 'warning') },
            { label: 'Surplus / Deficit', value: this.formatCurrencyExact(s.surplus_deficit), cls: s.surplus_deficit >= 0 ? 'positive' : 'negative' },
        ];

        // Asset-specific renderers can prepend extra cards (e.g. NAV for vault shares).
        var spec = data.asset_specific || {};
        if (Array.isArray(spec.extra_summary_cards)) {
            cards = spec.extra_summary_cards.concat(cards);
        }
        // Asset-specific renderers can override individual cards by label
        // (e.g. relabel "Collateral Ratio" → "Pool Coverage Ratio" + add subtext).
        // An override with `hidden: true` removes the card entirely.
        var overrides = spec.card_overrides;
        if (overrides && typeof overrides === 'object') {
            cards = cards.map(function(c) {
                var ov = overrides[c.label];
                if (!ov) return c;
                return Object.assign({}, c, ov);
            }).filter(function(c) { return !c.hidden; });
        }

        var container = document.getElementById('summary-cards');
        container.innerHTML = cards.map(function(c) {
            return '<div class="summary-card">' +
                '<div class="card-label">' + c.label + '</div>' +
                (c.prefix_html ? c.prefix_html : '') +
                '<div class="card-value ' + (c.cls || '') + '">' + c.value + '</div>' +
                (c.subtext ? '<div class="text-xs text-slate-400 mt-1">' + c.subtext + '</div>' : '') +
                (c.extra_html ? c.extra_html : '') +
                '</div>';
        }).join('');
    },

    // Legacy top-level backing_breakdown vs the 5-axis backing.breakdown.
    //
    // Bespoke renderers either synthesise the legacy field or hide this table, so
    // the unguarded data.backing_breakdown.map() below only ever saw feeds that
    // had it. susds is the first GENERIC-path asset emitting the 5-axis shape
    // only, and it threw "Cannot read properties of undefined (reading 'map')" —
    // which fails the WHOLE page, not just the table. Every future 5-axis-only
    // asset would hit the same wall.
    //
    // Falls back to the publisher's own backing.breakdown rather than deriving
    // anything; `tags` is optional there, so it is defaulted at the read site.
    _backingBreakdown(data) {
        if (data && Array.isArray(data.backing_breakdown)) return data.backing_breakdown;
        if (data && data.backing && Array.isArray(data.backing.breakdown)) return data.backing.breakdown;
        return [];
    },

    // ------ Backing breakdown table ------
    renderBreakdownTable(data) {
        var tbody = document.querySelector('#breakdown-table tbody');
        var bd = CommonRenderer._backingBreakdown(data);
        if (!bd.length) { var bp = tbody && tbody.closest('.panel'); if (bp) bp.style.display = 'none'; return; }
        var rows = bd.map(function(item) {
            // `tags` is optional in the 5-axis backing.breakdown shape. Normalise
            // once here rather than guarding each read — the previous fix guarded
            // .map and the very next line still threw on .indexOf.
            var itemTags = Array.isArray(item.tags) ? item.tags : [];
            var tags = itemTags.map(function(t) {
                return '<span class="tag tag-' + t + '">' + t + '</span>';
            }).join('');
            var barColor = itemTags.indexOf('amo') >= 0 ? '#ef4444' :
                           itemTags.indexOf('cross-chain') >= 0 ? '#3b82f6' :
                           itemTags.indexOf('idle') >= 0 ? '#22c55e' : '#6366f1';
            return '<tr>' +
                '<td class="font-medium">' + item.label + tags + '</td>' +
                '<td class="text-right font-mono">' + CommonRenderer.formatCurrencyExact(item.value) + '</td>' +
                '<td class="text-right font-mono">' + CommonRenderer.formatPercent(item.pct, 1) + '</td>' +
                '<td><div class="pct-bar-container"><div class="pct-bar" style="width:' + item.pct + '%; background:' + barColor + '"></div></div></td>' +
                '</tr>';
        });

        // Total row
        var total = bd.reduce(function(sum, i) { return sum + i.value; }, 0);
        rows.push(
            '<tr class="font-bold border-t-2 border-slate-200">' +
            '<td>Total</td>' +
            '<td class="text-right font-mono">' + CommonRenderer.formatCurrencyExact(total) + '</td>' +
            '<td class="text-right">100%</td>' +
            '<td></td></tr>'
        );
        tbody.innerHTML = rows.join('');

        // Basis caption: the % column is each line's share of the displayed
        // backing pie (the 100% row), NOT share of token supply. Generic line
        // for every asset; USG gets an addendum because the same page shows POL
        // on two different bases that otherwise look contradictory — the pie's
        // "POL pool stables" counter-side % vs the Supply Composition panel's
        // "POL deployed" share. Figures are read from live data so they always
        // match the panels above (no hardcoded numbers to go stale).
        var cap = document.getElementById('breakdown-caption');
        if (cap) {
            var note = "Percentages are each line’s share of total displayed backing (the 100% row) — not share of token supply.";
            if (data.asset_slug === 'usg') {
                var sc = data.asset_specific && data.asset_specific.supply_composition;
                var polRow = CommonRenderer._backingBreakdown(data).filter(function(i) {
                    return i.tags && i.tags.indexOf('pol') >= 0;
                })[0];
                var polPiePct = polRow ? CommonRenderer.formatPercent(polRow.pct, 1) : null;
                var polSupplyPct = sc && sc.pol_pct != null ? CommonRenderer.formatPercent(sc.pol_pct, 1) : null;
                note += ' <strong>USG:</strong> this is the inclusive-CR backing pie (CDP collateral + PegKeeper pool counter-side stables).';
                if (polPiePct && polSupplyPct) {
                    note += ' The “POL pool stables (PegKeeper)” line — the pool counter-side stablecoins (USDC/frxUSD paired against protocol-minted USG) — is ' + polPiePct +
                        ' of this pie. That is a different quantity from the “POL deployed” figure (' + polSupplyPct +
                        ') in the Supply Composition panel above, which counts the protocol-minted USG itself as a share of supply. Both are correct: different numerators (counter-side stables vs minted USG) and different denominators (backing pie vs supply).';
                }
            }
            cap.innerHTML = note;
        }
    },

    // ------ Pie chart ------
    renderPieChart(data) {
        var ctx = document.getElementById('pie-chart');
        if (!ctx) return;

        var items = CommonRenderer._backingBreakdown(data).filter(function(i) { return i.pct > 0.5; });
        var palette = ['#6366f1', '#3b82f6', '#14b8a6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#84cc16'];
        var colorIdx = 0;
        var colors = items.map(function(i) {
            var ts = Array.isArray(i.tags) ? i.tags : [];
            if (ts.indexOf('amo') >= 0 || ts.indexOf('circular') >= 0) return '#ef4444';
            if (ts.indexOf('cross-chain') >= 0) return '#3b82f6';
            if (ts.indexOf('idle') >= 0) return '#22c55e';
            if (ts.indexOf('pegkeeper') >= 0) return '#f97316';
            return palette[colorIdx++ % palette.length];
        });

        if (window._pieChart) window._pieChart.destroy();
        window._pieChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: items.map(function(i) { return i.label; }),
                datasets: [{
                    data: items.map(function(i) { return i.value; }),
                    backgroundColor: colors,
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
                            label: function(ctx) {
                                return ctx.label + ': ' + CommonRenderer.formatCurrencyExact(ctx.raw) + ' (' + CommonRenderer.formatPercent(ctx.raw / data.summary.total_backing * 100, 1) + ')';
                            }
                        }
                    }
                }
            }
        });
    },

    // ⚠️ An accounting divergence is not a solvency event, and the flag text
    // cannot say so.
    //
    // USDat's critical flag reads "holds $80,461,171.08 but totalAssets() reports
    // $0.00 (100.000000% of supply unaccounted by the contract)". To a holder,
    // "100% unaccounted" reads as THE MONEY IS MISSING. It is not: backing and
    // supply tie to the cent. What is absent is the contract's recognition of the
    // assets, because the token holding all of them is not on its own allowlist.
    //
    // Both halves matter and neither substitutes. Quoting only the backing
    // understates a real defect; quoting only "unaccounted" is a false solvency
    // alarm. The flag is feed-emitted and is NOT reworded here — this adds the
    // half the reader needs, from the producer's own structured fields
    // (contract_total_assets_usd, backing_total_usd, supply_usd), not by parsing
    // the message. Generic: any asset emitting these fields gets it.
    _divergenceContextHtml(data) {
        var s = data.summary || {};
        var contractTA = s.contract_total_assets_usd;
        var backing = s.backing_total_usd;
        var supply = s.supply_usd;
        if (contractTA == null || backing == null || supply == null) return '';
        if (contractTA >= backing * 0.5) return '';          // no material divergence
        if (!(backing > 0) || Math.abs(backing - supply) / supply > 0.005) return '';
        return '<div class="text-xs text-slate-700 dark:text-slate-200 bg-slate-50 ' +
            'dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded p-2 mt-2">' +
            '<span class="font-semibold">What the divergence is, and is not.</span> The assets are ' +
            'present: backing <span class="font-mono">' + this.formatCurrencyExact(backing) +
            '</span> against supply <span class="font-mono">' + this.formatCurrencyExact(supply) +
            '</span>, tying to the cent. What is missing is the <em>contract\u2019s recognition</em> ' +
            'of them \u2014 <span class="font-mono">totalAssets()</span> reports ' +
            this.formatCurrencyExact(contractTA) + '. That is a real defect, and anything dividing ' +
            'by it degenerates rather than mispricing, but it is not absent backing.' +
        '</div>';
    },

    // ⚠️ report_url_status is published and was unread — both link sites keyed on
    // report_url alone. PegTracker's convention: "published" is verified live,
    // "unavailable" is known-dead, "unverified" means the producer could not
    // check (transport failure, stale cache) and emits the link anyway.
    //
    // A renderer must not turn "could not verify" into a promise. yzUSD and
    // syzUSD ship report_url with status "unverified" and both URLs 404 today —
    // linking them would put two dead links on a public page, which is the same
    // six-404 problem this repo hit last week from the other direction.
    //
    // Absent status still links, so feeds that never emit the field are
    // unaffected. Every live asset today is "published" and unchanged.
    _reportUrlUsable(issuer) {
        if (!issuer || !issuer.report_url) return false;
        var st = issuer.report_url_status;
        return (st == null || st === 'published');
    },

    // ------ Feed staleness ------
    //
    // ⚠️ Built because NOTHING detected Saturn going 4.1h stale. usdat, susdat
    // and saturn_family sat on a timed-out analyzer's previous output; the only
    // time on those pages was a bare "Updated:" stamp with no judgement attached,
    // and a human noticed it looked old. Seven renderers had a bespoke freshness
    // surface and seven did not — saturn.js was in the second group.
    //
    // Deliberately ONE implementation in the common path rather than fourteen.
    // Per-renderer is how thusd ended up the only tier-3 page missing its section
    // suppression: a thing added n times gets added n-1 times.
    //
    // A timed-out analyzer leaves the PREVIOUS file in place, so a stale payload
    // has correct schema, correct blocks and plausible numbers. It differs from a
    // good one only in its timestamp — which is why this reads the timestamp and
    // nothing else.
    //
    // Silent when fresh. A permanent "data is current" badge on 22 pages is the
    // noise that teaches people to skip the one that matters.
    //
    // ⚠️ Thresholds mirror check_feeds.py deliberately. Two places to update; the
    // alternative is a page and a checker that disagree about what stale means,
    // which is worse than the duplication.
    STALE_SLOW_ASSETS: { bmnr: 1, frax: 1 },   // own cadences, not hourly

    renderStalenessBanner(data, slug) {
        var el = document.getElementById('staleness-banner');
        if (!el) return;
        el.innerHTML = '';
        // ⚠️ Three field names in use across the feeds: timestamp (most),
        // as_of (bmnr, saturn), timestamp_utc (strc/mstr). Reading only the
        // first two left strc and mstr silently unbannered — found by backdating
        // every feed and loading all 23 pages, not by reading the code. A
        // staleness banner that cannot see an asset's timestamp is exactly the
        // failure it exists to catch, one level up.
        var ts = data && (data.timestamp || data.as_of || data.timestamp_utc);
        if (!ts) return;
        var t = Date.parse(String(ts).endsWith('Z') || /[+-]\d\d:?\d\d$/.test(String(ts))
            ? ts : ts + 'Z');
        if (!isFinite(t)) return;
        var hours = (Date.now() - t) / 3600000;

        var slow = slug && this.STALE_SLOW_ASSETS[slug];
        var warnAt = slow ? 12 : 3;
        var failAt = slow ? 30 : 6;
        if (hours <= warnAt) return;

        var crit = hours > failAt;
        var cls = crit
            ? 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-800 dark:text-red-200'
            : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200';
        var age = hours < 48 ? hours.toFixed(1) + ' hours' : (hours / 24).toFixed(1) + ' days';

        el.innerHTML =
            '<div class="border rounded p-3 mb-4 text-sm ' + cls + '">' +
                '<span class="font-semibold">' +
                    (crit ? 'This data is stale.' : 'This data is older than expected.') +
                '</span> Last updated <span class="font-mono">' + age + '</span> ago' +
                (slow ? ' (this asset refreshes on a slower cadence).' : ', against an hourly refresh.') +
                ' Every figure below is from that snapshot' +
                (crit
                    ? ' \u2014 an analyzer that fails leaves its previous output in place, so these ' +
                      'numbers look normal and are simply old.'
                    : '.') +
            '</div>';
    },

    // ------ Risk flags ------
    renderRiskFlags(data) {
        var container = document.getElementById('risk-flags');
        if (!data.risk_flags || data.risk_flags.length === 0) {
            container.innerHTML = '<div class="text-green-600 text-sm font-medium">No risk flags</div>';
            return;
        }
        container.innerHTML = data.risk_flags.map(function(f) {
            return '<div class="risk-flag risk-' + f.severity + '">' + f.message + '</div>';
        }).join('') + this._divergenceContextHtml(data);
    },

    // ------ CR trend chart ------
    renderCRChart(historyData, opts) {
        var ctx = document.getElementById('cr-chart');
        if (!ctx || !historyData || !historyData.entries || historyData.entries.length < 2) {
            document.getElementById('chart-panel').style.display = 'none';
            return;
        }
        document.getElementById('chart-panel').style.display = '';

        opts = opts || {};
        var bands = opts.bands || {
            critical: [0, 100], thin: [100, 110], amber: [110, 130], healthy: [130, 200],
            min_line: 100, max_line: 130
        };
        var title = opts.title || 'Collateral Ratio History';
        var datasetLabel = opts.dataset_label || 'CR';
        var altDatasetLabel = opts.alt_dataset_label || 'CR (gross)';
        // suggestedMin/Max default keeps the original 80-150 range; tight ratios (PCR) want to override
        var yMin = opts.y_min !== undefined ? opts.y_min : 80;
        var yMax = opts.y_max !== undefined ? opts.y_max : 150;
        // Asset-specific renderers can opt in through chart_bands metadata;
        // absence preserves the shared renderer's historical behavior.
        var sanityFloor = opts.cr_sanity_floor !== undefined ? opts.cr_sanity_floor : bands.cr_sanity_floor;
        var excludeSuspect = opts.exclude_suspect !== undefined ? opts.exclude_suspect : bands.exclude_suspect;
        var hardYBounds = opts.hard_y_bounds !== undefined ? opts.hard_y_bounds : bands.hard_y_bounds;
        var hasSanityFloor = sanityFloor !== undefined && sanityFloor !== null;
        function saneCR(v) {
            if (v === null || v === undefined) return false;
            // Preserve the old null-only behavior unless the asset opted in.
            return !hasSanityFloor || (Number.isFinite(v) && v >= sanityFloor);
        }
        function isSuspect(e) {
            // Missing keys are intentionally treated as false for pre-flag
            // history exports and cached data.
            return !!excludeSuspect && e && e.suspect === true;
        }
        function escapeAttr(value) {
            return String(value)
                .replace(/&/g, '&amp;')
                .replace(/"/g, '&quot;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
        }
        // Update panel title if overridden
        var titleEl = document.querySelector('#chart-panel .panel-title');
        if (titleEl) titleEl.textContent = title;

        // Min/max CR stats
        //
        // ⚠️ The history series needs the SAME scale resolution as the headline
        // tile. USDm publishes collateral_ratio as a raw ratio and declares
        // `collateral_ratio_scale: "ratio"`; the tile honoured that and this
        // chart did not, so the page showed 129.57% in the headline and plotted
        // 1.2957 — a flat line at the bottom of a 0-140% axis, sitting inside
        // the red Critical band, with "Min: 1.21%" in red above it.
        //
        // A double-collateralised reserve rendered as total loss of backing.
        // Same failure the retired `if (cr < 2) cr *= 100` guard was written for,
        // reached by a different route: the fix was applied to the summary path
        // and the history path was never brought along.
        //
        // collateral_ratio_alt is deliberately NOT normalised here — usdm.js
        // already converts it (stable_only_coverage_ratio * 100) before this
        // runs, which is why the alt series was the only correct one on the chart.
        var crScaleSummary = opts.cr_scale_summary || null;
        var crScaleSlug = opts.asset_slug || null;
        var rawCRValues = historyData.entries.map(function(e) {
            return CommonRenderer.normalizeCollateralRatio(e.collateral_ratio, crScaleSlug, crScaleSummary);
        });
        var rawAltCRValues = historyData.entries.map(function(e) { return e.collateral_ratio_alt; });
        var rawAltHasData = !opts.omit_alt && rawAltCRValues.some(function(v) {
            return v !== null && v !== undefined;
        });
        var crValues = rawCRValues.filter(function(v, i) {
            return !isSuspect(historyData.entries[i]) && saneCR(v);
        });
        var missingReadCount = 0;
        var suspectReadCount = 0;
        var suspectReasonCounts = {};
        var excludedCount = 0;
        if (hasSanityFloor || excludeSuspect) {
            missingReadCount = historyData.entries.filter(function(e, i) {
                var primaryMissing = rawCRValues[i] === null || rawCRValues[i] === undefined;
                var altMissing = rawAltHasData &&
                    (rawAltCRValues[i] === null || rawAltCRValues[i] === undefined);
                return primaryMissing || altMissing;
            }).length;
            historyData.entries.forEach(function(e, i) {
                var primaryPresent = rawCRValues[i] !== null && rawCRValues[i] !== undefined;
                var altPresent = !rawAltHasData ||
                    (rawAltCRValues[i] !== null && rawAltCRValues[i] !== undefined);
                if (!isSuspect(e) || !primaryPresent || !altPresent) return;
                suspectReadCount++;
                var reasons = Array.isArray(e.suspect_reasons) ? e.suspect_reasons.slice() : [];
                ['mento_api_ok', 'monad_rpc_ok', 'ethereum_rpc_ok', 'celo_rpc_ok'].forEach(function(key) {
                    if (e[key] === false && !reasons.some(function(reason) {
                        return String(reason).indexOf(key + '=false') !== -1;
                    })) {
                        reasons.push(key + '=false');
                    }
                });
                if (reasons.length === 0) reasons.push('flagged by analyzer (no reason supplied)');
                Array.from(new Set(reasons.map(String))).forEach(function(reason) {
                    suspectReasonCounts[reason] = (suspectReasonCounts[reason] || 0) + 1;
                });
            });
            if (hasSanityFloor) {
                historyData.entries.forEach(function(e, i) {
                    if (isSuspect(e)) return;
                    if (rawCRValues[i] !== null && rawCRValues[i] !== undefined &&
                        !saneCR(rawCRValues[i])) excludedCount++;
                    if (rawAltHasData && rawAltCRValues[i] !== null &&
                        rawAltCRValues[i] !== undefined && !saneCR(rawAltCRValues[i])) {
                        excludedCount++;
                    }
                });
            }
        }
        if (crValues.length > 0) {
            var minCR = Math.min.apply(null, crValues);
            var maxCR = Math.max.apply(null, crValues);
            var statsEl = document.getElementById('cr-chart-stats');
            if (!statsEl) {
                statsEl = document.createElement('div');
                statsEl.id = 'cr-chart-stats';
                statsEl.className = 'flex gap-4 text-xs text-slate-500 mb-2';
                var chartPanel = document.getElementById('chart-panel');
                var titleEl = chartPanel.querySelector('.panel-title');
                if (titleEl) titleEl.after(statsEl);
            }
            var minCls = minCR < 100 ? 'text-red-600 font-semibold' : minCR < 110 ? 'text-amber-600 font-semibold' : '';
            var suspectTooltip = Object.keys(suspectReasonCounts).sort(function(a, b) {
                return suspectReasonCounts[b] - suspectReasonCounts[a] || a.localeCompare(b);
            }).map(function(reason) {
                return reason + (suspectReasonCounts[reason] > 1 ? ' (' + suspectReasonCounts[reason] + ')' : '');
            }).join('; ');
            // ⚠️ These labels read "30d" for a long time while min/max were taken
            // over the WHOLE file. That was accidentally true — every history
            // export held ~29 days — until it wasn't: yzUSD ships 309 points
            // over 317 days, so the page called a 7.63pp ten-month range a "30d
            // range" when the real 30-day range is 3.88pp. USDS at 50 days had
            // the same defect, smaller.
            //
            // ⚠️ It inverts the reading, it does not just widen it. A 2pp move
            // against a claimed 7.63pp band looks like ordinary noise; against
            // the true 3.88pp band it is half the range and worth looking at.
            // The mislabel argues AGAINST investigating the thing it should
            // argue for.
            //
            // So: state the window instead of asserting one. A range means
            // nothing without the span it covers, and the span is right here in
            // the data — there is no reason to hardcode a guess at it.
            // ⚠️ PREFER THE PUBLISHED WINDOW. PegTracker now emits
            // asset_specific.history_window carrying the window, the point count
            // and the range computed over it — added precisely because the
            // full-file range was being read as a 30-day one. Deriving my own
            // span from the entries reproduces the original defect in a politer
            // form: yzUSD's file spans 11 months, so I would show 7.63pp while
            // the producer publishes 3.88pp over the last 30 days, and the wider
            // band makes a real step look like noise.
            //
            // The published block wins whenever it is present; the derived span
            // stays as the fallback for feeds that do not emit one.
            var hw = opts.history_window || null;
            var spanLabel = '';
            if (hw && hw.collateral_ratio_min != null && hw.collateral_ratio_max != null) {
                minCR = hw.collateral_ratio_min;
                maxCR = hw.collateral_ratio_max;
                spanLabel = (hw.points != null ? hw.points + ' obs over ' : '') +
                    (hw.window_days != null ? hw.window_days + ' days' : 'the published window');
            }
            var tsAll = (historyData.entries || []).map(function(e) {
                if (!e || !e.timestamp) return null;
                return new Date(e.timestamp.endsWith('Z') ? e.timestamp : e.timestamp + 'Z').getTime();
            }).filter(function(t) { return t && !isNaN(t); });
            if (!spanLabel && tsAll.length > 1) {
                var spanDays = Math.round((Math.max.apply(null, tsAll) - Math.min.apply(null, tsAll)) / 86400000);
                spanLabel = crValues.length + ' obs over ' +
                    (spanDays >= 60 ? Math.round(spanDays / 30) + ' months' : spanDays + ' days');
            }
            // The durable form of the reserve-step flag. The per-run flag fires
            // the hour a step happens and clears the next, while the LEVEL
            // persists — so a reader meets an odd ratio with no flag attached.
            // reserve_step_last_seen is what lets the page say the numerator
            // moved recently rather than only that it moved this hour.
            var stepNote = '';
            if (hw && hw.reserve_step_count) {
                stepNote = '<span class="text-amber-700" title="' +
                    this._escapeAttr(hw.note || '') + '">' + hw.reserve_step_count +
                    ' reserve step' + (hw.reserve_step_count === 1 ? '' : 's') +
                    ' in window' +
                    (hw.reserve_step_last_seen
                        ? ' · last ' + this.formatDate(hw.reserve_step_last_seen) : '') +
                    ' \u24d8</span>';
            }

            statsEl.innerHTML = '<span>Min: <span class="font-mono ' + minCls + '">' + minCR.toFixed(2) + '%</span></span>' +
                '<span>Max: <span class="font-mono">' + maxCR.toFixed(2) + '%</span></span>' +
                '<span>Range: <span class="font-mono">' + (maxCR - minCR).toFixed(2) + 'pp</span></span>' +
                (spanLabel ? '<span class="text-slate-400">' + spanLabel + '</span>' : '') +
                stepNote +
                (missingReadCount > 0 ? '<span class="text-slate-400">' + missingReadCount + ' observations unavailable (missing/incomplete reads)</span>' : '') +
                (suspectReadCount > 0 ? '<span class="text-amber-600" title="' + escapeAttr(suspectReadCount + ' excluded: ' + suspectTooltip) + '">' + suspectReadCount + ' flagged observations excluded as incomplete reads ⓘ</span>' : '') +
                (excludedCount > 0 ? '<span class="text-amber-600">' + excludedCount + ' implausible values excluded (&lt;' + sanityFloor + '%)</span>' : '');
        }

        var entries = historyData.entries;
        var labels = entries.map(function(e) { return new Date(e.timestamp.endsWith('Z') ? e.timestamp : e.timestamp + 'Z'); });
        var crData = rawCRValues.map(function(v, i) {
            return !isSuspect(entries[i]) && saneCR(v) ? v : null;
        });
        var crAltData = rawAltCRValues.map(function(v, i) {
            return !isSuspect(entries[i]) && saneCR(v) ? v : null;
        });

        // Drop the second series if explicitly suppressed, or if every value is null/undefined.
        var altHasData = rawAltHasData && crAltData.some(function(v) { return v !== null && v !== undefined; });
        var datasets = [{
            label: datasetLabel,
            data: crData,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            borderWidth: 2
        }];
        if (altHasData) {
            datasets.push({
                label: altDatasetLabel,
                data: crAltData,
                borderColor: '#f59e0b',
                backgroundColor: 'transparent',
                borderDash: [5, 3],
                tension: 0.3,
                pointRadius: 0,
                borderWidth: 2
            });
        }

        var minLine = bands.min_line;
        var maxLine = bands.max_line;
        var annotations = {
            critical: { type: 'box', yMin: bands.critical[0], yMax: bands.critical[1], backgroundColor: 'rgba(220, 38, 38, 0.08)', borderWidth: 0, label: { content: 'Critical', display: true, position: 'start', font: { size: 9 }, color: '#dc2626' } },
            thin: { type: 'box', yMin: bands.thin[0], yMax: bands.thin[1], backgroundColor: 'rgba(239, 68, 68, 0.06)', borderWidth: 0 },
            amber: { type: 'box', yMin: bands.amber[0], yMax: bands.amber[1], backgroundColor: 'rgba(245, 158, 11, 0.06)', borderWidth: 0 },
            healthy: { type: 'box', yMin: bands.healthy[0], yMax: bands.healthy[1], backgroundColor: 'rgba(22, 163, 74, 0.04)', borderWidth: 0 }
        };
        if (minLine !== undefined && minLine !== null) {
            annotations.minLine = { type: 'line', yMin: minLine, yMax: minLine, borderColor: '#dc2626', borderWidth: 1, borderDash: [4, 4], label: { content: minLine + '%', display: true, position: 'end', font: { size: 9 }, color: '#dc2626' } };
        }
        if (maxLine !== undefined && maxLine !== null) {
            annotations.maxLine = { type: 'line', yMin: maxLine, yMax: maxLine, borderColor: '#16a34a', borderWidth: 1, borderDash: [4, 4], label: { content: maxLine + '%', display: true, position: 'end', font: { size: 9 }, color: '#16a34a' } };
        }

        // Keep the raw Chart.js config unambiguous: a scale has either hard
        // bounds or suggested bounds, never min/max keys whose values happen
        // to be undefined. Suggested bounds yield to genuine data outside the
        // normal envelope after asset-level artifact filtering.
        var yScaleOptions = {
            grid: { color: '#f1f5f9' },
            ticks: {
                callback: function(v) { return v + '%'; },
                font: { size: 11 }
            }
        };
        if (hardYBounds) {
            yScaleOptions.min = yMin;
            yScaleOptions.max = yMax;
        } else {
            yScaleOptions.suggestedMin = yMin;
            yScaleOptions.suggestedMax = yMax;
        }

        if (window._crChart) window._crChart.destroy();
        window._crChart = new Chart(ctx, {
            type: 'line',
            data: { labels: labels, datasets: datasets },
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
                    y: yScaleOptions
                },
                plugins: {
                    legend: { display: true, position: 'top', labels: { boxWidth: 12, font: { size: 11 } } },
                    tooltip: {
                        callbacks: {
                            label: function(ctx) { return ctx.dataset.label + ': ' + ctx.raw.toFixed(2) + '%'; }
                        }
                    },
                    annotation: { annotations: annotations }
                },
                interaction: { intersect: false, mode: 'index' }
            }
        });
    },

    // =====================================================================
    // 5-AXIS RISK FRAME
    // Activated only for assets that carry the Layer-1 axis blocks (peg /
    // liquidity / backing / dependencies / issuer). Assets without the blocks
    // keep the legacy backing-only layout untouched (the 4 non-backing
    // sections stay hidden and #summary-cards shows the old CR cards).
    // =====================================================================

    // True once the analyzer emits the standard axis contract. Keyed on `peg`
    // (the first block the analyzer attaches); the whole set lands together.
    hasAxisBlocks(data) {
        return !!(data && data.peg && typeof data.peg === 'object');
    },

    // Map a metric to a 1–5 rating against ascending/descending cutoffs.
    // direction 'high' = larger is better (liquidity, backing);
    // 'low' = smaller is better (peg deviation).
    _rate(value, cutoffs, direction) {
        if (value == null || !Array.isArray(cutoffs) || cutoffs.length !== 4) return null;
        if (direction === 'low') {
            if (value < cutoffs[0]) return 5;
            if (value < cutoffs[1]) return 4;
            if (value < cutoffs[2]) return 3;
            if (value < cutoffs[3]) return 2;
            return 1;
        }
        if (value >= cutoffs[0]) return 5;
        if (value >= cutoffs[1]) return 4;
        if (value >= cutoffs[2]) return 3;
        if (value >= cutoffs[3]) return 2;
        return 1;
    },

    _axisThresholds(data) {
        var ov = (data.asset_specific && data.asset_specific.axis_thresholds) || {};
        return {
            peg:       ov.peg       || RISK_AXIS_THRESHOLDS.peg,
            liquidity: ov.liquidity || RISK_AXIS_THRESHOLDS.liquidity,
            backing:   ov.backing   || RISK_AXIS_THRESHOLDS.backing
        };
    },

    // Rating → display chip. 5/4 healthy, 3 watch, ≤2 stress, null = not rated.
    // ⚠️ Why an axis is UNRATED, when the null is deliberate.
    //
    // "Not rated" looks worse on a live page than "Healthy 5/5", and the first
    // person to meet a blank axis will reasonably read it as a pipeline fault.
    // The thing it prevents — a rating that is affirmatively wrong — is
    // invisible. So a guard that does not say what it protects gets relaxed by
    // whoever meets it next, and "restore the fallback" is the reasonable-looking
    // relaxation available here. Name the 5/5 explicitly or the null looks like
    // the defect.
    backingUnratedReason(data) {
        var sum = data.summary || {};
        var aspThr = data.asset_specific && data.asset_specific.axis_thresholds;
        var bOv = aspThr && aspThr.backing;
        var fromBacking = data.backing && data.backing.collateral_ratio != null;
        var cr = fromBacking ? data.backing.collateral_ratio : sum.collateral_ratio;

        // What the generic band WOULD say, so the reason can name it.
        var generic = (cr == null) ? null
            : this._rate(CommonRenderer.normalizeCollateralRatio(cr, data.asset_slug, sum),
                         this._axisThresholds({}).backing.cr_pct, 'high');
        var wouldSay = (generic == null) ? '' :
            ' Falling back to the generic cutoffs would rate this ' +
            this._ratingChip(generic).text + ' — the outcome this band exists to prevent.';

        if (!aspThr && data.axis_thresholds) {
            return 'The producer published axis_thresholds at the top level, where this ' +
                'renderer cannot read it, so the asset-specific band is unreachable.' + wouldSay;
        }
        if (bOv && Array.isArray(bOv.cr_pct)) {
            if (bOv.stale_by_floor_drift === true) {
                return 'The band\u2019s measured floor has drifted beyond tolerance' +
                    (bOv.live_floor_pct != null && bOv.anchored_floor_pct != null
                        ? ' (' + bOv.anchored_floor_pct + '% \u2192 ' + bOv.live_floor_pct + '%)' : '') +
                    ', so the cutoffs no longer describe this book. Re-derive them.' + wouldSay;
            }
            if (bOv.expires === true && bOv.review_by &&
                Date.now() > Date.parse(bOv.review_by + 'T00:00:00Z')) {
                return 'The band expired on ' + CommonRenderer._escapeAttr(bOv.review_by) +
                    ' and is a property of the book as measured then, not of the protocol. ' +
                    'Re-derive it rather than extending the date.' + wouldSay;
            }
        }
        if (!fromBacking && sum.collateral_ratio_synthetic === true) {
            return 'The only collateral ratio available is a placeholder synthesised by the ' +
                'renderer, not a producer value. Rating it would invent a number.';
        }
        return null;
    },

    _ratingChip(rating) {
        if (rating == null) return { cls: 'r-na', text: 'Not rated' };
        var cls = rating >= 4 ? 'r-ok' : (rating === 3 ? 'r-warn' : 'r-crit');
        var word = rating >= 4 ? 'Healthy' : (rating === 3 ? 'Watch' : 'Stress');
        return { cls: cls, text: word + ' · ' + rating + '/5' };
    },

    _ratingChipHtml(rating, reason) {
        var c = this._ratingChip(rating);
        if (rating == null && reason) {
            return '<span class="axis-rating ' + c.cls + '" title="' +
                this._escapeAttr(reason) + '">' + c.text + ' \u24d8</span>';
        }
        return '<span class="axis-rating ' + c.cls + '">' + c.text + '</span>';
    },

    // --- per-axis ratings ---
    pegRating(data, history) {
        var th = this._axisThresholds(data).peg.abs_dev_pct;
        // Prefer 7-day average absolute deviation when peg-history is available;
        // else the latest premium/discount magnitude (As-built: history lives in
        // *_backing_history.json under peg.history_field).
        var avg = this._pegAvgAbsDev(data, history, 7);
        var dev = (avg != null) ? avg
            : (data.peg.premium_discount_pct != null ? Math.abs(data.peg.premium_discount_pct) : null);
        return this._rate(dev, th, 'low');
    },

    _pegAvgAbsDev(data, history, days) {
        if (!history || !Array.isArray(history.entries) || !history.entries.length) return null;
        var field = data.peg.history_field || 'peg_premium_discount_pct';
        var nav = data.peg.nav != null ? data.peg.nav : 1.0;
        var entries = history.entries;
        // Window the last `days` worth of points by timestamp; fall back to the
        // tail count if timestamps are missing.
        var last = entries[entries.length - 1];
        var cutoff = null;
        if (last && last.timestamp) {
            var t = new Date(last.timestamp.endsWith('Z') ? last.timestamp : last.timestamp + 'Z').getTime();
            cutoff = t - days * 86400000;
        }
        var devs = [];
        for (var i = 0; i < entries.length; i++) {
            var e = entries[i];
            if (cutoff != null && e.timestamp) {
                var et = new Date(e.timestamp.endsWith('Z') ? e.timestamp : e.timestamp + 'Z').getTime();
                if (et < cutoff) continue;
            }
            var v = e[field];
            if (v == null) continue;
            // Field may be a price (→ convert to % deviation vs nav) or already a %.
            var devPct = (field.indexOf('pct') >= 0) ? Math.abs(v)
                : (nav ? Math.abs((v - nav) / nav * 100) : null);
            if (devPct != null) devs.push(devPct);
        }
        if (!devs.length) return null;
        return devs.reduce(function(a, b) { return a + b; }, 0) / devs.length;
    },

    liquidityRating(data) {
        // Credit vaults emit an explicit 1-5 band_score (from free-liquidity %); prefer it.
        if (data.liquidity && data.liquidity.band_score != null) return data.liquidity.band_score;
        // ⚠️ Refuse to rate a depth the feed's OWN LADDER contradicts.
        //
        // usde publishes total_2pct_depth = $5,000,000 and quotes that same rung
        // at −1588 bps. 200bps is the threshold, so the 2% crossing is bracketed
        // INSIDE its own ladder between $2M (−1.4bps) and $5M — and the published
        // figure is the rung BEYOND it. That rated Healthy 5/5.
        //
        // This does not derive a depth; deriving one is the producer's job and
        // guessing would be the mis-scaling this codebase keeps being bitten by.
        // It withholds a rating the payload does not support, which is the same
        // rule backingRating already applies to synthesised ratios: an unrated
        // axis is honest, a rating computed from a contradicted number is not.
        //
        // Fires only when a quoted rung at or below the published depth costs
        // worse than 2%. Verified against all 12 assets carrying both a depth and
        // a ladder — usde is the only one, and the others stay rated.
        if (this._depthContradictedByLadder(data)) return null;
        // ⚠️ And refuse to rate a figure the producer says bounds nothing. USDS
        // publishes $50,000,000 with status not_size_responsive because every
        // rung from $1M to $50M returned identical 0.00bps. Rating that Healthy
        // 5/5 would make the one asset whose depth was NOT measured the deepest
        // on the dashboard. Same rule as the ladder contradiction and as
        // backingRating's refusal to rate a synthesised ratio.
        var lq = data.liquidity || {};
        if (lq.two_pct_depth_status === 'not_size_responsive' ||
            lq.two_pct_depth_size_responsive === false) return null;
        var th = this._axisThresholds(data).liquidity.depth_usd;
        return this._rate(data.liquidity ? data.liquidity.total_2pct_depth : null, th, 'high');
    },

    _exitScopeHtml(liq) {
        liq = liq || {};
        var pe = liq.primary_exit;
        if (!pe) {
            // Not "unmeasured" — UNREPRESENTED. Nothing in the payload says a
            // redemption leg exists, so the scope of the score is unknown rather
            // than known-narrow. That is worse and must read worse.
            return ' · <span class="text-amber-700" title="The score is venue depth only. The payload represents no redemption leg at all, so the scope of this rating is unknown rather than known-narrow.">exit leg undeclared</span>';
        }
        var basis = pe.gated_basis;
        if (typeof basis === 'string' && basis.indexOf('measured') === 0) return '';
        // ⚠️ A boolean gated with no basis is an ASSERTION, not an unprobed leg.
        // susds publishes gated: false and no basis at all — calling that
        // "unprobed" states the opposite of what the producer said. And an
        // asserted-open exit with undeclared provenance is the flattering
        // direction, which is why usdm's gated: false is still withheld pending
        // the dispute with riskAnalyst over whether that path is allowlisted.
        if (typeof pe.gated === 'boolean' && !basis) {
            return ' · <span class="text-amber-700" title="The producer states a gate value but declares no basis for it, so how it was established is unknown. The score is venue depth only.">exit asserted, basis undeclared</span>';
        }
        return ' · <span class="text-slate-500" title="' +
            this._escapeAttr(pe.gated_note || 'The producer declares the redemption leg unmeasured. The score is venue depth only.') +
            '">exit unprobed (declared)</span>';
    },

    _depthQualifierHtml(liq) {
        var st = liq.two_pct_depth_status;
        var br = liq.two_pct_depth_bracket;
        if (liq.total_2pct_depth == null) return '';
        var tip = liq.two_pct_depth_basis || '';
        function wrap(txt, cls) {
            return '<div class="text-[11px] ' + (cls || 'text-slate-400') + '"' +
                (tip ? ' title="' + CommonRenderer._escapeAttr(tip) + '"' : '') + '>' +
                txt + (tip ? ' \u24d8' : '') + '</div>';
        }
        if (st === 'bracketed' && Array.isArray(br) && br.length === 2) {
            return wrap('crossing between ' + this.formatCurrency(br[0]) +
                        ' and ' + this.formatCurrency(br[1]), 'text-slate-500');
        }
        if (st === 'not_size_responsive' || liq.two_pct_depth_size_responsive === false) {
            return wrap('quote does not vary with size \u2014 not a depth curve', 'text-amber-700');
        }
        if (st === 'quote_failed') {
            return wrap('floor \u2014 the deeper rung returned a broken route', 'text-amber-700');
        }
        if (st === 'ladder_exhausted' || liq.total_2pct_depth_is_floor === true) {
            return wrap('ladder exhausted \u2014 floor, not a measurement');
        }
        if (st) return wrap(String(st).replace(/_/g, ' '), 'text-slate-500');
        return '';
    },

    _depthContradictedByLadder(data) {
        var liq = data.liquidity || {};
        var dp = liq.total_2pct_depth;
        var quotes = (liq.exit_mark || {}).quotes || {};
        if (dp == null) return false;
        return Object.keys(quotes).some(function(k) {
            var size = Number(k);
            var bps = quotes[k] && quotes[k].slippage_bps;
            return !isNaN(size) && size <= dp && typeof bps === 'number' && bps < -200;
        });
    },

    // Backing rating honours an asset's chart_bands override (e.g. USG PCR) when
    // present, otherwise the generic CR cutoffs.
    backingRating(data) {
        var sum = data.summary || {};
        var fromBacking = data.backing && data.backing.collateral_ratio != null;
        var cr = fromBacking ? data.backing.collateral_ratio : sum.collateral_ratio;
        if (cr == null) return null;

        // ⚠️ Never rate a manufactured value. Renderers synthesise a placeholder
        // collateral_ratio in preRender so the legacy card has something to
        // format, and preRender runs BEFORE this — so without the marker a
        // placeholder is indistinguishable from a producer figure. An unrated
        // axis is honest; a rating derived from a placeholder is not. The
        // fallback itself stays: six assets rely on it legitimately (bold, frax,
        // ousd, usdd, usdm, usg all emit a real summary.collateral_ratio).
        if (!fromBacking && sum.collateral_ratio_synthetic === true) return null;

        // ⚠️ Scale. usdm publishes a RAW ratio (1.2198); every other feed
        // publishes percent. Unnormalised, 1.2198 falls through the default
        // [130,110,100,90] cutoffs to 1/5 instead of 4/5 — a three-band
        // misrating in the alarming direction. The index grid already normalises
        // (app.js); this did not. Resolution is by declared scale or the explicit
        // asset list, never by magnitude — see normalizeCollateralRatio.
        //
        // ⚠️ The scale declaration must come from the block the VALUE came from.
        // summary.collateral_ratio_scale describes summary.collateral_ratio. Once
        // an asset migrates to 5-axis, backing.collateral_ratio becomes the source
        // and a payload can carry both fields under near-identical names. Applying
        // summary's declaration to a backing value is a guess, and with a raw-list
        // asset the normaliser is not idempotent — a percent value multiplied
        // again reads 12198 and rates 5/5, the reassuring direction.
        // A declaration describes ITS OWN block and nothing else. backing and
        // summary routinely hold different quantities under the same field name —
        // usdm's backing.collateral_ratio is stable-only reserve over Mento debt
        // (91.02, percent) while summary.collateral_ratio is gross over the same
        // debt (1.2231, ratio). Both declarations are right; they are 31pp apart
        // because they measure different things.
        //
        // ⚠️ REMOVED: a check that rejected the payload when the two declared
        // scales differed. It compared STRINGS, which cannot tell "two fields,
        // two scales, both correct" from "one quantity, contradictory scales" —
        // and it was strictly harmful. It fired ONLY when both blocks declared,
        // which is exactly when per-block resolution already gets it right, and
        // stayed silent on the hazard it was written for (an undeclared backing
        // value inheriting summary's declaration), which still rated 5/5. It
        // unrated usdm on a live page for being correct, and would have unrated
        // every asset adopting the per-block declarations we asked for.
        //
        // So: never inherit across blocks. A backing value with no declaration of
        // its own falls to the default (percent), not to summary's — guessing
        // from a sibling field's scale is the mis-scaling this is meant to avoid.
        var backingBlock = data.backing || {};
        var scaleSrc = fromBacking ? backingBlock : sum;

        cr = CommonRenderer.normalizeCollateralRatio(cr, data.asset_slug, scaleSrc);
        if (cr == null) return null;
        // Explicit per-asset cr_pct override (finer 5/4/3/2/1) wins over chart_bands' binary
        // 5/3/1 — credit vaults (PCR ~100 by construction) need the finer bands so PCR 100 reads
        // Healthy 4, not a perfect 5 (chart_bands stays for the CR-chart rendering).
        // ⚠️ Misplaced override: refuse rather than rate on the generic band.
        //
        // The schema location is asset_specific.axis_thresholds. A producer that
        // emits axis_thresholds at TOP LEVEL has published a band this reader
        // cannot see, and the failure is silent and flattering — usg's 131.64
        // rates 5/5 HEALTHY on the generic [130,110,100,90] and 3/5 WATCH on its
        // own [158,145,130,120], which is anchored on a measured liquidation
        // floor. Rating on defaults while a real band sits unread would publish
        // the reassuring answer.
        //
        // Deliberately NOT reading the top-level copy. Accepting an undefined
        // location lets the renderer define the contract by what it tolerates,
        // which is how a schema rots quietly; and check_feeds.py already surfaces
        // the misplacement. An unrated axis is honest and visibly wrong-looking,
        // which is what gets it fixed.
        var aspThr = data.asset_specific && data.asset_specific.axis_thresholds;
        if (!aspThr && data.axis_thresholds) return null;

        var bOv = aspThr && aspThr.backing;
        if (bOv && Array.isArray(bOv.cr_pct)) {
            // ⚠️ An override may declare its own expiry. usg's carries
            // expires:true, review_by, and an expiry_reason saying the floor is a
            // property of TODAY'S book — an active market set the issuer opens and
            // pauses — with an explicit "re-derive it, do not extend the date".
            //
            // Rating on it past that date asserts a currency the producer has
            // said it will not have. This repo already has the scar: a hardcoded
            // editorial score sat at 8.0 through a depeg because nothing
            // recomputed it. Falling back to the generic band would be worse than
            // unrated here — that is the 5/5 the override exists to prevent — so
            // an expired band goes UNRATED, which is visible and prompts the
            // re-derivation the producer asked for.
            // stale_by_floor_drift is the REAL trigger; review_by is the
            // backstop. The band is derived from a measured floor that the
            // producer recomputes every run — if an idle market activates with a
            // different liquidation threshold the floor moves and the flag fires
            // in September rather than waiting for November. The tolerance is a
            // detection threshold, not a slack allowance: a drift firing early
            // means re-derive, not widen.
            if (bOv.stale_by_floor_drift === true) return null;
            if (bOv.expires === true && bOv.review_by &&
                Date.now() > Date.parse(bOv.review_by + 'T00:00:00Z')) {
                return null;
            }
            return this._rate(cr, bOv.cr_pct, 'high');
        }
        // ⚠️ A display band is not a rating scale. Five renderers set chart_bands
        // in preRender purely so two series stay legible on one axis — usdm's
        // comment says so outright ("keep both named series continuously
        // visible") — and preRender runs BEFORE this, so those bands were
        // silently scoring the asset. A shading boundary makes a poor rating
        // boundary: critical:[0,98] collapses 97% and 60% into the same 1/5.
        //
        // Measured: apxusd and usdm each rated 1/5 on injected display bands
        // where the real cutoffs give 2/5 — both in the alarming direction.
        // Feed-emitted bands (syrup's `pcr`) are deliberately rating-shaped and
        // are still honoured; only renderer-set ones carry display_only.
        var bands = data.asset_specific && data.asset_specific.chart_bands;
        if (bands && bands.display_only === true) bands = null;
        if (bands) {
            // verbose {critical,thin,amber,healthy:[lo,hi]} or short {pcr|thresholds:[a,b,c,d]}
            var healthyFloor, watchFloor;
            if (Array.isArray(bands.healthy) && Array.isArray(bands.amber)) {
                healthyFloor = bands.healthy[0];
                watchFloor = bands.amber[0];
            } else {
                var short = bands.pcr || bands.thresholds;
                if (Array.isArray(short) && short.length === 4) {
                    healthyFloor = short[2];  // app.js maps healthy:[c,d]
                    watchFloor = short[1];    // amber:[b,c]
                }
            }
            if (healthyFloor != null && watchFloor != null) {
                if (cr >= healthyFloor) return 5;
                if (cr >= watchFloor) return 3;
                return 1;
            }
        }
        return this._rate(cr, this._axisThresholds(data).backing.cr_pct, 'high');
    },

    _escapeAttr(str) {
        return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
            .replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },

    _indexerLabel(source) {
        if (!source || typeof source !== 'string') return null;
        var known = { geckoterminal: 'GeckoTerminal' };
        var normalized = source.trim().toLowerCase();
        if (known[normalized]) return known[normalized];
        return source.trim().replace(/[_-]+/g, ' ').replace(/\b\w/g, function(c) {
            return c.toUpperCase();
        });
    },

    // 24h volume for the Liquidity card subtitle. Two contracts to keep:
    //   1. `volume_24h` is emitted as null (never 0) when the lookup fails — an absent
    //      figure must render "n/a", never a false $0 on a pool doing tens of millions.
    //   2. It is indexer-derived (GeckoTerminal), unlike the 2% depth beside it, which is
    //      an executable on-chain quote — so it carries an explicit (indexer) qualifier
    //      and its source/as-of in the tooltip rather than reading as a chain verification.
    // The upstream cadence is daily, so the as-of is context only: no staleness warning.
    // ⚠️ Two spellings for one quantity. hastra-prime, thusd and usdai publish
    // `volume_24h`; the Yuzu feeds publish `volume_24h_usd`. This read only the
    // first, so the summary tile said "vol n/a" while the panel eight lines
    // below rendered $24.74 from the other field — the SAME defect as the
    // hardcoded literal, one layer up, and invisible because "n/a" is exactly
    // what an unmeasured asset should show.
    //
    // Accepting both is a stopgap, not the resolution: a second accepted
    // spelling entrenches the divergence. Raised with the producer to settle on
    // one; when it lands, drop the fallback rather than leave two.
    _volumeSubHtml(liq) {
        var vol = liq ? liq.volume_24h : null;
        if (vol == null && liq) vol = liq.volume_24h_usd;
        if (vol == null) return 'vol n/a';
        var src = this._indexerLabel(liq.volume_24h_source);
        var tip = '24h volume ' + (Math.abs(vol) < 1000
                ? '$' + vol.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : this.formatCurrencyExact(vol)) + ' · ' +
            (src ? src + ' — indexer-derived, not an on-chain quote'
                 : 'indexer-derived, not an on-chain quote');
        if (liq.volume_24h_as_of) tip += ' · as of ' + this.formatDate(liq.volume_24h_as_of);
        // ⚠️ formatCurrency floors to whole dollars below $1k, so yzUSD's $24.74
        // renders "$25" here too — the same rounding that nearly cost the finding
        // in the panel. Where the number is tiny, the exact figure IS the point.
        var volTxt = Math.abs(vol) < 1000
            ? '$' + vol.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : this.formatCurrency(vol);
        return '<span class="indexer-figure" title="' +
            this._escapeAttr(tip) + '">vol ' + volTxt + ' (indexer)</span>';
    },

    // --- summary band (replaces the legacy 5 CR cards in 5-axis mode) ---
    renderAxisBand(data, history) {
        var container = document.getElementById('summary-cards');
        if (!container) return;
        var peg = data.peg || {}, liq = data.liquidity || {}, dep = data.dependencies || {};
        var issuer = data.issuer || {};

        var pegPct = peg.premium_discount_pct;
        var pegCls = this.pegPctClass(this.pegStatusClass(pegPct));
        var pegArrow = this._pegTrendArrow(data, history);

        var nUp = Array.isArray(dep.upstream) ? dep.upstream.length : 0;
        // Downstream is a reserved stub until a consumer analyzer exists; an
        // absent/false `downstream_tracked` flag means "not tracked", NOT "0".
        var downTracked = dep.downstream_tracked === true;
        var nDown = Array.isArray(dep.downstream) ? dep.downstream.length : 0;
        var depDownHtml = downTracked
            ? nDown + ' <span class="text-sm font-normal text-slate-400">down</span>'
            : '<span class="text-base font-normal text-slate-400">downstream not tracked</span>';

        // Liquidity metric: credit vaults (e.g. Maple Syrup) expose free-liquidity % (instant-exit
        // capacity, rest queues at NAV) rather than a DEX 2% depth — show whichever the asset emits.
        var liqIsFree = liq.free_liquidity_pct != null;
        // ⚠️ The qualifier has to live on the TILE, not only in the panel.
        // usde, usdat and usdai are served by bespoke renderers that replace the
        // liquidity panel, so a floor/bracket note placed there never reaches
        // them — and usde is the exact asset whose $5M turned out to be past its
        // own crossing. The band is generic, so this is the one place every
        // asset passes through.
        var dStatus = liq.two_pct_depth_status;
        // ⚠️ not_size_responsive must NOT render like a floor, even though the
        // producer sets is_floor alongside it. A floor says "at least this much"
        // and is a real bound. USDS's $50M says only that the call returns the
        // same answer at any number — every rung from $1M to $50M came back
        // identical 0.00bps, because it routes the Sky PSM, a fixed-rate swap
        // bounded by pocket balance rather than slippage.
        //
        // Render them the same and the WORST-MEASURED asset on the page becomes
        // the deepest: "≥$50.0M" would put USDS above crvUSD's genuinely
        // bracketed $25M.
        var dUnresponsive = dStatus === 'not_size_responsive' ||
                            liq.two_pct_depth_size_responsive === false;
        var dFloor = !dUnresponsive &&
                     (liq.total_2pct_depth_is_floor === true ||
                      dStatus === 'ladder_exhausted' || dStatus === 'quote_failed');
        var depthTxt = liqIsFree
            ? (liq.free_liquidity_pct.toFixed(1) + '% free')
            : ((liq.total_2pct_depth != null)
                ? (dFloor ? '\u2265' : '') + this.formatCurrency(liq.total_2pct_depth)
                : 'n/a');
        var dWord = '';
        if (!liqIsFree && liq.total_2pct_depth != null) {
            if (dUnresponsive) dWord = ' \u2014 quote does not vary with size';
            else if (dStatus === 'bracketed') dWord = ' (bracketed)';
            else if (dStatus === 'quote_failed') dWord = ' (floor \u2014 route failed)';
            else if (dFloor) dWord = ' (floor)';
        }
        // ⚠️ The liquidity score is one leg of two. The axis is "exit", and exit
        // has a venue leg and a redemption leg — but the rating is computed from
        // depth alone, so the number is narrower than the label.
        //
        // Refusing to rate would unrate 17 of 19 assets: only usdm and susds
        // carry a measured gate. An honest page nobody can use is not better
        // than a bounded number, so the scope is STATED rather than the rating
        // withdrawn.
        //
        // ⚠️ And the three states must render differently, which is the whole
        // point. If "redemption unprobed" looked the same on an asset that
        // DECLARES gated_basis: "unmeasured" and on one that says nothing, then
        // declaring a gap would cost the discloser exactly as much as hiding it
        // — the incentive this is meant to fix, rebuilt inside the fix. Four
        // assets scored with no exit leg represented at all while two declared
        // theirs; the honest feeds must not read worse than the silent ones.
        var exitScope = this._exitScopeHtml(liq);
        var liqSub = liqIsFree
            ? 'redemption · free at NAV, rest queues'
            : '2% depth' + dWord + ' · ' + this._volumeSubHtml(liq) + exitScope;
        // Say WHY it is unrated, or an honest blank reads as a missing feed.
        if (this._depthContradictedByLadder(data)) {
            liqSub = '<span class="text-amber-700">depth exceeds the 2% crossing in its own ladder</span>';
        } else if (dUnresponsive) {
            liqSub = '<span class="text-amber-700">quote returns the same answer at every size</span>';
        }

        var cards = [
            {
                label: 'Peg',
                valueHtml: '<span class="' + pegCls + '">' + this.pegPctText(pegPct, 2) + ' ' + pegArrow + '</span>',
                sub: 'premium / discount',
                chip: this._ratingChipHtml(this.pegRating(data, history))
            },
            {
                label: 'Backing',
                valueHtml: this._backingValueHtml(data),
                sub: this._backingSubText(data),
                chip: this._ratingChipHtml(this.backingRating(data),
                                           this.backingUnratedReason(data))
            },
            {
                label: 'Liquidity & Exit',
                valueHtml: depthTxt,
                sub: liqSub,
                chip: this._ratingChipHtml(this.liquidityRating(data))
            },
            {
                label: 'Dependencies',
                valueHtml: nUp + ' <span class="text-sm font-normal text-slate-400">up</span> · ' + depDownHtml,
                sub: 'upstream / downstream',
                chip: '<a href="#section-dependencies" class="axis-rating r-na">View links →</a>'
            },
            {
                // ⚠️ Unrated by design, and the card says why rather than showing a
                // bare dash. contract_score does not exist for any asset; see the
                // axis-5 comment in renderAxisSections.
                label: 'Contract',
                valueHtml: '<span class="text-slate-400">—</span>',
                sub: 'admin authority & delay',
                chip: '<span class="axis-rating r-na" title="No contract_score exists for any asset in the risk feed. The material is rendered in the axis below; the score is not yet authored.">Not scored yet</span>'
            },
            {
                label: this._escapeAttr(this._issuerAxisInfo(issuer).label),
                valueHtml: this._issuerBadgeHtml(issuer),
                sub: 'editorial · subjective',
                // ⚠️ This slot was EMPTY whenever the report was not linkable,
                // and it is the only card in the band that can be. Four cards
                // carry a chip and the fifth carries nothing, which reads as a
                // failed render rather than as an absent report — the same
                // "correct-looking blank" that has cost the most today.
                //
                // The producer already says why: report_url_status is
                // "unavailable" when a report exists but is not published yet
                // (yzUSD/syzUSD are staged on tidresearch and 404), and
                // "unverified" when it could not be checked. Say which, rather
                // than leaving a gap the reader has to interpret.
                chip: this._reportUrlUsable(issuer)
                    ? '<a href="' + issuer.report_url + '" target="_blank" rel="noopener noreferrer" class="axis-rating r-na">Report →</a>'
                    : this._reportChipHtml(issuer)
            }
        ];

        container.innerHTML = cards.map(function(c) {
            return '<div class="summary-card">' +
                '<div class="card-label">' + c.label + '</div>' +
                '<div class="card-value">' + c.valueHtml + '</div>' +
                (c.sub ? '<div class="text-xs text-slate-400 mt-1">' + c.sub + '</div>' : '') +
                (c.chip ? '<div class="mt-2">' + c.chip + '</div>' : '') +
            '</div>';
        }).join('');
        container.style.display = '';
    },

    _pegTrendArrow(data, history) {
        // Compare current |deviation| to the 7-day average; ▲ = widening (worse),
        // ▼ = tightening (better). Muted when no history.
        var avg = this._pegAvgAbsDev(data, history, 7);
        var cur = data.peg && data.peg.premium_discount_pct != null ? Math.abs(data.peg.premium_discount_pct) : null;
        if (avg == null || cur == null) return '';
        if (cur > avg * 1.05) return '<span class="text-red-500" title="widening vs 7d avg">▲</span>';
        if (cur < avg * 0.95) return '<span class="text-green-500" title="tightening vs 7d avg">▼</span>';
        return '<span class="text-slate-400" title="flat vs 7d avg">▶</span>';
    },

    // ⚠️ collateral_ratio_basis was published by five feeds and read by none.
    //
    // A CR is only comparable to another CR on the same basis, and these are not:
    // apxusd's is netted of POL and inventory, usg's is a debt-weighted mean over
    // active markets, usdm's backing CR is stable-only while its SUMMARY basis
    // says in as many words "NOT USDm's own coverage". That warning was sitting
    // in the payload, invisible, next to the number it warns about.
    //
    // Taken from the block the VALUE came from, same discipline as the scale.
    _backingBasis(data) {
        var fromBacking = data.backing && data.backing.collateral_ratio != null;
        var blk = fromBacking ? data.backing : (data.summary || {});
        if (blk.collateral_ratio_basis) return blk.collateral_ratio_basis;
        // ⚠️ A DELIBERATELY NULL ratio still has a basis, and it is the most
        // load-bearing one on the page: thUSD's says "Deliberately null. Total
        // backing is NOT OBSERVABLE", sUSDai's says "No collateral ratio is
        // defined for this asset." Keying on the value being non-null dropped
        // the explanation precisely where there is no number to speak for
        // itself. A basis describing an absent value is still describing its
        // own block.
        var b = data.backing || {};
        if (!fromBacking && b.collateral_ratio === null && b.collateral_ratio_basis) {
            return b.collateral_ratio_basis;
        }
        return null;
    },

    // Shared basis panel for the BESPOKE renderers.
    //
    // ⚠️ Eight assets showed their ratio basis on hover only, because their
    // renderers clear axis-backing-head to build their own and the generic basis
    // line cannot reach them. The strings were doing real work behind that
    // tooltip — sUSDe "a claim on USDe is worth what USDe is backed by", thUSD
    // "total backing is NOT OBSERVABLE", syrup "three INDEPENDENT reads".
    //
    // Returns a panel so each renderer can place it inside its own §3 rather
    // than having a line injected into a head it owns.
    backingBasisPanelHtml(data) {
        var b = (data && data.backing) || {};
        var rows = [];
        function add(label, text) {
            if (!text) return;
            rows.push('<div class="text-xs text-slate-600 mt-2" style="line-height:1.5;">' +
                '<span class="font-semibold">' + label + ':</span> ' +
                CommonRenderer._escapeAttr(text) + '</div>');
        }
        var basis = this._backingBasis(data);
        add('Ratio basis', basis);
        // collateral_ratio_note is a SECOND field, not a copy — thUSD publishes
        // both and they differ. Skip it only when it restates the basis.
        // ⚠️ Compare case- and punctuation-insensitively. thUSD's two fields open
        // "Deliberately null. Total backing is NOT OBSERVABLE" and "...is not
        // observable" — the same sentence in different case, which a literal
        // comparison treats as two findings and prints twice.
        var note = b.collateral_ratio_note;
        function key(x) { return String(x).toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 60); }
        if (note && basis && key(note) === key(basis)) note = null;
        add('Ratio note', note);
        add('Surplus basis', this._surplusBasis(data));
        // ⚠️ "RESIDUAL... Ties by construction and is NOT evidence the off-chain
        // backing exists" — a figure that looks measured and is not.
        add('Off-chain backing', b.off_chain_backing_note);
        if (!rows.length) return '';
        return '<div class="panel">' +
            '<div class="panel-title" style="margin-bottom:0.15rem;">What this number is</div>' +
            rows.join('') +
        '</div>';
    },

    // Same block discipline as _backingBasis: the basis describes the value in
    // ITS OWN block, so take it from wherever surplus_deficit itself came from.
    _surplusBasis(data) {
        var b = data.backing || {};
        var sum = data.summary || {};
        if (b.surplus_deficit != null) return b.surplus_deficit_basis || null;
        if (sum.surplus_deficit != null) return sum.surplus_deficit_basis || null;
        return b.surplus_deficit_basis || sum.surplus_deficit_basis || null;
    },

    // Format a CR so rounding cannot move it across a rating cutoff.
    _crDisplay(cr, data) {
        var cuts = [];
        var bOv = data.asset_specific && data.asset_specific.axis_thresholds
                  && data.asset_specific.axis_thresholds.backing;
        if (bOv && Array.isArray(bOv.cr_pct)) cuts = bOv.cr_pct;
        else cuts = this._axisThresholds(data).backing.cr_pct || [];
        for (var dp = 2; dp <= 6; dp++) {
            var rounded = Number(cr.toFixed(dp));
            var crossed = cuts.some(function (c) {
                return (cr < c && rounded >= c) || (cr >= c && rounded < c);
            });
            if (!crossed) return this.formatPercent(cr, dp);
        }
        return this.formatPercent(cr, 6);
    },

    _backingValueHtml(data) {
        var cr = (data.backing && data.backing.collateral_ratio != null)
            ? data.backing.collateral_ratio : (data.summary && data.summary.collateral_ratio);
        // No CR, but a measured partial coverage figure — show what IS known.
        // Uses on_chain_coverage_display_pct, which the producer publishes
        // already-scaled beside on_chain_coverage_pct_is_fraction; the raw field
        // is a FRACTION and rendering it directly would print 0.43%.
        if (cr == null) {
            var cov = data.backing && data.backing.on_chain_coverage_display_pct;
            if (cov != null) {
                var covCls = cov >= 70 ? 'text-green-600' : 'text-red-600';
                var covBasis = (data.backing || {}).collateral_ratio_basis;
                return '<span class="' + covCls + '"' +
                    (covBasis ? ' title="' + this._escapeAttr(covBasis) + '"' : '') + '>' +
                    this.formatPercent(cov, 2) + '</span>' +
                    '<span class="text-slate-400 text-xs"> on-chain</span>';
            }
            return '—';
        }
        var cls = cr >= 100 ? 'text-green-600' : 'text-red-600';
        var basis = this._backingBasis(data);
        // ⚠️ Never round ACROSS a rating boundary. susds is 99.999993 — seven
        // millionths of a point below par, which its own basis explains as noise
        // between a token balance and a chi-derived denominator — and it rendered
        // "100.00%" beside a Stress chip and a deficit. The number and the chip
        // then contradict each other and the page reads as broken when it is not.
        // Show enough decimals that the displayed figure sits on the same side of
        // the boundary as the real one. A no-op for every value not sitting on a
        // cutoff.
        var shown = this._crDisplay(cr, data);
        return '<span class="' + cls + '"' +
            (basis ? ' title="Basis: ' + this._escapeAttr(basis) + '"' : '') + '>' +
            shown + '</span>' +
            (basis ? '<span class="text-slate-400 text-xs" title="Basis: ' +
                     this._escapeAttr(basis) + '"> \u24d8</span>' : '');
    },

    _backingSubText(data) {
        var b = data.backing || {};
        // ⚠️ A null CR is not always "nothing to show". thUSD's is deliberately
        // null because TOTAL backing is unobservable — but on-chain coverage IS
        // measured, is flagged critical, and was sitting six inches below a blank
        // card. Distinguish that from susdai, whose null means a NAV vault has no
        // backing ratio at all: there, nothing is known and a dash is honest.
        if (b.collateral_ratio == null && b.on_chain_coverage_display_pct != null) {
            return 'on-chain only \u2014 total backing unobservable';
        }
        var sd = (b.surplus_deficit != null)
            ? b.surplus_deficit : (data.summary && data.summary.surplus_deficit);
        var base = (sd == null)
            ? 'collateral ratio'
            : (sd >= 0 ? 'surplus +' : 'deficit −') + this.formatCurrency(Math.abs(sd));
        // ⚠️ USDat's tile read "100.00% · surplus +$0 · Healthy 4/5" while its
        // own feed said the ratio is an ETHEREUM-ONLY statement and the BSC leg
        // exposes no backing accessor, so that leg's backing is UNREAD, not
        // absent. The word Ethereum appeared once on the page and BSC not at
        // all. 100.00% Healthy is the most reassuring pair of figures a backing
        // tile can show, and the one fact qualifying it was published and
        // rendered nowhere.
        //
        // supply_scope is a machine-readable enum, not prose — render it, don't
        // parse the note. The full note goes near the panels; this is the chip
        // that stops the headline being read as a global claim.
        var scope = data.summary && data.summary.supply_scope;
        if (scope) {
            base += ' \u00b7 ' + String(scope).replace(/_/g, '-') + ' scope';
        }
        return base;
    },

    _issuerAxisInfo(issuer) {
        issuer = issuer || {};
        var badge = typeof issuer.badge === 'string' ? issuer.badge.trim() : '';
        // Only treat a badge as an axis score when it ends in a numeric N/10.
        // Names such as USDS's "Sky (MakerDAO)" must remain opaque badge text.
        var scoredBadge = badge.match(/^(.+?)\s+(\d+(?:\.\d+)?)\/10$/i);
        var isStructural = Object.prototype.hasOwnProperty.call(issuer, 'structural_score') ||
            issuer.structural_score_status != null;
        var prefix = isStructural ? 'structural' : 'issuer';
        var score = issuer[prefix + '_score'];
        var status = issuer[prefix + '_score_status'];
        var label = scoredBadge ? scoredBadge[1].trim() : (isStructural ? 'Structural' : 'Issuer');

        return {
            label: label,
            badge: badge,
            scoredBadge: scoredBadge,
            score: score,
            status: status,
            source: issuer[prefix + '_score_source'],
            generatedAt: issuer[prefix + '_score_generated_at'],
            ageHours: issuer[prefix + '_score_age_hours'],
            inheritedFrom: issuer[prefix + '_score_inherited_from'] ||
                (prefix !== 'issuer' ? null : issuer.issuer_score_inherited_from)
        };
    },

    _issuerBadgeText(issuer) {
        var info = this._issuerAxisInfo(issuer);
        if (info.scoredBadge) return info.scoredBadge[2] + '/10';
        if (info.badge) {
            // The unavailable badge follows the same "Axis unavailable" contract,
            // but the summary card already carries the axis label above it.
            if (info.status === 'unavailable' && /\s+unavailable$/i.test(info.badge)) return 'unavailable';
            return info.badge;
        }
        if (info.score != null) return info.score + '/10';
        if (info.status === 'unavailable') return 'unavailable';
        return '—';
    },

    _issuerScoreTooltip(info) {
        var parts = [];
        if (info.inheritedFrom) parts.push(info.label + ' score inherited from ' + info.inheritedFrom);
        if (info.status && info.status !== 'ok') parts.push('Status: ' + info.status.replace(/_/g, ' '));
        if (info.generatedAt) parts.push('Generated ' + this.formatDate(info.generatedAt));
        if (info.ageHours != null) parts.push('Age ' + Number(info.ageHours).toFixed(1) + 'h');
        if (info.source) parts.push('Source: ' + info.source);
        return parts.join(' · ');
    },

    _issuerBadgeHtml(issuer) {
        var info = this._issuerAxisInfo(issuer);
        var text = this._issuerBadgeText(issuer);
        var tooltip = this._issuerScoreTooltip(info);
        var status = info.status && info.status !== 'ok'
            ? ' <span class="text-xs font-normal text-amber-600">· ' +
                this._escapeAttr(info.status.replace(/_/g, ' ')) + '</span>'
            : '';
        return '<span' + (tooltip ? ' title="' + this._escapeAttr(tooltip) + '"' : '') + '>' +
            this._escapeAttr(text) + '</span>' + status;
    },

    // --- section heads ---
    _renderAxisHead(name, num, title, sub, ratingHtml, block) {
        var el = document.getElementById('axis-' + name + '-head');
        if (!el) return;
        el.innerHTML =
            '<span class="axis-num">' + num + '</span>' +
            '<span class="axis-title">' + title + '</span>' +
            (sub ? '<span class="axis-sub">' + sub + '</span>' : '') +
            (ratingHtml || '') +
            this._axisClockHtml(block);
    },

    // ⚠️ ONE PAGE STAMP OVER SIX CLOCKS. The header reads "Updated: 0.4h ago"
    // from the file's top-level timestamp while, on yzUSD right now:
    //
    //   peg.market_price_as_of        23.9h
    //   liquidity.venues_as_of         5.4h
    //   issuer.issuer_score_...       17.8h
    //   asset_specific.exposure_as_of 41.8h
    //
    // pegtracker-f9 found this by taking my own argument against an assembler
    // and applying it INSIDE a single producer's file — six cadences, one stamp,
    // and a block with no clock silently inherits one that is honest about the
    // file and wrong about the block. No assembler required.
    //
    // So each axis states its own age. ⚠️ It is NOT an alarm: 17.8h is correct
    // for an editorial score and 41.8h is the issuer's own exposure cadence.
    // The defect was never that the data is old, it is that the page implied it
    // was 0.4h old. Amber only past 24h, and only to draw the eye.
    _axisClockHtml(block) {
        if (!block || typeof block !== 'object') return '';
        // ⚠️ Take the OLDEST declared input, not the first one found. An axis is
        // only as fresh as its stalest component: yzUSD's liquidity block carries
        // exit_mark.as_of at 1.7h AND venues_as_of at 5.4h, and quoting the 1.7h
        // would be the same flattery as the file stamp, one level down.
        //
        // Scans one level deep plus exit_mark, because the producers name these
        // per-field (market_price_as_of, venues_as_of, volume_24h_as_of) rather
        // than with a block-level `as_of`. I have asked for one spelling; until
        // it lands, accepting the existing names beats rendering "undeclared"
        // over clocks that are plainly there.
        var stamp = null, oldest = -1, stampKey = null;
        function consider(v, key) {
            if (typeof v !== 'string') return;
            var t = new Date(v.endsWith('Z') || v.indexOf('+') > 0 ? v : v + 'Z');
            if (isNaN(t)) return;
            var age = Date.now() - t.getTime();
            if (age > oldest) { oldest = age; stamp = v; stampKey = key; }
        }
        var RX = /(as_of|generated_at|observed_at)$/;
        Object.keys(block).forEach(function(k) {
            if (RX.test(k)) consider(block[k], k);
            var v = block[k];
            if (v && typeof v === 'object' && !Array.isArray(v)) {
                Object.keys(v).forEach(function(k2) { if (RX.test(k2)) consider(v[k2], k + '.' + k2); });
            }
        });
        if (!stamp) {
            // A block with no clock is UNDECLARED, not fresh. Saying nothing
            // would let it inherit the header stamp by implication — the exact
            // thing this fixes — and would penalise the producers who do declare.
            return '<span class="axis-clock axis-clock-none" title="This block declares no as_of, so its age is unknown. It is NOT necessarily as fresh as the page header.">cadence undeclared</span>';
        }
        var t = new Date(stamp.endsWith('Z') || stamp.indexOf('+') > 0 ? stamp : stamp + 'Z');
        if (isNaN(t)) return '';
        var h = (Date.now() - t.getTime()) / 3600000;
        var txt = h < 1 ? Math.max(0, Math.round(h * 60)) + 'm' :
                  h < 48 ? h.toFixed(1) + 'h' : Math.round(h / 24) + 'd';
        return '<span class="axis-clock' + (h > 24 ? ' axis-clock-old' : '') +
            '" title="Oldest declared input on this axis: ' + this._escapeAttr(stampKey || 'as_of') +
            ' = ' + this._escapeAttr(stamp) +
            '. \u26a0\ufe0f The field is NAMED because the oldest stamp is not always an input \u2014 syzUSD retains coingecko_price_as_of for a mark it REJECTED, and that diagnostic is older than the price actually published. The page header shows when the FILE was assembled, which is not the same thing as any of these.">' +
            txt + ' old</span>';
    },

    // --- the four non-backing sections + backing head ---
    renderAxisSections(data, history) {
        var ids = ['section-peg', 'section-liquidity', 'section-dependencies',
                   'section-contract', 'section-issuer'];
        if (!this.hasAxisBlocks(data)) {
            // Legacy asset: keep the 4 sections hidden and the backing head empty.
            ids.forEach(function(id) { var s = document.getElementById(id); if (s) s.classList.add('hidden'); });
            var bh = document.getElementById('axis-backing-head'); if (bh) bh.innerHTML = '';
            return false;
        }
        ids.forEach(function(id) { var s = document.getElementById(id); if (s) s.classList.remove('hidden'); });

        // 1 · Peg
        this._renderAxisHead('peg', 1, 'Peg',
            (data.peg.source ? 'market vs NAV · ' + data.peg.source : 'market vs NAV'),
            this._ratingChipHtml(this.pegRating(data, history)), data.peg);
        this._renderPegSection(data, history);

        // ⚠️ 2 is BACKING and 3 is LIQUIDITY — swapped from the original frame.
        // The dashboard ran 1 Peg · 2 Liquidity · 3 Backing while the published
        // reports ran 2 Backing · 3 Liquidity, so "axis 2" meant two different
        // things depending which surface you were reading. Three of five
        // positions disagreed while everyone argued about the label at 5.
        //
        // 2 · Backing (head only — panels are rendered by the existing common path)
        this._renderAxisHead('backing', 2, 'Backing', 'reserves & collateral ratio',
            this._ratingChipHtml(this.backingRating(data)), data.backing);
        // ⚠️ collateral_ratio_basis was rendered ONLY as a hover tooltip on a ⓘ
        // glyph beside the tile. For most assets that is a reasonable place for
        // a definition. For syzUSD it is not: its basis says the headline
        // 109.02% is "INHERITED from yzUSD" — the number belongs to a DIFFERENT
        // ASSET — and a qualifier of that weight cannot live behind a hover,
        // which does not exist at all on a touch device.
        //
        // So it also renders as text under the Backing head, where the reader
        // meets it before the panels. Same string, same source block, no
        // heuristics about which basis "matters" — 23 of 25 feeds publish one
        // and every one of them is explaining a denominator a reader would
        // otherwise assume.
        var basisText = this._backingBasis(data);
        // The tile prints "surplus +$X" beside the ratio, and for three feeds the
        // surplus is NOT on the ratio's basis — apxUSD's is gross where the ratio
        // is netted, frax's is against liabilities where supply gives a different
        // sign, and USDS says outright "NOT total_backing - total_supply.
        // Subtracting the published totals gives +$23.2M against this figure."
        // A reader who tries to reconcile the two numbers cannot, and nothing on
        // the page said why. Published by 11 feeds, rendered by none.
        var sdBasis = this._surplusBasis(data);
        var backingHead = document.getElementById('axis-backing-head');
        if ((basisText || sdBasis) && backingHead) {
            if (basisText) {
                var bNote = document.createElement('div');
                bNote.className = 'axis-basis-note';
                bNote.textContent = 'Basis: ' + basisText;
                backingHead.appendChild(bNote);
            }
            if (sdBasis) {
                var sNote = document.createElement('div');
                sNote.className = 'axis-basis-note';
                sNote.textContent = 'Surplus basis: ' + sdBasis;
                backingHead.appendChild(sNote);
            }
        }
        // Optional composition sub-panel (USDC held-vs-denominated split + per-Star
        // breakdown). Data-gated & additive: no-op for assets lacking the fields.
        this._renderBackingComposition(data);

        // 3 · Liquidity & Exit. Renamed from "Liquidity": the axis covers BOTH
        // exit paths — secondary venue depth AND primary redemption with the
        // issuer — and they fail independently. The rating is still computed
        // from depth alone, which is why the tile states its scope.
        this._renderAxisHead('liquidity', 3, 'Liquidity & Exit',
            'venue depth & primary redemption',
            this._ratingChipHtml(this.liquidityRating(data)), data.liquidity);
        this._renderLiquiditySection(data);

        // 4 · Dependencies
        // ⚠️ An array's LENGTH is how many rows the producer sent, not how many
        // exist. A producer-side cap of 6 became the on-page claim "6 upstream"
        // when there were 13 — and the length looked authoritative precisely
        // because it was wrong. Prefer the declared count, and when the list is
        // knowingly partial say so rather than passing the cap off as the total.
        var dep = data.dependencies || {};
        var upRows = Array.isArray(dep.upstream) ? dep.upstream.length : 0;
        var upTotal = (typeof dep.upstream_count === 'number') ? dep.upstream_count : upRows;
        var upSub = (dep.upstream_complete === false || upTotal > upRows)
            ? 'top ' + upRows + ' of ' + upTotal + ' upstream'
            : upTotal + ' upstream';
        // Ordering is a claim too: thinnest-first reads as largest-first to
        // anyone who assumes size ordering, so name it when the producer does.
        if (dep.upstream_sorted_by) {
            upSub += ' (' + String(dep.upstream_sorted_by).replace(/_/g, ' ') + ')';
        }
        var downSub = (dep.downstream_tracked === true)
            ? (Array.isArray(dep.downstream) ? dep.downstream.length : 0) + ' downstream'
            : 'downstream not tracked';
        this._renderAxisHead('dependencies', 4, 'Dependencies', upSub + ' \u00b7 ' + downSub, '', data.dependencies);
        this._renderDependenciesSection(data);

        // 5 · Contract & Admin — MEASURED. Split from Issuer because they fail
        // independently and the evidence is of different kinds. USDat is the
        // live case: 4-of-6 behind a 72h delay at token level, while a 3-of-6
        // with NO timelock owns the CCIP pools. One score over both hides that.
        //
        // ⚠️ It renders UNRATED for now, and the reason is stated on the page.
        // contract_score does not exist for any asset — 0 of 146 in the risk
        // feed. It exists only at PROTOCOL level, where it means smart-contract
        // SECURITY (audit quality), which is a different measurement: a protocol
        // scoring 9.0 on audits can still hold a bare EOA upgrade key, which is
        // exactly what this axis is for. An unexplained blank is
        // indistinguishable from an oversight, so it must never be silent.
        this._renderAxisHead('contract', 5, 'Contract & Admin',
            'admin authority, delay, upgrade & pause surface',
            this._ratingChipHtml(null), (data.asset_specific || {}).control || (data.asset_specific || {}).governance);
        this._renderContractSection(data);

        // 6 · Editorial axis (issuer, structural, or a future per-asset label)
        var issuerInfo = this._issuerAxisInfo(data.issuer || {});
        this._renderAxisHead('issuer', 6, this._escapeAttr(issuerInfo.label), 'editorial — subjective axis', '',
            { as_of: (data.issuer || {}).issuer_score_generated_at ||
                     (data.issuer || {}).structural_score_generated_at });
        this._renderIssuerSection(data);
        return true;
    },

    // ------ Backing composition sub-panel (data-gated, additive) ------
    // Renders into #backing-extra-panels ONLY when the analyzer emits the
    // composition fields (backing.usdc_raw_held / usdc_denominated and/or
    // backing.stars[]). For every other asset the slot is cleared, so this is a
    // pure no-op that cannot regress a page lacking the fields. Same safe/additive,
    // gated-on-data pattern as the syrup credit-vault primitives (liquidityRating
    // band_score, free_liquidity_pct, backingRating cr_pct).
    // ⚠️ backing.alternatives and backing.volatile_bucket — a SCHEMA-LEVEL
    // convention, published and unread. The point of `alternatives` is that the
    // rated headline is one of several legitimate readings, so publishing the
    // headline alone reproduces exactly the ambiguity the field exists to close.
    // usdm carries it today; usg, apxusd and susdat have the same shape.
    //
    // Deliberately key-agnostic. The producer renamed drawdown_to_gross_100_pct
    // to drawdown_to_par_pct between two copies of the same file, so anything
    // that hardcoded a key would have silently stopped rendering. Any *_pct is
    // shown as a percent, any *_usd as currency, note as prose, *_basis as a
    // tooltip on its sibling.
    _humanizeKey(k) {
        return String(k).replace(/_pct$|_usd$/, '').replace(/_/g, ' ')
            .replace(/\bpct\b/g, '%');
    },

    _renderAlternativesHtml(b) {
        var alt = b.alternatives;
        var vol = b.volatile_bucket;
        if ((!alt || typeof alt !== 'object') && (!vol || typeof vol !== 'object')) return '';
        var self = this;

        function rowsFor(obj) {
            return Object.keys(obj).filter(function (k) {
                return k !== 'note' && !/_basis$/.test(k) && typeof obj[k] === 'number';
            }).map(function (k) {
                var v = obj[k];
                // Explicit about what it can format. An unrecognised key renders
                // its bare number rather than being silently given a unit.
                var val = /_usd$/.test(k) ? self.formatCurrencyExact(v)
                        : /_pct$/.test(k) ? self.formatPercent(v, 2)
                        : String(v) + ' <span class="text-slate-400 text-xs">(unit not declared)</span>';
                var basis = obj[k.replace(/_pct$|_usd$/, '') + '_basis'] || obj[k + '_basis'];
                return '<tr>' +
                    '<td class="text-slate-600 dark:text-slate-300">' + self._escapeAttr(self._humanizeKey(k)) + '</td>' +
                    '<td class="text-right font-mono"' + (basis ? ' title="' + self._escapeAttr(basis) + '"' : '') +
                        '>' + val + (basis ? ' \u24d8' : '') + '</td>' +
                '</tr>';
            }).join('');
        }

        var head = '';
        if (vol && typeof vol === 'object') {
            // The drawdown figure is the one number here that does not depend on
            // choosing a mark, so it leads.
            var ddKey = Object.keys(vol).filter(function (k) { return /^drawdown_/.test(k) && /_pct$/.test(k); })[0];
            var dd = ddKey ? vol[ddKey] : null;
            head = '<div class="text-sm text-slate-700 dark:text-slate-200 mb-2">' +
                (dd != null ? '<span class="font-semibold">Par survives a ' + this.formatPercent(dd, 1) +
                    ' drawdown</span> in the volatile bucket' : 'Volatile bucket') +
                (vol.pct_of_reserve != null ? ', which is <span class="font-mono">' +
                    this.formatPercent(vol.pct_of_reserve, 1) + '</span> of the reserve' : '') +
                (vol.composition ? ' \u2014 ' + this._escapeAttr(vol.composition) : '') + '.' +
            '</div>';
        }

        // Table carries the ALTERNATIVE RATIOS only. The volatile bucket is
        // already stated in the sentence above, and putting its fields through
        // the same formatter produced "usd = 4862481.42" and "% of reserve =
        // 24.09" — my suffix heuristic reads _usd/_pct endings and these are
        // named `usd` and `pct_of_reserve`. Rather than widen a unit guess based
        // on key names (the thing this repo keeps getting wrong), scope the table
        // to the block that is actually a list of ratios.
        var body = alt ? rowsFor(alt) : '';
        var notes = [alt && alt.note, vol && vol.note].filter(Boolean).map(function (n) {
            return '<div class="text-xs text-slate-500 mt-2">' + self._escapeAttr(n) + '</div>';
        }).join('');

        return '<div class="panel">' +
            '<div class="panel-title">Other readings of this ratio</div>' +
            '<p class="text-sm text-slate-500 mb-3">The rated figure is one of several defensible ' +
                'denominators. These are published so it can be audited against the ones not chosen.</p>' +
            head +
            (body ? '<div class="data-table-scroll"><table class="data-table"><tbody>' + body + '</tbody></table></div>' : '') +
            notes +
        '</div>';
    },

    _renderBackingComposition(data) {
        var slot = document.getElementById('backing-extra-panels');
        if (!slot) return;
        var b = data.backing || {};
        var altHtml = this._renderAlternativesHtml(b);
        var raw = b.usdc_raw_held, den = b.usdc_denominated;
        var hasUsdcSplit = (raw && raw.value != null) || (den && den.value != null);
        var stars = Array.isArray(b.stars) ? b.stars : [];
        if (!hasUsdcSplit && !stars.length) { slot.innerHTML = altHtml; return; }

        var fmt = this.formatCurrencyExact.bind(this);
        var pct1 = function(v) { return v != null ? CommonRenderer.formatPercent(v, 1) : '—'; };
        // Compact $ for the star cards (billions read cleanly in a narrow card).
        var fmtBig = function(v) {
            if (v == null) return '—';
            if (Math.abs(v) >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
            return CommonRenderer.formatCurrency(v);
        };
        var esc = function(s) {
            return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        };
        // Trust chip: on-chain / trustless → green; attested / off-chain source → amber.
        var trustChip = function(trust, source, labelOverride) {
            var t = String(trust || '').toLowerCase();
            var s = String(source || '').toLowerCase();
            var onchain = t === 'trustless' || t === 'onchain' || s === 'onchain';
            var cls = onchain ? 'r-ok' : 'r-warn';
            var txt = labelOverride || (onchain ? 'on-chain' : 'attested');
            return '<span class="axis-rating ' + cls + '">' + esc(txt) + '</span>';
        };
        var palette = ['#6366f1', '#3b82f6', '#14b8a6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#84cc16'];

        var html = '';

        // ---- Dual-USDC row: held (raw) vs denominated ----
        if (hasUsdcSplit) {
            var usdcTile = function(obj, label, badgeText) {
                if (!obj || obj.value == null) return '';
                return '<div class="dep-card">' +
                    '<div class="flex items-center justify-between mb-1 gap-2">' +
                        '<div class="card-label">' + esc(label) + '</div>' +
                        trustChip(obj.trust, obj.source, badgeText) +
                    '</div>' +
                    '<div class="card-value">' + fmt(obj.value) + '</div>' +
                    '<div class="text-xs text-slate-400 mt-1">' + pct1(obj.pct) + ' of supply · source: ' + esc(obj.source || '—') + '</div>' +
                    (obj.note ? '<div class="text-xs text-slate-400 mt-1">' + esc(obj.note) + '</div>' : '') +
                '</div>';
            };
            html +=
                '<div class="panel">' +
                    '<div class="panel-title">USDC exposure — held vs denominated</div>' +
                    '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">' +
                        usdcTile(raw, 'USDC held (raw)', 'on-chain') +
                        usdcTile(den, 'USDC-denominated exposure', 'attested · denominated, not held') +
                    '</div>' +
                    '<p class="text-xs text-slate-400 mt-3">Raw = actual USDC held on-chain (trustless). Denominated = USDC-settled instruments (T-bills / CLO / OTC lending) attested by BlockAnalitica — denominated in USDC but not held as USDC.</p>' +
                '</div>';
        }

        // ---- Per-Star composition cards ----
        if (stars.length) {
            var recon = b.reconciliation || {};
            var driftByStar = {};
            (Array.isArray(recon.star_drift) ? recon.star_drift : []).forEach(function(d) {
                if (d && d.star) driftByStar[d.star] = d;
            });

            var cards = stars.map(function(st) {
                var trust = st.trust || {};
                var sizeChip = trustChip(trust.size, st.size_source, null);
                var mix = Array.isArray(st.mix) ? st.mix : [];
                var mixHtml = '';
                if (mix.length) {
                    mixHtml = '<div class="mt-3">' + mix.map(function(m, i) {
                        var color = palette[i % palette.length];
                        var w = Math.max(0, Math.min(100, m.pct || 0));
                        return '<div class="flex items-center justify-between text-xs mb-0.5">' +
                                '<span>' + esc(m.category) + '</span>' +
                                '<span class="font-mono text-slate-500">' + pct1(m.pct) + '</span>' +
                            '</div>' +
                            '<div class="pct-bar-container mb-1.5"><div class="pct-bar" style="width:' + w + '%; background:' + color + '"></div></div>';
                    }).join('') + '</div>';
                    mixHtml += '<div class="text-[11px] text-slate-400 mt-1">mix source: ' + esc(st.mix_source || (trust.mix || 'aggregate')) + '</div>';
                } else {
                    mixHtml = '<div class="text-[11px] text-slate-400 mt-3">Per-star asset mix not itemised in this snapshot (aggregate-only).</div>';
                }
                // Surface a size-drift caveat where BA-backed and on-chain size disagree.
                var drift = driftByStar[st.star];
                var driftHtml = '';
                if (drift && drift.status && String(drift.status).toUpperCase() === 'WARN' && drift.drift_pct != null) {
                    driftHtml = '<div class="text-[11px] text-amber-600 mt-1" title="On-chain allocator debt vs BlockAnalitica backed value">' +
                        'size drift vs attested: ' + CommonRenderer.formatPercent(drift.drift_pct, 1) + '</div>';
                }
                var vaultHtml = st.allocator_vault
                    ? '<div class="text-[11px] font-mono text-slate-400 mt-1" title="Allocator vault">' + esc(st.allocator_vault.slice(0, 6) + '…' + st.allocator_vault.slice(-4)) + '</div>'
                    : '';
                return '<div class="dep-card">' +
                    '<div class="flex items-center justify-between mb-1 gap-2">' +
                        '<div class="dep-card-name">' + esc(st.label || st.star) + '</div>' +
                        sizeChip +
                    '</div>' +
                    '<div class="card-value" style="font-size:1.25rem">' + fmtBig(st.size_usd) + '</div>' +
                    '<div class="text-xs text-slate-400 mt-0.5">' + pct1(st.size_pct) + ' of supply · size: ' + esc(st.size_source || '—') + '</div>' +
                    driftHtml +
                    vaultHtml +
                    mixHtml +
                '</div>';
            }).join('');

            html +=
                '<div class="panel">' +
                    '<div class="panel-title">Per-Star composition</div>' +
                    '<div class="dep-grid">' + cards + '</div>' +
                '</div>';
        }

        slot.innerHTML = html;
    },

    _renderPegSection(data, history) {
        var body = document.getElementById('axis-peg-body');
        if (!body) return;
        var peg = data.peg || {};
        var pct = peg.premium_discount_pct;
        var st = this.pegStatusClass(pct);
        var pctCls = this.pegPctClass(st);
        var mkt = peg.market_price, nav = peg.nav;
        var fmtP = function(v) { return v != null ? v.toFixed(4) : '—'; };

        var metricRow =
            '<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">' +
                '<div><div class="text-xs text-slate-400 font-medium uppercase">Market price</div>' +
                    '<div class="text-lg font-bold font-mono">' + fmtP(mkt) + '</div>' +
                    // ⚠️ A peg mark with no timestamp cannot be told from a stale
                    // one, and syzUSD proved the cost: a 30.2-hour-old CoinGecko
                    // price divided by a live accruing NAV rendered −2.84% and
                    // rated the axis Stress 1/5, against a true −0.25%. The
                    // producer now publishes market_price_as_of / _age_hours /
                    // _source, so the age travels WITH the number instead of
                    // being a thing a reader has to assume.
                    // ⚠️ AGE IS COMPUTED FROM `market_price_as_of`, NOT read from a
                    // published `market_price_age_hours`. A stored age is stale by
                    // construction — this fleet already published
                    // `price_age_hours: 0.012` identically across four unrelated
                    // assets, because it was the age of the RUN rather than of the
                    // mark, which made a downstream freshness guard unable to fire.
                    //
                    // pegtracker-f9 kept the stored field alive behind a named
                    // exemption solely because this line read it. This removes the
                    // reason, so the field can go.
                    (function () {
                        var srcTxt = peg.market_price_source
                            ? CommonRenderer._escapeAttr(String(peg.market_price_source).replace(/^peg_tracker:/, ''))
                            : (peg.market_price_as_of ? 'source not named' : null);
                        var h = null;
                        if (peg.market_price_as_of) {
                            var t = new Date(peg.market_price_as_of.endsWith('Z') ||
                                             peg.market_price_as_of.indexOf('+') > 0
                                             ? peg.market_price_as_of : peg.market_price_as_of + 'Z');
                            if (!isNaN(t)) h = (Date.now() - t.getTime()) / 3600000;
                        }
                        if (srcTxt == null && h == null) return '';
                        var ageTxt = h == null ? '' :
                            ' · ' + (h < 1 ? Math.max(0, Math.round(h * 60)) + 'm old'
                                           : h.toFixed(1) + 'h old');
                        return '<div class="text-[11px] mt-0.5 ' +
                            (h != null && h > 6 ? 'text-amber-700 font-semibold' : 'text-slate-400') + '"' +
                            (peg.market_price_as_of
                                ? ' title="as of ' + CommonRenderer._escapeAttr(peg.market_price_as_of) + '"'
                                : ' title="No market_price_as_of is published, so the age of this mark is unknown."') +
                            '>' + (srcTxt || 'source not named') + ageTxt + '</div>';
                    })() +
                '</div>' +
                '<div><div class="text-xs text-slate-400 font-medium uppercase">NAV / theoretical</div>' +
                    '<div class="text-lg font-bold font-mono">' + fmtP(nav) + '</div>' +
                    // ⚠️ syzUSD is rated Stress 1/5 on a −2.84% deviation measured
                    // against "the on-chain ERC-4626 NAV (a redemption value, not
                    // a peg)" — its own words, published in nav_basis and shown
                    // nowhere. A discount to a redemption value on a yield-bearing
                    // vault is not the same claim as a stablecoin off its peg, and
                    // the tile said the second while the feed said the first.
                    (peg.nav_basis
                        ? '<div class="text-[11px] text-slate-400 mt-0.5" style="line-height:1.35;">vs ' +
                          this._escapeAttr(peg.nav_basis) + '</div>' : '') +
                '</div>' +
                '<div><div class="text-xs text-slate-400 font-medium uppercase">Premium / discount</div>' +
                    '<div class="text-lg font-bold font-mono ' + pctCls + '">' + this.pegPctText(pct, 3) + '</div></div>' +
                '<div><div class="text-xs text-slate-400 font-medium uppercase">Status</div>' +
                    '<div class="text-lg font-bold ' + pctCls + '">' + this.pegStatusLabel(st) + '</div></div>' +
            '</div>';

        // peg.history_ref may name a file OTHER than the backing history that was
        // passed in — the per-asset {slug}_peg_history.json exports do exactly
        // that. Until now history_ref was never fetched: this read only the
        // backing history, so crvusd (0 peg fields in 692 rows) and usds rendered
        // "Peg history not tracked" while a populated export sat unread beside
        // them. Declaring a source is not the same as reading it.
        var pegRef = peg.history_ref;
        var usesOwnFile = !!(pegRef && !/_backing_history\.json$/.test(pegRef));
        var hasHist = usesOwnFile || (history && Array.isArray(history.entries) &&
            history.entries.some(function(e) { return e[peg.history_field] != null; }));
        var chartBlock = hasHist
            ? '<div class="chart-container"><canvas id="peg-chart"></canvas></div>'
            : '<div class="text-sm text-slate-400">Peg history not tracked for this asset.</div>';

        // The producer's own reading of the deviation. For yzUSD: "24h volume is
        // $24.74 — a deviation struck on this little turnover is weak evidence
        // about fair value and strong evidence about exit cost." That is the
        // interpretation of the number directly above it, and it was published
        // and unrendered.
        var pegNote = peg.note
            ? '<div class="text-xs text-slate-500 mt-3" style="line-height:1.5;">' +
              this._escapeAttr(peg.note) + '</div>'
            : '';

        body.innerHTML =
            '<div class="panel">' +
                '<div class="panel-title">Peg Performance</div>' +
                metricRow +
                pegNote +
                chartBlock +
            '</div>';

        if (hasHist) {
            if (usesOwnFile) {
                var self = this;
                var nc = Math.floor(Date.now() / 60000);
                fetch('data/' + pegRef + '?nocache=' + nc)
                    .then(function(r) { return r.ok ? r.json() : null; })
                    .then(function(h) {
                        if (h && Array.isArray(h.entries)) self._renderPegChart(data, h);
                        else self._pegChartUnavailable(pegRef);
                    })
                    .catch(function() { self._pegChartUnavailable(pegRef); });
            } else {
                this._renderPegChart(data, history);
            }
        }
    },

    _pegChartUnavailable(ref) {
        var ctx = document.getElementById('peg-chart');
        if (ctx && ctx.parentElement) {
            ctx.parentElement.innerHTML =
                '<div class="text-sm text-slate-400">Peg history unavailable (' +
                String(ref).replace(/[<>&]/g, '') + ').</div>';
        }
    },

    _renderPegChart(data, history) {
        var ctx = document.getElementById('peg-chart');
        if (!ctx) return;
        var field = data.peg.history_field || 'peg_market_price';
        var nav = data.peg.nav != null ? data.peg.nav : 1.0;
        var entries = history.entries.filter(function(e) { return e[field] != null; });
        var labels = entries.map(function(e) { return new Date(e.timestamp.endsWith('Z') ? e.timestamp : e.timestamp + 'Z'); });
        var series = entries.map(function(e) { return e[field]; });

        // ⚠️ THE REFERENCE LINE WAS TODAY'S NAV DRAWN FLAT ACROSS ALL HISTORY.
        //
        // Correct for a $1 par target. Wrong for an accruing share, where every
        // historical point gets compared against a NAV that had not accrued
        // yet — so the whole series sits under the line and reads as a
        // persistent discount, with the error zero at the right edge and growing
        // backwards. sUSDe's left edge read −1.09% on a day it was AT its NAV;
        // the gap drawn was three months of yield.
        //
        // Three cases, resolved by what the data can actually support:
        //   per-row theoretical  -> plot it as a real second line, no annotation
        //   percent-scale field  -> the reference is ZERO, not a price
        //   par target (nav = 1) -> the flat line is right, keep it
        //   otherwise            -> draw NO reference and say why
        //
        // The last one matters: sUSDe is the asset that motivated this and it has
        // NO per-row theoretical in 2,159 rows, so the fix that works for apyUSD
        // cannot work for it. A wrong reference line is worse than none.
        var theoSeries = entries.map(function(e) { return e.peg_theoretical_price; });
        var theoCount = theoSeries.filter(function(v) { return v != null; }).length;
        var theoDistinct = {};
        theoSeries.forEach(function(v) { if (v != null) theoDistinct[v] = 1; });
        var hasTheo = theoCount >= entries.length * 0.9 && Object.keys(theoDistinct).length > 1;

        // The `_pct` suffix is the producer's own naming of the field, not a unit
        // inferred from a value — but bound it anyway, so a mis-named price field
        // cannot silently move the reference to zero.
        var isPct = /_pct$/.test(field) && series.every(function(v) {
            return typeof v === 'number' && Math.abs(v) <= 50;
        });
        // ⚠️ sUSDS plots `field: nav` — the SERIES IS the NAV curve, so a marker at
        // today's value is a legitimate "you are here" on its own line, not a
        // false reference. riskAnalyst named it explicitly so a sweep would not
        // "fix" it into something worse, and the first cut of this did exactly
        // that: stripped its marker and captioned it as unreferenced.
        var isSelfNav = /^(nav|nav_per_share|peg_theoretical_price)$/.test(field);
        var isPar = !isPct && !hasTheo && !isSelfNav && Math.abs(nav - 1) < 1e-9;
        var noReference = !isPct && !hasTheo && !isPar && !isSelfNav;

        if (window._pegChart) window._pegChart.destroy();
        window._pegChart = new Chart(ctx, {
            type: 'line',
            data: { labels: labels, datasets: [{
                label: isPct ? 'Deviation' : (isSelfNav ? 'NAV' : 'Market price'),
                data: series,
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.08)',
                fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2
            }].concat(hasTheo ? [{
                label: 'NAV / theoretical',
                data: theoSeries,
                borderColor: '#94a3b8',
                borderDash: [4, 4],
                fill: false, tension: 0.3, pointRadius: 0, borderWidth: 1.5
            }] : []) },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    x: { type: 'time', time: { unit: 'day', displayFormats: { day: 'MMM d' } },
                         grid: { display: false }, ticks: { maxTicksLimit: 8, font: { size: 11 } } },
                    y: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 11 },
                         callback: function(v) { return v.toFixed(3); } } }
                },
                plugins: {
                    legend: { display: hasTheo },
                    tooltip: { callbacks: { label: function(c) {
                        var v = c.raw;
                        if (v == null) return '';
                        return (c.dataset.label || '') + ': ' +
                               (isPct ? v.toFixed(3) + '%' : v.toFixed(4));
                    } } },
                    annotation: { annotations: (isPct
                        ? { par: { type: 'line', yMin: 0, yMax: 0, borderColor: '#94a3b8',
                                   borderWidth: 1, borderDash: [4, 4],
                                   label: { content: '0% \u2014 at NAV', display: true, position: 'start',
                                            font: { size: 9 }, color: '#64748b' } } }
                        : (isPar
                            ? { par: { type: 'line', yMin: 1, yMax: 1, borderColor: '#94a3b8',
                                       borderWidth: 1, borderDash: [4, 4],
                                       label: { content: 'Par 1.00', display: true, position: 'start',
                                                font: { size: 9 }, color: '#64748b' } } }
                            : (isSelfNav
                                ? { par: { type: 'line', yMin: nav, yMax: nav, borderColor: '#94a3b8',
                                           borderWidth: 1, borderDash: [4, 4],
                                           label: { content: 'Today ' + nav.toFixed(4), display: true,
                                                    position: 'end', font: { size: 9 }, color: '#64748b' } } }
                                : {}))) }
                },
                interaction: { intersect: false, mode: 'index' }
            }
        });

        // When no reference can be drawn honestly, say so rather than leaving a
        // bare series a reader will mentally compare against par.
        var holder = ctx.parentNode;
        if (holder) {
            var prev = holder.parentNode && holder.parentNode.querySelector('.peg-chart-note');
            if (prev) prev.remove();
            if (noReference) {
                var n = document.createElement('div');
                n.className = 'peg-chart-note text-xs text-slate-500 mt-2';
                n.style.lineHeight = '1.45';
                n.textContent = 'No NAV reference drawn: this asset\'s NAV accrues (today ' +
                    nav.toFixed(4) + ') and the history carries no per-row theoretical, so a flat ' +
                    'line at today\'s value would read as a discount that never happened. ' +
                    'Compare points to each other, not to a level.';
                holder.parentNode.insertBefore(n, holder.nextSibling);
            }
        }
    },

    _renderLiquiditySection(data) {
        var body = document.getElementById('axis-liquidity-body');
        if (!body) return;
        var liq = data.liquidity || {};
        var em = liq.exit_mark || {};
        var quotes = em.quotes || {};

        // Headline exit mark = the KyberSwap RFQ ladder (As-built #2). Lead with it.
        var sizes = Object.keys(quotes).map(Number).filter(function(n) { return !isNaN(n); }).sort(function(a, b) { return a - b; });
        var ladderRows = sizes.map(function(sz) {
            var q = quotes['' + sz] || quotes[sz] || {};
            var bps = q.slippage_bps;
            var cls = bps == null ? '' : (bps <= 25 ? 'text-green-600' : (bps <= 200 ? 'text-amber-600' : 'text-red-600'));
            return '<tr>' +
                '<td class="font-mono">' + CommonRenderer.formatCurrency(sz) + '</td>' +
                '<td class="text-right font-mono ' + cls + '">' + (bps != null ? bps.toFixed(1) + ' bps' : '—') + '</td>' +
                '<td class="text-right font-mono">' + (q.output_usd != null ? CommonRenderer.formatCurrencyExact(q.output_usd) : '—') + '</td>' +
            '</tr>';
        }).join('');

        var ladderBlock = sizes.length
            ? '<div class="text-sm font-semibold text-slate-700 mb-2">Exit mark — ' +
                  (em.source || 'RFQ') + ' sell into ' + (em.sell_into || '—') + '</div>' +
              '<div class="data-table-scroll"><table class="data-table">' +
                  '<thead><tr><th>Size sold</th><th class="text-right">Slippage</th><th class="text-right">Net out</th></tr></thead>' +
                  '<tbody>' + ladderRows + '</tbody></table></div>'
            : '<div class="text-sm text-slate-400">No exit-mark RFQ ladder in this snapshot.</div>';

        // ⚠️ Four n/a's read as "we know nothing about this asset's liquidity".
        // For usdm the feed says something quite different: there is no secondary
        // depth BY DESIGN, because Mento pools are a mint/redeem venue, and the
        // holder's actual exit is the reserve swap. Same shape as usdat's two
        // zero rows — the page said something answerable, so nobody asked.
        //
        // "How does a holder get out" is the question this axis exists to
        // answer, and for a reserve-backed asset the answer is a redemption venue
        // rather than pool depth. Generic: any such asset has this shape and
        // total_2pct_depth: null stays correct for all of them.
        var pe = liq.primary_exit;
        var exitLine = '';
        if (pe && (pe.venue || pe.into)) {
            exitLine =
                '<div class="text-sm text-slate-700 dark:text-slate-200 mt-3">' +
                    '<span class="font-semibold">Primary exit:</span> ' +
                    this._escapeAttr(pe.venue || 'venue not named') +
                    (pe.into ? ' \u2192 ' + this._escapeAttr(pe.into) : '') +
                    // ⚠️ pe.gated is DELIBERATELY NOT RENDERED. usdm publishes
                    // gated:false while riskAnalyst's report says the redemption
                    // path is gated to allowlisted strategies. One is wrong and
                    // it is unresolved with PegTracker. Rendering false would
                    // assert "open to any holder" on the strength of a field
                    // under dispute — and that is the more dangerous direction,
                    // since it overstates how easily a holder can leave.
                    // Restore once the producer confirms it is measured.
                    //
                    // ⚠️ The UNMEASURED case is different and safe to show. "Primary
                    // exit: Yuzu redemption → reserve stables" reads as an exit that
                    // exists and works; yzUSD's own gated_note says "Redemption
                    // reachability is not probed in v1. ⚠️ Unmeasured, not open."
                    // Naming a venue while withholding that is the flattering
                    // direction — it implies a route out that nothing has tested.
                    //
                    // Rendered ONLY when the exit is not asserted open, so the
                    // disputed gated:false case stays withheld as above.
                    ((pe.gated == null || pe.gated_basis === 'unmeasured') && pe.gated_note
                        ? '<div class="text-xs text-amber-700 mt-1" style="line-height:1.45;">' +
                          this._escapeAttr(pe.gated_note) + '</div>' : '') +
                '</div>';
        }
        var poolsNote = liq.pools_note
            ? '<div class="text-xs text-slate-500 mt-1">' + this._escapeAttr(liq.pools_note) + '</div>'
            : '';

        var eff = liq.effective_max_under_25bps_usd;

        // ⚠️ Sell-side inventory: a MEASURED number that was going unshown.
        //
        // Where a pool is heavily skewed, a symmetric depth figure overstates what
        // a SELLER can execute — usg's worst pool is 73.6% USG, so the counter-side
        // stablecoin inventory is the real exit. The producer measured it and,
        // correctly, refused to put it in total_2pct_depth, which is reserved for
        // quoted depth. The result was a card showing four n/a's and a pool TVL the
        // producer had flagged as misleading, while the one figure it had measured
        // appeared nowhere — implying less is known than is.
        //
        // Displayed only. NOT fed to liquidityRating: that stays null, because an
        // executable inventory is not quoted depth and rating one as the other is
        // the substitution the producer declined to make. Generic on the field
        // names, not usg-specific — other feeds will want "what a seller can
        // execute into" as distinct from depth.
        var sellSide = liq.sell_side_counter_inventory_usd;
        var sellCard = (sellSide == null) ? '' :
            '<div><div class="text-xs text-slate-400 font-medium uppercase">Sell-side inventory</div>' +
                '<div class="text-lg font-bold">' + this.formatCurrency(sellSide) + '</div>' +
                '<div class="text-[11px] text-slate-400"' +
                    (liq.sell_side_basis ? ' title="' + this._escapeAttr(liq.sell_side_basis) + '"' : '') +
                    '>executable, not quoted depth' +
                    (liq.worst_pool_usg_share_pct != null
                        ? ' \u00b7 worst pool ' + liq.worst_pool_usg_share_pct.toFixed(1) + '% skewed' : '') +
                '</div></div>';

        // ⚠️ The pool table read {venue, pair, depth_usd, balance_ratio} and the
        // yzUSD/syzUSD feeds publish {name, project, chain, tvl_usd}, so every
        // row rendered "— Monad — —". Two of those columns are not a rename:
        // depth and balance ratio have no source in these feeds and shouldn't be
        // faked from TVL — TVL is not depth.
        //
        // So the columns follow the data instead of asserting a fixed schema. A
        // column appears when at least one pool supplies it; a feed that gains
        // depth later gains the column with no change here, and a feed without
        // it shows a narrower table rather than a wall of dashes.
        var pools = liq.pools || [];
        function anyPool(key) {
            return pools.some(function(p) { return p && p[key] != null; });
        }
        var cols = [];
        cols.push({ th: 'Venue', cls: '', get: function(p) {
            var nm = p.venue || p.project || p.name || '—';
            return '<span class="font-medium">' + nm + '</span>' +
                   (p.pair ? '<span class="text-xs text-slate-400 ml-1">' + p.pair + '</span>' : '');
        }});
        if (anyPool('chain')) cols.push({ th: 'Chain', cls: 'text-xs text-slate-400',
            get: function(p) { return p.chain || ''; }});
        if (anyPool('tvl_usd')) cols.push({ th: 'TVL (USD)', cls: 'text-right font-mono',
            get: function(p) { return p.tvl_usd != null ? CommonRenderer.formatCurrencyExact(p.tvl_usd) : '—'; }});
        if (anyPool('depth_usd')) cols.push({ th: 'Depth (USD)', cls: 'text-right font-mono',
            get: function(p) { return p.depth_usd != null ? CommonRenderer.formatCurrencyExact(p.depth_usd) : '—'; }});
        if (anyPool('volume_24h')) cols.push({ th: '24h Vol', cls: 'text-right font-mono',
            get: function(p) {
                if (p.volume_24h == null) return '—';
                return Math.abs(p.volume_24h) < 1000
                    ? '$' + p.volume_24h.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : CommonRenderer.formatCurrencyExact(p.volume_24h);
            }});
        if (anyPool('balance_ratio')) cols.push({ th: 'Balance', cls: 'text-right font-mono',
            get: function(p) { return (p.balance_ratio * 100).toFixed(1) + '%'; }});

        var poolRows = pools.map(function(p) {
            return '<tr>' + cols.map(function(c) {
                return '<td class="' + c.cls + '">' + c.get(p) + '</td>';
            }).join('') + '</tr>';
        }).join('');
        // ⚠️ pools_note points at a number the page did not show: "Lending markets
        // are listed under asset_specific.lending_exposure: they are the LARGER
        // numbers." On syzUSD that is $1.83M of lending exposure against $554K of
        // swap TVL — the pool table showed the smaller figure and the note sent
        // the reader to a field with no rendering.
        //
        // by_chain is the structure behind it: swap, lending and issuer-vault TVL
        // per chain from one enumeration. syzUSD's Plasma row is $71K of swap
        // against $36.2M sitting in the issuer vault, which is the whole
        // exit-capacity story and it was in the payload unread.
        var byChain = Array.isArray(liq.by_chain) ? liq.by_chain : [];
        var chainBlock = '';
        if (byChain.length) {
            var showLend = byChain.some(function(c) { return c.lending_tvl_usd; });
            var showVault = byChain.some(function(c) { return c.issuer_vault_tvl_usd; });
            chainBlock =
                '<div class="text-sm font-semibold text-slate-700 mb-2 mt-6">TVL by chain</div>' +
                '<div class="data-table-scroll"><table class="data-table">' +
                '<thead><tr><th>Chain</th><th class="text-right">Swap</th>' +
                (showLend ? '<th class="text-right">Lending</th>' : '') +
                (showVault ? '<th class="text-right">Issuer vault</th>' : '') +
                '<th>Local venue</th></tr></thead><tbody>' +
                byChain.map(function(c) {
                    return '<tr>' +
                        '<td class="font-medium">' + CommonRenderer._escapeAttr(c.chain || '—') + '</td>' +
                        '<td class="text-right font-mono">' + (c.swap_tvl_usd != null ? CommonRenderer.formatCurrency(c.swap_tvl_usd) : '—') + '</td>' +
                        (showLend ? '<td class="text-right font-mono">' + (c.lending_tvl_usd != null ? CommonRenderer.formatCurrency(c.lending_tvl_usd) : '—') + '</td>' : '') +
                        (showVault ? '<td class="text-right font-mono">' + (c.issuer_vault_tvl_usd != null ? CommonRenderer.formatCurrency(c.issuer_vault_tvl_usd) : '—') + '</td>' : '') +
                        '<td class="text-xs ' + (c.no_local_swap_venue ? 'text-amber-700 font-semibold' : 'text-slate-500') + '">' +
                            (c.no_local_swap_venue ? 'none — holders cannot exit locally'
                                : (c.swap_venues != null ? c.swap_venues + ' venue' + (c.swap_venues === 1 ? '' : 's') : '—')) +
                        '</td>' +
                    '</tr>';
                }).join('') +
                '</tbody></table></div>' +
                (liq.by_chain_note ? '<div class="text-xs text-slate-500 mt-2" style="line-height:1.45;">' +
                    this._escapeAttr(liq.by_chain_note) + '</div>' : '') +
                (liq.lending_exposure_usd
                    ? '<div class="text-xs text-slate-600 mt-2"><span class="font-semibold">Lending exposure:</span> ' +
                      this.formatCurrencyExact(liq.lending_exposure_usd) +
                      ' — a liquidation-risk figure, not exit depth.</div>' : '');
        }

        var poolBlock = pools.length
            ? '<div class="text-sm font-semibold text-slate-700 mb-2 mt-6">Pools</div>' +
              '<div class="data-table-scroll"><table class="data-table">' +
                  '<thead><tr>' + cols.map(function(c) {
                      return '<th' + (/text-right/.test(c.cls) ? ' class="text-right"' : '') + '>' + c.th + '</th>';
                  }).join('') + '</tr></thead>' +
                  '<tbody>' + poolRows + '</tbody></table></div>'
            : '';

        // ⚠️ "24h volume: n/a — not tracked" was a HARDCODED literal that read no
        // field, sitting in a panel whose own object carries volume_24h_usd. It
        // was true when written and silently stopped being true.
        //
        // For yzUSD this is the most informative liquidity fact on the page:
        // $24.74 of 24h volume against $852K of pool TVL says more than any
        // rating. It is also the reason no executable ladder was built — the
        // volume figure IS the finding, and it could not reach the page.
        //
        // "not tracked" was additionally false for hastra-prime, usdat and
        // susdat, which publish per-pool volume_24h with a source and an as-of.
        // ⚠️ formatCurrencyExact rounds to whole dollars, which renders yzUSD's
        // $24.74 as "$25" — and the exactness IS the finding here. A tiny volume
        // is the signal; rounding it away turns a striking number into a dull
        // one. Cents below $1,000, whole dollars above.
        function volFmt(v) {
            return Math.abs(v) < 1000
                ? '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : CommonRenderer.formatCurrencyExact(v);
        }
        var vol = liq.volume_24h_usd;
        var volCard;
        if (vol != null) {
            volCard = '<div><div class="text-xs text-slate-400 font-medium uppercase">24h volume</div>' +
                '<div class="text-lg font-bold">' + volFmt(vol) + '</div></div>';
        } else if (anyPool('volume_24h')) {
            volCard = '<div><div class="text-xs text-slate-400 font-medium uppercase">24h volume</div>' +
                '<div class="text-lg font-bold text-slate-400">per pool</div>' +
                '<div class="text-[11px] text-slate-400">see table</div></div>';
        } else {
            volCard = '<div><div class="text-xs text-slate-400 font-medium uppercase">24h volume</div>' +
                '<div class="text-lg font-bold text-slate-400">n/a</div>' +
                '<div class="text-[11px] text-slate-400">not published</div></div>';
        }

        var statRow =
            '<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">' +
                '<div><div class="text-xs text-slate-400 font-medium uppercase">2% depth</div>' +
                    // ⚠️ total_2pct_depth_is_floor means the quote ladder was
                    // EXHAUSTED before price moved 2% — the real depth is at
                    // least this, not equal to it. sUSDS publishes it true and
                    // nothing read it, so the page showed "$1.0M" where the
                    // honest reading is "≥$1.0M". It understates, which makes
                    // the liquidity rating harsher than the measurement warrants.
                    '<div class="text-lg font-bold">' +
                        (liq.total_2pct_depth != null
                            ? (liq.total_2pct_depth_is_floor === true ? '\u2265' : '') +
                              this.formatCurrency(liq.total_2pct_depth)
                            : 'n/a') + '</div>' +
                    // ⚠️ Four kinds of number wore the same label. The producer
                    // now declares which: `bracketed` located the crossing
                    // between two rungs, `ladder_exhausted` never reached it,
                    // `quote_failed` hit a broken route, `not_size_responsive`
                    // means the quote path ignores the size argument entirely
                    // (USDS returns 0.00bps from $5M to $100M — a fixed-rate PSM
                    // swap, so "clears $5M" is evidence about the call, not the
                    // venue). Extending rungs there only extends the tautology.
                    //
                    // The distinction is the whole finding: usde published $5M
                    // while quoting that same rung at −1490bps, because one
                    // comparison read a signed cost as though it were a
                    // magnitude. Rendering "≥" or a bracket is what stops a
                    // bound being read as a measurement.
                    this._depthQualifierHtml(liq) +
                    (liq.total_2pct_depth == null && liq.total_2pct_depth_note
                        ? '<div class="text-[11px] text-slate-400" title="' +
                          this._escapeAttr(liq.total_2pct_depth_note) + '">unmeasured, not zero \u24d8</div>' : '') +
                '</div>' +
                sellCard +
                '<div><div class="text-xs text-slate-400 font-medium uppercase">Max ≤25 bps</div>' +
                    '<div class="text-lg font-bold">' + (eff != null ? this.formatCurrency(eff) : 'n/a') + '</div></div>' +
                '<div><div class="text-xs text-slate-400 font-medium uppercase">Pool TVL</div>' +
                    '<div class="text-lg font-bold">' + (liq.total_tvl != null ? this.formatCurrency(liq.total_tvl) : 'n/a') + '</div></div>' +
                volCard +
            '</div>';


        body.innerHTML = '<div class="panel">' +
            '<div class="panel-title">Liquidity &amp; Exit</div>' +
            statRow + exitLine + ladderBlock + poolBlock + poolsNote + chainBlock +
        '</div>';
    },

    _renderDependenciesSection(data) {
        var body = document.getElementById('axis-dependencies-body');
        if (!body) return;
        var dep = data.dependencies || {};
        var up = Array.isArray(dep.upstream) ? dep.upstream : [];
        var down = Array.isArray(dep.downstream) ? dep.downstream : [];

        // A dependency's `note` is where the producer puts the thing that makes
        // the row mean something other than what it looks like: a ticker
        // collision (USG's reUSD is Resupply's, not Re Protocol's), a 100%
        // concentration (sUSDS), a circularity. Every one of those was
        // published and dropped on the floor here — the card rendered name and
        // metric only. `circular` gets its own marker so it survives even when
        // no prose accompanies it.
        //
        // `label` is accepted as a name fallback because not every feed spells
        // the field `name`; a dependency with no renderable name showed as an
        // em-dash, which is indistinguishable from an unnamed dependency.
        function card(d) {
            var note = d.note
                ? '<div class="dep-card-note' +
                      (d.circular === true ? ' dep-card-note-warn' : '') + '">' +
                      d.note + '</div>'
                : '';
            var circChip = (d.circular === true && !d.note)
                ? '<div class="dep-card-note dep-card-note-warn">⚠️ Circular: this dependency\'s own backing includes the asset above.</div>'
                : '';
            var inner =
                '<div class="dep-card-name">' + (d.name || '—') + '</div>' +
                (d.metric ? '<div class="dep-card-metric">' + d.metric + '</div>' : '') +
                note + circChip;
            if (d.link && d.link_type === 'internal') {
                // An internal link is only a link if the target is registered.
                // Feeds name dependencies this dashboard may not serve, and an
                // ?asset= href to an unregistered slug renders as a live link
                // and lands on nothing. Show the dependency, not the dead link.
                var m = /[?&]asset=([^&]+)/.exec(d.link);
                var known = !m || !Array.isArray(CommonRenderer.KNOWN_ASSET_SLUGS) ||
                            CommonRenderer.KNOWN_ASSET_SLUGS.indexOf(m[1]) !== -1;
                if (known) {
                    return '<a href="' + d.link + '" class="dep-card">' + inner +
                        '<div class="dep-card-link">Open dashboard →</div></a>';
                }
                return '<div class="dep-card">' + inner +
                    '<div class="dep-card-link text-slate-400">No dashboard</div></div>';
            }
            if (d.link && d.link_type === 'external') {
                return '<a href="' + d.link + '" target="_blank" rel="noopener noreferrer" class="dep-card">' + inner +
                    '<div class="dep-card-link">External ↗</div></a>';
            }
            return '<div class="dep-card">' + inner +
                '<div class="dep-card-link text-slate-400">No dashboard</div></div>';
        }

        var upBlock = up.length
            ? '<div class="dep-grid">' + up.map(card).join('') + '</div>'
            : '<div class="text-sm text-slate-400">No upstream dependencies tracked.</div>';

        // The block-level note describes the LIST — what it contains and how it
        // is ordered (USG: "ALL active markets, thinnest headroom first"; USDm:
        // why the volatile bucket sits apart). Without it the grid is a set of
        // rows with no stated basis, which is the same defect as an undeclared
        // denominator. Sits under the grid it describes, not above it.
        if (dep.note) {
            upBlock += '<div class="dep-block-note">' + dep.note + '</div>';
        }

        // ⚠️ THE LEGS DO NOT PARTITION. yzUSD's 16 upstream shares sum to 108.53%,
        // and nothing on the page said so — a reader adding the rows gets 108%
        // and either distrusts the page or, worse, does not add them.
        //
        // riskAnalyst found this while reproducing my protocol-grouping finding,
        // and it is the same rule I had just given them one axis over: publish
        // the set, not the derived number. `distinct_protocol_count` alone would
        // have hidden it completely — the count is right, the shares are right,
        // and the SUM is the thing that says what they mean.
        //
        // ⚠️ States the arithmetic only. The CAUSE — that a levered leg's
        // collateral and its borrowed asset can both appear — is their inference
        // and belongs in the producer's note, not asserted by a renderer.
        // Prefers the producer's own `pct_sums_to` / `is_partition` once emitted.
        // ⚠️ SAME-COUNTERPARTY LEGS READ AS INDEPENDENT EXPOSURES. yzUSD lists 16
        // upstream legs that resolve to 10 counterparties. Ethena has a
        // CONCENTRATION flag pointing at it; MAPLE DOES NOT — 20.67% split across
        // three separate rows with no flag, no adjacency, and no reason for a
        // reader to add them. riskAnalyst's case, and it is stronger than the
        // Ethena one I led with.
        //
        // ⚠️ Deliberately narrow about what this claims. It groups on the
        // PRODUCER'S OWN NAME PREFIX — "[Maple]_syrupUSDT_Loop" — and says so.
        // It does NOT assert that two legs are the same counterparty from any
        // knowledge of the world, and it does NOT sum their shares, because the
        // legs do not partition (108.53%) and a summed share would be a number I
        // invented. The producer's `by_protocol` is the right home for the
        // arithmetic; this makes the repetition visible until it exists.
        //
        // Fires only where the convention is actually used: 15 of 16 legs on
        // yzUSD, zero on every other asset.
        var prefixCount = {};
        up.forEach(function(x) {
            var m = /^\[([^\]]+)\]/.exec(x && x.name || '');
            if (m) prefixCount[m[1]] = (prefixCount[m[1]] || 0) + 1;
        });
        var shared = Object.keys(prefixCount).filter(function(k) { return prefixCount[k] > 1; });
        if (shared.length) {
            upBlock += '<div class="dep-block-note"><span class="text-amber-700">' +
                'Several legs share a counterparty prefix:</span> ' +
                shared.sort(function(a, b) { return prefixCount[b] - prefixCount[a]; })
                      .map(function(k) { return CommonRenderer._escapeAttr(k) + ' \u00d7' + prefixCount[k]; })
                      .join(' \u00b7 ') +
                '. Grouped on the producer\'s own name prefix, not on an independent ' +
                'counterparty check \u2014 and their shares are NOT summed here, because the ' +
                'legs do not partition. ' + up.length + ' rows are not ' + up.length +
                ' independent exposures.</div>';
        }

        var pctSum = dep.pct_sums_to;
        if (pctSum == null && up.length > 1) {
            var acc = 0, seen = 0;
            up.forEach(function(x) { if (typeof x.pct === 'number') { acc += x.pct; seen++; } });
            if (seen === up.length) pctSum = acc;
        }
        if (up.length > 1 && typeof pctSum === 'number' &&
            (dep.is_partition === false || pctSum > 101 || pctSum < 99)) {
            upBlock += '<div class="dep-block-note"><span class="text-amber-700">' +
                'These shares do not partition:</span> they sum to ' + pctSum.toFixed(1) +
                '%, not 100%. Legs are not mutually exclusive, so they cannot be read as ' +
                'slices of the backing and must not be added.</div>';
        }

        // Downstream is a reserved stub until a consumer analyzer exists. An
        // absent/false `downstream_tracked` flag means "not tracked" (NOT "0") —
        // show the future-version placeholder. Once the analyzer flips the flag
        // true, real cards (or an honest empty state) render with no code change.
        var downBlock;
        if (dep.downstream_tracked === true) {
            downBlock = down.length
                ? '<div class="dep-grid">' + down.map(card).join('') + '</div>'
                : '<div class="text-sm text-slate-400">No downstream consumers currently tracked.</div>';
        } else {
            downBlock = '<div class="dep-card dep-stub">' +
                  '<div class="dep-card-name text-slate-500">Downstream not tracked</div>' +
                  '<div class="dep-card-metric">Consumer tracking (Morpho / Pendle / etc.) coming in a future version.</div>' +
              '</div>';
        }

        body.innerHTML = '<div class="panel">' +
            '<div class="panel-title">Dependencies</div>' +
            '<div class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Upstream — what this asset depends on</div>' +
            upBlock +
            '<div class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 mt-6">Downstream — what depends on this asset</div>' +
            downBlock +
        '</div>';
    },

    _renderIssuerSection(data) {
        var body = document.getElementById('axis-issuer-body');
        if (!body) return;
        body.innerHTML = this.issuerPanelHtml(data) + this._issuerContextHtml(data);
    },

    // Extracted so the BESPOKE renderers can emit axis 6 too. They build their
    // whole axis set into #asset-specific-panels and clear the generic bodies,
    // so before this they simply had no axis 6 — their old "5 Issuer" head was
    // sitting above admin-topology panels, which is Contract & Admin content.
    issuerPanelHtml(data) {
        var issuer = data.issuer || {};
        var info = this._issuerAxisInfo(issuer);
        var badge = info.badge || (info.score != null ? info.label + ' ' + info.score + '/10' :
            (info.status === 'unavailable' ? info.label + ' unavailable' : null));
        var age = issuer.attestation_age_days;
        var scoreTooltip = this._issuerScoreTooltip(info);
        var methodology = info.label.toLowerCase() === 'issuer'
            ? 'The issuer axis is an editorial, subjective rating — KYC, permissioning, governance and admin posture are assessed in the full report rather than scored live here.'
            : 'The ' + this._escapeAttr(info.label.toLowerCase()) +
                ' axis is an editorial, subjective rating. Its asset-specific methodology is assessed in the full report rather than scored live here.';

        var chips =
            (badge ? '<span class="axis-rating r-warn"' +
                (scoreTooltip ? ' title="' + this._escapeAttr(scoreTooltip) + '"' : '') + '>' +
                this._escapeAttr(badge) + '</span>' : '') +
            (info.status && info.status !== 'ok'
                ? '<span class="axis-rating r-na"' +
                    (scoreTooltip ? ' title="' + this._escapeAttr(scoreTooltip) + '"' : '') +
                    '>Score ' + this._escapeAttr(info.status.replace(/_/g, ' ')) + '</span>'
                : '') +
            (age != null ? '<span class="axis-rating r-na" title="Last attestation age">Attested ' + age + 'd ago</span>' : '');

        var reportLink = this._reportUrlUsable(issuer)
            ? '<a href="' + issuer.report_url + '" target="_blank" rel="noopener noreferrer" ' +
                'class="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700">' +
                'Read the full risk report →</a>'
            : (issuer.report_url
                ? '<span class="text-sm text-slate-400">Report not linked \u2014 the producer marks it ' +
                  this._escapeAttr(String(issuer.report_url_status)) + ' rather than published.</span>'
                : '<span class="text-sm text-slate-400">No report linked.</span>');

        // ⚠️ issuer.facts is an EXISTING feed convention that nothing rendered.
        // usds has published four of them — "48h GSM timelock", "Pause Proxy is
        // the sole owner/admin", "Freeze / emergency-shutdown functions exist",
        // an allocator-visibility caveat — and every one was invisible while this
        // section showed only the generic "editorial, subjective axis" line.
        //
        // This is deliberately the mechanism for issuer material rather than
        // hardcoding prose into a renderer. Claims like "unlicensed", "not
        // bankruptcy-remote" or a jurisdiction are assertions about a real
        // company: they belong to the producer, must move when the assessment
        // moves, and are exactly what this repo shipped unsourced once before.
        // A renderer that names a custodian or a legal status is a constant that
        // nothing recomputes.
        var facts = (issuer.facts && Array.isArray(issuer.facts)) ? issuer.facts : [];
        var factsHtml = facts.length
            ? '<ul class="text-sm text-slate-600 dark:text-slate-300 list-disc ml-5 mb-3 space-y-1">' +
                facts.map(function (f) {
                    return '<li>' + CommonRenderer._escapeAttr(String(f)) + '</li>';
                }).join('') +
              '</ul>'
            : '';

        return '<div class="panel">' +
            '<div class="panel-title">' + this._escapeAttr(info.label) + '</div>' +
            '<div class="flex flex-wrap items-center gap-2 mb-3">' + chips + '</div>' +
            factsHtml +
            '<p class="text-sm text-slate-500 mb-3">' + methodology + '</p>' +
            reportLink +
        '</div>';
    },

    // ⚠️ Axis 5 · Contract & Admin. The panels below were rendered under Issuer
    // until the six-axis split, which was a misfiling rather than an omission —
    // 12 of 25 assets carried this material all along.
    //
    // It renders even with no score, because the content is the point and an
    // unrated axis with a stated reason beats a rated one built on the wrong
    // measurement. See the head comment in renderAxisSections.
    _renderContractSection(data) {
        var body = document.getElementById('axis-contract-body');
        if (!body) return;
        var html = this._contractPanelsHtml(data);
        body.innerHTML = html ||
            '<div class="panel"><div class="panel-title">Not assessed</div>' +
            '<div class="text-sm text-slate-500" style="line-height:1.5;">' +
            'No admin-control facts are published for this asset. ' +
            '\u26a0\ufe0f Not assessed \u2014 this is an absence of data, not a finding that ' +
            'control is unconstrained.</div></div>';
    },

    // ⚠️ The issuer axis read "4.0/10" and a line of boilerplate while the feed
    // carried the material a reader actually wants: whether the issuer's own
    // figures were checked against the chain, where they came from, and who can
    // move the money. It sat in asset_specific rather than the issuer block, so
    // this section never looked at it.
    //
    // Everything below is data-gated and no-ops for assets that publish none of
    // it. Nothing is inferred: where the producer says a thing is unknown, the
    // page says unknown.
    _reportChipHtml(issuer) {
        issuer = issuer || {};
        var st = issuer.report_url_status;
        if (st === 'unavailable') {
            return '<span class="axis-rating r-na" title="A report exists but the publisher has not released it yet, so there is nothing to link.">Report not published</span>';
        }
        if (st === 'unverified') {
            return '<span class="axis-rating r-na" title="The producer could not verify the report URL resolves, so it is deliberately not linked.">Report unverified</span>';
        }
        if (st) {
            return '<span class="axis-rating r-na">Report ' + this._escapeAttr(String(st).replace(/_/g, ' ')) + '</span>';
        }
        return '<span class="axis-rating r-na" title="No report URL is published for this asset.">No report</span>';
    },

    _contractPanelsHtml(data) {
        var sp = data.asset_specific || {};
        var out = '';

        // 2. Governance — gated on the NORMALISED shape only. apxusd and
        // syrupusdc publish governance under entirely different keys and are
        // served by their own renderers; matching on quorum_threshold keeps this
        // from half-rendering someone else's schema.
        var g = sp.governance;
        if (g && g.quorum_threshold != null) {
            // ⚠️ "4 of an unstated total" is the whole point. The producer
            // publishes quorum_denominator: null deliberately, having asked the
            // same question I did, so the page says 4-of-unknown rather than
            // implying 4-of-5. A quorum without a denominator is not a posture.
            var quorum = g.quorum_denominator != null
                ? this._escapeAttr(g.quorum_threshold) + '-of-' + this._escapeAttr(g.quorum_denominator)
                : this._escapeAttr(g.quorum_threshold) + '-of-<span class="text-amber-700">unknown</span>';
            var unknowns = Array.isArray(g.unknowns) ? g.unknowns : [];
            out += '<div class="panel">' +
                '<div class="panel-title">Governance (issuer-disclosed)</div>' +
                '<div class="text-sm text-slate-700 dark:text-slate-200">' +
                    '<span class="font-semibold">Quorum:</span> ' + quorum +
                    (g.default_action ? ' · <span class="font-semibold">Default action:</span> ' +
                        this._escapeAttr(g.default_action) : '') +
                    (g.policy_modified_at ? ' · <span class="font-semibold">Policy changed:</span> ' +
                        this.formatDate(g.policy_modified_at) : '') +
                '</div>' +
                (Array.isArray(g.attestation_kinds) && g.attestation_kinds.length
                    ? '<div class="text-xs text-slate-500 mt-2"><span class="font-semibold">Attestation kinds:</span> ' +
                      g.attestation_kinds.map(function(k) { return CommonRenderer._escapeAttr(k); }).join(' · ') +
                      '</div>' : '') +
                (unknowns.length
                    ? '<div class="text-xs mt-2" style="line-height:1.45;">' +
                      '<span class="font-semibold text-amber-700">Not established:</span>' +
                      '<ul class="list-disc ml-5 mt-1 space-y-1 text-slate-600">' +
                        unknowns.map(function(u) {
                            return '<li>' + CommonRenderer._escapeAttr(String(u)) + '</li>';
                        }).join('') +
                      '</ul></div>' : '') +
                (g.note ? '<div class="text-xs text-slate-500 mt-2" style="line-height:1.45;">' +
                    this._escapeAttr(g.note) + '</div>' : '') +
            '</div>';
        }

        // 3. Control surface — who can change the contract, and what was checked
        // rather than assumed. sUSDS publishes this in full and nothing read it:
        // the pause surface it does NOT have (five selectors tried, all revert),
        // that it IS upgradeable, the authority holding that power, and whether
        // the deployed implementation matches the published one.
        //
        // ⚠️ "No pause function" is only reassuring if someone looked. The
        // producer's note makes the distinction the page has to keep: summary
        // .paused is null "because there is nothing to read — not because a read
        // failed", and the equivalent risk on that asset is an upgrade.
        var ctl = sp.control;
        if (ctl && (ctl.authority || ctl.pause_surface || ctl.upgradeable != null)) {
            var auth = ctl.authority || {};
            var ps = ctl.pause_surface || {};
            var rows = [];
            if (auth.name || auth.address) {
                rows.push(['Authority',
                    this._escapeAttr(auth.name || '—') +
                    (auth.address ? ' <span class="font-mono text-xs">' +
                        this._escapeAttr(auth.address) + '</span>' : '')]);
            }
            if (ctl.upgradeable != null) {
                rows.push(['Upgradeable', ctl.upgradeable
                    ? '<span class="text-amber-700 font-semibold">yes</span>' +
                      (ctl.proxy_admin_slot ? ' <span class="text-xs text-slate-500">· ' +
                        this._escapeAttr(ctl.proxy_admin_slot) + '</span>' : '')
                    : 'no']);
            }
            if (ctl.impl_matches_published != null) {
                rows.push(['Deployed implementation', ctl.impl_matches_published
                    ? '<span class="text-green-600">matches published</span>'
                    : '<span class="text-red-600 font-semibold">DOES NOT match published</span>']);
            }
            if (ps.exists != null) {
                rows.push(['Pause surface', ps.exists
                    ? '<span class="text-amber-700">present</span>'
                    : 'none' + (Array.isArray(ps.checked) && ps.checked.length
                        ? ' <span class="text-xs text-slate-500">(' + ps.checked.length +
                          ' selectors checked: ' +
                          ps.checked.map(function(c) { return CommonRenderer._escapeAttr(c); }).join(', ') +
                          ')</span>' : '')]);
            }
            out += '<div class="panel">' +
                '<div class="panel-title">Control surface</div>' +
                '<table class="data-table"><tbody>' +
                rows.map(function(r) {
                    return '<tr><td class="font-medium" style="width:32%">' + r[0] + '</td><td>' + r[1] + '</td></tr>';
                }).join('') +
                '</tbody></table>' +
                (ps.note ? '<div class="text-xs text-slate-500 mt-2" style="line-height:1.45;">' +
                    this._escapeAttr(ps.note) + '</div>' : '') +
            '</div>';
        }

        return out;
    },

    // ⚠️ Stays with ISSUER (axis 6), not Contract & Admin. Corroboration is
    // about whether the ISSUER'S OWN FIGURES survive an independent read, and
    // the disclosed wallet set is a disclosure-quality fact. Neither is a
    // statement about who can change the contract.
    _issuerContextHtml(data) {
        var sp = data.asset_specific || {};
        var out = '';

        // 1. Corroboration — the strongest issuer-axis fact available: how much
        // of what the issuer reports has been independently reproduced on-chain.
        var corr = sp.corroboration;
        if (corr && corr.checks) {
            var rows = Object.keys(corr.checks).map(function(k) {
                var c = corr.checks[k] || {};
                var ok = c.agrees === true;
                return '<tr>' +
                    '<td class="font-medium">' + CommonRenderer._escapeAttr(k.replace(/_/g, ' ')) + '</td>' +
                    '<td class="text-right font-mono text-xs">' + (c.feed != null ? c.feed : '—') + '</td>' +
                    '<td class="text-right font-mono text-xs">' + (c.chain != null ? c.chain : '—') + '</td>' +
                    '<td class="text-xs ' + (ok ? 'text-green-600' : 'text-red-600') + '">' +
                        (ok ? 'agrees' : 'DISAGREES') + '</td>' +
                '</tr>';
            }).join('');
            out += '<div class="panel">' +
                '<div class="panel-title">Independent verification</div>' +
                '<div class="data-table-scroll"><table class="data-table">' +
                '<thead><tr><th>Check</th><th class="text-right">Issuer feed</th>' +
                '<th class="text-right">On-chain</th><th>Result</th></tr></thead>' +
                '<tbody>' + rows + '</tbody></table></div>' +
                (corr.note ? '<div class="text-xs text-slate-500 mt-2" style="line-height:1.45;">' +
                    this._escapeAttr(corr.note) + '</div>' : '') +
                (sp.feed_url ? '<div class="text-xs text-slate-500 mt-2">' +
                    '<span class="font-semibold">Issuer source:</span> ' +
                    this._escapeAttr(sp.feed_url) +
                    (sp.feed_as_of ? ' · as of ' + this.formatDate(sp.feed_as_of) : '') +
                    '</div>' : '') +
            '</div>';
        }

        // 4. Issuer-disclosed wallets. A count and the addresses, nothing more —
        // the disclosure is the fact, and whether the balances are in the
        // backing figure is a different question the feed answers elsewhere.
        var wal = sp.wallets;
        if (wal && typeof wal === 'object') {
            var groups = Object.keys(wal).filter(function(k) { return Array.isArray(wal[k]) && wal[k].length; });
            if (groups.length) {
                out += '<div class="panel">' +
                    '<div class="panel-title">Issuer-disclosed wallets</div>' +
                    groups.map(function(gname) {
                        var list = wal[gname];
                        return '<div class="mb-2">' +
                            '<div class="text-sm font-semibold text-slate-700 dark:text-slate-200">' +
                                CommonRenderer._escapeAttr(gname) + ' \u00b7 ' + list.length + '</div>' +
                            '<div class="text-xs font-mono text-slate-500" style="line-height:1.6; word-break:break-all;">' +
                                list.map(function(w) {
                                    return CommonRenderer._escapeAttr(w.wallet || w.address || '—');
                                }).join(' \u00b7 ') +
                            '</div>' +
                        '</div>';
                    }).join('') +
                    (sp.wallets_note ? '<div class="text-xs text-slate-500 mt-1" style="line-height:1.45;">' +
                        this._escapeAttr(sp.wallets_note) + '</div>' : '') +
                '</div>';
            }
        }
        return out;
    }
};
