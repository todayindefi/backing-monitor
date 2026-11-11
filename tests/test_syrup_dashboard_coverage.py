import copy
import importlib.util
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location('coverage_gate',Path(__file__).resolve().parents[1]/'tools/check_syrup_dashboard_coverage.py')
gate=importlib.util.module_from_spec(spec);spec.loader.exec_module(gate)

class CoverageRegression(unittest.TestCase):
    def setUp(self):
        self.report={'asset_slug':'syrupusdc','report_url':'https://example.com/report',
                     'peg':{'market_price':1.19,'nav':1.20,'premium_discount_pct':-0.83,'source':'dated-source','history_ref':'syrupusdc_backing_history.json','history_field':'peg_market_price'},
                     'backing':{'total_backing':1000},'liquidity':{'free_liquidity_pct':10},
                     'dependencies':{'upstream':[{'name':'Borrower credit'}]},'issuer':{'curator':'Maple'},
                     'asset_specific':{'vault_state':{'pool':gate.IDENTITIES['syrupusdc'],'free_usdc':100,'total_assets':1000,'free_liquidity':150},'axis_thresholds':{'backing':{'cr_pct':[101,100,98,95]}},'peg':{'market_price':1.19,'timestamp':'2026-11-11T05:17:52Z'},'liquidity':{'timestamp':'2026-11-11T04:00:00Z'}}}
        self.retained=copy.deepcopy(self.report)
        self.history={'entries':[{'timestamp':t,'peg_market_price':1.19,'peg_theoretical_price':1.20}for t in ['2026-11-10T00:00:00Z','2026-11-11T00:00:00Z']]}
    def test_complete_dated_measurements_pass(self):
        self.assertEqual(gate.check(self.report,self.history,self.retained)['status'],'passed')
    def test_scores_do_not_replace_measured_blocks(self):
        d=copy.deepcopy(self.report)
        for axis in ['peg','liquidity','backing','dependencies','issuer']:d.pop(axis)
        d['peg']={'volatility_score':8.5}
        self.assertEqual(gate.check(d,self.history,self.retained)['status'],'failed')
    def test_interest_cannot_be_instant_cash(self):
        self.report['liquidity']['free_liquidity_pct']=15
        self.assertIn('instant cash metric includes noncash accrual or wrong clock',gate.check(self.report,self.history,self.retained)['failures'])
    def test_canvas_without_real_paired_series_fails(self):
        self.history['entries']=self.history['entries'][:1]
        self.assertEqual(gate.check(self.report,self.history,self.retained)['status'],'failed')
    def test_missing_market_clock_fails(self):
        self.report['asset_specific']['peg'].pop('timestamp')
        self.assertEqual(gate.check(self.report,self.history,self.retained)['status'],'failed')

if __name__=='__main__':unittest.main()
