"""Offline, private, one-off loan evidence consolidation. No score/publication."""
import argparse
import datetime as dt
import json
from collections import defaultdict
from decimal import Decimal as D, localcontext
from pathlib import Path
from shared_asset_evidence import canonical, digest


def clean(x):
    if isinstance(x,D):return str(x)
    if isinstance(x,dict):return {k:clean(v) for k,v in x.items()}
    if isinstance(x,list):return [clean(v) for v in x]
    return x


def iso(x):
    return dt.datetime.fromtimestamp(int(x),dt.timezone.utc).isoformat()


def rolling(series,asof,days):
    end=dt.datetime.fromtimestamp(asof,dt.timezone.utc).date()
    start=end-dt.timedelta(days=days)
    rows=[x for x in series if start<=dt.date.fromisoformat(x['date'])<end]
    return {'start_inclusive':str(start),'end_exclusive':str(end),'reported_days':len(rows),
            'expected_days':days,'complete_reported_calendar':len({x['date'] for x in rows})==days,
            'reported_amount':str(sum((D(str(x['value'])) for x in rows),D(0))),
            'basis':'Issuer API event-derived daily nominal totals; complete calendar is not complete contractual/payment coverage. Current partial UTC day excluded.'}


def assemble(raw):
    load=lambda n:json.loads((raw/n).read_text(),parse_float=D)
    snapshot=load('loan-snapshot.json');proof=load('proof-of-reserves.json');future=load('future-yield-payments.json')
    default=load('default-rate.json');native=load('current-native.json');review=load('baseline/review.json')
    schemas=load('openapi-derived.json')['components']['schemas'];rows=[];groups=defaultdict(D);hardware=defaultdict(D)
    schedules={}
    for p in (raw/'document-schedules').glob('*.json'):
        if not p.name.endswith('.receipt.json'):
            r=json.loads(p.read_text(),parse_float=D)
            if 'loanId'in r:schedules[r['loanId']]=r
    deals=[x for x in proof if x['type']=='DEAL'];active=[];curves=[]
    def f(v,unit,source,basis,clock=None,kind='issuer_reporting'):
        return {'value':clean(v),'unit':unit,'source_refs':source,'clock':clock or {},'evidence_class':kind,
                'basis':basis,'publication_permission':'internal_only_not_authorized'}
    for deal in deals:
        schedule=schedules.get(deal['documentId'])
        assert schedule and schedule['chainId']==deal['chain']
        assert schedule['currency']['decimals']==18 and schedule['currency']['symbol']=='USDai'
        scale=D(10)**schedule['currency']['decimals'];principal=D(schedule['totalPrincipal'])/scale
        live=schedule['status']==1
        if live:
            active.append((deal,schedule,principal))
            assert abs(principal-D(deal['totalRemainingAmount'])/scale)<D('0.000001')
            groups[deal.get('group') or deal['documentId']]+=principal
            for h in deal.get('hardware',[]):hardware[h['name']]+=principal*D(str(h['percentage']))/100
        curve=schedule.get('coverage',[])
        if curve:curves.append({'document_id':deal['documentId'],'source_as_of':iso(schedule['asOf']),
            'monthly_reported_curve':curve,'classification':'Issuer-projected conditional VSA payout curve; not independent resale valuation, funded DSRA, cash or guaranteed insurance.'})
        rows.append({'document_id':deal['documentId'],'chain_id':deal['chain'],'publisher_name':deal['name'],
            'publisher_borrower_address':deal.get('borrower'),'publisher_group':deal.get('group'),
            'publisher_stage_raw':deal['stage'],'schedule_status_raw':schedule['status'],
            'schedule_as_of':iso(schedule['asOf']),'reference_currency':schedule['currency'],
            'remaining_scheduled_principal':str(principal),'principal_classification':'Remaining scheduled principal; current funded claim only for reported Active status, with independently verified coverage unestablished.',
            'remaining_interest':str(D(schedule['totalInterest'])/scale),
            'remaining_schedule_rows':schedule['repayments'],'reported_apr_percent':deal['apr'],
            'reported_location':deal['locationName'],'reported_hardware':deal.get('hardware'),
            'offtake_category_raw':deal.get('offTake'),'verified_borrower_spv_or_related_group':None,
            'actual_dscr':None,'actual_compute_utilization':None,'current_rental_revenue':None,
            'offtaker_identity_and_termination_rights':None,'days_past_due':None,
            'scheduled_vs_verified_settled_matches':None,'funded_dsra':None,'independent_gpu_net_liquidation_value':None,
            'publication_permission':'internal_only_not_authorized'})
    principal=sum((p for _,_,p in active),D(0));api_principal=D(str(snapshot['current']['deployed']))
    future_principal=sum((D(str(p['principalAmount'])) for p in future['payments']),D(0))
    sorted_active=sorted(active,key=lambda t:t[2],reverse=True)
    concentration=[{'document_id':d['documentId'],'publisher_name':d['name'],'amount':str(p),'visible_subset_pct':str(p/principal*100)} for d,s,p in sorted_active]
    def obs(name):
        x=native['reads'][name];return x.get('decoded') if x.get('ok') else None
    total,supply,bridge,shares,idle=[obs(x) for x in ['totalAssets()','totalSupply()','bridgedSupply()','totalShares()','idle_usdai']]
    assert all(isinstance(x,int)for x in [total,supply,bridge,shares,idle])
    pending=D(shares-supply-bridge)/10**18;assert pending>=0
    pin=native['pin']['result'];nc={'block':int(pin['number'],16),'block_hash':pin['hash'],'block_time':iso(int(pin['timestamp'],16))}
    api_queue=load('susdai-redemptions-queue.json');cash=D(idle)/10**18
    aggregate_current=f(snapshot,'reported loan statistics',['loan-snapshot'],
        'Reported compute timestamp does not date collateral appraisals or certify active/allTime population completeness.',{'computed_at':iso(snapshot['asOf'])})
    periods={}
    for n in ['principal-repaid-history','yield-repaid-history']:
        history=load(n+'.json');periods[n]={'as_of':iso(history['asOf']),
            'windows':{str(days):rolling(history['series'],int(history['asOf']),days)for days in [30,60,90]},
            'last_positive_reported_day':next((x['date']for x in reversed(history['series'])if D(str(x['value']))>0),None),
            'coverage':'Reported API LoanRouter events; no independent receipts, loan/payment joins or all-offchain settlement coverage established.'}
    ltv=D(str(snapshot['current']['ltv']))
    stress=[{'collateral_haircut_pct':str(h*100),'mechanical_implied_ltv_pct':str(ltv/(1-h)*100),
             'measured_loan_loss':None,'measured_nav_loss':None}for h in [D('.2'),D('.3'),D('.4')]]
    aup=load('historical-aup-summary.json');aup['initial_funded_principal_total_usd']=str(sum((D(x['initial_principal_usd'])for x in aup['loans']if not x['escrowed_unfunded_at_snapshot']),D(0)))
    missing={
        'full_population_completeness':'Current signed loan/series tape with funding/draw/rollover identifiers, legacy pool mapping, outstanding principal/accrual/commitment definitions and reconciliation to aggregate305.5m and onchain306.8m.',
        'payment_performance':'Executed payment schedules and changes plus loan-level bank/onchain settled principal/interest receipts, due-to-paid matching, grace/cure periods, DPD buckets, defaults, extensions/restructures, capitalized interest, writeoffs and provisions for30/60/90days.',
        'economic_counterparties':'Borrower/SPV/ultimate-related-group and offtaker names, credit, revenue contracts, tenor/cancellation terms, current DSCR, utilization and rental/revenue reporting.',
        'collateral':'Dated independent per-server/model appraisals, net realized arm\'s-length sale comparables, liquidation costs/time and enforceable lien/priority; July original values and current VSA curves are not this evidence.',
        'funded_protection':'Current per-loan DSRA statements/draws/replenishments, equity funded proof, signed warranties and exclusions/expiry/caps/beneficiary plus paid/denied/pending claims and market-shock suspension terms.',
        'cash_bridge':'Vault-level deposits/redemptions/loan disbursements/receipts/fees/accrual/impairment/CHR transfer receipts; queue requested/filled/rolled/age ledger and restricted cash; settled GLX transactions versus listings.'}
    return clean({'schema_version':'usdai-loan-performance-evidence/1','assembly_owner':'BackingMonitor',
        'identity':{'chain':'arbitrum','chain_id':42161,'usdai':'0x0a1a1a107e45b7ced86833863f482bc5f4ed82ef','susdai':'0x0b2b2b2076d95dda7817e785989fe353fe955ef9'},
        'scope':'One-off private financial follow-up, reusing normal producer starting point and newly inspected public issuer API; no scores, recurring jobs or publication.',
        'assessment_version':None,'publication':'not_authorized',
        'loan_population':{
            'reported_loan_statistics':aggregate_current,
            'published_rows':f({'reserve_rows':len(proof),'deal_rows':len(deals),'reported_active_schedules':len(active),'reported_uninitialized_schedules':sum(s['status']==0 for s in schedules.values())},'records',['proof-of-reserves','document-schedules'],'All27published UUID schedules resolved. Scope limited to published rows; borrower addresses not legal identities. Proof response supplies no independent valuation as_of.'),
            'tape':rows,
            'reconciliation':f({'active_schedule_principal':str(principal),'future_scheduled_principal':str(future_principal),
                'future_vs_schedule_rounding_residual':str(future_principal-principal),
                'api_active_principal':str(api_principal),'api_minus_visible_schedule_principal':str(api_principal-principal),
                'visible_vs_api_dollar_comparison_pct':str(principal/api_principal*100),'verified_full_population_coverage':None},
                'nominal reference currency amounts',['proof-of-reserves','document-schedules','future-yield-payments','loan-snapshot'],
                'Visible21future schedules are only a partial subset of larger API metric; cross-clock/perimeter difference is not loan loss or a verified missing-asset claim. Future amounts use decimal-unit schema despite contradictory endpoint prose; raw schedules divided by18decimals cross-check the scaling.',{'aggregate_computed_at':iso(snapshot['asOf']),'future_computed_at':iso(future['asOf'])},'derived_comparison'),
            'reported_liquidation_event_incidence':f(default,'event count/rate',['default-rate','openapi-derived'],
                'Counts qualifying loans with LoanLiquidated events, not all arrears, missed payments, restructures, impairments or defaults. Zero does not establish healthy credit.',{'computed_at':iso(default['asOf'])}),
            'actual_arrears_buckets':f(None,'principal and count by DPD',['document-schedules','future-yield-payments'],
                'Returned remaining/future schedules omit settled history and do not match contractual obligations to receipts; no zero arrears inference.')},
        'concentration':{'visible_subset_principal':str(principal),'by_published_record':concentration,
            'largest_five_visible_pct':str(sum((p for _,_,p in sorted_active[:5]),D(0))/principal*100),
            'publisher_group_labels':dict(groups),'by_reported_hardware_name_principal':dict(hardware),
            'true_related_group_and_offtaker_concentration':None,
            'basis':'Partial visible active principal only. Published group labels and borrower addresses do not establish legal group, offtaker or independent economic exposures.'},
        'payments':{'reported_daily_series_comparisons':periods,'verified_loan_level_receipts':None,
            'reported_lifetime_yield':load('total-yield-repaid.json'),'reported_lifetime_originations':load('total-originated-volume.json'),
            'limits':'Cumulative events, remaining future schedules and originated commitments have different perimeters; cannot infer timely servicing, collection ratio or cash-flow causes.'},
        'collateral_and_protection':{'historical_independent_aup':aup,
            'current_independent_appraisal':None,'actual_per_loan_current_ltv':None,'funded_dsra':None,
            'issuer_monthly_vsa_curves':curves,'verified_current_guaranteed_payout':None,
            'hardware_health_schema':f(schemas['PublicHardwareServerDto'],'public schema',['openapi-derived'],
                'Public isHealthy is documented always true, including placeholders; two queried samples return only this flag. It cannot establish telemetry, utilization or physical condition.'),
            'mechanical_haircut_scenarios':f(stress,'conditional LTV percent',['loan-snapshot'],
                'Uses issuer reported aggregate LTV mechanically, holding debt fixed; appraisal date/method independent accuracy unknown. Not collateral losses converted into loan/NAV losses or forecast recoveries.',{'issuer_compute_time':iso(snapshot['asOf'])},'scenario_not_forecast')},
        'cash_and_queue':{
            'native_observations':f({'total_assets':str(D(total)/10**18),'idle_usdai':str(cash),
                'implied_nonidle_mark':str(D(total-idle)/10**18),'pending_share_identity_residual':str(pending),
                'deposit_price':str(D(obs('depositSharePrice()'))/10**18),'redemption_price':str(D(obs('redemptionSharePrice()'))/10**18)},
                'USDai or sUSDai shares as named',['current-native'],'Accounting reads only. pending=totalShares-totalSupply-bridgedSupply, not full queue ages or immediate capacity. Nonidle is not verified principal.',nc,'independent_native_observation'),
            'issuer_queue':f(api_queue,'reported queue aggregates',['susdai-redemptions-queue'],
                'Empty/zero API output does not close nonzero native pending-share identity residual; coverage/implementation mismatch unresolved.',{'computed_at':iso(api_queue['asOf'])}),
            'starting_cash_comparison':{'old_as_of':review['comparison']['before']['timestamp'],'baseline_as_of':review['selected_evidence_as_of'],
                'old_idle':str(D(str(review['comparison']['idle_before_usd']))),'baseline_idle':str(D(str(review['comparison']['idle_after_usd']))),
                'basis':'Observed book decline; no completed deposits/redemptions/funding/repayment/fee bridge and no loss/default cause inferred.'},
            'verified_glx_settlements':None,'verified_chr_donation_receipts':None,'complete_cash_flow_bridge':None},
        'missing_documents':missing,
        'collection_limits':['No credentials, access controls bypass, external outreach, wallet monitoring, new jobs, transactions or publication.',
            'Initial terms-hash schedule IDs returned404; documented public record UUIDs resolved27/27. A404 was an identifier mismatch, not denial or a missing-loan finding.',
            'All monetary source clocks retained; fetch time does not renew July15 assurance. No independently verified full-current loan tape or timely-payment certificate.'],
        'field_publication_default':'internal_only_not_authorized',
        'publication_policy':{'applies_to_every_field_path':True,'permission':'internal_only_not_authorized','exceptions':[]}})


