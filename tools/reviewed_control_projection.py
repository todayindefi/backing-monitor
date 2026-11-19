"""Keep dated historical topology separate from the accepted control snapshot."""
import copy
from datetime import datetime,timezone

def reviewed_control_projection(legacy,review,asset):
    if review.get('schema_version')!='accepted-control-review/1':
        return copy.deepcopy(legacy)
    if legacy.get('asset')!=asset:raise ValueError('Historical topology identity mismatch')
    previous=legacy.get('contract',{}).get('legacy_topology')
    historical=copy.deepcopy(previous if previous else legacy)
    def stamp(value):
        parsed=datetime.fromisoformat(str(value).replace('Z','+00:00'))
        return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed
    try:
        state='historical' if stamp(historical.get('as_of'))<=stamp(review['as_of']) else 'newer_unreviewed'
    except ValueError:state='unresolved_clock'
    return {'schema_version':'contract/1','asset':asset,'producer':'BackingMonitor',
        'as_of':review['as_of'],'source_owner':'Accepted RiskAnalyst public report citing Security native observations',
        'contract':{'headline':review['headline'],'method':'accepted_dated_control_review',
            'observed_at':review['as_of'],'accepted_control_review':copy.deepcopy(review),
            'audit_scope_note':review['audit_scope_note'],'unmeasured':copy.deepcopy(review['gaps']),
            'legacy_topology':historical,'legacy_topology_status':state}}
