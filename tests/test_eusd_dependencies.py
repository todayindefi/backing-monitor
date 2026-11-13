import copy,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from eusd_dependencies import project_lookthrough,EXPECTED_VAULTS

def fixture():
    vaults=[]
    for address in sorted(EXPECTED_VAULTS):
        vaults.append({'address':address,'status':'ok','markets':[{'market_id':'0x123','singleton':'0xabc','adapter':address,'parameters':{'loan_token':'0xloan','collateral_token':'0xcollateral','oracle':'0xoracle','irm':'0xirm','lltv':860000000000000000},'stored_state':[999,999000000,10,0,123,0],'adapter_supply_shares':1000000,'singleton_position':[1000000,0,0],'stored_book_assets_raw':1,'adapter_shares_equal_singleton_position':True}], 'idle_assets_raw':2,'stored_book_estimate_raw':3,'receipt_total_assets_raw':5,'unassigned_residual_raw':'2','liquidity_adapter':address,'ordinary_exit_market_id':'0x123','send_shares_gate':'0x0','receive_assets_gate':'0x0'})
    return {'schema_version':'eusd-lookthrough-v1','source_clock':{'chain_id':1,'block_number':123},'source_cutover':'test','native_vaults':vaults,'bindings':{},'comet':{},'aave':{},'issues':[],'limitations':[],'raw_reads':{'private':'excluded'},'source_sha256':{'private':'excluded'}}, {'basket':{'holdings':[{'token':a,'current_basket_member':True}for a in EXPECTED_VAULTS]}}

class Dependencies(unittest.TestCase):
    def test_shared_market_deduplicated_without_discarding_claims(self):
        raw,p=fixture();out=project_lookthrough(raw,p)
        self.assertEqual(out['native_market_references'],3);self.assertEqual(out['unique_market_count'],1)
        self.assertEqual([x['unassigned_residual_raw']for x in out['native_vaults']],['2']*3)
        self.assertTrue(all(x['ordinary_exit_capacity_for_eusd']is None for x in out['native_vaults']))
        self.assertNotIn('raw_reads',out);self.assertNotIn('source_sha256',out)
    def test_eusd_share_only_derived_from_same_pin_claim(self):
        raw,p=fixture();raw['source_clock']['block_hash']='0x123';p['source_clock']={'block_hash':'0x123'}
        for h in p['basket']['holdings']:h['underlying_lookthrough']={'claim_raw':'2'}
        out=project_lookthrough(raw,p)
        for v in out['native_vaults']:
            self.assertEqual(v['eusd_claim_share_pct'],'40.0')
            self.assertEqual(v['markets'][0]['eusd_pro_rata_stored_book_assets_raw'],'0')
        p['source_clock']['block_hash']='0x456';out=project_lookthrough(raw,p)
        self.assertTrue(all(v['eusd_claim_share_pct']is None for v in out['native_vaults']))
    def test_inconsistent_shared_state_rejected(self):
        raw,p=fixture();raw['native_vaults'][1]['markets'][0]['stored_state'][2]=11
        with self.assertRaisesRegex(ValueError,'shared market state'):project_lookthrough(raw,p)
    def test_incorrect_book_or_removed_basket_rejected(self):
        raw,p=fixture();bad=copy.deepcopy(raw);bad['native_vaults'][0]['markets'][0]['stored_book_assets_raw']=2
        with self.assertRaisesRegex(ValueError,'conversion mismatch'):project_lookthrough(bad,p)
        p['basket']['holdings'].pop()
        with self.assertRaisesRegex(ValueError,'current basket'):project_lookthrough(raw,p)
if __name__=='__main__':unittest.main()
