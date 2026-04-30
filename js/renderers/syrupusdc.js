/**
 * syrupUSDC renderer — Maple institutional open-term lending pool.
 *
 * Renders, in order:
 *   1. Vault State (NAV, totalAssets, totalSupply, liquidityCap, deployment %)
 *   2. Yield Decomposition (base / season-incentive / headline + delegate fee)
 *   3. Loan Book Composition (when default breakdown table is hidden)
 *   4. Loan Book Health (Phase 2 — top-10 loans + status disclaimer)
 *   5. Exit Realism (withdrawal queue + free liquidity + KyberSwap slippage)
 *   6. Multi-Chain Distribution (Phase 3 — hidden when only Ethereum populated)
 *   7. Governance Topology
 *   8. Stress Anchor (text panel)
 */

// Static metadata shared by the Collateral Mix panel and the loan-table column renderer.
var SYRUP_COLLATERAL_META = {
    BTC:   { category: 'crypto',     issuer: '—',           color: '#f59e0b' },
    cbBTC: { category: 'crypto',     issuer: 'Coinbase',    color: '#f59e0b' },
    ETH:   { category: 'crypto',     issuer: '—',           color: '#6366f1' },
    XRP:   { category: 'crypto',     issuer: '—',           color: '#0ea5e9' },
    HYPE:  { category: 'crypto',     issuer: '—',           color: '#06b6d4' },
    USDC:  { category: 'stablecoin', issuer: 'Circle',      color: '#3b82f6' },
    USDT:  { category: 'stablecoin', issuer: 'Tether',      color: '#10b981' },
    PYUSD: { category: 'stablecoin', issuer: 'Paxos',       color: '#a855f7' },
    USTB:  { category: 'rwa',        issuer: 'Superstate',  color: '#ec4899' }
};

