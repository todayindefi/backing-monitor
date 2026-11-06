const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const elements = {};
const ctx = vm.createContext({console, window:{}, document:{
    getElementById:id=>elements[id] || null,
    createElement:()=>({innerHTML:'',className:''}),
    querySelectorAll:()=>[]
}});
vm.runInContext(fs.readFileSync(process.env.COMMON_RENDERER || 'js/renderers/common.js','utf8')+'\nthis.r=CommonRenderer;',ctx);
const r=ctx.r;
function merged(slug) {
    const d=JSON.parse(fs.readFileSync('data/'+slug+'_backing.json'));
    const l=JSON.parse(fs.readFileSync('data/'+slug+'_liquidity.json'));
    r.mergeAxisOverlays(d,[{axis:'liquidity',file:slug+'_liquidity.json',json:l}],slug);
    return d;
}
const senior=merged('reusd_re');
assert.equal(senior.liquidity.total_2pct_depth == null,true,'Explicit cross-chain scalar refusal must not inherit base aggregate');
assert.equal(senior.liquidity.depth.denomination_scope.reduction_policy,'refuse_cross_chain_scalar');
assert.ok(senior.liquidity.depth.per_chain.ethereum,'Keep measured chain-local evidence');
assert.ok(senior.liquidity.primary_exit,'Keep eligibility/primary limitations');
const chainHtml=r.depthScopeHtml(senior);
assert.match(chainHtml,/Chain-local secondary exits/);
assert.match(chainHtml,/coarse bracket/);
assert.match(chainHtml,/do not add them together/);
const mezz=merged('reusde_re');
assert.equal(senior.liquidity.enumeration.as_of,senior.liquidity.venue_census.enumeration.as_of,'Selected current census must own inventory clock');
assert.notEqual(senior.liquidity.historical_enumeration.as_of,senior.liquidity.enumeration.as_of);
assert.equal(mezz.liquidity.depth.preflight.status,'usd_valuation_not_assessed');
assert.equal(r._executionCostBps(mezz.liquidity),null);
assert.match(r.depthScopeHtml(mezz),/Native-token quote observations/);
assert.match(r.depthScopeHtml(mezz),/not USD proceeds/);
assert.equal(mezz.liquidity.exit_mark?.quotes,undefined);
// A producer validation failure must also remain rejected for older payloads.
const rejected={depth:{preflight:{passed:false},rungs:[{size_usd:1000,status:'ok',amount_out_usd:185,slippage_bps:-8144}]}};
r._adaptSchema('liquidity','liquidity/1',rejected);
assert.equal(rejected.two_pct_depth_status,'invalid_quote');
assert.equal(rejected.exit_mark.quotes['1000'].output_usd,undefined);
assert.ok(rejected.exit_mark.quotes['1000'].error);
if (mezz.liquidity.depth.preflight?.passed === false) {
    assert.equal(mezz.liquidity.two_pct_depth_status,'invalid_quote');
    assert.equal(r._executionCostBps(mezz.liquidity),null,'Rejected quote must not become standing cash cost');
    for(const rung of Object.values(mezz.liquidity.exit_mark.quotes)) {
        assert.ok(rung.error);
        assert.equal(rung.slippage_bps,undefined);
        assert.equal(rung.output_usd,undefined);
    }
}
assert.ok(mezz.liquidity.primary_exit.latest_announced_window,'Preserve documentary announcement separately');
// Generic backing integrity must not manufacture a Sky/sUSDS panel.
const slot={innerHTML:''};elements['backing-extra-panels']=slot;
const fn=Object.keys(r).find(k=>typeof r[k]==='function' && r[k].toString().includes('var hasUsdsEvidence'));
assert.ok(fn);
r[fn](senior);
assert.equal(slot.innerHTML,'');
const sky=JSON.parse(fs.readFileSync('data/susds_backing.json'));
r[fn](sky);
assert.match(slot.innerHTML,/sUSDS vault integrity/);
r[fn](senior);
assert.doesNotMatch(slot.innerHTML,/sUSDS vault integrity/);
let appended=[];elements['axis-backing-head']={appendChild:e=>appended.push(e)};
r._renderIssuerReportedReserves(mezz);
assert.match(appended[0].innerHTML,/one tranche/);
assert.doesNotMatch(appended[0].innerHTML,/misleadingly low/);
console.log('Re evidence: scalar scope refusal, failed-quote handling, primary terms and backing semantics passed');
