/* Shared public facts and material milestones; RiskAnalyst retains all scoring. */
var IssuerProjectEvidence = {
    cache: null,
    esc: function(x) { return CommonRenderer._escapeAttr(String(x == null ? '' : x)); },
    sources: function(xs) { var self=this;return (xs||[]).filter(function(x){return typeof x==='string' && /^https:\/\//.test(x);}).map(function(x,i){return '<a class="text-blue-600 underline" target="_blank" rel="noopener noreferrer" href="'+self.esc(x)+'">Source '+(i+1)+'</a>';}).join(' · '); },
    html: function(feed,asset) {
        var self=this,e=this.esc;
        if(!feed || feed.status!=='available' || feed.schema_version!=='issuer-project-evidence/1')return '<p class="text-xs text-slate-500">Structured issuer evidence unavailable. The authored assessment remains separate.</p>';
        var m=(feed.asset_map||{})[asset],p=m&&(feed.projects||{})[m.project];
        if(!p)return '<p class="text-xs text-slate-500">Structured issuer profile not yet published for this asset.</p>';
        if(!Array.isArray(p.facts)||!Array.isArray(p.entities)||!Array.isArray(p.events))return '<p class="text-xs text-slate-500">Structured issuer fields unavailable: incomplete source shape.</p>';
        var scoped=function(x){return x && (!x.component || x.component===m.component);};
        var facts=(p.facts||[]).filter(scoped),entities=(p.entities||[]).filter(scoped);
        var states={verified:'Verified source',extracted:'Extracted · confirmation pending',searched_not_found:'Searched · not found'};
        function record(x,text){return '<div class="mt-2 text-sm">'+e(text || 'Not established in the reviewed source scope.')+'<div class="text-xs text-slate-500">'+e(states[x.status]||'Not reviewed')+' · '+e(x.basis||'basis unavailable')+' · checked '+e(x.checked||'unknown')+(x.as_of?' · source '+e(x.as_of):'')+' · '+self.sources(x.sources)+'</div></div>';}
        function field(key,label){var rows=facts.filter(function(x){return x.key===key;});return '<div class="border-t border-slate-200 pt-2 mt-2"><div class="font-semibold text-sm">'+label+'</div>'+(rows.length?rows.map(function(x){return record(x,x.value);}).join(''):'<p class="text-xs text-slate-500">'+((p.fact_coverage||[]).some(function(x){return x.key===key && scoped(x) && x.publication_status==="withheld";})?'Research exists; publication review pending.':'Not reviewed in this source scope.')+'</p>')+'</div>';}
        var body='<div class="panel mt-3" data-issuer-project="'+e(m.project)+'"><div class="panel-title">Issuer facts · '+e(p.name)+'</div><p class="text-xs text-slate-500">DeFiAnalyst evidence · profile checked '+e(p.profile_checked||'unknown')+' · RiskAnalyst owns the score and interpretation.</p>';
        body+='<div class="mt-3"><div class="font-semibold text-sm">Responsible entities and roles</div>'+(entities.length?entities.map(function(x){return record(x,(x.name||'Entity not identified in reviewed scope')+' · '+x.role+(x.jurisdiction?' · '+x.jurisdiction:''));}).join(''):'<p class="text-xs text-slate-500">No public entity record published.</p>')+'</div>';
        body+=field('holder_rights','Holder rights')+field('governing_law','Governing law')+field('access_restriction','Access and redemption restrictions')+field('financial_audit','Financial assurance')+'<p class="text-xs text-slate-500 mt-1">Financial statements, reserve attestations and contract audits have different scopes; none substitutes for the others.</p>'+field('governance_path','Documented governance and control')+'<p class="text-xs text-slate-500 mt-1">Documentation is separate from measured current authority. See Contract & Admin for deployed-state evidence.</p>';
        var gov=p.governance||{},t=Date.parse(gov.feed_generated_at),stale=!Number.isFinite(t)||Date.now()-t>48*3600000||t>Date.now()+300000;
        body+='<details class="mt-4" open><summary class="font-semibold text-sm cursor-pointer">Recent material developments</summary><p class="text-xs text-slate-500 mt-1">Passed votes do not establish implemented changes. Events never update the facts or score automatically.</p>';
        var events=(p.events||[]).filter(scoped);
        body+=events.length?events.map(function(x){return '<div class="border-t border-slate-200 mt-2 pt-2 text-sm break-words"><div class="text-xs text-slate-500">'+e(x.date)+' · '+e(x.source_owner)+' · '+e(x.label)+'</div><div>'+e(x.title)+'</div>'+self.sources(x.sources)+(x.executed_at?'<div class="text-xs text-slate-500">Execution clock: '+e(x.executed_at)+'</div>':'')+'</div>';}).join(''):'<p class="text-xs text-slate-500 mt-2">No published material items in this projection; this does not establish inactivity.</p>';
        body+='</details><details class="mt-3"><summary class="text-sm cursor-pointer">Coverage and open questions</summary><p class="text-xs text-slate-500">Governance coverage: '+e(gov.status||'unknown')+' · feed '+e(gov.feed_generated_at||'unavailable')+(stale?' · stale or unavailable':'')+'.</p>';
        (gov.coverage||[]).forEach(function(x){body+='<p class="text-xs text-slate-500">'+e(x.dao)+' · checked '+e(x.last_checked||'unknown')+((!Number.isFinite(Date.parse(x.last_checked))||Date.now()-Date.parse(x.last_checked)>48*3600000)?' · source stale/unavailable':'')+' · '+e(Object.keys(x.source_status||{}).map(function(k){return k+': '+x.source_status[k];}).join(', '))+' · historical completeness '+(x.history_complete?'reported complete':'unverified')+'</p>';});
        body+='<p class="text-xs text-slate-500">'+e(facts.filter(function(x){return x.status==='searched_not_found';}).map(function(x){return x.key.replace(/_/g,' ');}).join(', ')||'No additional public gaps recorded')+'. Unknown is not a negative score. New or changed private records require publication review.</p></details></div>';return body;
    },
    install: function() {
        var self=this,original=CommonRenderer.issuerPanelHtml;
        CommonRenderer.issuerPanelHtml=function(data){
            var asset=data.asset_slug||'';
            if(!self.cache)self.cache=fetch('data/issuer_project_evidence.json?v='+Math.floor(Date.now()/60000)).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;});
            self.cache.then(function(feed){document.querySelectorAll('[data-issuer-evidence-asset]').forEach(function(el){if(el.dataset.issuerEvidenceAsset===asset)el.innerHTML=el.getClientRects().length?self.html(feed,asset):'';});});
            return original.call(this,data)+'<div data-issuer-evidence-asset="'+self.esc(asset)+'"><p class="text-xs text-slate-500">Loading structured issuer evidence…</p></div>';
        };
    }
};
IssuerProjectEvidence.install();
