/**
 * syrupUSDC renderer — v2 layout (8 visible blocks).
 *
 * Render order:
 *   §1 Backing            — Pool TVL / cap / NAV / fee + asset composition + 2-slice donut
 *   §2 Loan Book Health   — 4 sub-blocks: A status · B buffer (NEW) · C collateral mix · D loan table
 *   §3 Borrower Concentration
 *   §4 Repayment Schedule (renamed from Payment Ladder)
 *   §5  Liquidity & Peg   — folds Exit Realism + Stress Anchor + new Peg deviation row
 *   §5b Multi-Chain Distribution — Phase-1 per-chain token supply (Ethereum + L2/Solana via CCIP+CCT)
 *   §6  Trust Stack       — Governance + 1-line audit roll-up
 *   §7  Yield (demoted)
 *
 * Suppresses the common-header Backing Breakdown table + Allocation pie panel for
 * syrupUSDC only — they're replaced by §1's asset-composition table + donut.
 * OUSD / crvUSD / USDD don't run this renderer, so they keep the common layout.
 */

// Static metadata for the Collateral Mix sub-block + loan-table column.
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

// Editorial descriptions for known strategy implementation contracts.
// Keyed by `strategy_impl_name` (the analyzer reads this from the strategy
// implementation's `name()` getter when available). Used by the Backing
// panel's dormant-sleeve sub-block; unknown impls degrade to "configured
// DeFi sleeve" with the truncated address.
// Editorial descriptions for known strategy implementation contracts.
// FixedTermLoanManager is a Maple-internal alternate loan-type slot
// (fixed-term + amortization), NOT an external-DeFi sleeve — keep its
// description distinct from Aave/Sky to avoid mislabeling its activation
// risk profile. Maple v1 (2021-22) was all fixed-term; Syrup standardized
// on OpenTermLoanManager to avoid the v1 refinancing-cliff dynamics.
var SYRUP_STRATEGY_IMPL_INFO = {
    'MapleAaveStrategy':    'Aave V3 stablecoin pool wrapper',
    'MapleSkyStrategy':     'Sky / sUSDS DSR wrapper',
    'FixedTermLoanManager': 'alternate loan-type slot — fixed-term loans within Maple; currently unused (Syrup standardized on open-term)'
};

// Active-vs-dormant threshold for non-LoanManager DeFi sleeves. Below this
// the sleeve renders as DORMANT in its own muted sub-block; at-or-above it
// rounds back into the main strategy table. PegTracker fires a risk flag
// at the same threshold so activation is also visible in §Risk Flags.
var SYRUP_SLEEVE_ACTIVE_THRESHOLD_USD = 100000;

// Static facts for §6 audit roll-up — sourced from the public risk report.
var SYRUP_AUDIT_INFO = {
    primary_audits: 'Spearbit + Trail of Bits',
    other_audits_count: 6,
    total_audits: '8+',
    bug_bounty: 'Immunefi $1M+'
};

