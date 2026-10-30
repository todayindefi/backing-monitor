"""Safety invariants of the GHO consumer projection; no network or producer writes."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

SPEC = importlib.util.spec_from_file_location('gho_preview', Path(__file__).resolve().parents[1] / 'tools/prepare_gho_preview.py')
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)


class GhoProjection(unittest.TestCase):
    def setUp(self):
        self.latest = {'GHO': {'symbol': 'GHO', 'chain': 'ethereum', 'timestamp': '2026-10-30T02:00:00Z',
                              'market_price': .998, 'theoretical_price': 1, 'market_price_as_of': None,
                              'contract_address': 'oracle-not-token',
                              'liquidity': {'token_address': module.TOKEN, 'chain': 'ethereum', 'sell_into': 'USDC', 'timestamp': '2026-10-30T01:00:00Z',
                                            'quotes': {'100': {'output_usd': 99, 'slippage_bps': -2}}}}}
        self.archive = {'assets': {'GHO': {'history': [
            {'timestamp': '2026-10-30T00:00:00', 'market_price': 1, 'theoretical_price': 1},
            {'timestamp': '2026-10-30T00:00:00Z', 'market_price': 1, 'theoretical_price': 1},
            {'timestamp': '2026-10-30T04:00:00Z', 'market_price': .998, 'theoretical_price': 1},
            {'timestamp': '2026-10-30T05:00:00Z', 'market_price': float('nan'), 'theoretical_price': 1}]}}}

    def test_preserves_clock_scope_and_absence(self):
        before = copy.deepcopy(self.latest)
        feed, history = module.project(self.latest, self.archive)
        self.assertEqual(self.latest, before)
        self.assertIsNone(feed['peg']['market_price_as_of'])
        self.assertIsNone(feed['backing']['as_of'])
        self.assertIsNone(feed['backing']['collateral_ratio'])
        self.assertEqual(feed['liquidity']['as_of'], '2026-10-30T01:00:00Z')
        self.assertEqual(len(history['entries']), 2)
        self.assertEqual(len(history['coverage_gaps']), 1)
        self.assertEqual(history['excluded_rows'], {'ambiguous_or_invalid_clock': 1, 'invalid_price_or_reference': 1})
        quote = feed['asset_specific']['gho']['quotes'][0]
        self.assertAlmostEqual(quote['market_notional_cost_bps'], 100)
        self.assertEqual(quote['input_notional_usd'], 100)
        self.assertNotIn('size_gho', quote)
        self.assertEqual(quote['impact_bps'], 2)
        liquidity = feed['liquidity']
        self.assertEqual(liquidity['primary_redemption_depth_status'], 'not_measured')
        self.assertEqual(liquidity['exit_mark']['as_of'], liquidity['as_of'])
        self.assertEqual(liquidity['exit_mark']['quotes']['100']['slippage_bps'], -2)
        self.assertEqual(liquidity['exit_mark']['quotes']['100']['output_usd'], 99)
        self.assertNotIn('total_2pct_depth', liquidity)

    def test_identity_and_reference_cannot_silently_fall_back(self):
        for field, value in [('symbol', 'sGHO'), ('theoretical_price', None), ('market_price', float('inf')),
                             ('timestamp', '2026-10-30')]:
            latest = copy.deepcopy(self.latest)
            latest['GHO'][field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):
                module.project(latest, self.archive)
        self.latest['GHO']['liquidity']['token_address'] = 'wrong-token'
        with self.assertRaises(ValueError):
            module.project(self.latest, self.archive)

    def test_diagnostic_coverage_never_becomes_canonical(self):
        feed, _ = module.project(self.latest, self.archive)
        module.add_diagnostics(feed, {'timestamp': '2026-10-30T03:00:00Z', 'supply': {
            'total_supply': 699000000, 'tokenlogic_metrics': {'collateral_ratio': 1.54},
            'gsm_onchain': {'contracts': [{'available_liquidity': 0, 'is_frozen': False}]}}})
        self.assertIsNone(feed['backing']['collateral_ratio'])
        self.assertIsNone(feed['backing']['as_of'])
        self.assertIsNone(feed['liquidity']['derived_score'])
        self.assertNotIn('primary_exit', feed['liquidity'])
        self.assertEqual(feed['asset_specific']['gho']['diagnostics']['gsm']['contracts'][0]['available_liquidity'], 0)

    def test_remaining_axes_require_source_integrity_and_withhold_current_scores(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = b'original producer report'
            (root / 'report.md').write_bytes(source)
            axes = {'schema_version': 'gho-remaining-axes/1', 'asset_slug': 'gho',
                    'producer': 'backing-monitor evidence candidate', 'staged_only': True, 'owner_approved': False,
                    'dependencies': {'underlying_score': None}, 'contract': {'structural_score': None},
                    'issuer': {'issuer_score': None, 'as_of': '2026-09-23T00:00:00Z', 'historical_issuer_score': 6.5}}
            def prepare():
                raw = json.dumps(axes).encode()
                (root / 'gho_remaining_axes.json').write_bytes(raw)
                (root / 'manifest.json').write_text(json.dumps({'files': {'gho_remaining_axes.json': {
                    'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw)}},
                    'sources': [{'file': 'report.md', 'sha256': hashlib.sha256(source).hexdigest()}]}))
            prepare()
            selected, _ = module.select_remaining_axes(root)
            self.assertEqual(selected['issuer']['as_of'], '2026-09-23T00:00:00Z')
            self.assertIsNone(selected['issuer']['issuer_score'])
            axes['issuer']['issuer_score'] = 6.5
            prepare()
            with self.assertRaisesRegex(ValueError, 'current scores'):
                module.select_remaining_axes(root)
            axes['issuer']['issuer_score'] = None
            prepare()
            (root / 'report.md').write_bytes(b'modified')
            with self.assertRaisesRegex(ValueError, 'source integrity'):
                module.select_remaining_axes(root)

    def test_score_review_is_bound_to_input_and_cannot_rate_axis5(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            input_path = root / 'input.json'
            input_path.write_bytes(b'original evidence')
            review = {'schema_version': 'gho-score-review/1', 'producer': 'riskanalyst',
                      'reviewed_at': '2026-10-30T07:29:00Z', 'input_manifest_verified': True,
                      'input_sha256': hashlib.sha256(input_path.read_bytes()).hexdigest(),
                      'decisions': {'underlying_score': 6.0, 'issuer_score': 6.5, 'structural_score': None,
                                    'structural_status': 'withheld_pending_code_and_authority_completion'}}
            files = {'review.json': review}
            for axis, score, value in [('dependencies', 'underlying_score', 6.0), ('issuer', 'issuer_score', 6.5)]:
                files['gho_' + axis + '.json'] = {'schema_version': axis + '/1', 'producer': 'riskanalyst',
                    'asset': 'gho', 'staged_only': True, axis: {score: value, 'score_rationale': 'Reviewed rationale'}}
            def prepare():
                manifest = {'producer': 'riskanalyst', 'staged_only': True, 'files': {}}
                for name, value in files.items():
                    raw = json.dumps(value).encode()
                    (root / name).write_bytes(raw)
                    manifest['files'][name] = hashlib.sha256(raw).hexdigest()
                (root / 'manifest.json').write_text(json.dumps(manifest))
            prepare()
            selected, _ = module.select_score_review(root, input_path)
            self.assertEqual(selected['gho_issuer.json']['issuer']['issuer_score'], 6.5)
            review['decisions']['structural_score'] = 6.0
            prepare()
            with self.assertRaisesRegex(ValueError, 'Axis 5 hold'):
                module.select_score_review(root, input_path)
            review['decisions']['structural_score'] = None
            prepare()
            input_path.write_bytes(b'different evidence')
            with self.assertRaisesRegex(ValueError, 'selected evidence'):
                module.select_score_review(root, input_path)
            input_path.write_bytes(b'original evidence')
            (root / 'gho_issuer.json').write_text('{}')
            with self.assertRaisesRegex(ValueError, 'integrity'):
                module.select_score_review(root, input_path)

    def test_canonical_selection_rejects_tampering_and_foreign_identity(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            feed = {'asset_slug': 'gho', 'producer': 'PegTracker', 'backing': {'collateral_ratio': None},
                    'asset_specific': {'gho_backing': {'schema_version': 'gho-backing-detail/1', 'chain_id': 1,
                        'as_of': '2026-10-30T04:18:59Z', 'block_hash': '0xabc'}}}
            def prepare(value):
                manifest = {'producer': 'PegTracker', 'staged_only': True, 'block_hash': '0xabc', 'files': {}}
                for name, body in [('gho_backing.json', value), ('gho_backing_history.json', {'entries': []}),
                                   ('gho_backing_evidence.json', {})]:
                    raw = json.dumps(body).encode()
                    (root / name).write_bytes(raw)
                    manifest['files'][name] = {'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw)}
                (root / 'manifest.json').write_text(json.dumps(manifest))
            prepare(feed)
            module.select_backing(root)
            (root / 'gho_backing.json').write_text('{}')
            with self.assertRaisesRegex(ValueError, 'integrity'):
                module.select_backing(root)
            feed['asset_slug'] = 'sgho'
            prepare(feed)
            with self.assertRaisesRegex(ValueError, 'identity'):
                module.select_backing(root)


if __name__ == '__main__':
    unittest.main()
