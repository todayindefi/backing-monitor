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
 def corrected(self):
  s=self.d['asset_specific'];s['issuer_transparency']={'retrieved_at':'2026-11-16T05:36:06Z','financial_observed_at':None,'collateral_wallet_inventory':[{'links':['public-custody-lead']}],'loan_rows':{'raw':'dossier'}};s['transparency_adoption']={'status':'corrected'};s['loan_book']={'loans':[{'borrower':'public-borrower','economic_classification':{'category':'credit'},'collateral':{'category':'crypto','asset':'BTC','usd_source':'issuer_transparency_ssr','usd':12,'current_level_pct':120,'amount':None,'valuation_observed_at':None,'raw_source':{'currentAssetAmount':'wrong'},'legacy_currentAssetAmount_model':{'status':'withdrawn','collateral':{'usd':3}}}}]};return self.d
 def test_public_copy_retires_dossiers_preserves_clocks_and_queue(self):
  import json
  d=self.corrected();raw=m.public_body(d,{'asset_specific':{'queue_review':{'clock':'older-queue'}}});out=json.loads(raw);c=out['asset_specific']['loan_book']['loans'][0]['collateral'];self.assertNotIn(b'"raw_source"',raw);self.assertNotIn('collateral',c['legacy_currentAssetAmount_model']);self.assertEqual(c['usd'],12);self.assertIsNone(c['valuation_observed_at']);self.assertEqual(out['asset_specific']['queue_review']['clock'],'older-queue');self.assertEqual(out['report_url'],'https://tidresearch.com/reports/syrupusdc/')
 def test_old_source_cannot_restore_retired_model(self):
  with self.assertRaises(ValueError):m.public_body(self.d,{'asset_specific':{}})
  d=self.corrected();d['asset_specific']['loan_book']['loans'][0]['collateral']['usd_source']='legacy_graphql'
  with self.assertRaises(ValueError):m.public_body(d,{'asset_specific':{}})
 def test_partial_source_unknown_is_not_zero_or_stale(self):
  import json
  d=self.corrected();c=d['asset_specific']['loan_book']['loans'][0]['collateral'];c.update(usd_source='unknown_invalid_legacy_model',usd=None,current_level_pct=None,buffer_pp=None)
  out=json.loads(m.public_body(d,{'asset_specific':{}}));self.assertIsNone(out['asset_specific']['loan_book']['loans'][0]['collateral']['usd'])
  c['usd']=12
  with self.assertRaises(ValueError):m.public_body(d,{'asset_specific':{}})
 def family(self):
  return {'pools':[{'slug':slug,'pool_address':address,'pool_collateral_value_usd':None}for slug,address in m.POOLS.items()],'combined':{'classification_versions':{slug:'issuer_transparency_ssr_v1+legacy_unmatched'for slug in m.POOLS},'independent_credit_nav':None,'loans_only_coverage_complete':False,'loans_only_collateral_usd':None,'collateral_ratio_loans_only_pct':None}}
 def test_family_legacy_pool_totals_never_restore_current_values(self):
  d=self.family();m.public_family_body(d);d['pools'][0]['pool_collateral_value_usd']=999
  with self.assertRaises(ValueError):m.public_family_body(d)
 def test_family_partial_source_never_carries_complete_coverage(self):
  d=self.family();d['combined']['loans_only_collateral_usd']=999
  with self.assertRaises(ValueError):m.public_family_body(d)
if __name__=='__main__':unittest.main()
