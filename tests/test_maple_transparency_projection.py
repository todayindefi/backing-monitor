"""Public correction projection must not expose retired values or invent clocks."""
import copy
import importlib.util
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location('maple_projection',Path(__file__).resolve().parents[1]/'tools/project_maple_transparency.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class ProjectionTest(unittest.TestCase):
    def report(self):
        return {'asset_slug':'syrupusdc','asset_specific':{'issuer_transparency':{'retrieved_at':'2026-11-16T05:36:06Z','financial_observed_at':None,'loan_rows':{'internal':'raw dossier'},'queue_and_tooltips':['raw'],'collateral_wallet_inventory':[{'links':['wallet-link'],'title_or_control_verified':False}]},'loan_book':{'loans':[{'borrower':'same','collateral':{'asset':'BTC','usd':100,'usd_source':'issuer_transparency_ssr','amount':None,'valuation_observed_at':None,'raw_source':{'currentAssetAmount':'BAD'},'legacy_currentAssetAmount_model':{'status':'withdrawn','collateral':{'usd':999}},'publisher_transparency':{'underlying_quantity':None,'price_observed_at':None}}}]}}}

    def test_retired_values_dossiers_removed_and_null_clocks_preserved(self):
        report=self.report();before=copy.deepcopy(report);previous={'asset_specific':{'queue_review':{'observed_at':'older-queue-clock'}}}
        out=m.project(report,previous);self.assertEqual(report,before)
        s=out['asset_specific'];c=s['loan_book']['loans'][0]['collateral'];self.assertNotIn('raw_source',c);self.assertNotIn('collateral',c['legacy_currentAssetAmount_model']);self.assertEqual(c['usd'],100);self.assertIsNone(c['amount']);self.assertIsNone(c['valuation_observed_at']);self.assertIsNone(s['issuer_transparency']['financial_observed_at']);self.assertNotIn('loan_rows',s['issuer_transparency']);self.assertNotIn('collateral_wallet_inventory',s['issuer_transparency']);self.assertEqual(s['queue_review']['observed_at'],'older-queue-clock');self.assertFalse(s['issuer_transparency']['collateral_wallet_inventory_summary']['title_or_control_verified'])

    def test_equal_readings_do_not_establish_shared_or_separate_collateral(self):
        report=self.report();report['asset_specific']['loan_book']['loans']*=2
        out=m.project(report,{'asset_specific':{}});coverage=out['asset_specific']['credit_reading_coverage'];self.assertEqual(coverage['repeated_reading_group_count'],1);self.assertFalse(coverage['independent_allocation_verified'])

    def test_missing_source_cannot_use_legacy_fallback(self):
        report=self.report();del report['asset_specific']['issuer_transparency']
        with self.assertRaises(KeyError):m.project(report,{'asset_specific':{}})

if __name__=='__main__':unittest.main()
