/* Re's public reported metrics supplement; no coverage or cash ratio is derived. */
var ReProtocolMetrics = {
    chart: null,
    number: function(value) { return value !== null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null; },
    money: function(value) { var n=this.number(value);return n===null?'Unavailable':'$'+(Math.abs(n)>=1e6?(n/1e6).toLocaleString('en-US',{maximumFractionDigits:1})+'M':n.toLocaleString('en-US',{maximumFractionDigits:0})); },
    esc: function(value) { return CommonRenderer._escapeAttr(String(value==null?'Unknown':value)); },
    date: function(value) { return typeof value==='string'&&Number.isFinite(Date.parse(value))?value.slice(0,10):'Unknown'; },
    select: function(section) {
        if(!section)return null;
        var current=section.status==='ok'?section.current:section.last_usable;
        if(!current)return {unavailable:true};
        if(current.schema_version!=='re_issuer_metrics/1')return {unavailable:true};
        var row=current.latest_daily_capital,history=current.daily_capital_history,self=this;
        function valid(r){return r&&Number.isFinite(Date.parse(r.reporting_date))&&['onchain_capital','offchain_capital','premium_receivables','total_tvl'].every(function(k){return self.number(r[k])!==null&&self.number(r[k])>=0;})&&Math.abs(Number(r.total_tvl)-Number(r.onchain_capital)-Number(r.offchain_capital)-Number(r.premium_receivables))<=0.05;}
        if(!valid(row)||!Array.isArray(history)||!history.length||!history.every(valid))return {unavailable:true};
        return {data:current,stale:section.status!=='ok',row:row,history:history};
    },
    html: function(section) {
        var selected=this.select(section),e=this.esc,self=this;
        if(!selected)return '';
        if(selected.unavailable)return '<section class="panel re-metrics" id="re-reported-metrics"><h3 class="panel-title">Capital and receivables</h3><p class="re-metrics-warning">Issuer metrics unavailable. Existing token claims and third-party TVL retain their separate source dates.</p></section>';
        var d=selected.data,r=selected.row,source=d.source==='https://app.re.xyz/metrics'?d.source:null;
        var h='<section class="panel re-metrics" id="re-reported-metrics"><div class="re-metrics-heading"><h3 class="panel-title">Capital and receivables</h3><span class="re-metrics-badge">Issuer reported</span></div>';
        if(selected.stale)h+='<p class="re-metrics-warning">Latest collection unavailable. Showing the last usable report with its original dates.</p>';
        h+='<p class="re-metrics-subtitle">Combined reUSD + reUSDe program · report date '+e(this.date(r.reporting_date))+'</p><div class="re-metrics-total">'+this.money(r.total_tvl)+'<span>reported combined total</span></div><p class="re-metrics-warning">Includes uncollected premiums. This total is not liquid reserves or independently verified backing; no tranche coverage ratio is established.</p>';
        h+='<div class="re-capital-grid">'+[
            ['On-chain capital','onchain_capital','Issuer-classified assets'],
            ['Off-chain capital','offchain_capital','Underlying valuation date unknown'],
            ['Premium receivables','premium_receivables','Owed premiums · not cash']
        ].map(function(x){return '<div class="re-capital-item"><div class="re-capital-label">'+x[0]+'</div><strong>'+self.money(r[x[1]])+'</strong><div class="re-metrics-subtitle">'+x[2]+'</div></div>';}).join('')+'</div>';
        h+='<div class="re-metrics-chart-head"><h4>Reported components over time</h4><div class="re-metrics-ranges" role="group" aria-label="Reported capital chart period"><button type="button" data-re-range="30" aria-pressed="false">30 days</button><button type="button" data-re-range="90" aria-pressed="true">90 days</button></div></div><div class="re-metrics-chart"><canvas id="re-capital-chart" role="img" aria-label="Issuer reported on-chain capital, off-chain capital and premium receivables over time"></canvas></div><p class="re-metrics-subtitle">Daily reporting labels do not establish daily insurance valuation or cash collection.</p>';
        if(d.quality&&d.quality.premium_receivable_value_constant_in_series)h+='<p class="re-metrics-observation">Reported receivables are unchanged across '+selected.history.length+' observations. Their aging and collectibility are not established.</p>';
        h+='<details class="re-metrics-details"><summary>Definitions, source dates and remaining gaps</summary><p>Capital, premium receivables, token claim value and redemption liquidity measure different things. Receivables may not be collectible or independent of supporting trust collateral; overlap and encumbrances remain unverified. No current contractual first-loss cushion is established here.</p>';
        var cards=Array.isArray(d.cards)?d.cards:[];
        var deposits=cards.filter(function(c){return ['total_deposits','reusd_deposits','reusde_deposits'].indexOf(c.seriesKey)!==-1;});
        if(deposits.length)h+='<div class="re-deposit-context"><h4>Issuer-labelled deposit values</h4>'+deposits.map(function(c){var p=(c.points||[]).slice(-1)[0];return p?'<p><strong>'+e(c.label)+': '+self.money(p.value)+'</strong> · '+e(self.date(p.reporting_date))+'</p>':'';}).join('')+'<p>Issuer product/program scope; not the dashboard’s separately measured Ethereum-only token claims or an independently reconciled liability census.</p></div>';
        h+='<p>The separate DeFiLlama adapter TVL has a different perimeter and includes an issuer off-chain oracle component. Do not add these totals or interpret their difference as newly discovered assets.</p><p>Reported date: '+e(r.reporting_date)+'. Fetched: '+e(d.retrieved_at)+'. Underlying insurance valuation period: unknown.</p>';
        h+=source?'<p><a href="'+e(source)+'" target="_blank" rel="noopener noreferrer">Re metrics source ↗</a></p>':'';
        h+='</details></section>';return h;
    },
    periodRows: function(selected,days) {
        var cutoff=Date.parse(selected.row.reporting_date)-(days-1)*86400000;
        return selected.history.filter(function(r){return Date.parse(r.reporting_date)>=cutoff;});
    },
    draw: function(selected,days) {
        if(this.chart){this.chart.destroy();this.chart=null;}
        var canvas=document.getElementById('re-capital-chart');if(!canvas||typeof Chart==='undefined')return;
        var rows=this.periodRows(selected,days),colors=['#2563eb','#0f766e','#d97706'];
        this.chart=new Chart(canvas,{type:'line',data:{labels:rows.map(function(r){return r.reporting_date.slice(5,10);}),datasets:[['On-chain capital','onchain_capital'],['Off-chain capital','offchain_capital'],['Premium receivables','premium_receivables']].map(function(x,i){return {label:x[0],data:rows.map(function(r){return Number(r[x[1]])/1e6;}),borderColor:colors[i],backgroundColor:colors[i]+'26',fill:true,pointRadius:0,borderWidth:2,tension:0,stack:'reported'};})},options:{responsive:true,maintainAspectRatio:false,animation:false,interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom',labels:{boxWidth:10,font:{size:11}}},tooltip:{callbacks:{label:function(c){return c.dataset.label+': $'+c.parsed.y.toFixed(1)+'M';}}}},scales:{x:{grid:{display:false},ticks:{maxTicksLimit:6}},y:{stacked:true,beginAtZero:true,ticks:{callback:function(v){return '$'+v+'M';}}}}}});
    },
    render: function(data) {
        var slug=String(data.asset_slug||'').replace(/_/g,'-');if(['reusd-re','reusde-re'].indexOf(slug)===-1)return;
        var section=data.backing&&data.backing.issuer_reported_metrics;if(!section)return;
        var head=document.getElementById('axis-backing-head');if(!head)return;
        if(this.chart){this.chart.destroy();this.chart=null;}
        var old=head.querySelector('#re-reported-metrics');if(old)old.remove();
        var adapter=head.querySelector('.issuer-reserves'),html=this.html(section);
        if(adapter){
            var wrap=document.createElement('details');wrap.className='re-metrics-adapter';var summary=document.createElement('summary');summary.textContent='Separate third-party TVL · source and composition';wrap.appendChild(summary);adapter.parentNode.insertBefore(wrap,adapter);wrap.appendChild(adapter);wrap.insertAdjacentHTML('beforebegin',html);
        }else head.insertAdjacentHTML('beforeend',html);
        var selected=this.select(section);if(!selected||selected.unavailable)return;
        var self=this;this.draw(selected,90);
        head.querySelectorAll('[data-re-range]').forEach(function(button){button.addEventListener('click',function(){head.querySelectorAll('[data-re-range]').forEach(function(b){b.setAttribute('aria-pressed',String(b===button));});self.draw(selected,Number(button.dataset.reRange));});});
    }
};
(function(){var original=CommonRenderer._renderIssuerReportedReserves;CommonRenderer._renderIssuerReportedReserves=function(data){original.call(this,data);ReProtocolMetrics.render(data);};})();
