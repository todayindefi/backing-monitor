import copy,hashlib,importlib.util,json,pathlib,tempfile,unittest
spec=importlib.util.spec_from_file_location('component_projection',pathlib.Path('tools/issuer_component_projection.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
POLICY=json.loads(pathlib.Path('config/issuer_project_publication.json').read_text())

class ComponentContract(unittest.TestCase):
 def test_exact_selected_rows_and_missing_scopes(self):
  out={};m.add_components(out,POLICY)
  self.assertEqual(out['component_source']['status'],'available')
  self.assertEqual(len(out['component_profiles']),9)
  self.assertEqual(out['component_profiles']['strcx']['entities'][0]['name'],'Backed Assets (JE) Limited')
  self.assertEqual(out['component_profiles']['susdat']['facts'],[])
  self.assertEqual(out['component_profiles']['susdat']['coverage']['holder_rights']['state'],'not_exported')
  self.assertEqual(out['component_profiles']['apyusd']['facts'][0]['key'],'holder_rights')
  self.assertNotIn('pt-apxusd',out['component_profiles'])
  self.assertNotIn('strcon',out['component_profiles'])
  self.assertEqual(out['reference_components']['strcon']['entities'][0]['name'],'Ondo Global Markets (BVI) Limited')
  self.assertNotIn('scores',str(out))
 def test_changed_private_or_missing_contract_fails_closed_without_fallback(self):
  with tempfile.TemporaryDirectory() as d:
   p=pathlib.Path(d)/'changed.json';raw=json.loads(m.SOURCE.read_text());raw['components'][0]['facts'].append({'key':'private_note','value':'PRIVATE ACCOUNT SECRET'});p.write_text(json.dumps(raw));out={'projects':{'saturn':{'facts':[{'key':'holder_rights','value':'FAMILY FALLBACK MUST NOT BE USED'}]}}};m.add_components(out,POLICY,p)
   self.assertEqual(out['component_profiles']['susdat']['status'],'unavailable_selected_source')
   self.assertNotIn('PRIVATE ACCOUNT SECRET',str(out));self.assertEqual(out['reference_components'],{})
   m.add_components(out,POLICY,pathlib.Path(d)/'missing');self.assertEqual(out['component_profiles']['strcx']['facts'],[])
 def test_original_fact_status_clocks_and_direct_sources_are_exact(self):
  raw=json.loads(m.SOURCE.read_text());out={};m.add_components(out,POLICY)
  for c in raw['components']:
   p=(out['component_profiles'][c['riskanalyst_slug']] if c.get('riskanalyst_slug') else out['reference_components'][c['component_slug']])
   for a,b in zip(c['facts'],p['facts']):
    for key in ['value','status','basis','as_of','checked','source_date','source_urls']:self.assertEqual(a.get(key),b.get(key))
if __name__=='__main__':unittest.main()
