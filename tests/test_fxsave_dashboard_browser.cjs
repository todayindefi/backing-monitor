// Run against a served repository. PUPPETEER_PATH can point at an existing install.
const assert=require('node:assert/strict');
const puppeteer=require(process.env.PUPPETEER_PATH || 'puppeteer');
const url=process.env.FXSAVE_PREVIEW_URL || 'http://127.0.0.1:8876/previews/fxsave/?asset=fxsave';
(async()=>{
 const browser=await puppeteer.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const width of [1280,390])for(const dark of [false,true]){
   const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.setViewport({width,height:950});await page.goto(url+'&audit='+Date.now(),{waitUntil:'networkidle0'});await page.waitForSelector('#fxsave-rung');
   await page.evaluate(dark=>document.body.classList.toggle('dark',dark),dark);
   const got=await page.evaluate(()=>({
    cards:document.querySelectorAll('#summary-cards .summary-card').length,
    peg:document.getElementById('section-peg').innerText,
    backing:document.getElementById('section-backing').innerText,
    liquidity:document.getElementById('section-liquidity').innerText,
    dependency:document.getElementById('section-dependencies').innerText,
    contract:document.getElementById('section-contract').innerText,
    issuer:document.getElementById('section-issuer').innerText,
    historyCharts:document.querySelectorAll('.fxsave-history-chart, #fxsave-price-chart').length,
    authorityRows:document.querySelectorAll('.tw-table tbody tr').length,
    linkedFxusd:!!document.querySelector('#section-dependencies a[href="?asset=fxusd"]'),
    overflow:document.documentElement.scrollWidth>innerWidth,
    errors:document.getElementById('error-message').textContent
   }));
   assert.equal(got.cards,6);assert.equal(got.overflow,false);assert.equal(got.errors,'');assert.deepEqual(errors,[]);
   assert.match(got.peg,/fxSAVE\.nav\(\)/);assert.match(got.peg,/Standard market-price history is unavailable/);assert.ok(got.historyCharts>=2);
   assert.match(got.backing,/Share supply · Ethereum/i);assert.match(got.backing,/not applicable/);assert.match(got.backing,/reported custody\/accounting mismatch/);
   assert.match(got.liquidity,/50 bps additional impact/i);assert.match(got.liquidity,/Standing cost/i);assert.match(got.liquidity,/Venue inventory/);assert.match(got.liquidity,/maxRedeem/);
   assert.equal(got.linkedFxusd,true);assert.match(got.dependency,/Known downstream consumers/);assert.match(got.dependency,/unscored/);
   assert.doesNotMatch(got.contract,/no topology walk filed/i);assert.ok(got.authorityRows>=3);assert.match(got.contract,/Not established/);assert.match(got.contract,/Smart-contract security/);
   assert.match(got.issuer,/f\(x\) Protocol/);
   const layout=await page.evaluate(()=>({
    firstPegPanel:document.querySelector('#axis-peg-body .panel-title').textContent,
    chartVisible:document.querySelector('#fxsave-price-chart').getBoundingClientRect().height>0,
    ladderRows:document.querySelectorAll('.fxsave-exit-ladder tbody tr').length,
    ladderCollapsed:!!document.querySelector('.fxsave-exit-ladder').closest('details:not([open])'),
    dependencyTiles:document.querySelectorAll('#section-dependencies .dep-grid .dep-card').length
   }));
   const chart=await page.evaluate(()=>({datasets:window._fxsavePriceChart.data.datasets.map(d=>({label:d.label,count:d.data.filter(p=>p.y!==null).length,width:d.borderWidth,dash:d.borderDash,spanGaps:d.spanGaps})),xType:window._fxsavePriceChart.options.scales.x.type,days:(window._fxsavePriceChart.options.scales.x.max-window._fxsavePriceChart.options.scales.x.min)/86400000}));
   assert.equal(chart.xType,'time');assert.equal(chart.days,7);assert.ok(chart.datasets[0].count>=2);assert.ok(chart.datasets[1].count>=2);assert.equal(chart.datasets[0].width,3);assert.equal(chart.datasets[1].width,1.4);assert.equal(chart.datasets[1].spanGaps,false);
   assert.match(layout.firstPegPanel,/Price and contract reference/);assert.equal(layout.chartVisible,true);
   assert.ok(layout.ladderRows>=2 && layout.ladderRows<=20);assert.equal(layout.ladderCollapsed,false);assert.ok(layout.dependencyTiles>=2);

   await page.$eval('#fxsave-rung',e=>e.closest('details').open=true);
   const choices=await page.$$eval('#fxsave-rung option',els=>els.map(e=>e.value));assert.ok(choices.length>=2);await page.select('#fxsave-rung',choices.at(-1));assert.match(await page.$eval('#fxsave-rung-result',e=>e.innerText),/Measured input/);
   // Expanded evidence must remain accessible and must not leak horizontal scroll.
   await page.$$eval('details',els=>els.forEach(e=>e.open=true));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.screenshot({path:'/tmp/fxsave-spec-'+width+'-'+(dark?'dark':'light')+'.png',fullPage:true});await page.close();
   console.log(width+' '+(dark?'dark':'light')+': six-axis spec DOM, history, venues, authority, selector and expanded evidence passed');
  }
  // Deterministic positive/negative market feed tests use shifted clocks, not wall-clock-dependent fixtures.
  for(const invalid of [false,true]){
   const marketPage=await browser.newPage();await marketPage.setRequestInterception(true);
   marketPage.on('request',async request=>{
    if(new URL(request.url()).pathname.endsWith('/fxsave_backing.json')){
     const response=await fetch(request.url()),data=await response.json();
     const peg=JSON.parse(require('node:fs').readFileSync('tests/fixtures/fxsave_market_quote.json','utf8'));
     const shift=Date.now()-Date.parse(peg.market_price_as_of)-60000,o=peg.market_observation,ref=o.usd_reference;
     for(const [obj,key] of [[peg,'market_price_as_of'],[peg,'nav_as_of'],[o,'as_of'],[o,'provider_as_of'],[ref,'read_block_as_of'],[ref,'as_of']])obj[key]=new Date(Date.parse(obj[key])+shift).toISOString();
     if(invalid)o.status='quote_failed';data.peg=peg;
     await request.respond({status:200,contentType:'application/json',body:JSON.stringify(data)});
    }else await request.continue();
   });
   await marketPage.goto(url+'&marketCase='+invalid,{waitUntil:'networkidle0'});await marketPage.waitForSelector('#fxsave-rung');
   await marketPage.$$eval('#section-peg details',els=>els.forEach(e=>e.open=true));
   const text=await marketPage.$eval('#section-peg',e=>e.innerText);
   assert.match(text,/100 shares/);assert.match(text,/Oracle updatedAt/);assert.match(text,/cached/);
   assert.match(text,invalid ? /Market comparison unavailable/ : /Indicative exit value/i);
   if(!invalid){assert.doesNotMatch(text,/Market comparison unavailable/);assert.match(await marketPage.$eval('#summary-cards',e=>e.innerText),/Indicative market comparison/);}
   await marketPage.close();
  }
  console.log('Indicative market comparison: valid feed displayed, failed observation rejected with evidence retained');
  const page=await browser.newPage();await page.setRequestInterception(true);
  page.on('request',async request=>{
   if(new URL(request.url()).pathname.endsWith('/fxsave_backing.json')){
    const response=await fetch(request.url());const data=await response.json();const d=data.asset_specific.fxsave;
    d.refresh_attempt={status:'failed',completed_at:'2026-10-22T02:00:00Z'};
    d.matched_exits.rows.forEach(row=>{row.direct.status='quote_failed';row.direct.usdc_out=999999;});
    d.redemption.instant.usdc_per_share=null;
    await request.respond({status:200,contentType:'application/json',body:JSON.stringify(data)});
   }else await request.continue();
  });
  await page.goto(url+'&negative='+Date.now(),{waitUntil:'networkidle0'});await page.waitForSelector('#fxsave-rung');
  await page.$eval('#fxsave-rung',e=>e.closest('details').open=true);
  assert.match(await page.$eval('#fxsave-rung-result',e=>e.innerText),/Unavailable/);
  assert.match(await page.$eval('#section-liquidity',e=>e.innerText),/Smallest tested rung failed/);
  assert.match(await page.$eval('#section-liquidity',e=>e.innerText),/Basket unavailable/);
  assert.match(await page.$eval('#axis-notes-lifted',e=>e.innerText),/last attempt: failed/);
  console.log('Failure states: retained quote excluded, missing basket leg unavailable, failed attempt visible');await page.close();
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
