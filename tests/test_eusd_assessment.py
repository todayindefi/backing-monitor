import copy,hashlib,json,sys,tempfile,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from eusd_assessment import select_eusd_assessment,TOKEN,MAPPING_VERSION
from shared_asset_evidence import canonical

def evidence():
    return {'schema_version':'shared-asset-evidence/1','identity':{'project':'reserve-protocol','component':'reserve-eusd','chain':'ethereum','chain_id':1,'token':TOKEN},'axes':{k:{'fields':{}}for k in ['stability','backing','liquidity_exit','dependencies','contract_admin','issuer']},'sources':{},'publication':{'status':'local_candidate_not_authorized'}}
class Assessment(unittest.TestCase):
    def select(self,e=None,changes=None,corrupt=None):
        e=e or evidence();eb=canonical(e);eid='sha256:'+hashlib.sha256(eb).hexdigest()
        a={'schema_version':'shared-asset-assessment/1','owner':'RiskAnalyst','asset':'eusd','chain':'ethereum','token':TOKEN,'assessment_version':'owner-version','evidence_version':eid,'scores':{'overall_score':5.5}}
        a.update(changes or{});ab=json.dumps(a,indent=2).encode();sha=hashlib.sha256(ab).hexdigest()
        with tempfile.TemporaryDirectory()as d:
            ep=Path(d,'e.json');ap=Path(d,'a.json');ep.write_bytes(eb+(b' 'if corrupt=='evidence'else b''));ap.write_bytes(ab+(b' 'if corrupt=='assessment'else b''))
            result=select_eusd_assessment(ep,eid,ap,sha)
            self.assertEqual(ap.read_bytes(),ab)
            return result
    def test_exact_eusd_preserves_bytes_scores_and_proposed_state(self):
        _,a,r=self.select();self.assertEqual(r['mapping_version'],MAPPING_VERSION);self.assertEqual(a['scores']['overall_score'],5.5);self.assertFalse(r['scores_applied']);self.assertFalse(r['authored_bytes_modified']);self.assertEqual(r['binding_status'],'proposed_pending_normal_adoption')
    def test_wrong_canonical_family_component_chain_and_token_rejected(self):
        for key,value in [('project','lybra'),('component','reusd-re'),('chain','arbitrum'),('chain_id',42161),('chain_id',True),('token','0x'+'11'*20)]:
            with self.subTest(key=key,value=value):
                e=evidence();e['identity'][key]=value
                with self.assertRaises(ValueError):self.select(e)
    def test_unrelated_authored_alias_and_wrong_scope_rejected(self):
        for changes in [{'asset':'lybra-eusd'},{'asset':'reusd-re'},{'asset':'reserve-eusd'},{'token':'0x'+'11'*20},{'chain':'arbitrum'},{'chain_id':42161},{'component':'reusd-re'},{'project':'lybra'},{'owner':'BackingMonitor'},{'evidence_version':'sha256:'+'0'*64}]:
            with self.subTest(changes=changes):
                with self.assertRaises(ValueError):self.select(changes=changes)
    def test_wrong_evidence_or_authored_bytes_rejected(self):
        for corrupt in ['evidence','assessment']:
            with self.assertRaisesRegex(ValueError,'hash mismatch'):self.select(corrupt=corrupt)
if __name__=='__main__':unittest.main()
