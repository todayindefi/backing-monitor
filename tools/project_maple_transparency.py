#!/usr/bin/env python3
"""Public projections of qualified normal Maple reports. No fetching or scoring."""
import argparse
import copy
import hashlib
import json
from pathlib import Path

def clean(value):
    if isinstance(value, list):
        return [clean(v) for v in value]
    if not isinstance(value, dict):
        return value
    result = {}
    for key, item in value.items():
        if key in {'raw_source', 'source_text', 'display_cells', 'legacy_economic_classification'}:
            continue
        if key == 'legacy_currentAssetAmount_model':
            result[key] = {'status': item.get('status'), 'audit_scope': 'Withdrawn model retained in private evidence; none of its values are active collateral data.'}
        else:
            result[key] = clean(item)
    return result

def project(report, previous, report_base="https://staging.tidresearch.com/reports") :
    result = clean(copy.deepcopy(report))
    specific = result['asset_specific']
    original = report['asset_specific']
    source = specific['issuer_transparency']
    source.pop('loan_rows', None)
    source.pop('queue_and_tooltips', None)
    inventory = original['issuer_transparency'].get('collateral_wallet_inventory', [])
    links = {link for group in inventory for link in group.get('links', [])}
    source.pop('collateral_wallet_inventory', None)
    source['collateral_wallet_inventory_summary'] = {'reported_wallet_link_count': len(links), 'loan_allocation': None, 'title_or_control_verified': False, 'basis': 'Publisher-reported inventory, not a current ownership or allocation verification'}
    for field in ['queue_review']:
        if field in previous['asset_specific']:
            specific[field] = copy.deepcopy(previous['asset_specific'][field])
    groups = {}
    for loan in specific['loan_book']['loans']:
        c = loan.get('collateral') or {}
        if c.get('usd_source') == 'issuer_transparency_ssr' and c.get('usd') is not None:
            key = (str(loan.get('borrower', '')).lower(), c.get('asset'), str(c['usd']))
            groups[key] = groups.get(key, 0) + 1
    specific['credit_reading_coverage'] = {'schema_version': 'syrup-credit-reading-coverage/2', 'repeated_reading_group_count': sum(n > 1 for n in groups.values()), 'repetition_basis': 'Equal issuer-reported collateral values for the same borrower and asset; separate allocation is unverified', 'independent_allocation_verified': False}
    result['report_url'] = report_base.rstrip('/') + '/' + result['asset_slug'] + '/'
    result.setdefault('issuer', {})['report_url'] = result['report_url']
    return result

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--previous', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    out = args.output.resolve()
    if '.private-reviews' not in out.parts and not out.is_relative_to(Path('/tmp')):
        raise ValueError('Review/staging output only')
    (out / 'data').mkdir(parents=True, exist_ok=True)
    manifest = {'schema_version': 'maple-transparency-public-projection/1', 'source': 'Qualified existing normal producer functions; no source valuation rewritten or score authored', 'files': {}, 'scope_limits': ['Issuer values, not independent recovery NAV', 'Native, issuer retrieval and unknown upstream valuation clocks remain separate', 'Prior model data retired; raw dossiers remain private', 'No production or schedule changes']}
    for slug in ['syrupusdc', 'syrupusdt']:
        path = args.source / (slug + '-full-staged.json')
        raw = path.read_bytes()
        previous = json.loads((args.previous / 'data' / (slug + '_backing.json')).read_text())
        projected = project(json.loads(raw), previous)
        body = (json.dumps(projected, indent=2, ensure_ascii=False, allow_nan=False) + '\n').encode()
        for forbidden in [b'/home/', b'.private-reviews', b'"raw_source"', b'"private_wallet"', b'"account_address"', b'"private_holdings"']:
            if forbidden in body:
                raise ValueError('Private path/raw dossier in public projection')
        dest = out / 'data' / (slug + '_backing.json')
        if dest.exists() and dest.read_bytes() != body:
            raise ValueError('Projection version immutable; use a new output')
        dest.write_bytes(body)
        manifest['files'][dest.name] = {'source_report_sha256': hashlib.sha256(raw).hexdigest(), 'sha256': hashlib.sha256(body).hexdigest(), 'bytes': len(body), 'publisher_retrieved_at': projected['asset_specific']['issuer_transparency']['retrieved_at'], 'publisher_financial_observed_at': None}
    family_path = args.source / 'syrup-family-full-staged.json'
    if family_path.exists():
        raw = family_path.read_bytes()
        family = clean(json.loads(raw))
        assert family['combined']['independent_credit_nav'] is None
        assert all(p['pool_collateral_value_usd'] is None for p in family['pools'])
        body = (json.dumps(family, indent=2, ensure_ascii=False, allow_nan=False) + '\n').encode()
        for forbidden in [b'/home/', b'.private-reviews', b'"raw_source"', b'"private_holdings"']:
            if forbidden in body:
                raise ValueError('Private family field in public projection')
        dest = out / 'data' / 'syrup_family.json'
        if dest.exists() and dest.read_bytes() != body:
            raise ValueError('Family projection immutable; use new output')
        dest.write_bytes(body)
        manifest['files'][dest.name] = {'source_report_sha256': hashlib.sha256(raw).hexdigest(), 'sha256': hashlib.sha256(body).hexdigest(), 'bytes': len(body), 'publisher_retrieved_at_by_pool': family['combined']['source_retrieved_at_by_pool'], 'publisher_financial_observed_at': None}
    (out / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(out / 'manifest.json')
