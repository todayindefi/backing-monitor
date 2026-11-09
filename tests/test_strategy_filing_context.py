import importlib.util,json,pathlib,tempfile,unittest
spec=importlib.util.spec_from_file_location('filing_context',pathlib.Path(__file__).resolve().parents[1]/'tools/build_strategy_filing_context.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class ContextTests(unittest.TestCase):
 def setUp(self):
  self.t=tempfile.TemporaryDirectory();self.addCleanup(self.t.cleanup);self.root=pathlib.Path(self.t.name);(self.root/'data').mkdir();self.reviews=self.root/'reviews';self.rdir=self.reviews/'strategy-8k-2026-11-09';self.rdir.mkdir(parents=True)
  self.base={'mstr_view':{'digital_credit_framework':{'filing_update':{'status':'available','filing_date':'2026-11-09','accession':'0001193125-26-452693','balances_as_of':'2026-11-08'}}}}
  self.review={'accession':'0001193125-26-452693','filing_date':'2026-11-09','balances_as_of':'2026-11-08','score_decision':'Retain authored scores','downstream_scope':{'strcx':'Wrapper route only'},'assessment_version':'v1','cash_change_usd':13500000}
  self.write()
 def write(self):
  (self.root/'data/strc_backing.json').write_text(json.dumps(self.base));(self.rdir/'results.json').write_text(json.dumps(self.review))
 def test_matching_owner_review(self):
  d=m.build(self.base,self.reviews);self.assertEqual(d['interpretation'],'Retain authored scores');self.assertEqual(d['financial_observations']['cash_change_usd'],13500000);self.assertIsNone(d['financial_observations']['reported_cash_allocation_usd']);self.assertEqual(len(d['source_review_sha256']),64)
 def test_wrong_accession_or_period(self):
  for key,value in [('accession','old'),('balances_as_of','2026-11-01')]:
   r=self.review.copy();r[key]=value;(self.rdir/'results.json').write_text(json.dumps(r))
   with self.assertRaises(ValueError):m.build(self.base,self.reviews)
 def test_absent_current_review_does_not_reuse_old(self):
  (self.rdir/'results.json').unlink();old=self.reviews/'strategy-8k-2026-11-02';old.mkdir();(old/'results.json').write_text(json.dumps(self.review));d=m.emit(self.root,self.reviews);self.assertEqual(d['status'],'unavailable');self.assertNotIn('downstream_scope',d);self.assertNotIn('interpretation',d)
 def test_bad_date_and_no_judgment(self):
  self.base['mstr_view']['digital_credit_framework']['filing_update']['filing_date']='../../elsewhere'
  with self.assertRaises(ValueError):m.build(self.base,self.reviews)
  self.base['mstr_view']['digital_credit_framework']['filing_update']['filing_date']='2026-11-09';self.review['score_decision']='';self.write()
  with self.assertRaises(ValueError):m.build(self.base,self.reviews)
if __name__=='__main__':unittest.main()
