"""Project owner-reviewed BTC authority/route evidence without making clearance claims."""
import pathlib,json,shutil
from shared_asset_evidence import digest

def resolve(x,p):
 for k in p.lstrip('/').split('/') if p else []:
  k=k.replace('~1','/').replace('~0','~');x=x[int(k)] if isinstance(x,list) else x[k]
 return x

def freeze(raw):
 root=pathlib.Path('/home/danger/security_analyst/audits/ethereum-btc-authority-2026-11-04');dest=pathlib.Path(raw)/'security-inputs';dest.mkdir(exist_ok=True)
 index=json.loads((root/'source-index.json').read_text());files={r['path']:r['sha256'] for r in index['files']}
 for name,sha in files.items():
  p=(root/name).resolve();assert p.is_relative_to(root.resolve()) and digest(p.read_bytes())==sha,'Security manifest mismatch: '+name
  target=dest/name;target.parent.mkdir(parents=True,exist_ok=True)
  if target.exists():assert target.read_bytes()==p.read_bytes(),'frozen Security input changed'
  else:shutil.copyfile(p,target)
 target=dest/'source-index.json';body=(root/'source-index.json').read_bytes()
 if target.exists():assert target.read_bytes()==body
 else:target.write_bytes(body)
 summary=json.loads((dest/'owner-summary.json').read_text())
 for a in summary['assets']:
  for c in a['controls']:resolve(json.loads((dest/c['evidence']['file']).read_text()),c['evidence']['json_pointer'])
  for r in a.get('routes',[]):assert r['evidence_file'] in files
 (dest/'bm-validation.private.json').write_text(json.dumps({'manifest_files_checked':len(files),'control_pointers_resolved':True},indent=2)+'\n')

def adopt(raw,slug,token,axes,sources,add):
 root=pathlib.Path(raw)/'security-inputs'
 if not (root/'owner-summary.json').exists():return
 index=json.loads((root/'source-index.json').read_text());hashes={r['path']:r['sha256'] for r in index['files']}
 for name,sha in hashes.items():assert digest((root/name).read_bytes())==sha,'frozen Security hash mismatch'
 s=json.loads((root/'owner-summary.json').read_text());symbol={'wbtc':'WBTC','tbtc':'tBTC','lbtc':'LBTC'}[slug];a=next(a for a in s['assets'] if a['symbol']==symbol);assert a['address'].lower()==token.lower() and s['pin']['chain']=='ethereum'
 sources['security_live']={'owner':'SecurityAnalyst','reference':'ethereum-btc-authority-2026-11-04/owner-summary.json','status':'bounded_pinned_owner_return','scope':'Source/runtime, controls and route-gate observations; no operational reopening, complete authority/financial assurance or actual BTC delivery'}
 clock={'block':s['pin']['number'],'block_hash':s['pin']['hash'],'observed_at':s['pin']['timestamp_utc'],'block_received_at':s['pin']['retrieved_at'],'per_call_retrieval_clocks':'Retained in hashed raw evidence, not a new latest-state observation'}
 selected=[{'finding':c['finding'],'source_file':c['evidence']['file'],'source_pointer':c['evidence']['json_pointer']} for c in a['controls']]
 add('contract_admin','current_authority_and_pause_state',{'observations':selected,'unclosed_branches':a['open_branches']},'bounded control observations','Nominal onchain Safe thresholds and delays are not independent Bitcoin custody quorum or universal delay protection. Positive candidate-role observations are not exhaustive authority enumeration. Runtime matching/source gates do not establish operational service or cash settlement','security_live',clock,owner='SecurityAnalyst',status='partial_owner_observed')
 axes['contract_admin']['fields']['current_authority_and_pause_state']['source_record_refs']=[{'source':'security_live','pointer':c['evidence']['file']+'#'+c['evidence']['json_pointer']} for c in a['controls']]
 add('dependencies','security_unclosed_branches',a['open_branches'],'coverage gaps','Specific unclosed owner branches; no approval pending in this bounded return, not waiting indefinitely for undisclosed evidence','security_live',clock,owner='SecurityAnalyst',status='explicit_unresolved')
 if slug=='tbtc':
  rows=[{'operation':r['route'],'current_gate_status':r['status'],'finding':r['finding'],'source_file':r['evidence_file'],'actual_BTC_delivery':None} for r in a['routes']]
  add('liquidity_exit','current_route_matrix',rows,'route gate status','Both optimistic new requests and pending finalize blocked at pin. Canonical deposit/sweep and new/pending redemption have independent conditional gates; conditional does not mean operationally open or deliverable BTC. Three pending requests are a bounded sample, not full queue','security_live',clock,owner='SecurityAnalyst',status='owner_observed_pinned')
  add('liquidity_exit','new_and_pending_mint_redemption_status',{'operational_reopening_status':None,'btc_delivery_status':None,'reopening_verified':a['reopening_verified'],'btc_delivery_verified':a['btc_delivery_verified'],'pending_sample_scope':'Latest three indexed Oct30–31 requests, bounded discovery blocks26292414–26342414'},'verified-status predicates; unknown actual service/settlement','Unverified reopening is not proof of a global permanent closure, and token flag absence/secondary quotes are not reopening proof. Unmint/burn/Bank balance is not Bitcoin delivery','security_live',clock,owner='SecurityAnalyst',status='bounded_with_unresolved_operations')
