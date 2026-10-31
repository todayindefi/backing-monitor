const puppeteer=require('/tmp/avant-browser-qa/node_modules/puppeteer-core');
const assert=require('assert');
(async()=>{const browser=await puppeteer.launch({executablePath:'/home/danger/.cache/puppeteer/chrome/linux-154.0.8037.57/chrome-linux64/chrome',headless:true,args:['--no-sandbox']});try{
for(const width of [1280,390])for(const slug of ['syrupusdc','syrupusdt']){
const page=await browser.newPage();await page.setViewport({width,height:960});
page.on('pageerror',e=>console.log('PAGE ERROR',e.message));await page.goto((process.env.SYRUP_DASHBOARD_URL || 'http://127.0.0.1:8895/')+'?asset='+slug,{waitUntil:'networkidle0'});
await page.waitForFunction(()=>document.body.textContent.includes('Cash coverage of queue'),{timeout:10000});
await page.evaluate(()=>document.querySelectorAll('details').forEach(d=>d.open=true));
const state=await page.evaluate(()=>{const p=[...document.querySelectorAll('.panel')].find(p=>p.textContent.includes('Cash coverage of queue'));return {text:p.textContent,visible:p.getBoundingClientRect().height,overflow:[...p.querySelectorAll('.summary-card')].some(c=>c.scrollWidth>c.clientWidth+2)};});
assert(state.text.includes('Pool cash'));assert(state.text.includes('Additional funding needed'));assert(!state.overflow,'card text overflow');
await page.evaluate(()=>[...document.querySelectorAll('.panel')].find(p=>p.textContent.includes('Cash coverage of queue')).scrollIntoView());
await page.screenshot({path:'/tmp/syrup-'+slug+'-'+width+'.png'});
console.log(slug,width,'height',state.visible,state.text.slice(0,120));await page.close();
}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
