// Consumer contract checks; run with node tests/test_dola_renderer.js.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const slots = { 'backing-extra-panels': {}, 'liquidity-extra-panels': {} };
const context = vm.createContext({
    document: { getElementById: id => slots[id] || null },
    CommonRenderer: { _escapeAttr: value => String(value).replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]) }
});
vm.runInContext(fs.readFileSync('js/renderers/dola.js', 'utf8'), context);
const renderer = context.DOLARenderer;
renderer.render({});
assert.match(slots['backing-extra-panels'].innerHTML, /not published/);
assert.match(slots['liquidity-extra-panels'].innerHTML, /not integrated/);
renderer.render({ asset_specific: { dola: {
    schema_version: 'dola-detail/1',
    accounting: { coverage_status: 'unresolved', bad_debt_dola: null,
        markets: [{ name: '<script>alert(1)</script>', debt_dola: 0, debt_share_pct: null }] },
    psm: { reserve_symbol: 'USDS', reserves: 0, dola_inventory: 200000,
        sale_simulation_status: 'failed', basis: '<img src=x onerror=alert(1)>' },
    junior: { assets_sdola: 100, assets_dola_equivalent: 142,
        markets: [{ name: 'sample', status: 'pending', activation_at: '2030-01-01T00:00:00Z' }] }
} } });
assert.match(slots['liquidity-extra-panels'].innerHTML, /0 USDS/);
assert.match(slots['liquidity-extra-panels'].innerHTML, /200,000 DOLA/);
assert.match(slots['liquidity-extra-panels'].innerHTML, /Sale simulation: failed/);
assert.doesNotMatch(slots['liquidity-extra-panels'].innerHTML, /<img/);
assert.match(slots['backing-extra-panels'].innerHTML, /not measured/);
assert.match(slots['backing-extra-panels'].innerHTML, /100 sDOLA/);
assert.match(slots['backing-extra-panels'].innerHTML, /142 DOLA/);
assert.match(slots['backing-extra-panels'].innerHTML, /pending/);
assert.doesNotMatch(slots['backing-extra-panels'].innerHTML, /<script>/);
assert.doesNotMatch(renderer._number(Infinity, 'DOLA'), /Infinity/);
const app = fs.readFileSync('js/app.js', 'utf8');
vm.runInContext(app.slice(app.indexOf('function exitLadderOverlay('),
    app.indexOf('function backingVerificationOverlay(')), context);
const ladder = input => ({ asset_slug: 'dola', measured_at: '2026-10-14T00:00:00Z',
    rungs: [{ status: 'ok', size_usd: 100, output_usdc: 99, size_impact_bps: 10, ...input }] });
let overlay = context.exitLadderOverlay('dola_exit_ladder.json', ladder({ input_amount: 100 }));
assert.equal(overlay.json.exit_mark.quotes['100'].input_amount, 100);
assert.equal(overlay.json.exit_mark.quotes['100'].slippage_bps, -10);
overlay = context.exitLadderOverlay('frxusd_exit_ladder.json', ladder({ input_frxusd: 101 }));
assert.equal(overlay.json.exit_mark.quotes['100'].input_amount, 101);
vm.runInContext(fs.readFileSync('js/renderers/common.js', 'utf8') + '\nthis.common = CommonRenderer;', context);
const common = context.common;
const pathRows = common._divergentPathRows({ paths: [
    { name: 'Delayed mint', reach: 'full', execution_delay: '2d', timelock: 'none' },
    { name: 'Immediate bounded', reach: 'bounded', execution_delay: 'none' },
    { name: 'Unmeasured', reach: 'bounded' }
] }, value => common._escapeAttr(String(value)));
assert.match(pathRows, /tw-ok[^>]*">2d/);
assert.match(pathRows, /not measured/);
const metric = common._dependencyMetricHtml({ debt_dola: 1000, denominator: '<script>', as_of: '2026-10-14' });
assert.match(metric, /debt dola: 1,000/);
assert.match(metric, /as of: 2026-10-14/);
assert.doesNotMatch(metric, /\[object Object\]|<script>/);
assert.match(common._dependencyMetricHtml(0), />0</);
const plot = common._pegPlotRows([
    { timestamp: '2025-08-21T00:00:00Z', peg_market_price: 1 },
    { timestamp: '2026-10-14T00:00:00Z', peg_market_price: 0.997 }
], [{ from: '2025-08-21T00:00:00Z', to: '2026-10-14T00:00:00Z' }]);
assert.equal(plot.length, 3);
assert.equal(plot[1].peg_market_price, undefined);
assert.equal(plot[2].peg_market_price, 0.997);
const adapted = renderer.preRender({ asset_specific: { dola: { psm: {
    sale_simulation_status: 'reverts_reserves_empty', basis: 'Measured empty reserves'
} } } });
assert.equal(adapted.liquidity.primary_redemption_depth_status, 'reverts_reserves_empty');
assert.match(renderer._lookThrough({ component_clocks: { ethereum_supply_block_time: 'sample', ethereum_supply_block: 1 },
    lp_compositions: [{ name: 'DOLA/sUSDe', dola_amount: 10, pair_amount: 2, pair_symbol: 'sUSDe',
        pair_underlying_amount: 3, pair_underlying_symbol: 'USDe', basis: 'Token units, not USD' }] }), /Internal DOLA claim/);
console.log('DOLA consumer contract checks passed');
