#!/usr/bin/env python3
"""Hourly BM primary-redemption observations; all monetary reads share one block.

Supplemental to PegTracker backing: never changes backing or authored scores.
Failure publishes unavailable status rather than representing a failed read as zero.
"""
import argparse
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
import requests

ROOT = Path(__file__).resolve().parents[1]
RPCS = ('https://ethereum.publicnode.com', 'https://eth.llamarpc.com')
POOLS = {
    'syrupusdc': '0x80ac24aA929eaF5013f6436cdA2a7ba190f5Cc0b',
    'syrupusdt': '0x356B8d89c1e1239Cbbb9dE4815c39A1474d5BA7D',
}
# Queue implementations use uint128 or uint256 request IDs in the event ABI.
PROCESSED = ['0xd65e69687ca07983439841ba34e4a371aa7c005598455900c5767a4756a0fcab',
             '0x9fa30b5e853dc5c952287d8de37ee1d3222a7fea5494cc39f99a26b12e56e80f']


def utc(ts=None):
    return datetime.fromtimestamp(time.time() if ts is None else ts, timezone.utc).isoformat().replace('+00:00', 'Z')


class RPC:
    def __init__(self, url):
        self.url = url
        self.session = requests.Session()

    def rpc(self, method, params):
        r = self.session.post(self.url, json={'jsonrpc': '2.0', 'id': 1, 'method': method, 'params': params}, timeout=8)
        r.raise_for_status()
        d = r.json()
        if 'error' in d:
            raise ValueError('RPC returned an error')
        return d['result']

    def call(self, address, selector, block, argument=''):
        raw = self.rpc('eth_call', [{'to': address, 'data': '0x' + selector + argument}, block])
        if not isinstance(raw, str) or len(raw) < 66 or (len(raw) - 2) % 64:
            raise ValueError('Malformed contract response')
        return [int(raw[i:i+64], 16) for i in range(2, len(raw), 64)]


def metrics(cash, queued, shares, supply):
    return {
        'cash_coverage_pct': cash / queued * 100 if queued > 0 else None,
        'additional_funding_needed': max(queued - cash, 0),
        'queue_supply_pct': shares / supply * 100 if supply else None,
    }


def observe(client, slug):
    pool = POOLS[slug]
    block = client.rpc('eth_blockNumber', [])
    header = client.rpc('eth_getBlockByNumber', [block, False])
    at = utc(int(header['timestamp'], 16))
    manager = '0x' + format(client.call(pool, '481c6a75', block)[0], '040x')
    wm = '0x' + format(client.call(manager, '82fe535a', block)[0], '040x')
    token = '0x' + format(client.call(pool, '38d52e0f', block)[0], '040x')
    decimals = client.call(pool, '313ce567', block)[0]
    asset_decimals = client.call(token, '313ce567', block)[0]
    if decimals > 36 or asset_decimals > 36:
        raise ValueError('Unexpected decimals')
    shares = client.call(wm, '3a98ef39', block)[0]
    assets = client.call(pool, '07a2d13a', block, format(shares, '064x'))[0]
    supply = client.call(pool, '18160ddd', block)[0]
    cash = client.call(token, '70a08231', block, pool[2:].lower().zfill(64))[0]
    next_id, last_id = client.call(wm, 'e10d29ee', block)
    value = assets / 10**asset_decimals
    balance = cash / 10**asset_decimals
    result = {
        'schema_version': 1, 'status': 'ok', 'asset_slug': slug,
        'observed_at': utc(), 'block_timestamp': at, 'block_number': int(block, 16),
        'source': 'Ethereum contract reads', 'rpc': client.url,
        'pool': pool, 'withdrawal_manager': wm, 'underlying_token': token,
        'underlying_symbol': 'USDC' if slug == 'syrupusdc' else 'USDT',
        'pool_cash': balance, 'queued_shares': shares / 10**decimals,
        'queued_assets': value, 'queued_shares_raw': str(shares),
        'queue_is_empty': shares == 0, 'next_request_id': next_id, 'last_request_id': last_id,
        **metrics(balance, value, shares, supply),
        'last_processed_at': None, 'processing_status': 'unavailable',
        'limitations': 'Pool cash is funding capacity, not guaranteed immediate redemption. Existing requests have priority; operator processing is required. Queue value uses current NAV, not settlement value.',
    }
    # Peripheral, bounded event scan. Not finding an event is not proof of no processing.
    deadline = time.monotonic() + 18
    end = int(block, 16)
    floor = max(0, end - 7200)
    try:
        while end >= floor:
            if time.monotonic() > deadline:
                raise TimeoutError('Event scan budget')
            start = max(floor, end - 999)
            logs = client.rpc('eth_getLogs', [{'address': wm, 'fromBlock': hex(start), 'toBlock': hex(end), 'topics': [PROCESSED]}])
            if logs:
                latest = max(logs, key=lambda l: (int(l['blockNumber'], 16), int(l['logIndex'], 16)))
                h = client.rpc('eth_getBlockByNumber', [latest['blockNumber'], False])
                result.update(last_processed_at=utc(int(h['timestamp'], 16)), processing_status='observed', last_processed_block=int(latest['blockNumber'], 16))
                break
            end = start - 1
        else:
            result['processing_status'] = 'not_found_in_scan_window'
        result['processing_scan_from_block'] = floor
    except (requests.RequestException, ValueError, KeyError, TypeError, TimeoutError):
        result['processing_status'] = 'unavailable'
    return result


def atomic_json(path, value):
    temp = path.with_name(path.name + f'.{os.getpid()}.tmp')
    temp.write_text(json.dumps(value, indent=2) + '\n')
    os.replace(temp, path)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--data-dir', type=Path, default=ROOT / 'data')
    args = parser.parse_args()
    failed = False
    for slug in POOLS:
        observation = None
        for url in RPCS:
            try:
                observation = observe(RPC(url), slug)
                break
            except (requests.RequestException, ValueError, KeyError, TypeError):
                continue
        if observation is None:
            failed = True
            observation = {'schema_version': 1, 'asset_slug': slug, 'status': 'unavailable', 'attempted_at': utc(), 'source': 'Ethereum contract reads'}
        atomic_json(args.data_dir / (slug + '_redemptions.json'), observation)
        path = args.data_dir / (slug + '_backing.json')
        if path.exists():
            backing = json.loads(path.read_text())
            backing.setdefault('asset_specific', {})['redemptions'] = observation
            atomic_json(path, backing)
        print(slug + ': ' + observation['status'] + ' · processing ' + observation.get('processing_status', 'unavailable'), flush=True)
    return 1 if failed else 0


if __name__ == '__main__':
    raise SystemExit(main())
