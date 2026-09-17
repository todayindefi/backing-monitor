/** Metronome msUSD — address-keyed multi-chain backing and exit dashboard. */
var MsUSDMetronomeRenderer = {
    e: function(v) { return CommonRenderer._escapeAttr(String(v == null ? '' : v)); },
    money: function(v) { return v == null ? '—' : CommonRenderer.formatCurrency(Number(v)); },
    pct: function(v, n) { return v == null ? '—' : Number(v).toFixed(n == null ? 1 : n) + '%'; },
    num: function(v, n) { return v == null ? '—' : Number(v).toLocaleString('en-US', {maximumFractionDigits: n == null ? 0 : n}); },
    panel: function(title, body) { return '<div class="panel"><div class="panel-title">' + title + '</div>' + body + '</div>'; },
    head: function(id, number, title, sub, chip) {
        var el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = '<span class="axis-num">' + number + '</span><span class="axis-title">' + title +
            '</span><span class="axis-sub">' + sub + '</span>' + (chip || '');
    },
    card: function(label, value, sub, cls) {
        return '<div class="summary-card"><div class="card-label">' + label + '</div><div class="card-value ' +
            (cls || '') + '">' + value + '</div>' + (sub ? '<div class="text-xs text-slate-500 mt-1">' + sub + '</div>' : '') + '</div>';
    },
    render: function(data, history) {
        if (data.view_slug !== 'msusd-metronome') return;
        var s = data.summary || {}, a = data.asset_specific || {}, chains = a.chains || [];
        var quotes = a.quotes || [], pools = a.dex_pools || [], amo = a.amo || {};
        var q100 = quotes.filter(function(q) { return q.size_usd === 100000 && q.status === 'ok'; })
            .sort(function(x, y) { return y.average_execution_price - x.average_execution_price; })[0];
        var freshness = (data.freshness || {}).status || 'unknown';
        var summary = document.getElementById('summary-cards');
        summary.className = 'grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-3 mb-6';
        summary.innerHTML = [
            this.card('Market price', s.market_price == null ? '—' : '$' + Number(s.market_price).toFixed(4), this.pct(s.premium_discount_pct, 2) + ' vs $1', s.market_price < .99 ? 'text-red-700' : 'text-green-700'),
            this.card('Total supply', this.money(s.total_supply), 'four address-resolved chains'),
            this.card('CDP-backed share', this.pct(s.cdp_backed_share_pct, 2), this.money(s.cdp_debt) + ' matched debt', 'text-red-700'),
            this.card('AMO claim / supply', this.pct(s.amo_claim_pct_of_supply, 2), 'self-referential vamsUSD claim', 'text-amber-700'),
            this.card('Real exit liquidity', this.money(s.real_exit_liquidity_usd), 'external paired side only'),
            this.card('Real exit coverage', this.pct(s.real_exit_coverage_gross_pct, 2), 'gross supply · net ' + this.pct(s.real_exit_coverage_net_of_amo_pct, 2), 'text-red-700'),
            this.card('$100K exit price', q100 ? '$' + q100.average_execution_price.toFixed(4) : '—', q100 ? 'best route · ' + q100.chain : 'no successful route', q100 && q100.average_execution_price >= .95 ? 'text-green-700' : 'text-red-700'),
            this.card('Data freshness', freshness, this.e((data.freshness || {}).as_of || data.timestamp), freshness === 'fresh' ? 'text-green-700' : 'text-red-700')
        ].join('');

        ['section-peg','section-backing','section-liquidity','section-dependencies','section-contract','section-issuer'].forEach(function(id) {
            var el = document.getElementById(id); if (el) el.classList.remove('hidden');
        });
        this._peg(data, history || []);
        this._backing(data);
        this._liquidity(data);
        this._dependencies(data);
        this._contract(data);
        this._issuer(data);
    },
    _peg: function(data, history) {
        var s = data.summary || {};
        this.head('axis-peg-head', 1, 'Peg', 'external market price', '<span class="axis-rating ' + (s.market_price < .99 ? 'r-bad' : 'r-ok') + '">' + this.pct(s.premium_discount_pct, 2) + '</span>');
        var body = document.getElementById('axis-peg-body');
        body.innerHTML = this.panel('Market price', '<div class="grid grid-cols-1 md:grid-cols-3 gap-3"><div class="summary-card"><div class="card-label">CoinGecko price</div><div class="card-value">$' + Number(s.market_price).toFixed(6) + '</div></div><div class="summary-card"><div class="card-label">Deviation from $1</div><div class="card-value text-red-700">' + this.pct(s.premium_discount_pct, 3) + '</div></div><div class="summary-card"><div class="card-label">Identity</div><div class="text-sm font-semibold mt-2">metronome-synth-usd</div><div class="text-xs text-slate-500">never ticker-resolved</div></div></div>' +
            '<div class="chart-container mt-4"><canvas id="msusd-price-chart"></canvas></div>');
        var points = (Array.isArray(history) ? history : (history.entries || [])).filter(function(h) { return h.market_price != null; });
        if (points.length && typeof Chart !== 'undefined') requestAnimationFrame(function() {
            new Chart(document.getElementById('msusd-price-chart'), {type:'line',data:{labels:points.map(function(x){return new Date(x.timestamp).toLocaleDateString();}),datasets:[{label:'msUSD price',data:points.map(function(x){return x.market_price;}),borderColor:'#2563eb',backgroundColor:'transparent',tension:.2}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{suggestedMin:.9,suggestedMax:1.01}}}});
        });
    },
    _backing: function(data) {
        var s=data.summary||{}, a=data.asset_specific||{}, amo=a.amo||{}, chains=a.chains||[];
        this.head('axis-backing-head', 2, 'Backing & Supply', 'gross and net-of-AMO views', '<span class="axis-rating r-bad">CDP matched · ' + this.pct(s.cdp_backed_share_pct,2) + '</span>');
        var section=document.getElementById('section-backing');
        Array.prototype.slice.call(section.children).forEach(function(el){ if(el.id!=='axis-backing-head'&&el.id!=='backing-extra-panels') el.style.display='none'; });
        var cdp=s.cdp_debt||0, claim=s.amo_msusd_claim||0, remaining=Math.max((s.total_supply||0)-cdp-claim,0);
        var total=s.total_supply||1, cdpW=cdp/total*100, amoW=claim/total*100, remW=remaining/total*100;
        var chainRows=chains.map(function(c){var reg=c.pool_registry||{};var util=c.chain==='ethereum'&&c.max_amo_supply?claim/c.max_amo_supply*100:null;return '<tr><td class="font-semibold">'+MsUSDMetronomeRenderer.e(c.chain)+'</td><td class="text-right">'+MsUSDMetronomeRenderer.money(c.total_supply)+'</td><td class="text-right">'+MsUSDMetronomeRenderer.pct(c.total_supply/total*100,1)+'</td><td class="text-right">'+MsUSDMetronomeRenderer.money(c.cdp_debt_msusd)+'</td><td class="text-right">'+MsUSDMetronomeRenderer.money(c.cdp_collateral_oracle_usd)+'</td><td class="text-right">'+MsUSDMetronomeRenderer.pct(c.cdp_debt_msusd&&c.total_supply?c.cdp_debt_msusd/c.total_supply*100:0,2)+'</td><td class="text-right">'+MsUSDMetronomeRenderer.money(c.max_amo_supply)+'<div class="text-[11px] text-slate-400">'+(util==null?'utilization not established':MsUSDMetronomeRenderer.pct(util,1)+' claim/ceiling')+'</div></td><td class="text-right">'+(reg.pool_count==null?'—':reg.pool_count)+'</td><td class="text-right '+(String(reg.master_oracle).toLowerCase().endsWith('dead')?'text-red-700 font-semibold':'')+'">'+(String(reg.master_oracle).toLowerCase().endsWith('dead')?'dead':'live')+'</td><td class="font-mono text-[11px]">'+MsUSDMetronomeRenderer.e(c.implementation||'—')+'</td><td class="text-right '+(c.is_active?'text-green-700':'text-red-700')+'">'+(c.is_active?'active':'inactive')+'</td></tr>';}).join('');
        var flagRows=(data.risk_flags||[]).map(function(f){return '<div class="p-2 mb-2 rounded border '+(f.severity==='critical'?'bg-red-50 border-red-200 text-red-800':'bg-amber-50 border-amber-200 text-amber-800')+'"><strong>'+MsUSDMetronomeRenderer.e(f.code.replace(/_/g,' '))+'</strong><div class="text-xs mt-1">'+MsUSDMetronomeRenderer.e(f.message)+'</div></div>';});
        var flags=flagRows.slice(0,6).join('')+(flagRows.length>6?'<details><summary class="text-sm font-semibold cursor-pointer">'+(flagRows.length-6)+' additional alerts</summary><div class="mt-2">'+flagRows.slice(6).join('')+'</div></details>':'');
        document.getElementById('backing-extra-panels').innerHTML =
            this.panel('Supply composition — liabilities, not additive backing','<div class="h-8 flex rounded overflow-hidden mb-3"><div class="bg-blue-500" style="width:'+cdpW+'%" title="CDP debt"></div><div class="bg-amber-500" style="width:'+amoW+'%" title="AMO vamsUSD claim"></div><div class="bg-slate-300" style="width:'+remW+'%" title="Remaining supply"></div></div><div class="grid grid-cols-1 md:grid-cols-3 gap-3">'+this.card('Matched by CDP debt',this.money(cdp),this.pct(cdpW,2)+' of supply')+this.card('AMO vamsUSD claim',this.money(claim),this.pct(amoW,2)+' · self-referential')+this.card('Remaining / unexplained',this.money(remaining),this.pct(remW,2)+' of supply')+'</div>')+
            '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">'+this.panel('Gross view — all msUSD liabilities',this.card('Gross liabilities',this.money(s.total_supply),'all chains')+this.card('Shared pool collateral',this.money(s.cdp_collateral_usd),this.pct(s.cdp_collateral_usd/s.total_supply*100,2)+' of gross liabilities · not ring-fenced')+this.card('Real exit coverage',this.pct(s.real_exit_coverage_gross_pct,2),'paired-side assets; not protocol reserves'))+this.panel('Net of AMO — third-party supply',this.card('Third-party supply',this.money(s.third_party_supply),'gross less vamsUSD claim')+this.card('Shared pool collateral',this.money(s.cdp_collateral_usd),this.pct(s.cdp_collateral_usd/s.third_party_supply*100,2)+' of net liabilities · not ring-fenced')+this.card('Real exit coverage',this.pct(s.real_exit_coverage_net_of_amo_pct,2),'paired-side assets; not protocol reserves'))+'</div>'+
            '<details class="panel"><summary class="panel-title cursor-pointer">Why the net view can fail</summary><p class="text-sm text-slate-600 mt-3">The AMO claim is denominated in msUSD and is not counted as external backing. Netting it is a liability view, not a guarantee: protocol-owned vault or LP positions cannot withdraw external assets that the underlying pools no longer hold.</p></details>'+
            this.panel('Per-chain state','<div class="overflow-x-auto"><table class="data-table"><thead><tr><th>Chain</th><th class="text-right">Supply</th><th class="text-right">Share</th><th class="text-right">CDP debt</th><th class="text-right">CDP collateral</th><th class="text-right">CDP share</th><th class="text-right">AMO ceiling / use</th><th class="text-right">Pools</th><th class="text-right">Oracle</th><th>Implementation</th><th class="text-right">State</th></tr></thead><tbody>'+chainRows+'</tbody></table></div>')+
            this.panel('AMO and vamsUSD','<div class="grid grid-cols-1 md:grid-cols-4 gap-3">'+this.card('vamsUSD shares',this.money(amo.vamsusd_balance),'held by Ethereum AMO')+this.card('Price per share',this.num(amo.vamsusd_price_per_share,7),'pricePerShare()')+this.card('msUSD claim',this.money(amo.amo_msusd_claim),this.pct(s.amo_claim_pct_of_supply,2)+' of supply')+this.card('Direct external reserves',amo.external_direct_reserves_all_zero===true?'all zero':'see balances','USDC/USDT/DAI/WETH/frxUSD/crvUSD')+'</div>')+
            this.panel('Active alerts',flags||'<div class="text-sm text-green-700">No active alerts.</div>');
    },
    _liquidity: function(data) {
        var s=data.summary||{}, a=data.asset_specific||{}, pools=a.dex_pools||[], quotes=a.quotes||[];
        this.head('axis-liquidity-head',3,'Liquidity & Exit','real non-synth paired assets & executable routes','<span class="axis-rating r-bad">Gross coverage · '+this.pct(s.real_exit_coverage_gross_pct,2)+'</span>');
        var poolRows=pools.sort(function(x,y){return (y.paired_asset_value_usd||0)-(x.paired_asset_value_usd||0);}).map(function(p){return '<tr><td>'+MsUSDMetronomeRenderer.e(p.chain)+'</td><td>'+MsUSDMetronomeRenderer.e(p.venue)+'</td><td class="font-mono text-[11px]">'+MsUSDMetronomeRenderer.e(p.pool_address)+'</td><td class="text-right">'+MsUSDMetronomeRenderer.money(p.msusd_balance)+'</td><td>'+MsUSDMetronomeRenderer.e(p.paired_asset_symbol)+'</td><td class="text-right">'+MsUSDMetronomeRenderer.num(p.paired_asset_balance,2)+'</td><td class="text-right">'+MsUSDMetronomeRenderer.money(p.paired_asset_value_usd)+'</td><td class="text-right '+(p.msusd_pool_weight_pct>80?'text-red-700 font-semibold':'')+'">'+MsUSDMetronomeRenderer.pct(p.msusd_pool_weight_pct,1)+'</td><td>'+MsUSDMetronomeRenderer.e(p.pair_class==='external'?'external':'synth-to-synth')+'</td></tr>';}).join('');
        var quoteRows=quotes.map(function(q){return '<tr><td>'+MsUSDMetronomeRenderer.e(q.chain)+'</td><td class="text-right">'+MsUSDMetronomeRenderer.money(q.size_usd)+'</td><td>'+MsUSDMetronomeRenderer.e(q.status)+'</td><td class="text-right">'+MsUSDMetronomeRenderer.money(q.proceeds_usdc)+'</td><td class="text-right">'+(q.average_execution_price==null?'—':'$'+q.average_execution_price.toFixed(4))+'</td><td class="text-right">'+MsUSDMetronomeRenderer.pct(q.price_impact_pct,2)+'</td><td class="text-xs">'+MsUSDMetronomeRenderer.e(q.reason||'KyberSwap routed quote')+'</td></tr>';}).join('');
        document.getElementById('axis-liquidity-body').innerHTML=this.panel('Real exit capacity','<div class="grid grid-cols-1 md:grid-cols-3 gap-3">'+this.card('External paired assets',this.money(s.real_exit_liquidity_usd),'excludes msUSD and Metronome synths')+this.card('Gross coverage',this.pct(s.real_exit_coverage_gross_pct,2),'vs all supply')+this.card('Net-of-AMO coverage',this.pct(s.real_exit_coverage_net_of_amo_pct,2),'vs third-party supply')+'</div>')+this.panel('Material DEX pools','<div class="overflow-x-auto"><table class="data-table"><thead><tr><th>Chain</th><th>Venue</th><th>Pool</th><th class="text-right">msUSD</th><th>Pair</th><th class="text-right">Pair balance</th><th class="text-right">Pair USD</th><th class="text-right">msUSD weight</th><th>Class</th></tr></thead><tbody>'+poolRows+'</tbody></table></div>')+this.panel('Executable msUSD → USDC quotes','<div class="overflow-x-auto"><table class="data-table"><thead><tr><th>Chain</th><th class="text-right">Input notional</th><th>Status</th><th class="text-right">Proceeds</th><th class="text-right">Avg price</th><th class="text-right">Impact vs market</th><th>Route / failure</th></tr></thead><tbody>'+quoteRows+'</tbody></table></div>');
        document.getElementById('liquidity-extra-panels').innerHTML='';
    },
    _dependencies: function(data) {
        var a=data.asset_specific||{}, id=a.identity||{};
        this.head('axis-dependencies-head',4,'Dependencies','four chains, Metronome registries, Vesper vault and DEX routes','<span class="axis-rating r-warn">Cross-chain</span>');
        document.getElementById('axis-dependencies-body').innerHTML=this.panel('Identity and dependency boundary','<p class="text-sm text-slate-600 mb-3">Every token, pool and quote is resolved by chain and contract address. Mainstreet msUSD and Mento USDm are explicitly excluded identities.</p><div class="overflow-x-auto"><table class="data-table"><tbody><tr><th>CoinGecko</th><td>'+this.e(id.coingecko_id)+'</td></tr><tr><th>Mainstreet collision excluded</th><td class="font-mono">'+this.e((id.excluded_collision||{}).mainstreet_msusd)+'</td></tr><tr><th>Vesper dependency</th><td class="font-mono">'+this.e((a.amo||{}).vamsusd)+'</td></tr></tbody></table></div>');
    },
    _contract: function(data) {
        var chains=(data.asset_specific||{}).chains||[];
        this.head('axis-contract-head',5,'Contract & Admin','live implementation and configuration observations','<span class="axis-rating r-na">Not scored</span>');
        document.getElementById('axis-contract-body').innerHTML=this.panel('Upgradeable token surfaces',chains.map(function(c){return '<div class="summary-card mb-2"><div class="card-label">'+MsUSDMetronomeRenderer.e(c.chain)+'</div><div class="text-sm mt-1">Implementation <span class="font-mono">'+MsUSDMetronomeRenderer.e(c.implementation||'—')+'</span></div><div class="text-xs text-slate-500">active '+MsUSDMetronomeRenderer.e(c.is_active)+' · AMO '+MsUSDMetronomeRenderer.e(c.amo||'—')+'</div></div>';}).join(''));
    },
    _issuer: function() {
        this.head('axis-issuer-head',6,'Issuer / Protocol','editorial assessment not yet published','<span class="axis-rating r-na">Unrated</span>');
        document.getElementById('axis-issuer-body').innerHTML=this.panel('Assessment state','<div class="text-lg font-semibold">No issuer assessment published</div><p class="text-sm text-slate-500 mt-2">This dashboard reports measured backing, supply, contract and exit state. It does not infer an editorial issuer score.</p>');
    }
};
