#!/usr/bin/env python3
"""Validate FXSave deliveries and prepare an isolated preview using the real app.

No writes to data/, producer repositories, the serving registry or cron. Editorial
judgments are pinned; recurring measurements retain their independent source clocks.
"""
import argparse
import copy
import importlib.util
from datetime import datetime, timezone
import json
import math
import os
from pathlib import Path
import subprocess
import tempfile

REPO=Path(__file__).resolve().parents[1]
PEG=Path('/home/danger/PegTracker/data/dashboard_pending/fxsave')
DEX=Path('/home/danger/DexTracker/data/dashboard_pending/fxsave')
EDITORIAL_REPO=Path('/home/danger/riskAnalyst')
EDITORIAL_COMMIT='31bcc8159349f9203e3a6f4f038804868fbbb14d'
ADDRESS='0x7743e50f534a7f9f1791dde7dcd89f7783eefc39'
EDITORIAL=('axis_basis','backing_overlay','dependencies','contract_overlay','issuer','evidence_review')

def finite(value):
    return isinstance(value,(int,float)) and not isinstance(value,bool) and math.isfinite(value)

def validate_base(base):
    detail=base['asset_specific']['fxsave']
    if base.get('asset_slug')!='fxsave' or detail.get('schema_version')!='fxsave-detail/1' or detail['identity']['address'].lower()!=ADDRESS:
        raise ValueError('Unexpected FXSave identity or schema')
    if detail['identity']['underlying'].lower()!='0x65c9a641afceb9c0e6034e558a319488fa0fa3be':
        raise ValueError('Unexpected direct underlying')
    difference=int(detail['raw']['custody'])-int(detail['raw']['assets'])
    accounting=detail.get('accounting',{})
    if difference!=int(accounting.get('accounting_difference_raw','0')) or (difference==0)!=(accounting.get('status')=='reconciled'):
        raise ValueError('Raw custody difference/status is inconsistent')
    for group in ('summary','backing'):
        if base[group].get('collateral_ratio') is not None or base[group].get('total_backing') is not None:
            raise ValueError('Vault accounting is not an independent dollar reserve')
    for route in ('queued','instant'):
        for leg in ('fxusd_per_share','usdc_per_share'):
            value=detail['redemption'][route].get(leg)
            if not finite(value) or value<0: raise ValueError('Both payout legs are required')
    for field in ('nav_usd','total_supply_shares','total_assets_fxsp','fxsp_per_share'):
        if not finite(detail.get(field)) or detail[field]<=0: raise ValueError('Invalid '+field)
    return detail

