#!/usr/bin/env python3
"""Assemble a local-only DOLA review copy; never register or publish live feeds.

Run from any directory. Serve the result with:
python3 -m http.server 8766 --bind 127.0.0.1 --directory /tmp/dola-dashboard-preview
"""
import importlib.util
import json
from pathlib import Path
import shutil


def main():
    repo = Path(__file__).resolve().parents[1]
    preview = Path('/tmp/dola-dashboard-preview')
    preview.mkdir(exist_ok=True)
    for name in ('js', 'css', 'data'):
        shutil.copytree(repo / name, preview / name, dirs_exist_ok=True)
    shutil.copy2(repo / 'index.html', preview / 'index.html')
    assets = json.loads((repo / 'data/assets.json').read_text())
    assets = [asset for asset in assets if asset['slug'] != 'dola']
    assets.append({
        'slug': 'dola', 'name': 'DOLA (Inverse Finance)', 'chain': 'Ethereum',
        'published': False,
        'contract_address': '0x865377367054516e17014ccded1e7d814edc9ce4',
        'description': 'Canonical Ethereum DOLA; independent backing coverage remains unresolved.',
        'venue_scope': {'chains': ['eth']},
        'axis5_scope': {'chains': ['ethereum'], 'walked_by': 'hand'},
        'liquidity_ladder_ref': 'dola_exit_ladder.json',
        'report_url': 'https://tidresearch.com/reports/dola/', 'report_status': 'published',
    })
    (preview / 'data/assets.json').write_text(json.dumps(assets, indent=2) + '\n')
    sources = {
        **{f'dola_{suffix}.json': Path('/home/danger/PegTracker/data') / f'dola_{suffix}.json'
           for suffix in ('backing', 'backing_history', 'peg_history', 'exit_ladder')},
        'dola_liquidity.json': Path('/home/danger/DexTracker/data/liquidity/dola_liquidity.json'),
        **{f'dola_{suffix}.json': Path('/home/danger/riskAnalyst/data/axes_pending') / f'dola_{suffix}.json'
           for suffix in ('dependencies', 'backing_overlay', 'contract_overlay', 'issuer', 'axis_basis')},
    }
    for filename, source in sources.items():
        # Fail explicitly if a required producer artifact disappears.
        json.loads(source.read_text())
        shutil.copy2(source, preview / 'data' / filename)
    spec = importlib.util.spec_from_file_location('dola_preview_axis5', repo / 'tools/emit_axis5.py')
    emitter = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(emitter)
    emitter.REPO_ROOT = str(preview)
    topology = emitter.emit('dola')
    (preview / 'data/dola_contract.json').write_text(json.dumps(topology, indent=2) + '\n')
    (preview / 'PREVIEW-ONLY.txt').write_text(
        'Local review copy with pending editorial overlays. Not a publication source.\n'
        'Do not sync these artifacts into public data directories before approval.\n')
    print(f'{preview}: local preview assembled; {len(topology["contract"]["layers"])} Ethereum authority layers')


if __name__ == '__main__':
    main()
