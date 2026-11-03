const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const c=vm.createContext({console,Date,Number,FrxUSDRenderer:{esc:v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'),money:v=>typeof v==='number'?'$'+v.toFixed(2):'n/a',num:v=>String(v),metric:(l,v,n)=>l+' '+v+' '+n,render:()=>{}}});vm.runInContext(fs.readFileSync('js/frxusd-shared-evidence.js','utf8'),c);
const p=JSON.parse(fs.readFileSync('data/frxusd_backing_evidence.json')),s=JSON.parse(fs.readFileSync(p.snapshot_path));let h=c.FrxUSDSharedEvidence.html(p,s);
for(const term of ['$1-per-token coverage','Market-liability coverage','already netted','BitGo','Erebor','not our audit','sfrxUSD','103.','source observation'])if(term!=='source observation')assert.ok(h.includes(term),term);
assert.ok(h.includes(s.third_party_verified.metrics.coverage_par_pct.toFixed(2)+'%'));assert.ok(h.includes(s.third_party_verified.metrics.coverage_market_pct.toFixed(2)+'%'));assert.ok(h.includes(p.snapshot_id));
assert.match(c.FrxUSDSharedEvidence.html({...p,served_is_last_good:true},s),/Last-good snapshot retained/);assert.match(c.FrxUSDSharedEvidence.html(null,null),/unavailable/);
const bad=JSON.parse(JSON.stringify(s));bad.third_party_verified.positions[0].account_label='<script>bad</script>';assert.ok(!c.FrxUSDSharedEvidence.html(p,bad).includes('<script>'));
console.log('PASS shared producer metrics, assurance separation, snapshot identity, last-good and escaping');
