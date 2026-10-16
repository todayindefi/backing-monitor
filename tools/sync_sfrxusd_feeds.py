#!/usr/bin/env python3
"""Transport owner-approved sfrxUSD feeds from their current producer paths.

Production approved 2026-10-16. Measurement producers still refresh their original
candidate directories; this allowlist exposes only sfrxUSD. Editorial inputs are
pinned to the reviewed commit, so unrelated pending work and later unapproved
editorial changes cannot reach publication through this exception.
"""
import json
from pathlib import Path
import subprocess
import tempfile
import os

REPO = Path(__file__).resolve().parents[1]
EDITORIAL_REPO = Path('/home/danger/riskAnalyst')
EDITORIAL_COMMIT = 'c62a9672da0a40d51adbad0999c197467353b806'
MEASUREMENTS = {
    **{f'sfrxusd_{s}.json': Path('/home/danger/PegTracker/data/dashboard_pending/sfrxusd') / f'sfrxusd_{s}.json'
       for s in ('backing', 'backing_history', 'peg_history', 'exit_ladder')},
    'sfrxusd_liquidity.json': Path('/home/danger/DexTracker/data/liquidity_pending/sfrxusd_liquidity.json'),
}
EDITORIAL = ('dependencies', 'backing_overlay', 'contract_overlay', 'issuer', 'axis_basis')


def main():
    assets = json.loads((REPO / 'data/assets.json').read_text())
    if not any(a['slug'] == 'sfrxusd' and a.get('published') is True for a in assets):
        raise SystemExit('sfrxUSD is not approved in the published registry; no feeds copied')
    inputs = {name: (source.read_text(), str(source)) for name, source in MEASUREMENTS.items()}
    for suffix in EDITORIAL:
        name = f'sfrxusd_{suffix}.json'
        source = f'data/axes_pending/{name}'
        content = subprocess.run(
            ['git', '-C', str(EDITORIAL_REPO), 'show', f'{EDITORIAL_COMMIT}:{source}'],
            check=True, capture_output=True, text=True).stdout
        inputs[name] = (content, f'riskAnalyst@{EDITORIAL_COMMIT}:{source}')
    outputs = {}
    for name, (text, source) in inputs.items():
        doc = json.loads(text)
        identity = str(doc.get('asset_slug') or doc.get('asset') or '').lower()
        if identity != 'sfrxusd':
            raise ValueError(f'{name}: source asset mismatch {identity!r}')
        # Record consumer publication authorization without changing source clocks,
        # provisional assessment status, measurements, basis or numeric judgments.
        if 'publication_status' in doc:
            doc['source_publication_status'] = doc['publication_status']
            doc['publication_status'] = 'published'
        doc['publication_authorization'] = {
            'approved_on': '2026-10-16',
            'basis': 'Owner explicitly requested production publication',
            'source': source,
            'editorial_commit': EDITORIAL_COMMIT if name not in MEASUREMENTS else None,
        }
        outputs[name] = json.dumps(doc, indent=2, ensure_ascii=False) + '\n'
    # Decode and validate every input before replacing any serving snapshot.
    for name, text in outputs.items():
        dest = REPO / 'data' / name
        if dest.exists() and dest.read_text() == text:
            continue
        with tempfile.NamedTemporaryFile(mode='w', dir=dest.parent, prefix='.sfrxusd-', delete=False) as f:
            f.write(text)
            pending = f.name
        os.replace(pending, dest)
    print(f'sfrxUSD: synced {len(outputs)} approved producer feeds; editorial revision {EDITORIAL_COMMIT[:7]}')


if __name__ == '__main__':
    main()
