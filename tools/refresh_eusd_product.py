#!/usr/bin/env python3
"""Asset-specific BM runtime: public contract reads, last-good state, staging feed.

Never queries a wallet or portfolio. Quotes use only public tokens/protocol NAV.
No production data root or parent issuer profile is written or published.
"""
import argparse,hashlib,importlib,json,os,re,shutil,subprocess,sys
from datetime import datetime,timezone
from decimal import Decimal
from pathlib import Path
from eusd_product import normalize,canonical
from prepare_eusd_preview import dashboard_data
from build_eusd_shared_evidence import build
from issuer_component_projection import _add_component_source
ROOT=Path(__file__).resolve().parents[1]

def now():return datetime.now(timezone.utc).isoformat()
def load(p):return json.loads(Path(p).read_text())
def atomic(path,value):
    path=Path(path);path.parent.mkdir(parents=True,exist_ok=True);tmp=path.with_suffix(path.suffix+'.tmp');tmp.write_bytes(canonical(value));tmp.replace(path)
def checked(path,sha):
    b=Path(path).read_bytes()
    if hashlib.sha256(b).hexdigest()!=sha:raise ValueError('Selected source changed; renewed source acceptance required')
    return b

def selected_issuer(config):
    s=config['selected_issuer'];p=ROOT/s['path'];checked(p,s['sha256']);feed={}
    policy={'reviewed_component_contract':{'sha256':s['sha256'],'reserved_assets':{'eusd':{'project':'reserve-protocol','component':'reserve-eusd','name':'Reserve Electronic Dollar'}}}}
    _add_component_source(feed,policy,p)
    if feed['component_source']['status']!='available':raise ValueError('Selected issuer projection unavailable')
    return feed

def readers(config):
    c=config['reader'];root=Path(c['module_root']);commit=c['source_commit']
    if not re.fullmatch('[a-f0-9]{40}',commit):raise ValueError('Invalid selected reader commit')
    cache=ROOT/'.private-reviews'/'eusd-accepted-readers'/commit;cache.mkdir(parents=True,exist_ok=True)
    expected={c['raw_module']+'.py':c['raw_sha256'],c['quote_module']+'.py':c['quote_sha256'],**c['dependencies']}
    for name,sha in expected.items():
        if Path(name).name!=name:raise ValueError('Invalid reader source path')
        blob=subprocess.run(['git','-C',str(root),'show',commit+':'+name],check=True,capture_output=True).stdout
        if hashlib.sha256(blob).hexdigest()!=sha:raise ValueError('Selected reader source changed')
        path=cache/name
        if not path.exists():path.write_bytes(blob)
        checked(path,sha)
    sys.path.insert(0,str(root));sys.path.insert(0,str(cache))
    return importlib.import_module(c['raw_module']),importlib.import_module(c['quote_module'])

def acquire(config):
    from web3 import Web3
    reader,_=readers(config);failures=[]
    for url in filter(None,[os.environ.get('ETHEREUM_RPC_URL'),'https://ethereum-rpc.publicnode.com','https://eth.llamarpc.com']):
        try:
            w=Web3(Web3.HTTPProvider(url,request_kwargs={'timeout':20}))
            block=w.eth.get_block('finalized')
            raw=reader.read_reserve_eusd(w,block_identifier=block['number'])
            raw['source_clock']['finality_basis']='RPC finalized tag resolved before reads; block hash rechecked at completion'
            normalize(raw)
            return raw
        except Exception as e:failures.append(type(e).__name__)
    raise RuntimeError('All whole-snapshot provider attempts failed: '+','.join(failures))

