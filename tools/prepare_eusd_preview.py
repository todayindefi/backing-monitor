#!/usr/bin/env python3
"""Prepare isolated standard-BM staging files; never registers production data."""
import argparse,io,json,shutil,subprocess,tarfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def dashboard_data(product,issuer):
    meta={'slug':'eusd','name':'eUSD (Reserve Electronic Dollar)','chain':'Ethereum','published':False,'contract_address':product['identity']['token'],'description':'Reserve Ethereum eUSD candidate; not Lybra eUSD. Unmeasured axes remain explicit.','report_status':'unavailable'}
    payload={'schema_version':1,'asset_slug':'eusd','asset':'eUSD','chain':'ethereum','chain_id':1,'timestamp':product['source_clock']['block_timestamp'].replace('+00:00','Z'),'peg':{'nav':1,'nav_basis':'Nominal USD target, not guaranteed cash redemption','market_price':None},'backing':{'collateral_ratio':None},'liquidity':{},'dependencies':{},'contract':{},'issuer':{},'asset_specific':{'type':'reserve-eusd','reserve_eusd':product,'issuer_component':issuer['component_profiles']['eusd']}}
    return meta,payload

def prepare(product,issuer,output,runtime_state=None):
    if product['identity']['chain_id']!=1 or product['identity']['token'].lower()!='0xa0d69e286b938e21cbf7e51d71f6a4c8918f482f':raise ValueError('Wrong eUSD identity')
    output=Path(output).resolve()
    if not output.is_relative_to(Path('/tmp')) and '.private-reviews' not in output.parts:raise ValueError('Isolated review output only')
    output.mkdir(exist_ok=True,parents=True)
    archive=subprocess.check_output(['git','archive','HEAD','index.html','js','css'],cwd=ROOT)
    with tarfile.open(fileobj=io.BytesIO(archive)) as t:t.extractall(output,filter='data')
    (output/'js/renderers/eusd.js').write_bytes((ROOT/'js/renderers/eusd.js').read_bytes())
    p=output/'js/app.js';s=p.read_text();s=s.replace('var ASSET_RENDERERS = {','var ASSET_RENDERERS = {\n    eusd: EusdRenderer,',1);p.write_text(s)
    p=output/'index.html';s=p.read_text();s=s.replace('<script src="js/app.js','<script src="js/renderers/eusd.js?v=20261113-candidate"></script>\n    <script src="js/app.js',1);s=s.replace('Data refreshes every hour. Dashboard auto-refreshes every 5 minutes.','Review candidate snapshot. Two-hour dynamic collection is not yet activated; documentary and Security clocks remain separate.');p.write_text(s)
    data=output/'data';data.mkdir(exist_ok=True)
    meta,payload=dashboard_data(product,issuer)
    for name,d in [('assets.json',[meta]),('eusd_backing.json',payload)]: (data/name).write_text(json.dumps(d,indent=2)+'\n')
    if runtime_state:
        shutil.copytree(Path(runtime_state)/'public-data',data,dirs_exist_ok=True)
        (output/'js/eusd-data.js').write_bytes((ROOT/'js/eusd-data.js').read_bytes())
        p=output/'index.html';s=p.read_text().replace('<script src="js/renderers/eusd.js','<script src="js/eusd-data.js?v=20261113-generation"></script>\n    <script src="js/renderers/eusd.js',1);p.write_text(s)
        p=output/'js/app.js';s=p.read_text();old="document.addEventListener('DOMContentLoaded', function() {\n    route();\n    setInterval(route, REFRESH_INTERVAL);\n});"
        new="document.addEventListener('DOMContentLoaded', async function() { async function update() { try { await EusdData.bootstrap(); await route(); } catch(e) { showError('Canonical eUSD feed unavailable or failed integrity checks: '+e.message); } } await update(); setInterval(update,REFRESH_INTERVAL); });"
        if old not in s:raise ValueError('Standard BM init contract changed')
        s=s.replace(old,new).replace('        renderAsset(slug);','        return renderAsset(slug);').replace('        renderIndex();','        return renderIndex();');p.write_text(s)
    return output
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--product',required=True,type=Path);p.add_argument('--issuer',required=True,type=Path);p.add_argument('--output',required=True,type=Path);p.add_argument('--runtime-state',type=Path);a=p.parse_args();print(prepare(json.loads(a.product.read_text()),json.loads(a.issuer.read_text()),a.output,a.runtime_state))
