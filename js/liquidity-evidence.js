/* Source-preserving detail for existing liquidity contracts; never derives a depth or score. */
var LiquidityEvidence = {
    esc: function(v) { return CommonRenderer._escapeAttr(String(v == null ? 'Not supplied' : v)); },
    number: function(v) { return ReUSDChainLadder.finite(v); },
    amount: function(v) { return ReUSDChainLadder.amount(v, 6); },
    primaryResult: function(c, d) {
        var p = d.primary_threshold_bps == null ? d.threshold_bps : d.primary_threshold_bps;
        if (!this.number(p)) return { status: c.status || 'not_measured', threshold_bps: null };
        var key = 'bracket_' + Math.abs(Number(p)) + 'bps', selected = c[key];
        if (!selected && this.number(c.threshold_bps) && Math.abs(Number(c.threshold_bps)) === Math.abs(Number(p))) selected = c;
        if (!selected && d.primary_threshold_bps == null && c.threshold_bps == null) selected = c;
        return Object.assign({}, selected || { status: 'not_measured', basis: 'Primary-threshold result not published.' }, { threshold_bps: p });
    },
    rowDetails: function(r, shared) {
        var e=this.esc, q=shared||{}, venues=r.route_venues, blocks=r.quote_block_numbers;
        var clock=r.quote_as_of || r.quote_timestamp;
        var receipt=r.collected_at || r.received_at;
        var block=Array.isArray(blocks)&&blocks.length?blocks.join(', '):(r.quote_block_number == null ? r.block_number : r.quote_block_number);
        var slots=Array.isArray(r.quote_slot_numbers)&&r.quote_slot_numbers.length?r.quote_slot_numbers.join(', '):r.quote_context_slot;
        var venueText=Array.isArray(venues)?venues.map(function(x){return typeof x==='string'?x:(x.exchange||x.venue||'Unnamed venue');}).join(', '):(r.provider||r.source||q.venue||q.source);
        return '<details class="re-ladder-provenance"><summary>Quote provenance and limits</summary><p>Source quote timestamp: '+e(clock)+'. Reported quoted_at: '+e(r.quoted_at)+'. This field alone does not distinguish provider generation from collector completion. Local receipt: '+e(receipt)+'. Shared observation: '+e(q.quoted_as_of||q.quoted_at||q.measured_at)+'. Missing clocks remain unknown; payload publication is not a quote timestamp.</p><p>Reported venues: '+e(venueText)+'. EVM block metadata: '+e(block)+'. Solana context slot: '+e(slots)+'. These are source observations, not a synchronized execution simulation.</p><p>Gas estimate: '+(this.number(r.gas_usd)?'$'+this.amount(r.gas_usd):'Not supplied')+'. Expiry: '+e(r.quote_expiry||r.expiry)+'. '+e(r.quote_expiry_basis||r.expiry_basis||'No validity guarantee is established.')+'</p>'+(r.route_includes_gated_venue===true?'<p class="re-ladder-warning">Source flags a gated venue in this route; quote success does not establish holder access.</p>':'')+'</details>';
    },
    diagnosticsHtml: function(c, d) {
        var self=this,e=this.esc, results=[];
        if(c.bracket_50bps)results.push(c.bracket_50bps);
        if(c.bracket||c.refinement)results.push(c);
        var stability=c.quote_stability||{}, samples=Array.isArray(stability.samples)?stability.samples:[];
        if(!results.length&&!c.quote_stability)return '';
        var html='<details class="re-ladder-method"><summary>Threshold refinement and quote stability</summary><p>Published diagnostics are separate from configured rung observations. Quote stability limits attainable precision; missing per-draw clocks remain unknown.</p>';
        if(d.status==='quote_only_supply_bounded_floor')html+='<p class="re-ladder-warning">This source publishes a supply-bounded quote floor. Mathematical crossing diagnostics do not establish current public float, holder access or liquidation capacity.</p>';
        html+=results.map(function(r){var br=r.bracket||{},ref=r.refinement||{};return '<p>Threshold: '+(self.number(r.threshold_bps)?self.amount(Math.abs(Number(r.threshold_bps)))+' bps':'not supplied')+'. Status: '+e(r.status)+'. Published bracket: '+(self.number(br.last_clearing_size_usd)?'$'+self.amount(br.last_clearing_size_usd):'unknown')+' to '+(self.number(br.first_crossing_size_usd)?'$'+self.amount(br.first_crossing_size_usd):'unknown')+'. Precision requirement: '+(br.meets_precision_obligation===true?'met':br.meets_precision_obligation===false?'not met':'not supplied')+'.</p><p>'+e(r.basis||ref.basis||'No additional basis supplied')+'</p><p>Refinement: '+e(ref.status)+'. Stop: '+e(ref.stopped_on)+'. Probe count: '+e(ref.probe_count)+'. '+(Number(ref.probe_count)>0?'Interior draw records are not supplied in this summary; do not infer their clocks or reproducibility.':'')+'</p>';}).join('');
        html+='<p>Stability sample size: '+(self.number(stability.sample_size_usd)?'$'+self.amount(stability.sample_size_usd):'not supplied')+'. Successful/requested samples: '+e(stability.successful_samples)+' / '+e(stability.requested_samples)+'. Observed output spread: '+(self.number(stability.output_spread_bps)?self.amount(stability.output_spread_bps)+' bps':'not supplied')+'.</p>';
        if(samples.length)html+='<div class="re-ladder-scroll"><table class="re-ladder-table"><thead><tr><th>Phase / sample</th><th>Reported output value · USD</th><th>Status</th><th>Observation clock</th></tr></thead><tbody>'+samples.map(function(x){return '<tr><td>'+e(x.phase)+' / '+e(x.sample)+'</td><td>'+self.amount(x.output_value_usd)+'</td><td>'+e(x.status||x.failure_kind)+'</td><td>'+e(x.quote_as_of||x.collected_at)+'</td></tr>';}).join('')+'</tbody></table></div>';
        return html+'</details>';
    },
    canonicalHtml: function(data) {
        if (ReUSDChainLadder.accepts(data)) return '';
        var l=data.liquidity||{},d=l.depth||{},rows=d.rungs;
        if (!Array.isArray(rows)||!rows.length) return '';
        var self=this,e=this.esc,q=d.quote||{},per=d.per_chain||{};
        var names=Array.from(new Set(rows.map(function(r){return r.chain||q.chain||'Chain not supplied';}).concat(Object.keys(per))));
        var p=d.primary_threshold_bps==null?d.threshold_bps:d.primary_threshold_bps;
        var h='<section class="panel re-chain-ladder liquidity-evidence" data-liquidity-evidence="canonical"><div class="re-ladder-title"><h3 class="panel-title">Published quote observations</h3><span class="re-ladder-badge">Bounded evidence</span></div>';
        h+='<p class="re-ladder-note">'+e(d.status||'Status not supplied')+'. Primary impact threshold: '+(this.number(p)?e(Math.abs(Number(p)))+' bps':'not established')+'. '+e(d.slippage_convention||'Impact convention not supplied.')+'</p>';
        h+='<p class="re-ladder-note">'+e(q.method||'Quote method not supplied')+'. Payload clock: '+e(l.as_of)+'. Primary redemption, share conversion, bridging, queue settlement and final cash sale remain separate stages; these quotes do not establish a complete cash exit.</p>';
        if(d.basis)h+='<details class="re-ladder-method"><summary>Publisher scope and qualifications</summary><p>'+e(d.basis)+'</p><p>Read the exact chain and output units in each observation. Publisher prose is not a substitute for contract identity or a route.</p></details>';
        if(d.preflight&&d.preflight.passed===false)h+='<p class="re-ladder-warning">Producer preflight failed. Reported quotes below do not establish executable cash depth.</p>';
        h+=names.map(function(name,index){
            var c=per[name]||d,ref=c.baseline_rung||{},address=(q.addresses||{})[name]||{};
            var rr=rows.filter(function(r){return (r.chain||q.chain||'Chain not supplied')===name;});
            var tokenOut=(q.token_out||{}).symbol||address.symbol_out||null;
            var out='<details class="re-chain-result"'+(index===0?' open':'')+'><summary><span>'+e(name)+'</span><span>'+rr.length+' observations</span><span class="re-ladder-status">'+e(c.status||d.status||'unknown')+'</span></summary>';
            out+='<p class="re-ladder-note">Reference size: '+(self.number(ref.size_usd)?'$'+self.amount(ref.size_usd):'not supplied')+'. Reference spread: '+(self.number(ref.slippage_bps)?self.amount(ref.slippage_bps)+' bps':'not supplied')+'. Zero baseline-adjusted impact does not imply a costless exit.</p>';
            if(Number(ref.size_usd||q.baseline_size_usd)===100)out+='<p class="re-ladder-warning">Legacy $100 reference: current $1,000-grid baseline adoption is not established.</p>';
            if(c.blocker)out+='<p class="re-ladder-warning">'+e(c.blocker)+'</p>';
            var tin=q.token_in, tout=q.token_out;
            out+='<details class="re-ladder-method"><summary>Token identity and sizing anchor</summary><p>Input: '+e(address.token_in||(tin&&tin.address)||(typeof tin==="string"?tin:null))+'. Output: '+e(address.token_out||(tout&&tout.address)||(typeof tout==="string"?tout:null))+'.</p><p>Input sizing mark: '+e((d.anchor||{}).fair_value)+'. Mark observed: '+e((d.anchor||{}).fair_value_as_of)+'. Mark basis: '+e((d.anchor||{}).fair_value_basis)+'. A sizing mark is not independent NAV or a redeemable cash balance.</p></details>';
            var result=per[name]?self.primaryResult(c,d):d, br=result.bracket||{};
            if(br.meets_precision_obligation===false)out+='<p class="re-ladder-warning">Crossing precision requirement not met. A lower clearing observation is not the maximum exit size.</p>';
            out+='<p class="re-ladder-small">Scroll the table horizontally on smaller screens to see output units, impact and quote provenance.</p><div class="re-ladder-scroll"><table class="re-ladder-table" data-evidence-rungs><thead><tr><th>Input reference notional</th><th>Quoted output / unit</th><th>Published impact</th><th>Status / provenance</th></tr></thead><tbody>'+rr.map(function(r){
                var adjusted=self.number(r.slippage_bps_debiased),v=adjusted?r.slippage_bps_debiased:r.slippage_bps;
                var unit=r.output_unit||tokenOut||'tokens (unit not supplied)';
                var amount=r.amount_out_tokens;
                if(amount==null&&self.number(r.amount_out_usdc)){amount=r.amount_out_usdc;unit='USDC';}
                if(amount==null&&self.number(r.amount_out_usd)){amount=r.amount_out_usd;unit='USD (publisher mark)';}
                var status=r.status||'Status not supplied';
                return '<tr><td>'+(self.number(r.size_usd)?'$'+self.amount(r.size_usd):'Not supplied')+'<div class="re-ladder-small">'+self.amount(r.amount_in_tokens)+' input tokens</div></td><td>'+self.amount(amount)+' '+e(unit)+'</td><td>'+(self.number(v)?self.amount(v)+' bps<div class="re-ladder-small">'+(adjusted?'Baseline-adjusted':'Source convention above')+'</div>':'Not established')+(self.number(r.own_token_rate_cost_bps)?'<div class="re-ladder-small">Native-token rate cost: '+self.amount(r.own_token_rate_cost_bps)+' bps; not USD cost</div>':'')+'</td><td><strong>'+e(status)+'</strong>'+(r.reason||r.failure_kind||r.failure_basis?'<p class="re-ladder-warning">'+e(r.reason||r.failure_kind||r.failure_basis)+'</p>':'')+self.rowDetails(r,q)+'</td></tr>';
            }).join('')+'</tbody></table></div>';
            if(!rr.length)out+='<p class="re-ladder-warning">No quote observations published. Usable depth is unknown, not zero.</p>';
            return out+self.diagnosticsHtml(c,d)+'</details>';
        }).join('');
        return h+'<p class="re-ladder-note">Reported failures remain failures, not zero liquidity. No cross-chain sum, unreported USD valuation, new depth estimate or execution guarantee is inferred. Re-quote before execution.</p></section>';
    },
    legacyHtml: function(data) {
        var l=data.liquidity||{},d=l.depth||{};
        if(ReUSDChainLadder.accepts(data)||(Array.isArray(d.rungs)&&d.rungs.length))return '';
        var em=l.exit_mark||{},unwrapped=CommonRenderer._unwrapLadderQuotes(em.quotes||{}),quotes=unwrapped.quotes||{};
        var sizes=Object.keys(quotes).filter(function(k){return LiquidityEvidence.number(k);}).sort(function(a,b){return Number(a)-Number(b);});
        if(!sizes.length)return '';
        var self=this,e=this.esc;
        return '<details class="re-ladder-method liquidity-evidence" data-liquidity-evidence="legacy"><summary>Quote provenance and completeness · '+sizes.length+' observations</summary><p>Source: '+e(em.source)+'. Chain: '+e(em.chain)+'. Output: '+e(em.sell_into||unwrapped.pair)+'. Shared observation: '+e(em.measured_at||em.quoted_at)+'. Missing metadata remains unknown; a current payload clock does not establish fresh quotes.</p><p>'+e(em.slippage_convention||em.slippage_bps_basis||l.slippage_bps_basis||'Impact convention not supplied.')+'</p><p>This legacy table does not by itself certify the current decade grid, primary-threshold crossing, refinement precision, stability or complete cash path. TVL is not executable depth. Standing spread and gas may be separate.</p>'+sizes.map(function(sz){var r=quotes[sz]||{};return '<details class="re-ladder-provenance"><summary>$'+self.amount(sz)+' · '+e(r.error||r.status||'Quoted; execution unverified')+'</summary><p>Chain: '+e(r.chain||em.chain)+'. Fill ratio: '+(self.number(r.fill_ratio)?self.amount(r.fill_ratio):'not supplied')+'. Failure: '+e(r.error||'none reported')+'.</p>'+self.rowDetails(r,em)+'</details>';}).join('')+'</details>';
    },
    emptyHtml: function(liq) {
        if(liq.exit_capacity&&typeof liq.exit_capacity==='object')return '';
        return '<p class="text-sm text-slate-500">No sized secondary-exit quotes are published in this view. Depth is unknown; venue inventory, balances and primary-redemption terms do not establish executable secondary liquidity.</p>';
    }
};
