/** FXUSD review freshness; shared six-axis measurements and charts stay intact. */
var FxUSDRenderer = {
    reviewNotice: function(contract) {
        var c=contract || {};
        var e=function(v){return CommonRenderer._escapeAttr(String(v == null ? '' : v));};
        var r=c.review || {};
        if(r.refreshed_at_utc && Number.isFinite(Date.parse(r.refreshed_at_utc))){
            return '<div class="panel fxusd-authority-review"><h2 class="panel-title">Authority evidence · partial refresh</h2><p class="text-sm">Checked '+e(r.refreshed_at_utc)+' at Ethereum block '+e(r.refreshed_block)+'. Scope: '+e(r.scope || 'scope not specified')+'.</p><p class="text-sm mt-3">The refreshed table below distinguishes revoked paths from active powers. Untouched observations retain their original dates; the baseline walk remains '+e(c.observed_at)+'. This is not a full new authority walk.</p></div>';
        }
        var walk=Date.parse(c.observed_at),review=Date.parse(c.structural_score_generated_at);
        if(!Number.isFinite(walk) || !Number.isFinite(review) || review<=walk)return '';
        var e=function(v){return CommonRenderer._escapeAttr(String(v == null ? '' : v));};
        return '<div class="panel fxusd-authority-review"><h2 class="panel-title">Authority evidence dates differ</h2>'+
            '<p class="text-sm text-amber-700">The authority walk below is a historical observation from '+e(c.observed_at)+'. The newer RiskAnalyst assessment is dated '+e(c.structural_score_generated_at)+'. Historical paths marked active describe the walk date, not a fresh verification of current permissions.</p>'+
            '<details class="mt-3 text-sm"><summary>Newer authored assessment and evidence</summary><p class="mt-3">'+e(c.structural_score_basis || 'No newer basis published.')+'</p><ul class="mt-3">'+(c.code_facts || []).map(function(f){return '<li class="mb-2">'+e(f)+'</li>';}).join('')+'</ul></details></div>';
    },
    render: function(data) {
        var body=document.getElementById('axis-contract-body');if(!body)return;
        var notice=this.reviewNotice(data.contract);
        if(notice){
            body.insertAdjacentHTML('afterbegin',notice);
            body.querySelectorAll('.tw-table').forEach(function(table){
                if(!table.parentElement.classList.contains('fxusd-authority-scroll')){
                    var wrap=document.createElement('div');wrap.className='fxusd-authority-scroll';table.parentNode.insertBefore(wrap,table);wrap.appendChild(table);
                }
            });
            var titles=body.querySelectorAll('.panel-title');
            titles.forEach(function(title){if(/Authority walk/.test(title.textContent))title.textContent=(data.contract.review && data.contract.review.refreshed_at_utc ? 'Authority walk · partial refresh' : 'Historical authority walk · '+data.contract.observed_at);});
        }
    }
};
