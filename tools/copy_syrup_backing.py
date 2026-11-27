#!/usr/bin/env python3
"""Validate qualified normal Syrup reports before replacing consumer last-good.

Called by the existing sync. No collection, score authoring or schedule changes.
"""
import argparse
from decimal import Decimal
import json
import os
from pathlib import Path
import re
import sys

POOLS={'syrupusdc':'0x80ac24aa929eaf5013f6436cda2a7ba190f5cc0b',
       'syrupusdt':'0x356b8d89c1e1239cbbb9de4815c39a1474d5ba7d'}

def validate(report):
    slug=report.get('asset_slug')
    if slug not in POOLS:raise ValueError('unsupported Syrup identity')
    asp=report.get('asset_specific')or{};v=asp.get('vault_state')or{}
    if str(v.get('pool','')).lower()!=POOLS[slug]:raise ValueError('pool identity mismatch')
    ctx=v.get('accounting_context')or{}
    if ctx.get('schema_version')!='syrup-pool-accounting/1' or ctx.get('pinning')!='all_accounting_calls_pinned':raise ValueError('qualified pinned accounting context missing')
    if type(ctx.get('block')) is not int or ctx['block']<=0 or type(ctx.get('timestamp')) is not int or ctx['timestamp']<=0:raise ValueError('accounting clock missing')
    if not re.fullmatch(r'(?:0x)?[0-9a-fA-F]{64}',str(ctx.get('hash',''))):raise ValueError('accounting block hash missing')
    raw=v.get('accounting_raw')or{}
    if raw.get('units')!='native underlying6decimal base units':raise ValueError('accounting units missing')
    values={}
    for key in ['pool_cash','pool_assets','own_strategy_claims','pool_losses','components_minus_NAV']:
        value=raw.get(key)
        if not isinstance(value,str)or not re.fullmatch(r'-?\d+',value):raise ValueError('raw accounting field missing: '+key)
        values[key]=int(value)
    if any(values[k]<0 for k in ['pool_cash','pool_assets','own_strategy_claims','pool_losses']):raise ValueError('negative unsigned accounting field')
    if values['pool_cash']+values['own_strategy_claims']-values['pool_assets']!=values['components_minus_NAV']:raise ValueError('declared residual does not match raw accounting')
    # Nonzero losses/residuals are reportable observations, not reasons to
    # silently freeze the feed. Require unit consistency, never a healthy value.
    for key,rawkey in [('free_usdc','pool_cash'),('total_assets','pool_assets'),('strategy_aum','own_strategy_claims'),('unrealized_losses','pool_losses')]:
        try:delta=abs(Decimal(str(v[key]))-Decimal(values[rawkey])/10**6)
        except (KeyError,ValueError,ArithmeticError):raise ValueError('published accounting value missing: '+key)
        if not delta.is_finite()or delta>Decimal('.01'):raise ValueError('raw/display accounting unit mismatch: '+key)
    for axis in ['peg','backing','liquidity','dependencies','issuer']:
        if not isinstance(report.get(axis),dict)or not report[axis]:raise ValueError('full family block missing: '+axis)
    if values['pool_assets']>0:
        try:
            cash_pct=Decimal(str(report['liquidity']['free_liquidity_pct']))
            expected_pct=Decimal(values['pool_cash'])/Decimal(values['pool_assets'])*100
        except (KeyError,ValueError,ArithmeticError):raise ValueError('cash-only liquidity metric missing')
        if not cash_pct.is_finite() or abs(cash_pct-expected_pct)>Decimal('.011'):raise ValueError('liquidity metric counts noncash accrual or uses wrong units')
    for section in ['peg','liquidity']:
        if not isinstance(asp.get(section),dict)or not asp[section]:raise ValueError('nested measured source missing: '+section)
    if report['peg'].get('history_ref')!=slug+'_backing_history.json' or report['peg'].get('history_field')!='peg_market_price':raise ValueError('peg series contract missing')
    if not (asp.get('axis_thresholds')or{}).get('backing'):raise ValueError('axis thresholds missing')
    if 'independent_credit_nav' not in v or v['independent_credit_nav'] is not None:raise ValueError('independent credit NAV unknown-state declaration changed')
    return slug

