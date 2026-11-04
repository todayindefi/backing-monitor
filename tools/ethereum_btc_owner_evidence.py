"""Offline projections of exact BTC documentary, quote and vault owner inputs."""
import json,pathlib,shutil,datetime
from decimal import Decimal as D
from shared_asset_evidence import digest
ROOT=pathlib.Path(__file__).resolve().parents[1]
PROJECTS={'wbtc':('bit-global','wbtc'),'tbtc':('threshold-network','tbtc'),'lbtc':('lombard-finance','lombard-lbtc')}
def freeze(raw):
 raw=pathlib.Path(raw);dest=raw/'owner-inputs';dest.mkdir(exist_ok=True)
 roots={'dex':pathlib.Path('/home/danger/DexTracker/data/exit_evidence/ethereum-btc/2026-11-04'),'lmt':pathlib.Path('/home/danger/LendingMarketTracker/artifacts/gauntlet_usdc_core_join_2026-11-04')}
 validated={}
 for owner,root in roots.items():
  m=json.loads((root/'manifest.json').read_text());files=m.get('files',m)
  for name,sha in files.items():
   p=(root/name).resolve();assert p.is_relative_to(root.resolve()) and digest(p.read_bytes())==sha,owner+' source manifest mismatch: '+name
  chosen=['manifest.json','btc_wrapper_usdc_quotes.json','current_prices.json'] if owner=='dex' else ['manifest.json','summary.json']
  for name in chosen:
   p=dest/(owner+'_'+name);body=(root/name).read_bytes()
   if p.exists():assert p.read_bytes()==body,'immutable owner input changed'
   else:p.write_bytes(body)
  validated[owner]={'manifest_files_checked':len(files)}
 da=pathlib.Path('/home/danger/DeFiAnalyst/data/reviews/ethereum-btc-issuer-profiles-2026-11-04')
 for slug,(project,component) in PROJECTS.items():
  p=dest/('da_'+slug+'.json');body=(da/project/'structured.json').read_bytes()
  if p.exists():assert p.read_bytes()==body
  else:p.write_bytes(body)
 (dest/'validation.private.json').write_text(json.dumps(validated,indent=2)+'\n')
