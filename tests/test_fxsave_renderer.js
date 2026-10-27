const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ctx=vm.createContext({console});
vm.runInContext(fs.readFileSync('js/renderers/common.js','utf8'),ctx);
vm.runInContext(fs.readFileSync('js/renderers/fxsave.js','utf8'),ctx);
const r=ctx.FxSaveRenderer;
const d=JSON.parse(fs.readFileSync('previews/fxsave/report-snapshot.json','utf8'));
assert.equal(r.validDetail(d),true);
assert.match(r.redemption(d),/1\.072408 fxUSD \+ 0\.052772 USDC/);
assert.match(r.redemption(d),/1\.061684 fxUSD \+ 0\.052245 USDC/);
assert.ok(Math.abs(r.markedBasket(d.redemption.instant,1,1)-1.113929)<1e-12);
assert.equal(r.markedBasket({fxusd_per_share:0.976412},1,1),null);
assert.equal(r.markedBasket({fxusd_per_share:NaN,usdc_per_share:0.03},1,1),null);
assert.equal(r.markedBasket(d.redemption.instant,null,1),null);
assert.equal(r.markedBasket(d.redemption.instant,1,0),null);
assert.match(r.basket({fxusd_per_share:1}),/both output legs are required/);
assert.match(r.basket({fxusd_per_share:-1,usdc_per_share:1}),/unavailable/);
assert.match(r.basket({fxusd_per_share:0,usdc_per_share:1}),/0 fxUSD \+ 1 USDC/);
assert.match(r.concentration(d),/Review trigger exceeded/);
assert.match(r.exits(d),/not a ceiling on the whole FXSave claim/);
assert.match(r.exits({}),/Not measured/);
assert.match(r.overview(d),/Historical authored assessment/);
assert.match(r.overview(d),/Under review/);
assert.match(r.overview({...d,assessment:{...d.assessment,status:'<img src=x>'}}),/&lt;img/);
const data={summary:{collateral_ratio:140,total_backing:100},backing:{collateral_ratio:140,total_backing:100},asset_specific:{fxsave:d},backing_breakdown:[{}]};
r.preRender(data);
assert.equal(data.summary.collateral_ratio,null);
assert.equal(data.backing.total_backing,null);
assert.equal(data.backing_breakdown.length,0);
const missing={...d,redemption:{queued:{fxusd_per_share:1}}};
assert.match(r.redemption(missing),/Basket unavailable/);
assert.doesNotMatch(r.redemption(missing),/1 fxUSD \+ 0 USDC/);
console.log('FXSave two-output payout, missing data, NAV/CR, review status and escaping checks passed');
const live=JSON.parse(fs.readFileSync('previews/fxsave/data/fxsave_backing.json','utf8')).asset_specific.fxsave;
const matched=r.matchedExits(live);
assert.match(matched,/Matched exit profile/);
assert.match(matched,/gas excluded/);
assert.match(matched,/fxsave-rung/);
assert.doesNotMatch(r.redemption(live),/\[object Object\]/);
const row=live.matched_exits.rows[0];
const cost=r.routeCost(row,'fxusd_market');
const expected=(1-(row.fxusd_market.usdc_out+Number(row.instant.usdc_raw)/1e6)*(row.usdc_usd_mark || 1)/row.size_nav_usd)*10000;
assert.ok(Math.abs(cost-expected)<1e-7);
assert.equal(r.routeCost({...row,direct:{status:'quote_failed',usdc_out:999,last_good:{usdc_out:999}}},'direct'),null);
assert.match(r.rungResult({matched_exits:{rows:[{...row,direct:{status:'quote_failed',as_of:'original'}}]}},0),/Unavailable/);
assert.doesNotMatch(r.quoteChart({rows:[{...row,direct:{status:'quote_failed',usdc_out:999}}]}),/<path/);
console.log('FXSave matched sizes, failed quote exclusion and single USDC addition passed');
// Specification regression: historical judgments never replace current market evidence.
const clock=Date.parse('2026-10-22T02:00:00Z');
const fresh={status:'ok',nav:1.1,market_price:1.101,nav_as_of:'2026-10-22T01:45:00Z',market_price_as_of:'2026-10-22T01:46:00Z'};
assert.equal(r.marketComparison(fresh,clock).valid,true);
assert.equal(r.marketComparison({...fresh,market_price_as_of:null},clock).valid,false);
assert.equal(r.marketComparison({...fresh,market_price_as_of:'2026-10-21T01:46:00Z'},clock).valid,false);
assert.equal(r.marketComparison({...fresh,market_price_as_of:'2026-10-23T01:46:00Z'},clock).valid,false);
assert.match(r.reference({peg:{nav:1.1,nav_source:'fxSAVE.nav()',nav_as_of:'2026-10-22T01:45:00Z'}}),/No market\/peg history is published/);
const history={entries:[{timestamp:'2026-10-01T01:00:00Z',nav_usd:1.0},{timestamp:'2026-10-22T01:45:00Z',nav_usd:1.1}]};
assert.equal(r.historyRows(history,clock).length,1);
function rung(size,direct,instant){return {size_nav_usd:size,instant:{usdc_raw:'0'},direct:{status:'ok',usdc_out:size*(1-direct/10000)},fxusd_market:{status:'ok',usdc_out:size*(1-instant/10000)}};}
const profile={rows:[rung(100,15,100),rung(1000,60,125),rung(10000,80,175)]};
const impact=r.depthProfile(profile,'direct');
assert.ok(Math.abs(impact.baseline_bps-15)<1e-7);
assert.equal(impact.thresholds[50].lower,1000);
assert.equal(impact.thresholds[50].upper,10000);
assert.equal(r.depthProfile(profile,'fxusd_market').thresholds[50].lower,1000);
assert.equal(r.depthProfile(profile,'fxusd_market').thresholds[200].status,'ladder_exhausted');
assert.equal(r.depthProfile({rows:[{...profile.rows[0],direct:{status:'quote_failed'}},...profile.rows.slice(1)]},'direct').status,'unmeasured');
assert.equal(r.routeCost({...row,instant:{usdc_raw:null}},'fxusd_market'),null);
assert.match(r.health({asset_specific:{fxsave:{as_of:'2020-01-01',refresh_attempt:{status:'failed'}}},transport:{refresh_mode:'manual_preview_snapshot'}}),/last attempt: failed/);
assert.match(r.backing({...live,accounting:{...live.accounting,status:'mismatch',accounting_difference_fxsp:-59.5}},{}),/mismatch/);
assert.match(r.backing(live,{}),/Collateral-ratio\/coverage history and reserve-allocation pie: not applicable/);
assert.match(r.dependencies({upstream:[{name:'fxUSD',slug:'fxusd'}],downstream:[{name:'Morpho',metric:'dated observation'}],downstream_tracked:[]}),/Known downstream consumers/);
console.log('FXSave spec checks: honest history, market clocks, incremental impact, failed attempts, and explicit no-CR state passed');

