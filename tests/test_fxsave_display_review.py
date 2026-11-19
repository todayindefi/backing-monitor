import copy,json,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from preview_assessment import public_editorial
from reviewed_control_projection import reviewed_control_projection

class FxsaveDisplayReview(unittest.TestCase):
    def policy(self):return json.loads(Path('config/fxsave_preview_sources.json').read_text())
    def test_short_name_preserves_full_entity_and_grade(self):
        d=public_editorial(self.policy())
        self.assertEqual(d['issuer']['issuer']['short_name'],'f(x) Protocol')
        self.assertIn('repayment obligor',d['issuer']['issuer']['entity'])
        self.assertEqual(d['issuer']['issuer']['issuer_score'],5.5)
    def test_accepted_control_clock_and_historical_separation(self):
        d=json.loads(Path('data/fxsave_contract.json').read_text());c=d['contract']
        self.assertEqual(d['as_of'],'2026-11-17T05:23:11Z')
        self.assertEqual(c['accepted_control_review']['block'],26432647)
        self.assertNotIn('authority_summary',c)
        self.assertNotIn('layers',c)
        self.assertEqual(c['legacy_topology']['as_of'],'2026-09-22')
        self.assertEqual(c['legacy_topology_status'],'historical')
        self.assertEqual(d,reviewed_control_projection(d,self.policy()['control_review'],'fxsave'))
    def test_newer_source_not_silently_promoted(self):
        legacy={'asset':'fxsave','as_of':'2026-11-20','contract':{'headline':'new source'}}
        before=copy.deepcopy(legacy);d=reviewed_control_projection(legacy,self.policy()['control_review'],'fxsave')
        self.assertEqual(legacy,before)
        self.assertEqual(d['contract']['legacy_topology_status'],'newer_unreviewed')
        self.assertEqual(d['as_of'],'2026-11-17T05:23:11Z')
    def test_control_summary_bound_to_accepted_report(self):
        p=self.policy();p['control_review']['source_sha256']='0'*64
        with self.assertRaisesRegex(ValueError,'bound to the accepted report'):public_editorial(p)
if __name__=='__main__':unittest.main()
