#!/usr/bin/env python3
"""Build a review-only GHO projection from existing producer observations.

This is a consumer adapter, not a primary backing collector. No producer writes,
live registration, score migration, recurring jobs, or public publication.
"""
import argparse
import hashlib
import json
import math
from datetime import datetime, timezone
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
PEG = Path('/home/danger/PegTracker/data')
TOKEN = '0x40D16FC0246aD3160Ccc09B8D0D3A2cD28aE6C2f'


def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def instant(value):
    try:
        stamp = datetime.fromisoformat(value.replace('Z', '+00:00'))
        if stamp.tzinfo is None:
            return None
        return stamp.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')
    except (TypeError, ValueError, AttributeError):
        return None


def project(latest, archive):
    """Preserve measurement clocks; never infer missing source age or coverage."""
    row = latest.get('GHO', {})
    quote = row.get('liquidity') or {}
    if quote and str(quote.get('token_address', '')).lower() != TOKEN.lower():
        raise ValueError('GHO quote token identity mismatch')
    if quote and (quote.get('chain') != 'ethereum' or quote.get('sell_into') != 'USDC'):
        raise ValueError('Expected Ethereum GHO to USDC quotes')
    if row.get('symbol') != 'GHO' or row.get('chain') != 'ethereum':
        raise ValueError('Expected Ethereum GHO observation')
    # The top-level contract_address is an oracle address, NOT the GHO token.
    observed = instant(row.get('timestamp'))
    if observed is None:
        raise ValueError('Missing timezone-qualified PegTracker row clock')
    price = row.get('market_price')
    if not finite(price) or price <= 0 or row.get('theoretical_price') != 1:
        raise ValueError('Expected positive GHO mark against explicit $1 reference')
    history = []
    rejected = {'ambiguous_or_invalid_clock': 0, 'invalid_price_or_reference': 0}
    for entry in archive.get('assets', {}).get('GHO', {}).get('history', []):
        stamp = instant(entry.get('timestamp'))
        if not stamp:
            rejected['ambiguous_or_invalid_clock'] += 1
            continue
        if not finite(entry.get('market_price')) or entry['market_price'] <= 0 or entry.get('theoretical_price') != 1:
            rejected['invalid_price_or_reference'] += 1
            continue
        history.append({'timestamp': stamp, 'peg_market_price': entry['market_price'],
                        'peg_theoretical_price': 1})
    history = sorted({entry['timestamp']: entry for entry in history}.values(), key=lambda entry: entry['timestamp'])
    gaps = [{'from': a['timestamp'], 'to': b['timestamp'], 'reason': 'More than 3 hours between recorded rows'}
            for a, b in zip(history, history[1:])
            if (datetime.fromisoformat(b['timestamp'].replace('Z', '+00:00')) -
                datetime.fromisoformat(a['timestamp'].replace('Z', '+00:00'))).total_seconds() > 10800]
    backing_reason = 'Not measured: no canonical GHO backing feed is published by PegTracker. Facilitator caps and token supply alone do not establish collateral coverage.'
    quote_rows = []
    for size, item in quote.get('quotes', {}).items():
        try:
            amount = float(size)
        except (TypeError, ValueError):
            continue
        output = item.get('output_usd')
        if not finite(amount) or amount <= 0 or not finite(output) or output < 0:
            continue
        quote_rows.append({'input_notional_usd': amount, 'output_usdc': output,
                           'market_notional_cost_bps': (1 - output / amount) * 10000,
                           'impact_bps': -item['slippage_bps'] if finite(item.get('slippage_bps')) else None})
    quote_rows.sort(key=lambda item: item['input_notional_usd'])
    quote_time = instant(quote.get('timestamp'))
    if quote_rows and not quote_time:
        raise ValueError('Quote rows require their own observation clock')
    freshness = row.get('price_staleness_basis') or 'The upstream price timestamp is not supplied. Row write time does not establish market-price freshness.'
    history_note = ('Recorded PegTracker marks; timestamps date tracker observations, not necessarily oracle updates. '
                    f"Excluded {rejected['ambiguous_or_invalid_clock']} rows with ambiguous or invalid clocks and "
                    f"{rejected['invalid_price_or_reference']} rows with invalid prices or references. Gaps are not interpolated.")
    feed = {
        'schema_version': 1, 'asset': 'GHO', 'asset_slug': 'gho', 'chain': 'Ethereum; remote mechanisms not refreshed',
        'timestamp': observed, 'preview_only': True, 'producer': 'backing-monitor consumer preview adapter',
        'summary': {'collateral_ratio': None, 'total_backing': None}, 'backing_breakdown': [], 'risk_flags': [],
        'peg': {'as_of': observed, 'market_price': price, 'market_price_source': row.get('market_price_source'),
                'market_price_as_of': instant(row.get('market_price_as_of')), 'nav': 1,
                'nav_source': 'PegTracker fixed USD reference', 'nav_basis': '$1 USD par target; not a promise of holder redemption',
                'nav_as_of': observed, 'premium_discount_pct': (price - 1) * 100,
                'source': 'PegTracker recorded market vs $1 par', 'history_ref': 'gho_peg_history.json',
                'history_field': 'peg_market_price', 'chart_window_days': 7,
                'note': freshness, 'history_coverage': history_note},
        'backing': {'as_of': None, 'collateral_ratio': None, 'collateral_ratio_basis': backing_reason},
        'liquidity': {'as_of': quote_time, 'derived_score': None, 'derived_score_status': 'not_computed',
                      'primary_redemption_depth_status': 'not_measured',
                      'exit_mark': {
                          'as_of': quote_time, 'source': quote.get('source'), 'chain': 'ethereum',
                          'sell_into': 'USDC', 'slippage_bps_basis': quote.get('slippage_bps_basis'),
                          'scope': 'Ethereum GHO to USDC quote samples only; venue inventory and primary redemption are not measured.',
                          'basis_note': 'Market-sized USD notionals, not GHO token counts. Observed floor only; crossing and maximum exit size are not measured.',
                          'quotes': {str(item['input_notional_usd']).removesuffix('.0'): {
                              'output_usd': item['output_usdc'],
                              'slippage_bps': -item['impact_bps'] if item['impact_bps'] is not None else None,
                              'fill_ratio': item['output_usdc'] / item['input_notional_usd']
                          } for item in quote_rows}},
                      'primary_redemption_note': 'Current GSM execution and holder eligibility are not integrated. Ethereum and remote deployments require separate measurements.'},
        'dependencies': {'as_of': None, 'upstream': [], 'downstream_tracked': False},
        'contract': {'as_of': None, 'layers': [], 'unresolved': ['No current producer authority walk or code-risk overlay is integrated. Historical Monad audit is not a current all-chain assessment.']},
        'issuer': {'as_of': None, 'entity': 'Aave DAO', 'issuer_score': None},
        'asset_specific': {'type': 'gho', 'gho': {'schema_version': 'gho-preview-detail/1',
            'price_clock_note': freshness, 'row_observed_at': observed,
            'quote_observed_at': quote_time, 'quote_source': quote.get('source'),
            'quote_basis': quote.get('slippage_bps_basis'), 'quotes': quote_rows,
            'quote_sizing_basis': quote.get('fair_value_basis'), 'quote_sizing_price': quote.get('fair_value'),
            'backing_gap': backing_reason,
            'history_exclusions': rejected,
            'gaps': {
                'peg': 'Independent price cross-check is not integrated. Recorded history does not establish source update freshness.',
                'backing': 'Supply, facilitator composition, collateral look-through and coverage history await the canonical producer. No current reserve allocation is established.',
                'liquidity': 'Depth crossing and complete venue enumeration are not measured. The displayed quotes establish no maximum exit size. GSM inventory, fees, status and eligibility require current chain-specific probes.',
                'dependencies': 'Current upstream exposures and downstream usage are not integrated; missing measurements do not mean zero exposure. Dependency score awaits a current authored assessment.',
                'contract': 'Current code/audit coverage, mint roles, upgrade paths, emergency powers, enforceable delays and authority scope are not assessed.',
                'issuer': 'Current issuer assessment and governance changes since September 23 await producer review. The older report is not a refreshed assessment.'}}}
    }
    if isinstance(quote.get('depth_50bps'), dict):
        feed['liquidity']['depth_50bps'] = quote['depth_50bps']
        feed['liquidity']['adaptive_policy'] = quote.get('adaptive_policy')
        feed['liquidity']['exit_mark']['basis_note'] = ('Market-sized USD notionals, not GHO token counts. '
            + quote['depth_50bps']['basis'])
        feed['liquidity']['exit_mark']['quotes'] = quote['quotes']
    return feed, {'asset': 'GHO', 'asset_slug': 'gho', 'entries': history,
                  'coverage_gaps': gaps, 'history_coverage': history_note, 'excluded_rows': rejected}


