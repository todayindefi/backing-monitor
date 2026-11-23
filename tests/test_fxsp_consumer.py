"""Synthetic, offline boundary tests. No native calls or real holder state."""
import copy,json,subprocess,sys,tempfile,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
import sync_fxsp_vault as c
ROOT=Path(__file__).resolve().parents[1]

def sample():
    src={'block_number':1,'block_hash':'0x'+'11'*32,'block_time':'2026-11-24T00:00:00Z','observed_at':'2026-11-24T00:00:10Z','built_at':'2026-11-24T00:00:11Z'}
    return {'schema_version':'fxsp-native/1','subject':{'chain_id':1,'address':c.ADDRESS,'symbol':'fxSP','decimals':18},'source':src,
      'financials':{'share_supply_raw':str(100*10**18),'yield_token':c.YIELD,'yield_decimals':18,'stable_token':c.STABLE,'stable_decimals':6,'tracked_yield_raw':str(40*10**18),'tracked_stable_raw':'59900000','direct_yield_raw':str(40*10**18),'direct_stable_raw':'0','nav_usd_per_share_raw':str(10**18),'effective_stable_raw':'60000000','reserved_shares_raw':None,'net_unencumbered_cash_raw':None},
      'strategy':{'status':'verified_supported','address':'0xd023aac0e2d46c93d4c6e8e2a449bf2d4687804f','asset':c.STABLE,'operator':c.ADDRESS,'receipt_token':c.RECEIPT,'pool':c.AAVE,'receipt_claim_raw':'60000000','principal_raw':None,'yield_allocation':{'address':None,'capacity_raw':'0'},'binding_source':src,'runtime_association':{'status':'verified'},'shared_lender_cash':{'amount_raw':None}},
      'marks':{'yield_price_raw':str(10**18),'stable_price_raw':str(10**18),'stable_price_with_scale_raw':str(10**30),'price_scale_raw':str(10**18),'source':src},
      'redemption':{'status':'view_only','input_token':c.ADDRESS,'input_decimals':18,'preview_input_raw':str(10**18),'preview_yield_raw':str(4*10**17),'preview_stable_raw':'600000','instant_fee_ratio_raw':str(10**16),'fee_scale_raw':str(10**18),'cooldown_seconds':3600,'source':src},
      'reconciliation':{'nav_matches':True,'preview_matches':True},'market':{'status':'not_monitored'},'refresh_interval_seconds':28800}

def status(s):
    return {'schema_version':'fxsp-refresh-status/1','refresh_interval_seconds':28800,'last_good':s['source'],'last_attempt':{'status':'success','attempted_at':'2026-11-24T00:00:00Z','completed_at':'2026-11-24T00:00:11Z'},'next_due_at':'2026-11-24T08:00:00Z'}
