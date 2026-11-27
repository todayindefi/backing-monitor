"""Select exact VaultTracker accounting alongside the specialist Syrup book."""
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import sys
from decimal import Decimal
import re

try:
    from tools.check_syrupusdc_vaulttracker import compare, require
except ModuleNotFoundError:
    from check_syrupusdc_vaulttracker import compare, require


FIELD = 'vaulttracker_native_accounting'
DENOMINATIONS = {
    'syrupusdc': 'USDC per syrupUSDC share (native convertToAssets)',
    'syrupusdt': 'USDT/share',
}


def select_native(report, manifest):
    from vaulttracker.client import VaultClient

    client = VaultClient(manifest)
    now = datetime.now(timezone.utc)
    result = compare(client, report, now.isoformat())
    require(result['status'] in {'same_pin_review', 'different_pins'},
            'Native fields unavailable or same-pin comparison failed')
    require(result['candidate_status'] == 'within_policy',
            'VaultTracker status: ' + result['candidate_status'])
    source = result['candidate_source']
    raw = result['candidate_raw']
    require(source['owner'] == 'VaultTracker' and
            type(source['freshness_policy_seconds']) is int and
            source['freshness_policy_seconds'] > 0, 'Native owner or freshness policy unqualified')
    if report['asset_slug'] == 'syrupusdt':
        require(source['freshness_policy_seconds'] == 3600, 'Unexpected syrupUSDT freshness policy')
    current = datetime.fromisoformat(source['block_time'])
    require(0 <= (now - current).total_seconds() <= source['freshness_policy_seconds'],
            'Native block outside freshness policy')
    pin = result['baseline_pin']
    require(source['block_number'] != pin['block'] or result['status'] == 'same_pin_review',
            'Conflicting hashes at the same Ethereum height')

    history = []
    for sample in client.get_history(result['vault_id'])['share_samples']:
        if sample['denomination'] != DENOMINATIONS[report['asset_slug']]:
            continue
        observed = datetime.fromisoformat(sample['observed_at'])
        value = Decimal(sample['value_decimal']) * 10**6
        require(value.is_finite() and 0 < value == value.to_integral_value() and observed <= current,
                'Invalid conversion history sample')
        history.append({'block_time': observed.isoformat(), 'conversion_raw': str(int(value)),
                        'sample_id': sample['sample_id'], 'source_refs': sample['source_refs']})
    history.sort(key=lambda sample: sample['block_time'])
    require(history and len({sample['block_time'] for sample in history}) == len(history)
            and history[-1]['block_time'] == current.isoformat()
            and history[-1]['conversion_raw'] == raw['native_nav_per_share'],
            'Conversion history does not reconcile to current native snapshot')
    for sample in history:
        require(all(re.fullmatch(r'[0-9a-f]{64}', ref)
                    for ref in [sample['sample_id'], *sample['source_refs']])
                and sample['source_refs'], 'Invalid conversion history provenance')

    return {
        'mode': 'selected', 'generation': result['generation'], 'decimals': 6,
        'raw': raw, 'block': source['block_number'], 'block_hash': source['block_hash'],
        'block_time': source['block_time'], 'retrieved_at': source['retrieved_at'],
        'freshness_policy_seconds': source['freshness_policy_seconds'],
        'native_samples': history,
    }


def selected_accounting(report):
    """Resolve the persistent local route used by the normal BM sync."""
    slug = report['asset_slug']
    require(slug in DENOMINATIONS, 'Unsupported Syrup native selector')
    default = Path(__file__).resolve().parents[1] / f'.private-reviews/{slug}-native-route/selector.json'
    selector = Path(os.environ.get(f'BM_{slug.upper()}_SELECTOR_FILE', default))
    try:
        mode = json.loads(selector.read_text())['source']
    except FileNotFoundError:
        manifest = os.environ.get(f'BM_{slug.upper()}_VAULTTRACKER_MANIFEST')
        return select_native(report, manifest) if manifest else None
    if mode == 'legacy':
        return None
    require(mode == 'vaulttracker', 'Unsupported Syrup selector source')
    vaulttracker = Path('/home/danger/VaultTracker')
    sys.path.insert(0, str(vaulttracker / 'src'))
    try:
        return select_native(report, vaulttracker / f'data/runtime/{slug}-native/feed/current.json')
    finally:
        sys.path.pop(0)
