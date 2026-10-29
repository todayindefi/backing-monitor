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
