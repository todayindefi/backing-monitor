// Scope and failure-state checks; no browser, network or trade execution.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const elements = {};
function element(id) {
    return elements[id] = {id, innerHTML:'', textContent:'', style:{}, children:[],
        classList:{remove(){},add(){},contains(){return false;}},
        querySelector(){return null;}, closest(){return null;}, setAttribute(){}};
}
['asset-specific-panels','summary-cards','chart-panel','asset-anchor-nav','asset-anchor-nav-inner',
 'header-companion-link', ...['peg','backing','liquidity','dependencies','contract','issuer'].flatMap(x=>
 ['section-'+x,'axis-'+x+'-body',x+'-extra-panels'])].forEach(element);
const ctx = vm.createContext({console,window:{},document:{getElementById:id=>elements[id]||null,querySelectorAll:()=>[]}});
vm.runInContext(fs.readFileSync('js/renderers/common.js','utf8')+'\nthis.common=CommonRenderer;',ctx);
vm.runInContext(fs.readFileSync('js/renderers/usdai.js','utf8'),ctx);
const r=ctx.UsdaiRenderer, common=ctx.common;
r._loadPegChart=()=>{}; r._loadNavChart=()=>{}; r._loadFamily=()=>{}; r._loadChainLiquidity=()=>{};
for (const slug of ['usdai','susdai']) {
    const d=JSON.parse(fs.readFileSync('data/'+slug+'_backing.json','utf8'));
    const originalDepth=JSON.stringify(d.liquidity.depth_50bps);
    const inventory=JSON.parse(fs.readFileSync('data/'+slug+'_liquidity.json','utf8'));
    common.mergeAxisOverlays(d,[{axis:'liquidity',file:slug+'_liquidity.json',json:inventory}],slug);
    assert.equal(JSON.stringify(d.liquidity.depth_50bps),originalDepth,'Inventory-only overlay must not replace Peg depth');
    const hist={entries:[{timestamp:'2026-11-06T00:00:00Z'}]};
    r.preRender(d,hist);
    assert.equal(hist.entries[0].collateral_ratio,undefined,'Unknown history must not become100%');
    elements['axis-dependencies-body'].innerHTML='owner dependency sources';
    elements['axis-contract-body'].innerHTML='owner audit/source gaps';
    elements['axis-issuer-body'].innerHTML='owner issuer review';
    r.render(d);
    assert.equal(elements['asset-specific-panels'].innerHTML,'');
    for (const axis of ['peg','backing','liquidity','dependencies','contract','issuer'])
        assert.equal(elements['section-'+axis].style.display,'');
    assert.match(elements['axis-peg-body'].innerHTML,/Signed premium \/ discount/);
    assert.match(elements['backing-extra-panels'].innerHTML,/Measurement and review dates/);
    assert.match(elements['axis-liquidity-body'].innerHTML,/ladder|Ladder|depth|Depth/);
    assert.doesNotMatch(elements['axis-liquidity-body'].innerHTML,/expect material slippage approaching \$500k|No CEX listings/);
    assert.equal(elements['axis-dependencies-body'].innerHTML,'owner dependency sources');
    assert.equal(elements['axis-contract-body'].innerHTML,'owner audit/source gaps');
    assert.equal(elements['axis-issuer-body'].innerHTML,'owner issuer review');
    assert.match(elements['contract-extra-panels'].innerHTML,/usdai-gov-panel/);
    assert.match(elements['asset-anchor-nav-inner'].innerHTML,/#section-liquidity/);
    assert.equal(elements['chart-panel'].style.display,slug==='usdai'?'':'none');
    r.render(d);
    assert.equal((elements['backing-extra-panels'].innerHTML.match(/id="usdai-family-panel"/g)||[]).length,1);
}
const market=r._renderMarketTiles({asset_slug:'susdai',peg:{market_price:1.09,nav_band:{low:1.1,high:1.11}}});
assert.match(market,/-90\.91 bps/);
assert.doesNotMatch(market,/\+90\.91 bps/);
assert.match(market,/source clock: not supplied/);
assert.doesNotMatch(r._renderGovPanel(null,{},'usdai'),/48h|3-of-3|NO DELAY|No pending upgrades|exit window/);
const gov=r._renderGovPanel({as_of:'2026-11-06T00:00:00Z',governance:{min_delay_seconds:172800,
    gov_safe_threshold:3,gov_safe_owners:['a','b','c'],ops_safe_holds_usdai_admin:true,call_scheduled:{scanned:true}}},{},'usdai');
assert.match(gov,/48h/); assert.match(gov,/NO DELAY/);
assert.match(gov,/not a complete pending-state guarantee/);
assert.match(gov,/does not establish time or liquidity to exit/);
assert.match(r._renderFreshness({as_of:'2026-11-06',contract:{as_of:'2026-09-09'}}),/2026-09-09/);
assert.match(r._renderUsdaiCoverage({peg_leg:{comment:'Arbitrum-only denominator'}},{coverage_ratio:1.05}),/not verified global reserve headroom/);
assert.doesNotMatch(r._renderSusdaiDecomposition({decomposition:{}},{}),/Recon closes/);
assert.match(r._renderCreditEvidence({summary:{implied_deployed_loans_usd:123},as_of:'2026-11-06'}),/accounting residual, not independently verified/);
assert.match(r._renderCreditEvidence({}),/No reconciled payment ledger/);
assert.match(r._renderChainLiquidity(null,'usdai'),/not zero liquidity/);
assert.match(r._renderChainLiquidity({schema_version:'unknown'},'usdai'),/No supported chain-specific evidence/);
for (const slug of ['usdai','susdai']) {
    const sidecar=JSON.parse(fs.readFileSync('data/'+slug+'_chain_liquidity.json','utf8'));
    const output=r._renderChainLiquidity(sidecar,slug);
    assert.match(output,/Observed|observed/);
    assert.match(output,/not capacity limits/);
    assert.match(output,/Other reviewed chains/);
    assert.match(output,/2\.5|2,500|2.50/);
    assert.match(output,/no execution or settlement/);
    assert.match(output,/Unknown|Quote unavailable/);
    assert.doesNotMatch(output,/\/home\/danger|source_sha256/);
    assert.match(output,/coarse|incomplete_floor/);
}
const pending=r._renderGovPanel({governance:{call_scheduled:{pending_ops:[{target:'0x1234',eta_iso:'2026-11-07T00:26:30Z'}]}}},{},'usdai');
assert.match(pending,/earliest execution 2026-11-07T00:26:30Z/);
const loans=JSON.parse(fs.readFileSync('data/usdai_loan_evidence.json','utf8'));
const loanHtml=r._renderLoanEvidence(loans);
assert.match(loanHtml,/Reported loan book — partial population/);
assert.match(loanHtml,/176\.7M/);
assert.match(loanHtml,/305\.5M/);
assert.match(loanHtml,/128\.8M/);
assert.match(loanHtml,/Zero reported history does not establish that no payments occurred/);
assert.match(loanHtml,/scheduled, not paid/);
assert.match(loanHtml,/\$0 reported/);
assert.match(loanHtml,/one-off observation/);
assert.match(loanHtml,/not a default or delinquency census/);
assert.match(loanHtml,/2026-06-26/);
assert.doesNotMatch(loanHtml,/undefined|NaN|\/home\/|borrower_address|Guaranteed receipts/);
assert.equal(r._renderLoanEvidence({schema_version:'unknown'}),'');
assert.equal(r._renderLoanEvidence({...loans,chain_id:1}),'');
assert.match(r._renderLoanEvidence({...loans,loan_records:[{publisher_name:'<img src=x>'}]}),/&lt;img/);
let chart;
ctx.Chart=function(_,config){chart=config;return {destroy(){}};};
r._drawPegChart({},[{x:1,y:0.999},{x:2,y:1.001}],'usdai');
assert.equal(chart.options.plugins.annotation.annotations.par.yMin,1);
assert.match(chart.data.datasets[0].label,/market price \(USD\)/);
assert.equal(chart.options.scales.y.ticks.callback(1),'$1.0000');
console.log('USDai/sUSDai axis placement, owner preservation, unknowns, signed comparisons and price-reference checks passed');
