"""Public metadata projection: retain provenance without exposing host paths.

Known producer paths become stable owner-qualified source IDs. Raw scheduler
commands are reduced to cadence plus a record digest. Unknown host paths or
explicit private-owner data fail closed rather than being silently published.
"""
import hashlib
import re

OWNERS={'PegTracker':'pegtracker','DexTracker':'dextracker','riskAnalyst':'riskanalyst','security_analyst':'security-analyst','DeFiAnalyst':'defianalyst','backing-monitor':'backing-monitor'}
LOCAL=re.compile(r'/home/[^/\s]+/('+ '|'.join(re.escape(x) for x in OWNERS)+r')/([^\s\"\'<>]+)')
HOST=re.compile(r'/home/|/Users/|/tmp/|file://')
PRIVATE_KEYS={'private_owner_context','private_holdings','private_simulations','account_credentials','authentication_token'}

def source_id(value):
    if '.private-reviews' in value or '/private/' in value:
        raise ValueError('Private context is not eligible for public dashboard projection')
    value=LOCAL.sub(lambda m:OWNERS[m[1]]+':'+m[2],value)
    if HOST.search(value):raise ValueError('Unreviewed local path in public dashboard metadata')
    return value

def public_projection(value):
    if isinstance(value,list):return [public_projection(x) for x in value]
    if not isinstance(value,dict):return source_id(value) if isinstance(value,str) else value
    if value.get('visibility')=='private' or value.get('publication_approved') is False or PRIVATE_KEYS.intersection(value):
        raise ValueError('Private or unapproved owner context in public dashboard projection')
    result={}
    for key,item in value.items():
        if isinstance(item,str) and key in ('entry','cron_entry') and HOST.search(item):
            # The first five cron fields are cadence, not a command to execute.
            fields=item.split()
            if len(fields)<6:raise ValueError('Malformed schedule metadata')
            result[key]=' '.join(fields[:5])
            result[key+'_record_sha256']=hashlib.sha256(item.encode()).hexdigest()
            paths=LOCAL.findall(item)
            result[key+'_source_ids']=list(dict.fromkeys(OWNERS[owner]+':'+path for owner,path in paths))
        else:result[key]=public_projection(item)
    return result