def adopt(raw,slug,token,axes,sources,add):
 raw=pathlib.Path(raw);dest=raw/'owner-inputs'
 if not dest.exists():return
 read=lambda name:json.loads((dest/name).read_text())
 for owner,names in [('dex',['btc_wrapper_usdc_quotes.json','current_prices.json']),('lmt',['summary.json'])]:
  manifest=read(owner+'_manifest.json');hashes=manifest.get('files',manifest)
  for name in names:assert digest((dest/(owner+'_'+name)).read_bytes())==hashes[name],'frozen owner hash mismatch'
 project,component=PROJECTS[slug];profile=read('da_'+slug+'.json');assert profile['slug']==project
 allow={'wbtc':{'ethereum_contract','custody_transition','holder_rights','access_restriction','operational_sequence','published_model','financial_audit','native_asset_boundary'},'tbtc':{'ethereum_contract','threshold_wallet_model','optimistic_authority','holder_protocol_route','conditions','reported_mint_redemption_pause','holder_rights','fee_change_and_conflict'},'lbtc':{'ethereum_contract','issuer_obligor','holder_rights','title_and_insolvency','suspension_and_encumbrance','strategy_roles','allocation_risk','yield_and_loss','legacy_babylon_boundary','por_scope'}}[slug]
 facts=[{k:f.get(k) for k in ['component_slug','key','value','status','basis','source','as_of','checked']} for f in profile['facts'] if f.get('component_slug')==component and f['key'] in allow];assert {f['key'] for f in facts}==allow
 sources['da_component']={'owner':'DeFiAnalyst','reference':project+'/structured.json','status':'accepted_documentary_context','scope':'Selected exact component facts; private parent summary/xrefs/events/scores omitted'}
 add('issuer','documentary_component_facts',facts,'dated documentary claims','Canonical accepted documentary context, not independent financial/custody/runtime assurance','da_component',{'profile_checked':profile['profile_checked'],'document_dates':'embedded per fact'},owner='DeFiAnalyst',status='documentary_received')
 dex=read('dex_btc_wrapper_usdc_quotes.json');symbol={'wbtc':'WBTC','tbtc':'tBTC','lbtc':'LBTC'}[slug];a=dex['assets'][symbol];assert dex['chain']=='ethereum' and a['token'].lower()==token.lower()
 sources['dex_quotes']={'owner':'DexTracker','reference':'ethereum-btc/2026-11-04/btc_wrapper_usdc_quotes.json','status':'bounded_observation','scope':'Indicative USDC route outputs, no native BTC payout/NAV/settlement/maximum capacity claim'}
 rows=[]
 for q in a['quotes']:
  rs=q.get('route_summary') or {}
  if q['status']=='quoted':assert rs['tokenIn'].lower()==token.lower() and rs['tokenOut'].lower()==dex['output_token'].lower() and rs['amountIn']==q['input_raw']
  row={k:q.get(k) for k in ['target_market_notional_usd','input_raw','input_tokens','actual_external_market_notional_usd','request_started_at','received_at','status','failure','minimum_out','quote_expiry','output_usdc','output_value_usd','added_average_rate_impact_bps','impact_reference','signed_quote_return_vs_market_mark_bps','proceeds_btc_spot_equivalent_per_input_token','btc_spot_equivalent_caveat','provider_timestamp_utc','estimated_gas_eth','actual_route_blocks']}
  row.update(input_token=token,input_decimals=a['decimals'],output_token=dex['output_token'],output_decimals=6,output_raw=rs.get('amountOut'),gas={k:rs.get(k) for k in ['gas','gasPrice','gasUsd','l1FeeUsd','extraFee']},hops=[{k:h.get(k) for k in ['pool','exchange','tokenIn','tokenOut','swapAmount','amountOut']} for branch in rs.get('route',[]) for h in branch],execution=None)
  rows.append(row)
 add('liquidity_exit','sized_exits',rows,'native token quote units','Externally market-sized $100k/$1m/$10m; average-rate impact relative to $100k sample is not total fee or marginal depth. BTC reference is not per-share entitlement; quotes are not executions, native redemption or reserved capacity','dex_quotes',{'started_at':dex['started_at'],'finished_at':dex['finished_at'],'per_leg_clocks':'embedded; provider and pool block hints preserved'},owner='DexTracker',status='indicative_quote_only')
 prices=read('dex_current_prices.json');wanted={'ethereum:'+token.lower(),'ethereum:'+dex['output_token'].lower(),'coingecko:bitcoin'};marks=[{'token_id':k,**v} for k,v in prices['body']['coins'].items() if k.lower() in wanted]
 add('stability','dated_btc_relative_reference',{'market_price_in_btc_benchmark':a['market_price_in_btc_benchmark'],'market_btc_benchmark_discount_bps':a['market_btc_benchmark_discount_bps'],'benchmark_caveat':a['btc_benchmark_caveat'],'marks':marks},'BTC reference and USD marks','Separate indexed token/BTC/USDC timestamps, not NAV or a 1LBTC=1BTC assumption; stale/mixed references are not arbitrage or peg guarantees','dex_quotes',{'request_started_at':prices['request_started_at'],'received_at':prices['received_at'],'upstream_clocks':'embedded per mark'},owner='DexTracker',status='dated_market_observation')
 axes['stability']['fields']['btc_relative_market_discount']['basis']='Dated benchmark comparison supplied separately; current same-block discount/NAV entitlement is not established'
 add('stability','continuous_price_history',None,'time series','Only retained point-in-time references available; continuous source-owner price/NAV history not provided','dex_quotes',{},owner='DexTracker',status='unavailable')
 lmt=read('lmt_summary.json');id=lmt['identity'];assert id['chain']['id']==1 and id['address'].lower()=='0x8eb67a509616cd6a7c1b3c8c21d48ff57df3d458'
 v=lmt['btc_collateral_market_supply_shares'][symbol];assert v['collateral_token_address'].lower()==token.lower()
 markets=[m for m in lmt['markets'] if (m.get('collateral_asset') or {}).get('address','').lower()==token.lower()];assert markets and all(m['chain_id']==1 and m['loan_asset']['address'].lower()==dex['output_token'].lower() for m in markets)
 sources['lmt_vault']={'owner':'LendingMarketTracker','reference':'gauntlet_usdc_core_join_2026-11-04/summary.json','status':'bounded_indexed_join','scope':'Public candidate identity and loan-supply allocation by collateral; user-quoted opportunity not reproduced, no portfolio weights or vault/oracle approval'}
 lc={'vault_indexed_at':lmt['source_vault_state_at_utc'],'vault_indexed_block':lmt['source_vault_state_block_number'],'received_at':lmt['observation_received_at'],'market_clocks':'embedded per market; not synchronized'}
 add('dependencies','gauntlet_candidate_join',{'identity':id,'candidate_status':lmt['status'],'quoted_opportunity_match':False,'apy':lmt['apy'],'exact_token_loan_supply_allocation':v,'denominator_definition':lmt['denominator_definition'],'not_equivalent_to':lmt['not_equivalent_to'],'vault_total_loan_assets_raw':lmt['vault_total_loan_assets_raw'],'markets':markets,'reconciliation':lmt['reconciliation'],'normal_feed_status':lmt['lmt_normal_feed']['status'],'normal_feed_generated_at':lmt['lmt_normal_feed']['generated_at'],'oracle_leaf_feeds':lmt['oracle_leaf_feeds'],'missing_to_reproduce_quote':lmt['missing_to_reproduce_quote']},'USDC loan supply, percent and fraction as named','Exact candidate join only; reported historical rates/weights not reproduced; borrower concentration, oracle leaves and redemption capacity not verified. Residual is not proved idle cash.','lmt_vault',lc,owner='LendingMarketTracker',status='candidate_verified_opportunity_unresolved')
