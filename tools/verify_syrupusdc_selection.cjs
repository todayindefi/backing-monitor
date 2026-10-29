const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const phase=process.argv[2]||'before';assert.ok(['before','after'].includes(phase));
const root=path.resolve(__dirname,'../specs/reviews/syrupusdc-source-refresh-2026-10-29',phase);
const read=n=>JSON.parse(fs.readFileSync(path.join(root,'data__'+n+'.json')));
const ctx={console,window:{}};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root,'js__renderers__common.js'),'utf8')+'\nglobalThis.c=CommonRenderer',ctx);
const base=read('syrupusdc_backing'),overlays=[];
for(const [axis,suffixes] of Object.entries(ctx.c.AXIS_OVERLAYS))for(const suffix of Array.isArray(suffixes)?suffixes:[suffixes]){
 const name='syrupusdc'+suffix;const file=path.join(root,'data__'+name+'.json');
 if(fs.existsSync(file))overlays.push({axis,file:'data/'+name+'.json',json:read(name)});
}
const merged=ctx.c.mergeAxisOverlays(base,overlays,'syrupusdc');
assert.equal(JSON.stringify(merged.liquidity.exit_mark),JSON.stringify(base.liquidity.exit_mark));
assert.equal(merged.peg.history_ref,'syrupusdc_backing_history.json');assert.equal(merged.peg.history_field,'peg_market_price');
const expected={peg:['volatility_score',8.5],backing:['backing_score',6.5],liquidity:['liquidity_score',7],dependencies:['underlying_score',5.5],contract:['structural_score',4.5],issuer:['issuer_score',5.5]};
for(const [axis,[key,value]] of Object.entries(expected))assert.equal(merged[axis][key],value,axis+' score changed');
console.log('PASS '+phase+': actual served merge retains canonical KyberSwap Ethereum/USDC market ladder, paired peg history and all six authored scores.');
console.log(JSON.stringify({phase,source_clock:base.timestamp,history_ref:merged.peg.history_ref,ladder_clock:merged.liquidity.exit_mark.timestamp,ladder_source:merged.liquidity.exit_mark.source,scores:Object.fromEntries(Object.entries(expected).map(([axis,[key]])=>[axis,merged[axis][key]]))},null,2));
