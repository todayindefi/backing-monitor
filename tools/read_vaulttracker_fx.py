#!/usr/bin/env python3
"""Replay a pinned VaultTracker FX reader bundle into a seeded scratch dashboard."""
import argparse
import hashlib
import json
from decimal import Decimal
from pathlib import Path

from prepare_fxsave_preview import ADDRESS as SAVE, validate_base, price_history_for_preview
from sync_fxsp_vault import ADDRESS as SP, atomic, instant, integer, projection, reject_private, validate_source


FILES = {
    'feed/vaults.json', 'fxsp-native.json', 'fxsave-public-safe.json',
    'fxsave-native-usd-nav-history.json', 'fxsave-native-rate-history.json',
    'fxsave-native-return-windows.json',
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def read_bundle(path, expected_hash):
    raw = path.read_bytes()
    require(hashlib.sha256(raw).hexdigest() == expected_hash, 'Reader manifest SHA256 mismatch')
    manifest = json.loads(raw)
    require(manifest['schema_version'] == 'vaulttracker-fx-reader/1', 'Unsupported reader manifest')
    require(set(manifest['sha256_by_path']) == FILES, 'Unexpected bundle artifact set')
    documents = {}
    for name, digest in manifest['sha256_by_path'].items():
        data = (path.parent / name).read_bytes()
        require(hashlib.sha256(data).hexdigest() == digest, f'Artifact SHA256 mismatch: {name}')
        documents[name] = json.loads(data)
    return manifest, documents


def same_pin(source, observed):
    return all(source.get(k) == observed.get(k) for k in ('block_number', 'block_hash', 'block_time', 'observed_at', 'retrieved_at'))


def history_rows(document, subject, units, field, scale):
    require(document['subject'] == subject and document['continuous_coverage'] is False, 'Invalid sparse history scope')
    rows = {}
    for sample in document['samples']:
        source = sample['source']
        require(sample['units'] == units and sample[scale] == str(10**18), 'History units changed')
        require((sample['timestamp'], sample['block_number'], sample['block_hash']) ==
                (source['block_time'], source['block_number'], source['block_hash']), 'History source mismatch')
        instant(source['observed_at'])
        instant(source['retrieved_at'])
        key = sample['block_number']
        require(key not in rows and integer(sample[field]) > 0, 'Invalid or duplicate history observation')
        rows[key] = sample
    return rows


def update_save(snapshot, history, source, nav_doc, rate_doc, returns, manifest):
    pin = source['source']
    subject = source['subject']
    require(source['schema_version'] == 'fxsave-public-safe/1' and subject['chain_id'] == 1
            and subject['address'].lower() == SAVE and subject['decimals'] == source['underlying_decimals'] == 18
            and source['underlying'].lower() == SP, 'Wrong fxSAVE scope')
    quote = source['generic_payout_previews']
    custody = source['custody_reconciliation']
    rate = source['fxsp_per_share_quote']
    nav = source['native_usd_nav_per_share']
    spnav = source['fxsp_native_usd_nav_per_share']
    for component in (quote, custody, rate, nav, spnav, quote['queued'], quote['instant']):
        component_pin = component['source']
        # Component records need not repeat the root observation clock.
        require(all(pin[k] == component_pin.get(k) for k in
                    ('block_number', 'block_hash', 'block_time', 'retrieved_at'))
                and component_pin.get('observed_at', pin['observed_at']) == pin['observed_at'],
                'Mixed fxSAVE source pins')
    require(nav['units'] == 'USD/fxSAVE' and spnav['units'] == 'USD/fxSP'
            and nav['scale_raw'] == spnav['scale_raw'] == str(10**18), 'Invalid NAV scale')
    require(rate['input_raw'] == quote['input_raw'] == str(10**18)
            and rate['input_decimals'] == rate['output_decimals'] == quote['input_decimals'] == 18
            and quote['input_token'].lower() == SAVE, 'Invalid share preview units')
    require(custody['total_assets_fxsp_raw'] == source['assets_fxsp_raw'], 'Custody perimeter mismatch')
    raw = {'supply': source['share_supply_raw'], 'assets': source['assets_fxsp_raw'],
           'custody': custody['custody_receipt_balance_raw'], 'rate': rate['output_raw'],
           'nav': nav['raw'], 'spnav': spnav['raw']}
    units = lambda value, decimals=18: float(Decimal(integer(value)) / 10**decimals)
    redemption = {'queue_seconds': quote['cooldown_seconds'], 'block': pin['block_number'],
                  'as_of': pin['block_time'], 'evidence': {'kind': 'view_only', 'gas_included': False}}
    fee = integer(quote['standard_fee_ratio_raw'])
    scale = integer(quote['fee_scale_raw'])
    require(scale == 10**18 and fee <= scale, 'Invalid preview fee')
    redemption['instant_fee_pct'] = 100 * fee / scale
    for route in ('queued', 'instant'):
        outputs = quote[route]['outputs']
        require([(leg['token'].lower(), leg['decimals']) for leg in outputs] ==
                [('0x085780639cc2cacd35e474e71f4d000e2405d8f6', 18),
                 ('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', 6)], 'Invalid payout assets')
        redemption[route] = {f'{token}_per_share': units(leg['raw'], leg['decimals'])
                             for token, leg in zip(('fxusd', 'usdc'), outputs, strict=True)}
    for before, after in zip(quote['queued']['outputs'], quote['instant']['outputs'], strict=True):
        amount = integer(before['raw'])
        require(integer(after['raw']) == amount - amount * fee // scale, 'Instant fee arithmetic mismatch')

    old = snapshot['asset_specific']['fxsave']
    require(pin['block_number'] >= old['block'], 'fxSAVE block regressed')
    if pin['block_number'] == old['block']:
        require(pin['block_hash'] == old['block_hash'], 'Conflicting fxSAVE snapshot block')
    detail = {key: old[key] for key in ('schema_version', 'identity', 'units', 'assessment',
                                       'matched_exits', 'exit_refresh_attempt', 'venue_inventory') if key in old}
    concentration = old.get('concentration')
    if concentration is not None:
        instant(concentration['as_of'])
        require(type(concentration['block']) is int and concentration['block'] <= old['block'],
                'Invalid retained concentration block')
        detail['concentration'] = concentration.copy()
    scale = 10**18
    nav_difference = integer(raw['nav']) * scale - integer(raw['rate']) * integer(raw['spnav'])
    detail['basket_reconciliation'] = {
        'fxsp_nav_usd': units(raw['spnav']),
        'share_nav_difference_usd': float(Decimal(nav_difference) / scale**2),
        'queued_basket_usd': None,
        'instant_basket_usd': None,
        'status': 'awaiting_same_block_fxusd_and_usdc_marks',
        'basis': 'Native share NAV minus fxSP per share times fxSP NAV. Token amounts and fees reconcile separately; receipt payout USD values require both same-block token marks.',
        'source': pin,
    }
    detail.update(block=pin['block_number'], block_hash=pin['block_hash'], as_of=pin['block_time'],
                  observed_at=pin['observed_at'], native_source=pin, raw=raw, accounting=custody,
                  redemption=redemption, nav_usd=units(raw['nav']), fxsp_per_share=units(raw['rate']),
                  total_supply_shares=units(raw['supply']), total_assets_fxsp=units(raw['assets']))
    snapshot['asset_specific']['fxsave'] = detail
    snapshot['timestamp'] = pin['block_time']
    snapshot['summary']['total_supply'] = detail['total_supply_shares']
    snapshot['backing']['as_of'] = pin['block_time']
    snapshot['peg'].update(nav=detail['nav_usd'], nav_as_of=pin['block_time'], premium_discount_pct=None)
    validate_base(snapshot)

    usd_meta = manifest['history']['fxSAVE']
    rate_meta = manifest['history']['fxSAVE_native_rate']
    require(usd_meta['path'] == 'fxsave-native-usd-nav-history.json' and usd_meta['unit'] == 'USD/fxSAVE'
            and rate_meta['path'] == 'fxsave-native-rate-history.json' and rate_meta['unit'] == 'fxSP/fxSAVE'
            and rate_meta['return_windows_path'] == 'fxsave-native-return-windows.json', 'Wrong history paths or basis')
    usd = history_rows(nav_doc, subject, 'USD/fxSAVE', 'nav_raw', 'scale_raw')
    rates = history_rows(rate_doc, subject, 'fxSP/fxSAVE', 'rate_raw', 'rate_scale_raw')
    require(len(usd) == usd_meta['samples'] and len(rates) == rate_meta['samples']
            and usd.keys() == rates.keys() and rate_doc['underlying']['address'].lower() == SP
            and all(same_pin(usd[k]['source'], rates[k]['source']) for k in usd), 'History companions do not match')
    end = pin['block_number']
    require(end == max(usd) and same_pin(pin, usd[end]['source'])
            and usd[end]['nav_raw'] == raw['nav'] and rates[end]['rate_raw'] == raw['rate']
            and returns['subject'] == subject and returns['rate_units'] == 'fxSP/fxSAVE'
            and same_pin(pin, returns['end_source']), 'History endpoint mismatch')
    points = []
    for block, sample in sorted(usd.items()):
        points.append({'timestamp': sample['timestamp'], 'block': block, 'block_hash': sample['block_hash'],
                       'theoretical_price': units(sample['nav_raw']), 'market_price': None, 'price_units': 'USD/share',
                       'source': 'VaultTracker companion: saved fxSAVE.nav()'})
    projected = price_history_for_preview(
        {'assets': {'fxSAVE': {'metadata': {'chain': 'ethereum', 'contract_address': SAVE,
                                            'price_units': 'USD/share'}, 'history': points}}},
        [{**point, 'nav_usd': point['theoretical_price']} for point in points])
    existing = {point['block']: point for point in history['price_history']['entries']}
    for point in projected['entries']:
        block = point['block']
        sample = usd[block]
        previous = existing.get(block)
        require(previous is None or (
            previous['timestamp'] == point['timestamp']
            and abs(previous['peg_theoretical_price'] - point['peg_theoretical_price']) < 1e-12
            and previous.get('block_hash', sample['block_hash']) == sample['block_hash']), 'Conflicting prior USD NAV history')
        existing[block] = {**(previous or {}), **point, 'block_hash': sample['block_hash'],
                           'nav_raw': sample['nav_raw'], 'native_source': sample['source']}
    history['price_history'].update(entries=sorted(existing.values(), key=lambda p: instant(p['timestamp'])),
                                    source_clock_gaps=nav_doc['source_clock_gaps'], continuous_coverage=False)
    return len(usd)


def intake(path, manifest_hash, output):
    manifest, docs = read_bundle(path, manifest_hash)
    feed = docs['feed/vaults.json']
    require(feed['schema_version'] == 'vault-index/1' and manifest['statuses'] == feed['statuses'],
            'Normalized index or status mismatch')
    require(manifest['history']['fxSP']['path'] is None
            and manifest['history']['fxSP']['coverage'] == 'snapshot_only_keep_consumer_history', 'fxSP history policy changed')
    by_id = {r['vault_id']: r for r in feed['vaults']}
    statuses = {r['vault_id']: r for r in feed['statuses']}
    native_sp = docs['fxsp-native.json']
    native_save = docs['fxsave-public-safe.json']
    sp_raw = validate_source(native_sp)
    for address, native, supply, source_id in (
        (SP, native_sp, str(sp_raw['share_supply_raw']), 'native'),
        (SAVE, native_save, native_save['share_supply_raw'], 'fxsave'),
    ):
        key = f'eip155:1:{address}'
        record, status = by_id[key], statuses[key]
        subject = record['subject']
        require(subject['share_address'].lower() == address and subject['chain_id'] == 1 and subject['decimals'] == 18
                and record['accounting']['share_supply']['raw'] == supply, 'Normalized identity or supply mismatch')
        observed = next(i for i in record['source_inputs'] if i['id'] == source_id)
        seen_status = next(i for i in status['source_freshness'] if i['id'] == source_id)
        require(same_pin({'retrieved_at': native['source']['observed_at'], **native['source']}, observed)
                and all(observed[k] == seen_status[k] for k in ('block_time', 'observed_at', 'freshness_status'))
                and status['last_attempt']['status'] == 'success', 'Source/status binding failed')
    load = lambda name: json.loads((output / name).read_bytes())
    sp = load('fxsp_backing.json')
    save = load('fxsave_backing.json')
    history = load('fxsave_backing_history.json')
    count = update_save(save, history, native_save, docs['fxsave-native-usd-nav-history.json'],
                        docs['fxsave-native-rate-history.json'], docs['fxsave-native-return-windows.json'], manifest)
    save['asset_specific']['fxsave']['refresh_attempt'] = statuses[f'eip155:1:{SAVE}']['last_attempt']
    sp_pin = native_sp['source']
    require(sp_pin['block_number'] != sp['observation']['block'] or
            sp_pin['block_time'] == sp['observation']['at'], 'Conflicting fxSP clock')
    update_sp = sp_pin['block_number'] > sp['observation']['block']
    if update_sp:
        controls = load('fx-reader-controls.json')
        attempt = statuses[f'eip155:1:{SP}']['last_attempt']
        status = {'schema_version': 'fxsp-refresh-status/1', 'refresh_interval_seconds': 28800,
                  'last_good': {'block_hash': sp_pin['block_hash']}, 'last_attempt': attempt}
        view = projection(native_sp, [], status, controls, previous=sp)
        view['observation']['producer'] = 'VaultTracker'
        view['source_status']['producer'] = 'VaultTracker'
        points = {point['at']: point for point in sp['changes']['history']}
        for point in view['changes']['history']:
            require(point['at'] not in points or points[point['at']] == point, 'Conflicting existing fxSP NAV')
            points[point['at']] = point
        updated = sorted(points.values(), key=lambda row: instant(row['at']))
        view['changes'].update(history=updated, history_count=len(updated), history_displayed_count=len(updated))
        require(len(updated) >= len(sp['changes']['history']), 'Existing fxSP history lost')
    outputs = {'fxsave_backing.json': save, 'fxsave_backing_history.json': history,
               'fxsave_native_rate_history.json': docs['fxsave-native-rate-history.json'],
               'fxsave_native_return_windows.json': docs['fxsave-native-return-windows.json']}
    if update_sp:
        outputs.update({'fxsp_backing.json': view, 'fxsp_source_status.json': view['source_status']})
    for value in outputs.values():
        reject_private(value)
    for name, value in outputs.items():
        atomic(output / name, value)
    atomic(output / 'fx_reader_status.json', {'status': 'accepted_offline', 'fxsave_usd_samples': count,
           'source_statuses': feed['statuses'], 'fxsp_disposition': 'updated' if update_sp else 'retained_existing_at_or_above_bundle_block',
           'fxsp_retained_source_clock': None if update_sp else sp['observation']['at']})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', type=Path, required=True)
    parser.add_argument('--manifest-sha256', required=True)
    parser.add_argument('--output-root', type=Path, required=True)
    args = parser.parse_args()
    output = args.output_root.resolve()
    if Path('/tmp') not in output.parents or not output.is_dir() or any(p.is_symlink() for p in output.iterdir()):
        parser.error('Use an existing scratch directory below /tmp containing copies of BM outputs')
    try:
        intake(args.manifest, args.manifest_sha256, output)
    except (OSError, ValueError, KeyError, TypeError, StopIteration, ArithmeticError) as exc:
        atomic(output / 'fx_reader_status.json', {'status': 'failed', 'error_type': type(exc).__name__})
        print(f'FX reader intake failed: {type(exc).__name__}')
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
