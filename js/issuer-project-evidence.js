/* Shared public facts and material milestones; RiskAnalyst retains all scoring. */
var IssuerProjectEvidence = {
    cache: null,
    esc: function(x) { return CommonRenderer._escapeAttr(String(x == null ? '' : x)); },
    sources: function(xs) { var self=this;return (xs||[]).filter(function(x){return typeof x==='string' && /^https:\/\//.test(x);}).map(function(x,i){return '<a class="text-blue-600 underline" target="_blank" rel="noopener noreferrer" href="'+self.esc(x)+'">Source '+(i+1)+'</a>';}).join(' · '); },
    observationDatesText: function(value) {
        if(Array.isArray(value))return value.filter(function(x){return typeof x==='string';}).join(' · ');
        if(!value||typeof value!=='object')return '';
        var out=[];
        ['reviewed_at','observed_at','retrieved_at','effective_date'].forEach(function(k){if(typeof value[k]==='string')out.push(k.replace(/_/g,' ')+': '+value[k]);});
        (Array.isArray(value.source_documents)?value.source_documents:[]).forEach(function(d,i){
            var dates=[];
            if(typeof d.effective_date==='string')dates.push('effective '+d.effective_date);
            if(typeof d.retrieved_at==='string')dates.push('retrieved '+d.retrieved_at);
            if(dates.length)out.push('source '+(i+1)+': '+dates.join(', '));
        });
        return out.join(' · ');
    },
    componentHtml: function(feed,asset) {
        var p=feed.component_profiles[asset],e=this.esc,self=this;
        if(!p||!Array.isArray(p.entities)||!Array.isArray(p.facts)||!p.coverage)return '<div class="panel mt-3" data-issuer-component="'+e(asset)+'">Selected component fields unavailable: incomplete source shape. No family/upstream substitution.</div>';
        if(p.status!=='available_selected_fields')return '<div class="panel mt-3" data-issuer-component="'+e(p.component_slug)+'"><div class="panel-title">Issuer facts · '+e(p.name)+'</div><p class="text-sm">Selected component evidence unavailable or changed; no project, family or underlying rights are substituted.</p></div>';
        var labels={financial_audit:'Independent financial assurance',reserve_attestation:'Reserve-asset assurance',smart_contract_audit:'Code-audit scope — not financial assurance',mint_fee_headroom_audit:'Audit finding: fee minting and ceiling headroom',credit_line_scope:'Documented credit-line scope',credit_line_audit_remediation:'Credit-line audit version and remediation',issuer_obligor_gap:'Issuer and repayment-obligor gap',incident_coverage:'Incident coverage limits',holder_rights:'Holder rights',redemption_limitations:'Redemption and enforcement limits',governing_law:'Governing law',legal_framework:'Legal framework',access_restriction:'Primary access restrictions',custody_enforcement_design:'Custody and enforcement design',financial_assurance_scope:'Financial assurance scope',march_attestation_scope:'Dated reserve-asset examination',governance_path:'Documented governance',dispute_mechanism:'Dispute mechanism',dividend_legal_clock:'Certificate and dividend legal clocks'};
        var states={verified:'Verified source',extracted:'Extracted · confirmation pending',searched_not_found:'Searched · not found',unknown:'Unknown'};
        function record(x,value){return '<div class="mt-2 text-sm">'+e(value==null?'Not established in the reviewed source scope.':value)+'<div class="text-xs text-slate-500">'+e(states[x.status]||'Unknown')+' · '+e(x.basis||'basis unavailable')+' · checked '+e(x.checked||'unknown')+' · source date '+e(x.source_date||'not supplied')+' · observation '+e(x.as_of||'not supplied')+' · '+self.sources(x.source_urls)+'</div></div>';}
        var h='<div class="panel mt-3" data-issuer-component="'+e(p.component_slug)+'" style="overflow-wrap:anywhere"><div class="panel-title">Issuer facts · '+e(p.name)+'</div><p class="text-xs text-slate-500">DeFiAnalyst selected component fields · handback checked '+e(p.handback_checked)+' · profile checked '+e(p.profile_checked||'not supplied')+'. RiskAnalyst owns the unchanged score and interpretation.</p><p class="text-xs text-slate-500 mt-2">This component’s issuer, rights and source clocks are separate from its underlying assets and other family products. Missing fields do not inherit upstream rights.</p>';
        var compact=this.isCompact(asset);
        if(compact)h+=this.compactSummary(p,{component:p.component_slug},p.facts,p.entities)+'<details class="mt-3" data-issuer-legal><summary class="text-sm font-semibold cursor-pointer">Selected legal, custody and assurance sources</summary>';
        var roles=p.entities.filter(function(x){return ['custodian','broker'].indexOf(x.role)===-1;}),custody=p.entities.filter(function(x){return ['custodian','broker'].indexOf(x.role)!==-1;});
        function entity(x){return record(x,(x.name||'Entity not established')+' · '+x.role+(x.jurisdiction?' · '+x.jurisdiction:''));}
        h+='<div class="font-semibold text-sm mt-3">Entities and distinct roles</div>'+(roles.length?roles.map(entity).join(''):'<p class="text-sm mt-2">No issuer identity supplied in this selected component return; no group operator or upstream issuer is substituted.</p>');
        if(custody.length)h+='<details class="mt-3"><summary class="text-sm cursor-pointer">Disclosed custody/broker roles · allocation unverified</summary>'+custody.map(entity).join('')+'</details>';
        function fact(x){return '<div class="border-t border-slate-200 pt-2 mt-3"><div class="font-semibold text-sm">'+e(labels[x.key]||x.key.replace(/_/g,' '))+'</div>'+record(x,x.value)+(x.observation_dates?'<p class="text-xs text-slate-500">Observation dates: '+e(self.observationDatesText(x.observation_dates))+'</p>':'')+'</div>';}
        var core=['holder_rights','governing_law','access_restriction','financial_assurance_scope','march_attestation_scope','legal_framework','dividend_legal_clock'];
        h+=p.facts.length?p.facts.filter(function(x){return core.indexOf(x.key)!==-1;}).map(fact).join(''):'<p class="text-sm mt-3">Component legal facts were not exported in this bounded return. They remain unavailable; this is not a finding that rights are absent.</p>';
        var more=p.facts.filter(function(x){return core.indexOf(x.key)===-1;});
        if(more.length)h+='<details class="mt-3"><summary class="text-sm cursor-pointer">Additional documented rights and controls</summary>'+more.map(fact).join('')+'</details>';
        h+='<p class="text-xs text-slate-500 mt-3">Financial-statement audits, reserve-asset examinations and smart-contract audits have different scopes. Listed custodians do not prove current allocations. Documentary control design and legal effectiveness do not establish deployed authority, payment receipts or successful exits. Current receipt eligibility remains a separate measured surface.</p>';
        if(compact)h+='</details>';
        h+='<details class="mt-3"><summary class="text-sm font-semibold cursor-pointer">Coverage and remaining gaps</summary>';
        Object.keys(p.coverage).forEach(function(k){var x=p.coverage[k];h+='<p class="text-xs text-slate-500 mt-2"><strong>'+e(k.replace(/_/g,' '))+':</strong> '+e(x.state==='not_exported'?'Not exported; unavailable in this selected component return':states[x.state]||x.state)+'. '+e(x.meaning)+'</p>';});
        // available_selected_fields is reached only after exact-hash publication policy approval.
        // Retain the immutable source's scope, but do not display its superseded workflow state.
        p.limitations.forEach(function(x){
            if(x==='Selected public-primary candidate only; private profile remains private. No publication approval or policy change.')x='Selected public-primary documentary fields only; private profile remains private.';
            h+='<p class="text-xs text-slate-500 mt-2">'+e(x)+'</p>';
        });
        h+='<p class="text-xs text-slate-500 mt-2">Unknown is not a negative score. Full-verification and score-decision dates are not advanced by this source review.</p></details>';
        var events=(feed.component_related_events||[]).filter(function(x){return x.project===p.project_slug;});
        if(events.length)h+='<details class="mt-3"><summary class="text-sm font-semibold cursor-pointer">Dated project developments</summary>'+events.map(function(x){return '<p class="text-sm mt-2">Filing '+e(x.filing_date)+' · activity '+e(x.activity_start)+' to '+e(x.activity_end)+' · balances '+e(x.balance_as_of)+' · '+self.sources([x.url])+'. A filing is not a payment or implementation receipt.</p>';}).join('')+'</details>';
        return h+'</div>';
    },
    viewAsset:function(data){return typeof location!=='undefined'?(new URLSearchParams(location.search).get('asset')||data.asset_slug||''):(data.asset_slug||'');},
    getFeed:function(){var self=this;if(!self.cache||Date.now()-(self.cacheAt||0)>60000){self.cacheAt=Date.now();self.cache=fetch('data/issuer_project_evidence.json?v='+Math.floor(Date.now()/60000)).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;});}return self.cache;},
    fillVisible:function(feed,asset){var self=this;document.querySelectorAll('[data-issuer-evidence-asset]').forEach(function(el){if(el.dataset.issuerEvidenceAsset===asset)el.innerHTML=el.getClientRects().length?self.html(feed,asset):'';});},
    installFamilySurfaces:function(){var self=this;['MSTRRenderer','STRCRenderer','STRCxRenderer','ApyxRenderer','SaturnRenderer'].forEach(function(name){var renderer=window[name];if(!renderer||!renderer.render)return;var old=renderer.render;renderer.render=function(data){var result=old.apply(this,arguments),asset=self.viewAsset(data);self.getFeed().then(function(feed){if(self.viewAsset(data)!==asset)return;if(!feed){if(['MSTRRenderer','STRCRenderer'].indexOf(name)!==-1){var failedHost=document.getElementById('asset-specific-panels');if(failedHost)failedHost.insertAdjacentHTML('afterbegin','<div class="panel" data-issuer-component="'+self.esc(asset)+'">Structured issuer evidence unavailable; no underlying or family rights substituted.</div>');}return;}if(!(feed.component_profiles&&Object.prototype.hasOwnProperty.call(feed.component_profiles,asset)))return;var targets=Array.from(document.querySelectorAll('[data-issuer-evidence-asset]')).filter(function(el){return el.dataset.issuerEvidenceAsset===asset&&el.getClientRects().length;});if(!targets.length){var host=document.getElementById('asset-specific-panels');if(host)host.insertAdjacentHTML('afterbegin','<div data-issuer-evidence-asset="'+self.esc(asset)+'"></div>');}self.fillVisible(feed,asset);});return result;};});},
    compactAssets: ['usdai','susdai','yzusd','syzusd','usds','susds','dusd-alto','fxusd'],
    isCompact: function(asset) { return this.compactAssets.indexOf(asset)!==-1; },
    compactSummary: function(p,m,facts,entities) {
        var e=this.esc,self=this;
        var priority=['issuer','redemption_obligor','operator','platform_operator','interface_operator','software_provider_and_deployer','supporting_foundation','foundation','developer'];
        function role(x){return String(x.role||'').replace(/-/g,'_');}
        var named=entities.filter(function(x){return x.name&&priority.indexOf(role(x))!==-1;}).sort(function(a,b){return priority.indexOf(role(a))-priority.indexOf(role(b));}).slice(0,3);
        var h='<div data-issuer-summary="true" class="text-sm mt-3" style="overflow-wrap:anywhere"><div class="font-semibold">Who is responsible?</div>';
        h+=named.length?named.map(function(x){return '<p>'+e(x.name)+' · '+e(String(x.role||'').replace(/[_-]/g,' '))+'</p>';}).join(''):'<p>Responsible entity not established in the published evidence.</p>';
        var unresolved=entities.some(function(x){return ['issuer','redemption_obligor'].indexOf(role(x))!==-1&&!x.name;});
        if(unresolved||!entities.some(function(x){return role(x)==='issuer'&&x.name;}))h+='<p class="text-xs text-slate-500 mt-1">Product issuer/repayment obligor not established; an operator or developer is not a substitute.</p>';
        function pick(keys){for(var i=0;i<keys.length;i++){var x=facts.find(function(f){return f.key===keys[i]&&f.value;});if(x)return x;}return null;}
        var rights=pick(['holder_rights','alpha_tranches']),access=pick(['access_restriction','primary_access']),limits=pick(['discretion_and_exit','redemption_limitations']);
        h+='<div class="font-semibold mt-3">What can holders claim?</div>';
        [rights,access,limits].filter(Boolean).forEach(function(x){h+='<p class="mt-1">'+e(x.value)+'</p>';});
        if(!rights)h+='<p>Product-specific holder rights are not established in this published scope.</p>';
        var gaps=[];
        if(unresolved||!entities.some(function(x){return role(x)==='issuer'&&x.name;}))gaps.push('Product issuer, repayment obligation and holder priority');
        var labels={operator_registration_and_authorization:'Operator registration and authorization',fiat_payout_and_insolvency_priority:'Fiat payout and insolvency priority',current_shutdown_holder_rights:'Current shutdown recourse',legal_registration_and_authorization:'Registration, corporate continuity and authorization',reserve_custody_and_insolvency:'Reserve custody and insolvency protection',financial_audit:'Independent financial assurance',reserve_attestation:'Independent reserve assurance',financial_assurance_scope:'Independent financial assurance',warranty_full_terms:'Enforceable warranty terms',first_loss_current_capacity:'Current funded protection'};
        Object.keys(labels).forEach(function(k){if(facts.some(function(x){return x.key===k&&['searched_not_found','unknown'].indexOf(x.status)!==-1;}))gaps.push(labels[k]);});
        if(gaps.length){h+='<div class="font-semibold mt-3">Main unresolved risks</div><ul class="list-disc ml-5">'+gaps.slice(0,3).map(function(x){return '<li>'+e(x)+'</li>';}).join('')+'</ul>';}
        var events=(p.events||[]).filter(function(x){return !x.component||x.component===m.component;}).slice(0,2);
        if(events.length)h+='<div class="font-semibold mt-3">Recent material changes</div>'+events.map(function(x){return '<p class="mt-1">'+e(x.date)+' · '+e(x.label)+' · '+e(x.title)+'</p>';}).join('');
        else h+='<p class="text-xs text-slate-500 mt-3">No published recent items; activity coverage remains incomplete.</p>';
        h+='<p class="text-xs text-slate-500 mt-2">Documentary facts, not current solvency or exit verification. Credit protection and queue mechanics belong with Backing and Liquidity &amp; Exit; supporting documents remain below.</p></div>';
        return h;
    },
    html: function(feed,asset) {
        var self=this,e=this.esc;
        if(!feed || feed.status!=='available' || feed.schema_version!=='issuer-project-evidence/1')return '<p class="text-xs text-slate-500">Structured issuer evidence unavailable. The authored assessment remains separate.</p>';
        if(feed.component_profiles&&Object.prototype.hasOwnProperty.call(feed.component_profiles,asset))return this.componentHtml(feed,asset);
        var m=(feed.asset_map||{})[asset],p=m&&(feed.projects||{})[m.project];
        if(!p)return '<p class="text-xs text-slate-500">Structured issuer profile not yet published for this asset.</p>';
        if(!Array.isArray(p.facts)||!Array.isArray(p.entities)||!Array.isArray(p.events))return '<p class="text-xs text-slate-500">Structured issuer fields unavailable: incomplete source shape.</p>';
        var scoped=function(x){return x && (!x.component || x.component===m.component);};
        var facts=(p.facts||[]).filter(scoped),entities=(p.entities||[]).filter(scoped),compact=this.isCompact(asset);
        var states={verified:'Verified source',extracted:'Extracted · confirmation pending',searched_not_found:'Searched · not found'};
        function record(x,text){return '<div class="mt-2 text-sm">'+e(text || 'Not established in the reviewed source scope.')+(x.note?'<p class="text-xs text-slate-500 mt-1">'+e(x.note)+'</p>':'')+'<div class="text-xs text-slate-500">'+e(states[x.status]||'Not reviewed')+' · '+e(x.basis||'basis unavailable')+' · checked '+e(x.checked||'unknown')+(x.as_of?' · source '+e(x.as_of):'')+' · '+self.sources(x.sources)+'</div></div>';}
        function field(key,label){var rows=facts.filter(function(x){return x.key===key;});return '<div class="border-t border-slate-200 pt-2 mt-2"><div class="font-semibold text-sm">'+label+'</div>'+(rows.length?rows.map(function(x){return record(x,x.value);}).join(''):'<p class="text-xs text-slate-500">'+((p.fact_coverage||[]).some(function(x){return x.key===key && scoped(x) && x.publication_status==="withheld";})?'Research exists; publication review pending.':'Not reviewed in this source scope.')+'</p>')+'</div>';}
        var body='<div class="panel mt-3" data-issuer-project="'+e(m.project)+'"><div class="panel-title">Issuer facts · '+e(p.name)+'</div><p class="text-xs text-slate-500">DeFiAnalyst evidence · profile checked '+e(p.profile_checked||'unknown')+' · RiskAnalyst owns the score and interpretation.</p>';
        if(compact)body+=this.compactSummary(p,m,facts,entities)+'<details class="mt-3" data-issuer-legal><summary class="text-sm font-semibold cursor-pointer">Legal, custody and assurance details</summary>';
        body+='<div class="mt-3"><div class="font-semibold text-sm">Responsible entities and roles</div>'+(entities.length?entities.map(function(x){return record(x,(x.name||'Entity not identified in reviewed scope')+' · '+x.role+(x.jurisdiction?' · '+x.jurisdiction:''));}).join(''):'<p class="text-xs text-slate-500">No public entity record published.</p>')+'</div>';
        if(Array.isArray(p.display_fields)){body+='<p class="text-xs text-slate-500 mt-2">Documentary verification means reviewed source text, not independent solvency, registration or deployed-control verification. A platform operator is not a confirmed issuer or obligor for every product. Financial assurance remains unestablished in this selected scope.</p>';p.display_fields.forEach(function(x){if(!compact||facts.some(function(f){return f.key===x.key;})||(p.fact_coverage||[]).some(function(f){return f.key===x.key&&scoped(f)&&f.publication_status==='withheld';}))body+=field(x.key,e(x.label));});}else body+=field('holder_rights','Holder rights')+field('governing_law','Governing law')+field('access_restriction','Access and redemption restrictions')+field('financial_audit','Financial assurance')+'<p class="text-xs text-slate-500 mt-1">Financial statements, reserve attestations and contract audits have different scopes; none substitutes for the others.</p>'+field('governance_path','Documented governance and control')+'<p class="text-xs text-slate-500 mt-1">Documentation is separate from measured current authority. See Contract & Admin for deployed-state evidence.</p>';
        if(compact)body+='</details>';
        var gov=p.governance||{},t=Date.parse(gov.feed_generated_at),stale=!Number.isFinite(t)||Date.now()-t>48*3600000||t>Date.now()+300000;
        body+='<details class="mt-4"'+(compact?'':' open')+'><summary class="font-semibold text-sm cursor-pointer">Recent material developments</summary><p class="text-xs text-slate-500 mt-1">Passed votes do not establish implemented changes. Events never update the facts or score automatically.</p>';
        var events=(p.events||[]).filter(scoped);
        body+=events.length?events.map(function(x){return '<div class="border-t border-slate-200 mt-2 pt-2 text-sm break-words"><div class="text-xs text-slate-500">'+e(x.date)+' · '+e(x.source_owner)+' · '+e(x.label)+'</div><div>'+e(x.title)+'</div>'+self.sources(x.sources)+(x.executed_at?'<div class="text-xs text-slate-500">Execution clock: '+e(x.executed_at)+'</div>':'')+'</div>';}).join(''):'<p class="text-xs text-slate-500 mt-2">No published material items in this projection; this does not establish inactivity.</p>';
        body+='</details><details class="mt-3"><summary class="text-sm cursor-pointer">Evidence and coverage</summary><p class="text-xs text-slate-500">Governance coverage: '+e(gov.status||'unknown')+' · feed '+e(gov.feed_generated_at||'unavailable')+(stale?' · stale or unavailable':'')+'.</p>';
        if(gov.event_hold_reason)body+='<p class="text-xs text-slate-500">'+e(gov.event_hold_reason)+'</p>';
        (gov.coverage||[]).forEach(function(x){body+='<p class="text-xs text-slate-500">'+e(x.dao)+' · checked '+e(x.last_checked||'unknown')+((!Number.isFinite(Date.parse(x.last_checked))||Date.now()-Date.parse(x.last_checked)>48*3600000)?' · source stale/unavailable':'')+' · '+e(Object.keys(x.source_status||{}).map(function(k){return k+': '+x.source_status[k];}).join(', '))+' · historical completeness '+(x.history_complete?'reported complete':'unverified')+'</p>';});
        body+='<p class="text-xs text-slate-500">'+e(facts.filter(function(x){return x.status==='searched_not_found';}).map(function(x){return x.key.replace(/_/g,' ');}).join(', ')||'No additional public gaps recorded')+'. Unknown is not a negative score. New or changed private records require publication review.</p></details></div>';return body;
    },
    install: function() {
        var self=this,original=CommonRenderer.issuerPanelHtml,context=CommonRenderer._issuerContextHtml;
        if(context)CommonRenderer._issuerContextHtml=function(data){var h=context.call(this,data);return self.isCompact(self.viewAsset(data))&&h?'<details class="panel mt-3"><summary class="text-sm cursor-pointer">Corroboration and control evidence</summary>'+h+'</details>':h;};
        CommonRenderer.issuerPanelHtml=function(data){
            var asset=self.viewAsset(data);
            self.getFeed().then(function(feed){if(self.viewAsset(data)===asset)self.fillVisible(feed,asset);});
            var authored=original.call(this,data);
            if(self.isCompact(asset)){
                var issuer=data.issuer||{},info=typeof this._issuerAxisInfo==='function'?this._issuerAxisInfo(issuer):{},score=Number.isFinite(info.score)?Number(info.score).toFixed(1)+'/10':'unavailable';
                authored='<div class="panel" data-issuer-rating><div class="panel-title">Issuer · '+self.esc(score)+(/^provisional(?:_|$)/.test(String(issuer.issuer_score_status||''))?' · provisional':'')+'</div><p class="text-xs text-slate-500">RiskAnalyst assessment · score date '+self.esc(issuer.issuer_score_generated_at||'not supplied')+(issuer.issuer_evidence_reviewed?' · documentary review '+self.esc(issuer.issuer_evidence_reviewed):'')+'</p><details class="mt-2"><summary class="text-sm cursor-pointer">Assessment rationale and report</summary>'+authored+'</details></div>';
            }
            return authored+'<div data-issuer-evidence-asset="'+self.esc(asset)+'"><p class="text-xs text-slate-500">Loading structured issuer evidence…</p></div>';
        };
    }
};
IssuerProjectEvidence.install();
