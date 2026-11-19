"""Publish only explicitly approved dashboard groups through existing consumers.

No registry edits, collection, scheduling or sibling-repo writes. Group validation
precedes writes; failures retain last-good measurements and publish attempt status.
"""
import copy
import json
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from public_dashboard_projection import public_projection

SUFFIXES={
    'fxsave':('backing','backing_history','backing_last_attempt','backing_evidence','liquidity_last_attempt','axis_basis','backing_overlay','dependencies','contract','contract_overlay','issuer','assessment','evidence_review'),
    'weeth':('backing','backing_history','peg_history','axis_basis','backing_overlay','dependencies','contract_overlay','issuer','assessment','evidence_review'),
}

def registered(root,slug,address=None):
    try:rows=json.loads((Path(root)/'data/assets.json').read_text())
    except (OSError,ValueError):return False
    row=next((r for r in rows if r['slug']==slug),{})
    return row.get('published') is True and row.get('source_status_ref')==slug+'_source_status.json' and (address is None or row.get('contract_address','').lower()==address.lower())

def atomic(path,doc):
    text=json.dumps(doc,indent=2,ensure_ascii=False,allow_nan=False)+'\n'
    with tempfile.NamedTemporaryFile(mode='w',dir=path.parent,prefix='.dashboard-',delete=False) as f:
        f.write(text);name=f.name
    os.replace(name,path)

def failed(root,slug):
    if slug in SUFFIXES and registered(root,slug):
        atomic(Path(root)/'data'/f'{slug}_source_status.json',{
            'status':'failed','attempted_at':datetime.now(timezone.utc).isoformat(),
            'message':'Approved source validation failed or a producer input is unavailable. Last-good measurements retained with their original observation times.'})

def publish(root,policy,outputs,mode):
    root=Path(root);slug=policy['asset_slug']
    if policy.get('production_approved') is not True or policy.get('chain_id')!='eip155:1' or not registered(root,slug,policy['address']):
        raise ValueError('Production publication not approved for this exact registered deployment')
    if slug not in SUFFIXES:raise ValueError('Unreviewed publication group')
    group={}
    for suffix in SUFFIXES[slug]:
        name=f'{slug}_{suffix}.json'
        group[name]=public_projection(copy.deepcopy(outputs[name]))
        d=group[name]
        if isinstance(d,dict) and 'consumer_scope' in d:
            d['consumer_scope']='Approved public exact Ethereum dashboard; original source clocks retained'
        json.dumps(d,allow_nan=False)
    base=group[f'{slug}_backing.json']
    if base.get('asset_slug')!=slug:raise ValueError('Base identity mismatch')
    transport=base.setdefault('transport',{})
    transport.update(scope='production',refresh_mode=mode)
    for k in ['measurement_source','exit_source']:transport.pop(k,None)
    group[f'{slug}_source_status.json']={
        'status':'success','mode':mode,'attempted_at':datetime.now(timezone.utc).isoformat(),
        'assessment_version':policy['assessment_version'],'evidence_version':policy['evidence_version'],
        'clock_note':'Assembly attempt only; does not renew financial, quote, authority or assessment observation times.'}
    for name,doc in group.items():atomic(root/'data'/name,doc)
    return group
