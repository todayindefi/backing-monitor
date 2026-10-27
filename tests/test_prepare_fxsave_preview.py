"""Consumer boundaries: reject mixed identity/baskets; never revive failed quotes."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest

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

if __name__=='__main__':unittest.main()
