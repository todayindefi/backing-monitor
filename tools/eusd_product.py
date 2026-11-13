#!/usr/bin/env python3
"""BM-owned Reserve eUSD accounting projection. No quotes, grades or publication."""
import argparse
import hashlib
import json
from decimal import Decimal, localcontext
from pathlib import Path

TOKEN = '0xa0d69e286b938e21cbf7e51d71f6a4c8918f482f'
FIX = Decimal(10**18)

def canonical(value):
    return (json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False)+'\n').encode()

def text(value):
    return None if value is None else format(value, 'f')

def normalize(raw):
    identity = raw['identity']
    if raw['schema_version'] != 'reserve-eusd-raw/1' or identity['chain_id'] != 1 or identity['token'].lower() != TOKEN:
        raise ValueError('Exact Ethereum Reserve eUSD identity required')
    clock = raw['source_clock']
    if not clock.get('block_number') or not clock.get('block_hash') or not clock.get('block_timestamp'):
        raise ValueError('Missing pinned observation')
    reads = raw['reads']
    def get(key):
        r = reads.get(key, {})
        return r.get('value') if r.get('status') == 'ok' else None
    def number(key):
        v = get(key)
        return None if v is None or isinstance(v, bool) else Decimal(v)
    if str(get('main.rToken')).lower() != TOKEN or get('rtoken.decimals') != '18':
        raise ValueError('RToken binding/units mismatch')
    if raw.get('status') not in ['ok', 'partial']:
        raise ValueError('Unsuccessful raw snapshot')
    with localcontext() as ctx:
        ctx.prec = 90
        supply, needed = number('rtoken.totalSupply'), number('rtoken.basketsNeeded')
        if supply is None or needed is None or supply <= 0 or needed <= 0:
            raise ValueError('Missing positive supply/basket liability')
        prime = get('basket.prime')
        targets = {a.lower(): text(Decimal(w)/FIX*100) for a,w in zip(prime[0], prime[2])} if prime else {}
        holdings = []
        low_total, high_total = Decimal(0), Decimal(0)
        mark_missing = []
        for asset in raw['assets']:
            p = asset['read_prefix']; address = asset['token']; q = number(p+'.quantity_per_basket_fixed18')
            dec, bal = number(p+'.decimals'), number(p+'.held_raw')
            price = get(p+'.plugin_price')
            quantity = bal / (Decimal(10)**int(dec)) if bal is not None and dec is not None else None
            required = q*needed/FIX/FIX if q is not None else None
            own = address.lower() in [TOKEN, str(identity['components']['rsr']).lower()]
            value_low = quantity*Decimal(price[0])/FIX if quantity is not None and price else None
            value_high = quantity*Decimal(price[1])/FIX if quantity is not None and price else None
            if not own and bal is not None and bal > 0:
                if value_low is None or value_high is None: mark_missing.append(address)
                else: low_total += value_low; high_total += value_high
            holdings.append({'token':address,'symbol':get(p+'.symbol'),'decimals':None if dec is None else int(dec),
                'plugin':asset['plugin'],'held_raw':get(p+'.held_raw'),'held_units':text(quantity),
                'current_quantity_per_basket':text(q/FIX) if q is not None else None,
                'required_units_for_baskets_needed':text(required),
                'held_minus_required_units':text(quantity-required) if quantity is not None and required is not None else None,
                'prime_target_weight_pct':targets.get(address.lower()),'current_basket_member':None if q is None else q>0,
                'plugin_status':get(p+'.plugin_status'),'plugin_price_low':text(Decimal(price[0])/FIX) if price else None,
                'plugin_price_high':text(Decimal(price[1])/FIX) if price else None,
                'plugin_last_save':get(p+'.plugin_lastSave'),'held_plugin_value_low_usd':text(value_low),
                'held_plugin_value_high_usd':text(value_high),'excluded_from_external_asset_sum':own,
                'underlying_lookthrough':None,'trade':get(p+'.trade')})
        current=[x for x in holdings if x['current_basket_member']is True]
        mids=[(Decimal(x['held_plugin_value_low_usd'])+Decimal(x['held_plugin_value_high_usd']))/2 for x in current if x['held_plugin_value_low_usd']is not None and x['held_plugin_value_high_usd']is not None]
        total_mid=sum(mids,Decimal(0)) if len(mids)==len(current)and current else None
        for row in holdings:
            row['actual_receipt_plugin_mark_weight_pct']=None
            if row['current_basket_member']is True and total_mid and row['held_plugin_value_low_usd']is not None and row['held_plugin_value_high_usd']is not None:
                row['actual_receipt_plugin_mark_weight_pct']=text((Decimal(row['held_plugin_value_low_usd'])+Decimal(row['held_plugin_value_high_usd']))/2/total_mid*100)
            prefix='asset.'+row['token'].lower();underlying=get(prefix+'.receipt_asset');comet=get(prefix+'.receipt_comet')
            if not underlying and comet:underlying=get(prefix+'.receipt_comet_baseToken')
            if underlying:
                udec=number(prefix+'.receipt_underlying_decimals');claim=number(prefix+'.receipt_convert_held_to_assets')
                if claim is None:claim=number(prefix+'.receipt_comet_claim')
                maximum=number(prefix+'.receipt_maxWithdraw')
                row['underlying_lookthrough']={'scope':'One observed receipt-to-underlying layer only; not a borrower/default census.',
                    'kind':next((x.get('receipt_kind')for x in raw['assets']if x['token'].lower()==row['token'].lower()),None),
                    'token':underlying,'symbol':get(prefix+'.receipt_underlying_symbol'),'decimals':None if udec is None else int(udec),
                    'claim_raw':None if claim is None else str(int(claim)),
                    'claim_units':text(claim/(Decimal(10)**int(udec)))if claim is not None and udec is not None else None,
                    'max_redeem_receipt_raw':get(prefix+'.receipt_maxRedeem'),
                    'max_withdraw_underlying_raw':get(prefix+'.receipt_maxWithdraw'),
                    'max_withdraw_underlying_units':text(maximum/(Decimal(10)**int(udec)))if maximum is not None and udec is not None else None,
                    'limits_caller':identity['components'].get('backingManager'),
                    'max_withdraw_getter_zero':None if maximum is None else maximum==0,
                    'underlying_market':comet,'shared_market_base_cash_raw':get(prefix+'.receipt_comet_base_cash'),
                    'underlying_vault_total_assets_raw':get(prefix+'.receipt_totalAssets'),
                    'source_clock':clock,
                    'basis':'Accounting conversion and reported caller limits are distinct. Shared market cash is not reserved for eUSD. Underlying claim is already represented by the receipt and is not added to backing again.',
                    'zero_getter_semantics':'Unknown for this deployment; upstream Morpho VaultV2 returns zero by design, so this getter alone is not a withdrawal-capacity measurement.' if maximum==0 else None,'executable_withdrawal_capacity':None,'executed_withdrawal_or_cash_sale':False}
        active=number('stRSR.getStakeRSR')
        if active is None:active=number('stRSR.stakeRSR')
        draft=number('stRSR.getDraftRSR')
        if draft is None:draft=number('stRSR.draftRSR')
        rsr_balance=number('rsr.balance_staking_contract');rsr_dec=number('rsr.decimals')
        rsr_remainder=rsr_balance-active-draft if all(v is not None for v in [rsr_balance,active,draft])else None
        held_baskets = get('basket.basketsHeldBy_backingManager')
        available = number('rtoken.redemptionAvailable')
        result = {'schema_version':'reserve-eusd-product/1','asset_slug':'eusd','identity':identity,'source_clock':clock,
            'accounting':{'scope':'Registered token balances at the eUSD backing manager; no unregistered-token or trade-asset census.',
                'supply_eusd':text(supply/FIX),'baskets_needed':text(needed/FIX),
                'basket_units_held_low':text(Decimal(held_baskets[0])/FIX) if held_baskets else None,
                'basket_units_held_high':text(Decimal(held_baskets[1])/FIX) if held_baskets else None,
                'basket_unit_coverage_low_pct':text(Decimal(held_baskets[0])/needed*100) if held_baskets else None,
                'basket_unit_residual_low':text((Decimal(held_baskets[0])-needed)/FIX) if held_baskets else None,
                'external_registered_plugin_mark_low_usd':text(low_total) if not mark_missing else None,
                'external_registered_plugin_mark_high_usd':text(high_total) if not mark_missing else None,
                'unpriced_held_tokens':mark_missing,'independent_recoverable_backing_usd':None,
                'basis':'Basket-unit coverage and plugin USD marks are different views, not independent backing or cash realization proofs.'},
            'basket':{'status':get('basket.status'),'fully_collateralized':get('basket.fullyCollateralized'),
                'ready':get('basket.isReady'),'nonce':get('basket.nonce'),'changed_at':get('basket.timestamp'),
                'registry_last_refresh':get('registry.lastRefresh'),'holdings':holdings,
                'basis':'Prime target weights, current basket quantities and actual held balances are separate observations.'},
            'redemption':{'frozen':get('main.frozen'),'trading_paused':get('main.tradingPaused'),
                'issuance_paused':get('main.issuancePaused'),'available_eusd':text(available/FIX) if available is not None else None,
                'available_supply_pct':text(available/supply*100) if available is not None else None,
                'throttle_params_raw':get('rtoken.redemptionThrottleParams'),'trades_open':get('backingManager.tradesOpen'),
                'final_cash_proceeds':None,'execution':'not_tested',
                'basis':'Availability is a protocol stock at this block; basket-token redemption is not final USDC/USDT delivery.'},
            'rsr':{'staking_contract_balance_raw':get('rsr.balance_staking_contract'),
                'staking_contract_balance_units':text(number('rsr.balance_staking_contract')/FIX) if number('rsr.balance_staking_contract') is not None else None,
                'active_staked_rsr_raw':None if active is None else str(int(active)),'draft_rsr_raw':None if draft is None else str(int(draft)),
                'active_staked_rsr_units':text(active/(Decimal(10)**int(rsr_dec)))if active is not None and rsr_dec is not None else None,
                'draft_rsr_units':text(draft/(Decimal(10)**int(rsr_dec)))if draft is not None and rsr_dec is not None else None,
                'contract_balance_minus_active_minus_draft_raw':None if rsr_remainder is None else str(int(rsr_remainder)),
                'contract_balance_minus_active_minus_draft_units':text(rsr_remainder/(Decimal(10)**int(rsr_dec)))if rsr_remainder is not None and rsr_dec is not None else None,
                'remainder_interpretation':None,
                'staking_shares_raw':get('stRSR.totalSupply'),'exchange_rate_raw':get('stRSR.exchangeRate'),
                'unstaking_delay_seconds':get('stRSR.unstakingDelay'),'realizable_first_loss_usd':None,
                'basis':'Named active/draft getters, when observed, are separate from staking-contract balance and its residual. Neither quantity nor share exchange rate establishes realizable loss-protection proceeds.'},
            'stability':{'market_price':None,'reference_usd':'1','reference_basis':'Nominal dollar target, not guaranteed cash redemption.','history':None},
            'liquidity_exit':{'depth_10bps':None,'depth_25bps':None,'depth_50bps':None,'quotes':None,
                'status':'unmeasured_live_quote_authorization_pending'},
            'coverage':{'unavailable_reads':[k for k,v in reads.items() if v.get('status')!='ok'],
                'receipt_underlying_lookthrough':None,'assets_out_on_trades':None,'security':'owner_return_pending',
                'authored_assessment':'current_review_pending','documentary':'separate_selected_component_original_clocks'}}
    return result

def main():
    p=argparse.ArgumentParser();p.add_argument('--raw',required=True,type=Path);p.add_argument('--output',required=True,type=Path);a=p.parse_args()
    value=normalize(json.loads(a.raw.read_text()));body=canonical(value);a.output.parent.mkdir(parents=True,exist_ok=True)
    a.output.write_bytes(body);print(hashlib.sha256(body).hexdigest())
if __name__=='__main__':main()
