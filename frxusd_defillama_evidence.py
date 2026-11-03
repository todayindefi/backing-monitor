#!/usr/bin/env python3
"""One read-only DeFiLlama adapter and content-addressed frxUSD evidence export."""
import argparse
import gzip
import hashlib
import json
import math
import pathlib
import re
from collections import defaultdict
from datetime import datetime, timezone
from decimal import Decimal

import requests

ROOT = pathlib.Path(__file__).resolve().parent
DATA = ROOT / 'data'
PAGE = 'https://defillama.com/verified/frxusd'
API = 'https://defillama.com/api/public/verified/frxusd'
MAX_RUN_AGE_HOURS = 24
MAX_POSITION_AGE_HOURS = 48
ALIASES = {'avax': 'avalanche', 'bsc': 'bnb', 'era': 'zksync', 'wc': 'worldchain', 'plume_mainnet': 'plume'}
FORMULAS = {
    'coverage_par_pct': '100 * reserves_usd / liabilities_tokens (USD1 per frxUSD)',
    'coverage_market_pct': '100 * reserves_usd / liabilities_market_usd',
    'surplus_par_usd': 'reserves_usd - liabilities_tokens',
    'concentration_pct': '100 * strategy_value_usd / reserves_usd',
    'liabilities_tokens': 'sum(source chain supplies); Ethereum already excludes Fraxtal bridge escrow; extra subtraction = 0',
}


class SchemaChanged(ValueError):
    pass


class StaleSource(ValueError):
    pass


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def stamp(value):
    return datetime.fromtimestamp(value, timezone.utc).isoformat().replace('+00:00', 'Z')


def parse_stamp(value):
    return datetime.fromisoformat(value.replace('Z', '+00:00'))


def number(value, label):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
        raise SchemaChanged('Invalid nonnegative number: ' + label)
    return Decimal(str(value))


def age_check(value, now, limit, label):
    number(value, label)
    age = (now - datetime.fromtimestamp(value, timezone.utc)).total_seconds() / 3600
    if age < -5 / 60:
        raise SchemaChanged('Future source clock: ' + label)
    if age > limit:
        raise StaleSource('Stale source clock: ' + label)
    return age


def extract(html):
    match = re.search(rb'<script\b[^>]*\bid=["\x27]__NEXT_DATA__["\x27][^>]*>(.*?)</script>', html, re.S)
    if not match:
        raise SchemaChanged('Embedded Next.js data missing; no supported API fallback available')
    try:
        data = json.loads(match[1], parse_constant=lambda x: (_ for _ in ()).throw(SchemaChanged('Nonfinite JSON')))
        if data['page'] != '/verified/[slug]' or data['props']['pageProps']['slug'] != 'frxusd':
            raise SchemaChanged('Wrong project/page identity')
        return data['props']['pageProps']['payload'], 'Full reserves' if b'Full reserves' in html else 'Not exposed in captured markup'
    except (KeyError, TypeError, json.JSONDecodeError) as exc:
        raise SchemaChanged('Embedded page schema changed') from exc


