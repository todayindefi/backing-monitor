"""Offline handback integrity review; run from repository root."""
from pathlib import Path
import hashlib
import json
from urllib.parse import urlsplit

D = Path(__file__).parent

def load(p):
    return json.loads(p.read_text())

before = load(D/'before.json')['files']
for name in ['usde_backing_history.json', 'susde_backing_history.json']:
    raw = (D/('original-'+name)).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == before[name]['sha256']
    original = json.loads(raw)['entries']
    current = load(D/name)['entries']
    assert current[:len(original)] == original
    assert len(current) > len(original)
    assert all(x['definition'] == 'ethena_live_repair_v1' for x in current[len(original):])
    assert all(x['market_price'] is None for x in current[len(original):])

usde, susde, family = [load(D/n) for n in ['usde_backing.json','susde_backing.json','ethena_family.json']]
source = usde['source_metadata']['backing']
assert source['source_kind'] == 'issuer_reported'
assert source['independent_custody_verification'] is False
assert source['allocation_status'] == 'unknown'
s = usde['summary']; denom = s['issuer_supply_usd']
assert abs(s['coverage_ratio'] - s['total_backing']/denom) < 1e-6
assert abs(s['coverage_ratio_with_reserve_fund'] - (s['total_backing']+s['reserve_fund_usd'])/denom) < 1e-6
assert s['total_supply'] == usde['asset_specific']['measurements']['supply_by_chain']['ethereum']['total_supply']
v = susde['asset_specific']['measurements']['vault']
assert susde['summary']['total_supply'] == susde['asset_specific']['vault_state']['total_supply_shares'] == v['total_supply']
assert susde['summary']['nav'] == v['nav']
assert abs(susde['summary']['total_assets_usde']-v['total_assets']) < .01
assert family['custody_breakdown'] == [] and family['data_source'] == 'partial'
fee = usde['asset_specific']['measurements']['fee_switch']
assert fee['status'] != 'ok' and fee['milestone_met'] is None and fee['usde_supply_14d_ma_usd'] is None
old_daily, daily = load(D/'daily-before-sanitized.json'), load(D/'ethena_measurements_daily.json')
for k in ['computed_at','price_distributions','mint_redeem','susde_realized_nav_growth']:
    assert daily[k] == old_daily[k], k
assert daily['fee_switch']['milestone_met'] is None
for record in load(D/'ethena_issuer_raw.json').values():
    assert hashlib.sha256(record['raw_body'].encode()).hexdigest() == record['sha256']

def inspect(x):
    if isinstance(x, dict):
        for k, v in x.items():
            if k == 'rpc' and isinstance(v, str):
                assert urlsplit(v).path in ('', '/') and not urlsplit(v).query
            inspect(v)
    elif isinstance(x, list):
        for v in x: inspect(v)
for name in ['usde_backing.json','susde_backing.json','ethena_family.json','ethena_measurements_daily.json']:
    inspect(load(D/name))
print('PASS: legacy history prefixes, new-observation gap, source/clock/units, issuer arithmetic, summary wiring, withheld fee verdict, unchanged daily blocks, raw hashes, RPC host-only metadata')
