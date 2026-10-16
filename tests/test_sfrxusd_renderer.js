// Consumer invariants: price units, issuer accounting and separate exit legs.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({document:{getElementById:()=>null},console});
vm.runInContext(fs.readFileSync('js/renderers/common.js','utf8')+'\nthis.common = CommonRenderer;',context);
vm.runInContext(fs.readFileSync('js/renderers/sfrxusd.js','utf8'),context);
const renderer = context.SfrxUSDRenderer;
const data = {peg:{nav:1.2},backing:{collateral_ratio:100.14,collateral_ratio_scale:'percent',
    assets_usd:38130000,liabilities_usd:38076000,surplus_usd:54000,
    independent_coverage_pct:null,breakdown:[{label:'Claims',value_usd:38130000,share_pct:100}]},
    asset_specific:{sfrxusd:{primary_exit:{status:'legs_simulate_settlement_untested',status_basis:'No completed delivery'}}},
    dependencies:{downstream_tracked:['sample']}};
const history = {observations:[{price:1.19,theoretical_price:1.2},{price:1.20,theoretical_price:1.21}]};
renderer.preRender(data,history);
assert.equal(data.peg.nav,1.2);
assert.equal(data.peg.chart_reference_field,'theoretical_price');
assert.equal(history.observations[0][data.peg.chart_reference_field],1.2);
assert.equal(history.observations[1][data.peg.chart_reference_field],1.21);
assert.equal(data.backing.collateral_ratio,100.14);
assert.equal(data.backing.independent_coverage_pct,null);
assert.equal(data.backing.total_liabilities,38076000);
assert.equal(data.backing_breakdown[0].pct,100);
assert.equal(data.liquidity.primary_redemption_depth_status,'legs_simulate_settlement_untested');
assert.match(renderer.pricing({frxusd_held_by_token:{value:0}}),/>0 frxUSD/);
assert.match(renderer.primary(null),/not integrated/);
assert.match(renderer.accounting(null),/not published/);
assert.match(renderer.ownership({pools:[{name:'<img src=x>',pool_role:'venue',named_holders_pct_of_lp_supply:null}]}),/not measured/);
assert.doesNotMatch(renderer.ownership({pools:[{name:'<img src=x>',pool_role:'venue'}]}),/<img/);
const app=fs.readFileSync('js/app.js','utf8');
vm.runInContext(app.slice(app.indexOf('function exitLadderOverlay('),app.indexOf('function backingVerificationOverlay(')),context);
const ladder={asset_slug:'sfrxusd',producer:'PegTracker',measured_at:'2026-10-16T03:00:00Z',sell_into:'USDC',
    rungs:[{status:'ok',size_usd:1000,input_amount:800,output_usdc:999,size_impact_bps:2}],
    headline:{value_usd:2801000,threshold_bps:50,bracket_usd:[2801000,3000000]},
    diagnostics:{curve_research_route:{rows:[{output_frxusd:1001,output_usdt:998}]}},
    nonmonotonic_output_warning:{message:'Nonmonotonic outputs'}};
const overlay=context.exitLadderOverlay('sfrxusd_exit_ladder.json',ladder);
const merged={asset_slug:'sfrxusd',peg:{},liquidity:{}};
context.common.mergeAxisOverlays(merged,[overlay,{axis:'liquidity',file:'sfrxusd_liquidity.json',json:{
    schema_version:'liquidity/1',asset_slug:'sfrxusd',producer:'DexTracker',as_of:'2026-10-16T03:01:00Z',
    scope:'venue_inventory_only',does_not_publish:['depth','primary_exit','rating'],venues:[],
    lp_ownership:{pools:[{name:'Treasury pool',named_holders_pct_of_lp_supply:99.99}]}
}}],'sfrxusd');
assert.equal(merged.liquidity.exit_mark.quotes['1000'].input_amount,800);
assert.equal(merged.liquidity.exit_mark.quotes['1000'].output_amount,999);
assert.equal(merged.liquidity.exit_mark.source_observation.diagnostics.curve_research_route.rows[0].output_frxusd,1001);
assert.equal(merged.liquidity.lp_ownership.pools[0].named_holders_pct_of_lp_supply,99.99);
assert.match(renderer.ladder(merged.liquidity.exit_mark.source_observation),/Nonmonotonic outputs/);
console.log('sfrxUSD consumer invariants passed');