def normalize(payload, now, issuer=None, claim_scope='Not exposed in payload'):
    """Validate upstream arithmetic before publishing; never infer independent assurance."""
    try:
        if payload['projectId'] != 'frxusd':
            raise SchemaChanged('Wrong project')
        if payload['state']['upToDate'] is not True:
            raise StaleSource('DeFiLlama marks its source not up to date')
        data = payload['data']
        age_check(data['timestampOnRun'], now, MAX_RUN_AGE_HOURS, 'run')
        total = number(data['totalValueUsd'], 'reserves')
        if not isinstance(data['assets'], list) or (total > 0 and not data['assets']) or data['fundInTransit']:
            raise SchemaChanged('Empty reserves or unsupported funds-in-transit shape')
        # Chain identity is not guessed from symbol or EVM address format.
        norm_id = lambda x: x.lower() if isinstance(x, str) and x.startswith('0x') else x
        identity_registry, account_chains, token_chains = defaultdict(set), defaultdict(set), defaultdict(set)
        for row in ((issuer or {}).get('issuer', {}).get('reserves', {}).get('rows') or []):
            holder, token, chain = norm_id(row.get('holder_address')), norm_id(row.get('token_address')), row.get('chain')
            if holder and token and chain:
                identity_registry[(holder, token)].add(chain)
                account_chains[holder].add(chain)
                token_chains[token].add(chain)
        positions, grouped, identities = [], defaultdict(Decimal), set()
        for raw in data['assets']:
            amount, price, value = (number(raw[k], k) for k in ('amount', 'priceUsd', 'valueUsd'))
            if abs(amount * price - value) > Decimal('.01'):
                raise SchemaChanged('Position quantity x price does not reconcile')
            age_check(raw['timestamp'], now, MAX_POSITION_AGE_HOURS, 'position')
            holder, token, strategy = raw['walletAddress'], raw['address'], raw['strategy']
            if not isinstance(strategy, str) or not strategy or not isinstance(raw['wallet'], str):
                raise SchemaChanged('Position identity missing')
            if any(x is not None and (not isinstance(x, str) or not x) for x in [holder, token]) or not isinstance(raw['symbol'], str):
                raise SchemaChanged('Invalid account/token/symbol type')
            if bool(holder) != bool(token):
                raise SchemaChanged('Incomplete account/token identity')
            explicit = raw.get('chain')
            matches = identity_registry.get((norm_id(holder), norm_id(token))) or (account_chains[norm_id(holder)] & token_chains[norm_id(token)])
            registry = next(iter(matches)) if len(matches) == 1 else None
            chain = explicit or (registry if holder else 'offchain') or 'unresolved'
            chain = ALIASES.get(chain, chain)
            chain_basis = 'source_explicit' if explicit else 'issuer_identity_registry' if registry else 'offchain_account' if not holder else 'unresolved'
            # Only EVM identities are case folded. Solana is case sensitive.
            norm = lambda x: x.lower() if isinstance(x, str) and x.startswith('0x') else x
            account = norm(holder) if holder else 'offchain:' + digest(raw['wallet'].encode())[:20]
            key = [chain, account, norm(token), strategy]
            position_id = digest(canonical(key))
            if position_id in identities:
                raise SchemaChanged('Duplicate chain/account/token/strategy identity')
            identities.add(position_id)
            grouped[strategy] += value
            positions.append({'position_id': position_id, 'chain': chain, 'chain_basis': chain_basis,
                              'account_id': account, 'account_label': raw['wallet'], 'holder_address': holder,
                              'token_address': token, 'symbol': raw['symbol'], 'strategy': strategy,
                              'quantity': float(amount), 'price_usd': float(price), 'value_usd': float(value),
                              'observed_at': stamp(raw['timestamp']), 'verification_claim_owner': 'DeFiLlama'})
        position_delta = sum(grouped.values()) - total
        if abs(position_delta) > Decimal('.01') or set(grouped) != set(data['balances']):
            raise SchemaChanged('Position/strategy totals do not reconcile')
        for key, value in grouped.items():
            if abs(value - number(data['balances'][key], key)) > Decimal('.01'):
                raise SchemaChanged('Strategy balance does not reconcile: ' + key)
        liab = data['liabilities']
        tokens, market, escrow = (number(liab[k], k) for k in ('frxusdSupply', 'frxusdSupplyUsd', 'frxusdLockedInFraxtalBridge'))
        if tokens == 0 or market == 0:
            raise SchemaChanged('Zero liability denominator')
        chain_rows, seen = [], set()
        if not {'ethereum', 'fraxtal'} <= set(liab['frxusdSupplyByChain']):
            raise SchemaChanged('Bridge netting scope changed')
        for original, value in liab['frxusdSupplyByChain'].items():
            chain = ALIASES.get(original, original)
            if chain in seen:
                raise SchemaChanged('Ambiguous chain aliases in supply')
            seen.add(chain)
            chain_rows.append({'source_chain': original, 'chain': chain, 'tokens': float(number(value, original))})
        chain_delta = sum(Decimal(str(r['tokens'])) for r in chain_rows) - tokens
        if abs(chain_delta) > Decimal('.000001'):
            raise SchemaChanged('Chain supplies do not reconcile with net global supply')
        concentration = [{'strategy': k, 'value_usd': float(v), 'pct_of_reserves': float(100 * v / total) if total else None} for k, v in sorted(grouped.items())]
        clocks = [p['observed_at'] for p in positions]
        return {'source_owner': 'DeFiLlama', 'source_url': PAGE, 'transport': 'embedded_next_data_fallback',
                'supported_api_status': 'Public verification route discovered in upstream build manifest; not a documented versioned API guarantee',
                'observed_at': stamp(data['timestampOnRun']), 'oldest_position_at': min(clocks) if clocks else None, 'newest_position_at': max(clocks) if clocks else None,
                'claimed_scope': claim_scope, 'source_up_to_date': True, 'positions': positions,
                'alerts': ['coverage_below_par_liabilities'] if total < tokens else [],
                'methodology_by_strategy': data['methodology'], 'concentration': concentration,
                'liabilities': {'tokens': float(tokens), 'market_value_usd': float(market), 'chain_rows': chain_rows,
                                'bridge_adjustment': {'fraxtal_escrow_tokens': float(escrow), 'already_netted_in': 'ethereum chain supply',
                                                      'additional_subtraction_tokens': 0, 'independently_reproduced': False}},
                'metrics': {'reserves_usd': float(total), 'liabilities_tokens': float(tokens), 'liabilities_market_usd': float(market),
                            'coverage_par_pct': float(100 * total / tokens), 'coverage_market_pct': float(100 * total / market),
                            'surplus_par_usd': float(total - tokens)},
                'reconciliation': {'position_sum_delta_usd': float(position_delta), 'chain_sum_delta_tokens': float(chain_delta),
                                   'positions': len(positions), 'accounts': len({p['account_id'] for p in positions}),
                                   'chain_count': len(chain_rows), 'global_liability_enumeration_independently_verified': False},
                'limitations': ['Full reserves is DeFiLlama\u2019s claim, not a BM audit or reproduced offchain verification.',
                                'Public data does not provide bank statements, beneficial-ownership proof or complete verification procedures.',
                                'An FDIC account label does not establish unlimited deposit protection.',
                                'Arithmetic chain reconciliation does not prove every chain balance or escrow treatment.',
                                'This upstream frxUSD evidence does not verify sfrxUSD strategy assets, PPS, liabilities or redemption.']}
    except (KeyError, TypeError, IndexError) as exc:
        raise SchemaChanged('Required upstream fields missing or changed') from exc


