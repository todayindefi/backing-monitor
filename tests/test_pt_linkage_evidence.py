import copy,json,pathlib,shutil,sys,tempfile,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'tools'))
from build_pt_linkage_evidence import build,IDENTITIES
from shared_asset_evidence import digest,validate
RAW=ROOT/'.private-reviews/pt-linkage-evidence-2026-11-04/raw'
class Evidence(unittest.TestCase):
 def setUp(self):
  if not RAW.exists():self.skipTest('frozen local owner captures required')
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.base=pathlib.Path(self.tmp.name);self.raw=self.base/'raw';shutil.copytree(RAW,self.raw);self.out=self.base/'packages'
 def selected(self,slug):
  p=json.loads((self.out/slug/'current.json').read_text());body=(self.out/slug/p['snapshot']).read_bytes();self.assertEqual(p['evidence_version'],'sha256:'+digest(body));return p,json.loads(body)
 def test_exact_identities_and_repeatable_versions(self):
  first=build(self.raw,self.out);self.assertEqual(first,build(self.raw,self.out))
  for slug,(id,ch,token) in IDENTITIES.items():
   p,x=self.selected(slug);validate(x);self.assertEqual({k:x['identity'][k] for k in ['component','chain','chain_id','token']},{'component':slug,'chain':ch,'chain_id':id,'token':token});self.assertIsNone(p['assessment_version']);self.assertIsNone(x['axes']['backing']['fields']['independently_reconciled_net_nav']['value'])
 def test_monad_reconciliation_is_not_solvency_or_execution(self):
  build(self.raw,self.out);p,x=self.selected('srusdat');b=x['axes']['backing']['fields'];l=x['axes']['liquidity_exit']['fields']
  self.assertEqual(b['local_supply']['value'],'1028907.619118');self.assertEqual(b['candidate_escrow_minus_local_supply']['value'],'0.000000');self.assertEqual(b['candidate_escrow_minus_local_supply']['status'],'partial_reconciliation');self.assertIsNone(b['inflight_share_units']['value']);self.assertIsNone(l['full_cash_execution']['value']);self.assertEqual(len([k for k in l if k.startswith('stage_')]),5);self.assertEqual(l['nov4_pt_sale_quote']['value']['share_output_raw'],'95684104822694365110509');self.assertEqual(l['nov4_pt_sale_quote']['clock']['api_price_updated_at'],'2026-11-04T06:56:30.096Z');self.assertEqual(l['nov2_accepted_sale_legs']['value'][0]['source_timestamp'],'2026-11-02T09:51:59+00:00');self.assertFalse(l['nov2_actual_state_gate']['value']['complete_route_passed'])
 def test_wrapper_assets_are_underlying_tokens_not_cash(self):
  build(self.raw,self.out)
  for slug,u in [('siusd','iUSD'),('susn','USN')]:
   _,x=self.selected(slug);b=x['axes']['backing']['fields'];self.assertEqual(b['wrapper_total_assets']['unit'],u);self.assertEqual(b['reported_assets_minus_token_balance']['value'],'0');self.assertIsNone(x['axes']['liquidity_exit']['fields']['immediately_available_usdc']['value'])
 def test_wrong_identity_rejected(self):
  p=self.raw/'financial-observations.private.json';x=json.loads(p.read_text());x['assets']['srusdat']['chain_id']=1;p.write_text(json.dumps(x))
  with self.assertRaisesRegex(AssertionError,'identity'):build(self.raw,self.out)
 def test_missing_escrow_not_zero(self):
  for p in self.raw.glob('dex_*'):p.unlink()
  p=self.raw/'financial-observations.private.json';x=json.loads(p.read_text());x['bridge_accounting_lead']['escrow_balance']={'ok':False};p.write_text(json.dumps(x));build(self.raw,self.out);_,x=self.selected('srusdat');self.assertIsNone(x['axes']['backing']['fields']['candidate_escrow_minus_local_supply']['value'])
 def test_new_version_does_not_overwrite_prior(self):
  for p in self.raw.glob('dex_*'):p.unlink()
  a=build(self.raw,self.out)['siusd'];old=self.out/'siusd'/a['snapshot'];body=old.read_bytes();p=self.raw/'financial-observations.private.json';x=json.loads(p.read_text());x['assets']['siusd']['reads']['totalSupply()']['decoded']+=1;p.write_text(json.dumps(x));b=build(self.raw,self.out)['siusd'];self.assertNotEqual(a['evidence_version'],b['evidence_version']);self.assertEqual(body,old.read_bytes())
 def test_quote_classification_and_clocks(self):
  if not (self.raw/'dex_exit_quotes.json').exists():self.skipTest('Dex return required')
  build(self.raw,self.out)
  for slug,expected in [('siusd','100108.677294'),('susn','99627.421594')]:
   _,x=self.selected(slug);f=x['axes']['liquidity_exit']['fields'];rows=f['router_exit_estimates']['value'];q=next(q for q in rows if q['leg']=='share_to_usdc' and q['target_market_notional_usd']=='100000');self.assertEqual(q['output_units'],expected);self.assertIsNone(q['execution']);self.assertIsNone(q['minimum_out']);self.assertNotEqual(q['received_at'],q['provider_timestamp_utc']);self.assertIsNone(f['full_cash_execution']['value'])
   if slug=='siusd':self.assertIn('Gateway',q['classification']);self.assertIsNone(f['sized_secondary_exits']['value'])
   else:self.assertEqual(len(f['sized_secondary_exits']['value']),3)
 def test_stale_dex_bm_version_join_rejected(self):
  if not (self.raw/'dex_exit_quotes.json').exists():self.skipTest('Dex return required')
  p=self.raw/'financial-observations.private.json';x=json.loads(p.read_text());x['assets']['siusd']['reads']['totalSupply()']['decoded']+=1;p.write_text(json.dumps(x))
  with self.assertRaisesRegex(AssertionError,'source version mismatch'):build(self.raw,self.out)
 def test_da_exact_scope_and_loss_conflict_preserved(self):
  if not (self.raw/'da_receipt.json').exists():self.skipTest('DA return required')
  build(self.raw,self.out)
  _,x=self.selected('siusd');rows=x['axes']['issuer']['fields']['selected_documentary_facts']['value'];self.assertTrue(all(f['component_slug']=='siusd' for f in rows));self.assertIn('faq_three_stage_loss_order',{f['key'] for f in rows});self.assertIn('slashing_two_tranche_conflict',{f['key'] for f in rows});self.assertIsNone(x['axes']['backing']['fields']['verified_loss_order']['value']);self.assertEqual(x['axes']['backing']['fields']['verified_loss_order']['owner'],'SecurityAnalyst');self.assertEqual(len(x['axes']['issuer']['fields']['historical_claim_review']['value']),3);self.assertTrue(all(r['component']=='siusd' for r in x['axes']['issuer']['fields']['historical_claim_review']['value']))
  _,x=self.selected('srusdat');self.assertEqual(x['axes']['dependencies']['fields']['documentary_deployment_authorization']['status'],'documentary_verified');self.assertIsNone(x['axes']['backing']['fields']['inflight_share_units']['value'])
 def test_security_delay_and_settlement_boundaries(self):
  if not (self.raw/'security_owner-summary.json').exists():self.skipTest('Security return required')
  build(self.raw,self.out);_,x=self.selected('srusdat');f=x['axes']['contract_admin']['fields'];v=f['security_delegate_lowers_dvn_threshold_in_simulation']['value'];self.assertEqual(v['from_required_dvn_count'],4);self.assertEqual(v['to_required_dvn_count'],1);self.assertTrue(v['send_accepts_on_both_chains']);self.assertTrue(v['receive_accepts_on_both_chains']);self.assertFalse(v['actual_configuration_changed']);self.assertEqual(f['security_current_uln']['value']['operator_independence'],'unverified');self.assertIsNone(x['axes']['backing']['fields']['inflight_share_units']['value'])
  _,x=self.selected('susn');f=x['axes']['contract_admin']['fields']['security_application_vs_upgrade_authority']['value'];self.assertEqual(f['current_proxy_upgrade_delay_seconds'],172800);self.assertEqual(f['configurable_upgrade_delay_floor_seconds'],86400);self.assertFalse(f['universal_two_day_delay']);self.assertEqual(x['axes']['liquidity_exit']['fields']['security_withdrawal_handler']['value']['withdraw_period_seconds'],604800);self.assertIsNone(x['axes']['liquidity_exit']['fields']['full_cash_execution']['value'])
 def test_public_output_rejected(self):
  with self.assertRaises(ValueError):build(self.raw,ROOT/'data/pt-linkage')
if __name__=='__main__':unittest.main()
