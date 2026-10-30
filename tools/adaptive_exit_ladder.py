#!/usr/bin/env python3
"""Bounded 50bps probing; standalone PegTracker candidate, no serving-feed writes."""
import argparse
import hashlib
import json
import math
import sys
import time
from datetime import datetime, timezone
from pathlib import Path


def utcnow():
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')


def finite(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(x)


def adaptive_ladder(quote_once, *, reference=1000, initial=100000, ceiling=50000000,
                    previous=None, now=None, threshold=50, tolerance=5):
    """Callback makes ONE request; failures consume budget, no hidden retries.

    Warm history only selects sizes; all evidence is quoted again this run.
    Maximum seven calls, normally five. Never interpolates an executable quote.
    """
    if not (0 < reference < initial <= ceiling and threshold > tolerance > 0):
        raise ValueError('Invalid adaptive ladder policy')
    now = now or datetime.now(timezone.utc)
    warm = None
    if previous:
        try:
            age = (now - datetime.fromisoformat(previous['timestamp'].replace('Z', '+00:00'))).total_seconds()
            bracket = previous['depth_50bps']['bracket']
            if (0 <= age <= 10800 and len(bracket) == 2
                    and reference < bracket[0] < bracket[1] <= ceiling):
                warm = bracket
        except (KeyError, TypeError, ValueError):
            pass
    rows, successful = {}, []
    size, stop = int(reference), 'request_budget'
    lo = hi = None
    reference_rate = None
    for request in range(1, 8):
        if str(size) in rows:
            stop = 'size_resolution'
            break
        try:
            row = dict(quote_once(size))
        except Exception as exc:
            row = {'error': type(exc).__name__}
        row['observed_at'] = utcnow()
        output = row.get('output_usd')
        if not finite(output) or output <= 0 or row.get('error'):
            row.setdefault('error', 'invalid_or_zero_output')
            rows[str(size)] = row
            stop = 'quote_failed'
            break
        rate = output / size
        if reference_rate is None:
            reference_rate = rate
        impact = (1 - rate / reference_rate) * 10000
        row.update(slippage_bps=-impact, fill_ratio=rate)
        rows[str(size)] = row
        successful.append((size, impact))
        # Material reversals invalidate a single monotone crossing assumption.
        ordered = sorted(successful)
        if any(a[1] > b[1] + tolerance for a, b in zip(ordered, ordered[1:])):
            stop = 'non_monotonic'
            break
        clears = [(s, b) for s, b in successful if b <= threshold]
        fails = [(s, b) for s, b in successful if b > threshold]
        lo = max(clears) if clears else None
        hi = min(fails) if fails else None
        near = lo and threshold - tolerance <= lo[1] <= threshold
        if request >= 5 and lo and hi and (near or hi[0] / lo[0] <= 1.25):
            stop = 'bracket_refined'
            break
        if request == 7:
            break
        if hi and lo:
            size = int(round(math.sqrt(lo[0] * hi[0])))
        elif request == 1:
            size = int(warm[0] if warm else initial)
        elif warm and request == 2 and lo and lo[0] == warm[0]:
            size = int(warm[1])
        else:
            size = min(int(size * 10), int(ceiling))
            if str(size) in rows:
                stop = 'notional_ceiling'
                break
    valid = stop != 'non_monotonic' and lo is not None
    bracket = [lo[0], hi[0]] if valid and hi else None
    status = ('bracketed' if bracket else 'quote_failed' if stop == 'quote_failed'
              else 'not_measured' if not valid else 'ladder_exhausted')
    depth = lo[0] if valid else None
    basis = (f'50 bps size impact relative to the ${reference:g} reference quote. '
             + (f'Bracket ${bracket[0]:g}–${bracket[1]:g}; lower endpoint is a tested quote, not an interpolated crossing.' if bracket
                else 'Observed floor, not a measured crossing.' if valid else 'No valid depth figure.')
             + f' Stop: {stop}; {len(rows)} of at most 7 requests. Gas excluded.')
    return {'timestamp': now.isoformat().replace('+00:00', 'Z'), 'quotes': rows,
            'slippage_bps_basis': 'price_impact_vs_venue_spot',
            'slippage_reference': {'basis': 'venue_spot', 'size_usd': reference},
            'adaptive_policy': {'version': 'adaptive-50bps/1', 'normal_requests': 5,
                                'max_requests': 7, 'requests_used': len(rows),
                                'notional_ceiling_usd': ceiling, 'stop_reason': stop,
                                'warm_start_used': warm is not None},
            'depth_50bps': {'threshold_bps': threshold, 'status': status,
                           'depth_usd': depth, 'is_floor': valid and not bool(bracket),
                           'bracket': bracket, 'basis': basis,
                           'clearing_impact_bps': lo[1] if valid else None,
                           'crossing_impact_bps': hi[1] if valid and hi else None}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--peg-root', type=Path, default=Path('/home/danger/PegTracker'))
    parser.add_argument('--asset', default='GHO')
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--previous', type=Path)
    parser.add_argument('--reference', type=int, default=1000)
    parser.add_argument('--initial', type=int, default=100000)
    parser.add_argument('--ceiling', type=int, default=50000000)
    args = parser.parse_args()
    sys.path.insert(0, str(args.peg_root))
    import liquidity_tracker as tracker
    # Single-provider call with retries disabled; never invokes get_quote's fallbacks.
    tracker.QUOTE_MAX_ATTEMPTS = 1
    assets = tracker.load_liquidity_assets(str(args.peg_root / 'asset_config_usd.json'))
    matches = [a for a in assets if a['key'] == args.asset]
    if len(matches) != 1:
        raise ValueError('Expected one unambiguous USD asset key')
    asset = matches[0]
    latest = json.loads((args.peg_root / 'data/peg_tracker_latest_usd.json').read_text())
    peg = latest[asset.get('peg_key') or asset['key']]
    mark = peg.get('market_price')
    if not finite(mark) or mark <= 0 or asset['sell_into'] == 'WETH':
        raise ValueError('Positive USD sizing mark required; ETH conversion needs separate integration')
    previous = json.loads(args.previous.read_text()) if args.previous else None
    identity = {'asset': asset['key'], 'chain': asset['chain'], 'token_address': asset['token_address'],
                'sell_into': asset['sell_into']}
    if previous and any(previous.get(k) != v for k, v in identity.items()):
        raise ValueError('Previous ladder identity mismatch')
    def quote_once(size):
        time.sleep(tracker.KYBERSWAP_DELAY)
        raw = str(int(size / mark * 10 ** asset['decimals']))
        response = tracker.kyberswap_quote(asset['token_address'], asset['sell_into_address'], raw, asset['chain_id'])
        if not response or response.get('error'):
            return {'error': (response or {}).get('error', 'unsupported'), 'attempts': 1}
        return {'output_usd': int(response['output_raw']) / 10 ** asset['sell_into_decimals'],
                'amount_in_raw': raw, 'source': response['source'], 'attempts': 1}
    result = adaptive_ladder(quote_once, reference=args.reference, initial=args.initial,
                             ceiling=args.ceiling, previous=previous)
    result.update(identity, producer='PegTracker', staged_only=True, source='kyberswap',
                  fair_value=mark, fair_value_basis='market', sizing_mark_as_of=peg.get('market_price_as_of'))
    args.out.parent.mkdir(parents=True, exist_ok=True)
    raw = (json.dumps(result, indent=2, allow_nan=False) + '\n').encode()
    args.out.write_bytes(raw)
    print(json.dumps({'path': str(args.out), 'sha256': hashlib.sha256(raw).hexdigest(),
                      'depth_50bps': result['depth_50bps'], 'policy': result['adaptive_policy']}))


if __name__ == '__main__':
    main()