def atomic(path, raw):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + '.tmp')
    tmp.write_bytes(raw)
    tmp.replace(path)


def archive(data_dir, raw, suffix):
    name = digest(raw) + suffix + '.gz'
    path = data_dir / 'frxusd_evidence_sources' / name
    if not path.exists():
        atomic(path, gzip.compress(raw, mtime=0))
    return {'sha256': digest(raw), 'path': 'data/frxusd_evidence_sources/' + name, 'encoding': 'gzip', 'hash_basis': 'uncompressed bytes'}


def local_source(data_dir, filename):
    try:
        raw = (data_dir / filename).read_bytes()
        value = json.loads(raw)
        return value, {'status': 'available', 'original_status': value.get('status'), 'document': archive(data_dir, raw, '.json')}
    except (OSError, ValueError):
        return {}, {'status': 'unavailable', 'path': 'data/' + filename}


def fetch_upstream():
    headers = {'User-Agent': 'backing-monitor-frxusd-evidence/1'}
    try:
        response = requests.get(API, timeout=25, headers=headers)
        response.raise_for_status()
    except requests.RequestException as exc:
        response = requests.get(PAGE, timeout=25, headers=headers)
        response.raise_for_status()
        payload, scope = extract(response.content)
        return response.content, payload, 'embedded_next_data_fallback', PAGE, scope, type(exc).__name__
    try:
        payload = response.json()
    except ValueError as exc:
        raise SchemaChanged('Public API returned non-JSON data') from exc
    return response.content, payload, 'public_verification_api', API, 'Scope label not exposed by API; see DeFiLlama page', None


