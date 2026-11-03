"""Public-safe RO projection of DeFiAnalyst; no scores or private DB exposure."""
import argparse,datetime,hashlib,json,pathlib,sqlite3,sys
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent))
from issuer_component_projection import add_components
ROOT=pathlib.Path(__file__).resolve().parents[1];DB=pathlib.Path('/home/danger/DeFiAnalyst/db/projects.db');POLICY=ROOT/'config/issuer_project_publication.json'
KEYS=['governing_law','dispute_mechanism','holder_rights','access_restriction','financial_audit','governance_path']
def fingerprint(row):
 clean={k:v for k,v in row.items() if k not in ['id','event_id','visibility']}
 return hashlib.sha256(json.dumps(clean,sort_keys=True,separators=(',',':')).encode()).hexdigest()
def urls(value):return [s.strip() for s in str(value or '').split(';') if s.strip().startswith('https://')]
def records(c,slug,keys=None):
 entities=[dict(x) for x in c.execute('select * from entities where project_slug=?',(slug,))]
 facts=[dict(x) for x in c.execute("select * from facts where project_slug=?",(slug,)) if x['key'] in (keys or KEYS) and (keys is not None or x['topic']=='issuer')]
 gov=[dict(x) for x in c.execute('select e.*,g.stage,g.outcome,g.executed_at,g.evidence,g.initiative_id,g.component_slug from events e join governance_events g on g.event_id=e.id where g.project_slug=? order by e.date desc',(slug,))]
 news=[dict(x) for x in c.execute("select e.* from events e join event_projects ep on ep.event_id=e.id where ep.slug=? and ep.relation='subject' and e.source_kind='curated' order by e.date desc",(slug,))]
 # Stable initiative/source identities, never fuzzy title matching.
 chosen=[];seen=set()
 for x in gov:
  group=x.get('initiative_id') or str(x.get('source_ref','')).removesuffix(':execution').removesuffix(':exec')
  if group in seen:continue
  seen.add(group);chosen.append(x)
 return {'entities':entities,'facts':facts,'events':chosen[:5]+news[:3]}
