/** Ethereum scrvUSD: wrapper evidence within the shared six-axis frame. */
var ScrvUSDRenderer = {
    e: function(v) { return CommonRenderer._escapeAttr(String(v == null ? '' : v)); },
    n: function(v, digits) { return typeof v === 'number' && Number.isFinite(v) ? v.toLocaleString('en-US', {maximumFractionDigits:digits == null ? 2 : digits}) : 'not measured'; },
    value: function(v, unit, digits) { return this.e(this.n(v,digits)) + (typeof v === 'number' && Number.isFinite(v) ? ' '+this.e(unit || '') : ''); },
    note: function(v, warn) { return v ? '<p class="text-sm mt-2 '+(warn ? 'text-amber-700' : 'text-slate-500')+'">'+this.e(v)+'</p>' : ''; },
    panel: function(title, body) { return '<div class="panel scrvusd-panel"><div class="panel-title">'+this.e(title)+'</div>'+body+'</div>'; },
    details: function(title, body) { return '<details class="mt-3"><summary>'+this.e(title)+'</summary>'+body+'</details>'; },
    table: function(heads,rows) {
        var self=this;
        return '<div style="max-width:100%;overflow-x:auto"><table class="data-table"><thead><tr>'+heads.map(function(h){return '<th>'+self.e(h)+'</th>';}).join('')+'</tr></thead><tbody>'+rows.map(function(row){return '<tr>'+row.map(function(cell){return '<td>'+cell+'</td>';}).join('')+'</tr>';}).join('')+'</tbody></table></div>';
    },
    metrics: function(rows) { var self=this;return this.table(['Measure','Value'],rows.map(function(r){return [self.e(r[0]),self.value(r[1],r[2],r[3])];})); },
    preRender: function(data) {
        var d=(data.asset_specific || {}).scrvusd || {};
        if (d.schema_version !== 'scrvusd-detail/1') return;
        data.backing_breakdown=[]; // no independent USD collateral partition
        data.summary.collateral_ratio=null;
        data.summary.total_backing=null; // units are explained in the wrapper panel
        data.backing.collateral_ratio=null;
        data.backing.total_backing=null;
        data.peg.chart_window_days=7;
        data.peg.chart_min_points=2;
        data.peg.chart_strict_window=true;
        data.asset_specific.chart_title='Independent dollar coverage is not derived for this wrapper';
        data.asset_specific.chart_dataset_label='No independent collateral ratio';
        var deps=data.dependencies || {};
        (deps.upstream || []).forEach(function(edge){
            if(edge.slug==='crvusd' && edge.link==='?asset=crvusd')edge.link_type='internal';
        });
        if (Array.isArray(deps.downstream_tracked)) {
            deps.downstream=deps.downstream_tracked.map(function(slug){return {name:slug,slug:slug};});
            deps.downstream_tracked=true;
        }
    },
    market: function(peg) {
        peg=peg || {};
        var valid=peg.status==='ok' && Number.isFinite(peg.market_price) && Number.isFinite(peg.nav) && peg.nav>0;
        return this.panel('Market price versus dollar NAV',valid ? this.metrics([
            ['Market price',peg.market_price,'USD / share',9],
            ['Contemporaneous dollar NAV',peg.nav,'USD / share',9],
            ['Premium / discount',(peg.market_price/peg.nav-1)*100,'%',4]
        ])+this.note('Market quote: '+peg.market_price_as_of+' · '+peg.market_price_source)+
            this.note('Vault NAV: '+peg.nav_as_of+' · block '+peg.nav_block)+
            this.note('crvUSD mark dated by its feed run: '+peg.underlying_price_as_of+'. The parent feed does not publish the price observation time.')+
            this.note(peg.market_price_carried_forward ? 'Market quote carried forward with its original observation time.' : '')+
            this.note('Both prices are USD per share. This comparison includes crvUSD’s dollar value; scrvUSD is not pegged to $1.') :
            this.note('Market comparison unavailable'+((peg.comparison_withheld_reasons || []).length ? ': '+peg.comparison_withheld_reasons.join('; ') : '.') ,true));
    },
    nav: function(d) {
        var parent=d.parent || {}, y=d.yield_data || {}, r=d.rewards || {}, self=this;
        var dist=(d.events || {}).last_distribution;
        return this.panel('Share NAV and rewards',this.note((d.refresh_attempt || {}).status==='failed' ? 'Latest refresh failed. Showing last successful observations with their original times.' : '',true)+this.metrics([
            ['Redeemable NAV',d.nav_crvusd,'crvUSD / share',9],
            ['Dollar NAV reference',d.nav_usd,'USD / share',9],
            ['crvUSD dollar mark',parent.price_usd,'USD / crvUSD',7],
            ['Projected APY',y.status==='ok' ? y.projected_apy_pct : null,'%',3],
            ['Rewards awaiting distribution',r.pending_crvusd,'crvUSD'],
            ['Requested fee weight',r.requested_weight_bps == null ? null : r.requested_weight_bps/100,'%',2],
            ['Receiver allocation cap',r.receiver_cap_bps == null ? null : r.receiver_cap_bps/100,'%',2]
        ])+this.note('Share NAV is denominated in crvUSD. Dollar value inherits crvUSD’s market price; scrvUSD is not pegged to $1.')+
          this.note('Last established reward distribution: '+(dist ? dist.at+' · '+self.n(dist.amount_crvusd)+' crvUSD' : 'not established within the scanned window')+'.')+
          this.details('Reward settings and independent source clocks',
            this.note('Vault block '+d.block+' · '+d.as_of)+
            this.note('Underlying mark: '+(parent.source || 'unknown')+' · '+(parent.as_of || 'time unavailable')+' · '+parent.status)+
            this.note('Projected APY: Curve statistics · '+(y.as_of || 'time unavailable')+' · '+(y.status || 'unknown'))+
            this.metrics([
                ['Minimum requested weight',r.minimum_weight_bps,'bps'],['Scaling factor',r.scaling_factor,''],
                ['TWA averaging window',r.twa_window_seconds,'seconds'],['Minimum snapshot interval',r.min_snapshot_interval_seconds,'seconds'],
                ['Profit unlock period',r.profit_unlock_seconds,'seconds'],['Handler lens circulation',r.lens_circulating_supply_crvusd,'crvUSD']
            ])+this.note(r.allocation_basis)+this.note(r.unlock_basis)+this.note('The handler’s supply lens and historical TWA use a different scope from parent system circulation; current weight cannot be rebuilt by dividing today’s AUM by that other denominator.')+
            this.note('Last profitable vault report: '+(r.last_profit_update_at || 'not measured')+'. This is not automatically the last reward distribution.')+
            this.note('Accrued NAV return is separate from projected APY. Forward history must span at least one day before an observed return is displayed.')));
    },
    accounting: function(d) {
        var a=d.accounting || {};
        return this.panel('Vault health — crvUSD units',this.note('Custody and accounting observed at '+d.as_of+' · block '+d.block)+this.note(a.status==='reconciled' ? 'Custody and accounting reconcile in crvUSD units.' : 'Custody/accounting requires review.',a.status!=='reconciled')+
            this.metrics([
                ['Actual crvUSD custody',a.custody_crvusd,'crvUSD'],['Idle accounting',a.idle_crvusd,'crvUSD'],
                ['Strategy debt (accounting claim)',a.strategy_debt_crvusd,'crvUSD'],['Total assets',a.total_assets_crvusd,'crvUSD'],
                ['Effective share supply',d.effective_supply_shares,'scrvUSD shares'],
                ['Custody minus idle',a.custody_minus_idle_crvusd,'crvUSD',8],
                ['Assets minus idle and debt',a.accounting_difference_crvusd,'crvUSD',8]
            ])+this.note('Full custody reconciliation does not establish dollar solvency. Ultimate collateral and peg risk remain with crvUSD.',true)+
            '<p class="text-sm mt-3"><a href="?asset=crvusd">View crvUSD backing and collateral analysis →</a></p>'+
            this.details('Accounting scope and allocation limits',this.note(a.custody_basis)+
                this.note('Ethereum vault shares and crvUSD assets have different units. No standalone dollar reserve ratio, dollar allocation pie or independent attestations are established. New strategy debt requires strategy-level review.')));
    },
    exit: function(d) {
        var x=d.exits || {}, p=x.primary || {}, q=x.underlying || {}, self=this;
        var ps=p.rungs || [],qs=q.rungs || [];
        var primary=ps.map(function(r){return [self.value(r.target_crvusd,'crvUSD'),self.value(r.input_shares,'shares',6),self.value(r.output_crvusd,'crvUSD',6),self.e(r.status==='failed' && r.input_shares>p.owner_share_balance ? 'Failed: test owner has insufficient shares' : r.status)];});
        var quotes=qs.map(function(r){return [self.value(r.input_crvusd,'crvUSD',6),self.value(r.status==='ok' ? r.usdc_out : null,'USDC',6),self.value(r.status==='ok' ? r.nominal_deviation_bps : null,'bps',2),self.e(r.status==='ok' ? (r.combined_tested && r.primary_status!=='failed' ? 'Both legs observed separately' : 'Underlying quote only') : 'Quote unavailable'),self.e(r.as_of || q.as_of || 'time unavailable')];});
        var passed=ps.filter(function(r){return r.status==='ok';});
        var top=passed.length ? Math.max.apply(null,passed.map(function(r){return r.target_crvusd;})) : null;
        return this.panel('Two-step exit — shares → crvUSD → USDC',
            this.note(top==null ? 'Primary redemption has no successful measured size.' : 'Read-only primary redemption passed through '+this.n(top)+' crvUSD-equivalent; no whole-vault exit was established.',top==null)+
            this.note('Primary simulation: '+(p.as_of || 'not measured')+'. Underlying routes: '+(q.as_of || 'not measured')+'.')+
            this.table(['Target','Input shares','Redemption output','Simulation'],primary)+
            this.note('Underlying cash-out quotes — crvUSD → USDC. Deviation is from nominal $1 per crvUSD, not marginal price impact. USDC is counted at $1; quotes exclude gas and are not submitted trades.')+
            this.table(['Actual/nominal input','USDC quote','From nominal par','Evidence','Quote time'],quotes)+
            this.details('Test owner and simulation limits',
                this.metrics([['Test owner shares',p.owner_share_balance,'shares'],['Owner maxRedeem',p.owner_max_redeem_shares,'shares']])+
                this.note(p.basis)+this.note(q.basis)+
                this.note('A failed larger redeem from this owner can mean insufficient owner shares, not a vault-wide gate. No scrvUSD secondary-market venue enumeration or marginal-impact depth crossing is established. Our held LP withdrawal is a separate path.')));
    },
    controls: function(d) {
        var c=d.controls || {}, events=d.events || {}, self=this;
        var rows=[['Fixed implementation',c.clone_matches_fixed_target ? 'Matched reviewed EIP-1167 target' : 'Mismatch / unestablished'],
            ['Implementation',c.implementation || 'unestablished'],['Shutdown',c.isShutdown===true ? 'Enabled — deposits disabled; withdrawals separately tested' : (c.isShutdown===false ? 'Not enabled' : 'not measured')],
            ['Role manager',c.role_manager],['Pending manager',c.future_role_manager],['Withdrawal module',c.withdraw_limit_module],
            ['Deposit module',c.deposit_limit_module],['Accountant',c.accountant],['Default strategy queue',(c.queue || []).join(', ') || 'Empty'],
            ['Deposit limit',c.deposit_limit_uncapped ? 'Uncapped' : c.deposit_limit_raw]];
        var roleRows=(events.role_observations || []).map(function(r){return [self.e(r.address),self.e(r.vault_role_mask),self.e(r.handler_rate_manager ? 'Yes' : 'No')];});
        return this.panel('Live control state — partial authority coverage',this.note('Observed block '+d.block+' · '+d.as_of)+
            this.table(['Control','Observation'],rows.map(function(r){return [self.e(r[0]),self.e(r[1] || 'not measured')];}))+
            this.note('Fixed clone code does not remove active roles. Profit unlocking is not an admin timelock.',true)+
            this.details('Bounded role observations and change coverage',this.note(c.method)+
                this.note('Recent event scan: '+(events.complete ? 'complete for its stated window' : 'incomplete')+' · blocks '+events.from_block+'–'+events.through_block+'. No full deployment history is claimed.')+
                this.table(['Observed holder','Vault role mask','Handler rate manager'],roleRows)+
                this.table(['Recent control event','Block'],(events.control_events || []).map(function(r){return [self.e(r.name),self.e(r.block)];}))+
                this.note('Not established: '+(c.unestablished || []).join('; '))+this.note(events.error,true)));
    },
    historyPanel: function(history) {
        var now=Date.now(),rows=(history.entries || []).filter(function(r){return now-new Date(r.timestamp).getTime()<=7*86400000;});
        var valid=rows.filter(function(r){return typeof r.nav_crvusd==='number';}).sort(function(a,b){return new Date(a.timestamp)-new Date(b.timestamp);});
        if (valid.length<2) return this.panel('7-day share NAV history',this.note('Insufficient forward observations: '+valid.length+' of at least two required. No backfilled market-price or dollar-coverage history is invented.'));
        var first=valid[0],last=valid[valid.length-1],hours=(new Date(last.timestamp)-new Date(first.timestamp))/3600000;
        var accrued=hours>=24 && first.nav_crvusd>0 ? 'Observed crvUSD/share return: '+this.n((last.nav_crvusd/first.nav_crvusd-1)*100,4)+'% over '+this.n(hours,1)+' hours. This is accrued share conversion, not projected APY or a cash-out return.' : 'Observed NAV return is withheld until the forward series spans at least one day.';
        return this.panel('7-day share NAV history',this.note('Forward observations · '+valid.length+' points. Dollar NAV uses each historical parent mark; neither series is a scrvUSD market quote.')+this.note(accrued)+
            '<div class="grid grid-cols-1 md:grid-cols-2 gap-4"><div><div class="text-xs mb-2">crvUSD per share</div><div style="height:220px;position:relative"><canvas id="scrvusd-nav-underlying"></canvas></div></div>'+
            '<div><div class="text-xs mb-2">USD NAV per share</div><div style="height:220px;position:relative"><canvas id="scrvusd-nav-usd"></canvas></div></div></div>');
    },
    accountingHistory: function(history) {
        var rows=(history.entries || []).filter(function(r){return Date.now()-new Date(r.timestamp).getTime()<=7*86400000;});
        if (rows.length<2) return this.panel('7-day custody and strategy history',this.note('Custody history has fewer than two forward observations. Independent dollar collateral coverage is not tracked for this wrapper.'));
        return this.panel('7-day custody and strategy history','<div style="height:240px;position:relative"><canvas id="scrvusd-custody-history"></canvas></div>'+this.note('crvUSD units · actual custody, idle accounting and strategy debt. This is not dollar collateral coverage.'));
    },
    chart: function(id,rows,series,unit) {
        var node=document.getElementById(id);if (!node || typeof Chart==='undefined') return;
        window._scrvusdCharts=window._scrvusdCharts || {};
        if (window._scrvusdCharts[id]) window._scrvusdCharts[id].destroy();
        window._scrvusdCharts[id]=new Chart(node,{type:'line',data:{labels:rows.map(function(r){return r.timestamp;}),datasets:series.map(function(s){return {label:s[1],data:rows.map(function(r){return typeof r[s[0]]==='number' ? r[s[0]] : null;}),borderColor:s[2],backgroundColor:s[2],pointRadius:2,tension:0.1,spanGaps:false};})},
            options:{responsive:true,maintainAspectRatio:false,scales:{x:{type:'time',time:{unit:'hour'},ticks:{maxTicksLimit:5}},y:{title:{display:true,text:unit}}},plugins:{legend:{display:series.length>1}},interaction:{mode:'index',intersect:false}}});
    },
    render: function(data,history) {
        var d=(data.asset_specific || {}).scrvusd;
        if (!d || d.schema_version!=='scrvusd-detail/1') return;
        history=history || {entries:[]};
        var slot=function(id,html){var el=document.getElementById(id);if(el)el.innerHTML=html;};
        slot('peg-extra-panels',this.market(data.peg)+this.nav(d)+this.historyPanel(history));
        slot('backing-extra-panels',this.accounting(d)+this.accountingHistory(history));
        slot('axis-liquidity-body',this.panel('Exit measurement scope',this.note('Primary redemption and crvUSD cash-out quotes are sampled below. Secondary-market depth, pool TVL and trading volume are not measured for this wrapper. Authored liquidity scores are dated assessments, not measured exit capacity.')));
        slot('liquidity-extra-panels',this.exit(d));
        slot('contract-extra-panels',this.controls(d));
        slot('dependencies-extra-panels',this.panel('Underlying collateral reference',this.note('crvUSD owns the collateral and upstream credit model. No duplicate parent asset graph or dollar reserve is maintained here.')+'<p class="text-sm mt-2"><a href="?asset=crvusd">Open crvUSD’s six-axis dashboard →</a></p>'));
        var legacy=document.getElementById('asset-specific-panels');if(legacy)legacy.innerHTML='';
        var cap=document.getElementById('breakdown-caption');
        var table=document.getElementById('breakdown-table');
        if(table)table.closest('.panel').style.display='none';
        if(cap)cap.textContent='Underlying custody is not a second dollar reserve.';
        var companion=document.getElementById('header-companion-link');
        if(companion){companion.href='?asset=crvusd';companion.textContent='crvUSD underlying →';companion.classList.remove('hidden');}
        document.querySelectorAll('.axis-section').forEach(function(section){
            section.style.minWidth='0';section.style.maxWidth='100%';
            section.querySelectorAll('.panel').forEach(function(panel){panel.style.minWidth='0';panel.style.overflowWrap='anywhere';});
        });
        // Adapt summary metrics to this wrapper without changing any score.
        var cards=document.querySelectorAll('#summary-cards .summary-card');
        var self=this;
        function tile(index,label,value,sub) {
            var card=cards[index];if(!card)return;
            card.querySelector('.card-label').textContent=label;
            card.querySelector('.card-value').textContent=value;
            var subtitle=card.querySelector('.text-xs');if(subtitle)subtitle.textContent=sub;
        }
        var priced=(data.peg || {}).status==='ok' && Number.isFinite(data.peg.market_price) && data.peg.nav>0;
        tile(0,'NAV / price',this.n(priced ? data.peg.market_price : d.nav_usd,6),priced ? 'USD market / share · compared with dollar NAV' : 'USD NAV / share · market comparison unavailable');
        tile(1,'Backing',(d.accounting || {}).status==='reconciled' ? 'Reconciled' : 'Review accounting','crvUSD custody vs idle; dollar solvency inherited');
        var passed=(((d.exits || {}).primary || {}).rungs || []).filter(function(r){return r.status==='ok';});
        tile(2,'Liquidity & exit',passed.length ? this.n(Math.max.apply(null,passed.map(function(r){return r.target_crvusd;})),0)+' crvUSD' : 'Not measured','largest primary simulation · depth crossing unmeasured');
        tile(4,'Smart contract & admin','Partial coverage','live getters; complete authority paths unestablished');
        var depChip=cards[3] && cards[3].querySelector('a.axis-rating');
        if(depChip && typeof (data.dependencies || {}).underlying_score==='number')depChip.textContent='Authored '+data.dependencies.underlying_score+'/10';
        var bandNote=document.querySelector('.axis-band-note');
        if(bandNote)bandNote.textContent='Observed: share NAV, custody and sampled exits. Authored scores retain the report’s assessment. Market comparison uses separately dated USD prices when available. Full authority coverage is not established.';
        ['backing','liquidity'].forEach(function(axis){
            var subtitle=document.querySelector('#axis-'+axis+'-head .axis-sub');
            if(subtitle)subtitle.textContent=axis==='backing' ? 'crvUSD custody reconciliation · dollar solvency inherited' : 'sampled redemption and underlying cash-out · depth unmeasured';
        });
        var chartPanel=document.getElementById('chart-panel');
        if(chartPanel)chartPanel.style.display='none';
        if(chartPanel && chartPanel.querySelector('.panel-title'))chartPanel.querySelector('.panel-title').textContent='Dollar collateral coverage — see crvUSD';
        var declared=document.getElementById('cr-chart-declared-note');
        if(declared)declared.textContent='Independent dollar coverage is not established for this wrapper. Custody history below is in crvUSD units; the parent dashboard owns collateral analysis.';
        var rows=(history.entries || []).filter(function(r){return Date.now()-new Date(r.timestamp).getTime()<=7*86400000;});
        this.chart('scrvusd-nav-underlying',rows,[['nav_crvusd','crvUSD / share','#3b82f6']],'crvUSD / share');
        this.chart('scrvusd-nav-usd',rows,[['nav_usd','USD NAV / share','#22c55e']],'USD / share');
        this.chart('scrvusd-custody-history',rows,[['custody_crvusd','Actual custody','#22c55e'],['idle_crvusd','Idle accounting','#3b82f6'],['strategy_debt_crvusd','Strategy debt','#f59e0b']],'crvUSD');
    }
};
