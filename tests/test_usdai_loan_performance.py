"""Financial unit, perimeter, clock and unknown-state checks; private fixtures."""
import json
import sys
import tempfile
import unittest
from decimal import Decimal as D
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from build_usdai_loan_performance import build,rolling
from shared_asset_evidence import digest
ROOT=Path(__file__).resolve().parents[1]/'.private-reviews/usdai-loan-performance-2026-11-06'


@unittest.skipUnless((ROOT/'raw/v1/input-manifest.private.json').exists(),'private fixture unavailable')
class LoanEvidenceChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        p=json.loads((ROOT/'packages/current.json').read_text())
        cls.d=json.loads((ROOT/'packages'/p['snapshot']).read_text())

    def test_active_vs_pipeline_status(self):
        rows=self.d['loan_population']['tape']
        self.assertEqual(len(rows),27)
        self.assertEqual(sum(x['schedule_status_raw']==1 for x in rows),21)
        self.assertEqual(sum(x['schedule_status_raw']==0 for x in rows),6)
        self.assertEqual(len({x['document_id']for x in rows}),27)

    def test_raw_schedule_unit_scaling(self):
        for row in self.d['loan_population']['tape']:
            raw=json.loads((ROOT/'raw/v1/document-schedules'/(row['document_id']+'.json')).read_text())
            self.assertEqual(D(row['remaining_scheduled_principal']),D(raw['totalPrincipal'])/D(10)**18)
            self.assertEqual(row['reference_currency']['decimals'],18)

    def test_partial_population_not_forced_reconciled(self):
        r=self.d['loan_population']['reconciliation']['value']
        self.assertLess(abs(D(r['future_vs_schedule_rounding_residual'])),D('.001'))
        self.assertGreater(D(r['api_minus_visible_schedule_principal']),D('128000000'))
        self.assertIsNone(r['verified_full_population_coverage'])
        self.assertAlmostEqual(float(r['visible_vs_api_dollar_comparison_pct']),57.8503,places=3)

    def test_zero_default_counter_not_zero_arrears(self):
        p=self.d['loan_population']
        self.assertEqual(p['reported_liquidation_event_incidence']['value']['defaulted'],0)
        self.assertIn('not all arrears',p['reported_liquidation_event_incidence']['basis'])
        self.assertIsNone(p['actual_arrears_buckets']['value'])
        self.assertTrue(all(x['days_past_due']is None for x in p['tape']))

    def test_empty_queue_not_zero_native_obligations(self):
        q=self.d['cash_and_queue']
        self.assertEqual(q['issuer_queue']['value']['items'],[])
        self.assertGreater(D(q['native_observations']['value']['pending_share_identity_residual']),D('424000'))
        self.assertIsNone(q['complete_cash_flow_bridge'])
        self.assertIsNone(q['verified_glx_settlements'])

    def test_telemetry_and_protection_not_manufactured(self):
        p=self.d['collateral_and_protection']
        self.assertIn('Always true',p['hardware_health_schema']['value']['properties']['isHealthy']['description'])
        self.assertIsNone(p['funded_dsra'])
        self.assertIsNone(p['current_independent_appraisal'])
        self.assertIsNone(p['verified_current_guaranteed_payout'])
        self.assertEqual(len(p['issuer_monthly_vsa_curves']),17)

    def test_haircuts_are_conditional_ltv_not_losses(self):
        s=self.d['collateral_and_protection']['mechanical_haircut_scenarios']['value']
        self.assertEqual([D(x['collateral_haircut_pct'])for x in s],[D(20),D(30),D(40)])
        self.assertGreater(D(s[1]['mechanical_implied_ltv_pct']),100)
        self.assertTrue(all(x['measured_loan_loss']is None and x['measured_nav_loss']is None for x in s))

    def test_history_and_aup_clocks(self):
        h=self.d['collateral_and_protection']['historical_independent_aup']
        self.assertEqual(h['snapshot_date'],'2026-07-15')
        self.assertEqual(h['issued_date'],'2026-08-25')
        self.assertTrue(any(x['schedule_as_of'].startswith('2026-11-05')for x in self.d['loan_population']['tape']))
        for data in self.d['payments']['reported_daily_series_comparisons'].values():
            self.assertEqual(data['last_positive_reported_day'],'2026-06-26')
            self.assertEqual(data['windows']['90']['reported_amount'],'0')
            self.assertTrue(data['windows']['90']['complete_reported_calendar'])
        self.assertIsNone(self.d['payments']['verified_loan_level_receipts'])

    def test_frozen_hash_and_rebuild(self):
        with tempfile.TemporaryDirectory()as t:
            out=Path(t)/'.private-reviews/packages';p=build(ROOT/'raw/v1',out)
            self.assertEqual(p,build(ROOT/'raw/v1',out))
            self.assertEqual(p['evidence_version'],'sha256:'+digest((out/p['snapshot']).read_bytes()))
            self.assertIsNone(p['assessment_version']);self.assertEqual(p['publication'],'not_authorized')


if __name__=='__main__':unittest.main()
