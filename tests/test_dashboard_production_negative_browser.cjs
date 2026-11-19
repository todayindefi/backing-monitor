const {chromium}=require('/home/danger/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');const fs=require('fs'),assert=require('assert');
(async()=>{const browser=await chromium.launch({executablePath:'/home/danger/.cache/puppeteer/chrome/linux-154.0.8037.57/chrome-linux64/chrome',args:['--no-sandbox']});let result=[];try{for(const slug of ['fxsave','weeth']){const page=await browser.newPage({viewport:{width:390,height:1000}});
await page.route('**/data/'+slug+'_source_status.json*',r=>r.fulfill({json:{status:'failed',attempted_at:'2026-11-19T00:00:00Z',message:'Accepted source validation failed. Prior snapshot retained.'}}));
await page.route('**/data/'+slug+'_backing.json*',async r=>{const response=await r.fetch(),d=await response.json();
if(slug==='fxsave'){const x=d.asset_specific.fxsave;x.as_of='2020-01-01T00:00:00Z';x.refresh_attempt={status:'failed',attempted_at:'2026-11-19T00:00:00Z'};x.redemption.instant.usdc_per_share=null;x.matched_exits.rows.forEach(row=>{row.direct.status='quote_failed';row.direct.usdc_out=999999999;});}
else{d.liquidity.ethereum_ladder.depth_50bps.depth_eth=null;d.backing.total_assets=null;}
await r.fulfill({json:d});});
await page.goto('http://127.0.0.1:8941/?asset='+slug,{waitUntil:'networkidle'});const text=await page.locator('body').innerText();assert(text.includes('Source refresh failed'));assert(!text.includes('999999999'));
if(slug==='fxsave'){assert(text.includes('last attempt: failed'));assert(text.includes('stale or unavailable'));assert(text.includes('Basket unavailable'));}
else {assert((await page.locator('#summary-cards').innerText()).includes('Not measured'));assert(!text.includes('≥Not measured'));assert((await page.locator('#section-backing').innerText()).includes('Not measured'));}
result.push({slug,failedAssemblyVisible:true,unknownNotZero:true,retainedValuesNotPromoted:true});await page.close();}
fs.writeFileSync('/tmp/bm-production-browser-review/negative-browser-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