def compact_ladder(ladder):
    if ladder.get('asset_slug')!='fxsave' or ladder.get('address','').lower()!=ADDRESS:
        raise ValueError('Ladder identity mismatch')
    if ladder.get('atomic_execution') is not False or ladder.get('gas_included') is not False:
        raise ValueError('Unreviewed execution/fee scope')
    mark=1.0
    if ladder.get('schema_version')=='fxsave-liquidity/2':
        reference=ladder.get('market_marks',{}).get('usdc',{})
        mark=reference.get('usd_per_token')
        if reference.get('status')!='ok' or not finite(mark) or mark<=0:
            raise ValueError('USD reference unavailable for v2 costs')
    rows=[]
    for row in ladder['rows']:
        out={k:row[k] for k in ('size_nav_usd','shares_raw','basket_block','queued','instant')}
        out['usdc_usd_mark']=mark
        if not finite(out['size_nav_usd']) or out['size_nav_usd']<=0: raise ValueError('Invalid ladder size')
        if int(out['shares_raw'])<=0: raise ValueError('Invalid share input')
        for basket in ('queued','instant'):
            for key in ('fxusd_raw','usdc_raw'):
                if int(out[basket][key])<0: raise ValueError('Invalid basket output')
        for name in ('direct','fxusd_market'):
            quote=row[name]
            out[name]={k:quote.get(k) for k in ('status','as_of','failure','input_raw','clock_status','clock_skew_seconds','gas_estimate')}
            if quote.get('status')!='ok':
                out[name]['usdc_out']=None
                out[name]['retained_quote_as_of']=(quote.get('last_good',{}).get('quote') or {}).get('as_of')
                continue
            expected=row['shares_raw'] if name=='direct' else row['instant']['fxusd_raw']
            if str(quote.get('input_raw'))!=str(expected): raise ValueError('Mismatched route input')
            if quote.get('input_decimals')!=18 or quote.get('output_decimals')!=6 or quote.get('output_units')!='USDC':
                raise ValueError('Unexpected route token units')
            proceeds=quote.get('usdc_out')
            if not finite(proceeds) or proceeds<0: raise ValueError('Invalid quote proceeds')
            raw=quote.get('quote',{}).get('amountOut')
            if raw is None or not math.isclose(int(raw)/1e6,proceeds,abs_tol=1e-6): raise ValueError('Quote amount mismatch')
            out[name]['usdc_out']=proceeds
            out[name]['gas_usd_estimate']=(quote.get('quote') or {}).get('gasUsd')
            out[name]['route_pools']=sorted({str(hop['pool']).lower() for group in (quote.get('quote') or {}).get('route',[]) for hop in group if isinstance(hop,dict) and hop.get('pool')})
        if out['direct']['status']=='ok':
            expected=(out['direct']['usdc_out']*mark/row['size_nav_usd']-1)*1e4
            if not math.isclose(expected,row['direct_bps'],abs_tol=1e-6): raise ValueError('Direct-cost mismatch')
        if out['fxusd_market']['status']=='ok':
            total=out['fxusd_market']['usdc_out']+int(out['instant']['usdc_raw'])/1e6
            expected=(total*mark/row['size_nav_usd']-1)*1e4
            if not math.isclose(expected,row['fxusd_market_bps'],abs_tol=1e-6): raise ValueError('Basket-cost mismatch')
        rows.append(out)
    if not rows: raise ValueError('Empty ladder')
    policy=ladder.get('ladder_policy',{})
    if policy.get('version')=='fleet-section7/1':
        sizes=[row['size_nav_usd'] for row in rows]
        if len(rows)>10 or len(set(sizes))!=len(sizes) or any(size not in [1000*10**i for i in range(10)] for size in sizes):
            raise ValueError('Nonstandard published decade rungs')
        for name in ('direct','fxusd_market'):
            successful=[r for r in rows if r[name]['status']=='ok']
            actual=min((r['size_nav_usd'] for r in successful),default=None)
            if policy.get('baseline_size_nav_usd',{}).get(name)!=actual:
                raise ValueError('Declared standard baseline is not first successful decade')

    diagnostics=[]
    for probe in ladder.get('diagnostic_probes',[]):
        doc={k:probe.get(k) for k in ('size_nav_usd','shares_raw','basket_block','rung_kind')}
        doc['routes']={name:{k:probe.get(name,{}).get(k) for k in ('status','as_of','usdc_out','failure')} for name in ('direct','fxusd_market')}
        diagnostics.append(doc)
    return {'diagnostic_probes':diagnostics,**{k:copy.deepcopy(ladder.get(k)) for k in ('timestamp','started_at','block','block_as_of','nav_usd','queue_seconds','crossings_nav_usd','mark_convention','fxusd_route_crossing_input_fxusd','fxusd_observed_peak_usdc','cadence','market_marks','gas_basis','clock_basis','rung_set','crossing_quality','crossings','diagnostics','ladder_policy','route_profiles')},'schema_version':'fxsave-matched-exits/1','gas_included':False,'atomic_execution':False,'stale_after_seconds':14400,'rows':rows}

def topology_for_preview():
    spec=importlib.util.spec_from_file_location('fxsave_axis5',REPO/'tools/emit_axis5.py')
    emitter=importlib.util.module_from_spec(spec);spec.loader.exec_module(emitter)
    # The shared emitter keeps its publication gate; only this temporary review
    # registry authorizes FXSave. The production registry is never modified.
    with tempfile.TemporaryDirectory(prefix='fxsave-axis5-') as folder:
        scope=Path(folder);(scope/'data').mkdir()
        (scope/'data/assets.json').write_text(json.dumps([{'slug':'fxsave','published':False}]))
        emitter.REPO_ROOT=str(scope)
        payload=emitter.emit('fxsave')
    payload['consumer_scope']='isolated preview; committed hand-walk only'
    payload['topology_commit']=subprocess.run(['git','-C',emitter.SECURITY_ANALYST_REPO,'rev-parse','HEAD'],check=True,capture_output=True,text=True).stdout.strip()
    return payload


