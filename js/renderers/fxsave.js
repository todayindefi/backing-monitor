/** FXSave: a claim on fxSP with a two-token exit. See specs/fxsave-feed-contract.md. */
var FxSaveRenderer = {
    e: function(v) { return CommonRenderer._escapeAttr(String(v == null ? '' : v)); },
    n: function(v, digits) { return Number.isFinite(v) ? v.toLocaleString('en-US', {maximumFractionDigits: digits == null ? 6 : digits}) : 'Not measured'; },
    panel: function(title, html) { return '<section class="panel"><h2 class="panel-title">'+this.e(title)+'</h2>'+html+'</section>'; },
    note: function(text) { return '<p class="fxsave-note">'+this.e(text)+'</p>'; },
    metrics: function(rows) {
        var self=this;
        return '<div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4 fxsave-standard-metrics">'+rows.map(function(r) { return '<div class="summary-card"><div class="card-label">'+self.e(r[0])+'</div><div class="card-value">'+self.e(self.n(r[1],r[3]))+'</div><div class="text-xs text-slate-400 mt-1">'+self.e(r[2] || '')+'</div></div>'; }).join('')+'</div>';
    },
    validDetail: function(d) { return d && d.schema_version==='fxsave-detail/1'; },
    basket: function(b) {
        if (!b || !Number.isFinite(b.fxusd_per_share) || !Number.isFinite(b.usdc_per_share) || b.fxusd_per_share<0 || b.usdc_per_share<0) return 'Basket unavailable — both output legs are required';
        return this.n(b.fxusd_per_share)+' fxUSD + '+this.n(b.usdc_per_share)+' USDC';
    },
    // A missing leg must never become zero or an apparently complete dollar payout.
    markedBasket: function(b, fxusdMark, usdcMark) {
        if (!b || !Number.isFinite(b.fxusd_per_share) || !Number.isFinite(b.usdc_per_share) || b.fxusd_per_share<0 || b.usdc_per_share<0 || !Number.isFinite(fxusdMark) || !Number.isFinite(usdcMark) || fxusdMark<=0 || usdcMark<=0) return null;
        return b.fxusd_per_share*fxusdMark+b.usdc_per_share*usdcMark;
    },
    preRender: function(data) {
        if (!this.validDetail((data.asset_specific || {}).fxsave)) return;
        data.summary=data.summary || {}; data.backing=data.backing || {};
        data.summary.collateral_ratio=null; data.summary.total_backing=null;
        data.backing.collateral_ratio=null; data.backing.total_backing=null;
        data.backing_breakdown=[];
        var adopted={backing:['pass_through'],liquidity:['redemption_component'],dependencies:['coverage_policy','provenance_reconciliation']};
        Object.keys(adopted).forEach(function(axis){var notes=(CommonRenderer.AXIS_AUTHORED_NOTES || {})[axis];if(notes && notes.unreadBlocks)notes.unreadBlocks=notes.unreadBlocks.filter(function(key){return adopted[axis].indexOf(key)<0;});});
    },
    details: function(title,html) { return '<details class="fxsave-details"><summary>'+this.e(title)+'</summary>'+html+'</details>'; },
    clock: function(at,block) { return this.note('Observed '+this.quoteTime(at)+(block ? ' · Ethereum block '+block : '')); },
    overview: function(d) {
        var a=d.assessment || {};
        return this.panel('Historical authored assessment',this.note('Overall '+this.n(a.overall_score,1)+'/10 · '+(a.status || 'review status unavailable')+' · score date '+(a.score_as_of || 'unavailable'))+this.details('Recorded historical axis judgments · not current measured bands',this.table(['Axis','Authored score /10'],Object.keys(a.recorded_scores || {}).map(function(key){return [key,this.n(a.recorded_scores[key],1)];},this))));
    },
    marketComparison: function(peg,now) {
        peg=peg || {};now=now==null ? Date.now() : now;
        if(!Number.isFinite(peg.nav) || peg.nav<=0)return {valid:false,reason:'contract NAV is unavailable'};
        if(!Number.isFinite(peg.market_price) || peg.market_price<=0)return {valid:false,reason:'no timestamp-matched market mark'};
        if(peg.status==='indicative_market_quote') {
            var o=peg.market_observation || {},ref=o.usd_reference || {};
            function fail(reason){return {valid:false,reason:reason};}
            if(o.status!=='indicative_usd_quote' || o.kind!=='indicative_sell_quote' || o.premium_discount_eligible!==true || o.usd_status!=='reference_available' || ref.status!=='ok')return fail('indicative quote or USD reference failed');
            if(o.atomic_execution!==false || o.gas_included!==false || !(o.input_shares>0) || o.input_units!=='fxSAVE shares (18 decimals)' || o.output_units!=='USDC (6 decimals)')return fail('unreviewed quote size, units or execution scope');
            var clocks=[peg.market_price_as_of,peg.nav_as_of,o.as_of,o.provider_as_of,ref.read_block_as_of].map(Date.parse);
            if(clocks.some(function(t){return !Number.isFinite(t) || t>now+300000 || now-t>14400000;}) || Math.max.apply(null,clocks)-Math.min.apply(null,clocks)>120000)return fail('quote/NAV/oracle-read clocks are stale or mismatched');
            var updated=Date.parse(ref.as_of);
            if(ref.heartbeat_seconds!==82800 || o.usd_reference_max_age_seconds!==82800 || !ref.heartbeat_source || !Number.isFinite(updated) || updated>Math.min.apply(null,clocks)+300000 || now-updated>82800000)return fail('oracle update is outside its verified heartbeat');
            if(!Number.isFinite(ref.usd_per_token) || ref.usd_per_token<=0 || !Number.isFinite(o.price_usdc_per_share) || o.price_usdc_per_share<=0 || Math.abs(o.price_usdc_per_share*ref.usd_per_token-peg.market_price)>1e-9 || Math.abs(o.price_usd_per_share-peg.market_price)>1e-9 || !Number.isFinite(o.price_usd_per_share))return fail('USD conversion is inconsistent');
            return {valid:true,indicative:true,reason:null};
        }
        var market=Date.parse(peg.market_price_as_of),nav=Date.parse(peg.nav_as_of);
        if(!Number.isFinite(market) || !Number.isFinite(nav))return {valid:false,reason:'one or both observation clocks are unavailable'};
        if(market>now+300000 || nav>now+300000)return {valid:false,reason:'an observation clock is in the future'};
        if(now-market>7200000 || now-nav>7200000 || Math.abs(market-nav)>7200000)return {valid:false,reason:'market/reference observations are stale or mismatched'};
        if(peg.status!=='ok')return {valid:false,reason:'producer comparison status: '+(peg.status || 'unavailable')};
        return {valid:true,reason:null};
    },
    reference: function(data,history) {
        var peg=data.peg || {}, nav=Number.isFinite(peg.nav) && peg.nav>0;
        var comparison=this.marketComparison(peg),priced=comparison.valid;
        var row=[[comparison.indicative ? 'Indicative exit value / share' : 'Market price',priced ? peg.market_price : null,'USD / share'],['Reference NAV',nav ? peg.nav : null,'USD / share'],['Premium / discount',priced ? (peg.market_price/peg.nav-1)*100 : null,'%',4]];
        var deviations=this.priceSeries(history).filter(function(p){return p.quote!==null && p.nav>0;}).map(function(p){return (p.quote/p.nav-1)*100;});
        if(deviations.length){row.push(['7d indicative deviation · minimum',Math.min.apply(null,deviations),'%',4]);row.push(['7d indicative deviation · maximum',Math.max.apply(null,deviations),'%',4]);}
        return this.panel('Price and contract reference',this.metrics(row)+this.clock(peg.nav_as_of)+
            this.note('Reference source: '+(peg.nav_source || 'not established')+'. '+(peg.nav_basis || 'Reference basis unavailable.'))+
            this.details('Quote source, oracle clocks and route evidence',this.marketEvidence(peg))+this.note(priced ? 'Market observed '+(peg.market_price_as_of || 'time unavailable')+' · '+(peg.market_price_source || (peg.market_observation || {}).source || 'source unavailable') : 'Market comparison unavailable: '+comparison.reason+'. '+(peg.history_ref ? 'A market history reference is declared; availability must be checked separately.' : 'No market/peg history is published as a standard traded-price series. Historical indicative exit quotes, where available, are plotted separately below.')));
    },
    marketEvidence: function(peg) {
        var o=peg.market_observation;if(!o)return '';
        var ref=o.usd_reference || {};
        return this.note('Size-specific indicative sell quote: '+this.n(o.input_shares)+' shares · '+(o.source || 'source unavailable')+'. Gas excluded; route estimates are not atomic executions. Provider route blocks may be cached and differ from the NAV block.')+
            this.table(['Observation','Original clock / basis'],[['Quote',o.as_of || 'unavailable'],['Provider',o.provider_as_of || 'unavailable'],['Oracle read',ref.read_block_as_of || 'unavailable'],['Oracle updatedAt',ref.as_of || 'unavailable'],['Oracle update age',Number.isFinite(Date.parse(ref.as_of)) ? this.n((Date.now()-Date.parse(ref.as_of))/3600000,2)+' hours; heartbeat '+this.n(ref.heartbeat_seconds/3600,2)+' hours' : 'unavailable'],['Route blocks',(o.route_blocks || []).join(', ')],['USD reference',ref.source || 'unavailable']])+this.note(o.comparison_rule || 'Comparison policy unavailable.')+this.note('Historical indicative quotes, where eligible, are charted separately from contract NAV; they do not establish unrestricted market-price history.');
    },
    priceSeries: function(history,now) {
        var self=this,rows=this.historyRows(history,now),native=(history || {}).price_history || {};
        var identity=native.asset_slug==='fxsave' && native.chain==='ethereum' && native.contract_address==='0x7743e50f534a7f9f1791dde7dcd89f7783eefc39' && native.units==='USD/share';
        var points=identity ? this.historyRows(native,now) : [];
        var byTime={};rows.forEach(function(row){byTime[row.timestamp]=row;});
        return points.map(function(point){
            var row=byTime[point.timestamp],peg=(row || {}).peg || {},o=peg.market_observation || {};
            var historicalNow=Math.max(Date.parse(point.timestamp),Date.parse(peg.market_price_as_of)||0);
            var valid=!!row && Number.isFinite(point.peg_theoretical_price) && point.peg_theoretical_price>0 && Math.abs(point.peg_theoretical_price-row.nav_usd)<1e-10;
            var quote=valid && o.input_shares===100 && self.marketComparison(peg,historicalNow).valid;
            return {timestamp:point.timestamp,nav:valid ? point.peg_theoretical_price : null,market:null,quote:quote ? peg.market_price : null,quote_as_of:quote ? peg.market_price_as_of : null,block:point.block};
        });
    },
    pricePanel: function(history,now) {
        var points=this.priceSeries(history,now),nav=points.filter(function(p){return p.nav!==null;}),quotes=points.filter(function(p){return p.quote!==null;});
        var total=(((history || {}).price_history || {}).entries || []).length;
        if(nav.length<2)return this.panel('Price history · trailing 7 days',this.note('Insufficient validated NAV observations in the trailing seven-day window. No wider history is substituted.'));
        return this.panel('Price history · trailing 7 days',
            '<div class="fxsave-price-chart-wrap"><canvas id="fxsave-price-chart" role="img" aria-label="fxSAVE USD per share: contract NAV and size-specific indicative 100-share exit quotes"></canvas></div>'+
            this.note('USD / share · trailing 7 days · '+nav.length+' of '+total+' retained NAV observations; '+quotes.length+' validated 100-share indicative exit quotes. Actual NAV coverage '+nav[0].timestamp+' to '+nav[nav.length-1].timestamp+'.')+
            this.note('Source: PegTracker native USD candidate, fxSAVE.nav(); historical routed sell quotes from the retained backing observations. Standard market-price history is unavailable. The coloured line is a size-specific exit quote, gas excluded, not an unrestricted spot price. Missing or mismatched quotes stay gaps; no backfill or interpolation.')+
            (quotes.length ? this.note('Quote coverage '+quotes[0].quote_as_of+' to '+quotes[quotes.length-1].quote_as_of+'. Historical eligibility is checked at the observation time; it does not establish current availability.') : this.note('No eligible indicative quotes in this window.')));
    },
    paintPriceChart: function(history) {
        var canvas=document.getElementById('fxsave-price-chart');
        if(!canvas)return;
        if(window._fxsavePriceChart)window._fxsavePriceChart.destroy();
        if(typeof Chart==='undefined'){canvas.parentElement.innerHTML=this.note('Price chart library unavailable; reload to retry.');return;}
        var series=this.priceSeries(history),dark=document.body.classList.contains('dark'),ink=dark ? '#cbd5e1' : '#475569';
        function values(key){
            var result=[],previous=null;
            series.forEach(function(p){var time=Date.parse(key==='quote' && p.quote_as_of ? p.quote_as_of : p.timestamp);
                if(previous!==null && time-previous>2*3600000)result.push({x:previous+1,y:null});
                result.push({x:time,y:p[key],block:p.block});previous=time;});return result;
        }
        window._fxsavePriceChart=new Chart(canvas,{
            type:'line',data:{datasets:[
                {label:'Contract NAV / share',data:values('nav'),borderColor:ink,borderWidth:3,borderDash:[7,4],pointRadius:0,pointHitRadius:8,fill:false,order:0,spanGaps:false,tension:0},
                {label:'Indicative exit value · 100 shares · gas excluded',data:values('quote'),borderColor:'#6366f1',backgroundColor:'rgba(99,102,241,.06)',borderWidth:1.4,pointRadius:0,pointHitRadius:8,fill:false,order:1,spanGaps:false,tension:0}
            ]},options:{responsive:true,maintainAspectRatio:false,animation:false,interaction:{mode:'nearest',intersect:false},scales:{
                x:{type:'time',min:Date.now()-7*86400000,max:Date.now(),time:{unit:'day',displayFormats:{day:'MMM d'}},ticks:{maxTicksLimit:8,color:ink},grid:{display:false}},
                y:{title:{display:true,text:'USD / share',color:ink},ticks:{color:ink,callback:function(v){return Number(v).toFixed(4);}},grid:{color:dark ? '#334155' : '#e2e8f0'}}
            },plugins:{legend:{labels:{color:ink,boxWidth:22}},tooltip:{callbacks:{title:function(items){return items.length ? new Date(items[0].parsed.x).toISOString().replace('T',' ').slice(0,19)+' UTC' : '';},label:function(item){return item.dataset.label+': $'+item.parsed.y.toFixed(6)+' / share';}}}}}
        });
    },
    historyRows: function(history,now) {
        var cutoff=(now==null ? Date.now() : now)-7*86400000;
        return ((history || {}).entries || []).filter(function(row){var time=Date.parse(row.timestamp);return Number.isFinite(time) && time>=cutoff && time<=(now==null ? Date.now() : now);}).sort(function(a,b){return Date.parse(a.timestamp)-Date.parse(b.timestamp);});
    },
    historyPanel: function(history,field,title,unit) {
        var rows=this.historyRows(history), self=this;
        function value(row){return field==='nav_usd' ? row.nav_usd : (row.detail || {})[field];}
        rows=rows.filter(function(row){return Number.isFinite(value(row));});
        var total=((history || {}).entries || []).length;
        if(rows.length<2)return this.panel(title,this.note('Insufficient observations in the trailing 7-day window: '+rows.length+' usable of '+total+' retained readings. No wider history is substituted.'));
        var times=rows.map(function(row){return Date.parse(row.timestamp);}), vals=rows.map(value);
        var lo=Math.min.apply(null,vals), hi=Math.max.apply(null,vals), span=hi-lo;
        var pad=span ? span*.12 : Math.max(Math.abs(lo)*1e-6,1e-9);lo-=pad;hi+=pad;
        var first=times[0],last=times[times.length-1];
        if(last===first)return this.panel(title,this.note('Insufficient distinct observation times in trailing 7 days.'));
        var points=rows.map(function(row){return (70+(Date.parse(row.timestamp)-first)/(last-first)*590).toFixed(2)+','+(190-(value(row)-lo)/(hi-lo)*150).toFixed(2);}).join(' ');
        var svg='<svg class="fxsave-history-chart" viewBox="0 0 720 240" role="img" aria-label="'+this.e(title)+'"><title>'+this.e(title+' · '+unit)+'</title><line x1="70" y1="190" x2="660" y2="190" stroke="currentColor" opacity=".2"/><polyline fill="none" stroke="#3b82f6" stroke-width="2.5" points="'+points+'"/><text x="8" y="45">'+this.e(this.n(hi,6))+'</text><text x="8" y="192">'+this.e(this.n(lo,6))+'</text><text x="70" y="218">'+this.e(rows[0].timestamp)+'</text><text x="660" y="235" text-anchor="end">'+this.e(rows[rows.length-1].timestamp)+'</text></svg>';
        return this.panel(title,this.note('Trailing 7-day window · '+rows.length+' of '+total+' retained readings · actual coverage '+rows[0].timestamp+' to '+rows[rows.length-1].timestamp+'. Forward observations only; sparse history is not a full week.')+svg+this.note('Units: '+unit+'. '+(field==='nav_usd' ? 'Contract reference only; no market-price line is available.' : 'Share conversion is not independent dollar collateral coverage.')));
    },
    redemption: function(d,liquidity) {
        var r=d.redemption || {}, evidence=r.evidence || {};
        return this.panel('Primary redemption · two-token payout',this.clock(r.as_of || d.as_of,r.block || d.block)+
            '<div class="fxsave-routes"><article><h3>Queued preview</h3><strong>'+this.e(this.basket(r.queued))+'</strong>'+this.note('Queue: '+this.n(r.queue_seconds,0)+' seconds')+'</article><article><h3>Instant simulation</h3><strong>'+this.e(this.basket(r.instant))+'</strong>'+this.note('Instant fee: '+this.n(r.instant_fee_pct,2)+'% · included once in the displayed outputs')+'</article></div>'+
            this.note('Outputs are fxUSD plus USDC; only the fxUSD portion needs a market sale. Simulations are read-only and exclude gas/market impact.')+
            this.table(['Holder evidence','Result'],[['Funded share holder',(evidence.funded_holder || {}).status || 'not measured'],['Caller', (evidence.funded_holder || {}).caller || 'not established'],['maxRedeem for that holder',this.n(evidence.max_redeem_morpho_shares,6)+' shares'],['Burn-address negative control',(evidence.negative_control || {}).status || 'not measured'],['Funded fxSP gauge instant exit',(evidence.funded_fxsp_gauge || {}).status || 'not measured']])+
            this.details('Redemption measurement basis',this.note(typeof r.evidence==='string' ? r.evidence : (evidence.instant_basis || 'Fee reconciliation basis unavailable.'))+this.note('These results establish the sampled caller and size only, not permissionless future execution for every holder.'))+((liquidity || {}).redemption_component ? this.details('Historical redemption evidence · not a separate axis',this.note(JSON.stringify(liquidity.redemption_component))) : ''));
    },
    concentration: function(d) {
        var c=d.concentration || {};
        var triggered=Number.isFinite(c.morpho_pct) && Number.isFinite(c.review_trigger_pct) && c.morpho_pct>c.review_trigger_pct;
        return this.panel('Morpho concentration',this.metrics([['Morpho share balance',c.morpho_shares,'fxSAVE',2],['Share of total supply',c.morpho_pct,'%',2],['Assessment review trigger',c.review_trigger_pct,'%',0]])+
            this.note(triggered ? 'Review trigger exceeded. A large collateral unwind must convert its fxUSD output into independent dollars.' : 'Compare measured concentration with the authored review trigger; missing observations do not establish safety.'));
    },
    table: function(heads,rows) {
        var self=this;
        var numeric=heads.map(function(_,i){return i>0 && rows.some(function(row){return /^-?[0-9,]+(?:\.[0-9]+)?$/.test(String(row[i]));}) && rows.every(function(row){return /^-?[0-9,]+(?:\.[0-9]+)?$/.test(String(row[i])) || /^(Not measured|Unavailable)$/.test(String(row[i]));});});
        return '<div class="fxsave-table-scroll"><table class="data-table"><thead><tr>'+heads.map(function(h,i){return '<th'+(numeric[i] ? ' class="text-right"' : '')+'>'+self.e(h)+'</th>';}).join('')+'</tr></thead><tbody>'+rows.map(function(row){return '<tr>'+row.map(function(v,i){return '<td'+(numeric[i] ? ' class="text-right font-mono"' : '')+'>'+self.e(v)+'</td>';}).join('')+'</tr>';}).join('')+'</tbody></table></div>';
    },
    routeCost: function(row,kind) {
        var quote=row[kind];
        if(!quote || quote.status!=='ok' || !Number.isFinite(quote.usdc_out) || !(row.size_nav_usd>0))return null;
        var rawUsdc=(row.instant || {}).usdc_raw;
        if(kind==='fxusd_market' && (rawUsdc==null || !/^\d+$/.test(String(rawUsdc))))return null;
        var directUsdc=kind==='fxusd_market' ? Number(rawUsdc)/1e6 : 0;
        if(!Number.isFinite(directUsdc))return null;
        var mark=row.usdc_usd_mark==null ? 1 : row.usdc_usd_mark;
        if(!Number.isFinite(mark) || mark<=0)return null;
        return (1-(quote.usdc_out+directUsdc)*mark/row.size_nav_usd)*10000;
    },
    crossingEvidence: function(ladder) {
        var profiles=ladder.route_profiles || {},self=this,rows=[];
        Object.keys(profiles).forEach(function(route){[50,200].forEach(function(t){var p=profiles[route][String(t)];if(!p)return;rows.push([route,t+' bps',p.status,self.n(p.baseline_size_nav_usd,0),p.precision_obligation_met===true ? 'Met' : 'Not met · floor only',(p.endpoint_revalidation || {}).bracket_holds===true ? 'Bracket held' : 'Not verified']);});});
        if(!rows.length)return '';
        var probes=ladder.diagnostic_probes || [];
        return this.details('Crossing quality and diagnostic probes',this.table(['Route','Threshold','Status','Baseline NAV USD','1% precision','Endpoint recheck'],rows)+this.note(ladder.crossing_quality || '')+this.table(['Input NAV USD','Probe kind','Route','Status','Observed UTC'],probes.flatMap(function(p){return Object.keys(p.routes || {}).filter(function(route){return p.routes[route].status!=='not_measured_after_termination';}).map(function(route){var q=p.routes[route];return [self.n(p.size_nav_usd,0),p.rung_kind || 'diagnostic',route,q.status || 'unavailable',self.quoteTime(q.as_of)];});})));
    },
    exitEvidence: function(ladder) {
        if(!ladder.market_marks)return '';
        var ref=ladder.market_marks.usdc || {};
        return this.details('Liquidity reference, clocks and gas',this.note(ladder.mark_convention || '')+this.note('Oracle updatedAt '+(ref.as_of || 'unavailable')+'; read block clock '+(ref.read_block_as_of || 'unavailable')+'. '+(ladder.clock_basis || ''))+this.note(ladder.gas_basis || 'Complete path gas unavailable')+this.table(['Size NAV USD','Route','Clock status','Swap-only gas USD'],(ladder.rows || []).flatMap(function(row){return ['direct','fxusd_market'].map(function(kind){var q=row[kind] || {},g=q.gas_estimate || {};return [row.size_nav_usd,kind,q.clock_status || 'unavailable',g.route_gas_usd==null ? 'unavailable' : g.route_gas_usd];});})));
    },
    quoteChart: function(ladder) {
        var self=this, rows=ladder.rows || [];
        if(rows.length<2)return this.note('Insufficient quote sizes for a profile.');
        var lo=Math.log10(Math.min.apply(null,rows.map(function(r){return r.size_nav_usd;})));
        var hi=Math.log10(Math.max.apply(null,rows.map(function(r){return r.size_nav_usd;})));
        if(!(hi>lo))return this.note('Insufficient size range for a profile.');
        function x(size){return 52+(Math.log10(size)-lo)/(hi-lo)*616;}
        function y(percent){return 224-percent/110*190;}
        var html='<svg class="fxsave-quote-chart" viewBox="0 0 720 270" role="img" aria-label="Quoted USDC proceeds as percent of input NAV, across logarithmic input sizes"><title>Direct swap versus instant basket plus fxUSD sale; gas excluded</title>';
        [0,50,100].forEach(function(v){html+='<line x1="52" x2="668" y1="'+y(v)+'" y2="'+y(v)+'" stroke="#cbd5e1"/><text x="8" y="'+(y(v)+4)+'" fill="#64748b" font-size="11">'+v+'%</text>';});
        [['direct','#2563eb'],['fxusd_market','#d97706']].forEach(function(pair){
            var path='',active=false;
            rows.forEach(function(row){var cost=self.routeCost(row,pair[0]);if(cost===null){active=false;return;}path+=(active ? ' L ' : ' M ')+x(row.size_nav_usd).toFixed(2)+' '+y(100-cost/100).toFixed(2);active=true;});
            html+='<path d="'+path+'" stroke="'+pair[1]+'" fill="none" stroke-width="2.5"/>';
        });
        [rows[0],rows[Math.floor(rows.length/2)],rows[rows.length-1]].forEach(function(row){html+='<text x="'+x(row.size_nav_usd)+'" y="247" text-anchor="middle" fill="#64748b" font-size="11">$'+self.e(self.n(row.size_nav_usd,0))+'</text>';});
        return html+'<text x="360" y="265" text-anchor="middle" fill="#64748b" font-size="11">Input share NAV · logarithmic size scale</text></svg><div class="fxsave-legend"><span style="color:#2563eb">● Direct FXSave swap</span><span style="color:#d97706">● Instant basket + fxUSD sale + direct USDC</span></div>';
    },
    depthProfile: function(ladder,kind) {
        var self=this, all=(ladder.rows || []).slice().sort(function(a,b){return a.size_nav_usd-b.size_nav_usd;});
        var policy=ladder.ladder_policy || {},baselineRow=all[0];
        if(policy.version==='fleet-section7/1')baselineRow=all.find(function(row){return row.size_nav_usd===(policy.baseline_size_nav_usd || {})[kind];});
        var baseline=baselineRow ? this.routeCost(baselineRow,kind) : null;
        if(baseline===null)return {status:'unmeasured',basis:'Smallest tested rung failed or is missing; a larger rung cannot replace its standing-cost reference.'};
        var result={baseline_bps:baseline,baseline_size:baselineRow.size_nav_usd,thresholds:{}};
        [50,200].forEach(function(threshold){var lower=all[0].size_nav_usd,gap=false,found=null;
            for(var i=1;i<all.length;i++){var cost=self.routeCost(all[i],kind);if(cost===null){gap=true;continue;}if(cost-baseline>threshold){found={status:gap ? 'bracketed_with_failed_rungs' : 'bracketed',lower:lower,upper:all[i].size_nav_usd};break;}lower=all[i].size_nav_usd;}
            result.thresholds[threshold]=found || {status:'ladder_exhausted',lower:lower,upper:null};
        });
        var profiles=(ladder.route_profiles || {})[kind];
        if(policy.version==='fleet-section7/1' && profiles){[50,200].forEach(function(threshold){var p=profiles[String(threshold)];if(!p)return;
            var pair=p.crossing_nav_usd || [];
            if(p.is_floor && Number.isFinite(p.floor_nav_usd) && p.endpoint_revalidation && p.endpoint_revalidation.bracket_holds===true)result.thresholds[threshold]={status:'verified_floor',lower:p.floor_nav_usd,upper:pair[1],is_floor:true};
            else if(p.status==='unstable_or_unverified_floor')result.thresholds[threshold]={status:'unverified',lower:null,upper:null};
        });}
        return result;
    },
    depthSummary: function(ladder) {
        var self=this;
        function bracket(t){if(!t || t.status==='unverified')return 'Not established · endpoint verification incomplete';if(t.is_floor)return '≥$'+self.n(t.lower,0)+' · floor; bracket to $'+self.n(t.upper,0);return t.upper==null ? 'At least $'+self.n(t.lower,0)+' · floor, probing stopped' : '$'+self.n(t.lower,0)+'–$'+self.n(t.upper,0)+' · '+t.status.replace(/_/g,' ');}
        return this.panel('Size-impact depth · 50 bps standard',this.table(['Route','Standing cost at smallest size','50 bps additional impact','200 bps additional impact'],['direct','fxusd_market'].map(function(kind){var profile=self.depthProfile(ladder,kind);return [kind==='direct' ? 'Direct FXSave swap' : 'Instant basket + market',Number.isFinite(profile.baseline_bps) ? self.n(profile.baseline_bps,2)+' bps at $'+self.n(profile.baseline_size,0) : profile.basis,bracket((profile.thresholds || {})[50]),bracket((profile.thresholds || {})[200])];}))+this.note('Additional size impact = all-in cost minus that route’s smallest-rung standing cost. Coarse indicative brackets use the disclosed reference basis and exclude gas; no precision-refined executable capacity is established.'));
    },
    standardRungs: function(ladder,kind) {
        var all=(ladder.rows || []).slice().sort(function(a,b){return a.size_nav_usd-b.size_nav_usd;}),bySize={};
        all.forEach(function(row){bySize[row.size_nav_usd]=row;});
        var published=(((ladder.route_profiles || {})[kind] || {})['50'] || {}).published_sizes_nav_usd;
        if(Array.isArray(published))return published.slice(0,10).map(function(size){return bySize[size] || {size_nav_usd:size,missing:true};});
        var maximum=all.length ? all[all.length-1].size_nav_usd : 0,profile=this.depthProfile(ladder,kind),result=[];
        for(var size=1000;size<=maximum && result.length<10;size*=10){
            var row=bySize[size] || {size_nav_usd:size,missing:true},cost=this.routeCost(row,kind);
            result.push(row);
            if(cost!==null && Number.isFinite(profile.baseline_bps) && cost-profile.baseline_bps>50)break;
        }
        return result;
    },
    standardLadder: function(ladder,kind) {
        var self=this,profile=this.depthProfile(ladder,kind),rungs=this.standardRungs(ladder,kind);
        var title=kind==='direct' ? 'Direct swap → USDC' : 'Instant redemption + fxUSD sale → USDC';
        var missing=rungs.some(function(r){return r.missing;}),legacy=profile.baseline_size===100;
        return '<div class="fxsave-exit-ladder"><h3 class="panel-title">'+this.e(title)+'</h3>'+this.table(['Sell size · NAV USD','Additional impact · bps','Net out · USDC','All-in cost · bps','Result'],rungs.map(function(row){
            var cost=self.routeCost(row,kind),quote=row[kind] || {},valid=cost!==null;
            var output=valid ? quote.usdc_out+(kind==='fxusd_market' ? Number(row.instant.usdc_raw)/1e6 : 0) : null;
            return ['$'+self.n(row.size_nav_usd,0),self.n(valid && Number.isFinite(profile.baseline_bps) ? cost-profile.baseline_bps : null,2),self.n(output,2),self.n(cost,2),row.missing ? 'Not measured' : (valid ? 'Indicative quote' : quote.status || 'Unavailable')];
        }))+(missing ? this.note('Required standard rung missing from the producer: $1,000. No value is interpolated.') : '')+
            (legacy ? this.note('Legacy source: additional impact still references its measured $100 quote. Standard $1,000 baseline correction is pending; the table does not replace that reference silently.') : this.note('Additional impact excludes the standing cost at the source baseline; all-in cost includes it.'))+'</div>';
    },
    matchedExits: function(d) {
        var ladder=d.matched_exits;
        if(!ladder || ladder.schema_version!=='fxsave-matched-exits/1')return this.exits(d);
        var self=this, rows=ladder.rows || [];
        var clocks=rows.flatMap(function(row){return ['direct','fxusd_market'].map(function(kind){var q=row[kind] || {};return q.status==='ok' ? q.as_of : null;});}).filter(Boolean);
        var oldest=Math.min.apply(null,clocks.map(Date.parse));
        var stale=!Number.isFinite(oldest) || oldest>Date.now()+300000 || Date.now()-oldest>ladder.stale_after_seconds*1000;
        return this.depthSummary(ladder)+this.panel('Liquidity ladder',
            this.note('Basket block '+ladder.block+' · '+this.quoteTime(ladder.block_as_of)+' · router requests retain separate clocks. '+(stale ? 'STALE: these quotes do not establish current availability.' : 'Indicative routed quotes; execution is not guaranteed.'))+
            this.note((ladder.market_marks ? 'Timestamped USDC/USD oracle reference; gas excluded' : 'Par token marks assumed; gas excluded')+'; instant fee included once. Depth uses the source’s floor/bracket status; no firm executable capacity is implied. Failed rungs retain historical evidence but are excluded from this chart and current costs.')+
            this.standardLadder(ladder,'direct')+this.standardLadder(ladder,'fxusd_market')+
            '<h3 class="panel-title mt-6">Matched exit profile · measured probes</h3>'+this.quoteChart(ladder)+this.crossingEvidence(ladder)+this.exitEvidence(ladder)+
            '<details class="fxsave-details"><summary>Compare a diagnostic input size</summary>'+
            '<label class="fxsave-rung-label" for="fxsave-rung">Compare a measured input size</label><select id="fxsave-rung">'+rows.map(function(row,i){return '<option value="'+i+'">$'+self.e(self.n(row.size_nav_usd,0))+' NAV · '+self.e(self.n(Number(row.shares_raw)/1e18,2))+' shares</option>';}).join('')+'</select><div id="fxsave-rung-result" aria-live="polite"></div>'+
            '</details>'+this.details('All published source rungs · includes stress sizes',this.table(['Input NAV USD','Direct USDC','Direct cost bps','Instant + market USDC','Basket cost bps','Direct / basket status'],rows.map(function(row){
                var direct=self.routeCost(row,'direct'), basket=self.routeCost(row,'fxusd_market');
                return [self.n(row.size_nav_usd,0),direct===null ? 'Unavailable' : self.n(row.direct.usdc_out,2),self.n(direct,2),basket===null ? 'Unavailable' : self.n(row.fxusd_market.usdc_out+Number(row.instant.usdc_raw)/1e6,2),self.n(basket,2),(direct===null ? 'Unavailable' : 'Quoted')+' / '+(basket===null ? 'Unavailable' : 'Quoted')];
            })))+this.details('Observation times · UTC',this.table(['Input NAV USD','Direct swap','Basket market leg'],rows.map(function(row){return [self.n(row.size_nav_usd,0),self.quoteTime(row.direct.as_of),self.quoteTime(row.fxusd_market.as_of)];})))+
            this.details('Exact source timestamps',this.table(['Input NAV USD','Direct timestamp','Basket market timestamp'],rows.map(function(row){return [self.n(row.size_nav_usd,0),row.direct.as_of || 'Unavailable',row.fxusd_market.as_of || 'Unavailable'];}))));
    },
    quoteTime: function(value) {
        var parsed=Date.parse(value);
        return Number.isFinite(parsed) ? new Date(parsed).toISOString().replace('T',' ').slice(0,19)+' UTC' : 'Unavailable';
    },
    rungResult: function(d,index) {
        var row=((d.matched_exits || {}).rows || [])[index]; if(!row)return this.note('No quote for this size.');
        var self=this;
        var rows=['direct','fxusd_market'].map(function(kind){var cost=self.routeCost(row,kind), q=row[kind] || {};return [kind==='direct' ? 'Direct FXSave → USDC' : 'Instant basket + fxUSD sale',cost===null ? 'Unavailable' : self.n(q.usdc_out+(kind==='fxusd_market' ? Number(row.instant.usdc_raw)/1e6 : 0),2)+' USDC',self.n(cost,2)+' bps',self.n(cost===null || !Number.isFinite(self.depthProfile(d.matched_exits,kind).baseline_bps) ? null : cost-self.depthProfile(d.matched_exits,kind).baseline_bps,2)+' bps',self.quoteTime(q.as_of)];});
        return this.table(['Route','Total proceeds','All-in cost vs NAV','Additional size impact','Quote time'],rows)+this.note('Measured input: '+this.n(Number(row.shares_raw)/1e18,6)+' shares. Basket and router observations use separate clocks; this is not a completed or atomic execution.');
    },
    exits: function(d) {
        var exits=d.exits || {}, route=exits.fxusd_route || {}, self=this;
        function bracket(v) { return Array.isArray(v) && v.length===2 && v.every(Number.isFinite) ? self.n(v[0],0)+'–'+self.n(v[1],0)+' USD input' : 'Not measured'; }
        return this.panel('Executable market exit evidence',
            this.note(exits.direct_fxsave_status || 'Direct fxSAVE executable depth not measured')+
            this.note('Dated fxUSD → USDC route: '+(route.as_of || 'time unavailable')+' · historical evidence; current availability is not established.')+
            '<dl class="fxsave-metrics"><div><dt>50 bps crossing bracket</dt><dd>'+this.e(bracket(route.crossing_50bps_usd))+'</dd></div><div><dt>200 bps crossing bracket</dt><dd>'+this.e(bracket(route.crossing_200bps_usd))+'</dd></div></dl>'+
            this.metrics([['Observed fxUSD-route proceeds peak',route.observed_peak_usdc,'USDC',0]])+
            this.note('This observed route peak is not a ceiling on the whole FXSave claim. Redemption also pays USDC directly. No current matched direct-swap versus redemption ladder is available.'));
    },
    backing: function(d,block) {
        var a=d.accounting || {}, pass=(block || {}).pass_through || {};
        return this.panel('Vault backing · fxSP accounting',this.clock(d.as_of,d.block)+this.metrics([['Share supply · Ethereum',d.total_supply_shares,'fxSAVE',2],['Vault total assets',d.total_assets_fxsp,'fxSP',6],['Custody gauge claim',a.custody_fxsp,'fxSP',6],['Custody minus totalAssets',a.accounting_difference_fxsp,'fxSP',9],['Share conversion',d.fxsp_per_share,'fxSP / share',9]])+
            this.note('Custody status: '+(a.status || 'not measured')+'. '+(a.basis || 'Reconciliation basis unavailable.'))+
            this.details('Why no independent collateral ratio is derivable',this.note((block || {}).collateral_ratio_basis || 'No independent dollar collateral ratio is established for this vault.'))+
            this.note('Collateral-ratio/coverage history and reserve-allocation pie: not applicable. This vault holds a pool claim, not an independently partitioned dollar reserve.')+
            (Number.isFinite(pass.terminal_collateral_ratio_pct) ? this.details('Underlying fxUSD lookthrough · separately dated',this.metrics([['Underlying fxUSD system ratio',pass.terminal_collateral_ratio_pct,'%',2]])+this.note(pass.terminal_ratio_note || 'Underlying ratio timestamp unavailable.')+this.note('This is not FXSave’s own collateral ratio.')+this.note(JSON.stringify(pass))) : '')+
            '<p class="fxsave-note"><a href="?asset=fxusd">Open fxUSD collateral dashboard →</a></p>');
    },
    custodyHistory: function(history) {
        var self=this, rows=this.historyRows(history), mismatches=rows.filter(function(row){return ((row.detail || {}).accounting || {}).status==='mismatch';});
        return this.panel('Custody reconciliation history · trailing 7 days',this.note(rows.length+' observations · '+mismatches.length+' reported custody/accounting mismatch readings. Mismatch is an accounting observation, not proof of realized losses.')+this.details('All custody readings and raw differences',this.table(['Observed UTC','Gauge custody fxSP','Accounting assets fxSP','Raw-unit difference','Status'],rows.map(function(row){var d=row.detail || {},a=d.accounting || {};return [row.timestamp,self.n(a.custody_fxsp,6),self.n(d.total_assets_fxsp,6),a.accounting_difference_raw==null ? 'not measured' : a.accounting_difference_raw,a.status || 'not measured'];}))));
    },
    venues: function(d) {
        var inv=d.venue_inventory;
        if(!inv || !Array.isArray(inv.pools))return this.panel('Venue inventory',this.note('Venue composition is not published in this snapshot. A separately timestamped inventory is required; quote routes are not complete venue enumeration.'));
        var active=new Set();((d.matched_exits || {}).rows || []).forEach(function(row){['direct','fxusd_market'].forEach(function(kind){((row[kind] || {}).route_pools || []).forEach(function(address){active.add(address.toLowerCase());});});});
        var self=this, main=[],dust=[];
        inv.pools.slice().sort(function(a,b){return (b.tvl_usd || 0)-(a.tvl_usd || 0);}).forEach(function(pool){(active.has(String(pool.address).toLowerCase()) || !Number.isFinite(pool.tvl_usd) || pool.tvl_usd>=1000 ? main : dust).push(pool);});
        function rows(pools){return pools.map(function(pool){return [pool.name || 'unnamed pool',(pool.assets || []).join(' / '),pool.address || 'address unavailable',self.n(pool.tvl_usd,2),pool.is_broken===true ? 'Broken in inventory' : (active.has(String(pool.address).toLowerCase()) ? 'Used by quoted route' : 'Inventory only')];});}
        return this.panel('Venue inventory · TVL is not executable depth',this.clock(inv.as_of)+this.note(inv.scope || 'Inventory scope unavailable')+this.table(['Venue','Asset scope','Pool address','TVL USD','Evidence'],rows(main))+this.details('Dust venues · below $1,000 TVL unless used by a quoted route ('+dust.length+')',this.table(['Venue','Asset scope','Pool address','TVL USD','Evidence'],rows(dust)))+this.details('Inventory registry coverage',this.table(['Registry','Status','Pool count'],(inv.sources || []).map(function(v){return [v.registry,v.status,self.n(v.count,0)];}))));
    },
    dependencies: function(dep) {
        dep=dep || {};var self=this,known=CommonRenderer.KNOWN_ASSET_SLUGS || [];
        var upstream=(dep.upstream || []).map(function(row){var slugs=row.slugs || (row.slug ? [row.slug] : []);var links=slugs.filter(function(slug){return known.indexOf(slug)>=0;}).map(function(slug){return '<a href="?asset='+encodeURIComponent(slug)+'">'+self.e(slug)+' dashboard →</a>';}).join(' · ');
            return '<article class="dep-card"><div class="dep-card-name">'+self.e(row.name)+'</div><div class="dep-card-metric">'+self.e(row.metric==null ? 'Metric not measured' : row.metric)+'</div>'+(links ? '<p>'+links+'</p>' : '')+self.details('Source & context',self.note(row.source || 'Source not established')+self.note(row.note || '')+(row.resolution_note ? self.note(row.resolution_note) : ''))+'</article>';}).join('');
        var coverage=dep.fxsp_coverage_policy || dep.coverage_policy;
        return this.panel('Upstream dependencies',upstream ? '<div class="dep-grid">'+upstream+'</div>' : this.note('No upstream dependencies are tracked.'))+
            this.panel('Known downstream consumers',this.note('Report-identified consumers are shown below. Automated graph enumeration is '+(dep.downstream_tracked===true ? 'tracked' : 'incomplete; an empty generated list is not zero consumers')+'.')+'<div class="dep-grid">'+(dep.downstream || []).map(function(row){return '<article class="dep-card"><div class="dep-card-name">'+self.e(row.name)+'</div><div class="dep-card-metric">'+self.e(row.metric==null ? 'Metric not measured' : row.metric)+'</div>'+self.details('Source & context',self.note(row.source || 'Source not established')+self.note(row.note || ''))+'</article>';}).join('')+'</div>'+this.details('Downstream source notes',(dep.downstream || []).map(function(row){return self.note(row.note || '');}).join('')))+
            this.panel('Dependency assessment · '+(Number.isFinite(dep.underlying_score) ? 'authored '+this.n(dep.underlying_score,1)+'/10' : 'unscored'),this.note(dep.underlying_score_status || 'No numerical dependency assessment is authored.')+this.details('Scoring basis and embedded fxSP coverage',this.note(dep.underlying_score_basis || 'No score basis published.')+(coverage ? this.note(JSON.stringify(coverage)) : '')+this.note(JSON.stringify(dep.provenance_reconciliation || {}))));
    },
    health: function(data) {
        var d=(data.asset_specific || {}).fxsave || {},self=this;
        var warnings=[];
        [['Vault',d.refresh_attempt,d.as_of,7200],['Exit quotes',d.exit_refresh_attempt,(d.matched_exits || {}).timestamp,14400]].forEach(function(pair){var a=pair[1] || {},age=Date.now()-Date.parse(pair[2]);if(!Number.isFinite(age) || age>pair[3]*1000)warnings.push(pair[0]+': stale or unavailable observation ('+(pair[2] || 'no observation time')+').');if(a.status && a.status!=='success')warnings.push(pair[0]+' last attempt: '+a.status+' · '+(a.completed_at || a.started_at || a.attempted_at || 'time unavailable')+'. Original observation time retained.');});
        return this.panel('Snapshot and refresh status',this.note('Review snapshot assembled '+((data.transport || {}).assembled_at || 'time unavailable')+'. '+(((data.transport || {}).refresh_mode==='hourly_sync_preview') ? 'Regenerated by the hourly sync workflow; source clocks below remain independent.' : 'Manual snapshot: regenerate to copy newer producer files; page refresh alone does not update them.'))+warnings.map(function(w){return self.note(w);}).join('')+this.details('Producer attempts and source clocks',this.note('Vault: '+JSON.stringify(d.refresh_attempt || {}))+this.note('Exit: '+JSON.stringify(d.exit_refresh_attempt || {}))));
    },
    governance: function(contract) {
        contract=contract || {};
        return this.panel('Smart-contract security',this.note(contract.audit_scope_note || 'Code/audit scope not established.')+this.details('Code evidence and review scope',(contract.code_facts || []).map(this.note.bind(this)).join('')+this.note(contract.structural_score_basis || '')+this.note(contract.authority_note || '')));
    },
    render: function(data,history) {
        var d=(data.asset_specific || {}).fxsave;if(!this.validDetail(d))return;
        var self=this;history=history || {entries:[]};document.body.classList.add('fxsave-dashboard');
        function slot(id,html){var el=document.getElementById(id);if(el)el.innerHTML=html;}
        slot('axis-peg-body',this.reference(data,history)+this.pricePanel(history));
        this.paintPriceChart(history);
        slot('peg-extra-panels',this.overview(d));
        slot('backing-extra-panels',this.backing(d,data.backing)+this.historyPanel(history,'fxsp_per_share','Share-conversion history','fxSP / share')+this.custodyHistory(history));
        slot('axis-liquidity-body','');slot('liquidity-extra-panels',this.matchedExits(d)+this.redemption(d,data.liquidity)+this.venues(d));
        var select=document.getElementById('fxsave-rung');if(select){var update=function(){slot('fxsave-rung-result',self.rungResult(d,Number(select.value)));};select.addEventListener('change',update);select.value=String(Math.min(2,d.matched_exits.rows.length-1));update();}
        slot('axis-dependencies-body',this.dependencies(data.dependencies));slot('dependencies-extra-panels',this.concentration(d));
        // Shared contract panel uses the committed topology for paths/unknowns.
        // Code facts are repeated only in the explicitly labelled security block.
        slot('contract-extra-panels',this.governance(data.contract));
        var contractPanel=document.querySelector('#axis-contract-body .panel-title');if(contractPanel)contractPanel.textContent='Admin and access control'+(Array.isArray(data.contract.layers) && data.contract.layers.length ? '' : ' · observations unavailable');
        slot('risk-flags',this.note('Current custody status: '+((d.accounting || {}).status || 'not measured'))+this.note('Morpho concentration '+this.n((d.concentration || {}).morpho_pct,2)+'% · authored trigger '+this.n((d.concentration || {}).review_trigger_pct,0)+'%.'));
        var chart=document.getElementById('chart-panel');if(chart)chart.style.display='none';var table=document.getElementById('breakdown-table');if(table && table.closest('.panel'))table.closest('.panel').style.display='none';
        var cards=document.querySelectorAll('#summary-cards .summary-card');
        var priced=this.marketComparison(data.peg).valid;
        function shortMoney(v){return '$'+self.n(v>=1e6 ? v/1e6 : (v>=1000 ? v/1000 : v),2)+(v>=1e6 ? 'm' : (v>=1000 ? 'k' : ''));}
        function brief(profile){var t=(profile.thresholds || {})[50];return !t || t.status==='unverified' ? 'Not measured' : (t.is_floor ? '≥'+shortMoney(t.lower)+' floor' : (t.upper==null ? '≥'+shortMoney(t.lower)+' floor' : shortMoney(t.lower)+'–'+shortMoney(t.upper)+' bracket'));}
        var directDepth=this.depthProfile(d.matched_exits || {},'direct'),basketDepth=this.depthProfile(d.matched_exits || {},'fxusd_market');
        var specs=[['NAV / stability',self.n(d.nav_usd,6),'USD contract NAV / share',data.peg,null],['Backing',(d.accounting || {}).status==='reconciled' ? 'Reconciled' : 'Review custody','fxSP accounting; no independent dollar CR',data.backing,'backing_score'],['Liquidity · 50 bps impact',brief(directDepth),'Direct; basket '+brief(basketDepth)+' · indicative',data.liquidity,'liquidity_score'],['Dependencies','fxSP → basket','fxUSD + USDC · embedded fxSP coverage',data.dependencies,'underlying_score'],['Contract & admin',(data.contract || {}).authority_summary ? 'Mapped paths' : 'Not established','See authority reach, delay and limits',data.contract,'structural_score'],['Issuer',(data.issuer || {}).entity || 'Not established','Producer-authored assessment',data.issuer,'issuer_score']];
        specs.forEach(function(spec,i){var card=cards[i];if(!card)return;var value=spec[4] && spec[3] ? spec[3][spec[4]] : null;var chip=i===0 ? (priced ? 'Indicative market comparison' : 'Not rated · market mark unavailable') : (Number.isFinite(value) ? 'Historical authored '+self.n(value,1)+'/10' : 'Unscored · not authored');card.innerHTML='<div class="card-label">'+self.e(spec[0])+'</div><div class="card-value">'+self.e(spec[1])+'</div><div class="text-xs text-slate-400 mt-1">'+self.e(spec[2])+'</div><div class="mt-2"><span class="axis-rating r-warn">'+self.e(chip)+'</span></div>';});
        var note=document.querySelector('.axis-band-note');if(note)note.textContent='Current measurements and historical authored judgments are separate. NAV alone does not establish market stability; Dependencies remains deliberately unscored.';
        document.querySelectorAll('#axis-peg-head .axis-rating').forEach(function(chip){if(/^(Current|7d band)/.test(chip.textContent)){chip.textContent=priced ? 'Indicative quote · no measured score' : 'Not rated · market mark unavailable';chip.className='axis-rating r-warn';chip.title='A size-specific indicative quote is not a continuous market history or numerical risk assessment.';}});
        var pegTitle=document.querySelector('#axis-peg-head .axis-title');if(pegTitle)pegTitle.textContent='NAV / stability';
        var pgSub=document.querySelector('#axis-peg-head .axis-sub');if(pgSub)pgSub.textContent='Market versus contract reference · trailing 7-day history';
        var liqSub=document.querySelector('#axis-liquidity-head .axis-sub');if(liqSub)liqSub.textContent='Additional size impact · separately timed indicative quotes';
        var depSub=document.querySelector('#axis-dependencies-head .axis-sub');if(depSub)depSub.textContent=(data.dependencies.upstream || []).length+' upstream · known report consumers; graph incomplete';
        var header=document.getElementById('header-timestamp');if(header)header.textContent='Vault block '+d.block+' · '+d.as_of;
        var host=document.getElementById('axis-notes-lifted');if(host)host.innerHTML=this.health(data);
        var anchor=document.getElementById('asset-anchor-nav'),inner=document.getElementById('asset-anchor-nav-inner');if(anchor && inner){inner.innerHTML=['peg','backing','liquidity','dependencies','contract','issuer'].map(function(key,i){return '<a href="#section-'+key+'">'+self.e(specs[i][0])+'</a>';}).join('');anchor.classList.remove('hidden');}
        var footer=document.querySelector('footer');if(footer)footer.textContent='Review snapshot · '+((data.transport || {}).refresh_mode==='hourly_sync_preview' ? 'regenerated by hourly sync' : 'manual regeneration')+'. Source clocks and failed-attempt status are independent; this is not a production publication.';
    }
};
