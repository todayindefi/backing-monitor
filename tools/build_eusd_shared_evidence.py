#!/usr/bin/env python3
"""Freeze BM eUSD six-axis selection; grades and private provenance stay separate."""
import argparse,json,hashlib
from pathlib import Path
from shared_asset_evidence import SCHEMA,field,write_bundle,validate
from eusd_product import TOKEN

def build(product,issuer,output,provenance):
    if product['identity']['chain_id']!=1 or product['identity']['token'].lower()!=TOKEN:raise ValueError('Wrong eUSD identity')
    clock=product['source_clock'];a=product['accounting'];r=product['redemption'];axes={k:{'fields':{}}for k in ['stability','backing','liquidity_exit','dependencies','contract_admin','issuer']}
    sources={'native':{'owner':'PegTracker','status':'pinned_read_with_field_gaps','url':'https://etherscan.io/address/'+TOKEN,'clock':clock},'issuer_selected':{'owner':'DeFiAnalyst','status':'selected_component_documentary','checked':issuer['profile_checked']}}
    def add(axis,key,value,unit,basis,owner='BackingMonitor',status=None,source='native',source_clock=clock):
        axes[axis]['fields'][key]=field(value,unit,owner,[source],source_clock,basis,status)
    add('stability','nominal_reference_usd','1','USD/eUSD','Nominal dollar target; no guarantee of cash redemption.')
    add('stability','market_price',None,'USD/eUSD','Independent USD spot is not established by an indicative USDC sale quote.',owner='PegTracker',status='not_measured')
    add('stability','history',None,'time series','No synthetic history or plugin-price substitution.',owner='PegTracker',status='not_measured')
    for key,unit in [('supply_eusd','eUSD'),('baskets_needed','basket units'),('basket_units_held_low','basket units'),('basket_units_held_high','basket units'),('basket_unit_residual_low','basket units'),('basket_unit_coverage_low_pct','percent'),('external_registered_plugin_mark_low_usd','protocol-marked USD'),('external_registered_plugin_mark_high_usd','protocol-marked USD')]:
        add('backing',key,a[key],unit,a['basis'],status='derived' if a[key]is not None else 'unknown')
    add('backing','current_receipt_balances',product['basket']['holdings'],'receipt-native units and explicit per-token decimals','Actual backing-manager balances and current per-basket requirements distinct from prime target weights; no double counting underlying.',status='derived')
    add('backing','independent_recoverable_backing_usd',None,'USD','Plugin marks and basket-unit equality are not independent credit recovery.',status='not_established')
    add('backing','rsr',product['rsr'],'RSR raw/18-decimal units; optional getters explicitly null',product['rsr']['basis'])
    for key,unit in [('available_eusd','eUSD'),('available_supply_pct','percent'),('frozen','boolean'),('trading_paused','boolean'),('issuance_paused','boolean'),('trades_open','count')]:
        add('liquidity_exit',key,r[key],unit,r['basis'],owner='PegTracker')
    add('liquidity_exit','dex_depth',None,'USD at 10/25/50bps','No accepted quote observation in this collection; no depth inferred.',owner='PegTracker',status='not_measured')
    add('liquidity_exit','final_cash_proceeds',None,'USDC/USDT','Basket delivery, receipt withdrawal and final cash sale are separate unexecuted stages.',status='not_measured')
    add('dependencies','current_basket_receipts',[{'token':x['token'],'plugin':x['plugin'],'symbol':x['symbol']}for x in product['basket']['holdings']if x['current_basket_member']is True],'address-bound receipt/plugin identities','Not a current underlying lending-market allocation or credit judgment.',owner='PegTracker')
    add('dependencies','underlying_allocations',None,'underlying claim allocations','Exact receipt lookthrough remains unestablished; no governance target inheritance.',status='not_established')
    add('contract_admin','exact_authority_walk',None,'control paths','Financial getters are not implementation/authority clearance; Security return pending.',owner='SecurityAnalyst',status='owner_pending')
    add('issuer','selected_component',issuer,'documentary facts and explicit source clocks','Exact Reserve eUSD selected fields only; private parent and unscored family review not inherited.',owner='DeFiAnalyst',source='issuer_selected',source_clock={'checked':issuer['profile_checked'],'original_observations':'per selected record'})
    if product.get('runtime'):
        axes['stability']['fields']['indicative_sell_quote_usdc']=field(product['stability'].get('market_price'),'USDC/eUSD','PegTracker',['native'],{'quote_observed_at':product['stability'].get('market_price_clock')},'Small sell quote; nominal USDC reference is not independently measured USD spot.', 'observed' if product['stability'].get('market_price')is not None else 'not_measured')
        if product['stability'].get('history'):axes['stability']['fields']['history']=field(product['stability']['history'],'USDC/eUSD retained matched series','PegTracker',['native'],{'original_clocks':'per row'},'Actual quote/reference observations only; no synthetic backfill.','observed')
        if product['liquidity_exit'].get('quotes'):axes['liquidity_exit']['fields']['dex_depth']=field(product['liquidity_exit'],'USDC reference rungs/impact bps','PegTracker',['native'],{'quote_clocks':'per row','accounting':product['liquidity_exit'].get('nav_reference_clock')},'Indicative quote cost and size impact separate; no execution guarantee.','observed')
    lookthrough=product.get('dependency_lookthrough')
    if lookthrough:
        sources['lmt_native']={'owner':'LendingMarketTracker','status':'pinned_native_with_separate_api_clocks','clock':lookthrough['source_clock']}
        add('dependencies','underlying_allocations',lookthrough,'native raw loan units and separately marked API USD allocations','Deduplicated markets; stored books and cash remain distinct. No double counting claims in backing.',owner='LendingMarketTracker',status='observed',source='lmt_native',source_clock=lookthrough['source_clock'])
    market_status='observed_indicative_quotes'if product.get('liquidity_exit',{}).get('quotes')else 'unmeasured'
    payload={'schema_version':SCHEMA,'identity':{'project':'reserve-protocol','component':'reserve-eusd','asset':'eUSD','chain':'ethereum','chain_id':1,'token':TOKEN,'decimals':18},'assembly_owner':'BackingMonitor','evidence_status':'bounded_candidate_with_explicit_gaps','sources':sources,'axes':axes,'publication':{'status':'local_candidate_not_authorized'},'cadence':{'selected':'two_hour_dynamic_after_validated_cutover','scope':'Reserve eUSD Ethereum only','exposure_classification':'unknown_not_requested_from_private_accounts','exposure_as_of':None,'schedule_installed':product.get('runtime',{}).get('schedule_installed',False),'dynamic_seconds':7200,'schedule_status':'installed' if product.get('runtime',{}).get('schedule_installed')else 'not_installed_pending_reader_cutover','documentary':'original owner clocks'},'coverage':{'status':'partial','market_history_exit_quotes':market_status,'authority':'owner_pending','receipt_lookthrough':'bounded_native_and_api'if lookthrough else 'unestablished'}}
    validate(payload)
    assessment={'schema_version':'shared-asset-assessment/1','owner':'RiskAnalyst','asset':'eusd','chain':'ethereum','token':TOKEN,'status':'pending_current_assessment','scores':None}
    return write_bundle(output,payload,assessment,provenance)
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--product',required=True,type=Path);p.add_argument('--issuer',required=True,type=Path);p.add_argument('--output',required=True,type=Path);a=p.parse_args();raw=a.product.read_bytes();iraw=a.issuer.read_bytes();i=json.loads(iraw)['component_profiles']['eusd'];print(json.dumps(build(json.loads(raw),i,a.output,{'product_source':str(a.product.resolve()),'product_sha256':hashlib.sha256(raw).hexdigest(),'issuer_source':str(a.issuer.resolve()),'issuer_sha256':hashlib.sha256(iraw).hexdigest()}),indent=2))
