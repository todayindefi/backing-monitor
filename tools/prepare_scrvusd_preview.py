#!/usr/bin/env python3
"""Build an isolated six-axis scrvUSD review site. No registration/publication.

python3 tools/prepare_scrvusd_preview.py
python3 -m http.server 8768 --bind 127.0.0.1 --directory /tmp/scrvusd-dashboard-preview
"""
import argparse
import json
from pathlib import Path
import re
import shutil

REPO=Path(__file__).resolve().parents[1]
MEASUREMENTS=Path('/home/danger/PegTracker/data/dashboard_pending/scrvusd')
EDITORIAL=Path('/home/danger/riskAnalyst/data/axes_pending')


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--out-dir',type=Path,default=Path('/tmp/scrvusd-dashboard-preview'))
    args=p.parse_args();preview=args.out_dir.resolve()
    if preview==REPO or REPO in preview.parents:
        raise SystemExit('Preview must be outside the serving repository')
    preview.mkdir(parents=True,exist_ok=True)
    for name in ('js','css','data'):
        shutil.copytree(REPO/name,preview/name,dirs_exist_ok=True)
    shutil.copy2(REPO/'index.html',preview/'index.html')
    assets=json.loads((REPO/'data/assets.json').read_text())
    assets=[a for a in assets if a['slug']!='scrvusd']
    assets.append({'slug':'scrvusd','name':'scrvUSD (Curve savings)','chain':'Ethereum','published':False,
       'contract_address':'0x0655977FEb2f289A4aB78af67BAB0d17aAb84367',
       'description':'NAV-accruing ERC-4626 share over crvUSD. Custody reconciliation is not independent dollar solvency.',
       'report_status':'unpublished','venue_scope':{'chains':['eth']}})
    (preview/'data/assets.json').write_text(json.dumps(assets,indent=2,ensure_ascii=False)+'\n')
    sources={**{f'scrvusd_{s}.json':MEASUREMENTS/f'scrvusd_{s}.json' for s in ('backing','backing_history','backing_last_attempt')},
             **{f'scrvusd_{s}.json':EDITORIAL/f'scrvusd_{s}.json' for s in ('axis_basis','dependencies','issuer','contract_overlay')}}
    for name,path in sources.items():
        d=json.loads(path.read_text())
        if name not in ('scrvusd_backing_last_attempt.json',) and (d.get('asset_slug') or d.get('asset'))!='scrvusd':
            raise ValueError(f'{path}: asset identity mismatch')
        shutil.copy2(path,preview/'data'/name)
    html=(preview/'index.html').read_text()
    banner='<div style="padding:12px;background:#713f12;color:white">scrvUSD local review — candidate observations, no scheduled refresh or production publication. Existing collateral analysis remains on crvUSD.</div>'
    html=re.sub(r'(<body[^>]*>)',lambda m:m.group(1)+banner,html,count=1)
    (preview/'index.html').write_text(html)
    (preview/'PREVIEW-ONLY.txt').write_text('Isolated review snapshots. Not a scheduled or publication source.\n')
    print(f'{preview}: assembled {len(sources)} candidate feeds; no generated authority YAML copied')


if __name__=='__main__':main()
