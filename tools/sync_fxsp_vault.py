#!/usr/bin/env python3
"""Consume the canonical PegTracker fxSP product. No RPC, HTTP or scheduler."""
import argparse, copy, hashlib, json, os, re, tempfile
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from vault_monitor_projection import project
ROOT=Path(__file__).resolve().parents[1]
ADDRESS='0x65c9a641afceb9c0e6034e558a319488fa0fa3be'
YIELD='0x085780639cc2cacd35e474e71f4d000e2405d8f6'
STABLE='0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
AAVE='0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2'
RECEIPT='0x98c23e9d8f34fefb1b7bd6a91b7ff122f4e16f5c'

def instant(value):
    if not isinstance(value,str) or not re.search(r'(Z|[+-]\d\d:\d\d)$',value):raise ValueError('Timezone-aware source clock required')
    return datetime.fromisoformat(value.replace('Z','+00:00'))

def integer(value):
    if not isinstance(value,str) or not re.fullmatch(r'\d+',value):raise ValueError('Unsigned raw decimal string required')
    return int(value)

def eqaddress(value,expected):
    if not isinstance(value,str) or value.lower()!=expected:raise ValueError('Exact source identity changed or unavailable')

def validate_source(s):
    if s.get('schema_version')!='fxsp-native/1':raise ValueError('Wrong native source schema')
    eqaddress(s['subject']['address'],ADDRESS)
    if s['subject']['chain_id']!=1 or s['subject']['decimals']!=18 or s.get('refresh_interval_seconds')!=28800:raise ValueError('Wrong chain/share units/cadence')
    source=s['source'];instant(source['block_time']);instant(source['observed_at'])
    if not isinstance(source['block_number'],int) or not re.fullmatch(r'0x[0-9a-fA-F]{64}',source['block_hash']):raise ValueError('Missing block identity')
    f=s['financials'];st=s['strategy'];m=s['marks'];red=s['redemption']
    eqaddress(f['yield_token'],YIELD);eqaddress(f['stable_token'],STABLE)
    if f['yield_decimals']!=18 or f['stable_decimals']!=6:raise ValueError('Unexpected asset precision')
    if st.get('status')!='verified_supported':raise ValueError('Unsupported/unreviewed strategy')
    eqaddress(st['asset'],STABLE);eqaddress(st['operator'],ADDRESS);eqaddress(st['pool'],AAVE);eqaddress(st['receipt_token'],RECEIPT)
    if st.get('runtime_association',{}).get('status')!='verified':raise ValueError('Strategy runtime association unavailable/changed')
    if st.get('yield_allocation',{}).get('address') not in [None,'0x0000000000000000000000000000000000000000']:raise ValueError('Yield allocation requires review')
    if (st.get('binding_source') or {}).get('block_hash')!=source['block_hash']:raise ValueError('Mixed strategy/source native pins')
    for section in [m,red]:
        if section.get('source',{}).get('block_hash')!=source['block_hash']:raise ValueError('Mixed section observation pins')
    if s.get('reconciliation',{}).get('nav_matches') is not True or s.get('reconciliation',{}).get('preview_matches') is not True:raise ValueError('Producer explicitly withholds reconciliation')
    if s.get('market',{}).get('status')!='not_monitored':raise ValueError('Share-market scope requires separate review')
    raw={k:integer(f[k]) for k in ['share_supply_raw','tracked_yield_raw','tracked_stable_raw','direct_yield_raw','direct_stable_raw','effective_stable_raw','nav_usd_per_share_raw']}
    if raw['share_supply_raw']<=0:raise ValueError('Empty pool supply not supported by vault view')
    claim=integer(st['receipt_claim_raw'])
    if raw['effective_stable_raw']!=raw['direct_stable_raw']+claim:raise ValueError('Stable cash/claim doublecount or mismatch')
    if raw['tracked_yield_raw']!=raw['direct_yield_raw']:raise ValueError('Yield actual/tracked difference requires review')
    yp=integer(m['yield_price_raw']);sp=integer(m['stable_price_raw']);scaled=integer(m['stable_price_with_scale_raw'])
    if integer(m['price_scale_raw'])!=10**18 or scaled!=sp*10**12 or min(yp,sp)<=0:raise ValueError('Oracle precision/missing marks')
    expected=(raw['tracked_yield_raw']*yp+raw['effective_stable_raw']*scaled)//raw['share_supply_raw']
    if expected!=raw['nav_usd_per_share_raw']:raise ValueError('Native NAV mismatch')
    eqaddress(red['input_token'],ADDRESS)
    if red.get('status')!='view_only' or integer(red['preview_input_raw'])!=10**18 or red.get('input_decimals')!=18:raise ValueError('Unreviewed preview units or execution claim')
    if integer(red['preview_yield_raw'])!=10**18*raw['tracked_yield_raw']//raw['share_supply_raw'] or integer(red['preview_stable_raw'])!=10**18*raw['effective_stable_raw']//raw['share_supply_raw']:raise ValueError('Native basket preview mismatch')
    if integer(red['fee_scale_raw'])!=10**18 or integer(red['instant_fee_ratio_raw'])>10**18:raise ValueError('Invalid fee')
    if not isinstance(red['cooldown_seconds'],int) or isinstance(red['cooldown_seconds'],bool) or red['cooldown_seconds']<0:raise ValueError('Invalid cooldown')
    # New assurance fields need a separately reviewed mapping; never improvise free cash.
    for k in ['reserved_shares_raw','net_unencumbered_cash_raw']:
        if f.get(k) is not None:raise ValueError('Unreviewed aggregate assurance field')
    return raw

