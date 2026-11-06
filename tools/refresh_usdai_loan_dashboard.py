"""Public issuer-source projection only. No private package, scores or new jobs.

Use --fetch with a NEW private capture-root to acquire an updated observation,
or project existing hash-verified public HTTP captures. Never restamps source age.
"""
import argparse
import concurrent.futures
import datetime as dt
import hashlib
import json
from decimal import Decimal as D, localcontext
from pathlib import Path
import uuid
from build_usdai_loan_performance import iso, rolling, clean
from shared_asset_evidence import canonical

ENDPOINTS={
    'loan-snapshot':'/usdai/dashboard/loan-snapshot',
    'proof-of-reserves':'/usdai/dashboard/proof-of-reserves?chainId=42161',
    'future-yield-payments':'/usdai/dashboard/future-yield-payments',
    'principal-repaid-history':'/usdai/dashboard/principal-repaid-history',
    'yield-repaid-history':'/usdai/dashboard/yield-repaid-history',
    'default-rate':'/usdai/dashboard/default-rate'}


def fetch(root):
    import requests
    if root.exists():raise ValueError('New capture directory required')
    if '.private-reviews'not in root.resolve().parts:raise ValueError('Private capture root required')
    root.mkdir(parents=True)
    def capture(name,path):
        url='https://api.usd.ai'+path;started=dt.datetime.now(dt.timezone.utc).isoformat()
        response=requests.get(url,timeout=30);response.raise_for_status();body=response.content
        target=root/(name+'.json');target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(body)
        (root/(name+'.receipt.json')).write_bytes(canonical({'url':url,'status':response.status_code,
            'requested_at':started,'received_at':dt.datetime.now(dt.timezone.utc).isoformat(),
            'sha256':hashlib.sha256(body).hexdigest()}))
        return json.loads(body)
    with concurrent.futures.ThreadPoolExecutor(max_workers=4)as pool:
        list(pool.map(lambda item:capture(*item),ENDPOINTS.items()))
    proof=json.loads((root/'proof-of-reserves.json').read_text())
    jobs=[]
    for row in proof:
        if row['type']!='DEAL':continue
        key=str(uuid.UUID(row['documentId']))
        if row['chain']!=42161:raise ValueError('Unexpected chain')
        jobs.append(('document-schedules/'+key,'/usdai/loans/42161/'+key+'/schedule'))
    with concurrent.futures.ThreadPoolExecutor(max_workers=4)as pool:list(pool.map(lambda item:capture(*item),jobs))