var SyrupUSDCRenderer = {

    // Analyzer emits deployment_ratio_pct, not free_liquidity_pct — derive it.
    _freeLiquidityPct: function(s) {
        if (s.free_liquidity_pct !== null && s.free_liquidity_pct !== undefined) return s.free_liquidity_pct;
        if (s.deployment_ratio_pct !== null && s.deployment_ratio_pct !== undefined) return 100 - s.deployment_ratio_pct;
        return null;
    },

    _ethLink: function(addr) {
        if (!addr) return '';
        return '<a href="https://etherscan.io/address/' + addr + '" target="_blank" class="text-blue-500 hover:underline text-xs" title="' + addr + '">↗</a>';
    },

    _truncAddr: function(addr) {
        if (!addr) return '-';
        return addr.slice(0, 6) + '...' + addr.slice(-4);
    },

    _statusEmoji: function(status) {
        var s = (status || '').toLowerCase();
        if (s === 'healthy' || s === 'active') return '🟢';
        if (s === 'impaired') return '🟡';
        if (s === 'called') return '🟠';
        if (s === 'default' || s === 'defaulted') return '🔴';
        return '';
    },

    _statusFlagClass: function(status) {
        var s = (status || '').toLowerCase();
        if (s === 'healthy' || s === 'active') return 'text-green-600';
        if (s === 'impaired') return 'text-amber-600';
        if (s === 'called') return 'text-orange-600';
        if (s === 'default' || s === 'defaulted') return 'text-red-600';
        return '';
    },

    render: function(data) {
        var container = document.getElementById('asset-specific-panels');
        var specific = data.asset_specific;
        if (!specific || specific.type !== 'syrupusdc') return;

        var html = '';
        var s = data.summary;

        html += this._renderVaultState(specific, s);
        html += this._renderYield(specific);
        html += this._renderLoanBookComposition(data);
        html += this._renderLoanBookHealth(specific);
        html += this._renderBorrowerConcentration(specific);
        html += this._renderPaymentLadder(specific);
        html += this._renderCollateralMix(specific);
        html += this._renderExitRealism(specific, s);
        html += this._renderMultiChain(specific);
        html += this._renderGovernance(specific);
        html += this._renderStressAnchor(specific, s);

        container.innerHTML = html;

        // Wire up sortable columns on the loans table (if rendered)
        this._attachLoanTableSort();
        // Render the payment-ladder bar chart now that the canvas is in the DOM
        this._renderPaymentLadderChart(specific);
    },

    // ---------- 1. Vault State ----------
    _renderVaultState: function(specific, s) {
        var v = specific.vault_state;
        if (!v) return '';
        var deployment = s.deployment_ratio_pct;
        var deploymentCls = deployment >= 98 ? 'negative' : deployment >= 95 ? 'warning' : '';

        var pausedBadge = v.protocol_paused ?
            '<div class="risk-flag risk-critical mt-3"><strong>PROTOCOL PAUSED</strong> — deposits/withdrawals blocked at MapleGlobals</div>' : '';

        return '<div class="panel">' +
            '<div class="panel-title">Vault State</div>' +
            '<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">' +
                '<div class="summary-card"><div class="card-label">NAV (USDC/share)</div><div class="card-value">$' + (v.nav !== null && v.nav !== undefined ? v.nav.toFixed(4) : '-') + '</div></div>' +
                '<div class="summary-card"><div class="card-label">Total Assets</div><div class="card-value">' + CommonRenderer.formatCurrency(v.total_assets) + '</div></div>' +
                '<div class="summary-card"><div class="card-label">Total Supply</div><div class="card-value">' + CommonRenderer.formatCurrency(v.total_supply) + '</div><div class="text-xs text-slate-400 mt-1">syrupUSDC shares</div></div>' +
                '<div class="summary-card"><div class="card-label">Liquidity Cap</div><div class="card-value">' + CommonRenderer.formatCurrency(v.liquidity_cap) + '</div>' +
                    (v.liquidity_cap && v.total_assets ? '<div class="text-xs text-slate-400 mt-1">' + (v.total_assets / v.liquidity_cap * 100).toFixed(1) + '% filled</div>' : '') +
                '</div>' +
                '<div class="summary-card"><div class="card-label">Deployment</div><div class="card-value ' + deploymentCls + '">' + CommonRenderer.formatPercent(deployment, 1) + '</div><div class="text-xs text-slate-400 mt-1">principal out / assets</div></div>' +
            '</div>' +
            (v.unrealized_losses && v.unrealized_losses > 0 ?
                '<div class="risk-flag risk-critical mt-3"><strong>Unrealized losses:</strong> ' + CommonRenderer.formatCurrencyExact(v.unrealized_losses) + ' — PCR_principal below 100%</div>' : '') +
            pausedBadge +
            '</div>';
    },

    // ---------- 2. Yield Decomposition ----------
    _renderYield: function(specific) {
        var y = specific.yield;
        if (!y) return '';
        var headline = y.headline_apy_pct;
        var base = y.base_apy_pct;
        var season = y.season_incentive_apy_pct;
        var fee = y.delegate_fee_pct;

        // Bar widths normalised to headline; fall back to a sane denominator if missing.
        var maxApy = Math.max(headline || 0, (base || 0) + (season || 0)) || 20;
        function bar(val, color, label, tag) {
            if (val === null || val === undefined) return '';
            var pct = Math.max(0, Math.min(100, val / maxApy * 100));
            return '<div class="mb-2">' +
                '<div class="flex justify-between text-sm mb-1">' +
                    '<span class="text-slate-600">' + label + (tag ? ' <span class="text-xs text-slate-400">(' + tag + ')</span>' : '') + '</span>' +
                    '<span class="font-mono font-semibold">' + CommonRenderer.formatPercent(val, 2) + '</span>' +
                '</div>' +
                '<div class="pct-bar-container"><div class="pct-bar" style="width:' + pct + '%; background:' + color + '"></div></div>' +
            '</div>';
        }

        return '<div class="panel">' +
            '<div class="panel-title">Yield Decomposition</div>' +
            '<p class="text-sm text-slate-500 mb-3">Base APY is durable loan interest. Season-incentive APY is paid in SYRUP token and stops when the campaign ends — it is what you give back when seasons end.</p>' +
            bar(base, '#22c55e', 'Base APY', 'loan interest, durable') +
            bar(season, '#a855f7', 'Season-incentive APY', y.season_label || 'SYRUP token') +
            bar(headline, '#3b82f6', 'Headline APY', 'base + seasons') +
            (fee !== null && fee !== undefined ?
                '<div class="text-sm text-slate-500 mt-3">Pool Delegate management fee: <span class="font-mono font-semibold">' + CommonRenderer.formatPercent(fee, 2) + '</span> taken from gross before share-holders.</div>' : '') +
            (y.apr_24h_pct !== null && y.apr_24h_pct !== undefined ?
                '<div class="text-xs text-slate-400 mt-1">24h realised APR (NAV): ' + CommonRenderer.formatPercent(y.apr_24h_pct, 2) + ' — trailing window, can be noisy</div>' : '') +
            '</div>';
    },

    // ---------- 3. Loan Book Composition ----------
    // CommonRenderer.renderBreakdownTable already handles data.backing_breakdown
    // — we let it run as default. If the asset wants a strategy-only secondary
    // table (with principal_out + accounted_interest), we render that here.
    _renderLoanBookComposition: function(data) {
        var bb = data.backing_breakdown || [];
        var withDetail = bb.filter(function(r) { return r.detail && (r.detail.principal_out !== undefined || r.detail.accounted_interest !== undefined); });
        if (withDetail.length === 0) return '';
        var rows = withDetail.map(function(r) {
            return '<tr>' +
                '<td class="font-medium">' + r.label + '</td>' +
                '<td class="text-right font-mono">' + CommonRenderer.formatCurrencyExact(r.detail.principal_out || 0) + '</td>' +
                '<td class="text-right font-mono">' + CommonRenderer.formatCurrencyExact(r.detail.accounted_interest || 0) + '</td>' +
                '<td class="text-right font-mono">' + CommonRenderer.formatCurrencyExact(r.value) + '</td>' +
                '<td class="text-right font-mono">' + CommonRenderer.formatPercent(r.pct, 1) + '</td>' +
                '</tr>';
        });
        return '<div class="panel">' +
            '<div class="panel-title">Loan Book Composition (Strategy Detail)</div>' +
            '<table class="data-table"><thead><tr>' +
                '<th>Strategy</th><th class="text-right">Principal Out</th><th class="text-right">Accounted Interest</th><th class="text-right">AUM</th><th class="text-right">% of Pool</th>' +
            '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
    },

    // ---------- 4. Loan Book Health (Phase 2) ----------
    _renderLoanBookHealth: function(specific) {
        var lb = specific.loan_book;
        if (!lb) return '';

        var disclaimer = '<div class="risk-flag risk-warning"><strong>Important:</strong> These are uncollateralized-on-chain open-term loans. Collateral is held off-chain by the Pool Delegate. On-chain enforcement = noticePeriod (24h) + gracePeriod (48h) → 72h max default lag.</div>';

        // Phase 1: enumeration not yet done — show placeholder
        if (lb.active_loan_count === null || lb.active_loan_count === undefined) {
            return '<div class="panel">' +
                '<div class="panel-title">Loan Book Health</div>' +
                disclaimer +
                '<div class="text-slate-400 text-sm mt-3 italic">Loan-level data pending — per-loan enumeration ships in Phase 2.</div>' +
                '</div>';
        }

        // Phase 2: aggregates + top-N table
        var rateText = lb.weighted_avg_rate_pct !== null && lb.weighted_avg_rate_pct !== undefined ?
            CommonRenderer.formatPercent(lb.weighted_avg_rate_pct, 2) : '-';
        var concText = lb.top_borrower_concentration_pct !== null && lb.top_borrower_concentration_pct !== undefined ?
            CommonRenderer.formatPercent(lb.top_borrower_concentration_pct, 1) : '-';
        var concCls = (lb.top_borrower_concentration_pct || 0) >= 25 ? 'warning' : '';

        // Analyzer doesn't emit healthy_count — derive from active - (impaired + called + default).
        var imp = lb.impaired_count || 0;
        var cal = lb.called_count || 0;
        var def = lb.default_count || 0;
        var healthy = (lb.healthy_count !== null && lb.healthy_count !== undefined) ?
            lb.healthy_count : Math.max(0, (lb.active_loan_count || 0) - imp - cal - def);
        var counts = { healthy: healthy, impaired: imp, called: cal, default: def };
        var sc = ['healthy', 'impaired', 'called', 'default'].map(function(k) {
            var n = counts[k];
            var cls = k === 'healthy' ? 'positive' : k === 'impaired' ? 'warning' : 'negative';
            var label = k.charAt(0).toUpperCase() + k.slice(1);
            return '<div class="summary-card"><div class="card-label">' + label + '</div><div class="card-value ' + (n > 0 ? cls : '') + '">' + n + '</div></div>';
        }).join('');

        var html = '<div class="panel">' +
            '<div class="panel-title">Loan Book Health</div>' +
            disclaimer +
            '<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mt-4 mb-4">' +
                '<div class="summary-card"><div class="card-label">Active Loans</div><div class="card-value">' + (lb.active_loan_count || 0) + '</div></div>' +
                '<div class="summary-card"><div class="card-label">Borrowers</div><div class="card-value">' + (lb.borrower_count || '-') + '</div></div>' +
                '<div class="summary-card"><div class="card-label">Weighted Rate</div><div class="card-value">' + rateText + '</div></div>' +
                '<div class="summary-card"><div class="card-label">Top Borrower</div><div class="card-value ' + concCls + '">' + concText + '</div><div class="text-xs text-slate-400 mt-1">% of book</div></div>' +
            '</div>' +
            '<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">' + sc + '</div>';

        // Loans table
        var loans = lb.loans || [];
        if (loans.length > 0) {
            var summary = lb.collateral_summary;
            var hasCollateral = !!(summary && summary.data_source && summary.data_source !== 'unavailable')
                || loans.some(function(l) { return l && l.collateral; });
            var loansSorted = loans.slice().sort(function(a, b) { return (b.principal || 0) - (a.principal || 0); }).slice(0, 10);
            var rows = loansSorted.map(function(l) { return SyrupUSDCRenderer._renderLoanRow(l, hasCollateral); }).join('');

            var collateralHeaders = hasCollateral ?
                ('<th class="cursor-pointer" data-sort="collat">Collat</th>' +
                 '<th class="text-right cursor-pointer" data-sort="collat_amount">Amount</th>' +
                 '<th class="text-right cursor-pointer" data-sort="collat_usd">Collat USD</th>' +
                 '<th class="text-right cursor-pointer" data-sort="level">Level</th>' +
                 '<th class="text-right cursor-pointer" data-sort="init">Init</th>') : '';

            html += '<div class="overflow-x-auto"><table class="data-table" id="syrup-loans-table"><thead><tr>' +
                '<th class="cursor-pointer" data-sort="borrower">Borrower</th>' +
                '<th class="text-right cursor-pointer" data-sort="principal">Principal ▾</th>' +
                collateralHeaders +
                '<th class="text-right cursor-pointer" data-sort="rate">Rate</th>' +
                '<th class="cursor-pointer" data-sort="funded">Funded</th>' +
                '<th class="cursor-pointer" data-sort="due">Next Pmt</th>' +
                '<th class="text-right cursor-pointer" data-sort="days">Days</th>' +
                '<th class="cursor-pointer" data-sort="status">Status</th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table></div>';
        }

        html += '</div>';
        return html;
    },

    _renderLoanRow: function(loan, hasCollateral) {
        var addr = loan.borrower || '';
        var firmTag = loan.firm ? '<span class="text-xs text-slate-500 ml-1">' + loan.firm + '</span>' : '';
        var borrowerCell = '<span class="font-mono text-xs" title="' + addr + '">' + SyrupUSDCRenderer._truncAddr(addr) + '</span>' +
            ' ' + SyrupUSDCRenderer._ethLink(addr) + firmTag;

        // Days to due
        var days = null;
        var dueTs = null;
        var dueText = '-';
        if (loan.payment_due_date) {
            var due = typeof loan.payment_due_date === 'number' ?
                new Date(loan.payment_due_date * 1000) :
                new Date(loan.payment_due_date.endsWith && loan.payment_due_date.endsWith('Z') ? loan.payment_due_date : loan.payment_due_date + 'Z');
            if (!isNaN(due.getTime())) {
                days = Math.floor((due.getTime() - Date.now()) / 86400000);
                dueTs = due.getTime();
                dueText = due.toISOString().slice(0, 10);
            }
        }
        var fundedTs = null;
        var fundedText = '-';
        if (loan.date_funded) {
            var fd = typeof loan.date_funded === 'number' ?
                new Date(loan.date_funded * 1000) :
                new Date(loan.date_funded.endsWith && loan.date_funded.endsWith('Z') ? loan.date_funded : loan.date_funded + 'Z');
            if (!isNaN(fd.getTime())) {
                fundedTs = fd.getTime();
                fundedText = fd.toISOString().slice(0, 10);
            }
        }
        var daysText = days === null ? '-' : (days + 'd');
        var daysCls = days === null ? '' : (days < 0 ? 'text-red-600 font-semibold' : days < 30 ? 'text-amber-600' : '');

        var status = loan.status || '';
        var statusCell = SyrupUSDCRenderer._statusEmoji(status) + ' <span class="' + SyrupUSDCRenderer._statusFlagClass(status) + '">' + status + '</span>';

        // Collateral cells (only emitted when the table includes the collateral columns)
        var collateralCells = '';
        var sortAttrs = {
            principal: loan.principal || 0,
            rate: loan.rate_pct || 0,
            days: days === null ? '' : days,
            funded: fundedTs === null ? '' : fundedTs,
            due: dueTs === null ? '' : dueTs,
            status: status,
            borrower: addr
        };
        if (hasCollateral) {
            var c = loan.collateral || {};
            var asset = c.asset || null;
            var assetCell = asset ?
                ('<span class="font-mono text-xs">' + asset + '</span>' +
                 (SYRUP_COLLATERAL_META[asset] && SYRUP_COLLATERAL_META[asset].issuer && SYRUP_COLLATERAL_META[asset].issuer !== '—' ?
                    ' <span class="text-xs text-slate-400">(' + SYRUP_COLLATERAL_META[asset].issuer + ')</span>' : '')) :
                '<span class="text-slate-400">—</span>';
            var amount = c.amount;
            var amountText = (amount === null || amount === undefined) ? '<span class="text-slate-400">—</span>' :
                (Math.abs(amount) >= 1e6 ? (amount / 1e6).toFixed(2) + 'M' :
                 Math.abs(amount) >= 1e3 ? (amount / 1e3).toFixed(2) + 'K' :
                 amount.toFixed(amount < 1 ? 4 : 2)) + (asset ? ' ' + asset : '');
            var collatUsd = c.usd;
            var collatUsdText = (collatUsd === null || collatUsd === undefined) ? '<span class="text-slate-400">—</span>' :
                CommonRenderer.formatCurrency(collatUsd);
            var level = c.current_level_pct;
            // Color: red <100, amber 100-110, slate-700 110-150, green >=150
            var levelCls = '';
            if (level !== null && level !== undefined) {
                if (level < 100) levelCls = 'text-red-600 font-semibold';
                else if (level < 110) levelCls = 'text-amber-600 font-semibold';
                else if (level >= 150) levelCls = 'text-green-600';
            }
            var levelText = (level === null || level === undefined) ? '<span class="text-slate-400">—</span>' :
                CommonRenderer.formatPercent(level, 1);
            var initLevel = c.init_level_pct;
            var initText = (initLevel === null || initLevel === undefined) ? '<span class="text-slate-400">—</span>' :
                CommonRenderer.formatPercent(initLevel, 1);

            collateralCells =
                '<td>' + assetCell + '</td>' +
                '<td class="text-right font-mono text-sm">' + amountText + '</td>' +
                '<td class="text-right font-mono">' + collatUsdText + '</td>' +
                '<td class="text-right font-mono ' + levelCls + '">' + levelText + '</td>' +
                '<td class="text-right font-mono text-slate-500">' + initText + '</td>';

            sortAttrs.collat = asset || '';
            sortAttrs.collat_amount = amount === null || amount === undefined ? '' : amount;
            sortAttrs.collat_usd = collatUsd === null || collatUsd === undefined ? '' : collatUsd;
            sortAttrs.level = level === null || level === undefined ? '' : level;
            sortAttrs.init = initLevel === null || initLevel === undefined ? '' : initLevel;
        }

        var dataAttrs = Object.keys(sortAttrs).map(function(k) {
            return 'data-' + k.replace(/_/g, '-') + '="' + String(sortAttrs[k]).replace(/"/g, '&quot;') + '"';
        }).join(' ');

        return '<tr ' + dataAttrs + '>' +
            '<td>' + borrowerCell + '</td>' +
            '<td class="text-right font-mono">' + CommonRenderer.formatCurrencyExact(loan.principal || 0) + '</td>' +
            collateralCells +
            '<td class="text-right font-mono">' + (loan.rate_pct !== null && loan.rate_pct !== undefined ? CommonRenderer.formatPercent(loan.rate_pct, 2) : '-') + '</td>' +
            '<td class="text-xs">' + fundedText + '</td>' +
            '<td class="text-xs">' + dueText + '</td>' +
            '<td class="text-right font-mono ' + daysCls + '">' + daysText + '</td>' +
            '<td>' + statusCell + '</td>' +
        '</tr>';
    },

    _attachLoanTableSort: function() {
        var table = document.getElementById('syrup-loans-table');
        if (!table) return;
        var headers = table.querySelectorAll('th[data-sort]');
        // String-typed keys sort lexicographically; everything else (incl. timestamps) numeric.
        var STRING_KEYS = { borrower: 1, status: 1, collat: 1 };
        headers.forEach(function(th) {
            th.addEventListener('click', function() {
                var key = th.getAttribute('data-sort');
                var attr = 'data-' + key.replace(/_/g, '-');
                var tbody = table.querySelector('tbody');
                var rows = Array.prototype.slice.call(tbody.querySelectorAll('tr'));
                var dir = th.getAttribute('data-dir') === 'asc' ? 'desc' : 'asc';
                headers.forEach(function(h) { h.removeAttribute('data-dir'); });
                th.setAttribute('data-dir', dir);
                rows.sort(function(a, b) {
                    var av = a.getAttribute(attr) || '';
                    var bv = b.getAttribute(attr) || '';
                    if (STRING_KEYS[key]) {
                        return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
                    }
                    // Empty values sink to the bottom regardless of direction (so '—' rows
                    // don't pollute the top when sorting by Level on partial data).
                    var aEmpty = av === '';
                    var bEmpty = bv === '';
                    if (aEmpty && bEmpty) return 0;
                    if (aEmpty) return 1;
                    if (bEmpty) return -1;
                    var an = parseFloat(av);
                    var bn = parseFloat(bv);
                    return dir === 'asc' ? an - bn : bn - an;
                });
                rows.forEach(function(r) { tbody.appendChild(r); });
            });
        });
    },

    // ---------- 4b. Borrower Concentration ----------
    _renderBorrowerConcentration: function(specific) {
        var lb = specific.loan_book;
        if (!lb || !lb.concentration) return '';
        var c = lb.concentration;

        if (!c.borrowers || c.borrowers.length === 0) {
            return '<div class="panel">' +
                '<div class="panel-title">Borrower Concentration</div>' +
                '<div class="text-slate-400 text-sm italic">No active loans — concentration not applicable.</div>' +
            '</div>';
        }

        var bucketCls = c.hhi_bucket === 'unconcentrated' ? 'bg-green-100 text-green-800' :
                        c.hhi_bucket === 'moderate' ? 'bg-amber-100 text-amber-800' :
                        'bg-red-100 text-red-800';
        var bucketLabel = (c.hhi_bucket || '').charAt(0).toUpperCase() + (c.hhi_bucket || '').slice(1);
        var bucketBadge = '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ' + bucketCls + '">' + bucketLabel + '</span>';

        // Top-N share bars
        function bar(label, pct) {
            var p = pct || 0;
            return '<div class="mb-2">' +
                '<div class="flex justify-between text-sm mb-1">' +
                    '<span class="text-slate-600">' + label + '</span>' +
                    '<span class="font-mono font-semibold">' + CommonRenderer.formatPercent(p, 1) + '</span>' +
                '</div>' +
                '<div class="pct-bar-container"><div class="pct-bar" style="width:' + Math.min(p, 100) + '%; background:#6366f1"></div></div>' +
            '</div>';
        }

        var bars = bar('Top 1', c.top_1_share_pct) +
                   bar('Top 3', c.top_3_share_pct) +
                   bar('Top 5', c.top_5_share_pct) +
                   bar('Top 10', c.top_10_share_pct);

        var rows = c.borrowers.map(function(b) {
            return '<tr>' +
                '<td><span class="font-mono text-xs" title="' + b.address + '">' + SyrupUSDCRenderer._truncAddr(b.address) + '</span> ' + SyrupUSDCRenderer._ethLink(b.address) + '</td>' +
                '<td class="text-xs text-slate-500">' + (b.firm || '—') + '</td>' +
                '<td class="text-right font-mono">' + CommonRenderer.formatCurrencyExact(b.principal_usd) + '</td>' +
                '<td class="text-right font-mono">' + (b.loan_count || 0) + '</td>' +
                '<td class="text-right font-mono">' + CommonRenderer.formatPercent(b.share_pct, 2) + '</td>' +
            '</tr>';
        }).join('');

        return '<div class="panel">' +
            '<div class="panel-title">Borrower Concentration</div>' +
            '<div class="flex items-center gap-3 mb-4">' +
                '<span class="text-sm text-slate-700"><span class="font-semibold">' + (c.total_borrowers || 0) + '</span> borrowers · HHI <span class="font-mono font-semibold">' + (c.hhi || 0) + '</span></span>' +
                bucketBadge +
                '<span class="text-xs text-slate-400">FTC merger-review thresholds: &lt;1500 unconcentrated · 1500-2500 moderate · &gt;2500 concentrated</span>' +
            '</div>' +
            '<div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">' +
                '<div>' + bars + '</div>' +
                '<div class="text-xs text-slate-500">' +
                    '<p class="mb-2"><strong>HHI</strong> (Herfindahl-Hirschman Index) is the sum of squared market shares — a single dominant borrower with 100% gives HHI = 10,000; perfectly even distribution gives HHI close to 0.</p>' +
                    '<p>Top-N shares show how much of the loan book is held by the largest 1, 3, 5, 10 borrowers — a fast read for diversification of credit risk.</p>' +
                '</div>' +
            '</div>' +
            '<div class="overflow-x-auto"><table class="data-table"><thead><tr>' +
                '<th>Borrower</th><th>Firm</th><th class="text-right">Principal</th><th class="text-right"># Loans</th><th class="text-right">Share</th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
        '</div>';
    },

    // ---------- 4c. Payment-Due Ladder ----------
    _renderPaymentLadder: function(specific) {
        var lb = specific.loan_book;
        if (!lb || !lb.payment_ladder) return '';
        var pl = lb.payment_ladder;

        if (!pl.buckets || pl.buckets.length === 0) {
            return '<div class="panel">' +
                '<div class="panel-title">Payment Ladder (next ' + (pl.horizon_days || 180) + ' days)</div>' +
                '<div class="text-slate-400 text-sm italic">No active loans — no scheduled inflows.</div>' +
            '</div>';
        }

        var t = pl.totals || {};
        var overdueCount = pl.overdue_loan_count || 0;
        var overduePrincipal = pl.overdue_principal_usd || 0;
        var overdueCls = overdueCount > 0 ? 'risk-flag risk-warning' : 'text-xs text-slate-500';

        function statBlock(label, val) {
            return '<div class="summary-card"><div class="card-label">' + label + '</div><div class="card-value">' + CommonRenderer.formatCurrency(val || 0) + '</div></div>';
        }

        return '<div class="panel">' +
            '<div class="panel-title">Payment Ladder (next ' + (pl.horizon_days || 180) + ' days)</div>' +
            '<p class="text-sm text-slate-500 mb-3">Expected interest-only inflows from active open-term loans, bucketed by next payment-due date. Principal repays only on a Pool-Delegate call (24h notice + 48h grace) and is not modelled here.</p>' +
            '<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">' +
                statBlock('30d', t.expected_inflow_30d_usd) +
                statBlock('60d', t.expected_inflow_60d_usd) +
                statBlock('90d', t.expected_inflow_90d_usd) +
                statBlock('180d', t.expected_inflow_180d_usd) +
            '</div>' +
            '<div style="height: 220px; position: relative;"><canvas id="syrup-ladder-chart"></canvas></div>' +
            (overdueCount > 0 ?
                '<div class="' + overdueCls + ' mt-3"><strong>Overdue:</strong> ' + overdueCount + ' loan' + (overdueCount > 1 ? 's' : '') + ' · ' + CommonRenderer.formatCurrencyExact(overduePrincipal) + ' principal past payment-due date</div>' :
                '<div class="text-xs text-slate-500 mt-3">Overdue: 0 loans · $0</div>') +
            '<div class="text-xs text-slate-400 mt-2">Method: <span class="font-mono">' + (pl.method || 'rate_estimate') + '</span></div>' +
        '</div>';
    },

    _renderPaymentLadderChart: function(specific) {
        var ctx = document.getElementById('syrup-ladder-chart');
        if (!ctx) return;
        var pl = specific.loan_book && specific.loan_book.payment_ladder;
        if (!pl || !pl.buckets || pl.buckets.length === 0) return;

        var labels = pl.buckets.map(function(b) {
            // Trim ISO date "2026-05-30" to "May 30"
            var d = new Date(b.period_end_iso + 'T00:00:00Z');
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
        });
        var values = pl.buckets.map(function(b) { return b.expected_inflow_usd || 0; });
        var loanCounts = pl.buckets.map(function(b) { return b.loan_count || 0; });
        var total = values.reduce(function(a, b) { return a + b; }, 0);
        // Amber bar if any single bucket holds >40% of horizon total — repayment-timing concentration.
        var maxBucket = Math.max.apply(null, values);
        var concentrated = total > 0 && (maxBucket / total) > 0.4;
        var color = concentrated ? '#f59e0b' : '#22c55e';

        if (window._syrupLadderChart) window._syrupLadderChart.destroy();
        window._syrupLadderChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Expected interest inflow',
                    data: values,
                    backgroundColor: color,
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(ctx) {
                                var n = loanCounts[ctx.dataIndex];
                                return CommonRenderer.formatCurrency(ctx.raw) + ' · ' + n + ' loan' + (n === 1 ? '' : 's');
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            font: { size: 11 },
                            callback: function(val, idx) {
                                return labels[idx] + ' (' + loanCounts[idx] + ')';
                            }
                        }
                    },
                    y: {
                        grid: { color: '#f1f5f9' },
                        ticks: {
                            font: { size: 11 },
                            callback: function(v) { return '$' + (v / 1e6).toFixed(1) + 'M'; }
                        },
                        beginAtZero: true
                    }
                }
            }
        });
    },

    // ---------- 4d. Collateral Mix ----------
    _renderCollateralMix: function(specific) {
        var lb = specific.loan_book;
        if (!lb || !lb.collateral_summary) return '';
        var cs = lb.collateral_summary;

        // Degraded state — Maple GraphQL unreachable.
        if (cs.data_source === 'unavailable') {
            return '<div class="panel">' +
                '<div class="panel-title">Collateral Mix</div>' +
                '<div class="risk-flag risk-info">Collateral data temporarily unavailable from Maple API. Loan-level credit and timing fields above are unaffected.</div>' +
            '</div>';
        }

        var setA = cs.set_a_overcollateralized || {};
        var setB = cs.set_b_at_par || {};
        var byAsset = cs.by_asset || [];

        // Header line: pool-level cross-check from Maple GraphQL.
        var poolLine = '';
        if (cs.pool_collateral_value_usd != null && cs.pool_collateral_ratio_pct != null) {
            poolLine = '<p class="text-sm text-slate-700 mb-3">Pool collateralization: <span class="font-mono font-semibold">' + CommonRenderer.formatPercent(cs.pool_collateral_ratio_pct, 1) + '</span> · <span class="font-mono">' + CommonRenderer.formatCurrency(cs.pool_collateral_value_usd) + '</span> collateral against active loan book. <span class="text-xs text-slate-400">(Maple GraphQL)</span></p>';
        }

        function bar(row, color) {
            var pct = row.pct_of_book || 0;
            var meta = SYRUP_COLLATERAL_META[row.asset] || {};
            var issuerTag = meta.issuer && meta.issuer !== '—' ?
                ' <span class="text-xs text-slate-500">' + meta.issuer + '</span>' : '';
            var levelRange;
            if (row.init_level_pct_min === row.init_level_pct_max) {
                levelRange = CommonRenderer.formatPercent(row.init_level_pct_min, 0);
            } else {
                levelRange = CommonRenderer.formatPercent(row.init_level_pct_min, 0) + '–' + CommonRenderer.formatPercent(row.init_level_pct_max, 0);
            }
            return '<div class="mb-2">' +
                '<div class="flex justify-between text-sm mb-1">' +
                    '<span class="text-slate-700"><span class="font-mono font-semibold">' + row.asset + '</span>' + issuerTag + ' <span class="text-xs text-slate-400">' + (row.loans || 0) + ' loan' + (row.loans === 1 ? '' : 's') + ' · init ' + levelRange + '</span></span>' +
                    '<span class="font-mono font-semibold">' + CommonRenderer.formatPercent(pct, 1) + ' · ' + CommonRenderer.formatCurrency(row.principal_usd) + '</span>' +
                '</div>' +
                '<div class="pct-bar-container"><div class="pct-bar" style="width:' + Math.min(pct, 100) + '%; background:' + color + '"></div></div>' +
            '</div>';
        }

        // Partition by_asset rows into Set A (overcoll, init > 105) and Set B (at-par, init ≤ 105)
        var setARows = byAsset.filter(function(r) { return (r.init_level_pct_max || 0) > 105; });
        var setBRows = byAsset.filter(function(r) { return (r.init_level_pct_max || 0) <= 105; });

        var setAHtml = '<div>' +
            '<div class="text-sm font-semibold text-slate-700 mb-2">' +
                'Set A — crypto-overcollateralized · ' + CommonRenderer.formatPercent(setA.pct_of_book || 0, 1) +
                ' <span class="text-xs text-slate-500 font-normal">' + CommonRenderer.formatCurrency(setA.principal_usd || 0) +
                (setA.weighted_avg_init_level_pct ? ' · weighted init ' + CommonRenderer.formatPercent(setA.weighted_avg_init_level_pct, 1) : '') +
                '</span>' +
            '</div>' +
            (setARows.length ? setARows.map(function(r) { return bar(r, '#22c55e'); }).join('') :
                '<div class="text-xs text-slate-400 italic">No over-collateralized loans in current book.</div>') +
        '</div>';

        var setBWarning = '';
        if (setB.principal_usd > 0) {
            var largestPct = setB.principal_usd ? (setB.largest_position_usd / setA.principal_usd + setB.principal_usd * 0) : 0;
            // largest_position_pct: % of total book (set_a + set_b). Compute defensively.
            var totalPrincipal = (setA.principal_usd || 0) + (setB.principal_usd || 0);
            var largestPctOfBook = totalPrincipal > 0 ? (setB.largest_position_usd / totalPrincipal * 100) : 0;
            setBWarning =
                '<div class="risk-flag risk-warning mt-3"><strong>Set B is collateralized at par.</strong> Stress binds on collateral-asset peg/issuer events, not crypto-cycle drawdowns.' +
                (setB.largest_position_usd ?
                    ' Largest single position: <span class="font-mono">' + CommonRenderer.formatCurrency(setB.largest_position_usd) + '</span> in <span class="font-mono">' + (setB.largest_position_asset || '?') + '</span> (' + CommonRenderer.formatPercent(largestPctOfBook, 1) + ' of book).' : '') +
                '</div>';
        }
        var issuerLine = setB.named_issuers && setB.named_issuers.length ?
            '<div class="text-xs text-slate-500 mt-2">Named issuers: ' + setB.named_issuers.join(' · ') + '</div>' : '';

        var setBHtml = '<div>' +
            '<div class="text-sm font-semibold text-slate-700 mb-2">' +
                'Set B — at-par stablecoin / RWA · ' + CommonRenderer.formatPercent(setB.pct_of_book || 0, 1) +
                ' <span class="text-xs text-slate-500 font-normal">' + CommonRenderer.formatCurrency(setB.principal_usd || 0) + '</span>' +
            '</div>' +
            (setBRows.length ? setBRows.map(function(r) { return bar(r, '#f59e0b'); }).join('') :
                '<div class="text-xs text-slate-400 italic">No at-par loans in current book.</div>') +
            issuerLine +
        '</div>';

        return '<div class="panel">' +
            '<div class="panel-title">Collateral Mix</div>' +
            poolLine +
            '<div class="grid grid-cols-1 md:grid-cols-2 gap-6">' +
                setAHtml +
                setBHtml +
            '</div>' +
            setBWarning +
            '<div class="text-xs text-slate-400 mt-3">Source: Maple GraphQL · USD values computed from on-chain Chainlink feeds. <code class="font-mono">init_level_pct ≤ 105%</code> classifies as Set B.</div>' +
        '</div>';
    },

    // ---------- 5. Exit Realism ----------
    _renderExitRealism: function(specific, s) {
        var wq = specific.withdrawal_queue;
        var liq = specific.liquidity;
        if (!wq && !liq) return '';

        var html = '<div class="panel"><div class="panel-title">Exit Realism</div>' +
            '<p class="text-sm text-slate-500 mb-3">Two exit paths: (a) instant queue exit redeems against free USDC at NAV; (b) DEX/aggregator sell takes a slippage hit but settles immediately.</p>';

        // Free liquidity + queue
        if (wq) {
            var freeUsd = s.collateral_ratio_alt && s.collateral_ratio_alt.is_currency ? s.collateral_ratio_alt.value : null;
            var freePct = SyrupUSDCRenderer._freeLiquidityPct(s);
            // Queue depth USDC/shares are null when the queue is empty — treat as 0 so cards render cleanly.
            var queueEmpty = wq.is_empty === true;
            var depthUsd = (wq.queue_depth_usdc_est === null || wq.queue_depth_usdc_est === undefined) ? (queueEmpty ? 0 : null) : wq.queue_depth_usdc_est;
            var depthShares = (wq.queue_depth_shares === null || wq.queue_depth_shares === undefined) ? (queueEmpty ? 0 : null) : wq.queue_depth_shares;
            var slots = wq.queue_depth_slots;
            var nextId = wq.next_request_id;
            var lastId = wq.last_request_id;

            var depthCls = depthUsd !== null && depthUsd > 10000000 ? 'warning' : '';
            var depthText = depthUsd === null ? '-' : CommonRenderer.formatCurrency(depthUsd);
            var depthSubText = depthShares === null ? 'USDC est.' :
                (depthShares > 0 ? CommonRenderer.formatCurrency(depthShares) + ' shares' : 'USDC est.');

            html += '<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">' +
                '<div class="summary-card"><div class="card-label">Free USDC</div><div class="card-value positive">' + CommonRenderer.formatCurrency(freeUsd) + '</div><div class="text-xs text-slate-400 mt-1">' + CommonRenderer.formatPercent(freePct, 1) + ' of supply</div></div>' +
                '<div class="summary-card"><div class="card-label">Queue Depth</div><div class="card-value ' + depthCls + '">' + depthText + '</div><div class="text-xs text-slate-400 mt-1">' + depthSubText + '</div></div>' +
                '<div class="summary-card"><div class="card-label">Queue Slots</div><div class="card-value">' + (slots !== null && slots !== undefined ? slots : '-') + '</div><div class="text-xs text-slate-400 mt-1">' + (queueEmpty ? 'empty' : 'pending') + '</div></div>' +
                '<div class="summary-card"><div class="card-label">Request IDs</div><div class="card-value text-base font-mono">' + (lastId !== null && lastId !== undefined ? lastId : '-') + ' / ' + (nextId !== null && nextId !== undefined ? nextId : '-') + '</div><div class="text-xs text-slate-400 mt-1">last filled / next to file</div></div>' +
            '</div>';
        }

        // Aggregator slippage table
        if (liq && liq.quotes) {
            var sizes = Object.keys(liq.quotes).sort(function(a, b) { return parseFloat(a) - parseFloat(b); });
            var rows = sizes.map(function(sz) {
                var q = liq.quotes[sz];
                var bps = q.slippage_bps;
                var cls = bps > 50 ? 'text-red-600 font-semibold' : bps > 20 ? 'text-amber-600' : '';
                return '<tr>' +
                    '<td class="font-mono">$' + Number(sz).toLocaleString() + '</td>' +
                    '<td class="text-right font-mono ' + cls + '">' + (bps !== null && bps !== undefined ? bps.toFixed(1) + ' bps' : '-') + '</td>' +
                    '<td class="text-right font-mono">' + (q.output_usd !== null && q.output_usd !== undefined ? '$' + q.output_usd.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '-') + '</td>' +
                '</tr>';
            }).join('');
            var sourceLabel = liq.source ? ' (' + liq.source + ')' : '';
            html += '<div class="text-sm font-semibold text-slate-700 mt-2 mb-1">Aggregator slippage → USDC' + sourceLabel + '</div>' +
                '<table class="data-table"><thead><tr><th>Notional</th><th class="text-right">Slippage</th><th class="text-right">Output</th></tr></thead><tbody>' + rows + '</tbody></table>' +
                (liq.pool_tvl ? '<div class="text-xs text-slate-400 mt-2">DEX pool TVL: ' + CommonRenderer.formatCurrency(liq.pool_tvl) + (liq.pool_count ? ' across ' + liq.pool_count + ' pools' : '') + '</div>' : '');
        }

        html += '</div>';
        return html;
    },

    // ---------- 6. Multi-Chain Distribution ----------
    _renderMultiChain: function(specific) {
        var mc = specific.multi_chain;
        if (!mc) return '';
        var chains = Object.keys(mc);
        var nonEthPopulated = chains.some(function(c) {
            return c !== 'ethereum' && mc[c] && mc[c].supply !== null && mc[c].supply !== undefined;
        });
        if (!nonEthPopulated) return '';  // Phase 1/2: hide until Phase 3 fills it

        var rows = chains.map(function(c) {
            var d = mc[c] || {};
            return '<tr>' +
                '<td class="font-medium">' + c.charAt(0).toUpperCase() + c.slice(1) + '</td>' +
                '<td class="text-right font-mono">' + (d.supply !== null && d.supply !== undefined ? CommonRenderer.formatCurrency(d.supply) : '-') + '</td>' +
                '<td class="text-right font-mono">' + (d.share_of_supply_pct !== null && d.share_of_supply_pct !== undefined ? CommonRenderer.formatPercent(d.share_of_supply_pct, 1) : '-') + '</td>' +
                '<td class="font-mono text-xs">' + (d.ccip_pool ? SyrupUSDCRenderer._truncAddr(d.ccip_pool) + ' ' + SyrupUSDCRenderer._ethLink(d.ccip_pool) : '-') + '</td>' +
            '</tr>';
        }).join('');

        return '<div class="panel">' +
            '<div class="panel-title">Multi-Chain Distribution</div>' +
            '<table class="data-table"><thead><tr><th>Chain</th><th class="text-right">Supply</th><th class="text-right">Share</th><th>CCIP Pool</th></tr></thead><tbody>' + rows + '</tbody></table>' +
        '</div>';
    },

    // ---------- 7. Governance Topology ----------
    // Analyzer emits a flat shape: governor/operational_admin/security_admin/pool_delegate
    // are address strings; pool_delegate_firm / pool_delegate_is_eoa /
    // pool_delegate_cover (= cover contract addr) / pool_delegate_cover_usdc /
    // min_cover_amount / timelock_hours / protocol_paused are sibling fields.
    _renderGovernance: function(specific) {
        var g = specific.governance;
        if (!g) return '';

        function addrOf(v) {
            if (!v) return null;
            if (typeof v === 'string') return v;
            if (typeof v === 'object' && v.address) return v.address;
            return null;
        }

        var rows = [];
        function row(label, addr, extra) {
            if (!addr) return '';
            var addrCell = '<span class="font-mono text-xs" title="' + addr + '">' + SyrupUSDCRenderer._truncAddr(addr) + '</span> ' + SyrupUSDCRenderer._ethLink(addr);
            return '<tr>' +
                '<td class="font-medium">' + label + '</td>' +
                '<td>' + addrCell + '</td>' +
                '<td class="text-xs text-slate-500">' + (extra || '-') + '</td>' +
            '</tr>';
        }

        // Governor
        var govAddr = addrOf(g.governor);
        if (govAddr) {
            var govExtra = 'timelock';
            var hrs = g.timelock_hours;
            if (hrs === undefined && typeof g.governor === 'object' && g.governor.min_delay_s) {
                hrs = g.governor.min_delay_s / 3600;
            }
            if (hrs !== undefined && hrs !== null) govExtra += ' · min delay ' + hrs + 'h';
            rows.push(row('Governor', govAddr, govExtra));
        }

        // Operational / Security Safes
        var opAddr = addrOf(g.operational_admin);
        if (opAddr) {
            var opExtra = 'safe';
            var opThresh = (typeof g.operational_admin === 'object') ? g.operational_admin.threshold : g.operational_admin_threshold;
            if (opThresh) opExtra += ' · ' + opThresh;
            rows.push(row('Operational Safe', opAddr, opExtra));
        }
        var secAddr = addrOf(g.security_admin);
        if (secAddr) {
            var secExtra = 'safe';
            var secThresh = (typeof g.security_admin === 'object') ? g.security_admin.threshold : g.security_admin_threshold;
            if (secThresh) secExtra += ' · ' + secThresh;
            rows.push(row('Security Safe', secAddr, secExtra));
        }

        // Pool Delegate
        var pdAddr = addrOf(g.pool_delegate);
        if (pdAddr) {
            var pdExtra = '';
            var firm = g.pool_delegate_firm || (typeof g.pool_delegate === 'object' ? g.pool_delegate.firm : null);
            var isEoa = g.pool_delegate_is_eoa;
            if (isEoa === undefined && typeof g.pool_delegate === 'object') isEoa = (g.pool_delegate.type === 'eoa');
            if (firm) pdExtra += firm;
            if (isEoa) pdExtra += (pdExtra ? ' · ' : '') + '<span class="text-amber-600 font-semibold">⚠ EOA</span>';
            rows.push(row('Pool Delegate', pdAddr, pdExtra || '-'));
        }

        // Pool Delegate Cover — analyzer emits cover contract addr + balance + min_required as siblings.
        var coverAddr = (typeof g.pool_delegate_cover === 'string') ? g.pool_delegate_cover :
                        (g.pool_delegate_cover && g.pool_delegate_cover.address) || null;
        var coverBal = g.pool_delegate_cover_usdc;
        if (coverBal === undefined && g.pool_delegate_cover && typeof g.pool_delegate_cover === 'object') {
            coverBal = g.pool_delegate_cover.balance;
        }
        var coverReq = g.min_cover_amount;
        if (coverReq === undefined && g.pool_delegate_cover && typeof g.pool_delegate_cover === 'object') {
            coverReq = g.pool_delegate_cover.min_required;
        }
        if (coverAddr || coverBal !== undefined || coverReq !== undefined) {
            var coverCls = (coverBal || 0) < (coverReq || 0) || (coverBal || 0) === 0 ? 'text-amber-600 font-semibold' : '';
            var coverCell = '<span class="font-mono ' + coverCls + '">' + CommonRenderer.formatCurrency(coverBal || 0) + '</span> / required ' + CommonRenderer.formatCurrency(coverReq || 0);
            if (coverAddr) coverCell += ' ' + SyrupUSDCRenderer._ethLink(coverAddr);
            rows.push('<tr>' +
                '<td class="font-medium">PD First-Loss Cover</td>' +
                '<td>' + coverCell + '</td>' +
                '<td class="text-xs text-slate-500">Pool Delegate skin-in-the-game</td>' +
            '</tr>');
        }

        // Protocol-paused row (analyzer emits this in governance, not vault_state)
        if (g.protocol_paused !== undefined) {
            var pausedCls = g.protocol_paused ? 'text-red-600 font-semibold' : 'text-green-600';
            rows.push('<tr>' +
                '<td class="font-medium">Protocol Paused</td>' +
                '<td><span class="' + pausedCls + '">' + (g.protocol_paused ? 'YES' : 'No') + '</span></td>' +
                '<td class="text-xs text-slate-500">MapleGlobals master switch</td>' +
            '</tr>');
        }

        var lastTx = '';
        if (g.last_admin_tx_timestamp) {
            lastTx = '<div class="text-xs text-slate-400 mt-2">Last admin tx: ' + CommonRenderer.formatDate(g.last_admin_tx_timestamp) + '</div>';
        }

        return '<div class="panel">' +
            '<div class="panel-title">Governance Topology</div>' +
            '<table class="data-table"><thead><tr><th>Role</th><th>Address</th><th>Notes</th></tr></thead><tbody>' + rows.join('') + '</tbody></table>' +
            lastTx +
        '</div>';
    },

    // ---------- 8. Stress Anchor ----------
    _renderStressAnchor: function(specific, s) {
        var freePct = SyrupUSDCRenderer._freeLiquidityPct(s);
        var freeUsd = s.collateral_ratio_alt && s.collateral_ratio_alt.is_currency ? s.collateral_ratio_alt.value : null;
        var lb = specific.loan_book || {};
        var paymentInterval = lb.weighted_avg_payment_interval_days;
        if (paymentInterval === null || paymentInterval === undefined) {
            paymentInterval = lb.weighted_avg_remaining_days_to_due;
        }

        var freePctText = freePct !== null && freePct !== undefined ? freePct.toFixed(1) + '%' : '?';
        var freeUsdText = freeUsd !== null && freeUsd !== undefined ?
            (freeUsd >= 1e6 ? '$' + (freeUsd / 1e6).toFixed(0) + 'M' : '$' + (freeUsd / 1e3).toFixed(0) + 'K') :
            '?';
        var intervalText = paymentInterval !== null && paymentInterval !== undefined ?
            paymentInterval.toFixed(0) + '-day' : 'multi-week';

        return '<div class="panel">' +
            '<div class="panel-title">Stress Anchor</div>' +
            '<p class="text-sm text-slate-700">' +
                'Free liquidity (<span class="font-semibold">' + freePctText + '</span>) covers redemptions up to <span class="font-semibold">' + freeUsdText + '</span> before queueing. ' +
                'Above that, exits depend on incoming loan repayments. Loans pay on a <span class="font-semibold">' + intervalText + '</span> cadence on average; the pool has 24h notice + 48h grace to call a delinquent loan.' +
            '</p>' +
        '</div>';
    }
};
