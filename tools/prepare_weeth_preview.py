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

def clock(value):
    if not value:
        return None
    return datetime.fromisoformat(value.replace('Z', '+00:00'))


def usable_clock(candidate, previous=None):
    try:
        observed = clock(candidate)
        prior = clock(previous)
        return observed is not None and observed <= datetime.now(timezone.utc) and (prior is None or observed >= prior)
    except (TypeError, ValueError, AttributeError):
        return False


def source_body(path, expected=None):
    raw = path.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    if expected is not None and digest != expected:
        raise ValueError(f'Checked source digest mismatch: {path.name}')
    return json.loads(raw), digest


def prepare(policy, selection=None):
    docs=public_editorial(policy)
    if selection is not None:
        for key in ('backing', 'peg_history'):
            selected = selection.get(key) or {}
            if not selected.get('path') or len(str(selected.get('sha256', ''))) != 64:
                raise ValueError(f'Checked source selection missing path or digest: {key}')
    sources = selection or {}
    base_src = sources.get('backing', {})
    history_src = sources.get('peg_history', {})
    base_path = Path(base_src.get('path', '/home/danger/PegTracker/data/weeth_backing.json'))
    base, source_digest = source_body(base_path, base_src.get('sha256'))
    current_path = REPO / 'data/weeth_backing.json'
    previous = json.loads(current_path.read_text()) if current_path.exists() else {}
    status = {}
    if base.get('asset_slug')!='weeth' or base.get('identity',{}).get('canonical_contract','').lower()!=ADDRESS:
        raise ValueError('weETH producer deployment mismatch')
    b=base['backing'];deployments=b.get('deployments',[])
    eth=next((x for x in deployments if x.get('chain')=='ethereum' and x.get('contract','').lower()==ADDRESS),None)
    if not eth:raise ValueError('Exact Ethereum supply observation missing')
    # Accounting is a coherent bundle. Do not mix its rate and balances across blocks.
    old_peg = previous.get('peg', {})
    current_peg = base['peg']
    old_eth = (previous.get('backing', {}).get('deployments') or [{}])[0]
    if (b.get('supply_unit') != 'weETH shares' or b.get('total_assets_unit') != 'eETH claim units'
            or b.get('nav_unit') != 'eETH per weETH share' or eth.get('decimals') != 18
            or not isinstance(eth.get('block_number'), int) or eth['block_number'] <= 0
            or not usable_clock(eth.get('measured_at'), old_eth.get('measured_at'))
            or eth.get('measured_at') != current_peg.get('nav_as_of')):
        raise ValueError('Ethereum accounting bundle is unqualified; prior snapshot retained')
    status['accounting'] = 'selected'
    b['deployments'] = [eth]
    if (not isinstance(current_peg.get('market_price'), (int, float)) or current_peg['market_price'] <= 0
            or not usable_clock(current_peg.get('market_price_as_of'), old_peg.get('market_price_as_of'))):
        for key in ('market_price', 'market_price_source', 'market_price_as_of'):
            current_peg[key] = old_peg.get(key)
        current_peg['premium_discount_pct'] = None
        status['oracle'] = 'last_good' if current_peg['market_price'] is not None else 'unavailable'
    else:
        status['oracle'] = 'selected'

    old_native = previous.get('liquidity', {}).get('ethereum_ladder', {})
    native = copy.deepcopy((base.get('liquidity', {}).get('chains') or {}).get('ethereum') or {})
    if (native.get('chain') != 'ethereum' or native.get('denomination') != 'ETH'
            or not usable_clock(native.get('measured_at'), old_native.get('measured_at'))
            or native.get('status') != 'ok' or native.get('ladder_complete') is not True
            or not native.get('rungs')):
        native = copy.deepcopy(old_native)
        status['quotes'] = 'last_good' if native else 'unavailable'
    else:
        status['quotes'] = 'selected'
    base['liquidity']={'as_of':native.get('measured_at'),'denomination':'ETH','total_2pct_depth':None,
        'two_pct_depth_status':'native_eth_ladder','two_pct_depth_basis':native.get('cost_convention'),
        'ethereum_ladder':native,'primary_exit':{'gated':None,'status':'complete_cash_settlement_not_simulated','mechanism':'weETH unwrap → eETH request → validator/pool funding → claim ETH','queue_timing':None}}
    base['summary']={'total_supply':b['total_supply'],'supply_unit':'weETH shares','collateral_ratio':None,'total_backing':None}
    b['collateral_ratio']=None;b['total_backing']=None
    b['collateral_ratio_basis']='Share conversion is an eETH accounting claim; independent global ETH recovery coverage is not established by this wrapper measurement.'
    base['chain']='ethereum';base['asset_specific']={'type':'weeth','scope':'Exact Ethereum token only; no remote grade inheritance'}
    base['backing_breakdown']=[]
    base['report_url']=policy['report_url'];base['transport']={'scope':'staging_review','assembled_at':datetime.now(timezone.utc).isoformat(),'refresh_mode':'one_off_copy_of_existing_producers','measurement_sha256':source_digest,'assessment_version':policy['assessment_version'],'evidence_version':policy['evidence_version']}
    outputs={'weeth_backing.json':base}
    for k,d in docs.items():outputs['weeth_'+k+'.json']=d
    hist_path = Path(history_src.get('path', '/home/danger/PegTracker/data/weeth_peg_history.json'))
    h, history_digest = source_body(hist_path, history_src.get('sha256'))
    base['transport']['peg_history_sha256'] = history_digest
    status['history'] = 'last_good' if history_src.get('retain_last_good') is True else 'selected'
    if h.get('contract_address','').lower()!=ADDRESS or h.get('asset_slug')!='weeth':raise ValueError('weETH history identity mismatch')
    outputs['weeth_peg_history.json']=h
    outputs['weeth_backing_history.json']={'asset_slug':'weeth','entries':[],'absence_reason':'No independent reserve-coverage series exported; the peg history is a separate ETH-denominated price/reference series.'}
    old_inventory = previous.get('asset_specific', {}).get('venue_inventory', {})
    base['asset_specific']['assessment'] = docs['assessment']
    base['asset_specific']['control_review'] = policy['control_review']
    try:
        inventory, venue_digest = source_body(Path('/home/danger/DexTracker/data/liquidity/weeth_liquidity.json'))
        chain = (inventory.get('chains') or {}).get('eth') or {}
        venues = [x for x in inventory.get('venues', []) if x.get('chain') in ('eth', 'ethereum')]
        if (inventory.get('asset_slug') != 'weeth' or str(chain.get('token', '')).lower() != ADDRESS
                or chain.get('status') != 'queried'
                or not usable_clock(chain.get('queried_at'), (old_inventory.get('ethereum') or {}).get('queried_at'))):
            raise ValueError('Ethereum venue inventory unqualified')
        base['asset_specific']['venue_inventory'] = {
            'as_of': inventory.get('as_of'), 'ethereum': chain, 'venues': venues,
            'note': 'Venue inventory only. TVL is neither depth nor available cash.'}
        base['transport']['venue_inventory_sha256'] = venue_digest
        status['venues'] = 'selected'
    except (OSError, ValueError, TypeError, KeyError):
        base['asset_specific']['venue_inventory'] = old_inventory
        status['venues'] = 'last_good' if old_inventory else 'unavailable'
    base['transport']['field_status'] = status
    assets=json.loads((REPO/'data/assets.json').read_text());assets=[x for x in assets if x['slug']!='weeth']
    assets.append({'slug':'weeth','name':'weETH (Ethereum)','chain':'Ethereum','published':False,'contract_address':ADDRESS,'description':'Wrapped eETH claim; Ethereum-only six-axis staging review.','report_url':policy['report_url'],'report_status':'published','venue_scope':{'chains':['eth']}})
    outputs['assets.json']=assets
    return outputs

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--publish',action='store_true',help='Manual copy to an already approved production registration; creates no job');parser.add_argument('--selection',type=Path,help='BM intake JSON pinning the accepted source paths and hashes');args=parser.parse_args()
    target=REPO/'previews/weeth';(target/'data').mkdir(parents=True,exist_ok=True)
    try:
        policy=json.loads((REPO/'config/weeth_preview_sources.json').read_text());selection=json.loads(args.selection.read_text()) if args.selection else None;outputs=public_projection(prepare(policy, selection))
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
