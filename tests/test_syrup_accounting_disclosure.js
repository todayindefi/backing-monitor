const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const ctx = {console, window:{}}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync('js/renderers/common.js','utf8')+'\nglobalThis.common=CommonRenderer',ctx);
vm.runInContext(fs.readFileSync('js/renderers/syrupusdc.js','utf8')+'\nglobalThis.syrup=SyrupUSDCRenderer',ctx);
// The disclosure must run even when the optional initial-level ratio is absent.
for (const slug of ['syrupusdc','syrupusdt']) {
 const d={asset_slug:slug,asset_specific:{type:slug,vault_state:{total_assets:123,strategy_aum:100,free_usdc:23}},summary:{collateral_ratio:100,surplus_deficit:23},backing:{collateral_ratio:100,surplus_deficit:23}};
 ctx.syrup.preRender(d);
 assert.equal(d.backing.collateral_ratio,null);assert.equal(d.summary.collateral_ratio,null);
 assert.equal(d.backing.surplus_deficit,null);assert.equal(d.summary.surplus_deficit,null);
 assert.equal(d.asset_specific.vault_state.total_assets,123);
 assert.equal(d.asset_specific.card_overrides['Surplus / Deficit'].hidden,true);
 assert.equal(ctx.common.backingRating(d),null);
 assert.match(d.backing.collateral_ratio_basis,/not independently verified/);
}
// A protocol-flag concurrence does not independently corroborate collateral.
assert.equal(ctx.syrup._collateralUncorroborated({is_in_default:true,collateral:{valuation_coverage_status:'source_model_only',read_corroborated:null}},1),true);
assert.doesNotMatch(ctx.syrup._statusEmoji('healthy'),/🟢/);
assert.match(ctx.syrup._statusEmoji('healthy'),/payment receipt.*unverified/);
console.log('PASS Syrup accounting identities and protocol flags do not establish independent backing or servicing.');