// New indicative policy keeps oracle update age separate from read/quote clocks.
const indicative=JSON.parse(fs.readFileSync('tests/fixtures/fxsave_market_quote.json','utf8'));
const quoteNow=Date.parse(indicative.market_price_as_of)+60000;
assert.equal(r.marketComparison(indicative,quoteNow).valid,true);
assert.match(r.marketEvidence(indicative),/100 shares/);
assert.match(r.marketEvidence(indicative),/cached/);
assert.match(r.marketEvidence(indicative),/Oracle updatedAt/);
function changed(edit){const p=JSON.parse(JSON.stringify(indicative));edit(p);return p;}
for(const bad of [
 changed(p=>p.market_observation.status='quote_failed'),
 changed(p=>p.market_observation.premium_discount_eligible=false),
 changed(p=>p.market_observation.provider_as_of=null),
 changed(p=>p.market_observation.provider_as_of=new Date(quoteNow-240000).toISOString()),
 changed(p=>p.market_observation.usd_reference.read_block_as_of='2026-10-01T00:00:00Z'),
 changed(p=>p.market_observation.usd_reference.as_of=new Date(quoteNow-82801000).toISOString()),
 changed(p=>p.market_observation.usd_reference.heartbeat_seconds=86400),
 changed(p=>p.market_observation.usd_reference.usd_per_token=1),
 changed(p=>p.market_observation.price_usd_per_share=null),
 changed(p=>p.market_observation.gas_included=true),
 changed(p=>p.market_observation.provider_as_of=new Date(quoteNow+600000).toISOString())
]) assert.equal(r.marketComparison(bad,quoteNow).valid,false);
assert.equal(r.marketComparison(indicative,quoteNow+14400000).valid,false);
console.log('Indicative quote policy: aligned clocks, original oracle heartbeat, stale/failure/conversion rejection passed');

