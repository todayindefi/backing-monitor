/** Ethereum-only review. Native ETH quantities never wear USD labels. */
var WeethRenderer = {
    preRender: function(data) {
        data.peg.chart_window_days=7;
        data.peg.chart_min_points=2;
        data.backing.backing_score_display='authored';
    },
    render: function(data,history) {
        var f=FxSaveRenderer,b=data.backing || {},p=data.peg || {},l=data.liquidity || {},q=l.ethereum_ladder || {};
        var e=f.e.bind(f),n=f.n.bind(f),note=f.note.bind(f),panel=f.panel.bind(f),details=f.details.bind(f);
        document.body.classList.add('fxsave-dashboard');
        var companion=document.getElementById('header-companion-link');if(companion && !companion.getAttribute('href'))companion.style.display='none';
        function slot(id,html){var el=document.getElementById(id);if(el)el.innerHTML=html;}
        var freshness=(data.transport || {}).field_status || {};
        var ageStatus=function(lane, asOf) {
            if (freshness[lane] === 'last_good') return ' · stale, retained last-good';
            if (freshness[lane] === 'unavailable' || !asOf) return ' · unavailable';
            var age=Date.now()-Date.parse(asOf);
            return Number.isFinite(age) && age>86400000 ? ' · aged over 24h' : '';
        };
        var sourceTime=((b.deployments || [])[0] || {}).measured_at;
        slot('axis-peg-body',panel('ETH-denominated price and reference',f.metrics([
            ['Market oracle',p.market_price,'ETH / weETH',8],['Contract conversion',p.nav,'eETH / weETH',8],['Reported deviation',p.premium_discount_pct,'%',5]])+
            note('Contract rate is an eETH claim; comparing it with the ETH oracle assumes eETH tracks ETH. Neither is a cash guarantee.')+
            details('Price sources and independent clocks',note(p.nav_source || 'Rate source unavailable')+note('Rate: '+p.nav_as_of)+note(p.market_price_source || 'Market source unavailable')+note('Oracle updated: '+p.market_price_as_of)+note(p.nav_basis || '')))+
            panel('Price history · trailing 7 days', '<div class="fxsave-price-chart-wrap"><canvas id="weeth-price-chart" aria-label="ETH-unit weETH market price and eETH reference"></canvas></div>'+note((freshness.history === 'last_good' ? 'Last-good chart history retained. New per-point oracle or quote clocks were unavailable. ' : '')+
                'Original producer clocks retained. ETH units, not dollar prices; gaps are not interpolated.')));
        slot('backing-extra-panels',panel('Share claim accounting · Ethereum',f.metrics([
            ['Share supply',b.total_supply,'weETH shares',2],['Represented claim',b.total_assets,'eETH claim units',2],['eETH pool token supply',b.eeth_total_supply,'eETH',2],['Wrapped share of eETH units',b.wrapped_share_pct,'%',3]])+
            note('Observed '+sourceTime+'. '+(b.basis || ''))+
            note('Independent validator-asset, liability and loss-recovery coverage is unverified. No dollar collateral ratio is asserted.')+
            details('Accounting perimeter and absent history',note(b.wrapped_share_basis || '')+note((b.supply || {}).scope || '')+note('No independent reserve-coverage history or validated partition of terminal validator/custody assets is exported. This is not a claim that those assets are absent.'))));
        var rows=(q.rungs || []).map(function(r){return [n(r.notional_eth,2),n(r.input_weeth,6),n(r.output_weth,6),n(r.all_in_cost_vs_nav_bps,2),n(r.marginal_impact_bps,2)];});
        var depth50=q.depth_50bps || {},depth200=q.depth_200bps || {};
        var venues=((data.asset_specific || {}).venue_inventory || {}),enumEth=venues.ethereum || {};
        slot('axis-liquidity-body',panel('Ethereum secondary exit · native ETH',f.metrics([
            ['50 bps marginal impact',depth50.depth_eth,depth50.shape==='floor' ? 'ETH · lower bound' : 'ETH · '+(depth50.shape || 'unmeasured'),0],['200 bps marginal impact',depth200.depth_eth,depth200.shape==='floor' ? 'ETH · lower bound' : 'ETH · '+(depth200.shape || 'unmeasured'),0],['Smallest-rung signed cost',q.standing_cost_bps,'bps vs NAV',2]])+
            note((depth50.note || 'Depth is unmeasured.')+' A floor is not an exact crossing or guaranteed future capacity.')+
            note('Quotes: '+q.measured_at+' · '+q.venue+'. '+q.cost_convention+'. '+(q.failure_note || 'No failed rung reported in this observation.'))+
            details('Quoted ETH ladder · output, standing cost and incremental impact',f.table(['Input notional ETH','Input weETH','Output WETH','Signed cost vs NAV · bps','Marginal impact · bps'],rows)+note('Negative signed cost means less output than the NAV reference. Route quotes are indicative, not reserved proceeds. Full-path gas and complete primary settlement are not verified.')))+
            panel('Primary exit · separate settlement legs',note('weETH unwrap → eETH withdrawal request → pool / validator funding → claim ETH.')+
                note('Current queue timing, eligible caller/receiver settlement, funded withdrawal capacity and final cash proceeds are unmeasured in this snapshot. No instant redemption promise.')+
                details('Accepted redemption and dependency reasoning',note((data.liquidity || {}).liquidity_score_basis || '')))+
            panel('Venue inventory · Ethereum only',f.metrics([['Discovered pools',enumEth.pool_count,'pools',0],['Published pools',enumEth.published_pool_count,'pools',0],['ETH-exit TVL',enumEth.eth_exit_tvl_usd,'USD inventory mark',0]])+
                note('Enumerated '+(enumEth.queried_at || venues.as_of || 'time unknown')+'. '+(venues.note || ''))+
                details('Enumeration scope',note(JSON.stringify(enumEth)))));
        slot('liquidity-extra-panels','');
        var venueRows=(venues.venues || []).map(function(v){return [v.name,v.dex,v.role,n(v.tvl_usd,0),v.is_live===true ? 'Observed live' : 'Liveness unverified',v.as_of];});
        document.getElementById('axis-liquidity-body').insertAdjacentHTML('beforeend',panel('Venue breakdown · reported inventory',
            '<div class="dep-grid">'+venueRows.slice(0,5).map(function(r){return '<article class="dep-card"><strong>'+e(r[0])+'</strong><p>'+e(r[1])+' · '+e(r[2])+'</p><p>Reported TVL $'+e(r[3])+' · '+e(r[4])+'</p><div class="text-xs text-slate-400">'+e(r[5])+'</div></article>';}).join('')+'</div>'+
            (venueRows.length>5 ? details('Remaining '+(venueRows.length-5)+' reported Ethereum venues',f.table(['Pool','Venue','Role','Whole-pool TVL · USD','Liveness','Source time'],venueRows.slice(5))) : '')+
            note('Reported pool TVL is not executable depth. Unverified liveness is neither a live-liquidity assurance nor proof a pool is absent.')));
        var controls=(data.asset_specific || {}).control_review || {};
        slot('axis-contract-body',panel('Bounded control and deployed-code review',note('Source observation '+controls.as_of+' · Ethereum block '+controls.block+'. '+controls.method)+
            note('Parallel operational/guardian powers remain; no universal ten-day holder reaction window or complete authority clearance.')+
            (controls.rows || []).map(function(r){return '<article class="dep-card mt-2"><strong>'+e(r[0])+'</strong><p class="text-sm mt-1">'+e(r[1])+'</p></article>';}).join('')+
            details('Full source reasoning and audit / enumeration gaps',note((data.contract || {}).structural_score_basis || 'Source unavailable.'))));
        var chartPanel=document.getElementById('chart-panel');if(chartPanel)chartPanel.style.display='none';
        slot('risk-flags',note('Material coverage gaps: current validator/AVS residual exposure, independent recovery coverage, complete authority membership and funded cash settlement remain unverified.'));
        slot('axis-notes-lifted',panel('Snapshot source status',note('Exact Ethereum token only. Manual snapshot; refreshing the page does not copy newer producer files.')+
            note('Accounting '+(sourceTime || 'unknown')+ageStatus('accounting',sourceTime)+
                '; oracle '+(p.market_price_as_of || 'unknown')+ageStatus('oracle',p.market_price_as_of)+
                '; quotes '+(q.measured_at || 'unknown')+ageStatus('quotes',q.measured_at)+
                '; venues '+(enumEth.queried_at || venues.as_of || 'unknown')+ageStatus('venues',enumEth.queried_at || venues.as_of)+'.')+
            note('Independent cash/backing coverage and complete controls are not established. Remote supplies, liquidity and grades are excluded.')+
            details('Accepted version and source clocks',note((data.transport || {}).assessment_version || 'Assessment version unavailable')+note((data.transport || {}).evidence_version || 'Evidence version unavailable'))));
        var cards=document.querySelectorAll('#summary-cards .summary-card'),specs=[
            ['Stability / NAV',n(p.premium_discount_pct,4)+'%','vs eETH conversion reference',p.volatility_score],
            ['Backing','eETH claim','Independent recovery unverified',b.backing_score],
            ['Liquidity & exit',Number.isFinite(depth50.depth_eth) ? (depth50.shape==='floor' ? '≥' : '')+n(depth50.depth_eth,0)+' ETH' : 'Not measured','50 bps marginal impact · '+(depth50.shape || 'unmeasured'),l.liquidity_score],
            ['Dependencies','Staking / queue','Protocol and validator exposures',(data.dependencies || {}).underlying_score],
            ['Contract & admin','Bounded review','Authority/audit gaps retained',(data.contract || {}).structural_score],
            ['Issuer','ether.fi','Operator ≠ repayment guarantor',(data.issuer || {}).issuer_score]];
        specs.forEach(function(s,i){if(cards[i])cards[i].innerHTML='<div class="card-label">'+e(s[0])+'</div><div class="card-value">'+e(s[1])+'</div><div class="text-xs text-slate-400 mt-1">'+e(s[2])+'</div><div class="mt-2"><span class="axis-rating r-warn">'+(Number.isFinite(s[3]) ? 'Authored '+n(s[3],1)+'/10' : 'Unrated · source unavailable')+'</span></div>';});
        var assessment=(data.asset_specific || {}).assessment || {};
        var overall=document.createElement('div');overall.className='panel';overall.innerHTML='<div class="panel-title">Accepted Ethereum assessment · '+e(n((assessment.scores || {}).overall,1))+'/10 overall</div>'+note('Six-axis judgment dated '+assessment.assessment_reviewed+'. Current measurements and independent source clocks remain separate. No remote-chain grade inheritance.');
        document.getElementById('peg-extra-panels').appendChild(overall);
        var bandNote=document.querySelector('.axis-band-note');if(bandNote)bandNote.textContent='All six numeric grades above are authored judgments. ETH-denominated measurements, source clocks and coverage gaps remain separately labelled.';
        var footer=document.querySelector('footer');if(footer)footer.textContent='Manual snapshot. Page refresh does not collect new measurements; original source clocks remain visible.';
        this.chart(history);
        var self=this,toggle=document.getElementById('theme-toggle');if(toggle)toggle.addEventListener('click',function(){self.chart(history);});
    },
    chart:function(history){
        var canvas=document.getElementById('weeth-price-chart');if(!canvas)return;
        var rows=((history || {}).entries || []).filter(function(r){var stamp=String(r.timestamp);var t=Date.parse(/Z$|[+-]\d\d:?\d\d$/.test(stamp) ? stamp : stamp+'Z');return t>=Date.now()-7*86400000 && t<=Date.now();});
        if(rows.length<2 || typeof Chart==='undefined'){canvas.parentElement.textContent='Insufficient eligible observations or chart library unavailable; no reserve-coverage history is inferred.';return;}
        if(window._weethPriceChart)window._weethPriceChart.destroy();
        var dark=document.body.classList.contains('dark'),ink=dark?'#cbd5e1':'#475569';
        window._weethPriceChart=new Chart(canvas,{type:'line',data:{labels:rows.map(function(r){return r.timestamp.slice(5,10);}),datasets:[
            {label:'Market oracle · ETH/weETH',data:rows.map(function(r){return r.peg_market_price;}),borderColor:'#6366f1',pointRadius:1,spanGaps:false},
            {label:'Contract claim · eETH/weETH',data:rows.map(function(r){return r.peg_theoretical_price;}),borderColor:ink,borderDash:[6,4],pointRadius:1,spanGaps:false}]},options:{responsive:true,maintainAspectRatio:false,animation:false,scales:{x:{ticks:{color:ink,maxTicksLimit:4}},y:{title:{display:true,text:'ETH reference units / share',color:ink},ticks:{color:ink}}},plugins:{legend:{labels:{color:ink}}}}});
    }
};
