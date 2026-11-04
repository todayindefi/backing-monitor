"""Projection of frozen DexTracker fields; no quote collection or execution."""
import datetime,json,pathlib
from shared_asset_evidence import digest
FILES=['exit_quotes.json','exact_intermediate_quotes.json','current_prices.json','price_history_7d.json','price_history_30d.json']
def freeze(root,dest):
 root=pathlib.Path(root);dest=pathlib.Path(dest);m=json.loads((root/'manifest.json').read_text())
 for name,sha in m['files'].items():
  p=(root/name).resolve();assert p.is_relative_to(root.resolve()) and digest(p.read_bytes())==sha,'Dex manifest mismatch: '+name
 for name in FILES+['manifest.json']:
  target=dest/('dex_'+name);body=(root/name).read_bytes()
  if target.exists():assert target.read_bytes()==body,'frozen Dex input changed'
  else:target.write_bytes(body)
def adopt(inputs,slug,token,sources,axes,add):
 inputs=pathlib.Path(inputs)
 if slug=='srusdat' or not (inputs/'dex_exit_quotes.json').exists():return
 read=lambda name:json.loads((inputs/('dex_'+name)).read_text())
 manifest=read('manifest.json')
 for name in FILES:assert digest((inputs/('dex_'+name)).read_bytes())==manifest['files'][name]
 pack=read('exit_quotes.json');assert digest((inputs/'financial-observations.private.json').read_bytes())==pack['reused_bm_source']['sha256'],'Dex reused BM source version mismatch'
 a=pack['assets'][slug];assert pack['chain']=='ethereum' and a['token'].lower()==token
 assert a['underlying'].lower()==axes['dependencies']['fields']['reported_underlying_token']['value'].lower()
 sources['dex_quotes']={'owner':'DexTracker','reference':'pt-linkage/2026-11-04/exit_quotes.json','status':'bounded_observation','scope':'Indicative routes; quotes/previews are not execution or universal redemption access'}
 sources['dex_prices']={'owner':'DexTracker','reference':'pt-linkage/2026-11-04/current_prices.json + sparse7d/30d','status':'bounded_observation','scope':'DefiLlama indexed marks, sparse snapshots only, not continuous history or NAV'}
 classification='Gateway conversion/redemption estimate' if slug=='siusd' else 'secondary swap via USN'
 rows=[]
 for group in a['quote_groups']:
  for q in group['routes']:
   rs=q.get('route_summary') or {};hops=[h for branch in rs.get('route',[]) for h in branch]
   if q['leg']=='share_to_usdc':
    assert q['token_in'].lower()==token and q['token_out'].lower()=='0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
    first=[h for h in hops if h['tokenIn'].lower()==token]
    expected='0x3f04b65ddbd87f9ce0a2e7eb24d80e7fb87625b5' if slug=='siusd' else '0x5cba2738c4df481db7228e1545f29532ed0a2dee'
    assert first and all(h['pool'].lower()==expected for h in first),'route classification changed'
   if q['status']=='quoted':assert rs['tokenIn'].lower()==q['token_in'].lower() and rs['tokenOut'].lower()==q['token_out'].lower() and rs['amountIn']==q['input_raw']
   row={k:q.get(k) for k in ['leg','token_in','token_out','input_raw','input_units','input_decimals','output_decimals','request_started_at','received_at','status','failure','minimum_out','expiry','output_units','impact_reference','added_average_rate_impact_bps','signed_quote_return_vs_market_value_bps','provider_timestamp_utc','estimated_gas_eth','actual_route_blocks']}
   row.update(target_market_notional_usd=group['target_market_notional_usd'],sizing_actual_usd=group['sizing_actual_usd'],classification=classification if q['leg'].startswith('share_to_') else 'conditional underlying-to-USDC quote',output_raw=rs.get('amountOut'),gas={k:rs.get(k) for k in ['gas','gasPrice','gasUsd','l1FeeUsd','extraFee']},hops=[{k:h.get(k) for k in ['pool','exchange','tokenIn','tokenOut','swapAmount','amountOut']} for h in hops],execution=None)
   rows.append(row)
 clock={'collection_started_at':pack['started_at'],'collection_finished_at':pack['finished_at'],'observation_clocks':'embedded per quote; provider and pool clocks are not normalized'}
 basis='Public $100/$10k/$100k sizes from dated external share marks; per-output added rate impact vs $100 is separate from market discount/fees/gas. Negative impact is rate improvement across routes/clocks, not negative fees. '+classification+'. No filled transaction, capacity ceiling or underlying cash availability demonstrated.'
 add('liquidity_exit','router_exit_estimates',rows,'native token quote units',basis,'dex_quotes',clock,owner='DexTracker',status='indicative_quote_only')
 if slug=='susn':
  add('liquidity_exit','sized_secondary_exits',[r for r in rows if r['leg']=='share_to_usdc'],'native token quote units','Secondary sUSN→USN→USDC routes, distinct from primary unstaking/issuer redemption; indicative quotes only','dex_quotes',clock,owner='DexTracker',status='indicative_quote_only')
 else:axes['liquidity_exit']['fields']['sized_secondary_exits']['basis']='Current router quotes use InfiniFi Gateway conversion; no pure AMM share sale established by this packet'
 previews=[{k:g['preview'].get(k) for k in ['request_started_at','received_at','method','input_raw','block','asset_output_raw','basis']} for g in a['quote_groups']]
 add('liquidity_exit','exact_share_previews',previews,'underlying raw units','Exact-share previews at reused BM block, not unstaking, available liquidity or delivery','dex_quotes',clock,owner='DexTracker',status='preview_only')
 exact=[]
 for q in read('exact_intermediate_quotes.json')['quotes']:
  if q['asset']!=slug:continue
  assert q['input_token'].lower()==a['underlying'].lower();rs=q.get('route_summary') or {}
  exact.append({k:q.get(k) for k in ['target_share_market_notional_usd','input_raw','input_decimals','input_token','output_token','output_decimals','input_basis','prior_quote_received_at','prior_route_id','request_started_at','received_at','status','failure']}|{'output_raw':rs.get('amountOut'),'provider_generation_timestamp':rs.get('timestamp'),'execution':None})
 add('liquidity_exit','exact_intermediate_cash_quotes',exact,'native token quote units','Separately timed quotes for exact prior routed underlying amounts; conditional sequential legs, not atomic/realized cash or guaranteed primary redemption','dex_quotes',{'observation_clocks':'embedded per prior/current leg'},owner='DexTracker',status='conditional_quote_only')
 marks=[];wanted={'ethereum:'+token,'ethereum:'+a['underlying'].lower(),'ethereum:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'}
 for name in ['current_prices.json','price_history_7d.json','price_history_30d.json']:
  p=read(name)
  for id,v in p['body']['coins'].items():
   if id.lower() in wanted:marks.append({'source':name,'token_id':id,'url':p['url'],'price_usd':v['price'],'timestamp':v['timestamp'],'confidence':v.get('confidence'),'request_started_at':p['request_started_at'],'received_at':p['received_at']})
 add('stability','sparse_market_marks',marks,'USD per token','Separate current/7d/30d indexed source marks, not continuous history; share appreciation versus underlying depeg cannot be decomposed historically without exchange-rate series','dex_prices',{'source_clocks':'embedded per mark'},owner='DexTracker',status='sparse_observations')
 axes['stability']['fields']['price_history']['basis']='Sparse current/7d/30d marks received; complete history and historical share exchange-rate decomposition remain unavailable'
