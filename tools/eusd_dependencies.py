"""Select public eUSD receipt lookthrough; never turn stored books into cash."""
from decimal import Decimal,localcontext

EXPECTED_VAULTS={'0x9a1d6bd5b8642c41f25e0958129b85f8e1176f3e','0x8c106eedad96553e64287a5a6839c3cc78afa3d0','0xb576765fb15505433af24fee2c0325895c559fb2'}
def project_lookthrough(raw,product):
    if raw['schema_version']!='eusd-lookthrough-v1'or raw['source_clock']['chain_id']!=1:raise ValueError('Wrong lookthrough schema/chain')
    if {v['address'].lower()for v in raw['native_vaults']}!=EXPECTED_VAULTS:raise ValueError('Wrong vault scope')
    current={x['token'].lower():x for x in product['basket']['holdings']if x['current_basket_member']is True}
    if not EXPECTED_VAULTS<=set(current):raise ValueError('Lookthrough no longer matches current basket')
    vaults=[];unique_markets={};references=0
    with localcontext()as ctx:
        ctx.prec=80
        for v in raw['native_vaults']:
            markets=[];total=0
            for m in v['markets']:
                p=m['parameters'];state=list(map(int,m['stored_state']));shares=int(m['adapter_supply_shares'])if m.get('adapter_supply_shares')is not None else int(m['singleton_position'][0])
                assets=shares*(state[0]+1)//(state[1]+10**6)
                if assets!=int(m['stored_book_assets_raw']):raise ValueError('Stored-book conversion mismatch')
                key=m['singleton'].lower()+':'+m['market_id'].lower();record={'market_id':m['market_id'],'singleton':m['singleton'],'loan_token':p['loan_token'],'collateral_token':p['collateral_token'],'oracle':p['oracle'],'irm':p['irm'],'lltv_raw':str(p['lltv']),'stored_supply_assets_raw':str(state[0]),'stored_borrow_assets_raw':str(state[2]),'stored_supply_minus_borrow_raw':str(state[0]-state[2]),'last_stored_update':state[4]}
                if key in unique_markets and unique_markets[key]!=record:raise ValueError('Same-pin shared market state mismatch')
                unique_markets[key]=record;references+=1;total+=assets
                markets.append({'market_key':key,'adapter':m['adapter'],'adapter_supply_shares_raw':None if m.get('adapter_supply_shares')is None else str(m['adapter_supply_shares']),'singleton_supply_shares_raw':str(m['singleton_position'][0]),'shares_match':m.get('adapter_shares_equal_singleton_position'),'stored_book_assets_raw':str(assets),'basis':'Integer floor(shares*(storedSupplyAssets+1)/(storedSupplyShares+1e6)); not accrued valuation or executable cash.'})
            idle=None if v.get('idle_assets_raw')is None else int(v['idle_assets_raw']);book=None if idle is None or v.get('stored_book_estimate_raw')is None else total+idle
            if book is not None and book!=int(v['stored_book_estimate_raw']):raise ValueError('Vault stored-book subtotal mismatch')
            target=None if v.get('receipt_total_assets_raw')is None else int(v['receipt_total_assets_raw']);residual=None if target is None or book is None else target-book
            if residual is not None and str(residual)!=v['unassigned_residual_raw']:raise ValueError('Vault residual mismatch')
            exit_key=next((k for k in unique_markets if k.endswith(':'+str(v.get('ordinary_exit_market_id')).lower())),None)
            vaults.append({'address':v['address'],'status':v['status'],'markets':markets,'native_market_references':len(markets),'idle_assets_raw':None if idle is None else str(idle),'receipt_total_assets_raw':None if target is None else str(target),'stored_book_estimate_raw':None if book is None else str(book),'unassigned_residual_raw':None if residual is None else str(residual),'residual_interpretation':None,'liquidity_adapter':v['liquidity_adapter'],'ordinary_exit_market_key':exit_key,'send_shares_gate':v['send_shares_gate'],'receive_assets_gate':v['receive_assets_gate'],'ordinary_exit_capacity_for_eusd':None})
    observations=[]
    for a in raw.get('api_observations',[]):
        detail=a.get('detail')or{};alloc=[]
        for adapter in detail.get('adapters')or[]:
            for row in (adapter.get('positions')or{}).get('items',[]):
                m=row.get('market')or{};value=(row.get('state')or{}).get('supplyAssetsUsd');alloc.append({'market_id':m.get('marketId'),'loan_token':(m.get('loanAsset')or{}).get('address'),'collateral_token':(m.get('collateralAsset')or{}).get('address'),'collateral_symbol':(m.get('collateralAsset')or{}).get('symbol'),'allocation_usd_mark':None if value is None else str(value),'basis':'Later API mark, not the pinned native balance or cash.'})
        observations.append({'address':a['address'],'started_at':a['started_at'],'received_at':a['received_at'],'status':a.get('status',detail.get('status','unknown')),'api_only_market_ids':a.get('api_only_market_ids'),'native_only_market_ids':a.get('native_only_market_ids'),'allocations':alloc})
    return {'schema_version':'eusd-public-lookthrough/1','source_cutover':raw['source_cutover'],'source_clock':raw['source_clock'],'bindings':raw['bindings'],'comet':raw['comet'],'aave':raw['aave'],'native_vaults':vaults,'unique_markets':unique_markets,'native_market_references':references,'unique_market_count':len(unique_markets),'api_observations':observations,'issues':raw['issues'],'limitations':raw['limitations'],'underlying_claims_added_to_backing':False,'borrower_default_or_recovery_census':None,'zero_max_getters_are_capacity':False}
