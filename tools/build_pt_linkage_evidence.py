"""Offline exact-component evidence assembly. Owner gaps stay null; no assessment."""
import argparse,datetime,json,pathlib,shutil
from decimal import Decimal as D
from shared_asset_evidence import SCHEMA,canonical,digest,field,validate,walk_fields
ROOT=pathlib.Path(__file__).resolve().parents[1]
IDENTITIES={'srusdat':(143,'monad','0x17b8f7373ecd556192abfc85be314e5d4fb6b3fa'),'siusd':(1,'ethereum','0xdbdc1ef57537e34680b898e1febd3d68c7389bcb'),'susn':(1,'ethereum','0xe24a3dc889621612422a64e6388927901608b91d')}
AXES=['stability','backing','liquidity_exit','dependencies','contract_admin','issuer']
def normalized(raw,dec):return format(D(raw)/(D(10)**dec),'f')
def freeze_inputs(dest):
 dest=pathlib.Path(dest);dest.mkdir(parents=True,exist_ok=True)
 base=pathlib.Path('/home/danger/riskAnalyst/data/reviews');v=base/'monad-saturn-vault-liquidity-2026-11-04'
 paths={'saturn_family.json':ROOT/'data/saturn_family.json','saturn_exit_review.json':ROOT/'data/saturn_exit_review.json','secondary_acceptance.json':base/'six-portfolio-risk-refresh-2026-11-02/srusdat-secondary-cash-acceptance.json','monad_summary.json':v/'summary.json','monad_curve_state.json':v/'monad-curve-and-vault-state.json','pt_quote_100k.json':v/'quote-srUSDat-100000-srUSDat.json','pt_quote_usdc_failure.json':v/'quote-srUSDat-10000-USDC.json','pt_quote_250k_failure.json':v/'stress-srUSDat-250000.json','security_existing_handback.md':pathlib.Path('/home/danger/security_analyst/handoffs/pt-linkage-existing-security-evidence-2026-11-04.md'),'security_existing_index.json':pathlib.Path('/home/danger/security_analyst/audits/pt-linkage-existing-evidence-index-2026-11-04.json')}
 da=pathlib.Path('/home/danger/DeFiAnalyst')
 receipt=da/'HANDOFF_pt_linkage_profiles_RESULTS_2026-11-04.json'
 if receipt.exists():
  paths['da_receipt.json']=receipt
  paths['da_historical_claim_review.json']=da/'data/reviews/pt-linkage-profiles-2026-11-04/historical-claim-review.json'
  paths['ra_da_acceptance.private.json']=base/'pt-linkage-gaps-2026-11-04/da-acceptance.json'
  for slug in IDENTITIES:paths['da_'+slug+'.json']=da/('data/reviews/pt-linkage-profiles-2026-11-04/exports/'+slug+'.json')
 index={}
 for name,path in paths.items():
  target=dest/name
  if not target.exists():shutil.copyfile(path,target)
  index[name]={'origin':str(path),'sha256':digest(target.read_bytes())}
 (dest/'source-index.private.json').write_bytes(canonical(index))
 dex=pathlib.Path('/home/danger/DexTracker/data/exit_evidence/pt-linkage/2026-11-04')
 if (dex/'manifest.json').exists():
  from pt_linkage_dex import freeze
  freeze(dex,dest)
 security=pathlib.Path('/home/danger/security_analyst/audits/pt-linkage-authority-2026-11-04')
 if (security/'owner-summary.json').exists():
  from pt_linkage_security import freeze as freeze_security
  freeze_security(security,dest)
