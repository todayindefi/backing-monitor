#!/usr/bin/env python3
"""Build exact Ethereum weETH staging review from public shared producers; offline.

No source-repo writes, new schedule, private research exports or prod registration.
--publish is an explicit manual refresh of an already approved registration.
"""
import argparse
import copy
import hashlib
import json
import os
from pathlib import Path
from datetime import datetime,timezone
from preview_assessment import public_editorial
from dashboard_publication import publish, failed
from public_dashboard_projection import public_projection
REPO=Path(__file__).resolve().parents[1]
ADDRESS='0xcd5fe23c85820f7b72d0926fc9b05b43e359b7ee'

def prepare(policy):
    docs=public_editorial(policy)
    base_path=Path('/home/danger/PegTracker/data/weeth_backing.json')
    base=json.loads(base_path.read_text())
    if base.get('asset_slug')!='weeth' or base.get('identity',{}).get('canonical_contract','').lower()!=ADDRESS:
        raise ValueError('weETH producer deployment mismatch')
    b=base['backing'];deployments=b.get('deployments',[])
    eth=next((x for x in deployments if x.get('chain')=='ethereum' and x.get('contract','').lower()==ADDRESS),None)
    if not eth:raise ValueError('Exact Ethereum supply observation missing')
    # Never inherit a remote grade, merge bridged supplies or scalarize chains.
    b['deployments']=[eth]
    native=copy.deepcopy(base['liquidity']['chains']['ethereum'])
    base['liquidity']={'as_of':native['measured_at'],'denomination':'ETH','total_2pct_depth':None,
        'two_pct_depth_status':'native_eth_ladder','two_pct_depth_basis':native['cost_convention'],
        'ethereum_ladder':native,'primary_exit':{'gated':None,'status':'complete_cash_settlement_not_simulated','mechanism':'weETH unwrap → eETH request → validator/pool funding → claim ETH','queue_timing':None}}
    base['summary']={'total_supply':b['total_supply'],'supply_unit':'weETH shares','collateral_ratio':None,'total_backing':None}
    b['collateral_ratio']=None;b['total_backing']=None
    b['collateral_ratio_basis']='Share conversion is an eETH accounting claim; independent global ETH recovery coverage is not established by this wrapper measurement.'
    base['chain']='ethereum';base['asset_specific']={'type':'weeth','scope':'Exact Ethereum token only; no remote grade inheritance'}
    base['backing_breakdown']=[]
    base['report_url']=policy['report_url'];base['transport']={'scope':'staging_review','assembled_at':datetime.now(timezone.utc).isoformat(),'refresh_mode':'one_off_copy_of_existing_producers','measurement_sha256':hashlib.sha256(base_path.read_bytes()).hexdigest(),'assessment_version':policy['assessment_version'],'evidence_version':policy['evidence_version']}
    outputs={'weeth_backing.json':base}
    for k,d in docs.items():outputs['weeth_'+k+'.json']=d
    h=json.loads(Path('/home/danger/PegTracker/data/weeth_peg_history.json').read_text())
    if h.get('contract_address','').lower()!=ADDRESS or h.get('asset_slug')!='weeth':raise ValueError('weETH history identity mismatch')
    outputs['weeth_peg_history.json']=h
    outputs['weeth_backing_history.json']={'asset_slug':'weeth','entries':[],'absence_reason':'No independent reserve-coverage series exported; the peg history is a separate ETH-denominated price/reference series.'}
    inventory=json.loads(Path('/home/danger/DexTracker/data/liquidity/weeth_liquidity.json').read_text())
    if inventory.get('asset_slug')!='weeth':raise ValueError('weETH venue identity mismatch')
    # Keep the exact chain-specific list and enumeration clock. No all-chain TVL.
    chain=(inventory.get('chains') or {}).get('eth',{})
    venues=[x for x in inventory.get('venues',[]) if x.get('chain') in ['eth','ethereum']]
    base['asset_specific']['assessment']=docs['assessment']
    base['asset_specific']['control_review']=policy['control_review']
    base['asset_specific']['venue_inventory']={'as_of':inventory.get('as_of'),'ethereum':chain,'venues':venues,'note':'Venue inventory only. TVL is not depth, cash availability or independent backing.'}
    assets=json.loads((REPO/'data/assets.json').read_text());assets=[x for x in assets if x['slug']!='weeth']
    assets.append({'slug':'weeth','name':'weETH (Ethereum)','chain':'Ethereum','published':False,'contract_address':ADDRESS,'description':'Wrapped eETH claim; Ethereum-only six-axis staging review.','report_url':policy['report_url'],'report_status':'published','venue_scope':{'chains':['eth']}})
    outputs['assets.json']=assets
    return outputs

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--publish',action='store_true',help='Manual copy to an already approved production registration; creates no job');args=parser.parse_args()
    target=REPO/'previews/weeth';(target/'data').mkdir(parents=True,exist_ok=True)
    try:
        policy=json.loads((REPO/'config/weeth_preview_sources.json').read_text());outputs=public_projection(prepare(policy))
    except Exception:
        if args.publish:failed(REPO,'weeth')
        (target/'data/preview_status.json').write_text(json.dumps({'status':'failed','attempted_at':datetime.now(timezone.utc).isoformat(),'message':'Accepted source validation failed or input unavailable. Prior snapshot retained; source clocks unchanged.'},indent=2)+'\n');raise
    if args.publish:
        try:publish(REPO,policy,outputs,'manual_snapshot')
        except Exception:
            failed(REPO,'weeth')
            raise
    for name,d in outputs.items():
        p=target/'data'/name;temp=p.with_suffix('.tmp');temp.write_text(json.dumps(d,indent=2,allow_nan=False)+'\n');os.replace(temp,p)
    (target/'native-loader.js').write_text((REPO/'previews/fxsave/native-loader.js').read_text().replace('fxsave','weeth'))
    html=(REPO/'index.html').read_text().replace('<head>','<head>\n<base href="../../"><script src="previews/weeth/native-loader.js"></script>',1)
    if 'src="js/renderers/weeth.js' not in html:html=html.replace('<script src="js/app.js', '<script src="js/renderers/weeth.js"></script>\n<script src="js/app.js')
    (target/'index.html').write_text(html)
    (target/'data/preview_status.json').write_text(json.dumps({'status':'success','attempted_at':datetime.now(timezone.utc).isoformat(),'assessment_version':policy['assessment_version']},indent=2)+'\n')
    print('Validated',len(outputs),'weETH preview files; production registry unchanged')
if __name__=='__main__':main()
