const {chromium}=require('/home/danger/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs'),assert=require('assert');
const out=process.env.DASHBOARD_REVIEW_DIR || '/tmp/bm-production-browser-review';fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({executablePath:'/home/danger/.cache/puppeteer/chrome/linux-154.0.8037.57/chrome-linux64/chrome',args:['--no-sandbox']});let results=[];
try{for(const slug of ['fxsave','weeth'])for(const width of [1440,390])for(const dark of [false,true]){
const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto((process.env.DASHBOARD_BASE_URL || 'http://127.0.0.1:8941/')+'?asset='+slug,{waitUntil:'networkidle'});
await page.waitForFunction(()=>document.querySelectorAll('#summary-cards .summary-card').length===6);
if(await page.locator('body').evaluate(e=>e.classList.contains('dark'))!==dark)await page.locator('#theme-toggle').click();
assert.equal(await page.locator('body').evaluate(e=>e.classList.contains('dark')),dark);
await page.waitForTimeout(100);const text=await page.locator('body').innerText();if(slug==='weeth')assert(text.includes('Manual snapshot'));assert((await page.request.get((process.env.DASHBOARD_BASE_URL || 'http://127.0.0.1:8941/')+'data/assets.json')).ok());
fs.writeFileSync(out+'/'+slug+'-'+width+'-'+(dark?'dark':'light')+'.txt',text);
assert(!text.includes('Asset data not found'),slug+' route');assert(!text.includes('STAGED —'),slug+' staging banner');assert(!text.includes('Source refresh failed'),slug+' source status');assert.deepEqual(errors,[],JSON.stringify(errors));
assert(text.includes('Authored'),slug+' scores');
const expected=slug==='fxsave'?['5.0/10','4.5/10','3.5/10','4.5/10','4.0/10','5.5/10']:['7.5/10','7.5/10','6.5/10','5.5/10','6.5/10','7.0/10'];
const cards=await page.locator('#summary-cards .summary-card').allTextContents();for(let i=0;i<6;i++)assert.equal(Number((cards[i].match(/Authored ([0-9.]+)\/10/)||[])[1]),Number(expected[i].split('/')[0]),slug+' axis'+i+cards[i]);
if(slug==='weeth'){assert(text.includes('ETH-denominated price'));assert(text.includes('eETH claim'));assert(text.includes('validator'));assert(!text.includes('Historical authored'));}
else {assert(text.includes('Accepted six-axis assessment'));assert(!text.includes('Provisional · review'));assert(!text.includes('Dependencies remains unscored'));}
const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert(!overflow,slug+' overflow '+width);
await page.screenshot({path:out+'/'+slug+'-'+width+'-'+(dark?'dark':'light')+'.png',fullPage:true});
await page.locator('details').evaluateAll(es=>es.forEach(e=>e.open=true));assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),slug+' expandedoverflow');
results.push({slug,width,dark,errors,overflow,expandedOverflow:false,cards,bodyBackground:await page.locator('body').evaluate(e=>getComputedStyle(e).backgroundColor)});await page.close();}
fs.writeFileSync(out+'/browser-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results.map(r=>({slug:r.slug,width:r.width,dark:r.dark,errors:r.errors,background:r.bodyBackground}))));}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