def add_diagnostics(feed, state):
    """Display existing collector results without making them canonical backing."""
    if not instant(state.get('timestamp')):
        raise ValueError('Diagnostic collector must supply a qualified run timestamp')
    detail = feed['asset_specific']['gho']
    supply = state.get('supply') or {}
    sources = state.get('source_freshness') or {}
    api = sources.get('tokenlogic_native') or {}
    detail['diagnostics'] = {
        'collector_run_started_at': state['timestamp'],
        'scope_note': 'One-off tokenAnalyst collector results, not the canonical backing feed. RPC calls are not block-pinned; the run timestamp is not a source observation time. No solvency ratio or executable redemption capacity is inferred.',
        'total_supply': supply.get('total_supply'),
        'onchain_source': sources.get('onchain_native'),
        'api_metrics': supply.get('tokenlogic_metrics') or {},
        'api_metrics_as_of': (api.get('timestamps') or {}).get('gho_metrics'),
        'facilitators': supply.get('buckets') or [],
        'facilitator_clock_note': 'TokenLogic bucket rows have no per-row observation timestamp in this collector; their age and completeness are unknown. Deprecated rows remain labelled. This mixed-chain list is not an additive supply or backing allocation.',
        'gsm': supply.get('gsm_onchain') or {},
        'gsm_clock_note': 'Discovery uses the current Ethereum registry. Per-read source timestamps and block identifiers are not retained by this collector. Status and inventory reads do not prove a successful holder swap.',
        'curve_price': next((coin.get('price') for coin in (state.get('peg') or {}).get('curve_coin_details', [])
                             if str(coin.get('address', '')).lower() == TOKEN.lower()), None),
        'curve_source': sources.get('curve_tracker') or {},
        'curve_tvl': (state.get('peg') or {}).get('curve_tvl'),
    }
    if finite(detail['diagnostics']['curve_price']):
        detail['gaps']['peg'] = 'CurveTracker supplies a second recorded GHO mark below. The oracle update time remains unknown, so the two marks are not a synchronized price verification.'
    if (supply.get('gsm_onchain') or {}).get('contracts'):
        detail['gaps']['liquidity'] = 'Depth crossing and complete venue enumeration remain unmeasured. Current Ethereum registry diagnostics are shown below; holder swap execution, eligibility and remote-chain GSMs are not verified.'


