"""Exact, hash-selected Security observations; never inherit generic topology."""
from pathlib import Path
import json,hashlib
TOKEN='0xa0d69e286b938e21cbf7e51d71f6a4c8918f482f'
MAIN='0x7697ae4def3c3cd52493ba3a6f57fc6d8c59108a'
def project_security(source,product):
    c=source['component']
    if source['kind']!='security-reviewed-public-source-fields'or source['schema_version']!=1 or c['chain_id']!=1 or c['token'].lower()!=TOKEN or c['main'].lower()!=MAIN:raise ValueError('Wrong exact Security component')
    if product['identity']['token'].lower()!=TOKEN or product['identity']['main'].lower()!=MAIN:raise ValueError('Wrong financial component')
    current={(h['token'].lower(),h['plugin'].lower())for h in product['basket']['holdings']if h['current_basket_member']is True}
    reviewed={(r['token'].lower(),r['plugin'].lower())for r in source['receipts']}
    if current!=reviewed:raise ValueError('Current receipt/plugin scope differs from Security observation')
    bindings=[]
    for b in source['bindings']:
        if b['chain_id']!=1 or b['source_runtime_binding']['record_code_equals_pinned_code']is not True:raise ValueError('Unbound source record')
        bindings.append({k:b.get(k)for k in ['component','address','implementation','runtime_code_keccak','verification_url','source_runtime_binding']})
    return {'schema_version':'eusd-public-security/1','component':c,'status':source['status'],'source_clock':source['source_clock'],'binding_method':source['binding_method'],'bindings':bindings,'controls':source['controls'],'receipts':source['receipts'],'unsupported':source['unsupported'],'grades_authored':False,'scope':'Finite exact Reserve Ethereum eUSD review, with explicit gaps. Original control clock is not renewed by financial collection.'}
def selected_security(config,root,product):
    selected=config.get('selected_security')
    if not selected:return {'status':'owner_pending','source_clock':None}
    try:
        body=(Path(root)/selected['path']).read_bytes()
        if hashlib.sha256(body).hexdigest()!=selected['sha256']:raise ValueError('Selected Security source hash mismatch')
        return project_security(json.loads(body),product)
    except (OSError,ValueError,KeyError,TypeError)as e:
        return {'status':'selected_source_unavailable','source_clock':None,'reason':type(e).__name__,'fallback_used':False,'scope':'Exact selected source unavailable or no longer matches current receipt/plugin scope. No generic topology substitution.'}
