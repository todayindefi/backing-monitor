const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const context = {CommonRenderer: {formatCurrencyExact: v => '$' + v.toFixed(2)}, Date, Number};
vm.createContext(context);
vm.runInContext(fs.readFileSync('js/renderers/apyx.js','utf8'), context);
const r=context.ApyxRenderer;
const now=Date.parse('2026-11-02T03:00:00Z');
assert.equal(r._attestationAge({attestation_timestamp:'2026-11-01T09:59:07Z',attestation_age_seconds:0},now),61253);
assert.equal(r._attestationAge({attestation_age_seconds:0},now),null);
assert.equal(r._attestationFreshness(r._attestationAge({},now)),'critical');
// Fixed captured operands: hourly live feeds must not make this invariant test drift.
const ba={total_reserves_usd:288705019.43,total_supply_usd:285873514.82,
    pol_usd:73456079.33690907,inventory_usd:67185962.47,collateralization_pct:101.9496};
const before=JSON.stringify(ba);
const html=r._renderRatioBasis(ba,'apyusd');
assert.match(html,/101\.94965%/);
assert.match(html,/100\.99047%/);
assert.match(html,/definitional, not independent solvency/);
assert.equal(JSON.stringify(ba),before);
assert.match(r._renderRatioBasis({},'apxusd'),/unavailable/);
assert.match(r._renderRatioBasis({...ba,total_supply_usd:0},'apxusd'),/unavailable/);
assert.match(r._renderRatioBasis({...ba,collateralization_pct:103},'apxusd'),/source disagreement unresolved/);
assert.equal(r._maintainerThreshold({governance:{maintainer_threshold:'3-of-7'}}),'3-of-7');
assert.equal(r._maintainerThreshold({}),'threshold unavailable');
assert.equal(r._maintainerThreshold({governance:{maintainer_threshold:'<script>'}}),'threshold unavailable');
console.log('Apyx source clock, ratio reconciliation, missing states and threshold checks passed');