def refresh(data_dir=DATA, fetch=None, now=None):
    now = now or datetime.now(timezone.utc)
    now_iso = now.isoformat().replace('+00:00', 'Z')
    target = data_dir / 'frxusd_backing_evidence.json'
    try:
        previous = json.loads(target.read_text()) if target.exists() else {}
    except (OSError, ValueError):
        previous = {}
    try:
        if fetch:
            raw_source = fetch()
            payload, scope = extract(raw_source)
            transport, source_url, api_error = 'embedded_next_data_fallback', PAGE, 'test-injected page'
        else:
            raw_source, payload, transport, source_url, scope, api_error = fetch_upstream()
        issuer, issuer_health = local_source(data_dir, 'frxusd_backing.json')
        independent, independent_health = local_source(data_dir, 'frxusd_backing_verification.json')
        third = normalize(payload, now, issuer, scope)
        third.update({'transport': transport, 'source_url': source_url, 'verification_record_url': PAGE, 'primary_api_error': api_error})
        third['source_document'] = archive(data_dir, raw_source, '.json' if transport == 'public_verification_api' else '.html')
        i = issuer.get('issuer') or {}
        snapshot = {'schema_version': 'frxusd-evidence-snapshot/1', 'asset': 'frxusd', 'producer': 'backing-monitor',
                    'retrieved_at': now_iso, 'formulas': FORMULAS,
                    'freshness_policy': {'max_run_age_hours': MAX_RUN_AGE_HOURS, 'max_position_age_hours': MAX_POSITION_AGE_HOURS},
                    'issuer_reported': {'owner': 'PegTracker', 'health': issuer_health, 'observed_at': (issuer.get('status') or {}).get('served_snapshot_effective_at') or issuer.get('timestamp'),
                                        'source': i.get('source'), 'reserves': i.get('reserves'), 'liabilities': i.get('liabilities'),
                                        'metrics': {'assets_usd': i.get('total_assets_usd'), 'liabilities_usd': i.get('total_liabilities_usd'),
                                                    'coverage_pct': i.get('coverage_ratio'), 'coverage_basis': i.get('coverage_ratio_basis')}},
                    'independently_measured': {'owner': 'backing-monitor existing verifier', 'health': independent_health,
                                               'observed_at': (independent.get('observation') or {}).get('block_timestamp'), 'evidence': independent},
                    'third_party_verified': third}
        for key in ['issuer_reported', 'independently_measured']:
            source = snapshot[key]
            clock = source.get('observed_at')
            try: age = (now - parse_stamp(clock)).total_seconds() / 3600 if clock else None
            except (ValueError, TypeError): age = None
            source['health'].update({'observation_age_hours': age, 'stale_after_hours': 24, 'clock_status': 'unknown' if age is None else 'future' if age < -5/60 else 'stale' if age > 24 else 'within_age_limit'})
        snapshot['comparisons'] = compare(snapshot)
        raw = canonical(snapshot)
        sha = digest(raw)
        snapshot_path = data_dir / 'frxusd_evidence_snapshots' / (sha + '.json')
        if snapshot_path.exists() and snapshot_path.read_bytes() != raw:
            raise RuntimeError('Immutable snapshot collision')
        if not snapshot_path.exists():
            atomic(snapshot_path, raw)
        package = {'schema_version': 'frxusd-backing-evidence/1', 'asset': 'frxusd', 'status': 'accepted',
                   'snapshot_id': 'sha256:' + sha, 'snapshot_sha256': sha,
                   'snapshot_path': 'data/frxusd_evidence_snapshots/' + sha + '.json',
                   'last_attempt_at': now_iso, 'last_success_at': now_iso, 'served_is_last_good': False,
                   'upstream_observed_at': third['observed_at'], 'upstream_health': 'validated_fallback' if transport == 'embedded_next_data_fallback' else 'validated', 'error': None}
        history_path = data_dir / 'frxusd_evidence_history.json'
        history = json.loads(history_path.read_text()) if history_path.exists() else {'schema_version': 'frxusd-evidence-history/1', 'entries': []}
        # Genuine source-run clocks only; no synthetic historical coverage.
        if not any(r.get('source_document_sha256') == third['source_document']['sha256'] for r in history['entries']):
            history['entries'].append({'observed_at': third['observed_at'], 'retrieved_at': now_iso,
                                       'source_document_sha256': third['source_document']['sha256'],
                                       'same_run_source_revision': any(r['observed_at'] == third['observed_at'] for r in history['entries']),
                                       'snapshot_id': package['snapshot_id'], 'snapshot_path': package['snapshot_path']})
            history['entries'].sort(key=lambda r: r['observed_at'])
        atomic(history_path, canonical(history))
    except Exception as exc:
        package = {**previous, 'schema_version': 'frxusd-backing-evidence/1', 'asset': 'frxusd',
                   'status': 'degraded_last_good' if previous.get('snapshot_id') else 'unavailable',
                   'last_attempt_at': now_iso, 'served_is_last_good': bool(previous.get('snapshot_id')),
                   'upstream_health': 'stale' if isinstance(exc, StaleSource) else 'schema_changed' if isinstance(exc, SchemaChanged) else 'fetch_or_producer_failed',
                   'error': type(exc).__name__ + ': ' + str(exc)[:220]}
    package['stale_after_hours'] = MAX_RUN_AGE_HOURS
    package['source_age_hours'] = ((now - parse_stamp(package['upstream_observed_at'])).total_seconds() / 3600
                                   if package.get('upstream_observed_at') else None)
    atomic(target, canonical(package))
    return package


