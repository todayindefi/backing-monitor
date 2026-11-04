"""Versioned evidence primitives. No network, collectors, scoring or publication."""
import hashlib,json,pathlib,datetime
SCHEMA='shared-asset-evidence/1'
def canonical(value):return (json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False)+'\n').encode()
def digest(raw):return hashlib.sha256(raw).hexdigest()
def field(value,unit,owner,source_refs,clock,basis,status=None):
 return {'value':value,'unit':unit,'owner':owner,'source_refs':source_refs,'clock':clock,'basis':basis,'status':status or ('unknown' if value is None else 'observed')}
def walk_fields(value,path=''):
 if isinstance(value,dict):
  if {'value','owner','source_refs','clock','basis','status','unit'}<=value.keys():yield path,value
  else:
   for key,item in value.items():yield from walk_fields(item,path+'/'+key)
 elif isinstance(value,list):
  for i,item in enumerate(value):yield from walk_fields(item,path+'/'+str(i))
def validate(payload):
 assert payload['schema_version']==SCHEMA
 assert set(payload['axes'])=={'stability','backing','liquidity_exit','dependencies','contract_admin','issuer'}
 assert payload['publication']['status']=='local_candidate_not_authorized'
 for path,item in walk_fields(payload['axes']):
  assert item['owner'] and item['source_refs'] and isinstance(item['clock'],dict),path
  assert all(ref in payload['sources'] for ref in item['source_refs']),path
  assert item['value'] is not None or item['status'] not in ['observed','derived','measured'],path
  assert item['unit'] and item['basis'],path
 raw=canonical(payload).decode()
 for forbidden in ['profile_sha256','profile_followup_sha256','owner_public_address','private_wallet','/home/danger','source_sha256','evidence_sha256']:
  assert forbidden not in raw,forbidden
 return True

def write_bundle(output,payload,assessment,provenance):
 """Frozen bytes are content-addressed; source-file hashes stay in PRIVATE provenance."""
 output=pathlib.Path(output).resolve()
 if '.private-reviews' not in output.parts and not output.is_relative_to(pathlib.Path('/tmp')):raise ValueError('One-off pilot output must be local/private or /tmp, never a live data root')
 validate(payload);raw=canonical(payload);sha=digest(raw);evidence_id='sha256:'+sha
 snapshots=output/'snapshots';snapshots.mkdir(parents=True,exist_ok=True);target=snapshots/(sha+'.json')
 if target.exists():assert target.read_bytes()==raw,'immutable evidence collision'
 else:target.write_bytes(raw)
 araw=canonical(assessment);asha=digest(araw);assessments=output/'assessments';assessments.mkdir(exist_ok=True);apath=assessments/(asha+'.json')
 if apath.exists():assert apath.read_bytes()==araw
 else:apath.write_bytes(araw)
 # Rebuilding the same selected pair must not erase an external owner acceptance.
 prior={}
 try:prior=json.loads((output/'current.json').read_text())
 except (OSError,ValueError):pass
 pointer={'schema_version':'shared-asset-evidence-pointer/1','evidence_version':evidence_id,'snapshot':'snapshots/'+target.name,'snapshot_sha256':sha,'assessment_version':'sha256:'+asha,'assessment':'assessments/'+apath.name,'assessment_owner':'RiskAnalyst','assessment_binding':{'evidence_version':evidence_id,'assessment_version':'sha256:'+asha,'status':'proposed_pending_RiskAnalyst_acceptance'},'publication':'local_candidate_not_authorized'}
 if prior.get('evidence_version')==evidence_id and prior.get('assessment_version')=='sha256:'+asha and prior.get('assessment_binding',{}).get('status')=='accepted_for_bounded_report_use':pointer['assessment_binding']=prior['assessment_binding']
 tmp=output/'current.tmp';tmp.write_bytes(canonical(pointer));tmp.replace(output/'current.json')
 provenance={**provenance,'evidence_version':evidence_id,'assessment_version':'sha256:'+asha,'assembled_at':datetime.datetime.now(datetime.timezone.utc).isoformat()};(output/'provenance.private.json').write_bytes(canonical(provenance))
 coverage={axis:{'status':'bounded_with_explicit_gaps','fields':{path.split('/fields/',1)[-1]:{'owner':f['owner'],'status':f['status'],'source_refs':f['source_refs'],'clock':f['clock']} for path,f in walk_fields(value)}} for axis,value in payload['axes'].items()};(output/'coverage.json').write_bytes(canonical(coverage))
 return pointer

def read_selected(output):
 output=pathlib.Path(output);p=json.loads((output/'current.json').read_text());raw=(output/p['snapshot']).read_bytes();assert digest(raw)==p['snapshot_sha256'] and p['evidence_version']=='sha256:'+digest(raw),'selected evidence hash mismatch';payload=json.loads(raw);validate(payload);assessment_raw=(output/p['assessment']).read_bytes();assert 'sha256:'+digest(assessment_raw)==p['assessment_version'],'assessment hash mismatch';a=json.loads(assessment_raw);assert p['assessment_binding']['evidence_version']==p['evidence_version'] and p['assessment_binding']['assessment_version']==p['assessment_version'],'binding mismatch';assert a['asset']==payload['identity']['component'] and a['chain']==payload['identity']['chain'] and a['token'].lower()==payload['identity']['token'].lower(),'assessment identity mismatch';return p,payload
