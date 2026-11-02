import importlib.util,pathlib,tempfile,sqlite3,json,unittest
spec=importlib.util.spec_from_file_location('projection',pathlib.Path('tools/build_issuer_project_evidence.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Publication(unittest.TestCase):
 def test_private_addition_and_change_withheld(self):
  original_db,original_policy=m.DB,m.POLICY
  with tempfile.TemporaryDirectory() as d:
   db=pathlib.Path(d)/'db.sqlite';src=sqlite3.connect('file:'+str(original_db)+'?mode=ro',uri=True);dest=sqlite3.connect(db);src.backup(dest);src.close()
   policy=json.loads(original_policy.read_text());f=pathlib.Path(d)/'policy.json';f.write_text(json.dumps(policy));m.DB,m.POLICY=db,f
   try:
    row=dest.execute("select id from facts where project_slug='saturn' and key='holder_rights'").fetchone();dest.execute('update facts set value=? where id=?',('PRIVATE SECRET HOLDER NOTE',row[0]));dest.execute("insert into facts(project_slug,topic,key,value,status,source,visibility) values('saturn','issuer','access_restriction','PRIVATE NEW NOTE','verified','https://example.com','private')");dest.commit();dest.close()
    result=m.build();raw=json.dumps(result);self.assertNotIn('PRIVATE SECRET',raw);self.assertNotIn('PRIVATE NEW',raw);self.assertGreaterEqual(result['projects']['saturn']['withheld_records'],2)
   finally:m.DB,m.POLICY=original_db,original_policy
if __name__=='__main__':unittest.main()
