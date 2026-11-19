import json
from pathlib import Path
import sys,tempfile,unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from dashboard_publication import publish,failed,SUFFIXES

class ProductionGroupTests(unittest.TestCase):
    def setup_group(self,folder,approved=True):
        root=Path(folder);(root/'data').mkdir()
        row={'slug':'weeth','published':True,'contract_address':'exact','source_status_ref':'weeth_source_status.json'}
        (root/'data/assets.json').write_text(json.dumps([row]))
        policy={'asset_slug':'weeth','chain_id':'eip155:1','address':'exact','production_approved':approved,'assessment_version':'grade-v1','evidence_version':'evidence-v1'}
        outputs={f'weeth_{s}.json':{} for s in SUFFIXES['weeth']}
        outputs['weeth_backing.json']={'asset_slug':'weeth','timestamp':'original-native-clock','backing':{'total_backing':None},'transport':{}}
        return root,policy,outputs
    def test_exact_approval_required(self):
        with tempfile.TemporaryDirectory() as t:
            root,p,o=self.setup_group(t,False)
            with self.assertRaises(ValueError):publish(root,p,o,'manual_snapshot')
            self.assertFalse((root/'data/weeth_backing.json').exists())
    def test_missing_group_does_not_write_partial_new_measurements(self):
        with tempfile.TemporaryDirectory() as t:
            root,p,o=self.setup_group(t);o.pop('weeth_issuer.json')
            with self.assertRaises(KeyError):publish(root,p,o,'manual_snapshot')
            self.assertFalse((root/'data/weeth_backing.json').exists())
    def test_manual_clocks_nulls_and_failed_attempt_retained(self):
        with tempfile.TemporaryDirectory() as t:
            root,p,o=self.setup_group(t);publish(root,p,o,'manual_snapshot')
            f=root/'data/weeth_backing.json';before=f.read_bytes();d=json.loads(before)
            self.assertEqual(d['timestamp'],'original-native-clock')
            self.assertIsNone(d['backing']['total_backing'])
            self.assertEqual(d['transport']['refresh_mode'],'manual_snapshot')
            failed(root,'weeth');self.assertEqual(before,f.read_bytes())
            self.assertEqual(json.loads((root/'data/weeth_source_status.json').read_text())['status'],'failed')
    def test_generic_sync_cannot_override_the_groups(self):
        code=Path('sync_and_push.sh').read_text()
        self.assertEqual(code.count('case "$slug" in fxsave|weeth) continue ;; esac'),2)
        self.assertNotIn('prepare_weeth_preview.py --publish',code)
if __name__=='__main__':unittest.main()