def build(pilot=None):
 c=sqlite3.connect('file:'+str(DB)+'?mode=ro',uri=True);c.row_factory=sqlite3.Row
 if pilot:
  policy={**(json.loads(POLICY.read_text()) if POLICY.exists() else {}),'authorization':'Owner approved structured public issuer pilot on2026-11-02; reviewed public-source fields only. Private defaults unchanged. New/changed private records require a new publication review.','projects':pilot,'approved_fingerprints':[]}
  for slug in pilot:
   for kind,items in records(c,slug).items():
    for r in items:
     evidence=json.loads(r.get('evidence') or '[]') if kind=='events' and r.get('source_kind')=='gov' else urls(r.get('source'))
     if evidence and all(str(u).startswith('https://') for u in evidence):policy['approved_fingerprints'].append(fingerprint(r))
  POLICY.write_text(json.dumps(policy,indent=2)+'\n')
 policy=json.loads(POLICY.read_text());approved=set(policy['approved_fingerprints']);out={'schema_version':'issuer-project-evidence/1','publisher':'BM public projection of DeFiAnalyst','source_owner':'DeFiAnalyst','judgment_owner':'RiskAnalyst','generated_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'available','asset_map':{},'projects':{}}
 importrow=c.execute('select * from governance_import').fetchone();imported=dict(importrow) if importrow else {'status':'missing'};govclock=imported.get('generated_at')
 for slug in policy['projects']:
  p=c.execute('select * from projects where slug=?',(slug,)).fetchone()
  if not p:continue
  components=[dict(x) for x in c.execute('select slug,riskanalyst_slug from components where project_slug=?',(slug,))]
  for x in components:
   if x['riskanalyst_slug']:out['asset_map'][x['riskanalyst_slug']]={'project':slug,'component':x['slug']}
  fields=policy.get('project_fields',{}).get(slug);keys=[x['key'] for x in fields] if fields else KEYS
  items=records(c,slug,keys);data={'name':p['name'],'profile_checked':p['profile_checked'],'entities':[],'facts':[],'events':[],'withheld_records':0}
  if fields:data['display_fields']=fields
  for kind,rs in items.items():
   for r in rs:
    if r.get('visibility')!='public' and fingerprint(r) not in approved:data['withheld_records']+=1;continue
    if kind=='events':
     if policy.get('project_event_holds',{}).get(slug):continue
     evidence=json.loads(r.get('evidence') or '[]') if r.get('source_kind')=='gov' else urls(r.get('source'))
     evidence=[u for u in evidence if str(u).startswith('https://')]
     if not evidence:continue
     executed=bool(r.get('executed_at') and any('/tx/0x' in u for u in evidence))
     outcome=r.get('outcome');stage=r.get('stage') or r.get('change_stage') or 'reported'
     label='Executed · tracker evidence' if executed and outcome=='executed' else 'Execution reported · evidence incomplete' if outcome=='executed' else 'Passed · execution unverified' if outcome=='passed' else str(outcome or stage).replace('_',' ').capitalize()
     data[kind].append({'id':str(r.get('source_ref') or r['id']),'initiative_id':r.get('initiative_id'),'date':r['date'],'title':r['title'],'stage':stage,'outcome':outcome,'executed_at':r.get('executed_at'),'label':label,'sources':evidence,'component':r.get('component_slug'),'source_owner':'govAnalyst' if r.get('source_kind')=='gov' else 'DeFiAnalyst','changes_profile_automatically':False})
    else:
     row_fields=['role','name','jurisdiction','vehicle'] if kind=='entities' else ['key','value']
     data[kind].append({**{k:r.get(k) for k in row_fields},'component':r.get('component_slug'),'status':r['status'],'basis':r.get('basis'),'as_of':r.get('as_of'),'checked':r.get('checked'),'sources':urls(r.get('source')),**({'note':r.get('note')} if fields else {})})
  data['fact_coverage']=[{'key':key,'component':r.get('component_slug'),'publication_status':'published' if r.get('visibility')=='public' or fingerprint(r) in approved else 'withheld'} for key in keys for r in items['facts'] if r['key']==key]
  data['events']=sorted(data['events'],key=lambda x:x['date'],reverse=True)[:5]
  coverage=[];seen=set()
  for row in c.execute('select d.dao,d.coverage from governance_daos d join governance_mappings m on m.dao=d.dao where m.project_slug=?',(slug,)):
   if row['dao'] in seen:continue
   seen.add(row['dao']);g=json.loads(row['coverage']);statuses={k:v if v in ['ok','blocked','error','stale','missing'] else 'unknown' for k,v in g.get('source_status',{}).items()};coverage.append({'dao':row['dao'],'last_checked':g.get('last_checked'),'source_status':statuses,'history_since':g.get('history_since'),'history_complete':g.get('history_complete',False)})
  data['governance']={'status':('not_imported' if imported.get('status')!='imported' else 'mapped' if coverage else 'not_monitored_or_unmapped'),'feed_generated_at':govclock,'coverage':coverage,'stale_after_hours':48}
  if policy.get('project_event_holds',{}).get(slug):data['governance']['status']='events_withheld_pending_owner_repair';data['governance']['event_hold_reason']=policy['project_event_holds'][slug]
  out['projects'][slug]=data
 c.close()
 add_components(out,policy)
 return out
if __name__=='__main__':
 a=argparse.ArgumentParser();a.add_argument('--review-pilot',nargs='+');args=a.parse_args()
 try:result=build(args.review_pilot)
 except Exception as e:
  result={'schema_version':'issuer-project-evidence/1','status':'unavailable','reason':'source_or_publication_policy_unavailable','asset_map':{},'projects':{}}
 path=ROOT/'data/issuer_project_evidence.json';tmp=path.with_suffix('.tmp');tmp.write_text(json.dumps(result,indent=2)+'\n');tmp.replace(path);print('Issuer projection:',result['status'],len(result['projects']),'projects')