def compact_inventory(inventory):
    pools=[]
    targets={ADDRESS:'fxsave','0x085780639cc2cacd35e474e71f4d000e2405d8f6':'fxusd'}
    for pool in inventory.get('pools',[]):
        coins={str(c).lower() for c in pool.get('coinsAddresses',[])}
        assets=[name for address,name in targets.items() if address in coins]
        if not assets:continue
        tvl=pool.get('usdTotal')
        pools.append({'address':pool.get('address'),'name':pool.get('name'),'assets':assets,'tvl_usd':tvl if finite(tvl) else None,'coins':[{'address':c.get('address'),'symbol':c.get('symbol')} for c in pool.get('coins',[])],'is_broken':pool.get('isBroken')})
    return {'as_of':inventory.get('as_of'),'scope':inventory.get('scope'),'sources':inventory.get('sources',[]),'pools':pools}

def price_history_for_preview(native, entries):
    asset=native.get('assets',{}).get('fxSAVE',{})
    metadata=asset.get('metadata',{})
    if metadata.get('chain')!='ethereum' or metadata.get('contract_address','').lower()!=ADDRESS or metadata.get('price_units')!='USD/share':
        raise ValueError('Native FXSave price history identity/units mismatch')
    by_time={row['timestamp']:row for row in entries}
    points=[]
    for row in asset.get('history',[]):
        nav=row.get('theoretical_price')
        if row.get('price_units')!='USD/share' or not finite(nav) or nav<=0:
            raise ValueError('Invalid native NAV history point')
        original=by_time.get(row.get('timestamp'))
        if original is None or original.get('block')!=row.get('block') or not math.isclose(original['nav_usd'],nav,rel_tol=1e-12):
            raise ValueError('Native price history does not match pinned backing observation')
        # The candidate explicitly withholds unrestricted market marks. Do not
        # promote an indicative routed quote into that separate market field.
        if row.get('market_price') is not None:
            raise ValueError('New native market policy requires consumer review')
        points.append({'timestamp':row['timestamp'],'block':row['block'],'peg_theoretical_price':nav,'peg_market_price':None,'source':row.get('source'),'price_units':'USD/share'})
    if not points:raise ValueError('Empty native FXSave price history')
    return {'source':'PegTracker pending native USD history','publication_status':metadata.get('publication_status'),'asset_slug':'fxsave','chain':'ethereum','contract_address':ADDRESS,'units':'USD/share','entries':points}