def enrich(product,quotes,history):
    """Only accepted quote observations become history; never fill missing prices."""
    history=list(history)
    if not quotes:
        product['liquidity_exit']={'status':'unavailable_latest_quote_attempt','quotes':None,'depth_10bps':None,'depth_25bps':None,'depth_50bps':None}
        product['stability']['history']=history
        return product,history
    ident=quotes['identity']
    if ident['chain_id']!=1 or ident['token_in'].lower()!=product['identity']['token'].lower() or ident['token_out'].lower()!='0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' or ident['input_decimals']!=18 or ident['output_decimals']!=6:
        raise ValueError('Quote identity/units mismatch')
    keys=['requested_at','received_at','amount_in_raw','status','output_usdc','nav_cost_bps_ex_gas','size_impact_bps','fees_breakdown','gas_usd_estimate']
    rows={k:{name:v.get(name)for name in keys}for k,v in quotes['quotes'].items()}
    product['liquidity_exit']={'status':'measured_indicative_quotes','quotes':rows,'depths':quotes['depths'],'reference_usdc_per_eusd':quotes['nav_usdc_per_eusd'],'limitations':quotes['limitations'],'nav_reference_clock':product['source_clock'],'reference_basis':'Protocol basket price midpoint times basketsNeeded/supply; USD-to-USDC parity is an explicit nominal assumption, not a measured USDC/USD peg.'}
    for d in quotes['depths']:product['liquidity_exit']['depth_'+str(d['threshold_bps'])+'bps']=d
    first=rows.get('1000',{})
    if first.get('status')=='quoted' and first.get('output_usdc') is not None:
        price=Decimal(first['output_usdc'])/(Decimal(first['amount_in_raw'])/10**18)
        record={'timestamp':first['received_at'],'price_usdc_per_eusd':str(price),'reference_usdc_per_eusd':quotes['nav_usdc_per_eusd'],'basis':'1000 USDC-reference indicative sell quote, not executable spot or independent USD price','accounting_clock':product['source_clock']}
        if not any(x['timestamp']==record['timestamp']for x in history):history.append(record)
        history=sorted(history,key=lambda x:x['timestamp'])[-2160:]
        product['stability']={'market_price':str(price),'market_price_unit':'USDC/eUSD','market_price_basis':record['basis'],'market_price_clock':first['received_at'],'reference_usd':'1','reference_usdc_per_eusd':quotes['nav_usdc_per_eusd'],'reference_basis':product['liquidity_exit']['reference_basis'],'reference_clock':product['source_clock'],'history':history,'history_coverage':'Measured retained observations only; no synthetic backfill. Full seven/thirty-day statistics require actual elapsed coverage.'}
    else:product['stability']['history']=history
    return product,history

def stage_generation(state,product,issuer,last_attempt):
    state=Path(state);meta,payload=dashboard_data(product,issuer)
    files={'assets.json':[meta],'eusd_backing.json':payload,'eusd_product.json':product,'eusd_peg_history.json':{'asset_slug':'eusd','unit':'USDC/eUSD','entries':product['stability'].get('history')or[],'basis':'Measured matched quote/reference series; no interpolation.'}}
    bodies={name:canonical(value)for name,value in files.items()}
    manifest={'schema_version':'eusd-staging-generation/1','identity':{'chain_id':1,'token':product['identity']['token']},'generated_at':product['runtime']['last_assembly_completed_at'],'source_clock':product['source_clock'],'files':{k:{'sha256':hashlib.sha256(v).hexdigest(),'bytes':len(v)}for k,v in bodies.items()}}
    mb=canonical(manifest);generation=hashlib.sha256(mb).hexdigest();directory=state/'public-data'/'generations'/generation;directory.mkdir(parents=True,exist_ok=True)
    for name,body in bodies.items():
        if any(x in body for x in [b'/home/',b'.private-reviews',b'private_wallet',b'wallet_balance']):raise ValueError('Private content rejected')
        p=directory/name
        if p.exists()and p.read_bytes()!=body:raise ValueError('Immutable generation changed')
        p.write_bytes(body)
    (directory/'manifest.json').write_bytes(mb)
    pointer={'schema_version':'eusd-staging-feed-pointer/1','generation':generation,'manifest':'generations/'+generation+'/manifest.json','manifest_sha256':generation,'last_attempt':last_attempt,'source_clock':product['source_clock'],'schedule_installed':product['runtime']['schedule_installed']}
    atomic(state/'public-data'/'current.json',pointer)
    dirs=[d for d in (state/'public-data'/'generations').iterdir()if d.is_dir()and re.fullmatch('[a-f0-9]{64}',d.name)]
    dirs.sort(key=lambda d:load(d/'manifest.json')['generated_at'])
    for old in dirs[:-84]:
        if old.name!=generation:shutil.rmtree(old)
    return generation

