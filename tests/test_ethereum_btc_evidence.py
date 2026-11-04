import importlib.util,json,pathlib,sys,tempfile,unittest,shutil
ROOT=pathlib.Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'tools'))
from build_ethereum_btc_evidence import build
from shared_asset_evidence import digest,validate
class Evidence(unittest.TestCase):
 def test_units_gaps_and_repeatability(self):
  raw=ROOT/'.private-reviews/ethereum-btc-assets-2026-11-04/raw'
  if not raw.exists():self.skipTest('local frozen capture required')
  with tempfile.TemporaryDirectory() as d:
   first=build(raw,d);self.assertEqual(first,build(raw,d))
   for asset,p in first.items():
    b=(pathlib.Path(d)/asset/p['snapshot']).read_bytes();self.assertEqual(p['evidence_version'],'sha256:'+digest(b));self.assertIsNone(p['assessment_version']);x=json.loads(b);validate(x)
    self.assertIsNone(x['axes']['backing']['fields']['independently_reconciled_net_backing']['value'])
    quotes=x['axes']['liquidity_exit']['fields']['sized_exits']['value']
    if quotes is not None:
     self.assertEqual(len(quotes),3);self.assertTrue(all(q['execution'] is None and q['minimum_out'] is None for q in quotes))
    expected={'wbtc':('bit-global','wbtc'),'tbtc':('threshold-network','tbtc'),'lbtc':('lombard-finance','lombard-lbtc')}[asset]
    self.assertEqual((x['identity']['project'],x['identity']['component']),expected)
    if asset=='lbtc':
     f=x['axes']['backing']['fields'];self.assertGreater(float(f['published_btc_per_lbtc']['value']),1);self.assertEqual(f['published_strategy_nav']['clock']['as_of'],'2026-11-03T21:00:00.000Z');self.assertIsNone(f['options_net_liabilities']['value']);self.assertIsNone(f['residual_babylon_exposure']['value']);self.assertEqual(f['nav_minus_listed_accounts']['value'],'599.14014237')
 def package(self,slug,raw=None):
  raw=raw or ROOT/'.private-reviews/ethereum-btc-assets-2026-11-04/raw'
  if not raw.exists():self.skipTest('frozen capture required')
  with tempfile.TemporaryDirectory() as d:
   m=build(raw,d);return json.loads((pathlib.Path(d)/slug/m[slug]['snapshot']).read_text())
 def test_independent_reserve_match_not_full_backing(self):
  x=self.package('wbtc');f=x['axes']['backing']['fields'];r=f['independent_btc_reserve_reconciliation']['value'];self.assertEqual(r['addresses_checked'],109);self.assertEqual(r['confirmed_btc_sum'],'116492.03385674');self.assertEqual(r['confirmed_minus_publisher_satoshi'],'0');self.assertFalse(r['common_block_address_snapshot']);self.assertIsNone(r['custody_title_verified']);self.assertIsNone(f['independent_all_native_liabilities']['value']);self.assertIsNone(f['independently_reconciled_net_backing']['value']);self.assertEqual(f['api_reserves_minus_publisher_native_supply']['value'],'12.84209531')
 def test_vault_join_does_not_reproduce_quote(self):
  x=self.package('wbtc');f=x['axes']['dependencies']['fields']['gauntlet_candidate_join'];v=f['value'];self.assertFalse(v['quoted_opportunity_match']);self.assertEqual(v['exact_token_loan_supply_allocation']['pct_of_vault_total_loan_assets'],'45.10903993518828628831789863');self.assertEqual(v['apy']['performance_fee_fraction'],0.05);self.assertEqual(f['clock']['vault_indexed_block'],26342029);self.assertNotEqual(v['markets'][0]['market_state_block_number'],f['clock']['vault_indexed_block'])
 def test_rate_units_original_clock_and_greeks_not_liabilities(self):
  x=self.package('lbtc');f=x['axes']['stability']['fields']['documented_rate_feed_observations']['value'];c=next(r for r in f if r['description']=='LBTC / BTC');self.assertEqual(c['normalized_answer'],'1.00170827');self.assertEqual(c['updated_at'],'2026-11-04T04:55:11+00:00');self.assertTrue(any(r['quote_unit'] is None for r in f));v=x['axes']['backing']['fields']['manager_signed_strategy_metrics']['value'];self.assertTrue(v['publisher_signature_matches']);self.assertIsNone(v['net_options_liabilities_btc']);self.assertIsNone(v['key_identity_independently_verified'])
 def test_quotes_are_not_fills_or_one_to_one_nav(self):
  x=self.package('lbtc');q=x['axes']['liquidity_exit']['fields']['sized_exits']['value'];self.assertEqual(q[0]['output_usdc'],'100595.819723');self.assertEqual(q[0]['added_average_rate_impact_bps'],'0');self.assertGreater(float(q[-1]['added_average_rate_impact_bps']),600);self.assertTrue(all(r['execution'] is None for r in q));self.assertIsNone(x['axes']['backing']['fields']['options_net_liabilities']['value'])
 def test_owner_hash_tamper_rejected(self):
  raw=ROOT/'.private-reviews/ethereum-btc-assets-2026-11-04/raw'
  if not raw.exists():self.skipTest('frozen capture required')
  with tempfile.TemporaryDirectory() as d:
   r=pathlib.Path(d)/'raw';shutil.copytree(raw,r);p=r/'owner-inputs/lmt_summary.json';p.write_text(p.read_text()+' ')
   with self.assertRaisesRegex(AssertionError,'hash mismatch'):build(r,pathlib.Path(d)/'out')
 def test_exact_token_mismatch_rejected(self):
  raw=ROOT/'.private-reviews/ethereum-btc-assets-2026-11-04/raw'
  if not raw.exists():self.skipTest('frozen capture required')
  with tempfile.TemporaryDirectory() as d:
   r=pathlib.Path(d)/'raw';shutil.copytree(raw,r);p=r/'observations.private.json';x=json.loads(p.read_text());x['assets']['lbtc']['address']=x['assets']['wbtc']['address'];p.write_text(json.dumps(x))
   with self.assertRaisesRegex(AssertionError,'identity mismatch'):build(r,pathlib.Path(d)/'out')
 def test_incomplete_bitcoin_observation_remains_unknown(self):
  raw=ROOT/'.private-reviews/ethereum-btc-assets-2026-11-04/raw'
  if not raw.exists():self.skipTest('frozen capture required')
  with tempfile.TemporaryDirectory() as d:
   r=pathlib.Path(d)/'raw';shutil.copytree(raw,r);p=r/'wbtc-api/blockstream/observations.private.json';x=json.loads(p.read_text());x['complete']=False;x['addresses_observed']=108;x['confirmed_satoshi_sum']=None;p.write_text(json.dumps(x));v=self.package('wbtc',r)['axes']['backing']['fields']['independent_btc_reserve_reconciliation']['value'];self.assertIsNone(v['confirmed_btc_sum']);self.assertFalse(v['complete_publisher_address_set_checked'])
 def test_tbtc_route_matrix_does_not_claim_reopening_or_delivery(self):
  x=self.package('tbtc');f=x['axes']['liquidity_exit']['fields'];rows=f['current_route_matrix']['value'];self.assertEqual(len(rows),6);self.assertTrue(all(r['actual_BTC_delivery'] is None for r in rows))
  if 'security_live' in x['sources']:
   routes={r['operation']:r['current_gate_status'] for r in rows};self.assertEqual(routes['new-optimistic-mint'],'blocked');self.assertEqual(routes['pending-optimistic-finalization'],'blocked');self.assertEqual(routes['new-canonical-mint'],'conditional');self.assertEqual(routes['new-redemption'],'conditional');v=f['new_and_pending_mint_redemption_status']['value'];self.assertFalse(v['reopening_verified']);self.assertIsNone(v['operational_reopening_status']);self.assertIsNone(v['btc_delivery_status']);self.assertEqual(f['current_route_matrix']['clock']['block'],26342414)
  else:self.assertTrue(all(r['current_gate_status'] is None for r in rows))
 def test_public_output_rejected(self):
  with self.assertRaises(ValueError):build('/nonexistent',ROOT/'data/btc-test')
if __name__=='__main__':unittest.main()