def select_backing(directory):
    manifest = json.loads((directory / 'manifest.json').read_text())
    if manifest.get('producer') != 'PegTracker' or manifest.get('staged_only') is not True:
        raise ValueError('Expected a staged PegTracker source manifest')
    selected = {}
    for name in ['gho_backing.json', 'gho_backing_history.json', 'gho_backing_evidence.json']:
        raw = (directory / name).read_bytes()
        info = manifest['files'][name]
        if hashlib.sha256(raw).hexdigest() != info['sha256'] or len(raw) != info['bytes']:
            raise ValueError('Canonical backing source integrity mismatch: ' + name)
        selected[name] = json.loads(raw)
    feed = selected['gho_backing.json']
    detail = feed.get('asset_specific', {}).get('gho_backing', {})
    if (feed.get('asset_slug') != 'gho' or feed.get('producer') != 'PegTracker'
            or detail.get('schema_version') != 'gho-backing-detail/1' or detail.get('chain_id') != 1
            or not instant(detail.get('as_of')) or detail.get('block_hash') != manifest.get('block_hash')):
        raise ValueError('Canonical GHO identity or observation scope mismatch')
    for section in ['backing', 'summary']:
        if any(feed.get(section, {}).get(field) is not None for field in ['collateral_ratio', 'total_backing']):
            raise ValueError('This source contract does not establish independent coverage')
    return selected, manifest


def select_remaining_axes(directory):
    manifest = json.loads((directory / 'manifest.json').read_text())
    raw = (directory / 'gho_remaining_axes.json').read_bytes()
    info = manifest['files']['gho_remaining_axes.json']
    if hashlib.sha256(raw).hexdigest() != info['sha256'] or len(raw) != info['bytes']:
        raise ValueError('Remaining-axes integrity mismatch')
    axes = json.loads(raw)
    if (axes.get('schema_version') != 'gho-remaining-axes/1' or axes.get('asset_slug') != 'gho'
            or axes.get('producer') != 'backing-monitor evidence candidate'
            or axes.get('owner_approved') is not False or axes.get('staged_only') is not True):
        raise ValueError('Remaining-axes identity or review status mismatch')
    for axis, score in [('dependencies', 'underlying_score'), ('contract', 'structural_score'), ('issuer', 'issuer_score')]:
        if axes[axis].get(score) is not None:
            raise ValueError('Unapproved remaining-axes candidate cannot supply current scores')
    for source in manifest.get('sources', []):
        source_path = (directory / source['file']).resolve()
        if directory.resolve() not in source_path.parents or hashlib.sha256(source_path.read_bytes()).hexdigest() != source['sha256']:
            raise ValueError('Remaining-axes source integrity mismatch')
    return axes, manifest


