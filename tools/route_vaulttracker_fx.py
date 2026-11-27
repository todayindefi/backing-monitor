#!/usr/bin/env python3
"""Select and transport the accepted FX native bundle under BM's sync lock."""
import argparse
import fcntl
import json
import os
from pathlib import Path
import tempfile

from preflight_vaulttracker_fx import FILES, check
from read_vaulttracker_fx import SAVE, intake, require
from prepare_fxsave_preview import compact_inventory, compact_ladder, finite, public_projection
from sync_fxsp_vault import atomic

ROOT = Path(__file__).resolve().parents[1]
STATE = ROOT / '.private-reviews' / 'vaulttracker-fx-route'
ROUTE = STATE / 'selector.json'
BACKUP = STATE / 'rollback.json'
PENDING = STATE / 'pending.json'
POINTER = Path('/home/danger/VaultTracker/data/fx-native-runtime/current-reader.json')
PEG = Path('/home/danger/PegTracker/data/peg_tracker_latest_usd.json')
DEX = Path('/home/danger/DexTracker/data/dashboard_pending/fxsave')
OUTPUTS = (*FILES, 'fxsave_native_rate_history.json', 'fxsave_native_return_windows.json')
PREVIEW_FILES = tuple(name for name in OUTPUTS if name.startswith('fxsave_'))


def load(path):
    return json.loads(path.read_bytes())


def restore(snapshot):
    for relative, body in snapshot.items():
        target = ROOT / relative
        if body is None:
            target.unlink(missing_ok=True)
        else:
            with tempfile.NamedTemporaryFile(dir=target.parent, delete=False) as handle:
                handle.write(body.encode())
                temporary = handle.name
            os.chmod(temporary, 0o644)
            os.replace(temporary, target)


def read_group():
    paths = [ROOT / 'data' / name for name in OUTPUTS]
    paths += [ROOT / 'previews/fxsave/data' / name for name in PREVIEW_FILES]
    return {str(p.relative_to(ROOT)): p.read_text() if p.exists() else None for p in paths}


def project(pointer, generation, *, include_preview=True):
    data = ROOT / 'data'
    preview = ROOT / 'previews/fxsave/data'
    controls = load(ROOT / 'config/fxsave_preview_sources.json')['control_review']
    gate = check(pointer, generation, data, controls)
    require(not gate['blockers'], '; '.join(gate['blockers']))
    route = load(pointer)
    require(route['generation'] == generation and route['sha256'] == gate['manifest_sha256'],
            'Reviewed pointer changed')
    manifest = pointer.parent / route['manifest']
    dex = {name: load(DEX / name) for name in (
        'fxsave_liquidity.json', 'venue_inventory.json', 'fxsave_liquidity_last_attempt.json')}
    market = load(PEG).get('fxSAVE', {})
    require(market.get('chain') == 'ethereum' and market.get('contract_address', '').lower() == SAVE,
            'PegTracker fxSAVE market identity mismatch')
    output = {}
    destinations = [(data, OUTPUTS)]
    if include_preview:
        destinations.append((preview, PREVIEW_FILES))
    for destination, names in destinations:
        with tempfile.TemporaryDirectory(prefix='bm-fx-route-', dir='/tmp') as folder:
            stage = Path(folder)
            for name in FILES:
                source = preview if destination == preview and name in PREVIEW_FILES else data
                (stage / name).write_bytes((source / name).read_bytes())
            atomic(stage / 'fx-reader-controls.json', controls)
            intake(manifest, route['sha256'], stage)
            save = load(stage / 'fxsave_backing.json')
            detail = save['asset_specific']['fxsave']
            detail.update(matched_exits=compact_ladder(dex['fxsave_liquidity.json']),
                          venue_inventory=compact_inventory(dex['venue_inventory.json']),
                          exit_refresh_attempt=dex['fxsave_liquidity_last_attempt.json'])
            save['liquidity']['as_of'] = detail['matched_exits']['timestamp']
            peg = save['peg']
            price, clock = market.get('market_price'), market.get('market_price_as_of')
            has_mark = finite(price) and price > 0 and bool(clock)
            peg.update(market_price=price if has_mark else None, market_price_as_of=clock if has_mark else None,
                       market_price_source=market.get('market_price_source') if has_mark else None,
                       status='independent_market_reference' if has_mark else 'market_mark_unavailable',
                       premium_discount_pct=None)
            peg.pop('market_observation', None)
            save['transport']['refresh_mode'] = 'hourly_sync'
            save = public_projection({'fxsave_backing.json': save})['fxsave_backing.json']
            atomic(stage / 'fxsave_backing.json', save)
            for name in names:
                output[str((destination / name).relative_to(ROOT))] = (stage / name).read_text()
    require(load(pointer) == route, 'Pointer moved during projection')
    return output, gate


def run(args):
    if PENDING.exists():
        interrupted = load(PENDING)
        restore(interrupted['files'])
        if interrupted['selector'] is None:
            ROUTE.unlink(missing_ok=True)
        else:
            atomic(ROUTE, interrupted['selector'])
        PENDING.unlink()
    if args.command == 'rollback':
        require(BACKUP.is_file(), 'Pre-switch rollback snapshot unavailable')
        snapshot = load(BACKUP)
        atomic(PENDING, {'files': read_group(), 'selector': load(ROUTE) if ROUTE.exists() else None})
        restore(snapshot)
        require(read_group() == snapshot, 'Restored files differ from pre-switch bytes')
        ROUTE.unlink(missing_ok=True)
        PENDING.unlink()
        return {'status': 'legacy_restored'}
    if args.command == 'tick' and not ROUTE.exists():
        return {'status': 'legacy'}
    pointer = args.pointer if args.command != 'tick' else Path(load(ROUTE)['pointer'])
    generation = load(pointer)['generation'] if args.command == 'tick' else args.expected_generation
    if args.command == 'enable':
        require(not ROUTE.exists(), 'VaultTracker already selected')
    after, gate = project(pointer, generation, include_preview=not args.sync_lock_held)
    if args.command == 'check':
        return gate
    before = read_group()
    if args.command == 'enable':
        atomic(BACKUP, before)
    atomic(PENDING, {'files': before, 'selector': load(ROUTE) if ROUTE.exists() else None})
    try:
        restore(after)
        if args.command == 'enable':
            atomic(ROUTE, {'pointer': str(pointer)})
    except Exception:
        restore(before)
        raise
    PENDING.unlink()
    return {'status': 'vaulttracker', 'generation': generation}


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('command', choices=['check', 'enable', 'tick', 'rollback'])
    cli.add_argument('--pointer', type=Path, default=POINTER)
    cli.add_argument('--expected-generation')
    cli.add_argument('--sync-lock-held', action='store_true')
    args = cli.parse_args()
    if args.sync_lock_held and args.command != 'tick':
        cli.error('Only sync may inherit the lock for a tick')
    STATE.mkdir(parents=True, exist_ok=True)
    with open('/tmp/bm-fx-consumer.lock', 'a') as lock:
        if not args.sync_lock_held:
            fcntl.flock(lock, fcntl.LOCK_EX)
        try:
            print(json.dumps(run(args), indent=2))
        except (OSError, ValueError, KeyError, TypeError, StopIteration, ArithmeticError) as exc:
            print(json.dumps({'status': 'blocked', 'reason': str(exc)}))
            return 2
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
