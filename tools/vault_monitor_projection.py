"""Pure public-safe consumer projection. No RPC/HTTP, scheduler or producer file access."""
import json
from decimal import Decimal, getcontext
getcontext().prec=70

def project(r, h, control=None):
    """Pure consumer projection; no collection and no producer file access."""
    identity = r['identity']
    if identity['pool'] != '0x65c9a641afceb9c0e6034e558a319488fa0fa3be':
        raise ValueError('Wrong exact pool identity')
    if identity['strategy_lending_pool'] != '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2' or identity['strategy_operator'] != identity['pool']:
        raise ValueError('Strategy identity changed; update the reviewed adapter before labelling it Aave V3')
    d = Decimal
    y = int(r['yield_accounting']['actual_fxusd_at_pool_raw'])
    stable = int(r['stable_accounting']['live_total_stable_for_NAV_raw'])
    yprice = int(r['valuation']['fxusd_oracle_price_raw'])
    sprice = int(r['valuation']['usdc_oracle_price_raw'])
    yvalue = d(y) * yprice / d(10)**36
    svalue = d(stable) * sprice / d(10)**24
    total = yvalue + svalue
    if total != d(r['valuation']['reported_marked_assets_usd']):
        raise ValueError('Marked assets do not reconcile')
    actual_stable = d(r['stable_accounting']['actual_pool_usdc_raw']) / 10**6
    claim = d(r['stable_accounting']['strategy_totalSupply_claim_usdc_raw']) / 10**6
    at = r['clock']['pin']['as_of']
    source_rows = h['entries']
    # Plot every source observation: thinning may hide material extrema.
    history = [{'at': x['as_of'], 'value': x['fxsp_nav_usd_per_share']} for x in source_rows]
    if not history or history[-1]['at'] != at:
        history.append({'at': at, 'value': r['valuation']['native_nav_usd_per_fxsp'], 'kind': 'latest_native_observation'})
    elif Decimal(history[-1]['value']) != Decimal(r['valuation']['native_nav_usd_per_fxsp']):
        raise ValueError('Conflicting history and native NAV at the same source clock')
    preview = r['fixed_preview']
    fee = int(r['settings']['instant_fee_ratio_18dp_raw'])
    outputs = []
    for symbol, key, decimals in [('fxUSD','fxusd_out_raw',18),('USDC','usdc_out_raw',6)]:
        raw = int(preview[key])
        outputs.append({'symbol':symbol,'queued':str(d(raw)/d(10)**decimals), 'instant':str(d(raw-raw*fee//10**18)/d(10)**decimals)})
    payload = {
        'schema_version':'vault-monitor/1','preview':True,
        'asset':{'symbol':'fxSP','name':'f(x) Stability Pool','chain':'Ethereum','address':identity['pool'],
                 'description':'A variable fxUSD / USDC basket. The USDC leg is invested through Aave V3.'},
        'valuation':{'mode':'nav_only','basis':'Native basket NAV','payout':'Variable fxUSD / USDC basket',
          'share_market_coverage':'not_monitored','note':'Share value follows the marked pool basket. Redemption terms and underlying cash access determine the exit.'},
        'observation':{'at':at,'block':r['clock']['pin']['number'],'mode':'one_off','refresh_note':'One-off evidence snapshot. Automatic monitoring is not configured.', 'max_age_hours':6},
        'metrics':{'share_nav_usd':r['valuation']['native_nav_usd_per_fxsp'], 'marked_assets_usd':str(total),
                   'share_supply':r['pool_supply']['fxsp'], 'observed_return_pct':None, 'return_note':'Total return has not been measured.',
                   'cooldown_seconds':r['settings']['cooldown_seconds'],'instant_fee_pct':r['settings']['instant_fee_pct']},
        'backing':{'accounting_status':'Reconciled at snapshot','recovery_status':'Independent recovery unverified',
          'positions':[
            {'symbol':'fxUSD','location':'Held directly by fxSP','kind':'token','quantity':str(d(y)/10**18),'marked_usd':str(yvalue),'share_pct':str(yvalue/total*100 if total else 0),'tone':'blue'},
            {'symbol':'USDC','location':'Aave V3 · aUSDC claim','kind':'lending_claim','quantity':str(claim),'marked_usd':str(svalue),'share_pct':str(svalue/total*100 if total else 0),'tone':'teal'},
            {'symbol':'USDC','location':'Held directly by fxSP','kind':'cash','quantity':str(actual_stable),'marked_usd':str(actual_stable*d(sprice)/10**18),'share_pct':'0','tone':'muted'}],
          'mix_basis':'Share of oracle-marked value',
          'note':'Allocation percentages are shares of oracle-marked value, not token units or available cash. A lending receipt is a claim, not cash held by the vault.',
          'details':['Pool share supply, token balances and the native NAV formula reconcile exactly at this block.',
            f"Current Aave claim minus stored USDC accounting: {r['stable_accounting']['live_minus_stored_tracked_usdc']} USDC. NAV uses the current claim; this is not a measured payment or realized return.",
            'Aggregate reservations and unencumbered cash are unknown. Reserved shares remain included in supply until burned; do not subtract them again as extra debt.']},
        'liquidity':{'mode':'redemption','status':'Full cash route not verified','input_fxsp':'1','outputs':outputs,
          'queued_note':'Request first; the measured cooldown is shown above. Unlocking does not guarantee funded delivery.',
          'instant_note':'Uses unreserved shares and deducts the measured instant fee from each basket leg. Gas and the final swap are extra.',
          'strategy_claim_usdc':str(claim),'direct_usdc':str(actual_stable),'shared_lender_usdc':r['liquidity_perimeter']['aave_shared_underlying_usdc_cash'],
          'sized_cash_depth_usd':None,'unencumbered_cash_usd':None,
          'remaining':['Caller eligibility, aggregate reservations and receiver delivery remain unverified.',
                       'The strategy must release USDC from Aave when vault cash is insufficient.',
                       'The basket includes fxUSD. Selling it to final USDC is a separate route; no complete sized cash exit was tested.']},
        'changes':{'mode':'baseline','title':'Baseline captured; continuous alerts are not running.',
          'note':'Future comparable snapshots can show allocation moves, withdrawal constraints and reward changes here.',
          'history':history,'history_count':len(history),'history_displayed_count':len(history),'history_gap_seconds':10800,
          'history_gap_basis':'Normal history is approximately hourly. Break lines after gaps greater than three hours or an invalid observation.',
          'history_note':'Native share NAV observations across the dates shown. Latest point is the one-off supplement. NAV change is not a total-return series.',
          'watchlist':['Basket allocation and lending exposure','Withdrawal access and queue funding','NAV divergence and source freshness']},
        'strategy':{'title':'Stability pool + lending','description':'Exposure combines f(x) protocol risk and aUSDC lending risk.',
          'facts':[{'label':'fxUSD leg','value':'f(x) collateral and rebalancing','detail':'Linked to leveraged collateral pools and fxUSD peg mechanics.'},
                   {'label':'USDC leg','value':'Aave V3 credit exposure','detail':'aUSDC is the strategy claim. Shared reserve cash is not dedicated exit capacity.'},
                   {'label':'What matters','value':'Basket mix, marks and release','detail':'Watch collateral repricing and the ability to withdraw lending claims.'}]},
        'dependencies':{'summary':'Two economic legs, with different risks.',
          'items':[{'name':'fxUSD','detail':'f(x) collateral, oracle and rebalance mechanics.'},
                   {'name':'USDC → Aave V3','detail':'Stablecoin issuer exposure plus lending and withdrawal risk.'}],
          'note':'Lending claims and vault custody add no independent reserve.'},
        'controls':{'headline':'72h checked upgrade path','at':'2026-11-17T05:23:11Z','block':26432647,
          'note':'Dated selected-path review. Parallel admin and emergency powers remain; there is no universal 72-hour exit window.',
          'source_match_at':r.get('source_binding_observed_at', at if r.get('source_binding') else None),'source_status':r.get('source_binding_status', 'matched' if r.get('source_binding') else 'unavailable'),'source_note':'Pool and strategy source/runtime association checked at the snapshot. This is not an audit or full authority review.'},
        'issuer':{'headline':'f(x) Protocol','operator_label':'Protocol context',
          'note':'Exact legal obligor and holder recourse are not established by this accounting snapshot.',
          'dependency_note':'The fxUSD and USDC legs have separate underlying claim and issuer dependencies.'},
        'sources':{'at':at,'block':r['clock']['pin']['number'],'clock_note':r['clock'].get('clock_note','Original native block, source observation and retrieval clocks are retained separately.'),
          'price_note':'Oracle read time is not the underlying feed update time. No independent executable fxSP market price is attached.',
          'links':[{'label':'Pool contract','url':'https://etherscan.io/address/'+identity['pool']+'#code'},
                   {'label':'Strategy contract','url':'https://etherscan.io/address/'+identity['stable_strategy']+'#code'}]},
        'notice':'Layout preview · not a production dashboard. No risk score is assigned here.'}
    control = control or {'as_of':None,'block':None,'short_headline':'Control review unavailable'}
    payload['controls']['at'] = control['as_of']
    payload['controls']['block'] = control['block']
    payload['controls']['headline'] = '72h upgrade route; immediate powers remain' if control.get('as_of') else 'Control review unavailable'
    # No internal paths, owner context, raw provider records or research packets in the public projection.
    text = json.dumps(payload, ensure_ascii=False)
    if any(term in text for term in ['/home/','.private-reviews','private_key','holder_address']):
        raise ValueError('Private metadata cannot enter public preview')
    return payload

