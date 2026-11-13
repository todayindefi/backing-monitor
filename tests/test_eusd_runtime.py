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
    def test_quote_reference_clock_is_not_replaced_by_backing_clock(self):
        from eusd_product import normalize
        product=normalize(fixture());rows={str(x):{'status':'quoted','amount_in_raw':str(x*10**18),'output_usdc':str(x),'nav_cost_bps_ex_gas':0,'size_impact_bps':0,'received_at':'2026-11-13T00:01:00Z'}for x in [1000,10000,50000,100000,250000,500000,1000000]}
        q={'identity':{'chain_id':1,'token_in':product['identity']['token'],'token_out':'0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48','input_decimals':18,'output_decimals':6},'nav_usdc_per_eusd':'1','accounting_reference':{'source_clock':{'block_number':99}},'quotes':rows,'depths':[{'threshold_bps':n,'status':'ladder_exhausted','floor_usdc_reference':1000000,'bracket':None}for n in [10,25,50]],'limitations':[]}
        p,h=runtime.enrich(product,q,[]);self.assertEqual(p['liquidity_exit']['nav_reference_clock']['block_number'],99);self.assertEqual(h[0]['accounting_clock']['block_number'],99)
        _,again=runtime.enrich(product,q,h);self.assertEqual(len(again),1)
        q['depths'][0]['floor_usdc_reference']=2000000
        with self.assertRaisesRegex(ValueError,'bracket mismatch'):runtime.enrich(product,q,[])
    def test_no_quote_never_creates_history_or_healthy_price(self):
        from eusd_product import normalize
        p,h=runtime.enrich(normalize(fixture()),None,[]);self.assertEqual(h,[]);self.assertIsNone(p['stability']['market_price']);self.assertIsNone(p['liquidity_exit']['depth_50bps'])
if __name__=='__main__':unittest.main()