def select_score_review(directory, input_path):
    manifest = json.loads((directory / 'manifest.json').read_text())
    if manifest.get('producer') != 'riskanalyst' or manifest.get('staged_only') is not True:
        raise ValueError('Score review must be a staged riskAnalyst return')
    selected = {}
    for name in ('review.json', 'gho_dependencies.json', 'gho_issuer.json'):
        raw = (directory / name).read_bytes()
        if hashlib.sha256(raw).hexdigest() != manifest['files'].get(name):
            raise ValueError('Score-review integrity mismatch: ' + name)
        selected[name] = json.loads(raw)
    review = selected['review.json']
    if (review.get('schema_version') != 'gho-score-review/1' or review.get('producer') != 'riskanalyst'
            or review.get('input_manifest_verified') is not True or not instant(review.get('reviewed_at'))
            or review.get('input_sha256') != hashlib.sha256(input_path.read_bytes()).hexdigest()
            or review.get('decisions', {}).get('structural_score') is not None
            or review.get('decisions', {}).get('structural_status') != 'withheld_pending_code_and_authority_completion'):
        raise ValueError('Score review does not match the selected evidence or Axis 5 hold')
    for name, axis, schema, score in [('gho_dependencies.json', 'dependencies', 'dependencies/1', 'underlying_score'),
                                       ('gho_issuer.json', 'issuer', 'issuer/1', 'issuer_score')]:
        overlay = selected[name]
        block = overlay.get(axis, {})
        value = block.get(score)
        if (overlay.get('schema_version') != schema or overlay.get('producer') != 'riskanalyst'
                or overlay.get('asset') != 'gho' or overlay.get('staged_only') is not True
                or not finite(value) or not 0 <= value <= 10
                or value != review['decisions'].get(score) or not block.get('score_rationale')):
            raise ValueError('Invalid reviewed overlay: ' + name)
    return selected, manifest


def select_axis5_candidate(directory):
    manifest = json.loads((directory / 'manifest.json').read_text())
    if manifest.get('schema_version') != 'gho-axis5-candidate-manifest/1' or manifest.get('score_adopted') is not False:
        raise ValueError('Invalid Axis 5 candidate manifest')
    required = {'gho_axis5_assessment.json', 'accepted-authority/manifest.json', 'authority-acceptance-receipt.json'}
    if not required.issubset(manifest.get('files', {})):
        raise ValueError('Axis 5 candidate lacks hashed evidence')
    for name, info in manifest['files'].items():
        path = (directory / name).resolve()
        if directory.resolve() not in path.parents:
            raise ValueError('Unsafe Axis 5 evidence path')
        raw = path.read_bytes()
        if hashlib.sha256(raw).hexdigest() != info['sha256'] or len(raw) != info['bytes']:
            raise ValueError('Axis 5 evidence integrity mismatch: ' + name)
    candidate = json.loads((directory / 'gho_axis5_assessment.json').read_text())
    if (candidate.get('schema_version') != 'gho-axis5-assessment/1' or candidate.get('asset_slug') != 'gho'
            or candidate.get('producer') != 'Codex staged assessment for riskAnalyst'
            or candidate.get('authority_accepted') is not True or candidate.get('score_adopted') is not False
            or candidate.get('contract', {}).get('structural_score') is not None
            or not finite(candidate.get('contract', {}).get('proposed_structural_score'))):
        raise ValueError('Axis 5 proposal cannot supply an adopted structural score')
    if hashlib.sha256((directory / 'accepted-authority/manifest.json').read_bytes()).hexdigest() != candidate['authority_manifest_sha256']:
        raise ValueError('Axis 5 authority manifest identity mismatch')
    if hashlib.sha256((directory / 'authority-acceptance-receipt.json').read_bytes()).hexdigest() != candidate['acceptance_receipt_sha256']:
        raise ValueError('Axis 5 authority receipt identity mismatch')
    return candidate, manifest


