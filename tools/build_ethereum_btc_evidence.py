"""Offline initial BTC evidence packages. No assessment, network or publication."""
import argparse, datetime, json, pathlib
from bs4 import BeautifulSoup
from decimal import Decimal as D
from shared_asset_evidence import SCHEMA, canonical, digest, field, validate
ROOT=pathlib.Path(__file__).resolve().parents[1]
EXPECTED={'wbtc':'0x2260fac5e5542a773aa44fbcfedf7c193bc2c599','tbtc':'0x18084fba666a33d37592fa2633fd49a74dd93a88','lbtc':'0x8236a87084f8b84306f72007f36f2618a5634494'}
def build(raw, output):
 raw=pathlib.Path(raw);output=pathlib.Path(output).resolve()
 if '.private-reviews' not in output.parts and not output.is_relative_to(pathlib.Path('/tmp')):raise ValueError('local/private output required')
 obs=json.loads((raw/'observations.private.json').read_text());block=obs['block']['result']
 assert obs['chain_id']['result']=='0x1' and obs['block_hash_stable'] is True
 clock={'block_number':int(block['number'],16),'block_hash':block['hash'],'observed_at':datetime.datetime.fromtimestamp(int(block['timestamp'],16),datetime.timezone.utc).isoformat()}
 report=json.loads((raw/'lbtc_report.json').read_text())['report'];alloc=json.loads((raw/'lbtc_allocation.json').read_text());receipts=json.loads((raw/'lbtc-api-receipts.private.json').read_text())
 packages={}
 assert set(obs['assets'])==set(EXPECTED),'exact asset set required'
 for asset,t in obs['assets'].items():
  assert t['address'].lower()==EXPECTED[asset],'exact token identity mismatch'
  sources={'ethereum':{'url':t['calls']['totalSupply()']['endpoint'],'scope':'Ethereum pinned public ERC20 calls only'},'owner_request':{'reference':'ethereum-btc-assets-bm-evidence-2026-11-04','scope':'Owner checks pending'}}
  axes={a:{'fields':{}} for a in ['stability','backing','liquidity_exit','dependencies','contract_admin','issuer']}
  def add(axis,key,value,unit,basis,src='ethereum',clk=None,owner='BackingMonitor',status=None):axes[axis]['fields'][key]=field(value,unit,owner,[src],clock if clk is None else clk,basis,status)
  add('backing','ethereum_supply',str(D(t['calls']['totalSupply()']['decoded'])/(D(10)**t['calls']['decimals()']['decoded'])),asset.upper(),'Ethereum only, not global liabilities')
  for a,key,owner,basis in [('stability','btc_relative_market_discount','DexTracker','Current executable BTC-relative market evidence pending'),('backing','independently_reconciled_net_backing','BackingMonitor','Full net backing and liability reconciliation incomplete'),('liquidity_exit','sized_exits','DexTracker','100k/1m/10m quotes requested; unavailable is not zero liquidity'),('dependencies','current_route_dependencies','SecurityAnalyst','Exact implementation and route review pending'),('contract_admin','current_authority_and_pause_state','SecurityAnalyst','Code presence and ERC20 metadata do not establish control or reopening'),('issuer','current_custody_control','BackingMonitor','Documentary identity accepted; effective control not independently established')]:add(a,key,None,'unestablished',basis,'owner_request',{},owner)
  if asset=='tbtc':
   add('liquidity_exit','new_and_pending_mint_redemption_status',None,'route status','Reported precautionary pause is a lead; exact affected routes and reopening unverified','owner_request',{},'SecurityAnalyst')
   add('liquidity_exit','current_route_matrix',[{'operation':op,'current_gate_status':None,'pending_request_processing':None,'actual_BTC_delivery':None} for op in ['canonical_mint_new_request','canonical_mint_sweep_finalize','optimistic_mint_request_finalize','new_redemption_request','pending_redemption_proof_timeout','final_Bitcoin_delivery']],'route control/settlement status','Current owner-reviewed matrix pending; historical reported pause is not current reopening evidence, token-level flag absence and indicative secondary routes cannot establish these gates','owner_request',{},'SecurityAnalyst',status='owner_pending')
  if asset=='wbtc':
   html_text=BeautifulSoup((raw/'wbtc_transparency.html').read_text(),'html.parser').get_text(' ',strip=True)
   for captured in ['116,479.1918','116,511.9939','11/04/2026 10:18']:
    assert captured in html_text, 'Frozen WBTC snapshot changed; re-extract and review publisher values'
   sources['wbtc_transparency']={'url':obs['http_sources']['wbtc_transparency']['url'],'scope':'Publisher-reported HTML; incomplete BTC address inventory'}
   c={'publisher_displayed_update':'11/04/2026 10:18','timezone':None,'received_at':obs['http_sources']['wbtc_transparency']['received_at']}
   for k,v,u in [('published_global_circulation','116479.1918','WBTC'),('published_gross_reserves','116511.9939','BTC'),('published_reserve_minus_circulation','32.8021','BTC-equivalent')]:add('backing',k,v,u,'Publisher figures/arithmetic, not independently verified unencumbered reserves or surplus','wbtc_transparency',c,status='publisher_reported')
   tables=BeautifulSoup((raw/'wbtc_transparency.html').read_text(),'html.parser').find_all('table')
   chains=[[cell.get_text(' ',strip=True) for cell in row.find_all('td')] for row in tables[0].find_all('tr')[1:]]
   cust=[[cell.get_text(' ',strip=True) for cell in row.find_all('td')] for row in tables[1].find_all('tr')[1:]]
   chain_total=sum(D(row[1].replace(',','')) for row in chains)
   captured_custody=sum(D(row[1].replace(',','').replace(' BTC','')) for row in cust)
   add('backing','publisher_chain_rows_sum',str(chain_total),'WBTC','All seven displayed chain rows; publisher liabilities only, not independently queried remote chains','wbtc_transparency',c,status='publisher_derived')
   add('backing','publisher_chain_sum_minus_reported_circulation',str(chain_total-D('116479.1918')),'WBTC','Displayed rows reconcile to displayed global total at publisher precision; does not prove full global liabilities','wbtc_transparency',c,status='publisher_derived')
   add('backing','captured_custody_rows',len(cust),'addresses','Only first paginated 20 address rows; not full inventory','wbtc_transparency',c,status='publisher_reported')
   add('backing','captured_custody_rows_btc',str(captured_custody),'BTC','Publisher balances for captured subset, not independent Bitcoin UTXO balances or complete reserves','wbtc_transparency',c,status='publisher_derived')
   add('backing','independent_btc_reserve_reconciliation',None,'BTC','Complete paginated address inventory, independently pinned Bitcoin balances/UTXOs and title/encumbrance evidence unavailable in captured packet','wbtc_transparency',c)
   add('issuer','custody_transition_completion',None,'effective legal/key arrangement','Announcement scheduled transition; no effective-date key/control/custody attestation in captured transparency source','wbtc_transparency',c)

  if asset=='lbtc':
   for name in ['lbtc_report','lbtc_allocation']:sources[name]={'url':receipts[name]['url'],'scope':'First-party report, not independent financial assurance'}
   c={k:report[k] for k in ['as_of','block_time','created_at','ratio_block']};c['ratio_block_chain']=None;c['received_at']=receipts['lbtc_report']['received_at']
   for k,v,u in [('published_gross_backing',D(report['btc_backing'])/D(10)**8,'BTC'),('published_global_supply',D(report['lbtc_supply'])/D(10)**8,'LBTC'),('published_btc_per_lbtc',D(10)**18/D(report['lbtc_ratio']),'BTC/LBTC')]:add('backing',k,str(v),u,'Published ratio is LBTC/BTC at 1e18 scale; reciprocal for BTC/LBTC; not independently reconciled net strategy NAV','lbtc_report',c,status='publisher_reported')
   c={'as_of':alloc['asOfInstant'],'received_at':receipts['lbtc_allocation']['received_at']};total=sum(D(a['balanceBtc']) for a in alloc['accounts'])
   for k,v in [('published_strategy_nav',D(alloc['navBtc'])),('listed_account_balance_sum',total),('nav_minus_listed_accounts',D(alloc['navBtc'])-total)]:add('backing',k,str(v),'BTC','First-party active sleeve; residual basis/completeness unexplained, not loss, surplus or measured options liability; no mixed-clock passive allocation derived','lbtc_allocation',c,status='publisher_reported')
   for k in ['options_net_liabilities','residual_babylon_exposure']:add('backing',k,None,'BTC','Requires positions, valuation and residual exposure reconciliation; Greeks or strategy transition do not establish zero','owner_request',{})
   add('backing','options_position_level_valuation',None,'BTC','reports/latest supplies gross backing/supply/ratio; allocation supplies sleeve NAV/account balances; snapshots supplies Greeks/tenor, not full trade inventory, option marks/counterparty liabilities or closeout netting. Publisher disclosure says individual trade lines are not published. No independently reconciled options liability can be computed.','lbtc_allocation',c)
   add('backing','measured_passive_allocation',None,'BTC','Gross protocol report and active sleeve NAV use different clocks/perimeters; subtraction is not a measured passive portfolio','lbtc_allocation',c)

  from ethereum_btc_owner_evidence import adopt
  adopt(raw,asset,t['address'],axes,sources,add)
  from ethereum_btc_wbtc import adopt as adopt_wbtc
  adopt_wbtc(raw,asset,axes,sources,add)
  from ethereum_btc_lbtc import adopt as adopt_lbtc
  adopt_lbtc(raw,asset,obs,sources,add)
  from ethereum_btc_security import adopt as adopt_security
  adopt_security(raw,asset,t['address'],axes,sources,add)
  projects={'wbtc':('bit-global','wbtc'),'tbtc':('threshold-network','tbtc'),'lbtc':('lombard-finance','lombard-lbtc')}
  project,component=projects[asset]
  for source in sources.values():source.setdefault('owner','BackingMonitor');source.setdefault('status','bounded_observation')
  sources['owner_request']['status']='owner_pending'
  payload={'schema_version':SCHEMA,'assembly_owner':'BackingMonitor','evidence_status':'consolidated_bounded_unscored_pending_RiskAnalyst_review' if 'security_live' in sources else 'initial_partial_unscored_pending_owner_and_RiskAnalyst_review','identity':{'project':project,'component':component,'riskanalyst_slug':asset,'chain':'ethereum','chain_id':1,'token':t['address'],'decimals':t['calls']['decimals()']['decoded']},'cadence':{'selected':'one_off','scope':'initial exact-component report evidence','exposure_classification':'unknown','exposure_as_of':None,'schedule_installed':False},'coverage':{a:{'unknown_fields':[k for k,f in v['fields'].items() if f['value'] is None]} for a,v in axes.items()},'axes':axes,'sources':sources,'publication':{'status':'local_candidate_not_authorized'}}
  import jsonschema
  jsonschema.Draft202012Validator(json.loads((ROOT/'specs/shared-asset-evidence-v1.schema.json').read_text())).validate(payload)
  validate(payload);body=canonical(payload);sha=digest(body);dest=output/asset/'snapshots';dest.mkdir(parents=True,exist_ok=True);path=dest/(sha+'.json')
  if path.exists():assert path.read_bytes()==body
  else:path.write_bytes(body)
  pointer={'schema_version':'shared-asset-unscored-evidence-pointer/1','identity':payload['identity'],'evidence_version':'sha256:'+sha,'snapshot':'snapshots/'+path.name,'assessment_version':None,'assessment_status':'awaiting_RiskAnalyst_review','status':'consolidated_bounded_pending_RiskAnalyst_review' if 'security_live' in sources else 'initial_partial_awaiting_owners','publication':'not_authorized'}
  (dest.parent/'current.json').write_bytes(canonical(pointer));packages[asset]=pointer
 provenance={str(p.relative_to(raw)):digest(p.read_bytes()) for p in raw.rglob('*') if p.is_file()};output.mkdir(parents=True,exist_ok=True);(output/'provenance.private.json').write_bytes(canonical(provenance));(output/'manifest.json').write_bytes(canonical(packages));return packages
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--raw',required=True);p.add_argument('--output',required=True);p.add_argument('--freeze-owner-inputs',action='store_true');a=p.parse_args()
 if a.freeze_owner_inputs:
  from ethereum_btc_owner_evidence import freeze
  freeze(a.raw)
  from ethereum_btc_security import freeze as freeze_security
  freeze_security(a.raw)
 print(json.dumps(build(a.raw,a.output),indent=2))
