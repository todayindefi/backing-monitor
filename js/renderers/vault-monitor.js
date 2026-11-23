/* Shared vault-monitor preview shell. Fixed sections and metrics; strategies supply facts, not layouts. */
(function (root) {
'use strict';
const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const numeric = value => value !== null && value !== '' && value !== undefined && Number.isFinite(Number(value));
const number = (value, digits=2) => numeric(value) ? new Intl.NumberFormat('en-US',{maximumFractionDigits:digits}).format(Number(value)) : 'Unmeasured';
const money = value => numeric(value) ? new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:2}).format(Number(value)) : 'Unmeasured';
const compact = value => numeric(value) ? new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:2}).format(Number(value)) : 'Unmeasured';
const date = (value, compact=false) => { if(value===null||value===undefined||value==='')return 'Unmeasured';const d=new Date(value);return Number.isFinite(d.getTime()) ? new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',...(compact?{}:{year:'numeric'}),timeZone:'UTC'}).format(d) : 'Unknown date'; };
const time = value => new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'UTC'}).format(new Date(value))+' UTC';
const duration = seconds => numeric(seconds) ? (Number(seconds)%3600===0 ? number(Number(seconds)/3600)+'h' : number(Number(seconds)/60)+'m') : 'Unmeasured';
function validate(d) {
 if (!d || d.schema_version!=='vault-monitor/1' || typeof d.preview!=='boolean' || !d.asset || !d.observation || !d.metrics || !d.backing || !d.liquidity || !d.changes || !d.strategy || !d.dependencies || !d.controls || !d.issuer || !d.sources) throw Error('Unsupported or incomplete vault evidence.');
 if (!Number.isFinite(Date.parse(d.observation.at))) throw Error('Source observation clock is unavailable.');
 if (!['one_off','scheduled'].includes(d.observation.mode)) throw Error('Explicit update mode is required.');
 if(d.observation.mode==='scheduled' && (d.preview!==false || !numeric(d.observation.refresh_interval_seconds) || Number(d.observation.refresh_interval_seconds)<=0 || Number(d.observation.max_age_hours)*3600<Number(d.observation.refresh_interval_seconds)))throw Error('Invalid maintained feed cadence.');
 for(const k of ['share_nav_usd','marked_assets_usd']) if(!numeric(d.metrics[k]) || Number(d.metrics[k])<0) throw Error('Required accounting values are unavailable.');
 if(!Array.isArray(d.backing.positions) || !d.backing.positions.length) throw Error('Backing positions are unavailable.');
 for(const p of d.backing.positions) if(!numeric(p.marked_usd) || Number(p.marked_usd)<0 || !numeric(p.share_pct) || Number(p.share_pct)<0 || Number(p.share_pct)>100) throw Error('Invalid backing position.');
 const sum=d.backing.positions.reduce((s,p)=>s+Number(p.marked_usd),0);
 if(Math.abs(sum-Number(d.metrics.marked_assets_usd))>Math.max(.01,sum*1e-10)) throw Error('Backing positions do not reconcile with marked assets.');
 if(!Array.isArray(d.liquidity.outputs) || !d.liquidity.outputs.length) throw Error('Basket preview is unavailable.');
 for(const row of d.liquidity.outputs) for(const mode of ['queued','instant']) if(!numeric(row[mode]) || Number(row[mode])<0) throw Error('Invalid basket preview.');
 return d;
}
function chartSeries(history,gapSeconds=10800) {
 const segments=[];let current=[],previous=null;
 const flush=()=>{if(current.length)segments.push(current);current=[];previous=null;};
 for(const row of history || []) {
  if(!numeric(row.value) || Number(row.value)<0 || !Number.isFinite(Date.parse(row.at))){flush();continue;}
  const point={at:row.at,time:Date.parse(row.at),value:Number(row.value)};
  if(previous && (point.time<=previous.time || point.time-previous.time>gapSeconds*1000))flush();
  current.push(point);previous=point;
 }
 flush();return segments;
}
function chart(history,options={}) {
 const gapSeconds=numeric(options.gapSeconds)?Number(options.gapSeconds):10800;
 const segments=chartSeries(history,gapSeconds),points=segments.flat();
 if(points.length<2) return '<p class="small-note">Comparable NAV history unavailable.</p>';
 const values=points.map(p=>p.value),lo=Math.min(...values),hi=Math.max(...values),pad=Math.max((hi-lo)*.12,.00002),low=Math.max(0,lo-pad),high=hi+pad;
 const t0=Math.min(...points.map(p=>p.time)),t1=Math.max(...points.map(p=>p.time));
 if(t1<=t0) return '<p class="small-note">Comparable NAV history unavailable.</p>';
 const xy=p=>[48+(p.time-t0)/(t1-t0)*490,112-(p.value-low)/(high-low)*88];
 const paths=segments.map(group=>{const coords=group.map(xy),line=coords.map((p,i)=>(i?'L':'M')+p[0].toFixed(2)+','+p[1].toFixed(2)).join(' ');return {line,area:line+' L'+coords[coords.length-1][0].toFixed(2)+',120 L'+coords[0][0].toFixed(2)+',120 Z'};});
 const last=xy(points[points.length-1]),fullCount=numeric(options.fullCount)?Number(options.fullCount):(history || []).length;
 return '<svg class="nav-chart" viewBox="0 0 550 140" role="img" data-displayed-count="'+points.length+'" data-full-count="'+fullCount+'" data-segment-count="'+segments.length+'" data-source-min="'+lo+'" data-source-max="'+hi+'" aria-label="Native share NAV history: '+points.length+' of '+fullCount+' observations. Lines break across gaps greater than '+number(gapSeconds/3600)+' hours. Accounting marks, not total return.">'+paths.map(p=>'<path class="chart-area" d="'+p.area+'"/>').join('')+[0,1,2].map(i=>{const y=24+i*44;return '<line class="chart-axis" x1="48" x2="538" y1="'+y+'" y2="'+y+'"/><text class="chart-label" x="0" y="'+(y+4)+'">'+(high-(high-low)*i/2).toFixed(4)+'</text>';}).join('')+paths.map(p=>'<path class="chart-line" d="'+p.line+'"/>').join('')+'<circle class="chart-dot" cx="'+last[0]+'" cy="'+last[1]+'" r="4"/></svg><div class="chart-dates"><span>'+date(new Date(t0).toISOString(),true)+'</span><span>'+date(new Date(t1).toISOString(),true)+'</span></div><p class="chart-coverage">'+number(points.length)+' of '+number(fullCount)+' observations shown · Lines break after gaps &gt; '+number(gapSeconds/3600)+'h.</p>';
}
function basket(d,mode) {
 return d.liquidity.outputs.map(x=>'<div>'+number(x[mode],6)+' <small>'+esc(x.symbol)+'</small></div>').join('');
}
function feedHealth(d,now=Date.now()) {
 const age=(now-Date.parse(d.observation.at))/3600000;
 const status=(d.source_status || {}).status;
 if(status==='refreshing' && age<=Number(d.observation.max_age_hours))return {warning:false,clock:'Refreshing · last good observation',title:'Refresh in progress.',note:'The previous successful observation stays visible until the producer validates a new snapshot.'};
 if(['failed','degraded','unavailable'].includes(status))return {warning:true,clock:'Refresh failed · last good observation',title:'Refresh unavailable.',note:'Showing the last successful financial snapshot with its original source date. No failed attempt renews that observation.'};
 if(Number(d.metrics.share_nav_usd)===0 || Number(d.metrics.marked_assets_usd)===0)return {warning:true,clock:'Zero native accounting value',title:'Zero accounting value reported.',note:'The current source reports a zero share NAV or marked asset value. This is an observed value, not missing data or a risk score.'};
 if(age<0)return {warning:true,clock:'Source clock is ahead',title:'Source clock requires attention.',note:'The recorded observation is ahead of the browser clock. Original source dates are retained.'};
 if(age>Number(d.observation.max_age_hours))return {warning:true,clock:'Stale observation',title:'Financial snapshot is stale.',note:'The last successful observation is older than the freshness allowance. Values below retain their original date.'};
 if(d.observation.mode==='scheduled')return {warning:false,clock:'Eight-hour refresh',title:'Refresh every 8 hours.',note:'PegTracker supplies the financial observations; BM consumes and displays them. Controls and other sources keep their own dates.'};
 return {warning:false,clock:'One-off snapshot',title:'Snapshot preview.',note:d.observation.refresh_note};
}
function render(data) {
 const d=validate(data),m=d.metrics,at=d.observation.at;
 const health=feedHealth(d);
 const clockState=health.clock;
 const metrics=[['Share NAV','$'+number(m.share_nav_usd,6),'Native accounting mark; not market price'],['Marked assets',money(m.marked_assets_usd),'Oracle-valued tokens + lending claims'],['Observed return',numeric(m.observed_return_pct)?number(m.observed_return_pct)+'%':'Unmeasured',m.return_note],['Exit terms',duration(m.cooldown_seconds)+' / '+number(m.instant_fee_pct)+'%','Queued cooldown / instant basket fee']];
 const positions=d.backing.positions;
 const navOnly=(d.valuation || {}).mode==='nav_only';
 const valuationFacts=navOnly?'<div><span>Valuation basis</span><strong>'+esc(d.valuation.basis)+'</strong></div><div><span>Share payout</span><strong>'+esc(d.valuation.payout)+'</strong></div><p class="small-note">'+esc(d.valuation.note)+'</p>':'<div><span>Executable market price</span><strong>Unmeasured</strong></div><div><span>Market discount to NAV</span><strong>Unmeasured</strong></div><p class="small-note">NAV is not a cash quote. No total return, rewards or forward APY is inferred from this chart.</p>';
 const redemption=(d.liquidity.mode==='redemption');
 const liquidityMeasures=redemption?'<div class="liquidity-measure">USDC held at vault<strong>'+number(d.liquidity.direct_usdc)+' USDC</strong><small>Direct balance at the snapshot.</small></div><div class="liquidity-measure">USDC lending claim<strong>'+compact(d.liquidity.strategy_claim_usdc)+' USDC</strong><small>Needs release from Aave; not vault cash.</small></div><div class="liquidity-measure">Funded redemption capacity<strong>Unverified</strong><small>Reservations, release and final swap untested.</small></div>':'<div class="liquidity-measure">Sized final-cash depth<strong>'+money(d.liquidity.sized_cash_depth_usd)+'</strong><small>No completed cash ladder or guaranteed fill.</small></div>';
 const validLinks=(d.sources.links || []).filter(l=>/^https:\/\//.test(l.url));
 return '<section class="intro"><div class="identity"><div class="asset-mark" aria-hidden="true">'+esc(d.asset.symbol.slice(0,2))+'</div><div><div class="title-row"><h1>'+esc(d.asset.symbol)+'</h1><span class="chain-tag">'+esc(d.asset.chain)+'</span></div><p class="subtitle">'+esc(d.asset.name)+'</p><p class="description">'+esc(d.asset.description)+'</p></div></div><div class="source-clock"><strong>'+date(at)+' · '+time(at)+'</strong><span>'+esc(clockState)+' · Block '+esc(d.observation.block)+'</span></div></section>'+
 '<div class="snapshot-notice'+(health.warning?' refresh-alert':'')+'"'+(health.warning?' role="status"':'')+'><span><strong>'+esc(health.title)+'</strong> '+esc(health.note)+'</span><a class="notice-link" href="#sources">Source details</a></div>'+
 '<div class="change-strip" id="changes"><span class="change-label">Latest check</span><span>'+esc(d.changes.mode==='tracked'&&numeric(d.changes.nav_change_pct)?'NAV change '+(Number(d.changes.nav_change_pct)>=0?'+':'')+number(d.changes.nav_change_pct,4)+'% since prior financial snapshot.':'Accounting reconciled.')+' <a href="#liquidity">Cash exit remains unverified.</a></span><span class="baseline-tag">'+esc(d.observation.mode==='scheduled'?(d.changes.mode==='baseline'?'First maintained snapshot':'Eight-hour checks'):'Baseline only · no continuous alerts')+'</span></div>'+
 '<section class="metrics" aria-label="Standard vault summary">'+metrics.map((x,i)=>'<div class="metric"><div class="metric-label">'+esc(x[0])+'</div><div class="metric-value'+(i===2&&!numeric(m.observed_return_pct)?' missing':'')+'">'+esc(x[1])+'</div><div class="metric-note">'+esc(x[2])+'</div></div>').join('')+'</section>'+
 '<div class="nav-wrap"><nav class="section-nav" aria-label="Vault risk sections"><a href="#stability">NAV &amp; Stability</a><a href="#backing">Backing &amp; Strategy</a><a href="#liquidity">Liquidity &amp; Exit</a><a href="#dependencies">Dependencies</a><a href="#controls">Contract &amp; Admin</a><a href="#issuer">Issuer</a></nav><div class="nav-hint">Swipe or scroll for more sections</div></div>'+
 '<section class="panel" id="stability"><div class="panel-header"><div><div class="eyebrow">NAV &amp; Stability</div><h2>What is a share worth?</h2></div><span class="badge neutral">Native accounting mark</span></div><div class="stability-grid"><div><div class="chart-heading"><span>Share NAV history</span><span>USD / '+esc(d.asset.symbol)+'</span></div>'+chart(d.changes.history,{fullCount:d.changes.history_count,gapSeconds:d.changes.history_gap_seconds})+'<p class="small-note" style="margin-top:9px">'+esc(d.changes.history_note)+'</p></div><div class="stability-facts">'+valuationFacts+'</div></div></section>'+
 '<section class="panel wide" id="backing"><div class="panel-header"><div><div class="eyebrow">Backing &amp; Strategy</div><h2>Where is the money?</h2></div><span class="badge">Accounting reconciled</span></div><div class="backing-grid"><div>'+
 '<p class="mix-basis">Share of oracle-marked value</p><div class="allocation-bar" role="img" aria-label="'+esc(positions.filter(p=>Number(p.share_pct)>0).map(p=>p.symbol+' '+number(p.share_pct,1)+' percent marked value').join(', '))+'">'+positions.filter(p=>Number(p.share_pct)>0).map(p=>'<div class="allocation-'+(p.tone==='teal'?'teal':'blue')+'" style="width:'+Number(p.share_pct)+'%"></div>').join('')+'</div><div class="allocation-legend">'+positions.filter(p=>Number(p.share_pct)>0).map(p=>'<span><i class="legend-key allocation-'+(p.tone==='teal'?'teal':'blue')+'"></i>'+esc(p.symbol)+' '+number(p.share_pct,1)+'%</span>').join('')+'</div>'+
 positions.map(p=>'<div class="position"><div><div class="position-title">'+esc(p.symbol)+'</div><div class="position-sub">'+esc(p.location)+'</div></div><div class="position-value">'+money(p.marked_usd)+'<small>'+number(p.quantity,2)+' '+esc(p.symbol)+(p.kind==='lending_claim'?' claim':'')+'</small></div></div>').join('')+
 '<p class="small-note">'+esc(d.backing.note)+'</p><div class="coverage-line"><strong>Independent recovery</strong><span>Not verified</span></div></div>'+
 '<div class="strategy-inset" id="strategy"><div class="eyebrow">This vault’s strategy</div><h3>'+esc(d.strategy.title)+'</h3><p class="strategy-description">'+esc(d.strategy.description)+'</p>'+d.strategy.facts.map(f=>'<div class="strategy-fact"><div class="label">'+esc(f.label)+'</div><p>'+esc(f.value)+'</p><p class="small-note">'+esc(f.detail)+'</p></div>').join('')+'</div></div><details class="disclosure"><summary>Accounting scope &amp; remaining gaps</summary><ul>'+d.backing.details.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></details></section>'+
 '<section class="panel wide" id="liquidity"><div class="exit-top"><div><div class="eyebrow">Liquidity &amp; Exit</div><h2>'+(redemption?'How do I redeem?':'Can I get out?')+'</h2></div><span class="badge warning">'+esc(d.liquidity.status)+'</span></div><div class="tabs" role="tablist" aria-label="Redemption terms"><button type="button" role="tab" id="tab-queued" aria-selected="true" aria-controls="basket-preview" data-exit="queued">Queued · '+duration(m.cooldown_seconds)+'</button><button type="button" role="tab" id="tab-instant" aria-selected="false" aria-controls="basket-preview" tabindex="-1" data-exit="instant">Instant · '+number(m.instant_fee_pct)+'%</button></div>'+
 '<div id="basket-preview" role="tabpanel" aria-labelledby="tab-queued"><div class="exit-flow"><div class="flow-box"><div class="flow-label">Fixed share preview</div><div class="flow-value">'+number(d.liquidity.input_fxsp)+' '+esc(d.asset.symbol)+'</div></div><div class="flow-arrow" aria-hidden="true">→</div><div class="flow-box"><div class="flow-label" id="basket-label">Basket before final swap</div><div class="flow-value" id="basket-output">'+basket(d,'queued')+'</div></div><div class="flow-arrow" aria-hidden="true">→</div><div class="flow-box"><div class="flow-label">Final USDC delivery</div><div class="flow-unverified">Not verified</div><div class="small-note">fxUSD sale is an extra leg</div></div></div><p class="exit-rule" id="exit-rule">'+esc(d.liquidity.queued_note)+'</p></div>'+
 '<div class="liquidity-measures">'+liquidityMeasures+'</div><details class="disclosure"><summary>What is still unverified?</summary><ul>'+d.liquidity.remaining.map(x=>'<li>'+esc(x)+'</li>').join('')+'<li>Shared Aave reserve cash at the snapshot: '+compact(d.liquidity.shared_lender_usdc)+' USDC. This is shared, not dedicated vault capacity.</li>'+'</ul></details></section>'+
 '<div class="compact-risk-grid wide"><section class="panel compact-risk" id="dependencies"><div class="eyebrow">Dependencies</div><h2>What does it rely on?</h2><p class="small-note">'+esc(d.dependencies.summary)+'</p>'+d.dependencies.items.map(x=>'<div class="compact-fact"><strong>'+esc(x.name)+'</strong><p>'+esc(x.detail)+'</p></div>').join('')+'<p class="small-note">'+esc(d.dependencies.note)+'</p></section>'+
 '<section class="panel compact-risk" id="controls"><div class="eyebrow">Contract &amp; Admin</div><h2>'+esc(d.controls.headline)+'</h2><p class="dated-reference">Dated review · '+date(d.controls.at)+'</p><p class="small-note">'+esc(d.controls.note)+'</p><div class="compact-fact"><strong>'+esc(d.controls.source_status==='matched'?'Selected source/runtime matched':'Source/runtime scope unavailable')+'</strong><p>'+date(d.controls.source_match_at)+' · '+esc(d.controls.source_note || 'Selected scope only. Full audit and authority coverage remain unverified.')+'</p></div></section>'+
 '<section class="panel compact-risk" id="issuer"><div class="eyebrow">Issuer</div><h2>'+esc(d.issuer.headline)+'</h2><p class="dated-reference">'+esc(d.issuer.operator_label)+'</p><p class="small-note">'+esc(d.issuer.note)+'</p><div class="compact-fact"><strong>Separate underlying claims</strong><p>'+esc(d.issuer.dependency_note)+'</p></div></section></div>'+
 '<details class="sources" id="sources"><summary>Source clocks, contract links &amp; scope</summary><div class="source-body"><p>Native snapshot: '+date(at)+' · '+time(at)+' · Ethereum block '+esc(d.observation.block)+'.</p><p>'+esc(d.sources.clock_note)+'</p><p>'+esc(d.sources.price_note)+'</p><p>Secondary share-market coverage: '+esc((d.valuation || {}).share_market_coverage || 'unspecified')+'. This is not evidence that no secondary market exists.</p><p>Pool supply: '+number(m.share_supply,6)+' '+esc(d.asset.symbol)+'. No wrapper or gauge supply is substituted.</p><p>Control reference: '+date(d.controls.at)+' · block '+esc(d.controls.block)+'. This predates the financial snapshot and does not establish current authority clearance.</p><div class="source-links">'+validLinks.map(l=>'<a href="'+esc(l.url)+'" target="_blank" rel="noopener noreferrer">'+esc(l.label)+'</a>').join('')+'</div></div></details><footer class="footer"><span>'+esc(d.notice)+'</span><span>Native accounting ≠ guaranteed cash recovery</span></footer>';
}
const api={render,validate,chart,chartSeries,feedHealth,numeric};root.VaultMonitor=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(typeof document!=='undefined') document.addEventListener('DOMContentLoaded',()=>{
 const container=document.getElementById('vault-root'),toggle=document.getElementById('theme-toggle');let current=null,fingerprint=null,observer=null,timer=null;
 const themeLabel=()=>{const dark=document.documentElement.dataset.theme==='dark';toggle.textContent=dark?'Light mode':'Dark mode';toggle.setAttribute('aria-pressed',String(dark));};
 themeLabel();toggle.addEventListener('click',()=>{const dark=document.documentElement.dataset.theme!=='dark';document.documentElement.dataset.theme=dark?'dark':'light';try{localStorage.setItem('vault-theme',dark?'dark':'light');}catch{}themeLabel();});
 function paint(data) {
  const scroll=window.scrollY,mode=container.querySelector('[data-exit][aria-selected="true"]')?.dataset.exit || 'queued';
  const opened=[...container.querySelectorAll('details')].map(x=>x.open);
  if(observer)observer.disconnect();
  container.innerHTML=render(data);current=data;document.title=data.asset.symbol+' · Vault monitor'+(data.preview?' preview':'');
  const tag=document.querySelector('.preview-tag');if(tag)tag.textContent=data.preview?'Design preview':'8h refresh';
  const select=mode=>{container.querySelectorAll('[data-exit]').forEach(b=>{const chosen=b.dataset.exit===mode;b.setAttribute('aria-selected',String(chosen));b.tabIndex=chosen?0:-1;});document.getElementById('basket-preview').setAttribute('aria-labelledby','tab-'+mode);document.getElementById('basket-output').innerHTML=basket(data,mode);document.getElementById('basket-label').textContent=mode==='instant'?'Basket after instant fee':'Basket before final swap';document.getElementById('exit-rule').textContent=data.liquidity[mode+'_note'];};
  const nav=container.querySelector('.section-nav'),wrap=container.querySelector('.nav-wrap');
  const updateNav=()=>{wrap.classList.toggle('is-scrollable',nav.scrollWidth>nav.clientWidth+2);document.documentElement.style.setProperty('--vault-nav-clearance',(wrap.getBoundingClientRect().height+16)+'px');};
  updateNav();if(typeof ResizeObserver!=='undefined'){observer=new ResizeObserver(updateNav);observer.observe(nav);}
  container.querySelectorAll('[data-exit]').forEach(b=>{b.addEventListener('click',()=>select(b.dataset.exit));b.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const other=b.dataset.exit==='queued'?'instant':'queued';select(other);document.getElementById('tab-'+other).focus();}});});
  select(mode);container.querySelectorAll('details').forEach((x,i)=>{x.open=!!opened[i];});if(scroll)window.scrollTo(0,scroll);
 }
 async function load() {
  try{
   let data;
   if(root.VAULT_PREVIEW_DATA)data=root.VAULT_PREVIEW_DATA;
   else{const response=await fetch(document.documentElement.dataset.feed || 'data/vault.json',{cache:'no-store'});if(!response.ok)throw Error('Evidence unavailable.');data=await response.json();}
   validate(data);
   const statusURL=document.documentElement.dataset.statusFeed;
   if(statusURL&&(data.preview!==false||data.observation.mode!=='scheduled'))throw Error('Maintained route cannot use a manual preview snapshot');
   if(statusURL){try{const response=await fetch(statusURL,{cache:'no-store'});if(!response.ok)throw Error('Status unavailable');const status=await response.json();if(status.schema_version!=='vault-source-status/1'||status.asset!==(data.asset_slug||data.asset.symbol.toLowerCase())||!['ok','failed','unavailable','refreshing','degraded'].includes(status.status))throw Error('Invalid source status');if(status.source_observed_at && status.source_observed_at!==data.observation.at)data.source_status={status:'degraded'};else data.source_status={status:status.status};}catch{data.source_status={status:'unavailable'};}}
   const next=JSON.stringify([data,feedHealth(data).clock]);if(next!==fingerprint){paint(data);fingerprint=next;}
   if(data.observation.mode==='scheduled'&&!timer)timer=setInterval(load,300000);
  }catch(error){
   if(current){const retained={...current,source_status:{status:'unavailable'}};paint(retained);fingerprint=null;}
   else container.innerHTML='<div class="error" role="alert"><strong>Vault evidence unavailable.</strong><p>Required data could not be loaded or validated. No cached values or zero balances have been substituted.</p></div>';
   if(document.documentElement.dataset.statusFeed&&!timer)timer=setInterval(load,300000);
  }
 }
 load();
});
})(typeof globalThis!=='undefined'?globalThis:this);
