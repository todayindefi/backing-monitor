// Attempt/assembly status never renews the retained financial observation clock.
function renderAssetSourceStatus(ref,label) {
    label=label || 'Source';
    if(!/^(data\/[a-z0-9_]+_source_status\.json|previews\/[a-z0-9-]+\/data\/preview_status\.json)$/.test(ref))return;
    var statusId='asset-source-status-'+ref.replace(/[^a-z0-9]/g,'-');
    function warning(text){var el=document.getElementById(statusId);if(!el){el=document.createElement('div');el.id=statusId;el.className='panel';el.setAttribute('role','alert');el.style.color='#b45309';document.body.prepend(el);}el.textContent=text;}
    return fetch(ref,{cache:'no-store'}).then(function(r){if(!r.ok)throw Error('Status unavailable');return r.json();}).then(function(s){
        if(s.status==='success'){var previous=document.getElementById(statusId);if(previous)previous.remove();return;}
        warning(label+' refresh failed at '+(s.attempted_at || 'unknown time')+'. '+(s.message || 'Last-good measurements retained with original clocks.'));
    }).catch(function(){warning(label+' status unavailable. Snapshot freshness is unverified; use the original source clocks.');});
}
document.addEventListener('DOMContentLoaded',function(){
    if(!location.pathname.includes('/previews/'))return;
    var slug=new URLSearchParams(location.search).get('asset');
    if(slug && /^[a-z0-9-]+$/.test(slug))renderAssetSourceStatus('previews/'+slug+'/data/preview_status.json','Review');
});
