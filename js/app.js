/**
 * Backing Monitor - Main Application
 * Routes between index (asset grid) and asset detail views.
 */

var REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Asset-specific renderers registry
var ASSET_RENDERERS = {
    ousd:      typeof OUSDRenderer      !== 'undefined' ? OUSDRenderer      : null,
    frax:      typeof FRAXRenderer      !== 'undefined' ? FRAXRenderer      : null,
    crvusd:    typeof CrvUSDRenderer    !== 'undefined' ? CrvUSDRenderer    : null,
    usdd:      typeof USDDRenderer      !== 'undefined' ? USDDRenderer      : null,
    syrupusdc: typeof SyrupUSDCRenderer !== 'undefined' ? SyrupUSDCRenderer : null
};

function getAssetSlug() {
    var params = new URLSearchParams(window.location.search);
    return params.get('asset');
}

// ========================================
// Index view
// ========================================
async function renderIndex() {
    document.getElementById('index-view').classList.remove('hidden');
    document.getElementById('asset-view').classList.add('hidden');
    document.getElementById('error-view').classList.add('hidden');
    document.getElementById('header-subtitle').textContent = '';

    try {
        var resp = await fetch('data/assets.json');
        var assets = await resp.json();

        // Try to fetch latest data for each asset to show CR on cards
        var cardData = await Promise.all(assets.map(async function(a) {
            try {
                var r = await fetch('data/' + a.slug + '_backing.json');
                var d = await r.json();
                return { asset: a, data: d };
            } catch (e) {
                return { asset: a, data: null };
            }
        }));

        var grid = document.getElementById('asset-grid');
        grid.innerHTML = cardData.map(function(item) {
            var a = item.asset;
            var d = item.data;
            var cr = d ? CommonRenderer.formatPercent(d.summary.collateral_ratio) : '-';
            var crClass = d && d.summary.collateral_ratio >= 100 ? 'text-green-600' : 'text-red-600';
            var supply = d ? CommonRenderer.formatCurrency(d.summary.total_supply) : '-';
            var ts = d ? CommonRenderer.formatDate(d.timestamp) : '';
            var flagCount = d ? d.risk_flags.length : 0;
            var flagBadge = flagCount > 0 ?
                '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">' + flagCount + ' flag' + (flagCount > 1 ? 's' : '') + '</span>' : '';

            return '<a href="?asset=' + a.slug + '" class="asset-card block">' +
                '<div class="flex items-start justify-between mb-2">' +
                    '<div class="font-bold text-slate-800">' + a.name + '</div>' +
                    flagBadge +
                '</div>' +
                '<div class="text-xs text-slate-500 mb-3">' + a.chain + ' &middot; ' + a.description + '</div>' +
                '<div class="grid grid-cols-2 gap-3">' +
                    '<div><div class="text-xs text-slate-400 font-medium uppercase">CR</div><div class="text-lg font-bold ' + crClass + '">' + cr + '</div></div>' +
                    '<div><div class="text-xs text-slate-400 font-medium uppercase">Supply</div><div class="text-lg font-bold text-slate-700">' + supply + '</div></div>' +
                '</div>' +
                '<div class="text-xs text-slate-400 mt-3">' + ts + '</div>' +
                '</a>';
        }).join('');

    } catch (e) {
        showError('Could not load asset list: ' + e.message);
    }
}

