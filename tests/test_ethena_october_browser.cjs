const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const assert = require('node:assert/strict'), {spawn} = require('node:child_process');
const root = path.resolve('.private-reviews/ethena-october-adoption-2026-11-23');
const out = path.resolve('specs/reviews/ethena-october-adoption-2026-11-23/browser');
const base = JSON.parse(fs.readFileSync(path.join(root, 'server.json'))).url;
const sleep = ms => new Promise(r => setTimeout(r, ms));
function contrast(a,b) {
 function light(s) { const c=s.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4;});return c[0]*0.2126+c[1]*0.7152+c[2]*0.0722; }
 const x=light(a),y=light(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);
}
class CDP {
  constructor(socket) {
    this.socket=socket; this.next=0; this.pending=new Map(); this.exceptions=[];
    socket.addEventListener('message', event => {
      const m=JSON.parse(String(event.data));
      if(m.id) {const p=this.pending.get(m.id); if(!p)return;this.pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}
      if(m.method==='Runtime.exceptionThrown')this.exceptions.push(m.params.exceptionDetails.text);
    });
  }
  async send(method, params={}, sessionId) {
    const id=++this.next;
    return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
  }
  async evaluate(expression,sessionId) {
    const x=await this.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},sessionId);
    if(x.exceptionDetails)throw new Error(x.exceptionDetails.text);
    return x.result.value;
  }
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'bm-ethena-chrome-'));
 const chrome=spawn('/home/danger/.cache/puppeteer/chrome/linux-154.0.8037.57/chrome-linux64/chrome',
 ['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--remote-debugging-address=127.0.0.1',
  '--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
 let socket;
 try{
  let port;
  for(let i=0;i<150;i++){try{port=Number(fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0]);break;}catch{}await sleep(100);}
  assert(port,'Chrome debugging port');
  const version=await (await fetch('http://127.0.0.1:'+port+'/json/version')).json();
  socket=new WebSocket(version.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  const cdp=new CDP(socket),results=[];
  for(const slug of ['usde','susde'])for(const width of [1440,390])for(const theme of ['light','dark']){
    const target=await cdp.send('Target.createTarget',{url:'about:blank'});
    const attached=await cdp.send('Target.attachToTarget',{targetId:target.targetId,flatten:true});
    const session=attached.sessionId;
    await cdp.send('Page.enable',{},session);await cdp.send('Runtime.enable',{},session);
    await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:width<600},session);
    await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:theme}]},session);
    await cdp.send('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.setItem("theme",'+JSON.stringify(theme)+');'},session);
    await cdp.send('Page.navigate',{url:base+'?asset='+slug},session);
    let ready=false;
    for(let n=0;n<160;n++){
      ready=await cdp.evaluate('!!document.querySelector("#ethena-attestation-panel-inner") && document.querySelector("#ethena-attestation-panel-inner").textContent.includes("ethena-october-normalized-2026-11-23-v1")',session).catch(()=>false);
      if(ready)break;await sleep(250);
    }
    assert(ready,slug+' '+width+' '+theme+' actual canonical normalization rendered');
    const state=await cdp.evaluate('(()=>{const p=document.querySelector("#ethena-attestation-panel-inner"); const d=p.querySelector("details");d.open=true; const text=p.textContent; const s=getComputedStyle(p);d.open=false;p.scrollIntoView({block:"start"});window.scrollBy(0,-70);return {text,overflow:document.documentElement.scrollWidth>innerWidth+2,dark:document.body.classList.contains("dark"),panelColor:s.color,panelBackground:s.backgroundColor,scopeColor:getComputedStyle(p.querySelector("tbody td:first-child div")).color,moneyWhiteSpace:getComputedStyle(p.querySelector("tbody td:nth-child(2)")).whiteSpace,title:document.title};})()',session);
    for(const expected of ['Loan principal','Exchange margin','17,015,301.80','542,218,722.37 USDT-equivalent','not current custody assurance','12 EVM + 2 Solana'])assert(state.text.includes(expected),expected);
    assert(contrast(state.scopeColor,state.panelBackground)>=4.5,'scope text contrast');assert.equal(state.moneyWhiteSpace,'nowrap');assert.equal(state.dark,theme==='dark');assert(!state.overflow,'page overflow '+slug+' '+width);
    const shot=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},session);
    const file=slug+'-'+width+'-'+theme+'.png';fs.writeFileSync(path.join(out,file),Buffer.from(shot.data,'base64'));
    results.push({slug,width,theme,url:base+'?asset='+slug,normalization_version:'ethena-october-normalized-2026-11-23-v1',producer_version:'ethena-october-canonical-2026-11-23-v1',overflow:state.overflow,panelColor:state.panelColor,panelBackground:state.panelBackground,scope_contrast:contrast(state.scopeColor,state.panelBackground),screenshot:file});
    await cdp.send('Target.closeTarget',{targetId:target.targetId});console.log('PASS',slug,width,theme);
  }
  assert.equal(cdp.exceptions.length,0,'browser runtime exceptions '+cdp.exceptions);
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({browser:version.Browser,results,runtime_exceptions:cdp.exceptions},null,2)+'\n');
 }finally{if(socket)socket.close();chrome.kill('SIGTERM');setTimeout(()=>fs.rmSync(profile,{recursive:true,force:true}),1000).unref();}
})().catch(error=>{console.error(error);process.exitCode=1;});
