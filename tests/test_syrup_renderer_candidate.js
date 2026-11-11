// Run against an isolated renderer before promoting its staging artifact.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
if(!process.argv[2])throw new Error('Usage: node tests/test_syrup_renderer_candidate.js <candidate-renderer.js>');
const c={console,window:{}};vm.createContext(c);
vm.runInContext(fs.readFileSync('js/renderers/common.js','utf8')+'\nglobalThis.common=CommonRenderer',c);
vm.runInContext(fs.readFileSync(process.argv[2],'utf8')+'\nglobalThis.syrup=SyrupUSDCRenderer',c);
for(const slug of ['syrupusdc','syrupusdt']){
 const data={asset_slug:slug,asset_specific:{type:slug,vault_state:{total_assets:1000000}},summary:{collateral_ratio:100,surplus_deficit:0},backing:{collateral_ratio:100,backing_score:5.5,backing_score_display:'authored'}};
 c.syrup.preRender(data);
 assert.match(data.backing.coverage_display_label,/Reported NAV/);
 assert.doesNotMatch(data.backing.coverage_display_label,/unverified/i);
 assert.equal(data.backing.collateral_ratio,null);assert.equal(data.summary.collateral_ratio,null);
 assert.equal(data.backing.backing_score,5.5);assert(c.common._backingAuthoredDeclared(data.backing));
 assert.equal(data.asset_specific.vault_state.total_assets,1000000);
}
function qualifies(level,status='source_model_only'){
 return c.syrup._collateralUncorroborated({is_in_default:true,collateral:{current_level_pct:level,valuation_coverage_status:status,read_corroborated:null}},1);
}
assert.equal(qualifies(50),true);
assert.equal(qualifies(150),false); // Unverified is not synonymous with below par.
assert.equal(qualifies(null,'missing'),false); // Missing is not a measured shortfall.
assert.equal(qualifies(50,'independently_verified'),false);
console.log('PASS staged NAV/authoring separation and below-par versus missing/unverified classification.');