def compare(snapshot):
    third = snapshot['third_party_verified']
    metrics = snapshot['issuer_reported']['metrics']
    measured = snapshot['independently_measured']['evidence']
    def identity(chain, holder, token):
        norm = lambda x: x.lower() if isinstance(x, str) and x.startswith('0x') else x
        return (ALIASES.get(chain, chain), norm(holder), norm(token))
    matches = []
    for r in measured.get('reserve_balances') or []:
        key = identity(r.get('chain'), r.get('holder'), r.get('asset_discovered') or r.get('expected_token'))
        candidates = [p for p in third['positions'] if identity(p['chain'], p['holder_address'], p['token_address']) == key]
        # The independent verifier has no strategy identifier: publish candidate IDs,
        # but refuse ambiguous matches rather than aggregating same-symbol accounts.
        p = candidates[0] if len(candidates) == 1 else None
        matches.append({'independent_row_id': r.get('id'), 'third_party_position_ids': [p['position_id'] for p in candidates],
                        'status': 'matched_identity_different_observation_clocks' if p else 'ambiguous_or_unmatched',
                        'quantity_delta_third_party_minus_independent': p['quantity'] - r['quantity'] if p and isinstance(r.get('quantity'), (int, float)) else None})
    return {'basis': 'Different observation clocks; deltas are not same-block audit discrepancies',
            'source_clocks': {k: snapshot[k].get('observed_at') for k in ['issuer_reported', 'independently_measured', 'third_party_verified']},
            'asset_delta_third_party_minus_issuer_usd': third['metrics']['reserves_usd'] - metrics['assets_usd'] if isinstance(metrics['assets_usd'], (int, float)) else None,
            'position_matches': matches,
            'independent_global_coverage_pct': (measured.get('coverage') or {}).get('independent_coverage_pct')}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir', type=pathlib.Path, default=DATA)
    args = parser.parse_args()
    result = refresh(args.output_dir)
    print(json.dumps(result, indent=2))
    return 0 if result['status'] == 'accepted' else 1


if __name__ == '__main__':
    raise SystemExit(main())
