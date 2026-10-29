const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx={console,window:{}};vm.createContext(ctx);
vm.runInContext(fs.readFileSync('js/renderers/common.js','utf8')+'\nglobalThis.common=CommonRenderer',ctx);
vm.runInContext(fs.readFileSync('js/renderers/syrupusdc.js','utf8')+'\nglobalThis.syrup=SyrupUSDCRenderer',ctx);
for(const c of [{},{read_corroboration_basis:'Issuer and GraphQL scopes disagree'}]){
 const t=ctx.syrup._uncorroboratedTitle(c);
 assert.doesNotMatch(t,/Treated as.*artifact|PCR authoritative|authoritative solvency/);
 assert.match(t,/unresolved|uncorroborated/);assert.match(t,/accounting PCR/);
}
const specific=JSON.parse(fs.readFileSync('specs/reviews/syrupusdc-source-refresh-2026-10-29/before/data__syrupusdc_backing.json')).asset_specific;
const html=ctx.syrup._renderLBH_buffer(specific.loan_book,0);
assert.doesNotMatch(html,/Treated as.*artifact|treat as.*artifact|authoritative solvency|Tightest verifiable/);
assert.match(html,/neither a verified shortfall nor a safe recovery buffer/);
console.log('PASS uncorroborated low readings retain uncertainty without artifact/safety claims.');
const refreshed=JSON.parse(fs.readFileSync('data/syrupusdc_backing.json')).asset_specific;
const supply=ctx.syrup._renderMultiChain(refreshed,'syrupusdc');
assert.match(supply,/non-additive|includes bridge locks/);
assert.match(supply,/reconciliation.*incomplete/);
assert.doesNotMatch(supply,/deployed natively|>100%</);
const strategies=ctx.syrup._renderLiquidityLayer(refreshed,'syrupusdc');
assert.match(strategies,/Treasury strategy/);assert.match(strategies,/DEX LP strategy/);
assert.match(strategies,/not immediately withdrawable cash/);
assert.doesNotMatch(strategies,/Parked reserve|T\+0|T\+1/);
// Same token symbol must not collapse distinct reviewed economic roles.
const mixed=structuredClone(refreshed);
for(const row of mixed.loan_book.loans)if(row.position_type==='liquidity')row.collateral.asset='PYUSD';
const mixedHtml=ctx.syrup._renderLiquidityLayer(mixed,'syrupusdc');
assert.match(mixedHtml,/Treasury strategy/);assert.match(mixedHtml,/DEX LP strategy/);
assert.doesNotMatch(mixedHtml,/Parked reserve/);
