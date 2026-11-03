const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const ctx={Date,Number,console,fetch:()=>Promise.resolve({ok:false}),document:{querySelectorAll:()=>[]},CommonRenderer:{_escapeAttr:x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'),issuerPanelHtml:()=>'<b>Authored 5.5/10</b>'}};vm.createContext(ctx);vm.runInContext(fs.readFileSync('js/issuer-project-evidence.js','utf8'),ctx);
const r=ctx.IssuerProjectEvidence,d=JSON.parse(fs.readFileSync('data/issuer_project_evidence.json'));
const h=r.html(d,'usdm');assert.match(h,/Mento Labs GmbH/);assert.match(h,/Searched · not found/);assert.match(h,/Passed · execution unverified/);assert.match(h,/Executed · tracker evidence/);assert.match(h,/events never update/i);assert.match(h,/historical completeness unverified/);
const legacy=structuredClone(d);delete legacy.component_profiles;const sat=r.html(legacy,'usdat');assert.match(sat,/Saturn Global Capital/);assert.match(sat,/Entity not identified in reviewed scope · issuer/);assert.match(sat,/not_monitored_or_unmapped/);assert.doesNotMatch(sat,/No governance activity/);
assert.match(r.html(null,'usdat'),/unavailable/);assert.match(r.html(d,'unknown'),/not yet published/);
const x=structuredClone(d);x.projects.saturn.facts[0].value='<script>x</script>';delete x.component_profiles;assert.doesNotMatch(r.html(x,'usdat'),/<script>/);
assert.match(ctx.CommonRenderer.issuerPanelHtml({asset_slug:'usdat'}),/Authored 5.5\/10/);
const mento=d.projects.mento.events;assert.equal(mento.filter(x=>x.title.startsWith('MGP-20:')).length,1,'initiative milestones grouped');
assert.ok(!('scores' in d.projects.mento));assert.ok(!JSON.stringify(d).includes('collisions'));
console.log('PASS issuer status/source/scope, governance execution/grouping, missing/stale coverage, escaping and preserved authored score');

const sc=r.html(d,'strcx');assert.match(sc,/Backed Assets \(JE\) Limited/);assert.match(sc,/Backed Finance AG · tokenizer/);assert.match(sc,/Not exported; unavailable/);assert.doesNotMatch(sc,/Swiss DLT-regulated/);
const su=r.html(d,'susdat');assert.match(su,/legal facts were not exported/i);assert.doesNotMatch(su,/British Virgin Islands|Delaware|STRC is preferred equity/);assert.match(r.html(d,'strc'),/Certificate and dividend legal clocks/);assert.match(r.html(d,'apyusd'),/cooldown/);assert.doesNotMatch(r.html(d,'apxusd'),/~20-day/);