def prepared_files(refresh_mode="manual_preview_snapshot"):
    base=json.loads((PEG/'fxsave_backing.json').read_text())
    detail=validate_base(base)
    outputs={'fxsave_contract.json':topology_for_preview()}
    for suffix in EDITORIAL:
        name=f'fxsave_{suffix}.json'
        text=subprocess.run(['git','-C',str(EDITORIAL_REPO),'show',f'{EDITORIAL_COMMIT}:data/dashboard_pending/fxsave/{name}'],capture_output=True,text=True,check=True).stdout
        doc=json.loads(text)
        if suffix!='evidence_review' and doc.get('asset','').lower()!='fxsave': raise ValueError('Editorial identity mismatch')
        doc['consumer_scope']='isolated dashboard preview; source candidate status preserved'
        outputs[name]=doc
    axis=outputs['fxsave_axis_basis.json']
    if axis['dependencies'].get('underlying_score') is not None: raise ValueError('Dependency score is deliberately unauthored')
    detail['assessment']={'overall_score':axis['overall']['overall_score'],'status':'Under review · dated authored scores retained after evidence review','score_as_of':axis['score_as_of']}
    detail['matched_exits']=compact_ladder(json.loads((DEX/'fxsave_liquidity.json').read_text()))
    detail['venue_inventory']=compact_inventory(json.loads((DEX/'venue_inventory.json').read_text()))
    detail['assessment']['review_disposition']=axis.get('review_disposition') or axis.get('review',{}).get('status')
    detail['assessment']['recorded_scores']=axis.get('recorded_scores',{})
    base['peg'].update(nav_source='fxSAVE.nav() · Ethereum contract getter',nav_basis='Contract NAV for an accruing fxSP vault share; not an independent market price',chart_window_days=7,chart_min_points=2,chart_strict_window=True)
    base['backing']['as_of']=detail['as_of']
    detail['refresh_attempt']=json.loads((PEG/'fxsave_backing_last_attempt.json').read_text())
    detail['exit_refresh_attempt']=json.loads((DEX/'fxsave_liquidity_last_attempt.json').read_text())
    base['summary']['supply_unit']='shares'
    for key in ('dependencies','contract','issuer'): base.setdefault(key,{})
    base['liquidity']={'as_of':detail['matched_exits']['timestamp'],'total_2pct_depth':None,'two_pct_depth_status':'indicative_coarse_brackets','two_pct_depth_basis':'Matched quotes are indicative coarse brackets; reference conversion, gas and independent clocks are disclosed. No firm executable capacity is inferred.','derived_score_status':'not_computed'}
    base['transport']={'assembled_at':datetime.now(timezone.utc).isoformat(),'refresh_mode':refresh_mode,'measurement_source':str(PEG),'exit_source':str(DEX),'editorial_commit':EDITORIAL_COMMIT,'scope':'preview','clock_policy':'All observations and quote clocks preserved; assembly time is not measurement freshness'}
    outputs['fxsave_backing.json']=base
    history=json.loads((PEG/'fxsave_backing_history.json').read_text())
    entries=history if isinstance(history,list) else history['entries']
    for row in entries:
        if row.get('detail'):
            validate_base({'asset_slug':'fxsave','asset_specific':{'fxsave':row['detail']},'summary':{'collateral_ratio':None,'total_backing':None},'backing':{'collateral_ratio':None,'total_backing':None}})
    outputs['fxsave_backing_history.json']={'asset_slug':'fxsave','entries':entries,'price_history':price_history_for_preview(json.loads((PEG/'peg_tracker_history.json').read_text()),entries)}
    for source,name in [(PEG,'fxsave_backing_last_attempt.json'),(PEG,'fxsave_backing_evidence.json'),(PEG,'fxsave_september_regression.json'),(PEG,'fxsave_schedule_evidence.json'),(DEX,'fxsave_liquidity_last_attempt.json'),(DEX,'schedule_evidence.json')]:
        outputs['fxsave_exit_schedule_evidence.json' if name=='schedule_evidence.json' else name]=json.loads((source/name).read_text())
    assets=json.loads((REPO/'data/assets.json').read_text())
    assets=[a for a in assets if a['slug']!='fxsave']
    assets.append({'slug':'fxsave','published':False,'name':'fxSAVE (f(x) Protocol)','chain':'Ethereum','contract_address':ADDRESS,'description':'Vault share over fxSP. Redemption pays fxUSD plus USDC; shared governance with fxUSD. Dated scores remain under review.','report_status':'staged','report_url':'https://staging.tidresearch.com/reports/fxsave/','related_dashboard':{'slug':'fxusd','label':'fxUSD underlying risk →'}})
    outputs['assets.json']=assets
    return outputs

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--from-sync',action='store_true');args=parser.parse_args()
    outputs=prepared_files('hourly_sync_preview' if args.from_sync else 'manual_preview_snapshot') # Validate the complete group first.
    target=REPO/'previews/fxsave/data'; target.mkdir(parents=True,exist_ok=True)
    for name,doc in outputs.items():
        text=json.dumps(doc,indent=2,ensure_ascii=False,allow_nan=False)+'\n'
        dest=target/name
        if dest.exists() and dest.read_text()==text: continue
        with tempfile.NamedTemporaryFile(mode='w',dir=target,prefix='.fxsave-',delete=False) as f: f.write(text); temp=f.name
        os.replace(temp,dest)
    # Keep the preview on the exact shared application DOM and assets.
    html=(REPO/'index.html').read_text().replace('<head>','<head>\n    <base href="../../">\n    <script src="previews/fxsave/native-loader.js"></script>',1)
    html=html.replace('<title>Risk Dashboard</title>','<title>FXSave · Dashboard review</title>')
    (REPO/'previews/fxsave/native.html').write_text(html)
    (REPO/'previews/fxsave/index.html').write_text(html)
    print(f'Validated {len(outputs)} FXSave preview files; no serving registry/data/ changes')

if __name__=='__main__': main()
