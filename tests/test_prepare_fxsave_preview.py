"""Consumer boundaries: reject mixed identity/baskets; never revive failed quotes."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest
import tempfile
import hashlib

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('prepare_fxsave',ROOT/'tools/prepare_fxsave_preview.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class FxSaveTransport(unittest.TestCase):
    def setUp(self):
        self.base=json.loads((ROOT/'previews/fxsave/data/fxsave_backing.json').read_text())
        self.ladder=json.loads((ROOT/'tests/fixtures/fxsave_quote_rung.json').read_text())
    def test_identity_and_raw_custody_are_checked(self):
        m.validate_base(self.base)
        self.base['asset_specific']['fxsave']['raw']['custody']='1'
        with self.assertRaises(ValueError):m.validate_base(self.base)
    def test_missing_payout_leg_and_independent_ratio_are_rejected(self):
        for mutate in [lambda d:d['asset_specific']['fxsave']['redemption']['instant'].pop('usdc_per_share'),lambda d:d['backing'].update(collateral_ratio=100)]:
            d=copy.deepcopy(self.base);mutate(d)
            with self.assertRaises(ValueError):m.validate_base(d)
    def test_mixed_input_and_double_counted_direct_usdc_are_rejected(self):
        d=copy.deepcopy(self.ladder);d['rows'][0]['fxusd_market']['input_raw']='1'
        with self.assertRaises(ValueError):m.compact_ladder(d)
        d=copy.deepcopy(self.ladder);d['rows'][0]['fxusd_market_bps']+=10
        with self.assertRaises(ValueError):m.compact_ladder(d)
    def test_native_history_identity_units_and_source_pair(self):
        entries=[{'timestamp':'2026-10-26T00:00:00Z','block':123,'nav_usd':1.125}]
        asset={'metadata':{'chain':'ethereum','contract_address':m.ADDRESS,'price_units':'USD/share'},'history':[{'timestamp':entries[0]['timestamp'],'block':123,'theoretical_price':1.125,'market_price':None,'price_units':'USD/share'}]}
        native={'assets':{'fxSAVE':asset}}
        out=m.price_history_for_preview(native,entries)
        self.assertIsNone(out['entries'][0]['peg_market_price'])
        for mutate in [lambda a:a['metadata'].update(chain='plasma'),lambda a:a['history'][0].update(price_units='USD'),lambda a:a['history'][0].update(theoretical_price=2),lambda a:a['history'][0].update(market_price=1.12)]:
            d=copy.deepcopy(native);mutate(d['assets']['fxSAVE'])
            with self.assertRaises(ValueError):m.price_history_for_preview(d,entries)

    def test_v2_usd_conversion_and_missing_reference(self):
        d=copy.deepcopy(self.ladder)
        d['schema_version']='fxsave-liquidity/2'
        d['market_marks']={'usdc':{'status':'ok','usd_per_token':0.99}}
        for row in d['rows']:
            row['direct_bps']=(row['direct']['usdc_out']*0.99/row['size_nav_usd']-1)*1e4
            total=row['fxusd_market']['usdc_out']+int(row['instant']['usdc_raw'])/1e6
            row['fxusd_market_bps']=(total*0.99/row['size_nav_usd']-1)*1e4
        self.assertEqual(m.compact_ladder(d)['rows'][0]['usdc_usd_mark'],0.99)
        d['market_marks']['usdc']['status']='failed'
        with self.assertRaises(ValueError):m.compact_ladder(d)

    def test_failed_quote_is_not_replaced_with_retained_proceeds(self):
        row=self.ladder['rows'][0]
        row['direct']={'status':'quote_failed','as_of':'2026-10-21T11:00:00Z','last_good':{'quote':{'as_of':'2026-10-20T11:00:00Z','usdc_out':999}}}
        out=m.compact_ladder(self.ladder)['rows'][0]['direct']
        self.assertIsNone(out['usdc_out'])
        self.assertEqual(out['retained_quote_as_of'],'2026-10-20T11:00:00Z')
        self.assertNotIn('last_good',out)


class FxSaveAdverseObservation(unittest.TestCase):
    def test_consistent_adverse_custody_is_retained(self):
        base=json.loads((ROOT/'previews/fxsave/data/fxsave_backing.json').read_text())
        detail=base['asset_specific']['fxsave']
        detail['raw']['custody']=str(int(detail['raw']['assets'])-1)
        detail['accounting'].update(status='mismatch',accounting_difference_raw='-1')
        self.assertEqual(m.validate_base(base)['accounting']['status'],'mismatch')
    def test_venue_inventory_preserves_null_tvl(self):
        inventory={'as_of':'2026-10-22','scope':'partial Curve','pools':[{'address':'0xpool','coinsAddresses':[m.ADDRESS],'usdTotal':None}]}
        result=m.compact_inventory(inventory)
        self.assertIsNone(result['pools'][0]['tvl_usd'])
        self.assertEqual(result['pools'][0]['assets'],['fxsave'])

class FxSaveSourceSelection(unittest.TestCase):
    def make_policy(self, root):
        receipt=root/'review.json';receipt.write_text('{"status":"accepted","asset":"fxsave"}')
        records={}
        for suffix in m.EDITORIAL_INPUTS:
            p=root/(suffix+'.json');doc={'asset':'fxsave','assessment_version':'assessment-v1','evidence_version':'evidence-v1','issuer':{'profile_sha256':'private'}}
            if suffix=='assessment':doc.update(schema_version='asset-assessment/1',chain='ethereum',address=m.ADDRESS,assessment_version='assessment-v1',evidence_version='evidence-v1',scores={'overall':4.5,'liquidity':3.5},source_clocks={'quotes_block':'2026-11-10T00:00:00Z'},last_verified='2026-09-22',status='retained',unknowns=['pause'],assessment_reviewed='2026-11-10',profile_sha256='private')
            p.write_text(json.dumps(doc))
            records[suffix]={'path':str(p),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
        policy={'asset_slug':'fxsave','chain_id':'eip155:1','address':m.ADDRESS,'measurement_root':str(root/'normal'),'exit_root':str(root/'exits'),'editorial_review':{'path':str(receipt),'sha256':hashlib.sha256(receipt.read_bytes()).hexdigest()},'editorial_files':records,'evidence_version':'evidence-v1','assessment_version':'assessment-v1'}
        path=root/'policy.json';path.write_text(json.dumps(policy));return path,policy
    def test_accepted_policy_selects_normal_and_pinned_owner_files(self):
        with tempfile.TemporaryDirectory()as d:
            p,policy=self.make_policy(Path(d));peg,dex,docs,selection=m.source_selection(p)
            self.assertEqual(str(peg),policy['measurement_root']);self.assertEqual(str(dex),policy['exit_root'])
            self.assertEqual(set(docs),set(m.EDITORIAL_INPUTS));self.assertEqual(selection['assessment_version'],'assessment-v1');self.assertNotIn('profile_sha256',json.dumps(docs))
    def test_bad_review_or_export_cannot_fall_back_to_older_commit(self):
        for target in ['review','assessment']:
            with self.subTest(target=target),tempfile.TemporaryDirectory()as d:
                p,policy=self.make_policy(Path(d));Path(d,target+'.json').write_text('{}')
                with self.assertRaisesRegex(ValueError,'hash mismatch'):m.source_selection(p)
    def test_valid_hash_does_not_accept_mixed_export_version(self):
        with tempfile.TemporaryDirectory()as d:
            p,policy=self.make_policy(Path(d));doc_path=Path(policy['editorial_files']['issuer']['path']);doc=json.loads(doc_path.read_text());doc['assessment_version']='old';doc_path.write_text(json.dumps(doc));policy['editorial_files']['issuer']['sha256']=hashlib.sha256(doc_path.read_bytes()).hexdigest();p.write_text(json.dumps(policy))
            with self.assertRaisesRegex(ValueError,'Mixed editorial'):m.source_selection(p)
    def test_pending_review_is_not_accepted_by_hash_alone(self):
        with tempfile.TemporaryDirectory()as d:
            p,policy=self.make_policy(Path(d));r=Path(policy['editorial_review']['path']);r.write_text('{"asset":"fxsave","status":"pending"}');policy['editorial_review']['sha256']=hashlib.sha256(r.read_bytes()).hexdigest();p.write_text(json.dumps(policy))
            with self.assertRaisesRegex(ValueError,'not an accepted'):m.source_selection(p)
    def test_policy_wrong_chain_is_rejected(self):
        with tempfile.TemporaryDirectory()as d:
            p,policy=self.make_policy(Path(d));policy['chain_id']='eip155:9745';p.write_text(json.dumps(policy))
            with self.assertRaisesRegex(ValueError,'identity mismatch'):m.source_selection(p)
    def test_legacy_mode_is_explicit_without_policy(self):
        with tempfile.TemporaryDirectory()as d:
            self.assertEqual(m.source_selection(Path(d)/'absent.json')[3]['mode'],'retained_editorial_commit')
    def test_archived_native_points_require_identity_units_and_raw_call(self):
        row={'timestamp':'2026-10-11T00:00:00Z','block':123,'block_hash':'0xblock','identity':{'address':m.ADDRESS,'underlying':'0x65c9a641afceb9c0e6034e558a319488fa0fa3be'},'price_units':'USD/share','nav_raw':'1125000000000000000','theoretical_price':1.125,'raw_calls':[{'signature':'nav()','to':m.ADDRESS,'block':123,'result_hex':hex(1125000000000000000)}]}
        native={'assets':{'fxSAVE':{'metadata':{'chain':'ethereum','contract_address':m.ADDRESS,'price_units':'USD/share'},'history':[{'timestamp':row['timestamp'],'block':123,'theoretical_price':1.125,'market_price':None,'price_units':'USD/share'}]}}}
        self.assertEqual(m.price_history_for_preview(native,[],{'rows':[row]})['entries'][0]['block'],123)
        for mutate in [lambda r:r['identity'].update(address='0xwrong'),lambda r:r.update(price_units='USD'),lambda r:r.update(nav_raw='1'),lambda r:r['raw_calls'][0].update(block=124)]:
            bad=copy.deepcopy(row);mutate(bad)
            with self.assertRaises(ValueError):m.price_history_for_preview(native,[],{'rows':[bad]})
        with self.assertRaisesRegex(ValueError,'contradiction'):m.price_history_for_preview(native,[{'timestamp':row['timestamp'],'block':124,'nav_usd':1.125}],{'rows':[row]})

if __name__=='__main__':unittest.main()