def project(root,policy):
    root=Path(root);sources={}
    assert set(policy['allowed_source_paths'])==set(ENDPOINTS.values())|{'/usdai/loans/42161/{published_document_uuid}/schedule'}
    def read(name,expected):
        receipt=json.loads((root/(name+'.receipt.json')).read_text());body=(root/(name+'.json')).read_bytes()
        assert receipt['url']==policy['source_origin']+expected
        assert receipt.get('status',receipt.get('http_status'))==200
        assert hashlib.sha256(body).hexdigest()==receipt['sha256']
        sources[name]={'url':receipt['url'],'response_sha256':receipt['sha256'],
            'requested_at':receipt['requested_at'],'received_at':receipt['received_at']}
        return json.loads(body,parse_float=D)
    docs={name:read(name,path)for name,path in ENDPOINTS.items()}
    records=[];pipeline=0;schedule_clocks=[];proof=docs['proof-of-reserves']
    for deal in proof:
        if deal['type']!='DEAL':continue
        key=str(uuid.UUID(deal['documentId']));assert deal['chain']==42161
        schedule=read('document-schedules/'+key,'/usdai/loans/42161/'+key+'/schedule')
        assert schedule['loanId']==key and schedule['chainId']==42161
        assert schedule['currency']['symbol']=='USDai'and schedule['currency']['decimals']==18
        schedule_clocks.append(iso(schedule['asOf']))
        if schedule['status']!=1:pipeline+=1;continue
        repayments=schedule['repayments']
        row={'record_id':key,'publisher_name':deal['name'],'reported_status':'API Active',
            'remaining_principal':str(D(schedule['totalPrincipal'])/10**18),
            'remaining_interest':str(D(schedule['totalInterest'])/10**18),'reference_currency':'USDai',
            'reported_apr_pct':str(deal['apr']),
            'last_scheduled_due_at':iso(max(x['dueAt']for x in repayments))if repayments else None,
            'schedule_as_of':iso(schedule['asOf'])}
        assert set(row)<=set(policy['allowed_record_fields']);records.append(row)
    records.sort(key=lambda x:D(x['remaining_principal']),reverse=True)
    visible=sum((D(x['remaining_principal'])for x in records),D(0))
    total=D(str(docs['loan-snapshot']['current']['deployed']))
    future=docs['future-yield-payments'];start=int(future['asOf']);end=start+30*86400
    next_rows=[x for x in future['payments']if start<=x['dueAt']<end]
    assert all(x['currency']['symbol']=='USDai'and x['currency']['decimals']==18 for x in next_rows)
    payments={}
    for kind in ['principal','yield']:
        source=docs[kind+'-repaid-history'];series=source['series']
        payments[kind]={'computed_at':iso(source['asOf']),
            'last_positive_reported_day':max((x['date']for x in series if D(str(x['value']))>0),default=None),
            'windows':{str(days):rolling(series,int(source['asOf']),days)for days in [30,60,90]}}
    payload={'schema_version':'usdai-public-loan-evidence/1','producer':'BackingMonitor',
        'scope':'Public issuer reporting, incomplete population; not independent underwriting or verified collections',
        'chain':'arbitrum','chain_id':42161,'denomination':'Nominal USDai/USD reporting units; no independent current dollar market mark',
        'snapshot_computed_at':iso(docs['loan-snapshot']['asOf']),
        'schedule_source_range':{'oldest':min(schedule_clocks),'newest':max(schedule_clocks)},
        'population':{'published_deal_count':len(records)+pipeline,'reported_active_count':len(records),
            'other_status_count':pipeline,'visible_remaining_principal':str(visible),
            'aggregate_reported_principal':str(total),'scope_difference':str(total-visible),
            'largest_five_visible_pct':str(sum((D(x['remaining_principal'])for x in records[:5]),D(0))/visible*100)if visible else None,
            'verified_full_population_coverage':None},
        'loan_records':records,'reported_payment_history':payments,
        'next_30_days_schedule':{'source_computed_at':iso(start),'start':iso(start),'end_exclusive':iso(end),
            'rows':len(next_rows),'loan_count':len({x['loanTermsHash']for x in next_rows}),
            'principal':str(sum((D(str(x['principalAmount']))for x in next_rows),D(0))),
            'interest':str(sum((D(str(x['interestAmount']))for x in next_rows),D(0))),
            'basis':'Scheduled future amounts already decimalized; not settlements or guaranteed receipts.'},
        'liquidation_event_counter':{'reported':docs['default-rate']['defaulted'],'population':docs['default-rate']['total'],
            'computed_at':iso(docs['default-rate']['asOf']),'basis':'LoanLiquidated-event incidence, not all defaults or arrears.'},
        'unverified':{'loan_level_receipt_matching':None,'arrears_aging':None,'restructurings':None,
            'current_independent_gpu_values':None,'funded_dsra':None,'enforceable_recovery_value':None},
        'sources':sources,'refresh_cadence':'one_off_manual','publication_scope':'User-approved public issuer-source projection only'}
    text=canonical(clean(payload))
    for prohibited in [b'/home/',b'borrower',b'locationLatitude',b'profile_sha256',b'assessment_version',b'private_wallet']:
        assert prohibited not in text,prohibited
    return text


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--capture-root',required=True);p.add_argument('--output',required=True)
    p.add_argument('--policy',default='config/usdai_loan_dashboard_publication.json');p.add_argument('--fetch',action='store_true');a=p.parse_args()
    root=Path(a.capture_root);policy=json.loads(Path(a.policy).read_text());output=Path(a.output)
    assert output.name==policy['output_file']
    if a.fetch:fetch(root)
    with localcontext()as ctx:ctx.prec=70;body=project(root,policy)
    output.parent.mkdir(parents=True,exist_ok=True);output.write_bytes(body)
    print(json.dumps({'output':str(output),'sha256':hashlib.sha256(body).hexdigest()}))
