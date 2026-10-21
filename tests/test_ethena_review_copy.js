const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const c=vm.createContext({console});vm.runInContext(fs.readFileSync('js/renderers/common.js','utf8')+'\nthis.CommonRenderer=CommonRenderer;',c);vm.runInContext(fs.readFileSync('js/renderers/ethena.js','utf8'),c);const r=c.EthenaRenderer;
const failed={source_status:{llamarisk:'http_404'},summary:{usde_supply_usd:4949000000,total_backing_usd:4953000000,reserve_fund_usd:62095000,coverage_ratio_with_reserve_fund:1.0134}};
for(const slug of ['usde','susde']){const h=r._liveCoverageHtml(failed,slug);assert.match(h,/http_404/);assert.equal((h.match(/<strong>Unavailable/g)||[]).length,4);assert.doesNotMatch(h,/4\.95|62\.09|101\.34/);}
const snapshots=r._reviewSnapshotsHtml();for(const t of ['September 27, 2026','October 12, 2026','September 30, 2026','$4.953bn','$4.949bn','$62.095m','101.43%','$62.57m','$45.7m','1.4×','74%','17%','6%'])assert.ok(snapshots.includes(t),t);
const d={asset_slug:'susde',summary:{},asset_specific:{type:'susde',measurements:{vault:{nav:1.254,cooldown_seconds:86400,max_cooldown_seconds:7776000,as_of:'2026-10-21T00:00:00Z'}}}};
const h=r._renderSusdeVaultPanel(d.asset_specific,d.summary,d);assert.match(h,/Live cooldown/);assert.match(h,/1 day/);assert.match(h,/Contract maximum cooldown/);assert.match(h,/90 days/);assert.match(h,/Hourly vault observation/);assert.match(h,/1\.254000000 USDe/);
console.log('Ethena null-state, dated snapshots and separate vault/cooldown copy checks passed');
function scores(v,path='',out={}){if(v&&typeof v==='object')for(const [k,x] of Object.entries(v)){if(/_score$/.test(k))out[path+'.'+k]=x;else scores(x,path+'.'+k,out);}return out;}
for(const slug of ['usde','susde']){const input=JSON.parse(fs.readFileSync('data/'+slug+'_backing.json'));const before=JSON.stringify(scores(input));r.preRender(input,{entries:[]});assert.equal(JSON.stringify(scores(input)),before,'Authored scores must remain unchanged');}

assert.match(snapshots,/05:59:44 UTC/);assert.match(snapshots,/100\.0978%/);assert.match(snapshots,/101\.4290%/);assert.match(snapshots,/not independently verified live coverage/);assert.match(snapshots,/not a separate sUSDe reserve portfolio/);

const oldFact=JSON.parse(fs.readFileSync('data/usde_backing.json'));oldFact.issuer.facts=['The live Reserve Fund was $62.078m, or about 1.29% of current supply.'];r.preRender(oldFact,{entries:[]});assert.doesNotMatch(oldFact.issuer.facts.join(' '),/live Reserve Fund was/);assert.match(oldFact.issuer.facts.join(' '),/not independently verified/);