var SyrupUSDCRenderer = {

    // ----- helpers --------------------------------------------------------
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

    // Underlying-asset symbol for the pool — drives "USDT per share",
    // "Free USDT", "USDT est." labels on the syrupUSDT page so they match
    // the actual deposit token rather than hardcoding "USDC".
    _underlying: function(slug) {
        return slug === 'syrupusdt' ? 'USDT' : 'USDC';
    },

    // Position-type classifier — works directly off the analyzer's
    // position_type field; falls back to a static asset-name heuristic for
    // older snapshots that haven't been re-emitted with the new schema yet.
    // Loans = crypto-overcollateralized third-party credit. Liquidity =
    // pool-owned positions in stablecoin/RWA/AMM venues (functionally NOT
    // third-party credit, even though they're routed through the
    // LoanManager as accounting wrappers).
    _isLoan: function(loan) {
        if (!loan) return false;
        if (loan.position_type) return loan.position_type === 'loan';
        var asset = loan.collateral && loan.collateral.asset;
        return SyrupUSDCRenderer._isLoanAsset(asset);
    },
    _isLiquidity: function(loan) {
        if (!loan) return false;
        if (loan.position_type) return loan.position_type === 'liquidity';
        var asset = loan.collateral && loan.collateral.asset;
        return asset && !SyrupUSDCRenderer._isLoanAsset(asset);
    },
    _isLoanAsset: function(asset) {
        // Crypto-overcollat collateral assets — anything else (PYUSD, USTB,
        // USDC, USDT, sUSDS, etc.) reads as liquidity-layer.
        return ['BTC', 'cbBTC', 'ETH', 'XRP', 'HYPE'].indexOf(asset) >= 0;
    },

    // Human-readable relative age: <60s "Just now", <60min "N minutes ago",
    // <24h "N hours ago", <7d "N days ago", >=7d absolute YYYY-MM-DD.
    // Used by the queue-based withdrawal UI for last-fill / head-age cells.
    _formatRelativeAge: function(seconds) {
        if (seconds == null) return '—';
        var s = Math.max(0, Math.floor(seconds));
        if (s < 60) return 'Just now';
        if (s < 3600) return Math.floor(s / 60) + ' minutes ago';
        if (s < 86400) {
            var h = Math.floor(s / 3600);
            return h + (h === 1 ? ' hour ago' : ' hours ago');
        }
        if (s < 86400 * 7) {
            var dys = Math.floor(s / 86400);
            return dys + (dys === 1 ? ' day ago' : ' days ago');
        }
        var dt = new Date(Date.now() - s * 1000);
        return dt.toISOString().slice(0, 10);
    },

    _statusFlagClass: function(status) {
        var s = (status || '').toLowerCase();
        if (s === 'healthy' || s === 'active') return 'text-green-600';
        if (s === 'impaired') return 'text-amber-600';
        if (s === 'called') return 'text-orange-600';
        if (s === 'default' || s === 'defaulted') return 'text-red-600';
        return '';
    },

    _suppressCommonPanels: function() {
        // §1 Backing absorbs the breakdown-table + allocation pie. Hide the
        // common-header panels and stretch the (now-orphan) Risk Flags wrapper
        // to span the full row width.
        var bd = document.getElementById('breakdown-table');
        if (bd) {
            var p = bd.closest('.panel');
            if (p) p.style.display = 'none';
        }
        var pie = document.getElementById('pie-chart');
        if (pie) {
            var p2 = pie.closest('.panel');
            if (p2) p2.style.display = 'none';
        }
        var risk = document.getElementById('risk-flags');
        if (risk) {
            var wrapper = risk.closest('.panel').parentElement;
            if (wrapper && !wrapper.classList.contains('lg:col-span-3')) {
                wrapper.classList.add('lg:col-span-3');
            }
        }
    },

    // ----- pre-render hook (fires before common summary cards render) ----
    // Swaps the static "Pool Coverage Ratio" card (always 100% by ERC-4626
    // design — a binary loss-recognition alarm, not a metric) for the
    // dynamic init-level Pool Collateral Ratio (Maple's headline coverage
    // metric, weighted-avg across active loans). PCR is demoted to an
    // inline status pill below the value, with a banner-prefix when
    // unrealized losses are recognized or PCR drops below 100.
    preRender: function(data) {
        var specific = data.asset_specific || {};
        if (specific.type !== 'syrupusdc') return;
        var lb = specific.loan_book || {};
        var cs = lb.collateral_summary || {};
        var poolCR = cs.pool_collateral_ratio_pct;
        if (poolCR == null) return;  // graceful — keep existing override

        var vs = specific.vault_state || {};
        var pcr = vs.pcr_principal_pct;
        var ul  = vs.unrealized_losses || 0;
        var alarm = (ul > 0) || (pcr != null && pcr < 100.0);

        // Color bands per spec: >=130 green, 110-130 amber, <110 red.
        var cls = poolCR >= 130 ? 'positive' :
                  poolCR >= 110 ? 'warning'  :
                                  'negative';

        var pillCls, pillDot, pillText;
        if (alarm) {
            pillCls  = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 mt-2';
            pillDot  = '<span class="w-1.5 h-1.5 rounded-full bg-red-500"></span>';
            var pcrTxt = (pcr != null) ? CommonRenderer.formatPercent(pcr, 2) : '—';
            var ulTxt  = ul > 0 ? ' · ' + CommonRenderer.formatCurrency(ul) + ' losses recognized' : '';
            pillText = 'PCR ' + pcrTxt + ulTxt;
        } else {
            pillCls  = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 mt-2';
            pillDot  = '<span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>';
            pillText = 'PCR ' + (pcr != null ? CommonRenderer.formatPercent(pcr, 2) : '100.00%') + ' · no losses recognized';
        }
        var pillHtml = '<div><span class="' + pillCls + '">' + pillDot + ' ' + pillText + '</span></div>';

        var bannerHtml = alarm ?
            '<div class="risk-flag risk-critical mt-1 mb-1 text-xs"><strong>Loss recognized:</strong> PCR ' +
                (pcr != null ? CommonRenderer.formatPercent(pcr, 2) : '—') +
                (ul > 0 ? ' · ' + CommonRenderer.formatCurrency(ul) + ' unrealized losses' : '') +
            '</div>' : '';

        // Replace the existing "Pool Coverage Ratio" override with the
        // init-level Pool Collateral Ratio override.
        specific.card_overrides = specific.card_overrides || {};
        specific.card_overrides['Collateral Ratio'] = {
            label: 'Pool Collateral Ratio',
            value: CommonRenderer.formatPercent(poolCR, 2),
            subtext: 'Weighted-avg init-level coverage across active loans',
            cls: cls,
            prefix_html: bannerHtml,
            extra_html: pillHtml
        };
        // Surplus / Deficit is total_assets - (free + strategy_aum) — a
        // sanity check that should always be 0; the few-dollar non-zero
        // values are float-rounding noise, not a real signal. Hide it.
        specific.card_overrides['Surplus / Deficit'] = { hidden: true };

        // Re-label NAV's "USDC per share" subtext for the syrupUSDT page.
        // The card is baked into extra_summary_cards by the analyzer with
        // a hardcoded subtext; rewrite it here so the deposit-asset symbol
        // matches the pool.
        var underlying = SyrupUSDCRenderer._underlying(data.asset_slug);
        if (Array.isArray(specific.extra_summary_cards)) {
            specific.extra_summary_cards.forEach(function(c) {
                if (c && c.label === 'NAV') {
                    c.subtext = underlying + ' per share';
                }
            });
        }

        // Promote brand-wide live APY to a top-strip card with a 30d
        // sparkline. Sourced from yield.apy_history.entries (single Maple
        // syrupGlobals.apyTimeSeries — same series for both pools, hence
        // "Syrup brand APY" subtitle).
        var y = specific.yield || {};
        var apyEntries = (y.apy_history && Array.isArray(y.apy_history.entries)) ? y.apy_history.entries : [];
        var liveApy = (y.core_apy_pct != null) ? y.core_apy_pct :
                      (y.headline_apy_pct != null ? y.headline_apy_pct : y.base_apy_pct);
        if (liveApy != null && apyEntries.length >= 2) {
            var apyValues = apyEntries.map(function(e) { return e.total_apy_pct; }).filter(function(v) { return v != null; });
            var first = apyValues[0];
            var last = apyValues[apyValues.length - 1];
            var minV = Math.min.apply(null, apyValues);
            var maxV = Math.max.apply(null, apyValues);
            var rangePp = maxV - minV;
            var slopePp = last - first;
            // Color rule per spec: rising/falling slope dominates; small
            // range over the window reads as "stable" muted-green; otherwise
            // moderate-variation slate-neutral.
            var apyCls, sparkColor;
            if (slopePp > 0.5) { apyCls = 'positive'; sparkColor = '#22c55e'; }
            else if (slopePp < -0.5) { apyCls = 'warning'; sparkColor = '#f59e0b'; }
            else if (rangePp <= 0.3) { apyCls = ''; sparkColor = '#10b981'; }
            else { apyCls = ''; sparkColor = '#64748b'; }

            var W = 80, H = 24, range = (maxV - minV) || 1;
            var step = W / (apyValues.length - 1);
            var pts = apyValues.map(function(v, i) {
                var x = i * step;
                var yPx = H - ((v - minV) / range) * (H - 4) - 2;
                return x.toFixed(1) + ',' + yPx.toFixed(1);
            }).join(' ');
            var sparkSvg =
                '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" class="inline-block flex-shrink-0">' +
                    '<polyline points="' + pts + '" fill="none" stroke="' + sparkColor + '" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>' +
                '</svg>';
            var apyValueHtml =
                '<div class="flex items-center justify-between gap-2">' +
                    '<span>' + CommonRenderer.formatPercent(liveApy, 2) + '</span>' +
                    sparkSvg +
                '</div>';

            specific.extra_summary_cards = specific.extra_summary_cards || [];
            specific.extra_summary_cards.push({
                label: 'Live APY',
                value: apyValueHtml,
                subtext: 'Syrup brand APY · 30d trend',
                cls: apyCls
            });
        }

        // Risk-flag reword — analyzer still emits the legacy "At-par (Set B)
        // collateral: ..." flag; replace it with two flags that frame the
        // exposure in Loans/Liquidity terms (issuer/RWA/AMM axis vs
        // borrower-credit) plus the single-key EOA topology summary.
        if (Array.isArray(data.risk_flags)) {
            var lb = specific.loan_book || {};
            var vs = specific.vault_state || {};
            var ct = (specific.governance || {}).custody_topology || {};
            var liquidityUsd = lb.principal_liquidity_usd;
            var totalAssets = vs.total_assets;
            var pctOfPool = (liquidityUsd != null && totalAssets) ?
                (liquidityUsd / totalAssets * 100) : null;
            var custodyEntries = (ct.entries || []).filter(function(e) {
                return e.control_type === 'custody' && e.is_eoa;
            });
            var custodyEoaCount = custodyEntries.length;
            var custodyEoaUsd = custodyEntries.reduce(function(sum, e) {
                return sum + (e.capital_under_control_usd || 0);
            }, 0);
            var newFlags = [];
            if (pctOfPool != null) {
                newFlags.push({
                    severity: 'info',
                    message: 'Liquidity layer: ' + CommonRenderer.formatPercent(pctOfPool, 0) +
                        ' of pool — issuer/RWA/AMM risk axis (not borrower credit)'
                });
            }
            if (custodyEoaCount > 0) {
                newFlags.push({
                    severity: 'info',
                    message: 'Maple-controlled MPC custody: ' + CommonRenderer.formatCurrency(custodyEoaUsd) +
                        ' held across ' + custodyEoaCount + ' MPC wallet' + (custodyEoaCount === 1 ? '' : 's') +
                        ' (per Maple\'s 2026-05-04 attestation)'
                });
            }
            data.risk_flags = data.risk_flags.flatMap(function(f) {
                if (f && typeof f.message === 'string' && /At-par \(Set B\)/i.test(f.message)) {
                    return newFlags;
                }
                return [f];
            });
            // If the legacy at-par flag wasn't present but we have data,
            // still surface the new Liquidity/EOA flags.
            var hasLiquidityFlag = data.risk_flags.some(function(f) {
                return f && /Liquidity layer:/i.test(f.message || '');
            });
            if (!hasLiquidityFlag && newFlags.length) {
                data.risk_flags = data.risk_flags.concat(newFlags);
            }
        }
    },

    // ----- entry point ----------------------------------------------------
    render: function(data) {
        var container = document.getElementById('asset-specific-panels');
        var specific = data.asset_specific;
        if (!specific || specific.type !== 'syrupusdc') return;

        this._suppressCommonPanels();

        var s = data.summary;
        var html = '';

        // Reserved div for the cross-pool family panel — async-populated below
        // by _loadCrossPoolFamily once data/syrup_family.json resolves. Stays
        // empty (zero-height) when the file is missing so the page doesn't
        // visibly regress.
        html += '<div id="syrup-family-panel"></div>';

        html += this._renderBacking(specific, s, data.asset_slug);          // §1
        html += this._renderLoanBookHealth(specific);                       // §2  (loans-only)
        html += this._renderLiquidityLayer(specific, data.asset_slug);      // §2b (pool-owned positions)
        html += this._renderStrategySlots(specific, data.asset_slug);       // §2c (unused contract slots)
        html += this._renderBorrowerConcentration(specific);                // §3
        html += this._renderRepaymentSchedule(specific);                    // §4
        html += this._renderLiquidityAndPeg(specific, s, data.asset_slug);  // §5
        html += this._renderMultiChain(specific, data.asset_slug);          // §5b multi-chain distribution
        html += this._renderTrustStack(specific);                   // §6
        html += this._renderYield(specific);                        // §7

        container.innerHTML = html;

        // Post-render canvases (after innerHTML so the DOM nodes exist).
        this._renderBackingDonut(specific, data.asset_slug);
        this._renderRepaymentScheduleChart(specific);
        this._renderAumCoverageChart(specific, data.asset_slug);
        this._attachLoanTableSort();
        this._loadCrossPoolFamily(data);
    },

    // ----- Cross-Pool Family panel (shared by syrupUSDC + syrupUSDT) ------
    _loadCrossPoolFamily: function(data) {
        var target = document.getElementById('syrup-family-panel');
        if (!target) return;
        var nocache = Math.floor(Date.now() / 60000);
        var siblingSlug = data.asset_slug === 'syrupusdt' ? 'syrupusdc' : 'syrupusdt';
        // Fetch family JSON + sibling pool's backing JSON in parallel. The
        // sibling fetch supplies its init-level Pool CR for the side-by-side
        // comparison row; the family JSON itself doesn't carry that field.
        var famPromise     = fetch('data/syrup_family.json?nocache=' + nocache).then(function(r) { return r.ok ? r.json() : null; }).catch(function() { return null; });
        var siblingPromise = fetch('data/' + siblingSlug + '_backing.json?nocache=' + nocache).then(function(r) { return r.ok ? r.json() : null; }).catch(function() { return null; });
        Promise.all([famPromise, siblingPromise]).then(function(results) {
            var fam = results[0];
            var siblingData = results[1];
            if (!fam) {
                target.innerHTML = '';
                return;
            }
            if (fam.data_source === 'incomplete') {
                target.innerHTML =
                    '<div class="panel">' +
                        '<div class="panel-title">Maple Syrup Family — Cross-Pool Snapshot</div>' +
                        '<div class="risk-flag risk-info">Cross-pool family data is currently unavailable (one pool\'s analyzer is mid-cycle or stale). Per-pool dashboards continue to render correctly.</div>' +
                    '</div>';
                return;
            }
            target.innerHTML = SyrupUSDCRenderer._renderCrossPoolFamilyContent(fam, data, siblingData);
        }).catch(function() { target.innerHTML = ''; });
    },

    _renderCrossPoolFamilyContent: function(fam, data, siblingData) {
        var combined = fam.combined || {};
        var pools = fam.pools || [];
        var usdcPool = pools.find(function(p) { return p.slug === 'syrupusdc'; }) || {};
        var usdtPool = pools.find(function(p) { return p.slug === 'syrupusdt'; }) || {};
        var overlap = fam.borrower_overlap || [];
        var gov = fam.shared_governance || {};
        var currentSlug = data.asset_slug || 'syrupusdc';
        // Pool-level total assets — analyzer emits `total_assets_usd`; older
        // fixture-style emits `aum_usd`. Accept either.
        function poolAum(p) { return p.aum_usd != null ? p.aum_usd : p.total_assets_usd; }

        // ---- Family aggregates row (Loans / Liquidity split) ----
        // Aggregate Loan CR was dropped: CR is per-pool because risk is
        // per-pool — depositors in one pool aren't covered by collateral in
        // the other, so averaging across pools "covers" a risk that isn't
        // actually shared and masks divergence. Per-pool comparison lives in
        // the table below.
        var loansAum = combined.aum_loans_usd;
        var liqAum = combined.aum_liquidity_usd;
        var totalAum = combined.aum_total_usd != null ? combined.aum_total_usd : combined.total_aum_usd;
        var liqPct = (liqAum != null && totalAum) ? (liqAum / totalAum * 100) : null;
        var loansOnlyCount = combined.loans_only_count;
        var liquidityCount = combined.liquidity_count;

        var aggCards =
            '<div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">' +
                '<div class="summary-card">' +
                    '<div class="card-label">Family Loans</div>' +
                    '<div class="card-value">' + CommonRenderer.formatCurrency(loansAum) + '</div>' +
                    '<div class="text-xs text-slate-400 mt-1">' +
                        (loansOnlyCount != null ? loansOnlyCount + ' loans · ' : '') +
                        'third-party credit' +
                    '</div>' +
                '</div>' +
                '<div class="summary-card">' +
                    '<div class="card-label">Family Liquidity</div>' +
                    '<div class="card-value">' + CommonRenderer.formatCurrency(liqAum) + '</div>' +
                    '<div class="text-xs text-slate-400 mt-1">' +
                        (liquidityCount != null ? liquidityCount + ' positions · ' : '') +
                        (liqPct != null ? CommonRenderer.formatPercent(liqPct, 1) + ' of pool' : 'pool-owned') +
                    '</div>' +
                '</div>' +
                '<div class="summary-card">' +
                    '<div class="card-label">Family Total AUM</div>' +
                    '<div class="card-value">' + CommonRenderer.formatCurrency(totalAum) + '</div>' +
                    '<div class="text-xs text-slate-400 mt-1">USDC ' + CommonRenderer.formatCurrency(poolAum(usdcPool)) +
                        ' + USDT ' + CommonRenderer.formatCurrency(poolAum(usdtPool)) + '</div>' +
                '</div>' +
            '</div>';

        // ---- Per-pool collateral health comparison ----
        // Side-by-side replacement for the dropped family-aggregate Loan CR.
        // Loans-only CR uses family.json's per-pool fields:
        //   (pool_collateral_value_usd − principal_liquidity_usd) / principal_loans_only_usd × 100
        // Until syrupUSDT's loan-classification analyzer fix lands, its
        // principal_loans_only_usd is 0 in family.json — the loans-only CR
        // and counts cells render "pending classification fix" rather than
        // a misleading number. Init-level CR (weighted-avg baseline) and
        // loans-below-init (stress signal) come from each pool's
        // collateral_summary directly and resolve independently.
        function summaryFromBacking(d) {
            return d && d.asset_specific && d.asset_specific.loan_book &&
                d.asset_specific.loan_book.collateral_summary || null;
        }
        function loansOnlyCR(p) {
            var coll = p.pool_collateral_value_usd;
            var liq = p.principal_liquidity_usd;
            var loans = p.principal_loans_only_usd;
            if (coll == null || liq == null || !loans) return null;
            return (coll - liq) / loans * 100;
        }
        function crCls(v) {
            if (v == null) return 'text-slate-400';
            if (v >= 130) return 'text-green-600 font-semibold';
            if (v >= 110) return 'text-amber-600 font-semibold';
            return 'text-red-600 font-semibold';
        }
        var usdcSummary = currentSlug === 'syrupusdc' ? summaryFromBacking(data) : summaryFromBacking(siblingData);
        var usdtSummary = currentSlug === 'syrupusdt' ? summaryFromBacking(data) : summaryFromBacking(siblingData);
        var usdcLoansOnlyCR = loansOnlyCR(usdcPool);
        var usdtLoansOnlyCR = loansOnlyCR(usdtPool);
        var usdcInitCR = usdcSummary && usdcSummary.pool_collateral_ratio_pct;
        var usdtInitCR = usdtSummary && usdtSummary.pool_collateral_ratio_pct;
        var usdcBelowInit = usdcSummary && usdcSummary.loans_below_init_count;
        var usdtBelowInit = usdtSummary && usdtSummary.loans_below_init_count;

        function pendingCell() {
            return '<span class="text-slate-400 italic text-xs">pending classification fix</span>';
        }
        function pctCell(v) {
            if (v == null) return pendingCell();
            return '<span class="font-mono ' + crCls(v) + '">' + CommonRenderer.formatPercent(v, 2) + '</span>';
        }
        function countsCell(p) {
            var lo = p.loans_only_count, lq = p.liquidity_count;
            if ((lo == null || lo === 0) && (lq == null || lq === 0)) return pendingCell();
            return '<span class="font-mono">' + (lo || 0) + ' / ' + (lq || 0) + '</span>';
        }
        function belowInitCell(below, denom) {
            if (below == null) return '<span class="text-slate-400">—</span>';
            var cls = below > 0 ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold';
            var denomStr = denom ? ' / ' + denom : ' / <span class="text-slate-400 italic text-xs">denom pending</span>';
            return '<span class="font-mono ' + cls + '">' + below + '</span>' + denomStr;
        }

        var perPoolBlock =
            '<div class="text-sm font-semibold text-slate-700 mb-2 mt-1">Per-pool collateral health</div>' +
            '<div class="overflow-x-auto"><table class="data-table"><thead><tr>' +
                '<th>Metric</th>' +
                '<th class="text-right">syrupUSDC</th>' +
                '<th class="text-right">syrupUSDT</th>' +
            '</tr></thead><tbody>' +
                '<tr>' +
                    '<td class="font-medium">Loans-only CR <span class="text-xs font-normal text-slate-500">(current snapshot)</span></td>' +
                    '<td class="text-right">' + pctCell(usdcLoansOnlyCR) + '</td>' +
                    '<td class="text-right">' + pctCell(usdtLoansOnlyCR) + '</td>' +
                '</tr>' +
                '<tr>' +
                    '<td class="font-medium">Init-level pool CR <span class="text-xs font-normal text-slate-500">(weighted-avg baseline)</span></td>' +
                    '<td class="text-right">' + pctCell(usdcInitCR) + '</td>' +
                    '<td class="text-right">' + pctCell(usdtInitCR) + '</td>' +
                '</tr>' +
                '<tr>' +
                    '<td class="font-medium">Loans / Liquidity count</td>' +
                    '<td class="text-right">' + countsCell(usdcPool) + '</td>' +
                    '<td class="text-right">' + countsCell(usdtPool) + '</td>' +
                '</tr>' +
                '<tr>' +
                    '<td class="font-medium">Loans below init level <span class="text-xs font-normal text-slate-500">(stress signal)</span></td>' +
                    '<td class="text-right">' + belowInitCell(usdcBelowInit, usdcPool.loans_only_count) + '</td>' +
                    '<td class="text-right">' + belowInitCell(usdtBelowInit, usdtPool.loans_only_count) + '</td>' +
                '</tr>' +
            '</tbody></table></div>' +
            '<div class="text-xs text-slate-500 mt-2 mb-4">' +
                'CR is per-pool: depositors in one pool aren\'t covered by collateral in the other. ' +
                '"Below init level" = collateral has dropped below the level required at loan funding (loan still active but under-cushioned).' +
            '</div>';

        // ---- By collateral asset — split into Loans and Liquidity tables ----
        // Asset-level family rollup. Classifies each row by asset name
        // (BTC/XRP/HYPE/cbBTC/ETH = loans; PYUSD/USTB/USDC/USDT/sUSDS =
        // liquidity) and renders two tables with percentages re-normalized
        // within each class.
        var assetRollup = fam.by_collateral_asset_combined;
        var assetBlock = '';
        if (Array.isArray(assetRollup) && assetRollup.length) {
            function poolCell(loans, principal) {
                if (!loans) return '<span class="text-slate-400">—</span>';
                var label = loans === 1 ? '1 loan' : loans + ' loans';
                return '<span class="font-mono text-xs">' + label + ' / ' + CommonRenderer.formatCurrency(principal || 0) + '</span>';
            }
            var loanAssets = assetRollup.filter(function(r) { return SyrupUSDCRenderer._isLoanAsset(r.asset); })
                .sort(function(a, b) { return (b.combined_principal_usd || 0) - (a.combined_principal_usd || 0); });
            var liqAssets = assetRollup.filter(function(r) { return !SyrupUSDCRenderer._isLoanAsset(r.asset); })
                .sort(function(a, b) { return (b.combined_principal_usd || 0) - (a.combined_principal_usd || 0); });

            function renderAssetTable(rows, classTotal, headerLabel) {
                if (rows.length === 0) return '';
                var bodyHtml = rows.map(function(row) {
                    var raw = row.combined_principal_usd || 0;
                    var pct = classTotal > 0 ? (raw / classTotal * 100) : 0;
                    var pctCls = pct >= 30 ? 'text-red-600 font-semibold' :
                                 pct >= 15 ? 'text-amber-600 font-semibold' :
                                              'text-green-600';
                    return '<tr>' +
                        '<td class="font-mono font-semibold">' + row.asset + '</td>' +
                        '<td class="text-right">' + poolCell(row.syrupusdc_loans, row.syrupusdc_principal_usd) + '</td>' +
                        '<td class="text-right">' + poolCell(row.syrupusdt_loans, row.syrupusdt_principal_usd) + '</td>' +
                        '<td class="text-right font-mono font-semibold">' + CommonRenderer.formatCurrency(raw) + '</td>' +
                        '<td class="text-right font-mono ' + pctCls + '">' + CommonRenderer.formatPercent(pct, 1) + '</td>' +
                    '</tr>';
                }).join('');
                return '<div class="text-sm font-semibold text-slate-700 mb-2 mt-4">' + headerLabel + '</div>' +
                    '<div class="overflow-x-auto"><table class="data-table"><thead><tr>' +
                        '<th>Asset</th>' +
                        '<th class="text-right">USDC pool</th>' +
                        '<th class="text-right">USDT pool</th>' +
                        '<th class="text-right">Combined</th>' +
                        '<th class="text-right">% of class</th>' +
                    '</tr></thead><tbody>' + bodyHtml + '</tbody></table></div>';
            }

            var loansAumF = combined.aum_loans_usd ||
                loanAssets.reduce(function(s, r) { return s + (r.combined_principal_usd || 0); }, 0);
            var liqAumF = combined.aum_liquidity_usd ||
                liqAssets.reduce(function(s, r) { return s + (r.combined_principal_usd || 0); }, 0);

            var topLoanAsset = loanAssets[0];
            var topLoanShare = topLoanAsset && loansAumF > 0 ?
                ((topLoanAsset.combined_principal_usd || 0) / loansAumF * 100) : 0;
            var loanCallout = topLoanShare >= 50 ?
                '<div class="risk-flag risk-warning mt-2">' +
                    topLoanAsset.asset + ' is ' + CommonRenderer.formatPercent(topLoanShare, 0) +
                    ' of loans book — single-asset concentration risk axis.' +
                '</div>' : '';

            assetBlock =
                renderAssetTable(loanAssets, loansAumF, 'By asset (Loans)') +
                loanCallout +
                renderAssetTable(liqAssets, liqAumF, 'By asset (Liquidity)');
        }

        // ---- Cross-pool borrower concentration (Loans-only) ----
        // Switched from book-wide borrower_overlap to
        // cross_pool_concentration_loans_only — concentration percentages
        // are now versus the loans-only family book ($1.27B), not total
        // AUM ($1.61B). Drops the per-pool USDC/USDT split since the
        // loans-only concentration data isn't broken out by pool.
        var loansOnlyConc = fam.cross_pool_concentration_loans_only || {};
        var loansOnlyBorrowers = loansOnlyConc.borrowers || [];
        var top3LoansPct = 0;
        for (var i = 0; i < Math.min(3, loansOnlyBorrowers.length); i++) {
            top3LoansPct += loansOnlyBorrowers[i].share_pct || 0;
        }
        var rowsHtml = (loansOnlyBorrowers.length === 0) ?
            '<tr><td colspan="3" class="text-slate-400 text-sm italic">No loans-only cross-pool concentration data.</td></tr>' :
            loansOnlyBorrowers.map(function(b) {
                var pct = b.share_pct || 0;
                var pctCls = pct >= 15 ? 'text-red-600 font-semibold' :
                             pct >= 8  ? 'text-amber-600 font-semibold' :
                                          'text-green-600';
                var rowCls = pct >= 15 ? 'bg-red-50' : pct >= 8 ? 'bg-amber-50' : '';
                var addrCell = '<span class="font-mono text-xs" title="' + b.address + '">' +
                    SyrupUSDCRenderer._truncAddr(b.address) + '</span> ' +
                    SyrupUSDCRenderer._ethLink(b.address) +
                    (b.borrower_firm ? ' <span class="text-xs text-slate-500">' + b.borrower_firm + '</span>' : '');
                return '<tr class="' + rowCls + '">' +
                    '<td>' + addrCell + '</td>' +
                    '<td class="text-right font-mono font-semibold">' + CommonRenderer.formatCurrency(b.principal_usd || 0) + '</td>' +
                    '<td class="text-right font-mono ' + pctCls + '">' + CommonRenderer.formatPercent(pct, 2) + '</td>' +
                '</tr>';
            }).join('');

        var hhi = loansOnlyConc.hhi;
        var hhiBucket = loansOnlyConc.hhi_bucket;
        var hhiCls = hhiBucket === 'unconcentrated' ? 'text-green-700' :
                     hhiBucket === 'moderate' ? 'text-amber-700' : 'text-red-700';
        var calloutText = loansOnlyBorrowers.length > 0 ?
            ('Top 3 loan borrowers control ~<span class="font-semibold">' + CommonRenderer.formatPercent(top3LoansPct, 1) + '</span> of family loans-only book' +
             (hhi != null ? ' · HHI <span class="font-mono ' + hhiCls + '">' + hhi + '</span>' + (hhiBucket ? ' (' + hhiBucket + ')' : '') : '') + '.' +
             ' A credit event at any of these damages the family loan book.') :
            'No cross-pool loan-borrower data.';

        var tableBlock =
            '<div class="text-sm font-semibold text-slate-700 mb-2 mt-4">Top cross-pool borrower exposures <span class="text-xs font-normal text-slate-500">(Loans-only)</span></div>' +
            '<div class="overflow-x-auto"><table class="data-table"><thead><tr>' +
                '<th>Borrower</th>' +
                '<th class="text-right">Family principal</th>' +
                '<th class="text-right">% loans-only</th>' +
            '</tr></thead><tbody>' + rowsHtml + '</tbody></table></div>' +
            '<div class="risk-flag risk-warning mt-3">' + calloutText + '</div>';

        // ---- Shared governance row ----
        // Accept either { address, note } object form or a plain address string
        // (analyzer emits the latter).
        function normRole(role) {
            if (!role) return null;
            if (typeof role === 'string') return { address: role, note: null };
            if (typeof role === 'object' && role.address) return role;
            return null;
        }
        function addrCell(role) {
            var n = normRole(role);
            if (!n) return '<span class="text-slate-400">—</span>';
            return '<span class="font-mono text-xs" title="' + n.address + '">' +
                SyrupUSDCRenderer._truncAddr(n.address) + '</span> ' +
                SyrupUSDCRenderer._ethLink(n.address) +
                (n.note ? ' <span class="text-xs text-slate-500">' + n.note + '</span>' : '');
        }
        function rowAddr(label, role) {
            var n = normRole(role);
            if (!n) return '';
            return '<tr><td class="font-medium">' + label + '</td><td>' + addrCell(role) + '</td></tr>';
        }
        // Timelock hours: prefer governor.timelock_hours, fall back to
        // shared_governance.min_delay_seconds (analyzer's flat shape).
        var timelockHours = (gov.governor && gov.governor.timelock_hours) ||
            (gov.min_delay_seconds ? Math.round(gov.min_delay_seconds / 3600) : null) ||
            (gov.timelock_hours ? gov.timelock_hours : 24);
        var govRows = '';
        if (gov.governor) govRows += rowAddr('Governor (' + timelockHours + 'h timelock)', gov.governor);
        if (gov.operational_admin) govRows += rowAddr('Operational Admin', gov.operational_admin);
        if (gov.security_admin) govRows += rowAddr('Security Admin', gov.security_admin);
        var delegates = gov.delegates_per_pool || {};
        if (delegates.syrupusdc) govRows += rowAddr('Pool Delegate — syrupUSDC', delegates.syrupusdc);
        if (delegates.syrupusdt) govRows += rowAddr('Pool Delegate — syrupUSDT', delegates.syrupusdt);

        var govBlock = govRows ?
            '<div class="text-sm font-semibold text-slate-700 mb-2 mt-4">Shared governance</div>' +
            '<table class="data-table"><tbody>' + govRows + '</tbody></table>' : '';

        // ---- Sibling-pool link ----
        var siblingSlug = currentSlug === 'syrupusdt' ? 'syrupusdc' : 'syrupusdt';
        var currentLabel = currentSlug === 'syrupusdt' ? 'syrupUSDT' : 'syrupUSDC';
        var siblingLabel = siblingSlug === 'syrupusdt' ? 'syrupUSDT' : 'syrupUSDC';
        var siblingBlock =
            '<div class="text-sm text-slate-600 mt-4 pt-3 border-t border-slate-200">' +
                'Currently viewing: <strong>' + currentLabel + '</strong> · ' +
                'Sibling pool: <a href="?asset=' + siblingSlug + '" class="text-blue-600 hover:underline font-semibold">→ ' + siblingLabel + '</a>' +
            '</div>';

        return '<div class="panel">' +
            '<div class="panel-title">Maple Syrup Family — Cross-Pool Snapshot</div>' +
            aggCards +
            perPoolBlock +
            assetBlock +
            tableBlock +
            govBlock +
            siblingBlock +
        '</div>';
    },

    // ----- AUM-based coverage chart (replaces the common PCR chart) -------
    // PCR sits flat at 100% by ERC-4626 design (binary impairment alarm); the
    // live AUM-based coverage (collateralUsd / loansUsd × 100, Maple GraphQL)
    // is what actually moves day-to-day. Override the existing #cr-chart with
    // this series + a dashed deployment_pct overlay. Init-level commitment
    // stays visible as a caption since they're different metrics.
    _renderAumCoverageChart: function(specific, slug) {
        var underlying = SyrupUSDCRenderer._underlying(slug);
        var h = specific.aum_history;
        if (!h || !Array.isArray(h.entries) || h.entries.length < 2) return;
        var ctx = document.getElementById('cr-chart');
        if (!ctx || typeof Chart === 'undefined') return;
        var panel = document.getElementById('chart-panel');
        if (!panel) return;
        panel.style.display = '';  // unhide if common renderer suppressed it

        // Sort then slice to the trailing 7 days. PegTracker still emits 30d
        // in aum_history.entries[]; we narrow the viewport here to drop the
        // documented Apr 3-20 Maple aggregation-transient dips that visually
        // dominated the 30d chart but aren't real undercollateralization.
        var allEntries = h.entries.slice().sort(function(a, b) { return a.timestamp - b.timestamp; });
        var entries = allEntries.slice(-7);
        var labels = entries.map(function(e) { return new Date(e.timestamp * 1000); });
        var crSeries = entries.map(function(e) { return e.collateral_ratio_pct; });

        // Title + 7d stats
        var titleEl = panel.querySelector('.panel-title');
        if (titleEl) titleEl.textContent = 'Pool Coverage (live USD) — 7d';

        var statsEl = document.getElementById('cr-chart-stats');
        if (!statsEl) {
            statsEl = document.createElement('div');
            statsEl.id = 'cr-chart-stats';
            if (titleEl) titleEl.after(statsEl);
        }
        statsEl.className = 'flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mb-2';
        var crNonNull = crSeries.filter(function(v) { return v != null; });
        if (crNonNull.length > 0) {
            var minCR = Math.min.apply(null, crNonNull);
            var maxCR = Math.max.apply(null, crNonNull);
            var minCls = minCR < 110 ? 'text-red-600 font-semibold' : minCR < 130 ? 'text-amber-600 font-semibold' : '';
            statsEl.innerHTML =
                '<span>7d Min: <span class="font-mono ' + minCls + '">' + minCR.toFixed(2) + '%</span></span>' +
                '<span>7d Max: <span class="font-mono">' + maxCR.toFixed(2) + '%</span></span>' +
                '<span>7d Range: <span class="font-mono">' + (maxCR - minCR).toFixed(2) + 'pp</span></span>';
        } else {
            statsEl.innerHTML = '';
        }

        if (window._crChart) {
            try { window._crChart.destroy(); } catch (e) {}
        }

        window._crChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'AUM-based Coverage',
                    data: crSeries,
                    borderColor: '#22c55e',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 0,
                    borderWidth: 2
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
                        suggestedMin: 95,
                        suggestedMax: 170,
                        ticks: { callback: function(v) { return v + '%'; }, font: { size: 11 } }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(c) { return c.dataset.label + ': ' + (c.raw != null ? c.raw.toFixed(2) + '%' : '—'); }
                        }
                    },
                    annotation: {
                        annotations: {
                            underwater: { type: 'box', yMin: 0,   yMax: 100, backgroundColor: 'rgba(220, 38, 38, 0.10)', borderWidth: 0, label: { content: 'Underwater', display: true, position: 'start', font: { size: 9 }, color: '#dc2626' } },
                            thin:       { type: 'box', yMin: 100, yMax: 110, backgroundColor: 'rgba(239, 68, 68, 0.06)', borderWidth: 0 },
                            amber:      { type: 'box', yMin: 110, yMax: 130, backgroundColor: 'rgba(245, 158, 11, 0.06)', borderWidth: 0 },
                            healthy:    { type: 'box', yMin: 130, yMax: 160, backgroundColor: 'rgba(22, 163, 74, 0.05)', borderWidth: 0 },
                            cushion:    { type: 'box', yMin: 160, yMax: 220, backgroundColor: 'rgba(14, 165, 233, 0.05)', borderWidth: 0 },
                            line110:    { type: 'line', yMin: 110, yMax: 110, borderColor: '#dc2626', borderWidth: 1, borderDash: [4, 4], label: { content: '110%', display: true, position: 'end', font: { size: 9 }, color: '#dc2626' } },
                            line130:    { type: 'line', yMin: 130, yMax: 130, borderColor: '#16a34a', borderWidth: 1, borderDash: [4, 4], label: { content: '130%', display: true, position: 'end', font: { size: 9 }, color: '#16a34a' } }
                        }
                    }
                },
                interaction: { intersect: false, mode: 'index' }
            }
        });

        // Subtitle + init-level commitment caption below the chart.
        var caption = panel.querySelector('.cr-source-subtitle');
        if (!caption) {
            caption = document.createElement('div');
            caption.className = 'cr-source-subtitle text-xs text-slate-400 mt-2';
            panel.appendChild(caption);
        }
        var poolCR = ((specific.loan_book || {}).collateral_summary || {}).pool_collateral_ratio_pct;
        var asOfText = '';
        if (h.as_of) {
            var d = new Date(h.as_of * 1000);
            if (!isNaN(d.getTime())) asOfText = ' · as of ' + d.toISOString().slice(0, 10);
        }
        var sourceLine = 'Source: <span class="font-mono">poolV2.aumTimeSeries</span> (Maple GraphQL) · collateralUsd ÷ loansUsd' + asOfText + '.';
        var initLine = (poolCR != null) ?
            ('<br>Init-level commitment: <span class="font-mono font-semibold text-slate-600">' + poolCR.toFixed(1) + '%</span> ' +
             '(from <span class="font-mono">poolV2.collateralRatio</span>) — the chart above shows live AUM-based coverage, which can sit below init-level when collateral prices drift.') : '';
        // Data-quality footnote — Maple's aumTimeSeries aggregates the at-par
        // stablecoin/RWA positions inconsistently across days (same root cause
        // as the per-loan currentAssetAmount anomaly). Include a check on
        // unrealizedLosses so the credit-alarm framing only fires when it's 0.
        var ul = (specific.vault_state || {}).unrealized_losses;
        var ulFragment = (ul === 0 || ul == null) ?
            ' <span class="font-mono">unrealizedLosses</span> (the on-chain credit alarm) stayed at 0 throughout — the apparent dips were aggregation glitches, not real undercollateralization.' :
            '';
        var noteLine = '<div id="syrup-data-anomaly-note" class="mt-2 pt-2 border-t border-slate-100 text-xs text-slate-400 leading-relaxed scroll-mt-4">' +
            '<strong class="text-slate-500">Note:</strong> Window narrowed to 7d to focus on the post-anomaly clean window. Maple\'s <span class="font-mono">aumTimeSeries</span> has documented aggregation inconsistencies (most recently seen Apr 3–20, 2026 with day-over-day swings of $300–500M on a $1B+ book).' + ulFragment +
            ' Treat day-to-day swings &gt;10pp as data-quality variance unless cross-validated against <span class="font-mono">unrealizedLosses</span>. Loan-level cells flagged with <span class="text-amber-500 font-semibold">?</span> share this root cause — Maple GraphQL returns a broken <span class="font-mono">currentAssetAmount</span> for at-par stablecoin/RWA positions, leaving current-value and buffer cells unverifiable.' +
        '</div>';
        caption.innerHTML = sourceLine + initLine + noteLine;

        // Second stacked chart in the same panel — deployment ratio.
        this._renderDeploymentChart(panel, labels, entries, underlying);
    },

    // ----- Deployment ratio chart (stacked below AUM coverage) ------------
    _renderDeploymentChart: function(panel, labels, entries, underlying) {
        if (typeof Chart === 'undefined') return;
        var deplSeries = entries.map(function(e) { return e.deployment_pct; });

        // Build / find the deployment chart subsection — title, stats,
        // canvas, caption. Reuse on re-renders so we don't duplicate.
        var deplTitle = panel.querySelector('.syrup-depl-title');
        if (!deplTitle) {
            deplTitle = document.createElement('div');
            deplTitle.className = 'syrup-depl-title panel-title mt-6 pt-4 border-t border-slate-200';
            deplTitle.textContent = 'Pool Deployment Ratio — 30d';
            panel.appendChild(deplTitle);
        }

        var deplStats = panel.querySelector('#syrup-depl-stats');
        if (!deplStats) {
            deplStats = document.createElement('div');
            deplStats.id = 'syrup-depl-stats';
            deplStats.className = 'flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mb-2';
            panel.appendChild(deplStats);
        }
        var deplNonNull = deplSeries.filter(function(v) { return v != null; });
        if (deplNonNull.length > 0) {
            var minD = Math.min.apply(null, deplNonNull);
            var maxD = Math.max.apply(null, deplNonNull);
            var lastD = deplNonNull[deplNonNull.length - 1];
            var lastCls = lastD >= 95 ? 'text-red-600 font-semibold' :
                          lastD >= 80 ? 'text-amber-600 font-semibold' :
                          lastD < 50 ? 'text-green-600' : '';
            deplStats.innerHTML =
                '<span>30d Min: <span class="font-mono">' + minD.toFixed(2) + '%</span></span>' +
                '<span>30d Max: <span class="font-mono">' + maxD.toFixed(2) + '%</span></span>' +
                '<span>Latest: <span class="font-mono ' + lastCls + '">' + lastD.toFixed(2) + '%</span></span>' +
                '<span>Free buffer: <span class="font-mono">' + (100 - lastD).toFixed(2) + '%</span></span>';
        } else {
            deplStats.innerHTML = '';
        }

        var deplContainer = panel.querySelector('.syrup-depl-container');
        if (!deplContainer) {
            deplContainer = document.createElement('div');
            deplContainer.className = 'chart-container syrup-depl-container';
            var deplCanvas = document.createElement('canvas');
            deplCanvas.id = 'syrup-depl-chart';
            deplContainer.appendChild(deplCanvas);
            panel.appendChild(deplContainer);
        }

        var deplCaption = panel.querySelector('.syrup-depl-caption');
        if (!deplCaption) {
            deplCaption = document.createElement('div');
            deplCaption.className = 'syrup-depl-caption text-xs text-slate-400 mt-2';
            deplCaption.innerHTML = 'Share of pool deployed into loans + DeFi strategies. Higher = less free ' + underlying + ' buffer for redemptions. <span class="font-mono">&lt;2%</span> buffer triggers a risk flag on this page.';
            panel.appendChild(deplCaption);
        }

        var ctx = document.getElementById('syrup-depl-chart');
        if (!ctx) return;
        if (window._syrupDeplChart) {
            try { window._syrupDeplChart.destroy(); } catch (e) {}
        }

        window._syrupDeplChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Deployment',
                    data: deplSeries,
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 0,
                    borderWidth: 2
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
                        suggestedMin: 50,
                        suggestedMax: 100,
                        ticks: { callback: function(v) { return v + '%'; }, font: { size: 11 } }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(c) { return 'Deployment: ' + (c.raw != null ? c.raw.toFixed(2) + '%' : '—'); }
                        }
                    },
                    annotation: {
                        annotations: {
                            green:    { type: 'box', yMin: 0,  yMax: 50,  backgroundColor: 'rgba(22, 163, 74, 0.05)', borderWidth: 0 },
                            amber:    { type: 'box', yMin: 50, yMax: 80,  backgroundColor: 'rgba(245, 158, 11, 0.05)', borderWidth: 0 },
                            redAmber: { type: 'box', yMin: 80, yMax: 95,  backgroundColor: 'rgba(239, 68, 68, 0.07)', borderWidth: 0 },
                            red:      { type: 'box', yMin: 95, yMax: 100, backgroundColor: 'rgba(220, 38, 38, 0.12)', borderWidth: 0, label: { content: 'Fully deployed', display: true, position: 'start', font: { size: 9 }, color: '#dc2626' } },
                            line80:   { type: 'line', yMin: 80, yMax: 80, borderColor: '#d97706', borderWidth: 1, borderDash: [4, 4], label: { content: '80%', display: true, position: 'end', font: { size: 9 }, color: '#d97706' } },
                            line95:   { type: 'line', yMin: 95, yMax: 95, borderColor: '#dc2626', borderWidth: 1, borderDash: [4, 4], label: { content: '95%', display: true, position: 'end', font: { size: 9 }, color: '#dc2626' } }
                        }
                    }
                },
                interaction: { intersect: false, mode: 'index' }
            }
        });
    },

    // ----- §1 Backing -----------------------------------------------------
    _renderBacking: function(specific, s, slug) {
        var v = specific.vault_state || {};
        var totalAssets = v.total_assets;
        var liquidityCap = v.liquidity_cap;
        var capUtilPct = v.cap_utilization_pct;
        if ((capUtilPct === null || capUtilPct === undefined) && totalAssets && liquidityCap) {
            capUtilPct = totalAssets / liquidityCap * 100;
        }
        var nav = v.nav;
        var fee = (s && s.delegate_management_fee_pct != null) ? s.delegate_management_fee_pct :
                   (specific.yield && specific.yield.delegate_fee_pct);

        // Asset composition rows. Three-bucket split: Free + Loans + Liquidity.
        // Both Loans and Liquidity flow through the Strategy 0 LoanManager as
        // accounting wrapper, but their risk axes differ — Loans = third-party
        // borrower credit, Liquidity = issuer/RWA/AMM. Splitting prevents the
        // misread of "97.9% in Loan Manager" as "97.9% in third-party credit".
        var freeUsdc = (v.free_usdc !== null && v.free_usdc !== undefined) ?
            v.free_usdc :
            (s && s.collateral_ratio_alt && s.collateral_ratio_alt.is_currency ? s.collateral_ratio_alt.value : 0);
        var underlying = SyrupUSDCRenderer._underlying(slug);
        var strategies = v.strategies || [];
        var lb = specific.loan_book || {};
        var loansUsd = lb.principal_loans_only_usd;
        var liqUsd = lb.principal_liquidity_usd;

        // LoanManager address — both Loans and Liquidity rows link here.
        var lmAddress = null;
        strategies.forEach(function(st) { if (st.is_loan_manager) lmAddress = st.address; });

        var rows = [{
            label: 'Free ' + underlying,
            value: freeUsdc,
            color: '#64748b',
            tooltip: 'Pool ' + underlying + ' sitting in the vault contract — instantly available for withdrawals.'
        }];

        var haveLoansLiqSplit = (loansUsd != null && liqUsd != null);
        if (haveLoansLiqSplit) {
            rows.push({
                label: 'Loans <span class="text-xs font-normal text-slate-500">(third-party credit)</span>',
                value: loansUsd,
                color: '#22c55e',
                address: lmAddress,
                tooltip: 'Crypto-overcollateralized open-term loans. Routed through the Strategy 0 LoanManager as accounting wrapper, but functionally third-party borrower credit risk.'
            });
            rows.push({
                label: 'Liquidity layer <span class="text-xs font-normal text-slate-500">(pool-owned strategies)</span>',
                value: liqUsd,
                color: '#f59e0b',
                address: lmAddress,
                tooltip: 'Pool-owned positions in stablecoin / RWA / AMM venues (PYUSD, USTB, etc.). Routed through the same Strategy 0 LoanManager as accounting wrapper, but the risk axis is issuer / RWA / AMM — NOT third-party credit.'
            });
        } else if (strategies.length === 0) {
            // Older analyzer JSON without per-loan position_type or loan_book
            // principal split — degrade to a single deployed bucket.
            rows.push({
                label: 'Strategy AUM (deployed)',
                value: (v.strategy_aum != null) ? v.strategy_aum : ((totalAssets || 0) - (freeUsdc || 0)),
                color: '#6366f1'
            });
        } else {
            strategies.forEach(function(st, i) {
                var aum = st.aum_usd || 0;
                var isActive = st.is_loan_manager || aum >= SYRUP_SLEEVE_ACTIVE_THRESHOLD_USD;
                if (!isActive) return;
                rows.push({
                    label: st.is_loan_manager ? 'Strategy ' + i + ' (Loan Manager)' : 'Strategy ' + i,
                    value: aum,
                    color: st.is_loan_manager ? '#6366f1' : '#94a3b8',
                    address: st.address
                });
            });
        }

        var total = (totalAssets || rows.reduce(function(a, r) { return a + (r.value || 0); }, 0)) || 1;

        var compRows = rows.map(function(r) {
            var pct = (r.value || 0) / total * 100;
            var infoIcon = r.tooltip ?
                ' <span class="text-slate-400 cursor-help" title="' + r.tooltip.replace(/"/g, '&quot;') + '">ⓘ</span>' : '';
            return '<tr>' +
                '<td class="font-medium">' + r.label + infoIcon +
                    (r.address ? ' ' + SyrupUSDCRenderer._ethLink(r.address) : '') +
                '</td>' +
                '<td class="text-right font-mono">' + CommonRenderer.formatCurrencyExact(r.value || 0) + '</td>' +
                '<td class="text-right font-mono">' + CommonRenderer.formatPercent(pct, 1) + '</td>' +
                '<td><div class="pct-bar-container"><div class="pct-bar" style="width:' + Math.min(pct, 100) + '%; background:' + r.color + '"></div></div></td>' +
            '</tr>';
        }).join('');
        compRows += '<tr class="font-bold border-t-2 border-slate-200">' +
            '<td>Total</td>' +
            '<td class="text-right font-mono">' + CommonRenderer.formatCurrencyExact(total) + '</td>' +
            '<td class="text-right">100%</td>' +
            '<td></td>' +
        '</tr>';

        var pausedBadge = v.protocol_paused ?
            '<div class="risk-flag risk-critical mt-3"><strong>PROTOCOL PAUSED</strong> — deposits/withdrawals blocked at MapleGlobals</div>' : '';
        var ulBadge = (v.unrealized_losses && v.unrealized_losses > 0) ?
            '<div class="risk-flag risk-critical mt-3"><strong>Unrealized losses:</strong> ' + CommonRenderer.formatCurrencyExact(v.unrealized_losses) + ' — PCR_principal below 100%</div>' : '';

        // Header KPI row — 4 stats split into two visual columns.
        var kpiHeader =
            '<div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">' +
                '<div class="grid grid-cols-2 gap-3">' +
                    '<div class="summary-card"><div class="card-label">Pool TVL</div><div class="card-value">' + CommonRenderer.formatCurrency(totalAssets) + '</div></div>' +
                    '<div class="summary-card"><div class="card-label">Liquidity Cap</div><div class="card-value">' + CommonRenderer.formatCurrency(liquidityCap) + '</div>' +
                        (capUtilPct != null ? '<div class="text-xs text-slate-400 mt-1">' + CommonRenderer.formatPercent(capUtilPct, 1) + ' used</div>' : '') +
                    '</div>' +
                '</div>' +
                '<div class="grid grid-cols-2 gap-3">' +
                    '<div class="summary-card"><div class="card-label">NAV per share</div><div class="card-value">' + (nav != null ? '$' + nav.toFixed(4) : '-') + '</div><div class="text-xs text-slate-400 mt-1">' + underlying + ' per share</div></div>' +
                    '<div class="summary-card"><div class="card-label">Delegate fee</div><div class="card-value">' + (fee != null ? CommonRenderer.formatPercent(fee, 2) : '-') + '</div><div class="text-xs text-slate-400 mt-1">taken from gross</div></div>' +
                '</div>' +
            '</div>';

        return '<div class="panel">' +
            '<div class="panel-title">Backing</div>' +
            kpiHeader +
            '<div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-2">' +
                '<div class="lg:col-span-2">' +
                    '<div class="text-sm font-semibold text-slate-700 mb-2">Asset composition</div>' +
                    '<table class="data-table"><thead><tr>' +
                        '<th>Source</th>' +
                        '<th class="text-right">Value (USD)</th>' +
                        '<th class="text-right">%</th>' +
                        '<th style="width: 120px"></th>' +
                    '</tr></thead><tbody>' + compRows + '</tbody></table>' +
                '</div>' +
                '<div>' +
                    '<div class="text-sm font-semibold text-slate-700 mb-2">Allocation</div>' +
                    '<div style="height: 220px; position: relative;"><canvas id="syrup-backing-donut"></canvas></div>' +
                '</div>' +
            '</div>' +
            ulBadge +
            pausedBadge +
        '</div>';
    },

    _renderBackingDonut: function(specific, slug) {
        var ctx = document.getElementById('syrup-backing-donut');
        if (!ctx || typeof Chart === 'undefined') return;
        var v = specific.vault_state || {};
        var lb = specific.loan_book || {};
        var freeUsdc = v.free_usdc || 0;
        var loansUsd = lb.principal_loans_only_usd;
        var liqUsd = lb.principal_liquidity_usd;
        var underlying = SyrupUSDCRenderer._underlying(slug);

        // Three-segment view aligned with the asset-composition table:
        // slate Free, green Loans (third-party credit), amber Liquidity layer.
        // Falls back to the legacy 2-segment view if the loans/liquidity
        // split isn't available in the snapshot.
        var labels, data, colors;
        if (loansUsd != null && liqUsd != null) {
            labels = [
                'Free ' + underlying,
                'Loans (third-party credit)',
                'Liquidity layer (pool-owned)'
            ];
            data = [freeUsdc, loansUsd, liqUsd];
            colors = ['#64748b', '#22c55e', '#f59e0b'];
        } else {
            var deployed = (v.strategy_aum != null) ? v.strategy_aum :
                ((v.total_assets || 0) - freeUsdc);
            labels = ['Free ' + underlying, 'Deployed (loans + strategies)'];
            data = [freeUsdc, deployed];
            colors = ['#22c55e', '#6366f1'];
        }

        if (window._syrupBackingDonut) window._syrupBackingDonut.destroy();
        window._syrupBackingDonut = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
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
                            label: function(c) {
                                var total = c.dataset.data.reduce(function(a, b) { return a + b; }, 0);
                                var pct = total > 0 ? (c.raw / total * 100).toFixed(1) : '0.0';
                                return c.label + ': ' + CommonRenderer.formatCurrency(c.raw) + ' (' + pct + '%)';
                            }
                        }
                    }
                }
            }
        });
    },

    // ----- §2 Loan Book (loans-only — third-party credit) -----------------
    // Liquidity-layer positions (PYUSD/USTB/USDC/sUSDS/AMM) render as their
    // own §2b panel below; this panel scopes strictly to crypto-overcollat
    // third-party borrower credit.
    _renderLoanBookHealth: function(specific) {
        var lb = specific.loan_book;
        if (!lb) return '';

        var disclaimer = '<div class="risk-flag risk-warning"><strong>Important:</strong> These are open-term loans with off-chain custodied collateral. The smart contract holds no collateral and cannot auto-liquidate — enforcement requires Pool Delegate\'s call right (24h notice + 48h grace before contract-level default). See loan list below for per-loan collateral assets / init levels.</div>';

        if (lb.active_loan_count === null || lb.active_loan_count === undefined) {
            return '<div class="panel">' +
                '<div class="panel-title">Loan Book</div>' +
                disclaimer +
                '<div class="text-slate-400 text-sm mt-3 italic">Loan-level data pending — per-loan enumeration ships in Phase 2.</div>' +
            '</div>';
        }

        var allLoans = lb.loans || [];
        var loanRows = allLoans.filter(SyrupUSDCRenderer._isLoan);

        return '<div class="panel">' +
            '<div class="panel-title">Loan Book <span class="text-xs font-normal text-slate-500">(third-party credit)</span></div>' +
            disclaimer +
            this._renderLBH_status(specific, lb, loanRows) +
            this._renderLBH_buffer(lb) +
            this._renderLBH_byAssetLoans(lb) +
            this._renderTopLoansTable(lb, loanRows) +
        '</div>';
    },

    // ----- §2b Liquidity Layer (pool-owned positions) ---------------------
    // Hidden when the analyzer hasn't shipped position_type yet (older
    // snapshots) — the heuristic _isLiquidity classifier still works but
    // the custody fields needed for the table only land with the new schema.
    _renderLiquidityLayer: function(specific, slug) {
        var lb = specific.loan_book || {};
        var ct = (specific.governance || {}).custody_topology || {};
        var loans = (lb.loans || []).filter(SyrupUSDCRenderer._isLiquidity);
        if (loans.length === 0) return '';

        var vs = specific.vault_state || {};
        var liqTotal = lb.principal_liquidity_usd ||
            loans.reduce(function(s, l) { return s + (l.principal || 0); }, 0);
        var pctOfPool = (vs.total_assets) ? (liqTotal / vs.total_assets * 100) : null;
        var underlying = SyrupUSDCRenderer._underlying(slug);

        // ---- Header row ----
        var header =
            '<div class="text-sm text-slate-700 mb-2">' +
                '<span class="font-semibold">' + loans.length + ' position' + (loans.length === 1 ? '' : 's') + '</span> · ' +
                '<span class="font-mono">' + CommonRenderer.formatCurrency(liqTotal) + '</span>' +
                (pctOfPool != null ? ' · <span class="font-mono">' + CommonRenderer.formatPercent(pctOfPool, 1) + '</span> of pool' : '') +
            '</div>';

        // ---- Inline risk flags ----
        var custodyEntries = (ct.entries || []).filter(function(e) {
            return e.control_type === 'custody' && e.is_eoa;
        });
        var custodyEoaUsd = custodyEntries.reduce(function(s, e) { return s + (e.capital_under_control_usd || 0); }, 0);
        var eoaFlag = custodyEntries.length > 0 ?
            '<div class="risk-flag risk-info mb-2">ⓘ <strong>Maple-controlled MPC custody</strong> — ' +
                CommonRenderer.formatCurrency(custodyEoaUsd) + ' across ' + custodyEntries.length +
                ' MPC wallet' + (custodyEntries.length === 1 ? '' : 's') +
                ' under Maple Labs operational control. Residual axis is centralization-of-control (a firm-level event affects all wallets), not custody-primitive weakness.</div>' : '';
        var bigIssuers = loans.filter(function(l) { return (l.principal || 0) >= 50000000; })
            .map(function(l) {
                var c = l.collateral || {};
                var meta = SYRUP_COLLATERAL_META[c.asset] || {};
                var issuer = meta.issuer && meta.issuer !== '—' ? meta.issuer : (c.asset || '?');
                return issuer + ' (' + (c.asset || '?') + ', ' + CommonRenderer.formatCurrency(l.principal) + ')';
            });
        var issuerFlag = bigIssuers.length > 0 ?
            '<div class="risk-flag risk-warning mb-2">⚠ <strong>Issuer-axis exposure</strong> — concentrated single-issuer positions over $50M: ' +
                bigIssuers.join(' · ') + '.</div>' : '';

        // ---- Per-position table ----
        var tableRows = loans.slice().sort(function(a, b) { return (b.principal || 0) - (a.principal || 0); }).map(function(l) {
            var c = l.collateral || {};
            var cu = l.custody || {};
            var meta = SYRUP_COLLATERAL_META[c.asset] || {};
            var issuer = meta.issuer && meta.issuer !== '—' ? meta.issuer : '—';
            if (cu.venue) issuer += ' <span class="text-xs text-slate-400">· ' + cu.venue + '</span>';
            var custodyAddr = cu.address || l.borrower || '—';
            var custodyChain = (cu.chain || 'ethereum').charAt(0).toUpperCase() + (cu.chain || 'ethereum').slice(1);
            var eoaBadge = cu.is_eoa ?
                '<span class="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600" title="MPC + policy (per Maple\'s 2026-05-04 attestation)">MPC</span>' : '';
            var custodyCell = custodyAddr === '—' ?
                '<span class="text-slate-400">—</span>' :
                '<span class="font-mono text-xs" title="' + custodyAddr + '">' + SyrupUSDCRenderer._truncAddr(custodyAddr) + '</span> ' +
                    SyrupUSDCRenderer._ethLink(custodyAddr) + eoaBadge;
            return '<tr>' +
                '<td><span class="font-mono font-semibold">' + (c.asset || '—') + '</span></td>' +
                '<td class="text-xs text-slate-600">' + issuer + '</td>' +
                '<td>' + custodyCell + '</td>' +
                '<td class="text-xs text-slate-500">' + custodyChain + '</td>' +
                '<td class="text-right font-mono">' + CommonRenderer.formatCurrency(l.principal || 0) + '</td>' +
            '</tr>';
        }).join('');
        var table =
            '<div class="text-sm font-semibold text-slate-700 mb-2 mt-2">Liquidity positions</div>' +
            '<div class="overflow-x-auto"><table class="data-table"><thead><tr>' +
                '<th>Asset</th><th>Issuer</th><th>Custody</th><th>Chain</th><th class="text-right">Principal</th>' +
            '</tr></thead><tbody>' + tableRows + '</tbody></table></div>';

        return '<div class="panel">' +
            '<div class="panel-title">Liquidity Layer <span class="text-xs font-normal text-slate-500">(pool-owned positions)</span></div>' +
            '<p class="text-sm text-slate-500 mb-3">Pool-owned positions in yield-generating strategies — routed through Strategy 0 LoanManager as accounting wrapper, but functionally NOT third-party credit. Risk axis: issuer / RWA / AMM, not borrower default.</p>' +
            header +
            eoaFlag +
            issuerFlag +
            table +
        '</div>';
    },

    // §2 sub-block A — Status snapshot (loans-only)
    // Recomputes status counts from the filtered loans-only set; the
    // analyzer's lb.healthy_count etc. are book-wide and would mix
    // liquidity positions into the health metric.
    _renderLBH_status: function(specific, lb, loanRows) {
        var rows = loanRows || (lb.loans || []).filter(SyrupUSDCRenderer._isLoan);
        var loansCount = (lb.loans_only_count != null) ? lb.loans_only_count : rows.length;
        var imp = 0, cal = 0, def = 0, healthy = 0;
        rows.forEach(function(l) {
            var s = (l.status || '').toLowerCase();
            if (l.is_in_default || s === 'default' || s === 'defaulted') def++;
            else if (l.is_called || s === 'called') cal++;
            else if (l.is_impaired || s === 'impaired') imp++;
            else healthy++;
        });

        var cs = lb.collateral_summary || {};
        var poolCR = (cs.collateral_ratio_loans_only_pct != null) ?
            cs.collateral_ratio_loans_only_pct : cs.pool_collateral_ratio_pct;
        var rateText = (lb.weighted_avg_rate_pct != null) ? CommonRenderer.formatPercent(lb.weighted_avg_rate_pct, 2) : '—';
        var poolCRText = (poolCR != null) ? CommonRenderer.formatPercent(poolCR, 1) : '—';

        var co = lb.concentration_loans_only || lb.concentration || {};
        var borrowerCount = co.total_borrowers || co.borrower_count || lb.borrower_count || 0;

        function statusPill(label, count, cls) {
            var color = count > 0 ? cls : 'text-slate-400';
            return '<span class="' + color + '"><strong>' + label + '</strong> ' + count + '</span>';
        }

        return '<div class="mt-4 mb-4">' +
            '<div class="text-sm text-slate-700 mb-1">' +
                '<span class="font-semibold">' + loansCount + ' loans</span> · ' +
                '<span class="font-semibold">' + borrowerCount + ' borrowers</span> · ' +
                '<span class="font-mono">' + rateText + '</span> wtd-rate · ' +
                'pool CR (loans-only) <span class="font-mono">' + poolCRText + '</span>' +
            '</div>' +
            '<div class="text-sm text-slate-600 flex flex-wrap gap-x-4 gap-y-1">' +
                statusPill('Healthy', healthy, 'text-green-600') +
                '<span class="text-slate-300">·</span>' +
                statusPill('Impaired', imp, 'text-amber-600') +
                '<span class="text-slate-300">·</span>' +
                statusPill('Called', cal, 'text-orange-600') +
                '<span class="text-slate-300">·</span>' +
                statusPill('Default', def, 'text-red-600') +
            '</div>' +
        '</div>';
    },

    // §2 sub-block B — Buffer health (NEW). Reads PegTracker companion fields.
    // Graceful-degrades to a placeholder when those fields aren't shipped yet.
    _renderLBH_buffer: function(lb) {
        var cs = lb.collateral_summary;
        if (!cs) return '';  // Collateral Mix sub-block handles the unavailable case below.

        var hasBuffer = cs.loans_below_init_count != null &&
                        cs.weighted_avg_buffer_pp != null &&
                        cs.tightest_loan;

        if (!hasBuffer) {
            return '<div class="mb-4 p-3 rounded-lg" style="background:#f8fafc;border:1px solid #e2e8f0">' +
                '<div class="text-sm font-semibold text-slate-700 mb-1">Buffer health</div>' +
                '<div class="text-xs text-slate-400 italic">Buffer-health metrics pending pipeline update.</div>' +
            '</div>';
        }

        var totalActive = lb.active_loan_count || 0;
        var below = cs.loans_below_init_count || 0;
        var above = Math.max(0, totalActive - below);
        var totalPrincipal = (cs.set_a_overcollateralized && cs.set_a_overcollateralized.principal_usd || 0) +
                             (cs.set_b_at_par && cs.set_b_at_par.principal_usd || 0);
        if (totalPrincipal === 0 && lb.loans) {
            totalPrincipal = lb.loans.reduce(function(s, l) { return s + (l.principal || 0); }, 0);
        }
        var belowUsd = cs.principal_below_init_usd || 0;
        var aboveUsd = Math.max(0, totalPrincipal - belowUsd);
        var belowPct = totalPrincipal > 0 ? (belowUsd / totalPrincipal * 100) : 0;
        var abovePct = totalPrincipal > 0 ? (aboveUsd / totalPrincipal * 100) : 0;
        var wab = cs.weighted_avg_buffer_pp;
        var wabSign = wab >= 0 ? '+' : '';
        var wabCls = wab >= 5 ? 'text-green-600' : wab >= 0 ? 'text-amber-600' : 'text-red-600';

        var t = cs.tightest_loan;
        var tSign = t.buffer_pp >= 0 ? '+' : '';
        var pap = (t.points_above_par != null) ? t.points_above_par.toFixed(1) :
            (t.current_level_pct != null ? (t.current_level_pct - 100).toFixed(1) : '?');
        var papCls = t.points_above_par <= 5 ? 'text-amber-600 font-semibold' :
                     t.points_above_par <= 0 ? 'text-red-600 font-semibold' : 'text-slate-700';

        return '<div class="mb-4 p-3 rounded-lg" style="background:#f8fafc;border:1px solid #e2e8f0">' +
            '<div class="text-sm font-semibold text-slate-700 mb-2">Buffer health</div>' +
            '<div class="text-sm text-slate-700 mb-1">' +
                'Above init level: <strong>' + above + ' loan' + (above === 1 ? '' : 's') + '</strong> · ' +
                CommonRenderer.formatCurrency(aboveUsd) + ' (' + CommonRenderer.formatPercent(abovePct, 1) + ')' +
            '</div>' +
            (below > 0 ?
                '<div class="text-sm text-amber-700 mb-1">' +
                    '⚠ Below init level: <strong>' + below + ' loan' + (below === 1 ? '' : 's') + '</strong> · ' +
                    CommonRenderer.formatCurrency(belowUsd) + ' (' + CommonRenderer.formatPercent(belowPct, 1) + ')' +
                    '<div class="text-xs text-amber-600 mt-1 ml-4">Delegate has discretion to call but has not — these are out of compliance with funding-time collateral terms.</div>' +
                '</div>' :
                '<div class="text-xs text-green-600 mb-1">All active loans above their funding-time required collateral level.</div>') +
            '<div class="text-sm mt-2">' +
                'Wtd-avg buffer: <span class="font-mono font-semibold ' + wabCls + '">' + wabSign + wab.toFixed(1) + 'pp</span>' +
            '</div>' +
            '<div class="text-sm mt-1">' +
                'Tightest loan: <span class="font-mono">' + CommonRenderer.formatCurrency(t.principal_usd) + ' ' + t.asset + '</span> @ ' +
                CommonRenderer.formatPercent(t.current_level_pct, 1) +
                ' (init ' + CommonRenderer.formatPercent(t.init_level_pct, 0) + ', ' + tSign + t.buffer_pp.toFixed(1) + 'pp)' +
                ' — only <span class="' + papCls + '">' + pap + 'pp above par</span>' +
            '</div>' +
        '</div>';
    },

    // §2 sub-block C — By collateral asset (loans-only). Drops Set A/B
    // framing — the new framing splits the book into loans-only vs
    // liquidity-layer panels, with this section showing the per-asset
    // breakdown of crypto-overcollat third-party credit only.
    _renderLBH_byAssetLoans: function(lb) {
        var cs = lb.collateral_summary;
        if (!cs) return '';

        if (cs.data_source === 'unavailable') {
            return '<div class="risk-flag risk-info mb-4">Collateral data temporarily unavailable from Maple API. Loan-level credit and timing fields above are unaffected.</div>';
        }

        var byAsset = cs.by_asset || [];
        var loanAssets = byAsset.filter(function(r) {
            return SyrupUSDCRenderer._isLoanAsset(r.asset) || (r.init_level_pct_max || 0) > 105;
        });
        if (loanAssets.length === 0) return '';

        var loansOnlyTotal = lb.principal_loans_only_usd ||
            loanAssets.reduce(function(s, r) { return s + (r.principal_usd || 0); }, 0);

        function bar(row) {
            var raw = row.principal_usd || 0;
            var pct = loansOnlyTotal > 0 ? (raw / loansOnlyTotal * 100) : 0;
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
                    '<span class="font-mono font-semibold">' + CommonRenderer.formatPercent(pct, 1) + ' · ' + CommonRenderer.formatCurrency(raw) + '</span>' +
                '</div>' +
                '<div class="pct-bar-container"><div class="pct-bar" style="width:' + Math.min(pct, 100) + '%; background:#22c55e"></div></div>' +
            '</div>';
        }

        return '<div class="mb-4">' +
            '<div class="text-sm font-semibold text-slate-700 mb-2">By collateral asset</div>' +
            '<div class="text-xs text-slate-400 mb-2">Percentages relative to ' + CommonRenderer.formatCurrency(loansOnlyTotal) + ' loans-only book.</div>' +
            loanAssets.sort(function(a, b) { return (b.principal_usd || 0) - (a.principal_usd || 0); }).map(bar).join('') +
        '</div>';
    },

    // §2 sub-block D — Top loans table (loans-only). The previous
    // single-table version mixed third-party credit with pool-owned
    // liquidity positions; liquidity positions now render as their own
    // table inside the §2b Liquidity Layer panel.
    _renderTopLoansTable: function(lb, loanRows) {
        var rows = loanRows || (lb.loans || []).filter(SyrupUSDCRenderer._isLoan);
        if (rows.length === 0) return '';

        var summary = lb.collateral_summary;
        var hasCollateral = !!(summary && summary.data_source && summary.data_source !== 'unavailable')
            || rows.some(function(l) { return l && l.collateral; });
        var sorted = rows.slice().sort(function(a, b) { return (b.principal || 0) - (a.principal || 0); }).slice(0, 10);
        var rowsHtml = sorted.map(function(l) { return SyrupUSDCRenderer._renderLoanRow(l, hasCollateral); }).join('');

        var collateralHeaders = hasCollateral ?
            ('<th class="cursor-pointer" data-sort="collat">Collateral</th>' +
             '<th class="text-right cursor-pointer" data-sort="init">Init</th>' +
             '<th class="text-right cursor-pointer" data-sort="cur">Cur</th>' +
             '<th class="text-right cursor-pointer" data-sort="buf">Buf</th>') : '';

        return '<div class="text-sm font-semibold text-slate-700 mb-2 mt-2">Top loans (sortable)</div>' +
            '<div class="overflow-x-auto"><table class="data-table" id="syrup-loans-table"><thead><tr>' +
                '<th class="cursor-pointer" data-sort="borrower">Borrower</th>' +
                '<th class="text-right cursor-pointer" data-sort="principal">Princ. ▾</th>' +
                '<th class="text-right cursor-pointer" data-sort="rate">Rate</th>' +
                '<th class="text-right cursor-pointer" data-sort="days">Days</th>' +
                '<th class="cursor-pointer" data-sort="status">S</th>' +
                collateralHeaders +
            '</tr></thead><tbody>' + rowsHtml + '</tbody></table></div>';
    },

    _renderLoanRow: function(loan, hasCollateral) {
        var addr = loan.borrower || '';
        var firmTag = loan.firm ? '<span class="text-xs text-slate-500 ml-1">' + loan.firm + '</span>' : '';
        var borrowerCell = '<span class="font-mono text-xs" title="' + addr + '">' + SyrupUSDCRenderer._truncAddr(addr) + '</span>' +
            ' ' + SyrupUSDCRenderer._ethLink(addr) + firmTag;

        var days = null;
        if (loan.payment_due_date) {
            var due = typeof loan.payment_due_date === 'number' ?
                new Date(loan.payment_due_date * 1000) :
                new Date(loan.payment_due_date.endsWith && loan.payment_due_date.endsWith('Z') ? loan.payment_due_date : loan.payment_due_date + 'Z');
            if (!isNaN(due.getTime())) {
                days = Math.floor((due.getTime() - Date.now()) / 86400000);
            }
        }
        var daysText, daysCls = '';
        if (days === null) {
            daysText = '—';
        } else if (days < 0) {
            // Convert to overdue hours (rough; abs days back to hours)
            var overdueHours = Math.round(-days * 24);
            daysText = 'Overdue ' + (overdueHours >= 24 ? Math.round(-days) + 'd' : overdueHours + 'h');
            daysCls = 'text-red-600 font-semibold';
        } else {
            daysText = days + 'd';
            if (days < 7) daysCls = 'text-red-600 font-semibold';
            else if (days < 30) daysCls = 'text-amber-600';
        }

        var status = loan.status || '';
        var statusCell = SyrupUSDCRenderer._statusEmoji(status);

        var sortAttrs = {
            principal: loan.principal || 0,
            rate: loan.rate_pct || 0,
            days: days === null ? '' : days,
            status: status,
            borrower: addr
        };

        var collateralCells = '';
        if (hasCollateral) {
            var c = loan.collateral || {};
            var asset = c.asset || null;
            var collatUsd = c.usd;
            var isAnomaly = c.usd_source === 'data_anomaly';
            // Distinguish data_anomaly cells (Maple GraphQL returns broken
            // currentAssetAmount) from genuinely-unavailable: same — but with
            // a ? glyph + tooltip so readers know it's a data-quality issue,
            // not a missing oracle.
            var anomalyAttrs = isAnomaly ?
                ' title="Maple GraphQL data anomaly — click for methodology footnote" class="cursor-help"' : '';
            // Anchor jumps to the AUM-coverage panel's methodology footnote
            // so a careful reader can find the explanation in one click.
            var anomalyGlyph = isAnomaly ?
                ' <a href="#syrup-data-anomaly-note" class="text-amber-500 text-xs no-underline hover:underline" title="Maple GraphQL data anomaly — click for methodology footnote">?</a>' : '';

            // Single combined "Collateral" cell — "PYUSD $152.7M" or "USTB — ?"
            var collatCellText;
            if (!asset) {
                collatCellText = '<span class="text-slate-400">—</span>';
            } else {
                var meta = SYRUP_COLLATERAL_META[asset] || {};
                var usdText;
                if (collatUsd != null) {
                    usdText = CommonRenderer.formatCurrency(collatUsd);
                } else if (isAnomaly) {
                    usdText = '<span class="text-slate-400"' + anomalyAttrs + '>—</span>' + anomalyGlyph;
                } else {
                    usdText = '<span class="text-slate-400">—</span>';
                }
                var issuerSuffix = meta.issuer && meta.issuer !== '—' ?
                    ' <span class="text-xs text-slate-400">(' + meta.issuer + ')</span>' : '';
                collatCellText = '<span class="font-mono text-xs">' + asset + '</span> ' +
                    '<span class="font-mono text-sm">' + usdText + '</span>' + issuerSuffix;
            }

            var initLevel = c.init_level_pct;
            var curLevel = c.current_level_pct;
            var initText = (initLevel != null) ? CommonRenderer.formatPercent(initLevel, 0) : '—';
            var curText;
            if (curLevel != null) {
                curText = CommonRenderer.formatPercent(curLevel, 1);
            } else if (isAnomaly) {
                curText = '<span' + anomalyAttrs + '>—</span>' + anomalyGlyph;
            } else {
                curText = '—';
            }

            collateralCells =
                '<td>' + collatCellText + '</td>' +
                '<td class="text-right font-mono text-slate-500">' + initText + '</td>' +
                '<td class="text-right font-mono">' + curText + '</td>' +
                SyrupUSDCRenderer._renderBufferCell(c);

            sortAttrs.collat = asset || '';
            sortAttrs.init = (initLevel != null) ? initLevel : '';
            sortAttrs.cur = (curLevel != null) ? curLevel : '';
            sortAttrs.buf = (c.buffer_pp != null) ? c.buffer_pp : '';
        }

        var dataAttrs = Object.keys(sortAttrs).map(function(k) {
            return 'data-' + k.replace(/_/g, '-') + '="' + String(sortAttrs[k]).replace(/"/g, '&quot;') + '"';
        }).join(' ');

        return '<tr ' + dataAttrs + '>' +
            '<td>' + borrowerCell + '</td>' +
            '<td class="text-right font-mono">' + CommonRenderer.formatCurrency(loan.principal || 0) + '</td>' +
            '<td class="text-right font-mono">' + (loan.rate_pct != null ? CommonRenderer.formatPercent(loan.rate_pct, 2) : '—') + '</td>' +
            '<td class="text-right font-mono ' + daysCls + '">' + daysText + '</td>' +
            '<td>' + statusCell + '</td>' +
            collateralCells +
        '</tr>';
    },

    // Per-Set buffer-color decision rule (master spec §3).
    _renderBufferCell: function(coll) {
        var buf = coll && coll.buffer_pp;
        if (buf === null || buf === undefined) {
            // Distinguish data_anomaly (collateral state unverifiable) from
            // genuinely-unavailable so readers understand the difference.
            if (coll && coll.usd_source === 'data_anomaly') {
                return '<td class="text-right font-mono text-slate-400">— <a href="#syrup-data-anomaly-note" class="text-amber-500 text-xs no-underline hover:underline cursor-help" title="Maple GraphQL data anomaly — click for methodology footnote">?</a></td>';
            }
            return '<td class="text-right font-mono text-slate-400">—</td>';
        }
        var sign = buf >= 0 ? '+' : '';
        var label = sign + buf.toFixed(1) + 'pp';

        if (coll.is_at_par) {
            // Set B: gray "at-par" tag unless asset has depegged below par
            if (buf < -1) {
                return '<td class="text-right font-mono text-red-600 font-semibold" title="Collateral asset depegged below par">' + label + ' 🔴</td>';
            }
            return '<td class="text-right font-mono text-slate-500" title="At par by design">' + label + ' <span class="text-xs">at-par</span></td>';
        }
        // Set A
        if (buf < 0) return '<td class="text-right font-mono text-red-600 font-semibold" title="Below init level — delegate discretion to call">' + label + ' 🔴</td>';
        if (buf < 5) return '<td class="text-right font-mono text-amber-600 font-semibold" title="Approaching init level">' + label + ' ⚠</td>';
        return '<td class="text-right font-mono text-green-600">' + label + '</td>';
    },

    _attachLoanTableSort: function() {
        var table = document.getElementById('syrup-loans-table');
        if (!table) return;
        var headers = table.querySelectorAll('th[data-sort]');
        var STRING_KEYS = { borrower: 1, status: 1, collat: 1 };
        headers.forEach(function(th) {
            th.addEventListener('click', function() {
                var key = th.getAttribute('data-sort');
                var attr = 'data-' + key.replace(/_/g, '-');
                var tbody = table.querySelector('tbody');
                var rows = Array.prototype.slice.call(tbody.querySelectorAll('tr'));
                // Default click → asc (so Buf ascending = tightest first); subsequent click toggles.
                var dir = th.getAttribute('data-dir') === 'asc' ? 'desc' : 'asc';
                headers.forEach(function(h) { h.removeAttribute('data-dir'); });
                th.setAttribute('data-dir', dir);
                rows.sort(function(a, b) {
                    var av = a.getAttribute(attr) || '';
                    var bv = b.getAttribute(attr) || '';
                    if (STRING_KEYS[key]) {
                        return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
                    }
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

    // ----- §2c Strategy contract slots (unused) ---------------------------
    // Configured-but-empty wrapper-contract strategy slots. Distinct from
    // the §2b Liquidity Layer panel: that panel covers Maple's ACTIVE
    // DeFi-strategy deployment ($304M+ syrupUSDC / $43M syrupUSDT) routed
    // via Strategy 0's loan-record accounting path. This panel covers the
    // PARALLEL audited-wrapper-contract path (Aave V3 deposit, Sky/sUSDS
    // DSR, etc.) that the Pool Delegate could activate but currently isn't
    // using. Both paths are delegate-discretionary.
    //
    // Slug-aware: syrupUSDT has 2 dormant slots (FixedTerm + Aave),
    // syrupUSDC has 3 (FixedTerm + Aave + Sky). The historical Aave note
    // only renders for syrupUSDC.
    _renderStrategySlots: function(specific, slug) {
        var v = specific.vault_state || {};
        var strategies = v.strategies || [];
        var dormant = [];
        strategies.forEach(function(st, i) {
            var aum = st.aum_usd || 0;
            var isActive = st.is_loan_manager || aum >= SYRUP_SLEEVE_ACTIVE_THRESHOLD_USD;
            if (!isActive) dormant.push({ st: st, index: i });
        });
        if (dormant.length === 0) return '';

        var sleeveItems = dormant.map(function(d) {
            var st = d.st;
            var implName = st.strategy_impl_name;
            var nameLabel;
            if (implName) {
                var desc = SYRUP_STRATEGY_IMPL_INFO[implName] || 'configured DeFi sleeve';
                nameLabel = '<span class="font-mono">' + implName + '</span>' +
                    ' <span class="text-slate-400">(' + desc + ')</span>';
            } else {
                nameLabel = '<span class="font-mono text-xs" title="' + st.address + '">' +
                    SyrupUSDCRenderer._truncAddr(st.address) + '</span>';
            }
            return '<li class="flex items-center gap-2 py-1">' +
                '<span class="text-slate-500">Strategy ' + d.index + ' —</span> ' +
                nameLabel + ' ' +
                SyrupUSDCRenderer._ethLink(st.address) +
                ' <span class="ml-auto text-xs font-semibold uppercase tracking-wide text-slate-400">Dormant · $0</span>' +
            '</li>';
        }).join('');

        var historicalNote = (slug === 'syrupusdc') ?
            ' <strong>Historical context (syrupUSDC only):</strong> Strategy 2 (Aave V3) was deployed at $26–42M scale March–April 2026, wound down before the Kelp DAO/rsETH incident.' :
            '';

        return '<div class="panel">' +
            '<div class="panel-title">Strategy contract slots <span class="text-xs font-normal text-slate-500">(unused — separate from Liquidity layer above)</span></div>' +
            '<p class="text-sm text-slate-500 mb-3 leading-relaxed">' +
                '↺ Configured contract slots that the Pool Delegate could activate to deploy capital via audited wrapper contracts (Aave V3 deposit, Sky/sUSDS DSR). ' +
                'Maple\'s <strong>active DeFi-strategy deployment</strong> is via the Liquidity Layer panel above — that uses Strategy 0\'s loan-record accounting rather than these wrapper contracts. ' +
                'Both mechanisms are delegate-discretionary; this block tracks the wrapper-contract path.' +
                historicalNote +
            '</p>' +
            '<ul class="text-sm text-slate-600">' + sleeveItems + '</ul>' +
        '</div>';
    },

    // ----- §3 Borrower Concentration (loans-only) -------------------------
    // Uses concentration_loans_only when present so the HHI / top-N stats
    // describe third-party-credit concentration only — including liquidity
    // custodies overstates loan-book concentration. Falls back to
    // book-wide concentration for older snapshots.
    _renderBorrowerConcentration: function(specific) {
        var lb = specific.loan_book;
        if (!lb) return '';
        var c = lb.concentration_loans_only || lb.concentration;
        if (!c) return '';
        var isLoansOnly = !!lb.concentration_loans_only;

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
            // borrower_meta_tag is a structural classifier (e.g. "Multi-product
            // credit (PYUSD/USTB)"), not a legal-entity name — column header is
            // "TAG" rather than "FIRM".
            var tag = b.borrower_meta_tag || b.firm || null;
            var tagCell = tag ?
                '<span class="text-xs text-slate-600">' + tag + '</span>' :
                '<span class="text-xs text-slate-400">—</span>';
            return '<tr>' +
                '<td><span class="font-mono text-xs" title="' + b.address + '">' + SyrupUSDCRenderer._truncAddr(b.address) + '</span> ' + SyrupUSDCRenderer._ethLink(b.address) + '</td>' +
                '<td>' + tagCell + '</td>' +
                '<td class="text-right font-mono">' + CommonRenderer.formatCurrencyExact(b.principal_usd) + '</td>' +
                '<td class="text-right font-mono">' + (b.loan_count || 0) + '</td>' +
                '<td class="text-right font-mono">' + CommonRenderer.formatPercent(b.share_pct, 2) + '</td>' +
            '</tr>';
        }).join('');

        return '<div class="panel">' +
            '<div class="panel-title">Borrower Concentration' + (isLoansOnly ? ' <span class="text-xs font-normal text-slate-500">(Loans-only)</span>' : '') + '</div>' +
            (isLoansOnly ? '<p class="text-sm text-slate-500 mb-3">Loan-book concentration only. Liquidity-layer custodies surfaced separately above.</p>' : '') +
            '<div class="flex items-center gap-3 mb-4">' +
                '<span class="text-sm text-slate-700"><span class="font-semibold">' + (c.total_borrowers || 0) + '</span> ' + (isLoansOnly ? 'loan ' : '') + 'borrowers · HHI <span class="font-mono font-semibold">' + (c.hhi || 0) + '</span></span>' +
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
                '<th>Borrower</th><th>Tag</th><th class="text-right">Principal</th><th class="text-right"># Loans</th><th class="text-right">Share</th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
        '</div>';
    },

    // ----- §4 Repayment Schedule (renamed from Payment Ladder) ------------
    _renderRepaymentSchedule: function(specific) {
        var lb = specific.loan_book;
        if (!lb || !lb.payment_ladder) return '';
        var pl = lb.payment_ladder;

        if (!pl.buckets || pl.buckets.length === 0) {
            return '<div class="panel">' +
                '<div class="panel-title">Repayment Schedule (next ' + (pl.horizon_days || 180) + ' days)</div>' +
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
            '<div class="panel-title">Repayment Schedule (next ' + (pl.horizon_days || 180) + ' days)</div>' +
            '<p class="text-sm text-slate-500 mb-3">Expected interest-only inflows from active open-term loans, bucketed by next payment-due date. Principal repays only on a Pool-Delegate call (24h notice + 48h grace) and is not modelled here.</p>' +
            '<div class="text-xs text-slate-500 mb-2">Cumulative interest expected through each horizon (chart below shows per-bucket detail).</div>' +
            '<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">' +
                statBlock('Within 30d', t.expected_inflow_30d_usd) +
                statBlock('Within 60d', t.expected_inflow_60d_usd) +
                statBlock('Within 90d', t.expected_inflow_90d_usd) +
                statBlock('Within 180d', t.expected_inflow_180d_usd) +
            '</div>' +
            '<div style="height: 220px; position: relative;"><canvas id="syrup-ladder-chart"></canvas></div>' +
            (overdueCount > 0 ?
                '<div class="' + overdueCls + ' mt-3"><strong>Overdue:</strong> ' + overdueCount + ' loan' + (overdueCount > 1 ? 's' : '') + ' · ' + CommonRenderer.formatCurrencyExact(overduePrincipal) + ' principal past payment-due date</div>' :
                '<div class="text-xs text-slate-500 mt-3">Overdue: 0 loans · $0</div>') +
            '<div class="text-xs text-slate-400 mt-2">Method: <span class="font-mono">' + (pl.method || 'rate_estimate') + '</span></div>' +
        '</div>';
    },

    _renderRepaymentScheduleChart: function(specific) {
        var ctx = document.getElementById('syrup-ladder-chart');
        if (!ctx || typeof Chart === 'undefined') return;
        var pl = specific.loan_book && specific.loan_book.payment_ladder;
        if (!pl || !pl.buckets || pl.buckets.length === 0) return;

        var labels = pl.buckets.map(function(b) {
            var d = new Date(b.period_end_iso + 'T00:00:00Z');
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
        });
        var values = pl.buckets.map(function(b) { return b.expected_inflow_usd || 0; });
        var loanCounts = pl.buckets.map(function(b) { return b.loan_count || 0; });
        var total = values.reduce(function(a, b) { return a + b; }, 0);
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
                            callback: function(val, idx) { return labels[idx] + ' (' + loanCounts[idx] + ')'; }
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

    // ----- §5 Liquidity & Peg (folds Exit Realism + Stress Anchor + Peg) --
    _renderLiquidityAndPeg: function(specific, s, slug) {
        var wq = specific.withdrawal_queue;
        var liq = specific.liquidity;
        var peg = specific.peg;
        var lb = specific.loan_book || {};
        var underlying = SyrupUSDCRenderer._underlying(slug);

        var html = '<div class="panel"><div class="panel-title">Liquidity &amp; Peg</div>' +
            '<p class="text-sm text-slate-500 mb-3">Two exit paths: (a) instant queue exit redeems against free ' + underlying + ' at NAV; (b) DEX/aggregator sell takes a slippage hit but settles immediately. Peg deviation = market price vs theoretical NAV.</p>';

        // Free underlying + queue-based time-context cards. Maple Syrup's
        // WithdrawalManager is queue-based (NOT cyclical) — getCurrentCycleId()
        // reverts on the deployed impl. Render last-fill, head-request age (or
        // empty state), queue depth, and request-id strip. Do not render
        // current_cycle_* / cycle_duration_seconds — permanently null for Syrup.
        if (wq) {
            var freeUsd = (s.collateral_ratio_alt && s.collateral_ratio_alt.is_currency) ? s.collateral_ratio_alt.value :
                          (specific.vault_state && specific.vault_state.free_usdc) || null;
            var freePct = SyrupUSDCRenderer._freeLiquidityPct(s);
            var queueEmpty = wq.is_empty === true;
            var depthUsd = (wq.queue_depth_usdc_est === null || wq.queue_depth_usdc_est === undefined) ? (queueEmpty ? 0 : null) : wq.queue_depth_usdc_est;
            var slots = wq.queue_depth_slots;
            var nextId = wq.next_request_id;
            var lastId = wq.last_request_id;
            var depthCls = depthUsd !== null && depthUsd > 10000000 ? 'warning' : '';
            var depthText = depthUsd === null ? '—' :
                            (slots != null ? slots + ' request' + (slots === 1 ? '' : 's') + ' · ' + CommonRenderer.formatCurrency(depthUsd) : CommonRenderer.formatCurrency(depthUsd));

            var lastFillAge = SyrupUSDCRenderer._formatRelativeAge(wq.last_filled_age_seconds);
            var lastFillIso = wq.last_filled_timestamp_iso ? wq.last_filled_timestamp_iso.replace('+00:00', 'Z') : '—';
            var lastFillCard =
                '<div class="summary-card">' +
                    '<div class="card-label">Last fill</div>' +
                    '<div class="card-value text-base">' + lastFillAge + '</div>' +
                    '<div class="text-xs text-slate-400 mt-1 font-mono">' + lastFillIso + '</div>' +
                '</div>';

            var headCard;
            if (queueEmpty) {
                headCard =
                    '<div class="summary-card">' +
                        '<div class="card-label">Queue status</div>' +
                        '<div class="card-value text-base">Empty <span class="text-slate-400 text-sm">(0 pending)</span></div>' +
                        '<div class="text-xs text-slate-400 mt-1">Next request fills on submission</div>' +
                    '</div>';
            } else {
                var headAge = SyrupUSDCRenderer._formatRelativeAge(wq.next_request_age_seconds);
                var headSubtext = (nextId != null && wq.next_request_age_seconds != null) ?
                    'request ' + nextId + ' waiting' : 'head of queue';
                headCard =
                    '<div class="summary-card">' +
                        '<div class="card-label">Head request age</div>' +
                        '<div class="card-value text-base ' + (wq.next_request_age_seconds > 86400 ? 'warning' : '') + '">' + headAge + '</div>' +
                        '<div class="text-xs text-slate-400 mt-1">' + headSubtext + '</div>' +
                    '</div>';
            }

            html += '<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">' +
                '<div class="summary-card"><div class="card-label">Free ' + underlying + '</div><div class="card-value positive">' + CommonRenderer.formatCurrency(freeUsd) + '</div><div class="text-xs text-slate-400 mt-1">' + CommonRenderer.formatPercent(freePct, 1) + ' of supply</div></div>' +
                lastFillCard +
                headCard +
                '<div class="summary-card"><div class="card-label">' + (queueEmpty ? 'Request IDs' : 'Queue depth') + '</div>' +
                    (queueEmpty ?
                        '<div class="card-value text-base font-mono">' + (lastId != null ? lastId : '—') + ' / ' + (nextId != null ? nextId : '—') + '</div>' +
                        '<div class="text-xs text-slate-400 mt-1">last filled / next to file</div>'
                      :
                        '<div class="card-value ' + depthCls + '">' + depthText + '</div>' +
                        '<div class="text-xs text-slate-400 mt-1">' + underlying + ' est.</div>'
                    ) +
                '</div>' +
            '</div>';
        }

        // DEX aggregator slippage
        if (liq && liq.quotes) {
            var sizes = Object.keys(liq.quotes).sort(function(a, b) { return parseFloat(a) - parseFloat(b); });
            var rows = sizes.map(function(sz) {
                var q = liq.quotes[sz];
                var bps = q.slippage_bps;
                var cls = bps > 50 ? 'text-red-600 font-semibold' : bps > 20 ? 'text-amber-600' : '';
                return '<tr>' +
                    '<td class="font-mono">$' + Number(sz).toLocaleString() + '</td>' +
                    '<td class="text-right font-mono ' + cls + '">' + (bps != null ? bps.toFixed(1) + ' bps' : '—') + '</td>' +
                    '<td class="text-right font-mono">' + (q.output_usd != null ? '$' + q.output_usd.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—') + '</td>' +
                '</tr>';
            }).join('');
            var sourceLabel = liq.source ? ' (' + liq.source + ')' : '';
            html += '<div class="text-sm font-semibold text-slate-700 mt-2 mb-1">DEX aggregator slippage → ' + underlying + sourceLabel + '</div>' +
                '<table class="data-table"><thead><tr><th>Notional</th><th class="text-right">Slippage</th><th class="text-right">Output</th></tr></thead><tbody>' + rows + '</tbody></table>' +
                (liq.pool_tvl ? '<div class="text-xs text-slate-400 mt-2">DEX pool TVL: ' + CommonRenderer.formatCurrency(liq.pool_tvl) + (liq.pool_count ? ' across ' + liq.pool_count + ' pools' : '') + '</div>' : '');
        }

        // NEW: Peg deviation row
        if (peg && (peg.market_price != null || peg.theoretical_price != null)) {
            // premium_discount_pct is a percentage (e.g. -0.06 = -6 bps roughly).
            // 1% = 100 bps. So bps = pct * 100.
            var pdPct = peg.premium_discount_pct;
            var pdBps = (pdPct != null) ? pdPct * 100 : null;
            var pdSign = pdBps != null && pdBps >= 0 ? '+' : '';
            var pdCls = pdBps != null && Math.abs(pdBps) > 50 ? 'text-red-600 font-semibold' :
                        pdBps != null && Math.abs(pdBps) > 20 ? 'text-amber-600' : 'text-slate-700';
            html += '<div class="text-sm font-semibold text-slate-700 mt-4 mb-1">Peg deviation</div>' +
                '<div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-2">' +
                    '<div class="summary-card"><div class="card-label">Market price</div><div class="card-value">' + (peg.market_price != null ? '$' + peg.market_price.toFixed(4) : '—') + '</div><div class="text-xs text-slate-400 mt-1">' + (peg.source || 'external') + '</div></div>' +
                    '<div class="summary-card"><div class="card-label">NAV (theoretical)</div><div class="card-value">' + (peg.theoretical_price != null ? '$' + peg.theoretical_price.toFixed(4) : '—') + '</div><div class="text-xs text-slate-400 mt-1">on-chain</div></div>' +
                    '<div class="summary-card"><div class="card-label">Discount</div><div class="card-value ' + pdCls + '">' + (pdBps != null ? pdSign + pdBps.toFixed(1) + ' bps' : '—') + '</div><div class="text-xs text-slate-400 mt-1">market vs NAV</div></div>' +
                '</div>';
        }

        // Stress anchor
        var freePct2 = SyrupUSDCRenderer._freeLiquidityPct(s);
        var freeUsd2 = (s.collateral_ratio_alt && s.collateral_ratio_alt.is_currency) ? s.collateral_ratio_alt.value : null;
        var paymentInterval = lb.weighted_avg_payment_interval_days;
        if (paymentInterval == null) paymentInterval = lb.weighted_avg_remaining_days_to_due;
        var freePctText = freePct2 != null ? freePct2.toFixed(1) + '%' : '?';
        var freeUsdText = freeUsd2 != null ?
            (freeUsd2 >= 1e6 ? '$' + (freeUsd2 / 1e6).toFixed(0) + 'M' : '$' + (freeUsd2 / 1e3).toFixed(0) + 'K') : '?';
        var intervalText = paymentInterval != null ? paymentInterval.toFixed(0) + '-day' : 'multi-week';
        var monthlyInflow = lb.payment_ladder && lb.payment_ladder.totals && lb.payment_ladder.totals.expected_inflow_30d_usd;
        var inflowFragment = (monthlyInflow != null) ?
            ' (interest-only ≈ <span class="font-mono">' + CommonRenderer.formatCurrency(monthlyInflow) + '/30d</span>)' : '';

        html += '<div class="text-sm font-semibold text-slate-700 mt-4 mb-1">Stress anchor</div>' +
            '<p class="text-sm text-slate-700">' +
                'Free liquidity (<span class="font-semibold">' + freePctText + '</span>, ' + freeUsdText + ') covers redemptions to ~<span class="font-semibold">' + freeUsdText + '</span> before queueing. ' +
                'Above that, exits depend on incoming loan repayments' + inflowFragment + '. ' +
                'Avg loan payment interval <span class="font-semibold">' + intervalText + '</span>; the pool has 24h notice + 48h grace to call a delinquent loan.' +
            '</p>' +
        '</div>';
        return html;
    },

    // ----- §6 Trust Stack (renamed from Governance + audit roll-up) -------
    _renderTrustStack: function(specific) {
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

        var govAddr = addrOf(g.governor);
        if (govAddr) {
            var govExtra = 'timelock';
            var hrs = g.timelock_hours;
            if (hrs === undefined && typeof g.governor === 'object' && g.governor.min_delay_s) {
                hrs = g.governor.min_delay_s / 3600;
            }
            if (hrs != null) govExtra += ' · min delay ' + hrs + 'h';
            rows.push(row('Governor', govAddr, govExtra));
        }
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
        var pdAddr = addrOf(g.pool_delegate);
        if (pdAddr) {
            // New analyzer schema: pool_delegate is an object {address,
            // firm_name, is_eoa}. Older snapshots used a string + sibling
            // pool_delegate_firm/_is_eoa fields — keep both paths working.
            var pdObj = (typeof g.pool_delegate === 'object' && g.pool_delegate) ? g.pool_delegate : null;
            var firm = (pdObj && (pdObj.firm_name || pdObj.firm)) || g.pool_delegate_firm || null;
            var isEoa = (pdObj && 'is_eoa' in pdObj) ? pdObj.is_eoa :
                        (g.pool_delegate_is_eoa !== undefined ? g.pool_delegate_is_eoa :
                         (pdObj && pdObj.type === 'eoa'));
            var pdExtra = firm || '—';
            if (isEoa) pdExtra += ' · <span class="text-slate-500">MPC + policy (per Maple)</span>';
            rows.push(row('Pool Delegate', pdAddr, pdExtra));
        }
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

        // ---- Maple-controlled MPC topology — surfaces the full set of
        // EOA-shaped addresses (eth_getCode == 0x) that hold real capital.
        // Per Maple's 2026-05-04 attestation, all such addresses are MPC
        // wallets with strict policy controls under Maple Labs operational
        // control — institutional-grade custody primitive, NOT single-key.
        // Pool Delegate is already in the table above; the "custody"
        // entries here are the liquidity-layer custodians the analyzer
        // enumerates separately. Hidden when custody_topology is empty.
        var ct = g.custody_topology || {};
        var custodyEntries = (ct.entries || []).filter(function(e) {
            return e && e.is_eoa && e.control_type === 'custody';
        });
        var topologyBlock = '';
        if (ct.single_key_eoa_count != null && ct.single_key_eoa_count > 0) {
            var topologyHeader =
                '<div class="text-sm font-semibold text-slate-700 mt-4 mb-1">' +
                    'Maple-controlled MPC topology' +
                    ' <span class="text-xs font-normal text-slate-500">— ' +
                        ct.single_key_eoa_count + ' MPC wallet' + (ct.single_key_eoa_count === 1 ? '' : 's') +
                        ' control ' +
                        CommonRenderer.formatCurrency(ct.total_capital_under_eoa_control_usd || 0) +
                        ' of pool capital' +
                    '</span>' +
                '</div>';
            var topologyRows = custodyEntries.map(function(e) {
                var addr = e.address || '';
                var addrCell = '<span class="font-mono text-xs" title="' + addr + '">' + SyrupUSDCRenderer._truncAddr(addr) + '</span> ' + SyrupUSDCRenderer._ethLink(addr);
                var capUsd = e.capital_under_control_usd || e.loan_book_principal_usd || 0;
                var note = '<span class="text-slate-600">MPC + policy (per Maple)</span> · holds ' + CommonRenderer.formatCurrency(capUsd);
                if (e.venue) note += ' · ' + e.venue;
                if (e.chain && e.chain !== 'ethereum') note += ' · ' + e.chain.charAt(0).toUpperCase() + e.chain.slice(1);
                return '<tr>' +
                    '<td class="font-medium">' + (e.role || 'Custody') + '</td>' +
                    '<td>' + addrCell + '</td>' +
                    '<td class="text-xs text-slate-500">' + note + '</td>' +
                '</tr>';
            }).join('');
            // Methodology footer — institutional-grade custody primitive
            // is Maple's off-chain attestation; on-chain reads can't
            // independently verify MPC vs single-key.
            var topologyFooter =
                '<div class="text-xs text-slate-400 italic mt-2 leading-relaxed">' +
                    'ⓘ Per Maple\'s response 2026-05-04: these are MPC wallets with strict policy controls. ' +
                    'On-chain reads cannot independently verify MPC vs single-key (both produce standard Ethereum signatures off-chain) — ' +
                    '<span class="font-mono">eth_getCode == 0x</span> rules out smart-contract multi-sigs but the MPC + policy claim is Maple\'s off-chain attestation.' +
                '</div>';
            topologyBlock = topologyHeader +
                (topologyRows ?
                    '<table class="data-table"><tbody>' + topologyRows + '</tbody></table>' + topologyFooter :
                    '<div class="text-xs text-slate-400 italic">No additional custody addresses at this snapshot.</div>');
        }

        var auditLine =
            '<div class="text-sm text-slate-600 mt-3 pt-3 border-t border-slate-200">' +
                'Audits: <strong>' + SYRUP_AUDIT_INFO.primary_audits + '</strong> + ' + SYRUP_AUDIT_INFO.other_audits_count + ' others (' + SYRUP_AUDIT_INFO.total_audits + ' total) · ' +
                'Bug bounty: <strong>' + SYRUP_AUDIT_INFO.bug_bounty + '</strong>' +
            '</div>';

        return '<div class="panel">' +
            '<div class="panel-title">Trust Stack</div>' +
            '<table class="data-table"><thead><tr><th>Role</th><th>Address</th><th>Notes</th></tr></thead><tbody>' + rows.join('') + '</tbody></table>' +
            topologyBlock +
            lastTx +
            auditLine +
        '</div>';
    },

    // ----- §7 Yield (demoted) ---------------------------------------------
    // PegTracker now sources yield live from Maple's syrupGlobals.apyTimeSeries
    // (headline_apy_source: "syrup_graphql"). core_apy_pct = organic loan
    // interest; boost_apy_pct = SYRUP-token Drips boost (0 since campaign ended
    // Feb 2026, but live-sourced so a future Season 2 would render correctly).
    _renderYield: function(specific) {
        var y = specific.yield;
        if (!y) return '';
        // Prefer live core/headline; fall back to base_apy_pct for older snapshots.
        var liveApy = y.core_apy_pct;
        if (liveApy == null) liveApy = y.headline_apy_pct;
        if (liveApy == null) liveApy = y.base_apy_pct;
        var boost = (y.boost_apy_pct != null) ? y.boost_apy_pct : 0;
        var fee = y.delegate_fee_pct;
        var isLiveSource = y.headline_apy_source === 'syrup_graphql';

        var maxApy = Math.max((liveApy || 0) + (boost || 0), 1) * 1.2;
        function bar(val, color, label, tag) {
            if (val === null || val === undefined) return '';
            var pct = Math.max(0, Math.min(100, val / maxApy * 100));
            return '<div class="mb-2">' +
                '<div class="flex justify-between text-sm mb-1">' +
                    '<span class="text-slate-700 font-semibold">' + label + (tag ? ' <span class="text-xs text-slate-400 font-normal">(' + tag + ')</span>' : '') + '</span>' +
                    '<span class="font-mono font-semibold text-slate-700">' + CommonRenderer.formatPercent(val, 2) + '</span>' +
                '</div>' +
                '<div class="pct-bar-container"><div class="pct-bar" style="width:' + pct + '%; background:' + color + '"></div></div>' +
            '</div>';
        }

        // Drips boost: render as a regular secondary bar when > 0 (future
        // campaign), otherwise as a small gray zero-line with historical note.
        var boostBlock;
        if (boost > 0) {
            boostBlock = '<div class="mt-3 pt-3 border-t border-slate-200">' +
                bar(boost, '#a855f7', 'Drips boost', 'SYRUP token, live') +
            '</div>';
        } else {
            boostBlock = '<div class="mt-3 pt-3 border-t border-slate-200">' +
                '<div class="flex justify-between text-xs text-slate-400 mb-1">' +
                    '<span>Drips boost <span class="text-slate-400">(SYRUP token campaign — ended Feb 2026)</span></span>' +
                    '<span class="font-mono">' + CommonRenderer.formatPercent(boost, 2) + '</span>' +
                '</div>' +
                '<div class="pct-bar-container"><div class="pct-bar" style="width:0%; background:#cbd5e1"></div></div>' +
            '</div>';
        }

        // "as of" timestamp + source tag — small footer line.
        var sourceLine = '';
        if (isLiveSource) {
            var asOfText = '';
            if (y.apy_as_of) {
                var d = new Date(y.apy_as_of * 1000);
                if (!isNaN(d.getTime())) asOfText = ' · as of ' + d.toISOString().slice(0, 10);
            }
            sourceLine = '<div class="text-xs text-slate-400 mt-1">Source: <span class="font-mono">syrupGlobals.apyTimeSeries</span> (Maple GraphQL)' + asOfText + '</div>';
        }

        return '<div class="panel">' +
            '<div class="panel-title">Yield Decomposition</div>' +
            '<p class="text-sm text-slate-500 mb-3">Live APY is the organic loan-interest stream — the durable yield depositors receive going forward.</p>' +
            bar(liveApy, '#22c55e', 'Live APY', 'organic loan interest') +
            boostBlock +
            (fee != null ? '<div class="text-sm text-slate-500 mt-3">Pool Delegate management fee: <span class="font-mono font-semibold">' + CommonRenderer.formatPercent(fee, 2) + '</span> taken from gross before share-holders.</div>' : '') +
            (y.apr_24h_pct != null ? '<div class="text-xs text-slate-400 mt-1">24h realised APR (NAV): ' + CommonRenderer.formatPercent(y.apr_24h_pct, 2) + ' — trailing window, can be noisy</div>' : '') +
            sourceLine +
        '</div>';
    },

    // ----- Multi-Chain Distribution (Phase 1: per-chain token supply) -----
    // Backward-compat: schema_version < 2 OR multi_chain.deferred === true
    // (the pre-Phase-1 stub) falls through to a placeholder card so the
    // brief deploy window between analyzer push + cron regenerating JSON
    // doesn't visibly regress.
    _renderMultiChain: function(specific, slug) {
        var mc = specific.multi_chain;
        if (!mc || mc.deferred || !Array.isArray(mc.chains) || mc.chains.length === 0) {
            return SyrupUSDCRenderer._renderMultiChainPlaceholder(slug);
        }

        var isUSDT = slug === 'syrupusdt';
        var chains = mc.chains;  // already sorted desc by share_pct per analyzer contract
        var totalSupply = mc.total_supply_usd_across_chains;

        var rowsHtml = chains.map(function(c) { return SyrupUSDCRenderer._renderChainRow(c); }).join('');

        // Total row — share column locked to 100% (per-chain shares sum to it
        // by construction; reconciliation pct is shown separately below).
        var totalRow =
            '<tr class="font-bold border-t-2 border-slate-200">' +
                '<td>Total</td>' +
                '<td class="text-right font-mono">' + (totalSupply != null ? CommonRenderer.formatCurrency(totalSupply) : '-') + '</td>' +
                '<td class="text-right font-mono">100%</td>' +
                '<td colspan="3"></td>' +
            '</tr>';

        var subheader;
        if (isUSDT) {
            subheader = 'syrupUSDT is currently Ethereum-only. CCIP+CCT cross-chain ' +
                       'expansion is planned but not yet deployed.';
        } else {
            var nonStub = chains.filter(function(c) { return c.kind !== 'stub'; }).length;
            subheader = 'syrupUSDC is deployed natively on ' + nonStub + ' chains via Chainlink CCIP+CCT ' +
                       '(burn-and-mint). Per-chain supply via direct token-contract reads. DEX depth ' +
                       'per chain is Phase 2 — for now, only Ethereum has aggregator-route slippage ' +
                       'data (see Liquidity &amp; Peg panel above).';
        }

        var recon = SyrupUSDCRenderer._reconciliationLine(mc.cross_chain_supply_reconciliation_pct);

        var emptyStateFooter = '';
        if (isUSDT) {
            emptyStateFooter =
                '<div class="text-xs text-slate-500 mt-3 italic">' +
                    'syrupUSDT has limited cross-chain footprint vs syrupUSDC. ' +
                    'Other-chain deployments not yet tracked.' +
                '</div>';
        }

        return '<div class="panel">' +
            '<div class="panel-title">Multi-Chain Distribution</div>' +
            '<div class="text-xs text-slate-500 mb-3">' + subheader + '</div>' +
            '<table class="data-table">' +
                '<thead><tr>' +
                    '<th>Chain</th>' +
                    '<th class="text-right">Supply</th>' +
                    '<th class="text-right">Share</th>' +
                    '<th>Kind</th>' +
                    '<th>Token Address</th>' +
                    '<th>Source</th>' +
                '</tr></thead>' +
                '<tbody>' + rowsHtml + totalRow + '</tbody>' +
            '</table>' +
            recon +
            emptyStateFooter +
        '</div>';
    },

    // Per-chain explorer base URLs. Plasma intentionally omitted — the
    // Phase-1 stub has no token address to link to; Phase-2 wires this up.
    _CHAIN_EXPLORERS: {
        ethereum: { name: 'Ethereum', base: 'https://etherscan.io/address/' },
        arbitrum: { name: 'Arbitrum', base: 'https://arbiscan.io/address/' },
        base:     { name: 'Base',     base: 'https://basescan.org/address/' },
        solana:   { name: 'Solana',   base: 'https://solscan.io/token/' },
        plasma:   { name: 'Plasma',   base: null }
    },

    _renderChainRow: function(c) {
        var meta = SyrupUSDCRenderer._CHAIN_EXPLORERS[c.chain] || { name: c.chain, base: null };
        var displayName = meta.name || (c.chain.charAt(0).toUpperCase() + c.chain.slice(1));
        var isStub = c.kind === 'stub' || c.data_source === 'stub';
        var rowClass = isStub ? ' class="text-slate-400 italic"' : '';

        // Supply / share — stub rows render '~' prefix to telegraph estimate.
        var supplyCell, shareCell;
        if (isStub) {
            supplyCell = c.supply_usd != null ? '~' + CommonRenderer.formatCurrency(c.supply_usd) : '—';
            shareCell  = c.share_pct  != null ? '~' + CommonRenderer.formatPercent(c.share_pct, 1) : '—';
        } else {
            supplyCell = c.supply_usd != null ? CommonRenderer.formatCurrency(c.supply_usd) : '-';
            shareCell  = c.share_pct  != null ? CommonRenderer.formatPercent(c.share_pct, 1) : '-';
        }

        var kindLabel = ({ evm: 'EVM', solana: 'Solana', stub: 'stub' })[c.kind] || c.kind || '-';

        var addrCell;
        if (isStub || !c.token_address) {
            addrCell = isStub ? 'n/a' : '—';
        } else {
            var truncated = SyrupUSDCRenderer._truncAddr(c.token_address);
            if (meta.base) {
                addrCell = '<span class="font-mono text-xs">' + truncated + '</span>' +
                    ' <a href="' + meta.base + c.token_address + '" target="_blank" ' +
                    'class="text-blue-500 hover:underline text-xs" title="' + c.token_address + '">↗</a>';
            } else {
                addrCell = '<span class="font-mono text-xs">' + truncated + '</span>';
            }
        }

        var sourceCell = isStub ? 'Phase 2 stub' :
                         c.data_source === 'on_chain_token_supply' ? 'on-chain' :
                         (c.data_source || '—');

        return '<tr' + rowClass + '>' +
            '<td class="font-medium">' + displayName + '</td>' +
            '<td class="text-right font-mono">' + supplyCell + '</td>' +
            '<td class="text-right font-mono">' + shareCell + '</td>' +
            '<td class="text-xs">' + kindLabel + '</td>' +
            '<td>' + addrCell + '</td>' +
            '<td class="text-xs">' + sourceCell + '</td>' +
        '</tr>';
    },

    // Reconciliation badge — color-coded against the analyzer's 98–102%
    // tolerance band. Outside that, the analyzer also fires a risk flag
    // (already surfaced in §Risk Flags), so this is a passive readout.
    _reconciliationLine: function(pct) {
        if (pct == null) return '';
        var cls, label;
        if (pct >= 99 && pct <= 101) {
            cls = 'text-green-600';
            label = '(per-chain supplies match canonical Pool total)';
        } else if ((pct >= 98 && pct < 99) || (pct > 101 && pct <= 102)) {
            cls = 'text-amber-600';
            label = '(minor drift — possibly CCT bridge messages in flight)';
        } else {
            cls = 'text-red-600 font-semibold';
            label = '(material drift — bridge-in-flight or analyzer issue; see Risk Flags)';
        }
        return '<div class="text-xs mt-3">' +
            '<span class="text-slate-500">Reconciliation: </span>' +
            '<span class="' + cls + ' font-mono">' + CommonRenderer.formatPercent(pct, 1) + '</span> ' +
            '<span class="text-slate-500">' + label + '</span>' +
        '</div>';
    },

    _renderMultiChainPlaceholder: function(slug) {
        var note = slug === 'syrupusdt'
            ? 'Multi-chain tracking is rolling out — current snapshot pre-dates the Phase-1 schema bump.'
            : 'Multi-chain tracking is rolling out — current snapshot pre-dates the Phase-1 schema bump. ' +
              'syrupUSDC is deployed on Ethereum, Solana, Arbitrum, Base, and Plasma via CCIP+CCT.';
        return '<div class="panel">' +
            '<div class="panel-title">Multi-Chain Distribution</div>' +
            '<div class="text-sm text-slate-500">' + note + '</div>' +
        '</div>';
    }
};
