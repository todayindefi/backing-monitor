#!/usr/bin/env python3
"""Immutable served-source capture and descriptive syrupUSDC axes 1–3 metrics."""
import argparse, collections, datetime as dt, hashlib, json, math, statistics
from pathlib import Path
from urllib.request import urlopen
from urllib.error import HTTPError
ROOT=Path(__file__).resolve().parents[1]
REVIEW=ROOT/'specs/reviews/syrupusdc-source-refresh-2026-10-29'
BASE='https://todayindefi.github.io/backing-monitor/'
FILES=['data/assets.json','data/syrupusdc_backing.json','data/syrupusdc_backing_history.json','data/syrupusdc_peg_history.json','data/syrupusdc_axis_basis.json','data/syrupusdc_liquidity.json','data/syrupusdc_contract.json','data/syrupusdc_contract_overlay.json','data/syrupusdc_issuer.json','data/syrupusdc_backing_overlay.json','data/syrupusdc_dependencies.json','data/syrup_family.json','data/syrupusdt_backing.json','js/app.js','js/renderers/common.js','js/renderers/syrupusdc.js']
def instant(s):return dt.datetime.fromisoformat(s.replace('Z','+00:00'))
def stat(xs):
 if not xs:return {'n':0}
 xs=sorted(xs)
 def q(p):
  x=(len(xs)-1)*p;a=int(x);return xs[a]+(xs[min(a+1,len(xs)-1)]-xs[a])*(x-a)
 return dict(n=len(xs),mean=statistics.mean(xs),median=statistics.median(xs),min=min(xs),max=max(xs),p25=q(.25),p75=q(.75))
def finite(v):return isinstance(v,(int,float)) and not isinstance(v,bool) and math.isfinite(v)
def concentration(rows):
 by=collections.defaultdict(float)
 for l in rows:by[l['borrower'].lower()]+=l['principal']
 vals=sorted(by.values(),reverse=True);total=sum(vals)
 return dict(principal_usd=total,addresses=len(vals),top_1_pct=sum(vals[:1])/total*100 if total else None,top_3_pct=sum(vals[:3])/total*100 if total else None,hhi=sum((x/total*100)**2 for x in vals) if total else None)
