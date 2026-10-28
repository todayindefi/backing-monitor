#!/usr/bin/env python3
"""Archive actual served BM corrections without replacing the pre-correction review."""
import argparse, collections, datetime, hashlib, json
from pathlib import Path
from urllib.request import urlopen
ROOT = Path(__file__).resolve().parents[1]
REVIEW = ROOT / 'specs/reviews/syrupusdt-2026-10-28-corrected'
FILES = ['syrupusdt_backing.json','syrupusdc_backing.json','syrup_family.json','syrupusdt_backing_history.json','syrupusdt_axis_basis.json','syrupusdt_contract_overlay.json','syrupusdt_contract.json','syrupusdt_issuer.json','syrupusdt_liquidity.json']
def calculate(read):
    b=read('syrupusdt_backing.json');lb=b['asset_specific']['loan_book'];mc=b['asset_specific']['multi_chain'];fam=read('syrup_family.json')
    assert lb['classification_version']=='issuer_economic_v2_2026-10-28'
    assert mc['cross_chain_supply_reconciliation_complete'] is False
    assert mc['total_supply_usd_across_chains'] is None and mc['cross_chain_supply_reconciliation_pct'] is None
    assert set(mc['chains_enumerated'])=={'ethereum','plasma','mantle','bnb','ink'}
    credit=[l for l in lb['loans'] if l['position_type']=='loan'];allrows=lb['loans'];co=lb['concentration_loans_only']
    assert {l['loan_addr'].lower() for l in credit}=={a.lower() for a in co['member_loan_addresses']}
    assert abs(sum(l['principal'] for l in allrows)-lb['principal_out'])<.02
    assert abs(sum(l['principal'] for l in credit)-co['denominator_usd'])<.02
    by=collections.defaultdict(float)
    for l in credit:by[l['borrower'].lower()]+=l['principal']
    values=sorted(by.values(),reverse=True);den=sum(values)
    assert len(by)==co['total_borrowers']==5
    assert abs(sum(values[:3])/den*100-co['top_3_share_pct'])<.011
    assert abs(sum((v/den*100)**2 for v in values)-co['hhi'])<1
    coverage=lb['credit_coverage'];assert not coverage['complete'] and coverage['collateral_ratio_pct'] is None
    assert fam['combined']['collateral_ratio_loans_only_pct'] is None
    assert 'mixed' in fam['combined']['classification_basis']
    numeric=lambda l:isinstance(l.get('collateral',{}).get('usd'),(int,float))
    total=sum(l['principal'] for l in allrows)
    em=b['liquidity']['exit_mark'];overlay=read('syrupusdt_liquidity.json')
    assert not any(k in overlay for k in ['depth','exit_mark','primary_exit'])
    assert em['source']=='kyberswap' and em['chain']=='ethereum' and em['sell_into']=='USDT' and em['fair_value_basis']=='market'
    assert b['peg']['history_ref']=='syrupusdt_backing_history.json' and b['peg']['history_field']=='peg_market_price'
    return dict(timestamp=b['timestamp'],classification_version=lb['classification_version'],summary=b['summary'],peg=b['peg'],vault=b['asset_specific']['vault_state'],all_principal=total,credit_principal=den,concentration_all=lb['concentration'],concentration_credit=co,credit_coverage=coverage,numeric_records=sum(numeric(l) for l in allrows),numeric_all_pct=sum(l['principal'] for l in allrows if numeric(l))/total*100,numeric_credit_pct=sum(l['principal'] for l in credit if numeric(l))/den*100,row_collateral_usd=sum(l['collateral']['usd'] for l in allrows if numeric(l)),unpriced_principal=sum(l['principal'] for l in allrows if not numeric(l)),reported_collateral=lb['collateral_summary'],credit_asset_pct={a:sum(l['principal'] for l in credit if l.get('collateral',{}).get('asset')==a)/den*100 for a in sorted({l.get('collateral',{}).get('asset','unknown') for l in credit})},latest_exit=em,multi_chain=mc,family_timestamp=fam['timestamp'],family_all=fam['cross_pool_concentration_combined'],family_credit=fam['cross_pool_concentration_loans_only'],family_definition=fam['combined']['classification_basis'],history_last_timestamp=read('syrupusdt_backing_history.json')['entries'][-1]['timestamp'])
def main():
    p=argparse.ArgumentParser();p.add_argument('--archive',action='store_true');a=p.parse_args();REVIEW.mkdir(exist_ok=True,parents=True)
    if a.archive:
        assert not (REVIEW/'sources.json').exists(),'Never overwrite an existing served archive'
        manifest={}
        for name in FILES:
            url='https://todayindefi.github.io/backing-monitor/data/'+name
            raw=urlopen(url+'?review=20261028-corrected',timeout=30).read()
            d=json.loads(raw)
            if name=='syrupusdt_backing.json':assert d['asset_specific']['loan_book'].get('classification_version')=='issuer_economic_v2_2026-10-28','Corrected deploy not served yet'
            (REVIEW/name).write_bytes(raw)
            manifest[name]=dict(url=url,retrieved_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),sha256=hashlib.sha256(raw).hexdigest(),timestamp=d.get('timestamp'))
        (REVIEW/'sources.json').write_text(json.dumps(manifest,indent=2)+'\n')
    manifest=json.loads((REVIEW/'sources.json').read_text())
    for name,source in manifest.items():assert hashlib.sha256((REVIEW/name).read_bytes()).hexdigest()==source['sha256']
    m=calculate(lambda n:json.loads((REVIEW/n).read_text()));out=json.dumps(m,indent=2)+'\n'
    if a.archive:(REVIEW/'derived-metrics.json').write_text(out)
    else:assert (REVIEW/'derived-metrics.json').read_text()==out
    print('PASS: corrected served hashes, membership/principal/concentration, incomplete credit coverage, five-chain non-additive supply, mixed family definitions and unchanged peg/ladder selection')
if __name__=='__main__':main()
