"""Normalize captured WBTC publisher inventory and independent indexed Bitcoin balances."""
import json,pathlib,datetime
from decimal import Decimal as D
from shared_asset_evidence import digest

def adopt(raw,slug,axes,sources,add):
 root=pathlib.Path(raw)/'wbtc-api'
 if slug!='wbtc' or not (root/'inventory-reconciliation.private.json').exists():return
 def read(n):
  original=root/(n[:-5]+'.response') if n.endswith('.json') else root/n
  return json.loads((original if original.exists() else root/n).read_text())
 receipts=read('receipts.private.json')
 for name,r in receipts.items():
  if 'sha256' in r:assert digest((root/(name+'.response')).read_bytes())==r['sha256']
 assets=read('assets.json');recheck=read('assets-recheck.json');inventory=read('inventory-reconciliation.private.json');chains=read('chains.json');rows=[]
 first=read('custody-page1.json');pages=(first['total']+19)//20
 for i in range(1,pages+1):
  x=read(f'custody-page{i}.json');assert x['total']==first['total'] and x['pageIndex']==i;rows+=x['data']
 assert len(rows)==first['total'] and len({r['address'] for r in rows})==len(rows)
 custody=sum(int(r['balance']) for r in rows);native=sum(int(r['supply']) for r in chains['natives']);assert custody==int(assets['totalHoldings']) and native==int(assets['totalSupply'])
 assert recheck['totalSupply']==assets['totalSupply'] and recheck['totalHoldings']==assets['totalHoldings'],'publisher quantities changed during pagination'
 def btc(n):return format(D(n)/D(10)**8,'f')
 sources['wbtc_api']={'owner':'BackingMonitor','url':'https://www.wbtc.network/api/v2/assets','inventory_url':'https://www.wbtc.network/api/v2/custodialAddresses','chains_url':'https://www.wbtc.network/api/v2/chains','status':'publisher_inventory_checked','scope':'Complete reported paginated inventory, not custody/title or independently verified full global liabilities'}
 c={'publisher_assets_update_at':datetime.datetime.fromtimestamp(assets['updateTime']/1000,datetime.timezone.utc).isoformat(),'assets_received_at':receipts['assets']['received_at'],'page_received_at':{str(i):receipts[f'custody-page{i}']['received_at'] for i in range(1,pages+1)},'inventory_upstream_observation_at':None}
 vals={'api_published_native_supply':(btc(native),'WBTC'),'api_published_gross_btc_reserves':(btc(custody),'BTC'),'api_reserves_minus_publisher_native_supply':(btc(custody-native),'BTC-equivalent'),'api_custody_inventory_address_count':(len(rows),'addresses')}
 for k,(v,u) in vals.items():add('backing',k,v,u,'Eight-decimal API quantities; complete reported inventory/native rows reconcile to publisher totals. Not unencumbered net backing or proof of global native liability completeness','wbtc_api',c,status='publisher_reconciled')
 add('backing','native_liability_rows',chains['natives'],'publisher chain-native raw units','Seven published native issuance rows; Ethereum row separately observed at BM original Ethereum pin, remaining native chains are not independently reconciled here','wbtc_api',c,status='publisher_reported')
 add('dependencies','bridged_representations',chains['bridges'],'published deployments','Published bridge representations are not additional native liability supply to add again; locked native escrow, remote issuance and in-flight units require separate conservation evidence','wbtc_api',c,status='publisher_reported')
 add('backing','independent_all_native_liabilities',None,'WBTC','All native issuance/retired-burn/pending-mint liabilities across seven chains and legal claims not independently reconciled; publication row totals alone cannot close this','wbtc_api',c)
 add('backing','all_bridge_escrow_conservation',None,'WBTC','Six published bridged deployments identified; native-token lock/escrow, remote supply, burns and in-flight balances not independently reconciled; no double-counting assertion of full verification','wbtc_api',c)
 br=root/'blockstream';p=br/'observations.private.json'
 if not p.exists():return
 obs=json.loads(p.read_text());rs=json.loads((br/'receipts.private.json').read_text())
 for name,r in rs.items():
  if 'sha256' in r:assert digest((br/(name+'.response')).read_bytes())==r['sha256'],'independent indexer raw mismatch'
 complete=obs['complete'] and obs['addresses_observed']==len(rows)
 if complete:
  by_address={r['address']:r for r in rows};assert set(by_address)=={r['address'] for r in obs['balances']}
  for r in obs['balances']:
   actual=json.loads((br/(r['address']+'.response')).read_text());chain=actual['chain_stats'];assert int(r['confirmed_satoshi'])==chain['funded_txo_sum']-chain['spent_txo_sum'];assert int(r['publisher_satoshi'])==int(by_address[r['address']]['balance'])
  total=sum(int(r['confirmed_satoshi']) for r in obs['balances']);assert total==int(obs['confirmed_satoshi_sum'])
 else:total=None
 sources['bitcoin_indexer']={'owner':'BackingMonitor','url':'https://blockstream.info/api/address/{published_address}','status':'indexed_balances_observed' if complete else 'unavailable','scope':'Independent public Esplora confirmed balances, no common-block RPC pin or custody/title proof'}
 bc={'request_started_at':min(r['request_started_at'] for r in rs.values()),'received_at':max(r['received_at'] for r in rs.values()),'tip_before':obs['tip_before'],'tip_after':obs['tip_after'],'tip_hash_unchanged':obs['tip_hash_unchanged'],'per_address_upstream_observation_at':None}
 value={'addresses_checked':obs['addresses_observed'],'complete_publisher_address_set_checked':complete,'confirmed_btc_sum':btc(total) if total is not None else None,'publisher_btc_sum':btc(custody),'confirmed_minus_publisher_satoshi':str(total-custody) if total is not None else None,'mempool_net_satoshi':str(sum(int(r['mempool_delta_satoshi']) for r in obs['balances'])) if complete else None,'custody_title_verified':None,'common_block_address_snapshot':False}
 add('backing','independent_btc_reserve_reconciliation',value,'BTC and satoshi as named','All reported addresses checked against independent indexed confirmed balances; stable tip is not per-address pinned state/cryptographic ownership or unencumbered reserve proof','bitcoin_indexer',bc,status='indexed_balance_match' if complete and total==custody else 'partial_or_mismatched')