def build(inputs,output):
 inputs=pathlib.Path(inputs);output=pathlib.Path(output).resolve()
 if '.private-reviews' not in output.parts and not output.is_relative_to(pathlib.Path('/tmp')):raise ValueError('private/local output required')
 def read(n):return json.loads((inputs/n).read_text())
 obs=read('financial-observations.private.json');family=read('saturn_family.json');review=read('saturn_exit_review.json');accept=read('secondary_acceptance.json');summ=read('monad_summary.json');curve=read('monad_curve_state.json');quote=read('pt_quote_100k.json');bridge=obs['bridge_accounting_lead'];manifest={}
 for slug,(cid,ch,token) in IDENTITIES.items():
  a=obs['assets'][slug];assert a['chain_id']==cid and a['chain']==ch and a['token'].lower()==token,'exact identity mismatch'
  b=obs['blocks'][ch];assert b['chain_id']['result']==hex(cid) and b['hash_stable'] is True,'unstable block/chain'
  block=b['block']['result'];clock={'block':int(block['number'],16),'block_hash':block['hash'],'observed_at':datetime.datetime.fromtimestamp(int(block['timestamp'],16),datetime.timezone.utc).isoformat()}
  sources={'financial_rpc':{'owner':'BackingMonitor','endpoint':a['reads']['totalSupply()'].get('endpoint'),'scope':'Pinned ERC20/ERC4626 financial reads only, no verified implementation/control claim'},'pending_security':{'owner':'SecurityAnalyst','request':'pt-linkage-security-dex-bm-2026-11-04.md'},'pending_da':{'owner':'DeFiAnalyst','request':'pt-linkage-profiles-defianalyst-2026-11-04.md'},'pending_dex':{'owner':'DexTracker','request':'pt-linkage-security-dex-bm-2026-11-04.md'},'bm_gaps':{'owner':'BackingMonitor','scope':'Underlying financial reconciliation incomplete'}}
  axes={k:{'fields':{}} for k in AXES}
  def add(axis,key,value,unit,basis,src='financial_rpc',clk=None,owner='BackingMonitor',status=None):axes[axis]['fields'][key]=field(value,unit,owner,[src],clock if clk is None else clk,basis,status)
  def missing(axis,key,owner,basis,src):add(axis,key,None,'unestablished',basis,src,{},owner,'owner_pending')
  reads=a['reads'];dec=reads['decimals()'].get('decoded');supply=reads['totalSupply()'].get('decoded');assert isinstance(dec,int) and 0<=dec<=36 and isinstance(supply,int)
  if (inputs/'security_existing_index.json').exists():
   sx=read('security_existing_index.json');sources['security_reuse_triage']={'owner':'SecurityAnalyst','reference':'pt-linkage-existing-security-evidence-2026-11-04.md','scope':'Reuse-only search; not a current authority walk'}
   add('contract_admin','existing_packet_search_status','No current exact-deployment Security packet located in the bounded owner search; targeted current walk requested','coverage statement','August Ethereum srUSDat/PT/SY evidence remains historical and does not verify these exact live controls','security_reuse_triage',{'checked_at':sx['checked_at'],'mode':sx['mode']},owner='SecurityAnalyst',status='owner_reported_gap')
  add('backing','local_supply',normalized(supply,dec),slug+' shares','This exact local token supply; not global additional liability')
  add('backing','local_decimals',dec,'decimal places','Decoded token metadata; not issuer identity attestation')
  for axis,key,owner,basis,src in [
   ('stability','price_history','DexTracker','Source-owner historical marks and exchange-rate versus market discount separation pending','pending_dex'),
   ('backing','underlying_exposure_inventory','BackingMonitor','Complete current look-through exposure inventory, encumbrances and offchain assets unverified','bm_gaps'),
   ('backing','underlying_liquid_buffer','BackingMonitor','No reconciled underlying cash or liquid external-asset buffer established; own-token holdings are not cash','bm_gaps'),
   ('backing','underlying_liabilities','BackingMonitor','Complete underlying liabilities including queues and external claims unverified','bm_gaps'),
   ('backing','independently_reconciled_net_nav','BackingMonitor','Wrapper reported assets alone do not reconcile underlying economic NAV','bm_gaps'),
   ('backing','verified_loss_order','DeFiAnalyst','Current documented loss order and its exact legal/contract scope await documentary return and Security validation','pending_da'),
   ('liquidity_exit','immediately_available_usdc','BackingMonitor','Wrapper token holdings and previews are not final cash or proven access','bm_gaps'),
   ('liquidity_exit','current_queue_eligibility','SecurityAnalyst','Eligibility, access gates and queue completion unverified; no wallet queries','pending_security'),
   ('liquidity_exit','current_queue_timing','SecurityAnalyst','No current queue completion time established','pending_security'),
   ('liquidity_exit','current_fees','SecurityAnalyst','No verified full-path fee/gas schedule','pending_security'),
   ('liquidity_exit','full_cash_execution','BackingMonitor','No transaction requested; quotes/previews do not prove complete execution','bm_gaps'),
   ('contract_admin','verified_implementation','SecurityAnalyst','Exact runtime/implementation review pending','pending_security'),
   ('contract_admin','mint_burn_upgrade_pause_authorities','SecurityAnalyst','Live reachable control paths, thresholds, delays and roles pending','pending_security'),
   ('issuer','documentary_identity_and_holder_rights','DeFiAnalyst','Exact-component standard researched export pending; June light report is not documentary validation','pending_da')]:missing(axis,key,owner,basis,src)
  if slug!='srusdat':
   ur=a['underlying_reads'];underlying=reads['asset()'].get('decoded');ud=ur.get('decimals()',{}).get('decoded');assert isinstance(underlying,str) and isinstance(ud,int)
   add('dependencies','reported_underlying_token',underlying,'Ethereum address','asset() pointer only; issuer and implementation verification pending')
   usym=ur['symbol()'].get('decoded') or 'underlying token'
   underlying_supply=ur.get('totalSupply()',{}).get('decoded')
   add('backing','underlying_token_total_supply',normalized(underlying_supply,ud) if isinstance(underlying_supply,int) else None,usym,'Ethereum underlying token totalSupply only; not verified global economic liabilities or backing')
   for key,call,unit in [('wrapper_total_assets','totalAssets()',usym),('convert_one_share','convertToAssets(uint256)',usym+'/share'),('preview_redeem_one_share','previewRedeem(uint256)',usym+'/share')]:
    result=reads[call];value=result.get('decoded');add('backing',key,normalized(value,ud) if isinstance(value,int) else None,unit,'Contract-reported underlying token units; not USD valuation or redemption execution',status='contract_reported' if isinstance(value,int) else 'unavailable')
   bal=ur['balanceOf(wrapper)'].get('decoded');total=reads['totalAssets()'].get('decoded')
   add('backing','underlying_balance_at_wrapper',normalized(bal,ud) if isinstance(bal,int) else None,usym,'Underlying ERC20 units held by this wrapper; not underlying cash reserves')
   add('backing','reported_assets_minus_token_balance',normalized(total-bal,ud) if isinstance(total,int) and isinstance(bal,int) else None,usym,'Wrapper accounting cross-check only; zero does not prove underlying solvency')
   missing('liquidity_exit','sized_secondary_exits','DexTracker','No accepted current public-size direct or underlying-to-USDC exits in existing inputs','pending_dex')
   missing('dependencies','underlying_to_cash_path','DeFiAnalyst','Documented asset path, settlement counterparties and access conditions pending','pending_da')
  else:
   add('liquidity_exit','local_erc4626_probe_results',{sig:{'decoded':reads[sig].get('decoded'),'call_succeeded':reads[sig].get('ok'),'decode_error':reads[sig].get('decode_error'),'errors':reads[sig].get('errors',[])} for sig in ['asset()','totalAssets()','convertToAssets(uint256)','previewRedeem(uint256)']},'read-only probe results','These calls reverted at the observed block; no supported local ERC4626 conversion established, not proof every possible route is unavailable',status='observed_call_failures')
   sources.update({'saturn_family':{'owner':'PegTracker','producer':'saturn_family.json','scope':'Ethereum Strata/Saturn family only, not Monad verified backing'},'saturn_review':{'owner':'BackingMonitor','producer':'saturn_exit_review.json','scope':'Dated owner-review adapter'},'secondary_acceptance':{'owner':'RiskAnalyst','reference':'srusdat-secondary-cash-acceptance.json','scope':'November 2 bounded partial-route acceptance; private original retained separately'},'nov4_quotes':{'owner':'RiskAnalyst','reference':'monad-saturn-vault-liquidity-2026-11-04','scope':'Bounded November 4 review; not vault or route approval'}})
   eb=obs['blocks']['ethereum']['block']['result'];bc={'monad':clock,'ethereum':{'block':int(eb['number'],16),'block_hash':eb['hash'],'observed_at':datetime.datetime.fromtimestamp(int(eb['timestamp'],16),datetime.timezone.utc).isoformat()}}
   candidate=bridge.get('candidate_ethereum_adapter');add('dependencies','candidate_ethereum_adapter',candidate,'Ethereum address','Monad peers(30101) pointer and adapter token() are accounting leads, not Security/issuer authorization',clk=bc,status='candidate_unverified')
   good=bridge.get('matches_known_ethereum_senior') is True;ed=bridge.get('ethereum_senior_decimals',{}).get('decoded');esc=bridge.get('escrow_balance',{}).get('decoded');ok=good and isinstance(ed,int) and isinstance(esc,int) and obs['blocks']['ethereum']['hash_stable'] is True
   add('backing','candidate_escrow_senior_shares',normalized(esc,ed) if ok else None,'Ethereum srUSDat shares','Observed balance of known Ethereum senior token at candidate adapter, not separate economic backing',clk=bc,status='candidate_unverified' if ok else 'unavailable')
   delta=D(normalized(esc,ed))-D(normalized(supply,dec)) if ok else None
   add('backing','candidate_escrow_minus_local_supply',format(delta,'f') if delta is not None else None,'srUSDat shares','Two independently pinned chain blocks; no synchronized global state, in-flight or other destinations reconciliation; zero is only a balance match',clk=bc,status='partial_reconciliation' if ok else 'unavailable')
   add('backing','liability_counting_policy','Do not add remote representations to escrowed Ethereum shares as independent liabilities','accounting policy','Economic ownership is not duplicated by transport; exact in-flight/burn/mint semantics require Security and bridge observations',clk=bc,status='accounting_constraint')
   for key,basis in [('inflight_share_units','Pending messages and delivered/burned/minted units not reconciled'),('other_remote_liabilities','Other destinations and routes not enumerated'),('bridge_decimal_dust','Local decimals observed; shared decimals/rounding semantics not Security verified')]:missing('backing',key,'BackingMonitor',basis,'bm_gaps')
   missing('contract_admin','layerzero_endpoint_peer_delegate_config_authorities','SecurityAnalyst','Current endpoint, peers, delegate and send/receive configuration authority verification requested','pending_security')
   tc=family['tranche_coverage'];fc={'producer_as_of':tc['as_of'],'block':None,'scope':'Ethereum family producer; block-level source clocks unavailable in this export'}
   for key,sourcekey,unit in [('ethereum_tranche_senior_tvl','senior_tvl_usd','producer USD'),('ethereum_tranche_junior_tvl','junior_tvl_usd','producer USD'),('ethereum_tranche_collateral_value','collateral_usd','producer USD'),('ethereum_tranche_coverage_ratio','coverage_ratio','ratio'),('ethereum_senior_reported_nav','srusdat_nav','producer NAV')]:add('backing',key,tc.get(sourcekey),unit,'Ethereum producer context only; not local Monad NAV/backing or independent full Saturn solvency','saturn_family',fc,owner='PegTracker',status='source_reported_context')
   rc={'review_date':review['review_date'],'accepted_at':review['accepted_at']}
   stages=[('pt_sale','PT sale returns srUSDat shares, not USDC','partial_quote_only'),('share_transport_or_local_conversion','LayerZero share transport differs from Saturn CCIP; delivery and supported local conversion unestablished','unestablished'),('ethereum_tranche_redemption','A preview or zero tranche cooldown does not establish delivered USDat','preview_not_execution'),('saturn_settlement','Underlying asynchronous Saturn queue is separate; current eligibility/timing unknown','unestablished'),('usdat_to_usdc_sale','Positive dated size-specific USDat quotes on both chains; no actual complete cash delivery','dated_quote_only')]
   for key,meaning,status in stages:add('liquidity_exit','stage_'+key,{'meaning':meaning,'end_to_end_execution':None},'route stage',meaning,'saturn_review',rc,status=status)
   add('liquidity_exit','nov2_accepted_sale_legs',[{'chain':q['chain'],'block':q['block'],'source_timestamp':q['source_timestamp'],'input_token':'USDat','input_raw':q['usdat_input_raw'],'output_token':'USDC','output_raw':q['usdc_output_raw'],'decimals':q['decimals'],'basis':q['input_basis'],'evidence_class':q['class']} for q in accept['quotes']],'native raw token units','Owner accepted tested-size quote only; actual-state failures/prerequisites retained separately, not approvals or fills','secondary_acceptance',{'accepted_at':accept['accepted_at'],'leg_observation_clocks':'embedded per chain'},owner='RiskAnalyst',status='dated_quote_only')
   add('liquidity_exit','nov2_actual_state_gate',{'complete_route_passed':False,'failure_scope':'Required intermediate tokens/allowances absent in tested actual state; preview is not redemption; local Monad conversion unestablished','quote_implies_execution':False},'bounded test result','Private holder details omitted; no generalized claim that all accounts/routes fail','secondary_acceptance',{'accepted_at':accept['accepted_at']},owner='RiskAnalyst',status='accepted_bounded_failure')
   qd=quote['response']['data'];assert quote['token_out']['address'].lower()==token and quote['token_out']['chainId']==cid
   add('liquidity_exit','nov4_pt_sale_quote',{'pt':quote['pt'],'pt_input_raw':quote['input_raw'],'pt_decimals':quote['input_decimals'],'notional_usd':quote['notional_usd'],'notional_basis':quote['notional_basis'],'share_output_raw':qd['amountOut'],'share_decimals':quote['token_out']['decimals'],'output_token':token,'api_price_impact':qd['priceImpact'],'api_fee_usd':qd['fee']['usd'],'execution':None},'quote native units','Includes potentially cancellable limit orders; PT quote not srUSDat direct sale or final cash. Fee USD is API-reported, excludes full-path gas','nov4_quotes',{'requested_at':quote['requested_at'],'received_at':quote['received_at'],'api_price_updated_at':quote['token_out']['priceUpdatedAt']},owner='RiskAnalyst',status='dated_quote_only')
   fails=[]
   for name in ['pt_quote_usdc_failure.json','pt_quote_250k_failure.json']:
    q=read(name);fails.append({'requested_at':q['requested_at'],'received_at':q['received_at'],'input_raw':str(q['input_raw']),'error':q['error'],'notional_usd':q.get('notional_usd',q.get('size'))})
   add('liquidity_exit','nov4_selected_route_failures',fails,'API errors','PT→USDC unsupported for tested nonaggregator call and 250k PT→shares MarketProportionTooHigh; not proof all venues have zero liquidity','nov4_quotes',{'observations':'embedded request/receipt clocks'},owner='RiskAnalyst',status='dated_failure')
   add('liquidity_exit','nov4_monad_pool_usdc_balance',normalized(next(c['value'] for c in curve['calls'] if c['signature']=='balances(uint256)' and c['args']==[1]),6),'USDC token units','Pool cash observation only; not reserved capacity, wrapper liquid buffer or complete-route executable proceeds','nov4_quotes',{'block':curve['block'],'block_hash':curve['block_hash'],'observed_at':curve['block_utc']},owner='RiskAnalyst')
   add('stability','oracle_nav_vs_market_exit_distinction',review['valuation']['reading'],'valuation distinction',review['valuation']['scope'],'saturn_review',rc,status='dated_review')
  if (inputs/('da_'+slug+'.json')).exists():
   profile=read('da_'+slug+'.json');receipt=read('da_receipt.json');entry=receipt['canonical_profiles'][slug]
   assert digest((inputs/('da_'+slug+'.json')).read_bytes())==entry['component_export_sha256'],'DA export hash mismatch'
   assert entry['chain_id']==cid and entry['requested_address'].lower()==token
   assert any(c.get('chain')==ch and c['address'].lower()==token for c in profile['contracts']),'DA exact deployment missing'
   allowed={'srusdat':{'monad_srusdat_publisher_authorization','monad_srusdat_official_route','share_transport_vs_underlying_migration','monad_route_boundary'},'siusd':{'gateway_and_interface_version','two_stage_exit','fifo_funding','faq_three_stage_loss_order','slashing_two_tranche_conflict','holder_rights','site_counterparty','access_restriction'},'susn':{'issuer_operator_split','holder_rights','suspension_and_principal_loss','unstake_vs_final_exit','primary_access_and_limits','terms_delay_and_obligation','plms_claims','published_fees'}}[slug]
   facts=[{k:f.get(k) for k in ['component_slug','key','value','status','basis','source','as_of']} for f in profile['facts'] if f.get('component_slug')==slug and f['key'] in allowed]
   assert {f['key'] for f in facts}==allowed,'reviewed documentary fact missing'
   sources['da_component']={'owner':'DeFiAnalyst','reference':'pt-linkage-profiles-2026-11-04/exports/'+slug+'.json','scope':'Selected exact-component documentary facts only; live state, financials and legal effectiveness not verified'}
   add('issuer','selected_documentary_facts',facts,'dated documentary facts','Primary-source documentary claims/terms with original per-fact dates; DA verified status is documentary only, not financial/control assurance','da_component',{'profile_checked':profile['profile_checked'],'document_dates':'embedded per fact, null preserved'},owner='DeFiAnalyst',status='documentary_received')
   axes['issuer']['fields']['documentary_identity_and_holder_rights']['basis']='Canonical exact-component documentary inputs received; effective legal title/claim/segregation and independently verified holder rights remain unestablished'
   axes['issuer']['fields']['documentary_identity_and_holder_rights']['status']='unestablished'
   if (inputs/'da_historical_claim_review.json').exists():
    historical=[r for r in read('da_historical_claim_review.json') if r['component']==slug]
    assert historical,'DA component historical review missing'
    sources['da_historical_review']={'owner':'DeFiAnalyst','reference':'pt-linkage-profiles-2026-11-04/historical-claim-review.json','scope':'Component-scoped documentary review of historical claims; not fresh holdings, deployed loss ordering or complete exit validation'}
    add('issuer','historical_claim_review',historical,'component historical-claim review','Historical claims are tested against cited primary documentation; contradictions and named owner gaps remain, named providers are not current measured allocations','da_historical_review',{'review_checked':sorted({r['checked'] for r in historical}),'precision':'day','live_observation_at':None},owner='DeFiAnalyst',status='documentary_review_received')
   if (inputs/'ra_da_acceptance.private.json').exists():
    prerequisite=read('ra_da_acceptance.private.json');accepted=prerequisite['profiles'][slug]
    assert accepted['export_sha256']==entry['component_export_sha256'],'RiskAnalyst DA accepted export mismatch'
    sources['pending_da']['status']='documentary_prerequisite_accepted_remaining_effectiveness_gaps'
    sources['pending_da']['scope']='Existing documentary commission complete and accepted; effective financial/legal/runtime questions remain separate'

   axes['backing']['fields']['verified_loss_order']['basis']='DA inputs received; documentary claims and any contradictions are retained, deployed/legal loss execution remains unverified'
   axes['backing']['fields']['verified_loss_order']['status']='unestablished'
   if slug=='srusdat':
    f=next(f for f in facts if f['key']=='monad_srusdat_publisher_authorization')
    add('dependencies','documentary_deployment_authorization',f['value'],'publisher attribution','Exact-chain official frontend mapping establishes documentary attribution only; peers, controls, bridge accounting and settlement not cleared','da_component',{'document_as_of':f['as_of'],'profile_checked':profile['profile_checked']},owner='DeFiAnalyst',status='documentary_verified')
  from pt_linkage_dex import adopt
  adopt(inputs,slug,token,sources,axes,add)
  from pt_linkage_security import adopt as adopt_security
  adopt_security(inputs,slug,token,sources,axes,add)
  if slug=='siusd':axes['backing']['fields']['verified_loss_order'].update(owner='SecurityAnalyst',source_refs=['pending_security'],status='unresolved_deployed_order',basis='Accepted DA FAQ three-tier and slashing-page two-tranche claims conflict; deployed loss-execution order requires existing Security source/runtime verification, not another documentary commission')
  for source_id,source in sources.items():source.setdefault('status','owner_pending' if source_id.startswith('pending_') or source_id=='bm_gaps' else 'bounded_observation')
  coverage={axis:{'status':'partial_with_explicit_unknowns','field_count':len(v['fields']),'unknown_fields':[k for k,f in v['fields'].items() if f['value'] is None]} for axis,v in axes.items()}
  payload={'schema_version':SCHEMA,'assembly_owner':'BackingMonitor','evidence_status':'consolidated_bounded_unscored_pending_RiskAnalyst_review' if 'security_live' in sources and (slug=='srusdat' or 'dex_quotes' in sources) else 'initial_partial_unscored_pending_owner_and_RiskAnalyst_review','identity':{'project':{'srusdat':'strata','siusd':'infinifi','susn':'noon'}[slug],'component':slug,'chain':ch,'chain_id':cid,'token':token,'decimals':dec},'cadence':{'selected':'one_off','scope':'initial exact-component report evidence; no recurring monitoring claim','exposure_classification':'unknown','exposure_as_of':None,'schedule_installed':False,'reason':'User requested one-off evidence; owner inputs retain their own clocks and unresolved financial/control coverage'},'axes':axes,'sources':sources,'coverage':coverage,'publication':{'status':'local_candidate_not_authorized'}}
  import jsonschema
  jsonschema.Draft202012Validator(json.loads((ROOT/'specs/shared-asset-evidence-v1.schema.json').read_text())).validate(payload)
  validate(payload);body=canonical(payload);sha=digest(body);out=output/slug;dest=out/'snapshots';dest.mkdir(parents=True,exist_ok=True);target=dest/(sha+'.json')
  if target.exists():assert target.read_bytes()==body
  else:target.write_bytes(body)
  pointer={'schema_version':'shared-asset-unscored-evidence-pointer/1','identity':payload['identity'],'evidence_version':'sha256:'+sha,'snapshot':'snapshots/'+target.name,'assessment_version':None,'status':'consolidated_bounded_pending_RiskAnalyst_review' if 'security_live' in sources and (slug=='srusdat' or 'dex_quotes' in sources) else 'initial_partial_awaiting_owners_and_RiskAnalyst','publication':'not_authorized'}
  (out/'current.json').write_bytes(canonical(pointer));coverage={axis:{p.split('/fields/')[-1]:{'status':f['status'],'owner':f['owner'],'clock':f['clock']} for p,f in walk_fields(v)} for axis,v in axes.items()};(out/'coverage.json').write_bytes(canonical(coverage));manifest[slug]=pointer
 output.mkdir(parents=True,exist_ok=True);(output/'manifest.json').write_bytes(canonical(manifest));(output/'provenance.private.json').write_bytes(canonical({p.name:digest(p.read_bytes()) for p in inputs.iterdir() if p.is_file()}));return manifest
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--inputs',required=True);p.add_argument('--output',required=True);p.add_argument('--freeze-existing-inputs',action='store_true');a=p.parse_args()
 if a.freeze_existing_inputs:freeze_inputs(a.inputs)
 print(json.dumps(build(a.inputs,a.output),indent=2))
