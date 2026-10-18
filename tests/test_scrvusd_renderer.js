// Wrapper invariants: never turn custody, NAV, or an owner limit into dollar solvency/depth.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ctx=vm.createContext({document:{getElementById:()=>null},console});
vm.runInContext(fs.readFileSync('js/renderers/common.js','utf8')+'\nthis.common=CommonRenderer;',ctx);
vm.runInContext(fs.readFileSync('js/renderers/scrvusd.js','utf8'),ctx);
const r=ctx.ScrvUSDRenderer,c=ctx.common;
const detail={schema_version:'scrvusd-detail/1',as_of:'2026-10-17T09:00:00Z',block:1,
 nav_crvusd:1.1,nav_usd:1.045,effective_supply_shares:90,
 accounting:{status:'reconciled',custody_crvusd:100,idle_crvusd:100,strategy_debt_crvusd:0,total_assets_crvusd:100},
 parent:{price_usd:0.95,source:'parent',as_of:'2026-10-17T08:30:00Z'},yield_data:{status:'ok',projected_apy_pct:2.59},
 rewards:{pending_crvusd:5},controls:{clone_matches_fixed_target:true,isShutdown:true,queue:[],unestablished:['Delegates not enumerated']},
 events:{complete:false},exits:{primary:{rungs:[{target_crvusd:100000,input_shares:90909,output_crvusd:100000,status:'ok'},
 {target_crvusd:1000000,input_shares:909090,status:'failed'}]},underlying:{rungs:[{input_crvusd:1000000,usdc_out:998000,combined_tested:false,status:'ok'}]}}};
const d={summary:{total_backing:100,collateral_ratio:100},peg:{nav:1.045},backing:{collateral_ratio:100,total_backing:100},
 asset_specific:{scrvusd:detail},dependencies:{downstream_tracked:false}};
r.preRender(d);
assert.equal(d.backing.collateral_ratio,null);
assert.equal(d.summary.collateral_ratio,null);
assert.equal(d.backing_breakdown.length,0);
assert.equal(d.peg.nav,1.045);
assert.equal(c.pegRating(d,{entries:[]}),null);
assert.match(r.accounting(detail),/does not establish dollar solvency/);
assert.doesNotMatch(r.accounting(detail),/100% (?:dollar|backed|coverage)/);
assert.match(r.controls(detail),/deposits disabled; withdrawals separately tested/);
assert.match(r.exit(detail),/passed through 100,000 crvUSD/);
assert.doesNotMatch(r.exit(detail),/passed through 1,000,000/);
assert.match(r.exit(detail),/Underlying quote only/);
assert.match(r.nav(detail),/not established within the scanned window/);
assert.match(r.historyPanel({entries:[]}),/Insufficient forward observations/);
assert.match(r.controls({...detail,controls:{...detail.controls,role_manager:'<img src=x onerror=alert(1)>'}}),/&lt;img/);
assert.doesNotMatch(r.controls({...detail,controls:{...detail.controls,role_manager:'<img src=x>'}}),/<img/);
const authored={asset_slug:'scrvusd',peg:{},backing:{collateral_ratio:null,collateral_ratio_basis:'No independent dollar CR'},liquidity:{derived_score_status:'not_computed'},dependencies:{},contract:{},issuer:{}};
c.mergeAxisOverlays(authored,[{axis:'backing',file:'candidate_axis_basis.json',json:{schema_version:'axis-basis/1',asset:'scrvusd',producer:'riskanalyst',backing:{backing_score:5,backing_score_applies_when:'collateral_ratio_declared_underivable',backing_score_source:'riskAnalyst:authored',backing_score_basis:'Pure wrapper; inherited parent risk'}}}],'scrvusd');
assert.equal(c._backingAuthoredDeclared(authored.backing),true);
assert.equal(authored.backing.collateral_ratio,null);
console.log('scrvUSD NAV, custody, scores, shutdown, owner-scope and escaping checks passed');
assert.match(r.market({status:'ok',market_price:1.11,nav:1.10}),/0\.9091/);
assert.match(r.market({status:'ok',market_price:1.09,nav:1.10}),/-0\.9091/);
assert.match(r.market({status:'comparison_withheld',market_price:null,comparison_withheld_reasons:['stale quote']}),/unavailable: stale quote/);
assert.match(r.market({}),/Market comparison unavailable/);
assert.match(r.market({status:'ok',market_price:1.11,nav:1.10}),/parent feed does not publish the price observation time/);
assert.equal(d.peg.chart_strict_window,true);

const failedQuotes={...detail,exits:{primary:{rungs:[]},underlying:{rungs:[{input_crvusd:1000,usdc_out:999,status:'failed',combined_tested:true}]}}};
assert.match(r.exit(failedQuotes),/Quote unavailable/);
assert.doesNotMatch(r.exit(failedQuotes),/999 USDC|Both legs observed separately/);
const insufficient={...detail,exits:{...detail.exits,primary:{owner_share_balance:100000,rungs:detail.exits.primary.rungs}}};
assert.match(r.exit(insufficient),/Failed: test owner has insufficient shares/);
assert.match(r.accounting(detail),/Custody and accounting observed at/);
assert.match(r.exit(detail),/USDC is counted at \$1/);