def normalization(s):
    raw=validate_source(s);f=s['financials'];st=s['strategy'];m=s['marks'];red=s['redemption'];src=s['source']
    num=raw['tracked_yield_raw']*integer(m['yield_price_raw'])+raw['effective_stable_raw']*integer(m['stable_price_with_scale_raw'])
    shared=(st.get('shared_lender_cash') or {}).get('amount_raw')
    if shared is not None:integer(shared)
    binding=st.get('binding_source') or {}
    return {'identity':{'pool':ADDRESS,'strategy_lending_pool':st['pool'].lower(),'strategy_operator':st['operator'].lower(),'stable_strategy':st['address'].lower()},
      'clock':{'pin':{'as_of':src['block_time'],'number':src['block_number']},'clock_note':'PegTracker native block, observation and upstream price clocks are retained separately. A build/due check never renews the financial observation.'},
      'source_binding_status':'matched','source_binding_observed_at':binding.get('block_time'),
      'source_binding_scope':'Configured strategy interface/runtime association only. This does not renew pool authority, audit or upstream controller coverage.',
      'yield_accounting':{'actual_fxusd_at_pool_raw':f['direct_yield_raw']},
      'stable_accounting':{'live_total_stable_for_NAV_raw':f['effective_stable_raw'],'actual_pool_usdc_raw':f['direct_stable_raw'],'strategy_totalSupply_claim_usdc_raw':st['receipt_claim_raw'],'live_minus_stored_tracked_usdc':str(Decimal(raw['effective_stable_raw']-raw['tracked_stable_raw'])/10**6)},
      'valuation':{'fxusd_oracle_price_raw':m['yield_price_raw'],'usdc_oracle_price_raw':m['stable_price_raw'],'reported_marked_assets_usd':str(Decimal(num)/Decimal(10)**36),'native_nav_usd_per_fxsp':str(Decimal(raw['nav_usd_per_share_raw'])/10**18)},
      'pool_supply':{'fxsp':str(Decimal(raw['share_supply_raw'])/10**18)},
      'fixed_preview':{'fxusd_out_raw':red['preview_yield_raw'],'usdc_out_raw':red['preview_stable_raw']},
      'settings':{'instant_fee_ratio_18dp_raw':red['instant_fee_ratio_raw'],'instant_fee_pct':str(Decimal(integer(red['instant_fee_ratio_raw']))/10**16),'cooldown_seconds':red['cooldown_seconds']},
      'liquidity_perimeter':{'aave_shared_underlying_usdc_cash':None if shared is None else str(Decimal(integer(shared))/10**6)}}

