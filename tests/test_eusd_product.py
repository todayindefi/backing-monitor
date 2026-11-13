import copy
import importlib.util
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location('eusd_product',Path(__file__).resolve().parents[1]/'tools/eusd_product.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

def fixture():
    token='0x'+'11'*20;rsr='0x'+'22'*20;p='asset.'+token
    values={'main.rToken':m.TOKEN,'rtoken.decimals':'18','rtoken.totalSupply':str(100*10**18),
        'rtoken.basketsNeeded':str(100*10**18),'basket.prime':[[token],[],[str(10**18)]],
        'basket.basketsHeldBy_backingManager':[str(101*10**18),str(101*10**18)],
        p+'.decimals':'6',p+'.held_raw':'101000000',p+'.quantity_per_basket_fixed18':str(10**18),
        p+'.plugin_price':[str(10**18),str(10**18)],p+'.symbol':'receipt','rsr.balance_staking_contract':str(500*10**18)}
    return {'schema_version':'reserve-eusd-raw/1','identity':{'chain_id':1,'token':m.TOKEN,'components':{'rsr':rsr}},
        'source_clock':{'block_number':100,'block_hash':'0x'+'aa'*32,'block_timestamp':'2026-11-13T00:00:00Z'},
        'status':'partial','reads':{k:{'status':'ok','value':v}for k,v in values.items()},
        'assets':[{'token':token,'plugin':'0x'+'33'*20,'read_prefix':p}]}

class Accounting(unittest.TestCase):
    def test_six_decimal_actual_units_do_not_become_target_weights(self):
        d=m.normalize(fixture());a=d['basket']['holdings'][0]
        self.assertEqual(a['held_units'],'101');self.assertEqual(a['required_units_for_baskets_needed'],'100')
        self.assertEqual(a['held_minus_required_units'],'1');self.assertEqual(a['prime_target_weight_pct'],'100')
        self.assertEqual(d['accounting']['basket_unit_coverage_low_pct'],'101.00')
    def test_unknown_redemption_and_active_rsr_stay_unknown(self):
        d=m.normalize(fixture());self.assertIsNone(d['redemption']['frozen']);self.assertIsNone(d['redemption']['available_eusd'])
        self.assertEqual(d['rsr']['staking_contract_balance_units'],'500');self.assertIsNone(d['rsr']['realizable_first_loss_usd'])
        self.assertIsNone(d['rsr']['active_staked_rsr_raw']);self.assertIsNone(d['stability']['market_price'])
    def test_failed_price_cannot_become_zero_external_backing(self):
        d=fixture();p=d['assets'][0]['read_prefix'];d['reads'][p+'.plugin_price']={'status':'unavailable','value':None}
        a=m.normalize(d)['accounting'];self.assertIsNone(a['external_registered_plugin_mark_low_usd']);self.assertEqual(len(a['unpriced_held_tokens']),1)
    def test_named_active_draft_and_remainder_are_not_realizable_insurance(self):
        d=fixture()
        for key,value in {'stRSR.getStakeRSR':str(300*10**18),'stRSR.getDraftRSR':str(100*10**18),'rsr.decimals':'18'}.items():d['reads'][key]={'status':'ok','value':value}
        r=m.normalize(d)['rsr'];self.assertEqual(r['active_staked_rsr_units'],'300');self.assertEqual(r['draft_rsr_units'],'100');self.assertEqual(r['contract_balance_minus_active_minus_draft_units'],'100');self.assertIsNone(r['realizable_first_loss_usd']);self.assertIsNone(r['remainder_interpretation'])
    def test_zero_convenience_getter_does_not_become_zero_executable_capacity(self):
        d=fixture();p=d['assets'][0]['read_prefix']
        for key,value in {'.receipt_asset':'0x'+'44'*20,'.receipt_underlying_decimals':'6','.receipt_convert_held_to_assets':'100000000','.receipt_maxWithdraw':'0','.receipt_maxRedeem':'0'}.items():d['reads'][p+key]={'status':'ok','value':value}
        r=m.normalize(d)['basket']['holdings'][0]['underlying_lookthrough'];self.assertEqual(r['claim_units'],'100');self.assertTrue(r['max_withdraw_getter_zero']);self.assertIsNone(r['executable_withdrawal_capacity']);self.assertIn('not a withdrawal-capacity measurement',r['zero_getter_semantics'])
    def test_wrong_identity_rejected(self):
        d=fixture();d['identity']['chain_id']=143
        with self.assertRaises(ValueError):m.normalize(d)

if __name__=='__main__':unittest.main()
