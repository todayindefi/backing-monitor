const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=__dirname,mode=process.argv[2]||'after',phase=mode==='candidate'?'before':mode;
function load(p){return JSON.parse(fs.readFileSync(p))}const dir=path.join(root,phase),manifest=load(path.join(dir,'sources.json'));
for(const item of Object.values(manifest))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,item.file))).digest('hex'),item.sha256);
const ctx={console,window:{}};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(dir,'js__renderers__common.js'),'utf8')+'\nglobalThis.c=CommonRenderer',ctx);vm.runInContext(fs.readFileSync(path.join(dir,'js__renderers__ethena.js'),'utf8'),ctx);
function read(n){return load(path.join(dir,'data__'+n+'.json'))}
function merge(slug,replace){const base=read(slug+'_backing'),overlays=[];for(const [axis,ss]of Object.entries(ctx.c.AXIS_OVERLAYS))for(const suffix of Array.isArray(ss)?ss:[ss]){const file=path.join(dir,'data__'+slug+suffix+'.json');if(fs.existsSync(file))overlays.push({axis,file:'data/'+slug+suffix+'.json',json:replace&&suffix==='_issuer'?replace:load(file)});}return ctx.c.mergeAxisOverlays(base,overlays,slug);}
function values(x,p='',out={}){if(x&&typeof x==='object')for(const [k,v]of Object.entries(x)){if(k.endsWith('_score')&&typeof v==='number'||/per_chain|chain_overrides/.test(k))out[p+k]=JSON.parse(JSON.stringify(v));else values(v,p+k+'.',out)}return out}
const results={method:'actual served common.js merge + Ethena preRender + shared issuerPanelHtml',mode,assets:{}};
for(const slug of ['usde','susde']){
 const expected=load(path.join(root,'expected',slug+'_issuer.json')),prior=merge(slug),merged=merge(slug,mode==='candidate'?expected:null),beforeValues=values(prior);
 if(mode==='after')assert.equal(manifest['data/'+slug+'_issuer.json'].sha256,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'expected',slug+'_issuer.json'))).digest('hex'));
 assert.deepEqual(values(merged),beforeValues,'all scores and per-chain maps unchanged by issuer supplement');
 assert.equal(merged.issuer.issuer_score,7);assert.equal(merged.issuer.issuer_score_generated_at,'2026-10-11T00:00:00Z');assert.equal(merged.issuer.issuer_score_basis,expected.issuer.issuer_score_basis);
 assert.equal(JSON.stringify(merged.issuer.facts),JSON.stringify(expected.issuer.facts));
 ctx.EthenaRenderer.preRender(merged,{entries:[]});assert.deepEqual(values(merged),beforeValues);assert.equal(merged.issuer.issuer_score_basis,expected.issuer.issuer_score_basis);assert.equal(JSON.stringify(merged.issuer.facts),JSON.stringify(expected.issuer.facts));
 const html=ctx.c.issuerPanelHtml(merged);assert.match(html,/Issuer 7\.0\/10/);assert.match(html,/insufficient_history/);assert.match(html,/null average and milestone/);assert.match(html,/not independently verified offchain custody/);assert.doesNotMatch(html,/remains dormant|is dormant against|The live Reserve Fund was/);
 if(mode==='after'){const baseline=load(path.join(root,'candidate-results.json'));assert.deepEqual(values(merged),baseline.assets[slug].selected_score_and_chain_maps,'before/after publication scores and chain maps');}
 assert.equal(merged.issuer.issuer_score_basis,read(slug+'_axis_basis').issuer.issuer_score_basis,'selected issuer basis matches served authored envelope');
 const tooltip=ctx.c._issuerScoreTooltip(ctx.c._issuerAxisInfo(merged.issuer));
 fs.writeFileSync(path.join(root,mode+'-'+slug+'-issuer.html'),html+'\n');
 results.assets[slug]={served_envelope_sha256:manifest['data/'+slug+'_issuer.json'].sha256,expected_envelope_sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'expected',slug+'_issuer.json'))).digest('hex'),basis_selected_and_preserved_after_preRender:true,full_basis_visible_in_issuer_panel:html.includes(expected.issuer.issuer_score_basis),corrected_facts_rendered:true,facts_selected_and_preserved_after_preRender:true,issuer_score:merged.issuer.issuer_score,issuer_score_generated_at:merged.issuer.issuer_score_generated_at,score_tooltip:tooltip,issuer_score_basis:merged.issuer.issuer_score_basis,selected_facts:merged.issuer.facts,all_scores_and_chain_maps_preserved:true,selected_score_and_chain_maps:values(merged)};
}
fs.writeFileSync(path.join(root,mode+'-results.json'),JSON.stringify(results,null,2)+'\n');console.log('PASS '+mode+': issuer basis/facts survive actual merge and preRender; corrected facts render in issuer panel; 7.0/original dates and all scores/chain maps preserved.');