// ========================================
// Asset detail view
// ========================================
async function renderAsset(slug) {
    document.getElementById('index-view').classList.add('hidden');
    document.getElementById('asset-view').classList.remove('hidden');
    document.getElementById('error-view').classList.add('hidden');

    try {
        var [dataResp, histResp] = await Promise.all([
            fetch('data/' + slug + '_backing.json'),
            fetch('data/' + slug + '_backing_history.json').catch(function() { return null; })
        ]);

        if (!dataResp.ok) throw new Error('Asset data not found (HTTP ' + dataResp.status + ')');
        var data = await dataResp.json();
        var history = null;
        if (histResp && histResp.ok) {
            history = await histResp.json();
        }

        // Header
        document.getElementById('header-subtitle').textContent = data.asset + ' (' + data.chain + ')';
        document.getElementById('header-timestamp').textContent = 'Updated: ' + CommonRenderer.formatDate(data.timestamp);

        // Asset-specific pre-render hook — lets the renderer patch top-card
        // overrides (e.g. swap in init-level CR for syrupUSDC/USDT) before
        // the common summary-cards row paints.
        var preRenderer = ASSET_RENDERERS[data.asset_specific && data.asset_specific.type];
        if (preRenderer && typeof preRenderer.preRender === 'function') {
            preRenderer.preRender(data);
        }

        // Common sections
        CommonRenderer.renderSummaryCards(data);
        CommonRenderer.renderRiskFlags(data);
        var chartOpts = {};
        if (data.asset_specific) {
            var rawBands = data.asset_specific.chart_bands;
            if (rawBands) {
                // Two accepted shapes:
                //   verbose: {critical:[0,99], thin:[99,99.8], amber:[99.8,100], healthy:[100,101], min_line:99.8, max_line:100}
                //   short:   {pcr:[a,b,c,d]} or {thresholds:[a,b,c,d]}  → 4 ascending breakpoints
                var short = rawBands.pcr || rawBands.thresholds;
                if (Array.isArray(short) && short.length === 4) {
                    var a = short[0], b = short[1], c = short[2], d = short[3];
                    chartOpts.bands = {
                        critical: [0, a],
                        thin: [a, b],
                        amber: [b, c],
                        healthy: [c, d],
                        min_line: b,
                        max_line: c
                    };
                    if (chartOpts.y_min === undefined) chartOpts.y_min = a;
                    if (chartOpts.y_max === undefined) chartOpts.y_max = d;
                    // The `pcr` key is the implicit signal for Pool Coverage Ratio framing.
                    if (rawBands.pcr) {
                        chartOpts.title = chartOpts.title || 'Pool Coverage Ratio — 30d';
                        chartOpts.dataset_label = chartOpts.dataset_label || 'PCR';
                    }
                } else {
                    chartOpts.bands = rawBands;
                }
            }
            if (data.asset_specific.chart_title) chartOpts.title = data.asset_specific.chart_title;
            if (data.asset_specific.chart_dataset_label) chartOpts.dataset_label = data.asset_specific.chart_dataset_label;
            if (data.asset_specific.chart_y_min !== undefined) chartOpts.y_min = data.asset_specific.chart_y_min;
            if (data.asset_specific.chart_y_max !== undefined) chartOpts.y_max = data.asset_specific.chart_y_max;
        }
        // The alt CR is a USD value (e.g. Free Liquidity), not a percentage —
        // don't plot it on a % axis.
        if (data.summary && data.summary.collateral_ratio_alt && data.summary.collateral_ratio_alt.is_currency) {
            chartOpts.omit_alt = true;
        }
        CommonRenderer.renderCRChart(history, chartOpts);

        // Breakdown table + pie: skip for crvUSD (handled in asset-specific renderer)
        var assetType = data.asset_specific && data.asset_specific.type;
        if (assetType !== 'crvusd') {
            CommonRenderer.renderBreakdownTable(data);
            CommonRenderer.renderPieChart(data);
        } else {
            document.querySelector('#breakdown-table tbody').innerHTML = '';
            document.getElementById('pie-chart').parentElement.parentElement.style.display = 'none';
            // Also hide the empty breakdown panel
            document.getElementById('breakdown-table').closest('.panel').style.display = 'none';
        }

        // Asset-specific renderer
        var renderer = ASSET_RENDERERS[data.asset_specific && data.asset_specific.type];
        if (renderer) {
            renderer.render(data);
        } else {
            document.getElementById('asset-specific-panels').innerHTML = '';
        }

    } catch (e) {
        showError('Could not load ' + slug + ': ' + e.message);
    }
}

function showError(msg) {
    document.getElementById('index-view').classList.add('hidden');
    document.getElementById('asset-view').classList.add('hidden');
    document.getElementById('error-view').classList.remove('hidden');
    document.getElementById('error-message').textContent = msg;
}

// ========================================
// Init + auto-refresh
// ========================================
function route() {
    var slug = getAssetSlug();
    if (slug) {
        renderAsset(slug);
    } else {
        renderIndex();
    }
}

document.addEventListener('DOMContentLoaded', function() {
    route();
    setInterval(route, REFRESH_INTERVAL);
});
