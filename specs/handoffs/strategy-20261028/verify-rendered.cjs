// Run from the backing-monitor repository root. Captures generated reader HTML;
// it does not assert browser layout or live deployment success.
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const out='specs/handoffs/strategy-20261028';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const results=[];
for(const slug of ['mstr','strc','strcx','apxusd','apyusd','susdat']){
 const elements={};
 function element(){return {innerHTML:'',textContent:'',children:[],style:{},dataset:{},classList:{add(){},remove(){},toggle(){},contains(){return false}},appendChild(x){this.children.push(x)},setAttribute(){},removeAttribute(){},closest(){return null},querySelector(){return null},querySelectorAll(){return []}}}
 const document={getElementById(id){if(/chart|canvas|trajectory|event-log|peg-hist|peg-chart|par-7d/i.test(id))return null;return elements[id]||(elements[id]=element())},createElement:element,querySelectorAll:()=>[]};
 const ctx=vm.createContext({console,document,window:{},fetch:async()=>({ok:false,json:async()=>null}),setTimeout:()=>0});
 for(const file of ['common','strc','mstr','strcx','apyx','saturn'])vm.runInContext(fs.readFileSync('js/renderers/'+file+'.js','utf8')+(file==='common'?'\nthis.CommonRenderer=CommonRenderer;':''),ctx);
 const c=ctx.CommonRenderer,src=['mstr','strcx'].includes(slug)?'strc':slug;
 const data=read('data/'+src+'_backing.json'),original=structuredClone(data),overlays=[];
 for(const [axis,suffixes] of Object.entries(c.AXIS_OVERLAYS))for(const suffix of [].concat(suffixes)){const file='data/'+slug+suffix+'.json';if(fs.existsSync(file))overlays.push({axis,file,json:read(file)});}
 c.FAMILY_ENVELOPE=fs.existsSync('data/'+src+'_axis_basis.json')?read('data/'+src+'_axis_basis.json'):null;
 c.mergeAxisOverlays(data,overlays,slug);
 const renderer=ctx[{mstr:'MSTRRenderer',strc:'STRCRenderer',strcx:'STRCxRenderer',apxusd:'ApyxRenderer',apyusd:'ApyxRenderer',susdat:'SaturnRenderer'}[slug]];
 assert.ok(renderer,slug+' renderer');
 const history=read('data/'+src+'_backing_history.json');
 if(renderer.preRender)renderer.preRender(data,history);
 if(slug==='mstr')assert.equal(!!data.peg,false,'MSTR must not inherit STRC axes');
 else c.renderAxisSections(data,history);
 // Instrument-specific panels use the same family score helper as their render entry point.
 let native='';
 if(slug==='mstr')native=renderer._renderHeadlineBanner(data.tradfi,data.mstr_view)+renderer._renderMnavRegime(data.tradfi,data.digital_credit_framework)+ctx.MSTR_FRAMEWORK_CARD(data.digital_credit_framework);
 if(slug==='strc')native=renderer._renderHeadlineBanner(data.tradfi)+renderer._renderDependencyStrategyFunding(data.tradfi,data.digital_credit_framework)+ctx.STRC_FRAMEWORK_CARD(data.digital_credit_framework);
 const flatten=e=>(e.innerHTML||'')+(e.textContent||'')+(e.children||[]).map(flatten).join('');
 const html=native+Object.values(elements).map(flatten).join('\n');
 const scores={};
 for(const axis of ['peg','backing','liquidity','dependencies','contract','issuer'])for(const [k,v]of Object.entries(data[axis]||{}))if(k.endsWith('_score')&&typeof v==='number')scores[axis+'.'+k]=v;
 if(['mstr','strc'].includes(slug)){
   assert.match(html,/MSTR 3\.5<\/span>/);assert.match(html,/STRC 3\.0<\/span>/);assert.match(html,/STRCx 3\.0<\/span>/);
   assert.match(html,/4\.83/);
 }
 if(['apxusd','apyusd','susdat'].includes(slug)){
   assert.equal(JSON.stringify(data.liquidity.exit_mark),JSON.stringify(original.liquidity.exit_mark),'venue-only overlay must preserve PegTracker quotes and convention');
   assert.equal(data.liquidity.total_2pct_depth,original.liquidity.total_2pct_depth);
   assert.equal(data.liquidity.depth_50bps.depth_usd,original.liquidity.depth_50bps.depth_usd);
   const authored=read('data/'+slug+'_axis_basis.json');
   for(const axis of ['peg','backing','liquidity','dependencies','issuer'])for(const [key,value]of Object.entries(authored[axis]||{}))if(key.endsWith('_score'))assert.equal(data[axis][key],value);
   assert.match(html,/October 26|October26|2026-10-26/);
 }
 if(slug==='strcx'){assert.equal(data.liquidity.liquidity_score,2.5);assert.equal(data.peg.volatility_score,4.5);assert.match(html,/Held 2\.5/);}
 fs.writeFileSync(out+'/'+slug+'-rendered.html',html);
 results.push({slug,base:src+'_backing.json',scores,family_overalls:['mstr','strc'].includes(slug)?{mstr:3.5,strc:3,strcx:3}:undefined,verification:'generated HTML; no browser/layout assertion',passed:true});
}
fs.writeFileSync(out+'/rendered-verification.json',JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results,null,2));
