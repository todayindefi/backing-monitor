const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({ console });
vm.runInContext(fs.readFileSync('js/renderers/common.js', 'utf8') + '\nthis.common = CommonRenderer;', context);
vm.runInContext(fs.readFileSync('js/renderers/saturn.js', 'utf8'), context);
const renderer = context.SaturnRenderer;
const fixture = () => ({
    chain: 'ethereum', asset_slug: 'usdat',
    summary: { implementation: '0x496a4A33b6181F4536203488d9a05AC1429E702c' },
    asset_specific: { type: 'usdat', trust_stack: { implementation: '0x496a4A33b6181F4536203488d9a05AC1429E702c' } },
    backing: { collateral_ratio: 100 },
    risk_flags: [
        { severity: 'critical', message: 'USDat accounting divergence: holds reserves but totalAssets() reports zero' },
        { severity: 'critical', message: 'USDat implementation drifted from published: now 0x496a4A33b6181F4536203488d9a05AC1429E702c' },
        { code: 'RISK_FEED_STALE', severity: 'warning', message: 'Stale risk feed' }
    ]
});
let data = fixture();
data.risk_flags.push({ severity: 'critical', message: 'USDat token PAUSED' });
renderer._applyUsdatAccountingReview(data);
assert(data.accounting_review);
assert(!data.risk_flags.some(f => /^USDat accounting divergence:|^USDat implementation drifted/.test(f.message)));
assert(data.risk_flags.some(f => f.message === 'USDat token PAUSED'));
assert(data.risk_flags.some(f => f.code === 'RISK_FEED_STALE'));
assert.equal(data.backing.collateral_ratio, 100);
assert.equal(context.common._divergenceContextHtml(data), '');
assert.match(renderer._usdatAccountingReviewHtml(data), /Zero is expected/);
assert.doesNotMatch(data.backing.collateral_ratio_basis, /not contract-allowlisted|reports ~\$38/);
for (const mutation of [
    d => { d.summary.implementation = '0x0000000000000000000000000000000000000001'; },
    d => { d.asset_specific.trust_stack.implementation = '0x0000000000000000000000000000000000000001'; },
    d => { d.chain = 'bnb'; },
    d => { d.asset_specific.type = 'susdat'; },
    d => { delete d.summary.implementation; }
]) {
    data = fixture();
    const before = JSON.stringify(data);
    mutation(data);
    const mutated = JSON.stringify(data);
    assert.notEqual(before, mutated);
    renderer._applyUsdatAccountingReview(data);
    assert.equal(JSON.stringify(data), mutated, 'Unreviewed implementation, chain or sibling must remain untouched');
}
console.log('USDAT reviewed accounting scope and alert preservation checks passed');
const staleIssuer={asset_slug:'usdat',risk_flags:[{code:'RISK_FEED_STALE',severity:'warning',message:'USDat issuer_score stale <tag>'},{code:'RISK_FEED_STALE',severity:'critical',message:'USDat issuer_score critical'},{code:'OTHER',severity:'critical',message:'Paused'}]};
assert.match(renderer._issuerFeedWarningsHtml(staleIssuer),/issuer_score stale &lt;tag&gt;/);
assert.doesNotMatch(renderer._issuerFeedWarningsHtml(staleIssuer),/critical|Paused/);
assert.equal(staleIssuer.risk_flags.length,3);
assert.equal(renderer._issuerFeedWarningsHtml({...staleIssuer,asset_slug:'susdat'}),'');