def adopt_axis5_in_staged_preview(candidate, candidate_path, receipt_path):
    receipt = json.loads(receipt_path.read_text())
    if (receipt.get('schema_version') != 'gho-axis5-staged-adoption/1' or receipt.get('asset_slug') != 'gho'
            or receipt.get('authorized_by') != 'user' or receipt.get('scope') != 'staged_dashboard_only'
            or receipt.get('publication_authorized') is not False or not instant(receipt.get('adopted_at'))
            or receipt.get('candidate_sha256') != hashlib.sha256(candidate_path.read_bytes()).hexdigest()
            or receipt.get('structural_score') != candidate['contract']['proposed_structural_score']
            or not receipt.get('structural_score_basis')):
        raise ValueError('Staged Axis 5 adoption does not match the authorized assessment')
    # Preserve the frozen producer proposal; adoption belongs to this consumer's staged selection.
    adopted = json.loads(json.dumps(candidate))
    adopted['score_adopted'] = True
    adopted['contract']['method'] = adopted['contract'].get('method', '').replace('assessment candidate', 'assessment')
    adopted['contract'].update({
        'structural_score': receipt['structural_score'],
        'structural_score_status': 'adopted_staged',
        'structural_score_source': 'Codex:authored; user-adopted staged dashboard',
        'structural_score_generated_at': receipt['adopted_at'],
        'structural_score_basis': receipt['structural_score_basis'],
        'coverage_summary': 'Next eligible increase adds 310m GHO capacity; repeated eligible increases can add more. Authorized capability, not evidence of exploitation. Combined 4.0/10 adopted for this staged dashboard.',
    })
    return adopted, receipt


