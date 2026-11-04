"""Adopt the reviewed Security summary with pinned raw-pointer provenance, offline."""
import json,pathlib
from shared_asset_evidence import digest

def pointer(value,path):
 if not path:return value
 for key in path.lstrip('/').split('/'):
  key=key.replace('~1','/').replace('~0','~');value=value[int(key)] if isinstance(value,list) else value[key]
 return value

def freeze(root,dest):
 root=pathlib.Path(root);dest=pathlib.Path(dest);m=json.loads((root/'source-index.json').read_text());hashes={r['path']:r['sha256'] for r in m['files']};summary=(root/'owner-summary.json').read_bytes();assert digest(summary)==hashes['owner-summary.json'],'Security summary hash mismatch'
 parsed=json.loads(summary);used=set()
 for a in parsed['assets']:
  for f in a['facts']:
   for ref in f['evidence']:
    name=ref['file'];p=(root/name).resolve();assert p.is_relative_to(root.resolve());body=p.read_bytes();assert digest(body)==hashes[name],'Security raw hash mismatch: '+name;pointer(json.loads(body),ref['pointer']);used.add(name)
 for name in ['source-index.json','owner-summary.json']:
  target=dest/('security_'+name);body=(root/name).read_bytes()
  if target.exists():assert target.read_bytes()==body,'frozen Security input changed'
  else:target.write_bytes(body)
 (dest/'security-pointer-validation.private.json').write_text(json.dumps({'summary_hash':digest(summary),'raw_files_checked':sorted(used),'every_fact_pointer_resolved':True},indent=2)+'\n')

def adopt(inputs,slug,token,sources,axes,add):
 inputs=pathlib.Path(inputs);p=inputs/'security_owner-summary.json'
 if not p.exists():return
 s=json.loads(p.read_text());m=json.loads((inputs/'security_source-index.json').read_text());hashes={r['path']:r['sha256'] for r in m['files']};assert digest(p.read_bytes())==hashes['owner-summary.json']
 target={'srusdat':'monad-srusdat','siusd':'ethereum-siusd','susn':'ethereum-susn'}[slug];a=next(a for a in s['assets'] if a['id']==target);assert a['address'].lower()==token and a['chain_id']==(143 if slug=='srusdat' else 1)
 sources['security_live']={'owner':'SecurityAnalyst','reference':'pt-linkage-authority-2026-11-04/owner-summary.json','status':'bounded_owner_return','scope':'Owner-reviewed pinned observation/source and read-only authorization simulation; no transaction, full authority clearance or financial assurance'}
 facts=a['facts']
 if slug=='srusdat':facts=facts+next(a['facts'] for a in s['assets'] if a['id']=='ethereum-srusdat')
 for f in facts:
  clock=dict(f['source_clock']);clock['pinned_blocks']={ref:s['blocks'][ref] for ref in clock['block_refs']};assert all(b['hash_rechecked'] for b in clock['pinned_blocks'].values())
  axis='contract_admin'
  if f['id']=='transport-binding':axis='dependencies'
  if f['id']=='units-and-sampled-escrow':axis='backing'
  if f['id']=='withdrawal-handler':axis='liquidity_exit'
  key='security_'+f['id'].replace('-','_');add(axis,key,f['value'],'structured owner observation',f.get('qualification','Bounded exact-deployment pinned owner evidence; no full execution or general authority clearance'),'security_live',clock,owner='SecurityAnalyst',status=f['status'])
  axes[axis]['fields'][key]['source_record_refs']=[{'source':'security_live','pointer':r['file']+'#'+r['pointer']} for r in f['evidence']]
 axes['contract_admin']['fields'].pop('existing_packet_search_status',None)
 axes['contract_admin']['fields']['mint_burn_upgrade_pause_authorities']['basis']='Current bounded owner observations received; full authority/mint/burn/asset-moving perimeter and unresolved branches remain explicit'
 axes['contract_admin']['fields']['mint_burn_upgrade_pause_authorities']['status']='unresolved_full_perimeter'
 if slug!='srusdat':
  f=next(f for f in facts if f['id']=='runtime-and-live-references');add('contract_admin','verified_implementation',f['value'],'runtime identity and references','Exact pinned source/runtime observations; mutable references/control paths and underlying financial coverage remain separate','security_live',{'pinned_blocks':{'ethereum':s['blocks']['ethereum']},**f['source_clock']},owner='SecurityAnalyst',status=f['status'])
 else:
  axes['backing']['fields']['bridge_decimal_dust']['basis']='Shared decimals6/conversion1e12 observed; exact transport source/debit-credit/dust behavior across all paths unresolved'
  f=axes['contract_admin']['fields']['layerzero_endpoint_peer_delegate_config_authorities'];f['basis']='EOA delegate and tested mutable4-DVN send/receive config verified in bounded packet; endpoint governance/operator independence and exhaustive controls remain unresolved';f['status']='partial_with_explicit_gaps'
 sources['pending_security']['status']='bounded_return_received_unresolved_branches_retained'
