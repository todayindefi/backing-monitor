const assert=require('node:assert/strict'),fs=require('node:fs');
const v=require('../js/renderers/vault-monitor.js');
const d=JSON.parse(fs.readFileSync('tests/fixtures/fxsp_vault_sample.json'));
const rendered=v.render(d);
for(const label of ['Where is the money?','How do I redeem?','What is a share worth?','Funded redemption capacity','Full cash route not verified']) assert(rendered.includes(label),label);
assert(rendered.includes('0 USDC'));assert(rendered.includes('Unmeasured'));assert(!rendered.includes('/home/'));assert(!rendered.includes('.private-reviews'));
for(const value of [null,undefined,'',NaN,Infinity]) assert.equal(v.numeric(value),false);
assert.equal(v.numeric('0'),true);
const mismatch=structuredClone(d);mismatch.backing.positions[0].marked_usd='0';assert.throws(()=>v.validate(mismatch),/reconcile/);
const unknown=structuredClone(d);unknown.metrics.share_nav_usd=null;assert.throws(()=>v.validate(unknown),/unavailable/);
const unsafe=structuredClone(d);unsafe.asset.name='<img src=x onerror=alert(1)>';unsafe.sources.links=[{url:'javascript:alert(1)',label:'bad'}];const safe=v.render(unsafe);assert(!safe.includes('<img'));assert(!safe.includes('javascript:'));
const other=structuredClone(d);other.asset.symbol='TEST';other.strategy.title='Different strategy';const html=v.render(other);for(const title of ['Where is the money?','How do I redeem?','What is a share worth?'])assert(html.includes(title));assert(html.includes('Different strategy'));
assert(v.chart([]).includes('unavailable'));
console.log('PASS shared layout, reconciled values, zero/null distinction, escaping and missing-evidence boundaries.');

const gap=[{at:'2026-11-01T00:00:00Z',value:'1'},{at:'2026-11-01T01:00:00Z',value:'4'}, {at:'2026-11-02T00:00:00Z',value:'.8'},{at:'2026-11-02T01:00:00Z',value:'1.1'}];
const groups=v.chartSeries(gap,10800);assert.equal(groups.length,2);assert.deepEqual(groups.flat().map(x=>x.value),[1,4,.8,1.1]);const gapChart=v.chart(gap,{fullCount:4,gapSeconds:10800});assert.equal((gapChart.match(/class="chart-line"/g)||[]).length,2);assert(gapChart.includes('4 of 4 observations shown'));
const broken=[gap[0],{at:'2026-11-01T00:30:00Z',value:null},gap[1]];assert.equal(v.chartSeries(broken).length,2);
assert.equal(d.changes.history.length,d.changes.history_count);assert.equal(d.changes.history_displayed_count,d.changes.history_count);
assert(v.render(d).includes('Share of oracle-marked value'));assert(v.render(d).includes('immediate powers remain'));
console.log('PASS extrema retained, material/missing gaps split paths, full counts disclosed and qualification labels present.');

assert(!rendered.includes('Executable market price</span>'));assert(!rendered.includes('Market discount to NAV</span>'));assert(!rendered.includes('Sized final-cash depth</div>'));assert(rendered.includes('How do I redeem?'));
const live=structuredClone(d);live.preview=false;live.observation={...live.observation,mode:'scheduled',refresh_interval_seconds:28800,max_age_hours:10};live.source_status={status:'ok'};
const sourceTime=Date.parse(live.observation.at);assert.equal(v.feedHealth(live,sourceTime+8*3600000).warning,false);assert.equal(v.feedHealth(live,sourceTime+11*3600000).clock,'Stale observation');
live.source_status.status='failed';assert(v.feedHealth(live,sourceTime+1000).warning);assert(v.render(live).includes('Refresh unavailable'));assert(v.render(live).includes('last successful financial snapshot'));
const zero=structuredClone(live);zero.source_status.status='ok';zero.metrics.share_nav_usd='0';assert.equal(v.feedHealth(zero,sourceTime+1000).clock,'Zero native accounting value');
console.log('PASS maintained cadence, stale/failed last-good labels and true zero accounting alert.');

assert.equal(v.chartSeries([{at:'2026-11-01T00:00:00Z',value:'1'},{at:'2026-11-01T01:00:00Z',value:'0'}]).flat().length,2,'known zero NAV is a chart observation, not missing data');
