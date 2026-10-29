const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const root='specs/reviews/ethena-repair-verification-2026-10-29/';
const read=n=>JSON.parse(fs.readFileSync(root+'data__'+n+'.json'));
const ctx={console,window:{}};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(root+'js__renderers__common.js','utf8')+'\nglobalThis.common=CommonRenderer',ctx);
vm.runInContext(fs.readFileSync('js/renderers/ethena.js','utf8'),ctx);
const r=ctx.EthenaRenderer,family=read('ethena_family');
for(const slug of ['usde','susde']){
 const html=r._liveCoverageHtml(family,slug);
 assert.match(html,/issuer-reported/);assert.match(html,/101\.7467%/);assert.match(html,/100\.3806%/);
 assert.match(html,/05:59:28/);assert.match(html,/07:01:23/);assert.match(html,/Canonical supply/);
 assert.match(html,/Coverage denominator: issuer supply/);assert.match(html,/independent offchain custody.*unverified/);
 assert.doesNotMatch(html,/Live supply, backing coverage and Reserve Fund values are unavailable/);
}
const failed=structuredClone(family);failed.source_status.ethena_issuer='http_503';failed.source_metadata.backing.fetch_status='http_503';
assert.doesNotMatch(r._liveCoverageHtml(failed,'usde'),/101\.7467%|100\.3806%/);
const slots={};r._set=(id,html)=>{slots[id]=html};r._fillCustody(family);r._fillCex(family);
assert.match(slots['ethena-custody-panel'],/unknown/);assert.match(slots['ethena-cex-panel'],/unknown/);
assert.doesNotMatch(slots['ethena-custody-panel'],/100%|Total — LlamaRisk/);
const fee=r._renderMeasurementsPanel(read('usde_backing').asset_specific,'usde');
assert.match(fee,/insufficient_history/);assert.match(fee,/governance activation/);assert.doesNotMatch(fee,/Not met/);
for(const slug of ['usde','susde']){
 const h=read(slug+'_backing_history'),series=r._historySeriesWithBreaks(h,slug==='usde'?'total_backing':'total_assets_usde');
 assert.ok(series.some(p=>p.y===null),'acquisition/definition gap must break line');
 const last=series[series.length-1];assert.equal(+last.x,Date.parse(h.entries.at(-1).timestamp));
}
const base=read('susde_backing'),overlays=[];
for(const [axis,ss] of Object.entries(ctx.common.AXIS_OVERLAYS))for(const suffix of Array.isArray(ss)?ss:[ss]){let p=root+'data__susde'+suffix+'.json';if(fs.existsSync(p))overlays.push({axis,file:'data/susde'+suffix+'.json',json:JSON.parse(fs.readFileSync(p))});}
const merged=ctx.common.mergeAxisOverlays(base,overlays,'susde'),html=r._liquiditySelectionHtml(merged);
assert.match(html,/sUSDe → USDe/);assert.match(html,/1,000,000/);assert.match(html,/10,000,000/);assert.match(html,/9,000,000/);assert.match(html,/Precision obligation: not met/);
assert.match(html,/Legacy 200-bps/);assert.match(html,/50-bps marginal/);assert.match(html,/unresolved bracket/);assert.match(html,/not the impact reference/);assert.match(html,/fills, settlement/);
assert.equal(merged.liquidity.total_2pct_depth,1000000);assert.equal(merged.liquidity.depth_threshold_bps,50);
assert.match(r._liquiditySelectionHtml(read('usde_backing')),/legacy headline: 200 bps/);
function scores(x,p='',out={}){if(x&&typeof x==='object')for(const [k,v]of Object.entries(x)){if(k.endsWith('_score')&&typeof v==='number')out[p+k]=v;else scores(v,p+k+'.',out)}return out}
const before=JSON.stringify(scores(merged)),chain=JSON.stringify(merged.liquidity.liquidity_score_per_chain);r.preRender(merged,{entries:[]});assert.equal(JSON.stringify(scores(merged)),before);assert.equal(JSON.stringify(merged.liquidity.liquidity_score_per_chain),chain);
console.log('PASS candidate issuer/provenance/units, fee status, unknown allocation, history gaps, selected unresolved liquidity bracket and unchanged scores/overrides.');
r._fillFamily(family,'susde');
assert.match(slots['ethena-family-panel'],/USDe/) ;