def build(raw,output):
    raw,output=Path(raw).resolve(),Path(output).resolve()
    if '.private-reviews'not in output.parts:raise ValueError('private output required')
    manifest=json.loads((raw/'input-manifest.private.json').read_text())
    assert set(manifest)=={str(p.relative_to(raw))for p in raw.rglob('*')if p.is_file()and p.name!='input-manifest.private.json'}
    for name,sha in manifest.items():assert digest((raw/name).read_bytes())==sha,name
    with localcontext()as ctx:ctx.prec=70;payload=assemble(raw)
    registry={}
    for p in raw.rglob('*.receipt.json'):
        receipt=json.loads(p.read_text());key=str(p.relative_to(raw)).removesuffix('.receipt.json')
        registry[key]={'url':receipt.get('url'),'http_status':receipt.get('status',receipt.get('http_status')),
            'requested_at':receipt.get('requested_at'),'received_at':receipt.get('received_at'),
            'response_sha256':receipt.get('sha256'),'owner':'USD.AI publisher / public source as identified by URL'}
    registry['document-schedules']={'members':sorted(k for k in registry if k.startswith('document-schedules/')),'owner':'USD.AI publisher'}
    registry['openapi-derived']={'derived_from':'swagger-init.js','basis':'Parsed public Swagger swaggerDoc; no code execution or authenticated routes.'}
    registry['current-native']={'source':'current-native.json','owner':'BackingMonitor, existing specialist RPC helper','scope':'Pinned public contract views, not independent underwriting or payment certification.'}
    payload['source_registry']=registry
    body=canonical(payload);sha=digest(body);snaps=output/'snapshots';snaps.mkdir(parents=True,exist_ok=True);p=snaps/(sha+'.json')
    if p.exists():assert p.read_bytes()==body
    else:p.write_bytes(body)
    pointer={'evidence_version':'sha256:'+sha,'snapshot':'snapshots/'+p.name,'assessment_version':None,'publication':'not_authorized','status':'bounded_return_for_RiskAnalyst_review'}
    (output/'current.json').write_bytes(canonical(pointer));prov=output/'provenance';prov.mkdir(exist_ok=True);p=prov/(sha+'.private.json');b=canonical({'inputs':manifest,'raw_root':str(raw)})
    if p.exists():assert p.read_bytes()==b
    else:p.write_bytes(b)
    return pointer


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--raw',required=True);p.add_argument('--output',required=True);a=p.parse_args();print(json.dumps(build(a.raw,a.output),indent=2))
