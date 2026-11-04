"""One-off BM public read snapshot; reuses existing RPC/vault clients. No signing/jobs."""
import argparse,concurrent.futures,datetime,hashlib,importlib.util,json,pathlib
import requests
ROOT=pathlib.Path(__file__).resolve().parents[1]
TOKENS={'wbtc':'0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599','tbtc':'0x18084fbA666a33d37592fA2633fD49a74DD93a88','lbtc':'0x8236a87084f8B84306f72007F36F2618A5634494'}
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def load(name,path):
 s=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
def collect(output):
 output=pathlib.Path(output).resolve()
 if '.private-reviews' not in output.parts and not output.is_relative_to(pathlib.Path('/tmp')):raise ValueError('private/local output required')
 output.mkdir(parents=True,exist_ok=True)
 rpc_path=pathlib.Path('/home/danger/security_analyst/audits/mseth-authority-2026-11-04/collect.py');reader=load('btc_existing_rpc',rpc_path);result={'producer':'BackingMonitor','scope':'one-off public identity/supply and issuer-source capture; not Security authority review','started_at':now(),'rpc_reader_component_sha256':hashlib.sha256(rpc_path.read_bytes()).hexdigest(),'assets':{},'oracles':{},'http_sources':{}}
 result['chain_id']=reader.rpc('ethereum','eth_chainId',[]);result['block']=reader.rpc('ethereum','eth_getBlockByNumber',['latest',False])
 block=result['block'].get('result',{}).get('number') if result['block'].get('ok') else None
 if result['chain_id'].get('result')!='0x1':block=None
 def token_job(item):
  symbol,address=item;calls={}
  for signature,outs in [('symbol()',('string',)),('decimals()',('uint8',)),('totalSupply()',('uint256',))]:calls[signature]=reader.call('ethereum',address,signature,outs=outs,block=block)
  code=reader.rpc('ethereum','eth_getCode',[address,block]);return symbol,{'address':address,'block':block,'calls':calls,'code':code,'identity_verification':'ERC20 metadata/code presence only; implementation/authority remains Security-owned'}
 def oracle_job(item):
  name,address=item;calls={}
  for signature,outs in [('decimals()',('uint8',)),('description()',('string',)),('latestRoundData()',('uint80','int256','uint256','uint256','uint80'))]:calls[signature]=reader.call('ethereum',address,signature,outs=outs,block=block)
  return name,{'address':address,'block':block,'calls':calls,'basis':'Documented feed pointer; values/description/units require financial scope validation; not independent net strategy NAV'}
 if block:
  with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
   for k,v in ex.map(token_job,TOKENS.items()):result['assets'][k]=v;print(k,'identity/supply snapshot complete',flush=True)
   for k,v in ex.map(oracle_job,{'lbtc_chainlink_documented':'0x5c29868C58b6e15e2b962943278969Ab6a7D3212','lbtc_redstone_documented':'0xb415eAA355D8440ac7eCB602D3fb67ccC1f0bc81'}.items()):result['oracles'][k]=v
  result['block_recheck']=reader.rpc('ethereum','eth_getBlockByNumber',[block,False]);result['block_hash_stable']=result['block_recheck'].get('result',{}).get('hash')==result['block']['result']['hash'] if result['block_recheck'].get('ok') else None
 else:result['identity_status']='unavailable; no valid pinned Ethereum block'
 urls={'wbtc_transparency':'https://www.wbtc.network/transparency','lbtc_transparency':'https://www.lombard.finance/transparency/lbtc/','lbtc_oracles':'https://docs.lombard.finance/learn/transparency/oracles'}
 def http_job(item):
  name,url=item;receipt={'url':url,'request_started_at':now()}
  try:
   r=requests.get(url,timeout=25);receipt.update(received_at=now(),status_code=r.status_code,sha256=hashlib.sha256(r.content).hexdigest());(output/(name+'.html')).write_bytes(r.content)
  except requests.RequestException as e:receipt.update(received_at=now(),error=type(e).__name__)
  return name,receipt
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as ex:
  for k,v in ex.map(http_job,urls.items()):result['http_sources'][k]=v
 # Historical documented vault pointer: verify returned identity; never treat it as a user's position.
 lmt_path=pathlib.Path('/home/danger/LendingMarketTracker/src/protocols/morpho_vault_allocations.py');lmt=load('btc_existing_vault_reader',lmt_path);before=now();vault=lmt.get_vault_market_allocations('0x8eB67A509616cd6A7c1B3c8C21D48FF57df3d458',1);result['vault_candidate']={'historical_lead_address':'0x8eB67A509616cd6A7c1B3c8C21D48FF57df3d458','request_started_at':before,'received_at':now(),'data':vault,'source':'existing LendingMarketTracker Morpho client','underlying_block_time':None,'portfolio_exposure':'unknown','APY':None,'scope':'Public vault candidate only; no account balances; exact user opportunity join/denominators pending'}
 result['finished_at']=now();(output/'observations.private.json').write_text(json.dumps(result,indent=2)+'\n');print('One-off captured; no transactions or schedules',flush=True)
if __name__=='__main__':
 a=argparse.ArgumentParser(description=__doc__);a.add_argument('--output-dir',required=True);args=a.parse_args();collect(args.output_dir)