def assemble(out, peg_root=PEG, state_path=None, report_check=None, backing_dir=None, coverage_dir=None, ladder_path=None, remaining_axes_dir=None, score_review_dir=None, axis5_candidate_dir=None, axis5_adoption_path=None):
    out = out.resolve()
    if out == ROOT or ROOT in out.parents or out == Path('/') or out in ROOT.parents:
        raise ValueError('Preview must be outside the serving repository and its ancestors')
    out.mkdir(parents=True, exist_ok=True)
    data_dir = out / 'data'
    data_dir.mkdir(exist_ok=True)
    allowed = {'assets.json', 'gho_backing.json', 'gho_peg_history.json', 'gho_backing_history.json', 'gho_reported_coverage_history.json'}
    if any(path.name not in allowed for path in data_dir.iterdir()):
        raise ValueError('Preview data contains unselected files; use a clean output directory')
    manifest = {'preview_only': True, 'generated_at': datetime.now(timezone.utc).isoformat(), 'sources': []}
    inputs = []
    for name in ['peg_tracker_latest_usd.json', 'peg_tracker_history.json']:
        source = peg_root / name
        raw = source.read_bytes()
        inputs.append(json.loads(raw))
        dest = out / 'evidence' / 'pegtracker' / name
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(raw)
        manifest['sources'].append({'path': str(source), 'evidence_path': str(dest.relative_to(out)),
                                    'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw)})
    if ladder_path:
        raw = ladder_path.read_bytes()
        ladder = json.loads(raw)
        if (ladder.get('asset') != 'GHO' or ladder.get('chain') != 'ethereum'
                or ladder.get('token_address', '').lower() != TOKEN.lower()
                or ladder.get('sell_into') != 'USDC' or ladder.get('producer') != 'PegTracker'
                or ladder.get('staged_only') is not True or not instant(ladder.get('timestamp'))
                or not 1 <= len(ladder.get('quotes', {})) <= 7
                or ladder.get('adaptive_policy', {}).get('max_requests') != 7
                or ladder.get('adaptive_policy', {}).get('requests_used') != len(ladder['quotes'])
                or ladder.get('depth_50bps', {}).get('threshold_bps') != 50):
            raise ValueError('Invalid adaptive GHO ladder identity, clock or request budget')
        depth = ladder['depth_50bps']
        if depth.get('status') == 'not_measured' or depth.get('depth_usd') is None:
            raise ValueError('Adaptive ladder has no valid depth; retain previous preview and inspect failed candidate')
        lower = ladder['quotes'].get(str(depth['depth_usd']), {})
        if (not finite(lower.get('slippage_bps')) or lower['slippage_bps'] < -50
                or depth.get('clearing_impact_bps') != -lower['slippage_bps']):
            raise ValueError('Adaptive clearing endpoint is not a measured quote within 50 bps')
        if depth.get('status') == 'bracketed':
            bracket = depth.get('bracket')
            upper = ladder['quotes'].get(str(bracket[1]), {}) if isinstance(bracket, list) and len(bracket) == 2 else {}
            if (not upper or bracket[0] != depth['depth_usd'] or bracket[0] >= bracket[1]
                    or not finite(upper.get('slippage_bps')) or upper['slippage_bps'] >= -50):
                raise ValueError('Adaptive crossing bracket lacks tested endpoints')
        inputs[0]['GHO']['liquidity'] = ladder
        dest = out / 'evidence/pegtracker-adaptive-ladder.json'
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(raw)
        manifest['sources'].append({'path': str(ladder_path), 'evidence_path': str(dest.relative_to(out)),
                                    'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw),
                                    'role': 'staged_adaptive_exit_ladder'})
    feed, history = project(*inputs)
    if state_path:
        raw = state_path.read_bytes()
        state = json.loads(raw)
        add_diagnostics(feed, state)
        dest = out / 'evidence/tokenanalyst-state.json'
        dest.write_bytes(raw)
        manifest['sources'].append({'path': str(state_path), 'evidence_path': str(dest.relative_to(out)),
                                    'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw),
                                    'role': 'one_off_diagnostics_not_canonical_backing'})
    backing_history = {'entries': []}
    if backing_dir:
        selected, owner_manifest = select_backing(backing_dir)
        canonical = selected['gho_backing.json']
        feed['summary'] = canonical['summary']
        feed['backing'] = canonical['backing']
        feed['asset_specific']['gho_backing'] = canonical['asset_specific']['gho_backing']
        if canonical['asset_specific']['gho_backing'].get('reconciliation'):
            feed['chain'] = 'Ethereum + remote GSM reserves'
        detail = feed['asset_specific']['gho']
        detail['gaps']['backing'] = ('TokenLogic source collateral and three remote reserve ledgers reconcile below. Independent liquidation value, original bridge funding receipts and small lending-book residuals remain unverified.'
            if canonical['asset_specific']['gho_backing'].get('reconciliation') else
            'Ethereum issuance, lending claims and GSM wrapper inventory are block-pinned below. Independent collateral coverage, borrower look-through and remote reserves remain unresolved.')
        detail['gaps']['liquidity'] = 'Ethereum GSM inventory is block-pinned in Backing. Current holder swap execution, eligibility, exit-depth crossing and complete venue enumeration remain unverified.'
        if detail.get('diagnostics'):
            detail['diagnostics']['backing_superseded'] = True
            detail['diagnostics']['gsm'] = {}
        backing_history = selected['gho_backing_history.json']
        destination = out / 'evidence/pegtracker-backing'
        destination.mkdir(exist_ok=True)
        for name in list(selected) + ['manifest.json']:
            shutil.copy2(backing_dir / name, destination / name)
        manifest['sources'].append({'path': str(backing_dir), 'role': 'staged_canonical_backing_candidate',
                                    'manifest': owner_manifest, 'evidence_path': str(destination.relative_to(out))})
    if report_check:
        raw = report_check.read_bytes()
        check = json.loads(raw)
        if (check.get('url') != 'https://tidresearch.com/reports/gho/' or check.get('status') != 200
                or check.get('heading') != 'GHO — Risk Report' or not instant(check.get('verified_at'))):
            raise ValueError('Expected successful browser verification of the GHO report')
        feed['issuer'].update({'report_url': check['url'], 'report_url_status': 'published'})
        feed['asset_specific']['gho']['report'] = {
            'url': check['url'], 'verified_at': check['verified_at'],
            'note': 'Historical report, revised September 8. Its legacy-GSM findings are not a current assessment of the registry-discovered RemoteGSMs.'}
        (out / 'evidence/report-browser-check.json').write_bytes(raw)
        manifest['sources'].append({'path': str(report_check), 'evidence_path': 'evidence/report-browser-check.json',
                                    'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw)})
    if coverage_dir:
        name = 'gho_reported_coverage_history.json'
        raw = (coverage_dir / name).read_bytes()
        source_manifest = json.loads((coverage_dir / 'manifest.json').read_text())
        info = source_manifest['files'][name]
        coverage = json.loads(raw)
        if (source_manifest.get('producer') != 'PegTracker' or coverage.get('asset_slug') != 'gho'
                or coverage.get('schema_version') != 'reported-coverage-history/1' or not coverage.get('entries')
                or hashlib.sha256(raw).hexdigest() != info['sha256'] or len(raw) != info['bytes']):
            raise ValueError('Coverage history source identity or integrity mismatch')
        analytics = feed['asset_specific'].get('gho_backing', {}).get('reconciliation', {}).get('analytics', {})
        latest = coverage['entries'][-1]
        if (latest['source_date'] != analytics.get('source_date')
                or abs(latest['reported_collateral_ratio'] - analytics.get('oracle_coverage_pct', 0)) > 1e-8):
            raise ValueError('Coverage chart latest observation differs from displayed ratio')
        (data_dir / name).write_bytes(raw)
        feed['asset_specific']['gho']['coverage_history_ref'] = name
        feed['asset_specific']['gho']['coverage_composition'] = coverage.get('latest_composition')
        feed['peg']['chart_min_points'] = 2
        feed['peg']['chart_strict_window'] = True
        manifest['sources'].append({'path': str(coverage_dir), 'role': 'reported_coverage_history', 'manifest': source_manifest})
    if ladder_path:
        feed['asset_specific']['gho']['gaps']['liquidity'] = (
            'Adaptive quote samples locate the displayed bracket or floor; no exact 50 bps execution size is claimed. '
            'Gas is excluded. Complete venue enumeration, current primary redemption execution and holder eligibility remain unmeasured.')
    if remaining_axes_dir:
        axes, axes_manifest = select_remaining_axes(remaining_axes_dir)
        for axis in ('dependencies', 'contract', 'issuer'):
            # Report link verification remains separately sourced and timestamped.
            feed[axis].update(axes[axis])
        detail = feed['asset_specific']['gho']
        detail['remaining_axes_status'] = {'owner_approved': False, 'generated_at': axes['generated_at']}
        detail['gaps']['dependencies'] = axes['dependencies']['coverage_note']
        detail['gaps']['contract'] = axes['contract']['coverage_note']
        detail['gaps']['issuer'] = 'Current issuer research is a sourced, unrated candidate. It is not a producer-approved report refresh. Historical rationale and score remain separately dated; no current legal/regulatory or par-redemption guarantee is established.'
        destination = out / 'evidence/remaining-axes'
        shutil.copytree(remaining_axes_dir, destination, dirs_exist_ok=True)
        manifest['sources'].append({'path': str(remaining_axes_dir), 'role': 'remaining_axes_evidence_candidate',
                                    'manifest': axes_manifest, 'owner_approved': False})
    if score_review_dir:
        if not remaining_axes_dir:
            raise ValueError('Score review requires its selected remaining-axes input')
        selected, review_manifest = select_score_review(score_review_dir, remaining_axes_dir / 'gho_remaining_axes.json')
        review = selected['review.json']
        for name, axis, score in [('gho_dependencies.json', 'dependencies', 'underlying_score'), ('gho_issuer.json', 'issuer', 'issuer_score')]:
            feed[axis] = selected[name][axis].copy()
            feed[axis][score + '_basis'] = feed[axis]['score_rationale']
            feed[axis][score + '_source'] = 'riskAnalyst:authored'
            feed[axis][score + '_generated_at'] = review['reviewed_at']
        # The peer return explicitly withholds Axis 5; never inherit its historical 6.0.
        feed['contract']['structural_score'] = None
        feed['contract']['structural_score_status'] = review['decisions']['structural_status']
        feed['contract']['code_review_status'] = review['axis5']['code_half']
        feed['contract']['authority_review_status'] = review['axis5']['authority_half']
        detail = feed['asset_specific']['gho']
        detail['score_review'] = review
        detail['remaining_axes_status']['reviewed_axes'] = ['dependencies', 'issuer']
        detail['gaps']['dependencies'] = feed['dependencies']['coverage_note']
        detail['gaps']['issuer'] = 'Current riskAnalyst issuer review accepted for this staged dashboard; canonical report unchanged. Historical assessment is separate provenance.'
        detail['gaps']['contract'] = review['axis5']['combined_decision']
        destination = out / 'evidence/riskanalyst-score-review'
        destination.mkdir(parents=True, exist_ok=True)
        for name in list(selected) + ['manifest.json']:
            shutil.copyfile(score_review_dir / name, destination / name)
        manifest['sources'].append({'path': str(score_review_dir), 'role': 'reviewed_dependencies_and_issuer_only',
                                    'manifest': review_manifest, 'reviewed_at': review['reviewed_at']})
    if axis5_candidate_dir:
        candidate, candidate_manifest = select_axis5_candidate(axis5_candidate_dir)
        if axis5_adoption_path:
            candidate, adoption = adopt_axis5_in_staged_preview(candidate, axis5_candidate_dir / 'gho_axis5_assessment.json', axis5_adoption_path)
            shutil.copyfile(axis5_adoption_path, out / 'evidence/axis5-staged-adoption.json')
            manifest['sources'].append({'path': str(axis5_adoption_path), 'role': 'user_authorized_staged_axis5_adoption',
                'sha256': hashlib.sha256(axis5_adoption_path.read_bytes()).hexdigest()})
        feed['contract'] = candidate['contract']
        detail = feed['asset_specific']['gho']
        detail['axis5_assessment'] = {key: candidate[key] for key in ('authored_at', 'authority_accepted', 'score_adopted', 'authority_files_verified')}
        detail['gaps']['contract'] = 'SA measured authority paths and their gaps are accepted. Code assessment and combined 4.0/10 proposal are staged; no current numeric score is adopted. No repeat blanket authority handoff is needed.'
        if candidate['score_adopted']:
            detail['gaps']['contract'] = 'Combined Contract & Admin score 4.0/10 adopted for this staged dashboard. Remaining code/deployment and remote authority gaps are retained below; the canonical report is unchanged.'
        destination = out / 'evidence/axis5-assessment'
        shutil.copytree(axis5_candidate_dir, destination, dirs_exist_ok=True)
        manifest['sources'].append({'path': str(axis5_candidate_dir), 'role': 'accepted_authority_and_code_assessment',
                                    'manifest': candidate_manifest, 'score_adopted': candidate['score_adopted']})
    for folder in ('js', 'css'):
        shutil.copytree(ROOT / folder, out / folder, dirs_exist_ok=True)
    html = (ROOT / 'index.html').read_text()
    (out / 'index.html').write_text(html)
    asset = {'slug': 'gho', 'name': 'GHO (Aave)', 'chain': feed['chain'],
             'published': False, 'contract_address': TOKEN, 'description': 'Review preview; incomplete six-axis evidence.'}
    for name, value in [('assets.json', [asset]), ('gho_backing.json', feed),
                        ('gho_peg_history.json', history), ('gho_backing_history.json', backing_history)]:
        (data_dir / name).write_text(json.dumps(value, indent=2, allow_nan=False) + '\n')
    # Only copy explicitly chosen GHO evidence. Other assets and their overlays
    # are never inherited from a prior preview or copied from public data/.
    manifest['status'] = 'partial_evidence_preview'
    manifest['remaining_axes_owner_approved'] = False
    manifest['partially_measured_axes'] = ['dependencies', 'contract', 'issuer'] if remaining_axes_dir else []
    manifest['reviewed_axes'] = ['dependencies', 'issuer'] if score_review_dir else []
    manifest['pending_authored_scores'] = ['contract'] if score_review_dir else ['dependencies', 'contract', 'issuer']
    manifest['staged_adopted_axes'] = ['contract'] if axis5_adoption_path and axis5_candidate_dir else []
    if manifest['staged_adopted_axes']:
        manifest['pending_authored_scores'] = [axis for axis in manifest['pending_authored_scores'] if axis != 'contract']
    manifest['unmeasured_axes'] = ([] if remaining_axes_dir else ['dependencies', 'contract', 'issuer']) + ([] if backing_dir else ['backing'])
    manifest['coverage_status'] = 'not_established'
    manifest['history_rows'] = len(history['entries'])
    manifest['history_exclusions'] = history['excluded_rows']
    (out / 'selection-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps({'preview': str(out), 'history_rows': len(history['entries']),
                      'quote_rows': len(feed['asset_specific']['gho']['quotes']), 'status': manifest['status']}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, default=Path('/tmp/gho-dashboard-preview'))
    parser.add_argument('--peg-root', type=Path, default=PEG)
    parser.add_argument('--state', type=Path, help='Optional --no-write tokenAnalyst snapshot for qualified diagnostics')
    parser.add_argument('--report-check', type=Path, help='Optional successful browser report verification receipt')
    parser.add_argument('--backing-dir', type=Path, default=PEG / 'dashboard_pending/gho-reconciliation-v2',
                        help='Staged canonical PegTracker backing candidate with integrity manifest')
    parser.add_argument('--coverage-dir', type=Path, default=PEG / 'dashboard_pending/gho-coverage-history',
                        help='Staged source-qualified coverage history with integrity manifest')
    parser.add_argument('--ladder', type=Path, default=PEG / 'dashboard_pending/gho-adaptive-50bps/gho_exit_ladder.json',
                        help='Selected staged adaptive PegTracker quote artifact')
    parser.add_argument('--remaining-axes-dir', type=Path, default=Path('/home/danger/riskAnalyst/data/dashboard_pending/gho-axes-456'),
                        help='Selected source-verified axes 4–6 evidence candidate; current scores withheld')
    parser.add_argument('--score-review-dir', type=Path,
                        default=Path('/home/danger/riskAnalyst/data/reviews/gho-score-review-2026-10-30'),
                        help='Hash-verified riskAnalyst Dependencies/Issuer review; Axis 5 remains withheld')
    parser.add_argument('--axis5-candidate-dir', type=Path, default=Path('/home/danger/riskAnalyst/data/reviews/gho-axis5-assessment-2026-10-30'), help='Accepted authority plus explicitly unadopted code/score proposal')
    parser.add_argument('--axis5-adoption', type=Path, default=ROOT / 'specs/gho-axis5-staged-adoption-2026-10-30.json',
                        help='User-authorized, hash-bound adoption for the staged dashboard only')
    args = parser.parse_args()
    assemble(args.out, args.peg_root, args.state, args.report_check, args.backing_dir, args.coverage_dir, args.ladder, args.remaining_axes_dir, args.score_review_dir, args.axis5_candidate_dir, args.axis5_adoption)
