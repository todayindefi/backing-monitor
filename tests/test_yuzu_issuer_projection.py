"""Yuzu publication boundary and source/component scope."""
import importlib.util,json,pathlib,sqlite3,tempfile,unittest
spec=importlib.util.spec_from_file_location('projection',pathlib.Path('tools/build_issuer_project_evidence.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class YuzuProjection(unittest.TestCase):
 def test_selected_fields_and_changed_private_record(self):
  feed=m.build();p=feed['projects']['yuzu-money']
  self.assertEqual(feed['asset_map']['syzusd'],{'project':'yuzu-money','component':'syzusd'})
  self.assertEqual(len(p['facts']),13)
  self.assertNotIn('summary',p);self.assertNotIn('tvl',p)
  self.assertIn('not independently verified',p['entities'][0]['note'])
  self.assertEqual(next(x for x in p['facts'] if x['key']=='syz_yield')['component'],'syzusd')
  self.assertEqual(next(x for x in p['facts'] if x['key']=='governing_law')['as_of'],'2026-04-15')
  old=m.DB
  with tempfile.TemporaryDirectory() as d:
   db=pathlib.Path(d)/'projects.db';src=sqlite3.connect('file:'+str(old)+'?mode=ro',uri=True);dest=sqlite3.connect(db);src.backup(dest);src.close()
   dest.execute("update facts set value='UNREVIEWED PRIVATE CHANGE' where project_slug='yuzu-money' and key='primary_access'");dest.commit();dest.close();m.DB=db
   try:
    changed=m.build();self.assertNotIn('UNREVIEWED PRIVATE CHANGE',json.dumps(changed));self.assertGreater(changed['projects']['yuzu-money']['withheld_records'],0)
   finally:m.DB=old
if __name__=='__main__':unittest.main()