assert.equal(r.quoteTime('2026-10-22T16:17:04.556795+00:00'),'2026-10-22 16:17:04 UTC');
assert.equal(r.quoteTime(null),'Unavailable');
assert.doesNotMatch(r.matchedExits(live).split('Observation times')[0],/Direct \/ market quote time/);

// Price chart consumes native NAV history; historical indicative quotes stay separate.
const quotePeg=JSON.parse(fs.readFileSync('tests/fixtures/fxsave_market_quote.json','utf8'));
const pointTime=quotePeg.nav_as_of;
const priceHistory={entries:[{timestamp:pointTime,nav_usd:quotePeg.nav,peg:quotePeg}],price_history:{asset_slug:'fxsave',chain:'ethereum',contract_address:'0x7743e50f534a7f9f1791dde7dcd89f7783eefc39',units:'USD/share',entries:[{timestamp:pointTime,peg_theoretical_price:quotePeg.nav,peg_market_price:null}]}};
const plot=r.priceSeries(priceHistory,Date.parse(pointTime)+120000);
assert.equal(plot[0].nav,quotePeg.nav);assert.equal(plot[0].market,null);assert.equal(plot[0].quote,quotePeg.market_price);
const badHistory=JSON.parse(JSON.stringify(priceHistory));badHistory.entries[0].peg.market_observation.status='clock_mismatch';assert.equal(r.priceSeries(badHistory,Date.parse(pointTime)+120000)[0].quote,null);
badHistory.price_history.chain='plasma';assert.equal(r.priceSeries(badHistory,Date.parse(pointTime)+120000).length,0);
assert.equal(r.priceSeries(priceHistory,Date.parse(pointTime)+8*86400000).length,0);
console.log('FXSave price-series identity, historical validation, missing-market separation and strict window passed');

const gridLadder={rows:[rung(100,2,100),rung(10000,3,101),rung(100000,80,103),rung(250000,100,104),rung(1000000,200,110),rung(10000000,900,300)]};
assert.deepEqual(Array.from(r.standardRungs(gridLadder,'direct'),r=>r.size_nav_usd),[1000,10000,100000]);
assert.equal(r.standardRungs(gridLadder,'direct')[0].missing,true);
assert.match(r.standardLadder(gridLadder,'direct'),/Required standard rung missing/);
assert.match(r.standardLadder(gridLadder,'direct'),/Legacy source/);
assert.match(r.metrics([['Reference',1.125,'USD / share']]),/class="summary-card"/);
assert.doesNotMatch(r.metrics([['Reference',1.125,'USD / share']]),/<dl/);
console.log('Standard metric cards, decade ladder, missing rung and legacy baseline disclosure passed');

const published={rows:[rung(1000,10,100),rung(10000,20,101),rung(100000,70,102)],ladder_policy:{version:'fleet-section7/1',baseline_size_nav_usd:{direct:1000}},route_profiles:{direct:{'50':{is_floor:true,floor_nav_usd:10000,crossing_nav_usd:[10000,100000],endpoint_revalidation:{bracket_holds:true},published_sizes_nav_usd:[1000,10000,100000]}}}};
assert.equal(r.depthProfile(published,'direct').thresholds[50].is_floor,true);
published.route_profiles.direct['50']={status:'unstable_or_unverified_floor'};
assert.equal(r.depthProfile(published,'direct').thresholds[50].status,'unverified');
