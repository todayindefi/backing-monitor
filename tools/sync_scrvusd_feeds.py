#!/usr/bin/env python3
"""Publish only reviewed scrvUSD producer files, retaining every source clock.

The canonical analyzer owns measurements in PegTracker; this is transport only.
The authority evidence remains explicitly partial; no generator YAML is copied.
"""
import json
import os
from pathlib import Path
import subprocess
import tempfile

REPO=Path(__file__).resolve().parents[1]
EDITORIAL_REPO=Path('/home/danger/riskAnalyst')
EDITORIAL_COMMIT='8b3d9da7221d0f190feda4f78b4c2c6975c7b9d7'
PRODUCER=Path('/home/danger/PegTracker/data/dashboard_pending/scrvusd')
EDITORIAL=('axis_basis','dependencies','contract_overlay','issuer')
MEASUREMENTS=('backing','backing_history','backing_last_attempt')


def validated_inputs():
    inputs={f'scrvusd_{s}.json':(PRODUCER/f'scrvusd_{s}.json').read_text() for s in MEASUREMENTS}
    for suffix in EDITORIAL:
        name=f'scrvusd_{suffix}.json'
        inputs[name]=subprocess.run(['git','-C',str(EDITORIAL_REPO),'show',
            f'{EDITORIAL_COMMIT}:data/axes_pending/{name}'],check=True,capture_output=True,text=True).stdout
    outputs={}
    for name,text in inputs.items():
        d=json.loads(text)
        if name!='scrvusd_backing_last_attempt.json' and str(d.get('asset_slug') or d.get('asset')).lower()!='scrvusd':
            raise ValueError(f'{name}: asset identity mismatch')
        if name=='scrvusd_backing.json':
            detail=d.get('asset_specific',{}).get('scrvusd',{})
            if detail.get('schema_version')!='scrvusd-detail/1' or detail.get('identity',{}).get('asset','').lower()!='0xf939e0a03fb07f59a73314e73794be0e57ac1b4e':
                raise ValueError('Unexpected wrapper schema or underlying identity')
            if d.get('backing',{}).get('collateral_ratio') is not None:
                raise ValueError('Wrapper custody must not become a dollar collateral ratio')
        if 'publication_status' in d:
            d['source_publication_status']=d['publication_status'];d['publication_status']='published'
        d['publication_authorization']={'approved_on':'2026-10-17',
            'basis':'User approved the six-axis scrvUSD implementation scope and requested proceeding',
            'source':str(PRODUCER/name) if name in {f'scrvusd_{s}.json' for s in MEASUREMENTS} else f'riskAnalyst@{EDITORIAL_COMMIT}:data/axes_pending/{name}',
            'editorial_commit':EDITORIAL_COMMIT if name not in {f'scrvusd_{s}.json' for s in MEASUREMENTS} else None}
        outputs[name]=json.dumps(d,indent=2,ensure_ascii=False,allow_nan=False)+'\n'
    return outputs


def main():
    assets=json.loads((REPO/'data/assets.json').read_text())
    if not any(a['slug']=='scrvusd' and a.get('published') is True for a in assets):
        raise SystemExit('scrvUSD is not approved in the published registry; no serving files copied')
    outputs=validated_inputs() # validate the complete group before touching serving files
    for name,text in outputs.items():
        dest=REPO/'data'/name
        if dest.exists() and dest.read_text()==text:continue
        with tempfile.NamedTemporaryFile(mode='w',dir=dest.parent,prefix='.scrvusd-',delete=False) as f:
            f.write(text);pending=f.name
        os.replace(pending,dest)
    print(f'scrvUSD: synced {len(outputs)} reviewed files; editorial commit {EDITORIAL_COMMIT}')


if __name__=='__main__':main()