def metrics(read):
 b=read('syrupusdc_backing.json');s=b['asset_specific'];lb=s['loan_book'];rows=lb['loans'];credit=[l for l in rows if l.get('position_type')=='loan'];numeric=[l for l in rows if finite((l.get('collateral') or {}).get('usd'))]
 total=sum(l['principal'] for l in rows);assert abs(total-lb['principal_out'])<.03,'Principal enumeration mismatch'
 coverage=lb.get('credit_coverage');co=lb.get('concentration_loans_only')
 if co:
  assert abs(sum(l['principal'] for l in credit)-co['denominator_usd'])<.03
  cc=concentration(credit)
  assert abs(cc['top_3_pct']-co['top_3_share_pct'])<.011
  if 'member_loan_addresses' in co:assert {l['loan_addr'].lower() for l in credit}=={a.lower() for a in co['member_loan_addresses']}
 if coverage and not coverage.get('complete'):assert coverage['collateral_ratio_pct'] is None
 assert b['peg']['history_ref']=='syrupusdc_backing_history.json' and b['peg']['history_field']=='peg_market_price'
 venue=read('syrupusdc_liquidity.json');assert not any(k in venue for k in ['exit_mark','depth','primary_exit'])
 em=b['liquidity']['exit_mark'];assert em['source']=='kyberswap' and em['chain']=='ethereum' and em['sell_into']=='USDC' and em['fair_value_basis']=='market'
 hist=read('syrupusdc_backing_history.json')['entries'];ordered=sorted(hist,key=lambda e:instant(e['timestamp']));end=instant(ordered[-1]['timestamp']);windows={}
 for days in [7,30,90]:
  raw=[e for e in ordered if end-dt.timedelta(days=days)<=instant(e['timestamp'])<=end];hours={}
  for e in raw:hours[instant(e['timestamp']).replace(minute=0,second=0,microsecond=0)]=e
  es=list(hours.values());times=[instant(e['timestamp']) for e in es]
  peg=[(e['peg_market_price']/e['peg_theoretical_price']-1)*10000 for e in es if finite(e.get('peg_market_price')) and finite(e.get('peg_theoretical_price')) and e['peg_theoretical_price']>0]
  free=[100-e['deployment_ratio_pct'] for e in es if finite(e.get('deployment_ratio_pct'))]
  windows[str(days)]=dict(raw_n=len(raw),hourly_n=len(es),first=es[0]['timestamp'],last=es[-1]['timestamp'],elapsed_days=(times[-1]-times[0]).total_seconds()/86400,max_gap_hours=max(((b-a).total_seconds()/3600 for a,b in zip(times,times[1:])),default=0),peg_bps=stat(peg),free_liquidity_pct=stat(free),below_2pct=sum(x<2 for x in free),classification_versions=dict(collections.Counter(str(e.get('classification_version','not_recorded')) for e in es)))
 quotes={}
 for rung in ['150000','250000','500000','1000000']:
  obs={};rejected=0
  for e in ordered:
   mark=e.get('exit_mark') or {}
   if not mark or mark.get('status')!='ok':continue
   if not(mark.get('source')=='kyberswap' and mark.get('chain')=='ethereum' and mark.get('sell_into')=='USDC' and mark.get('fair_value_basis')=='market'):
    rejected+=1;continue
   q=(mark.get('rungs') or {}).get(rung);t=mark.get('measured_at')
   if t and q and finite(q.get('fill_ratio')):obs[t]=q
  ts=sorted(obs,key=instant)
  quotes[rung]=dict(distinct_successful_quotes=len(ts),first=ts[0] if ts else None,last=ts[-1] if ts else None,elapsed_days=(instant(ts[-1])-instant(ts[0])).total_seconds()/86400 if ts else None,all_in_bps=stat([(obs[t]['fill_ratio']-1)*10000 for t in ts]),impact_bps=stat([obs[t]['slippage_bps'] for t in ts if finite(obs[t].get('slippage_bps'))]),max_gap_hours=max(((instant(b)-instant(a)).total_seconds()/3600 for a,b in zip(ts,ts[1:])),default=0),excluded_identity_rows=rejected)
 low=[]
 for l in rows:
  c=l.get('collateral') or {};v=c.get('usd');p=l['principal']
  if finite(v) and p>0 and v/p<1:low.append(dict(loan_addr=l.get('loan_addr'),borrower=l.get('borrower'),principal=p,collateral_usd=v,computed_ratio_pct=v/p*100,collateral=c))
 return dict(snapshot=b['timestamp'],summary=b['summary'],peg=b['peg'],vault=s['vault_state'],classification_version=lb.get('classification_version'),classification_definition=lb.get('classification_definition'),classification_counts=dict(collections.Counter(l.get('position_type','missing') for l in rows)),principal_unknown_usd=lb.get('principal_unknown_usd'),all_concentration=concentration(rows),credit_concentration=concentration(credit),published_credit_concentration=co,credit_coverage=coverage,collateral=dict(records=len(rows),numeric_records=len(numeric),numeric_principal_pct=sum(l['principal'] for l in numeric)/total*100,numeric_row_sum=sum(l['collateral']['usd'] for l in numeric),aggregate=lb['collateral_summary'],below_par_diagnostic=low),multi_chain=s.get('multi_chain'),external_verification=s.get('external_collateral_verification'),queue=s.get('withdrawal_queue'),current_exit=em,history=dict(first=ordered[0]['timestamp'],last=ordered[-1]['timestamp'],rows=len(hist),duplicate_timestamps=len(hist)-len({e['timestamp'] for e in hist}),windows=windows,quotes=quotes,method='newest observation per UTC hour; empirical unweighted statistics; quote measured_at deduplication; success-only quotes are not fills or a success-rate denominator'),family=read('syrup_family.json'))
def main():
 p=argparse.ArgumentParser();p.add_argument('--phase',choices=['before','after'],required=True);p.add_argument('--capture',action='store_true');a=p.parse_args();dest=REVIEW/a.phase
 if a.capture:
  assert not dest.exists(),'Refuse archive overwrite'
  dest.mkdir(parents=True);manifest={}
  for resource in FILES:
   name=resource.replace('/','__');url=BASE+resource
   try:
    raw=urlopen(url+'?review=syrupusdc-20261029-'+a.phase,timeout=30).read()
    (dest/name).write_bytes(raw);d=json.loads(raw) if resource.endswith('.json') else {}
    manifest[resource]=dict(file=name,url=url,sha256=hashlib.sha256(raw).hexdigest(),bytes=len(raw),retrieved_at=dt.datetime.now(dt.timezone.utc).isoformat(),source_timestamp=d.get('timestamp',d.get('as_of')) if isinstance(d,dict) else None)
   except HTTPError as e:
    if e.code!=404 or resource not in ['data/syrupusdc_backing_overlay.json','data/syrupusdc_dependencies.json']:raise
    manifest[resource]=dict(url=url,http_status=404,retrieved_at=dt.datetime.now(dt.timezone.utc).isoformat())
  (dest/'sources.json').write_text(json.dumps(manifest,indent=2)+'\n')
 manifest=json.loads((dest/'sources.json').read_text())
 for item in manifest.values():
  if 'file' in item:assert hashlib.sha256((dest/item['file']).read_bytes()).hexdigest()==item['sha256']
 read=lambda n:json.loads((dest/('data__'+n)).read_text())
 m=metrics(read);out=json.dumps(m,indent=2)+'\n'
 if a.capture:(dest/'derived-metrics.json').write_text(out)
 else:assert (dest/'derived-metrics.json').read_text()==out
 print('PASS '+a.phase+': served hashes, principal/concentration reconciliation, canonical peg/ladder identities and retained history statistics; no independent custody or execution assurance implied')
if __name__=='__main__':main()