def nav_history(records,snapshot,parent=None):
    end=instant(snapshot['source']['block_time']);rows={}
    def add(block,at,value,kind):
        clock=instant(at)
        if clock>end:return
        if block in rows:
            if Decimal(rows[block]['fxsp_nav_usd_per_share'])!=Decimal(value):raise ValueError('Conflicting native history NAV')
            return
        rows[block]={'as_of':at,'block':block,'fxsp_nav_usd_per_share':value,'source_kind':kind}
    for s in records:
        if s.get('schema_version')!='fxsp-native/1':raise ValueError('Unexpected history schema')
        eqaddress(s['subject']['address'],ADDRESS)
        add(s['source']['block_number'],s['source']['block_time'],str(Decimal(integer(s['financials']['nav_usd_per_share_raw']))/10**18),'maintained_fxsp')
    if parent is not None:
        for row in parent if isinstance(parent,list) else parent.get('entries',[]):
            d=row.get('detail',{});i=d.get('identity',{})
            if i.get('underlying','').lower()!=ADDRESS:continue
            raw=d.get('raw',{}).get('spnav')
            if raw is None:continue
            add(d.get('block',row.get('block')),d.get('as_of',row.get('timestamp')),str(Decimal(integer(raw))/10**18),'existing_parent_native_NAV')
    src=snapshot['source'];add(src['block_number'],src['block_time'],str(Decimal(integer(snapshot['financials']['nav_usd_per_share_raw']))/10**18),'current_native')
    ordered=sorted(rows.values(),key=lambda x:instant(x['as_of']))
    parent_included=any(x['source_kind']=='existing_parent_native_NAV' for x in ordered)
    return {'count':len(ordered),'entries':ordered,'parent_nav_included':parent_included}

def public_status(status,snapshot):
    if status.get('schema_version')!='fxsp-refresh-status/1' or status.get('refresh_interval_seconds')!=28800:raise ValueError('Wrong producer status interface')
    good=status.get('last_good') or {};src=snapshot['source']
    if good.get('block_hash')!=src['block_hash']:raise ValueError('Producer snapshot/status mismatch')
    attempt=status.get('last_attempt') or {};state=attempt.get('status')
    if state not in ['success','failed','running']:raise ValueError('Missing latest producer attempt')
    return {'schema_version':'vault-source-status/1','asset':'fxsp','producer':'PegTracker','status':{'success':'ok','failed':'failed','running':'refreshing'}[state],
      'source_observed_at':src['block_time'],'source_block':src['block_number'],'source_block_hash':src['block_hash'],
      'source_retrieved_at':src['observed_at'],'latest_attempt_at':attempt.get('attempted_at'),'latest_attempt_completed_at':attempt.get('completed_at'),
      'refresh_interval_seconds':28800,'next_due_at':status.get('next_due_at'),'error_type':attempt.get('error_type') if state=='failed' else None}

def projection(snapshot,history,status,control,parent=None,previous=None):
    r=normalization(snapshot);hist=nav_history(history,snapshot,parent);view=project(r,hist,control)
    view['preview']=False
    view['observation'].update({'mode':'scheduled','refresh_interval_seconds':28800,'max_age_hours':10,'producer':'PegTracker','source_retrieved_at':snapshot['source']['observed_at'],'refresh_note':'Financial observations refresh every eight hours through the canonical producer.'})
    view['source_status']=public_status(status,snapshot)
    view['timestamp']=snapshot['source']['block_time'];view['asset_slug']='fxsp'
    view['changes'].update({'history_gap_seconds':10800 if hist['parent_nav_included'] else 86400,'history_note':('Native share NAV through this financial snapshot. Older hourly NAV is reused from the canonical parent producer; financial sampling is every eight hours. ' if hist['parent_nav_included'] else 'Available native eight-hour observations through this financial snapshot. ')+'NAV change is not total return.'})
    view['sources']['price_note']='Oracle read time is not the underlying feed update time. Share secondary-market coverage is not monitored; underlying cash access and redemption remain separate.'
    view['controls']['source_note']=r['source_binding_scope']
    view['notice']='Public protocol monitoring · eight-hour financial refresh. No new vault risk score is assigned.'
    if previous and previous.get('observation',{}).get('at')!=view['observation']['at']:
        try:
            delta=(Decimal(view['metrics']['share_nav_usd'])/Decimal(previous['metrics']['share_nav_usd'])-1)*100
            view['changes'].update({'mode':'tracked','nav_change_pct':str(delta),'previous_observed_at':previous['observation']['at']})
        except (KeyError,ArithmeticError):pass
    elif previous and previous.get('changes',{}).get('mode')=='tracked':
        view['changes'].update({k:previous['changes'][k] for k in ['mode','nav_change_pct','previous_observed_at'] if k in previous['changes']})
    reject_private(view)
    return view

