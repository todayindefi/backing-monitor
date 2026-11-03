import importlib.util,pathlib,unittest
spec=importlib.util.spec_from_file_location('overlay',pathlib.Path('tools/copy_public_axis_overlay.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class CopyBoundary(unittest.TestCase):
 def test_remove_nested_private_bookkeeping_preserve_source_scores_and_clocks(self):
  source={'as_of':'2026-09-10','issuer':{'issuer_score':5.0,'facts':['public'],'profile_sha256':'private'},'extra':[{'profile_sha256':'private','checked':'2026-11-04'}]}
  result=m.public_overlay(source)
  self.assertEqual(result,{'as_of':'2026-09-10','issuer':{'issuer_score':5.0,'facts':['public']},'extra':[{'checked':'2026-11-04'}]})
  self.assertEqual(source['issuer']['profile_sha256'],'private')
if __name__=='__main__':unittest.main()