CONTROL={'as_of':'2026-11-17T05:23:11Z','block':26432647,'short_headline':'72h checked upgrade path'}
class ConsumerTests(unittest.TestCase):
    def test_exact_units_and_nonadditive_reconciliation(self):
        s=sample();view=c.projection(s,[s],status(s),CONTROL)
        self.assertFalse(view['preview']);self.assertEqual(view['observation']['refresh_interval_seconds'],28800)
        self.assertEqual(view['metrics']['marked_assets_usd'],'100');self.assertEqual(view['liquidity']['direct_usdc'],'0')
        self.assertEqual(view['liquidity']['strategy_claim_usdc'],'60');self.assertIsNone(view['liquidity']['unencumbered_cash_usd'])
        self.assertIsNone(view['metrics']['observed_return_pct']);self.assertEqual(view['sources']['at'],s['source']['block_time'])
        self.assertEqual(view['changes']['history_count'],1)
    def test_missing_shared_cash_does_not_become_zero(self):
        s=sample();self.assertIsNone(c.projection(s,[s],status(s),CONTROL)['liquidity']['shared_lender_usdc'])
    def test_rejects_wrong_identity_strategy_and_doublecount(self):
        for edit in [lambda s:s['subject'].update(address=c.STABLE),lambda s:s['strategy'].update(operator=c.STABLE),lambda s:s['financials'].update(effective_stable_raw='120000000'),lambda s:s['strategy']['runtime_association'].update(status='changed')]:
            s=sample();edit(s)
            with self.assertRaises(ValueError):c.normalization(s)
    def test_rejects_bad_marks_preview_and_mixed_pins(self):
        for edit in [lambda s:s['marks'].update(stable_price_with_scale_raw=str(10**18)),lambda s:s['redemption'].update(preview_stable_raw='999999'),lambda s:s['redemption'].update(source={'block_hash':'0x'+'ff'*32})]:
            s=sample();edit(s)
            with self.assertRaises(ValueError):c.normalization(s)
    def test_failed_attempt_retains_observation(self):
        s=sample();state=status(s);state['last_attempt']['status']='failed';state['last_attempt']['attempted_at']='2026-11-24T08:00:00Z'
        v=c.projection(s,[s],state,CONTROL);self.assertEqual(v['source_status']['status'],'failed');self.assertEqual(v['observation']['at'],s['source']['block_time'])
    def test_parent_nav_window_and_no_duplicate_current_point(self):
        s=sample();old=copy.deepcopy(s);old['source']={**s['source'],'block_number':0,'block_time':'2026-11-23T23:00:00Z'}
        parent=[{'block':0,'timestamp':old['source']['block_time'],'detail':{'identity':{'underlying':c.ADDRESS},'raw':{'spnav':str(10**18)}}},{'block':2,'timestamp':'2026-11-24T01:00:00Z','detail':{'identity':{'underlying':c.ADDRESS},'raw':{'spnav':str(10**18)}}}]
        rows=c.nav_history([old,s],s,parent);self.assertEqual(rows['count'],2)
    def test_change_is_nav_change_not_total_return(self):
        s=sample();prev=c.projection(s,[s],status(s),CONTROL);prev['observation']['at']='2026-11-23T16:00:00Z';prev['metrics']['share_nav_usd']='0.99'
        v=c.projection(s,[s],status(s),CONTROL,previous=prev);self.assertEqual(v['changes']['mode'],'tracked');self.assertIsNone(v['metrics']['observed_return_pct'])
    def test_source_status_snapshot_mismatch_rejected(self):
        s=sample();state=status(s);state['last_good']={'block_hash':'0x'+'ff'*32}
        with self.assertRaises(ValueError):c.public_status(state,s)
    def test_raw_unknown_not_zero(self):
        for value in [None,'',False,'NaN','-1',0]:
            with self.assertRaises(ValueError):c.integer(value)
    def test_intake_failure_preserves_exact_financial_bytes(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);src=root/'source';out=root/'out';src.mkdir();s=sample()
            (src/'fxsp_backing.json').write_text(json.dumps(s));(src/'fxsp_backing_history.json').write_text(json.dumps([s]));(src/'fxsp_backing_last_attempt.json').write_text(json.dumps(status(s)))
            policy={'address':c.ADDRESS,'publication_approved':True,'refresh_interval_seconds':28800,'source_root':str(src),'parent_nav_history':str(root/'absent')};p=root/'policy.json';p.write_text(json.dumps(policy))
            cmd=[sys.executable,str(ROOT/'tools/sync_fxsp_vault.py'),'--policy',str(p),'--output-root',str(out)]
            self.assertEqual(subprocess.run(cmd,capture_output=True).returncode,0);before=(out/'fxsp_backing.json').read_bytes()
            s['financials']['effective_stable_raw']='120000000';(src/'fxsp_backing.json').write_text(json.dumps(s))
            self.assertEqual(subprocess.run(cmd,capture_output=True).returncode,1);self.assertEqual((out/'fxsp_backing.json').read_bytes(),before)
            state=json.loads((out/'fxsp_source_status.json').read_text());self.assertEqual(state['status'],'failed');self.assertEqual(state['source_observed_at'],'2026-11-24T00:00:00Z');self.assertNotIn('/tmp/',json.dumps(state))
if __name__=='__main__':unittest.main()
