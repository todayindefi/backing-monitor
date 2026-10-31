const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ctx = { console, window: {} }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync('js/renderers/common.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync('js/renderers/syrupusdc.js', 'utf8') + '\nglobalThis.syrup = SyrupUSDCRenderer;', ctx);
const base = {status:'ok', block_timestamp:new Date().toISOString(), block_number:123, underlying_symbol:'USDC', pool_cash:100, queued_assets:200, queued_shares:180, queue_supply_pct:2, cash_coverage_pct:50, additional_funding_needed:100, processing_status:'unavailable'};
for (const slug of ['syrupusdc','syrupusdt']) {
 const html = ctx.syrup._renderRedemptions({redemptions:base},slug);
 assert.match(html,/Pool cash/); assert.match(html,/50.0%/);
 assert.match(html,/Last processed/); assert.match(html,/Unavailable/);
 assert.doesNotMatch(html,/fills on submission|at NAV instantly/);
}
const empty=ctx.syrup._renderRedemptions({redemptions:{...base,pool_cash:0,queued_assets:0,queued_shares:0,additional_funding_needed:0,cash_coverage_pct:null}},'syrupusdc');
assert.match(empty,/No queue/); assert.match(empty,/\$0/);
const stale=ctx.syrup._renderRedemptions({redemptions:{...base,block_timestamp:'2020-01-01T00:00:00Z'}},'syrupusdc');
assert.match(stale,/stale after 2 hours/); assert.doesNotMatch(stale,/50.0%/);
const failed=ctx.syrup._renderRedemptions({redemptions:{status:'unavailable'}},'syrupusdt');
assert.match(failed,/Current redemption observation unavailable/);assert.doesNotMatch(failed,/\$0/);
console.log('PASS redemption cards: both pools, zero, unavailable and stale observations.');
