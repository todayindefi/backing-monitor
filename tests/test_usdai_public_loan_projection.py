"""Public-export allowlist, raw units, source clocks and disclosure boundaries."""
import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from refresh_usdai_loan_dashboard import project,ENDPOINTS

ROOT=Path(__file__).resolve().parents[1]
KEY='16d5ab14-c601-401c-bd00-37884f877b66'


class PublicLoanProjection(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup);self.root=Path(self.temp.name)
        self.policy=json.loads((ROOT/'config/usdai_loan_dashboard_publication.json').read_text())
        daily={'asOf':1793953220,'series':[{'date':'2026-10-09','value':2},{'date':'2026-10-07','value':1}]}
        self.capture('loan-snapshot',{'asOf':1793953220,'current':{'deployed':2}})
        self.capture('proof-of-reserves',[{'type':'DEAL','documentId':KEY,'chain':42161,'name':'GPU model','apr':12,'borrower':'PRIVATE_BORROWER','locationLatitude':'PRIVATE_LOCATION'}])
        self.capture('future-yield-payments',{'asOf':1793953220,'payments':[{'dueAt':1794000000,'loanTermsHash':'hash','currency':{'symbol':'USDai','decimals':18},'principalAmount':.5,'interestAmount':.1}]})
        self.capture('principal-repaid-history',daily);self.capture('yield-repaid-history',daily)
        self.capture('default-rate',{'asOf':1793953220,'defaulted':0,'total':1})
        self.capture('document-schedules/'+KEY,{'loanId':KEY,'chainId':42161,'status':1,'currency':{'symbol':'USDai','decimals':18},'asOf':1793900000,
            'totalPrincipal':str(10**18),'totalInterest':str(10**17),'repayments':[{'dueAt':1794000000}]})

    def capture(self,name,data):
        path=ENDPOINTS.get(name,'/usdai/loans/42161/'+KEY+'/schedule')
        p=self.root/(name+'.json');p.parent.mkdir(parents=True,exist_ok=True);b=json.dumps(data).encode();p.write_bytes(b)
        (self.root/(name+'.receipt.json')).write_text(json.dumps({'url':'https://api.usd.ai'+path,'status':200,'requested_at':'2026-11-06T09:00:00Z','received_at':'2026-11-06T09:00:01Z','sha256':hashlib.sha256(b).hexdigest()}))

    def result(self):return json.loads(project(self.root,self.policy))

    def test_unit_and_clock_boundaries(self):
        d=self.result()
        self.assertEqual(d['population']['visible_remaining_principal'],'1')
        self.assertEqual(d['next_30_days_schedule']['principal'],'0.5')
        self.assertEqual(d['next_30_days_schedule']['interest'],'0.1')
        self.assertTrue(d['snapshot_computed_at'].startswith('2026-11-06'))
        self.assertNotEqual(d['schedule_source_range']['oldest'],d['snapshot_computed_at'])
        self.assertEqual(d['population']['scope_difference'],'1')

    def test_projection_does_not_publish_private_or_unapproved_fields(self):
        body=project(self.root,self.policy).decode()
        self.assertNotIn('PRIVATE_BORROWER',body);self.assertNotIn('PRIVATE_LOCATION',body)
        self.assertNotIn('borrower',body);self.assertNotIn('assessment_version',body)
        d=json.loads(body)
        self.assertEqual(set(d['loan_records'][0]),set(self.policy['allowed_record_fields']))
        self.assertIsNone(d['unverified']['arrears_aging'])
        self.assertIsNone(d['unverified']['funded_dsra'])
        self.assertIsNone(d['population']['verified_full_population_coverage'])

    def test_hash_or_url_mismatch_refused(self):
        p=self.root/'loan-snapshot.json';p.write_text('{}')
        with self.assertRaises(AssertionError):project(self.root,self.policy)

    def test_unexpected_source_refused(self):
        p=self.root/'loan-snapshot.receipt.json';d=json.loads(p.read_text());d['url']='https://other.example/loan-snapshot';p.write_text(json.dumps(d))
        with self.assertRaises(AssertionError):project(self.root,self.policy)

    def test_last_payment_date_uses_chronology_not_array_order(self):
        self.assertEqual(self.result()['reported_payment_history']['principal']['last_positive_reported_day'],'2026-10-09')

    def test_uninitialized_schedule_not_presented_as_active_principal(self):
        name='document-schedules/'+KEY;p=self.root/(name+'.json');d=json.loads(p.read_text());d['status']=0;self.capture(name,d)
        result=self.result();self.assertEqual(result['population']['reported_active_count'],0)
        self.assertEqual(result['population']['visible_remaining_principal'],'0')
        self.assertEqual(result['population']['other_status_count'],1)
        self.assertIsNone(result['population']['largest_five_visible_pct'])


if __name__=='__main__':unittest.main()