def public_body(report, previous):
    """Retire the wrong source model and publish only the reviewed projection."""
    validate(report)
    specific = report['asset_specific']
    source = specific.get('issuer_transparency')
    adoption = specific.get('transparency_adoption')
    if not isinstance(source, dict) or not isinstance(adoption, dict):
        raise ValueError('corrected transparency source missing; legacy model cannot replace last-good')
    for loan in (specific.get('loan_book') or {}).get('loans', []):
        c = loan.get('collateral') or {}
        credit = (loan.get('economic_classification') or {}).get('category') == 'credit' or c.get('category') == 'crypto'
        if not credit:
            continue
        if c.get('usd_source') not in {'issuer_transparency_ssr', 'unknown_invalid_legacy_model'}:
            raise ValueError('retired credit valuation model cannot be published')
        if c.get('usd_source') == 'unknown_invalid_legacy_model' and any(c.get(k) is not None for k in ['usd', 'current_level_pct', 'buffer_pp']):
            raise ValueError('missing source carries a stale valuation')
    try:
        from tools.project_maple_transparency import project
    except ModuleNotFoundError:
        from project_maple_transparency import project
    projected = project(report, previous, report_base='https://tidresearch.com/reports')
    specific = projected['asset_specific']
    specific.pop('vaulttracker_native_accounting', None)
    if report['asset_slug'] in POOLS:
        try:
            try:
                from tools.select_syrupusdc_native import selected_accounting
            except ModuleNotFoundError:
                from select_syrupusdc_native import selected_accounting
            native = selected_accounting(report)
            if native is not None:
                specific['vaulttracker_native_accounting'] = native
                print(report['asset_slug'] + ' native accounting selected from VaultTracker', file=sys.stderr)
        except (ImportError, OSError, ValueError, TypeError, KeyError, ArithmeticError) as error:
            print(report['asset_slug'] + ' VaultTracker selection rejected; using qualified legacy projection: '
                  + type(error).__name__, file=sys.stderr)
    body = (json.dumps(projected, indent=2, ensure_ascii=False, allow_nan=False) + '\n').encode()
    for forbidden in [b'/home/', b'.private-reviews', b'"raw_source"', b'"private_wallet"', b'"account_address"', b'"private_holdings"']:
        if forbidden in body:
            raise ValueError('private path or raw dossier in public projection')
    return body

def public_family_body(report):
    """Keep current family credit membership separate from retired pool totals."""
    pools = report.get('pools') or []
    if {p.get('slug') for p in pools} != set(POOLS) or len(pools) != len(POOLS):
        raise ValueError('family pool identity set mismatch')
    for pool in pools:
        if str(pool.get('pool_address', '')).lower() != POOLS[pool['slug']]:
            raise ValueError('family exact pool identity mismatch')
        if 'pool_collateral_value_usd' not in pool or pool['pool_collateral_value_usd'] is not None:
            raise ValueError('retired family aggregate cannot replace corrected last-good')
    combined = report.get('combined') or {}
    versions = combined.get('classification_versions') or {}
    if set(versions) != set(POOLS) or any(v != 'issuer_transparency_ssr_v1+legacy_unmatched' for v in versions.values()):
        raise ValueError('corrected family classification contract missing')
    if 'independent_credit_nav' not in combined or combined['independent_credit_nav'] is not None:
        raise ValueError('independent family NAV unknown declaration changed')
    if combined.get('loans_only_coverage_complete') is not True and any(combined.get(k) is not None for k in ['loans_only_collateral_usd', 'collateral_ratio_loans_only_pct']):
        raise ValueError('incomplete credit coverage carries a complete aggregate')
    try:
        from tools.project_maple_transparency import clean
    except ModuleNotFoundError:
        from project_maple_transparency import clean
    body = (json.dumps(clean(report), indent=2, ensure_ascii=False, allow_nan=False) + '\n').encode()
    for forbidden in [b'/home/', b'.private-reviews', b'"raw_source"', b'"private_wallet"', b'"account_address"', b'"private_holdings"']:
        if forbidden in body:
            raise ValueError('private family evidence in public projection')
    return body

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--family',action='store_true');p.add_argument('source',type=Path);p.add_argument('destination',type=Path);a=p.parse_args()
    try:
        report=json.loads(a.source.read_bytes())
        if a.family:
            if a.destination.name!='syrup_family.json':raise ValueError('family destination identity mismatch')
            body=public_family_body(report)
        else:
            slug=validate(report)
            if a.destination.name!=slug+'_backing.json':raise ValueError('consumer destination identity mismatch')
            previous=json.loads(a.destination.read_text()) if a.destination.exists() else {'asset_specific': {}}
            body=public_body(report, previous)
        temp=a.destination.with_name(a.destination.name+'.'+str(os.getpid())+'.qualified.tmp');temp.write_bytes(body);temp.replace(a.destination)
    except (OSError,ValueError,TypeError,KeyError)as e:
        print('Syrup transport rejected; prior consumer snapshot retained: '+str(e),file=sys.stderr);return 1
    return 0

if __name__=='__main__':raise SystemExit(main())