def reject_private(value):
    text=json.dumps(value,allow_nan=False)
    if any(x in text for x in ['/home/','.private-reviews','private_key','rpc_url']):raise ValueError('Private metadata in public projection')

def atomic(path,value):
    content=json.dumps(value,indent=2,allow_nan=False)+'\n';path.parent.mkdir(parents=True,exist_ok=True)
    if path.exists() and path.read_text()==content:return False
    fd,name=tempfile.mkstemp(prefix=path.name+'.',dir=path.parent)
    try:
        with os.fdopen(fd,'w') as f:f.write(content)
        os.replace(name,path)
    finally:
        if os.path.exists(name):os.unlink(name)
    return True

def source_path(value,producer_root):
    if value.startswith('pegtracker:'):return producer_root/'PegTracker'/value.split(':',1)[1]
    if ':' in value:raise ValueError('Unsupported producer namespace')
    return Path(value)

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--policy',type=Path,default=ROOT/'config/fxsp_vault_sources.json');ap.add_argument('--source-root',type=Path);ap.add_argument('--producer-root',type=Path,default=ROOT.parent);ap.add_argument('--output-root',type=Path,default=ROOT/'data');ap.add_argument('--from-sync',action='store_true');args=ap.parse_args()
    out=args.output_root;lastgood=out/'fxsp_backing.json';statusfile=out/'fxsp_source_status.json'
    try:previous=json.loads(lastgood.read_text()) if lastgood.exists() else None
    except (OSError,ValueError):previous=None
    try:
        policy=json.loads(args.policy.read_text())
        if policy.get('address')!=ADDRESS or policy.get('publication_approved') is not True or policy.get('refresh_interval_seconds')!=28800:raise ValueError('Unapproved source policy')
        source=args.source_root or source_path(policy['source_root'],args.producer_root)
        snapshot=json.loads((source/'fxsp_backing.json').read_text());history=json.loads((source/'fxsp_backing_history.json').read_text());status=json.loads((source/'fxsp_backing_last_attempt.json').read_text())
        controls=json.loads((ROOT/'config/fxsave_preview_sources.json').read_text())['control_review']
        parent_path=source_path(policy.get('parent_nav_history','pegtracker:data/fxsave/fxsave_backing_history.json'),args.producer_root)
        parent=json.loads(parent_path.read_text()) if parent_path.exists() else None
        view=projection(snapshot,history,status,controls,parent,previous)
        atomic(lastgood,view);atomic(statusfile,view['source_status'])
        print('fxSP consumer synchronized; source observation '+view['observation']['at']+'; no collection.');return 0
    except Exception as exc:
        # Preserve financial bytes and original observation on every intake failure.
        failure={'schema_version':'vault-source-status/1','asset':'fxsp','producer':'PegTracker','status':'failed' if previous else 'unavailable','source_observed_at':previous.get('observation',{}).get('at') if previous else None,'attempted_at':datetime.now(timezone.utc).isoformat(),'error_type':type(exc).__name__,'refresh_interval_seconds':28800}
        atomic(statusfile,failure);print('fxSP intake failed; prior financial snapshot retained; '+type(exc).__name__);return 1
if __name__=='__main__':raise SystemExit(main())
