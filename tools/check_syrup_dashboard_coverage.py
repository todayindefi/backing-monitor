#!/usr/bin/env python3
"""Check measured Syrup dashboard coverage, independently of authored grades.

Read-only pre-deployment gate. No collectors, output mutation or network access.
"""
import argparse
import json
import math
from pathlib import Path

IDENTITIES = {'syrupusdc':'0x80ac24aa929eaf5013f6436cda2a7ba190f5cc0b',
              'syrupusdt':'0x356b8d89c1e1239cbbb9de4815c39a1474d5ba7d'}

def number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)

def check(report, history, retained):
    failures=[]
    def require(ok, message):
        if not ok: failures.append(message)
    slug=report.get('asset_slug')
    specific=report.get('asset_specific') or {}
    vault=specific.get('vault_state') or {}
    require(slug in IDENTITIES and str(vault.get('pool','')).lower()==IDENTITIES.get(slug), 'exact pool identity')
    for axis in ['peg','backing','liquidity','dependencies','issuer']:
        require(isinstance(report.get(axis),dict) and bool(report[axis]), axis+' measured block missing')
    peg=report.get('peg') or {}
    for key in ['market_price','nav','premium_discount_pct']:
        require(number(peg.get(key)), 'peg.'+key+' missing/non-numeric')
    source_peg=retained.get('peg') or {}
    for key in ['market_price','nav','premium_discount_pct','source','history_ref','history_field']:
        require(peg.get(key)==source_peg.get(key), 'retained peg field changed: '+key)
    require(peg.get('history_ref')==slug+'_backing_history.json','declared history reference')
    field=peg.get('history_field')
    pairs=[e for e in history.get('entries',[]) if number(e.get(field)) and number(e.get('peg_theoretical_price')) and e.get('timestamp')]
    require(len(pairs)>=2, 'paired market/NAV historical observations missing')
    require((specific.get('axis_thresholds')or{}).get('backing') is not None, 'backing thresholds missing')
    liquidity=report.get('liquidity')or{}
    require(number(liquidity.get('free_liquidity_pct')), 'pool cash percentage missing')
    if number(vault.get('free_usdc')) and number(vault.get('total_assets')) and vault['total_assets']>0:
        require(abs((liquidity.get('free_liquidity_pct') or 0)-vault['free_usdc']/vault['total_assets']*100)<0.011, 'instant cash metric includes noncash accrual or wrong clock')
    require(bool((report.get('dependencies')or{}).get('upstream')), 'upstream dependencies missing')
    require(bool(report.get('report_url')), 'report URL missing')
    require(bool((report.get('issuer')or{}).get('curator')), 'issuer curator missing')
    retained_exit=(retained.get('liquidity')or{}).get('exit_mark')
    if retained_exit:
        require(liquidity.get('exit_mark')==retained_exit, 'dated exit-mark evidence changed or missing')
    require((specific.get('liquidity')or{}).get('timestamp')==((retained.get('asset_specific')or{}).get('liquidity')or{}).get('timestamp'), 'nested exit-mark source clock changed or missing')
    retained_market=(retained.get('asset_specific')or{}).get('peg')or{}
    actual_market=specific.get('peg')or{}
    require(actual_market==retained_market, 'nested retained market values/source clock changed or missing')
    return {'asset':slug,'status':'passed' if not failures else 'failed','failures':failures,'paired_history_points':len(pairs)}

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data',type=Path,required=True)
    parser.add_argument('--retained',type=Path,required=True)
    args=parser.parse_args();results=[]
    for slug in IDENTITIES:
        report=json.loads((args.data/(slug+'_backing.json')).read_text())
        history=json.loads((args.data/(slug+'_backing_history.json')).read_text())
        retained=json.loads((args.retained/(slug+'-retained.json')).read_text())
        results.append(check(report,history,retained))
    print(json.dumps({'results':results,'all_passed':all(r['status']=='passed'for r in results)},indent=2))
    return int(any(r['status']!='passed'for r in results))

if __name__=='__main__':
    raise SystemExit(main())
