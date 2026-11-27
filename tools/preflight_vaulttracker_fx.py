#!/usr/bin/env python3
"""Check a VaultTracker generation against BM's installed FX snapshots offline."""
import argparse
import hashlib
import json
import tempfile
from pathlib import Path

from read_vaulttracker_fx import intake, instant, read_bundle, require

ROOT = Path(__file__).resolve().parents[1]
FILES = (
    'fxsave_backing.json', 'fxsave_backing_history.json',
    'fxsp_backing.json', 'fxsp_source_status.json',
)


def check(pointer, expected_generation, data, controls):
    route = json.loads(pointer.read_bytes())
    generation = route['generation']
    require(len(generation) == 64 and all(c in '0123456789abcdef' for c in generation),
            'Invalid generation ID')
    manifest = pointer.parent / 'reader-generations' / generation / 'reader-manifest.json'
    require(route['manifest'] == str(manifest.relative_to(pointer.parent)),
            'Pointer does not reference its own generation')
    require(generation == expected_generation, 'Pointer generation changed')
    _, docs = read_bundle(manifest, route['sha256'])
    baseline = {name: (data / name).read_bytes() for name in FILES}
    save = json.loads(baseline[FILES[0]])['asset_specific']['fxsave']
    sp = json.loads(baseline[FILES[2]])['observation']
    results = {}
    blockers = []
    for label, source_file, installed in (
        ('fxSAVE', 'fxsave-public-safe.json', save['block']),
        ('fxSP', 'fxsp-native.json', sp['block']),
    ):
        doc = docs[source_file]
        address = doc['subject']['address'].lower()
        status = next(s for s in docs['feed/vaults.json']['statuses']
                      if s['vault_id'] == 'eip155:1:' + address)
        source = doc['source']
        attempt = status['last_attempt']
        results[label] = {'candidate': source['block_number'], 'installed': installed,
                          'block_time': source['block_time'], 'latest_attempt': attempt,
                          'observed_at': source.get('observed_at'),
                          'retrieved_at': source.get('retrieved_at')}
        if source['block_number'] < installed:
            blockers.append(f'{label} candidate predates the installed observation')
        if attempt['status'] != 'success':
            blockers.append(f'{label} latest attempt is {attempt["status"]}')
        else:
            try:
                started = instant(attempt.get('attempted_at'))
                completed = instant(attempt.get('completed_at'))
            except ValueError:
                blockers.append(f'{label} attempt start or completion clock is unavailable or invalid')
            else:
                if completed < started:
                    blockers.append(f'{label} attempt completion precedes its start')
                if instant(source['block_time']) > completed:
                    blockers.append(f'{label} block clock follows attempt completion')
    with tempfile.TemporaryDirectory(prefix='bm-fx-preflight-', dir='/tmp') as directory:
        stage = Path(directory)
        for name in FILES:
            (stage / name).write_bytes(baseline[name])
        (stage / 'fx-reader-controls.json').write_text(json.dumps(controls))
        try:
            intake(manifest, route['sha256'], stage)
        except (OSError, ValueError, KeyError, TypeError, StopIteration, ArithmeticError) as exc:
            blockers.append(f'Scratch intake rejected: {exc}')
        else:
            replacement = json.loads((stage / FILES[0]).read_bytes())['asset_specific']['fxsave']
            for key in ('concentration', 'basket_reconciliation', 'assessment',
                        'matched_exits', 'exit_refresh_attempt', 'venue_inventory'):
                if key in save and key not in replacement:
                    blockers.append(f'fxSAVE projection omits {key}')
        finally:
            for name, body in baseline.items():
                (stage / name).write_bytes(body)
            restored = all((stage / name).read_bytes() == body for name, body in baseline.items())
            require(restored, 'Scratch restore mismatch')
    require(all((data / name).read_bytes() == body for name, body in baseline.items()),
            'Installed files changed during preflight')
    require(json.loads(pointer.read_bytes()) == route, 'Pointer moved during preflight')
    return {'result': 'blocked' if blockers else 'ready_for_browser_review',
            'generation': generation, 'manifest_sha256': route['sha256'],
            'vaults': results, 'blockers': blockers, 'scratch_restore': restored,
            'installed_sha256': {name: hashlib.sha256(body).hexdigest() for name, body in baseline.items()}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pointer', type=Path, required=True)
    parser.add_argument('--expected-generation', required=True)
    args = parser.parse_args()
    try:
        policy = json.loads((ROOT / 'config/fxsave_preview_sources.json').read_text())
        result = check(args.pointer, args.expected_generation, ROOT / 'data', policy['control_review'])
    except (OSError, ValueError, KeyError, TypeError, StopIteration) as exc:
        print(json.dumps({'result': 'blocked', 'blockers': [str(exc)]}, indent=2))
        return 2
    print(json.dumps(result, indent=2))
    return 2 if result['blockers'] else 0


if __name__ == '__main__':
    raise SystemExit(main())
