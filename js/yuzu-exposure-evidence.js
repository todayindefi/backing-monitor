/* Producer disclosures: parser coverage is separate from external backing/cash verification. */
var YuzuExposureEvidence = {
    esc: function(x) { return CommonRenderer._escapeAttr(String(x == null ? 'unknown' : x)); },
    money: function(x) { return typeof x==='number' && Number.isFinite(x)?'$'+x.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):'unavailable'; },
    html: function(data) {
        var a=data.asset_specific||{},e=this.esc,m=this.money;
        if(!a.exposure_schema_version)return '<div class="panel" data-yuzu-exposure>Strategy parser metadata unavailable; completeness and external backing remain unverified.</div>';
        var groups=a.exposure_by_strategy||{},leaves=a.exposure_split||{},entries=Object.keys(groups).sort(function(x,y){return groups[y]-groups[x];}),exit=(data.liquidity||{}).primary_exit||{},cashExit=exit.onward||exit,deps=data.dependencies||{};
        var h='<div class="panel" data-yuzu-exposure style="overflow-wrap:anywhere"><div class="panel-title">Disclosed strategy exposure · Yuzu backing</div>'+
            '<p class="text-xs text-slate-500">Reserve snapshot '+e(a.feed_as_of)+' · strategy snapshot '+e(a.exposure_as_of)+' · observation '+e(data.timestamp)+'</p>'+
            '<p class="text-sm mt-3"><strong>Disclosed strategy total: '+m(a.exposure_split_sum)+'</strong><br>Unexplained reserve residual: '+m(a.exposure_residual_usd)+' · '+e(a.exposure_reconciliation_status)+'.</p>'+
            '<p class="text-xs text-slate-500 mt-2">'+e(a.exposure_note)+'</p>'+
            '<p class="text-sm mt-3">Parser coverage: '+e(a.exposure_status)+' · '+e(a.exposure_schema_version)+'. '+e(a.exposure_completeness_basis)+'</p>'+
            '<p class="text-sm mt-1">External backing validation: '+e(a.external_backing_validation)+'. Parsing disclosed amounts does not complete underlying look-through, custody, debt or bridge verification.</p>';
        var reserves=(data.backing||{}).total_backing;
        var protocol=Array.isArray(deps.by_protocol)?deps.by_protocol:entries.map(function(k){return {protocol:k,exposure_usd:groups[k],pct_of_backing:typeof reserves==='number'&&reserves>0?Math.round(groups[k]/reserves*10000)/100:null};});
        if(protocol.length)h+='<p class="text-sm mt-3"><strong>Disclosed concentration</strong> · '+protocol.slice().sort(function(x,y){return (y.exposure_usd||0)-(x.exposure_usd||0);}).slice(0,2).map(function(x){return e(x.protocol)+': '+m(x.exposure_usd)+(typeof x.pct_of_backing==='number'?' ('+e(x.pct_of_backing)+'% of reserves)':'');}).join(' · ')+'</p>';
        h+='<table class="data-table mt-3" style="width:100%;table-layout:fixed"><thead><tr><th>Strategy</th><th>Disclosed USD</th></tr></thead><tbody>'+entries.map(function(k){return '<tr><td>'+e(k)+'</td><td>'+m(groups[k])+'</td></tr>';}).join('')+'</tbody></table>';
        h+='<details class="mt-3"><summary class="text-sm cursor-pointer">Product leaves and parser issues</summary>'+Object.keys(leaves).map(function(k){return '<p class="text-xs mt-1">'+e(k)+': '+m(leaves[k])+'</p>';}).join('')+'<p class="text-xs mt-2">'+e((a.exposure_schema_issues||[]).length?JSON.stringify(a.exposure_schema_issues):'No parser issues reported; this is disclosure parsing, not an external asset audit.')+'</p></details>';
        h+='<div class="border-t mt-3 pt-3 text-sm"><strong>Cash-exit boundary</strong><p>'+e(cashExit.venue||'Issuer redemption route unverified')+'</p><p>Settlement assets: '+e(cashExit.into)+'. External cash capacity: '+m(cashExit.external_liquidity_usd)+'.</p>'+(exit.buffer_identity_note?'<p class="mt-2">'+e(exit.buffer_identity_note)+'</p>':'')+(exit.lp_lookthrough_note?'<p class="mt-2">'+e(exit.lp_lookthrough_note)+'</p>':'')+(exit.onward?'<p class="text-xs text-slate-500 mt-2">Wrapper step: '+e(exit.venue)+' → '+e(exit.into)+'. This does not establish onward cash settlement. Onward eligibility: '+e(cashExit.gated_basis)+'.</p>':'')+'</div>';
        if(a.feed_url)h+='<p class="text-xs mt-3">'+IssuerProjectEvidence.sources([a.feed_url])+'</p>';
        return h+'</div>';
    },
    install: function() {
        var self=this,original=CommonRenderer.renderAxisSections,merge=CommonRenderer.mergeAxisOverlays;
        // PegTracker owns primary redemption; venue inventory must not replace its steps.
        if(merge)CommonRenderer.mergeAxisOverlays=function(data){
            var a=data.asset_specific||{},primary=(data.liquidity||{}).primary_exit;
            var preserve=['yzusd','syzusd'].indexOf(data.asset_slug)!==-1&&a.exposure_schema_version&&primary;
            var result=merge.apply(this,arguments);
            if(preserve){
                data.liquidity=data.liquidity||{};
                var displayPrimary=Object.assign({},primary);
                // Explicit measured/unmeasured stage fields take precedence over legacy blanket prose.
                if(primary.onward&&primary.onward.gated==null&&primary.onward.gated_basis==='unmeasured')displayPrimary.gated_note='Wrapper probe: '+primary.gated_basis+'. Onward eligibility: '+primary.onward.gated_basis+'. Wrapper redemption yields '+primary.into+'; it does not establish external cash settlement.';
                data.liquidity.primary_exit=displayPrimary;
            }
            return result;
        };
        CommonRenderer.renderAxisSections=function(data){
            var result=original.apply(this,arguments);
            if(['yzusd','syzusd'].indexOf(data.asset_slug)!==-1){
                var host=document.getElementById('section-backing');
                if(host){host.querySelectorAll('[data-yuzu-exposure]').forEach(function(el){el.remove();});var head=host.querySelector('#axis-backing-head');if(head)head.insertAdjacentHTML('afterend',self.html(data));else host.insertAdjacentHTML('afterbegin',self.html(data));}
            }
            return result;
        };
    }
};
YuzuExposureEvidence.install();
