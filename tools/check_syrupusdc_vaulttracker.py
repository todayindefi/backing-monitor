#!/usr/bin/env python3
"""Compare the exact syrupUSDC native fields without changing the dashboard feed."""
import argparse
from copy import deepcopy
from datetime import datetime, timezone
from decimal import Decimal
import hashlib
import json
import re
from pathlib import Path

POOL = '0x80ac24aa929eaf5013f6436cda2a7ba190f5cc0b'
USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
VAULT_ID = f'eip155:1:{POOL}'
SYRUP_DEPLOYMENTS = {
    'syrupusdc': (POOL, USDC),
    'syrupusdt': ('0x356b8d89c1e1239cbbb9de4815c39a1474d5ba7d',
                 '0xdac17f958d2ee523a2206206994597c13d831ec7'),
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def read(path):
    return json.loads(path.read_bytes())


def compare(client, backing, now):
    slug = backing['asset_slug']
    require(slug in SYRUP_DEPLOYMENTS, 'Expected exact Ethereum Syrup baseline')
    pool, asset = SYRUP_DEPLOYMENTS[slug]
    vault_id = f'eip155:1:{pool}'
    legacy = backing['asset_specific']['vault_state']
    require(legacy['pool'].lower() == pool and legacy['asset_token'].lower() == asset
            and legacy['share_token_decimals'] == 6, 'Baseline identity or units mismatch')
    pin = legacy['accounting_context']
    require(pin['pinning'] == 'all_accounting_calls_pinned', 'Baseline pin not established')
    result = client.get_vault(vault_id, now, allow_stale=True)
    if result['record'] is None:
        return {'status': 'blocked', 'reason': 'Exact VaultTracker record unavailable',
                'vault_id': vault_id, 'generation': client.generation_id,
                'baseline_block': pin['block']}
    record = result['record']
    require(record['subject']['decimals'] == 6, 'VaultTracker share decimals mismatch')
    underlying_refs = {a['id'] for a in record['asset_registry']
                 if a.get('address', '').lower() == asset and a.get('chain_id') == 1 and a.get('decimals') == 6}
    envelopes = {k: record['accounting'][k] for k in
                 ('share_supply', 'reported_total_assets', 'native_nav_per_share')}
    sources = {s['id']: s for s in record['source_inputs']}
    used = set()
    amounts = {}
    missing = []
    for key, field in envelopes.items():
        if field is None:
            missing.append(key)
            continue
        require(field['decimals'] == 6 and re.fullmatch(r'\d+', field.get('raw') or ''),
                f'Exact raw field unavailable: {key}')
        require(field.get('asset_ref') in ({'share'} if key == 'share_supply' else underlying_refs),
                f'Asset identity mismatch: {key}')
        require(len(field['source_refs']) == 1, f'Native source required: {key}')
        used.update(field['source_refs'])
        amounts[key] = int(field['raw'])
    require(len(used) == 1, 'VaultTracker fields use mixed sources')
    source = sources[used.pop()]
    require(source['data_classification'] == 'public' and source['native_coherence_status'] == 'native_pin'
            and source['block_number'] > 0
            and re.fullmatch(r'(?:0x)?[0-9a-fA-F]{64}', source['block_hash']), 'Native pin unqualified')
    require(all(amounts[k] > 0 for k in ('share_supply', 'native_nav_per_share') if k in amounts),
            'Unsupported empty vault')
    same_pin = (pin['block'] == source['block_number'] and
                pin['hash'].lower().removeprefix('0x') == source['block_hash'].lower().removeprefix('0x'))
    receipt = {'status': 'different_pins' if not same_pin else 'same_pin_review',
               'vault_id': vault_id, 'generation': client.generation_id,
               'baseline_pin': pin, 'candidate_source': source,
               'candidate_status': result['status'], 'candidate_raw': {k: str(v) for k,v in amounts.items()}}
    if missing:
        receipt.update(status='blocked', missing_exact_fields=missing)
        if same_pin and 'reported_total_assets' in amounts:
            receipt['checks'] = {'total_assets_raw_exact':
                                 amounts['reported_total_assets'] == int(legacy['accounting_raw']['pool_assets'])}
        return receipt
    if same_pin:
        assets = amounts['reported_total_assets']
        shares = amounts['share_supply']
        require(assets > 0, 'Unsupported empty asset book')
        rounded_shares = (Decimal(shares) / 10**6).quantize(Decimal('.01'))
        ratio_nav = Decimal(assets) / shares
        receipt['checks'] = {
            'total_assets_raw_exact': assets == int(legacy['accounting_raw']['pool_assets']),
            'supply_matches_existing_display_precision': rounded_shares == Decimal(str(legacy['total_supply'])),
            'book_ratio_matches_existing_display_precision': ratio_nav.quantize(Decimal('.000001')) == Decimal(str(legacy['nav'])),
            'native_conversion_equals_floor_of_book_ratio': amounts['native_nav_per_share'] == assets * 10**6 // shares,
        }
        receipt['nav_basis'] = 'Legacy NAV is the rounded assets/supply ratio. VaultTracker native NAV uses the one-share convertToAssets result. A raw conversion difference requires explanation before switch.'
        if not all(receipt['checks'].values()):
            receipt['status'] = 'mismatch'
    return receipt


def shadow_projection(backing, comparison, history):
    require(comparison['status'] == 'same_pin_review', 'Native parity must pass before projection')
    require('vaulttracker_native_accounting' not in backing['asset_specific'], 'Shadow field already exists')
    source = comparison['candidate_source']
    if not history['share_samples']:
        history_status = 'no_native_conversion_series'
    else:
        history_status = 'producer_share_samples_present_conversion_basis_unverified'
    projected = deepcopy(backing)
    projected['asset_specific']['vaulttracker_native_accounting'] = {
        'mode': 'shadow', 'generation': comparison['generation'], 'decimals': 6,
        'raw': comparison['candidate_raw'], 'block': source['block_number'],
        'block_hash': source['block_hash'], 'block_time': source['block_time'],
        'retrieved_at': source['retrieved_at'], 'history_status': history_status,
        'nav_basis': comparison['nav_basis'],
    }
    return projected


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', type=Path, required=True)
    parser.add_argument('--baseline', type=Path, required=True)
    parser.add_argument('--scratch-output', type=Path,
                        help='New directory below /tmp for scratch backing and unchanged history')
    parser.add_argument('--baseline-history', type=Path)
    args = parser.parse_args()
    if args.scratch_output and not args.baseline_history:
        parser.error('--scratch-output requires --baseline-history')
    from vaulttracker.client import VaultClient
    try:
        client = VaultClient(args.manifest)
        backing = read(args.baseline)
        report = compare(client, backing, datetime.now(timezone.utc).isoformat())
        report['baseline_sha256'] = hashlib.sha256(args.baseline.read_bytes()).hexdigest()
        if args.scratch_output:
            destination = args.scratch_output.resolve()
            require(Path('/tmp') in destination.parents and not destination.exists(),
                    'Use a new scratch directory below /tmp')
            native_history = client.get_history(VAULT_ID)
            projected = shadow_projection(backing, report, native_history)
            original_history = args.baseline_history.read_bytes()
            destination.mkdir()
            (destination / 'syrupusdc_backing.json').write_text(json.dumps(projected, indent=2) + '\n')
            (destination / 'syrupusdc_backing_history.json').write_bytes(original_history)
            native = projected['asset_specific'].pop('vaulttracker_native_accounting')
            require(projected == backing, 'Shadow altered existing dashboard fields')
            report.update(existing_fields_preserved=True,
                          legacy_history_sha256=hashlib.sha256(original_history).hexdigest(),
                          legacy_history_entries=len(json.loads(original_history)['entries']),
                          native_history_states=len(native_history['states']),
                          native_share_samples=len(native_history['share_samples']),
                          native_history_status=native['history_status'])
    except (OSError, KeyError, TypeError, ValueError, ArithmeticError) as error:
        report = {'status': 'blocked', 'reason': str(error)}
    print(json.dumps(report, indent=2))
    return 0 if report['status'] == 'same_pin_review' else 2


if __name__ == '__main__':
    raise SystemExit(main())
