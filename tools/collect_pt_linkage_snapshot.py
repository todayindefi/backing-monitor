"""One-off BM financial reads using an existing RPC client; no authority attestation."""
import argparse,concurrent.futures,importlib.util,json,pathlib,datetime
from eth_utils import to_checksum_address
ROOT=pathlib.Path(__file__).resolve().parents[1]
ASSETS={'srusdat':('monad',143,'0x17b8f7373ecd556192abfc85be314e5d4fb6b3fa'),'siusd':('ethereum',1,'0xdbdc1ef57537e34680b898e1febd3d68c7389bcb'),'susn':('ethereum',1,'0xe24a3dc889621612422a64e6388927901608b91d')}
def collect(output):
 output=pathlib.Path(output).resolve()
 if '.private-reviews' not in output.parts and not output.is_relative_to(pathlib.Path('/tmp')):raise ValueError('private output required')
 output.mkdir(parents=True,exist_ok=True)
 spec=importlib.util.spec_from_file_location('existing_financial_rpc','/home/danger/security_analyst/audits/mseth-authority-2026-11-04/collect.py');r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r);r.RPC['monad']=['https://rpc.monad.xyz']
 blocks={};result={'scope':'one-off public accounting reads; no holder queries or transactions; candidate bridge mapping not Security-verified','blocks':blocks,'assets':{}}
 for ch,id in [('monad',143),('ethereum',1)]:
  cid=r.rpc(ch,'eth_chainId',[]);b=r.rpc(ch,'eth_getBlockByNumber',['latest',False]);blocks[ch]={'chain_id':cid,'block':b};assert cid.get('result')==hex(id) and b.get('ok'),'valid chain/block required'
 def job(item):
  name,(ch,id,token)=item;b=blocks[ch]['block']['result']['number'];reads={}
  for sig,outs in [('symbol()',('string',)),('decimals()',('uint8',)),('totalSupply()',('uint256',)),('asset()',('address',)),('totalAssets()',('uint256',))]:reads[sig]=r.call(ch,token,sig,outs=outs,block=b)
  dec=reads['decimals()'].get('decoded');asset=reads['asset()'].get('decoded');underlying={}
  if isinstance(dec,int) and 0<=dec<=36:
   for sig in ['convertToAssets(uint256)','previewRedeem(uint256)']:reads[sig]=r.call(ch,token,sig,types=('uint256',),args=(10**dec,),outs=('uint256',),block=b)
  if isinstance(asset,str) and len(asset)==42 and int(asset,16)!=0:
   for sig,outs in [('symbol()',('string',)),('decimals()',('uint8',)),('totalSupply()',('uint256',))]:underlying[sig]=r.call(ch,asset,sig,outs=outs,block=b)
   underlying['balanceOf(wrapper)']=r.call(ch,asset,'balanceOf(address)',types=('address',),args=(token,),outs=('uint256',),block=b)
  return name,{'chain':ch,'chain_id':id,'token':token,'block':b,'reads':reads,'underlying_reads':underlying}
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as ex:
  for name,item in ex.map(job,ASSETS.items()):result['assets'][name]=item;print(name,'financial read complete',flush=True)
 # Accounting lead only: remote peer is not proof of authorization/configuration security.
 m=result['assets']['srusdat'];mb=m['block'];peer=r.call('monad',m['token'],'peers(uint32)',types=('uint32',),args=(30101,),outs=('bytes32',),block=mb);bridge={'mapping_status':'candidate_only_not_Security_verified','monad_peer_for_ethereum_eid30101':peer}
 p=peer.get('decoded')
 if isinstance(p,str) and len(p)==66 and int(p,16)!=0 and int(p[2:26],16)==0:
  adapter='0x'+p[-40:];eb=blocks['ethereum']['block']['result']['number'];bridge['candidate_ethereum_adapter']=adapter;bridge['ethereum_block']=eb;bridge['token_call']=r.call('ethereum',adapter,'token()',outs=('address',),block=eb)
  token=bridge['token_call'].get('decoded');expected='0xfaa9a0e1db9e22ae3a20b2b58a68dc24d053d066';bridge['matches_known_ethereum_senior']=isinstance(token,str) and token.lower()==expected
  if bridge['matches_known_ethereum_senior']:
   bridge['escrow_balance']=r.call('ethereum',token,'balanceOf(address)',types=('address',),args=(adapter,),outs=('uint256',),block=eb);bridge['ethereum_senior_decimals']=r.call('ethereum',token,'decimals()',outs=('uint8',),block=eb);bridge['ethereum_senior_supply']=r.call('ethereum',token,'totalSupply()',outs=('uint256',),block=eb)
 result['bridge_accounting_lead']=bridge
 for ch,b in blocks.items():
  b['recheck']=r.rpc(ch,'eth_getBlockByNumber',[b['block']['result']['number'],False]);b['hash_stable']=b['recheck'].get('result',{}).get('hash')==b['block']['result']['hash'] if b['recheck'].get('ok') else None
 result['captured_at']=datetime.datetime.now(datetime.timezone.utc).isoformat();(output/'financial-observations.private.json').write_text(json.dumps(result,indent=2)+'\n');return result
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',required=True);a=p.parse_args();collect(a.output)
