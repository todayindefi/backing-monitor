import copy
import json
from pathlib import Path
import sys
import unittest
import tempfile
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from preview_assessment import public_editorial
from prepare_fxsave_preview import source_selection,validate_base
from prepare_weeth_preview import prepare
import prepare_fxsave_preview as fx

class PreviewAcceptedSources(unittest.TestCase):
    def policy(self,slug): return json.loads(Path('config/'+slug+'_preview_sources.json').read_text())
    def test_current_fxsave_six_axes_and_no_legacy_redemption_grade(self):
        p=self.policy('fxsave');d=public_editorial(p)
        self.assertEqual(d['assessment']['assessment_version'],'fxsave-six-axis-2026-11-17-v2')
        self.assertEqual(d['assessment']['scores']['underlying'],4.5)
        self.assertNotIn('redemption',d['assessment']['scores'])
        self.assertEqual(d['assessment']['status'],'assessed')
    def test_hash_mismatch_fails_without_older_source(self):
        p=self.policy('fxsave');p['accepted_report']['sha256']='0'*64
        with self.assertRaisesRegex(ValueError,'hash mismatch'):public_editorial(p)
    def test_missing_source_fails_without_fallback(self):
        p=self.policy('weeth');p['accepted_report']['path']='/tmp/nonexistent-weeth-report-for-test'
        with self.assertRaises(FileNotFoundError):public_editorial(p)
    def test_wrong_chain_identity_rejected(self):
        p=self.policy('weeth');p['address']='0x'+'1'*40
        with self.assertRaisesRegex(ValueError,'deployment mismatch'):public_editorial(p)
    def test_weeth_chain_scope_units_and_nulls(self):
        d=prepare(self.policy('weeth'));b=d['weeth_backing.json']
        self.assertEqual([x['chain'] for x in b['backing']['deployments']],['ethereum'])
        self.assertNotIn('chains',b['liquidity'])
        self.assertEqual(b['liquidity']['denomination'],'ETH')
        self.assertIsNone(b['summary']['collateral_ratio'])
        self.assertIsNone(b['backing']['total_backing'])
        self.assertIsNone(b['liquidity']['primary_exit']['queue_timing'])
        self.assertEqual(b['timestamp'],json.loads(Path('/home/danger/PegTracker/data/weeth_backing.json').read_text())['timestamp'])
    def test_grade_mutation_requires_repin(self):
        p=self.policy('weeth');p['expected_scores']['backing']=10
        with self.assertRaisesRegex(ValueError,'authored-grade change'):public_editorial(p)
    def test_failed_assembly_preserves_last_good_and_writes_visible_status(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);target=root/'previews/fxsave/data';target.mkdir(parents=True)
            prior=target/'fxsave_backing.json';prior.write_text('last-good-clock-and-values')
            with patch.object(fx,'REPO',root),patch.object(fx,'prepared_files',side_effect=ValueError('hash mismatch')),patch.object(sys,'argv',['prepare_fxsave_preview.py']):
                with self.assertRaises(ValueError):fx.main()
            self.assertEqual(prior.read_text(),'last-good-clock-and-values')
            self.assertEqual(json.loads((target/'preview_status.json').read_text())['status'],'failed')
if __name__=='__main__':unittest.main()