def validate_generation(public):
    public=Path(public);pointer=load(public/'current.json');generation=pointer['generation']
    if not re.fullmatch('[a-f0-9]{64}',generation)or pointer['manifest']!='generations/'+generation+'/manifest.json' or pointer['manifest_sha256']!=generation:raise ValueError('Invalid generation pointer')
    directory=public/'generations'/generation;mb=(directory/'manifest.json').read_bytes()
    if hashlib.sha256(mb).hexdigest()!=generation:raise ValueError('Generation manifest hash mismatch')
    m=json.loads(mb);names={'assets.json','eusd_backing.json','eusd_product.json','eusd_peg_history.json'}
    if set(m['files'])!=names:raise ValueError('Wrong generation inventory')
    for name,spec in m['files'].items():
        b=(directory/name).read_bytes()
        if hashlib.sha256(b).hexdigest()!=spec['sha256']or len(b)!=spec['bytes']:raise ValueError('Generation file hash mismatch')
    p=load(directory/'eusd_product.json');b=load(directory/'eusd_backing.json')
    if p['identity']['chain_id']!=1 or p['identity']['token'].lower()!='0xa0d69e286b938e21cbf7e51d71f6a4c8918f482f' or p['source_clock']!=m['source_clock'] or b['asset_specific']['reserve_eusd']!=p:raise ValueError('Generation identity/clock mismatch')
    return pointer

def failed_attempt(state,error):
    state=Path(state);attempt={'attempt_at':now(),'status':'failed_last_good_retained','error':type(error).__name__,'detail':'Collection or publication failed; original observation clocks retained.'}
    atomic(state/'last-attempt.json',attempt)
    pointer=state/'public-data'/'current.json'
    if pointer.exists():
        p=load(pointer);p['last_attempt']=attempt;atomic(pointer,p)
    return attempt

def persist(raw,quotes,state,config):
    state=Path(state);product=normalize(raw);issuer=selected_issuer(config)
    history=load(state/'peg-history.json') if (state/'peg-history.json').exists() else []
    product,history=enrich(product,quotes,history)
    installed=(state/'schedule-installed.json').exists()
    product['runtime']={'owner':'BackingMonitor','dynamic_seconds':7200,'schedule_installed':installed,'scope':'Reserve Ethereum eUSD only; documentary/Security observations retain separate clocks','last_collection_completed_at':product['source_clock'].get('observed_at',product['source_clock']['block_timestamp']),'last_assembly_completed_at':now()}
    raw_bytes=canonical(raw);raw_sha=hashlib.sha256(raw_bytes).hexdigest();atomic(state/'raw'/f'{raw_sha}.json',raw)
    body=canonical(product);sha=hashlib.sha256(body).hexdigest();atomic(state/'snapshots'/f'{sha}.json',product)
    build(product,issuer['component_profiles']['eusd'],state/'shared',{'raw_source_sha256':raw_sha,'source_reader':config['reader'],'issuer_selected_sha256':config['selected_issuer']['sha256']})
    atomic(state/'current.json',{'schema_version':'reserve-eusd-pointer/1','snapshot':'snapshots/'+sha+'.json','sha256':sha,'source_clock':product['source_clock'],'status':'bounded_partial_evidence'})
    atomic(state/'peg-history.json',history)
    stage_generation(state,product,issuer,{'attempt_at':now(),'status':'ok_with_explicit_gaps','source_clock':product['source_clock'],'quote_observation_present':quotes is not None})
    return product,sha

def git(repo,*args,check=True):
    return subprocess.run(['git','-C',str(repo),*args],check=check,capture_output=True,text=True)

