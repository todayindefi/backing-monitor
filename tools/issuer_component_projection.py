"""Exact reviewed component contract; never fall back to private family records."""
import hashlib
import json
import pathlib
from urllib.parse import urlsplit

SOURCE = pathlib.Path('/home/danger/DeFiAnalyst/data/reviews/strc-family-issuer-2026-11-03/public-source-contract.json')
STATUS = {'verified', 'extracted', 'searched_not_found', 'unknown'}


def record(row, entity=False):
    keys = (['role','name','jurisdiction'] if entity else ['key','value']) + [
        'status','basis','as_of','checked','source_date','observation_dates','measurement_ref','block_number']
    if row.get('status') not in STATUS:
        raise ValueError('Unrecognized source status')
    urls = row.get('source_urls')
    if not isinstance(urls,list) or not urls or not all(isinstance(u,str) and urlsplit(u).scheme=='https' and urlsplit(u).netloc and not urlsplit(u).username for u in urls):
        raise ValueError('Direct HTTPS source missing')
    return {**{k:row[k] for k in keys if k in row},'source_urls':urls}


def _add_component_source(feed, policy, source=SOURCE):
    approval = policy.get('reviewed_component_contract') or {}
    reserved = approval.get('reserved_assets') or {}
    # These placeholders also prevent previously published project rows from
    # silently filling fields the selected component contract did not export.
    feed['component_profiles'] = {asset:{'project_slug':r['project'],'component_slug':r['component'],
        'name':r['name'],'status':'unavailable_selected_source','entities':[],'facts':[],
        'coverage':{},'limitations':['Selected component source unavailable or changed; no family/upstream fallback.']}
        for asset,r in reserved.items()}
    feed['reference_components'] = {}
    feed['component_source'] = {'status':'not_configured' if not reserved else 'unavailable',
        'approved_sha256':approval.get('sha256'),'source_owner':'DeFiAnalyst'}
    if not reserved:
        return
    try:
        raw = source.read_bytes()
        sha = hashlib.sha256(raw).hexdigest()
        if sha != approval.get('sha256'):
            raise ValueError('Source changed; renewed publication review required')
        selected = json.loads(raw)
        if selected['schema_version']!=1 or selected['kind']!='reviewed-public-source-snapshot' or selected['producer']!='DeFiAnalyst':
            raise ValueError('Unrecognized source contract')
        profiles, references = {}, {}
        for c in selected['components']:
            if c.get('visibility')!='public':
                raise ValueError('Component not selected for public projection')
            asset = c.get('riskanalyst_slug')
            if asset and (asset not in reserved or c['component_slug']!=reserved[asset]['component'] or c['project_slug']!=reserved[asset]['project']):
                raise ValueError('Exact component mapping changed')
            coverage = {}
            for key,v in c['coverage'].items():
                if v['state'] not in STATUS|{'not_exported'}:
                    raise ValueError('Unrecognized coverage state')
                coverage[key]={'state':v['state'],'meaning':v['meaning']}
            p={'project_slug':c['project_slug'],'component_slug':c['component_slug'],'name':c['name'],
               'status':'available_selected_fields','profile_checked':c.get('profile_checked'),
               'handback_checked':selected['checked'],'entities':[record(r,True) for r in c['entities']],
               'facts':[record(r) for r in c['facts']],'coverage':coverage,'limitations':c['limitations']}
            if asset:profiles[asset]=p
            else:references[c['component_slug']]=p
        if set(profiles)!=set(reserved):
            raise ValueError('Reserved component missing from source')
        # All profiles become available together only after validating the full
        # selected contract. No partial validation can leak unapproved records.
        events=[]
        for e in selected.get('related_public_events',[]):
            if not e.get('url','').startswith('https://'):
                raise ValueError('Event source missing')
            events.append({k:e[k] for k in ['project','accession','filing_date','activity_start','activity_end','balance_as_of','url'] if k in e})
        contexts=[]
        for r in selected.get('layer_context_records',[]):
            contexts.append({**record(r),'scope':r['scope'],'project_slug':r['project_slug'],'component_slug':r['component_slug']})
        pending=[{k:r[k] for k in ['component','proposed_project','riskanalyst_slug','state','current_project'] if k in r}
                 for r in selected.get('pending_owner_decisions',[])]
        feed.update(component_profiles=profiles,reference_components=references,
            component_related_events=events,layer_context_records=contexts,pending_component_decisions=pending)
        feed['component_source']={'status':'available','sha256':sha,'approved_sha256':sha,
            'source_commit':approval.get('source_commit'),'source_owner':'DeFiAnalyst','checked':selected['checked'],
            'scope':'Selected component fields only; parent profiles private; no rights inheritance'}
    except (OSError,ValueError,KeyError,TypeError):
        feed['component_source']['status']='withheld_source_missing_changed_or_invalid'


def add_components(feed, policy, source=SOURCE):
    """Independently validate exact approved component contracts.

    A supplemental source may add disjoint components, never replace a previous
    contract or make its private parent a fallback when bytes change.
    """
    _add_component_source(feed, policy, source)
    feed['component_sources'] = [dict(feed['component_source'])]
    for approval in policy.get('additional_reviewed_component_contracts', []):
        reserved = approval.get('reserved_assets') or {}
        if set(reserved) & set(feed['component_profiles']):
            raise ValueError('Conflicting reviewed component source mapping')
        partial = {}
        selected_path = approval.get('source_path')
        if not isinstance(selected_path, str) or not selected_path:
            selected_path = '/nonexistent/unavailable-reviewed-component-contract'
        _add_component_source(partial, {'reviewed_component_contract':approval}, pathlib.Path(selected_path))
        if set(partial['reference_components']) & set(feed['reference_components']):
            raise ValueError('Conflicting reviewed reference component mapping')
        feed['component_profiles'].update(partial['component_profiles'])
        feed['reference_components'].update(partial['reference_components'])
        feed['component_sources'].append(dict(partial['component_source']))
        for key in ['component_related_events','layer_context_records','pending_component_decisions']:
            feed.setdefault(key, []).extend(partial.get(key, []))
