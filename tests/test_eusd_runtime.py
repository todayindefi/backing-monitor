import copy,json,sys,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
import refresh_eusd_product as runtime
from test_eusd_product import fixture

ISSUER={'component_profiles':{'eusd':{'profile_checked':'2026-11-13','facts':[],'entities':[]}}}
class Runtime(unittest.TestCase):
    def persist(self,root):
        with patch.object(runtime,'selected_issuer',return_value=ISSUER):return runtime.persist(fixture(),None,root,{'reader':{},'selected_issuer':{'sha256':'a'*64}})
    def test_failed_collection_retains_original_generation_and_clock(self):
        with tempfile.TemporaryDirectory()as root:
            self.persist(root);root=Path(root);before=runtime.validate_generation(root/'public-data');current=(root/'current.json').read_bytes()
            runtime.failed_attempt(root,ValueError('private provider detail'))
            after=runtime.validate_generation(root/'public-data');self.assertEqual(before['generation'],after['generation']);self.assertEqual(before['source_clock'],after['source_clock']);self.assertEqual(current,(root/'current.json').read_bytes());self.assertEqual(after['last_attempt']['status'],'failed_last_good_retained');self.assertNotIn('private provider detail',json.dumps(after))
    def test_tamper_or_missing_required_file_fails_integrity(self):
        with tempfile.TemporaryDirectory()as root:
            self.persist(root);root=Path(root);pointer=runtime.validate_generation(root/'public-data');p=root/'public-data/generations'/pointer['generation']/'eusd_backing.json';p.write_text('{}')
            with self.assertRaisesRegex(ValueError,'hash mismatch'):runtime.validate_generation(root/'public-data')
            p.unlink()
            with self.assertRaises(FileNotFoundError):runtime.validate_generation(root/'public-data')
    def test_wrong_quote_token_cannot_enter_price_history(self):
        from eusd_product import normalize
        product=normalize(fixture())
        with self.assertRaises(ValueError):runtime.enrich(product,{'identity':{'chain_id':1,'token_in':'0x'+'44'*20}},[])
    def test_no_quote_never_creates_history_or_healthy_price(self):
        from eusd_product import normalize
        p,h=runtime.enrich(normalize(fixture()),None,[]);self.assertEqual(h,[]);self.assertIsNone(p['stability']['market_price']);self.assertIsNone(p['liquidity_exit']['depth_50bps'])
if __name__=='__main__':unittest.main()