def publish(state,config):
    """Non-force push of exactly four sanitized eUSD JSON files to one data branch."""
    state=Path(state);validate_generation(state/'public-data');repo=state/'staging-feed';c=config['staging_feed'];branch=c['branch']
    if not (repo/'.git').exists():
        repo.mkdir(parents=True,exist_ok=True);git(repo,'init','-b',branch);git(repo,'remote','add','origin',c['remote'])
        remote=git(repo,'ls-remote','--heads','origin',branch).stdout.strip()
        if remote:git(repo,'fetch','origin',branch);git(repo,'reset','--hard','FETCH_HEAD')
    if git(repo,'branch','--show-current').stdout.strip()!=branch:raise ValueError('Wrong eUSD feed branch')
    git(repo,'config','user.name','BackingMonitor eUSD');git(repo,'config','user.email','backing-monitor@users.noreply.github.com')
    dest=repo/'data';dest.mkdir(exist_ok=True)
    allowed=lambda name: name=='data/current.json' or re.fullmatch(r'data/generations/[a-f0-9]{64}/(manifest|assets|eusd_backing|eusd_product|eusd_peg_history)\.json',name)
    for old in dest.rglob('*.json'):
        rel=old.relative_to(dest)
        if not (state/'public-data'/rel).exists():old.unlink()
    for p in (state/'public-data').rglob('*.json'):
        rel=p.relative_to(state/'public-data');name='data/'+str(rel)
        if not allowed(name):raise ValueError('Unrelated public feed path')
        body=p.read_bytes();json.loads(body)
        if any(x in body for x in [b'/home/',b'.private-reviews',b'private_wallet',b'wallet_balance']):raise ValueError('Private content rejected from staging feed')
        out=dest/rel;out.parent.mkdir(parents=True,exist_ok=True);out.write_bytes(body)
    git(repo,'add','-A','--','data')
    staged=git(repo,'diff','--cached','--name-only').stdout.splitlines()
    if any(not allowed(x)for x in staged):raise ValueError('Unrelated staged feed path')
    if staged:git(repo,'commit','-m','Update canonical eUSD staging data')
    git(repo,'push','origin','HEAD:refs/heads/'+branch)
    atomic(state/'publication.json',{'branch':branch,'commit':git(repo,'rev-parse','HEAD').stdout.strip(),'completed_at':now(),'production':False})

def main():
    p=argparse.ArgumentParser();p.add_argument('--config',type=Path,default=ROOT/'config/eusd_product.json');p.add_argument('--state-dir',type=Path,default=ROOT/'.private-reviews/eusd-runtime');p.add_argument('--raw-file',type=Path);p.add_argument('--quotes-file',type=Path);p.add_argument('--skip-live-quotes',action='store_true');p.add_argument('--collect-quotes',action='store_true');p.add_argument('--publish-staging',action='store_true');a=p.parse_args();config=load(a.config);state=a.state_dir.resolve()
    if '.private-reviews'not in state.parts and not state.is_relative_to(Path('/tmp')):raise ValueError('Runtime state must be private/local')
    try:
        raw=load(a.raw_file)if a.raw_file else acquire(config)
        quotes=load(a.quotes_file)if a.quotes_file else None;quote_error=None
        if a.collect_quotes and not config.get('quote_collection_authorized',False):raise ValueError('Live quote cutover not authorized; PegTracker direct approval pending')
        if not a.raw_file and a.collect_quotes and not a.skip_live_quotes:
            try:
                _,q=readers(config);reads=raw['reads'];pair=reads['basket.price_no_issuance_premium']['value'];nav=(Decimal(pair[0])+Decimal(pair[1]))/2/10**18*Decimal(reads['rtoken.basketsNeeded']['value'])/Decimal(reads['rtoken.totalSupply']['value']);quotes=q.quote_reserve_eusd(nav)
            except Exception as e:quote_error=type(e).__name__
        product,sha=persist(raw,quotes,state,config)
        atomic(state/'last-attempt.json',{'attempt_at':now(),'status':'ok_with_explicit_gaps','product_sha256':sha,'source_clock':product['source_clock'],'quote_error':quote_error,'quote_observation_present':quotes is not None})
        if a.publish_staging:publish(state,config)
        print(json.dumps({'status':'ok_with_explicit_gaps','product_sha256':sha,'block':product['source_clock']['block_number'],'staging_published':a.publish_staging}))
    except Exception as e:
        failed_attempt(state,e)
        if a.publish_staging and (state/'public-data/current.json').exists():
            try:publish(state,config)
            except Exception:pass
        raise
if __name__=='__main__':main()
