/* Existing-surface documentary context; no collector, score or transaction logic. */
var WeeklyRiskReconciliation = {
    windowHtml: function(data) {
        var pe=(data.liquidity||{}).primary_exit||{},w=pe.latest_announced_window,e=CommonRenderer._escapeAttr;
        if(!w)return '';
        var historical=pe.first_window||{};
        return '<div class="panel" id="weekly-redemption-window"><div class="panel-title">Latest announced reUSDe window</div>'+ 
            '<p class="text-sm">Requests: '+e(w.request_start)+' to '+e(w.request_end)+' · claims: '+e(w.claim_start)+' to '+e(w.claim_end)+'. Payout asset: <strong>'+e(w.payout_asset)+'</strong>.</p>'+
            '<p class="text-sm mt-2">'+e(w.eligibility)+'. Current claimant eligibility: <strong>'+e(w.current_claimant_eligibility||'unknown')+'</strong>. Announced terms do not establish actual settlement or remaining capacity.</p>'+
            '<p class="text-xs text-slate-500 mt-2">Source announcement '+e(w.source_date)+' · checked '+e(w.checked)+' · <a class="text-blue-600 underline" href="'+e(w.source)+'" target="_blank" rel="noopener noreferrer">Issuer terms</a>. Backing observation '+e(data.timestamp||'unknown')+'.</p>'+
            '<details class="mt-3"><summary class="text-sm cursor-pointer">First window — historical observation</summary><p class="text-sm">Requests '+e(historical.request_period||'unknown')+'; settlement '+e(historical.settlement_period||'unknown')+'. '+e(historical.result||'Historical settlement details unavailable.')+'</p></details></div>';
    },
    install: function(){
        var self=this,old=CommonRenderer.renderAxisSections;
        CommonRenderer.renderAxisSections=function(data,history){
            document.body.classList.toggle('weekly-risk-review',['usdm','reusd-re','reusde-re','reusd_re','reusde_re','crvusd'].indexOf(data.asset_slug)!==-1);
            var result=old.call(this,data,history);
            if(['reusde-re','reusde_re'].indexOf(data.asset_slug)!==-1){var el=document.getElementById('axis-liquidity-body');if(el)el.insertAdjacentHTML('afterbegin',self.windowHtml(data));}
            var c=data.contract||{};
            if(data.asset_slug==='crvusd' && c.security_followup_note){
                var contract=document.getElementById('axis-contract-body'),e=CommonRenderer._escapeAttr;
                if(contract)contract.insertAdjacentHTML('afterbegin','<div class="panel" id="weekly-security-followup"><div class="panel-title">Bounded security follow-up</div><p class="text-sm">'+e(c.security_followup_note)+'</p><p class="text-xs text-slate-500 mt-2">Reviewed '+e(c.security_followup_reviewed_at||'unknown')+' · RiskAnalyst interpretation of '+e(c.security_followup_source||'security source unavailable')+'. This dated follow-up does not refresh older authority-table observations or full verification dates.</p></div>');
            }
            return result;
        };
    }
};
WeeklyRiskReconciliation.install();
