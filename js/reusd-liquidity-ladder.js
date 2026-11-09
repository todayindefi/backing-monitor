/* Render the canonical chain-local Re ladder without inventing a cross-chain depth. */
var ReUSDChainLadder = {
    accepts: function(data) { return String(data.asset_slug||'').replace(/_/g,'-')==='reusd-re'; },
    esc: function(v) { return CommonRenderer._escapeAttr(String(v==null?'Not supplied':v)); },
    finite: function(v) { return (typeof v==='number'||(typeof v==='string'&&/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(v.trim())))&&Number.isFinite(Number(v)); },
    amount: function(v,digits) { return this.finite(v)?Number(v).toLocaleString('en-US',{maximumFractionDigits:digits==null?2:digits}):'Not established'; },
    chain: function(v) { return ({eth:'ethereum',avax:'avalanche'})[v]||v; },
    result: function(c,d) {
        var primary=d.primary_threshold_bps==null?d.threshold_bps:d.primary_threshold_bps;
        var chosen=Math.abs(Number(primary))===50?c.bracket_50bps:c;
        if(!chosen&&Math.abs(Number(c.threshold_bps==null?d.threshold_bps:c.threshold_bps))===Math.abs(Number(primary)))chosen=c;
        if(!chosen)chosen={status:c.status==='bracketed'?'not_measured':c.status,basis:'The primary-threshold crossing was not established on this chain.'};
        return Object.assign({},chosen,{threshold_bps:primary});
    },
    clockText: function(d) {
        var q=d.quote||{},s=q.solana_appendix;
        var text='Initial collection: '+(q.quoted_as_of||'not supplied')+(q.collection_finished_at?' to '+q.collection_finished_at:'');
        if(s)text+='; Solana collection: '+(s.collection_started_at||'not supplied')+' to '+(s.collection_finished_at||'not supplied');
        return text+'; individual quote-generation and local receipt clocks remain separate';
    },
    html: function(data) {
        if(!this.accepts(data))return '';
        var l=data.liquidity||{},d=l.depth||{},chains=d.per_chain;
        if(!chains||typeof chains!=='object'||!Object.keys(chains).length)return '';
        var self=this,e=this.esc,rungs=Array.isArray(d.rungs)?d.rungs:[],primary=d.primary_threshold_bps==null?d.threshold_bps:d.primary_threshold_bps;
        var names=Object.keys(chains),inventory=(l.venue_census||{}).chains||{};
        var missing=Object.keys(inventory).filter(function(k){return inventory[k].local_dollar_exit===true&&!names.some(function(n){return self.chain(n)===self.chain(k);});});
        var unresolved=missing.length||rungs.some(function(x){return x.status!=='ok';})||names.some(function(n){var r=self.result(chains[n],d);return ['bracketed','located'].indexOf(r.status)===-1||(r.status==='bracketed'&&(r.bracket||{}).meets_precision_obligation!==true);});
        var h='<section class="panel re-chain-ladder" id="reusd-chain-ladder"><div class="re-ladder-title"><h3 class="panel-title">Routed quote ladder</h3><span class="re-ladder-badge">'+(unresolved?'Bounded / incomplete results':'Measured configured chains')+'</span></div>';
        h+='<p class="re-ladder-note">Separate chain-local exits. Primary impact limit: '+(this.finite(primary)?e(Math.abs(Number(primary)))+' bps':'not supplied')+'. No combined cross-chain depth is inferred.</p>';
        h+='<p class="re-ladder-note">'+e((d.denomination_scope||{}).measured_leg||'Read each chain’s quoted token pair below.')+' · bridging, primary redemption and final cash settlement excluded.</p>';
        h+=names.map(function(name,index){
            var c=chains[name]||{},r=self.result(c,d),rows=rungs.filter(function(x){return self.chain(x.chain)===self.chain(name);}).slice().sort(function(a,b){return Number(a.size_usd)-Number(b.size_usd);});
            var ref=c.baseline_rung||{},refSize=ref.size_usd,br=r.bracket||{},valid=rows.filter(function(x){return x.status==='ok';}).length;
            var range=self.finite(br.last_clearing_size_usd)&&self.finite(br.first_crossing_size_usd)?'$'+self.amount(br.last_clearing_size_usd)+'–$'+self.amount(br.first_crossing_size_usd):self.finite(r.depth_usd)&&r.is_floor?'≥$'+self.amount(r.depth_usd):'Depth not established';
            var out='<details class="re-chain-result"'+(index===0?' open':'')+'><summary><span>'+e(name)+'</span><span>'+e(range)+'</span><span class="re-ladder-status">'+e(r.status||c.status||'unknown')+' · '+valid+'/'+rows.length+' valid quotes</span></summary>';
            if(br.meets_precision_obligation===false)out+='<p class="re-ladder-warning">Coarse bracket: the precision requirement was not met. The lower bound is a tested clearing size, not the maximum exit size.</p>';
            if(r.basis||c.basis)out+='<p class="re-ladder-note">Producer note: '+e(r.basis||c.basis)+'</p>';
            if(c.blocker)out+='<p class="re-ladder-warning">'+e(c.blocker)+'</p>';
            if(c.termination)out+='<p class="re-ladder-note">Collection stop: '+e(c.termination)+'</p>';
            out+='<p class="re-ladder-note">Reference quote: '+(self.finite(refSize)?'$'+self.amount(refSize):'not supplied')+'. Impact is the change in average execution rate versus this reference, not an adjacent-rung price derivative. The reference spread is excluded; zero adjusted impact does not mean a costless exit.</p>';
            if(self.finite(ref.slippage_bps))out+='<p class="re-ladder-note">Published reference spread: '+e(Number(ref.slippage_bps).toFixed(2))+' bps under the source’s input-mark convention; reference output '+self.amount(ref.amount_out_tokens,6)+' tokens.</p>';
            if(Number(refSize)===100)out+='<p class="re-ladder-warning">Legacy $100 reference: this source has not adopted the current $1,000-grid baseline rule.</p>';
            if(rows.length)out+='<div class="re-ladder-scroll"><table class="re-ladder-table" data-re-rungs><thead><tr><th>Input size · USD mark</th><th>Quoted output · tokens</th><th>Impact vs reference</th><th>Status / observation</th></tr></thead><tbody>'+rows.map(function(x){
                var impact=self.finite(x.slippage_bps_debiased)?Number(x.slippage_bps_debiased).toFixed(2)+' bps':'Not supplied';
                var route=Array.isArray(x.route_venues)?x.route_venues.join(', '):'Not supplied';
                var blocks=Array.isArray(x.quote_block_numbers)&&x.quote_block_numbers.length?x.quote_block_numbers.join(', '):'Not supplied';
                var slots=Array.isArray(x.quote_slot_numbers)&&x.quote_slot_numbers.length?x.quote_slot_numbers.join(', '):(self.finite(x.quote_context_slot)?x.quote_context_slot:'Not supplied');
                return '<tr><td>'+(self.finite(x.size_usd)?'$'+self.amount(x.size_usd):'Not supplied')+'<div class="re-ladder-small">'+self.amount(x.amount_in_tokens,6)+' input tokens</div></td><td>'+self.amount(x.amount_out_tokens,6)+'</td><td>'+e(impact)+'</td><td><strong>'+e(x.status||'unknown')+'</strong><div class="re-ladder-small">Quote: '+e(x.quote_as_of)+'<br>Collected: '+e(x.collected_at)+'</div>'+(x.reason||x.failure_kind?'<div class="re-ladder-warning">'+e(x.reason||x.failure_kind)+'</div>':'')+'<details class="re-ladder-provenance"><summary>Route and quote details</summary><p>Reported venues: '+e(route)+'.</p><p>Reported EVM block metadata: '+e(blocks)+'. Solana context slots: '+e(slots)+'. These may differ; this is not a single-block execution simulation.</p><p>Reported gas estimate: '+(self.finite(x.gas_usd)?'$'+self.amount(x.gas_usd,4):'not supplied')+'; not deducted from token output.</p><p>Quote expiry: '+e(x.quote_expiry||'not supplied')+'. Re-quote before execution; a quote does not establish a fill or settlement.</p></details></td></tr>';
            }).join('')+'</tbody></table></div>';
            else out+='<p class="re-ladder-warning">No rung observations are published for this chain. This does not establish zero liquidity.</p>';
            var draws=(Array.isArray(c.probe_evidence)?c.probe_evidence:[]).filter(function(x){return x.phase&&x.phase!=='decade';});
            if(draws.length)out+='<details class="re-ladder-method"><summary>Refinement and stability evidence · '+draws.length+' draws</summary><p>All measured thresholds; separate from the public decade grid. Temporal route changes are not proof of structural market non-monotonicity.</p><div class="re-ladder-scroll"><table class="re-ladder-table"><thead><tr><th>Input size · USD mark</th><th>Impact vs reference</th><th>Phase / status</th><th>Quote / collection clock</th></tr></thead><tbody>'+draws.map(function(x){return '<tr><td>'+(self.finite(x.size_usd)?'$'+self.amount(x.size_usd):'Not supplied')+'</td><td>'+(self.finite(x.slippage_bps_debiased)?e(Number(x.slippage_bps_debiased).toFixed(2))+' bps':'Not supplied')+'</td><td>'+e(x.phase)+' · '+e(x.status)+'</td><td>Quote: '+e(x.quote_as_of)+'<div class="re-ladder-small">Collected: '+e(x.collected_at)+'</div></td></tr>';}).join('')+'</tbody></table></div></details>';
            var refine=r.refinement||c.refinement;
            if(refine)out+='<p class="re-ladder-note">Refinement: '+e(refine.status)+' · '+e(refine.probe_count==null?(Array.isArray(refine.probes)?refine.probes.length:'unknown'):refine.probe_count)+' probes. '+e(refine.stopped_on||'See the source’s declared stopping reason.')+'</p>';
            return out+'</details>';
        }).join('');
        if(missing.length)h+='<p class="re-ladder-warning">Inventory-only dollar-exit venues have no measured ladder: '+e(missing.join(', '))+'. Inventory TVL is not executable depth. Inventory clock: '+e((l.venue_census||{}).as_of)+'.</p>';
        h+='<details class="re-ladder-method"><summary>Format and measurement limits</summary><p>Published size grid: $1,000, $10,000, $100,000, $1m, $10m and higher decades as needed. The producer may stop when a threshold is crossed or a source fails. Refinement probes are separate from the published grid.</p><p>Impact values retain the producer’s sign and baseline. Token output is indicative; no USDC/USD conversion, bridge cost, primary redemption or settlement guarantee is added.</p><p>Collection windows: '+e(this.clockText(d))+'. Individual observations retain their own clocks. Source payload: '+e(l.as_of||'not supplied')+'.</p><a href="data/reusd_re_liquidity.json" target="_blank" rel="noopener">Canonical liquidity JSON ↗</a></details></section>';
        return h;
    }
};
