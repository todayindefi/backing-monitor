const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const context = vm.createContext({console});
vm.runInContext(fs.readFileSync('js/renderers/common.js', 'utf8') + '\nthis.CommonRenderer=CommonRenderer;', context);
vm.runInContext(fs.readFileSync('js/renderers/ethena.js', 'utf8'), context);
const r = context.EthenaRenderer;
const normalization = JSON.parse(fs.readFileSync('tests/fixtures/ethena_october_normalized.json'));
const a = {snapshot_at: normalization.snapshot_at, normalization};
const before = JSON.stringify(a);
const html = r._normalizedAttestationHtml(a);
for (const expected of ['Loan principal', 'Exchange margin', '17,015,301.80', '418,831,520.74',
    '542,218,722.37 USDT-equivalent', '2026-10-21T23:59:00Z', '2026-11-06', 'not additive', '12 EVM + 2 Solana',
    'not current custody assurance', 'pledged security, excluded']) assert.ok(html.includes(expected), expected);
assert.equal(JSON.stringify(a), before);
assert.match(r._normalizedAttestationHtml({...a, snapshot_at:'2026-09-27T23:59:00Z'}), /normalization is invalid/);
const unsafe = structuredClone(a); unsafe.normalization.rows[0].label = '<img src=x onerror=alert(1)>';
assert.doesNotMatch(r._normalizedAttestationHtml(unsafe), /<img src=x/);
const slots = {}; r._set = (id, html) => { slots[id] = html; };
r._fillAttestation({attestation_snapshot:a});
assert.equal(slots['ethena-attestation-panel'], html);
r._fillAttestation({attestation_snapshot:{snapshot_at:'2026-09-27T23:59:00Z',
    custodians:{Historical:100},total_backing_at_snapshot:100.1}});
assert.doesNotMatch(slots['ethena-attestation-panel'], /difference is that rounding/);
assert.match(slots['ethena-attestation-panel'], /residual is not independently reconciled/);
console.log('PASS monthly scope, source clocks, excluded security, currency distinction, fail-visible selection and escaping.');
