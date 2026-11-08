import copy,hashlib,importlib.util,json,pathlib,tempfile,unittest
spec=importlib.util.spec_from_file_location('component_projection',pathlib.Path('tools/issuer_component_projection.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
POLICY=json.loads(pathlib.Path('config/issuer_project_publication.json').read_text())

class ComponentContract(unittest.TestCase):
 def test_exact_selected_rows_and_missing_scopes(self):
  out={};m.add_components(out,POLICY)
  self.assertEqual(out['component_source']['status'],'available')
  self.assertEqual(len(out['component_profiles']),len(POLICY['reviewed_component_contract']['reserved_assets'])+sum(len(x['reserved_assets']) for x in POLICY.get('additional_reviewed_component_contracts',[])))
  self.assertEqual(out['component_profiles']['strcx']['entities'][0]['name'],'Backed Assets (JE) Limited')
  self.assertEqual(out['component_profiles']['susdat']['facts'],[])
  self.assertEqual(out['component_profiles']['susdat']['coverage']['holder_rights']['state'],'not_exported')
  self.assertEqual(out['component_profiles']['apyusd']['facts'][0]['key'],'holder_rights')
  self.assertNotIn('pt-apxusd',out['component_profiles'])
  self.assertNotIn('strcon',out['component_profiles'])
  self.assertEqual(out['reference_components']['strcon']['entities'][0]['name'],'Ondo Global Markets (BVI) Limited')
  self.assertNotIn('scores',out)
  for profile in out['component_profiles'].values():
   self.assertNotIn('scores',profile)
   self.assertNotIn('issuer_score',profile)
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


class SupplementalContract(unittest.TestCase):
 def candidate(self):
  return {'schema_version':1,'kind':'reviewed-public-source-snapshot','producer':'DeFiAnalyst','checked':'2026-11-07',
   'components':[{'visibility':'public','project_slug':'alto','component_slug':'dusd-alto','riskanalyst_slug':'dusd-alto','name':'DUSD',
    'profile_checked':'2026-11-02','entities':[], 'facts':[{'key':'holder_rights','value':None,'status':'unknown','basis':'published-document',
     'as_of':None,'checked':'2026-11-07','source_date':None,'source_urls':['https://example.com/terms'],
     'observation_dates':{'reviewed_at':'2026-11-07T01:00:00Z'}}], 'coverage':{'holder_rights':{'state':'unknown','meaning':'No issuer substitution'}},'limitations':['No upstream rights']} ]}
 def test_additional_source_changed_isolated_from_legacy(self):
  with tempfile.TemporaryDirectory() as td:
   p=pathlib.Path(td)/'public.json';p.write_text(json.dumps(self.candidate()))
   policy=copy.deepcopy(POLICY);policy['additional_reviewed_component_contracts']=[{'source_path':str(p),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),
    'reserved_assets':{'dusd-alto':{'project':'alto','component':'dusd-alto','name':'DUSD'}}}]
   out={};m.add_components(out,policy);self.assertEqual(out['component_profiles']['dusd-alto']['status'],'available_selected_fields')
   self.assertEqual(out['component_profiles']['dusd-alto']['facts'][0]['observation_dates']['reviewed_at'],'2026-11-07T01:00:00Z')
   raw=self.candidate();raw['components'][0]['facts'][0]['value']='PRIVATE UNAPPROVED';p.write_text(json.dumps(raw))
   out={'projects':{'alto':{'facts':[{'key':'holder_rights','value':'FAMILY MUST NOT SUBSTITUTE'}]}}};m.add_components(out,policy)
   self.assertEqual(out['component_profiles']['dusd-alto']['status'],'unavailable_selected_source')
   self.assertEqual(out['component_profiles']['strc']['status'],'available_selected_fields')
   self.assertEqual(out['component_profiles']['dusd-alto']['facts'],[])
   self.assertNotIn('PRIVATE UNAPPROVED',str(out))
 def test_exact_additional_identity_required_even_when_hash_matches(self):
  with tempfile.TemporaryDirectory() as td:
   p=pathlib.Path(td)/'public.json';raw=self.candidate();raw['components'][0]['component_slug']='different';p.write_text(json.dumps(raw))
   policy=copy.deepcopy(POLICY);policy['additional_reviewed_component_contracts']=[{'source_path':str(p),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),
    'reserved_assets':{'dusd-alto':{'project':'alto','component':'dusd-alto','name':'DUSD'}}}]
   out={};m.add_components(out,policy);self.assertEqual(out['component_profiles']['dusd-alto']['status'],'unavailable_selected_source')

if __name__=='__main__':unittest.main()
