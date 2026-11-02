#!/usr/bin/env python3
"""Read-only BM evidence capture. Never runs producers, sync, scores or notifications."""
import argparse
import concurrent.futures
import datetime as dt
import hashlib
import json
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
INPUT = Path('/home/danger/riskAnalyst/data/reviews/six-portfolio-risk-refresh-2026-11-02')
CLOCKS = {'timestamp','as_of','observed_at','updated_at','generated_at','source_timestamp','quote_timestamp','block_number','block','measured_at','attestation_timestamp','window_start','window_end'}
SUFFIXES = ['backing','liquidity','issuer','dependencies','contract','axis_basis','exit_ladder','backing_last_attempt']

def clocks(value, prefix=''):
    result = []
    if isinstance(value, dict):
        for key, val in value.items():
            name = f'{prefix}.{key}' if prefix else key
            if key in CLOCKS and isinstance(val, (str,int,float)):
                result.append({'field':name,'value':val})
            elif isinstance(val, dict):
                result.extend(clocks(val, name))
    return result

def digest(raw):
    return hashlib.sha256(raw).hexdigest()

def capture(path, out, label):
    raw = path.read_bytes()
    data = json.loads(raw)
    target = out / label / path.name
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(raw)
    return {'source':str(path),'snapshot':str(target.relative_to(out)), 'sha256':digest(raw),
            'clocks':clocks(data),'summary':data.get('summary'),'peg':data.get('peg'),
            'risk_flags':data.get('risk_flags'),'backing_basis':(data.get('backing') or {}).get('collateral_ratio_basis'),
            'exit':{k:v for k,v in (data.get('liquidity') or {}).items() if k in ['as_of','primary_exit','total_2pct_depth','total_2pct_depth_is_floor','depth_50bps','exit_mark']}}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, default=ROOT/'specs/reviews/six-portfolio-refresh-2026-11-02')
    args = parser.parse_args(); out=args.out; out.mkdir(parents=True,exist_ok=True)
    start=dt.datetime.now(dt.timezone.utc).isoformat()
    registry=json.loads((ROOT/'data/assets.json').read_text()); by_slug={a['slug']:a for a in registry}
    original=json.loads((INPUT/'dashboard-register.json').read_text())
    routes={'fxsave':('previews/fxsave/','preview_only'), 'gho':('specs/reviews/gho-dashboard-2026-10-30/','review_artifacts_only')}
    families=[]; urls={}
    roots=[Path('/home/danger/PegTracker/data'),Path('/home/danger/DexTracker/data/liquidity'),Path('/home/danger/riskAnalyst/data/axes')]
    for old in original['assets']:
        slug=old['slug']; asset=by_slug.get(slug); prefix=(asset or {}).get('data_source',slug).replace('-','_')
        row={'slug':slug,'registry':asset,'route':('?asset='+slug if asset else routes.get(slug,(None,None))[0]),
             'coverage_status':('registered_published' if asset and asset.get('published') else 'registered_unlisted' if asset else routes.get(slug,(None,'untracked_in_BM'))[1]),
             'acceptance':'evidence_capture_only_pending_semantic_and_rendered_review','inputs':[], 'producer_selection':[]}
        for suffix in SUFFIXES:
            name=f'{prefix}_{suffix}.json'; path=ROOT/'data'/name
            if path.exists():
                rec=capture(path,out,'local');row['inputs'].append(rec)
                if suffix in ['backing','liquidity']: urls[name]='https://todayindefi.github.io/backing-monitor/data/'+name
                candidates=[]
                for root in roots:
                    source=root/name
                    if source.exists():candidates.append({'path':str(source),'sha256':digest(source.read_bytes()),'matches_consumer':digest(source.read_bytes())==rec['sha256']})
                row['producer_selection'].append({'file':name,'candidates_in_sync_order':candidates,'note':'Later source roots win in normal sync; overlays are separate consumer inputs.'})
        families.append(row)
    def fetch(item):
        name,url=item
        try:
            with urllib.request.urlopen(url+'?six_portfolio='+start,timeout=25) as response:
                raw=response.read(); status=response.status
            data=json.loads(raw); target=out/'served'/name; target.parent.mkdir(exist_ok=True); target.write_bytes(raw)
            return {'url':url,'status':status,'sha256':digest(raw),'snapshot':str(target.relative_to(out)),
                    'fetched_at':dt.datetime.now(dt.timezone.utc).isoformat(),'clocks':clocks(data),
                    'matches_local':raw==(ROOT/'data'/name).read_bytes(),'acceptance':'HTTP_and_JSON_only'}
        except Exception as error:
            return {'url':url,'status':'failed','error':str(error),'acceptance':'unavailable'}
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:served=list(pool.map(fetch,sorted(urls.items())))
    # Retain position clocks, token roles and gross legs; never promote a feed HF to a market-oracle verification.
    inventory=json.loads((INPUT/'inventory.json').read_text())
    positions=[]
    for p in inventory['positions']:
        feed=p.get('feed_details') or {}
        if p['position_type']=='PT' or feed.get('side')=='loop':
            positions.append({'id':p['id'],'book':p['book'],'chain':p['chain'],'position':p['position_name'],
                              'contract_address_unverified_role':p.get('contract_address'),'snapshot_date':p.get('snapshot_date'),
                              'snapshot_time':p.get('snapshot_time'),'metadata':p.get('metadata'),'feed_details':feed,
                              'status':'captured_owner_input_not_remeasured','missing':['market_oracle_basis_and_clock','current_caps_utilization','held_size_executable_unwind_and_fees']})
    pendle=Path('/home/danger/PendleTracker/data/pendle_markets.json')
    private = ROOT/'.private-reviews/six-portfolio-refresh-2026-11-02'
    private.mkdir(exist_ok=True)
    if pendle.exists():capture(pendle,private,'owner-inputs')
    # Strict JSON: upstream inventory includes non-standard NaN debt markers.
    def clean(x):
        if isinstance(x,float) and (x!=x or abs(x)==float('inf')):return None
        if isinstance(x,dict):return {k:clean(v) for k,v in x.items()}
        if isinstance(x,list):return [clean(v) for v in x]
        return x
    result={'captured_at':start,'completed_at':dt.datetime.now(dt.timezone.utc).isoformat(),
            'scope':'26 families from the RiskAnalyst dated register; owner position inputs retained separately',
            'limitations':['No score changes','Payload generation is not source freshness','Quotes are observations, not executed fills','Asset ladders do not establish PT or leveraged unwind capacity','Remote-chain exposure is not inferred from Ethereum feeds'],
            'families':families,'served':served,'first_wave_position_packet':'.private-reviews/six-portfolio-refresh-2026-11-02/positions.json'}
    (private/'positions.json').write_text(json.dumps(clean(positions),indent=2,allow_nan=False)+'\n')
    (out/'evidence-register.json').write_text(json.dumps(clean(result),indent=2,allow_nan=False)+'\n')
    print(json.dumps({'families':len(families),'with_inputs':sum(bool(x['inputs']) for x in families),'served':len(served),'fetch_failures':sum(x['status']!=200 for x in served),'positions':len(positions)},indent=2))

if __name__=='__main__':main()
