"""Offline review of the exact post-repair served snapshots; no publication."""
import json,hashlib,datetime,subprocess
from pathlib import Path
import yaml
R=Path(__file__).parent;P=R/'producer-evidence'
read=lambda name:json.loads((R/('data__'+name+'.json')).read_text())
manifest=json.loads((R/'served-sources.json').read_text())
for item in manifest.values():assert hashlib.sha256((R/item['file']).read_bytes()).hexdigest()==item['sha256']
reviewed=json.loads((P/'after.json').read_text())['reviewed_files'];matches={}
for name in ['usde_backing','susde_backing','ethena_family','usde_backing_history','susde_backing_history','ethena_measurements_daily']:
 filename=name+'.json';sha=manifest['data/'+filename]['sha256'];assert sha==reviewed[filename]['sha256'],filename;matches[filename]=sha
u,s,f=read('usde_backing'),read('susde_backing'),read('ethena_family');source=u['source_metadata']['backing'];summary=u['summary'];den=summary['issuer_supply_usd']
assert source['source_kind']=='issuer_reported' and source['independent_custody_verification'] is False
assert abs(summary['coverage_ratio']-summary['total_backing']/den)<1e-6
assert abs(summary['coverage_ratio_with_reserve_fund']-(summary['total_backing']+summary['reserve_fund_usd'])/den)<1e-6
assert summary['total_supply']==u['asset_specific']['measurements']['supply_by_chain']['ethereum']['total_supply']
v=s['asset_specific']['measurements']['vault'];assert s['summary']['total_supply']==v['total_supply'];assert abs(v['total_assets']/v['total_supply']-v['nav'])<1e-12
assert v['cooldown_seconds']==86400 and v['max_cooldown_seconds']==7776000
assert f['data_source']=='partial' and f['source_status']['allocation']=='unknown'
assert source['separate_views']['composition']['source_timestamp'] is None
assert s['summary']['price'] is None and u['summary']['price'] is None
hist={}
for slug in ['usde','susde']:
 original=json.loads((P/('original-'+slug+'_backing_history.json')).read_text())['entries'];now=read(slug+'_backing_history')['entries'];assert now[:len(original)]==original
 acquired=now[len(original):];assert len(acquired)==2 and all(row['definition']=='ethena_live_repair_v1' and row['market_price'] is None for row in acquired)
 hist[slug]=dict(preserved_prefix_rows=len(original),original_last=original[-1]['timestamp'],new_rows=[row['timestamp'] for row in acquired],source_breaks=read(slug+'_backing_history')['source_breaks'])
daily=read('ethena_measurements_daily');fee=daily['fee_switch'];assert fee['status']=='insufficient_history' and fee['usde_supply_14d_ma_usd'] is None and fee['milestone_met'] is None
old_daily=json.loads((P/'daily-before-sanitized.json').read_text())
for key in ['computed_at','price_distributions','mint_redeem','susde_realized_nav_growth']:assert old_daily[key]==daily[key],key
rationale={};reports={}
for slug in ['usde','susde']:
 axisfile=Path('/home/danger/riskAnalyst/data/axes')/(slug+'_axis_basis.json');assert axisfile.read_bytes()==(R/('data__'+slug+'_axis_basis.json')).read_bytes()
 rationale[slug]=dict(served_sha256=manifest['data/'+slug+'_axis_basis.json']['sha256'],matches_updated_riskanalyst=True)
 path=Path('/home/danger/riskAnalyst/assets')/(slug+'.md');current=yaml.safe_load(path.read_text().split('---',2)[1]);old=subprocess.check_output(['git','show','HEAD:assets/'+slug+'.md'],cwd='/home/danger/riskAnalyst').decode();baseline=yaml.safe_load(old.split('---',2)[1])
 fields={k:val for k,val in current.items() if k.endswith('_score') or k in ['chain_overrides','last_verified']}
 for key,val in fields.items():assert baseline.get(key)==val,(slug,key)
 reports[slug]=dict(preserved_scores_chain_overrides_verification=fields,report_sha256=hashlib.sha256(path.read_bytes()).hexdigest())
result=dict(served_reviewed_hash_matches=matches,source_timestamp=source['source_timestamp'],source_retrieved_at=source['retrieved_at'],generation=u['timestamp'],source_kind=source['source_kind'],canonical_supply=summary['total_supply'],issuer_denominator=den,canonical_source=summary['supply_source'],vault=v,histories=hist,fee_switch=fee,daily_other_blocks_unchanged=True,updated_rationale=rationale,reports_preserved=reports,remaining_source_gaps=['independent offchain custody/full allocation','same-snapshot composition/positions reconciliation','14-day complete post-repair supply history','governance activation authority evidence','USDe legacy 200bps versus stable-valued 50bps definition decision','liquidity execution/fills/settlement/primary latency'])
(R/'source-results.json').write_text(json.dumps(result,indent=2,default=str)+'\n');print('PASS six served reviewed hashes, issuer provenance/arithmetic/units, same-block vault, original history prefix/gap, withheld fee verdict, unchanged daily blocks and report scores/chain overrides')
