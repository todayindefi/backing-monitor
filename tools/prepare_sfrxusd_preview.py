#!/usr/bin/env python3
"""Assemble a local review copy with pending sfrxUSD feeds, outside publication.

Serve: python3 -m http.server 8767 --bind 127.0.0.1 --directory /tmp/sfrxusd-dashboard-preview
"""
import importlib.util
import json
from pathlib import Path
import re
import shutil


def main():
    repo = Path(__file__).resolve().parents[1]
    preview = Path('/tmp/sfrxusd-dashboard-preview')
    preview.mkdir(exist_ok=True)
    for name in ('js', 'css', 'data'):
        shutil.copytree(repo / name, preview / name, dirs_exist_ok=True)
    shutil.copy2(repo / 'index.html', preview / 'index.html')
    assets = json.loads((repo / 'data/assets.json').read_text())
    assets = [a for a in assets if a['slug'] != 'sfrxusd']
    assets.append({
        'slug': 'sfrxusd', 'name': 'sfrxUSD (Frax)', 'chain': 'Ethereum',
        'published': False,
        'contract_address': '0xcf62F905562626CfcDD2261162a51fd02Fc9c5b6',
        'description': 'Ethereum sfrxUSD; global strategy backing and primary settlement through Fraxtal are separately scoped.',
        'venue_scope': {'chains': ['eth']},
        'axis5_scope': {'chains': ['ethereum', 'fraxtal'], 'walked_by': 'hand'},
        'liquidity_ladder_ref': 'sfrxusd_exit_ladder.json',
        'report_url': 'https://tidresearch.com/reports/sfrxusd/',
        'report_status': 'published',
    })
    (preview / 'data/assets.json').write_text(json.dumps(assets, indent=2) + '\n')
    sources = {
        **{f'sfrxusd_{s}.json': Path('/home/danger/PegTracker/data/dashboard_pending/sfrxusd') / f'sfrxusd_{s}.json'
           for s in ('backing', 'backing_history', 'peg_history', 'exit_ladder')},
        'sfrxusd_liquidity.json': Path('/home/danger/DexTracker/data/liquidity_pending/sfrxusd_liquidity.json'),
        **{f'sfrxusd_{s}.json': Path('/home/danger/riskAnalyst/data/axes_pending') / f'sfrxusd_{s}.json'
           for s in ('dependencies', 'backing_overlay', 'contract_overlay', 'issuer', 'axis_basis')},
    }
    for name, source in sources.items():
        json.loads(source.read_text())
        shutil.copy2(source, preview / 'data' / name)
    spec = importlib.util.spec_from_file_location('sfrxusd_preview_axis5', repo / 'tools/emit_axis5.py')
    emitter = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(emitter)
    emitter.REPO_ROOT = str(preview)
    topology = emitter.emit('sfrxusd')
    (preview / 'data/sfrxusd_contract.json').write_text(json.dumps(topology, indent=2) + '\n')
    html = (preview / 'index.html').read_text()
    banner = '<div style="padding:12px;background:#713f12;color:white">Local review only — pending feeds and provisional scores. Frozen producer snapshots; not a live dashboard.</div>'
    html = re.sub(r'(<body[^>]*>)', lambda m: m.group(1) + banner, html, count=1)
    (preview / 'index.html').write_text(html)
    (preview / 'PREVIEW-ONLY.txt').write_text('Pending producer snapshots. Not a sync or publication source.\n')
    print(f'{preview}: copied {len(sources)} candidate feeds and emitted {len(topology["contract"]["layers"])} committed authority layers')


if __name__ == '__main__':
    main()
