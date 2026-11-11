import copy
import importlib.util
from pathlib import Path
import unittest
spec=importlib.util.spec_from_file_location('qualified',Path(__file__).resolve().parents[1]/'tools/copy_syrup_backing.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class QualifiedTransport(unittest.TestCase):
 def setUp(self):
  self.d={'asset_slug':'syrupusdc','asset_specific':{'vault_state':{'pool':m.POOLS['syrupusdc'],'accounting_context':{'schema_version':'syrup-pool-accounting/1','pinning':'all_accounting_calls_pinned','block':26390739,'hash':'a'*64,'timestamp':1794388763},'accounting_raw':{'units':'native underlying6decimal base units','pool_cash':'1000000','pool_assets':'10000000','own_strategy_claims':'9000000','pool_losses':'0','components_minus_NAV':'0'},'free_usdc':1,'total_assets':10,'strategy_aum':9,'unrealized_losses':0,'independent_credit_nav':None},'peg':{'source':'dated'},'liquidity':{'source':'dated'},'axis_thresholds':{'backing':{'cr_pct':[101,100,98,95]}}},'peg':{'history_ref':'syrupusdc_backing_history.json','history_field':'peg_market_price'},'backing':{'basis':'accounting'},'liquidity':{'basis':'pool cash','free_liquidity_pct':10},'dependencies':{'upstream':[]},'issuer':{'curator':'Maple'}}
 def test_qualified_contract_passes(self):self.assertEqual(m.validate(self.d),'syrupusdc')
 def test_old_base_payload_cannot_overwrite(self):
  del self.d['asset_specific']['vault_state']['accounting_context']
  with self.assertRaises(ValueError):m.validate(self.d)
 def test_authored_score_does_not_replace_family_contract(self):
  self.d.pop('liquidity')
  with self.assertRaises(ValueError):m.validate(self.d)
 def test_inconsistent_raw_arithmetic_rejected(self):
  self.d['asset_specific']['vault_state']['accounting_raw']['own_strategy_claims']='10000000'
  with self.assertRaises(ValueError):m.validate(self.d)
 def test_real_loss_and_residual_are_not_hidden(self):
  v=self.d['asset_specific']['vault_state'];v['unrealized_losses']=1;v['accounting_raw'].update(pool_losses='1000000',pool_assets='9000000',components_minus_NAV='1000000');v['total_assets']=9;self.d['liquidity']['free_liquidity_pct']=100/9
  self.assertEqual(m.validate(self.d),'syrupusdc')
 def test_scale_mismatch_rejected(self):
  self.d['asset_specific']['vault_state']['strategy_aum']=9000000
  with self.assertRaises(ValueError):m.validate(self.d)
if __name__=='__main__':unittest.main()
